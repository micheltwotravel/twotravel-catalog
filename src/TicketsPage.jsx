/*
  TicketsPage — Compass internal Kanban board
  Route: /?mode=tickets

  SQL to add assigned_to column (run once if upgrading):
  ALTER TABLE compass_tickets ADD COLUMN IF NOT EXISTS assigned_to text default '';
*/

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient.js";

const SUPER_ADMINS = ["michel@two.travel","caro@two.travel","ray@two.travel","giulia@two.travel"];

const TEAM = [
  { name: "Sin asignar", value: "", color: "#b8a898" },
  { name: "Michel",    value: "michel",    color: "#9b6a37" },
  { name: "Caro",      value: "caro",      color: "#7c3d8c" },
  { name: "Ray",       value: "ray",       color: "#1d6fa0" },
  { name: "Giulia",    value: "giulia",    color: "#c0455c" },
  { name: "Sebastian", value: "sebastian", color: "#2a7a4a" },
  { name: "Armando",   value: "armando",   color: "#a05c20" },
  { name: "Patricia",  value: "patricia",  color: "#6b4fa0" },
  { name: "Lyna",      value: "lyna",      color: "#c47a40" },
  { name: "Julith",    value: "julith",    color: "#3a7a9a" },
  { name: "Laura",     value: "laura",     color: "#7a9a3a" },
];

const TEAM_MAP = Object.fromEntries(TEAM.map(m => [m.value, m]));

// Status order for move buttons (cancelado is a side-step)
const STATUS_FLOW = ["pendiente", "en_progreso", "listo"];

const PRIORITY_ORDER = { alta: 0, media: 1, baja: 2 };

// Derive team value from email (michel@two.travel → "michel")
function emailToTeamValue(email) {
  return (email || "").split("@")[0].toLowerCase();
}

const TEXTS = {
  en: {
    brand: "Two Travel", title: "Tickets",
    subtitle: "Report a bug, request a feature, or ask a question.",
    newTicket: "+ New Ticket", cancel: "Cancel", send: "Submit", sending: "Submitting…",
    type: "Type", page: "Page / Area", priority: "Priority",
    titleLbl: "Title *", titlePh: "What's broken or what do you need?",
    descLbl: "Description", descPh: "Steps to reproduce, screen, context…",
    assignedTo: "Assigned to",
    statuses: { pendiente: "Pending", en_progreso: "In Progress", listo: "Done", cancelado: "Cancelled" },
    statusColors: { pendiente: "#f59e0b", en_progreso: "#3b82f6", listo: "#10b981", cancelado: "#9ca3af" },
    types: { bug: "Bug", feature: "Feature", change: "Change", question: "Question" },
    typeIcons: { bug: "🐛", feature: "✨", change: "🔧", question: "❓" },
    priorities: { alta: "High", media: "Medium", baja: "Low" },
    priorityColors: { alta: "#ef4444", media: "#f59e0b", baja: "#10b981" },
    pages: ["Compass","Pagos","Reservas","Bodas","HR","Accesos","Bot","Otro"],
    noTickets: "No tickets yet.", noMatch: "No tickets.",
    submittedBy: "by", errorReq: "Title is required.", errorSend: "Error. Try again.",
    of: "of", seedBtn: "Load seed tickets", seeding: "Loading…", seedDone: "Done!",
    moveNext: "Move →", movePrev: "← Back", cancel2: "Cancel ticket", restore: "Restore",
    addPerson: "+ Person",
  },
  es: {
    brand: "Two Travel", title: "Tickets",
    subtitle: "Reporta un bug, pide una mejora o haz una consulta.",
    newTicket: "+ Nuevo Ticket", cancel: "Cancelar", send: "Enviar", sending: "Enviando…",
    type: "Tipo", page: "Página / Área", priority: "Prioridad",
    titleLbl: "Título *", titlePh: "¿Qué falla o qué necesitas?",
    descLbl: "Descripción", descPh: "Pasos para reproducir, pantalla, contexto…",
    assignedTo: "Responsable",
    statuses: { pendiente: "Pendiente", en_progreso: "En Progreso", listo: "Listo", cancelado: "Cancelado" },
    statusColors: { pendiente: "#f59e0b", en_progreso: "#3b82f6", listo: "#10b981", cancelado: "#9ca3af" },
    types: { bug: "Bug", feature: "Mejora", change: "Cambio", question: "Pregunta" },
    typeIcons: { bug: "🐛", feature: "✨", change: "🔧", question: "❓" },
    priorities: { alta: "Alta", media: "Media", baja: "Baja" },
    priorityColors: { alta: "#ef4444", media: "#f59e0b", baja: "#10b981" },
    pages: ["Compass","Pagos","Reservas","Bodas","HR","Accesos","Bot","Otro"],
    noTickets: "No hay tickets todavía.", noMatch: "Sin tickets.",
    submittedBy: "por", errorReq: "El título es obligatorio.", errorSend: "Error al enviar.",
    of: "de", seedBtn: "Cargar tickets iniciales", seeding: "Cargando…", seedDone: "¡Listo!",
    moveNext: "Avanzar →", movePrev: "← Regresar", cancel2: "Cancelar ticket", restore: "Restaurar",
    addPerson: "+ Persona",
  },
};

