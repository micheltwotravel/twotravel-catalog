// src/ItineraryPrintView.jsx
// Premium Two Travel Concierge Itinerary — browser print → PDF
// Visual direction: luxury editorial, horizontal images, clean hierarchy
import { useState, useEffect, useMemo, useRef } from "react";
import { fetchServicesFromSheet, fetchKickoffsFromSheet, updateKickoffInSheet } from "./sheetServices";
import ttLogo from "./assets/logo.png";

/* ─── contentEditable helper ─────────────────────────────────
   Renders a span that is click-to-edit when editMode is on.
   Falls back to plain text in print / when editMode is off.
──────────────────────────────────────────────────────────── */
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

function Editable({ value, tag: Tag = "span", className = "", editMode, style, onChange }) {
  const ref = useRef();
  if (!editMode) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        outline: "none",
        borderBottom: "1px dashed #aaa",
        minWidth: 20,
        cursor: "text",
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={() => onChange?.(ref.current?.innerText ?? "")}
    >
      {value}
    </Tag>
  );
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const cl  = (v) => String(v ?? "").trim();
const num = (v) => { const n = Number(cl(v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; };

/* Default pre-trip content shown when concierge hasn't filled the block yet */
const DEFAULT_PRETRIP_PDF = `Promo!
Share your experience with Two Travel on Instagram @twotravelconcierge or TikTok @twotravelvip and receive a discount on select services. Tag must be posted during your stay. One tag per person required.`;

/** Ensures a date string is YYYY-MM-DD for QB billing fields */
function formatIsoDate(v) {
  const s = cl(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

/** Strips [ ] from text so they don't break the QB bracket parser */
function cleanBrackets(v) {
  return cl(v).replace(/[\[\]]/g, "");
}

// ─── FLIGHT TRACKER (web view only, no-print) ────────────────
const FLIGHT_STATUS_LABELS = {
  scheduled: { es: "Programado", en: "Scheduled", color: "#2563eb", bg: "#eff6ff" },
  active:    { es: "En vuelo",   en: "In Flight",  color: "#059669", bg: "#ecfdf5" },
  landed:    { es: "Aterrizó",   en: "Landed",     color: "#374151", bg: "#f3f4f6" },
  cancelled: { es: "Cancelado",  en: "Cancelled",  color: "#dc2626", bg: "#fef2f2" },
  diverted:  { es: "Desviado",   en: "Diverted",   color: "#d97706", bg: "#fffbeb" },
  unknown:   { es: "Sin datos",  en: "No data",    color: "#9ca3af", bg: "#f9fafb" },
};

function useFlightData(flightNumber, date) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!flightNumber) return;
    setLoading(true);
    const params = new URLSearchParams({ flight: flightNumber });
    if (date) params.set("date", date);
    fetch(`/api/flight-status?${params}`)
      .then(r => r.json())
      .then(d => { setData(d.data || null); setLoading(false); })
      .catch(() => setLoading(false));
  }, [flightNumber, date]);
  return { data, loading };
}

const STATUS_STYLE = {
  scheduled: { bg: "#f0fdf4", color: "#15803d", label_es: "En horario", label_en: "On time" },
  active:    { bg: "#eff6ff", color: "#1d4ed8", label_es: "En vuelo",   label_en: "In flight" },
  landed:    { bg: "#f9fafb", color: "#374151", label_es: "Aterrizó",   label_en: "Landed" },
  cancelled: { bg: "#fef2f2", color: "#dc2626", label_es: "Cancelado",  label_en: "Cancelled" },
  diverted:  { bg: "#fffbeb", color: "#d97706", label_es: "Desviado",   label_en: "Diverted" },
  unknown:   { bg: "#f9fafb", color: "#9ca3af", label_es: "Sin datos",  label_en: "Unknown" },
};

function FlightRow({ flight, lang, type }) {
  const { data, loading } = useFlightData(flight.flightNumber, flight.date);
  const isEs = lang === "es";
  const fmtTime = iso => iso ? new Date(iso).toLocaleTimeString("es-CO", { hour:"2-digit", minute:"2-digit", timeZone:"America/Bogota" }) : "—";
  const fmtDate = iso => {
    if (!iso) return flight.date || "";
    return new Date(iso).toLocaleDateString("es-CO", { day:"numeric", month:"short", timeZone:"America/Bogota" });
  };
  const st = data?.status ? (STATUS_STYLE[data.status] || STATUS_STYLE.unknown) : null;
  const depTime = data ? fmtTime(data.depActual || data.depScheduled) : (flight.time || "—");
  const arrTime = data ? fmtTime(data.arrActual || data.arrEstimated || data.arrScheduled) : "—";
  const route = data ? `${data.depIata || ""}  →  ${data.arrIata || ""}` : "";

  return (
    <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 90px 90px 90px", alignItems:"center", gap:12,
      padding:"12px 0", borderBottom:"1px solid #f3f4f6" }}>
      {/* Flight # */}
      <div>
        <div style={{ fontFamily:"monospace", fontWeight:700, fontSize:14, color:"#111", letterSpacing:".04em" }}>
          {flight.flightNumber || "—"}
        </div>
        {data?.airline && <div style={{ fontSize:9, color:"#9ca3af", marginTop:1 }}>{data.airline}</div>}
      </div>
      {/* Route */}
      <div>
        <div style={{ fontSize:13, color:"#374151", fontWeight:500 }}>
          {route || (flight.name ? flight.name : <span style={{ color:"#d1d5db" }}>—</span>)}
        </div>
        {route && flight.name && <div style={{ fontSize:10, color:"#9ca3af" }}>{flight.name}</div>}
        {data?.depAirport && !route.includes(data.depAirport) && (
          <div style={{ fontSize:9, color:"#9ca3af" }}>{data.depAirport} → {data.arrAirport}</div>
        )}
      </div>
      {/* Date */}
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:11, color:"#374151" }}>{fmtDate(data?.depScheduled)}</div>
        {data?.depDelay > 0 && <div style={{ fontSize:9, color:"#dc2626" }}>+{data.depDelay}m</div>}
      </div>
      {/* Dep / Arr time */}
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".06em", marginBottom:2 }}>
          {type === "arrival" ? (isEs ? "Sale" : "Dep") : (isEs ? "Sale" : "Dep")}
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:"#111" }}>{loading ? "…" : depTime}</div>
        {data?.gate && <div style={{ fontSize:9, color:"#9ca3af" }}>Gate {data.gate}</div>}
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".06em", marginBottom:2 }}>
          {type === "arrival" ? (isEs ? "Llega" : "Arr") : (isEs ? "Llega" : "Arr")}
        </div>
        <div style={{ fontSize:13, fontWeight:600, color:"#111" }}>{loading ? "…" : arrTime}</div>
        {st && (
          <span style={{ fontSize:8, fontWeight:700, padding:"1px 6px", borderRadius:99,
            background:st.bg, color:st.color, letterSpacing:".06em", textTransform:"uppercase" }}>
            {isEs ? st.label_es : st.label_en}
          </span>
        )}
      </div>
    </div>
  );
}

function FlightBlock({ kickoff, lang, type }) {
  let flights = [];
  const key = type === "arrival" ? "arrivals" : "departures";
  try { flights = JSON.parse(kickoff[key] || "[]").filter(f => f.flightNumber); } catch {}
  if (!flights.length) return null;
  const isEs = lang === "es";
  const label = type === "arrival"
    ? (isEs ? "Vuelos de llegada" : "Arrival Flights")
    : (isEs ? "Vuelos de salida" : "Departure Flights");

  return (
    <div style={{ maxWidth:780, margin:"0 auto 24px", padding:"0 24px" }}>
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:16, overflow:"hidden" }}>
        {/* Header */}
        <div style={{ background:"#1a1814", padding:"14px 20px", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:16 }}>{type === "arrival" ? "🛬" : "🛫"}</span>
          <span style={{ color:"#fff", fontWeight:700, fontSize:12, textTransform:"uppercase", letterSpacing:".1em" }}>{label}</span>
        </div>
        {/* Column headers */}
        <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 90px 90px 90px", gap:12,
          padding:"8px 20px", background:"#f9fafb", borderBottom:"1px solid #e5e7eb" }}>
          {["Vuelo","Ruta","Fecha",isEs?"Sale":"Dep",isEs?"Llega":"Arr"].map(h => (
            <div key={h} style={{ fontSize:9, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".08em",
              textAlign: h === "Vuelo" || h === "Ruta" ? "left" : "center" }}>{h}</div>
          ))}
        </div>
        {/* Rows */}
        <div style={{ padding:"0 20px" }}>
          {flights.map((f, i) => <FlightRow key={i} flight={f} lang={lang} type={type} />)}
        </div>
        <div style={{ padding:"8px 20px 12px", textAlign:"right" }}>
          <span style={{ fontSize:9, color:"#d1d5db" }}>
            {isEs ? "Actualiza la página para refrescar datos en tiempo real" : "Refresh page for live data"}
          </span>
        </div>
      </div>
    </div>
  );
}

// Keep old name for arrival block placed at top
function FlightTracker({ kickoff, lang }) {
  return <FlightBlock kickoff={kickoff} lang={lang} type="arrival" />;
}
// Departure block placed at end
function DepartureTracker({ kickoff, lang }) {
  return <FlightBlock kickoff={kickoff} lang={lang} type="departure" />;
}

function fmtPrice(v) {
  const n = num(v);
  if (!n) return "";
  return n >= 10000
    ? `$${n.toLocaleString("es-CO")} COP`
    : `$${n.toLocaleString("en-US")} USD`;
}

function parseJsonField(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim().startsWith("[")) {
    try { return JSON.parse(v); } catch { return []; }
  }
  if (typeof v === "object" && v !== null) return Object.values(v);
  return [];
}

function matchCart(cartRaw, catalog) {
  const cart = parseJsonField(cartRaw);
  const out = [];
  for (const item of cart) {
    if (item.ghost) continue;
    if (item.type === "block") {
      if (item.html) out.push({ cartItem: item, service: null, isBlock: true });
      continue;
    }
    const itemName = cl(item.displayName || item.name || "");
    if (!itemName) continue;
    const sku = cl(item.sku);
    const id  = cl(item.id);
    const nl  = itemName.toLowerCase();
    // Only match catalog for items that came from catalog (have a sku or non-preset id)
    const isCheckinOut = /check.?in|check.?out/i.test(itemName);
    const isPreset = isCheckinOut || (!sku && (!id || id.startsWith("preset_") || id.startsWith("manual_")));
    const s = isPreset ? null : (
      catalog.find(s => sku && s.sku === sku) ||
      catalog.find(s => id  && String(s.id) === id) ||
      catalog.find(s => nl  && s.name.toLowerCase() === nl)
    );
    // Always include the item; use catalog data when matched, cart item's own data otherwise
    const svc = s || {
      name: item.name || item.displayName || "",
      name_en: item.name_en || item.name || "",
      description: { es: item.description_es || "", en: item.description_en || "" },
      descriptionEs: item.description_es || "",
      descriptionEn: item.description_en || "",
      image: driveImgUrl(item.image || ""),
      category: item.category || "",
      location: item.location || "",
      city: item.city || "",
      schedule: "",
      cancellation: item.cancellation || "",
      dressCode: "",
      dressCode_en: "",
      deposit: item.deposit || "",
      menuUrl: item.menuUrl || "",
      mapsUrl: item.mapsUrl || "",
      quickbooksCode: item.quickbooksCode || "",
      family_friendly: false,
      highlights: [],
      highlights_en: [],
      includes: "",
      priceUnit: item.priceUnit || "",
      priceTiers: "",
    };
    out.push({ cartItem: item, service: svc });
  }
  return out;
}

const CITY_FULL = { CTG:"cartagena", MDE:"medellín", CDMX:"ciudad de méxico", TUL:"tulum", BOG:"bogotá" };
function normCity(c) {
  const u = String(c || "").trim().toUpperCase();
  return CITY_FULL[u] || String(c || "").trim().toLowerCase();
}

