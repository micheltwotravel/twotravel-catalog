import React, { useEffect, useMemo, useRef, useState } from "react";
import { AvailabilityManager } from "./BookingPage";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const TASK_API_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

import {
  fetchKickoffsFromSheet,
  fetchItineraryItems,
  fetchServicesFromSheet,
  updateKickoffInSheet,
  deleteKickoff,
  saveKickoffToSheet,
  uploadImageToDrive,
} from "./sheetServices";

import {
  Search,
  RefreshCcw,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Clock,
  X,
} from "lucide-react";



/* =========================================
   Slack billing — PDF upload
   ========================================= */
const SLACK_BOT_TOKEN = import.meta.env.VITE_SLACK_BOT_TOKEN || "";
const SLACK_CHANNEL_ID = import.meta.env.VITE_SLACK_CHANNEL_ID || "C094NE421NV";
const BILLING_GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

// ── Yachts & Speedboats PDF ──────────────────────────────────────────────────
// TODO: upload YATCH & SPEEDBOATS.pdf to Google Drive → share "Anyone with link"
//       then paste the share link here
const YACHTS_PDF_URL = "https://drive.google.com/file/d/REPLACE_WITH_YOUR_DRIVE_FILE_ID/view?usp=sharing";

// Categories that NEVER get a QB code (restaurants, bars, nightlife, beach clubs)
const NO_QB = new Set(["restaurants","bars","nightlife","beach-clubs","beach clubs","beachclubs"]);
// Categories where price × pax (tours, services, chef)
const PAX_MULTIPLIES = new Set(["tours","tour","services","service","chef","private chef","chef privado"]);
// Transportation is priced per vehicle — never multiply by pax
// City code → full name for PDF and QuickBooks
const CITY_NAMES = { CTG:"Cartagena", MDE:"Medellín", CDMX:"Ciudad de México", TUL:"Tulum" };

/* Branded cover photos (city photos with TW logo overlay) */
const PRESET_COVER_PHOTOS = [
  "1T0uABit7rH0pBGhBZ467_eyK4zAiQf7a",
  "14X24TXHn3YHVAJ70M1hYqGxVt4wAtob5",
  "1zvEZfCzYds90gOYIgE_4kVqe-3VnFqhH",
  "1ybdGh98iAjgJZ1HtL294FHTxxDSpRe0u",
  "1n8vXILH-ZC1yINNm2qljKo6ETjLcBwH-",
  "1f_ZzS4o5SUxq2_pPANYP9ZH8zi3pfGMT",
  "1mL1d6fzikltPfOOCqhiet9hlBkFMpoO8",
  "1JGgIP1esNThcK0jtOcdTvYz0ZMa0ZSwX",
  "10hRQFZVwZzPNAgOTS2pOSvI-XmLA43q9",
  "1bbS9G-7VbaAgdJ89rCu-L9m-AKyS-0CA",
  "1vKiUCKJagyJwK_V1HQA6X_sKeYpBmRrD",
  "1Hal7GObs16znYePvNrE8nVmwOoU0128w",
];
const cityFullName = (code) =>
  String(code||"").split(",").map(c => CITY_NAMES[c.trim().toUpperCase()] || c.trim()).filter(Boolean).join(", ");

/* ─────────────────────────────────────────────────────────────
   buildItineraryPdf / sendItineraryPdfToSlack
   mode = "slack"   → uploads PDF to Slack via GAS (default)
   mode = "preview" → opens PDF in a new browser tab
───────────────────────────────────────────────────────────── */
async function sendItineraryPdfToSlack(kickoff, lang = "en", currency = "USD", mode = "slack", fxRate = 3489) {
  const { jsPDF } = await import("jspdf");

  // ── helpers ─────────────────────────────────────────────────
  const cl = (v) => String(v ?? "").trim();
  // jsPDF Helvetica only supports Latin-1 — strip anything outside that range
  const se = (s) => String(s||"").replace(/[^\x20-\x7E\xA0-\xFF]/g, "").replace(/\s+/g," ").trim();
  // Safe wrappers — every doc.text / doc.splitTextToSize must go through these
  const dt  = (txt, x, y2, opts) => opts ? doc.text(se(String(txt||"")), x, y2, opts) : doc.text(se(String(txt||"")), x, y2);
  const sts = (txt, w) => doc.splitTextToSize(se(String(txt||"")), w);
  // Safe link: render text via dt() then add clickable area without textWithLink()
  const dtLink = (txt, x2, y2, url) => {
    const safe = se(String(txt||""));
    if (!safe) return;
    dt(safe, x2, y2);
    try {
      const w = doc.getStringUnitWidth(safe) * doc.getFontSize() / doc.internal.scaleFactor;
      const h = doc.getFontSize() / doc.internal.scaleFactor;
      doc.link(x2, y2 - h, w, h * 1.3, { url });
    } catch(e) { /* link annotation optional */ }
  };
  // Fetch image URL → base64 data URL (for jsPDF addImage); returns null on failure
  const fetchImgB64 = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise((res2) => {
        const r = new FileReader();
        r.onload = () => res2(r.result);
        r.onerror = () => res2(null);
        r.readAsDataURL(blob);
      });
    } catch { return null; }
  };

  const parseJ = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim().startsWith("[")) {
      try { return JSON.parse(v); } catch { return []; }
    }
    return [];
  };
  const fmtDate = (v) => {
    if (!v) return "—";
    try { return new Date(String(v).length === 10 ? v + "T12:00:00" : v).toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" }); }
    catch { return String(v); }
  };
  const fmtIso = (v) => {
    const s = cl(v);
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    try { return new Date(s).toISOString().slice(0, 10); } catch { return s; }
  };
  const cleanTag = (v) => cl(v).replace(/[\[\]]/g, "");
  const fmtAmt = (n) => currency === "COP"
    ? `$${Number(n).toLocaleString("es-CO", { maximumFractionDigits:0 })} COP`
    : currency === "MXN"
    ? `$${Number(n).toLocaleString("es-MX", { maximumFractionDigits:0 })} MXN`
    : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits:0 })} USD`;

  // ── parse cart + dayMeta ────────────────────────────────────
  const cart    = parseJ(kickoff.cart);
  const dayMeta = parseJ(kickoff.dayMeta || kickoff.day_meta || []);

  // ── fetch catalog & match each cart item ────────────────────
  let catalog = [];
  try { catalog = await fetchServicesFromSheet(); } catch { /* offline – show names only */ }

  const matchSvc = (item) => {
    const sku = cl(item.sku);
    const id  = cl(String(item.id ?? ""));
    const nl  = cl(item.name || item.displayName || "").toLowerCase();
    return (
      (sku && catalog.find(s => s.sku === sku)) ||
      (id  && catalog.find(s => String(s.id) === id)) ||
      (nl  && catalog.find(s => s.name.toLowerCase() === nl)) ||
      null
    );
  };

  // ── build ordered day map ───────────────────────────────────
  const rawMap = new Map();
  cart.forEach((item, idx) => {
    const key = cl(item.dayLabel || item.day || (lang === "es" ? "Itinerario" : "Itinerary"));
    if (!rawMap.has(key)) rawMap.set(key, []);
    const svc = matchSvc(item);
    rawMap.get(key).push({
      sort       : Number(item.sortOrder ?? idx),
      time       : cl(item.timeLabel || item.time || svc?.schedule || ""),
      name       : cl(lang === "en"
        ? (svc?.name_en || item.name_en || item.displayName || svc?.name || item.name || "")
        : (item.displayName || item.name || svc?.name || "")),
      location   : lang === "es"
        ? cl(svc?.location_es || svc?.location || "")
        : cl(svc?.location    || ""),
      description: lang === "es"
        ? (svc?.description?.es || item.description_es || svc?.description?.en || item.description_en || item.notes || "")
        : (svc?.description?.en || item.description_en || svc?.description?.es || item.description_es || item.notes || ""),
      highlights : svc
        ? (lang === "es" ? (svc.highlights || []) : (svc.highlights_en || []))
        : [],
      category   : cl(item.category || svc?.category || ""),
      pax        : Number(item.pax   || 0),
      priceUsd   : Number(item.priceUsd ?? 0),
      price_cop  : Number(item.priceOverride_cop ?? item.price_cop ?? 0),
      qbCode     : cl(item.quickbooksCode || svc?.quickbooksCode || ""),
    });
  });

  // Respect dayMeta order
  const metaLabels  = dayMeta.map(dm => cl(dm.label)).filter(Boolean);
  const extraLabels = [...rawMap.keys()].filter(k => !metaLabels.includes(k));
  const orderedDays = [
    ...metaLabels.filter(l => rawMap.has(l)).map(l => ({
      label: l,
      title: dayMeta.find(dm => cl(dm.label) === l)?.title || "",
    })),
    ...extraLabels.map(l => ({ label: l, title: "" })),
  ];

  // ── PDF setup ───────────────────────────────────────────────
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PW = 612, PH = 792, ML = 50, MR = 562, TW = 512;
  let y = 0;
  let pageNum = 1;

  const addMiniHeader = () => {
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.5);
    doc.line(ML, 30, MR, 30);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(180,180,180);
    dt("TWO TRAVEL", ML, 22);
    dt(cl(kickoff.guestName), PW / 2, 22, { align:"center" });
    dt(`${pageNum}`, MR, 22, { align:"right" });
  };
  const newPage = () => {
    doc.addPage(); pageNum++; y = 52; addMiniHeader();
  };
  const checkY = (need = 30) => { if (y + need > PH - 48) newPage(); };

  const checkInUrl = cl(kickoff.checkInFormUrl || "");

  // Pre-fetch photos (async, before rendering)
  const coverPhotoB64  = kickoff.coverPhotoId
    ? await fetchImgB64(`https://lh3.googleusercontent.com/d/${kickoff.coverPhotoId}`).catch(() => null)
    : null;
  const accomPhotoB64  = await fetchImgB64(driveImgUrl(cl(kickoff.accommodationPhoto  || ""))).catch(() => null);
  const accomPhotoB64_2 = await fetchImgB64(driveImgUrl(cl(kickoff.accommodationPhoto2 || ""))).catch(() => null);

  // ── COVER ───────────────────────────────────────────────────
  // Header band
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, PW, 76, "F");
  doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
  dt("TWO TRAVEL", ML, 36);
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(160,160,160);
  dt("PRIVATE CONCIERGE", ML, 54);
  dt(new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}), MR, 54, { align:"right" });

  // Cover photo hero (full-width, below header band)
  if (coverPhotoB64) {
    try {
      const imgH = 220;
      doc.addImage(coverPhotoB64, "JPEG", 0, 76, PW, imgH);
      y = 76 + imgH + 20;
    } catch(e) { y = 112; }
  } else {
    y = 112;
  }

  // Eyebrow
  doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(120,120,120);
  dt("YOUR ITINERARY", ML, y); y += 18;

  // Guest name
  doc.setFontSize(28); doc.setFont("helvetica","bold"); doc.setTextColor(12,12,12);
  dt(cl(kickoff.guestName) || "Guest", ML, y); y += 12;

  // Trip name
  if (kickoff.tripName) {
    doc.setFontSize(15); doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
    dt(cl(kickoff.tripName), ML, y + 8); y += 26;
  }
  y += 14;

  // Thin rule
  doc.setDrawColor(12,12,12); doc.setLineWidth(1.5);
  doc.line(ML, y, ML + 60, y); doc.setLineWidth(0.5); y += 22;

  // Lookup concierge phone from CONCIERGE_LIST
  const conciergePhone = (() => {
    const name = cl(kickoff.assignedConciergeName || kickoff.assignedConcierge || "");
    if (!name) return "";
    const found = CONCIERGE_LIST.find(c => c.name === name);
    return found?.phone || cl(kickoff.mainContact || "");
  })();

  // Build WhatsApp URL from concierge phone
  const waDigits = conciergePhone.replace(/[^0-9]/g, "");
  const waUrl    = waDigits ? `https://wa.me/${waDigits}` : null;

  // Build accommodation URL (Airbnb / Booking link if concierge set one)
  const accomUrl = cl(kickoff.accommodationUrl || "");

  // Detect 2-city trip
  const cityRaw   = cl(kickoff.city || "");
  const is2Cities = cityRaw.includes(",");
  const city1Code = cityRaw.split(",")[0].trim();
  const city2Code = cityRaw.split(",")[1]?.trim() || "";
  const city1Name = cityFullName(city1Code);
  const city2Name = cityFullName(city2Code);

  // Info rows — each: { label, val, url?, sub? }
  const guestsVal = (() => { const n = parseInt(cl(kickoff.groupSize||"")) || 0; if (!n) return cl(kickoff.groupSize||""); return lang === "es" ? `${n} ${n===1?"persona":"personas"}` : `${n} ${n===1?"person":"people"}`; })();
  const infoRows = [
    // Destination
    { label: lang === "es" ? "Destino" : "Destination", val: cityFullName(kickoff.city) || "" },
    { label: lang === "es" ? "Huéspedes" : "Guests",    val: guestsVal },
    // City 1 dates
    ...(is2Cities ? [{ label: (lang === "es" ? "Llegada" : "Arrival") + ` — ${city1Name}`,   val: fmtDate(kickoff.arrivalDate) }] :
                   [{ label: lang === "es" ? "Llegada"  : "Arrival",                           val: fmtDate(kickoff.arrivalDate) }]),
    ...(is2Cities ? [{ label: (lang === "es" ? "Salida"  : "Departure") + ` — ${city1Name}`, val: fmtDate(kickoff.departureDate) }] :
                   [{ label: lang === "es" ? "Salida"   : "Departure",                         val: fmtDate(kickoff.departureDate) }]),
    // City 1 accommodation
    { label: lang === "es" ? (is2Cities ? `Alojamiento — ${city1Name}` : "Alojamiento") : (is2Cities ? `Accommodation — ${city1Name}` : "Accommodation"),
      val: cl(kickoff.accommodationName || ""), sub: cl(kickoff.barrio || "") },
    { label: lang === "es" ? "Dirección" : "Address", val: cl(kickoff.accommodationAddr || ""), url: accomUrl || null },
    // City 2 dates & accommodation (only for 2-city trips)
    ...(is2Cities && kickoff.arrivalDate2 ? [
      { label: (lang === "es" ? "Llegada"  : "Arrival")   + ` — ${city2Name}`, val: fmtDate(kickoff.arrivalDate2) },
      { label: (lang === "es" ? "Salida"   : "Departure") + ` — ${city2Name}`, val: fmtDate(kickoff.departureDate2) },
      { label: lang === "es" ? `Alojamiento — ${city2Name}` : `Accommodation — ${city2Name}`,
        val: cl(kickoff.accommodationName2 || ""), sub: cl(kickoff.barrio2 || "") },
      ...(kickoff.accommodationAddr2 ? [{ label: lang === "es" ? `Dirección — ${city2Name}` : `Address — ${city2Name}`,
        val: cl(kickoff.accommodationAddr2 || ""), url: cl(kickoff.accommodationUrl2 || "") || null }] : []),
    ] : []),
    // Concierge
    { label: "Concierge",                                       val: cl(kickoff.assignedConciergeName || kickoff.assignedConcierge || ""), sub: cl(kickoff.conciergeTitle || "") },
    { label: "WhatsApp Concierge",                              val: conciergePhone, url: waUrl },
    { label: lang === "es" ? "Tu WhatsApp" : "Your WhatsApp",  val: cl(kickoff.guestContact || "") },
  ].filter(r => r.val);

  infoRows.forEach(({ label, val, url, sub }) => {
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
    dt(se(label).toUpperCase(), ML, y);
    doc.setFontSize(10.5); doc.setFont("helvetica","normal");
    if (url) {
      doc.setTextColor(30, 100, 200);
      dtLink(val, ML + 100, y, url);
    } else {
      doc.setTextColor(20, 20, 20);
      dt(se(val), ML + 100, y);
    }
    if (sub) {
      doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(130,130,130);
      dt(se(sub), ML + 100, y + 8);
      y += 8;
    }
    y += 18;
  });

  // Property photo (city 1)
  if (accomPhotoB64) {
    try {
      checkY(150);
      const imgW = TW, imgH = 140;
      doc.addImage(accomPhotoB64, "JPEG", ML, y, imgW, imgH);
      y += imgH + 10;
    } catch(e) {}
  }
  // Property photo (city 2)
  if (accomPhotoB64_2) {
    try {
      checkY(150);
      const imgW = TW, imgH = 140;
      doc.addImage(accomPhotoB64_2, "JPEG", ML, y, imgW, imgH);
      y += imgH + 10;
    } catch(e) {}
  }

  // Concierge summary / free-text block (supports TITLE, - bullet, paragraph)
  if (kickoff.conciergeSummary) {
    y += 12;
    doc.setDrawColor(230,230,230); doc.line(ML, y, MR, y); y += 16;
    doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.setTextColor(90,90,90);
    dt(lang === "es" ? "NOTAS DE TU CONCIERGE" : "FROM YOUR CONCIERGE", ML, y); y += 14;

    const rawLines = cl(kickoff.conciergeSummary).split("\n");
    rawLines.forEach(raw => {
      const line = raw.trim();
      if (!line) { y += 5; return; } // blank line = spacing

      const isTitle  = line === line.toUpperCase() && line.length > 2 && !/^-/.test(line);
      const isBullet = /^[-*•]/.test(line);

      if (isTitle) {
        y += 4;
        doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
        dt(se(line), ML, y); y += 12;
      } else if (isBullet) {
        const text = line.replace(/^[-*•]\s*/, "");
        const wrapped = sts(se(text), TW - 8);
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
        dt(se("-"), ML, y);
        wrapped.forEach((wl, i) => { dt(wl, ML + 8, y); y += 12; });
      } else {
        const wrapped = sts(se(line), TW);
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
        wrapped.forEach(wl => { dt(wl, ML, y); y += 12; });
      }
    });
  }

  // ── Order links section on cover ────────────────────────────
  y += 14;
  doc.setDrawColor(220,220,220); doc.setLineWidth(0.5); doc.line(ML, y, MR, y); y += 14;

  const BASE = "https://twotravelvip.com";
  const kid  = cl(kickoff.id);
  const gn   = encodeURIComponent(cl(kickoff.guestName));
  const ad   = encodeURIComponent(cl(kickoff.arrivalDate));
  const dd   = encodeURIComponent(cl(kickoff.departureDate));

  // Drinks
  const drinksUrl     = `${BASE}/d/${kid}`;
  const drinksDisplay = `twotravelvip.com/d/${kid}`;
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
  dt(lang === "es" ? "Pedido de Bebidas" : "Drink Order", ML, y); y += 11;
  doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
  dt(lang === "es"
    ? "Selecciona y presupuesta tus bebidas para la casa y el bote."
    : "Select and budget your drinks for both the house and the boat.", ML, y); y += 10;
  doc.setTextColor(30,100,200);
  dtLink(drinksDisplay, ML, y, drinksUrl); y += 14;

  // Groceries
  const grocUrl     = `${BASE}/g/${kid}`;
  const grocDisplay = `twotravelvip.com/g/${kid}`;
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
  dt(lang === "es" ? "Pedido de Mercado" : "Groceries Order", ML, y); y += 11;
  doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
  dt(lang === "es"
    ? "Personaliza tu lista de mercado con snacks y esenciales."
    : "Customize your grocery list with snacks and breakfast essentials.", ML, y); y += 10;
  doc.setTextColor(30,100,200);
  dtLink(grocDisplay, ML, y, grocUrl); y += 14;

  // Breakfast (CTG only)
  const cityCode = cl(kickoff.city || kickoff.destination || "").split(",")[0].trim().toUpperCase();
  const isCtg = ["CTG","CARTAGENA"].some(c => cityCode.includes(c));
  if (isCtg) {
    const gs   = parseInt(cl(kickoff.groupSize)) || 1;
    const tier = gs <= 5 ? "1-5" : gs <= 10 ? "6-10" : "11-20";
    const bfUrl     = `${BASE}/b/${kid}`;
    const bfDisplay = `twotravelvip.com/b/${kid}`;
    doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
    dt(lang === "es" ? "Pedido de Desayuno" : "Breakfast Order", ML, y); y += 11;
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
    dt(lang === "es"
      ? "Elige tu menú de desayuno para toda la estadía."
      : "Choose your breakfast menu for your entire stay.", ML, y); y += 10;
    doc.setTextColor(30,100,200);
    dtLink(bfDisplay, ML, y, bfUrl); y += 14;
  }

  // Check-in Form (if concierge set a HubSpot link)
  if (checkInUrl) {
    doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
    dt(lang === "es" ? "Formulario de Check-in" : "Check-in Form", ML, y); y += 11;
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
    dt(lang === "es"
      ? "Completa tu formulario de pre-llegada antes de tu viaje."
      : "Complete your pre-arrival check-in form before your trip.", ML, y); y += 10;
    doc.setTextColor(30,100,200);
    const shortCheckIn = checkInUrl.replace(/^https?:\/\//, "").slice(0, 60);
    dtLink(shortCheckIn, ML, y, checkInUrl); y += 14;
  }

  // Welcome guide
  y += 4;
  doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
  dt(lang === "es" ? "Guia de Bienvenida Two Travel:" : "Two Travel Welcome Guide:", ML, y); y += 11;
  doc.setFont("helvetica","normal"); doc.setTextColor(30,100,200);
  dtLink("twotravelvip.com/welcome-guide.pdf", ML, y, "https://twotravelvip.com/welcome-guide.pdf");
  y += 18;

  // Cover footer
  doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(150,150,150);
  dt("Two Travel · twotravelvip.com", PW/2, PH - 22, { align:"center" });

  // ── PRE-TRIP CONTENT PAGE ───────────────────────────────────
  const autoPreTrip = lang === "es"
    ? [
        `ANTES DE TU LLEGADA`,
        "",
        `Por favor revisa esto antes de tu llegada. Tiene informacion util para tu viaje.`,
        "",
        ...(checkInUrl ? [`Formulario de Pre Check-in: ${checkInUrl}`] : []),
        `Calculadora de bebidas: https://two.travel/drinks`,
        `Guia de Cartagena (PDF): https://two.travel/ctg-guide.pdf`,
        `WhatsApp Concierge: https://wa.me/573001234567`,
        "",
        `PROMO`,
        "",
        `Comparte como es viajar con Two Travel y obtén descuentos en tus experiencias. Síguenos @twotravelconcierge en Instagram y @twotravelvip en TikTok.`,
        "",
        `Nota: La publicación debe hacerse durante la estadía. Se requiere un tag por persona. Para servicios grupales todos los miembros deben participar.`,
      ]
    : [
        `BEFORE YOUR ARRIVAL`,
        "",
        `Please take a look at this before your arrival. It has some helpful info for your trip.`,
        "",
        ...(checkInUrl ? [`Pre Check-in Form: ${checkInUrl}`] : []),
        `Drink Calculator: https://two.travel/drinks`,
        `Cartagena City Guide (PDF): https://two.travel/ctg-guide.pdf`,
        `WhatsApp Concierge: https://wa.me/573001234567`,
        "",
        `PROMO`,
        "",
        `Show everyone how amazing it is to travel with Two Travel's concierge service and get discounts on your experiences. Follow us @twotravelconcierge on Instagram and @twotravelvip on TikTok.`,
        "",
        `Note: The post must be made during your stay. One tag per person required to redeem. For group services all members must participate for the discount to apply.`,
      ];

  newPage();
  doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(12,12,12);
  doc.setDrawColor(12,12,12); doc.setLineWidth(1.2);
  doc.line(ML, y, ML + 50, y); doc.setLineWidth(0.5); y += 16;

  autoPreTrip.forEach(line => {
    const l = cl(line);
    if (!l) { checkY(8); y += 6; return; }
    checkY(14);
    const isLink = l.includes(": http") || l.startsWith("http");
    if (isLink) {
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(30,100,200);
    } else if (l.toUpperCase() === l && l.length < 60) {
      doc.setFontSize(10); doc.setFont("helvetica","bold"); doc.setTextColor(12,12,12);
      y += 4;
    } else {
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
    }
    const wrapped = sts(se(l), TW);
    wrapped.forEach(wl => { checkY(13); dt(wl, ML, y); y += 13; });
  });

  // ── DAY PAGES ───────────────────────────────────────────────
  orderedDays.forEach(({ label, title }) => {
    const parseTime = (t) => {
      if (!t) return 9999;
      // "HH:MM" (24h from time input) or "H:MM AM/PM"
      const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
      if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
      const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (m12) {
        let h = parseInt(m12[1]);
        if (m12[3].toUpperCase() === "PM" && h !== 12) h += 12;
        if (m12[3].toUpperCase() === "AM" && h === 12) h = 0;
        return h * 60 + parseInt(m12[2]);
      }
      return 9999;
    };
    const items = (rawMap.get(label) || []).sort((a, b) => {
      const ta = parseTime(a.time), tb = parseTime(b.time);
      // If both have times, sort by time; otherwise keep sortOrder
      if (ta < 9999 && tb < 9999) return ta - tb;
      if (ta < 9999) return -1;
      if (tb < 9999) return 1;
      return a.sort - b.sort;
    });
    if (!items.length) return;

    newPage();

    // Day header band
    const bandH = title ? 36 : 26;
    doc.setFillColor(30,30,30);
    doc.rect(ML - 12, y - 14, TW + 24, bandH, "F");
    doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
    dt(label, ML, y);
    if (title) {
      doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(200,200,200);
      const titleLines = sts(cl(title), TW);
      dt(titleLines[0], ML, y + 14);
      y += 14;
    }
    y += 24;

    items.forEach((item, itemIdx) => {
      // Estimate height needed
      const descLines = item.description
        ? sts(item.description.replace(/\n+/g," "), TW - 12).slice(0,3)
        : [];
      const hlCount = Math.min((item.highlights || []).length, 4);
      const need = 18 + (item.location ? 14 : 0) + descLines.length * 12 + hlCount * 12 + 16;
      checkY(need);

      // Time + Name
      const timePart = item.time ? `${item.time}   ` : "";
      doc.setFontSize(10.5); doc.setFont("helvetica","bold"); doc.setTextColor(15,15,15);
      dt(se(timePart + item.name), ML, y); y += 15;

      // Price (deposit amount) — show COP price when set
      const itemPriceCop = Number(item.price_cop ?? 0);
      if (itemPriceCop > 0) {
        const paxCount = Number(item.pax || 1);
        const isPerPerson = String(item.priceUnit || "").toLowerCase().includes("person");
        const priceStr = isPerPerson && paxCount > 1
          ? `${new Intl.NumberFormat("es-CO").format(itemPriceCop)} × ${paxCount} pers = ${new Intl.NumberFormat("es-CO").format(itemPriceCop * paxCount)} COP`
          : `${new Intl.NumberFormat("es-CO").format(itemPriceCop)} COP`;
        doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(100,100,100);
        dt(priceStr, ML, y); y += 12;
      }

      // Confirmation status — show badge only when explicitly confirmed (true), skip when recommendation (false/undefined)
      if (item.confirmed === true) {
        const confBy = item.confirmation ? ` · ${cl(item.confirmation)}` : "";
        const badge = (lang === "es" ? "CONFIRMADO" : "CONFIRMED") + se(confBy);
        doc.setFillColor(230, 245, 235);
        doc.setDrawColor(60, 150, 90);
        doc.setLineWidth(0.5);
        const bw = doc.getStringUnitWidth(badge) * 7.5 / doc.internal.scaleFactor + 10;
        doc.roundedRect(ML, y - 7, bw, 10, 2, 2, "FD");
        doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.setTextColor(40, 130, 70);
        dt(badge, ML + 5, y); y += 14;
      }

      // Location
      if (item.location) {
        doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(120,120,120);
        dt(se(item.location), ML + 2, y); y += 13;
      }

      // Description (max 3 lines)
      descLines.forEach(line => {
        checkY(13);
        doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(65,65,65);
        dt(line, ML + 4, y); y += 12;
      });


      y += 10;
      // Divider between services (not after last)
      if (itemIdx < items.length - 1 && y < PH - 60) {
        doc.setDrawColor(235,235,235); doc.setLineWidth(0.4);
        doc.line(ML, y, MR, y); y += 9;
      }
    });
  });

  // ── FREE NOTES BLOCK (pdfNotes) ────────────────────────────
  const pdfNotesText = cl(kickoff.pdfNotes || "");
  if (pdfNotesText) {
    newPage();
    pdfNotesText.split("\n").forEach(line => {
      const l = se(cl(line));
      if (!l) { checkY(8); y += 6; return; }
      checkY(14);
      if (l.toUpperCase() === l && l.length < 80) {
        doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(40,40,40);
        y += 4;
        dt(l, ML, y); y += 14;
      } else if (l.startsWith("- ") || l.startsWith("• ")) {
        const content = l.replace(/^[-•]\s+/, "");
        const wrapped = sts("· " + se(content), TW - 8);
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
        wrapped.forEach(wl => { checkY(13); dt(wl, ML + 4, y); y += 13; });
      } else {
        const wrapped = sts(l, TW);
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
        wrapped.forEach(wl => { checkY(13); dt(wl, ML, y); y += 13; });
      }
    });
  }

  // Page footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(200,200,200);
    dt("Two Travel · twotravelvip.com", PW/2, PH - 22, { align:"center" });
  }

  // ── MACHINE-READABLE BILLING PAGE (last, hidden from client) ─
  doc.addPage();
  let dy = 40;
  const dln = (n = 16) => { dy += n; };
  doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(210,210,210);
  dt("BILLING DATA — DO NOT EDIT", ML, dy); dln();
  doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);

  [
    `[1A][${cleanTag(kickoff.guestName)}]`,
    `[2A][${cleanTag(kickoff.email || kickoff.guestEmail || kickoff.guestContact || "")}]`,
    `[3A][${fmtIso(kickoff.arrivalDate)}]`,
    `[4A][${fmtIso(kickoff.departureDate)}]`,
    `[CIUDAD][${cleanTag(cityFullName(kickoff.city))}]`,
  ].forEach(line => { doc.setFontSize(7.5); dt(line, ML, dy); dln(); });
  dln(4);

  cart.forEach(it => {
    const c2   = cl(it.category || "").toLowerCase();
    const isNQ = NO_QB.has(c2);
    const qb2  = isNQ ? "" : cl(it.quickbooksCode || matchSvc(it)?.quickbooksCode || "");
    if (!qb2) return;
    const pax2  = PAX_MULTIPLIES.has(c2) ? Math.max(1, Number(it.pax || 1)) : 1;
    const unit2 = currency === "COP"
      ? Number(it.priceOverride_cop ?? it.price_cop ?? 0)
      : currency === "MXN"
      ? (() => {
          // MXN: use price_mxn if available, otherwise convert from USD (approx 17 MXN/USD)
          const mxn = Number(it.price_mxn ?? 0);
          if (mxn > 0) return mxn;
          const usd = Number(it.priceUsd ?? 0);
          if (usd > 0) return Math.round(usd * (fxRate > 0 ? fxRate / 200 : 17));
          const cop = Number(it.priceOverride_cop ?? it.price_cop ?? 0);
          return cop > 0 ? Math.round(cop / fxRate * 17) : 0;
        })()
      : (() => {
          const manual = Number(it.priceUsd ?? 0);
          if (manual > 0) return manual;
          const cop = Number(it.priceOverride_cop ?? it.price_cop ?? 0);
          return cop > 0 ? Math.round(cop / fxRate) : 0;
        })();
    const tot2  = unit2 * pax2;
    const nm2   = cl(it.name_en || it.displayName || it.name || "").replace(/[\[\]]/g,"");
    doc.setFontSize(7.5);
    dt(`[${qb2}][${nm2}][${Math.round(tot2)}]`, ML, dy); dln();
  });

  const filename = `Itinerary_${cl(kickoff.guestName||"client").replace(/\s+/g,"-")}_${new Date().toISOString().slice(0,10)}.pdf`;

  // ── preview: return bloburl so caller can show in modal ────────────────
  if (mode === "preview") {
    return doc.output("bloburl");
  }

  // ── slack: upload via GAS ────────────────────────────────────
  const pdfBlob   = doc.output("blob");
  const pdfSize   = pdfBlob.size;
  const pdfBase64 = await new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.readAsDataURL(pdfBlob);
  });
  const resp = await fetch(BILLING_GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "sendBillingToSlack",
      payload: { pdfBase64, pdfSize, filename,
        comment: lang === "es"
          ? `📋 Guía de Bienvenida Two Travel: https://twotravelvip.com/welcome-guide.pdf`
          : `📋 Two Travel Welcome Guide: https://twotravelvip.com/welcome-guide.pdf`,
        slackToken: SLACK_BOT_TOKEN, channelId: SLACK_CHANNEL_ID },
    }),
  });
  let data;
  try {
    const text = await resp.text();
    data = JSON.parse(text);
  } catch {
    throw new Error("GAS devolvió respuesta inválida (posible error de cuota o deployment)");
  }
  if (!data.ok) throw new Error(data.error || "Error enviando a Slack");
}

/* =========================================
   Lista fija de concierges
   ========================================= */
const CONCIERGE_LIST = [
  { name: "Alia Jadad",           email: "alia@two.travel",     phone: "+57 301 7618012",   city: "CTG", title: "Senior Concierge Cartagena", calendarUrl: "" },
  { name: "Carolina Lopez",       email: "caro@two.travel",     phone: "+57 300 8192062",   city: "CTG", title: "Senior Concierge Cartagena", calendarUrl: "https://meetings.hubspot.com/carotwotravel/caro-calendar?uuid=4ba96711-f96d-4fe3-b9eb-12a836826a81" },
  { name: "Daniela Becerra",      email: "daniela@two.travel",  phone: "+57 304 4445285",   city: "MDE", title: "Senior Concierge Medellín",  calendarUrl: "" },
  { name: "Nataly Cruz",          email: "nataly@two.travel",   phone: "+52 1 55 2337 7241",city: "CDMX", calendarUrl: "" },
  { name: "Giulia Lorini Serrato",email: "giulia@two.travel",   phone: "+52 1 55 4344 1382",city: "CDMX", calendarUrl: "" },
  { name: "Natalia Peniche",       email: "natalia@two.travel",  phone: "",                  city: "CDMX", calendarUrl: "" },
  { name: "Michel Sanchez",       email: "michel@two.travel",   phone: "+57 300 0000000",    city: "CTG", title: "Admin", calendarUrl: "" },
];

/* =========================================
   Helpers de formato
   ========================================= */

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};


const formatPriceCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);

/* =========================================
   Pre-Trip default template
   Edit this to change the default content
   that appears in every new kickoff's
   Pre-Trip Information block.
   ========================================= */