const SEED_TICKETS = [
  { type:"bug",     page:"Compass",  priority:"alta",  title:"Tier 2 pricing — itinerary shows wrong prices",           description:"Clients with Tier 2 see Tier 1 prices in the itinerary canvas." },
  { type:"feature", page:"Reservas", priority:"alta",  title:"Reservations module — Xile & Genesis workflow",           description:"Full booking workflow. Meeting with Xile and Genesis pending." },
  { type:"feature", page:"Pagos",    priority:"alta",  title:"Finance dashboard — TRM, cash flow, bank reconciliation", description:"10-feature finance spec: TRM widget, COP/USD cash flow, bank reconciliation." },
  { type:"feature", page:"Compass",  priority:"media", title:"Unified client dashboard — replace Monday/HubSpot sheet", description:"Single panel per client replacing the Monday board, HubSpot sidebar, and Concierge Sheet." },
  { type:"feature", page:"Compass",  priority:"media", title:"Listas fijas — curated itinerary recommendation lists",   description:"Curated lists of activities/restaurants per city." },
  { type:"feature", page:"Compass",  priority:"media", title:"Pre-check-in form — improvements & template",             description:"Standardize the client message template sent with the Hotspot form link." },
  { type:"feature", page:"Compass",  priority:"media", title:"Marketing board — content & filmación notes",             description:"Nueva sección Marketing: notas de filmación, consumer behavior, calendario de contenido." },
  { type:"feature", page:"Compass",  priority:"media", title:"QuickBooks follow-up — Concierge Sheet for Lyni",         description:"Verify Concierge Sheet is updated so Lyni can enter billing info." },
  { type:"change",  page:"HR",       priority:"baja",  title:"Onboarding process — review Caro's doc",                  description:"Caro will send a doc to review before moving forward." },
  { type:"change",  page:"Compass",  priority:"baja",  title:"Fotos menú CTG — blurry images need replacement",         description:"CTG menu photo is blurry, breakfast photo looks bad." },
  { type:"feature", page:"Compass",  priority:"baja",  title:"Language toggle — full platform i18n",                    description:"Full React i18n for the platform (EN/ES). Very complex." },
];

// Parse comma-separated assignees
function parseAssignees(val) {
  return (val || "").split(",").map(s => s.trim()).filter(Boolean);
}

function AvatarRow({ assignees, max = 4 }) {
  const shown = assignees.slice(0, max);
  const extra = assignees.length - max;
  return (
    <div className="flex items-center" style={{ gap: "-4px" }}>
      {shown.map((val, i) => {
        const m = TEAM_MAP[val];
        if (!m || !m.name || m.name === "Sin asignar") return null;
        const initials = m.name.slice(0, 2).toUpperCase();
        return (
          <span key={val}
            className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold text-white border-2 border-white"
            style={{ background: m.color, marginLeft: i > 0 ? "-6px" : "0", zIndex: shown.length - i }}
            title={m.name}>
            {initials}
          </span>
        );
      })}
      {extra > 0 && (
        <span className="w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold bg-gray-200 text-gray-500 border-2 border-white"
          style={{ marginLeft: "-6px" }}>
          +{extra}
        </span>
      )}
    </div>
  );
}

