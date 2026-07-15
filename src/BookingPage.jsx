/**
 * BookingPage — client-facing slot picker + concierge availability manager
 * Routes:
 *   ?mode=book&c=alia@two.travel&k=KICKOFF_ID  → client books a slot
 *   ?mode=availability&email=alia@two.travel    → concierge manages her schedule
 */

import React, { useEffect, useState, useCallback } from "react";

const GAS = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
const MIN_GAP_MIN = 30; // minimum gap between bookings (minutes)
const SLOT_DURATION = 30; // default meeting duration (minutes)

const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DAYS_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── GAS helpers ─────────────────────────────────────────────────────────────

async function gasGet(params) {
  const qs = new URLSearchParams({ ...params }).toString();
  const r = await fetch(`${GAS}?${qs}`);
  return r.json();
}

async function gasPost(body) {
  const r = await fetch(GAS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

// ── Slot computation ─────────────────────────────────────────────────────────

function toMin(t) {
  // "HH:MM" → minutes from midnight
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fromMin(m) {
  const h = Math.floor(m / 60), min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function getAvailableSlots(dateStr, schedule, blockedSlots, bookings) {
  // dateStr = "YYYY-MM-DD"
  const date = new Date(dateStr + "T12:00:00");
  const dow = date.getDay(); // 0=Sun
  const dayKey = ["sun","mon","tue","wed","thu","fri","sat"][dow];
  const daySchedule = schedule?.[dayKey];
  if (!daySchedule?.active) return [];

  const start = toMin(daySchedule.start || "09:00");
  const end   = toMin(daySchedule.end   || "18:00");

  // Collect busy intervals: blocked slots + bookings (+ gap around each booking)
  const busy = [];

  (blockedSlots || [])
    .filter(b => b.date === dateStr)
    .forEach(b => busy.push({ s: toMin(b.start), e: toMin(b.end) }));

  (bookings || [])
    .filter(b => b.date === dateStr)
    .forEach(b => {
      const bs = toMin(b.time);
      const be = bs + (b.duration || SLOT_DURATION);
      busy.push({ s: bs - MIN_GAP_MIN, e: be + MIN_GAP_MIN }); // gap on both sides
    });

  // Generate slots every SLOT_DURATION minutes
  const slots = [];
  for (let t = start; t + SLOT_DURATION <= end; t += SLOT_DURATION) {
    const slotEnd = t + SLOT_DURATION;
    const blocked = busy.some(b => t < b.e && slotEnd > b.s);
    if (!blocked) slots.push(fromMin(t));
  }
  return slots;
}

// ── Default weekly schedule ──────────────────────────────────────────────────

const DEFAULT_SCHEDULE = {
  mon: { active: true,  start: "09:00", end: "18:00" },
  tue: { active: true,  start: "09:00", end: "18:00" },
  wed: { active: true,  start: "09:00", end: "18:00" },
  thu: { active: true,  start: "09:00", end: "18:00" },
  fri: { active: true,  start: "09:00", end: "18:00" },
  sat: { active: false, start: "09:00", end: "14:00" },
  sun: { active: false, start: "09:00", end: "13:00" },
};

const DAY_KEYS = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS = { mon:"Lunes", tue:"Martes", wed:"Miércoles", thu:"Jueves", fri:"Viernes", sat:"Sábado", sun:"Domingo" };

// ── Availability Manager (concierge view) ────────────────────────────────────

export function AvailabilityManager({ conciergeEmail, conciergeName }) {
  const [schedule, setSchedule]     = useState(DEFAULT_SCHEDULE);
  const [blocked,  setBlocked]      = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [loading,  setLoading]      = useState(true);
  const [saving,   setSaving]       = useState(false);
  const [saved,    setSaved]        = useState(false);
  const [newBlock, setNewBlock]     = useState({ date: "", start: "09:00", end: "10:00", reason: "" });
  const [tab,      setTab]          = useState("schedule"); // "schedule" | "blocks" | "bookings"

  const email = conciergeEmail;

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    try {
      const r = await gasGet({ action: "getAvailability", email });
      if (r.ok) {
        if (r.schedule) setSchedule({ ...DEFAULT_SCHEDULE, ...r.schedule });
        setBlocked(r.blocked  || []);
        setBookings(r.bookings || []);
      }
    } catch {}
    setLoading(false);
  }, [email]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await gasPost({ action: "saveAvailability", email, schedule, blocked });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { alert("Error guardando"); }
    setSaving(false);
  };

  const patchDay = (key, patch) =>
    setSchedule(s => ({ ...s, [key]: { ...s[key], ...patch } }));

  const addBlock = () => {
    if (!newBlock.date || !newBlock.start || !newBlock.end) return;
    setBlocked(b => [...b, { ...newBlock, id: Date.now() }]);
    setNewBlock({ date: "", start: "09:00", end: "10:00", reason: "" });
  };

  const removeBlock = (id) => setBlocked(b => b.filter(x => x.id !== id));

  if (loading) return <div className="p-6 text-neutral-400 text-sm">Cargando disponibilidad…</div>;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        {[["schedule","📅 Horario semanal"],["blocks","🚫 Bloqueos"],["bookings","📋 Reservas"]].map(([k,l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===k ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Weekly schedule */}
      {tab === "schedule" && (
        <div className="space-y-2">
          <p className="text-[11px] text-neutral-400">Duración de reuniones: 30 min · Espacio mínimo entre citas: 30 min</p>
          {DAY_KEYS.map(key => {
            const d = schedule[key] || {};
            return (
              <div key={key} className="flex items-center gap-3 py-2 border-b border-neutral-100">
                <label className="flex items-center gap-2 w-28 cursor-pointer">
                  <input type="checkbox" checked={!!d.active} onChange={e => patchDay(key, { active: e.target.checked })}
                    className="rounded" />
                  <span className={`text-sm font-medium ${d.active ? "text-neutral-800" : "text-neutral-300"}`}>{DAY_LABELS[key]}</span>
                </label>
                {d.active ? (
                  <div className="flex items-center gap-2">
                    <input type="time" value={d.start||"09:00"} onChange={e => patchDay(key,{start:e.target.value})}
                      className="border border-neutral-200 rounded px-2 py-1 text-sm" />
                    <span className="text-neutral-400 text-sm">→</span>
                    <input type="time" value={d.end||"18:00"} onChange={e => patchDay(key,{end:e.target.value})}
                      className="border border-neutral-200 rounded px-2 py-1 text-sm" />
                  </div>
                ) : (
                  <span className="text-xs text-neutral-300">No disponible</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* One-off blocks */}
      {tab === "blocks" && (
        <div className="space-y-3">
          {/* Add block form */}
          <div className="flex flex-wrap gap-2 items-end p-3 bg-neutral-50 rounded-lg border border-neutral-200">
            <div>
              <label className="block text-[10px] text-neutral-400 mb-1">Fecha</label>
              <input type="date" value={newBlock.date} onChange={e => setNewBlock(b => ({...b, date:e.target.value}))}
                className="border border-neutral-200 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-1">Desde</label>
              <input type="time" value={newBlock.start} onChange={e => setNewBlock(b => ({...b, start:e.target.value}))}
                className="border border-neutral-200 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-[10px] text-neutral-400 mb-1">Hasta</label>
              <input type="time" value={newBlock.end} onChange={e => setNewBlock(b => ({...b, end:e.target.value}))}
                className="border border-neutral-200 rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] text-neutral-400 mb-1">Motivo (opcional)</label>
              <input type="text" placeholder="Shift, reunión…" value={newBlock.reason}
                onChange={e => setNewBlock(b => ({...b, reason:e.target.value}))}
                className="w-full border border-neutral-200 rounded px-2 py-1.5 text-sm" />
            </div>
            <button type="button" onClick={addBlock}
              className="px-4 py-1.5 bg-neutral-900 text-white text-sm rounded-lg hover:bg-neutral-700">
              + Bloquear
            </button>
          </div>

          {/* Block list */}
          {blocked.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">Sin bloqueos especiales</p>
          ) : (
            <div className="space-y-2">
              {blocked.sort((a,b) => a.date.localeCompare(b.date)).map(b => (
                <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-red-50 border border-red-100 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-red-800">{b.date}</span>
                    <span className="text-sm text-red-600 ml-3">{b.start} – {b.end}</span>
                    {b.reason && <span className="text-xs text-red-400 ml-3">{b.reason}</span>}
                  </div>
                  <button type="button" onClick={() => removeBlock(b.id)}
                    className="text-red-400 hover:text-red-700 text-lg px-2">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bookings list */}
      {tab === "bookings" && (
        <div className="space-y-2">
          {bookings.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">Sin reservas pendientes</p>
          ) : (
            bookings.sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).map((b,i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-blue-900">{b.date}</span>
                  <span className="text-sm text-blue-700 ml-3">{b.time}</span>
                  <span className="text-xs text-blue-500 ml-3">{b.clientName || "Cliente"}</span>
                </div>
                <span className="text-xs text-blue-400">{b.duration||30} min</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Save button */}
      {tab !== "bookings" && (
        <button type="button" onClick={save} disabled={saving}
          className="w-full py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 disabled:opacity-50 transition-colors">
          {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar disponibilidad"}
        </button>
      )}
    </div>
  );
}

// ── Client Booking Page ──────────────────────────────────────────────────────

export function BookingPage({ conciergeEmail, conciergeName, kickoffId, guestName, lang = "en" }) {
  const isEs = lang === "es";
  const [avail,    setAvail]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selDate,  setSelDate]  = useState("");
  const [selTime,  setSelTime]  = useState("");
  const [topic,    setTopic]    = useState("");
  const [step,     setStep]     = useState("pick"); // "pick" | "confirm" | "done"
  const [booking,  setBooking]  = useState(false);

  useEffect(() => {
    if (!conciergeEmail) { setLoading(false); return; }
    gasGet({ action: "getAvailability", email: conciergeEmail })
      .then(r => { if (r.ok) setAvail(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conciergeEmail]);

  // Build next 14 days
  const today = new Date();
  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i + 1);
    return d.toISOString().slice(0, 10);
  });

  const schedule = avail?.schedule ? { ...DEFAULT_SCHEDULE, ...avail.schedule } : DEFAULT_SCHEDULE;
  const slots = selDate
    ? getAvailableSlots(selDate, schedule, avail?.blocked || [], avail?.bookings || [])
    : [];

  const confirm = async () => {
    setBooking(true);
    try {
      await gasPost({
        action: "bookSlot",
        conciergeEmail,
        conciergeName,
        kickoffId,
        guestName,
        date: selDate,
        time: selTime,
        topic,
        duration: SLOT_DURATION,
        lang,
      });
      setStep("done");
    } catch { alert("Error al reservar, intenta de nuevo."); }
    setBooking(false);
  };

  const fmtDate = (d) => {
    if (!d) return "";
    const dt = new Date(d + "T12:00:00");
    return dt.toLocaleDateString(isEs ? "es-CO" : "en-US", { weekday:"long", month:"long", day:"numeric" });
  };

  const fmtTime = (t) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12  = h % 12 || 12;
    return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300, color:"#aaa", fontSize:14 }}>
      {isEs ? "Cargando disponibilidad…" : "Loading availability…"}
    </div>
  );

  if (!avail) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:300, color:"#c00", fontSize:14 }}>
      {isEs ? "No se pudo cargar la disponibilidad." : "Could not load availability."}
    </div>
  );

  if (step === "done") return (
    <div style={{ textAlign:"center", padding:"48px 24px" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>✅</div>
      <h2 style={{ fontSize:22, fontWeight:700, marginBottom:8 }}>
        {isEs ? "¡Reunión confirmada!" : "Meeting confirmed!"}
      </h2>
      <p style={{ color:"#666", fontSize:15 }}>
        {isEs
          ? `${fmtDate(selDate)} a las ${fmtTime(selTime)} con ${conciergeName}`
          : `${fmtDate(selDate)} at ${fmtTime(selTime)} with ${conciergeName}`}
      </p>
      <p style={{ color:"#aaa", fontSize:13, marginTop:8 }}>
        {isEs
          ? "Recibirás una confirmación por WhatsApp."
          : "You'll receive a confirmation via WhatsApp."}
      </p>
    </div>
  );

  if (step === "confirm") return (
    <div style={{ padding:"24px" }}>
      <button onClick={() => setStep("pick")} style={{ color:"#666", fontSize:13, marginBottom:24, cursor:"pointer", background:"none", border:"none" }}>
        ← {isEs ? "Volver" : "Back"}
      </button>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>
        {isEs ? "Confirmar reunión" : "Confirm meeting"}
      </h2>
      <div style={{ background:"#f5f5f5", borderRadius:12, padding:"16px 20px", margin:"16px 0" }}>
        <p style={{ margin:0, fontSize:15, fontWeight:600 }}>{fmtDate(selDate)}</p>
        <p style={{ margin:"4px 0 0", fontSize:22, fontWeight:700 }}>{fmtTime(selTime)}</p>
        <p style={{ margin:"4px 0 0", fontSize:13, color:"#666" }}>{conciergeName} · 30 min</p>
      </div>
      <div style={{ marginBottom:16 }}>
        <label style={{ display:"block", fontSize:13, color:"#666", marginBottom:6 }}>
          {isEs ? "¿De qué quieres hablar? (opcional)" : "What do you want to discuss? (optional)"}
        </label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3}
          placeholder={isEs ? "Preguntas sobre el itinerario, actividades, etc." : "Questions about the itinerary, activities, etc."}
          style={{ width:"100%", border:"1px solid #ddd", borderRadius:8, padding:"10px 12px", fontSize:14, fontFamily:"inherit", resize:"vertical" }} />
      </div>
      <button onClick={confirm} disabled={booking}
        style={{ width:"100%", padding:"14px", background:"#111", color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:600, cursor:"pointer", opacity: booking ? 0.6 : 1 }}>
        {booking ? (isEs ? "Reservando…" : "Booking…") : (isEs ? "Confirmar reunión" : "Confirm meeting")}
      </button>
    </div>
  );

  // Step: pick date + time
  return (
    <div style={{ padding:"24px", maxWidth:520, margin:"0 auto" }}>
      <h2 style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>
        {isEs ? `Agenda una reunión con ${conciergeName}` : `Schedule a meeting with ${conciergeName}`}
      </h2>
      <p style={{ color:"#888", fontSize:13, marginBottom:24 }}>
        {isEs ? "30 minutos · Por video o WhatsApp" : "30 minutes · Via video or WhatsApp"}
      </p>

      {/* Date picker */}
      <div style={{ marginBottom:20 }}>
        <p style={{ fontSize:13, fontWeight:600, color:"#444", marginBottom:10 }}>
          {isEs ? "Elige una fecha:" : "Pick a date:"}
        </p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {dates.map(d => {
            const s = getAvailableSlots(d, schedule, avail?.blocked || [], avail?.bookings || []);
            if (s.length === 0) return null;
            const dt = new Date(d + "T12:00:00");
            const dow = isEs ? DAYS_ES[dt.getDay()] : DAYS_EN[dt.getDay()];
            const day = dt.getDate();
            return (
              <button key={d} type="button" onClick={() => { setSelDate(d); setSelTime(""); }}
                style={{
                  padding:"10px 14px", borderRadius:10, border:"1.5px solid",
                  borderColor: selDate === d ? "#111" : "#e0e0e0",
                  background: selDate === d ? "#111" : "#fff",
                  color: selDate === d ? "#fff" : "#111",
                  cursor:"pointer", minWidth:64, textAlign:"center",
                }}>
                <div style={{ fontSize:11, opacity:0.7 }}>{dow}</div>
                <div style={{ fontSize:17, fontWeight:700 }}>{day}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selDate && (
        <div style={{ marginBottom:24 }}>
          <p style={{ fontSize:13, fontWeight:600, color:"#444", marginBottom:10 }}>
            {isEs ? "Elige un horario:" : "Pick a time:"}
          </p>
          {slots.length === 0 ? (
            <p style={{ color:"#aaa", fontSize:13 }}>
              {isEs ? "Sin disponibilidad ese día." : "No availability on that day."}
            </p>
          ) : (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {slots.map(t => (
                <button key={t} type="button" onClick={() => setSelTime(t)}
                  style={{
                    padding:"8px 16px", borderRadius:8, border:"1.5px solid",
                    borderColor: selTime === t ? "#111" : "#e0e0e0",
                    background: selTime === t ? "#111" : "#fff",
                    color: selTime === t ? "#fff" : "#111",
                    cursor:"pointer", fontSize:14, fontWeight:500,
                  }}>
                  {fmtTime(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selDate && selTime && (
        <button onClick={() => setStep("confirm")}
          style={{ width:"100%", padding:"14px", background:"#111", color:"#fff", border:"none", borderRadius:12, fontSize:15, fontWeight:600, cursor:"pointer" }}>
          {isEs ? "Continuar" : "Continue"} →
        </button>
      )}
    </div>
  );
}