const DEFAULT_PRE_TRIP = `Take a look - Cartagena
Please take a look at this before your arrival. It has some helpful info for your trip.

Pre Check-in Form: https://forms.gle/REPLACE_WITH_FORM_LINK
Drink Calculator: https://two.travel/drinks
Cartagena City Guide (PDF): https://two.travel/ctg-guide.pdf
WhatsApp Concierge: https://wa.me/573001234567

──────────────────────────────

Promo!
Show everyone how amazing it is to travel with Two Travel's concierge service and get discounts on your experiences. Follow us @twotravelconcierge on Instagram and @twotravelvip on TikTok.

Note: The post must be made during your stay. One tag per person required to redeem. For group services (transport, chef, etc.) all members must participate for the discount to apply.

──────────────────────────────

Recommendations in Cartagena

☕ Coffee & Bakeries
Cafe San Alberto — Specialty coffee, award-winning roaster from Bogotá. Calle del Arzobispado #36-57.
Libertario — Artisan coffee in a relaxed courtyard. Calle de Badillo.
Epoca Cafe Bar — Coffee bar by day, bar by night. Great brunch spot (no reservations, first come first served). Calle de la Mantilla.
La Manchuria — Chill corner café with good filter coffee. Centro Histórico.
Ely — Beloved local bakery famous for pan de bono, pastries, and light breakfasts. Multiple locations.

🍫 Chocolate
Evok — Artisan Colombian chocolate store, beautiful gifts and tastings.

🏛️ Museums
Museo del Oro Zenú — Free gold museum showcasing Zenú culture. Plaza de Bolívar.
Museo Histórico de Cartagena — Inside the historic Palacio de la Inquisición. Must-visit.
Museo de Arte Moderno de Cartagena (MAMCA) — Rotating modern art exhibitions. Plaza de San Pedro.

🌅 Rooftops
Townhouse Cartagena — Stylish rooftop with city views, great cocktails. Reservations recommended.
Apogeo — Elegant penthouse rooftop bar with 360° views. Centro Histórico.
Buena Vida — Casual rooftop with great vibes and affordable drinks.
Mirador — Laid-back viewpoint rooftop. Great for sunsets.

──────────────────────────────

🛍️ Shopping
La Serrezuela Mall: Malva (local designers), Artesanias de Colombia, Loto del Sur (Colombian emeralds).
Walled City boutiques: Soloio, Agua de Leon, St Dom, Casa Chiqui, Territorio.

──────────────────────────────

🥞 Brunch
Al Alma — Stunning courtyard restaurant in a colonial mansion. Beautiful setting, great eggs benedicts and açaí bowls. Reservations strongly recommended. Calle del Santísimo #8-19.
Ely Centro Histórico — Cartagena institution. Beloved for their pan de bono, fresh juices, and empanadas. Casual and local. Calle Segunda de Badillo.
Epoca Cafe Bar — Trendy brunch spot with excellent coffee and food. No reservations, arrive early. Calle de la Mantilla.

──────────────────────────────

🍽️ Lunch
Pezetarian — Plant-forward Mediterranean menu in a beautiful Walled City spot. Fresh, light and delicious. Reservations recommended.
Kona — Casual Hawaiian-inspired poke bowls and fresh seafood. Great for a lighter lunch. Plaza de San Diego.
Buena Vida Marisquería — Seafood-focused spot with great ceviche and grilled fish. Popular with locals.
Tacos del Gordo — Authentic Mexican street tacos, surprisingly great. Very affordable. Getsemaní.

──────────────────────────────

🌿 Getsemaní Lunch
El Beso — Vibrant neighborhood gem with Colombian fusion dishes and colorful decor.
Cocina de Pepina — Traditional Colombian home cooking, grandmother recipes. Soulful and delicious.
Casa del Túnel — Relaxed courtyard restaurant inside a colonial house. Good mojitos.
Carta Ajena / OSH — Creative cocktail bar and restaurant. One of Getsemaní's coolest spots.

──────────────────────────────

📍 Places to Visit (free / walking)
Plaza de San Diego — Charming square surrounded by restaurants and boutiques.
Plaza Fernández de Madrid — Quiet, authentic local square. Great for people-watching.
Plaza de la Merced — Beautiful colonial church and open square.
Plaza Santo Domingo — Iconic square with the famous Botero sculpture. Lively at night.
Plaza de Bolívar — Central plaza with the gold museum and Palacio de la Inquisición.
San Pedro Claver Church — Beautiful colonial church and cloister. Worth a visit.
Plaza de la Aduana — Large colonial square near the Clock Tower.
Plaza de los Coches — Portal de los Dulces with local sweets vendors.
Clock Tower (Torre del Reloj) — The main entrance to the Walled City. Great photos.`;

/* =========================================
   Estados
   ========================================= */

const STATUS_LABELS = {
  new:                { es: "Nuevo",                    en: "New" },
  client_submitted:   { es: "Cliente llenó selección",  en: "Client submitted" },
  concierge_editing:  { es: "Concierge editando",       en: "Concierge editing" },
  sent_to_preview:    { es: "Enviado a preview",        en: "Sent to preview" },
  sent_to_travify:    { es: "Enviado a contabilidad",   en: "Sent to accounting" },
  feedback_submitted: { es: "Cliente llenó feedback",   en: "Feedback submitted" },
  done:               { es: "Cerrado",                  en: "Closed" },
};
function statusLabel(status, lang = "es") {
  return STATUS_LABELS[status]?.[lang] ?? status;
}

// Convert Google Drive share/folder links → thumbnail URL (works cross-origin in browser)
function driveImgUrl(url) {
  if (!url) return url;
  if (!url.includes("drive.google.com")) return url;
  const fileMatch = url.match(/\/file\/d\/([^/?]+)/);
  if (fileMatch) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  const openMatch = url.match(/[?&]id=([^&]+)/);
  if (openMatch) return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
  if (url.includes("lh3.google") || url.includes("thumbnail?")) return url;
  return url;
}

const STATUS_CLASSES = {
  new: "bg-blue-100 text-blue-700 border-blue-300",
  client_submitted: "bg-indigo-100 text-indigo-800 border-indigo-300",
  concierge_editing: "bg-amber-100 text-amber-800 border-amber-300",
  sent_to_preview: "bg-orange-100 text-orange-800 border-orange-300",
  sent_to_travify: "bg-purple-100 text-purple-800 border-purple-300",
  feedback_submitted: "bg-teal-100 text-teal-800 border-teal-300",
  done: "bg-emerald-100 text-emerald-700 border-emerald-300",
};
const CLIENT_TYPE_LABELS = {
  1: "Tipo 1",
  2: "Tipo 2",
};

const CLIENT_TYPE_CLASSES = {
  1: "bg-sky-100 text-sky-800 border-sky-300",
  2: "bg-purple-100 text-purple-800 border-purple-300",
};

function ClientTypeBadge({ value }) {
  const n = String(value).includes("2") ? 2 : 1;
  const label = CLIENT_TYPE_LABELS[n] || `Tipo ${n}`;
  const cls =
    CLIENT_TYPE_CLASSES[n] ||
    "bg-neutral-100 text-neutral-700 border-neutral-300";

  return (
    <span className={"inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border " + cls}>
      {label}
    </span>
  );
}


function StatusBadge({ status, lang = "es" }) {
  const s = String(status || "").trim().toLowerCase();

  const normalized =
  s === "nuevo" ? "new" :
  s === "cliente llenó selección" ? "client_submitted" :
  s === "concierge editando" ? "concierge_editing" :
  s === "enviado" ? "sent_to_travify" :
  s === "cerrado" ? "done" :
  s === "in-progress" ? "concierge_editing" :
  s === "sent" ? "sent_to_travify" :
  status;

  const label = STATUS_LABELS[normalized]?.[lang] ?? STATUS_LABELS[normalized]?.es ?? normalized ?? "—";
  const cls =
    STATUS_CLASSES[normalized] ||
    "bg-neutral-100 text-neutral-700 border-neutral-300";

  return (
    <span className={"inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border " + cls}>
      {label}
    </span>
  );
}
// Always use the production domain so shared links never show Vercel/GitHub URLs
const CLIENT_BASE_URL = "https://www.twotravelvip.com";

function buildCatalogLink(kickoff, clientType = 1, lang = "en") {
  const url = new URL("/", CLIENT_BASE_URL);
  url.searchParams.set("mode", "catalog");
  url.searchParams.set("kickoffId", kickoff?.id || "");
  url.searchParams.set("clientType", String(clientType));
  url.searchParams.set("lang", lang);
  return url.toString();
}
// Maps city codes / raw values → feedback form dropdown option labels
const CITY_TO_DESTINATION = {
  CTG:              "Cartagena",
  MDE:              "Medellín",
  CDMX:             "CDMX",
  TUL:              "Tulum",
  BOG:              "Bogotá",
  cartagena:        "Cartagena",
  medellin:         "Medellín",
  medellín:         "Medellín",
  tulum:            "Tulum",
  bogota:           "Bogotá",
  bogotá:           "Bogotá",
  "Ciudad de México": "CDMX",
  "ciudad de méxico": "CDMX",
  "Mexico":         "CDMX",
  "mexico":         "CDMX",
};

// Maps full concierge names → dropdown short names
const CONCIERGE_TO_SHORT = {
  "Alia Jadad":            "Alia",
  "Carolina Lopez":        "Caro",
  "Daniela Becerra":       "Dani",
  "Nataly Cruz":           "Nataly",
  "Giulia Lorini Serrato": "Giulia",
  "Natalia Peniche":       "Natalia",
};

function buildFeedbackLink(kickoff, clientType = 1, lang = "en") {
  const url = new URL("/", CLIENT_BASE_URL);

  url.searchParams.set("mode", "feedback");
  url.searchParams.set("kickoffId", kickoff?.id || "");
  url.searchParams.set("clientType", String(clientType));
  url.searchParams.set("lang", lang);

  url.searchParams.set("guestName", kickoff?.guestName || "");
  url.searchParams.set("tripName", kickoff?.tripName || "");
  url.searchParams.set("guestContact", kickoff?.guestContact || "");

  // Helper: map city code / name → dropdown label
  const resolveCity = (raw) => {
    if (!raw) return "";
    const key = String(raw).trim();
    return CITY_TO_DESTINATION[key] || CITY_TO_DESTINATION[key.toLowerCase()] || key;
  };

  // City 1 — supports comma-separated "CTG,MDE" in the city field
  const rawCity = String(kickoff?.city || "").trim();
  const cityParts = rawCity.includes(",")
    ? rawCity.split(",").map(s => s.trim())
    : [rawCity];

  const dest1 = resolveCity(cityParts[0]);
  if (dest1) url.searchParams.set("destination", dest1);

  // City 2 — explicit city2 field OR second part of comma-separated city
  const rawCity2 = String(kickoff?.city2 || cityParts[1] || "").trim();
  const dest2 = resolveCity(rawCity2);
  if (dest2) url.searchParams.set("destination2", dest2);

  // Map full concierge name → dropdown short name (e.g. "Alia Jadad" → "Alia")
  // Supports comma-separated "Carolina Lopez, Daniela B" in assignedConcierge
  const rawConciergeField = kickoff?.assignedConcierge || "";
  const conciergeParts = rawConciergeField.includes(",")
    ? rawConciergeField.split(",").map(s => s.trim())
    : [rawConciergeField.trim()];
  const rawConcierge = conciergeParts[0] || "";
  const concierge = CONCIERGE_TO_SHORT[rawConcierge] || rawConcierge.split(" ")[0] || "";
  if (concierge) url.searchParams.set("concierge", concierge);

  // Concierge 2 — explicit assignedConcierge2 field OR second part of comma-separated assignedConcierge
  const rawConcierge2 = (kickoff?.assignedConcierge2 || conciergeParts[1] || "").trim();
  const concierge2 = CONCIERGE_TO_SHORT[rawConcierge2] || rawConcierge2.split(" ")[0] || "";
  if (concierge2) url.searchParams.set("concierge2", concierge2);

  return url.toString();
}

function buildQuestionnaireLink(kickoff, clientType = 1, lang = "en") {
  const url = new URL("/", CLIENT_BASE_URL);
  url.searchParams.set("mode", "questionnaire");
  url.searchParams.set("kickoffId", kickoff?.id || "");
  url.searchParams.set("clientType", String(clientType));
  url.searchParams.set("lang", lang); // explicit override — portalLang toggle wins
  url.searchParams.set("guestName", kickoff?.guestName || "");
  url.searchParams.set("tripName", kickoff?.tripName || "");
  if (kickoff?.guestContact) url.searchParams.set("guestContact", kickoff.guestContact);
  return url.toString();
}

// ── ONE link that flows: Welcome → Questionnaire → Catalog ──────────────────
// Uses mode=questionnaire (which already sequences quiz → catalog).
// If kickoff has a welcomePdfUrl we embed it as a param so the welcome screen
// can surface a "Ver tu bienvenida" button before the quiz starts.
function buildOnboardLink(kickoff, clientType = 1, lang = "en") {
  const url = new URL(buildQuestionnaireLink(kickoff, clientType, lang));
  const wUrl = (kickoff?.welcomePdfUrl || "").trim();
  if (wUrl) url.searchParams.set("welcome", wUrl);
  return url.toString();
}

/* Resolve variable price for tiered/ranges models (mirrors TwoTravelCatalog) */
function resolveVariablePrice(service, groupSizeNum) {
  const model = String(service?.pricing_model || "").trim().toLowerCase();
  const raw   = String(service?.pricing_tiers  || "").trim();
  if (!model || !raw) return null;
  const tiers = raw.split(",").map(part => {
    const sep = part.lastIndexOf(":");
    if (sep < 0) return null;
    const label = part.substring(0, sep).trim();
    const price = parseInt(part.substring(sep + 1).replace(/\D/g, "")) || 0;
    if (model === "tiered") return { pax: parseInt(label) || 1, pricePerPerson: price };
    if (model === "ranges") {
      const d = label.indexOf("-");
      return d >= 0
        ? { min: parseInt(label) || 1, max: parseInt(label.substring(d + 1)) || 999, totalPrice: price }
        : { min: parseInt(label.replace("+","")) || 1, max: 999, totalPrice: price };
    }
    return null;
  }).filter(Boolean);
  if (!tiers.length) return null;
  const n = Math.max(1, parseInt(groupSizeNum) || 1);
  if (model === "tiered") {
    const sorted = [...tiers].sort((a, b) => b.pax - a.pax);
    const match  = sorted.find(t => t.pax <= n) || sorted[sorted.length - 1];
    return { price: match.pricePerPerson, unit: "per person" };
  }
  if (model === "ranges") {
    const match = tiers.find(t => n >= t.min && n <= t.max);
    return match ? { price: match.totalPrice, unit: "per group" } : null;
  }
  return null;
}

function mapServiceToCartItem(service, clientType = 1, groupSizeNum = 1) {
  const base = Number(service?.price_cop || 0);
  const t1 = Number(service?.price_tier_1 || 0);
  const t2 = Number(service?.price_tier_2 || 0);

  const ct = String(clientType).includes("2") ? 2 : 1;
  let chosen = ct === 2 ? (t2 || base) : (t1 || base);
  let resolvedUnit = service?.priceUnit || "";

  // Variable pricing override (tiered / ranges)
  const vModel = String(service?.pricing_model || "").trim().toLowerCase();
  const vRaw   = String(service?.pricing_tiers  || "").trim();
  if (vModel && vRaw) {
    const resolved = resolveVariablePrice(service, groupSizeNum);
    if (resolved) {
      chosen       = resolved.price;
      resolvedUnit = resolved.unit;
    }
  }

  return {
  id: service?.id ?? service?.sku ?? `svc_${Date.now()}`,
  sku: service?.sku || "",
  name: service?.name || "Servicio",
  name_en: service?.name_en || service?.name || "Service",
  description_es: service?.description?.es || "",
  description_en: service?.description?.en || "",
  category: service?.category || "",
  subcategory: service?.subcategory || "",
  price_cop: chosen,
  price_tier_1: t1,
  price_tier_2: t2,
  base_price_cop: base,
  priceUnit: resolvedUnit,
  displayName: service?.name || "",
  priceOverride_cop: null,
  quickbooksCode: service?.quickbooksCode || "",
  priceUsd: service?.priceUsd ?? null,
  dayLabel: "",
  timeLabel: "",
  notes: "",
  confirmed: false,
  confirmation: "",
  dressCode: "",
  passengers: "",
};
}

