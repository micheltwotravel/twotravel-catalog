// src/sheetServices.js
import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";



/* ============================================================
   1) CATÁLOGO – CSV (SIGUE IGUAL)
   ============================================================ */

const SHEET_CSV_URL = "/api/catalog-csv";

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
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }
  }

  // caso open?id=
  if (str.includes("id=")) {
    const match = str.match(/[?&]id=([^&]+)/);
    if (match?.[1]) {
      return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
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

  // thumbnail format — renders directly in <img> without Google's redirect warning
  return `https://drive.google.com/thumbnail?id=${id}&sz=w800`;
}

function splitHighlights(value) {
  // Split on newlines or semicolons ONLY — commas are preserved inside each item
  // Sheet format: "Private tour; Includes: transport, entrance fees, and guide"
  //   → ["Private tour", "Includes: transport, entrance fees, and guide"]
  return String(value || "")
    .split(/\n|;|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeCat(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (!v) return "services";
  if (/chef|private.?chef|chef.?privado/.test(v)) return "chef";
  if (/restauran|comida|food|dining/.test(v)) return "restaurants";
  if (/beach.?club|playa|clubes?.de.?playa/.test(v)) return "beach-clubs";
  if (/\btours?\b|activid|activit|excursion/.test(v)) return "tours";
  if (/transport|transfer|traslado|van\b|suv\b|vehiculo/.test(v)) return "transportation";
  // nightlife: bars/bares/bars (word boundary), rooftops, lounges, vida nocturna, cocktails
  // Note: \bbars?\b matches "bar" and "bars"; bares catches Spanish plural
  if (/night|nocturna|nocturn|noche|discoteca|\bclub\b|\bbars?\b|bares|cocteleria|rooftop|lounge|cocktail/.test(v)) return "nightlife";
  if (/serv/.test(v)) return "services";
  return "services"; // safe fallback
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
    subcategory: row.subcategory || "",
    subcategory_en: row.subcategory_en || "",
    // Prefer category_es (already the normalized English key the sheet has),
    // then fall back to the Spanish display name and normalize it.
    // Override: if name contains "chef" but category resolved to services → reclassify to chef
    category: (() => {
      const cat = normalizeCat(
        row.category_es || row.category_en ||
        row.category    || row.Category    || row.categoria || ""
      );
      const nameText = (row.name_en || row.name || "").toLowerCase();
      if (cat === "services" && /chef/.test(nameText)) return "chef";
      return cat;
    })(),
    city: (row.city || row.ciudad || row.destination || row.destino || "").trim().toLowerCase(),
    images: extraImages,
video1: video1,

    priceLevel: (row["$$$"] || row.price_level || row.nivel_precio || "").trim(),
    // price_cop no existe en el sheet — usar price_tier_1 como base
    price_cop: parseNum(row.price_cop || row.price_tier_1),
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
    route: row.route || row.route_detail || "",

    schedule:    row.schedule    || "",
    schedule_es: row.schedule_es || row.horarios_es || row.horario_es || row.horario || "",
    duration:    row.duration    || "",
    duration_es: row.duration_es || row.duracion_es || row.duracion   || "",
    location:    row.location    || "",           // English
    location_es: row.location_es || row.location  || "", // Spanish

    // Bilingual highlights:
    // Sheet columns: "highlights" (Spanish/default), "highlights_en" (English)
    // "highlights_es" also accepted as alias for "highlights"
    highlights: splitHighlights(row.highlights_es || row.highlights),
    highlights_en: splitHighlights(row.highlights_en || ""),
    // Helper: call getHighlights(service, lang) to get the right one with fallback


    quickbooksCode: row.quickbooks_code || row.quickbooks || row.billing_code || row.qb_code || "",

    deposit:    row.deposit_en || row.deposit || "",    // English
    deposit_es: row.deposit_es || row.deposit || "",    // Spanish
    cancellation:    row.cancellation || "",            // English
    cancellation_es: row.cancellation_es || "",         // Spanish
    priceTiers:    row.pricetiers    || row.price_tiers    || "",
    priceTiers_en: row.pricetiers_en || row.price_tiers_en || "",
    menuUrl:   row.menuurl   || row.menu_url   || row["menu url"]   || row.menuUrl   || "",
    mapsUrl:   row.mapsurl   || row.maps_url   || row["maps url"]   || row.mapsUrl   || "",
    // Dress code — dress_code = español · dress_code_en = inglés
    dressCode:    row.dress_code    || row["dress code"]    || row.dresscode || "",
    dressCode_en: row.dress_code_en || row["dress code en"] || "",
    clientType: row.clientType || "",
    family_friendly:
      ["true", "1", "yes", "si", "sí"].includes(
        String(row.family_friendly || row["family friendly"] || "")
          .trim()
          .toLowerCase()
      ),
    vegetarian:
      ["true", "1", "yes", "si", "sí"].includes(
        String(row.vegetarian || row.vegetariano || row["veggie"] || "")
          .trim()
          .toLowerCase()
      ),
    accessibility:
      ["true", "1", "yes", "si", "sí"].includes(
        String(row.accessibility || row.accesible || row.accesibilidad || row["wheelchair"] || "")
          .trim()
          .toLowerCase()
      ),
  };
}

const CATALOG_CACHE_KEY = "tt_catalog_v1";
const CATALOG_CACHE_TTL = 10 * 60 * 1000;
let _catalogPromise = null;

async function fetchCatalogFromSheet() {
  if (_catalogPromise) return _catalogPromise;
  try {
    const cached = sessionStorage.getItem(CATALOG_CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CATALOG_CACHE_TTL) return data;
    }
  } catch {}

  _catalogPromise = (async () => {
    const sep = SHEET_CSV_URL.includes("?") ? "&" : "?";
    const response = await fetch(`${SHEET_CSV_URL}${sep}t=${Date.now()}`);
    if (!response.ok) throw new Error(`No se pudo cargar el catálogo: ${response.status}`);
    const csvText = await response.text();
    // Row 2 is a Spanish display header row \u2014 strip it before parsing
    const lines = csvText.split("\n");
    const cleaned = lines.length > 1 ? [lines[0], ...lines.slice(2)].join("\n") : csvText;
    const parsed = Papa.parse(cleaned, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => String(h || "").trim().toLowerCase().replace(/\ufeff/g, ""),
    });
    const result = parsed.data.map(mapRowToService);
    try { sessionStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
    _catalogPromise = null;
    return result;
  })().catch(e => { _catalogPromise = null; throw e; });

  return _catalogPromise;
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

/* ============================================================
   2) KICKOFFS – SUPABASE
   ============================================================ */

const KICKOFFS_CACHE_KEY = "tt_kickoffs_cache";
const KICKOFFS_CACHE_TTL = 90 * 1000;

export function invalidateKickoffsCache() {
  try { sessionStorage.removeItem(KICKOFFS_CACHE_KEY); } catch {}
}

function normalizeKickoff(row) {
  const k = { id: row.id, ...row.data };
  const parseJsonArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) { try { return JSON.parse(v); } catch {} }
    return [];
  };
  const sheetsTimeToLabel = (v) => {
    if (!v || typeof v !== "string") return v;
    if (!v.includes("T") || !v.startsWith("1899")) return v;
    try { return new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); } catch { return v; }
  };
  return {
    ...k,
    city: String(k.city || k.Ciudad || k.ciudad || k.destination || k.destino || k.Destination || "").trim(),
    cart:    parseJsonArr(k.cart),
    dayMeta: parseJsonArr(k.dayMeta ?? k.day_meta),
    checkIn:  sheetsTimeToLabel(k.checkIn),
    checkOut: sheetsTimeToLabel(k.checkOut),
    guestContact: String(k?.guestContact ?? k?.GuestContact ?? k?.guest_contact ?? k?.contact ?? k?.Contact ?? k?.contacto ?? k?.Contacto ?? "").trim(),
    mainContact: String(k?.mainContact ?? k?.main_contact ?? k?.MainContact ?? k?.whatsapp ?? k?.Whatsapp ?? k?.conciergePhone ?? "").trim(),
    accommodationMapsUrl: String(k?.accommodationMapsUrl ?? k?.accommodation_maps_url ?? k?.accommodationMap ?? k?.villaMap ?? k?.house_map ?? "").trim(),
    clientType: Number(k?.clientType || 1),
  };
}

