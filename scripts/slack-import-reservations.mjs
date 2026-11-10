#!/usr/bin/env node
// One-time script: clear Supabase finance_reservations_v1 and repopulate from
// 2 months of Slack #reservations-tt history.
//
// Run: node scripts/slack-import-reservations.mjs

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Load env ───────────────────────────────────────────────────────────────
function loadEnv(path) {
  try {
    readFileSync(path, "utf8").split("\n").forEach(line => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g,"");
    });
  } catch {}
}
loadEnv("/Users/michel/twotravel-catalog/.env.production.local");
loadEnv("/Users/michel/twotravel-catalog/.env.local");
loadEnv("/Users/michel/twotravel-catalog/.env");

const BOT_TOKEN   = process.env.VITE_SLACK_BOT_TOKEN;
const SUPABASE_URL= process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY= process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_ID = "finance_reservations_v1";

if (!BOT_TOKEN)    { console.error("❌ VITE_SLACK_BOT_TOKEN not found"); process.exit(1); }
if (!SUPABASE_URL) { console.error("❌ VITE_SUPABASE_URL not found");    process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Slack helpers ──────────────────────────────────────────────────────────
async function slackGet(method, params = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${BOT_TOKEN}` } });
  const d = await r.json();
  if (!d.ok) throw new Error(`Slack ${method}: ${d.error}`);
  return d;
}

async function findReservationsChannel() {
  // Check known channel IDs first
  const knownIds = [
    process.env.VITE_SLACK_CHANNEL_ID,
    process.env.VITE_SLACK_ORDERS_CHANNEL_ID,
  ].filter(Boolean);

  for (const id of knownIds) {
    try {
      const info = await slackGet("conversations.info", { channel: id });
      const name = info.channel.name;
      console.log(`  Channel ${id} = #${name}`);
      if (name === "reservations-tt" || name.includes("reservat")) return id;
    } catch {}
  }

  // Fall back: list all channels
  console.log("  Listing all channels to find #reservations-tt...");
  let cursor = "";
  do {
    const params = { types:"public_channel,private_channel", limit:200, exclude_archived:true };
    if (cursor) params.cursor = cursor;
    const d = await slackGet("conversations.list", params);
    for (const ch of d.channels) {
      if (ch.name === "reservations-tt" || ch.name.includes("reservat")) {
        console.log(`  Found: #${ch.name} = ${ch.id}`);
        return ch.id;
      }
    }
    cursor = d.response_metadata?.next_cursor || "";
  } while (cursor);

  return null;
}

// ── Message parser (same logic as api/slack-events.js) ────────────────────
const FIELD_MAP = {
  name:        ["contact name","contact","client name","client","guest name","nombre"],
  dealName:    ["deal name","deal"],
  fecha:       ["arrival date","arrival","fecha llegada","fecha","check-in","check in"],
  checkOut:    ["departure date","departure","fecha salida","checkout","check-out","check out"],
  city:        ["city","city_tt","ciudad","destino","destination"],
  pax:         ["# of guests","guests","pax","personas","number of guests","number of people"],
  clientTotalUSD: ["client price","client total","client_price","amount","precio cliente","total","price"],
  precioProveedor: ["our price","provider price","precio proveedor","our cost","cost"],
  serviceDescription: ["property","item","item___airbnb_vrbo","propiedad","casa","villa","service","servicio"],
  provider:    ["provider","proveedores","source","proveedor"],
  conciergeRep:["concierge","head concierge","assigned to","asignado","rep"],
  currency:    ["currency","moneda"],
  guestEmail:  ["email","correo"],
  dealSource:  ["source","fuente","deal source","source___deal"],
};

