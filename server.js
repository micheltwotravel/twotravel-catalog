import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";
import Papa from "papaparse";
dotenv.config();

const REQUIRED_ENV_VARS = [
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_CLIENT_EMAIL",
  "GOOGLE_SHEET_ID",
  "TRAVEFY_PUBLIC_KEY",
  "TRAVEFY_ACCESS_TOKEN",
];
const missingEnvVars = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.warn(
    `⚠️  Missing environment variables: ${missingEnvVars.join(", ")}\n` +
    `   Some features (Google Sheets, Travefy) will not work until these are set in .env`
  );
}

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const TRAVEFY_BASE_URL = "https://api.travefy.com/api/v1";
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNGpwNTGIWfyOOxSIFZgTdstPVL53Qhu_jUA1THG3J69YRdWI8SUsj4wHQsVOer2ykFzLMk2SozHuQ/pub?gid=190949837&single=true&output=csv";

/* =========================
   Helpers
========================= */

function getTripShareUrl(trip) {
  if (!trip?.ShareUrlPath) return null;
  return `https://www.travefy.com/${trip.ShareUrlPath}`;
}

function parseNum(v) {
  const n = Number((v || "").toString().replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function splitHighlights(value) {
  return String(value || "")
    .split(/\/|;|\||,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function mapSheetRowToService(row, index) {
  return {
    id: parseNum(row.id || index + 1),
    sku: String(row.sku || "").trim(),
    name: row.name || "",
    category: row.category || "services",
    subcategory: row.subcategory || "",

    price_cop: parseNum(row.price_cop),
    price_tier_1: parseNum(row.price_tier_1),
    price_tier_2: parseNum(row.price_tier_2),

    priceUnit: row.priceUnit || "per person",

    description: {
      es: row.description_es || "",
      en: row.description_en || "",
    },

    capacity: {
      min: parseNum(row.capacity_min || 1),
      max: parseNum(row.capacity_max || 10),
    },

    capacity_notes: row.capacity_notes || "",
    vehicle_type: row.vehicle_type || "",
    route: row.route || "",
    schedule: row.schedule || "",
    duration: row.duration || "",
    location: row.location || "",
    highlights: splitHighlights(row.highlights),

    deposit: row.deposit || "",
    cancellation: row.cancellation || "",
    menuUrl: row.menuUrl || "",
    mapsUrl: row.mapsUrl || "",
    clientType: row.clientType || "",

    itinerary_type: row.itinerary_type || "",
    default_time_slot: row.default_time_slot || "",

    travefy: {
  rawEnabled: row["travefy enabled"],
  rawLibraryId: row["travefy library id"],
  libraryId: String(row["travefy library id"] || "").trim(),
  libraryName: String(row["travefy library name"] || "").trim(),
  enabled: ["true", "1", "yes", "si", "sí"].includes(
    String(row["travefy enabled"] || "").trim().toLowerCase()
  ),
  notesTemplate: row["travefy notes template"] || "",
  categoryOverride: row["travefy category override"] || "",
},
  };
}
async function fetchCatalogFromSheet() {
  const response = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el catálogo: ${response.status}`);
  }

  const csvText = await response.text();

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) =>
      String(h || "")
        .trim()
        .toLowerCase()
        .replace(/\ufeff/g, ""),
  });

  if (parsed.errors?.length) {
    console.log("PAPA PARSE ERRORS:", parsed.errors);
  }

  return parsed.data.map(mapSheetRowToService);
}

function normalizeCartItemKey(item) {
  return {
    sku: String(item?.sku || "").trim(),
    id: String(item?.id || "").trim(),
    name: String(item?.name || "").trim().toLowerCase(),
  };
}

function buildMatchedCartServices(cart, catalog) {
  const matched = [];
  const unmatched = [];

  for (const item of Array.isArray(cart) ? cart : []) {
    const key = normalizeCartItemKey(item);

    const service =
      catalog.find((s) => key.sku && s.sku === key.sku) ||
      catalog.find((s) => key.id && String(s.id) === key.id) ||
      catalog.find((s) => key.name && s.name.trim().toLowerCase() === key.name);

    if (!service) {
      unmatched.push({
        cartItem: item,
        reason: "No se encontró en el catálogo",
      });
      continue;
    }

    if (!service.travefy?.enabled) {
      unmatched.push({
        cartItem: item,
        service,
        reason: "El servicio existe pero travefy_enabled no está activo",
      });
      continue;
    }

    if (!service.travefy?.libraryId) {
      unmatched.push({
        cartItem: item,
        service,
        reason: "Falta travefy_library_id",
      });
      continue;
    }

    matched.push({
      cartItem: item,
      service,
      travefyMapping: {
        libraryId: service.travefy.libraryId,
        libraryName: service.travefy.libraryName,
        notesTemplate: service.travefy.notesTemplate,
        categoryOverride: service.travefy.categoryOverride,
      },
    });
  }

  return { matched, unmatched };
}

async function createTravefyTrip({ guestName, tripName }) {
  const response = await fetch(`${TRAVEFY_BASE_URL}/trips`, {
    method: "POST",
    headers: {
      "X-API-PUBLIC-KEY": process.env.TRAVEFY_PUBLIC_KEY,
      "X-USER-TOKEN": process.env.TRAVEFY_ACCESS_TOKEN,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name: tripName || "Test Trip",
      primaryTravelerName: guestName || "Guest",
    }),
  });

  const raw = await response.text();

  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  return {
    ok: response.ok,
    status: response.status,
    raw,
    data,
  };
}

/* =========================
   Test endpoints
========================= */

app.get("/api/test", async (req, res) => {
  try {
    const result = await fetch("http://localhost:3001/api/travefy/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        guestName: "Michel",
        tripName: "Test automático",
        cart: [
          { sku: "TRANS-001" },
          { sku: "TOUR-012" }
        ]
      }),
    });

    const data = await result.json();

    res.json(data);
  } catch (error) {
    res.json({ error: error.message });
  }
});

app.get("/api/travefy/test", async (req, res) => {
  try {
    const response = await fetch(`${TRAVEFY_BASE_URL}/secureEcho`, {
      method: "GET",
      headers: {
        "X-API-PUBLIC-KEY": process.env.TRAVEFY_PUBLIC_KEY,
        "X-API-PRIVATE-KEY": process.env.TRAVEFY_PRIVATE_KEY,
        Accept: "application/json",
      },
    });

    const text = await response.text();
    return res.status(response.status).send(text);
  } catch (error) {
    console.error("Error probando Travefy:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/travefy/users", async (req, res) => {
  try {
    const response = await fetch(`${TRAVEFY_BASE_URL}/users`, {
      method: "GET",
      headers: {
        "X-API-PUBLIC-KEY": process.env.TRAVEFY_PUBLIC_KEY,
        "X-API-PRIVATE-KEY": process.env.TRAVEFY_PRIVATE_KEY,
        Accept: "application/json",
      },
    });

    const text = await response.text();

    console.log("USERS STATUS:", response.status);
    console.log("USERS BODY:", text);

    return res.status(response.status).send(text);
  } catch (error) {
    console.error("Error obteniendo users:", error);
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/travefy/create-test-trip", async (req, res) => {
  try {
    const result = await createTravefyTrip({
      guestName: "Mauro",
      tripName: "Wedding Concierge Test",
    });

    console.log("CREATE TEST TRIP STATUS:", result.status);
    console.log("CREATE TEST TRIP BODY:", result.raw);

    return res.status(result.status).send(result.raw);
  } catch (error) {
    console.error("Error creando trip test:", error);
    return res.status(500).json({ error: error.message });
  }
});

const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "")
  .replace(/^"|"$/g, "")
  .replace(/\\n/g, "\n")
  .trim();

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: privateKey,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
/* =========================
   Main endpoint
========================= */

app.post("/api/travefy/send", async (req, res) => {
  try {
    const {
      kickoffId,
      guestName,
      tripName,
      guestContact,
      cart = [],
      conciergeSummary = "",
      internalNotes = "",
    } = req.body;

    const result = await createTravefyTrip({ guestName, tripName });

    console.log("SEND STATUS:", result.status);
    console.log("SEND BODY:", result.raw);

    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: "No se pudo crear el trip en Travefy",
        travefyResponse: result.raw || null,
      });
    }

    const trip = result.data;
    const catalog = await fetchCatalogFromSheet();
    const { matched, unmatched } = buildMatchedCartServices(cart, catalog);

    return res.status(200).json({
      ok: true,
      message: "Trip creado en Travefy correctamente",
      tripId: trip?.Id || null,
      verificationKey: trip?.VerificationKey || null,
      shareUrlPath: trip?.ShareUrlPath || null,
      shareUrl: getTripShareUrl(trip),
      trip,

      matchedServicesCount: matched.length,
      unmatchedServicesCount: unmatched.length,

      matchedServices: matched.map((m) => ({
        sku: m.service.sku,
        name: m.service.name,
        category: m.service.category,
        itinerary_type: m.service.itinerary_type,
        default_time_slot: m.service.default_time_slot,
        travefy_library_id: m.travefyMapping.libraryId,
        travefy_library_name: m.travefyMapping.libraryName,
        travefy_notes_template: m.travefyMapping.notesTemplate,
        travefy_category_override: m.travefyMapping.categoryOverride,
      })),

      unmatchedServices: unmatched.map((u) => ({
  cartItem: u.cartItem,
  reason: u.reason,
  sku: u.service?.sku || "",
  name: u.service?.name || "",
  debug_travefy_enabled: u.service?.travefy?.enabled,
  debug_travefy_library_id: u.service?.travefy?.libraryId || "",
  debug_raw_travefy_enabled: u.service?.travefy?.rawEnabled,
  debug_raw_travefy_library_id: u.service?.travefy?.rawLibraryId,
})),
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
  } catch (error) {
    console.error("Error Travefy /send:", error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

/* =========================
   Feedback
========================= */

app.post("/api/feedback/save", async (req, res) => {
  try {
    const {
      kickoffId,
      guestName,
      tripName,
      destination,
      concierge,
      occasion,
      overallExperience,
      overallReason,
      oneThing,
      organization,
      availability,
      preparedFactor,
      propertyRating,
      propertyNotes,
      speed,
      problemSolving,
      service,
      stayNotes,
      submittedAt,
    } = req.body || {};

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "feedback!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          submittedAt || new Date().toISOString(),
          kickoffId || "",
          guestName || "",
          tripName || "",
          destination || "",
          concierge || "",
          occasion || "",
          overallExperience || "",
          overallReason || "",
          oneThing || "",
          organization || "",
          availability || "",
          preparedFactor || "",
          propertyRating || "",
          propertyNotes || "",
          speed || "",
          problemSolving || "",
          service || "",
          stayNotes || "",
        ]],
      },
    });

    return res.json({
      ok: true,
      message: "Feedback saved successfully",
    });
  } catch (error) {
    console.error("FEEDBACK SAVE ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to save feedback",
    });
  }
});

/* =========================
   Listen
========================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});