// POST /api/slack-import — one-time: clear Supabase reservations and re-import from Slack history
// Protected by ?secret= query param
// DELETE THIS FILE after running.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);
const SUPABASE_ID = "finance_reservations_v1";

// ── Slack helpers ──────────────────────────────────────────────────────────
async function slackGet(method, params = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const token = process.env.SLACK_RESERVATIONS_BOT_TOKEN || process.env.VITE_SLACK_BOT_TOKEN;
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const d = await r.json();
  if (!d.ok) throw new Error(`Slack ${method}: ${d.error}`);
  return d;
}

async function findChannel(logs) {
  // Try each known channel ID directly with conversations.history
  // (needs channels:history scope, not channels:read — avoids missing_scope on conversations.list)
  const oldest = new Date("2026-10-01T00:00:00Z").getTime() / 1000;
  const known = [
    { id: process.env.SLACK_RESERVATIONS_CHANNEL_ID, label:"SLACK_RESERVATIONS_CHANNEL_ID" },
    { id: process.env.VITE_SLACK_CHANNEL_ID,         label:"VITE_SLACK_CHANNEL_ID" },
    { id: process.env.VITE_SLACK_ORDERS_CHANNEL_ID,  label:"VITE_SLACK_ORDERS_CHANNEL_ID" },
    { id: process.env.VITE_SLACK_BILLING_CHANNEL_ID, label:"VITE_SLACK_BILLING_CHANNEL_ID" },
  ].filter(x => x.id);

  let best = null, bestScore = 0;
  for (const { id, label } of known) {
    try {
      const test = await slackGet("conversations.history", { channel: id, limit: 10, oldest: String(oldest) });
      const msgs = test.messages || [];
      const resKeywords = /(arrival date|deal name|contact name|city_tt|check.in|departure date|# of guests)/i;
      const score = msgs.filter(m => resKeywords.test(m.text || "") || (m.attachments||[]).some(a=>resKeywords.test(a.text||a.fallback||""))).length;
      logs.push(`  ${label} (${id}): accessible, ${msgs.length} msgs, ${score} reservation-like`);
      if (score > bestScore) { bestScore = score; best = id; }
    } catch (e) {
      logs.push(`  ${label} (${id}): ${e.message}`);
    }
  }
  if (best) return best;

  // Fallback: list all channels to find #reservations-tt by name (needs channels:read)
  logs.push("  Trying conversations.list to find #reservations-tt...");
  try {
    let cursor = "";
    do {
      const params = { types: "public_channel,private_channel", limit: 200, exclude_archived: true };
      if (cursor) params.cursor = cursor;
      const d = await slackGet("conversations.list", params);
      for (const ch of d.channels || []) {
        if (ch.name === "reservations-tt" || ch.name.includes("reservat")) {
          logs.push(`  Found by name: #${ch.name} = ${ch.id}`);
          return ch.id;
        }
      }
      cursor = d.response_metadata?.next_cursor || "";
    } while (cursor);
  } catch (e) {
    logs.push(`  conversations.list failed: ${e.message}`);
  }
  return null;
}

// ── Parser ─────────────────────────────────────────────────────────────────
const FIELD_MAP = {
  name:        ["contact name","contact","client name","client","guest name","nombre"],
  dealName:    ["deal name","deal"],
  fecha:       ["arrival date","arrival","fecha llegada","fecha","check-in","check in"],
  checkOut:    ["departure date","departure","fecha salida","checkout","check-out","check out"],
  city:        ["city","city_tt","ciudad","destino","destination"],
  pax:         ["# of guests","guests","pax","personas","number of guests","number of people"],
  clientTotalUSD:["client price","client total","client_price","amount","precio cliente","total","price"],
  precioProveedor:["our price","provider price","precio proveedor","our cost","cost"],
  serviceDescription:["property","item","item___airbnb_vrbo","propiedad","casa","villa","service","servicio"],
  provider:    ["provider","proveedores","source","proveedor"],
  conciergeRep:["concierge","head concierge","assigned to","asignado","rep"],
  currency:    ["currency","moneda"],
  guestEmail:  ["email","correo"],
  dealSource:  ["source","fuente","deal source","source___deal"],
};
function nk(raw) { return raw.toLowerCase().replace(/[^a-z0-9 #_]/g,"").trim(); }
function parseDate(s) {
  if (!s) return "";
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[1].padStart(2,"0")}-${m1[2].padStart(2,"0")}`;
  const m2 = s.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m2) {
    const mo={jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"}[m2[1].slice(0,3).toLowerCase()];
    if (mo) return `${m2[3]}-${mo}-${m2[2].padStart(2,"0")}`;
  }
  return s;
}
function parseMoney(s) { return s ? s.replace(/[$,\s]/g,"").trim() : ""; }
function baseName(n) { return (n||"").replace(/\s*-\s*[A-Za-z ]+\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}\s*$/i,"").toLowerCase().trim(); }

function parseMsg(text, ts) {
  text = text.replace(/<[^>]+\|([^>]+)>/g,"$1").replace(/<[^>]+>/g,"").replace(/[*_~`]/g,"");
  const fields = {};
  for (const line of text.split(/\n|\r/)) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const rk = nk(line.slice(0,idx)), val = line.slice(idx+1).trim();
    if (!val) continue;
    for (const [field,aliases] of Object.entries(FIELD_MAP)) {
      if (aliases.includes(rk) && !fields[field]) { fields[field]=val; break; }
    }
  }
  if (!fields.name && fields.dealName) {
    const p = fields.dealName.split(/\s*-\s*/);
    fields.name = p[0].trim();
    if (!fields.city && p[1]) fields.city = p[1].trim();
  }
  if (fields.fecha) fields.fecha = parseDate(fields.fecha);
  if (fields.checkOut) fields.checkOut = parseDate(fields.checkOut);
  if (fields.clientTotalUSD) fields.clientTotalUSD = parseMoney(fields.clientTotalUSD);
  if (fields.precioProveedor) fields.precioProveedor = parseMoney(fields.precioProveedor);
  if (!fields.name) return null;
  return {
    name:fields.name||"", fecha:fields.fecha||"", checkOut:fields.checkOut||"",
    city:fields.city||"", pax:fields.pax||"", clientTotalUSD:fields.clientTotalUSD||"",
    precioProveedor:fields.precioProveedor||"", serviceDescription:fields.serviceDescription||"",
    provider:fields.provider||"", conciergeRep:fields.conciergeRep||"",
    currency:fields.currency||"USD", guestEmail:fields.guestEmail||"",
    dealSource:fields.dealSource||"", servicesStatus:"Confirmed",
    _source:"slack_auto",
    createdAt: ts ? new Date(parseFloat(ts)*1000).toISOString() : new Date().toISOString(),
    slackTs: ts||"",
  };
}

