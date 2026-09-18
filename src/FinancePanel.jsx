import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { fetchKickoffsFromSheet, saveKickoffToSheet, updateKickoffInSheet } from "./sheetServices";
import { supabase } from "./supabaseClient";

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
async function loadReservations() {
  const { data, error } = await supabase.from("kickoffs").select("data").eq("id", "finance_reservations_v1").single();
  if (error) throw new Error(error.message);
  const d = data?.data || {};
  const notes = typeof d.internalNotes === "string" ? JSON.parse(d.internalNotes) : (d.internalNotes || {});
  return notes.reservations || [];
}

async function saveReservations(rows) {
  const { data: existing, error: fetchErr } = await supabase.from("kickoffs").select("data").eq("id", "finance_reservations_v1").single();
  if (fetchErr) throw new Error(fetchErr.message);
  const d = existing?.data || {};
  const notes = typeof d.internalNotes === "string" ? JSON.parse(d.internalNotes) : (d.internalNotes || {});
  const merged = { ...d, internalNotes: JSON.stringify({ ...notes, reservations: rows }) };
  const { error } = await supabase.from("kickoffs").update({ data: merged }).eq("id", "finance_reservations_v1");
  if (error) throw new Error(error.message);
}

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
function monthLabel(ym) {
  const [y,m] = ym.split("-");
  return `${MONTH_NAMES[parseInt(m,10)-1]} ${y}`;
}

const ALL_COLS = [
  { key:"name",        label:"Cliente",         w:160, num:false },
  { key:"salesRep",    label:"Sales Rep",        w:110, num:false, optKey:"salesRep" },
  { key:"dealSource",  label:"Deal Source",      w:110, num:false, optKey:"dealSource" },
  { key:"type",        label:"Customer Type",    w:120, num:false, optKey:"type" },
  { key:"checkIn",     label:"Check In",         w:100, num:false, date:true },
  { key:"checkOut",    label:"Check Out",        w:100, num:false, date:true },
  { key:"property",    label:"Property",         w:120, num:false },
  { key:"city",        label:"City",             w:90,  num:false },
  { key:"qty",         label:"Cant.",            w:60,  num:true  },
  { key:"rate",        label:"Rate",             w:80,  num:true  },
  { key:"tax",         label:"Tax",              w:70,  num:true  },
  { key:"total",       label:"Total Amount",     w:100, num:true  },
  { key:"commission",  label:"Commission",       w:100, num:true  },
  { key:"ourPrice",    label:"Our Price",        w:90,  num:true  },
  { key:"status",      label:"Status",           w:100, num:false },
  { key:"confirmedAt", label:"Fecha Confirm.",   w:110, num:false, date:true },
];

const STATUS_OPTS = ["Confirmed","Cancelled",""];

