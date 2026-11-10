// POST /api/slack-events
// Slack Events API — listens to messages in #reservations-tt
// When the HubSpot bot (or Ray) posts a new reservation, parses and saves to Supabase.
//
// Required env vars:
//   SLACK_SIGNING_SECRET   — from Slack App Basic Information
//   VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_ANON_KEY)
//
// Slack App setup:
//   1. Create app at api.slack.com/apps
//   2. Event Subscriptions → Request URL: https://<your-domain>/api/slack-events
//   3. Subscribe to bot event: message.channels
//   4. Add bot to #reservations-tt

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);
const SUPABASE_ID = "finance_reservations_v1";

// ── Slack request verification ─────────────────────────────────────────────
function verifySlack(req, rawBody) {
  const secret    = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return true; // skip in dev if not set
  const ts        = req.headers["x-slack-request-timestamp"] || "";
  const sigHeader = req.headers["x-slack-signature"] || "";
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const base = `v0:${ts}:${rawBody}`;
  const sig  = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sigHeader));
}

// ── Message parser ─────────────────────────────────────────────────────────
// Handles HubSpot bot format and manual Ray posts
// Typical HubSpot bot message:
//   Deal Name: Dylan Hardin - Mexico City - November 2026
//   Contact Name: Dylan Hardin
//   Arrival Date: 11/11/2026
//   Departure Date: 11/15/2026
//   City: Mexico City  (or city_tt)
//   # of Guests: 6
//   Client Price: $2,801.40  (or Amount, client_price, etc.)
//   Source: Airbnb
//   Property / Item: Casa Chiapas
//   Concierge: Raymond Kanevsky

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

function normalizeKey(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9 #_]/g, "").trim();
}

function parseDate(str) {
  if (!str) return "";
  str = str.trim();
  // ISO already: 2026-11-11
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // MM/DD/YYYY
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[1].padStart(2,"0")}-${m1[2].padStart(2,"0")}`;
  // Nov 11, 2026
  const m2 = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m2) {
    const months = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
                   jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"};
    const mo = months[m2[1].slice(0,3).toLowerCase()];
    if (mo) return `${m2[3]}-${mo}-${m2[2].padStart(2,"0")}`;
  }
  return str;
}

function parseMoney(str) {
  if (!str) return "";
  return str.replace(/[$,\s]/g,"").trim();
}

function hsBaseName(name) {
  return (name||"").replace(/\s*-\s*[A-Za-z ]+\s*-\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s*\d{4}\s*$/i,"").toLowerCase().trim();
}

function parseMessage(text) {
  // Normalize: strip Slack formatting *bold*, _italic_, <url|label>
  text = text
    .replace(/<[^>]+\|([^>]+)>/g,"$1")
    .replace(/<[^>]+>/g,"")
    .replace(/[*_~`]/g,"");

  const fields = {};
  const lines = text.split(/\n|\r/);

  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 1) continue;
    const rawKey = normalizeKey(line.slice(0, idx));
    const val    = line.slice(idx + 1).trim();
    if (!val) continue;

    for (const [field, aliases] of Object.entries(FIELD_MAP)) {
      if (aliases.includes(rawKey) && !fields[field]) {
        fields[field] = val;
        break;
      }
    }
  }

  // If no explicit name but we have dealName, derive it
  if (!fields.name && fields.dealName) {
    const parts = fields.dealName.split(/\s*-\s*/);
    fields.name = parts[0].trim();
    if (!fields.city && parts[1]) fields.city = parts[1].trim();
  }

  // Normalize dates and money
  if (fields.fecha)       fields.fecha       = parseDate(fields.fecha);
  if (fields.checkOut)    fields.checkOut    = parseDate(fields.checkOut);
  if (fields.clientTotalUSD) fields.clientTotalUSD = parseMoney(fields.clientTotalUSD);
  if (fields.precioProveedor) fields.precioProveedor = parseMoney(fields.precioProveedor);

  // Must have at least a name to be a valid reservation
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

