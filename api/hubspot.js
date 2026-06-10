// api/hubspot.js — HubSpot CRM integration for Two Travel Sales Agent
// Vercel serverless function
// Actions: upsert_contact, upsert_deal, get_contacts, log_note

const HUBSPOT_BASE = "https://api.hubapi.com";

async function hubspotRequest(path, method = "GET", body = null, token) {
  const opts = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${HUBSPOT_BASE}${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// Find contact by email
async function findContactByEmail(email, token) {
  const r = await hubspotRequest(
    `/crm/v3/objects/contacts/search`,
    "POST",
    { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], properties: ["email","firstname","lastname","phone","hs_lead_status"] },
    token
  );
  return r.data?.results?.[0] || null;
}

// Find deal by name (custom search)
async function findDealByName(dealName, token) {
  const r = await hubspotRequest(
    `/crm/v3/objects/deals/search`,
    "POST",
    { filterGroups: [{ filters: [{ propertyName: "dealname", operator: "EQ", value: dealName }] }], properties: ["dealname","dealstage","amount","closedate"] },
    token
  );
  return r.data?.results?.[0] || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.HUBSPOT_API_KEY;
  if (!token) {
    return res.status(503).json({ error: "HUBSPOT_API_KEY not configured", demo: true });
  }

  const { action, data } = req.body;

  try {
    // ── UPSERT CONTACT ─────────────────────────────────────────
    if (action === "upsert_contact") {
      const { email, firstName, lastName, phone, status, destination, agent, notes } = data;
      if (!email) return res.status(400).json({ error: "email required" });

      const props = {
        email,
        firstname: firstName || "",
        lastname: lastName || "",
        phone: phone || "",
        hs_lead_status: status || "NEW",           // NEW / IN_PROGRESS / OPEN / UNQUALIFIED / CONNECTED
        // Custom Two Travel properties (must exist in HubSpot first)
        ...(destination && { destination__c: destination }),
        ...(agent && { assigned_agent__c: agent }),
        ...(notes && { two_travel_notes__c: notes }),
      };

      const existing = await findContactByEmail(email, token);
      let result;

      if (existing) {
        result = await hubspotRequest(`/crm/v3/objects/contacts/${existing.id}`, "PATCH", { properties: props }, token);
        return res.status(200).json({ action: "updated", contactId: existing.id, ...result.data });
      } else {
        result = await hubspotRequest(`/crm/v3/objects/contacts`, "POST", { properties: props }, token);
        return res.status(200).json({ action: "created", contactId: result.data?.id, ...result.data });
      }
    }

    // ── UPSERT DEAL ────────────────────────────────────────────
    if (action === "upsert_deal") {
      const { dealName, stage, amount, closeDate, contactId, agentName, destination } = data;
      if (!dealName) return res.status(400).json({ error: "dealName required" });

      // HubSpot deal stages (customize to match your pipeline):
      // appointmentscheduled → qualifiedtobuy → presentationscheduled → decisionmakerboughtin → contractsent → closedwon → closedlost
      const stageMap = {
        "hot": "qualifiedtobuy",
        "warm": "appointmentscheduled",
        "cold": "appointmentscheduled",
        "won": "closedwon",
        "lost": "closedlost",
      };

      const props = {
        dealname: dealName,
        dealstage: stageMap[stage] || "appointmentscheduled",
        pipeline: "default",
        ...(amount && { amount: String(amount) }),
        ...(closeDate && { closedate: new Date(closeDate).toISOString() }),
        ...(destination && { description: `Destination: ${destination}` }),
      };

      const existing = await findDealByName(dealName, token);
      let dealId;

      if (existing) {
        await hubspotRequest(`/crm/v3/objects/deals/${existing.id}`, "PATCH", { properties: props }, token);
        dealId = existing.id;
      } else {
        const r = await hubspotRequest(`/crm/v3/objects/deals`, "POST", { properties: props }, token);
        dealId = r.data?.id;
      }

      // Associate deal with contact if contactId provided
      if (dealId && contactId) {
        await hubspotRequest(
          `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/deal_to_contact`,
          "PUT", {}, token
        );
      }

      return res.status(200).json({ action: existing ? "updated" : "created", dealId });
    }

    // ── LOG NOTE ───────────────────────────────────────────────
    if (action === "log_note") {
      const { contactId, dealId, noteText, timestamp } = data;
      if (!noteText) return res.status(400).json({ error: "noteText required" });

      const noteProps = {
        hs_note_body: noteText,
        hs_timestamp: timestamp || new Date().toISOString(),
      };

      const r = await hubspotRequest(`/crm/v3/objects/notes`, "POST", { properties: noteProps }, token);
      const noteId = r.data?.id;

      // Associate note with contact
      if (noteId && contactId) {
        await hubspotRequest(
          `/crm/v3/objects/notes/${noteId}/associations/contacts/${contactId}/note_to_contact`,
          "PUT", {}, token
        );
      }
      // Associate note with deal
      if (noteId && dealId) {
        await hubspotRequest(
          `/crm/v3/objects/notes/${noteId}/associations/deals/${dealId}/note_to_deal`,
          "PUT", {}, token
        );
      }

      return res.status(200).json({ action: "note_created", noteId });
    }

    // ── GET PIPELINE STAGES ────────────────────────────────────
    if (action === "get_pipeline_stages") {
      const r = await hubspotRequest("/crm/v3/pipelines/deals", "GET", null, token);
      const pipelines = r.data?.results || [];
      // Flatten all stages from all pipelines into a single id→label map
      const stageMap = {};
      pipelines.forEach(pipeline => {
        (pipeline.stages || []).forEach(stage => {
          stageMap[stage.id] = stage.label;
        });
      });
      return res.status(200).json({ stageMap, pipelines });
    }

    // ── GET DEALS filtered by owner name ──────────────────────
    if (action === "get_contacts") {
      const { limit = 100, agentName } = data || {};

      // Step 1: resolve agent name → HubSpot owner ID
      // Uses env vars: HUBSPOT_OWNER_<NAME> (e.g. HUBSPOT_OWNER_RAY=79812500)
      // Known owner IDs from deal data (set these in Vercel env):
      //   76548535 → CDMX agent
      //   78072909 → CTG villas agent
      //   78072910 → Weddings agent
      //   79812500 → CTG concierge/boats agent
      //   79812504 → mixed pipeline
      //   91934290 → single deal
      let ownerIdFilter = null;
      if (agentName) {
        const nameKey = agentName.toUpperCase().replace(/\s+/g, "_");
        // Check env var: HUBSPOT_OWNER_RAY, HUBSPOT_OWNER_ROSS, HUBSPOT_OWNER_MARIA, etc.
        const fromEnv = process.env[`HUBSPOT_OWNER_${nameKey}`];
        if (fromEnv) {
          ownerIdFilter = fromEnv;
          console.log(`[HubSpot] Agent "${agentName}" → owner ID from env: ${ownerIdFilter}`);
        } else {
          // Fallback: build a map from all HUBSPOT_OWNER_* env vars and do fuzzy match
          const ownerMap = {};
          for (const [key, val] of Object.entries(process.env)) {
            if (key.startsWith("HUBSPOT_OWNER_") && val) {
              const agentKey = key.replace("HUBSPOT_OWNER_", "").toLowerCase();
              ownerMap[agentKey] = val;
            }
          }
          const nameLower = agentName.toLowerCase();
          const fuzzyKey = Object.keys(ownerMap).find(k => k.includes(nameLower) || nameLower.includes(k));
          if (fuzzyKey) {
            ownerIdFilter = ownerMap[fuzzyKey];
            console.log(`[HubSpot] Agent "${agentName}" fuzzy-matched "${fuzzyKey}" → ${ownerIdFilter}`);
          } else {
            console.log(`[HubSpot] No owner env var for "${agentName}". Set HUBSPOT_OWNER_${nameKey}=<id> in Vercel. Known IDs: 76548535(CDMX), 78072909(CTG-villas), 78072910(weddings), 79812500(CTG-boats), 79812504, 91934290`);
          }
        }
      }

      // Step 2: fetch deals, optionally filtered by owner
      // Strategy: fetch active deals first (non-closed stages), then closed deals to fill remaining slots
      const ownerIds = ownerIdFilter ? ownerIdFilter.split(",").map(s => s.trim()).filter(Boolean) : [];

      // Known closed stage IDs across all Two Travel pipelines
      const CLOSED_STAGE_IDS = [
        "closedwon","closedlost",
        "1036315967","1036315968",      // Closed WON / LOST (main pipeline)
        "1078513049",                    // Trip Completed - Request Google Review
        "1064536622",                    // Check-In Complete
        "1084922965",                    // Boat Sold
        "1078536820",                    // Wedding Complete
        "1081725980","1081725981","1081725982", // Closed WON BOAT/CONCIERGE/CHECK-IN
        "1081740661","1081740662","1081740663","1081740664", // Closed WON/LOST (CTG pipelines)
        "1262769731",                    // Closed Won (CDMX pipeline)
      ];

      const ownerFilter = ownerIds.length > 0
        ? [{ propertyName: "hubspot_owner_id", operator: "IN", values: ownerIds }]
        : [];

      const PROPS = ["dealname","dealstage","amount","closedate","description","hs_next_step","hubspot_owner_id","notes_last_contacted","createdate","lastmodifieddate","num_associated_contacts"];

      // Helper: fetch ALL pages from HubSpot search (handles 100-per-page limit)
      async function fetchAllDeals(filters, sorts) {
        const all = [];
        let after = undefined;
        let pages = 0;
        while (pages < 20) { // safety cap: max 2000 deals
          const body = {
            limit: 100,
            properties: PROPS,
            sorts,
            filterGroups: [{ filters }],
            ...(after ? { after } : {}),
          };
          const res = await hubspotRequest("/crm/v3/objects/deals/search", "POST", body, token);
          const results = res.data?.results || [];
          all.push(...results);
          const nextAfter = res.data?.paging?.next?.after;
          if (!nextAfter || results.length < 100) break;
          after = nextAfter;
          pages++;
        }
        return all;
      }

      // Pass 1: ALL active deals (paginated)
      const activeDeals = await fetchAllDeals(
        [...ownerFilter, { propertyName: "dealstage", operator: "NOT_IN", values: CLOSED_STAGE_IDS }],
        [{ propertyName: "closedate", direction: "DESCENDING" }]
      );

      // Pass 2: recent closed deals (last 50)
      const closedRes = await hubspotRequest("/crm/v3/objects/deals/search", "POST", {
        limit: 50,
        properties: PROPS,
        sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
        filterGroups: [{ filters: [...ownerFilter, { propertyName: "dealstage", operator: "IN", values: CLOSED_STAGE_IDS }] }],
      }, token);
      const closedDeals = closedRes.data?.results || [];

      const deals = [...activeDeals, ...closedDeals];
      console.log(`[HubSpot] Active deals: ${activeDeals.length}, Closed deals: ${closedDeals.length}, Total: ${deals.length}`);

      // Step 3: batch-fetch associated contacts to get phone/email
      let contactByDealId = {};
      if (deals.length > 0) {
        try {
          const assocRes = await hubspotRequest(
            "/crm/v3/associations/deal/contact/batch/read",
            "POST",
            { inputs: deals.map(d => ({ id: d.id })) },
            token
          );
          const assocResults = assocRes.data?.results || [];
          const contactIds = [...new Set(assocResults.flatMap(a => (a.to || []).map(t => t.id)))];

          if (contactIds.length > 0) {
            const contactRes = await hubspotRequest(
              "/crm/v3/objects/contacts/batch/read",
              "POST",
              {
                inputs: contactIds.map(id => ({ id })),
                properties: ["email", "firstname", "lastname", "phone", "mobilephone"],
              },
              token
            );
            const contactMap = {};
            (contactRes.data?.results || []).forEach(c => { contactMap[c.id] = c; });

            assocResults.forEach(a => {
              const firstContactId = a.to?.[0]?.id;
              if (firstContactId && contactMap[firstContactId]) {
                contactByDealId[a.from.id] = contactMap[firstContactId];
              }
            });
          }
        } catch (assocErr) {
          console.warn("[HubSpot] Association fetch failed (non-fatal):", assocErr.message);
        }
      }

      // Merge contact data into each deal
      const enriched = deals.map(deal => {
        const contact = contactByDealId[deal.id];
        if (contact) {
          const cp = contact.properties || {};
          deal._contact = {
            id: contact.id,
            phone: cp.mobilephone || cp.phone || "",
            email: cp.email || "",
            fullName: [cp.firstname, cp.lastname].filter(Boolean).join(" "),
          };
        }
        return deal;
      });

      return res.status(200).json({ contacts: enriched, ownerFound: ownerIds.length > 0 });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });

  } catch (err) {
    console.error("HubSpot handler error:", err);
    return res.status(500).json({ error: "Internal error", message: err.message });
  }
}
