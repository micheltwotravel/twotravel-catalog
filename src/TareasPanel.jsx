import { useState, useEffect, useCallback } from "react";

const BODAS_GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

const FASES = ["General","Onboarding","Planning","Pre-Wedding","Wedding Day","Post-Wedding"];
const ESTADOS_ACTIVOS = ["Pendiente","En curso"];
const ESTADOS_TODOS = ["Pendiente","En curso","Terminado","Cancelado"];
const TIPOS = ["Task","Meeting"];

async function gasPost(action, payload = {}) {
  const res = await fetch(BODAS_GAS_URL, {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

function fmt(dateStr) {
  if (!dateStr) return "Sin fecha";
  const d = new Date(dateStr);
  if (isNaN(d)) return "Sin fecha";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function categorize(tasks) {
  const today = new Date(); today.setHours(0,0,0,0);
  const overdue = [], todayList = [], upcoming = [];
  tasks.forEach(t => {
    if (["Terminado","Cancelado"].includes(t.status)) return;
    if (!t.dueDate) { upcoming.push(t); return; }
    const d = new Date(t.dueDate); d.setHours(0,0,0,0);
    if (d < today) overdue.push(t);
    else if (d.getTime() === today.getTime()) todayList.push(t);
    else upcoming.push(t);
  });
  const byDate = (a,b) => new Date(a.dueDate||"9999") - new Date(b.dueDate||"9999");
  return {
    overdue: overdue.sort(byDate),
    today: todayList.sort(byDate),
    upcoming: upcoming.sort(byDate),
  };
}

function TaskCard({ task, onStatusChange, onEdit }) {
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = task.status === "Pendiente" || task.status === "En curso" ? "Terminado" : "Pendiente";
    setLoading(true);
    await onStatusChange(task, next);
    setLoading(false);
  }

  const isDone = ["Terminado","Cancelado"].includes(task.status);

  return (
    <div style={{
      display: "flex", gap: 10, alignItems: "flex-start",
      padding: "10px 12px", background: "#fff",
      border: "1px solid #e5ddd3", borderRadius: 8, marginBottom: 6,
      opacity: isDone ? 0.55 : 1,
    }}>
      <button onClick={toggle} disabled={loading} style={{
        marginTop: 2, width: 20, height: 20, borderRadius: "50%",
        border: isDone ? "2px solid #34a853" : "2px solid #9a7d52",
        background: isDone ? "#34a853" : "transparent",
        cursor: "pointer", flexShrink: 0, fontSize: 11,
        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isDone ? "✓" : ""}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 14, color: "#1a1814", textDecoration: isDone ? "line-through" : "none" }}>
          {task.taskName}
        </div>
        <div style={{ fontSize: 12, color: "#7a7570", marginTop: 2, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {task.kickoffId && <span>👰 {task.kickoffId}</span>}
          {task.fase && task.fase !== "General" && <span>📂 {task.fase}</span>}
          {task.assignedTo && <span>👤 {task.assignedTo}</span>}
          {task.tipo === "Meeting" && <span>📅 Meeting</span>}
          <span>{fmt(task.dueDate)}</span>
        </div>
        {task.notes && (
          <div style={{ fontSize: 11, color: "#9a7d52", marginTop: 3 }}>📝 {task.notes}</div>
        )}
      </div>
      <button onClick={() => onEdit(task)} style={{
        background: "none", border: "none", cursor: "pointer",
        color: "#7a7570", fontSize: 14, padding: "2px 4px",
      }}>✏️</button>
    </div>
  );
}

function Section({ title, color, tasks, onStatusChange, onEdit, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  if (tasks.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: "100%", textAlign: "left", background: color,
        border: "none", borderRadius: 8, padding: "8px 12px",
        fontWeight: 600, fontSize: 13, cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: open ? 8 : 0,
      }}>
        <span>{title}</span>
        <span style={{ background: "rgba(0,0,0,0.12)", borderRadius: 12, padding: "1px 8px", fontSize: 12 }}>
          {tasks.length} {open ? "▲" : "▼"}
        </span>
      </button>
      {open && tasks.map(t => (
        <TaskCard key={t.id} task={t} onStatusChange={onStatusChange} onEdit={onEdit} />
      ))}
    </div>
  );
}

function TaskForm({ initial, clientes, onSave, onCancel }) {
  const [form, setForm] = useState({
    kickoffId: initial?.kickoffId || "",
    taskName:  initial?.taskName  || "",
    assignedTo: initial?.assignedTo || "",
    fase:      initial?.fase      || "General",
    dueDate:   initial?.dueDate   ? initial.dueDate.slice(0,10) : "",
    status:    initial?.status    || "Pendiente",
    tipo:      initial?.tipo      || "Task",
    notes:     initial?.notes     || "",
  });
  const [saving, setSaving] = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.taskName.trim()) return;
    setSaving(true);
    await onSave({ ...form, id: initial?.id });
    setSaving(false);
  }

  const inp = { width: "100%", padding: "8px 10px", border: "1px solid #e5ddd3", borderRadius: 8, fontSize: 13, boxSizing: "border-box" };
  const lbl = { fontSize: 12, fontWeight: 600, color: "#5a5550", display: "block", marginBottom: 4 };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label style={lbl}>Tarea *</label>
        <input style={inp} value={form.taskName} onChange={e => set("taskName", e.target.value)} placeholder="Descripción de la tarea" required />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={lbl}>Cliente / Boda</label>
          <input style={inp} list="clientes-list" value={form.kickoffId} onChange={e => set("kickoffId", e.target.value)} placeholder="Nombre del cliente" />
          <datalist id="clientes-list">{clientes.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label style={lbl}>Fase</label>
          <select style={inp} value={form.fase} onChange={e => set("fase", e.target.value)}>
            {FASES.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Responsable</label>
          <input style={inp} value={form.assignedTo} onChange={e => set("assignedTo", e.target.value)} placeholder="Nombre o email" />
        </div>
        <div>
          <label style={lbl}>Fecha límite</label>
          <input style={{ ...inp, colorScheme: "light" }} type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
        </div>
        <div>
          <label style={lbl}>Tipo</label>
          <select style={inp} value={form.tipo} onChange={e => set("tipo", e.target.value)}>
            {TIPOS.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Estado</label>
          <select style={inp} value={form.status} onChange={e => set("status", e.target.value)}>
            {ESTADOS_TODOS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={lbl}>Notas</label>
        <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Notas opcionales..." />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 18px", border: "1px solid #e5ddd3", borderRadius: 8, background: "#fff", cursor: "pointer", fontSize: 13 }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving} style={{ padding: "8px 18px", background: "#9a7d52", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          {saving ? "Guardando..." : initial?.id ? "Guardar cambios" : "Crear tarea"}
        </button>
      </div>
    </form>
  );
}

export default function TareasPanel({ currentUser, onLogout }) {
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [filterResp, setFilterResp] = useState("");
  const [filterCliente, setFilterCliente] = useState("");
  const [filterQ, setFilterQ]     = useState("");
  const [showDone, setShowDone]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await gasPost("listTasks");
      if (res.ok) setTasks(res.data || []);
      else setError(res.error || "Error cargando tareas");
    } catch { setError("No se pudo conectar al servidor"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleStatusChange(task, newStatus) {
    const updated = { ...task, status: newStatus };
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    await gasPost("updateTask", { id: task.id, status: newStatus });
  }

  async function handleSave(form) {
    if (form.id) {
      await gasPost("updateTask", form);
      setTasks(prev => prev.map(t => t.id === form.id ? { ...t, ...form } : t));
    } else {
      const res = await gasPost("saveTask", form);
      if (res.ok) await load();
    }
    setShowForm(false); setEditTask(null);
  }

  function handleEdit(task) { setEditTask(task); setShowForm(true); }

  // Filtros
  const clientes = [...new Set(tasks.map(t => t.kickoffId).filter(Boolean))].sort();
  const responsables = [...new Set(tasks.flatMap(t => (t.assignedTo || "").split(/[,;]/).map(s => s.trim()).filter(Boolean)))].sort();

  const filtered = tasks.filter(t => {
    if (!showDone && ["Terminado","Cancelado"].includes(t.status)) return false;
    if (filterResp && !t.assignedTo?.toLowerCase().includes(filterResp.toLowerCase())) return false;
    if (filterCliente && t.kickoffId !== filterCliente) return false;
    if (filterQ) {
      const q = filterQ.toLowerCase();
      if (!(t.taskName?.toLowerCase().includes(q) || t.kickoffId?.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const cats = categorize(filtered);
  const done = filtered.filter(t => ["Terminado","Cancelado"].includes(t.status));

  const inp = { padding: "7px 10px", border: "1px solid #e5ddd3", borderRadius: 8, fontSize: 13, background: "#fff" };

  return (
    <div style={{ minHeight: "100vh", background: "#f9f7f4", fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#1a1814", color: "#f5f0e8", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/menu.html" style={{ color: "#9a7d52", textDecoration: "none", fontSize: 20 }}>←</a>
          <span style={{ fontSize: 18, fontWeight: 600 }}>✅ Tareas</span>
          <span style={{ fontSize: 12, color: "#9a7d52", background: "rgba(154,125,82,.15)", padding: "2px 8px", borderRadius: 12 }}>Two Lovers</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 12, color: "#9a7d52" }}>{currentUser?.name || currentUser?.email}</span>
          <button onClick={onLogout} style={{ background: "none", border: "1px solid #333", color: "#9a7d52", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "24px 16px" }}>
        {/* Filtros + Nueva tarea */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <select style={inp} value={filterCliente} onChange={e => setFilterCliente(e.target.value)}>
            <option value="">👰 Todos los clientes</option>
            {clientes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select style={inp} value={filterResp} onChange={e => setFilterResp(e.target.value)}>
            <option value="">👤 Todos</option>
            {responsables.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input style={{ ...inp, flex: 1, minWidth: 140 }} placeholder="🔍 Buscar..." value={filterQ} onChange={e => setFilterQ(e.target.value)} />
          <button onClick={() => { setEditTask(null); setShowForm(true); }} style={{
            padding: "7px 16px", background: "#9a7d52", color: "#fff",
            border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
          }}>+ Nueva tarea</button>
          <button onClick={load} style={{ ...inp, cursor: "pointer", background: "#fff" }}>↻</button>
        </div>

        {/* Formulario modal inline */}
        {showForm && (
          <div style={{ background: "#fff", border: "1px solid #e5ddd3", borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}>
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>
              {editTask ? "Editar tarea" : "Nueva tarea"}
            </div>
            <TaskForm
              initial={editTask}
              clientes={clientes}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditTask(null); }}
            />
          </div>
        )}

        {loading && <div style={{ textAlign: "center", color: "#9a7d52", padding: 40 }}>Cargando tareas...</div>}
        {error && (
          <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <Section title="⚠️ Atrasadas" color="#f4c7c3" tasks={cats.overdue} onStatusChange={handleStatusChange} onEdit={handleEdit} />
            <Section title="🔥 Para hoy" color="#ffe599" tasks={cats.today} onStatusChange={handleStatusChange} onEdit={handleEdit} />
            <Section title="📅 Próximas" color="#c9daf8" tasks={cats.upcoming} onStatusChange={handleStatusChange} onEdit={handleEdit} defaultOpen={true} />

            {/* Toggle terminadas */}
            <button onClick={() => setShowDone(s => !s)} style={{
              background: "none", border: "1px solid #e5ddd3", borderRadius: 8,
              padding: "6px 14px", cursor: "pointer", fontSize: 12, color: "#7a7570", marginBottom: 10,
            }}>
              {showDone ? "Ocultar terminadas" : `Ver terminadas (${done.length})`}
            </button>
            {showDone && done.length > 0 && (
              <div style={{ opacity: 0.7 }}>
                {done.map(t => <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onEdit={handleEdit} />)}
              </div>
            )}

            {cats.overdue.length + cats.today.length + cats.upcoming.length === 0 && !loading && (
              <div style={{ textAlign: "center", color: "#9a7d52", padding: 40, background: "#fff", borderRadius: 12, border: "1px solid #e5ddd3" }}>
                ✅ No hay tareas activas con estos filtros
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
