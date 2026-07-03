// HubSpot webhook — fires when a deal moves to "Introduction made by sales team"
// Creates a kickoff in the portal with the deal's info

const GAS_URL = process.env.VITE_TASK_API_URL || process.env.GAS_URL
  || "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

// Map HubSpot property names → our briefing fields
// Update these with the real internal property names from HubSpot
const PROP_MAP = {
  house:       ["has_house", "tiene_casa", "house_status", "accommodation_status"],
  boat:        ["has_boat", "tiene_bote", "boat_status", "boat_rental"],
  budget:      ["budget", "tier", "client_tier", "deal_budget", "amount"],
  dietary:     ["dietary_restrictions", "food_restrictions", "restricciones_alimentarias"],
  purpose:     ["trip_purpose", "motivo_viaje", "occasion", "trip_occasion"],
  pax:         ["number_of_guests", "num_guests", "pax", "guest_count", "num_travelers"],
  destination: ["destination", "destino", "city", "ciudad"],
  notes:       ["hs_note_body", "description", "notas", "notes"],
};

function pickProp(props, candidates) {
  for (const key of candidates) {
    const val = props[key]?.value;
    if (val && val !== "" && val !== "null") return val;
  }
  return "";
}

async function fetchDeal(dealId, token) {
  const props = [
    "dealname", "closedate", "amount", "description",
    "hs_note_body", "destination", "destino", "city",
    "has_house", "tiene_casa", "house_status", "accommodation_status",
    "has_boat", "tiene_bote", "boat_status", "boat_rental",
    "budget", "tier", "client_tier", "deal_budget",
    "dietary_restrictions", "food_restrictions", "restricciones_alimentarias",
    "trip_purpose", "motivo_viaje", "occasion",
    "number_of_guests", "num_guests", "pax", "guest_count",
    "hubspot_owner_id", "notes_last_updated",
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) return res.status(500).json({ error: "Missing HUBSPOT_PRIVATE_APP_TOKEN" });

  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];

    for (const event of events) {
      // Only handle deal stage changes
      if (event.subscriptionType !== "deal.propertyChange") continue;
      if (event.propertyName !== "dealstage") continue;

      const dealId = event.objectId;
      const deal = await fetchDeal(dealId, token);
      const props = deal.properties || {};

      const dealName    = props.dealname || "Sin nombre";
      const destination = pickProp(props, PROP_MAP.destination) || "";
      const pax         = pickProp(props, PROP_MAP.pax) || "";
      const house       = pickProp(props, PROP_MAP.house) || "";
      const boat        = pickProp(props, PROP_MAP.boat) || "";
      const budget      = pickProp(props, PROP_MAP.budget) || "";
      const dietary     = pickProp(props, PROP_MAP.dietary) || "";
      const purpose     = pickProp(props, PROP_MAP.purpose) || "";
      const notes       = pickProp(props, PROP_MAP.notes) || "";

      // Get associated contact
      let guestName = "", guestEmail = "", guestContact = "";
      const contactAssocs = deal.associations?.contacts?.results || [];
      if (contactAssocs.length) {
        const contact = await fetchContact(contactAssocs[0].id, token);
        const cp = contact.properties || {};
        guestName    = [cp.firstname, cp.lastname].filter(Boolean).join(" ");
        guestEmail   = cp.email || "";
        guestContact = cp.mobilephone || cp.phone || "";
      }

      // Build briefing note
      const briefingParts = [];
      if (house)    briefingParts.push(`Casa: ${house}`);
      if (boat)     briefingParts.push(`Bote: ${boat}`);
      if (budget)   briefingParts.push(`Budget/Tier: ${budget}`);
      if (dietary)  briefingParts.push(`Restricciones: ${dietary}`);
      if (purpose)  briefingParts.push(`Motivo: ${purpose}`);
      if (pax)      briefingParts.push(`Pax: ${pax}`);
      if (notes)    briefingParts.push(`Notas ventas: ${notes}`);

      const hubspotDealUrl = `https://app.hubspot.com/contacts/deals/${dealId}`;

      // Create kickoff in portal
      await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({
          action: "saveKickoff",
          payload: {
            guestName:    guestName || dealName,
            tripName:     dealName,
            status:       "active",
            destination,
            guestCount:   pax,
            guestEmail,
            guestContact,
            briefHasHouse:  house,
            briefHasBoat:   boat,
            briefBudget:    budget,
            briefDietary:   dietary,
            briefPurpose:   purpose,
            briefNotes:     notes,
            internalNotes:  briefingParts.join("\n") + `\n\nHubSpot: ${hubspotDealUrl}`,
            createdAt:    new Date().toISOString(),
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
