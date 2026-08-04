import React, { useState, useEffect } from "react";
import { fetchKickoffsFromSheet } from "./sheetServices";

const R = {
  dark:   "#1a0812",
  mid:    "#7f1d3a",
  accent: "#be123c",
  light:  "#fff0f3",
  cream:  "#fdf6f8",
  gold:   "#c9a96e",
  muted:  "#8b4a62",
  text:   "#1a0812",
  border: "#f0c0ce",
  white:  "#ffffff",
};

function parseDate(d) { if(!d) return null; const dt=new Date(typeof d==="string"&&d.length===10?d+"T12:00:00":d); return isNaN(dt)?null:dt; }
function fmtDate(d) { const dt=parseDate(d); if(!dt) return d?String(d):""; return dt.toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"}); }
function daysUntil(d) { const dt=parseDate(d); if(!dt) return null; const t=new Date(); t.setHours(0,0,0,0); return Math.ceil((dt-t)/86400000); }

function parseBoda(k) {
  try {
    const meta  = JSON.parse(k.conciergeSummary || "{}");
    if (meta.type !== "boda") return null;
    const notes = JSON.parse(k.internalNotes || "{}");
    return {
      id:         k.id,
      clienteName: String(k.guestName||"").replace(/^Boda:\s*/i,""),
      weddingDate: meta.weddingDate||"",
      venue:       meta.venue      ||"",
      phase:       meta.phase      ||"Onboarding",
      status:      meta.status     ||"Activa",
      guestCount:  meta.guestCount ||"",
      tasks:     notes.tasks     ||[],
      schedule: JSON.parse(k.travifyText||"[]"),
    };
  } catch { return null; }
}

const TASK_PHASES = ["Onboarding","Planning","Pre-Wedding","Wedding Day","Post-Wedding"];
const FASE_COLORS = {
  "Onboarding":  {bg:"#eff6ff",color:"#1e40af"},
  "Planning":    {bg:"#f5f3ff",color:"#6d28d9"},
  "Pre-Wedding": {bg:"#fffbeb",color:"#b45309"},
  "Wedding Day": {bg:"#fff0f3",color:"#be123c"},
  "Post-Wedding":{bg:"#f0fdf4",color:"#166534"},
};

function ProgressRing({ pct }) {
  const r = 44, c = 2*Math.PI*r;
  const dash = (pct/100)*c;
  return (
    <svg width={110} height={110} viewBox="0 0 110 110">
      <circle cx={55} cy={55} r={r} fill="none" stroke={R.border} strokeWidth={8} />
      <circle cx={55} cy={55} r={r} fill="none" stroke={R.accent} strokeWidth={8}
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 55 55)" style={{transition:"stroke-dasharray .6s ease"}} />
      <text x={55} y={55} textAnchor="middle" dominantBaseline="middle"
        style={{fontSize:20,fontWeight:700,fill:R.accent,fontFamily:"'Cormorant Garamond',serif"}}>
        {pct}%
      </text>
    </svg>
  );
}

