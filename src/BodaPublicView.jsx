import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

/* ── Venue floor-plan registry ─────────────────────────── */
const VENUE_PLANS = {
  "Baluarte SFJ": [
    { label: "Plano general",            img: "/venue-floors/baluarte-sfj/plano.jpg" },
    { label: "Vista 1",                  img: "/venue-floors/baluarte-sfj/vista1.jpg" },
    { label: "Vista 2",                  img: "/venue-floors/baluarte-sfj/vista2.jpg" },
  ],
  "Baluarte Santiago Apóstol": [
    { label: "Plano",                    img: "/venue-floors/baluarte-santiago-apostol/plano.jpg" },
  ],
  "Casa Cochera del Gobernador": [
    { label: "Salón AC",                 img: "/venue-floors/casa-cochera-gobernador/salon.jpg" },
    { label: "Rooftop",                  img: "/venue-floors/casa-cochera-gobernador/rooftop.jpg" },
    { label: "Terraza",                  img: "/venue-floors/casa-cochera-gobernador/terraza.jpg" },
  ],
  "Casa Córdoba Cabal": [
    { label: "Segundo piso",             img: "/venue-floors/casa-cordoba-cabal/segundo-piso.jpg" },
    { label: "Tercer piso",              img: "/venue-floors/casa-cordoba-cabal/tercer-piso.jpg" },
    { label: "Terraza",                  img: "/venue-floors/casa-cordoba-cabal/terraza.jpg" },
  ],
  "Casa El Rosal": [
    { label: "Plano 1",                  img: "/venue-floors/casa-el-rosal/plano1.jpg" },
    { label: "Plano 2",                  img: "/venue-floors/casa-el-rosal/plano2.jpg" },
    { label: "Plano 3",                  img: "/venue-floors/casa-el-rosal/plano3.jpg" },
  ],
  "Casa Estrella": [
    { label: "Segundo piso",             img: "/venue-floors/casa-estrella/segundo-piso.png" },
    { label: "Segundo piso (detalle)",   img: "/venue-floors/casa-estrella/segundo-piso-detalle.jpg" },
  ],
  "Casa Santiago Botero": [
    { label: "Overview",                 img: "/venue-floors/casa-santiago-botero/overview.jpg" },
    { label: "Primer piso",              img: "/venue-floors/casa-santiago-botero/primer-piso.jpg" },
    { label: "Primer piso (detalle)",    img: "/venue-floors/casa-santiago-botero/primer-piso-detalle.jpg" },
    { label: "Rooftop",                  img: "/venue-floors/casa-santiago-botero/rooftop.jpg" },
  ],
  "Museo Naval": [
    { label: "Piso 1",                   img: "/venue-floors/museo-naval/piso1.jpg" },
    { label: "Piso 2",                   img: "/venue-floors/museo-naval/piso2.jpg" },
  ],
  "Restaurante Fuerte del Pastelillo": [
    { label: "Plano general",            img: "/venue-floors/restaurante-pastelillo/plano.jpg" },
    { label: "Muelle + Restaurante",     img: "/venue-floors/restaurante-pastelillo/muelle.jpg" },
    { label: "Medidas",                  img: "/venue-floors/restaurante-pastelillo/medidas.jpg" },
    { label: "Zona de cañones",          img: "/venue-floors/restaurante-pastelillo/canones.jpg" },
  ],
};

/* ── Palette ────────────────────────────────────────────── */
const T = {
  bg:      "#FAF8F5",
  ink:     "#1A1814",
  ink2:    "#3D3A35",
  muted:   "#8B8580",
  gold:    "#9A7D52",
  gold2:   "#C4A272",
  gold3:   "#E8D5B7",
  border:  "rgba(26,24,20,0.09)",
  border2: "rgba(26,24,20,0.15)",
  white:   "#FFFFFF",
  rose:    "#7D2B45",
};

/* ── Helpers ─────────────────────────────────────────────── */
function parseDate(d) {
  if (!d) return null;
  const dt = new Date(typeof d === "string" && d.length === 10 ? d + "T12:00:00" : d);
  return isNaN(dt) ? null : dt;
}
function fmtDate(d) {
  const dt = parseDate(d);
  if (!dt) return d ? String(d) : "";
  return dt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}
function daysUntil(d) {
  const dt = parseDate(d);
  if (!dt) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.ceil((dt - t) / 86400000);
}


