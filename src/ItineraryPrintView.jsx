// src/ItineraryPrintView.jsx
// Premium Two Travel Concierge Itinerary — browser print → PDF
// Visual direction: luxury editorial, horizontal images, clean hierarchy
import { useState, useEffect, useMemo } from "react";
import { fetchServicesFromSheet, fetchKickoffsFromSheet } from "./sheetServices";

/* ═══════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════ */
const cl  = (v) => String(v ?? "").trim();
const num = (v) => { const n = Number(cl(v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; };

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
      price        : service.price_cop  || service.priceCop || service.price_tier_1 || service.priceTier1 || "",
      priceUnit    : service.priceUnit  || "",
      deposit      : service.deposit    || "",
      cancellation : service.cancellation || "",
      menuUrl      : service.menuUrl    || "",
      mapsUrl      : service.mapsUrl    || "",
      image        : service.image      || "",
      qbCode       : service.quickbooksCode || service.quickbooks_code || "",
      category     : service.category   || "",
      familyFriendly: !!(service.family_friendly),
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap');

  *{box-sizing:border-box;margin:0;padding:0;}
  html,body,.root{
    font-family:'Inter',system-ui,-apple-system,sans-serif;
    background:#f0f0f0;
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
    margin:0 auto 32px;
    background:#fff;
    display:flex;
    flex-direction:column;
    box-shadow:0 2px 20px rgba(0,0,0,.10);
    border-radius:4px;
    overflow:hidden;
    position:relative;
  }

  /* ── Page header strip ── */
  .ph{
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:11px 36px;
    border-bottom:1px solid #ebebeb;
    flex-shrink:0;
  }
  .ph-left{font-size:10px;color:#888;line-height:1.75;}
  .ph-left b{display:block;font-size:10.5px;color:#111;font-weight:600;}
  .ph-right{
    font-size:11px;font-weight:700;letter-spacing:.8px;
    text-transform:uppercase;color:#111;
  }

  /* ── Page footer ── */
  .pf{
    display:flex;justify-content:space-between;align-items:center;
    padding:9px 36px;border-top:1px solid #ebebeb;
    margin-top:auto;flex-shrink:0;
    font-size:9.5px;color:#bbb;letter-spacing:.3px;
  }

  /* ══════════════════════════════════════
     COVER PAGE
  ══════════════════════════════════════ */
  .cover-hero{
    width:100%;height:280px;
    object-fit:cover;object-position:center;
    display:block;flex-shrink:0;
    background:#1a1a1a;
  }
  .cover-hero-placeholder{
    width:100%;height:280px;flex-shrink:0;
    background:linear-gradient(160deg,#111 0%,#2a2a2a 60%,#333 100%);
  }

  .cover-body{padding:28px 36px 20px;flex:1;display:flex;flex-direction:column;}
  .cover-eyebrow{
    font-size:9px;letter-spacing:3.5px;text-transform:uppercase;
    color:#aaa;margin-bottom:12px;
  }
  .cover-title{
    font-size:26px;font-weight:700;line-height:1.15;
    letter-spacing:-.5px;color:#111;margin-bottom:6px;
  }
  .cover-dates{font-size:12.5px;color:#777;margin-bottom:20px;font-weight:400;}

  .cover-divider{height:1px;background:#ebebeb;margin:0 0 20px;}

  /* Accommodation info row */
  .cover-info-grid{display:flex;gap:16px;margin-bottom:20px;}
  .cover-info-card{
    flex:1;border:1px solid #ebebeb;border-radius:8px;
    padding:13px 15px;background:#fafafa;
  }
  .cover-info-label{
    font-size:8.5px;letter-spacing:2.5px;text-transform:uppercase;
    color:#bbb;margin-bottom:6px;
  }
  .cover-info-value{font-size:13px;font-weight:600;color:#111;line-height:1.3;}
  .cover-info-sub{font-size:11px;color:#888;margin-top:3px;line-height:1.5;}

  .cover-note{
    font-size:12px;color:#555;line-height:1.8;
    max-width:560px;margin-bottom:20px;
  }
  .cover-footer-note{
    font-size:10.5px;color:#bbb;line-height:1.7;
    border-top:1px solid #ebebeb;padding-top:14px;
    margin-top:auto;
  }

  /* ══════════════════════════════════════
     TRIP SUMMARY PAGE
  ══════════════════════════════════════ */
  .section-eyebrow{
    padding:16px 36px 10px;
    font-size:9px;letter-spacing:3px;text-transform:uppercase;color:#bbb;
    border-bottom:1px solid #ebebeb;flex-shrink:0;
  }
  .section-title{
    padding:0 36px 16px;
    font-size:20px;font-weight:700;letter-spacing:-.3px;
  }

  .sum-body{padding:8px 36px 20px;flex:1;}
  .sum-day-block{margin-bottom:20px;}
  .sum-day-header{
    display:flex;align-items:center;gap:10px;
    margin-bottom:8px;
  }
  .sum-day-pip{
    width:7px;height:7px;border-radius:50%;
    background:#111;flex-shrink:0;
  }
  .sum-day-label{font-size:12px;font-weight:700;color:#111;}
  .sum-svc-row{
    display:flex;gap:10px;
    font-size:11px;color:#666;
    padding:3px 0 3px 17px;
    border-left:1px solid #ebebeb;
    margin-left:3px;
    align-items:baseline;
  }
  .sum-svc-time{
    min-width:42px;color:#bbb;flex-shrink:0;
    font-variant-numeric:tabular-nums;font-size:10.5px;
  }
  .sum-svc-name{flex:1;color:#333;}
  .sum-svc-loc{color:#bbb;font-size:10px;flex-shrink:0;}

  /* ══════════════════════════════════════
     INFO PAGE
  ══════════════════════════════════════ */
  .info-body{padding:8px 36px 20px;flex:1;}
  .info-block{margin-bottom:18px;}
  .info-h3{
    font-size:9.5px;font-weight:700;letter-spacing:2px;
    text-transform:uppercase;color:#aaa;margin-bottom:8px;
  }
  .info-p{font-size:12px;color:#555;line-height:1.8;margin-bottom:6px;}

  /* ══════════════════════════════════════
     DAY BAND
  ══════════════════════════════════════ */
  .day-band{
    background:#111;
    padding:13px 36px;
    display:flex;align-items:baseline;gap:10px;
    flex-shrink:0;
  }
  .day-band-sup{
    font-size:8.5px;letter-spacing:3px;text-transform:uppercase;
    color:#666;flex-shrink:0;
  }
  .day-band-title{
    font-size:13.5px;font-weight:700;color:#fff;line-height:1.25;
  }

  /* ══════════════════════════════════════
     EVENT CARD — horizontal layout
     Image LEFT (42%) · Content RIGHT (58%)
  ══════════════════════════════════════ */
  .ev{
    display:flex;
    border-bottom:1px solid #f0f0f0;
    break-inside:avoid;
    page-break-inside:avoid;
  }
  .ev:last-child{border-bottom:none;}

  /* Image column */
  .ev-img-col{
    width:42%;flex-shrink:0;
    overflow:hidden;
    min-height:190px;
    background:#f5f5f5;
    position:relative;
  }
  .ev-img-col img{
    width:100%;height:100%;
    object-fit:cover;object-position:center;
    display:block;
  }
  /* No-image placeholder: subtle gradient */
  .ev-img-none{
    width:42%;flex-shrink:0;min-height:190px;
    background:linear-gradient(135deg,#f7f7f7 0%,#ececec 100%);
    display:flex;align-items:center;justify-content:center;
  }
  .ev-img-none-icon{font-size:28px;opacity:.18;}

  /* Content column */
  .ev-content{
    flex:1;padding:20px 24px 18px;
    display:flex;flex-direction:column;gap:0;
  }

  /* Meta line: time · duration · timezone */
  .ev-meta{
    font-size:9px;letter-spacing:2px;text-transform:uppercase;
    color:#bbb;margin-bottom:9px;
  }

  /* Title row */
  .ev-title-row{
    display:flex;justify-content:space-between;align-items:flex-start;
    gap:12px;margin-bottom:3px;
  }
  .ev-title{font-size:15px;font-weight:700;line-height:1.2;color:#111;}
  .ev-price-col{text-align:right;flex-shrink:0;}
  .ev-price-label{
    font-size:8.5px;letter-spacing:2px;text-transform:uppercase;
    color:#bbb;display:block;margin-bottom:3px;
  }
  .ev-price-val{font-size:14px;font-weight:700;color:#111;}

  .ev-location{font-size:11px;color:#999;margin-bottom:10px;}

  /* Links row */
  .ev-links{display:flex;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
  .ev-link{font-size:10.5px;color:#1d4ed8;text-decoration:underline;}

  /* Description */
  .ev-desc{
    font-size:11.5px;color:#444;line-height:1.75;
    margin-bottom:10px;
  }

  /* Highlights / Includes lists */
  .ev-list-block{margin-bottom:9px;}
  .ev-list-label{
    font-size:8.5px;font-weight:700;letter-spacing:2px;
    text-transform:uppercase;color:#bbb;margin-bottom:5px;
  }
  .ev-list-item{
    font-size:11px;color:#555;
    padding:1.5px 0 1.5px 14px;
    position:relative;line-height:1.55;
  }
  .ev-list-item::before{
    content:"–";position:absolute;left:0;color:#ccc;
  }

  /* Terms & conditions */
  .ev-terms{
    font-size:10.5px;color:#999;line-height:1.65;
    margin-bottom:9px;padding-top:9px;
    border-top:1px solid #f2f2f2;
  }
  .ev-terms b{color:#777;font-weight:600;}

  /* Address + map row */
  .ev-footer{
    margin-top:auto;padding-top:10px;
    font-size:10px;color:#bbb;line-height:1.6;
  }
  .ev-footer-link{color:#1d4ed8;text-decoration:underline;}
  .ev-qb{
    font-size:9.5px;color:#ddd;
    font-family:'Courier New',Courier,monospace;
    margin-top:4px;
  }

  /* Family Friendly badge */
  .ev-ff{
    display:inline-flex;align-items:center;gap:4px;
    background:#ecfdf5;border:1px solid #a7f3d0;color:#059669;
    border-radius:99px;padding:2px 8px;font-size:9.5px;font-weight:600;
    margin-bottom:8px;
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
function CoverPage({ kickoff, heroImage, total }) {
  const a = kickoff;

  // Build a premium title: "Vivek · Medellín" or just guest name
  const titleParts = [a.guestName, a.city || a.tripName].filter(Boolean);
  const titleLine  = titleParts.join(" · ") || "Two Travel Concierge";

  return (
    <div className="page">
      {/* Hero — landscape image or dark gradient */}
      {heroImage
        ? <img src={heroImage} alt="" className="cover-hero"
            onError={e => { e.target.style.display = "none"; }}/>
        : <div className="cover-hero-placeholder"/>
      }

      <PH kickoff={a}/>

      <div className="cover-body">
        {a.city && (
          <div className="cover-eyebrow">{a.city} · Concierge Itinerary</div>
        )}
        <div className="cover-title">{titleLine}</div>
        {a.tripDates && <div className="cover-dates">{a.tripDates}</div>}

        {/* Accommodation / stay block */}
        {(a.accommodationName || a.groupSize || a.checkIn || a.checkOut) && (
          <>
            <div className="cover-divider"/>
            <div className="cover-info-grid">
              {a.accommodationName && (
                <div className="cover-info-card">
                  <div className="cover-info-label">Accommodation</div>
                  <div className="cover-info-value">{a.accommodationName}</div>
                  {a.accommodationAddr && (
                    <div className="cover-info-sub">{a.accommodationAddr}</div>
                  )}
                </div>
              )}
              {(a.checkIn || a.checkOut || a.groupSize) && (
                <div className="cover-info-card">
                  <div className="cover-info-label">Stay Details</div>
                  {a.groupSize && (
                    <div className="cover-info-value">{a.groupSize}</div>
                  )}
                  {a.checkIn  && <div className="cover-info-sub">Check-in: {a.checkIn}</div>}
                  {a.checkOut && <div className="cover-info-sub">Check-out: {a.checkOut}</div>}
                </div>
              )}
            </div>
          </>
        )}

        {/* Concierge welcome note */}
        {a.conciergeSummary && (
          <p className="cover-note">{a.conciergeSummary}</p>
        )}

        <div className="cover-footer-note">
          All reservations are under Two Travel — {a.guestName || "Guest"}.
          Once a reservation has been confirmed, a cancellation fee may apply
          to certain experiences.
        </div>
      </div>

      <PF n={1} total={total}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE 2: TRIP SUMMARY
═══════════════════════════════════════════════════════════ */
function SummaryPage({ kickoff, days, page, total }) {
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="section-eyebrow">Overview</div>
      <div className="section-title" style={{ paddingTop: 12 }}>Trip Summary</div>

      <div className="sum-body">
        {days.map(day => (
          <div key={day.label} className="sum-day-block">
            <div className="sum-day-header">
              <span className="sum-day-pip"/>
              <div>
                <span className="sum-day-label">{day.label}</span>
                {day.title && (
                  <span style={{
                    fontSize: 10, color: "#bbb", marginLeft: 8,
                    fontWeight: 400, textTransform: "uppercase", letterSpacing: "1px",
                  }}>
                    {day.title}
                  </span>
                )}
              </div>
            </div>
            {day.items.map((it, i) => (
              <div key={i} className="sum-svc-row">
                <span className="sum-svc-time">{it.time || "—"}</span>
                <span className="sum-svc-name">{it.title}</span>
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
function InfoPage({ kickoff, lang, page, total }) {
  const city = kickoff.city || "your destination";
  const isEs = lang === "es";
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="section-eyebrow">{isEs ? "Bienvenida" : "Welcome"}</div>
      <div className="section-title" style={{ paddingTop: 12 }}>
        {isEs ? "Información y Documentos" : "Information & Documents"}
      </div>

      <div className="info-body">
        <div className="info-block">
          <p className="info-p" style={{ fontWeight: 600 }}>
            {isEs ? `Bienvenido a ${city} — Two Travel.` : `Welcome to ${city} — Two Travel.`}
          </p>
          <p className="info-p">
            {isEs
              ? "Por favor revisa este itinerario antes de tu llegada. Contiene información útil para tu viaje."
              : "Please review this itinerary before your arrival. It contains helpful information for your trip."}
          </p>
        </div>

        <div className="info-block">
          <div className="info-h3">
            {isEs ? "Sobre este itinerario" : "About This Itinerary"}
          </div>
          <p className="info-p">
            {isEs
              ? "Este es un itinerario en borrador — todo puede ajustarse. Podemos cambiar, agregar o eliminar experiencias según lo que más te emocione. En nuestra próxima reunión lo revisaremos juntos."
              : "This is a draft itinerary — everything can be adjusted. We can change, add, or remove experiences based on what excites you most. In our next meeting we will review it together and refine it."}
          </p>
        </div>

        <div className="info-block">
          <div className="info-h3">Promo</div>
          <p className="info-p">
            {isEs
              ? "Comparte tu experiencia con Two Travel en Instagram o TikTok y obtén descuento en servicios seleccionados."
              : "Share your experience with Two Travel on Instagram or TikTok and receive a discount on select services."}
          </p>
          <p className="info-p" style={{ color: "#bbb", fontSize: 11 }}>
            @twotravelconcierge
            {isEs
              ? " · La publicación debe realizarse durante tu estadía · Un tag por persona requerido · Para servicios grupales, todos los miembros deben participar."
              : " · Tag must be posted during your stay · One tag per person required · For group services, all members must participate."}
          </p>
        </div>
      </div>

      <PF n={page} total={total}/>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EVENT BLOCK — horizontal card
   Left: landscape image  |  Right: all content
═══════════════════════════════════════════════════════════ */
function EventBlock({ it, lang }) {
  const price    = fmtPrice(it.price);
  const hiList   = splitList(it.highlights);
  const incList  = splitList(it.includes);
  const isEs     = lang === "es";

  // Build meta string: "7:00 PM · 2 hrs · Colombia Standard Time"
  const metaParts = [
    it.time,
    it.duration,
    isEs ? "Hora de Colombia" : "Colombia Standard Time",
  ].filter(Boolean);

  return (
    <div className="ev">
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
        {metaParts.length > 1 && (
          <div className="ev-meta">{metaParts.join(" · ")}</div>
        )}

        {/* Title + price */}
        <div className="ev-title-row">
          <div className="ev-title">{it.title}</div>
          {price && (
            <div className="ev-price-col">
              <span className="ev-price-label">Price</span>
              <div className="ev-price-val">{price}</div>
            </div>
          )}
        </div>

        {/* Location subtitle */}
        {it.location && <div className="ev-location">{it.location}</div>}

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
          <p className="ev-desc">{it.description}</p>
        )}

        {/* Highlights */}
        {hiList.length > 0 && (
          <div className="ev-list-block">
            <div className="ev-list-label">
              {isEs ? "Destacados" : "Highlights"}
            </div>
            {hiList.map((h, i) => (
              <div key={i} className="ev-list-item">{h}</div>
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
              <div key={i} className="ev-list-item">{h}</div>
            ))}
          </div>
        )}

        {/* Deposit */}
        {it.deposit && (
          <div className="ev-terms">{it.deposit}</div>
        )}

        {/* Cancellation */}
        {it.cancellation && (
          <div className="ev-terms">
            <b>{isEs ? "Cancelación: " : "Cancellation: "}</b>
            {it.cancellation}
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
              [{it.qbCode}][{num(it.price) || ""}]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DAY PAGE
═══════════════════════════════════════════════════════════ */
function DayPage({ kickoff, day, page, total, lang }) {
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="day-band">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span className="day-band-sup">{lang === "es" ? "Día" : "Day"}</span>
            <span className="day-band-title">{day.label}</span>
          </div>
          {day.title && (
            <div style={{
              fontSize: 10, color: "#888", marginTop: 3,
              textTransform: "uppercase", letterSpacing: "1.5px",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {day.title}
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        {day.items.map((it, i) => (
          <EventBlock key={i} it={it} lang={lang}/>
        ))}
      </div>
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

  const [kickoff, setKickoff] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

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

  const hasSummary = days.length > 0;
  const total = 1 + (hasSummary ? 1 : 0) + 1 + days.length;
  let pageNum = 1;

  return (
    <div className="root" style={{ padding: "24px 16px 48px", minHeight: "100vh" }}>
      <style>{CSS}</style>

      {/* ── Floating controls (hidden in print) ── */}
      <div className="no-print" style={{
        position: "fixed", top: 14, right: 14, zIndex: 100,
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <a
          href={`?mode=itinerary&kickoffId=${kickoffId}&lang=${lang === "en" ? "es" : "en"}`}
          style={{
            padding: "7px 13px", borderRadius: 6, border: "1px solid #ddd",
            fontSize: 12, color: "#555", textDecoration: "none", background: "#fff",
            boxShadow: "0 1px 4px rgba(0,0,0,.08)",
          }}
        >
          {lang === "en" ? "🇨🇴 ES" : "🇺🇸 EN"}
        </a>
        <button
          onClick={() => window.print()}
          style={{
            padding: "7px 20px", borderRadius: 6,
            background: "#111", color: "#fff",
            border: "none", fontSize: 12, fontWeight: 600,
            cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.15)",
          }}
        >
          ↓ Download PDF
        </button>
      </div>

      {/* ── Pages ── */}
      <CoverPage
        kickoff={kickoff}
        heroImage={heroImage}
        total={total}
      />

      {hasSummary && (
        <SummaryPage
          kickoff={kickoff}
          days={days}
          page={++pageNum}
          total={total}
        />
      )}

      <InfoPage
        kickoff={kickoff}
        lang={lang}
        page={++pageNum}
        total={total}
      />

      {days.map((day) => (
        <DayPage
          key={day.title}
          kickoff={kickoff}
          day={day}
          page={++pageNum}
          total={total}
          lang={lang}
        />
      ))}

      <div className="no-print" style={{
        textAlign: "center", padding: "20px 16px",
        fontSize: 11, color: "#ccc",
      }}>
        Two Travel · two.travel
      </div>
    </div>
  );
}