function EditCell({ value, field, onSave, isNum, isDate, options }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const ref = useRef();
  const dlId = useRef(`dl-${field}-${Math.random().toString(36).slice(2)}`).current;

  if (!editing) {
    const display = isNum && val !== "" && val !== null
      ? (["total","commission","rate","ourPrice","tax"].includes(field) ? fmt$(parseFloat(val)||0) : val)
      : (val || "");
    return (
      <div onClick={()=>{ setVal(value??""); setEditing(true); }}
        style={{minWidth:isNum?60:80, cursor:"text", padding:"2px 4px", borderRadius:4,
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          color: field==="status" ? (val==="Confirmed"?"#065f46":val==="Cancelled"?"#991b1b":DARK) : (isNum?DARK:MUT),
          fontWeight: ["total","name"].includes(field)?600:400,
          background:"transparent",
        }}
        title={String(val||"")}>
        {field==="status"
          ? <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
              <span style={{width:6,height:6,borderRadius:"50%",display:"inline-block",flexShrink:0,
                background:val==="Confirmed"?"#10b981":val==="Cancelled"?"#f87171":"#d1d5db"}}/>
              {val||"—"}
            </span>
          : (display || <span style={{color:"#d1d5db",fontSize:11}}>—</span>)
        }
      </div>
    );
  }

  const finish = () => {
    setEditing(false);
    if (String(val??"") !== String(value??"")) onSave(val);
  };

  if (field === "status") {
    return (
      <select autoFocus value={val} onChange={e=>setVal(e.target.value)} onBlur={finish}
        style={{fontSize:11,border:"1px solid "+GOLD,borderRadius:4,padding:"2px 4px",background:WHT,fontFamily:"'Jost',sans-serif",outline:"none",minWidth:100}}>
        {STATUS_OPTS.map(o=><option key={o} value={o}>{o||"—"}</option>)}
      </select>
    );
  }

  if (options?.length && !isDate && !isNum) {
    return (
      <>
        <input ref={ref} autoFocus value={val} list={dlId}
          onChange={e=>setVal(e.target.value)}
          onBlur={finish}
          onKeyDown={e=>{ if(e.key==="Enter") finish(); if(e.key==="Escape"){ setEditing(false); setVal(value??""); } }}
          style={{fontSize:11,border:"1px solid "+GOLD,borderRadius:4,padding:"2px 6px",
            width:"100%",minWidth:100,maxWidth:200,boxSizing:"border-box",
            background:WHT,fontFamily:"'Jost',sans-serif",outline:"none"}} />
        <datalist id={dlId}>
          {options.map(o=><option key={o} value={o}/>)}
        </datalist>
      </>
    );
  }

  return (
    <input ref={ref} autoFocus value={val} type={isDate?"date":isNum?"number":"text"}
      onChange={e=>setVal(e.target.value)}
      onBlur={finish}
      onKeyDown={e=>{ if(e.key==="Enter") finish(); if(e.key==="Escape"){ setEditing(false); setVal(value??""); } }}
      style={{fontSize:11,border:"1px solid "+GOLD,borderRadius:4,padding:"2px 6px",width:"100%",
        minWidth: isNum?60:isDate?110:100, maxWidth:200, boxSizing:"border-box",
        background:WHT, fontFamily:"'Jost',sans-serif", outline:"none"}} />
  );
}

