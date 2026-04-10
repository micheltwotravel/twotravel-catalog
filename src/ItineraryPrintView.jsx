// src/ItineraryPrintView.jsx
// Print-ready itinerary — styled to match Travefy's PDF export exactly.
import { useState, useEffect, useMemo } from "react";
import { fetchServicesFromSheet, fetchKickoffsFromSheet } from "./sheetServices";

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */

function formatPrice(n) {
  const num = Number(String(n ?? "").replace(/[^0-9.-]/g, ""));
  if (!num) return "";
  // If over 10000 assume COP, else USD
  return num >= 10000
    ? `${num.toLocaleString("es-CO")}.00`
    : `$${num.toLocaleString("en-US")}.00 USD`;
}
const cl = (v) => String(v ?? "").trim();

function matchCart(cart, catalog) {
  const out = [];
  for (const item of cart || []) {
    const sku = cl(item.sku), nl = cl(item.name).toLowerCase(), id = cl(item.id);
    const svc =
      catalog.find((s) => sku && s.sku === sku) ||
      catalog.find((s) => id  && String(s.id) === id) ||
      catalog.find((s) => nl  && s.name.toLowerCase() === nl) ||
      catalog.find((s) => nl  && s.name.toLowerCase().startsWith(nl)) ||
      (nl.length >= 4 ? catalog.find((s) =>
        s.name.toLowerCase().includes(nl) || nl.includes(s.name.toLowerCase())) : null);
    if (svc) out.push({ cartItem: item, service: svc });
  }
  return out;
}

