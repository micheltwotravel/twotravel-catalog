#!/usr/bin/env node
// scripts/hubspot_backfill.js
// One-time backfill: sync existing kickoffs → HubSpot contacts
// Usage: node scripts/hubspot_backfill.js [--dry-run] [--limit 50]
//
// Requires env vars (copy from .env or Vercel):
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)
//   HUBSPOT_API_KEY

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const limitIdx = process.argv.indexOf("--limit");
const LIMIT = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : null;

const HUBSPOT_BASE = "https://api.hubapi.com";
const token = process.env.HUBSPOT_API_KEY;
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

if (!token) { console.error("❌  HUBSPOT_API_KEY not set"); process.exit(1); }
if (!process.env.VITE_SUPABASE_URL) { console.error("❌  VITE_SUPABASE_URL not set"); process.exit(1); }

async function hubspotRequest(path, method = "GET", body = null) {
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

async function findContactByEmail(email) {
  const r = await hubspotRequest(
    `/crm/v3/objects/contacts/search`, "POST",
    { filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }], properties: ["email"] }
  );
  return r.data?.results?.[0] || null;
}

async function upsertContact(kickoff) {
  const d = kickoff.data || {};
  const email = (d.guestEmail || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { skip: "invalid_email" };

  const nameParts = (d.guestName || "").trim().split(/\s+/);
  const props = {
    email,
    firstname: nameParts[0] || "",
    lastname: nameParts.slice(1).join(" ") || "",
    phone: d.guestContact || "",
    hs_lead_status: d.status === "active" ? "IN_PROGRESS" : "NEW",
    ...(d.city && { destination__c: d.city }),
  };

  const existing = await findContactByEmail(email);
  if (existing) {
    if (DRY_RUN) return { action: "would_update", contactId: existing.id, email };
    const r = await hubspotRequest(`/crm/v3/objects/contacts/${existing.id}`, "PATCH", { properties: props });
    return { action: "updated", contactId: existing.id, email, ok: r.ok };
  } else {
    if (DRY_RUN) return { action: "would_create", email };
    const r = await hubspotRequest(`/crm/v3/objects/contacts`, "POST", { properties: props });
    return { action: "created", contactId: r.data?.id, email, ok: r.ok };
  }
}

async function main() {
  console.log(`\n🚀  HubSpot backfill ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

  // Fetch all kickoffs that have an email
  let query = supabase
    .from("kickoffs")
    .select("id, data")
    .order("id", { ascending: false });

  if (LIMIT) query = query.limit(LIMIT);

  const { data: kickoffs, error } = await query;
  if (error) { console.error("❌  Supabase error:", error.message); process.exit(1); }

  // Filter to those with an email (data is a JSONB column)
  const withEmail = kickoffs.filter(k => (k.data?.guestEmail || "").trim());
  const noEmail   = kickoffs.length - withEmail.length;

  console.log(`📋  ${kickoffs.length} kickoffs total — ${withEmail.length} with email, ${noEmail} skipped (no email)\n`);

  let created = 0, updated = 0, skipped = 0, errors = 0;

  for (const k of withEmail) {
    try {
      const result = await upsertContact(k);
      const label = result.email || k.id;
      if (result.skip) {
        skipped++;
      } else if (result.action?.includes("create")) {
        created++;
        console.log(`  ✅  ${result.action}: ${label}`);
      } else if (result.action?.includes("update")) {
        updated++;
        console.log(`  🔄  ${result.action}: ${label}`);
      }
      // Rate limit: HubSpot allows ~10 req/s
      await new Promise(r => setTimeout(r, 120));
    } catch (err) {
      errors++;
      console.error(`  ❌  Error on ${k.id}:`, err.message);
    }
  }

  console.log(`\n✅  Done — created: ${created}, updated: ${updated}, skipped: ${skipped}, errors: ${errors}`);
  if (DRY_RUN) console.log("   (dry run — nothing was actually written to HubSpot)");
}

main();
