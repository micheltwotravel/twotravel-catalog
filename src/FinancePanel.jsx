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

// ── Calendar ─────────────────────────────────────────────────────────────────
function ReservationsCalendar({ rows }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [calView, setCalView] = useState("lista"); // "gantt" | "lista"

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
  const statusDot   = s => s==="Confirmed"?"#10b981":s==="Cancelled"?"#f87171":"#fbbf24";

  const nights = (ci,co) => {
    if (!ci||!co) return "—";
    const d = (new Date(co+"T12:00:00")-new Date(ci+"T12:00:00"))/(1000*60*60*24);
    return d>0 ? d+"n" : "—";
  };

  return (
    <div>
      {/* Nav + view toggle */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={prev} style={{padding:"6px 12px",fontSize:13,background:"transparent",color:DARK,border:`1px solid ${BRD}`,borderRadius:8,cursor:"pointer"}}>‹</button>
        <span style={{fontWeight:700,fontSize:15,color:DARK,minWidth:180,textAlign:"center"}}>{MONTH_NAMES[month]} {year}</span>
        <button onClick={next} style={{padding:"6px 12px",fontSize:13,background:"transparent",color:DARK,border:`1px solid ${BRD}`,borderRadius:8,cursor:"pointer"}}>›</button>
        <div style={{marginLeft:16,display:"flex",background:WHT,border:`1px solid ${BRD}`,borderRadius:8,overflow:"hidden"}}>
          {[["lista","Lista"],["gantt","Gantt"]].map(([v,l])=>(
            <button key={v} onClick={()=>setCalView(v)}
              style={{padding:"6px 14px",fontSize:11,fontWeight:600,
                background:calView===v?DARK:"transparent",color:calView===v?WHT:MUT,
                border:"none",cursor:"pointer"}}>{l}</button>
          ))}
        </div>
        <span style={{fontSize:12,color:MUT,marginLeft:8}}>{visible.length} reservaciones</span>
      </div>

      {visible.length===0 && (
        <div style={{color:MUT,fontSize:13,padding:"30px 0",textAlign:"center"}}>
          No hay reservaciones en {MONTH_NAMES[month]} {year}.
        </div>
      )}

      {/* ── Lista view ── */}
      {calView==="lista" && visible.length>0 && (
        <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:12,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead>
              <tr style={{background:BG}}>
                {["Cliente","Check In","Check Out","Noches","Property","Sales Rep","Status","Revenue"].map(h=>(
                  <th key={h} style={{padding:"9px 12px",textAlign:"left",fontWeight:600,
                    color:DARK,fontSize:11,borderBottom:`1px solid ${BRD}`,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((r,i)=>(
                <tr key={i} style={{borderBottom:`1px solid rgba(26,24,20,.05)`,background:i%2===0?"transparent":"rgba(247,244,239,.4)"}}>
                  <td style={{padding:"8px 12px",fontWeight:600,color:DARK}}>{r.name||"—"}</td>
                  <td style={{padding:"8px 12px",color:MUT,whiteSpace:"nowrap"}}>{fmtDate(r.checkIn)}</td>
                  <td style={{padding:"8px 12px",color:MUT,whiteSpace:"nowrap"}}>{fmtDate(r.checkOut)}</td>
                  <td style={{padding:"8px 12px",color:MUT,textAlign:"center"}}>{nights(r.checkIn,r.checkOut)}</td>
                  <td style={{padding:"8px 12px",color:MUT}}>{r.property||"—"}</td>
                  <td style={{padding:"8px 12px",color:MUT}}>{r.salesRep||"—"}</td>
                  <td style={{padding:"8px 12px"}}>
                    <span style={{display:"inline-flex",alignItems:"center",gap:5,
                      background:statusBg(r.status),color:statusColor(r.status),
                      padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:statusDot(r.status),display:"inline-block"}}/>
                      {r.status||"—"}
                    </span>
                  </td>
                  <td style={{padding:"8px 12px",textAlign:"right",fontWeight:700,color:DARK,fontVariantNumeric:"tabular-nums"}}>
                    {r.total ? fmt$(parseFloat(r.total)) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:BG,borderTop:`2px solid ${BRD}`}}>
                <td colSpan={7} style={{padding:"9px 12px",fontSize:11,fontWeight:600,color:MUT}}>
                  TOTAL MES · {visible.filter(r=>r.status==="Confirmed").length} confirmadas
                </td>
                <td style={{padding:"9px 12px",textAlign:"right",fontWeight:700,color:DARK,fontVariantNumeric:"tabular-nums"}}>
                  {fmt$(visible.filter(r=>r.status==="Confirmed").reduce((s,r)=>s+(parseFloat(r.total)||0),0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Gantt view ── */}
      {calView==="gantt" && visible.length>0 && (
        <>
          <div style={{overflowX:"auto"}}>
            <div style={{minWidth:200+daysInMonth*30}}>
              <div style={{display:"flex",marginBottom:4}}>
                <div style={{width:200,flexShrink:0}}/>
                {days.map(d=>{
                  const dow=new Date(`${ym}-${String(d).padStart(2,"0")}T12:00:00`).getDay();
                  const isToday=d===now.getDate()&&month===now.getMonth()&&year===now.getFullYear();
                  return (
                    <div key={d} style={{width:30,flexShrink:0,textAlign:"center",fontSize:10,
                      fontWeight:isToday?700:400,color:isToday?GOLD:dow===0||dow===6?"#9ca3af":MUT,
                      padding:"3px 0",background:isToday?"rgba(192,160,98,.12)":"transparent",borderRadius:4}}>
                      {d}
                    </div>
                  );
                })}
              </div>
              {visible.map((r,ri)=>(
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
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
            {[["Confirmed","#2d6a4f","#d1fae5"],["Cancelled","#9b2335","#fee2e2"],["Other","#b45309","#fef3c7"]].map(([l,c,bg])=>(
              <span key={l} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:MUT}}>
                <span style={{width:16,height:10,background:bg,border:`2px solid ${c}`,borderRadius:3,display:"inline-block"}}/>
                {l}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const REP_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899"];

function ReservationsDashboard({ rows }) {
  const thisYear = new Date().getFullYear();
  const confirmed   = rows.filter(r=>r.status==="Confirmed");
  const cancelled   = rows.filter(r=>r.status==="Cancelled");
  const totalRev    = confirmed.reduce((s,r)=>s+(parseFloat(r.total)||0),0);
  const totalComm   = confirmed.reduce((s,r)=>s+(parseFloat(r.commission)||0),0);
  const avgDeal     = confirmed.length ? totalRev/confirmed.length : 0;
  const convRate    = rows.length ? Math.round(confirmed.length/rows.length*100) : 0;

  // By month (only years that look valid)
  const byMonth={}, byRep={}, byType={}, bySource={};
  confirmed.forEach(r=>{
    const m=r.checkIn?.slice(0,7);
    if(m) {
      const y=parseInt(m.slice(0,4));
      if(y>=2020&&y<=thisYear+3) byMonth[m]=(byMonth[m]||0)+(parseFloat(r.total)||0);
    }
    const rep=r.salesRep||"Sin asignar"; byRep[rep]=(byRep[rep]||{rev:0,cnt:0});
    byRep[rep].rev+=(parseFloat(r.total)||0); byRep[rep].cnt++;
    const tp=r.type||"Sin tipo"; byType[tp]=(byType[tp]||0)+1;
    const src=r.dealSource||"Sin fuente"; bySource[src]=(bySource[src]||0)+1;
  });

  const monthEntries  = Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0]));
  const repEntries    = Object.entries(byRep).sort((a,b)=>b[1].rev-a[1].rev);
  const typeEntries   = Object.entries(byType).sort((a,b)=>b[1]-a[1]);
  const sourceEntries = Object.entries(bySource).sort((a,b)=>b[1]-a[1]);
  const totalType     = typeEntries.reduce((s,[,v])=>s+v,0)||1;
  const totalSrc      = sourceEntries.reduce((s,[,v])=>s+v,0)||1;

  const maxM = Math.max(1,...monthEntries.map(([,v])=>v));
  const maxR = Math.max(1,...repEntries.map(([,{rev}])=>rev));

  const Card = ({children,style={}}) => (
    <div style={{background:WHT,border:`1px solid ${BRD}`,borderRadius:14,padding:22,...style}}>
      {children}
    </div>
  );
  const CardTitle = ({children}) => (
    <div style={{fontWeight:700,fontSize:12,color:MUT,letterSpacing:.5,
      textTransform:"uppercase",marginBottom:16}}>{children}</div>
  );

  const initials = name => (name||"?").split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return (
    <div style={{display:"grid",gap:16}}>
      {/* Row 1: KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        {[
          {label:"Confirmadas",  val:confirmed.length,          sub:`${convRate}% conversión`,  color:"#059669", bg:"#d1fae5"},
          {label:"Revenue Total",val:fmt$(totalRev),             sub:`${confirmed.length} deals`, color:GOLD,      bg:"#fef3c7"},
          {label:"Comisiones",   val:fmt$(totalComm),            sub:`${Math.round(totalComm/Math.max(totalRev,1)*100)}% del revenue`, color:"#6366f1", bg:"#ede9fe"},
          {label:"Deal Promedio",val:fmt$(avgDeal),              sub:`${cancelled.length} canceladas`, color:"#0ea5e9", bg:"#e0f2fe"},
        ].map(({label,val,sub,color,bg})=>(
          <Card key={label} style={{borderTop:`4px solid ${color}`}}>
            <div style={{fontSize:11,fontWeight:600,color:MUT,textTransform:"uppercase",letterSpacing:.4,marginBottom:8}}>{label}</div>
            <div style={{fontSize:26,fontWeight:800,color:DARK,lineHeight:1,marginBottom:6,fontVariantNumeric:"tabular-nums"}}>{val}</div>
            <div style={{fontSize:11,color:MUT}}>{sub}</div>
          </Card>
        ))}
      </div>

      {/* Row 2: Month chart + Rep leaderboard */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        {/* Column chart: revenue by month */}
        <Card>
          <CardTitle>Revenue por Mes</CardTitle>
          {monthEntries.length===0
            ? <div style={{color:MUT,fontSize:12}}>Sin datos</div>
            : (
              <div style={{display:"flex",alignItems:"flex-end",gap:6,height:160,overflowX:"auto",paddingBottom:4}}>
                {monthEntries.map(([m,v])=>{
                  const pct = v/maxM;
                  const isCurrentM = m===`${thisYear}-${String(new Date().getMonth()+1).padStart(2,"0")}`;
                  return (
                    <div key={m} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,minWidth:48,flex:"1 0 auto"}}>
                      <div style={{fontSize:10,fontWeight:700,color:GOLD,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
                        {v>=1000?`$${Math.round(v/1000)}k`:fmt$(v)}
                      </div>
                      <div style={{width:"100%",maxWidth:52,borderRadius:"6px 6px 0 0",
                        background:isCurrentM?GOLD:"rgba(154,125,82,.35)",
                        height:`${Math.max(4,pct*120)}px`,transition:"height .3s"}}/>
                      <div style={{fontSize:9,color:MUT,textAlign:"center",lineHeight:1.2}}>
                        {MONTH_NAMES[parseInt(m.slice(5))-1].slice(0,3)}
                        <br/><span style={{color:isCurrentM?GOLD:MUT}}>{m.slice(0,4)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </Card>

        {/* Status donut */}
        <Card>
          <CardTitle>Estado de Deals</CardTitle>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {label:"Confirmed", count:confirmed.length,  color:"#10b981", bg:"#d1fae5"},
              {label:"Cancelled", count:cancelled.length,  color:"#f87171", bg:"#fee2e2"},
              {label:"Sin estado",count:rows.filter(r=>!r.status||r.status==="").length, color:"#d1d5db", bg:"#f3f4f6"},
            ].map(({label,count,color,bg})=>{
              const pct = rows.length ? Math.round(count/rows.length*100) : 0;
              return (
                <div key={label}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:12,color:MUT}}>{label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:DARK}}>{count} <span style={{color:MUT,fontWeight:400}}>({pct}%)</span></span>
                  </div>
                  <div style={{height:10,background:"rgba(0,0,0,.06)",borderRadius:6,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:6}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Row 3: Rep leaderboard + Type + Source */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
        {/* Sales Rep */}
        <Card>
          <CardTitle>Sales Rep — Revenue</CardTitle>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {repEntries.map(([name,{rev,cnt}],idx)=>(
              <div key={name}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:REP_COLORS[idx%REP_COLORS.length],
                    color:WHT,fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {initials(name)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:11,fontWeight:600,color:DARK,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
                    <div style={{fontSize:10,color:MUT}}>{cnt} deal{cnt!==1?"s":""}</div>
                  </div>
                  <div style={{fontSize:11,fontWeight:700,color:DARK,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>
                    {rev>=1000?`$${Math.round(rev/1000)}k`:fmt$(rev)}
                  </div>
                </div>
                <div style={{height:6,background:"rgba(0,0,0,.05)",borderRadius:4,overflow:"hidden"}}>
                  <div style={{width:`${(rev/maxR)*100}%`,height:"100%",background:REP_COLORS[idx%REP_COLORS.length],borderRadius:4}}/>
                </div>
              </div>
            ))}
            {repEntries.length===0&&<div style={{fontSize:12,color:MUT}}>Sin datos</div>}
          </div>
        </Card>

        {/* Customer Type */}
        <Card>
          <CardTitle>Customer Type</CardTitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {typeEntries.map(([k,v],i)=>{
              const pct=Math.round(v/totalType*100);
              const COLS=["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];
              return (
                <div key={k}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:MUT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%"}}>{k}</span>
                    <span style={{fontSize:11,fontWeight:700,color:DARK}}>{v} <span style={{color:MUT,fontWeight:400,fontSize:10}}>({pct}%)</span></span>
                  </div>
                  <div style={{height:8,background:"rgba(0,0,0,.05)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:COLS[i%COLS.length],borderRadius:4}}/>
                  </div>
                </div>
              );
            })}
            {typeEntries.length===0&&<div style={{fontSize:12,color:MUT}}>Sin datos</div>}
          </div>
        </Card>

        {/* Deal Source */}
        <Card>
          <CardTitle>Deal Source</CardTitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sourceEntries.map(([k,v],i)=>{
              const pct=Math.round(v/totalSrc*100);
              const COLS=["#f59e0b","#10b981","#6366f1","#ef4444","#8b5cf6","#06b6d4"];
              return (
                <div key={k}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                    <span style={{fontSize:11,color:MUT,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"65%"}}>{k}</span>
                    <span style={{fontSize:11,fontWeight:700,color:DARK}}>{v} <span style={{color:MUT,fontWeight:400,fontSize:10}}>({pct}%)</span></span>
                  </div>
                  <div style={{height:8,background:"rgba(0,0,0,.05)",borderRadius:4,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:COLS[i%COLS.length],borderRadius:4}}/>
                  </div>
                </div>
              );
            })}
            {sourceEntries.length===0&&<div style={{fontSize:12,color:MUT}}>Sin datos</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function FinanceReservaciones() {
  const [rows,     setRows]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);   // shows ✓ briefly
  const [isDirty,  setIsDirty]  = useState(false);
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
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const load = useCallback(async () => {
    setLoading(true); setErr(""); setIsDirty(false);
    try { setRows(await loadReservations()); }
    catch(e) { setErr("Error cargando: "+e.message); }
    setLoading(false);
  }, []);
  useEffect(()=>{load();},[load]);

  // Warn on tab close when there are unsaved changes
  useEffect(()=>{
    const handler = e => { if(isDirty){ e.preventDefault(); e.returnValue=""; } };
    window.addEventListener("beforeunload", handler);
    return ()=>window.removeEventListener("beforeunload", handler);
  },[isDirty]);

  const handleSave = async () => {
    setSaving(true); setErr("");
    try {
      await saveReservations(rowsRef.current);
      setIsDirty(false);
      setSaved(true);
      setTimeout(()=>setSaved(false), 2500);
    } catch(e) { setErr("Error guardando: "+e.message); }
    setSaving(false);
  };

  // All mutations only update local state and mark dirty
  const patchRow = useCallback((rowIdx, field, val) => {
    setRows(prev => prev.map((r,i) => i===rowIdx ? {...r,[field]:val} : r));
    setIsDirty(true);
  }, []);

  const addRow = () => {
    const blank = { name:"", salesRep:"", dealSource:"", type:"", checkIn:"", checkOut:"",
      property:"", city:"", qty:"", rate:"", tax:"", total:"", commission:"", ourPrice:"",
      status:"Confirmed", confirmedAt:"" };
    setRows(prev => [blank, ...prev]);
    setIsDirty(true);
  };

  const deleteRow = (idx) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setRows(prev => prev.filter((_,i)=>i!==idx));
    setIsDirty(true);
  };

  const repOpts    = [...new Set(rows.map(r=>r.salesRep).filter(Boolean))].sort();
  const sourceOpts = [...new Set(rows.map(r=>r.dealSource).filter(Boolean))].sort();
  const typeOpts   = [...new Set(rows.map(r=>r.type).filter(Boolean))].sort();
  const cellOpts   = { salesRep:repOpts, dealSource:sourceOpts, type:typeOpts };

  const months = ["all",...[...new Set(rows.map(r=>r.checkIn?.slice(0,7)).filter(Boolean))].sort()];

  // Monday.com group-separator rows — no real client data
  const isSeparator = r => /reservations?\s*[\/]\s*sales|two travel\s*:/i.test(r.name||"") && !r.checkIn && !r.total;

  const filteredIdxs = rows.reduce((acc,r,i)=>{
    if (isSeparator(r)) return acc;  // skip Monday.com group headers
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

  const filteredRows = sorted.map(i => rows[i]);

  return (
    <Shell title="Reservaciones & Ventas" subtitle={`${sorted.length} de ${rows.length} registros`}>
      {err&&<Err msg={err} onRetry={load} />}
      {/* Bad-date warning */}
      {(() => {
        const badRows = rows.filter(r=>{ const y=parseInt((r.checkIn||r.checkOut||"").slice(0,4)); return y>new Date().getFullYear()+5; });
        if(!badRows.length) return null;
        return (
          <div style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:10,padding:"10px 14px",
            marginBottom:14,fontSize:12,color:"#9a3412",display:"flex",gap:10,alignItems:"center"}}>
            ⚠️ <strong>{badRows.length} fila{badRows.length!==1?"s":""} con año sospechoso</strong>
            {" "}({badRows.map(r=>r.name||"?").slice(0,3).join(", ")}{badRows.length>3?", …":""}).
            {" "}Busca y corrige la fecha en la tabla.
          </div>
        );
      })()}

      {/* Tabs + Save */}
      <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
        <TabBtn label="Tabla" k="tabla"/>
        <TabBtn label="Calendario" k="calendario"/>
        <TabBtn label="Dashboard" k="dashboard"/>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
          {saved && <span style={{fontSize:12,color:"#059669",fontWeight:600}}>✓ Guardado</span>}
          {isDirty && !saving && <span style={{fontSize:11,color:GOLD}}>Cambios sin guardar</span>}
          <button onClick={handleSave} disabled={saving||(!isDirty&&!saved)}
            style={{padding:"8px 20px",fontSize:13,fontWeight:700,whiteSpace:"nowrap",border:"none",borderRadius:8,
              cursor:isDirty||saving?"pointer":"default",transition:"background .2s",
              background:saving?MUT:isDirty?"#059669":saved?"#d1fae5":"#e5e7eb",
              color:saving||isDirty?WHT:saved?"#065f46":"#9ca3af"}}>
            {saving?"Guardando…":saved?"✓ Guardado":isDirty?"💾 Guardar cambios":"Sin cambios"}
          </button>
        </div>
      </div>

      {/* Shared filter bar */}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16,alignItems:"center",
        background:WHT,border:`1px solid ${BRD}`,borderRadius:10,padding:"10px 12px"}}>
        {view==="tabla" && (
          <button onClick={addRow}
            style={{padding:"7px 14px",fontSize:12,fontWeight:600,background:GOLD,color:WHT,
              border:"none",borderRadius:8,cursor:"pointer",whiteSpace:"nowrap"}}>
            + Nueva fila
          </button>
        )}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar…"
          style={{...INP,width:150,padding:"7px 12px",fontSize:12}} />
        <div style={{display:"flex",background:BG,border:`1px solid ${BRD}`,borderRadius:8,overflow:"hidden"}}>
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
        {(search||statusF!=="all"||typeF!=="all"||repF!=="all"||monthF!=="all"||dateFrom||dateTo) && (
          <button onClick={()=>{setSearch("");setStatusF("all");setTypeF("all");setRepF("all");setMonthF("all");setDateFrom("");setDateTo("");}}
            style={{padding:"6px 12px",fontSize:11,background:"transparent",color:MUT,
              border:`1px solid ${BRD}`,borderRadius:6,cursor:"pointer",whiteSpace:"nowrap"}}>
            Limpiar filtros
          </button>
        )}
        <span style={{marginLeft:"auto",fontSize:11,color:MUT,fontWeight:600}}>{sorted.length} resultados</span>
      </div>

      {view==="calendario" && <ReservationsCalendar rows={filteredRows}/>}
      {view==="dashboard"  && <ReservationsDashboard rows={filteredRows}/>}

      {view==="tabla" && (
        <>
          {/* KPIs */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
            <KPICard label="Confirmadas" val={confirmed.length} color="#065f46" />
            <KPICard label="Revenue total" val={fmt$(totalRev)} color={GOLD} />
            <KPICard label="Comisiones" val={fmt$(totalComm)} color="#1d4ed8" />
            <KPICard label="Tax total" val={fmt$(totalTax)} color={MUT} />
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
                            <td colSpan={ALL_COLS.length+1} style={{padding:0,paddingTop:8}}>
                              <div style={{
                                display:"flex",alignItems:"center",gap:12,
                                padding:"8px 14px",margin:"0 0 2px 0",
                                background:GOLD,borderRadius:"8px 8px 0 0",
                              }}>
                                <span style={{fontSize:12,fontWeight:700,color:WHT,letterSpacing:.3}}>
                                  {monthLabel(mk)}
                                </span>
                                <span style={{fontSize:11,color:"rgba(255,255,255,.75)"}}>
                                  {idxs.length} reservaciones · {idxs.filter(i=>rows[i].status==="Confirmed").length} confirmadas
                                </span>
                                <span style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,.85)",fontWeight:600}}>
                                  {fmt$(idxs.filter(i=>rows[i].status==="Confirmed").reduce((s,i)=>s+(parseFloat(rows[i].total)||0),0))}
                                </span>
                              </div>
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
                            <td style={{padding:"5px 8px",textAlign:"center",verticalAlign:"middle"}}>
                              <button onClick={()=>deleteRow(rowIdx)}
                                style={{background:"#fee2e2",border:"1px solid #fca5a5",color:"#dc2626",
                                  cursor:"pointer",fontSize:12,lineHeight:1,padding:"3px 7px",
                                  borderRadius:6,fontWeight:700}}
                                title="Eliminar fila">✕</button>
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

// ─── SOLICITUDES DE PAGO A PROVEEDORES ───────────────────────────────────────

const PROV_ID = "finance_proveedores_v1";

async function loadSolicitudes() {
  const { data, error } = await supabase.from("kickoffs").select("data").eq("id", PROV_ID).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return [];
  const notes = typeof data.data?.internalNotes === "string"
    ? JSON.parse(data.data.internalNotes)
    : (data.data?.internalNotes || {});
  return notes.solicitudes || [];
}

async function saveSolicitudes(rows) {
  const { data: existing } = await supabase.from("kickoffs").select("data").eq("id", PROV_ID).maybeSingle();
  const d = existing?.data || {};
  const notes = typeof d.internalNotes === "string" ? JSON.parse(d.internalNotes) : (d.internalNotes || {});
  const merged = { ...d, internalNotes: JSON.stringify({ ...notes, solicitudes: rows }) };
  if (existing) {
    const { error } = await supabase.from("kickoffs").update({ data: merged }).eq("id", PROV_ID);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("kickoffs").insert({ id: PROV_ID, data: merged });
    if (error) throw new Error(error.message);
  }
}

const AREAS    = ["Concierge","Logistica","Marketing","HR","Sales","Finance","Property Management"];
const CLASES   = ["Colombia: Cartagena","Colombia: Medellín","Mexico: Mexico City"];
const PRIOS    = ["Alta","Media","Normal"];
const TIPO_ID  = ["NIT","CC","CE","Pasaporte","RUT"];
const BANCOS   = ["BANCOLOMBIA","DAVIVIENDA","BANCO DE BOGOTÁ","BBVA","NEQUI","SCOTIABANK COLPATRIA","BANCO POPULAR","AV VILLAS","ITAÚ","OTRO"];
const TIPO_CTA = ["Cuenta de Ahorro","Cuenta Corriente"];
const CATS     = ["A/P Casa Moneda:Cleaning Products","A/P Casa Moneda:Maintenance","A/P Casa Moneda:Services","Cartagena:Yachts","Cartagena:Tours","Cartagena:F&B","Medellín:Actividades","México:Actividades","Marketing","HR","Admin"];
const FREQS    = ["Única","Mensual","Quincenal","Semanal","Eventual"];
const STATUS_PROV = { pendiente:{label:"Pendiente",color:"#fef3c7",text:"#92400e"}, aprobada:{label:"Aprobada",color:"#dcfce7",text:"#166534"}, pagada:{label:"Pagada",color:"#dbeafe",text:"#1e3a8a"}, rechazada:{label:"Rechazada",color:"#fee2e2",text:"#991b1b"} };

function emptyProvForm(today) {
  return { concepto:"", provId:"", provNombre:"", provTipoId:"NIT", banco:"BANCOLOMBIA", tipoCuenta:"Cuenta de Ahorro", numeroCuenta:"", amount:"", currency:"COP", category:"", area:"Concierge", clase:"Colombia: Cartagena", priority:"Media", dueDate:today, client:"", notes:"", requestedBy:"", assignedTo:"", payFreq:"Única", invoiceUrl:"", prebill:false, lote:today };
}

function pFmt(n, cur) {
  const v = parseFloat(n)||0;
  if((cur||"COP")==="COP") return "$"+v.toLocaleString("es-CO",{minimumFractionDigits:0})+" COP";
  return "$"+v.toLocaleString("en-US",{minimumFractionDigits:2})+" "+(cur||"USD");
}

const PINP = (extra={}) => ({ style:{width:"100%",padding:"7px 10px",border:`1px solid ${BRD}`,borderRadius:4,fontSize:12,fontFamily:"'Jost',sans-serif",background:WHT,color:DARK,boxSizing:"border-box",...extra} });
const PSEL = () => ({ style:{width:"100%",padding:"7px 10px",border:`1px solid ${BRD}`,borderRadius:4,fontSize:12,fontFamily:"'Jost',sans-serif",background:WHT,color:DARK,boxSizing:"border-box"} });
const FLbl = ({ children }) => <div style={{fontSize:10,fontWeight:700,color:MUT,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{children}</div>;
const FGrp = ({ label, children, half }) => (
  <div style={{flex:half?"0 0 calc(50% - 6px)":"1 1 100%",minWidth:half?140:"auto"}}>
    <FLbl>{label}</FLbl>
    {children}
  </div>
);
const SecHead = ({ children }) => <div style={{fontSize:11,fontWeight:700,color:GOLD,marginBottom:10,textTransform:"uppercase",letterSpacing:.6}}>{children}</div>;

export function FinancePagosProveedores() {
  const today = new Date().toISOString().slice(0,10);
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  const [saving, setSaving]     = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(emptyProvForm(today));
  const [searchQ, setSearchQ]   = useState("");
  const [fStatus, setFStatus]   = useState("");
  const [fArea, setFArea]       = useState("");
  const [fClase, setFClase]     = useState("");
  const [toast, setToast]       = useState("");

  useEffect(() => {
    loadSolicitudes().then(r => { setRows(r); setLoading(false); }).catch(e => { setErr(e.message); setLoading(false); });
  }, []);

  function showToastMsg(msg) { setToast(msg); setTimeout(()=>setToast(""),3000); }
  function openNew()   { setEditId(null); setForm(emptyProvForm(today)); setShowForm(true); }
  function openEdit(id) {
    const r = rows.find(x=>x.id===id);
    if(!r) return;
    setEditId(id); setForm({...emptyProvForm(today),...r}); setShowForm(true);
  }
  function upd(k,v)   { setForm(f=>({...f,[k]:v})); }

  async function submitForm(e) {
    e.preventDefault();
    if(!form.concepto||!form.provNombre||!form.amount||!form.dueDate) { alert("Concepto, Proveedor, Monto y Fecha son requeridos."); return; }
    setSaving(true);
    const newId = editId || (Date.now().toString(36)+Math.random().toString(36).slice(2,5));
    const entry = { ...form, amount:parseFloat(form.amount)||0, id:newId, createdAt:editId?(rows.find(x=>x.id===editId)?.createdAt||today):today, status:editId?(rows.find(x=>x.id===editId)?.status||"pendiente"):"pendiente" };
    const updated = editId ? rows.map(r=>r.id===editId?entry:r) : [entry,...rows];
    try { await saveSolicitudes(updated); setRows(updated); setShowForm(false); showToastMsg(editId?"✅ Actualizada":"✅ Solicitud creada"); }
    catch(ex) { alert("Error: "+ex.message); }
    setSaving(false);
  }

  async function setStatus(id, st) {
    const updated = rows.map(r=>r.id===id?{...r,status:st}:r);
    setRows(updated);
    try { await saveSolicitudes(updated); showToastMsg("Estado actualizado"); }
    catch(ex) { showToastMsg("Error: "+ex.message); }
  }

  async function deleteRow(id) {
    if(!confirm("¿Eliminar esta solicitud?")) return;
    const updated = rows.filter(r=>r.id!==id);
    setRows(updated);
    try { await saveSolicitudes(updated); showToastMsg("Eliminada"); }
    catch(ex) { showToastMsg("Error: "+ex.message); }
  }

  function exportPayana() {
    const visible = filtered.filter(r=>r.status==="aprobada"||r.status==="pendiente");
    const headers = ["Número proveedor","PROVEEDOR Nombre","PROVEEDOR Tipo ID","Monto","Moneda","Concepto","Fecha emisión","Fecha vencimiento","Tipo cuenta","Número cuenta","Banco","Category / Service","Client","Clase","Área","Prioridad","Solicitado por"];
    const rowData = visible.map(r=>[r.provId||"",r.provNombre||"",r.provTipoId||"",r.amount||0,r.currency||"COP",r.concepto||"",r.lote||today,r.dueDate||"",r.tipoCuenta||"",r.numeroCuenta||"",r.banco||"",r.category||"",r.client||"",r.clase||"",r.area||"",r.priority||"",r.requestedBy||""]);
    downloadCSV(`payana-lote-${today}.csv`, headers, rowData);
    showToastMsg("✅ CSV Payana descargado");
  }

  const filtered = rows.filter(r => {
    if(fStatus && r.status!==fStatus) return false;
    if(fArea && r.area!==fArea) return false;
    if(fClase && r.clase!==fClase) return false;
    if(searchQ) { const q=searchQ.toLowerCase(); if(!(r.concepto||"").toLowerCase().includes(q)&&!(r.provNombre||"").toLowerCase().includes(q)&&!(r.client||"").toLowerCase().includes(q)) return false; }
    return true;
  });

  const lotes = {};
  filtered.forEach(r => { const lk=r.lote||r.createdAt?.slice(0,10)||"Sin fecha"; if(!lotes[lk])lotes[lk]=[]; lotes[lk].push(r); });
  const loteKeys = Object.keys(lotes).sort((a,b)=>b.localeCompare(a));

  const totalPending  = filtered.filter(r=>r.status==="pendiente").reduce((s,r)=>s+toUSD(r.amount,r.currency),0);
  const totalApproved = filtered.filter(r=>r.status==="aprobada").reduce((s,r)=>s+toUSD(r.amount,r.currency),0);

  function fmtLote(lk) {
    if(!lk||lk==="Sin fecha") return "Sin lote";
    const [y,m,d] = lk.split("-");
    return `Lote ${d||"?"}.${m||"?"}.${y||"?"}`;
  }

  return (
    <Shell title="Pagos a Proveedores" subtitle="Solicitudes · Aprobaciones · Payana">
      {loading ? (
        <div style={{padding:40,textAlign:"center",color:MUT}}>Cargando solicitudes…</div>
      ) : (
        <>
          {toast && <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:DARK,color:WHT,padding:"10px 22px",borderRadius:8,fontSize:13,zIndex:9999,pointerEvents:"none"}}>{toast}</div>}
          {err && <div style={{padding:"10px 20px",background:"#fee2e2",color:"#991b1b",fontSize:12}}>{err}</div>}

          {/* KPIs */}
          <div style={{display:"flex",gap:12,padding:"16px 24px",background:WHT,borderBottom:`1px solid ${BRD}`,flexWrap:"wrap"}}>
            {[
              {label:"Total solicitudes",val:filtered.length,color:GOLD},
              {label:"Pendientes (USD)",val:"~$"+Math.round(totalPending).toLocaleString(),color:"#f59e0b"},
              {label:"Aprobadas (USD)",val:"~$"+Math.round(totalApproved).toLocaleString(),color:"#10b981"},
              {label:"Lotes",val:loteKeys.length,color:"#6366f1"},
            ].map(({label,val,color})=>(
              <div key={label} style={{flex:"1 1 130px",background:BG,borderRadius:8,padding:"10px 14px",borderTop:`3px solid ${color}`}}>
                <div style={{fontSize:10,color:MUT,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
                <div style={{fontSize:20,fontWeight:800,color:DARK,fontVariantNumeric:"tabular-nums"}}>{val}</div>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{display:"flex",gap:8,padding:"12px 24px",alignItems:"center",flexWrap:"wrap",background:WHT,borderBottom:`1px solid ${BRD}`}}>
            <input placeholder="Buscar proveedor, concepto, cliente…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              style={{flex:"1 1 200px",padding:"7px 12px",border:`1px solid ${BRD}`,borderRadius:4,fontSize:12,fontFamily:"'Jost',sans-serif",minWidth:160}}/>
            {[
              ["Estado",fStatus,setFStatus,Object.entries(STATUS_PROV).map(([k,v])=>({k,label:v.label}))],
              ["Área",fArea,setFArea,AREAS.map(a=>({k:a,label:a}))],
              ["Clase",fClase,setFClase,CLASES.map(c=>({k:c,label:c}))],
            ].map(([name,val,set,opts])=>(
              <select key={name} value={val} onChange={e=>set(e.target.value)}
                style={{padding:"7px 10px",border:`1px solid ${BRD}`,borderRadius:4,fontSize:12,fontFamily:"'Jost',sans-serif",background:WHT}}>
                <option value="">Todos</option>
                {opts.map(o=><option key={o.k} value={o.k}>{o.label}</option>)}
              </select>
            ))}
            <button onClick={exportPayana} style={{padding:"7px 14px",background:"#10b981",color:WHT,border:"none",borderRadius:4,fontSize:12,fontFamily:"'Jost',sans-serif",cursor:"pointer",fontWeight:600}}>⬇ CSV Payana</button>
            <button onClick={openNew} style={{padding:"7px 14px",background:GOLD,color:WHT,border:"none",borderRadius:4,fontSize:12,fontFamily:"'Jost',sans-serif",cursor:"pointer",fontWeight:600}}>+ Nueva Solicitud</button>
          </div>

          {/* Lote groups */}
          <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:24}}>
            {loteKeys.length===0 && (
              <div style={{textAlign:"center",padding:60,color:MUT}}>
                <div style={{fontSize:32,marginBottom:12}}>📋</div>
                <div style={{fontSize:15,fontWeight:600}}>No hay solicitudes</div>
                <div style={{fontSize:12,marginTop:6}}>Haz clic en "Nueva Solicitud" para crear la primera.</div>
              </div>
            )}
            {loteKeys.map(lk => {
              const loteRows = lotes[lk];
              const loteTotal = loteRows.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
              const loteApproved = loteRows.filter(r=>r.status==="aprobada").length;
              const cur = loteRows[0]?.currency||"COP";
              return (
                <div key={lk} style={{background:WHT,borderRadius:8,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
                  <div style={{background:GOLD,padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:13,fontWeight:700,color:WHT}}>{fmtLote(lk)}</span>
                    <span style={{fontSize:11,color:"rgba(255,255,255,.8)"}}>{loteRows.length} solicitudes · {loteApproved} aprobadas</span>
                    <span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:WHT,fontVariantNumeric:"tabular-nums"}}>{pFmt(loteTotal,cur)}</span>
                  </div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead>
                        <tr style={{background:BG,borderBottom:`1px solid ${BRD}`}}>
                          {["Proveedor ID","Nombre","Monto","Concepto","Área","Clase","Prior.","Fecha Vcto","Estado",""].map(h=>(
                            <th key={h} style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:MUT,fontSize:10,textTransform:"uppercase",letterSpacing:.4,whiteSpace:"nowrap"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loteRows.map((r,i) => {
                          const st = STATUS_PROV[r.status] || STATUS_PROV.pendiente;
                          return (
                            <tr key={r.id} style={{borderBottom:`1px solid ${BRD}`,background:i%2===0?WHT:BG}}>
                              <td style={{padding:"8px 10px",color:MUT,fontFamily:"monospace",fontSize:11,whiteSpace:"nowrap"}}>{r.provId||"—"}</td>
                              <td style={{padding:"8px 10px",fontWeight:600,color:DARK,whiteSpace:"nowrap",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis"}}>{r.provNombre||"—"}</td>
                              <td style={{padding:"8px 10px",fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap",fontWeight:600}}>{pFmt(r.amount,r.currency)}</td>
                              <td style={{padding:"8px 10px",color:DARK,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={r.concepto}>{r.concepto||"—"}</td>
                              <td style={{padding:"8px 10px",color:MUT,whiteSpace:"nowrap"}}>{r.area||"—"}</td>
                              <td style={{padding:"8px 10px",color:MUT,whiteSpace:"nowrap",fontSize:11}}>{(r.clase||"").replace("Colombia: ","CO:").replace("Mexico: ","MX:")}</td>
                              <td style={{padding:"8px 10px"}}>
                                <span style={{padding:"2px 7px",borderRadius:3,fontSize:10,fontWeight:700,background:r.priority==="Alta"?"#fee2e2":r.priority==="Media"?"#fef3c7":"#f0f9ff",color:r.priority==="Alta"?"#991b1b":r.priority==="Media"?"#92400e":"#0369a1"}}>{r.priority||"Normal"}</span>
                              </td>
                              <td style={{padding:"8px 10px",color:MUT,whiteSpace:"nowrap",fontSize:11}}>{r.dueDate||"—"}</td>
                              <td style={{padding:"8px 10px"}}>
                                <select value={r.status||"pendiente"} onChange={e=>setStatus(r.id,e.target.value)}
                                  style={{padding:"2px 6px",border:`1px solid ${BRD}`,borderRadius:3,fontSize:11,fontFamily:"'Jost',sans-serif",background:st.color,color:st.text,fontWeight:600}}>
                                  {Object.entries(STATUS_PROV).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                                </select>
                              </td>
                              <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                                <button onClick={()=>openEdit(r.id)} style={{fontSize:10,padding:"3px 8px",border:`1px solid ${BRD}`,borderRadius:3,background:WHT,cursor:"pointer",marginRight:4,fontFamily:"'Jost',sans-serif"}}>✏️</button>
                                <button onClick={()=>deleteRow(r.id)} style={{fontSize:10,padding:"3px 8px",border:"1px solid #fca5a5",borderRadius:3,background:"#fff5f5",color:"#dc2626",cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>✕</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form modal */}
          {showForm && (
            <div onClick={e=>{if(e.target===e.currentTarget)setShowForm(false);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
              <div style={{background:WHT,borderRadius:12,width:"100%",maxWidth:680,maxHeight:"92vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,.25)"}}>
                <div style={{padding:"16px 22px",borderBottom:`1px solid ${BRD}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:WHT,zIndex:1}}>
                  <span style={{fontSize:15,fontWeight:700,color:DARK}}>{editId?"Editar Solicitud":"Nueva Solicitud de Pago"}</span>
                  <button onClick={()=>setShowForm(false)} style={{fontSize:22,background:"none",border:"none",cursor:"pointer",color:MUT,lineHeight:1}}>×</button>
                </div>
                <form onSubmit={submitForm} style={{padding:"20px 22px",display:"flex",flexDirection:"column",gap:16}}>

                  {/* Lote */}
                  <div style={{background:"#fef9ec",border:"1px solid #fde68a",borderRadius:6,padding:"10px 14px",fontSize:12,color:"#92400e",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    📦 <strong>Lote de pago:</strong> fecha del batch para Payana
                    <input type="date" value={form.lote} onChange={e=>upd("lote",e.target.value)}
                      style={{padding:"3px 8px",border:`1px solid #fde68a`,borderRadius:3,fontSize:12,fontFamily:"'Jost',sans-serif",background:WHT}}/>
                  </div>

                  <FGrp label="Concepto / Descripción del pago *">
                    <input {...PINP()} value={form.concepto} onChange={e=>upd("concepto",e.target.value)} placeholder="Ej: Arreglo lavadora Casa Moneda" required/>
                  </FGrp>

                  <div style={{borderTop:`1px solid ${BRD}`,paddingTop:12}}>
                    <SecHead>Proveedor</SecHead>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      <FGrp label="Tipo ID" half><select {...PSEL()} value={form.provTipoId} onChange={e=>upd("provTipoId",e.target.value)}>{TIPO_ID.map(t=><option key={t}>{t}</option>)}</select></FGrp>
                      <FGrp label="Número ID" half><input {...PINP()} value={form.provId} onChange={e=>upd("provId",e.target.value)} placeholder="890801748"/></FGrp>
                      <FGrp label="Nombre Proveedor *"><input {...PINP()} value={form.provNombre} onChange={e=>upd("provNombre",e.target.value)} placeholder="MABE SERVICIOS" required/></FGrp>
                    </div>
                  </div>

                  <div style={{borderTop:`1px solid ${BRD}`,paddingTop:12}}>
                    <SecHead>Cuenta Bancaria</SecHead>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      <FGrp label="Banco" half><select {...PSEL()} value={form.banco} onChange={e=>upd("banco",e.target.value)}>{BANCOS.map(b=><option key={b}>{b}</option>)}</select></FGrp>
                      <FGrp label="Tipo de Cuenta" half><select {...PSEL()} value={form.tipoCuenta} onChange={e=>upd("tipoCuenta",e.target.value)}>{TIPO_CTA.map(t=><option key={t}>{t}</option>)}</select></FGrp>
                      <FGrp label="Número de Cuenta"><input {...PINP()} value={form.numeroCuenta} onChange={e=>upd("numeroCuenta",e.target.value)} placeholder="07080174803"/></FGrp>
                    </div>
                  </div>

                  <div style={{borderTop:`1px solid ${BRD}`,paddingTop:12}}>
                    <SecHead>Monto</SecHead>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      <FGrp label="Monto *" half><input {...PINP()} type="number" min="0" value={form.amount} onChange={e=>upd("amount",e.target.value)} placeholder="349000" required/></FGrp>
                      <FGrp label="Moneda" half><select {...PSEL()} value={form.currency} onChange={e=>upd("currency",e.target.value)}>{["COP","USD","MXN"].map(c=><option key={c}>{c}</option>)}</select></FGrp>
                    </div>
                  </div>

                  <div style={{borderTop:`1px solid ${BRD}`,paddingTop:12}}>
                    <SecHead>Clasificación</SecHead>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      <FGrp label="Área" half><select {...PSEL()} value={form.area} onChange={e=>upd("area",e.target.value)}>{AREAS.map(a=><option key={a}>{a}</option>)}</select></FGrp>
                      <FGrp label="Clase" half><select {...PSEL()} value={form.clase} onChange={e=>upd("clase",e.target.value)}>{CLASES.map(c=><option key={c}>{c}</option>)}</select></FGrp>
                      <FGrp label="Category / Service"><select {...PSEL()} value={form.category} onChange={e=>upd("category",e.target.value)}><option value="">— seleccionar —</option>{CATS.map(c=><option key={c}>{c}</option>)}</select></FGrp>
                      <FGrp label="Prioridad" half><select {...PSEL()} value={form.priority} onChange={e=>upd("priority",e.target.value)}>{PRIOS.map(p=><option key={p}>{p}</option>)}</select></FGrp>
                      <FGrp label="Fecha Vencimiento *" half><input {...PINP()} type="date" value={form.dueDate} onChange={e=>upd("dueDate",e.target.value)} required/></FGrp>
                    </div>
                  </div>

                  <div style={{borderTop:`1px solid ${BRD}`,paddingTop:12}}>
                    <SecHead>Info adicional</SecHead>
                    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                      <FGrp label="Cliente - Centro de Costos"><input {...PINP()} value={form.client} onChange={e=>upd("client",e.target.value)} placeholder="Nombre del cliente de Slack"/></FGrp>
                      <FGrp label="Solicitado por" half><input {...PINP()} value={form.requestedBy} onChange={e=>upd("requestedBy",e.target.value)}/></FGrp>
                      <FGrp label="Asignado a" half><input {...PINP()} value={form.assignedTo} onChange={e=>upd("assignedTo",e.target.value)}/></FGrp>
                      <FGrp label="Frecuencia de Pago" half><select {...PSEL()} value={form.payFreq} onChange={e=>upd("payFreq",e.target.value)}>{FREQS.map(f=><option key={f}>{f}</option>)}</select></FGrp>
                      <FGrp label="Link Factura / Cuenta de cobro"><input {...PINP()} value={form.invoiceUrl} onChange={e=>upd("invoiceUrl",e.target.value)} placeholder="https://…"/></FGrp>
                      <FGrp label="Notas / Observaciones"><textarea rows={2} {...PINP({resize:"vertical"})} value={form.notes} onChange={e=>upd("notes",e.target.value)}/></FGrp>
                    </div>
                    <label style={{fontSize:12,display:"flex",alignItems:"center",gap:6,cursor:"pointer",marginTop:10}}>
                      <input type="checkbox" checked={!!form.prebill} onChange={e=>upd("prebill",e.target.checked)}/> ¿Pagó Prebill?
                    </label>
                  </div>

                  <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:8,borderTop:`1px solid ${BRD}`}}>
                    <button type="button" onClick={()=>setShowForm(false)} style={{padding:"8px 18px",fontSize:12,fontFamily:"'Jost',sans-serif",border:`1px solid ${BRD}`,borderRadius:4,background:WHT,cursor:"pointer"}}>Cancelar</button>
                    <button type="submit" disabled={saving} style={{padding:"8px 22px",fontSize:12,fontFamily:"'Jost',sans-serif",border:"none",borderRadius:4,background:GOLD,color:WHT,cursor:"pointer",fontWeight:700}}>
                      {saving?"Guardando…":"Guardar solicitud"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
