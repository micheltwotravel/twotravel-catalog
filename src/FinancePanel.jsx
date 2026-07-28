import { useState, useEffect } from "react";

const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

async function gasPost(action, payload = {}) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload }),
  });
  return res.json();
}

// ─── SHELL COMPARTIDO ──────────────────────────────────────────────
function FinanceShell({ title, subtitle, children }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f7f4ef" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid rgba(26,24,20,.08)", padding: "14px 28px", display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/?mode=pagos" style={{ fontSize: 18, color: "#9a7d52", textDecoration: "none", padding: "4px 8px", borderRadius: 4, lineHeight: 1 }}>←</a>
        <div>
          <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "#9a7d52" }}>Two Travel · Finanzas</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 500, color: "#1a1814" }}>{title}</div>
        </div>
        {subtitle && <div style={{ marginLeft: "auto", fontSize: 12, color: "#7a7570" }}>{subtitle}</div>}
      </header>
      <main style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 24px" }}>
        {children}
      </main>
    </div>
  );
}

// ─── CASH FLOW ─────────────────────────────────────────────────────
export function FinanceCashFlow() {
  const [pagos, setPagos] = useState([]);
  const [kickoffs, setKickoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    Promise.all([gasPost("getPagos"), gasPost("listKickoffs")])
      .then(([p, k]) => {
        setPagos(Array.isArray(p.data) ? p.data : []);
        setKickoffs(Array.isArray(k.data) ? k.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const COP_RATE = 4200;
  const toUSD = (amt, cur) => (cur || "COP").toUpperCase() === "USD" ? amt : amt / COP_RATE;
  const fmtUSD = (n) => "$" + Math.round(n).toLocaleString("en-US");

  const now = new Date();
  const months = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" }).toUpperCase(),
      isCurrent: d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(),
    };
  });

  // Ingresos reales (pagos con status "pago")
  const actual = {};
  pagos.forEach(p => {
    if (p.status !== "pago" || !p.date) return;
    const key = p.date.slice(0, 7);
    actual[key] = (actual[key] || 0) + toUSD(parseFloat(p.amount) || 0, p.currency);
  });

  // Ingresos esperados (kickoffs futuros con pagos pendientes)
  const expected = {};
  kickoffs.forEach(k => {
    if (!k.arrivalDate) return;
    const key = k.arrivalDate.slice(0, 7);
    const pending = pagos
      .filter(p => (p.kickoffId === k.id || (k.guestName && p.client?.includes(k.guestName))) && p.status !== "pago")
      .reduce((s, p) => s + toUSD(parseFloat(p.amount) || 0, p.currency), 0);
    if (pending > 0) expected[key] = (expected[key] || 0) + pending;
  });

  const activeMonths = months.filter(m => (actual[m.key] || 0) + (expected[m.key] || 0) > 0);
  const maxVal = Math.max(1, ...months.map(m => Math.max(actual[m.key] || 0, expected[m.key] || 0)));

  const totalActual = activeMonths.reduce((s, m) => s + (actual[m.key] || 0), 0);
  const totalExpected = activeMonths.reduce((s, m) => s + (expected[m.key] || 0), 0);

  if (loading) return <FinanceShell title="Cash Flow"><div style={{ textAlign: "center", padding: 80, color: "#9a7d52" }}>Cargando datos…</div></FinanceShell>;

  return (
    <FinanceShell title="Cash Flow" subtitle={now.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Ingresado (período)", val: fmtUSD(totalActual), color: "#1a1814" },
          { label: "Por cobrar", val: fmtUSD(totalExpected), color: "#9a7d52" },
          { label: "Total proyectado", val: fmtUSD(totalActual + totalExpected), color: "#1a1814" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#7a7570", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: s.color }}>{s.val} USD</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, padding: "24px 20px", marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${months.length},1fr)`, gap: 6, alignItems: "end", height: 180 }}>
          {months.map(m => {
            const a = actual[m.key] || 0;
            const e = expected[m.key] || 0;
            return (
              <div key={m.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ display: "flex", gap: 2, alignItems: "end", height: 148 }}>
                  {e > 0 && (
                    <div title={`Por cobrar: ${fmtUSD(e)} USD`} style={{ width: 10, background: "#d1c4b0", borderRadius: "3px 3px 0 0", height: `${(e / maxVal) * 140}px`, transition: "height .3s" }} />
                  )}
                  {a > 0 && (
                    <div title={`Ingresado: ${fmtUSD(a)} USD`} style={{ width: 10, background: m.isCurrent ? "#9a7d52" : "#1a1814", borderRadius: "3px 3px 0 0", height: `${(a / maxVal) * 140}px`, transition: "height .3s" }} />
                  )}
                  {a === 0 && e === 0 && <div style={{ width: 10, height: 2, background: "#f0ece4" }} />}
                </div>
                <div style={{ fontSize: 9, color: m.isCurrent ? "#9a7d52" : "#7a7570", fontWeight: m.isCurrent ? 700 : 400, textAlign: "center" }}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 11, color: "#7a7570" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1a1814", borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />Ingresado</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#d1c4b0", borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />Por cobrar</span>
        </div>
      </div>

      {/* Monthly table */}
      <div style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f7f4ef", borderBottom: "1px solid rgba(26,24,20,.08)" }}>
              {["Mes", "Ingresado", "Por cobrar", "Total", "% cobrado"].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: h === "Mes" ? "left" : "right", fontWeight: 600, color: "#1a1814" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map(m => {
              const a = actual[m.key] || 0;
              const e = expected[m.key] || 0;
              if (a + e === 0) return null;
              const pct = a + e > 0 ? Math.round((a / (a + e)) * 100) : 0;
              return (
                <tr key={m.key} style={{ borderBottom: "1px solid rgba(26,24,20,.05)", background: m.isCurrent ? "#fffdf9" : "transparent" }}>
                  <td style={{ padding: "10px 16px", color: "#1a1814", fontWeight: m.isCurrent ? 600 : 400 }}>
                    {m.label}
                    {m.isCurrent && <span style={{ fontSize: 9, background: "#9a7d52", color: "#fff", padding: "1px 5px", borderRadius: 8, marginLeft: 6 }}>HOY</span>}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#059669", fontWeight: 500 }}>{fmtUSD(a)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#9a7d52" }}>{fmtUSD(e)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#1a1814", fontWeight: 500 }}>{fmtUSD(a + e)}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                      <div style={{ width: 50, height: 4, background: "#f0ece4", borderRadius: 2 }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#059669" : "#9a7d52", borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 12, color: "#7a7570", minWidth: 28 }}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </FinanceShell>
  );
}

// ─── MOVIMIENTOS BANCARIOS ─────────────────────────────────────────
const MOV_CATEGORIES = ["Ingreso cliente", "Comisión proveedor", "Gasto operativo", "Nómina", "Transferencia interna", "Impuesto", "Otro"];

export function FinanceMovimientos() {
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const blank = { date: "", description: "", category: MOV_CATEGORIES[0], amount: "", currency: "COP", account: "CO", type: "ingreso", notes: "" };
  const [form, setForm] = useState(blank);

  const load = () => {
    setLoading(true);
    gasPost("getMovimientos")
      .then(r => { setMovs(Array.isArray(r.data) ? r.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = movs.filter(m => country === "all" || m.account === country);
  const totIng = filtered.filter(m => m.type === "ingreso").reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
  const totEgr = filtered.filter(m => m.type === "egreso").reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);

  const save = async () => {
    if (!form.date || !form.description || !form.amount) return;
    setSaving(true);
    const next = [...movs, { ...form, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5) }];
    await gasPost("saveMovimientos", { movimientos: next });
    setMovs(next);
    setForm(blank);
    setShowNew(false);
    setSaving(false);
  };

  const remove = async (id) => {
    const next = movs.filter(m => m.id !== id);
    await gasPost("saveMovimientos", { movimientos: next });
    setMovs(next);
  };

  const inp = (field) => ({
    value: form[field],
    onChange: e => setForm(f => ({ ...f, [field]: e.target.value })),
    style: { width: "100%", padding: "8px 10px", border: "1px solid rgba(26,24,20,.12)", borderRadius: 6, fontSize: 13, boxSizing: "border-box", background: "#fff" },
  });

  return (
    <FinanceShell title="Movimientos Bancarios">
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total ingresos", val: totIng, color: "#059669", sign: "+" },
          { label: "Total egresos", val: totEgr, color: "#dc2626", sign: "−" },
          { label: "Balance neto", val: totIng - totEgr, color: (totIng - totEgr) >= 0 ? "#059669" : "#dc2626", sign: "" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#7a7570", marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: s.color }}>{s.sign}${Math.abs(s.val).toLocaleString("en-US", { minimumFractionDigits: 0 })}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 8, overflow: "hidden" }}>
          {[["all", "🌎 Todos"], ["CO", "🇨🇴 Colombia"], ["MX", "🇲🇽 México"]].map(([v, l]) => (
            <button key={v} onClick={() => setCountry(v)} style={{ padding: "8px 14px", fontSize: 12, fontWeight: 500, background: country === v ? "#1a1814" : "transparent", color: country === v ? "#fff" : "#7a7570", border: "none", cursor: "pointer" }}>{l}</button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)} style={{ background: "#1a1814", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>+ Nuevo movimiento</button>
      </div>

      {/* New form */}
      {showNew && (
        <div style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Fecha <input type="date" {...inp("date")} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Tipo
              <select {...inp("type")}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Cuenta
              <select {...inp("account")}><option value="CO">Colombia 🇨🇴</option><option value="MX">México 🇲🇽</option></select>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Descripción <input type="text" placeholder="Ej: Pago cliente Martínez" {...inp("description")} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Monto <input type="number" placeholder="0" {...inp("amount")} /></label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Moneda
              <select {...inp("currency")}><option value="COP">COP</option><option value="USD">USD</option><option value="MXN">MXN</option></select>
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Categoría
              <select {...inp("category")}>{MOV_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#7a7570" }}>Notas <input type="text" placeholder="Opcional" {...inp("notes")} /></label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={save} disabled={saving} style={{ background: "#1a1814", color: "#fff", border: "none", borderRadius: 6, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Guardando…" : "Guardar"}</button>
            <button onClick={() => setShowNew(false)} style={{ background: "none", border: "1px solid rgba(26,24,20,.12)", borderRadius: 6, padding: "9px 14px", fontSize: 13, color: "#7a7570", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#9a7d52" }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#7a7570" }}>Sin movimientos registrados aún.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f7f4ef", borderBottom: "1px solid rgba(26,24,20,.08)" }}>
                {["Fecha", "Descripción", "Categoría", "Cuenta", "Monto", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: h === "Monto" ? "right" : "left", fontWeight: 600, color: "#1a1814" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtered].sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(m => (
                <tr key={m.id} style={{ borderBottom: "1px solid rgba(26,24,20,.05)" }}>
                  <td style={{ padding: "10px 16px", color: "#7a7570" }}>{m.date}</td>
                  <td style={{ padding: "10px 16px", color: "#1a1814" }}>{m.description}{m.notes && <span style={{ fontSize: 11, color: "#9a7d52", marginLeft: 6 }}>· {m.notes}</span>}</td>
                  <td style={{ padding: "10px 16px", color: "#7a7570" }}>{m.category}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: m.account === "CO" ? "#fef3c7" : "#dbeafe", color: m.account === "CO" ? "#92400e" : "#1e40af" }}>
                      {m.account === "CO" ? "🇨🇴 CO" : "🇲🇽 MX"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: m.type === "ingreso" ? "#059669" : "#dc2626", fontWeight: 500 }}>
                    {m.type === "ingreso" ? "+" : "−"}{m.currency} ${parseFloat(m.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 0 })}
                  </td>
                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                    <button onClick={() => remove(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#d1c4b0", fontSize: 15 }} title="Eliminar">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </FinanceShell>
  );
}

// ─── CIERRE MENSUAL ────────────────────────────────────────────────
const CIERRE_ITEMS = [
  { id: "bank-co",      label: "Conciliar cuentas bancarias Colombia",      cat: "Conciliación" },
  { id: "bank-mx",      label: "Conciliar cuentas bancarias México",         cat: "Conciliación" },
  { id: "com-rev",      label: "Revisar comisiones pendientes de proveedores", cat: "Proveedores" },
  { id: "com-ok",       label: "Confirmar comisiones pagadas del mes",       cat: "Proveedores" },
  { id: "pago-co",      label: "Verificar pagos pendientes Colombia",        cat: "Pagos" },
  { id: "pago-mx",      label: "Verificar pagos pendientes México",          cat: "Pagos" },
  { id: "qb-bills",     label: "Exportar bills a QuickBooks",                cat: "Contabilidad" },
  { id: "qb-income",    label: "Registrar ingresos en QuickBooks",           cat: "Contabilidad" },
  { id: "payana",       label: "Importar pagos a Payana",                    cat: "Contabilidad" },
  { id: "ventas-com",   label: "Calcular comisiones de ventas del mes",      cat: "Ventas" },
  { id: "cashflow-upd", label: "Actualizar tablero de cash flow",            cat: "Control" },
  { id: "rpt-contador", label: "Enviar reporte mensual al contador",         cat: "Cierre" },
  { id: "qb-close",     label: "Cerrar período en QuickBooks",               cat: "Cierre" },
  { id: "aprobacion",   label: "Aprobación final de cierre (dirección)",     cat: "Cierre" },
];

export function FinanceCierre() {
  const now = new Date();
  const months = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
    };
  });

  const [month, setMonth] = useState(months[2].key);
  const [checked, setChecked] = useState({});

  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem(`finance-cierre-${month}`) || "{}")); } catch { setChecked({}); }
  }, [month]);

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    try { localStorage.setItem(`finance-cierre-${month}`, JSON.stringify(next)); } catch {}
  };

  const done = CIERRE_ITEMS.filter(i => checked[i.id]).length;
  const pct = Math.round((done / CIERRE_ITEMS.length) * 100);

  const grouped = CIERRE_ITEMS.reduce((acc, item) => {
    if (!acc[item.cat]) acc[item.cat] = [];
    acc[item.cat].push(item);
    return acc;
  }, {});

  return (
    <FinanceShell title="Cierre Mensual">
      {/* Month selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {months.map(m => (
          <button key={m.key} onClick={() => setMonth(m.key)} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 500, background: month === m.key ? "#1a1814" : "#fff", color: month === m.key ? "#fff" : "#7a7570", border: "1px solid rgba(26,24,20,.09)", borderRadius: 8, cursor: "pointer", textTransform: "capitalize" }}>{m.label}</button>
        ))}
      </div>

      {/* Progress */}
      <div style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <span style={{ fontFamily: "Georgia,serif", fontSize: 32, fontWeight: 500, color: "#1a1814" }}>{pct}%</span>
            <span style={{ fontSize: 13, color: "#7a7570", marginLeft: 10 }}>{done} de {CIERRE_ITEMS.length} tareas completadas</span>
          </div>
          {pct === 100 && <span style={{ fontSize: 13, fontWeight: 600, color: "#059669", background: "#d1fae5", padding: "4px 14px", borderRadius: 20 }}>✓ Cierre completo</span>}
        </div>
        <div style={{ height: 6, background: "#f0ece4", borderRadius: 3 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#059669" : "#9a7d52", borderRadius: 3, transition: "width .4s ease" }} />
        </div>
      </div>

      {/* Checklist */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "9px 16px", background: "#f7f4ef", borderBottom: "1px solid rgba(26,24,20,.06)", fontSize: 10, fontWeight: 700, color: "#9a7d52", textTransform: "uppercase", letterSpacing: ".1em" }}>{cat}</div>
            {items.map((item, idx) => (
              <div key={item.id} onClick={() => toggle(item.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: idx < items.length - 1 ? "1px solid rgba(26,24,20,.04)" : "none", cursor: "pointer", background: checked[item.id] ? "#fffdf9" : "transparent", transition: "background .15s" }}>
                <div style={{ width: 20, height: 20, borderRadius: 5, border: checked[item.id] ? "none" : "2px solid #d1c4b0", background: checked[item.id] ? "#9a7d52" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .15s" }}>
                  {checked[item.id] && <span style={{ color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: checked[item.id] ? "#9a7d52" : "#1a1814", textDecoration: checked[item.id] ? "line-through" : "none", transition: "color .15s" }}>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </FinanceShell>
  );
}

// ─── TEMPLATES ─────────────────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}

export function FinanceTemplates() {
  const templates = [
    {
      icon: "📥",
      label: "Payana — Importar pagos",
      desc: "CSV con el formato de columnas que requiere Payana para cargar órdenes de pago.",
      action: () => downloadCSV("payana-pagos.csv",
        ["Fecha", "Proveedor", "NIT/RUT", "Banco", "No. Cuenta", "Tipo Cuenta", "Monto", "Moneda", "Concepto", "Referencia"],
        [
          ["2026-07-01", "Proveedor Ejemplo", "900123456-1", "Bancolombia", "12345678901", "Ahorros", "500000", "COP", "Servicio julio", "REF-001"],
          ["2026-07-01", "Otro Proveedor S.A.S", "800987654-3", "Davivienda", "98765432101", "Corriente", "1200000", "COP", "Comisión tour", "REF-002"],
        ]
      ),
    },
    {
      icon: "📤",
      label: "QuickBooks — Cuentas por pagar (Bills)",
      desc: "CSV para importar bills a QuickBooks Online desde el módulo de proveedores.",
      action: () => downloadCSV("qb-bills.csv",
        ["BillNo", "Vendor", "BillDate", "DueDate", "Item", "Description", "Qty", "Rate", "Amount", "Class", "Location"],
        [
          ["BILL-001", "Proveedor Ejemplo", "07/01/2026", "07/15/2026", "Services", "Servicio turístico julio", "1", "500", "500", "Colombia", "Cartagena"],
          ["BILL-002", "Otro Proveedor", "07/01/2026", "07/15/2026", "Services", "Comisión actividad", "1", "200", "200", "Mexico", "CDMX"],
        ]
      ),
    },
    {
      icon: "📋",
      label: "QuickBooks — Estimates / Cotizaciones",
      desc: "CSV para importar cotizaciones y presupuestos a QuickBooks Online.",
      action: () => downloadCSV("qb-estimates.csv",
        ["EstimateNo", "Customer", "Date", "ExpiryDate", "Item", "Description", "Qty", "Rate", "Amount", "Class"],
        [
          ["EST-001", "Cliente Ejemplo", "07/01/2026", "07/31/2026", "Trip Package", "Paquete viaje julio", "1", "2500", "2500", "Colombia"],
          ["EST-002", "Otro Cliente", "07/05/2026", "08/05/2026", "Trip Package", "Paquete Cartagena 5 noches", "1", "3200", "3200", "Colombia"],
        ]
      ),
    },
    {
      icon: "🔄",
      label: "Hoja de Conciliación Bancaria",
      desc: "Plantilla de trabajo para conciliar extractos bancarios contra los registros internos.",
      action: () => downloadCSV("conciliacion-bancaria.csv",
        ["Fecha", "Descripción", "Referencia", "Débito", "Crédito", "Saldo", "Conciliado (S/N)", "Cuenta", "País", "Notas"],
        [
          ["2026-07-01", "Depósito cliente", "TXN-001", "", "2500000", "2500000", "N", "Bancolombia 1234", "CO", ""],
          ["2026-07-02", "Pago a proveedor", "TXN-002", "500000", "", "2000000", "N", "Bancolombia 1234", "CO", ""],
        ]
      ),
    },
  ];

  return (
    <FinanceShell title="Templates" subtitle="Descarga · rellena · importa">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {templates.map(t => (
          <div key={t.label} style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, padding: "20px 22px" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{t.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1814", marginBottom: 5 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: "#7a7570", marginBottom: 18, lineHeight: 1.6 }}>{t.desc}</div>
            <button onClick={t.action} style={{ background: "#1a1814", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer" }}>↓ Descargar CSV</button>
          </div>
        ))}
      </div>
      <div style={{ padding: "14px 18px", background: "#fffdf9", border: "1px solid rgba(154,125,82,.18)", borderRadius: 10, fontSize: 12, color: "#7a7570", lineHeight: 1.6 }}>
        <strong style={{ color: "#9a7d52" }}>Nota:</strong> Todos los CSV incluyen BOM UTF-8 para compatibilidad con Excel en español. Las filas de ejemplo son solo referencia — reemplázalas con datos reales antes de importar.
      </div>
    </FinanceShell>
  );
}

// ─── RESERVACIONES & VENTAS ────────────────────────────────────────
export function FinanceReservaciones() {
  const [kickoffs, setKickoffs] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");

  useEffect(() => {
    Promise.all([gasPost("listKickoffs"), gasPost("getPagos")])
      .then(([k, p]) => {
        setKickoffs(Array.isArray(k.data) ? k.data : []);
        setPagos(Array.isArray(p.data) ? p.data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const now = new Date().toISOString().slice(0, 10);
  const list = kickoffs
    .filter(k => {
      if (!k.arrivalDate) return false;
      if (filter === "upcoming") return k.arrivalDate >= now;
      if (filter === "past") return k.arrivalDate < now;
      return true;
    })
    .sort((a, b) => (a.arrivalDate || "").localeCompare(b.arrivalDate || ""));

  const kPagos = (k) => pagos.filter(p =>
    p.kickoffId === k.id ||
    (k.guestName && p.client?.toLowerCase().includes(k.guestName.toLowerCase()))
  );
  const totalReceived = list.reduce((s, k) => s + kPagos(k).filter(p => p.status === "pago").reduce((ss, p) => ss + (parseFloat(p.amount) || 0), 0), 0);
  const totalPending = list.reduce((s, k) => s + kPagos(k).filter(p => p.status !== "pago").reduce((ss, p) => ss + (parseFloat(p.amount) || 0), 0), 0);

  return (
    <FinanceShell title="Reservaciones & Ventas">
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Reservaciones", val: list.length, fmt: n => n },
          { label: "Monto recibido", val: totalReceived, fmt: n => "$" + Math.round(n).toLocaleString("en-US") },
          { label: "Por cobrar", val: totalPending, fmt: n => "$" + Math.round(n).toLocaleString("en-US") },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#7a7570", marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#1a1814" }}>{s.fmt(s.val)}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 8, overflow: "hidden", width: "fit-content", marginBottom: 16 }}>
        {[["upcoming", "Próximas"], ["past", "Pasadas"], ["all", "Todas"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{ padding: "8px 16px", fontSize: 12, fontWeight: 500, background: filter === v ? "#1a1814" : "transparent", color: filter === v ? "#fff" : "#7a7570", border: "none", cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid rgba(26,24,20,.09)", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48, color: "#9a7d52" }}>Cargando…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: "#7a7570" }}>Sin reservaciones en este filtro.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f7f4ef", borderBottom: "1px solid rgba(26,24,20,.08)" }}>
                {["Cliente", "Llegada", "Salida", "Destino", "Concierge", "Pagado / Total", "Estado"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 600, color: "#1a1814", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(k => {
                const kp = kPagos(k);
                const paid = kp.filter(p => p.status === "pago").reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                const total = kp.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                const pct = total > 0 ? Math.round((paid / total) * 100) : null;
                const statusColor = { confirmed: ["#d1fae5", "#065f46"], pending: ["#fef3c7", "#92400e"], cancelled: ["#fee2e2", "#991b1b"] };
                const [bg, fg] = statusColor[k.status] || ["#f3f4f6", "#6b7280"];
                return (
                  <tr key={k.id} style={{ borderBottom: "1px solid rgba(26,24,20,.05)" }}>
                    <td style={{ padding: "10px 16px", color: "#1a1814", fontWeight: 500 }}>{k.guestName || "—"}</td>
                    <td style={{ padding: "10px 16px", color: "#7a7570", whiteSpace: "nowrap" }}>{k.arrivalDate ? new Date(k.arrivalDate + "T12:00:00").toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</td>
                    <td style={{ padding: "10px 16px", color: "#7a7570", whiteSpace: "nowrap" }}>{k.departureDate ? new Date(k.departureDate + "T12:00:00").toLocaleDateString("es-CO", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</td>
                    <td style={{ padding: "10px 16px", color: "#7a7570" }}>{k.destination || k.city || "—"}</td>
                    <td style={{ padding: "10px 16px", color: "#7a7570" }}>{k.assignedConciergeName || "—"}</td>
                    <td style={{ padding: "10px 16px", color: "#1a1814" }}>
                      {total > 0
                        ? <span>${paid.toLocaleString("en-US", { minimumFractionDigits: 0 })} <span style={{ color: "#d1c4b0" }}>/ ${total.toLocaleString("en-US", { minimumFractionDigits: 0 })}</span> {pct !== null && <span style={{ fontSize: 11, color: "#9a7d52" }}>({pct}%)</span>}</span>
                        : <span style={{ color: "#d1c4b0" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, background: bg, color: fg }}>{k.status || "—"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </FinanceShell>
  );
}
