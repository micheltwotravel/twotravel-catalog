import React, { useEffect, useMemo, useState } from "react";

const TASK_API_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

import {
  fetchKickoffsFromSheet,
  fetchServicesFromSheet,
  updateKickoffInSheet,
  deleteKickoff,
  saveKickoffToSheet,
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
// City code → full name for PDF and QuickBooks
const CITY_NAMES = { CTG:"Cartagena", MDE:"Medellín", CDMX:"Ciudad de México", TUL:"Tulum", BOG:"Bogotá" };
const cityFullName = (code) => CITY_NAMES[String(code||"").trim().toUpperCase()] || String(code||"").trim();

/* ─────────────────────────────────────────────────────────────
   buildItineraryPdf / sendItineraryPdfToSlack
   mode = "slack"   → uploads PDF to Slack via GAS (default)
   mode = "preview" → opens PDF in a new browser tab
───────────────────────────────────────────────────────────── */
async function sendItineraryPdfToSlack(kickoff, lang = "en", currency = "USD", mode = "slack", fxRate = 3489) {
  const { jsPDF } = await import("jspdf");

  // ── helpers ─────────────────────────────────────────────────
  const cl = (v) => String(v ?? "").trim();
  const parseJ = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim().startsWith("[")) {
      try { return JSON.parse(v); } catch { return []; }
    }
    return [];
  };
  const fmtDate = (v) => {
    if (!v) return "—";
    try { return new Date(v).toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric", year:"numeric" }); }
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
      name       : cl(item.displayName || item.name_en || item.name || svc?.name_en || svc?.name || ""),
      location   : lang === "es"
        ? cl(svc?.location_es || svc?.location || "")
        : cl(svc?.location    || ""),
      description: svc
        ? (lang === "es"
            ? (svc.description?.es || svc.description?.en || "")
            : (svc.description?.en || svc.description?.es || ""))
        : "",
      highlights : svc
        ? (lang === "es"
            ? (svc.highlights    || [])
            : (svc.highlights_en?.length ? svc.highlights_en : svc.highlights || []))
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
    doc.text("TWO TRAVEL", ML, 22);
    doc.text(cl(kickoff.guestName), PW / 2, 22, { align:"center" });
    doc.text(`${pageNum}`, MR, 22, { align:"right" });
  };
  const newPage = () => {
    doc.addPage(); pageNum++; y = 52; addMiniHeader();
  };
  const checkY = (need = 30) => { if (y + need > PH - 48) newPage(); };

  // ── COVER ───────────────────────────────────────────────────
  // Header band
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, PW, 76, "F");
  doc.setFontSize(20); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255);
  doc.text("TWO TRAVEL", ML, 36);
  doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(160,160,160);
  doc.text("PRIVATE CONCIERGE", ML, 54);
  doc.text(new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}), MR, 54, { align:"right" });

  y = 112;
  // Eyebrow
  doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(170,170,170);
  doc.text("YOUR ITINERARY", ML, y); y += 18;

  // Guest name
  doc.setFontSize(28); doc.setFont("helvetica","bold"); doc.setTextColor(12,12,12);
  doc.text(cl(kickoff.guestName) || "Guest", ML, y); y += 12;

  // Trip name
  if (kickoff.tripName) {
    doc.setFontSize(13); doc.setFont("helvetica","normal"); doc.setTextColor(90,90,90);
    doc.text(cl(kickoff.tripName), ML, y + 6); y += 22;
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

  // Info rows — each: { label, val, url? }
  const infoRows = [
    { label: lang === "es" ? "Llegada"      : "Arrival",        val: fmtDate(kickoff.arrivalDate) },
    { label: lang === "es" ? "Salida"       : "Departure",      val: fmtDate(kickoff.departureDate) },
    { label: lang === "es" ? "Destino"      : "Destination",    val: cityFullName(kickoff.city) || "" },
    { label: lang === "es" ? "Huéspedes"    : "Guests",         val: cl(kickoff.groupSize || "") },
    { label: lang === "es" ? "Alojamiento"  : "Accommodation",  val: cl(kickoff.accommodationName || ""), url: accomUrl || null },
    { label: lang === "es" ? "Dirección"    : "Address",        val: cl(kickoff.accommodationAddr || "") },
    { label: "Concierge",                                        val: cl(kickoff.assignedConciergeName || kickoff.assignedConcierge || "") },
    { label: "WhatsApp Concierge",                               val: conciergePhone, url: waUrl },
    { label: lang === "es" ? "Tu WhatsApp"  : "Your WhatsApp",  val: cl(kickoff.guestContact || "") },
  ].filter(r => r.val);

  infoRows.forEach(({ label, val, url }) => {
    doc.setFontSize(7.5); doc.setFont("helvetica","normal"); doc.setTextColor(160,160,160);
    doc.text(label.toUpperCase(), ML, y);
    doc.setFontSize(10.5); doc.setFont("helvetica","normal");
    if (url) {
      doc.setTextColor(30, 100, 200);
      doc.textWithLink(val, ML + 100, y, { url });
    } else {
      doc.setTextColor(20, 20, 20);
      doc.text(val, ML + 100, y);
    }
    y += 18;
  });

  // Concierge summary / notes (optional)
  if (kickoff.conciergeSummary) {
    y += 12;
    doc.setDrawColor(230,230,230); doc.line(ML, y, MR, y); y += 16;
    doc.setFontSize(7.5); doc.setFont("helvetica","bold"); doc.setTextColor(160,160,160);
    doc.text(lang === "es" ? "NOTAS DE TU CONCIERGE" : "FROM YOUR CONCIERGE", ML, y); y += 14;
    const summaryLines = doc.splitTextToSize(cl(kickoff.conciergeSummary).slice(0,900), TW);
    summaryLines.slice(0,14).forEach(line => {
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(50,50,50);
      doc.text(line, ML, y); y += 13;
    });
  }

  // Cover footer
  doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(200,200,200);
  doc.text("Two Travel · twotravelvip.com", PW/2, PH - 22, { align:"center" });

  // ── PRE-TRIP CONTENT PAGE ───────────────────────────────────
  const preTripText = cl(kickoff.preTripContent || kickoff.preTrip || kickoff.pre_trip || "");
  if (preTripText) {
    newPage();
    doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(12,12,12);
    doc.text(lang === "es" ? "ANTES DE TU LLEGADA" : "BEFORE YOUR ARRIVAL", ML, y); y += 20;
    doc.setDrawColor(12,12,12); doc.setLineWidth(1.2);
    doc.line(ML, y, ML + 50, y); doc.setLineWidth(0.5); y += 16;

    preTripText.split("\n").forEach(line => {
      const l = cl(line);
      if (!l) { checkY(8); y += 6; return; }
      checkY(14);
      const isUrl = l.startsWith("http");
      const isLabel = l.includes(": http");
      if (isUrl || isLabel) {
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(30,100,200);
      } else if (l.toUpperCase() === l && l.length < 60) {
        // ALL CAPS line = section header
        doc.setFontSize(8); doc.setFont("helvetica","bold"); doc.setTextColor(120,120,120);
        y += 4;
      } else {
        doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
      }
      const wrapped = doc.splitTextToSize(l, TW);
      wrapped.forEach(wl => { checkY(13); doc.text(wl, ML, y); y += 13; });
    });
  }

  // ── DAY PAGES ───────────────────────────────────────────────
  orderedDays.forEach(({ label, title }) => {
    const items = (rawMap.get(label) || []).sort((a,b) => a.sort - b.sort);
    if (!items.length) return;

    newPage();

    // Day header band
    doc.setFillColor(238,238,238);
    doc.rect(ML - 12, y - 14, TW + 24, 26, "F");
    doc.setFontSize(11); doc.setFont("helvetica","bold"); doc.setTextColor(20,20,20);
    doc.text(label, ML, y);
    if (title) {
      doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(120,120,120);
      doc.text(cl(title), MR, y, { align:"right" });
    }
    y += 24;

    items.forEach((item, itemIdx) => {
      // Estimate height needed
      const descLines = item.description
        ? doc.splitTextToSize(item.description.replace(/\n+/g," "), TW - 12).slice(0,3)
        : [];
      const hlCount = Math.min((item.highlights || []).length, 4);
      const need = 18 + (item.location ? 14 : 0) + descLines.length * 12 + hlCount * 12 + 16;
      checkY(need);

      // Time + Name
      const timePart = item.time ? `${item.time}   ` : "";
      doc.setFontSize(10.5); doc.setFont("helvetica","bold"); doc.setTextColor(15,15,15);
      doc.text(timePart + item.name, ML, y); y += 15;

      // Location
      if (item.location) {
        doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(120,120,120);
        doc.text("📍 " + item.location, ML + 2, y); y += 13;
      }

      // Description (max 3 lines)
      descLines.forEach(line => {
        checkY(13);
        doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(65,65,65);
        doc.text(line, ML + 4, y); y += 12;
      });

      // Highlights
      (item.highlights || []).slice(0,4).forEach(hl => {
        checkY(13);
        doc.setFontSize(8.5); doc.setFont("helvetica","normal"); doc.setTextColor(90,90,90);
        doc.text("·  " + cl(hl), ML + 4, y); y += 12;
      });

      y += 10;
      // Divider between services (not after last)
      if (itemIdx < items.length - 1 && y < PH - 60) {
        doc.setDrawColor(235,235,235); doc.setLineWidth(0.4);
        doc.line(ML, y, MR, y); y += 9;
      }
    });
  });

  // Page footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 2; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setFont("helvetica","normal"); doc.setTextColor(200,200,200);
    doc.text("Two Travel · twotravelvip.com", PW/2, PH - 22, { align:"center" });
  }

  // ── MACHINE-READABLE BILLING PAGE (last, hidden from client) ─
  doc.addPage();
  let dy = 40;
  const dln = (n = 16) => { dy += n; };
  doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(210,210,210);
  doc.text("BILLING DATA — DO NOT EDIT", ML, dy); dln();
  doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);

  [
    `[1A][${cleanTag(kickoff.guestName)}]`,
    `[2A][${cleanTag(kickoff.email || kickoff.guestEmail || kickoff.guestContact || "")}]`,
    `[3A][${fmtIso(kickoff.arrivalDate)}]`,
    `[4A][${fmtIso(kickoff.departureDate)}]`,
    `[CIUDAD][${cleanTag(cityFullName(kickoff.city))}]`,
  ].forEach(line => { doc.setFontSize(7.5); doc.text(line, ML, dy); dln(); });
  dln(4);

  cart.forEach(it => {
    const c2   = cl(it.category || "").toLowerCase();
    const isNQ = NO_QB.has(c2);
    const qb2  = isNQ ? "" : cl(it.quickbooksCode || matchSvc(it)?.quickbooksCode || "");
    if (!qb2) return;
    const pax2  = PAX_MULTIPLIES.has(c2) ? Math.max(1, Number(it.pax || 1)) : 1;
    const unit2 = currency === "COP"
      ? Number(it.priceOverride_cop ?? it.price_cop ?? 0)
      : (() => {
          const manual = Number(it.priceUsd ?? 0);
          if (manual > 0) return manual;
          const cop = Number(it.priceOverride_cop ?? it.price_cop ?? 0);
          return cop > 0 ? Math.round(cop / fxRate) : 0;
        })();
    const tot2  = unit2 * pax2;
    const nm2   = cl(it.name_en || it.displayName || it.name || "").replace(/[\[\]]/g,"");
    doc.setFontSize(7.5);
    doc.text(`[${qb2}][${nm2}][${Math.round(tot2)}]`, ML, dy); dln();
  });

  const filename = `Itinerary_${cl(kickoff.guestName||"client").replace(/\s+/g,"-")}_${new Date().toISOString().slice(0,10)}.pdf`;

  // ── preview: open in browser tab ────────────────────────────
  if (mode === "preview") {
    const url = doc.output("bloburl");
    window.open(url, "_blank");
    return;
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
      payload: { pdfBase64, pdfSize, filename, comment: "",
        slackToken: SLACK_BOT_TOKEN, channelId: SLACK_CHANNEL_ID },
    }),
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error || "Error enviando a Slack");
}

