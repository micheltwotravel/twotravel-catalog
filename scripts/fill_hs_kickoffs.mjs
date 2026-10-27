// fill_hs_kickoffs.mjs
// Fill in kickoffs that were stub-created with hs_<contactId> IDs but have no data
// Usage: node --env-file=.env.production.local scripts/fill_hs_kickoffs.mjs [--dry-run]

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const HUBSPOT_BASE = "https://api.hubapi.com";
const token = process.env.HUBSPOT_API_KEY;

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function hs(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${HUBSPOT_BASE}${path}`, opts);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return text; }
}

async function main() {
  console.log(`\n🔧  Fill hs_ kickoffs ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

  // 1. Find all stub kickoffs: id starts with hs_ and no guestName
  const { data: kickoffs } = await sb.from("kickoffs").select("id, data");
  const stubs = kickoffs.filter(k => {
    const id = k.id || "";
    const name = (k.data?.guestName || "").trim();
    return id.startsWith("hs_") && !name;
  });

  console.log(`Found ${stubs.length} stub kickoffs (hs_ prefix, no name)\n`);
  if (stubs.length === 0) { console.log("Nothing to do."); return; }

  // 2. Extract HubSpot contact IDs and batch-fetch
  const contactIds = stubs.map(k => k.id.replace("hs_", ""));
  const r = await hs("/crm/v3/objects/contacts/batch/read", "POST", {
    inputs: contactIds.map(id => ({ id })),
    properties: ["email", "firstname", "lastname", "phone", "city", "destination__c", "hs_lead_status", "createdate"],
  });
  const contacts = r?.results || [];
  const byId = {};
  contacts.forEach(c => { byId[c.id] = c; });

  if (contacts.length === 0) {
    console.log("  ⚠️  Batch read returned 0 contacts — raw response:");
    console.log("  ", JSON.stringify(r).slice(0, 500));
    console.log("\n  Retrying with individual GET requests...\n");
    for (const id of contactIds) {
      const cr = await hs(`/crm/v3/objects/contacts/${id}?properties=email,firstname,lastname,phone,city,destination__c,hs_lead_status,createdate`);
      if (cr?.id) { byId[cr.id] = cr; contacts.push(cr); }
      else console.log(`  ❌  GET /contacts/${id} → ${JSON.stringify(cr).slice(0, 120)}`);
      await new Promise(r => setTimeout(r, 80));
    }
    console.log(`\nAfter individual GETs: ${contacts.length} contacts found\n`);
  } else {
    console.log(`Fetched ${contacts.length} contacts from HubSpot\n`);
  }

  // 3. Fill each stub
  let filled = 0, errors = 0;
  for (const stub of stubs) {
    const hsId = stub.id.replace("hs_", "");
    const c = byId[hsId];
    if (!c) {
      console.log(`  ⚠️  ${stub.id} — contact not found in HubSpot`);
      continue;
    }
    const p = c.properties || {};
    const firstName = (p.firstname || "").trim();
    const lastName = (p.lastname || "").trim();
    const guestName = [firstName, lastName].filter(Boolean).join(" ") || "";
    const email = (p.email || "").trim().toLowerCase();
    const city = (p.destination__c || p.city || "cdmx").toLowerCase();

    const filled_data = {
      ...(stub.data || {}),
      guestName,
      guestEmail: email,
      guestContact: p.phone || "",
      city,
      status: "new",
      clientType: 1,
      tripName: stub.data?.tripName || "",
      conciergeSummary: stub.data?.conciergeSummary || "",
      internalNotes: stub.data?.internalNotes || "",
      cart: stub.data?.cart || [],
      createdAt: stub.data?.createdAt || p.createdate || new Date().toISOString(),
    };
    delete filled_data.creating; // remove old status if present

    if (DRY_RUN) {
      console.log(`  ✅  would fill: ${stub.id} → ${guestName} <${email}> (${city})`);
      filled++;
      continue;
    }

    const { error } = await sb.from("kickoffs").update({ data: filled_data }).eq("id", stub.id);
    if (error) {
      console.error(`  ❌  ${stub.id}:`, error.message);
      errors++;
    } else {
      console.log(`  ✅  filled: ${stub.id} → ${guestName} <${email}> (${city})`);
      filled++;
    }
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n✅  Done — filled: ${filled}, errors: ${errors}`);
  if (DRY_RUN) console.log("   (dry run — nothing was written)");
}

main();
