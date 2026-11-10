import React, { useEffect, useState } from "react";
import { fetchKickoffById, updateKickoffInSheet } from "./sheetServices";

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
  try { return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return d; }
}

function fmtTime12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h)) return t;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Shared form field styles — matching internal panel ─────────────────────────
const S = {
  inp: {
    width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius)",
    padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "var(--surface)",
    color: "var(--text-1)", outline: "none", boxSizing: "border-box", transition: "border-color .12s",
  },
  lbl: {
    display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-3)",
    letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4,
  },
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  hint: { fontSize: 11, color: "var(--text-3)", marginTop: 3 },
};

function FInput({ value, onChange, type = "text", placeholder = "" }) {
  const [f, setF] = useState(false);
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ ...S.inp, borderColor: f ? "#111" : "var(--border)" }}
      onFocus={() => setF(true)} onBlur={() => setF(false)} />
  );
}

function FTextarea({ value, onChange, rows = 3, placeholder = "" }) {
  const [f, setF] = useState(false);
  return (
    <textarea value={value} onChange={onChange} rows={rows} placeholder={placeholder}
      style={{ ...S.inp, resize: "vertical", borderColor: f ? "#111" : "var(--border)" }}
      onFocus={() => setF(true)} onBlur={() => setF(false)} />
  );
}

function FSelect({ value, onChange, children }) {
  const [f, setF] = useState(false);
  return (
    <select value={value} onChange={onChange}
      style={{
        ...S.inp,
        appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239A9A9A' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28,
        borderColor: f ? "#111" : "var(--border)",
      }}
      onFocus={() => setF(true)} onBlur={() => setF(false)}>
      {children}
    </select>
  );
}

function FormSection({ title, children }) {
  return (
    <div className="tt-card" style={{ padding: "16px 18px" }}>
      <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 600, color: "var(--text-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>
        {title}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, gap: 12 }}>
      <span style={{ color: "var(--text-3)", flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, color: "var(--text-1)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

// ── Empty / Loading / Success ──────────────────────────────────────────────────
function Loading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div style={{ width: 36, height: 2, background: "#111", borderRadius: 2, animation: "ccp-pulse 1.1s ease-in-out infinite" }} />
      <style>{`@keyframes ccp-pulse{0%,100%{opacity:.15}50%{opacity:.8}}`}</style>
    </div>
  );
}

function EmptyState({ lang }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="tt-card" style={{ padding: "32px 40px", textAlign: "center", maxWidth: 360 }}>
        <p style={{ fontSize: 32, margin: "0 0 10px" }}>✈️</p>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-1)", margin: "0 0 6px" }}>
          {lang === "es" ? "Viaje no encontrado" : "Trip not found"}
        </p>
        <p style={{ fontSize: 12.5, color: "var(--text-3)", margin: 0 }}>
          {lang === "es" ? "Revisa el link que te enviaron." : "Check the link you received."}
        </p>
      </div>
    </div>
  );
}

