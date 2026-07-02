import { useState, useEffect, useCallback, useRef } from "react";

const GAS = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

const FASES       = ["General","Onboarding","Planning","Pre-Wedding","Wedding Day","Post-Wedding"];
const BODAS_FASES = new Set(["Onboarding","Planning","Pre-Wedding","Wedding Day","Post-Wedding"]);
const ESTADOS     = ["Pendiente","En curso","Terminado","Cancelado"];
const TIPOS       = ["Task","Meeting"];
const COLORS      = { overdue:"#f4c7c3", today:"#ffe599", upcoming:"#c9daf8", done:"#d9ead3" };

async function gas(action, payload = {}) {
  const r = await fetch(GAS, { method:"POST", body: JSON.stringify({ action, payload }) });
  return r.json();
}

function isBoda(t) {
  return t.source === "bodas" || BODAS_FASES.has(t.fase) || String(t.kickoffId||"").startsWith("boda_");
}

function fmtDate(s) {
  if (!s) return "Sin fecha";
  const d = new Date(s);
  if (isNaN(d)) return "Sin fecha";
  return d.toLocaleDateString("es-CO", { day:"2-digit", month:"short", year:"numeric" });
}

function diasRestantes(s) {
  if (!s) return null;
  const d = new Date(s); d.setHours(0,0,0,0);
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return Math.round((d - hoy) / 86400000);
}

function categorizarTareas(tasks) {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const overdue=[], today=[], upcoming=[], done=[];
  tasks.forEach(t => {
    if (["Terminado","Cancelado"].includes(t.status)) { done.push(t); return; }
    if (!t.dueDate) { upcoming.push(t); return; }
    const d = new Date(t.dueDate); d.setHours(0,0,0,0);
    if (d < hoy) overdue.push(t);
    else if (d.getTime() === hoy.getTime()) today.push(t);
    else upcoming.push(t);
  });
  const byDate = (a,b) => new Date(a.dueDate||"9999") - new Date(b.dueDate||"9999");
  return { overdue:overdue.sort(byDate), today:today.sort(byDate), upcoming:upcoming.sort(byDate), done };
}

