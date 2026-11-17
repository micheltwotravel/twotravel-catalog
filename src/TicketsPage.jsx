/*
  TicketsPage — Compass internal ticket board
  Route: /?mode=tickets

  SQL to add assigned_to column (run once if upgrading):
  ALTER TABLE compass_tickets ADD COLUMN IF NOT EXISTS assigned_to text default '';
*/

import React, { useState, useEffect } from "react";
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

const TEXTS = {
  en: {
    brand: "Two Travel", title: "Tickets · Compass",
    subtitle: "Report a bug, request a feature, or ask a question.",
    newTicket: "+ New Ticket", cancel: "Cancel", send: "Submit", sending: "Submitting…",
    type: "Type", page: "Page / Area", priority: "Priority",
    titleLbl: "Title *", titlePh: "What's broken or what do you need?",
    descLbl: "Description", descPh: "Steps to reproduce, screen, context…",
    assignedTo: "Assigned to",
    all: "All",
    statuses: { pendiente: "Pending", en_progreso: "In Progress", listo: "Done", cancelado: "Cancelled" },
    statusIcons: { pendiente: "⏳", en_progreso: "🔄", listo: "✅", cancelado: "❌" },
    types: { bug: "Bug", feature: "Feature", change: "Change", question: "Question" },
    typeIcons: { bug: "🐛", feature: "✨", change: "🔧", question: "❓" },
    priorities: { alta: "High", media: "Medium", baja: "Low" },
    pages: ["Compass","Pagos","Reservas","Bodas","HR","Accesos","Bot","Otro"],
    noTickets: "No tickets yet.", noMatch: "No tickets with this status.",
    submittedBy: "by", errorReq: "Title is required.", errorSend: "Error. Try again.",
    of: "of", seedBtn: "Seed initial tickets", seeding: "Seeding…", seedDone: "Done!",
  },
  es: {
    brand: "Two Travel", title: "Tickets · Compass",
    subtitle: "Reporta un bug, pide una mejora o haz una consulta.",
    newTicket: "+ Nuevo Ticket", cancel: "Cancelar", send: "Enviar", sending: "Enviando…",
    type: "Tipo", page: "Página / Área", priority: "Prioridad",
    titleLbl: "Título *", titlePh: "¿Qué falla o qué necesitas?",
    descLbl: "Descripción", descPh: "Pasos para reproducir, pantalla, contexto…",
    assignedTo: "Responsable",
    all: "Todos",
    statuses: { pendiente: "Pendiente", en_progreso: "En Progreso", listo: "Listo", cancelado: "Cancelado" },
    statusIcons: { pendiente: "⏳", en_progreso: "🔄", listo: "✅", cancelado: "❌" },
    types: { bug: "Bug", feature: "Mejora", change: "Cambio", question: "Pregunta" },
    typeIcons: { bug: "🐛", feature: "✨", change: "🔧", question: "❓" },
    priorities: { alta: "Alta", media: "Media", baja: "Baja" },
    pages: ["Compass","Pagos","Reservas","Bodas","HR","Accesos","Bot","Otro"],
    noTickets: "No hay tickets todavía.", noMatch: "No hay tickets con este estado.",
    submittedBy: "por", errorReq: "El título es obligatorio.", errorSend: "Error al enviar.",
    of: "de", seedBtn: "Cargar tickets iniciales", seeding: "Cargando…", seedDone: "¡Listo!",
  },
};

const PRIORITY_BORDER = { alta: "border-l-red-400", media: "border-l-amber-400", baja: "border-l-emerald-400" };
const PRIORITY_BG     = { alta: "bg-red-50 text-red-700", media: "bg-amber-50 text-amber-700", baja: "bg-emerald-50 text-emerald-700" };
const STATUS_BG       = { pendiente: "bg-stone-100 text-stone-500", en_progreso: "bg-blue-100 text-blue-700", listo: "bg-emerald-100 text-emerald-700", cancelado: "bg-stone-100 text-stone-400 line-through" };
const TYPE_BG         = { bug: "bg-red-50 text-red-600", feature: "bg-violet-50 text-violet-700", change: "bg-sky-50 text-sky-700", question: "bg-amber-50 text-amber-700" };

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

