import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

const MESES = [
  { label: "Marzo",      value: "2026-03" },
  { label: "Abril",      value: "2026-04" },
  { label: "Mayo",       value: "2026-05" },
  { label: "Junio",      value: "2026-06" },
  { label: "Julio",      value: "2026-07" },
  { label: "Agosto",     value: "2026-08" },
  { label: "Septiembre", value: "2026-09" },
  { label: "Octubre",    value: "2026-10" },
  { label: "Noviembre",  value: "2026-11" },
];

const SECTION_ORDER = [
  "CASA MANILA (MEDELLIN)",
  "OFICINA ADMIN CTG",
  "LINEAS CORPORATIVAS",
  "LA CASITA CTG",
  "SAN AGUSTIN CTG",
  "CASA MANGA (Dark kitchen) CTG",
  "CASA MODENA CTG",
];

const SECTION_ICONS = {
  "CASA MANILA (MEDELLIN)": "🏠",
  "OFICINA ADMIN CTG": "🏢",
  "LINEAS CORPORATIVAS": "📱",
  "LA CASITA CTG": "🏡",
  "SAN AGUSTIN CTG": "🏘️",
  "CASA MANGA (Dark kitchen) CTG": "🍳",
  "CASA MODENA CTG": "🏛️",
};

const ESTADO_CONFIG = {
  al_dia:         { label: "Al día",          color: "#166534", bg: "#dcfce7", border: "#86efac" },
  por_pagar:      { label: "Por pagar",        color: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
  sin_actualizacion: { label: "Sin actualiz.", color: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  sin_usar:       { label: "Sin usar",         color: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
  pendiente:      { label: "Pendiente",        color: "#1e40af", bg: "#dbeafe", border: "#93c5fd" },
};

const ESTADOS_OPTS = ["al_dia","por_pagar","sin_actualizacion","sin_usar","pendiente"];

function fmt(n) {
  if (!n) return "—";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d) {
  if (!d) return "—";
  const [, m, day] = d.split("-");
  return `${parseInt(day)}/${parseInt(m)}`;
}

function EstadoBadge({ estado }) {
  const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function EditRow({ row, onSave, onCancel }) {
  const [estado, setEstado] = useState(row.estado || "pendiente");
  const [valor, setValor] = useState(row.valor || "");
  const [fecha, setFecha] = useState(row.fecha_limite || "");
  const [notas, setNotas] = useState(row.notas || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await onSave(row.id, { estado, valor: valor ? parseFloat(valor) : null, fecha_limite: fecha || null, notas });
    setSaving(false);
  }

  return (
    <tr style={{ background: "#fffbf0" }}>
      <td style={{ padding: "6px 12px", fontSize: 13, color: "#374151" }}>
        <div style={{ fontWeight: 600 }}>{row.servicio}</div>
        {row.referencia && <div style={{ fontSize: 11, color: "#9ca3af" }}>{row.referencia}</div>}
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="number"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="0"
          style={{ width: 120, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
        />
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
        />
      </td>
      <td style={{ padding: "6px 8px" }}>
        <select
          value={estado}
          onChange={e => setEstado(e.target.value)}
          style={{ padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
        >
          {ESTADOS_OPTS.map(e => (
            <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>
          ))}
        </select>
      </td>
      <td style={{ padding: "6px 8px" }}>
        <input
          value={notas}
          onChange={e => setNotas(e.target.value)}
          placeholder="Notas..."
          style={{ width: 160, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 }}
        />
      </td>
      <td style={{ padding: "6px 8px", whiteSpace: "nowrap" }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "4px 12px", background: "#111827", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer", marginRight: 4 }}
        >
          {saving ? "..." : "Guardar"}
        </button>
        <button
          onClick={onCancel}
          style={{ padding: "4px 10px", background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
        >
          Cancelar
        </button>
      </td>
    </tr>
  );
}

function SectionTable({ ubicacion, rows, onSave }) {
  const [editingId, setEditingId] = useState(null);
  const icon = SECTION_ICONS[ubicacion] || "🏠";

  const totalValor = rows.reduce((s, r) => s + (r.estado !== "sin_usar" ? (r.valor || 0) : 0), 0);
  const countPorPagar = rows.filter(r => r.estado === "por_pagar").length;
  const totalPorPagar = rows.filter(r => r.estado === "por_pagar").reduce((s, r) => s + (r.valor || 0), 0);

  return (
    <div style={{ marginBottom: 24, background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      {/* Section header */}
      <div style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{ubicacion}</span>
          {countPorPagar > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }}>
              {countPorPagar} por pagar
            </span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>Total mes</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{fmt(totalValor)}</div>
          {totalPorPagar > 0 && (
            <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>⚠️ {fmt(totalPorPagar)} pendiente</div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Servicio / Referencia</th>
              <th style={{ padding: "8px 8px", textAlign: "right", fontWeight: 600 }}>Valor</th>
              <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 600 }}>F. Límite</th>
              <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 600 }}>Estado</th>
              <th style={{ padding: "8px 8px", textAlign: "left", fontWeight: 600 }}>Notas</th>
              <th style={{ padding: "8px 8px", textAlign: "center", fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              if (editingId === row.id) {
                return (
                  <EditRow
                    key={row.id}
                    row={row}
                    onSave={async (...args) => { await onSave(...args); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                  />
                );
              }
              const isOdd = idx % 2 === 1;
              return (
                <tr
                  key={row.id}
                  style={{ background: isOdd ? "#f9fafb" : "#fff", borderTop: "1px solid #f3f4f6" }}
                >
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: row.estado === "sin_usar" ? "#9ca3af" : "#111827" }}>
                      {row.servicio}
                    </div>
                    {row.referencia && (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{row.referencia}</div>
                    )}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "right", fontSize: 13, fontWeight: 600, color: row.estado === "por_pagar" ? "#dc2626" : "#374151" }}>
                    {row.estado === "sin_usar" ? <span style={{ color: "#9ca3af", fontSize: 12 }}>sin usar</span> : fmt(row.valor)}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center", fontSize: 12, color: "#6b7280" }}>
                    {fmtDate(row.fecha_limite)}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <EstadoBadge estado={row.estado} />
                  </td>
                  <td style={{ padding: "8px 8px", fontSize: 12, color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.notas || ""}
                  </td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => setEditingId(row.id)}
                      style={{ padding: "3px 10px", background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GastosFijosPage({ currentUser }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [mes, setMes] = useState(() => {
    const now = new Date();
    const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return MESES.find(x => x.value === m)?.value || "2026-11";
  });
  const [pais, setPais] = useState("CO");
  const [filterEstado, setFilterEstado] = useState("all");
  const [toast, setToast] = useState(null);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gastos_fijos")
      .select("*")
      .eq("mes", mes)
      .eq("pais", pais)
      .order("ubicacion")
      .order("servicio");
    if (error) { showToast("Error cargando datos: " + error.message, false); }
    else setRows(data || []);
    setLoading(false);
  }, [mes, pais]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(id, updates) {
    const { error } = await supabase
      .from("gastos_fijos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { showToast("Error guardando: " + error.message, false); return; }
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    showToast("Actualizado");
  }

  // Group by ubicacion
  const sections = {};
  for (const r of rows) {
    if (filterEstado !== "all" && r.estado !== filterEstado) continue;
    if (!sections[r.ubicacion]) sections[r.ubicacion] = [];
    sections[r.ubicacion].push(r);
  }

  const allRows = rows.filter(r => r.estado !== "sin_usar");
  const totalMes = allRows.reduce((s, r) => s + (r.valor || 0), 0);
  const totalPorPagar = rows.filter(r => r.estado === "por_pagar").reduce((s, r) => s + (r.valor || 0), 0);
  const totalAlDia = rows.filter(r => r.estado === "al_dia").reduce((s, r) => s + (r.valor || 0), 0);
  const countPorPagar = rows.filter(r => r.estado === "por_pagar").length;

  const mesLabel = MESES.find(m2 => m2.value === mes)?.label || mes;

  const orderedSections = SECTION_ORDER.filter(s => sections[s]);
  const extraSections = Object.keys(sections).filter(s => !SECTION_ORDER.includes(s));

  return (
    <div style={{ padding: "24px 20px", maxWidth: 1100, margin: "0 auto", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.ok ? "#111827" : "#dc2626", color: "#fff",
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <span style={{ fontSize: 22 }}>🏠</span>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Gastos Fijos</h1>
        </div>
        <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
          Control mensual de gastos fijos por propiedad y línea
        </p>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {/* País tabs */}
        <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, padding: 3 }}>
          {["CO","MX"].map(p => (
            <button
              key={p}
              onClick={() => setPais(p)}
              style={{
                padding: "5px 16px", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600,
                cursor: "pointer", transition: "all 0.15s",
                background: pais === p ? "#111827" : "transparent",
                color: pais === p ? "#fff" : "#6b7280",
              }}
            >
              🇨🇴 {p === "CO" ? "Colombia" : "México 🇲🇽"}
            </button>
          ))}
        </div>

        {/* Mes selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => {
              const idx = MESES.findIndex(m2 => m2.value === mes);
              if (idx > 0) setMes(MESES[idx - 1].value);
            }}
            style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ‹
          </button>
          <select
            value={mes}
            onChange={e => setMes(e.target.value)}
            style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#111827", background: "#fff" }}
          >
            {MESES.map(m2 => (
              <option key={m2.value} value={m2.value}>{m2.label} 2026</option>
            ))}
          </select>
          <button
            onClick={() => {
              const idx = MESES.findIndex(m2 => m2.value === mes);
              if (idx < MESES.length - 1) setMes(MESES[idx + 1].value);
            }}
            style={{ width: 28, height: 28, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ›
          </button>
        </div>

        {/* Estado filter */}
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
          style={{ padding: "5px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, color: "#374151", background: "#fff" }}
        >
          <option value="all">Todos los estados</option>
          {ESTADOS_OPTS.map(e => (
            <option key={e} value={e}>{ESTADO_CONFIG[e].label}</option>
          ))}
        </select>

        <button onClick={load} style={{ padding: "5px 14px", background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>
          ↻ Recargar
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Total {mesLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{fmt(totalMes)}</div>
        </div>
        <div style={{ background: countPorPagar > 0 ? "#fff5f5" : "#fff", border: `1px solid ${countPorPagar > 0 ? "#fca5a5" : "#e5e7eb"}`, borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Por Pagar</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: countPorPagar > 0 ? "#dc2626" : "#111827" }}>{fmt(totalPorPagar)}</div>
          {countPorPagar > 0 && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{countPorPagar} servicio{countPorPagar !== 1 ? "s" : ""}</div>}
        </div>
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Al Día</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#166534" }}>{fmt(totalAlDia)}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Propiedades</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{SECTION_ORDER.filter(s => sections[s]).length}</div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9ca3af", fontSize: 14 }}>Cargando...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#f9fafb", borderRadius: 12, color: "#9ca3af", fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          No hay datos para {pais} · {mesLabel} 2026
        </div>
      ) : (
        [...orderedSections, ...extraSections].map(sec => (
          <SectionTable
            key={sec}
            ubicacion={sec}
            rows={sections[sec]}
            onSave={handleSave}
          />
        ))
      )}
    </div>
  );
}
