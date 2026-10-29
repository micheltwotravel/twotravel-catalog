import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

const R = {
  gold:"#c9a96e", dark:"#1a0812", white:"#fff", cream:"#faf8f4",
  light:"#f5f3ef", border:"#e8e2d9", accent:"#9b6a37",
  text:"#1a1814", muted:"#8a7968",
};
const INP = {
  width:"100%", padding:"10px 14px", border:`1px solid ${R.border}`,
  borderRadius:8, fontSize:14, fontFamily:"'Jost',sans-serif",
  background:R.white, color:R.text, outline:"none", boxSizing:"border-box",
};

const MEAL_OPTIONS_ES = ["Sin especificar","Carne","Pescado","Vegetariano","Vegano","Sin gluten","Infantil"];
const MEAL_OPTIONS_EN = ["No preference","Beef","Fish","Vegetarian","Vegan","Gluten-free","Children's menu"];

const T = {
  es: {
    confirmation: "Confirmación de asistencia",
    thankYou: (name) => `¡Gracias, ${name}!`,
    thankYouSub: "Tu confirmación ha sido recibida. ¡Nos vemos en la celebración!",
    fullName: "Nombre completo",
    namePlaceholder: "Tu nombre",
    email: "Email",
    emailPlaceholder: "tu@email.com",
    whatsapp: "WhatsApp / Teléfono",
    phonePlaceholder: "+57 300 000 0000",
    eventsQuestion: "¿A cuáles eventos asistirás?",
    menuPref: "Preferencia de menú",
    companion: "Acompañante (si aplica)",
    companionPlaceholder: "Nombre de tu acompañante",
    notes: "Alergias / restricciones / notas",
    notesPlaceholder: "Restricciones alimentarias, alergias u otras notas…",
    rsvpQuestion: "¿Confirmas tu asistencia?",
    yes: "✅ Sí, confirmo",
    no: "❌ No podré asistir",
    submit: "Confirmar asistencia",
    submitting: "Enviando…",
    invalidLink: "Link no válido.",
    loading: "Cargando…",
    error: "Error al enviar. Por favor intenta de nuevo.",
    footer: "Two Lovers · Two Travel",
  },
  en: {
    confirmation: "RSVP",
    thankYou: (name) => `Thank you, ${name}!`,
    thankYouSub: "Your response has been received. We look forward to celebrating with you!",
    fullName: "Full name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "your@email.com",
    whatsapp: "WhatsApp / Phone",
    phonePlaceholder: "+1 555 000 0000",
    eventsQuestion: "Which events will you attend?",
    menuPref: "Menu preference",
    companion: "Plus one (if applicable)",
    companionPlaceholder: "Your guest's name",
    notes: "Allergies / dietary restrictions / notes",
    notesPlaceholder: "Food allergies, restrictions, or other notes…",
    rsvpQuestion: "Will you attend?",
    yes: "✅ Yes, I'll be there",
    no: "❌ Sorry, I can't make it",
    submit: "Confirm attendance",
    submitting: "Sending…",
    invalidLink: "Invalid link.",
    loading: "Loading…",
    error: "Error submitting. Please try again.",
    footer: "Two Lovers · Two Travel",
  },
};

const DEFAULT_EVENTS = [{id:"preboda",name:"PREBODA"},{id:"boda",name:"BODA"},{id:"postboda",name:"POSTBODA"}];

function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }

async function loadBoda(bodaId){
  const { data } = await supabase.from("bodas").select("*").eq("id", bodaId).single();
  if (!data) return null;
  const d = data.data || {};
  return { ...d, id: data.id };
}

async function saveBoda(boda){
  const { id, ...rest } = boda;
  const { data: existing } = await supabase.from("bodas").select("data").eq("id", id).single();
  const merged = { ...(existing?.data||{}), ...rest };
  await supabase.from("bodas").update({ data: merged }).eq("id", id);
}