function Avatar({ name, size = "sm" }) {
  const member = TEAM_MAP[name] || TEAM_MAP[""];
  const initials = member.name === "Sin asignar" ? "—"
    : member.name.slice(0, 2).toUpperCase();
  const dim = size === "sm" ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs";
  if (member.name === "Sin asignar") return null;
  return (
    <span
      className={`${dim} rounded-full inline-flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ background: member.color }}
      title={member.name}
    >
      {initials}
    </span>
  );
}

export function TicketsPage({ currentUser }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem("tt_lang") || "es"; } catch { return "es"; } });
  const t = TEXTS[lang];
  const isAdmin = SUPER_ADMINS.includes((currentUser?.email || "").toLowerCase());

  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFilter] = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ type: "bug", page: "Compass", priority: "media", title: "", desc: "", assigned_to: "" });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [seedState, setSeedState] = useState("idle");

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
    await supabase.from("compass_tickets").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async function changeAssignee(id, val) {
    if (!isAdmin) return;
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
  const filtered = filterStatus === "all" ? tickets : tickets.filter(tk => tk.status === filterStatus);

  const counts = {};
  ["pendiente", "en_progreso", "listo"].forEach(s => { counts[s] = tickets.filter(tk => tk.status === s).length; });

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* Header */}
      <div className="bg-white border-b border-stone-100 px-4 py-3 sticky top-0 z-10 shadow-sm">
        <div className="mx-auto max-w-4xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-xl">🎫</span>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 leading-tight">{t.title}</h1>
              <p className="text-[10px] text-stone-400 uppercase tracking-widest">{t.brand}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full border border-stone-200 overflow-hidden text-xs bg-stone-50">
              <button onClick={() => setLangP("es")} className={`px-3 py-1.5 font-medium transition-colors ${lang === "es" ? "bg-stone-700 text-white" : "text-stone-400 hover:text-stone-600"}`}>ES</button>
              <button onClick={() => setLangP("en")} className={`px-3 py-1.5 font-medium transition-colors ${lang === "en" ? "bg-stone-700 text-white" : "text-stone-400 hover:text-stone-600"}`}>EN</button>
            </div>
            {currentUser?.name && (
              <span className="text-xs text-stone-400 bg-stone-50 border border-stone-100 rounded-full px-3 py-1 max-w-[130px] truncate">{currentUser.name}</span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        {/* Stats strip */}
        {tickets.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: "pendiente",   label: t.statuses.pendiente,   color: "border-t-amber-400",  num: counts.pendiente },
              { key: "en_progreso", label: t.statuses.en_progreso, color: "border-t-blue-400",   num: counts.en_progreso },
              { key: "listo",       label: t.statuses.listo,       color: "border-t-emerald-400", num: counts.listo },
            ].map(s => (
              <button key={s.key} onClick={() => setFilter(filterStatus === s.key ? "all" : s.key)}
                className={`bg-white rounded-xl border-t-2 ${s.color} border border-stone-100 px-4 py-3 text-left hover:shadow-sm transition-all ${filterStatus === s.key ? "shadow-sm ring-1 ring-stone-200" : ""}`}>
                <div className="text-2xl font-bold text-stone-800">{s.num}</div>
                <div className="text-[11px] text-stone-400 mt-0.5">{s.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* Submit bar */}
        {!showForm ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-stone-400">{t.subtitle}</p>
            <div className="flex gap-2">
              {isAdmin && tickets.length === 0 && (
                <button onClick={seedTickets} disabled={seedState !== "idle"}
                  className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded-full px-3 py-1.5 bg-white transition-colors disabled:opacity-50">
                  {seedState === "seeding" ? t.seeding : seedState === "done" ? t.seedDone : t.seedBtn}
                </button>
              )}
              <button onClick={() => setShowForm(true)}
                className="bg-stone-800 text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-stone-700 transition-colors shadow-sm">
                {t.newTicket}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-700">{t.newTicket.replace("+ ", "")}</h2>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-xs text-stone-400 hover:text-stone-600 bg-stone-50 rounded-full px-3 py-1">{t.cancel}</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { lbl: t.type, key: "type", opts: Object.entries(t.types).map(([v, l]) => ({ v, l: `${t.typeIcons[v]} ${l}` })) },
                { lbl: t.page, key: "page", opts: t.pages.map(p => ({ v: p, l: p })) },
                { lbl: t.priority, key: "priority", opts: Object.entries(t.priorities).map(([v, l]) => ({ v, l })) },
                { lbl: t.assignedTo, key: "assigned_to", opts: TEAM.map(m => ({ v: m.value, l: m.name })) },
              ].map(({ lbl, key, opts }) => (
                <div key={key}>
                  <label className="block text-xs text-stone-400 mb-1">{lbl}</label>
                  <select value={form[key]} onChange={e => setF(key, e.target.value)}
                    className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400">
                    {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">{t.titleLbl}</label>
              <input value={form.title} onChange={e => setF("title", e.target.value)} placeholder={t.titlePh}
                className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400" />
            </div>
            <div>
              <label className="block text-xs text-stone-400 mb-1">{t.descLbl}</label>
              <textarea value={form.desc} onChange={e => setF("desc", e.target.value)} placeholder={t.descPh} rows={3}
                className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400 resize-y" />
            </div>
            {formError && <p className="text-xs text-red-400">{formError}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={saving}
                className="bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-stone-700 transition-colors disabled:opacity-50 shadow-sm">
                {saving ? t.sending : t.send}
              </button>
            </div>
          </form>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {["all", "pendiente", "en_progreso", "listo", "cancelado"].map(s => {
              const label = s === "all" ? t.all : `${t.statusIcons[s]} ${t.statuses[s]}`;
              return (
                <button key={s} onClick={() => setFilter(s)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${filterStatus === s ? "bg-stone-800 text-white border-stone-800 shadow-sm" : "border-stone-200 text-stone-500 hover:border-stone-400 bg-white"}`}>
                  {label}
                </button>
              );
            })}
          </div>
          {tickets.length > 0 && (
            <span className="text-xs text-stone-300">{filtered.length} {t.of} {tickets.length}</span>
          )}
        </div>

        {/* Ticket list */}
        {loading ? (
          <div className="text-center py-16 text-sm text-stone-300">···</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <div className="text-4xl mb-3">🎫</div>
            <p className="text-sm">{t.noTickets}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-stone-400">{t.noMatch}</div>
        ) : (
          <div className="space-y-2">
            {filtered.map(tk => (
              <TicketCard key={tk.id} tk={tk} t={t} isAdmin={isAdmin}
                onStatusChange={changeStatus} onAssigneeChange={changeAssignee} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketCard({ tk, t, isAdmin, onStatusChange, onAssigneeChange }) {
  const [open, setOpen] = useState(false);
  const borderCls  = PRIORITY_BORDER[tk.priority] || "border-l-stone-200";
  const priorityCls = PRIORITY_BG[tk.priority] || "bg-stone-100 text-stone-500";
  const statusCls  = STATUS_BG[tk.status] || STATUS_BG.pendiente;
  const typeCls    = TYPE_BG[tk.type] || "bg-stone-50 text-stone-500";
  const statusLabel  = `${t.statusIcons[tk.status] || ""} ${t.statuses[tk.status] || tk.status}`;
  const typeLabel    = `${t.typeIcons[tk.type] || ""} ${t.types[tk.type] || tk.type}`;
  const priorityLabel = t.priorities[tk.priority] || tk.priority;
  const date = tk.created_at ? new Date(tk.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "";
  const assignee = TEAM_MAP[tk.assigned_to || ""] || TEAM_MAP[""];

  return (
    <div className={`bg-white rounded-xl border border-stone-100 border-l-4 ${borderCls} overflow-hidden hover:shadow-md hover:border-l-4 transition-all`}>
      <div className="px-4 py-3">
        {/* Top: title + priority */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <button onClick={() => setOpen(o => !o)} className="text-left flex-1 min-w-0 group">
            <span className="text-sm font-semibold text-stone-800 group-hover:text-stone-600 transition-colors leading-snug">
              {tk.title}
            </span>
          </button>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${priorityCls}`}>{priorityLabel}</span>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeCls}`}>{typeLabel}</span>
          {tk.page && <span className="text-[10px] text-stone-500 bg-stone-100 rounded-full px-2 py-0.5">{tk.page}</span>}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCls}`}>{statusLabel}</span>
        </div>

        {/* Footer: avatar + meta + admin controls */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Avatar name={tk.assigned_to} />
            {assignee.name !== "Sin asignar" && (
              <span className="text-xs font-medium text-stone-600">{assignee.name}</span>
            )}
            <span className="text-[11px] text-stone-300">· {t.submittedBy} {tk.submitted_by_name || "—"} · {date}</span>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <select value={tk.assigned_to || ""} onChange={e => onAssigneeChange(tk.id, e.target.value)}
                onClick={e => e.stopPropagation()}
                className="text-[11px] border border-stone-100 rounded-full px-2 py-0.5 bg-stone-50 text-stone-500 cursor-pointer focus:outline-none max-w-[110px]">
                {TEAM.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
              </select>
              <select value={tk.status} onChange={e => onStatusChange(tk.id, e.target.value)}
                onClick={e => e.stopPropagation()}
                className="text-[11px] border border-stone-100 rounded-full px-2 py-0.5 bg-stone-50 text-stone-500 cursor-pointer focus:outline-none">
                {Object.entries(t.statuses).map(([v, l]) => <option key={v} value={v}>{t.statusIcons[v]} {l}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Expandable description */}
      {open && tk.description && (
        <div className="border-t border-stone-50 px-4 py-3 bg-stone-50/60">
          <p className="text-sm text-stone-500 leading-relaxed whitespace-pre-wrap">{tk.description}</p>
        </div>
      )}
    </div>
  );
}

export default TicketsPage;
