// api/properties.js — Two Travel Property Database Bridge
// Queries all Notion property DBs and returns unified data for the Sales Agent
// Vercel serverless function

const NOTION_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

// ── DB Registry ────────────────────────────────────────────────────────────────
// Each entry maps a Notion database to a city + type + field mapping
const PROPERTY_DBS = [
  {
    id: "bb76cfeb628e461db7fa98c77ba9dacf",
    city: "cartagena",
    type: "villa",
    map: {
      name:          "House",
      maxPax:        "MAX PAX",
      bedrooms:      "BEDROOMS",
      bathrooms:     "BATHROOMS",
      clientPrice:   "CLIENT PRICE",
      ourPrice:      "OUR PRICE",
      priceRange:    "PRICE RANGE",
      photos:        "PHOTOS LINK",
      airbnb:        "AIR BNB LINK",
      partyFriendly: "PARTY FRIENDLY",
      notes:         "NOTES",
      aiSummary:     "Resumen generado por la IA",
    },
  },
  {
    // New Cartagena villa DB — shared by user as having better villa info
    id: "313ca3b33271807385ecf3ec138861f0",
    city: "cartagena",
    type: "villa",
    map: {
      name:          "House",
      maxPax:        "MAX PAX",
      bedrooms:      "BEDROOMS",
      bathrooms:     "BATHROOMS",
      clientPrice:   "CLIENT PRICE",
      ourPrice:      "OUR PRICE",
      priceRange:    "PRICE RANGE",
      photos:        "PHOTOS LINK",
      airbnb:        "AIR BNB LINK",
      partyFriendly: "PARTY FRIENDLY",
      notes:         "NOTES",
      aiSummary:     "Resumen generado por la IA",
    },
  },
  {
    id: "a3ba0034ca4f49f2939d43a88e6851b1",
    city: "medellin",
    type: "villa",
    map: {
      name:          "House",
      maxPax:        "MAX PAX",
      bedrooms:      "BEDROOMS",
      bathrooms:     "BATHROOMS",
      clientPrice:   "CLIENT PRICE",
      photos:        "PHOTOS LINK",
      airbnb:        "AIRBNB LINK",
      partyFriendly: "PARTY / BACHELOR FRIENDLY",
      notes:         "NOTES",
    },
  },
  {
    id: "166ca3b3327180b09b06f9d87380882e",
    city: "mexico_city",
    type: "villa",
    map: {
      name:          "",            // title field has no name — extracted differently
      maxPax:        "MAX PAX",
      bedrooms:      "BEDROOMS",
      bathrooms:     "BATHROOMS",
      clientPrice:   "CLIENT PRICE",
      ourPrice:      "OUR PRICE",
      photos:        "PHOTOS LINK",
      airbnb:        "AIR BNB LINK",
      partyFriendly: "PARTY FRIENDLY",
      notes:         "NOTES",
      aiSummary:     "Resumen generado por la IA",
    },
  },
  {
    id: "35e8c4427f834ed382fee905a1327b01",
    city: "tulum",
    type: "villa",
    map: {
      name:          "House",
      maxPax:        "MAX PAX",
      bedrooms:      " BEDROOMS",   // note leading space in Notion
      bathrooms:     "BATHROOMS",
      photos:        "PHOTOS",
      location:      "LOCATION",
    },
  },
  {
    id: "120ca3b33271808dba5bcad79d256db3",
    city: "cartagena",
    type: "yacht",                  // covers yachts + catamarans
    map: {
      name:          "YACHT NAME",
      maxPax:        "CAPACITY",
      feet:          "FEET",
      boatType:      "TYPE",        // Power Catamaran / Luxury Yacht / Sailing Catamaran
      clientPrice:   "CLIENT PRICE",
      ourPrice:      "OUR PRICE",
      photos:        "PHOTOS",
      dock:          "DOCK",
    },
  },
  {
    id: "914ade1922c04885a9fee6fcf2339ef1",
    city: "cartagena",
    type: "speedboat",
    map: {
      name:          "Name",        // generic fallback
      maxPax:        "CAPACITY",
      clientPrice:   "CLIENT PRICE",
      ourPrice:      "OUR PRICE",
      photos:        "PHOTOS",
    },
  },
  {
    id: "de81e3eafd8c414d882c3fa86451f6ec",
    city: "cartagena",
    type: "wedding_venue",
    map: {
      name:          "Venue",
      capacity:      "Capacidad Venue",   // multi_select
      venueType:     "Tipo de espacio",
      price:         "Precio por noche / Evento + exclusividad",
      description:   "Description",
      photos:        "PHOTOS LINK",
      location:      "Location",
      quote:         "Quote 2025",
    },
  },
];

// ── Notion API helpers ─────────────────────────────────────────────────────────
async function notionQuery(dbId, filter = null, token) {
  const body = { page_size: 100 };
  if (filter) body.filter = filter;

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
    console.error(`Notion query error for DB ${dbId}:`, err.slice(0, 200));
    return [];
  }

  const data = await res.json();
  return data.results || [];
}

