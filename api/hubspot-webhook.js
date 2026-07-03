// HubSpot webhook — fires when a deal moves to "Introduction made by sales team"
// Creates a kickoff in the portal with the deal's info

const GAS_URL = process.env.VITE_TASK_API_URL || process.env.GAS_URL
  || "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

// Only create kickoff when deal enters this stage
const TARGET_STAGE_ID = "1078723461"; // Introduction Made By Sales Team (Concierge Clients)

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
    "new_invoice_process___concierge",
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
      // Only handle deal stage changes to our target stage
      if (event.subscriptionType !== "deal.propertyChange") continue;
      if (event.propertyName !== "dealstage") continue;
      if (event.propertyValue !== TARGET_STAGE_ID) continue;

      const dealId = event.objectId;
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

      // Get associated contact
      let guestName = "", guestEmail = "", guestContact = "";
      const contactAssocs = deal.associations?.contacts?.results || [];
      if (contactAssocs.length) {
        const contact = await fetchContact(contactAssocs[0].id, token);
        const cp = contact.properties || {};
        guestName    = [cp.firstname, cp.lastname].filter(Boolean).join(" ");
        guestEmail   = cp.email || "";
        guestContact = cp.phone || cp.mobilephone || "";
      }

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
            guestCount:         pax,
            guestEmail,
            guestContact,
            assignedConcierge:  concierge,
            briefBudget:        budget,
            briefHasBoat:       boatType ? "Sí" : "",
            briefNotes:         notes,
            arrivalDate,
            departureDate,
            internalNotes:      briefingParts.join("\n"),
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