const TASK_PHASES = ["Onboarding", "Planning", "Pre-Wedding", "Wedding Day", "Post-Wedding"];

const PHASE_META = {
  "Onboarding":  { color: "#4A6FA5", dot: "#4A6FA5" },
  "Planning":    { color: "#7B5EA7", dot: "#7B5EA7" },
  "Pre-Wedding": { color: "#B08D57", dot: "#B08D57" },
  "Wedding Day": { color: "#7D2B45", dot: "#7D2B45" },
  "Post-Wedding":{ color: "#3D7A52", dot: "#3D7A52" },
};

/* ── Thin gold rule ─────────────────────────────────────── */
function GoldRule({ width = 120 }) {
  return (
    <div style={{ margin: "0 auto", width, height: 1,
      background: `linear-gradient(90deg, transparent, ${T.gold}, transparent)` }} />
  );
}

/* ── Section heading ────────────────────────────────────── */
function SectionHead({ children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ margin: "0 0 10px", fontSize: 9, letterSpacing: ".18em",
        textTransform: "uppercase", color: T.gold, fontFamily: "'Jost',sans-serif" }}>
        {children}
      </p>
      <div style={{ height: 1, background: T.border }} />
    </div>
  );
}

/* ── Card wrapper ───────────────────────────────────────── */
function Card({ children, style }) {
  return (
    <div style={{
      background: T.white,
      border: `1px solid ${T.border}`,
      padding: "28px 28px",
      marginBottom: 16,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Progress bar ───────────────────────────────────────── */
function ProgressBar({ pct }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ fontSize: 11, color: T.muted, letterSpacing: ".06em" }}>PROGRESO</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.gold }}>{pct}%</span>
      </div>
      <div style={{ height: 2, background: T.gold3, position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, height: "100%",
          width: `${pct}%`, background: T.gold, transition: "width .8s ease" }} />
      </div>
    </div>
  );
}

/* ── Task item ──────────────────────────────────────────── */
function TaskItem({ task, done }) {
  const pm = PHASE_META[task.phase] || { dot: T.muted };
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14,
      padding: "13px 0", borderBottom: `1px solid ${T.border}` }}>
      <div style={{
        width: 16, height: 16, border: done ? "none" : `1.5px solid ${T.border2}`,
        background: done ? T.gold3 : T.white,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: 2,
      }}>
        {done && <span style={{ fontSize: 9, color: T.gold }}>✓</span>}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, color: done ? T.muted : T.ink,
          fontWeight: 400, textDecoration: done ? "line-through" : "none",
          fontFamily: "'Jost',sans-serif" }}>
          {task.taskName}
        </p>
        {task.dueDate && !done && (
          <p style={{ margin: "3px 0 0", fontSize: 10, color: T.muted, letterSpacing: ".04em" }}>
            {fmtDate(task.dueDate)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Venue floor plans ──────────────────────────────────── */
function VenuePlans({ venue }) {
  const [active, setActive] = useState(0);
  const plans = VENUE_PLANS[venue];
  if (!plans) return null;
  const cur = plans[active];
  return (
    <Card>
      <SectionHead>Planos del Espacio</SectionHead>
      {plans.length > 1 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          {plans.map((p, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              fontSize: 10, letterSpacing: ".07em", textTransform: "uppercase",
              fontFamily: "'Jost',sans-serif", border: `1px solid ${i === active ? T.gold : T.border}`,
              borderRadius: 4, padding: "4px 10px", cursor: "pointer",
              background: i === active ? T.gold3 : "transparent",
              color: i === active ? T.ink : T.muted,
            }}>{p.label}</button>
          ))}
        </div>
      )}
      <a href={cur.img} target="_blank" rel="noopener noreferrer">
        <img src={cur.img} alt={cur.label}
          style={{ width: "100%", display: "block", borderRadius: 4,
            border: `1px solid ${T.border}`, objectFit: "contain", maxHeight: 520 }} />
      </a>
      <p style={{ margin: "8px 0 0", fontSize: 10, color: T.muted, textAlign: "center",
        letterSpacing: ".06em" }}>
        {cur.label} · {venue} · Toca para ampliar ↗
      </p>
    </Card>
  );
}

