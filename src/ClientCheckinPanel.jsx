import React, { useEffect, useState } from "react";
import { fetchKickoffById, updateKickoffInSheet } from "./sheetServices";
import { supabase } from "./supabaseClient.js";

const GAS_URL = import.meta.env.VITE_GAS_URL;

const CITY_NAMES = {
  CTG: "Cartagena", MDE: "Medellín", CDMX: "Ciudad de México",
  TUL: "Tulum", BOG: "Bogotá", CAB: "Los Cabos",
};

function cityLabel(code) {
  if (!code) return "";
  return String(code).split(",").map(c => CITY_NAMES[c.trim().toUpperCase()] || c.trim()).filter(Boolean).join(" · ");
}

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

function fmtTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Shared styles ──────────────────────────────────────────────────────────────
const card = {
  background: "#fff", border: "1px solid #e8e3db",
  borderRadius: 14, padding: 20,
};

const inp = {
  display: "block", width: "100%", border: "1px solid #ddd7cf",
  borderRadius: 10, padding: "10px 14px", fontSize: 14,
  fontFamily: "inherit", background: "#fff", color: "#1a1814",
  outline: "none", boxSizing: "border-box",
};

const inpFocus = {
  border: "1.5px solid #9a7d52",
};

const lbl = {
  display: "block", fontSize: 10, fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: "#8a8279", marginBottom: 5,
};

const sel = {
  ...inp, appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%238a8279' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
  paddingRight: 32,
};

const gold = "#9a7d52";

