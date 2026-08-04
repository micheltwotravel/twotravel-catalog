import React, { useState, useEffect, useCallback } from "react";
import { fetchKickoffsFromSheet, saveKickoffToSheet, updateKickoffInSheet, deleteKickoff } from "./sheetServices";

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
function parseBoda(k) {
  try {
    const meta  = JSON.parse(k.conciergeSummary || "{}");
    if (meta.type !== "boda") return null;
    const notes = JSON.parse(k.internalNotes || "{}");
    return {
      id: k.id,
      clienteName: String(k.guestName||"").replace(/^Boda:\s*/i,""),
      weddingDate: meta.weddingDate||"",
      venue:       meta.venue      ||"",
      responsable: meta.responsable||"",
      contact:     meta.contact    ||"",
      phase:       meta.phase      ||"Onboarding",
      status:      meta.status     ||"Activa",
      guestCount:  meta.guestCount ||"",
      budget:      meta.budget     ||"",
      notes:       meta.notes      ||"",
      tasks:     notes.tasks     ||[],
      suppliers: notes.suppliers ||[],
      songs:     notes.songs     ||[],
      photos:    notes.photos    ||[],
      calls:     notes.calls     ||[],
      schedule: JSON.parse(k.travifyText||"[]"),
    };
  } catch { return null; }
}
function metaPayload(f) {
  return JSON.stringify({type:"boda",weddingDate:f.weddingDate,venue:f.venue,responsable:f.responsable,contact:f.contact,phase:f.phase,status:f.status,guestCount:f.guestCount,budget:f.budget,notes:f.notes});
}
function notesOf(boda) {
  return {tasks:boda.tasks||[],suppliers:boda.suppliers||[],songs:boda.songs||[],photos:boda.photos||[],calls:boda.calls||[]};
}
async function apiBodas() { const all=await fetchKickoffsFromSheet({forceRefresh:true}); return all.map(parseBoda).filter(Boolean); }
async function apiSaveBoda(f) {
  const res=await saveKickoffToSheet({guestName:"Boda: "+f.clienteName,conciergeSummary:metaPayload(f),internalNotes:JSON.stringify({tasks:[],suppliers:[],songs:[],photos:[],calls:[]}),travifyText:JSON.stringify([]),status:"active"});
  return res.id;
}
async function apiUpdateBoda(id,f)       { await updateKickoffInSheet(id,{guestName:"Boda: "+f.clienteName,conciergeSummary:metaPayload(f)}); }
async function apiSaveNotes(id,boda)     { await updateKickoffInSheet(id,{internalNotes:JSON.stringify(notesOf(boda))}); }
async function apiUpdateSchedule(id,sc)  { await updateKickoffInSheet(id,{travifyText:JSON.stringify(sc)}); }

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

// ─── MINUTO A MINUTO ─────────────────────────────────────────────────────────
const M_CATS=["General","Novios","Proveedores","Coordinación","Música","Fotos/Video","Protocolo"];
const M_COLORS={"General":{bg:"#f5f5f4",color:"#57534e"},"Novios":{bg:"#fff0f3",color:"#be123c"},"Proveedores":{bg:"#fffbeb",color:"#b45309"},"Coordinación":{bg:"#eff6ff",color:"#1d4ed8"},"Música":{bg:"#f5f3ff",color:"#7c3aed"},"Fotos/Video":{bg:"#f0fdfa",color:"#0f766e"},"Protocolo":{bg:"#fff7ed",color:"#c2410c"}};