function SuccessScreen({ lang, kickoff, onReset }) {
  const es = lang === "es";
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header className="tt-topbar">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
          {kickoff?.guestName || "Check-In"}
        </span>
      </header>
      <div style={{ maxWidth: 440, margin: "80px auto 0", padding: "0 24px", textAlign: "center" }}>
        <div className="tt-card" style={{ padding: "36px 32px" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>✅</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "var(--text-1)" }}>
            {es ? "¡Listo!" : "All done!"}
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
            {es
              ? "Tu información fue recibida. Tendremos todo listo para tu llegada."
              : "Your info has been received. We'll have everything ready for your arrival."}
          </p>
          {kickoff?.guestName && (
            <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
              {kickoff.guestName}  ·  {cityLabel(kickoff.city)}
            </p>
          )}
          <button onClick={onReset} className="tt-btn-ghost" style={{ width: "100%" }}>
            {es ? "+ Agregar otra persona" : "+ Add another person"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trip info left panel ───────────────────────────────────────────────────────
function TripPanel({ kickoff, lang }) {
  const es = lang === "es";
  const city      = cityLabel(kickoff.city);
  const concierge = kickoff.assignedConcierge || kickoff.concierge || "";
  const arrival   = kickoff.arrivalDate   || kickoff.checkIn   || "";
  const departure = kickoff.departureDate || kickoff.checkOut  || "";
  const pax       = kickoff.pax || kickoff.guests || "";

  let checkinCount = 0;
  try { checkinCount = JSON.parse(kickoff.checkInResponses || "[]").length; } catch {}

  const checkinDone = checkinCount > 0 && pax && checkinCount >= Number(pax);
  const checkinPart = checkinCount > 0 && !checkinDone;

  let services = [];
  try {
    const raw = kickoff.itinerary || kickoff.services || "";
    if (raw) {
      const p = typeof raw === "string" ? JSON.parse(raw) : raw;
      services = Array.isArray(p)
        ? p.filter(s => s.confirmed || s.status === "confirmed" || s.servicesStatus === "Confirmed").slice(0, 7)
        : [];
    }
  } catch {}

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>

      {/* Trip hero */}
      <div className="tt-card" style={{ padding: "16px 18px", background: "#111", border: "none" }}>
        <p style={{ margin: "0 0 3px", fontSize: 10, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.4)" }}>
          {es ? "Tu viaje" : "Your Trip"}
        </p>
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: "#fff", lineHeight: 1.25 }}>
          {kickoff.tripName || kickoff.guestName || (es ? "Experiencia Two Travel" : "Two Travel Experience")}
        </h2>
        {city && <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,.5)" }}>📍 {city}</p>}
      </div>

      {/* Trip details */}
      <div className="tt-card" style={{ padding: "14px 16px" }}>
        <p style={{ ...S.lbl, margin: "0 0 10px" }}>{es ? "Detalles" : "Details"}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <InfoRow label={es ? "Llegada"   : "Arrival"}   value={fmtDate(arrival)} />
          <InfoRow label={es ? "Salida"    : "Departure"} value={fmtDate(departure)} />
          <InfoRow label={es ? "Personas"  : "Guests"}    value={pax ? String(pax) : ""} />
          <InfoRow label="Concierge"                       value={concierge.split(",")[0]?.trim() || ""} />
        </div>
      </div>

      {/* Check-in progress badge */}
      <div className="tt-card" style={{
        padding: "12px 16px",
        background: checkinDone ? "#f0fdf4" : checkinPart ? "#fffbf0" : "var(--surface)",
        borderColor: checkinDone ? "#bbf7d0" : checkinPart ? "#fde68a" : "var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>{checkinDone ? "✅" : checkinPart ? "🟡" : "📋"}</span>
          <div>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--text-1)" }}>
              {checkinDone
                ? (es ? "Todos registrados" : "All checked in")
                : checkinPart
                  ? (es ? `${checkinCount}/${pax} registrados` : `${checkinCount}/${pax} checked in`)
                  : (es ? "Sin registros aún" : "No check-ins yet")}
            </p>
            <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--text-3)" }}>
              {es ? "Cada persona llena este formulario" : "Each person fills this form individually"}
            </p>
          </div>
        </div>
      </div>

      {/* Confirmed services */}
      {services.length > 0 && (
        <div className="tt-card" style={{ padding: "14px 16px" }}>
          <p style={{ ...S.lbl, margin: "0 0 10px" }}>{es ? "Servicios Confirmados" : "Confirmed Services"}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {services.map((sv, i) => (
              <div key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, color: "#16a34a", marginTop: 2, flexShrink: 0 }}>✓</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: "var(--text-1)" }}>{sv.name || sv.title || sv.service}</p>
                  {(sv.date || sv.time) && <p style={{ margin: 0, fontSize: 11, color: "var(--text-3)" }}>{[sv.date, sv.time].filter(Boolean).join(" · ")}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="tt-card" style={{ padding: "14px 16px", background: "var(--bg)" }}>
        <p style={{ ...S.lbl, margin: "0 0 8px" }}>{es ? "Cómo funciona" : "How it works"}</p>
        <ul style={{ margin: 0, padding: "0 0 0 15px", fontSize: 12, color: "var(--text-2)", lineHeight: 1.75 }}>
          <li>{es ? "Comparte este link con tu grupo." : "Share this link with your whole group."}</li>
          <li>{es ? "Cada persona lo llena por separado." : "Each person fills it out individually."}</li>
          <li>{es ? "Listo en 2 minutos." : "Done in 2 minutes."}</li>
        </ul>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ClientCheckinPanel() {
  const params    = new URLSearchParams(window.location.search);
  const kickoffId = params.get("kickoffId") || params.get("k") || "";
  const [lang, setLang] = useState(params.get("lang") === "es" ? "es" : "en");
  const es = lang === "es";

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
    const req = (val, msg) => { if (!String(val || "").trim()) { setError(msg); return true; } };
    if (req(form.firstName, es ? "El nombre es requerido." : "First name required.")) return;
    if (req(form.lastName,  es ? "El apellido es requerido." : "Last name required.")) return;
    if (req(form.idNumber,  es ? "El número de ID es requerido." : "ID number required.")) return;
    if (req(form.foodRestrictions, es ? "Restricciones alimentarias requeridas (escribe 'Ninguna')." : "Food restrictions required (write 'None').")) return;
    if (req(form.allergies,        es ? "Alergias requeridas (escribe 'Ninguna')." : "Allergies required (write 'None').")) return;
    if (req(form.arrivalFlight,    es ? "Vuelo de llegada requerido." : "Arrival flight required.")) return;
    if (!form.arrivalDate) { setError(es ? "Fecha de llegada requerida." : "Arrival date required."); return; }
    if (!form.arrivalTime) { setError(es ? "Hora de llegada requerida." : "Arrival time required."); return; }
    if (req(form.departureFlight, es ? "Vuelo de salida requerido." : "Departure flight required.")) return;
    if (!form.departureDate) { setError(es ? "Fecha de salida requerida." : "Departure date required."); return; }
    if (!form.departureTime) { setError(es ? "Hora de salida requerida." : "Departure time required."); return; }

    setSending(true);
    try {
      const res  = await fetch(GAS_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "saveCheckinResponse", payload: { kickoffId, response: { ...form, submittedAt: new Date().toISOString() } } }),
      });
      const data = await res.json();
      if (data.ok) {
        if (kickoffId) {
          const personName = `${form.firstName} ${form.lastName}`.trim();
          let lk = null;
          try { lk = await fetchKickoffById(kickoffId); } catch {}
          lk = lk || kickoff;
          const updates = {};

          const passportParts = [
            form.idType && form.idNumber ? `${form.idType}: ${form.idNumber}` : "",
            form.dob         ? `DOB: ${form.dob}` : "",
            form.nationality ? `Nat: ${form.nationality}` : "",
          ].filter(Boolean);
          const thisPassport = [personName, ...passportParts].filter(Boolean).join(" · ");
          if (thisPassport) {
            const lines = (lk?.passportInfo || "").split("\n").filter(Boolean);
            const idx   = lines.findIndex(l => l.startsWith(personName + " ·") || l === personName);
            if (idx >= 0) lines[idx] = thisPassport; else lines.push(thisPassport);
            updates.passportInfo = lines.join("\n");
          }

          const thisDiet = [form.foodRestrictions, form.allergies].filter(Boolean).join(" / ");
          if (thisDiet) {
            const parts  = (lk?.dietInfo || "").split(" / ").filter(Boolean);
            const prefix = `${personName}: `;
            const dIdx   = parts.findIndex(p => p.startsWith(prefix));
            if (dIdx >= 0) parts[dIdx] = `${prefix}${thisDiet}`; else parts.push(`${prefix}${thisDiet}`);
            updates.dietInfo = parts.join(" / ");
          }
          if (form.foodRestrictions) updates.foodRestrictions = form.foodRestrictions;
          if (form.allergies)        updates.allergies        = form.allergies;

          const addFlight = (field, flightNo, date, time) => {
            if (!flightNo && !time) return;
            let arr = [];
            try { arr = JSON.parse(lk?.[field] || "[]"); } catch {}
            const e  = { flightNumber: flightNo, date, time: fmtTime12(time), name: personName };
            const i2 = arr.findIndex(x => x.flightNumber === flightNo);
            if (i2 >= 0) arr[i2] = { ...arr[i2], ...e }; else arr.push(e);
            updates[field] = JSON.stringify(arr);
          };
          addFlight("arrivals",   form.arrivalFlight,   form.arrivalDate,   form.arrivalTime);
          addFlight("departures", form.departureFlight, form.departureDate, form.departureTime);

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
        setError(es ? "Algo salió mal. Intenta de nuevo." : "Something went wrong. Try again.");
      }
    } catch {
      setError(es ? "Error de conexión. Intenta de nuevo." : "Connection error. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (!kickoffId) return <EmptyState lang={lang} />;
  if (loading)    return <Loading />;
  if (step === 1) return <SuccessScreen lang={lang} kickoff={kickoff} onReset={() => { setStep(0); setForm(emptyForm()); }} />;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>

      {/* ── Header — same tt-topbar as ConciergePanel ── */}
      <header className="tt-topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>
            {kickoff ? (kickoff.guestName || "Check-In") : "Check-In"}
          </span>
          {kickoff?.city && (
            <>
              <span style={{ color: "var(--border)", fontSize: 12 }}>·</span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>{cityLabel(kickoff.city)}</span>
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
            {es ? "Pre Check-in" : "Pre Check-in Form"}
          </span>
          <button onClick={() => setLang(es ? "en" : "es")} className="tt-btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}>
            {es ? "EN" : "ES"}
          </button>
        </div>
      </header>

      {/* ── 2-column layout ── */}
      <div id="ccp-grid" style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 24px 80px", display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

        {/* LEFT */}
        {kickoff ? <TripPanel kickoff={kickoff} lang={lang} /> : <div />}

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
              {es ? "Formulario Pre Check-in" : "Pre Check-in Form"}
            </h1>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--text-3)" }}>
              {es
                ? "Llena este formulario individualmente. Toma solo 2 minutos."
                : "Fill this out individually. It takes just 2 minutes."}
            </p>
          </div>

          {/* Personal Info */}
          <FormSection title={es ? "Información Personal" : "Personal Info"}>
            <div style={S.row2}>
              <div>
                <label style={S.lbl}>{es ? "Nombre *" : "First name *"}</label>
                <FInput value={form.firstName} onChange={set("firstName")} placeholder={es ? "Nombre" : "First name"} />
              </div>
              <div>
                <label style={S.lbl}>{es ? "Apellido *" : "Last name *"}</label>
                <FInput value={form.lastName} onChange={set("lastName")} placeholder={es ? "Apellido" : "Last name"} />
              </div>
            </div>
            <div style={S.row2}>
              <div>
                <label style={S.lbl}>{es ? "Correo" : "Email"}</label>
                <FInput type="email" value={form.email} onChange={set("email")} placeholder="email@example.com" />
              </div>
              <div>
                <label style={S.lbl}>{es ? "Celular / WhatsApp" : "Mobile / WhatsApp"}</label>
                <FInput type="tel" value={form.phone} onChange={set("phone")} placeholder="+1 305 000 0000" />
              </div>
            </div>
            <div style={S.row2}>
              <div>
                <label style={S.lbl}>{es ? "Tipo de ID *" : "ID Type *"}</label>
                <FSelect value={form.idType} onChange={set("idType")}>
                  <option value="Passport">{es ? "Pasaporte" : "Passport"}</option>
                  <option value="ID Card">{es ? "Cédula" : "ID Card"}</option>
                </FSelect>
              </div>
              <div>
                <label style={S.lbl}>{es ? "Número de ID *" : "ID Number *"}</label>
                <FInput value={form.idNumber} onChange={set("idNumber")} placeholder="AB123456" />
              </div>
            </div>
            <div style={S.row2}>
              <div>
                <label style={S.lbl}>{es ? "Fecha de nacimiento" : "Date of birth"}</label>
                <FInput type="date" value={form.dob} onChange={set("dob")} />
              </div>
              <div>
                <label style={S.lbl}>{es ? "Género" : "Gender"}</label>
                <FSelect value={form.gender} onChange={set("gender")}>
                  <option value="">{es ? "Seleccionar…" : "Select…"}</option>
                  <option value="Male">{es ? "Masculino" : "Male"}</option>
                  <option value="Female">{es ? "Femenino" : "Female"}</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">{es ? "Prefiero no decir" : "Prefer not to say"}</option>
                </FSelect>
              </div>
            </div>
            <div>
              <label style={S.lbl}>{es ? "Nacionalidad" : "Nationality"}</label>
              <FInput value={form.nationality} onChange={set("nationality")}
                placeholder={es ? "ej. Colombiano, Americano…" : "e.g. American, Colombian…"} />
            </div>
          </FormSection>

          {/* Food & Health */}
          <FormSection title={es ? "Alimentación y Salud" : "Food & Health"}>
            <div>
              <label style={S.lbl}>{es ? "Restricciones alimentarias *" : "Food restrictions *"}</label>
              <FTextarea value={form.foodRestrictions} onChange={set("foodRestrictions")} rows={2}
                placeholder={es ? "Sin gluten, vegano, kosher… o 'Ninguna'" : "Gluten-free, vegan, kosher… or 'None'"} />
              <p style={S.hint}>{es ? "Escribe 'Ninguna' si no tienes." : "Write 'None' if you don't have any."}</p>
            </div>
            <div>
              <label style={S.lbl}>{es ? "Alergias / Condiciones médicas *" : "Allergies / Medical conditions *"}</label>
              <FTextarea value={form.allergies} onChange={set("allergies")} rows={2}
                placeholder={es ? "Alergia a nueces, asma… o 'Ninguna'" : "Nut allergy, asthma… or 'None'"} />
              <p style={S.hint}>{es ? "Escribe 'Ninguna' si no tienes." : "Write 'None' if you don't have any."}</p>
            </div>
          </FormSection>

          {/* Arrival */}
          <FormSection title={es ? "Vuelo de Llegada" : "Arrival Flight"}>
            <div>
              <label style={S.lbl}>{es ? "Código de vuelo *" : "Flight code *"}</label>
              <FInput value={form.arrivalFlight} onChange={set("arrivalFlight")} placeholder="AV204, AA2173…" />
              <p style={S.hint}>{es ? "Código completo, ej. AV204, AA2173." : "Full code, e.g. AV204, AA2173."}</p>
            </div>
            <div style={S.row2}>
              <div>
                <label style={S.lbl}>{es ? "Fecha de llegada *" : "Arrival date *"}</label>
                <FInput type="date" value={form.arrivalDate} onChange={set("arrivalDate")} />
              </div>
              <div>
                <label style={S.lbl}>{es ? "Hora de llegada *" : "Arrival time *"}</label>
                <FInput type="time" value={form.arrivalTime} onChange={set("arrivalTime")} />
              </div>
            </div>
          </FormSection>

          {/* Domestic — multi-city only */}
          {isMultiCity && (
            <FormSection title={es ? "Vuelo Doméstico / Conexión" : "Domestic / Connecting Flight"}>
              <div>
                <label style={S.lbl}>{es ? "Código de vuelo" : "Flight code"}</label>
                <FInput value={form.domesticFlight} onChange={set("domesticFlight")} placeholder="AV8501…" />
              </div>
              <div style={S.row2}>
                <div>
                  <label style={S.lbl}>{es ? "Fecha" : "Date"}</label>
                  <FInput type="date" value={form.domesticDate} onChange={set("domesticDate")} />
                </div>
                <div>
                  <label style={S.lbl}>{es ? "Hora" : "Time"}</label>
                  <FInput type="time" value={form.domesticTime} onChange={set("domesticTime")} />
                </div>
              </div>
            </FormSection>
          )}

          {/* Departure */}
          <FormSection title={es ? "Vuelo de Salida" : "Departure Flight"}>
            <div>
              <label style={S.lbl}>{es ? "Código de vuelo *" : "Flight code *"}</label>
              <FInput value={form.departureFlight} onChange={set("departureFlight")} placeholder="AV205, AA2174…" />
              <p style={S.hint}>{es ? "Código completo, ej. AV205, AA2174." : "Full code, e.g. AV205, AA2174."}</p>
            </div>
            <div style={S.row2}>
              <div>
                <label style={S.lbl}>{es ? "Fecha de salida *" : "Departure date *"}</label>
                <FInput type="date" value={form.departureDate} onChange={set("departureDate")} />
              </div>
              <div>
                <label style={S.lbl}>{es ? "Hora de salida *" : "Departure time *"}</label>
                <FInput type="time" value={form.departureTime} onChange={set("departureTime")} />
              </div>
            </div>
          </FormSection>

          {/* Extras */}
          <FormSection title={es ? "Extras (Opcional)" : "Extras (Optional)"}>
            <div>
              <label style={S.lbl}>{es ? "Ocasión" : "Occasion"}</label>
              <FSelect value={form.occasion} onChange={set("occasion")}>
                <option value="">{es ? "Seleccionar si aplica…" : "Select if applicable…"}</option>
                {["Anniversary","Bachelor/Bachelorette","Birthday","Family","Friends Trip","Just because!"]
                  .map(o => <option key={o} value={o}>{o}</option>)}
              </FSelect>
            </div>
            <div>
              <label style={S.lbl}>{es ? "¿Algo más que debamos saber?" : "Anything else we should know?"}</label>
              <FTextarea value={form.notes} onChange={set("notes")} rows={3}
                placeholder={es ? "Solicitudes especiales, sorpresas planeadas…" : "Special requests, surprises you're planning…"} />
            </div>
            <div>
              <label style={S.lbl}>{es ? "Permiso de fotos" : "Photo permission"}</label>
              <FSelect value={form.photoPermission} onChange={set("photoPermission")}>
                <option value="yes">{es ? "Sí, pueden compartir fotos mías" : "Yes, you can share photos of me"}</option>
                <option value="no">{es ? "No, prefiero que las fotos sean privadas" : "No, please keep photos private"}</option>
              </FSelect>
            </div>
          </FormSection>

          {/* Error */}
          {error && (
            <div className="tt-card" style={{ padding: "11px 15px", background: "#fef2f2", borderColor: "#fecaca", fontSize: 12.5, color: "#b91c1c" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button onClick={submit} disabled={sending} className="tt-btn-primary"
            style={{ padding: "11px 20px", fontSize: 13, width: "100%", opacity: sending ? .6 : 1, cursor: sending ? "not-allowed" : "pointer" }}>
            {sending ? (es ? "Enviando…" : "Sending…") : (es ? "Enviar Check-in" : "Submit Check-in")}
          </button>

          <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--text-3)", margin: 0 }}>
            {es ? "Cada persona del grupo lo llena individualmente." : "Each person in your group fills this out individually."}
          </p>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          #ccp-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
