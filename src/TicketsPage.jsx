/*
  TicketsPage — Compass internal ticket board
  Route: /?mode=tickets

  Supabase table required (run once in Supabase SQL editor):
  ─────────────────────────────────────────────────────────
  create table if not exists compass_tickets (
    id text primary key,
    title text not null,
    description text default '',
    type text check (type in ('bug','feature','change','question')) default 'bug',
    page text default 'Compass',
    priority text check (priority in ('alta','media','baja')) default 'media',
    status text check (status in ('pendiente','en_progreso','listo','cancelado')) default 'pendiente',
    submitted_by text default '',
    submitted_by_name text default '',
    created_at timestamptz default now(),
    updated_at timestamptz
  );
  alter table compass_tickets enable row level security;
  create policy "all_read"   on compass_tickets for select using (true);
  create policy "all_insert" on compass_tickets for insert with check (true);
  create policy "all_update" on compass_tickets for update using (true);
  ─────────────────────────────────────────────────────────
*/

import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

const SUPER_ADMINS = ["michel@two.travel","caro@two.travel","ray@two.travel","giulia@two.travel"];

const TEXTS = {
  en: {
    brand: "Two Travel",
    title: "Compass · Tickets",
    subtitle: "Report a bug, request a feature, or ask a question.",
    newTicket: "+ New Ticket",
    cancel: "Cancel",
    send: "Submit",
    sending: "Submitting…",
    type: "Type",
    page: "Page / Area",
    priority: "Priority",
    titleLbl: "Title *",
    titlePh: "What's broken or what do you need?",
    descLbl: "Description",
    descPh: "Steps to reproduce, screen, context…",
    filterLabel: "Filter:",
    all: "All",
    statuses: { pendiente: "⏳ Pending", en_progreso: "🔄 In Progress", listo: "✅ Done", cancelado: "❌ Cancelled" },
    types: { bug: "🐛 Bug", feature: "✨ Feature", change: "🔧 Change", question: "❓ Question" },
    priorities: { alta: "🔴 High", media: "🟡 Medium", baja: "🟢 Low" },
    pages: ["Compass","Pagos","Reservas","Bodas","HR","Accesos","Bot","Otro"],
    noTickets: "No tickets yet.",
    noMatch: "No tickets with this status.",
    submittedBy: "by",
    errorReq: "Title is required.",
    errorSend: "Error submitting. Try again.",
    of: "of",
    changeStatus: "Change status",
    seedBtn: "Seed initial tickets",
    seeding: "Seeding…",
    seedDone: "Seeded!",
  },
  es: {
    brand: "Two Travel",
    title: "Tickets · Compass",
    subtitle: "Reporta un bug, pide una mejora o haz una consulta.",
    newTicket: "+ Nuevo Ticket",
    cancel: "Cancelar",
    send: "Enviar",
    sending: "Enviando…",
    type: "Tipo",
    page: "Página / Área",
    priority: "Prioridad",
    titleLbl: "Título *",
    titlePh: "¿Qué falla o qué necesitas?",
    descLbl: "Descripción",
    descPh: "Pasos para reproducir, pantalla, contexto…",
    filterLabel: "Filtrar:",
    all: "Todos",
    statuses: { pendiente: "⏳ Pendiente", en_progreso: "🔄 En Progreso", listo: "✅ Listo", cancelado: "❌ Cancelado" },
    types: { bug: "🐛 Bug", feature: "✨ Mejora", change: "🔧 Cambio", question: "❓ Pregunta" },
    priorities: { alta: "🔴 Alta", media: "🟡 Media", baja: "🟢 Baja" },
    pages: ["Compass","Pagos","Reservas","Bodas","HR","Accesos","Bot","Otro"],
    noTickets: "No hay tickets todavía.",
    noMatch: "No hay tickets con este estado.",
    submittedBy: "por",
    errorReq: "El título es obligatorio.",
    errorSend: "Error al enviar. Intenta de nuevo.",
    of: "de",
    changeStatus: "Cambiar estado",
    seedBtn: "Cargar tickets iniciales",
    seeding: "Cargando…",
    seedDone: "¡Listo!",
  },
};

const STATUS_BADGE = {
  pendiente:   "bg-amber-100 text-amber-800",
  en_progreso: "bg-blue-100 text-blue-800",
  listo:       "bg-emerald-100 text-emerald-800",
  cancelado:   "bg-stone-100 text-stone-500",
};

const PRIORITY_DOT = { alta: "text-red-500", media: "text-amber-500", baja: "text-emerald-600" };