function AssigneePicker({ assignees, onChange, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(val) {
    const next = assignees.includes(val)
      ? assignees.filter(a => a !== val)
      : [...assignees, val];
    onChange(next.join(","));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full px-2 py-0.5 transition-colors border border-gray-200">
        {t.addPerson}
      </button>
      {open && (
        <div className="absolute bottom-7 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-44"
          onClick={e => e.stopPropagation()}>
          {TEAM.filter(m => m.value !== "").map(m => (
            <label key={m.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="checkbox"
                checked={assignees.includes(m.value)}
                onChange={() => toggle(m.value)}
                className="w-3 h-3 accent-gray-700" />
              <span className="w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                style={{ background: m.color }}>
                {m.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="text-xs text-gray-700">{m.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function TicketsPage({ currentUser }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("tt_lang") || "es"; } catch { return "es"; } });
  const t = TEXTS[lang];
  const isAdmin = SUPER_ADMINS.includes((currentUser?.email || "").toLowerCase());

  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ type: "bug", page: "Compass", priority: "media", title: "", desc: "", assigned_to: "" });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [seedState, setSeedState] = useState("idle");
  const [myTickets, setMyTickets] = useState(false);
  const [filterPriority, setFilterPriority] = useState("all");
  const myValue = emailToTeamValue(currentUser?.email);

  const setLangP = (l) => { setLang(l); try { localStorage.setItem("tt_lang", l); } catch {} };

  useEffect(() => {
    loadTickets();
    const ch = supabase.channel("compass_tickets_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "compass_tickets" }, loadTickets)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function loadTickets() {
    const { data } = await supabase.from("compass_tickets").select("*").order("created_at", { ascending: false });
    if (data) setTickets(data);
    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError(t.errorReq); return; }
    setFormError(""); setSaving(true);
    const { error } = await supabase.from("compass_tickets").insert({
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: form.title.trim(),
      description: form.desc.trim(),
      type: form.type, page: form.page, priority: form.priority,
      assigned_to: form.assigned_to,
      status: "pendiente",
      submitted_by: currentUser?.email || "",
      submitted_by_name: currentUser?.name || "Anónimo",
      created_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setFormError(t.errorSend); return; }
    setForm({ type: "bug", page: "Compass", priority: "media", title: "", desc: "", assigned_to: "" });
    setShowForm(false);
  }

  async function changeStatus(id, newStatus) {
    if (!isAdmin) return;
    const ticket = tickets.find(tk => tk.id === id);
    // Optimistic update
    setTickets(prev => prev.map(tk => tk.id === id ? { ...tk, status: newStatus } : tk));
    await supabase.from("compass_tickets").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    // Email notification (fire and forget)
    if (ticket) {
      fetch("/api/ticket-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: { ...ticket, assigned_to: ticket.assigned_to }, newStatus, movedBy: currentUser?.name || currentUser?.email || "Admin" }),
      }).catch(() => {});
    }
  }

  async function changeAssignees(id, val) {
    if (!isAdmin) return;
    setTickets(prev => prev.map(tk => tk.id === id ? { ...tk, assigned_to: val } : tk));
    await supabase.from("compass_tickets").update({ assigned_to: val, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function seedTickets() {
    setSeedState("seeding");
    const rows = SEED_TICKETS.map((tk, i) => ({
      id: `seed_${Date.now()}_${i}`, ...tk, assigned_to: "",
      status: "pendiente",
      submitted_by: currentUser?.email || "michel@two.travel",
      submitted_by_name: currentUser?.name || "Michel",
      created_at: new Date(Date.now() - i * 60000).toISOString(),
    }));
    await supabase.from("compass_tickets").insert(rows);
    setSeedState("done");
    setTimeout(() => setSeedState("idle"), 3000);
  }

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const COLUMNS = [
    { key: "pendiente",   color: "#f59e0b", bg: "#fffbeb", border: "#fde68a" },
    { key: "en_progreso", color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe" },
    { key: "listo",       color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0" },
    { key: "cancelado",   color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-5 py-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center text-white text-xs font-bold">TT</div>
            <div>
              <span className="text-sm font-semibold text-gray-900">Compass</span>
              <span className="mx-2 text-gray-300">·</span>
              <span className="text-sm font-semibold text-gray-900">{t.title}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              <button onClick={() => setLangP("es")} className={`px-3 py-1.5 font-medium transition-colors ${lang === "es" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600 bg-white"}`}>ES</button>
              <button onClick={() => setLangP("en")} className={`px-3 py-1.5 font-medium transition-colors ${lang === "en" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-600 bg-white"}`}>EN</button>
            </div>
            {currentUser?.name && (
              <span className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5 font-medium">{currentUser.name}</span>
            )}
            <button onClick={() => setShowForm(v => !v)}
              className="bg-gray-900 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors shadow-sm">
              {showForm ? t.cancel : t.newTicket}
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-5">
        {/* New ticket form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5 max-w-3xl">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">{t.newTicket.replace(/^\+ /, "")}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              {[
                { lbl: t.type, key: "type", opts: Object.entries(t.types).map(([v, l]) => ({ v, l: `${t.typeIcons[v]} ${l}` })) },
                { lbl: t.page, key: "page", opts: t.pages.map(p => ({ v: p, l: p })) },
                { lbl: t.priority, key: "priority", opts: Object.entries(t.priorities).map(([v, l]) => ({ v, l })) },
              ].map(({ lbl, key, opts }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-400 mb-1 font-medium">{lbl}</label>
                  <select value={form[key]} onChange={e => setF(key, e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-gray-400">
                    {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-medium">{t.assignedTo}</label>
                <div className="border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 flex flex-wrap gap-1 min-h-[38px]">
                  {parseAssignees(form.assigned_to).map(val => {
                    const m = TEAM_MAP[val];
                    return m ? (
                      <span key={val}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-white rounded-full px-2 py-0.5"
                        style={{ background: m.color }}>
                        {m.name}
                        <button type="button" onClick={() => setF("assigned_to", parseAssignees(form.assigned_to).filter(a => a !== val).join(","))}
                          className="opacity-70 hover:opacity-100">×</button>
                      </span>
                    ) : null;
                  })}
                  <select value="" onChange={e => { if (e.target.value) setF("assigned_to", [...new Set([...parseAssignees(form.assigned_to), e.target.value])].join(",")); }}
                    className="text-xs text-gray-400 bg-transparent focus:outline-none cursor-pointer">
                    <option value="">+ añadir</option>
                    {TEAM.filter(m => m.value && !parseAssignees(form.assigned_to).includes(m.value)).map(m => (
                      <option key={m.value} value={m.value}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1 font-medium">{t.titleLbl}</label>
              <input value={form.title} onChange={e => setF("title", e.target.value)} placeholder={t.titlePh}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-gray-400" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1 font-medium">{t.descLbl}</label>
              <textarea value={form.desc} onChange={e => setF("desc", e.target.value)} placeholder={t.descPh} rows={3}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 focus:outline-none focus:border-gray-400 resize-y" />
            </div>
            {formError && <p className="text-xs text-red-500 mb-3">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="text-xs text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">{t.cancel}</button>
              <button type="submit" disabled={saving}
                className="bg-gray-900 text-white text-xs font-semibold px-5 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50">
                {saving ? t.sending : t.send}
              </button>
            </div>
          </form>
        )}

        {/* Filter bar */}
        {tickets.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button onClick={() => setMyTickets(v => !v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${myTickets ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
              {lang === "es" ? "Mis Tickets" : "My Tickets"}
            </button>
            {["all","alta","media","baja"].map(p => (
              <button key={p} onClick={() => setFilterPriority(p)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${filterPriority === p ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"}`}>
                {p === "all" ? (lang === "es" ? "Todas" : "All") : (t.priorities[p])}
              </button>
            ))}
            <span className="text-xs text-gray-300 ml-auto">{tickets.length} tickets</span>
          </div>
        )}

        {/* Seed button */}
        {isAdmin && tickets.length === 0 && !loading && (
          <div className="mb-5">
            <button onClick={seedTickets} disabled={seedState !== "idle"}
              className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 bg-white transition-colors disabled:opacity-50">
              {seedState === "seeding" ? t.seeding : seedState === "done" ? t.seedDone : t.seedBtn}
            </button>
          </div>
        )}

        {/* Kanban board */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-300 text-sm">···</div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
            {COLUMNS.map(col => {
              let colTickets = tickets.filter(tk => tk.status === col.key);
              if (myTickets && myValue) colTickets = colTickets.filter(tk => parseAssignees(tk.assigned_to).includes(myValue));
              if (filterPriority !== "all") colTickets = colTickets.filter(tk => tk.priority === filterPriority);
              colTickets = [...colTickets].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));
              return (
                <div key={col.key} className="flex-shrink-0 w-72 flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: col.color }} />
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        {t.statuses[col.key]}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full"
                      style={{ background: col.color }}>
                      {colTickets.length}
                    </span>
                  </div>

                  <div className="flex-1 rounded-xl p-2 flex flex-col gap-2"
                    style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                    {colTickets.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-8">
                        <span className="text-xs text-gray-300">{t.noMatch}</span>
                      </div>
                    ) : (
                      colTickets.map(tk => (
                        <KanbanCard key={tk.id} tk={tk} t={t} isAdmin={isAdmin}
                          onStatusChange={changeStatus}
                          onAssigneesChange={changeAssignees} />
                      ))
                    )}
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

function KanbanCard({ tk, t, isAdmin, onStatusChange, onAssigneesChange }) {
  const [open, setOpen] = useState(false);
  const priorityColor = t.priorityColors[tk.priority] || "#9ca3af";
  const priorityLabel = t.priorities[tk.priority] || tk.priority;
  const typeLabel = `${t.typeIcons[tk.type] || ""} ${t.types[tk.type] || tk.type}`;
  const date = tk.created_at ? new Date(tk.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "";
  const shortId = tk.id ? "#" + tk.id.slice(-4) : "";
  const assignees = parseAssignees(tk.assigned_to);

  const typeBg    = { bug: "#fef2f2", feature: "#f5f3ff", change: "#eff6ff", question: "#fffbeb" };
  const typeColor = { bug: "#dc2626", feature: "#7c3aed", change: "#2563eb", question: "#d97706" };

  const flowIdx = STATUS_FLOW.indexOf(tk.status);
  const nextStatus = flowIdx >= 0 && flowIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[flowIdx + 1] : null;
  const prevStatus = flowIdx > 0 ? STATUS_FLOW[flowIdx - 1] : null;
  const isCancelled = tk.status === "cancelado";

  function move(status) {
    onStatusChange(tk.id, status);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all"
      onClick={() => setOpen(o => !o)} style={{ cursor: "pointer" }}>
      {/* Priority stripe */}
      <div className="h-1" style={{ background: priorityColor }} />

      <div className="p-3">
        {/* Top: type badge + priority badge */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
            style={{ background: typeBg[tk.type] || "#f9fafb", color: typeColor[tk.type] || "#6b7280" }}>
            {typeLabel}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
            style={{ background: priorityColor }}>
            {priorityLabel}
          </span>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-gray-800 leading-snug mb-2 line-clamp-2">{tk.title}</p>

        {/* Page */}
        {tk.page && (
          <div className="mb-2">
            <span className="text-[10px] text-gray-400 bg-gray-100 rounded-md px-2 py-0.5 font-medium">{tk.page}</span>
          </div>
        )}

        {/* Assignees row */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
          {assignees.length > 0
            ? <AvatarRow assignees={assignees} />
            : <span className="text-[11px] text-gray-300">{t.submittedBy} {tk.submitted_by_name || "—"}</span>
          }
          {isAdmin && (
            <AssigneePicker
              assignees={assignees}
              onChange={val => onAssigneesChange(tk.id, val)}
              t={t} />
          )}
          <span className="text-[10px] text-gray-300 font-mono ml-auto">{shortId} · {date}</span>
        </div>

        {/* Expanded */}
        {open && (
          <>
            {tk.description && (
              <div className="mt-2 pt-2 border-t border-gray-50">
                <p className="text-xs text-gray-500 leading-relaxed">{tk.description}</p>
              </div>
            )}

            {/* Move buttons (admin) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-50 flex-wrap"
                onClick={e => e.stopPropagation()}>
                {prevStatus && (
                  <button onClick={() => move(prevStatus)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                    {t.movePrev}
                  </button>
                )}
                {nextStatus && (
                  <button onClick={() => move(nextStatus)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white transition-colors"
                    style={{ background: t.statusColors[nextStatus] }}>
                    {t.statuses[nextStatus]} →
                  </button>
                )}
                {!isCancelled && (
                  <button onClick={() => move("cancelado")}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors ml-auto">
                    {t.cancel2}
                  </button>
                )}
                {isCancelled && (
                  <button onClick={() => move("pendiente")}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition-colors">
                    {t.restore}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default TicketsPage;
