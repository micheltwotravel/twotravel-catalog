import React, { useState, useEffect, useCallback } from "react";

// ─── BRAND ───────────────────────────────────────────────────────────────────
const R = {
  dark:   "#1a0812",
  mid:    "#7f1d3a",
  accent: "#be123c",
  light:  "#fff0f3",
  cream:  "#fdf6f8",
  gold:   "#c9a96e",
  muted:  "#8b4a62",
  text:   "#1a0812",
  text2:  "#6b3550",
  border: "#f0c0ce",
  white:  "#ffffff",
};
const HDR = { background:R.dark, padding:"18px 24px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 };
const GOLD_BAR = { height:2, background:`linear-gradient(90deg,${R.mid},${R.gold},${R.mid})`, flexShrink:0 };
const CARD = { background:R.white, border:`1px solid ${R.border}`, borderRadius:16, overflow:"hidden" };

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function parseDate(d) { if(!d) return null; const dt=new Date(typeof d==="string"&&d.length===10?d+"T12:00:00":d); return isNaN(dt)?null:dt; }
function toDateInput(d) { const dt=parseDate(d); return dt?dt.toISOString().slice(0,10):""; }
function fmtDate(d) { const dt=parseDate(d); if(!dt) return d?String(d):""; return dt.toLocaleDateString("es-CO",{day:"numeric",month:"short",year:"numeric"}); }
function daysUntil(d) { const dt=parseDate(d); if(!dt) return null; const t=new Date(); t.setHours(0,0,0,0); return Math.ceil((dt-t)/86400000); }
function uid() { return "t_"+Date.now().toString(36)+Math.random().toString(36).slice(2,5); }
function fmt$(n) { const v=parseFloat(String(n).replace(/,/g,".")); return isNaN(v)?"":v.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:2}); }

const FASES        = ["Onboarding","Planning","Pre-Wedding","Wedding Day","Post-Wedding"];
const ESTADOS_BODA = ["Activa","En pausa","Terminada","Cancelada"];
const ESTADOS_TASK = ["Pendiente","En curso","Terminado","Cancelado"];
const FASE_COLORS  = { "Onboarding":{"bg":"#eff6ff","color":"#1e40af"}, "Planning":{"bg":"#f5f3ff","color":"#6d28d9"}, "Pre-Wedding":{"bg":"#fffbeb","color":"#b45309"}, "Wedding Day":{"bg":"#fff0f3","color":"#be123c"}, "Post-Wedding":{"bg":"#f0fdf4","color":"#166534"} };

const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

// ─── DATA LAYER ──────────────────────────────────────────────────────────────
const BODAS_CACHE_KEY = "tt_bodas_cache";
const BODAS_CACHE_TTL = 5 * 60 * 1000; // 5 min

function parseJ(v, fallback) { try { return v ? JSON.parse(v) : fallback; } catch { return fallback; } }

function rowToBoda(row) {
  return {
    id:          row.id          || "",
    clienteName: row.clienteName || "",
    weddingDate: row.weddingDate || "",
    venue:       row.venue       || "",
    responsable: row.responsable || "",
    contact:     row.contact     || "",
    phase:       row.phase       || "Onboarding",
    status:      row.status      || "Activa",
    guestCount:  row.guestCount  || "",
    budget:      row.budget      || "",
    notes:       row.notes       || "",
    coverPhoto:  row.coverPhoto  || "",
    tasks:     parseJ(row.tasks,     []),
    suppliers: parseJ(row.suppliers, []),
    songs:     parseJ(row.songs,     []),
    photos:    parseJ(row.photos,    []),
    calls:     parseJ(row.calls,     []),
    guests:    parseJ(row.guests,    []),
    palette:   parseJ(row.palette,   []),
    schedule:    parseJ(row.schedule,    []),
    budgetItems: parseJ(row.budgetItems, []),
    payments:    parseJ(row.payments,    []),
    contracts:   parseJ(row.contracts,   []),
    seating:     parseJ(row.seating,     []),
    studio:      parseJ(row.studio,      []),
  };
}

