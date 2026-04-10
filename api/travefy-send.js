// Vercel serverless function — replaces http://localhost:3001/api/travefy/send
// Runs server-side so TRAVEFY_PUBLIC_KEY and TRAVEFY_ACCESS_TOKEN stay secret.

import Papa from "papaparse";

const TRAVEFY_BASE_URL = "https://api.travefy.com/api/v1";
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNGpwNTGIWfyOOxSIFZgTdstPVL53Qhu_jUA1THG3J69YRdWI8SUsj4wHQsVOer2ykFzLMk2SozHuQ/pub?gid=190949837&single=true&output=csv";

/* ── helpers ── */

function parseNum(v) {
  const n = Number((v || "").toString().replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function mapRow(row, index) {
  return {
    id: parseNum(row.id || index + 1),
    sku: String(row.sku || "").trim(),
    name: String(row.name || "").trim(),
    travefy: {
      libraryId: String(row["travefy library id"] || "").trim(),
      libraryName: String(row["travefy library name"] || "").trim(),
      enabled: ["true", "1", "yes", "si", "sí"].includes(
        String(row["travefy enabled"] || "").trim().toLowerCase()
      ),
      notesTemplate: String(row["travefy notes template"] || ""),
      categoryOverride: String(row["travefy category override"] || ""),
    },
  };
}

async function fetchCatalog() {
  const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  const csv = await res.text();
  const { data } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) =>
      String(h || "")
        .trim()
        .toLowerCase()
        .replace(/\ufeff/g, ""),
  });
  return data.map(mapRow);
}

function matchCart(cart, catalog) {
  const matched = [];
  const unmatched = [];

  for (const item of Array.isArray(cart) ? cart : []) {
    const sku = String(item?.sku || "").trim();
    const id = String(item?.id || "").trim();
    const name = String(item?.name || "").trim().toLowerCase();

    const svc =
      catalog.find((s) => sku && s.sku === sku) ||
      catalog.find((s) => id && String(s.id) === id) ||
      catalog.find((s) => name && s.name.toLowerCase() === name);

    if (!svc) {
      unmatched.push({ name: item?.name || "?", reason: "Not found in catalog" });
      continue;
    }
    if (!svc.travefy?.enabled) {
      unmatched.push({ name: svc.name, reason: "travefy_enabled is false in sheet" });
      continue;
    }
    if (!svc.travefy?.libraryId) {
      unmatched.push({ name: svc.name, reason: "Missing Travefy library ID in sheet" });
      continue;
    }

    matched.push({ cartItem: item, service: svc });
  }

  return { matched, unmatched };
}

/* ── handler ── */

export default async function handler(req, res) {
  // CORS for local dev (vercel dev handles it in prod automatically)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const {
      kickoffId,
      guestName,
      tripName,
      guestContact,
      cart = [],
      conciergeSummary = "",
      internalNotes = "",
    } = req.body || {};

    const publicKey = process.env.TRAVEFY_PUBLIC_KEY;
    const accessToken = process.env.TRAVEFY_ACCESS_TOKEN;

    if (!publicKey || !accessToken) {
      return res.status(500).json({
        ok: false,
        error: "Missing TRAVEFY_PUBLIC_KEY or TRAVEFY_ACCESS_TOKEN env vars",
      });
    }

    // 1. Create trip in Travefy
    const tripRes = await fetch(`${TRAVEFY_BASE_URL}/trips`, {
      method: "POST",
      headers: {
        "X-API-PUBLIC-KEY": publicKey,
        "X-USER-TOKEN": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: tripName || "New Trip",
        primaryTravelerName: guestName || "Guest",
      }),
    });

    const tripText = await tripRes.text();
    let trip = null;
    try {
      trip = tripText ? JSON.parse(tripText) : null;
    } catch (parseErr) {
      console.warn("Could not parse Travefy response:", parseErr.message);
    }

    if (!tripRes.ok) {
      return res.status(tripRes.status).json({
        ok: false,
        error: "Failed to create Travefy trip",
        travefyStatus: tripRes.status,
        travefyResponse: tripText,
      });
    }

    // 2. Match cart items → catalog → Travefy library IDs
    const catalog = await fetchCatalog();
    const { matched, unmatched } = matchCart(cart, catalog);

    const shareUrl = trip?.ShareUrlPath
      ? `https://www.travefy.com/${trip.ShareUrlPath}`
      : null;

    return res.status(200).json({
      ok: true,
      message: shareUrl
        ? `Trip creado en Travefy ✅ — ${shareUrl}`
        : "Trip creado en Travefy ✅",
      tripId: trip?.Id || null,
      verificationKey: trip?.VerificationKey || null,
      shareUrl,

      matchedServicesCount: matched.length,
      unmatchedServicesCount: unmatched.length,

      matchedServices: matched.map((m) => ({
        name: m.service.name,
        sku: m.service.sku,
        travefy_library_id: m.service.travefy.libraryId,
        travefy_library_name: m.service.travefy.libraryName,
        travefy_notes_template: m.service.travefy.notesTemplate,
        travefy_category_override: m.service.travefy.categoryOverride,
      })),
      unmatchedServices: unmatched,

      receivedPayload: {
        kickoffId: kickoffId || null,
        guestName: guestName || "",
        tripName: tripName || "",
        guestContact: guestContact || "",
        cartCount: Array.isArray(cart) ? cart.length : 0,
        conciergeSummary,
        internalNotes,
      },
    });
  } catch (err) {
    console.error("travefy-send error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