function MinutoTab({ boda, onScheduleChange }) {
  const [schedule,setSchedule]=useState(boda.schedule||[]);
  const [show,setShow]=useState(false);
  const [saving,setSaving]=useState(false);
  const [blank,setBlank]=useState({time:"",description:"",assignedTo:"",notes:"",category:"General"});
  const sorted=[...schedule].sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  async function persist(u){ setSchedule(u); onScheduleChange(u); await apiUpdateSchedule(boda.id,u); }
  async function add(){ if(!blank.time||!blank.description.trim()) return; setSaving(true); try{await persist([...schedule,{...blank,id:uid()}]); setBlank({time:"",description:"",assignedTo:"",notes:"",category:"General"}); setShow(false);}catch(e){alert("Error: "+e.message);} setSaving(false); }
  async function del(id){ try{await persist(schedule.filter(e=>e.id!==id));}catch{setSchedule(schedule);} }
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontSize:11,fontWeight:600,color:R.muted,textTransform:"uppercase",letterSpacing:".06em"}}>{sorted.length} evento{sorted.length!==1?"s":""}</span>
        <div style={{display:"flex",gap:8}}>
          {sorted.length>0&&<button onClick={()=>window.print()} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>🖨 Imprimir</button>}
          <button onClick={()=>setShow(v=>!v)} style={{background:"transparent",color:R.accent,border:`1px solid ${R.border}`,borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>+ Agregar</button>
        </div>
      </div>
      {show&&(
        <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:14,marginBottom:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <input type="time" style={INP_SM} value={blank.time}        onChange={e=>setBlank(p=>({...p,time:e.target.value}))} />
            <select style={INP_SM} value={blank.category} onChange={e=>setBlank(p=>({...p,category:e.target.value}))}>{M_CATS.map(c=><option key={c}>{c}</option>)}</select>
            <div style={{gridColumn:"span 2"}}><input style={INP_SM} value={blank.description} onChange={e=>setBlank(p=>({...p,description:e.target.value}))} placeholder="Descripción del evento *" /></div>
            <input style={INP_SM} value={blank.assignedTo} onChange={e=>setBlank(p=>({...p,assignedTo:e.target.value}))} placeholder="Responsable" />
            <input style={INP_SM} value={blank.notes}      onChange={e=>setBlank(p=>({...p,notes:e.target.value}))}      placeholder="Notas" />
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={add} disabled={saving||!blank.time||!blank.description.trim()} style={{background:R.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",opacity:(saving||!blank.time||!blank.description.trim())?.5:1,fontFamily:"'Jost',sans-serif"}}>{saving?"...":"Agregar"}</button>
            <button onClick={()=>setShow(false)} style={{background:"transparent",color:R.muted,border:`1px solid ${R.border}`,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Cancelar</button>
          </div>
        </div>
      )}
      {sorted.length===0&&!show&&<p style={{fontSize:12,color:R.muted,fontStyle:"italic",padding:"8px 0"}}>Sin eventos. Agrega el primero arriba.</p>}
      <div style={{position:"relative"}}>
        {sorted.length>0&&<div style={{position:"absolute",left:55,top:8,bottom:8,width:1,background:R.border}} />}
        {sorted.map(ev=>{
          const cs=M_COLORS[ev.category]||M_COLORS["General"];
          return (
            <div key={ev.id} style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:10}}>
              <div style={{width:54,textAlign:"right",flexShrink:0,paddingTop:10}}><span style={{fontSize:12,fontFamily:"'Jost',sans-serif",fontWeight:600,color:R.text,letterSpacing:".02em",fontVariantNumeric:"tabular-nums"}}>{ev.time}</span></div>
              <div style={{display:"flex",alignItems:"flex-start",gap:10,flex:1,minWidth:0}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:R.accent,flexShrink:0,marginTop:12,zIndex:1,boxShadow:`0 0 0 3px ${R.light}`}} />
                <div style={{flex:1,background:R.white,border:`1px solid ${R.border}`,borderRadius:12,padding:"10px 14px",minWidth:0}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <span style={{fontSize:13,fontWeight:500,color:R.text}}>{ev.description}</span>
                        <span style={{fontSize:10,padding:"2px 8px",borderRadius:99,fontWeight:500,background:cs.bg,color:cs.color}}>{ev.category}</span>
                      </div>
                      {ev.assignedTo&&<p style={{fontSize:11,color:R.muted,margin:"3px 0 0"}}>👤 {ev.assignedTo}</p>}
                      {ev.notes     &&<p style={{fontSize:11,color:R.muted,margin:"2px 0 0"}}>{ev.notes}</p>}
                    </div>
                    <button onClick={()=>del(ev.id)} style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:14,flexShrink:0,marginTop:2}}>✕</button>
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
    {id:"resumen",    label:"Resumen"},
    {id:"tareas",     label:`Tareas (${activeTasks.length})`},
    {id:"minuto",     label:"Minuto a Minuto"},
    {id:"proveedores",label:`Proveedores (${(boda.suppliers||[]).length})`},
    {id:"musica",     label:`Música (${(boda.songs||[]).length})`},
    {id:"fotos",      label:`Fotos (${(boda.photos||[]).length})`},
    {id:"llamadas",   label:`Notas (${(boda.calls||[]).length})`},
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
              <div style={{gridColumn:"span 2",borderTop:`1px solid ${R.border}`,paddingTop:12,marginTop:4,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                {[
                  {label:"Tareas activas", n:activeTasks.length,         color:R.accent},
                  {label:"Proveedores",    n:(boda.suppliers||[]).length, color:"#1d4ed8"},
                  {label:"Canciones",      n:(boda.songs||[]).length,     color:"#7c3aed"},
                  {label:"Fotos ref.",     n:(boda.photos||[]).length,    color:"#0f766e"},
                ].map(s=>(
                  <div key={s.label} style={{textAlign:"center",background:R.cream,borderRadius:10,padding:"10px 8px",border:`1px solid ${R.border}`}}>
                    <p style={{fontSize:20,fontWeight:700,color:s.color,margin:0}}>{s.n}</p>
                    <p style={{fontSize:10,color:R.muted,margin:"2px 0 0"}}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab==="tareas"     &&<TasksTab       boda={boda} users={users} onPatch={handlePatch} />}
          {tab==="minuto"     &&<MinutoTab      boda={boda} onScheduleChange={sc=>setBoda(b=>({...b,schedule:sc}))} />}
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
  const [err,          setErr]          = useState("");
  const [selected,     setSelected]     = useState(null);
  const [showNew,      setShowNew]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const load=useCallback(async()=>{
    setLoading(true); setErr("");
    try{
      const [list,uRes]=await Promise.all([
        apiBodas(),
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
    try{await deleteKickoff(boda.id); setBodas(p=>p.filter(b=>b.id!==boda.id));}catch(e){alert("Error: "+e.message);}
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
            <button onClick={onLogout} style={{background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.6)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"5px 14px",fontSize:12,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:900,margin:"0 auto",padding:"24px 16px 60px"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar boda, venue, responsable..." style={{...INP,flex:1,minWidth:200,borderRadius:10}} />
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{...INP,width:"auto",flex:"0 0 auto"}}><option value="all">Todos los estados</option>{ESTADOS_BODA.map(s=><option key={s}>{s}</option>)}</select>
          <button onClick={()=>setShowNew(v=>!v)} style={{background:R.accent,color:"#fff",border:"none",borderRadius:10,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",flexShrink:0,fontFamily:"'Jost',sans-serif"}}>+ Nueva boda</button>
        </div>

        {showNew&&(
          <div style={{...CARD,marginBottom:16}}>
            <div style={HDR}><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,color:R.white,fontWeight:500}}>💍 Nueva boda</span></div>
            <div style={GOLD_BAR} />
            <div style={{padding:20}}><BodaForm onSave={handleCreate} onCancel={()=>setShowNew(false)} saving={saving} users={users} /></div>
          </div>
        )}

        {err&&(
          <div style={{background:"#fff5f5",border:"1px solid #fca5a5",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:13,color:"#b91c1c"}}>{err}</span>
            <button onClick={load} style={{background:"none",border:"none",color:R.accent,cursor:"pointer",fontSize:13,textDecoration:"underline",fontFamily:"'Jost',sans-serif"}}>Reintentar</button>
          </div>
        )}

        {!loading&&bodas.length>0&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
            {[
              {label:"Activas",       count:bodas.filter(b=>b.status==="Activa").length,      color:R.accent},
              {label:"En pausa",      count:bodas.filter(b=>b.status==="En pausa").length,    color:"#d97706"},
              {label:"Terminadas",    count:bodas.filter(b=>b.status==="Terminada").length,   color:"#16a34a"},
              {label:"Tareas activas",count:bodas.flatMap(b=>b.tasks||[]).filter(t=>!["Terminado","Cancelado"].includes(t.status)).length,color:"#7c3aed"},
            ].map(s=>(
              <div key={s.label} style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:14,padding:"16px 12px",textAlign:"center"}}>
                <p style={{fontSize:26,fontWeight:700,color:s.color,margin:0}}>{s.count}</p>
                <p style={{fontSize:11,color:R.muted,margin:"4px 0 0",letterSpacing:".04em"}}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {loading?(
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
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filtered.map(boda=>{
              const days=daysUntil(boda.weddingDate);
              const ph=FASE_COLORS[boda.phase]||{bg:"#f5f5f4",color:"#57534e"};
              const active=(boda.tasks||[]).filter(t=>!["Terminado","Cancelado"].includes(t.status));
              const late=active.filter(t=>{ if(!t.dueDate) return false; const d=new Date(t.dueDate+"T12:00:00"); d.setHours(0,0,0,0); return d<today; });
              const contratado=(boda.suppliers||[]).filter(s=>["Contratado","Pagado"].includes(s.status)).length;
              return (
                <div key={boda.id} onClick={()=>setSelected(boda)}
                  style={{background:R.white,border:`1px solid ${R.border}`,borderRadius:14,padding:"14px 18px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",transition:"border-color .15s,box-shadow .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=R.mid;e.currentTarget.style.boxShadow="0 2px 16px rgba(190,18,60,.08)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=R.border;e.currentTarget.style.boxShadow="none";}}>
                  <div style={{background:R.light,border:`1px solid ${R.border}`,borderRadius:12,padding:"8px 12px",textAlign:"center",flexShrink:0,minWidth:56}}>
                    {boda.weddingDate?(
                      <>
                        <p style={{fontSize:11,color:R.muted,margin:0,lineHeight:1}}>{fmtDate(boda.weddingDate).split(" ")[1]?.toUpperCase()||""}</p>
                        <p style={{fontSize:20,fontWeight:700,color:R.accent,margin:"2px 0 0",fontFamily:"'Cormorant Garamond',serif",lineHeight:1}}>{fmtDate(boda.weddingDate).split(" ")[0]}</p>
                      </>
                    ):<p style={{fontSize:20,margin:0}}>💍</p>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                      <p style={{fontSize:15,fontWeight:600,color:R.text,margin:0}}>{boda.clienteName}</p>
                      <span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:ph.bg,color:ph.color}}>{boda.phase}</span>
                      {late.length>0&&<span style={{fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:99,background:"#fff1f2",color:"#be123c"}}>⚠️ {late.length} atrasada{late.length>1?"s":""}</span>}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"2px 12px",fontSize:12,color:R.muted}}>
                      {days!==null&&days>=0&&<span>⏳ {days}d</span>}
                      {days!==null&&days<0 &&<span>Hace {Math.abs(days)}d</span>}
                      {boda.venue      &&<span>📍 {boda.venue}</span>}
                      {boda.responsable&&<span>👤 {boda.responsable}</span>}
                      {boda.guestCount &&<span>👥 {boda.guestCount}</span>}
                      {contratado>0    &&<span>🤝 {contratado} contratado{contratado>1?"s":""}</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0,minWidth:64}}>
                    {active.length>0&&<p style={{fontSize:12,color:R.muted,margin:"0 0 2px"}}>{active.length} tarea{active.length>1?"s":""}</p>}
                    <span style={{fontSize:11,fontWeight:600,color:boda.status==="Activa"?"#16a34a":boda.status==="En pausa"?"#d97706":R.muted}}>{boda.status}</span>
                  </div>
                  <button onClick={e=>handleDelete(e,boda)}
                    style={{color:R.border,background:"none",border:"none",cursor:"pointer",fontSize:16,padding:"0 4px",flexShrink:0}}
                    onMouseEnter={e=>e.currentTarget.style.color="#dc2626"}
                    onMouseLeave={e=>e.currentTarget.style.color=R.border}>🗑</button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