function getBodasCache() {
  try { const { ts, data } = JSON.parse(sessionStorage.getItem(BODAS_CACHE_KEY)||"null")||{}; if (!data) return null; return { data, stale: Date.now()-ts > BODAS_CACHE_TTL }; } catch { return null; }
}
function setBodasCache(data) {
  try { sessionStorage.setItem(BODAS_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
}
function clearBodasCache() {
  try { sessionStorage.removeItem(BODAS_CACHE_KEY); } catch {}
}

async function gasGet(action, params = {}) {
  const qs = new URLSearchParams({ action, ...params }).toString();
  const r = await fetch(`${GAS_URL}?${qs}`);
  const text = await r.text();
  if (text.trimStart().startsWith("<")) throw new Error("Error de conexión con el servidor.");
  return JSON.parse(text);
}
async function gasPost(body) {
  const r = await fetch(GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
  const text = await r.text();
  if (text.trimStart().startsWith("<")) throw new Error("Error de conexión con el servidor.");
  return JSON.parse(text);
}

async function fetchFreshBodas() {
  const d = await gasGet("listBodas");
  const bodas = (Array.isArray(d.data) ? d.data : []).map(rowToBoda);
  setBodasCache(bodas);
  return bodas;
}
async function apiBodas(forceRefresh = false) {
  if (forceRefresh) { clearBodasCache(); return fetchFreshBodas(); }
  const cached = getBodasCache();
  if (cached && !cached.stale) return cached.data;
  return fetchFreshBodas();
}
async function apiSaveBoda(f) {
  clearBodasCache();
  const d = await gasPost({ action: "saveBoda", payload: {
    clienteName: f.clienteName, weddingDate: f.weddingDate, venue: f.venue,
    responsable: f.responsable, contact: f.contact, phase: f.phase,
    status: f.status, guestCount: f.guestCount, budget: f.budget,
    notes: f.notes, coverPhoto: f.coverPhoto || "",
    tasks: "[]", suppliers: "[]", songs: "[]",
    photos: "[]", calls: "[]", guests: "[]", palette: "[]", schedule: "[]",
    budgetItems: "[]", payments: "[]", contracts: "[]", seating: "[]", studio: "[]",
  }});
  return d.id;
}
async function apiUpdateBoda(id, f) {
  clearBodasCache();
  await gasPost({ action: "updateBoda", id, updates: {
    clienteName: f.clienteName, weddingDate: f.weddingDate, venue: f.venue,
    responsable: f.responsable, contact: f.contact, phase: f.phase,
    status: f.status, guestCount: f.guestCount, budget: f.budget,
    notes: f.notes, coverPhoto: f.coverPhoto || "",
  }});
}
async function apiSaveNotes(id, boda) {
  clearBodasCache();
  await gasPost({ action: "updateBoda", id, updates: {
    tasks:     JSON.stringify(boda.tasks     || []),
    suppliers: JSON.stringify(boda.suppliers || []),
    songs:     JSON.stringify(boda.songs     || []),
    photos:    JSON.stringify(boda.photos    || []),
    calls:     JSON.stringify(boda.calls     || []),
    guests:    JSON.stringify(boda.guests    || []),
    palette:     JSON.stringify(boda.palette     || []),
    budgetItems: JSON.stringify(boda.budgetItems || []),
    payments:    JSON.stringify(boda.payments    || []),
    contracts:   JSON.stringify(boda.contracts   || []),
    seating:     JSON.stringify(boda.seating     || []),
    studio:      JSON.stringify(boda.studio      || []),
  }});
}
async function apiUpdateSchedule(id, sc) {
  clearBodasCache();
  await gasPost({ action: "updateBoda", id, updates: { schedule: JSON.stringify(sc) } });
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const INP    = { width:"100%",border:`1px solid ${R.border}`,borderRadius:10,padding:"8px 12px",  fontSize:13,fontFamily:"'Jost',sans-serif",outline:"none",color:R.text,background:R.white,boxSizing:"border-box" };
const INP_SM = {...INP,padding:"6px 10px",fontSize:12};

// ─── BODA FORM ───────────────────────────────────────────────────────────────
function BodaForm({ boda, onSave, onCancel, saving, users=[] }) {
  const [f,setF]=useState({clienteName:boda?.clienteName||"",weddingDate:toDateInput(boda?.weddingDate),venue:boda?.venue||"",responsable:boda?.responsable||"",phase:boda?.phase||"Onboarding",status:boda?.status||"Activa",guestCount:boda?.guestCount||"",budget:boda?.budget||"",notes:boda?.notes||"",contact:boda?.contact||""});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      <div style={{gridColumn:"span 2"}}><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Nombre del cliente *</label><input style={INP} value={f.clienteName} onChange={e=>set("clienteName",e.target.value)} placeholder="Ej: Ana & Carlos" /></div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Fecha de boda</label><input type="date" style={INP} value={f.weddingDate} onChange={e=>set("weddingDate",e.target.value)} /></div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Responsable</label>
        {users.length>0?(<select style={INP} value={f.responsable} onChange={e=>set("responsable",e.target.value)}><option value="">— seleccionar —</option>{users.map(u=><option key={u.email} value={u.name||u.email}>{u.name||u.email}</option>)}</select>):<input style={INP} value={f.responsable} onChange={e=>set("responsable",e.target.value)} placeholder="Nombre o email" />}
      </div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Venue</label><input style={INP} value={f.venue} onChange={e=>set("venue",e.target.value)} placeholder="Nombre del lugar" /></div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Contacto cliente</label><input style={INP} value={f.contact} onChange={e=>set("contact",e.target.value)} placeholder="WhatsApp o email" /></div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Fase</label><select style={INP} value={f.phase} onChange={e=>set("phase",e.target.value)}>{FASES.map(p=><option key={p}>{p}</option>)}</select></div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Estado</label><select style={INP} value={f.status} onChange={e=>set("status",e.target.value)}>{ESTADOS_BODA.map(s=><option key={s}>{s}</option>)}</select></div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>N° invitados</label><input type="number" style={INP} value={f.guestCount} onChange={e=>set("guestCount",e.target.value)} placeholder="150" /></div>
      <div><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Presupuesto (USD)</label><input type="number" style={INP} value={f.budget} onChange={e=>set("budget",e.target.value)} placeholder="25000" /></div>
      <div style={{gridColumn:"span 2"}}><label style={{fontSize:11,color:R.muted,display:"block",marginBottom:4}}>Notas internas</label><textarea style={{...INP,resize:"vertical"}} rows={3} value={f.notes} onChange={e=>set("notes",e.target.value)} placeholder="Detalles, preferencias, pendientes..." /></div>
      <div style={{gridColumn:"span 2",display:"flex",gap:8,paddingTop:4}}>
        <button onClick={()=>onSave(f)} disabled={saving||!f.clienteName.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",opacity:(saving||!f.clienteName.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"Guardando...":boda?"Guardar cambios":"Crear boda"}</button>
        <button onClick={onCancel} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:10,padding:"9px 20px",fontSize:13,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
      </div>
    </div>
  );
}

// ─── TAREAS TAB ───────────────────────────────────────────────────────────────
function TasksTab({ boda, users, onPatch }) {
  const [tasks,setTasks]=useState(boda.tasks||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [blank,setBlank]=useState({taskName:"",assignedTo:"",dueDate:"",status:"Pendiente",phase:"General",notes:""});
  const today=new Date(); today.setHours(0,0,0,0);
  function cat(t) { if(!t.dueDate) return "up"; const d=new Date(t.dueDate+"T12:00:00"); d.setHours(0,0,0,0); if(d<today) return "late"; if(d.getTime()===today.getTime()) return "today"; return "up"; }
  async function persist(u){ setTasks(u); onPatch({tasks:u}); await apiSaveNotes(boda.id,{...boda,tasks:u}); }
  async function add(){ if(!blank.taskName.trim()) return; setSaving(true); try{await persist([...tasks,{...blank,id:uid(),createdAt:new Date().toISOString()}]); setBlank({taskName:"",assignedTo:"",dueDate:"",status:"Pendiente",phase:"General",notes:""}); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function toggle(id){ const u=tasks.map(t=>t.id===id?{...t,status:t.status==="Terminado"?"Pendiente":"Terminado"}:t); try{await persist(u);}catch{setTasks(tasks);} }
  async function remove(id){ try{await persist(tasks.filter(t=>t.id!==id));}catch{setTasks(tasks);} }
  const active=tasks.filter(t=>!["Terminado","Cancelado"].includes(t.status));
  const done  =tasks.filter(t=> ["Terminado","Cancelado"].includes(t.status));
  const rowBg=(t)=>({late:"#fff5f5",today:"#fffbeb",up:R.white}[cat(t)]);
  const rowBd=(t)=>({late:"#fca5a5",today:"#fcd34d",up:R.border}[cat(t)]);
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{active.length} activa{active.length!==1?"s":""}</span>
        <button onClick={()=>setShow(v=>!v)} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Nueva tarea</button>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.taskName} onChange={e=>setBlank(p=>({...p,taskName:e.target.value}))} placeholder="Descripción de la tarea *" /></div>
            {users.length>0?(<select style={INP_SM} value={blank.assignedTo} onChange={e=>setBlank(p=>({...p,assignedTo:e.target.value}))}><option value="">— responsable —</option>{users.map(u=><option key={u.email} value={u.name||u.email}>{u.name||u.email}</option>)}</select>):<input style={INP_SM} value={blank.assignedTo} onChange={e=>setBlank(p=>({...p,assignedTo:e.target.value}))} placeholder="Responsable" />}
            <input type="date" style={INP_SM} value={blank.dueDate} onChange={e=>setBlank(p=>({...p,dueDate:e.target.value}))} />
            <select style={INP_SM} value={blank.phase} onChange={e=>setBlank(p=>({...p,phase:e.target.value}))}>{["General",...FASES].map(ph=><option key={ph}>{ph}</option>)}</select>
            <select style={INP_SM} value={blank.status} onChange={e=>setBlank(p=>({...p,status:e.target.value}))}>{ESTADOS_TASK.map(s=><option key={s}>{s}</option>)}</select>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.notes} onChange={e=>setBlank(p=>({...p,notes:e.target.value}))} placeholder="Notas (opcional)" /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.taskName.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.taskName.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":"Agregar"}</button>
            <button onClick={()=>setShow(false)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {active.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin tareas activas.</p>}
      {active.map(t=>(
        <div key={t.id} style={{border:`1px solid ${rowBd(t)}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10,background:rowBg(t),marginBottom:6}}>
          <button onClick={()=>toggle(t.id)} style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${R.border}`,background:R.white,cursor:"pointer",flexShrink:0,marginTop:2}} />
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:13,fontWeight:500,color:R.text,margin:0}}>{t.taskName}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px",marginTop:3,fontSize:11,color:R.muted}}>
              {t.assignedTo&&<span>👤 {t.assignedTo}</span>}
              {t.dueDate&&<span>📅 {fmtDate(t.dueDate)}</span>}
              {t.phase&&t.phase!=="General"&&<span style={{color:R.accent}}>{t.phase}</span>}
              {cat(t)==="late" &&<span style={{fontWeight:600,color:"#dc2626"}}>⚠️ Atrasada</span>}
              {cat(t)==="today"&&<span style={{fontWeight:600,color:"#d97706"}}>🔥 Hoy</span>}
            </div>
          </div>
          <button onClick={()=>remove(t.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"0 2px"}}>✕</button>
        </div>
      ))}
      {done.length>0&&(
        <details style={{marginTop:8}}><summary style={{fontSize:11,color:R.muted,cursor:"pointer",userSelect:"none"}}>Ver {done.length} terminadas/canceladas</summary>
          <div style={{marginTop:8}}>
            {done.map(t=>(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,border:`1px solid ${R.border}`,borderRadius:10,padding:"8px 12px",marginBottom:4,background:R.cream}}>
                <button onClick={()=>toggle(t.id)} style={{width:16,height:16,borderRadius:4,border:"1.5px solid #86efac",background:"#dcfce7",cursor:"pointer",flexShrink:0}} />
                <span style={{fontSize:12,color:R.muted,textDecoration:"line-through",flex:1}}>{t.taskName}</span>
                <button onClick={()=>remove(t.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:12}}>✕</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── PROVEEDORES TAB ──────────────────────────────────────────────────────────
const SUP_CATS     = ["Fotografía","Video","Catering","Flores","DJ","Banda","Pastelería","Maquillaje","Peinado","Transporte","Decoración","Venue","Iluminación","Sonido","Papelería","Otro"];
const SUP_STATUSES = ["Cotizando","Contratado","Pagado","Cancelado"];
const SUP_STYLE    = { "Cotizando":{bg:"#fffbeb",color:"#b45309",dot:"#f59e0b"}, "Contratado":{bg:"#eff6ff",color:"#1d4ed8",dot:"#3b82f6"}, "Pagado":{bg:"#f0fdf4",color:"#16a34a",dot:"#22c55e"}, "Cancelado":{bg:"#f5f5f4",color:"#78716c",dot:"#a8a29e"} };

function ProveedoresTab({ boda, onPatch }) {
  const [suppliers,setSuppliers]=useState(boda.suppliers||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editId,setEditId]=useState(null);
  const EMPTY={category:"Fotografía",company:"",contact:"",phone:"",email:"",status:"Cotizando",quote:"",currency:"USD",notes:"",instagram:""};
  const [blank,setBlank]=useState(EMPTY);

  async function persist(u){ setSuppliers(u); onPatch({suppliers:u}); await apiSaveNotes(boda.id,{...boda,suppliers:u}); }
  async function save(){ if(!blank.company.trim()) return; setSaving(true); try{ if(editId){await persist(suppliers.map(s=>s.id===editId?{...blank,id:editId}:s)); setEditId(null);}else{await persist([...suppliers,{...blank,id:uid()}]);} setBlank(EMPTY); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  function startEdit(s){ setBlank({...s}); setEditId(s.id); setShow(true); }
  async function del(id){ try{await persist(suppliers.filter(s=>s.id!==id));}catch{setSuppliers(suppliers);} }
  async function nextStatus(id){ const order=["Cotizando","Contratado","Pagado"]; try{await persist(suppliers.map(s=>{ if(s.id!==id) return s; const i=order.indexOf(s.status); return{...s,status:i>=0&&i<order.length-1?order[i+1]:s.status}; }));}catch{setSuppliers(suppliers);} }

  const totalFor=(st)=>suppliers.filter(s=>s.status===st&&s.quote).reduce((a,s)=>a+(parseFloat(String(s.quote).replace(/,/g,"."))||0),0);
  const committed=totalFor("Contratado")+totalFor("Pagado");

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",gap:12,alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{suppliers.length} proveedor{suppliers.length!==1?"es":""}</span>
          {committed>0&&<span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>💰 ${fmt$(committed)} USD</span>}
        </div>
        <button onClick={()=>{setBlank(EMPTY);setEditId(null);setShow(v=>!v);}} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
      </div>

      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <select style={INP_SM} value={blank.category} onChange={e=>setBlank(p=>({...p,category:e.target.value}))}>{SUP_CATS.map(c=><option key={c}>{c}</option>)}</select>
            <select style={INP_SM} value={blank.status}   onChange={e=>setBlank(p=>({...p,status:e.target.value}))}>{SUP_STATUSES.map(s=><option key={s}>{s}</option>)}</select>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.company}   onChange={e=>setBlank(p=>({...p,company:e.target.value}))}   placeholder="Nombre empresa / proveedor *" /></div>
            <input style={INP_SM} value={blank.contact}   onChange={e=>setBlank(p=>({...p,contact:e.target.value}))}   placeholder="Contacto" />
            <input style={INP_SM} value={blank.phone}     onChange={e=>setBlank(p=>({...p,phone:e.target.value}))}     placeholder="Teléfono / WhatsApp" />
            <input style={INP_SM} value={blank.email}     onChange={e=>setBlank(p=>({...p,email:e.target.value}))}     placeholder="Email" />
            <input style={INP_SM} value={blank.instagram} onChange={e=>setBlank(p=>({...p,instagram:e.target.value}))} placeholder="@instagram" />
            <div style={{display:"flex",gap:6}}>
              <input style={{...INP_SM,flex:1}} type="number" value={blank.quote}    onChange={e=>setBlank(p=>({...p,quote:e.target.value}))}    placeholder="Cotización" />
              <select style={{...INP_SM,width:70,flex:"0 0 auto"}} value={blank.currency} onChange={e=>setBlank(p=>({...p,currency:e.target.value}))}><option>USD</option><option>COP</option><option>MXN</option></select>
            </div>
            <div style={{gridColumn:"span 2"}}><textarea style={{...INP_SM,resize:"vertical"}} rows={2} value={blank.notes} onChange={e=>setBlank(p=>({...p,notes:e.target.value}))} placeholder="Notas, link brochure, observaciones..." /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={save} disabled={saving||!blank.company.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.company.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":(editId?"Guardar":"Agregar")}</button>
            <button onClick={()=>{setShow(false);setEditId(null);}} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}

      {suppliers.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin proveedores. Agrega el primero arriba.</p>}

      {SUP_CATS.filter(c=>suppliers.some(s=>s.category===c)).map(cat=>(
        <div key={cat} style={{marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:700,color:R.muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 6px"}}>{cat}</p>
          {suppliers.filter(s=>s.category===cat).map(s=>{
            const ss=SUP_STYLE[s.status]||SUP_STYLE["Cotizando"];
            return (
              <div key={s.id} style={{border:`1px solid ${R.border}`,borderRadius:12,padding:"12px 14px",marginBottom:6,background:R.white}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600,color:R.text}}>{s.company}</span>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:ss.bg,color:ss.color,display:"flex",alignItems:"center",gap:4}}>
                        <span style={{width:5,height:5,borderRadius:"50%",background:ss.dot,display:"inline-block"}} />{s.status}
                      </span>
                      {s.quote&&<span style={{fontSize:11,fontWeight:600,color:"#1d4ed8"}}>${fmt$(s.quote)} {s.currency}</span>}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"2px 10px",fontSize:11,color:R.muted}}>
                      {s.contact  &&<span>👤 {s.contact}</span>}
                      {s.phone    &&<span>📱 <a href={`https://wa.me/${s.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{color:R.muted}}>{s.phone}</a></span>}
                      {s.email    &&<span>✉️ <a href={`mailto:${s.email}`} style={{color:R.muted}}>{s.email}</a></span>}
                      {s.instagram&&<span>📷 <a href={`https://instagram.com/${s.instagram.replace("@","")}`} target="_blank" rel="noreferrer" style={{color:R.muted}}>{s.instagram}</a></span>}
                    </div>
                    {s.notes&&<p style={{fontSize:11,color:R.text2,margin:"4px 0 0",whiteSpace:"pre-line"}}>{s.notes}</p>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
                    {s.status!=="Pagado"&&s.status!=="Cancelado"&&(
                      <button onClick={()=>nextStatus(s.id)} style={{fontSize:10,background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Jost',sans-serif"}}>→ Avanzar</button>
                    )}
                    <button onClick={()=>startEdit(s)} style={{fontSize:10,background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>✏️ Editar</button>
                    <button onClick={()=>del(s.id)} style={{fontSize:10,background:"transparent",color:R.border,border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer"}}>🗑</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {suppliers.length>0&&(
        <div style={{borderTop:`1px solid ${R.border}`,paddingTop:12,marginTop:4,display:"flex",flexWrap:"wrap",gap:"8px 20px"}}>
          {SUP_STATUSES.map(st=>{ const t=totalFor(st); if(!t) return null; const ss=SUP_STYLE[st]; return <span key={st} style={{fontSize:12,color:ss.color,fontWeight:600}}>{st}: ${fmt$(t)} USD</span>; })}
        </div>
      )}
    </div>
  );
}

// ─── MÚSICA TAB ───────────────────────────────────────────────────────────────
const SONG_MOMENTS=["Entrada novios","Entrada novia","Primer baile","Vals con padres","Salida ceremonia","Coctel","Cena","Fiesta — apertura","Fiesta — cierre","Hora loca","Último baile","Otro"];

function MusicTab({ boda, onPatch }) {
  const [songs,setSongs]=useState(boda.songs||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [blank,setBlank]=useState({moment:"Primer baile",title:"",artist:"",notes:""});

  async function persist(u){ setSongs(u); onPatch({songs:u}); await apiSaveNotes(boda.id,{...boda,songs:u}); }
  async function add(){ if(!blank.title.trim()) return; setSaving(true); try{await persist([...songs,{...blank,id:uid()}]); setBlank({moment:"Primer baile",title:"",artist:"",notes:""}); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function del(id){ try{await persist(songs.filter(s=>s.id!==id));}catch{setSongs(songs);} }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{songs.length} canción{songs.length!==1?"es":""}</span>
        <button onClick={()=>setShow(v=>!v)} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div style={{gridColumn:"span 2"}}><select style={INP_SM} value={blank.moment} onChange={e=>setBlank(p=>({...p,moment:e.target.value}))}>{SONG_MOMENTS.map(m=><option key={m}>{m}</option>)}</select></div>
            <input style={INP_SM} value={blank.title}  onChange={e=>setBlank(p=>({...p,title:e.target.value}))}  placeholder="Nombre de la canción *" />
            <input style={INP_SM} value={blank.artist} onChange={e=>setBlank(p=>({...p,artist:e.target.value}))} placeholder="Artista" />
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.notes} onChange={e=>setBlank(p=>({...p,notes:e.target.value}))} placeholder="Notas (versión, link Spotify, instrucciones DJ...)" /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.title.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.title.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":"Agregar"}</button>
            <button onClick={()=>setShow(false)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {songs.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin canciones. Agrega la primera arriba.</p>}
      {SONG_MOMENTS.filter(m=>songs.some(s=>s.moment===m)).map(moment=>(
        <div key={moment} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:12}}>🎵</span>
            <p style={{fontSize:11,fontWeight:700,color:R.muted,textTransform:"uppercase",letterSpacing:".06em",margin:0}}>{moment}</p>
          </div>
          {songs.filter(s=>s.moment===moment).map(s=>(
            <div key={s.id} style={{border:`1px solid ${R.border}`,borderRadius:10,padding:"10px 14px",marginBottom:4,background:R.white,display:"flex",alignItems:"flex-start",gap:10}}>
              <div style={{flex:1}}>
                <p style={{fontSize:13,fontWeight:500,color:R.text,margin:0}}>{s.title}</p>
                {s.artist&&<p style={{fontSize:11,color:R.muted,margin:"2px 0 0"}}>— {s.artist}</p>}
                {s.notes &&<p style={{fontSize:11,color:R.text2,margin:"3px 0 0"}}>{s.notes}</p>}
              </div>
              <button onClick={()=>del(s.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:13}}>✕</button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── FOTOS TAB ────────────────────────────────────────────────────────────────
const PHOTO_CATS=["General","Decoración","Flores","Mesa principal","Iluminación","Vestido","Peinado/Maquillaje","Torta","Stationery","Entrada/Arco","Otro"];

function FotosTab({ boda, onPatch }) {
  const [photos,setPhotos]=useState(boda.photos||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [blank,setBlank]=useState({url:"",label:"",category:"General",notes:""});

  async function persist(u){ setPhotos(u); onPatch({photos:u}); await apiSaveNotes(boda.id,{...boda,photos:u}); }
  async function add(){ if(!blank.url.trim()) return; setSaving(true); try{await persist([...photos,{...blank,id:uid()}]); setBlank({url:"",label:"",category:"General",notes:""}); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function del(id){ try{await persist(photos.filter(p=>p.id!==id));}catch{setPhotos(photos);} }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{photos.length} foto{photos.length!==1?"s":""} de referencia</span>
        <button onClick={()=>setShow(v=>!v)} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.url} onChange={e=>setBlank(p=>({...p,url:e.target.value}))} placeholder="URL de imagen (Pinterest, Instagram, Drive...) *" /></div>
            <input style={INP_SM} value={blank.label} onChange={e=>setBlank(p=>({...p,label:e.target.value}))} placeholder="Título / descripción" />
            <select style={INP_SM} value={blank.category} onChange={e=>setBlank(p=>({...p,category:e.target.value}))}>{PHOTO_CATS.map(c=><option key={c}>{c}</option>)}</select>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.notes} onChange={e=>setBlank(p=>({...p,notes:e.target.value}))} placeholder="Notas (qué me gusta, adaptación...)" /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.url.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.url.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":"Agregar"}</button>
            <button onClick={()=>setShow(false)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {photos.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin fotos. Agrega referencias de Pinterest, Instagram o Drive.</p>}
      {PHOTO_CATS.filter(c=>photos.some(p=>p.category===c)).map(cat=>(
        <div key={cat} style={{marginBottom:16}}>
          <p style={{fontSize:11,fontWeight:700,color:R.muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 8px"}}>🖼 {cat}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
            {photos.filter(p=>p.category===cat).map(p=>(
              <div key={p.id} style={{border:`1px solid ${R.border}`,borderRadius:10,overflow:"hidden",background:R.white,position:"relative"}}>
                <a href={p.url} target="_blank" rel="noreferrer" style={{display:"block",textDecoration:"none"}}>
                  <div style={{width:"100%",paddingTop:"75%",position:"relative",background:"#f5f5f4",overflow:"hidden"}}>
                    <img src={p.url} alt={p.label||cat} onError={e=>{e.target.style.display="none"; if(e.target.nextSibling) e.target.nextSibling.style.display="flex";}}
                      style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} />
                    <div style={{position:"absolute",inset:0,display:"none",alignItems:"center",justifyContent:"center",fontSize:28}}>🖼</div>
                  </div>
                  {p.label&&<p style={{fontSize:11,color:R.text,margin:0,padding:"6px 8px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.label}</p>}
                  {p.notes&&<p style={{fontSize:10,color:R.muted,margin:0,padding:"0 8px 6px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.notes}</p>}
                </a>
                <button onClick={()=>del(p.id)} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.5)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── LLAMADAS TAB ─────────────────────────────────────────────────────────────
function LlamadasTab({ boda, onPatch }) {
  const [calls,setCalls]=useState(boda.calls||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [blank,setBlank]=useState({date:new Date().toISOString().slice(0,10),topic:"",summary:"",followUps:""});

  async function persist(u){ setCalls(u); onPatch({calls:u}); await apiSaveNotes(boda.id,{...boda,calls:u}); }
  async function add(){ if(!blank.summary.trim()) return; setSaving(true); try{await persist([{...blank,id:uid()},...calls]); setBlank({date:new Date().toISOString().slice(0,10),topic:"",summary:"",followUps:""}); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function del(id){ try{await persist(calls.filter(c=>c.id!==id));}catch{setCalls(calls);} }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{calls.length} nota{calls.length!==1?"s":""}</span>
        <button onClick={()=>setShow(v=>!v)} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Nueva nota</button>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input type="date" style={INP_SM} value={blank.date}  onChange={e=>setBlank(p=>({...p,date:e.target.value}))} />
            <input style={INP_SM} value={blank.topic} onChange={e=>setBlank(p=>({...p,topic:e.target.value}))} placeholder="Tema (ej: Llamada kickoff)" />
            <div style={{gridColumn:"span 2"}}><textarea style={{...INP_SM,resize:"vertical"}} rows={4} value={blank.summary}   onChange={e=>setBlank(p=>({...p,summary:e.target.value}))}   placeholder="Resumen de la llamada / reunión *" /></div>
            <div style={{gridColumn:"span 2"}}><textarea style={{...INP_SM,resize:"vertical"}} rows={2} value={blank.followUps} onChange={e=>setBlank(p=>({...p,followUps:e.target.value}))} placeholder="Pendientes / follow-ups (uno por línea)" /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.summary.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.summary.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":"Guardar"}</button>
            <button onClick={()=>setShow(false)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {calls.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin notas de llamadas aún.</p>}
      {calls.map(c=>(
        <div key={c.id} style={{border:`1px solid ${R.border}`,borderRadius:12,padding:"12px 16px",marginBottom:8,background:R.white}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {c.topic&&<span style={{fontSize:13,fontWeight:600,color:R.text}}>{c.topic}</span>}
              <span style={{fontSize:11,color:R.muted}}>{fmtDate(c.date)}</span>
            </div>
            <button onClick={()=>del(c.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:13,flexShrink:0}}>✕</button>
          </div>
          <p style={{fontSize:13,color:R.text2,margin:0,whiteSpace:"pre-line",lineHeight:1.6}}>{c.summary}</p>
          {c.followUps&&(
            <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${R.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:R.muted,margin:"0 0 4px",textTransform:"uppercase",letterSpacing:".04em"}}>⚡ Pendientes</p>
              {c.followUps.split("\n").filter(Boolean).map((f,i)=>(
                <p key={i} style={{fontSize:12,color:R.text,margin:"2px 0",paddingLeft:12}}>• {f}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TIMELINE ────────────────────────────────────────────────────────────────
const M_CATS=["General","Novios","Proveedores","Coordinación","Música","Fotos/Video","Protocolo"];
const M_COLORS={"General":{bg:"#f5f5f4",color:"#57534e"},"Novios":{bg:"#fff0f3",color:"#be123c"},"Proveedores":{bg:"#fffbeb",color:"#b45309"},"Coordinación":{bg:"#eff6ff",color:"#1d4ed8"},"Música":{bg:"#f5f3ff",color:"#7c3aed"},"Fotos/Video":{bg:"#f0fdfa",color:"#0f766e"},"Protocolo":{bg:"#fff7ed",color:"#c2410c"}};

const TL_HIGHLIGHTS=[
  {label:"Sin resaltar",value:""},
  {label:"Rosa",value:"#fce7f3"},
  {label:"Dorado",value:"#fef3c7"},
  {label:"Azul",value:"#dbeafe"},
  {label:"Verde",value:"#dcfce7"},
  {label:"Lila",value:"#ede9fe"},
];

function TimelineTab({ boda, onScheduleChange }) {
  const [schedule,setSchedule]=useState(boda.schedule||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editing,setEditing]=useState(null);
  const [view,setView]=useState("interno");
  const BLANK={time:"",description:"",assignedTo:"",notes:"",category:"General",isInternal:false,isHighlight:false,highlightColor:""};
  const [blank,setBlank]=useState(BLANK);
  const sorted=[...schedule].sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  const visible=view==="cliente"?sorted.filter(e=>!e.isInternal):sorted;
  async function persist(u){ setSchedule(u); onScheduleChange(u); await apiUpdateSchedule(boda.id,u); }
  async function add(){ if(!blank.time||!blank.description.trim()) return; setSaving(true); try{await persist([...schedule,{...blank,id:uid()}]); setBlank(BLANK); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function saveEdit(){ if(!editing||!editing.time||!editing.description.trim()) return; setSaving(true); try{await persist(schedule.map(e=>e.id===editing.id?editing:e)); setEditing(null);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function del(id){ try{await persist(schedule.filter(e=>e.id!==id));}catch{setSchedule(schedule);} }

  function EventForm({val,setVal,onSubmit,onCancel,submitLabel}){
    return(
      <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <input type="time" style={INP_SM} value={val.time} onChange={e=>setVal(p=>({...p,time:e.target.value}))} />
          <select style={INP_SM} value={val.category} onChange={e=>setVal(p=>({...p,category:e.target.value}))}>{M_CATS.map(c=><option key={c}>{c}</option>)}</select>
          <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={val.description} onChange={e=>setVal(p=>({...p,description:e.target.value}))} placeholder="Descripción del evento *" /></div>
          <input style={INP_SM} value={val.assignedTo} onChange={e=>setVal(p=>({...p,assignedTo:e.target.value}))} placeholder="Responsable" />
          <input style={INP_SM} value={val.notes} onChange={e=>setVal(p=>({...p,notes:e.target.value}))} placeholder="Notas" />
          <div style={{gridColumn:"span 2",display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:R.muted,cursor:"pointer"}}><input type="checkbox" checked={val.isInternal} onChange={e=>setVal(p=>({...p,isInternal:e.target.checked}))} /> Solo interno</label>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:R.muted,cursor:"pointer"}}><input type="checkbox" checked={val.isHighlight} onChange={e=>setVal(p=>({...p,isHighlight:e.target.checked}))} /> ⭐ Destacado</label>
            <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
              <span style={{fontSize:11,color:R.muted}}>🖍 Resaltar:</span>
              {TL_HIGHLIGHTS.map(h=>(
                <button key={h.value} title={h.label} onClick={()=>setVal(p=>({...p,highlightColor:h.value}))}
                  style={{width:18,height:18,borderRadius:4,border:val.highlightColor===h.value?`2px solid ${R.accent}`:"1px solid #ddd",background:h.value||"#fff",cursor:"pointer",padding:0,flexShrink:0}} />
              ))}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onSubmit} disabled={saving||!val.time||!val.description.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!val.time||!val.description.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":submitLabel}</button>
          <button onClick={onCancel} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",gap:6}}>
          {[["interno","🔐 Interno"],["cliente","👤 Cliente"]].map(([v,l])=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${view===v?R.accent:R.border}`,background:view===v?R.accent:"transparent",color:view===v?"#fff":R.muted,fontSize:11,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:600}}>
              {l}
            </button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          {sorted.length>0&&<button onClick={()=>window.print()} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>🖨</button>}
          <button onClick={()=>{setShow(v=>!v);setEditing(null);}} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
        </div>
      </div>
      {show&&!editing&&<EventForm val={blank} setVal={setBlank} onSubmit={add} onCancel={()=>setShow(false)} submitLabel="Agregar" />}
      {editing&&<EventForm val={editing} setVal={v=>setEditing(p=>({...p,...(typeof v==="function"?v(p):v)}))} onSubmit={saveEdit} onCancel={()=>setEditing(null)} submitLabel="Guardar" />}
      {visible.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>{sorted.length===0?"Sin eventos. Agrega el primero arriba.":"No hay eventos para la vista cliente."}</p>}
      <div style={{position:"relative"}}>
        {visible.length>0&&<div style={{position:"absolute",left:55,top:8,bottom:8,width:1,background:R.border}} />}
        {visible.map(ev=>{
          const cs=M_COLORS[ev.category]||M_COLORS["General"];
          const hl=!!ev.isHighlight;
          const hlBg=ev.highlightColor||(hl?"#fffbf0":ev.isInternal?"#fafafa":R.white);
          const hlBd=ev.highlightColor?R.gold:hl?R.gold:ev.isInternal?"#e5e7eb":R.border;
          return (
            <div key={ev.id} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <div style={{width:54,textAlign:"right",flexShrink:0,paddingTop:10}}><span style={{fontSize:12,fontFamily:"'Jost',sans-serif",fontWeight:600,color:R.text,letterSpacing:".02em",fontVariantNumeric:"tabular-nums"}}>{ev.time}</span></div>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,flex:1,minWidth:0}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:hl||ev.highlightColor?R.gold:R.accent,flexShrink:0,marginTop:12,zIndex:1,boxShadow:`0 0 0 3px ${hl||ev.highlightColor?"rgba(201,169,110,.2)":R.light}`}} />
                <div style={{flex:1,background:hlBg,border:`1px solid ${hlBd}`,borderRadius:12,padding:"10px 14px",minWidth:0,borderLeft:ev.highlightColor?`4px solid ${R.gold}`:undefined}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        {hl&&<span style={{fontSize:12}}>⭐</span>}
                        <span style={{fontSize:13,fontWeight:hl?600:500,color:R.text}}>{ev.description}</span>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:500,background:cs.bg,color:cs.color}}>{ev.category}</span>
                        {ev.isInternal&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:99,background:"#f3f4f6",color:"#6b7280"}}>🔐</span>}
                      </div>
                      {ev.assignedTo&&<p style={{fontSize:11,color:R.muted,margin:"3px 0 0"}}>👤 {ev.assignedTo}</p>}
                      {ev.notes     &&<p style={{fontSize:11,color:R.muted,margin:"2px 0 0"}}>{ev.notes}</p>}
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>{setEditing({...ev});setShow(false);}} style={{color:R.muted,background:"none",border:"none",cursor:"pointer",fontSize:12,padding:"0 3px"}}>✏️</button>
                      <button onClick={()=>del(ev.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:14,padding:"0 2px"}}>✕</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PALETA ───────────────────────────────────────────────────────────────────
function PaletteTab({ boda, onPatch }) {
  const [palette,setPalette]=useState(boda.palette||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [blank,setBlank]=useState({color:"#c9a96e",name:"",notes:""});
  async function persist(u){ setPalette(u); onPatch({palette:u}); await apiSaveNotes(boda.id,{...boda,palette:u}); }
  async function add(){ setSaving(true); try{await persist([...palette,{...blank,id:uid()}]); setBlank({color:"#c9a96e",name:"",notes:""}); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function del(id){ try{await persist(palette.filter(p=>p.id!==id));}catch{setPalette(palette);} }
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{palette.length} color{palette.length!==1?"es":""}</span>
        <button onClick={()=>setShow(v=>!v)} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Color</button>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr",gap:8,marginBottom:8,alignItems:"center"}}>
            <input type="color" value={blank.color} onChange={e=>setBlank(p=>({...p,color:e.target.value}))} style={{width:40,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2}} />
            <input style={INP_SM} value={blank.name}  onChange={e=>setBlank(p=>({...p,name:e.target.value}))}  placeholder="Nombre (ej: Burdeos)" />
            <input style={INP_SM} value={blank.notes} onChange={e=>setBlank(p=>({...p,notes:e.target.value}))} placeholder="Uso (ej: Flores principales)" />
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:saving?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":"Agregar"}</button>
            <button onClick={()=>setShow(false)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {palette.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin colores. Agrega la paleta de la boda.</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10}}>
        {palette.map(p=>(
          <div key={p.id} style={{borderRadius:12,overflow:"hidden",border:`1px solid ${R.border}`,background:R.white,position:"relative"}}>
            <div style={{height:68,background:p.color}} />
            <div style={{padding:"8px 10px 10px"}}>
              <p style={{fontSize:12,fontWeight:600,color:R.text,margin:0}}>{p.name||p.color}</p>
              <p style={{fontSize:10,color:R.muted,margin:"2px 0 0",fontFamily:"monospace"}}>{p.color}</p>
              {p.notes&&<p style={{fontSize:10,color:R.muted,margin:"2px 0 0"}}>{p.notes}</p>}
            </div>
            <button onClick={()=>del(p.id)} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,.4)",color:"#fff",border:"none",borderRadius:"50%",width:18,height:18,fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── INVITADOS TAB ───────────────────────────────────────────────────────────
const RSVP_STATES=["Pendiente","Confirmado","No asiste"];
const RSVP_STYLE={"Pendiente":{bg:"#fff7ed",color:"#c2410c"},"Confirmado":{bg:"#f0fdf4",color:"#15803d"},"No asiste":{bg:"#f1f5f9",color:"#64748b"}};
const G_EVENTS=[["ceremony","⛪","Ceremonia"],["cocktail","🥂","Cóctel"],["reception","🎊","Recepción"]];
const MEAL_OPTIONS=["Sin especificar","Carne","Pescado","Vegetariano","Vegano","Sin gluten","Infantil"];

function GuestTab({ boda, onPatch }) {
  const [guests,setGuests]=useState(boda.guests||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [filter,setFilter]=useState("todos");
  const [view,setView]=useState("lista");
  const [editId,setEditId]=useState(null);
  const BLANK={name:"",contact:"",table:"",rsvp:"Pendiente",ceremony:true,cocktail:true,reception:true,meal:"Sin especificar",notes:""};
  const [blank,setBlank]=useState(BLANK);

  async function persist(u){ setGuests(u); onPatch({guests:u}); await apiSaveNotes(boda.id,{...boda,guests:u}); }
  async function add(){
    if(!blank.name.trim()) return;
    setSaving(true);
    try{
      if(editId){ await persist(guests.map(g=>g.id===editId?{...blank,id:editId}:g)); setEditId(null); }
      else { await persist([...guests,{...blank,id:uid()}]); }
      setBlank(BLANK); setShow(false);
    }catch(e){alert("Error: "+e.message);} setSaving(false);
  }
  function startEdit(g){ setBlank({...BLANK,...g}); setEditId(g.id); setShow(true); }
  async function del(id){ try{await persist(guests.filter(g=>g.id!==id));}catch{setGuests(guests);} }
  async function cycleRsvp(id){ const u=guests.map(g=>{if(g.id!==id)return g; const idx=(RSVP_STATES.indexOf(g.rsvp||"Pendiente")+1)%RSVP_STATES.length; return {...g,rsvp:RSVP_STATES[idx]};}); try{await persist(u);}catch{setGuests(guests);} }

  const confirmed=guests.filter(g=>g.rsvp==="Confirmado").length;
  const pending=guests.filter(g=>g.rsvp==="Pendiente"||!g.rsvp).length;
  const noAsiste=guests.filter(g=>g.rsvp==="No asiste").length;
  const visible=filter==="todos"?guests:guests.filter(g=>(g.rsvp||"Pendiente")===filter);

  const mealSummary=MEAL_OPTIONS.filter(m=>m!=="Sin especificar").map(m=>({m,n:guests.filter(g=>g.rsvp==="Confirmado"&&g.meal===m).length})).filter(x=>x.n>0);

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:11,fontWeight:700,color:R.text,background:R.cream,borderRadius:99,padding:"2px 10px",border:`1px solid ${R.border}`}}>{guests.length} total</span>
          {confirmed>0&&<span style={{fontSize:11,fontWeight:600,color:"#15803d",background:"#f0fdf4",borderRadius:99,padding:"2px 8px",border:"1px solid #bbf7d0"}}>✅ {confirmed}</span>}
          {pending>0&&<span style={{fontSize:11,fontWeight:600,color:"#c2410c",background:"#fff7ed",borderRadius:99,padding:"2px 8px",border:"1px solid #fed7aa"}}>⏳ {pending}</span>}
          {noAsiste>0&&<span style={{fontSize:11,color:"#64748b",background:"#f1f5f9",borderRadius:99,padding:"2px 8px",border:"1px solid #e2e8f0"}}>✕ {noAsiste}</span>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {[["lista","☰"],["tabla","⊞"]].map(([v,ic])=>(
            <button key={v} onClick={()=>setView(v)} title={v==="lista"?"Vista lista":"Vista tabla RSVP"} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${view===v?R.accent:R.border}`,background:view===v?R.accent:"transparent",color:view===v?"#fff":R.muted,fontSize:13,cursor:"pointer"}}>{ic}</button>
          ))}
          <button onClick={()=>{setShow(v=>!v);setEditId(null);setBlank(BLANK);}} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
        </div>
      </div>

      {/* Filters (list view only) */}
      {view==="lista"&&(
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {["todos","Confirmado","Pendiente","No asiste"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"3px 10px",borderRadius:20,border:`1px solid ${filter===f?R.accent:R.border}`,background:filter===f?R.accent:"transparent",color:filter===f?"#fff":R.muted,fontSize:11,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>
              {f==="todos"?"Todos":f}
            </button>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input style={INP_SM} value={blank.name}    onChange={e=>setBlank(p=>({...p,name:e.target.value}))}    placeholder="Nombre del invitado *" />
            <input style={INP_SM} value={blank.contact} onChange={e=>setBlank(p=>({...p,contact:e.target.value}))} placeholder="WhatsApp / email" />
            <input style={INP_SM} value={blank.table}   onChange={e=>setBlank(p=>({...p,table:e.target.value}))}   placeholder="Mesa" />
            <select style={INP_SM} value={blank.rsvp} onChange={e=>setBlank(p=>({...p,rsvp:e.target.value}))}>{RSVP_STATES.map(s=><option key={s}>{s}</option>)}</select>
            <select style={INP_SM} value={blank.meal} onChange={e=>setBlank(p=>({...p,meal:e.target.value}))}>{MEAL_OPTIONS.map(m=><option key={m}>{m}</option>)}</select>
            <input style={INP_SM} value={blank.notes}   onChange={e=>setBlank(p=>({...p,notes:e.target.value}))}   placeholder="Notas / restricciones" />
            <div style={{gridColumn:"span 2",display:"flex",gap:16,flexWrap:"wrap"}}>
              {G_EVENTS.map(([k,ic,l])=>(
                <label key={k} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:R.muted,cursor:"pointer"}}><input type="checkbox" checked={!!blank[k]} onChange={e=>setBlank(p=>({...p,[k]:e.target.checked}))} /> {ic} {l}</label>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.name.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.name.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":(editId?"Guardar":"Agregar")}</button>
            <button onClick={()=>{setShow(false);setEditId(null);}} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* RSVP grid view */}
      {view==="tabla"&&(
        <div>
          <div style={{overflowX:"auto",marginBottom:16}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:R.cream}}>
                  <th style={{textAlign:"left",padding:"8px 12px",borderBottom:`1px solid ${R.border}`,fontWeight:600,color:R.text,fontSize:11}}>Invitado</th>
                  {G_EVENTS.map(([k,ic,l])=><th key={k} style={{padding:"8px 8px",borderBottom:`1px solid ${R.border}`,fontWeight:600,color:R.muted,fontSize:10,textAlign:"center"}}>{ic}<br/>{l}</th>)}
                  <th style={{padding:"8px 8px",borderBottom:`1px solid ${R.border}`,fontWeight:600,color:R.muted,fontSize:10,textAlign:"center"}}>Menú</th>
                  <th style={{padding:"8px 8px",borderBottom:`1px solid ${R.border}`,fontWeight:600,color:R.muted,fontSize:10,textAlign:"center"}}>RSVP</th>
                  <th style={{padding:"8px 8px",borderBottom:`1px solid ${R.border}`,color:R.border,fontSize:10,textAlign:"center"}}>Mesa</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g,i)=>{
                  const rs=RSVP_STYLE[g.rsvp||"Pendiente"];
                  return (
                    <tr key={g.id} style={{background:i%2===0?R.white:R.cream}}>
                      <td style={{padding:"7px 12px",borderBottom:`1px solid ${R.border}`,color:R.text,fontWeight:500}}>
                        {g.name}
                        {g.contact&&<div style={{fontSize:10,color:R.muted}}>{g.contact}</div>}
                      </td>
                      {G_EVENTS.map(([k,ic])=>(
                        <td key={k} style={{textAlign:"center",padding:"7px 8px",borderBottom:`1px solid ${R.border}`}}>
                          {g[k]?<span style={{color:"#15803d",fontSize:13}}>✓</span>:<span style={{color:"#e2e8f0",fontSize:13}}>–</span>}
                        </td>
                      ))}
                      <td style={{textAlign:"center",padding:"7px 8px",borderBottom:`1px solid ${R.border}`,fontSize:11,color:R.muted}}>{g.meal&&g.meal!=="Sin especificar"?g.meal:"–"}</td>
                      <td style={{textAlign:"center",padding:"7px 8px",borderBottom:`1px solid ${R.border}`}}>
                        <button onClick={()=>cycleRsvp(g.id)} style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:rs.bg,color:rs.color,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Jost',sans-serif"}}>{g.rsvp||"Pendiente"}</button>
                      </td>
                      <td style={{textAlign:"center",padding:"7px 8px",borderBottom:`1px solid ${R.border}`,fontSize:11,color:R.muted}}>{g.table||"–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Meal summary */}
          {mealSummary.length>0&&(
            <div style={{background:R.cream,borderRadius:12,padding:"12px 16px",border:`1px solid ${R.border}`}}>
              <p style={{fontSize:11,fontWeight:700,color:R.muted,textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 10px"}}>Resumen de menú (confirmados)</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {mealSummary.map(({m,n})=>(
                  <div key={m} style={{background:R.white,borderRadius:8,padding:"6px 12px",border:`1px solid ${R.border}`,textAlign:"center"}}>
                    <p style={{fontSize:16,fontWeight:700,color:R.accent,margin:0}}>{n}</p>
                    <p style={{fontSize:10,color:R.muted,margin:"2px 0 0"}}>{m}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {view==="lista"&&(
        <>
          {visible.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>{guests.length===0?"Sin invitados. Agrega el primero arriba.":"Sin invitados con ese estado."}</p>}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {visible.map(g=>{
              const rs=RSVP_STYLE[g.rsvp||"Pendiente"]||RSVP_STYLE["Pendiente"];
              return (
                <div key={g.id} style={{border:`1px solid ${R.border}`,borderRadius:10,padding:"10px 14px",background:R.white,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,fontWeight:500,color:R.text}}>{g.name}</span>
                      {g.table&&<span style={{fontSize:11,color:R.muted}}>Mesa {g.table}</span>}
                      {g.meal&&g.meal!=="Sin especificar"&&<span style={{fontSize:10,padding:"1px 7px",borderRadius:99,background:"#fffbeb",color:"#92400e"}}>🍽 {g.meal}</span>}
                      <div style={{display:"flex",gap:3}}>
                        {G_EVENTS.map(([k,ic])=>g[k]&&<span key={k} style={{fontSize:9,padding:"1px 5px",borderRadius:99,background:R.light,color:R.accent}}>{ic}</span>)}
                      </div>
                    </div>
                    {(g.notes||g.contact)&&<p style={{fontSize:11,color:R.muted,margin:"2px 0 0"}}>{[g.contact,g.notes].filter(Boolean).join(" · ")}</p>}
                  </div>
                  <button onClick={()=>cycleRsvp(g.id)} style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,background:rs.bg,color:rs.color,border:"none",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"'Jost',sans-serif"}}>{g.rsvp||"Pendiente"}</button>
                  <button onClick={()=>{startEdit(g);}} style={{color:R.muted,background:"none",border:"none",cursor:"pointer",fontSize:12,flexShrink:0}}>✏️</button>
                  <button onClick={()=>del(g.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:13,flexShrink:0}}>✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── PRESUPUESTO + PAGOS ──────────────────────────────────────────────────────
const BUDGET_CATS = [
  "Lugar / Venue","Catering / Banquete","Fotografía","Video",
  "Decoración","Flores","DJ / Música en vivo","Vestido / Vestimenta",
  "Invitaciones / Papelería","Pastel / Postres","Cabello y Maquillaje",
  "Transporte","Coordinación","Luna de Miel","Otro",
];
const B_STATUS       = ["Pendiente","Anticipo","Parcial","Pagado"];
const B_STATUS_STYLE = {
  "Pendiente":{bg:"#fef3c7",color:"#92400e"},
  "Anticipo": {bg:"#eff6ff",color:"#1d4ed8"},
  "Parcial":  {bg:"#f5f3ff",color:"#6d28d9"},
  "Pagado":   {bg:"#dcfce7",color:"#166534"},
};
const PAY_TYPES   = ["Anticipo","Abono","Saldo final","Devolución","Otro"];
const PAY_METHODS = ["Transferencia","Efectivo","Tarjeta","Nequi/Daviplata","PayPal","Otro"];

function PresupuestoTab({ boda, onPatch }) {
  const [items,  setItems]  = useState(boda.budgetItems || []);
  const [show,   setShow]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [blank,  setBlank]  = useState({ category:BUDGET_CATS[0], budgetAmount:"", actualCost:"", supplier:"", paymentStatus:"Pendiente", notes:"" });

  async function persist(u) { setItems(u); onPatch({ budgetItems:u }); await apiSaveNotes(boda.id,{...boda,budgetItems:u}); }
  async function add() {
    setSaving(true);
    try {
      if (editId) { await persist(items.map(it=>it.id===editId?{...blank,id:editId}:it)); }
      else        { await persist([...items,{...blank,id:uid()}]); }
      setBlank({category:BUDGET_CATS[0],budgetAmount:"",actualCost:"",supplier:"",paymentStatus:"Pendiente",notes:""});
      setShow(false); setEditId(null);
    } catch(e){alert("Error: "+e.message);} setSaving(false);
  }
  function startEdit(it){ setBlank({...it}); setEditId(it.id); setShow(true); }
  async function del(id){ try{await persist(items.filter(it=>it.id!==id));}catch{setItems(items);} }
  async function cycleStatus(id){ const u=items.map(it=>{if(it.id!==id)return it; const idx=(B_STATUS.indexOf(it.paymentStatus||"Pendiente")+1)%B_STATUS.length; return{...it,paymentStatus:B_STATUS[idx]};}); try{await persist(u);}catch{setItems(items);} }

  const num = s=>parseFloat(String(s||"").replace(/,/g,"."))||0;
  const totalBudget=items.reduce((s,it)=>s+num(it.budgetAmount),0);
  const totalActual=items.reduce((s,it)=>s+num(it.actualCost),0);
  const diff=totalBudget-totalActual;
  const pctUsed=totalBudget>0?Math.min(100,(totalActual/totalBudget)*100):0;

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[{label:"Presupuesto",n:`$${fmt$(totalBudget)}`,color:R.accent},{label:"Gasto real",n:`$${fmt$(totalActual)}`,color:"#1d4ed8"},{label:diff>=0?"Disponible":"Excedido",n:`$${fmt$(Math.abs(diff))}`,color:diff>=0?"#166534":"#dc2626"}].map(s=>(
          <div key={s.label} style={{textAlign:"center",background:R.cream,borderRadius:10,padding:"10px 8px",border:`1px solid ${R.border}`}}>
            <p style={{fontSize:18,fontWeight:700,color:s.color,margin:0,fontVariantNumeric:"tabular-nums"}}>{s.n}</p>
            <p style={{fontSize:10,color:R.muted,margin:"2px 0 0"}}>{s.label}</p>
          </div>
        ))}
      </div>
      {totalBudget>0&&(
        <div style={{marginBottom:16}}>
          <div style={{height:6,background:R.light,borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${pctUsed}%`,background:pctUsed>=100?"#dc2626":pctUsed>=80?"#f59e0b":R.accent,borderRadius:99,transition:"width .3s"}} />
          </div>
          <p style={{fontSize:10,color:R.muted,margin:"3px 0 0",textAlign:"right"}}>{pctUsed.toFixed(0)}% del presupuesto</p>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{items.length} categoría{items.length!==1?"s":""}</span>
        <button onClick={()=>{setBlank({category:BUDGET_CATS[0],budgetAmount:"",actualCost:"",supplier:"",paymentStatus:"Pendiente",notes:""});setEditId(null);setShow(v=>!v);}} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <select style={INP_SM} value={blank.category} onChange={e=>setBlank(p=>({...p,category:e.target.value}))}>{BUDGET_CATS.map(c=><option key={c}>{c}</option>)}</select>
            <select style={INP_SM} value={blank.paymentStatus} onChange={e=>setBlank(p=>({...p,paymentStatus:e.target.value}))}>{B_STATUS.map(s=><option key={s}>{s}</option>)}</select>
            <input style={INP_SM} type="number" value={blank.budgetAmount} onChange={e=>setBlank(p=>({...p,budgetAmount:e.target.value}))} placeholder="Presupuesto USD" />
            <input style={INP_SM} type="number" value={blank.actualCost}   onChange={e=>setBlank(p=>({...p,actualCost:e.target.value}))}   placeholder="Costo real USD" />
            <input style={INP_SM} value={blank.supplier} onChange={e=>setBlank(p=>({...p,supplier:e.target.value}))} placeholder="Proveedor" />
            <input style={INP_SM} value={blank.notes}    onChange={e=>setBlank(p=>({...p,notes:e.target.value}))}    placeholder="Notas" />
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:saving?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":editId?"Guardar":"Agregar"}</button>
            <button onClick={()=>{setShow(false);setEditId(null);}} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {items.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin categorías. Agrega la primera arriba.</p>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {items.map(it=>{
          const st=B_STATUS_STYLE[it.paymentStatus||"Pendiente"]||B_STATUS_STYLE["Pendiente"];
          const b=num(it.budgetAmount), a=num(it.actualCost);
          const pct=b>0?Math.min(100,(a/b)*100):0;
          return (
            <div key={it.id} style={{border:`1px solid ${R.border}`,borderRadius:12,padding:"12px 14px",background:R.white}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:R.text}}>{it.category}</span>
                    {it.supplier&&<span style={{fontSize:11,color:R.muted}}>{it.supplier}</span>}
                  </div>
                  <div style={{display:"flex",gap:16,fontSize:12,color:R.text2,marginBottom:b>0?8:0,flexWrap:"wrap"}}>
                    {b>0&&<span>💰 Ppto: <strong>${fmt$(b)}</strong></span>}
                    {a>0&&<span>🧾 Real: <strong>${fmt$(a)}</strong></span>}
                    {b>0&&a>0&&<span style={{color:a<=b?"#166534":"#dc2626"}}>{a<=b?`✅ $${fmt$(b-a)} libre`:`⚠️ $${fmt$(a-b)} extra`}</span>}
                  </div>
                  {b>0&&<div style={{height:4,background:R.light,borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:pct>=100?"#dc2626":pct>=80?"#f59e0b":"#22c55e",borderRadius:99}} /></div>}
                  {it.notes&&<p style={{fontSize:11,color:R.muted,margin:"4px 0 0"}}>{it.notes}</p>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end",flexShrink:0}}>
                  <button onClick={()=>cycleStatus(it.id)} style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,background:st.bg,color:st.color,border:"none",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Jost',sans-serif"}}>{it.paymentStatus||"Pendiente"}</button>
                  <div style={{display:"flex",gap:4}}>
                    <button onClick={()=>startEdit(it)} style={{color:R.muted,background:"none",border:"none",cursor:"pointer",fontSize:12}}>✏️</button>
                    <button onClick={()=>del(it.id)}    style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:12}}>✕</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PagosTab({ boda, onPatch }) {
  const [payments, setPayments] = useState(boda.payments || []);
  const [show,   setShow]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [blank,  setBlank]  = useState({ concept:"", amount:"", type:"Anticipo", method:"Transferencia", date:"", supplier:"", notes:"", received:true });

  async function persist(u){ setPayments(u); onPatch({payments:u}); await apiSaveNotes(boda.id,{...boda,payments:u}); }
  async function add(){
    if(!blank.concept.trim()||!blank.amount) return;
    setSaving(true);
    try {
      if(editId){ await persist(payments.map(p=>p.id===editId?{...blank,id:editId}:p)); }
      else      { await persist([...payments,{...blank,id:uid()}]); }
      setBlank({concept:"",amount:"",type:"Anticipo",method:"Transferencia",date:"",supplier:"",notes:"",received:true});
      setShow(false); setEditId(null);
    } catch(e){alert("Error: "+e.message);} setSaving(false);
  }
  function startEdit(p){ setBlank({...p}); setEditId(p.id); setShow(true); }
  async function del(id){ try{await persist(payments.filter(p=>p.id!==id));}catch{setPayments(payments);} }
  async function toggleReceived(id){ const u=payments.map(p=>p.id===id?{...p,received:!p.received}:p); try{await persist(u);}catch{setPayments(payments);} }

  const num = s=>parseFloat(String(s||"").replace(/,/g,"."))||0;
  const totalIn  = payments.filter(p=>p.received&&p.type!=="Devolución").reduce((s,p)=>s+num(p.amount),0);
  const totalOut = payments.filter(p=>p.received&&p.type==="Devolución").reduce((s,p)=>s+num(p.amount),0);
  const pending  = payments.filter(p=>!p.received).reduce((s,p)=>s+num(p.amount),0);

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
        {[{label:"Recibido",n:`$${fmt$(totalIn)}`,color:"#166534"},{label:"Pendiente",n:`$${fmt$(pending)}`,color:"#92400e"},{label:"Devoluciones",n:`$${fmt$(totalOut)}`,color:"#dc2626"}].map(s=>(
          <div key={s.label} style={{textAlign:"center",background:R.cream,borderRadius:10,padding:"10px 8px",border:`1px solid ${R.border}`}}>
            <p style={{fontSize:18,fontWeight:700,color:s.color,margin:0,fontVariantNumeric:"tabular-nums"}}>{s.n}</p>
            <p style={{fontSize:10,color:R.muted,margin:"2px 0 0"}}>{s.label}</p>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{payments.length} pago{payments.length!==1?"s":""}</span>
        <button onClick={()=>{setBlank({concept:"",amount:"",type:"Anticipo",method:"Transferencia",date:"",supplier:"",notes:"",received:true});setEditId(null);setShow(v=>!v);}} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Registrar</button>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input style={{...INP_SM,gridColumn:"span 2"}} value={blank.concept} onChange={e=>setBlank(p=>({...p,concept:e.target.value}))} placeholder="Concepto *" />
            <input style={INP_SM} type="number" value={blank.amount} onChange={e=>setBlank(p=>({...p,amount:e.target.value}))} placeholder="Monto USD *" />
            <select style={INP_SM} value={blank.type}   onChange={e=>setBlank(p=>({...p,type:e.target.value}))}>{PAY_TYPES.map(t=><option key={t}>{t}</option>)}</select>
            <select style={INP_SM} value={blank.method} onChange={e=>setBlank(p=>({...p,method:e.target.value}))}>{PAY_METHODS.map(m=><option key={m}>{m}</option>)}</select>
            <input style={INP_SM} type="date" value={blank.date} onChange={e=>setBlank(p=>({...p,date:e.target.value}))} />
            <input style={INP_SM} value={blank.supplier} onChange={e=>setBlank(p=>({...p,supplier:e.target.value}))} placeholder="Proveedor / Cliente" />
            <input style={INP_SM} value={blank.notes}    onChange={e=>setBlank(p=>({...p,notes:e.target.value}))}    placeholder="Notas" />
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:R.muted,cursor:"pointer"}}><input type="checkbox" checked={blank.received} onChange={e=>setBlank(p=>({...p,received:e.target.checked}))} /> Confirmado / recibido</label>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.concept.trim()||!blank.amount} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.concept.trim()||!blank.amount)?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":editId?"Guardar":"Registrar"}</button>
            <button onClick={()=>{setShow(false);setEditId(null);}} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {payments.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin pagos registrados. Agrega el primero arriba.</p>}
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {[...payments].sort((a,b)=>(b.date||"").localeCompare(a.date||"")).map(p=>{
          const amt=num(p.amount);
          return (
            <div key={p.id} style={{border:`1px solid ${R.border}`,borderRadius:10,padding:"10px 14px",background:R.white,display:"flex",alignItems:"center",gap:10,opacity:p.received?1:.7}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:13,fontWeight:600,color:R.text}}>{p.concept}</span>
                  <span style={{fontSize:11,padding:"1px 7px",borderRadius:99,background:R.light,color:R.muted}}>{p.type}</span>
                  {p.supplier&&<span style={{fontSize:11,color:R.muted}}>{p.supplier}</span>}
                </div>
                <div style={{display:"flex",gap:12,fontSize:11,color:R.muted,marginTop:2,flexWrap:"wrap"}}>
                  {p.date&&<span>📅 {fmtDate(p.date)}</span>}
                  {p.method&&<span>💳 {p.method}</span>}
                  {p.notes&&<span>{p.notes}</span>}
                </div>
              </div>
              <span style={{fontSize:14,fontWeight:700,color:p.type==="Devolución"?"#dc2626":"#166534",fontVariantNumeric:"tabular-nums",flexShrink:0}}>{p.type==="Devolución"?"-":"+"} ${fmt$(amt)}</span>
              <button onClick={()=>toggleReceived(p.id)} title={p.received?"Confirmado":"Pendiente"} style={{fontSize:14,background:"none",border:"none",cursor:"pointer",flexShrink:0,opacity:p.received?1:.35}}>✅</button>
              <button onClick={()=>startEdit(p)}  style={{color:R.muted, background:"none",border:"none",cursor:"pointer",fontSize:12,flexShrink:0}}>✏️</button>
              <button onClick={()=>del(p.id)}     style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:13,flexShrink:0}}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DESIGN STUDIO ───────────────────────────────────────────────────────────
const STUDIO_CATS=["Fotografía","Video","Flores","Decoración","Venue","Catering","Música","Iluminación","Papelería","Vestido","Inspiración","Otro"];

function DesignStudioTab({ boda, onPatch }) {
  const [items,setItems]=useState(boda.studio||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editId,setEditId]=useState(null);
  const [filter,setFilter]=useState("todos");
  const BLANK={title:"",category:STUDIO_CATS[0],url:"",notes:""};
  const [blank,setBlank]=useState(BLANK);

  async function persist(u){ setItems(u); onPatch({studio:u}); await apiSaveNotes(boda.id,{...boda,studio:u}); }
  async function add(){
    if(!blank.title.trim()) return;
    setSaving(true);
    try{
      if(editId){ await persist(items.map(it=>it.id===editId?{...blank,id:editId}:it)); setEditId(null); }
      else { await persist([...items,{...blank,id:uid()}]); }
      setBlank(BLANK); setShow(false);
    }catch(e){alert("Error: "+e.message);} setSaving(false);
  }
  function startEdit(it){ setBlank({...BLANK,...it}); setEditId(it.id); setShow(true); }
  async function del(id){ try{await persist(items.filter(it=>it.id!==id));}catch{setItems(items);} }

  const visible=filter==="todos"?items:items.filter(it=>it.category===filter);
  const cats=[...new Set(items.map(it=>it.category))];

  function isImage(url){ return /\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/i.test(url)||url.includes("drive.google.com/uc")||url.includes("lh3.googleusercontent"); }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{items.length} referencia{items.length!==1?"s":""}</span>
        <button onClick={()=>{setShow(v=>!v);setEditId(null);setBlank(BLANK);}} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
      </div>
      {cats.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          {["todos",...cats].map(c=>(
            <button key={c} onClick={()=>setFilter(c)} style={{padding:"3px 10px",borderRadius:20,border:`1px solid ${filter===c?R.accent:R.border}`,background:filter===c?R.accent:"transparent",color:filter===c?"#fff":R.muted,fontSize:11,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>
              {c==="todos"?"Todos":c}
            </button>
          ))}
        </div>
      )}
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input style={INP_SM} value={blank.title}    onChange={e=>setBlank(p=>({...p,title:e.target.value}))}    placeholder="Título / nombre *" />
            <select style={INP_SM} value={blank.category} onChange={e=>setBlank(p=>({...p,category:e.target.value}))}>{STUDIO_CATS.map(c=><option key={c}>{c}</option>)}</select>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.url} onChange={e=>setBlank(p=>({...p,url:e.target.value}))} placeholder="URL (imagen, Pinterest, Drive, PDF...)" /></div>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.notes} onChange={e=>setBlank(p=>({...p,notes:e.target.value}))} placeholder="Notas / descripción" /></div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.title.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.title.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":(editId?"Guardar":"Agregar")}</button>
            <button onClick={()=>{setShow(false);setEditId(null);}} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {visible.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>{items.length===0?"Sin referencias aún. Agrega fotos, links de Pinterest, PDFs de proveedores...":"Sin items en esta categoría."}</p>}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
        {visible.map(it=>(
          <div key={it.id} style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:14,overflow:"hidden",position:"relative"}}>
            {/* Preview */}
            {it.url&&isImage(it.url)?(
              <div style={{height:140,overflow:"hidden",background:R.cream,position:"relative"}}>
                <img src={it.url} alt={it.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.target.parentElement.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;">🖼</div>';}} />
              </div>
            ):it.url?(
              <div style={{height:80,background:`linear-gradient(135deg,${R.dark},${R.mid})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <a href={it.url} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:R.gold,fontSize:12,fontFamily:"'Jost',sans-serif",textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:20}}>{it.url.includes("pdf")?"📄":"🔗"}</span> Ver enlace →
                </a>
              </div>
            ):(
              <div style={{height:80,background:R.light,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>✨</div>
            )}
            <div style={{padding:"10px 12px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:6}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600,color:R.text,margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.title}</p>
                  <span style={{fontSize:10,padding:"1px 7px",borderRadius:99,background:R.light,color:R.accent,fontWeight:600}}>{it.category}</span>
                  {it.notes&&<p style={{fontSize:11,color:R.muted,margin:"4px 0 0"}}>{it.notes}</p>}
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:2,flexShrink:0}}>
                  {it.url&&<a href={it.url} target="_blank" rel="noreferrer" style={{color:R.muted,fontSize:12,textDecoration:"none"}} title="Abrir link">↗</a>}
                  <button onClick={()=>startEdit(it)} style={{color:R.muted,background:"none",border:"none",cursor:"pointer",fontSize:11,padding:0}}>✏️</button>
                  <button onClick={()=>del(it.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:12,padding:0}}>✕</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MESAS / SEATING ─────────────────────────────────────────────────────────
const TABLE_SHAPES=["Redonda","Rectangular","Cuadrada","Imperial"];

// SVG table-with-chairs renderer
function TableViz({table, tGuests, isSelected}) {
  const total=table.seats, filled=tGuests.length;
  const ratio=filled/Math.max(1,total);
  const chairCol=ratio>=1?"#ef4444":ratio>0.7?"#f59e0b":"#4ade80";
  const emptyCol="#d1d5db";
  const stroke=isSelected?R.accent:ratio>=1?"#ef4444":ratio>0?"#22c55e":R.border;
  const tableBg=ratio>=1?"#fef2f2":ratio>0?"#f0fdf4":"#fff";
  const nameText=table.name.length>8?table.name.slice(0,7)+"…":table.name;

  if(table.shape==="Redonda"){
    const shown=Math.min(total,16);
    const Rt=26, Rc=40, rc=5.5;
    const sz=(Rc+rc+4)*2; const cx=sz/2, cy=sz/2;
    return (
      <svg width={sz} height={sz} style={{display:"block",overflow:"visible"}}>
        {Array.from({length:shown},(_,i)=>{
          const a=(i/shown)*2*Math.PI-Math.PI/2;
          return <circle key={i} cx={cx+Rc*Math.cos(a)} cy={cy+Rc*Math.sin(a)} r={rc} fill={i<filled?chairCol:emptyCol} stroke="rgba(0,0,0,.12)" strokeWidth={0.5}/>;
        })}
        <circle cx={cx} cy={cy} r={Rt} fill={tableBg} stroke={stroke} strokeWidth={isSelected?2:1.5}/>
        <text x={cx} y={cy-3} textAnchor="middle" fontSize={8} fontFamily="'Jost',sans-serif" fontWeight="700" fill={R.text}>{nameText}</text>
        <text x={cx} y={cy+8} textAnchor="middle" fontSize={7} fontFamily="'Jost',sans-serif" fill={R.muted}>{filled}/{total}</text>
      </svg>
    );
  }
  // Rectangular / Cuadrada / Imperial
  const perTop=Math.ceil(total/2), perBot=total-perTop;
  const cw=10,ch=7,gap=3;
  const tableW=table.shape==="Imperial"?Math.max(100,perTop*(cw+gap)+8):Math.max(64,perTop*(cw+gap)+8);
  const tableH=table.shape==="Imperial"?18:26;
  const svgW=tableW+8, svgH=tableH+2*(ch+gap+6);
  const ty=ch+gap+4;
  return (
    <svg width={svgW} height={svgH} style={{display:"block",overflow:"visible"}}>
      {Array.from({length:perTop},(_,i)=><rect key={`t${i}`} x={4+i*(cw+gap)} y={2} width={cw} height={ch} rx={2} fill={i<Math.ceil(filled/2)?chairCol:emptyCol} stroke="rgba(0,0,0,.12)" strokeWidth={0.5}/>)}
      {Array.from({length:perBot},(_,i)=><rect key={`b${i}`} x={4+i*(cw+gap)} y={ty+tableH+gap} width={cw} height={ch} rx={2} fill={perTop+i<filled?chairCol:emptyCol} stroke="rgba(0,0,0,.12)" strokeWidth={0.5}/>)}
      <rect x={2} y={ty} width={tableW} height={tableH} rx={table.shape==="Imperial"?3:5} fill={tableBg} stroke={stroke} strokeWidth={isSelected?2:1.5}/>
      <text x={2+tableW/2} y={ty+tableH/2-2} textAnchor="middle" fontSize={7} fontFamily="'Jost',sans-serif" fontWeight="700" fill={R.text}>{nameText}</text>
      <text x={2+tableW/2} y={ty+tableH/2+7} textAnchor="middle" fontSize={6} fontFamily="'Jost',sans-serif" fill={R.muted}>{filled}/{total}</text>
    </svg>
  );
}

function SeatingTab({ boda, onPatch }) {
  const [seating,setSeating]=useState(()=>(boda.seating||[]).map((t,i)=>({x:80+(i%4)*170,y:60+Math.floor(i/4)*160,...t})));
  const [guests,setGuests]=useState(boda.guests||[]);
  const [floorUrl,setFloorUrl]=useState(()=>{ try{return localStorage.getItem("tt_floor_"+boda.id)||"";}catch{return "";} });
  const [showNew,setShowNew]=useState(false);
  const [showFloor,setShowFloor]=useState(false);
  const [saving,setSaving]=useState(false);
  const [selected,setSelected]=useState(null);
  const [drag,setDrag]=useState(null); // {id, ox, oy}
  const canvasRef=useRef(null);
  const seatingRef=useRef(seating);
  seatingRef.current=seating; // always current for async handlers

  const BLANK={name:"",shape:"Redonda",seats:8};
  const [blank,setBlank]=useState(BLANK);

  async function saveSeating(s){ setSeating(s); onPatch({seating:s}); await apiSaveNotes(boda.id,{...boda,seating:s}); }
  async function saveGuests(g){ setGuests(g); onPatch({guests:g}); await apiSaveNotes(boda.id,{...boda,guests:g}); }

  async function addTable(){
    if(!blank.name.trim()) return; setSaving(true);
    const placed=seatingRef.current;
    const newT={...blank,id:uid(),x:80+(placed.length%4)*170,y:60+Math.floor(placed.length/4)*160};
    try{await saveSeating([...placed,newT]);setBlank(BLANK);setShowNew(false);}catch(e){alert(e.message);}
    setSaving(false);
  }
  async function delTable(id){
    try{
      await saveSeating(seatingRef.current.filter(t=>t.id!==id));
      await saveGuests(guests.map(g=>g.tableId===id?{...g,tableId:""}:g));
      setSelected(null);
    }catch{}
  }
  async function assignGuest(gId,tId){ const u=guests.map(g=>g.id===gId?{...g,tableId:tId}:g); try{await saveGuests(u);}catch{} }

  // Drag
  function onTblDown(e,tbl){
    e.preventDefault(); e.stopPropagation();
    if(!canvasRef.current) return;
    const r=canvasRef.current.getBoundingClientRect();
    setDrag({id:tbl.id,ox:e.clientX-r.left-tbl.x,oy:e.clientY-r.top-tbl.y});
  }
  function onCanvasMove(e){
    if(!drag||!canvasRef.current) return;
    const r=canvasRef.current.getBoundingClientRect();
    const nx=Math.max(0,Math.min(r.width-100,e.clientX-r.left-drag.ox));
    const ny=Math.max(0,Math.min(r.height-80,e.clientY-r.top-drag.oy));
    setSeating(prev=>prev.map(t=>t.id===drag.id?{...t,x:nx,y:ny}:t));
  }
  async function onCanvasUp(){
    if(!drag) return;
    setDrag(null);
    const s=seatingRef.current;
    onPatch({seating:s});
    try{await apiSaveNotes(boda.id,{...boda,seating:s});}catch{}
  }

  // Floor plan
  function handleFloorFile(e){
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const url=ev.target.result;
      setFloorUrl(url);
      try{localStorage.setItem("tt_floor_"+boda.id,url);}catch{}
    };
    reader.readAsDataURL(file);
  }
  function clearFloor(){ setFloorUrl(""); try{localStorage.removeItem("tt_floor_"+boda.id);}catch{} }

  const assigned=guests.filter(g=>g.tableId&&seating.find(t=>t.id===g.tableId));
  const unassigned=guests.filter(g=>!g.tableId||!seating.find(t=>t.id===g.tableId));
  const selTable=selected?seating.find(t=>t.id===selected):null;
  const selGuests=selTable?guests.filter(g=>g.tableId===selTable.id):[];

  return (
    <div>
      {/* Toolbar */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,flexWrap:"wrap"}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{seating.length} mesa{seating.length!==1?"s":""} · {assigned.length}/{guests.length} asignados</span>
        <div style={{flex:1}}/>
        <button onClick={()=>setShowFloor(v=>!v)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>🗺 Plano de fondo</button>
        <button onClick={()=>{setShowNew(v=>!v);setSelected(null);}} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:600}}>+ Mesa</button>
      </div>

      {/* Floor plan URL */}
      {showFloor&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:12,marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:11,color:R.muted,flexShrink:0}}>Subir imagen del salón:</span>
          <label style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:11,color:R.accent,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>
            📎 Elegir archivo
            <input type="file" accept="image/*" onChange={handleFloorFile} style={{display:"none"}} />
          </label>
          {floorUrl&&<button onClick={clearFloor} style={{background:"none",border:"none",color:"#dc2626",cursor:"pointer",fontSize:12}}>✕ Quitar</button>}
          <button onClick={()=>setShowFloor(false)} style={{background:"none",border:"none",color:R.muted,cursor:"pointer",fontSize:11,marginLeft:"auto"}}>Cerrar</button>
        </div>
      )}

      {/* New table form */}
      {showNew&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 80px",gap:8,marginBottom:8}}>
            <input style={INP_SM} value={blank.name} onChange={e=>setBlank(p=>({...p,name:e.target.value}))} placeholder="Nombre *" autoFocus />
            <select style={INP_SM} value={blank.shape} onChange={e=>setBlank(p=>({...p,shape:e.target.value}))}>{TABLE_SHAPES.map(s=><option key={s}>{s}</option>)}</select>
            <input type="number" style={INP_SM} value={blank.seats} onChange={e=>setBlank(p=>({...p,seats:Math.max(1,parseInt(e.target.value)||8)}))} min={1} max={40} />
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={addTable} disabled={saving||!blank.name.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.name.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":"Crear"}</button>
            <button onClick={()=>setShowNew(false)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}

      {/* ── CANVAS ── */}
      <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
        {/* Floor plan canvas */}
        <div
          ref={canvasRef}
          style={{flex:1,position:"relative",minHeight:480,background:"#f5f0f2",borderRadius:16,border:`2px dashed ${R.border}`,overflow:"hidden",cursor:drag?"grabbing":"default",userSelect:"none"}}
          onMouseMove={onCanvasMove}
          onMouseUp={onCanvasUp}
          onMouseLeave={onCanvasUp}
          onClick={()=>setSelected(null)}
        >
          {/* Floor plan background */}
          {floorUrl&&<img src={floorUrl} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",opacity:.25,pointerEvents:"none"}} />}

          {/* Room walls hint */}
          {!floorUrl&&seating.length===0&&(
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,pointerEvents:"none"}}>
              <span style={{fontSize:40}}>🏛</span>
              <p style={{fontSize:13,color:R.muted,margin:0,fontFamily:"'Jost',sans-serif"}}>Agrega mesas con el botón de arriba</p>
              <p style={{fontSize:11,color:R.border,margin:0}}>Arrastra para acomodar el salón · Click para asignar invitados</p>
            </div>
          )}

          {/* Tables */}
          {seating.map(tbl=>{
            const tG=guests.filter(g=>g.tableId===tbl.id);
            const isSel=selected===tbl.id;
            return (
              <div key={tbl.id}
                style={{position:"absolute",left:tbl.x||50,top:tbl.y||50,cursor:drag?.id===tbl.id?"grabbing":"grab",zIndex:isSel?10:1,filter:isSel?"drop-shadow(0 4px 12px rgba(190,18,60,.3))":"drop-shadow(0 2px 4px rgba(0,0,0,.15))"}}
                onMouseDown={e=>onTblDown(e,tbl)}
                onClick={e=>{e.stopPropagation();setSelected(isSel?null:tbl.id);}}>
                <TableViz table={tbl} tGuests={tG} isSelected={isSel}/>
              </div>
            );
          })}

          {/* Legend */}
          <div style={{position:"absolute",bottom:10,left:10,display:"flex",gap:8,flexWrap:"wrap"}}>
            {[["#4ade80","Disponible"],["#f59e0b",">70%"],["#ef4444","Llena"],["#d1d5db","Vacía"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:3,background:"rgba(255,255,255,.8)",borderRadius:99,padding:"2px 8px"}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:c}}/>
                <span style={{fontSize:9,color:R.muted}}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel: selected table OR unassigned */}
        <div style={{width:200,flexShrink:0}}>
          {selTable?(
            <div style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:14,overflow:"hidden"}}>
              <div style={{background:R.dark,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{fontSize:13,fontWeight:600,color:R.white,fontFamily:"'Cormorant Garamond',serif"}}>{selTable.name}</span>
                <button onClick={()=>delTable(selTable.id)} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:12}}>🗑</button>
              </div>
              <div style={{padding:10}}>
                <p style={{fontSize:10,color:R.muted,margin:"0 0 8px"}}>{selTable.shape} · {selGuests.length}/{selTable.seats} puestos</p>
                {selGuests.map(g=>(
                  <div key={g.id} style={{display:"flex",alignItems:"center",gap:4,marginBottom:4,background:R.cream,borderRadius:8,padding:"4px 8px"}}>
                    <span style={{flex:1,fontSize:11,color:R.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.name}</span>
                    <button onClick={()=>assignGuest(g.id,"")} style={{background:"none",border:"none",color:R.muted,cursor:"pointer",fontSize:10,flexShrink:0}}>✕</button>
                  </div>
                ))}
                {unassigned.length>0&&selGuests.length<selTable.seats&&(
                  <select onChange={e=>{if(e.target.value){assignGuest(e.target.value,selTable.id);e.target.value="";}}} style={{...INP_SM,width:"100%",fontSize:11,marginTop:4}} defaultValue="">
                    <option value="">+ Asignar...</option>
                    {unassigned.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                )}
                {selGuests.length>=selTable.seats&&<p style={{fontSize:10,color:"#dc2626",margin:"6px 0 0",fontWeight:600}}>⚠️ Mesa completa</p>}
              </div>
            </div>
          ):(
            <div style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:14,overflow:"hidden"}}>
              <div style={{background:R.cream,padding:"10px 14px",borderBottom:`1px solid ${R.border}`}}>
                <p style={{fontSize:11,fontWeight:700,color:R.muted,margin:0,textTransform:"uppercase",letterSpacing:".05em"}}>Sin asignar ({unassigned.length})</p>
              </div>
              <div style={{padding:10,maxHeight:380,overflowY:"auto"}}>
                {unassigned.length===0?(
                  <p style={{fontSize:11,color:R.muted,fontStyle:"italic",margin:0}}>¡Todos asignados! 🎉</p>
                ):unassigned.map(g=>(
                  <div key={g.id} style={{fontSize:11,color:R.text,padding:"4px 8px",marginBottom:3,background:R.cream,borderRadius:8,display:"flex",alignItems:"center",gap:4}}>
                    <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.name}</span>
                    {seating.length>0&&(
                      <select onChange={e=>{if(e.target.value){assignGuest(g.id,e.target.value);e.target.value="";}}} style={{...INP_SM,padding:"1px 4px",fontSize:9,width:70,flexShrink:0}} defaultValue="">
                        <option value="">Mesa…</option>
                        {seating.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BODA DETAIL ─────────────────────────────────────────────────────────────
function BodaDetail({ boda:init, users, onBack, onRefresh }) {
  const [boda,setBoda]=useState(init);
  const [tab,setTab]=useState("resumen");
  const [editing,setEditing]=useState(false);
  const [saving,setSaving]=useState(false);
  const [copied,setCopied]=useState(false);
  function shareLink() {
    const url=`${window.location.origin}/?mode=bodas-cliente&id=${boda.id}`;
    navigator.clipboard.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2200); });
  }
  const days=daysUntil(boda.weddingDate);
  const ph=FASE_COLORS[boda.phase]||{bg:"#f5f5f4",color:"#57534e"};
  const activeTasks=(boda.tasks||[]).filter(t=>!["Terminado","Cancelado"].includes(t.status));

  const handleSave=async(form)=>{ setSaving(true); try{await apiUpdateBoda(boda.id,form); setBoda(b=>({...b,...form})); setEditing(false); onRefresh();}catch(e){alert("Error: "+e.message);} setSaving(false); };
  const handlePatch=useCallback((patch)=>{ setBoda(b=>({...b,...patch})); },[]);

  const TABS=[
    {id:"resumen",      label:"Resumen"},
    {id:"tareas",       label:`Tareas (${activeTasks.length})`},
    {id:"presupuesto",  label:`Presupuesto (${(boda.budgetItems||[]).length})`},
    {id:"pagos",        label:`Pagos (${(boda.payments||[]).length})`},
    {id:"contratos",    label:`Contratos (${(boda.contracts||[]).length})`},
    {id:"timeline",     label:"Timeline"},
    {id:"invitados",    label:`Invitados (${(boda.guests||[]).length})`},
    {id:"mesas",        label:`Mesas`},
    {id:"palette",      label:"Paleta"},
    {id:"studio",       label:`Estudio (${(boda.studio||[]).length})`},
    {id:"proveedores",  label:`Proveedores (${(boda.suppliers||[]).length})`},
    {id:"musica",       label:`Música (${(boda.songs||[]).length})`},
    {id:"fotos",        label:`Fotos (${(boda.photos||[]).length})`},
    {id:"llamadas",     label:`Notas (${(boda.calls||[]).length})`},
  ];

  return (
    <div style={{maxWidth:700,margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:R.muted,cursor:"pointer",fontSize:13,padding:0,fontFamily:"'Jost',sans-serif"}}>← Bodas</button>
        <span style={{color:R.border}}>/</span>
        <span style={{fontSize:14,fontWeight:500,color:R.text}}>{boda.clienteName}</span>
      </div>

      <div style={{...CARD,marginBottom:16}}>
        <div style={HDR}>
          <div>
            <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,color:R.white,margin:0,letterSpacing:".02em"}}>{boda.clienteName}</p>
            {boda.weddingDate&&<p style={{fontSize:12,color:"rgba(255,255,255,.65)",margin:"4px 0 0"}}>💍 {fmtDate(boda.weddingDate)}{days!==null&&<span style={{marginLeft:8,fontWeight:600,color:days<0?"rgba(255,255,255,.4)":days<=30?"#fca5a5":"rgba(255,255,255,.75)"}}>{days<0?`(hace ${Math.abs(days)} días)`:days===0?"(¡hoy!)":`(en ${days} días)`}</span>}</p>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
            <span style={{fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:99,background:ph.bg,color:ph.color}}>{boda.phase}</span>
            <button onClick={shareLink} style={{background:"rgba(255,255,255,.12)",color:copied?"#86efac":R.white,border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif",transition:"color .2s"}}>{copied?"✓ Link copiado":"🔗 Compartir"}</button>
            <button onClick={()=>setEditing(v=>!v)} style={{background:"rgba(255,255,255,.12)",color:R.white,border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>{editing?"Cancelar":"✏️ Editar"}</button>
          </div>
        </div>
        <div style={GOLD_BAR} />
        {editing&&<div style={{padding:20}}><BodaForm boda={boda} onSave={handleSave} onCancel={()=>setEditing(false)} saving={saving} users={users} /></div>}
      </div>

      <div style={CARD}>
        <div style={{overflowX:"auto",borderBottom:`1px solid ${R.border}`}}>
          <div style={{display:"flex",minWidth:"max-content"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{padding:"11px 14px",border:"none",borderBottom:tab===t.id?`2px solid ${R.accent}`:"2px solid transparent",background:"transparent",fontSize:12,fontWeight:tab===t.id?600:400,color:tab===t.id?R.accent:R.muted,cursor:"pointer",fontFamily:"'Jost',sans-serif",whiteSpace:"nowrap",transition:"color .15s"}}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{padding:20}}>
          {tab==="resumen"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px 24px"}}>
              {boda.venue      &&<C label="Venue"       v={boda.venue} />}
              {boda.responsable&&<C label="Responsable" v={boda.responsable} />}
              {boda.contact    &&<C label="Contacto"    v={boda.contact} />}
              {boda.guestCount &&<C label="Invitados"   v={boda.guestCount} />}
              {boda.budget     &&<C label="Presupuesto" v={`$${fmt$(boda.budget)} USD`} />}
              {boda.status     &&<C label="Estado"      v={boda.status} />}
              {boda.notes&&<div style={{gridColumn:"span 2"}}><C label="Notas" v={boda.notes} multi /></div>}
              <div style={{gridColumn:"span 2",borderTop:`1px solid ${R.border}`,paddingTop:12,marginTop:4,display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
                {(()=>{
                  const num=s=>parseFloat(String(s||"").replace(/,/g,"."))||0;
                  const budgetTotal=(boda.budgetItems||[]).reduce((s,it)=>s+num(it.budgetAmount),0);
                  const actualTotal=(boda.budgetItems||[]).reduce((s,it)=>s+num(it.actualCost),0);
                  const payReceived=(boda.payments||[]).filter(p=>p.received&&p.type!=="Devolución").reduce((s,p)=>s+num(p.amount),0);
                  const payPending=(boda.payments||[]).filter(p=>!p.received).reduce((s,p)=>s+num(p.amount),0);
                  return [
                    {label:"Tareas activas",  n:activeTasks.length,                                                                           color:R.accent},
                    {label:"Invitados ✅",     n:(boda.guests||[]).filter(g=>g.rsvp==="Confirmado").length+"/"+(boda.guests||[]).length,        color:"#15803d"},
                    {label:"Proveedores",      n:(boda.suppliers||[]).length,                                                                   color:"#1d4ed8"},
                    {label:"Presupuesto",      n:budgetTotal>0?`$${(budgetTotal/1000).toFixed(0)}k`:"—",                                        color:R.accent},
                    {label:"Gasto real",       n:actualTotal>0?`$${(actualTotal/1000).toFixed(0)}k`:"—",                                        color:"#7c3aed"},
                    {label:payPending>0?"Pago pendiente":"Recibido",n:payPending>0?`$${(payPending/1000).toFixed(0)}k`:`$${(payReceived/1000).toFixed(0)}k`,color:payPending>0?"#92400e":"#166534"},
                  ];
                })().map(s=>(
                  <div key={s.label} style={{textAlign:"center",background:R.cream,borderRadius:10,padding:"10px 8px",border:`1px solid ${R.border}`}}>
                    <p style={{fontSize:18,fontWeight:700,color:s.color,margin:0,fontVariantNumeric:"tabular-nums"}}>{s.n}</p>
                    <p style={{fontSize:10,color:R.muted,margin:"2px 0 0"}}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==="tareas"      &&<TasksTab        boda={boda} users={users} onPatch={handlePatch} />}
          {tab==="presupuesto" &&<PresupuestoTab  boda={boda} onPatch={handlePatch} />}
          {tab==="pagos"       &&<PagosTab        boda={boda} onPatch={handlePatch} />}
          {tab==="contratos"   &&<ContratosTab    boda={boda} onPatch={handlePatch} />}
          {tab==="timeline"    &&<TimelineTab     boda={boda} onScheduleChange={sc=>setBoda(b=>({...b,schedule:sc}))} />}
          {tab==="invitados"  &&<GuestTab         boda={boda} onPatch={handlePatch} />}
          {tab==="mesas"      &&<SeatingTab       boda={boda} onPatch={handlePatch} />}
          {tab==="palette"    &&<PaletteTab       boda={boda} onPatch={handlePatch} />}
          {tab==="studio"     &&<DesignStudioTab  boda={boda} onPatch={handlePatch} />}
          {tab==="proveedores"&&<ProveedoresTab boda={boda} onPatch={handlePatch} />}
          {tab==="musica"     &&<MusicTab       boda={boda} onPatch={handlePatch} />}
          {tab==="fotos"      &&<FotosTab       boda={boda} onPatch={handlePatch} />}
          {tab==="llamadas"   &&<LlamadasTab    boda={boda} onPatch={handlePatch} />}
        </div>
      </div>
    </div>
  );
}

function C({label,v,multi}) {
  return (
    <div>
      <span style={{display:"block",fontSize:11,color:R.muted,marginBottom:2}}>{label}</span>
      <p style={{fontSize:13,color:R.text,margin:0,whiteSpace:multi?"pre-line":"normal"}}>{v}</p>
    </div>
  );
}

// ─── CONTRATOS ────────────────────────────────────────────────────────────────
const CONTRACT_STATUSES = ["Borrador","Enviado al cliente","Firmado","Vencido"];
const CONTRACT_STATUS_STYLE = {
  "Borrador":           {bg:"#f3f4f6",color:"#374151"},
  "Enviado al cliente": {bg:"#eff6ff",color:"#1d4ed8"},
  "Firmado":            {bg:"#dcfce7",color:"#166534"},
  "Vencido":            {bg:"#fef3c7",color:"#92400e"},
};

function makeContractBody(boda) {
  const half = boda.budget ? (parseFloat(boda.budget)/2).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0}) : "___";
  const total = boda.budget ? parseFloat(boda.budget).toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0}) : "___";
  const today = new Date().toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric"});
  return `CONTRATO DE SERVICIOS DE COORDINACIÓN DE BODAS

Celebrado en la ciudad de Cartagena, el ${today}.

PARTES:
• Coordinadora: Two Travel Concierge, en adelante "LA COORDINADORA"
• Cliente(s): ${boda.clienteName||"___"}, en adelante "EL/LA CLIENTE"

DATOS DEL EVENTO:
• Fecha de la boda: ${boda.weddingDate ? fmtDate(boda.weddingDate) : "___"}
• Lugar: ${boda.venue||"___"}
• Número estimado de invitados: ${boda.guestCount||"___"}

SERVICIOS CONTRATADOS:
La Coordinadora se compromete a prestar los siguientes servicios:
1. Coordinación integral del día de la boda
2. Gestión y supervisión de proveedores
3. Elaboración de minuto a minuto
4. Acompañamiento en degustaciones y visitas al venue
5. Comunicación continua con el equipo de proveedores

HONORARIOS Y FORMA DE PAGO:
El monto total acordado es de USD $${total} (dólares americanos), pagadero así:
• Anticipo del 50%: USD $${half} — al firmar este contrato
• Saldo del 50%:    USD $${half} — 30 días antes de la fecha del evento

En caso de cancelación con más de 90 días de anticipación se devuelve el 50% del anticipo.
Con menos de 90 días, el anticipo no es reembolsable.

OBLIGACIONES DEL CLIENTE:
• Proveer información y documentos solicitados en los plazos acordados.
• Respetar los canales de comunicación y horarios de atención establecidos.
• Realizar los pagos en las fechas pactadas.

LIMITACIÓN DE RESPONSABILIDAD:
La Coordinadora no será responsable por eventos de fuerza mayor (desastres naturales,
pandemias, decisiones gubernamentales) ni por incumplimientos de terceros proveedores.

FIRMAS:

___________________________________        ___________________________________
Two Travel Concierge                           ${boda.clienteName||"Cliente"}
Representante Legal                            Fecha: ___________________
`;
}

function printContract(contract, boda) {
  const w = window.open("","_blank","width=800,height=900");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Contrato — ${boda.clienteName}</title>
<style>
  body{font-family:Georgia,serif;font-size:13px;line-height:1.8;color:#111;max-width:700px;margin:40px auto;padding:0 20px;}
  h1{font-size:15px;letter-spacing:.08em;text-align:center;text-transform:uppercase;border-bottom:1px solid #ccc;padding-bottom:10px;margin-bottom:20px;}
  pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.9;}
  @media print{body{margin:0;padding:20px;}button{display:none}}
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:12px;right:12px;background:#1a0812;color:#fff;border:none;padding:8px 18px;font-size:13px;cursor:pointer;border-radius:6px;">🖨 Imprimir / PDF</button>
<pre>${contract.body.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
</body></html>`);
  w.document.close();
}

function ContratosTab({ boda, onPatch }) {
  const [contracts, setContracts] = useState(boda.contracts || []);
  const [editId, setEditId]       = useState(null);
  const [saving, setSaving]       = useState(false);
  const editing = contracts.find(c=>c.id===editId)||null;

  async function persist(u) { setContracts(u); onPatch({contracts:u}); await apiSaveNotes(boda.id,{...boda,contracts:u}); }

  function newContract() {
    const c = { id:uid(), title:`Contrato — ${boda.clienteName}`, status:"Borrador", body:makeContractBody(boda), createdAt:new Date().toISOString().slice(0,10) };
    const u = [...contracts, c];
    setContracts(u); onPatch({contracts:u});
    setEditId(c.id);
  }

  async function save(patch) {
    setSaving(true);
    try { await persist(contracts.map(c=>c.id===editId?{...c,...patch}:c)); }
    catch(e){alert("Error: "+e.message);}
    setSaving(false);
  }

  async function del(id) { try{await persist(contracts.filter(c=>c.id!==id)); if(editId===id)setEditId(null);}catch{setContracts(contracts);} }

  function cycleStatus(id) {
    const u=contracts.map(c=>{if(c.id!==id)return c; const i=(CONTRACT_STATUSES.indexOf(c.status)+1)%CONTRACT_STATUSES.length; return{...c,status:CONTRACT_STATUSES[i]};});
    persist(u);
  }

  if (editing) {
    const [body,  setBody]  = useState(editing.body);
    const [title, setTitle] = useState(editing.title);
    const [status,setStatus]= useState(editing.status);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
          <button onClick={()=>setEditId(null)} style={{background:"none",border:"none",color:R.muted,cursor:"pointer",fontSize:13,padding:0,fontFamily:"'Jost',sans-serif"}}>← Contratos</button>
          <span style={{color:R.border}}>/</span>
          <input value={title} onChange={e=>setTitle(e.target.value)} style={{...INP_SM,flex:1}} placeholder="Título del contrato" />
          <select value={status} onChange={e=>setStatus(e.target.value)} style={{...INP_SM,width:"auto",flexShrink:0}}>
            {CONTRACT_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <textarea value={body} onChange={e=>setBody(e.target.value)}
          style={{...INP,height:420,resize:"vertical",fontFamily:"'Courier New',monospace",fontSize:12,lineHeight:1.85}} />
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={()=>save({body,title,status})} disabled={saving}
            style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,cursor:"pointer",opacity:saving?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"Guardando...":"Guardar"}</button>
          <button onClick={()=>printContract({body},boda)}
            style={{background:"#1a0812",color:"#fff",border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>🖨 Imprimir / PDF</button>
          <button onClick={()=>setEditId(null)}
            style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{contracts.length} contrato{contracts.length!==1?"s":""}</span>
        <button onClick={newContract} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Nuevo contrato</button>
      </div>
      {contracts.length===0&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin contratos. Crea el primero arriba — se pre-llena con los datos de la boda.</p>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {contracts.map(c=>{
          const st=CONTRACT_STATUS_STYLE[c.status]||CONTRACT_STATUS_STYLE["Borrador"];
          return (
            <div key={c.id} style={{border:`1px solid ${R.border}`,borderRadius:12,padding:"12px 16px",background:R.white,display:"flex",alignItems:"center",gap:12}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{fontSize:13,fontWeight:600,color:R.text,margin:"0 0 3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.title}</p>
                <p style={{fontSize:11,color:R.muted,margin:0}}>Creado {c.createdAt||"—"}{c.signedAt?` · Firmado ${c.signedAt}`:""}</p>
              </div>
              <button onClick={()=>cycleStatus(c.id)} style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,background:st.bg,color:st.color,border:"none",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontFamily:"'Jost',sans-serif"}}>{c.status}</button>
              <button onClick={()=>printContract(c,boda)} title="Imprimir / PDF" style={{background:"none",border:"none",cursor:"pointer",fontSize:14,flexShrink:0}}>🖨</button>
              <button onClick={()=>setEditId(c.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:R.muted,flexShrink:0}}>✏️</button>
              <button onClick={()=>del(c.id)}       style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:R.border,flexShrink:0}}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CALENDARIO ───────────────────────────────────────────────────────────────
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES   = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

function CalendarioView({ bodas, onSelectBoda }) {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based

  function prev() { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function next() { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }
  function goToday(){ setYear(now.getFullYear()); setMonth(now.getMonth()); }

  // Build calendar grid (Mon-based)
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay()+6)%7; // 0=Mon
  const totalDays= lastDay.getDate();

  // Map bodas to dates in this month
  const bodaByDate = {};
  bodas.forEach(b=>{
    if(!b.weddingDate) return;
    const d = parseDate(b.weddingDate);
    if(!d||d.getFullYear()!==year||d.getMonth()!==month) return;
    const key = d.getDate();
    if(!bodaByDate[key]) bodaByDate[key]=[];
    bodaByDate[key].push(b);
  });

  // Bodas this month (for sidebar)
  const thisMonth = bodas.filter(b=>{ const d=parseDate(b.weddingDate); return d&&d.getFullYear()===year&&d.getMonth()===month; }).sort((a,b)=>parseDate(a.weddingDate)-parseDate(b.weddingDate));

  // Grid cells
  const cells = [];
  for(let i=0;i<startDow;i++) cells.push(null);
  for(let d=1;d<=totalDays;d++) cells.push(d);
  while(cells.length%7!==0) cells.push(null);

  const todayDate = now.getDate(), todayMonth = now.getMonth(), todayYear = now.getFullYear();

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={prev} style={{background:"none",border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:14,color:R.muted}}>‹</button>
        <p style={{flex:1,textAlign:"center",margin:0,fontSize:16,fontWeight:700,color:R.text,fontFamily:"'Cormorant Garamond',serif",letterSpacing:".04em"}}>{MONTH_NAMES[month]} {year}</p>
        <button onClick={next} style={{background:"none",border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:14,color:R.muted}}>›</button>
        <button onClick={goToday} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Hoy</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:20,alignItems:"start"}}>
        {/* Calendar grid */}
        <div>
          {/* Day headers */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
            {DAY_NAMES.map(d=><p key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:R.muted,margin:0,padding:"4px 0",textTransform:"uppercase",letterSpacing:".06em"}}>{d}</p>)}
          </div>
          {/* Cells */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
            {cells.map((day,i)=>{
              if(!day) return <div key={`e${i}`} />;
              const isToday = day===todayDate&&month===todayMonth&&year===todayYear;
              const bodaHere = bodaByDate[day]||[];
              return (
                <div key={day} style={{minHeight:64,border:`1px solid ${bodaHere.length>0?R.mid:R.border}`,borderRadius:8,padding:"4px 6px",background:isToday?R.light:bodaHere.length>0?"#fff0f3":R.white,position:"relative"}}>
                  <p style={{fontSize:11,fontWeight:isToday?700:400,color:isToday?R.accent:R.muted,margin:"0 0 4px"}}>{day}</p>
                  {bodaHere.map(b=>(
                    <button key={b.id} onClick={()=>onSelectBoda(b)}
                      style={{display:"block",width:"100%",background:R.accent,color:"#fff",border:"none",borderRadius:4,padding:"2px 5px",fontSize:9,cursor:"pointer",fontFamily:"'Jost',sans-serif",textAlign:"left",marginBottom:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      💍 {b.clienteName}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: this month's bodas */}
        <div style={{width:200,border:`1px solid ${R.border}`,borderRadius:12,overflow:"hidden",background:R.white,flexShrink:0}}>
          <div style={{padding:"10px 14px",borderBottom:`1px solid ${R.border}`,background:R.dark}}>
            <p style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,.7)",margin:0,textTransform:"uppercase",letterSpacing:".06em"}}>💍 Este mes ({thisMonth.length})</p>
          </div>
          {thisMonth.length===0
            ? <p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"12px 14px",margin:0}}>Sin bodas en {MONTH_NAMES[month]}.</p>
            : thisMonth.map(b=>(
              <button key={b.id} onClick={()=>onSelectBoda(b)}
                style={{display:"block",width:"100%",background:"none",border:"none",borderBottom:`1px solid ${R.light}`,padding:"10px 14px",cursor:"pointer",textAlign:"left",fontFamily:"'Jost',sans-serif"}}>
                <p style={{fontSize:12,fontWeight:600,color:R.text,margin:"0 0 2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.clienteName}</p>
                <p style={{fontSize:10,color:R.muted,margin:0}}>📅 {fmtDate(b.weddingDate).split(" ").slice(0,2).join(" ")}</p>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── GLOBAL DASHBOARD ────────────────────────────────────────────────────────
function GlobalDashboard({ bodas, onSelectBoda }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const in30  = new Date(today.getTime() + 30*86400000);

  // KPIs
  const activas   = bodas.filter(b=>b.status==="Activa");
  const proximas  = activas.filter(b=>{ const d=parseDate(b.weddingDate); return d&&d>=today&&d<=in30; });
  const allTasks  = bodas.flatMap(b=>(b.tasks||[]).map(t=>({...t,bodaName:b.clienteName,bodaId:b.id})));
  const overdue   = allTasks.filter(t=>{ if(["Terminado","Cancelado"].includes(t.status)||!t.dueDate) return false; const d=new Date(t.dueDate+"T12:00:00"); d.setHours(0,0,0,0); return d<today; });
  const allPays   = bodas.flatMap(b=>(b.payments||[]).map(p=>({...p,bodaName:b.clienteName,bodaId:b.id})));
  const pendingPays = allPays.filter(p=>!p.received);
  const num = s=>parseFloat(String(s||"").replace(/,/g,"."))||0;
  const pendingAmt = pendingPays.reduce((s,p)=>s+num(p.amount),0);

  // Pipeline
  const pipeline = FASES.map(f=>({ fase:f, bodas:activas.filter(b=>b.phase===f), ...FASE_COLORS[f] }));

  // Upcoming (next 6, future only)
  const upcoming = [...activas]
    .filter(b=>{ const d=parseDate(b.weddingDate); return d&&d>=today; })
    .sort((a,b)=>parseDate(a.weddingDate)-parseDate(b.weddingDate))
    .slice(0,6);

  const kpis = [
    { label:"Bodas activas",    n:activas.length,        color:R.accent,   icon:"💍" },
    { label:"Próximas 30 días", n:proximas.length,       color:"#7c3aed",  icon:"📅" },
    { label:"Tareas vencidas",  n:overdue.length,        color:overdue.length>0?"#dc2626":"#16a34a", icon:"⚠️" },
    { label:"Pago pendiente",   n:`$${fmt$(pendingAmt)}`,color:pendingAmt>0?"#92400e":"#16a34a",     icon:"💰" },
  ];

  return (
    <div>
      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
        {kpis.map(k=>(
          <div key={k.label} style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:14,padding:"16px 14px",textAlign:"center"}}>
            <p style={{fontSize:22,margin:"0 0 4px"}}>{k.icon}</p>
            <p style={{fontSize:22,fontWeight:700,color:k.color,margin:0,fontVariantNumeric:"tabular-nums"}}>{k.n}</p>
            <p style={{fontSize:10,color:R.muted,margin:"4px 0 0",letterSpacing:".04em"}}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div style={{...CARD,marginBottom:20,overflow:"visible"}}>
        <div style={{padding:"14px 18px 12px",borderBottom:`1px solid ${R.border}`}}>
          <p style={{fontSize:12,fontWeight:600,color:R.muted,margin:0,textTransform:"uppercase",letterSpacing:".07em"}}>Pipeline por fase</p>
        </div>
        <div style={{padding:"14px 18px",display:"flex",gap:8,overflowX:"auto"}}>
          {pipeline.map(p=>(
            <div key={p.fase} style={{flex:"1 0 120px",background:p.bg||R.light,borderRadius:10,padding:"10px 12px",border:`1px solid ${R.border}`,minWidth:0}}>
              <p style={{fontSize:10,fontWeight:700,color:p.color||R.muted,margin:"0 0 6px",textTransform:"uppercase",letterSpacing:".05em"}}>{p.fase}</p>
              <p style={{fontSize:24,fontWeight:700,color:p.color||R.text,margin:"0 0 6px"}}>{p.bodas.length}</p>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {p.bodas.slice(0,3).map(b=>(
                  <button key={b.id} onClick={()=>onSelectBoda(b)} style={{background:"rgba(255,255,255,.7)",border:`1px solid ${R.border}`,borderRadius:6,padding:"3px 7px",fontSize:10,color:R.text,cursor:"pointer",textAlign:"left",fontFamily:"'Jost',sans-serif",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {b.clienteName}
                  </button>
                ))}
                {p.bodas.length>3&&<span style={{fontSize:10,color:R.muted}}>+{p.bodas.length-3} más</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Próximas bodas */}
        <div style={CARD}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${R.border}`}}>
            <p style={{fontSize:12,fontWeight:600,color:R.muted,margin:0,textTransform:"uppercase",letterSpacing:".07em"}}>📅 Próximas bodas</p>
          </div>
          <div style={{padding:"8px 16px 12px"}}>
            {upcoming.length===0&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin bodas próximas.</p>}
            {upcoming.map(b=>{
              const days=daysUntil(b.weddingDate);
              return (
                <button key={b.id} onClick={()=>onSelectBoda(b)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:"none",border:"none",borderBottom:`1px solid ${R.light}`,padding:"8px 0",cursor:"pointer",textAlign:"left",fontFamily:"'Jost',sans-serif"}}>
                  <div style={{background:R.light,borderRadius:8,padding:"4px 8px",textAlign:"center",flexShrink:0,minWidth:40}}>
                    <p style={{fontSize:13,fontWeight:700,color:R.accent,margin:0,fontFamily:"'Cormorant Garamond',serif"}}>{fmtDate(b.weddingDate).split(" ")[0]}</p>
                    <p style={{fontSize:9,color:R.muted,margin:0}}>{fmtDate(b.weddingDate).split(" ")[1]?.toUpperCase()}</p>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:600,color:R.text,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.clienteName}</p>
                    <p style={{fontSize:11,color:days<=7?"#dc2626":days<=30?"#d97706":R.muted,margin:"1px 0 0"}}>{days===0?"¡Hoy!":days===1?"Mañana":`en ${days} días`}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tareas vencidas */}
        <div style={CARD}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${R.border}`}}>
            <p style={{fontSize:12,fontWeight:600,color:R.muted,margin:0,textTransform:"uppercase",letterSpacing:".07em"}}>⚠️ Tareas vencidas ({overdue.length})</p>
          </div>
          <div style={{padding:"8px 16px 12px",maxHeight:240,overflowY:"auto"}}>
            {overdue.length===0&&<p style={{fontSize:12,color:"#16a34a",fontStyle:"italic",padding:"8px 0"}}>✅ Sin tareas vencidas.</p>}
            {overdue.slice(0,10).map(t=>{
              const d=new Date(t.dueDate+"T12:00:00"); d.setHours(0,0,0,0);
              const late=Math.ceil((today-d)/86400000);
              return (
                <button key={t.id} onClick={()=>onSelectBoda(bodas.find(b=>b.id===t.bodaId))} style={{display:"flex",alignItems:"center",gap:8,width:"100%",background:"none",border:"none",borderBottom:`1px solid ${R.light}`,padding:"7px 0",cursor:"pointer",textAlign:"left",fontFamily:"'Jost',sans-serif"}}>
                  <span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:99,background:"#fee2e2",color:"#dc2626",flexShrink:0}}>{late}d</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:12,fontWeight:500,color:R.text,margin:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.taskName}</p>
                    <p style={{fontSize:10,color:R.muted,margin:"1px 0 0"}}>{t.bodaName}{t.assignedTo?` · ${t.assignedTo}`:""}</p>
                  </div>
                </button>
              );
            })}
            {overdue.length>10&&<p style={{fontSize:11,color:R.muted,padding:"6px 0 0"}}>+{overdue.length-10} más vencidas</p>}
          </div>
        </div>
      </div>

      {/* Pagos pendientes */}
      {pendingPays.length>0&&(
        <div style={CARD}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${R.border}`}}>
            <p style={{fontSize:12,fontWeight:600,color:R.muted,margin:0,textTransform:"uppercase",letterSpacing:".07em"}}>💰 Pagos pendientes — ${fmt$(pendingAmt)} total</p>
          </div>
          <div style={{padding:"8px 16px 12px",display:"flex",flexDirection:"column",gap:0}}>
            {pendingPays.sort((a,b)=>num(b.amount)-num(a.amount)).slice(0,8).map(p=>(
              <button key={p.id} onClick={()=>onSelectBoda(bodas.find(b=>b.id===p.bodaId))} style={{display:"flex",alignItems:"center",gap:10,width:"100%",background:"none",border:"none",borderBottom:`1px solid ${R.light}`,padding:"8px 0",cursor:"pointer",textAlign:"left",fontFamily:"'Jost',sans-serif"}}>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:500,color:R.text,margin:0}}>{p.concept}</p>
                  <p style={{fontSize:10,color:R.muted,margin:"1px 0 0"}}>{p.bodaName}{p.type?` · ${p.type}`:""}{p.date?` · ${fmtDate(p.date)}`:""}</p>
                </div>
                <span style={{fontSize:13,fontWeight:700,color:"#92400e",flexShrink:0,fontVariantNumeric:"tabular-nums"}}>${fmt$(num(p.amount))}</span>
              </button>
            ))}
            {pendingPays.length>8&&<p style={{fontSize:11,color:R.muted,padding:"6px 0 0"}}>+{pendingPays.length-8} más</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TASK TEMPLATES ───────────────────────────────────────────────────────────
const TMPL=[
  {phase:"Onboarding",  taskName:"Crear chat con cliente y equipo", mode:"kickoff",       offset:0},
  {phase:"Onboarding",  taskName:"Enviar mensaje de bienvenida",    mode:"kickoff",       offset:0},
  {phase:"Onboarding",  taskName:"Recopilar documentos",            mode:"kickoff",       offset:1},
  {phase:"Onboarding",  taskName:"Solicitar venues",                mode:"kickoff",       offset:1},
  {phase:"Onboarding",  taskName:"Enviar budget sheets",            mode:"kickoff",       offset:2},
  {phase:"Onboarding",  taskName:"Schedule concierge call",         mode:"kickoff",       offset:7},
  {phase:"Planning",    taskName:"Seleccionar proveedores",         mode:"wedding_minus", offset:90},
  {phase:"Planning",    taskName:"Programar degustaciones",         mode:"wedding_minus", offset:60},
  {phase:"Pre-Wedding", taskName:"Minuto a minuto listo",           mode:"wedding_minus", offset:30},
  {phase:"Wedding Day", taskName:"Coordinación general",            mode:"wedding",       offset:0},
  {phase:"Post-Wedding",taskName:"Factura final",                   mode:"wedding_plus",  offset:2},
];
function calcDate(mode,offset,wd) {
  const now=new Date(); now.setHours(9,0,0,0); const w=wd?new Date(wd+"T12:00:00"):null; const D=86400000;
  if(mode==="kickoff")       return new Date(now.getTime()+offset*D).toISOString().slice(0,10);
  if(mode==="wedding_minus") return (w?new Date(w.getTime()-offset*D):new Date(now.getTime()+offset*D)).toISOString().slice(0,10);
  if(mode==="wedding")       return (w||new Date(now.getTime()+120*D)).toISOString().slice(0,10);
  if(mode==="wedding_plus")  return (w?new Date(w.getTime()+offset*D):new Date(now.getTime()+(120+offset)*D)).toISOString().slice(0,10);
  return "";
}

// ─── MAIN PANEL ───────────────────────────────────────────────────────────────
export default function BodaPanel({ currentUser, onLogout }) {
  const [bodas,        setBodas]        = useState([]);
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [err,          setErr]          = useState("");
  const [selected,     setSelected]     = useState(null);
  const [showNew,      setShowNew]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [mainView,     setMainView]     = useState("dashboard");

  const load=useCallback(async(force=false)=>{
    // Show cached bodas immediately — no loading spinner if we have data
    if (!force) {
      const cached = getBodasCache();
      if (cached) {
        setBodas(cached.data);
        setLoading(false);
        // Refresh users in background always; bodas only if stale
        fetch(GAS_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"listUsers"})}).then(r=>r.json()).then(uRes=>{
          setUsers(Array.isArray(uRes?.data)?uRes.data.filter(u=>u.active!=="false"):[]);
        }).catch(()=>{});
        if (cached.stale) {
          fetchFreshBodas().then(fresh => setBodas(fresh)).catch(()=>{});
        }
        return;
      }
    }
    setLoading(true); setErr("");
    try{
      const [list,uRes]=await Promise.all([
        apiBodas(force),
        fetch(GAS_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"listUsers"})}).then(r=>r.json()).catch(()=>({})),
      ]);
      setBodas(list);
      setUsers(Array.isArray(uRes?.data)?uRes.data.filter(u=>u.active!=="false"):[]);
    }catch(e){
      const m=e.message||"";
      setErr(m.includes("<")?"Error de conexión con el servidor.":"Error cargando datos: "+m);
    }
    setLoading(false);
  },[]);
  useEffect(()=>{load();},[load]);

  const forceRefresh=useCallback(async()=>{
    setRefreshing(true);
    try{ const list=await apiBodas(true); setBodas(list); if(selected)setSelected(list.find(b=>b.id===selected.id)||null); }catch{}
    setRefreshing(false);
  },[selected]);

  const handleRefresh=useCallback(async()=>{
    try{ const list=await apiBodas(); setBodas(list); if(selected)setSelected(list.find(b=>b.id===selected.id)||null); }catch{}
  },[selected]);

  const handleCreate=async(form)=>{
    setSaving(true);
    try{
      const tasks=TMPL.map(t=>({id:uid(),taskName:t.taskName,phase:t.phase,assignedTo:form.responsable||"",dueDate:calcDate(t.mode,t.offset,form.weddingDate),status:"Pendiente",notes:""}));
      const id=await apiSaveBoda(form);
      await apiSaveNotes(id,{tasks,suppliers:[],songs:[],photos:[],calls:[]});
      setShowNew(false); await load();
    }catch(e){alert("Error al crear: "+e.message);}
    setSaving(false);
  };

  const handleDelete=async(e,boda)=>{
    e.stopPropagation();
    if(!window.confirm(`¿Eliminar "${boda.clienteName}"?`)) return;
    try{clearBodasCache(); await gasPost({action:"deleteBoda",id:boda.id}); setBodas(p=>p.filter(b=>b.id!==boda.id));}catch(e){alert("Error: "+e.message);}
  };

  const today=new Date(); today.setHours(0,0,0,0);
  const filtered=bodas.filter(b=>{
    const q=search.toLowerCase();
    return (!search||b.clienteName?.toLowerCase().includes(q)||b.venue?.toLowerCase().includes(q)||b.responsable?.toLowerCase().includes(q))
        &&(filterStatus==="all"||b.status===filterStatus);
  }).sort((a,b)=>{ if(a.weddingDate&&b.weddingDate) return new Date(a.weddingDate)-new Date(b.weddingDate); return a.weddingDate?-1:1; });

  if(selected){
    return (
      <div style={{minHeight:"100vh",background:R.cream,fontFamily:"'Jost',sans-serif"}}>
        <div style={{maxWidth:760,margin:"0 auto",padding:"24px 16px 60px"}}>
          <BodaDetail boda={selected} users={users} onBack={()=>setSelected(null)} onRefresh={handleRefresh} />
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",background:R.cream,fontFamily:"'Jost',sans-serif"}}>
      <div style={{background:R.dark,padding:"0 24px"}}>
        <div style={{...GOLD_BAR,height:3}} />
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <span style={{fontSize:28}}>💍</span>
            <div>
              <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:500,color:R.white,margin:0,letterSpacing:".04em"}}>Two Lovers — Bodas</p>
              <p style={{fontSize:11,color:"rgba(255,255,255,.45)",margin:"2px 0 0",letterSpacing:".06em",textTransform:"uppercase"}}>{bodas.filter(b=>b.status==="Activa").length} bodas activas</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,.45)"}}>{currentUser?.name||currentUser?.email}</span>
            <button onClick={forceRefresh} disabled={refreshing} title="Forzar recarga desde la hoja"
              style={{background:"rgba(255,255,255,.08)",color:refreshing?"rgba(255,255,255,.3)":"rgba(255,255,255,.6)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"5px 10px",fontSize:14,cursor:"pointer",transition:"opacity .15s",lineHeight:1}}>
              {refreshing?"⏳":"🔄"}
            </button>
            <button onClick={onLogout} style={{background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.6)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"5px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px 60px"}}>
        {/* Main nav tabs */}
        <div style={{display:"flex",alignItems:"center",gap:0,marginBottom:20,borderBottom:`1px solid ${R.border}`}}>
          {[{id:"dashboard",label:"📊 Dashboard"},{id:"calendario",label:"📆 Calendario"},{id:"lista",label:"💍 Lista"}].map(v=>(
            <button key={v.id} onClick={()=>setMainView(v.id)}
              style={{padding:"10px 20px",border:"none",borderBottom:mainView===v.id?`2px solid ${R.accent}`:"2px solid transparent",background:"transparent",fontSize:13,fontWeight:mainView===v.id?600:400,color:mainView===v.id?R.accent:R.muted,cursor:"pointer",fontFamily:"'Jost',sans-serif",transition:"color .15s"}}>
              {v.label}
            </button>
          ))}
          <div style={{flex:1}} />
          <button onClick={()=>setShowNew(v=>!v)} style={{background:R.accent,color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0,fontFamily:"'Jost',sans-serif",marginBottom:2}}>+ Nueva boda</button>
        </div>

        {/* Lista filters — only in lista view */}
        {mainView==="lista"&&bodas.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar boda, venue, responsable..." style={{...INP,flex:1,minWidth:200,borderRadius:10}} />
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{...INP,width:"auto",flex:"0 0 auto"}}><option value="all">Todos los estados</option>{ESTADOS_BODA.map(s=><option key={s}>{s}</option>)}</select>
        </div>
        )}

        {showNew&&(
          <div style={{...CARD,marginBottom:16}}>
            <div style={HDR}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:R.white,fontWeight:500}}>💍 Nueva boda</span></div>
            <div style={GOLD_BAR} />
            <div style={{padding:20}}><BodaForm onSave={handleCreate} onCancel={()=>setShowNew(false)} saving={saving} users={users} /></div>
          </div>
        )}

        {err&&<div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:13,color:"#b91c1c"}}>{err}</span><button onClick={load} style={{background:"none",border:"none",color:R.accent,cursor:"pointer",fontSize:13,textDecoration:"underline",fontFamily:"'Jost',sans-serif"}}>Reintentar</button></div>}

        {/* Dashboard view */}
        {mainView==="dashboard"&&!loading&&<GlobalDashboard bodas={bodas} onSelectBoda={b=>{setSelected(b);}} />}
        {mainView==="calendario"&&!loading&&<CalendarioView bodas={bodas} onSelectBoda={b=>{setSelected(b);}} />}

        {(mainView==="dashboard"||mainView==="calendario")&&loading&&(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{width:28,height:28,border:`2px solid ${R.border}`,borderTop:`2px solid ${R.accent}`,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px"}} />
            <p style={{fontSize:13,color:R.muted}}>Cargando dashboard...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {mainView==="lista"&&(loading?(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <div style={{width:28,height:28,border:`2px solid ${R.border}`,borderTop:`2px solid ${R.accent}`,borderRadius:"50%",animation:"spin 1s linear infinite",margin:"0 auto 12px"}} />
            <p style={{fontSize:13,color:R.muted}}>Cargando bodas...</p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ):filtered.length===0?(
          <div style={{textAlign:"center",padding:"60px 0"}}>
            <p style={{fontSize:40,margin:"0 0 12px"}}>💍</p>
            <p style={{fontSize:14,color:R.muted}}>{bodas.length===0?"Aún no hay bodas. Crea la primera arriba.":"Sin resultados para esa búsqueda."}</p>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:20}}>
            {filtered.map(boda=>{
              const days=daysUntil(boda.weddingDate);
              const ph=FASE_COLORS[boda.phase]||{bg:"#f5f5f4",color:"#57534e"};
              const active=(boda.tasks||[]).filter(t=>!["Terminado","Cancelado"].includes(t.status));
              const late=active.filter(t=>{ if(!t.dueDate) return false; const d=new Date(t.dueDate+"T12:00:00"); d.setHours(0,0,0,0); return d<today; });
              const confirmed=(boda.guests||[]).filter(g=>g.rsvp==="Confirmado").length;
              const initials=boda.clienteName.split(/[&,\/\s]+/).filter(Boolean).map(w=>w[0]?.toUpperCase()||"").slice(0,2).join("");
              return (
                <div key={boda.id} onClick={()=>setSelected(boda)}
                  style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:20,overflow:"hidden",cursor:"pointer",transition:"transform .18s,box-shadow .18s,border-color .18s",display:"flex",flexDirection:"column"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 32px rgba(127,29,58,.13)";e.currentTarget.style.borderColor=R.mid;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";e.currentTarget.style.borderColor=R.border;}}>
                  {/* Photo / cover area */}
                  <div style={{position:"relative",height:160,background:`linear-gradient(135deg,${R.dark} 0%,${R.mid} 100%)`,flexShrink:0}}>
                    {boda.coverPhoto?(
                      <img src={boda.coverPhoto} alt={boda.clienteName} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={e=>{e.target.style.display="none";}} />
                    ):(
                      <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        <div style={{width:72,height:72,borderRadius:"50%",background:"rgba(255,255,255,.12)",border:"2px solid rgba(201,169,110,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:500,color:R.gold,letterSpacing:".04em"}}>{initials||"💍"}</span>
                        </div>
                      </div>
                    )}
                    {/* Days badge */}
                    {days!==null&&(
                      <div style={{position:"absolute",top:10,right:10,background:days<0?"rgba(0,0,0,.55)":days<=30?"rgba(190,18,60,.85)":"rgba(26,8,18,.75)",backdropFilter:"blur(6px)",borderRadius:10,padding:"4px 10px",textAlign:"center"}}>
                        <p style={{fontSize:9,color:"rgba(255,255,255,.7)",margin:0,textTransform:"uppercase",letterSpacing:".06em",lineHeight:1}}>{days<0?"boda":"faltan"}</p>
                        <p style={{fontSize:15,fontWeight:700,color:"#fff",margin:"1px 0 0",fontVariantNumeric:"tabular-nums",lineHeight:1}}>{days<0?`hace ${Math.abs(days)}d`:`${days}d`}</p>
                      </div>
                    )}
                    {/* Phase badge */}
                    <div style={{position:"absolute",top:10,left:10,background:"rgba(255,255,255,.9)",borderRadius:99,padding:"3px 10px"}}>
                      <span style={{fontSize:9,fontWeight:700,color:ph.color,textTransform:"uppercase",letterSpacing:".05em"}}>{boda.phase}</span>
                    </div>
                    {/* Late tasks warning */}
                    {late.length>0&&(
                      <div style={{position:"absolute",bottom:10,left:10,background:"rgba(190,18,60,.9)",borderRadius:99,padding:"3px 10px"}}>
                        <span style={{fontSize:9,fontWeight:700,color:"#fff"}}>⚠️ {late.length} atrasada{late.length>1?"s":""}</span>
                      </div>
                    )}
                    {/* Delete btn */}
                    <button onClick={e=>handleDelete(e,boda)}
                      style={{position:"absolute",bottom:8,right:8,width:26,height:26,borderRadius:"50%",background:"rgba(0,0,0,.4)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"rgba(255,255,255,.7)",transition:"background .15s"}}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(220,38,38,.8)";e.currentTarget.style.color="#fff";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,.4)";e.currentTarget.style.color="rgba(255,255,255,.7)";}}>🗑</button>
                  </div>
                  {/* Card body */}
                  <div style={{padding:"14px 16px",flex:1,display:"flex",flexDirection:"column",gap:6}}>
                    <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:600,color:R.text,margin:0,lineHeight:1.2}}>{boda.clienteName}</p>
                    {boda.weddingDate&&<p style={{fontSize:11,color:R.muted,margin:0}}>💍 {fmtDate(boda.weddingDate)}</p>}
                    <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px",fontSize:11,color:R.text2,marginTop:2}}>
                      {boda.venue&&<span style={{display:"flex",alignItems:"center",gap:3}}>📍 {boda.venue}</span>}
                      {boda.responsable&&<span>👤 {boda.responsable}</span>}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:"auto",paddingTop:8,borderTop:`1px solid ${R.border}`}}>
                      {active.length>0&&<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:R.light,color:R.accent}}>{active.length} tarea{active.length>1?"s":""}</span>}
                      {confirmed>0&&<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:"#f0fdf4",color:"#15803d"}}>✓ {confirmed} confirmados</span>}
                      {boda.guestCount&&!confirmed&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:99,background:R.cream,color:R.muted}}>👥 {boda.guestCount}</span>}
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,marginLeft:"auto",background:boda.status==="Activa"?"#f0fdf4":boda.status==="En pausa"?"#fffbeb":"#f5f5f4",color:boda.status==="Activa"?"#15803d":boda.status==="En pausa"?"#b45309":"#57534e"}}>{boda.status}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