// ── Calendar (Gantt-style) ────────────────────────────────────────────────────
function ReservationsCalendar({ rows }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const days = Array.from({length:daysInMonth},(_,i)=>i+1);
  const ym   = `${year}-${String(month+1).padStart(2,"0")}`;

  const prev = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const next = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const visible = rows.filter(r => {
    const ci = r.checkIn?.slice(0,7);
    const co = r.checkOut?.slice(0,7);
    return ci <= ym && (!co || co >= ym);
  }).sort((a,b)=>(a.checkIn||"").localeCompare(b.checkIn||""));

  const statusColor = s => s==="Confirmed"?"#2d6a4f":s==="Cancelled"?"#9b2335":"#b45309";
  const statusBg    = s => s==="Confirmed"?"#d1fae5":s==="Cancelled"?"#fee2e2":"#fef3c7";

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <button onClick={prev} style={{padding:"6px 12px",fontSize:13,background:"transparent",color:DARK,border:`1px solid ${BRD}`,borderRadius:8,cursor:"pointer"}}>‹</button>
        <span style={{fontWeight:700,fontSize:15,color:DARK,minWidth:180,textAlign:"center"}}>{MONTH_NAMES[month]} {year}</span>
        <button onClick={next} style={{padding:"6px 12px",fontSize:13,background:"transparent",color:DARK,border:`1px solid ${BRD}`,borderRadius:8,cursor:"pointer"}}>›</button>
      </div>
      <div style={{overflowX:"auto"}}>
        <div style={{minWidth:200+daysInMonth*30}}>
          {/* Day header */}
          <div style={{display:"flex",marginBottom:4}}>
            <div style={{width:200,flexShrink:0}}/>
            {days.map(d=>{
              const dow=new Date(`${ym}-${String(d).padStart(2,"0")}T12:00:00`).getDay();
              const isToday=d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();
              return (
                <div key={d} style={{width:30,flexShrink:0,textAlign:"center",fontSize:10,fontWeight:isToday?700:400,
                  color:isToday?GOLD:dow===0||dow===6?"#9ca3af":MUT,padding:"3px 0",
                  background:isToday?"rgba(192,160,98,.12)":"transparent",borderRadius:4}}>
                  {d}
                </div>
              );
            })}
          </div>
          {/* Reservation rows */}
          {visible.length===0
            ? <div style={{color:MUT,fontSize:13,padding:"20px 0"}}>No hay reservaciones en {MONTH_NAMES[month]} {year}.</div>
            : visible.map((r,ri)=>(
              <div key={ri} style={{display:"flex",alignItems:"center",marginBottom:3,minHeight:26}}>
                <div style={{width:200,flexShrink:0,fontSize:11,fontWeight:600,color:DARK,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:10}}>
                  {r.name||"—"}
                  <span style={{fontSize:10,fontWeight:400,color:MUT,marginLeft:4}}>{r.salesRep||""}</span>
                </div>
                {days.map(d=>{
                  const ds=`${ym}-${String(d).padStart(2,"0")}`;
                  const inRange=r.checkIn&&r.checkOut&&ds>=r.checkIn.slice(0,10)&&ds<=r.checkOut.slice(0,10);
                  const isStart=ds===r.checkIn?.slice(0,10);
                  const isEnd  =ds===r.checkOut?.slice(0,10);
                  const dow=new Date(ds+"T12:00:00").getDay();
                  return (
                    <div key={d} style={{width:30,flexShrink:0,height:22,
                      background:inRange?statusBg(r.status):dow===0||dow===6?"rgba(0,0,0,.025)":"transparent",
                      borderTop:inRange?`1px solid ${statusColor(r.status)}50`:undefined,
                      borderBottom:inRange?`1px solid ${statusColor(r.status)}50`:undefined,
                      borderLeft:isStart?`3px solid ${statusColor(r.status)}`:undefined,
                      borderRight:isEnd?`3px solid ${statusColor(r.status)}`:undefined,
                      borderRadius:isStart&&isEnd?6:isStart?"6px 0 0 6px":isEnd?"0 6px 6px 0":0,
                    }}/>
                  );
                })}
              </div>
            ))
          }
        </div>
      </div>
      <div style={{display:"flex",gap:16,marginTop:16,flexWrap:"wrap"}}>
        {[["Confirmed","#2d6a4f","#d1fae5"],["Cancelled","#9b2335","#fee2e2"],["Other","#b45309","#fef3c7"]].map(([l,c,bg])=>(
          <span key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:MUT}}>
            <span style={{width:16,height:10,background:bg,border:`2px solid ${c}`,borderRadius:3,display:"inline-block"}}/>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function ReservationsDashboard({ rows }) {
  const confirmed = rows.filter(r=>r.status==="Confirmed");
  const totalRev  = confirmed.reduce((s,r)=>s+(parseFloat(r.total)||0),0);
  const totalComm = confirmed.reduce((s,r)=>s+(parseFloat(r.commission)||0),0);
  const avgDeal   = confirmed.length ? totalRev/confirmed.length : 0;

  const byMonth={}, byRep={}, byType={}, bySource={};
  confirmed.forEach(r=>{
    const m=r.checkIn?.slice(0,7); if(m) byMonth[m]=(byMonth[m]||0)+(parseFloat(r.total)||0);
    const rep=r.salesRep||"Sin asignar"; byRep[rep]=(byRep[rep]||0)+(parseFloat(r.total)||0);
    const tp=r.type||"Sin tipo"; byType[tp]=(byType[tp]||0)+1;
    const src=r.dealSource||"Sin fuente"; bySource[src]=(bySource[src]||0)+1;
  });

  const monthEntries  = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0]));
  const repEntries    = Object.entries(byRep).sort((a,b)=>b[1]-a[1]);
  const typeEntries   = Object.entries(byType).sort((a,b)=>b[1]-a[1]);
  const sourceEntries = Object.entries(bySource).sort((a,b)=>b[1]-a[1]);

  const maxM = Math.max(1,...monthEntries.map(([,v])=>v));
  const maxR = Math.max(1,...repEntries.map(([,v])=>v));

  const BarRow = ({label,val,max,color,fmt}) => (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
      <div style={{width:110,fontSize:11,color:MUT,textAlign:"right",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={label}>{label}</div>
      <div style={{flex:1,height:18,background:"rgba(0,0,0,.06)",borderRadius:4,overflow:"hidden"}}>
        <div style={{width:`${(val/max)*100}%`,height:"100%",background:color,borderRadius:4}}/>
      </div>
      <div style={{width:80,fontSize:11,fontWeight:600,color:DARK,textAlign:"right",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{fmt(val)}</div>
    </div>
  );

  const Section = ({title,children}) => (
    <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,padding:20,marginBottom:16}}>
      <div style={{fontWeight:700,fontSize:13,color:DARK,marginBottom:14}}>{title}</div>
      {children}
    </div>
  );

  const ListRow = ({label,val}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"6px 0",borderBottom:`1px solid ${BRD}`,fontSize:12}}>
      <span style={{color:MUT}}>{label}</span>
      <span style={{fontWeight:700,color:DARK}}>{val}</span>
    </div>
  );

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        <KPICard label="Confirmadas" val={confirmed.length} color="#065f46"/>
        <KPICard label="Revenue Total" val={fmt$(totalRev)} color={GOLD}/>
        <KPICard label="Comisiones" val={fmt$(totalComm)} color="#1d4ed8"/>
        <KPICard label="Deal Promedio" val={fmt$(avgDeal)} color={MUT}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Section title="Revenue por Mes">
          {monthEntries.length===0 ? <span style={{fontSize:12,color:MUT}}>Sin datos</span>
            : monthEntries.map(([m,v])=><BarRow key={m} label={monthLabel(m)} val={v} max={maxM} color={GOLD} fmt={fmt$}/>)}
        </Section>
        <Section title="Revenue por Sales Rep">
          {repEntries.length===0 ? <span style={{fontSize:12,color:MUT}}>Sin datos</span>
            : repEntries.map(([k,v])=><BarRow key={k} label={k} val={v} max={maxR} color="#6366f1" fmt={fmt$}/>)}
        </Section>
        <Section title="Reservaciones por Customer Type">
          {typeEntries.length===0 ? <span style={{fontSize:12,color:MUT}}>Sin datos</span>
            : typeEntries.map(([k,v])=><ListRow key={k} label={k} val={v}/>)}
        </Section>
        <Section title="Reservaciones por Deal Source">
          {sourceEntries.length===0 ? <span style={{fontSize:12,color:MUT}}>Sin datos</span>
            : sourceEntries.map(([k,v])=><ListRow key={k} label={k} val={v}/>)}
        </Section>
      </div>
    </div>
  );
}

