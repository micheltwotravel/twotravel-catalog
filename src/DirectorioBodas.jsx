import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

/* ── Design tokens ── */
const R = {
  bg: "#FAF8F5", card: "#FFFFFF", dark: "#1A0812",
  text: "#1A1814", text2: "#3D3A35", muted: "#8B8580",
  border: "rgba(26,24,20,0.10)", border2: "rgba(26,24,20,0.18)",
  light: "#F5F2EE", cream: "#FDF8F2",
  accent: "#9A6E3A", gold: "#C4A272", gold2: "#E8D5B7",
};
const INP = { width:"100%", boxSizing:"border-box", border:`1px solid ${R.border2}`,
  borderRadius:8, padding:"8px 12px", fontSize:13, fontFamily:"'Jost',sans-serif",
  background:"#fff", color:R.text, outline:"none" };
const INP_SM = { ...INP, padding:"6px 10px", fontSize:12 };
const BTN = (accent) => ({ background:accent?R.accent:"transparent", color:accent?"#fff":R.muted,
  border:`1px solid ${accent?R.accent:R.border2}`, borderRadius:8, padding:"7px 18px",
  fontSize:12, cursor:"pointer", fontFamily:"'Jost',sans-serif", fontWeight:accent?600:400 });

const uid = () => Math.random().toString(36).slice(2,10);

const PROV_CATS = ["Maquillaje y peinado","Fotografía y video","DJ","Decoración",
  "Producción","Mulatas y tamboreros","Música en vivo","Tarimas","Pirotecnia",
  "Carros antiguos","Experiencias","Tortas y postres","Fotocabina","Hora loca",
  "Transporte","Coordinación","Catering","Otro"];

const CITIES = ["CTG","MDE","BOG","CDMX","BAQ","CAL","SMR","Otro"];

const VENUE_EVENT_TYPES = ["Boda","Pre-boda","Welcome cocktail","Ensayo","Otro"];

const VENUE_TYPES = ["Hacienda","Casa colonial","Museo","Restaurante","Hotel","Playa",
  "Rooftop","Club campestre","Villa","Salón","Otro"];

const PROV_EMPTY = { company:"", category:"", contact:"", phone:"", email:"",
  city:"CTG", rating:"", notes:"", web:"", instagram:"",
  paymentMethodLocal:"", paymentMethodIntl:"", brochureUrl:"", photosUrl:"",
  commissionYes:false, commission:"" };

const VENUE_EMPTY = { name:"", city:"CTG", type:"", eventoTipo:"", capacity:"", address:"",
  contact:"", commercialContact:"", commercialPhone:"", phone:"", email:"", web:"", notes:"" };

/* ── Rating stars ── */
function Stars({ val, onChange }) {
  return (
    <div style={{ display:"flex", gap:2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={()=>onChange && onChange(n===Number(val)?0:n)}
          style={{ fontSize:16, cursor:onChange?"pointer":"default",
            color:n<=Number(val||0)?"#f59e0b":"#d1d5db", userSelect:"none" }}>★</span>
      ))}
    </div>
  );
}

