import React, { useMemo, useState, useEffect, Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{padding:32,fontFamily:"monospace",background:"#fff1f1",minHeight:"100vh"}}>
          <h2 style={{color:"#c00",marginBottom:12}}>⚠️ Runtime Error</h2>
          <pre style={{whiteSpace:"pre-wrap",fontSize:13,color:"#333"}}>
            {this.state.error?.message || String(this.state.error)}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import ConciergePanel, { ReunionesPage } from "./ConciergePanel";
import TwoTravelCatalog from "./TwoTravelCatalog";
import ItineraryPrintView from "./ItineraryPrintView";
import BodaPanel from "./BodaPanel";
import TareasPanel from "./TareasPanel";
import { updateKickoffInSheet, fetchKickoffsFromSheet, saveKickoffToSheet } from "./sheetServices";

const translations = {
  en: {
    title: "How was your trip?",
    subtitle:
      "This takes just a few minutes and helps us keep refining every detail of the experience we create for our clients.",
    submit: "Submit feedback",
    saving: "Saving...",
    thankYou: "Thank you for sharing",
    received: "Feedback Received",
    thanksBody:
      "We appreciate your time. Every note helps us improve future experiences.",

    guest: "Guest",
    trip: "Trip",
    privateGuest: "Private",
    privateTrip: "Curated Experience",

    tripDetailsTitle: "Trip Details",
    tripDetailsSubtitle: "Choose what information applies to you from the drop down menu.",
    destination: "Destination",
    concierge: "Your Concierge",
    occasion: "The Occasion",

    bigPictureTitle: "The Big Picture",
    bigPictureSubtitle: "Your overall impression of the experience.",
    overallExperienceLabel:
      "On a scale of 1 to 10, how was your overall experience?",
    overallExperienceHint:
      "1 = Significant issues · 5–6 = Room for improvement · 10 = Flawless",
    overallReasonLabel: "What stood out — good or bad?",
    overallReasonPlaceholder: "Tell us what shaped the experience most.",

    oneThingTitle: 'The "One Thing"',
    oneThingSubtitle:
      "Your honest note — the one thing we could improve.",
    oneThingLabel:
      "If you could improve one thing, what would it be?",
    oneThingPlaceholder: "No filters — we can take it.",

    optional: "Optional",
    moreFeedbackTitle:
      "If you have a bit more time, we'd love to hear more.",
    moreFeedbackToggleShow: "Click here to share more.",
    moreFeedbackToggleHide: "Click here to hide.",

    beforeArrivalTitle: "Before You Arrived",
    beforeArrivalSubtitle: "",
    itinerary: "Itinerary",
    itineraryHint:
      "Did your itinerary feel clear, complete, and well-organized?",
    communication: "Communication",
    communicationHint:
      "Was your concierge easy to communicate with before your trip?",
    readiness: "Readiness",
    readinessHint:
      "Did you feel ready and taken care of before your arrival?",

    teamPropertyTitle: "Your Stay",
    teamPropertySubtitle: "",
    propertyRatingLabel:
      "How would you rate the property and accommodations?",
    propertyNotesLabel: "Anything else we should know about the property?",
    propertyNotesPlaceholder: "Share anything worth noting.",

    amenitiesLabel: "Amenities",
    amenitiesPlaceholder: "What did you like? What was missing?",

    duringStayTitle: "During Your Visit",
    duringStaySubtitle: "Execution & Service",
    responsiveness: "Responsiveness",
    responsivenessHint:
      "When you needed something, how quickly did we respond?",
    problemSolving: "Problem Solving",
    problemSolvingHint:
      "If anything came up during your trip, how well did we handle it?",
    personalTouch: "Personal Touch",
    personalTouchHint:
      "How tailored did the experiences feel to your group's preferences?",
    stayNotesPlaceholder:
      "If you'd like, leave any extra notes here.",

    loyaltyTitle: "Would You Come Back?",
    bookAgainLabel: "Would you book with us again?",
    recommendLabel: "Would you recommend us to a friend?",

    reviewTitle: "Loved your experience?",
    reviewSubtitle:
      "We'd really appreciate it if you shared it publicly.",
    reviewButton: "Leave a review on Tripadvisor",

    readySubmit: "Ready to submit?",
    readySubmitSubtitle:
      "Your notes help us refine every detail of the experience.",

    options: {
      destinations: ["Cartagena", "CDMX", "Medellín", "Tulum"],
      concierges: ["Alia", "Caro", "Dani", "Giulia", "Natalia", "Nataly"],
      occasions: [
        "Anniversary",
        "Bachelor/Bachelorette",
        "Birthday",
        "Family",
        "Friends Trip",
        "Just because!",
      ],
      venueTypes: ["Villa", "Hotel", "Yacht", "Apartment", "Other"],
      yesNo: ["Yes", "No"],
    },
  },

  es: {
    title: "¿Cómo estuvo tu viaje?",
    subtitle:
      "Esto toma solo unos minutos y nos ayuda a seguir mejorando cada detalle de la experiencia que creamos para nuestros clientes.",
    submit: "Enviar feedback",
    saving: "Guardando...",
    thankYou: "Gracias por compartir",
    received: "Feedback recibido",
    thanksBody:
      "Agradecemos tu tiempo. Cada comentario nos ayuda a mejorar futuras experiencias.",

    guest: "Huésped",
    trip: "Viaje",
    privateGuest: "Privado",
    privateTrip: "Experiencia curada",

    tripDetailsTitle: "Detalles del viaje",
    tripDetailsSubtitle: "Selecciona la información que aplique a tu experiencia en el menú desplegable.",
    destination: "Destino",
    concierge: "Tu concierge",
    occasion: "La ocasión",

    bigPictureTitle: "La visión general",
    bigPictureSubtitle: "Tu impresión general de la experiencia.",
    overallExperienceLabel:
      "En una escala del 1 al 10, ¿cómo fue tu experiencia general?",
    overallExperienceHint:
      "1 = Problemas significativos · 5–6 = Hay margen de mejora · 10 = Impecable",
    overallReasonLabel: "¿Qué destacó — bueno o malo?",
    overallReasonPlaceholder:
      "Cuéntanos qué fue lo que más influyó en tu experiencia.",

    oneThingTitle: 'La "Una Cosa"',
    oneThingSubtitle:
      "Tu comentario más honesto: esa una cosa que podríamos mejorar.",
    oneThingLabel:
      "Si pudieras mejorar una sola cosa, ¿cuál sería?",
    oneThingPlaceholder: "Sin filtros, lo podemos recibir.",

    optional: "Opcional",
    moreFeedbackTitle:
      "Si tienes un poco más de tiempo, nos encantaría saber más.",
    moreFeedbackToggleShow: "Haz clic aquí para compartir más.",
    moreFeedbackToggleHide: "Haz clic aquí para ocultar.",

    beforeArrivalTitle: "Antes de llegar",
    beforeArrivalSubtitle: "",
    itinerary: "Itinerario",
    itineraryHint:
      "¿Tu itinerario se sintió claro, completo y bien organizado?",
    communication: "Comunicación",
    communicationHint:
      "¿Fue fácil comunicarse con tu concierge antes del viaje?",
    readiness: "Preparación",
    readinessHint:
      "¿Te sentiste listo/a y bien atendido/a antes de tu llegada?",

    teamPropertyTitle: "Tu estadía",
    teamPropertySubtitle: "",
    propertyRatingLabel:
      "¿Cómo calificarías la propiedad y el alojamiento?",
    propertyNotesLabel:
      "¿Hay algo más que debamos saber sobre la propiedad?",
    propertyNotesPlaceholder: "Comparte cualquier detalle importante.",

    amenitiesLabel: "Amenidades",
    amenitiesPlaceholder: "¿Qué te gustó? ¿Qué hizo falta?",

    duringStayTitle: "Durante tu visita",
    duringStaySubtitle: "Ejecución y servicio",
    responsiveness: "Capacidad de respuesta",
    responsivenessHint:
      "Cuando necesitabas algo, ¿qué tan rápido respondimos?",
    problemSolving: "Resolución de problemas",
    problemSolvingHint:
      "Si surgió algo durante el viaje, ¿qué tan bien lo manejamos?",
    personalTouch: "Toque personal",
    personalTouchHint:
      "¿Qué tan adaptadas se sintieron las experiencias a las preferencias de tu grupo?",
    stayNotesPlaceholder:
      "Si quieres, puedes dejar aquí cualquier comentario adicional.",

    loyaltyTitle: "¿Volverías?",
    bookAgainLabel: "¿Reservarías con nosotros otra vez?",
    recommendLabel: "¿Nos recomendarías a un amigo?",

    reviewTitle: "¿Te encantó la experiencia?",
    reviewSubtitle:
      "Nos ayudaría muchísimo si la compartes públicamente.",
    reviewButton: "Dejar una reseña en Tripadvisor",

    readySubmit: "¿Listo para enviar?",
    readySubmitSubtitle:
      "Tus comentarios nos ayudan a mejorar cada detalle de la experiencia.",

    options: {
      destinations: ["Cartagena", "CDMX", "Medellín", "Tulum"],
      concierges: ["Alia", "Caro", "Dani", "Giulia", "Natalia", "Nataly"],
      occasions: [
        "Aniversario",
        "Cumpleaños",
        "Despedida de soltero/a",
        "Familia",
        "Viaje con amigos",
        "¡Porque sí!",
      ],
      venueTypes: ["Villa", "Hotel", "Yate", "Apartamento", "Otro"],
      yesNo: ["Sí", "No"],
    },
  },
};

/* ── Shared form components — defined OUTSIDE FeedbackForm so React
   doesn't remount them on every keystroke (would cause focus loss). ── */

function FbSection({ eyebrow, title, subtitle, children }) {
  return (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
      {eyebrow && <p className="text-[10px] uppercase tracking-[0.28em] text-stone-400">{eyebrow}</p>}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800">{title}</h2>
      {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{subtitle}</p>}
      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );
}

function FbLabel({ children }) {
  return <label className="block text-sm font-medium text-stone-700">{children}</label>;
}

function FbTextarea({ value, onChange, placeholder, rows = 5 }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className="mt-3 w-full rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-stone-400 focus:bg-white resize-none"
    />
  );
}

const STAR_LABELS = { 1: "⭐ Poor", 2: "⭐⭐ Could be better", 3: "⭐⭐⭐ Good", 4: "⭐⭐⭐⭐ Great", 5: "⭐⭐⭐⭐⭐ Exceptional" };

function FbScorePills({ value, onChange, min = 1, max = 10, allowNA = false }) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => String(i + min));
  const showStars = max === 5 && min === 1;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {allowNA && (
          <button type="button" onClick={() => onChange("N/A")}
            className={`rounded-full px-4 py-2 text-sm transition ${value === "N/A" ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}>
            N/A
          </button>
        )}
        {values.map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`h-11 min-w-11 rounded-full px-4 text-sm font-medium transition ${value === n ? "bg-stone-800 text-white" : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"}`}>
            {n}
          </button>
        ))}
      </div>
      {showStars && value && value !== "N/A" && (
        <p className="mt-2 text-xs text-stone-500">{STAR_LABELS[Number(value)]}</p>
      )}
    </div>
  );
}

function FbSelect({ value, onChange, options, placeholder, hasError }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`mt-3 w-full rounded-[18px] border px-4 py-3.5 text-sm text-stone-800 bg-white outline-none transition focus:border-stone-400 appearance-none cursor-pointer ${hasError ? "border-red-400 bg-red-50" : "border-stone-200"}`}>
      <option value="" disabled>{placeholder || "— Select —"}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function FeedbackForm({ kickoffId }) {
  const params = new URLSearchParams(window.location.search);
  const guestName = params.get("guestName") || "";
  const tripName = params.get("tripName") || "";
  const langParam = params.get("lang");
  // Pre-fill destination and concierge from URL if present
  const preDestination = params.get("destination") || params.get("city") || "";
  const preConcierge  = params.get("concierge")  || "";
  const preConcierge2 = params.get("concierge2") || "";

  const initialLang =
    langParam === "es" || langParam === "en" ? langParam : "en";

  const [lang, setLang] = useState(initialLang);
  const t = translations[lang];

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMoreFeedback, setShowMoreFeedback] = useState(false);
  const [errors, setErrors] = useState({});
  // null = not chosen yet, true = already left review, false = hasn't
  const [hasReview, setHasReview] = useState(null);

  const [form, setForm] = useState({
  destination: preDestination,
  concierge: preConcierge,
  concierge2: preConcierge2,
  occasion: "",

  overallExperience: "",
  overallReason: "",

  oneThing: "",

  // Section 04 – Before You Arrived
  itinerary: "",
  communication: "",
  readiness: "",

  // Section 05 – During Your Visit
  responsiveness: "",
  problemSolving: "",
  personalTouch: "",
  stayNotes: "",

  // Section 06 – Your Stay
  propertyRating: "",
  propertyNotes: "",
  amenities: "",

  bookAgain: "",
  recommend: "",
});

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbys30F3VOqsDbqA1P2ar6VHjSQe-8awkeuOMFBCp5pQ35VhwKrdOHTg9pw6a6Sv9pqT/exec";

