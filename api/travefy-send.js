// api/travefy-send.js
import Papa from "papaparse";

const TRAVEFY_BASE = "https://api.travefy.com/api/v1";
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNGpwNTGIWfyOOxSIFZgTdstPVL53Qhu_jUA1THG3J69YRdWI8SUsj4wHQsVOer2ykFzLMk2SozHuQ/pub?gid=190949837&single=true&output=csv";

/* ───────── tiny helpers ───────── */

const clean = (v) => String(v ?? "").trim();

function parseNum(v) {
  const n = Number(clean(v).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function truthy(v) {
  return ["true", "1", "yes", "si", "sí"].includes(clean(v).toLowerCase());
}

function first(...vals) {
  for (const v of vals) if (clean(v)) return clean(v);
  return "";
}

function splitList(v) {
  return clean(v)
    .split(/[\n•·]+|[/;|]|,\s(?=[A-Z0-9])/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function formatCOP(v) {
  const n = parseNum(v);
  return n ? `$${n.toLocaleString("es-CO")} COP` : "";
}

function normDriveUrl(url) {
  const raw = clean(url);
  if (!raw || !raw.includes("drive.google.com")) return raw;
  const m = raw.match(/\/file\/d\/([^/]+)/) || raw.match(/[?&]id=([^&]+)/);
  return m?.[1] ? `https://lh3.googleusercontent.com/d/${m[1]}` : "";
}

/* ───────── catalog ───────── */

function mapRow(row, idx) {
  const n = {};
  for (const [k, v] of Object.entries(row || {}))
    n[clean(k).toLowerCase()] = v;

  const extraImages = ["5","6","7","8","9"]
    .map((k) => normDriveUrl(clean(n[k]))).filter(Boolean);

  return {
    id: parseNum(n.id || idx + 1),
    sku: clean(n.sku),
    name: first(n.name, n.title, n.service),
    category: clean(n.category),
    quickbooksCode: clean(n["quickbooks_code"] || n["quickbooks code"] || n.quickbooks_code || ""),
    descriptionEs: first(n["description_es"], n["description es"], n.description),
    descriptionEn: first(n["description_en"], n["description en"]),
    location: clean(n.location),          // venue name / neighborhood
    address:  clean(n.address),           // full street address (separate column)
    city: clean(n.city),
    schedule: first(n.schedule, n.time),
    duration: clean(n.duration),
    highlights: clean(n.highlights),
    includes: first(n.includes, n.included),
    deposit: clean(n.deposit),
    cancellation: first(n.cancellation, n["terms and conditions"]),
    priceCop: first(n.price_cop, n.price, n["price cop"]),
    priceTier1: clean(n.price_tier_1),
    priceTier2: clean(n.price_tier_2),
    priceUnit: first(n.priceunit, n["price unit"], "per person"),
    image: normDriveUrl(first(n.image, n.imageurl, n["image url"])),
    images: extraImages,
    mapsUrl: first(n.mapsurl, n["maps url"]),
    menuUrl: first(n.menuurl, n["menu url"]),
    enabled: truthy(n["travefy_enabled"] ?? n["travefy enabled"] ?? "true"),
  };
}

async function fetchCatalog() {
  const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  const { data } = Papa.parse(await res.text(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => clean(h).toLowerCase().replace(/\ufeff/g, ""),
  });
  return data.map(mapRow).filter((r) => r.name);
}

/* ───────── cart matching ───────── */

function matchCart(cart, catalog) {
  const matched = [], unmatched = [];
  for (const item of Array.isArray(cart) ? cart : []) {
    const sku = clean(item?.sku);
    const id  = clean(item?.id);
    const nl  = clean(item?.name).toLowerCase();
    const svc =
      catalog.find((s) => sku && s.sku === sku) ||
      catalog.find((s) => id  && String(s.id) === id) ||
      catalog.find((s) => nl  && s.name.toLowerCase() === nl) ||
      catalog.find((s) => nl  && s.name.toLowerCase().startsWith(nl)) ||
      (nl.length >= 4
        ? catalog.find((s) =>
            s.name.toLowerCase().includes(nl) || nl.includes(s.name.toLowerCase())
          )
        : null);

    if (!svc) {
      unmatched.push({ name: item?.name || "?", decision: "not_in_catalog" });
      continue;
    }
    if (!svc.enabled) {
      unmatched.push({ name: svc.name, decision: "disabled" });
      continue;
    }
    matched.push({ cartItem: item, service: svc });
  }
  return { matched, unmatched };
}

/* ───────── description builder ───────── */

const L = {
  en: { highlights:"Highlights", includes:"Includes", duration:"Duration",
        location:"Location", price:"Price", deposit:"Deposit",
        cancellation:"Terms & Cancellation", menu:"Menu", map:"Map" },
  es: { highlights:"Destacados", includes:"Incluye", duration:"Duración",
        location:"Ubicación", price:"Precio", deposit:"Depósito",
        cancellation:"Términos y Cancelación", menu:"Menú", map:"Ver en mapa" },
};

const CATEGORY_LABELS = {
  en: {
    restaurants: "Restaurant", restaurant: "Restaurant",
    nightlife: "Nightlife", "night life": "Nightlife",
    tours: "Tour / Activity", tour: "Tour / Activity", experiences: "Experience",
    transport: "Transport", transportation: "Transport",
    "beach clubs": "Beach Club", "beach club": "Beach Club",
    boats: "Boat / Yacht", boat: "Boat / Yacht",
    accommodation: "Accommodation", villa: "Villa / Accommodation",
    shopping: "Shopping",
  },
  es: {
    restaurants: "Restaurante", restaurant: "Restaurante",
    nightlife: "Nightlife / Club", "night life": "Nightlife",
    tours: "Tour / Actividad", tour: "Tour / Actividad", experiences: "Experiencia",
    transport: "Transporte", transportation: "Transporte",
    "beach clubs": "Beach Club", "beach club": "Beach Club",
    boats: "Bote / Yate", boat: "Bote / Yate",
    accommodation: "Alojamiento", villa: "Villa / Alojamiento",
    shopping: "Shopping",
  },
};

const CATEGORY_EMOJI = {
  restaurants: "🍽", restaurant: "🍽",
  nightlife: "🎉", "night life": "🎉",
  tours: "🏛", tour: "🏛", experiences: "✨",
  transport: "🚗", transportation: "🚗",
  "beach clubs": "🏖", "beach club": "🏖",
  boats: "⛵", boat: "⛵",
  accommodation: "🏠", villa: "🏠",
  shopping: "🛍",
};

function categoryLabel(svc, lang) {
  const cat = clean(svc.category).toLowerCase();
  const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.en;
  const label = labels[cat] || (lang === "es" ? "Servicio" : "Service");
  const emoji = CATEGORY_EMOJI[cat] || "📌";
  const parts = [`${emoji} ${label}`];
  if (svc.location) parts.push(svc.location);
  return parts.join(" | ");
}

function buildDescription(svc, lang) {
  // Only narrative content — Travefy renders Price, MenuUrl, Location natively from their own fields.
  // Duplicating them here creates messy double entries in the Travefy PDF.
  const lb = L[lang] || L.en;
  const blocks = [];

  // Main description (language-aware)
  const main = lang === "es"
    ? (svc.descriptionEs || svc.descriptionEn)
    : (svc.descriptionEn || svc.descriptionEs);
  if (main) blocks.push(main);

  // Trip Highlights
  const hi = splitList(svc.highlights);
  if (hi.length) blocks.push(`${lang === "es" ? "Aspectos Destacados" : "Trip Highlights"}:\n${hi.map((x) => `• ${x}`).join("\n")}`);

  // Includes
  const inc = splitList(svc.includes);
  if (inc.length) blocks.push(`${lb.includes}:\n${inc.map((x) => `• ${x}`).join("\n")}`);

  // Duration (if not already mentioned in narrative)
  if (svc.duration) blocks.push(`${lb.duration}: ${svc.duration}`);

  // Deposit notice (plain text, not duplicating price)
  if (svc.deposit) blocks.push(svc.deposit);

  // Cancellation policy
  if (svc.cancellation) {
    const label = lang === "es" ? "Política de Cancelación" : "Cancellation Policy";
    blocks.push(`${label}\n${svc.cancellation}`);
  }

  return blocks.join("\n\n").trim();
}

/* ───────── Travefy payload: Trip → TripDays → TripEvents → TripIdeas ───────── */

/**
 * EventType mapping (Travefy's documented values).
 * TripIdeas are stand-alone content blocks — no LibraryItemId needed.
 */
function eventTypeId(category) {
  const c = clean(category).toLowerCase();
  if (/transport|transfer|pickup|airport|van|suv/.test(c)) return 3;  // Transport
  if (/accommodation|hotel|villa|house|penthouse/.test(c))  return 2;  // Accommodation
  if (/food|restaurant|dinner|lunch|breakfast|chef/.test(c)) return 4; // Food
  if (/nightlife|party|club|bar|drinks/.test(c))             return 5; // Nightlife
  if (/activity|tour|experience|boat|beach|museum/.test(c))  return 1; // Activity
  return 0; // General
}

function buildTripIdea(svc, cartItem, lang) {
  const desc  = buildDescription(svc, lang);
  const price = parseNum(svc.priceCop || svc.priceTier1 || "");

  return {
    Title:       clean(cartItem?.title || cartItem?.name || svc.name),
    Description: desc,
    Notes:       desc,
    Price:       price || undefined,
    PriceText:   formatCOP(svc.priceCop || svc.priceTier1) || undefined,
    Duration:    svc.duration || undefined,
    // Location = venue name / neighborhood shown at bottom of Travefy item
    Location:    svc.location || undefined,
    // Address = full street address (separate field in sheet, don't use location here)
    Address:     svc.address  || undefined,
    Website:     svc.menuUrl  || svc.mapsUrl || undefined,
    ImageUrl:    svc.image    || undefined,
    MenuUrl:     svc.menuUrl  || undefined,
    MapsUrl:     svc.mapsUrl  || undefined,
  };
}

function buildTripEvent(svc, cartItem, lang, sortOrder) {
  const title = clean(cartItem?.title || cartItem?.name || svc.name);
  return {
    SortOrder: sortOrder,
    Title: title,
    // Do NOT set Location here — Travefy uses it as the list label, hiding the Title
    StartTime: clean(cartItem?.time || cartItem?.startTime || svc.schedule) || undefined,
    EventTypeId: eventTypeId(svc.category),
    TripIdeas: [buildTripIdea(svc, cartItem, lang)],
  };
}

function buildWelcomeDay(meta) {
  const lines = [];
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("TWO TRAVEL");
  lines.push("https://two.travel/");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (meta.guestName)      lines.push(`\nGuest:      ${meta.guestName}`);
  if (meta.guestContact)   lines.push(`Contact:    ${meta.guestContact}`);
  if (meta.conciergeName)  lines.push(`Concierge:  ${meta.conciergeName}`);
  if (meta.conciergeEmail) lines.push(`Email:      ${meta.conciergeEmail}`);
  if (meta.conciergeSummary) lines.push(`\n${meta.conciergeSummary}`);
  lines.push("\nAll reservations are under Two Travel – " +
    (meta.guestName || "Guest") + ". Cancellation fees may apply once confirmed.");

  return {
    SortOrder: 0,
    Title: `Welcome — ${meta.guestName || "Your Trip"}`,
    TripEvents: [{
      SortOrder: 1,
      Title: `${meta.guestName || "Your Trip"} · Two Travel Concierge`,
      EventTypeId: 0,
      TripIdeas: [{
        Title: `${meta.guestName || "Your Trip"} · Two Travel`,
        Description: lines.join("\n"),
        Notes: lines.join("\n"),
      }],
    }],
  };
}

function buildAccountingDay(matched, meta) {
  const withCodes = matched.filter(({ service }) => service.quickbooksCode);
  if (withCodes.length === 0 && !meta.guestName) return null;

  const lines = ["TWO TRAVEL — ACCOUNTING REFERENCE", ""];
  lines.push("Client Information");
  if (meta.guestName)    lines.push(`[1A][${meta.guestName}]`);
  if (meta.guestContact) lines.push(`[2A][${meta.guestContact}]`);
  if (meta.startDate)    lines.push(`[3A][${meta.startDate}]`);
  if (meta.endDate)      lines.push(`[4A][${meta.endDate}]`);

  if (withCodes.length > 0) {
    lines.push("", "Services Included");
    for (const { service } of withCodes) {
      const price = parseNum(service.priceCop) || 0;
      const cat   = clean(service.category) || "Service";
      lines.push(`[${service.quickbooksCode}][${price}][${cat}:${service.name}]`);
    }
  }

  return {
    SortOrder: 999,
    Title: "Accounting Reference",
    TripEvents: [{
      SortOrder: 1,
      Title: "QuickBooks Codes",
      EventTypeId: 0,
      TripIdeas: [{
        Title: "Accounting Reference — Two Travel",
        Description: lines.join("\n"),
        Notes: lines.join("\n"),
      }],
    }],
  };
}

function buildTripDays(matched, lang, meta) {
  // Group services by cartItem.day label
  const dayMap = new Map();
  matched.forEach(({ cartItem, service }, idx) => {
    const key = clean(cartItem?.day || cartItem?.dayLabel || "Itinerary");
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push({ cartItem, service, idx });
  });

  const serviceDays = Array.from(dayMap.entries()).map(([title, items], di) => ({
    SortOrder: di + 1,
    Title: title,
    TripEvents: items.map(({ cartItem, service, idx }) =>
      buildTripEvent(service, cartItem, lang, idx + 1)
    ),
  }));

  // Prepend welcome, append accounting
  const welcomeDay    = buildWelcomeDay(meta);
  const accountingDay = buildAccountingDay(matched, meta);

  return [
    welcomeDay,
    ...serviceDays,
    ...(accountingDay ? [accountingDay] : []),
  ];
}

/* Plain-text Notes — cover page + itinerary + QuickBooks codes at the end */
function buildNotes(matched, lang, meta) {
  const lines = [];

  // ── COVER / HEADER ──────────────────────────────
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("  TWO TRAVEL");
  lines.push("  https://two.travel/");
  lines.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  lines.push("");
  if (meta.guestName)      lines.push(`Guest:      ${meta.guestName}`);
  if (meta.guestContact)   lines.push(`Contact:    ${meta.guestContact}`);
  if (meta.conciergeName)  lines.push(`Concierge:  ${meta.conciergeName}`);
  if (meta.conciergeEmail) lines.push(`Email:      ${meta.conciergeEmail}`);
  lines.push("");

  if (meta.conciergeSummary) {
    lines.push(meta.conciergeSummary);
    lines.push("");
  }

  lines.push("All reservations are under Two Travel – " + (meta.guestName || "Guest") +
    ". Once confirmed, cancellation fees may apply.");
  lines.push("");
  lines.push("────────────────────────────────────────");
  lines.push("");

  // ── ITINERARY BY DAY ────────────────────────────
  const grouped = new Map();
  matched.forEach(({ cartItem, service }) => {
    const day = clean(cartItem?.day || "Itinerary");
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push({ cartItem, service });
  });

  for (const [day, items] of grouped) {
    lines.push(`━━ ${day} ━━`);
    for (const { cartItem, service } of items) {
      const t = clean(cartItem?.time || service.schedule);
      lines.push(`${t ? t + "  " : ""}${service.name}`);
      const catLbl = categoryLabel(service, lang);
      lines.push(`  ${catLbl}`);
      if (service.duration) lines.push(`  ⏱ ${service.duration}`);
      const pf = formatCOP(service.priceCop);
      if (pf) lines.push(`  💰 ${pf}`);
      if (service.menuUrl)  lines.push(`  🍽 ${service.menuUrl}`);
      if (service.mapsUrl)  lines.push(`  🗺 ${service.mapsUrl}`);
      lines.push("");
    }
  }

  if (meta.internalNotes) {
    lines.push("────────────────────────────────────────");
    lines.push("Internal Notes:");
    lines.push(meta.internalNotes);
    lines.push("");
  }

  // ── QUICKBOOKS / ACCOUNTING CODES ───────────────
  // Format: [QB_CODE][PRICE_COP][Category:Service Name]
  // Client info: [1A][name] [2A][contact] [3A][startDate] [4A][endDate]
  const withCodes = matched.filter(({ service }) => service.quickbooksCode);
  if (withCodes.length > 0 || meta.guestName || meta.guestContact) {
    lines.push("────────────────────────────────────────");
    lines.push("TWO TRAVEL — ACCOUNTING REFERENCE");
    lines.push("");
    lines.push("Client Information");
    if (meta.guestName)    lines.push(`[1A][${meta.guestName}]`);
    if (meta.guestContact) lines.push(`[2A][${meta.guestContact}]`);
    if (meta.startDate)    lines.push(`[3A][${meta.startDate}]`);
    if (meta.endDate)      lines.push(`[4A][${meta.endDate}]`);
    lines.push("");

    if (withCodes.length > 0) {
      lines.push("Services Included");
      for (const { service } of withCodes) {
        const price = parseNum(service.priceCop) || 0;
        const cat   = clean(service.category) || "Service";
        // [QB_CODE][PRICE][Category:Service Name]
        lines.push(`[${service.quickbooksCode}][${price}][${cat}:${service.name}]`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

/* ───────── handler ───────── */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const {
      guestName        = "",
      tripName         = "",
      guestContact     = "",
      lang             = "en",
      cart             = [],
      conciergeSummary = "",
      internalNotes    = "",
      accommodations   = [],
      conciergeName    = "",
      conciergeEmail   = "",
    } = req.body || {};

    const publicKey   = process.env.TRAVEFY_PUBLIC_KEY;
    const accessToken = process.env.TRAVEFY_ACCESS_TOKEN;
    if (!publicKey || !accessToken)
      return res.status(500).json({ ok: false, error: "Missing Travefy env vars" });

    const headers = {
      "X-API-PUBLIC-KEY": publicKey,
      "X-USER-TOKEN": accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // 1. Match cart → catalog
    const catalog = await fetchCatalog();
    const { matched, unmatched } = matchCart(cart, catalog);

    // 2. Build Travefy payload:  Trip → TripDays → TripEvents → TripIdeas
    const meta = { guestName, guestContact, conciergeSummary, internalNotes, conciergeName, conciergeEmail };
    const tripDays = buildTripDays(matched, lang, meta);
    const notes    = buildNotes(matched, lang, meta);

    const payload = {
      Name: tripName || guestName || "New Trip",
      PrimaryTravelerName: guestName || "Guest",
      Notes: notes,
      TripDays: tripDays,
    };

    // 3. POST /trips  — full structure in one shot
    const tripRes = await fetch(`${TRAVEFY_BASE}/trips`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const raw = await tripRes.text();
    let trip = null;
    try { trip = JSON.parse(raw); } catch {}

    if (!tripRes.ok) {
      return res.status(tripRes.status).json({
        ok: false,
        error: `Travefy rejected trip creation (${tripRes.status})`,
        travefyResponse: raw.slice(0, 500),
        sentPayload: { ...payload, TripDays: `[${tripDays.length} days]` },
      });
    }

    const tripId  = trip?.Id ?? trip?.id ?? null;
    const shareUrl = trip?.ShareUrlPath
      ? `https://www.travefy.com/${trip.ShareUrlPath}`
      : null;

    // 4. Inspect response — did Travefy accept TripDays?
    const returnedDays  = trip?.TripDays ?? trip?.Days ?? [];
    const daysAccepted  = returnedDays.length > 0;
    const eventsInFirst = returnedDays[0]?.TripEvents?.length ?? 0;

    return res.status(200).json({
      ok: true,
      message: shareUrl
        ? `✅ Trip creado en Travefy — ${shareUrl}`
        : "✅ Trip creado en Travefy",
      tripId,
      shareUrl,

      matchedServicesCount:   matched.length,
      unmatchedServicesCount: unmatched.length,
      unmatchedServices:      unmatched,
      summaryLines: matched.map(({ cartItem, service }) => {
        const t = clean(cartItem?.time || service.schedule);
        const loc = service.location ? ` — ${service.location}` : "";
        return `${t ? t + " " : ""}${service.name}${loc}`;
      }),
      itemCount: matched.length,

      // Did the structure land in Travefy?
      _structure: {
        daysAccepted,
        daysCount: returnedDays.length,
        eventsInFirstDay: eventsInFirst,
        responseKeys: trip ? Object.keys(trip) : [],
      },
    });

  } catch (err) {
    console.error("travefy-send:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
