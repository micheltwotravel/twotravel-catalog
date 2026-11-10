// GET /api/reservations-sync
// Fetches all HubSpot reservation deals → upserts to Supabase → returns rows
// Called by FinancePanel on load so the board always reflects HubSpot

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const SUPABASE_ID = "finance_reservations_v1";
const HS_TOKEN    = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

const STAGES = [
  "1078513048","1078513049",
  "closedwon","1081725980","1081725981","1081725982",
];
const HS_PROPS = [
  "dealname","amount","deal_currency_code","arrival_date","departure_date",
  "city_tt","number_of_people_in_the_reservation","number_of_guests_villa_b",
  "hubspot_owner_id","head_concierge","source___deal","dealstage",
  "client_price","cliente_price","client_price___villas","boat_price",
  "amount___villas","our_price___boat",
  "provider___villas","provider___boat","provider___airbnb_vrbo","item___airbnb_vrbo",
  "createdate","hs_lastmodifieddate",
];

function pick(props, keys) {
  for (const k of keys) { const v=props[k]; if (v&&v!==""&&v!=="null") return v; }
  return "";
}
async function hs(path, body) {
  const r = await fetch(`https://api.hubapi.com${path}`, {
    method: body?"POST":"GET",
    headers:{ Authorization:`Bearer ${HS_TOKEN}`, "Content-Type":"application/json" },
    ...(body?{body:JSON.stringify(body)}:{}),
  });
  return r.json();
}
async function getAllDeals(stageId) {
  const all=[]; let after;
  while(true){
    const d=await hs("/crm/v3/objects/deals/search",{
      filterGroups:[{filters:[{propertyName:"dealstage",operator:"EQ",value:stageId}]}],
      properties:HS_PROPS, associations:["contacts"], limit:100,
      ...(after?{after}:{}),
    });
    all.push(...(d.results||[]));
    if(d.paging?.next?.after) after=d.paging.next.after; else break;
  }
  return all;
}
const CC={};
async function getContact(id){
  if(CC[id]) return CC[id];
  const d=await hs(`/crm/v3/objects/contacts/${id}?properties=firstname,lastname,email`);
  const p=d.properties||{};
  return (CC[id]={name:[p.firstname,p.lastname].filter(Boolean).join(" "),email:p.email||""});
}
function dealToRow(dealId, props, guestName, guestEmail) {
  const provider=pick(props,["provider___villas","provider___boat","provider___airbnb_vrbo"]);
  const item=pick(props,["item___airbnb_vrbo"]);
  const clientPrice=pick(props,["client_price___villas","boat_price","cliente_price","client_price","amount"]);
  const ourPrice=pick(props,["amount___villas","our_price___boat"]);
  const parts=(props.dealname||"").split(/\s*[-,]\s*/);
  const concierge = pick(props,["head_concierge"]);
  // parts[2] is often "November 2026" (month-year) in MX deals — only use it if it doesn't look like a date
  const part2 = parts[2]?.trim()||"";
  const isMonthYear = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}$/i.test(part2);
  return {
    _hubspotDealId: String(dealId),
    _source:        "hubspot",
    name:           guestName||parts[0]?.trim()||props.dealname||"",
    guestEmail:     guestEmail||"",
    conciergeRep:   /^\d+$/.test(concierge) ? "" : concierge,
    fecha:          props.arrival_date||"",
    checkOut:       props.departure_date||"",
    city:           pick(props,["city_tt"])||parts[1]?.trim()||"",
    provider,
    serviceDescription: item||(!isMonthYear?part2:"")||"",
    qty:            pick(props,["number_of_people_in_the_reservation","number_of_guests_villa_b"]),
    clientTotalUSD: clientPrice?String(clientPrice):"",
    precioProveedor:ourPrice?String(ourPrice):"",
    currency:       props.deal_currency_code||"USD",
    dealSource:     props.source___deal||"",
    servicesStatus: "Confirmed",
    createdAt:      props.createdate||"",
  };
}

export default async function handler(req, res) {
  if (!HS_TOKEN) return res.status(500).json({ error:"Missing HUBSPOT_PRIVATE_APP_TOKEN" });

  try {
    // 1. Fetch all HubSpot deals
    const all=[];
    for (const s of STAGES) {
      const deals=await getAllDeals(s);
      all.push(...deals);
    }
    const unique=[...new Map(all.map(d=>[d.id,d])).values()];

    // 2. Map to Compass rows
    const hsRows=[];
    for (const deal of unique) {
      const props=deal.properties||{};
      let guestName="", guestEmail="";
      const c=deal.associations?.contacts?.results?.[0];
      if(c){const info=await getContact(c.id);guestName=info.name;guestEmail=info.email;}
      hsRows.push(dealToRow(deal.id,props,guestName,guestEmail));
    }

    // 3. Load existing Supabase data — keep manual + slack rows (they take precedence over HubSpot)
    const { data: existing } = await supabase
      .from("kickoffs").select("data").eq("id", SUPABASE_ID).maybeSingle();
    const d = existing?.data||{};
    const notes = typeof d.internalNotes==="string" ? JSON.parse(d.internalNotes) : (d.internalNotes||{});
    const existingRows = notes.reservations||[];
    const preservedRows = existingRows.filter(r=>!r._source||r._source==="manual"||r._source?.startsWith("slack"));

    // 4. Merge: HubSpot rows + preserved rows; preserved rows win on name+fecha dedup
    // HubSpot deal names often include " - City - Month Year" suffix — strip it for dedup
    function hsBaseName(name) {
      return (name||"").replace(/\s*-\s*[A-Za-z ]+\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}\s*$/i,"").toLowerCase().trim();
    }
    const preservedKeys = new Set(preservedRows.map(r=>`${(r.name||"").toLowerCase().trim()}|${r.fecha||""}`));
    const filteredHsRows = hsRows.filter(r=>{
      const exact   = `${(r.name||"").toLowerCase().trim()}|${r.fecha||""}`;
      const stripped= `${hsBaseName(r.name)}|${r.fecha||""}`;
      return !preservedKeys.has(exact) && !preservedKeys.has(stripped);
    });

    // Dedup within HubSpot rows: same stripped name+fecha → keep the one with a price
    // (prevents "Client - City - Month YYYY" empty duplicates from showing)
    const hsDeduped = new Map();
    for (const r of filteredHsRows) {
      const k = `${hsBaseName(r.name)}|${r.fecha||""}`;
      const prev = hsDeduped.get(k);
      if (!prev) {
        hsDeduped.set(k, r);
      } else if (!prev.clientTotalUSD && r.clientTotalUSD) {
        hsDeduped.set(k, r);                           // replace no-price with priced
      } else if (prev.clientTotalUSD && r.clientTotalUSD) {
        hsDeduped.set(`${k}|${r._hubspotDealId}`, r); // both priced → keep both
      }
      // prev has price, new doesn't → keep prev (do nothing)
    }
    const merged = [...hsDeduped.values(), ...preservedRows]
      .sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));

    // 5. Save back
    const newData = { ...d, internalNotes: JSON.stringify({...notes, reservations:merged}) };
    await supabase.from("kickoffs").upsert({ id:SUPABASE_ID, data:newData }, { onConflict:"id" });

    res.json({ ok:true, count:merged.length, hubspot:filteredHsRows.length, preserved:preservedRows.length });
  } catch(err) {
    console.error("reservations-sync error:", err);
    res.status(500).json({ error:err.message });
  }
}
