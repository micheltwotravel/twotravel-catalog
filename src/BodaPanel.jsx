import React, { useState, useEffect, useCallback } from "react";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

async function gasPost(body) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { ok: false, error: text }; }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const FASES = ["Onboarding", "Planning", "Pre-Wedding", "Wedding Day", "Post-Wedding"];
const ESTADOS_BODA = ["Activa", "En pausa", "Terminada", "Cancelada"];
const ESTADOS_TASK = ["Pendiente", "En curso", "Terminado", "Cancelado"];

function parseDate(d) {
  if (!d) return null;
  if (typeof d === "string") return new Date(d.length === 10 ? d + "T12:00:00" : d);
  return new Date(d);
}

function toDateInput(d) {
  if (!d) return "";
  const dt = parseDate(d);
  if (!dt || isNaN(dt)) return "";
  return dt.toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return "";
  const dt = parseDate(d);
  if (!dt || isNaN(dt)) return String(d);
  return dt.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(d) {
  if (!d) return null;
  const dt = parseDate(d);
  if (!dt || isNaN(dt)) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.ceil((dt - today) / 86400000);
}

// ─────────────────────────────────────────────
// BODA FORM
// ─────────────────────────────────────────────
function BodaForm({ boda, onSave, onCancel, saving, users = [] }) {
  const [form, setForm] = useState({
    clienteName: boda?.clienteName || "",
    weddingDate: toDateInput(boda?.weddingDate),
    venue: boda?.venue || "",
    responsable: boda?.responsable || "",
    phase: boda?.phase || "Onboarding",
    status: boda?.status || "Activa",
    guestCount: boda?.guestCount || "",
    budget: boda?.budget || "",
    notes: boda?.notes || "",
    contact: boda?.contact || "",
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
      <div className="flex gap-2 pt-2">
        <button onClick={() => onSave(form)} disabled={saving || !form.clienteName.trim()}
          className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700 disabled:opacity-40">
          {saving ? "Guardando..." : boda ? "Guardar cambios" : "Crear boda"}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TASK FORM
// ─────────────────────────────────────────────
function TaskForm({ bodaId, bodaName, users = [], onSave, onCancel, saving }) {
  const [form, setForm] = useState({
    taskName: "", assignedTo: "", assignedEmail: "", dueDate: "",
    status: "Pendiente", notes: "", phase: "General",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const inp = "w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40";

  function selectUser(name) {
    const u = users.find(u => (u.name || u.email) === name);
    setForm(f => ({ ...f, assignedTo: name, assignedEmail: u?.email || "" }));
  }

  return (
    <div className="space-y-3 bg-rose-50 border border-rose-200 rounded-xl p-4">
      <p className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide">Nueva tarea</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <input className={inp} value={form.taskName} onChange={e => set("taskName", e.target.value)} placeholder="Descripción de la tarea *" />
        </div>
        <div>
          {users.length > 0 ? (
            <select className={inp} value={form.assignedTo} onChange={e => selectUser(e.target.value)}>
              <option value="">— responsable —</option>
              {users.map(u => <option key={u.email} value={u.name || u.email}>{u.name || u.email}</option>)}
            </select>
          ) : (
            <input className={inp} value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)} placeholder="Responsable" />
          )}
        </div>
        <div>
          <input type="date" className={inp} value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
        </div>
        <div>
          <select className={inp} value={form.phase} onChange={e => set("phase", e.target.value)}>
            {["General", ...FASES].map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <select className={inp} value={form.status} onChange={e => set("status", e.target.value)}>
            {ESTADOS_TASK.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <input className={inp} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notas (opcional)" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave({ ...form, kickoffId: bodaId, kickoffName: bodaName })}
          disabled={saving || !form.taskName.trim()}
          className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-40">
          {saving ? "..." : "Agregar tarea"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs hover:bg-neutral-50">Cancelar</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// TASKS LIST
// ─────────────────────────────────────────────
function BodaTasks({ bodaId, bodaName, tasks, users, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const bodaTasks = tasks.filter(t => t.kickoffId === bodaId);
  const today = new Date(); today.setHours(0,0,0,0);

  const categorize = (t) => {
    if (!t.dueDate) return "upcoming";
    const d = new Date(t.dueDate + "T12:00:00"); d.setHours(0,0,0,0);
    if (d < today) return "overdue";
    if (d.getTime() === today.getTime()) return "today";
    return "upcoming";
  };

  const active = bodaTasks.filter(t => !["Terminado","Cancelado"].includes(t.status));
  const done   = bodaTasks.filter(t => ["Terminado","Cancelado"].includes(t.status));

  const handleSave = async (form) => {
    setSaving(true);
    await gasPost({ action: "saveTask", payload: { ...form, createdAt: new Date().toISOString() } });
    setSaving(false);
    setShowForm(false);
    onRefresh();
  };

  const toggleStatus = async (task) => {
    const next = task.status === "Terminado" ? "Pendiente" : "Terminado";
    setUpdatingId(task.id);
    await gasPost({ action: "updateTask", payload: { ...task, status: next } });
    setUpdatingId(null);
    onRefresh();
  };

  const catColor = { overdue: "border-red-400 bg-red-50", today: "border-amber-400 bg-amber-50", upcoming: "border-neutral-200 bg-white" };
  const catLabel = { overdue: "⚠️ Atrasada", today: "🔥 Hoy", upcoming: "" };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
          Tareas ({active.length} activas)
        </p>
        <button onClick={() => setShowForm(v => !v)}
          className="text-[11px] text-rose-600 border border-rose-200 rounded-lg px-2 py-1 hover:bg-rose-50">
          + Nueva tarea
        </button>
      </div>

      {showForm && <TaskForm bodaId={bodaId} bodaName={bodaName} users={users} onSave={handleSave} onCancel={() => setShowForm(false)} saving={saving} />}

      {active.length === 0 && !showForm && (
        <p className="text-[11px] text-neutral-400 italic py-2">Sin tareas activas. Agrega una arriba.</p>
      )}

      {active.map(t => {
        const cat = categorize(t);
        return (
          <div key={t.id} className={`flex items-start gap-2 border rounded-lg px-3 py-2 ${catColor[cat]}`}>
            <button onClick={() => toggleStatus(t)} disabled={updatingId === t.id}
              className="mt-0.5 w-4 h-4 rounded border border-neutral-300 bg-white flex-shrink-0 hover:border-rose-400 flex items-center justify-center">
              {updatingId === t.id ? <span className="text-[8px]">...</span> : null}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-neutral-800">{t.taskName}</p>
              <div className="flex flex-wrap gap-x-2 mt-0.5 text-[10px] text-neutral-500">
                {t.assignedTo && <span>👤 {t.assignedTo}</span>}
                {t.dueDate && <span>📅 {fmtDate(t.dueDate)}</span>}
                {catLabel[cat] && <span className="font-medium text-red-600">{catLabel[cat]}</span>}
                {t.kickoffName && <span className="text-rose-500">{t.phase || ""}</span>}
              </div>
              {t.notes && <p className="text-[10px] text-neutral-400 mt-0.5 truncate">{t.notes}</p>}
            </div>
          </div>
        );
      })}

      {done.length > 0 && (
        <details className="mt-2">
          <summary className="text-[10px] text-neutral-400 cursor-pointer">Ver {done.length} terminadas/canceladas</summary>
          <div className="space-y-1 mt-1">
            {done.map(t => (
              <div key={t.id} className="flex items-center gap-2 border border-neutral-100 rounded-lg px-3 py-1.5 bg-neutral-50">
                <button onClick={() => toggleStatus(t)} className="w-4 h-4 rounded border border-green-400 bg-green-100 flex-shrink-0" />
                <p className="text-[11px] text-neutral-400 line-through">{t.taskName}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// BODA DETAIL
// ─────────────────────────────────────────────
function BodaDetail({ boda, tasks, users, onBack, onRefresh, currentUser }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const days = daysUntil(boda.weddingDate);

  const handleSave = async (form) => {
    setSaving(true);
    await gasPost({ action: "updateBoda", id: boda.id, updates: { ...form } });
    setSaving(false);
    setEditing(false);
    onRefresh();
  };

  const phaseColors = {
    "Onboarding": "bg-blue-100 text-blue-700",
    "Planning": "bg-violet-100 text-violet-700",
    "Pre-Wedding": "bg-amber-100 text-amber-700",
    "Wedding Day": "bg-rose-100 text-rose-700",
    "Post-Wedding": "bg-green-100 text-green-700",
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={onBack} className="text-[11px] text-neutral-500 hover:text-neutral-800">← Bodas</button>
        <span className="text-neutral-300">/</span>
        <span className="text-sm font-medium">{boda.clienteName}</span>
      </div>

      {/* Header card */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
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
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${phaseColors[boda.phase] || "bg-neutral-100 text-neutral-600"}`}>
              {boda.phase}
            </span>
            <button onClick={() => setEditing(v => !v)}
              className="text-[11px] border border-neutral-200 rounded-lg px-3 py-1.5 hover:bg-neutral-50">
              {editing ? "Cancelar" : "✏️ Editar"}
            </button>
          </div>
        </div>

        {!editing && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-4 text-sm">
            {boda.venue && <div><span className="text-neutral-400 text-[11px]">Venue</span><p className="text-neutral-800">{boda.venue}</p></div>}
            {boda.responsable && <div><span className="text-neutral-400 text-[11px]">Responsable</span><p className="text-neutral-800">{boda.responsable}</p></div>}
            {boda.contact && <div><span className="text-neutral-400 text-[11px]">Contacto</span><p className="text-neutral-800">{boda.contact}</p></div>}
            {boda.guestCount && <div><span className="text-neutral-400 text-[11px]">Invitados</span><p className="text-neutral-800">{boda.guestCount}</p></div>}
            {boda.budget && <div><span className="text-neutral-400 text-[11px]">Presupuesto</span><p className="text-neutral-800">${Number(boda.budget).toLocaleString("en-US")} USD</p></div>}
            {boda.status && <div><span className="text-neutral-400 text-[11px]">Estado</span><p className="text-neutral-800">{boda.status}</p></div>}
            {boda.notes && <div className="col-span-2"><span className="text-neutral-400 text-[11px]">Notas</span><p className="text-neutral-700 text-sm whitespace-pre-line">{boda.notes}</p></div>}
          </div>
        )}

        {editing && <div className="mt-4"><BodaForm boda={boda} onSave={handleSave} onCancel={() => setEditing(false)} saving={saving} users={users} /></div>}
      </div>

      {/* Tasks */}
      <div className="bg-white border border-neutral-200 rounded-xl p-5">
        <BodaTasks bodaId={boda.id} bodaName={boda.clienteName} tasks={tasks} users={users} onRefresh={onRefresh} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN PANEL
// ─────────────────────────────────────────────
export default function BodaPanel({ currentUser, onLogout }) {
  const [bodas, setBodas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [b, t, u] = await Promise.all([
      gasPost({ action: "listBodas" }),
      gasPost({ action: "listTasks" }),
      gasPost({ action: "listUsers" }),
    ]);
    setBodas(Array.isArray(b?.data) ? b.data : []);
    setTasks(Array.isArray(t?.data) ? t.data : []);
    setUsers(Array.isArray(u?.data) ? u.data.filter(u => u.active !== "false") : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh selected boda after edits
  const handleRefresh = useCallback(async () => {
    const [b, t] = await Promise.all([
      gasPost({ action: "listBodas" }),
      gasPost({ action: "listTasks" }),
    ]);
    const newBodas = Array.isArray(b?.data) ? b.data : [];
    setBodas(newBodas);
    setTasks(Array.isArray(t?.data) ? t.data : []);
    if (selected) setSelected(newBodas.find(x => x.id === selected.id) || null);
  }, [selected]);

  const WEDDING_TEMPLATE = [
    { fase:"Onboarding",   taskName:"Crear chat con cliente y equipo",  mode:"kickoff",       offset:0  },
    { fase:"Onboarding",   taskName:"Enviar mensaje de bienvenida",      mode:"kickoff",       offset:0  },
    { fase:"Onboarding",   taskName:"Recopilar documentos",              mode:"kickoff",       offset:1  },
    { fase:"Onboarding",   taskName:"Solicitar venues",                  mode:"kickoff",       offset:1  },
    { fase:"Onboarding",   taskName:"Enviar budget sheets",              mode:"kickoff",       offset:2  },
    { fase:"Onboarding",   taskName:"Schedule concierge call",           mode:"kickoff",       offset:7  },
    { fase:"Planning",     taskName:"Seleccionar proveedores",           mode:"wedding_minus", offset:90 },
    { fase:"Planning",     taskName:"Programar degustaciones",           mode:"wedding_minus", offset:60 },
    { fase:"Pre-Wedding",  taskName:"Minuto a minuto listo",             mode:"wedding_minus", offset:30 },
    { fase:"Wedding Day",  taskName:"Coordinación general",              mode:"wedding",       offset:0  },
    { fase:"Post-Wedding", taskName:"Factura final",                     mode:"wedding_plus",  offset:2  },
  ];

  function calcTaskDate(mode, offset, weddingDate) {
    const now = new Date(); now.setHours(9,0,0,0);
    const wedding = weddingDate ? new Date(weddingDate) : null;
    const DAY = 86400000;
    if (mode === "kickoff")       return new Date(now.getTime() + offset * DAY).toISOString().slice(0,10);
    if (mode === "wedding_minus") return wedding ? new Date(wedding.getTime() - offset * DAY).toISOString().slice(0,10) : new Date(now.getTime() + offset * DAY).toISOString().slice(0,10);
    if (mode === "wedding")       return wedding ? wedding.toISOString().slice(0,10) : new Date(now.getTime() + 120 * DAY).toISOString().slice(0,10);
    if (mode === "wedding_plus")  return wedding ? new Date(wedding.getTime() + offset * DAY).toISOString().slice(0,10) : new Date(now.getTime() + (120 + offset) * DAY).toISOString().slice(0,10);
    return "";
  }

  const handleCreate = async (form) => {
    setSaving(true);
    const bodaId = "boda_" + Date.now();
    const respUser = users.find(u => u.name === form.responsable || u.email === form.responsable);
    const res = await gasPost({ action: "saveBoda", payload: { ...form, id: bodaId, createdAt: new Date().toISOString() } });
    if (res?.ok) {
      await Promise.all(WEDDING_TEMPLATE.map(t => gasPost({ action: "saveTask", payload: {
        taskName:      t.taskName,
        fase:          t.fase,
        kickoffId:     bodaId,
        kickoffName:   form.clienteName,
        assignedTo:    form.responsable || "",
        assignedEmail: respUser?.email || "",
        dueDate:       calcTaskDate(t.mode, t.offset, form.weddingDate),
        status:        "Pendiente",
        source:        "bodas",
        createdAt:     new Date().toISOString(),
      }})));
      setShowNew(false); load();
    }
    setSaving(false);
  };

  const filtered = bodas.filter(b => {
    const matchSearch = !search || b.clienteName?.toLowerCase().includes(search.toLowerCase()) || b.venue?.toLowerCase().includes(search.toLowerCase()) || b.responsable?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || b.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    if (a.weddingDate && b.weddingDate) return new Date(a.weddingDate) - new Date(b.weddingDate);
    if (a.weddingDate) return -1;
    return 1;
  });

  const phaseColors = {
    "Onboarding": "bg-blue-100 text-blue-700",
    "Planning": "bg-violet-100 text-violet-700",
    "Pre-Wedding": "bg-amber-100 text-amber-700",
    "Wedding Day": "bg-rose-100 text-rose-700",
    "Post-Wedding": "bg-green-100 text-green-700",
  };

  if (selected) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <BodaDetail boda={selected} tasks={tasks} users={users} onBack={() => setSelected(null)} onRefresh={handleRefresh} currentUser={currentUser} />
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

        {/* Filters + New */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar boda, venue, responsable..."
            className="flex-1 min-w-[200px] border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300/40"
          />
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

        {/* Stats */}
        {!loading && bodas.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Activas", count: bodas.filter(b => b.status === "Activa").length, color: "text-rose-600" },
              { label: "En pausa", count: bodas.filter(b => b.status === "En pausa").length, color: "text-amber-600" },
              { label: "Terminadas", count: bodas.filter(b => b.status === "Terminada").length, color: "text-green-600" },
              { label: "Total tareas activas", count: tasks.filter(t => !["Terminado","Cancelado"].includes(t.status) && bodas.some(b => b.id === t.kickoffId)).length, color: "text-violet-600" },
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
          <p className="text-sm text-neutral-400 py-8 text-center">Cargando bodas...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">💍</p>
            <p className="text-neutral-500 text-sm">{bodas.length === 0 ? "Aún no hay bodas. Crea la primera arriba." : "Sin resultados para esa búsqueda."}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(boda => {
              const days = daysUntil(boda.weddingDate);
              const activeTasks = tasks.filter(t => t.kickoffId === boda.id && !["Terminado","Cancelado"].includes(t.status));
              const overdue = activeTasks.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate + "T12:00:00"); d.setHours(0,0,0,0);
                return d < new Date().setHours(0,0,0,0);
              });

              return (
                <div key={boda.id} onClick={() => setSelected(boda)}
                  className="bg-white border border-neutral-200 rounded-xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-rose-300 hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-neutral-900">{boda.clienteName}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${phaseColors[boda.phase] || "bg-neutral-100 text-neutral-600"}`}>
                        {boda.phase}
                      </span>
                      {overdue.length > 0 && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                          ⚠️ {overdue.length} atrasada{overdue.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-1 text-[11px] text-neutral-500">
                      {boda.weddingDate && (
                        <span>
                          💍 {fmtDate(boda.weddingDate)}
                          {days !== null && days >= 0 && <span className="ml-1 text-neutral-400">({days}d)</span>}
                        </span>
                      )}
                      {boda.venue && <span>📍 {boda.venue}</span>}
                      {boda.responsable && <span>👤 {boda.responsable}</span>}
                      {boda.guestCount && <span>👥 {boda.guestCount} invitados</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {activeTasks.length > 0 && (
                      <p className="text-[11px] text-neutral-500">{activeTasks.length} tarea{activeTasks.length > 1 ? "s" : ""}</p>
                    )}
                    <span className={`text-[10px] ${boda.status === "Activa" ? "text-green-600" : boda.status === "En pausa" ? "text-amber-600" : "text-neutral-400"}`}>
                      {boda.status}
                    </span>
                    <p className="text-neutral-300 text-sm mt-1">→</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
