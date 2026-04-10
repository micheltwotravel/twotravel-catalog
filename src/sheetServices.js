// src/sheetServices.js
import Papa from "papaparse";



/* ============================================================
   1) CATÁLOGO – CSV (SIGUE IGUAL)
   ============================================================ */

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNGpwNTGIWfyOOxSIFZgTdstPVL53Qhu_jUA1THG3J69YRdWI8SUsj4wHQsVOer2ykFzLMk2SozHuQ/pub?gid=190949837&single=true&output=csv";

function parseNum(v) {
  const n = Number((v || "").toString().replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : n;
}
function toDirectImageUrl(url) {
  if (!url) return "";

  const str = String(url).trim();

  // caso file/d/
  if (str.includes("drive.google.com/file/d/")) {
    const match = str.match(/\/file\/d\/([^/]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }

  // caso open?id=
  if (str.includes("id=")) {
    const match = str.match(/[?&]id=([^&]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    }
  }

  return str;
}
function normalizeDriveImage(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  // si no es drive → úsala normal
  if (!raw.includes("drive.google.com")) return raw;

  // ❌ carpetas no sirven
  if (raw.includes("/folders/")) return "";

  // sacar ID del archivo
  const match =
    raw.match(/\/file\/d\/([^/]+)/) ||
    raw.match(/[?&]id=([^&]+)/);

  const id = match?.[1];
  if (!id) return "";

  // 🔥 URL que SIEMPRE funciona
  return `https://lh3.googleusercontent.com/d/${id}`;
}

function splitHighlights(value) {
  return String(value || "")
    .split(/\/|;|\||,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapRowToService(row, index) {
  const extraImages = [
  row["5"],
  row["6"],
  row["7"],
  row["8"],
  row["9"],
]
  .map((x) => normalizeDriveImage(x))
  .map((x) => toDirectImageUrl(x))
  .filter(Boolean);

const video1 = row.video1 || "";
  return {
    
    id: parseNum(row.id || index + 1),
    sku: row.sku || "",
    name: row.name || "",
    category: row.category || "services",
    subcategory: row.subcategory || "",
    images: extraImages,
video1: video1,

    price_cop: parseNum(row.price_cop),
    price_tier_1: parseNum(row.price_tier_1),
    price_tier_2: parseNum(row.price_tier_2),

    priceUnit: row.priceUnit || "per person",
    image: toDirectImageUrl(normalizeDriveImage(row.image)),

    description: {
      es: row.description_es || "",
      en: row.description_en || "",
    },
    
    travefy: {
  libraryId: row["travefy library id"] || "",
  libraryName: row["travefy library name"] || "",
  enabled: String(row["travefy enabled"] || "").trim().toLowerCase() === "true",
  notesTemplate: row["travefy notes template"] || "",
  categoryOverride: row["travefy category override"] || "",
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
        .replace(/\ufeff/g, ""), // quita BOM
  });

  return parsed.data.map(mapRowToService);
}

export { fetchCatalogFromSheet as fetchServicesFromSheet };

export async function fetchKickoffById(kickoffId) {
  const json = await postToKickoffAPI({
    action: "getKickoffById",
    id: kickoffId,
  });

  return json.data;
}
/* ============================================================
   2) KICKOFFS – REAL (Apps Script Web App)
   ============================================================ */
/* ============================================================
   2) KICKOFFS – REAL (Apps Script Web App)
   ============================================================ */

const KICKOFF_API_URL =
  "https://script.google.com/macros/s/AKfycbyS-in9MQit54ZVujzwkKBwppWpr3d4FZx0LrR9jg2Z4p7FJ80y3au9rzcbEOVmLjHy/exec";



async function postToKickoffAPI(bodyObj) {
  const res = await fetch(KICKOFF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(bodyObj),
  });

  const text = await res.text();
  console.log("KICKOFF STATUS:", res.status);
console.log("KICKOFF RAW RESPONSE:", text);



  let json = null;
  try {
    json = JSON.parse(text);
  } catch (parseErr) {
    console.warn("Could not parse API response as JSON:", parseErr.message, "| Raw:", text?.slice(0, 200));
  }

  if (!res.ok) throw new Error(json?.error || text || "Error en API kickoffs");
  if (json?.ok === false) throw new Error(json?.error || "Error en API kickoffs");

  return json;
}




/**
 * Trae todos los kickoffs desde el Sheet
 * Retorna un array:
 * [{ id, guestName, tripName, createdAt, status, conciergeSummary, travifyText, internalNotes, cart }]
 */
export async function fetchKickoffsFromSheet() {
  const json = await postToKickoffAPI({ action: "listKickoffs" });

  let data = [];

  if (!json) data = [];
  else if (Array.isArray(json)) data = json;
  else if (Array.isArray(json.data)) data = json.data;

  console.log("RAW KICKOFFS FROM API:", data);

  return data.map((k) => ({
    ...k,
    guestContact: String(
      k?.guestContact ??
      k?.GuestContact ??
      k?.guest_contact ??
      k?.contact ??
      k?.Contact ??
      k?.contacto ??
      k?.Contacto ??
      ""
    ).trim(),
    clientType: Number(k?.clientType || 1),
  }));
}


/**
 * Guarda un kickoff nuevo en el Sheet
 * payload debe parecerse a:
 * { guestName, tripName, status, conciergeSummary, travifyText, internalNotes, cart }
 */
export async function saveKickoffToSheet(payload) {
  const json = await postToKickoffAPI({ action: "saveKickoff", payload });

  // Algunos backends devuelven { ok:true, id:"..." }
  // Otros devuelven { ok:true, data:{ id:"..." } }
  const id = json?.id || json?.data?.id;

  if (!id) {
    console.error("saveKickoff response (sin id):", json);
    throw new Error("Faltó ID en la respuesta del backend");
  }

  // Devuelve siempre en formato consistente
  return { ...json, id };
}

/**
 * Actualiza un kickoff existente
 * updates puede incluir:
 * { guestName, tripName, status, conciergeSummary, travifyText, internalNotes, cart }
 */
export async function updateKickoffInSheet(id, updates) {
  const json = await postToKickoffAPI({
    action: "updateKickoff",
    id,
    updates,
  });

  console.log("UPDATE KICKOFF RESPONSE:", json);

  return json.ok === true || json?.ok === undefined;
}

/**
 * Borra un kickoff por id
 */
export async function deleteKickoff(id) {
  const json = await postToKickoffAPI({ action: "deleteKickoff", id });
  return json.ok === true;
}