function extractText(msg) {
  let t = msg.text||"";
  for (const att of msg.attachments||[]) {
    if (att.text)     t += "\n"+att.text;
    if (att.fallback) t += "\n"+att.fallback;
    for (const f of att.fields||[]) t += `\n${f.title}: ${f.value}`;
  }
  for (const block of msg.blocks||[]) {
    if (block.text?.text) t += "\n"+block.text.text;
    for (const f of block.fields||[]) if (f.text) t += "\n"+f.text;
    for (const el of block.elements||[]) {
      if (el.text?.text) t += "\n"+el.text.text;
      for (const sub of el.elements||[]) if (sub.text) t += "\n"+sub.text;
    }
  }
  return t;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Simple secret check
  const secret = req.query.secret || req.headers["x-import-secret"];
  if (secret !== process.env.IMPORT_SECRET && secret !== "tt-import-2026") {
    return res.status(401).json({ error: "unauthorized" });
  }

  const logs = [];
  const log = (...a) => { const m=a.join(" "); logs.push(m); console.log(m); };

  try {
    // Log token identity and scopes for diagnostics
    try {
      const authTest = await fetch("https://slack.com/api/auth.test", {
        headers: { Authorization: `Bearer ${process.env.SLACK_RESERVATIONS_BOT_TOKEN || process.env.VITE_SLACK_BOT_TOKEN}` }
      }).then(r=>r.json());
      log(`Token: ${authTest.user || "?"} (${authTest.user_id || "?"}), team: ${authTest.team || "?"}`);
      log(`Scopes: ${authTest["x-oauth-scopes"] || "(check response headers)"}`);
    } catch {}

    log("Finding #reservations-tt channel...");
    const channelId = await findChannel(logs);
    if (!channelId) return res.status(400).json({ error:"channel not found", logs });
    log("Channel:", channelId);

    // Oldest = Oct 1 2026
    const oldest = new Date("2026-10-01T00:00:00Z").getTime() / 1000;
    const messages = [];
    let cursor = "";
    do {
      const p = { channel: channelId, limit: 200, oldest: String(oldest) };
      if (cursor) p.cursor = cursor;
      const d = await slackGet("conversations.history", p);
      messages.push(...d.messages);
      cursor = d.response_metadata?.next_cursor || "";
    } while (cursor);
    log(`Fetched ${messages.length} messages`);

    const parsed = [];
    for (const msg of messages) {
      if (msg.subtype==="message_changed"||msg.subtype==="message_deleted") continue;
      const row = parseMsg(extractText(msg), msg.ts);
      if (row) { parsed.push(row); log(`  ✓ ${row.name} | ${row.fecha} | ${row.city}`); }
    }
    log(`Parsed ${parsed.length} reservations`);

    // Dedup
    const seen = new Set();
    const deduped = parsed.filter(r => {
      const k = `${baseName(r.name)}|${r.fecha}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    deduped.sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
    log(`Unique: ${deduped.length}`);

    // Clear + save
    const newData = { internalNotes: JSON.stringify({ reservations: deduped }) };
    const { error } = await supabase.from("kickoffs").upsert({ id: SUPABASE_ID, data: newData }, { onConflict:"id" });
    if (error) return res.status(500).json({ error: error.message, logs });

    log(`Saved ${deduped.length} rows to Supabase ✓`);
    return res.json({ ok: true, total: deduped.length, channel: channelId, logs });

  } catch (e) {
    return res.status(500).json({ error: e.message, logs });
  }
}
