// api/properties.js — Two Travel Property Database Bridge
// SINGLE DATABASE: "TT Villas - All Cities" — all cities, all property types
// Vercel serverless function

const NOTION_BASE    = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ── Single master DB ──────────────────────────────────────────────────────────
// All properties live here. Fields:
//   Villa Name    (title)      — property name
//   City          (select)     — Cartagena | Medellín | Mexico City | Tulum | etc.
//   Property Type (select)     — Villa | Boat | Speedboat | Wedding Venue | Penthouse
//   Neighborhood  (rich_text)
//   Status        (select)     — Active | Inactive | Coming Soon
//   Max Pax       (number)
//   Bedrooms      (number)
//   Bathrooms     (number)
//   CLIENT PRICE  (rich_text)
//   OUR PRICE     (rich_text)
//   AIR BNB LINK  (url)
//   Photos Link   (url)
//   Bachelor Friendly (checkbox)
//   Description   (rich_text)
//   Amenities     (multi_select)
const MASTER_DB = (process.env.NOTION_PROPERTIES_DB || "313ca3b33271807385ecf3ec138861f0").trim();

// City name normalizations (what Notion stores → what we use internally)
const CITY_MAP = {
  "cartagena":    "cartagena",
  "medellín":     "medellin",
  "medellin":     "medellin",
  "medellín":     "medellin",
  "mexico city":  "mexico_city",
  "ciudad de méxico": "mexico_city",
  "cdmx":         "mexico_city",
  "tulum":        "tulum",
  "bogotá":       "bogota",
  "bogota":       "bogota",
  "santa marta":  "santa_marta",
};

// Type name normalizations
const TYPE_MAP = {
  "villa":         "villa",
  "penthouse":     "villa",
  "casa":          "villa",
  "boat":          "boat",
  "yacht":         "boat",
  "catamaran":     "boat",
  "speedboat":     "speedboat",
  "lancha":        "speedboat",
  "wedding venue": "wedding_venue",
  "venue":         "wedding_venue",
};

