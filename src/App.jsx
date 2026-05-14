import React, { useMemo, useState, useEffect } from "react";
import ConciergePanel from "./ConciergePanel";
import TwoTravelCatalog from "./TwoTravelCatalog";
import ItineraryPrintView from "./ItineraryPrintView";
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
    tripDetailsSubtitle: "Quick context about your experience.",
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
      concierges: ["Aileen", "Alia", "Caro", "Dani", "Giulia", "Nataly"],
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
    tripDetailsSubtitle: "Un poco de contexto sobre tu experiencia.",
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
      concierges: ["Aileen", "Alia", "Caro", "Dani", "Giulia", "Nataly"],
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
  const preConcierge = params.get("concierge") || "";

  const initialLang =
    langParam === "es" || langParam === "en" ? langParam : "en";

  const [lang, setLang] = useState(initialLang);
  const t = translations[lang];

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMoreFeedback, setShowMoreFeedback] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
  destination: preDestination,
  concierge: preConcierge,
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
  if (!form.overallExperience) newErrors.overallExperience = true;
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
    // NOTA: este payload va al GAS de feedback (SCRIPT_URL), NO al GAS de kickoffs.
    // Solo incluye datos de la respuesta + referencia kickoffId para linkear.
    // No incluir campos que podrían sobreescribir el kickoff si el GAS los procesa mal.
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
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error("Error guardando");
    }

    setSubmitted(true);

    // Mark kickoff as feedback submitted (fire-and-forget)
    if (kickoffId) {
      updateKickoffInSheet(kickoffId, { status: "feedback_submitted", feedbackAt: new Date().toISOString() }).catch(
        (e) => console.warn("Could not update kickoff status:", e)
      );
    }
  } catch (err) {
    console.error(err);
    alert("Error guardando feedback");
  } finally {
    setSaving(false);
  }
};

  // Use module-level components (Fb*) — avoids remount on every keystroke
  const Section       = FbSection;
  const Label         = FbLabel;
  const Textarea      = FbTextarea;
  const ScorePills    = FbScorePills;
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <Section
            eyebrow="01"
            title={t.tripDetailsTitle}
            subtitle={t.tripDetailsSubtitle}
          >
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
                      <ScorePills
                        min={1} max={5}
                        value={form.itinerary}
                        onChange={(v) => updateField("itinerary", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.communication}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.communicationHint}</p>
                      <ScorePills
                        min={1} max={5}
                        value={form.communication}
                        onChange={(v) => updateField("communication", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.readiness}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.readinessHint}</p>
                      <ScorePills
                        min={1} max={5}
                        value={form.readiness}
                        onChange={(v) => updateField("readiness", v)}
                      />
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
                      <ScorePills
                        min={1} max={5}
                        value={form.responsiveness}
                        onChange={(v) => updateField("responsiveness", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.problemSolving}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.problemSolvingHint}</p>
                      <ScorePills
                        min={1} max={5}
                        allowNA
                        value={form.problemSolving}
                        onChange={(v) => updateField("problemSolving", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.personalTouch}</Label>
                      <p className="mt-2 text-xs text-stone-500">{t.personalTouchHint}</p>
                      <ScorePills
                        min={1} max={5}
                        value={form.personalTouch}
                        onChange={(v) => updateField("personalTouch", v)}
                      />
                    </div>
                  </div>

                  <div>
                    <Textarea
                      value={form.stayNotes}
                      onChange={(e) => updateField("stayNotes", e.target.value)}
                      placeholder={t.stayNotesPlaceholder}
                    />
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
                    <ScorePills
                      min={1} max={5}
                      value={form.propertyRating}
                      onChange={(v) => updateField("propertyRating", v)}
                    />
                  </div>

                  <div>
                    <Label>{t.amenitiesLabel}</Label>
                    <Textarea
                      value={form.amenities}
                      onChange={(e) => updateField("amenities", e.target.value)}
                      placeholder={t.amenitiesPlaceholder}
                    />
                  </div>

                  <div>
                    <Label>{t.propertyNotesLabel}</Label>
                    <Textarea
                      value={form.propertyNotes}
                      onChange={(e) => updateField("propertyNotes", e.target.value)}
                      placeholder={t.propertyNotesPlaceholder}
                    />
                  </div>
                </Section>
              </div>
            )}
          </section>

          {/* TripAdvisor — after optional sections */}
          <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.28em] text-stone-400">Review</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800">{t.reviewTitle}</h2>
            <p className="mt-2 text-sm text-stone-500">{t.reviewSubtitle}</p>
            <a
              href="https://www.tripadvisor.com/UserReviewEdit-g297476-d17750092-Two_Travel-Cartagena_Cartagena_District_Bolivar_Department.html"
              target="_blank" rel="noreferrer"
              className="mt-4 inline-block rounded-full bg-stone-800 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {t.reviewButton}
            </a>
          </section>

          <div className="sticky bottom-4 z-20">
            <div className="rounded-[24px] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    {t.readySubmit}
                  </p>
                  <p className="text-xs text-stone-500">
                    {t.readySubmitSubtitle}
                  </p>
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
      </div>
    </div>
  );
}
function UnifiedDashboard() {
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1Tyv5cPTN0MjxezyWRjo-XuIRqOgaPwP-z1heZfgGiuQ/edit#gid=0";

  const [tab, setTab] = useState("kpis");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [conciergeFilter, setConciergeFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [kickoffs, setKickoffs] = useState([]);
  const [kLoading, setKLoading] = useState(true);
  // KPI filters
  const [kpiPeriod, setKpiPeriod]       = useState("all");
  const [kpiConcierge, setKpiConcierge] = useState("all");

  const FEEDBACK_SHEET_ID = "1Tyv5cPTN0MjxezyWRjo-XuIRqOgaPwP-z1heZfgGiuQ";

  useEffect(() => {
    const load = async () => {
      // Try 1: opensheet.elk.sh (JSON, fast)
      // Try 2: direct CSV export (more reliable, needs sheet to be public)
      const sources = [
        `https://opensheet.elk.sh/${FEEDBACK_SHEET_ID}/feedback`,
        `https://opensheet.elk.sh/${FEEDBACK_SHEET_ID}/Feedback`,
        `https://docs.google.com/spreadsheets/d/${FEEDBACK_SHEET_ID}/export?format=csv&sheet=feedback&t=${Date.now()}`,
      ];

      for (const src of sources) {
        try {
          const res = await fetch(src);
          if (!res.ok) continue;

          const contentType = res.headers.get("content-type") || "";
          let data = [];

          if (contentType.includes("json")) {
            data = await res.json();
            if (!Array.isArray(data)) data = [];
          } else {
            // CSV — parse manually
            const text = await res.text();
            if (!text || text.trim().startsWith("<!")) continue; // HTML error page
            const lines = text.trim().split("\n");
            if (lines.length < 2) continue;
            const headers = lines[0].split(",").map((h) =>
              h.trim().replace(/^"|"$/g, "").toLowerCase()
            );
            data = lines.slice(1).map((line) => {
              const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
              const obj = {};
              headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
              return obj;
            });
          }

          if (data.length > 0) {
            setRows(data);
            break;
          }
        } catch (err) {
          console.warn("Dashboard fetch attempt failed:", src, err.message);
        }
      }
      setLoading(false);
    };

    load();
  }, []);

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
    feedback_submitted: { label: "Feedback enviado", color: "#7c3aed" },
    done: { label: "Completado", color: "#16a34a" },
  };
  const STATUS_KEYS = ["new", "client_submitted", "concierge_editing", "feedback_submitted", "done"];

  const BarChartCard = ({ title, data }) => {
    const max = Math.max(...data.map((d) => d.value), 1);

    return (
      <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold">{title}</p>

        <div className="mt-4 space-y-3">
          {data.length ? (
            data.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="h-3 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-stone-800"
                    style={{ width: `${(item.value / max) * 100}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-stone-500">Sin datos.</p>
          )}
        </div>
      </div>
    );
  };

  // ── Gestión panel computed values ──────────────────────────────────
  const kTotal = kickoffs.length;
  const kActivos = kickoffs.filter((k) => k.status !== "done").length;
  const kScores = kickoffs
    .map((k) => Number(k.overallExperience))
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
    if (kpiConcierge !== "all" && k.assignedConcierge !== kpiConcierge && k.assignedConciergeName !== kpiConcierge) return false;
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
    return cart.filter(it => it.confirmed !== false).reduce((s, it) => {
      const p = Number(it.priceUsd || it.price_tier_1 || it.price || 0);
      return s + (isNaN(p) ? 0 : p);
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
  const kpiRated     = kpiFiltered.filter(k => Number(k.conciergeRating) > 0);
  const kpiAvgRating = kpiRated.length ? (kpiRated.reduce((s, k) => s + Number(k.conciergeRating), 0) / kpiRated.length).toFixed(1) : "—";
  const kpiByConcierge = {};
  kpiFiltered.forEach((k, i) => {
    const name = k.assignedConcierge || k.assignedConciergeName || "Sin asignar";
    if (!kpiByConcierge[name]) kpiByConcierge[name] = { clients: 0, revenue: 0, svcs: 0, ratings: [] };
    kpiByConcierge[name].clients++;
    kpiByConcierge[name].revenue += kpiRevenues[i];
    kpiByConcierge[name].svcs    += kpiServiceCounts[i];
    if (Number(k.conciergeRating) > 0) kpiByConcierge[name].ratings.push(Number(k.conciergeRating));
  });
  const kpiConciergeRows = Object.entries(kpiByConcierge)
    .map(([name, d]) => ({
      name,
      clients:   d.clients,
      revenue:   d.revenue,
      avgSvcs:   d.clients ? (d.svcs / d.clients).toFixed(1) : "0",
      avgRating: d.ratings.length ? (d.ratings.reduce((a,b)=>a+b,0)/d.ratings.length).toFixed(1) : "—",
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const kpiStatusMap = {};
  kpiFiltered.forEach(k => { const s = k.status || "new"; kpiStatusMap[s] = (kpiStatusMap[s]||0)+1; });
  const fmtRev = v => v >= 10000 ? "$" + Math.round(v).toLocaleString("es-CO") + " COP" : "$" + v.toLocaleString("en-US",{maximumFractionDigits:0}) + " USD";
  const KpiCard = ({ label, value, sub, color }) => {
    const cl = color || "text-stone-800";
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-5">
        <div className={"text-2xl font-bold " + cl}>{value}</div>
        <div className="text-xs text-stone-500 mt-1">{label}</div>
        {sub && <div className="text-[10px] text-stone-400 mt-0.5">{sub}</div>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* ── Header ── */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <a href="/?mode=concierge" className="text-stone-400 hover:text-stone-700 text-sm">← Panel</a>
          <span className="text-stone-300">|</span>
          <h1 className="text-base font-semibold text-stone-800">Two Travel · Dashboard</h1>
        </div>
        <a href={sheetUrl} target="_blank" rel="noreferrer"
          className="inline-block rounded-full bg-stone-800 px-5 py-2 text-xs text-white font-semibold">
          Abrir Google Sheet
        </a>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* ── Tab buttons ── */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {[
            { id: "kpis",     label: "📊 KPIs" },
            { id: "gestion",  label: "⚙️ Gestión" },
            { id: "feedback", label: "💬 Feedback" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={"rounded-full px-6 py-2.5 text-sm font-semibold transition-colors " + (
                tab === id
                  ? "bg-stone-800 text-white"
                  : "bg-white border border-stone-200 text-stone-600 hover:bg-stone-100"
              )}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ KPIs tab ══ */}
        {tab === "kpis" && (
          <>
            {kLoading ? (
              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm text-sm text-stone-500">Cargando KPIs…</div>
            ) : (
              <>
                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-2 items-center">
                  {["all","month","week"].map(p => (
                    <button key={p} onClick={() => setKpiPeriod(p)}
                      className={"px-3 py-1 text-xs rounded-lg border transition " + (kpiPeriod===p ? "bg-stone-800 text-white border-stone-800" : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50")}>
                      {p==="all"?"Todo tiempo":p==="month"?"Último mes":"Última semana"}
                    </button>
                  ))}
                  <select value={kpiConcierge} onChange={e=>setKpiConcierge(e.target.value)}
                    className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white">
                    <option value="all">Todos los concierges</option>
                    {CONCIERGE_NAMES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Main KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                  <KpiCard label="Clientes en período" value={kpiFiltered.length} />
                  <KpiCard label="Revenue total" value={fmtRev(kpiTotalRev)} color="text-emerald-700"/>
                  <KpiCard label="ARPC" value={fmtRev(kpiArpc)} sub="avg revenue/cliente"/>
                  <KpiCard label="Servicios promedio" value={kpiAvgSvcs.toFixed(1)} sub="por cliente"/>
                  <KpiCard label="Rating ⭐" value={kpiAvgRating} sub={kpiRated.length + " trips calificados"} color="text-amber-600"/>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                  <KpiCard label="Clientes con 2+ servicios" value={kpiPct2plus.toFixed(0) + "%"} sub={kpiFiltered.filter((_,i)=>kpiServiceCounts[i]>=2).length + " de " + kpiFiltered.length}/>
                  <KpiCard label="Sin servicios" value={kpiFiltered.filter((_,i)=>kpiServiceCounts[i]===0).length} sub="sin items confirmados"/>
                  <KpiCard label="Total servicios" value={kpiServiceCounts.reduce((a,b)=>a+b,0)} sub="en todos los kickoffs filtrados"/>
                </div>

                {/* Status breakdown */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-4">
                  <h2 className="text-sm font-semibold text-stone-700 mb-3">Estado de clientes</h2>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(kpiStatusMap).map(([s,cnt]) => (
                      <div key={s} className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-stone-500">{s}</span>
                        <span className="text-sm font-bold text-stone-800">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Per-concierge table */}
                {kpiConciergeRows.length > 0 && (
                  <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                    <div className="px-5 py-3 border-b border-stone-100">
                      <h2 className="text-sm font-semibold text-stone-700">Breakdown por concierge</h2>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-stone-50 text-[11px] text-stone-400 uppercase tracking-wide">
                          <tr>
                            <th className="px-5 py-2 text-left font-medium">Concierge</th>
                            <th className="px-5 py-2 text-center font-medium">Clientes</th>
                            <th className="px-5 py-2 text-right font-medium">Revenue</th>
                            <th className="px-5 py-2 text-center font-medium">Svcs/cliente</th>
                            <th className="px-5 py-2 text-center font-medium">Rating ⭐</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                          {kpiConciergeRows.map(row => (
                            <tr key={row.name} className="hover:bg-stone-50">
                              <td className="px-5 py-3 font-medium text-stone-800">{row.name}</td>
                              <td className="px-5 py-3 text-center text-stone-600">{row.clients}</td>
                              <td className="px-5 py-3 text-right font-semibold text-emerald-700">{fmtRev(row.revenue)}</td>
                              <td className="px-5 py-3 text-center text-stone-600">{row.avgSvcs}</td>
                              <td className="px-5 py-3 text-center text-amber-500 font-semibold">{row.avgRating}</td>
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
                        <p><span className="text-stone-500">Score:</span> <span className="font-semibold">{latest.overallExperience || "—"}</span></p>
                        <p><span className="text-stone-500">Idioma:</span> <span className="font-semibold">{latest.language || "—"}</span></p>
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
  "https://script.google.com/macros/s/AKfycbwZJudfRGEZm9hx_WiyOif4Nu3RL9NecJTP7gIrFqyHukU146-sdaLqAafZz0gdR7KVvw/exec";

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
        body: JSON.stringify({ action: "updateSoporte", payload: { id: caso.id, status: newStatus } }),
      });
      setCases(prev => prev.map(c => c.id === caso.id ? { ...c, status: newStatus } : c));
      if (selected?.id === caso.id) setSelected(s => ({ ...s, status: newStatus }));
    } catch {}
    setUpdatingId(null);
  };

  const filtered = filterStatus === "todos"
    ? cases
    : cases.filter(c => (c.status || "abierto") === filterStatus);

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
  "Nataly Cruz","Giulia Lorini Serrato","Aileen Servin",
];

/* ════════════════════════════════════════════════════════
   TASK TRACKER  (?mode=tasks)
   Tasks live in a "Tasks" sheet tab, managed via GAS.
════════════════════════════════════════════════════════ */
const TASK_API = "https://script.google.com/macros/s/AKfycbwZJudfRGEZm9hx_WiyOif4Nu3RL9NecJTP7gIrFqyHukU146-sdaLqAafZz0gdR7KVvw/exec";

const TASK_STATUS = {
  pending:   { label: "Pendiente",   cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completado",  cls: "bg-emerald-100 text-emerald-700" },
  late:      { label: "Vencida",     cls: "bg-red-100 text-red-700" },
};

function TaskTracker() {
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [filterUser, setFilterUser] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({ taskName:"", assignedTo:"", dueDate:"", notes:"" });

  const setF = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch(TASK_API, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "listTasks" }),
      });
      const text = await res.text();
      let json = {};
      try { json = JSON.parse(text); } catch { console.error("listTasks parse error:", text?.slice(0,300)); }
      console.log("listTasks response:", json);
      // Auto-compute Late status client-side
      const now = new Date(); now.setHours(0,0,0,0);
      const tasks = (Array.isArray(json.data) ? json.data : []).map(t => ({
        ...t,
        status: t.status === "completed" ? "completed"
              : (t.dueDate && new Date(t.dueDate) < now) ? "late"
              : t.status || "pending",
      }));
      setTasks(tasks);
    } catch(err) { console.error("load tasks error:", err); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveTask = async () => {
    if (!form.taskName.trim() || !form.assignedTo || !form.dueDate) return alert("Llena nombre, asignado y fecha.");
    setSaving(true);
    try {
      const res = await fetch(TASK_API, {
        method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({ action:"saveTask", payload:{ ...form, status:"pending", createdAt: new Date().toISOString() } }),
      });
      const text = await res.text();
      let json = {};
      try { json = JSON.parse(text); } catch {}
      console.log("saveTask response:", json);
      if (json?.ok === false) { alert("Error GAS: " + (json.error || "unknown")); setSaving(false); return; }
      setForm({ taskName:"", assignedTo:"", dueDate:"", notes:"" });
      setShowForm(false);
      await load();
    } catch(err) { alert("Error al guardar: " + err.message); }
    setSaving(false);
  };

  const updateStatus = async (id, status) => {
    try {
      await fetch(TASK_API, {
        method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"},
        body: JSON.stringify({ action:"updateTask", payload:{ id, status, completedAt: status==="completed"?new Date().toISOString():"" } }),
      });
      setTasks(prev => prev.map(t => t.id===id ? {...t, status} : t));
    } catch {}
  };

  const now = new Date(); now.setHours(0,0,0,0);

  const filtered = tasks.filter(t => {
    if (filterUser !== "all" && t.assignedTo !== filterUser) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    return true;
  });

  // Leaderboard — pending + late tasks per user
  const leaderboard = {};
  tasks.forEach(t => {
    if (t.status === "completed") return;
    const u = t.assignedTo || "?";
    leaderboard[u] = (leaderboard[u]||0)+1;
  });
  const lbRows = Object.entries(leaderboard).sort((a,b)=>b[1]-a[1]);

  const allUsers = [...new Set(tasks.map(t=>t.assignedTo).filter(Boolean))];

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <a href="/?mode=concierge" className="text-stone-400 hover:text-stone-700 text-sm">← Panel</a>
          <span className="text-stone-300">|</span>
          <h1 className="text-base font-semibold text-stone-800">✅ Task Tracker</h1>
        </div>
        <button onClick={()=>setShowForm(v=>!v)}
          className="px-3 py-1.5 text-xs bg-stone-800 text-white rounded-lg hover:opacity-90 font-medium">
          + Nueva tarea
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── New task form ── */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-stone-700">Nueva tarea</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] text-stone-500">Nombre de la tarea *</label>
                <input value={form.taskName} onChange={e=>setF("taskName",e.target.value)}
                  className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Confirmar reserva Celele para Martínez"/>
              </div>
              <div>
                <label className="text-[11px] text-stone-500">Asignado a *</label>
                <select value={form.assignedTo} onChange={e=>setF("assignedTo",e.target.value)}
                  className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white">
                  <option value="">Seleccionar…</option>
                  {CONCIERGE_NAMES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-stone-500">Fecha límite *</label>
                <input type="date" value={form.dueDate} onChange={e=>setF("dueDate",e.target.value)}
                  className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm"/>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] text-stone-500">Notas</label>
                <textarea value={form.notes} onChange={e=>setF("notes",e.target.value)} rows={2}
                  className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none"/>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveTask} disabled={saving}
                className="px-4 py-2 text-xs bg-stone-800 text-white rounded-lg hover:opacity-90 disabled:opacity-50">
                {saving?"Guardando…":"Guardar tarea"}
              </button>
              <button onClick={()=>setShowForm(false)} className="px-4 py-2 text-xs border border-stone-200 rounded-lg text-stone-500 hover:bg-stone-50">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ── Task list ── */}
          <div className="lg:col-span-2 space-y-3">
            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              <select value={filterUser} onChange={e=>setFilterUser(e.target.value)}
                className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white">
                <option value="all">Todos</option>
                {allUsers.map(u=><option key={u} value={u}>{u.split(" ")[0]}</option>)}
              </select>
              {["all","pending","late","completed"].map(s=>(
                <button key={s} onClick={()=>setFilterStatus(s)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition ${filterStatus===s?"bg-stone-800 text-white border-stone-800":"bg-white border-stone-200 text-stone-500 hover:bg-stone-50"}`}>
                  {s==="all"?"Todas":s==="pending"?"Pendientes":s==="late"?"Vencidas":"Completadas"}
                </button>
              ))}
              <button onClick={load} className="ml-auto text-xs text-stone-400 hover:text-stone-700">↻</button>
            </div>

            {loading ? (
              <div className="text-center py-10 text-stone-400 text-sm">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-stone-400 text-sm">
                No hay tareas con estos filtros.
              </div>
            ) : (
              filtered.map(t => {
                const st = TASK_STATUS[t.status] || TASK_STATUS.pending;
                const due = t.dueDate ? new Date(t.dueDate) : null;
                const daysLeft = due ? Math.round((due - now)/86400000) : null;
                return (
                  <div key={t.id} className={`bg-white rounded-xl border p-4 ${t.status==="late"?"border-red-200":"border-stone-200"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                          {daysLeft !== null && t.status !== "completed" && (
                            <span className={`text-[10px] ${daysLeft < 0?"text-red-500":daysLeft<=2?"text-amber-600":"text-stone-400"}`}>
                              {daysLeft < 0 ? `Venció hace ${Math.abs(daysLeft)}d` : daysLeft===0?"Vence hoy":`${daysLeft}d restantes`}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-stone-800">{t.taskName}</p>
                        <p className="text-xs text-stone-400 mt-0.5">
                          👤 {t.assignedTo} · 📅 {t.dueDate || "—"}
                        </p>
                        {t.notes && <p className="text-xs text-stone-500 mt-1">{t.notes}</p>}
                      </div>
                      {t.status !== "completed" && (
                        <button onClick={()=>updateStatus(t.id,"completed")}
                          className="flex-shrink-0 px-2.5 py-1 text-xs border border-emerald-200 text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition">
                          ✓ Completar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Leaderboard (pending tasks) ── */}
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Tareas pendientes por persona</h2>
              {lbRows.length === 0 ? (
                <p className="text-xs text-stone-400">Sin tareas pendientes 🎉</p>
              ) : (
                lbRows.map(([user, cnt], i) => (
                  <div key={user} className={`flex items-center justify-between py-2 ${i<lbRows.length-1?"border-b border-stone-50":""}`}>
                    <span className={`text-xs font-medium ${i===0&&cnt>2?"text-red-600":"text-stone-700"}`}>
                      {i===0&&cnt>2?"🔴 ":""}{user.split(" ")[0]}
                    </span>
                    <span className={`text-sm font-bold ${i===0&&cnt>2?"text-red-600":"text-stone-700"}`}>{cnt}</span>
                  </div>
                ))
              )}
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Resumen</h2>
              {[
                { label:"Total",      value: tasks.length },
                { label:"Pendientes", value: tasks.filter(t=>t.status==="pending").length, color:"text-amber-600" },
                { label:"Vencidas",   value: tasks.filter(t=>t.status==="late").length,    color:"text-red-600" },
                { label:"Completadas",value: tasks.filter(t=>t.status==="completed").length, color:"text-emerald-600" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-stone-50 last:border-0">
                  <span className="text-xs text-stone-500">{r.label}</span>
                  <span className={`text-sm font-bold ${r.color||"text-stone-700"}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DRINKS CATALOG — client-facing drink selection page
   ============================================================ */
const DRINK_CATEGORIES = [
  {
    id: "spirits", label: "🥃 Spirits / Licores",
    items: [
      { name: "Ron Medellín 8 años",    qty: "", note: "" },
      { name: "Ron Dictador 12",         qty: "", note: "" },
      { name: "Aguardiente Antioqueño", qty: "", note: "" },
      { name: "Tequila Patrón Silver",  qty: "", note: "" },
      { name: "Vodka Grey Goose",        qty: "", note: "" },
      { name: "Whisky Johnnie Walker Black", qty: "", note: "" },
      { name: "Gin Hendricks",           qty: "", note: "" },
      { name: "Champagne Moët & Chandon",qty: "", note: "" },
    ],
  },
  {
    id: "beer", label: "🍺 Cerveza / Beer",
    items: [
      { name: "Águila",       qty: "", note: "" },
      { name: "Club Colombia",qty: "", note: "" },
      { name: "Corona",       qty: "", note: "" },
      { name: "Heineken",     qty: "", note: "" },
      { name: "Poker",        qty: "", note: "" },
    ],
  },
  {
    id: "wine", label: "🍷 Vino / Wine",
    items: [
      { name: "Vino tinto (botella)",   qty: "", note: "" },
      { name: "Vino blanco (botella)",  qty: "", note: "" },
      { name: "Vino rosado (botella)",  qty: "", note: "" },
      { name: "Espumante / Prosecco",   qty: "", note: "" },
    ],
  },
  {
    id: "mixers", label: "🥤 Mezcladores / Mixers",
    items: [
      { name: "Coca-Cola",       qty: "", note: "" },
      { name: "Agua tónica",     qty: "", note: "" },
      { name: "Ginger ale",      qty: "", note: "" },
      { name: "Jugo de naranja", qty: "", note: "" },
      { name: "Agua con gas",    qty: "", note: "" },
      { name: "Agua sin gas",    qty: "", note: "" },
      { name: "Red Bull",        qty: "", note: "" },
    ],
  },
  {
    id: "snacks", label: "🍿 Snacks",
    items: [
      { name: "Papas / Chips",     qty: "", note: "" },
      { name: "Maní / Peanuts",    qty: "", note: "" },
      { name: "Tabla de quesos",   qty: "", note: "" },
      { name: "Fruta picada",      qty: "", note: "" },
      { name: "Crudités",          qty: "", note: "" },
    ],
  },
];

function DrinksCatalog() {
  const params   = new URLSearchParams(window.location.search);
  const kickoffId= params.get("kickoffId") || "";
  const [items,  setItems]   = React.useState(() =>
    DRINK_CATEGORIES.map(cat => ({
      ...cat,
      items: cat.items.map(it => ({ ...it })),
    }))
  );
  const [extra,    setExtra]    = React.useState("");
  const [sent,     setSent]     = React.useState(false);
  const [sending,  setSending]  = React.useState(false);
  const [guestName,setGuestName]= React.useState("");

  const patchItem = (catIdx, itemIdx, patch) =>
    setItems(prev => prev.map((cat, ci) =>
      ci !== catIdx ? cat : {
        ...cat,
        items: cat.items.map((it, ii) => ii !== itemIdx ? it : { ...it, ...patch }),
      }
    ));

  const hasSelection = items.some(cat => cat.items.some(it => Number(it.qty) > 0));

  const handleSend = async () => {
    if (!hasSelection) return;
    setSending(true);
    const lines = [];
    items.forEach(cat => {
      const selected = cat.items.filter(it => Number(it.qty) > 0);
      if (!selected.length) return;
      lines.push(`\n*${cat.label}*`);
      selected.forEach(it => lines.push(`  • ${it.name}: *${it.qty}* ${it.note ? `— ${it.note}` : ""}`));
    });
    if (extra) lines.push(`\n📝 Extra: ${extra}`);
    const text = `🍹 *Drink List* ${guestName ? `(${guestName})` : ""} · kickoff: ${kickoffId}\n${lines.join("\n")}`;
    try {
      // Send to Slack via GAS proxy — same endpoint as billing
      await fetch("https://script.google.com/macros/s/AKfycbwZJudfRGEZm9hx_WiyOif4Nu3RL9NecJTP7gIrFqyHukU146-sdaLqAafZz0gdR7KVvw/exec", {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "sendSlackMessage", payload: { text, channelId: "C094NE421NV", slackToken: import.meta.env.VITE_SLACK_BOT_TOKEN || "" } }),
      });
      setSent(true);
    } catch { setSent(true); } // show success regardless
    setSending(false);
  };

  if (sent) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-center px-6 gap-6">
      <div className="text-5xl">🥂</div>
      <h1 className="text-2xl font-semibold text-white">¡Lista recibida!</h1>
      <p className="text-neutral-400 text-sm max-w-xs">Tu concierge se encargará de tener todo listo para tu llegada.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Header */}
      <div className="bg-neutral-950 text-white px-6 py-5">
        <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">Two Travel</p>
        <h1 className="text-xl font-semibold">🍹 Lista de Bebidas</h1>
        <p className="text-sm text-neutral-400 mt-1">Selecciona las bebidas y cantidades para tu estadía.</p>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5 space-y-5">
        {/* Guest name */}
        <input
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
          placeholder="Tu nombre (opcional)"
          className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
        />

        {items.map((cat, ci) => (
          <div key={cat.id} className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-neutral-50 border-b">
              <p className="text-sm font-semibold text-neutral-800">{cat.label}</p>
            </div>
            <div className="divide-y divide-neutral-100">
              {cat.items.map((it, ii) => (
                <div key={ii} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm text-neutral-800">{it.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button type="button"
                      onClick={() => patchItem(ci, ii, { qty: String(Math.max(0, Number(it.qty||0)-1)||"") })}
                      className="w-7 h-7 rounded-full border border-neutral-300 text-neutral-600 flex items-center justify-center text-sm hover:bg-neutral-100">−</button>
                    <span className="w-8 text-center text-sm font-medium text-neutral-900">{it.qty || 0}</span>
                    <button type="button"
                      onClick={() => patchItem(ci, ii, { qty: String(Number(it.qty||0)+1) })}
                      className="w-7 h-7 rounded-full border border-neutral-300 text-neutral-600 flex items-center justify-center text-sm hover:bg-neutral-100">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Notes */}
        <textarea
          value={extra}
          onChange={e => setExtra(e.target.value)}
          placeholder="Algo más? Marcas específicas, alergias, preferencias…"
          rows={3}
          className="w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 resize-none"
        />
      </div>

      {/* Fixed footer button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-3 flex justify-center">
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !hasSelection}
          className="w-full max-w-xl py-3 rounded-xl bg-neutral-950 text-white font-semibold text-sm disabled:opacity-40 hover:bg-neutral-800"
        >
          {sending ? "Enviando…" : "✅ Enviar lista al concierge"}
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
  { code: "BOG",  label: "🇨🇴 Bogotá" },
];

function WelcomeCatalogPage({ mode }) {
  const [name,    setName]    = useState("");
  const [city,    setCity]    = useState("");
  const [contact, setContact] = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const handleStart = async (e) => {
    e.preventDefault();
    if (!name.trim())  { setError("Por favor ingresa tu nombre."); return; }
    if (!city)         { setError("Por favor selecciona tu destino."); return; }
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
      if (!result?.id) throw new Error("No se pudo crear el cliente");
      const url = new URL(window.location.href);
      url.searchParams.set("kickoffId", result.id);
      url.searchParams.set("mode", "catalog");
      window.location.href = url.toString();
    } catch (err) {
      setError("Error al guardar. Intenta de nuevo.");
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="text-white text-3xl font-bold tracking-tight mb-1">TWO TRAVEL</div>
        <div className="text-neutral-400 text-sm">Concierge Experience</div>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-xl font-bold text-neutral-900 mb-1">Bienvenido 👋</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Dinos quién eres y a dónde vas, y te mostramos el catálogo personalizado.
        </p>

        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wide">
              Tu nombre *
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: María García"
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wide">
              Destino *
            </label>
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="w-full border border-neutral-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
              required
            >
              <option value="">Selecciona tu ciudad…</option>
              {CITY_OPTIONS.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1 uppercase tracking-wide">
              WhatsApp (opcional)
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
            {saving ? "Creando tu catálogo…" : "Ver mi catálogo →"}
          </button>
        </form>

        <p className="text-center text-[10px] text-neutral-400 mt-5">
          Two Travel · twotravelvip.com
        </p>
      </div>
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const kickoffId = params.get("kickoffId") || "";

  if (mode === "dashboard" || mode === "kpi") return <UnifiedDashboard />;
  if (mode === "concierge")          return <ConciergePanel />;
  if (mode === "soporte")            return <SoportePage />;
  if (mode === "soporte-dashboard")  return <SoporteDashboard />;
  if (mode === "tasks")              return <TaskTracker />;
  if (mode === "catalog" || mode === "questionnaire") {
    // If no kickoffId → show welcome/intake page first
    if (!kickoffId) return <WelcomeCatalogPage mode={mode} />;
    return <TwoTravelCatalog />;
  }
  if (mode === "drinks")             return <DrinksCatalog />;
  if (mode === "itinerary")          return <ItineraryPrintView />;

  return <FeedbackForm kickoffId={params.get("kickoffId") || ""} />;
}

export default App;