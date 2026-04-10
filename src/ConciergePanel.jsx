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
   Estados
   ========================================= */

const STATUS_LABELS = {
  new: "Nuevo",
  client_submitted: "Cliente llenó selección",
  concierge_editing: "Concierge editando",
  sent_to_travify: "Enviado a Travefy",
  feedback_submitted: "Cliente llenó feedback",
  done: "Cerrado",
};

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


function StatusBadge({ status }) {
  const s = String(status || "").trim().toLowerCase();

  const normalized =
  s === "nuevo" ? "new" :
  s === "cliente llenó selección" ? "client_submitted" :
  s === "concierge editando" ? "concierge_editing" :
  s === "enviado" ? "sent_to_travify" :
  s === "cerrado" ? "done" :
  // compatibilidad con viejos:
  s === "in-progress" ? "concierge_editing" :
  s === "sent" ? "sent_to_travify" :
  status;


  const label = STATUS_LABELS[normalized] || normalized || "—";
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
  url.searchParams.set("lang", kickoff?.lang || lang);
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
  url.searchParams.set("lang", kickoff?.lang || lang);

  url.searchParams.set("guestName", kickoff?.guestName || "");
  url.searchParams.set("tripName", kickoff?.tripName || "");
  url.searchParams.set("guestContact", kickoff?.guestContact || "");

  return url.toString();
}

