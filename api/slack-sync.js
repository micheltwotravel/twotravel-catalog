// GET /api/slack-sync
// Reads full history of #reservaciones-tt (or SLACK_RESERVATIONS_CHANNEL_ID),
// parses every reservation message, and upserts to Supabase.
// Unlike slack-events (realtime webhook), this backfills past messages.
//
// Required env vars:
//   SLACK_RESERVATIONS_BOT_TOKEN  — bot token with channels:history + channels:read
//   SLACK_RESERVATIONS_CHANNEL_ID — channel to read (C04Q93NR4T0 = #reservaciones-tt)
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);
const SUPABASE_ID = "finance_reservations_v1";
const SLACK_TOKEN = process.env.SLACK_RESERVATIONS_BOT_TOKEN;
const CHANNEL_ID  = process.env.SLACK_RESERVATIONS_CHANNEL_ID;

// ── Field map (mirrors slack-events.js) ───────────────────────────────────
const FIELD_MAP = {
  name:        ["contact name","contact","client name","client","guest name","nombre"],
  dealName:    ["deal name","deal"],
  fecha:       ["arrival date","arrival","fecha llegada","fecha","check-in","check in","reservation date","fecha reserva"],
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

function normalizeKey(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9 #_]/g, "").trim();
}

function parseDate(str) {
  if (!str) return "";
  str = str.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m1) {
    const yr = m1[3].length === 2 ? "20" + m1[3] : m1[3];
    return `${yr}-${m1[1].padStart(2,"0")}-${m1[2].padStart(2,"0")}`;
  }
  const m2 = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2}|\d{4})$/);
  if (m2) {
    const months = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
                   jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
    const mo = months[m2[1].slice(0,3).toLowerCase()];
    const yr = m2[3].length === 2 ? "20" + m2[3] : m2[3];
    if (mo) return `${yr}-${mo}-${m2[2].padStart(2,"0")}`;
  }
  return str;
}

function parseDateRange(str) {
  if (!str) return { start:"", end:"" };
  const parts = str.split(/\s*[-–]\s*/);
  if (parts.length >= 2) return { start: parseDate(parts[0].trim()), end: parseDate(parts[parts.length-1].trim()) };
  return { start: parseDate(str), end: "" };
}

function parseMoney(str) {
  if (!str) return "";
  return str.replace(/[$,\s]/g,"").trim();
}

function hsBaseName(name) {
  return (name||"").replace(/\s*-\s*[A-Za-z ]+\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}\s*$/i,"").toLowerCase().trim();
}

function extractText(payload) {
  let text = payload.text || "";
  if (payload.attachments?.length) {
    for (const att of payload.attachments) {
      if (att.text)     text += "\n" + att.text;
      if (att.fallback) text += "\n" + att.fallback;
      if (att.fields?.length) {
        for (const f of att.fields) text += `\n${f.title}: ${f.value}`;
      }
    }
  }
  if (payload.blocks?.length) {
    for (const block of payload.blocks) {
      if (block.text?.text) text += "\n" + block.text.text;
      if (block.fields?.length) {
        for (const f of block.fields) if (f.text) text += "\n" + f.text;
      }
      if (block.elements?.length) {
        for (const el of block.elements) {
          if (el.text?.text) text += "\n" + el.text.text;
          if (el.elements?.length) {
            for (const sub of el.elements) if (sub.text) text += "\n" + sub.text;
          }
        }
      }
    }
  }
  return text.replace(/<[^>]+\|([^>]+)>/g,"$1").replace(/<[^>]+>/g,"").replace(/[*_~`]/g,"");
}

function parseMessage(text) {
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
  if (fields.name && fields.name.includes(" - ")) {
    fields.name = fields.name.split(/\s+-\s+/)[0].trim();
  }
  if (fields.fecha && /[-–]/.test(fields.fecha) && !fields.checkOut) {
    const { start, end } = parseDateRange(fields.fecha);
    fields.fecha = start;
    if (end && end !== start) fields.checkOut = end;
  } else {
    if (fields.fecha) fields.fecha = parseDate(fields.fecha);
  }
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
  };
}

// ── Slack API ──────────────────────────────────────────────────────────────
async function fetchHistory() {
  const all = [];
  let cursor;
  while (true) {
    const url = new URL("https://slack.com/api/conversations.history");
    url.searchParams.set("channel", CHANNEL_ID);
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);

    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${SLACK_TOKEN}` },
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || "Slack API error");
    all.push(...(d.messages || []));
    if (d.response_metadata?.next_cursor) cursor = d.response_metadata.next_cursor;
    else break;
  }
  return all;
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (!SLACK_TOKEN) return res.status(500).json({ error: "Missing SLACK_RESERVATIONS_BOT_TOKEN" });
  if (!CHANNEL_ID)  return res.status(500).json({ error: "Missing SLACK_RESERVATIONS_CHANNEL_ID" });

  try {
    const messages = await fetchHistory();

    // Load existing Supabase data
    const { data: existing } = await supabase
      .from("kickoffs").select("data").eq("id", SUPABASE_ID).maybeSingle();
    const d     = existing?.data || {};
    const notes = typeof d.internalNotes === "string" ? JSON.parse(d.internalNotes) : (d.internalNotes || {});
    const rows  = notes.reservations || [];

    // Index existing rows for dedup
    const existingKeys = new Set(
      rows.map(r => `${hsBaseName(r.name)}|${r.fecha||""}`)
    );

    let added = 0, skipped = 0, unparsed = 0;
    const newRows = [];

    for (const msg of messages) {
      // Skip edits and thread replies
      if (msg.subtype === "message_changed" || msg.thread_ts && msg.thread_ts !== msg.ts) continue;

      const text = extractText(msg);
      const row  = parseMessage(text);
      if (!row) { unparsed++; continue; }

      const key = `${hsBaseName(row.name)}|${row.fecha||""}`;
      if (existingKeys.has(key)) { skipped++; continue; }

      existingKeys.add(key);
      newRows.push({
        ...row,
        _source: "slack_sync",
        createdAt: msg.ts ? new Date(parseFloat(msg.ts) * 1000).toISOString() : new Date().toISOString(),
      });
      added++;
    }

    // Merge new rows with existing; sort by fecha desc
    const merged = [...newRows, ...rows]
      .sort((a,b) => (b.fecha||"").localeCompare(a.fecha||""));

    const newData = { ...d, internalNotes: JSON.stringify({ ...notes, reservations: merged }) };
    await supabase.from("kickoffs").upsert({ id: SUPABASE_ID, data: newData }, { onConflict: "id" });

    res.json({
      ok: true,
      count:    merged.length,
      added,
      skipped,
      unparsed,
      total_messages: messages.length,
    });
  } catch (err) {
    console.error("slack-sync error:", err);
    res.status(500).json({ error: err.message });
  }
}