const SEED_TICKETS = [
  { type:"bug",     page:"Compass",  priority:"alta",  title:"Tier 2 pricing — itinerary shows wrong prices",           description:"Clients with Tier 2 see Tier 1 prices in the itinerary canvas. price_tier_1 / price_tier_2 exist in the catalog but the canvas always uses Tier 1. Need dynamic pricing based on kickoff.clientType." },
  { type:"feature", page:"Reservas", priority:"alta",  title:"Reservations module — Xile & Genesis workflow",           description:"Full booking workflow. Meeting with Xile and Genesis pending. Ray flagged this as the next big phase." },
  { type:"feature", page:"Pagos",    priority:"alta",  title:"Finance dashboard — TRM, cash flow, bank reconciliation", description:"10-feature finance spec: TRM widget, COP/USD cash flow, bank reconciliation, Payana/QB templates, payment requests CO+MX." },
  { type:"feature", page:"Compass",  priority:"media", title:"Unified client dashboard — replace Monday/HubSpot sheet", description:"Single panel per client replacing the Monday board, HubSpot sidebar, and Concierge Sheet. See spec doc." },
  { type:"feature", page:"Compass",  priority:"media", title:"Listas fijas — curated itinerary recommendation lists",   description:"Curated lists of activities/restaurants per city to suggest when building an itinerary. Architecture TBD (Concierge Sheet vs Supabase)." },
  { type:"feature", page:"Compass",  priority:"media", title:"Pre-check-in form — improvements & template",             description:"Standardize the client message template sent with the Hotspot form link. Add per-kickoff checkInFormUrl field." },
  { type:"feature", page:"Compass",  priority:"media", title:"Marketing board — content & filmación notes",             description:"Nueva sección Marketing: notas de filmación, consumer behavior, calendario de contenido, métricas de redes." },
  { type:"feature", page:"Compass",  priority:"media", title:"QuickBooks follow-up — Concierge Sheet for Lyni",         description:"Verify Concierge Sheet is updated so Lyni can enter billing info. Follow up on QB integration status." },
  { type:"change",  page:"HR",       priority:"baja",  title:"Onboarding process — review Caro's doc",                  description:"Caro will send a doc to review before moving forward. Implement onboarding workflow in HR panel." },
  { type:"change",  page:"Compass",  priority:"baja",  title:"Fotos menú CTG — blurry images need replacement",         description:"CTG menu photo is blurry, breakfast photo looks bad. Marketing must provide new photos. Item 21/66 from Phase II." },
  { type:"feature", page:"Compass",  priority:"baja",  title:"Language toggle — full platform i18n",                    description:"Full React i18n for the platform (EN/ES). Very complex — requires extracting all strings. Item 28/45 from Phase II." },
];

