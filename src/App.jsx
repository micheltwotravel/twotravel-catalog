import React, { useMemo, useState, useEffect } from "react";
import ConciergePanel from "./ConciergePanel";
import TwoTravelCatalog from "./TwoTravelCatalog";
import ItineraryPrintView from "./ItineraryPrintView";
import { updateKickoffInSheet } from "./sheetServices";

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
      "1 = Something went wrong · 5–6 = Could be better · 10 = Perfect experience",
    overallReasonLabel: "What made you give this score?",
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
    moreFeedbackToggleShow: "Click here to share a little more.",
    moreFeedbackToggleHide: "Click here to hide a little more.",

    beforeArrivalTitle: "Before You Arrived",
    beforeArrivalSubtitle: "Planning & Logistics",
    organization: "Organization",
    organizationHint:
      "How well were your plans and itinerary handled and communicated?",
    availability: "Availability",
    availabilityHint:
      "Was your concierge responsive during the lead-up?",
    preparedFactor: "Prepared Factor",
    preparedFactorHint:
      "Did you feel clear and prepared before arrival?",

    teamPropertyTitle: "The Team & Property",
    teamPropertySubtitle: "Accommodation & Stay",
    propertyRatingLabel:
      "How would you rate the property and accommodations?",
    propertyNotesLabel: "Anything else we should know about the property?",
    propertyNotesPlaceholder: "Share anything worth noting.",

    venueTypeLabel: "Venue Type",
    venueTypeHint: "What type of place did you stay in?",
    amenitiesLabel: "Amenities",
    amenitiesPlaceholder: "What did you like or miss?",

    cancellationPolicyLabel: "Cancellation Policy",
    cancellationPolicyHint: "Was it clear and easy to understand?",
    checkInExperienceLabel: "Check-in Experience",
    checkInExperienceHint: "How smooth was your arrival?",
    checkOutExperienceLabel: "Check-out Experience",
    checkOutExperienceHint: "How smooth was your departure?",

    duringStayTitle: "During Your Stay",
    duringStaySubtitle: "Execution & Service",
    speed: "Speed",
    speedHint:
      "How quick were the responses to your real-time requests?",
    problemSolving: "Problem Solving",
    problemSolvingHint:
      "If any issues popped up, how fast were they handled?",
    service: "The Service",
    serviceHint:
      "How personalized did the experience feel to your group?",
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
      destinations: ["CDMX", "Tulum", "Cartagena", "Medellín"],
      concierges: ["Nataly", "Caro", "Alia", "Dani", "Aileen", "Giulia"],
      occasions: [
        "Family",
        "Friends Trip",
        "Birthday",
        "Anniversary",
        "Bachelor/Bachelorette",
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
      "1 = Algo salió mal · 5–6 = Podría ser mejor · 10 = Experiencia perfecta",
    overallReasonLabel: "¿Qué te hizo dar esta calificación?",
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
    moreFeedbackToggleShow: "Haz clic aquí para compartir un poco más.",
    moreFeedbackToggleHide: "Haz clic aquí para ocultarlo.",

    beforeArrivalTitle: "Antes de llegar",
    beforeArrivalSubtitle: "Planeación y logística",
    organization: "Organización",
    organizationHint:
      "¿Qué tan bien se manejaron y comunicaron tus planes e itinerario?",
    availability: "Disponibilidad",
    availabilityHint:
      "¿Tu concierge fue receptivo antes de tu llegada?",
    preparedFactor: "Nivel de preparación",
    preparedFactorHint:
      "¿Te sentiste claro/a y preparado/a antes de llegar?",

    teamPropertyTitle: "El equipo y la propiedad",
    teamPropertySubtitle: "Alojamiento y estadía",
    propertyRatingLabel:
      "¿Cómo calificarías la propiedad y el alojamiento?",
    propertyNotesLabel:
      "¿Hay algo más que debamos saber sobre la propiedad?",
    propertyNotesPlaceholder: "Comparte cualquier detalle importante.",

    venueTypeLabel: "Tipo de venue",
    venueTypeHint: "¿En qué tipo de lugar te hospedaste?",
    amenitiesLabel: "Amenidades",
    amenitiesPlaceholder: "¿Qué te gustó o qué hizo falta?",

    cancellationPolicyLabel: "Política de cancelación",
    cancellationPolicyHint: "¿Fue clara y fácil de entender?",
    checkInExperienceLabel: "Experiencia de check-in",
    checkInExperienceHint: "¿Qué tan fluida fue tu llegada?",
    checkOutExperienceLabel: "Experiencia de check-out",
    checkOutExperienceHint: "¿Qué tan fluida fue tu salida?",

    duringStayTitle: "Durante tu estadía",
    duringStaySubtitle: "Ejecución y servicio",
    speed: "Rapidez",
    speedHint:
      "¿Qué tan rápidas fueron las respuestas a tus solicitudes en tiempo real?",
    problemSolving: "Resolución de problemas",
    problemSolvingHint:
      "Si surgió algún problema, ¿qué tan rápido se resolvió?",
    service: "El servicio",
    serviceHint:
      "¿Qué tan personalizada se sintió la experiencia para tu grupo?",
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
      destinations: ["CDMX", "Tulum", "Cartagena", "Medellín"],
      concierges: ["Nataly", "Caro", "Alia", "Dani", "Aileen", "Giulia"],
      occasions: [
        "Family",
        "Friends Trip",
        "Cumpleaños",
        "Aniversario",
        "Despedida de soltero/a",
        "¡Porque sí!",
      ],
      venueTypes: ["Villa", "Hotel", "Yate", "Apartamento", "Otro"],
      yesNo: ["Sí", "No"],
    },
  },
};