function buildDays(matched, lang) {
  const map = new Map();
  matched.forEach(({ cartItem, service }, idx) => {
    const key = cl(cartItem?.day || cartItem?.dayLabel || "Itinerary");
    if (!map.has(key)) map.set(key, []);
    const desc = lang === "es"
      ? (service.description?.es || service.description?.en || "")
      : (service.description?.en || service.description?.es || "");
    const price = service.price_tier_1 || service.price_cop || "";
    map.get(key).push({
      sortOrder   : Number(cartItem.sortOrder || idx + 1),
      time        : cl(cartItem.time || cartItem.startTime || service.schedule || ""),
      duration    : cl(service.duration || ""),
      title       : cl(cartItem.title || cartItem.name || service.name),
      description : desc,
      highlights  : service.highlights || [],
      location    : service.location || "",
      address     : service.address || "",
      city        : service.city || "",
      price,
      priceUnit   : service.priceUnit || "",
      deposit     : service.deposit || "",
      cancellation: service.cancellation || "",
      menuUrl     : service.menuUrl || "",
      mapsUrl     : service.mapsUrl || "",
      image       : service.image || "",
      images      : service.images || [],
      category    : service.category || "",
    });
  });
  return Array.from(map.entries()).map(([title, items]) => ({
    title,
    items: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

/* ═══════════════════════════════════════════════
   PRINT CSS — matches Travefy PDF style
═══════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body, .itinerary-root { font-family: 'Inter', Arial, sans-serif; background: #fff; color: #1a1a1a; font-size: 13px; line-height: 1.6; }

  /* ── pages ── */
  .page { padding: 52px 60px 40px; min-height: 100vh; position: relative; }
  .page + .page { border-top: 3px solid #f5f5f5; }

  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    .page { padding: 40px 52px 32px; min-height: unset; page-break-after: always; break-after: page; }
    @page { margin: 0; size: A4; }
  }

  /* ── shared header (top of every page) ── */
  .page-header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 1px solid #d0d0d0; padding-bottom: 14px; margin-bottom: 28px;
  }
  .ph-left { font-size: 11px; color: #555; line-height: 1.7; }
  .ph-left strong { display: block; font-size: 12px; color: #111; }
  .ph-right { text-align: right; font-size: 11px; color: #555; line-height: 1.7; }
  .ph-right strong { display: block; font-size: 13px; font-weight: 700; color: #111; }

  /* ── cover ── */
  .cover-trip-bar {
    background: #1a1a1a; color: #fff;
    border-radius: 0; padding: 32px 40px; margin: 0 -60px 32px;
  }
  .cover-trip-name { font-size: 30px; font-weight: 700; line-height: 1.2; margin-bottom: 4px; }
  .cover-trip-dates { font-size: 13px; color: #aaa; margin-top: 4px; }

  .accom-block { margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #e8e8e8; }
  .accom-block-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 10px; font-weight: 600; }
  .accom-name-big { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .accom-addr-line { font-size: 12px; color: #666; margin-bottom: 12px; }
  .accom-meta { display: flex; gap: 32px; font-size: 12px; color: #555; }
  .accom-meta-label { font-weight: 600; color: #333; display: block; }

  .cover-note { font-size: 13px; color: #444; line-height: 1.75; max-width: 580px; margin-bottom: 20px; }
  .cover-bottom-note {
    font-size: 11.5px; color: #555; border-top: 1px solid #e0e0e0;
    padding-top: 16px; margin-top: 20px; line-height: 1.75;
  }

  /* ── summary page ── */
  .sum-day-header {
    font-size: 12.5px; font-weight: 700; color: #111;
    margin-top: 22px; margin-bottom: 8px;
    padding-bottom: 4px; border-bottom: 1px solid #e0e0e0;
  }
  .sum-row { display: flex; gap: 16px; font-size: 12.5px; margin-bottom: 5px; color: #333; }
  .sum-time { min-width: 52px; color: #777; font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .sum-name { font-weight: 500; }
  .sum-loc  { color: #aaa; font-size: 11.5px; margin-left: 4px; }

  /* ── info page ── */
  .info-section { margin-bottom: 24px; max-width: 600px; }
  .info-section h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
  .info-section p  { font-size: 13px; color: #444; line-height: 1.75; }
  .promo-box {
    margin-top: 24px; padding: 16px 20px; border: 1px solid #e0e0e0;
    border-radius: 4px; font-size: 12.5px; color: #555; line-height: 1.8; max-width: 500px;
  }

  /* ── day page ── */
  .day-title {
    font-size: 14px; font-weight: 700; color: #111;
    border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 28px;
    line-height: 1.4;
  }

  /* ── item block — matches Travefy exactly ── */
  .item-block { margin-bottom: 0; padding-bottom: 28px; }
  .item-block + .item-block { border-top: 1px solid #e0e0e0; padding-top: 28px; }

  .item-time-line {
    font-size: 12px; color: #555; margin-bottom: 6px; font-weight: 500;
  }
  .item-title-row {
    display: flex; justify-content: space-between; align-items: flex-start;
    gap: 20px; margin-bottom: 8px;
  }
  .item-title { font-size: 16px; font-weight: 700; color: #111; line-height: 1.3; }
  .item-subtitle { font-size: 11.5px; color: #777; margin-top: 3px; }

  .price-col { text-align: right; flex-shrink: 0; min-width: 100px; }
  .price-col-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #555; display: block; margin-bottom: 2px; }
  .price-col-value { font-size: 15px; font-weight: 700; color: #111; }

  .menu-link { font-size: 12px; color: #2563eb; text-decoration: underline; display: block; margin-bottom: 12px; }

  .item-image { width: 100%; max-height: 200px; object-fit: cover; border-radius: 4px; margin-bottom: 14px; display: block; }

  .item-desc { font-size: 13px; color: #333; line-height: 1.75; margin-bottom: 14px; max-width: 620px; }

  .highlights-title { font-size: 12.5px; font-weight: 700; margin-bottom: 6px; margin-top: 8px; }
  .hi-item { display: flex; gap: 8px; font-size: 12.5px; color: #444; margin-bottom: 3px; }
  .hi-bullet { flex-shrink: 0; }

  .includes-title { font-size: 12.5px; font-weight: 700; margin-bottom: 6px; margin-top: 12px; }

  .price-per-person { font-size: 12.5px; color: #333; margin-top: 8px; margin-bottom: 8px; }

  .terms-block {
    font-size: 12px; color: #555; margin-top: 10px; line-height: 1.7; max-width: 580px;
  }
  .terms-label { font-weight: 700; color: #333; }

  .deposit-warn {
    font-size: 12px; color: #555; margin-top: 10px; line-height: 1.7; max-width: 580px;
    font-style: italic;
  }

  .item-location-block { margin-top: 14px; }
  .item-location-name { font-size: 12.5px; font-weight: 600; color: #333; }
  .item-location-addr { font-size: 11.5px; color: #777; margin-top: 1px; }
  .item-location-link { font-size: 11.5px; color: #2563eb; text-decoration: underline; display: inline-block; margin-top: 2px; }

  /* ── page footer ── */
  .page-footer {
    display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid #e0e0e0; padding-top: 12px; margin-top: 32px;
    font-size: 11px; color: #aaa;
  }
`;

/* ═══════════════════════════════════════════════
   SHARED PAGE HEADER (top of every page)
═══════════════════════════════════════════════ */
function PageHeader({ kickoff }) {
  const c = kickoff;
  return (
    <div className="page-header">
      <div className="ph-left">
        {c.assignedConciergeName && <strong>{c.assignedConciergeName}</strong>}
        {c.assignedConciergeEmail && <span>{c.assignedConciergeEmail}</span>}
        {c.conciergeTitle && <span>{c.conciergeTitle}</span>}
        <span>https://two.travel/</span>
      </div>
      <div className="ph-right">
        <strong>Two Travel</strong>
      </div>
    </div>
  );
}

function PageFooter({ page, total }) {
  return (
    <div className="page-footer">
      <span></span>
      {total > 0 && <span>Page {page} of {total}</span>}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   COVER PAGE
═══════════════════════════════════════════════ */
function CoverPage({ kickoff, days, lang, totalPages }) {
  const accom = kickoff.accommodations?.[0];
  const tripLabel = kickoff.tripName || `${kickoff.guestName || "Guest"} ${lang === "es" ? "Viaje" : "Concierge"}`;
  const dates = kickoff.tripDates || "";

  return (
    <div className="page" style={{ display: "flex", flexDirection: "column" }}>
      <PageHeader kickoff={kickoff} />

      {/* Dark trip title bar */}
      <div className="cover-trip-bar">
        <div className="cover-trip-name">
          {kickoff.guestName ? `${kickoff.guestName} ${tripLabel}` : tripLabel}
        </div>
        {dates && <div className="cover-trip-dates">{dates}</div>}
      </div>

      {/* Accommodation */}
      {accom && (
        <div className="accom-block">
          <div className="accom-block-title">{accom.name}</div>
          {accom.address && <div className="accom-addr-line">{accom.address}</div>}
          {(accom.city || accom.department) && (
            <div className="accom-addr-line">
              {[accom.city, accom.department].filter(Boolean).join(" — ")}
            </div>
          )}
          <div style={{ marginBottom: 8, marginTop: 4 }}>___</div>
          {accom.guests && <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>{accom.guests}</div>}
          <div style={{ borderBottom: "1px solid #eee", marginBottom: 8 }} />
          <div className="accom-meta">
            {accom.checkin && (
              <div>
                <span className="accom-meta-label">Check-in: {accom.checkin}</span>
              </div>
            )}
            {accom.checkout && (
              <div>
                <span className="accom-meta-label">Check out: {accom.checkout}</span>
              </div>
            )}
          </div>
          {accom.notes && (
            <div style={{ fontSize: 12, color: "#555", marginTop: 12, lineHeight: 1.7 }}>
              {accom.notes}
            </div>
          )}
        </div>
      )}

      {/* Concierge summary */}
      {kickoff.conciergeSummary && (
        <p className="cover-note">{kickoff.conciergeSummary}</p>
      )}

      <div style={{ flex: 1 }} />

      <div className="cover-bottom-note">
        ___<br />
        All reservations are under Two Travel - {kickoff.guestName || "Guest"}. Once a reservation has
        been confirmed, a cancellation fee may apply to certain experiences.
      </div>

      <PageFooter page={1} total={totalPages} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TRIP SUMMARY PAGE
═══════════════════════════════════════════════ */
function SummaryPage({ kickoff, days, lang, page, totalPages }) {
  return (
    <div className="page">
      <PageHeader kickoff={kickoff} />
      <div className="day-title" style={{ fontSize: 17, marginBottom: 20 }}>Trip Summary</div>

      {days.map((day) => (
        <div key={day.title}>
          <div className="sum-day-header">{day.title}</div>
          {day.items.map((item, i) => (
            <div key={i} className="sum-row">
              <span className="sum-time">{item.time || ""}</span>
              <span>
                <span className="sum-name">{item.title}</span>
                {item.location && <span className="sum-loc"> — {item.location}</span>}
              </span>
            </div>
          ))}
        </div>
      ))}

      <PageFooter page={page} total={totalPages} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   INFORMATION & DOCUMENTS PAGE
═══════════════════════════════════════════════ */
function InfoPage({ kickoff, lang, page, totalPages }) {
  const city = kickoff.city || kickoff.tripName?.split(" ")?.[0] || "Your Destination";

  return (
    <div className="page">
      <PageHeader kickoff={kickoff} />
      <div className="day-title" style={{ fontSize: 17, marginBottom: 20 }}>
        {lang === "es" ? `Información & Documentos — ${city}` : `Information & Documents`}
      </div>

      <div className="info-section">
        <h3>{lang === "es" ? `Bienvenido a ${city} - Two Travel.` : `Welcome to ${city} - Two Travel.`}</h3>
        <p style={{ marginTop: 8 }}>
          {lang === "es"
            ? "Por favor revisa este PDF antes de tu llegada. Contiene información útil para tu viaje."
            : "Please take a look at this PDF before your arrival. It contains some information that might be helpful during your trip."}
        </p>
      </div>

      <div className="info-section">
        <h3>{lang === "es" ? "Cómo Leer Este Itinerario" : "How to Read This Itinerary"}</h3>
        <p style={{ marginTop: 8 }}>
          {lang === "es"
            ? "Este es un itinerario en BORRADOR, lo que significa que todo puede ajustarse. Podemos cambiar, añadir o eliminar actividades según lo que más te entusiasme. En nuestra próxima reunión lo revisaremos juntos y lo ajustaremos en consecuencia."
            : "This is a DRAFT itinerary, which means everything can be adjusted. We can change, add, or remove activities based on what excites you most. As you review it, I encourage you to focus on what truly interests you. In our next meeting, we'll go through it together and refine it accordingly."}
        </p>
      </div>

      {kickoff.conciergeSummary && (
        <div className="info-section">
          <p>{kickoff.conciergeSummary}</p>
        </div>
      )}

      <div className="promo-box">
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Promo!</div>
        <p>
          {lang === "es"
            ? "Muéstrale a todos lo increíble que es viajar con el servicio de concierge de Two Travel y obtén descuentos en nuestras experiencias!"
            : "Show everyone how amazing it is to travel with Two Travel's concierge service and get discounts on our experiences!"}
        </p>
        <div style={{ marginTop: 10, fontSize: 12 }}>
          📱 Follow us: @twotravelconcierge<br />
          📍 Instagram | TikTok
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "#777" }}>
          {lang === "es"
            ? "La publicación debe hacerse durante tu estadía. Se requiere una etiqueta por persona."
            : "The post must be made during your stay in the city. One tag per person is required to redeem the service discount."}
        </div>
      </div>

      <PageFooter page={page} total={totalPages} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   ITEM BLOCK — matches Travefy service block exactly
═══════════════════════════════════════════════ */
function ItemBlock({ item, lang }) {
  const priceVal = formatPrice(item.price);
  const highlights = Array.isArray(item.highlights)
    ? item.highlights
    : String(item.highlights || "").split(/[•\n]+/).map((h) => h.trim()).filter(Boolean);
  const durationLabel = item.duration
    ? ` - ${item.duration} - Colombia Standard Time`
    : " - Colombia Standard Time";

  return (
    <div className="item-block">
      {/* Time line */}
      {item.time && (
        <div className="item-time-line">
          {item.time}{durationLabel}
        </div>
      )}

      {/* Title + PRICE */}
      <div className="item-title-row">
        <div style={{ flex: 1 }}>
          <div className="item-title">{item.title}</div>
          {item.location && (
            <div className="item-subtitle">{item.location}</div>
          )}
        </div>
        {priceVal && (
          <div className="price-col">
            <span className="price-col-label">PRICE</span>
            <div className="price-col-value">{priceVal}</div>
          </div>
        )}
      </div>

      {/* Menu link */}
      {item.menuUrl && (
        <a href={item.menuUrl} className="menu-link" target="_blank" rel="noreferrer">
          Menu
        </a>
      )}

      {/* Image */}
      {item.image && (
        <img
          src={item.image}
          alt={item.title}
          className="item-image"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      )}

      {/* Description */}
      {item.description && (
        <p className="item-desc">{item.description}</p>
      )}

      {/* Trip Highlights */}
      {highlights.length > 0 && (
        <div>
          <div className="highlights-title">
            {lang === "es" ? "Aspectos Destacados:" : "Trip Highlights:"}
          </div>
          {highlights.map((h, i) => (
            <div key={i} className="hi-item">
              <span className="hi-bullet">{item.category?.toLowerCase().includes("tour") ? "✓" : "•"}</span>
              <span>{h}</span>
            </div>
          ))}
        </div>
      )}

      {/* Deposit */}
      {item.deposit && (
        <p className="deposit-warn">
          {item.deposit}
        </p>
      )}

      {/* Cancellation / Terms */}
      {item.cancellation && (
        <div className="terms-block">
          <span className="terms-label">
            {lang === "es" ? "Términos y Condiciones: " : "Terms and Conditions: "}
          </span>
          {item.cancellation}
        </div>
      )}

      {/* Location block (venue name + address at bottom) */}
      {(item.location || item.address || item.city || item.mapsUrl) && (
        <div className="item-location-block">
          {item.location && <div className="item-location-name">{item.location}</div>}
          {item.address && <div className="item-location-addr">{item.address}{item.city ? `, ${item.city}` : ""}</div>}
          {!item.address && item.city && <div className="item-location-addr">{item.city}</div>}
          {item.mapsUrl && (
            <a href={item.mapsUrl} className="item-location-link" target="_blank" rel="noreferrer">
              {lang === "es" ? "Ver en mapa" : "View on map"}
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   DAY PAGE
═══════════════════════════════════════════════ */
function DayPage({ kickoff, day, page, totalPages, lang }) {
  return (
    <div className="page">
      <PageHeader kickoff={kickoff} />
      <div className="day-title">{day.title}</div>
      {day.items.map((item, i) => (
        <ItemBlock key={i} item={item} lang={lang} />
      ))}
      <PageFooter page={page} total={totalPages} />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════ */
export default function ItineraryPrintView() {
  const params    = new URLSearchParams(window.location.search);
  const kickoffId = params.get("kickoffId");
  const lang      = params.get("lang") === "es" ? "es" : "en";

  const [kickoff,  setKickoff]  = useState(null);
  const [catalog,  setCatalog]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  useEffect(() => {
    if (!kickoffId) { setError("No kickoffId in URL"); setLoading(false); return; }
    Promise.all([
      fetchKickoffsFromSheet().then((list) => list.find((k) => String(k.id) === String(kickoffId))),
      fetchServicesFromSheet(),
    ])
      .then(([k, cats]) => {
        if (!k) throw new Error(`Kickoff ${kickoffId} not found`);
        setKickoff(k); setCatalog(cats);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [kickoffId]);

  const days = useMemo(() => {
    if (!kickoff || !catalog.length) return [];
    return buildDays(matchCart(kickoff.cart, catalog), lang);
  }, [kickoff, catalog, lang]);

  /* loading / error */
  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, fontFamily: "sans-serif", color: "#888" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #eee", borderTopColor: "#333", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ fontSize: 14 }}>Building itinerary…</p>
    </div>
  );
  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#c00", fontSize: 14 }}>
      {error}
    </div>
  );
  if (!kickoff) return null;

  const hasInfo = !!(kickoff.conciergeSummary || kickoff.internalNotes);
  // page count: cover + summary + (info?) + one page per day
  const totalPages = 1 + (days.length > 0 ? 1 : 0) + (hasInfo ? 1 : 0) + days.length;

  return (
    <div className="itinerary-root">
      <style>{CSS}</style>

      {/* Print / lang controls */}
      <div className="no-print" style={{ position: "fixed", top: 16, right: 16, zIndex: 100, display: "flex", gap: 8 }}>
        <a
          href={`?mode=itinerary&kickoffId=${kickoffId}&lang=${lang === "en" ? "es" : "en"}`}
          style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid #d0d0d0", fontSize: 12, color: "#555", textDecoration: "none", background: "#fff" }}
        >
          {lang === "en" ? "🇨🇴 ES" : "🇺🇸 EN"}
        </a>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 20px", borderRadius: 6, background: "#111", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          ⬇ Save as PDF
        </button>
      </div>

      {/* Pages */}
      <CoverPage kickoff={kickoff} days={days} lang={lang} totalPages={totalPages} />

      {days.length > 0 && (
        <SummaryPage kickoff={kickoff} days={days} lang={lang} page={2} totalPages={totalPages} />
      )}

      {hasInfo && (
        <InfoPage kickoff={kickoff} lang={lang} page={days.length > 0 ? 3 : 2} totalPages={totalPages} />
      )}

      {days.map((day, i) => {
        const pg = 1 + (days.length > 0 ? 1 : 0) + (hasInfo ? 1 : 0) + i + 1;
        return (
          <DayPage key={day.title} kickoff={kickoff} day={day} page={pg} totalPages={totalPages} lang={lang} />
        );
      })}

      <div className="no-print" style={{ textAlign: "center", padding: "28px 16px", fontSize: 12, color: "#ccc" }}>
        Generated by Two Travel · https://two.travel/
      </div>
    </div>
  );
}
