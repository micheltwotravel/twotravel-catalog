#!/usr/bin/env node
// scripts/hubspot_to_kickoffs.js
// Pull HubSpot contacts (Mexico + Colombia) that don't exist as kickoffs in Supabase
// and create those kickoffs.
//
// Usage:
//   node --env-file=.env.production.local scripts/hubspot_to_kickoffs.js --dry-run
//   node --env-file=.env.production.local scripts/hubspot_to_kickoffs.js

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const HUBSPOT_BASE = "https://api.hubapi.com";
const token = process.env.HUBSPOT_API_KEY;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

if (!token) { console.error("❌  HUBSPOT_API_KEY not set"); process.exit(1); }
if (!process.env.VITE_SUPABASE_URL) { console.error("❌  VITE_SUPABASE_URL not set"); process.exit(1); }

async function hs(path, method = "GET", body = null) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${HUBSPOT_BASE}${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// Fetch contacts from HubSpot deals in Mexico + Colombia pipelines
// Mexico pipelines: 730668588 (Client Check-Ins Mexico), 847948885 (Logistics - Sales)
// Colombia (B2C Sales, default pipeline): stage "Closed WON CONCIERGE" (1081725981)
async function fetchMexicoDealContacts() {
  const MEXICO_PIPELINES    = ["730668588", "847948885"]; // Client Check-Ins MX + Logistics-Sales
  const CONCIERGE_WON_STAGE = "1081725981";               // B2C Sales "Closed WON CONCIERGE"
  const contactIds = new Set();
  const dealIds = [];

  // ── Mexico: fetch by pipeline ID (any stage) ────────────────────────────────
  for (const pipeline of MEXICO_PIPELINES) {
    let after = undefined;
    while (true) {
      const body = {
        limit: 100,
        properties: ["dealname", "pipeline", "dealstage"],
        filterGroups: [{ filters: [{ propertyName: "pipeline", operator: "EQ", value: pipeline }] }],
        ...(after ? { after } : {}),
      };
      const r = await hs("/crm/v3/objects/deals/search", "POST", body);
      const results = r.data?.results || [];
      dealIds.push(...results.map(d => d.id));
      const next = r.data?.paging?.next?.after;
      if (!next || results.length < 100) break;
      after = next;
      await new Promise(r => setTimeout(r, 120));
    }
  }
  console.log(`   Mexico pipelines → ${dealIds.length} deals`);

  // ── Colombia: fetch by "Closed WON CONCIERGE" stage (B2C Sales pipeline) ───
  // Not filtered by keywords — Colombia deals don't have city names in descriptions.
  const colStart = dealIds.length;
  let afterC = undefined;
  while (true) {
    const body = {
      limit: 100,
      properties: ["dealname", "pipeline", "dealstage"],
      filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: CONCIERGE_WON_STAGE }] }],
      ...(afterC ? { after: afterC } : {}),
    };
    const r = await hs("/crm/v3/objects/deals/search", "POST", body);
    const results = r.data?.results || [];
    // Exclude deals already captured via Mexico pipelines
    const mxSet = new Set(dealIds);
    results.filter(d => !mxSet.has(d.id)).forEach(d => dealIds.push(d.id));
    const next = r.data?.paging?.next?.after;
    if (!next || results.length < 100) break;
    afterC = next;
    await new Promise(r => setTimeout(r, 120));
  }
  console.log(`   Colombia/B2C Won stage → ${dealIds.length - colStart} additional deals`);
  console.log(`   Total: ${dealIds.length} deals (Mexico + Colombia)`);
  if (dealIds.length === 0) return [];

  // Get contacts associated with those deals (batch of 100)
  for (let i = 0; i < dealIds.length; i += 100) {
    const batch = dealIds.slice(i, i + 100);
    const assocRes = await hs("/crm/v3/associations/deal/contact/batch/read", "POST", {
      inputs: batch.map(id => ({ id })),
    });
    (assocRes.data?.results || []).forEach(a => (a.to || []).forEach(t => contactIds.add(t.id)));
    await new Promise(r => setTimeout(r, 120));
  }

  if (contactIds.size === 0) return [];

  // Batch-fetch those contacts
  const ids = [...contactIds];
  const contacts = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const r = await hs("/crm/v3/objects/contacts/batch/read", "POST", {
      inputs: batch.map(id => ({ id })),
      properties: ["email", "firstname", "lastname", "phone", "city", "destination__c", "hs_lead_status", "createdate"],
    });
    contacts.push(...(r.data?.results || []));
    await new Promise(r => setTimeout(r, 120));
  }
  return contacts;
}

async function main() {
  console.log(`\n🚀  HubSpot → Kickoffs backfill ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

  // 1. Fetch existing kickoff emails from Supabase
  const { data: kickoffs, error: kErr } = await supabase.from("kickoffs").select("id, data");
  if (kErr) { console.error("❌  Supabase error:", kErr.message); process.exit(1); }

  const existingEmails = new Set(
    kickoffs
      .map(k => (k.data?.guestEmail || k.data?.email || "").trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
  );
  console.log(`📋  ${kickoffs.length} kickoffs in Supabase (${existingEmails.size} with valid email)\n`);

  // 2. Fetch Mexico contacts from HubSpot (by pipeline)
  console.log("🔍  Fetching Mexico contacts from HubSpot...");
  const byDeal = await fetchMexicoDealContacts();

  // Deduplicate by HubSpot contact id
  const allById = new Map();
  byDeal.forEach(c => allById.set(c.id, c));
  const allContacts = [...allById.values()];
  console.log(`   Found ${allContacts.length} Mexico contacts in HubSpot\n`);

  // 3. Filter to those not in Supabase
  const missing = allContacts.filter(c => {
    const email = (c.properties?.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
    return !existingEmails.has(email);
  });

  console.log(`   ${missing.length} contacts NOT in Supabase → will create kickoffs\n`);

  if (missing.length === 0) {
    console.log("✅  Nothing to create — all CDMX contacts already have kickoffs.");
    return;
  }

  // 4. Create kickoffs
  let created = 0, errors = 0;

  for (const c of missing) {
    const p = c.properties || {};
    const email = (p.email || "").trim().toLowerCase();
    const firstName = (p.firstname || "").trim();
    const lastName = (p.lastname || "").trim();
    const guestName = [firstName, lastName].filter(Boolean).join(" ") || email;
    const rawCity = (p.destination__c || p.city || "").toLowerCase();
    const dest = rawCity || "cdmx";

    const kickoffId = `ko_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const data = {
      guestName,
      guestEmail: email,
      guestContact: p.phone || "",
      city: dest || "cdmx",
      status: "new",
      clientType: 1,
      tripName: "",
      conciergeSummary: "",
      internalNotes: "",
      cart: [],
      createdAt: p.createdate || new Date().toISOString(),
      source: "hubspot_backfill",
    };

    if (DRY_RUN) {
      console.log(`  ✅  would_create: ${guestName} <${email}> (${dest})`);
      created++;
      continue;
    }

    const { error } = await supabase.from("kickoffs").insert({ id: kickoffId, data });
    if (error) {
      console.error(`  ❌  Error creating kickoff for ${email}:`, error.message);
      errors++;
    } else {
      console.log(`  ✅  created: ${guestName} <${email}> (${dest})`);
      created++;
    }
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n✅  Done — created: ${created}, errors: ${errors}`);
  if (DRY_RUN) console.log("   (dry run — nothing was written to Supabase)");
}

main();
