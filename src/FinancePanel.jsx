import { useState, useEffect, useCallback } from "react";
import { fetchKickoffsFromSheet, saveKickoffToSheet, updateKickoffInSheet } from "./sheetServices";

// ─── BRAND ───────────────────────────────────────────────────────────────────
const BG   = "#f7f4ef";
const DARK = "#1a1814";
const GOLD = "#9a7d52";
const GOLD2= "#c9a96e";
const MUT  = "#7a7570";
const BRD  = "rgba(26,24,20,.09)";
const WHT  = "#ffffff";

// ─── DATA LAYER (kickoff-as-storage) ─────────────────────────────────────────
let _financeCache = null;
let _financeCacheId = null;

async function getFinanceKickoff(forceRefresh = false) {
  const all = await fetchKickoffsFromSheet({ forceRefresh });
  return all.find(k => { try { return JSON.parse(k.conciergeSummary || "{}").type === "financeData"; } catch { return false; } }) || null;
}
async function loadFinanceData(forceRefresh = false) {
  const k = await getFinanceKickoff(forceRefresh);
  if (!k) return { movimientos: [], pagos: [] };
  try {
    const d = JSON.parse(k.internalNotes || "{}");
    _financeCache = d; _financeCacheId = k.id;
    return { movimientos: d.movimientos || [], pagos: d.pagos || [], id: k.id };
  } catch { return { movimientos: [], pagos: [] }; }
}
async function saveFinanceData(patch) {
  const k = await getFinanceKickoff(true);
  const current = k ? JSON.parse(k.internalNotes || "{}") : {};
  const merged = { ...current, ...patch };
  if (k) {
    await updateKickoffInSheet(k.id, { internalNotes: JSON.stringify(merged) });
  } else {
    await saveKickoffToSheet({ guestName:"Finance Data", conciergeSummary:JSON.stringify({type:"financeData"}), internalNotes:JSON.stringify(merged), status:"active" });
  }
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function fmt$(n,cur="") { const v=Math.abs(parseFloat(n)||0); return "$"+v.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})+(cur?" "+cur:""); }
function parseDate(d) { if(!d) return null; const dt=new Date(d.length===10?d+"T12:00:00":d); return isNaN(dt)?null:dt; }
function fmtDate(d) { const dt=parseDate(d); if(!dt) return d||"—"; return dt.toLocaleDateString("es-CO",{day:"numeric",month:"short",year:"2-digit"}); }
function monthKey(d) { return d ? d.slice(0,7) : ""; }
function toUSD(amount, currency) {
  const a = parseFloat(amount)||0;
  const c = (currency||"USD").toUpperCase();
  if(c==="USD") return a;
  if(c==="COP") return a/4200;
  if(c==="MXN") return a/18;
  return a;
}

// ─── SHELL COMPARTIDO ──────────────────────────────────────────────────────────
function Shell({ title, subtitle, children }) {
  return (
    <div style={{minHeight:"100vh",background:BG,fontFamily:"'Jost',sans-serif"}}>
      <header style={{background:WHT,borderBottom:`1px solid ${BRD}`,padding:"14px 28px",display:"flex",alignItems:"center",gap:16}}>
        <a href="/?mode=pagos" style={{fontSize:18,color:GOLD,textDecoration:"none",padding:"4px 8px",borderRadius:4,lineHeight:1}}>←</a>
        <div>
          <div style={{fontSize:10,letterSpacing:".15em",textTransform:"uppercase",color:GOLD}}>Two Travel · Finanzas</div>
          <div style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:18,fontWeight:500,color:DARK}}>{title}</div>
        </div>
        {subtitle&&<div style={{marginLeft:"auto",fontSize:12,color:MUT}}>{subtitle}</div>}
      </header>
      <main style={{maxWidth:1060,margin:"0 auto",padding:"28px 24px"}}>{children}</main>
    </div>
  );
}

function KPICard({ label, val, sub, color="#1a1814" }) {
  return (
    <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,padding:"18px 22px"}}>
      <div style={{fontSize:11,color:MUT,marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color,letterSpacing:"-.01em"}}>{val}</div>
      {sub&&<div style={{fontSize:11,color:MUT,marginTop:3}}>{sub}</div>}
    </div>
  );
}