function buildQuestionnaireLink(kickoff, clientType = 1, lang = "en") {
  const base = window.location.origin;
  const url = new URL("/", base);
  url.searchParams.set("mode", "questionnaire");
  url.searchParams.set("kickoffId", kickoff?.id || "");
  url.searchParams.set("clientType", String(clientType));
  url.searchParams.set("lang", kickoff?.lang || lang);
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
function ItineraryEditor({ kickoff, onSave }) {
  const [services, setServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);

  const [cart, setCart] = useState(kickoff?.cart || []);
  const [saving, setSaving] = useState(false);

  // refresca si cambias de kickoff
  useEffect(() => {
    setCart(kickoff?.cart || []);
  }, [kickoff?.id]);

  // carga catálogo para "Desde catálogo"
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingServices(true);
        const { fetchServicesFromSheet } = await import("./sheetServices");
        const data = await fetchServicesFromSheet();
        if (alive) setServices(data || []);
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoadingServices(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const updateItem = (idx, patch) => {
    setCart((prev) => {
      const next = [...(prev || [])];
      next[idx] = { ...(next[idx] || {}), ...patch };
      return next;
    });
  };

  const removeItem = (idx) => {
    setCart((prev) => (prev || []).filter((_, i) => i !== idx));
  };

  const addManual = () => {
    setCart((prev) => [mapManualToCartItem(), ...(prev || [])]);
  };

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);

const addFromCatalog = () => {
  if (loadingServices) return;
  if (!services?.length) return alert("No hay servicios cargados aún.");
  setCatalogModalOpen(true);
};

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(cart);
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el itinerario.");
    } finally {
      setSaving(false);
    }
  };

  if (!kickoff) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-neutral-900">
            Ítems del itinerario
          </div>
          <div className="text-[11px] text-neutral-500">
            Ajusta nombre, precio, día/horario y notas de cada experiencia.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={addManual}
            className="px-3 py-2 rounded-lg border border-neutral-300 text-xs hover:bg-neutral-100"
          >
            + Ítem manual
          </button>

          <button
            type="button"
            onClick={addFromCatalog}
            disabled={loadingServices}
            className="px-3 py-2 rounded-lg border border-neutral-300 text-xs hover:bg-neutral-100 disabled:opacity-60"
            title={loadingServices ? "Cargando catálogo..." : "Agregar desde catálogo"}
          >
            + Desde catálogo
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs hover:bg-neutral-950 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar itinerario"}
          </button>
        </div>
      </div>

      {(cart || []).length === 0 ? (
        <div className="text-xs text-neutral-500 border rounded-xl p-3 bg-neutral-50">
          No hay ítems todavía. Agrega con “Ítem manual” o “Desde catálogo”.
        </div>
      ) : (
        <div className="space-y-3">
          {cart.map((it, idx) => (
            <div key={`${it.id || idx}`} className="border rounded-2xl p-4 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] text-neutral-500">Ítem #{idx + 1}</div>
                  <div className="text-sm font-semibold text-neutral-900 truncate">
                    {(it.displayName || it.name || "Servicio").trim()}
                  </div>
                  <div className="text-[11px] text-neutral-500">
                    {it.category || "—"}
                    {it.priceUnit ? ` · ${it.priceUnit}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  className="text-xs text-red-600 hover:bg-red-50 border border-red-200 px-3 py-2 rounded-lg"
                >
                  Quitar del itinerario
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-500">Nombre para el huésped</label>
                  <input
                    value={it.displayName || ""}
                    onChange={(e) => updateItem(idx, { displayName: e.target.value })}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={it.name || "Nombre visible"}
                  />
                </div>

                <div>
                  <label className="text-[11px] text-neutral-500">Precio referencia (COP)</label>
                  <input
                    type="number"
                    value={it.priceOverride_cop ?? ""}
                    onChange={(e) =>
                      updateItem(idx, {
                        priceOverride_cop: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder={String(it.price_cop || 0)}
                  />
                  <div className="text-[10px] text-neutral-400 mt-1">
                    Vacío = usa precio del catálogo (
                    {new Intl.NumberFormat("es-CO").format(Number(it.price_cop || 0))} COP)
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-500">Día / fecha sugerida</label>
                  <input
                    value={it.dayLabel || ""}
                    onChange={(e) => updateItem(idx, { dayLabel: e.target.value })}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Ej: Día 1 – tarde / 12 mar"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-neutral-500">Horario sugerido</label>
                  <input
                    value={it.timeLabel || ""}
                    onChange={(e) => updateItem(idx, { timeLabel: e.target.value })}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Ej: 7:30 p.m."
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[11px] text-neutral-500">Notas para este servicio</label>
                  <textarea
                    value={it.notes || ""}
                    onChange={(e) => updateItem(idx, { notes: e.target.value })}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
                    placeholder="Mesa terraza, alergias, prepago, etc."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ✅ MODAL AQUÍ (al final del return) */}
      {catalogModalOpen && (
  <CatalogPickerModal
    services={services}
    clientType={kickoff?.clientType || 1}
    onClose={() => setCatalogModalOpen(false)}
    onPick={(svc) => {
  const clientType = kickoff?.clientType || 1; // o el clientType leído de la URL en el portal cliente
  setCart((prev) => [mapServiceToCartItem(svc, clientType), ...(prev || [])]);
  setCatalogModalOpen(false);
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
          <div className="text-right">
            <p className="text-[11px] text-neutral-500">Creado</p>
            <p className="text-neutral-900 text-xs sm:text-sm">
              {formatDateTime(kickoff.createdAt)}
            </p>
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

    const clientType = window.confirm("¿Cliente Tipo 2? (OK = Sí, Cancel = Tipo 1)") ? 2 : 1;

const kickoffId = `ko_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const created = await saveKickoffToSheet({
      id: kickoffId,
      guestName,
      tripName,
      guestContact,
      clientType,
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

function CatalogPickerModal({ services, clientType = 1, onClose, onPick }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(() => {
    const set = new Set(
      (services || [])
        .map((s) => String(s.category || "").trim())
        .filter(Boolean)
    );
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [services]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (services || [])
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
  }, [services, q, category]);

  return (
    <Modal
      title="Agregar desde Catálogo"
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
  const [travefyResult, setTravefyResult] = useState(null);
  const [travefySending, setTravefySending] = useState(false);

  // Cover / trip-level fields for Travefy document
  const [tripDates,          setTripDates]          = useState(kickoff?.tripDates          || "");
  const [city,               setCity]               = useState(kickoff?.city               || "");
  const [groupSize,          setGroupSize]          = useState(kickoff?.groupSize          || "");
  const [conciergeTitle,     setConciergeTitle]     = useState(kickoff?.conciergeTitle     || "");
  const [accommodationName,  setAccommodationName]  = useState(kickoff?.accommodationName  || "");
  const [accommodationAddr,  setAccommodationAddr]  = useState(kickoff?.accommodationAddr  || "");
  const [checkIn,            setCheckIn]            = useState(kickoff?.checkIn            || "");
  const [checkOut,           setCheckOut]           = useState(kickoff?.checkOut           || "");

  if (!kickoff) return null;

  const handleSave = async () => {
  // Auto-advance status when concierge saves from "new" or "client_submitted"
  const autoStatus =
    status === "new" || status === "client_submitted"
      ? "concierge_editing"
      : status;

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
                <option value="new">{STATUS_LABELS.new}</option>
                <option value="client_submitted">{STATUS_LABELS.client_submitted}</option>
                <option value="concierge_editing">{STATUS_LABELS.concierge_editing}</option>
                <option value="sent_to_travify">{STATUS_LABELS.sent_to_travify}</option>
                <option value="feedback_submitted">{STATUS_LABELS.feedback_submitted}</option>
                <option value="done">{STATUS_LABELS.done}</option>
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

          {/* ── Travefy Cover Info ─────────────────────────────── */}
          <div className="border rounded-2xl p-4 bg-neutral-50 space-y-3">
            <p className="text-xs font-semibold text-neutral-700">Portada del documento (Travefy)</p>
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
            </div>
          </div>

          {/* ITINERARIO */}
<div className="border rounded-2xl p-4 bg-white">
  <div className="text-sm font-semibold text-neutral-900">Itinerario</div>
  <div className="text-[11px] text-neutral-500">
    Agrega ítems manuales o desde catálogo y guarda.
  </div>

  <div className="mt-3">
    <ItineraryEditor
      kickoff={kickoff}
      onSave={async (newCart) => {
        await onSave(kickoff.id, {
          cart: newCart,
          status: "concierge_editing",
        });
      }}
    />
  </div>
</div>
        </div>

        {/* Travefy result */}
        {travefyResult && (
          <div className={`mx-5 mb-2 rounded-xl p-4 text-sm border ${travefyResult.ok ? "bg-purple-50 border-purple-200 text-purple-900" : "bg-red-50 border-red-200 text-red-800"}`}>
            {travefyResult.ok ? (
              <>
                <p className="font-semibold mb-1">✅ {travefyResult.data?.message || "Enviado a Travefy"}</p>

                {/* Share link */}
                {travefyResult.data?.shareUrl && (
                  <a href={travefyResult.data.shareUrl} target="_blank" rel="noreferrer"
                    className="block text-xs text-purple-700 underline break-all mb-2">
                    {travefyResult.data.shareUrl}
                  </a>
                )}

                {/* Counts */}
                <p className="text-xs text-purple-700 mb-2">
                  <span className="font-medium">{travefyResult.data?.matchedServicesCount ?? 0}</span> servicios
                  {" · "}
                  <span className="font-medium">{travefyResult.data?.itemCount ?? 0}</span> items en itinerario
                  {(travefyResult.data?.unmatchedServicesCount ?? 0) > 0 &&
                    <span className="text-orange-600"> · ⚠️ {travefyResult.data.unmatchedServicesCount} sin match</span>}
                </p>

                {/* Itinerary summary */}
                {(travefyResult.data?.summaryLines || []).length > 0 && (
                  <div className="mb-2 bg-white/60 rounded-lg p-2">
                    <p className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide mb-1">Itinerario generado</p>
                    <ul className="space-y-0.5">
                      {travefyResult.data.summaryLines.map((line, i) => (
                        <li key={i} className="text-xs text-purple-800 flex gap-1">
                          <span className="text-purple-400 shrink-0">•</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Structure result */}
                {travefyResult.data?._structure && (
                  <div className="mt-2 text-[10px] font-mono bg-purple-100/60 rounded px-2 py-1.5 text-purple-700">
                    {travefyResult.data._structure.daysAccepted
                      ? `✅ TripDays aceptados (${travefyResult.data._structure.daysCount} días · ${travefyResult.data._structure.eventsInFirstDay} eventos en día 1)`
                      : "⚠️ TripDays no devueltos — revisa el trip en Travefy para confirmar"}
                  </div>
                )}

                {/* Unmatched services */}
                {(travefyResult.data?.unmatchedServices || []).length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {travefyResult.data.unmatchedServices.map((u, i) => (
                      <li key={i} className="text-xs bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-orange-800">
                        <span className="font-semibold">{u.name || "?"}</span>
                        <span className="text-orange-600"> [{u.decision || "unknown"}]</span>
                        {u.reason && <span className="block text-orange-500 mt-0.5">{u.reason}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="font-semibold">❌ {travefyResult.error}</p>
            )}
          </div>
        )}

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
          <button
  type="button"
  disabled={travefySending || !(kickoff?.cart?.length)}
  title={!(kickoff?.cart?.length) ? "Agrega servicios al itinerario antes de enviar" : `Enviar ${kickoff.cart.length} servicio(s) a Travefy`}
  onClick={async () => {
    setTravefySending(true);
    setTravefyResult(null);
    try {
      const res = await fetch("/api/travefy-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kickoffId:         kickoff.id,
          guestName,
          tripName,
          guestContact,
          lang:              kickoff.lang || "en",
          cart:              kickoff.cart || [],
          conciergeSummary,
          internalNotes,
          conciergeName:     assignedConcierge,
          conciergeEmail:    assignedConciergeEmail,
          // Cover / trip-level fields
          tripDates,
          city,
          groupSize,
          conciergeTitle,
          accommodationName,
          accommodationAddr,
          checkIn,
          checkOut,
        }),
      });

      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      console.log("Travefy response:", data);

      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);

      setStatus("sent_to_travify");
      setTravefyResult({ ok: true, data });
      // Update status without closing drawer
      try {
        await (onSilentUpdate || onSave)(kickoff.id, { status: "sent_to_travify" });
      } catch (e) {
        console.warn("Status update failed:", e);
      }
    } catch (err) {
      console.error("Error frontend:", err);
      setTravefyResult({ ok: false, error: err.message || "Error enviando a Travefy" });
    } finally {
      setTravefySending(false);
    }
  }}
  className="px-4 py-2 rounded-lg bg-purple-600 text-sm text-white hover:bg-purple-700 disabled:opacity-60"
>
  {travefySending ? "Enviando..." : `Enviar a Travefy${kickoff?.cart?.length ? ` (${kickoff.cart.length})` : ""}`}
</button>
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
  const handleCreateAndOpenLink = async (clientType) => {
    const guestName = (prompt("Nombre del cliente:") || "").trim();
    if (!guestName) return;

    const tripName = (prompt("Nombre del viaje:") || "").trim();
    const guestContact = (prompt("Contacto (WhatsApp o email):") || "").trim();
    const assignedConciergeName = (prompt("Nombre del concierge asignado (opcional):") || "").trim();
    const assignedConciergeEmail = assignedConciergeName
      ? (prompt(`Email de ${assignedConciergeName} (opcional):`) || "").trim()
      : "";

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

    const link =
      pendingLinkKind === "questionnaire"
        ? buildQuestionnaireLink(kickoff, clientType)
        : pendingLinkKind === "feedback"
        ? buildFeedbackLink(kickoff, clientType)
        : buildCatalogLink(kickoff, clientType);

    try {
      await navigator.clipboard.writeText(link);
    } catch {
      prompt("Copia este link:", link);
    }

    window.open(link, "_blank", "noopener,noreferrer");
  };

  const conciergeOptions = useMemo(() => {
    const names = new Set(
      (kickoffs || [])
        .map((k) => String(k.assignedConcierge || "").trim())
        .filter(Boolean)
    );
    return ["all", ...Array.from(names).sort((a, b) => a.localeCompare(b))];
  }, [kickoffs]);

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


  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="h-14 border-b bg-white flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="font-semibold text-lg">Concierge Panel</h1>
          <p className="text-[11px] text-neutral-500">
            Gestión interna de kick-offs enviados desde el catálogo.
          </p>
        </div>
        <div className="flex items-center gap-2">

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
    {loading ? "Actualizando..." : "Refrescar"}
  </button>

  {/* BOTÓN LINK CUESTIONARIO */}
<button
  type="button"
  onClick={async () => {
  if (!selectedKickoffForLink) {
    setPendingLinkKind("questionnaire");
    setClientTypePickerOpen(true);
    return;
  }

  const kickoff = await ensureKickoffReady(
    selectedKickoffForLink,
    setKickoffs,
    setSelectedKickoffForLink
  );
  if (!kickoff) return;

  const link = buildQuestionnaireLink(kickoff, kickoff.clientType || 1);

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
    setClientTypePickerOpen(true);
    return;
  }

  const kickoff = await ensureKickoffReady(
    selectedKickoffForLink,
    setKickoffs,
    setSelectedKickoffForLink
  );
  if (!kickoff) return;

  const link = buildCatalogLink(kickoff, kickoff.clientType || 1);

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
  Link catálogo
</button>
<button
  type="button"
  onClick={() => setFeedbackPickerOpen(true)}
  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
>
  <LinkIcon className="w-4 h-4" />
  Link feedback
</button>

</div>


      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              className="w-full pl-7 pr-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
              placeholder="Buscar por huésped, viaje, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500">Estado:</span>
              <select
                className="border rounded-lg px-2.5 py-1.5 bg-white text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="new">{STATUS_LABELS.new}</option>
                <option value="client_submitted">{STATUS_LABELS.client_submitted}</option>
                <option value="concierge_editing">{STATUS_LABELS.concierge_editing}</option>
                <option value="sent_to_travify">{STATUS_LABELS.sent_to_travify}</option>
                <option value="feedback_submitted">{STATUS_LABELS.feedback_submitted}</option>
                <option value="done">{STATUS_LABELS.done}</option>
              </select>
            </div>

            {conciergeOptions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">Concierge:</span>
                <select
                  className="border rounded-lg px-2.5 py-1.5 bg-white text-xs"
                  value={conciergeFilter}
                  onChange={(e) => setConciergeFilter(e.target.value)}
                >
                  {conciergeOptions.map((c) => (
                    <option key={c} value={c}>
                      {c === "all" ? "Todos" : c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
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
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    Huésped
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    Viaje
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
  Tipo
</th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
  Contacto
</th>
                  
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    Creado
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    Concierge
                  </th>
                  <th className="px-4 py-2 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="px-4 py-2 text-right text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      Cargando kick-offs...
                    </td>
                  </tr>
                )}

                {!loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      No hay kick-offs que coincidan con el filtro.
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
  <StatusBadge status={k.status} />
</td>

<td className="px-4 py-2 text-right">
  <div className="inline-flex items-center gap-1">

    <button
      onClick={(e) => { e.stopPropagation(); setSelectedForSummary(k); }}
      className="px-2 py-1 border rounded text-xs"
    >
      Ver resumen
    </button>

    <button
      onClick={(e) => { e.stopPropagation(); setSelectedForEdit(k); }}
      className="px-2 py-1 border rounded text-xs"
    >
      Editar
    </button>
    <button
  onClick={async (e) => {
    e.stopPropagation();
    const link = buildCatalogLink(k, Number(k.clientType ?? 1));

    try {
      await navigator.clipboard.writeText(link);
      alert("Link de catálogo copiado ✅");
    } catch {
      prompt("Copia este link:", link);
    }
  }}
  className="px-2 py-1 border rounded text-xs"
>
  Copiar catálogo
</button>
<button
  onClick={async (e) => {
    e.stopPropagation();
    const link = buildQuestionnaireLink(k, Number(k.clientType ?? 1));

    try {
      await navigator.clipboard.writeText(link);
      alert("Link de cuestionario copiado ✅");
    } catch {
      prompt("Copia este link:", link);
    }
  }}
  className="px-2 py-1 border rounded text-xs"
>
  Copiar cuestionario
</button>
<button
  onClick={async (e) => {
    e.stopPropagation();
    const link = buildFeedbackLink(k, Number(k.clientType ?? 1));

    try {
      await navigator.clipboard.writeText(link);
      alert("Link de feedback copiado ✅");
    } catch {
      prompt("Copia este link:", link);
    }
  }}
  className="px-2 py-1 border rounded text-xs"
>
  Copiar feedback
</button>

    <button
      onClick={(e) => { e.stopPropagation(); setSelectedForDelete(k); }}
      className="px-2 py-1 border rounded text-xs text-red-600"
    >
      Eliminar
    </button>

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
            await handleCreateAndOpenLink(type);
            setPendingLinkKind(null);
          }}
        />
      )}

      {feedbackPickerOpen && (
        <KickoffPickerModal
          kickoffs={kickoffs}
          title="Seleccionar cliente para link de feedback"
          onClose={() => setFeedbackPickerOpen(false)}
          onSelect={async (k) => {
            setFeedbackPickerOpen(false);
            const link = buildFeedbackLink(k, k.clientType || 1);
            try { await navigator.clipboard.writeText(link); } catch { prompt("Copia este link:", link); }
            window.open(link, "_blank", "noopener,noreferrer");
          }}
        />
      )}


    </div>
  );
  

}
