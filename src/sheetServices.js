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

  // Already a thumbnail/uc URL → return as-is
  if (raw.includes("drive.google.com/thumbnail") || raw.includes("drive.google.com/uc")) return raw;

  // si no es drive → úsala normal (cualquier https:// funciona)
  if (!raw.includes("drive.google.com")) return raw;

  // ❌ carpetas no sirven
  if (raw.includes("/folders/")) return "";

  // sacar ID del archivo
  const match =
    raw.match(/\/file\/d\/([^/?]+)/) ||
    raw.match(/[?&]id=([^&]+)/);

  const id = match?.[1];
  if (!id) return "";

  // uc?export=view — original format that worked for all categories
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

function splitHighlights(value) {
  return String(value || "")
    .split(/\/|;|\||,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapRowToService(row, index) {
  // Sheet headers (after PapaParse lowercasing):
  // Primary: "image_source"  (col AF in screenshot)
  // Extra:   "image 5", "image 6", "image 7", "image 8", "image 9"
  // Legacy fallbacks: "5","6","7","8","9" or "image2"..."image6"
  // Extra images — sheet headers are "image 5".."image 9" (with space, lowercased by PapaParse)
  // Also try underscore variant in case the sheet uses that, plus legacy numeric names.
  const extraImages = [
    row["image 5"] || row["image_5"] || row["image5"] || row["5"],
    row["image 6"] || row["image_6"] || row["image6"] || row["6"],
    row["image 7"] || row["image_7"] || row["image7"] || row["7"],
    row["image 8"] || row["image_8"] || row["image8"] || row["8"],
    row["image 9"] || row["image_9"] || row["image9"] || row["9"],
  ]
    .map((x) => normalizeDriveImage(x || ""))
    .filter(Boolean);

const rawVideo = row.video1 || row["video 1"] || row.video || row.video_url || row["video_1"] || "";
  // Convert Google Drive share URLs to direct/embed-friendly URLs
  const video1 = (() => {
    const v = String(rawVideo).trim();
    if (!v) return "";
    const m = v.match(/\/file\/d\/([^/]+)/) || v.match(/[?&]id=([^&]+)/);
    if (m?.[1]) return `https://drive.google.com/uc?export=download&id=${m[1]}`;
    return v;
  })();
  return {
    
    id: parseNum(row.id || index + 1),
    sku: row.sku || "",
    name: row.name || "",
    name_en: row.name_en || row.nombre_en || "",
    category: row.category || "services",
    subcategory: row.subcategory || "",
    subcategory_en: row.subcategory_en || "",
    city: (row.city || row.ciudad || row.destination || row.destino || "").trim().toLowerCase(),
    images: extraImages,
video1: video1,

    price_cop: parseNum(row.price_cop),
    price_tier_1: parseNum(row.price_tier_1),
    price_tier_2: parseNum(row.price_tier_2),

    priceUnit: row.priceUnit || "per person",
    // Each source is normalized independently so a folder URL in image_source
    // doesn't block the fallback to row.image (which restaurants use).
    image: normalizeDriveImage(row["image_source"] || row["image source"] || "") ||
           normalizeDriveImage(row.image || row.img || "") ||
           "",

    description: {
      es: row.description_es || "",
      en: row.description_en || "",
    },
    
    travefy: {
      // Sheet usa underscores: travefy_library_id, travefy_enabled, etc.
      libraryId: String(
        row["travefy_library_id"] || row["travefy library id"] || ""
      ).trim(),
      libraryName: String(
        row["travefy_library_name"] || row["travefy library name"] || ""
      ).trim(),
      enabled: ["true", "1", "yes"].includes(
        String(
          row["travefy_enabled"] ?? row["travefy enabled"] ?? ""
        ).trim().toLowerCase()
      ),
      notesTemplate: String(
        row["travefy_notes_template"] || row["travefy notes template"] || ""
      ).trim(),
      categoryOverride: String(
        row["travefy_category_override"] || row["travefy category override"] || ""
      ).trim(),
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
    location_en: row.location_en || "",

    // Bilingual highlights:
    // Sheet columns: "highlights" (Spanish/default), "highlights_en" (English)
    // "highlights_es" also accepted as alias for "highlights"
    highlights: splitHighlights(row.highlights_es || row.highlights),
    highlights_en: splitHighlights(row.highlights_en || ""),
    // Helper: call getHighlights(service, lang) to get the right one with fallback


    quickbooksCode: row.quickbooks_code || row.quickbooks || row.billing_code || row.qb_code || "",

    deposit: row.deposit || "",
    cancellation: row.cancellation || "",
    menuUrl:   row.menuurl   || row.menu_url   || row["menu url"]   || row.menuUrl   || "",
    mapsUrl:   row.mapsurl   || row.maps_url   || row["maps url"]   || row.mapsUrl   || "",
    // Dress code — shown for bars & nightlife with 👔 icon
    dressCode: row.dress_code || row["dress code"] || row.dresscode || row.codigo_vestimenta || "",
    dressCode_en: row.dress_code_en || row["dress code en"] || "",
    clientType: row.clientType || "",
    family_friendly:
      ["true", "1", "yes", "si", "sí"].includes(
        String(row.family_friendly || row["family friendly"] || "")
          .trim()
          .toLowerCase()
      ),
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

/**
 * getHighlights(service, lang)
 * Returns the correct highlights array for the given language.
 * Falls back to Spanish highlights if English not available.
 * Usage: getHighlights(service, "en") or getHighlights(service, "es")
 *
 * Sheet columns needed:
 *   highlights    — Spanish highlights (required, current column)
 *   highlights_en — English highlights (optional, add when ready)
 */
export function getHighlights(service, lang = "en") {
  if (!service) return [];
  if (lang === "en") {
    const en = service.highlights_en || [];
    if (en.length > 0) return en;
    // Fallback: use Spanish highlights (better than nothing)
    return service.highlights || [];
  }
  return service.highlights || [];
}

// fetchConciergesFromSheet: pendiente hasta que exista pestaña "Concierges" con GID conocido.
// Por ahora concierges se asignan manualmente con campos de texto libre.

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
