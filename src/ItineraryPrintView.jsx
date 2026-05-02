// src/ItineraryPrintView.jsx
// Premium Two Travel Concierge Itinerary — browser print → PDF
// Visual direction: luxury editorial, horizontal images, clean hierarchy
import { useState, useEffect, useMemo, useRef } from "react";
import { fetchServicesFromSheet, fetchKickoffsFromSheet } from "./sheetServices";
import ttLogo from "./assets/logo.png";

/* ─── contentEditable helper ─────────────────────────────────
   Renders a span that is click-to-edit when editMode is on.
   Falls back to plain text in print / when editMode is off.
──────────────────────────────────────────────────────────── */
function Editable({ value, tag: Tag = "span", className = "", editMode, style }) {
  if (!editMode) {
    return <Tag className={className} style={style}>{value}</Tag>;
  }
  return (
    <Tag
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

function fmtPrice(v) {
  const n = num(v);
  if (!n) return "";
  return n >= 10000
    ? `$${n.toLocaleString("es-CO")} COP`
    : `$${n.toLocaleString("en-US")} USD`;
}

function matchCart(cart, catalog) {
  const out = [];
  for (const item of (cart || [])) {
    const sku = cl(item.sku);
    const id  = cl(item.id);
    const nl  = cl(item.name || item.displayName).toLowerCase();
    const s =
      catalog.find(s => sku && s.sku === sku) ||
      catalog.find(s => id  && String(s.id) === id) ||
      catalog.find(s => nl  && s.name.toLowerCase() === nl) ||
      catalog.find(s => nl  && s.name.toLowerCase().startsWith(nl)) ||
      (nl.length >= 4
        ? catalog.find(s =>
            s.name.toLowerCase().includes(nl) || nl.includes(s.name.toLowerCase()))
        : null);
    if (s) out.push({ cartItem: item, service: s });
  }
  return out;
}

function buildDays(matched, lang, dayMeta) {
  const map = new Map();
  matched.forEach(({ cartItem, service }, idx) => {
    const key = cl(cartItem?.dayLabel || cartItem?.day || "Itinerary");
    if (!map.has(key)) map.set(key, []);
    const desc = lang === "es"
      ? (service.description?.es || service.descriptionEs || service.description?.en || service.descriptionEn || "")
      : (service.description?.en || service.descriptionEn || service.description?.es || service.descriptionEs || "");
    map.get(key).push({
      sort         : Number(cartItem.sortOrder ?? idx),
      time         : cl(cartItem.timeLabel || cartItem.time || cartItem.startTime || service.schedule || ""),
      duration     : cl(service.duration || ""),
      title        : cl(cartItem.displayName || cartItem.title || cartItem.name || service.name),
      description  : desc,
      highlights   : service.highlights || [],
      includes     : service.includes   || "",
      location     : service.location   || "",
      address      : service.address    || "",
      city         : service.city       || "",
      price        : num(cartItem.priceOverride_cop) || service.price_cop || service.priceCop || service.price_tier_1 || service.priceTier1 || "",
      priceUsd     : num(cartItem.priceOverride_cop) || num(service.price_tier_1 || service.priceTier1 || 0),
      priceUnit    : cartItem.priceUnit || service.priceUnit  || "",
      deposit      : service.deposit    || "",
      cancellation : service.cancellation || "",
      menuUrl      : service.menuUrl    || "",
      mapsUrl      : service.mapsUrl    || "",
      image        : service.image      || "",
      qbCode       : service.quickbooksCode || service.quickbooks_code || "",
      category     : service.category   || "",
      familyFriendly: !!(service.family_friendly),
      confirmed    : cartItem.confirmed !== false,
      confirmation : cl(cartItem.confirmation || ""),
      dressCode    : cl(cartItem.dressCode || service.dressCode || service.dress_code || ""),
      passengers   : cl(cartItem.passengers || ""),
      cartNotes    : cl(cartItem.notes || ""),
    });
  });
  // Respect dayMeta order if provided
  const metaList   = Array.isArray(dayMeta) ? dayMeta : [];
  const metaLabels = metaList.map(dm => cl(dm.label)).filter(Boolean);
  const extraLabels = [...map.keys()].filter(k => !metaLabels.includes(k));
  const orderedLabels = [...metaLabels.filter(l => map.has(l)), ...extraLabels];

  return orderedLabels.map(label => {
    const dm = metaList.find(d => cl(d.label) === label);
    const items = (map.get(label) || []).sort((a, b) => a.sort - b.sort);
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
  .ph-left{font-size:9.5px;color:#999;line-height:1.8;}
  .ph-left b{display:block;font-size:10px;color:#222;font-weight:600;letter-spacing:.2px;}
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
    font-size:10px;color:#ccc;line-height:1.8;
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
  .sum-day-sub{font-size:10px;color:#bbb;margin-left:6px;text-transform:uppercase;letter-spacing:.8px;}
  .sum-svc-row{
    display:flex;gap:12px;
    font-size:11px;color:#666;
    padding:3.5px 0 3.5px 0;
    align-items:baseline;
  }
  .sum-svc-time{
    min-width:48px;color:#ccc;flex-shrink:0;
    font-variant-numeric:tabular-nums;font-size:10px;font-weight:500;
  }
  .sum-svc-name{flex:1;color:#333;font-weight:500;}
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
    font-size:15px;font-weight:700;color:#fff;line-height:1.2;letter-spacing:-.2px;
  }
  .day-band-title{
    font-size:9.5px;color:#666;margin-top:3px;
    text-transform:uppercase;letter-spacing:2px;font-weight:500;
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
    font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;
    color:#ccc;margin-bottom:10px;font-weight:500;
  }

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

  /* Confirmation number */
  .ev-confirm{
    font-size:9px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;
    color:#16a34a;margin-bottom:5px;
  }
  .ev-confirm span{font-weight:400;color:#333;text-transform:none;letter-spacing:0;font-size:10px;}

  /* Dress code */
  .ev-dressCode{font-size:10px;color:#555;margin-bottom:5px;line-height:1.5;}
  .ev-dressCode b{color:#111;font-weight:600;}

  /* Passengers */
  .ev-passengers{font-size:10px;color:#555;margin-bottom:5px;line-height:1.5;}
  .ev-passengers b{color:#111;font-weight:600;}

  /* Concierge notes */
  .ev-cart-notes{
    font-size:10px;color:#444;margin-top:7px;margin-bottom:6px;
    padding:6px 10px;background:#f9f9f9;border-radius:5px;
    border-left:2px solid #ddd;line-height:1.6;
  }

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
function PH({ kickoff }) {
  const name  = kickoff.assignedConciergeName || "";
  const email = kickoff.assignedConciergeEmail || "";
  const title = kickoff.conciergeTitle || "";
  return (
    <div className="ph">
      <div className="ph-left">
        {name  && <b>{name}</b>}
        {email && <span>{email}</span>}
        {title && <span>{title}</span>}
        {!name && <span>Two Travel Concierge</span>}
      </div>
      <div className="ph-right">Two Travel</div>
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

  const titleLine = a.guestName || "Two Travel Concierge";
  const subtitle  = [a.city, a.tripName].filter(Boolean).join(" · ");

  return (
    <div className="page">
      {/* Hero — always Two Travel brand image */}
      <div className="cover-hero-placeholder" style={{
        background: "linear-gradient(160deg,#1a1410 0%,#0d0d0d 60%,#111 100%)",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}>
        <img src={ttLogo} alt="Two Travel"
          style={{ maxHeight: 160, maxWidth: 380, objectFit: "contain", filter: "brightness(0) invert(1)" }}
        />
      </div>

      <PH kickoff={a}/>

      <div className="cover-body">
        {(a.city || a.tripName) && (
          <Editable
            tag="div" className="cover-eyebrow" editMode={editMode}
            value={`${subtitle} · ${isEs ? "Itinerario Concierge" : "Concierge Itinerary"}`}
          />
        )}
        <Editable tag="div" className="cover-title" editMode={editMode} value={titleLine}/>
        {subtitle && (
          <Editable tag="div" className="cover-subtitle" editMode={editMode} value={subtitle}/>
        )}
        {a.tripDates && (
          <Editable tag="div" className="cover-dates" editMode={editMode} value={a.tripDates}/>
        )}

        <div className="cover-rule"/>

        {/* Accommodation / stay block */}
        {(a.accommodationName || a.groupSize || a.checkIn || a.checkOut) && (
          <div className="cover-info-grid">
            {a.accommodationName && (
              <div className="cover-info-card">
                <div className="cover-info-label">
                  {isEs ? "Alojamiento" : "Accommodation"}
                </div>
                <Editable tag="div" className="cover-info-value" editMode={editMode} value={a.accommodationName}/>
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
              </div>
            )}
            {(a.checkIn || a.checkOut || a.groupSize) && (
              <div className="cover-info-card">
                <div className="cover-info-label">
                  {isEs ? "Detalles de Estadía" : "Stay Details"}
                </div>
                {a.groupSize && (
                  <Editable tag="div" className="cover-info-value" editMode={editMode} value={a.groupSize}/>
                )}
                {a.checkIn  && (
                  <Editable tag="div" className="cover-info-sub" editMode={editMode}
                    value={`${isEs ? "Check-in" : "Check-in"}: ${a.checkIn}`}/>
                )}
                {a.checkOut && (
                  <Editable tag="div" className="cover-info-sub" editMode={editMode}
                    value={`${isEs ? "Check-out" : "Check-out"}: ${a.checkOut}`}/>
                )}
              </div>
            )}
          </div>
        )}

        {/* Main concierge contact — WhatsApp number */}
        {a.mainContact && (
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0",
              borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>📱</span>
              <div>
                <div style={{ fontSize: 8, letterSpacing: "2px", textTransform: "uppercase", color: "#6b7280", fontWeight: 600, marginBottom: 3 }}>
                  {isEs ? "Contacto principal" : "Main contact"}
                </div>
                <a href={`https://wa.me/${a.mainContact.replace(/\D/g,"")}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 13, fontWeight: 700, color: "#16a34a", textDecoration: "none" }}>
                  {a.mainContact}
                </a>
                <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 6 }}>WhatsApp</span>
              </div>
            </div>
          </div>
        )}

        <Editable
          tag="div" className="cover-footer-note" editMode={editMode}
          value={isEs
            ? `Por favor tómate un momento para revisar este PDF antes de tu llegada. Incluye información útil para tu estadía, como detalles de facturación, consejos de seguridad, cultura de propinas y servicios adicionales de concierge para hacer tu experiencia en Cartagena lo más fluida y disfrutable posible.`
            : `Please take a moment to review this PDF before your arrival. It includes useful information for your stay, such as billing details, safety tips, tipping culture, and additional concierge services to help make your Cartagena experience as smooth and enjoyable as possible.`}
        />
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
              <div key={i} className="sum-svc-row">
                <span className="sum-svc-time">{it.time || "—"}</span>
                <Editable value={it.title} tag="span" className="sum-svc-name" editMode={editMode}/>
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

/* ═══════════════════════════════════════════════════════════
   PAGE 3: INFORMATION & DOCUMENTS
═══════════════════════════════════════════════════════════ */
function InfoPage({ kickoff, lang, page, total, editMode }) {
  const city = kickoff.city || (lang === "es" ? "tu destino" : "your destination");
  const isEs = lang === "es";
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="section-eyebrow">{isEs ? "Bienvenida" : "Welcome"}</div>
      <div className="section-title">
        {isEs ? "Información y Documentos" : "Information & Documents"}
      </div>

      <div className="info-body">
        <div className="info-block">
          <div className="info-h3">{isEs ? "Bienvenido" : "Welcome"}</div>
          <Editable
            tag="p" className="info-p" editMode={editMode}
            style={{ fontWeight: 600 }}
            value={isEs ? `Bienvenido a ${city} — Two Travel.` : `Welcome to ${city} — Two Travel.`}
          />
          <Editable
            tag="p" className="info-p" editMode={editMode}
            value={isEs
              ? "Por favor revisa este itinerario antes de tu llegada. Contiene información útil para tu viaje."
              : "Please review this itinerary before your arrival. It contains helpful information for your trip."}
          />
        </div>

        <div className="info-block">
          <div className="info-h3">
            {isEs ? "Sobre este itinerario" : "About This Itinerary"}
          </div>
          <Editable
            tag="p" className="info-p" editMode={editMode}
            value={isEs
              ? "Este es un itinerario en borrador — todo puede ajustarse. Podemos cambiar, agregar o eliminar experiencias según lo que más te emocione. En nuestra próxima reunión lo revisaremos juntos."
              : "This is a draft itinerary — everything can be adjusted. We can change, add, or remove experiences based on what excites you most. In our next meeting we will review it together and refine it accordingly."}
          />
        </div>

        <div className="info-block">
          <div className="info-h3">Promo</div>
          <Editable
            tag="p" className="info-p" editMode={editMode}
            value={isEs
              ? "Comparte tu experiencia con Two Travel en Instagram o TikTok y obtén descuento en servicios seleccionados."
              : "Share your experience with Two Travel on Instagram or TikTok and receive a discount on select services."}
          />
          <p className="info-p" style={{ marginBottom: 4 }}>
            <a href="https://www.instagram.com/twotravelconcierge" target="_blank" rel="noreferrer"
              style={{ color: "#1d4ed8", fontWeight: 600, textDecoration: "underline", fontSize: 12 }}>
              @twotravelconcierge
            </a>
            <span style={{ color: "#bbb", fontSize: 10.5 }}>
              {isEs
                ? " · La publicación debe realizarse durante tu estadía · Un tag por persona requerido · Para servicios grupales, todos los miembros deben participar."
                : " · Tag must be posted during your stay · One tag per person required · For group services, all members must participate."}
            </span>
          </p>
        </div>

        {kickoff.welcomePdfUrl && (
          <div className="info-block">
            <div className="info-h3">{isEs ? "Documento de bienvenida" : "Welcome Document"}</div>
            <p className="info-p">
              {isEs ? "Antes de llegar, por favor revisa este documento:" : "Before your arrival, please review this document:"}
            </p>
            <a href={kickoff.welcomePdfUrl} target="_blank" rel="noreferrer"
              style={{ color: "#1d4ed8", fontSize: 12, textDecoration: "underline", display: "block", marginTop: 4 }}>
              {isEs ? "📄 Ver documento de bienvenida →" : "📄 View Welcome Document →"}
            </a>
          </div>
        )}

        {kickoff.internalNotes && (
          <div className="info-block">
            <div className="info-h3">{isEs ? "Notas adicionales" : "Additional Notes"}</div>
            <Editable tag="p" className="info-p" editMode={editMode} value={kickoff.internalNotes}/>
          </div>
        )}
      </div>

      <PF n={page} total={total}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PRE-TRIP PAGE — links, forms, resources, recommendations
   Matches the "Pre-Trip and General Information" section
   from the Two Travel reference PDF.
═══════════════════════════════════════════════════════════ */
function PreTripPage({ kickoff, lang, page, total, editMode }) {
  const isEs = lang === "es";
  const raw  = cl(kickoff.preTripContent || "");
  if (!raw) return null;

  // ── Smart line parser ─────────────────────────────────
  // Blank line   → section separator
  // "Label: URL" → clickable row with bold label
  // "https://…"  → bare link
  // "Header"     → bold heading if ≤60 chars and followed by content
  // anything else → regular text
  const rawLines = raw.split("\n");
  const sections = [];          // [{heading, items}]
  let sec = { heading: "", items: [] };

  const isUrl = (s) => /^https?:\/\//i.test(s.trim());
  const isLabelUrl = (s) => /^.{1,60}?:\s*https?:\/\//i.test(s.trim());
  const isHeading  = (s) => /^[A-Z\u00C0-\u024F!].{0,80}$/.test(s.trim()) && !isUrl(s) && !isLabelUrl(s) && s.trim().length <= 80 && !s.trim().includes(".");

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) {
      if (sec.items.length || sec.heading) {
        sections.push({ ...sec });
        sec = { heading: "", items: [] };
      }
      continue;
    }
    if (isUrl(line)) {
      sec.items.push({ kind: "link", url: line });
    } else if (isLabelUrl(line)) {
      const m = line.match(/^(.+?):\s*(https?:\/\/.+)$/i);
      sec.items.push({ kind: "labelLink", label: m[1].trim(), url: m[2].trim() });
    } else if (!sec.heading && !sec.items.length && isHeading(line)) {
      sec.heading = line;
    } else {
      sec.items.push({ kind: "text", text: line });
    }
  }
  if (sec.heading || sec.items.length) sections.push(sec);

  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="section-eyebrow">
        {isEs ? "Antes de llegar" : "General Information"}
      </div>
      <div className="section-title">
        {isEs ? "Información Previa al Viaje" : "Pre-Trip and General Information"}
      </div>

      <div className="pretrip-body">
        {sections.map((sec, si) => (
          <div key={si} className="pretrip-block">
            {sec.heading && (
              <Editable
                value={sec.heading}
                tag="div"
                className="pretrip-h3"
                editMode={editMode}
              />
            )}
            {sec.items.map((item, ii) => {
              if (item.kind === "labelLink") return (
                <div key={ii} style={{ display: "flex", gap: 6, alignItems: "baseline", padding: "3px 0" }}>
                  <strong style={{ fontSize: 12, color: "#111", fontWeight: 600, flexShrink: 0 }}>
                    {item.label}:
                  </strong>
                  <a href={item.url} className="pretrip-link" target="_blank" rel="noreferrer"
                    style={{ display: "inline", padding: 0 }}>
                    {item.url}
                  </a>
                </div>
              );
              if (item.kind === "link") return (
                <a key={ii} href={item.url} className="pretrip-link" target="_blank" rel="noreferrer">
                  {item.url}
                </a>
              );
              return (
                <Editable key={ii} value={item.text} tag="p" className="pretrip-line" editMode={editMode}/>
              );
            })}
          </div>
        ))}
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

function EventBlock({ it, lang, editMode, onRemove }) {
  const showPrice = !HIDE_PRICE_CATS.has(String(it.category || "").trim().toLowerCase());
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
    <div className="ev" style={{ position: "relative" }}>
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

        {/* Meta / time */}
        {(timePart || durPart) && (
          <div className="ev-meta">
            {editMode ? (
              <>
                <Editable value={timePart} editMode={editMode} />
                {timePart && durPart ? " · " : ""}
                <Editable value={durPart} editMode={editMode} />
                {" · "}{tzPart}
              </>
            ) : metaParts.join(" · ")}
          </div>
        )}

        {/* Title + price */}
        <div className="ev-title-row">
          <Editable value={it.title} tag="div" className="ev-title" editMode={editMode} />
          {price && (
            <div className="ev-price-col">
              <span className="ev-price-label">{isEs ? "Precio" : "Price"}</span>
              <Editable value={price} tag="div" className="ev-price-val" editMode={editMode} />
            </div>
          )}
        </div>

        {/* Location subtitle */}
        {it.location && (
          <Editable value={it.location} tag="div" className="ev-location" editMode={editMode} />
        )}

        {/* Confirmation number */}
        {it.confirmation && (
          <div className="ev-confirm">
            {isEs ? "CONFIRMACIÓN:" : "CONFIRMATION:"}{" "}
            <span><Editable value={it.confirmation} editMode={editMode} /></span>
          </div>
        )}

        {/* Dress code */}
        {it.dressCode && (
          <div className="ev-dressCode">
            <b>{isEs ? "Vestimenta:" : "Dress code:"}</b>{" "}
            <Editable value={it.dressCode} editMode={editMode} />
          </div>
        )}

        {/* Passengers */}
        {it.passengers && (
          <div className="ev-passengers">
            <b>{isEs ? "Pasajeros:" : "Passengers:"}</b>{" "}
            <Editable value={it.passengers} editMode={editMode} />
          </div>
        )}

        {/* Family Friendly badge */}
        {it.familyFriendly && (
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
          <Editable value={it.description} tag="p" className="ev-desc" editMode={editMode} />
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

        {/* Concierge notes */}
        {it.cartNotes && (
          <div className="ev-cart-notes">
            <Editable value={it.cartNotes} editMode={editMode} />
          </div>
        )}

        {/* Footer: address + map + QB */}
        <div className="ev-footer">
          {(it.address || it.city) && (
            <span>
              {[it.address, it.city].filter(Boolean).join(", ")}
              {it.mapsUrl && !it.mapsUrl.includes("menuUrl") && (
                <> ·{" "}
                  <a href={it.mapsUrl} className="ev-footer-link"
                    target="_blank" rel="noreferrer">
                    {isEs ? "mapa" : "map"}
                  </a>
                </>
              )}
            </span>
          )}
          {it.qbCode && (
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
function BillingBlock({ kickoff, allDays }) {
  const k = kickoff;

  // Collect every service that has a QB code
  const lines = [];
  for (const day of (allDays || [])) {
    for (const it of (day.items || [])) {
      if (it.qbCode) {
        const price = it.priceUsd || num(it.price) || "0";
        lines.push(`[${it.qbCode}][${cleanBrackets(it.title)}][${price}]`);
      }
    }
  }

  if (!k.guestName && !k.guestContact && lines.length === 0) return null;

  return (
    <div className="qb-billing-block" style={{ marginBottom: 12 }}>
      <div className="qb-billing-label">billing data</div>
      <div className="qb-billing-line">
        {`[1A][${cleanBrackets(k.guestName || "")}]`}
      </div>
      <div className="qb-billing-line">
        {`[2A][${cleanBrackets(k.guestContact || k.email || "")}]`}
      </div>
      <div className="qb-billing-line">
        {`[3A][${formatIsoDate(k.arrivalDate || k.checkIn || "")}]`}
      </div>
      <div className="qb-billing-line">
        {`[4A][${formatIsoDate(k.departureDate || k.checkOut || "")}]`}
      </div>
      {lines.length > 0 && (
        <div style={{ marginTop: 3 }}>
          {lines.map((l, i) => (
            <div key={i} className="qb-billing-line">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DAY PAGE
═══════════════════════════════════════════════════════════ */
function DayPage({ kickoff, day, page, total, lang, editMode, onRemoveDay, onRemoveItem, onAddItem, billingBlock }) {
  return (
    <div className="page" style={{ position: "relative" }}>
      <PH kickoff={kickoff}/>

      {/* Day band — with remove-day button in edit mode */}
      <div className="day-band" style={{ position: "relative" }}>
        <div className="day-band-inner">
          <div className="day-band-row">
            <span className="day-band-sup">{lang === "es" ? "Día" : "Day"}</span>
            <Editable value={day.label} tag="span" className="day-band-label" editMode={editMode}/>
          </div>
          {day.title && (
            <Editable value={day.title} tag="div" className="day-band-title" editMode={editMode}/>
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
        {day.items.map((it, i) => (
          <EventBlock
            key={i}
            it={it}
            lang={lang}
            editMode={editMode}
            onRemove={onRemoveItem ? () => onRemoveItem(i) : undefined}
          />
        ))}

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
  const kickoffId = params.get("kickoffId");
  const lang      = params.get("lang") === "es" ? "es" : "en";

  const [kickoff,   setKickoff]   = useState(null);
  const [catalog,   setCatalog]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [editMode,  setEditMode]  = useState(false);
  // Mutable deep-copy of days used during edit mode (add/remove days & items)
  const [editDays,  setEditDays]  = useState(null);
  // Catalog picker: { dayIndex } when open, null when closed
  const [pickerForDay, setPickerForDay] = useState(null);

  // Sync editDays from computed days each time editMode is activated
  useEffect(() => {
    if (editMode) {
      setEditDays(JSON.parse(JSON.stringify(days)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  /* ── Edit-mode mutation helpers ── */
  const removeDay = (di) =>
    setEditDays(prev => prev.filter((_, i) => i !== di));

  const removeItem = (di, ii) =>
    setEditDays(prev => prev.map((day, i) =>
      i !== di ? day : { ...day, items: day.items.filter((_, j) => j !== ii) }
    ));

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
      fetchKickoffsFromSheet().then(list =>
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
    if (!kickoff || !catalog.length) return [];
    return buildDays(matchCart(kickoff.cart, catalog), lang, kickoff.dayMeta || []);
  }, [kickoff, catalog, lang]);

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

  const hasPreTrip = !!(kickoff.preTripContent || "").trim();
  const hasSummary = activeDays.length > 0;
  const total = 1 + (hasSummary ? 1 : 0) + 1 + (hasPreTrip ? 1 : 0) + activeDays.length;
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
          <div style={{ display: "flex", gap: 8 }}>
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
        <button onClick={() => setEditMode(v => !v)}
          style={{ ...ctrl,
            background: editMode ? "#1d4ed8" : "#fff",
            color: editMode ? "#fff" : "#333",
            border: editMode ? "none" : "1px solid #ddd",
            fontWeight: 600, boxShadow: "0 1px 4px rgba(0,0,0,.08)",
          }}>
          {editMode ? "✏️ Editing" : "✏️ Edit"}
        </button>
        {editMode && (
          <button onClick={addBlankDay}
            style={{ ...ctrl, background: "#ecfdf5", color: "#065f46",
              border: "1px solid #a7f3d0", fontWeight: 600 }}>
            + Add Day
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

      <InfoPage
        kickoff={kickoff}
        lang={lang}
        page={++pageNum}
        total={total}
        editMode={editMode}
      />

      {hasPreTrip && (
        <PreTripPage
          kickoff={kickoff}
          lang={lang}
          page={++pageNum}
          total={total}
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
          billingBlock={di === activeDays.length - 1
            ? <BillingBlock kickoff={kickoff} allDays={activeDays} />
            : null}
        />
      ))}

      {/* Catalog picker modal */}
      {editMode && pickerForDay !== null && (
        <CatalogPicker
          catalog={catalog}
          lang={lang}
          onSelect={(svc) => addServiceFromCatalog(pickerForDay, svc)}
          onClose={() => setPickerForDay(null)}
        />
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
