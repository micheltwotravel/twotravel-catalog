// src/ConciergePanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchKickoffsFromSheet,
  updateKickoffInSheet,
  deleteKickoff,
  fetchServicesFromSheet, // 👈 usamos el catálogo para agregar servicios
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
} from "lucide-react";

/* =========================================
   Helpers de formato
   ========================================= */

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
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
  "in-progress": "En curso",
  sent: "Enviado",
  done: "Cerrado",
};

const STATUS_CLASSES = {
  new: "bg-blue-100 text-blue-700 border-blue-300",
  "in-progress": "bg-amber-100 text-amber-800 border-amber-300",
  sent: "bg-purple-100 text-purple-800 border-purple-300",
  done: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status || "—";
  const cls =
    STATUS_CLASSES[status] ||
    "bg-neutral-100 text-neutral-700 border-neutral-300";
  return (
    <span
      className={
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium border " +
        cls
      }
    >
      {label}
    </span>
  );
}

/* =========================================
   Generador de borrador para Travify
   ========================================= */
function buildTravifyDraftText(kickoff) {
  if (!kickoff) return "";

  const guestName = kickoff.guestName || "tu huésped";
  const firstName = guestName.split(" ")[0] || guestName;
  const tripName = kickoff.tripName || "tu viaje";

  const startDate = kickoff.startDate ? new Date(kickoff.startDate) : null;
  const endDate = kickoff.endDate ? new Date(kickoff.endDate) : null;

  const formatDate = (d) =>
    d
      ? d.toLocaleDateString("es-CO", {
          weekday: "long",
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";

  const tripDatesText =
    startDate && endDate
      ? `${formatDate(startDate)} – ${formatDate(endDate)}`
      : startDate
      ? `${formatDate(startDate)}`
      : "";

  const nights =
    kickoff.nights ||
    (startDate && endDate
      ? Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      : null);

  const guestsCount = kickoff.guestsCount || kickoff.numGuests || null;
  const occasion = kickoff.occasion || kickoff.travelReason || "";

  const formatCOP = (v) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(v || 0);

  const items = kickoff.cart || [];

  const itemsText =
    items.length === 0
      ? "Aún no hay experiencias seleccionadas. Podemos ayudarte a crear un itinerario desde cero según tus gustos.\n"
      : items
          .map((item, idx) => {
            const category = (item.category || "").toLowerCase();
            const isRestaurantLike = [
              "restaurants",
              "restaurant",
              "bars",
              "bar",
              "nightlife",
            ].includes(category);

            const priceBase =
              item.priceOverride_cop ??
              item.price_cop ??
              null;

            let priceText = "";
            if (isRestaurantLike) {
              priceText =
                "Precio según menú y consumo en el lugar (no tarifa fija).";
            } else if (priceBase && Number(priceBase) > 0) {
              priceText = `Precio referencia catálogo: ${formatCOP(priceBase)}`;
            } else {
              priceText =
                "Precio referencia: por definir (según fecha y disponibilidad).";
            }

            const dayLabel =
              item.dayLabel ||
              (item.date
                ? `Día sugerido: ${formatDate(new Date(item.date))}`
                : "");

            const displayName = item.displayName || item.name || "Experiencia";

            return (
              `${idx + 1}. ${displayName}\n` +
              (item.category ? `   Categoría: ${item.category}\n` : "") +
              (item.subcategory ? `   Tipo: ${item.subcategory}\n` : "") +
              (priceText ? `   ${priceText}\n` : "") +
              (!isRestaurantLike && item.priceUnit
                ? `   Unidad: ${item.priceUnit}\n`
                : "") +
              (dayLabel ? `   ${dayLabel}\n` : "") +
              (item.timeLabel ? `   Horario sugerido: ${item.timeLabel}\n` : "") +
              (item.description?.es
                ? `   Descripción: ${item.description.es}\n`
                : "") +
              (item.notes
                ? `   Notas del huésped: ${item.notes}\n`
                : "") +
              (item.internalNotes
                ? `   Notas internas relevantes para el huésped: ${item.internalNotes}\n`
                : "") +
              `\n`
            );
          })
          .join("");

  const tripInfoLines = [];
  if (tripName) tripInfoLines.push(`• Nombre del viaje: ${tripName}`);
  if (tripDatesText) tripInfoLines.push(`• Fechas tentativas: ${tripDatesText}`);
  if (nights) tripInfoLines.push(`• Nº de noches: ${nights}`);
  if (guestsCount) tripInfoLines.push(`• Nº de huéspedes: ${guestsCount}`);
  if (occasion) tripInfoLines.push(`• Motivo / ocasión: ${occasion}`);
  if (kickoff.notesForConcierge)
    tripInfoLines.push(
      `• Notas clave: ${kickoff.notesForConcierge.replace(/\n+/g, " ")}`
    );

  const tripInfoText =
    tripInfoLines.length > 0
      ? tripInfoLines.join("\n")
      : "• Detalles del viaje: por confirmar (fechas, nº de noches y nº de huéspedes).";

  return (
    `Hola ${firstName},\n\n` +
    `Gracias por confiar en Two Travel. Con base en tus selecciones en nuestro catálogo, te compartimos un borrador de itinerario para ${tripName}.\n` +
    `Este itinerario es totalmente flexible y podemos ajustarlo a tu ritmo, presupuesto y preferencias.\n\n` +
    `────────────────────────────────\n` +
    ` DETALLES DEL VIAJE\n` +
    `────────────────────────────────\n` +
    `${tripInfoText}\n\n` +
    `────────────────────────────────\n` +
    ` EXPERIENCIAS PRE-SELECCIONADAS\n` +
    `────────────────────────────────\n\n` +
    `${itemsText}` +
    `────────────────────────────────\n` +
    ` PRÓXIMOS PASOS\n` +
    `────────────────────────────────\n` +
    `• Validaremos disponibilidad de cada experiencia en las fechas de tu viaje.\n` +
    `• Te propondremos horarios, alternativas y upgrades cuando apliquen.\n` +
    `• Una vez nos confirmes el itinerario final, realizaremos las reservas y pagos necesarios.\n\n` +
    `Si quieres agregar más restaurantes, beach clubs, nightlife, tours privados o servicios especiales (chef, transporte, decoración, etc.), solo respóndeme este mensaje.\n\n` +
    `Un abrazo desde Cartagena 💙\n` +
    `Two Travel Concierge Team\n`
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
    kickoff.travifyText || kickoff.conciergeSummary || buildTravifyDraftText(kickoff);

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
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950 inline-flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            {copied ? "Copiado ✓" : "Copiar texto para Travify"}
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
            <h3 className="text-sm font-semibold text-neutral-900">
              Texto para Travify / Concierge summary
            </h3>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100"
            >
              <Copy className="w-3 h-3" />
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <textarea
            readOnly
            value={travifyText}
            className="w-full text-xs font-mono border rounded-lg p-3 bg-neutral-50 resize-none min-h-[140px]"
          />
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
                    {(item.priceOverride_cop || item.price_cop) && (
                      <p className="text-xs text-neutral-800 text-right whitespace-nowrap">
                        {formatPriceCOP(
                          item.priceOverride_cop || item.price_cop
                        )}
                      </p>
                    )}
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
   Panel lateral: Editar
   ========================================= */
function EditDrawer({ kickoff, onClose, onSave }) {
  const [status, setStatus] = useState(kickoff?.status || "new");
  const [internalNotes, setInternalNotes] = useState(
    kickoff?.internalNotes || ""
  );
  const [travifyText, setTravifyText] = useState(
    kickoff?.travifyText ||
      kickoff?.conciergeSummary ||
      buildTravifyDraftText(kickoff)
  );

  // ítems del itinerario (cart)
  const [items, setItems] = useState(() => kickoff?.cart || []);

  // catálogo para "Agregar desde catálogo"
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [showCatalog, setShowCatalog] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        setCatalogLoading(true);
        setCatalogError("");
        const data = await fetchServicesFromSheet();
        setCatalog(data || []);
      } catch (err) {
        console.error(err);
        setCatalogError("No se pudo cargar el catálogo.");
      } finally {
        setCatalogLoading(false);
      }
    };

    loadCatalog();
  }, []);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const base = catalog || [];
    if (!q) return base.slice(0, 20);
    return base
      .filter((s) =>
        `${s.name} ${s.category} ${s.subcategory}`.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [catalog, catalogSearch]);

  if (!kickoff) return null;

  const createEmptyItem = () => ({
    id: `NEW-${Date.now()}`,
    name: "",
    displayName: "",
    category: "Custom",
    subcategory: "",
    price_cop: null,
    priceOverride_cop: "",
    priceUnit: "por servicio",
    dayLabel: "",
    timeLabel: "",
    internalNotes: "",
    notes: "",
  });

  const handleAddItemManual = () => {
    setItems((prev) => [...prev, createEmptyItem()]);
  };

  const handleAddFromCatalog = (service) => {
    setItems((prev) => [
      ...prev,
      {
        id: service.id,
        name: service.name,
        displayName: service.name,
        category: service.category,
        subcategory: service.subcategory,
        price_cop: service.price_cop,
        priceOverride_cop: service.price_cop,
        priceUnit: service.priceUnit,
        description: service.description,
        dayLabel: "",
        timeLabel: "",
        internalNotes: "",
        notes: "",
      },
    ]);
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const handleItemRemove = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveClick = async () => {
    try {
      setSaving(true);
      await onSave(kickoff.id, {
        status,
        internalNotes,
        travifyText,
        cart: items,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* fondo */}
      <div className="flex-1 bg-black/40" onClick={onClose} />
      {/* drawer */}
      <div className="w-full max-w-5xl bg-white h-full shadow-2xl flex flex-col">

        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-neutral-900">
              Editar kick-off
            </h2>
            <p className="text-[11px] text-neutral-500">
              ID: <span className="font-mono">{kickoff.id}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4 text-sm">
          {/* Datos rápidos */}
          <div className="grid grid-cols-2 gap-4 text-xs text-neutral-800">
            <div>
              <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">
                Huésped
              </p>
              <p className="font-medium">
                {kickoff.guestName || "Sin nombre"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">
                Viaje
              </p>
              <p className="font-medium">
                {kickoff.tripName || "Sin título"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">
                Creado
              </p>
              <p>{formatDateTime(kickoff.createdAt)}</p>
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 mb-1 uppercase tracking-wide">
                Estado actual
              </p>
              <StatusBadge status={kickoff.status} />
            </div>
          </div>

          {/* Estado editable */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-800">
              Estado
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="new">{STATUS_LABELS.new}</option>
              <option value="in-progress">
                {STATUS_LABELS["in-progress"]}
              </option>
              <option value="sent">{STATUS_LABELS.sent}</option>
              <option value="done">{STATUS_LABELS.done}</option>
            </select>
          </div>

          {/* Notas internas */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-800">
              Notas internas (equipo)
            </label>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-xs min-h-[80px] resize-vertical"
              placeholder="Notas que solo ve el equipo (pagos, políticas, follow-ups, etc.)"
            />
          </div>

          {/* Ítems + Texto Travify en 2 columnas */}
          <div className="grid md:grid-cols-2 gap-4 items-start mt-2">
            {/* COLUMNA IZQUIERDA: Ítems del itinerario */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-neutral-800">
                    Ítems del itinerario
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Ajusta nombre visible, precio, día/horario y notas de cada
                    experiencia.
                  </p>
                </div>

                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleAddItemManual}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
                  >
                    + Ítem manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCatalog((v) => !v)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
                  >
                    + Desde catálogo
                  </button>
                </div>
              </div>

              {/* Catálogo compacto */}
              {showCatalog && (
                <div className="border rounded-lg p-2 bg-neutral-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Buscar en catálogo (nombre, categoría)..."
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      className="flex-1 border rounded-lg px-2 py-1.5 text-xs bg-white"
                    />
                    {catalogLoading && (
                      <span className="text-[11px] text-neutral-500">
                        Cargando...
                      </span>
                    )}
                  </div>
                  {catalogError && (
                    <p className="text-[11px] text-red-600">{catalogError}</p>
                  )}

                  {!catalogLoading && !catalogError && (
                    <div className="max-h-40 overflow-auto text-xs">
                      {filteredCatalog.length === 0 && (
                        <p className="text-[11px] text-neutral-500 px-1 py-1">
                          No hay resultados.
                        </p>
                      )}
                      {filteredCatalog.map((s) => {
  const isRestaurantLike = ["restaurants","restaurant","bars","bar","nightlife"].includes(
    (s.category || "").toLowerCase()
  );

  return (
    <div
      key={s.id}
      className="flex items-center justify-between gap-2 px-2 py-1.5 border-b last:border-b-0 border-neutral-100"
    >
      <div className="min-w-0">
        <p className="font-medium truncate">{s.name}</p>
        <p className="text-[10px] text-neutral-500 truncate">
          {s.category}
          {s.subcategory ? ` · ${s.subcategory}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {isRestaurantLike ? (
          <span className="text-[10px] text-neutral-500">
            Según consumo en el lugar
          </span>
        ) : s.price_cop ? (
          <span className="text-[10px] text-neutral-700">
            {formatPriceCOP(s.price_cop)}
          </span>
        ) : (
          <span className="text-[10px] text-neutral-400">
            Sin precio fijo
          </span>
        )}

        <button
          type="button"
          onClick={() => handleAddFromCatalog(s)}
          className="text-[10px] px-2 py-0.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100"
        >
          Agregar
        </button>
      </div>
    </div>
  );
})}

                    </div>
                  )}
                </div>
              )}

              {/* Lista editable de ítems */}
              {items.length === 0 && (
                <p className="text-[11px] text-neutral-500">
                  Aún no hay experiencias en este kick-off. Agrega desde
                  catálogo o crea un ítem manual.
                </p>
              )}

              {items.length > 0 && (
                <div className="space-y-3 max-h-72 overflow-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="border rounded-lg p-3 bg-neutral-50 space-y-2"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[11px] font-semibold text-neutral-700">
                          Ítem #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleItemRemove(idx)}
                          className="text-[11px] text-red-600 hover:text-red-700"
                        >
                          Quitar del itinerario
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] text-neutral-600">
                            Nombre para el huésped
                          </label>
                          <input
                            type="text"
                            value={item.displayName || item.name || ""}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "displayName",
                                e.target.value
                              )
                            }
                            className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white placeholder-neutral-400"

                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-neutral-600">
                            Precio referencia (COP)
                          </label>
                          <input
                            type="number"
                            value={["restaurants","restaurant","bars","bar","nightlife"].includes(
  (item.category || "").toLowerCase()
) ? "" : (
  item.priceOverride_cop ?? item.price_cop ?? ""
)}

                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "priceOverride_cop",
                                e.target.value
                              )
                            }
                            className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[11px] text-neutral-600">
                            Día / fecha sugerida
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: Día 1 – tarde / 12 mar"
                            value={item.dayLabel || ""}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "dayLabel",
                                e.target.value
                              )
                            }
                            className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white placeholder-neutral-400"

                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] text-neutral-600">
                            Horario sugerido
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: 7:30 p.m."
                            value={item.timeLabel || ""}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "timeLabel",
                                e.target.value
                              )
                            }
                            className="w-full border rounded-lg px-2 py-1.5 text-xs bg-white placeholder-neutral-400"

                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] text-neutral-600">
                          Notas para este servicio
                        </label>
                        <textarea
                          value={item.internalNotes || ""}
                          onChange={(e) =>
                            handleItemChange(
                              idx,
                              "internalNotes",
                              e.target.value
                            )
                          }
                          className="w-full border rounded-lg px-2 py-1.5 text-[11px] min-h-[50px] bg-white"
                          placeholder="Mesa terraza, alergias, prepago, etc."
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: Texto Travify grande */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-800">
                Texto final para Travify / email (versión que verá el huésped)
              </label>
              <textarea
                value={travifyText}
                onChange={(e) => setTravifyText(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-xs font-mono h-[320px] md:h-[420px] resize-vertical bg-neutral-50"
                placeholder="Aquí va el texto EXACTO que quieres que llegue a Travify / al huésped. Puedes editar precios, horarios, condiciones, etc."
              />
              <p className="text-[11px] text-neutral-500">
                Tip: primero ajusta los servicios en la columna izquierda y
                luego termina de pulir el texto aquí antes de copiarlo a
                Travify.
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t bg-neutral-50 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-300 text-sm text-neutral-700 hover:bg-neutral-100"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-sm text-white hover:bg-neutral-950 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* =========================================
   Modal confirmar eliminación
   ========================================= */

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

/* =========================================
   Componente principal
   ========================================= */

export default function ConciergePanel() {
  const [kickoffs, setKickoffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedForSummary, setSelectedForSummary] = useState(null);
  const [selectedForEdit, setSelectedForEdit] = useState(null);
  const [selectedForDelete, setSelectedForDelete] = useState(null);
  const [rowLoadingId, setRowLoadingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadKickoffs = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await fetchKickoffsFromSheet();
      setKickoffs(data || []);
    } catch (err) {
      console.error(err);
      setLoadError("No se pudieron cargar los kick-offs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKickoffs();
  }, []);

  const filteredKickoffs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return (kickoffs || [])
      .filter((k) => {
        if (statusFilter !== "all" && k.status !== statusFilter) return false;

        if (!q) return true;
        const text = [
          k.id,
          k.guestName,
          k.tripName,
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
  }, [kickoffs, search, statusFilter]);

  const handleSaveEdit = async (id, updates) => {
    try {
      setRowLoadingId(id);
      await updateKickoffInSheet(id, updates);
      setKickoffs((prev) =>
        prev.map((k) => (k.id === id ? { ...k, ...updates } : k))
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
      setKickoffs((prev) => prev.filter((k) => k.id !== id));
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
        <button
          onClick={loadKickoffs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-50"
        >
          <RefreshCcw className="w-4 h-4" />
          {loading ? "Actualizando..." : "Refrescar"}
        </button>
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

          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500">Estado:</span>
            <select
              className="border rounded-lg px-2.5 py-1.5 bg-white text-xs"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="new">{STATUS_LABELS.new}</option>
              <option value="in-progress">
                {STATUS_LABELS["in-progress"]}
              </option>
              <option value="sent">{STATUS_LABELS.sent}</option>
              <option value="done">{STATUS_LABELS.done}</option>
            </select>
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
                    Creado
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
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      Cargando kick-offs...
                    </td>
                  </tr>
                )}

                {!loading && filteredKickoffs.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-xs text-neutral-500"
                    >
                      No hay kick-offs que coincidan con el filtro.
                    </td>
                  </tr>
                )}

                {filteredKickoffs.map((k) => (
                  <tr
                    key={k.id}
                    className="border-t border-neutral-100 hover:bg-neutral-50/70"
                  >
                    <td className="px-4 py-2 whitespace-nowrap text-xs font-mono text-neutral-700">
                      {k.id}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-900">
                      {k.guestName || (
                        <span className="italic text-neutral-400">
                          Sin nombre
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-neutral-700">
                      {k.tripName || (
                        <span className="italic text-neutral-400">
                          Sin título
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-neutral-500">
                      {formatDateTime(k.createdAt)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <StatusBadge status={k.status} />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedForSummary(k)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[11px] text-neutral-700 hover:bg-neutral-100"
                        >
                          <Eye className="w-3 h-3" />
                          Ver resumen
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedForEdit(k)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 text-[11px] text-neutral-700 hover:bg-neutral-100"
                        >
                          <Pencil className="w-3 h-3" />
                          {rowLoadingId === k.id ? "Guardando..." : "Editar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedForDelete(k)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-[11px] text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
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
    </div>
  );
}
