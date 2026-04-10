// src/ItineraryPrintView.jsx
// Replica exacta del PDF que genera Travefy — Two Travel Concierge
import { useState, useEffect, useMemo } from "react";
import { fetchServicesFromSheet, fetchKickoffsFromSheet } from "./sheetServices";

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const cl  = (v) => String(v ?? "").trim();
const num = (v) => { const n = Number(cl(v).replace(/[^0-9.-]/g,"")); return isNaN(n)?0:n; };

function fmtPrice(v) {
  const n = num(v);
  if (!n) return "";
  return n >= 10000 ? `$${n.toLocaleString("es-CO")}.00` : `$${n.toLocaleString("en-US")}.00 USD`;
}

function matchCart(cart, catalog) {
  const out = [];
  for (const item of (cart || [])) {
    const sku = cl(item.sku), id = cl(item.id), nl = cl(item.name).toLowerCase();
    const s =
      catalog.find(s => sku && s.sku === sku) ||
      catalog.find(s => id  && String(s.id) === id) ||
      catalog.find(s => nl  && s.name.toLowerCase() === nl) ||
      catalog.find(s => nl  && s.name.toLowerCase().startsWith(nl)) ||
      (nl.length >= 4 ? catalog.find(s =>
        s.name.toLowerCase().includes(nl) || nl.includes(s.name.toLowerCase())) : null);
    if (s) out.push({ cartItem: item, service: s });
  }
  return out;
}

function buildDays(matched, lang) {
  const map = new Map();
  matched.forEach(({ cartItem, service }, idx) => {
    const key = cl(cartItem?.day || cartItem?.dayLabel || "Itinerary");
    if (!map.has(key)) map.set(key, []);
    const desc = lang === "es"
      ? (service.description?.es || service.descriptionEs || service.description?.en || service.descriptionEn || "")
      : (service.description?.en || service.descriptionEn || service.description?.es || service.descriptionEs || "");
    map.get(key).push({
      sort        : Number(cartItem.sortOrder ?? idx),
      time        : cl(cartItem.time || cartItem.startTime || service.schedule || ""),
      duration    : cl(service.duration || ""),
      title       : cl(cartItem.title || cartItem.name || service.name),
      description : desc,
      highlights  : service.highlights || "",
      includes    : service.includes   || "",
      location    : service.location   || "",
      address     : service.address    || "",
      city        : service.city       || "",
      price       : service.price_cop  || service.priceCop || service.price_tier_1 || service.priceTier1 || "",
      priceUnit   : service.priceUnit  || "",
      deposit     : service.deposit    || "",
      cancellation: service.cancellation || "",
      menuUrl     : service.menuUrl    || "",
      mapsUrl     : service.mapsUrl    || "",
      image       : service.image      || "",
      qbCode      : service.quickbooksCode || service.quickbooks_code || "",
    });
  });
  return [...map.entries()].map(([title, items]) => ({
    title,
    items: [...items].sort((a, b) => a.sort - b.sort),
  }));
}

function splitList(v) {
  return cl(v).split(/[\n•·\/;|]+/).map(s=>s.replace(/^[-–]\s*/,"").trim()).filter(Boolean);
}