function buildDays(matched, lang, dayMeta, tripCityRaw) {
  const tripCities = String(tripCityRaw || "").split(",").map(normCity).filter(Boolean);
  const svcMatchesTrip = (svcCity) => {
    if (!svcCity || !tripCities.length) return true;
    const n = normCity(svcCity);
    return tripCities.some(tc => tc === n || tc.includes(n) || n.includes(tc));
  };

  const map = new Map();
  matched.forEach(({ cartItem, service, isBlock }, idx) => {
    const key = cl(cartItem?.dayLabel || cartItem?.day || "Itinerary");
    if (!map.has(key)) map.set(key, []);
    if (isBlock) {
      map.get(key).push({ isBlock: true, cartItem, sort: Number(cartItem.sortOrder ?? idx) });
      return;
    }
    const desc = lang === "es"
      ? (service.description?.es || service.descriptionEs || service.description?.en || service.descriptionEn || "")
      : (service.description?.en || service.descriptionEn || service.description?.es || service.descriptionEs || "");
    const rawLoc = lang === "es" ? (service.location_es || service.location || "") : (service.location || "");
    const locLower = rawLoc.toLowerCase();
    const locMentionsOtherCity = Object.values(CITY_FULL).some(cn => locLower.includes(cn) && !tripCities.includes(cn));
    const cityMatches = svcMatchesTrip(service.city) && !locMentionsOtherCity;
    map.get(key).push({
      sort         : Number(cartItem.sortOrder ?? idx),
      time         : cl(cartItem.timeLabel || cartItem.time || cartItem.startTime || ""),
      schedule     : cl(service.schedule || ""),
      duration     : cl(service.duration || ""),
      title        : cl(lang === "en"
        ? (cartItem.displayName || cartItem.name_en || service.name_en || service.name || cartItem.name || "")
        : (cartItem.displayName || cartItem.name    || service.name    || "")),
      description  : desc,
      highlights   : lang === "es"
        ? (service.highlights    || [])
        : (service.highlights_en || service.highlights || []),
      includes     : service.includes   || "",
      location     : cityMatches ? rawLoc : "",
      address      : service.address    || "",
      city         : service.city       || "",
      price        : cartItem.priceOverride_cop || (cityMatches ? (service.price_cop || service.priceCop || service.price_tier_1 || service.priceTier1 || "") : ""),
      priceIsOverride: !!cartItem.priceOverride_cop,
      priceUsd     : cartItem.priceUsd != null ? num(cartItem.priceUsd) : (cityMatches ? num(service.price_tier_1 || service.priceTier1 || 0) : 0),
      priceUnit    : cartItem.priceUnit || service.priceUnit || "",
      pax          : Number(cartItem.pax || 0),
      deposit      : service.deposit    || "",
      cancellation : service.cancellation || "",
      menuUrl      : service.menuUrl    || "",
      mapsUrl      : service.mapsUrl    || "",
      image        : service.image      || "",
      qbCode       : service.quickbooksCode || service.quickbooks_code || "",
      category     : service.category   || "",
      familyFriendly: !!(service.family_friendly),
      dressCode    : cl(lang === "en"
        ? (cartItem.dressCode_en || service.dressCode_en || service.dress_code_en || "")
        : (cartItem.dressCode || service.dressCode || service.dress_code || "")),
      confirmed    : cartItem.confirmed !== false,
      confirmation : cartItem.confirmation || "",
      priceTiers      : cartItem.priceTiers || (lang === "en" ? (service.priceTiers_en || service.priceTiers) : (service.priceTiers || service.priceTiers_en)) || service.price_tiers || "",
      tierQuantities  : cartItem.tierQuantities || [],
      tierTotal       : cartItem.tierTotal || 0,
    });
  });
  // Respect dayMeta order if provided
  const metaList   = Array.isArray(dayMeta) ? dayMeta : [];
  const metaLabels = metaList.map(dm => cl(dm.label)).filter(Boolean);
  const extraLabels = [...map.keys()].filter(k => !metaLabels.includes(k));
  const orderedLabels = [...metaLabels.filter(l => map.has(l)), ...extraLabels];

  const parseTime = t => { const m = String(t||"").match(/^(\d{1,2}):(\d{2})/); return m ? +m[1]*60 + +m[2] : Infinity; };
  return orderedLabels.map(label => {
    const dm = metaList.find(d => cl(d.label) === label);
    const items = (map.get(label) || []).sort((a, b) => {
      const ta = parseTime(a.time), tb = parseTime(b.time);
      return ta !== tb ? ta - tb : a.sort - b.sort;
    });
    // Day band shows label; subtitle shows the descriptive title if set
    return { label, title: dm?.title || "", items };
  });
}

function splitList(v) {
  if (Array.isArray(v)) return v.filter(Boolean);
  return cl(v)
    .split(/[\n•·;|\/]+/)
    .map(s => s.replace(/^[-–—*]\s*/, "").trim())
    .filter(Boolean);
}