/* ── Proveedores confirmados ─────────────────────────────── */
const CAT_ICON = {
  "Fotografía": "📷", "Video": "🎬", "Flores": "💐", "Decoración": "✨",
  "Venue": "🏛", "Catering": "🍽", "Música": "🎶", "Iluminación": "💡",
  "Papelería": "📜", "Vestido": "👗", "Transporte": "🚗", "Torta": "🎂",
};
function ProveedoresSection({ suppliers }) {
  const confirmed = (suppliers || []).filter(s => ["Contratado","Pagado"].includes(s.status));
  if (!confirmed.length) return null;
  return (
    <Card>
      <SectionHead>Tu Equipo de Boda</SectionHead>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {confirmed.map((s, i) => (
          <div key={s.id || i} style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 0", borderBottom: `1px solid ${T.border}`,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0, width: 28, textAlign: "center" }}>
              {CAT_ICON[s.category] || "🤝"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: T.ink,
                fontFamily: "'Jost',sans-serif", overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.company}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: T.muted,
                letterSpacing: ".06em", textTransform: "uppercase" }}>
                {s.category}{s.contact ? ` · ${s.contact}` : ""}
              </p>
            </div>
            <span style={{
              fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase",
              padding: "3px 8px", border: `1px solid ${s.status === "Pagado" ? "#16a34a" : T.gold}`,
              color: s.status === "Pagado" ? "#16a34a" : T.gold, flexShrink: 0,
            }}>{s.status}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── Main component ─────────────────────────────────────── */
export default function BodaPublicView() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const [boda, setBoda]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [tab, setTab] = useState("inicio");

  useEffect(() => {
    if (!id) { setError("Link inválido — falta el ID."); setLoading(false); return; }
    supabase.from("bodas").select("data").eq("id", id).single()
      .then(({ data: row, error: err }) => {
        if (err || !row) { setError("No encontramos esta boda. Verifica el link."); return; }
        const d = row.data || {};
        const parseJ = (v, def) => { try { return Array.isArray(v) ? v : (typeof v === "string" ? JSON.parse(v) : def); } catch { return def; } };
        setBoda({
          id:            d.id            || id,
          clienteName:   d.clienteName   || "",
          weddingDate:   d.weddingDate   || "",
          venue:         d.venue         || "",
          phase:         d.phase         || "Onboarding",
          status:        d.status        || "Activa",
          guestCount:    d.guestCount    || "",
          coverPhoto:    d.coverPhoto    || "",
          notes:         d.notes         || "",
          tasks:         Array.isArray(d.tasks)         ? d.tasks         : [],
          schedule:      Array.isArray(d.schedule)      ? d.schedule      : [],
          suppliers:     Array.isArray(d.suppliers)     ? d.suppliers     : [],
          guests:        Array.isArray(d.guests)        ? d.guests        : [],
          seating:       Array.isArray(d.seating)       ? d.seating       : [],
          weddingEvents: Array.isArray(d.weddingEvents) ? d.weddingEvents : [],
          contracts:     parseJ(d.contracts, []),
          palette:       parseJ(d.palette,   []),
          songs:         parseJ(d.songs,     []),
          photos:        parseJ(d.photos,    []),
        });
      })
      .catch(e => setError("Error al cargar: " + e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20,
          color: T.gold, letterSpacing: ".12em" }}>Two Lovers</p>
        <p style={{ fontSize: 11, color: T.muted, letterSpacing: ".14em",
          textTransform: "uppercase", marginTop: 8 }}>Cargando preparativos...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22,
          color: T.ink, marginBottom: 10 }}>{error}</p>
        <p style={{ fontSize: 12, color: T.muted }}>Contacta a tu coordinadora de Two Lovers.</p>
      </div>
    </div>
  );

  const tasks    = (boda.tasks || []).filter(t => t.assignedTo === "Novios");
  const done     = tasks.filter(t => ["Terminado", "Cancelado"].includes(t.status));
  const pending  = tasks.filter(t => !["Terminado", "Cancelado"].includes(t.status));
  const pct      = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const days     = daysUntil(boda.weddingDate);
  const schedule = (boda.schedule || []).filter(ev => !ev.isInternal);
  const pm       = PHASE_META[boda.phase] || { color: T.muted };
  const guests   = boda.guests || [];
  const seating  = boda.seating || [];

  const contracts = boda.contracts || [];
  const palette   = boda.palette   || [];
  const songs     = boda.songs     || [];
  const photos    = boda.photos    || [];

  const TABS = [
    { id: "inicio",    label: "Inicio" },
    { id: "timeline",  label: "Timeline" },
    ...(guests.length > 0 ? [{ id: "invitados", label: `Invitados (${guests.length})` }] : []),
    ...(seating.length > 0 ? [{ id: "mesas", label: "Mesas" }] : []),
    ...(contracts.length > 0 ? [{ id: "contratos", label: "Contratos" }] : []),
    ...(palette.length > 0   ? [{ id: "paleta",    label: "Paleta" }]    : []),
    ...(songs.length > 0     ? [{ id: "musica",    label: "Música" }]    : []),
    ...(photos.length > 0    ? [{ id: "fotos",     label: "Fotos" }]     : []),
    ...(boda.notes           ? [{ id: "notas",     label: "Notas" }]     : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg,
      fontFamily: "'Jost',sans-serif", fontWeight: 300 }}>

      {/* ── Hero header ── */}
      <div style={{ background: T.ink, padding: "48px 24px 44px", textAlign: "center" }}>
        <p style={{ fontSize: 9, letterSpacing: ".22em", textTransform: "uppercase",
          color: T.gold, margin: "0 0 20px", fontFamily: "'Jost',sans-serif" }}>
          Two Lovers · Bodas de Destino
        </p>

        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: "clamp(32px,8vw,54px)",
          fontWeight: 400, color: T.white, margin: "0 0 6px", letterSpacing: ".03em",
          lineHeight: 1.1 }}>
          {boda.clienteName}
        </h1>

        {boda.weddingDate && (
          <p style={{ fontSize: 13, color: "rgba(255,255,255,.55)", margin: "14px 0 0",
            letterSpacing: ".06em" }}>
            {fmtDate(boda.weddingDate)}
            {days !== null && (
              <span style={{ marginLeft: 12, color: days < 0 ? "rgba(255,255,255,.3)"
                : days <= 30 ? "#f9a8a8" : T.gold2, fontWeight: 500 }}>
                {days < 0 ? `· ya pasó (hace ${Math.abs(days)} días)`
                  : days === 0 ? "· ¡Es hoy!" : `· ${days} días`}
              </span>
            )}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 10,
          flexWrap: "wrap", marginTop: 22 }}>
          {boda.venue && (
            <span style={{ fontSize: 11, letterSpacing: ".08em", color: "rgba(255,255,255,.65)",
              padding: "5px 14px", border: "1px solid rgba(255,255,255,.15)" }}>
              {boda.venue}
            </span>
          )}
          {boda.guestCount && (
            <span style={{ fontSize: 11, letterSpacing: ".08em", color: "rgba(255,255,255,.65)",
              padding: "5px 14px", border: "1px solid rgba(255,255,255,.15)" }}>
              {boda.guestCount} invitados
            </span>
          )}
          <span style={{ fontSize: 11, letterSpacing: ".08em", padding: "5px 14px",
            border: `1px solid ${pm.color}`, color: pm.color }}>
            {boda.phase}
          </span>
        </div>

        <div style={{ marginTop: 32 }}>
          <GoldRule width={180} />
        </div>
      </div>

      {/* ── Tab bar ── */}
      {TABS.length > 1 && (
        <div style={{ position: "sticky", top: 0, zIndex: 20, background: T.ink,
          borderBottom: `1px solid rgba(255,255,255,.08)`, padding: "0 20px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", gap: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? T.gold : "transparent"}`,
                color: tab === t.id ? T.gold : "rgba(255,255,255,.45)",
                padding: "13px 16px 11px", fontSize: 11, letterSpacing: ".08em",
                textTransform: "uppercase", cursor: "pointer", fontFamily: "'Jost',sans-serif",
                fontWeight: tab === t.id ? 600 : 400, transition: "color .15s",
                whiteSpace: "nowrap",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 20px 80px" }}>

        {/* ── INICIO tab ── */}
        {tab === "inicio" && (<>

          {/* Progress */}
          {tasks.length > 0 && (
            <Card>
              <SectionHead>Estado de preparativos</SectionHead>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 32, fontFamily: "'Cormorant Garamond',serif",
                    fontWeight: 400, color: T.ink }}>
                    {done.length}<span style={{ fontSize: 16, color: T.muted }}>/{tasks.length}</span>
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: T.muted,
                    letterSpacing: ".08em", textTransform: "uppercase" }}>
                    tareas completadas
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontSize: 32, fontFamily: "'Cormorant Garamond',serif",
                    fontWeight: 400, color: T.gold }}>
                    {pending.length}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: T.muted,
                    letterSpacing: ".08em", textTransform: "uppercase" }}>
                    pendientes
                  </p>
                </div>
              </div>
              <ProgressBar pct={pct} />
            </Card>
          )}

          {/* Pending tasks by phase */}
          {pending.length > 0 && (
            <Card>
              <SectionHead>Tareas en proceso</SectionHead>
              {(() => {
                const knownPhases = TASK_PHASES;
                const other = pending.filter(t => !knownPhases.includes(t.phase));
                return (
                  <>
                    {knownPhases.map(ph => {
                      const inPhase = pending.filter(t => t.phase === ph);
                      if (!inPhase.length) return null;
                      const phm = PHASE_META[ph] || { color: T.muted };
                      return (
                        <div key={ph} style={{ marginBottom: 20 }}>
                          <p style={{ margin: "0 0 2px", fontSize: 9, letterSpacing: ".14em",
                            textTransform: "uppercase", color: phm.color, fontWeight: 600 }}>
                            {ph}
                          </p>
                          {inPhase.map(t => <TaskItem key={t.id} task={t} done={false} />)}
                        </div>
                      );
                    })}
                    {other.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        {other.map(t => <TaskItem key={t.id} task={t} done={false} />)}
                      </div>
                    )}
                  </>
                );
              })()}
            </Card>
          )}

          {/* Completed tasks (collapsible) */}
          {done.length > 0 && (
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: showDone ? 16 : 0 }}>
                <SectionHead>Completadas · {done.length}</SectionHead>
                <button onClick={() => setShowDone(s => !s)}
                  style={{ background: "none", border: `1px solid ${T.border2}`, cursor: "pointer",
                    fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase",
                    color: T.muted, padding: "4px 12px", fontFamily: "'Jost',sans-serif",
                    marginBottom: 20 }}>
                  {showDone ? "Ocultar" : "Ver"}
                </button>
              </div>
              {showDone && done.map(t => <TaskItem key={t.id} task={t} done={true} />)}
            </Card>
          )}

          {/* Confirmed suppliers */}
          <ProveedoresSection suppliers={boda.suppliers} />

          {/* Venue floor plans */}
          <VenuePlans venue={boda.venue} />

        </>)}

        {/* ── TIMELINE tab ── */}
        {tab === "timeline" && (
          <Card>
            <SectionHead>Programa del Día</SectionHead>
            {schedule.length === 0 ? (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
                El timeline aún está en preparación.
              </p>
            ) : (
              <div style={{ position: "relative", paddingLeft: 20 }}>
                <div style={{ position: "absolute", top: 0, left: 7, bottom: 0,
                  width: 1, background: T.border }} />
                {schedule.map((ev, i) => (
                  <div key={i} style={{ position: "relative", paddingBottom: 20 }}>
                    <div style={{ position: "absolute", left: -20, top: 4, width: 8, height: 8,
                      borderRadius: "50%", background: T.gold, border: `2px solid ${T.bg}` }} />
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: T.gold,
                      letterSpacing: ".08em", fontFamily: "'Jost',sans-serif" }}>
                      {ev.time || "--:--"}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: T.ink }}>
                      {ev.description || ev.event || ev.title || ""}
                    </p>
                    {ev.notes && (
                      <p style={{ margin: "3px 0 0", fontSize: 11, color: T.muted }}>{ev.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── INVITADOS tab ── */}
        {tab === "invitados" && (
          <Card>
            <SectionHead>Lista de Invitados</SectionHead>
            {guests.length === 0 ? (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin invitados registrados.</p>
            ) : (<>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                {[["Confirmado","#15803d"],["Pendiente","#c2410c"],["No asiste","#6b7280"]].map(([s,c]) => {
                  const n = guests.filter(g => (g.rsvp||"Pendiente") === s).length;
                  if (!n) return null;
                  return <span key={s} style={{ fontSize: 11, color: c, background: "transparent",
                    border: `1px solid ${c}`, borderRadius: 99, padding: "3px 12px" }}>{s}: {n}</span>;
                })}
              </div>
              <div>
                {guests.map((g, i) => {
                  const mesa = seating.find(t => t.id === g.tableId);
                  const rsvpColor = g.rsvp === "Confirmado" ? "#15803d" : g.rsvp === "No asiste" ? "#9ca3af" : "#c2410c";
                  return (
                    <div key={g.id || i} style={{ display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: T.ink, fontFamily: "'Jost',sans-serif" }}>{g.name}</p>
                        {mesa && <p style={{ margin: "2px 0 0", fontSize: 10, color: T.muted }}>Mesa: {mesa.name}</p>}
                        {g.meal && g.meal !== "Sin especificar" && <p style={{ margin: "1px 0 0", fontSize: 10, color: T.muted }}>{g.meal}</p>}
                      </div>
                      <span style={{ fontSize: 10, color: rsvpColor, fontWeight: 600, flexShrink: 0,
                        letterSpacing: ".04em" }}>{g.rsvp || "Pendiente"}</span>
                    </div>
                  );
                })}
              </div>
            </>)}
          </Card>
        )}

        {/* ── MESAS tab ── */}
        {tab === "mesas" && (
          <Card>
            <SectionHead>Plan de Mesas</SectionHead>
            {seating.filter(t => !t.type || t.type === "mesa").length === 0 ? (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin mesas configuradas.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {seating.filter(t => !t.type || t.type === "mesa").map(tbl => {
                  const tGuests = guests.filter(g => g.tableId === tbl.id);
                  const pct2 = Math.round((tGuests.length / Math.max(1, tbl.seats)) * 100);
                  return (
                    <div key={tbl.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ background: T.ink, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <p style={{ margin: 0, fontFamily: "'Cormorant Garamond',serif", fontSize: 15,
                            fontWeight: 400, fontStyle: "italic", color: T.white }}>{tbl.name}</p>
                          <p style={{ margin: "1px 0 0", fontSize: 9, color: T.gold2, letterSpacing: ".06em" }}>
                            {tbl.shape} · {tGuests.length}/{tbl.seats} puestos{tbl.size ? ` · ${tbl.size}` : ""}
                          </p>
                        </div>
                        <span style={{ fontSize: 11, color: pct2 >= 100 ? "#f87171" : T.gold2, fontWeight: 600 }}>{pct2}%</span>
                      </div>
                      {tGuests.length > 0 && (
                        <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {tGuests.map(g => (
                            <span key={g.id} style={{ fontSize: 11, color: T.ink2,
                              background: T.bg, border: `1px solid ${T.border}`,
                              borderRadius: 99, padding: "2px 10px", fontFamily: "'Jost',sans-serif" }}>
                              {g.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── CONTRATOS tab ── */}
        {tab === "contratos" && (
          <Card>
            <SectionHead>Contratos</SectionHead>
            {contracts.length === 0 ? (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin contratos registrados.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {contracts.map(c => {
                  const statusColor = c.status === "Firmado" ? "#15803d" : c.status === "Enviado" ? T.gold : c.status === "Cancelado" ? "#9ca3af" : T.muted;
                  return (
                    <div key={c.id} style={{ border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14, color: T.ink, fontFamily: "'Jost',sans-serif", fontWeight: 500 }}>{c.title}</p>
                          {c.supplierName && <p style={{ margin: "3px 0 0", fontSize: 11, color: T.muted }}>{c.supplierName}</p>}
                          {c.contractDate && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>{c.contractDate}</p>}
                          {c.amount && <p style={{ margin: "3px 0 0", fontSize: 12, color: T.gold, fontWeight: 500 }}>{c.amount}</p>}
                          {c.notes && <p style={{ margin: "6px 0 0", fontSize: 12, color: T.ink2, whiteSpace: "pre-line", lineHeight: 1.5 }}>{c.notes}</p>}
                        </div>
                        <span style={{ fontSize: 10, color: statusColor, border: `1px solid ${statusColor}`, borderRadius: 99, padding: "2px 10px", flexShrink: 0, letterSpacing: ".04em" }}>{c.status || "Borrador"}</span>
                      </div>
                      {c.pdfUrl && (
                        <a href={c.pdfUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 11, color: T.gold, textDecoration: "none", letterSpacing: ".04em" }}>
                          📄 Ver PDF
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── PALETA tab ── */}
        {tab === "paleta" && (
          <Card>
            <SectionHead>Paleta de Colores</SectionHead>
            {palette.length === 0 ? (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin paleta definida aún.</p>
            ) : (<>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
                {palette.map(p => (
                  <div key={p.id} style={{ textAlign: "center" }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: p.color || "#ccc", border: `2px solid ${T.border2}`, margin: "0 auto 6px" }} />
                    {p.name && <p style={{ margin: 0, fontSize: 10, color: T.muted, letterSpacing: ".04em", maxWidth: 72 }}>{p.name}</p>}
                    <p style={{ margin: "2px 0 0", fontSize: 9, color: T.muted, fontFamily: "monospace" }}>{p.color}</p>
                  </div>
                ))}
              </div>
              {palette.some(p => p.notes) && (
                <div style={{ marginTop: 4 }}>
                  {palette.filter(p => p.notes).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderTop: `1px solid ${T.border}` }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", background: p.color || "#ccc", flexShrink: 0, marginTop: 2 }} />
                      <p style={{ margin: 0, fontSize: 12, color: T.ink2 }}>{p.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </Card>
        )}

        {/* ── MÚSICA tab ── */}
        {tab === "musica" && (
          <Card>
            <SectionHead>Playlist</SectionHead>
            {songs.length === 0 ? (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin canciones registradas.</p>
            ) : (() => {
              const moments = [...new Set(songs.map(s => s.moment).filter(Boolean))];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {moments.map(moment => (
                    <div key={moment}>
                      <p style={{ margin: "0 0 8px", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: T.gold, fontWeight: 600 }}>{moment}</p>
                      {songs.filter(s => s.moment === moment).map(s => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, color: T.ink, fontFamily: "'Jost',sans-serif" }}>{s.title}</p>
                            {s.artist && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>{s.artist}</p>}
                            {s.notes && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted, fontStyle: "italic" }}>{s.notes}</p>}
                          </div>
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 16, textDecoration: "none", flexShrink: 0 }}>▶</a>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                  {songs.filter(s => !s.moment).length > 0 && (
                    <div>
                      {songs.filter(s => !s.moment).map(s => (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 13, color: T.ink }}>{s.title}</p>
                            {s.artist && <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>{s.artist}</p>}
                          </div>
                          {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 16, textDecoration: "none", flexShrink: 0 }}>▶</a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>
        )}

        {/* ── FOTOS tab ── */}
        {tab === "fotos" && (
          <Card>
            <SectionHead>Referencias de Fotos</SectionHead>
            {photos.length === 0 ? (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin fotos de referencia aún.</p>
            ) : (() => {
              const cats = [...new Set(photos.map(p => p.category || "General"))];
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  {cats.map(cat => (
                    <div key={cat}>
                      <p style={{ margin: "0 0 10px", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: T.gold, fontWeight: 600 }}>{cat}</p>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10 }}>
                        {photos.filter(p => (p.category || "General") === cat).map(p => (
                          <div key={p.id} style={{ borderRadius: 6, overflow: "hidden", border: `1px solid ${T.border}` }}>
                            {p.url && (
                              <a href={p.url} target="_blank" rel="noreferrer">
                                <img src={p.url} alt={p.label || ""} style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block" }}
                                  onError={e => { e.target.style.display = "none"; }} />
                              </a>
                            )}
                            {(p.label || p.notes) && (
                              <div style={{ padding: "6px 8px" }}>
                                {p.label && <p style={{ margin: 0, fontSize: 11, color: T.ink2, fontWeight: 500 }}>{p.label}</p>}
                                {p.notes && <p style={{ margin: "2px 0 0", fontSize: 10, color: T.muted }}>{p.notes}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>
        )}

        {/* ── NOTAS tab ── */}
        {tab === "notas" && (
          <Card>
            <SectionHead>Notas</SectionHead>
            {boda.notes ? (
              <p style={{ margin: 0, fontSize: 13, color: T.ink2, lineHeight: 1.7, whiteSpace: "pre-line" }}>{boda.notes}</p>
            ) : (
              <p style={{ fontSize: 13, color: T.muted, fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>Sin notas disponibles.</p>
            )}
          </Card>
        )}

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 48 }}>
          <GoldRule width={120} />
          <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 18, color: T.ink,
            margin: "20px 0 4px", letterSpacing: ".06em" }}>
            Two Lovers
          </p>
          <p style={{ fontSize: 10, color: T.muted, letterSpacing: ".14em",
            textTransform: "uppercase", margin: 0 }}>
            Bodas de destino · Cartagena · Colombia
          </p>
        </div>
      </div>
    </div>
  );
}