export function TicketsPage({ currentUser }) {
  const [lang, setLang]           = useState(() => { try { return localStorage.getItem("tt_lang") || "es"; } catch { return "es"; } });
  const t = TEXTS[lang];

  const isAdmin = SUPER_ADMINS.includes((currentUser?.email||"").toLowerCase());

  const [tickets, setTickets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterStatus, setFilter] = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ type:"bug", page:"Compass", priority:"media", title:"", desc:"" });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");
  const [seedState, setSeedState] = useState("idle");

  const setLangPersist = (l) => { setLang(l); try { localStorage.setItem("tt_lang", l); } catch {} };

  useEffect(() => {
    loadTickets();
    const channel = supabase
      .channel("compass_tickets_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "compass_tickets" }, loadTickets)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      id: `t_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      title: form.title.trim(),
      description: form.desc.trim(),
      type: form.type,
      page: form.page,
      priority: form.priority,
      status: "pendiente",
      submitted_by: currentUser?.email || "",
      submitted_by_name: currentUser?.name || "Anónimo",
      created_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { setFormError(t.errorSend); return; }
    setForm({ type:"bug", page:"Compass", priority:"media", title:"", desc:"" });
    setShowForm(false);
  }

  async function changeStatus(id, newStatus) {
    if (!isAdmin) return;
    await supabase.from("compass_tickets")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function seedTickets() {
    setSeedState("seeding");
    const rows = SEED_TICKETS.map((tk, i) => ({
      id: `seed_${Date.now()}_${i}`,
      ...tk,
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

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* ── Header ── */}
      <div className="bg-white border-b border-stone-200 px-4 py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-stone-400">{t.brand}</p>
            <h1 className="text-xl font-semibold tracking-tight text-stone-800">{t.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex items-center rounded-lg border border-stone-200 overflow-hidden text-xs">
              <button onClick={() => setLangPersist("es")}
                className={`px-3 py-1.5 font-medium transition-colors ${lang==="es" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-50"}`}>
                ES
              </button>
              <button onClick={() => setLangPersist("en")}
                className={`px-3 py-1.5 font-medium transition-colors ${lang==="en" ? "bg-stone-800 text-white" : "text-stone-500 hover:bg-stone-50"}`}>
                EN
              </button>
            </div>
            {currentUser?.name && (
              <span className="text-xs text-stone-400 bg-stone-50 border border-stone-200 rounded-full px-3 py-1 max-w-[140px] truncate">
                {currentUser.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* ── Submit form ── */}
        {!showForm ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm text-stone-500">{t.subtitle}</p>
            <div className="flex gap-2">
              {isAdmin && tickets.length === 0 && (
                <button onClick={seedTickets} disabled={seedState !== "idle"}
                  className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
                  {seedState === "seeding" ? t.seeding : seedState === "done" ? t.seedDone : t.seedBtn}
                </button>
              )}
              <button onClick={() => setShowForm(true)}
                className="bg-stone-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-stone-700 transition-colors">
                {t.newTicket}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}
            className="bg-white rounded-[20px] border border-stone-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-stone-700">{t.newTicket.replace("+ ","")}</h2>
              <button type="button" onClick={() => setShowForm(false)}
                className="text-xs text-stone-400 hover:text-stone-600">{t.cancel}</button>
            </div>
            {/* Row 1 */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">{t.type}</label>
                <select value={form.type} onChange={e => setF("type", e.target.value)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400">
                  {Object.entries(t.types).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">{t.page}</label>
                <select value={form.page} onChange={e => setF("page", e.target.value)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400">
                  {t.pages.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">{t.priority}</label>
                <select value={form.priority} onChange={e => setF("priority", e.target.value)}
                  className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400">
                  {Object.entries(t.priorities).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            {/* Title */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">{t.titleLbl}</label>
              <input value={form.title} onChange={e => setF("title", e.target.value)}
                placeholder={t.titlePh}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400" />
            </div>
            {/* Description */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1">{t.descLbl}</label>
              <textarea value={form.desc} onChange={e => setF("desc", e.target.value)}
                placeholder={t.descPh} rows={3}
                className="w-full text-sm border border-stone-200 rounded-lg px-3 py-2 bg-stone-50 focus:outline-none focus:border-stone-400 resize-y" />
            </div>
            {formError && <p className="text-xs text-red-500">{formError}</p>}
            <div className="flex justify-end">
              <button type="submit" disabled={saving}
                className="bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50">
                {saving ? t.sending : t.send}
              </button>
            </div>
          </form>
        )}

        {/* ── Filters ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-stone-400">{t.filterLabel}</span>
            {["all", "pendiente", "en_progreso", "listo"].map(s => {
              const label = s === "all" ? t.all : t.statuses[s];
              return (
                <button key={s} onClick={() => setFilter(s)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    filterStatus === s
                      ? "bg-stone-800 text-white border-stone-800"
                      : "border-stone-200 text-stone-500 hover:border-stone-400 bg-white"
                  }`}>
                  {label}
                </button>
              );
            })}
          </div>
          {tickets.length > 0 && (
            <span className="text-xs text-stone-400">
              {filtered.length} {t.of} {tickets.length} tickets
            </span>
          )}
        </div>

        {/* ── Ticket list ── */}
        {loading ? (
          <div className="text-center py-16 text-sm text-stone-400">···</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-16 text-sm text-stone-400">
            <div className="text-3xl mb-3">🎫</div>
            {t.noTickets}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-stone-400">{t.noMatch}</div>
        ) : (
          <div className="space-y-3">
            {filtered.map(tk => (
              <TicketCard key={tk.id} tk={tk} t={t} isAdmin={isAdmin} onStatusChange={changeStatus} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TicketCard({ tk, t, isAdmin, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const badgeCls = STATUS_BADGE[tk.status] || STATUS_BADGE.pendiente;
  const statusLabel = t.statuses[tk.status] || tk.status;
  const typeLabel = t.types[tk.type] || tk.type;
  const priorityLabel = t.priorities[tk.priority] || tk.priority;
  const priorityCls = PRIORITY_DOT[tk.priority] || "";
  const date = tk.created_at ? new Date(tk.created_at).toLocaleDateString("en-US", { day:"numeric", month:"short" }) : "";

  return (
    <div className="bg-white rounded-[16px] border border-stone-200 overflow-hidden hover:border-stone-300 transition-colors">
      {/* Top row */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3 justify-between">
          <div className="flex-1 min-w-0">
            <button onClick={() => setOpen(o => !o)}
              className="text-left w-full group">
              <span className="text-sm font-semibold text-stone-800 group-hover:text-stone-600 transition-colors">
                {tk.title}
              </span>
            </button>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <span className={`text-[10px] font-semibold ${priorityCls}`}>{priorityLabel}</span>
            <span className="text-[10px] text-stone-400 border border-stone-200 rounded px-1.5 py-0.5 font-medium">{typeLabel}</span>
            {tk.page && <span className="text-[10px] text-amber-700 border border-amber-200 bg-amber-50 rounded px-1.5 py-0.5 font-medium">{tk.page}</span>}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>{statusLabel}</span>
          </div>
        </div>
        {/* Footer */}
        <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] text-stone-400">
            {t.submittedBy} {tk.submitted_by_name || "—"} · {date}
          </span>
          {isAdmin ? (
            <select
              value={tk.status}
              onChange={e => onStatusChange(tk.id, e.target.value)}
              onClick={e => e.stopPropagation()}
              className="text-[11px] border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 text-stone-600 cursor-pointer focus:outline-none">
              {Object.entries(t.statuses).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ) : null}
        </div>
      </div>
      {/* Expandable description */}
      {open && tk.description && (
        <div className="border-t border-stone-100 px-5 py-3 bg-stone-50">
          <p className="text-sm text-stone-500 leading-relaxed whitespace-pre-wrap">{tk.description}</p>
        </div>
      )}
    </div>
  );
}

export default TicketsPage;