// ── Supabase upsert ────────────────────────────────────────────────────────
async function saveRow(row) {
  const { data: existing } = await supabase
    .from("kickoffs").select("data").eq("id", SUPABASE_ID).maybeSingle();

  const d     = existing?.data || {};
  const notes = typeof d.internalNotes === "string" ? JSON.parse(d.internalNotes) : (d.internalNotes || {});
  const rows  = notes.reservations || [];

  const key = `${(row.name||"").toLowerCase().trim()}|${row.fecha||""}`;
  const keyStripped = `${hsBaseName(row.name)}|${row.fecha||""}`;

  const exists = rows.some(r => {
    const rk  = `${(r.name||"").toLowerCase().trim()}|${r.fecha||""}`;
    const rks = `${hsBaseName(r.name)}|${r.fecha||""}`;
    return rk === key || rk === keyStripped || rks === key || rks === keyStripped;
  });

  if (exists) {
    console.log(`[slack-events] skip duplicate: ${row.name} ${row.fecha}`);
    return { skipped: true };
  }

  const newRow  = { ...row, _source: "slack_auto", createdAt: row.slackTs || new Date().toISOString() };
  const merged  = [newRow, ...rows].sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  const newData = { ...d, internalNotes: JSON.stringify({ ...notes, reservations: merged }) };

  await supabase.from("kickoffs").upsert({ id: SUPABASE_ID, data: newData }, { onConflict: "id" });
  console.log(`[slack-events] added: ${row.name} | ${row.fecha} | ${row.city} | $${row.clientTotalUSD}`);
  return { added: true };
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Collect raw body for signature verification
  let rawBody = "";
  if (typeof req.body === "string") {
    rawBody = req.body;
  } else {
    rawBody = JSON.stringify(req.body);
  }

  const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  // Slack URL verification handshake
  if (payload.type === "url_verification") {
    return res.json({ challenge: payload.challenge });
  }

  if (!verifySlack(req, rawBody)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = payload.event || {};

  // Only handle new messages (not edits, not bot's own messages from this app)
  if (event.type !== "message") return res.json({ ok: true });
  if (event.subtype === "message_changed" || event.subtype === "bot_message_deleted") return res.json({ ok: true });
  // Skip messages from this bot itself (loop prevention)
  if (event.bot_id && event.app_id === process.env.SLACK_APP_ID) return res.json({ ok: true });

  // Check channel (optional — filter to reservations-tt by channel ID)
  const allowedChannel = process.env.SLACK_RESERVATIONS_CHANNEL_ID;
  if (allowedChannel && event.channel !== allowedChannel) return res.json({ ok: true });

  const text = event.text || "";

  // Also handle block-kit messages (HubSpot bot uses attachments/blocks)
  let fullText = text;
  if (payload.event?.attachments?.length) {
    for (const att of payload.event.attachments) {
      if (att.text) fullText += "\n" + att.text;
      if (att.fallback) fullText += "\n" + att.fallback;
      if (att.fields?.length) {
        for (const f of att.fields) {
          fullText += `\n${f.title}: ${f.value}`;
        }
      }
    }
  }
  if (payload.event?.blocks?.length) {
    for (const block of payload.event.blocks) {
      if (block.text?.text) fullText += "\n" + block.text.text;
      if (block.fields?.length) {
        for (const f of block.fields) {
          if (f.text) fullText += "\n" + f.text;
        }
      }
      if (block.elements?.length) {
        for (const el of block.elements) {
          if (el.text?.text) fullText += "\n" + el.text.text;
          if (el.elements?.length) {
            for (const sub of el.elements) {
              if (sub.text) fullText += "\n" + sub.text;
            }
          }
        }
      }
    }
  }

  const row = parseMessage(fullText);
  if (!row) {
    console.log("[slack-events] no reservation parsed from message");
    return res.json({ ok: true, parsed: false });
  }

  // Store actual Slack message timestamp (event.ts = Unix seconds with microseconds)
  if (event.ts) row.slackTs = new Date(parseFloat(event.ts) * 1000).toISOString();

  const result = await saveRow(row);
  return res.json({ ok: true, ...result, name: row.name, fecha: row.fecha });
}