// ── Property value extractors ─────────────────────────────────────────────────
function extractProp(props, fieldName) {
  if (!fieldName && fieldName !== "") return null;
  const p = props[fieldName];
  if (!p) return null;

  switch (p.type) {
    case "title":
      return p.title?.map(t => t.plain_text).join("") || null;
    case "rich_text":
      return p.rich_text?.map(t => t.plain_text).join("") || null;
    case "text":
      return p.rich_text?.map(t => t.plain_text).join("") || null;
    case "number":
      return p.number ?? null;
    case "select":
      return p.select?.name || null;
    case "multi_select":
      return p.multi_select?.map(o => o.name).join(", ") || null;
    case "url":
      return p.url || null;
    case "phone_number":
      return p.phone_number || null;
    case "email":
      return p.email || null;
    case "checkbox":
      return p.checkbox ?? null;
    default:
      return null;
  }
}

function extractTitle(props) {
  // Finds the title property regardless of its field name
  for (const key of Object.keys(props)) {
    if (props[key].type === "title") {
      return props[key].title?.map(t => t.plain_text).join("") || null;
    }
  }
  return null;
}

// ── Map a single Notion page to a unified property object ─────────────────────
function mapPage(page, dbConfig) {
  const props = page.properties || {};
  const m = dbConfig.map;

  // Name: try mapped field first, then auto-detect title
  const name = (m.name !== undefined && m.name !== "")
    ? extractProp(props, m.name)
    : extractTitle(props);

  if (!name) return null; // skip unnamed entries

  const obj = {
    id: page.id,
    notionUrl: page.url,
    name,
    city: dbConfig.city,
    type: dbConfig.type,
    lastEdited: page.last_edited_time,
  };

  // Common numeric fields
  if (m.maxPax)    obj.maxPax    = extractProp(props, m.maxPax);
  if (m.bedrooms)  obj.bedrooms  = extractProp(props, m.bedrooms);
  if (m.bathrooms) obj.bathrooms = extractProp(props, m.bathrooms);
  if (m.feet)      obj.feet      = extractProp(props, m.feet);

  // Pricing
  if (m.clientPrice) obj.clientPrice = extractProp(props, m.clientPrice);
  if (m.ourPrice)    obj.ourPrice    = extractProp(props, m.ourPrice);
  if (m.priceRange)  obj.priceRange  = extractProp(props, m.priceRange);
  if (m.price)       obj.price       = extractProp(props, m.price);
  if (m.quote)       obj.quote       = extractProp(props, m.quote);

  // Links / media
  if (m.photos)  obj.photos  = extractProp(props, m.photos);
  if (m.airbnb)  obj.airbnb  = extractProp(props, m.airbnb);
  if (m.location) obj.location = extractProp(props, m.location);
  if (m.dock)    obj.dock    = extractProp(props, m.dock);

  // Attributes
  if (m.partyFriendly) {
    const val = extractProp(props, m.partyFriendly);
    obj.partyFriendly = val === "YES" || val === "Yes" || val === "yes";
  }
  if (m.boatType)   obj.boatType   = extractProp(props, m.boatType);
  if (m.venueType)  obj.venueType  = extractProp(props, m.venueType);
  if (m.capacity)   obj.capacity   = extractProp(props, m.capacity);  // wedding pax range

  // Text content
  if (m.notes)       obj.notes      = extractProp(props, m.notes);
  if (m.aiSummary)   obj.aiSummary  = extractProp(props, m.aiSummary);
  if (m.description) obj.description = extractProp(props, m.description);

  // Completeness audit flags
  obj._audit = {
    missingPrice:  !obj.clientPrice && !obj.ourPrice && !obj.price,
    missingPhotos: !obj.photos,
    missingPax:    obj.maxPax === null && obj.capacity === null,
    missingDescription: !obj.aiSummary && !obj.notes && !obj.description,
  };

  return obj;
}

