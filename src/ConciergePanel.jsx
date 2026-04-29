import React, { useEffect, useMemo, useState } from "react";

import {
  fetchKickoffsFromSheet,
  updateKickoffInSheet,
  deleteKickoff,
  saveKickoffToSheet,
} from "./sheetServices";

import {
  Search,
  RefreshCcw,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Clock,
  X,
  Link as LinkIcon,
  List as ListIcon,
} from "lucide-react";



/* =========================================
   Lista fija de concierges
   ========================================= */
const CONCIERGE_LIST = [
  { name: "Alia Jadad",           email: "alia@two.travel",     city: "CTG" },
  { name: "Carolina Lopez",       email: "caro@two.travel",     city: "CTG" },
  { name: "Daniela Becerra",      email: "daniela@two.travel",  city: "MDE" },
  { name: "Nataly Cruz",          email: "nataly@two.travel",   city: "CDMX" },
  { name: "Giulia Lorini Serrato",email: "giulia@two.travel",   city: "CDMX" },
  { name: "Aileen Servin",        email: "aileen@two.travel",   city: "CDMX" },
];

/* =========================================
   Helpers de formato
   ========================================= */

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};


const formatPriceCOP = (value) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value || 0);

/* =========================================
   Pre-Trip default template
   Edit this to change the default content
   that appears in every new kickoff's
   Pre-Trip Information block.
   ========================================= */

const DEFAULT_PRE_TRIP = `Take a look - Cartagena
Please take a look at this before your arrival. It has some helpful info for your trip.

Pre Check-in Form: https://forms.gle/REPLACE_WITH_FORM_LINK
Drink Calculator: https://two.travel/drinks
Cartagena City Guide (PDF): https://two.travel/ctg-guide.pdf
WhatsApp Concierge: https://wa.me/573001234567

──────────────────────────────

Promo!
Show everyone how amazing it is to travel with Two Travel's concierge service and get discounts on your experiences. Follow us @twotravelconcierge on Instagram and TikTok.

Note: The post must be made during your stay. One tag per person required to redeem. For group services (transport, chef, etc.) all members must participate for the discount to apply.

──────────────────────────────

Recommendations in Cartagena

☕ Coffee & Bakeries
Cafe San Alberto — Specialty coffee, award-winning roaster from Bogotá. Calle del Arzobispado #36-57.
Libertario — Artisan coffee in a relaxed courtyard. Calle de Badillo.
Epoca Cafe Bar — Coffee bar by day, bar by night. Great brunch spot (no reservations, first come first served). Calle de la Mantilla.
La Manchuria — Chill corner café with good filter coffee. Centro Histórico.
Ely — Beloved local bakery famous for pan de bono, pastries, and light breakfasts. Multiple locations.

🍫 Chocolate
Evok — Artisan Colombian chocolate store, beautiful gifts and tastings.

🏛️ Museums
Museo del Oro Zenú — Free gold museum showcasing Zenú culture. Plaza de Bolívar.
Museo Histórico de Cartagena — Inside the historic Palacio de la Inquisición. Must-visit.
Museo de Arte Moderno de Cartagena (MAMCA) — Rotating modern art exhibitions. Plaza de San Pedro.

🌅 Rooftops
Townhouse Cartagena — Stylish rooftop with city views, great cocktails. Reservations recommended.
Apogeo — Elegant penthouse rooftop bar with 360° views. Centro Histórico.
Buena Vida — Casual rooftop with great vibes and affordable drinks.
Mirador — Laid-back viewpoint rooftop. Great for sunsets.

──────────────────────────────

🛍️ Shopping
La Serrezuela Mall: Malva (local designers), Artesanias de Colombia, Loto del Sur (Colombian emeralds).
Walled City boutiques: Soloio, Agua de Leon, St Dom, Casa Chiqui, Territorio.

──────────────────────────────

🥞 Brunch
Al Alma — Stunning courtyard restaurant in a colonial mansion. Beautiful setting, great eggs benedicts and açaí bowls. Reservations strongly recommended. Calle del Santísimo #8-19.
Ely Centro Histórico — Cartagena institution. Beloved for their pan de bono, fresh juices, and empanadas. Casual and local. Calle Segunda de Badillo.
Epoca Cafe Bar — Trendy brunch spot with excellent coffee and food. No reservations, arrive early. Calle de la Mantilla.

──────────────────────────────

🍽️ Lunch
Pezetarian — Plant-forward Mediterranean menu in a beautiful Walled City spot. Fresh, light and delicious. Reservations recommended.
Kona — Casual Hawaiian-inspired poke bowls and fresh seafood. Great for a lighter lunch. Plaza de San Diego.
Buena Vida Marisquería — Seafood-focused spot with great ceviche and grilled fish. Popular with locals.
Tacos del Gordo — Authentic Mexican street tacos, surprisingly great. Very affordable. Getsemaní.

──────────────────────────────

🌿 Getsemaní Lunch
El Beso — Vibrant neighborhood gem with Colombian fusion dishes and colorful decor.
Cocina de Pepina — Traditional Colombian home cooking, grandmother recipes. Soulful and delicious.
Casa del Túnel — Relaxed courtyard restaurant inside a colonial house. Good mojitos.
Carta Ajena / OSH — Creative cocktail bar and restaurant. One of Getsemaní's coolest spots.

──────────────────────────────

📍 Places to Visit (free / walking)
Plaza de San Diego — Charming square surrounded by restaurants and boutiques.
Plaza Fernández de Madrid — Quiet, authentic local square. Great for people-watching.
Plaza de la Merced — Beautiful colonial church and open square.
Plaza Santo Domingo — Iconic square with the famous Botero sculpture. Lively at night.
Plaza de Bolívar — Central plaza with the gold museum and Palacio de la Inquisición.
San Pedro Claver Church — Beautiful colonial church and cloister. Worth a visit.
Plaza de la Aduana — Large colonial square near the Clock Tower.
Plaza de los Coches — Portal de los Dulces with local sweets vendors.
Clock Tower (Torre del Reloj) — The main entrance to the Walled City. Great photos.`;

/* =========================================
   Estados
   ========================================= */

const STATUS_LABELS = {
  new:                { es: "Nuevo",                    en: "New" },
  client_submitted:   { es: "Cliente llenó selección",  en: "Client submitted" },
  concierge_editing:  { es: "Concierge editando",       en: "Concierge editing" },
  sent_to_travify:    { es: "Enviado a Travefy",        en: "Sent to Travefy" },
  feedback_submitted: { es: "Cliente llenó feedback",   en: "Feedback submitted" },
  done:               { es: "Cerrado",                  en: "Closed" },
};
function statusLabel(status, lang = "es") {
  return STATUS_LABELS[status]?.[lang] ?? status;
}

const STATUS_CLASSES = {
  new: "bg-blue-100 text-blue-700 border-blue-300",
  client_submitted: "bg-indigo-100 text-indigo-800 border-indigo-300",
  concierge_editing: "bg-amber-100 text-amber-800 border-amber-300",
  sent_to_travify: "bg-purple-100 text-purple-800 border-purple-300",
  feedback_submitted: "bg-teal-100 text-teal-800 border-teal-300",
  done: "bg-emerald-100 text-emerald-700 border-emerald-300",
};
const CLIENT_TYPE_LABELS = {
  1: "Tipo 1",
  2: "Tipo 2",
};

const CLIENT_TYPE_CLASSES = {
  1: "bg-sky-100 text-sky-800 border-sky-300",
  2: "bg-purple-100 text-purple-800 border-purple-300",
};

function ClientTypeBadge({ value }) {
  const n = String(value).includes("2") ? 2 : 1;
  const label = CLIENT_TYPE_LABELS[n] || `Tipo ${n}`;
  const cls =
    CLIENT_TYPE_CLASSES[n] ||
    "bg-neutral-100 text-neutral-700 border-neutral-300";

  return (
    <span className={"inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border " + cls}>
      {label}
    </span>
  );
}


function StatusBadge({ status, lang = "es" }) {
  const s = String(status || "").trim().toLowerCase();

  const normalized =
  s === "nuevo" ? "new" :
  s === "cliente llenó selección" ? "client_submitted" :
  s === "concierge editando" ? "concierge_editing" :
  s === "enviado" ? "sent_to_travify" :
  s === "cerrado" ? "done" :
  s === "in-progress" ? "concierge_editing" :
  s === "sent" ? "sent_to_travify" :
  status;

  const label = STATUS_LABELS[normalized]?.[lang] ?? STATUS_LABELS[normalized]?.es ?? normalized ?? "—";
  const cls =
    STATUS_CLASSES[normalized] ||
    "bg-neutral-100 text-neutral-700 border-neutral-300";

  return (
    <span className={"inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border " + cls}>
      {label}
    </span>
  );
}
function buildCatalogLink(kickoff, clientType = 1, lang = "en") {
  const base = window.location.origin;
  const url = new URL("/", base);
  url.searchParams.set("mode", "catalog");
  url.searchParams.set("kickoffId", kickoff?.id || "");
  url.searchParams.set("clientType", String(clientType));
  url.searchParams.set("lang", lang); // explicit override — portalLang toggle wins
  url.searchParams.set("guestName", kickoff?.guestName || "");
  url.searchParams.set("tripName", kickoff?.tripName || "");
  if (kickoff?.guestContact) url.searchParams.set("guestContact", kickoff.guestContact);
  return url.toString();
}
function buildFeedbackLink(kickoff, clientType = 1, lang = "en") {
  const base = window.location.origin;
  const url = new URL("/", base);

  url.searchParams.set("mode", "feedback");
  url.searchParams.set("kickoffId", kickoff?.id || "");
  url.searchParams.set("clientType", String(clientType));
  url.searchParams.set("lang", lang); // explicit override — portalLang toggle wins

  url.searchParams.set("guestName", kickoff?.guestName || "");
  url.searchParams.set("tripName", kickoff?.tripName || "");
  url.searchParams.set("guestContact", kickoff?.guestContact || "");
  // Pre-fill destination + concierge in the feedback form
  if (kickoff?.city)               url.searchParams.set("destination", kickoff.city);
  if (kickoff?.assignedConcierge)  url.searchParams.set("concierge",   kickoff.assignedConcierge);

  return url.toString();
}

function buildQuestionnaireLink(kickoff, clientType = 1, lang = "en") {
  const base = window.location.origin;
  const url = new URL("/", base);
  url.searchParams.set("mode", "questionnaire");
  url.searchParams.set("kickoffId", kickoff?.id || "");
  url.searchParams.set("clientType", String(clientType));
  url.searchParams.set("lang", lang); // explicit override — portalLang toggle wins
  url.searchParams.set("guestName", kickoff?.guestName || "");
  url.searchParams.set("tripName", kickoff?.tripName || "");
  if (kickoff?.guestContact) url.searchParams.set("guestContact", kickoff.guestContact);
  return url.toString();
}

