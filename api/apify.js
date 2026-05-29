// api/apify.js — Two Travel Apify integration
// Triggers the custom availability checker actor and returns results
// Vercel serverless function

const APIFY_BASE = "https://api.apify.com/v2";

async function apifyRequest(path, method = "GET", body = null, token) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${APIFY_BASE}${path}`, opts);
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

// ── Query Notion for Airbnb URLs of matching properties ──────────────────────
async function getPropertiesFromNotion(city, type, token) {
  const NOTION_BASE = "https://api.notion.com/v1";
  const NOTION_VERSION = "2022-06-28";

  // DB mapping (same as api/properties.js)
  const DB_MAP = {
    cartagena_villa:        { id: "bb76cfeb628e461db7fa98c77ba9dacf", nameField: "House",      airbnbField: "AIR BNB LINK" },
    medellin_villa:         { id: "a3ba0034ca4f49f2939d43a88e6851b1", nameField: "House",      airbnbField: "AIRBNB LINK" },
    mexico_city_villa:      { id: "166ca3b3327180b09b06f9d87380882e", nameField: null,         airbnbField: "AIR BNB LINK" },
    tulum_villa:            { id: "35e8c4427f834ed382fee905a1327b01", nameField: "House",      airbnbField: null },
  };

  const cityNorm = (city || "").toLowerCase().replace(/\s+/g, "_");
  const typeNorm = (type || "villa").toLowerCase();

  const entries = Object.entries(DB_MAP).filter(([key]) => {
    if (cityNorm && !key.startsWith(cityNorm)) return false;
    if (typeNorm && !key.includes(typeNorm.replace("s", ""))) return false;
    return true;
  });

  const properties = [];

  for (const [, db] of entries) {
    try {
      const res = await fetch(`${NOTION_BASE}/databases/${db.id}/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ page_size: 100 }),
      });

      if (!res.ok) continue;
      const data = await res.json();

      for (const page of (data.results || [])) {
        const props = page.properties || {};

        // Get name
        let name = null;
        if (db.nameField && props[db.nameField]?.title) {
          name = props[db.nameField].title.map(t => t.plain_text).join("");
        } else {
          // Auto-detect title field
          for (const [, p] of Object.entries(props)) {
            if (p.type === "title" && p.title?.length > 0) {
              name = p.title.map(t => t.plain_text).join("");
              break;
            }
          }
        }

        if (!name) continue;

        // Get Airbnb URL
        const airbnbUrl = db.airbnbField
          ? props[db.airbnbField]?.url || null
          : null;

        if (!airbnbUrl) continue; // skip if no Airbnb link

        properties.push({
          name,
          airbnbUrl,
          notionPageId: page.id,
          city: cityNorm || "cartagena",
          type: typeNorm,
        });
      }
    } catch (err) {
      console.error(`Error fetching Notion DB for ${cityNorm}:`, err.message);
    }
  }

  return properties;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apifyToken  = (process.env.APIFY_TOKEN  || "").trim();
  const actorId     = (process.env.APIFY_ACTOR_ID || "").trim(); // e.g. "twotravel/availability-checker"
  const notionToken = (process.env.NOTION_TOKEN   || "").trim();

  if (!apifyToken) return res.status(503).json({ error: "APIFY_TOKEN not configured" });
  if (!actorId)    return res.status(503).json({ error: "APIFY_ACTOR_ID not configured" });

  const { action, city, type, checkIn, checkOut, guests = 2, properties, runId } = req.body || {};

  // ── CHECK STATUS of a running actor run ─────────────────────────────────
  if (action === "status" && runId) {
    const r = await apifyRequest(`/actor-runs/${runId}`, "GET", null, apifyToken);
    if (!r.ok) return res.status(500).json({ error: "Failed to get run status", details: r.data });

    const run = r.data;
    const status = run.status; // RUNNING, SUCCEEDED, FAILED, etc.

    // If done, fetch results
    if (status === "SUCCEEDED") {
      const datasetId = run.defaultDatasetId;
      const items = await apifyRequest(`/datasets/${datasetId}/items?clean=true`, "GET", null, apifyToken);
      return res.status(200).json({
        status,
        results: items.data || [],
        runId,
      });
    }

    return res.status(200).json({ status, runId, startedAt: run.startedAt });
  }

  // ── TRIGGER actor run ────────────────────────────────────────────────────
  if (action === "check" || !action) {
    // Build property list — either from input or from Notion
    let propsToCheck = properties || [];

    if (!propsToCheck.length && (city || type)) {
      if (!notionToken) {
        return res.status(400).json({ error: "Provide properties array or configure NOTION_TOKEN to auto-fetch from Notion" });
      }
      propsToCheck = await getPropertiesFromNotion(city, type, notionToken);
    }

    if (!propsToCheck.length) {
      return res.status(400).json({ error: "No properties to check. Provide 'properties' array or 'city'/'type' filters." });
    }

    // Trigger actor
    const actorInput = {
      properties: propsToCheck,
      checkIn:      checkIn  || null,
      checkOut:     checkOut || null,
      guests:       guests   || 2,
      writeToNotion: !!notionToken,
      notionToken,
      maxConcurrency: 3,
    };

    const r = await apifyRequest(`/acts/${actorId}/runs`, "POST", actorInput, apifyToken);

    if (!r.ok) {
      console.error("Apify run error:", JSON.stringify(r.data).slice(0, 300));
      return res.status(500).json({ error: "Failed to start actor run", details: r.data });
    }

    const runData = r.data;
    return res.status(200).json({
      ok: true,
      runId:    runData.id,
      status:   runData.status,
      actorId,
      properties: propsToCheck.length,
      message:  `Checking ${propsToCheck.length} properties. Poll /api/apify with action=status&runId=${runData.id}`,
    });
  }

  // ── GET RESULTS of last run ───────────────────────────────────────────────
  if (action === "last_results") {
    // Get most recent successful run
    const runs = await apifyRequest(`/acts/${actorId}/runs?status=SUCCEEDED&limit=1`, "GET", null, apifyToken);
    if (!runs.ok || !runs.data?.items?.length) {
      return res.status(200).json({ results: [], message: "No completed runs found." });
    }

    const lastRun = runs.data.items[0];
    const datasetId = lastRun.defaultDatasetId;
    const items = await apifyRequest(`/datasets/${datasetId}/items?clean=true`, "GET", null, apifyToken);

    return res.status(200).json({
      runId:      lastRun.id,
      finishedAt: lastRun.finishedAt,
      results:    items.data || [],
    });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