// ── Focusable input ────────────────────────────────────────────────────────────
function Field({ label, children, hint, half }) {
  return (
    <div style={half ? {} : {}}>
      {label && <label style={lbl}>{label}</label>}
      {children}
      {hint && <p style={{ fontSize: 11, color: "#aaa49e", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function FInput({ value, onChange, type = "text", placeholder = "", required, style = {} }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={{ ...inp, ...(focused ? inpFocus : {}), ...style }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    />
  );
}

function FTextarea({ value, onChange, rows = 3, placeholder = "" }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      value={value} onChange={onChange} rows={rows} placeholder={placeholder}
      style={{ ...inp, resize: "vertical", ...(focused ? inpFocus : {}) }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    />
  );
}

function FSelect({ value, onChange, children }) {
  const [focused, setFocused] = useState(false);
  return (
    <select value={value} onChange={onChange}
      style={{ ...sel, ...(focused ? inpFocus : {}) }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {children}
    </select>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────
function Section({ icon, title, subtitle, children }) {
  return (
    <div style={card}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1a1814", display: "flex", alignItems: "center", gap: 7 }}>
          <span>{icon}</span> {title}
        </h3>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8a8279" }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Grid2({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {children}
    </div>
  );
}

// ── Empty / Loading / Success screens ─────────────────────────────────────────
function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ef" }}>
      <div style={{ width: 36, height: 2, background: gold, borderRadius: 2, animation: "tt-pulse 1.2s ease-in-out infinite" }} />
      <style>{`@keyframes tt-pulse{0%,100%{opacity:.3}50%{opacity:1}}`}</style>
    </div>
  );
}

function EmptyState({ lang }) {
  const en = lang === "en";
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f4ef" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✈️</div>
        <p style={{ color: "#8a8279", fontSize: 14 }}>
          {en ? "No trip found. Check your link." : "No se encontró el viaje. Revisa tu link."}
        </p>
      </div>
    </div>
  );
}

function SuccessScreen({ lang, form, kickoff, onReset }) {
  const en = lang === "en";
  return (
    <div style={{ minHeight: "100vh", background: "#f7f4ef" }}>
      <header style={{ background: "#1a1814", height: 56, display: "flex", alignItems: "center", padding: "0 24px" }}>
        <img src="/logo.png" alt="Two Travel" style={{ height: 20, filter: "brightness(0) invert(1)", opacity: 0.85 }} />
      </header>
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f0ebe2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px" }}>✅</div>
        <h2 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 700, color: "#1a1814" }}>
          {en ? "All done!" : "¡Listo!"}
        </h2>
        <p style={{ color: "#8a8279", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
          {en
            ? "Your info has been received. We'll have everything ready for your arrival."
            : "Tu información fue recibida. Tendremos todo listo para tu llegada."}
        </p>
        {kickoff?.guestName && (
          <p style={{ fontSize: 13, color: "#b9a98d", marginBottom: 28 }}>
            {kickoff.guestName} · {cityLabel(kickoff.city)}
          </p>
        )}
        <button onClick={onReset}
          style={{ fontSize: 13, color: gold, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
          {en ? "Add another person" : "Agregar otra persona"}
        </button>
      </div>
    </div>
  );
}

// ── Trip info sidebar ──────────────────────────────────────────────────────────
function TripInfoSidebar({ kickoff, lang }) {
  const en = lang === "en";

  const concierge = kickoff.assignedConcierge || kickoff.assignedConciergeName || kickoff.concierge || "";
  const arrival   = kickoff.arrivalDate   || kickoff.checkIn   || "";
  const departure = kickoff.departureDate || kickoff.checkOut  || "";
  const pax       = kickoff.pax           || kickoff.guests    || "";
  const city      = cityLabel(kickoff.city);

  // Count submitted check-ins
  let checkinCount = 0;
  try { checkinCount = JSON.parse(kickoff.checkInResponses || "[]").length; } catch {}

  // Parse itinerary from kickoff if present
  let itinerary = [];
  try {
    const raw = kickoff.itinerary || kickoff.services || "";
    if (raw) {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      itinerary = Array.isArray(parsed) ? parsed.filter(s => s.confirmed || s.status === "confirmed" || s.servicesStatus === "Confirmed").slice(0, 8) : [];
    }
  } catch {}

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Trip card */}
      <div style={{ ...card, background: "#1a1814", border: "none" }}>
        <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>
          {en ? "Your Trip" : "Tu Viaje"}
        </p>
        <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: "#fff", lineHeight: 1.2 }}>
          {kickoff.tripName || kickoff.guestName || (en ? "Curated Experience" : "Experiencia Curated")}
        </h2>
        {city && (
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.55)", fontWeight: 500 }}>
            📍 {city}
          </p>
        )}
      </div>

      {/* Details */}
      <div style={card}>
        <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8a8279" }}>
          {en ? "Trip Details" : "Detalles del Viaje"}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {arrival && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#8a8279" }}>{en ? "Arrival" : "Llegada"}</span>
              <span style={{ fontWeight: 600, color: "#1a1814" }}>{fmtDate(arrival)}</span>
            </div>
          )}
          {departure && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#8a8279" }}>{en ? "Departure" : "Salida"}</span>
              <span style={{ fontWeight: 600, color: "#1a1814" }}>{fmtDate(departure)}</span>
            </div>
          )}
          {pax && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#8a8279" }}>{en ? "Guests" : "Personas"}</span>
              <span style={{ fontWeight: 600, color: "#1a1814" }}>{pax}</span>
            </div>
          )}
          {concierge && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "#8a8279" }}>Concierge</span>
              <span style={{ fontWeight: 600, color: "#1a1814" }}>{concierge.split(",")[0].trim()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Check-in progress */}
      <div style={{ ...card, background: checkinCount > 0 ? "#f0fdf4" : "#fffbf0", border: `1px solid ${checkinCount > 0 ? "#bbf7d0" : "#fde68a"}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>{checkinCount > 0 ? "✅" : "📋"}</span>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1a1814" }}>
              {checkinCount > 0
                ? (en ? `${checkinCount} ${checkinCount === 1 ? "person" : "people"} checked in` : `${checkinCount} ${checkinCount === 1 ? "persona" : "personas"} registrada${checkinCount === 1 ? "" : "s"}`)
                : (en ? "No check-ins yet" : "Sin registros aún")}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8a8279" }}>
              {en
                ? pax ? `${checkinCount} of ${pax} guests` : "Fill the form to register"
                : pax ? `${checkinCount} de ${pax} personas` : "Completa el formulario para registrarte"}
            </p>
          </div>
        </div>
      </div>

      {/* Confirmed services */}
      {itinerary.length > 0 && (
        <div style={card}>
          <p style={{ margin: "0 0 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#8a8279" }}>
            {en ? "Confirmed Services" : "Servicios Confirmados"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {itinerary.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ fontSize: 11, color: "#22c55e", marginTop: 2 }}>✓</span>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1814" }}>{s.name || s.title || s.service}</p>
                  {(s.date || s.time) && (
                    <p style={{ margin: 0, fontSize: 11, color: "#8a8279" }}>{[s.date, s.time].filter(Boolean).join(" · ")}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions card */}
      <div style={{ ...card, background: "#faf8f5", border: "1px solid #e8e3db" }}>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: gold }}>
          {en ? "How it works" : "Cómo funciona"}
        </p>
        <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: "#6b6560", lineHeight: 1.7 }}>
          <li>{en ? "Each guest fills this form individually." : "Cada persona del grupo llena este formulario individualmente."}</li>
          <li>{en ? "Share this link with your whole group." : "Comparte este link con todo tu grupo."}</li>
          <li>{en ? "We'll have everything ready for your arrival." : "Tendremos todo listo para su llegada."}</li>
        </ul>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ClientCheckinPanel() {
  const params    = new URLSearchParams(window.location.search);
  const kickoffId = params.get("kickoffId") || params.get("k") || "";
  const [lang, setLang] = useState(params.get("lang") === "es" ? "es" : "en");
  const en = lang === "en";

  const [kickoff,  setKickoff]  = useState(null);
  const [loading,  setLoading]  = useState(!!kickoffId);
  const [step,     setStep]     = useState(0);
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState("");

  const emptyForm = () => ({
    firstName: "", lastName: "", email: "", phone: "",
    idType: "Passport", idNumber: "", dob: "", nationality: "", gender: "",
    arrivalDate: "", arrivalFlight: "", arrivalTime: "",
    domesticDate: "", domesticFlight: "", domesticTime: "",
    departureDate: "", departureFlight: "", departureTime: "",
    foodRestrictions: "", allergies: "", occasion: "", notes: "",
    photoPermission: "yes",
  });
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (!kickoffId) { setLoading(false); return; }
    fetchKickoffById(kickoffId)
      .then(k => { if (k) setKickoff(k); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kickoffId]);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const isMultiCity = kickoff && String(kickoff.city || "").includes(",");

  const submit = async () => {
    setError("");
    if (!form.firstName.trim()) { setError(en ? "First name is required." : "El nombre es requerido."); return; }
    if (!form.lastName.trim())  { setError(en ? "Last name is required." : "El apellido es requerido."); return; }
    if (!form.idNumber.trim())  { setError(en ? "ID number is required." : "El número de ID es requerido."); return; }
    if (!form.foodRestrictions.trim()) { setError(en ? "Food restrictions required (write 'None' if none)." : "Restricciones alimentarias requeridas (escribe 'Ninguna')."); return; }
    if (!form.allergies.trim())        { setError(en ? "Allergies required (write 'None' if none)." : "Alergias requeridas (escribe 'Ninguna')."); return; }
    if (!form.arrivalFlight.trim())    { setError(en ? "Arrival flight number required." : "Número de vuelo de llegada requerido."); return; }
    if (!form.arrivalDate)             { setError(en ? "Arrival date required." : "Fecha de llegada requerida."); return; }
    if (!form.arrivalTime)             { setError(en ? "Arrival time required." : "Hora de llegada requerida."); return; }
    if (!form.departureFlight.trim())  { setError(en ? "Departure flight number required." : "Número de vuelo de salida requerido."); return; }
    if (!form.departureDate)           { setError(en ? "Departure date required." : "Fecha de salida requerida."); return; }
    if (!form.departureTime)           { setError(en ? "Departure time required." : "Hora de salida requerida."); return; }

    setSending(true);
    try {
      const res = await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "saveCheckinResponse", payload: { kickoffId, response: { ...form, submittedAt: new Date().toISOString() } } }),
      });
      const data = await res.json();
      if (data.ok) {
        // Write back passport/diet/flight info to kickoff
        if (kickoffId) {
          const personName = `${form.firstName} ${form.lastName}`.trim();
          const passportParts = [
            form.idType && form.idNumber ? `${form.idType}: ${form.idNumber}` : "",
            form.dob        ? `DOB: ${form.dob}` : "",
            form.nationality ? `Nat: ${form.nationality}` : "",
          ].filter(Boolean);

          let freshKickoff = null;
          try { freshKickoff = await fetchKickoffById(kickoffId); } catch {}
          const lk = freshKickoff || kickoff;
          const updates = {};

          // Passport
          const thisPassport = [personName, ...passportParts].filter(Boolean).join(" · ");
          if (thisPassport) {
            const lines = (lk?.passportInfo || "").split("\n").filter(Boolean);
            const idx = lines.findIndex(l => l.startsWith(personName + " ·") || l.startsWith(personName + ":") || l === personName);
            if (idx >= 0) lines[idx] = thisPassport; else lines.push(thisPassport);
            updates.passportInfo = lines.join("\n");
          }

          // Diet
          const thisDiet = [form.foodRestrictions, form.allergies].filter(Boolean).join(" / ");
          if (thisDiet) {
            const parts  = (lk?.dietInfo || "").split(" / ").filter(Boolean);
            const prefix = `${personName}: `;
            const dIdx   = parts.findIndex(p => p.startsWith(prefix));
            const entry  = `${personName}: ${thisDiet}`;
            if (dIdx >= 0) parts[dIdx] = entry; else parts.push(entry);
            updates.dietInfo = parts.join(" / ");
          }

          if (form.foodRestrictions) updates.foodRestrictions = form.foodRestrictions;
          if (form.allergies)        updates.allergies        = form.allergies;

          // Arrivals
          if (form.arrivalFlight || form.arrivalTime) {
            let arr = [];
            try { arr = JSON.parse(lk?.arrivals || "[]"); } catch {}
            const e = { flightNumber: form.arrivalFlight, date: form.arrivalDate, time: fmtTime12(form.arrivalTime), name: personName };
            const i2 = arr.findIndex(f => f.flightNumber === form.arrivalFlight);
            if (i2 >= 0) arr[i2] = { ...arr[i2], ...e }; else arr.push(e);
            updates.arrivals = JSON.stringify(arr);
          }

          // Departures
          if (form.departureFlight || form.departureTime) {
            let dep = [];
            try { dep = JSON.parse(lk?.departures || "[]"); } catch {}
            const e = { flightNumber: form.departureFlight, date: form.departureDate, time: fmtTime12(form.departureTime), name: personName };
            const i2 = dep.findIndex(f => f.flightNumber === form.departureFlight);
            if (i2 >= 0) dep[i2] = { ...dep[i2], ...e }; else dep.push(e);
            updates.departures = JSON.stringify(dep);
          }

          // Accumulate checkInResponses
          const thisResp = { ...form, submittedAt: new Date().toISOString() };
          let resps = [];
          try { resps = JSON.parse(lk?.checkInResponses || "[]"); } catch {}
          const ri = resps.findIndex(r => r.firstName === form.firstName && r.lastName === form.lastName);
          if (ri >= 0) resps[ri] = thisResp; else resps.push(thisResp);
          updates.checkInResponses = JSON.stringify(resps);

          if (Object.keys(updates).length) {
            updateKickoffInSheet(kickoffId, updates).catch(() => {});
            fetch(GAS_URL, {
              method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
              body: JSON.stringify({ action: "updateKickoff", id: kickoffId, updates }),
            }).catch(() => {});
          }
        }
        setStep(1);
      } else {
        setError(en ? "Something went wrong. Please try again." : "Algo salió mal. Intenta de nuevo.");
      }
    } catch {
      setError(en ? "Connection error. Please try again." : "Error de conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  };

  if (!kickoffId) return <EmptyState lang={lang} />;
  if (loading)    return <Loading />;
  if (step === 1) return <SuccessScreen lang={lang} form={form} kickoff={kickoff} onReset={() => { setStep(0); setForm(emptyForm()); }} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f4ef", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* ── Header ── */}
      <header style={{ background: "#1a1814", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", position: "sticky", top: 0, zIndex: 50, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logo.png" alt="Two Travel" style={{ height: 19, filter: "brightness(0) invert(1)", opacity: 0.85 }} />
          <span style={{ color: "rgba(255,255,255,.25)", fontSize: 14 }}>·</span>
          <span style={{ fontSize: 13, color: "rgba(255,255,255,.65)", fontWeight: 500 }}>
            {kickoff ? (kickoff.guestName || kickoff.tripName || "Pre Check-in") : "Pre Check-in"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.35)" }}>
            {en ? "Pre Check-in Form" : "Formulario Pre Check-in"}
          </span>
          <button onClick={() => setLang(en ? "es" : "en")}
            style={{ fontSize: 11, color: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 20, padding: "4px 11px", background: "none", cursor: "pointer" }}>
            {en ? "ES" : "EN"}
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 24px 80px", display: "grid", gridTemplateColumns: "320px 1fr", gap: 24, alignItems: "start" }}>

        {/* ── LEFT: Trip info sidebar ── */}
        {kickoff ? <TripInfoSidebar kickoff={kickoff} lang={lang} /> : <div />}

        {/* ── RIGHT: Check-in form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Title */}
          <div style={{ marginBottom: 4 }}>
            <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "#1a1814" }}>
              {en ? "Pre Check-in Form" : "Formulario Pre Check-in"}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#8a8279", lineHeight: 1.5 }}>
              {en
                ? "Share this link with your whole group. Each person should fill it out individually — it takes just 2 minutes."
                : "Comparte este link con todo tu grupo. Cada persona lo llena individualmente — toma solo 2 minutos."}
            </p>
          </div>

          {/* 1. Personal Info */}
          <Section icon="🪪" title={en ? "Personal Info" : "Información Personal"}>
            <Grid2>
              <Field label={en ? "First name *" : "Nombre *"}>
                <FInput value={form.firstName} onChange={set("firstName")} placeholder={en ? "First name" : "Nombre"} />
              </Field>
              <Field label={en ? "Last name *" : "Apellido *"}>
                <FInput value={form.lastName} onChange={set("lastName")} placeholder={en ? "Last name" : "Apellido"} />
              </Field>
            </Grid2>
            <Grid2>
              <Field label={en ? "Email" : "Correo electrónico"}>
                <FInput type="email" value={form.email} onChange={set("email")} placeholder="email@example.com" />
              </Field>
              <Field label={en ? "Mobile / WhatsApp" : "Celular / WhatsApp"}>
                <FInput type="tel" value={form.phone} onChange={set("phone")} placeholder="+1 305 000 0000" />
              </Field>
            </Grid2>
            <Grid2>
              <Field label={en ? "ID Type *" : "Tipo de ID *"}>
                <FSelect value={form.idType} onChange={set("idType")}>
                  <option value="Passport">{en ? "Passport" : "Pasaporte"}</option>
                  <option value="ID Card">{en ? "ID Card" : "Cédula"}</option>
                </FSelect>
              </Field>
              <Field label={en ? "ID Number *" : "Número de ID *"}>
                <FInput value={form.idNumber} onChange={set("idNumber")} placeholder="AB123456" />
              </Field>
            </Grid2>
            <Grid2>
              <Field label={en ? "Date of birth" : "Fecha de nacimiento"}>
                <FInput type="date" value={form.dob} onChange={set("dob")} />
              </Field>
              <Field label={en ? "Gender" : "Género"}>
                <FSelect value={form.gender} onChange={set("gender")}>
                  <option value="">{en ? "Select…" : "Seleccionar…"}</option>
                  <option value="Male">{en ? "Male" : "Masculino"}</option>
                  <option value="Female">{en ? "Female" : "Femenino"}</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">{en ? "Prefer not to say" : "Prefiero no decir"}</option>
                </FSelect>
              </Field>
            </Grid2>
            <Field label={en ? "Nationality" : "Nacionalidad"}>
              <FInput value={form.nationality} onChange={set("nationality")} placeholder={en ? "e.g. American, Colombian…" : "ej. Colombiano, Americano…"} />
            </Field>
          </Section>

          {/* 2. Food & Health */}
          <Section icon="🥗" title={en ? "Food & Health" : "Alimentación y Salud"}
            subtitle={en ? "So we can personalize every meal and experience." : "Para personalizar cada comida y experiencia."}>
            <Field label={en ? "Food restrictions *" : "Restricciones alimentarias *"}
              hint={en ? "Gluten-free, vegan, kosher… or write 'None'." : "Sin gluten, vegano, kosher… o escribe 'Ninguna'."}>
              <FTextarea value={form.foodRestrictions} onChange={set("foodRestrictions")} rows={2}
                placeholder={en ? "Gluten-free, vegan, kosher… or None" : "Sin gluten, vegano, kosher… o Ninguna"} />
            </Field>
            <Field label={en ? "Allergies / Medical conditions *" : "Alergias / Condiciones médicas *"}
              hint={en ? "Nut allergy, asthma… or write 'None'." : "Alergia a nueces, asma… o escribe 'Ninguna'."}>
              <FTextarea value={form.allergies} onChange={set("allergies")} rows={2}
                placeholder={en ? "Nut allergy, asthma… or None" : "Alergia a nueces, asma… o Ninguna"} />
            </Field>
          </Section>

          {/* 3. Arrival Flight */}
          <Section icon="🛬" title={en ? "Arrival Flight" : "Vuelo de Llegada"}>
            <Field label={en ? "Flight code *" : "Código de vuelo *"}
              hint={en ? "Full code, e.g. AV204, AA2173." : "Código completo, ej. AV204, AA2173."}>
              <FInput value={form.arrivalFlight} onChange={set("arrivalFlight")} placeholder="AV204, AA2173…" />
            </Field>
            <Grid2>
              <Field label={en ? "Arrival date *" : "Fecha de llegada *"}>
                <FInput type="date" value={form.arrivalDate} onChange={set("arrivalDate")} />
              </Field>
              <Field label={en ? "Arrival time *" : "Hora de llegada *"}>
                <FInput type="time" value={form.arrivalTime} onChange={set("arrivalTime")} />
              </Field>
            </Grid2>
          </Section>

          {/* 3b. Domestic Flight (multi-city only) */}
          {isMultiCity && (
            <Section icon="✈️" title={en ? "Domestic / Connecting Flight" : "Vuelo Doméstico / Conexión"}
              subtitle={en ? "If you have a connecting flight between cities." : "Si tienes un vuelo de conexión entre ciudades."}>
              <Field label={en ? "Flight code" : "Código de vuelo"}>
                <FInput value={form.domesticFlight} onChange={set("domesticFlight")} placeholder="AV8501, AV204…" />
              </Field>
              <Grid2>
                <Field label={en ? "Date" : "Fecha"}>
                  <FInput type="date" value={form.domesticDate} onChange={set("domesticDate")} />
                </Field>
                <Field label={en ? "Time" : "Hora"}>
                  <FInput type="time" value={form.domesticTime} onChange={set("domesticTime")} />
                </Field>
              </Grid2>
            </Section>
          )}

          {/* 4. Departure Flight */}
          <Section icon="🛫" title={en ? "Departure Flight" : "Vuelo de Salida"}>
            <Field label={en ? "Flight code *" : "Código de vuelo *"}
              hint={en ? "Full code, e.g. AV205, AA2174." : "Código completo, ej. AV205, AA2174."}>
              <FInput value={form.departureFlight} onChange={set("departureFlight")} placeholder="AV205, AA2174…" />
            </Field>
            <Grid2>
              <Field label={en ? "Departure date *" : "Fecha de salida *"}>
                <FInput type="date" value={form.departureDate} onChange={set("departureDate")} />
              </Field>
              <Field label={en ? "Departure time *" : "Hora de salida *"}>
                <FInput type="time" value={form.departureTime} onChange={set("departureTime")} />
              </Field>
            </Grid2>
          </Section>

          {/* 5. Additional */}
          <Section icon="✨" title={en ? "A Little More" : "Un Poco Más"}
            subtitle={en ? "Optional — helps us personalize your experience." : "Opcional — nos ayuda a personalizar tu experiencia."}>
            <Field label={en ? "Occasion" : "Ocasión"}>
              <FSelect value={form.occasion} onChange={set("occasion")}>
                <option value="">{en ? "Select if applicable…" : "Seleccionar si aplica…"}</option>
                {["Anniversary", "Bachelor/Bachelorette", "Birthday", "Family", "Friends Trip", "Just because!"].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </FSelect>
            </Field>
            <Field label={en ? "Anything else we should know?" : "¿Algo más que debamos saber?"}>
              <FTextarea value={form.notes} onChange={set("notes")} rows={3}
                placeholder={en ? "Special requests, preferences, surprises you're planning…" : "Solicitudes especiales, preferencias, sorpresas que tengas planeadas…"} />
            </Field>
            <Field label={en ? "Photo permission" : "Permiso de fotos"}>
              <FSelect value={form.photoPermission} onChange={set("photoPermission")}>
                <option value="yes">{en ? "Yes, you can share photos of me" : "Sí, pueden compartir fotos mías"}</option>
                <option value="no">{en ? "No, please keep photos private" : "No, prefiero que las fotos sean privadas"}</option>
              </FSelect>
            </Field>
          </Section>

          {/* Error */}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#b91c1c" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={submit} disabled={sending}
            style={{ background: sending ? "#ccc" : "#1a1814", color: "#fff", border: "none", borderRadius: 12, padding: "15px 24px", fontSize: 15, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", width: "100%", fontFamily: "inherit", transition: "background .15s" }}>
            {sending
              ? (en ? "Sending…" : "Enviando…")
              : (en ? "Submit Check-in" : "Enviar Check-in")}
          </button>

          <p style={{ textAlign: "center", fontSize: 11, color: "#aaa49e", margin: 0 }}>
            {en ? "Each person in your group fills this out individually." : "Cada persona del grupo lo llena individualmente."}
          </p>
        </div>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 320px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