function mapServiceToCartItem(service, clientType = 1) {
  const base = Number(service?.price_cop || 0);
  const t1 = Number(service?.price_tier_1 || 0);
  const t2 = Number(service?.price_tier_2 || 0);

  const ct = String(clientType).includes("2") ? 2 : 1;
const chosen = ct === 2 ? (t2 || base) : (t1 || base);

  return {
  id: service?.id ?? service?.sku ?? `svc_${Date.now()}`,
  sku: service?.sku || "",
  name: service?.name || "Servicio",
  category: service?.category || "",
  subcategory: service?.subcategory || "",
  price_cop: chosen,
  price_tier_1: t1,
  price_tier_2: t2,
  base_price_cop: base,
  priceUnit: service?.priceUnit || "",
  displayName: service?.name || "",
  priceOverride_cop: null,
  dayLabel: "",
  timeLabel: "",
  notes: "",
  confirmed: true,
};
}

function mapManualToCartItem() {
  return {
    id: `manual_${Date.now()}`,
    sku: "",
    name: "Ítem manual",
    category: "manual",
    subcategory: "",
    price_cop: 0,
    price_tier_1: 0,
    price_tier_2: 0,
    priceUnit: "",

    displayName: "",
    priceOverride_cop: null,
    dayLabel: "",
    timeLabel: "",
    notes: "",
    confirmed: true,
  };
}