const handleSubmit = async (e) => {
  e.preventDefault();
  if (saving) return;

  // Required field validation
  const newErrors = {};
  if (!form.destination) newErrors.destination = true;
  if (!form.concierge)   newErrors.concierge   = true;
  if (!hasReview && !form.overallExperience) newErrors.overallExperience = true;
  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    // Scroll to first error
    const first = document.querySelector(".field-error");
    if (first) first.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  setErrors({});

  setSaving(true);

  try {
    const payload = {
      kickoffId: kickoffId || "",
      guestName: guestName || "",
      tripName: tripName || "",
      language: lang,
      ...form,
      submittedAt: new Date().toISOString(),
    };

    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Error guardando");

    setSubmitted(true);

    if (kickoffId) {
      const rating = Number(form.overallExperience) || 0;
      updateKickoffInSheet(kickoffId, {
        status: "feedback_submitted",
        feedbackAt: new Date().toISOString(),
        feedbackDestination: form.destination || "",
        feedbackLanguage:    lang,
        ...(rating > 0       ? { conciergeRating: rating }                  : {}),
        ...(form.service     ? { feedbackService: Number(form.service) }     : {}),
        ...(form.speed       ? { feedbackSpeed:   Number(form.speed)   }     : {}),
        ...(form.overallReason ? { feedbackComment: form.overallReason }     : {}),
      }).catch((e) => console.warn("Could not update kickoff status:", e));
    }
  } catch (err) {
    console.error(err);
    alert("Error guardando feedback");
  } finally {
    setSaving(false);
  }
};

  // Use module-level components (Fb*) — avoids remount on every keystroke
  const Section        = FbSection;
  const Label          = FbLabel;
  const Textarea       = FbTextarea;
  const ScorePills     = FbScorePills;
  const SelectDropdown = FbSelect;

  if (submitted) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 py-10 text-stone-800">
        <div className="mx-auto max-w-3xl rounded-[32px] border border-stone-200 bg-white p-10 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-stone-800 text-xl font-semibold text-white">
            ✓
          </div>
          <p className="mt-6 text-center text-[11px] uppercase tracking-[0.3em] text-stone-400">
            {t.received}
          </p>
          <h1 className="mt-3 text-center text-4xl font-semibold tracking-tight">
            {t.thankYou}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-7 text-stone-500">
            {t.thanksBody}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-[34px] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    lang === "en"
                      ? "bg-stone-800 text-white"
                      : "border border-stone-200 bg-white text-stone-600"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLang("es")}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    lang === "es"
                      ? "bg-stone-800 text-white"
                      : "border border-stone-200 bg-white text-stone-600"
                  }`}
                >
                  ES
                </button>
              </div>

              <p className="text-[11px] uppercase tracking-[0.32em] text-stone-400">
                Two Travel Concierge
              </p>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl text-stone-800">
                {t.title}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-500">
                {t.subtitle}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
              <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">
                  {t.guest}
                </p>
                <p className="mt-2 text-sm font-medium text-stone-700">
                  {guestName || t.privateGuest}
                </p>
              </div>

              <div className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-stone-400">
                  {t.trip}
                </p>
                <p className="mt-2 text-sm font-medium text-stone-700">
                  {tripName || t.privateTrip}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Route selector ── */}
        {hasReview === null && (
          <div className="rounded-[28px] border border-stone-200 bg-white p-8 shadow-sm text-center">
            <p className="text-[11px] uppercase tracking-[0.28em] text-stone-400 mb-3">
              {lang === "es" ? "Antes de continuar" : "Before we start"}
            </p>
            <h2 className="text-2xl font-semibold text-stone-800 mb-2">
              {lang === "es"
                ? "¿Ya nos dejaste una reseña en Google o TripAdvisor?"
                : "Did you already leave us a review on Google or TripAdvisor?"}
            </h2>
            <p className="text-sm text-stone-500 mb-8">
              {lang === "es"
                ? "Esto nos ayuda a personalizar tu experiencia de feedback."
                : "This helps us personalize your feedback experience."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button type="button"
                onClick={() => setHasReview(true)}
                className="rounded-2xl border-2 border-teal-200 bg-teal-50 px-8 py-5 text-left hover:bg-teal-100 transition">
                <div className="text-2xl mb-2">✅</div>
                <div className="font-semibold text-teal-800 text-sm">
                  {lang === "es" ? "Sí, ya dejé mi reseña" : "Yes, I left a review"}
                </div>
                <div className="text-xs text-teal-600 mt-1">
                  {lang === "es" ? "Ir directo al formulario de feedback" : "Go straight to the feedback form"}
                </div>
              </button>
              <button type="button"
                onClick={() => setHasReview(false)}
                className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-8 py-5 text-left hover:bg-amber-100 transition">
                <div className="text-2xl mb-2">⭐</div>
                <div className="font-semibold text-amber-800 text-sm">
                  {lang === "es" ? "No, aún no lo he hecho" : "No, I haven't yet"}
                </div>
                <div className="text-xs text-amber-600 mt-1">
                  {lang === "es" ? "Calificar mi experiencia aquí" : "Rate my experience here"}
                </div>
              </button>
            </div>
          </div>
        )}

        {hasReview !== null && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Section
            eyebrow="01"
            title={t.tripDetailsTitle}
            subtitle={t.tripDetailsSubtitle}
          >
            <p className="text-xs text-amber-600 font-medium -mt-2">
              {lang === "es"
                ? "Por favor asegúrate de que la información es correcta."
                : "Please make sure the information is correct."}
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              <div className={errors.destination ? "field-error" : ""}>
                <Label>{t.destination}{errors.destination && <span className="ml-2 text-red-500 text-xs font-normal">({lang === "es" ? "requerido" : "required"})</span>}</Label>
                <SelectDropdown
                  value={form.destination}
                  onChange={(v) => { updateField("destination", v); setErrors(p => ({...p, destination: false})); }}
                  options={t.options.destinations}
                  placeholder={t.destination}
                  hasError={!!errors.destination}
                />
              </div>

              <div className={errors.concierge ? "field-error" : ""}>
                <Label>{t.concierge}{errors.concierge && <span className="ml-2 text-red-500 text-xs font-normal">({lang === "es" ? "requerido" : "required"})</span>}</Label>
                <SelectDropdown
                  value={form.concierge}
                  onChange={(v) => { updateField("concierge", v); setErrors(p => ({...p, concierge: false})); }}
                  options={t.options.concierges}
                  placeholder={t.concierge}
                  hasError={!!errors.concierge}
                />
              </div>

              {preConcierge2 && (
                <div>
                  <Label>{lang === "es" ? "Tu concierge 2" : "Your Concierge 2"}</Label>
                  <SelectDropdown
                    value={form.concierge2}
                    onChange={(v) => updateField("concierge2", v)}
                    options={t.options.concierges}
                    placeholder={lang === "es" ? "Tu concierge 2" : "Your Concierge 2"}
                  />
                </div>
              )}

              <div>
                <Label>{t.occasion}</Label>
                <SelectDropdown
                  value={form.occasion}
                  onChange={(v) => updateField("occasion", v)}
                  options={t.options.occasions}
                  placeholder={t.occasion}
                />
              </div>
            </div>
          </Section>

          <Section
            eyebrow="02"
            title={t.bigPictureTitle}
            subtitle={t.bigPictureSubtitle}
          >
            {!hasReview && (
            <div className={errors.overallExperience ? "field-error" : ""}>
              <Label>
                {t.overallExperienceLabel}
                {errors.overallExperience && <span className="ml-2 text-red-500 text-xs font-normal">({lang === "es" ? "requerido" : "required"})</span>}
              </Label>
              <p className="mt-2 text-xs text-stone-500">
                {t.overallExperienceHint}
              </p>
              <ScorePills
                value={form.overallExperience}
                onChange={(v) => { updateField("overallExperience", v); setErrors(p => ({...p, overallExperience: false})); }}
              />
            </div>
            )}

            <div>
              <Label>{t.overallReasonLabel}</Label>
              <Textarea
                value={form.overallReason}
                onChange={(e) => updateField("overallReason", e.target.value)}
                placeholder={t.overallReasonPlaceholder}
              />
            </div>
          </Section>

          <Section
            eyebrow="03"
            title={t.oneThingTitle}
            subtitle={t.oneThingSubtitle}
          >
            <div>
              <Label>{t.oneThingLabel}</Label>
              <Textarea
                value={form.oneThing}
                onChange={(e) => updateField("oneThing", e.target.value)}
                placeholder={t.oneThingPlaceholder}
              />
            </div>
          </Section>

          <section id="more-feedback-section" className="rounded-[28px] border border-stone-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setShowMoreFeedback((prev) => !prev)}
              className="flex w-full items-center justify-between px-6 py-5 text-left"
            >
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-stone-400">
                  {t.optional}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800">
                  {t.moreFeedbackTitle}
                </h2>
                <p className="mt-2 text-sm text-stone-500">
                  {showMoreFeedback
                    ? t.moreFeedbackToggleHide
                    : t.moreFeedbackToggleShow}
                </p>
              </div>

              <div className="ml-4 text-2xl text-stone-500">
                {showMoreFeedback ? "−" : "+"}
              </div>
            </button>

            {showMoreFeedback && (
              <div className="space-y-6 border-t border-stone-200 px-6 pb-6 pt-6">

                {/* 04 — Before You Arrived */}
                <Section
                  eyebrow="04"
                  title={t.beforeArrivalTitle}
                  subtitle={t.beforeArrivalSubtitle || undefined}
                >
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div>
                      <Label>{t.itinerary}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.itineraryHint}</p>
                      <ScorePills min={1} max={5} value={form.itinerary} onChange={(v) => updateField("itinerary", v)} />
                    </div>
                    <div>
                      <Label>{t.communication}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.communicationHint}</p>
                      <ScorePills min={1} max={5} value={form.communication} onChange={(v) => updateField("communication", v)} />
                    </div>
                    <div>
                      <Label>{t.readiness}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.readinessHint}</p>
                      <ScorePills min={1} max={5} value={form.readiness} onChange={(v) => updateField("readiness", v)} />
                    </div>
                  </div>
                </Section>

                {/* 05 — During Your Visit */}
                <Section
                  eyebrow="05"
                  title={t.duringStayTitle}
                  subtitle={t.duringStaySubtitle || undefined}
                >
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div>
                      <Label>{t.responsiveness}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.responsivenessHint}</p>
                      <ScorePills min={1} max={5} value={form.responsiveness} onChange={(v) => updateField("responsiveness", v)} />
                    </div>
                    <div>
                      <Label>{t.problemSolving}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.problemSolvingHint}</p>
                      <ScorePills min={1} max={5} allowNA value={form.problemSolving} onChange={(v) => updateField("problemSolving", v)} />
                    </div>
                    <div>
                      <Label>{t.personalTouch}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.personalTouchHint}</p>
                      <ScorePills min={1} max={5} value={form.personalTouch} onChange={(v) => updateField("personalTouch", v)} />
                    </div>
                  </div>
                  <div>
                    <Textarea value={form.stayNotes} onChange={(e) => updateField("stayNotes", e.target.value)} placeholder={t.stayNotesPlaceholder} />
                  </div>
                </Section>

                {/* 06 — Your Stay */}
                <Section
                  eyebrow="06"
                  title={t.teamPropertyTitle}
                  subtitle={t.teamPropertySubtitle || undefined}
                >
                  <div>
                    <Label>{t.propertyRatingLabel}</Label>
                    <ScorePills min={1} max={5} value={form.propertyRating} onChange={(v) => updateField("propertyRating", v)} />
                  </div>
                  <div>
                    <Label>{t.amenitiesLabel}</Label>
                    <Textarea value={form.amenities} onChange={(e) => updateField("amenities", e.target.value)} placeholder={t.amenitiesPlaceholder} />
                  </div>
                  <div>
                    <Label>{t.propertyNotesLabel}</Label>
                    <Textarea value={form.propertyNotes} onChange={(e) => updateField("propertyNotes", e.target.value)} placeholder={t.propertyNotesPlaceholder} />
                  </div>
                </Section>
              </div>
            )}
          </section>

          {/* Review — only shown for route 2 (hasn't left review yet) */}
          {!hasReview && (() => {
            const cityUpper = String(preDestination || "").toUpperCase();
            const isMexico = cityUpper.includes("CDMX") || cityUpper.includes("TUL") || cityUpper.includes("TULUM") || cityUpper.includes("MEXICO") || cityUpper.includes("MÉXICO");
            const reviewUrl = isMexico
              ? "https://share.google/UvyICj95CeOsw7VgN"
              : "https://www.tripadvisor.com/UserReviewEdit-g297476-d17750092-Two_Travel-Cartagena_Cartagena_District_Bolivar_Department.html";
            const reviewLabel = isMexico
              ? (lang === "es" ? "Dejar una reseña en Google" : "Leave a review on Google")
              : t.reviewButton;
            return (
              <section className="rounded-[28px] border-2 border-amber-200 bg-amber-50 p-6 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-500">⭐ Review</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800">{t.reviewTitle}</h2>
                <p className="mt-2 text-sm text-stone-500">{t.reviewSubtitle}</p>
                <a
                  href={reviewUrl}
                  target="_blank" rel="noreferrer"
                  className="mt-4 inline-block rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  {reviewLabel}
                </a>
              </section>
            );
          })()}

          <div className="sticky bottom-4 z-20">
            <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-800">{t.readySubmit}</p>
                  <p className="text-xs text-stone-500">{t.readySubmitSubtitle}</p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-stone-800 px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? t.saving : t.submit}
                </button>
              </div>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
const JUNIOR_CONCIERGES = ["Valentina","Manuela","Isabella","Sofia","Daniela","Gabriela","Natalia","Carolina","Otro"];
const CITY_LABELS_D = { cartagena:"Cartagena", medellin:"Medellín", bogota:"Bogotá", barranquilla:"Barranquilla", santamarta:"Santa Marta" };

function cityLabel(code) {
  if (!code) return "";
  return CITY_LABELS_D[code.toLowerCase().trim()] || code;
}

function parseCity(k) {
  const raw = String(k.city || "").trim();
  const parts = raw.split(",").map(s => s.trim()).filter(Boolean);
  return { city1: parts[0] || "", city2: k.city2 || parts[1] || "" };
}

function fmtDateShort(s) {
  if (!s) return "";
  try { return new Date(s + "T12:00:00").toLocaleDateString("es", { day:"numeric", month:"short" }); }
  catch { return s; }
}

function orderStatus(k) {
  const drinks = k.drinkOrderJson || k.drinkOrder ? "✅" : "—";
  const grocery = k.groceryOrderJson || k.groceryOrder ? "✅" : "—";
  const breakfast = (() => {
    try {
      const c = typeof k.cart === "string" ? JSON.parse(k.cart) : (k.cart || []);
      return Array.isArray(c) && c.length ? "✅" : "—";
    } catch { return "—"; }
  })();
  return { drinks, grocery, breakfast };
}

function ClientesTable({ kickoffs, loading }) {
  const [cityFilter, setCityFilter] = useState("all");
  const [period, setPeriod] = useState("all");
  const [saving, setSaving] = useState({});

  // Expand multi-city kickoffs into multiple rows
  const rows = React.useMemo(() => {
    const result = [];
    kickoffs.forEach(k => {
      const { city1, city2 } = parseCity(k);
      result.push({ ...k, _rowCity: city1, _rowArrival: k.arrivalDate, _rowDeparture: k.departureDate });
      if (city2 || k.arrivalDate2 || k.accommodationName2) {
        result.push({ ...k, _rowCity: city2, _rowArrival: k.arrivalDate2, _rowDeparture: k.departureDate2, _isCity2: true });
      }
    });
    return result;
  }, [kickoffs]);

  const now = new Date();
  const filtered = rows.filter(r => {
    if (cityFilter !== "all") {
      const c = (r._rowCity || "").toLowerCase().trim();
      if (c !== cityFilter) return false;
    }
    if (period !== "all" && r._rowArrival) {
      const arr = new Date(r._rowArrival);
      const diffDays = (arr - now) / 86400000;
      if (period === "week"  && (diffDays < -7 || diffDays > 7))  return false;
      if (period === "month" && (diffDays < -30 || diffDays > 30)) return false;
    }
    return true;
  }).sort((a, b) => (a._rowArrival || "") > (b._rowArrival || "") ? 1 : -1);

  const cities = ["all", ...Array.from(new Set(rows.map(r => (r._rowCity||"").toLowerCase().trim()).filter(Boolean)))];

  async function saveField(kickoffId, field, value) {
    setSaving(s => ({ ...s, [kickoffId + field]: true }));
    try {
      await fetch(GAS_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "updateKickoff", id: kickoffId, updates: { [field]: value } }),
      });
    } catch(e) { console.error(e); }
    setSaving(s => ({ ...s, [kickoffId + field]: false }));
  }

  const thStyle = { fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", color:"#6b7280", padding:"8px 10px", background:"#f9fafb", borderBottom:"1px solid #e5e7eb", whiteSpace:"nowrap", textAlign:"left" };
  const tdStyle = { fontSize:12, padding:"8px 10px", borderBottom:"1px solid #f3f4f6", verticalAlign:"middle" };

  return (
    <div>
      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:11, color:"#6b7280", fontWeight:600 }}>Ciudad:</span>
        {cities.map(c => (
          <button key={c} onClick={() => setCityFilter(c)}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:99, border:"1px solid", cursor:"pointer",
              background: cityFilter===c ? "#111" : "#fff",
              color: cityFilter===c ? "#fff" : "#555",
              borderColor: cityFilter===c ? "#111" : "#ddd" }}>
            {c === "all" ? "Todas" : cityLabel(c)}
          </button>
        ))}
        <span style={{ fontSize:11, color:"#6b7280", fontWeight:600, marginLeft:8 }}>Período:</span>
        {[["all","Todo"],["week","Esta semana"],["month","Este mes"]].map(([v,l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            style={{ fontSize:11, padding:"4px 10px", borderRadius:99, border:"1px solid", cursor:"pointer",
              background: period===v ? "#111" : "#fff",
              color: period===v ? "#fff" : "#555",
              borderColor: period===v ? "#111" : "#ddd" }}>
            {l}
          </button>
        ))}
        <span style={{ fontSize:11, color:"#9ca3af", marginLeft:"auto" }}>{filtered.length} clientes</span>
      </div>

      {loading && <p style={{ fontSize:13, color:"#9ca3af", padding:24 }}>Cargando…</p>}

      {!loading && (
        <div style={{ overflowX:"auto", borderRadius:12, border:"1px solid #e5e7eb", background:"#fff" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Cliente</th>
                <th style={thStyle}>Ciudad</th>
                <th style={thStyle}>Fechas</th>
                <th style={thStyle}>Pax</th>
                <th style={thStyle}>Concierge</th>
                <th style={thStyle}>Junior</th>
                <th style={thStyle}>Itinerario</th>
                <th style={thStyle}>Reuniones</th>
                <th style={thStyle}>🍹 Bebidas</th>
                <th style={thStyle}>🛒 Comida</th>
                <th style={thStyle}>☕ Desayuno</th>
                <th style={{ ...thStyle, minWidth:180 }}>📣 Marketing</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} style={{ ...tdStyle, textAlign:"center", color:"#9ca3af", padding:32 }}>Sin clientes para este filtro.</td></tr>
              )}
              {filtered.map((r, i) => {
                const { drinks, grocery, breakfast } = orderStatus(r);
                const itinLink = `/?mode=itinerary&kickoffId=${r.id}`;
                const reunLink = `/?mode=reuniones`;
                const isSaving = (f) => saving[r.id + f];
                return (
                  <tr key={r.id + (r._isCity2 ? "_2" : "")} style={{ background: i%2===0?"#fff":"#fafafa" }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight:600, color:"#111" }}>{r.guestName || r.tripName || "—"}</div>
                      {r.tripName && r.guestName && <div style={{ fontSize:10, color:"#9ca3af" }}>{r.tripName}</div>}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize:11, padding:"2px 8px", borderRadius:99, background:"#f3f4f6", color:"#374151", fontWeight:500 }}>
                        {cityLabel(r._rowCity) || "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, whiteSpace:"nowrap", color:"#6b7280" }}>
                      {fmtDateShort(r._rowArrival)}{r._rowDeparture ? ` → ${fmtDateShort(r._rowDeparture)}` : ""}
                    </td>
                    <td style={{ ...tdStyle, textAlign:"center" }}>{r.pax || r.groupSize || "—"}</td>
                    <td style={{ ...tdStyle, color:"#374151" }}>{r.assignedConciergeName || r.concierge || "—"}</td>
                    <td style={tdStyle}>
                      <select
                        defaultValue={r.juniorConcierge || ""}
                        onBlur={e => { if (e.target.value !== (r.juniorConcierge||"")) saveField(r.id, "juniorConcierge", e.target.value); }}
                        style={{ fontSize:11, border:"1px solid #e5e7eb", borderRadius:6, padding:"3px 6px", background:"#fff", color:"#374151", cursor:"pointer" }}>
                        <option value="">— asignar —</option>
                        {JUNIOR_CONCIERGES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      {isSaving("juniorConcierge") && <span style={{ fontSize:9, color:"#9ca3af" }}> ↑</span>}
                    </td>
                    <td style={tdStyle}>
                      <a href={itinLink} target="_blank" rel="noreferrer"
                        style={{ fontSize:11, color:"#2563eb", textDecoration:"none", fontWeight:500 }}>
                        Ver →
                      </a>
                    </td>
                    <td style={tdStyle}>
                      <a href={reunLink} target="_blank" rel="noreferrer"
                        style={{ fontSize:11, color:"#7c3aed", textDecoration:"none", fontWeight:500 }}>
                        Reuniones →
                      </a>
                    </td>
                    <td style={{ ...tdStyle, textAlign:"center" }}>{drinks}</td>
                    <td style={{ ...tdStyle, textAlign:"center" }}>{grocery}</td>
                    <td style={{ ...tdStyle, textAlign:"center" }}>{breakfast}</td>
                    <td style={tdStyle}>
                      <input
                        type="text"
                        defaultValue={r.marketingNotes || ""}
                        placeholder="Notas marketing…"
                        onBlur={e => { if (e.target.value !== (r.marketingNotes||"")) saveField(r.id, "marketingNotes", e.target.value); }}
                        style={{ fontSize:11, border:"1px solid #e5e7eb", borderRadius:6, padding:"4px 8px", width:"100%", background:"#fff", boxSizing:"border-box" }}
                      />
                      {isSaving("marketingNotes") && <span style={{ fontSize:9, color:"#9ca3af" }}>guardando…</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UnifiedDashboard({ currentUser, onLogout }) {
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1Tyv5cPTN0MjxezyWRjo-XuIRqOgaPwP-z1heZfgGiuQ/edit#gid=0";

  const [tab, setTab] = useState("kpis");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [conciergeFilter, setConciergeFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [kickoffs, setKickoffs] = useState([]);
  const [kLoading, setKLoading] = useState(true);
  // KPI filters
  const [kpiPeriod, setKpiPeriod]           = useState("all");
  const [kpiConcierge, setKpiConcierge]     = useState("all");
  const [kpiExportType, setKpiExportType]   = useState("all");

  // Derive feedback rows from kickoffs (no external sheet fetch needed)
  useEffect(() => {
    const derived = kickoffs
      .filter((k) => k.feedbackAt || k.status === "feedback_submitted")
      .map((k) => {
        const concierge = Array.isArray(k.concierges) ? k.concierges[0] : (k.concierges || "");
        const destination = k.feedbackDestination || k.city || "";
        return {
          guestName: k.guestName || "",
          tripName: k.tripName || "",
          destination,
          concierge,
          language: k.feedbackLanguage || "",
          overallExperience: k.conciergeRating || "",
          service: k.feedbackService || "",
          speed: k.feedbackSpeed || "",
          overallReason: k.feedbackComment || "",
          feedbackAt: k.feedbackAt || "",
        };
      })
      .sort((a, b) => (b.feedbackAt > a.feedbackAt ? 1 : -1));
    setRows(derived);
  }, [kickoffs]);

  useEffect(() => {
    fetchKickoffsFromSheet()
      .then((data) => {
        setKickoffs(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.warn("Kickoffs fetch failed:", err.message);
        setKickoffs([]);
      })
      .finally(() => setKLoading(false));
  }, []);

  const uniqueValues = (key) => {
    return [
      "all",
      ...Array.from(
        new Set(rows.map((r) => String(r[key] || "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    ];
  };

  const destinationOptions = uniqueValues("destination");
  const conciergeOptions = uniqueValues("concierge");
  const languageOptions = uniqueValues("language");

  const filteredRows = rows.filter((row) => {
    const okDestination =
      destinationFilter === "all" || row.destination === destinationFilter;
    const okConcierge =
      conciergeFilter === "all" || row.concierge === conciergeFilter;
    const okLanguage =
      languageFilter === "all" || row.language === languageFilter;

    return okDestination && okConcierge && okLanguage;
  });

  const total = filteredRows.length;

  const avg = (key) => {
    const nums = filteredRows
      .map((r) => Number(r[key]))
      .filter((n) => !Number.isNaN(n) && n > 0);

    if (!nums.length) return "—";
    return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
  };

  const avgScore = avg("overallExperience");
  const avgService = avg("service");
  const avgSpeed = avg("speed");

  const latest = filteredRows[0] || null;

  const countBy = (key) => {
    const map = {};
    filteredRows.forEach((row) => {
      const value = String(row[key] || "—").trim() || "—";
      map[value] = (map[value] || 0) + 1;
    });

    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };

  const destinationsData = countBy("destination");
  const conciergeData = countBy("concierge");
  const languageData = countBy("language");

  const scoreDistribution = [1,2,3,4,5,6,7,8,9,10].map((score) => ({
    label: String(score),
    value: filteredRows.filter(
      (r) => Number(r.overallExperience) === score
    ).length,
  }));

  const recentComments = filteredRows.filter(
    (r) =>
      String(r.overallReason || "").trim() ||
      String(r.oneThing || "").trim() ||
      String(r.stayNotes || "").trim()
  );

  // ── Gestión helpers ────────────────────────────────────────────────
  function avgHours(ks, fromKey, toKey) {
    const diffs = ks
      .filter((k) => k[fromKey] && k[toKey])
      .map((k) => (new Date(k[toKey]) - new Date(k[fromKey])) / 3600000);
    if (!diffs.length) return null;
    return diffs.reduce((a, b) => a + b, 0) / diffs.length;
  }
  function fmtHours(h) {
    if (h === null) return "—";
    if (h < 1) return `${Math.round(h * 60)} min`;
    if (h < 24) return `${h.toFixed(1)} hrs`;
    return `${(h / 24).toFixed(1)} días`;
  }

  const STATUS_LABELS = {
    new: { label: "Nuevo", color: "#6b7280" },
    client_submitted: { label: "Enviado por cliente", color: "#2563eb" },
    concierge_editing: { label: "En edición", color: "#d97706" },
    sent_to_travify: { label: "Enviado a contabilidad", color: "#7c3aed" },
    feedback_submitted: { label: "Feedback enviado", color: "#059669" },
    done: { label: "Completado", color: "#16a34a" },
  };
  const STATUS_KEYS = ["new", "client_submitted", "concierge_editing", "feedback_submitted", "done"];

  const BarChartCard = ({ title, data }) => {
    const max = Math.max(...data.map((d) => d.value), 1);
    return (
      <div className="tt-card" style={{padding:20}}>
        <p style={{fontSize:12,fontWeight:600,color:"var(--text-2)",marginBottom:14}}>{title}</p>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {data.length ? (
            data.map((item) => (
              <div key={item.label}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,gap:8}}>
                  <span style={{fontSize:12,color:"var(--text-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.label}</span>
                  <span style={{fontSize:12,fontWeight:600,color:"var(--text-1)",flexShrink:0}}>{item.value}</span>
                </div>
                <div style={{height:4,borderRadius:2,background:"var(--border-soft)",overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:2,background:"#111",width:`${(item.value/max)*100}%`}}/>
                </div>
              </div>
            ))
          ) : (
            <p style={{fontSize:12,color:"var(--text-3)"}}>Sin datos.</p>
          )}
        </div>
      </div>
    );
  };

  // ── Gestión panel computed values ──────────────────────────────────
  const kTotal = kickoffs.length;
  const kActivos = kickoffs.filter((k) => k.status !== "done").length;
  const kScores = kickoffs
    .filter((k) => k.feedbackAt || k.status === "feedback_submitted")
    .map((k) => Number(k.conciergeRating))
    .filter((n) => !Number.isNaN(n) && n > 0);
  const kAvgScore =
    kScores.length
      ? (kScores.reduce((a, b) => a + b, 0) / kScores.length).toFixed(1)
      : "—";
  const kConversionCount = kickoffs.filter(
    (k) => k.status === "feedback_submitted" || k.status === "done"
  ).length;
  const kConversion =
    kTotal > 0 ? `${Math.round((kConversionCount / kTotal) * 100)}%` : "—";

  const statusCounts = STATUS_KEYS.map((s) => ({
    key: s,
    count: kickoffs.filter((k) => k.status === s).length,
  }));
  const maxStatusCount = Math.max(...statusCounts.map((s) => s.count), 1);

  const timeCreatedToClient = avgHours(kickoffs, "createdAt", "clientSubmittedAt");
  const timeClientToConcierge = avgHours(kickoffs, "clientSubmittedAt", "conciergeEditingAt");
  const timeConciergeToFeedback = avgHours(kickoffs, "conciergeEditingAt", "feedbackAt");

  const conciergeGroups = {};
  kickoffs.forEach((k) => {
    const name = k.assignedConcierge || "Sin asignar";
    conciergeGroups[name] = (conciergeGroups[name] || 0) + 1;
  });
  const topConcierges = Object.entries(conciergeGroups)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const maxConciergeCount = Math.max(...topConcierges.map((c) => c.count), 1);


  // ── KPI tab computed values (filtered by kpiPeriod / kpiConcierge) ──────────
  const now = new Date();
  const kpiFiltered = kickoffs.filter(k => {
    if (kpiConcierge !== "all") {
      const names = String(k.assignedConcierge || k.assignedConciergeName || "").split(",").map(s => s.trim());
      if (!names.includes(kpiConcierge)) return false;
    }
    if (kpiPeriod === "all") return true;
    const d = new Date(k.createdAt || k.timestamp || "");
    if (isNaN(d)) return false;
    const diffDays = (now - d) / 86400000;
    if (kpiPeriod === "week")  return diffDays <= 7;
    if (kpiPeriod === "month") return diffDays <= 30;
    return true;
  });
  const kpiN = kpiFiltered.length || 1;
  const kpiRevenues = kpiFiltered.map(k => {
    const cart = Array.isArray(k.cart) ? k.cart : (typeof k.cart === "string" ? (() => { try { return JSON.parse(k.cart); } catch(e) { return []; } })() : []);
    const pax = (() => {
      const n = parseInt(k.groupSize || ((() => { try { return JSON.parse(k.quizAnswers || "{}"); } catch(e) { return {}; } })()).groupSize || 1, 10);
      return isNaN(n) || n < 1 ? 1 : n;
    })();
    return cart.filter(it => it.confirmed !== false).reduce((s, it) => {
      const p = Number(it.priceUsd || it.price_tier_1 || it.price || 0);
      if (isNaN(p)) return s;
      const isPerPerson = String(it.priceUnit || "").toLowerCase().includes("person");
      return s + (isPerPerson ? p * pax : p);
    }, 0);
  });
  const kpiServiceCounts = kpiFiltered.map(k => {
    const cart = Array.isArray(k.cart) ? k.cart : (typeof k.cart === "string" ? (() => { try { return JSON.parse(k.cart); } catch(e) { return []; } })() : []);
    return cart.filter(it => it.confirmed !== false).length;
  });
  const kpiTotalRev  = kpiRevenues.reduce((a, b) => a + b, 0);
  const kpiArpc      = kpiTotalRev / kpiN;
  const kpiAvgSvcs   = kpiServiceCounts.reduce((a, b) => a + b, 0) / kpiN;
  const kpiPct2plus  = (kpiFiltered.filter((_, i) => kpiServiceCounts[i] >= 2).length / kpiN) * 100;
  const getKpiRating = (k) => {
    try {
      const cr = (()=>{ try { return JSON.parse(k.cityRatings||"[]"); } catch { return []; } })().filter(r => Number(r.rating) > 0);
      if (cr.length) return cr.reduce((s, r) => s + Number(r.rating), 0) / cr.length;
    } catch {}
    return Number(k.conciergeRating) || 0;
  };
  const kpiRated     = kpiFiltered.filter(k => getKpiRating(k) > 0);
  const kpiAvgRating = kpiRated.length ? (kpiRated.reduce((s, k) => s + getKpiRating(k), 0) / kpiRated.length).toFixed(1) : "—";
  // Feedback-specific metrics (separate from business KPIs)
  const kpiFeedbackSubmitted = kpiFiltered.filter(k => k.feedbackAt || k.status === "feedback_submitted");
  const kpiFeedbackRate = kpiFiltered.length ? Math.round((kpiFeedbackSubmitted.length / kpiFiltered.length) * 100) : 0;
  // kpiRated for the "Feedback de clientes" block: ONLY client-submitted (1-10 scale)
  const kpiFbRated = kpiFeedbackSubmitted.filter(k => Number(k.conciergeRating) > 0);
  const kpiFbAvg = kpiFbRated.length
    ? (kpiFbRated.reduce((s, k) => s + Number(k.conciergeRating), 0) / kpiFbRated.length).toFixed(1)
    : "—";
  const kpiByConcierge = {};
  const normCityKpi = (v) => {
    const map = { CTG:"cartagena", MDE:"medellín", CDMX:"ciudad de méxico", TUL:"tulum", BOG:"bogotá" };
    const u = String(v||"").trim().toUpperCase();
    return map[u] || u.toLowerCase();
  };
  kpiFiltered.forEach((k, i) => {
    const concierges = String(k.assignedConcierge || k.assignedConciergeName || "Sin asignar")
      .split(",").map(s => s.trim()).filter(Boolean);
    const cities = String(k.city || "").split(",").map(s => normCityKpi(s)).filter(Boolean);
    let cityRatingsArr = [];
    try { cityRatingsArr = JSON.parse(k.cityRatings || "[]").filter(r => Number(r.rating) > 0); } catch {}

    // Credit revenue/svcs to first concierge (trip-level), ratings split by city
    concierges.forEach((name, ci) => {
      if (!kpiByConcierge[name]) kpiByConcierge[name] = { clients: 0, revenue: 0, svcs: 0, ratings: [] };
      if (ci === 0) { // only count client + revenue once (first concierge)
        kpiByConcierge[name].clients++;
        kpiByConcierge[name].revenue += kpiRevenues[i];
        kpiByConcierge[name].svcs    += kpiServiceCounts[i];
      }
    });
    // Assign ratings by city position
    if (cityRatingsArr.length > 0 && concierges.length > 1) {
      cityRatingsArr.forEach(cr => {
        const cityIdx = cities.indexOf(normCityKpi(cr.city));
        const name = concierges[cityIdx >= 0 ? cityIdx : 0];
        kpiByConcierge[name]?.ratings.push(Number(cr.rating));
      });
    } else if (cityRatingsArr.length > 0) {
      cityRatingsArr.forEach(cr => kpiByConcierge[concierges[0]]?.ratings.push(Number(cr.rating)));
    } else if (Number(k.conciergeRating) > 0 && (k.feedbackAt || k.status === "feedback_submitted")) {
      kpiByConcierge[concierges[0]]?.ratings.push(Number(k.conciergeRating));
    }
  });
  // ── Time metrics helpers ─────────────────────────────────────
  const daysBetween = (a, b) => {
    const ta = new Date(a), tb = new Date(b);
    if (isNaN(ta) || isNaN(tb)) return null;
    return Math.round(Math.abs(tb - ta) / 86400000 * 10) / 10;
  };
  const avgDays = (arr) => {
    const valid = arr.filter(v => v !== null);
    return valid.length ? (valid.reduce((a,b) => a+b, 0) / valid.length).toFixed(1) : "—";
  };

  // Time: link created → concierge editing
  const daysToEdit = kpiFiltered.map(k =>
    k.conciergeEditingAt ? daysBetween(k.createdAt, k.conciergeEditingAt) : null
  );
  // Time: link created → sent to Travefy (itinerary ready = contabilidad)
  const daysToSend = kpiFiltered.map(k =>
    k.sentToTravifyAt ? daysBetween(k.createdAt, k.sentToTravifyAt) : null
  );
  // Time: concierge editing → sent to Travefy
  const daysEditToSend = kpiFiltered.map(k =>
    k.conciergeEditingAt && k.sentToTravifyAt ? daysBetween(k.conciergeEditingAt, k.sentToTravifyAt) : null
  );
  const avgDaysToEdit    = avgDays(daysToEdit);
  const avgDaysToSend    = avgDays(daysToSend);
  const avgDaysEditToSend = avgDays(daysEditToSend);
  const sentCount        = kpiFiltered.filter(k => k.sentToTravifyAt).length;

  const kpiConciergeRows = Object.entries(kpiByConcierge)
    .map(([name, d]) => {
      const myKickoffs = kpiFiltered.filter(k => String(k.assignedConcierge || k.assignedConciergeName || "").split(",").map(s=>s.trim()).includes(name));
      const myDays = myKickoffs.map(k => k.sentToTravifyAt ? daysBetween(k.createdAt, k.sentToTravifyAt) : null);
      // Derive city: prefer lookup, fall back to majority city in kickoffs
      const cityFromMap = CONCIERGE_CITIES[name] || "";
      const cityFromKickoffs = (() => {
        const freq = {};
        myKickoffs.forEach(k => { const c = k.city || ""; if (c) freq[c] = (freq[c]||0)+1; });
        const sorted = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
        return sorted[0]?.[0] || "";
      })();
      return {
        name,
        city:      cityFromMap || cityFromKickoffs,
        clients:   d.clients,
        revenue:   d.revenue,
        avgSvcs:   d.clients ? (d.svcs / d.clients).toFixed(1) : "0",
        avgDays:   avgDays(myDays),
        avgRating: d.ratings.length ? (d.ratings.reduce((a,b)=>a+b,0)/d.ratings.length).toFixed(1) : "—",
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // ── Pending tasks per concierge ──────────────────────────────
  const pendingByConcierge = {};
  kpiFiltered.forEach(k => {
    const name = k.assignedConcierge || k.assignedConciergeName || "Sin asignar";
    if (!pendingByConcierge[name]) pendingByConcierge[name] = { editing: [], total: 0 };
    pendingByConcierge[name].total++;
    if (k.status === "concierge_editing" || k.status === "client_submitted") {
      pendingByConcierge[name].editing.push(k);
    }
  });
  const pendingRows = Object.entries(pendingByConcierge)
    .map(([name, d]) => {
      const oldest = d.editing.length
        ? Math.max(...d.editing.map(k => daysBetween(k.createdAt, new Date()) || 0))
        : null;
      return { name, pending: d.editing.length, total: d.total, oldestDays: oldest };
    })
    .filter(r => r.pending > 0)
    .sort((a, b) => b.oldestDays - a.oldestDays);

  const kpiStatusMap = {};
  kpiFiltered.forEach(k => { const s = k.status || "new"; kpiStatusMap[s] = (kpiStatusMap[s]||0)+1; });
  const fmtRev = v => v >= 10000 ? "$" + Math.round(v).toLocaleString("es-CO") + " COP" : "$" + v.toLocaleString("en-US",{maximumFractionDigits:0}) + " USD";
  const KpiCard = ({ label, value, sub, color }) => {
    return (
      <div className="tt-card p-5">
        <div style={{fontSize:22,fontWeight:700,color:color?"":undefined,letterSpacing:"-.02em"}} className={color||"text-neutral-900"}>{value}</div>
        <div style={{fontSize:11.5,color:"var(--text-2)",marginTop:4,fontWeight:500}}>{label}</div>
        {sub && <div style={{fontSize:10.5,color:"var(--text-3)",marginTop:2}}>{sub}</div>}
      </div>
    );
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--text-1)"}}>
      {/* ── Header ── */}
      <header className="tt-topbar">
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <a href="/?mode=concierge" style={{fontSize:12,color:"var(--text-3)",textDecoration:"none",fontWeight:500}}>← Panel</a>
          <span style={{width:1,height:14,background:"var(--border)",display:"inline-block"}}/>
          <span style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Dashboard</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <a href={sheetUrl} target="_blank" rel="noreferrer" className="tt-btn-ghost" style={{textDecoration:"none"}}>Ver Sheet ↗</a>
          {isSuperAdmin(currentUser) && (
            <a href="/?mode=users" className="tt-btn-ghost" style={{textDecoration:"none"}}>👥 Usuarios</a>
          )}
          {currentUser && (
            <div style={{display:"flex",alignItems:"center",gap:8,paddingLeft:8,borderLeft:"1px solid var(--border)"}}>
              <span style={{fontSize:11,color:"var(--text-3)"}}>{currentUser.name}</span>
              <span style={{fontSize:10,padding:"2px 7px",borderRadius:99,background:ROLE_META[currentUser.role]?.bg||"#e5e7eb",color:ROLE_META[currentUser.role]?.color||"#111",fontWeight:600}}>{ROLE_META[currentUser.role]?.label||currentUser.role}</span>
              <a href="/?mode=pin" style={{fontSize:11,color:"var(--text-3)",textDecoration:"none"}}>🔑 PIN</a>
              <button onClick={onLogout} style={{fontSize:11,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer"}}>Salir</button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* ── Tabs ── */}
        <div style={{display:"flex",gap:6,marginBottom:24,borderBottom:"1px solid var(--border)",paddingBottom:0}}>
          {[
            { id: "clientes", label: "Clientes" },
            { id: "kpis",     label: "KPIs" },
            { id: "gestion",  label: "Gestión" },
            { id: "feedback", label: "Feedback" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{
                padding:"8px 16px",
                fontSize:12.5,
                fontWeight:500,
                background:"none",
                border:"none",
                borderBottom: tab===id ? "2px solid #111" : "2px solid transparent",
                color: tab===id ? "var(--text-1)" : "var(--text-3)",
                cursor:"pointer",
                marginBottom:-1,
                transition:"color .12s, border-color .12s",
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ Clientes tab ══ */}
        {tab === "clientes" && (
          <ClientesTable kickoffs={kickoffs} loading={kLoading} />
        )}

        {/* ══ KPIs tab ══ */}
        {tab === "kpis" && (
          <>
            {kLoading ? (
              <div className="tt-card" style={{padding:24,fontSize:13,color:"var(--text-3)"}}>Cargando KPIs…</div>
            ) : (
              <>
                {/* Filters */}
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20,alignItems:"center"}}>
                  {["all","month","week"].map(p => (
                    <button key={p} onClick={() => setKpiPeriod(p)}
                      className={"tt-pill" + (kpiPeriod===p?" active":"")}>
                      {p==="all"?"Todo tiempo":p==="month"?"Último mes":"Última semana"}
                    </button>
                  ))}
                  <select value={kpiConcierge} onChange={e=>setKpiConcierge(e.target.value)}
                    style={{fontSize:11.5,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"4px 8px",background:"var(--surface)",color:"var(--text-2)"}}>
                    <option value="all">Todos los concierges</option>
                    {CONCIERGE_NAMES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                  {/* KPI type selector + export */}
                  <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
                    <select
                      value={kpiExportType}
                      onChange={e => setKpiExportType(e.target.value)}
                      style={{fontSize:11.5,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"4px 8px",background:"var(--surface)",color:"var(--text-2)"}}
                      title="Qué KPI exportar"
                    >
                      {Object.entries(KPI_EXPORT_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => exportKpiCsv(kickoffs, kpiPeriod, kpiConcierge, kpiExportType)}
                      className="tt-btn-ghost"
                      title="Descargar datos como CSV"
                    >
                      Exportar CSV
                    </button>
                  </div>
                </div>

                {/* Main KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <KpiCard label="Clientes en período" value={kpiFiltered.length} />
                  <KpiCard label="Revenue total" value={fmtRev(kpiTotalRev)} color="text-emerald-700"/>
                  <KpiCard label="ARPC" value={fmtRev(kpiArpc)} sub="avg revenue/cliente"/>
                  <KpiCard label="Servicios promedio" value={kpiAvgSvcs.toFixed(1)} sub="por cliente"/>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  <KpiCard label="Clientes con 2+ servicios" value={kpiPct2plus.toFixed(0) + "%"} sub={kpiFiltered.filter((_,i)=>kpiServiceCounts[i]>=2).length + " de " + kpiFiltered.length}/>
                  <KpiCard label="Sin servicios" value={kpiFiltered.filter((_,i)=>kpiServiceCounts[i]===0).length} sub="sin items confirmados"/>
                  <KpiCard label="Total servicios" value={kpiServiceCounts.reduce((a,b)=>a+b,0)} sub="en todos los kickoffs filtrados"/>
                </div>

                {/* ── Timing metrics ── */}
                <div className="tt-card" style={{padding:20,marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:12}}>
                    <span className="tt-section-title">Tiempos promedio del proceso</span>
                    <span style={{fontSize:11,color:"var(--text-3)"}}>desde creación del link hasta cada etapa</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      {val:avgDaysToEdit, label:"Link → Concierge empieza", sub:`${daysToEdit.filter(v=>v!==null).length} trips`},
                      {val:avgDaysEditToSend, label:"Edición → Itinerario listo", sub:`${daysEditToSend.filter(v=>v!==null).length} trips`, color:"#2563eb"},
                      {val:avgDaysToSend, label:"Link → Contabilidad", sub:"total end-to-end", color:"#16a34a"},
                      {val:sentCount, label:"Enviados a contabilidad", sub:`de ${kpiFiltered.length} en período`, color:"#d97706"},
                    ].map((m,i)=>(
                      <div key={i} style={{background:"var(--bg)",border:"1px solid var(--border-soft)",borderRadius:"var(--radius)",padding:"14px 16px"}}>
                        <div style={{fontSize:20,fontWeight:700,color:m.color||"var(--text-1)",letterSpacing:"-.02em"}}>{m.val}<span style={{fontSize:12,fontWeight:400,color:"var(--text-3)",marginLeft:3}}>días</span></div>
                        <div style={{fontSize:11.5,color:"var(--text-2)",marginTop:3}}>{m.label}</div>
                        <div style={{fontSize:10.5,color:"var(--text-3)",marginTop:1}}>{m.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Pending tasks ── */}
                {pendingRows.length > 0 && (
                  <div className="tt-card" style={{overflow:"hidden",marginBottom:12}}>
                    <div style={{padding:"12px 20px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span className="tt-section-title">Pendientes por concierge</span>
                      <span style={{fontSize:11,color:"var(--text-3)"}}>En edición o listos para procesar</span>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table className="tt-table min-w-full">
                        <thead>
                          <tr>
                            <th style={{textAlign:"left"}}>Concierge</th>
                            <th style={{textAlign:"center"}}>Pendientes</th>
                            <th style={{textAlign:"center"}}>Más antiguo</th>
                            <th style={{textAlign:"left"}}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingRows.map(row => (
                            <tr key={row.name}>
                              <td style={{fontWeight:500}}>{row.name}</td>
                              <td style={{textAlign:"center"}}>
                                <span style={{
                                  display:"inline-flex",alignItems:"center",justifyContent:"center",
                                  width:24,height:24,borderRadius:4,fontSize:11,fontWeight:700,
                                  background: row.pending>=3?"#FEF2F2":row.pending===2?"#FFFBEB":"#EFF6FF",
                                  color: row.pending>=3?"#DC2626":row.pending===2?"#D97706":"#2563EB",
                                }}>
                                  {row.pending}
                                </span>
                              </td>
                              <td style={{textAlign:"center"}}>
                                {row.oldestDays !== null ? (
                                  <span style={{fontSize:12,fontWeight:600,color:row.oldestDays>5?"#DC2626":row.oldestDays>2?"#D97706":"var(--text-3)"}}>
                                    {row.oldestDays}d
                                  </span>
                                ) : "—"}
                              </td>
                              <td>
                                <span className="tt-badge" style={
                                  row.oldestDays>5 ? {background:"#FEF2F2",color:"#DC2626"} :
                                  row.oldestDays>2 ? {background:"#FFFBEB",color:"#D97706"} :
                                                    {background:"#F0FDF4",color:"#16A34A"}
                                }>
                                  {row.oldestDays>5?"Needs attention":row.oldestDays>2?"Review soon":"On track"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Status breakdown */}
                <div className="tt-card" style={{padding:20,marginBottom:12}}>
                  <span className="tt-section-title" style={{display:"block",marginBottom:12}}>Estado de clientes</span>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {Object.entries(kpiStatusMap).map(([s,cnt]) => (
                      <div key={s} style={{display:"flex",alignItems:"center",gap:8,background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"5px 12px"}}>
                        <span style={{fontSize:11.5,color:"var(--text-2)"}}>{STATUS_LABELS[s]?.label || s}</span>
                        <span style={{fontSize:13,fontWeight:700,color:"var(--text-1)"}}>{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Feedback section ── */}
                <div className="bg-white rounded-2xl border border-violet-200 overflow-hidden mb-4">
                  <div className="px-5 py-3 border-b border-violet-100 bg-violet-50 flex items-center gap-2">
                    <span className="text-sm font-semibold text-violet-800">💬 Feedback de clientes</span>
                    <span className="ml-auto text-[11px] text-violet-500">Formularios enviados por clientes</span>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                      <div className="bg-violet-50 rounded-xl border border-violet-100 p-4">
                        <div className="text-2xl font-bold text-violet-700">{kpiFeedbackSubmitted.length}</div>
                        <div className="text-xs text-stone-500 mt-1">Formularios recibidos</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">{kpiFeedbackRate}% de clientes del período</div>
                      </div>
                      <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                        <div className="text-2xl font-bold text-amber-600">{kpiFbAvg} <span className="text-sm font-normal text-stone-400">/ 10 ⭐</span></div>
                        <div className="text-xs text-stone-500 mt-1">Rating promedio</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">{kpiFbRated.length} formularios con score</div>
                      </div>
                      <div className="bg-teal-50 rounded-xl border border-teal-100 p-4">
                        <div className="text-2xl font-bold text-teal-700">{kpiFbRated.filter(k=>Number(k.conciergeRating)>=8).length}</div>
                        <div className="text-xs text-stone-500 mt-1">Scores altos (8–10 ⭐)</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">
                          {kpiFbRated.length ? Math.round(kpiFbRated.filter(k=>Number(k.conciergeRating)>=8).length / kpiFbRated.length * 100) : 0}% satisfacción alta
                        </div>
                      </div>
                    </div>
                    {/* Per-concierge rating breakdown */}
                    {kpiConciergeRows.some(r => r.avgRating !== "—") && (
                      <div>
                        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Rating por concierge</p>
                        <div className="space-y-2">
                          {kpiConciergeRows.filter(r => r.avgRating !== "—").map(row => {
                            const n = Number(row.avgRating);
                            const pct = (n / 10) * 100;
                            const color = n >= 8 ? "bg-teal-400" : n >= 6 ? "bg-amber-400" : "bg-red-400";
                            return (
                              <div key={row.name} className="flex items-center gap-3">
                                <span className="text-xs text-stone-600 w-36 truncate">{row.name}</span>
                                <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                                  <div className={"h-full rounded-full " + color} style={{ width: pct + "%" }} />
                                </div>
                                <span className="text-xs font-semibold text-stone-700 w-10 text-right">{row.avgRating}/10</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-concierge table */}
                {kpiConciergeRows.length > 0 && (
                  <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-stone-700">Breakdown por concierge</h2>
                      <button
                        onClick={() => exportKpiCsv(kickoffs, kpiPeriod, kpiConcierge)}
                        className="px-3 py-1 text-xs rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium"
                      >
                        📥 Exportar
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-stone-50 text-[11px] text-stone-400 uppercase tracking-wide">
                          <tr>
                            <th className="px-5 py-2 text-left font-medium">Concierge</th>
                            <th className="px-5 py-2 text-left font-medium">Ciudad</th>
                            <th className="px-5 py-2 text-center font-medium">Clientes</th>
                            <th className="px-5 py-2 text-right font-medium">Revenue</th>
                            <th className="px-5 py-2 text-center font-medium">Svcs/cliente</th>
                            <th className="px-5 py-2 text-center font-medium">Días promedio</th>
                            <th className="px-5 py-2 text-center font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {kpiConciergeRows.map(row => (
                            <tr key={row.name} className="hover:bg-stone-50">
                              <td className="px-5 py-3 font-medium text-stone-800">{row.name}</td>
                              <td className="px-5 py-3">
                                {row.city ? (
                                  <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 text-[11px] font-semibold">{row.city}</span>
                                ) : <span className="text-stone-400">—</span>}
                              </td>
                              <td className="px-5 py-3 text-center text-stone-600">{row.clients}</td>
                              <td className="px-5 py-3 text-right font-semibold text-emerald-700">{fmtRev(row.revenue)}</td>
                              <td className="px-5 py-3 text-center text-stone-600">{row.avgSvcs}</td>
                              <td className="px-5 py-3 text-center text-blue-600 font-medium">{row.avgDays === "—" ? "—" : row.avgDays + "d"}</td>
                              <td className="px-3 py-3 text-center">
                                <button
                                  onClick={() => exportKpiCsv(kickoffs, kpiPeriod, row.name, kpiExportType)}
                                  title={`Exportar solo ${row.name.split(" ")[0]}`}
                                  className="px-2 py-1 text-[11px] rounded-lg border border-stone-200 bg-white text-stone-500 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition"
                                >
                                  📥
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ══ Gestión tab ══ */}
        {tab === "gestion" && (
          <>
            {kLoading ? (
              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm text-sm text-stone-500">
                Cargando datos de gestión...
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Total kickoffs</p>
                    <p className="mt-2 text-3xl font-semibold">{kTotal}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Activos</p>
                    <p className="mt-2 text-3xl font-semibold">{kActivos}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Score promedio</p>
                    <p className="mt-2 text-3xl font-semibold">{kAvgScore}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Conversión</p>
                    <p className="mt-2 text-3xl font-semibold">{kConversion}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-lg font-semibold mb-4">Distribución por estado</p>
                    <div className="space-y-3">
                      {statusCounts.map(({ key, count }) => {
                        const { label, color } = STATUS_LABELS[key];
                        const pct = kTotal > 0 ? Math.round((count / kTotal) * 100) : 0;
                        return (
                          <div key={key}>
                            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                              <span className="truncate" style={{ color }}>{label}</span>
                              <span className="font-semibold text-stone-700">
                                {count} <span className="text-stone-400 font-normal">({pct}%)</span>
                              </span>
                            </div>
                            <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                              <div className="h-full rounded-full"
                                style={{ width: (count / maxStatusCount) * 100 + "%", backgroundColor: color }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-lg font-semibold mb-4">Tiempo promedio por etapa</p>
                    <div className="space-y-4 text-sm">
                      <div className="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3">
                        <span className="text-stone-600">Creado → Cliente envía</span>
                        <span className="font-semibold">{fmtHours(timeCreatedToClient)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3">
                        <span className="text-stone-600">Cliente → Edición concierge</span>
                        <span className="font-semibold">{fmtHours(timeClientToConcierge)}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl border border-stone-100 px-4 py-3">
                        <span className="text-stone-600">Edición → Feedback</span>
                        <span className="font-semibold">{fmtHours(timeConciergeToFeedback)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                  <p className="text-lg font-semibold mb-4">Top concierges</p>
                  {topConcierges.length ? (
                    <div className="space-y-3">
                      {topConcierges.map(({ name, count }) => (
                        <div key={name}>
                          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <span className="truncate text-stone-700">{name}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                          <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                            <div className="h-full rounded-full bg-stone-800"
                              style={{ width: (count / maxConciergeCount) * 100 + "%" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-500">Sin datos de concierges todavía.</p>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ══ Feedback tab ══ */}
        {tab === "feedback" && (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <select value={destinationFilter} onChange={(e) => setDestinationFilter(e.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                {destinationOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "all" ? "Todos los destinos" : opt}</option>
                ))}
              </select>
              <select value={conciergeFilter} onChange={(e) => setConciergeFilter(e.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                {conciergeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "all" ? "Todos los concierge" : opt}</option>
                ))}
              </select>
              <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
                {languageOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt === "all" ? "Todos los idiomas" : opt}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">Cargando feedback...</div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Total respuestas</p>
                    <p className="mt-2 text-3xl font-semibold">{total}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Promedio general</p>
                    <p className="mt-2 text-3xl font-semibold">{avgScore}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Promedio servicio</p>
                    <p className="mt-2 text-3xl font-semibold">{avgService}</p>
                  </div>
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-sm text-stone-500">Promedio rapidez</p>
                    <p className="mt-2 text-3xl font-semibold">{avgSpeed}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <BarChartCard title="Distribución de scores" data={scoreDistribution} />
                  <BarChartCard title="Destinos" data={destinationsData} />
                </div>
                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <BarChartCard title="Concierge" data={conciergeData} />
                  <BarChartCard title="Idiomas" data={languageData} />
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-lg font-semibold">Último feedback</p>
                    {latest ? (
                      <div className="mt-4 space-y-2 text-sm">
                        <p><span className="text-stone-500">Huésped:</span> <span className="font-semibold">{latest.guestName || "—"}</span></p>
                        <p><span className="text-stone-500">Viaje:</span> <span className="font-semibold">{latest.tripName || "—"}</span></p>
                        <p><span className="text-stone-500">Destino:</span> <span className="font-semibold">{latest.destination || "—"}</span></p>
                        <p><span className="text-stone-500">Score:</span> <span className="font-semibold">{latest.overallExperience || "—"}/10</span></p>
                        <p><span className="text-stone-500">Idioma:</span> <span className="font-semibold">{latest.language || "—"}</span></p>
                        {latest.overallReason && <p><span className="text-stone-500">Comentario:</span> <span className="font-semibold">{latest.overallReason}</span></p>}
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-stone-500">Sin feedback todavía.</p>
                    )}
                  </div>
                  <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                    <p className="text-lg font-semibold">Resumen rápido</p>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="rounded-xl border border-stone-100 px-4 py-3">Usa filtros para ver resultados por destino, concierge o idioma.</div>
                      <div className="rounded-xl border border-stone-100 px-4 py-3">La distribución de scores te muestra si la operación está estable.</div>
                      <div className="rounded-xl border border-stone-100 px-4 py-3">Los comentarios recientes te ayudan a detectar fricciones repetidas.</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                  <p className="text-lg font-semibold mb-4">Comentarios recientes</p>
                  <div className="space-y-3">
                    {recentComments.length ? (
                      recentComments.slice(0, 10).map((item, idx) => (
                        <div key={idx} className="rounded-xl border border-stone-200 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-semibold">{item.guestName || "Sin nombre"}</p>
                              <p className="text-sm text-stone-500">{item.tripName || "Sin viaje"} · {item.destination || "—"}</p>
                            </div>
                            <div className="text-sm font-semibold">Score: {item.overallExperience || "—"}</div>
                          </div>
                          {item.overallReason ? <p className="mt-3 text-sm text-stone-700"><span className="font-semibold">Razón:</span> {item.overallReason}</p> : null}
                          {item.oneThing ? <p className="mt-2 text-sm text-stone-700"><span className="font-semibold">Mejorar:</span> {item.oneThing}</p> : null}
                          {item.stayNotes ? <p className="mt-2 text-sm text-stone-700"><span className="font-semibold">Notas:</span> {item.stayNotes}</p> : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-stone-500">No hay comentarios todavía.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SOPORTE TÉCNICO
════════════════════════════════════════════════════════ */
const SOPORTE_API =
  "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

function SoportePage() {
  const [form, setForm]         = useState({ nombre: "", tipo: "", prioridad: "", titulo: "", descripcion: "" });
  const [saving, setSaving]     = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]       = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const TIPOS = [
    { id: "bug",        label: "🐛 Bug",              desc: "Algo no funciona" },
    { id: "cambio",     label: "✏️ Modificación",     desc: "Cambiar algo existente" },
    { id: "nueva",      label: "✨ Nueva función",     desc: "Agregar algo nuevo" },
    { id: "pregunta",   label: "❓ Pregunta",          desc: "Duda o consulta" },
    { id: "otro",       label: "📌 Otro",              desc: "" },
  ];
  const PRIORIDADES = [
    { id: "alta",   label: "🔴 Alta",   desc: "Bloquea el trabajo" },
    { id: "media",  label: "🟡 Media",  desc: "Molesta pero funciona" },
    { id: "baja",   label: "🟢 Baja",   desc: "Cuando puedas" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.tipo || !form.prioridad || !form.titulo.trim() || !form.descripcion.trim()) {
      setError("Por favor llena todos los campos obligatorios.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch(SOPORTE_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "soporte",
          payload: { ...form, timestamp: new Date().toISOString() },
        }),
      });
      const text = await res.text();
      // Accept ok:true OR any 2xx (GAS may not have the action yet)
      let json = null;
      try { json = JSON.parse(text); } catch {}
      if (json?.ok === false) throw new Error(json.error || "Error al enviar");
      setSubmitted(true);
    } catch (err) {
      // Fallback: open mailto so the message still reaches Michel
      const subject = encodeURIComponent(`[${form.prioridad}] ${form.tipo}: ${form.titulo}`);
      const body    = encodeURIComponent(`De: ${form.nombre || "Anónimo"}\n\n${form.descripcion}`);
      window.open(`mailto:michel@two.travel?subject=${subject}&body=${body}`, "_blank");
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  };

  if (submitted) return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-[28px] border border-stone-200 shadow-sm p-10 max-w-md w-full text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-full bg-emerald-600 flex items-center justify-center text-white text-2xl">✓</div>
        <h2 className="text-2xl font-semibold text-stone-800 mb-2">Caso enviado</h2>
        <p className="text-sm text-stone-500 mb-6">Michel recibirá la notificación por correo.</p>
        <button onClick={() => setSubmitted(false)}
          className="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-800">
          Crear otro caso
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="rounded-[28px] border border-stone-200 bg-white p-8 shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.32em] text-stone-400">Two Travel</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-800">Soporte técnico</h1>
          <p className="mt-2 text-sm text-stone-500 leading-6">
            Reporta un bug, pide un cambio o sugiere algo nuevo. Michel recibe un correo con cada caso.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Nombre */}
          <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-stone-700 mb-2">Tu nombre</label>
            <input
              value={form.nombre}
              onChange={e => set("nombre", e.target.value)}
              placeholder="¿Quién reporta esto?"
              className="w-full rounded-[14px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 outline-none focus:border-stone-400 focus:bg-white transition"
            />
          </div>

          {/* Tipo */}
          <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-stone-700 mb-3">Tipo de caso <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TIPOS.map(t => (
                <button key={t.id} type="button" onClick={() => set("tipo", t.id)}
                  className={`rounded-[14px] border px-4 py-3 text-left text-sm transition ${
                    form.tipo === t.id
                      ? "border-stone-800 bg-stone-100 text-stone-900"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}>
                  <div className="font-medium">{t.label}</div>
                  {t.desc && <div className="text-[11px] text-stone-400 mt-0.5">{t.desc}</div>}
                </button>
              ))}
            </div>
          </div>

          {/* Prioridad */}
          <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-stone-700 mb-3">Prioridad <span className="text-red-400">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {PRIORIDADES.map(p => (
                <button key={p.id} type="button" onClick={() => set("prioridad", p.id)}
                  className={`rounded-[14px] border px-4 py-3 text-left text-sm transition ${
                    form.prioridad === p.id
                      ? "border-stone-800 bg-stone-100 text-stone-900"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}>
                  <div className="font-medium">{p.label}</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Título + Descripción */}
          <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Título del caso <span className="text-red-400">*</span></label>
              <input
                value={form.titulo}
                onChange={e => set("titulo", e.target.value)}
                placeholder="Resume el problema en una línea"
                className="w-full rounded-[14px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 outline-none focus:border-stone-400 focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">Descripción <span className="text-red-400">*</span></label>
              <textarea
                value={form.descripcion}
                onChange={e => set("descripcion", e.target.value)}
                rows={5}
                placeholder="Explica qué pasó, en qué página, qué esperabas que pasara…"
                className="w-full rounded-[14px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400 focus:bg-white transition resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 px-2">{error}</p>
          )}

          <button type="submit" disabled={saving}
            className="w-full rounded-full bg-stone-800 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
            {saving ? "Enviando…" : "Enviar caso"}
          </button>

        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   SOPORTE DASHBOARD
════════════════════════════════════════════════════════ */
const STATUS_COLORS = {
  abierto:      "bg-red-100 text-red-700",
  "en progreso":"bg-amber-100 text-amber-700",
  cerrado:      "bg-emerald-100 text-emerald-700",
};
const PRIORITY_COLORS = {
  alta:  "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-700",
  baja:  "bg-emerald-100 text-emerald-700",
};
const TIPO_LABELS = {
  bug:      "🐛 Bug",
  cambio:   "✏️ Modificación",
  nueva:    "✨ Nueva función",
  pregunta: "❓ Pregunta",
  otro:     "📌 Otro",
};

function SoporteDashboard() {
  const [cases, setCases]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState(null);
  const [filterStatus, setFilter] = useState("todos");
  const [updatingId, setUpdatingId] = useState(null);
  const [showClosed, setShowClosed] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res  = await fetch(SOPORTE_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "listSoporte" }),
      });
      const json = await res.json();
      if (json.ok === false) throw new Error(json.error || "Error");
      setCases(json.data || []);
    } catch (e) {
      setError("No se pudo cargar los casos. Verifica el Apps Script.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (caso, newStatus) => {
    setUpdatingId(caso.id);
    try {
      await fetch(SOPORTE_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "updateSoporte", id: caso.id, updates: { status: newStatus } }),
      });
      setCases(prev => prev.map(c => c.id === caso.id ? { ...c, status: newStatus } : c));
      if (selected?.id === caso.id) setSelected(s => ({ ...s, status: newStatus }));
    } catch {}
    setUpdatingId(null);
  };

  const filtered = cases.filter(c => {
    const st = c.status || "abierto";
    if (!showClosed && st === "cerrado") return false;
    if (filterStatus !== "todos" && st !== filterStatus) return false;
    return true;
  });

  const counts = {
    todos:        cases.length,
    abierto:      cases.filter(c => (c.status || "abierto") === "abierto").length,
    "en progreso":cases.filter(c => (c.status || "abierto") === "en progreso").length,
    cerrado:      cases.filter(c => (c.status || "abierto") === "cerrado").length,
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/?mode=concierge" className="text-stone-400 hover:text-stone-700 text-sm">← Panel</a>
          <span className="text-stone-300">|</span>
          <h1 className="text-base font-semibold text-stone-800">🛠 Soporte Técnico</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load}
            className="px-3 py-1.5 text-xs border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50 transition">
            ↻ Actualizar
          </button>
          <button onClick={() => setShowClosed(v => !v)}
            className={`px-3 py-1.5 text-xs border rounded-lg transition ${showClosed ? "bg-stone-200 text-stone-600 border-stone-300" : "bg-white border-stone-200 text-stone-400 hover:bg-stone-50"}`}>
            {showClosed
              ? `Ocultar cerrados (${cases.filter(c=>(c.status||"abierto")==="cerrado").length})`
              : `+ Mostrar cerrados (${cases.filter(c=>(c.status||"abierto")==="cerrado").length})`}
          </button>
          <a href="/?mode=soporte" target="_blank" rel="noreferrer"
            className="px-3 py-1.5 text-xs bg-stone-800 text-white rounded-lg hover:opacity-90 transition font-medium">
            + Nuevo caso
          </a>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { key: "todos",         label: "Total",       icon: "📋", color: "border-stone-200 bg-white" },
            { key: "abierto",       label: "Abiertos",    icon: "🔴", color: "border-red-200 bg-red-50" },
            { key: "en progreso",   label: "En progreso", icon: "🟡", color: "border-amber-200 bg-amber-50" },
            { key: "cerrado",       label: "Cerrados",    icon: "🟢", color: "border-emerald-200 bg-emerald-50" },
          ].map(s => (
            <button key={s.key} onClick={() => setFilter(s.key)}
              className={`rounded-xl border p-4 text-left transition hover:opacity-80 ${s.color} ${filterStatus === s.key ? "ring-2 ring-stone-400" : ""}`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-stone-800">{counts[s.key]}</div>
              <div className="text-xs text-stone-500">{s.label}</div>
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-16 text-stone-400 text-sm">Cargando casos…</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-4">
            {error}
            <button onClick={load} className="ml-3 underline">Reintentar</button>
          </div>
        )}

        {!loading && !error && (
          <div className="flex gap-4">
            {/* Cases list */}
            <div className="flex-1 min-w-0">
              {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-stone-400 text-sm">
                  No hay casos {filterStatus !== "todos" ? `con estado "${filterStatus}"` : ""}.
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map(c => {
                    const status = c.status || "abierto";
                    const isOpen = selected?.id === c.id;
                    return (
                      <div key={c.id}
                        onClick={() => setSelected(isOpen ? null : c)}
                        className={`bg-white rounded-xl border cursor-pointer transition hover:shadow-sm ${isOpen ? "border-stone-400 shadow-sm" : "border-stone-200"}`}>
                        <div className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[status]}`}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[c.prioridad] || "bg-stone-100 text-stone-500"}`}>
                                {c.prioridad ? c.prioridad.charAt(0).toUpperCase() + c.prioridad.slice(1) : "—"}
                              </span>
                              <span className="text-[10px] text-stone-400">
                                {TIPO_LABELS[c.tipo] || c.tipo}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-stone-800 truncate">{c.titulo || "Sin título"}</p>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {c.nombre || "Anónimo"} · {c.timestamp ? new Date(c.timestamp).toLocaleDateString("es-CO", { day:"2-digit", month:"short", year:"numeric" }) : "—"}
                            </p>
                          </div>
                          <span className="text-stone-300 text-xs mt-1">{isOpen ? "▲" : "▼"}</span>
                        </div>

                        {/* Expanded detail */}
                        {isOpen && (
                          <div className="border-t border-stone-100 px-4 py-3" onClick={e => e.stopPropagation()}>
                            <p className="text-sm text-stone-600 mb-3 whitespace-pre-wrap">{c.descripcion || "Sin descripción."}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-stone-400 mr-1">Cambiar estado:</span>
                              {["abierto","en progreso","cerrado"].map(s => (
                                <button key={s} disabled={updatingId === c.id || status === s}
                                  onClick={() => updateStatus(c, s)}
                                  className={`px-2.5 py-1 text-xs rounded-lg border transition disabled:opacity-40 ${STATUS_COLORS[s] || "bg-stone-50 text-stone-500 border-stone-200"} border-transparent`}>
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════
   KPI DASHBOARD  (?mode=kpi)
   Reads kickoffs from sheet, calculates all KPIs client-side.
   No additional GAS needed.
════════════════════════════════════════════════════════ */
const CONCIERGE_NAMES = [
  "Alia Jadad","Carolina Lopez","Daniela Becerra",
  "Nataly Cruz","Giulia Lorini Serrato","Natalia Peniche",
];
// Email map for task assignment
const CONCIERGE_EMAILS = {
  "Alia Jadad":            "alia@two.travel",
  "Carolina Lopez":        "caro@two.travel",
  "Daniela Becerra":       "daniela@two.travel",
  "Nataly Cruz":           "nataly@two.travel",
  "Giulia Lorini Serrato": "giulia@two.travel",
  "Natalia Peniche":       "natalia@two.travel",
};
// City map for KPI breakdown
const CONCIERGE_CITIES = {
  "Alia Jadad":            "CTG",
  "Carolina Lopez":        "CTG",
  "Daniela Becerra":       "MDE",
  "Nataly Cruz":           "CDMX",
  "Giulia Lorini Serrato": "CDMX",
  "Natalia Peniche":       "CDMX",
};

// KPI export presets — each defines which columns to include
const KPI_EXPORT_TYPES = {
  all:      { label: "📊 Completo",    emoji: "📊", cols: ["id","guestName","tripName","city","concierge","status","clientType","arrivalDate","departureDate","services","revenue","rating","createdAt"] },
  ratings:  { label: "⭐ Ratings",     emoji: "⭐", cols: ["guestName","tripName","city","concierge","arrivalDate","rating","createdAt"] },
  revenue:  { label: "💰 Revenue",     emoji: "💰", cols: ["guestName","tripName","city","concierge","arrivalDate","departureDate","services","revenue","status"] },
  services: { label: "🛎 Servicios",   emoji: "🛎", cols: ["guestName","tripName","city","concierge","services","status","arrivalDate"] },
  feedback: { label: "💬 Feedback",    emoji: "💬", cols: ["guestName","tripName","city","concierge","rating","status","arrivalDate","createdAt"] },
};

const COL_HEADERS = {
  id: "ID", guestName: "Huésped", tripName: "Viaje", city: "Ciudad",
  concierge: "Concierge", status: "Estado", clientType: "Tipo",
  arrivalDate: "Llegada", departureDate: "Salida", services: "Servicios",
  revenue: "Revenue USD", rating: "Rating ⭐", createdAt: "Creado",
};

function exportKpiCsv(kickoffs, period = "all", conciergeFilter = "all", kpiType = "all") {
  const now = new Date();
  const filtered = kickoffs.filter(k => {
    if (period !== "all") {
      const d = new Date(k.createdAt || "");
      if (isNaN(d)) return false;
      const diffDays = (now - d) / 86400000;
      if (period === "week"  && diffDays > 7)  return false;
      if (period === "month" && diffDays > 30) return false;
    }
    if (conciergeFilter !== "all") {
      const names = String(k.assignedConcierge || k.assignedConciergeName || "").split(",").map(s=>s.trim());
      if (!names.includes(conciergeFilter)) return false;
    }
    // For ratings export: only include rows that have a rating
    if (kpiType === "ratings" || kpiType === "feedback") {
      if (!k.conciergeRating) return false;
    }
    return true;
  });

  const preset = KPI_EXPORT_TYPES[kpiType] || KPI_EXPORT_TYPES.all;
  const cols   = preset.cols;

  const getVal = (k, col) => {
    const cart = Array.isArray(k.cart) ? k.cart
      : (typeof k.cart === "string" ? (() => { try { return JSON.parse(k.cart); } catch { return []; } })() : []);
    const confirmedCart = cart.filter(it => it.confirmed !== false);
    switch (col) {
      case "id":           return k.id || "";
      case "guestName":    return k.guestName || "";
      case "tripName":     return k.tripName || "";
      case "city":         return k.city || "";
      case "concierge":    return (k.assignedConcierge || k.assignedConciergeName || "").split(",").map(s=>s.trim()).join(" / ");
      case "status":       return k.status || "";
      case "clientType":   return k.clientType || "1";
      case "arrivalDate":  return k.arrivalDate || "";
      case "departureDate":return k.departureDate || "";
      case "services":     return confirmedCart.length;
      case "revenue":      return confirmedCart.reduce((s, it) => s + Number(it.priceUsd || it.price_tier_1 || it.price || 0), 0).toFixed(0);
      case "rating": {
        try {
          const cr = (()=>{ try { return JSON.parse(k.cityRatings||"[]"); } catch { return []; } })().filter(r => Number(r.rating) > 0);
          if (cr.length) return (cr.reduce((s,r) => s+Number(r.rating),0)/cr.length).toFixed(1);
        } catch {}
        return k.conciergeRating || "";
      }
      case "createdAt":    return (k.createdAt || "").slice(0, 10);
      default:             return "";
    }
  };

  const headers = cols.map(c => COL_HEADERS[c] || c);
  const rows    = filtered.map(k => cols.map(c => getVal(k, c)));

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  const suffix = conciergeFilter !== "all" ? `_${conciergeFilter.split(" ")[0]}` : "";
  const typeSuffix = kpiType !== "all" ? `_${kpiType}` : "";
  a.download = `TwoTravel_KPI${typeSuffix}${suffix}_${period}_${now.toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ════════════════════════════════════════════════════════
   TASK TRACKER  (?mode=tasks)
   Tasks live in a "Tasks" sheet tab, managed via GAS.
════════════════════════════════════════════════════════ */
const TASK_API = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

const TASK_STATUS = {
  pending:     { label: "Pendiente",   cls: "bg-amber-100 text-amber-700" },
  in_progress: { label: "En progreso", cls: "bg-blue-100 text-blue-700" },
  blocked:     { label: "Bloqueado",   cls: "bg-orange-100 text-orange-700" },
  completed:   { label: "Completado",  cls: "bg-emerald-100 text-emerald-700" },
  late:        { label: "Vencida",     cls: "bg-red-100 text-red-700" },
};
const TASK_PRIORITY = {
  alta:  { label: "🔴 Alta",  cls: "text-red-600 bg-red-50 border-red-200" },
  media: { label: "🟡 Media", cls: "text-amber-600 bg-amber-50 border-amber-200" },
  baja:  { label: "⚪ Baja",  cls: "text-stone-500 bg-stone-50 border-stone-200" },
};

function TaskTracker() {
  const [tasks, setTasks]       = useState([]);
  const [kickoffs, setKickoffs] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [view, setView]         = useState("board"); // "board" | "table" | "calendar" | "cards"
  const [filterUser, setFilterUser]         = useState("all");
  const [filterStatus, setFilterStatus]     = useState("all");
  const [filterKickoff, setFilterKickoff]   = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [searchName, setSearchName]         = useState("");
  const [showCompleted, setShowCompleted]   = useState(false);
  const [loadError, setLoadError]           = useState("");
  // Calendar state (must be at component level — hooks can't be inside render)
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [form, setForm] = useState({
    taskName:"", assignedTo:"", assignedEmail:"", dueDate:"",
    notes:"", kickoffId:"", kickoffName:"", priority:"media", imageUrl:"",
  });
  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = async () => {
    setLoading(true); setLoadError("");
    try {
      const res  = await fetch(`${TASK_API}?action=listTasks`);
      const text = await res.text();
      let json = {};
      try { json = JSON.parse(text); } catch {
        setLoadError("Respuesta inválida: " + text?.slice(0, 200));
        setLoading(false); return;
      }
      if (json?.ok === false) { setLoadError("Error: " + (json.error||"desconocido")); setLoading(false); return; }
      const now2 = new Date(); now2.setHours(0,0,0,0);
      const loaded = (Array.isArray(json.data) ? json.data : []).map(t => ({
        ...t,
        status: t.status === "completed"  ? "completed"
              : t.status === "in_progress" ? "in_progress"
              : t.status === "blocked"     ? "blocked"
              : (t.dueDate && new Date(t.dueDate) < now2) ? "late"
              : t.status || "pending",
      }));
      setTasks(loaded);
    } catch(err) { setLoadError("No se pudo conectar al script: " + err.message); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetchKickoffsFromSheet()
      .then(data => setKickoffs(
        (Array.isArray(data) ? data : [])
          .filter(k => k.status !== "done" && k.status !== "cerrado")
          .sort((a,b) => (a.guestName||"").localeCompare(b.guestName||""))
      )).catch(()=>{});
  }, []);

  const saveTask = async () => {
    if (!form.taskName.trim() || !form.assignedTo || !form.dueDate)
      return alert("Llena nombre, asignado y fecha.");
    setSaving(true);
    try {
      const payload = {
        ...form,
        assignedEmail: form.assignedEmail || CONCIERGE_EMAILS[form.assignedTo] || "",
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      await fetch(TASK_API, { method:"POST", mode:"no-cors",
        headers:{"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({ action:"saveTask", payload }),
      });
      setForm({ taskName:"", assignedTo:"", assignedEmail:"", dueDate:"", notes:"", kickoffId:"", kickoffName:"", priority:"media", imageUrl:"" });
      setShowForm(false);
      setTimeout(() => load(), 1500);
    } catch(err) { alert("Error al guardar: " + err.message); }
    setSaving(false);
  };

  const updateTaskField = async (id, updates) => {
    try {
      await fetch(TASK_API, { method:"POST", mode:"no-cors",
        headers:{"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({ action:"updateTask", payload:{
          id, ...updates,
          ...(updates.status==="completed" ? { completedAt: new Date().toISOString() } : {}),
        }}),
      });
      setTasks(prev => prev.map(t => t.id===id ? {...t,...updates} : t));
    } catch {}
  };

  const now = new Date(); now.setHours(0,0,0,0);

  const filtered = tasks.filter(t => {
    if (!showCompleted && t.status === "completed") return false;
    if (filterUser !== "all"     && t.assignedTo !== filterUser)   return false;
    if (filterStatus !== "all"   && t.status !== filterStatus)     return false;
    if (filterKickoff !== "all"  && t.kickoffId !== filterKickoff) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      if (!String(t.assignedTo||"").toLowerCase().includes(q) &&
          !String(t.taskName||"").toLowerCase().includes(q) &&
          !String(t.kickoffName||"").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group by trip for table view
  const grouped = (() => {
    const map = new Map();
    filtered.forEach(t => {
      const key  = t.kickoffId || "__none__";
      const name = t.kickoffName || (t.kickoffId ? t.kickoffId : "Sin trip asignado");
      if (!map.has(key)) map.set(key, { name, tasks:[] });
      map.get(key).tasks.push(t);
    });
    return [...map.entries()].sort(([ka],[kb]) => {
      if (ka==="__none__") return 1;
      if (kb==="__none__") return -1;
      return map.get(ka).name.localeCompare(map.get(kb).name);
    });
  })();

  // Leaderboard
  const leaderboard = {};
  tasks.forEach(t => {
    if (t.status==="completed") return;
    const u = t.assignedTo || "?";
    leaderboard[u] = (leaderboard[u]||0)+1;
  });
  const lbRows = Object.entries(leaderboard).sort((a,b)=>b[1]-a[1]);

  const StatusSelect = ({ t }) => (
    <select value={t.status==="late"?"pending":t.status}
      onChange={e => updateTaskField(t.id, { status: e.target.value })}
      className={`text-[11px] font-semibold border rounded-full px-2 py-0.5 cursor-pointer focus:outline-none ${(TASK_STATUS[t.status]||TASK_STATUS.pending).cls}`}>
      {Object.entries(TASK_STATUS).filter(([k])=>k!=="late").map(([k,v])=>(
        <option key={k} value={k}>{v.label}</option>
      ))}
    </select>
  );

  const PriorityBadge = ({ t }) => {
    const p = TASK_PRIORITY[t.priority] || TASK_PRIORITY.media;
    return (
      <select value={t.priority||"media"}
        onChange={e => updateTaskField(t.id, { priority: e.target.value })}
        className={`text-[10px] border rounded px-1.5 py-0.5 cursor-pointer focus:outline-none ${p.cls}`}>
        {Object.entries(TASK_PRIORITY).map(([k,v])=>(
          <option key={k} value={k}>{v.label}</option>
        ))}
      </select>
    );
  };

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      {/* Header */}
      <header className="tt-topbar">
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <a href="/?mode=concierge" style={{fontSize:12,color:"var(--text-3)",textDecoration:"none",fontWeight:500}}>← Panel</a>
          <span style={{width:1,height:14,background:"var(--border)",display:"inline-block"}}/>
          <span style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>Tasks</span>
          <span style={{fontSize:11,fontWeight:500,background:"var(--border-soft)",color:"var(--text-3)",padding:"2px 8px",borderRadius:3}}>
            {tasks.filter(t=>t.status!=="completed").length} open
          </span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{display:"flex",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",overflow:"hidden"}}>
            {[["board","Board"],["table","Table"],["calendar","Calendar"]].map(([v,lbl])=>(
              <button key={v} onClick={()=>setView(v)}
                style={{
                  padding:"5px 12px",fontSize:11.5,fontWeight:500,border:"none",cursor:"pointer",
                  background:view===v?"#111":"transparent",
                  color:view===v?"#fff":"var(--text-2)",
                  transition:"background .1s",
                }}>
                {lbl}
              </button>
            ))}
          </div>
          <button onClick={()=>setShowForm(v=>!v)} className="tt-btn-primary">
            + New Task
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6" style={{display:"flex",flexDirection:"column",gap:16}}>

        {/* ── New task form ── */}
        {showForm && (
          <div className="tt-card" style={{padding:20,display:"flex",flexDirection:"column",gap:16}}>
            <p style={{fontSize:12,fontWeight:600,color:"var(--text-1)",margin:0}}>Nueva tarea</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:11,color:"var(--text-3)",fontWeight:500}}>Trip / Deal</label>
                <select value={form.kickoffId} onChange={e => {
                  const k = kickoffs.find(k => k.id === e.target.value);
                  setF("kickoffId", e.target.value);
                  setF("kickoffName", k ? (k.guestName || k.tripName || "") : "");
                }} style={{marginTop:4,width:"100%",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"7px 10px",fontSize:12.5,background:"var(--surface)",color:"var(--text-1)"}}>
                  <option value="">Sin trip asignado</option>
                  {kickoffs.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.guestName || "—"}{k.tripName ? ` · ${k.tripName}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:11,color:"var(--text-3)",fontWeight:500}}>Nombre de la tarea *</label>
                <input value={form.taskName} onChange={e=>setF("taskName",e.target.value)}
                  style={{marginTop:4,width:"100%",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"7px 10px",fontSize:12.5,boxSizing:"border-box"}}
                  placeholder="Ej: Confirmar reserva Celele para Martínez"/>
              </div>
              <div>
                <label style={{fontSize:11,color:"var(--text-3)",fontWeight:500}}>Asignado a *</label>
                <select value={form.assignedTo} onChange={e=>{
                  setF("assignedTo", e.target.value);
                  setF("assignedEmail", CONCIERGE_EMAILS[e.target.value]||"");
                }} style={{marginTop:4,width:"100%",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"7px 10px",fontSize:12.5,background:"var(--surface)"}}>
                  <option value="">Seleccionar…</option>
                  {CONCIERGE_NAMES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:"var(--text-3)",fontWeight:500}}>Fecha límite *</label>
                <input type="date" value={form.dueDate} onChange={e=>setF("dueDate",e.target.value)}
                  style={{marginTop:4,width:"100%",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"7px 10px",fontSize:12.5,boxSizing:"border-box"}}/>
              </div>
              <div>
                <label style={{fontSize:11,color:"var(--text-3)",fontWeight:500}}>Prioridad</label>
                <select value={form.priority} onChange={e=>setF("priority",e.target.value)}
                  style={{marginTop:4,width:"100%",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"7px 10px",fontSize:12.5,background:"var(--surface)"}}>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:11,color:"var(--text-3)",fontWeight:500}}>Notas</label>
                <textarea value={form.notes} onChange={e=>setF("notes",e.target.value)} rows={2}
                  style={{marginTop:4,width:"100%",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"7px 10px",fontSize:12.5,resize:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{gridColumn:"1/-1"}}>
                <label style={{fontSize:11,color:"var(--text-3)",fontWeight:500}}>Imagen (URL)</label>
                <input value={form.imageUrl} onChange={e=>setF("imageUrl",e.target.value)}
                  style={{marginTop:4,width:"100%",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"7px 10px",fontSize:12.5,boxSizing:"border-box"}}
                  placeholder="https://drive.google.com/file/d/..."/>
                {form.imageUrl && (
                  <img src={form.imageUrl} alt="preview" style={{marginTop:8,height:64,borderRadius:"var(--radius-sm)",objectFit:"cover",border:"1px solid var(--border)"}} onError={e=>e.target.style.display="none"}/>
                )}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={saveTask} disabled={saving} className="tt-btn-primary" style={{opacity:saving?.5:1}}>
                {saving?"Guardando…":"Guardar tarea"}
              </button>
              <button onClick={()=>setShowForm(false)} className="tt-btn-ghost">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16}}>
          {/* ── Main content ── */}
          <div className={view === "board" ? "lg:col-span-4" : "lg:col-span-3"}>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>

            {/* Filters bar — hidden in board view to save space */}
            {view !== "board" && (
            <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:"var(--radius-md)",padding:"8px 12px"}}>
              <input value={searchName} onChange={e=>setSearchName(e.target.value)}
                placeholder="Search…"
                style={{fontSize:12,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"5px 9px",background:"var(--bg)",width:120}}/>
              <select value={filterKickoff} onChange={e=>setFilterKickoff(e.target.value)}
                style={{fontSize:12,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"5px 9px",background:"var(--surface)",maxWidth:160}}>
                <option value="all">All trips</option>
                {kickoffs.map(k=>(
                  <option key={k.id} value={k.id}>{k.guestName||k.tripName||k.id}</option>
                ))}
              </select>
              <select value={filterUser} onChange={e=>setFilterUser(e.target.value)}
                style={{fontSize:12,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"5px 9px",background:"var(--surface)"}}>
                <option value="all">All</option>
                {CONCIERGE_NAMES.map(u=><option key={u} value={u}>{u.split(" ")[0]}</option>)}
              </select>
              <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}
                style={{fontSize:12,border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",padding:"5px 9px",background:"var(--surface)"}}>
                <option value="all">Priority</option>
                <option value="alta">High</option>
                <option value="media">Medium</option>
                <option value="baja">Low</option>
              </select>
              <button onClick={()=>setShowCompleted(v=>!v)}
                style={{fontSize:11.5,padding:"5px 10px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",background:showCompleted?"#111":"transparent",color:showCompleted?"#fff":"var(--text-3)",cursor:"pointer"}}>
                {showCompleted ? `Hide done (${tasks.filter(t=>t.status==="completed").length})` : `Show done (${tasks.filter(t=>t.status==="completed").length})`}
              </button>
              <button onClick={load} style={{marginLeft:"auto",fontSize:12,color:"var(--text-3)",background:"none",border:"none",cursor:"pointer"}}>↻</button>
            </div>
            )}

            {loadError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 font-mono break-all">
                <p className="font-semibold mb-1">Error loading tasks:</p>{loadError}
              </div>
            )}

            {loading ? (
              <div className="text-center py-10 text-stone-400 text-sm">Loading…</div>
            ) : view === "board" ? (() => {
              /* ══ BOARD / KANBAN VIEW ══ */
              const COLS = [
                { id:"todo",        label:"TO DO",        statuses:["pending","late"],  dot:"bg-stone-400",   count: tasks.filter(t=>["pending","late"].includes(t.status)).length },
                { id:"in_progress", label:"IN PROGRESS",  statuses:["in_progress"],     dot:"bg-blue-500",    count: tasks.filter(t=>t.status==="in_progress").length },
                { id:"in_review",   label:"IN REVIEW",    statuses:["blocked"],         dot:"bg-violet-500",  count: tasks.filter(t=>t.status==="blocked").length },
                { id:"done",        label:"DONE",         statuses:["completed"],       dot:"bg-emerald-500", count: tasks.filter(t=>t.status==="done"||t.status==="completed").length },
              ];
              const statusForCol = { todo:"pending", in_progress:"in_progress", in_review:"blocked", done:"completed" };
              // Assignee color map
              const AVATAR_COLORS = ["bg-stone-700","bg-rose-600","bg-blue-600","bg-amber-600","bg-emerald-600","bg-violet-600"];
              const avatarColor = (() => {
                const map = {};
                CONCIERGE_NAMES.forEach((n,i) => { map[n] = AVATAR_COLORS[i % AVATAR_COLORS.length]; });
                return (name) => map[name] || "bg-stone-500";
              })();
              const initials = (name) => (name||"?").split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
              return (
                <div className="flex gap-4 overflow-x-auto pb-4" style={{minHeight:"60vh"}}>
                  {COLS.map(col => {
                    const colTasks = tasks.filter(t => {
                      if (!col.statuses.includes(t.status)) return false;
                      if (filterUser !== "all" && t.assignedTo !== filterUser) return false;
                      if (filterKickoff !== "all" && t.kickoffId !== filterKickoff) return false;
                      if (searchName.trim()) {
                        const q = searchName.trim().toLowerCase();
                        if (!String(t.taskName||"").toLowerCase().includes(q) &&
                            !String(t.kickoffName||"").toLowerCase().includes(q) &&
                            !String(t.assignedTo||"").toLowerCase().includes(q)) return false;
                      }
                      return true;
                    });
                    return (
                      <div key={col.id} style={{flexShrink:0,width:272,display:"flex",flexDirection:"column",gap:8}}>
                        {/* Column header */}
                        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 4px"}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:col.dot.replace("bg-","").replace("stone-400","#9CA3AF").replace("blue-500","#3B82F6").replace("violet-500","#8B5CF6").replace("emerald-500","#10B981"),flexShrink:0,background:col.id==="todo"?"#9CA3AF":col.id==="in_progress"?"#3B82F6":col.id==="in_review"?"#8B5CF6":"#10B981"}}/>
                          <span style={{fontSize:11,fontWeight:600,color:"var(--text-2)",letterSpacing:".04em"}}>{col.label}</span>
                          <span style={{marginLeft:"auto",fontSize:10.5,fontWeight:500,color:"var(--text-3)",background:"var(--border-soft)",borderRadius:3,padding:"1px 6px"}}>{colTasks.length}</span>
                        </div>
                        {/* Cards */}
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {colTasks.map(t => {
                            const due = t.dueDate ? new Date(t.dueDate) : null;
                            const dl  = due ? Math.round((due-now)/86400000) : null;
                            const isLate = t.status === "late" || (dl !== null && dl < 0 && t.status !== "completed");
                            return (
                              <div key={t.id} className="tt-card" style={{padding:12,cursor:"default",border:isLate?"1px solid #FCA5A5":undefined}}>
                                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:6}}>
                                  <p style={{fontSize:12.5,fontWeight:500,color:"var(--text-1)",lineHeight:1.4,textDecoration:t.status==="completed"?"line-through":"none",opacity:t.status==="completed"?.5:1,margin:0}}>{t.taskName}</p>
                                  {isLate && <span style={{fontSize:9,color:"#EF4444",fontWeight:600,background:"#FEF2F2",border:"1px solid #FCA5A5",borderRadius:3,padding:"2px 5px",flexShrink:0}}>LATE</span>}
                                </div>
                                {t.kickoffName && (
                                  <p style={{fontSize:10.5,color:"var(--text-3)",marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                    {t.kickoffName}{t.city ? ` — ${t.city}` : ""}
                                  </p>
                                )}
                                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginTop:6}}>
                                  {t.assignedTo ? (
                                    <span style={{fontSize:10,color:"#fff",fontWeight:700,borderRadius:3,padding:"2px 6px",background:"#374151"}}>
                                      {initials(t.assignedTo)}
                                    </span>
                                  ) : <span/>}
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:"auto"}}>
                                    {dl !== null && t.status !== "completed" && (
                                      <span style={{fontSize:10,color:isLate?"#EF4444":dl<=2?"#D97706":"var(--text-3)"}}>
                                        {isLate ? `${Math.abs(dl)}d ago` : dl===0 ? "Today" : `In ${dl}d`}
                                      </span>
                                    )}
                                    <select
                                      value={t.status==="late"?"pending":t.status}
                                      onChange={e=>updateTaskField(t.id,{status:e.target.value})}
                                      style={{fontSize:10,border:"1px solid var(--border)",borderRadius:3,padding:"2px 6px",background:"var(--surface)",color:"var(--text-2)",cursor:"pointer"}}
                                      onClick={e=>e.stopPropagation()}
                                    >
                                      {Object.entries(TASK_STATUS).filter(([k])=>k!=="late").map(([k,v])=>(
                                        <option key={k} value={k}>{v.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {/* Add task shortcut */}
                          <button onClick={()=>setShowForm(v=>!v)}
                            style={{width:"100%",textAlign:"left",fontSize:11.5,color:"var(--text-3)",padding:"8px 12px",borderRadius:"var(--radius-sm)",border:"1px dashed var(--border)",background:"transparent",cursor:"pointer"}}>
                            + Add Task
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }) : view === "calendar" ? (() => {
              /* ══ CALENDAR VIEW — uses component-level calYear/calMonth state ══ */
              const cy = calYear, cm = calMonth;
              const firstDay    = new Date(cy, cm, 1).getDay();
              const daysInMonth = new Date(cy, cm+1, 0).getDate();
              const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
              const tasksByDay = {};
              tasks.filter(t=>t.status!=="completed").forEach(t => {
                if (!t.dueDate) return;
                const d = new Date(t.dueDate);
                if (d.getFullYear()===cy && d.getMonth()===cm) {
                  const k = d.getDate();
                  if (!tasksByDay[k]) tasksByDay[k] = [];
                  tasksByDay[k].push(t);
                }
              });
              const AVATAR_COLORS = ["bg-stone-700","bg-rose-600","bg-blue-600","bg-amber-600","bg-emerald-600","bg-violet-600"];
              const avatarColor = (name) => {
                const idx = CONCIERGE_NAMES.indexOf(name);
                return idx >= 0 ? AVATAR_COLORS[idx % AVATAR_COLORS.length] : "bg-stone-500";
              };
              const prevMonth = () => { if(cm===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
              const nextMonth = () => { if(cm===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };
              return (
                <div className="tt-card" style={{overflow:"hidden"}}>
                  {/* Cal nav */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:"1px solid var(--border)"}}>
                    <button onClick={prevMonth} style={{padding:"4px 8px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:16,color:"var(--text-2)"}}>‹</button>
                    <span style={{fontSize:13,fontWeight:600,color:"var(--text-1)"}}>{MONTHS[cm]} {cy}</span>
                    <button onClick={nextMonth} style={{padding:"4px 8px",borderRadius:"var(--radius-sm)",border:"1px solid var(--border)",background:"transparent",cursor:"pointer",fontSize:16,color:"var(--text-2)"}}>›</button>
                  </div>
                  {/* Day headers */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--border)",background:"var(--bg)"}}>
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(
                      <div key={d} style={{textAlign:"center",fontSize:10,fontWeight:600,color:"var(--text-3)",padding:"8px 0",textTransform:"uppercase",letterSpacing:".04em"}}>{d}</div>
                    ))}
                  </div>
                  {/* Grid */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
                    {Array.from({length: firstDay}).map((_,i)=>(
                      <div key={"empty-"+i} style={{minHeight:88,borderBottom:"1px solid var(--border-soft)",borderRight:"1px solid var(--border-soft)",background:"var(--bg)"}}/>
                    ))}
                    {Array.from({length: daysInMonth}).map((_,i) => {
                      const day = i+1;
                      const dayTasks = tasksByDay[day] || [];
                      const isToday = new Date().getDate()===day && new Date().getMonth()===cm && new Date().getFullYear()===cy;
                      const hasLate  = dayTasks.some(t=>t.status==="late"||(t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=="completed"));
                      return (
                        <div key={day} style={{minHeight:88,borderBottom:"1px solid var(--border-soft)",borderRight:"1px solid var(--border-soft)",padding:6,background:hasLate?"#FFF8F8":"transparent"}}>
                          <div style={{fontSize:11,fontWeight:600,marginBottom:4,width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",background:isToday?"#111":"transparent",color:isToday?"#fff":"var(--text-3)"}}>{day}</div>
                          <div style={{display:"flex",flexDirection:"column",gap:2}}>
                            {dayTasks.slice(0,3).map(t => (
                              <div key={t.id} title={`${t.taskName} — ${t.assignedTo||"?"}`}
                                style={{fontSize:9,color:"#fff",borderRadius:2,padding:"2px 5px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",background:"#374151"}}>
                                {t.taskName}
                              </div>
                            ))}
                            {dayTasks.length>3 && <div style={{fontSize:9,color:"var(--text-3)",paddingLeft:2}}>+{dayTasks.length-3} more</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* Legend */}
                  <div style={{padding:"10px 16px",borderTop:"1px solid var(--border)",display:"flex",flexWrap:"wrap",gap:12}}>
                    {CONCIERGE_NAMES.map((n,i)=>(
                      <span key={n} style={{display:"flex",alignItems:"center",gap:6,fontSize:10,color:"var(--text-3)"}}>
                        <span style={{width:8,height:8,borderRadius:"50%",background:"#374151"}}/>
                        {n.split(" ")[0]}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })() : view === "table" ? (
              /* ══ TABLE VIEW — grouped by trip ══ */
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {grouped.map(([key, group]) => (
                  <div key={key} className="tt-card" style={{overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 16px",borderBottom:"1px solid var(--border)",background:"var(--bg)"}}>
                      <span style={{fontSize:12,fontWeight:600,color:"var(--text-1)"}}>
                        {key==="__none__" ? "No trip" : group.name}
                      </span>
                      <span style={{fontSize:10.5,color:"var(--text-3)",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:3,padding:"1px 7px"}}>
                        {group.tasks.length} {group.tasks.length===1?"task":"tasks"}
                      </span>
                      <span style={{fontSize:10.5,color:"#059669",marginLeft:"auto"}}>
                        {group.tasks.filter(t=>t.status==="completed").length}/{group.tasks.length} done
                      </span>
                    </div>
                    <table className="tt-table" style={{width:"100%"}}>
                      <thead>
                        <tr>
                          <th style={{textAlign:"left"}}>Task</th>
                          <th style={{textAlign:"left"}}>Assigned</th>
                          <th style={{textAlign:"left"}}>Due</th>
                          <th style={{textAlign:"left"}}>Priority</th>
                          <th style={{textAlign:"left"}}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.tasks.map(t => {
                          const due = t.dueDate ? new Date(t.dueDate) : null;
                          const dl  = due ? Math.round((due-now)/86400000) : null;
                          return (
                            <tr key={t.id} style={{opacity:t.status==="completed"?.5:1}}>
                              <td style={{maxWidth:200}}>
                                <p style={{fontWeight:500,color:"var(--text-1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textDecoration:t.status==="completed"?"line-through":"none",margin:0}}>{t.taskName}</p>
                                {t.notes && <p style={{color:"var(--text-3)",fontSize:10.5,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",margin:0}}>{t.notes}</p>}
                              </td>
                              <td style={{whiteSpace:"nowrap"}}>{t.assignedTo?.split(" ")[0]||"—"}</td>
                              <td style={{whiteSpace:"nowrap"}}>
                                <span style={{color:dl!==null&&dl<0&&t.status!=="completed"?"#EF4444":dl!==null&&dl<=2&&t.status!=="completed"?"#D97706":"var(--text-2)"}}>
                                  {t.dueDate||"—"}
                                  {dl!==null&&t.status!=="completed"&&dl<=2&&dl>=0&&(
                                    <span style={{marginLeft:4,fontSize:10}}>{dl===0?"· today":`· ${dl}d`}</span>
                                  )}
                                </span>
                              </td>
                              <td><PriorityBadge t={t}/></td>
                              <td><StatusSelect t={t}/></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            ) : null}
            </div>
          </div>

          {/* ── Sidebar — hidden in board/calendar view ── */}
          {(view === "table" || view === "cards") && <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div className="tt-card" style={{padding:16}}>
              <p className="tt-section-title" style={{marginBottom:12}}>Carga por persona</p>
              {lbRows.length===0 ? (
                <p style={{fontSize:12,color:"var(--text-3)"}}>Sin pendientes</p>
              ) : lbRows.map(([user,cnt],i) => (
                <div key={user} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:i<lbRows.length-1?"1px solid var(--border-soft)":"none"}}>
                  <span style={{fontSize:12,fontWeight:500,color:cnt>3?"#DC2626":"var(--text-1)"}}>{user.split(" ")[0]}</span>
                  <span style={{fontSize:13,fontWeight:700,color:cnt>3?"#DC2626":"var(--text-1)"}}>{cnt}</span>
                </div>
              ))}
            </div>

            <div className="tt-card" style={{padding:16}}>
              <p className="tt-section-title" style={{marginBottom:12}}>Resumen</p>
              {[
                { label:"Total",        value: tasks.length,                                                  color:"var(--text-1)" },
                { label:"Pendientes",   value: tasks.filter(t=>t.status==="pending").length,     color:"#D97706" },
                { label:"En progreso",  value: tasks.filter(t=>t.status==="in_progress").length, color:"#2563EB" },
                { label:"Bloqueadas",   value: tasks.filter(t=>t.status==="blocked").length,     color:"#EA580C" },
                { label:"Vencidas",     value: tasks.filter(t=>t.status==="late").length,        color:"#DC2626" },
                { label:"Completadas",  value: tasks.filter(t=>t.status==="completed").length,   color:"#059669" },
              ].map(r => (
                <div key={r.label} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border-soft)"}}>
                  <span style={{fontSize:12,color:"var(--text-2)"}}>{r.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:r.color}}>{r.value}</span>
                </div>
              ))}
            </div>

            <div className="tt-card" style={{padding:16}}>
              <p className="tt-section-title" style={{marginBottom:12}}>Por prioridad</p>
              {[
                { label:"Alta",  key:"alta",  color:"#DC2626" },
                { label:"Media", key:"media", color:"#D97706" },
                { label:"Baja",  key:"baja",  color:"var(--text-3)" },
              ].map(r => (
                <div key={r.key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid var(--border-soft)"}}>
                  <span style={{fontSize:12,color:"var(--text-2)"}}>{r.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:r.color}}>
                    {tasks.filter(t=>t.priority===r.key&&t.status!=="completed").length}
                  </span>
                </div>
              ))}
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DRINKS CATALOG — client-facing drink selection page
   ============================================================ */
// img: URL directo de la foto. priceCOP/priceUSD: precio por unidad/botella.
// Base drink catalog — prices in COP; USD shown live via exchange rate
// emoji = shown when no img or img fails to load
const DRINK_CATEGORIES = [
  { id:"ron",        label:"🥃 Ron",         label_en:"🥃 Rum",          items:[
    { name:"Ron Medellín 8 años",      name_en:"Rum Medellín 8 años",         emoji:"🥃", img:"https://images.rappi.com/products/7459a9d1-4ff4-4f70-9565-a72059e43a57.png",  priceCOP:110000, qty:"", note:"" },
    { name:"Ron Dictador 12",          name_en:"Rum Dictador 12",             emoji:"🥃", img:"https://dictador.com/wp-content/uploads/2024/11/Dictador_12_Blend_40vol_floating-1024x1024.png", priceCOP:295000, qty:"", note:"" },
    { name:"Aguardiente Antioqueño",   name_en:"Aguardiente Antioqueño",      emoji:"🍶", img:"https://images.rappi.com/products/1684976360608_1684976356914_1684976356232.jpg", priceCOP:55000, qty:"", note:"" },
  ]},
  { id:"tequila",    label:"🌵 Tequila",     label_en:"🌵 Tequila",       items:[
    { name:"Tequila Patrón Silver",    name_en:"Tequila Patrón Silver",       emoji:"🌵", img:"https://images.rappi.com/products/6b921167-1806-43c7-b57b-1f1579b6f72e.png",  priceCOP:258000, qty:"", note:"" },
    { name:"Tequila Don Julio Blanco", name_en:"Tequila Don Julio Blanco",    emoji:"🌵", img:"", priceCOP:320000, qty:"", note:"" },
  ]},
  { id:"vodka",      label:"🍸 Vodka",       label_en:"🍸 Vodka",         items:[
    { name:"Vodka Grey Goose",         name_en:"Vodka Grey Goose",            emoji:"🍸", img:"https://images.rappi.com/products/508701057988_skppusgjklge_103497454041_fqpzouxhrxhe_1188_1.jpeg", priceCOP:240200, qty:"", note:"" },
    { name:"Vodka Absolut",            name_en:"Vodka Absolut",               emoji:"🍸", img:"https://images.rappi.com/products/bba89040-5d68-4c76-8c7e-1c72ec394cfe.png", priceCOP:98000, qty:"", note:"" },
  ]},
  { id:"whisky",     label:"🥃 Whisky",      label_en:"🥃 Whisky",        items:[
    { name:"Whisky Johnnie Walker Black",name_en:"Whisky Johnnie Walker Black",emoji:"🥃", img:"https://images.rappi.com/products/43ee0b4d-693e-49ce-a428-3e1a5c8e9ac6.jpg",priceCOP:158000, qty:"", note:"" },
    { name:"Whisky Chivas 12",         name_en:"Whisky Chivas 12",            emoji:"🥃", img:"https://images.rappi.com/products/dd73f3c2-f6f5-4b62-93c0-9faf98e2d897.jpg", priceCOP:185000, qty:"", note:"" },
  ]},
  { id:"gin",        label:"🌿 Gin",         label_en:"🌿 Gin",           items:[
    { name:"Gin Hendricks",            name_en:"Gin Hendricks",               emoji:"🌿", img:"https://images.rappi.com/products/42203de0-ce71-4bc4-aac2-d82b2bd9ca06.png", priceCOP:276000, qty:"", note:"" },
    { name:"Tanqueray",                name_en:"Tanqueray",                   emoji:"🌿", img:"https://images.rappi.com/products/184f0c14-6df0-4938-9a4d-cf97ce3b2e1f.png", priceCOP:184000, qty:"", note:"" },
  ]},
  { id:"champagne",  label:"🥂 Champagne",   label_en:"🥂 Champagne",     items:[
    { name:"Champagne Moët & Chandon", name_en:"Champagne Moët & Chandon",    emoji:"🥂", img:"", priceCOP:485000, qty:"", note:"" },
    { name:"Espumante / Prosecco",     name_en:"Sparkling / Prosecco",        emoji:"🥂", img:"", priceCOP:85000, qty:"", note:"" },
  ]},
  { id:"beer",       label:"🍺 Beer",        label_en:"🍺 Beer",          items:[
    { name:"Águila",                   name_en:"Águila",                      emoji:"🍺", img:"https://images.rappi.com/products/e412dd24-23e9-438f-814b-a4e8925ebaf0.png", priceCOP:4500, qty:"", note:"" },
    { name:"Club Colombia",            name_en:"Club Colombia",               emoji:"🍺", img:"https://images.rappi.com/products/f2b59539-ba5b-409f-8f9b-b067b5347374.png", priceCOP:4500, qty:"", note:"" },
    { name:"Corona",                   name_en:"Corona",                      emoji:"🍺", img:"https://images.rappi.com/products/f6206ee6-78c1-4279-a9ab-b8c203f7107d.png", priceCOP:7000, qty:"", note:"" },
    { name:"Heineken",                 name_en:"Heineken",                    emoji:"🍺", img:"https://images.rappi.com/products/76028c3a-e5a8-4ff7-b3c9-a5490c39f4f0.png", priceCOP:6000, qty:"", note:"" },
    { name:"Poker",                    name_en:"Poker",                       emoji:"🍺", img:"https://images.rappi.com/products/414428019836_rxaaltnmrzon_476705357483_txldxmllacvr_50644_1.jpeg", priceCOP:4500, qty:"", note:"" },
  ]},
  { id:"wine",       label:"🍷 Wine",        label_en:"🍷 Wine",          items:[
    { name:"Red wine (bottle)",        name_en:"Red wine (bottle)",           emoji:"🍷", img:"https://images.rappi.com/products/851855029156_wvpoxqeunfmh_378174607221_vtrwvvhcgsar_1265_1.jpeg", priceCOP:0, qty:"", note:"" },
    { name:"White wine (bottle)",      name_en:"White wine (bottle)",         emoji:"🍾", img:"https://images.rappi.com/products/e1443858-0c4e-4541-894c-b7bd8eb4bd20.jpg", priceCOP:0, qty:"", note:"" },
    { name:"Rosé wine (bottle)",       name_en:"Rosé wine (bottle)",          emoji:"🌸", img:"https://images.rappi.com/products/800ac89d-5ce8-46a0-84ff-b8ff127a7af7.jpg", priceCOP:0, qty:"", note:"" },
  ]},
  { id:"mixers",     label:"🥤 Mixers",      label_en:"🥤 Mixers",        items:[
    { name:"Coca-Cola",                name_en:"Coca-Cola",                   emoji:"🥤", img:"https://images.rappi.com/products/b5d6b9d0-3fa4-465a-b7e9-48ecf4ff3bc7.png", priceCOP:3800, qty:"", note:"" },
    { name:"Tonic water",              name_en:"Tonic water",                 emoji:"🫧", img:"https://images.rappi.com/products/0b1b5e8e-c3b5-4c7f-8e5a-1b2c3d4e5f6a.png", priceCOP:3000, qty:"", note:"" },
    { name:"Ginger ale",               name_en:"Ginger ale",                  emoji:"🥤", img:"", priceCOP:4000, qty:"", note:"" },
    { name:"Orange juice",             name_en:"Orange juice",                emoji:"🍊", img:"https://images.rappi.com/products/7e8f9a0b-1c2d-3e4f-5a6b-7c8d9e0f1a2b.png", priceCOP:20000, qty:"", note:"" },
    { name:"Sparkling water",          name_en:"Sparkling water",             emoji:"💧", img:"", priceCOP:36000, qty:"", note:"" },
    { name:"Still water",              name_en:"Still water",                 emoji:"💧", img:"", priceCOP:25600, qty:"", note:"" },
    { name:"Red Bull",                 name_en:"Red Bull",                    emoji:"⚡", img:"https://images.rappi.com/products/c3d4e5f6-a7b8-c9d0-e1f2-a3b4c5d6e7f8.png", priceCOP:9400, qty:"", note:"" },
  ]},
];

function DrinkCategoryList({ items, catLabel, itemName, fmtCOP, fxRate, patchItem }) {
  const [open, setOpen] = React.useState({});
  const toggle = (id) => setOpen(p => ({ ...p, [id]: !p[id] }));
  return (
    <div className="space-y-2">
      {items.map((cat, ci) => {
        const catQty = cat.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
        const isOpen = open[cat.id] ?? false;
        return (
          <div key={cat.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(cat.id)}
              className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition"
            >
              <span className="text-sm font-semibold text-neutral-800">{catLabel(cat)}</span>
              <div className="flex items-center gap-2">
                {catQty > 0 && (
                  <span className="bg-neutral-900 text-white text-xs font-bold rounded-full px-2 py-0.5">
                    {catQty}
                  </span>
                )}
                <span className="text-neutral-400 text-sm">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>
            {isOpen && (
              <div className="divide-y divide-neutral-100">
                {cat.items.map((it, ii) => (
                  <div key={it.name||ii} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden relative bg-neutral-100 flex items-center justify-center">
                      {it.img ? (
                        <img src={it.img} alt={itemName(it)} className="w-full h-full object-contain absolute inset-0"
                          onError={e=>{e.target.style.display="none";}}/>
                      ) : null}
                      <span className="text-2xl leading-none select-none">{it.emoji||"🍾"}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-800 leading-snug">{itemName(it)}</p>
                      {it.priceCOP > 0 && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          COP {fmtCOP(it.priceCOP)} · ≈ USD {(it.priceCOP/fxRate).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={()=>patchItem(ci,ii,{qty:String(Math.max(0,Number(it.qty||0)-1)||"")})}
                        className="w-7 h-7 rounded-full border border-neutral-300 text-neutral-600 flex items-center justify-center text-sm hover:bg-neutral-100">−</button>
                      <span className="w-8 text-center text-sm font-medium text-neutral-900">{it.qty||0}</span>
                      <button type="button" onClick={()=>patchItem(ci,ii,{qty:String(Number(it.qty||0)+1)})}
                        className="w-7 h-7 rounded-full border border-neutral-300 text-neutral-600 flex items-center justify-center text-sm hover:bg-neutral-100">+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DrinkSummaryBox({ houseItems, boatItems, catLabel, itemName, houseCOP, houseUSD, boatCOP, boatUSD, totalCOP, totalUSD, fmtCOP, fmtUSD, houseLabel, boatLabel, totalLabel }) {
  const renderItems = (its, label, cop, usd) => {
    const selected = its.flatMap(cat =>
      cat.items.filter(it => Number(it.qty) > 0).map(it => ({ ...it, cat: catLabel(cat) }))
    );
    if (!selected.length) return null;
    return (
      <div>
        <p className="text-xs text-neutral-400 font-semibold uppercase tracking-wider mb-2">{label}</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((it, i) => (
            <span key={i} className="bg-white/10 text-white text-xs px-2.5 py-1 rounded-full">
              {Number(it.qty)}× {itemName(it)}
            </span>
          ))}
        </div>
        {cop > 0 && (
          <p className="text-xs text-neutral-400">COP {fmtCOP(cop)} <span className="text-neutral-500">≈ USD {fmtUSD(usd)}</span></p>
        )}
      </div>
    );
  };
  const houseSection = renderItems(houseItems, houseLabel, houseCOP, houseUSD);
  const boatSection  = renderItems(boatItems,  boatLabel,  boatCOP,  boatUSD);
  return (
    <div className="bg-neutral-900 text-white rounded-2xl px-5 py-4 space-y-3">
      <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">{totalLabel}</p>
      {houseSection}
      {houseSection && boatSection && <div className="border-t border-white/10" />}
      {boatSection}
      {houseCOP > 0 && boatCOP > 0 && (
        <div className="flex justify-between font-semibold pt-1 border-t border-white/10 text-sm">
          <span>Total</span>
          <span>COP {fmtCOP(totalCOP)} <span className="text-neutral-400 text-xs">≈ USD {fmtUSD(totalUSD)}</span></span>
        </div>
      )}
    </div>
  );
}

function DrinksCatalog() {
  const params         = new URLSearchParams(window.location.search);
  const kickoffId      = params.get("kickoffId")    || "";
  const [lang, setLang]= React.useState(params.get("lang") === "es" ? "es" : "en"); // default: English
  const prefillName    = params.get("guestName")    || "";
  const prefillArrival = params.get("arrivalDate")  || "";
  const prefillDepart  = params.get("departureDate")|| "";

  const T = lang === "en" ? {
    brand:"Two Travel", heading:"🍹 Drink List",
    instr1:"Please use this resource as a way to order and also budget what you would like for both your house and boat. Select the quantity of each drink you would like to have.",
    instr2:"Note: USD prices are approximate and may vary based on the exchange rate on the day the purchase is made.",
    houseTab:"🏠 House", boatTab:"⛵ Boat",
    houseLabel:"House Order", boatLabel:"Boat Order",
    namePlaceholder:"Your name (optional)",
    notePlaceholder:"Anything else? Specific brands, allergies, preferences…",
    totalLabel:"Estimated total", rateLabel:"Exchange rate",
    sendBtn:"✅ Submit order to concierge", sending:"Sending…",
    editBtn:"✏️ Edit order",
    successTitle:"Got it! 🥂", successBody:"Your drink order has been sent to your concierge. You can come back anytime to make changes.",
  } : {
    brand:"Two Travel", heading:"🍹 Lista de Bebidas",
    instr1:"Por favor usa este recurso para ordenar y presupuestar lo que quieres para tu casa y el bote. Selecciona la cantidad de cada bebida que deseas tener.",
    instr2:"Nota: Los precios en USD son aproximados y pueden variar según la tasa de cambio del día de la compra.",
    houseTab:"🏠 Casa", boatTab:"⛵ Bote",
    houseLabel:"Pedido Casa", boatLabel:"Pedido Bote",
    namePlaceholder:"Tu nombre (opcional)",
    notePlaceholder:"¿Algo más? Marcas específicas, alergias, preferencias…",
    totalLabel:"Total estimado", rateLabel:"Tasa de cambio",
    sendBtn:"✅ Enviar pedido al concierge", sending:"Enviando…",
    editBtn:"✏️ Editar pedido",
    successTitle:"¡Listo! 🥂", successBody:"Tu pedido de bebidas fue enviado a tu concierge. Puedes volver cuando quieras para hacer cambios.",
  };

  const itemName = (it) => (lang === "en" && it.name_en) ? it.name_en : it.name;
  const catLabel = (cat) => (lang === "en" && cat.label_en) ? cat.label_en : cat.label;

  const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
  const mkItems = () => DRINK_CATEGORIES.map(cat => ({ ...cat, items: cat.items.map(it => ({ ...it })) }));
  const [houseItems, setHouseItems] = React.useState(mkItems);
  const [boatItems,  setBoatItems]  = React.useState(mkItems);
  const [activeTab,  setActiveTab]  = React.useState("house");
  const [extra,      setExtra]      = React.useState("");
  const [sent,       setSent]       = React.useState(false);
  const [sending,    setSending]    = React.useState(false);
  const [guestName,  setGuestName]  = React.useState(prefillName);
  const [fxRate,     setFxRate]     = React.useState(4000);
  const [prevOrderAt,setPrevOrderAt]= React.useState(""); // ISO date of last submission
  const [loading,    setLoading]    = React.useState(!!kickoffId);
  const [kickoffArrival, setKickoffArrival] = React.useState("");
  const [kickoffDepart,  setKickoffDepart]  = React.useState("");

  // Fetch live exchange rate + existing order
  React.useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(d => { if (d?.rates?.COP) setFxRate(Math.round(d.rates.COP)); })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!kickoffId) { setLoading(false); return; }
    fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getKickoffById", id: kickoffId }),
    })
      .then(r => r.json())
      .then(res => {
        const k = res.data;
        if (!k) return;
        if (k.arrivalDate)   setKickoffArrival(k.arrivalDate);
        if (k.departureDate) setKickoffDepart(k.departureDate);
        if (k.guestName && !prefillName) setGuestName(k.guestName);
        if (k.drinkOrderJson) {
          try {
            const saved = JSON.parse(k.drinkOrderJson);
            if (saved.house) setHouseItems(saved.house);
            if (saved.boat)  setBoatItems(saved.boat);
            if (saved.extra) setExtra(saved.extra);
          } catch {}
        }
        if (k.drinkOrderAt) setPrevOrderAt(k.drinkOrderAt);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [kickoffId]);

  const items    = activeTab === "house" ? houseItems : boatItems;
  const setItems = activeTab === "house" ? setHouseItems : setBoatItems;

  const patchItem = (catIdx, itemIdx, patch) =>
    setItems(prev => prev.map((cat, ci) =>
      ci !== catIdx ? cat : {
        ...cat,
        items: cat.items.map((it, ii) => ii !== itemIdx ? it : { ...it, ...patch }),
      }
    ));

  const calcTotals = (its) => {
    const flat = its.flatMap(c => c.items);
    const cop  = flat.reduce((s, it) => s + (it.priceCOP || 0) * (Number(it.qty) || 0), 0);
    return { cop, usd: cop / fxRate };
  };
  const { cop: houseCOP, usd: houseUSD } = calcTotals(houseItems);
  const { cop: boatCOP,  usd: boatUSD  } = calcTotals(boatItems);
  const totalCOP = houseCOP + boatCOP;
  const totalUSD = houseUSD + boatUSD;

  const fmtCOP = n => Math.round(n).toLocaleString("es-CO");
  const fmtUSD = n => n.toFixed(2);

  const hasSelection = [...houseItems, ...boatItems].flatMap(c => c.items).some(it => Number(it.qty) > 0);

  const buildSummaryText = (its, label) => {
    const lines = [];
    its.forEach(cat => {
      const sel = cat.items.filter(it => Number(it.qty) > 0);
      if (!sel.length) return;
      lines.push(`*${catLabel(cat)}*`);
      sel.forEach(it => {
        const cop = it.priceCOP > 0 ? ` · COP ${fmtCOP(it.priceCOP * Number(it.qty))}` : "";
        lines.push(`  • ${itemName(it)}: *${it.qty}*${cop}`);
      });
    });
    if (!lines.length) return "";
    const { cop, usd } = calcTotals(its);
    if (cop > 0) lines.push(`💰 *${label} total: COP ${fmtCOP(cop)} (~USD ${fmtUSD(usd)})*`);
    return `*${label}*\n${lines.join("\n")}`;
  };

  const isUpdate = !!prevOrderAt;

  const handleSend = async () => {
    if (!hasSelection) return;
    setSending(true);
    const houseText = buildSummaryText(houseItems, "🏠 House");
    const boatText  = buildSummaryText(boatItems,  "⛵ Boat");
    const parts = [houseText, boatText].filter(Boolean);
    if (extra) parts.push(`📝 ${extra}`);
    if (totalCOP > 0) parts.push(`\n💰 *Total: COP ${fmtCOP(totalCOP)} (~USD ${fmtUSD(totalUSD)})*`);
    const action = isUpdate ? "✏️ *UPDATED*" : "🆕 *NEW*";
    const slackText = `🍹 ${action} Drink Order ${guestName ? `(${guestName})` : ""} · kickoff: ${kickoffId}\n\n${parts.join("\n\n")}`;
    const drinkOrder = slackText.replace(/\*/g, "");
    const drinkOrderJson = JSON.stringify({ house: houseItems, boat: boatItems, extra });
    const now = new Date().toISOString();
    try {
      await fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "sendSlackMessage", payload: { text: slackText, channelId: import.meta.env.VITE_SLACK_CHANNEL_ID || "C0BB4EPSAP4", slackToken: import.meta.env.VITE_SLACK_BOT_TOKEN || "" } }),
      });
      if (kickoffId) {
        updateKickoffInSheet(kickoffId, { drinkOrder, drinkOrderAt: now, drinkOrderJson }).catch(() => {});
      }
      setPrevOrderAt(now);
      setSent(true);
    } catch { setSent(true); }
    setSending(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <p className="text-neutral-400 text-sm">Loading…</p>
    </div>
  );

  if (sent) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center px-6 gap-6">
      <div className="text-5xl">🥂</div>
      <h1 className="text-2xl font-semibold text-white">{T.successTitle}</h1>
      <p className="text-neutral-400 text-sm max-w-xs">{T.successBody}</p>
      <button
        onClick={() => setSent(false)}
        className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20"
      >{T.editBtn}</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-neutral-950 text-white px-6 pt-6 pb-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <img src="/logo.png" alt="Two Travel" className="h-7 mb-2 opacity-90" />
            <h1 className="text-xl font-semibold">{T.heading}</h1>
          </div>
          {/* Language toggle */}
          <button
            onClick={() => setLang(l => l === "en" ? "es" : "en")}
            className="flex-shrink-0 mt-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition"
          >
            {lang === "en" ? "🇪🇸 ES" : "🇺🇸 EN"}
          </button>
        </div>
        {/* Instructions */}
        <div className="bg-white/10 rounded-xl px-4 py-3 space-y-1.5 text-sm text-neutral-300">
          <p>{T.instr1}</p>
          <p className="text-neutral-400 text-xs italic">{T.instr2}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">

        {/* Stay dates banner */}
        {(() => { const da = kickoffArrival || prefillArrival; const dd = kickoffDepart || prefillDepart; return (da || dd) && (
          <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 flex items-center gap-4">
            {da && (
              <div className="flex-1 text-center">
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-0.5">{lang==="en"?"Check-in":"Llegada"}</p>
                <p className="text-sm font-semibold text-neutral-900">
                  {new Date(da+"T12:00:00").toLocaleDateString(lang==="en"?"en-US":"es-CO",{weekday:"short",month:"short",day:"numeric"})}
                </p>
              </div>
            )}
            {da && dd && <div className="text-neutral-300 text-xl">→</div>}
            {dd && (
              <div className="flex-1 text-center">
                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-0.5">{lang==="en"?"Check-out":"Salida"}</p>
                <p className="text-sm font-semibold text-neutral-900">
                  {new Date(dd+"T12:00:00").toLocaleDateString(lang==="en"?"en-US":"es-CO",{weekday:"short",month:"short",day:"numeric"})}
                </p>
              </div>
            )}
            {da && dd && (() => {
              const n = Math.round((new Date(dd)-new Date(da))/86400000);
              return n>0?<div className="text-center border-l pl-4"><p className="text-lg font-bold text-neutral-900">{n}</p><p className="text-[10px] text-neutral-400">{lang==="en"?"nights":"noches"}</p></div>:null;
            })()}
          </div>
        ); })()}

        {/* Previous order banner */}
        {prevOrderAt && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-800">{lang==="en" ? "You have a saved order" : "Tienes un pedido guardado"}</p>
              <p className="text-xs text-green-600">{lang==="en" ? "Last updated" : "Última actualización"}: {new Date(prevOrderAt).toLocaleDateString(lang==="en"?"en-US":"es-CO",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}</p>
            </div>
          </div>
        )}

        {/* Exchange rate badge */}
        <div className="flex justify-end">
          <span className="text-[10px] text-neutral-400 bg-neutral-100 rounded-full px-3 py-1">
            {T.rateLabel}: 1 USD = COP {fxRate.toLocaleString("es-CO")}
          </span>
        </div>

        {/* Guest name */}
        {prefillName ? (
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span>👤</span><span className="text-sm font-medium text-neutral-800">{prefillName}</span>
          </div>
        ) : (
          <input value={guestName} onChange={e=>setGuestName(e.target.value)}
            placeholder={T.namePlaceholder}
            className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"/>
        )}

        {/* House / Boat tabs */}
        <div className="flex gap-2">
          {["house","boat"].map(tab => (
            <button key={tab} type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab===tab?"bg-neutral-950 text-white":"bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}
            >
              {tab==="house" ? T.houseTab : T.boatTab}
              {tab==="house" && houseCOP>0 && <span className="ml-2 text-xs opacity-70">COP {fmtCOP(houseCOP)}</span>}
              {tab==="boat"  && boatCOP >0 && <span className="ml-2 text-xs opacity-70">COP {fmtCOP(boatCOP)}</span>}
            </button>
          ))}
        </div>

        {/* Drink categories — collapsible */}
        <DrinkCategoryList
          items={items} catLabel={catLabel} itemName={itemName}
          fmtCOP={fmtCOP} fxRate={fxRate} patchItem={patchItem}
        />

        {/* Order summary cuadrito */}
        {hasSelection && (
          <DrinkSummaryBox
            houseItems={houseItems} boatItems={boatItems}
            catLabel={catLabel} itemName={itemName}
            houseCOP={houseCOP} houseUSD={houseUSD}
            boatCOP={boatCOP}   boatUSD={boatUSD}
            totalCOP={totalCOP} totalUSD={totalUSD}
            fmtCOP={fmtCOP} fmtUSD={fmtUSD}
            houseLabel={T.houseLabel} boatLabel={T.boatLabel}
            totalLabel={T.totalLabel}
          />
        )}

        {/* Notes */}
        <textarea value={extra} onChange={e=>setExtra(e.target.value)}
          placeholder={T.notePlaceholder} rows={3}
          className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 resize-none"/>
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex justify-center">
        <button type="button" onClick={handleSend} disabled={sending||!hasSelection}
          className="w-full max-w-xl py-3 rounded-xl bg-neutral-950 text-white font-semibold text-sm disabled:opacity-40 hover:bg-neutral-800">
          {sending ? T.sending : isUpdate ? (lang==="en" ? "✅ Update my order" : "✅ Actualizar pedido") : T.sendBtn}
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   WELCOME CATALOG PAGE
   Shown when someone opens ?mode=catalog without a kickoffId.
   Collects basic client info, creates a kickoff, then redirects.
================================================================ */
const CITY_OPTIONS = [
  { code: "CTG",  label: "🇨🇴 Cartagena" },
  { code: "MDE",  label: "🇨🇴 Medellín" },
  { code: "CDMX", label: "🇲🇽 Ciudad de México" },
  { code: "TUL",  label: "🇲🇽 Tulum" },
];

function WelcomeCatalogPage({ mode }) {
  const [name,    setName]    = useState("");
  const [city,    setCity]    = useState("");
  const [contact, setContact] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  // Detect language: ?lang=en/es, or browser language
  const urlLang = new URLSearchParams(window.location.search).get("lang") || "";
  const browserLang = navigator.language || "";
  const isEn = urlLang === "en" || (!urlLang && !browserLang.startsWith("es"));
  const wt = {
    title:       isEn ? "Welcome 👋"                                           : "Bienvenido 👋",
    subtitle:    isEn ? "Tell us who you are and where you're going, and we'll show you a personalized catalog." : "Dinos quién eres y a dónde vas, y te mostramos el catálogo personalizado.",
    nameLabel:   isEn ? "Your name *"                                          : "Tu nombre *",
    namePh:      isEn ? "E.g. John Smith"                                      : "Ej: María García",
    destLabel:   isEn ? "Destination *"                                        : "Destino *",
    destPh:      isEn ? "Select your city…"                                    : "Selecciona tu ciudad…",
    waLabel:     isEn ? "WhatsApp (optional)"                                  : "WhatsApp (opcional)",
    btnReady:    isEn ? "See my catalog →"                                     : "Ver mi catálogo →",
    btnSaving:   isEn ? "Creating your catalog…"                               : "Creando tu catálogo…",
    errName:     isEn ? "Please enter your name."                              : "Por favor ingresa tu nombre.",
    errCity:     isEn ? "Please select your destination."                      : "Por favor selecciona tu destino.",
    errSave:     isEn ? "Error saving. Please try again."                      : "Error al guardar. Intenta de nuevo.",
    errCreate:   isEn ? "Could not create the client"                          : "No se pudo crear el cliente",
  };

  const handleStart = async (e) => {
    e.preventDefault();
    if (!name.trim())  { setError(wt.errName); return; }
    if (!city)         { setError(wt.errCity); return; }
    setError("");
    setSaving(true);
    try {
      const result = await saveKickoffToSheet({
        guestName:    name.trim(),
        city,
        guestContact: contact.trim(),
        status:       "catalog",
        createdAt:    new Date().toISOString(),
      });
      if (!result?.id) throw new Error(wt.errCreate);
      const url = new URL(window.location.href);
      url.searchParams.set("kickoffId", result.id);
      url.searchParams.set("mode", "catalog");
      window.location.href = url.toString();
    } catch (err) {
      setError(wt.errSave);
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-xl font-bold text-neutral-900 mb-1">{wt.title}</h1>
        <p className="text-sm text-neutral-500 mb-6">{wt.subtitle}</p>

        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wide">
              {wt.nameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={wt.namePh}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wide">
              {wt.destLabel}
            </label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              required
            >
              <option value="">{wt.destPh}</option>
              {CITY_OPTIONS.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wide">
              {wt.waLabel}
            </label>
            <input
              type="tel"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder="+57 300 000 0000"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-neutral-900 text-white rounded-lg py-3 text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
          >
            {saving ? wt.btnSaving : wt.btnReady}
          </button>
        </form>

        <p className="text-center text-[10px] text-neutral-400 mt-5">
          Two Travel · twotravelvip.com
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   GROCERY CATALOG
   ?mode=groceries&kickoffId=...&lang=en|es
================================================================ */
const U = (id) => `https://images.unsplash.com/${id}?w=120&q=80&fit=crop&crop=center`;
const OFF = (path) => `https://images.openfoodfacts.org/images/products/${path}`;
const GROCERY_CATEGORIES = [
  { id:"essentials", label:"🧂 Essentials", label_es:"🧂 Básicos", items:[
    { name:"Large Butter",   name_es:"Mantequilla grande", emoji:"🧈", img:U("photo-1589985270826-4b7bb135bc9d") },
    { name:"Oil",            name_es:"Aceite",             emoji:"🫙", img:"" },
    { name:"Salt",           name_es:"Sal",                emoji:"🧂", img:"" },
    { name:"Black pepper",   name_es:"Pimienta negra",     emoji:"🫙", img:"" },
    { name:"White Sugar",    name_es:"Azúcar blanca",      emoji:"🍬", img:"" },
    { name:"Brown Sugar",    name_es:"Azúcar morena",      emoji:"🍯", img:"" },
  ]},
  { id:"dairy", label:"🥛 Dairy", label_es:"🥛 Lácteos", items:[
    { name:"Mozzarella cheese",                          name_es:"Queso mozzarella",   emoji:"🧀", img:U("photo-1486297678162-eb2a19b0a32d") },
    { name:"Cheddar cheese",                             name_es:"Queso cheddar",      emoji:"🧀", img:"" },
    { name:"Greek Yogurt",                               name_es:"Yogurt griego",      emoji:"🥛", img:U("photo-1488477181946-6428a0291777") },
    { name:"Regular vanilla yogurt (no added fruits)",   name_es:"Yogurt vainilla",    emoji:"🥛", img:"" },
  ]},
  { id:"bread", label:"🍞 Flours & Breads", label_es:"🍞 Harinas & Panes", items:[
    { name:"Arepas",       name_es:"Arepas",            emoji:"🫓", img:"" },
    { name:"Sliced bread", name_es:"Pan tajado",         emoji:"🍞", img:U("photo-1589367920969-ab8e050bbb04") },
    { name:"Pancake mix",  name_es:"Mezcla de pancakes", emoji:"🥞", img:U("photo-1528207776546-365bb710ee93") },
  ]},
  { id:"condiments", label:"🥫 Condiments & Others", label_es:"🥫 Condimentos", items:[
    { name:"Small cereal",     name_es:"Cereal pequeño",    emoji:"🥣", img:U("photo-1517093602195-b40af9688ff7") },
    { name:"Granola box",      name_es:"Caja de granola",   emoji:"🌾", img:U("photo-1517093602195-b40af9688ff7") },
    { name:"Hot sauce",        name_es:"Salsa picante",     emoji:"🌶️", img:"" },
    { name:"Syrup",            name_es:"Sirope / Almíbar",  emoji:"🍯", img:U("photo-1558642452-9d2a7deb7f62") },
    { name:"Chocolate Chips",  name_es:"Chips de chocolate",emoji:"🍫", img:"" },
    { name:"Ketchup",          name_es:"Ketchup",           emoji:"🍅", img:"" },
    { name:"Honey",            name_es:"Miel",              emoji:"🍯", img:U("photo-1558642452-9d2a7deb7f62") },
  ]},
  { id:"grains", label:"🍚 Grains & Eggs", label_es:"🍚 Granos & Huevos", items:[
    { name:"Eggs",             name_es:"Huevos",             emoji:"🥚", img:U("photo-1582722872445-44dc5f7e3c8f") },
    { name:"Beans",            name_es:"Frijoles",           emoji:"🫘", img:"" },
    { name:"Rice",             name_es:"Arroz",              emoji:"🍚", img:U("photo-1586201375761-83865001e31c") },
    { name:"Maggi (seasoning)",name_es:"Maggi (sazón)",      emoji:"🧂", img:"" },
    { name:"Chicharrón",       name_es:"Chicharrón",         emoji:"🥓", img:"" },
  ]},
  { id:"beverages", label:"🥤 Beverages", label_es:"🥤 Bebidas", items:[
    { name:"Orange Juice",                    name_es:"Jugo de naranja",     emoji:"🍊", img:U("photo-1621506289937-a8e4df240d0b") },
    { name:"Apple Juice",                     name_es:"Jugo de manzana",     emoji:"🍎", img:U("photo-1568702846914-96b305d2aaeb") },
    { name:"Cranberry Juice",                 name_es:"Jugo de arándano",    emoji:"🫐", img:"" },
    { name:"Packs of water",                  name_es:"Paquetes de agua",    emoji:"💧", img:"" },
    { name:"Large liters of water",           name_es:"Litros de agua",      emoji:"🫧", img:"" },
    { name:"Liter Sodas (Coke Zero, Iced Coffee)", name_es:"Gaseosas litro", emoji:"🥤", img:"" },
    { name:"Lemonade",                        name_es:"Limonada",            emoji:"🍋", img:U("photo-1523677011781-ac91d64e4acb") },
    { name:"Ginger beer",                     name_es:"Cerveza de jengibre", emoji:"🍺", img:"" },
    { name:"Electrolit",                      name_es:"Electrolit",          emoji:"⚡", img:"" },
    { name:"Coconut Water",                   name_es:"Agua de coco",        emoji:"🥥", img:U("photo-1541480601022-2308c0f02487") },
    { name:"Aguardiente",                     name_es:"Aguardiente",         emoji:"🥃", img:OFF("770/204/900/0708/front_es.3.400.jpg") },
    { name:"Lime juice",                      name_es:"Jugo de limón",       emoji:"🍋", img:"" },
    { name:"Club soda",                       name_es:"Agua tónica",         emoji:"🫧", img:"" },
  ]},
  { id:"snacks", label:"🍿 Snacks", label_es:"🍿 Snacks", items:[
    { name:"Cheese empanadas", name_es:"Empanadas de queso", emoji:"🫔", img:"" },
    { name:"Potato chips",     name_es:"Papas fritas",       emoji:"🥔", img:U("photo-1566478989037-eec170784d0b") },
    { name:"Chocoramo",        name_es:"Chocoramo",          emoji:"🍫", img:OFF("770/291/459/6787/front_en.12.400.jpg") },
    { name:"Choclitos",        name_es:"Choclitos",          emoji:"🌽", img:OFF("770/218/904/5805/front_fr.4.400.jpg") },
    { name:"Platanitos",       name_es:"Platanitos",         emoji:"🍌", img:"https://www.hola-colombia.eu/web/image/product.template/494/image_1920?unique=8ab60b6" },
    { name:"Colombian Candy",  name_es:"Dulces colombianos", emoji:"🍬", img:"" },
    { name:"Peanuts",          name_es:"Maní",               emoji:"🥜", img:"" },
    { name:"Cheese board",     name_es:"Tabla de quesos",    emoji:"🧀", img:"" },
    { name:"Fresh fruit",      name_es:"Fruta fresca",       emoji:"🍓", img:"" },
    { name:"Crudités",         name_es:"Crudités",           emoji:"🥕", img:"" },
  ]},
  { id:"fruits", label:"🍍 Fruits & Vegetables", label_es:"🍍 Frutas & Verduras", items:[
    { name:"Pineapple",   name_es:"Piña",        emoji:"🍍", img:U("photo-1550258987-190a2d41a8ba") },
    { name:"Strawberries",name_es:"Fresas",       emoji:"🍓", img:U("photo-1464965911861-746a04b4bca6") },
    { name:"Bananas",     name_es:"Bananos",      emoji:"🍌", img:U("photo-1571771894821-ce9b6c11b08e") },
    { name:"Onion",       name_es:"Cebolla",      emoji:"🧅", img:U("photo-1508747703725-719777637510") },
    { name:"Tomato",      name_es:"Tomate",       emoji:"🍅", img:U("photo-1558818498-28c1e002b655") },
    { name:"Plantain",    name_es:"Plátano",      emoji:"🍌", img:"" },
    { name:"Garlic",      name_es:"Ajo",          emoji:"🧄", img:U("photo-1540148426945-6cf22a6b2383") },
    { name:"Avocado",     name_es:"Aguacate",     emoji:"🥑", img:U("photo-1523049673857-eb18f1d7b578") },
    { name:"Mango",       name_es:"Mango",        emoji:"🥭", img:U("photo-1601493700631-2b16ec4b4716") },
    { name:"Spinach",     name_es:"Espinaca",     emoji:"🥬", img:U("photo-1576045057995-568f588f82fb") },
    { name:"Lime",        name_es:"Limón",        emoji:"🍋", img:U("photo-1597714026720-8f74c62310ba") },
  ]},
  { id:"cleaning", label:"🧹 Cleaning & Misc", label_es:"🧹 Limpieza & Misc", items:[
    { name:"Napkins",                       name_es:"Servilletas",       emoji:"🧻", img:"" },
    { name:"Kitchen paper towels",          name_es:"Papel de cocina",   emoji:"🧻", img:"" },
    { name:"Dish Gloves",                   name_es:"Guantes de cocina", emoji:"🧤", img:"" },
    { name:"Dish Soap",                     name_es:"Jabón de platos",   emoji:"🫧", img:"" },
    { name:"Plastic cups (red party cups)", name_es:"Vasos plásticos",   emoji:"🥤", img:"" },
    { name:"Plastic plates",                name_es:"Platos plásticos",  emoji:"🍽️", img:"" },
  ]},
];

function GroceryCatalog() {
  const GAS_URL    = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
  const params     = new URLSearchParams(window.location.search);
  const kickoffId  = params.get("kickoffId") || "";
  const [lang, setLang] = React.useState(params.get("lang") === "es" ? "es" : "en");
  const prefillName= params.get("guestName") || "";

  const mkChecks = () => {
    const m = {};
    GROCERY_CATEGORIES.forEach(cat => cat.items.forEach(item => { m[item.name] = false; }));
    return m;
  };
  const [checked,   setChecked]   = React.useState(mkChecks);
  const [others,    setOthers]    = React.useState("");
  const [sent,      setSent]      = React.useState(false);
  const [sending,   setSending]   = React.useState(false);
  const [prevAt,    setPrevAt]    = React.useState("");
  const [loading,   setLoading]   = React.useState(!!kickoffId);
  const [guestName, setGuestName] = React.useState(prefillName);

  // Load existing order
  React.useEffect(() => {
    if (!kickoffId) { setLoading(false); return; }
    fetch(GAS_URL, {
      method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({ action:"getKickoffById", id:kickoffId }),
    })
      .then(r=>r.json())
      .then(res => {
        const k = res.data;
        if (!k) return;
        if (k.guestName && !prefillName) setGuestName(k.guestName);
        if (k.groceryOrderJson) {
          try {
            const saved = JSON.parse(k.groceryOrderJson);
            if (saved.checked) setChecked(prev => ({...prev, ...saved.checked}));
            if (saved.others)  setOthers(saved.others);
          } catch {}
        }
        if (k.groceryOrderAt) setPrevAt(k.groceryOrderAt);
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, [kickoffId]);

  const toggle = (itemName) => setChecked(prev => ({...prev, [itemName]: !prev[itemName]}));
  const hasSelection = Object.values(checked).some(Boolean) || !!others.trim();
  const isUpdate = !!prevAt;

  const handleSend = async () => {
    if (!hasSelection) return;
    setSending(true);
    const lines = [];
    GROCERY_CATEGORIES.forEach(cat => {
      const sel = cat.items.filter(i => checked[i.name]);
      if (!sel.length) return;
      lines.push(`*${cat.label}*`);
      sel.forEach(i => lines.push(`  ✓ ${i.name}`));
    });
    if (others.trim()) lines.push(`\n📝 Others: ${others}`);
    const action = isUpdate ? "✏️ *UPDATED*" : "🆕 *NEW*";
    const slackText = `🛒 ${action} Grocery List ${guestName ? `(${guestName})` : ""} · kickoff: ${kickoffId}\n\n${lines.join("\n")}`;
    const groceryOrder = slackText.replace(/\*/g,"");
    const groceryOrderJson = JSON.stringify({ checked, others });
    const now = new Date().toISOString();
    try {
      await fetch(GAS_URL, {
        method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({ action:"sendSlackMessage", payload:{ text:slackText, channelId:import.meta.env.VITE_SLACK_CHANNEL_ID||"C0BB4EPSAP4", slackToken:import.meta.env.VITE_SLACK_BOT_TOKEN||"" }}),
      });
      if (kickoffId) {
        updateKickoffInSheet(kickoffId, { groceryOrder, groceryOrderAt: now, groceryOrderJson }).catch(()=>{});
      }
      setPrevAt(now);
      setSent(true);
    } catch { setSent(true); }
    setSending(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <p className="text-neutral-400 text-sm">Loading…</p>
    </div>
  );

  if (sent) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center px-6 gap-6">
      <div className="text-5xl">🛒</div>
      <h1 className="text-2xl font-semibold text-white">{lang==="en" ? "Got it!" : "¡Recibido!"}</h1>
      <p className="text-neutral-400 text-sm max-w-xs">{lang==="en" ? "Your grocery list has been sent to your concierge." : "Tu lista de mercado fue enviada al concierge."}</p>
      <p className="text-neutral-500 text-xs">{lang==="en" ? "You can come back anytime to make changes." : "Puedes volver cuando quieras para hacer cambios."}</p>
      <button onClick={()=>setSent(false)} className="mt-4 px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20">
        {lang==="en" ? "✏️ Edit list" : "✏️ Editar lista"}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-28">
      {/* Header */}
      <div className="bg-neutral-950 text-white px-6 pt-6 pb-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <img src="/logo.png" alt="Two Travel" className="h-7 mb-2 opacity-90" />
            <h1 className="text-xl font-semibold">{lang==="en" ? "🛒 Grocery List" : "🛒 Lista de Mercado"}</h1>
          </div>
          {/* Language toggle */}
          <button
            onClick={() => setLang(l => l === "en" ? "es" : "en")}
            className="flex-shrink-0 mt-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium text-white transition"
          >
            {lang === "en" ? "🇪🇸 ES" : "🇺🇸 EN"}
          </button>
        </div>
        <p className="text-sm text-neutral-400">{lang==="en" ? "Check the items you'd like us to have ready at the villa." : "Marca los productos que quieres que tengamos listos en la villa."}</p>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4 space-y-4">

        {/* Previous order banner */}
        {prevAt && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-lg">✅</span>
            <div>
              <p className="text-sm font-semibold text-green-800">{lang==="en" ? "You have a saved list" : "Tienes una lista guardada"}</p>
              <p className="text-xs text-green-600">{lang==="en" ? "Last updated" : "Última actualización"}: {new Date(prevAt).toLocaleDateString(lang==="en"?"en-US":"es-CO",{month:"short",day:"numeric",year:"numeric"})}</p>
            </div>
          </div>
        )}

        {/* Guest name */}
        {prefillName ? (
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <span>👤</span><span className="text-sm font-medium text-neutral-800">{prefillName}</span>
          </div>
        ) : (
          <input value={guestName} onChange={e=>setGuestName(e.target.value)}
            placeholder={lang==="en" ? "Your name (optional)" : "Tu nombre (opcional)"}
            className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"/>
        )}

        {/* Categories */}
        {GROCERY_CATEGORIES.map(cat => (
          <div key={cat.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-neutral-50 border-b">
              <p className="text-sm font-semibold text-neutral-800">{lang==="es" ? (cat.label_es||cat.label) : cat.label}</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {cat.items.map(item => {
                const isChecked = !!checked[item.name];
                const displayName = lang==="es" ? (item.name_es||item.name) : item.name;
                return (
                  <label key={item.name} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isChecked ? "bg-neutral-950" : "hover:bg-neutral-50"}`}>
                    {/* Image / emoji */}
                    <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden relative bg-neutral-100 flex items-center justify-center">
                      <span className="text-2xl leading-none select-none">{item.emoji||"🛒"}</span>
                      {item.img ? (
                        <img src={item.img} alt={displayName}
                          className="w-full h-full object-cover absolute inset-0 rounded-xl"
                          onError={e=>{e.target.style.display="none";}}/>
                      ) : null}
                    </div>
                    {/* Checkbox */}
                    <input type="checkbox" className="sr-only" checked={isChecked} onChange={()=>toggle(item.name)}/>
                    <span className={`flex-1 text-sm ${isChecked ? "text-white font-medium" : "text-neutral-700"}`}>{displayName}</span>
                    {/* Check indicator */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${isChecked ? "bg-white" : "border-2 border-neutral-200"}`}>
                      {isChecked && <span className="text-neutral-950 text-xs font-bold">✓</span>}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        ))}

        {/* Others */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-neutral-800 mb-2">📝 {lang==="en" ? "Others / Special requests" : "Otros / Peticiones especiales"}</p>
          <textarea value={others} onChange={e=>setOthers(e.target.value)}
            placeholder={lang==="en" ? "Anything else? Specific brands, dietary needs…" : "¿Algo más? Marcas específicas, restricciones…"}
            rows={3} className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 resize-none"/>
        </div>
      </div>

      {/* Fixed footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex justify-center">
        <button type="button" onClick={handleSend} disabled={sending||!hasSelection}
          className="w-full max-w-xl py-3 rounded-xl bg-neutral-950 text-white font-semibold text-sm disabled:opacity-40 hover:bg-neutral-800">
          {sending ? (lang==="en"?"Sending…":"Enviando…") : isUpdate ? (lang==="en"?"✅ Update grocery list":"✅ Actualizar lista") : (lang==="en"?"✅ Send list to concierge":"✅ Enviar lista al concierge")}
        </button>
      </div>
    </div>
  );
}

// ─── BREAKFAST DATA ──────────────────────────────────────────────────────────
const BREAKFAST_TIERS = ["1-5","6-10","11-20"];
const BREAKFAST_MENUS = [
  { id:"traditional", label:"Traditional Menu", label_es:"Menú Típico",
    fullPrice:[197000,316000,422000],
    sections:[
      { label:"Main Dishes", label_es:"Platos Principales", items:[
        { name:"Arepa de Huevo",   name_es:"Arepa de Huevo",   desc:"Traditional fried arepa filled with egg.",                         desc_es:"Arepa tradicional rellena de huevo y frita.",          prices:[24000,60000,72000] },
        { name:"Arepa de Queso",   name_es:"Arepa de Queso",   desc:"Soft arepa stuffed with melted costeño cheese.",                   desc_es:"Arepa suave rellena de queso costeño derretido.",     prices:[40000,52000,80000] },
        { name:"Pericos Eggs",     name_es:"Huevos Pericos",   desc:"Scrambled eggs with tomato and onion.",                            desc_es:"Huevos revueltos con tomate y cebolla.",               prices:[24000,40000,40000] },
        { name:"Empanadas",        name_es:"Empanadas",         desc:"Fried empanadas: chicken, cheese, meat or ham with pineapple.",   desc_es:"Empanadas fritas de queso, pollo, carne o jamón.",    prices:[40000,40000,40000] },
        { name:"Cheese Fingers",   name_es:"Deditos de queso",  desc:"Fried dough sticks filled with cheese.",                          desc_es:"Palitos de masa fritos rellenos de queso.",            prices:[40000,40000,40000] },
        { name:"Fried Plantain",   name_es:"Patacones",         desc:"Traditional fried plantain chips.",                               desc_es:"Tradicionales chips de plátano frito.",                prices:[12000,12000,20000] },
      ]},
      { label:"Side Dishes", label_es:"Acompañamientos", items:[
        { name:"Costeño Sour Cream",        name_es:"Suero Costeño",            desc:"Refreshing sour cream made from buttermilk.",        desc_es:"Crema agria hecha a base de suero de leche.",                       prices:[12000,12000,24000] },
        { name:"Hogao",                     name_es:"Hogao",                    desc:"Homemade tomato and sautéed onion sauce.",           desc_es:"Salsa de tomate y cebolla salteada.",                               prices:[28000,28000,36000] },
        { name:"Seasonal Exotic Fruits",    name_es:"Frutas Exóticas de Temporada", desc:"Pitaya, mangosteen, granadilla, borojo…",       desc_es:"Pitaya, mangostino, granadilla, borojo…",                          prices:[80000,80000,140000] },
        { name:"Sausage and Chorizo",       name_es:"Salchicha y Chorizo",      desc:"",                                                  desc_es:"",                                                                  prices:[36000,52000,104000] },
        { name:"Costeño Cheese",            name_es:"Queso Costeño",            desc:"",                                                  desc_es:"",                                                                  prices:[16000,16000,28000] },
        { name:"Pan de Bono",               name_es:"Pan de Bono",              desc:"Colombian cheese bread (per unit).",                 desc_es:"Pan colombiano de queso, por unidad.",                              prices:[5000,5000,5000], unitLabel:"x U" },
      ]},
      { label:"Drinks", label_es:"Bebidas", items:[
        { name:"Coffee",                        name_es:"Café",                           desc:"Black or with milk.",              desc_es:"Negro o con leche.",              prices:[44000,44000,44000] },
        { name:"Natural Juice (local fruits)",  name_es:"Jugo Natural de Frutas Locales", desc:"Lulo, passion fruit or corozo.",   desc_es:"Lulo, maracuyá o corozo.",        prices:[40000,40000,40000] },
      ]},
    ]
  },
  { id:"american", label:"American Menu", label_es:"Menú Americano",
    fullPrice:[215000,337500,445000],
    sections:[
      { label:"Main Dishes", label_es:"Platos Principales", items:[
        { name:"Scrambled Eggs",              name_es:"Huevos Revueltos",          desc:"Ideal to combine with proteins.",                                      desc_es:"Ideales para combinar con proteínas.",                  prices:[14000,28000,28000] },
        { name:"Classic Pancakes",            name_es:"Hotcakes Clásicos",         desc:"Served with maple syrup and butter.",                                  desc_es:"Con sirope de maple y mantequilla.",                    prices:[24000,48000,72000] },
        { name:"Fruit Bowl with Greek Yogurt",name_es:"Bowl de Frutas con Yogurt", desc:"Fresh tropical fruit bowl, with optional greek yogurt and honey.",     desc_es:"Frutas tropicales, con yogur griego y miel opcional.",  prices:[100000,140000,200000] },
      ]},
      { label:"Proteins", label_es:"Proteínas", items:[
        { name:"Bacon",               name_es:"Tocino",              desc:"", desc_es:"", prices:[24000,44000,88000] },
        { name:"Sausages",            name_es:"Salchichas",          desc:"", desc_es:"", prices:[12000,32000,64000] },
        { name:"Chorizo",             name_es:"Chorizo",             desc:"", desc_es:"", prices:[24000,28000,56000] },
        { name:"Pork or Turkey Ham",  name_es:"Jamón de Cerdo o Pavo", desc:"", desc_es:"", prices:[16000,32000,64000] },
      ]},
      { label:"Side Dishes", label_es:"Acompañamientos", items:[
        { name:"Greek Yogurt",        name_es:"Yogur Griego",        desc:"Natural or flavored.",             desc_es:"Natural o de sabores.",         prices:[28000,56000,96000] },
        { name:"Granola & Nuts",      name_es:"Granola",             desc:"",                                desc_es:"",                              prices:[32000,32000,64000] },
        { name:"Bread",               name_es:"Pan",                 desc:"White and wholemeal.",             desc_es:"Blanco e integral.",            prices:[12000,12000,24000] },
        { name:"Spread Station",      name_es:"Estación de Untables",desc:"Butter, jam and cream cheese.",   desc_es:"Mantequilla, mermelada y queso crema.", prices:[40000,40000,68000] },
        { name:"Fresh Seasonal Fruits",name_es:"Frutas Frescas de Temporada", desc:"Banana, papaya, mango, watermelon, kiwi…", desc_es:"Banano, papaya, mango, sandía, kiwi…", prices:[52000,52000,100000] },
      ]},
      { label:"Drinks", label_es:"Bebidas", items:[
        { name:"American Coffee",     name_es:"Café Americano",      desc:"", desc_es:"", prices:[44000,44000,44000] },
        { name:"Fresh Orange Juice",  name_es:"Jugo de Naranja",     desc:"", desc_es:"", prices:[32000,32000,40000] },
        { name:"Milk",                name_es:"Leche",               desc:"Whole or lactose-free.", desc_es:"Entera o deslactosada.", prices:[24000,24000,80000] },
        { name:"Almond Milk",         name_es:"Leche de Almendras",  desc:"", desc_es:"", prices:[40000,40000,80000] },
      ]},
    ]
  },
  { id:"healthy", label:"Healthy, Vegan & Vegetarian", label_es:"Menú Saludable, Vegano y Vegetariano",
    fullPrice:[400000,550000,870000],
    sections:[
      { label:"Dishes", label_es:"Platos", items:[
        { name:"Whole Wheat Toast with Avocado",          name_es:"Tostadas Integrales con Aguacate",       desc:"Sliced whole wheat bread topped with avocado.",                         desc_es:"Pan integral cubierto con aguacate.",                     prices:[34000,50000,76000] },
        { name:"Grilled Arepa with Guacamole",            name_es:"Arepa Asada con Guacamole",              desc:"Soft arepa served with fresh guacamole.",                               desc_es:"Arepa suave con guacamole fresco.",                        prices:[50000,61000,94000] },
        { name:"Egg White Omelette with Vegetables",      name_es:"Omelette de Claras con Vegetales",       desc:"Egg whites cooked with a sauté of fresh vegetables.",                   desc_es:"Claras con salteado de vegetales frescos.",               prices:[36000,50000,80000] },
        { name:"Falafel with Tortilla",                   name_es:"Falafel con Tortilla",                   desc:"Spiced croquettes served with a soft tortilla.",                         desc_es:"Croquetas especiadas con tortilla suave.",                prices:[65000,120000,180000] },
        { name:"Oat & Banana Pancakes",                   name_es:"Pancakes de Avena y Banana",             desc:"Soft pancakes made with oats and ripe banana.",                         desc_es:"Panqueques de avena y banana madura.",                    prices:[42000,50000,59000] },
        { name:"Fruit Smoothie Bowl",                     name_es:"Smoothie Bowl de Fruta",                 desc:"A creamy bowl of fresh tropical fruits.",                               desc_es:"Tazón cremoso de frutas frescas tropicales.",             prices:[89000,108500,240000] },
        { name:"Granola with Nuts & Almond Milk",         name_es:"Granola con Frutos Secos y Leche de Almendra", desc:"Crunchy granola, nuts, and seeds with almond milk.",            desc_es:"Granola crujiente, frutos secos y semillas con leche de almendra.", prices:[61000,122000,160000] },
        { name:"Chickpea Salad with Cucumber & Herbs",    name_es:"Ensalada de Garbanzos con Pepino y Hierbas", desc:"Chickpeas combined with cucumber and fresh herbs.",              desc_es:"Garbanzos con pepino y hierbas frescas.",                 prices:[25000,35000,50000] },
        { name:"Protein Bars",    name_es:"Barras de Proteína",  desc:"", desc_es:"", prices:[12000,12000,12000], unitLabel:"x 1U" },
        { name:"Granola Bars",    name_es:"Barras de Granola",   desc:"", desc_es:"", prices:[15000,15000,15000], unitLabel:"x 6U" },
      ]},
    ]
  },
];

function CheckinForm() {
  const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
  const params    = new URLSearchParams(window.location.search);
  const kickoffId = params.get("kickoffId") || "";
  const [lang, setLang] = React.useState(params.get("lang") === "es" ? "es" : "en");
  const en = lang === "en";

  const [kickoff, setKickoff] = React.useState(null);
  const [loading, setLoading] = React.useState(!!kickoffId);
  const [sending, setSending] = React.useState(false);
  const [done,    setDone]    = React.useState(false);
  const [error,   setError]   = React.useState("");

  const empty = () => ({
    firstName: "", lastName: "", email: "", phone: "",
    idType: "Passport", idNumber: "", dob: "", nationality: "", gender: "",
    arrivalAirline: "", arrivalDate: "", arrivalFlight: "",
    departureAirline: "", departureDate: "", departureFlight: "",
    foodRestrictions: "", allergies: "", occasion: "", photoPermission: "",
    isGroupContact: "",
  });
  const [form, setForm] = React.useState(empty());

  React.useEffect(() => {
    if (!kickoffId) { setLoading(false); return; }
    fetch(GAS_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getKickoffById", id: kickoffId }),
    }).then(r => r.json()).then(res => {
      if (res.data) setKickoff(res.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [kickoffId]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setCheck = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.checked ? "yes" : "no" }));

  const submit = async () => {
    if (!form.firstName.trim()) { setError(en ? "First name is required." : "El nombre es requerido."); return; }
    setSending(true); setError("");
    try {
      const res = await fetch(GAS_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "saveCheckinResponse", kickoffId, response: { ...form, submittedAt: new Date().toISOString() } }),
      });
      const data = await res.json();
      if (data.ok) setDone(true);
      else setError(en ? "Something went wrong. Try again." : "Algo salió mal. Intenta de nuevo.");
    } catch { setError(en ? "Connection error. Try again." : "Error de conexión. Intenta de nuevo."); }
    finally { setSending(false); }
  };

  const tripLabel = (() => {
    if (!kickoff) return "";
    const city = String(kickoff.city || "").split(",")[0]?.trim();
    const MAP = { CTG:"Cartagena", MDE:"Medellín", BOG:"Bogotá", CDMX:"Ciudad de México", TUL:"Tulum" };
    return [kickoff.guestName, MAP[city?.toUpperCase()] || city, kickoff.tripDates].filter(Boolean).join(" · ");
  })();

  const inp = "w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-neutral-400 bg-white";
  const lbl = "block text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1";
  const sel = inp + " appearance-none";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-stone-50"><p className="text-sm text-neutral-400">{en?"Loading…":"Cargando…"}</p></div>;

  if (!kickoffId) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
      <div className="text-center"><div className="text-4xl mb-3">✈️</div>
        <p className="text-neutral-500 text-sm">{en?"No trip found. Check your link.":"No se encontró el viaje. Revisa tu link."}</p>
      </div>
    </div>
  );

  if (done) return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-semibold text-neutral-800 mb-2">{en?"All done!":"¡Listo!"}</h2>
        <p className="text-neutral-500 text-sm mb-6">{en?"Your info has been received. We'll have everything ready for your arrival.":"Tu información fue recibida. Tendremos todo listo para tu llegada."}</p>
        <button onClick={() => { setDone(false); setForm(empty()); }} className="text-sm text-neutral-600 underline">
          {en?"Add another person":"Agregar otra persona"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50 pb-16">
      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)" }} className="px-6 pt-10 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-widest mb-1">Two Travel</p>
              <h1 className="text-white text-2xl font-bold">Pre-Check-in</h1>
              {tripLabel && <p className="text-white/60 text-xs mt-1">{tripLabel}</p>}
            </div>
            <button onClick={() => setLang(en?"es":"en")}
              className="text-white/60 text-xs border border-white/20 rounded-full px-3 py-1 hover:bg-white/10">
              {en?"ES":"EN"}
            </button>
          </div>
          <p className="text-white/70 text-sm leading-relaxed">
            {en
              ? "Please fill out this form individually. It helps us prepare your passport check-in, coordinate transport, and handle dietary needs."
              : "Por favor completa este formulario de forma individual. Nos ayuda con el check-in, coordinar transporte y atender necesidades alimentarias."}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 mt-6 space-y-5">

        {/* 1. Personal */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">🪪 {en?"Personal Info":"Información Personal"}</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>{en?"First name *":"Nombre *"}</label>
                <input value={form.firstName} onChange={set("firstName")} className={inp}
                  placeholder={en?"First name":"Nombre"} />
              </div>
              <div>
                <label className={lbl}>{en?"Last name *":"Apellido *"}</label>
                <input value={form.lastName} onChange={set("lastName")} className={inp}
                  placeholder={en?"Last name":"Apellido"} />
              </div>
            </div>
            <div>
              <label className={lbl}>{en?"Email":"Correo electrónico"}</label>
              <input type="email" value={form.email} onChange={set("email")} className={inp} placeholder="email@example.com" />
            </div>
            <div>
              <label className={lbl}>{en?"Mobile / WhatsApp":"Celular / WhatsApp"}</label>
              <input type="tel" value={form.phone} onChange={set("phone")} className={inp} placeholder="+1 305 000 0000" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>{en?"ID Type":"Tipo de ID"}</label>
                <select value={form.idType} onChange={set("idType")} className={sel}>
                  <option value="Passport">{en?"Passport":"Pasaporte"}</option>
                  <option value="ID Card">{en?"ID Card":"Cédula"}</option>
                  <option value="Driver's License">{en?"Driver's License":"Licencia"}</option>
                </select>
              </div>
              <div>
                <label className={lbl}>{en?"ID Number":"Número de ID"}</label>
                <input value={form.idNumber} onChange={set("idNumber")} className={inp} placeholder="AB123456" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>{en?"Date of birth":"Fecha de nacimiento"}</label>
                <input type="date" value={form.dob} onChange={set("dob")} className={inp} />
              </div>
              <div>
                <label className={lbl}>{en?"Gender":"Género"}</label>
                <select value={form.gender} onChange={set("gender")} className={sel}>
                  <option value="">{en?"Select…":"Seleccionar…"}</option>
                  <option value="Male">{en?"Male":"Masculino"}</option>
                  <option value="Female">{en?"Female":"Femenino"}</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">{en?"Prefer not to say":"Prefiero no decir"}</option>
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>{en?"Nationality":"Nacionalidad"}</label>
              <input value={form.nationality} onChange={set("nationality")} className={inp}
                placeholder={en?"e.g. American, Colombian…":"ej. Colombiano, Americano…"} />
            </div>
          </div>
        </div>

        {/* 2. Dietary */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">🥗 {en?"Food & Health":"Alimentación y Salud"}</h3>
          <div className="space-y-3">
            <div>
              <label className={lbl}>{en?"Food restrictions":"Restricciones alimentarias"}</label>
              <textarea value={form.foodRestrictions} onChange={set("foodRestrictions")} rows={2} className={inp + " resize-none"}
                placeholder={en?"Gluten-free, vegan, kosher… or None":"Sin gluten, vegano, kosher… o Ninguna"} />
            </div>
            <div>
              <label className={lbl}>{en?"Allergies / Medical conditions":"Alergias / Condiciones médicas"}</label>
              <textarea value={form.allergies} onChange={set("allergies")} rows={2} className={inp + " resize-none"}
                placeholder={en?"Nut allergy, asthma… or None":"Alergia a nueces, asma… o Ninguna"} />
            </div>
          </div>
        </div>

        {/* 3. Arrival */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">🛬 {en?"Arrival Flight":"Vuelo de Llegada"}</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>{en?"Airline":"Aerolínea"}</label>
                <input value={form.arrivalAirline} onChange={set("arrivalAirline")} className={inp} placeholder="Avianca, Delta…" />
              </div>
              <div>
                <label className={lbl}>{en?"Flight #":"Vuelo #"}</label>
                <input value={form.arrivalFlight} onChange={set("arrivalFlight")} className={inp} placeholder="AV204" />
              </div>
            </div>
            <div>
              <label className={lbl}>{en?"Arrival date":"Fecha de llegada"}</label>
              <input type="date" value={form.arrivalDate} onChange={set("arrivalDate")} className={inp} />
            </div>
          </div>
        </div>

        {/* 4. Departure */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">🛫 {en?"Departure Flight":"Vuelo de Salida"}</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>{en?"Airline":"Aerolínea"}</label>
                <input value={form.departureAirline} onChange={set("departureAirline")} className={inp} placeholder="Avianca, Delta…" />
              </div>
              <div>
                <label className={lbl}>{en?"Flight #":"Vuelo #"}</label>
                <input value={form.departureFlight} onChange={set("departureFlight")} className={inp} placeholder="AV205" />
              </div>
            </div>
            <div>
              <label className={lbl}>{en?"Departure date":"Fecha de salida"}</label>
              <input type="date" value={form.departureDate} onChange={set("departureDate")} className={inp} />
            </div>
          </div>
        </div>

        {/* 5. Extras */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-700 mb-4 flex items-center gap-2">✨ {en?"A few more things":"Últimas preguntas"}</h3>
          <div className="space-y-4">
            <div>
              <label className={lbl}>{en?"What are you celebrating?":"¿Qué están celebrando?"}</label>
              <select value={form.occasion} onChange={set("occasion")} className={sel}>
                <option value="">{en?"Select…":"Seleccionar…"}</option>
                <option value="Birthday">{en?"Birthday":"Cumpleaños"}</option>
                <option value="Bachelorette">{en?"Bachelorette":"Despedida de soltera"}</option>
                <option value="Bachelor">{en?"Bachelor":"Despedida de soltero"}</option>
                <option value="Anniversary">{en?"Anniversary":"Aniversario"}</option>
                <option value="Honeymoon">{en?"Honeymoon":"Luna de miel"}</option>
                <option value="Family trip">{en?"Family trip":"Viaje familiar"}</option>
                <option value="Friends trip">{en?"Friends trip":"Viaje de amigos"}</option>
                <option value="Corporate">{en?"Corporate":"Corporativo"}</option>
                <option value="Nothing special">{en?"Nothing special":"Nada en especial"}</option>
              </select>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.photoPermission === "yes"} onChange={setCheck("photoPermission")}
                className="mt-0.5 w-4 h-4 accent-neutral-800 shrink-0" />
              <span className="text-sm text-neutral-600 leading-relaxed">
                {en
                  ? "I give permission to Two Travel to use my photos and videos for social media and marketing purposes."
                  : "Autorizo a Two Travel a usar mis fotos y videos en redes sociales y materiales de marketing."}
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.isGroupContact === "yes"} onChange={setCheck("isGroupContact")}
                className="mt-0.5 w-4 h-4 accent-neutral-800 shrink-0" />
              <span className="text-sm text-neutral-600">
                {en?"I am the main contact for this group.":"Soy el contacto principal del grupo."}
              </span>
            </label>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button onClick={submit} disabled={sending}
          className="w-full py-4 rounded-2xl text-white font-semibold text-sm transition-all"
          style={{ background: sending ? "#9ca3af" : "linear-gradient(135deg,#1a1a2e,#0f3460)" }}>
          {sending ? (en?"Sending…":"Enviando…") : (en?"Submit my info →":"Enviar mi información →")}
        </button>

        <p className="text-center text-[10px] text-neutral-400 pb-4">
          {en?"Your information is kept private and used only to prepare your trip.":"Tu información es privada y se usa únicamente para preparar tu viaje."}
        </p>

      </div>
    </div>
  );
}

function BreakfastCatalog() {
  const GAS_URL   = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";
  const params      = new URLSearchParams(window.location.search);
  const kickoffId   = params.get("kickoffId") || "";
  const gsParam     = parseInt(params.get("groupSize")) || 0;
  const tierParam   = params.get("groupTier") || "1-5";
  const currParam   = params.get("currency")  || "USD";
  const initTier    = gsParam > 0
    ? (gsParam <= 5 ? "1-5" : gsParam <= 10 ? "6-10" : "11-20")
    : (BREAKFAST_TIERS.includes(tierParam) ? tierParam : "1-5");
  const urlNights = (() => {
    const a = params.get("arrivalDate"), d = params.get("departureDate");
    if (!a || !d) return 0;
    const n = Math.round((new Date(d) - new Date(a)) / 86400000);
    return n > 0 ? n : 0;
  })();

  const EMPTY_CAT = () => ({ full: false, checked: {} });
  const EMPTY_DAY = () => ({ status: "pending", traditional: EMPTY_CAT(), american: EMPTY_CAT(), healthy: EMPTY_CAT() });

  // Migrate old format { mode, menuId, checked } → new per-category format
  const migrateDay = (old) => {
    if (!old) return EMPTY_DAY();
    if (old.traditional !== undefined || old.american !== undefined || old.healthy !== undefined) return old;
    const result = EMPTY_DAY();
    if (old.mode === "full" && old.menuId && result[old.menuId]) {
      result[old.menuId].full = true;
    } else if (old.checked) {
      Object.entries(old.checked).forEach(([key, val]) => {
        if (!val) return;
        const ci = key.indexOf(":");
        if (ci >= 0) {
          const catId = key.slice(0, ci), itemName = key.slice(ci + 1);
          if (result[catId]) result[catId].checked[itemName] = true;
        }
      });
    }
    return result;
  };

  const [lang,        setLang]        = React.useState(params.get("lang") === "es" ? "es" : "en");
  const [tier,        setTier]        = React.useState(initTier);
  const [currency,    setCurrency]    = React.useState("USD");
  const [groupSize,   setGroupSize]   = React.useState(gsParam > 0 ? gsParam : null);
  const [stayNights,  setStayNights]  = React.useState(urlNights || 1);
  const [guestName,   setGuestName]   = React.useState(params.get("guestName") || "");
  const [currentDay,  setCurrentDay]  = React.useState(0);
  const [loading,     setLoading]     = React.useState(!!kickoffId);
  const [dayOrders,   setDayOrders]   = React.useState(() =>
    Array.from({ length: urlNights || 1 }, EMPTY_DAY)
  );
  const [notes,           setNotes]           = React.useState("");
  const [sent,            setSent]            = React.useState(false);
  const [sending,         setSending]         = React.useState(false);
  const [fxRate,          setFxRate]          = React.useState(4000);
  const [arrivalDate,     setArrivalDate]     = React.useState(params.get("arrivalDate") || "");
  const [checkInFormUrl,  setCheckInFormUrl]  = React.useState("");
  const autosaveRef = React.useRef(null);

  React.useEffect(() => {
    fetch("https://open.er-api.com/v6/latest/USD")
      .then(r => r.json())
      .then(d => { if (d?.rates?.COP) setFxRate(Math.round(d.rates.COP)); })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!kickoffId) { setLoading(false); return; }
    fetch(GAS_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getKickoffById", id: kickoffId }),
    })
      .then(r => r.json())
      .then(res => {
        const k = res.data;
        if (!k) return;
        // nights from dates always wins — computed first, used to clamp saved orders
        let dateNights = 0;
        if (!urlNights && k.arrivalDate && k.departureDate) {
          dateNights = Math.round((new Date(k.departureDate) - new Date(k.arrivalDate)) / 86400000);
          if (dateNights > 0) setStayNights(dateNights);
        }
        if (!gsParam) {
          const gs = parseInt(k.groupSize) || 0;
          if (gs > 0) {
            setGroupSize(gs);
            setTier(gs <= 5 ? "1-5" : gs <= 10 ? "6-10" : "11-20");
          } else {
            try {
              const qa = JSON.parse(k.quizAnswers || "{}");
              const qgs = parseInt(qa.groupSize || qa.pax) || 0;
              if (qgs > 0) { setGroupSize(qgs); setTier(qgs <= 5 ? "1-5" : qgs <= 10 ? "6-10" : "11-20"); }
            } catch {}
          }
        }
        if (!params.get("guestName") && k.guestName) setGuestName(k.guestName);
        if (!params.get("arrivalDate") && k.arrivalDate) setArrivalDate(k.arrivalDate);
        if (k.checkInFormUrl) setCheckInFormUrl(k.checkInFormUrl);
        if (k.breakfastOrderJson) {
          try {
            const saved = JSON.parse(k.breakfastOrderJson);
            if (saved.dayOrders?.length) {
              // dates take priority; only fall back to saved nights if no dates
              const nights = dateNights > 0 ? dateNights : (saved.stayNights || saved.dayOrders.length);
              setStayNights(nights);
              const orders = saved.dayOrders.map(migrateDay);
              // pad or trim saved orders to match actual nights
              const adjusted = nights > orders.length
                ? [...orders, ...Array.from({ length: nights - orders.length }, EMPTY_DAY)]
                : orders.slice(0, nights);
              setDayOrders(adjusted);
            }
            if (saved.notes) setNotes(saved.notes);
            if (saved.tier && BREAKFAST_TIERS.includes(saved.tier)) setTier(saved.tier);
            // currency always resets to USD on load — don't restore saved preference
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kickoffId]);

  React.useEffect(() => {
    setDayOrders(prev => {
      if (prev.length === stayNights) return prev;
      if (prev.length < stayNights)
        return [...prev, ...Array.from({ length: stayNights - prev.length }, EMPTY_DAY)];
      return prev.slice(0, stayNights);
    });
  }, [stayNights]);

  const en      = lang === "en";
  const tierIdx = BREAKFAST_TIERS.indexOf(tier);

  const fmt = (cop) => currency === "USD"
    ? `$${(cop / fxRate).toFixed(0)} USD`
    : `$${cop.toLocaleString("es-CO")} COP`;

  const getDayLabel = (i) => {
    if (arrivalDate) {
      const d = new Date(arrivalDate + "T12:00:00");
      d.setDate(d.getDate() + i);
      const wd = d.toLocaleDateString(en ? "en-US" : "es-CO", { weekday: "short" });
      return `${wd} ${d.getDate()}`;
    }
    return en ? `Day ${i+1}` : `Día ${i+1}`;
  };

  const catPrice = (cat, menu) => {
    if (!cat || !menu) return 0;
    if (cat.full) return menu.fullPrice[tierIdx] || 0;
    return menu.sections.flatMap(s => s.items)
      .reduce((s, it) => cat.checked[it.name] ? s + (it.prices[tierIdx] || 0) : s, 0);
  };

  const dayPrice = (order) =>
    BREAKFAST_MENUS.reduce((s, menu) => s + catPrice(order[menu.id], menu), 0);

  const tripTotal = dayOrders.reduce((s, o) => s + dayPrice(o), 0);

  const doAutosave = (orders, notesVal) => {
    if (!kickoffId) return;
    clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      updateKickoffInSheet(kickoffId, {
        breakfastOrderJson: JSON.stringify({ dayOrders: orders, tier, currency, notes: notesVal, stayNights }),
      }).catch(() => {});
    }, 1500);
  };

  const toggleFull = (dayIdx, catId) => {
    setDayOrders(prev => {
      const next = prev.map((d, i) => i !== dayIdx ? d : { ...d, [catId]: { ...d[catId], full: !d[catId].full } });
      doAutosave(next, notes);
      return next;
    });
  };

  const toggleItem = (dayIdx, catId, itemName) => {
    setDayOrders(prev => {
      const next = prev.map((d, i) => i !== dayIdx ? d : {
        ...d, [catId]: { ...d[catId], checked: { ...d[catId].checked, [itemName]: !d[catId].checked[itemName] } },
      });
      doAutosave(next, notes);
      return next;
    });
  };

  const setDayStatus = (dayIdx, status) => {
    setDayOrders(prev => {
      const next = prev.map((d, i) => i !== dayIdx ? d : { ...d, status });
      doAutosave(next, notes);
      return next;
    });
  };

  const dayHasAny = (order) =>
    BREAKFAST_MENUS.some(m => order[m.id]?.full || Object.values(order[m.id]?.checked || {}).some(Boolean));

  const hasAnyOrder = dayOrders.some(dayHasAny);

  const handleSend = async () => {
    setSending(true);
    const paxLabel = groupSize ? `${groupSize} ${en ? "guests" : "personas"}` : `${tier} pax`;
    const lines = [];
    dayOrders.forEach((order, i) => {
      const dp = dayPrice(order);
      if (!dayHasAny(order)) return;
      if (stayNights > 1) {
        const statusLabel = order.status === "confirmed" ? (en ? "Confirmed" : "Confirmado") : (en ? "Deciding" : "Aún decidiendo");
        lines.push(`*${getDayLabel(i)} — ${statusLabel}*`);
      }
      BREAKFAST_MENUS.forEach(menu => {
        const cat = order[menu.id];
        if (!cat) return;
        const catLabel = en ? menu.label : menu.label_es;
        if (cat.full) {
          lines.push(`  · ${catLabel}: ${en ? "Full Menu" : "Menú Completo"} — ${fmt(menu.fullPrice[tierIdx])}`);
        } else {
          const items = menu.sections.flatMap(s => s.items).filter(it => cat.checked[it.name]);
          if (items.length) {
            const itemList = items.map(it => en ? it.name : it.name_es).join(", ");
            const itemTotal = items.reduce((s, it) => s + (it.prices[tierIdx] || 0), 0);
            lines.push(`  · ${catLabel}: ${itemList} — ${fmt(itemTotal)}`);
          }
        }
      });
      if (dp > 0) lines.push(`  ${en ? "Day total" : "Total día"}: ~${fmt(dp)}`);
      if (i < dayOrders.length - 1) lines.push("");
    });
    if (notes.trim()) lines.push(`\n📝 ${notes}`);
    if (tripTotal > 0) lines.push(`\n*${en ? "Trip total" : "Total viaje"}: ~${fmt(tripTotal)}*`);
    const text = `☕ *Breakfast* ${guestName ? `· ${guestName}` : ""} · ${paxLabel}\n\n${lines.join("\n")}`;
    const now = new Date().toISOString();
    try {
      await fetch(GAS_URL, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({ action:"sendSlackMessage", payload:{ text, channelId:import.meta.env.VITE_SLACK_CHANNEL_ID||"C0BB4EPSAP4", slackToken:import.meta.env.VITE_SLACK_BOT_TOKEN||"" }}),
      });
      if (kickoffId) {
        updateKickoffInSheet(kickoffId, {
          breakfastOrder: text.replace(/\*/g,""),
          breakfastOrderAt: now,
          breakfastOrderJson: JSON.stringify({ dayOrders, tier, currency, notes, stayNights }),
        }).catch(() => {});
      }
    } catch {}
    setSent(true); setSending(false);
  };

  if (loading) return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <p style={{color:"#9a7d52",fontSize:13}}>Loading…</p>
    </div>
  );

  if (sent) return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif"}}>
      <div style={{textAlign:"center",maxWidth:400,padding:"40px 24px"}}>
        <div style={{width:48,height:2,background:"#9a7d52",margin:"0 auto 32px"}}/>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:500,color:"#1a1814",marginBottom:12}}>
          {en ? "Got it! ☕" : "¡Listo! ☕"}
        </p>
        <p style={{fontSize:13,color:"#7a7570",lineHeight:1.6}}>
          {en
            ? "Your breakfast order has been sent to your concierge. We'll have everything ready for you."
            : "Tu pedido de desayuno fue enviado a tu concierge. Tendremos todo listo para ti."}
        </p>
        <button onClick={() => setSent(false)}
          style={{marginTop:32,fontSize:11,color:"#9a7d52",background:"none",border:"none",cursor:"pointer",letterSpacing:".1em",textTransform:"uppercase"}}>
          {en ? "Edit order" : "Editar pedido"}
        </button>
      </div>
    </div>
  );

  const curOrder = dayOrders[currentDay] || EMPTY_DAY();

  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",fontFamily:"'Jost',sans-serif",color:"#1a1814"}}>
      {/* Header */}
      <div style={{background:"#1a1814",padding:"28px 24px 24px",textAlign:"center"}}>
        <img src="/logo.png" alt="Two Travel" style={{height:28,opacity:.85,marginBottom:16,filter:"brightness(0) invert(1)"}} />
        <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:500,color:"#f7f4ef",marginBottom:6}}>
          {en ? "Breakfast Menu" : "Menú de Desayuno"}
        </h1>
        <p style={{fontSize:12,color:"#9a7d52",letterSpacing:".06em"}}>
          {guestName ? guestName + " · " : ""}
          {groupSize ? `${groupSize} ${en ? "guests" : "personas"}` : `${tier} ${en ? "guests" : "personas"}`}
        </p>
        <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:16,flexWrap:"wrap"}}>
          {!groupSize && (
            <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.08)",borderRadius:6,padding:3}}>
              {BREAKFAST_TIERS.map(t => (
                <button key={t} onClick={() => setTier(t)} style={{
                  padding:"4px 12px",fontSize:11,borderRadius:4,border:"none",cursor:"pointer",transition:"all .15s",
                  background: tier === t ? "#9a7d52" : "transparent",
                  color: tier === t ? "#fff" : "rgba(255,255,255,.5)",
                }}>{t} pax</button>
              ))}
            </div>
          )}
          <button onClick={() => setCurrency(c => c === "COP" ? "USD" : "COP")} style={{
            padding:"4px 14px",fontSize:11,background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.7)",
            border:"1px solid rgba(255,255,255,.15)",borderRadius:6,cursor:"pointer",
          }}>{currency} ⇄</button>
          <button onClick={() => setLang(l => l === "en" ? "es" : "en")} style={{
            padding:"4px 14px",fontSize:11,background:"rgba(255,255,255,.08)",color:"rgba(255,255,255,.7)",
            border:"1px solid rgba(255,255,255,.15)",borderRadius:6,cursor:"pointer",
          }}>{en ? "ES" : "EN"}</button>
        </div>
      </div>

      {/* How it works */}
      <div style={{background:"#fdf8f2",borderBottom:"1px solid #e5ddd3",padding:"14px 20px"}}>
        <div style={{maxWidth:680,margin:"0 auto",display:"flex",gap:10,alignItems:"flex-start"}}>
          <span style={{fontSize:18,flexShrink:0}}>☕</span>
          <div>
            <p style={{fontSize:12,fontWeight:600,color:"#1a1814",marginBottom:3}}>
              {en ? "How it works" : "Cómo funciona"}
            </p>
            <p style={{fontSize:11,color:"#7a7570",lineHeight:1.6,margin:0}}>
              {en
                ? "Choose what you'd like for breakfast each day of your stay. You can mix categories — pick individual dishes or go for the full menu of a category. Prices are per day for the whole group."
                : "Elige lo que quieres para el desayuno cada día de tu estadía. Puedes combinar categorías — elige platos individuales o toma el menú completo de una categoría. Los precios son por día para todo el grupo."}
            </p>
          </div>
        </div>
      </div>

      {/* Day tabs */}
      {stayNights > 1 && (
        <div style={{background:"#f0ebe3",borderBottom:"1px solid #e5ddd3",padding:"10px 20px",overflowX:"auto"}}>
          <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
            {Array.from({ length: stayNights }, (_, i) => {
              const hasItems = dayHasAny(dayOrders[i] || EMPTY_DAY());
              const confirmed = dayOrders[i]?.status === "confirmed";
              const isActive = currentDay === i;
              return (
                <button key={i} onClick={() => setCurrentDay(i)} style={{
                  padding:"6px 16px", fontSize:11, fontWeight:500, letterSpacing:".06em",
                  border:`1.5px solid ${isActive ? "#9a7d52" : "#d5ccc0"}`,
                  borderRadius:20, cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap",
                  background: isActive ? "#9a7d52" : "#fff",
                  color: isActive ? "#fff" : hasItems ? "#9a7d52" : "#7a7570",
                }}>
                  {getDayLabel(i)}
                  {confirmed && !isActive && <span style={{marginLeft:4,fontSize:9}}>✓</span>}
                  {hasItems && !confirmed && !isActive && <span style={{marginLeft:5,opacity:.7}}>·</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{maxWidth:680,margin:"0 auto",padding:"24px 20px 40px"}}>

        {/* Status toggle for current day */}
        <div style={{display:"flex",gap:8,marginBottom:24,alignItems:"center"}}>
            <span style={{fontSize:11,color:"#7a7570",marginRight:4}}>{en ? "Status:" : "Estado:"}</span>
            {[
              { key:"pending",   label: en ? "Still deciding" : "Aún decidiendo" },
              { key:"confirmed", label: en ? "Confirmed"      : "Confirmado" },
            ].map(opt => {
              const active = curOrder.status === opt.key;
              return (
                <button key={opt.key} onClick={() => setDayStatus(currentDay, opt.key)} style={{
                  padding:"5px 14px", fontSize:11, fontWeight: active ? 600 : 400,
                  border:`1.5px solid ${active ? (opt.key === "confirmed" ? "#16a34a" : "#9a7d52") : "#d5ccc0"}`,
                  borderRadius:20, cursor:"pointer", transition:"all .15s",
                  background: active ? (opt.key === "confirmed" ? "#dcfce7" : "#fdf8f2") : "#fff",
                  color: active ? (opt.key === "confirmed" ? "#16a34a" : "#9a7d52") : "#7a7570",
                }}>
                  {opt.label}
                </button>
              );
            })}
          </div>

        {/* Per-category selection */}
        {BREAKFAST_MENUS.map(menu => {
          const cat = curOrder[menu.id] || EMPTY_CAT();
          const cp = catPrice(cat, menu);
          const catLabel = en ? menu.label : menu.label_es;
          const BADGE_COLORS = { traditional:"#9a7d52", american:"#2563eb", healthy:"#16a34a" };
          const badgeColor = BADGE_COLORS[menu.id] || "#9a7d52";
          return (
            <div key={menu.id} style={{marginBottom:28,background:"#fff",borderRadius:10,border:"1px solid #e5ddd3",overflow:"hidden"}}>
              {/* Category header */}
              <div style={{padding:"12px 16px",background:"#f9f6f2",borderBottom:"1px solid #e5ddd3",display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:11,fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",
                  color:badgeColor,background:`${badgeColor}18`,padding:"3px 10px",borderRadius:20}}>
                  {catLabel}
                </span>
                {cp > 0 && (
                  <span style={{fontSize:11,color:"#9a7d52",marginLeft:"auto",fontWeight:600}}>~{fmt(cp)}</span>
                )}
              </div>

              {/* Items */}
              <div style={{padding:"8px 12px"}}>
                {menu.sections.map((sec, si) => (
                  <div key={si} style={{marginBottom:4}}>
                    {menu.sections.length > 1 && (
                      <p style={{fontSize:9,fontWeight:500,letterSpacing:".16em",textTransform:"uppercase",
                        color:"#b8b0a8",marginBottom:6,marginTop:si > 0 ? 10 : 4}}>
                        {en ? sec.label : sec.label_es}
                      </p>
                    )}
                    {sec.items.map((it, ii) => {
                      const on = !!cat.checked[it.name];
                      const disabled = cat.full;
                      return (
                        <button key={ii} onClick={() => !disabled && toggleItem(currentDay, menu.id, it.name)}
                          style={{
                            width:"100%",display:"flex",alignItems:"flex-start",gap:12,padding:"10px 12px",
                            background: on && !disabled ? `${badgeColor}0d` : "#fff",
                            border:`1px solid ${on && !disabled ? badgeColor : "#f0ebe3"}`,
                            borderRadius:6,marginBottom:4,cursor: disabled ? "default" : "pointer",
                            textAlign:"left",transition:"all .12s",opacity: disabled ? 0.45 : 1,
                          }}>
                          <div style={{
                            width:15,height:15,borderRadius:3,flexShrink:0,marginTop:2,
                            border:`1.5px solid ${on && !disabled ? badgeColor : "#c8c0b8"}`,
                            background: on && !disabled ? badgeColor : "transparent",
                            display:"flex",alignItems:"center",justifyContent:"center",
                          }}>
                            {on && !disabled && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontSize:13,fontWeight:500,color:"#1a1814",marginBottom:1}}>
                              {en ? it.name : it.name_es}
                            </p>
                            {(en ? it.desc : it.desc_es) && (
                              <p style={{fontSize:11,color:"#9a9590",lineHeight:1.4}}>{en ? it.desc : it.desc_es}</p>
                            )}
                          </div>
                          <span style={{fontSize:12,fontWeight:500,color:badgeColor,flexShrink:0,marginLeft:8}}>
                            {fmt(it.prices[tierIdx])}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}

                {/* Full menu option */}
                <button onClick={() => toggleFull(currentDay, menu.id)} style={{
                  width:"100%",display:"flex",alignItems:"center",gap:12,padding:"12px 14px",
                  marginTop:8,
                  background: cat.full ? `${badgeColor}12` : "#f9f6f2",
                  border:`1.5px solid ${cat.full ? badgeColor : "#d5ccc0"}`,
                  borderRadius:8,cursor:"pointer",textAlign:"left",transition:"all .12s",
                }}>
                  <div style={{
                    width:16,height:16,borderRadius:"50%",flexShrink:0,
                    border:`1.5px solid ${cat.full ? badgeColor : "#c8c0b8"}`,
                    background: cat.full ? badgeColor : "transparent",
                    display:"flex",alignItems:"center",justifyContent:"center",
                  }}>
                    {cat.full && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:12,fontWeight:700,color: cat.full ? badgeColor : "#5a5550",marginBottom:1}}>
                      {en ? `✦ Full ${catLabel} Menu` : `✦ Menú Completo ${catLabel}`}
                    </p>
                    <p style={{fontSize:10,color:"#9a9590"}}>
                      {en ? "All dishes in shared portions for the group" : "Todos los platos en porciones compartidas para el grupo"}
                    </p>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <span style={{fontSize:15,fontWeight:700,color:badgeColor}}>{fmt(menu.fullPrice[tierIdx])}</span>
                    <span style={{fontSize:9,color:"#b8b0a8",display:"block"}}>{en ? "/ day" : "/ día"}</span>
                  </div>
                </button>
              </div>
            </div>
          );
        })}

        {/* Order summary before submit */}
        {hasAnyOrder && (
          <div style={{background:"#fff",border:"1px solid #e5ddd3",borderRadius:10,overflow:"hidden",marginBottom:20}}>
            <div style={{padding:"12px 16px",background:"#f9f6f2",borderBottom:"1px solid #e5ddd3"}}>
              <p style={{fontSize:12,fontWeight:700,color:"#1a1814",letterSpacing:".04em"}}>
                {en ? "Order Summary" : "Resumen del pedido"}
              </p>
            </div>
            <div style={{padding:"12px 16px"}}>
              {dayOrders.map((order, i) => {
                const dp = dayPrice(order);
                if (!dayHasAny(order)) return null;
                const confirmed = order.status === "confirmed";
                return (
                  <div key={i} style={{marginBottom:12,paddingBottom:12,borderBottom: i < dayOrders.length - 1 ? "1px solid #f0ebe3" : "none"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontSize:12,fontWeight:600,color:"#1a1814"}}>
                        {stayNights > 1 ? getDayLabel(i) : (en ? "Your order" : "Tu pedido")}
                      </span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {stayNights > 1 && (
                          <span style={{fontSize:10,color: confirmed ? "#16a34a" : "#d97706",fontWeight:600}}>
                            {confirmed ? (en ? "Confirmed" : "Confirmado") : (en ? "Deciding" : "Aún decidiendo")}
                          </span>
                        )}
                        {dp > 0 && <span style={{fontSize:12,color:"#9a7d52",fontWeight:600}}>~{fmt(dp)}</span>}
                      </div>
                    </div>
                    {BREAKFAST_MENUS.map(menu => {
                      const cat = order[menu.id];
                      if (!cat) return null;
                      const catLabel = en ? menu.label : menu.label_es;
                      if (cat.full) return (
                        <p key={menu.id} style={{fontSize:11,color:"#7a7570",margin:"2px 0"}}>
                          · {catLabel}: {en ? "Full Menu" : "Menú Completo"}
                        </p>
                      );
                      const items = menu.sections.flatMap(s => s.items).filter(it => cat.checked[it.name]);
                      if (!items.length) return null;
                      return (
                        <p key={menu.id} style={{fontSize:11,color:"#7a7570",margin:"2px 0"}}>
                          · {catLabel}: {items.map(it => en ? it.name : it.name_es).join(", ")}
                        </p>
                      );
                    })}
                  </div>
                );
              })}
              {tripTotal > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:8,borderTop:"1px solid #e5ddd3"}}>
                  <span style={{fontSize:12,fontWeight:600,color:"#1a1814"}}>
                    {en ? "Estimated trip total" : "Total estimado del viaje"}
                  </span>
                  <span style={{fontSize:16,fontWeight:700,color:"#9a7d52"}}>~{fmt(tripTotal)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Food restrictions note */}
        <p style={{fontSize:11,color:"#9a9590",fontStyle:"italic",marginBottom:8,lineHeight:1.6}}>
          {en
            ? "Note: Basic items (sugar, salt, oil, napkins) are not included. An additional cost of $10–$20 USD may apply."
            : "Nota: Los básicos (azúcar, sal, aceite, servilletas) no están incluidos. Puede aplicar un costo adicional de $10–$20 USD."}
        </p>
        <p style={{fontSize:11,color:"#9a9590",marginBottom:8,lineHeight:1.6}}>
          {en
            ? "Dietary restrictions or allergies? Please include them in your check-in form — your concierge will have that information ready."
            : "¿Restricciones alimentarias o alergias? Inclúyelas en tu formulario de check-in — tu concierge ya tendrá esa información."}
          {checkInFormUrl && <>{" "}<a href={checkInFormUrl} target="_blank" rel="noreferrer" style={{color:"#9a7d52",textDecoration:"underline"}}>{en ? "Open check-in form →" : "Abrir formulario →"}</a></>}
        </p>
        <textarea value={notes} onChange={e => { setNotes(e.target.value); doAutosave(dayOrders, e.target.value); }} rows={2}
          placeholder={en ? "Any specific requests for your breakfast order…" : "Peticiones específicas para tu pedido de desayuno…"}
          style={{width:"100%",background:"#fff",border:"1px solid #e5ddd3",borderRadius:6,padding:"10px 14px",
            fontSize:13,color:"#1a1814",outline:"none",resize:"none",marginBottom:20,fontFamily:"'Jost',sans-serif",boxSizing:"border-box"}}/>

        <button onClick={handleSend} disabled={!hasAnyOrder || sending} style={{
          width:"100%",padding:"14px",fontSize:12,fontWeight:500,letterSpacing:".1em",textTransform:"uppercase",
          background: hasAnyOrder ? "#1a1814" : "#ccc",color:"#fff",border:"none",borderRadius:6,
          cursor: hasAnyOrder ? "pointer" : "default",transition:"background .15s",
        }}>
          {sending ? (en ? "Sending…" : "Enviando…") : (en ? "Send order to concierge" : "Enviar pedido al concierge")}
        </button>
      </div>
    </div>
  );
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
// Change PINs and roles here. Roles: "admin" | "concierge" | "sales" | "viewer"
// ─── ROLES ───────────────────────────────────────────────────────
const ROLE_META = {
  admin:     { label: "Admin",     color: "#fff", bg: "#111",    border: "#111"    },
  concierge: { label: "Concierge", color: "#fff", bg: "#2563eb", border: "#2563eb" },
  junior:    { label: "Junior",    color: "#fff", bg: "#059669", border: "#059669" },
  finance:   { label: "Finanzas",  color: "#fff", bg: "#d97706", border: "#d97706" },
  marketing: { label: "Marketing", color: "#fff", bg: "#7c3aed", border: "#7c3aed" },
};

// Modes each role can access
const ROLE_ACCESS = {
  admin:     ["concierge","dashboard","kpi","tasks","soporte","soporte-dashboard","reuniones","users","bodas","tareas-bodas"],
  concierge: ["concierge","dashboard","kpi","tasks","soporte","soporte-dashboard","reuniones"],
  junior:    ["dashboard"],
  finance:   ["dashboard","soporte"],
  marketing: ["dashboard"],
  bodas:     ["bodas","tareas-bodas","dashboard"],
};

const PROTECTED_MODES = new Set(["concierge","dashboard","kpi","tasks","soporte","soporte-dashboard","reuniones","users","bodas","tareas-bodas"]);

// ─── AUTH ─────────────────────────────────────────────────────────
function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("tt_auth2") || "null");
      if (!s || !s.email || Date.now() > s.exp) return null;
      return s;
    } catch { return null; }
  });

  const login = async (email, pin) => {
    const res = await fetch(GAS_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "loginUser", payload: { email: email.toLowerCase().trim(), pin } }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "Credenciales incorrectas" };
    const u = { ...data.user, exp: Date.now() + 12 * 3600_000 };
    localStorage.setItem("tt_auth2", JSON.stringify(u));
    setUser(u);
    return { ok: true };
  };

  const logout = () => { localStorage.removeItem("tt_auth2"); setUser(null); };
  return { user, login, logout };
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const res = await onLogin(email, pin);
    setLoading(false);
    if (!res.ok) { setError(res.error || "Credenciales incorrectas"); setPin(""); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"40px 36px",boxShadow:"0 4px 24px rgba(0,0,0,.08)",width:340,textAlign:"center"}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500,color:"#1a1814",marginBottom:4}}>Two Travel</p>
        <p style={{fontSize:11,color:"#9a7d52",letterSpacing:".12em",textTransform:"uppercase",marginBottom:32}}>Internal Access</p>
        <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:12}}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            placeholder="tu@two.travel"
            autoFocus
            style={{width:"100%",border:"1px solid #e5ddd3",borderRadius:10,padding:"12px 16px",fontSize:13,outline:"none",fontFamily:"'Jost',sans-serif",boxSizing:"border-box"}}
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => { setPin(e.target.value); setError(""); }}
            placeholder="PIN"
            style={{width:"100%",border:"1px solid #e5ddd3",borderRadius:10,padding:"12px 16px",fontSize:18,textAlign:"center",letterSpacing:".3em",outline:"none",fontFamily:"'Jost',sans-serif",boxSizing:"border-box"}}
          />
          {error && <p style={{color:"#e05c5c",fontSize:12,margin:0}}>{error}</p>}
          <button type="submit" disabled={loading || !email || !pin}
            style={{background:"#1a1814",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:13,letterSpacing:".06em",cursor:loading?"wait":"pointer",fontFamily:"'Jost',sans-serif",opacity:(!email||!pin)?0.5:1}}>
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

const SUPER_ADMINS = ["michel@two.travel","caro@two.travel","ray@two.travel"];

function RegisterScreen() {
  const [email, setEmail]     = useState("");
  const [pin, setPin]         = useState("");
  const [pin2, setPin2]       = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);
  const [error, setError]     = useState("");

  const handle = async (e) => {
    e.preventDefault(); setError("");
    if (!email.toLowerCase().endsWith("@two.travel")) { setError("Solo emails @two.travel"); return; }
    if (pin.length < 4) { setError("PIN mínimo 4 dígitos"); return; }
    if (pin !== pin2)   { setError("Los PINs no coinciden"); return; }
    setLoading(true);
    const res = await fetch(GAS_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "registerUser", payload: { email: email.toLowerCase().trim(), pin } }),
    });
    const d = await res.json();
    setLoading(false);
    if (!d.ok) { setError(d.error || "Error al registrar"); return; }
    setDone(true);
  };

  const inp = { width:"100%", border:"1px solid #e5ddd3", borderRadius:10, padding:"12px 16px", fontSize:14, outline:"none", fontFamily:"'Jost',sans-serif", boxSizing:"border-box" };

  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"40px 36px",boxShadow:"0 4px 24px rgba(0,0,0,.08)",width:340,textAlign:"center"}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500,color:"#1a1814",marginBottom:4}}>Two Travel</p>
        <p style={{fontSize:11,color:"#9a7d52",letterSpacing:".12em",textTransform:"uppercase",marginBottom:28}}>Crear cuenta</p>
        {done ? (
          <div style={{textAlign:"center"}}>
            <p style={{fontSize:32,marginBottom:12}}>✅</p>
            <p style={{fontSize:14,fontWeight:600,color:"#111",marginBottom:8}}>Solicitud enviada</p>
            <p style={{fontSize:12,color:"#6b7280",lineHeight:1.6}}>Le avisamos a los administradores. En cuanto aprueben tu acceso podrás entrar.</p>
            <a href="/?mode=dashboard" style={{display:"block",marginTop:20,fontSize:12,color:"#9a7d52"}}>← Ir al login</a>
          </div>
        ) : (
          <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:12}}>
            <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
              placeholder="tu@two.travel" autoFocus style={inp} />
            <input type="password" inputMode="numeric" maxLength={8} value={pin}
              onChange={e=>{setPin(e.target.value);setError("");}}
              placeholder="Elige un PIN" style={{...inp,textAlign:"center",letterSpacing:".3em",fontSize:18}} />
            <input type="password" inputMode="numeric" maxLength={8} value={pin2}
              onChange={e=>{setPin2(e.target.value);setError("");}}
              placeholder="Confirma el PIN" style={{...inp,textAlign:"center",letterSpacing:".3em",fontSize:18}} />
            {error && <p style={{color:"#e05c5c",fontSize:12,margin:0}}>{error}</p>}
            <button type="submit" disabled={loading||!email||!pin||!pin2}
              style={{background:"#1a1814",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:13,cursor:"pointer",opacity:(!email||!pin||!pin2)?0.5:1}}>
              {loading ? "Enviando…" : "Solicitar acceso"}
            </button>
            <a href="/?mode=dashboard" style={{fontSize:11,color:"#9ca3af"}}>Ya tengo cuenta → entrar</a>
          </form>
        )}
      </div>
    </div>
  );
}
function isSuperAdmin(user) { return user && SUPER_ADMINS.includes((user.email||"").toLowerCase()); }

