// HubSpot webhook — two behaviors:
// 1. deal.creation → WhatsApp notification to deal owner
// 2. deal.propertyChange (dealstage → TARGET_STAGE_ID) → create kickoff in portal

import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const GAS_URL = process.env.VITE_TASK_API_URL || process.env.GAS_URL
  || "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

// Only create kickoff when deal enters this stage
const TARGET_STAGE_ID = "1078723461"; // Introduction Made By Sales Team (Concierge Clients)

// HubSpot owner email → WhatsApp number
const OWNER_WA_MAP = {
  "ray@two.travel": "+573204742249",
};

// HubSpot real property internal names
const PROP_MAP = {
  destination: ["city_tt"],
  pax:         ["number_of_people_in_the_reservation", "number_of_guests_villa_b"],
  budget:      ["budget"],
  concierge:   ["head_concierge"],
  notes:       ["description", "hs_cross_account_note"],
  arrivalDate: ["arrival_date"],
  departureDate: ["departure_date"],
  boatType:    ["boat_type"],
};

function pickProp(props, candidates) {
  for (const key of candidates) {
    const val = props[key];
    if (val && val !== "" && val !== "null") return val;
  }
  return "";
}

async function fetchDeal(dealId, token) {
  const props = [
    "dealname", "budget", "description", "hs_cross_account_note",
    "city_tt", "number_of_people_in_the_reservation", "number_of_guests_villa_b",
    "head_concierge", "arrival_date", "departure_date", "boat_type",
    "new_invoice_process___concierge", "hubspot_owner_id",
  ].join(",");

  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=${props}&associations=contacts`,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return res.json();
}

async function fetchContact(contactId, token) {
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,phone,mobilephone`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.json();
}