/* ─────────────────────────────────────────────
   CSS — identical to Travefy's PDF output
───────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body,.root{font-family:'Inter',Arial,sans-serif;background:#fff;color:#111;font-size:12.5px;line-height:1.65;}

  .page{padding:48px 56px 36px;min-height:100vh;position:relative;}
  .page+.page{border-top:3px solid #f0f0f0;}

  @media print{
    body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
    .no-print{display:none!important;}
    .page{padding:36px 48px 28px;min-height:unset;page-break-after:always;break-after:page;}
    @page{margin:0;size:A4;}
  }

  /* shared header */
  .ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #ccc;padding-bottom:12px;margin-bottom:24px;}
  .ph-left{font-size:11px;color:#444;line-height:1.8;}
  .ph-left b{display:block;font-size:12px;color:#111;}
  .ph-right{font-size:11px;color:#444;text-align:right;line-height:1.8;}
  .ph-right b{font-size:13px;font-weight:700;}

  /* cover */
  .cover-title{font-size:22px;font-weight:700;margin-bottom:4px;line-height:1.2;}
  .cover-dates{font-size:12.5px;color:#555;margin-bottom:20px;}

  .accom{border-top:1px solid #ddd;padding-top:16px;margin-bottom:20px;}
  .accom-name{font-size:14px;font-weight:600;margin-bottom:3px;}
  .accom-addr{font-size:12px;color:#666;margin-bottom:8px;}
  .accom-sep{color:#aaa;margin:6px 0;}
  .accom-row{font-size:12px;color:#444;margin-bottom:2px;}

  .cover-note{font-size:12.5px;color:#444;line-height:1.75;margin-bottom:14px;max-width:600px;}
  .cover-bottom{font-size:12px;color:#555;border-top:1px solid #ddd;padding-top:14px;margin-top:20px;line-height:1.7;}

  /* page footer */
  .pf{display:flex;justify-content:space-between;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:10px;margin-top:28px;}

  /* trip summary */
  .sum-day{font-size:12.5px;font-weight:700;margin-top:18px;margin-bottom:6px;line-height:1.4;}
  .sum-row{display:flex;gap:14px;font-size:12px;color:#333;margin-bottom:3px;}
  .sum-time{min-width:48px;color:#888;flex-shrink:0;font-variant-numeric:tabular-nums;}
  .sum-name{flex:1;}
  .sum-loc{color:#aaa;font-size:11px;}

  /* info page */
  .info-h3{font-size:13px;font-weight:700;margin-bottom:6px;margin-top:16px;}
  .info-p{font-size:12.5px;color:#444;line-height:1.75;max-width:600px;margin-bottom:8px;}

  /* day header — plain bold underlined, no black band */
  .day-header{font-size:13px;font-weight:700;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:24px;line-height:1.4;}

  /* event block */
  .ev{padding-bottom:24px;margin-bottom:0;}
  .ev+.ev{border-top:1px solid #ddd;padding-top:24px;}

  .ev-time{font-size:12px;color:#555;margin-bottom:5px;font-weight:500;}
  .ev-titlerow{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:6px;}
  .ev-name{font-size:15px;font-weight:700;line-height:1.3;}
  .ev-loc-sub{font-size:11.5px;color:#777;margin-top:2px;}

  .price-col{text-align:right;flex-shrink:0;}
  .price-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#555;display:block;margin-bottom:2px;}
  .price-val{font-size:15px;font-weight:700;}

  .menu-link{font-size:12px;color:#1d4ed8;text-decoration:underline;display:block;margin-bottom:12px;}
  .ev-img{width:100%;max-height:180px;object-fit:cover;border-radius:3px;margin-bottom:12px;display:block;}
  .ev-desc{font-size:12.5px;color:#333;line-height:1.75;margin-bottom:12px;max-width:600px;}

  .ev-section-title{font-size:12.5px;font-weight:700;margin-bottom:4px;margin-top:10px;}
  .ev-list-item{font-size:12.5px;color:#444;margin-bottom:2px;padding-left:12px;}

  .ev-terms{font-size:12px;color:#555;line-height:1.7;margin-top:10px;max-width:580px;}
  .ev-terms-label{font-weight:700;color:#333;}

  .ev-addr{margin-top:12px;}
  .ev-addr-name{font-size:12.5px;font-weight:600;}
  .ev-addr-line{font-size:11.5px;color:#777;}
  .ev-map-link{font-size:11.5px;color:#1d4ed8;text-decoration:underline;}

  .qb-ref{font-size:11px;color:#888;margin-top:8px;font-family:monospace;}
`;

/* ─────────────────────────────────────────────
   SHARED PAGE HEADER
───────────────────────────────────────────── */
function PH({ kickoff }) {
  return (
    <div className="ph">
      <div className="ph-left">
        {kickoff.assignedConciergeName && <b>{kickoff.assignedConciergeName}</b>}
        {kickoff.assignedConciergeEmail && <span>{kickoff.assignedConciergeEmail}<br/></span>}
        {kickoff.conciergeTitle && <span>{kickoff.conciergeTitle}<br/></span>}
        <span>https://two.travel/</span>
      </div>
      <div className="ph-right"><b>Two Travel</b></div>
    </div>
  );
}

function PF({ n, total }) {
  return <div className="pf"><span/>{total > 0 && <span>Page {n} of {total}</span>}</div>;
}

/* ─────────────────────────────────────────────
   PAGE 1: COVER
───────────────────────────────────────────── */
function CoverPage({ kickoff, days, total }) {
  const a = kickoff;
  const titleParts = [a.guestName, a.city, a.tripName].filter(Boolean);
  const titleLine  = titleParts.length ? titleParts.join(" ") : "Two Travel Concierge";

  return (
    <div className="page">
      <PH kickoff={kickoff}/>

      <div className="cover-title">{titleLine}</div>
      {a.tripDates && <div className="cover-dates">{a.tripDates}</div>}

      {/* Accommodation block */}
      {a.accommodationName && (
        <div className="accom">
          <div className="accom-name">{a.accommodationName}</div>
          {a.accommodationAddr && <div className="accom-addr">{a.accommodationAddr}</div>}
          <div className="accom-sep">___</div>
          {a.groupSize && <div className="accom-row">{a.groupSize}</div>}
          <div className="accom-sep">__</div>
          {a.checkIn  && <div className="accom-row">Check-in: {a.checkIn}</div>}
          {a.checkOut && <div className="accom-row">Check out: {a.checkOut}</div>}
          {(a.checkIn || a.checkOut) && <div className="accom-sep">__</div>}
        </div>
      )}

      {a.conciergeSummary && <p className="cover-note">{a.conciergeSummary}</p>}

      <div style={{flex:1}}/>
      <div className="cover-bottom">
        ___<br/>
        All reservations are under Two Travel - {a.guestName || "Guest"}.
        Once a reservation has been confirmed, a cancellation fee may apply to certain experiences.
      </div>
      <PF n={1} total={total}/>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE 2: TRIP SUMMARY
───────────────────────────────────────────── */
function SummaryPage({ kickoff, days, page, total }) {
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="day-header" style={{fontSize:16,borderBottom:"2px solid #111",marginBottom:20}}>
        Trip Summary
      </div>
      {days.map(day => (
        <div key={day.title}>
          <div className="sum-day">{day.title}</div>
          {day.items.map((it, i) => (
            <div key={i} className="sum-row">
              <span className="sum-time">{it.time}</span>
              <span className="sum-name">
                {it.title}
                {it.location && <span className="sum-loc"> - {it.location}</span>}
              </span>
            </div>
          ))}
        </div>
      ))}
      <PF n={page} total={total}/>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PAGE 3: INFORMATION & DOCUMENTS
───────────────────────────────────────────── */
function InfoPage({ kickoff, lang, page, total }) {
  const city = kickoff.city || kickoff.tripName?.split(" ")[0] || "your destination";
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="day-header" style={{fontSize:16,borderBottom:"2px solid #111",marginBottom:20}}>
        Information &amp; Documents
      </div>

      <p className="info-p" style={{fontWeight:600}}>
        Welcome to {city} - Two Travel.
      </p>
      <p className="info-p">
        Please take a look at this PDF before your arrival. It contains some information that might be helpful during your trip.
      </p>

      <div className="info-h3">How to Read This Itinerary</div>
      <p className="info-p">
        This is a DRAFT itinerary, which means everything can be adjusted. We can change, add, or remove
        activities based on what excites you most.
      </p>
      <p className="info-p">
        As you review it, I encourage you to focus on what truly interests you, what you'd love to experience,
        repeat, or maybe skip. The goal is to design the perfect trip for you.
      </p>
      <p className="info-p">
        In our next meeting, we'll go through it together and refine it accordingly. Please come prepared with
        your questions and ideas.
      </p>

      <div className="info-h3">Promo!</div>
      <p className="info-p">
        Show everyone how amazing it is to travel with Two Travel's concierge service and get discounts on our
        experiences! ✨
      </p>
      <p className="info-p">
        📱 Follow us: @twotravelconcierge<br/>
        📍 Instagram | TikTok
      </p>
      <p className="info-p" style={{color:"#666",fontSize:12}}>
        Note:<br/>
        The post must be made during your stay in the city.<br/>
        One tag per person is required to redeem the service discount.<br/>
        For group services, all members must participate to apply the discount.
      </p>

      <PF n={page} total={total}/>
    </div>
  );
}

/* ─────────────────────────────────────────────
   EVENT BLOCK — matches Travefy PDF exactly
───────────────────────────────────────────── */
function EventBlock({ it, lang }) {
  const price    = fmtPrice(it.price);
  const hiList   = splitList(it.highlights);
  const incList  = splitList(it.includes);
  const timeLine = it.time
    ? `${it.time}${it.duration ? ` - ${it.duration}` : ""} - Colombia Standard Time`
    : "";

  return (
    <div className="ev">
      {timeLine && <div className="ev-time">{timeLine}</div>}

      <div className="ev-titlerow">
        <div>
          <div className="ev-name">{it.title}</div>
          {it.location && <div className="ev-loc-sub">{it.location}</div>}
        </div>
        {price && (
          <div className="price-col">
            <span className="price-label">PRICE</span>
            <div className="price-val">{price}</div>
          </div>
        )}
      </div>

      {it.menuUrl && (
        <a href={it.menuUrl} className="menu-link" target="_blank" rel="noreferrer">Menu</a>
      )}

      {it.image && (
        <img src={it.image} alt={it.title} className="ev-img"
          onError={e => e.target.style.display="none"}/>
      )}

      {it.description && <p className="ev-desc">{it.description}</p>}

      {hiList.length > 0 && (
        <>
          <div className="ev-section-title">
            {lang === "es" ? "Aspectos Destacados:" : "Trip Highlights:"}
          </div>
          {hiList.map((h,i) => <div key={i} className="ev-list-item">• {h}</div>)}
        </>
      )}

      {incList.length > 0 && (
        <>
          <div className="ev-section-title">
            {lang === "es" ? "Incluye:" : "Includes:"}
          </div>
          {incList.map((h,i) => <div key={i} className="ev-list-item">• {h}</div>)}
        </>
      )}

      {it.deposit && (
        <p className="ev-terms" style={{marginTop:10}}>{it.deposit}</p>
      )}

      {it.cancellation && (
        <div className="ev-terms">
          <span className="ev-terms-label">
            {lang === "es" ? "Política de Cancelación" : "Cancellation Policy"}
          </span><br/>
          {it.cancellation}
        </div>
      )}

      {(it.location || it.address || it.mapsUrl) && (
        <div className="ev-addr">
          {it.location && <div className="ev-addr-name">{it.location}</div>}
          {it.address  && <div className="ev-addr-line">{it.address}{it.city ? `, ${it.city}` : ""}</div>}
          {!it.address && it.city && <div className="ev-addr-line">{it.city}</div>}
          {it.mapsUrl  && (
            <a href={it.mapsUrl} className="ev-map-link" target="_blank" rel="noreferrer">
              {lang === "es" ? "Ver en mapa" : "View on map"}
            </a>
          )}
        </div>
      )}

      {it.qbCode && (
        <div className="qb-ref">
          [{it.qbCode}][{num(it.price) || ""}]
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   DAY PAGE
───────────────────────────────────────────── */
function DayPage({ kickoff, day, page, total, lang }) {
  return (
    <div className="page">
      <PH kickoff={kickoff}/>
      <div className="day-header">{day.title}</div>
      {day.items.map((it, i) => <EventBlock key={i} it={it} lang={lang}/>)}
      <PF n={page} total={total}/>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN
───────────────────────────────────────────── */
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
      fetchKickoffsFromSheet().then(list => list.find(k => String(k.id) === String(kickoffId))),
      fetchServicesFromSheet(),
    ])
      .then(([k, cats]) => { if (!k) throw new Error("Kickoff not found"); setKickoff(k); setCatalog(cats); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [kickoffId]);

  const days = useMemo(() => {
    if (!kickoff || !catalog.length) return [];
    return buildDays(matchCart(kickoff.cart, catalog), lang);
  }, [kickoff, catalog, lang]);

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif",color:"#888",flexDirection:"column",gap:12}}>
      <div style={{width:28,height:28,borderRadius:"50%",border:"3px solid #eee",borderTopColor:"#333",animation:"spin .8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{fontSize:13}}>Building itinerary…</p>
    </div>
  );

  if (error) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"sans-serif",color:"#c00",fontSize:13}}>
      {error}
    </div>
  );
  if (!kickoff) return null;

  // total pages: cover + summary + info + one per day
  const total = 1 + (days.length > 0 ? 1 : 0) + 1 + days.length;

  return (
    <div className="root">
      <style>{CSS}</style>

      {/* Controls */}
      <div className="no-print" style={{position:"fixed",top:14,right:14,zIndex:100,display:"flex",gap:8}}>
        <a href={`?mode=itinerary&kickoffId=${kickoffId}&lang=${lang==="en"?"es":"en"}`}
           style={{padding:"7px 13px",borderRadius:6,border:"1px solid #ccc",fontSize:12,color:"#555",textDecoration:"none",background:"#fff"}}>
          {lang === "en" ? "🇨🇴 ES" : "🇺🇸 EN"}
        </a>
        <button onClick={() => window.print()}
          style={{padding:"7px 18px",borderRadius:6,background:"#111",color:"#fff",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>
          ⬇ PDF
        </button>
      </div>

      <CoverPage   kickoff={kickoff} days={days} total={total}/>
      {days.length > 0 && <SummaryPage kickoff={kickoff} days={days} page={2} total={total}/>}
      <InfoPage    kickoff={kickoff} lang={lang} page={3} total={total}/>
      {days.map((day, i) => (
        <DayPage key={day.title} kickoff={kickoff} day={day}
          page={4 + i} total={total} lang={lang}/>
      ))}

      <div className="no-print" style={{textAlign:"center",padding:"24px 16px",fontSize:11,color:"#ccc"}}>
        Two Travel · https://two.travel/
      </div>
    </div>
  );
}