/* =========================================
   Lista fija de concierges
   ========================================= */
const CONCIERGE_LIST = [
  { name: "Alia Jadad",           email: "alia@two.travel",     phone: "+57 301 7618012",   city: "CTG"  },
  { name: "Carolina Lopez",       email: "caro@two.travel",     phone: "+57 300 8192062",   city: "CTG"  },
  { name: "Daniela Becerra",      email: "daniela@two.travel",  phone: "+57 304 4445285",   city: "MDE"  },
  { name: "Nataly Cruz",          email: "nataly@two.travel",   phone: "+52 1 55 2337 7241",city: "CDMX" },
  { name: "Giulia Lorini Serrato",email: "giulia@two.travel",   phone: "+52 1 55 4344 1382",city: "CDMX" },
  { name: "Natalia Peniche",       email: "natalia@two.travel",  phone: "",                  city: "CDMX" },
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
Show everyone how amazing it is to travel with Two Travel's concierge service and get discounts on your experiences. Follow us @twotravelconcierge on Instagram and TikTok.

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
  sent_to_travify:    { es: "Enviado a contabilidad",   en: "Sent to accounting" },
  feedback_submitted: { es: "Cliente llenó feedback",   en: "Feedback submitted" },
  done:               { es: "Cerrado",                  en: "Closed" },
};
function statusLabel(status, lang = "es") {
  return STATUS_LABELS[status]?.[lang] ?? status;
}

const STATUS_CLASSES = {
  new: "bg-blue-100 text-blue-700 border-blue-300",
  client_submitted: "bg-indigo-100 text-indigo-800 border-indigo-300",
  concierge_editing: "bg-amber-100 text-amber-800 border-amber-300",
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
  url.searchParams.set("lang", lang); // explicit override — portalLang toggle wins
  url.searchParams.set("guestName", kickoff?.guestName || "");
  url.searchParams.set("tripName", kickoff?.tripName || "");
  if (kickoff?.guestContact) url.searchParams.set("guestContact", kickoff.guestContact);
  return url.toString();
}
// Maps city codes / raw values → feedback form dropdown option labels
const CITY_TO_DESTINATION = {
  CTG:       "Cartagena",
  MDE:       "Medellín",
  CDMX:      "CDMX",
  TUL:       "Tulum",
  BOG:       "Bogotá",
  cartagena: "Cartagena",
  medellin:  "Medellín",
  medellín:  "Medellín",
  tulum:     "Tulum",
  bogota:    "Bogotá",
  bogotá:    "Bogotá",
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
  const rawConcierge = kickoff?.assignedConcierge || "";
  const concierge = CONCIERGE_TO_SHORT[rawConcierge] || rawConcierge.split(" ")[0] || "";
  if (concierge) url.searchParams.set("concierge", concierge);

  // Concierge 2 (for multi-city trips)
  const rawConcierge2 = kickoff?.assignedConcierge2 || "";
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
  confirmed: true,
  confirmation: "",
  dressCode: "",
  passengers: "",
};
}