async function fetchOwnerEmail(ownerId, token) {
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/owners/${ownerId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return (data.email || "").toLowerCase();
}

async function sendWhatsApp(to, message) {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken  = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromNumber = (process.env.TWILIO_WA_NUMBER || '').trim();
  if (!accountSid || !authToken || !fromNumber) {
    console.warn("Twilio credentials not configured — skipping WhatsApp notification");
    return;
  }

  const phone  = to.replace(/\D/g, '');
  const toWa   = `whatsapp:+${phone}`;
  const fromWa = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

  const params = new URLSearchParams({ From: fromWa, To: toWa, Body: message });
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const r = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );
  const data = await r.json();
  if (!data.sid) console.error("Twilio error:", data.message || JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) return res.status(500).json({ error: "Missing HUBSPOT_PRIVATE_APP_TOKEN" });

  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      const dealId = event.objectId;

      // 1. New deal created → WhatsApp notification to deal owner
      if (event.subscriptionType === "deal.creation") {
        const deal = await fetchDeal(dealId, token);
        const props = deal.properties || {};

        const dealName = props.dealname || "New lead";
        const ownerId  = props.hubspot_owner_id;

        let guestName = "", guestPhone = "";
        const contactAssocs = deal.associations?.contacts?.results || [];
        if (contactAssocs.length) {
          const contact = await fetchContact(contactAssocs[0].id, token);
          const cp = contact.properties || {};
          guestName  = [cp.firstname, cp.lastname].filter(Boolean).join(" ");
          guestPhone = cp.phone || cp.mobilephone || "";
        }
        if (!guestName) guestName = dealName.split(",")[0].trim();

        if (ownerId) {
          const ownerEmail = await fetchOwnerEmail(ownerId, token);
          const ownerWa    = OWNER_WA_MAP[ownerEmail];

          if (ownerWa && guestPhone) {
            const cleanPhone = guestPhone.replace(/\D/g, '');
            const preText    = encodeURIComponent(`Hi ${guestName}, this is Ray from Two Travel. I saw you reached out — happy to connect. When's a good time to talk?`);
            const waLink     = `https://wa.me/${cleanPhone}?text=${preText}`;
            const dealUrl    = `https://app.hubspot.com/contacts/deals/${dealId}`;

            const message = [
              `New lead — ${guestName}`,
              guestPhone,
              ``,
              `Message them: ${waLink}`,
              `Deal: ${dealUrl}`,
            ].join("\n");

            await sendWhatsApp(ownerWa, message);
          }
        }
        continue;
      }

      // 2. Deal stage change → create kickoff
      if (event.subscriptionType !== "deal.propertyChange") continue;
      if (event.propertyName !== "dealstage") continue;
      if (event.propertyValue !== TARGET_STAGE_ID) continue;

      // Idempotency: reserve a sentinel row before creating the kickoff.
      // HubSpot sometimes fires this webhook multiple times for the same event.
      const sentinelId = `hs_${dealId}`;
      const { error: insertErr } = await supabase
        .from("kickoffs")
        .insert({ id: sentinelId, data: { hubspotDealId: String(dealId), status: "creating", createdAt: new Date().toISOString() } });
      if (insertErr) {
        const isDuplicate = insertErr.code === "23505" || /duplicate|unique/i.test(insertErr.message || "");
        if (isDuplicate) {
          console.log(`Skipping duplicate kickoff for deal ${dealId} — sentinel exists`);
          continue;
        }
        // Other error (permissions, schema) — log but still proceed to create the kickoff
        console.error(`Sentinel insert failed for deal ${dealId} (non-duplicate): code=${insertErr.code} msg=${insertErr.message} — proceeding anyway`);
      }

      const deal = await fetchDeal(dealId, token);
      const props = deal.properties || {};

      const dealName    = props.dealname || "Sin nombre";
      const destination = pickProp(props, PROP_MAP.destination);
      const pax         = pickProp(props, PROP_MAP.pax);
      const budget      = pickProp(props, PROP_MAP.budget);
      const concierge   = pickProp(props, PROP_MAP.concierge);
      const notes       = pickProp(props, PROP_MAP.notes);
      const arrivalDate = pickProp(props, PROP_MAP.arrivalDate);
      const departureDate = pickProp(props, PROP_MAP.departureDate);
      const boatType    = pickProp(props, PROP_MAP.boatType);

      // Get associated contact — contact name is the real client name
      let guestName = "", guestEmail = "", guestContact = "";
      const contactAssocs = deal.associations?.contacts?.results || [];
      if (contactAssocs.length) {
        const contact = await fetchContact(contactAssocs[0].id, token);
        const cp = contact.properties || {};
        guestName    = [cp.firstname, cp.lastname].filter(Boolean).join(" ");
        guestEmail   = cp.email || "";
        guestContact = cp.phone || cp.mobilephone || "";
      }
      // Fallback: deal name often is "Client Name, City, Date" — take only what's before the first comma
      if (!guestName) guestName = dealName.split(",")[0].trim();

      const hubspotDealUrl = `https://app.hubspot.com/contacts/deals/${dealId}`;

      // Build briefing summary for internal notes
      const briefingParts = [];
      if (budget)      briefingParts.push(`Budget/Tier: ${budget}`);
      if (pax)         briefingParts.push(`Pax: ${pax}`);
      if (boatType)    briefingParts.push(`Bote: ${boatType}`);
      if (arrivalDate) briefingParts.push(`Llegada: ${arrivalDate}`);
      if (departureDate) briefingParts.push(`Salida: ${departureDate}`);
      if (notes)       briefingParts.push(`Notas ventas: ${notes}`);
      briefingParts.push(`HubSpot: ${hubspotDealUrl}`);

      // Create kickoff in portal
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "saveKickoff",
          payload: {
            guestName:          guestName || dealName,
            tripName:           dealName,
            status:             "active",
            destination,
            city:               destination,
            guestCount:         pax,
            groupSize:          pax,
            guestEmail,
            guestContact,
            assignedConcierge:  concierge,
            briefBudget:        budget,
            briefHasBoat:       boatType ? "Sí" : "",
            briefNotes:         notes,
            arrivalDate,
            departureDate,
            internalNotes:      "",
            hubspotDealId:      String(dealId),
            createdAt:          new Date().toISOString(),
          },
        }),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("HubSpot webhook error:", err);
    res.status(500).json({ error: err.message });
  }
}