export default function BodaPublicView() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get("id");
  const [boda, setBoda]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!id) { setError("Link inválido — falta el ID de la boda."); setLoading(false); return; }
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
    <div style={{minHeight:"100vh",background:R.light,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>💍</div>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:R.mid}}>Cargando...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{minHeight:"100vh",background:R.light,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{textAlign:"center",maxWidth:400}}>
        <div style={{fontSize:32,marginBottom:12}}>💔</div>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:R.mid,marginBottom:8}}>{error}</p>
        <p style={{fontSize:13,color:R.muted}}>Contacta a tu coordinadora de Two Lovers.</p>
      </div>
    </div>
  );

  const tasks     = boda.tasks || [];
  const done      = tasks.filter(t => ["Terminado","Cancelado"].includes(t.status));
  const pct       = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;
  const days      = daysUntil(boda.weddingDate);
  const pending   = tasks.filter(t => !["Terminado","Cancelado"].includes(t.status));
  const schedule  = boda.schedule || [];
  const phaseColor = FASE_COLORS[boda.phase] || {bg:"#f5f5f4",color:"#57534e"};

  return (
    <div style={{minHeight:"100vh",background:R.cream,fontFamily:"'Jost',sans-serif"}}>
      {/* Header */}
      <div style={{background:R.dark,padding:"32px 24px 28px",textAlign:"center"}}>
        <p style={{fontSize:11,letterSpacing:".18em",textTransform:"uppercase",color:R.gold,margin:"0 0 10px"}}>Two Lovers · Bodas</p>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:34,fontWeight:500,color:R.white,margin:"0 0 8px",letterSpacing:".02em"}}>{boda.clienteName}</h1>
        {boda.weddingDate && (
          <p style={{fontSize:14,color:"rgba(255,255,255,.7)",margin:0}}>
            💍 {fmtDate(boda.weddingDate)}
            {days !== null && (
              <span style={{marginLeft:10,fontWeight:600,color:days<0?"rgba(255,255,255,.4)":days<=30?"#fca5a5":"rgba(255,255,255,.8)"}}>
                {days<0 ? `(hace ${Math.abs(days)} días)` : days===0 ? "(¡hoy!)" : `(faltan ${days} días)`}
              </span>
            )}
          </p>
        )}
        <div style={{height:2,background:`linear-gradient(90deg,transparent,${R.gold},transparent)`,margin:"20px auto 0",maxWidth:260}} />
      </div>

      <div style={{maxWidth:600,margin:"0 auto",padding:"28px 20px 60px"}}>

        {/* Info chips */}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:24,justifyContent:"center"}}>
          {boda.venue && (
            <span style={{fontSize:13,color:R.mid,background:R.white,border:`1px solid ${R.border}`,borderRadius:99,padding:"5px 14px"}}>
              📍 {boda.venue}
            </span>
          )}
          {boda.guestCount && (
            <span style={{fontSize:13,color:R.mid,background:R.white,border:`1px solid ${R.border}`,borderRadius:99,padding:"5px 14px"}}>
              👥 {boda.guestCount} invitados
            </span>
          )}
          <span style={{fontSize:13,fontWeight:600,padding:"5px 14px",borderRadius:99,background:phaseColor.bg,color:phaseColor.color}}>
            {boda.phase}
          </span>
        </div>

        {/* Progress */}
        {tasks.length > 0 && (
          <div style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:20,padding:"28px 24px",marginBottom:20,textAlign:"center"}}>
            <p style={{fontSize:11,letterSpacing:".1em",textTransform:"uppercase",color:R.muted,margin:"0 0 16px"}}>Progreso de preparativos</p>
            <ProgressRing pct={pct} />
            <p style={{margin:"14px 0 0",fontSize:14,color:R.text2}}>
              <strong style={{color:R.accent}}>{done.length}</strong> de <strong>{tasks.length}</strong> tareas completadas
            </p>
          </div>
        )}

        {/* Pending tasks by phase */}
        {pending.length > 0 && (
          <div style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:20,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${R.border}`}}>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:R.text}}>Tareas en proceso</p>
              <p style={{margin:"2px 0 0",fontSize:12,color:R.muted}}>{pending.length} pendiente{pending.length!==1?"s":""}</p>
            </div>
            {TASK_PHASES.map(ph => {
              const group = pending.filter(t => (t.phase||"General") === ph || (ph==="General"&&!(TASK_PHASES.includes(t.phase))));
              const inPhase = pending.filter(t => t.phase === ph);
              if (!inPhase.length) return null;
              const fc = FASE_COLORS[ph]||{bg:"#f5f5f4",color:"#57534e"};
              return (
                <div key={ph}>
                  <div style={{padding:"10px 20px",background:fc.bg,borderBottom:`1px solid ${R.border}`}}>
                    <span style={{fontSize:11,fontWeight:700,letterSpacing:".06em",textTransform:"uppercase",color:fc.color}}>{ph}</span>
                  </div>
                  {inPhase.map(t => (
                    <div key={t.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 20px",borderBottom:`1px solid ${R.light}`}}>
                      <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${R.border}`,background:R.white,flexShrink:0,marginTop:2}} />
                      <div>
                        <p style={{margin:0,fontSize:13,color:R.text,fontWeight:500}}>{t.taskName}</p>
                        {t.dueDate && <p style={{margin:"2px 0 0",fontSize:11,color:R.muted}}>Fecha: {fmtDate(t.dueDate)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Completed tasks */}
        {done.length > 0 && (
          <div style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:20,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${R.border}`}}>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:"#166534"}}>Completadas ✓</p>
              <p style={{margin:"2px 0 0",fontSize:12,color:R.muted}}>{done.length} tarea{done.length!==1?"s":""}</p>
            </div>
            {done.map(t => (
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 20px",borderBottom:`1px solid ${R.light}`}}>
                <div style={{width:18,height:18,borderRadius:5,background:"#dcfce7",border:"2px solid #86efac",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:10,color:"#166534",lineHeight:1}}>✓</span>
                </div>
                <span style={{fontSize:13,color:R.muted,textDecoration:"line-through"}}>{t.taskName}</span>
              </div>
            ))}
          </div>
        )}

        {/* Minuto a Minuto */}
        {schedule.length > 0 && (
          <div style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:20,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"16px 20px",borderBottom:`1px solid ${R.border}`}}>
              <p style={{margin:0,fontSize:13,fontWeight:600,color:R.text}}>Minuto a Minuto</p>
              <p style={{margin:"2px 0 0",fontSize:12,color:R.muted}}>Programa del día</p>
            </div>
            <div style={{padding:"8px 0"}}>
              {schedule.map((ev,i) => (
                <div key={i} style={{display:"flex",gap:16,padding:"10px 20px",borderBottom:i<schedule.length-1?`1px solid ${R.light}`:"none"}}>
                  <span style={{fontFamily:"'Jost',sans-serif",fontWeight:600,fontSize:13,color:R.accent,minWidth:48,flexShrink:0}}>{ev.time||"--:--"}</span>
                  <div>
                    <p style={{margin:0,fontSize:13,color:R.text,fontWeight:500}}>{ev.event||ev.title||""}</p>
                    {ev.notes&&<p style={{margin:"2px 0 0",fontSize:12,color:R.muted}}>{ev.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{textAlign:"center",marginTop:32}}>
          <div style={{height:2,background:`linear-gradient(90deg,transparent,${R.gold},transparent)`,maxWidth:160,margin:"0 auto 20px"}} />
          <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:16,color:R.mid,margin:0}}>Two Lovers · Bodas</p>
          <p style={{fontSize:12,color:R.muted,margin:"4px 0 0"}}>Coordinación de bodas íntimas y destinos especiales</p>
        </div>
      </div>
    </div>
  );
}