export default function BodaRsvpPage() {
  const params = new URLSearchParams(window.location.search);
  const bodaId = params.get("bodaId") || "";
  const initialLang = params.get("lang") === "en" ? "en" : "es";

  const [lang, setLang] = useState(initialLang);
  const [boda, setBoda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", meal: "",
    eventIds: [], notes: "", plusOne: "", rsvp: "Confirmado",
  });

  useEffect(() => {
    if (!bodaId) { setLoading(false); return; }
    loadBoda(bodaId).then(b => { setBoda(b); setLoading(false); });
  }, [bodaId]);

  const t = T[lang];
  const mealOptions = lang === "en" ? MEAL_OPTIONS_EN : MEAL_OPTIONS_ES;
  const wEvents = boda?.weddingEvents || DEFAULT_EVENTS;

  function toggleLang() {
    const next = lang === "es" ? "en" : "es";
    setLang(next);
    const url = new URL(window.location.href);
    if (next === "en") url.searchParams.set("lang", "en");
    else url.searchParams.delete("lang");
    history.replaceState(null, "", url.toString());
    // reset meal to default of new lang
    setForm(p => ({ ...p, meal: "" }));
  }

  function toggleEv(id){
    setForm(p => ({
      ...p,
      eventIds: p.eventIds.includes(id) ? p.eventIds.filter(x=>x!==id) : [...p.eventIds, id],
    }));
  }

  async function submit(e){
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const guest = { ...form, id: uid(), rsvp: form.rsvp, lang, createdAt: new Date().toISOString(), fromRsvp: true };
      const updatedGuests = [...(boda.guests || []), guest];
      await saveBoda({ ...boda, guests: updatedGuests });
      setSent(true);
    } catch(err) {
      alert(t.error);
    }
    setSaving(false);
  }

  const LangToggle = (
    <button onClick={toggleLang} style={{position:"absolute",top:16,right:16,background:"rgba(255,255,255,.12)",color:R.gold,border:`1px solid rgba(201,169,110,.3)`,borderRadius:99,padding:"5px 14px",fontSize:11,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:600,letterSpacing:".08em"}}>
      {lang === "es" ? "EN" : "ES"}
    </button>
  );

  if (loading) return (
    <div style={{minHeight:"100vh",background:R.cream,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:R.muted,fontFamily:"'Jost',sans-serif"}}>{t.loading}</p>
    </div>
  );

  if (!boda || !bodaId) return (
    <div style={{minHeight:"100vh",background:R.cream,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:R.muted,fontFamily:"'Jost',sans-serif"}}>{t.invalidLink}</p>
    </div>
  );

  if (sent) return (
    <div style={{minHeight:"100vh",background:R.cream,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px 16px"}}>
      <div style={{textAlign:"center",maxWidth:420}}>
        <div style={{fontSize:48,marginBottom:16}}>💍</div>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:400,color:R.dark,marginBottom:12,fontStyle:"italic"}}>{t.thankYou(form.name)}</h1>
        <p style={{fontFamily:"'Jost',sans-serif",fontSize:15,color:R.muted,lineHeight:1.6}}>
          {t.thankYouSub}
        </p>
        <div style={{marginTop:24,width:60,height:2,background:R.gold,margin:"24px auto 0"}} />
        <p style={{fontFamily:"'Jost',sans-serif",fontSize:12,color:R.muted,marginTop:16}}>{boda.clienteName}</p>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:R.cream,fontFamily:"'Jost',sans-serif"}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Jost:wght@300;400;500;600&display=swap" />

      {/* Hero */}
      <div style={{background:R.dark,padding:"48px 24px 40px",textAlign:"center",position:"relative"}}>
        {LangToggle}
        <p style={{fontSize:11,letterSpacing:".2em",color:R.gold,textTransform:"uppercase",margin:"0 0 12px"}}>{t.confirmation}</p>
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:36,fontWeight:400,color:R.white,margin:0,fontStyle:"italic"}}>{boda.clienteName}</h1>
        {boda.weddingDate && <p style={{fontSize:13,color:"rgba(255,255,255,.55)",margin:"10px 0 0",letterSpacing:".05em"}}>{boda.weddingDate}</p>}
        {boda.venue && <p style={{fontSize:12,color:R.gold,margin:"6px 0 0"}}>📍 {boda.venue}</p>}
        <div style={{width:48,height:1,background:R.gold,margin:"24px auto 0",opacity:.6}} />
      </div>

      {/* Form */}
      <div style={{maxWidth:520,margin:"0 auto",padding:"32px 20px 48px"}}>
        <form onSubmit={submit}>

          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{t.fullName} *</label>
            <input style={INP} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder={t.namePlaceholder} required />
          </div>

          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{t.email}</label>
            <input style={INP} type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} placeholder={t.emailPlaceholder} />
          </div>

          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{t.whatsapp}</label>
            <input style={INP} value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} placeholder={t.phonePlaceholder} />
          </div>

          {/* Eventos */}
          {wEvents.length > 0 && (
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>{t.eventsQuestion}</label>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {wEvents.map(ev => {
                  const on = form.eventIds.includes(ev.id);
                  return (
                    <button key={ev.id} type="button" onClick={()=>toggleEv(ev.id)}
                      style={{padding:"8px 18px",borderRadius:99,border:`1.5px solid ${on?R.accent:R.border}`,background:on?R.accent:"transparent",color:on?R.white:R.muted,fontSize:13,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:on?600:400,transition:"all .15s"}}>
                      {ev.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{t.menuPref}</label>
            <select style={INP} value={form.meal} onChange={e=>setForm(p=>({...p,meal:e.target.value}))}>
              <option value="">{mealOptions[0]}</option>
              {mealOptions.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{marginBottom:18}}>
            <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{t.companion}</label>
            <input style={INP} value={form.plusOne} onChange={e=>setForm(p=>({...p,plusOne:e.target.value}))} placeholder={t.companionPlaceholder} />
          </div>

          <div style={{marginBottom:24}}>
            <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{t.notes}</label>
            <textarea style={{...INP,resize:"vertical",minHeight:70}} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder={t.notesPlaceholder} />
          </div>

          <div style={{marginBottom:24}}>
            <label style={{display:"block",fontSize:12,color:R.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>{t.rsvpQuestion}</label>
            <div style={{display:"flex",gap:8}}>
              {[["Confirmado", t.yes], ["No asiste", t.no]].map(([s, label]) => (
                <button key={s} type="button" onClick={()=>setForm(p=>({...p,rsvp:s}))}
                  style={{flex:1,padding:"10px",borderRadius:8,border:`1.5px solid ${form.rsvp===s?(s==="Confirmado"?"#15803d":"#dc2626"):R.border}`,background:form.rsvp===s?(s==="Confirmado"?"#f0fdf4":"#fef2f2"):"transparent",color:form.rsvp===s?(s==="Confirmado"?"#15803d":"#dc2626"):R.muted,fontSize:13,cursor:"pointer",fontFamily:"'Jost',sans-serif",fontWeight:form.rsvp===s?600:400}}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving||!form.name.trim()}
            style={{width:"100%",padding:"14px",background:R.dark,color:R.gold,border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:saving||!form.name.trim()?"not-allowed":"pointer",fontFamily:"'Jost',sans-serif",letterSpacing:".06em",opacity:saving||!form.name.trim()?.6:1,transition:"opacity .2s"}}>
            {saving ? t.submitting : t.submit}
          </button>
        </form>

        <p style={{textAlign:"center",fontSize:11,color:R.muted,marginTop:24,opacity:.6}}>{t.footer}</p>
      </div>
    </div>
  );
}
