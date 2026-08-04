import React, { useState, useEffect, useCallback } from "react";
import { fetchKickoffsFromSheet, saveKickoffToSheet, updateKickoffInSheet, deleteKickoff } from "./sheetServices";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function parseDate(d) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00" : d) : new Date(d);
  return isNaN(dt) ? null : dt;
}
function toDateInput(d) {
  const dt = parseDate(d);
  return dt ? dt.toISOString().slice(0, 10) : "";
}
function fmtDate(d) {
  const dt = parseDate(d);
  if (!dt) return d ? String(d) : "";
  return dt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}
function daysUntil(d) {
  const dt = parseDate(d);
  if (!dt) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.ceil((dt - today) / 86400000);
}
function uid() { return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

const FASES = ["Onboarding", "Planning", "Pre-Wedding", "Wedding Day", "Post-Wedding"];
const ESTADOS_BODA = ["Activa", "En pausa", "Terminada", "Cancelada"];
const ESTADOS_TASK = ["Pendiente", "En curso", "Terminado", "Cancelado"];
const PHASE_COLORS = {
  "Onboarding":   "bg-blue-100 text-blue-700",
  "Planning":     "bg-violet-100 text-violet-700",
  "Pre-Wedding":  "bg-amber-100 text-amber-700",
  "Wedding Day":  "bg-rose-100 text-rose-700",
  "Post-Wedding": "bg-green-100 text-green-700",
};

// ─── DATA LAYER (kickoff API as storage) ────────────────────────────────────

function parseBoda(k) {
  try {
    const meta = JSON.parse(k.conciergeSummary || "{}");
    if (meta.type !== "boda") return null;
    const tasks    = (JSON.parse(k.internalNotes || "{}").tasks || []);
    const schedule = JSON.parse(k.travifyText   || "[]");
    return {
      id: k.id,
      clienteName: String(k.guestName || "").replace(/^Boda:\s*/i, ""),
      weddingDate: meta.weddingDate || "",
      venue:       meta.venue       || "",
      responsable: meta.responsable || "",
      contact:     meta.contact     || "",
      phase:       meta.phase       || "Onboarding",
      status:      meta.status      || "Activa",
      guestCount:  meta.guestCount  || "",
      budget:      meta.budget      || "",
      notes:       meta.notes       || "",
      tasks,
      schedule,
    };
  } catch { return null; }
}

async function apiBodas() {
  const all = await fetchKickoffsFromSheet({ forceRefresh: true });
  return all.map(parseBoda).filter(Boolean);
}

function metaPayload(form) {
  return JSON.stringify({
    type: "boda",
    weddingDate: form.weddingDate,
    venue:       form.venue,
    responsable: form.responsable,
    contact:     form.contact,
    phase:       form.phase,
    status:      form.status,
    guestCount:  form.guestCount,
    budget:      form.budget,
    notes:       form.notes,
  });
}

async function apiSaveBoda(form) {
  const res = await saveKickoffToSheet({
    guestName:         "Boda: " + form.clienteName,
    conciergeSummary:  metaPayload(form),
    internalNotes:     JSON.stringify({ tasks: [] }),
    travifyText:       JSON.stringify([]),
    status:            "active",
  });
  return res.id;
}

async function apiUpdateBoda(id, form) {
  await updateKickoffInSheet(id, {
    guestName:        "Boda: " + form.clienteName,
    conciergeSummary: metaPayload(form),
  });
}
async function apiUpdateTasks(id, tasks) {
  await updateKickoffInSheet(id, { internalNotes: JSON.stringify({ tasks }) });
}
async function apiUpdateSchedule(id, schedule) {
  await updateKickoffInSheet(id, { travifyText: JSON.stringify(schedule) });
}
async function apiDeleteBoda(id) {
  await deleteKickoff(id);
}

// ─── BODA FORM ───────────────────────────────────────────────────────────────

function BodaForm({ boda, onSave, onCancel, saving, users = [] }) {
  const [form, setForm] = useState({
    clienteName: boda?.clienteName || "",
    weddingDate: toDateInput(boda?.weddingDate),
    venue:       boda?.venue       || "",
    responsable: boda?.responsable || "",
    phase:       boda?.phase       || "Onboarding",
    status:      boda?.status      || "Activa",
    guestCount:  boda?.guestCount  || "",
    budget:      boda?.budget      || "",
    notes:       boda?.notes       || "",
    contact:     boda?.contact     || "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = "w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[11px] text-neutral-500 mb-1">Nombre del cliente *</label>
          <input className={inp} value={form.clienteName} onChange={e => set("clienteName", e.target.value)} placeholder="Ej: Ana & Carlos" />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">Fecha de boda</label>
          <input type="date" className={inp} value={form.weddingDate} onChange={e => set("weddingDate", e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">Responsable</label>
          {users.length > 0 ? (
            <select className={inp} value={form.responsable} onChange={e => set("responsable", e.target.value)}>
              <option value="">— seleccionar —</option>
              {users.map(u => <option key={u.email} value={u.name || u.email}>{u.name || u.email}</option>)}
            </select>
          ) : (
            <input className={inp} value={form.responsable} onChange={e => set("responsable", e.target.value)} placeholder="Nombre o email" />
          )}
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">Venue</label>
          <input className={inp} value={form.venue} onChange={e => set("venue", e.target.value)} placeholder="Nombre del lugar" />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">Contacto cliente</label>
          <input className={inp} value={form.contact} onChange={e => set("contact", e.target.value)} placeholder="WhatsApp o email" />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">Fase</label>
          <select className={inp} value={form.phase} onChange={e => set("phase", e.target.value)}>
            {FASES.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">Estado</label>
          <select className={inp} value={form.status} onChange={e => set("status", e.target.value)}>
            {ESTADOS_BODA.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">N° invitados</label>
          <input type="number" className={inp} value={form.guestCount} onChange={e => set("guestCount", e.target.value)} placeholder="150" />
        </div>
        <div>
          <label className="block text-[11px] text-neutral-500 mb-1">Presupuesto (USD)</label>
          <input type="number" className={inp} value={form.budget} onChange={e => set("budget", e.target.value)} placeholder="25000" />
        </div>
        <div className="col-span-2">
          <label className="block text-[11px] text-neutral-500 mb-1">Notas internas</label>
          <textarea className={inp} rows={3} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Detalles, preferencias, pendientes..." />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} disabled={saving || !form.clienteName.trim()}
          className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-40">
          {saving ? "Guardando..." : boda ? "Guardar cambios" : "Crear boda"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50">Cancelar</button>
      </div>
    </div>
  );
}

// ─── TASKS TAB ───────────────────────────────────────────────────────────────

function TasksTab({ boda, users, onTasksChange }) {
  const [tasks, setTasks] = useState(boda.tasks || []);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blank, setBlank] = useState({ taskName: "", assignedTo: "", dueDate: "", status: "Pendiente", phase: "General", notes: "" });
  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40";
  const today = new Date(); today.setHours(0, 0, 0, 0);

  function cat(t) {
    if (!t.dueDate) return "upcoming";
    const d = new Date(t.dueDate + "T12:00:00"); d.setHours(0, 0, 0, 0);
    if (d < today) return "overdue";
    if (d.getTime() === today.getTime()) return "today";
    return "upcoming";
  }

  async function persist(updated) {
    setTasks(updated);
    onTasksChange(updated);
    await apiUpdateTasks(boda.id, updated);
  }

  async function addTask() {
    if (!blank.taskName.trim()) return;
    setSaving(true);
    try { await persist([...tasks, { ...blank, id: uid(), createdAt: new Date().toISOString() }]); setBlank({ taskName: "", assignedTo: "", dueDate: "", status: "Pendiente", phase: "General", notes: "" }); setShowForm(false); }
    catch(e) { alert("Error: " + e.message); }
    setSaving(false);
  }

  async function toggle(id) {
    const updated = tasks.map(t => t.id === id ? { ...t, status: t.status === "Terminado" ? "Pendiente" : "Terminado" } : t);
    try { await persist(updated); } catch { setTasks(tasks); }
  }

  async function remove(id) {
    try { await persist(tasks.filter(t => t.id !== id)); } catch { setTasks(tasks); }
  }

  const active = tasks.filter(t => !["Terminado","Cancelado"].includes(t.status));
  const done   = tasks.filter(t =>  ["Terminado","Cancelado"].includes(t.status));
  const catStyle = { overdue: "border-red-300 bg-red-50", today: "border-amber-300 bg-amber-50", upcoming: "border-neutral-200 bg-white" };
  const catBadge = { overdue: "⚠️ Atrasada", today: "🔥 Hoy", upcoming: "" };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{active.length} activa{active.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(v => !v)} className="text-[11px] text-rose-600 border border-rose-200 rounded-lg px-3 py-1.5 hover:bg-rose-50">+ Nueva tarea</button>
      </div>

      {showForm && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
          <input className={inp + " w-full"} value={blank.taskName} onChange={e => setBlank(f => ({...f, taskName: e.target.value}))} placeholder="Descripción *" />
          <div className="grid grid-cols-2 gap-2">
            {users.length > 0 ? (
              <select className={inp} value={blank.assignedTo} onChange={e => setBlank(f => ({...f, assignedTo: e.target.value}))}>
                <option value="">— responsable —</option>
                {users.map(u => <option key={u.email} value={u.name||u.email}>{u.name||u.email}</option>)}
              </select>
            ) : (
              <input className={inp} value={blank.assignedTo} onChange={e => setBlank(f => ({...f, assignedTo: e.target.value}))} placeholder="Responsable" />
            )}
            <input type="date" className={inp} value={blank.dueDate} onChange={e => setBlank(f => ({...f, dueDate: e.target.value}))} />
            <select className={inp} value={blank.phase} onChange={e => setBlank(f => ({...f, phase: e.target.value}))}>
              {["General", ...FASES].map(f => <option key={f}>{f}</option>)}
            </select>
            <select className={inp} value={blank.status} onChange={e => setBlank(f => ({...f, status: e.target.value}))}>
              {ESTADOS_TASK.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <input className={inp + " w-full"} value={blank.notes} onChange={e => setBlank(f => ({...f, notes: e.target.value}))} placeholder="Notas (opcional)" />
          <div className="flex gap-2">
            <button onClick={addTask} disabled={saving || !blank.taskName.trim()}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 disabled:opacity-40">
              {saving ? "..." : "Agregar"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs hover:bg-neutral-50">Cancelar</button>
          </div>
        </div>
      )}

      {active.length === 0 && !showForm && <p className="text-[11px] text-neutral-400 italic py-4">Sin tareas activas.</p>}

      <div className="space-y-2">
        {active.map(t => (
          <div key={t.id} className={`flex items-start gap-2 border rounded-xl px-3 py-2.5 ${catStyle[cat(t)]}`}>
            <button onClick={() => toggle(t.id)} className="mt-0.5 w-4 h-4 rounded border border-neutral-300 bg-white flex-shrink-0 hover:border-rose-400" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-800">{t.taskName}</p>
              <div className="flex flex-wrap gap-x-2 mt-0.5 text-[10px] text-neutral-500">
                {t.assignedTo && <span>👤 {t.assignedTo}</span>}
                {t.dueDate    && <span>📅 {fmtDate(t.dueDate)}</span>}
                {t.phase && t.phase !== "General" && <span className="text-rose-500">{t.phase}</span>}
                {catBadge[cat(t)] && <span className="font-medium text-red-600">{catBadge[cat(t)]}</span>}
              </div>
              {t.notes && <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{t.notes}</p>}
            </div>
            <button onClick={() => remove(t.id)} className="text-neutral-300 hover:text-red-400 text-sm flex-shrink-0">✕</button>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <details className="mt-1">
          <summary className="text-[10px] text-neutral-400 cursor-pointer select-none">Ver {done.length} terminadas/canceladas</summary>
          <div className="space-y-1 mt-2">
            {done.map(t => (
              <div key={t.id} className="flex items-center gap-2 border border-neutral-100 rounded-xl px-3 py-2 bg-neutral-50">
                <button onClick={() => toggle(t.id)} className="w-4 h-4 rounded border border-green-400 bg-green-100 flex-shrink-0" />
                <p className="text-[11px] text-neutral-400 line-through flex-1">{t.taskName}</p>
                <button onClick={() => remove(t.id)} className="text-neutral-300 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── MINUTO A MINUTO TAB ─────────────────────────────────────────────────────

const M_CATEGORIES = ["General","Novios","Proveedores","Coordinación","Música","Fotos/Video","Protocolo"];
const M_CAT_COLORS = {
  "General":      "bg-neutral-100 text-neutral-600",
  "Novios":       "bg-rose-100 text-rose-700",
  "Proveedores":  "bg-amber-100 text-amber-700",
  "Coordinación": "bg-blue-100 text-blue-700",
  "Música":       "bg-violet-100 text-violet-700",
  "Fotos/Video":  "bg-teal-100 text-teal-700",
  "Protocolo":    "bg-orange-100 text-orange-700",
};

function MinutoTab({ boda, onScheduleChange }) {
  const [schedule, setSchedule] = useState(boda.schedule || []);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [blank, setBlank] = useState({ time: "", description: "", assignedTo: "", notes: "", category: "General" });
  const inp = "border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40";

  const sorted = [...schedule].sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  async function persist(updated) {
    setSchedule(updated);
    onScheduleChange(updated);
    await apiUpdateSchedule(boda.id, updated);
  }

  async function add() {
    if (!blank.time || !blank.description.trim()) return;
    setSaving(true);
    try { await persist([...schedule, { ...blank, id: uid() }]); setBlank({ time: "", description: "", assignedTo: "", notes: "", category: "General" }); setShowAdd(false); }
    catch(e) { alert("Error: " + e.message); }
    setSaving(false);
  }

  async function del(id) {
    try { await persist(schedule.filter(e => e.id !== id)); }
    catch { setSchedule(schedule); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{sorted.length} evento{sorted.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-2">
          {sorted.length > 0 && (
            <button onClick={() => window.print()} className="text-[11px] text-neutral-500 border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50 print:hidden">🖨 Imprimir</button>
          )}
          <button onClick={() => setShowAdd(v => !v)} className="text-[11px] text-rose-600 border border-rose-200 rounded-lg px-3 py-1.5 hover:bg-rose-50 print:hidden">+ Agregar</button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2 print:hidden">
          <div className="grid grid-cols-2 gap-2">
            <input type="time" className={inp} value={blank.time} onChange={e => setBlank(f => ({...f, time: e.target.value}))} />
            <select className={inp} value={blank.category} onChange={e => setBlank(f => ({...f, category: e.target.value}))}>
              {M_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input className={inp + " w-full"} value={blank.description} onChange={e => setBlank(f => ({...f, description: e.target.value}))} placeholder="Descripción del evento *" />
          <div className="grid grid-cols-2 gap-2">
            <input className={inp} value={blank.assignedTo} onChange={e => setBlank(f => ({...f, assignedTo: e.target.value}))} placeholder="Responsable" />
            <input className={inp} value={blank.notes} onChange={e => setBlank(f => ({...f, notes: e.target.value}))} placeholder="Notas" />
          </div>
          <div className="flex gap-2">
            <button onClick={add} disabled={saving || !blank.time || !blank.description.trim()}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 disabled:opacity-40">
              {saving ? "..." : "Agregar"}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs hover:bg-neutral-50">Cancelar</button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !showAdd && (
        <p className="text-[11px] text-neutral-400 italic py-4">Sin eventos. Agrega el primero arriba.</p>
      )}

      {/* Timeline */}
      <div className="relative">
        {sorted.length > 0 && <div className="absolute left-[54px] top-2 bottom-2 w-px bg-neutral-200" />}
        <div className="space-y-2">
          {sorted.map(ev => (
            <div key={ev.id} className="flex gap-3 items-start">
              <div className="w-[52px] text-right flex-shrink-0 pt-2.5">
                <span className="text-xs font-mono font-semibold text-neutral-600 tabular-nums">{ev.time}</span>
              </div>
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-400 flex-shrink-0 mt-3 z-10" />
                <div className="flex-1 bg-white border border-neutral-200 rounded-xl px-3 py-2.5 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-neutral-800">{ev.description}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${M_CAT_COLORS[ev.category] || M_CAT_COLORS["General"]}`}>
                          {ev.category}
                        </span>
                      </div>
                      {ev.assignedTo && <p className="text-[11px] text-neutral-500 mt-0.5">👤 {ev.assignedTo}</p>}
                      {ev.notes      && <p className="text-[10px] text-neutral-400 mt-0.5">{ev.notes}</p>}
                    </div>
                    <button onClick={() => del(ev.id)} className="text-neutral-300 hover:text-red-400 text-sm flex-shrink-0 print:hidden">✕</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── BODA DETAIL ─────────────────────────────────────────────────────────────

function BodaDetail({ boda: init, users, onBack, onRefresh }) {
  const [boda, setBoda] = useState(init);
  const [tab, setTab] = useState("resumen");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const days = daysUntil(boda.weddingDate);

  const handleSave = async (form) => {
    setSaving(true);
    try { await apiUpdateBoda(boda.id, form); setBoda(b => ({ ...b, ...form })); setEditing(false); onRefresh(); }
    catch(e) { alert("Error: " + e.message); }
    setSaving(false);
  };

  const activeTasks = (boda.tasks || []).filter(t => !["Terminado","Cancelado"].includes(t.status));

  const TABS = [
    { id: "resumen", label: "Resumen" },
    { id: "tareas",  label: `Tareas (${activeTasks.length})` },
    { id: "minuto",  label: "Minuto a Minuto" },
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-[11px] text-neutral-500 hover:text-neutral-800">← Bodas</button>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-medium text-neutral-800">{boda.clienteName}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{boda.clienteName}</h2>
            {boda.weddingDate && (
              <p className="text-sm text-neutral-500 mt-0.5">
                💍 {fmtDate(boda.weddingDate)}
                {days !== null && (
                  <span className={`ml-2 font-medium ${days < 0 ? "text-neutral-400" : days <= 30 ? "text-rose-600" : "text-neutral-600"}`}>
                    {days < 0 ? `(hace ${Math.abs(days)} días)` : days === 0 ? "(¡hoy!)" : `(en ${days} días)`}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-2 items-center flex-shrink-0">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${PHASE_COLORS[boda.phase] || "bg-neutral-100 text-neutral-600"}`}>
              {boda.phase}
            </span>
            <button onClick={() => setEditing(v => !v)}
              className="text-[11px] border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
              {editing ? "Cancelar" : "✏️ Editar"}
            </button>
          </div>
        </div>
        {editing && (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <BodaForm boda={boda} onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} users={users} />
          </div>
        )}
      </div>

      {/* Tabbed content */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-neutral-100">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors flex-1 ${tab === t.id ? "text-rose-700 border-b-2 border-rose-600 bg-rose-50/50" : "text-neutral-500 hover:text-neutral-800"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "resumen" && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {boda.venue      && <Cell label="Venue"        val={boda.venue} />}
              {boda.responsable && <Cell label="Responsable" val={boda.responsable} />}
              {boda.contact    && <Cell label="Contacto"     val={boda.contact} />}
              {boda.guestCount && <Cell label="Invitados"    val={boda.guestCount} />}
              {boda.budget     && <Cell label="Presupuesto"  val={`$${Number(boda.budget).toLocaleString("en-US")} USD`} />}
              {boda.status     && <Cell label="Estado"       val={boda.status} />}
              {boda.notes      && <div className="col-span-2"><Cell label="Notas" val={boda.notes} multi /></div>}
              {!boda.venue && !boda.responsable && !boda.notes && (
                <p className="col-span-2 text-[11px] text-neutral-400 italic">Sin información adicional. Edita para agregar.</p>
              )}
            </div>
          )}
          {tab === "tareas" && (
            <TasksTab boda={boda} users={users}
              onTasksChange={tasks => setBoda(b => ({ ...b, tasks }))} />
          )}
          {tab === "minuto" && (
            <MinutoTab boda={boda}
              onScheduleChange={schedule => setBoda(b => ({ ...b, schedule }))} />
          )}
        </div>
      </div>
    </div>
  );
}

function Cell({ label, val, multi }) {
  return (
    <div>
      <span className="block text-[11px] text-neutral-400 mb-0.5">{label}</span>
      <p className={`text-neutral-800 ${multi ? "whitespace-pre-line" : ""}`}>{val}</p>
    </div>
  );
}

// ─── TASK TEMPLATE ────────────────────────────────────────────────────────────

const WEDDING_TEMPLATE = [
  { phase:"Onboarding",   taskName:"Crear chat con cliente y equipo",  mode:"kickoff",       offset:0  },
  { phase:"Onboarding",   taskName:"Enviar mensaje de bienvenida",      mode:"kickoff",       offset:0  },
  { phase:"Onboarding",   taskName:"Recopilar documentos",              mode:"kickoff",       offset:1  },
  { phase:"Onboarding",   taskName:"Solicitar venues",                  mode:"kickoff",       offset:1  },
  { phase:"Onboarding",   taskName:"Enviar budget sheets",              mode:"kickoff",       offset:2  },
  { phase:"Onboarding",   taskName:"Schedule concierge call",           mode:"kickoff",       offset:7  },
  { phase:"Planning",     taskName:"Seleccionar proveedores",           mode:"wedding_minus", offset:90 },
  { phase:"Planning",     taskName:"Programar degustaciones",           mode:"wedding_minus", offset:60 },
  { phase:"Pre-Wedding",  taskName:"Minuto a minuto listo",             mode:"wedding_minus", offset:30 },
  { phase:"Wedding Day",  taskName:"Coordinación general",              mode:"wedding",       offset:0  },
  { phase:"Post-Wedding", taskName:"Factura final",                     mode:"wedding_plus",  offset:2  },
];

function calcDate(mode, offset, weddingDate) {
  const now     = new Date(); now.setHours(9, 0, 0, 0);
  const wedding = weddingDate ? new Date(weddingDate + "T12:00:00") : null;
  const D = 86400000;
  if (mode === "kickoff")       return new Date(now.getTime() + offset * D).toISOString().slice(0, 10);
  if (mode === "wedding_minus") return (wedding ? new Date(wedding.getTime() - offset * D) : new Date(now.getTime() + offset * D)).toISOString().slice(0, 10);
  if (mode === "wedding")       return (wedding || new Date(now.getTime() + 120 * D)).toISOString().slice(0, 10);
  if (mode === "wedding_plus")  return (wedding ? new Date(wedding.getTime() + offset * D) : new Date(now.getTime() + (120 + offset) * D)).toISOString().slice(0, 10);
  return "";
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────

export default function BodaPanel({ currentUser, onLogout }) {
  const [bodas,       setBodas]       = useState([]);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState("");
  const [selected,    setSelected]    = useState(null);
  const [showNew,     setShowNew]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [search,      setSearch]      = useState("");
  const [filterStatus,setFilterStatus]= useState("all");

  const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [bodaList, uRes] = await Promise.all([
        apiBodas(),
        fetch(GAS_URL, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify({action:"listUsers"}) })
          .then(r => r.json()).catch(() => ({})),
      ]);
      setBodas(bodaList);
      setUsers(Array.isArray(uRes?.data) ? uRes.data.filter(u => u.active !== "false") : []);
    } catch(e) {
      const msg = e.message || "";
      setErr(msg.includes("<") ? "Error de conexión con el servidor. Verifica tu sesión de Google." : "Error cargando datos: " + msg);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRefresh = useCallback(async () => {
    try {
      const list = await apiBodas();
      setBodas(list);
      if (selected) setSelected(list.find(b => b.id === selected.id) || null);
    } catch {}
  }, [selected]);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      const tasks = WEDDING_TEMPLATE.map(t => ({
        id: uid(), taskName: t.taskName, phase: t.phase,
        assignedTo: form.responsable || "", dueDate: calcDate(t.mode, t.offset, form.weddingDate),
        status: "Pendiente", notes: "",
      }));
      const id = await apiSaveBoda(form);
      await apiUpdateTasks(id, tasks);
      setShowNew(false);
      await load();
    } catch(e) { alert("Error al crear: " + e.message); }
    setSaving(false);
  };

  const handleDelete = async (e, boda) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar "${boda.clienteName}"? Esta acción no se puede deshacer.`)) return;
    try { await apiDeleteBoda(boda.id); setBodas(prev => prev.filter(b => b.id !== boda.id)); }
    catch(e) { alert("Error al eliminar: " + e.message); }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const filtered = bodas
    .filter(b => {
      const q = search.toLowerCase();
      return (!search || b.clienteName?.toLowerCase().includes(q) || b.venue?.toLowerCase().includes(q) || b.responsable?.toLowerCase().includes(q))
          && (filterStatus === "all" || b.status === filterStatus);
    })
    .sort((a, b) => {
      if (a.weddingDate && b.weddingDate) return new Date(a.weddingDate) - new Date(b.weddingDate);
      return a.weddingDate ? -1 : 1;
    });

  if (selected) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <BodaDetail boda={selected} users={users} onBack={() => setSelected(null)} onRefresh={handleRefresh} currentUser={currentUser} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💍</span>
          <div>
            <h1 className="text-base font-semibold text-neutral-900">Two Lovers — Bodas</h1>
            <p className="text-[11px] text-neutral-500">{bodas.filter(b => b.status === "Activa").length} bodas activas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-neutral-500">{currentUser?.name || currentUser?.email}</span>
          <button onClick={onLogout} className="text-[11px] text-neutral-400 hover:text-neutral-700 border border-neutral-200 rounded-lg px-2 py-1">Salir</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Search + filter + new */}
        <div className="flex flex-wrap gap-2 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar boda, venue, responsable..."
            className="flex-1 min-w-[200px] border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="all">Todos los estados</option>
            {ESTADOS_BODA.map(s => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setShowNew(v => !v)}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700">
            + Nueva boda
          </button>
        </div>

        {/* New boda form */}
        {showNew && (
          <div className="bg-white border border-rose-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-rose-700 mb-4">💍 Nueva boda</p>
            <BodaForm onSave={handleCreate} onCancel={() => setShowNew(false)} saving={saving} users={users} />
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{err}</span>
            <button onClick={load} className="underline ml-4">Reintentar</button>
          </div>
        )}

        {/* Stats */}
        {!loading && bodas.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Activas",       count: bodas.filter(b => b.status === "Activa").length,      color: "text-rose-600" },
              { label: "En pausa",      count: bodas.filter(b => b.status === "En pausa").length,    color: "text-amber-600" },
              { label: "Terminadas",    count: bodas.filter(b => b.status === "Terminada").length,   color: "text-green-600" },
              { label: "Tareas activas",count: bodas.flatMap(b => b.tasks||[]).filter(t => !["Terminado","Cancelado"].includes(t.status)).length, color: "text-violet-600" },
            ].map(s => (
              <div key={s.label} className="bg-white border border-neutral-200 rounded-xl p-4 text-center">
                <p className={`text-2xl font-semibold ${s.color}`}>{s.count}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-5 h-5 border-2 border-rose-200 border-t-rose-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-neutral-400">Cargando bodas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💍</p>
            <p className="text-neutral-500 text-sm">
              {bodas.length === 0 ? "Aún no hay bodas. Crea la primera arriba." : "Sin resultados para esa búsqueda."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(boda => {
              const days        = daysUntil(boda.weddingDate);
              const activeTasks = (boda.tasks||[]).filter(t => !["Terminado","Cancelado"].includes(t.status));
              const overdue     = activeTasks.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate + "T12:00:00"); d.setHours(0,0,0,0);
                return d < today;
              });
              return (
                <div key={boda.id} onClick={() => setSelected(boda)}
                  className="bg-white border border-neutral-200 rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-rose-300 hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-neutral-900">{boda.clienteName}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PHASE_COLORS[boda.phase] || "bg-neutral-100 text-neutral-600"}`}>{boda.phase}</span>
                      {overdue.length > 0 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">⚠️ {overdue.length} atrasada{overdue.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-1 text-[11px] text-neutral-500">
                      {boda.weddingDate && <span>💍 {fmtDate(boda.weddingDate)}{days !== null && days >= 0 && <span className="ml-1 text-neutral-400">({days}d)</span>}</span>}
                      {boda.venue       && <span>📍 {boda.venue}</span>}
                      {boda.responsable && <span>👤 {boda.responsable}</span>}
                      {boda.guestCount  && <span>👥 {boda.guestCount} invitados</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {activeTasks.length > 0 && <p className="text-[11px] text-neutral-500">{activeTasks.length} tarea{activeTasks.length > 1 ? "s" : ""}</p>}
                    <span className={`text-[10px] ${boda.status === "Activa" ? "text-green-600" : boda.status === "En pausa" ? "text-amber-600" : "text-neutral-400"}`}>{boda.status}</span>
                  </div>
                  <button onClick={e => handleDelete(e, boda)}
                    className="flex-shrink-0 text-neutral-300 hover:text-red-500 transition-colors text-lg px-1">🗑</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