/* ── Sección proveedores ── */
function ProveedoresSection({ items, setItems, persist }) {
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [blank, setBlank] = useState(PROV_EMPTY);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterCity, setFilterCity] = useState("all");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setBlank(p => ({ ...p, [k]: v }));

  function startEdit(item) { setBlank({ ...PROV_EMPTY, ...item }); setEditId(item.id); setShow(true); }
  function startNew() { setBlank(PROV_EMPTY); setEditId(null); setShow(true); }

  async function save() {
    if (!blank.company?.trim()) return;
    setSaving(true);
    const updated = editId
      ? items.map(x => x.id === editId ? { ...blank, id: editId } : x)
      : [...items, { ...blank, id: uid() }];
    await persist(updated);
    setItems(updated);
    setBlank(PROV_EMPTY); setEditId(null); setShow(false);
    setSaving(false);
  }

  async function del(id) {
    if (!confirm("¿Eliminar este proveedor?")) return;
    const updated = items.filter(x => x.id !== id);
    await persist(updated); setItems(updated);
  }

  const cats = [...new Set(items.map(x => x.category).filter(Boolean))].sort();
  const visible = items.filter(x => {
    const q = search.toLowerCase();
    const matchQ = !q || [x.company,x.contact,x.city,x.notes].some(f=>f?.toLowerCase().includes(q));
    const matchCat = !filterCat || x.category === filterCat;
    const matchCity = filterCity === "all" || x.city === filterCity;
    return matchQ && matchCat && matchCity;
  }).sort((a,b) => (a.company||"").localeCompare(b.company||""));

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Buscar proveedor…"
          style={{ ...INP_SM, flex:1, minWidth:180 }} />
        <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
          style={{ ...INP_SM, width:"auto" }}>
          <option value="">Todas las categorías</option>
          {cats.map(c => <option key={c}>{c}</option>)}
        </select>
        <button onClick={startNew} style={{ ...BTN(true), whiteSpace:"nowrap" }}>+ Proveedor</button>
      </div>
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
        {[["all","Todos"],["CTG","Cartagena"],["MDE","Medellín"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilterCity(v)}
            style={{ background:filterCity===v?R.accent:"transparent", color:filterCity===v?"#fff":R.muted,
              border:`1px solid ${filterCity===v?R.accent:R.border2}`, borderRadius:99,
              padding:"4px 12px", fontSize:11, cursor:"pointer", fontFamily:"'Jost',sans-serif",
              fontWeight:filterCity===v?600:400 }}>
            {l}
          </button>
        ))}
      </div>

      {/* Form */}
      {show && (
        <div style={{ background:R.cream, border:`1px solid ${R.border2}`, borderRadius:12,
          padding:18, marginBottom:16 }}>
          <p style={{ margin:"0 0 12px", fontSize:11, fontWeight:700, letterSpacing:".1em",
            textTransform:"uppercase", color:R.muted }}>
            {editId ? "Editar proveedor" : "Nuevo proveedor"}
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div style={{ gridColumn:"span 2" }}>
              <input style={INP_SM} value={blank.company} onChange={e=>set("company",e.target.value)}
                placeholder="Nombre empresa / proveedor *" autoFocus />
            </div>
            <select style={INP_SM} value={blank.category} onChange={e=>set("category",e.target.value)}>
              <option value="">Categoría</option>
              {PROV_CATS.map(c=><option key={c}>{c}</option>)}
            </select>
            <select style={INP_SM} value={blank.city} onChange={e=>set("city",e.target.value)}>
              {CITIES.map(c=><option key={c}>{c}</option>)}
            </select>
            <input style={INP_SM} value={blank.contact} onChange={e=>set("contact",e.target.value)} placeholder="Contacto" />
            <input style={INP_SM} value={blank.phone}   onChange={e=>set("phone",e.target.value)}   placeholder="Teléfono / WhatsApp" />
            <input style={INP_SM} value={blank.email}   onChange={e=>set("email",e.target.value)}   placeholder="Email" />
            <input style={INP_SM} value={blank.web}       onChange={e=>set("web",e.target.value)}       placeholder="Sitio web" />
            <input style={INP_SM} value={blank.instagram} onChange={e=>set("instagram",e.target.value)} placeholder="@instagram" />
            <input style={INP_SM} value={blank.paymentMethodLocal}  onChange={e=>set("paymentMethodLocal",e.target.value)}  placeholder="Pago local (Nequi, Bancolombia…)" />
            <input style={INP_SM} value={blank.paymentMethodIntl}   onChange={e=>set("paymentMethodIntl",e.target.value)}   placeholder="Pago internacional (Zelle, PayPal…)" />
            <input style={INP_SM} value={blank.brochureUrl} onChange={e=>set("brochureUrl",e.target.value)} placeholder="Link brochure" />
            <input style={INP_SM} value={blank.photosUrl}   onChange={e=>set("photosUrl",e.target.value)}   placeholder="Link fotos" />
            <div style={{ gridColumn:"span 2", display:"flex", alignItems:"center", gap:12 }}>
              <label style={{ display:"flex", alignItems:"center", gap:6, cursor:"pointer", fontSize:11, color:R.muted }}>
                <input type="checkbox" checked={!!blank.commissionYes}
                  onChange={e=>set("commissionYes",e.target.checked)}
                  style={{ accentColor:R.accent }} />
                ¿Paga comisión?
              </label>
              {blank.commissionYes && (
                <input style={{ ...INP_SM, width:100 }} type="number" min={0} max={100}
                  value={blank.commission} onChange={e=>set("commission",e.target.value)}
                  placeholder="Comisión %" />
              )}
            </div>
            <div style={{ gridColumn:"span 2" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
                <span style={{ fontSize:11, color:R.muted }}>Rating:</span>
                <Stars val={blank.rating} onChange={v=>set("rating",v)} />
              </div>
              <textarea style={{ ...INP_SM, resize:"vertical", minHeight:48 }}
                value={blank.notes} onChange={e=>set("notes",e.target.value)}
                placeholder="Notas / experiencia" />
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={save} disabled={saving||!blank.company?.trim()} style={BTN(true)}>
              {saving?"Guardando…":"Guardar"}
            </button>
            <button onClick={()=>{setShow(false);setEditId(null);}} style={BTN(false)}>Cancelar</button>
            {editId && <button onClick={()=>del(editId)} style={{...BTN(false),color:"#dc2626",borderColor:"#fca5a5",marginLeft:"auto"}}>Eliminar</button>}
          </div>
        </div>
      )}

      {/* List */}
      {visible.length === 0 && (
        <p style={{ fontSize:12, color:R.muted, textAlign:"center", padding:"32px 0", fontStyle:"italic" }}>
          {search||filterCat ? "Sin resultados" : "Sin proveedores aún — agrega el primero"}
        </p>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
        {visible.map(p => (
          <div key={p.id} onClick={()=>startEdit(p)}
            style={{ background:R.card, border:`1px solid ${R.border}`, borderRadius:10,
              padding:"14px 16px", cursor:"pointer", transition:"box-shadow .15s" }}
            onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)"}
            onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
              <div style={{ minWidth:0 }}>
                <p style={{ margin:0, fontSize:14, fontWeight:600, color:R.text,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.company}</p>
                <p style={{ margin:"2px 0 0", fontSize:10, color:R.accent, textTransform:"uppercase",
                  letterSpacing:".07em" }}>{p.category}{p.city ? ` · ${p.city}` : ""}</p>
              </div>
              {p.rating > 0 && <Stars val={p.rating} />}
            </div>
            {(p.contact||p.phone) && (
              <p style={{ margin:"8px 0 0", fontSize:11, color:R.text2 }}>
                {p.contact}{p.contact&&p.phone?" · ":""}{p.phone}
              </p>
            )}
            {p.email && <p style={{ margin:"2px 0 0", fontSize:11, color:R.muted }}>{p.email}</p>}
            {p.instagram && <p style={{ margin:"2px 0 0", fontSize:11, color:R.accent }}>{p.instagram}</p>}
            {(p.paymentMethodLocal||p.paymentMethodIntl) && (
              <p style={{ margin:"4px 0 0", fontSize:10, color:R.muted }}>
                💳 {[p.paymentMethodLocal,p.paymentMethodIntl].filter(Boolean).join(" · ")}
              </p>
            )}
            {(p.brochureUrl||p.photosUrl) && (
              <div style={{ display:"flex", gap:8, margin:"4px 0 0" }}>
                {p.brochureUrl && <a href={p.brochureUrl} target="_blank" rel="noreferrer"
                  onClick={e=>e.stopPropagation()}
                  style={{ fontSize:10, color:R.accent }}>📄 Brochure</a>}
                {p.photosUrl && <a href={p.photosUrl} target="_blank" rel="noreferrer"
                  onClick={e=>e.stopPropagation()}
                  style={{ fontSize:10, color:R.accent }}>📸 Fotos</a>}
              </div>
            )}
            {p.commissionYes && (
              <p style={{ margin:"4px 0 0", fontSize:10, color:"#16a34a" }}>
                ✓ Comisión{p.commission ? ` ${p.commission}%` : ""}
              </p>
            )}
            {p.notes && (
              <p style={{ margin:"6px 0 0", fontSize:11, color:R.muted, fontStyle:"italic",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ── Venues by city (for Venues & Welcome Cocktail tabs) ── */
function VenuesCitySection({ items, setItems, persist, eventFilter }) {
  const filtered = items.filter(v =>
    eventFilter === "wc"
      ? (v.eventoTipo || "").toLowerCase().includes("welcome")
      : !(v.eventoTipo || "").toLowerCase().includes("welcome")
  );

  const [cityTab, setCityTab] = useState("all");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState(null);
  const [blank, setBlank] = useState(VENUE_EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setBlank(p => ({ ...p, [k]: v }));

  const FIXED_CITIES = eventFilter === "wc" ? ["CTG","MDE"] : [];
  const cities = ["all", ...([...new Set([...FIXED_CITIES, ...filtered.map(x => x.city).filter(Boolean)])].sort())];

  const visible = filtered.filter(v => {
    const q = search.toLowerCase();
    const matchQ = !q || [v.name, v.contact, v.city, v.notes].some(f => f?.toLowerCase().includes(q));
    const matchCity = cityTab === "all" || v.city === cityTab;
    return matchQ && matchCity;
  }).sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  function startEdit(item) { setBlank({ ...VENUE_EMPTY, ...item }); setEditId(item.id); setShow(true); }
  function startNew() { setBlank(VENUE_EMPTY); setEditId(null); setShow(true); }

  async function save() {
    if (!blank.name?.trim()) return;
    setSaving(true);
    const updated = editId
      ? items.map(x => x.id === editId ? { ...blank, id: editId } : x)
      : [...items, { ...blank, id: uid() }];
    await persist(updated); setItems(updated);
    setBlank(VENUE_EMPTY); setEditId(null); setShow(false);
    setSaving(false);
  }

  async function del(id) {
    if (!confirm("¿Eliminar este venue?")) return;
    const updated = items.filter(x => x.id !== id);
    await persist(updated); setItems(updated);
  }

  const CITY_LABEL = { all: "Todos", CTG: "Cartagena", MDE: "Medellín", CDMX: "CDMX", TUL: "Tulum" };

  return (
    <div>
      {/* City pills */}
      <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        {cities.map(c => (
          <button key={c} onClick={() => setCityTab(c)}
            style={{ background:cityTab===c?R.accent:"transparent", color:cityTab===c?"#fff":R.muted,
              border:`1px solid ${cityTab===c?R.accent:R.border2}`, borderRadius:99,
              padding:"5px 14px", fontSize:11, cursor:"pointer", fontFamily:"'Jost',sans-serif",
              fontWeight:cityTab===c?600:400, transition:"all .15s" }}>
            {CITY_LABEL[c] || c}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar venue…" style={{ ...INP_SM, width:180 }} />
          <button onClick={startNew} style={{ ...BTN(true), whiteSpace:"nowrap" }}>+ Venue</button>
        </div>
      </div>

      {/* Form */}
      {show && (
        <div style={{ background:R.cream, border:`1px solid ${R.border2}`, borderRadius:12,
          padding:18, marginBottom:16 }}>
          <p style={{ margin:"0 0 12px", fontSize:11, fontWeight:700, letterSpacing:".1em",
            textTransform:"uppercase", color:R.muted }}>
            {editId ? "Editar venue" : "Nuevo venue"}
          </p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
            <div style={{ gridColumn:"span 2" }}>
              <input style={INP_SM} value={blank.name} onChange={e => set("name", e.target.value)}
                placeholder="Nombre del venue *" autoFocus />
            </div>
            <select style={INP_SM} value={blank.eventoTipo} onChange={e => set("eventoTipo", e.target.value)}>
              <option value="">Tipo de evento</option>
              {VENUE_EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select style={INP_SM} value={blank.type} onChange={e => set("type", e.target.value)}>
              <option value="">Tipo de espacio</option>
              {VENUE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select style={INP_SM} value={blank.city} onChange={e => set("city", e.target.value)}>
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <input style={INP_SM} value={blank.capacity} onChange={e => set("capacity", e.target.value)} placeholder="Capacidad (personas)" />
            <div style={{ gridColumn:"span 2" }}>
              <input style={INP_SM} value={blank.address||""} onChange={e => set("address", e.target.value)} placeholder="Dirección / Localización" />
            </div>
            <input style={INP_SM} value={blank.commercialContact||""} onChange={e => set("commercialContact", e.target.value)} placeholder="Contacto comercial (nombre)" />
            <input style={INP_SM} value={blank.commercialPhone||""}   onChange={e => set("commercialPhone", e.target.value)}   placeholder="Teléfono comercial" />
            <input style={INP_SM} value={blank.contact}  onChange={e => set("contact", e.target.value)}  placeholder="Contacto operativo" />
            <input style={INP_SM} value={blank.phone}    onChange={e => set("phone", e.target.value)}    placeholder="Teléfono / WhatsApp" />
            <input style={INP_SM} value={blank.email}    onChange={e => set("email", e.target.value)}    placeholder="Email" />
            <div style={{ gridColumn:"span 2" }}>
              <input style={{ ...INP_SM, marginBottom:8 }} value={blank.web} onChange={e => set("web", e.target.value)} placeholder="Web / Instagram" />
              <textarea style={{ ...INP_SM, resize:"vertical", minHeight:56 }}
                value={blank.notes} onChange={e => set("notes", e.target.value)}
                placeholder="Notas: servicios incluidos, catering propio, restricciones, experiencia…" />
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={save} disabled={saving || !blank.name?.trim()} style={BTN(true)}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => { setShow(false); setEditId(null); }} style={BTN(false)}>Cancelar</button>
            {editId && <button onClick={() => del(editId)} style={{ ...BTN(false), color:"#dc2626", borderColor:"#fca5a5", marginLeft:"auto" }}>Eliminar</button>}
          </div>
        </div>
      )}

      {visible.length === 0 && (
        <p style={{ fontSize:12, color:R.muted, textAlign:"center", padding:"32px 0", fontStyle:"italic" }}>
          {search || cityTab !== "all" ? "Sin resultados" : "Sin venues aún"}
        </p>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
        {visible.map(v => (
          <div key={v.id} onClick={() => startEdit(v)}
            style={{ background:R.card, border:`1px solid ${R.border}`, borderRadius:10,
              padding:"14px 16px", cursor:"pointer", transition:"box-shadow .15s" }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ minWidth:0 }}>
                <p style={{ margin:0, fontSize:14, fontWeight:600, color:R.text,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.name}</p>
                <p style={{ margin:"2px 0 0", fontSize:10, color:R.accent, textTransform:"uppercase", letterSpacing:".07em" }}>
                  {v.type}{v.city ? ` · ${v.city}` : ""}{v.capacity ? ` · ${v.capacity} pax` : ""}
                </p>
              </div>
            </div>
            {v.address && <p style={{ margin:"6px 0 0", fontSize:10, color:R.muted }}>📍 {v.address}</p>}
            {(v.commercialContact || v.commercialPhone) && (
              <p style={{ margin:"4px 0 0", fontSize:11, color:R.text2, fontWeight:500 }}>
                🤝 {v.commercialContact}{v.commercialContact && v.commercialPhone ? " · " : ""}{v.commercialPhone}
              </p>
            )}
            {(v.contact || v.phone) && (
              <p style={{ margin:"2px 0 0", fontSize:11, color:R.text2 }}>
                {v.contact}{v.contact && v.phone ? " · " : ""}{v.phone}
              </p>
            )}
            {v.email && <p style={{ margin:"2px 0 0", fontSize:11, color:R.muted }}>{v.email}</p>}
            {v.notes && (
              <p style={{ margin:"6px 0 0", fontSize:11, color:R.muted, fontStyle:"italic",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{v.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function DirectorioBodas({ currentUser, onLogout, embedded }) {
  const [tab, setTab] = useState("venues");
  const [proveedores, setProveedores] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("directorio_bodas")
          .select("id, data")
          .in("id", ["proveedores", "venues"]);
        if (err) throw err;
        const pRow = data?.find(r => r.id === "proveedores");
        const vRow = data?.find(r => r.id === "venues");
        setProveedores(Array.isArray(pRow?.data) ? pRow.data : []);
        setVenues(Array.isArray(vRow?.data) ? vRow.data : []);
      } catch (e) {
        setError("Error al cargar: " + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persistProveedores = useCallback(async (items) => {
    await supabase.from("directorio_bodas")
      .upsert({ id: "proveedores", data: items }, { onConflict: "id" });
  }, []);

  const persistVenues = useCallback(async (items) => {
    await supabase.from("directorio_bodas")
      .upsert({ id: "venues", data: items }, { onConflict: "id" });
  }, []);

  const wcCount = venues.filter(v => (v.eventoTipo || "").toLowerCase().includes("welcome")).length;
  const venueCount = venues.length - wcCount;

  const TABS = [
    { id: "venues",    label: `Venues (${venueCount})` },
    { id: "wc",        label: `Welcome Cocktail (${wcCount})` },
    { id: "providers", label: `Providers (${proveedores.length})` },
  ];

  return (
    <div style={{ minHeight: embedded ? "auto" : "100vh", background:R.bg, fontFamily:"'Jost',sans-serif" }}>

      {/* Header — solo en standalone */}
      {!embedded && (
        <div style={{ background:R.dark, padding:"20px 28px", display:"flex",
          alignItems:"center", justifyContent:"space-between", gap:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <a href="/?mode=bodas" style={{ color:"rgba(255,255,255,.45)", fontSize:12,
              textDecoration:"none", letterSpacing:".04em" }}>← Bodas</a>
            <span style={{ color:"rgba(255,255,255,.2)" }}>|</span>
            <p style={{ margin:0, fontFamily:"'Cormorant Garamond',serif", fontSize:20,
              color:"#fff", fontStyle:"italic", letterSpacing:".04em" }}>
              Directorio · Two Lovers
            </p>
          </div>
          {onLogout && (
            <button onClick={onLogout} style={{ background:"none", border:"1px solid rgba(255,255,255,.2)",
              color:"rgba(255,255,255,.5)", cursor:"pointer", fontSize:11, borderRadius:6,
              padding:"4px 12px", fontFamily:"'Jost',sans-serif" }}>Salir</button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ background:"#fff", borderBottom:`1px solid ${R.border}`,
        display:"flex", padding:"0 28px", gap:0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background:"none", border:"none", borderBottom:tab===t.id?`2px solid ${R.accent}`:"2px solid transparent",
              padding:"14px 20px", fontSize:13, cursor:"pointer", fontFamily:"'Jost',sans-serif",
              color:tab===t.id?R.accent:R.muted, fontWeight:tab===t.id?600:400,
              letterSpacing:".02em", transition:"color .15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth:1200, margin:"0 auto", padding: embedded ? "20px 0" : "28px 24px" }}>
        {loading && (
          <p style={{ textAlign:"center", color:R.muted, fontSize:13, padding:"40px 0" }}>Cargando…</p>
        )}
        {error && (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10,
            padding:"16px 20px", marginBottom:20 }}>
            <p style={{ margin:0, fontSize:13, color:"#991b1b", fontWeight:600 }}>{error}</p>
          </div>
        )}
        {!loading && !error && tab === "venues" && (
          <VenuesCitySection items={venues} setItems={setVenues} persist={persistVenues} eventFilter="bodas" />
        )}
        {!loading && !error && tab === "wc" && (
          <VenuesCitySection items={venues} setItems={setVenues} persist={persistVenues} eventFilter="wc" />
        )}
        {!loading && !error && tab === "providers" && (
          <ProveedoresSection
            items={proveedores} setItems={setProveedores} persist={persistProveedores} />
        )}
      </div>
    </div>
  );
}