export function FinanceReservaciones() {
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");
  const [view,     setView]     = useState("tabla");
  const [search,   setSearch]   = useState("");
  const [typeF,    setTypeF]    = useState("all");
  const [repF,     setRepF]     = useState("all");
  const [statusF,  setStatusF]  = useState("all");
  const [monthF,   setMonthF]   = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [sortCol,  setSortCol]  = useState("checkIn");
  const [sortDir,  setSortDir]  = useState(1);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    try { setRows(await loadReservations()); }
    catch(e) { setErr("Error cargando: "+e.message); }
    setLoading(false);
  }, []);
  useEffect(()=>{load();},[load]);

  const patchRow = useCallback(async (rowIdx, field, val) => {
    const updated = rows.map((r,i) => i===rowIdx ? {...r,[field]:val} : r);
    setRows(updated);
    setSaving(true);
    try { await saveReservations(updated); }
    catch(e) { setErr("Error guardando: "+e.message); }
    setSaving(false);
  }, [rows]);

  const addRow = async () => {
    const blank = { name:"", salesRep:"", dealSource:"", type:"", checkIn:"", checkOut:"",
      property:"", city:"", qty:"", rate:"", tax:"", total:"", commission:"", ourPrice:"",
      status:"Confirmed", confirmedAt:"" };
    const updated = [blank, ...rows];
    setRows(updated);
    setSaving(true);
    try { await saveReservations(updated); }
    catch(e) { setErr("Error guardando: "+e.message); }
    setSaving(false);
  };

  const deleteRow = async (idx) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    const updated = rows.filter((_,i)=>i!==idx);
    setRows(updated);
    setSaving(true);
    try { await saveReservations(updated); }
    catch(e) { setErr("Error guardando: "+e.message); }
    setSaving(false);
  };

  const repOpts    = [...new Set(rows.map(r=>r.salesRep).filter(Boolean))].sort();
  const sourceOpts = [...new Set(rows.map(r=>r.dealSource).filter(Boolean))].sort();
  const typeOpts   = [...new Set(rows.map(r=>r.type).filter(Boolean))].sort();
  const cellOpts   = { salesRep:repOpts, dealSource:sourceOpts, type:typeOpts };

  const months = ["all",...[...new Set(rows.map(r=>r.checkIn?.slice(0,7)).filter(Boolean))].sort()];

  const filteredIdxs = rows.reduce((acc,r,i)=>{
    if (statusF!=="all" && r.status!==statusF) return acc;
    if (typeF!=="all"   && r.type!==typeF)     return acc;
    if (repF!=="all"    && r.salesRep!==repF)  return acc;
    if (monthF!=="all"  && r.checkIn?.slice(0,7)!==monthF) return acc;
    if (dateFrom && r.checkIn && r.checkIn < dateFrom) return acc;
    if (dateTo   && r.checkIn && r.checkIn > dateTo)   return acc;
    if (search) {
      const q=search.toLowerCase();
      if (!(r.name||"").toLowerCase().includes(q) &&
          !(r.salesRep||"").toLowerCase().includes(q) &&
          !(r.type||"").toLowerCase().includes(q) &&
          !(r.property||"").toLowerCase().includes(q) &&
          !(r.city||"").toLowerCase().includes(q)) return acc;
    }
    acc.push(i);
    return acc;
  },[]);

  const sorted = [...filteredIdxs].sort((ai,bi)=>{
    const a=rows[ai][sortCol]??"", b=rows[bi][sortCol]??"";
    return a<b?-sortDir:a>b?sortDir:0;
  });

  const confirmed = sorted.filter(i=>rows[i].status==="Confirmed");
  const totalRev  = confirmed.reduce((s,i)=>s+(parseFloat(rows[i].total)||0),0);
  const totalComm = confirmed.reduce((s,i)=>s+(parseFloat(rows[i].commission)||0),0);
  const totalTax  = confirmed.reduce((s,i)=>s+(parseFloat(rows[i].tax)||0),0);

  const thStyle = (col) => ({
    padding:"9px 10px", textAlign:"left", fontWeight:600, color:DARK, whiteSpace:"nowrap",
    fontSize:11, cursor:"pointer", userSelect:"none", position:"sticky", top:0, zIndex:1,
    background: sortCol===col ? "#e8e0d4" : BG, borderBottom:`1px solid ${BRD}`,
  });
  const sortBy = (col) => { if(sortCol===col) setSortDir(d=>-d); else { setSortCol(col); setSortDir(1); } };

  // Group by check-in month for table view
  const groups = [];
  let curMk = null;
  sorted.forEach(rowIdx => {
    const mk = rows[rowIdx].checkIn?.slice(0,7) || "";
    if (mk !== curMk) { curMk = mk; groups.push({mk, idxs:[]}); }
    groups[groups.length-1].idxs.push(rowIdx);
  });

  const TabBtn = ({label,k}) => (
    <button onClick={()=>setView(k)}
      style={{padding:"7px 18px",fontSize:12,fontWeight:600,
        background:view===k?DARK:"transparent",color:view===k?WHT:MUT,
        border:`1px solid ${BRD}`,borderRadius:8,cursor:"pointer"}}>
      {label}
    </button>
  );

  return (
    <Shell title="Reservaciones & Ventas" subtitle={`${sorted.length} de ${rows.length} registros${saving?" · Guardando…":""}`}>
      {err&&<Err msg={err} onRetry={load} />}

      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <TabBtn label="Tabla" k="tabla"/>
        <TabBtn label="Calendario" k="calendario"/>
        <TabBtn label="Dashboard" k="dashboard"/>
      </div>

      {view==="calendario" && <ReservationsCalendar rows={rows}/>}
      {view==="dashboard"  && <ReservationsDashboard rows={rows}/>}

      {view==="tabla" && (
        <>
          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
            <KPICard label="Confirmadas" val={confirmed.length} color="#065f46" />
            <KPICard label="Revenue total" val={fmt$(totalRev)} color={GOLD} />
            <KPICard label="Comisiones" val={fmt$(totalComm)} color="#1d4ed8" />
            <KPICard label="Tax total" val={fmt$(totalTax)} color={MUT} />
          </div>

          {/* Toolbar */}
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14,alignItems:"center"}}>
            <button onClick={addRow}
              style={{padding:"7px 14px",fontSize:12,fontWeight:600,background:GOLD,color:WHT,border:"none",borderRadius:8,cursor:"pointer",whiteSpace:"nowrap"}}>
              + Nueva fila
            </button>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar…"
              style={{...INP,width:160,padding:"7px 12px",fontSize:12}} />
            <div style={{display:"flex",background:WHT,border:`1px solid ${BRD}`,borderRadius:8,overflow:"hidden"}}>
              {[["all","Todos"],["Confirmed","✓ Conf"],["Cancelled","✗ Canc"]].map(([v,l])=>(
                <button key={v} onClick={()=>setStatusF(v)}
                  style={{padding:"7px 10px",fontSize:11,fontWeight:500,whiteSpace:"nowrap",
                    background:statusF===v?DARK:"transparent",color:statusF===v?WHT:MUT,border:"none",cursor:"pointer"}}>
                  {l}
                </button>
              ))}
            </div>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)}
              style={{...INP,width:"auto",padding:"7px 10px",fontSize:12,minWidth:130}}>
              <option value="all">Customer Type</option>
              {typeOpts.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select value={repF} onChange={e=>setRepF(e.target.value)}
              style={{...INP,width:"auto",padding:"7px 10px",fontSize:12,minWidth:120}}>
              <option value="all">Sales Rep</option>
              {repOpts.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
            <select value={monthF} onChange={e=>setMonthF(e.target.value)}
              style={{...INP,width:"auto",padding:"7px 10px",fontSize:12,minWidth:130}}>
              <option value="all">Mes</option>
              {months.filter(m=>m!=="all").map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            {/* Date range */}
            <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:MUT,whiteSpace:"nowrap"}}>
              <span>De</span>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
                style={{...INP,padding:"6px 8px",fontSize:11,width:130}}/>
              <span>a</span>
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
                style={{...INP,padding:"6px 8px",fontSize:11,width:130}}/>
              {(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");}}
                style={{background:"none",border:"none",color:MUT,cursor:"pointer",fontSize:13,padding:"0 2px"}}>✕</button>}
            </div>
          </div>

          {/* Table */}
          <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,overflow:"hidden"}}>
            {loading ? <Spinner/> : sorted.length===0 ? <Empty text="Sin resultados." /> : (
              <div style={{overflowX:"auto",maxHeight:"70vh",overflowY:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr>
                      {ALL_COLS.map(c=>(
                        <th key={c.key} onClick={()=>sortBy(c.key)} style={{...thStyle(c.key),minWidth:c.w}}>
                          {c.label}{sortCol===c.key?(sortDir===1?" ↑":" ↓"):""}
                        </th>
                      ))}
                      <th style={{...thStyle(null),cursor:"default",minWidth:36}}/>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(({mk, idxs}) => (
                      <Fragment key={mk||"nodate"}>
                        {mk && (
                          <tr>
                            <td colSpan={ALL_COLS.length+1}
                              style={{padding:"10px 12px 6px",fontSize:11,fontWeight:700,
                                color:GOLD,letterSpacing:.5,background:"rgba(192,160,98,.08)",
                                borderTop:`2px solid ${BRD}`,textTransform:"uppercase"}}>
                              {monthLabel(mk)} · {idxs.filter(i=>rows[i].status==="Confirmed").length} confirmadas
                            </td>
                          </tr>
                        )}
                        {idxs.map((rowIdx,vi)=>(
                          <tr key={rowIdx} style={{borderBottom:`1px solid rgba(26,24,20,.04)`,background:vi%2===0?"transparent":"rgba(247,244,239,.35)"}}>
                            {ALL_COLS.map(c=>(
                              <td key={c.key} style={{padding:"5px 8px",verticalAlign:"middle",maxWidth:c.w+40}}>
                                <EditCell
                                  value={rows[rowIdx][c.key]}
                                  field={c.key}
                                  isNum={c.num}
                                  isDate={c.date}
                                  options={cellOpts[c.key]}
                                  onSave={val=>patchRow(rowIdx, c.key, val)}
                                />
                              </td>
                            ))}
                            <td style={{padding:"5px 6px",textAlign:"center",verticalAlign:"middle"}}>
                              <button onClick={()=>deleteRow(rowIdx)}
                                style={{background:"none",border:"none",color:"#d1d5db",cursor:"pointer",fontSize:14,lineHeight:1,padding:2}}
                                title="Eliminar fila">×</button>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{background:BG,borderTop:`2px solid ${BRD}`,position:"sticky",bottom:0}}>
                      <td colSpan={11} style={{padding:"9px 10px",color:MUT,fontSize:11,fontWeight:600}}>
                        TOTALES — {confirmed.length} confirmadas de {sorted.length} visibles
                      </td>
                      <td style={{padding:"9px 10px",color:DARK,textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{fmt$(totalRev)}</td>
                      <td style={{padding:"9px 10px",color:"#1d4ed8",textAlign:"right",fontWeight:700,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{fmt$(totalComm)}</td>
                      <td colSpan={4}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
