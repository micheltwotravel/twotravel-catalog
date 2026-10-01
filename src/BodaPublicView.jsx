import React, { useState, useEffect } from "react";
import { fetchKickoffsFromSheet } from "./sheetServices";

/* ── Venue floor-plan registry ─────────────────────────── */
const VENUE_PLANS = {
  "Casa de la Estrella": [
    { label: "Planta Segundo Piso",  file: "/venues/casa-estrella-piso2.pdf" },
    { label: "Layouts de Espacios",  file: "/venues/casa-estrella-layouts.pdf" },
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

function parseBoda(k) {
  try {
    const meta  = JSON.parse(k.conciergeSummary || "{}");
    if (meta.type !== "boda") return null;
    const notes = JSON.parse(k.internalNotes || "{}");
    return {
      id:          k.id,
      clienteName: String(k.guestName || "").replace(/^Boda:\s*/i, ""),
      weddingDate: meta.weddingDate || "",
      venue:       meta.venue       || "",
      phase:       meta.phase       || "Onboarding",
      status:      meta.status      || "Activa",
      guestCount:  meta.guestCount  || "",
      tasks:       notes.tasks      || [],
      schedule:    JSON.parse(k.travifyText || "[]"),
    };
  } catch { return null; }
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
  const plans = VENUE_PLANS[venue];
  if (!plans) return null;
  return (
    <Card>
      <SectionHead>Planos del Espacio</SectionHead>
      <p style={{ fontSize: 12, color: T.muted, marginBottom: 18, lineHeight: 1.6 }}>
        Planos arquitectónicos de <strong style={{ color: T.ink }}>{venue}</strong> para
        planificar la disposición y logística de su evento.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plans.map((p, i) => (
          <a key={i} href={p.file} target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 18px", border: `1px solid ${T.border2}`,
              textDecoration: "none", background: T.bg,
              transition: "border-color .15s, background .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.background = T.white; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.background = T.bg; }}
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
              stroke={T.gold} strokeWidth={1.5} strokeLinecap="round">
              <rect x={3} y={3} width={18} height={18} rx={0} />
              <line x1={9} y1={3} x2={9} y2={21} />
              <line x1={3} y1={9} x2={21} y2={9} />
              <line x1={3} y1={15} x2={21} y2={15} />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, color: T.ink, fontFamily: "'Jost',sans-serif" }}>
                {p.label}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: T.muted, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Ver plano →
              </p>
            </div>
          </a>
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

  useEffect(() => {
    if (!id) { setError("Link inválido — falta el ID."); setLoading(false); return; }
    fetchKickoffsFromSheet({ forceRefresh: false })
      .then(all => {
        const k = all.find(x => String(x.id) === String(id));
        if (!k) { setError("No encontramos esta boda. Verifica el link."); return; }
        const b = parseBoda(k);
        if (!b) { setError("Este link no corresponde a una boda."); return; }
        setBoda(b);
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

  const tasks    = boda.tasks || [];
  const done     = tasks.filter(t => ["Terminado", "Cancelado"].includes(t.status));
  const pending  = tasks.filter(t => !["Terminado", "Cancelado"].includes(t.status));
  const pct      = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const days     = daysUntil(boda.weddingDate);
  const schedule = boda.schedule || [];
  const pm       = PHASE_META[boda.phase] || { color: T.muted };

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

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "36px 20px 80px" }}>

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
            {TASK_PHASES.map(ph => {
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

        {/* Minuto a Minuto */}
        {schedule.length > 0 && (
          <Card>
            <SectionHead>Programa del Día</SectionHead>
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
                    {ev.event || ev.title || ""}
                  </p>
                  {ev.notes && (
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: T.muted }}>{ev.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Venue floor plans */}
        <VenuePlans venue={boda.venue} />

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