// ── TaskCard ──────────────────────────────────────────────────────
function TaskCard({ task, onStatusChange, onEdit, accentColor }) {
  const [loading, setLoading] = useState(false);
  const isDone = ["Terminado","Cancelado"].includes(task.status);
  const dias = diasRestantes(task.dueDate);

  async function toggleDone() {
    const next = isDone ? "Pendiente" : "Terminado";
    setLoading(true);
    await onStatusChange(task, next);
    setLoading(false);
  }

  return (
    <div onClick={() => onEdit(task)} style={{
      display:"flex", gap:10, alignItems:"flex-start",
      padding:"10px 12px", background:"#fff",
      borderLeft:`3px solid ${accentColor || "#9a7d52"}`,
      borderRadius:"0 8px 8px 0", marginBottom:6, cursor:"pointer",
      opacity: isDone ? 0.5 : 1,
      boxShadow:"0 1px 3px rgba(0,0,0,0.06)",
      transition:"box-shadow 0.15s",
    }}
    onMouseEnter={e => e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.1)"}
    onMouseLeave={e => e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.06)"}
    >
      <button onClick={e => { e.stopPropagation(); toggleDone(); }} disabled={loading}
        style={{
          marginTop:2, width:20, height:20, borderRadius:"50%", flexShrink:0,
          border: isDone ? "2px solid #34a853" : `2px solid ${accentColor||"#9a7d52"}`,
          background: isDone ? "#34a853" : "transparent",
          cursor:"pointer", color:"#fff", fontSize:11,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
        {isDone ? "✓" : ""}
      </button>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:500, fontSize:14, color:"#1a1814", textDecoration: isDone?"line-through":"none", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
          {task.tipo === "Meeting" ? "📅 " : ""}{task.taskName}
        </div>
        <div style={{ fontSize:12, color:"#7a7570", marginTop:3, display:"flex", gap:8, flexWrap:"wrap" }}>
          {task.kickoffId && <span style={{ background:"#f5f0ea", padding:"1px 6px", borderRadius:10 }}>👰 {task.kickoffId}</span>}
          {task.fase && task.fase !== "General" && <span>📂 {task.fase}</span>}
          {task.assignedTo && <span>👤 {task.assignedTo}</span>}
        </div>
        {task.notes && <div style={{ fontSize:11, color:"#9a7d52", marginTop:2 }}>📝 {task.notes}</div>}
      </div>

      <div style={{ textAlign:"right", flexShrink:0 }}>
        {task.dueDate && (
          <div style={{ fontSize:11, color: dias!=null&&dias<0?"#c0392b":dias===0?"#e67e22":"#5f6368", fontWeight: dias!=null&&dias<=1?600:400 }}>
            {dias === null ? "" : dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? "Hoy" : `en ${dias}d`}
          </div>
        )}
        <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{fmtDate(task.dueDate)}</div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────
function Section({ id, title, color, accent, tasks, onStatusChange, onEdit, defaultOpen=true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom:16 }}>
      <button onClick={() => setOpen(o=>!o)} style={{
        width:"100%", textAlign:"left", background:color,
        border:"none", borderRadius:8, padding:"9px 14px",
        fontWeight:600, fontSize:13, cursor:"pointer",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom: open ? 8 : 0,
      }}>
        <span>{title}</span>
        <span style={{ background:"rgba(0,0,0,0.12)", borderRadius:12, padding:"1px 10px", fontSize:12 }}>
          {tasks.length} {open?"▲":"▼"}
        </span>
      </button>
      {open && tasks.map(t => (
        <TaskCard key={t.id} task={t} onStatusChange={onStatusChange} onEdit={onEdit} accentColor={accent} />
      ))}
      {open && tasks.length === 0 && (
        <div style={{ fontSize:12, color:"#aaa", padding:"6px 12px", fontStyle:"italic" }}>Sin tareas</div>
      )}
    </div>
  );
}

// ── TaskModal ─────────────────────────────────────────────────────
function TaskModal({ task, clientes, responsables, onSave, onDelete, onClose }) {
  const isNew = !task?.id;
  const [form, setForm] = useState({
    kickoffId:   task?.kickoffId   || "",
    taskName:    task?.taskName    || "",
    assignedTo:  task?.assignedTo  || "",
    fase:        task?.fase        || "General",
    dueDate:     task?.dueDate     ? task.dueDate.slice(0,10) : "",
    status:      task?.status      || "Pendiente",
    tipo:        task?.tipo        || "Task",
    notes:       task?.notes       || "",
    priority:    task?.priority    || "normal",
  });
  const [saving, setSaving] = useState(false);
  const [confirmarDelete, setConfirmarDelete] = useState(false);

  function set(k,v) { setForm(f=>({...f,[k]:v})); }

  async function submit(e) {
    e.preventDefault();
    if (!form.taskName.trim()) return;
    setSaving(true);
    await onSave({ ...form, id: task?.id });
    setSaving(false);
  }

  async function doDelete() {
    setSaving(true);
    await onDelete(task.id);
    setSaving(false);
  }

  const inp = { width:"100%", padding:"8px 10px", border:"1px solid #e5ddd3", borderRadius:8, fontSize:13, boxSizing:"border-box", background:"#fff" };
  const lbl = { fontSize:11, fontWeight:600, color:"#7a7570", display:"block", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" };

  return (
    <div onClick={e => { if(e.target===e.currentTarget) onClose(); }} style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16,
    }}>
      <div style={{ background:"#fff", borderRadius:14, padding:24, width:"100%", maxWidth:540, maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:16, color:"#1a1814" }}>{isNew ? "Nueva tarea" : "Editar tarea"}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#999" }}>×</button>
        </div>

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div>
            <label style={lbl}>Tarea *</label>
            <input style={inp} value={form.taskName} onChange={e=>set("taskName",e.target.value)} placeholder="Descripción de la tarea" required autoFocus />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={lbl}>Cliente / Boda</label>
              <input style={inp} list="cl-list" value={form.kickoffId} onChange={e=>set("kickoffId",e.target.value)} placeholder="Nombre del cliente" />
              <datalist id="cl-list">{clientes.map(c=><option key={c} value={c}/>)}</datalist>
            </div>
            <div>
              <label style={lbl}>Fase</label>
              <select style={inp} value={form.fase} onChange={e=>set("fase",e.target.value)}>
                {FASES.map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Responsable</label>
              <input style={inp} list="resp-list" value={form.assignedTo} onChange={e=>set("assignedTo",e.target.value)} placeholder="Nombre o email" />
              <datalist id="resp-list">{responsables.map(r=><option key={r} value={r}/>)}</datalist>
            </div>
            <div>
              <label style={lbl}>Fecha límite</label>
              <input style={{...inp, colorScheme:"light"}} type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Tipo</label>
              <select style={inp} value={form.tipo} onChange={e=>set("tipo",e.target.value)}>
                {TIPOS.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Estado</label>
              <select style={inp} value={form.status} onChange={e=>set("status",e.target.value)}>
                {ESTADOS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={lbl}>Notas</label>
            <textarea style={{...inp, resize:"vertical", minHeight:56}} value={form.notes} onChange={e=>set("notes",e.target.value)} placeholder="Notas opcionales..." />
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"space-between", marginTop:4 }}>
            {!isNew && (
              confirmarDelete
                ? <div style={{ display:"flex", gap:6 }}>
                    <button type="button" onClick={doDelete} disabled={saving} style={{ padding:"8px 14px", background:"#c0392b", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13 }}>
                      Confirmar
                    </button>
                    <button type="button" onClick={()=>setConfirmarDelete(false)} style={{ padding:"8px 14px", border:"1px solid #e5ddd3", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:13 }}>
                      Cancelar
                    </button>
                  </div>
                : <button type="button" onClick={()=>setConfirmarDelete(true)} style={{ padding:"8px 14px", border:"1px solid #e5ddd3", color:"#c0392b", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:13 }}>
                    🗑 Eliminar
                  </button>
            )}
            <div style={{ display:"flex", gap:8, marginLeft:"auto" }}>
              <button type="button" onClick={onClose} style={{ padding:"8px 18px", border:"1px solid #e5ddd3", borderRadius:8, background:"#fff", cursor:"pointer", fontSize:13 }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving} style={{ padding:"8px 20px", background:"#9a7d52", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>
                {saving ? "Guardando..." : isNew ? "Crear" : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── TareasPanel ───────────────────────────────────────────────────
export default function TareasPanel({ currentUser, onLogout }) {
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [modal, setModal]         = useState(null); // null | task object | {}
  const [scope, setScope]         = useState("all"); // "all" | "mine"
  const [filterCliente, setFilterCliente] = useState("");
  const [filterResp, setFilterResp]       = useState("");
  const [filterQ, setFilterQ]             = useState("");
  const [showDone, setShowDone]   = useState(false);
  const searchRef = useRef();

  const myName  = currentUser?.name  || "";
  const myEmail = currentUser?.email || "";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await gas("listTasks");
      if (res.ok) setTasks((res.data||[]).filter(isBoda));
      else setError(res.error || "Error al cargar");
    } catch { setError("No se pudo conectar"); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtrado
  const filtered = tasks.filter(t => {
    if (scope === "mine") {
      const resp = (t.assignedTo||"").toLowerCase();
      if (!resp.includes(myName.toLowerCase()) && !resp.includes(myEmail.toLowerCase())) return false;
    }
    if (filterCliente && t.kickoffId !== filterCliente) return false;
    if (filterResp && !(t.assignedTo||"").toLowerCase().includes(filterResp.toLowerCase())) return false;
    if (filterQ) {
      const q = filterQ.toLowerCase();
      if (!((t.taskName||"").toLowerCase().includes(q) || (t.kickoffId||"").toLowerCase().includes(q) || (t.notes||"").toLowerCase().includes(q))) return false;
    }
    if (!showDone && ["Terminado","Cancelado"].includes(t.status)) return false;
    return true;
  });

  const cats = categorizarTareas(filtered);
  const allActive = cats.overdue.length + cats.today.length + cats.upcoming.length;

  const clientes    = [...new Set(tasks.map(t=>t.kickoffId).filter(Boolean))].sort();
  const responsables = [...new Set(tasks.flatMap(t=>(t.assignedTo||"").split(/[,;]/).map(s=>s.trim()).filter(Boolean)))].sort();

  async function handleStatusChange(task, newStatus) {
    setTasks(prev => prev.map(t => t.id===task.id ? {...t,status:newStatus} : t));
    await gas("updateTask", { id:task.id, status:newStatus });
  }

  async function handleSave(form) {
    if (form.id) {
      await gas("updateTask", form);
      setTasks(prev => prev.map(t => t.id===form.id ? {...t,...form} : t));
    } else {
      await gas("saveTask", { ...form, source:"bodas" });
      await load();
    }
    setModal(null);
  }

  async function handleDelete(id) {
    await gas("updateTask", { id, status:"Cancelado" });
    setTasks(prev => prev.map(t => t.id===id ? {...t,status:"Cancelado"} : t));
    setModal(null);
  }

  function resetFiltros() {
    setFilterCliente(""); setFilterResp(""); setFilterQ(""); setScope("all");
    if (searchRef.current) searchRef.current.value = "";
  }

  const inp = { padding:"7px 10px", border:"1px solid #e5ddd3", borderRadius:8, fontSize:13, background:"#fff" };
  const pill = (active) => ({
    padding:"5px 14px", borderRadius:999, border:`1.5px solid ${active?"#9a7d52":"#e5ddd3"}`,
    background: active?"#9a7d52":"#fff", color: active?"#fff":"#7a7570",
    cursor:"pointer", fontSize:13, fontWeight: active?600:400,
  });

  return (
    <div style={{ minHeight:"100vh", background:"#f9f7f4", fontFamily:"system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ background:"#1a1814", color:"#f5f0e8", padding:"13px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <a href="/menu.html" style={{ color:"#9a7d52", textDecoration:"none", fontSize:18, lineHeight:1 }}>←</a>
          <span style={{ fontSize:17, fontWeight:600 }}>✅ Tareas</span>
          <span style={{ fontSize:11, color:"#9a7d52", background:"rgba(154,125,82,.15)", padding:"2px 8px", borderRadius:10 }}>Two Lovers</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:"#9a7d52" }}>{currentUser?.name || currentUser?.email}</span>
          <button onClick={onLogout} style={{ background:"none", border:"1px solid #333", color:"#9a7d52", padding:"4px 10px", borderRadius:6, cursor:"pointer", fontSize:12 }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"20px 14px" }}>

        {/* Stats bar */}
        {!loading && (
          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            {[
              { label:"⚠️ Atrasadas", val:cats.overdue.length, bg:COLORS.overdue },
              { label:"🔥 Hoy",        val:cats.today.length,   bg:COLORS.today },
              { label:"📅 Próximas",   val:cats.upcoming.length,bg:COLORS.upcoming },
              { label:"✅ Terminadas", val:cats.done.length,    bg:COLORS.done },
            ].map(s => (
              <div key={s.label} style={{ background:s.bg, borderRadius:8, padding:"6px 14px", fontSize:13 }}>
                {s.label} <strong>{s.val}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Scope + acción */}
        <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
          <button style={pill(scope==="all")} onClick={()=>setScope("all")}>👥 Todas</button>
          <button style={pill(scope==="mine")} onClick={()=>setScope("mine")}>🙋‍♀️ Mías</button>
          <div style={{ flex:1 }} />
          <button onClick={() => setModal({})} style={{ padding:"7px 16px", background:"#9a7d52", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600, fontSize:13 }}>
            + Nueva tarea
          </button>
          <button onClick={load} style={{ ...inp, cursor:"pointer" }} title="Recargar">↻</button>
        </div>

        {/* Filtros */}
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          <select style={{...inp, flex:1, minWidth:130}} value={filterCliente} onChange={e=>setFilterCliente(e.target.value)}>
            <option value="">👰 Todos los clientes</option>
            {clientes.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select style={{...inp, flex:1, minWidth:120}} value={filterResp} onChange={e=>setFilterResp(e.target.value)}>
            <option value="">👤 Todos</option>
            {responsables.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display:"flex", gap:4, flex:2, minWidth:160 }}>
            <input ref={searchRef} style={{...inp, flex:1}} placeholder="🔍 Buscar..." onChange={e=>setFilterQ(e.target.value)} />
            {(filterCliente||filterResp||filterQ||scope!=="all") && (
              <button onClick={resetFiltros} style={{...inp, cursor:"pointer", padding:"7px 10px"}} title="Limpiar filtros">✕</button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:"#fff3cd", border:"1px solid #ffc107", borderRadius:8, padding:12, marginBottom:14, fontSize:13 }}>
            ⚠️ {error} <button onClick={load} style={{ marginLeft:8, cursor:"pointer" }}>Reintentar</button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center", color:"#9a7d52", padding:48 }}>Cargando tareas...</div>
        ) : (
          <>
            <Section title="⚠️ Atrasadas" color={COLORS.overdue} accent="#c0392b" tasks={cats.overdue} onStatusChange={handleStatusChange} onEdit={setModal} />
            <Section title="🔥 Para hoy"  color={COLORS.today}   accent="#e67e22" tasks={cats.today}   onStatusChange={handleStatusChange} onEdit={setModal} />
            <Section title="📅 Próximas"  color={COLORS.upcoming} accent="#2980b9" tasks={cats.upcoming} onStatusChange={handleStatusChange} onEdit={setModal} />

            {/* Toggle terminadas */}
            <button onClick={()=>setShowDone(s=>!s)} style={{
              background:"none", border:"1px solid #e5ddd3", borderRadius:8,
              padding:"6px 14px", cursor:"pointer", fontSize:12, color:"#7a7570", marginBottom:8,
            }}>
              {showDone ? "Ocultar terminadas" : `Ver terminadas (${tasks.filter(t=>["Terminado","Cancelado"].includes(t.status)).length})`}
            </button>
            {showDone && cats.done.length > 0 && (
              <Section title="✅ Terminadas" color={COLORS.done} accent="#34a853" tasks={cats.done} onStatusChange={handleStatusChange} onEdit={setModal} defaultOpen={true} />
            )}

            {allActive === 0 && !loading && (
              <div style={{ textAlign:"center", color:"#9a7d52", padding:40, background:"#fff", borderRadius:12, border:"1px solid #e5ddd3" }}>
                ✅ No hay tareas activas con estos filtros
                {(filterCliente||filterResp||filterQ||scope!=="all") && (
                  <div style={{ marginTop:10 }}>
                    <button onClick={resetFiltros} style={{ color:"#9a7d52", background:"none", border:"1px solid #9a7d52", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:13 }}>
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <TaskModal
          task={Object.keys(modal).length > 0 ? modal : null}
          clientes={clientes}
          responsables={responsables}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
