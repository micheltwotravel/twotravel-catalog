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
  const actorId     = (process.env.APIFY_ACTOR_ID || "").trim();
  const notionToken = (process.env.NOTION_TOKEN   || "").trim();

  const { action, city, type, checkIn, checkOut, guests = 2, properties, runId, airbnbUrl } = req.body || {};

  // check_single has its own token check with friendly messaging — skip global block
  if (action !== "check_single") {
    if (!apifyToken) return res.status(503).json({ error: "APIFY_TOKEN not configured" });
    if (!actorId)    return res.status(503).json({ error: "APIFY_ACTOR_ID not configured" });
  }

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

  // ── CHECK SINGLE PROPERTY ─────────────────────────────────────────────────
  // Uses Apify's Airbnb Scraper actor to get calendar availability
  // Airbnb's public iCal endpoint is blocked — Apify is the reliable path
  if (action === "check_single") {
    // airbnbUrl, checkIn, checkOut already destructured from req.body above

    if (!apifyToken) {
      return res.status(503).json({
        error: "APIFY_TOKEN not configured",
        hint: "Add APIFY_TOKEN to Vercel environment variables to enable availability checking",
        demo: true,
      });
    }

    const listingId = extractListingId(airbnbUrl);
    if (!listingId) {
      return res.status(400).json({ error: "Invalid Airbnb URL. Expected: https://www.airbnb.com/rooms/LISTING_ID" });
    }

    const listingUrl = `https://www.airbnb.com/rooms/${listingId}`;
    const propertyName = req.body.propertyName || listingUrl;
    console.log(`[Apify] check_single → Two Travel actor | listingId=${listingId} checkIn=${checkIn} checkOut=${checkOut}`);

    // Use the custom Two Travel availability checker actor (Playwright-based, reliable)
    const TT_ACTOR_ID = "8zK2KWODS6lzeckj2";   // fascinating_gadget/twotravel-availability-checker
    // run-sync-get-dataset-items: blocks until done, max 120s
    const runUrl = `${APIFY_BASE}/acts/${TT_ACTOR_ID}/run-sync-get-dataset-items?token=${apifyToken}&timeout=120&memory=1024`;

    let results = null;
    try {
      const runRes = await fetch(runUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: [{ name: propertyName, airbnbUrl: listingUrl, notionPageId: req.body.notionPageId || "" }],
          checkIn:     checkIn  || null,
          checkOut:    checkOut || null,
          notionToken: notionToken || null,
          maxConcurrency: 1,
        }),
      });

      const text = await runRes.text();
      try { results = JSON.parse(text); } catch { results = null; }

      if (!runRes.ok || !Array.isArray(results) || results.length === 0) {
        console.error("[Apify] TT actor error:", text.slice(0, 400));
        return res.status(502).json({
          error: "Availability check failed — actor returned no data",
          listingId,
          listingUrl,
          hint: "The Airbnb listing may be unlisted or the actor timed out. Try again.",
          raw: text.slice(0, 200),
        });
      }
    } catch (err) {
      return res.status(502).json({ error: "Apify request failed", message: err.message, listingId });
    }

    const result = results[0];

    // Map Two Travel actor output to our response format
    const rangeAvailable = result.available ?? null;
    const totalNights = result.totalNights
      || (checkIn && checkOut ? Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000) : null);

    return res.status(200).json({
      listingId,
      listingUrl,
      listingName:     result.name       || propertyName,
      checkIn:         result.checkIn    || checkIn  || null,
      checkOut:        result.checkOut   || checkOut || null,
      totalNights,
      rangeAvailable,
      pricePerNight:   result.pricePerNight  || null,
      totalPrice:      result.totalPrice     || null,
      currency:        result.currency       || "USD",
      minStay:         result.minStay        || null,
      conflictDates:   [],   // TT actor returns available:bool, not day-by-day
      checkedAt:       result.checkedAt      || new Date().toISOString(),
    });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}

// Helper: add 1 day to an ISO date string (YYYY-MM-DD)
function nextDay(isoDate) {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// Helper: extract Airbnb listing ID from a URL or bare number string
function extractListingId(url) {
  if (!url) return null;
  const s = String(url).trim();
  const m = s.match(/airbnb\.[a-z.]+\/rooms\/(\d+)/i)
         || s.match(/airbnb\.[a-z.]+\/h\/[^?/]+\?.*?listing_id=(\d+)/i);
  if (m) return m[1];
  if (/^\d+$/.test(s)) return s;
  return null;
}