function normalizeKey(raw) { return raw.toLowerCase().replace(/[^a-z0-9 #_]/g,"").trim(); }

function parseDate(str) {
  if (!str) return "";
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[1].padStart(2,"0")}-${m1[2].padStart(2,"0")}`;
  const m2 = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m2) {
    const months={jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
                  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
    const mo = months[m2[1].slice(0,3).toLowerCase()];
    if (mo) return `${m2[3]}-${mo}-${m2[2].padStart(2,"0")}`;
  }
  return str;
}
function parseMoney(str) { return str ? str.replace(/[$,\s]/g,"").trim() : ""; }
function hsBaseName(name) {
  return (name||"").replace(/\s*-\s*[A-Za-z ]+\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}\s*$/i,"").toLowerCase().trim();
}

function parseMessage(text, ts) {
  text = text
    .replace(/<[^>]+\|([^>]+)>/g,"$1")
    .replace(/<[^>]+>/g,"")
    .replace(/[*_~`]/g,"");

  const fields = {};
  for (const line of text.split(/\n|\r/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const rawKey = normalizeKey(line.slice(0, idx));
    const val    = line.slice(idx + 1).trim();
    if (!val) continue;
    for (const [field, aliases] of Object.entries(FIELD_MAP)) {
      if (aliases.includes(rawKey) && !fields[field]) { fields[field] = val; break; }
    }
  }

  if (!fields.name && fields.dealName) {
    const parts = fields.dealName.split(/\s*-\s*/);
    fields.name = parts[0].trim();
    if (!fields.city && parts[1]) fields.city = parts[1].trim();
  }

  if (fields.fecha)          fields.fecha          = parseDate(fields.fecha);
  if (fields.checkOut)       fields.checkOut       = parseDate(fields.checkOut);
  if (fields.clientTotalUSD) fields.clientTotalUSD = parseMoney(fields.clientTotalUSD);
  if (fields.precioProveedor)fields.precioProveedor= parseMoney(fields.precioProveedor);

  if (!fields.name) return null;

  return {
    name:              fields.name || "",
    fecha:             fields.fecha || "",
    checkOut:          fields.checkOut || "",
    city:              fields.city || "",
    pax:               fields.pax || "",
    clientTotalUSD:    fields.clientTotalUSD || "",
    precioProveedor:   fields.precioProveedor || "",
    serviceDescription:fields.serviceDescription || "",
    provider:          fields.provider || "",
    conciergeRep:      fields.conciergeRep || "",
    currency:          fields.currency || "USD",
    guestEmail:        fields.guestEmail || "",
    dealSource:        fields.dealSource || "",
    servicesStatus:    "Confirmed",
    _source:           "slack_auto",
    createdAt:         ts ? new Date(parseFloat(ts) * 1000).toISOString() : new Date().toISOString(),
    slackTs:           ts || "",
  };
}

function extractText(msg) {
  let text = msg.text || "";
  if (msg.attachments?.length) {
    for (const att of msg.attachments) {
      if (att.text)     text += "\n" + att.text;
      if (att.fallback) text += "\n" + att.fallback;
      if (att.fields?.length) for (const f of att.fields) text += `\n${f.title}: ${f.value}`;
    }
  }
  if (msg.blocks?.length) {
    for (const block of msg.blocks) {
      if (block.text?.text) text += "\n" + block.text.text;
      if (block.fields?.length) for (const f of block.fields) if (f.text) text += "\n" + f.text;
      if (block.elements?.length) for (const el of block.elements) {
        if (el.text?.text) text += "\n" + el.text.text;
        if (el.elements?.length) for (const sub of el.elements) if (sub.text) text += "\n" + sub.text;
      }
    }
  }
  return text;
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍 Buscando canal #reservations-tt...");
  const channelId = await findReservationsChannel();
  if (!channelId) {
    console.error("❌ No se encontró #reservations-tt. Verifica que el bot esté invitado al canal.");
    process.exit(1);
  }
  console.log(`✅ Canal: ${channelId}`);

  // 2 months back: Oct 1
  const oldest = new Date("2026-10-01T00:00:00Z").getTime() / 1000;
  console.log(`\n📥 Fetching mensajes desde 1 Oct 2026...`);

  const messages = [];
  let cursor = "";
  do {
    const params = { channel: channelId, limit: 200, oldest: String(oldest) };
    if (cursor) params.cursor = cursor;
    const d = await slackGet("conversations.history", params);
    messages.push(...d.messages);
    cursor = d.response_metadata?.next_cursor || "";
    console.log(`   ${messages.length} mensajes hasta ahora...`);
  } while (cursor);

  console.log(`\n📋 Total mensajes: ${messages.length}`);

  // Parse all messages
  const parsed = [];
  for (const msg of messages) {
    if (msg.subtype === "message_changed" || msg.subtype === "message_deleted") continue;
    const text = extractText(msg);
    if (!text.trim()) continue;
    const row = parseMessage(text, msg.ts);
    if (row) {
      parsed.push(row);
      console.log(`  ✓ ${row.name} | ${row.fecha} | ${row.city} | $${row.clientTotalUSD}`);
    }
  }

  console.log(`\n✅ Reservaciones parseadas: ${parsed.length} de ${messages.length} mensajes`);

  if (parsed.length === 0) {
    console.log("⚠️  No se parseó ninguna reservación — revisar formato de mensajes.");
    return;
  }

  // Dedup by name|fecha
  const seen = new Set();
  const deduped = parsed.filter(r => {
    const key = `${hsBaseName(r.name)}|${r.fecha}`;
    if (seen.has(key)) { console.log(`  dup: ${r.name} ${r.fecha}`); return false; }
    seen.add(key);
    return true;
  });
  console.log(`  Después de dedup: ${deduped.length} únicas`);

  // Sort newest arrival first
  deduped.sort((a,b) => (b.fecha||"").localeCompare(a.fecha||""));

  // Clear and save to Supabase
  console.log("\n🗑  Limpiando datos existentes en Supabase...");
  const emptyData = { internalNotes: JSON.stringify({ reservations: [] }) };
  const { error: clearErr } = await supabase
    .from("kickoffs")
    .upsert({ id: SUPABASE_ID, data: emptyData }, { onConflict: "id" });
  if (clearErr) { console.error("❌ Error limpiando:", clearErr.message); process.exit(1); }
  console.log("  ✓ Datos limpiados");

  console.log(`\n💾 Guardando ${deduped.length} reservaciones...`);
  const newData = { internalNotes: JSON.stringify({ reservations: deduped }) };
  const { error: saveErr } = await supabase
    .from("kickoffs")
    .upsert({ id: SUPABASE_ID, data: newData }, { onConflict: "id" });
  if (saveErr) { console.error("❌ Error guardando:", saveErr.message); process.exit(1); }

  console.log(`\n🎉 Listo! ${deduped.length} reservaciones importadas desde Slack.`);
  console.log("   Recarga el FinancePanel para verlas.\n");
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