function mapManualToCartItem() {
  return {
    id: `manual_${Date.now()}`,
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

function buildTravifyTextFromCart(kickoff) {
  const items = kickoff?.cart || [];
  if (!items.length) return "";

  const fmt = (n) => new Intl.NumberFormat("es-CO").format(Number(n || 0));

  return items
    .map((it, i) => {
      const name = (it.displayName || it.name || "Servicio").trim();
      const price = it.priceOverride_cop ?? it.price_cop;
      const when = [it.dayLabel, it.timeLabel].filter(Boolean).join(" · ");
      const notes = it.notes ? `Notas: ${it.notes}` : "";
      const confirmation = it.confirmation ? `Confirm: ${it.confirmation}` : "";

      return [
        `${i + 1}. ${name}`,
        when ? `   ${when}` : "",
        price ? `   Precio ref: ${fmt(price)} COP` : "",
        confirmation ? `   ${confirmation}` : "",
        notes ? `   ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}
/* ═══════════════════════════════════════════════════════════════
   ACTIVITY ROW — inline-editable row inside a day section
═══════════════════════════════════════════════════════════════ */
function ActivityRow({ item, onUpdate, onRemove, availableDays = [], groupSize = 1 }) {
  const [showNotes, setShowNotes] = useState(!!(item.notes || item.confirmation));
  return (
    <div className="px-4 py-2.5 hover:bg-neutral-50 transition-colors">
      <div className="grid grid-cols-12 gap-x-2 items-center">
        {/* Time — free text */}
        <div className="col-span-2">
          <input
            value={item.timeLabel || ""}
            onChange={e => onUpdate(item.id, { timeLabel: e.target.value })}
            placeholder="Hora"
            className="w-full text-xs text-neutral-500 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
          />
        </div>
        {/* Name */}
        <div className="col-span-6">
          <input
            value={item.displayName || item.name || ""}
            onChange={e => onUpdate(item.id, { displayName: e.target.value })}
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
            onChange={e => onUpdate(item.id, {
              priceOverride_cop: e.target.value === "" ? null : Number(e.target.value),
            })}
            placeholder={String(item.price_cop || "Precio COP")}
            className="w-full text-xs text-right text-neutral-500 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
          />
          {(() => {
            const isPerPerson = String(item.priceUnit || "").toLowerCase().includes("person");
            const pax = parseInt(groupSize, 10);
            const unitPrice = Number(item.priceOverride_cop ?? item.price_cop ?? 0);
            if (!isPerPerson || pax < 2 || !unitPrice) return null;
            const total = new Intl.NumberFormat("es-CO").format(unitPrice * pax);
            return (
              <span className="block text-right text-[9px] text-indigo-500 leading-tight mt-0.5">
                × {pax} pers = {total}
              </span>
            );
          })()}
        </div>
        {/* Actions */}
        <div className="col-span-1 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onUpdate(item.id, { confirmed: !(item.confirmed !== false) })}
            title={item.confirmed !== false ? "Marcar como recomendación" : "Marcar como confirmado"}
            className="text-[13px] leading-none opacity-60 hover:opacity-100 transition-opacity"
          >
            {item.confirmed !== false ? "✅" : "📌"}
          </button>
          <button type="button" onClick={() => setShowNotes(v => !v)}
            title="Notas"
            className="text-[11px] text-neutral-300 hover:text-neutral-600 leading-none">
            ✎
          </button>
          <button type="button" onClick={() => onRemove(item.id)}
            title="Quitar"
            className="text-[11px] text-neutral-300 hover:text-red-500 leading-none">
            ✕
          </button>
        </div>
      </div>
      {/* QB billing row + day selector */}
      <div className="flex gap-3 mt-1 items-center flex-wrap">
        {/* Move to another day */}
        {availableDays.length > 1 && (
          <select
            value={item.dayLabel || ""}
            onChange={e => onUpdate(item.id, { dayLabel: e.target.value })}
            className="text-[10px] text-violet-600 border-b border-dashed border-violet-200 focus:border-violet-400 focus:outline-none py-0.5 bg-transparent max-w-[120px]"
            title="Mover a otro día"
          >
            {availableDays.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <input
          value={item.quickbooksCode || ""}
          onChange={e => onUpdate(item.id, { quickbooksCode: e.target.value.toUpperCase() })}
          placeholder="QB code"
          className="w-20 text-[10px] font-mono text-indigo-500 border-b border-dashed border-indigo-200 focus:border-indigo-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 uppercase"
          title="Código QuickBooks (ej: CS010, SE022)"
        />
        <div className="flex items-center gap-0.5">
          <span className="text-[9px] text-neutral-300">$</span>
          <input
            type="number"
            value={item.priceUsd ?? ""}
            onChange={e => onUpdate(item.id, { priceUsd: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="USD"
            className="w-16 text-[10px] text-right text-emerald-600 border-b border-dashed border-emerald-200 focus:border-emerald-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
            title="Precio en USD para QuickBooks"
          />
        </div>
      </div>
      {showNotes && (
        <div className="mt-1.5 flex flex-col gap-1 pl-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Confirm.</span>
            <input
              value={item.confirmation || ""}
              onChange={e => onUpdate(item.id, { confirmation: e.target.value })}
              placeholder="# confirmación / Confirmed by…"
              className="flex-1 text-xs text-neutral-500 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
              autoFocus
            />
          </div>
          {["restaurants","bars","nightlife","beach-clubs"].includes(String(item.category || "").toLowerCase()) && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Dress code</span>
              <input
                value={item.dressCode || ""}
                onChange={e => onUpdate(item.id, { dressCode: e.target.value })}
                placeholder="Formal / Smart casual / No shorts…"
                className="flex-1 text-xs text-neutral-500 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
              />
            </div>
          )}
          {String(item.category || "").toLowerCase().includes("transport") && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Pasajeros</span>
              <input
                value={item.passengers || ""}
                onChange={e => onUpdate(item.id, { passengers: e.target.value })}
                placeholder="Juan, María, Sam…"
                className="flex-1 text-xs text-neutral-500 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-neutral-400 uppercase tracking-wider w-20 shrink-0">Notas</span>
            <input
              value={item.notes || ""}
              onChange={e => onUpdate(item.id, { notes: e.target.value })}
              placeholder="Mesa, alergias, instrucciones…"
              className="flex-1 text-xs text-neutral-500 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DAY SECTION — one per day, collapsible, with editable header
═══════════════════════════════════════════════════════════════ */
function DaySection({ label, meta, items, loadingServices, availableDays,
  onUpdateMeta, onRenameLabel, onRemoveDay,
  onUpdateItem, onRemoveItem, onAddManual, onAddFromCatalog, groupSize = 1 }) {

  const [editingLabel, setEditingLabel] = useState(false);
  const [localLabel,   setLocalLabel]   = useState(label);
  const [collapsed,    setCollapsed]    = useState(false);

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
            <div className="divide-y divide-neutral-100 bg-white">
              {items.map(item => (
                <ActivityRow key={item.id} item={item}
                  availableDays={availableDays}
                  groupSize={groupSize}
                  onUpdate={onUpdateItem} onRemove={onRemoveItem}/>
              ))}
            </div>
          )}
          {/* Add buttons */}
          <div className="flex gap-2 px-4 py-2.5 bg-neutral-50 border-t border-neutral-100">
            <button type="button" onClick={onAddManual}
              className="text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-white transition-colors">
              + Manual
            </button>
            <button type="button" onClick={onAddFromCatalog} disabled={loadingServices}
              className="text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-white disabled:opacity-40 transition-colors">
              {loadingServices ? "Cargando…" : "+ Catálogo"}
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
function ItineraryCanvas({ kickoff, onSave }) {
  // Parse cart/dayMeta whether they arrive as arrays or JSON strings from the Sheet
  const parseArr = (v) => {
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      try { return JSON.parse(v); } catch {}
    }
    return [];
  };
  const [cart,     setCart]     = useState(parseArr(kickoff?.cart));
  const [dayMeta,  setDayMeta]  = useState(parseArr(kickoff?.dayMeta));
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [catalogTargetDay, setCatalogTargetDay] = useState(null);

  // Sync when kickoff changes (e.g. switching between kickoffs)
  useEffect(() => {
    setCart(parseArr(kickoff?.cart));
    setDayMeta(parseArr(kickoff?.dayMeta));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kickoff?.id]);

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
      const items = cart
        .filter(i => (i.dayLabel || "Sin día") === label)
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
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
    const label = `Día ${days.length + 1}`;
    setDayMeta(prev => [...prev, { label, title: "", sortOrder: prev.length }]);
  };

  const removeDay = (label) => {
    if (!window.confirm(`¿Eliminar "${label}" y todas sus actividades?`)) return;
    setCart(prev => prev.filter(i => (i.dayLabel || "Sin día") !== label));
    setDayMeta(prev => prev.filter(dm => dm.label !== label));
  };

  /* ── Item helpers ── */
  const updateItem = (id, patch) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const removeItem = (id) =>
    setCart(prev => prev.filter(i => i.id !== id));

  const addManualToDay = (dayLabel) => {
    const count = cart.filter(i => (i.dayLabel || "Sin día") === dayLabel).length;
    setCart(prev => [...prev, { ...mapManualToCartItem(), dayLabel, sortOrder: count }]);
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
      // Rebuild flat cart with clean sortOrders per day
      const newCart = [];
      days.forEach(({ label, items }) =>
        items.forEach((item, i) =>
          newCart.push({ ...item, dayLabel: label, sortOrder: i })
        )
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

      {/* ── Day sections ── */}
      {days.map(({ label, meta, items }) => (
        <DaySection
          key={label}
          label={label}
          meta={meta}
          items={items}
          loadingServices={loadingServices}
          availableDays={days.map(d => d.label)}
          groupSize={parseInt(kickoff?.groupSize || "1", 10) || 1}
          onUpdateMeta={patch => upsertDayMeta(label, patch)}
          onRenameLabel={newLabel => renameDayLabel(label, newLabel)}
          onRemoveDay={() => removeDay(label)}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onAddManual={() => addManualToDay(label)}
          onAddFromCatalog={() => setCatalogTargetDay(label)}
        />
      ))}

      {/* Catalog picker modal (per-day) */}
      {catalogTargetDay && (
        <CatalogPickerModal
          services={services}
          clientType={kickoff?.clientType || 1}
          city={kickoff?.city || ""}
          onClose={() => setCatalogTargetDay(null)}
          onPick={svc => {
            const count = cart.filter(i => (i.dayLabel || "Sin día") === catalogTargetDay).length;
            setCart(prev => [...prev, {
              ...mapServiceToCartItem(svc, kickoff?.clientType || 1, parseInt(kickoff?.groupSize || "1") || 1),
              dayLabel: catalogTargetDay,
              sortOrder: count,
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
  const [copied, setCopied] = useState(false);
  if (!kickoff) return null;

  const travifyText =
  kickoff.travifyText ||
  buildTravifyTextFromCart(kickoff) ||
  kickoff.conciergeSummary ||
  "";


  const handleCopy = async () => {
    try {
      if (!travifyText) return;
      await navigator.clipboard.writeText(travifyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
      alert("No se pudo copiar al portapapeles.");
    }
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
              <p>⭐ Rating interno: <span className="text-amber-600 font-semibold">{"★".repeat(Number(kickoff.conciergeRating))}{"☆".repeat(5 - Number(kickoff.conciergeRating))}</span></p>
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
  const [rating,        setRating]        = useState(kickoff?.conciergeRating || 0);
  const [hover,         setHover]         = useState(0);
  const [saving,        setSaving]        = useState(false);
  const [msgLang,       setMsgLang]       = useState("en");
  const [copiedStep1,    setCopiedStep1]    = useState(false);
  const [copiedFollowUp, setCopiedFollowUp] = useState(false);
  const [copiedNoReply,  setCopiedNoReply]  = useState(false);

  // Build feedback link (includes form link for follow-up messages)
  const feedbackLink = kickoff
    ? buildFeedbackLink(kickoff, Number(kickoff.clientType ?? 1), msgLang)
    : "";

  // ── SOP message templates ──────────────────────────────────
  const STEP1 = {
    en: `Your trip may be coming to an end, but our commitment to your experience never does.\n\nHow would you rate our overall concierge assistance (1–5 ⭐)?\n\n⭐⭐⭐⭐⭐ — Exceptional\n⭐⭐⭐⭐ — Great\n⭐⭐⭐ — Good\n⭐⭐ — Could be better\n⭐ — Poor\n\n(Simply reply with a number 1–5 or use emojis!)`,
    es: `Puede que tu viaje esté llegando a su fin, pero nuestro compromiso con tu experiencia continúa.\n\n¿Cómo calificarías nuestra asistencia de conserjería en general (1–5 ⭐)?\n\n⭐⭐⭐⭐⭐ — Excepcional\n⭐⭐⭐⭐ — Muy bueno\n⭐⭐⭐ — Bueno\n⭐⭐ — Puede mejorar\n⭐ — Deficiente\n\n(¡Responde con un número del 1 al 5 o con emojis!)`,
  };
  const FOLLOW_POSITIVE = {
    en: `Thank you so much for your feedback! ✨\n\nIf you have a moment, we'd truly appreciate a bit more insight to help us refine the guest experience — we promise it will take less than 2 minutes:\n\n${feedbackLink}`,
    es: `¡Muchísimas gracias por tu feedback! ✨\n\nSi tienes un momento, nos encantaría conocer un poco más para seguir mejorando la experiencia — te prometemos que tomará menos de 2 minutos:\n\n${feedbackLink}`,
  };
  const FOLLOW_LOW = {
    en: `Thank you so much for the feedback, and we truly apologize for not meeting your expectations.\n\nIf you have time, we would really appreciate a bit more detail to help us understand what could have gone better — we promise it'll take under 2 minutes:\n\n${feedbackLink}`,
    es: `Muchas gracias por tus comentarios y realmente te pedimos disculpas por no haber cumplido con tus expectativas.\n\nSi tienes unos minutos, agradeceríamos muchísimo que pudieras compartir un poco más de feedback para ayudarnos a entender qué podría mejorar — te prometemos que tomará menos de 2 minutos:\n\n${feedbackLink}`,
  };
  const FOLLOW_NO_REPLY = {
    en: `We noticed you haven't had a chance to share your thoughts — and we completely understand, life gets busy! ✨\n\nIf you have a moment, we'd love to hear how everything went. It'll take under 2 minutes:\n\n${feedbackLink}`,
    es: `Notamos que aún no has tenido la oportunidad de compartir tus comentarios, y lo entendemos perfectamente — ¡el tiempo vuela! ✨\n\nSi en algún momento tienes un minuto, nos encantaría saber cómo salió todo. Prometemos que no se demora más de 2 minutos:\n\n${feedbackLink}`,
  };

  const isPositive  = rating >= 4;   // 1-3 = bajo, 4-5 = alto
  const step1Msg    = STEP1[msgLang];
  const followUpMsg = isPositive ? FOLLOW_POSITIVE[msgLang] : FOLLOW_LOW[msgLang];

  const copyText = async (text, setCopied) => {
    try { await navigator.clipboard.writeText(text); }
    catch { prompt("Copia:", text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(rating);
    setSaving(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 16,
        width: "100%", maxWidth: 520,
        maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 8px 40px rgba(0,0,0,.2)",
        fontFamily: "system-ui, sans-serif",
      }}>

        {/* ── Header + Stars ── */}
        <div style={{ padding: "24px 24px 0" }}>
          <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: "#aaa", marginBottom: 4 }}>
            Evaluación interna
          </p>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 3 }}>
            ¿Cómo salió este trip?
          </h3>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 16, lineHeight: 1.5 }}>
            {kickoff?.guestName && <strong style={{ color: "#444" }}>{kickoff.guestName}</strong>}
            {kickoff?.tripName  && <span style={{ color: "#bbb" }}> · {kickoff.tripName}</span>}
          </p>

          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8 }}>
            {[1,2,3,4,5].map(star => (
              <button key={star} type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                style={{
                  fontSize: 34, cursor: "pointer",
                  background: "none", border: "none", padding: "2px 3px",
                  color: star <= (hover || rating) ? "#f59e0b" : "#e5e7eb",
                  transition: "color .12s",
                }}>
                ★
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p style={{ textAlign: "center", fontSize: 12, color: "#888", marginBottom: 8 }}>
              {["","😕 Hubo problemas","😐 Por mejorar","🙂 Bien","😊 Muy bien","🌟 Perfecto"][rating]}
            </p>
          )}
        </div>

        {/* ── WhatsApp SOP templates ── */}
        <div style={{ padding: "12px 24px 0" }}>
          {/* Section header + EN/ES toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
              📲 Mensajes WhatsApp — SOP
            </p>
            <div style={{ display: "flex", gap: 4 }}>
              {["en","es"].map(l => (
                <button key={l} type="button" onClick={() => setMsgLang(l)} style={{
                  padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: "1px solid",
                  background: msgLang === l ? "#111" : "#fff",
                  color:      msgLang === l ? "#fff" : "#666",
                  borderColor: msgLang === l ? "#111" : "#ddd",
                }}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Step 1 — always visible */}
          <div style={{
            background: "#f8faff", borderRadius: 12, padding: "10px 12px",
            marginBottom: 10, border: "1px solid #e0e7ff",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#3730a3", margin: 0 }}>
                Paso 1 — Pedir calificación (al terminar el viaje)
              </p>
              <button type="button" onClick={() => copyText(step1Msg, setCopiedStep1)} style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                background: copiedStep1 ? "#16a34a" : "#3730a3",
                color: "#fff", border: "none", fontWeight: 600, whiteSpace: "nowrap",
                transition: "background .15s", flexShrink: 0,
              }}>
                {copiedStep1 ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <pre style={{
              fontSize: 11, color: "#4b5563", whiteSpace: "pre-wrap", margin: 0,
              fontFamily: "system-ui, sans-serif", lineHeight: 1.6,
              maxHeight: 110, overflowY: "auto",
            }}>
              {step1Msg}
            </pre>
          </div>

          {/* Follow-up — only when rating selected */}
          {rating > 0 ? (
            <div style={{
              background: isPositive ? "#f0fdf4" : "#fff7ed",
              borderRadius: 12, padding: "10px 12px", marginBottom: 10,
              border: `1px solid ${isPositive ? "#bbf7d0" : "#fed7aa"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: isPositive ? "#15803d" : "#c2410c", margin: 0 }}>
                  {isPositive
                    ? "Respuesta positiva (4–5 ⭐) — Follow-up"
                    : "Respuesta baja (1–3 ⭐) — Follow-up"}
                </p>
                <button type="button" onClick={() => copyText(followUpMsg, setCopiedFollowUp)} style={{
                  padding: "4px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                  background: copiedFollowUp ? "#16a34a" : "#111",
                  color: "#fff", border: "none", fontWeight: 600, whiteSpace: "nowrap",
                  transition: "background .15s", flexShrink: 0,
                }}>
                  {copiedFollowUp ? "✓ Copiado" : "Copiar"}
                </button>
              </div>
              <pre style={{
                fontSize: 11, color: "#4b5563", whiteSpace: "pre-wrap", margin: 0,
                fontFamily: "system-ui, sans-serif", lineHeight: 1.6,
                maxHeight: 100, overflowY: "auto",
              }}>
                {followUpMsg}
              </pre>
              <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 5, marginBottom: 0 }}>
                💡 El link del formulario de feedback ya está incluido en el mensaje
              </p>
            </div>
          ) : (
            <div style={{
              background: "#f9fafb", borderRadius: 12, padding: "10px 12px",
              marginBottom: 10, border: "1px dashed #e5e7eb", textAlign: "center",
            }}>
              <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
                Selecciona las estrellas para ver el mensaje de follow-up
              </p>
            </div>
          )}

          {/* Third message — no reply / suspected dissatisfaction — always visible */}
          <div style={{
            background: "#f8f8f8", borderRadius: 12, padding: "10px 12px",
            marginBottom: 10, border: "1px solid #e5e7eb",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: 0 }}>
                🔕 Sin respuesta — Follow-up
              </p>
              <button type="button" onClick={() => copyText(FOLLOW_NO_REPLY[msgLang], setCopiedNoReply)} style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 11, cursor: "pointer",
                background: copiedNoReply ? "#16a34a" : "#6b7280",
                color: "#fff", border: "none", fontWeight: 600, whiteSpace: "nowrap",
                transition: "background .15s", flexShrink: 0,
              }}>
                {copiedNoReply ? "✓ Copiado" : "Copiar"}
              </button>
            </div>
            <pre style={{
              fontSize: 11, color: "#4b5563", whiteSpace: "pre-wrap", margin: 0,
              fontFamily: "system-ui, sans-serif", lineHeight: 1.6,
              maxHeight: 100, overflowY: "auto",
            }}>
              {FOLLOW_NO_REPLY[msgLang]}
            </pre>
            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 5, marginBottom: 0 }}>
              💡 Usar si el cliente no respondió el Paso 1 (posible insatisfacción)
            </p>
          </div>
        </div>

        {/* ── Footer buttons ── */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 24px 20px" }}>
          <button type="button" onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 99, border: "1px solid #e0e0e0",
            fontSize: 13, cursor: "pointer", background: "#fff", color: "#666",
          }}>
            Cancelar
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={{
            padding: "8px 20px", borderRadius: 99, border: "none",
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            background: rating > 0 ? "#111" : "#d1d5db",
            color:      rating > 0 ? "#fff" : "#9ca3af",
            transition: "background .15s",
          }}>
            {saving ? "Guardando…" : "Guardar y abrir link feedback"}
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
      travifyText: "",
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

function CatalogPickerModal({ services, clientType = 1, city = "", onClose, onPick }) {
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
    const v = String(raw || "").trim().toLowerCase();
    if (!v) return "";
    for (const [code, aliases] of Object.entries(CITY_ALIASES)) {
      if (aliases.includes(v) || v === code.toLowerCase()) return code;
    }
    return v.toUpperCase();
  };
  const kickoffCityCode = toCityCode(city); // e.g. "CTG", "CDMX"

  // Base list: filter by city using canonical codes
  const cityServices = useMemo(() => {
    if (!kickoffCityCode) return services || [];
    return (services || []).filter((s) => {
      const sCity = String(s.city || "").trim();
      // Untagged services → only show for CTG (legacy catalog)
      if (!sCity) return kickoffCityCode === "CTG";
      return toCityCode(sCity) === kickoffCityCode;
    });
  }, [services, kickoffCityCode]);

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
    return cityServices
      .filter((s) => {
        const cat = String(s.category || "").trim();
        if (category !== "all" && cat !== category) return false;

        if (!query) return true;
        const haystack = [
          s.name,
          s.sku,
          s.category,
          s.subcategory,
          s.priceUnit,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 200); // evita listas gigantes
  }, [cityServices, q, category]);

  return (
    <Modal
      title={kickoffCityCode ? `Agregar desde Catálogo · ${kickoffCityCode}` : "Agregar desde Catálogo"}
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
            { id: "bars",           label: "🍸 Bares" },
            { id: "nightlife",      label: "🌙 Nightlife" },
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
                          <div className="text-xs font-semibold text-neutral-900 truncate">{s.name}</div>
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
          Mostrando {filtered.length} de {(services || []).length} servicios
        </div>

        {filtered.length === 0 ? (
          <div className="text-xs text-neutral-500 border rounded-xl p-3 bg-neutral-50">
            No hay resultados con ese filtro.
          </div>
        ) : (
          <div className="border rounded-2xl overflow-hidden bg-white">
            <div className="max-h-[55vh] overflow-auto divide-y">
              {filtered.map((s) => {
                const name = String(s.name || "Servicio").trim();
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

function EditDrawer({ kickoff, onClose, onSave, onSilentUpdate }) {
  const [guestName, setGuestName] = useState(kickoff?.guestName || "");
  const [tripName, setTripName] = useState(kickoff?.tripName || "");
  const [guestContact, setGuestContact] = useState(kickoff?.guestContact || "");
  // Multi-concierge: stored as comma-separated names; edit as array of names
  const parseMultiConcierge = (raw) => {
    if (!raw) return [];
    return String(raw).split(",").map(s => s.trim()).filter(Boolean);
  };
  const [assignedConcierges, setAssignedConcierges] = useState(
    parseMultiConcierge(kickoff?.assignedConcierge || kickoff?.assignedConciergeName || "")
  );
  // Derived single values for backward compat
  const assignedConcierge      = assignedConcierges[0] || "";
  const assignedConciergeEmail = assignedConcierges
    .map(n => CONCIERGE_LIST.find(c => c.name === n)?.email || "")
    .filter(Boolean).join(",");
  const [status, setStatus] = useState(kickoff?.status || "new");
  const [conciergeSummary] = useState(kickoff?.conciergeSummary || "");
  const [internalNotes, setInternalNotes] = useState(kickoff?.internalNotes || "");
  const drinkOrder = kickoff?.drinkOrder || "";
  const [billingCurrency, setBillingCurrency] = useState("USD");
  const [billingSending, setBillingSending] = useState(false);
  const [liveFxRate, setLiveFxRate] = useState(3489); // 3560 TRM - 2%
  useEffect(() => {
    fetch("https://api.frankfurter.app/latest?from=USD&to=COP")
      .then(r => r.json())
      .then(d => { const r = d?.rates?.COP; if (r > 500) setLiveFxRate(Math.round(r * 0.98)); })
      .catch(() => {});
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

  // Auto-format tripDates from arrivalDate/departureDate if not already set
  const autoTripDates = (() => {
    if (kickoff?.tripDates) return kickoff.tripDates;
    const a = kickoff?.arrivalDate, d = kickoff?.departureDate;
    if (!a || !d) return "";
    try {
      const fmt = (s) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const yr  = new Date(d).getFullYear();
      return `${fmt(a)} – ${fmt(d)}, ${yr}`;
    } catch { return ""; }
  })();

  // Auto-fill groupSize from quiz if concierge hasn't set it yet
  const autoGroupSize = kickoff?.groupSize || String(quizAnswers?.groupSize || quizAnswers?.pax || "");

  const [tripDates,          setTripDates]          = useState(autoTripDates);
  const [city,               setCity]               = useState(kickoff?.city               || "");
  // Multiple arrivals: [{name, date, time, flight, notes}]
  const [arrivals, setArrivals] = useState(() => {
    try { return JSON.parse(kickoff?.arrivals || "[]"); } catch { return []; }
  });
  const addArrival  = () => setArrivals(a => [...a, { name:"", date:"", time:"", flight:"" }]);
  const removeArrival = (i) => setArrivals(a => a.filter((_,idx) => idx !== i));
  const patchArrival = (i, patch) => setArrivals(a => a.map((row,idx) => idx === i ? {...row,...patch} : row));
  const [guestEmailState,    setGuestEmailState]    = useState(kickoff?.email || kickoff?.guestEmail || "");
  const [groupSize,          setGroupSize]          = useState(autoGroupSize);
  const [conciergeTitle,     setConciergeTitle]     = useState(kickoff?.conciergeTitle     || "");
  const [accommodationName,  setAccommodationName]  = useState(kickoff?.accommodationName  || "");
  const [accommodationAddr,  setAccommodationAddr]  = useState(kickoff?.accommodationAddr  || "");
  const [accommodationUrl,   setAccommodationUrl]   = useState(kickoff?.accommodationUrl   || "");
  const [checkIn,            setCheckIn]            = useState(kickoff?.checkIn            || "3:00 PM");
  const [checkOut,           setCheckOut]           = useState(kickoff?.checkOut           || "11:00 AM");
  const [welcomePdfUrl,      setWelcomePdfUrl]      = useState(kickoff?.welcomePdfUrl      || "https://drive.google.com/file/d/1-FMeJcmJUVz-9ULTXt6-7eIi_lGa0Y2X/view?usp=drivesdk");
  const [preTripContent,     setPreTripContent]     = useState(kickoff?.preTripContent     || DEFAULT_PRE_TRIP);

  // ── Per-city ratings (concierge logs after each city leg) ────────
  const [cityRatings, setCityRatings] = useState(() => {
    try { return JSON.parse(kickoff?.cityRatings || "[]"); } catch { return []; }
  });
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
    conciergeSummary,
    internalNotes,
    assignedConcierge:      assignedConcierges.join(", "),
    assignedConciergeName:  assignedConcierges.join(", "),
    assignedConciergeEmail: assignedConciergeEmail,
    // Cover fields
    tripDates:         tripDates.trim(),
    city:              city.trim(),
    groupSize:         groupSize.trim(),
    conciergeTitle:    conciergeTitle.trim(),
    accommodationName: accommodationName.trim(),
    accommodationAddr: accommodationAddr.trim(),
    accommodationUrl:  accommodationUrl.trim(),
    checkIn:           checkIn.trim(),
    checkOut:          checkOut.trim(),
    welcomePdfUrl:     welcomePdfUrl.trim(),
    // Timestamps — only set first time each status is reached
    ...(autoStatus === "concierge_editing" && !kickoff.conciergeEditingAt ? { conciergeEditingAt: now } : {}),
    ...(autoStatus === "sent_to_travify"   && !kickoff.sentToTravifyAt    ? { sentToTravifyAt: now }    : {}),
    ...(autoStatus === "done"              && !kickoff.doneAt              ? { doneAt: now }              : {}),
    // Pre-trip info block (rendered as a page before itinerary days in PDF)
    preTripContent:    preTripContent.trim(),
    // Multiple arrivals
    arrivals: JSON.stringify(arrivals.filter(a => a.name || a.date || a.flight)),
    // Per-city ratings
    cityRatings: JSON.stringify(cityRatings.filter(r => r.city || r.rating > 0)),
    // Stay dates (set by concierge)
    arrivalDate:   arrivalDate.trim(),
    departureDate: departureDate.trim(),
  };

  const c = guestContact.trim();
  if (c) updates.guestContact = c;
  const em = guestEmailState.trim();
  if (em) { updates.email = em; updates.guestEmail = em; }

  await onSave(kickoff.id, updates);
  setStatus(autoStatus);
};


  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-xl h-full bg-white shadow-xl flex flex-col">
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

            {/* ── FECHAS DE ESTADÍA (editables por el concierge) ── */}
            <div className="col-span-2 border border-neutral-200 rounded-xl px-3 py-3 space-y-2 bg-white">
              <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">📅 Fechas de estadía</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Llegada</label>
                  <input
                    type="date"
                    value={arrivalDate}
                    onChange={e => setArrivalDate(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-500 mb-1">Salida</label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={e => setDepartureDate(e.target.value)}
                    className="w-full border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
                  />
                </div>
              </div>
              {clientNights && (
                <p className="text-[10px] text-neutral-500">🌙 {clientNights} noche{clientNights !== 1 ? "s" : ""}</p>
              )}
            </div>

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
              <div className="border rounded-lg divide-y bg-white max-h-40 overflow-y-auto">
                {CONCIERGE_LIST.map(c => {
                  const checked = assignedConcierges.includes(c.name);
                  return (
                    <label key={c.email} className="flex items-center gap-2 px-3 py-2 hover:bg-neutral-50 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setAssignedConcierges(prev =>
                            checked ? prev.filter(n => n !== c.name) : [...prev, c.name]
                          );
                        }}
                        className="rounded"
                      />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-[10px] text-neutral-400">{c.city}</span>
                    </label>
                  );
                })}
              </div>
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
                <option value="sent_to_travify">{STATUS_LABELS.sent_to_travify.es}</option>
                <option value="feedback_submitted">{STATUS_LABELS.feedback_submitted.es}</option>
                <option value="done">{STATUS_LABELS.done.es}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-neutral-500">Notas internas</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
              placeholder="Notas internas"
            />
          </div>

          {/* ── Feedback del cliente (respuestas del formulario) ── */}
          {(kickoff.status === "feedback_submitted" || kickoff.feedbackAt) && (
            <div className="border border-teal-300 rounded-xl bg-teal-50 p-3">
              <p className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide mb-2">
                💬 Respuestas del formulario de feedback
              </p>
              <FeedbackResponseCard kickoffId={kickoff.id} />
            </div>
          )}

          {/* ── Drink Order (read-only, submitted by client) ── */}
          {drinkOrder && (
            <div className="border border-teal-200 rounded-xl bg-teal-50 p-3">
              <p className="text-[11px] font-semibold text-teal-700 mb-1.5">🍹 Orden de bebidas (enviada por el cliente)</p>
              <pre className="text-xs text-teal-900 whitespace-pre-wrap font-sans leading-relaxed">{drinkOrder}</pre>
              {kickoff?.drinkOrderAt && (
                <p className="text-[10px] text-teal-500 mt-1.5">
                  Recibido: {new Date(kickoff.drinkOrderAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
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
          <div className="border rounded-2xl p-4 bg-neutral-50 space-y-3">
            <p className="text-xs font-semibold text-neutral-700">Portada del itinerario (PDF)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-500">Fechas del viaje</label>
                <input value={tripDates} onChange={(e) => setTripDates(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="May 22-28, 2026" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Ciudad / Destino</label>
                <input value={city} onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Medellín" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Personas en el grupo</label>
                <input value={groupSize} onChange={(e) => setGroupSize(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="5 people" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Nombre del alojamiento</label>
                <input value={accommodationName} onChange={(e) => setAccommodationName(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Edificio Los Eucaliptos" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Dirección del alojamiento</label>
                <input value={accommodationAddr} onChange={(e) => setAccommodationAddr(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Calle 10 # 29-34, Medellín, Antioquia" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Link del alojamiento (Airbnb, Booking, etc.)</label>
                <input value={accommodationUrl} onChange={(e) => setAccommodationUrl(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="https://www.airbnb.com/rooms/12345" />
              </div>
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
          </div>

          {/* ── Calificaciones por ciudad ── */}
          <div className="border rounded-2xl p-4 bg-amber-50 border-amber-200 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-amber-800">⭐ Calificaciones por ciudad</p>
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
                    {["Cartagena","Medellín","CDMX","Tulum","Bogotá"].map(d => (
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
          </div>

          {/* ── LLEGADAS MÚLTIPLES ─────────────────────────────── */}
          <div className="border rounded-2xl p-4 bg-neutral-50 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-neutral-700">✈️ Llegadas del grupo</p>
              <button type="button" onClick={addArrival}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700">
                + Agregar llegada
              </button>
            </div>
            {arrivals.length === 0 && (
              <p className="text-[11px] text-neutral-400">Sin llegadas registradas. Úsalo cuando el grupo llega en vuelos distintos.</p>
            )}
            {arrivals.map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-neutral-200 rounded-xl px-3 py-2">
                <div className="col-span-4">
                  <input value={a.name} onChange={e => patchArrival(i,{name:e.target.value})}
                    placeholder="Quién (ej: Juan + María)"
                    className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300" />
                </div>
                <div className="col-span-2">
                  <input type="date" value={a.date} onChange={e => patchArrival(i,{date:e.target.value})}
                    className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent" />
                </div>
                <div className="col-span-2">
                  <input type="time" value={a.time} onChange={e => patchArrival(i,{time:e.target.value})}
                    className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent" />
                </div>
                <div className="col-span-3">
                  <input value={a.flight} onChange={e => patchArrival(i,{flight:e.target.value})}
                    placeholder="Vuelo / detalles"
                    className="w-full text-xs border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeArrival(i)}
                    className="text-neutral-300 hover:text-red-500 text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* PRE-TRIP INFO — page that appears before itinerary days in PDF */}
          <div className="border rounded-2xl p-4 bg-neutral-50 space-y-2">
            <p className="text-xs font-semibold text-neutral-700">Pre-Trip Information</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              This block appears as a full page <em>before</em> the itinerary days in the PDF.
              Include links (forms, WhatsApp, PDFs), notes, recommendations, promo info, etc.
              One item per line. Lines starting with http/https render as clickable links.
            </p>
            <textarea
              value={preTripContent}
              onChange={(e) => setPreTripContent(e.target.value)}
              rows={8}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[140px] font-mono bg-white"
              placeholder={`Pre Check-in Form: https://form.link/checkin\nDrink Calculator: https://two.travel/drinks\nCartagena City Guide: https://two.travel/guide.pdf\nWhatsApp Concierge: https://wa.me/573001234567\n\nPromo: Share @twotravelconcierge and get a discount on select experiences.\n\nCoffee recommendations: Amor Perfecto, Pergamino\nRooftop recommendations: Aloft, Alma`}
            />
          </div>

          {/* ITINERARIO — canvas con edición inline por día */}
<div className="border rounded-2xl p-4 bg-white">
  <div className="flex items-center justify-between mb-1">
    <div className="text-sm font-semibold text-neutral-900">Itinerario</div>
    {kickoff?.cart?.length > 0 && (
      <a
        href={`/?mode=itinerary&kickoffId=${kickoff.id}&lang=${kickoff.lang || "en"}`}
        target="_blank" rel="noreferrer"
        className="text-[11px] text-blue-600 hover:underline">
        📄 Ver PDF →
      </a>
    )}
  </div>
  <div className="text-[11px] text-neutral-400 mb-3">
    Agrupa actividades por día. Edita nombre, hora y precio directamente en cada fila.
  </div>
  <ItineraryCanvas
    kickoff={kickoff}
    onSave={async (newCart, newDayMeta) => {
      await onSave(kickoff.id, {
        cart: newCart,
        dayMeta: newDayMeta,
        status: "concierge_editing",
      });
    }}
  />
</div>
        </div>


        <div className="px-5 py-4 border-t bg-neutral-50 flex justify-end gap-2">
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
          {/* Drinks catalog link */}
          <a
            href={(() => {
              const u = new URL("/?mode=drinks", window.location.origin);
              u.searchParams.set("kickoffId", kickoff.id);
              if (kickoff.guestName)    u.searchParams.set("guestName",    kickoff.guestName);
              if (kickoff.arrivalDate)  u.searchParams.set("arrivalDate",  kickoff.arrivalDate);
              if (kickoff.departureDate) u.searchParams.set("departureDate", kickoff.departureDate);
              if (kickoff.guestContact) u.searchParams.set("guestContact", kickoff.guestContact);
              return u.toString();
            })()}
            target="_blank" rel="noreferrer"
            className="px-3 py-2 rounded-lg border border-teal-300 text-sm text-teal-700 bg-teal-50 hover:bg-teal-100 flex items-center gap-1.5"
            title="Abrir catálogo de bebidas del cliente"
          >
            🍹 Bebidas
          </a>
          {/* Billing — send to Slack */}
          {kickoff?.cart?.length > 0 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setBillingCurrency(c => c === "USD" ? "COP" : "USD")}
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
                    await sendItineraryPdfToSlack({
                      ...kickoff,
                      email: guestEmailState || kickoff.email || kickoff.guestEmail || "",
                      city: city || kickoff.city || "",
                    }, kickoff.lang || "en", billingCurrency, "preview", liveFxRate);
                  } catch (e) {
                    alert("❌ " + e.message);
                  } finally {
                    setBillingSending(false);
                  }
                }}
                className="px-3 py-2 border-t border-b border-indigo-300 text-sm text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50"
                title="Ver PDF antes de mandar"
              >
                {billingSending ? "…" : "👁"}
              </button>
              <button
                type="button"
                disabled={billingSending}
                onClick={async () => {
                  setBillingSending(true);
                  try {
                    // Merge live EditDrawer state so email/city are always current
                    await sendItineraryPdfToSlack({
                      ...kickoff,
                      email: guestEmailState || kickoff.email || kickoff.guestEmail || "",
                      city: city || kickoff.city || "",
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
            <div className="bg-white rounded-xl px-3 py-3 text-[11px] text-neutral-700 whitespace-pre-wrap leading-relaxed mb-3">
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
                { code: "CDMX", label: "Cdmx" },
                { code: "TUL",  label: "Tulum" },
                { code: "BOG",  label: "Bogotá" },
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

/* =========================================
   Componente principal
   ========================================= */

export default function ConciergePanel() {
  
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
      travifyText: "",
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
      await Promise.all([...selectedIds].map(id => updateKickoffInSheet(id, { status: "cerrado" })));
      setKickoffs(prev => prev.map(k => selectedIds.has(k.id) ? { ...k, status: "cerrado" } : k));
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
        if (conciergeFilter !== "all" && String(k.assignedConcierge || "").trim() !== conciergeFilter) return false;

        if (!q) return true;
        const text = [
          k.id,
          k.guestName,
          k.tripName,
          k.assignedConcierge,
          k.conciergeSummary,
          k.travifyText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      })
      .sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return db - da;
      });
  }, [kickoffs, search, statusFilter, conciergeFilter]);

  // Updates kickoff locally + in sheet but does NOT close the drawer
  const handleSilentUpdate = async (id, updates) => {
    try {
      await updateKickoffInSheet(id, updates);
      setKickoffs((prev) =>
        prev.map((k) => {
          if (k.id !== id) return k;
          const next = { ...k, ...updates };
          if ("guestContact" in updates && String(updates.guestContact || "").trim() === "") {
            next.guestContact = k.guestContact || "";
          }
          return next;
        })
      );
    } catch (err) {
      console.error("Silent update failed:", err);
    }
  };

  const handleSaveEdit = async (id, updates) => {
  try {
    setRowLoadingId(id);
    await updateKickoffInSheet(id, updates);

    setKickoffs((prev) =>
      prev.map((k) => {
        if (k.id !== id) return k;

        const next = { ...k, ...updates };
        if ("guestContact" in updates && String(updates.guestContact || "").trim() === "") {
          next.guestContact = k.guestContact || "";
        }
        return next;
      })
    );

    setSelectedForEdit(null);
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
      colConcierge: "Concierge", colCity: "Ciudad", colStatus: "Estado", colActions: "Acciones",
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
      colConcierge: "Concierge", colCity: "City", colStatus: "Status", colActions: "Actions",
      loading: "Loading kick-offs...",
      empty: "No kick-offs match the current filter.",
      linkCatalog: "Catalog link", linkFeedback: "Feedback link",
    },
  }[portalLang];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="font-semibold text-lg">Concierge Panel</h1>
          <p className="text-[11px] text-neutral-500">{cp.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">

  {/* Language toggle — controls language of catalog/questionnaire links */}
  <button
    type="button"
    onClick={() => setPortalLang(l => l === "en" ? "es" : "en")}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 font-medium"
    title="Idioma del catálogo que verá el cliente (no cambia este portal)"
  >
    {portalLang === "en" ? "🇺🇸 Links EN · UI EN" : "🇨🇴 Links ES · UI ES"}
  </button>

  <a
    href="?mode=dashboard"
    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
  >
    Dashboard
  </a>

  <a
    href="?mode=tasks"
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 font-medium"
  >
    📋 Tareas
  </a>

  <button
    onClick={loadKickoffs}
    disabled={loading}
    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-50"
  >
    <RefreshCcw className="w-4 h-4" />
    {loading ? cp.refreshing : cp.refresh}
  </button>

  {/* ── BOTÓN NUEVO CLIENTE ── */}
  <button
    type="button"
    onClick={() => { setPendingLinkKind("both"); setCreateModalOpen(true); }}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 font-semibold"
  >
    + Nuevo cliente
  </button>

{/* ── BOTÓN EQUIPO DE VENTAS ── */}
<a
  href="https://www.twotravelvip.com/agent.html"
  target="_blank"
  rel="noreferrer"
  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium"
  title="Abrir herramienta del equipo de ventas"
>
  👥 Ventas
</a>

<a
  href="/?mode=soporte-dashboard"
  target="_blank"
  rel="noreferrer"
  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700"
>
  🛠 Soporte
</a>

</div>


      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              className="w-full pl-7 pr-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              placeholder={cp.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">{cp.filterStatus}</span>
              <select
                className="border rounded-lg px-2.5 py-1.5 bg-white text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{cp.all}</option>
                <option value="new">{statusLabel("new", portalLang)}</option>
                <option value="client_submitted">{statusLabel("client_submitted", portalLang)}</option>
                <option value="concierge_editing">{statusLabel("concierge_editing", portalLang)}</option>
                <option value="sent_to_travify">{statusLabel("sent_to_travify", portalLang)}</option>
                <option value="feedback_submitted">{statusLabel("feedback_submitted", portalLang)}</option>
                <option value="done">{statusLabel("done", portalLang)}</option>
              </select>
            </div>

            {conciergeOptions.length > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {conciergeOptions.map((c) => {
                  const found = CONCIERGE_LIST.find(x => x.name === c);
                  const label = c === "all"
                    ? "Todos"
                    : (found?.name.split(" ")[0] || c);
                  const city  = found?.city || "";
                  const active = conciergeFilter === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setConciergeFilter(c)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition border ${
                        active
                          ? "bg-neutral-900 text-white border-neutral-900"
                          : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100"
                      }`}
                    >
                      {label}{city && !active ? <span className="ml-1 opacity-50 text-[10px]">{city}</span> : null}
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
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium py-1"
          >
            ⭐ {showRatings ? "Ocultar resumen de ratings" : "Ver resumen de ratings"}
          </button>

          {showRatings && (() => {
            const rated = kickoffs.filter(k => Number(k.conciergeRating) > 0);
            const total = rated.length;
            const avg   = total ? (rated.reduce((s, k) => s + Number(k.conciergeRating), 0) / total).toFixed(1) : "—";

            // Group by concierge
            const byC = {};
            rated.forEach(k => {
              const name = k.assignedConcierge || k.assignedConciergeName || "Sin asignar";
              if (!byC[name]) byC[name] = [];
              byC[name].push(Number(k.conciergeRating));
            });
            const conciergeRows = Object.entries(byC)
              .map(([name, ratings]) => ({
                name,
                count: ratings.length,
                avg: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
                dist: [1,2,3,4,5].map(n => ratings.filter(r => r === n).length),
              }))
              .sort((a, b) => b.avg - a.avg);

            return (
              <div className="mt-2 bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
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
                      const cnt = rated.filter(k => Number(k.conciergeRating) === n).length;
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
          <div className="mb-3 flex items-center gap-3 bg-neutral-900 text-white rounded-xl px-4 py-2.5">
            <span className="text-sm font-medium flex-1">{selectedIds.size} cliente{selectedIds.size !== 1 ? "s" : ""} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
            <button onClick={bulkArchive} disabled={bulkLoading}
              className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition disabled:opacity-40 font-medium">
              {bulkLoading ? "…" : "✓ Marcar cerrados"}
            </button>
            <button onClick={bulkDelete} disabled={bulkLoading}
              className="px-3 py-1 text-xs bg-red-500 hover:bg-red-400 rounded-lg transition disabled:opacity-40 font-medium">
              {bulkLoading ? "…" : "🗑 Eliminar"}
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-white/50 hover:text-white transition ml-1">
              Cancelar
            </button>
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-3 py-2 w-8">
                    <input type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === filteredKickoffs.length}
                      ref={el => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredKickoffs.length; }}
                      onChange={() => toggleSelectAll(filteredKickoffs)}
                      className="w-3.5 h-3.5 cursor-pointer accent-neutral-900"
                    />
                  </th>
                  {["ID", cp.colGuest, cp.colTrip, cp.colType, cp.colContact, cp.colCreated, cp.colConcierge, cp.colCity, cp.colStatus].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{cp.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      {cp.loading}
                    </td>
                  </tr>
                )}

                {!loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      {cp.empty}
                    </td>
                  </tr>
                )}

                {filteredKickoffs.map((k) => (
                  <tr
  key={k.id}
  onClick={() => setSelectedKickoffForLink(k)}
  className={
    "border-t border-neutral-100 hover:bg-neutral-50/70 cursor-pointer " +
    (selectedIds.has(k.id) ? "bg-neutral-100/60 " : "") +
    (selectedKickoffForLink?.id === k.id ? "bg-neutral-100" : "")
  }
>
                    <td className="px-3 py-2 w-8" onClick={e => e.stopPropagation()}>
                      <input type="checkbox"
                        checked={selectedIds.has(k.id)}
                        onChange={() => toggleSelect(k.id)}
                        className="w-3.5 h-3.5 cursor-pointer accent-neutral-900"
                      />
                    </td>

                    <td className="px-4 py-2 text-xs text-neutral-700 font-mono">
  {k.id}
</td>

<td className="px-4 py-2 text-sm text-neutral-700">
  {k.guestName || "Sin nombre"}
</td>
<td className="px-4 py-2 text-sm text-neutral-700">
  {k.tripName || "Sin título"}
</td>

<td className="px-4 py-2">
  <select
  value={String(k.clientType).includes("2") ? 2 : 1}
  onClick={(e) => e.stopPropagation()}
  onChange={async (e) => {
  const newType = Number(e.target.value);

  const updatedCart = (k.cart || []).map((item) => {
  const base = Number(item.base_price_cop || item.price_cop || 0);
  const t1 = Number(item.price_tier_1 || 0);
  const t2 = Number(item.price_tier_2 || 0);

  // 👇 si NO tiene tiers → NO tocar precio
  if (!t1 && !t2) {
    return item;
  }

  return {
    ...item,
    price_cop: newType === 2 ? (t2 || base) : (t1 || base),
  };
});

  await updateKickoffInSheet(k.id, {
    clientType: newType,
    cart: updatedCart,
  });

  setKickoffs((prev) =>
    prev.map((item) =>
      item.id === k.id
        ? { ...item, clientType: newType, cart: updatedCart }
        : item
    )
  );
}}
  className="border rounded-lg px-2 py-1 text-xs bg-white"
>
  <option value={1}>Tipo 1</option>
  <option value={2}>Tipo 2</option>
</select>
</td>
<td className="px-4 py-2 text-xs text-neutral-700">
  {k.guestContact || <span className="italic text-neutral-400">—</span>}
</td>

<td className="px-4 py-2 text-xs text-neutral-700">
  {formatDateTime(k.createdAt)}
</td>

<td className="px-4 py-2 text-xs text-neutral-700">
  {k.assignedConcierge || <span className="text-neutral-400 italic">—</span>}
</td>

<td className="px-4 py-2 text-xs font-medium text-neutral-700">
  {k.city ? (
    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px] font-semibold">{k.city}</span>
  ) : (
    <span className="text-neutral-400 italic">—</span>
  )}
</td>

<td className="px-4 py-2">
  <StatusBadge status={k.status} lang={portalLang} />
  {k.conciergeRating > 0 && (
    <div className="mt-0.5 text-[11px] text-amber-500 font-medium leading-none">
      {"★".repeat(Number(k.conciergeRating))}{"☆".repeat(5 - Number(k.conciergeRating))}
    </div>
  )}
</td>

<td className="px-4 py-2 text-right">
  <div className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>

    {/* Primary: Editar */}
    <button
      onClick={() => setSelectedForEdit(k)}
      className="px-2.5 py-1 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition"
    >
      Editar
    </button>

    {/* Primary: Feedback */}
    <button
      onClick={() => setRatingModalKickoff(k)}
      className="px-2.5 py-1 border border-amber-200 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition"
    >
      ★ Feedback
    </button>

    {/* ⋯ More actions dropdown */}
    <div className="relative">
      <button
        onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)}
        className="px-2 py-1 border border-neutral-200 rounded-lg text-xs text-neutral-500 hover:bg-neutral-50 transition"
      >
        ⋯
      </button>
      {openMenuId === k.id && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[170px]"
          onMouseLeave={() => setOpenMenuId(null)}
        >
          <button
            onClick={() => { setOpenMenuId(null); setSelectedForSummary(k); }}
            className="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            👁 Ver resumen
          </button>
          <button
            onClick={async () => {
              setOpenMenuId(null);
              const link = buildCatalogLink(k, Number(k.clientType ?? 1));
              try { await navigator.clipboard.writeText(link); alert("Link de catálogo copiado ✅"); }
              catch { prompt("Copia este link:", link); }
            }}
            className="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            📋 Copiar catálogo
          </button>
          <button
            onClick={async () => {
              setOpenMenuId(null);
              const link = buildQuestionnaireLink(k, Number(k.clientType ?? 1));
              try { await navigator.clipboard.writeText(link); alert("Link de cuestionario copiado ✅"); }
              catch { prompt("Copia este link:", link); }
            }}
            className="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            📝 Copiar cuestionario
          </button>
          <div className="border-t border-neutral-100 my-1"/>
          <button
            onClick={() => { setOpenMenuId(null); setSelectedForDelete(k); }}
            className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50"
          >
            🗑 Eliminar
          </button>
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
        <EditDrawer
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