// ─── CHANGE PIN ────────────────────────────────────────────────
function ChangePinScreen({ user, onDone }) {
  const [current, setCurrent] = useState("");
  const [next,    setNext]    = useState("");
  const [next2,   setNext2]   = useState("");
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handle = async (e) => {
    e.preventDefault(); setError("");
    if (next.length < 4)   { setError("PIN mínimo 4 dígitos"); return; }
    if (next !== next2)    { setError("Los PINs no coinciden"); return; }
    setLoading(true);
    // Verify current PIN first
    const verify = await fetch(GAS_URL, {
      method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({ action:"loginUser", payload:{ email: user.email, pin: current } }),
    });
    const vd = await verify.json();
    if (!vd.ok) { setLoading(false); setError("PIN actual incorrecto"); return; }
    // Update PIN
    const res = await fetch(GAS_URL, {
      method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({ action:"updateUser", payload:{ email: user.email, pin: next } }),
    });
    const d = await res.json();
    setLoading(false);
    if (!d.ok) { setError(d.error || "Error al guardar"); return; }
    setDone(true);
  };

  const inp = { width:"100%", border:"1px solid #e5ddd3", borderRadius:10, padding:"12px 16px", fontSize:18, textAlign:"center", letterSpacing:".3em", outline:"none", fontFamily:"'Jost',sans-serif", boxSizing:"border-box" };

  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Jost',sans-serif"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"40px 36px",boxShadow:"0 4px 24px rgba(0,0,0,.08)",width:340,textAlign:"center"}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500,color:"#1a1814",marginBottom:4}}>Two Travel</p>
        <p style={{fontSize:11,color:"#9a7d52",letterSpacing:".12em",textTransform:"uppercase",marginBottom:28}}>Cambiar PIN</p>
        {done ? (
          <div>
            <p style={{fontSize:32,marginBottom:12}}>✅</p>
            <p style={{fontSize:14,fontWeight:600,color:"#111",marginBottom:8}}>PIN actualizado</p>
            <button onClick={onDone} style={{marginTop:16,background:"#1a1814",color:"#fff",border:"none",borderRadius:10,padding:"12px 24px",fontSize:13,cursor:"pointer",fontFamily:"'Jost',sans-serif"}}>
              Volver al portal
            </button>
          </div>
        ) : (
          <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:12}}>
            <p style={{fontSize:12,color:"#6b7280",margin:"0 0 4px"}}>{user.email}</p>
            <input type="password" inputMode="numeric" maxLength={8} value={current}
              onChange={e=>{setCurrent(e.target.value);setError("");}}
              placeholder="PIN actual" autoFocus style={inp} />
            <input type="password" inputMode="numeric" maxLength={8} value={next}
              onChange={e=>{setNext(e.target.value);setError("");}}
              placeholder="PIN nuevo" style={inp} />
            <input type="password" inputMode="numeric" maxLength={8} value={next2}
              onChange={e=>{setNext2(e.target.value);setError("");}}
              placeholder="Confirma PIN nuevo" style={inp} />
            {error && <p style={{color:"#e05c5c",fontSize:12,margin:0}}>{error}</p>}
            <button type="submit" disabled={loading||!current||!next||!next2}
              style={{background:"#1a1814",color:"#fff",border:"none",borderRadius:10,padding:"13px",fontSize:13,cursor:"pointer",opacity:(!current||!next||!next2)?0.5:1,fontFamily:"'Jost',sans-serif"}}>
              {loading ? "Guardando…" : "Cambiar PIN"}
            </button>
            <button type="button" onClick={onDone} style={{background:"none",border:"none",color:"#9ca3af",fontSize:11,cursor:"pointer"}}>Cancelar</button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── USER MANAGEMENT (super admin only) ───────────────────────────
function UserManagement({ currentUser, onBack }) {
  const [users, setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ email:"", name:"", pin:"", role:"concierge" });
  const [addError, setAddError] = useState("");

  const load = () => {
    setLoading(true);
    fetch(GAS_URL, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({ action:"listUsers", payload:{ adminEmail: currentUser.email } }) })
      .then(r => r.json()).then(d => { if (d.ok) setUsers(d.data || []); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const update = async (email, field, value) => {
    setSaving(s => ({ ...s, [email+field]: true }));
    await fetch(GAS_URL, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({ action:"updateUser", payload:{ adminEmail: currentUser.email, email, [field]: value } }) });
    setSaving(s => ({ ...s, [email+field]: false }));
    setUsers(us => us.map(u => u.email === email ? { ...u, [field]: value } : u));
  };

  const addUser = async (e) => {
    e.preventDefault(); setAddError("");
    if (!newUser.email || !newUser.name || !newUser.pin) { setAddError("Completa todos los campos"); return; }
    const res = await fetch(GAS_URL, { method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
      body: JSON.stringify({ action:"upsertUser", payload:{ adminEmail: currentUser.email, ...newUser, email: newUser.email.toLowerCase() } }) });
    const d = await res.json();
    if (!d.ok) { setAddError(d.error || "Error"); return; }
    setShowAdd(false); setNewUser({ email:"", name:"", pin:"", role:"concierge" }); load();
  };

  return (
    <div style={{minHeight:"100vh",background:"#f7f4ef",fontFamily:"'Jost',sans-serif"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #e5e7eb",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:"#6b7280"}}>← Volver</button>
          <span style={{fontSize:14,fontWeight:600,color:"#111"}}>Gestión de usuarios</span>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,cursor:"pointer",fontWeight:500}}>
          + Agregar usuario
        </button>
      </div>

      <div style={{maxWidth:900,margin:"24px auto",padding:"0 24px"}}>
        {showAdd && (
          <form onSubmit={addUser} style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:20,marginBottom:20,display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            <input placeholder="Nombre" value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))}
              style={{flex:1,minWidth:120,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:12}} />
            <input placeholder="email@two.travel" value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))}
              style={{flex:2,minWidth:180,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:12}} />
            <input placeholder="PIN" maxLength={8} value={newUser.pin} onChange={e=>setNewUser(u=>({...u,pin:e.target.value}))}
              style={{width:80,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:12}} />
            <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))}
              style={{border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:12}}>
              {Object.keys(ROLE_META).map(r => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </select>
            {addError && <span style={{fontSize:11,color:"#e05c5c",width:"100%"}}>{addError}</span>}
            <button type="submit" style={{background:"#111",color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,cursor:"pointer"}}>Guardar</button>
          </form>
        )}

        {/* Pending approvals */}
        {!loading && users.filter(u => u.role === "pending").length > 0 && (
          <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:12,padding:16,marginBottom:16}}>
            <p style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"#92400e",marginBottom:10}}>⏳ Solicitudes pendientes</p>
            {users.filter(u => u.role === "pending").map(u => (
              <div key={u.email} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderRadius:8,padding:"10px 14px",marginBottom:6,border:"1px solid #fde68a"}}>
                <div>
                  <span style={{fontWeight:600,fontSize:13,color:"#111"}}>{u.email}</span>
                  <span style={{fontSize:11,color:"#9ca3af",marginLeft:8}}>solicita acceso</span>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {Object.entries(ROLE_META).filter(([r])=>r!=="pending").map(([role,meta]) => (
                    <button key={role} onClick={() => { update(u.email,"role",role); update(u.email,"active","true"); }}
                      style={{fontSize:10,padding:"4px 10px",borderRadius:99,border:`${role==="concierge"?"2px":"1px"} solid ${meta.border}`,cursor:"pointer",fontWeight:600,background:meta.bg,color:meta.color,boxShadow:role==="concierge"?"0 0 0 2px #bfdbfe":undefined}}>
                      {role==="concierge" ? "✓ "+meta.label : meta.label}
                    </button>
                  ))}
                  <button onClick={() => update(u.email,"active","false")}
                    style={{fontSize:10,padding:"4px 10px",borderRadius:99,border:"1px solid #fca5a5",cursor:"pointer",fontWeight:600,background:"#fee2e2",color:"#b91c1c"}}>
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? <p style={{color:"#9ca3af",fontSize:13,textAlign:"center",padding:32}}>Cargando usuarios…</p> : (
          <div style={{background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,overflow:"hidden"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#f9fafb"}}>
                  {["Nombre","Email","Rol","PIN","Activo"].map(h => (
                    <th key={h} style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"#6b7280",padding:"10px 16px",textAlign:"left",borderBottom:"1px solid #e5e7eb"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.email} style={{background:i%2===0?"#fff":"#fafafa",opacity:u.active==="false"||u.active===false?0.45:1}}>
                    <td style={{padding:"10px 16px",fontSize:13,fontWeight:500,color:"#111"}}>{u.name}</td>
                    <td style={{padding:"10px 16px",fontSize:12,color:"#6b7280"}}>{u.email}</td>
                    <td style={{padding:"10px 16px"}}>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        {Object.entries(ROLE_META).map(([role, meta]) => (
                          <button key={role} onClick={() => update(u.email, "role", role)}
                            disabled={saving[u.email+"role"]}
                            style={{fontSize:10,padding:"3px 8px",borderRadius:99,border:`1px solid ${meta.border}`,cursor:"pointer",fontWeight:600,
                              background: u.role===role ? meta.bg : "#fff",
                              color: u.role===role ? meta.color : meta.bg,
                              transition:"all .12s"}}>
                            {meta.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td style={{padding:"10px 16px"}}>
                      <input type="text" defaultValue={u.pin} maxLength={8}
                        onBlur={e => { if (e.target.value !== u.pin) update(u.email, "pin", e.target.value); }}
                        style={{width:70,border:"1px solid #e5e7eb",borderRadius:6,padding:"4px 8px",fontSize:12,fontFamily:"monospace"}} />
                    </td>
                    <td style={{padding:"10px 16px"}}>
                      <button onClick={() => update(u.email, "active", u.active===false||u.active==="false" ? "true" : "false")}
                        style={{fontSize:11,padding:"3px 10px",borderRadius:99,border:"1px solid",cursor:"pointer",fontWeight:500,
                          background: u.active===false||u.active==="false" ? "#fee2e2" : "#f0fdf4",
                          color: u.active===false||u.active==="false" ? "#b91c1c" : "#166534",
                          borderColor: u.active===false||u.active==="false" ? "#fca5a5" : "#86efac"}}>
                        {u.active===false||u.active==="false" ? "Inactivo" : "Activo"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────
function App() {
  const params    = new URLSearchParams(window.location.search);
  const mode      = params.get("mode");
  const kickoffId = params.get("kickoffId") || "";
  const { user, login, logout } = useAuth();

  // Public routes — no auth needed
  if (mode === "catalog" || mode === "questionnaire") {
    if (!kickoffId) return <WelcomeCatalogPage mode={mode} />;
    return <TwoTravelCatalog />;
  }
  if (mode === "drinks")    return <DrinksCatalog />;
  if (mode === "groceries") return <GroceryCatalog />;
  if (mode === "breakfast") return <BreakfastCatalog />;
  if (mode === "checkin")   return <CheckinForm />;
  if (mode === "itinerary") return <ItineraryPrintView />;
  if (mode === "register")  return <RegisterScreen />;
  if (mode === "pin") {
    if (!user) return <LoginScreen onLogin={login} />;
    return <ChangePinScreen user={user} onDone={() => { window.location.href = "/?mode=dashboard"; }} />;
  }
  if (!mode)                return <FeedbackForm kickoffId={kickoffId} />;

  // Protected routes
  if (PROTECTED_MODES.has(mode)) {
    if (!user) return <LoginScreen onLogin={login} />;
    const allowed = ROLE_ACCESS[user.role] || [];
    if (!allowed.includes(mode)) {
      // Redirect to their default landing
      const def = allowed[0];
      if (def) { window.location.href = `/?mode=${def}`; return null; }
      return <div style={{padding:40,textAlign:"center",color:"#6b7280"}}>Sin acceso.</div>;
    }

    if (mode === "users") {
      if (!isSuperAdmin(user)) return <div style={{padding:40,textAlign:"center",color:"#6b7280"}}>Sin acceso.</div>;
      return <UserManagement currentUser={user} onBack={() => window.history.back()} />;
    }
    if (mode === "concierge") return <ErrorBoundary><ConciergePanel onLogout={logout} currentUser={user} /></ErrorBoundary>;
    if (mode === "bodas")        return <ErrorBoundary><BodaPanel currentUser={user} onLogout={logout} /></ErrorBoundary>;
    if (mode === "tareas-bodas") return <ErrorBoundary><TareasPanel currentUser={user} onLogout={logout} /></ErrorBoundary>;
    if (mode === "soporte")   return <ErrorBoundary><SoportePage /></ErrorBoundary>;
    if (mode === "soporte-dashboard") return <ErrorBoundary><SoporteDashboard /></ErrorBoundary>;
    if (mode === "tasks")     return <ErrorBoundary><TaskTracker /></ErrorBoundary>;
    if (mode === "reuniones") return <ErrorBoundary><ReunionesPage /></ErrorBoundary>;
    if (mode === "dashboard" || mode === "kpi") return <ErrorBoundary><UnifiedDashboard currentUser={user} onLogout={logout} /></ErrorBoundary>;
  }

  return <FeedbackForm kickoffId={kickoffId} />;
}

export default App;