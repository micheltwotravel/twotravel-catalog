/**
 * BookingPage — client-facing slot picker + concierge availability manager
 */

import React, { useEffect, useState, useCallback } from "react";

const GAS = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const DAYS_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DAY_KEYS   = ["mon","tue","wed","thu","fri","sat","sun"];
const DAY_LABELS = { mon:"Lunes", tue:"Martes", wed:"Miércoles", thu:"Jueves", fri:"Viernes", sat:"Sábado", sun:"Domingo" };

// ── GAS helpers ───────────────────────────────────────────────────────────────

async function gasGet(params) {
  const qs = new URLSearchParams(params).toString();
  const r  = await fetch(`${GAS}?${qs}`);
  return r.json();
}
async function gasPost(body) {
  const r = await fetch(GAS, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return JSON.parse(text); } catch {
    console.error("gasPost non-JSON response:", text?.slice(0, 400));
    throw new Error(text?.slice(0, 200) || "Respuesta inválida del servidor");
  }
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMin(m) {
  const h = Math.floor(m / 60), min = m % 60;
  return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
}
function fmtTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}
function fmtDateLong(d, lang = "es") {
  if (!d) return "";
  const dt = new Date(d + "T12:00:00");
  return dt.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", { weekday:"long", month:"long", day:"numeric" });
}

// ── Slot computation ──────────────────────────────────────────────────────────

function getAvailableSlots(dateStr, schedule, blockedSlots, bookings, minGap, slotDuration) {
  const date   = new Date(dateStr + "T12:00:00");
  const dow    = date.getDay();
  const dayKey = ["sun","mon","tue","wed","thu","fri","sat"][dow];
  const daySch = schedule?.[dayKey];
  if (!daySch?.active) return [];

  // Collect busy intervals (blocked + bookings with gap on both sides)
  const busy = [];
  (blockedSlots || []).filter(b => b.date === dateStr)
    .forEach(b => busy.push({ s: toMin(b.start), e: toMin(b.end) }));
  (bookings || []).filter(b => b.date === dateStr)
    .forEach(b => {
      const bs = toMin(b.time);
      const be = bs + (b.duration || slotDuration);
      busy.push({ s: bs - minGap, e: be + minGap });
    });

  // Each day can have multiple windows: windows array or single start/end
  const windows = daySch.windows?.length
    ? daySch.windows
    : [{ start: daySch.start || "09:00", end: daySch.end || "18:00" }];

  const slots = [];
  windows.forEach(win => {
    const wStart = toMin(win.start);
    const wEnd   = toMin(win.end);
    for (let t = wStart; t + slotDuration <= wEnd; t += slotDuration) {
      const slotEnd = t + slotDuration;
      const blocked = busy.some(b => t < b.e && slotEnd > b.s);
      if (!blocked) slots.push(fromMin(t));
    }
  });

  // Deduplicate and sort
  return [...new Set(slots)].sort();
}

// ── Default schedule ──────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE = {
  mon: { active: true,  start: "09:00", end: "18:00", windows: [] },
  tue: { active: true,  start: "09:00", end: "18:00", windows: [] },
  wed: { active: true,  start: "09:00", end: "18:00", windows: [] },
  thu: { active: true,  start: "09:00", end: "18:00", windows: [] },
  fri: { active: true,  start: "09:00", end: "18:00", windows: [] },
  sat: { active: false, start: "09:00", end: "14:00", windows: [] },
  sun: { active: false, start: "09:00", end: "13:00", windows: [] },
};

const DEFAULT_SETTINGS = { slotDuration: 30, minGap: 30 };

// ── AvailabilityManager ───────────────────────────────────────────────────────