function buildTravifyTextFromCart(kickoff) {
  const items = kickoff?.cart || [];
  if (!items.length) return "";

  const fmt = (n) => new Intl.NumberFormat("es-CO").format(Number(n || 0));

  return items
    .map((it, i) => {
      const name = (it.displayName || it.name || "Servicio").trim();
      const price = it.priceOverride_cop ?? it.price_cop;
      const when = [it.dayLabel, it.timeLabel].filter(Boolean).join(" · ");
      const notes = it.notes ? `Notas: ${it.notes}` : "";

      return [
        `${i + 1}. ${name}`,
        when ? `   ${when}` : "",
        price ? `   Precio ref: ${fmt(price)} COP` : "",
        notes ? `   ${notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}
/* ═══════════════════════════════════════════════════════════════
   ACTIVITY ROW — inline-editable row inside a day section
═══════════════════════════════════════════════════════════════ */
function ActivityRow({ item, onUpdate, onRemove }) {
  const [showNotes, setShowNotes] = useState(!!(item.notes));
  return (
    <div className="px-4 py-2.5 hover:bg-neutral-50 transition-colors">
      <div className="grid grid-cols-12 gap-x-2 items-center">
        {/* Time */}
        <div className="col-span-2">
          <input
            value={item.timeLabel || ""}
            onChange={e => onUpdate(item.id, { timeLabel: e.target.value })}
            placeholder="Hora"
            className="w-full text-xs text-neutral-500 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
          />
        </div>
        {/* Name */}
        <div className="col-span-6">
          <input
            value={item.displayName || item.name || ""}
            onChange={e => onUpdate(item.id, { displayName: e.target.value })}
            placeholder="Nombre del servicio"
            className="w-full text-sm font-medium text-neutral-900 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent"
          />
          {item.category && (
            <span className="text-[9px] text-neutral-400 uppercase tracking-wide leading-none">
              {item.category}
            </span>
          )}
        </div>
        {/* Price */}
        <div className="col-span-3">
          <input
            type="number"
            value={item.priceOverride_cop ?? ""}
            onChange={e => onUpdate(item.id, {
              priceOverride_cop: e.target.value === "" ? null : Number(e.target.value),
            })}
            placeholder={String(item.price_cop || "Precio COP")}
            className="w-full text-xs text-right text-neutral-500 border-b border-transparent hover:border-neutral-200 focus:border-neutral-400 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300"
          />
        </div>
        {/* Actions */}
        <div className="col-span-1 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onUpdate(item.id, { confirmed: !(item.confirmed !== false) })}
            title={item.confirmed !== false ? "Marcar como recomendación" : "Marcar como confirmado"}
            className="text-[13px] leading-none opacity-60 hover:opacity-100 transition-opacity"
          >
            {item.confirmed !== false ? "✅" : "📌"}
          </button>
          <button type="button" onClick={() => setShowNotes(v => !v)}
            title="Notas"
            className="text-[11px] text-neutral-300 hover:text-neutral-600 leading-none">
            ✎
          </button>
          <button type="button" onClick={() => onRemove(item.id)}
            title="Quitar"
            className="text-[11px] text-neutral-300 hover:text-red-500 leading-none">
            ✕
          </button>
        </div>
      </div>
      {showNotes && (
        <input
          value={item.notes || ""}
          onChange={e => onUpdate(item.id, { notes: e.target.value })}
          placeholder="Notas: mesa, alergias, confirmación, prepago…"
          className="mt-1.5 w-full text-xs text-neutral-400 border-b border-dashed border-neutral-200 focus:outline-none py-0.5 bg-transparent placeholder-neutral-300 col-span-12"
          autoFocus
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DAY SECTION — one per day, collapsible, with editable header
═══════════════════════════════════════════════════════════════ */
function DaySection({ label, meta, items, loadingServices,
  onUpdateMeta, onRenameLabel, onRemoveDay,
  onUpdateItem, onRemoveItem, onAddManual, onAddFromCatalog }) {

  const [editingLabel, setEditingLabel] = useState(false);
  const [localLabel,   setLocalLabel]   = useState(label);
  const [collapsed,    setCollapsed]    = useState(false);

  useEffect(() => setLocalLabel(label), [label]);

  const commitLabel = () => {
    setEditingLabel(false);
    if (localLabel.trim() && localLabel !== label) onRenameLabel(localLabel.trim());
  };

  return (
    <div className="border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
      {/* ── Day header band ── */}
      <div className="bg-neutral-900 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {/* Editable date / day label */}
          {editingLabel ? (
            <input autoFocus value={localLabel}
              onChange={e => setLocalLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => { if (e.key === "Enter") commitLabel(); }}
              className="bg-neutral-800 text-white text-sm font-bold rounded px-2 py-0.5 w-52 focus:outline-none border border-neutral-600"
            />
          ) : (
            <button type="button" onClick={() => setEditingLabel(true)}
              title="Click para editar nombre/fecha del día"
              className="text-sm font-bold text-white hover:text-neutral-300 text-left truncate max-w-[200px]">
              {label}
            </button>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-neutral-500">{items.length} act.</span>
            <button type="button" onClick={() => setCollapsed(v => !v)}
              className="text-neutral-500 hover:text-white text-xs w-5 text-center">
              {collapsed ? "▼" : "▲"}
            </button>
            <button type="button" onClick={onRemoveDay}
              className="text-neutral-600 hover:text-red-400 text-xs w-4 text-center">
              ✕
            </button>
          </div>
        </div>
        {/* Editable day description (what goes into Travefy day title) */}
        <input
          value={meta.title || ""}
          onChange={e => onUpdateMeta({ title: e.target.value })}
          placeholder="Descripción del día: ARRIVALS + CHECK IN + DINNER AT LA VITROLA…"
          className="mt-1.5 w-full bg-transparent text-[11px] text-neutral-400 placeholder-neutral-700 focus:outline-none focus:text-white transition-colors"
        />
      </div>

      {/* ── Activities list ── */}
      {!collapsed && (
        <>
          {items.length === 0 ? (
            <div className="px-4 py-3 text-xs text-neutral-400 italic bg-white">
              Sin actividades — agrega una abajo.
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 bg-white">
              {items.map(item => (
                <ActivityRow key={item.id} item={item}
                  onUpdate={onUpdateItem} onRemove={onRemoveItem}/>
              ))}
            </div>
          )}
          {/* Add buttons */}
          <div className="flex gap-2 px-4 py-2.5 bg-neutral-50 border-t border-neutral-100">
            <button type="button" onClick={onAddManual}
              className="text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-white transition-colors">
              + Manual
            </button>
            <button type="button" onClick={onAddFromCatalog} disabled={loadingServices}
              className="text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 bg-white disabled:opacity-40 transition-colors">
              {loadingServices ? "Cargando…" : "+ Catálogo"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ITINERARY CANVAS — replaces ItineraryEditor
   Day-grouped view with true inline editing.
   Source of truth: cart (flat items) + dayMeta (day-level titles)
   Both are persisted on save and drive PDF + Travefy output.
═══════════════════════════════════════════════════════════════ */
function ItineraryCanvas({ kickoff, onSave }) {
  const [cart,     setCart]     = useState(kickoff?.cart     || []);
  const [dayMeta,  setDayMeta]  = useState(kickoff?.dayMeta  || []);
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [catalogTargetDay, setCatalogTargetDay] = useState(null);

  // Sync when kickoff changes (e.g. switching between kickoffs)
  useEffect(() => {
    setCart(kickoff?.cart     || []);
    setDayMeta(kickoff?.dayMeta || []);
  }, [kickoff?.id]);

  // Load catalog once
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingServices(true);
        const { fetchServicesFromSheet } = await import("./sheetServices");
        const data = await fetchServicesFromSheet();
        if (alive) setServices(data || []);
      } catch (e) { console.error(e); }
      finally { if (alive) setLoadingServices(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Build ordered day list: dayMeta order first, then any orphan cart items
  const days = useMemo(() => {
    const metaLabels = dayMeta.map(dm => dm.label);
    const extraLabels = [...new Set(
      cart.map(i => i.dayLabel || "Sin día").filter(l => !metaLabels.includes(l))
    )];
    const orderedLabels = [...metaLabels, ...extraLabels];
    if (orderedLabels.length === 0) return [];

    return orderedLabels.map(label => {
      const meta  = dayMeta.find(dm => dm.label === label) || { label, title: "", sortOrder: 99 };
      const items = cart
        .filter(i => (i.dayLabel || "Sin día") === label)
        .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
      return { label, meta, items };
    });
  }, [cart, dayMeta]);

  /* ── Day helpers ── */
  const upsertDayMeta = (label, patch) =>
    setDayMeta(prev => {
      const exists = prev.find(dm => dm.label === label);
      if (exists) return prev.map(dm => dm.label === label ? { ...dm, ...patch } : dm);
      return [...prev, { label, title: "", sortOrder: prev.length, ...patch }];
    });

  const renameDayLabel = (oldLabel, newLabel) => {
    setCart(prev => prev.map(i =>
      (i.dayLabel || "Sin día") === oldLabel ? { ...i, dayLabel: newLabel } : i
    ));
    setDayMeta(prev => prev.map(dm =>
      dm.label === oldLabel ? { ...dm, label: newLabel } : dm
    ));
  };

  const addDay = () => {
    const label = `Día ${days.length + 1}`;
    setDayMeta(prev => [...prev, { label, title: "", sortOrder: prev.length }]);
  };

  const removeDay = (label) => {
    if (!window.confirm(`¿Eliminar "${label}" y todas sus actividades?`)) return;
    setCart(prev => prev.filter(i => (i.dayLabel || "Sin día") !== label));
    setDayMeta(prev => prev.filter(dm => dm.label !== label));
  };

  /* ── Item helpers ── */
  const updateItem = (id, patch) =>
    setCart(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const removeItem = (id) =>
    setCart(prev => prev.filter(i => i.id !== id));

  const addManualToDay = (dayLabel) => {
    const count = cart.filter(i => (i.dayLabel || "Sin día") === dayLabel).length;
    setCart(prev => [...prev, { ...mapManualToCartItem(), dayLabel, sortOrder: count }]);
  };

  /* ── Save ── */
  const handleSave = async () => {
    try {
      setSaving(true);
      // Rebuild flat cart with clean sortOrders per day
      const newCart = [];
      days.forEach(({ label, items }) =>
        items.forEach((item, i) =>
          newCart.push({ ...item, dayLabel: label, sortOrder: i })
        )
      );
      await onSave(newCart, dayMeta);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el itinerario.");
    } finally {
      setSaving(false);
    }
  };

  if (!kickoff) return null;

  const totalActivities = days.reduce((n, d) => n + d.items.length, 0);

  return (
    <div className="space-y-3">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-neutral-400">
          {days.length} {days.length === 1 ? "día" : "días"} · {totalActivities} actividades
          {loadingServices && " · Cargando catálogo…"}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={addDay}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs hover:bg-neutral-50 text-neutral-600">
            + Agregar día
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs hover:bg-neutral-800 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar itinerario"}
          </button>
        </div>
      </div>

      {/* ── Empty state ── */}
      {days.length === 0 && (
        <div className="text-center py-10 border-2 border-dashed border-neutral-200 rounded-2xl">
          <p className="text-sm text-neutral-400 mb-3">No hay días aún.</p>
          <button type="button" onClick={addDay}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-xs">
            + Crear primer día
          </button>
        </div>
      )}

      {/* ── Day sections ── */}
      {days.map(({ label, meta, items }) => (
        <DaySection
          key={label}
          label={label}
          meta={meta}
          items={items}
          loadingServices={loadingServices}
          onUpdateMeta={patch => upsertDayMeta(label, patch)}
          onRenameLabel={newLabel => renameDayLabel(label, newLabel)}
          onRemoveDay={() => removeDay(label)}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onAddManual={() => addManualToDay(label)}
          onAddFromCatalog={() => setCatalogTargetDay(label)}
        />
      ))}

      {/* Catalog picker modal (per-day) */}
      {catalogTargetDay && (
        <CatalogPickerModal
          services={services}
          clientType={kickoff?.clientType || 1}
          city={kickoff?.city || ""}
          onClose={() => setCatalogTargetDay(null)}
          onPick={svc => {
            const count = cart.filter(i => (i.dayLabel || "Sin día") === catalogTargetDay).length;
            setCart(prev => [...prev, {
              ...mapServiceToCartItem(svc, kickoff?.clientType || 1),
              dayLabel: catalogTargetDay,
              sortOrder: count,
            }]);
            setCatalogTargetDay(null);
          }}
        />
      )}
    </div>
  );
}

function TierPickerModal({ title, kickoff, kind, onClose }) {
  if (!kickoff) return null;

  const getLink = (tier) => {
    if (kind === "catalog") return buildCatalogLink(kickoff, tier);
    return buildQuestionnaireLink(kickoff, tier);
  };

  const ActionRow = ({ tier, label }) => {
    const link = getLink(tier);

    return (
      <div className="border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-neutral-900">{label}</div>
          <div className="text-[11px] font-mono text-neutral-600 break-all">{link}</div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
              } catch {
                prompt("Copia este link:", link);
              }
            }}
            className="px-3 py-2 rounded-lg border border-neutral-300 text-xs hover:bg-neutral-100"
          >
            Copiar
          </button>

          <button
            type="button"
            onClick={() => window.open(link, "_blank", "noopener,noreferrer")}
            className="px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs hover:bg-neutral-950"
          >
            Abrir
          </button>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      maxWidth="max-w-3xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Cerrar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-neutral-600">
          {kickoff.guestName ? (
            <>Cliente: <span className="font-semibold">{kickoff.guestName}</span></>
          ) : (
            <span className="italic">Sin nombre</span>
          )}
          {" · "}
          {kickoff.tripName ? (
            <>Viaje: <span className="font-semibold">{kickoff.tripName}</span></>
          ) : (
            <span className="italic">Sin título</span>
          )}
        </div>

        <ActionRow tier={1} label="Cliente Tipo 1" />
<ActionRow tier={2} label="Cliente Tipo 2" />
      </div>
    </Modal>
  );
}







/* =========================================
   Modal base
   ========================================= */



function Modal({ title, children, footer, onClose, maxWidth = "max-w-3xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full ${maxWidth} bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]`}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <h2 className="text-sm sm:text-base font-semibold text-neutral-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="px-5 py-3 border-t bg-neutral-50 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================
   Modal: Ver Resumen
   ========================================= */

function SummaryModal({ kickoff, onClose }) {
  const [copied, setCopied] = useState(false);
  if (!kickoff) return null;

  const travifyText =
  kickoff.travifyText ||
  buildTravifyTextFromCart(kickoff) ||
  kickoff.conciergeSummary ||
  "";


  const handleCopy = async () => {
    try {
      if (!travifyText) return;
      await navigator.clipboard.writeText(travifyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error(err);
      alert("No se pudo copiar al portapapeles.");
    }
  };

  return (
    <Modal
      title={`Resumen – ${
        kickoff.tripName || kickoff.guestName || kickoff.id
      }`}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cerrar
          </button>
          
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] text-neutral-500">ID</p>
            <p className="font-mono text-neutral-900 text-xs sm:text-sm">
              {kickoff.id}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-500">Huésped</p>
            <p className="text-neutral-900">
              {kickoff.guestName || (
                <span className="italic text-neutral-400">Sin nombre</span>
              )}
            </p>
          </div>
          <div>
  <p className="text-[11px] text-neutral-500">Contacto</p>
  <p className="text-neutral-900">
    {kickoff.guestContact ? (
      kickoff.guestContact
    ) : (
      <span className="italic text-neutral-400">Sin contacto</span>
    )}
  </p>
</div>
          <div>
            <p className="text-[11px] text-neutral-500">Viaje</p>
            <p className="text-neutral-900">
              {kickoff.tripName || (
                <span className="italic text-neutral-400">Sin título</span>
              )}
            </p>
          </div>
          <div className="text-right text-[11px] text-neutral-500 space-y-0.5">
            <p>📅 Creado: <span className="text-neutral-700">{formatDateTime(kickoff.createdAt)}</span></p>
            {kickoff.clientSubmittedAt && <p>✅ Cliente envió: <span className="text-neutral-700">{formatDateTime(kickoff.clientSubmittedAt)}</span></p>}
            {kickoff.conciergeEditingAt && <p>✏️ Concierge editó: <span className="text-neutral-700">{formatDateTime(kickoff.conciergeEditingAt)}</span></p>}
            {kickoff.feedbackAt && <p>💬 Feedback: <span className="text-neutral-700">{formatDateTime(kickoff.feedbackAt)}</span></p>}
            {kickoff.conciergeRating > 0 && (
              <p>⭐ Rating interno: <span className="text-amber-600 font-semibold">{"★".repeat(Number(kickoff.conciergeRating))}{"☆".repeat(5 - Number(kickoff.conciergeRating))}</span></p>
            )}
          </div>
          <div className="ml-auto">
            <StatusBadge status={kickoff.status} />
          </div>
        </div>

        <div className="space-y-2">
  <div className="flex items-center justify-between gap-2">
    <h3 className="text-sm font-semibold text-neutral-900">Itinerario</h3>

    
  </div>

  
  
</div>


        {/* ── Quiz answers ── */}
        {(() => {
          let q = null;
          try { q = JSON.parse(kickoff.quizAnswers || "null"); } catch {}
          if (!q) return null;
          const vibeMap = { relax:"🏖 Relax", party:"🎉 Nightlife", romantic:"🌹 Romántico", family:"👨‍👩‍👧 Familia", adventure:"🏄 Aventura" };
          const budgetMap = { low:"$ Económico", mid:"$$ Medio", high:"$$$ Alto" };
          const rows = [
            q.groupSize  && { label:"👥 Personas",   val: q.groupSize },
            q.vibes?.length  && { label:"🎭 Vibe",       val: (q.vibes||[]).map(v=>vibeMap[v]||v).join(", ") },
            q.budget     && { label:"💰 Presupuesto", val: budgetMap[q.budget] || q.budget },
            q.kids==="yes"   && { label:"👶 Niños",      val: "Sí" },
            q.cuisines?.length && { label:"🍽 Cocinas",    val: (q.cuisines||[]).join(", ") },
            q.interests?.length && { label:"🎯 Intereses",  val: (q.interests||[]).join(", ") },
          ].filter(Boolean);
          if (!rows.length) return null;
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-amber-800">📋 Respuestas del cuestionario</p>
              {rows.map(({label, val}) => (
                <div key={label} className="flex gap-2 text-xs">
                  <span className="text-neutral-500 w-28 shrink-0">{label}</span>
                  <span className="text-neutral-900 font-medium">{val}</span>
                </div>
              ))}
              {kickoff.additionalNotes && (
                <div className="flex gap-2 text-xs mt-1 pt-1 border-t border-amber-200">
                  <span className="text-neutral-500 w-28 shrink-0">📝 Notas extra</span>
                  <span className="text-neutral-900">{kickoff.additionalNotes}</span>
                </div>
              )}
            </div>
          );
        })()}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900">
              Ítems seleccionados por el cliente
            </h3>
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <Clock className="w-3 h-3" />
              {(kickoff.cart || []).length} ítems
            </span>
          </div>

          {(!kickoff.cart || kickoff.cart.length === 0) && (
            <p className="text-xs text-neutral-500">
              No hay ítems guardados para este kick-off.
            </p>
          )}

          {kickoff.cart && kickoff.cart.length > 0 && (
            <ul className="border border-neutral-100 rounded-lg divide-y divide-neutral-100 bg-white">
              {kickoff.cart.map((item, idx) => (
                <li key={`${item.id || item.name}-${idx}`} className="p-3">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-neutral-900 truncate">
                        {idx + 1}. {item.displayName || item.name}
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        {item.category || "—"}
                        {item.priceUnit ? ` · ${item.priceUnit}` : ""}
                      </p>
                    </div>
                    {/* Only show COP price for categories that have exact pricing (tours, services, transportation) */}
                    {(() => {
                      const cat = String(item.category || "").toLowerCase();
                      const usesLevels = ["restaurants","bars","beach-clubs","nightlife"].includes(cat);
                      const price = item.priceOverride_cop || item.price_cop;
                      if (usesLevels) {
                        // Show price-level indicator instead of COP
                        const lvl = item.priceLevel || (price >= 300000 ? "$$$" : price >= 150000 ? "$$" : price ? "$" : null);
                        return lvl ? (
                          <span className="text-xs text-neutral-500 whitespace-nowrap">{lvl}</span>
                        ) : null;
                      }
                      return price ? (
                        <p className="text-xs text-neutral-800 text-right whitespace-nowrap">
                          {formatPriceCOP(price)}
                        </p>
                      ) : null;
                    })()}
                  </div>
                  {item.notes && (
                    <p className="mt-1 text-[11px] text-neutral-700">
                      <span className="font-semibold">Notas: </span>
                      {item.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}


/* =========================================
   Modal confirmar eliminación
   ========================================= */

/* =========================================
   Concierge Rating Modal
   Shown before sharing the feedback link.
   Saves a 1-5 star internal rating to the kickoff.
   ========================================= */
function ConciergeRatingModal({ kickoff, onSave, onClose }) {
  const [rating, setRating] = useState(kickoff?.conciergeRating || 0);
  const [hover, setHover]   = useState(0);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(rating);
    setSaving(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 500,
        background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: "#fff", borderRadius: 16, padding: "28px 32px",
        width: 360, boxShadow: "0 8px 40px rgba(0,0,0,.2)",
        fontFamily: "system-ui, sans-serif",
      }}>
        <p style={{ fontSize: 11, letterSpacing: "2px", textTransform: "uppercase", color: "#aaa", marginBottom: 6 }}>
          Evaluación interna
        </p>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: "#111", marginBottom: 4 }}>
          ¿Cómo salió este trip?
        </h3>
        <p style={{ fontSize: 12, color: "#888", marginBottom: 20, lineHeight: 1.6 }}>
          {kickoff?.guestName && <strong style={{ color: "#444" }}>{kickoff.guestName}</strong>}
          {kickoff?.tripName  && <span style={{ color: "#bbb" }}> · {kickoff.tripName}</span>}
          <br/>
          Esta calificación es solo interna y se guarda en el dashboard.
        </p>

        {/* Stars */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
          {[1,2,3,4,5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              style={{
                fontSize: 36, cursor: "pointer",
                background: "none", border: "none", padding: "2px 4px",
                color: star <= (hover || rating) ? "#f59e0b" : "#e5e7eb",
                transition: "color .12s",
              }}
            >
              ★
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#888", marginBottom: 16 }}>
            {["", "😕 Hubo problemas", "😐 Por mejorar", "🙂 Bien", "😊 Muy bien", "🌟 Perfecto"][rating]}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: 99, border: "1px solid #e0e0e0",
              fontSize: 13, cursor: "pointer", background: "#fff", color: "#666",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 20px", borderRadius: 99, border: "none",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: rating > 0 ? "#111" : "#d1d5db",
              color: rating > 0 ? "#fff" : "#9ca3af",
              transition: "background .15s",
            }}
          >
            {saving ? "Guardando…" : "Guardar y copiar link"}
          </button>
        </div>
      </div>
    </div>
  );
}


async function copyAndOpen(link) {
  if (!link) return alert("No se pudo generar el link.");

  const win = window.open(link, "_blank", "noopener,noreferrer");

  try {
    await navigator.clipboard.writeText(link);
  } catch {
    prompt("Copia este link:", link);
  }

  if (!win) alert("Popup bloqueado. Link copiado ✅");
}

async function ensureKickoffReady(
  selectedKickoffForLink,
  setKickoffs,
  setSelectedKickoffForLink
) {
  if (!selectedKickoffForLink) {
    const guestName = (prompt("Nombre del cliente:") || "").trim();
    if (!guestName) return null;

    const tripName = (prompt("Nombre del viaje:") || "").trim();
    const guestContact = (prompt("Contacto (WhatsApp o email):") || "").trim();

    const cityRaw = (prompt("Ciudad destino:\n1 = Cartagena\n2 = Medellín\n3 = CDMX\n4 = Tulum\n5 = Otra") || "1").trim();
    const cityMap = { "1": "cartagena", "2": "medellín", "3": "cdmx", "4": "tulum" };
    const city = cityMap[cityRaw] || cityRaw.toLowerCase() || "cartagena";

    const clientType = window.confirm("¿Cliente Tipo 2? (OK = Sí, Cancel = Tipo 1)") ? 2 : 1;

const kickoffId = `ko_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const created = await saveKickoffToSheet({
      id: kickoffId,
      guestName,
      tripName,
      guestContact,
      clientType,
      city,
      createdAt: new Date().toISOString(),
      status: "new",
      conciergeSummary: "",
      travifyText: "",
      internalNotes: "",
      cart: [],
    });

    const kickoff = {
      ...created,
      id: created?.id || kickoffId,
      guestName,
      tripName,
      guestContact,
      clientType: Number(created?.clientType || 1),
    };

    setKickoffs((prev) => [kickoff, ...(prev || [])]);
    setSelectedKickoffForLink(kickoff);
    return kickoff;
  }

  let updates = {};
  let changed = false;

  if (!String(selectedKickoffForLink.guestName || "").trim()) {
    const guestName = (prompt("Nombre del cliente:") || "").trim();
    if (!guestName) return null;
    updates.guestName = guestName;
    changed = true;
  }

  if (!String(selectedKickoffForLink.tripName || "").trim()) {
    const tripName = (prompt("Nombre del viaje:") || "").trim();
    updates.tripName = tripName;
    changed = true;
  }

  if (!String(selectedKickoffForLink.guestContact || "").trim()) {
    const guestContact = (prompt("Contacto (WhatsApp o email):") || "").trim();
    updates.guestContact = guestContact;
    changed = true;
  }

  if (changed) {
    await updateKickoffInSheet(selectedKickoffForLink.id, updates);

    const updated = { ...selectedKickoffForLink, ...updates };

    setKickoffs((prev) =>
      (prev || []).map((k) => (k.id === updated.id ? updated : k))
    );
    setSelectedKickoffForLink(updated);

    return updated;
  }

  return selectedKickoffForLink;
}

// Small normalizer so ConciergePanel picks match any sheet category value
function normCatPanel(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (/chef|private.?chef|chef.?privado/.test(v)) return "chef";
  if (/restauran|comida|food/.test(v)) return "restaurants";
  if (/beach.?club|playa/.test(v)) return "beach-clubs";
  if (/\btour\b|activid|excursion/.test(v)) return "tours";
  if (/transport|transfer|traslado/.test(v)) return "transportation";
  // bars/rooftop/lounge/cocktail → nightlife (bars is a sub-type)
  if (/night|discoteca|club\b|\bbar\b|bares|coctel|rooftop|lounge|cocktail/.test(v)) return "nightlife";
  return v;
}

// Nightlife covers bars, rooftops, lounges — all under one section
const SUGGESTION_CATS = [
  { id: "restaurants",    ids: ["restaurants"],              label: "🍽 Restaurantes" },
  { id: "nightlife",      ids: ["nightlife"],                label: "🍹 Bares & Nightlife" },
  { id: "beach-clubs",    ids: ["beach-clubs"],              label: "🏖 Beach Clubs" },
  { id: "tours",          ids: ["tours"],                    label: "🗺 Tours" },
  { id: "transportation", ids: ["transportation"],           label: "🚗 Transporte" },
  { id: "chef",           ids: ["chef"],                     label: "👨‍🍳 Chef Privado" },
  { id: "services",       ids: ["services"],                 label: "✨ Servicios" },
];

function CatalogPickerModal({ services, clientType = 1, city = "", onClose, onPick }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  // Normalise city for comparison (lowercase, no accents on common names)
  const normalizeCity = (v) => String(v || "").trim().toLowerCase();
  const kickoffCity = normalizeCity(city);

  // Base list: filter by city when kickoff has one and service has city tagged
  const cityServices = useMemo(() => {
    if (!kickoffCity) return services || [];
    return (services || []).filter((s) => {
      const sCity = normalizeCity(s.city);
      // If service has no city tag → show it (backward-compat for untagged rows)
      if (!sCity) return true;
      return sCity === kickoffCity;
    });
  }, [services, kickoffCity]);

  // Suggested: 2 per category, in SUGGESTION_CATS order
  const suggested = useMemo(() => {
    return SUGGESTION_CATS.map(({ id, ids, label }) => {
      const items = cityServices
        .filter((s) => ids.includes(normCatPanel(s.category)))
        .sort((a, b) => {
          // Pin "Duster" first for transportation picks
          if (id === "transportation") {
            const aD = /duster/i.test(a.name) ? 0 : 1;
            const bD = /duster/i.test(b.name) ? 0 : 1;
            return aD - bD;
          }
          return 0;
        })
        .slice(0, 2);
      return { id, label, items };
    }).filter((g) => g.items.length > 0);
  }, [cityServices]);

  const categories = useMemo(() => {
    const set = new Set(
      cityServices
        .map((s) => String(s.category || "").trim())
        .filter(Boolean)
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [cityServices]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return cityServices
      .filter((s) => {
        const cat = String(s.category || "").trim();
        if (category !== "all" && cat !== category) return false;

        if (!query) return true;
        const haystack = [
          s.name,
          s.sku,
          s.category,
          s.subcategory,
          s.priceUnit,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .slice(0, 200); // evita listas gigantes
  }, [cityServices, q, category]);

  return (
    <Modal
      title={kickoffCity ? `Agregar desde Catálogo · ${kickoffCity.charAt(0).toUpperCase() + kickoffCity.slice(1)}` : "Agregar desde Catálogo"}
      onClose={onClose}
      maxWidth="max-w-4xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Cerrar
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Buscar: nombre, SKU, categoría…"
            autoFocus
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white sm:w-64"
            title="Filtrar por categoría"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "Todas las categorías" : c}
              </option>
            ))}
          </select>
        </div>

        {/* ── Sugeridos por categoría (solo cuando no hay búsqueda activa) ── */}
        {!q.trim() && category === "all" && suggested.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
              ⚡ Picks rápidos — 2 por categoría
            </p>
            {suggested.map(({ id, label, items }) => (
              <div key={id}>
                <p className="text-xs font-semibold text-neutral-700 mb-1">{label}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {items.map((s) => {
                    const ct = String(clientType).includes("2") ? 2 : 1;
                    const price = ct === 2 ? (s.price_tier_2 || s.price_cop) : (s.price_tier_1 || s.price_cop);
                    const usesLevels = ["restaurants","bars","beach-clubs","nightlife"].includes(id);
                    const priceDisplay = usesLevels
                      ? (s.priceLevel || "—")
                      : price ? new Intl.NumberFormat("es-CO").format(price) + " COP" : "—";
                    return (
                      <button
                        key={s.id || s.sku}
                        type="button"
                        onClick={() => onPick(s)}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-400 text-left transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-neutral-900 truncate">{s.name}</div>
                          {s.subcategory && <div className="text-[10px] text-neutral-500 truncate">{s.subcategory}</div>}
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-0.5">
                          <span className="text-[10px] text-neutral-500">{priceDisplay}</span>
                          <span className="text-[10px] bg-neutral-900 text-white px-2 py-0.5 rounded-md">+ Agregar</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="border-t pt-2">
              <p className="text-[11px] text-neutral-400">O busca cualquier servicio abajo ↓</p>
            </div>
          </div>
        )}

        <div className="text-[11px] text-neutral-500">
          Mostrando {filtered.length} de {(services || []).length} servicios
        </div>

        {filtered.length === 0 ? (
          <div className="text-xs text-neutral-500 border rounded-xl p-3 bg-neutral-50">
            No hay resultados con ese filtro.
          </div>
        ) : (
          <div className="border rounded-2xl overflow-hidden bg-white">
            <div className="max-h-[55vh] overflow-auto divide-y">
              {filtered.map((s) => {
                const name = String(s.name || "Servicio").trim();
                const cat = String(s.category || "").trim();
                const sub = String(s.subcategory || "").trim();
                const sku = String(s.sku || "").trim();
                const unit = String(s.priceUnit || "").trim();
                const tier1 = Number(s.price_tier_1 || 0);
const tier2 = Number(s.price_tier_2 || 0);
const base = Number(s.price_cop || 0);
const ct = String(clientType).includes("2") ? 2 : 1;
const price = ct === 2 ? (tier2 || base) : (tier1 || base);
const usesLevels = ["restaurants","bars","beach-clubs","nightlife"].includes(cat);
const priceDisplay = usesLevels
  ? (s.priceLevel || (price >= 300000 ? "$$$" : price >= 150000 ? "$$" : price ? "$" : "—"))
  : price
  ? new Intl.NumberFormat("es-CO").format(price) + " COP"
  : "—";
                return (
                  <button
                    key={s.id || s.sku || name}
                    type="button"
                    onClick={() => onPick(s)}
                    className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-neutral-900 truncate">
                        {name}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {[cat, sub].filter(Boolean).join(" · ")}
                        {sku ? ` · SKU: ${sku}` : ""}
                        {unit ? ` · ${unit}` : ""}
                      </div>
                    </div>

                    <div className="shrink-0 text-xs text-neutral-800 whitespace-nowrap">
                      {priceDisplay}
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-lg bg-neutral-900 text-white text-[11px]">
                        Agregar
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            
          </div>
        )}
        
      </div>
      
    </Modal>
  );
}



function ConfirmDeleteModal({ kickoff, onCancel, onConfirm, loading }) {
  if (!kickoff) return null;
  return (
    <Modal
      title="Eliminar kick-off"
      onClose={onCancel}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-sm text-white hover:bg-red-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "Eliminando..." : "Eliminar"}
          </button>
        </>
      }
    >
      <p className="text-sm text-neutral-800">
        ¿Seguro que quieres eliminar este kick-off?
      </p>
      <p className="mt-2 text-xs text-neutral-600">
        Huésped:{" "}
        <span className="font-medium">
          {kickoff.guestName || "Sin nombre"}
        </span>
        <br />
        Viaje:{" "}
        <span className="font-medium">
          {kickoff.tripName || "Sin título"}
        </span>
      </p>
      <p className="mt-3 text-xs text-neutral-500">
        Esta acción no se puede deshacer.
      </p>
    </Modal>
  );
}

function EditDrawer({ kickoff, onClose, onSave, onSilentUpdate }) {
  const [guestName, setGuestName] = useState(kickoff?.guestName || "");
  const [tripName, setTripName] = useState(kickoff?.tripName || "");
  const [guestContact, setGuestContact] = useState(kickoff?.guestContact || "");
  const [assignedConcierge, setAssignedConcierge] = useState(kickoff?.assignedConciergeName || kickoff?.assignedConcierge || "");
  const [assignedConciergeEmail, setAssignedConciergeEmail] = useState(kickoff?.assignedConciergeEmail || "");
  const [status, setStatus] = useState(kickoff?.status || "new");
  const [conciergeSummary] = useState(kickoff?.conciergeSummary || "");
  const [internalNotes, setInternalNotes] = useState(kickoff?.internalNotes || "");

  // Read-only: dates submitted by client in questionnaire
  const clientArrival   = kickoff?.arrivalDate   || "";
  const clientDeparture = kickoff?.departureDate || "";
  const clientNights    = (() => {
    if (!clientArrival || !clientDeparture) return null;
    const n = Math.round((new Date(clientDeparture) - new Date(clientArrival)) / 86400000);
    return n > 0 ? n : null;
  })();

  // Cover / trip-level fields for Travefy document
  // Parse quiz answers saved by client
  const quizAnswers = (() => {
    try { return JSON.parse(kickoff?.quizAnswers || "{}"); } catch { return {}; }
  })();

  // Auto-format tripDates from arrivalDate/departureDate if not already set
  const autoTripDates = (() => {
    if (kickoff?.tripDates) return kickoff.tripDates;
    const a = kickoff?.arrivalDate, d = kickoff?.departureDate;
    if (!a || !d) return "";
    try {
      const fmt = (s) => new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const yr  = new Date(d).getFullYear();
      return `${fmt(a)} – ${fmt(d)}, ${yr}`;
    } catch { return ""; }
  })();

  // Auto-fill groupSize from quiz if concierge hasn't set it yet
  const autoGroupSize = kickoff?.groupSize || String(quizAnswers?.groupSize || quizAnswers?.pax || "");

  const [tripDates,          setTripDates]          = useState(autoTripDates);
  const [city,               setCity]               = useState(kickoff?.city               || "");
  const [groupSize,          setGroupSize]          = useState(autoGroupSize);
  const [conciergeTitle,     setConciergeTitle]     = useState(kickoff?.conciergeTitle     || "");
  const [accommodationName,  setAccommodationName]  = useState(kickoff?.accommodationName  || "");
  const [accommodationAddr,  setAccommodationAddr]  = useState(kickoff?.accommodationAddr  || "");
  const [checkIn,            setCheckIn]            = useState(kickoff?.checkIn            || "3:00 PM");
  const [checkOut,           setCheckOut]           = useState(kickoff?.checkOut           || "11:00 AM");
  const [welcomePdfUrl,      setWelcomePdfUrl]      = useState(kickoff?.welcomePdfUrl      || "");
  const [preTripContent,     setPreTripContent]     = useState(kickoff?.preTripContent     || DEFAULT_PRE_TRIP);

  if (!kickoff) return null;

  const handleSave = async () => {
  // Auto-advance status when concierge saves from "new" or "client_submitted"
  const autoStatus =
    status === "new" || status === "client_submitted"
      ? "concierge_editing"
      : status;

  const now = new Date().toISOString();
  const updates = {
    guestName: guestName.trim(),
    tripName: tripName.trim(),
    status: autoStatus,
    conciergeSummary,
    internalNotes,
    assignedConcierge: assignedConcierge.trim(),
    assignedConciergeName: assignedConcierge.trim(),
    assignedConciergeEmail: assignedConciergeEmail.trim(),
    // Cover fields
    tripDates:         tripDates.trim(),
    city:              city.trim(),
    groupSize:         groupSize.trim(),
    conciergeTitle:    conciergeTitle.trim(),
    accommodationName: accommodationName.trim(),
    accommodationAddr: accommodationAddr.trim(),
    checkIn:           checkIn.trim(),
    checkOut:          checkOut.trim(),
    welcomePdfUrl:     welcomePdfUrl.trim(),
    // Timestamps — only set first time each status is reached
    ...(autoStatus === "concierge_editing" && !kickoff.conciergeEditingAt ? { conciergeEditingAt: now } : {}),
    // Pre-trip info block (rendered as a page before itinerary days in PDF)
    preTripContent:    preTripContent.trim(),
  };

  const c = guestContact.trim();
  if (c) updates.guestContact = c;

  await onSave(kickoff.id, updates);
  setStatus(autoStatus);
};


  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="w-full max-w-xl h-full bg-white shadow-xl flex flex-col">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <p className="text-[11px] text-neutral-500">Editar kick-off</p>
            <p className="text-sm font-semibold text-neutral-900">
              {kickoff.tripName || kickoff.guestName || kickoff.id}
            </p>
            <p className="text-[11px] font-mono text-neutral-500">{kickoff.id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-neutral-500">Huésped</label>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre del huésped"
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-500">Viaje</label>
              <input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre del viaje"
              />
            </div>
            <div>
  <label className="text-[11px] text-neutral-500">Contacto</label>
  <input
    value={guestContact}
    onChange={(e) => setGuestContact(e.target.value)}
    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
    placeholder="WhatsApp o email"
  />
</div>

            {/* Dates + quiz answers submitted by client */}
            {(clientArrival || clientDeparture || Object.keys(quizAnswers).some(k => quizAnswers[k] && quizAnswers[k] !== "no" && !(Array.isArray(quizAnswers[k]) && !quizAnswers[k].length))) && (
              <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-3 text-xs text-blue-900 space-y-2">
                <p className="font-semibold text-[11px] uppercase tracking-wide text-blue-700">📋 Info del cuestionario</p>

                {/* Dates */}
                {(clientArrival || clientDeparture) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {clientArrival   && <span>📅 Llegada: <strong>{clientArrival}</strong></span>}
                    {clientDeparture && <span>✈️ Salida: <strong>{clientDeparture}</strong></span>}
                    {clientNights    && <span>🌙 <strong>{clientNights} noches</strong></span>}
                  </div>
                )}

                {/* Group size */}
                {(quizAnswers.groupSize || quizAnswers.pax) && (
                  <p>👥 Personas: <strong>{quizAnswers.groupSize || quizAnswers.pax}</strong></p>
                )}

                {/* Kids */}
                {quizAnswers.kids === "yes" && (
                  <p>🧒 Viajan con niños</p>
                )}

                {/* Budget */}
                {quizAnswers.budget && (
                  <p>💰 Presupuesto: <strong>{
                    quizAnswers.budget === "low" ? "$ Económico"
                    : quizAnswers.budget === "mid" ? "$$ Intermedio"
                    : quizAnswers.budget === "high" ? "$$$ Premium"
                    : quizAnswers.budget
                  }</strong></p>
                )}

                {/* Vibes */}
                {quizAnswers.vibes?.length > 0 && (
                  <p>✨ Vibes: <strong>{quizAnswers.vibes.join(", ")}</strong></p>
                )}

                {/* Cuisines */}
                {quizAnswers.cuisines?.length > 0 && (
                  <p>🍴 Cocinas: <strong>{quizAnswers.cuisines.join(", ")}</strong></p>
                )}

                {/* Additional notes from client */}
                {kickoff?.additionalNotes && (
                  <p>📝 Nota del cliente: <strong>{kickoff.additionalNotes}</strong></p>
                )}

                {/* Group notes from quiz */}
                {quizAnswers.groupNotes && (
                  <p>💬 Notas del grupo: <strong>{quizAnswers.groupNotes}</strong></p>
                )}
              </div>
            )}

            <div>
              <label className="text-[11px] text-neutral-500">Concierge asignado (nombre)</label>
              <input
                value={assignedConcierge}
                onChange={(e) => setAssignedConcierge(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Nombre del concierge"
              />
            </div>

            <div>
              <label className="text-[11px] text-neutral-500">Email del concierge</label>
              <input
                type="email"
                value={assignedConciergeEmail}
                onChange={(e) => setAssignedConciergeEmail(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="concierge@email.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] text-neutral-500">Estado</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="new">{STATUS_LABELS.new.es}</option>
                <option value="client_submitted">{STATUS_LABELS.client_submitted.es}</option>
                <option value="concierge_editing">{STATUS_LABELS.concierge_editing.es}</option>
                <option value="sent_to_travify">{STATUS_LABELS.sent_to_travify.es}</option>
                <option value="feedback_submitted">{STATUS_LABELS.feedback_submitted.es}</option>
                <option value="done">{STATUS_LABELS.done.es}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-neutral-500">Notas internas</label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[90px]"
              placeholder="Notas internas"
            />
          </div>

          {/* ── Cover Info ─────────────────────────────── */}
          <div className="border rounded-2xl p-4 bg-neutral-50 space-y-3">
            <p className="text-xs font-semibold text-neutral-700">Portada del itinerario (PDF)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-neutral-500">Fechas del viaje</label>
                <input value={tripDates} onChange={(e) => setTripDates(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="May 22-28, 2026" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Ciudad / Destino</label>
                <input value={city} onChange={(e) => setCity(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Medellín" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Personas en el grupo</label>
                <input value={groupSize} onChange={(e) => setGroupSize(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="5 people" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Título del concierge</label>
                <input value={conciergeTitle} onChange={(e) => setConciergeTitle(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Senior Concierge Medellín" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Nombre del alojamiento</label>
                <input value={accommodationName} onChange={(e) => setAccommodationName(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Edificio Los Eucaliptos" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Dirección del alojamiento</label>
                <input value={accommodationAddr} onChange={(e) => setAccommodationAddr(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="Calle 10 # 29-34, Medellín, Antioquia" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Check-in</label>
                <input value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="3:00 PM" />
              </div>
              <div>
                <label className="text-[11px] text-neutral-500">Check-out</label>
                <input value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="11:00 AM" />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-neutral-500">Welcome PDF URL (link que aparece en el itinerario)</label>
                <input value={welcomePdfUrl} onChange={(e) => setWelcomePdfUrl(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
                  placeholder="https://drive.google.com/file/d/.../view" />
              </div>
            </div>
          </div>

          {/* PRE-TRIP INFO — page that appears before itinerary days in PDF */}
          <div className="border rounded-2xl p-4 bg-neutral-50 space-y-2">
            <p className="text-xs font-semibold text-neutral-700">Pre-Trip Information</p>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              This block appears as a full page <em>before</em> the itinerary days in the PDF.
              Include links (forms, WhatsApp, PDFs), notes, recommendations, promo info, etc.
              One item per line. Lines starting with http/https render as clickable links.
            </p>
            <textarea
              value={preTripContent}
              onChange={(e) => setPreTripContent(e.target.value)}
              rows={8}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[140px] font-mono bg-white"
              placeholder={`Pre Check-in Form: https://form.link/checkin\nDrink Calculator: https://two.travel/drinks\nCartagena City Guide: https://two.travel/guide.pdf\nWhatsApp Concierge: https://wa.me/573001234567\n\nPromo: Share @twotravelconcierge and get a discount on select experiences.\n\nCoffee recommendations: Amor Perfecto, Pergamino\nRooftop recommendations: Aloft, Alma`}
            />
          </div>

          {/* ITINERARIO — canvas con edición inline por día */}
<div className="border rounded-2xl p-4 bg-white">
  <div className="flex items-center justify-between mb-1">
    <div className="text-sm font-semibold text-neutral-900">Itinerario</div>
    {kickoff?.cart?.length > 0 && (
      <a
        href={`/?mode=itinerary&kickoffId=${kickoff.id}&lang=${kickoff.lang || "en"}`}
        target="_blank" rel="noreferrer"
        className="text-[11px] text-blue-600 hover:underline">
        📄 Ver PDF →
      </a>
    )}
  </div>
  <div className="text-[11px] text-neutral-400 mb-3">
    Agrupa actividades por día. Edita nombre, hora y precio directamente en cada fila.
  </div>
  <ItineraryCanvas
    kickoff={kickoff}
    onSave={async (newCart, newDayMeta) => {
      await onSave(kickoff.id, {
        cart: newCart,
        dayMeta: newDayMeta,
        status: "concierge_editing",
      });
    }}
  />
</div>
        </div>


        <div className="px-5 py-4 border-t bg-neutral-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950"
          >
            Guardar
          </button>
          {/* Preview PDF button */}
          {kickoff?.cart?.length > 0 && (
            <a
              href={`/?mode=itinerary&kickoffId=${kickoff.id}&lang=${kickoff.lang || "en"}`}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
              title="Previsualizar itinerario como PDF"
            >
              📄 Ver PDF
            </a>
          )}
        </div>
      </div>
     
    </div>
    
    
  );
}
function ConciergePickerModal({ concierges, onClose, onSelect }) {
  return (
    <Modal
      title="Asignar concierge"
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <button type="button" onClick={() => onSelect(null)}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100">
          Sin asignar
        </button>
      }
    >
      <div className="space-y-2">
        {concierges.length === 0 ? (
          <p className="text-sm text-neutral-500 text-center py-4">
            No hay concierges en la pestaña "Concierges" del Sheet.
          </p>
        ) : (
          <div className="divide-y border rounded-xl overflow-hidden bg-white">
            {concierges.map((c) => (
              <button
                key={c.id || c.email || c.name}
                type="button"
                onClick={() => onSelect(c)}
                className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{c.name}</p>
                  {c.email && <p className="text-xs text-neutral-500">{c.email}</p>}
                </div>
                <span className="text-xs text-neutral-400">Seleccionar →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function KickoffPickerModal({ kickoffs, title, onClose, onSelect }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (kickoffs || []).filter((k) => {
      if (!query) return true;
      return [k.guestName, k.tripName, k.id, k.guestContact]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [kickoffs, q]);

  return (
    <Modal title={title || "Seleccionar cliente"} onClose={onClose} maxWidth="max-w-2xl"
      footer={
        <button type="button" onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100">
          Cancelar
        </button>
      }
    >
      <div className="space-y-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Buscar por nombre, viaje o ID..."
          autoFocus
        />
        {filtered.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-4">No hay clientes que coincidan.</p>
        ) : (
          <div className="border rounded-2xl overflow-hidden bg-white">
            <div className="max-h-[50vh] overflow-auto divide-y">
              {filtered.map((k) => (
                <button key={k.id} type="button" onClick={() => onSelect(k)}
                  className="w-full text-left px-4 py-3 hover:bg-neutral-50 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">
                      {k.guestName || "Sin nombre"}
                    </div>
                    <div className="text-[11px] text-neutral-500 truncate">
                      {k.tripName || "Sin viaje"} · {k.id}
                      {k.assignedConcierge ? ` · 👤 ${k.assignedConcierge}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <ClientTypeBadge value={k.clientType} />
                    <StatusBadge status={k.status} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* =========================================
   CreateClientModal — reemplaza el prompt() chain
   ========================================= */

function CreateClientModal({ open, onClose, onSubmit, kickoffs }) {
  const [form, setForm] = React.useState({
    guestName: "",
    tripName: "",
    guestContact: "",
    concierge: "",
    conciergeEmail: "",
    clientType: 1,
  });
  const [submitting, setSubmitting] = React.useState(false);

  // Use fixed concierge list
  const conciergeList = CONCIERGE_LIST;

  const handleConciergeChange = (e) => {
    const selectedName = e.target.value;
    const match = conciergeList.find((c) => c.name === selectedName);
    setForm((prev) => ({
      ...prev,
      concierge: selectedName,
      conciergeEmail: match ? match.email : "",
    }));
  };

  const handleField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.guestName.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(form);
      setForm({ guestName: "", tripName: "", guestContact: "", concierge: "", conciergeEmail: "", clientType: 1 });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">Nuevo cliente</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Nombre del cliente */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Nombre del cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.guestName}
              onChange={handleField("guestName")}
              placeholder="Ej: María García"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          {/* Nombre del viaje */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Nombre del viaje
            </label>
            <input
              type="text"
              value={form.tripName}
              onChange={handleField("tripName")}
              placeholder="Ej: Cartagena Junio 2025"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          {/* Contacto */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Contacto WhatsApp / email
            </label>
            <input
              type="text"
              value={form.guestContact}
              onChange={handleField("guestContact")}
              placeholder="Ej: +57 300 1234567"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            />
          </div>

          {/* Tipo de cliente */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Tipo de cliente
            </label>
            <div className="flex items-center gap-4">
              {[1, 2].map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="clientType"
                    value={t}
                    checked={form.clientType === t}
                    onChange={() => setForm((prev) => ({ ...prev, clientType: t }))}
                    className="accent-neutral-900"
                  />
                  Tipo {t}
                </label>
              ))}
            </div>
          </div>

          {/* Concierge dropdown */}
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">
              Concierge asignado
            </label>
            <select
              value={form.concierge}
              onChange={handleConciergeChange}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            >
              <option value="">Sin asignar</option>
              {conciergeList.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}{c.city ? ` · ${c.city}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Email del concierge — solo si hay nombre */}
          {form.concierge && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Email del concierge
              </label>
              <input
                type="email"
                value={form.conciergeEmail}
                onChange={handleField("conciergeEmail")}
                placeholder="concierge@empresa.com"
                className="w-full border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !form.guestName.trim()}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950 disabled:opacity-50"
          >
            {submitting ? "Creando..." : "Crear y abrir link"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientTypePickerModal({ onClose, onSelect }) {
  const [value, setValue] = useState(1);

  return (
    <Modal
      title="Seleccionar tipo de cliente"
      onClose={onClose}
      maxWidth="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onSelect(value)}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950"
          >
            Continuar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="text-[11px] text-neutral-500">Tipo de cliente</label>
        <select
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value={1}>Tipo 1</option>
          <option value={2}>Tipo 2</option>
        </select>
      </div>
    </Modal>
  );
}

/* =========================================
   Componente principal
   ========================================= */

export default function ConciergePanel() {
  
  const [kickoffs, setKickoffs] = useState([]);
  const [selectedKickoffForLink, setSelectedKickoffForLink] = useState(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conciergeFilter, setConciergeFilter] = useState("all");

  const [selectedForSummary, setSelectedForSummary] = useState(null);
  const [selectedForEdit, setSelectedForEdit] = useState(null);
  const [selectedForDelete, setSelectedForDelete] = useState(null);
  const [rowLoadingId, setRowLoadingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
const [clientTypePickerOpen, setClientTypePickerOpen] = useState(false);
const [pendingLinkKind, setPendingLinkKind] = useState(null); // "catalog" | "questionnaire" | "feedback"
const [feedbackPickerOpen, setFeedbackPickerOpen] = useState(false);
const [ratingModalKickoff, setRatingModalKickoff] = useState(null); // kickoff pending rating before link is shared
const [portalLang, setPortalLang] = useState("en"); // language for client-facing links
const [createModalOpen, setCreateModalOpen] = useState(false);
const [openMenuId, setOpenMenuId] = useState(null); // row actions dropdown
const [showRatings, setShowRatings] = useState(false); // ratings summary panel
  const normalizeId = (obj) =>
  obj?.id || obj?.kickoffId || obj?.ID || obj?._id || "";

const loadKickoffs = async () => {
  setLoading(true);
  setLoadError("");

  try {
    const data = await fetchKickoffsFromSheet();

    const arr = (data || []).map((k, idx) => {
      const id = normalizeId(k);
      const safeId = String(id || `row-${idx}`);

      const rawCart = k?.cart ?? k?.Cart ?? k?.itinerary ?? [];
      const cart = Array.isArray(rawCart)
        ? rawCart
        : (() => { try { return JSON.parse(rawCart) || []; } catch { return []; } })();

      return {
        ...k,
        id: safeId,
        createdAt: k?.createdAt || k?.CreatedAt || k?.timestamp || new Date().toISOString(),
        clientType: String(k?.clientType || "").toLowerCase().includes("2") ? 2 : 1,
        guestContact: String(
          k?.guestContact || k?.GuestContact || k?.guest_contact ||
          k?.contact || k?.Contact || k?.contacto || k?.Contacto || ""
        ).trim(),
        assignedConcierge: String(k?.assignedConcierge || k?.AssignedConcierge || k?.concierge || "").trim(),
        cart,
      };
    });

    setKickoffs(arr);

    setSelectedKickoffForLink((prev) => {
  if (!prev) return null;
  const stillExists = arr.find((x) => x.id === prev.id);
  return stillExists || null;
});
  } catch (err) {
    console.error("LOAD KICKOFFS ERROR:", err);
    setLoadError(err?.message || String(err) || "Error cargando kick-offs");
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    loadKickoffs();
  }, []);
  const handleCreateAndOpenLink = async (form) => {
    const {
      guestName,
      tripName,
      guestContact,
      concierge: assignedConciergeName,
      conciergeEmail: assignedConciergeEmail,
      clientType,
    } = form;

    const kickoffId = `ko_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const created = await saveKickoffToSheet({
      id: kickoffId,
      guestName,
      tripName,
      guestContact,
      clientType,
      assignedConcierge: assignedConciergeName,
      assignedConciergeName,
      assignedConciergeEmail,
      createdAt: new Date().toISOString(),
      status: "new",
      conciergeSummary: "",
      travifyText: "",
      internalNotes: "",
      cart: [],
    });

    const kickoff = {
      ...created,
      id: created?.id || kickoffId,
      guestName,
      tripName,
      guestContact,
      clientType,
      assignedConcierge: assignedConciergeName,
      assignedConciergeName,
      assignedConciergeEmail,
    };

    setKickoffs((prev) => [kickoff, ...(prev || [])]);
    setSelectedKickoffForLink(kickoff);

    // Capture pendingLinkKind before clearing it
    const linkKind = pendingLinkKind;
    setCreateModalOpen(false);
    setPendingLinkKind(null);

    const link =
      linkKind === "questionnaire"
        ? buildQuestionnaireLink(kickoff, clientType, portalLang)
        : linkKind === "feedback"
        ? buildFeedbackLink(kickoff, clientType, portalLang)
        : buildCatalogLink(kickoff, clientType, portalLang);

    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // fallback: just open the link
    }

    window.open(link, "_blank", "noopener,noreferrer");
  };

  // Use fixed concierge list for the filter dropdown
  const conciergeOptions = useMemo(() => {
    return ["all", ...CONCIERGE_LIST.map((c) => c.name)];
  }, []);

  const filteredKickoffs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (kickoffs || [])
      .filter((k) => {
        if (statusFilter !== "all" && k.status !== statusFilter) return false;
        if (conciergeFilter !== "all" && String(k.assignedConcierge || "").trim() !== conciergeFilter) return false;

        if (!q) return true;
        const text = [
          k.id,
          k.guestName,
          k.tripName,
          k.assignedConcierge,
          k.conciergeSummary,
          k.travifyText,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return text.includes(q);
      })
      .sort((a, b) => {
        const da = new Date(a.createdAt || 0).getTime();
        const db = new Date(b.createdAt || 0).getTime();
        return db - da;
      });
  }, [kickoffs, search, statusFilter, conciergeFilter]);

  // Updates kickoff locally + in sheet but does NOT close the drawer
  const handleSilentUpdate = async (id, updates) => {
    try {
      await updateKickoffInSheet(id, updates);
      setKickoffs((prev) =>
        prev.map((k) => {
          if (k.id !== id) return k;
          const next = { ...k, ...updates };
          if ("guestContact" in updates && String(updates.guestContact || "").trim() === "") {
            next.guestContact = k.guestContact || "";
          }
          return next;
        })
      );
    } catch (err) {
      console.error("Silent update failed:", err);
    }
  };

  const handleSaveEdit = async (id, updates) => {
  try {
    setRowLoadingId(id);
    await updateKickoffInSheet(id, updates);

    setKickoffs((prev) =>
      prev.map((k) => {
        if (k.id !== id) return k;

        const next = { ...k, ...updates };
        if ("guestContact" in updates && String(updates.guestContact || "").trim() === "") {
          next.guestContact = k.guestContact || "";
        }
        return next;
      })
    );

    setSelectedForEdit(null);
  } catch (err) {
    console.error(err);
    alert("No se pudieron guardar los cambios.");
  } finally {
    setRowLoadingId(null);
  }
};

  const handleConfirmDelete = async () => {
  if (!selectedForDelete) return;
  const id = selectedForDelete.id;

  try {
    setDeleting(true);
    await deleteKickoff(id);

    setKickoffs((prev) => {
      const next = prev.filter((k) => k.id !== id);

      setSelectedKickoffForLink((curr) => {
  if (!curr) return null;
  if (curr.id !== id) return curr;
  return null;
});

      return next;
    });

    setSelectedForDelete(null);
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar el kick-off.");
  } finally {
    setDeleting(false);
  }
};

  const cp = {
    es: {
      subtitle: "Gestión interna de kick-offs enviados desde el catálogo.",
      refresh: "Refrescar", refreshing: "Actualizando...",
      search: "Buscar por huésped, viaje, ID...",
      filterStatus: "Estado:", filterConcierge: "Concierge:",
      all: "Todos",
      colGuest: "Huésped", colTrip: "Viaje", colType: "Tipo",
      colContact: "Contacto", colCreated: "Creado",
      colConcierge: "Concierge", colStatus: "Estado", colActions: "Acciones",
      loading: "Cargando kick-offs...",
      empty: "No hay kick-offs que coincidan con el filtro.",
      linkCatalog: "Link catálogo", linkFeedback: "Link feedback",
    },
    en: {
      subtitle: "Internal kick-off management — sent from the catalog.",
      refresh: "Refresh", refreshing: "Refreshing...",
      search: "Search by guest, trip, ID...",
      filterStatus: "Status:", filterConcierge: "Concierge:",
      all: "All",
      colGuest: "Guest", colTrip: "Trip", colType: "Type",
      colContact: "Contact", colCreated: "Created",
      colConcierge: "Concierge", colStatus: "Status", colActions: "Actions",
      loading: "Loading kick-offs...",
      empty: "No kick-offs match the current filter.",
      linkCatalog: "Catalog link", linkFeedback: "Feedback link",
    },
  }[portalLang];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="font-semibold text-lg">Concierge Panel</h1>
          <p className="text-[11px] text-neutral-500">{cp.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">

  {/* Language toggle — controls language of catalog/questionnaire links */}
  <button
    type="button"
    onClick={() => setPortalLang(l => l === "en" ? "es" : "en")}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 font-medium"
    title="Idioma del catálogo que verá el cliente (no cambia este portal)"
  >
    {portalLang === "en" ? "🇺🇸 Links EN · UI EN" : "🇨🇴 Links ES · UI ES"}
  </button>

  <a
    href="?mode=dashboard"
    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
  >
    Dashboard
  </a>

  <button
    onClick={loadKickoffs}
    disabled={loading}
    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-50"
  >
    <RefreshCcw className="w-4 h-4" />
    {loading ? cp.refreshing : cp.refresh}
  </button>

  {/* BOTÓN LINK CUESTIONARIO */}
<button
  type="button"
  onClick={async () => {
  if (!selectedKickoffForLink) {
    setPendingLinkKind("questionnaire");
    setCreateModalOpen(true);
    return;
  }

  const kickoff = await ensureKickoffReady(
    selectedKickoffForLink,
    setKickoffs,
    setSelectedKickoffForLink
  );
  if (!kickoff) return;

  const link = buildQuestionnaireLink(kickoff, kickoff.clientType || 1, portalLang);

  try {
    await navigator.clipboard.writeText(link);
  } catch {
    prompt("Copia este link:", link);
  }

  window.open(link, "_blank", "noopener,noreferrer");
}}
  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
>
  <LinkIcon className="w-4 h-4" />
  Link cuestionario
</button>


  {/* BOTÓN LINK CATÁLOGO */}
  <button
  type="button"
  onClick={async () => {
  if (!selectedKickoffForLink) {
    setPendingLinkKind("catalog");
    setCreateModalOpen(true);
    return;
  }

  const kickoff = await ensureKickoffReady(
    selectedKickoffForLink,
    setKickoffs,
    setSelectedKickoffForLink
  );
  if (!kickoff) return;

  const link = buildCatalogLink(kickoff, kickoff.clientType || 1, portalLang);

  try {
    await navigator.clipboard.writeText(link);
  } catch {
    prompt("Copia este link:", link);
  }

  window.open(link, "_blank", "noopener,noreferrer");
}}
  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
>
  <ListIcon className="w-4 h-4" />
  {cp.linkCatalog}
</button>
<button
  type="button"
  onClick={() => {
    setFeedbackPickerOpen(true);
  }}
  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
>
  <LinkIcon className="w-4 h-4" />
  {cp.linkFeedback}
</button>

<a
  href="/?mode=soporte-dashboard"
  target="_blank"
  rel="noreferrer"
  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-neutral-700"
>
  🛠 Soporte
</a>

</div>


      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              className="w-full pl-7 pr-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              placeholder={cp.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">{cp.filterStatus}</span>
              <select
                className="border rounded-lg px-2.5 py-1.5 bg-white text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">{cp.all}</option>
                <option value="new">{statusLabel("new", portalLang)}</option>
                <option value="client_submitted">{statusLabel("client_submitted", portalLang)}</option>
                <option value="concierge_editing">{statusLabel("concierge_editing", portalLang)}</option>
                <option value="sent_to_travify">{statusLabel("sent_to_travify", portalLang)}</option>
                <option value="feedback_submitted">{statusLabel("feedback_submitted", portalLang)}</option>
                <option value="done">{statusLabel("done", portalLang)}</option>
              </select>
            </div>

            {conciergeOptions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">{cp.filterConcierge}</span>
                <select
                  className="border rounded-lg px-2.5 py-1.5 bg-white text-xs"
                  value={conciergeFilter}
                  onChange={(e) => setConciergeFilter(e.target.value)}
                >
                  {conciergeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c === "all" ? cp.all : (() => {
                        const found = CONCIERGE_LIST.find(x => x.name === c);
                        return found ? `${found.name} · ${found.city}` : c;
                      })()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ── Ratings summary toggle ── */}
        <div>
          <button
            onClick={() => setShowRatings(v => !v)}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium py-1"
          >
            ⭐ {showRatings ? "Ocultar resumen de ratings" : "Ver resumen de ratings"}
          </button>

          {showRatings && (() => {
            const rated = kickoffs.filter(k => Number(k.conciergeRating) > 0);
            const total = rated.length;
            const avg   = total ? (rated.reduce((s, k) => s + Number(k.conciergeRating), 0) / total).toFixed(1) : "—";

            // Group by concierge
            const byC = {};
            rated.forEach(k => {
              const name = k.assignedConcierge || k.assignedConciergeName || "Sin asignar";
              if (!byC[name]) byC[name] = [];
              byC[name].push(Number(k.conciergeRating));
            });
            const conciergeRows = Object.entries(byC)
              .map(([name, ratings]) => ({
                name,
                count: ratings.length,
                avg: (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1),
                dist: [1,2,3,4,5].map(n => ratings.filter(r => r === n).length),
              }))
              .sort((a, b) => b.avg - a.avg);

            return (
              <div className="mt-2 bg-white border border-amber-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-500">{avg}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">Promedio global</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-neutral-700">{total}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">Trips calificados</div>
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    {[5,4,3,2,1].map(n => {
                      const cnt = rated.filter(k => Number(k.conciergeRating) === n).length;
                      const pct = total ? Math.round((cnt / total) * 100) : 0;
                      return (
                        <div key={n} className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] w-3 text-right text-neutral-500">{n}</span>
                          <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[10px] text-neutral-400 w-6">{cnt}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {conciergeRows.length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-neutral-400 uppercase border-b border-neutral-100">
                        <th className="text-left pb-1 font-medium">Concierge</th>
                        <th className="text-center pb-1 font-medium">Trips</th>
                        <th className="text-center pb-1 font-medium">Promedio</th>
                        <th className="text-left pb-1 font-medium pl-3">Distribución</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conciergeRows.map(row => (
                        <tr key={row.name} className="border-b border-neutral-50 last:border-0">
                          <td className="py-1.5 text-neutral-700 font-medium">{row.name.split(" ").slice(0,2).join(" ")}</td>
                          <td className="py-1.5 text-center text-neutral-500">{row.count}</td>
                          <td className="py-1.5 text-center font-bold text-amber-500">{row.avg} ⭐</td>
                          <td className="py-1.5 pl-3 flex gap-0.5 items-end h-6">
                            {row.dist.map((cnt, i) => {
                              const h = row.count ? Math.round((cnt / row.count) * 20) + 2 : 2;
                              return <div key={i} style={{ height: h }} className="w-2.5 bg-amber-300 rounded-sm" title={`${i+1}★: ${cnt}`} />;
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })()}
        </div>

        {loadError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {loadError}
          </div>
        )}

        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {["ID", cp.colGuest, cp.colTrip, cp.colType, cp.colContact, cp.colCreated, cp.colConcierge, cp.colStatus].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                  ))}
                  <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{cp.colActions}</th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      {cp.loading}
                    </td>
                  </tr>
                )}

                {!loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      {cp.empty}
                    </td>
                  </tr>
                )}

                {filteredKickoffs.map((k) => (
                  <tr
  key={k.id}

  onClick={() => setSelectedKickoffForLink(k)}
  className={
    "border-t border-neutral-100 hover:bg-neutral-50/70 cursor-pointer " +
    (selectedKickoffForLink?.id === k.id ? "bg-neutral-100" : "")
  }
   
>


                    <td className="px-4 py-2 text-xs text-neutral-700 font-mono">
  {k.id}
</td>

<td className="px-4 py-2 text-sm text-neutral-700">
  {k.guestName || "Sin nombre"}
</td>
<td className="px-4 py-2 text-sm text-neutral-700">
  {k.tripName || "Sin título"}
</td>

<td className="px-4 py-2">
  <select
  value={String(k.clientType).includes("2") ? 2 : 1}
  onClick={(e) => e.stopPropagation()}
  onChange={async (e) => {
  const newType = Number(e.target.value);

  const updatedCart = (k.cart || []).map((item) => {
  const base = Number(item.base_price_cop || item.price_cop || 0);
  const t1 = Number(item.price_tier_1 || 0);
  const t2 = Number(item.price_tier_2 || 0);

  // 👇 si NO tiene tiers → NO tocar precio
  if (!t1 && !t2) {
    return item;
  }

  return {
    ...item,
    price_cop: newType === 2 ? (t2 || base) : (t1 || base),
  };
});

  await updateKickoffInSheet(k.id, {
    clientType: newType,
    cart: updatedCart,
  });

  setKickoffs((prev) =>
    prev.map((item) =>
      item.id === k.id
        ? { ...item, clientType: newType, cart: updatedCart }
        : item
    )
  );
}}
  className="border rounded-lg px-2 py-1 text-xs bg-white"
>
  <option value={1}>Tipo 1</option>
  <option value={2}>Tipo 2</option>
</select>
</td>
<td className="px-4 py-2 text-xs text-neutral-700">
  {k.guestContact || <span className="italic text-neutral-400">—</span>}
</td>

<td className="px-4 py-2 text-xs text-neutral-700">
  {formatDateTime(k.createdAt)}
</td>

<td className="px-4 py-2 text-xs text-neutral-700">
  {k.assignedConcierge || <span className="text-neutral-400 italic">—</span>}
</td>

<td className="px-4 py-2">
  <StatusBadge status={k.status} lang={portalLang} />
  {k.conciergeRating > 0 && (
    <div className="mt-0.5 text-[11px] text-amber-500 font-medium leading-none">
      {"★".repeat(Number(k.conciergeRating))}{"☆".repeat(5 - Number(k.conciergeRating))}
    </div>
  )}
</td>

<td className="px-4 py-2 text-right">
  <div className="inline-flex items-center gap-1.5" onClick={e => e.stopPropagation()}>

    {/* Primary: Editar */}
    <button
      onClick={() => setSelectedForEdit(k)}
      className="px-2.5 py-1 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition"
    >
      Editar
    </button>

    {/* Primary: Feedback */}
    <button
      onClick={() => setRatingModalKickoff(k)}
      className="px-2.5 py-1 border border-amber-200 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition"
    >
      ★ Feedback
    </button>

    {/* ⋯ More actions dropdown */}
    <div className="relative">
      <button
        onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)}
        className="px-2 py-1 border border-neutral-200 rounded-lg text-xs text-neutral-500 hover:bg-neutral-50 transition"
      >
        ⋯
      </button>
      {openMenuId === k.id && (
        <div
          className="absolute right-0 top-full mt-1 z-50 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 min-w-[170px]"
          onMouseLeave={() => setOpenMenuId(null)}
        >
          <button
            onClick={() => { setOpenMenuId(null); setSelectedForSummary(k); }}
            className="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            👁 Ver resumen
          </button>
          <button
            onClick={async () => {
              setOpenMenuId(null);
              const link = buildCatalogLink(k, Number(k.clientType ?? 1));
              try { await navigator.clipboard.writeText(link); alert("Link de catálogo copiado ✅"); }
              catch { prompt("Copia este link:", link); }
            }}
            className="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            📋 Copiar catálogo
          </button>
          <button
            onClick={async () => {
              setOpenMenuId(null);
              const link = buildQuestionnaireLink(k, Number(k.clientType ?? 1));
              try { await navigator.clipboard.writeText(link); alert("Link de cuestionario copiado ✅"); }
              catch { prompt("Copia este link:", link); }
            }}
            className="w-full text-left px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            📝 Copiar cuestionario
          </button>
          <div className="border-t border-neutral-100 my-1"/>
          <button
            onClick={() => { setOpenMenuId(null); setSelectedForDelete(k); }}
            className="w-full text-left px-4 py-2 text-xs text-red-500 hover:bg-red-50"
          >
            🗑 Eliminar
          </button>
        </div>
      )}
    </div>

  </div>
</td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {selectedForSummary && (
        <SummaryModal
          kickoff={selectedForSummary}
          onClose={() => setSelectedForSummary(null)}
        />
      )}

      {selectedForEdit && (
        <EditDrawer
          kickoff={selectedForEdit}
          onClose={() => setSelectedForEdit(null)}
          onSave={handleSaveEdit}
          onSilentUpdate={handleSilentUpdate}
        />
      )}

      {selectedForDelete && (
        <ConfirmDeleteModal
          kickoff={selectedForDelete}
          onCancel={() => setSelectedForDelete(null)}
          onConfirm={handleConfirmDelete}
          loading={deleting}
        />
      )}
      {clientTypePickerOpen && (
        <ClientTypePickerModal
          onClose={() => { setClientTypePickerOpen(false); setPendingLinkKind(null); }}
          onSelect={async (type) => {
            setClientTypePickerOpen(false);
            setPendingLinkKind(null);
          }}
        />
      )}

      <CreateClientModal
        open={createModalOpen}
        onClose={() => { setCreateModalOpen(false); setPendingLinkKind(null); }}
        onSubmit={handleCreateAndOpenLink}
        kickoffs={kickoffs}
      />

      {feedbackPickerOpen && (
        <KickoffPickerModal
          kickoffs={kickoffs}
          title="Seleccionar cliente para link de feedback"
          onClose={() => setFeedbackPickerOpen(false)}
          onSelect={(k) => {
            setFeedbackPickerOpen(false);
            setRatingModalKickoff(k);
          }}
        />
      )}

      {/* ── Concierge rating modal — appears before sharing feedback link ── */}
      {ratingModalKickoff && (
        <ConciergeRatingModal
          kickoff={ratingModalKickoff}
          onClose={() => setRatingModalKickoff(null)}
          onSave={async (rating) => {
            const k = ratingModalKickoff;
            setRatingModalKickoff(null);

            // Save rating to sheet
            try {
              await updateKickoffInSheet(k.id, { conciergeRating: rating });
              setKickoffs(prev =>
                prev.map(item => item.id === k.id ? { ...item, conciergeRating: rating } : item)
              );
            } catch (err) {
              console.warn("Could not save concierge rating:", err);
            }

            // Copy + open the feedback link
            const link = buildFeedbackLink(k, Number(k.clientType ?? 1), portalLang);
            try {
              await navigator.clipboard.writeText(link);
            } catch {
              prompt("Copia este link:", link);
            }
            window.open(link, "_blank", "noopener,noreferrer");
          }}
        />
      )}

    </div>
  );


}