/* ═══════════════════════════════════════════════════════════
   CSS  — Premium editorial style, print-safe
═══════════════════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300;0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&family=Playfair+Display:wght@400;600;700&display=swap');

  *{box-sizing:border-box;margin:0;padding:0;}
  html,body,.root{
    font-family:'Inter',system-ui,-apple-system,sans-serif;
    background:#e8e8e8;
    color:#111;
    -webkit-font-smoothing:antialiased;
  }

  /* ── Print rules ── */
  @media print{
    html,body,.root{background:#fff;}
    .no-print{display:none!important;}
    .page{
      page-break-after:always;
      break-after:page;
      box-shadow:none!important;
      margin:0!important;
      border-radius:0!important;
    }
    .page:last-child{page-break-after:avoid;break-after:avoid;}
    @page{margin:0;size:A4 portrait;}
    body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
    a{color:inherit!important;text-decoration:none!important;}
  }

  /* ── Page shell ── */
  .page{
    width:794px;
    min-height:1122px;
    margin:0 auto 28px;
    background:#fff;
    display:flex;
    flex-direction:column;
    box-shadow:0 4px 24px rgba(0,0,0,.12);
    border-radius:3px;
    overflow:hidden;
    position:relative;
  }

  /* ── Page header strip ── */
  .ph{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:10px 40px;
    border-bottom:1px solid #e8e8e8;
    flex-shrink:0;
  }
  .ph-left{font-size:9.5px;color:#999;line-height:1.6;}
  .ph-left b{display:block;font-size:10px;color:#222;font-weight:600;letter-spacing:.2px;}
  .ph-left span{display:block;}
  .ph-right{
    font-size:10px;font-weight:700;letter-spacing:1.5px;
    text-transform:uppercase;color:#111;
  }

  /* ── Page footer ── */
  .pf{
    display:flex;justify-content:space-between;align-items:center;
    padding:8px 40px;border-top:1px solid #e8e8e8;
    margin-top:auto;flex-shrink:0;
    font-size:9px;color:#ccc;letter-spacing:.4px;
  }

  /* ══════════════════════════════════════
     COVER PAGE
  ══════════════════════════════════════ */
  .cover-hero{
    width:100%;height:320px;
    object-fit:cover;object-position:center 30%;
    display:block;flex-shrink:0;
  }
  .cover-hero-placeholder{
    width:100%;height:320px;flex-shrink:0;
    background:linear-gradient(150deg,#0a0a0a 0%,#1a1a1a 50%,#222 100%);
    display:flex;align-items:flex-end;padding:32px 40px;
  }

  .cover-body{padding:32px 40px 24px;flex:1;display:flex;flex-direction:column;}
  .cover-eyebrow{
    font-size:8.5px;letter-spacing:4px;text-transform:uppercase;
    color:#aaa;margin-bottom:14px;
  }
  .cover-title{
    font-family:'Playfair Display','Georgia',serif;
    font-size:34px;font-weight:700;line-height:1.1;
    letter-spacing:-.5px;color:#111;margin-bottom:8px;
  }
  .cover-subtitle{
    font-size:14px;color:#666;margin-bottom:4px;font-weight:400;letter-spacing:.1px;
  }
  .cover-dates{font-size:12px;color:#999;margin-bottom:28px;font-weight:400;}

  .cover-rule{height:1px;background:linear-gradient(90deg,#111 0,#e0e0e0 100%);margin:0 0 24px;width:80px;}

  /* Accommodation info grid */
  .cover-info-grid{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;}
  .cover-info-card{
    flex:1;min-width:160px;
    border:1px solid #e8e8e8;border-radius:10px;
    padding:14px 16px;background:#fafafa;
  }
  .cover-info-label{
    font-size:8px;letter-spacing:2.5px;text-transform:uppercase;
    color:#ccc;margin-bottom:7px;font-weight:500;
  }
  .cover-info-value{font-size:13.5px;font-weight:600;color:#111;line-height:1.3;}
  .cover-info-sub{font-size:11px;color:#888;margin-top:4px;line-height:1.55;}

  .cover-note{
    font-size:12.5px;color:#555;line-height:1.85;
    max-width:540px;margin-bottom:24px;font-style:italic;
  }
  .cover-footer-note{
    font-size:11px;color:#777;line-height:1.8;
    border-top:1px solid #ebebeb;padding-top:16px;
    margin-top:auto;
  }

  /* ══════════════════════════════════════
     TRIP SUMMARY PAGE
  ══════════════════════════════════════ */
  .section-eyebrow{
    padding:18px 40px 10px;
    font-size:8.5px;letter-spacing:3.5px;text-transform:uppercase;color:#ccc;
    border-bottom:1px solid #ebebeb;flex-shrink:0;font-weight:500;
  }
  .section-title{
    padding:14px 40px 18px;
    font-family:'Playfair Display','Georgia',serif;
    font-size:22px;font-weight:700;letter-spacing:-.2px;color:#111;
  }

  .sum-body{padding:4px 40px 24px;flex:1;}
  .sum-day-block{margin-bottom:22px;}
  .sum-day-header{
    display:flex;align-items:center;gap:10px;
    margin-bottom:9px;padding-bottom:6px;
    border-bottom:1px solid #f0f0f0;
  }
  .sum-day-num{
    font-size:8px;letter-spacing:2px;text-transform:uppercase;
    color:#bbb;font-weight:600;flex-shrink:0;
  }
  .sum-day-label{font-size:12.5px;font-weight:700;color:#111;}
  .sum-day-sub{font-size:10px;color:#555;margin-left:6px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;}
  .sum-svc-row{
    display:flex;gap:12px;
    font-size:11px;color:#666;
    padding:3.5px 0 3.5px 0;
    align-items:baseline;
  }
  .sum-svc-time{
    min-width:48px;color:#555;flex-shrink:0;
    font-variant-numeric:tabular-nums;font-size:10px;font-weight:700;
  }
  .sum-svc-name{flex:1;color:#111;font-weight:700;}
  .sum-svc-loc{color:#ccc;font-size:10px;flex-shrink:0;}

  /* ══════════════════════════════════════
     PRE-TRIP PAGE
  ══════════════════════════════════════ */
  .pretrip-body{padding:4px 40px 24px;flex:1;}
  .pretrip-block{margin-bottom:20px;}
  .pretrip-h3{
    font-size:9px;font-weight:700;letter-spacing:2.5px;
    text-transform:uppercase;color:#bbb;margin-bottom:10px;
    padding-bottom:6px;border-bottom:1px solid #f0f0f0;
  }
  .pretrip-line{
    font-size:12px;color:#444;line-height:1.9;
    padding:2px 0;
  }
  .pretrip-link{
    font-size:12px;color:#1d4ed8;text-decoration:underline;
    display:block;padding:3px 0;line-height:1.7;
  }
  .pretrip-note{
    font-size:11.5px;color:#666;line-height:1.85;
    background:#fafafa;border-left:3px solid #e0e0e0;
    padding:10px 14px;border-radius:0 6px 6px 0;
    margin-top:8px;
  }

  /* ══════════════════════════════════════
     INFO PAGE
  ══════════════════════════════════════ */
  .info-body{padding:4px 40px 24px;flex:1;}
  .info-block{margin-bottom:20px;}
  .info-h3{
    font-size:9px;font-weight:700;letter-spacing:2.5px;
    text-transform:uppercase;color:#bbb;margin-bottom:10px;
    padding-bottom:6px;border-bottom:1px solid #f0f0f0;
  }
  .info-p{font-size:12px;color:#555;line-height:1.85;margin-bottom:6px;}

  /* ══════════════════════════════════════
     DAY BAND
  ══════════════════════════════════════ */
  .day-band{
    background:#111;
    padding:14px 40px;
    display:flex;align-items:center;gap:0;
    flex-shrink:0;
  }
  .day-band-inner{flex:1;min-width:0;}
  .day-band-row{display:flex;align-items:baseline;gap:10px;}
  .day-band-sup{
    font-size:8px;letter-spacing:3.5px;text-transform:uppercase;
    color:#555;flex-shrink:0;font-weight:500;
  }
  .day-band-label{
    font-size:12px;font-weight:400;color:#aaa;line-height:1.2;letter-spacing:.2px;
  }
  .day-band-title{
    font-size:16px;color:#fff;margin-top:4px;
    font-weight:700;letter-spacing:-.1px;text-transform:none;
  }

  /* ══════════════════════════════════════
     EVENT CARD — horizontal layout
     Image LEFT (40%) · Content RIGHT (60%)
  ══════════════════════════════════════ */
  .ev{
    display:flex;
    border-bottom:1px solid #f0f0f0;
    break-inside:avoid;
    page-break-inside:avoid;
    min-height:200px;
  }
  .ev:last-child{border-bottom:none;}

  /* Image column */
  .ev-img-col{
    width:40%;flex-shrink:0;
    overflow:hidden;
    background:#f0f0f0;
    position:relative;
  }
  .ev-img-col img{
    width:100%;height:100%;
    object-fit:cover;object-position:center;
    display:block;
    min-height:200px;
  }
  .ev-img-none{
    width:40%;flex-shrink:0;min-height:200px;
    background:linear-gradient(145deg,#f5f5f5 0%,#ebebeb 100%);
    display:flex;align-items:center;justify-content:center;
  }
  .ev-img-none-icon{font-size:24px;opacity:.15;}

  /* Content column */
  .ev-content{
    flex:1;padding:22px 28px 20px;
    display:flex;flex-direction:column;
  }

  /* Meta: time · duration */
  .ev-meta{
    font-size:9px;letter-spacing:2px;text-transform:uppercase;
    color:#888;margin-bottom:10px;font-weight:700;
  }
  .ev-time-badge{
    display:inline-flex;align-items:center;gap:5px;
    font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;
    color:#92400e;background:#fff7ed;border:1px solid #fed7aa;border-radius:20px;
    padding:3px 10px;margin-bottom:10px;
  }
  .ev-time-dur{font-weight:400;color:#b45309;letter-spacing:.5px;}

  /* Title + price row */
  .ev-title-row{
    display:flex;justify-content:space-between;align-items:flex-start;
    gap:14px;margin-bottom:4px;
  }
  .ev-title{
    font-size:16px;font-weight:700;line-height:1.2;color:#111;
    letter-spacing:-.2px;
  }
  .ev-price-col{text-align:right;flex-shrink:0;}
  .ev-price-label{
    font-size:7.5px;letter-spacing:2px;text-transform:uppercase;
    color:#ccc;display:block;margin-bottom:3px;font-weight:500;
  }
  .ev-price-val{font-size:13px;font-weight:700;color:#111;}
  .ev-price-tiers{font-size:10px;color:#6b7280;margin-top:2px;white-space:pre-line;}

  .ev-location{font-size:11px;color:#aaa;margin-bottom:11px;letter-spacing:.1px;}

  /* Links */
  .ev-links{display:flex;gap:14px;margin-bottom:11px;flex-wrap:wrap;}
  .ev-link{font-size:10.5px;color:#1d4ed8;text-decoration:underline;font-weight:500;}

  /* Description */
  .ev-desc{
    font-size:11.5px;color:#444;line-height:1.8;
    margin-bottom:11px;
  }

  /* Lists */
  .ev-list-block{margin-bottom:10px;}
  .ev-list-label{
    font-size:8px;font-weight:600;letter-spacing:2px;
    text-transform:uppercase;color:#ccc;margin-bottom:6px;
  }
  .ev-list-item{
    font-size:11px;color:#555;
    padding:2px 0 2px 14px;
    position:relative;line-height:1.6;
  }
  .ev-list-item::before{
    content:"–";position:absolute;left:0;color:#ccc;
  }

  /* Terms */
  .ev-terms{
    font-size:10px;color:#aaa;line-height:1.7;
    margin-bottom:8px;padding-top:8px;
    border-top:1px solid #f5f5f5;
  }
  .ev-terms b{color:#888;font-weight:600;}

  /* Footer */
  .ev-footer{
    margin-top:auto;padding-top:10px;
    font-size:9.5px;color:#ccc;line-height:1.6;
  }
  .ev-footer-link{color:#1d4ed8;text-decoration:underline;}
  /* QuickBooks machine-readable service lines — small gray, always in PDF text layer */
  .ev-qb{
    color:#c8c8c8;
    font-size:7.5px;
    font-family:'Courier New',Courier,monospace;
    line-height:1.4;
    margin-top:3px;
    letter-spacing:.2px;
  }

  /* ── QB Billing block — last page ── */
  .qb-billing-block{
    margin:0 40px 0;
    padding:10px 14px 8px;
    border:1px solid #f0f0f0;
    border-radius:6px;
    background:#fafafa;
  }
  .qb-billing-label{
    font-size:7px;letter-spacing:2.5px;text-transform:uppercase;
    color:#ccc;font-weight:600;margin-bottom:6px;
  }
  .qb-billing-line{
    font-size:8px;
    font-family:'Courier New',Courier,monospace;
    color:#bbb;
    line-height:1.7;
    letter-spacing:.2px;
  }

  /* Family Friendly badge */
  .ev-ff{
    display:inline-flex;align-items:center;gap:4px;
    background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;
    border-radius:99px;padding:2px 9px;font-size:9px;font-weight:600;
    margin-bottom:9px;letter-spacing:.3px;
  }

  /* Recommendation badge — shown when item is NOT confirmed */
  .ev-rec-badge{
    display:inline-flex;align-items:center;gap:5px;
    background:#fefce8;border:1px solid #fde68a;color:#92400e;
    border-radius:6px;padding:4px 10px;font-size:9.5px;font-weight:600;
    margin-bottom:10px;letter-spacing:.3px;
  }
  /* Recommendation card gets a subtle amber left border */
  .ev-recommendation{
    border-left:3px solid #fbbf24;
  }

  /* ── Edit mode ── */
  .edit-mode-bar{
    position:fixed;top:0;left:0;right:0;z-index:200;
    background:#1d4ed8;color:#fff;
    padding:9px 24px;
    display:flex;align-items:center;justify-content:space-between;gap:12px;
    font-size:12px;font-family:'Inter',sans-serif;
    box-shadow:0 2px 16px rgba(0,0,0,.3);
  }
  .edit-mode-bar b{font-weight:700;}
  @media print{
    .edit-mode-bar{display:none!important;}
    [contenteditable]{border-bottom:none!important;outline:none!important;}
  }
`;

/* ═══════════════════════════════════════════════════════════
   SHARED PAGE HEADER
═══════════════════════════════════════════════════════════ */
const CONCIERGE_TITLE_MAP = {
  "Alia Jadad":      "Senior Concierge Cartagena",
  "Carolina Lopez":  "Senior Concierge Cartagena",
  "Daniela Becerra": "Senior Concierge Medellín",
};

function PH({ kickoff }) {
  const name  = kickoff.assignedConciergeName || kickoff.assignedConcierge || "";
  const email = kickoff.assignedConciergeEmail || "";
  const title = kickoff.conciergeTitle || CONCIERGE_TITLE_MAP[name] || "";
  return (
    <div className="ph">
      <div className="ph-left">
        {name  && <b>{name}</b>}
        {title && <span style={{ color:"#9a7d52", fontSize:"0.85em" }}>{title}</span>}
        {email && <span>{email}</span>}
        {!name && <span>Two Travel Concierge</span>}
      </div>
    </div>
  );
}

function PF({ n, total }) {
  return (
    <div className="pf">
      <span>two.travel · Concierge Services</span>
      {total > 0 && <span>{n} / {total}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE 1: COVER
═══════════════════════════════════════════════════════════ */
function CoverPage({ kickoff, total, lang, editMode }) {
  const a   = kickoff;
  const isEs = lang === "es";

  const titleLine = a.tripName || a.guestName || "Two Travel Concierge";

  // Always use full month names; re-derive from ISO dates if available
  const fmtFullDate = (iso) => {
    try { return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric" }); } catch { return iso; }
  };
  const displayTripDates = (() => {
    if (a.arrivalDate && a.departureDate) {
      const yr = new Date(a.departureDate + "T12:00:00").getFullYear();
      return `${fmtFullDate(a.arrivalDate)} – ${fmtFullDate(a.departureDate)}, ${yr}`;
    }
    return a.tripDates || "";
  })();

  const coverImgUrl = a.coverPhotoId
    ? `https://lh3.googleusercontent.com/d/${a.coverPhotoId}`
    : null;

  return (
    <div className="page">
      {/* Hero — branded city photo if selected, else dark + logo */}
      {coverImgUrl ? (
        <img src={coverImgUrl} alt="Cover"
          style={{ width:"100%", height:320, objectFit:"cover", objectPosition:"center 30%", display:"block", flexShrink:0 }}
          onError={e => { e.target.style.display="none"; }}
        />
      ) : (
        <div style={{ width:"100%", height:320, flexShrink:0, background:"linear-gradient(150deg,#0a0a0a 0%,#1a1a1a 50%,#222 100%)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <img src={ttLogo} alt="Two Travel"
            style={{ maxHeight:160, maxWidth:380, objectFit:"contain", filter:"brightness(0) invert(1)" }}
          />
        </div>
      )}

      <PH kickoff={a}/>

      <div className="cover-body">
        {a.city && (
          <Editable
            tag="div" className="cover-eyebrow" editMode={editMode}
            value={`${a.guestName ? `${a.guestName} ° ` : ""}${String(a.city).split(",").map(c => ({ CTG:"Cartagena", MDE:"Medellín", CDMX:"Ciudad de México", TUL:"Tulum", BOG:"Bogotá" })[c.trim().toUpperCase()] || c.trim()).join(" & ")} ${isEs ? "Itinerario Concierge" : "Concierge Itinerary"}`}
          />
        )}
        <Editable tag="div" className="cover-title" editMode={editMode} value={titleLine}/>
        {/* Show tripDates once — clearly below the guest name */}
        {displayTripDates && (
          <Editable tag="div" className="cover-dates" editMode={editMode} value={displayTripDates}/>
        )}

        <div className="cover-rule"/>

        {/* Accommodation / stay block */}
        {(a.accommodationName || a.groupSize || a.checkIn || a.checkOut) && (
          <div className="cover-info-grid">
            {a.accommodationName && (
              <div className="cover-info-card">
                {a.accommodationPhoto && (
                  <img src={driveImgUrl(a.accommodationPhoto)} alt={a.accommodationName}
                    style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6, marginBottom: 8 }}
                    onError={e => { e.target.style.display = "none"; }}
                  />
                )}
                <div className="cover-info-label">
                  {isEs ? "Alojamiento" : "Accommodation"}
                </div>
                {a.accommodationUrl ? (
                  <a href={a.accommodationUrl} target="_blank" rel="noreferrer"
                    className="cover-info-value"
                    style={{ color: "#1d4ed8", textDecoration: "underline", display: "block" }}>
                    {a.accommodationName}
                  </a>
                ) : (
                  <Editable tag="div" className="cover-info-value" editMode={editMode} value={a.accommodationName}/>
                )}
                {a.accommodationAddr && (
                  a.accommodationMapsUrl ? (
                    <a href={a.accommodationMapsUrl} target="_blank" rel="noreferrer"
                      className="cover-info-sub"
                      style={{ color: "#1d4ed8", textDecoration: "underline", display: "block", fontSize: 11, marginTop: 3 }}>
                      📍 {a.accommodationAddr}
                    </a>
                  ) : (
                    <Editable tag="div" className="cover-info-sub" editMode={editMode} value={a.accommodationAddr}/>
                  )
                )}
                {a.barrio && (
                  <div className="cover-info-sub" style={{ color: "#6b7280", fontStyle: "italic" }}>
                    {isEs ? "Barrio" : "Neighborhood"}: {a.barrio}
                  </div>
                )}
              </div>
            )}
            {(a.checkIn || a.checkOut || a.groupSize) && (
              <div className="cover-info-card">
                <div className="cover-info-label">
                  {isEs ? "Detalles de Estadía" : "Stay Details"}
                </div>
                {a.groupSize && (
                  <div className="cover-info-value" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span>👥</span>
                    <span>{(() => { const n = parseInt(a.groupSize) || 0; if (!n) return a.groupSize; return isEs ? `${n} ${n===1?"persona":"personas"}` : `${n} ${n===1?"person":"people"}`; })()}</span>
                  </div>
                )}
                {a.checkIn  && (
                  <Editable tag="div" className="cover-info-sub" editMode={editMode}
                    value={`Check-in: ${a.checkIn}`}/>
                )}
                {a.checkOut && (
                  <Editable tag="div" className="cover-info-sub" editMode={editMode}
                    value={`Check-out: ${a.checkOut}`}/>
                )}
              </div>
            )}
          </div>
        )}

        {/* City 2 accommodation block */}
        {a.accommodationName2 && (
          <div className="cover-info-grid" style={{ marginTop: 8 }}>
            <div className="cover-info-card">
              <div className="cover-info-label">
                {isEs ? "Alojamiento" : "Accommodation"}{a.city && String(a.city).split(",").length > 1 ? ` — ${String(a.city).split(",").map(c => ({ CTG:"Cartagena", MDE:"Medellín", CDMX:"Ciudad de México", TUL:"Tulum", BOG:"Bogotá" })[c.trim().toUpperCase()] || c.trim())[1]}` : " 2"}
              </div>
              {a.accommodationUrl2 ? (
                <a href={a.accommodationUrl2} target="_blank" rel="noreferrer"
                  className="cover-info-value"
                  style={{ color: "#1d4ed8", textDecoration: "underline", display: "block" }}>
                  {a.accommodationName2}
                </a>
              ) : (
                <Editable tag="div" className="cover-info-value" editMode={editMode} value={a.accommodationName2}/>
              )}
              {a.accommodationAddr2 && (
                <Editable tag="div" className="cover-info-sub" editMode={editMode} value={a.accommodationAddr2}/>
              )}
              {a.barrio2 && (
                <div className="cover-info-sub" style={{ color: "#6b7280", fontStyle: "italic" }}>
                  {isEs ? "Barrio" : "Neighborhood"}: {a.barrio2}
                </div>
              )}
            </div>
            {(a.tripDates2 || a.arrivalDate2 || a.departureDate2) && (
              <div className="cover-info-card">
                <div className="cover-info-label">{isEs ? "Fechas — Ciudad 2" : "Dates — City 2"}</div>
                <Editable tag="div" className="cover-info-value" editMode={editMode}
                  value={(() => {
                    if (a.arrivalDate2 && a.departureDate2) {
                      const yr = new Date(a.departureDate2 + "T12:00:00").getFullYear();
                      return `${fmtFullDate(a.arrivalDate2)} – ${fmtFullDate(a.departureDate2)}, ${yr}`;
                    }
                    return a.tripDates2 || "";
                  })()}/>
              </div>
            )}
          </div>
        )}


        {/* Schedule kickoff call link */}
        {a.kickoffCallUrl && (
          <a href={a.kickoffCallUrl} target="_blank" rel="noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            textDecoration: "none", background: "#eff6ff", border: "1px solid #93c5fd",
            borderRadius: 10, padding: "11px 16px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8" }}>
              📅 {isEs ? "Agendar Kickoff Call" : "Schedule Kickoff Call"}
            </div>
            <span style={{ fontSize: 16, color: "#1d4ed8" }}>→</span>
          </a>
        )}

        {/* Project Inform / Pre-check-in form link */}
        {a.checkInFormUrl && (
          <a href={a.checkInFormUrl} target="_blank" rel="noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            textDecoration: "none", background: "#faf5ff", border: "1px solid #d8b4fe",
            borderRadius: 10, padding: "11px 16px", marginBottom: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>
              📋 {isEs ? "Formulario de Check-in" : "Check-in Form"}
            </div>
            <span style={{ fontSize: 16, color: "#7c3aed" }}>→</span>
          </a>
        )}

        {/* Action cards — Drinks, Groceries, Breakfast */}
        {a.id && (() => {
          const cardImg = { borderRadius: "8px 8px 0 0", width: "100%", height: 70, objectFit: "cover", display: "block" };
          const cardBody = { padding: "8px 10px 10px" };
          const card = (href, border, img, titleColor, title, desc) => (
            <a href={href} target="_blank" rel="noreferrer"
              style={{ textDecoration: "none", display: "block", border: `1px solid ${border}`, borderRadius: 10, overflow: "hidden" }}>
              <img src={img} alt="" style={cardImg} onError={e=>e.target.style.display='none'} />
              <div style={cardBody}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: titleColor, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.4 }}>{desc}</div>
              </div>
            </a>
          );
          return (
            <div style={{ marginBottom: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {card(
                `https://twotravelvip.com/?mode=drinks&kickoffId=${a.id}&lang=${lang}`,
                "#e9d5ff",
                "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=140&fit=crop&auto=format",
                "#7c3aed",
                isEs ? "Calculadora de Bebidas" : "Drink Calculator",
                isEs ? "Personaliza tus bebidas para la casa y el bote." : "Select your drinks for the house and boat."
              )}
              {card(
                `https://twotravelvip.com/?mode=groceries&kickoffId=${a.id}&lang=${lang}`,
                "#bbf7d0",
                "https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=140&fit=crop&auto=format",
                "#15803d",
                isEs ? "Mercado" : "Groceries",
                isEs ? "Personaliza tu lista de mercado para la estadía." : "Customize your grocery list for the stay."
              )}
              {card(
                `https://twotravelvip.com/?mode=breakfast&kickoffId=${a.id}&lang=${lang}`,
                "#fde68a",
                "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&h=140&fit=crop&auto=format",
                "#b45309",
                isEs ? "Desayuno" : "Breakfast",
                isEs ? "Elige tu desayuno para cada mañana de tu estadía." : "Choose your breakfast for each morning."
              )}
            </div>
          );
        })()}

        {/* Welcome Guide link — shown if configured */}
        {a.welcomePdfUrl && (
          <a href={a.welcomePdfUrl} target="_blank" rel="noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            textDecoration: "none", background: "#f0f9ff", border: "1px solid #bae6fd",
            borderRadius: 10, padding: "11px 16px", marginBottom: 10,
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>
                📖 {isEs ? "Ver Guía de Bienvenida" : "View Welcome Guide"}
              </div>
              <div style={{ fontSize: 9.5, color: "#6b7280", marginTop: 2 }}>
                {isEs ? "Información importante que debes tener en cuenta durante tu estadía." : "Important information to keep in mind during your stay."}
              </div>
            </div>
            <span style={{ fontSize: 14, color: "#0369a1" }}>→</span>
          </a>
        )}

        {/* Schedule a meeting */}
        {(() => {
          const conciergeEmail = a.assignedConciergeEmail || "";
          const conciergeName  = a.assignedConciergeName || a.assignedConcierge || "";
          if (!conciergeEmail && !conciergeName) return null;
          const bookUrl = `/?mode=book&c=${encodeURIComponent(conciergeEmail)}&cn=${encodeURIComponent(conciergeName)}&k=${encodeURIComponent(a.id||"")}&g=${encodeURIComponent(a.guestName||"")}&lang=${lang}`;
          return (
            <a href={bookUrl} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              textDecoration:"none", background:"#f0fdf4", border:"1px solid #bbf7d0",
              borderRadius:10, padding:"11px 16px", marginBottom:10,
            }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#15803d" }}>
                  📅 {isEs ? `Agendar reunión con ${conciergeName}` : `Schedule a meeting with ${conciergeName}`}
                </div>
                <div style={{ fontSize:9.5, color:"#6b7280", marginTop:2 }}>
                  {isEs ? "30 minutos · Elige el día y hora que mejor te convenga." : "30 minutes · Pick the day and time that works best for you."}
                </div>
              </div>
              <span style={{ fontSize:14, color:"#15803d" }}>→</span>
            </a>
          );
        })()}

        {/* Cancellation / reservation note */}
        <div style={{
          fontSize: 10, color: "#6b7280", lineHeight: 1.6,
          background: "#fafafa", border: "1px solid #e8e8e8",
          borderRadius: 8, padding: "10px 14px", marginBottom: 16,
        }}>
          <span style={{ fontWeight: 600, color: "#374151" }}>
            {isEs ? "Reservas y cancelaciones: " : "Reservations & cancellations: "}
          </span>
          {isEs
            ? `Todas las reservas están a nombre de Two Travel — ${a.guestName || ""}. Una vez confirmada una reserva, puede aplicar un cargo por cancelación.`
            : `All reservations are under Two Travel — ${a.guestName || ""}. Once a reservation has been confirmed, a cancellation fee may apply.`}
        </div>

        {/* Social Media Promo */}
        <div style={{
          background: "linear-gradient(135deg,#fdf6ec 0%,#fef9f2 100%)",
          border: "1.5px solid #e8c97a", borderRadius: 12, padding: "14px 16px", marginBottom: 8,
        }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <img src={ttLogo} alt="Two Travel"
              style={{ height: 22, objectFit: "contain", flexShrink: 0 }}
              onError={e => { e.target.style.display = "none"; }}
            />
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#1a1410", letterSpacing: "-.2px" }}>
                {isEs ? "¡Promo en Redes Sociales! ✨" : "Social Media Promo! ✨"}
              </div>
              <div style={{ fontSize: 9.5, color: "#6b5c3e", marginTop: 1 }}>
                {isEs
                  ? "¡Muéstrale al mundo cómo es viajar con Two Travel y obtén descuentos!"
                  : "Show everyone how amazing it is to travel with Two Travel and get discounts!"}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* How to */}
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "#92400e", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 5 }}>
                {isEs ? "Cómo participar" : "Here's how"}
              </div>
              <div style={{ fontSize: 9.5, color: "#44301a", lineHeight: 1.6 }}>
                {"1. "}{isEs ? "Síguenos en Instagram o TikTok" : "Follow us on Instagram or TikTok"}<br/>
                <span style={{ fontWeight: 700 }}>
                  {"   "}
                  <a href="https://www.instagram.com/twotravelconcierge" target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", textDecoration: "none" }}>@twotravelconcierge</a>
                  {" / "}
                  <a href="https://www.tiktok.com/@twotravelvip" target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", textDecoration: "none" }}>@twotravelvip</a>
                </span><br/>
                {"2. "}{isEs ? "Etiquétanos en tu Story o TikTok" : "Tag us in your Story or TikTok"}<br/>
                {"3. "}{isEs ? "Avísale a tu concierge en el chat" : "Let us know in the Concierge chat"}
              </div>
            </div>

            {/* Discounts */}
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "#92400e", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 5 }}>
                {isEs ? "Tus descuentos" : "Your discounts"}
              </div>
              {[
                { en: "Massage session", es: "Sesión de masajes", pct: "20%" },
                { en: "IV Treatment", es: "Tratamiento IV", pct: "10%" },
                { en: "City Tour", es: "City Tour", pct: "15%*" },
                { en: "Transportation", es: "Transporte", pct: "10%" },
                { en: "Chef service", es: "Chef privado", pct: "20%" },
              ].map(d => (
                <div key={d.en} style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: "#44301a", lineHeight: 1.65 }}>
                  <span>{isEs ? d.es : d.en}</span>
                  <span style={{ fontWeight: 700, color: "#b45309" }}>{d.pct} off</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fine print */}
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px solid #e8c97a", fontSize: 8.5, color: "#92713a", lineHeight: 1.5 }}>
            {isEs
              ? "* City Tour sujeto a disponibilidad · Chef: mínimo 4 personas · Un tag por persona · El post debe hacerse durante tu estadía"
              : "* City Tour subject to availability · Chef: minimum 4 guests · One tag per person · Post must be made during your stay"}
          </div>
        </div>
      </div>

      <PF n={1} total={total}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE 2: TRIP SUMMARY
═══════════════════════════════════════════════════════════ */
function SummaryPage({ kickoff, days, page, total, lang, editMode }) {
  const isEs = lang === "es";
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="section-eyebrow">{isEs ? "Resumen" : "Overview"}</div>
      <div className="section-title">{isEs ? "Resumen del Viaje" : "Trip Summary"}</div>

      <div className="sum-body">
        {days.map((day, di) => (
          <div key={day.label} className="sum-day-block">
            <div className="sum-day-header">
              <span className="sum-day-num">{isEs ? "Día" : "Day"} {di + 1}</span>
              <Editable value={day.label} tag="span" className="sum-day-label" editMode={editMode}/>
              {day.title && (
                <Editable value={day.title} tag="span" className="sum-day-sub" editMode={editMode}/>
              )}
            </div>
            {day.items.map((it, i) => (
              <div key={i} className="sum-svc-row" style={it.confirmed === false ? { opacity: 0.55 } : {}}>
                <span className="sum-svc-time">{it.time || "—"}</span>
                <Editable
                  value={it.confirmed === false ? `📌 ${it.title}` : it.title}
                  tag="span" className="sum-svc-name" editMode={editMode}
                />
                {it.location && (
                  <span className="sum-svc-loc">· {it.location}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      <PF n={page} total={total}/>
    </div>
  );
}

/* ─── Per-city social media handles ────────────────────────
   Update these when the accounts change.
   ig = Instagram, tt = TikTok
──────────────────────────────────────────────────────────── */
const CITY_SOCIAL = {
  DEFAULT: {
    ig:    "@twotravelconcierge",
    igUrl: "https://www.instagram.com/twotravelconcierge/",
    tt:    "@twotravelvip",
    ttUrl: "https://www.tiktok.com/@twotravelvip",
  },
};
const getCitySocial = (city) => {
  const code = String(city || "").trim().toUpperCase();
  return CITY_SOCIAL[code] || CITY_SOCIAL.DEFAULT;
};

/* ═══════════════════════════════════════════════════════════
   PAGE 3: BEFORE YOUR ARRIVAL  +  PRE-TRIP CONTENT
   Merged into one page. Concierge edits pre-trip inline.
═══════════════════════════════════════════════════════════ */
function parsePretripSections(raw) {
  const rawLines = raw.split("\n");
  const sections = [];
  let sec = { heading: "", items: [] };
  const isUrl      = (s) => /^https?:\/\//i.test(s.trim());
  const isLabelUrl = (s) => /^.{1,60}?:\s*https?:\/\//i.test(s.trim());
  const isHeading  = (s) =>
    /^[A-ZÀ-ɏ!].{0,80}$/.test(s.trim()) &&
    !isUrl(s) && !isLabelUrl(s) &&
    s.trim().length <= 80 && !s.trim().includes(".");
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      if (sec.items.length || sec.heading) { sections.push({ ...sec }); sec = { heading: "", items: [] }; }
      continue;
    }
    if (isUrl(line)) sec.items.push({ kind: "link", url: line });
    else if (isLabelUrl(line)) { const m = line.match(/^(.+?):\s*(https?:\/\/.+)$/i); sec.items.push({ kind: "labelLink", label: m[1].trim(), url: m[2].trim() }); }
    else if (!sec.heading && !sec.items.length && isHeading(line)) sec.heading = line;
    else sec.items.push({ kind: "text", text: line });
  }
  if (sec.heading || sec.items.length) sections.push(sec);
  return sections;
}

function WelcomePage({ kickoff, lang, page, total, editMode, localPreTrip, setLocalPreTrip }) {
  const city = kickoff.city || (lang === "es" ? "tu destino" : "your destination");
  const isEs = lang === "es";
  const rawPreTrip = (localPreTrip !== null && localPreTrip !== undefined)
    ? localPreTrip
    : (cl(kickoff.preTripContent || "") || DEFAULT_PRETRIP_PDF);
  const sections = parsePretripSections(rawPreTrip);
  const social = getCitySocial(kickoff.city);

  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="section-eyebrow">{isEs ? "Antes de tu llegada" : "Before Your Arrival"}</div>
      <div className="section-title">
        {isEs ? "Bienvenida" : "Welcome"}
      </div>

      <div className="info-body">
        <div className="info-block">
          <div className="info-h3">{isEs ? "¡Bienvenido!" : "Welcome!"}</div>
          <Editable
            tag="p" className="info-p" editMode={editMode}
            style={{ fontWeight: 600 }}
            value={isEs ? `Bienvenido a ${city} — Two Travel.` : `Welcome to ${city} — Two Travel.`}
          />
          <Editable
            tag="p" className="info-p" editMode={editMode}
            value={isEs
              ? "Por favor revisa esta información antes de tu llegada. Tu concierge está disponible en todo momento para cualquier ajuste, adición o pregunta que tengas."
              : "Please review this information before your arrival. Your concierge is available at any time for any adjustments, additions, or questions you may have."}
          />
        </div>

        <div className="info-block">
          <div className="info-h3">Promo</div>
          <Editable
            tag="p" className="info-p" editMode={editMode}
            value={isEs
              ? "Comparte tu experiencia con Two Travel en Instagram y TikTok y obtén descuento en servicios seleccionados."
              : "Share your experience with Two Travel on Instagram and TikTok and receive a discount on select services."}
          />
          <p className="info-p" style={{ marginBottom: 4, display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "center" }}>
            <span>
              <span style={{ fontSize: 10, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginRight: 4 }}>Instagram</span>
              <a href={social.igUrl} target="_blank" rel="noreferrer"
                style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "underline", fontSize: 12 }}>
                {social.ig}
              </a>
            </span>
            <span>
              <span style={{ fontSize: 10, color: "#9ca3af", letterSpacing: "1.5px", textTransform: "uppercase", marginRight: 4 }}>TikTok</span>
              <a href={social.ttUrl} target="_blank" rel="noreferrer"
                style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "underline", fontSize: 12 }}>
                {social.tt}
              </a>
            </span>
          </p>
          <p className="info-p" style={{ color: "#bbb", fontSize: 10.5 }}>
            {isEs
              ? "La publicación debe realizarse durante tu estadía · Un tag por persona requerido · Para servicios grupales, todos los miembros deben participar."
              : "Tag must be posted during your stay · One tag per person required · For group services, all members must participate."}
          </p>
        </div>

        {kickoff.internalNotes && (
          <div className="info-block">
            <div className="info-h3">{isEs ? "Notas adicionales" : "Additional Notes"}</div>
            <Editable tag="p" className="info-p" editMode={editMode} value={kickoff.internalNotes}/>
          </div>
        )}

        {kickoff.welcomePdfUrl && (
          <div className="info-block">
            <div className="info-h3">{isEs ? "Guía de Bienvenida" : "Welcome Guide"}</div>
            <p className="info-p" style={{ marginBottom: 4 }}>
              {isEs
                ? "Consulta tu guía de bienvenida personalizada con toda la información de tu estadía:"
                : "Access your personalized welcome guide with all the details for your stay:"}
            </p>
            <a
              href={kickoff.welcomePdfUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#1d4ed8", fontWeight: 600, fontSize: 12, textDecoration: "underline", wordBreak: "break-all" }}
            >
              {isEs ? "Ver Guía de Bienvenida →" : "View Welcome Guide →"}
            </a>
          </div>
        )}
      </div>

      <PF n={page} total={total}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EVENT BLOCK — horizontal card
   Left: landscape image  |  Right: all content
═══════════════════════════════════════════════════════════ */
// Categories where price is NEVER shown in the PDF (quoted separately)
const HIDE_PRICE_CATS = new Set(["restaurants","bars","nightlife","beach-clubs","beach clubs","beachclubs"]);

function EventBlock({ it, lang, editMode, onRemove, hasFamilies, patchItem }) {
  const isConfirmed = it.confirmed !== false;
  const showPrice = isConfirmed && (it.priceIsOverride || !HIDE_PRICE_CATS.has(String(it.category || "").trim().toLowerCase()));
  const price    = showPrice ? fmtPrice(it.price) : "";
  const hiList   = splitList(it.highlights);
  const incList  = splitList(it.includes);
  const isEs     = lang === "es";

  // Build meta string: "7:00 PM · 2 hrs · Colombia Standard Time"
  const timePart = it.time || "";
  const durPart  = it.duration || "";
  const tzPart   = isEs ? "Hora de Colombia" : "Colombia Standard Time";
  const metaParts = [timePart, durPart, tzPart].filter(Boolean);

  return (
    <div className={`ev${isConfirmed ? "" : " ev-recommendation"}`} style={{ position: "relative" }}>
      {/* ── Remove button (edit mode only) ── */}
      {editMode && onRemove && (
        <button
          onClick={onRemove}
          className="no-print"
          title="Remove this service"
          style={{
            position: "absolute", top: 8, right: 8, zIndex: 10,
            background: "#ef4444", color: "#fff", border: "none",
            borderRadius: "50%", width: 22, height: 22,
            fontSize: 13, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            lineHeight: 1, boxShadow: "0 1px 4px rgba(0,0,0,.25)",
          }}
        >×</button>
      )}
      {/* ── Left: image ── */}
      {it.image ? (
        <div className="ev-img-col">
          <img
            src={it.image}
            alt={it.title}
            onError={e => { e.target.parentNode.className = "ev-img-none"; e.target.remove(); }}
          />
        </div>
      ) : (
        <div className="ev-img-none">
          <span className="ev-img-none-icon">✦</span>
        </div>
      )}

      {/* ── Right: content ── */}
      <div className="ev-content">

        {/* Time badge — always visible when set */}
        {timePart && (
          <div className="ev-time-badge">
            {editMode
              ? <Editable value={timePart} editMode={editMode} onChange={v => patchItem?.("time", v)} />
              : timePart}
            {durPart && <span className="ev-time-dur"> · {durPart}</span>}
          </div>
        )}

        {/* Recommendation badge */}
        {!isConfirmed && (
          <div className="ev-rec-badge">
            📌 {isEs ? "Recomendación" : "Recommendation"}
          </div>
        )}

        {/* Title + price */}
        <div className="ev-title-row">
          <Editable value={it.title} tag="div" className="ev-title" editMode={editMode} onChange={v => patchItem?.("title", v)} />
          {(price || it.priceTiers) && (
            <div className="ev-price-col">
              <span className="ev-price-label">{isEs ? "Precio" : "Price"}</span>
              {price && <Editable value={price} tag="div" className="ev-price-val" editMode={editMode} onChange={v => patchItem?.("price", v)} />}
              {(() => {
                const unit = String(it.priceUnit || "").toLowerCase();
                const isPerPerson  = unit.includes("person");
                const isPerVehicle = unit.includes("vehicle") || unit.includes("vehículo") || unit.includes("vehiculo");
                if (!price) return null;
                if (isPerVehicle) {
                  return (
                    <div style={{fontSize:8,color:"#9ca3af",letterSpacing:"0.4px",textTransform:"uppercase",marginTop:2}}>
                      {isEs ? "por vehículo" : "per vehicle"}
                    </div>
                  );
                }
                if (isPerPerson) {
                  const pax = it.pax || 0;
                  const unitNum = Number(String(it.price || "").replace(/\D/g, ""));
                  const paxNum = pax || 1;
                  if (!unitNum || paxNum <= 1) return (
                    <div style={{fontSize:8,color:"#9ca3af",letterSpacing:"0.4px",textTransform:"uppercase",marginTop:2}}>
                      {isEs ? "por persona" : "per person"}
                    </div>
                  );
                  const total = new Intl.NumberFormat("es-CO").format(unitNum * paxNum);
                  return (
                    <div style={{fontSize:8,color:"#9ca3af",letterSpacing:"0.4px",textTransform:"uppercase",marginTop:2}}>
                      {isEs ? "por persona" : "per person"} · ×{paxNum} = <span style={{color:"#6b7280",fontWeight:600}}>${total}</span>
                    </div>
                  );
                }
                return null;
              })()}
              {it.tierQuantities?.length > 0 && it.tierQuantities.some(t => t.qty > 0) ? (
                <div className="ev-price-tiers">
                  {it.tierQuantities.filter(t => t.qty > 0).map((t, i) => (
                    <div key={i}>{t.qty}× {t.label}{t.price ? ` — $${(t.price * t.qty).toLocaleString("es-CO")}` : ""}</div>
                  ))}
                  {it.tierTotal > 0 && <div style={{fontWeight:600, marginTop:2}}>Total: ${it.tierTotal.toLocaleString("es-CO")} COP</div>}
                </div>
              ) : it.priceTiers ? (
                <Editable value={it.priceTiers} tag="div" className="ev-price-tiers" editMode={editMode} onChange={v => patchItem?.("priceTiers", v)} />
              ) : null}
              {it.confirmation && (
                <div style={{fontSize:8,color:"#9ca3af",marginTop:4,letterSpacing:"0.3px",fontStyle:"italic"}}>
                  {isEs ? "Confirmado por" : "Confirmed by"} {it.confirmation}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmation (when no price shown) */}
        {it.confirmation && !price && !it.priceTiers && (
          <div style={{fontSize:8,color:"#9ca3af",marginBottom:4,letterSpacing:"0.3px",fontStyle:"italic"}}>
            {isEs ? "Confirmado por" : "Confirmed by"} {it.confirmation}
          </div>
        )}

        {/* Location subtitle */}
        {it.location && (
          <Editable value={it.location} tag="div" className="ev-location" editMode={editMode} onChange={v => patchItem?.("location", v)} />
        )}

        {/* Family Friendly badge — only when the group actually has families/kids */}
        {it.familyFriendly && hasFamilies && (
          <span className="ev-ff">
            <span>👨‍👩‍👧</span>
            {isEs ? "Apto para familias" : "Family Friendly"}
          </span>
        )}

        {/* Links: menu + map */}
        {(it.menuUrl || it.mapsUrl) && (
          <div className="ev-links">
            {it.menuUrl && (
              <a href={it.menuUrl} className="ev-link" target="_blank" rel="noreferrer">
                {isEs ? "Ver menú →" : "View Menu →"}
              </a>
            )}
            {it.mapsUrl && (
              <a href={it.mapsUrl} className="ev-link" target="_blank" rel="noreferrer">
                {isEs ? "Ver mapa →" : "View on Map →"}
              </a>
            )}
          </div>
        )}

        {/* Description */}
        {it.description && (
          <Editable value={it.description} tag="p" className="ev-desc" editMode={editMode} onChange={v => patchItem?.("description", v)} />
        )}

        {/* Highlights */}
        {hiList.length > 0 && (
          <div className="ev-list-block">
            <div className="ev-list-label">
              {isEs ? "Destacados" : "Highlights"}
            </div>
            {hiList.map((h, i) => (
              <Editable key={i} value={h} tag="div" className="ev-list-item" editMode={editMode} />
            ))}
          </div>
        )}

        {/* Includes */}
        {incList.length > 0 && (
          <div className="ev-list-block">
            <div className="ev-list-label">
              {isEs ? "Incluye" : "Includes"}
            </div>
            {incList.map((h, i) => (
              <Editable key={i} value={h} tag="div" className="ev-list-item" editMode={editMode} />
            ))}
          </div>
        )}

        {/* Concierge notes for this service */}
        {it.notes && (
          <div style={{ fontSize:11, color:"#6b7280", fontStyle:"italic", marginBottom:8, background:"#f9fafb", borderLeft:"3px solid #e5e7eb", paddingLeft:8, paddingTop:4, paddingBottom:4, borderRadius:"0 4px 4px 0" }}>
            📌 {it.notes}
          </div>
        )}

        {/* Schedule (catalog hours, no label) */}
        {it.schedule && (
          <div className="ev-terms">
            <Editable value={it.schedule} editMode={editMode} />
          </div>
        )}

        {/* Deposit */}
        {it.deposit && (
          <Editable value={it.deposit} tag="div" className="ev-terms" editMode={editMode} />
        )}

        {/* Cancellation */}
        {it.cancellation && (
          <div className="ev-terms">
            <b>{isEs ? "Cancelación: " : "Cancellation: "}</b>
            <Editable value={it.cancellation} editMode={editMode} />
          </div>
        )}

        {/* Dress code */}
        {it.dressCode && (
          <div className="ev-terms">
            <b>{isEs ? "Vestimenta: " : "Dress code: "}</b>
            <Editable value={it.dressCode} editMode={editMode} />
          </div>
        )}

        {/* Footer: address + QB (map link removed — already shown above as "View on Map →") */}
        <div className="ev-footer">
          {it.address && (
            <span>{it.address}</span>
          )}
          {it.qbCode && isConfirmed && !HIDE_PRICE_CATS.has(it.category) && (
            <div className="ev-qb">
              [{it.qbCode}][{cleanBrackets(it.title)}][{it.priceUsd || num(it.price) || "0"}]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CATALOG PICKER MODAL — shown when "+ Add service block" is clicked in edit mode
   Lets the concierge search and pick a service from the loaded catalog.
═══════════════════════════════════════════════════════════ */
function CatalogPicker({ catalog, lang, onSelect, onClose }) {
  const [q, setQ] = useState("");
  const isEs = lang === "es";

  const filtered = catalog
    .filter((s) => {
      if (!q.trim()) return true;
      const lq = q.toLowerCase();
      return (
        (s.name || "").toLowerCase().includes(lq) ||
        (s.category || "").toLowerCase().includes(lq) ||
        (s.location || "").toLowerCase().includes(lq)
      );
    })
    .slice(0, 80); // cap at 80 results

  return (
    <div
      className="no-print"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 12, width: 520, maxHeight: "80vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 8px 40px rgba(0,0,0,.25)", overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>
              {isEs ? "Agregar servicio" : "Add service"}
            </span>
            <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "#999" }}>×</button>
          </div>
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={isEs ? "Buscar servicio, categoría, lugar…" : "Search service, category, location…"}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 13,
              border: "1px solid #e0e0e0", borderRadius: 8, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 24, color: "#aaa", textAlign: "center", fontSize: 13 }}>
              {isEs ? "Sin resultados" : "No results"}
            </div>
          )}
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => { onSelect(s); onClose(); }}
              style={{
                display: "flex", gap: 12, alignItems: "center",
                padding: "10px 20px", cursor: "pointer", borderBottom: "1px solid #f8f8f8",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9f9f9"}
              onMouseLeave={e => e.currentTarget.style.background = ""}
            >
              {s.image ? (
                <img
                  src={s.image} alt={s.name}
                  style={{ width: 48, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0, background: "#eee" }}
                  onError={e => { e.target.style.display = "none"; }}
                />
              ) : (
                <div style={{ width: 48, height: 36, borderRadius: 6, background: "#f0f0f0", flexShrink: 0 }}/>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {s.category}{s.location ? ` · ${s.location}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   QB BILLING BLOCK
   Rendered at the bottom of the LAST day page.
   Small gray monospace text — readable by Slack/PDF bot,
   subtle enough not to distract the client.
═══════════════════════════════════════════════════════════ */
function BillingBlock({ kickoff }) {
  const k = kickoff;
  if (!k.guestName && !k.guestContact && !k.email) return null;

  return (
    <div className="qb-billing-block" style={{ marginBottom: 12 }}>
      <div className="qb-billing-label">billing data</div>
      <div className="qb-billing-line">
        {`[1A][${cleanBrackets(k.guestName || "")}]`}
      </div>
      <div className="qb-billing-line">
        {`[2A][${cleanBrackets(k.email || k.guestEmail || k.guestContact || "")}]`}
      </div>
      <div className="qb-billing-line">
        {`[3A][${formatIsoDate(k.arrivalDate || "")}]`}
      </div>
      <div className="qb-billing-line">
        {`[4A][${formatIsoDate(k.departureDate || "")}]`}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CITY GUIDE DATA
═══════════════════════════════════════════════════════════ */
const CITY_GUIDE_SECTIONS = [
  {
    id: "dining",
    icon: "🍽️",
    title: "Dining & Food",
    items: [
      { id: "brunch", icon: "☀️", label: "Brunch Spots", desc: "Perfect for a relaxed late morning or early afternoon.", url: "https://maps.app.goo.gl/XqbGsW5f3Gb6Bw8GA" },
      { id: "coffee", icon: "☕", label: "Coffee Shops", desc: "Great for a quick pick-me-up or a casual meet-up.", url: "https://maps.app.goo.gl/8Sk2eyN5PyKCNAcw5" },
      { id: "dinner_walled", icon: "🍷", label: "Dinner – Walled City", desc: "Our top picks for dinner in Cartagena's historic center.", url: "https://maps.app.goo.gl/RpoHDyNRMcyXjyPC6" },
      { id: "casual_walled", icon: "🥗", label: "Casual Dining – Walled City", desc: "More laid-back options for an easy meal.", url: "https://maps.app.goo.gl/8D1oCLWroj5mXCvx7" },
      { id: "getsemani", icon: "🌮", label: "Restaurants in Getsemani", desc: "Trendy, local, and vibrant dining options.", url: "https://maps.app.goo.gl/pXCVbUS64qXw7DMs5" },
      { id: "latenight", icon: "🌙", label: "Late-Night Eats", desc: "Ideal for post-party bites or late cravings.", url: "https://maps.app.goo.gl/4eycD4YFt4nGEqn58" },
    ],
  },
  {
    id: "nightlife",
    icon: "🎭",
    title: "Nightlife & Entertainment",
    items: [
      { id: "rooftops", icon: "🌅", label: "Rooftops", desc: "Best spots for sunset views and cocktails.", url: "https://maps.app.goo.gl/ke3S9xDyKqfAsUky6" },
      { id: "bars", icon: "🍸", label: "Bars & Bar Hopping", desc: "From chill drinks to lively atmospheres — perfect for a bar crawl.", url: "https://maps.app.goo.gl/KAGw1LQBvhWb65XP8" },
      { id: "nightclubs", icon: "🎉", label: "Nightclubs", desc: "Where to go for a proper night out.", url: "https://maps.app.goo.gl/QDZTGL5sH2tWaxzb6" },
      { id: "gentlemens", icon: "🎩", label: "Gentleman's Clubs", desc: "Curated options for adult nightlife experiences.", url: "https://maps.app.goo.gl/34CwoubwzfiyMr9G8" },
    ],
  },
  {
    id: "beach",
    icon: "🏖️",
    title: "Beach & Day Experiences",
    items: [
      { id: "beach_clubs", icon: "🏖️", label: "Beach Clubs", desc: "The best spots for a day by the water.", url: "https://maps.app.goo.gl/n5Vqe4547qqJUBGSA" },
    ],
  },
  {
    id: "shopping",
    icon: "🛍️",
    title: "Shopping & Lifestyle",
    items: [
      { id: "shopping", icon: "🛍️", label: "Shopping & Souvenirs", desc: "Local boutiques, gifts, and artisan finds.", url: "https://maps.app.goo.gl/HJ3iWCeDoAinNv2L8" },
      { id: "cigars", icon: "🚬", label: "Cigar Shops & Lounges", desc: "Premium cigars and relaxed atmospheres.", url: "https://maps.app.goo.gl/SCAChpWjLppZYfd76" },
      { id: "hair", icon: "✂️", label: "Hair & Barber Shops", desc: "Trusted spots for grooming and quick touch-ups.", url: "https://maps.app.goo.gl/EBF2W9acSgh4aaxaA" },
    ],
  },
  {
    id: "essentials",
    icon: "⚙️",
    title: "Essentials & Services",
    items: [
      { id: "atms", icon: "💳", label: "ATMs", desc: "Convenient locations to withdraw cash.", url: "https://maps.app.goo.gl/H2f4SgGZki4zLhh38" },
      { id: "pharmacies", icon: "💊", label: "24/7 Pharmacies", desc: "For any last-minute needs.", url: "https://maps.app.goo.gl/2snjVdKhHcnpEhJA6" },
      { id: "emergency", icon: "🏥", label: "Hospitals & Police Stations", desc: "Nearby emergency services for peace of mind.", url: "https://maps.app.goo.gl/8yomj1ZFQWF7JuoT6" },
    ],
  },
];

const DEFAULT_CITY_GUIDE_INTRO =
  "A curated collection of additional spots across the city — from hidden culinary gems and vibrant nightlife to essential services. Use these recommendations as your personal guide to explore Cartagena beyond your itinerary.";

function CityGuidePage({ kickoff, cityGuideHidden, cityGuideIntro, onIntroChange, page, total, lang, editMode, onToggleHidden }) {
  const hidden = (cityGuideHidden || "").split(",").map(s => s.trim()).filter(Boolean);
  const intro = cityGuideIntro || DEFAULT_CITY_GUIDE_INTRO;
  const cityName = kickoff.cityName || "Cartagena";

  return (
    <div className="page" style={{ position: "relative", background: "#fefcf8", fontFamily: "Georgia, 'Times New Roman', serif" }}>

      {/* ── Top rule ── */}
      <div style={{ height: 4, background: "#1c1917" }} />

      {/* ── Header block ── */}
      <div style={{ padding: "24px 44px 18px", borderBottom: "1px solid #e5e0d8", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
        <div>
          <div style={{ fontSize: 8, letterSpacing: "0.3em", textTransform: "uppercase", color: "#9a7a4a", fontFamily: "system-ui,sans-serif", marginBottom: 5, fontWeight: 600 }}>
            {lang === "en" ? "Curated City Guide" : "Guía de Ciudad"}
          </div>
          <div style={{ fontSize: 34, fontWeight: 400, color: "#1c1917", letterSpacing: "-.01em", lineHeight: 1, fontStyle: "italic" }}>
            {cityName}
          </div>
        </div>
        <div style={{ fontSize: 10.5, color: "#7a6a55", lineHeight: 1.7, maxWidth: 300, textAlign: "right", fontFamily: "system-ui,sans-serif" }}>
          <Editable tag="span" editMode={editMode} value={intro} onChange={onIntroChange} />
        </div>
      </div>

      {/* ── Two columns ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, padding: "0 44px" }}>
        {CITY_GUIDE_SECTIONS.map((section, si) => {
          const visibleItems = section.items.filter(item => !hidden.includes(item.id));
          if (visibleItems.length === 0 && !editMode) return null;
          return (
            <div key={section.id} style={{
              padding: "16px 0",
              paddingRight: si % 2 === 0 ? 28 : 0,
              paddingLeft: si % 2 === 1 ? 28 : 0,
              borderBottom: "1px solid #e5e0d8",
              borderRight: si % 2 === 0 ? "1px solid #e5e0d8" : "none",
            }}>
              {/* Category label */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 13 }}>{section.icon}</span>
                <span style={{
                  fontSize: 8.5, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: ".18em", color: "#1c1917",
                  fontFamily: "system-ui,sans-serif",
                }}>
                  {section.title}
                </span>
                <div style={{ flex: 1, height: 1, background: "#d6cfc4" }} />
              </div>

              {/* Items */}
              {section.items.map(item => {
                const isHidden = hidden.includes(item.id);
                if (isHidden && !editMode) return null;
                return (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "baseline", justifyContent: "space-between",
                    gap: 6, marginBottom: 8, opacity: isHidden ? 0.25 : 1,
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 7, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 11, flexShrink: 0 }}>{item.icon || "→"}</span>
                      <div style={{ flex: 1 }}>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12, fontWeight: 600, color: "#1c1917",
                            textDecoration: "none", fontFamily: "system-ui,sans-serif",
                            borderBottom: "1px solid #c8b99a",
                            paddingBottom: "0px",
                          }}
                        >
                          {item.label}
                        </a>
                        <div style={{ fontSize: 9.5, color: "#9a8a78", lineHeight: 1.4, marginTop: 1, fontFamily: "system-ui,sans-serif" }}>
                          {item.desc}
                        </div>
                      </div>
                    </div>
                    {editMode && (
                      <button
                        onClick={() => onToggleHidden && onToggleHidden(item.id)}
                        className="no-print"
                        style={{
                          fontSize: 8, padding: "1px 5px", borderRadius: 3, cursor: "pointer",
                          background: isHidden ? "#fee2e2" : "#f0fdf4",
                          color: isHidden ? "#b91c1c" : "#166534",
                          border: isHidden ? "1px solid #fca5a5" : "1px solid #86efac",
                          flexShrink: 0, fontFamily: "system-ui,sans-serif",
                        }}
                      >
                        {isHidden ? "Show" : "Hide"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Bottom note ── */}
      <div style={{ padding: "12px 44px", borderTop: "1px solid #e5e0d8", fontSize: 9, color: "#b5a898", fontFamily: "system-ui,sans-serif", fontStyle: "italic" }}>
        All recommendations are personally curated by the Two Travel team.
      </div>

      <div style={{ height: 3, background: "#1c1917", marginTop: "auto" }} />

      <PF n={page} total={total} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   KEEP IN TOUCH PAGE
═══════════════════════════════════════════════════════════ */
function KeepInTouchPage({ kickoff, page, total }) {
  const SOCIAL = [
    {
      label: "Instagram",
      handle: "@twotravelconcierge",
      url: "https://www.instagram.com/twotravelconcierge",
      color: "#e1306c",
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#e1306c"/>
          <path d="M12 7.5A4.5 4.5 0 1 0 12 16.5 4.5 4.5 0 0 0 12 7.5zm0 7.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm4.5-8.25a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25z" fill="#fff"/>
          <rect x="4" y="4" width="16" height="16" rx="5" stroke="white" strokeWidth="1.5" fill="none"/>
        </svg>
      ),
    },
    {
      label: "Facebook",
      handle: "Two Travel",
      url: "https://www.facebook.com/twotravelconcierge",
      color: "#1877f2",
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#1877f2"/>
          <path d="M13.5 8.5h2v-2.5h-2c-1.93 0-3.5 1.57-3.5 3.5v1.5h-2v2.5h2v6h2.5v-6h2l.5-2.5h-2.5V9.5c0-.55.45-1 1-1z" fill="#fff"/>
        </svg>
      ),
    },
    {
      label: "TikTok",
      handle: "@twotravelvip",
      url: "https://www.tiktok.com/@twotravelvip",
      color: "#000",
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#000"/>
          <path d="M17 7.5c-.7-.5-1.2-1.2-1.4-2H13v9.3c0 .7-.5 1.2-1.2 1.2s-1.2-.5-1.2-1.2.5-1.2 1.2-1.2c.1 0 .2 0 .3.1V11c-.1 0-.2 0-.3 0-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6 3.6-1.6 3.6-3.6V9.9c.7.5 1.5.7 2.3.7V8.1c-.5 0-.9-.1-1.3-.3-.1-.1-.2-.1-.4-.3z" fill="#fff"/>
        </svg>
      ),
    },
  ];

  const REVIEWS = [
    {
      label: "Google Review",
      sub: "Share your experience on Google",
      url: "https://g.page/r/your-google-review-link/review",
      color: "#4285f4",
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#fff" stroke="#e5e7eb"/>
          <path d="M12 5.5c1.7 0 3.1.6 4.2 1.6l-1.8 1.8c-.7-.6-1.5-1-2.4-1-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6c1.6 0 2.8-.9 3.3-2.1H12V10.5h5.7c.1.4.1.8.1 1.2 0 3.2-2.1 5.4-5.8 5.4C8.5 17.1 5.9 14.5 5.9 11.5S8.5 5.5 12 5.5z" fill="#4285f4"/>
        </svg>
      ),
    },
    {
      label: "Tripadvisor",
      sub: "Review us on Tripadvisor",
      url: "https://www.tripadvisor.com/UserReviewEdit-g297476-d17750092",
      color: "#34e0a1",
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="24" height="24" rx="6" fill="#34e0a1"/>
          <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#000">TA</text>
        </svg>
      ),
    },
  ];

  return (
    <div className="page" style={{ position: "relative", background: "#fff" }}>
      <PH kickoff={kickoff} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 40px", textAlign: "center" }}>
        {/* Title */}
        <div style={{ fontSize: 26, fontWeight: 900, color: "#111", letterSpacing: "-.01em", marginBottom: 8 }}>
          Let's keep in touch!
        </div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7, maxWidth: 480, margin: "0 auto 32px" }}>
          We hope you enjoyed your holiday and that we helped make it unforgettable.<br/>
          Stay connected with us — we'd love to be part of your next adventure.
        </div>

        {/* Follow us */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#92400e", marginBottom: 16 }}>
          Follow Us
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, marginBottom: 36 }}>
          {SOCIAL.map(s => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
            >
              {s.icon}
              <div style={{ fontSize: 11, fontWeight: 700, color: "#111", textAlign: "center" }}>{s.label}</div>
              <div style={{ fontSize: 10, color: "#777", textAlign: "center" }}>{s.handle}</div>
            </a>
          ))}
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1.5px solid #f3e8d8", maxWidth: 360, margin: "0 auto 28px" }} />

        {/* Leave a review */}
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "#92400e", marginBottom: 6 }}>
          Leave Us a Review
        </div>
        <div style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>
          Your feedback means the world to us. Help other travelers discover Two Travel!
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 28 }}>
          {REVIEWS.map(r => (
            <a
              key={r.label}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              style={{
                textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                background: "#fafafa", border: "1.5px solid #f3e8d8", borderRadius: 12, padding: "16px 24px",
              }}
            >
              {r.icon}
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111" }}>{r.label}</div>
              <div style={{ fontSize: 10, color: "#888", maxWidth: 120, textAlign: "center" }}>{r.sub}</div>
            </a>
          ))}
        </div>

        {/* Tagline */}
        <div style={{ marginTop: 40, fontSize: 11, color: "#bbb", letterSpacing: ".03em" }}>
          twotravelvip.com · @twotravelconcierge
        </div>
      </div>

      <PF n={page} total={total} />
    </div>
  );
}

function BillingPage({ kickoff }) {
  return (
    <div className="page" style={{ position: "relative" }}>
      <PH kickoff={kickoff} />
      <div style={{ padding: "32px 40px 24px" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#999", marginBottom: 6 }}>
          Internal · QuickBooks
        </div>
        <BillingBlock kickoff={kickoff} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DAY PAGE
═══════════════════════════════════════════════════════════ */
function DayPage({ kickoff, day, page, total, lang, editMode, onRemoveDay, onRemoveItem, onAddItem, billingBlock, hasFamilies, patchDay, patchItemFn }) {
  return (
    <div className="page" style={{ position: "relative" }}>
      <PH kickoff={kickoff}/>

      {/* Day band — with remove-day button in edit mode */}
      <div className="day-band" style={{ position: "relative" }}>
        <div className="day-band-inner">
          <div className="day-band-row">
            <span className="day-band-sup">{lang === "es" ? "Día" : "Day"}</span>
            <Editable value={day.label} tag="span" className="day-band-label" editMode={editMode} onChange={v => patchDay?.("label", v)}/>
          </div>
          {day.title && (
            <Editable value={day.title} tag="div" className="day-band-title" editMode={editMode} onChange={v => patchDay?.("title", v)}/>
          )}
        </div>
        {editMode && onRemoveDay && (
          <button
            onClick={onRemoveDay}
            className="no-print"
            title="Remove this entire day"
            style={{
              background: "#ef4444", color: "#fff", border: "none",
              borderRadius: 6, padding: "4px 10px", fontSize: 11,
              fontWeight: 700, cursor: "pointer", flexShrink: 0,
              marginLeft: 12,
            }}
          >✕ Remove day</button>
        )}
      </div>

      <div style={{ flex: 1 }}>
        {day.items.map((it, i) => it.isBlock
          ? (
            <div key={i} style={{ margin: "10px 0", position: "relative", display:"flex", borderBottom:"1px solid #f0f0f0" }}>
              <div style={{ width:"40%", flexShrink:0, background:"linear-gradient(145deg,#f5f5f5 0%,#ebebeb 100%)", display:"flex", alignItems:"center", justifyContent:"center", minHeight:80 }}>
                <span style={{ fontSize:24, opacity:.15 }}>✦</span>
              </div>
              <div style={{ flex:1, padding:"18px 28px" }}>
                {editMode && onRemoveItem && (
                  <button onClick={() => onRemoveItem(i)} style={{position:"absolute",top:8,right:8,border:"none",background:"none",cursor:"pointer",color:"#9ca3af",fontSize:11,zIndex:2}}>✕</button>
                )}
                <div dangerouslySetInnerHTML={{ __html: it.cartItem.html }} style={{ fontSize: 13, color: "#111827", lineHeight: 1.6 }} />
              </div>
            </div>
          ) : (
            <EventBlock
              key={i}
              it={it}
              lang={lang}
              editMode={editMode}
              hasFamilies={hasFamilies}
              onRemove={onRemoveItem ? () => onRemoveItem(i) : undefined}
              patchItem={patchItemFn ? (field, val) => patchItemFn(i, field, val) : undefined}
            />
          )
        )}

        {/* Add service button (edit mode only) */}
        {editMode && onAddItem && (
          <div className="no-print" style={{
            padding: "12px 40px", borderTop: "1px dashed #e0e0e0",
          }}>
            <button
              onClick={onAddItem}
              style={{
                background: "#f0f9ff", color: "#1d4ed8", border: "1px dashed #93c5fd",
                borderRadius: 6, padding: "6px 14px", fontSize: 11,
                fontWeight: 600, cursor: "pointer",
              }}
            >+ Add service block</button>
          </div>
        )}
      </div>

      {/* Billing data block — only on last day page */}
      {billingBlock}

      <PF n={page} total={total}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function ItineraryPrintView() {
  const params    = new URLSearchParams(window.location.search);
  const kickoffId   = params.get("kickoffId");
  const lang        = params.get("lang") === "es" ? "es" : "en";
  // Edit mode ONLY when concierge explicitly adds ?edit=1 — client link never has this
  const canEdit     = params.get("edit") === "1";

  const [kickoff,   setKickoff]   = useState(null);
  const [catalog,   setCatalog]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [editMode,  setEditMode]  = useState(canEdit);
  // Mutable deep-copy of days used during edit mode (add/remove days & items)
  const [editDays,  setEditDays]  = useState(null);
  // Catalog picker: { dayIndex } when open, null when closed
  const [pickerForDay, setPickerForDay] = useState(null);
  const [localPreTrip, setLocalPreTrip] = useState(null);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [pdfNotes, setPdfNotes] = useState("");
  const [cityGuideHidden, setCityGuideHidden] = useState("");
  const [cityGuideIntro, setCityGuideIntro] = useState("");

  // Sync editDays from computed days (or itinerarySnapshot) when editMode is active and data is loaded
  useEffect(() => {
    if (!editMode || !kickoff) return;
    let base = days;
    if (kickoff?.itinerarySnapshot) {
      try { base = JSON.parse(kickoff.itinerarySnapshot); } catch {}
    }
    setEditDays(JSON.parse(JSON.stringify(base)));
    setLocalPreTrip(null);
    setPdfNotes(kickoff?.pdfNotes || "");
    setCityGuideHidden(kickoff?.cityGuideHidden || "");
    setCityGuideIntro(kickoff?.cityGuideIntro || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, kickoff]);

  /* ── Edit-mode mutation helpers ── */
  const removeDay = (di) =>
    setEditDays(prev => prev.filter((_, i) => i !== di));

  const removeItem = (di, ii) =>
    setEditDays(prev => prev.map((day, i) =>
      i !== di ? day : { ...day, items: day.items.filter((_, j) => j !== ii) }
    ));

  const patchDay = (di, field, val) =>
    setEditDays(prev => prev.map((day, i) =>
      i !== di ? day : { ...day, [field]: val }
    ));

  const patchItem = (di, ii, field, val) =>
    setEditDays(prev => prev.map((day, i) =>
      i !== di ? day : {
        ...day,
        items: day.items.map((it, j) => j !== ii ? it : { ...it, [field]: val }),
      }
    ));

  const saveSnapshot = async () => {
    if (!kickoffId || !editDays) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateKickoffInSheet(kickoffId, {
        itinerarySnapshot: JSON.stringify(editDays),
        pdfNotes: pdfNotes.trim(),
        cityGuideHidden: cityGuideHidden,
        cityGuideIntro: cityGuideIntro.trim(),
        itineraryUpdatedAt: now,
      });
      const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setSavedAt(ts);
      setKickoff(prev => ({
        ...prev,
        itinerarySnapshot: JSON.stringify(editDays),
        pdfNotes: pdfNotes.trim(),
        cityGuideHidden: cityGuideHidden,
        cityGuideIntro: cityGuideIntro.trim(),
        itineraryUpdatedAt: now,
      }));
    } finally {
      setSaving(false);
    }
  };

  // Open catalog picker for a specific day
  const openPickerForDay = (di) => setPickerForDay(di);

  // Called when user selects a service from the picker modal
  const addServiceFromCatalog = (di, svc) => {
    const desc = lang === "es"
      ? (svc.description?.es || svc.descriptionEs || svc.description?.en || "")
      : (svc.description?.en || svc.descriptionEn || svc.description?.es || "");
    setEditDays(prev => prev.map((day, i) =>
      i !== di ? day : {
        ...day,
        items: [...day.items, {
          time:         svc.schedule || "",
          duration:     svc.duration || "",
          title:        svc.name || "",
          description:  desc,
          highlights:   Array.isArray(svc.highlights) ? svc.highlights : [],
          includes:     svc.includes || "",
          location:     svc.location || "",
          address:      svc.address || "",
          city:         svc.city || "",
          price:        svc.price_cop || svc.priceCop || "",
          priceUsd:     num(svc.price_tier_1 || svc.priceTier1 || 0),
          priceUnit:    svc.priceUnit || "",
          deposit:      svc.deposit || "",
          cancellation: svc.cancellation || "",
          menuUrl:      svc.menuUrl || "",
          mapsUrl:      svc.mapsUrl || "",
          image:        svc.image || "",
          qbCode:       svc.quickbooksCode || "",
          category:     svc.category || "",
          familyFriendly: !!(svc.family_friendly),
          confirmed:    true,
          sort:         day.items.length,
        }]
      }
    ));
  };

  const addBlankDay = () =>
    setEditDays(prev => {
      const base = prev || days;
      return [...base, {
        label: lang === "es" ? `Día ${base.length + 1}` : `Day ${base.length + 1}`,
        title: "",
        items: [],
      }];
    });

  useEffect(() => {
    if (!kickoffId) { setError("No kickoffId in URL"); setLoading(false); return; }
    Promise.all([
      fetchKickoffsFromSheet({ forceRefresh: true }).then(list =>
        list.find(k => String(k.id) === String(kickoffId))
      ),
      fetchServicesFromSheet(),
    ])
      .then(([k, cats]) => {
        if (!k) throw new Error("Kickoff not found");
        setKickoff(k);
        setCatalog(cats);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [kickoffId]);

  const days = useMemo(() => {
    if (!kickoff) return [];
    const cartRaw = kickoff.cart;
    const matched = matchCart(cartRaw, catalog);
    const result = buildDays(matched, lang, parseJsonField(kickoff.dayMeta), kickoff.city);
    return result;
  }, [kickoff, catalog, lang]);

  // Detect families/kids in group (show Family Friendly badge only then)
  const hasFamilies = useMemo(() => {
    if (!kickoff) return false;
    try {
      const q = JSON.parse(kickoff.quizAnswers || "null");
      if (q?.kids === "yes") return true;
      if ((q?.vibes || []).includes("family")) return true;
    } catch {}
    // Also check groupType or any explicit field
    const gt = String(kickoff.groupType || "").toLowerCase();
    return gt.includes("famil") || gt.includes("kids") || gt.includes("child");
  }, [kickoff]);

  // First available service image → cover hero
  const heroImage = useMemo(() => {
    for (const day of days) {
      for (const it of day.items) {
        if (it.image) return it.image;
      }
    }
    return "";
  }, [days]);

  /* ── Loading ── */
  if (loading) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "sans-serif",
      color: "#999", flexDirection: "column", gap: 12,
    }}>
      <div style={{
        width: 24, height: 24, border: "2px solid #eee",
        borderTopColor: "#333", borderRadius: "50%",
        animation: "spin .7s linear infinite",
      }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontSize: 12 }}>Building itinerary…</p>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "sans-serif",
      color: "#c00", fontSize: 13,
    }}>
      {error}
    </div>
  );

  if (!kickoff) return null;

  // Use editDays when in edit mode (allows add/remove), fallback to computed days
  const activeDays = (editMode && editDays) ? editDays : days;

  const hasPreTrip = true; // always shown — falls back to DEFAULT_PRETRIP_PDF when empty
  const hasSummary = activeDays.length > 0;
  const total = 1 + (hasSummary ? 1 : 0) + 1 + activeDays.length + (pdfNotes.trim() ? 1 : 0) + 1 + 1 + 1; // +billing +cityguide +keepintouch
  let pageNum = 1;

  const ctrl = {
    padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
    fontFamily: "system-ui,sans-serif",
  };

  return (
    <div className="root" style={{ padding: "28px 16px 60px", minHeight: "100vh" }}>
      <style>{CSS}</style>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <div className="edit-mode-bar no-print">
          <span>
            <b>✏️ Edit mode</b>
            {" "}— click any text field to edit. Changes print as-is.
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {savedAt && <span style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>Guardado {savedAt}</span>}
            <button
              onClick={saveSnapshot}
              disabled={saving}
              style={{ ...ctrl, background: saving ? "rgba(255,255,255,.2)" : "#22c55e", color: "#fff", border: "none", fontWeight: 700, opacity: saving ? .7 : 1 }}>
              {saving ? "Guardando…" : "💾 Guardar"}
            </button>
            <button onClick={() => setEditMode(false)}
              style={{ ...ctrl, background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.35)" }}>
              ✓ Done
            </button>
            <button onClick={() => window.print()}
              style={{ ...ctrl, background: "#fff", color: "#1d4ed8", border: "none", fontWeight: 700 }}>
              ↓ PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Floating toolbar ── */}
      <div className="no-print" style={{
        position: "fixed", top: editMode ? 48 : 14, right: 14, zIndex: 100,
        display: "flex", gap: 8, alignItems: "center",
        transition: "top .2s",
      }}>
        <a href={`?mode=itinerary&kickoffId=${kickoffId}&lang=${lang === "en" ? "es" : "en"}`}
          style={{ ...ctrl, border: "1px solid #ddd", color: "#555", background: "#fff",
            textDecoration: "none", boxShadow: "0 1px 4px rgba(0,0,0,.08)" }}>
          {lang === "en" ? "🇨🇴 ES" : "🇺🇸 EN"}
        </a>
        {canEdit && (
          <button onClick={() => setEditMode(v => !v)}
            style={{ ...ctrl,
              background: editMode ? "#1d4ed8" : "#fff",
              color: editMode ? "#fff" : "#333",
              border: editMode ? "none" : "1px solid #ddd",
              fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,.08)",
            }}>
            {editMode ? "✏️ Editando" : "✏️ Editar"}
          </button>
        )}
        {canEdit && editMode && (
          <button onClick={addBlankDay}
            style={{ ...ctrl, background: "#ecfdf5", color: "#065f46",
              border: "1px solid #a7f3d0", fontWeight: 600 }}>
            + Día
          </button>
        )}
        <button onClick={() => window.print()}
          style={{ ...ctrl, background: "#111", color: "#fff", border: "none",
            fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,.15)" }}>
          ↓ PDF
        </button>
      </div>

      {/* ── Pages ── */}
      <CoverPage
        kickoff={kickoff}
        total={total}
        lang={lang}
        editMode={editMode}
      />

      <FlightTracker kickoff={kickoff} lang={lang} />

      {/* WelcomePage removed — content is repetitive with cover page */}

      {hasSummary && (
        <SummaryPage
          kickoff={kickoff}
          days={activeDays}
          page={++pageNum}
          total={total}
          lang={lang}
          editMode={editMode}
        />
      )}

      

      {activeDays.map((day, di) => (
        <DayPage
          key={`${day.label}-${di}`}
          kickoff={kickoff}
          day={day}
          page={++pageNum}
          total={total}
          lang={lang}
          editMode={editMode}
          onRemoveDay={editMode ? () => removeDay(di) : undefined}
          onRemoveItem={editMode ? (ii) => removeItem(di, ii) : undefined}
          onAddItem={editMode ? () => openPickerForDay(di) : undefined}
          billingBlock={null}
          hasFamilies={hasFamilies}
          patchDay={editMode ? (field, val) => patchDay(di, field, val) : undefined}
          patchItemFn={editMode ? (ii, field, val) => patchItem(di, ii, field, val) : undefined}
        />
      ))}

      {/* ── PDF notes block (printable) ── */}
      {pdfNotes.trim() && (
        <div className="page">
          <PH kickoff={kickoff}/>
          <div className="section-eyebrow">{lang === "en" ? "Additional Info" : "Información Adicional"}</div>
          <div style={{ marginTop: 16, lineHeight: 1.7, fontSize: 13, color: "#222" }}>
            {pdfNotes.trim().split("\n").map((raw, i) => {
              const line = raw.trim();
              if (!line) return <div key={i} style={{ height: 8 }} />;
              const isTitle  = line === line.toUpperCase() && line.length > 2 && !/^[-*•]/.test(line);
              const isBullet = /^[-*•]/.test(line);
              if (isTitle) return (
                <div key={i} style={{ fontWeight: 700, fontSize: 14, letterSpacing: ".03em", textTransform: "uppercase", color: "#111", marginTop: 16, marginBottom: 4 }}>
                  {line}
                </div>
              );
              if (isBullet) return (
                <div key={i} style={{ display: "flex", gap: 8, paddingLeft: 8, marginBottom: 2 }}>
                  <span style={{ color: "#888", flexShrink: 0 }}>—</span>
                  <span>{line.replace(/^[-*•]\s*/, "")}</span>
                </div>
              );
              return <p key={i} style={{ margin: "0 0 6px" }}>{line}</p>;
            })}
          </div>
          <PF n={++pageNum} total={total}/>
        </div>
      )}

      {/* ── City Guide page ── */}
      <CityGuidePage
        kickoff={kickoff}
        cityGuideHidden={editMode ? cityGuideHidden : (kickoff.cityGuideHidden || "")}
        cityGuideIntro={editMode ? cityGuideIntro : (kickoff.cityGuideIntro || "")}
        onIntroChange={setCityGuideIntro}
        page={++pageNum}
        total={total}
        lang={lang}
        editMode={editMode}
        onToggleHidden={(itemId) => {
          setCityGuideHidden(prev => {
            const list = prev.split(",").map(s => s.trim()).filter(Boolean);
            const updated = list.includes(itemId)
              ? list.filter(id => id !== itemId)
              : [...list, itemId];
            return updated.join(",");
          });
        }}
      />

      <DepartureTracker kickoff={kickoff} lang={lang} />

      {/* ── Let's Keep in Touch page ── */}
      <KeepInTouchPage kickoff={kickoff} page={++pageNum} total={total} />

      {/* ── Billing page (last, internal/QB use) ── */}
      <BillingPage kickoff={kickoff} />

      {/* Catalog picker modal */}
      {editMode && pickerForDay !== null && (
        <CatalogPicker
          catalog={catalog}
          lang={lang}
          onSelect={(svc) => addServiceFromCatalog(pickerForDay, svc)}
          onClose={() => setPickerForDay(null)}
        />
      )}

      {/* ── PDF free-text block (legacy — replaced by per-day blocks) ── */}
      {false && editMode && (
        <div className="no-print" style={{
          maxWidth: 680, margin: "32px auto 0", padding: "20px 24px",
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 1px 4px rgba(0,0,0,.06)",
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
            Bloque libre en PDF
          </p>
          <p style={{ fontSize: 10.5, color: "#9ca3af", marginBottom: 10 }}>
            Se imprime al final del PDF. <b>TITULO</b> en mayúsculas, <b>- item</b> para listas, párrafos normales fluyen solos.
          </p>
          <textarea
            value={pdfNotes}
            onChange={e => setPdfNotes(e.target.value)}
            rows={7}
            style={{
              width: "100%", border: "1px solid #e5e7eb", borderRadius: 6,
              padding: "10px 12px", fontSize: 13, resize: "vertical",
              fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6,
            }}
            placeholder={"ACTIVIDADES ADICIONALES\n- Reserva restaurante Marea\n- Transfer aeropuerto confirmado\n\nNota: Llevar pasaporte para check-in."}
          />
          <p style={{ fontSize: 10, color: "#d1d5db", marginTop: 6 }}>
            Guardar con el botón ↑ de la barra de edición para que se refleje en el PDF del cliente.
          </p>
        </div>
      )}

      <div className="no-print" style={{
        textAlign: "center", padding: "20px 16px",
        fontSize: 11, color: "#ccc",
      }}>
        Two Travel · two.travel
      </div>
    </div>
  );
}