function Spinner() { return <div style={{textAlign:"center",padding:64,color:GOLD}}>Cargando…</div>; }
function Empty({text="Sin datos aún."}) { return <div style={{textAlign:"center",padding:56,color:MUT,fontSize:13}}>{text}</div>; }
function Err({msg,onRetry}) { return <div style={{background:"#fff5f0",border:"1px solid #fca5a5",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13}}><span style={{color:"#b91c1c"}}>{msg}</span>{onRetry&&<button onClick={onRetry} style={{background:"none",border:"none",color:GOLD,cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Reintentar</button>}</div>; }

const INP = {border:`1px solid ${BRD}`,borderRadius:8,padding:"8px 10px",fontSize:13,width:"100%",boxSizing:"border-box",background:WHT,fontFamily:"'Jost',sans-serif",color:DARK,outline:"none"};

// ─── MOVIMIENTOS BANCARIOS ─────────────────────────────────────────────────────
const MOV_CATS = ["Ingreso cliente","Comisión proveedor","Gasto operativo","Nómina","Transferencia interna","Impuesto","Otro"];
const CURRENCIES = ["USD","COP","MXN"];

export function FinanceMovimientos() {
  const [movs, setMovs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [country, setCountry] = useState("all");
  const [month, setMonth] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const BLANK = {date:new Date().toISOString().slice(0,10),description:"",category:MOV_CATS[0],amount:"",currency:"USD",account:"CO",type:"ingreso",notes:""};
  const [form, setForm] = useState(BLANK);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { const d=await loadFinanceData(true); setMovs(d.movimientos||[]); }
    catch(e){ setErr("Error cargando: "+e.message); }
    setLoading(false);
  }, []);
  useEffect(()=>{load();},[load]);

  const persist = async (next) => {
    setMovs(next);
    await saveFinanceData({ movimientos: next });
  };

  const save = async () => {
    if(!form.date||!form.description.trim()||!form.amount) return;
    setSaving(true);
    try { await persist([...movs,{...form,id:uid()}]); setForm(BLANK); setShowNew(false); }
    catch(e){ alert("Error: "+e.message); }
    setSaving(false);
  };
  const remove = async (id) => {
    try { await persist(movs.filter(m=>m.id!==id)); }
    catch(e){ alert("Error: "+e.message); }
  };

  // Months from movs
  const months = [...new Set(movs.map(m=>monthKey(m.date)).filter(Boolean))].sort().reverse();

  const filtered = movs.filter(m =>
    (country==="all"||m.account===country) &&
    (month==="all"||monthKey(m.date)===month)
  ).sort((a,b)=>(b.date||"").localeCompare(a.date||""));

  const totIng  = filtered.filter(m=>m.type==="ingreso").reduce((s,m)=>s+toUSD(m.amount,m.currency),0);
  const totEgr  = filtered.filter(m=>m.type==="egreso" ).reduce((s,m)=>s+toUSD(m.amount,m.currency),0);
  const balance = totIng - totEgr;

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  return (
    <Shell title="Movimientos Bancarios">
      {err&&<Err msg={err} onRetry={load} />}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <KPICard label="Ingresos (filtro)" val={fmt$(totIng,"USD")} color="#059669" />
        <KPICard label="Egresos (filtro)"  val={fmt$(totEgr,"USD")} color="#dc2626" />
        <KPICard label="Balance neto"      val={(balance>=0?"+ ":"− ")+fmt$(balance,"USD")} color={balance>=0?"#059669":"#dc2626"} />
      </div>

      {/* Filters + new */}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14,alignItems:"center"}}>
        <div style={{display:"flex",background:WHT,border:`1px solid ${BRD}`,borderRadius:8,overflow:"hidden"}}>
          {[["all","🌎 Todos"],["CO","🇨🇴 CO"],["MX","🇲🇽 MX"]].map(([v,l])=>(
            <button key={v} onClick={()=>setCountry(v)} style={{padding:"8px 12px",fontSize:12,fontWeight:500,background:country===v?DARK:"transparent",color:country===v?WHT:MUT,border:"none",cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{...INP,width:"auto",padding:"8px 12px"}}>
          <option value="all">Todos los meses</option>
          {months.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={()=>setShowNew(v=>!v)} style={{background:DARK,color:WHT,border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:500,cursor:"pointer",marginLeft:"auto"}}>+ Nuevo movimiento</button>
      </div>

      {/* Form */}
      {showNew&&(
        <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,padding:20,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Fecha<input type="date" style={INP} value={form.date} onChange={e=>set("date",e.target.value)} /></label>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Tipo<select style={INP} value={form.type} onChange={e=>set("type",e.target.value)}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></label>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Cuenta<select style={INP} value={form.account} onChange={e=>set("account",e.target.value)}><option value="CO">Colombia 🇨🇴</option><option value="MX">México 🇲🇽</option></select></label>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:12,marginBottom:12}}>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Descripción<input type="text" style={INP} placeholder="Ej: Pago cliente Martínez" value={form.description} onChange={e=>set("description",e.target.value)} /></label>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Monto<input type="number" style={INP} placeholder="0" value={form.amount} onChange={e=>set("amount",e.target.value)} /></label>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Moneda<select style={INP} value={form.currency} onChange={e=>set("currency",e.target.value)}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></label>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Categoría<select style={INP} value={form.category} onChange={e=>set("category",e.target.value)}>{MOV_CATS.map(c=><option key={c}>{c}</option>)}</select></label>
            <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:11,color:MUT}}>Notas<input type="text" style={INP} placeholder="Opcional" value={form.notes} onChange={e=>set("notes",e.target.value)} /></label>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={save} disabled={saving||!form.description.trim()||!form.amount} style={{background:DARK,color:WHT,border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:500,cursor:"pointer",opacity:(saving||!form.description.trim()||!form.amount)?.6:1}}>{saving?"Guardando…":"Guardar"}</button>
            <button onClick={()=>setShowNew(false)} style={{background:"none",border:`1px solid ${BRD}`,borderRadius:8,padding:"9px 14px",fontSize:13,color:MUT,cursor:"pointer"}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,overflow:"hidden"}}>
        {loading?<Spinner/>:filtered.length===0?<Empty text="Sin movimientos en este filtro." />:(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:BG,borderBottom:`1px solid ${BRD}`}}>
                  {["Fecha","Descripción","Categoría","Cuenta","Monto USD","Monto original",""].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:["Monto USD","Monto original"].includes(h)?"right":"left",fontWeight:600,color:DARK,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m=>(
                  <tr key={m.id} style={{borderBottom:`1px solid rgba(26,24,20,.04)`}}>
                    <td style={{padding:"10px 14px",color:MUT,whiteSpace:"nowrap"}}>{fmtDate(m.date)}</td>
                    <td style={{padding:"10px 14px",color:DARK}}>{m.description}{m.notes&&<span style={{fontSize:11,color:GOLD,marginLeft:6}}>· {m.notes}</span>}</td>
                    <td style={{padding:"10px 14px",color:MUT,fontSize:12}}>{m.category}</td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:m.account==="CO"?"#fef3c7":"#dbeafe",color:m.account==="CO"?"#92400e":"#1e40af"}}>
                        {m.account==="CO"?"🇨🇴 CO":"🇲🇽 MX"}
                      </span>
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:m.type==="ingreso"?"#059669":"#dc2626",fontWeight:600}}>
                      {m.type==="ingreso"?"+":"−"}{fmt$(toUSD(m.amount,m.currency),"USD")}
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"right",color:MUT,fontSize:12}}>
                      {m.type==="ingreso"?"+":"−"}{m.currency} {parseFloat(m.amount||0).toLocaleString("en-US",{minimumFractionDigits:0})}
                    </td>
                    <td style={{padding:"10px 14px",textAlign:"center"}}>
                      <button onClick={()=>remove(m.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#d1c4b0",fontSize:14}} title="Eliminar">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ─── CASH FLOW ─────────────────────────────────────────────────────────────────
export function FinanceCashFlow() {
  const [movs, setMovs] = useState([]);
  const [kickoffs, setKickoffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [fd, all] = await Promise.all([
        loadFinanceData(true),
        fetchKickoffsFromSheet({ forceRefresh: true }),
      ]);
      setMovs(fd.movimientos || []);
      setKickoffs(all.filter(k => { try{ return !JSON.parse(k.conciergeSummary||"{}").type; }catch{ return true; } }));
    } catch(e) { setErr("Error cargando datos: "+e.message); }
    setLoading(false);
  }, []);
  useEffect(()=>{load();},[load]);

  const now = new Date();
  // Build 10-month window: 3 past + current + 6 future
  const months = Array.from({length:10},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-3+i, 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
      label: d.toLocaleDateString("es-CO",{month:"short",year:"2-digit"}).toUpperCase(),
      isCurrent: d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth(),
    };
  });

  // Ingresos reales por mes
  const ingresado = {};
  movs.filter(m=>m.type==="ingreso").forEach(m=>{
    const k=monthKey(m.date); if(!k) return;
    ingresado[k]=(ingresado[k]||0)+toUSD(m.amount,m.currency);
  });
  // Egresos reales por mes
  const egresado = {};
  movs.filter(m=>m.type==="egreso").forEach(m=>{
    const k=monthKey(m.date); if(!k) return;
    egresado[k]=(egresado[k]||0)+toUSD(m.amount,m.currency);
  });
  // Ingresos esperados: kickoffs con arrivalDate futuro y sin movimiento de ingreso
  const expected = {};
  kickoffs.forEach(k=>{
    if(!k.arrivalDate||k.arrivalDate<now.toISOString().slice(0,10)) return;
    const mk=monthKey(k.arrivalDate);
    // placeholder: $1 each upcoming kickoff contributes to visibility (real data comes from movimientos)
    // Just count upcoming trips as "por cobrar" marker
  });

  const maxBar = Math.max(1,...months.map(m=>Math.max(ingresado[m.key]||0, egresado[m.key]||0)));
  const totalIng = months.reduce((s,m)=>s+(ingresado[m.key]||0),0);
  const totalEgr = months.reduce((s,m)=>s+(egresado[m.key]||0),0);

  if(loading) return <Shell title="Cash Flow"><Spinner /></Shell>;

  return (
    <Shell title="Cash Flow" subtitle={now.toLocaleDateString("es-CO",{month:"long",year:"numeric"})}>
      {err&&<Err msg={err} onRetry={load} />}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <KPICard label="Ingresos (período)"  val={fmt$(totalIng,"USD")} color="#059669" />
        <KPICard label="Egresos (período)"   val={fmt$(totalEgr,"USD")} color="#dc2626" />
        <KPICard label="Resultado neto"      val={(totalIng-totalEgr>=0?"+ ":"− ")+fmt$(totalIng-totalEgr,"USD")} color={totalIng-totalEgr>=0?"#059669":"#dc2626"} />
      </div>

      {/* Dual bar chart */}
      <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,padding:"24px 20px",marginBottom:20}}>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${months.length},1fr)`,gap:4,alignItems:"end",height:180}}>
          {months.map(m=>{
            const ing=ingresado[m.key]||0;
            const egr=egresado[m.key]||0;
            return (
              <div key={m.key} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <div style={{display:"flex",gap:2,alignItems:"end",height:150}}>
                  {ing>0&&<div title={`Ingreso: ${fmt$(ing,"USD")}`} style={{width:9,background:m.isCurrent?"#059669":DARK,borderRadius:"3px 3px 0 0",height:`${(ing/maxBar)*140}px`,transition:"height .3s"}} />}
                  {egr>0&&<div title={`Egreso: ${fmt$(egr,"USD")}`}  style={{width:9,background:"#dc2626",       borderRadius:"3px 3px 0 0",height:`${(egr/maxBar)*140}px`,transition:"height .3s"}} />}
                  {ing===0&&egr===0&&<div style={{width:9,height:2,background:"#f0ece4"}} />}
                </div>
                <div style={{fontSize:9,color:m.isCurrent?GOLD:MUT,fontWeight:m.isCurrent?700:400,textAlign:"center"}}>{m.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:20,marginTop:14,fontSize:11,color:MUT}}>
          <span><span style={{display:"inline-block",width:10,height:10,background:DARK,borderRadius:2,marginRight:5,verticalAlign:"middle"}} />Ingresos</span>
          <span><span style={{display:"inline-block",width:10,height:10,background:"#dc2626",borderRadius:2,marginRight:5,verticalAlign:"middle"}} />Egresos</span>
        </div>
      </div>

      {/* Monthly table */}
      <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead>
            <tr style={{background:BG,borderBottom:`1px solid ${BRD}`}}>
              {["Mes","Ingresos","Egresos","Resultado","Acumulado"].map(h=>(
                <th key={h} style={{padding:"10px 16px",textAlign:h==="Mes"?"left":"right",fontWeight:600,color:DARK}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let acc = 0;
              return months.map(m=>{
                const ing=ingresado[m.key]||0;
                const egr=egresado[m.key]||0;
                const net=ing-egr;
                if(ing+egr===0) return null;
                acc+=net;
                return (
                  <tr key={m.key} style={{borderBottom:`1px solid rgba(26,24,20,.04)`,background:m.isCurrent?"#fffdf9":"transparent"}}>
                    <td style={{padding:"10px 16px",color:DARK,fontWeight:m.isCurrent?600:400}}>
                      {m.label}{m.isCurrent&&<span style={{fontSize:9,background:GOLD,color:WHT,padding:"1px 5px",borderRadius:8,marginLeft:6}}>HOY</span>}
                    </td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:"#059669",fontWeight:500}}>{fmt$(ing)}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:"#dc2626"}}>{egr?fmt$(egr):"—"}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:net>=0?"#059669":"#dc2626",fontWeight:600}}>{net>=0?"+":""}{fmt$(net)}</td>
                    <td style={{padding:"10px 16px",textAlign:"right",color:acc>=0?DARK:"#dc2626",fontWeight:500}}>{fmt$(acc)}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {movs.length===0&&!loading&&(
        <div style={{marginTop:20,padding:"14px 18px",background:"#fffdf9",border:`1px solid rgba(154,125,82,.18)`,borderRadius:10,fontSize:12,color:MUT}}>
          <strong style={{color:GOLD}}>Sin datos aún.</strong> Registra movimientos bancarios en <a href="/?mode=f-movimientos" style={{color:GOLD}}>Movimientos Bancarios</a> para ver el cash flow.
        </div>
      )}
    </Shell>
  );
}

// ─── CIERRE MENSUAL ────────────────────────────────────────────────────────────
const CIERRE_ITEMS = [
  {id:"bank-co",    label:"Conciliar cuentas bancarias Colombia",         cat:"Conciliación"},
  {id:"bank-mx",    label:"Conciliar cuentas bancarias México",           cat:"Conciliación"},
  {id:"com-rev",    label:"Revisar comisiones pendientes de proveedores", cat:"Proveedores"},
  {id:"com-ok",     label:"Confirmar comisiones pagadas del mes",         cat:"Proveedores"},
  {id:"pago-co",    label:"Verificar pagos pendientes Colombia",          cat:"Pagos"},
  {id:"pago-mx",    label:"Verificar pagos pendientes México",            cat:"Pagos"},
  {id:"qb-bills",   label:"Exportar bills a QuickBooks",                  cat:"Contabilidad"},
  {id:"qb-income",  label:"Registrar ingresos en QuickBooks",             cat:"Contabilidad"},
  {id:"payana",     label:"Importar pagos a Payana",                      cat:"Contabilidad"},
  {id:"ventas-com", label:"Calcular comisiones de ventas del mes",        cat:"Ventas"},
  {id:"cf-upd",     label:"Actualizar tablero de cash flow",              cat:"Control"},
  {id:"rpt-cont",   label:"Enviar reporte mensual al contador",           cat:"Cierre"},
  {id:"qb-close",   label:"Cerrar período en QuickBooks",                 cat:"Cierre"},
  {id:"aprobacion", label:"Aprobación final de cierre (dirección)",       cat:"Cierre"},
];

export function FinanceCierre() {
  const now = new Date();
  const months = Array.from({length:4},(_,i)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-2+i,1);
    return { key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`, label:d.toLocaleDateString("es-CO",{month:"long",year:"numeric"}) };
  });
  const [month, setMonth] = useState(months[2].key);
  const [checked, setChecked] = useState({});
  useEffect(()=>{ try{setChecked(JSON.parse(localStorage.getItem(`finance-cierre-${month}`)||"{}")); }catch{setChecked({});} },[month]);
  const toggle = id => {
    const next={...checked,[id]:!checked[id]};
    setChecked(next);
    try{localStorage.setItem(`finance-cierre-${month}`,JSON.stringify(next));}catch{}
  };
  const done = CIERRE_ITEMS.filter(i=>checked[i.id]).length;
  const pct  = Math.round((done/CIERRE_ITEMS.length)*100);
  const grouped = CIERRE_ITEMS.reduce((acc,item)=>({...acc,[item.cat]:[...(acc[item.cat]||[]),item]}),{});

  return (
    <Shell title="Cierre Mensual">
      <div style={{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"}}>
        {months.map(m=>(
          <button key={m.key} onClick={()=>setMonth(m.key)} style={{padding:"8px 16px",fontSize:12,fontWeight:500,background:month===m.key?DARK:WHT,color:month===m.key?WHT:MUT,border:`1px solid ${BRD}`,borderRadius:8,cursor:"pointer",textTransform:"capitalize"}}>{m.label}</button>
        ))}
      </div>

      {/* Progress */}
      <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div>
            <span style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:34,fontWeight:500,color:DARK}}>{pct}%</span>
            <span style={{fontSize:13,color:MUT,marginLeft:12}}>{done} de {CIERRE_ITEMS.length} tareas completadas</span>
          </div>
          {pct===100&&<span style={{fontSize:13,fontWeight:600,color:"#059669",background:"#d1fae5",padding:"4px 14px",borderRadius:20}}>✓ Cierre completo</span>}
        </div>
        <div style={{height:6,background:"#f0ece4",borderRadius:3}}>
          <div style={{height:"100%",width:`${pct}%`,background:pct===100?"#059669":GOLD,borderRadius:3,transition:"width .4s ease"}} />
        </div>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {Object.entries(grouped).map(([cat,items])=>(
          <div key={cat} style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,overflow:"hidden"}}>
            <div style={{padding:"9px 16px",background:BG,borderBottom:`1px solid rgba(26,24,20,.06)`,fontSize:10,fontWeight:700,color:GOLD,textTransform:"uppercase",letterSpacing:".1em"}}>{cat}</div>
            {items.map((item,idx)=>(
              <div key={item.id} onClick={()=>toggle(item.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:idx<items.length-1?`1px solid rgba(26,24,20,.04)`:"none",cursor:"pointer",background:checked[item.id]?"#fffdf9":"transparent",transition:"background .15s"}}>
                <div style={{width:20,height:20,borderRadius:5,border:checked[item.id]?"none":`2px solid #d1c4b0`,background:checked[item.id]?GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s"}}>
                  {checked[item.id]&&<span style={{color:WHT,fontSize:11,fontWeight:700,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:13,color:checked[item.id]?GOLD:DARK,textDecoration:checked[item.id]?"line-through":"none",transition:"color .15s"}}>{item.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
function downloadCSV(filename, headers, rows) {
  const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
  const a=Object.assign(document.createElement("a"),{href:URL.createObjectURL(blob),download:filename});
  a.click(); URL.revokeObjectURL(a.href);
}
const today = new Date().toISOString().slice(0,10);
const mm = today.slice(0,7);

export function FinanceTemplates() {
  const templates = [
    {
      icon:"📥", label:"Payana — Importar pagos",
      desc:"CSV con el formato de columnas que requiere Payana para cargar órdenes de pago.",
      action:()=>downloadCSV("payana-pagos.csv",
        ["Fecha","Proveedor","NIT/RUT","Banco","No. Cuenta","Tipo Cuenta","Monto","Moneda","Concepto","Referencia"],
        [[today,"Proveedor Ejemplo","900123456-1","Bancolombia","12345678901","Ahorros","500000","COP","Servicio "+mm,"REF-001"],
         [today,"Otro Proveedor S.A.S","800987654-3","Davivienda","98765432101","Corriente","1200000","COP","Comisión tour","REF-002"]]
      ),
    },
    {
      icon:"📤", label:"QuickBooks — Bills (cuentas por pagar)",
      desc:"CSV para importar bills a QuickBooks Online desde el módulo de proveedores.",
      action:()=>downloadCSV("qb-bills.csv",
        ["BillNo","Vendor","BillDate","DueDate","Item","Description","Qty","Rate","Amount","Class","Location"],
        [["BILL-001","Proveedor Ejemplo",today,today,"Services","Servicio turístico "+mm,"1","500","500","Colombia","Cartagena"],
         ["BILL-002","Otro Proveedor",today,today,"Services","Comisión actividad","1","200","200","Mexico","CDMX"]]
      ),
    },
    {
      icon:"📋", label:"QuickBooks — Estimates / Cotizaciones",
      desc:"CSV para importar cotizaciones y presupuestos a QuickBooks Online.",
      action:()=>downloadCSV("qb-estimates.csv",
        ["EstimateNo","Customer","Date","ExpiryDate","Item","Description","Qty","Rate","Amount","Class"],
        [["EST-001","Cliente Ejemplo",today,today,"Trip Package","Paquete viaje "+mm,"1","2500","2500","Colombia"],
         ["EST-002","Otro Cliente",today,today,"Trip Package","Paquete Cartagena 5 noches","1","3200","3200","Colombia"]]
      ),
    },
    {
      icon:"🔄", label:"Conciliación Bancaria",
      desc:"Plantilla de trabajo para conciliar extractos bancarios contra registros internos.",
      action:()=>downloadCSV("conciliacion-bancaria.csv",
        ["Fecha","Descripción","Referencia","Débito","Crédito","Saldo","Conciliado (S/N)","Cuenta","País","Notas"],
        [[today,"Depósito cliente","TXN-001","","2500000","2500000","N","Bancolombia 1234","CO",""],
         [today,"Pago a proveedor","TXN-002","500000","","2000000","N","Bancolombia 1234","CO",""]]
      ),
    },
    {
      icon:"💸", label:"Solicitud de pago — Colombia",
      desc:"Plantilla de solicitud de pago en COP para enviar al cliente colombiano.",
      action:()=>downloadCSV("solicitud-pago-co.csv",
        ["Cliente","Concepto","Monto COP","Banco destino","No. Cuenta","Tipo","Fecha límite","Referencia"],
        [["Cliente Ejemplo","Paquete Cartagena 3 noches","3500000","Bancolombia","12345678901","Ahorros",today,"REF-CO-001"]]
      ),
    },
    {
      icon:"🇲🇽", label:"Solicitud de pago — México",
      desc:"Plantilla de solicitud de pago en MXN para cliente mexicano vía SPEI.",
      action:()=>downloadCSV("solicitud-pago-mx.csv",
        ["Cliente","Concepto","Monto MXN","CLABE","Banco","Fecha límite","Referencia"],
        [["Cliente MX","Tour CDMX 2 noches","18000","646180157000000004","BBVA México",today,"REF-MX-001"]]
      ),
    },
  ];

  return (
    <Shell title="Templates" subtitle="Descarga · rellena · importa">
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        {templates.map(t=>(
          <div key={t.label} style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,padding:"20px 22px",display:"flex",flexDirection:"column"}}>
            <div style={{fontSize:28,marginBottom:10}}>{t.icon}</div>
            <div style={{fontWeight:600,fontSize:14,color:DARK,marginBottom:5}}>{t.label}</div>
            <div style={{fontSize:12,color:MUT,marginBottom:18,lineHeight:1.6,flex:1}}>{t.desc}</div>
            <button onClick={t.action} style={{background:DARK,color:WHT,border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:500,cursor:"pointer",alignSelf:"flex-start"}}>↓ Descargar CSV</button>
          </div>
        ))}
      </div>
      <div style={{padding:"14px 18px",background:"#fffdf9",border:`1px solid rgba(154,125,82,.18)`,borderRadius:10,fontSize:12,color:MUT,lineHeight:1.6}}>
        <strong style={{color:GOLD}}>Nota:</strong> Todos los CSV incluyen BOM UTF-8 para compatibilidad con Excel en español. Las filas de ejemplo son solo referencia — reemplázalas con datos reales antes de importar.
      </div>
    </Shell>
  );
}

// ─── RESERVACIONES & VENTAS ───────────────────────────────────────────────────
export function FinanceReservaciones() {
  const [kickoffs, setKickoffs] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [filter,   setFilter]   = useState("upcoming");
  const [search,   setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const all = await fetchKickoffsFromSheet({ forceRefresh: true });
      // Exclude special kickoffs (bodas, financeData, etc.)
      setKickoffs(all.filter(k => { try{ const t=JSON.parse(k.conciergeSummary||"{}").type; return !t; }catch{ return true; } }));
    } catch(e) { setErr("Error cargando: "+e.message); }
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const now = new Date().toISOString().slice(0,10);

  const list = kickoffs
    .filter(k => {
      if(!k.arrivalDate) return filter==="all";
      if(filter==="upcoming") return k.arrivalDate >= now;
      if(filter==="past")     return k.arrivalDate <  now;
      return true;
    })
    .filter(k => !search || (k.guestName||"").toLowerCase().includes(search.toLowerCase()) || (k.destination||k.city||"").toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(a.arrivalDate||"").localeCompare(b.arrivalDate||""));

  // KPIs
  const upcomingCount = kickoffs.filter(k=>k.arrivalDate&&k.arrivalDate>=now).length;
  const thisMonth     = kickoffs.filter(k=>k.arrivalDate&&k.arrivalDate.slice(0,7)===now.slice(0,7)).length;
  const statusOk      = kickoffs.filter(k=>k.status==="confirmed").length;

  return (
    <Shell title="Reservaciones & Ventas">
      {err&&<Err msg={err} onRetry={load} />}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        <KPICard label="Reservaciones totales" val={kickoffs.length} />
        <KPICard label="Próximas"               val={upcomingCount}  color={GOLD} />
        <KPICard label="Este mes"               val={thisMonth}      color="#059669" />
      </div>

      {/* Filters */}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16,alignItems:"center"}}>
        <div style={{display:"flex",background:WHT,border:`1px solid ${BRD}`,borderRadius:8,overflow:"hidden"}}>
          {[["upcoming","Próximas"],["past","Pasadas"],["all","Todas"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{padding:"8px 14px",fontSize:12,fontWeight:500,background:filter===v?DARK:"transparent",color:filter===v?WHT:MUT,border:"none",cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar cliente o destino..." style={{...INP,flex:1,minWidth:180,padding:"8px 12px"}} />
      </div>

      {/* Table */}
      <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,overflow:"hidden"}}>
        {loading?<Spinner/>:list.length===0?<Empty text="Sin reservaciones en este filtro." />:(
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:BG,borderBottom:`1px solid ${BRD}`}}>
                  {["Cliente","Llegada","Salida","Destino","Concierge","Noches","Estado"].map(h=>(
                    <th key={h} style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:DARK,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(k=>{
                  const nights=k.arrivalDate&&k.departureDate?Math.round((new Date(k.departureDate+"T12:00:00")-new Date(k.arrivalDate+"T12:00:00"))/86400000):null;
                  const sc={confirmed:["#d1fae5","#065f46"],pending:["#fef3c7","#92400e"],cancelled:["#fee2e2","#991b1b"]};
                  const [bg2,fg2]=sc[k.status]||["#f3f4f6","#6b7280"];
                  const isPast=k.arrivalDate&&k.arrivalDate<now;
                  return (
                    <tr key={k.id} style={{borderBottom:`1px solid rgba(26,24,20,.04)`,opacity:isPast?.65:1}}>
                      <td style={{padding:"10px 14px",color:DARK,fontWeight:500}}>{k.guestName||"—"}</td>
                      <td style={{padding:"10px 14px",color:MUT,whiteSpace:"nowrap"}}>{fmtDate(k.arrivalDate)}</td>
                      <td style={{padding:"10px 14px",color:MUT,whiteSpace:"nowrap"}}>{fmtDate(k.departureDate)}</td>
                      <td style={{padding:"10px 14px",color:MUT}}>{k.destination||k.city||"—"}</td>
                      <td style={{padding:"10px 14px",color:MUT}}>{k.assignedConciergeName||"—"}</td>
                      <td style={{padding:"10px 14px",color:MUT,textAlign:"center"}}>{nights!==null?nights+"n":"—"}</td>
                      <td style={{padding:"10px 14px"}}>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:bg2,color:fg2}}>{k.status||"—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