// ── Format a property as a readable string for Claude ─────────────────────────
function formatForClaude(p) {
  const parts = [`**${p.name}**`];
  if (p.city) parts.push(`📍 ${p.city.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}`);

  if (p.boatType) parts.push(`Type: ${p.boatType}`);
  if (p.venueType) parts.push(`Venue type: ${p.venueType}`);

  if (p.maxPax)    parts.push(`Max guests: ${p.maxPax}`);
  if (p.capacity)  parts.push(`Capacity: ${p.capacity}`);
  if (p.bedrooms)  parts.push(`Bedrooms: ${p.bedrooms}`);
  if (p.bathrooms) parts.push(`Bathrooms: ${p.bathrooms}`);
  if (p.feet)      parts.push(`${p.feet} ft`);
  if (p.dock)      parts.push(`Dock: ${p.dock}`);

  if (p.clientPrice) parts.push(`Client price: ${p.clientPrice}`);
  else if (p.ourPrice) parts.push(`Price (internal): ${p.ourPrice}`);
  else if (p.price)  parts.push(`Price: ${p.price.toLocaleString()} COP`);
  if (p.priceRange)  parts.push(`Price range: ${p.priceRange}`);
  if (p.quote)       parts.push(`Quote 2025: ${p.quote}`);

  if (p.partyFriendly === true) parts.push("✅ Party/bachelor friendly");
  if (p.partyFriendly === false) parts.push("❌ Not party friendly");

  if (p.location)    parts.push(`Location: ${p.location}`);

  if (p.aiSummary)   parts.push(`\n${p.aiSummary}`);
  else if (p.description) parts.push(`\n${p.description}`);
  else if (p.notes)  parts.push(`\n${p.notes}`);

  if (p.photos)   parts.push(`Photos: ${p.photos}`);
  if (p.airbnb)   parts.push(`Airbnb: ${p.airbnb}`);
  if (p.notionUrl) parts.push(`Notion: ${p.notionUrl}`);

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

  const { action, city, type, maxPax, partyFriendly, limit = 5 } = req.body || {};

  // ── SEARCH ─────────────────────────────────────────────────────────────────
  if (!action || action === "search") {
    const cityNorm = (city || "").toLowerCase().replace(/\s+/g, "_");
    const typeNorm = (type || "").toLowerCase();

    // Select which DBs to query
    const dbs = PROPERTY_DBS.filter(db => {
      if (cityNorm && db.city !== cityNorm) return false;
      if (typeNorm && typeNorm !== "all") {
        // Flexible matching: "boat" matches yacht + speedboat + catamaran
        if (typeNorm === "boat" || typeNorm === "boats") {
          return db.type === "yacht" || db.type === "speedboat" || db.type === "catamaran";
        }
        if (typeNorm === "wedding" || typeNorm === "weddings") {
          return db.type === "wedding_venue";
        }
        if (!db.type.includes(typeNorm.replace("s", ""))) return false;
      }
      return true;
    });

    if (dbs.length === 0) {
      return res.status(200).json({ properties: [], formatted: "No matching databases for those filters." });
    }

    // Query all matching DBs in parallel
    const results = await Promise.all(
      dbs.map(async db => {
        try {
          const pages = await notionQuery(db.id, null, token);
          return pages
            .map(p => mapPage(p, db))
            .filter(Boolean);
        } catch (err) {
          console.error(`Error querying DB ${db.id}:`, err.message);
          return [];
        }
      })
    );

    let properties = results.flat();

    // Filter by pax if specified
    if (maxPax) {
      const paxNum = parseInt(maxPax);
      const withPax = properties.filter(p => p.maxPax >= paxNum || p.capacity);
      if (withPax.length > 0) properties = withPax;
    }

    // Filter by party friendly
    if (partyFriendly === true) {
      const party = properties.filter(p => p.partyFriendly === true);
      if (party.length > 0) properties = party;
    }

    // Sort by completeness (properties with more info first)
    properties.sort((a, b) => {
      const scoreA = [a.clientPrice, a.photos, a.aiSummary, a.maxPax].filter(Boolean).length;
      const scoreB = [b.clientPrice, b.photos, b.aiSummary, b.maxPax].filter(Boolean).length;
      return scoreB - scoreA;
    });

    // Limit results
    const top = properties.slice(0, Math.min(limit, 10));

    return res.status(200).json({
      count: top.length,
      total: properties.length,
      properties: top,
      formatted: top.map(formatForClaude).join("\n\n---\n\n"),
    });
  }

  // ── AUDIT ──────────────────────────────────────────────────────────────────
  if (action === "audit") {
    const allResults = await Promise.all(
      PROPERTY_DBS.map(async db => {
        try {
          const pages = await notionQuery(db.id, null, token);
          return pages.map(p => mapPage(p, db)).filter(Boolean);
        } catch (err) {
          return [];
        }
      })
    );

    const all = allResults.flat();
    const issues = all
      .filter(p => Object.values(p._audit).some(Boolean))
      .map(p => ({
        name: p.name,
        city: p.city,
        type: p.type,
        notionUrl: p.notionUrl,
        issues: Object.entries(p._audit)
          .filter(([, v]) => v)
          .map(([k]) => k.replace("missing", "Missing ")),
      }));

    const summary = {
      total: all.length,
      withIssues: issues.length,
      complete: all.length - issues.length,
      byCity: {},
      byIssue: {},
    };

    all.forEach(p => {
      summary.byCity[p.city] = (summary.byCity[p.city] || 0) + 1;
    });

    issues.forEach(p => {
      p.issues.forEach(issue => {
        summary.byIssue[issue] = (summary.byIssue[issue] || 0) + 1;
      });
    });

    return res.status(200).json({ summary, issues });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