// ── Notion API helpers ─────────────────────────────────────────────────────────
async function notionQuery(dbId, filter, token, limit = 100) {
  let allResults = [];
  let cursor = undefined;

  do {
    const body = { page_size: Math.min(limit - allResults.length, 100) };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[Properties] Notion query error:`, err.slice(0, 200));
      break;
    }

    const data = await res.json();
    allResults = allResults.concat(data.results || []);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor && allResults.length < limit);

  return allResults;
}

// ── Property value extractors ─────────────────────────────────────────────────
function extractProp(props, fieldName) {
  if (!fieldName) return null;
  const p = props[fieldName];
  if (!p) return null;

  switch (p.type) {
    case "title":       return p.title?.map(t => t.plain_text).join("").trim() || null;
    case "rich_text":   return p.rich_text?.map(t => t.plain_text).join("").trim() || null;
    case "number":      return p.number ?? null;
    case "select":      return p.select?.name || null;
    case "multi_select":return p.multi_select?.map(o => o.name).join(", ") || null;
    case "url":         return p.url?.trim() || null;
    case "checkbox":    return p.checkbox ?? null;
    case "email":       return p.email || null;
    case "phone_number":return p.phone_number || null;
    default:            return null;
  }
}

function extractTitle(props) {
  for (const key of Object.keys(props)) {
    if (props[key].type === "title") {
      return props[key].title?.map(t => t.plain_text).join("").trim() || null;
    }
  }
  return null;
}

// Clean and normalize a URL from Notion (may have spaces, line breaks, query params we don't need)
function cleanUrl(raw) {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, "");
  return s.startsWith("http") ? s : s ? "https://" + s : null;
}

// ── Map a Notion page → unified property object ────────────────────────────────
function mapPage(page) {
  const props = page.properties || {};

  const name = extractProp(props, "Villa Name") || extractTitle(props);
  if (!name) return null;

  // City: normalize to internal key
  const cityRaw  = (extractProp(props, "City") || "").toLowerCase().trim();
  const city     = CITY_MAP[cityRaw] || cityRaw.replace(/\s+/g, "_") || "unknown";

  // Property type: normalize
  const typeRaw  = (extractProp(props, "Property Type") || "villa").toLowerCase().trim();
  const type     = TYPE_MAP[typeRaw] || typeRaw.replace(/\s+/g, "_") || "villa";

  const status   = extractProp(props, "Status") || "Active";

  const airbnbRaw = extractProp(props, "AIR BNB LINK");
  const photosRaw = extractProp(props, "Photos Link");

  return {
    id:           page.id,
    notionUrl:    page.url,
    name,
    city,
    type,
    status,
    lastEdited:   page.last_edited_time,

    // Capacity & rooms
    maxPax:       extractProp(props, "Max Pax"),
    bedrooms:     extractProp(props, "Bedrooms"),
    bathrooms:    extractProp(props, "Bathrooms"),

    // Pricing
    clientPrice:  extractProp(props, "CLIENT PRICE"),
    ourPrice:     extractProp(props, "OUR PRICE"),

    // Links
    airbnb:       cleanUrl(airbnbRaw),
    photos:       cleanUrl(photosRaw),

    // Details
    neighborhood: extractProp(props, "Neighborhood"),
    description:  extractProp(props, "Description"),
    amenities:    extractProp(props, "Amenities"),
    partyFriendly: (() => {
      const val = extractProp(props, "Bachelor Friendly");
      return val === true || val === "YES" || val === "Yes" || val === "yes";
    })(),

    // Completeness audit
    _audit: {
      missingPrice:       !extractProp(props, "CLIENT PRICE"),
      missingPhotos:      !photosRaw,
      missingPax:         extractProp(props, "Max Pax") === null,
      missingDescription: !extractProp(props, "Description"),
      missingAirbnb:      !airbnbRaw,
    },
  };
}

// ── Build Notion filter from search params ────────────────────────────────────
function buildFilter(cityNorm, typeNorm, partyFriendly, statusFilter) {
  const filters = [];

  // City filter
  if (cityNorm) {
    // Try to find the display name Notion uses from the normalized key
    const cityDisplay = Object.entries(CITY_MAP).find(([, v]) => v === cityNorm)?.[0];
    const cityNames = cityDisplay
      ? [cityDisplay, cityNorm]
      : [cityNorm];

    // Use OR across possible city name formats
    const cityFilters = cityNames.map(cn => ({
      property: "City",
      select: { equals: cn.charAt(0).toUpperCase() + cn.slice(1) },
    }));
    if (cityFilters.length === 1) {
      filters.push(cityFilters[0]);
    } else {
      filters.push({ or: cityFilters });
    }
  }

  // Type filter
  if (typeNorm && typeNorm !== "all") {
    // Map normalized type back to Notion display values
    const typeDisplayMap = {
      "villa":         ["Villa", "Penthouse", "Casa"],
      "boat":          ["Boat", "Yacht", "Catamaran"],
      "speedboat":     ["Speedboat", "Lancha"],
      "wedding_venue": ["Wedding Venue", "Venue"],
    };
    const displayVals = typeDisplayMap[typeNorm] || [typeNorm];
    if (displayVals.length === 1) {
      filters.push({ property: "Property Type", select: { equals: displayVals[0] } });
    } else {
      filters.push({ or: displayVals.map(v => ({ property: "Property Type", select: { equals: v } })) });
    }
  }

  // Party friendly filter
  if (partyFriendly === true) {
    filters.push({ property: "Bachelor Friendly", checkbox: { equals: true } });
  }

  // Status filter (default: only Active)
  if (statusFilter !== "all") {
    filters.push({
      or: [
        { property: "Status", select: { equals: "Active" } },
        { property: "Status", select: { is_empty: true } },
      ]
    });
  }

  if (filters.length === 0) return null;
  if (filters.length === 1) return filters[0];
  return { and: filters };
}

// ── Format a property for Claude ──────────────────────────────────────────────
function formatForClaude(p) {
  const cityLabel = p.city.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const typeLabel = p.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const parts = [`**${p.name}** (${typeLabel})`];
  parts.push(`📍 ${cityLabel}${p.neighborhood ? " · " + p.neighborhood : ""}`);
  if (p.maxPax)     parts.push(`👥 Max guests: ${p.maxPax}`);
  if (p.bedrooms)   parts.push(`🛏 Bedrooms: ${p.bedrooms}`);
  if (p.bathrooms)  parts.push(`🚿 Bathrooms: ${p.bathrooms}`);
  if (p.clientPrice) parts.push(`💵 Client price: ${p.clientPrice}`);
  if (p.partyFriendly) parts.push(`🎉 Party/bachelor friendly`);
  if (p.amenities)  parts.push(`✨ Amenities: ${p.amenities}`);
  if (p.description) parts.push(`\n${p.description}`);
  if (p.photos)     parts.push(`📸 Photos: ${p.photos}`);
  if (p.airbnb)     parts.push(`🏠 Airbnb: ${p.airbnb}`);
  if (p.notionUrl)  parts.push(`📋 Notion: ${p.notionUrl}`);
  return parts.join("\n");
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (process.env.NOTION_TOKEN || "").trim();
  if (!token) return res.status(503).json({ error: "NOTION_TOKEN not configured" });

  const { action, city, type, maxPax, partyFriendly, limit = 5, statusFilter } = req.body || {};

  // ── SEARCH ─────────────────────────────────────────────────────────────────
  if (!action || action === "search") {
    const cityNorm = (city || "").toLowerCase().replace(/\s+/g, "_");
    const typeNorm = (type || "").toLowerCase().replace(/\s+/g, "_");

    // Boat aliases
    const resolvedType = (typeNorm === "boat" || typeNorm === "boats") ? "boat"
      : (typeNorm === "wedding" || typeNorm === "weddings") ? "wedding_venue"
      : typeNorm;

    const filter = buildFilter(cityNorm, resolvedType, partyFriendly === true, statusFilter);

    let pages = [];
    try {
      pages = await notionQuery(MASTER_DB, filter, token, 200);
    } catch (err) {
      console.error("[Properties] Query failed:", err.message);
      return res.status(500).json({ error: "Failed to query Notion", message: err.message });
    }

    let properties = pages.map(mapPage).filter(Boolean);

    // Additional in-memory filters (for fields not indexed by Notion)
    if (maxPax) {
      const paxNum = parseInt(maxPax);
      const withPax = properties.filter(p => p.maxPax != null && p.maxPax >= paxNum);
      if (withPax.length > 0) properties = withPax;
    }

    // Sort: party-friendly first if requested, then by completeness
    properties.sort((a, b) => {
      const scoreA = [a.clientPrice, a.photos, a.airbnb, a.description, a.maxPax].filter(Boolean).length;
      const scoreB = [b.clientPrice, b.photos, b.airbnb, b.description, b.maxPax].filter(Boolean).length;
      return scoreB - scoreA;
    });

    const top = properties.slice(0, Math.min(limit, 20));

    return res.status(200).json({
      count:      top.length,
      total:      properties.length,
      db:         MASTER_DB,
      properties: top,
      formatted:  top.map(formatForClaude).join("\n\n---\n\n"),
    });
  }

  // ── AUDIT ──────────────────────────────────────────────────────────────────
  if (action === "audit") {
    const pages = await notionQuery(MASTER_DB, null, token, 500);
    const all   = pages.map(mapPage).filter(Boolean);

    const issues = all
      .filter(p => Object.values(p._audit).some(Boolean))
      .map(p => ({
        name:     p.name,
        city:     p.city,
        type:     p.type,
        notionUrl: p.notionUrl,
        issues:   Object.entries(p._audit)
          .filter(([, v]) => v)
          .map(([k]) => k.replace("missing", "Missing ")),
      }));

    const byCity = {};
    const byType = {};
    all.forEach(p => {
      byCity[p.city] = (byCity[p.city] || 0) + 1;
      byType[p.type] = (byType[p.type] || 0) + 1;
    });

    return res.status(200).json({
      summary: { total: all.length, withIssues: issues.length, complete: all.length - issues.length, byCity, byType },
      issues,
    });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