export function AvailabilityManager({ conciergeEmail, conciergeName }) {
  const [schedule,  setSchedule]  = useState(DEFAULT_SCHEDULE);
  const [settings,  setSettings]  = useState(DEFAULT_SETTINGS);
  const [blocked,   setBlocked]   = useState([]);
  const [bookings,  setBookings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [tab,       setTab]       = useState("schedule"); // "schedule" | "blocks" | "preview" | "bookings"
  const [newBlock,  setNewBlock]  = useState({ date: "", start: "", end: "", reason: "" });
  // Multi-window editor: { dayKey, idx, start, end } or null
  const [addingWin, setAddingWin] = useState(null);
  // Visual calendar: { "2026-07-21": ["09:00","09:30",...], ... }
  const [manualSlots,    setManualSlots]    = useState({});
  const [calWeekOffset,  setCalWeekOffset]  = useState(0);

  const load = useCallback(async () => {
    if (!conciergeEmail) { setLoading(false); return; }
    setLoading(true);
    try {
      const r = await gasGet({ action: "getAvailability", email: conciergeEmail });
      if (r.ok) {
        if (r.schedule)    setSchedule({ ...DEFAULT_SCHEDULE, ...r.schedule });
        if (r.settings)    setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
        if (r.manualSlots) setManualSlots(r.manualSlots);
        setBlocked(r.blocked  || []);
        setBookings(r.bookings || []);
      }
    } catch {}
    setLoading(false);
  }, [conciergeEmail]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await gasPost({ action: "saveAvailability", email: conciergeEmail, schedule, settings, blocked, manualSlots });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert("Error guardando: " + (e?.message || e)); }
    setSaving(false);
  };

  const patchDay = (key, patch) =>
    setSchedule(s => ({ ...s, [key]: { ...s[key], ...patch } }));

  const addWindow = (dayKey) => {
    setSchedule(s => {
      const day = s[dayKey];
      const wins = day.windows?.length ? [...day.windows] : [];
      wins.push({ start: "14:00", end: "18:00" });
      return { ...s, [dayKey]: { ...day, windows: wins } };
    });
  };

  const removeWindow = (dayKey, idx) => {
    setSchedule(s => {
      const day = s[dayKey];
      const wins = (day.windows || []).filter((_, i) => i !== idx);
      return { ...s, [dayKey]: { ...day, windows: wins } };
    });
  };

  const patchWindow = (dayKey, idx, patch) => {
    setSchedule(s => {
      const day  = s[dayKey];
      const wins = (day.windows || []).map((w, i) => i === idx ? { ...w, ...patch } : w);
      return { ...s, [dayKey]: { ...day, windows: wins } };
    });
  };

  const addBlock = () => {
    if (!newBlock.date || !newBlock.start || !newBlock.end) return;
    if (toMin(newBlock.end) <= toMin(newBlock.start)) {
      alert("La hora de fin debe ser mayor a la hora de inicio"); return;
    }
    setBlocked(b => [...b, { ...newBlock, id: Date.now() }]);
    setNewBlock({ date: "", start: "", end: "", reason: "" });
  };

  // Use local date string to avoid UTC-shift bug in Colombia (UTC-5)
  function localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  // Next 14 days for preview
  const previewDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return localDateStr(d);
  });

  const tabStyle = (k) => ({
    padding: "6px 14px",
    borderRadius: 20,
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 500,
    background: tab === k ? "#1a1814" : "transparent",
    color: tab === k ? "#fff" : "#9a7d52",
    transition: "all .15s",
  });

  if (loading) return (
    <div style={{ padding: 32, textAlign: "center", color: "#aaa", fontSize: 14 }}>
      Cargando disponibilidad…
    </div>
  );

  return (
    <div style={{ fontFamily: "'Jost',sans-serif", background: "#fff", borderRadius: 16, border: "1px solid #e5ddd3", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: "#f7f4ef", padding: "16px 20px", borderBottom: "1px solid #e5ddd3" }}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1a1814" }}>
          ⚙️ Configurar horarios
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9a7d52" }}>
          {conciergeName || conciergeEmail}
        </p>
      </div>

      {/* Settings row */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5ddd3", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", background: "#faf9f7" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>⏱ Duración reunión</label>
          <select value={settings.slotDuration}
            onChange={e => setSettings(s => ({ ...s, slotDuration: Number(e.target.value) }))}
            style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 12, background: "#fff", cursor: "pointer" }}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12, color: "#555", fontWeight: 500 }}>🚧 Espacio entre citas</label>
          <select value={settings.minGap}
            onChange={e => setSettings(s => ({ ...s, minGap: Number(e.target.value) }))}
            style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 12, background: "#fff", cursor: "pointer" }}>
            <option value={0}>Sin espacio</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 hora</option>
          </select>
        </div>
        <p style={{ fontSize: 11, color: "#aaa", margin: 0, marginLeft: "auto" }}>
          Las reuniones se bloquean con el espacio configurado antes y después
        </p>
      </div>

      {/* Tabs */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid #e5ddd3", display: "flex", gap: 4 }}>
        <button type="button" style={tabStyle("schedule")} onClick={() => setTab("schedule")}>📅 Horario semanal</button>
        <button type="button" style={tabStyle("blocks")}   onClick={() => setTab("blocks")}>🚫 Bloquear fechas</button>
        <button type="button" style={tabStyle("preview")}  onClick={() => setTab("preview")}>👁 Vista previa</button>
        <button type="button" style={tabStyle("bookings")} onClick={() => setTab("bookings")}>
          📋 Reservas {bookings.length > 0 && <span style={{ background: "#9a7d52", color: "#fff", borderRadius: 10, fontSize: 10, padding: "1px 5px", marginLeft: 4 }}>{bookings.length}</span>}
        </button>
        <button type="button" style={tabStyle("calendar")} onClick={() => setTab("calendar")}>📆 Calendario</button>
      </div>

      <div style={{ padding: "20px 20px 0" }}>

        {/* ── Weekly schedule ── */}
        {tab === "schedule" && (
          <div style={{ paddingBottom: 20 }}>
            {DAY_KEYS.map(key => {
              const d = schedule[key] || {};
              const wins = d.windows?.filter(w => w.start && w.end) || [];
              const showMulti = wins.length > 0;
              return (
                <div key={key} style={{ borderBottom: "1px solid #f0ebe3", paddingBottom: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Toggle */}
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", width: 110 }}>
                      <div
                        onClick={() => patchDay(key, { active: !d.active })}
                        style={{
                          width: 36, height: 20, borderRadius: 10, cursor: "pointer",
                          background: d.active ? "#1a1814" : "#ddd",
                          position: "relative", transition: "background .2s",
                        }}>
                        <div style={{
                          position: "absolute", top: 2, left: d.active ? 18 : 2,
                          width: 16, height: 16, borderRadius: "50%", background: "#fff",
                          transition: "left .2s",
                        }} />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 500, color: d.active ? "#1a1814" : "#bbb" }}>
                        {DAY_LABELS[key]}
                      </span>
                    </label>

                    {d.active && !showMulti && (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={d.start || "09:00"} onChange={e => patchDay(key, { start: e.target.value })}
                            style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 13 }} />
                          <span style={{ color: "#aaa", fontSize: 13 }}>→</span>
                          <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={d.end || "18:00"} onChange={e => patchDay(key, { end: e.target.value })}
                            style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 13 }} />
                        </div>
                        <button type="button" onClick={() => addWindow(key)}
                          style={{ fontSize: 11, color: "#9a7d52", background: "none", border: "1px solid #e5ddd3", borderRadius: 7, padding: "3px 8px", cursor: "pointer" }}>
                          + Agregar ventana
                        </button>
                      </>
                    )}
                    {!d.active && (
                      <span style={{ fontSize: 12, color: "#ccc" }}>No disponible</span>
                    )}
                  </div>

                  {/* Multi-window rows */}
                  {d.active && showMulti && (
                    <div style={{ marginTop: 8, marginLeft: 118, display: "flex", flexDirection: "column", gap: 6 }}>
                      {/* Base window */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={d.start || "09:00"} onChange={e => patchDay(key, { start: e.target.value })}
                          style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 12 }} />
                        <span style={{ color: "#aaa" }}>→</span>
                        <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={d.end || "18:00"} onChange={e => patchDay(key, { end: e.target.value })}
                          style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 12 }} />
                        <span style={{ fontSize: 11, color: "#9a7d52", paddingLeft: 4 }}>Ventana 1</span>
                      </div>
                      {wins.map((w, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={w.start} onChange={e => patchWindow(key, i, { start: e.target.value })}
                            style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 12 }} />
                          <span style={{ color: "#aaa" }}>→</span>
                          <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={w.end} onChange={e => patchWindow(key, i, { end: e.target.value })}
                            style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 8px", fontSize: 12 }} />
                          <span style={{ fontSize: 11, color: "#9a7d52" }}>Ventana {i + 2}</span>
                          <button type="button" onClick={() => removeWindow(key, i)}
                            style={{ color: "#e44", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addWindow(key)}
                        style={{ alignSelf: "flex-start", fontSize: 11, color: "#9a7d52", background: "none", border: "1px solid #e5ddd3", borderRadius: 7, padding: "3px 8px", cursor: "pointer", marginTop: 2 }}>
                        + Otra ventana
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Block dates ── */}
        {tab === "blocks" && (
          <div style={{ paddingBottom: 20 }}>
            {/* Add block form */}
            <div style={{ background: "#faf9f7", border: "1px solid #e5ddd3", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#555" }}>Bloquear un horario específico</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#999", marginBottom: 3 }}>Fecha</label>
                  <input type="date" value={newBlock.date}
                    onChange={e => setNewBlock(b => ({ ...b, date: e.target.value }))}
                    style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "6px 8px", fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#999", marginBottom: 3 }}>Desde</label>
                  <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={newBlock.start}
                    onChange={e => setNewBlock(b => ({ ...b, start: e.target.value }))}
                    style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "6px 8px", fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, color: "#999", marginBottom: 3 }}>Hasta</label>
                  <input type="text" inputMode="numeric" pattern="[0-9:]*" placeholder="HH:MM" value={newBlock.end}
                    onChange={e => setNewBlock(b => ({ ...b, end: e.target.value }))}
                    style={{ border: "1px solid #e5ddd3", borderRadius: 7, padding: "6px 8px", fontSize: 12 }} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ display: "block", fontSize: 10, color: "#999", marginBottom: 3 }}>Motivo (opcional)</label>
                  <input type="text" placeholder="Shift, reunión interna, viaje…"
                    value={newBlock.reason}
                    onChange={e => setNewBlock(b => ({ ...b, reason: e.target.value }))}
                    style={{ width: "100%", border: "1px solid #e5ddd3", borderRadius: 7, padding: "6px 8px", fontSize: 12, boxSizing: "border-box" }} />
                </div>
                <button type="button" onClick={addBlock}
                  style={{ padding: "7px 18px", background: "#1a1814", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>
                  + Bloquear
                </button>
              </div>
            </div>

            {/* Block list */}
            {blocked.length === 0 ? (
              <p style={{ textAlign: "center", color: "#ccc", fontSize: 13, padding: "20px 0" }}>
                Sin bloqueos especiales
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...blocked].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).map(b => (
                  <div key={b.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#fff5f5", border: "1px solid #fdd", borderRadius: 9 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#c00" }}>
                        {new Date(b.date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                      <span style={{ fontSize: 13, color: "#c44", marginLeft: 12 }}>{fmtTime12(b.start)} – {fmtTime12(b.end)}</span>
                      {b.reason && <span style={{ fontSize: 11, color: "#e09", marginLeft: 12 }}>· {b.reason}</span>}
                    </div>
                    <button type="button" onClick={() => setBlocked(bl => bl.filter(x => x.id !== b.id))}
                      style={{ color: "#c44", background: "none", border: "none", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Preview ── */}
        {tab === "preview" && (
          <div style={{ paddingBottom: 20 }}>
            <p style={{ fontSize: 12, color: "#999", marginBottom: 14 }}>
              Slots disponibles para los próximos 14 días con la configuración actual.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {previewDates.map(dateStr => {
                const slots = getAvailableSlots(dateStr, schedule, blocked, bookings, settings.minGap, settings.slotDuration);
                if (slots.length === 0) return null;
                const dt  = new Date(dateStr + "T12:00:00");
                const dow = DAY_LABELS[DAY_KEYS[dt.getDay() === 0 ? 6 : dt.getDay() - 1]];
                return (
                  <div key={dateStr} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: "#faf9f7", borderRadius: 9, border: "1px solid #e5ddd3" }}>
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <div style={{ fontSize: 10, color: "#9a7d52", textTransform: "uppercase", letterSpacing: ".06em" }}>{dow}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1814" }}>{dt.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {slots.map(t => (
                        <span key={t} style={{ fontSize: 11, padding: "3px 9px", background: "#fff", border: "1px solid #ccc", borderRadius: 6, color: "#333" }}>
                          {fmtTime12(t)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Bookings ── */}
        {tab === "bookings" && (
          <div style={{ paddingBottom: 20 }}>
            {bookings.length === 0 ? (
              <p style={{ textAlign: "center", color: "#ccc", fontSize: 13, padding: "24px 0" }}>
                Sin reservas pendientes
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[...bookings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((b, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "#f0f7ff", border: "1px solid #c0d8f0", borderRadius: 9 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a4f8a" }}>
                        {fmtDateLong(b.date)}
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1a4f8a", marginLeft: 12 }}>{fmtTime12(b.time)}</span>
                      <span style={{ fontSize: 12, color: "#5580aa", marginLeft: 12 }}>{b.clientName || "Cliente"}</span>
                    </div>
                    <span style={{ fontSize: 11, color: "#7090b0" }}>{b.duration || settings.slotDuration} min</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* ── Visual calendar ── */}
        {tab === "calendar" && (() => {
          const HOUR_START = 8;
          const HOUR_END   = 20;
          const slots30    = [];
          for (let h = HOUR_START; h < HOUR_END; h++) {
            slots30.push(`${String(h).padStart(2,"0")}:00`);
            slots30.push(`${String(h).padStart(2,"0")}:30`);
          }

          const today = new Date();
          const dow = today.getDay();
          const monday = new Date(today);
          monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1) + calWeekOffset * 7);
          const weekDays = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            return localDateStr(d);
          });

          const todayStr = localDateStr(today);
          const DAY_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

          const toggleSlot = (dateStr, time) => {
            setManualSlots(prev => {
              const daySlots = prev[dateStr] || [];
              const has = daySlots.includes(time);
              const next = has ? daySlots.filter(t => t !== time) : [...daySlots, time].sort();
              if (next.length === 0) {
                const { [dateStr]: _, ...rest } = prev;
                return rest;
              }
              return { ...prev, [dateStr]: next };
            });
          };

          const totalSelected = Object.values(manualSlots).reduce((s, arr) => s + arr.length, 0);

          const colW = 52;
          const timeColW = 46;

          return (
            <div style={{ paddingBottom: 20 }}>
              {/* Week nav */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#9a7d52" }}>
                  Haz clic en los bloques para marcar cuándo estás disponible
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button type="button" onClick={() => setCalWeekOffset(o => o - 1)}
                    style={{ background: "#f5f0e8", border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 10px", fontSize: 13, cursor: "pointer", color: "#9a7d52" }}>‹</button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1814", minWidth: 100, textAlign: "center" }}>
                    {new Date(weekDays[0] + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(weekDays[6] + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" })}
                  </span>
                  <button type="button" onClick={() => setCalWeekOffset(o => o + 1)}
                    style={{ background: "#f5f0e8", border: "1px solid #e5ddd3", borderRadius: 7, padding: "4px 10px", fontSize: 13, cursor: "pointer", color: "#9a7d52" }}>›</button>
                  {calWeekOffset !== 0 && (
                    <button type="button" onClick={() => setCalWeekOffset(0)}
                      style={{ background: "none", border: "none", fontSize: 11, color: "#bbb", cursor: "pointer" }}>Hoy</button>
                  )}
                </div>
              </div>

              {/* Grid */}
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: `${timeColW}px repeat(7, ${colW}px)`, minWidth: timeColW + colW * 7 }}>

                  {/* Header row */}
                  <div style={{ gridColumn: 1 }} />
                  {weekDays.map((dateStr, i) => {
                    const isToday = dateStr === todayStr;
                    return (
                      <div key={dateStr} style={{
                        textAlign: "center", padding: "4px 2px 8px",
                        borderLeft: "1px solid #f0ebe3",
                      }}>
                        <div style={{ fontSize: 10, color: "#aaa", textTransform: "uppercase", letterSpacing: ".06em" }}>
                          {DAY_SHORT[i]}
                        </div>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: isToday ? "#fff" : "#1a1814",
                          background: isToday ? "#1a1814" : "transparent",
                          borderRadius: "50%", width: 26, height: 26,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          marginTop: 2,
                        }}>
                          {new Date(dateStr + "T12:00:00").getDate()}
                        </div>
                      </div>
                    );
                  })}

                  {/* Slot rows */}
                  {slots30.map((time, rowIdx) => {
                    const showLabel = time.endsWith(":00");
                    return (
                      <React.Fragment key={time}>
                        {/* Time label */}
                        <div style={{
                          gridColumn: 1, textAlign: "right", paddingRight: 8,
                          fontSize: 10, color: showLabel ? "#aaa" : "transparent",
                          lineHeight: "22px", height: 22,
                          borderTop: showLabel ? "1px solid #f0ebe3" : "none",
                          userSelect: "none",
                        }}>
                          {showLabel ? time : "·"}
                        </div>
                        {/* Day cells */}
                        {weekDays.map((dateStr, colIdx) => {
                          const selected = (manualSlots[dateStr] || []).includes(time);
                          const isPast   = dateStr < todayStr || (dateStr === todayStr && time < `${String(today.getHours()).padStart(2,"0")}:${today.getMinutes() >= 30 ? "30" : "00"}`);
                          return (
                            <div
                              key={dateStr + time}
                              onClick={() => !isPast && toggleSlot(dateStr, time)}
                              style={{
                                height: 22,
                                borderLeft: "1px solid #f0ebe3",
                                borderTop: showLabel ? "1px solid #f0ebe3" : "1px solid #faf9f7",
                                background: selected
                                  ? "#d1f5e0"
                                  : isPast
                                  ? "#faf9f7"
                                  : "#fff",
                                cursor: isPast ? "default" : "pointer",
                                transition: "background .1s",
                                position: "relative",
                              }}
                              title={selected ? `${time} — disponible` : isPast ? "" : `${time} — clic para marcar`}
                            >
                              {selected && (
                                <div style={{
                                  position: "absolute", inset: 1,
                                  background: "#22c55e22",
                                  borderRadius: 2,
                                  borderLeft: "3px solid #16a34a",
                                }} />
                              )}
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 11, color: "#888", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 14, height: 14, background: "#d1f5e0", border: "1px solid #16a34a", borderRadius: 3, display: "inline-block" }} />
                  Disponible
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 14, height: 14, background: "#fff", border: "1px solid #e5ddd3", borderRadius: 3, display: "inline-block" }} />
                  Sin marcar
                </span>
                <span style={{ marginLeft: "auto", color: "#9a7d52", fontWeight: 600 }}>
                  {totalSelected} bloque{totalSelected !== 1 ? "s" : ""} marcado{totalSelected !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          );
        })()}

      </div>

      {/* Save footer */}
      {tab !== "bookings" && (
        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5ddd3", background: "#faf9f7" }}>
          <button type="button" onClick={save} disabled={saving}
            style={{
              width: "100%", padding: "11px", background: saving ? "#aaa" : saved ? "#2d7d46" : "#1a1814",
              color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: saving ? "default" : "pointer", transition: "background .2s",
            }}>
            {saving ? "Guardando…" : saved ? "✓ Guardado" : "Guardar configuración"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Client Booking Page ───────────────────────────────────────────────────────

export function BookingPage({ conciergeEmail, conciergeName, kickoffId, guestName, lang = "en" }) {
  const isEs   = lang === "es";
  const [avail,   setAvail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [selDate, setSelDate] = useState("");
  const [selTime, setSelTime] = useState("");
  const [topic,   setTopic]   = useState("");
  const [step,    setStep]    = useState("pick"); // "pick" | "confirm" | "done"
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!conciergeEmail) { setLoading(false); return; }
    gasGet({ action: "getAvailability", email: conciergeEmail })
      .then(r => { if (r.ok) setAvail(r); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conciergeEmail]);

  const sched    = avail?.schedule ? { ...DEFAULT_SCHEDULE, ...avail.schedule } : DEFAULT_SCHEDULE;
  const cfg      = avail?.settings ? { ...DEFAULT_SETTINGS, ...avail.settings } : DEFAULT_SETTINGS;
  function _localDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  const dates    = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i + 1);
    return _localDateStr(d);
  });
  const slots    = selDate ? getAvailableSlots(selDate, sched, avail?.blocked || [], avail?.bookings || [], cfg.minGap, cfg.slotDuration) : [];
  const availDates = dates.filter(d => getAvailableSlots(d, sched, avail?.blocked || [], avail?.bookings || [], cfg.minGap, cfg.slotDuration).length > 0);
  const selDateIdx = availDates.indexOf(selDate);
  const prevDate   = selDateIdx > 0 ? availDates[selDateIdx - 1] : null;
  const nextDate   = selDateIdx < availDates.length - 1 ? availDates[selDateIdx + 1] : null;

  const confirm = async () => {
    setBooking(true);
    try {
      await gasPost({ action: "bookSlot", conciergeEmail, conciergeName, kickoffId, guestName, date: selDate, time: selTime, topic, duration: cfg.slotDuration, lang });
      setStep("done");
    } catch { alert(isEs ? "Error al reservar, intenta de nuevo." : "Booking error, please try again."); }
    setBooking(false);
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#aaa", fontSize: 14 }}>
      {isEs ? "Cargando disponibilidad…" : "Loading availability…"}
    </div>
  );

  if (!avail) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#c00", fontSize: 14 }}>
      {isEs ? "No se pudo cargar la disponibilidad." : "Could not load availability."}
    </div>
  );

  if (step === "done") return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        {isEs ? "¡Reunión confirmada!" : "Meeting confirmed!"}
      </h2>
      <p style={{ color: "#666", fontSize: 15 }}>
        {fmtDateLong(selDate, lang)} {isEs ? "a las" : "at"} {fmtTime12(selTime)} {isEs ? "con" : "with"} {conciergeName}
      </p>
      <p style={{ color: "#aaa", fontSize: 13, marginTop: 8 }}>
        {isEs ? "Recibirás una confirmación por WhatsApp." : "You'll receive a confirmation via WhatsApp."}
      </p>
    </div>
  );

  if (step === "confirm") return (
    <div style={{ padding: "24px" }}>
      <button onClick={() => setStep("pick")} style={{ color: "#666", fontSize: 13, marginBottom: 24, cursor: "pointer", background: "none", border: "none" }}>
        ← {isEs ? "Volver" : "Back"}
      </button>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        {isEs ? "Confirmar reunión" : "Confirm meeting"}
      </h2>
      <div style={{ background: "#f5f5f5", borderRadius: 12, padding: "16px 20px", margin: "16px 0" }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{fmtDateLong(selDate, lang)}</p>
        <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700 }}>{fmtTime12(selTime)}</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>{conciergeName} · {cfg.slotDuration} min</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 6 }}>
          {isEs ? "¿De qué quieres hablar? (opcional)" : "What do you want to discuss? (optional)"}
        </label>
        <textarea value={topic} onChange={e => setTopic(e.target.value)} rows={3}
          placeholder={isEs ? "Preguntas sobre el itinerario, actividades…" : "Questions about the itinerary, activities…"}
          style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} />
      </div>
      <button onClick={confirm} disabled={booking}
        style={{ width: "100%", padding: "14px", background: "#111", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", opacity: booking ? 0.6 : 1 }}>
        {booking ? (isEs ? "Reservando…" : "Booking…") : (isEs ? "Confirmar reunión" : "Confirm meeting")}
      </button>
    </div>
  );

  return (
    <div style={{ padding: "24px", maxWidth: 520, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
        {isEs ? `Agenda una reunión con ${conciergeName}` : `Schedule a meeting with ${conciergeName}`}
      </h2>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>
        {cfg.slotDuration} min · {isEs ? "Por video o WhatsApp" : "Via video or WhatsApp"}
      </p>

      {/* Date picker */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 10 }}>
          {isEs ? "Elige una fecha:" : "Pick a date:"}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {dates.map(d => {
            const s  = getAvailableSlots(d, sched, avail?.blocked || [], avail?.bookings || [], cfg.minGap, cfg.slotDuration);
            if (s.length === 0) return null;
            const dt  = new Date(d + "T12:00:00");
            const dow = isEs ? DAYS_ES[dt.getDay()] : DAYS_EN[dt.getDay()];
            return (
              <button key={d} type="button" onClick={() => { setSelDate(d); setSelTime(""); }}
                style={{
                  padding: "10px 14px", borderRadius: 10, border: "1.5px solid",
                  borderColor: selDate === d ? "#111" : "#e0e0e0",
                  background: selDate === d ? "#111" : "#fff",
                  color: selDate === d ? "#fff" : "#111",
                  cursor: "pointer", minWidth: 64, textAlign: "center",
                }}>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{dow}</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{dt.getDate()}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selDate && (
        <div style={{ marginBottom: 24 }}>
          {/* Date navigation */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button type="button" onClick={() => { setSelDate(prevDate); setSelTime(""); }} disabled={!prevDate}
              style={{ background: "none", border: "none", cursor: prevDate ? "pointer" : "default", fontSize: 20, color: prevDate ? "#111" : "#ddd", padding: "0 4px" }}>←</button>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{fmtDateLong(selDate, lang)}</span>
            <button type="button" onClick={() => { setSelDate(nextDate); setSelTime(""); }} disabled={!nextDate}
              style={{ background: "none", border: "none", cursor: nextDate ? "pointer" : "default", fontSize: 20, color: nextDate ? "#111" : "#ddd", padding: "0 4px" }}>→</button>
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 10 }}>
            {isEs ? "Elige un horario:" : "Pick a time:"}
          </p>
          {slots.length === 0 ? (
            <p style={{ color: "#aaa", fontSize: 13 }}>
              {isEs ? "Sin disponibilidad ese día." : "No availability on that day."}
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {slots.map(t => (
                <button key={t} type="button" onClick={() => setSelTime(t)}
                  style={{
                    padding: "8px 16px", borderRadius: 8, border: "1.5px solid",
                    borderColor: selTime === t ? "#111" : "#e0e0e0",
                    background: selTime === t ? "#111" : "#fff",
                    color: selTime === t ? "#fff" : "#111",
                    cursor: "pointer", fontSize: 14, fontWeight: 500,
                  }}>
                  {fmtTime12(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selDate && selTime && (
        <button onClick={() => setStep("confirm")}
          style={{ width: "100%", padding: "14px", background: "#111", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {isEs ? "Continuar" : "Continue"} →
        </button>
      )}
    </div>
  );
}