function FeedbackForm({ kickoffId }) {
  const params = new URLSearchParams(window.location.search);
  const guestName = params.get("guestName") || "";
  const tripName = params.get("tripName") || "";
  const langParam = params.get("lang");

  const initialLang =
    langParam === "es" || langParam === "en" ? langParam : "en";

  const [lang, setLang] = useState(initialLang);
  const t = translations[lang];

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMoreFeedback, setShowMoreFeedback] = useState(false);

  const [form, setForm] = useState({
  destination: "",
  concierge: "",
  occasion: "",

  overallExperience: "",
  overallReason: "",

  oneThing: "",

  organization: "",
  availability: "",
  preparedFactor: "",

  propertyRating: "",
  propertyNotes: "",

  speed: "",
  problemSolving: "",
  service: "",
  stayNotes: "",

  venueType: "",
  amenities: "",
  cancellationPolicy: "",
  checkInExperience: "",
  checkOutExperience: "",
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
      updateKickoffInSheet(kickoffId, { status: "feedback_submitted" }).catch(
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

  const Section = ({ eyebrow, title, subtitle, children }) => (
    <section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
      {eyebrow ? (
        <p className="text-[10px] uppercase tracking-[0.28em] text-stone-400">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800">
        {title}
      </h2>

      {subtitle ? (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          {subtitle}
        </p>
      ) : null}

      <div className="mt-6 space-y-6">{children}</div>
    </section>
  );

  const Label = ({ children }) => (
    <label className="block text-sm font-medium text-stone-700">
      {children}
    </label>
  );

  const Textarea = ({ value, onChange, placeholder, rows = 5 }) => (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className="mt-3 w-full rounded-[18px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-800 placeholder:text-stone-400 outline-none transition focus:border-stone-400 focus:bg-white"
    />
  );

  const ScorePills = ({
    value,
    onChange,
    min = 1,
    max = 10,
    allowNA = false,
  }) => {
    const values = Array.from({ length: max - min + 1 }, (_, i) =>
      String(i + min)
    );

    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {allowNA && (
          <button
            type="button"
            onClick={() => onChange("N/A")}
            className={`rounded-full px-4 py-2 text-sm transition ${
              value === "N/A"
                ? "bg-stone-800 text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            N/A
          </button>
        )}

        {values.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-11 min-w-11 rounded-full px-4 text-sm font-medium transition ${
              value === n
                ? "bg-stone-800 text-white"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    );
  };

  const ChoiceCards = ({ value, onChange, options }) => (
    <div className="mt-3 grid gap-3">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-[18px] border px-4 py-4 text-left text-sm transition ${
            value === option
              ? "border-stone-800 bg-stone-100 text-stone-900"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );

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
              <div>
                <Label>{t.destination}</Label>
                <ChoiceCards
                  value={form.destination}
                  onChange={(v) => updateField("destination", v)}
                  options={t.options.destinations}
                />
              </div>

              <div>
                <Label>{t.concierge}</Label>
                <ChoiceCards
                  value={form.concierge}
                  onChange={(v) => updateField("concierge", v)}
                  options={t.options.concierges}
                />
              </div>

              <div>
                <Label>{t.occasion}</Label>
                <ChoiceCards
                  value={form.occasion}
                  onChange={(v) => updateField("occasion", v)}
                  options={t.options.occasions}
                />
              </div>
            </div>
          </Section>

          <Section
            eyebrow="02"
            title={t.bigPictureTitle}
            subtitle={t.bigPictureSubtitle}
          >
            <div>
              <Label>{t.overallExperienceLabel}</Label>
              <p className="mt-2 text-xs text-stone-400">
                {t.overallExperienceHint}
              </p>
              <ScorePills
                value={form.overallExperience}
                onChange={(v) => updateField("overallExperience", v)}
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

          <section className="rounded-[28px] border border-stone-200 bg-white shadow-sm">
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
                <Section
                  eyebrow="04"
                  title={t.beforeArrivalTitle}
                  subtitle={t.beforeArrivalSubtitle}
                >
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div>
                      <Label>{t.organization}</Label>
                      <p className="mt-2 text-xs text-stone-400">
                        {t.organizationHint}
                      </p>
                      <ScorePills
                        value={form.organization}
                        onChange={(v) => updateField("organization", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.availability}</Label>
                      <p className="mt-2 text-xs text-stone-400">
                        {t.availabilityHint}
                      </p>
                      <ScorePills
                        value={form.availability}
                        onChange={(v) => updateField("availability", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.preparedFactor}</Label>
                      <p className="mt-2 text-xs text-stone-400">
                        {t.preparedFactorHint}
                      </p>
                      <ScorePills
                        value={form.preparedFactor}
                        onChange={(v) => updateField("preparedFactor", v)}
                      />
                    </div>
                  </div>
                </Section>

                <Section
                  eyebrow="05"
                  title={t.teamPropertyTitle}
                  subtitle={t.teamPropertySubtitle}
                >
                  <div>
                    <Label>{t.propertyRatingLabel}</Label>
                    <ScorePills
                      value={form.propertyRating}
                      onChange={(v) => updateField("propertyRating", v)}
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
                  <div>
  <Label>{t.venueTypeLabel}</Label>
  <p className="mt-2 text-xs text-stone-400">{t.venueTypeHint}</p>
  <ChoiceCards
    value={form.venueType}
    onChange={(v) => updateField("venueType", v)}
    options={t.options.venueTypes}
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

<div className="grid gap-6 lg:grid-cols-3">
  <div>
    <Label>{t.cancellationPolicyLabel}</Label>
    <p className="mt-2 text-xs text-stone-400">{t.cancellationPolicyHint}</p>
    <ScorePills
      value={form.cancellationPolicy}
      onChange={(v) => updateField("cancellationPolicy", v)}
    />
  </div>

  <div>
    <Label>{t.checkInExperienceLabel}</Label>
    <p className="mt-2 text-xs text-stone-400">{t.checkInExperienceHint}</p>
    <ScorePills
      value={form.checkInExperience}
      onChange={(v) => updateField("checkInExperience", v)}
    />
  </div>

  <div>
    <Label>{t.checkOutExperienceLabel}</Label>
    <p className="mt-2 text-xs text-stone-400">{t.checkOutExperienceHint}</p>
    <ScorePills
      value={form.checkOutExperience}
      onChange={(v) => updateField("checkOutExperience", v)}
    />
  </div>
</div>
                </Section>

                <Section
                  eyebrow="06"
                  title={t.duringStayTitle}
                  subtitle={t.duringStaySubtitle}
                >
                  <div className="grid gap-6 lg:grid-cols-3">
                    <div>
                      <Label>{t.speed}</Label>
                      <p className="mt-2 text-xs text-stone-400">
                        {t.speedHint}
                      </p>
                      <ScorePills
                        value={form.speed}
                        onChange={(v) => updateField("speed", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.problemSolving}</Label>
                      <p className="mt-2 text-xs text-stone-400">
                        {t.problemSolvingHint}
                      </p>
                      <ScorePills
                        allowNA
                        value={form.problemSolving}
                        onChange={(v) => updateField("problemSolving", v)}
                      />
                    </div>

                    <div>
                      <Label>{t.service}</Label>
                      <p className="mt-2 text-xs text-stone-400">
                        {t.serviceHint}
                      </p>
                      <ScorePills
                        value={form.service}
                        onChange={(v) => updateField("service", v)}
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
              </div>
            )}
          </section>

<section className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
  <p className="text-[10px] uppercase tracking-[0.28em] text-stone-400">
    Review
  </p>
  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-800">
    {t.reviewTitle}
  </h2>
  <p className="mt-2 text-sm text-stone-500">{t.reviewSubtitle}</p>

  <a
    href="https://www.tripadvisor.com/UserReviewEdit-g297476-d17750092-Two_Travel-Cartagena_Cartagena_District_Bolivar_Department.html"
    target="_blank"
    rel="noreferrer"
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
function FeedbackDashboard() {
  const sheetUrl =
    "https://docs.google.com/spreadsheets/d/1Tyv5cPTN0MjxezyWRjo-XuIRqOgaPwP-z1heZfgGiuQ/edit#gid=0";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [destinationFilter, setDestinationFilter] = useState("all");
  const [conciergeFilter, setConciergeFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");

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

  return (
    <div className="min-h-screen bg-stone-50 p-6 text-stone-800">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-[28px] border border-stone-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Feedback Dashboard</h1>
              <p className="mt-2 text-sm text-stone-500">
                Aquí puedes ver métricas, gráficas y respuestas recientes.
              </p>
            </div>

            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block rounded-full bg-stone-800 px-6 py-3 text-white font-semibold"
            >
              Abrir Google Sheet
            </a>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"
          >
            {destinationOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "Todos los destinos" : opt}
              </option>
            ))}
          </select>

          <select
            value={conciergeFilter}
            onChange={(e) => setConciergeFilter(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"
          >
            {conciergeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "Todos los concierge" : opt}
              </option>
            ))}
          </select>

          <select
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm"
          >
            {languageOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "Todos los idiomas" : opt}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
            Cargando dashboard...
          </div>
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
                    <p>
                      <span className="text-stone-500">Huésped:</span>{" "}
                      <span className="font-semibold">{latest.guestName || "—"}</span>
                    </p>
                    <p>
                      <span className="text-stone-500">Viaje:</span>{" "}
                      <span className="font-semibold">{latest.tripName || "—"}</span>
                    </p>
                    <p>
                      <span className="text-stone-500">Destino:</span>{" "}
                      <span className="font-semibold">{latest.destination || "—"}</span>
                    </p>
                    <p>
                      <span className="text-stone-500">Score:</span>{" "}
                      <span className="font-semibold">{latest.overallExperience || "—"}</span>
                    </p>
                    <p>
                      <span className="text-stone-500">Idioma:</span>{" "}
                      <span className="font-semibold">{latest.language || "—"}</span>
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-stone-500">Sin feedback todavía.</p>
                )}
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
                <p className="text-lg font-semibold">Resumen rápido</p>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-xl border border-stone-100 px-4 py-3">
                    Usa filtros para ver resultados por destino, concierge o idioma.
                  </div>
                  <div className="rounded-xl border border-stone-100 px-4 py-3">
                    La distribución de scores te muestra si la operación está estable.
                  </div>
                  <div className="rounded-xl border border-stone-100 px-4 py-3">
                    Los comentarios recientes te ayudan a detectar fricciones repetidas.
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-lg font-semibold mb-4">Comentarios recientes</p>

              <div className="space-y-3">
                {recentComments.length ? (
                  recentComments.slice(0, 10).map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-stone-200 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {item.guestName || "Sin nombre"}
                          </p>
                          <p className="text-sm text-stone-500">
                            {item.tripName || "Sin viaje"} · {item.destination || "—"}
                          </p>
                        </div>

                        <div className="text-sm font-semibold">
                          Score: {item.overallExperience || "—"}
                        </div>
                      </div>

                      {item.overallReason ? (
                        <p className="mt-3 text-sm text-stone-700">
                          <span className="font-semibold">Razón:</span> {item.overallReason}
                        </p>
                      ) : null}

                      {item.oneThing ? (
                        <p className="mt-2 text-sm text-stone-700">
                          <span className="font-semibold">Mejorar:</span> {item.oneThing}
                        </p>
                      ) : null}

                      {item.stayNotes ? (
                        <p className="mt-2 text-sm text-stone-700">
                          <span className="font-semibold">Notas:</span> {item.stayNotes}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-stone-500">No hay comentarios todavía.</p>
                )}
              </div>
            </div>
          </>
        )}

        <div className="mt-6">
          <a href="?concierge=1" className="text-sm text-stone-500 underline">
            ← Volver al panel
          </a>
        </div>
      </div>
    </div>
  );
}
function App() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");

  if (mode === "dashboard") return <FeedbackDashboard />;
  if (mode === "concierge") return <ConciergePanel />;
  if (mode === "catalog" || mode === "questionnaire") return <TwoTravelCatalog />;
  if (mode === "itinerary") return <ItineraryPrintView />;

  return <FeedbackForm kickoffId={params.get("kickoffId") || ""} />;
}

export default App;