function mapManualToCartItem() {
  const uid = `manual_${Date.now()}_${Math.random()}`;
  return {
    id: uid,
    _uid: uid,
    sku: "",
    name: "Ítem manual",
    category: "services",
    subcategory: "",
    price_cop: 0,
    price_tier_1: 0,
    price_tier_2: 0,
    priceUnit: "",
    displayName: "",
    priceOverride_cop: null,
    quickbooksCode: "",
    priceUsd: null,
    dayLabel: "",
    timeLabel: "",
    notes: "",
    confirmed: true,
    confirmation: "",
    dressCode: "",
    passengers: "",
  };
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVITY ROW — inline-editable row inside a day section
═══════════════════════════════════════════════════════════════ */
function ImageField({ item, onUpdate }) {
  const [uploading, setUploading] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  const fileRef = React.useRef();

  async function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const url = await uploadImageToDrive(file);
      onUpdate(item._uid, { image: url });
    } catch {
      alert("No se pudo subir la imagen. Intenta de nuevo.");
    } finally {
      setUploading(false);
    }
  }

  function onPaste(e) {
    const f = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith("image/"))?.getAsFile();
    if (f) { e.preventDefault(); handleFile(f); }
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer?.files?.[0]);
  }

  return (
    <div className="flex items-start gap-2">
      <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0 pt-1">Imagen</span>
      <div className="flex-1 flex flex-col gap-1">
        {item.image ? (
          <div className="relative w-full">
            <img src={item.image} alt="" className="w-full max-h-24 object-cover rounded border border-neutral-200" />
            <button type="button" onClick={() => onUpdate(item._uid, { image: "" })}
              className="absolute top-1 right-1 bg-white/80 rounded px-1 text-[10px] text-red-500 hover:text-red-700">✕ quitar</button>
          </div>
        ) : (
          <div
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg py-3 cursor-pointer transition-colors text-center
              ${dragOver ? "border-blue-400 bg-blue-50" : "border-neutral-200 hover:border-neutral-400"}`}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleFile(e.target.files?.[0])} />
            {uploading
              ? <span className="text-[10px] text-neutral-400">Subiendo…</span>
              : <>
                  <span className="text-lg">🖼️</span>
                  <span className="text-[10px] text-neutral-400">Pegar · arrastrar · o click para elegir</span>
                </>
            }
          </div>
        )}
        <input
          value={item.image || ""}
          onChange={e => onUpdate(item._uid, { image: e.target.value })}
          placeholder="o pega un link…"
          className="text-[10px] text-neutral-400 border-b border-dashed border-neutral-100 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
        />
      </div>
    </div>
  );
}

function ActivityRow({ item, onUpdate, onRemove, onResync, availableDays = [], groupSize = 1, lang = "en" }) {
  const [showNotes, setShowNotes] = useState(!!(item.notes || item.confirmation || item.confirmed));
  return (
    <div className={`px-4 py-2.5 hover:bg-neutral-50 transition-colors${item.ghost ? " opacity-40 bg-neutral-50" : ""}`}
         title={item.ghost ? "👻 Fantasma — no visible al cliente" : undefined}>
      <div className="grid grid-cols-12 gap-x-2 gap-y-1 items-center">
        {/* Time picker */}
        <div className="col-span-2">
          <input
            type="text"
            value={item.timeLabel || ""}
            onChange={e => onUpdate(item._uid, { timeLabel: e.target.value })}
            placeholder="8:00 AM"
            className="w-full text-xs text-neutral-500 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
          />
        </div>
        {/* Name */}
        <div className="col-span-7">
          <input
            value={item.displayName || (lang === "en" ? (item.name_en || item.name) : item.name) || ""}
            onChange={e => onUpdate(item._uid, { displayName: e.target.value })}
            placeholder="Nombre del servicio"
            className="w-full text-sm font-medium text-neutral-900 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent"
          />
          {item.category && (
            <span className="text-[9px] text-neutral-400 uppercase tracking-wide leading-none">
              {item.category}
            </span>
          )}
        </div>
        {/* Price */}
        <div className="col-span-3">
          <input
            type="number"
            value={item.priceOverride_cop ?? ""}
            onChange={e => onUpdate(item._uid, {
              priceOverride_cop: e.target.value === "" ? null : Number(e.target.value),
            })}
            placeholder={String(item.price_cop || "Precio COP")}
            className="w-full text-xs text-right text-neutral-500 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
          />
          {(() => {
            const isTransport = String(item.category || "").toLowerCase().includes("transport");
            const isPerVehicle = isTransport || String(item.priceUnit || "").toLowerCase().includes("vehicle");
            const isPerPerson = !isPerVehicle && String(item.priceUnit || "").toLowerCase().includes("person");
            const pax = parseInt(item.pax || groupSize, 10);
            const unitPrice = Number(item.priceOverride_cop ?? item.price_cop ?? 0);
            const showTotal = isPerPerson && pax >= 2 && unitPrice > 0;
            const total = showTotal ? new Intl.NumberFormat("es-CO").format(unitPrice * pax) : null;
            return (
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                {/* Per-person / per-group toggle */}
                <button type="button"
                  title={isPerVehicle ? "Por vehículo" : isPerPerson ? "Por persona — click para cambiar a por grupo" : "Por grupo — click para cambiar a por persona"}
                  onClick={() => !isPerVehicle && onUpdate(item._uid, { priceUnit: isPerPerson ? "per group" : "per person" })}
                  className={`text-[8px] px-1.5 py-0 rounded border leading-4 transition ${isPerVehicle ? "text-emerald-600 border-emerald-300 bg-emerald-50 cursor-default" : isPerPerson ? "text-indigo-600 border-indigo-300 bg-indigo-50" : "text-neutral-400 border-neutral-200 bg-transparent hover:border-neutral-400"}`}>
                  {isPerVehicle ? "×veh" : isPerPerson ? "×pers" : "grupo"}
                </button>
                {isPerPerson && (
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    value={item.pax || ""}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "");
                      onUpdate(item._uid, { pax: v === "" ? null : Number(v) });
                    }}
                    placeholder={String(pax)}
                    title="N° personas para este servicio"
                    className="w-10 text-[10px] text-center text-indigo-600 border border-indigo-200 rounded px-1 py-0.5 focus:outline-none bg-white"
                  />
                )}
                {showTotal && (
                  <span className="text-[9px] text-indigo-500 leading-tight">
                    = {total}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
        {/* Actions row */}
        <div className="col-span-12 flex items-center justify-end gap-3 pt-0.5">
          <button
            type="button"
            onClick={() => { onUpdate(item._uid, { confirmed: !(item.confirmed !== false) }); setShowNotes(true); }}
            title={item.confirmed !== false ? "Marcar como recomendación" : "Marcar como confirmado"}
            className="text-lg leading-none opacity-70 hover:opacity-100 transition-opacity"
          >
            {item.confirmed !== false ? "✅" : "📌"}
          </button>
          <button
            type="button"
            onClick={() => onUpdate(item._uid, { ghost: !item.ghost })}
            title={item.ghost ? "Visible al cliente (click para ocultar)" : "Ocultar al cliente (fantasma)"}
            className={`text-lg leading-none transition-opacity ${item.ghost ? "opacity-100" : "opacity-25 hover:opacity-70"}`}
          >
            👻
          </button>
          {onResync && item.sku && (
            <button type="button" onClick={() => onResync(item._uid)}
              title="Resync desde catálogo"
              className="text-lg text-neutral-300 hover:text-blue-500 leading-none transition-colors">
              🔄
            </button>
          )}
          <button type="button" onClick={() => setShowNotes(v => !v)}
            title="Editar detalles"
            className={`text-[11px] px-2 py-0.5 rounded border leading-none transition-colors ${showNotes ? "bg-violet-100 text-violet-700 border-violet-300" : "text-neutral-400 border-neutral-200 hover:text-violet-600 hover:border-violet-300"}`}>
            ✏️ Editar
          </button>
          <button type="button" onClick={() => onRemove(item._uid)}
            title="Quitar"
            className="text-sm text-neutral-300 hover:text-red-500 leading-none">
            ✕
          </button>
        </div>
      </div>
      {/* QB billing row + day selector */}
      <div className="flex gap-3 mt-1 items-center flex-wrap">
        {/* Move to another day — prev/next arrows */}
        {availableDays.length > 1 && (() => {
          const idx = availableDays.indexOf(item.dayLabel || availableDays[0]);
          const hasPrev = idx > 0;
          const hasNext = idx < availableDays.length - 1;
          return (
            <div className="flex items-center gap-1">
              <button type="button" disabled={!hasPrev}
                onClick={() => onUpdate(item._uid, { dayLabel: availableDays[idx - 1] })}
                title={hasPrev ? `Mover a ${availableDays[idx - 1]}` : ""}
                className="text-[11px] px-1.5 py-0.5 rounded border border-violet-200 text-violet-500 hover:bg-violet-50 disabled:opacity-20 disabled:cursor-default leading-none">
                ←
              </button>
              <span className="text-[10px] text-violet-600 font-medium max-w-[90px] truncate">
                {item.dayLabel || availableDays[0]}
              </span>
              <button type="button" disabled={!hasNext}
                onClick={() => onUpdate(item._uid, { dayLabel: availableDays[idx + 1] })}
                title={hasNext ? `Mover a ${availableDays[idx + 1]}` : ""}
                className="text-[11px] px-1.5 py-0.5 rounded border border-violet-200 text-violet-500 hover:bg-violet-50 disabled:opacity-20 disabled:cursor-default leading-none">
                →
              </button>
            </div>
          );
        })()}
        <input
          value={item.quickbooksCode || ""}
          onChange={e => onUpdate(item._uid, { quickbooksCode: e.target.value.toUpperCase() })}
          placeholder="QB code"
          className="w-20 text-[10px] font-mono text-indigo-500 border-b border-dashed border-indigo-200 focus:border-indigo-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 uppercase"
          title="Código QuickBooks (ej: CS010, SE022)"
        />
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-neutral-300">$</span>
          <input
            type="number"
            value={item.priceUsd ?? ""}
            onChange={e => onUpdate(item._uid, { priceUsd: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="USD"
            className="w-16 text-[10px] text-right text-emerald-600 border-b border-dashed border-emerald-200 focus:border-emerald-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
            title="Precio en USD para QuickBooks"
          />
        </div>
      </div>
      {showNotes && (
        <div className="mt-1.5 flex flex-col gap-1 pl-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Confirmado por</span>
            <input
              value={item.confirmation || ""}
              onChange={e => onUpdate(item._uid, { confirmation: e.target.value })}
              placeholder="Nombre de quien confirmó…"
              className="flex-1 text-xs text-neutral-500 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
            />
          </div>
          {String(item.category || "").toLowerCase().includes("transport") && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Pasajeros</span>
              <input
                value={item.passengers || ""}
                onChange={e => onUpdate(item._uid, { passengers: e.target.value })}
                placeholder="Juan, María, Sam…"
                className="flex-1 text-xs text-neutral-500 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
              />
            </div>
          )}
          {/* Boating & Beach clubs — modalidad + tipo de bote + add-ons */}
          {["boating","beach","beach-clubs","boating & beach"].some(k => String(item.category||"").toLowerCase().includes(k)) && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Modalidad</span>
                <div className="flex gap-1.5">
                  {["Day Pass","Bote privado"].map(m => (
                    <button key={m} type="button"
                      onClick={() => onUpdate(item._uid, { boatModalidad: m })}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition ${item.boatModalidad === m ? "bg-cyan-700 text-white border-cyan-700" : "border-neutral-300 text-neutral-500 hover:border-cyan-400"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {item.boatModalidad === "Bote privado" && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Tipo de bote</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {["Speed boat","Yacht","Catamarán"].map(t => (
                        <button key={t} type="button"
                          onClick={() => onUpdate(item._uid, { boatType: item.boatType === t ? "" : t })}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition ${item.boatType === t ? "bg-neutral-800 text-white border-neutral-800" : "border-neutral-300 text-neutral-500 hover:border-neutral-500"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Add-ons</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {["DJ","Bartender","Comida en bote"].map(addon => {
                        const current = item.boatAddons || [];
                        const active = current.includes(addon);
                        return (
                          <button key={addon} type="button"
                            onClick={() => onUpdate(item._uid, { boatAddons: active ? current.filter(a => a !== addon) : [...current, addon] })}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition ${active ? "bg-violet-600 text-white border-violet-600" : "border-neutral-300 text-neutral-500 hover:border-violet-400"}`}>
                            {addon}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Notas</span>
            <input
              value={item.notes || ""}
              onChange={e => onUpdate(item._uid, { notes: e.target.value })}
              placeholder="Mesa, alergias, instrucciones…"
              className="flex-1 text-xs text-neutral-500 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
            />
          </div>
          <ImageField item={item} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

function SortableActivityRow({ item, onUpdate, onRemove, onResync, availableDays, groupSize, lang = "en" }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._uid });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-stretch border-b border-neutral-100 last:border-0">
      <button
        type="button" {...attributes} {...listeners}
        className="px-2 text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 flex items-center select-none"
        title="Arrastrar para reordenar"
        onMouseDown={e => e.stopPropagation()}
      >
        ⠿
      </button>
      <div className="flex-1 min-w-0">
        <ActivityRow item={item} onUpdate={onUpdate} onRemove={onRemove} onResync={onResync}
          availableDays={availableDays} groupSize={groupSize} lang={lang} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DAY SECTION — one per day, collapsible, with editable header
═══════════════════════════════════════════════════════════════ */
const COLORS = ["#111827","#6b7280","#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#ffffff"];
const HIGHLIGHTS = ["transparent","#fef08a","#bbf7d0","#bfdbfe","#fecaca","#f5d0fe","#fed7aa"];

function RichTextBlock({ item, onUpdate, onRemove }) {
  const ref = React.useRef();
  const [showToolbar, setShowToolbar] = React.useState(false);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [hlOpen, setHlOpen] = React.useState(false);

  const exec = (cmd, val) => { document.execCommand(cmd, false, val); ref.current?.focus(); };

  const saveHtml = () => {
    if (ref.current) onUpdate(item._uid, { html: ref.current.innerHTML });
  };

  React.useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (item.html || ""))
      ref.current.innerHTML = item.html || "";
  }, []);

  return (
    <div className="bg-violet-50/70 mx-3 my-2 rounded-xl overflow-hidden border border-violet-200 shadow-sm">
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-white border-b border-violet-100 transition-all ${showToolbar ? "" : "hidden"}`}>
        {[["bold","B","font-bold"],["italic","I","italic"],["underline","U","underline"],["strikeThrough","S","line-through"]].map(([cmd,lbl,cls])=>(
          <button key={cmd} type="button" onMouseDown={e=>{e.preventDefault();exec(cmd);}}
            className={`text-[11px] px-1.5 py-0.5 rounded hover:bg-neutral-100 text-neutral-700 ${cls}`}>{lbl}</button>
        ))}
        <div className="w-px h-4 bg-neutral-200 mx-0.5"/>
        {[["1","H1","text-base font-bold"],["2","H2","text-sm font-semibold"],["3","body","text-xs"],["4","sm","text-[10px]"]].map(([sz,lbl])=>(
          <button key={sz} type="button" onMouseDown={e=>{e.preventDefault();exec("fontSize",sz);}}
            className="text-[11px] px-1.5 py-0.5 rounded hover:bg-neutral-100 text-neutral-600">{lbl}</button>
        ))}
        <div className="w-px h-4 bg-neutral-200 mx-0.5"/>
        {[["justifyLeft","⬅"],["justifyCenter","↔"],["justifyRight","➡"]].map(([cmd,lbl])=>(
          <button key={cmd} type="button" onMouseDown={e=>{e.preventDefault();exec(cmd);}}
            className="text-[11px] px-1.5 py-0.5 rounded hover:bg-neutral-100 text-neutral-600">{lbl}</button>
        ))}
        <div className="w-px h-4 bg-neutral-200 mx-0.5"/>
        <button type="button" onMouseDown={e=>{e.preventDefault();exec("insertUnorderedList");}}
          className="text-[11px] px-1.5 py-0.5 rounded hover:bg-neutral-100 text-neutral-600">• Lista</button>
        <div className="w-px h-4 bg-neutral-200 mx-0.5"/>
        {/* Text color */}
        <div className="relative">
          <button type="button" onMouseDown={e=>{e.preventDefault();setColorOpen(v=>!v);setHlOpen(false);}}
            className="text-[11px] px-1.5 py-0.5 rounded hover:bg-neutral-100 text-neutral-600">A🎨</button>
          {colorOpen && (
            <div className="absolute top-full left-0 z-50 flex flex-wrap gap-1 bg-white border border-neutral-200 rounded-lg p-1.5 shadow-lg w-28">
              {COLORS.map(c=>(
                <button key={c} type="button" onMouseDown={e=>{e.preventDefault();exec("foreColor",c);setColorOpen(false);}}
                  style={{background:c,border:"1px solid #e5e7eb"}} className="w-5 h-5 rounded"/>
              ))}
            </div>
          )}
        </div>
        {/* Highlight */}
        <div className="relative">
          <button type="button" onMouseDown={e=>{e.preventDefault();setHlOpen(v=>!v);setColorOpen(false);}}
            className="text-[11px] px-1.5 py-0.5 rounded hover:bg-neutral-100 text-neutral-600">✏️</button>
          {hlOpen && (
            <div className="absolute top-full left-0 z-50 flex flex-wrap gap-1 bg-white border border-neutral-200 rounded-lg p-1.5 shadow-lg w-28">
              {HIGHLIGHTS.map(c=>(
                <button key={c} type="button" onMouseDown={e=>{e.preventDefault();exec("hiliteColor",c);setHlOpen(false);}}
                  style={{background:c===("transparent"?"#f9fafb":c),border:"1px solid #e5e7eb"}} className="w-5 h-5 rounded">
                  {c==="transparent"&&<span className="text-[8px] text-neutral-400">✕</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Editable area */}
      <div className="relative group">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => setShowToolbar(true)}
          onBlur={() => { setShowToolbar(false); setColorOpen(false); setHlOpen(false); saveHtml(); }}
          onInput={saveHtml}
          data-placeholder="Escribe una nota, instrucción, mensaje especial…"
          className="min-h-[48px] px-4 py-3 text-sm text-neutral-800 focus:outline-none text-center"
          style={{wordBreak:"break-word"}}
        />
        {!item.html && (
          <div className="absolute top-3 left-0 right-0 text-sm text-neutral-400 pointer-events-none select-none text-center">
            Escribe una nota, instrucción, mensaje especial…
          </div>
        )}
        <button type="button" onClick={() => onRemove(item._uid)}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-[10px] text-neutral-400 hover:text-red-500 transition-opacity">✕</button>
      </div>
    </div>
  );
}

function SortableRichTextBlock({ item, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._uid });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-start">
        <button type="button" {...attributes} {...listeners}
          className="text-neutral-300 hover:text-neutral-500 cursor-grab active:cursor-grabbing touch-none px-1 pt-3 select-none text-xs">⠿</button>
        <div className="flex-1">
          <RichTextBlock item={item} onUpdate={onUpdate} onRemove={onRemove} />
        </div>
      </div>
    </div>
  );
}

function DaySection({ label, meta, items, loadingServices, availableDays,
  onUpdateMeta, onRenameLabel, onRemoveDay,
  onUpdateItem, onRemoveItem, onResyncItem, onAddManual, onAddPreset, onAddFromCatalog,
  onAddBlock, onReorderItems, dragHandleProps,
  groupSize = 1, lang = "en" }) {

  const [editingLabel, setEditingLabel] = useState(false);
  const [localLabel,   setLocalLabel]   = useState(label);
  const [collapsed,    setCollapsed]    = useState(false);

  const itemSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => setLocalLabel(label), [label]);

  const commitLabel = () => {
    setEditingLabel(false);
    if (localLabel.trim() && localLabel !== label) onRenameLabel(localLabel.trim());
  };

  return (
    <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
      {/* ── Day header band ── */}
      <div className="bg-neutral-900 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Drag handle for day reordering */}
          {dragHandleProps && (
            <button type="button" {...dragHandleProps}
              className="text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing touch-none flex-shrink-0 select-none mr-1"
              title="Arrastrar para reordenar días"
            >⠿</button>
          )}
          {/* Editable date / day label */}
          {editingLabel ? (
            <input autoFocus value={localLabel}
              onChange={e => setLocalLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === "Enter") commitLabel(); }}
              className="bg-neutral-800 text-white text-sm font-bold rounded px-2 py-0.5 w-52 focus:outline-none border border-neutral-600"
            />
          ) : (
            <button type="button" onClick={() => setEditingLabel(true)}
              title="Click para editar nombre/fecha del día"
              className="text-sm font-bold text-white hover:text-neutral-300 text-left truncate max-w-[200px]">
              {label}
            </button>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-neutral-500">{items.length} act.</span>
            <button type="button" onClick={() => setCollapsed(v => !v)}
              className="text-neutral-500 hover:text-white text-xs w-5 text-center">
              {collapsed ? "▼" : "▲"}
            </button>
            <button type="button" onClick={onRemoveDay}
              className="text-neutral-600 hover:text-red-400 text-xs w-4 text-center">
              ✕
            </button>
          </div>
        </div>
        {/* Editable day description (what goes into Travefy day title) */}
        <input
          value={meta.title || ""}
          onChange={e => onUpdateMeta({ title: e.target.value })}
          placeholder="Descripción del día: ARRIVALS + CHECK IN + DINNER AT LA VITROLA…"
          className="mt-1.5 w-full bg-transparent text-[11px] text-neutral-400 placeholder-neutral-700 focus:outline-none focus:text-white transition-colors"
        />
      </div>

      {/* ── Activities list ── */}
      {!collapsed && (
        <>
          {items.length === 0 ? (
            <div className="px-4 py-3 text-xs text-neutral-400 italic bg-white">
              Sin actividades — agrega una abajo.
            </div>
          ) : (
            <DndContext sensors={itemSensors} collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const oldIdx = items.findIndex(i => i._uid === active.id);
                const newIdx = items.findIndex(i => i._uid === over.id);
                if (oldIdx !== -1 && newIdx !== -1) onReorderItems?.(oldIdx, newIdx);
              }}>
              <SortableContext items={items.map(i => i._uid)} strategy={verticalListSortingStrategy}>
                <div className="bg-white">
                  {items.map(item => item.type === "block"
                    ? <SortableRichTextBlock key={item._uid} item={item} onUpdate={onUpdateItem} onRemove={onRemoveItem} />
                    : <SortableActivityRow key={item._uid || item.id} item={item}
                        availableDays={availableDays}
                        groupSize={groupSize} lang={lang}
                        onUpdate={onUpdateItem} onRemove={onRemoveItem} onResync={onResyncItem} />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
          {/* Add buttons */}
          <div className="flex flex-wrap gap-1.5 px-4 py-2.5 bg-neutral-50 border-t border-neutral-100">
            {[
              { key: "checkin",   label: "🏨 Check-in" },
              { key: "breakfast", label: lang === "es" ? "☕ Desayuno" : "☕ Breakfast" },
              { key: "checkout",  label: "🧳 Check-out" },
            ].map(({ key, label: pl }) => (
              <button key={key} type="button" onClick={() => onAddPreset?.(key)}
                className="text-xs text-teal-700 hover:text-teal-900 border border-teal-200 hover:border-teal-400 rounded-lg px-2.5 py-1.5 bg-teal-50 transition-colors">
                {pl}
              </button>
            ))}
            <button type="button" onClick={onAddManual}
              className="text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-white transition-colors">
              + Manual
            </button>
            <button type="button" onClick={onAddFromCatalog} disabled={loadingServices}
              className="text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-white disabled:opacity-40 transition-colors">
              {loadingServices ? "Cargando…" : "+ Catálogo"}
            </button>
            <button type="button" onClick={onAddBlock}
              className="text-xs text-violet-600 hover:text-violet-900 border border-violet-200 hover:border-violet-400 rounded-lg px-3 py-1.5 bg-violet-50 transition-colors">
              ✍️ Nota libre
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ITINERARY CANVAS — replaces ItineraryEditor
   Day-grouped view with true inline editing.
   Source of truth: cart (flat items) + dayMeta (day-level titles)
   Both are persisted on save and drive PDF + Travefy output.
═══════════════════════════════════════════════════════════════ */
function SortableDaySection({ label, ...props }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: label });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <DaySection label={label} dragHandleProps={{ ...attributes, ...listeners }} {...props} />
    </div>
  );
}

function ItineraryCanvas({ kickoff, onSave, onCartChange }) {
  // Parse cart/dayMeta whether they arrive as arrays or JSON strings from the Sheet
  const parseArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      try { return JSON.parse(v); } catch {}
    }
    return [];
  };
  const withUid = (arr) => {
    const seen = new Set();
    return arr.map((item, i) => {
      const uid = item._uid || `${item.id ?? "m"}_${i}_${Date.now()}`;
      if (seen.has(uid)) return { ...item, _uid: `${uid}_dup_${i}` };
      seen.add(uid);
      return { ...item, _uid: uid };
    });
  };
  const [cart,     setCart]     = useState(withUid(parseArr(kickoff?.cart)));
  const [dayMeta,  setDayMeta]  = useState(parseArr(kickoff?.dayMeta));
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [catalogTargetDay, setCatalogTargetDay] = useState(null);
  const [itineraryItems, setItineraryItems] = useState([]);

  useEffect(() => {
    fetchItineraryItems().then(items => {
      const filtered = items.filter(i => {
        const n = (i.name_en || i.name_es || "").toLowerCase();
        return !n.includes("check-in") && !n.includes("check-out") && !n.includes("checkin") && !n.includes("checkout");
      });
      setItineraryItems(filtered);
    }).catch(() => {});
  }, []);

  const daySensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const reorderDays = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setDayMeta(prev => {
      const oldIdx = prev.findIndex(dm => dm.label === active.id);
      const newIdx = prev.findIndex(dm => dm.label === over.id);
      if (oldIdx === -1 || newIdx === -1) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const reorderItemsInDay = (dayLabel, oldIdx, newIdx) => {
    setCart(prev => {
      const dayItems  = prev.filter(i => (i.dayLabel || "Sin día") === dayLabel);
      const otherItems = prev.filter(i => (i.dayLabel || "Sin día") !== dayLabel);
      const reordered = arrayMove(dayItems, oldIdx, newIdx).map((item, i) => ({ ...item, sortOrder: i }));
      return [...otherItems, ...reordered];
    });
  };

  // Sync when kickoff changes (e.g. switching between kickoffs)
  useEffect(() => {
    setCart(withUid(parseArr(kickoff?.cart)));
    setDayMeta(parseArr(kickoff?.dayMeta));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kickoff?.id]);

  // Notify parent of every cart/dayMeta change so EditDrawer can include it in the main save
  useEffect(() => {
    onCartChange?.(cart, dayMeta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, dayMeta]);

  // Load catalog once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingServices(true);
        const { fetchServicesFromSheet } = await import("./sheetServices");
        const data = await fetchServicesFromSheet();
        if (alive) setServices(data || []);
      } catch (e) { console.error(e); }
      finally { if (alive) setLoadingServices(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Build ordered day list: dayMeta order first, then any orphan cart items
  const days = useMemo(() => {
    const metaLabels = dayMeta.map(dm => dm.label);
    const extraLabels = [...new Set(
      cart.map(i => i.dayLabel || "Sin día").filter(l => !metaLabels.includes(l))
    )];
    const orderedLabels = [...metaLabels, ...extraLabels];
    if (orderedLabels.length === 0) return [];

    return orderedLabels.map(label => {
      const meta  = dayMeta.find(dm => dm.label === label) || { label, title: "", sortOrder: 99 };
      const parseTimeMin = (t) => {
        if (!t) return 9999;
        const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
        if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
        const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (m12) { let h = parseInt(m12[1]); if (m12[3].toUpperCase()==="PM"&&h!==12) h+=12; if (m12[3].toUpperCase()==="AM"&&h===12) h=0; return h*60+parseInt(m12[2]); }
        return 9999;
      };
      const items = cart
        .filter(i => (i.dayLabel || "Sin día") === label)
        .sort((a, b) => {
          const ta = parseTimeMin(a.timeLabel), tb = parseTimeMin(b.timeLabel);
          if (ta < 9999 && tb < 9999) return ta - tb;
          if (ta < 9999) return -1;
          if (tb < 9999) return 1;
          return (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
        });
      return { label, meta, items };
    });
  }, [cart, dayMeta]);

  /* ── Day helpers ── */
  const upsertDayMeta = (label, patch) =>
    setDayMeta(prev => {
      const exists = prev.find(dm => dm.label === label);
      if (exists) return prev.map(dm => dm.label === label ? { ...dm, ...patch } : dm);
      return [...prev, { label, title: "", sortOrder: prev.length, ...patch }];
    });

  const renameDayLabel = (oldLabel, newLabel) => {
    setCart(prev => prev.map(i =>
      (i.dayLabel || "Sin día") === oldLabel ? { ...i, dayLabel: newLabel } : i
    ));
    setDayMeta(prev => prev.map(dm =>
      dm.label === oldLabel ? { ...dm, label: newLabel } : dm
    ));
  };

  const addDay = () => {
    const nextNum = dayMeta.length + 1;
    const arrDate = kickoff?.arrivalDate;
    let label;
    if (arrDate) {
      const d = new Date(arrDate + "T12:00:00");
      d.setDate(d.getDate() + (nextNum - 1));
      const lang = kickoff?.lang || "en";
      label = d.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { weekday: "long", month: "long", day: "numeric" });
    } else {
      label = `Día ${nextNum}`;
    }
    setDayMeta(prev => [...prev, { label, title: "", sortOrder: prev.length }]);
  };

  const autoFillDayTitles = () => {
    const arrDate = kickoff?.arrivalDate;
    if (!arrDate) { alert("Necesitas configurar la fecha de llegada primero."); return; }
    const lang = kickoff?.lang || "en";
    const loc  = lang === "es" ? "es-CO" : "en-US";

    // Calculate total days from arrival to departure
    const depDate = kickoff?.departureDate;
    const totalDays = (() => {
      if (!depDate) return Math.max(days.length, 1);
      const diff = Math.round(
        (new Date(depDate + "T12:00:00") - new Date(arrDate + "T12:00:00")) / 86400000
      );
      return Math.max(diff, 1);
    })();

    // Build date labels for each day slot
    const dateLabels = Array.from({ length: totalDays }, (_, idx) => {
      const d = new Date(arrDate + "T12:00:00");
      d.setDate(d.getDate() + idx);
      return d.toLocaleDateString(loc, { weekday: "long", month: "long", day: "numeric" });
    });

    // Build rename map from existing day labels → new date labels
    const labelMap = {};
    days.forEach((day, idx) => {
      if (idx < dateLabels.length) labelMap[day.label] = dateLabels[idx];
    });

    // Update dayMeta: rename existing + add missing days
    setDayMeta(() => {
      const result = dateLabels.map((label, idx) => {
        const existing = days[idx];
        const oldMeta  = existing ? dayMeta.find(dm => dm.label === existing.label) : null;
        return { label, title: oldMeta?.title || "", sortOrder: idx };
      });
      return result;
    });

    // Rename cart items to new labels
    setCart(prev => prev.map(item => {
      const old = item.dayLabel || "Sin día";
      return labelMap[old] ? { ...item, dayLabel: labelMap[old] } : item;
    }));
  };

  const removeDay = (label) => {
    if (!window.confirm(`¿Eliminar "${label}" y todas sus actividades?`)) return;
    setCart(prev => prev.filter(i => (i.dayLabel || "Sin día") !== label));
    setDayMeta(prev => prev.filter(dm => dm.label !== label));
  };

  /* ── Item helpers ── */
  const updateItem = (uid, patch) =>
    setCart(prev => prev.map(i => i._uid === uid ? { ...i, ...patch } : i));

  const removeItem = (uid) =>
    setCart(prev => prev.filter(i => i._uid !== uid));

  const resyncItem = (uid) => {
    const item = cart.find(i => i._uid === uid);
    if (!item || !item.sku) return;
    const svc = services.find(s => s.sku === item.sku);
    if (!svc) { alert("No se encontró el servicio en el catálogo. Puede que el SKU haya cambiado."); return; }
    const groupSizeN = parseInt(kickoff?.groupSize, 10) || 1;
    const updated = mapSvcToCartItem(svc, groupSizeN);
    // Keep concierge-specific fields, update catalog-sourced fields
    setCart(prev => prev.map(i => i._uid !== uid ? i : {
      ...i,
      name: updated.name,
      name_en: updated.name_en,
      description_es: updated.description_es,
      description_en: updated.description_en,
      price_cop: updated.price_cop,
      price_tier_1: updated.price_tier_1,
      price_tier_2: updated.price_tier_2,
      base_price_cop: updated.base_price_cop,
      priceUnit: updated.priceUnit,
      priceUsd: updated.priceUsd,
      quickbooksCode: updated.quickbooksCode,
      category: updated.category,
      subcategory: updated.subcategory,
    }));
  };

  const addBlockToDay = (dayLabel) => {
    const count = cart.filter(i => (i.dayLabel || "Sin día") === dayLabel).length;
    setCart(prev => [...prev, {
      _uid: `block_${Date.now()}_${Math.random()}`,
      type: "block", html: "", dayLabel, sortOrder: count,
    }]);
  };

  const addManualToDay = (dayLabel) => {
    const count = cart.filter(i => (i.dayLabel || "Sin día") === dayLabel).length;
    setCart(prev => [...prev, { ...mapManualToCartItem(), dayLabel, sortOrder: count }]);
  };

  const addPresetToDay = (dayLabel, preset) => {
    const accom = kickoff?.accommodationName || "";
    const checkinTime  = kickoff?.checkIn  || "3:00 PM";
    const checkoutTime = kickoff?.checkOut || "11:00 AM";
    const lang = kickoff?.lang || "en";
    const presets = {
      checkin: {
        name: "Check-in", name_en: "Check-in", category: "services",
        timeLabel: checkinTime,
        ...(accom ? { location: accom } : {}),
        description_es: `Su villa estará disponible a partir de las ${checkinTime}.${accom ? ` Nos encontraremos en ${accom} para acompañarlos durante el proceso de check-in.` : " Estaremos con ustedes para acompañarlos durante el proceso."} Por favor avísennos su hora estimada de llegada.`,
        description_en: `Your villa will be available from ${checkinTime}.${accom ? ` We will meet you at ${accom} to accompany you through the check-in process.` : " We will be there to accompany you through the process."} Please let us know your estimated arrival time.`,
      },
      breakfast: (() => {
        const s = itineraryItems.find(i => /breakfast/i.test(i.name_en) || /desayuno/i.test(i.name_es));
        return {
          name:    s?.name_es || "Desayuno en la Villa",
          name_en: s?.name_en || "Breakfast at the Villa",
          category: "services",
          timeLabel: "8:00 AM",
          ...(s?.image ? { image: s.image } : {}),
          description_es: s?.description_es || "Una mezcla de desayunos locales e internacionales será servida en su comedor. El servicio de cocinero está incluido con el alquiler de la villa.",
          description_en: s?.description    || "A mix of local and international breakfast dishes will be served in your dining room. Cook service is included with the villa rental.",
        };
      })(),
      checkout: {
        name: "Check-out", name_en: "Check-out", category: "services",
        timeLabel: checkoutTime,
        ...(accom ? { location: accom } : {}),
        description_es: `El check-out es a las ${checkoutTime}.${accom ? ` Si necesitan guardar equipaje en ${accom} o coordinar un late check-out, por favor avísennos con anticipación.` : " Si necesitan guardar equipaje o coordinar un late check-out, avísennos con anticipación."}`,
        description_en: `Check-out is at ${checkoutTime}.${accom ? ` If you need to store luggage at ${accom} or arrange a late check-out, please let us know in advance.` : " If you need to store luggage or arrange a late check-out, please let us know in advance."}`,
      },
    };
    const p = presets[preset];
    if (!p) return;
    const uid = `preset_${preset}_${Date.now()}`;
    const count = cart.filter(i => (i.dayLabel || "Sin día") === dayLabel).length;
    setCart(prev => [...prev, { ...mapManualToCartItem(), ...p, _uid: uid, id: uid, dayLabel, sortOrder: count }]);
  };

  /* ── Generate tasks from cart ── */
  const [generating, setGenerating] = useState(false);
  const handleGenerateTasks = async () => {
    if (!cart.length) return alert("No hay servicios en el itinerario.");
    const concierge = kickoff?.assignedConciergeName || kickoff?.assignedConcierge || "";
    const email     = CONCIERGE_LIST.find(c => c.name === concierge)?.email || kickoff?.assignedConciergeEmail || "";
    const guestName = kickoff?.guestName || kickoff?.tripName || "";
    const arrival   = kickoff?.arrivalDate || kickoff?.checkIn || "";
    // Due date = arrival - 2 days, or empty
    const dueDate = (() => {
      if (!arrival) return "";
      const d = new Date(arrival);
      if (isNaN(d)) return "";
      d.setDate(d.getDate() - 2);
      return d.toISOString().slice(0, 10);
    })();
    const priorityFor = (cat) => {
      const c = String(cat||"").toLowerCase();
      if (/restauran|chef|food|dining/.test(c)) return "alta";
      if (/tour|activit|excursion/.test(c))     return "media";
      return "media";
    };
    setGenerating(true);
    let count = 0;
    for (const item of cart) {
      const name = item.name || item.serviceName || "";
      if (!name) continue;
      const payload = {
        taskName:     `Confirmar: ${name}`,
        assignedTo:   concierge,
        assignedEmail: email,
        dueDate,
        status:       "pending",
        priority:     priorityFor(item.category),
        notes:        item.dayLabel ? `Día: ${item.dayLabel}` : "",
        kickoffId:    kickoff?.id   || "",
        kickoffName:  guestName,
        createdAt:    new Date().toISOString(),
      };
      try {
        await fetch(TASK_API_URL, {
          method: "POST", mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "saveTask", payload }),
        });
        count++;
      } catch {}
    }
    setGenerating(false);
    alert(`✅ ${count} tarea${count!==1?"s":""} generada${count!==1?"s":""} en el Task Tracker.`);
  };

  /* ── Save ── */
  const handleSave = async () => {
    try {
      setSaving(true);
      // Rebuild flat cart with clean sortOrders per day, deduplicating by _uid
      const newCart = [];
      const seenUids = new Set();
      days.forEach(({ label, items }) =>
        items.forEach((item, i) => {
          if (item._uid && seenUids.has(item._uid)) return;
          if (item._uid) seenUids.add(item._uid);
          newCart.push({ ...item, dayLabel: label, sortOrder: i });
        })
      );
      await onSave(newCart, dayMeta);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el itinerario.");
    } finally {
      setSaving(false);
    }
  };

  if (!kickoff) return null;

  const totalActivities = days.reduce((n, d) => n + d.items.length, 0);

  return (
    <div className="space-y-3">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-neutral-400">
          {days.length} {days.length === 1 ? "día" : "días"} · {totalActivities} actividades
          {loadingServices && " · Cargando catálogo…"}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={addDay}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs hover:bg-neutral-50 text-neutral-600">
            + Agregar día
          </button>
          {days.length > 0 && (
            <button type="button" onClick={autoFillDayTitles}
              title="Renombrar días con día de semana y fecha según la fecha de llegada"
              className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs hover:bg-amber-100">
              🗓️ Auto-fechas
            </button>
          )}
          <button type="button" onClick={handleGenerateTasks} disabled={generating || !cart.length}
            title="Crea una tarea de confirmación por cada servicio del itinerario"
            className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 disabled:opacity-40 transition">
            {generating ? "Generando…" : "✨ Generar tareas"}
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs hover:bg-neutral-800 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar itinerario"}
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {days.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-neutral-200 rounded-2xl">
          <p className="text-sm text-neutral-400 mb-3">No hay días aún.</p>
          <button type="button" onClick={addDay}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs">
            + Crear primer día
          </button>
        </div>
      )}

      {/* ── Day sections (drag to reorder) ── */}
      <DndContext sensors={daySensors} collisionDetection={closestCenter} onDragEnd={reorderDays}>
        <SortableContext items={days.map(d => d.label)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {days.map(({ label, meta, items }) => (
              <SortableDaySection
                key={label}
                label={label}
                meta={meta}
                items={items}
                loadingServices={loadingServices}
                availableDays={days.map(d => d.label)}
                groupSize={parseInt(kickoff?.groupSize || "1", 10) || 1}
                lang={kickoff?.lang || "en"}
                onUpdateMeta={patch => upsertDayMeta(label, patch)}
                onRenameLabel={newLabel => renameDayLabel(label, newLabel)}
                onRemoveDay={() => removeDay(label)}
                onUpdateItem={updateItem}
                onRemoveItem={removeItem}
                onResyncItem={resyncItem}
                onReorderItems={(oldIdx, newIdx) => reorderItemsInDay(label, oldIdx, newIdx)}
                onAddManual={() => addManualToDay(label)}
                onAddPreset={(preset) => addPresetToDay(label, preset)}
                onAddBlock={() => addBlockToDay(label)}
                onAddFromCatalog={() => setCatalogTargetDay(label)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Bottom "+ Add day" button */}
      {days.length > 0 && (
        <button type="button" onClick={addDay}
          className="w-full py-2 rounded-xl border-2 border-dashed border-neutral-200 text-xs text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition">
          + Agregar día
        </button>
      )}

      {/* Catalog picker modal (per-day) */}
      {catalogTargetDay && (
        <CatalogPickerModal
          services={services}
          clientType={kickoff?.clientType || 1}
          lang={kickoff?.lang || "en"}
          city={kickoff?.city || kickoff?.destination || ""}
          onClose={() => setCatalogTargetDay(null)}
          onPick={svc => {
            const count = cart.filter(i => (i.dayLabel || "Sin día") === catalogTargetDay).length;
            const newItem = mapServiceToCartItem(svc, kickoff?.clientType || 1, parseInt(kickoff?.groupSize || "1") || 1);
            const lang = kickoff?.lang || "en";
            setCart(prev => [...prev, {
              ...newItem,
              _uid: `${newItem.id}_${Date.now()}_${Math.random()}`,
              dayLabel: catalogTargetDay,
              sortOrder: count,
              displayName: lang === "en" ? (svc.name_en || svc.name || "") : (svc.name || ""),
            }]);
            setCatalogTargetDay(null);
          }}
        />
      )}
    </div>
  );
}

function TierPickerModal({ title, kickoff, kind, onClose }) {
  if (!kickoff) return null;

  const getLink = (tier) => {
    if (kind === "catalog") return buildCatalogLink(kickoff, tier);
    return buildQuestionnaireLink(kickoff, tier);
  };

  const ActionRow = ({ tier, label }) => {
    const link = getLink(tier);

    return (
      <div className="border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">{label}</div>
          <div className="text-[11px] font-mono text-neutral-600 break-all">{link}</div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
              } catch {
                prompt("Copia este link:", link);
              }
            }}
            className="px-3 py-2 rounded-lg border border-neutral-300 text-xs hover:bg-neutral-100"
          >
            Copiar
          </button>

          <button
            type="button"
            onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
            className="px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs hover:bg-neutral-950"
          >
            Abrir
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Cerrar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-neutral-600">
          {kickoff.guestName ? (
            <>Cliente: <span className="font-semibold">{kickoff.guestName}</span></>
          ) : (
            <span className="italic">Sin nombre</span>
          )}
          {" · "}
          {kickoff.tripName ? (
            <>Viaje: <span className="font-semibold">{kickoff.tripName}</span></>
          ) : (
            <span className="italic">Sin título</span>
          )}
        </div>

        <ActionRow tier={1} label="Cliente Tipo 1" />
<ActionRow tier={2} label="Cliente Tipo 2" />
      </div>
    </Modal>
  );
}







/* =========================================
   Modal base
   ========================================= */



/* Small reusable "copy link" button with ✓ feedback */
function CopyIconButton({ url, borderClass = "border-gray-300 text-blue-600 bg-white hover:bg-blue-50" }) {
  const [cp, setCp] = React.useState(false);
  return (
    <button type="button" title={url}
      onClick={() => { navigator.clipboard.writeText(url).catch(()=>{}); setCp(true); setTimeout(()=>setCp(false),2000); }}
      className={`px-2 py-2 rounded-r-lg border border-l-0 text-xs ${borderClass}`}
    >{cp ? "✓" : "📋"}</button>
  );
}

function CopyLinkButton({ url, label = "🔗 Link" }) {
  const [copied, setCopied] = React.useState(false);
  const handle = async () => {
    try { await navigator.clipboard.writeText(url); }
    catch { prompt("Copia este link:", url); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handle}
      className="px-3 py-2 rounded-r-lg border border-l-0 border-gray-300 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors"
      title="Copiar link para compartir con el cliente — siempre muestra el itinerario actualizado"
    >
      {copied ? "✓ Copiado" : label}
    </button>
  );
}

function Modal({ title, children, footer, onClose, maxWidth = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full ${maxWidth} bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-sm sm:text-base font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t bg-neutral-50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================
   Modal: Ver Resumen
   ========================================= */

function SummaryModal({ kickoff, onClose }) {
  const [copiedMsg, setCopiedMsg] = React.useState(false);
  if (!kickoff) return null;

  const lang = kickoff.lang || "en";
  const ct   = kickoff.clientType || 1;
  const isEs = lang === "es";
  const name = (kickoff.guestName || "").split(" ")[0] || (isEs ? "viajero" : "traveler");
  const link = buildOnboardLink(kickoff, ct, lang);
  const quizMsg = isEs
    ? `Hola ${name} 👋 Bienvenido/a a Two Travel. Aquí tienes tu acceso personalizado — en este link vas a encontrar la bienvenida a tu viaje, un cuestionario rápido y luego el catálogo con todas las experiencias disponibles para ti:\n\n${link}`
    : `Hi ${name} 👋 Welcome to Two Travel! Here's your personalized access — this link takes you through your trip welcome, a quick questionnaire, and then the full catalog of experiences available for you:\n\n${link}`;

  const handleCopyMsg = async () => {
    try { await navigator.clipboard.writeText(quizMsg); } catch { prompt("Copia este mensaje:", quizMsg); }
    setCopiedMsg(true); setTimeout(() => setCopiedMsg(false), 2000);
  };

  return (
    <Modal
      title={`Resumen – ${
        kickoff.tripName || kickoff.guestName || kickoff.id
      }`}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cerrar
          </button>
          
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-neutral-500">ID</p>
            <p className="font-mono text-neutral-900 text-xs sm:text-sm">
              {kickoff.id}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-500">Huésped</p>
            <p className="text-neutral-900">
              {kickoff.guestName || (
                <span className="italic text-neutral-400">Sin nombre</span>
              )}
            </p>
          </div>
          <div>
  <p className="text-[11px] text-neutral-500">Contacto</p>
  <p className="text-neutral-900">
    {kickoff.guestContact ? (
      kickoff.guestContact
    ) : (
      <span className="italic text-neutral-400">Sin contacto</span>
    )}
  </p>
</div>
          <div>
            <p className="text-[11px] text-neutral-500">Viaje</p>
            <p className="text-neutral-900">
              {kickoff.tripName || (
                <span className="italic text-neutral-400">Sin título</span>
              )}
            </p>
          </div>
          <div className="text-right text-[11px] text-neutral-500 space-y-0.5">
            <p>📅 Creado: <span className="text-neutral-700">{formatDateTime(kickoff.createdAt)}</span></p>
            {kickoff.clientSubmittedAt && <p>✅ Cliente envió: <span className="text-neutral-700">{formatDateTime(kickoff.clientSubmittedAt)}</span></p>}
            {kickoff.conciergeEditingAt && <p>✏️ Concierge editó: <span className="text-neutral-700">{formatDateTime(kickoff.conciergeEditingAt)}</span></p>}
            {kickoff.feedbackAt && <p>💬 Feedback: <span className="text-neutral-700">{formatDateTime(kickoff.feedbackAt)}</span></p>}
            {kickoff.conciergeRating > 0 && (
              <p>⭐ Rating interno: <span className="text-amber-600 font-semibold">{(() => { const r = Math.min(5, Math.max(0, Number(kickoff.conciergeRating)||0)); return "★".repeat(r) + "☆".repeat(5-r); })()}</span></p>
            )}
          </div>
          <div className="ml-auto">
            <StatusBadge status={kickoff.status} />
          </div>
        </div>

        <div className="space-y-2">
  <div className="flex items-center justify-between gap-2">
    <h3 className="text-sm font-semibold text-neutral-900">Itinerario</h3>

    
  </div>

  
  
</div>


        {/* ── Briefing de Ventas ── */}
        {(kickoff.briefHasHouse || kickoff.briefHasBoat || kickoff.briefBudget || kickoff.briefDietary || kickoff.briefPurpose || kickoff.briefNotes) && (() => {
          const budgetLabel = { economy:"$ Economy", standard:"$$ Standard", premium:"$$$ Premium", luxury:"$$$$ Luxury", ultra:"$$$$$ Ultra-Luxury" };
          const purposeLabel = { cumpleanos:"🎂 Cumpleaños", aniversario:"💑 Aniversario", despedida_soltero:"🥂 Despedida de soltero/a", vacaciones:"🏖️ Vacaciones", corporativo:"💼 Corporativo", boda:"💍 Boda", otro:"✨ Otro" };
          const yesno = v => v === "si" ? "✅ Sí" : v === "no" ? "❌ No" : v === "por_confirmar" ? "⏳ Por confirmar" : v;
          const rows = [
            kickoff.briefPurpose   && { label:"🎯 Motivo",       val: purposeLabel[kickoff.briefPurpose] || kickoff.briefPurpose },
            kickoff.briefBudget    && { label:"💰 Tier/Budget",  val: budgetLabel[kickoff.briefBudget] || kickoff.briefBudget },
            kickoff.briefHasHouse  && { label:"🏠 Casa",         val: yesno(kickoff.briefHasHouse) },
            kickoff.briefHasBoat   && { label:"⛵ Bote",         val: yesno(kickoff.briefHasBoat) },
            kickoff.briefDietary   && { label:"🥗 Restricciones",val: kickoff.briefDietary },
          ].filter(Boolean);
          return (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-violet-800">📋 Briefing de Ventas</p>
              {rows.map(({label, val}) => (
                <div key={label} className="flex gap-2 text-xs">
                  <span className="text-neutral-500 w-28 shrink-0">{label}</span>
                  <span className="text-neutral-900 font-medium">{val}</span>
                </div>
              ))}
              {kickoff.briefNotes && (
                <div className="flex gap-2 text-xs mt-1 pt-1 border-t border-violet-200">
                  <span className="text-neutral-500 w-28 shrink-0">📝 Nota</span>
                  <span className="text-neutral-900">{kickoff.briefNotes}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Mensaje cuestionario ── */}
        {link && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-emerald-800">📲 Mensaje para enviar cuestionario</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopyMsg}
                  className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white text-[11px] hover:bg-emerald-800 transition"
                >
                  {copiedMsg ? "✓ Copiado" : "Copiar"}
                </button>
                <a
                  href={`https://wa.me/${(kickoff.guestContact||"").replace(/\D/g,"")}?text=${encodeURIComponent(quizMsg)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded-lg bg-green-600 text-white text-[11px] hover:bg-green-700 transition"
                >
                  WhatsApp
                </a>
              </div>
            </div>
            <pre className="text-[11px] text-neutral-700 whitespace-pre-wrap font-sans">{quizMsg}</pre>
          </div>
        )}

        {/* ── Quiz answers ── */}
        {(() => {
          let q = null;
          try { q = JSON.parse(kickoff.quizAnswers || "null"); } catch {}
          if (!q) return null;
          const vibeMap = { relax:"🏖 Relax", party:"🎉 Nightlife", romantic:"🌹 Romántico", family:"👨‍👩‍👧 Familia", adventure:"🏄 Aventura" };
          const budgetMap = { low:"$ Económico", mid:"$$ Medio", high:"$$$ Alto" };
          const rows = [
            q.groupSize  && { label:"👥 Personas",   val: q.groupSize },
            q.vibes?.length  && { label:"🎭 Vibe",       val: (q.vibes||[]).map(v=>vibeMap[v]||v).join(", ") },
            q.budget     && { label:"💰 Presupuesto", val: budgetMap[q.budget] || q.budget },
            q.kids==="yes"   && { label:"👶 Niños",      val: "Sí" },
            q.cuisines?.length && { label:"🍽 Cocinas",    val: (q.cuisines||[]).join(", ") },
            q.interests?.length && { label:"🎯 Intereses",  val: (q.interests||[]).join(", ") },
          ].filter(Boolean);
          if (!rows.length) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800">📋 Respuestas del cuestionario</p>
              {rows.map(({label, val}) => (
                <div key={label} className="flex gap-2 text-xs">
                  <span className="text-neutral-500 w-28 shrink-0">{label}</span>
                  <span className="text-neutral-900 font-medium">{val}</span>
                </div>
              ))}
              {kickoff.additionalNotes && (
                <div className="flex gap-2 text-xs mt-1 pt-1 border-t border-amber-200">
                  <span className="text-neutral-500 w-28 shrink-0">📝 Notas extra</span>
                  <span className="text-neutral-900">{kickoff.additionalNotes}</span>
                </div>
              )}
            </div>
          );
        })()}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              Ítems seleccionados por el cliente
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <Clock className="w-3 h-3" />
              {(kickoff.cart || []).length} ítems
            </span>
          </div>

          {(!kickoff.cart || kickoff.cart.length === 0) && (
            <p className="text-xs text-neutral-500">
              No hay ítems guardados para este kick-off.
            </p>
          )}

          {kickoff.cart && kickoff.cart.length > 0 && (
            <ul className="border border-neutral-100 rounded-lg divide-y divide-neutral-100 bg-white">
              {kickoff.cart.map((item, idx) => (
                <li key={`${item.id || item.name}-${idx}`} className="p-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                        {idx + 1}. {item.displayName || item.name}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {item.category || "—"}
                        {item.priceUnit ? ` · ${item.priceUnit}` : ""}
                      </p>
                    </div>
                    {/* Only show COP price for categories that have exact pricing (tours, services, transportation) */}
                    {(() => {
                      const cat = String(item.category || "").toLowerCase();
                      const usesLevels = ["restaurants","bars","beach-clubs","nightlife"].includes(cat);
                      const price = item.priceOverride_cop || item.price_cop;
                      if (usesLevels) {
                        // Show price-level indicator instead of COP
                        const lvl = item.priceLevel || (price >= 300000 ? "$$$" : price >= 150000 ? "$$" : price ? "$" : null);
                        return lvl ? (
                          <span className="text-xs text-neutral-500 whitespace-nowrap">{lvl}</span>
                        ) : null;
                      }
                      return price ? (
                        <p className="text-xs text-neutral-800 text-right whitespace-nowrap">
                          {formatPriceCOP(price)}
                        </p>
                      ) : null;
                    })()}
                  </div>
                  {item.notes && (
                    <p className="mt-1 text-[11px] text-neutral-700">
                      <span className="font-semibold">Notas: </span>
                      {item.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}


/* =========================================
   Modal confirmar eliminación
   ========================================= */

/* =========================================
   Concierge Rating Modal
   Shown before sharing the feedback link.
   Saves a 1-5 star internal rating to the kickoff.
   ========================================= */
function ConciergeRatingModal({ kickoff, onSave, onClose }) {
  const [route,         setRoute]         = useState("no_review"); // "did_review" | "no_review"
  const [rating,        setRating]        = useState(kickoff?.conciergeRating || 0);
  const [hover,         setHover]         = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [msgLang,       setMsgLang]       = useState("en");
  const [copied,        setCopied]        = useState("");

  const feedbackLink = kickoff
    ? buildFeedbackLink(kickoff, Number(kickoff.clientType ?? 1), msgLang)
    : "";

  const copyText = async (text, key) => {
    try { await navigator.clipboard.writeText(text); }
    catch { prompt("Copia:", text); }
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(route === "did_review" ? 0 : rating);
    setSaving(false);
  };

  // ── Route: DID review (skip star ask, just send form) ──
  const MSG_DID_REVIEW = {
    en: `Thank you so much for sharing your experience! ✨\n\nIf you have 2 minutes, we'd love a bit more detail to keep improving:\n\n${feedbackLink}`,
    es: `¡Muchas gracias por compartir tu experiencia! ✨\n\nSi tienes 2 minutos, nos encantaría conocer un poco más para seguir mejorando:\n\n${feedbackLink}`,
  };

  // ── Route: NO review (ask stars first, then form) ──
  const MSG_ASK_STARS = {
    en: `Your trip may be coming to an end, but our commitment to your experience never does.\n\nHow would you rate our overall concierge assistance (1–5 ⭐)?\n\n⭐⭐⭐⭐⭐ — Exceptional\n⭐⭐⭐⭐ — Great\n⭐⭐⭐ — Good\n⭐⭐ — Could be better\n⭐ — Poor\n\n(Simply reply with a number 1–5 or use emojis!)`,
    es: `Puede que tu viaje esté llegando a su fin, pero nuestro compromiso con tu experiencia continúa.\n\n¿Cómo calificarías nuestra asistencia de conserjería en general (1–5 ⭐)?\n\n⭐⭐⭐⭐⭐ — Excepcional\n⭐⭐⭐⭐ — Muy bueno\n⭐⭐⭐ — Bueno\n⭐⭐ — Puede mejorar\n⭐ — Deficiente\n\n(¡Responde con un número del 1 al 5 o con emojis!)`,
  };
  const isPositive = rating >= 4;
  const MSG_FOLLOWUP_HIGH = {
    en: `Thank you so much for your feedback! ✨\n\nIf you have a moment, we'd truly appreciate a bit more insight to help us keep improving — it'll take under 2 minutes:\n\n${feedbackLink}`,
    es: `¡Muchísimas gracias por tu feedback! ✨\n\nSi tienes un momento, nos encantaría conocer un poco más para seguir mejorando la experiencia — te prometemos que tomará menos de 2 minutos:\n\n${feedbackLink}`,
  };
  const MSG_FOLLOWUP_LOW = {
    en: `Thank you so much for the feedback, and we truly apologize for not meeting your expectations.\n\nIf you have time, we'd really appreciate a bit more detail to understand what could have gone better — it'll take under 2 minutes:\n\n${feedbackLink}`,
    es: `Muchas gracias por tus comentarios y realmente te pedimos disculpas por no haber cumplido con tus expectativas.\n\nSi tienes unos minutos, agradeceríamos que pudieras compartir un poco más de detalle — tomará menos de 2 minutos:\n\n${feedbackLink}`,
  };
  const MSG_NO_REPLY = {
    en: `We noticed you haven't had a chance to share your thoughts — totally understandable! ✨\n\nIf you have a moment, we'd love to hear how everything went. It'll take under 2 minutes:\n\n${feedbackLink}`,
    es: `Notamos que aún no has tenido la oportunidad de compartir tus comentarios — ¡lo entendemos perfectamente! ✨\n\nSi en algún momento tienes un minuto, nos encantaría saber cómo salió todo. No se demora más de 2 minutos:\n\n${feedbackLink}`,
  };

  const MsgBlock = ({ label, text, copyKey, color = "#3730a3", bg = "#f8faff", border = "#e0e7ff" }) => (
    <div style={{ background: bg, borderRadius: 10, padding: "10px 12px", marginBottom: 10, border: `1px solid ${border}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color, margin: 0 }}>{label}</p>
        <button type="button" onClick={() => copyText(text, copyKey)} style={{
          padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer",
          background: copied === copyKey ? "#16a34a" : "#111",
          color: "#fff", border: "none", fontWeight: 600, flexShrink: 0, transition: "background .15s",
        }}>
          {copied === copyKey ? "✓ Copiado" : "Copiar"}
        </button>
      </div>
      <pre style={{ fontSize: 11, color: "#4b5563", whiteSpace: "pre-wrap", margin: 0, fontFamily: "system-ui, sans-serif", lineHeight: 1.6, maxHeight: 120, overflowY: "auto" }}>
        {text}
      </pre>
    </div>
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,.2)", fontFamily: "system-ui, sans-serif" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 0" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111", margin: "0 0 2px" }}>Feedback — {kickoff?.guestName}</h3>
          {kickoff?.tripName && <p style={{ fontSize: 12, color: "#aaa", margin: "0 0 16px" }}>{kickoff.tripName}</p>}

          {/* Route tabs */}
          <div style={{ display: "flex", gap: 0, border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
            {[
              { key: "no_review", label: "No hizo review — pedir estrellas" },
              { key: "did_review", label: "Ya hizo review" },
            ].map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setRoute(key)} style={{
                flex: 1, padding: "8px 4px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: "none",
                background: route === key ? "#111" : "#f9fafb",
                color: route === key ? "#fff" : "#6b7280",
                transition: "background .12s",
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* Lang toggle */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginBottom: 12 }}>
            {["en","es"].map(l => (
              <button key={l} type="button" onClick={() => setMsgLang(l)} style={{
                padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: "pointer", border: "1px solid",
                background: msgLang === l ? "#111" : "#fff", color: msgLang === l ? "#fff" : "#666", borderColor: msgLang === l ? "#111" : "#ddd",
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 24px 8px" }}>

          {/* ── RUTA: YA HIZO REVIEW ── */}
          {route === "did_review" && (
            <MsgBlock
              label="Mensaje directo — link al form"
              text={MSG_DID_REVIEW[msgLang]}
              copyKey="did_review_main"
              color="#059669" bg="#f0fdf4" border="#bbf7d0"
            />
          )}

          {/* ── RUTA: NO HIZO REVIEW ── */}
          {route === "no_review" && (<>
            {/* Stars (internal) */}
            <div style={{ textAlign: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Calificación interna (guardar en sistema)</p>
              <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star} type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    style={{ fontSize: 30, cursor: "pointer", background: "none", border: "none", padding: "2px", color: star <= (hover || rating) ? "#f59e0b" : "#e5e7eb", transition: "color .1s" }}>
                    ★
                  </button>
                ))}
              </div>
              {rating > 0 && <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{["","😕 Hubo problemas","😐 Por mejorar","🙂 Bien","😊 Muy bien","🌟 Perfecto"][rating]}</p>}
            </div>

            <MsgBlock label="Paso 1 — Pedir calificación" text={MSG_ASK_STARS[msgLang]} copyKey="ask_stars" />

            {rating > 0 ? (
              <MsgBlock
                label={isPositive ? "Follow-up — respuesta alta (4–5)" : "Follow-up — respuesta baja (1–3)"}
                text={isPositive ? MSG_FOLLOWUP_HIGH[msgLang] : MSG_FOLLOWUP_LOW[msgLang]}
                copyKey="followup"
                color={isPositive ? "#15803d" : "#c2410c"}
                bg={isPositive ? "#f0fdf4" : "#fff7ed"}
                border={isPositive ? "#bbf7d0" : "#fed7aa"}
              />
            ) : (
              <div style={{ textAlign: "center", padding: "10px", background: "#f9fafb", borderRadius: 10, border: "1px dashed #e5e7eb", marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: "#d1d5db", margin: 0 }}>Selecciona las estrellas para ver el follow-up</p>
              </div>
            )}

            <MsgBlock label="Sin respuesta — follow-up" text={MSG_NO_REPLY[msgLang]} copyKey="no_reply" color="#6b7280" bg="#f8f8f8" border="#e5e7eb" />
          </>)}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "12px 24px 20px" }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, cursor: "pointer", background: "#fff", color: "#666" }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={{
            padding: "8px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: "#111", color: "#fff", transition: "opacity .15s", opacity: saving ? .6 : 1,
          }}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>

      </div>
    </div>
  );
}


async function copyAndOpen(link) {
  if (!link) return alert("No se pudo generar el link.");

  const win = window.open(link, "_blank", "noopener,noreferrer");

  try {
    await navigator.clipboard.writeText(link);
  } catch {
    prompt("Copia este link:", link);
  }

  if (!win) alert("Popup bloqueado. Link copiado ✅");
}

async function ensureKickoffReady(
  selectedKickoffForLink,
  setKickoffs,
  setSelectedKickoffForLink
) {
  if (!selectedKickoffForLink) {
    const guestName = (prompt("Nombre del cliente:") || "").trim();
    if (!guestName) return null;

    const tripName = (prompt("Nombre del viaje:") || "").trim();
    const guestContact = (prompt("Contacto (WhatsApp o email):") || "").trim();

    const cityRaw = (prompt("Ciudad destino:\n1 = Cartagena\n2 = Medellín\n3 = CDMX\n4 = Tulum\n5 = Otra") || "1").trim();
    const cityMap = { "1": "cartagena", "2": "medellín", "3": "cdmx", "4": "tulum" };
    const city = cityMap[cityRaw] || cityRaw.toLowerCase() || "cartagena";

    const clientType = window.confirm("¿Cliente Tipo 2? (OK = Sí, Cancel = Tipo 1)") ? 2 : 1;

const kickoffId = `ko_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const created = await saveKickoffToSheet({
      id: kickoffId,
      guestName,
      tripName,
      guestContact,
      clientType,
      city,
      createdAt: new Date().toISOString(),
      status: "new",
      conciergeSummary: "",

      internalNotes: "",
      cart: [],
    });

    const kickoff = {
      ...created,
      id: created?.id || kickoffId,
      guestName,
      tripName,
      guestContact,
      clientType: Number(created?.clientType || 1),
    };

    setKickoffs((prev) => [kickoff, ...(prev || [])]);
    setSelectedKickoffForLink(kickoff);
    return kickoff;
  }

  let updates = {};
  let changed = false;

  if (!String(selectedKickoffForLink.guestName || "").trim()) {
    const guestName = (prompt("Nombre del cliente:") || "").trim();
    if (!guestName) return null;
    updates.guestName = guestName;
    changed = true;
  }

  if (!String(selectedKickoffForLink.tripName || "").trim()) {
    const tripName = (prompt("Nombre del viaje:") || "").trim();
    updates.tripName = tripName;
    changed = true;
  }

  if (!String(selectedKickoffForLink.guestContact || "").trim()) {
    const guestContact = (prompt("Contacto (WhatsApp o email):") || "").trim();
    updates.guestContact = guestContact;
    changed = true;
  }

  if (changed) {
    await updateKickoffInSheet(selectedKickoffForLink.id, updates);

    const updated = { ...selectedKickoffForLink, ...updates };

    setKickoffs((prev) =>
      (prev || []).map((k) => (k.id === updated.id ? updated : k))
    );
    setSelectedKickoffForLink(updated);

    return updated;
  }

  return selectedKickoffForLink;
}

// Small normalizer so ConciergePanel picks match any sheet category value
function normCatPanel(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (/chef|private.?chef|chef.?privado/.test(v)) return "chef";
  if (/restauran|comida|food/.test(v)) return "restaurants";
  if (/beach.?club|playa/.test(v)) return "beach-clubs";
  if (/\btour\b|activid|excursion/.test(v)) return "tours";
  if (/transport|transfer|traslado/.test(v)) return "transportation";
  // bars/rooftop/lounge/cocktail → nightlife (bars is a sub-type)
  if (/night|discoteca|club\b|\bbar\b|bares|coctel|rooftop|lounge|cocktail/.test(v)) return "nightlife";
  return v;
}

// Nightlife covers bars, rooftops, lounges — all under one section
const SUGGESTION_CATS = [
  { id: "restaurants",    ids: ["restaurants"],              label: "🍽 Restaurantes" },
  { id: "nightlife",      ids: ["nightlife"],                label: "🍹 Bares & Nightlife" },
  { id: "beach-clubs",    ids: ["beach-clubs","boating"],    label: "⛵ Boating & Beach" },
  { id: "tours",          ids: ["tours"],                    label: "🗺 Tours" },
  { id: "transportation", ids: ["transportation"],           label: "🚗 Transporte" },
  { id: "chef",           ids: ["chef"],                     label: "👨‍🍳 Chef Privado" },
  { id: "services",       ids: ["services"],                 label: "✨ Servicios" },
];

function CatalogPickerModal({ services, clientType = 1, lang = "en", city = "", onClose, onPick }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  // Resolve city code (CTG, MDE, CDMX, TUL, BOG) from any format
  const CITY_ALIASES = {
    CTG:  ["ctg","cartagena","cartagena de indias"],
    MDE:  ["mde","medellin","medellín"],
    CDMX: ["cdmx","mexico","ciudad de mexico","ciudad de méxico","cdmx"],
    TUL:  ["tul","tulum"],
    BOG:  ["bog","bogota","bogotá"],
  };
  const toCityCode = (raw) => {
    const s = String(raw || "").split(",")[0].trim().toLowerCase();
    if (!s) return "";
    for (const [code, aliases] of Object.entries(CITY_ALIASES)) {
      if (aliases.includes(s) || s === code.toLowerCase()) return code;
    }
    return s.toUpperCase();
  };
  const CITY_LABELS = { CTG:"Cartagena", MDE:"Medellín", CDMX:"Ciudad de México", TUL:"Tulum", BOG:"Bogotá" };

  // All city codes in this kickoff (multi-city trips have comma-separated values)
  const kickoffCityCodes = useMemo(() => {
    return String(city || "").split(",").map(c => toCityCode(c.trim())).filter(Boolean);
  }, [city]);
  const kickoffCityCode = kickoffCityCodes[0] || ""; // primary city

  const [catalogCityFilter, setCatalogCityFilter] = useState(kickoffCityCode);

  // Base list: filter by currently selected city tab
  const cityServices = useMemo(() => {
    const filterCode = catalogCityFilter || kickoffCityCode;
    if (!filterCode) return services || [];
    return (services || []).filter((s) => {
      const sCity = String(s.city || "").trim();
      if (!sCity) return filterCode === "CTG";
      return toCityCode(sCity) === filterCode;
    });
  }, [services, catalogCityFilter, kickoffCityCode]);

  // Suggested: 2 per category, in SUGGESTION_CATS order
  const suggested = useMemo(() => {
    return SUGGESTION_CATS.map(({ id, ids, label }) => {
      const items = cityServices
        .filter((s) => ids.includes(normCatPanel(s.category)))
        .sort((a, b) => {
          // Pin "Duster" first for transportation picks
          if (id === "transportation") {
            const aD = /duster/i.test(a.name) ? 0 : 1;
            const bD = /duster/i.test(b.name) ? 0 : 1;
            return aD - bD;
          }
          return 0;
        })
        .slice(0, 2);
      return { id, label, items };
    }).filter((g) => g.items.length > 0);
  }, [cityServices]);

  const categories = useMemo(() => {
    const set = new Set(
      cityServices
        .map((s) => String(s.category || "").trim())
        .filter(Boolean)
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [cityServices]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const catEntry = SUGGESTION_CATS.find(c => c.id === category);
    return cityServices
      .filter((s) => {
        const cat = normCatPanel(s.category);
        if (category !== "all") {
          const match = catEntry ? catEntry.ids.includes(cat) : cat === category;
          if (!match) return false;
        }

        if (!query) return true;
        const haystack = [
          s.name,
          s.name_en,
          s.sku,
          s.category,
          s.subcategory,
          s.priceUnit,
          s.description?.es,
          s.description?.en,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 200);
  }, [cityServices, q, category]);

  return (
    <Modal
      title={kickoffCityCodes.length > 0 ? `Agregar desde Catálogo · ${kickoffCityCodes.map(c => CITY_LABELS[c] || c).join(" + ")}` : "Agregar desde Catálogo"}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Cerrar
        </button>
      }
    >
      <div className="space-y-3">
        {!kickoffCityCode && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ Este cliente no tiene ciudad asignada — se muestran todos los servicios. Asigna la ciudad al kickoff para filtrar correctamente.
          </div>
        )}
        {kickoffCityCodes.length > 1 && (
          <div className="flex gap-2">
            {kickoffCityCodes.map(code => (
              <button key={code} type="button"
                onClick={() => setCatalogCityFilter(code)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${catalogCityFilter === code ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"}`}>
                {CITY_LABELS[code] || code}
              </button>
            ))}
          </div>
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Buscar: nombre, SKU, categoría…"
          autoFocus
        />
        {/* Category pill filters */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: "all",            label: "Todos" },
            { id: "restaurants",    label: "🍽 Restaurantes" },
            { id: "nightlife",      label: "🍸 Bares & Nightlife" },
            { id: "beach-clubs",    label: "⛵ Boating & Beach" },
            { id: "tours",          label: "🗺 Tours" },
            { id: "transportation", label: "🚗 Transporte" },
            { id: "chef",           label: "👨‍🍳 Chef" },
            { id: "services",       label: "✨ Servicios" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                category === id
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Sugeridos por categoría (solo cuando no hay búsqueda activa) ── */}
        {!q.trim() && category === "all" && suggested.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
              ⚡ Picks rápidos — 2 por categoría
            </p>
            {suggested.map(({ id, label, items }) => (
              <div key={id}>
                <p className="text-xs font-semibold text-neutral-700 mb-1">{label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((s) => {
                    const ct = String(clientType).includes("2") ? 2 : 1;
                    const price = ct === 2 ? (s.price_tier_2 || s.price_cop) : (s.price_tier_1 || s.price_cop);
                    const usesLevels = ["restaurants","bars","beach-clubs","nightlife"].includes(id);
                    const priceDisplay = usesLevels
                      ? (s.priceLevel || "—")
                      : price ? new Intl.NumberFormat("es-CO").format(price) + " COP" : "—";
                    return (
                      <button
                        key={s.id || s.sku}
                        type="button"
                        onClick={() => onPick(s)}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-400 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-neutral-900 truncate">{lang === "en" ? (s.name_en || s.name) : s.name}</div>
                          {s.subcategory && <div className="text-[10px] text-neutral-500 truncate">{s.subcategory}</div>}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <span className="text-[10px] text-neutral-500">{priceDisplay}</span>
                          <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-md">+ Agregar</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t pt-2">
              <p className="text-[11px] text-neutral-400">O busca cualquier servicio abajo ↓</p>
            </div>
          </div>
        )}

        <div className="text-[11px] text-neutral-500">
          Mostrando {filtered.length} de {cityServices.length} servicios{kickoffCityCode ? ` en ${CITY_LABELS[kickoffCityCode] || kickoffCityCode}` : ""}
        </div>

        {filtered.length === 0 ? (
          <div className="text-xs text-neutral-500 border rounded-xl p-3 bg-neutral-50">
            No hay resultados con ese filtro.
          </div>
        ) : (
          <div className="border rounded-2xl overflow-hidden bg-white">
            <div className="max-h-[55vh] overflow-auto divide-y">
              {filtered.map((s) => {
                const name = String((lang === "en" ? (s.name_en || s.name) : s.name) || "Servicio").trim();
                const cat = String(s.category || "").trim();
                const sub = String(s.subcategory || "").trim();
                const sku = String(s.sku || "").trim();
                const unit = String(s.priceUnit || "").trim();
                const tier1 = Number(s.price_tier_1 || 0);
const tier2 = Number(s.price_tier_2 || 0);
const base = Number(s.price_cop || 0);
const ct = String(clientType).includes("2") ? 2 : 1;
const price = ct === 2 ? (tier2 || base) : (tier1 || base);
const usesLevels = ["restaurants","bars","beach-clubs","nightlife"].includes(cat);
const priceDisplay = usesLevels
  ? (s.priceLevel || (price >= 300000 ? "$$$" : price >= 150000 ? "$$" : price ? "$" : "—"))
  : price
  ? new Intl.NumberFormat("es-CO").format(price) + " COP"
  : "—";
                return (
                  <button
                    key={s.id || s.sku || name}
                    type="button"
                    onClick={() => onPick(s)}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">
                        {name}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {[cat, sub].filter(Boolean).join(" · ")}
                        {sku ? ` · SKU: ${sku}` : ""}
                        {unit ? ` · ${unit}` : ""}
                      </div>
                    </div>

                    <div className="shrink-0 text-xs text-neutral-800 whitespace-nowrap">
                      {priceDisplay}
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-lg bg-neutral-900 text-white text-[11px]">
                        Agregar
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            
          </div>
        )}
        
      </div>
      
    </Modal>
  );
}



function ConfirmDeleteModal({ kickoff, onCancel, onConfirm, loading }) {
  if (!kickoff) return null;
  return (
    <Modal
      title="Eliminar kick-off"
      onClose={onCancel}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-sm text-white hover:bg-red-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </button>
        </>
      }
    >
      <p className="text-sm text-neutral-800">
        ¿Seguro que quieres eliminar este kick-off?
      </p>
      <p className="mt-2 text-xs text-neutral-600">
        Huésped:{" "}
        <span className="font-medium">
          {kickoff.guestName || "Sin nombre"}
        </span>
        <br />
        Viaje:{" "}
        <span className="font-medium">
          {kickoff.tripName || "Sin título"}
        </span>
      </p>
      <p className="mt-3 text-xs text-neutral-500">
        Esta acción no se puede deshacer.
      </p>
    </Modal>
  );
}

/* =========================================
   FeedbackResponseCard — shows what the
   client answered in the feedback form,
   fetched from the TwoTravel Feedback sheet
   matched by kickoffId.
   ========================================= */
const FEEDBACK_SHEET_ID = "1Tyv5cPTN0MjxezyWRjo-XuIRqOgaPwP-z1heZfgGiuQ";

function FeedbackResponseCard({ kickoffId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `https://opensheet.elk.sh/${FEEDBACK_SHEET_ID}/feedback`
        );
        if (!res.ok) throw new Error("No se pudo cargar el sheet");
        const rows = await res.json();
        const match = Array.isArray(rows)
          ? rows.find(r => String(r.kickoffId || r.kickofId || "").trim() === String(kickoffId).trim())
          : null;
        if (alive) setData(match || null);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [kickoffId]);

  if (loading) return (
    <p className="text-xs text-teal-500 animate-pulse py-1">Cargando respuestas…</p>
  );
  if (error) return (
    <p className="text-xs text-red-500 py-1">Error: {error}</p>
  );
  if (!data) return (
    <p className="text-xs text-teal-400 italic py-1">No se encontraron respuestas para este cliente.</p>
  );

  const score     = Number(data.overallExperience) || 0;
  const scoreColor = score >= 8 ? "#16a34a" : score >= 6 ? "#d97706" : "#dc2626";

  const SubScoreRow = ({ label, val }) => {
    const n = Number(val);
    if (!val || val === "N/A" || isNaN(n)) return null;
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-teal-600 w-28 shrink-0">{label}</span>
        <span className="text-[11px] font-bold text-teal-900">{n}/5</span>
        <div className="flex gap-0.5">
          {[1,2,3,4,5].map(i => (
            <div key={i} className={`w-2.5 h-1.5 rounded-sm ${i <= n ? "bg-teal-600" : "bg-teal-100"}`} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Overall score */}
      {score > 0 && (
        <div className="flex items-center gap-3">
          <div className="text-4xl font-bold leading-none" style={{ color: scoreColor }}>
            {score}
          </div>
          <div>
            <div className="text-[11px] text-teal-600">Score general / 10</div>
            <div className="flex gap-0.5 mt-1">
              {Array.from({ length: 10 }, (_, i) => (
                <div key={i} className="w-3 h-1.5 rounded-sm"
                  style={{ background: i < score ? scoreColor : "#d1fae5" }} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* What stood out */}
      {data.overallReason && (
        <div>
          <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">¿Qué destacó?</p>
          <p className="text-xs text-teal-900 mt-0.5 leading-relaxed">"{data.overallReason}"</p>
        </div>
      )}

      {/* One thing to improve */}
      {data.oneThing && (
        <div>
          <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">Una cosa a mejorar</p>
          <p className="text-xs text-teal-900 mt-0.5 leading-relaxed">"{data.oneThing}"</p>
        </div>
      )}

      {/* Extra notes */}
      {data.stayNotes && (
        <div>
          <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wide">Notas extra</p>
          <p className="text-xs text-teal-900 mt-0.5 leading-relaxed">"{data.stayNotes}"</p>
        </div>
      )}

      {/* Sub-scores */}
      <div className="space-y-1 pt-1 border-t border-teal-100">
        <SubScoreRow label="Itinerario"        val={data.itinerary} />
        <SubScoreRow label="Comunicación"      val={data.communication} />
        <SubScoreRow label="Preparación"       val={data.readiness} />
        <SubScoreRow label="Capacidad respuesta" val={data.responsiveness} />
        <SubScoreRow label="Toque personal"    val={data.personalTouch} />
        <SubScoreRow label="Propiedad"         val={data.propertyRating} />
      </div>

      {/* Would book again / recommend */}
      {(data.bookAgain || data.recommend) && (
        <div className="flex gap-4 pt-1">
          {data.bookAgain && (
            <div className="text-center">
              <div className="text-base">
                {["Yes","Sí","yes","si","sí"].includes(data.bookAgain) ? "✅" : "❌"}
              </div>
              <div className="text-[10px] text-teal-600 mt-0.5">Volvería a reservar</div>
            </div>
          )}
          {data.recommend && (
            <div className="text-center">
              <div className="text-base">
                {["Yes","Sí","yes","si","sí"].includes(data.recommend) ? "✅" : "❌"}
              </div>
              <div className="text-[10px] text-teal-600 mt-0.5">Nos recomienda</div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-teal-400">
        Enviado: {data.submittedAt
          ? new Date(data.submittedAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
          : "—"}
      </p>
    </div>
  );
}

function DrawerSection({ title, children, defaultOpen = false, accent = "neutral" }) {
  const [open, setOpen] = useState(defaultOpen);
  const colors = {
    neutral: "border-neutral-200 bg-neutral-50 text-neutral-700",
    violet:  "border-violet-200 bg-violet-50/50 text-violet-700",
    orange:  "border-orange-200 bg-orange-50/50 text-orange-700",
    amber:   "border-amber-200 bg-amber-50/50 text-amber-800",
    blue:    "border-blue-200 bg-blue-50/50 text-blue-700",
    indigo:  "border-indigo-200 bg-indigo-50/50 text-indigo-700",
  };
  const cls = colors[accent] || colors.neutral;
  return (
    <div className={`border rounded-2xl overflow-hidden ${cls.split(" ")[0]}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left ${cls} transition-colors hover:brightness-95`}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide">{title}</span>
        <span className="text-[10px] ml-2">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className={`px-4 py-3 space-y-3 ${cls.split(" ")[1]}`}>{children}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   JUNIOR DRAWER — Operaciones-only view for junior concierges
═══════════════════════════════════════════════════════════════ */
function JuniorDrawer({ kickoff, onClose, onSave }) {
  const [preBillSent,            setPreBillSent]            = useState(!!(kickoff?.preBillSent));
  const [preBillPaid,            setPreBillPaid]            = useState(!!(kickoff?.preBillPaid));
  const [earlyCheckin,           setEarlyCheckin]           = useState(!!(kickoff?.earlyCheckin));
  const [houseDrinkListSent,     setHouseDrinkListSent]     = useState(!!(kickoff?.houseDrinkListSent));
  const [boatDrinkListSent,      setBoatDrinkListSent]      = useState(!!(kickoff?.boatDrinkListSent));
  const [boatFoodReady,          setBoatFoodReady]          = useState(!!(kickoff?.boatFoodReady));
  const [listSentToBoatOwner,    setListSentToBoatOwner]    = useState(!!(kickoff?.listSentToBoatOwner));
  const [foodRestrictionsShared, setFoodRestrictionsShared] = useState(!!(kickoff?.foodRestrictionsShared));
  const [passportOk,             setPassportOk]             = useState(!!(kickoff?.passportOk));
  const [boatName,   setBoatName]   = useState(kickoff?.boatName   || "");
  const [boatDay,    setBoatDay]    = useState(kickoff?.boatDay    || "");
  const [dock,       setDock]       = useState(kickoff?.dock       || "");
  const [beachClub,  setBeachClub]  = useState(kickoff?.beachClub  || "");
  const [beachClubDay, setBeachClubDay] = useState(kickoff?.beachClubDay || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(kickoff.id, {
      preBillSent, preBillPaid, earlyCheckin,
      houseDrinkListSent, boatDrinkListSent, boatFoodReady,
      listSentToBoatOwner, foodRestrictionsShared, passportOk,
      boatName, boatDay, dock, beachClub, beachClubDay,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-md h-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <p className="text-[11px] text-neutral-500">Operaciones</p>
            <p className="text-sm font-semibold text-neutral-900">{kickoff.tripName || kickoff.guestName}</p>
            <p className="text-[11px] text-neutral-500">{kickoff.city} · {kickoff.groupSize && `${kickoff.groupSize} pers.`}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
          </button>
        </div>

        {/* Client summary (read-only) */}
        <div className="px-5 py-3 bg-neutral-50 border-b text-[11px] text-neutral-600 space-y-1">
          {kickoff.arrivalDate && <div>✈️ Llegada: <strong>{kickoff.arrivalDate?.slice(0,10)}</strong></div>}
          {kickoff.departureDate && <div>🛫 Salida: <strong>{kickoff.departureDate?.slice(0,10)}</strong></div>}
          {kickoff.accommodationName && <div>🏠 Villa: <strong>{kickoff.accommodationName}</strong></div>}
          {kickoff.boatName && <div>⛵ Bote: <strong>{kickoff.boatName}</strong></div>}
          {kickoff.briefDietary && <div>🥗 Dieta: <strong>{kickoff.briefDietary}</strong></div>}
        </div>

        {/* Operaciones */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          <div>
            <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-3">Checklist</p>
            <div className="grid grid-cols-1 gap-2">
              {[
                ["preBillSent",            preBillSent,            setPreBillSent,            "Pre-bill enviado"],
                ["preBillPaid",            preBillPaid,            setPreBillPaid,            "Pre-bill pagado"],
                ["earlyCheckin",           earlyCheckin,           setEarlyCheckin,           "Early check-in/late check-out"],
                ["houseDrinkListSent",     houseDrinkListSent,     setHouseDrinkListSent,     "Lista bebidas casa ✓"],
                ["boatDrinkListSent",      boatDrinkListSent,      setBoatDrinkListSent,      "Lista bebidas bote ✓"],
                ["boatFoodReady",          boatFoodReady,          setBoatFoodReady,          "Comida bote lista"],
                ["listSentToBoatOwner",    listSentToBoatOwner,    setListSentToBoatOwner,    "Lista enviada a dueño bote"],
                ["foodRestrictionsShared", foodRestrictionsShared, setFoodRestrictionsShared, "Restricciones alimentarias informadas"],
                ["passportOk",             passportOk,             setPassportOk,             "Pasaportes recolectados ✓"],
              ].map(([key, val, setter, label]) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)} className="w-4 h-4 accent-orange-500" />
                  <span className={`text-sm ${val ? "line-through text-neutral-400" : "text-neutral-700"}`}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider mb-3">Logística</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-neutral-500">Bote</label>
                <input value={boatName} onChange={e => setBoatName(e.target.value)} placeholder="Nombre…"
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500">Día bote</label>
                <input type="date" value={boatDay} onChange={e => setBoatDay(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-neutral-500">Muelle / Dock</label>
                <input value={dock} onChange={e => setDock(e.target.value)} placeholder="Club Náutico…"
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500">Beach Club</label>
                <input value={beachClub} onChange={e => setBeachClub(e.target.value)} placeholder="Mio…"
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500">Día beach club</label>
                <input type="date" value={beachClubDay} onChange={e => setBeachClubDay(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t bg-neutral-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-orange-500 text-sm text-white hover:bg-orange-600 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditDrawer({ kickoff, onClose, onSave, onSilentUpdate }) {
  const [guestName, setGuestName] = useState(kickoff?.guestName || "");
  const [tripName, setTripName] = useState(kickoff?.tripName || "");
  const [lang, setLang] = useState(kickoff?.lang || "en");
  const [guestContact, setGuestContact] = useState(kickoff?.guestContact || "");
  const [checkInFormUrl, setCheckInFormUrl] = useState(kickoff?.checkInFormUrl || "");
  const [checkInCity,    setCheckInCity]    = useState(() => {
    if (kickoff?.checkInCity) return kickoff.checkInCity;
    // default to first city of kickoff
    return (kickoff?.city || "").split(",")[0].trim().toUpperCase() || "";
  });
  // Multi-concierge: stored as comma-separated names; edit as array of names
  const parseMultiConcierge = (raw) => {
    if (!raw) return [];
    return String(raw).split(",").map(s => s.trim()).filter(Boolean);
  };
  const [assignedConcierges, setAssignedConcierges] = useState(
    parseMultiConcierge(kickoff?.assignedConcierge || kickoff?.assignedConciergeName || "")
  );
  // { "Carolina Lopez": "CTG", "Daniela Becerra": "MDE" }
  const [conciergesCities, setConciergesCities] = useState(() => {
    try { return JSON.parse(kickoff?.conciergesCities || "{}"); } catch { return {}; }
  });
  // Derived single values for backward compat
  const assignedConcierge      = assignedConcierges[0] || "";
  const assignedConciergeEmail = assignedConcierges
    .map(n => CONCIERGE_LIST.find(c => c.name === n)?.email || "")
    .filter(Boolean).join(",");
  const [status, setStatus] = useState(kickoff?.status || "new");
  // conciergeSummary intentionally read-only here (no UI field); excluded from saves to avoid overwriting
  // const [conciergeSummary] = useState(kickoff?.conciergeSummary || "");
  const [internalNotes, setInternalNotes] = useState(kickoff?.internalNotes || "");
  // Briefing de Ventas
  const [briefHasHouse,      setBriefHasHouse]      = useState(kickoff?.briefHasHouse      || "");
  const [briefHasBoat,       setBriefHasBoat]        = useState(kickoff?.briefHasBoat       || "");
  const [briefBudget,        setBriefBudget]         = useState(kickoff?.briefBudget        || "");
  const [briefDietary,       setBriefDietary]        = useState(kickoff?.briefDietary       || "");
  const [briefPurpose,       setBriefPurpose]        = useState(kickoff?.briefPurpose       || "");
  const [briefNotes,         setBriefNotes]          = useState(kickoff?.briefNotes         || "");
  const [passportInfo,       setPassportInfo]        = useState(kickoff?.passportInfo        || "");
  // Operaciones
  const [boatName,               setBoatName]               = useState(kickoff?.boatName               || "");
  const [boatDay,                setBoatDay]                 = useState(kickoff?.boatDay                || "");
  const [dock,                   setDock]                    = useState(kickoff?.dock                   || "");
  const [beachClub,              setBeachClub]               = useState(kickoff?.beachClub              || "");
  const [beachClubDay,           setBeachClubDay]            = useState(kickoff?.beachClubDay           || "");
  const [juniorConcierge,        setJuniorConcierge]         = useState(kickoff?.juniorConcierge        || "");
  const [juniorBoat,             setJuniorBoat]              = useState(kickoff?.juniorBoat             || "");
  const [juniorBeachClub,        setJuniorBeachClub]         = useState(kickoff?.juniorBeachClub        || "");
  const [earlyCheckin,           setEarlyCheckin]            = useState(!!(kickoff?.earlyCheckin));
  const [preBillSent,            setPreBillSent]             = useState(!!(kickoff?.preBillSent));
  const [preBillPaid,            setPreBillPaid]             = useState(!!(kickoff?.preBillPaid));
  const [houseDrinkListSent,     setHouseDrinkListSent]      = useState(!!(kickoff?.houseDrinkListSent));
  const [boatDrinkListSent,      setBoatDrinkListSent]       = useState(!!(kickoff?.boatDrinkListSent));
  const [boatFoodReady,          setBoatFoodReady]           = useState(!!(kickoff?.boatFoodReady));
  const [listSentToBoatOwner,    setListSentToBoatOwner]     = useState(!!(kickoff?.listSentToBoatOwner));
  const [foodRestrictionsShared, setFoodRestrictionsShared]  = useState(!!(kickoff?.foodRestrictionsShared));
  const [passportOk,             setPassportOk]              = useState(!!(kickoff?.passportOk));
  const drinkOrder = kickoff?.drinkOrder || "";
  const [billingCurrency, setBillingCurrency] = useState("USD");
  const [billingSending, setBillingSending] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  // Track latest ItineraryCanvas state so main "Guardar" always includes it
  // Pre-seeded from kickoff so they're never null even if onCartChange hasn't fired yet
  const canvasCartRef    = useRef(Array.isArray(kickoff?.cart)    ? kickoff.cart    : []);
  const canvasDayMetaRef = useRef(Array.isArray(kickoff?.dayMeta) ? kickoff.dayMeta : []);
  const [liveFxRate, setLiveFxRate] = useState(3489); // 3560 TRM - 2%
  useEffect(() => {
    fetch("https://api.frankfurter.app/latest?from=USD&to=COP")
      .then(r => r.json())
      .then(d => { const r = d?.rates?.COP; if (r > 500) setLiveFxRate(Math.round(r * 0.98)); })
      .catch(() => {});
  }, []);

  // Auto-open client web itinerary in side panel when drawer mounts
  const iframeRef = useRef(null);
  useEffect(() => {
    setPdfPreviewUrl(`${window.location.origin}/?mode=itinerary&kickoffId=${kickoff.id}&lang=${kickoff?.lang || "en"}&edit=1`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Editable arrival/departure dates (concierge sets these)
  const [arrivalDate,   setArrivalDate]   = useState(kickoff?.arrivalDate   || "");
  const [departureDate, setDepartureDate] = useState(kickoff?.departureDate || "");
  const clientNights    = (() => {
    if (!arrivalDate || !departureDate) return null;
    const n = Math.round((new Date(departureDate) - new Date(arrivalDate)) / 86400000);
    return n > 0 ? n : null;
  })();

  // Cover / trip-level fields for Travefy document
  // Parse quiz answers saved by client
  const quizAnswers = (() => {
    try { return JSON.parse(kickoff?.quizAnswers || "{}"); } catch { return {}; }
  })();

  // Auto-format tripDates from arrivalDate/departureDate (always recompute to avoid timezone artifacts)
  const autoTripDates = (() => {
    const a = kickoff?.arrivalDate, d = kickoff?.departureDate;
    if (a && d) {
      try {
        const fmt = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
        const yr  = new Date(d + "T12:00:00").getFullYear();
        return `${fmt(a)} – ${fmt(d)}, ${yr}`;
      } catch {}
    }
    return kickoff?.tripDates || "";
  })();

  // Auto-fill groupSize from quiz if concierge hasn't set it yet
  const autoGroupSize = kickoff?.groupSize || String(quizAnswers?.groupSize || quizAnswers?.pax || "");

  const [tripDates,          setTripDates]          = useState(autoTripDates);
  const [city,               setCity]               = useState(kickoff?.city               || "");
  // Multiple arrivals: [{name, date, time, flight, notes}]
  const [arrivals, setArrivals] = useState(() => {
    try { return JSON.parse(kickoff?.arrivals || "[]"); } catch { return []; }
  });
  const addArrival  = () => setArrivals(a => [...a, { name:"", date:"", time:"", flight:"", flightNumber:"", origin:"", destination:"" }]);
  const removeArrival = (i) => setArrivals(a => a.filter((_,idx) => idx !== i));
  const patchArrival = (i, patch) => setArrivals(a => a.map((row,idx) => idx === i ? {...row,...patch} : row));
  const [departures, setDepartures] = useState(() => {
    try { return JSON.parse(kickoff?.departures || "[]"); } catch { return []; }
  });
  const addDeparture  = () => setDepartures(d => [...d, { name:"", date:"", time:"", flightNumber:"", origin:"", destination:"", notes:"" }]);
  const removeDeparture = (i) => setDepartures(d => d.filter((_,idx) => idx !== i));
  const patchDeparture = (i, patch) => setDepartures(d => d.map((row,idx) => idx === i ? {...row,...patch} : row));
  const [guestEmailState,    setGuestEmailState]    = useState(kickoff?.email || kickoff?.guestEmail || "");
  const [groupSize,          setGroupSize]          = useState(autoGroupSize);
  const [conciergeTitle,     setConciergeTitle]     = useState(kickoff?.conciergeTitle     || "");
  const [accommodationName,  setAccommodationName]  = useState(kickoff?.accommodationName  || "");
  const [accommodationAddr,  setAccommodationAddr]  = useState(kickoff?.accommodationAddr  || "");
  const [accommodationUrl,   setAccommodationUrl]   = useState(kickoff?.accommodationUrl   || "");
  const [barrio,             setBarrio]             = useState(kickoff?.barrio             || "");
  const [coverPhotoId,       setCoverPhotoId]       = useState(kickoff?.coverPhotoId       || "");
  const [accommodationPhoto, setAccommodationPhoto] = useState(kickoff?.accommodationPhoto || "");
  // Extra accommodation within city 1 (e.g. group splits between hotel + house)
  const [accommodationNameB,  setAccommodationNameB]  = useState(kickoff?.accommodationNameB  || "");
  const [accommodationAddrB,  setAccommodationAddrB]  = useState(kickoff?.accommodationAddrB  || "");
  const [accommodationUrlB,   setAccommodationUrlB]   = useState(kickoff?.accommodationUrlB   || "");
  const [barrioB,             setBarrioB]             = useState(kickoff?.barrioB             || "");
  const [arrivalDateB,        setArrivalDateB]        = useState(kickoff?.arrivalDateB        || "");
  const [departureDateB,      setDepartureDateB]      = useState(kickoff?.departureDateB      || "");
  const [showExtraAccom,      setShowExtraAccom]      = useState(!!(kickoff?.accommodationNameB));
  // City 2 accommodation
  const [accommodationName2, setAccommodationName2] = useState(kickoff?.accommodationName2 || "");
  const [accommodationAddr2, setAccommodationAddr2] = useState(kickoff?.accommodationAddr2 || "");
  const [accommodationUrl2,  setAccommodationUrl2]  = useState(kickoff?.accommodationUrl2  || "");
  const [barrio2,            setBarrio2]            = useState(kickoff?.barrio2            || "");
  const [accommodationPhoto2,setAccommodationPhoto2]= useState(kickoff?.accommodationPhoto2|| "");
  // City 2 stay dates
  const [arrivalDate2,   setArrivalDate2]   = useState(kickoff?.arrivalDate2   || "");
  const [departureDate2, setDepartureDate2] = useState(kickoff?.departureDate2 || "");
  const [tripDates2,     setTripDates2]     = useState(() => {
    const a = kickoff?.arrivalDate2, d = kickoff?.departureDate2;
    if (a && d) {
      try {
        const fmt = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
        const yr  = new Date(d + "T12:00:00").getFullYear();
        return `${fmt(a)} – ${fmt(d)}, ${yr}`;
      } catch {}
    }
    return kickoff?.tripDates2 || "";
  });

  // Auto-compute conciergeTitle when assigned concierges change
  useEffect(() => {
    if (assignedConcierges.length === 0) return;
    const titles = assignedConcierges
      .map(n => CONCIERGE_LIST.find(c => c.name === n)?.title)
      .filter(Boolean);
    if (titles.length === 0) return;
    const unique = [...new Set(titles)];
    setConciergeTitle(unique.join(" & "));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedConcierges]);

  // Auto-sync tripDates when arrival/departure change
  useEffect(() => {
    if (!arrivalDate || !departureDate) return;
    try {
      const fmt = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const yr  = new Date(departureDate + "T12:00:00").getFullYear();
      setTripDates(`${fmt(arrivalDate)} – ${fmt(departureDate)}, ${yr}`);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivalDate, departureDate]);

  // Auto-sync tripDates2 when city 2 dates change
  useEffect(() => {
    if (!arrivalDate2 || !departureDate2) return;
    try {
      const fmt = (s) => new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" });
      const yr  = new Date(departureDate2 + "T12:00:00").getFullYear();
      setTripDates2(`${fmt(arrivalDate2)} – ${fmt(departureDate2)}, ${yr}`);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivalDate2, departureDate2]);

  const [checkIn,            setCheckIn]            = useState(kickoff?.checkIn            || "3:00 PM");
  const [checkOut,           setCheckOut]           = useState(kickoff?.checkOut           || "11:00 AM");
  const [welcomePdfUrl,      setWelcomePdfUrl]      = useState(kickoff?.welcomePdfUrl      || "https://drive.google.com/file/d/1-FMeJcmJUVz-9ULTXt6-7eli_IGa0Y2X/view?usp=sharing");
  const [preTripContent,     setPreTripContent]     = useState(kickoff?.preTripContent     || DEFAULT_PRE_TRIP);
  const [meetings, setMeetings] = useState(() => {
    try {
      const parsed = JSON.parse(kickoff?.meetingNotes || "[]");
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    // legacy plain text → single entry
    const legacy = kickoff?.meetingNotes || "";
    return legacy ? [{ date: "", notes: legacy }] : [];
  });
  const [pdfNotes,           setPdfNotes]           = useState(kickoff?.pdfNotes           || "");

  // ── Per-city ratings (concierge logs after each city leg) ────────
  const [cityRatings, setCityRatings] = useState(() => {
    try { return JSON.parse(kickoff?.cityRatings || "[]"); } catch { return []; }
  });
  // Property list for accommodation autocomplete
  const [propertyList, setPropertyList] = useState([]);
  useEffect(() => {
    const GAS = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
    fetch(GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "property_get", data: { id: "all", limit: 600 } }) })
      .then(r => r.json()).then(d => {
        const list = (d.data || d.properties || []).filter(p => p.Name);
        setPropertyList(list);
      }).catch(() => {});
  }, []);
  const addCityRating    = () => setCityRatings(prev => [...prev, { city: "", rating: 0, notes: "" }]);
  const removeCityRating = (i) => setCityRatings(prev => prev.filter((_, idx) => idx !== i));
  const patchCityRating  = (i, patch) =>
    setCityRatings(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  if (!kickoff) return null;

  const handleSave = async () => {
  // Auto-advance status when concierge saves from "new" or "client_submitted"
  const autoStatus =
    status === "new" || status === "client_submitted"
      ? "concierge_editing"
      : status;

  const now = new Date().toISOString();
  const updates = {
    guestName: guestName.trim(),
    tripName: tripName.trim(),
    status: autoStatus,
    internalNotes,
    assignedConcierge:      assignedConcierges.join(", "),
    assignedConciergeName:  assignedConcierges.join(", "),
    assignedConciergeEmail: assignedConciergeEmail,
    conciergesCities:       JSON.stringify(conciergesCities),
    // Cover fields
    tripDates:         tripDates.trim(),
    city:              city.trim(),
    groupSize:         groupSize.trim(),
    conciergeTitle:    conciergeTitle.trim(),
    accommodationName:  accommodationName.trim(),
    accommodationAddr:  accommodationAddr.trim(),
    accommodationUrl:   accommodationUrl.trim(),
    barrio:             barrio.trim(),
    coverPhotoId: coverPhotoId.trim(),
    accommodationPhoto: accommodationPhoto.trim(),
    checkIn:           checkIn.trim(),
    checkOut:          checkOut.trim(),
    welcomePdfUrl:     welcomePdfUrl.trim(),
    // Timestamps — only set first time each status is reached
    ...(autoStatus === "concierge_editing" && !kickoff.conciergeEditingAt ? { conciergeEditingAt: now } : {}),
    ...(autoStatus === "sent_to_travify"   && !kickoff.sentToTravifyAt    ? { sentToTravifyAt: now }    : {}),
    ...(autoStatus === "done"              && !kickoff.doneAt              ? { doneAt: now }              : {}),
    // Pre-trip info block (rendered as a page before itinerary days in PDF)
    preTripContent:    preTripContent.trim(),
    meetingNotes:      JSON.stringify(meetings),
    pdfNotes:          pdfNotes.trim(),
    // Multiple arrivals
    arrivals: JSON.stringify(arrivals.filter(a => a.name || a.date || a.flight)),
    departures: JSON.stringify(departures.filter(d => d.name || d.date || d.flightNumber)),
    // Per-city ratings
    cityRatings: JSON.stringify(cityRatings.filter(r => r.city || r.rating > 0)),
    // Stay dates (set by concierge)
    arrivalDate:    arrivalDate.trim(),
    departureDate:  departureDate.trim(),
    // Extra accommodation within city 1
    accommodationNameB:  accommodationNameB.trim(),
    accommodationAddrB:  accommodationAddrB.trim(),
    accommodationUrlB:   accommodationUrlB.trim(),
    barrioB:             barrioB.trim(),
    arrivalDateB:        arrivalDateB.trim(),
    departureDateB:      departureDateB.trim(),
    // City 2 dates & accommodation
    arrivalDate2:      arrivalDate2.trim(),
    departureDate2:    departureDate2.trim(),
    tripDates2:        tripDates2.trim(),
    accommodationName2:  accommodationName2.trim(),
    accommodationAddr2:  accommodationAddr2.trim(),
    accommodationUrl2:   accommodationUrl2.trim(),
    barrio2:             barrio2.trim(),
    accommodationPhoto2: accommodationPhoto2.trim(),
    // Always include latest canvas state so itinerary edits aren't lost
    cart:    JSON.stringify(canvasCartRef.current),
    dayMeta: JSON.stringify(canvasDayMetaRef.current),
    // Clear itinerarySnapshot so client link rebuilds from fresh cart data
    itinerarySnapshot: "",
  };

  updates.lang = lang;
  updates.guestContact = guestContact.trim();
  updates.checkInFormUrl = checkInFormUrl.trim();
  updates.checkInCity    = checkInCity;
  // Briefing de Ventas
  updates.briefHasHouse = briefHasHouse;
  updates.briefHasBoat  = briefHasBoat;
  updates.briefBudget   = briefBudget;
  updates.briefDietary  = briefDietary.trim();
  updates.briefPurpose  = briefPurpose;
  updates.briefNotes    = briefNotes.trim();
  updates.passportInfo  = passportInfo.trim();
  const em = guestEmailState.trim();
  updates.email = em;
  updates.guestEmail = em;
  // Operaciones
  updates.boatName               = boatName.trim();
  updates.boatDay                = boatDay.trim();
  updates.dock                   = dock.trim();
  updates.beachClub              = beachClub.trim();
  updates.beachClubDay           = beachClubDay.trim();
  updates.juniorConcierge        = juniorConcierge.trim();
  updates.juniorBoat             = juniorBoat.trim();
  updates.juniorBeachClub        = juniorBeachClub.trim();
  updates.earlyCheckin           = earlyCheckin;
  updates.preBillSent            = preBillSent;
  updates.preBillPaid            = preBillPaid;
  updates.houseDrinkListSent     = houseDrinkListSent;
  updates.boatDrinkListSent      = boatDrinkListSent;
  updates.boatFoodReady          = boatFoodReady;
  updates.listSentToBoatOwner    = listSentToBoatOwner;
  updates.foodRestrictionsShared = foodRestrictionsShared;
  updates.passportOk             = passportOk;

  // Trip-level / itinerary fields
  updates.arrivalDate            = arrivalDate;
  updates.departureDate          = departureDate;
  updates.arrivalDate2           = arrivalDate2;
  updates.departureDate2         = departureDate2;
  updates.arrivalDateB           = arrivalDateB;
  updates.departureDateB         = departureDateB;
  updates.tripDates              = tripDates;
  updates.tripDates2             = tripDates2;
  updates.groupSize              = groupSize;
  updates.city                   = cityFullName(city) || city;
  updates.conciergeTitle         = conciergeTitle.trim();
  updates.checkIn                = checkIn;
  updates.checkOut               = checkOut;
  updates.tripName               = tripName.trim();
  updates.accommodationName      = accommodationName.trim();
  updates.accommodationAddr      = accommodationAddr.trim();
  updates.accommodationUrl       = accommodationUrl.trim();
  updates.accommodationName2     = accommodationName2.trim();
  updates.accommodationAddr2     = accommodationAddr2.trim();
  updates.accommodationUrl2      = accommodationUrl2.trim();
  updates.accommodationNameB     = accommodationNameB.trim();
  updates.accommodationAddrB     = accommodationAddrB.trim();
  updates.accommodationUrlB      = accommodationUrlB.trim();

  await onSave(kickoff.id, updates);
  setStatus(autoStatus);
  // Refresh client itinerary view after save
  setPdfPreviewUrl(`${window.location.origin}/?mode=itinerary&kickoffId=${kickoff.id}&lang=${lang || kickoff?.lang || "en"}&_t=${Date.now()}`);
};


  return (
    <>
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className={`h-full bg-white shadow-xl flex ${pdfPreviewUrl ? "w-full flex-row" : "w-full max-w-xl flex-col"}`}>

        {/* PDF split panel — shown on the left when preview is open */}
        {pdfPreviewUrl && (
          <div className="flex-1 h-full flex flex-col border-r border-neutral-200 bg-neutral-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 shrink-0 bg-white">
              <span className="text-sm font-semibold text-neutral-800">👁 Vista del cliente</span>
              <button type="button" onClick={() => { if (pdfPreviewUrl?.startsWith("blob:")) URL.revokeObjectURL(pdfPreviewUrl); setPdfPreviewUrl(null); }}
                className="text-neutral-400 hover:text-neutral-700 text-lg leading-none px-2">✕</button>
            </div>
            <iframe ref={iframeRef} src={pdfPreviewUrl} className="flex-1 w-full" title="PDF preview" />
          </div>
        )}

        {/* Editor column */}
        <div className={`flex flex-col min-h-0 ${pdfPreviewUrl ? "w-[480px] shrink-0 h-full" : "flex-1"}`}>
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <p className="text-[11px] text-neutral-500">Editar kick-off</p>
            <p className="text-sm font-semibold text-neutral-900">
              {kickoff.tripName || kickoff.guestName || kickoff.id}
            </p>
            <p className="text-[11px] font-mono text-neutral-500">{kickoff.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-neutral-500">Huésped</label>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre del huésped"
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-500">Viaje</label>
              <input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre del viaje"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-neutral-500">Idioma del cliente</label>
              <div className="mt-1 flex gap-2">
                <button type="button"
                  onClick={() => setLang("es")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${lang === "es" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-neutral-500 border-neutral-200 hover:border-indigo-400"}`}>
                  🇨🇴 Español
                </button>
                <button type="button"
                  onClick={() => setLang("en")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${lang === "en" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-neutral-500 border-neutral-200 hover:border-indigo-400"}`}>
                  🇺🇸 English
                </button>
              </div>
            </div>
            <div>
  <label className="text-[11px] text-neutral-500">Contacto</label>
  <input
    value={guestContact}
    onChange={(e) => setGuestContact(e.target.value)}
    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
    placeholder="WhatsApp o email"
  />
</div>
            <div>
              <label className="text-[11px] text-neutral-500">Email del cliente</label>
              <input
                type="email"
                value={guestEmailState}
                onChange={(e) => setGuestEmailState(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="cliente@email.com"
              />
            </div>

            {/* Check-in Form URL (HubSpot link pasted by concierge) */}
            <div className="col-span-2">
              <label className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide mb-1 block">🔗 Link Check-in HubSpot</label>
              <input
                type="url"
                value={checkInFormUrl}
                onChange={e => setCheckInFormUrl(e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                placeholder="https://share.hsforms.com/..."
              />
              <p className="text-[10px] text-neutral-400 mt-1">Pega el link del formulario de HubSpot — aparece como botón en el PDF y en la página pre-viaje.</p>
            </div>

            {false && kickoff?.id && (() => {
              const ciLink = `https://twotravelvip.com/ci/${kickoff.id}`;
              const cityName = cityFullName(checkInCity) || checkInCity || "";
              const cityLine = cityName ? ` en ${cityName}` : "";
              const cityLineEn = cityName ? ` in ${cityName}` : "";
              const waMsgEs = `Comparte este formulario con todo tu grupo para que podamos preparar cada detalle de tu estadía${cityLine} con anticipación. Esta información nos ayuda con:\n\n• Datos de pasaporte: requeridos por la mayoría de las villas como parte de su proceso oficial de check-in, y a veces para acceso al muelle o seguro de actividades.\n• Necesidades alimenticias y alergias: nos permite elegir restaurantes adecuados, avisar a los lugares con anticipación, y preparar al personal de la villa para desayunos y comidas en casa.\n• Información de vuelo: nos permite coordinar el transporte del aeropuerto y el número correcto de vehículos para la llegada y salida de tu grupo.\n\nPor favor asegúrate de que todos en tu grupo lo completen antes de llegar. Esto nos ayuda a evitar retrasos y tener todo listo para ustedes.\n\n${ciLink}`;
              const waMsgEn = `Share this form with your entire group so we can prepare every detail of your stay${cityLineEn} in advance. This information helps us with:\n\n• Passport details: required by most villas as part of their official check-in process, and sometimes for dock access or activity insurance.\n• Dietary needs & allergies: this allows us to select suitable restaurants, notify venues in advance, and brief the villa staff for breakfasts and any meals at the house.\n• Flight information: this allows us to coordinate airport transportation and arrange the right number of vehicles for your group's arrival and departure.\n\nPlease make sure everyone in your group completes this before arrival. It helps us avoid delays and have everything ready for you.\n\n${ciLink}`;

              // Cities from this kickoff
              const kickoffCities = city.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);

              return (
                <div className="col-span-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
                  <p className="text-[11px] font-semibold text-indigo-700 mb-2">📋 Check-in Form</p>

                  {/* City selector — only if kickoff has multiple cities */}
                  {kickoffCities.length > 1 && (
                    <div className="mb-3">
                      <label className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wide mb-1 block">📍 Ciudad del formulario</label>
                      <div className="flex gap-2 flex-wrap">
                        {kickoffCities.map(code => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => setCheckInCity(code)}
                            className={`text-[11px] px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                              checkInCity === code
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                            }`}
                          >
                            {cityFullName(code) || code}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 mb-2">
                    <span className="flex-1 border border-indigo-200 rounded-lg px-2 py-1.5 text-[11px] font-mono bg-white text-indigo-600 truncate">{ciLink}</span>
                    <button type="button" onClick={() => navigator.clipboard.writeText(ciLink)}
                      className="text-[11px] text-indigo-700 border border-indigo-300 bg-white rounded-lg px-3 py-1.5 hover:bg-indigo-100 whitespace-nowrap">
                      Copiar link
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(waMsgEs)}`}
                      target="_blank" rel="noreferrer"
                      className="text-[11px] text-green-700 border border-green-300 bg-green-50 rounded-lg px-3 py-1.5 hover:bg-green-100">
                      WhatsApp ES
                    </a>
                    <a href={`https://wa.me/?text=${encodeURIComponent(waMsgEn)}`}
                      target="_blank" rel="noreferrer"
                      className="text-[11px] text-green-700 border border-green-300 bg-green-50 rounded-lg px-3 py-1.5 hover:bg-green-100">
                      WhatsApp EN
                    </a>
                  </div>
                </div>
              );
            })()}

            {/* ── FECHAS DE ESTADÍA (editables por el concierge) ── */}
            <div className="col-span-2 border border-blue-200 rounded-xl px-3 py-3 space-y-2 bg-blue-50">
              <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">📅 Fechas de estadía — {cityFullName(city.split(",")[0]?.trim()) || city.split(",")[0]?.trim() || "Ciudad 1"}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Llegada</label>
                  <input
                    type="date"
                    value={arrivalDate}
                    onChange={e => setArrivalDate(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Salida</label>
                  <input
                    type="date"
                    value={departureDate}
                    min={arrivalDate || undefined}
                    onChange={e => setDepartureDate(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white"
                  />
                </div>
              </div>
              {clientNights && (
                <p className="text-[10px] text-blue-600">🌙 {clientNights} noche{clientNights !== 1 ? "s" : ""}</p>
              )}
            </div>

            {/* City 2 dates — only shown when trip has 2 cities */}
            {city.includes(",") && (
              <div className="border border-blue-200 rounded-xl px-3 py-3 space-y-2 bg-blue-50">
                <p className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">📅 Fechas de estadía — Ciudad 2 — {cityFullName(city.split(",")[1]?.trim())}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">Llegada</label>
                    <input type="date" value={arrivalDate2}
                      min={departureDate || undefined}
                      onChange={e => setArrivalDate2(e.target.value)}
                      className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-neutral-500 mb-1">Salida</label>
                    <input type="date" value={departureDate2}
                      min={arrivalDate2 || undefined}
                      onChange={e => setDepartureDate2(e.target.value)}
                      className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/30 bg-white" />
                  </div>
                </div>
                {arrivalDate2 && departureDate2 && (() => {
                  const n = Math.round((new Date(departureDate2) - new Date(arrivalDate2)) / 86400000);
                  return n > 0 ? <p className="text-[10px] text-blue-600">🌙 {n} noche{n !== 1 ? "s" : ""}</p> : null;
                })()}
              </div>
            )}

            {/* Quiz answers submitted by client */}
            {(Object.keys(quizAnswers).some(k => quizAnswers[k] && quizAnswers[k] !== "no" && !(Array.isArray(quizAnswers[k]) && !quizAnswers[k].length))) && (
              <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 text-xs text-blue-900 space-y-2">
                <p className="font-semibold text-[11px] uppercase tracking-wide text-blue-700">📋 Info del cuestionario</p>

                {/* Group size */}
                {(quizAnswers.groupSize || quizAnswers.pax) && (
                  <p>👥 Personas: <strong>{quizAnswers.groupSize || quizAnswers.pax}</strong></p>
                )}

                {/* Kids */}
                {quizAnswers.kids === "yes" && (
                  <p>🧒 Viajan con niños</p>
                )}

                {/* Budget */}
                {quizAnswers.budget && (
                  <p>💰 Presupuesto: <strong>{
                    quizAnswers.budget === "low" ? "$ Económico"
                    : quizAnswers.budget === "mid" ? "$$ Intermedio"
                    : quizAnswers.budget === "high" ? "$$$ Premium"
                    : quizAnswers.budget
                  }</strong></p>
                )}

                {/* Vibes */}
                {quizAnswers.vibes?.length > 0 && (
                  <p>✨ Vibes: <strong>{quizAnswers.vibes.join(", ")}</strong></p>
                )}

                {/* Cuisines */}
                {quizAnswers.cuisines?.length > 0 && (
                  <p>🍴 Cocinas: <strong>{quizAnswers.cuisines.join(", ")}</strong></p>
                )}

                {/* Additional notes from client */}
                {kickoff?.additionalNotes && (
                  <p>📝 Nota del cliente: <strong>{kickoff.additionalNotes}</strong></p>
                )}

                {/* Group notes from quiz */}
                {quizAnswers.groupNotes && (
                  <p>💬 Notas del grupo: <strong>{quizAnswers.groupNotes}</strong></p>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="text-[11px] text-neutral-500 mb-1 block">
                Concierge(s) asignado(s)
                {assignedConcierges.length > 0 && (
                  <span className="ml-1 text-neutral-400">({assignedConcierges.join(", ")})</span>
                )}
              </label>
              {(() => {
                const kickoffCityList = city.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
                const multiCity = kickoffCityList.length > 1;
                return (
                  <div className="border rounded-lg divide-y bg-white">
                    {CONCIERGE_LIST.map(c => {
                      const checked = assignedConcierges.includes(c.name);
                      return (
                        <div key={c.email} className="px-3 py-2 hover:bg-neutral-50">
                          <label className="flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setAssignedConcierges(prev =>
                                  checked ? prev.filter(n => n !== c.name) : [...prev, c.name]
                                );
                                if (!checked) {
                                  // Auto-assign default city when checking
                                  const defaultCity = kickoffCityList.find(code => code === c.city) || kickoffCityList[0] || c.city;
                                  setConciergesCities(prev => ({ ...prev, [c.name]: defaultCity }));
                                } else {
                                  setConciergesCities(prev => { const { [c.name]: _, ...rest } = prev; return rest; });
                                }
                              }}
                              className="rounded"
                            />
                            <span className="flex-1">{c.name}</span>
                            {!checked && <span className="text-[10px] text-neutral-400">{c.city}</span>}
                          </label>
                          {checked && multiCity && (
                            <div className="flex gap-1.5 mt-1.5 ml-6">
                              {kickoffCityList.map(code => (
                                <button
                                  key={code}
                                  type="button"
                                  onClick={() => setConciergesCities(prev => ({ ...prev, [c.name]: code }))}
                                  className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                                    conciergesCities[c.name] === code
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "bg-white text-neutral-500 border-neutral-300 hover:border-indigo-400"
                                  }`}
                                >
                                  {cityFullName(code) || code}
                                </button>
                              ))}
                            </div>
                          )}
                          {checked && !multiCity && (
                            <div className="ml-6 mt-0.5">
                              <span className="text-[10px] text-indigo-600 font-medium">{cityFullName(conciergesCities[c.name] || c.city) || c.city}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] text-neutral-500">Título del concierge (PDF)</label>
              <input
                value={conciergeTitle}
                onChange={e => setConciergeTitle(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                placeholder="Senior Concierge Cartagena"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] text-neutral-500">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="new">{STATUS_LABELS.new.es}</option>
                <option value="client_submitted">{STATUS_LABELS.client_submitted.es}</option>
                <option value="concierge_editing">{STATUS_LABELS.concierge_editing.es}</option>
                <option value="sent_to_preview">{STATUS_LABELS.sent_to_preview.es}</option>
                <option value="sent_to_travify">{STATUS_LABELS.sent_to_travify.es}</option>
                <option value="feedback_submitted">{STATUS_LABELS.feedback_submitted.es}</option>
                <option value="done">{STATUS_LABELS.done.es}</option>
              </select>
            </div>
          </div>

          {/* ── OPERACIONES ── */}
          <DrawerSection title="⚙️ Operaciones" accent="orange">

            {/* Checklists */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {[
                ["preBillSent",            preBillSent,            setPreBillSent,            "Pre-bill enviado"],
                ["preBillPaid",            preBillPaid,            setPreBillPaid,            "Pre-bill pagado"],
                ["earlyCheckin",           earlyCheckin,           setEarlyCheckin,           "Early check-in/late check-out"],
                ["houseDrinkListSent",     houseDrinkListSent,     setHouseDrinkListSent,     "Lista bebidas casa ✓"],
                ["boatDrinkListSent",      boatDrinkListSent,      setBoatDrinkListSent,      "Lista bebidas bote ✓"],
                ["boatFoodReady",          boatFoodReady,          setBoatFoodReady,          "Comida bote lista"],
                ["listSentToBoatOwner",    listSentToBoatOwner,    setListSentToBoatOwner,    "Lista enviada a dueño bote"],
                ["foodRestrictionsShared", foodRestrictionsShared, setFoodRestrictionsShared, "Restricciones alimentarias informadas"],
                ["passportOk",             passportOk,             setPassportOk,             "Pasaportes recolectados ✓"],
              ].map(([key, val, setter, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={val} onChange={e => setter(e.target.checked)}
                    className="w-3.5 h-3.5 accent-orange-500" />
                  <span className="text-[11px] text-neutral-700">{label}</span>
                </label>
              ))}
            </div>

            {/* Bote */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] text-neutral-500">Nombre del bote</label>
                <input value={boatName} onChange={e => setBoatName(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                  placeholder="Sea Star…" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500">Día del bote</label>
                <input type="date" value={boatDay} onChange={e => setBoatDay(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] text-neutral-500">Muelle / Dock</label>
                <input value={dock} onChange={e => setDock(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                  placeholder="Club Náutico…" />
              </div>
            </div>

            {/* Beach Club */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-500">Beach Club</label>
                <input value={beachClub} onChange={e => setBeachClub(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                  placeholder="Mio…" />
              </div>
              <div>
                <label className="text-[10px] text-neutral-500">Día beach club</label>
                <input type="date" value={beachClubDay} onChange={e => setBeachClubDay(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white" />
              </div>
            </div>

            {/* Junior concierges */}
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="text-[10px] text-neutral-500">Junior — grupo</label>
                <input value={juniorConcierge} onChange={e => setJuniorConcierge(e.target.value)}
                  className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                  placeholder="Nombre junior…" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-500">Junior — bote</label>
                  <input value={juniorBoat} onChange={e => setJuniorBoat(e.target.value)}
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                    placeholder="Nombre junior…" />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-500">Junior — beach club</label>
                  <input value={juniorBeachClub} onChange={e => setJuniorBeachClub(e.target.value)}
                    className="mt-0.5 w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                    placeholder="Nombre junior…" />
                </div>
              </div>
            </div>
          </DrawerSection>

          <div>
            <label className="text-[11px] text-neutral-500">Notas internas</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
              placeholder="Notas internas"
            />
          </div>

          {/* Check-in Responses hidden */}

          {/* ── Notas de reuniones ── */}
          <DrawerSection title="📋 Notas de reuniones" accent="amber" defaultOpen={true}>
            <div className="flex items-center justify-between">
              <span />
              <button
                type="button"
                onClick={() => setMeetings(prev => [{ date: new Date().toISOString().slice(0,10), notes: "" }, ...prev])}
                className="text-[11px] text-amber-700 border border-amber-300 rounded-lg px-2 py-1 hover:bg-amber-100"
              >
                + Nueva reunión
              </button>
            </div>
            {meetings.length === 0 && (
              <p className="text-xs text-amber-500 italic">No hay reuniones registradas. Presiona "+ Nueva reunión" para agregar.</p>
            )}
            {meetings.map((m, i) => (
              <div key={i} className="bg-white border border-amber-200 rounded-lg p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={m.date || ""}
                    onChange={e => setMeetings(prev => prev.map((r, ri) => ri === i ? { ...r, date: e.target.value } : r))}
                    className="border border-amber-200 rounded px-2 py-1 text-xs bg-amber-50"
                  />
                  <span className="text-xs text-amber-600 font-medium">
                    {m.date ? new Date(m.date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }) : "Fecha de reunión"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMeetings(prev => prev.filter((_, ri) => ri !== i))}
                    className="ml-auto text-[10px] text-red-400 hover:text-red-600"
                  >✕</button>
                </div>
                <textarea
                  value={m.notes || ""}
                  onChange={e => setMeetings(prev => prev.map((r, ri) => ri === i ? { ...r, notes: e.target.value } : r))}
                  className="w-full border border-amber-100 rounded px-2 py-1.5 text-xs min-h-[70px] bg-white resize-none"
                  placeholder="Notas de esta reunión con el cliente…"
                />
              </div>
            ))}
          </DrawerSection>

          {/* ── Feedback del cliente (respuestas del formulario) ── */}
          {(kickoff.status === "feedback_submitted" || kickoff.feedbackAt) && (
            <div className="border border-teal-300 rounded-xl bg-teal-50 p-3">
              <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide mb-2">
                💬 Respuestas del formulario de feedback
              </p>
              <FeedbackResponseCard kickoffId={kickoff.id} />
            </div>
          )}

          {/* ── Drink Order ── */}
          {drinkOrder && (
            <div className="border border-teal-200 rounded-xl bg-teal-50 p-3">
              <p className="text-[11px] font-semibold text-teal-700 mb-1.5">🍹 Drink order (from client)</p>
              <pre className="text-xs text-teal-900 whitespace-pre-wrap font-sans leading-relaxed">{drinkOrder}</pre>
              {kickoff?.drinkOrderAt && (
                <p className="text-[10px] text-teal-500 mt-1.5">
                  Received: {new Date(kickoff.drinkOrderAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </div>
          )}

          {/* ── Grocery Order ── */}
          {kickoff?.groceryOrder && (
            <div className="border border-orange-200 rounded-xl bg-orange-50 p-3">
              <p className="text-[11px] font-semibold text-orange-700 mb-1.5">🛒 Grocery list (from client)</p>
              <pre className="text-xs text-orange-900 whitespace-pre-wrap font-sans leading-relaxed">{kickoff.groceryOrder}</pre>
              {kickoff?.groceryOrderAt && (
                <p className="text-[10px] text-orange-500 mt-1.5">
                  Received: {new Date(kickoff.groceryOrderAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}
                </p>
              )}
            </div>
          )}

          {/* ── Group Submissions (catalog selections per person) ── */}
          {(() => {
            let subs = [];
            try { subs = JSON.parse(kickoff?.groupSubmissions || "[]"); } catch {}
            if (!subs.length) return null;
            return (
              <div className="border border-indigo-200 rounded-xl bg-indigo-50 p-3 space-y-3">
                <p className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                  🛍️ Selecciones del grupo ({subs.length} {subs.length === 1 ? "persona" : "personas"})
                </p>
                {subs.map((s, i) => (
                  <div key={i} className="bg-white rounded-lg px-3 py-2.5 border border-indigo-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-indigo-800">👤 {s.name}</p>
                      {s.submittedAt && (
                        <p className="text-[10px] text-indigo-400">
                          {new Date(s.submittedAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      )}
                    </div>
                    {Array.isArray(s.cart) && s.cart.length > 0 && (
                      <ul className="space-y-0.5">
                        {s.cart.map((item, j) => (
                          <li key={j} className="text-xs text-indigo-900 flex gap-1.5">
                            <span className="text-indigo-400">•</span>
                            <span>{item.name}{item.notes ? <span className="text-indigo-400"> — {item.notes}</span> : null}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {s.additionalNotes && (
                      <p className="text-[11px] text-indigo-500 italic">📝 {s.additionalNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Cover Info ─────────────────────────────── */}
          <DrawerSection title="🖼️ Portada del itinerario (PDF)" accent="neutral">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-500">{city.includes(",") ? `Fechas ${cityFullName(city.split(",")[0]?.trim())}` : "Fechas del viaje"}</label>
                <input value={tripDates} onChange={(e) => setTripDates(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="May 22-28, 2026" />
              </div>
              {city.includes(",") && (
                <div>
                  <label className="text-[11px] text-neutral-500">Fechas {cityFullName(city.split(",")[1]?.trim())}</label>
                  <input value={tripDates2} onChange={(e) => setTripDates2(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="Jun 1-5, 2026" />
                </div>
              )}
              <div>
                <label className="text-[11px] text-neutral-500">Ciudad / Destino</label>
                <input
                  value={city.split(",").map(c => cityFullName(c.trim()) || c.trim()).join(" & ")}
                  readOnly
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-neutral-50 text-neutral-600 cursor-default"
                  placeholder="Se llena automático según ciudades seleccionadas"
                />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Personas en el grupo</label>
                <input value={groupSize} onChange={(e) => setGroupSize(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="5 people" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Nombre del alojamiento {city.includes(",") ? `— ${cityFullName(city.split(",")[0]?.trim())}` : ""}</label>
                <input value={accommodationName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAccommodationName(val);
                    const match = (propertyList || []).find(p => p.Name === val);
                    if (match) {
                      const addr  = match.address || match.Address || match.addr || match.Addr || "";
                      const url   = match.location || match.Location || match.MapsUrl || match.mapsUrl || match.maps_url || match.GoogleMaps || "";
                      const nbhd  = match.barrio || match.Barrio || match.neighborhood || match.Neighborhood || match.Barrio || "";
                      if (addr)  setAccommodationAddr(addr);
                      if (url)   setAccommodationUrl(url);
                      if (nbhd)  setBarrio(nbhd);
                      const photo = match.photoUrl || match.PhotoUrl || match.photo || match.Photo || match.coverPhoto || match.CoverPhoto || "";
                      if (photo) setAccommodationPhoto(photo);
                    }
                  }}
                  list="prop-list-1"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Edificio Los Eucaliptos" />
                <datalist id="prop-list-1">
                  {(propertyList || []).filter(p => {
                    if (!city) return true;
                    const c1 = city.split(",")[0]?.trim()?.toUpperCase();
                    const pCity = String(p.City || p.city || "").trim().toUpperCase();
                    const code1 = { CARTAGENA:"CTG", MEDELLÍN:"MDE", MEDELLIN:"MDE", "CIUDAD DE MÉXICO":"CDMX", TULUM:"TUL", BOGOTÁ:"BOG" }[c1] || c1;
                    const pCode = { CARTAGENA:"CTG", MEDELLÍN:"MDE", MEDELLIN:"MDE", "CIUDAD DE MÉXICO":"CDMX", TULUM:"TUL", BOGOTÁ:"BOG" }[pCity] || pCity;
                    return !c1 || pCode === code1 || pCity.includes(c1) || c1.includes(pCity);
                  }).map(p => <option key={p.id} value={p.Name}>{p.Name} — {p.City}</option>)}
                </datalist>
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Barrio / Zona {city.includes(",") ? `— ${cityFullName(city.split(",")[0]?.trim())}` : ""}</label>
                <input value={barrio} onChange={(e) => setBarrio(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Getsemaní, Centro Histórico..." />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Dirección del alojamiento {city.includes(",") ? `— ${cityFullName(city.split(",")[0]?.trim())}` : ""}</label>
                <input value={accommodationAddr} onChange={(e) => setAccommodationAddr(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Calle 10 # 29-34, Medellín, Antioquia" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Google Maps del alojamiento {city.includes(",") ? `— ${cityFullName(city.split(",")[0]?.trim())}` : ""}</label>
                <input value={accommodationUrl} onChange={(e) => setAccommodationUrl(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="https://maps.app.goo.gl/..." />
              </div>
              {/* ── Cover photo picker ── */}
              <div className="col-span-2">
                <label className="text-[11px] font-semibold text-neutral-700 mb-2 block">🖼️ Foto de portada del itinerario</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
                  {PRESET_COVER_PHOTOS.map(id => {
                    const selected = coverPhotoId === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCoverPhotoId(selected ? "" : id)}
                        style={{
                          padding: 0, border: selected ? "3px solid #1d4ed8" : "2px solid #e5e7eb",
                          borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative",
                          boxShadow: selected ? "0 0 0 2px #1d4ed8" : "0 1px 3px rgba(0,0,0,.1)",
                        }}
                      >
                        <img
                          src={`https://lh3.googleusercontent.com/d/${id}`}
                          alt=""
                          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                          onError={e => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%23e5e7eb' width='80' height='80'/%3E%3C/svg%3E"; }}
                        />
                        {selected && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(29,78,216,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ background: "#1d4ed8", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ color: "#fff", fontSize: 12 }}>✓</span>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {coverPhotoId && (
                  <button type="button" onClick={() => setCoverPhotoId("")}
                    className="text-[10px] text-red-500 underline">
                    Quitar foto de portada
                  </button>
                )}
              </div>

              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Foto del alojamiento (URL) {city.includes(",") ? `— ${cityFullName(city.split(",")[0]?.trim())}` : ""}</label>
                <input value={accommodationPhoto} onChange={(e) => setAccommodationPhoto(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="https://..." />
                <p className="text-[10px] text-amber-600 mt-1">
                  ⚠️ Drive: abre la <strong>foto</strong> (no la carpeta) → clic derecho → "Obtener enlace" → pega ese link aquí.
                </p>
                {accommodationPhoto && <img src={driveImgUrl(accommodationPhoto)} alt="preview" className="mt-1 w-full rounded-lg object-cover" style={{maxHeight:80}} onError={e=>{ e.target.style.display='none'; }} />}
                {accommodationPhoto && accommodationPhoto.includes("/folders/") && (
                  <p className="text-[10px] text-red-600 mt-1">❌ Este es un link de carpeta — no funciona. Abre la carpeta, entra a la foto específica y comparte ese link.</p>
                )}
              </div>
              {/* Extra accommodation within city 1 — optional second property (e.g. hotel + house) */}
              <div className="col-span-2">
                {!showExtraAccom ? (
                  <button type="button"
                    onClick={() => setShowExtraAccom(true)}
                    className="text-[11px] text-violet-600 border border-dashed border-violet-300 rounded-lg px-3 py-1.5 hover:bg-violet-50 transition-colors flex items-center gap-1.5">
                    <span style={{fontSize:14,lineHeight:1}}>+</span>
                    Agregar otro alojamiento en la misma ciudad
                  </button>
                ) : (
                  <div className="border border-violet-200 rounded-xl p-4 bg-violet-50/40">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-semibold text-violet-700">🏠 Alojamiento adicional (misma ciudad)</p>
                      <button type="button" onClick={() => { setShowExtraAccom(false); setAccommodationNameB(""); setAccommodationAddrB(""); setAccommodationUrlB(""); setBarrioB(""); setArrivalDateB(""); setDepartureDateB(""); }}
                        className="text-[10px] text-red-400 hover:text-red-600">Quitar</button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[11px] text-neutral-500">Nombre del alojamiento extra</label>
                        <input value={accommodationNameB} onChange={e => setAccommodationNameB(e.target.value)}
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                          placeholder="Hotel Santa Clara" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-neutral-500">Barrio / Zona</label>
                        <input value={barrioB} onChange={e => setBarrioB(e.target.value)}
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                          placeholder="Centro Histórico..." />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-neutral-500">Dirección</label>
                        <input value={accommodationAddrB} onChange={e => setAccommodationAddrB(e.target.value)}
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                          placeholder="Calle 29-01, Cartagena" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] text-neutral-500">Google Maps</label>
                        <input value={accommodationUrlB} onChange={e => setAccommodationUrlB(e.target.value)}
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                          placeholder="https://maps.app.goo.gl/..." />
                      </div>
                      <div>
                        <label className="text-[11px] text-neutral-500">Check-in</label>
                        <input type="date" value={arrivalDateB} onChange={e => setArrivalDateB(e.target.value)}
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white" />
                      </div>
                      <div>
                        <label className="text-[11px] text-neutral-500">Check-out</label>
                        <input type="date" value={departureDateB} onChange={e => setDepartureDateB(e.target.value)}
                          className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* City 2 accommodation — only shown when 2 cities */}
              {city.includes(",") && (<>
                <div className="col-span-2 border-t border-blue-100 pt-2">
                  <p className="text-[11px] font-semibold text-blue-700 mb-2">🏠 Alojamiento {cityFullName(city.split(",")[1]?.trim())}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-neutral-500">Nombre del alojamiento 2</label>
                  <input value={accommodationName2}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAccommodationName2(val);
                      const match = (propertyList || []).find(p => p.Name === val);
                      if (match) {
                        const addr  = match.Address || match.address || match.Addr || match.addr || match.Location || "";
                        const url   = match.MapsUrl || match.mapsUrl || match.maps_url || match.GoogleMaps || match.Maps || match.maps || "";
                        const nbhd  = match.barrio || match.Barrio || match.neighborhood || match.Neighborhood || "";
                        if (addr)  setAccommodationAddr2(addr);
                        if (url)   setAccommodationUrl2(url);
                        if (nbhd)  setBarrio2(nbhd);
                        const photo = match.photoUrl || match.PhotoUrl || match.photo || match.Photo || match.coverPhoto || match.CoverPhoto || "";
                        if (photo) setAccommodationPhoto2(photo);
                      }
                    }}
                    list="prop-list-2"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="Casa Medellín" />
                  <datalist id="prop-list-2">
                    {(propertyList || []).filter(p => {
                      const c2 = city.split(",")[1]?.trim()?.toUpperCase();
                      if (!c2) return true;
                      const pCity = String(p.City || p.city || "").trim().toUpperCase();
                      const code2 = { CARTAGENA:"CTG", MEDELLÍN:"MDE", MEDELLIN:"MDE", "CIUDAD DE MÉXICO":"CDMX", TULUM:"TUL", BOGOTÁ:"BOG" }[c2] || c2;
                      const pCode = { CARTAGENA:"CTG", MEDELLÍN:"MDE", MEDELLIN:"MDE", "CIUDAD DE MÉXICO":"CDMX", TULUM:"TUL", BOGOTÁ:"BOG" }[pCity] || pCity;
                      return pCode === code2 || pCity.includes(c2) || c2.includes(pCity);
                    }).map(p => <option key={p.id} value={p.Name}>{p.Name} — {p.City}</option>)}
                  </datalist>
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-neutral-500">Barrio / Zona 2</label>
                  <input value={barrio2} onChange={(e) => setBarrio2(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="El Poblado, Laureles..." />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-neutral-500">Dirección alojamiento 2</label>
                  <input value={accommodationAddr2} onChange={(e) => setAccommodationAddr2(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="El Poblado, Medellín" />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-neutral-500">Google Maps alojamiento 2</label>
                  <input value={accommodationUrl2} onChange={(e) => setAccommodationUrl2(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="https://maps.app.goo.gl/..." />
                </div>
                <div className="col-span-2">
                  <label className="text-[11px] text-neutral-500">Foto alojamiento 2 (URL)</label>
                  <input value={accommodationPhoto2} onChange={(e) => setAccommodationPhoto2(e.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                    placeholder="https://..." />
                  {accommodationPhoto2 && <img src={driveImgUrl(accommodationPhoto2)} alt="preview" className="mt-1 w-full rounded-lg object-cover" style={{maxHeight:80}} onError={e=>e.target.style.display='none'} />}
                </div>
              </>)}
              <div>
                <label className="text-[11px] text-neutral-500">Check-in</label>
                <input value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="3:00 PM" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Check-out</label>
                <input value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="11:00 AM" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Welcome PDF URL (link que aparece en el itinerario)</label>
                <input value={welcomePdfUrl} onChange={(e) => setWelcomePdfUrl(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="https://drive.google.com/file/d/.../view" />
              </div>
            </div>
          </DrawerSection>

          {/* ── Calificaciones por ciudad ── */}
          <DrawerSection title="⭐ Calificaciones por ciudad" accent="amber">
            <div className="flex items-center justify-between">
              <span />
              <button
                type="button"
                onClick={addCityRating}
                className="text-[11px] px-2.5 py-1 rounded-full bg-amber-800 text-white hover:bg-amber-900 transition"
              >
                + Agregar ciudad
              </button>
            </div>

            {cityRatings.length === 0 && (
              <p className="text-[11px] text-amber-700 italic">
                Agrega una calificación después de cada leg del viaje.
              </p>
            )}

            {cityRatings.map((cr, i) => (
              <div key={i} className="bg-white border border-amber-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  {/* City dropdown */}
                  <select
                    value={cr.city}
                    onChange={e => patchCityRating(i, { city: e.target.value })}
                    className="flex-1 border border-neutral-200 rounded-lg px-2 py-1.5 text-sm bg-white outline-none"
                  >
                    <option value="">— Ciudad —</option>
                    {["Cartagena","Medellín","CDMX","Tulum"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeCityRating(i)}
                    className="text-neutral-400 hover:text-red-500 text-lg leading-none px-1"
                    title="Eliminar"
                  >×</button>
                </div>

                {/* Star rating 1-5 */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-neutral-500 mr-1">Rating:</span>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => patchCityRating(i, { rating: cr.rating === n ? 0 : n })}
                      className={`w-8 h-8 rounded-full text-sm font-semibold transition border ${
                        cr.rating >= n
                          ? "bg-amber-400 border-amber-400 text-white"
                          : "bg-white border-neutral-200 text-neutral-400 hover:border-amber-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  {cr.rating > 0 && (
                    <span className="ml-1 text-[11px] text-amber-700 font-medium">{cr.rating}/5</span>
                  )}
                </div>

                {/* Notes */}
                <textarea
                  value={cr.notes}
                  onChange={e => patchCityRating(i, { notes: e.target.value })}
                  rows={2}
                  placeholder="Notas internas sobre este leg del viaje..."
                  className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-xs bg-neutral-50 outline-none resize-none"
                />
              </div>
            ))}
          </DrawerSection>

          {/* ── LLEGADAS Y SALIDAS DEL GRUPO ─────────────────────────────── */}
          <DrawerSection title="✈️ Llegadas y salidas del grupo" accent="neutral">
            {/* Llegadas */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">🛬 Llegadas</p>
              <button type="button" onClick={addArrival}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700">
                + Agregar llegada
              </button>
            </div>
            {arrivals.length === 0 && (
              <p className="text-[11px] text-neutral-400">Sin llegadas. Úsalo cuando el grupo llega en vuelos distintos.</p>
            )}
            {arrivals.map((a, i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-xl px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-5">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Quién</p>
                    <input value={a.name} onChange={e => patchArrival(i,{name:e.target.value})}
                      placeholder="Juan + María"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Fecha</p>
                    <input type="date" value={a.date} onChange={e => patchArrival(i,{date:e.target.value})}
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Hora llegada</p>
                    <input type="time" value={a.time} onChange={e => patchArrival(i,{time:e.target.value})}
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent" />
                  </div>
                  <div className="col-span-1 flex justify-end items-end pb-0.5">
                    <button type="button" onClick={() => removeArrival(i)}
                      className="text-neutral-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">N° vuelo <span className="text-blue-400">(tracking)</span></p>
                    <input value={a.flightNumber||""} onChange={e => patchArrival(i,{flightNumber:e.target.value.toUpperCase()})}
                      placeholder="AV204"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 font-mono" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Origen <span className="text-blue-400">(IATA)</span></p>
                    <input value={a.origin||""} onChange={e => patchArrival(i,{origin:e.target.value.toUpperCase()})}
                      placeholder="BOG"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 font-mono" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Destino <span className="text-blue-400">(IATA)</span></p>
                    <input value={a.destination||""} onChange={e => patchArrival(i,{destination:e.target.value.toUpperCase()})}
                      placeholder="CTG"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 font-mono" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Notas</p>
                    <input value={a.flight||""} onChange={e => patchArrival(i,{flight:e.target.value})}
                      placeholder="Detalles adicionales"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300" />
                  </div>
                </div>
              </div>
            ))}

            {/* Salidas */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">🛫 Salidas</p>
              <button type="button" onClick={addDeparture}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700">
                + Agregar salida
              </button>
            </div>
            {departures.length === 0 && (
              <p className="text-[11px] text-neutral-400">Sin salidas registradas.</p>
            )}
            {departures.map((d, i) => (
              <div key={i} className="bg-white border border-neutral-200 rounded-xl px-3 py-2 space-y-1.5">
                <div className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-5">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Quién</p>
                    <input value={d.name} onChange={e => patchDeparture(i,{name:e.target.value})}
                      placeholder="Juan + María"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Fecha</p>
                    <input type="date" value={d.date} onChange={e => patchDeparture(i,{date:e.target.value})}
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Hora salida</p>
                    <input type="time" value={d.time} onChange={e => patchDeparture(i,{time:e.target.value})}
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent" />
                  </div>
                  <div className="col-span-1 flex justify-end items-end pb-0.5">
                    <button type="button" onClick={() => removeDeparture(i)}
                      className="text-neutral-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                </div>
                <div className="grid grid-cols-12 gap-1.5 items-center">
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">N° vuelo <span className="text-blue-400">(tracking)</span></p>
                    <input value={d.flightNumber||""} onChange={e => patchDeparture(i,{flightNumber:e.target.value.toUpperCase()})}
                      placeholder="AV205"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 font-mono" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Origen <span className="text-blue-400">(IATA)</span></p>
                    <input value={d.origin||""} onChange={e => patchDeparture(i,{origin:e.target.value.toUpperCase()})}
                      placeholder="CTG"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 font-mono" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Destino <span className="text-blue-400">(IATA)</span></p>
                    <input value={d.destination||""} onChange={e => patchDeparture(i,{destination:e.target.value.toUpperCase()})}
                      placeholder="BOG"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 font-mono" />
                  </div>
                  <div className="col-span-3">
                    <p className="text-[9px] text-neutral-400 mb-0.5">Notas</p>
                    <input value={d.notes||""} onChange={e => patchDeparture(i,{notes:e.target.value})}
                      placeholder="Detalles adicionales"
                      className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300" />
                  </div>
                </div>
              </div>
            ))}
          </DrawerSection>

          {/* ITINERARIO — canvas con edición inline por día */}
          <DrawerSection title="📅 Itinerario" accent="neutral" defaultOpen={true}>
            <div className="flex items-center justify-between -mt-1 mb-1">
              <span />
              {kickoff?.cart?.length > 0 && (
                <a href={`/?mode=itinerary&kickoffId=${kickoff.id}&lang=${kickoff.lang || "en"}`}
                  target="_blank" rel="noreferrer"
                  className="text-[11px] text-blue-600 hover:underline">
                  📄 Ver PDF →
                </a>
              )}
            </div>
            <ItineraryCanvas
              kickoff={kickoff}
              onCartChange={(newCart, newDayMeta) => {
                canvasCartRef.current    = newCart;
                canvasDayMetaRef.current = newDayMeta;
              }}
              onSave={async (newCart, newDayMeta) => {
                await onSilentUpdate(kickoff.id, {
                  cart:    JSON.stringify(newCart),
                  dayMeta: JSON.stringify(newDayMeta),
                  status: "concierge_editing",
                });
                if (iframeRef.current) {
                  const base = `${window.location.origin}/?mode=itinerary&kickoffId=${kickoff.id}&lang=${kickoff?.lang || "en"}&edit=1`;
                  iframeRef.current.src = `${base}&_t=${Date.now()}`;
                }
              }}
            />
          </DrawerSection>
        </div>


        <div className="px-5 py-4 border-t bg-neutral-50 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950"
          >
            Guardar
          </button>
          {/* Itinerary: PDF download + shareable link */}
          {kickoff?.cart?.length > 0 && (() => {
            const clientUrl    = `${window.location.origin}/?mode=itinerary&kickoffId=${kickoff.id}&lang=${kickoff.lang || "en"}`;
            const conciergeUrl = clientUrl + "&edit=1";
            return (
              <div className="flex items-center gap-1">
                {/* PDF: concierge opens with edit=1 → can edit then Ctrl+P */}
                <a
                  href={conciergeUrl}
                  target="_blank" rel="noreferrer"
                  className="px-3 py-2 rounded-l-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                  title="Abrir itinerario (modo edición) — Ctrl+P para guardar como PDF"
                >
                  📄 PDF
                </a>
                {/* Copy link — client link, read-only, no edit button */}
                <CopyLinkButton url={clientUrl} />
              </div>
            );
          })()}
          {/* Drinks catalog link + copy short link */}
          <div className="flex items-center gap-0.5">
            <a
              href={`https://www.twotravelvip.com/d/${kickoff.id}`}
              target="_blank" rel="noreferrer"
              className="px-3 py-2 rounded-l-lg border border-teal-300 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 flex items-center gap-1.5"
              title="Abrir catálogo de bebidas del cliente"
            >
              🍹 Bebidas
            </a>
            <CopyIconButton url={`https://www.twotravelvip.com/d/${kickoff.id}`} borderClass="border-teal-300 text-teal-600 bg-teal-50 hover:bg-teal-100" />
          </div>
          {/* Groceries catalog link + copy short link */}
          <div className="flex items-center gap-0.5">
            <a
              href={`https://www.twotravelvip.com/g/${kickoff.id}`}
              target="_blank" rel="noreferrer"
              className="px-3 py-2 rounded-l-lg border border-orange-300 text-sm text-orange-700 bg-orange-50 hover:bg-orange-100 flex items-center gap-1.5"
              title="Abrir lista de mercado del cliente"
            >
              🛒 Mercado
            </a>
            <CopyIconButton url={`https://www.twotravelvip.com/g/${kickoff.id}`} borderClass="border-orange-300 text-orange-600 bg-orange-50 hover:bg-orange-100" />
          </div>
          {/* Breakfast link — CTG only */}
          {toCityCodeModule(kickoff.city || kickoff.destination || "") === "CTG" && (
            <BreakfastLink kickoff={kickoff} />
          )}
          {/* WhatsApp — enviar PDF al cliente */}
          {(() => {
            const isEs   = (kickoff.lang || "en") === "es";
            const first  = (kickoff.guestName || "").split(" ")[0] || "";
            const pdfUrl = kickoff.welcomePdfUrl || "";
            if (!pdfUrl) return null;
            const msgEs = `Hola${first ? ` ${first}` : ""}! 🌟\n\nAquí tienes tu itinerario personalizado — incluye todos tus links, actividades y detalles del viaje:\n\n${pdfUrl}\n\n¡Nos vemos pronto! ✨\n— Two Travel`;
            const msgEn = `Hi${first ? ` ${first}` : ""}! 🌟\n\nHere's your personalized itinerary — it includes all your links, activities and trip details:\n\n${pdfUrl}\n\nSee you soon! ✨\n— Two Travel`;
            const waEs = `https://wa.me/?text=${encodeURIComponent(msgEs)}`;
            const waEn = `https://wa.me/?text=${encodeURIComponent(msgEn)}`;
            const svgWa = <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.116 1.523 5.845L0 24l6.335-1.493A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.368l-.36-.214-3.726.878.936-3.617-.235-.374A9.818 9.818 0 1112 21.818z"/></svg>;
            return (
              <div className="flex gap-1.5">
                <a href={waEs} target="_blank" rel="noreferrer"
                  className="px-3 py-2 rounded-lg border border-green-300 text-sm text-green-700 bg-green-50 hover:bg-green-100 flex items-center gap-1.5">
                  {svgWa} ES
                </a>
                <a href={waEn} target="_blank" rel="noreferrer"
                  className="px-3 py-2 rounded-lg border border-green-300 text-sm text-green-700 bg-green-50 hover:bg-green-100 flex items-center gap-1.5">
                  {svgWa} EN
                </a>
              </div>
            );
          })()}
          {/* Billing — send to Slack */}
          {kickoff?.cart?.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBillingCurrency(c => c === "USD" ? "COP" : c === "COP" ? "MXN" : "USD")}
                className="px-2 py-2 rounded-l-lg border border-r-0 border-indigo-300 text-[11px] font-mono text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                title="Cambiar moneda"
              >
                {billingCurrency}
              </button>
              <button
                type="button"
                disabled={billingSending}
                onClick={async () => {
                  setBillingSending(true);
                  try {
                    const liveKickoff = {
                      ...kickoff,
                      ...(canvasCartRef.current    != null ? { cart:    canvasCartRef.current    } : {}),
                      ...(canvasDayMetaRef.current != null ? { dayMeta: canvasDayMetaRef.current } : {}),
                      city: cityFullName(city) || city,
                      tripDates, tripDates2, groupSize,
                      arrivalDate, departureDate,
                      arrivalDate2, departureDate2,
                      accommodationName, accommodationAddr, accommodationUrl,
                      accommodationName2, accommodationAddr2, accommodationUrl2,
                      checkIn, checkOut,
                      conciergeTitle,
                      tripName: tripName || kickoff.tripName || "",
                      email: guestEmailState || kickoff.email || kickoff.guestEmail || "",
                    };
                    const url = await sendItineraryPdfToSlack(liveKickoff, kickoff.lang || "en", billingCurrency, "preview", liveFxRate);
                    console.log("PDF preview url:", url);
                    if (!url) throw new Error("No se generó URL del PDF");
                    setPdfPreviewUrl(url);
                  } catch (e) {
                    console.error("PDF preview error:", e);
                    alert("❌ Error generando PDF: " + e.message);
                  } finally {
                    setBillingSending(false);
                  }
                }}
                className="px-3 py-2 border-t border-b border-indigo-300 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                title="Ver PDF"
              >
                {billingSending ? "…" : "👁"}
              </button>
              <button
                type="button"
                disabled={billingSending}
                onClick={async () => {
                  setBillingSending(true);
                  try {
                    // Merge live EditDrawer + canvas state so cart/dayMeta/city are always current
                    await sendItineraryPdfToSlack({
                      ...kickoff,
                      cart:    canvasCartRef.current    != null ? canvasCartRef.current    : kickoff.cart,
                      dayMeta: canvasDayMetaRef.current != null ? canvasDayMetaRef.current : kickoff.dayMeta,
                      email: guestEmailState || kickoff.email || kickoff.guestEmail || "",
                      city: cityFullName(city) || city || kickoff.city || "",
                      tripDates, tripDates2, groupSize, arrivalDate, departureDate,
                      arrivalDate2, departureDate2,
                      accommodationName, accommodationAddr, accommodationUrl,
                      accommodationName2, accommodationAddr2, accommodationUrl2,
                      tripName: tripName || kickoff.tripName || "",
                      checkIn, checkOut, conciergeTitle,
                    }, kickoff.lang || "en", billingCurrency, "slack", liveFxRate);
                    alert("✅ PDF enviado a Slack");
                  } catch (e) {
                    alert("❌ " + e.message);
                  } finally {
                    setBillingSending(false);
                  }
                }}
                className="px-3 py-2 rounded-r-lg border border-indigo-300 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
              >
                {billingSending ? "Enviando…" : "💰 Facturar"}
              </button>
            </div>
          )}
        </div>
      </div>

    </div>

    </div>{/* end overlay */}
    </>
  );
}
function ConciergePickerModal({ concierges, onClose, onSelect }) {
  return (
    <Modal
      title="Asignar concierge"
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <button type="button" onClick={() => onSelect(null)}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100">
          Sin asignar
        </button>
      }
    >
      <div className="space-y-2">
        {concierges.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">
            No hay concierges en la pestaña "Concierges" del Sheet.
          </p>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden bg-white">
            {concierges.map((c) => (
              <button
                key={c.id || c.email || c.name}
                type="button"
                onClick={() => onSelect(c)}
                className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                  {c.email && <p className="text-xs text-neutral-500">{c.email}</p>}
                </div>
                <span className="text-xs text-neutral-400">Seleccionar →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function KickoffPickerModal({ kickoffs, title, onClose, onSelect }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (kickoffs || []).filter((k) => {
      if (!query) return true;
      return [k.guestName, k.tripName, k.id, k.guestContact]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [kickoffs, q]);

  return (
    <Modal title={title || "Seleccionar cliente"} onClose={onClose} maxWidth="max-w-2xl"
      footer={
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100">
          Cancelar
        </button>
      }
    >
      <div className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Buscar por nombre, viaje o ID..."
          autoFocus
        />
        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">No hay clientes que coincidan.</p>
        ) : (
          <div className="border rounded-2xl overflow-hidden bg-white">
            <div className="max-h-[50vh] overflow-auto divide-y">
              {filtered.map((k) => (
                <button key={k.id} type="button" onClick={() => onSelect(k)}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {k.guestName || "Sin nombre"}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      {k.tripName || "Sin viaje"} · {k.id}
                      {k.assignedConcierge ? ` · 👤 ${k.assignedConcierge}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ClientTypeBadge value={k.clientType} />
                    <StatusBadge status={k.status} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* =========================================
   NewClientLinksModal — UN solo link
   El link de cuestionario ya lleva al cliente por:
   Welcome → Cuestionario → Catálogo (todo en uno)
   ========================================= */
function NewClientLinksModal({ kickoff, lang = "en", onClose }) {
  const [copiedMsg,  setCopiedMsg]  = React.useState(false);
  const [copiedLink, setCopiedLink] = React.useState(false);

  if (!kickoff) return null;

  const ct   = kickoff.clientType || 1;
  const isEs = lang === "es";
  const name = (kickoff.guestName || "").split(" ")[0] || (isEs ? "viajero" : "traveler");

  // ONE link — questionnaire flow = Welcome → Quiz → Catalog
  // If kickoff has a welcomePdfUrl we embed it so the welcome screen shows a button
  const link = buildOnboardLink(kickoff, ct, lang);

  const msgEs = `Hola ${name} 👋 Bienvenido/a a Two Travel. Aquí tienes tu acceso personalizado — en este link vas a encontrar la bienvenida a tu viaje, un cuestionario rápido y luego el catálogo con todas las experiencias disponibles para ti:\n\n${link}`;
  const msgEn = `Hi ${name} 👋 Welcome to Two Travel! Here's your personalized access — this link takes you through your trip welcome, a quick questionnaire, and then the full catalog of experiences available for you:\n\n${link}`;
  const msg   = isEs ? msgEs : msgEn;

  const handleCopyMsg = async () => {
    try { await navigator.clipboard.writeText(msg); } catch { prompt("Copia este mensaje:", msg); }
    setCopiedMsg(true); setTimeout(() => setCopiedMsg(false), 2000);
  };
  const handleCopyLink = async () => {
    try { await navigator.clipboard.writeText(link); } catch { prompt("Copia el link:", link); }
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl overflow-hidden">

        {/* Header */}
        <div className="px-5 py-4 bg-neutral-900 flex items-center justify-between">
          <div>
            <p className="text-[11px] text-neutral-400">✓ {isEs ? "Cliente creado" : "Client created"}</p>
            <p className="text-sm font-semibold text-white">{kickoff.guestName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Flow explanation */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-2 text-[11px] text-neutral-500">
          <span className="font-medium text-neutral-700">👋 Bienvenida</span>
          <span>→</span>
          <span className="font-medium text-neutral-700">📋 Cuestionario</span>
          <span>→</span>
          <span className="font-medium text-neutral-700">🛒 Catálogo</span>
        </div>

        {/* Message card */}
        <div className="px-5 pb-4">
          <div className="border border-emerald-200 bg-emerald-50 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-2">
              {isEs ? "Mensaje listo para enviar" : "Ready-to-send message"}
            </p>
            <div className="bg-white rounded-xl px-3 py-3 text-[11px] text-neutral-700 whitespace-pre-wrap leading-relaxed mb-3" style={{wordBreak:"break-all"}}>
              {msg}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleCopyMsg}
                className="flex-1 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors">
                {copiedMsg ? "✓ Copiado" : isEs ? "📋 Copiar mensaje" : "📋 Copy message"}
              </button>
              <button type="button" onClick={handleCopyLink}
                className="px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs hover:bg-neutral-50 transition-colors"
                title={isEs ? "Copiar solo el link" : "Copy link only"}>
                {copiedLink ? "✓" : "🔗"}
              </button>
              <button type="button"
                onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
                className="px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs hover:bg-neutral-50 transition-colors"
                title={isEs ? "Abrir link" : "Open link"}>
                ↗
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button type="button" onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
            ✓ {isEs ? "Listo" : "Done"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* =========================================
   CreateClientModal — reemplaza el prompt() chain
   ========================================= */

function CreateClientModal({ open, onClose, onSubmit, kickoffs }) {
  const [form, setForm] = React.useState({
    guestName: "",
    email: "",
    tripName: "",
    guestContact: "",
    city: "",
    clientType: 1,
  });
  const [selectedConcierges, setSelectedConcierges] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);

  const toggleConcierge = (name) => {
    setSelectedConcierges(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      // Auto-fill city from first concierge if not set
      if (!prev.includes(name) && !form.city) {
        const match = CONCIERGE_LIST.find(c => c.name === name);
        if (match?.city) setForm(f => ({ ...f, city: f.city || match.city }));
      }
      return next;
    });
  };

  const handleField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.guestName.trim() || !form.email.trim() || !form.city) return;
    setSubmitting(true);
    try {
      const conciergeEmail = selectedConcierges
        .map(n => CONCIERGE_LIST.find(c => c.name === n)?.email || "")
        .filter(Boolean).join(",");
      await onSubmit({
        ...form,
        concierge: selectedConcierges.join(", "),
        conciergeEmail,
      });
      setForm({ guestName: "", email: "", tripName: "", guestContact: "", city: "", clientType: 1 });
      setSelectedConcierges([]);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b flex-shrink-0">
          <h2 className="text-base font-semibold text-neutral-900">Nuevo cliente</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* Nombre + Email en fila */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Nombre <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.guestName}
                onChange={handleField("guestName")}
                placeholder="María García"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={handleField("email")}
                placeholder="maria@email.com"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 ${!form.email.trim() ? "border-red-300 bg-red-50" : "border-neutral-300"}`}
              />
            </div>
          </div>

          {/* Ciudad — pills compactos */}
          <div>
            <label className="block text-[11px] font-medium text-neutral-500 mb-1.5">
              Ciudad(es) <span className="text-red-400">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { code: "CTG",  label: "Cartagena" },
                { code: "MDE",  label: "Medellín" },
                { code: "CDMX", label: "CDMX" },
                { code: "TUL",  label: "Tulum" },
              ].map(({ code, label }) => {
                const cities = form.city ? form.city.split(",").map(s=>s.trim()) : [];
                const active = cities.includes(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      const next = active ? cities.filter(c => c !== code) : [...cities, code];
                      setForm(p => ({ ...p, city: next.join(",") }));
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {form.city && form.city.split(",").filter(Boolean).length >= 2 && (
              <p className="text-[10.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 mt-1.5">
                Presiona primero la ciudad a la que llegan primero — eso determina cuál es <strong>Ciudad 1</strong> (Fechas de Estadía) y cuál es <strong>Ciudad 2</strong> en el kickoff.
              </p>
            )}
          </div>

          {/* Nombre del viaje + WhatsApp en fila */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">Viaje</label>
              <input
                type="text"
                value={form.tripName}
                onChange={handleField("tripName")}
                placeholder="Cartagena Jun 2025"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1">WhatsApp</label>
              <input
                type="text"
                value={form.guestContact}
                onChange={handleField("guestContact")}
                placeholder="+57 300 1234567"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
          </div>

          {/* Tipo + Concierge en fila */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1.5">Tipo</label>
              <div className="flex gap-2">
                {[1, 2].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, clientType: t }))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      form.clientType === t
                        ? "bg-neutral-900 text-white border-neutral-900"
                        : "bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500"
                    }`}
                  >
                    Tipo {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-500 mb-1.5">
                Concierge
              </label>
              <div className="border border-neutral-200 rounded-lg bg-white max-h-28 overflow-y-auto divide-y divide-neutral-100">
                {CONCIERGE_LIST.map(c => {
                  const checked = selectedConcierges.includes(c.name);
                  return (
                    <label key={c.name}
                      className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer text-xs transition ${checked ? "bg-neutral-50 font-medium" : "hover:bg-neutral-50"}`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => toggleConcierge(c.name)}
                        className="accent-neutral-900 w-3 h-3"/>
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.city && <span className="text-[10px] text-neutral-400">{c.city}</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Footer fijo siempre visible */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-neutral-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !form.guestName.trim() || !form.email.trim() || !form.city}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950 disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Crear y abrir link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientTypePickerModal({ onClose, onSelect }) {
  const [value, setValue] = useState(1);

  return (
    <Modal
      title="Seleccionar tipo de cliente"
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSelect(value)}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950"
          >
            Continuar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="text-[11px] text-neutral-500">Tipo de cliente</label>
        <select
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value={1}>Tipo 1</option>
          <option value={2}>Tipo 2</option>
        </select>
      </div>
    </Modal>
  );
}

const _CITY_ALIASES = {
  CTG:  ["ctg","cartagena","cartagena de indias"],
  MDE:  ["mde","medellin","medellín"],
  CDMX: ["cdmx","mexico","ciudad de mexico","ciudad de méxico"],
  TUL:  ["tul","tulum"],
  BOG:  ["bog","bogota","bogotá"],
};
const toCityCodeModule = (raw) => {
  const first = String(raw || "").split(",")[0].trim().toLowerCase();
  if (!first) return "";
  for (const [code, aliases] of Object.entries(_CITY_ALIASES)) {
    if (aliases.includes(first) || first === code.toLowerCase()) return code;
  }
  return first.toUpperCase();
};

function BreakfastLink({ kickoff }) {
  const [bfCurr, setBfCurr] = React.useState("USD");
  const shortBfUrl = `https://www.twotravelvip.com/b/${kickoff.id}`;
  return (
    <div className="flex items-center gap-0">
      <a href={shortBfUrl} target="_blank" rel="noreferrer"
        className="px-3 py-2 rounded-l-lg border border-amber-300 text-sm text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center gap-1.5">
        ☕ Desayuno
      </a>
      <CopyIconButton url={shortBfUrl} borderClass="border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100" />
    </div>
  );
}

/* =========================================
   Componente principal
   ========================================= */

/* =========================================================
   REUNIONES PAGE — CRM de llamadas Two Travel
   ========================================================= */
const MEETING_TYPES = ["Kickoff Call", "Pre-check in", "Follow-up", "Otro"];
const MEETING_STATUSES = [
  { value: "done",      label: "Hecho",     color: "#16a34a", bg: "#dcfce7", dot: "🟢" },
  { value: "pending",   label: "Pendiente", color: "#2563eb", bg: "#dbeafe", dot: "🔵" },
  { value: "missed",    label: "No asistió",color: "#dc2626", bg: "#fee2e2", dot: "🔴" },
  { value: "scheduled", label: "Agendado",  color: "#d97706", bg: "#fef3c7", dot: "🟡" },
];

function getMeetingStatus(v) {
  return MEETING_STATUSES.find(s => s.value === v) || MEETING_STATUSES[1];
}

function newMeetingId() {
  return "mtg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
}

function parseMeetings(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return p; } catch {}
  }
  if (typeof raw === "string" && raw.trim()) return [{ id: newMeetingId(), date: "", time: "", type: "Kickoff Call", status: "done", notes: raw, tasks: [] }];
  return [];
}

/* ── Inline meeting form (no modal, embedded in panel) ── */
function MeetingFormInline({ kickoffId, initial, onSave, onCancel }) {
  const [date,   setDate]   = useState(initial?.date   || new Date().toISOString().slice(0,10));
  const [time,   setTime]   = useState(initial?.time   || "10:00");
  const [type,   setType]   = useState(initial?.type   || "Kickoff Call");
  const [status, setStatus] = useState(initial?.status || "scheduled");
  const [notes,  setNotes]  = useState(initial?.notes  || "");
  const [tasks,  setTasks]  = useState(initial?.tasks  || []);
  const [newTask,setNewTask]= useState("");
  const [saving, setSaving] = useState(false);

  const addTask = () => { if (!newTask.trim()) return; setTasks(t=>[...t,{text:newTask.trim(),done:false}]); setNewTask(""); };

  const handle = async () => {
    setSaving(true);
    onSave({ id: initial?.id || newMeetingId(), date, time, type, status, notes, tasks })
      .catch(()=>{}).finally(()=>setSaving(false));
  };

  const inp = { border:"1px solid #e5ddd3", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"'Jost',sans-serif", outline:"none", width:"100%", boxSizing:"border-box", background:"#fff" };

  return (
    <div style={{ background:"#fffdf9", border:"1px solid #e5ddd3", borderRadius:10, padding:14, marginBottom:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} />
        <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={inp} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
        <select value={type} onChange={e=>setType(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
          {MEETING_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value)} style={{ ...inp, cursor:"pointer" }}>
          {MEETING_STATUSES.map(s=><option key={s.value} value={s.value}>{s.dot} {s.label}</option>)}
        </select>
      </div>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Notas de la llamada…" style={{ ...inp, resize:"vertical", marginBottom:8 }} />
      {tasks.map((t,i)=>(
        <div key={i} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
          <input type="checkbox" checked={t.done} onChange={()=>setTasks(ts=>ts.map((x,j)=>j===i?{...x,done:!x.done}:x))} />
          <span style={{ flex:1, fontSize:12 }}>{t.text}</span>
          <button onClick={()=>setTasks(ts=>ts.filter((_,j)=>j!==i))} style={{ background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:12 }}>✕</button>
        </div>
      ))}
      <div style={{ display:"flex", gap:6, marginBottom:10 }}>
        <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="+ Tarea" style={{ ...inp, flex:1 }} />
        <button onClick={addTask} style={{ background:"#f5f0e8",border:"1px solid #e5ddd3",borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",color:"#9a7d52" }}>Agregar</button>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={handle} disabled={saving} style={{ flex:1, background:"#1a1814",color:"#fff",border:"none",borderRadius:8,padding:"8px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif" }}>
          {saving ? "Guardando…" : initial?.id ? "Guardar cambios" : "Crear reunión"}
        </button>
        <button onClick={onCancel} style={{ background:"#f5f0e8",border:"1px solid #e5ddd3",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer",color:"#9a7d52" }}>Cancelar</button>
      </div>
    </div>
  );
}

/* ── Meeting row ── */
function MeetingRow({ meeting, onEdit, onDelete, onToggleTask }) {
  const st = getMeetingStatus(meeting.status);
  const [open, setOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const PREVIEW = 200;
  const longNotes = (meeting.notes||"").length > PREVIEW;
  const shownNotes = (!notesOpen && longNotes) ? (meeting.notes||"").slice(0,PREVIEW)+"…" : (meeting.notes||"");
  const pending = (meeting.tasks||[]).filter(t=>!t.done).length;
  const done    = (meeting.tasks||[]).filter(t=>t.done).length;

  return (
    <div style={{ borderLeft:`3px solid ${st.color}`, paddingLeft:12, marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={()=>setOpen(o=>!o)}>
        <span style={{ fontSize:15 }}>{st.dot}</span>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
            <span style={{ fontSize:15, fontWeight:700, color:"#1a1814" }}>{meeting.type||"Llamada"}</span>
            <span style={{ fontSize:11, background:st.bg, color:st.color, borderRadius:5, padding:"1px 7px", fontWeight:600 }}>{st.label}</span>
            {(meeting.tasks||[]).length>0 && <span style={{ fontSize:11, color: pending>0?"#d97706":"#16a34a", fontWeight:600 }}>{done}/{(meeting.tasks||[]).length} tareas</span>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {meeting.date && <span style={{ fontSize:12, color:"#9a7d52", fontWeight:600 }}>{meeting.date}</span>}
            {meeting.time && <span style={{ fontSize:12, color:"#b0a090" }}>{meeting.time}</span>}
          </div>
          {!open && meeting.notes && <div style={{ fontSize:12, color:"#6b6055", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:340 }}>{meeting.notes.slice(0,80)}{meeting.notes.length>80?"…":""}</div>}
        </div>
        <span style={{ color:"#b0a090", fontSize:11 }}>{open?"▲":"▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop:8 }}>
          {meeting.notes && (
            <div style={{ marginBottom:8 }}>
              <p style={{ fontSize:12, color:"#3a3530", lineHeight:1.7, margin:0, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{shownNotes}</p>
              {longNotes && <button onClick={e=>{e.stopPropagation();setNotesOpen(v=>!v);}} style={{ background:"none",border:"none",color:"#9a7d52",fontSize:11,cursor:"pointer",padding:"2px 0",textDecoration:"underline" }}>{notesOpen?"Ver menos ▲":"Ver más ▼"}</button>}
            </div>
          )}
          {(meeting.tasks||[]).length>0 && (
            <div style={{ marginBottom:8 }}>
              {meeting.tasks.map((t,i)=>(
                <div key={i} onClick={()=>onToggleTask(i)} style={{ display:"flex",alignItems:"center",gap:6,padding:"2px 0",cursor:"pointer" }}>
                  <span>{t.done?"✅":"⬜"}</span>
                  <span style={{ fontSize:12, color:t.done?"#9a9a9a":"#1a1814", textDecoration:t.done?"line-through":"none" }}>{t.text}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>{setOpen(false);onEdit();}} style={{ background:"#f5f0e8",border:"1px solid #e5ddd3",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer" }}>✏️ Editar</button>
            <button onClick={onDelete} style={{ background:"#fee2e2",border:"1px solid #fca5a5",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",color:"#dc2626" }}>🗑 Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Nueva reunión / edit modal ── */
function MeetingFormModal({ kickoffs, initial, onSave, onClose }) {
  const [kickoffId, setKickoffId] = useState(initial?.kickoffId || "");
  const [date,      setDate]      = useState(initial?.date      || new Date().toISOString().slice(0,10));
  const [time,      setTime]      = useState(initial?.time      || "10:00");
  const [type,      setType]      = useState(initial?.type      || "Kickoff Call");
  const [status,    setStatus]    = useState(initial?.status    || "scheduled");
  const [notes,     setNotes]     = useState(initial?.notes     || "");
  const [tasks,     setTasks]     = useState(initial?.tasks     || []);
  const [newTask,   setNewTask]   = useState("");
  const [saving,    setSaving]    = useState(false);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(t => [...t, { text: newTask.trim(), done: false }]);
    setNewTask("");
  };

  const handle = async () => {
    if (!kickoffId) { alert("Selecciona un cliente"); return; }
    setSaving(true);
    const kickoff = kickoffs.find(k => k.id === kickoffId);
    const existing = parseMeetings(kickoff?.meetingNotes);
    const entry = {
      id: initial?.id || newMeetingId(),
      date, time, type, status,
      notes, tasks,
    };
    let updated;
    if (initial?.id) {
      updated = existing.map(m => m.id === initial.id ? entry : m);
    } else {
      updated = [...existing, entry];
    }
    try {
      await updateKickoffInSheet(kickoffId, { meetingNotes: JSON.stringify(updated) });
      onSave({ kickoffId, entry, allMeetings: updated });
    } catch (e) {
      alert("Error al guardar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = { border: "1px solid #e5ddd3", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "'Jost',sans-serif", outline: "none", width: "100%", boxSizing: "border-box", background: "#fff" };
  const sel = { ...inp, cursor: "pointer" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onClose}>
      <div style={{ background:"#fff", borderRadius:16, padding:28, width:480, maxWidth:"94vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,.18)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:"#1a1814", margin:0 }}>
            {initial?.id ? "Editar reunión" : "Nueva reunión"}
          </p>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:18, cursor:"pointer", color:"#9a7d52" }}>✕</button>
        </div>

        <label style={{ fontSize:11, color:"#9a7d52", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:4 }}>Cliente</label>
        <select value={kickoffId} onChange={e=>setKickoffId(e.target.value)} style={{ ...sel, marginBottom:14 }} disabled={!!initial?.id}>
          <option value="">— Seleccionar cliente —</option>
          {kickoffs.map(k => <option key={k.id} value={k.id}>{k.guestName || k.id}</option>)}
        </select>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, color:"#9a7d52", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:4 }}>Fecha</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#9a7d52", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:4 }}>Hora</label>
            <input type="time" value={time} onChange={e=>setTime(e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, color:"#9a7d52", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:4 }}>Tipo</label>
            <select value={type} onChange={e=>setType(e.target.value)} style={sel}>
              {MEETING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:11, color:"#9a7d52", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:4 }}>Estado</label>
            <select value={status} onChange={e=>setStatus(e.target.value)} style={sel}>
              {MEETING_STATUSES.map(s => <option key={s.value} value={s.value}>{s.dot} {s.label}</option>)}
            </select>
          </div>
        </div>

        <label style={{ fontSize:11, color:"#9a7d52", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:4 }}>Notas</label>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} placeholder="Qué se habló, acuerdos, observaciones..." style={{ ...inp, resize:"vertical", marginBottom:14 }} />

        <label style={{ fontSize:11, color:"#9a7d52", letterSpacing:".08em", textTransform:"uppercase", display:"block", marginBottom:6 }}>Tareas</label>
        {tasks.map((t, i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
            <input type="checkbox" checked={t.done} onChange={() => setTasks(ts => ts.map((x,j) => j===i ? {...x,done:!x.done} : x))} style={{ accentColor:"#9a7d52" }} />
            <span style={{ flex:1, fontSize:13, color: t.done ? "#9a9a9a" : "#1a1814", textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
            <button onClick={() => setTasks(ts => ts.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:13 }}>✕</button>
          </div>
        ))}
        <div style={{ display:"flex", gap:8, marginBottom:20 }}>
          <input value={newTask} onChange={e=>setNewTask(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addTask()} placeholder="Nueva tarea..." style={{ ...inp, flex:1 }} />
          <button onClick={addTask} style={{ background:"#f5f0e8", border:"1px solid #e5ddd3", borderRadius:8, padding:"8px 14px", fontSize:13, cursor:"pointer", color:"#9a7d52", whiteSpace:"nowrap" }}>+ Agregar</button>
        </div>

        <button onClick={handle} disabled={saving} style={{ width:"100%", background:"#1a1814", color:"#fff", border:"none", borderRadius:10, padding:"12px", fontSize:13, letterSpacing:".06em", cursor:"pointer", fontFamily:"'Jost',sans-serif" }}>
          {saving ? "Guardando…" : initial?.id ? "Guardar cambios" : "Crear reunión"}
        </button>
      </div>
    </div>
  );
}

/* ── Meeting card ── */
export function ReunionesPage({ currentUser }) {
  const [pageTab, setPageTab] = useState("meetings"); // "meetings" | "availability"
  const [kickoffs,      setKickoffs]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [selectedId,    setSelectedId]    = useState(null); // kickoff id in right panel
  const [filterConcierge, setFilterConcierge] = useState("all");
  const [search,        setSearch]        = useState("");
  const [addingFor,     setAddingFor]     = useState(null); // kickoffId when inline form open
  const [editingMeeting,setEditingMeeting]= useState(null); // {kickoffId, meeting}

  useEffect(() => {
    fetchKickoffsFromSheet()
      .then(data => {
        const arr = (data || []).map((k, idx) => ({
          ...k,
          id: k?.id || k?.kickoffId || k?.ID || `row-${idx}`,
          guestName: String(k?.guestName || k?.GuestName || "").trim(),
          assignedConcierge: String(k?.assignedConcierge || k?.AssignedConcierge || "").trim(),
        }));
        setKickoffs(arr);
        if (arr.length > 0) setSelectedId(arr[0].id);
      })
      .catch(e => setError(String(e?.message || e)))
      .finally(() => setLoading(false));
  }, []);

  // helper: get meetings array for a kickoff
  const getMeetings = (k) => parseMeetings(k?.meetingNotes);

  // persist meetings for a kickoff
  const saveMeetings = async (kickoffId, updatedList) => {
    await updateKickoffInSheet(kickoffId, { meetingNotes: JSON.stringify(updatedList) });
    setKickoffs(prev => prev.map(k =>
      k.id === kickoffId ? { ...k, meetingNotes: JSON.stringify(updatedList) } : k
    ));
  };

  const handleAddMeeting = async (kickoffId, entry) => {
    const k = kickoffs.find(x => x.id === kickoffId);
    const existing = getMeetings(k);
    // Auto-tag first meeting as Kickoff Call, rest as Follow-up
    const autoType = existing.length === 0 ? "Kickoff Call" : (entry.type === "Kickoff Call" ? "Follow-up" : entry.type);
    await saveMeetings(kickoffId, [...existing, { ...entry, type: autoType }]);
    setAddingFor(null);
  };

  const handleEditMeeting = async (kickoffId, entry) => {
    const k = kickoffs.find(x => x.id === kickoffId);
    const updated = getMeetings(k).map(m => m.id === entry.id ? entry : m);
    await saveMeetings(kickoffId, updated);
    setEditingMeeting(null);
  };

  const handleDeleteMeeting = async (kickoffId, meetingId) => {
    if (!window.confirm("¿Eliminar esta reunión?")) return;
    const k = kickoffs.find(x => x.id === kickoffId);
    await saveMeetings(kickoffId, getMeetings(k).filter(m => m.id !== meetingId));
  };

  const handleToggleTask = async (kickoffId, meetingId, taskIdx) => {
    const k = kickoffs.find(x => x.id === kickoffId);
    const updated = getMeetings(k).map(m => {
      if (m.id !== meetingId && !(m.id === undefined && meetingId === undefined)) return m;
      if (m.id !== meetingId) return m;
      return { ...m, tasks: (m.tasks||[]).map((t,i) => i===taskIdx ? {...t,done:!t.done} : t) };
    });
    await saveMeetings(kickoffId, updated);
  };

  // KPIs across all kickoffs
  const kpis = useMemo(() => {
    let total=0, done=0, missed=0, pending=0, openTasks=0;
    kickoffs.forEach(k => {
      getMeetings(k).forEach(m => {
        total++;
        if (m.status==="done") done++;
        else if (m.status==="missed") missed++;
        else pending++;
        openTasks += (m.tasks||[]).filter(t=>!t.done).length;
      });
    });
    return { total, done, missed, pending, openTasks };
  }, [kickoffs]);

  // left panel: filter + sort
  const leftList = useMemo(() => {
    return kickoffs
      .filter(k => {
        if (filterConcierge !== "all" && k.assignedConcierge !== filterConcierge) return false;
        if (search && !k.guestName.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      })
      .sort((a,b) => {
        // most recent meeting date first
        const lastDate = (k) => {
          const ms = getMeetings(k);
          const dates = ms.map(m=>m.date).filter(Boolean).sort();
          return dates[dates.length-1] || "";
        };
        return lastDate(b).localeCompare(lastDate(a));
      });
  }, [kickoffs, filterConcierge, search]);

  const selectedKickoff = kickoffs.find(k => k.id === selectedId);
  const selectedMeetings = selectedKickoff ? getMeetings(selectedKickoff).slice().sort((a,b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  }) : [];

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#f7f4ef", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Jost',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:28, marginBottom:12 }}>📅</div>
        <p style={{ color:"#9a7d52", fontSize:14 }}>Cargando clientes…</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", background:"#fff1f1", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Jost',sans-serif", padding:32 }}>
      <div style={{ textAlign:"center" }}>
        <p style={{ color:"#dc2626", fontWeight:600, marginBottom:8 }}>Error al cargar datos</p>
        <pre style={{ fontSize:12, color:"#6b0000", whiteSpace:"pre-wrap" }}>{error}</pre>
        <a href="/?mode=concierge" style={{ color:"#9a7d52", fontSize:13 }}>← Volver al panel</a>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f7f4ef", fontFamily:"'Jost',sans-serif", display:"flex", flexDirection:"column" }}>

      {/* ── Top bar ── */}
      <div style={{ background:"#1a1814", padding:"14px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <a href="/?mode=concierge" style={{ fontSize:12, color:"#9a7d52", textDecoration:"none" }}>← Panel</a>
          <span style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:"#f5f0e8" }}>Reuniones</span>
          <div style={{ display:"flex", gap:4, marginLeft:24 }}>
            <button type="button" onClick={() => setPageTab("meetings")}
              style={{ padding:"4px 12px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:500,
                background: pageTab === "meetings" ? "#9a7d52" : "transparent",
                color: pageTab === "meetings" ? "#fff" : "#9a7d52" }}>
              Agenda
            </button>
            <button type="button" onClick={() => setPageTab("availability")}
              style={{ padding:"4px 12px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:500,
                background: pageTab === "availability" ? "#9a7d52" : "transparent",
                color: pageTab === "availability" ? "#fff" : "#9a7d52" }}>
              Mi disponibilidad
            </button>
          </div>
        </div>
        {/* KPIs inline */}
        <div style={{ display:"flex", gap:20 }}>
          {[
            { label:"Total", val:kpis.total, color:"#f5f0e8" },
            { label:"Hechas", val:kpis.done, color:"#4ade80" },
            { label:"Pendientes", val:kpis.pending, color:"#60a5fa" },
            { label:"No asistió", val:kpis.missed, color:"#f87171" },
            { label:"Tareas abiertas", val:kpis.openTasks, color:"#fbbf24" },
          ].map(k => (
            <div key={k.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:700, color:k.color, lineHeight:1 }}>{k.val}</div>
              <div style={{ fontSize:9, color:"#9a7d52", letterSpacing:".06em", textTransform:"uppercase" }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Availability panel ── */}
      {pageTab === "availability" && (
        <div style={{ flex:1, overflow:"auto", padding:"32px", display:"flex", justifyContent:"center" }}>
          <div style={{ width:"100%", maxWidth:600 }}>
            <AvailabilityManager
              conciergeEmail={currentUser?.email || ""}
              conciergeName={currentUser?.name || currentUser?.email || ""}
            />
          </div>
        </div>
      )}

      {/* ── 2-panel body ── */}
      {pageTab === "meetings" && (
      <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

        {/* LEFT: client list */}
        <div style={{ width:260, flexShrink:0, borderRight:"1px solid #e5ddd3", background:"#fff", display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* search + filter */}
          <div style={{ padding:"10px 12px", borderBottom:"1px solid #eee8df" }}>
            <input
              value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Buscar cliente…"
              style={{ width:"100%", border:"1px solid #e5ddd3", borderRadius:7, padding:"6px 10px", fontSize:12, fontFamily:"'Jost',sans-serif", outline:"none", boxSizing:"border-box", marginBottom:6 }}
            />
            <select value={filterConcierge} onChange={e=>setFilterConcierge(e.target.value)}
              style={{ width:"100%", border:"1px solid #e5ddd3", borderRadius:7, padding:"6px 8px", fontSize:11, fontFamily:"'Jost',sans-serif", outline:"none", background:"#fff", cursor:"pointer" }}>
              <option value="all">Todos los concierges</option>
              {CONCIERGE_LIST.map(c=><option key={c.name} value={c.name}>{c.name.split(" ")[0]}</option>)}
            </select>
          </div>
          {/* list */}
          <div style={{ overflowY:"auto", flex:1 }}>
            {leftList.length === 0 && <div style={{ padding:20, textAlign:"center", color:"#b0a090", fontSize:12 }}>Sin resultados</div>}
            {leftList.map(k => {
              const ms = getMeetings(k);
              const pendingCount = ms.filter(m=>m.status==="pending"||m.status==="scheduled").length;
              const lastDate = ms.map(m=>m.date).filter(Boolean).sort().slice(-1)[0];
              const isSelected = k.id === selectedId;
              return (
                <div key={k.id} onClick={()=>{ setSelectedId(k.id); setAddingFor(null); setEditingMeeting(null); }}
                  style={{ padding:"10px 14px", borderBottom:"1px solid #f0ebe2", cursor:"pointer", background: isSelected ? "#f5f0e8" : "transparent", borderLeft: isSelected ? "3px solid #9a7d52" : "3px solid transparent", transition:"background .1s" }}>
                  <div style={{ fontWeight:600, fontSize:13, color:"#1a1814", marginBottom:2 }}>{k.guestName || "—"}</div>
                  <div style={{ fontSize:10, color:"#9a7d52", marginBottom:3 }}>{k.assignedConcierge || "Sin concierge"}</div>
                  <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span style={{ fontSize:10, color:"#b0a090" }}>{ms.length} reunión{ms.length!==1?"es":""}</span>
                    {pendingCount>0 && <span style={{ fontSize:10, background:"#dbeafe", color:"#2563eb", borderRadius:4, padding:"1px 5px", fontWeight:600 }}>{pendingCount} pend.</span>}
                    {lastDate && <span style={{ fontSize:10, color:"#b0a090", marginLeft:"auto" }}>{lastDate.slice(5)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: meeting timeline */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {!selectedKickoff ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#b0a090", fontSize:14 }}>
              Selecciona un cliente
            </div>
          ) : (
            <>
              {/* client header */}
              <div style={{ padding:"14px 20px", borderBottom:"1px solid #eee8df", background:"#fff", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:600, color:"#1a1814" }}>{selectedKickoff.guestName}</div>
                    <div style={{ fontSize:11, color:"#9a7d52" }}>
                      {selectedKickoff.assignedConcierge || "Sin concierge asignado"}
                      {selectedKickoff.city ? ` · ${selectedKickoff.city}` : ""}
                      {selectedKickoff.arrivalDate ? ` · Llegada: ${selectedKickoff.arrivalDate}` : ""}
                    </div>
                  </div>
                  <button onClick={()=>{ setAddingFor(selectedId); setEditingMeeting(null); }}
                    style={{ background:"#1a1814", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, cursor:"pointer", fontFamily:"'Jost',sans-serif" }}>
                    + Nueva llamada
                  </button>
                </div>
              </div>

              {/* timeline */}
              <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
                {/* inline add form */}
                {addingFor === selectedId && (
                  <MeetingFormInline
                    kickoffId={selectedId}
                    initial={null}
                    onSave={(entry) => handleAddMeeting(selectedId, entry)}
                    onCancel={()=>setAddingFor(null)}
                  />
                )}

                {selectedMeetings.length === 0 && !addingFor && (
                  <div style={{ textAlign:"center", padding:"40px 0", color:"#b0a090" }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>📞</div>
                    <p style={{ fontSize:13 }}>No hay llamadas registradas.</p>
                    <button onClick={()=>setAddingFor(selectedId)}
                      style={{ marginTop:8, background:"#9a7d52", color:"#fff", border:"none", borderRadius:7, padding:"7px 16px", fontSize:12, cursor:"pointer", fontFamily:"'Jost',sans-serif" }}>
                      Registrar primera llamada
                    </button>
                  </div>
                )}

                {selectedMeetings.map(m => {
                  const isEditing = editingMeeting?.kickoffId === selectedId && editingMeeting?.meeting?.id === m.id;
                  return (
                    <div key={m.id || m.date + m.time}>
                      {isEditing ? (
                        <MeetingFormInline
                          kickoffId={selectedId}
                          initial={{ ...m }}
                          onSave={(entry) => handleEditMeeting(selectedId, entry)}
                          onCancel={()=>setEditingMeeting(null)}
                        />
                      ) : (
                        <MeetingRow
                          meeting={m}
                          onEdit={()=>{ setEditingMeeting({ kickoffId:selectedId, meeting:m }); setAddingFor(null); }}
                          onDelete={()=>handleDeleteMeeting(selectedId, m.id)}
                          onToggleTask={(i)=>handleToggleTask(selectedId, m.id, i)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function CheckinResponsesSection({ kickoffId }) {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
  const [responses, setResponses] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [open,      setOpen]      = useState(false);

  useEffect(() => {
    if (!open || !kickoffId) return;
    setLoading(true);
    fetch(GAS_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getCheckinResponses", kickoffId }),
    }).then(r => r.json()).then(d => {
      if (d.ok) setResponses(d.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [open, kickoffId]);

  const dietary = responses.filter(r => r.foodRestrictions || r.allergies);
  const arrivals = responses.filter(r => r.arrivalFlight || r.arrivalDate);
  const departures = responses.filter(r => r.departureFlight || r.departureDate);

  const fmtDate = (s) => {
    if (!s) return "";
    try { return new Date(s + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "short" }); }
    catch { return s; }
  };

  return (
    <div className="border border-teal-200 rounded-xl bg-teal-50/40 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-teal-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">👥 Check-in Responses</span>
          {responses.length > 0 && (
            <span className="text-[10px] bg-teal-100 text-teal-700 rounded-full px-2 py-0.5 font-semibold">
              {responses.length} {responses.length === 1 ? "persona" : "personas"}
            </span>
          )}
        </div>
        <span className="text-teal-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {loading && <p className="text-xs text-neutral-400 text-center py-3">Cargando…</p>}

          {!loading && responses.length === 0 && (
            <p className="text-xs text-neutral-400 text-center py-3">
              Aún no hay respuestas del grupo.
            </p>
          )}

          {!loading && responses.length > 0 && (<>

            {/* Pasaportes */}
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">🪪 Pasaportes</p>
              <div className="space-y-1.5">
                {responses.map((r, i) => (
                  <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-teal-100 grid grid-cols-2 gap-x-3">
                    <div>
                      <span className="font-semibold text-neutral-800">{r.firstName} {r.lastName}</span>
                      {r.nationality && <span className="text-neutral-400 ml-1">· {r.nationality}</span>}
                    </div>
                    <div className="text-neutral-500">
                      {r.idType && <span>{r.idType}: </span>}
                      <span className="font-mono">{r.idNumber || "—"}</span>
                      {r.dob && <span className="text-neutral-400 ml-1">· {fmtDate(r.dob)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Restricciones alimentarias */}
            {dietary.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">🥗 Restricciones alimentarias</p>
                <div className="space-y-1.5">
                  {dietary.map((r, i) => (
                    <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-orange-100">
                      <span className="font-semibold text-neutral-700">{r.firstName} {r.lastName}: </span>
                      {r.foodRestrictions && <span className="text-neutral-600">{r.foodRestrictions}</span>}
                      {r.allergies && <span className="text-red-600 ml-1">⚠️ {r.allergies}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vuelos llegada */}
            {arrivals.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">🛬 Vuelos de llegada</p>
                <div className="space-y-1.5">
                  {arrivals.map((r, i) => (
                    <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-teal-100 flex justify-between items-center">
                      <span className="font-semibold text-neutral-700">{r.firstName} {r.lastName}</span>
                      <span className="text-neutral-500">
                        {r.arrivalAirline && <span>{r.arrivalAirline} </span>}
                        {r.arrivalFlight && <span className="font-mono font-semibold text-neutral-700">{r.arrivalFlight}</span>}
                        {r.arrivalDate && <span className="ml-1 text-neutral-400">· {fmtDate(r.arrivalDate)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vuelos salida */}
            {departures.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">🛫 Vuelos de salida</p>
                <div className="space-y-1.5">
                  {departures.map((r, i) => (
                    <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-teal-100 flex justify-between items-center">
                      <span className="font-semibold text-neutral-700">{r.firstName} {r.lastName}</span>
                      <span className="text-neutral-500">
                        {r.departureAirline && <span>{r.departureAirline} </span>}
                        {r.departureFlight && <span className="font-mono font-semibold text-neutral-700">{r.departureFlight}</span>}
                        {r.departureDate && <span className="ml-1 text-neutral-400">· {fmtDate(r.departureDate)}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contactos / WhatsApp */}
            <div>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">📱 Contactos del grupo</p>
              <div className="space-y-1.5">
                {responses.filter(r => r.phone || r.email).map((r, i) => (
                  <div key={i} className="bg-white rounded-lg px-3 py-2 text-xs border border-teal-100 flex justify-between">
                    <span className="font-semibold text-neutral-700">
                      {r.firstName} {r.lastName}
                      {r.isGroupContact === "yes" && <span className="ml-1 text-teal-600 text-[9px]">★ contacto principal</span>}
                    </span>
                    <span className="text-neutral-500">
                      {r.phone && <a href={`https://wa.me/${r.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" className="text-green-600 hover:underline mr-2">{r.phone}</a>}
                      {r.email && <span className="text-neutral-400">{r.email}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </>)}
        </div>
      )}
    </div>
  );
}

export default function ConciergePanel({ onLogout, currentUser }) {

  const [kickoffs, setKickoffs] = useState([]);
  const [selectedKickoffForLink, setSelectedKickoffForLink] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conciergeFilter, setConciergeFilter] = useState("all");

  const [selectedForSummary, setSelectedForSummary] = useState(null);
  const [selectedForEdit, setSelectedForEdit] = useState(null);
  const [selectedForDelete, setSelectedForDelete] = useState(null);
  const [rowLoadingId, setRowLoadingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
const [clientTypePickerOpen, setClientTypePickerOpen] = useState(false);
const [pendingLinkKind, setPendingLinkKind] = useState(null); // "catalog" | "questionnaire" | "feedback"
const [feedbackPickerOpen, setFeedbackPickerOpen] = useState(false);
const [ratingModalKickoff, setRatingModalKickoff] = useState(null); // kickoff pending rating before link is shared
const [portalLang, setPortalLang] = useState("en"); // language for client-facing links
const [createModalOpen, setCreateModalOpen] = useState(false);
const [openMenuId, setOpenMenuId] = useState(null); // row actions dropdown
const [showRatings, setShowRatings] = useState(false); // ratings summary panel
  const normalizeId = (obj) =>
  obj?.id || obj?.kickoffId || obj?.ID || obj?._id || "";

const loadKickoffs = async () => {
  setLoading(true);
  setLoadError("");

  try {
    const data = await fetchKickoffsFromSheet();

    const arr = (data || []).map((k, idx) => {
      const id = normalizeId(k);
      const safeId = String(id || `row-${idx}`);

      const parseJsonArr = (v) => {
        if (Array.isArray(v)) return v;
        if (typeof v === "string" && v.trim().startsWith("[")) {
          try { return JSON.parse(v) || []; } catch { return []; }
        }
        return [];
      };

      const cart    = parseJsonArr(k?.cart    ?? k?.Cart    ?? k?.itinerary ?? []);
      const dayMeta = parseJsonArr(k?.dayMeta ?? k?.day_meta ?? []);

      return {
        ...k,
        id: safeId,
        createdAt: k?.createdAt || k?.CreatedAt || k?.timestamp || new Date().toISOString(),
        clientType: String(k?.clientType || "").toLowerCase().includes("2") ? 2 : 1,
        guestContact: String(
          k?.guestContact || k?.GuestContact || k?.guest_contact ||
          k?.contact || k?.Contact || k?.contacto || k?.Contacto || ""
        ).trim(),
        assignedConcierge: String(k?.assignedConcierge || k?.AssignedConcierge || k?.concierge || "").trim(),
        cart,
        dayMeta,
      };
    });

    setKickoffs(arr);

    setSelectedKickoffForLink((prev) => {
  if (!prev) return null;
  const stillExists = arr.find((x) => x.id === prev.id);
  return stillExists || null;
});
  } catch (err) {
    console.error("LOAD KICKOFFS ERROR:", err);
    setLoadError(err?.message || String(err) || "Error cargando kick-offs");
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    loadKickoffs();
  }, []);
  // After creating a new client, store the kickoff here so we can show both links
  const [newClientKickoff, setNewClientKickoff] = useState(null);

  const handleCreateAndOpenLink = async (form) => {
    const {
      guestName,
      email,
      tripName,
      guestContact,
      city,
      concierge: assignedConciergeName,
      conciergeEmail: assignedConciergeEmail,
      clientType,
    } = form;

    const kickoffId = `ko_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const created = await saveKickoffToSheet({
      id: kickoffId,
      guestName,
      email,
      guestEmail: email,
      tripName,
      guestContact,
      city,
      clientType,
      assignedConcierge: assignedConciergeName,
      assignedConciergeName,
      assignedConciergeEmail,
      createdAt: new Date().toISOString(),
      status: "new",
      conciergeSummary: "",

      internalNotes: "",
      cart: [],
      welcomePdfUrl: "https://drive.google.com/file/d/1-FMeJcmJUVz-9ULTXt6-7eIi_lGa0Y2X/view?usp=drivesdk",
      preTripContent: DEFAULT_PRE_TRIP,
    });

    const kickoff = {
      ...created,
      id: created?.id || kickoffId,
      guestName, email, tripName, guestContact, city, clientType,
      assignedConcierge: assignedConciergeName,
      assignedConciergeName, assignedConciergeEmail,
    };

    setKickoffs((prev) => [kickoff, ...(prev || [])]);
    setSelectedKickoffForLink(kickoff);

    // ⚠ Capture BEFORE clearing state — React batches don't apply mid-function
    const linkKind = pendingLinkKind;
    setCreateModalOpen(false);
    setPendingLinkKind(null);

    // If triggered from a specific link button, open just that link
    if (linkKind && linkKind !== "both") {
      const link =
        linkKind === "questionnaire"
          ? buildQuestionnaireLink(kickoff, clientType, portalLang)
          : linkKind === "feedback"
          ? buildFeedbackLink(kickoff, clientType, portalLang)
          : buildCatalogLink(kickoff, clientType, portalLang);
      try { await navigator.clipboard.writeText(link); } catch {}
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      // Default: show both links modal
      setNewClientKickoff(kickoff);
    }
  };

  // Use fixed concierge list for the filter dropdown
  const conciergeOptions = useMemo(() => {
    return ["all", ...CONCIERGE_LIST.map((c) => c.name)];
  }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (filtered) => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(k => k.id)));
    }
  };

  const bulkArchive = async () => {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map(id => updateKickoffInSheet(id, { status: "done" })));
      setKickoffs(prev => prev.map(k => selectedIds.has(k.id) ? { ...k, status: "done" } : k));
      setSelectedIds(new Set());
    } catch {}
    setBulkLoading(false);
  };

  const bulkDelete = async () => {
    if (!selectedIds.size) return;
    if (!window.confirm(`¿Eliminar ${selectedIds.size} cliente(s)? Esta acción no se puede deshacer.`)) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map(id => deleteKickoff(id)));
      setKickoffs(prev => prev.filter(k => !selectedIds.has(k.id)));
      setSelectedIds(new Set());
    } catch {}
    setBulkLoading(false);
  };

  const filteredKickoffs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (kickoffs || [])
      .filter((k) => {
        if (statusFilter !== "all" && k.status !== statusFilter) return false;
        if (conciergeFilter !== "all" && !String(k.assignedConcierge || "").split(",").map(s => s.trim()).includes(conciergeFilter)) return false;

        if (!q) return true;
        const text = [
          k.id,
          k.guestName,
          k.tripName,
          k.assignedConcierge,
          k.conciergeSummary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      })
      .sort((a, b) => {
        const da = new Date(a.lastModified || a.createdAt || 0).getTime();
        const db = new Date(b.lastModified || b.createdAt || 0).getTime();
        return db - da;
      });
  }, [kickoffs, search, statusFilter, conciergeFilter]);

  // Updates kickoff locally + in sheet but does NOT close the drawer
  const handleSilentUpdate = async (id, updates) => {
    const stamped = { ...updates, lastModified: new Date().toISOString() };
    // Update local state immediately (optimistic); bubble to front so it sorts first
    setKickoffs((prev) => {
      let updated = null;
      const rest = prev.filter((k) => {
        if (k.id !== id) return true;
        const next = { ...k, ...stamped };
        if ("guestContact" in updates && String(updates.guestContact || "").trim() === "") {
          next.guestContact = k.guestContact || "";
        }
        updated = next;
        return false;
      });
      return updated ? [updated, ...rest] : prev;
    });
    try {
      await updateKickoffInSheet(id, stamped);
    } catch (err) {
      console.error("Silent update failed:", err);
    }
  };

  const generateHandoffsFromItinerary = async (id, updates, prevKickoff) => {
    const GAS = TASK_API_URL;
    const k = { ...(prevKickoff || {}), ...updates };
    // Parse cart: itinerary canvas items
    let cart = [];
    try {
      const raw = updates.cart ?? prevKickoff?.cart ?? [];
      cart = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw));
    } catch {}
    if (!Array.isArray(cart)) cart = [];
    const items = cart.filter(item => item && (item.displayName || item.name || item.title));

    if (!items.length) return;

    const clientName = k.guestName || k.tripName || "";
    const dateStr    = k.arrivalDate ? k.arrivalDate.slice(0, 10) : (k._rowArrival ? k._rowArrival.slice(0, 10) : "");

    // Fetch existing handoffs and replace this client's entries (upsert = no duplicates on re-saves)
    const existingRes = await fetch(GAS, { method: "POST", body: JSON.stringify({ action: "getHandoffs", payload: {} }) });
    const existingJson = await existingRes.json().catch(() => ({ data: [] }));
    const existing = (existingJson.data || []).filter(h => h.client !== clientName);

    const now = new Date().toISOString();
    const newHandoffs = items.map(item => ({
      id: "hf_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      client: clientName,
      date: dateStr,
      activity: item.displayName || item.name || item.title || "Servicio",
      pax: k.groupSize || k.pax || "",
      operator: "",
      bookingWhere: "",
      travefy: "",
      confirmation: "",
      person: k.assignedConciergeName || k.assignedConcierge || "",
      personLive: "",
      notes: [item.timeLabel || item.time || "", item.location || ""].filter(Boolean).join(" · "),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }));

    await fetch(GAS, { method: "POST", body: JSON.stringify({ action: "saveHandoffs", payload: { handoffs: [...existing, ...newHandoffs] } }) });
    // Monday push is manual (button in Handoffs panel after client leaves)
  };

  const handleSaveEdit = async (id, updates) => {
  try {
    setRowLoadingId(id);
    updates.lastModified = new Date().toISOString();
    await updateKickoffInSheet(id, updates);

    // Sync Handoffs when itinerary is in preview or later (create on first, update on re-saves)
    if (["sent_to_preview", "sent_to_travify", "feedback_submitted"].includes(updates.status)) {
      const prevKickoff = kickoffs.find(k => k.id === id);
      generateHandoffsFromItinerary(id, updates, prevKickoff).catch(e => console.warn("Handoff sync error:", e));
    }

    setKickoffs((prev) =>
      prev.map((k) => {
        if (k.id !== id) return k;
        const next = { ...k, ...updates };
        // Parse back stringified cart/dayMeta so local state stays as arrays
        if (typeof next.cart    === "string") { try { next.cart    = JSON.parse(next.cart);    } catch {} }
        if (typeof next.dayMeta === "string") { try { next.dayMeta = JSON.parse(next.dayMeta); } catch {} }
        return next;
      })
    );

  } catch (err) {
    console.error("handleSaveEdit error:", err);
    alert("No se pudieron guardar los cambios.\n\nDetalle: " + (err?.message || String(err)));
  } finally {
    setRowLoadingId(null);
  }
};

  const handleConfirmDelete = async () => {
  if (!selectedForDelete) return;
  const id = selectedForDelete.id;

  try {
    setDeleting(true);
    await deleteKickoff(id);

    setKickoffs((prev) => {
      const next = prev.filter((k) => k.id !== id);

      setSelectedKickoffForLink((curr) => {
  if (!curr) return null;
  if (curr.id !== id) return curr;
  return null;
});

      return next;
    });

    setSelectedForDelete(null);
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar el kick-off.");
  } finally {
    setDeleting(false);
  }
};

  const cp = {
    es: {
      subtitle: "Gestión interna de kick-offs enviados desde el catálogo.",
      refresh: "Refrescar", refreshing: "Actualizando...",
      search: "Buscar por huésped, viaje, ID...",
      filterStatus: "Estado:", filterConcierge: "Concierge:",
      all: "Todos",
      colGuest: "Huésped", colTrip: "Viaje", colType: "Tipo",
      colContact: "Contacto", colCreated: "Creado",
      colConcierge: "Concierge", colCity: "Ciudad", colStatus: "Estado", colMeetings: "Reuniones", colActions: "Acciones",
      loading: "Cargando kick-offs...",
      empty: "No hay kick-offs que coincidan con el filtro.",
      linkCatalog: "Link catálogo", linkFeedback: "Link feedback",
    },
    en: {
      subtitle: "Internal kick-off management — sent from the catalog.",
      refresh: "Refresh", refreshing: "Refreshing...",
      search: "Search by guest, trip, ID...",
      filterStatus: "Status:", filterConcierge: "Concierge:",
      all: "All",
      colGuest: "Guest", colTrip: "Trip", colType: "Type",
      colContact: "Contact", colCreated: "Created",
      colConcierge: "Concierge", colCity: "City", colStatus: "Status", colMeetings: "Meetings", colActions: "Actions",
      loading: "Loading kick-offs...",
      empty: "No kick-offs match the current filter.",
      linkCatalog: "Catalog link", linkFeedback: "Feedback link",
    },
  }[portalLang];

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column"}}>
      <header className="tt-topbar">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Concierge Panel</span>
          <span style={{fontSize:11,color:"var(--text-3)",fontWeight:400}}>{filteredKickoffs.length} clientes</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>

  <a
    href="/?mode=reuniones"
    className="tt-btn-ghost"
    title="CRM de llamadas y reuniones"
  >
    📅 Reuniones
  </a>

  <a
    href="/book-admin.html"
    className="tt-btn-ghost"
    title="Gestionar calendarios de booking"
  >
    🗓 Calendarios
  </a>

  {currentUser?.email && (() => {
    const slug = currentUser.email.split("@")[0].toLowerCase();
    return (
      <a href={`/book-admin.html?c=${slug}`} className="tt-btn-ghost" title="Mi perfil">
        👤 Mi perfil
      </a>
    );
  })()}

  <button
    type="button"
    onClick={() => setPortalLang(l => l === "en" ? "es" : "en")}
    className="tt-btn-ghost"
    title="Idioma del catálogo que verá el cliente"
  >
    {portalLang === "en" ? "EN" : "ES"}
  </button>

  <button
    onClick={loadKickoffs}
    disabled={loading}
    className="tt-btn-ghost"
    style={{display:"flex",alignItems:"center",gap:6,opacity:loading?.6:1}}
  >
    <RefreshCcw className="w-3.5 h-3.5" />
    {loading ? "Actualizando…" : "Refrescar"}
  </button>

  {currentUser?.role !== "junior" && (
  <button
    type="button"
    onClick={() => { setPendingLinkKind("both"); setCreateModalOpen(true); }}
    className="tt-btn-primary"
  >
    + Nuevo cliente
  </button>
  )}

  <a
    href="/menu.html"
    className="tt-btn-ghost"
    title="Menú principal"
  >
    Menu
  </a>

  {currentUser && (
    <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:8,borderLeft:"1px solid var(--border)"}}>
      <span style={{fontSize:11,color:"var(--text-3)"}}>{currentUser.name}</span>
      <button onClick={onLogout} style={{fontSize:11,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer"}} title="Cerrar sesión">
        Salir
      </button>
    </div>
  )}

</div>
      </header>

      <main style={{flex:1,maxWidth:1280,width:"100%",margin:"0 auto",padding:"16px 24px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center",justifyContent:"space-between"}}>
          <div style={{position:"relative",width:260}}>
            <Search style={{width:14,height:14,color:"var(--text-3)",position:"absolute",left:9,top:"50%",transform:"translateY(-50%)"}} />
            <input
              style={{width:"100%",paddingLeft:30,paddingRight:10,paddingTop:7,paddingBottom:7,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",fontSize:12.5,background:"var(--surface)",boxSizing:"border-box"}}
              placeholder={cp.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:8}}>
            <select
              style={{border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"5px 9px",fontSize:12,background:"var(--surface)"}}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="new">{statusLabel("new", portalLang)}</option>
              <option value="client_submitted">{statusLabel("client_submitted", portalLang)}</option>
              <option value="concierge_editing">{statusLabel("concierge_editing", portalLang)}</option>
              <option value="sent_to_preview">{statusLabel("sent_to_preview", portalLang)}</option>
              <option value="sent_to_travify">{statusLabel("sent_to_travify", portalLang)}</option>
              <option value="feedback_submitted">{statusLabel("feedback_submitted", portalLang)}</option>
              <option value="done">{statusLabel("done", portalLang)}</option>
            </select>

            {conciergeOptions.length > 1 && (
              <div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                {conciergeOptions.map((c) => {
                  const found = CONCIERGE_LIST.find(x => x.name === c);
                  const label = c === "all" ? "Todos" : (found?.name.split(" ")[0] || c);
                  const active = conciergeFilter === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setConciergeFilter(c)}
                      className={`tt-pill${active ? " active" : ""}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Ratings summary toggle ── */}
        <div>
          <button
            onClick={() => setShowRatings(v => !v)}
            style={{fontSize:11.5,fontWeight:500,color:"#D97706",background:"none",border:"none",cursor:"pointer",padding:"2px 0"}}
          >
            {showRatings ? "Ocultar ratings" : "Ver ratings"}
          </button>

          {showRatings && (() => {
            // Get best available rating per kickoff: avg of cityRatings, or conciergeRating
            const getRating = (k) => {
              try {
                const cr = (()=>{ try { return JSON.parse(k.cityRatings||"[]"); } catch { return []; } })().filter(r => Number(r.rating) > 0);
                if (cr.length) return cr.reduce((s, r) => s + Math.min(5, Math.max(0, Number(r.rating)||0)), 0) / cr.length;
              } catch {}
              return Math.min(5, Math.max(0, Number(k.conciergeRating) || 0));
            };
            const rated = kickoffs.filter(k => getRating(k) > 0);
            const total = rated.length;
            const avg   = total ? (rated.reduce((s, k) => s + getRating(k), 0) / total).toFixed(1) : "—";

            // Group by concierge, splitting multi-city ratings by position
            // Supports both city codes (CTG) and full names (Cartagena) in cityRatings
            const CITY_CODE_TO_NAME = { CTG:"cartagena", MDE:"medellín", CDMX:"ciudad de méxico", TUL:"tulum", BOG:"bogotá" };
            const normCity = (v) => {
              const u = String(v || "").trim().toUpperCase();
              return (CITY_CODE_TO_NAME[u] || u.toLowerCase()); // normalise to lowercase full name
            };
            const byC = {};
            const addToByC = (name, rating) => {
              const key = (name || "Sin asignar").trim();
              if (!byC[key]) byC[key] = [];
              byC[key].push(Math.min(5, Math.max(0, Number(rating) || 0)));
            };
            rated.forEach(k => {
              const concierges = String(k.assignedConcierge || k.assignedConciergeName || "")
                .split(",").map(s => s.trim()).filter(Boolean);
              // cities normalised to lowercase full names for matching
              const cities = String(k.city || "").split(",").map(s => normCity(s)).filter(Boolean);
              let cityRatingsArr = [];
              try { cityRatingsArr = JSON.parse(k.cityRatings || "[]").filter(r => Number(r.rating) > 0); } catch {}

              if (cityRatingsArr.length > 0 && concierges.length > 1) {
                cityRatingsArr.forEach(cr => {
                  const crNorm = normCity(cr.city);
                  const cityIdx = cities.indexOf(crNorm);
                  const concierge = concierges[cityIdx >= 0 ? cityIdx : 0] || concierges[0];
                  addToByC(concierge, cr.rating);
                });
              } else if (cityRatingsArr.length > 0) {
                const name = concierges[0] || "Sin asignar";
                cityRatingsArr.forEach(cr => addToByC(name, cr.rating));
              } else {
                addToByC(concierges[0] || "Sin asignar", k.conciergeRating);
              }
            });
            const conciergeRows = Object.entries(byC)
              .map(([name, ratings]) => ({
                name,
                count: ratings.length,
                avg: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
                dist: [1,2,3,4,5].map(n => ratings.filter(r => Math.round(r) === n).length),
              }))
              .sort((a, b) => b.avg - a.avg);

            return (
              <div className="tt-card" style={{marginTop:8,padding:16}}>
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{avg}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">Promedio global</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-neutral-700">{total}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">Trips calificados</div>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    {[5,4,3,2,1].map(n => {
                      const cnt = rated.filter(k => Math.round(getRating(k)) === n).length;
                      const pct = total ? Math.round((cnt / total) * 100) : 0;
                      return (
                        <div key={n} className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] w-3 text-right text-neutral-500">{n}</span>
                          <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-neutral-400 w-6">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {conciergeRows.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-neutral-400 uppercase border-b border-neutral-100">
                        <th className="text-left pb-1 font-medium">Concierge</th>
                        <th className="text-center pb-1 font-medium">Trips</th>
                        <th className="text-center pb-1 font-medium">Promedio</th>
                        <th className="text-left pb-1 font-medium pl-3">Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conciergeRows.map(row => (
                        <tr key={row.name} className="border-b border-neutral-50 last:border-0">
                          <td className="py-1.5 text-neutral-700 font-medium">{row.name.split(" ").slice(0,2).join(" ")}</td>
                          <td className="py-1.5 text-center text-neutral-500">{row.count}</td>
                          <td className="py-1.5 text-center font-bold text-amber-500">{row.avg} ⭐</td>
                          <td className="py-1.5 pl-3 flex gap-0.5 items-end h-6">
                            {row.dist.map((cnt, i) => {
                              const h = row.count ? Math.round((cnt / row.count) * 20) + 2 : 2;
                              return <div key={i} style={{ height: h }} className="w-2.5 bg-amber-300 rounded-sm" title={`${i+1}★: ${cnt}`} />;
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })()}
        </div>

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {loadError}
          </div>
        )}

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div style={{display:"flex",alignItems:"center",gap:10,background:"#111",color:"#fff",borderRadius:"var(--radius-md)",padding:"8px 16px"}}>
            <span style={{fontSize:12,fontWeight:500,flex:1}}>{selectedIds.size} cliente{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
            <button onClick={bulkArchive} disabled={bulkLoading}
              style={{fontSize:11.5,padding:"4px 10px",borderRadius:"var(--radius-sm)",border:"none",background:"rgba(255,255,255,.12)",color:"#fff",cursor:"pointer",opacity:bulkLoading?.5:1}}>
              {bulkLoading ? "…" : "Marcar cerrados"}
            </button>
            <button onClick={bulkDelete} disabled={bulkLoading}
              style={{fontSize:11.5,padding:"4px 10px",borderRadius:"var(--radius-sm)",border:"none",background:"#DC2626",color:"#fff",cursor:"pointer",opacity:bulkLoading?.5:1}}>
              {bulkLoading ? "…" : "Eliminar"}
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              style={{fontSize:11.5,color:"rgba(255,255,255,.5)",background:"none",border:"none",cursor:"pointer",marginLeft:4}}>
              Cancelar
            </button>
          </div>
        )}

        <div className="tt-card" style={{overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table className="tt-table" style={{minWidth:"100%"}}>
              <thead>
                <tr>
                  <th style={{width:36,padding:"8px 12px"}}>
                    <input type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredKickoffs.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredKickoffs.length; }}
                      onChange={() => toggleSelectAll(filteredKickoffs)}
                      style={{width:13,height:13,cursor:"pointer"}}
                    />
                  </th>
                  {["ID", cp.colGuest, cp.colTrip, cp.colType, cp.colContact, cp.colCreated, cp.colConcierge, cp.colCity, cp.colStatus, cp.colMeetings].map(h => (
                    <th key={h} style={{textAlign:"left"}}>{h}</th>
                  ))}
                  <th style={{textAlign:"right"}}>{cp.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{textAlign:"center",padding:"32px 16px",color:"var(--text-3)"}}>
                      {cp.loading}
                    </td>
                  </tr>
                )}

                {!loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{textAlign:"center",padding:"32px 16px",color:"var(--text-3)"}}>
                      {cp.empty}
                    </td>
                  </tr>
                )}

                {filteredKickoffs.map((k) => (
                  <tr
                    key={k.id}
                    onClick={() => setSelectedKickoffForLink(k)}
                    style={{
                      cursor:"pointer",
                      background: selectedKickoffForLink?.id === k.id ? "var(--border-soft)" : selectedIds.has(k.id) ? "#F5F5F4" : undefined,
                    }}
                  >
                    <td style={{padding:"8px 12px",width:36}} onClick={e => e.stopPropagation()}>
                      <input type="checkbox"
                        checked={selectedIds.has(k.id)}
                        onChange={() => toggleSelect(k.id)}
                        style={{width:13,height:13,cursor:"pointer"}}
                      />
                    </td>

                    <td style={{fontFamily:"monospace",fontSize:10.5,color:"var(--text-3)",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {k.id}
                    </td>

                    <td style={{fontWeight:500,color:"var(--text-1)"}}>
                      {k.guestName || "Sin nombre"}
                      <div style={{display:"flex",gap:4,marginTop:2,flexWrap:"wrap"}}>
                        {k.passportOk && (
                          <span title="Pasaportes recolectados" style={{fontSize:9,background:"#EFF6FF",color:"#1D4ED8",border:"1px solid #BFDBFE",borderRadius:3,padding:"0px 5px",fontWeight:600}}>
                            🛂 passport ✓
                          </span>
                        )}
                        {k.briefDietary && (
                          <span title={k.briefDietary} style={{fontSize:9,background:"#FFF7ED",color:"#C2410C",border:"1px solid #FED7AA",borderRadius:3,padding:"0px 5px",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block",verticalAlign:"middle"}}>
                            🥗 {k.briefDietary}
                          </span>
                        )}
                        {k.passportInfo && (
                          <span title={k.passportInfo} style={{fontSize:9,background:"#F0FDF4",color:"#15803D",border:"1px solid #BBF7D0",borderRadius:3,padding:"0px 5px",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"inline-block",verticalAlign:"middle"}}>
                            🪪 {k.passportInfo.split("\n")[0]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{color:"var(--text-2)"}}>
                      {k.tripName || <span style={{color:"var(--text-3)",fontStyle:"italic"}}>—</span>}
                    </td>

                    <td onClick={e => e.stopPropagation()}>
                      <select
                        value={String(k.clientType).includes("2") ? 2 : 1}
                        onClick={(e) => e.stopPropagation()}
                        onChange={async (e) => {
                          const newType = Number(e.target.value);
                          const rawCart = typeof k.cart === "string" ? (() => { try { return JSON.parse(k.cart); } catch { return []; } })() : (k.cart || []);
                          const updatedCart = rawCart.map((item) => {
                            const base = Number(item.base_price_cop || item.price_cop || 0);
                            const t1 = Number(item.price_tier_1 || 0);
                            const t2 = Number(item.price_tier_2 || 0);
                            if (!t1 && !t2) return item;
                            return { ...item, price_cop: newType === 2 ? (t2 || base) : (t1 || base) };
                          });
                          await updateKickoffInSheet(k.id, { clientType: newType, cart: JSON.stringify(updatedCart) });
                          setKickoffs((prev) => prev.map((item) => item.id === k.id ? { ...item, clientType: newType, cart: updatedCart } : item));
                        }}
                        style={{border:"1px solid var(--border)",borderRadius:"var(--radius-xs)",padding:"3px 7px",fontSize:11.5,background:"var(--surface)"}}
                      >
                        <option value={1}>Tipo 1</option>
                        <option value={2}>Tipo 2</option>
                      </select>
                    </td>
                    <td style={{color:"var(--text-2)"}}>
                      {k.guestContact || <span style={{color:"var(--text-3)",fontStyle:"italic"}}>—</span>}
                    </td>

                    <td style={{color:"var(--text-3)",whiteSpace:"nowrap"}}>
                      {formatDateTime(k.createdAt)}
                    </td>

                    <td style={{color:"var(--text-2)"}}>
                      {(() => {
                        const v = String(k.assignedConcierge || "").trim();
                        if (!v) return <span style={{color:"var(--text-3)",fontStyle:"italic"}}>—</span>;
                        const names = v.split(",").map(p => {
                          const part = p.trim();
                          if (!part) return null;
                          // Resolve phone number → name
                          const byPhone = CONCIERGE_LIST.find(c => c.phone.replace(/\D/g,"") === part.replace(/\D/g,"") && part.replace(/\D/g,"").length > 5);
                          if (byPhone) return byPhone.name;
                          // Drop pure numeric HubSpot owner IDs
                          if (/^\d+$/.test(part)) return null;
                          return part;
                        }).filter(Boolean);
                        if (!names.length) return <span style={{color:"var(--text-3)",fontStyle:"italic"}}>—</span>;
                        return names.join(", ");
                      })()}
                    </td>

                    <td>
                      {k.city ? (
                        <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                          {String(k.city).split(",").map(c => c.trim()).filter(Boolean).map(code => (
                            <span key={code} style={{padding:"2px 7px",borderRadius:3,background:"var(--border-soft)",color:"var(--text-2)",fontSize:10.5,fontWeight:600}}>
                              {CITY_NAMES[code.toUpperCase()] || code}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{color:"var(--text-3)",fontStyle:"italic"}}>—</span>
                      )}
                    </td>

                    <td>
                      <StatusBadge status={k.status} lang={portalLang} />
                      {k.drinkOrder && (
                        <span title={`Drinks received${k.drinkOrderAt ? ": " + new Date(k.drinkOrderAt).toLocaleString("es-CO", { dateStyle:"short", timeStyle:"short" }) : ""}`}
                          style={{marginLeft:4,fontSize:10.5,background:"#F0FDF4",color:"#065F46",border:"1px solid #BBF7D0",borderRadius:3,padding:"1px 5px",cursor:"default"}}>
                          drinks
                        </span>
                      )}
                      {k.groceryOrder && (
                        <span title={`Groceries received${k.groceryOrderAt ? ": " + new Date(k.groceryOrderAt).toLocaleString("es-CO", { dateStyle:"short", timeStyle:"short" }) : ""}`}
                          style={{marginLeft:4,fontSize:10.5,background:"#FFF7ED",color:"#9A3412",border:"1px solid #FED7AA",borderRadius:3,padding:"1px 5px",cursor:"default"}}>
                          grocery
                        </span>
                      )}
  {(() => {
    // cityRatings takes priority; fall back to single conciergeRating
    let ratings = [];
    try { ratings = JSON.parse(k.cityRatings || "[]"); } catch {}
    ratings = ratings.filter(r => r.rating > 0);
    if (ratings.length > 0) {
      const avg = (ratings.reduce((s, r) => s + Math.min(5, Math.max(0, Number(r.rating)||0)), 0) / ratings.length).toFixed(1);
      return (
        <div className="mt-0.5 space-y-0.5">
          {ratings.map((r, i) => (
            <div key={i} className="text-[10px] text-neutral-500 leading-none">
              <span className="font-medium text-neutral-700">{r.city}</span>
              {" "}<span className="text-amber-500">{(() => { const rv = Math.min(5, Math.max(0, Number(r.rating)||0)); return "★".repeat(rv) + "☆".repeat(5-rv); })()}</span>
            </div>
          ))}
          {ratings.length > 1 && (
            <div className="text-[10px] text-amber-600 font-semibold">Prom. {avg} ★</div>
          )}
        </div>
      );
    }
    if (k.conciergeRating > 0) return (
      <div className="mt-0.5 text-[11px] text-amber-500 font-medium leading-none">
        {(() => { const r = Math.min(5, Math.max(0, Number(k.conciergeRating)||0)); return "★".repeat(r) + "☆".repeat(5-r); })()}
      </div>
    );
    return null;
  })()}
</td>

                    {/* Meetings metric */}
                    <td>
                      {(() => {
                        const mtgs = parseMeetings(k.meetingNotes);
                        if (!mtgs.length) {
                          const created = k.createdAt ? new Date(k.createdAt) : null;
                          const daysSince = created ? Math.floor((Date.now() - created) / 86400000) : null;
                          const color = daysSince === null ? "#9a9a9a" : daysSince > 10 ? "#dc2626" : daysSince > 5 ? "#d97706" : "#9a9a9a";
                          return <span style={{fontSize:11,color}}>{daysSince !== null ? `${daysSince}d sin reunión` : "—"}</span>;
                        }
                        const doneMtgs = mtgs.filter(m => m.status === "done" && m.date);
                        const lastDone = doneMtgs.sort((a,b) => b.date.localeCompare(a.date))[0];
                        const nextSched = mtgs.filter(m => m.status === "scheduled" && m.date).sort((a,b) => a.date.localeCompare(b.date))[0];
                        const daysSinceLast = lastDone ? Math.floor((Date.now() - new Date(lastDone.date)) / 86400000) : null;
                        const color = daysSinceLast === null ? "#9a9a9a" : daysSinceLast > 14 ? "#dc2626" : daysSinceLast > 7 ? "#d97706" : "#16a34a";
                        return (
                          <div style={{fontSize:11,lineHeight:1.4}}>
                            <span style={{color:"#1a1814",fontWeight:600}}>{mtgs.length} mtg{mtgs.length!==1?"s":""}</span>
                            {lastDone && <div style={{color}}>{daysSinceLast === 0 ? "hoy" : `hace ${daysSinceLast}d`}</div>}
                            {nextSched && <div style={{color:"#9a7d52"}}>📅 {nextSched.date}</div>}
                          </div>
                        );
                      })()}
                    </td>

                    <td style={{textAlign:"right"}} onClick={e => e.stopPropagation()}>
                      <div style={{display:"inline-flex",alignItems:"center",gap:4}}>
                        <button
                          onClick={() => setSelectedForEdit(k)}
                          className="tt-btn-ghost"
                          style={{padding:"4px 9px",fontSize:11.5}}
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => setRatingModalKickoff(k)}
                          style={{padding:"4px 9px",fontSize:11.5,fontWeight:500,border:"1px solid #FDE68A",borderRadius:"var(--radius-sm)",background:"#FFFBEB",color:"#92400E",cursor:"pointer"}}
                        >
                          Feedback
                        </button>

                        <div style={{position:"relative"}}>
                          <button
                            onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)}
                            className="tt-btn-ghost"
                            style={{padding:"4px 8px",fontSize:13}}
                          >
                            ⋯
                          </button>
                          {openMenuId === k.id && (
                            <div
                              style={{position:"absolute",right:0,top:"100%",marginTop:4,zIndex:50,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",boxShadow:"var(--shadow-pop)",padding:"4px 0",minWidth:160}}
                              onMouseLeave={() => setOpenMenuId(null)}
                            >
                              <button onClick={() => { setOpenMenuId(null); setSelectedForSummary(k); }}
                                style={{width:"100%",textAlign:"left",padding:"8px 14px",fontSize:12,color:"var(--text-1)",background:"none",border:"none",cursor:"pointer"}}>
                                Ver resumen
                              </button>
                              {(() => {
                                const conciergeNames = String(k.assignedConcierge || "").split(",").map(s => s.trim()).filter(Boolean);
                                const concierge = conciergeNames.map(n => CONCIERGE_LIST.find(c => c.name === n)).find(Boolean);
                                if (!concierge) return null;
                                const slug = concierge.email.split("@")[0].toLowerCase();
                                const bookLink = `https://www.twotravelvip.com/book.html?c=${slug}&kickoffId=${k.id}&lang=${k.lang || "en"}`;
                                return (
                                  <button onClick={async () => {
                                    setOpenMenuId(null);
                                    try { await navigator.clipboard.writeText(bookLink); alert("Link de booking copiado — pásaselo al cliente por WhatsApp"); }
                                    catch { prompt("Copia este link y mándalo al cliente:", bookLink); }
                                  }} style={{width:"100%",textAlign:"left",padding:"8px 14px",fontSize:12,color:"#7c3aed",background:"none",border:"none",cursor:"pointer"}}>
                                    📅 Copiar link de reunión
                                  </button>
                                );
                              })()}
                              <button onClick={async () => {
                                setOpenMenuId(null);
                                const link = buildCatalogLink(k, Number(k.clientType ?? 1));
                                try { await navigator.clipboard.writeText(link); alert("Link de catálogo copiado"); }
                                catch { prompt("Copia este link:", link); }
                              }} style={{width:"100%",textAlign:"left",padding:"8px 14px",fontSize:12,color:"var(--text-1)",background:"none",border:"none",cursor:"pointer"}}>
                                Copiar catálogo
                              </button>
                              <button onClick={async () => {
                                setOpenMenuId(null);
                                const link = buildQuestionnaireLink(k, Number(k.clientType ?? 1));
                                try { await navigator.clipboard.writeText(link); alert("Link de cuestionario copiado"); }
                                catch { prompt("Copia este link:", link); }
                              }} style={{width:"100%",textAlign:"left",padding:"8px 14px",fontSize:12,color:"var(--text-1)",background:"none",border:"none",cursor:"pointer"}}>
                                Copiar cuestionario
                              </button>
                              {currentUser?.role !== "junior" && (<>
                              <div style={{height:1,background:"var(--border)",margin:"4px 0"}}/>
                              <button onClick={() => { setOpenMenuId(null); setSelectedForDelete(k); }}
                                style={{width:"100%",textAlign:"left",padding:"8px 14px",fontSize:12,color:"#DC2626",background:"none",border:"none",cursor:"pointer"}}>
                                Eliminar
                              </button>
                              </>)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedForSummary && (
        <SummaryModal
          kickoff={selectedForSummary}
          onClose={() => setSelectedForSummary(null)}
        />
      )}

      {selectedForEdit && (
        currentUser?.role === "junior"
          ? <JuniorDrawer
              key={selectedForEdit.id}
              kickoff={selectedForEdit}
              onClose={() => setSelectedForEdit(null)}
              onSave={handleSilentUpdate}
            />
          : <EditDrawer
              key={selectedForEdit.id}
              kickoff={selectedForEdit}
              onClose={() => setSelectedForEdit(null)}
              onSave={handleSaveEdit}
              onSilentUpdate={handleSilentUpdate}
            />
      )}

      {selectedForDelete && (
        <ConfirmDeleteModal
          kickoff={selectedForDelete}
          onCancel={() => setSelectedForDelete(null)}
          onConfirm={handleConfirmDelete}
          loading={deleting}
        />
      )}
      {clientTypePickerOpen && (
        <ClientTypePickerModal
          onClose={() => { setClientTypePickerOpen(false); setPendingLinkKind(null); }}
          onSelect={async (type) => {
            setClientTypePickerOpen(false);
            setPendingLinkKind(null);
          }}
        />
      )}

      <CreateClientModal
        open={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setPendingLinkKind(null); }}
        onSubmit={handleCreateAndOpenLink}
        kickoffs={kickoffs}
      />

      {newClientKickoff && (
        <NewClientLinksModal
          kickoff={newClientKickoff}
          lang={portalLang}
          onClose={() => setNewClientKickoff(null)}
        />
      )}

      {feedbackPickerOpen && (
        <KickoffPickerModal
          kickoffs={kickoffs}
          title="Seleccionar cliente para link de feedback"
          onClose={() => setFeedbackPickerOpen(false)}
          onSelect={(k) => {
            setFeedbackPickerOpen(false);
            setRatingModalKickoff(k);
          }}
        />
      )}

      {/* ── Concierge rating modal — appears before sharing feedback link ── */}
      {ratingModalKickoff && (
        <ConciergeRatingModal
          kickoff={ratingModalKickoff}
          onClose={() => setRatingModalKickoff(null)}
          onSave={async (rating) => {
            const k = ratingModalKickoff;
            setRatingModalKickoff(null);

            // Save rating to sheet
            try {
              await updateKickoffInSheet(k.id, { conciergeRating: rating });
              setKickoffs(prev =>
                prev.map(item => item.id === k.id ? { ...item, conciergeRating: rating } : item)
              );
            } catch (err) {
              console.warn("Could not save concierge rating:", err);
            }

            // Copy + open the feedback link
            const link = buildFeedbackLink(k, Number(k.clientType ?? 1), portalLang);
            try {
              await navigator.clipboard.writeText(link);
            } catch {
              prompt("Copia este link:", link);
            }
            window.open(link, "_blank", "noopener,noreferrer");
          }}
        />
      )}

    </div>
  );


}