export async function fetchKickoffById(kickoffId) {
  try {
    const raw = sessionStorage.getItem(KICKOFFS_CACHE_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < KICKOFFS_CACHE_TTL) {
        const found = data.find(k => String(k.id).trim() === String(kickoffId).trim());
        if (found) return found;
      }
    }
  } catch {}
  const { data, error } = await supabase.from("kickoffs").select("*").eq("id", kickoffId).single();
  if (error) throw new Error(error.message);
  return normalizeKickoff(data);
}

export async function fetchKickoffsFromSheet({ forceRefresh = false } = {}) {
  if (!forceRefresh) {
    try {
      const raw = sessionStorage.getItem(KICKOFFS_CACHE_KEY);
      if (raw) {
        const { ts, data } = JSON.parse(raw);
        if (Date.now() - ts < KICKOFFS_CACHE_TTL) return data;
      }
    } catch {}
  }
  const { data, error } = await supabase.from("kickoffs").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const result = (data || []).map(normalizeKickoff);
  try { sessionStorage.setItem(KICKOFFS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
  return result;
}

export async function saveKickoffToSheet(payload) {
  invalidateKickoffsCache();
  const id = payload.id || `k_${Date.now()}`;
  const { error } = await supabase.from("kickoffs").insert({ id, data: { ...payload, id } });
  if (error) throw new Error(error.message);
  return { ok: true, id };
}

export async function updateKickoffInSheet(id, updates) {
  invalidateKickoffsCache();
  const { data: existing, error: fetchErr } = await supabase.from("kickoffs").select("data").eq("id", id).single();
  if (fetchErr) throw new Error(fetchErr.message);
  const merged = { ...(existing?.data || {}), ...updates };
  const { error } = await supabase.from("kickoffs").update({ data: merged }).eq("id", id);
  if (error) throw new Error(error.message);
  return true;
}

// "Itinerary (no catalog)" sheet — same catalog spreadsheet, gid 1985577388
const ITINERARY_ITEMS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1r_QvYqNLBybjL1iZYuW4mp3D3vde5rqSDBqTnEbDePk/export?format=csv&gid=1985577388";

const ITINERARY_ITEMS_CACHE_KEY = "tt_itinerary_items_v1";
let _itineraryItemsPromise = null;

export async function fetchItineraryItems() {
  if (_itineraryItemsPromise) return _itineraryItemsPromise;
  try {
    const cached = sessionStorage.getItem(ITINERARY_ITEMS_CACHE_KEY);
    if (cached) {
      const { ts, data } = JSON.parse(cached);
      if (Date.now() - ts < CATALOG_CACHE_TTL) return data;
    }
  } catch {}

  _itineraryItemsPromise = (async () => {
    const response = await fetch(`${ITINERARY_ITEMS_CSV_URL}&t=${Date.now()}`);
    if (!response.ok) throw new Error(`Itinerary items HTTP ${response.status}`);
    const csvText = await response.text();
    // No display-label row in this sheet — parse directly
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => String(h || "").trim().toLowerCase().replace(/﻿/g, ""),
    });
    const result = parsed.data
      .map(row => ({
        sku: row.sku || "",
        name_en: row["item name"] || "",
        name_es: row["item nombre$"] || "",
        description: row.description || "",
        description_es: row["descripcion esp"] || "",
        image: normalizeDriveImage(row.image || ""),
      }))
      .filter(row => row.name_en || row.name_es);
    try { sessionStorage.setItem(ITINERARY_ITEMS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: result })); } catch {}
    _itineraryItemsPromise = null;
    return result;
  })().catch(e => { _itineraryItemsPromise = null; throw e; });

  return _itineraryItemsPromise;
}

export async function fetchCheckinResponses(kickoffId) {
  const res = await fetch(KICKOFF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "getCheckinResponses", payload: { kickoffId } }),
  });
  const json = await res.json();
  return json.ok ? (json.data || []) : [];
}

export async function uploadImageToDrive(file) {
  const res = await fetch("/api/upload-image", {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  const json = await res.json();
  if (json.ok) return json.url;
  throw new Error(json.error || "Upload failed");
}

/**
 * Borra un kickoff por id
 */
export async function deleteKickoff(id) {
  invalidateKickoffsCache();
  const json = await postToKickoffAPI({ action: "deleteKickoff", id });
  return json.ok === true;
}
