
import React, { useMemo, useState, useEffect } from "react";
import {
  fetchServicesFromSheet,
  updateKickoffInSheet,
  saveKickoffToSheet,
  deleteKickoff,
  fetchKickoffsFromSheet,
} from "./sheetServices";


import {
  Search,
  Filter,
  X,
  ChevronDown,
  MapPin,
  ExternalLink,
  Globe,
  DollarSign,
  Clock,
  Users,
  Heart,
} from "lucide-react";
import logo from "./assets/logo.png";

/* ================================
   1) CONFIG: tasa de cambio
   Se actualiza en vivo desde Frankfurter API (tasa oficial - 2%).
   Fallback: 4200 COP/USD si la API falla.
================================== */
const FX_FALLBACK = 4200;

/* ================================
   2) I18N (textos de interfaz)
================================== */
const i18n = {
  es: {
    search: "Buscar experiencias...",
    filters: "Filtros",
    all: "Todos",
    restaurants: "Restaurantes",
    bars: "Bares",
    "beach-clubs": "Beach Clubs",
    tours: "Tours",
    nightlife: "Nightlife",
    chef: "Chef Privado",
    services: "Servicios",
    styles: "Estilos",
    price: "Precio",
    priceGroup: "por grupo",
    noResults: "No se encontraron servicios",
    language: "Idioma",
    currency: "Moneda",
    transportation: "Transporte",
    cop: "COP",
    usd: "USD",
    approxPrice: "Precio aproximado",
    perPerson: "por persona",
    dayPass: "pasadía",
    perGroup: "por grupo",
    people: "personas",
    details: "Detalles",
    highlights: "Destacados",
    deposit: "Depósito",
    cancellation: "Cancelación",
    menu: "Menú",
    map: "Mapa",
    close: "Cerrar",
    add: "Agregar a favoritos",
    yourSelection: "Tus favoritos para Concierge",
    emptyCart: "Aún no tienes favoritos",
    notes: "Notas",
    continue: "Continuar a resumen →",
    kickoffTitle: "Resumen de tu selección",
    kickoffIntro:
      "Tu selección nos da una idea de las preferencias, el estilo y las experiencias que busca tu grupo. Nuestro concierge usará esta información para personalizar tu experiencia y preparar tu kickoff call.",
    kickoffQuestionsTitle: "Tu selección",
    backToCart: "Editar selección",
    sendKickoff: "Enviar al concierge",
    conciergePanelTitle: "Resumen para Concierge",
    conciergePanelHelp:
      "Este es el resumen de los favoritos del cliente. Puedes copiarlo y pegarlo en Travify o en tu flujo interno.",
    travifyNote:
      "Al hacer clic en el botón, se copiará el resumen y se abrirá un borrador de correo para Travify.",
    kickoffNextStepsTitle: "¿Qué pasa después?",
    kickoffNextStepsBody:
      "Tu concierge revisará tus respuestas en detalle y las usará para guiar el kickoff call. Juntos vamos a refinar tus preferencias, explorar opciones curadas y construir un itinerario personalizado para tu estadía.",
    kickoffSentTitle: "¡Resumen enviado!",
    kickoffSentBody:
      "Tu selección fue enviada a nuestro equipo de concierge. En las próximas horas te contactaremos para afinar detalles y avanzar con las reservas.",
      quizTitle: "Diseñemos tus Experiences en Cartagena",
quizSubtitle: "En 30 segundos, entendemos tu estilo y te mostramos recomendaciones curadas por nuestro concierge.",
quizNote: "No vendemos tus datos. Esto solo se usa para personalizar tu catálogo.",
quizVibeLabel: "Mood del viaje",
quizBudgetLabel: "Nivel de presupuesto",
quizKidsLabel: "¿Viajas con niños?",
quizCuisinesLabel: "Cocinas favoritas (opcional)",
quizCuisinesPH: "Mariscos, sushi, italiano…",
quizInterestsLabel: "¿Qué te provoca?",
quizSkip: "Saltar",
quizCTA: "Ver recomendaciones →",
requestQuote: "Solicita cotización",
variablePrice: "Precio variable",
quizEditAnswers: "Editar respuestas",

  },
  en: {
    search: "Search experiences...",
    filters: "Filters",
    all: "All",
    restaurants: "Restaurants",
    bars: "Bars",
    "beach-clubs": "Beach Clubs",
    tours: "Tours",
    nightlife: "Nightlife",
    chef: "Private Chef",
    transportation: "Transportation",
    services: "Services",
    styles: "Styles",
    price: "Price",
    priceGroup: "per group",
    noResults: "No services found",
    language: "Language",
    currency: "Currency",
    requestQuote: "Request quote",
variablePrice: "Variable pricing",
    cop: "COP",
    usd: "USD",
    approxPrice: "Approx. price",
    perPerson: "per person",
    dayPass: "day pass",
    quizTitle: "Let's design your Cartagena Experiences!",
quizSubtitle: "In 30 seconds, we'll understand your style and show concierge-curated recommendations.",
quizNote: "We don't sell your data. This is only used to personalize your catalog.",
quizVibeLabel: "Trip vibe",
quizBudgetLabel: "Budget level",
quizKidsLabel: "Traveling with kids?",
quizCuisinesLabel: "Favorite cuisines (optional)",
quizCuisinesPH: "Seafood, sushi, Italian…",
quizInterestsLabel: "What are you in the mood for?",
quizSkip: "Skip",
quizCTA: "See recommendations →",
quizEditAnswers: "Edit answers",
    perGroup: "per group",
    people: "people",
    details: "Details",
    highlights: "Highlights",
    deposit: "Deposit",
    cancellation: "Cancellation",
    menu: "Menu",
    map: "Map",
    close: "Close",
    add: "Add to favorites",
    yourSelection: "Your Selection",
    emptyCart: "You don't have favorites yet",
    notes: "Notes",
        continue: "Go to summary →",
    kickoffTitle: "Your Selection Summary",
    kickoffIntro:
      "Your selections give us insight into your group's preferences, style, and desired experiences. Our concierge will use this information to tailor your experience and prepare for your upcoming kickoff call.",
    kickoffQuestionsTitle: "Your selection",
    backToCart: "Edit selection",
    sendKickoff: "Send to concierge",
    conciergePanelTitle: "Concierge Summary",
    conciergePanelHelp:
      "This is the summary of the guest's favorites. You can copy and paste it into Travify or your internal flow.",
    travifyNote:
      "Clicking the button will copy the summary and open an email draft for Travify.",
    kickoffNextStepsTitle: "What happens next?",
    kickoffNextStepsBody:
      "Your concierge will review your inputs in detail and use them to guide the kickoff call. Together, we'll refine your preferences, explore curated options, and shape a personalized itinerary for your stay.",
    kickoffSentTitle: "Summary sent!",
    kickoffSentBody:
      "Your selection has been sent to our concierge team. We'll reach out in the next few hours to refine details and proceed with bookings.",

  },
};

/* ==================================================
   3) PLANTILLA para COPIAR/PEGAR nuevos servicios
   — Copia este bloque, pega dentro del array servicesData y cambia datos —
================================================== */
/*
{
  id: 999,                                  // número único
  sku: "REST-999",                           // código interno
  name: "Nombre del lugar",
  category: "restaurants",                   // "restaurants" | "bars" | "beach-clubs" | "tours" | "nightlife" | "services"
  subcategory: "fine-dining",                // si es restaurante: "fine-dining" | "caribbean" | "rooftop" | "japanese" | "seafood" | "peruvian" | ...
  price_cop: 250000,                         // número en COP
  priceUnit: "per person",                   // "per person" | "day pass" | "per group"
  image: "https://...jpg",
  description: {                             // descripciones bilingües
    es: "Descripción en español.",
    en: "Description in English."
  },
  capacity: { min: 2, max: 10 },
  schedule: "Mon–Sun 7pm–11pm",
  duration: "2–3 hours",
  location: "Centro Histórico",
  highlights: ["Punto 1", "Punto 2"],
  deposit: "50% advance",
  cancellation: "Cancel up to 24 hours",
  menuUrl: "https://...",                    // SOLO restaurantes (si no hay, deja "")
  mapsUrl: "https://maps.app.goo.gl/..."
}
*/

/* =========================================
   4) DATOS — 4 ítems por categoría
   (bilingüe; menuUrl solo en restaurants)
========================================== */
const servicesData = [
   
  /* ---------- RESTAURANTS ---------- */
  {
    id: 1,
    sku: "REST-001",
    name: "Carmen Cartagena",
    category: "restaurants",
    subcategory: "fine-dining",
    price_cop: 491000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1280&q=80",
    description: {
      es: "Cocina contemporánea inspirada en la biodiversidad de Colombia.",
      en: "Contemporary cuisine inspired by Colombia's biodiversity.",
    },
    capacity: { min: 1, max: 8 },
    schedule: "Mon–Sun 7pm–9pm",
    duration: "2–3 hours",
    location: "Historic Center",
    highlights: ["Menú degustación", "Wine pairing"],
    deposit: "Grupos 8+ con garantía",
    cancellation: "Cancela hasta 12 h",
    menuUrl:
      "https://drive.google.com/file/d/1lOX334QK5UMzWTWGFtXXW-2Hdekt2AiS/view",
    mapsUrl: "https://maps.app.goo.gl/pYCwXusgmKsJiywK7",
  },
  {
    id: 2,
    sku: "REST-002",
    name: "Celele",
    category: "restaurants",
    subcategory: "caribbean",
    price_cop: 280000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1280&q=80",
    description: {
      es: "Cocina Caribe contemporánea; entre los 50 Best de Latinoamérica.",
      en: "Contemporary Caribbean cuisine; Latin America's 50 Best.",
    },
    capacity: { min: 2, max: 20 },
    schedule: "Mon–Sat 12–3:30pm, 6:30–9:30pm",
    duration: "2 hours",
    location: "Historic Center",
    highlights: ["Ingredientes locales", "Premiado"],
    deposit: "Garantía para grupos",
    cancellation: "Cancela hasta 12 h",
    menuUrl: "https://celelerestaurante.com/en/menu/",
    mapsUrl: "https://maps.app.goo.gl/LC4g9MqmPoB1pRWb6",
  },
  {
    id: 3,
    sku: "REST-003",
    name: "Agua de León",
    category: "restaurants",
    subcategory: "contemporary",
    price_cop: 240000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1280&q=80",
    description: {
      es: "Cocina contemporánea con ingredientes colombianos.",
      en: "Contemporary cuisine with Colombian ingredients.",
    },
    capacity: { min: 2, max: 12 },
    schedule: "Daily 12pm–11pm",
    duration: "2–3 hours",
    location: "Bocagrande",
    highlights: ["Ambiente moderno", "Coctelería de autor"],
    deposit: "Puede requerir garantía",
    cancellation: "Cancela hasta 12 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 4,
    sku: "REST-004",
    name: "La Vitrola",
    category: "restaurants",
    subcategory: "classic",
    price_cop: 260000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1559339357-10ef8f0f8bdf?w=1280&q=80",
    description: {
      es: "Clásico cartagenero con ambiente elegante y música en vivo.",
      en: "Cartagena classic with elegant ambiance and live music.",
    },
    capacity: { min: 2, max: 20 },
    schedule: "Daily 12pm–11pm",
    duration: "2–3 hours",
    location: "Historic Center",
    highlights: ["Música en vivo", "Ambiente elegante"],
    deposit: "Puede requerir garantía",
    cancellation: "Cancela hasta 12 h",
    menuUrl: "",
    mapsUrl: "",
  },

  /* ---------- BARS ---------- */
  {
    id: 5,
    sku: "BAR-001",
    name: "Alquímico",
    category: "bars",
    subcategory: "cocktails",
    price_cop: 85000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1280&q=80",
    description: {
      es: "Coctelería de autor en tres pisos con rooftop.",
      en: "Signature cocktails across three floors with rooftop.",
    },
    capacity: { min: 1, max: 100 },
    schedule: "Mon–Sun 6pm–2am",
    duration: "2–3 hours",
    location: "Historic Center",
    highlights: ["Rooftop", "DJ / ambiente"],
    deposit: "Sin reservas",
    cancellation: "Orden de llegada",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 6,
    sku: "BAR-002",
    name: "El Barón",
    category: "bars",
    subcategory: "cocktails",
    price_cop: 65000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1280&q=80",
    description: {
      es: "Bar icónico de coctelería frente a San Pedro.",
      en: "Iconic cocktail bar by San Pedro church.",
    },
    capacity: { min: 1, max: 60 },
    schedule: "Daily 5pm–2am",
    duration: "2–3 hours",
    location: "Historic Center",
    highlights: ["Clásicos y de autor", "Vista a la plaza"],
    deposit: "Sin reservas",
    cancellation: "Orden de llegada",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 7,
    sku: "BAR-003",
    name: "El Arsenal Rum Box",
    category: "bars",
    subcategory: "rum",
    price_cop: 70000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1582101062209-3e6b4cd5569a?w=1280&q=80",
    description: {
      es: "Experiencias de ron y maridajes caribeños.",
      en: "Rum experiences with Caribbean pairings.",
    },
    capacity: { min: 1, max: 40 },
    schedule: "Daily 5pm–1am",
    duration: "2–3 hours",
    location: "Getsemaní",
    highlights: ["Catas de ron", "Tapas caribeñas"],
    deposit: "Según grupo",
    cancellation: "Cancela hasta 12 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 8,
    sku: "BAR-004",
    name: "Mirador Gastro Bar",
    category: "bars",
    subcategory: "rooftop",
    price_cop: 65000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1544126592-4bc3b8c4a8e3?w=1280&q=80",
    description: {
      es: "Rooftop con vista a la cúpula de San Pedro.",
      en: "Rooftop with views of San Pedro's dome.",
    },
    capacity: { min: 1, max: 120 },
    schedule: "Daily 5pm–2am",
    duration: "2–3 hours",
    location: "Historic Center",
    highlights: ["Vista icónica", "Música"],
    deposit: "Sin reservas",
    cancellation: "Orden de llegada",
    menuUrl: "",
    mapsUrl: "",
  },

  /* ---------- BEACH CLUBS ---------- */
  {
    id: 9,
    sku: "BEACH-001",
    name: "Bora Bora Beach Club",
    category: "beach-clubs",
    subcategory: "rosario-islands",
    price_cop: 350000,
    priceUnit: "day pass",
    image:
      "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1280&q=80",
    description: {
      es: "Beach club solo adultos con ambiente fiestero.",
      en: "Adults-only beach club with party atmosphere.",
    },
    capacity: { min: 1, max: 50 },
    schedule: "Daily 9am–5pm",
    duration: "Full day",
    location: "Rosario Islands",
    highlights: ["Piscina", "DJ", "Restaurante"],
    deposit: "50% anticipo",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 10,
    sku: "BEACH-002",
    name: "Blue Apple Beach",
    category: "beach-clubs",
    subcategory: "tierrabomba",
    price_cop: 420000,
    priceUnit: "day pass",
    image:
      "https://images.unsplash.com/photo-1468413253725-0d5181091126?w=1280&q=80",
    description: {
      es: "Beach house boutique con buen restaurante y pool day.",
      en: "Boutique beach house with great restaurant and pool day.",
    },
    capacity: { min: 1, max: 40 },
    schedule: "Daily 9am–5pm",
    duration: "Full day",
    location: "Tierrabomba",
    highlights: ["Restaurante", "Pool", "Cocteles"],
    deposit: "Requiere garantía",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 11,
    sku: "BEACH-003",
    name: "Makani Beach Club",
    category: "beach-clubs",
    subcategory: "barú",
    price_cop: 480000,
    priceUnit: "day pass",
    image:
      "https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?w=1280&q=80",
    description: {
      es: "Beach club de mood relajado y cocina mediterránea.",
      en: "Relaxed beach club with Mediterranean cuisine.",
    },
    capacity: { min: 1, max: 60 },
    schedule: "Daily 9am–5pm",
    duration: "Full day",
    location: "Barú",
    highlights: ["Pool", "Restaurante", "Camastros"],
    deposit: "Requiere garantía",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 12,
    sku: "BEACH-004",
    name: "Pa'ue Beach",
    category: "beach-clubs",
    subcategory: "rosario-islands",
    price_cop: 380000,
    priceUnit: "day pass",
    image:
      "https://images.unsplash.com/photo-1493558103817-58b2924bce98?w=1280&q=80",
    description: {
      es: "Islote tranquilo ideal para descansar y almorzar frente al mar.",
      en: "Peaceful islet ideal to relax and lunch by the sea.",
    },
    capacity: { min: 1, max: 40 },
    schedule: "Daily 9am–5pm",
    duration: "Full day",
    location: "Rosario Islands",
    highlights: ["Playa calma", "Restaurante"],
    deposit: "Anticipo 50%",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },

  /* ---------- TOURS ---------- */
  {
    id: 13,
    sku: "TOUR-001",
    name: "Street Food Tour",
    category: "tours",
    subcategory: "walking",
    price_cop: 260000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1280&q=80",
    description: {
      es: "Ruta de comida callejera por Getsemaní y Centro.",
      en: "Authentic street food walk through Getsemaní and Old City.",
    },
    capacity: { min: 2, max: 15 },
    schedule: "Daily 2:30pm",
    duration: "2.5 hours",
    location: "Getsemaní & Old City",
    highlights: ["10+ tastings", "Guía local"],
    deposit: "No requiere",
    cancellation: "Cancela hasta 48 h",
    menuUrl: "",
    mapsUrl: "",
  },
  
  {
    id: 14,
    sku: "TOUR-003",
    name: "City Historical Tour",
    category: "tours",
    subcategory: "city",
    price_cop: 180000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1280&q=80",
    description: {
      es: "Recorrido por murallas, plazas y leyendas del Centro Histórico.",
      en: "Walled city highlights, plazas and legends.",
    },
    capacity: { min: 2, max: 20 },
    schedule: "Daily 9:00am",
    duration: "3 hours",
    location: "Historic Center",
    highlights: ["Murallas", "Plazas", "Guía experto"],
    deposit: "No requiere",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 15,
    sku: "TOUR-004",
    name: "Bazurto Market Experience",
    category: "tours",
    subcategory: "market",
    price_cop: 240000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1280&q=80",
    description: {
      es: "Explora el mercado más auténtico con degustaciones locales.",
      en: "Explore the most authentic market with local tastings.",
    },
    capacity: { min: 2, max: 12 },
    schedule: "Daily 9:30am",
    duration: "3 hours",
    location: "Bazurto",
    highlights: ["Degustaciones", "Cultura local"],
    deposit: "No requiere",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },

  /* ---------- NIGHTLIFE ---------- */
  {
    id: 16,
    sku: "NIGHT-001",
    name: "La Movida",
    category: "nightlife",
    subcategory: "club",
    price_cop: 150000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=1280&q=80",
    description: {
      es: "Club elegante con DJ en vivo y áreas VIP.",
      en: "Elegant club with live DJ and VIP areas.",
    },
    capacity: { min: 2, max: 200 },
    schedule: "Tue–Sun 7pm–3am",
    duration: "Hasta tarde",
    location: "Historic Center",
    highlights: ["Pista de baile", "VIP"],
    deposit: "Depósito para grupos 10+",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 17,
    sku: "NIGHT-002",
    name: "La Jugada",
    category: "nightlife",
    subcategory: "rooftop",
    price_cop: 120000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1280&q=80",
    description: {
      es: "Rooftop con coctelería creativa y ambientazo.",
      en: "Rooftop with creative cocktails and great vibe.",
    },
    capacity: { min: 2, max: 180 },
    schedule: "Daily 6pm–2am",
    duration: "Hasta tarde",
    location: "Historic Center",
    highlights: ["Rooftop", "Coctelería"],
    deposit: "Según grupo",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 18,
    sku: "NIGHT-003",
    name: "Townhouse Rooftop",
    category: "nightlife",
    subcategory: "rooftop",
    price_cop: 120000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1280&q=80",
    description: {
      es: "Rooftop divertido con cocteles y piscina.",
      en: "Fun rooftop with cocktails and pool.",
    },
    capacity: { min: 2, max: 150 },
    schedule: "Daily 4pm–2am",
    duration: "Hasta tarde",
    location: "Historic Center",
    highlights: ["Piscina", "DJ"],
    deposit: "Sin reservas",
    cancellation: "Orden de llegada",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 19,
    sku: "NIGHT-004",
    name: "Baruco by Cuzco",
    category: "nightlife",
    subcategory: "latin",
    price_cop: 130000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1280&q=80",
    description: {
      es: "Salsa, reggaetón y shows latinos en vivo.",
      en: "Salsa, reggaeton and live Latin shows.",
    },
    capacity: { min: 2, max: 160 },
    schedule: "Thu–Sun 8pm–3am",
    duration: "Hasta tarde",
    location: "Getsemaní",
    highlights: ["Shows", "Música latina"],
    deposit: "Según grupo",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },

  /* ---------- SERVICES ---------- */
  {
    id: 20,
    sku: "SERV-001",
    name: "Private Chef Experience",
    category: "services",
    subcategory: "culinary",
    price_cop: 1200000,
    priceUnit: "per group",
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=1280&q=80",
    description: {
      es: "Chef privado en tu villa con menú personalizado.",
      en: "Private chef at your villa with custom menu.",
    },
    capacity: { min: 4, max: 20 },
    schedule: "Bajo reserva",
    duration: "4 hours",
    location: "Tu villa",
    highlights: ["Menú a medida", "Compras incluidas"],
    deposit: "50% anticipo",
    cancellation: "Cancela hasta 24 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 21,
    sku: "SERV-002",
    name: "Airport Transfer",
    category: "services",
    subcategory: "transport",
    price_cop: 180000,
    priceUnit: "per group",
    image:
      "https://images.unsplash.com/photo-1529078155058-5d716f45d604?w=1280&q=80",
    description: {
      es: "Traslado aeropuerto ↔ alojamiento en vehículo privado.",
      en: "Private vehicle airport ↔ lodging transfer.",
    },
    capacity: { min: 1, max: 12 },
    schedule: "24/7",
    duration: "30–60 min",
    location: "Cartagena",
    highlights: ["Pancarta opcional", "Asistencia"],
    deposit: "No requiere",
    cancellation: "Cancela hasta 12 h",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 22,
    sku: "SERV-003",
    name: "Villa Concierge",
    category: "services",
    subcategory: "concierge",
    price_cop: 0,
    priceUnit: "per group",
    image:
      "https://images.unsplash.com/photo-1505692952049-6041e79c76aa?w=1280&q=80",
    description: {
      es: "Itinerario y reservas a medida para tu estadía.",
      en: "Tailored itinerary and reservations for your stay.",
    },
    capacity: { min: 1, max: 20 },
    schedule: "Bajo agenda",
    duration: "Flexible",
    location: "Cartagena",
    highlights: ["Asistente dedicado", "Reservas"],
    deposit: "No requiere",
    cancellation: "Flexible",
    menuUrl: "",
    mapsUrl: "",
  },
  {
    id: 23,
    sku: "SERV-004",
    name: "Spa at the Villa",
    category: "services",
    subcategory: "wellness",
    price_cop: 450000,
    priceUnit: "per person",
    image:
      "https://images.unsplash.com/photo-1556228724-4b6a5192e1f5?w=1280&q=80",
    description: {
      es: "Masajes y rituales de bienestar en tu villa.",
      en: "Massages and wellness rituals in your villa.",
    },
    capacity: { min: 1, max: 10 },
    schedule: "Bajo reserva",
    duration: "60–90 min",
    location: "Tu villa",
    highlights: ["Terapeutas certificados", "Aceites naturales"],
    deposit: "Según servicio",
    cancellation: "Cancela hasta 12 h",
    menuUrl: "",
    mapsUrl: "",
  },
  /* ====== FROM PDF: NUEVOS (sin duplicar los que ya tenías) ====== */
{
  id: 24,
  sku: "REST-025",
  name: "Salón Tropical",
  category: "restaurants",
  subcategory: "seafood",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1280&q=80",
  description: {
    es: "Alta cocina con productos frescos de Colombia; enfoque en mariscos y música en vivo.",
    en: "Haute cuisine using fresh Colombian produce; seafood focus and live music."
  },
  capacity: { min: 2, max: 20 },
  schedule: "Mon–Sun 12 pm–11 pm",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Seafood del día", "Ingredientes locales", "Música en vivo"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 12 h",
  menuUrl: "https://qr.precompro.com/?source=salontropicalctg.precompro.com",
  mapsUrl: "https://maps.app.goo.gl/XVEy6bytQ2tXKUuW6"
},
{
  id: 25,
  sku: "REST-026",
  name: "Candé",
  category: "restaurants",
  subcategory: "caribbean",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1559339357-10ef8f0f8bdf?w=1280&q=80",
  description: {
    es: "Cocina cartagenera: mariscos, arroces, sopas icónicas; casa colonial con música en vivo.",
    en: "Cartagena cuisine: seafood, rices, iconic soups; colonial house with live music."
  },
  capacity: { min: 2, max: 20 },
  schedule: "Mon–Wed 7 am–11 pm; Thu–Sat 7 am–11:30 pm; Sun 7 am–10 pm",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Música en vivo", "Recetas tradicionales"],
  deposit: "Grupos >10: $200.000 p/p o menú $230.000 p/p",
  cancellation: "Cancela hasta 12 h",
  menuUrl: "https://restaurantecande.com/menu/main/en/index.html",
  mapsUrl: "https://maps.app.goo.gl/mrKQg7r3nHMwQ9aJA"
},
{
  id: 26,
  sku: "REST-027",
  name: "Lobo de Mar",
  category: "restaurants",
  subcategory: "contemporary",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1280&q=80",
  description: {
    es: "Casa colonial con cocina contemporánea de base mediterránea; platos para compartir.",
    en: "Colonial house; contemporary Mediterranean-inspired sharing plates."
  },
  capacity: { min: 2, max: 20 },
  schedule: "Mon–Thu 12 m–3 pm & 7 pm–11:30 pm",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Coctelería creativa"],
  deposit: "No requiere",
  cancellation: "Hasta 12 h",
  menuUrl: "https://lobo-de-mar.cluvi.co/lobo-de-mar/menu-digital/home",
  mapsUrl: "https://maps.app.goo.gl/W6f1XqR9q1gXW5fT9"
},
{
  id: 27,
  sku: "REST-028",
  name: "NIKU",
  category: "restaurants",
  subcategory: "japanese",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1280&q=80",
  description: {
    es: "Cocina Nikkei (japonesa-peruana); experiencia moderna con DJ y dress code.",
    en: "Nikkei cuisine (Japanese–Peruvian); modern vibe with DJ and dress code."
  },
  capacity: { min: 2, max: 20 },
  schedule: "Mon–Sun 12 pm–10 pm",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Nikkei", "DJ"],
  deposit: "4+ pax: $50.000 p/p consumible; 15+ pax: $250.000 p/p consumible",
  cancellation: "Hasta 24 h",
  menuUrl: "https://niku-cartagena.cluvi.co/english-menu/menu-digital/home",
  mapsUrl: ""
},
{
  id: 28,
  sku: "REST-029",
  name: "UMA Cantina Peruana",
  category: "restaurants",
  subcategory: "peruvian",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1280&q=80",
  description: {
    es: "Ceviches, tiraditos y anticuchos peruanos en Hotel Nácar.",
    en: "Peruvian ceviches, tiraditos and anticuchos at Hotel Nácar."
  },
  capacity: { min: 2, max: 20 },
  schedule: "Daily 12 pm–11 pm",
  duration: "2–3 hours",
  location: "Old City (Hotel Nácar)",
  highlights: ["Peruvian classics", "Seafood"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "https://www.umacantinaperuanactg.com/menu/",
  mapsUrl: ""
},
{
  id: 29,
  sku: "REST-030",
  name: "Havana Restaurante",
  category: "restaurants",
  subcategory: "caribbean",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1280&q=80",
  description: {
    es: "Esquina habanera en Getsemaní: experiencia cubana con cigar club, música y tradición.",
    en: "Havana corner in Getsemaní: Cuban experience with cigar club, music and tradition."
  },
  capacity: { min: 2, max: 40 },
  schedule: "Tue–Sun 6 pm–11:30 pm",
  duration: "2–3 hours",
  location: "Getsemaní",
  highlights: ["Cigar club", "Cocina cubana"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 30,
  sku: "BAR-007",
  name: "Barra 7",
  category: "bars",
  subcategory: "cocktails",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=1280&q=80",
  description: {
    es: "Coctelería high-mixology del grupo La Movida; bar pequeño con vibra moderna.",
    en: "High-mixology cocktail bar from La Movida Group; small bar with modern vibe."
  },
  capacity: { min: 1, max: 40 },
  schedule: "Mon–Thu 7 pm–2 am; Fri–Sat 5 pm–3 am; Sun 5 pm–2 am",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Mixología", "Ambiente vibrante"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h aprox.",
  menuUrl: "https://barra-7.cluvi.co/barra-7/maincategories",
  mapsUrl: "https://maps.app.goo.gl/gjpNsJmWicvECmYY7"
},
{
  id: 31,
  sku: "ROOF-003",
  name: "51 Sky Bar",
  category: "nightlife",
  subcategory: "rooftop",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1280&q=80",
  description: {
    es: "Rooftop con vista 360° en Bocagrande; suele requerir transporte desde el Centro.",
    en: "360° rooftop view in Bocagrande; usually needs transport from Old City."
  },
  capacity: { min: 2, max: 150 },
  schedule: "Thu 4 pm–2 am; Fri–Sat 4 pm–3 am; Sun 4 pm–2 am",
  duration: "2–3 hours",
  location: "Bocagrande",
  highlights: ["Vista 360°", "Coctelería"],
  deposit: "Para grupos 6+: garantía $50.000 p/p (no-show aplica)",
  cancellation: "Hasta 24 h aprox.",
  menuUrl: "https://tr.ee/CwShAwUDru",
  mapsUrl: "https://maps.app.goo.gl/Xy27QbMg5YdjYi2S6"
},
{
  id: 32,
  sku: "REST-031",
  name: "Manglar",
  category: "restaurants",
  subcategory: "caribbean",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1280&q=80",
  description: {
    es: "Combinaciones de sabor inspiradas en costas colombianas; coctelería con ingredientes locales.",
    en: "Coastal Colombian flavors; signature cocktails with local ingredients."
  },
  capacity: { min: 2, max: 30 },
  schedule: "Mon & Thu 4 pm–12 am; Fri 12 m–1 am; Sat 12 m–1 am; Sun 12 m–11 pm",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Signature cocktails", "Coastal flavors"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "https://www.manglarctg.co/#",
  mapsUrl: "https://maps.app.goo.gl/Fe2X7CPzvKjLobwg9"
},
/* ====== FROM PDF: NUEVOS (faltantes añadidos) ====== */

{
  id: 33,
  sku: "REST-032",
  name: "Apogeo",
  category: "restaurants",
  subcategory: "mediterranean",
  price_cop: 0,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1600891964093-4316c288032e?w=1280&q=80",
  description: {
    es: "Restaurante contemporáneo con estética artística y menú mediterráneo-latino. Platos frescos, vinos seleccionados y ambiente bohemio.",
    en: "Contemporary restaurant with artistic aesthetics and Mediterranean-Latin menu. Fresh dishes, curated wines and a bohemian atmosphere."
  },
  capacity: { min: 2, max: 40 },
  schedule: "Mon–Sun 12 pm–11 pm",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Alta cocina mediterránea", "Ambiente artístico", "Coctelería de autor"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 12 h",
  menuUrl: "https://apogeorestaurante.com/our-menu/",
  mapsUrl: "https://maps.app.goo.gl/XjeJWmD86SmcdFa68"
},
{
  id: 34,
  sku: "BAR-009",
  name: "Mondo Bar",
  category: "bars",
  subcategory: "lounge",
  price_cop: 0,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1581505792161-dfcd4b6b5b39?w=1280&q=80",
  description: {
    es: "Bar tipo lounge en el Centro Histórico. Coctelería creativa, DJs y diseño artístico moderno. Ideal para pre-party o noche relajada.",
    en: "Lounge-style bar in Cartagena's Old City. Creative cocktails, DJs, and artistic modern design. Ideal for pre-party or a chill night out."
  },
  capacity: { min: 2, max: 60 },
  schedule: "Thu–Sun 6 pm–2 am",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Coctelería creativa", "DJ sets", "Ambiente lounge"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h aprox.",
  menuUrl: "https://mondoexoticactg.com/wp-content/uploads/2022/07/thumbnail_image.pdf",
  mapsUrl: "https://maps.app.goo.gl/jLzxk1H8iJkSuSNa7"
},
/* ====== TOURS / EXPERIENCIAS (del PDF) ====== */
{
  id: 35,
  sku: "TOUR-005",
  name: "Bike Tour (Old City & Getsemaní)",
  category: "tours",
  subcategory: "bike",
  price_cop: 290000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1280&q=80",
  description: {
    es: "Recorre Centro Histórico y Getsemaní en bici con guía bilingüe.",
    en: "Cycle the Old City & Getsemaní with a bilingual guide."
  },
  capacity: { min: 1, max: 30 },
  schedule: "Todos los días 8:00–16:00 (flexible)",
  duration: "2 hours",
  location: "Centro & Getsemaní",
  highlights: ["Bicicleta, casco, agua", "Guía histórico"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},

{
  id: 36,
  sku: "TOUR-007",
  name: "Street Art of Getsemaní",
  category: "tours",
  subcategory: "walking",
  price_cop: 200000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1517816414764-aab76f4e8000?w=1280&q=80",
  description: {
    es: "Tour por murales y mensajes del barrio Getsemaní.",
    en: "Murals & messages of Getsemaní with local guides."
  },
  capacity: { min: 5, max: 30 },
  schedule: "No disponible domingos; grupos 10:00 am",
  duration: "2 hours",
  location: "Getsemaní",
  highlights: ["Historia, política y cultura del barrio"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 37,
  sku: "TOUR-008",
  name: "Walking Tour (Privado)",
  category: "tours",
  subcategory: "city",
  price_cop: 260000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?w=1280&q=80",
  description: {
    es: "Recorrido personalizado por Centro, San Diego y Getsemaní.",
    en: "Flexible private walk across Centro, San Diego & Getsemaní."
  },
  capacity: { min: 1, max: 20 },
  schedule: "Todos los días",
  duration: "1–4 hours",
  location: "Centro, San Diego & Getsemaní",
  highlights: ["Historia, comida, arte urbano, tips locales"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 38,
  sku: "TOUR-009",
  name: "Sunset Boat Tour",
  category: "tours",
  subcategory: "boat",
  price_cop: 200000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1280&q=80",
  description: {
    es: "Crucero al atardecer por la bahía con open bar y snack.",
    en: "Sunset bay cruise with open bar and snack."
  },
  capacity: { min: 2, max: 40 },
  schedule: "Todos los días 5:00–7:00 pm (ingreso muelle 4:30 pm)",
  duration: "2 hours",
  location: "Muelle de la Bodeguita",
  highlights: ["Open bar", "Vista panorámica de la bahía"],
  deposit: "No requiere (tasa de muelle se paga aparte)",
  cancellation: "Cancela hasta 48 h",
  menuUrl: "",
  mapsUrl: "",
  // Nota: no incluye tasa de muelle (~$16.000 COP)
},
{
  id: 39,
  sku: "TOUR-010",
  name: "Totumo Volcano (Privado)",
  category: "tours",
  subcategory: "wellness",
  price_cop: 1500000,        // vehículo hasta 8 pax
  priceUnit: "per group",
  image: "https://images.unsplash.com/photo-1509622902031-cadebe3e3881?w=1280&q=80",
  description: {
    es: "Baño de lodo medicinal dentro del volcán + tiempo en beach club.",
    en: "Medicinal mud bath inside the volcano + beach club time."
  },
  capacity: { min: 1, max: 8 },
  schedule: "Todos los días",
  duration: "4 hours",
  location: "Volcán del Totumo",
  highlights: ["Transporte privado ida/vuelta", "Guía personalizado"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 24 h",
  menuUrl: "",
  mapsUrl: "",
  // Para 17 pax: $1.740.000 COP
},
{
  id: 40,
  sku: "TOUR-011",
  name: "City Tour (Privado)",
  category: "tours",
  subcategory: "city",
  price_cop: 1300000,        // vehículo hasta 8 pax
  priceUnit: "per group",
  image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1280&q=80",
  description: {
    es: "La Popa, Castillo San Felipe, Bóvedas + caminata por el centro.",
    en: "La Popa, San Felipe Fortress, Las Bóvedas + old town walk."
  },
  capacity: { min: 1, max: 8 },
  schedule: "Todos los días",
  duration: "4 hours (aprox.)",
  location: "Cartagena",
  highlights: ["Transporte privado", "Entradas incluidas", "Guía en ES/EN"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 24 h",
  menuUrl: "",
  mapsUrl: "",
  // Para 17 pax: $1.500.000 COP
},

/* ====== ACTIVIDADES / SERVICIOS (del PDF) ====== */
{
  id: 41,
  sku: "SERV-005",
  name: "Clases de Salsa",
  category: "services",
  subcategory: "class",
  price_cop: 100000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=1280&q=80",
  description: {
    es: "Clase privada de salsa por hora con instructor local.",
    en: "Private salsa lesson per hour with local instructor."
  },
  capacity: { min: 1, max: 10 },
  schedule: "Según agenda",
  duration: "1 hour",
  location: "Cartagena",
  highlights: ["Privado", "Flexible"],
  deposit: "No requiere",
  cancellation: "—",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 42,
  sku: "TOUR-012",
  name: "ATV Cartagena City",
  category: "tours",
  subcategory: "adventure",
  price_cop: 495000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1280&q=80",
  description: {
    es: "Ruta guiada en cuatrimoto por Cartagena y alrededores.",
    en: "Guided ATV route around Cartagena and surroundings."
  },
  capacity: { min: 1, max: 12 },
  schedule: "Según agenda",
  duration: "2.5 hours",
  location: "Cartagena",
  highlights: ["Guía", "Equipo y casco incluidos"],
  deposit: "No requiere",
  cancellation: "—",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 43,
  sku: "TOUR-013",
  name: "Scuba Diving (Certified)",
  category: "tours",
  subcategory: "water",
  price_cop: 748000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1280&q=80",
  description: {
    es: "Buceo para certificados en islas cercanas a Cartagena.",
    en: "Certified diver trip to islands near Cartagena."
  },
  capacity: { min: 1, max: 12 },
  schedule: "Según agenda",
  duration: "Medio día",
  location: "Islas cercanas a Cartagena",
  highlights: ["Equipo incluido", "Acompañamiento profesional"],
  deposit: "No requiere",
  cancellation: "—",
  menuUrl: "",
  mapsUrl: ""
},
/* ============ RESTAURANTS / BARS / NIGHTLIFE (7) ============ */
{
  id: 44,
  sku: "REST-044",
  name: "Rabo de Pez",
  category: "restaurants",
  subcategory: "seafood",
  price_cop: 240000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1280&q=80",
  description: {
    es: "Mar y huerta en platos contemporáneos con pesca del día.",
    en: "Sea-to-table contemporary dishes with daily catch."
  },
  capacity: { min: 2, max: 20 },
  schedule: "Mon–Sun 12 pm–11 pm",
  duration: "2–3 hours",
  location: "Historic Center",
  highlights: ["Pesca del día", "Cocina abierta"],
  deposit: "Según grupo",
  cancellation: "Cancela hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 45,
  sku: "REST-045",
  name: "Nía Bakery",
  category: "restaurants",
  subcategory: "contemporary",
  price_cop: 70000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=1280&q=80",
  description: {
    es: "Panadería artesanal y brunch todo el día.",
    en: "Artisanal bakery and all-day brunch."
  },
  capacity: { min: 1, max: 30 },
  schedule: "Daily 7 am–6 pm",
  duration: "1–2 hours",
  location: "San Diego",
  highlights: ["Masa madre", "Café de origen"],
  deposit: "No requiere",
  cancellation: "Flexible",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 46,
  sku: "REST-046",
  name: "Pascal",
  category: "restaurants",
  subcategory: "contemporary",
  price_cop: 180000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=1280&q=80",
  description: {
    es: "Cocina de mercado con influencias internacionales.",
    en: "Market-driven cuisine with international influences."
  },
  capacity: { min: 2, max: 24 },
  schedule: "Tue–Sun 12 pm–11 pm",
  duration: "2 hours",
  location: "Historic Center",
  highlights: ["Ingredientes locales", "Carta de vinos"],
  deposit: "Puede requerir garantía",
  cancellation: "Cancela hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 47,
  sku: "REST-047",
  name: "Época Café",
  category: "restaurants",
  subcategory: "contemporary",
  price_cop: 65000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1445077100181-a33e9ac94db0?w=1280&q=80",
  description: {
    es: "Café de especialidad, brunch y repostería casera.",
    en: "Specialty coffee, brunch and homemade pastries."
  },
  capacity: { min: 1, max: 40 },
  schedule: "Daily 7 am–7 pm",
  duration: "1–2 hours",
  location: "Historic Center (varias sedes)",
  highlights: ["Café de finca", "Métodos de filtrado"],
  deposit: "No requiere",
  cancellation: "Flexible",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 48,
  sku: "BAR-048",
  name: "El Pasquín",
  category: "bars",
  subcategory: "cocktails",
  price_cop: 65000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1527161153330-9d7a9d0aa3c1?w=1280&q=80",
  description: {
    es: "Coctelería de autor estilo speakeasy en Getsemaní.",
    en: "Speakeasy-style craft cocktails in Getsemaní."
  },
  capacity: { min: 2, max: 60 },
  schedule: "Wed–Sun 6 pm–2 am",
  duration: "2–3 hours",
  location: "Getsemaní",
  highlights: ["Cocteles signature", "Ambiente íntimo"],
  deposit: "No requiere",
  cancellation: "Orden de llegada",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 49,
  sku: "NIGHT-049",
  name: "Monkey Bar",
  category: "nightlife",
  subcategory: "rooftop",
  price_cop: 100000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1280&q=80",
  description: {
    es: "Rooftop con DJs de electrónica y vista a la ciudad amurallada.",
    en: "Rooftop with electronic DJ sets and Old City views."
  },
  capacity: { min: 2, max: 180 },
  schedule: "Thu–Sun 7 pm–3 am",
  duration: "Hasta tarde",
  location: "Historic Center",
  highlights: ["DJs", "Vista skyline"],
  deposit: "Según grupo",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 50,
  sku: "NIGHT-050",
  name: "Casa Cruxada",
  category: "nightlife",
  subcategory: "club",
  price_cop: 150000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1280&q=80",
  description: {
    es: "Casa cultural con restaurante, bar y fiestas temáticas.",
    en: "Cultural house with restaurant, bar and themed parties."
  },
  capacity: { min: 2, max: 250 },
  schedule: "Thu–Sun 7 pm–3 am",
  duration: "Hasta tarde",
  location: "Getsemaní",
  highlights: ["Line-ups invitados", "Patio central"],
  deposit: "Puede requerir garantía",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},

/* ===================== TOURS & EXPERIENCES (9) ===================== */
{
  id: 51,
  sku: "TOUR-051",
  name: "Cooking Class Cartagena",
  category: "tours",
  subcategory: "culinary",
  price_cop: 260000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=1280&q=80",
  description: {
    es: "Clase práctica de cocina costeña con mercado y degustación.",
    en: "Hands-on coastal cooking class with market visit and tasting."
  },
  capacity: { min: 2, max: 12 },
  schedule: "Daily 10:00 am & 4:00 pm",
  duration: "3 hours",
  location: "Getsemaní",
  highlights: ["Instructor local", "Recetario digital"],
  deposit: "No requiere",
  cancellation: "Cancela hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 52,
  sku: "TOUR-052",
  name: "Rum Tasting Experience",
  category: "tours",
  subcategory: "tasting",
  price_cop: 220000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=1280&q=80",
  description: {
    es: "Cata guiada de rones colombianos y caribeños premium.",
    en: "Guided tasting of premium Colombian & Caribbean rums."
  },
  capacity: { min: 2, max: 16 },
  schedule: "Daily 6:00 pm",
  duration: "1.5–2 hours",
  location: "Historic Center",
  highlights: ["4–6 etiquetas", "Maridaje ligero"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 53,
  sku: "TOUR-053",
  name: "Coffee Tasting / Barista Lab",
  category: "tours",
  subcategory: "tasting",
  price_cop: 160000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1280&q=80",
  description: {
    es: "Degustación de cafés de origen y laboratorio barista.",
    en: "Origin coffee tasting and barista lab session."
  },
  capacity: { min: 2, max: 12 },
  schedule: "Daily 10:00 am & 3:00 pm",
  duration: "1.5 hours",
  location: "Historic Center",
  highlights: ["Métodos filtrados", "Calibración sensorial"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 54,
  sku: "TOUR-054",
  name: "Cigar Rolling Experience",
  category: "tours",
  subcategory: "workshop",
  price_cop: 240000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1584448097769-9b7f6a1ebf58?w=1280&q=80",
  description: {
    es: "Taller guiado de torcido de cigarros con maestro tabaquero.",
    en: "Guided cigar-rolling workshop with master torcedor."
  },
  capacity: { min: 2, max: 14 },
  schedule: "Mon–Sat 4:00 pm",
  duration: "1.5 hours",
  location: "Getsemaní",
  highlights: ["Materiales incluidos", "1 puro por persona"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 55,
  sku: "TOUR-055",
  name: "Yoga Session at the Villa",
  category: "tours",
  subcategory: "wellness",
  price_cop: 180000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1280&q=80",
  description: {
    es: "Clase privada de yoga con instruct@ certificado en tu alojamiento.",
    en: "Private yoga session with certified instructor at your villa."
  },
  capacity: { min: 1, max: 12 },
  schedule: "Según agenda",
  duration: "60–75 min",
  location: "Tu villa",
  highlights: ["Tapetes incluidos", "Todos los niveles"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 56,
  sku: "TOUR-056",
  name: "Golf Day – Cartagena Golf Club",
  category: "tours",
  subcategory: "sports",
  price_cop: 520000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1280&q=80",
  description: {
    es: "Día de golf con green fee y carro compartido.",
    en: "Golf day including green fee and shared cart."
  },
  capacity: { min: 1, max: 12 },
  schedule: "Tue–Sun (mañana)",
  duration: "4–5 hours",
  location: "Cartagena Golf Club",
  highlights: ["18 hoyos", "Traslado opcional"],
  deposit: "Puede requerir garantía",
  cancellation: "Hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 57,
  sku: "TOUR-057",
  name: "Paddle Boarding in the Bay",
  category: "tours",
  subcategory: "water",
  price_cop: 180000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1468575570524-1d9b8c3a76e9?w=1280&q=80",
  description: {
    es: "Recorrido guiado en paddle por la bahía al atardecer.",
    en: "Guided sunset paddle board tour across the bay."
  },
  capacity: { min: 2, max: 12 },
  schedule: "Daily 4:30 pm",
  duration: "1.5–2 hours",
  location: "Bahía de Cartagena",
  highlights: ["Equipo y chaleco", "Guía bilingüe"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 58,
  sku: "TOUR-058",
  name: "Party Bus / Chiva VIP",
  category: "tours",
  subcategory: "night",
  price_cop: 160000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1568831139280-39e8e2b2e3c0?w=1280&q=80",
  description: {
    es: "Chiva rumbera con animación y paradas en bares.",
    en: "Party bus with host, music and bar stops."
  },
  capacity: { min: 8, max: 40 },
  schedule: "Daily 8:00 pm",
  duration: "3 hours",
  location: "Historic Center & Bocagrande",
  highlights: ["Música y animación", "Open bar opcional"],
  deposit: "No requiere",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 59,
  sku: "TOUR-059",
  name: "San Basilio de Palenque Tour",
  category: "tours",
  subcategory: "cultural",
  price_cop: 320000,
  priceUnit: "per person",
  image: "https://images.unsplash.com/photo-1542372147193-a7aca54189cd?w=1280&q=80",
  description: {
    es: "Visita cultural guiada al primer pueblo libre de América.",
    en: "Guided cultural visit to the first free town in the Americas."
  },
  capacity: { min: 2, max: 16 },
  schedule: "Daily 8:00 am",
  duration: "5–6 hours",
  location: "San Basilio de Palenque",
  highlights: ["Historia y música", "Almuerzo local opcional"],
  deposit: "No requiere",
  cancellation: "Hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},

/* ========================= SERVICES (4) ========================= */
{
  id: 60,
  sku: "SERV-060",
  name: "Bartender Service",
  category: "services",
  subcategory: "events",
  price_cop: 450000,
  priceUnit: "per group",
  image: "https://images.unsplash.com/photo-1514361892635-eae31a577839?w=1280&q=80",
  description: {
    es: "Bartender profesional en tu villa con cristalería básica.",
    en: "Professional bartender at your villa with basic glassware."
  },
  capacity: { min: 1, max: 20 },
  schedule: "Según agenda",
  duration: "3 hours (extensible)",
  location: "Tu villa",
  highlights: ["Coctelería clásica y de autor", "Compras opcionales"],
  deposit: "50% anticipo",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 61,
  sku: "SERV-061",
  name: "DJ Service",
  category: "services",
  subcategory: "events",
  price_cop: 1200000,
  priceUnit: "per group",
  image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1280&q=80",
  description: {
    es: "DJ con cabina básica y playlist personalizada.",
    en: "DJ with basic booth and custom playlist."
  },
  capacity: { min: 1, max: 100 },
  schedule: "Según agenda",
  duration: "3–4 hours",
  location: "Tu villa / venue",
  highlights: ["Sonido base", "Géneros a elección"],
  deposit: "50% anticipo",
  cancellation: "Hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 62,
  sku: "SERV-062",
  name: "Bodyguard / Security",
  category: "services",
  subcategory: "security",
  price_cop: 800000,
  priceUnit: "per group",
  image: "https://images.unsplash.com/photo-1547447134-cd3f5c7160b0?w=1280&q=80",
  description: {
    es: "Seguridad privada bilingüe por horas o turnos.",
    en: "Bilingual private security by hour or shift."
  },
  capacity: { min: 1, max: 8 },
  schedule: "24/7",
  duration: "4–8 hours",
  location: "Cartagena",
  highlights: ["Operadores certificados", "Vehículo opcional"],
  deposit: "50% anticipo",
  cancellation: "Hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 63,
  sku: "SERV-063",
  name: "Decoration & Event Setup",
  category: "services",
  subcategory: "events",
  price_cop: 950000,
  priceUnit: "per group",
  image: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1280&q=80",
  description: {
    es: "Montaje decorativo para celebraciones privadas en villa.",
    en: "Decor and setup for private celebrations at the villa."
  },
  capacity: { min: 1, max: 20 },
  schedule: "Según agenda",
  duration: "2–4 hours (montaje)",
  location: "Tu villa",
  highlights: ["Flores, globos y props", "Temáticas personalizadas"],
  deposit: "50% anticipo",
  cancellation: "Hasta 48 h",
  menuUrl: "",
  mapsUrl: ""
},
{
  id: 64,
  sku: "BEACH-005",
  name: "Atolón Beach Club",
  category: "beach-clubs",
  subcategory: "tierrabomba",
  price_cop: 0, // TODO: definir p/p
  priceUnit: "day pass",
  image: "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1280&q=80",
  description: {
    es: "Hidden gem en Tierra Bomba con snorkel y boat tours; ambiente relajado y restaurante de playa.",
    en: "Hidden gem in Tierra Bomba with snorkeling and boat tours; chilled vibe and beach restaurant."
  },
  capacity: { min: 1, max: 40 },
  schedule: "Daily 9am–5pm",
  duration: "Full day",
  location: "Tierra Bomba",
  highlights: ["Snorkel", "Boat tours", "Restaurante de playa"],
  deposit: "100% pago previo",
  cancellation: "Cancela hasta 24 h",
  menuUrl: "",
  mapsUrl: ""
}











];

/* =========================================
   5) Listas de filtros (categorías, estilos)
========================================== */
const categories = [
  { id: "all" },
  { id: "restaurants" },
  { id: "bars" },
  { id: "beach-clubs" },
  { id: "tours" },
  { id: "nightlife" },
  { id: "chef" },
  { id: "services" },
  { id: "transportation" },
];

// Estilos de restaurantes con etiquetas bilingües
const restaurantStyles = [
  { id: "fine-dining", label: { es: "Fine dining", en: "Fine dining" } },
  { id: "caribbean", label: { es: "Caribeño", en: "Caribbean" } },
  { id: "rooftop", label: { es: "Rooftop", en: "Rooftop" } },
  { id: "japanese", label: { es: "Japonés / Nikkei", en: "Japanese / Nikkei" } },
  { id: "seafood", label: { es: "Mariscos", en: "Seafood" } },
  { id: "peruvian", label: { es: "Peruano", en: "Peruvian" } },
  { id: "contemporary", label: { es: "Contemporáneo", en: "Contemporary" } },
  { id: "classic", label: { es: "Clásico", en: "Classic" } },
];

const priceRanges = [
  {
    id: "all",
    labelEs: "Todos los precios",
    labelEn: "All prices",
  },
  {
    id: "budget",
    labelEs: "Económico $",
    labelEn: "Budget $",
    levels: ["$"],
  },
  {
    id: "mid",
    labelEs: "Medio $$",
    labelEn: "Mid $$",
    levels: ["$$"],
  },
  {
    id: "premium",
    labelEs: "Alto $$$",
    labelEn: "High $$$",
    levels: ["$$$"],
  },
];

const btn = {
  primary: "inline-flex items-center justify-center rounded-lg px-5 py-2.5 font-medium border border-neutral-900 text-neutral-900 bg-white hover:bg-neutral-900 hover:text-white active:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900/40 disabled:opacity-50 disabled:pointer-events-none transition-colors",
  filled:  "inline-flex items-center justify-center rounded-lg px-6 py-2 font-medium bg-neutral-900 text-white hover:bg-neutral-950 active:bg-black focus:outline-none focus:ring-2 focus:ring-neutral-900/40 disabled:opacity-50 disabled:pointer-events-none transition-colors",
  icon:    "p-2 rounded-lg border border-neutral-900 text-neutral-900 bg-white hover:bg-neutral-900 hover:text-white active:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900/40 transition-colors",
  chipOn:  "px-3 py-1 rounded-full text-sm border border-neutral-900 bg-neutral-900 text-white hover:bg-black",
  chipOff: "px-3 py-1 rounded-full text-sm border border-neutral-300 text-neutral-800 bg-white hover:bg-neutral-100",
  chipXsOn:  "px-3 py-1 rounded-full text-xs border border-neutral-900 bg-neutral-900 text-white hover:bg-black",
  chipXsOff: "px-3 py-1 rounded-full text-xs border border-neutral-300 text-neutral-800 bg-white hover:bg-neutral-100",
  linkBtn: "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-900 text-neutral-900 bg-white hover:bg-neutral-900 hover:text-white active:bg-neutral-950 transition-colors"
};
/* ================================
   6) Componente principal
================================== */

const CATEGORY_FALLBACKS = {
  restaurants:
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1280&q=80",
  bars:
    "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=1280&q=80",
  "beach-clubs":
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=1280&q=80",
  tours:
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1280&q=80",
  nightlife:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1280&q=80",
  services:
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1280&q=80",
  transportation:
    "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1280&q=80",
  default:
    "https://images.unsplash.com/photo-1526779259212-939e64788e3c?w=1280&q=80",
};

function safeImg(url, category = "default") {
  if (url && String(url).startsWith("http")) return url;
  return CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS.default;
}

// Extract Google Drive file ID from any Drive URL format
function driveId(src) {
  return (
    src.match(/[?&]id=([^&/]+)/)?.[1] ||
    src.match(/\/d\/([^?&/]+)/)?.[1] ||
    null
  );
}

// Progressive fallback for Drive images:
// Initial: uc?export=view → att0: lh3 → att1: thumbnail → fallback
function driveOnError(e, category = "default") {
  const src  = e.target.src || "";
  const id   = driveId(src);
  const att  = parseInt(e.target.dataset.driveAttempt || "0", 10);

  if (id && att === 0) {
    e.target.dataset.driveAttempt = "1";
    e.target.src = `https://lh3.googleusercontent.com/d/${id}`;
  } else if (id && att === 1) {
    e.target.dataset.driveAttempt = "2";
    e.target.src = `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
  } else {
    e.target.dataset.driveAttempt = "done";
    e.target.src = CATEGORY_FALLBACKS[category] || CATEGORY_FALLBACKS.default;
  }
}
const StepIndicator = ({ step, lang }) => {
  const isQuiz = step === "quiz";
  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between text-xs text-neutral-500">
        <span>
          {lang === "es"
            ? isQuiz ? "Paso 1 de 2" : "Paso 2 de 2"
            : isQuiz ? "Step 1 of 2" : "Step 2 of 2"}
        </span>

        <div className="flex items-center gap-2">
          <span className={`w-10 h-1 rounded-full ${isQuiz ? "bg-neutral-900" : "bg-neutral-200"}`} />
          <span className={`w-10 h-1 rounded-full ${isQuiz ? "bg-neutral-200" : "bg-neutral-900"}`} />
        </div>
      </div>
    </div>
  );
};

const normalizeCapacity = (raw) => {
  if (raw && typeof raw === "object") return raw;

  const str = String(raw ?? "").trim();
  if (!str) return { min: 1, max: 1 };

  const parts = str.split(/[-–,]/).map((x) => Number(x.trim()));
  const min = Number.isFinite(parts[0]) ? parts[0] : 1;
  const max = Number.isFinite(parts[1]) ? parts[1] : min;

  return { min, max };
};
export default function TwoTravelCatalog() {
  const [step, setStep] = useState("quiz"); // "quiz" | "catalog"
  const [fadeIn, setFadeIn] = useState(false);

  const [lang, setLang] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const l = p.get("lang");
    return l === "en" || l === "es" ? l : "en";
  });
  // Currency defaults to USD when language is English, COP when Spanish
  const [currency, setCurrency] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    const l = p.get("lang");
    return (l === "es") ? "COP" : "USD";
  });

  // Auto-switch currency when language changes (unless user manually set it)
  const [currencyManuallySet, setCurrencyManuallySet] = useState(false);
  useEffect(() => {
    if (!currencyManuallySet) setCurrency(lang === "es" ? "COP" : "USD");
  }, [lang]);

  // ── Live exchange rate: tasa oficial COP/USD - 2% ──────────────
  // Frankfurter is free, no key needed, updates daily from ECB data.
  // We apply -2% so quoted USD prices have a small buffer above market.
  // Example: official 4100 → we use 4018 → $100k COP = $24.89 USD
  const [fxRate, setFxRate] = useState(FX_FALLBACK);
  useEffect(() => {
    fetch("https://api.frankfurter.app/latest?from=USD&to=COP")
      .then(r => r.json())
      .then(data => {
        const official = data?.rates?.COP;
        if (official && official > 500) {
          // official rate minus 2% = divide by smaller number = slightly higher USD
          setFxRate(Math.round(official * 0.98));
        }
      })
      .catch(() => {/* silently keep fallback */});
  }, []);

  const t = i18n[lang];
    // 🔹 Estado que se alimenta del Sheet
  const [services, setServices] = useState([]);

  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState(null);
  // Normaliza categoría que viene del Sheet

const normalizeCategory = (raw) => {
  const v = (raw || "").toString().trim().toLowerCase();

  // Exact matches first (fastest path, catches most Sheet values)
  const EXACT = {
    restaurant: "restaurants", restaurants: "restaurants",
    restaurante: "restaurants", restaurantes: "restaurants",
    food: "restaurants", comida: "restaurants",
    bar: "bars", bars: "bars",
    "beach club": "beach-clubs", "beach clubs": "beach-clubs",
    "beach-club": "beach-clubs", "beach-clubs": "beach-clubs",
    playa: "beach-clubs",
    tour: "tours", tours: "tours", actividad: "tours", activity: "tours",
    nightlife: "nightlife", noche: "nightlife", discoteca: "nightlife",
    transport: "transportation", transportation: "transportation",
    transporte: "transportation", transfer: "transportation",
    traslado: "transportation",
    services: "services", servicio: "services", servicios: "services",
  };
  if (EXACT[v]) return EXACT[v];

  // Substring fallback — FOOD first so "restaurante de mariscos" never mis-fires as transport
  if (/restauran|comida|food|dining/.test(v))             return "restaurants";
  if (/\bbar\b/.test(v))                                  return "bars";
  if (/beach|playa/.test(v))                              return "beach-clubs";
  if (/\btour\b|activid|activit/.test(v))                 return "tours";
  if (/night|noche|discoteca|nightlife/.test(v))          return "nightlife";
  if (/transport|transfer|traslado|van\b|suv\b/.test(v))  return "transportation";
  if (/serv/.test(v))                                     return "services";

  return "services";
};

const normalizePriceUnit = (raw) => {
  const v = (raw || "").toString().trim().toLowerCase();

  if (!v) return "per person";

  // Variantes comunes
  if (v.includes("person") || v.includes("persona") || v === "pp") return "per person";
  if (v.includes("day") || v.includes("pasad") || v.includes("day pass")) return "day pass";
  if (v.includes("group") || v.includes("grupo") || v.includes("private")) return "per group";

  // Si ya viene perfecto
  if (v === "per person" || v === "day pass" || v === "per group") return v;

  // fallback
  return "per person";
};

// Categorías que usan $, $$, $$$
const categoriesWithPriceLevel = [
  "restaurants",
  "bars",
  "beach-clubs",
  "nightlife",
];
// Devuelve $, $$ o $$$ para cualquier servicio
const getServicePriceLevel = (s, clientType = 1) => {
  // si ya viene definido desde el Sheet, úsalo
  if (s.priceLevel) return s.priceLevel;

  // si no viene, calcúlalo automáticamente con el precio efectivo
  const effectivePrice = getEffectivePriceCop(s, clientType);
  return priceLevelFromCop(effectivePrice);
};


// si no viene del Sheet, calculamos según price_cop
const normalizePriceLevelValue = (raw) => {
  const v = (raw || "").toString().trim().toLowerCase();
  if (!v) return null;

  if (v === "$" || v === "$$" || v === "$$$") return v;

  if (v === "budget") return "$";
  if (v === "mid") return "$$";
  if (v === "premium" || v === "high") return "$$$";

  const n = Number(v);
  if (n === 1) return "$";
  if (n === 2) return "$$";
  if (n === 3) return "$$$";

  return null;
};
const priceLevelFromCop = (cop) => {
  const n = Number(cop || 0);
  if (!n || n <= 0) return null;

  // Puedes ajustar estos límites como quieras
  if (n < 200000) return "$";      // ≤ 200k
  if (n <= 500000) return "$$";    // 200k–500k
  return "$$$";                    // ≥ 500k
};
const getEffectivePriceCop = (service, clientType = 1) => {
  const tier1 = Number(service.price_tier_1 || 0);
  const tier2 = Number(service.price_tier_2 || 0);
  const base = Number(service.price_cop || 0);

  if (clientType === 2 && tier2 > 0) return tier2;
  if (clientType === 1 && tier1 > 0) return tier1;

  if (tier1 > 0) return tier1;
  if (tier2 > 0) return tier2;
  return base;
};

const urlParams = new URLSearchParams(window.location.search);
const currentClientType = Number(urlParams.get("clientType") || 1);

useEffect(() => {
    setFadeIn(true);
  }, []);
useEffect(() => {
  setIsLoadingServices(true);

  // ✅ helper fuera del map (más limpio)
  const normalizeCop = (raw) => {
    if (raw == null) return 0;
    if (typeof raw === "number") return isNaN(raw) ? 0 : raw;

    const str = String(raw).trim();

    // soporta "200.000", "$200,000", "COP 200000", etc.
    const digits = str.replace(/[^\d]/g, "");
    const n = Number(digits);
    return isNaN(n) ? 0 : n;
  };

  fetchServicesFromSheet()
  .then((rows) => {
    const normalized = (rows || []).map((s, idx) => {
      // s is already processed by mapRowToService — s.images exists, s["5"] does not
      const rawPriceLevel =
        s.priceLevel ?? s.price_level ?? s.nivel_precio;

      const rawPriceCop =
        s.price_cop ?? s.priceCop ?? s.precio_cop ?? s.price;

      const priceCop = normalizeCop(rawPriceCop);

      const levelFromSheet = normalizePriceLevelValue(rawPriceLevel);

      const rawUnit =
        s.priceUnit ??
        s.price_unit ??
        s.unidad_precio ??
        s["Price Unit"] ??
        s["price unit"] ??
        s["Unidad Precio"];

      return {
        ...s,
        id: `row-${idx}`,
        name: String(s.name ?? s.Nombre ?? s.title ?? "").trim(),
        // Keep raw URL here; call safeImg(url, category) at render-time so each
        // category gets its own themed fallback image if the URL is missing.
        image: String(s.image ?? s.img ?? "").trim(),
        category: normalizeCategory(s.category || s.Category || s.categoria),
        subcategory: String(
          s.subcategory ?? s.sub_category ?? s.estilo ?? ""
        )
          .trim()
          .toLowerCase(),

        priceUnit: normalizePriceUnit(rawUnit),
        images: s.images || [],    // already processed by mapRowToService
        price_cop: priceCop,
        priceLevel: levelFromSheet ?? null,

        description:
          typeof s.description === "string"
            ? { es: s.description, en: s.description }
            : s.description ?? { es: "", en: "" },

        highlights: Array.isArray(s.highlights)
  ? s.highlights
  : String(s.highlights ?? "")
      .split(/,|\n/)
      .map((x) => x.trim())
      .filter(Boolean),

        capacity: normalizeCapacity(s.capacity ?? s.Capacity ?? s.capacidad),
        duration: String(s.duration ?? ""),
        location: String(s.location ?? ""),
        schedule: String(s.schedule ?? ""),

        menuUrl: String(s.menuUrl ?? s.menuurl ?? s.menu_url ?? s["menu url"] ?? ""),
        mapsUrl: String(s.mapsUrl ?? s.mapsurl ?? s.maps_url ?? s["maps url"] ?? ""),
      };
    });

    setServices(normalized);
    setServicesError(null);
  })
  .catch((err) => {
    console.error("Error leyendo Sheet:", err);
    setServicesError("No se pudo leer el catálogo. Mostrando versión offline.");
    setServices(servicesData);
  })
  .finally(() => setIsLoadingServices(false));
}, []);



// ⭐ CHIP + INFO (versión pequeña, elegante y bilingüe)
const PriceLevelChip = ({ service, lang, clientType = 1 }) => {
  if (!categoriesWithPriceLevel.includes(service.category)) return null;

  const level = getServicePriceLevel(service, clientType);
  if (!level) return null;

  const explanations = {
    es: {
      title: "Rango de precio",
      scale: "$ = económico · $$ = medio · $$$ = alto",
      note: "Los precios exactos se confirman con Concierge.",
    },
    en: {
      title: "Price range",
      scale: "$ = budget · $$ = mid · $$$ = high",
      note: "Exact prices are confirmed with Concierge.",
    },
  };

  



  return (
    <div className="relative inline-flex items-center mt-1 group">
      {/* Badge con $, $$, $$$ */}
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-300 text-neutral-800 bg-white">
        {level}
      </span>

      {/* Botón info */}
      <button
        type="button"
        className="ml-1 flex items-center justify-center w-5 h-5 text-[13px] leading-none text-gray-500 hover:text-gray-700 rounded-full border border-gray-300 bg-white"
        onClick={(e) => e.stopPropagation()}
        aria-label={
          lang === "es"
            ? "Información sobre el rango de precio"
            : "Information about the price range"
        }
      >
        i
      </button>

      {/* Tooltip */}
      <div
        className="absolute left-0 bottom-8 w-64 p-3 rounded-lg text-[11px] bg-black text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg"
      >
        <p className="font-semibold mb-1">
          {lang === "es" ? "Indicador de precio" : "Price indicator"}
        </p>
        <p className="mb-2">
          {lang === "es"
            ? "$ = económico · $$ = medio · $$$ = alto"
            : "$ = budget · $$ = mid · $$$ = high"}
        </p>
        <p className="text-[10px] text-gray-200">
          {lang === "es"
            ? "Los precios exactos de restaurantes, bares y nightlife se confirman con Concierge."
            : "Exact prices for restaurants, bars and nightlife are confirmed with Concierge."}
        </p>
      </div>
    </div>
  );
};



  /* ---------- helpers ---------- */
  
  const convertPrice = (cop) =>
    currency === "USD" ? Math.round(cop / fxRate) : cop;

  const categoryHasVisiblePrice = (category) =>
  category === "tours" ||
  category === "services" ||
  category === "transportation" ||
  category === "chef";


  const hasPrice = (cop) => cop && cop > 0;
  



  const formatPrice = (value) =>
    new Intl.NumberFormat(lang === "es" ? "es-CO" : "en-US", {
      style: "currency",
      currency: currency === "USD" ? "USD" : "COP",
      maximumFractionDigits: 0,
    }).format(value);

  const unitLabel = (unit) => {
    if (unit === "per person") return t.perPerson;
    if (unit === "day pass") return t.dayPass;
    if (unit === "per group") return t.perGroup;
    return unit;
  };

  /* ---------- estados de filtros ---------- */
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState("all");

  const [imgIndex, setImgIndex] = useState(0);
  const [selectedService, setSelectedService] = useState(null);

  const gallery = selectedService
    ? [selectedService.image, ...(selectedService.images || [])].filter(Boolean)
    : [];

  const [showKickoff, setShowKickoff] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [kickoffLoaded, setKickoffLoaded] = useState(false);
  const [tripName, setTripName] = useState("");
  const [guestContact, setGuestContact] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");

  const [kickoffSent, setKickoffSent] = useState(false);
    // ✅ Step: quiz -> catalog -> kickoff (tú ya tienes kickoff modal)



  // ✅ Respuestas del quiz (mínimas para arrancar)
  const [quiz, setQuiz] = useState({
    vibes: [],       // array — multiple vibes allowed e.g. ["party","adventure"]
    budget: "",      // low | mid | high
    kids: "no",      // "yes" | "no"
    groupSize: "",   // number of people
    cuisines: [],    // array of cuisine ids (multi-select)
    interests: [],   // array strings
    groupNotes: "",  // open text: "What else should we know?"
  });

  

  /* ---------- favoritos / "carrito" ---------- */
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [heartBump, setHeartBump] = useState(false); // 💗 animación icono
  const [cartToast, setCartToast] = useState(true);   // popup "cuando termines..." — visible desde que entra

 const cartTotalCOP = useMemo(
  () =>
    cart
      .filter(
        (item) =>
          item.category === "tours" ||
          item.category === "services" ||
          item.category === "transportation"
      )
      .reduce((sum, item) => sum + (item.price_cop || 0), 0),
  [cart]
);



  // Total convertido a la moneda seleccionada
  const cartTotalConverted = useMemo(
    () => convertPrice(cartTotalCOP),
    [cartTotalCOP, currency]
  );
  

  // Resumen en texto para Concierge
  const conciergeSummary = useMemo(() => {
  if (!cart.length) return "";

  return cart
    .map((item, index) => {
      const catLabel = i18n[lang][item.category] || item.category;

      let priceLine = "";
      if (categoryHasVisiblePrice(item.category) && hasPrice(item.price_cop)) {
        const price = formatPrice(convertPrice(item.price_cop));
        priceLine = `${price} • ${unitLabel(item.priceUnit)}`;
      } else {
        // Solo mostramos $, $$ o $$$ para restaurantes, bares, beach clubs, nightlife
        const level = getServicePriceLevel(item, item.clientType || currentClientType);
        priceLine = level ? `${level}` : "";
      }

      const notesPart = item.notes ? `\n   ${t.notes}: ${item.notes}` : "";

      return `${index + 1}. ${item.name} (${catLabel})${
        priceLine ? `\n${priceLine}` : ""
      }${notesPart}`;
    })
    .join("\n\n");
}, [cart, lang, currency]);




  
  /* ---------- filtros ---------- */
  // Normalise subcategory strings coming from the sheet so they always match
  // the restaurantStyles IDs (which use dashes, e.g. "fine-dining").
  const normalizeSubcategory = (raw) =>
    String(raw || "").trim().toLowerCase().replace(/\s+/g, "-");

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      // s.category is already normalised when loaded from sheet (line ~2056)
      const serviceCategory = s.category || "services";

      const catOK =
        selectedCategory === "all" || serviceCategory === selectedCategory;

      // Style sub-filter: only relevant when "restaurants" tab is active
      // Normalise both sides so "fine dining" == "fine-dining"
      const stylesOK =
        selectedCategory !== "restaurants" || !selectedStyle
          ? true
          : normalizeSubcategory(s.subcategory) === selectedStyle;

      const q = searchTerm.trim().toLowerCase();
      const searchOK =
        !q ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.description?.es || "").toLowerCase().includes(q) ||
        (s.description?.en || "").toLowerCase().includes(q) ||
        (s.location || "").toLowerCase().includes(q) ||
        (s.subcategory || "").toLowerCase().includes(q);

      const range = priceRanges.find((r) => r.id === priceRange);
      let priceOK = true;

      if (range && range.id !== "all") {
        if (categoriesWithPriceLevel.includes(serviceCategory)) {
          const lvl = getServicePriceLevel(s, currentClientType);
          if (!lvl || !range.levels?.includes(lvl)) priceOK = false;
        }
        // For tours / transportation / services: no price-level filter applied
      }

      return catOK && stylesOK && searchOK && priceOK;
    });
  }, [services, selectedCategory, selectedStyle, searchTerm, priceRange, currentClientType]);

const vibeLabel = useMemo(() => {
  const map = {
    relax:    { es: "Relax & playa", en: "Relax & beach" },
    party:    { es: "Nightlife", en: "Nightlife" },
    romantic: { es: "Romántico", en: "Romantic" },
    family:   { es: "Familia", en: "Family" },
    adventure:{ es: "Aventura", en: "Adventure" },
  };
  if (!quiz.vibes.length) return lang === "es" ? "Tu estilo" : "Your vibe";
  return quiz.vibes.map((v) => map[v]?.[lang] || v).join(" · ");
}, [quiz.vibes, lang]);


 
 
  /* ---------- recomendados (según quiz) ---------- */
  const recommendedServices = useMemo(() => {
    // si el usuario no contestó nada, no mostramos recomendados
    const hasAnswers =
      (quiz.vibes?.length || 0) > 0 ||
      quiz.budget ||
      (quiz.cuisines?.length || 0) > 0 ||
      (quiz.interests?.length || 0) > 0 ||
      quiz.kids === "yes";

    if (!hasAnswers) return [];

    const score = (s) => {
      let pts = 0;

      const cat = s.category;
      const sub = (s.subcategory || "").toLowerCase();
      const desc = (
        (s.description?.es || "") +
        " " +
        (s.description?.en || "")
      ).toLowerCase();

      // ✅ VIBE — multiple vibes supported; each matching vibe adds points
      const vibes = quiz.vibes || [];
      if (vibes.includes("party")) {
        if (cat === "nightlife" || cat === "bars") pts += 4;
        if (cat === "beach-clubs") pts += 2;
      }
      if (vibes.includes("relax")) {
        if (cat === "beach-clubs") pts += 4;
        if (sub.includes("wellness") || sub.includes("spa")) pts += 3;
      }
      if (vibes.includes("romantic")) {
        if (cat === "restaurants") pts += 3;
        if (sub.includes("fine") || sub.includes("rooftop")) pts += 2;
        if (desc.includes("sunset")) pts += 2;
      }
      if (vibes.includes("family")) {
        if (cat === "tours" || cat === "services") pts += 2;
        if (cat === "beach-clubs") pts += 1;
      }
      if (vibes.includes("adventure")) {
        if (cat === "tours") pts += 3;
        if (sub.includes("adventure") || sub.includes("water") || sub.includes("bike")) pts += 3;
      }

      // ✅ KIDS (si hay niños, bajamos rumba/bars)
      if (quiz.kids === "yes") {
        if (cat === "nightlife" || cat === "bars") pts -= 4;
        if (cat === "tours" || cat === "services") pts += 1;
      }

      // ✅ BUDGET (usa tu función getServicePriceLevel)
      const lvl = getServicePriceLevel(s, currentClientType); // "$" | "$$" | "$$$" | null
      if (quiz.budget === "low" && lvl === "$") pts += 2;
      if (quiz.budget === "mid" && lvl === "$$") pts += 2;
      if (quiz.budget === "high" && lvl === "$$$") pts += 2;

      // ✅ Cuisines (multi-select array)
      const cuisineList = Array.isArray(quiz.cuisines) ? quiz.cuisines : [];
      for (const c of cuisineList) {
        if (desc.includes(c)) pts += 2;
        if (sub.includes(c)) pts += 2;
      }

      // ✅ Interests (mapeo rápido) — alineado con categorías del catálogo
      const interests = new Set(quiz.interests || []);
      if (interests.has("food") && cat === "restaurants") pts += 3;
      if (interests.has("beach") && cat === "beach-clubs") pts += 3;
      if (interests.has("night") && (cat === "nightlife" || cat === "bars")) pts += 3;
      // Culture → prioritize cultural tours; also history/art mentions
      if (interests.has("culture") && cat === "tours") pts += 2;
      if (interests.has("culture") && (sub.includes("cultural") || sub.includes("city") || sub.includes("histor") || desc.includes("histor") || desc.includes("cultur") || desc.includes("art") || desc.includes("museo"))) pts += 2;
      // Adventure → tours with adventure/outdoor subcategories
      if (interests.has("adventure") && cat === "tours") pts += 1;
      if (interests.has("adventure") && (sub.includes("adventure") || sub.includes("water") || sub.includes("bike") || sub.includes("sport") || desc.includes("aventura"))) pts += 2;

      return pts;
    };

    // Scored picks (max 6)
    const scored = services
      .map((s) => ({ s, pts: score(s) }))
      .filter((x) => x.pts > 0)
      .sort((a, b) => b.pts - a.pts)
      .slice(0, 6)
      .map((x) => x.s);

    // Airport / transfer always pinned at the end (max 2 transport services)
    const scoredIds = new Set(scored.map((s) => s.id));
    const transportPicks = services
      .filter((s) => s.category === "transportation" && !scoredIds.has(s.id))
      .slice(0, 2);

    return [...scored, ...transportPicks];
  }, [quiz, services]);


const selectedServiceCategory = selectedService
  ? normalizeCategory(selectedService.category)
  : "";



  
  /* ---------- lógica favoritos ---------- */
  const addToCart = (s) => {
  setCart((c) => [
    ...c,
    {
      cartId: Date.now() + Math.random(),
      id: s.id,
      name: s.name,
      category: s.category,
      subcategory: s.subcategory || "",
      image: s.image || "",
      price_cop: getEffectivePriceCop(s, currentClientType),
price_tier_1: s.price_tier_1,
price_tier_2: s.price_tier_2,
clientType: currentClientType,
      priceUnit: s.priceUnit,
      priceLevel: s.priceLevel, // ✅
      notes: "",
    },
  ]);
  setHeartBump(true);
  setTimeout(() => setHeartBump(false), 200);
  // Show "when you're done tap the heart" toast on first add
  setCartToast(true);
  setTimeout(() => setCartToast(false), 4000);
};
  const removeFromCart = (cartId) =>
    setCart((c) => c.filter((x) => x.cartId !== cartId));

  const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
const kickoffId = params.get("kickoffId");
const guestNameFromUrl = params.get("guestName") || "";
const tripNameFromUrl = params.get("tripName") || "";
const guestContactFromUrl = params.get("guestContact") || "";

const isCatalogMode = mode === "catalog";
const isQuestionnaireMode = mode === "questionnaire";
useEffect(() => {
  const run = async () => {
    if (!kickoffId) return;

    try {
      const ko = await getKickoffById(kickoffId);

      if (!ko) return;

      // ✅ Usa los campos como estén guardados en tu Sheet
      setGuestName(
  String(
    ko.guestName ||
    ko.GuestName ||
    ko.nombre ||
    guestNameFromUrl ||
    ""
  ).trim()
);

setTripName(
  String(
    ko.tripName ||
    ko.TripName ||
    ko.viaje ||
    tripNameFromUrl ||
    ""
  ).trim()
);

setGuestContact(
  String(
    ko.guestContact ||
    ko.GuestContact ||
    ko.guest_contact ||
    ko.contact ||
    ko.Contact ||
    ko.contacto ||
    ko.Contacto ||
    guestContactFromUrl ||
    ""
  ).trim()
);

if (ko.arrivalDate) setArrivalDate(String(ko.arrivalDate).trim());
if (ko.departureDate) setDepartureDate(String(ko.departureDate).trim());

      // Auto-currency based on kickoff city
      if (!currencyManuallySet) {
        const koCity = String(ko.city || "").trim().toLowerCase();
        if (koCity === "tulum") setCurrency("USD");
        else if (koCity === "cdmx" || koCity === "mexico" || koCity === "ciudad de mexico") setCurrency("MXN");
        else if (koCity === "cartagena") setCurrency("COP");
        else if (koCity === "medellin" || koCity === "medellín") setCurrency("COP");
      }

    } catch (e) {
      console.error("No pude precargar kickoff:", e);
    }
  };

  run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [kickoffId, guestNameFromUrl, tripNameFromUrl, guestContactFromUrl]);
const getKickoffById = async (id) => {
  const rows = await fetchKickoffsFromSheet();
  const all = Array.isArray(rows) ? rows : [];
  return all.find((k) => String(k.id).trim() === String(id).trim()) || null;
};

useEffect(() => {
  if (isCatalogMode) {
    setStep("catalog");
    setShowKickoff(false);
  } else if (isQuestionnaireMode) {
    setStep("quiz");
    setShowKickoff(false);
  } else {
    setStep("quiz");
    setShowKickoff(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isCatalogMode, isQuestionnaireMode]);


  const updateCartNotes = (cartId, notes) =>
    setCart((c) => (c.map((x) => (x.cartId === cartId ? { ...x, notes } : x))));

      const handleSendKickoff = async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const kickoffIdFromUrl = params.get("kickoffId");

    // ✅ si viene kickoffId, NO crees uno nuevo
    if (!kickoffIdFromUrl || !kickoffIdFromUrl.trim()) {
  alert("Falta kickoffId en la URL");
  return;
}

const idToUse = kickoffIdFromUrl.trim();

// trae kickoff actual para no perder el contacto ya guardado
const currentKickoff = await getKickoffById(idToUse);

const travifyText = conciergeSummary;

const cleanGuestName = String(guestName || "").trim();
const cleanTripName = String(tripName || "").trim();
const guestContactInputValue = document.getElementById("guestContactInput")?.value || "";
const cleanGuestContact = String(guestContactInputValue || guestContact || "").trim();

const originalGuestContact = String(
  currentKickoff?.guestContact ||
  currentKickoff?.GuestContact ||
  currentKickoff?.guest_contact ||
  currentKickoff?.contact ||
  currentKickoff?.Contact ||
  currentKickoff?.contacto ||
  currentKickoff?.Contacto ||
  guestContactFromUrl ||
  ""
).trim();

const finalGuestContact = String(
  cleanGuestContact || originalGuestContact || ""
).trim();

// Auto-generate day structure from travel dates
const calcDayMeta = (arrival, departure) => {
  if (!arrival || !departure) return undefined;
  const start = new Date(arrival);
  const end   = new Date(departure);
  const nights = Math.round((end - start) / 86400000);
  if (nights <= 0 || nights > 30) return undefined;
  return Array.from({ length: nights }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString(lang === "es" ? "es-CO" : "en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    return {
      label: lang === "es" ? `Día ${i + 1}` : `Day ${i + 1}`,
      title: dateStr,
      note: "",
    };
  });
};

const generatedDayMeta = calcDayMeta(arrivalDate, departureDate);

const payload = {
  id: idToUse,
  guestName: cleanGuestName,
  tripName: cleanTripName,
  guestContact: finalGuestContact,
  arrivalDate: arrivalDate.trim(),
  departureDate: departureDate.trim(),
  cart,
  conciergeSummary,
  lang,
  currency,
  status: "client_submitted",
  clientSubmittedAt: new Date().toISOString(),
  // Pre-fill itinerary day structure if dates provided
  ...(generatedDayMeta ? { dayMeta: generatedDayMeta } : {}),
  // Notify concierge email (handled by Apps Script backend)
  notifyEmail: currentKickoff?.assignedConciergeEmail || "",
};


console.log("SENDING PAYLOAD TO KICKOFF:", payload);
console.log("CONTACTO QUE SE ENVIA:", finalGuestContact);
console.log("PAYLOAD QUE SE ENVIA:", payload);
await updateKickoffInSheet(idToUse, payload);
console.log("Kickoff actualizado:", idToUse);

setShowKickoff(false);
setKickoffSent(true);
setStep(isCatalogMode ? "catalog" : "quiz");
setCart([]);

    
  } catch (err) {
    console.error(err);
    alert(
      lang === "es"
        ? "Hubo un problema enviando tu selección. Intenta de nuevo."
        : "There was a problem sending your selection. Please try again."
    );
  }
};

  if (kickoffSent) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="bg-white border rounded-2xl p-6 max-w-lg w-full text-center">
        <h2 className="text-xl font-bold mb-2">{t.kickoffSentTitle}</h2>
        <p className="text-sm text-gray-600 mb-4">{t.kickoffSentBody}</p>

        <button
          className={btn.filled}
          onClick={() => {
            setKickoffSent(false);
            setShowKickoff(false);
            setShowCart(false);
          }}
        >
          {lang === "es" ? "Volver al catálogo" : "Back to catalog"}
        </button>
      </div>
    </div>
  );
}



  // ✅ PASO C: Quiz antes de entrar al catálogo
  if (step === "quiz") {
    const toggleInterest = (val) => {
      setQuiz((q) => {
        const set = new Set(q.interests || []);
        set.has(val) ? set.delete(val) : set.add(val);
        return { ...q, interests: Array.from(set) };
      });
    };

    const interestOptions = [
      { id: "food", es: "Comida", en: "Food" },
      { id: "beach", es: "Playa", en: "Beach" },
      { id: "night", es: "Rumba", en: "Nightlife" },
      { id: "culture", es: "Cultura", en: "Culture" },
      { id: "adventure", es: "Aventura", en: "Adventure" },
    ];
    

    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="flex justify-end px-4 pt-4">
  <button
    onClick={() => setLang("es")}
    className={`px-3 py-1 text-xs rounded-l border ${
      lang === "es"
        ? "bg-neutral-900 text-white"
        : "bg-white text-neutral-700"
    }`}
  >
    ES
  </button>

  <button
    onClick={() => setLang("en")}
    className={`px-3 py-1 text-xs rounded-r border ${
      lang === "en"
        ? "bg-neutral-900 text-white"
        : "bg-white text-neutral-700"
    }`}
  >
    EN
  </button>
</div>

        <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
          <img src={logo} alt="Two Travel" className="h-10 w-auto" />

          <div className="space-y-2">
  <p className="text-[11px] tracking-[0.25em] text-neutral-500 uppercase">
    {lang === "es" ? "Two Travel Concierge" : "Two Travel Concierge"}
  </p>

  <h1 className="text-3xl sm:text-4xl font-semibold text-neutral-900 leading-tight">
    {lang === "es"
      ? "Diseñemos tus Experiences en Cartagena"
      : "Let's design your Cartagena Experiences!"}
  </h1>

  <p className="text-sm sm:text-base text-neutral-600 max-w-2xl">
    {lang === "es"
      ? "En 30 segundos, entendemos tu estilo y te mostramos recomendaciones curadas por nuestro concierge."
      : "In 30 seconds, we'll understand your style and show concierge-curated recommendations."}
  </p>

  <div className="text-xs text-neutral-500 flex items-center gap-2">
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-400" />
    <span>
      {lang === "es"
        ? "No vendemos tus datos. Esto solo se usa para personalizar tu catálogo."
        : "We don't sell your data. This is only used to personalize your catalog."}
    </span>
  </div>
</div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
  <span>{lang === "es" ? "Paso 1 de 2" : "Step 1 of 2"}</span>
  <div className="flex items-center gap-2">
    <span className="w-10 h-1 rounded-full bg-neutral-900" />
    <span className="w-10 h-1 rounded-full bg-neutral-200" />
  </div>
</div>


          <div className="bg-white border rounded-2xl p-5 space-y-4">
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              {/* Vibe — multi-select chips (pick one or more) */}
              <div className="space-y-1 md:col-span-3">
                <label className="text-[11px] text-neutral-600">
                  {lang === "es" ? "¿Cuál es tu vibe? (elige uno o más)" : "What's your vibe? (pick one or more)"}
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { id: "relax",    emoji: "🏖️", es: "Relax & playa",    en: "Relax & beach" },
                    { id: "party",    emoji: "🎉", es: "Nightlife & fiestas", en: "Nightlife & parties" },
                    { id: "romantic", emoji: "🌹", es: "Romántico",          en: "Romantic" },
                    { id: "family",   emoji: "👨‍👩‍👧", es: "Familia",         en: "Family" },
                    { id: "adventure",emoji: "🏄", es: "Aventura",           en: "Adventure" },
                  ].map((v) => {
                    const active = quiz.vibes.includes(v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() =>
                          setQuiz((q) => ({
                            ...q,
                            vibes: active
                              ? q.vibes.filter((x) => x !== v.id)
                              : [...q.vibes, v.id],
                          }))
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                          active
                            ? "bg-neutral-900 text-white border-neutral-900"
                            : "bg-white text-neutral-700 border-neutral-300 hover:border-neutral-500"
                        }`}
                      >
                        <span>{v.emoji}</span>
                        <span>{lang === "es" ? v.es : v.en}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-600">
                  {lang === "es" ? "Presupuesto" : "Budget"}
                </label>
                <select
  className="w-full border rounded-lg px-3 py-2 bg-white"
  value={quiz.budget}
  onChange={(e) =>
    setQuiz((q) => ({ ...q, budget: e.target.value }))
  }
>
  <option value="">—</option>
  <option value="low">{lang === "es" ? "Económico $" : "Budget $"}</option>
  <option value="mid">{lang === "es" ? "Medio $$" : "Mid $$"}</option>
  <option value="high">{lang === "es" ? "Alto $$$" : "High $$$"}</option>
</select>

              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-600">
                  {lang === "es" ? "¿Niños?" : "Kids?"}
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={quiz.kids}
                  onChange={(e) => setQuiz((q) => ({ ...q, kids: e.target.value }))}
                >
                  <option value="no">{lang === "es" ? "No" : "No"}</option>
                  <option value="yes">{lang === "es" ? "Sí" : "Yes"}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-neutral-600">
                  {lang === "es" ? "¿Cuántas personas?" : "Group size"}
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={quiz.groupSize}
                  onChange={(e) => setQuiz((q) => ({ ...q, groupSize: e.target.value }))}
                  placeholder="2"
                />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-neutral-600">
                {lang === "es" ? "Cocinas favoritas (opcional)" : "Favorite cuisines (optional)"}
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "seafood",     es: "Mariscos",           en: "Seafood" },
                  { id: "caribbean",   es: "Caribeño",           en: "Caribbean" },
                  { id: "contemporary",es: "Contemporáneo",      en: "Contemporary" },
                  { id: "fine-dining", es: "Fine dining",        en: "Fine dining" },
                  { id: "japanese",    es: "Japonés / Nikkei",   en: "Japanese / Nikkei" },
                  { id: "peruvian",    es: "Peruano",            en: "Peruvian" },
                  { id: "rooftop",     es: "Rooftop",            en: "Rooftop" },
                  { id: "classic",     es: "Clásico",            en: "Classic" },
                ].map((c) => {
                  const active = (quiz.cuisines || []).includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setQuiz((q) => {
                        const cur = q.cuisines || [];
                        return { ...q, cuisines: active ? cur.filter((x) => x !== c.id) : [...cur, c.id] };
                      })}
                      className={active ? btn.chipXsOn : btn.chipXsOff}
                    >
                      {lang === "es" ? c.es : c.en}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-neutral-600">
                {lang === "es"
                  ? "¿Qué actividades o experiencias quiere priorizar tu grupo en este viaje?"
                  : "What kinds of activities or experiences would your group like to prioritize on this trip?"}
              </p>
              <div className="flex flex-wrap gap-2">
                {interestOptions.map((opt) => {
                  const active = (quiz.interests || []).includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleInterest(opt.id)}
                      className={active ? btn.chipOn : btn.chipOff}
                    >
                      {lang === "es" ? opt.es : opt.en}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[11px] text-neutral-600">
                {lang === "es"
                  ? "¿Algo más que debamos saber sobre tu grupo?"
                  : "What else should we know about your group?"}
              </p>
              <textarea
                className="w-full border rounded-lg px-3 py-2 bg-white text-sm resize-none"
                rows={3}
                value={quiz.groupNotes}
                onChange={(e) => setQuiz((q) => ({ ...q, groupNotes: e.target.value }))}
                placeholder={lang === "es"
                  ? "Alergias, celebraciones especiales, preferencias de movilidad…"
                  : "Allergies, special celebrations, mobility preferences…"}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
  className={btn.linkBtn}
  onClick={() => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "catalog");
    if (kickoffId) url.searchParams.set("kickoffId", kickoffId);
    window.location.href = url.toString();
  }}
>
  {lang === "es" ? "Ver catálogo sin personalizar" : "Browse without personalization"}
</button>


              <button className={btn.filled} onClick={() => setStep("catalog")}>
  {lang === "es" ? "Ver recomendaciones →" : "See recommendations →"}
</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className={`min-h-screen transition-opacity duration-500 ${fadeIn ? "opacity-100" : "opacity-0"}`}>
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <img src={logo} alt="Two Travel" className="h-10 w-auto" />

          <div className="flex items-center gap-3 text-sm">
            {/* Idioma */}
            <div className="flex items-center gap-1">
              <Globe className="w-4 h-4 text-tt.teal" />
              <span>{t.language}:</span>
              <select
                className="border rounded px-2 py-1"
                value={lang}
                onChange={(e) => setLang(e.target.value)}
              >
                <option value="es">ES</option>
                <option value="en">EN</option>
              </select>
            </div>

            {/* Moneda */}
            <div className="flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-tt.gold" />
              <span>{t.currency}:</span>
              <select
                className="border rounded px-2 py-1"
                value={currency}
                onChange={(e) => { setCurrency(e.target.value); setCurrencyManuallySet(true); }}
              >
                <option value="COP">{t.cop}</option>
                <option value="USD">{t.usd}</option>
              </select>
            </div>

            {/* Botón favoritos (corazón) */}
            <button
              onClick={() => setShowCart(true)}
              className={`relative p-2 rounded-lg border border-neutral-900 text-neutral-900 bg-white hover:bg-neutral-900 hover:text-white active:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900/40 transition-colors transition-transform ${
                heartBump ? "scale-110" : ""
              }`}
            >
              <Heart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-neutral-900 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>
      <StepIndicator step={step} lang={lang} />

      {/* Search + filtros */}
      <div className="bg-white sticky top-16 z-30 border-b">
        {/* Row 1: Search + price/style toggle */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={t.search}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-tt.teal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {/* Price filter — always visible on the right */}
          <select
            value={priceRange}
            onChange={(e) => setPriceRange(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            {priceRanges.map((r) => (
              <option key={r.id} value={r.id}>
                {lang === "es" ? r.labelEs : r.labelEn}
              </option>
            ))}
          </select>
        </div>

        {/* Row 2: Category tabs — always visible, horizontally scrollable */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCategory(c.id);
                  setSelectedStyle("");
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                  selectedCategory === c.id
                    ? "bg-neutral-900 text-white border-neutral-900"
                    : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                }`}
              >
                {i18n[lang][c.id]}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Sub-filter for restaurant styles */}
        {selectedCategory === "restaurants" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t.styles}:</span>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-xs bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900/30"
              >
                <option value="">{lang === "es" ? "Todos los estilos" : "All styles"}</option>
                {restaurantStyles.map((s) => (
                  <option key={s.id} value={s.id}>{s.label[lang]}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
      {/* Toast: guía al cliente cuando agrega el primer favorito */}
      {cartToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm max-w-xs text-center">
            <Heart className="w-4 h-4 fill-current shrink-0" />
            <span>
              {lang === "es"
                ? "¡Guardado! Cuando termines, toca el ❤️ arriba para revisar tu lista."
                : "Saved! When you're done browsing, tap the ❤️ at the top to review your picks."}
            </span>
          </div>
        </div>
      )}

            {/* ✅ Recomendados (según quiz) — solo cuando no hay filtro activo */}
      {recommendedServices.length > 0 && selectedCategory === "all" && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-white border rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.22em] uppercase text-neutral-500">
  {lang === "es" ? "Ideal para tu estilo" : "Best for your vibe"} · {vibeLabel}
</p>

                <h2 className="text-lg font-bold">
  {lang === "es" ? "Selección del concierge" : "Concierge picks"}
</h2>
<p className="text-xs text-gray-500">
  {lang === "es"
    ? "Basado en tus respuestas y disponibilidad típica."
    : "Based on your preferences and typical availability."}
</p>

              </div>

              <button
                type="button"
                className={btn.linkBtn}
                onClick={() => setStep("quiz")}
              >
                {lang === "es" ? "Editar respuestas" : "Edit answers"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recommendedServices.map((s) => (
  <div
    key={`rec-${s.id}`}
    className="group border rounded-2xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white"
    onClick={() => {
  setSelectedService(s);
  setImgIndex(0);
}}
  >
    <div className="relative h-44">
      <img
  src={safeImg(s.image, s.category)}
  alt={s.name}
  className="w-full h-full object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
  onError={e => driveOnError(e, s.category)}
/>

      {/* ✅ BADGE */}
      <div className="absolute top-2 left-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/90 border border-neutral-200">
          <span className="w-1.5 h-1.5 rounded-full bg-neutral-900" />
          {lang === "es" ? "Concierge pick" : "Concierge pick"}
        </span>
      </div>
    </div>

    <div className="p-3">
      <p className="text-sm font-semibold">{(lang === "en" && s.name_en) ? s.name_en : s.name}</p>
      <p className="text-[11px] text-gray-500">
        {i18n[lang][s.category] || s.category}
      </p>
    </div>
  </div>
))}

            </div>
          </div>
        </div>
      )}


            {/* Grid servicios */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section headers when showing all categories */}
        {selectedCategory === "all" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(() => {
            const CAT_ORDER = ["restaurants","bars","beach-clubs","nightlife","chef","tours","services","transportation"];
            const sorted = [...filteredServices].sort((a, b) => {
              const ai = CAT_ORDER.indexOf(normalizeCategory(a.category));
              const bi = CAT_ORDER.indexOf(normalizeCategory(b.category));
              return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
            });
            let lastCat = null;
            return sorted.map((s, _svcIdx) => {
              const serviceCategory = normalizeCategory(s.category);
              const effectivePriceCop = getEffectivePriceCop(s, currentClientType);
              const priceConverted = convertPrice(effectivePriceCop);
              const isInCart = cart.some((c) => c.id === s.id);
              const showHeader = serviceCategory !== lastCat;
              lastCat = serviceCategory;
              return (
                <React.Fragment key={`svc-${_svcIdx}-${s.id}`}>
                  {showHeader && (
                    <div className="col-span-full mt-6 mb-2 flex items-center gap-3">
                      <h2 className="text-base font-bold text-neutral-800">
                        {i18n[lang][serviceCategory] || serviceCategory}
                      </h2>
                      <div className="flex-1 h-px bg-neutral-200"/>
                    </div>
                  )}
                  <div
                    className="bg-white rounded-xl shadow hover:shadow-xl transition-shadow overflow-hidden cursor-pointer"
                    onClick={() => setSelectedService(s)}
                  >
                    <div className="relative h-48">
                      <img src={safeImg(s.image, serviceCategory)} alt={s.name} className="w-full h-full object-cover"/>
                      <button onClick={(e)=>{e.stopPropagation();if(!isInCart)addToCart(s);}} className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md border transition-colors ${isInCart?"bg-neutral-900 text-white border-neutral-900":"bg-white/90 text-neutral-600 border-white hover:bg-neutral-100"}`}>
                        <Heart className={`w-4 h-4 ${isInCart?"fill-current":""}`}/>
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold">{(lang==="en"&&s.name_en)?s.name_en:s.name}</p>
                      {(s.description?.[lang]||s.description?.es||s.description?.en) && (
                        <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                          {s.description?.[lang]||s.description?.es||s.description?.en}
                        </p>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            });
          })()}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((s, _svcIdx) => {
  const serviceCategory = normalizeCategory(s.category);
  const effectivePriceCop = getEffectivePriceCop(s, currentClientType);
  const priceConverted = convertPrice(effectivePriceCop);

  const isInCart = cart.some((c) => c.id === s.id);

  return (
    <div
      key={`svc-${_svcIdx}-${s.id}`}
      className="bg-white rounded-xl shadow hover:shadow-xl transition-shadow overflow-hidden cursor-pointer"
      onClick={() => setSelectedService(s)}
    >
      <div className="relative h-48">
        <img
          src={safeImg(s.image, serviceCategory)}
          alt={s.name}
          className="w-full h-full object-cover"
          onError={e => driveOnError(e, serviceCategory)}
        />
        <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-semibold">
          {i18n[lang][serviceCategory] || serviceCategory}
        </div>
        {s.family_friendly && (
          <div className="absolute top-2 left-2 bg-emerald-500 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
            👨‍👩‍👧 {lang === "es" ? "Apto para familias" : "Family Friendly"}
          </div>
        )}
        {/* Quick-add heart button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isInCart) addToCart(s);
          }}
          title={isInCart ? (lang === "es" ? "Ya en favoritos" : "Already in favorites") : (lang === "es" ? "Agregar a favoritos" : "Add to favorites")}
          className={`absolute bottom-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors border ${
            isInCart
              ? "bg-neutral-900 text-white border-neutral-900"
              : "bg-white/90 text-neutral-700 border-white/60 hover:bg-neutral-900 hover:text-white"
          }`}
        >
          <Heart className={`w-4 h-4 ${isInCart ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        <h3 className="font-ui font-semibold text-lg mb-1">
          {(lang === "en" && s.name_en) ? s.name_en : s.name}
        </h3>

        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {serviceCategory === "transportation"
            ? (s.route || s.description?.[lang] || s.description?.es || s.description?.en || "")
            : (s.description?.[lang] || s.description?.es || s.description?.en || "")}
        </p>

        {/* Duration + capacity — hidden for restaurants & bars (not relevant for dining/nightlife) */}
        {!["restaurants","bars","nightlife"].includes(serviceCategory) && (
          <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
            {s.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {s.duration}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {serviceCategory === "transportation"
                ? (s.capacity_notes || `${s.capacity?.min ?? "?"}-${s.capacity?.max ?? "?"} ${t.people}`)
                : `${s.capacity?.min ?? "?"}-${s.capacity?.max ?? "?"} ${t.people}`}
            </span>
          </div>
        )}

        <div className="text-neutral-900">
          {categoryHasVisiblePrice(serviceCategory) && hasPrice(effectivePriceCop) && (
            <>
              <span className="text-lg font-bold">
                {formatPrice(priceConverted)}
              </span>
              <span className="text-xs text-gray-500 block">
                {t.approxPrice} • {unitLabel(s.priceUnit)}
              </span>
            </>
          )}

          {categoryHasVisiblePrice(serviceCategory) && !hasPrice(effectivePriceCop) && (
            <span className="text-xs text-gray-500 block">
              {t.requestQuote}
            </span>
          )}

          {!categoryHasVisiblePrice(serviceCategory) && (
            <PriceLevelChip
              service={{ ...s, category: serviceCategory }}
              lang={lang}
              clientType={currentClientType}
            />
          )}
        </div>
      </div>
    </div>
  );
})}

          {filteredServices.length === 0 && (
            <div className="col-span-full text-center py-10 text-gray-500">
              {t.noResults}
            </div>
          )}
        </div>
        )}
      </div>


      {/* Modal detalle servicio */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden">
            <div className="relative">
              <div className="relative">
                <img
                  src={gallery[imgIndex] || selectedService.image}
                  className="w-full h-72 object-cover rounded-2xl"
                  onError={e => driveOnError(e, selectedService.category)}
                />
                {/* Arrows only when there are MORE than 2 images (3+) */}
                {gallery.length > 2 && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setImgIndex((i) => (i === 0 ? gallery.length - 1 : i - 1))
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 shadow flex items-center justify-center text-2xl font-bold leading-none"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setImgIndex((i) => (i === gallery.length - 1 ? 0 : i + 1))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 shadow flex items-center justify-center text-2xl font-bold leading-none"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100"
                aria-label={t.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedService.video1 && (() => {
              const vUrl = selectedService.video1;
              // If it's a Drive download URL, swap to /preview for iframe embedding
              const driveMatch = vUrl.match(/\/uc\?export=download&id=([^&]+)/) || vUrl.match(/\/file\/d\/([^/]+)/);
              const isSrc = !vUrl.includes("drive.google.com") && (vUrl.endsWith(".mp4") || vUrl.endsWith(".webm") || vUrl.endsWith(".mov"));
              return (
                <div className="px-4 pt-3">
                  {driveMatch ? (
                    <iframe
                      src={`https://drive.google.com/file/d/${driveMatch[1]}/preview`}
                      className="w-full rounded-xl"
                      style={{ height: 200 }}
                      allow="autoplay"
                      title="video"
                    />
                  ) : isSrc ? (
                    <video src={vUrl} controls className="w-full rounded-xl max-h-48 object-cover" />
                  ) : (
                    <a href={vUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 underline">
                      Ver video ↗
                    </a>
                  )}
                </div>
              );
            })()}

            <div className="p-6">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="text-2xl font-bold">
                  {selectedService.name}
                </h2>
                {selectedService.family_friendly && (
                  <span className="shrink-0 inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 border border-emerald-300 px-2.5 py-1 rounded-full text-xs font-semibold">
                    👨‍👩‍👧 {lang === "es" ? "Apto para familias" : "Family Friendly"}
                  </span>
                )}
              </div>
              <p className="text-gray-600 mb-4">
  {selectedService.description?.[lang] ||
    selectedService.description?.es ||
    selectedService.description?.en ||
    ""}
</p>
{!categoryHasVisiblePrice(selectedServiceCategory) && (
  <div className="mb-3 flex items-center gap-2">
    <PriceLevelChip service={selectedService} lang={lang} clientType={currentClientType} />

    <span className="text-xs text-gray-500 italic">
      {lang === "es"
        ? "Precios exactos con Concierge"
        : "Exact pricing via Concierge"}
    </span>
  </div>
)}





              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="font-semibold mb-2">{t.details}</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {(selectedService.location || selectedService.location_es) && (
                      <li>📍 {lang === "es" ? (selectedService.location_es || selectedService.location) : (selectedService.location || selectedService.location_es)}</li>
                    )}
                    {selectedService.schedule && (
                      <li>⏰ {selectedService.schedule}</li>
                    )}
                    {/* Duration & capacity: hidden for restaurants, bars, nightlife */}
                    {!["restaurants","bars","nightlife"].includes(selectedServiceCategory) && (
                      <>
                        {selectedService.duration && (
                          <li>⏱️ {selectedService.duration}</li>
                        )}
                        <li>
                          👥 {(selectedService.capacity?.min ?? "?")}-
                          {(selectedService.capacity?.max ?? "?")} {t.people}
                        </li>
                      </>
                    )}
                    {/* Dress code — restaurants, bars & nightlife */}
                    {["restaurants","bars","nightlife","beach-clubs"].includes(selectedServiceCategory) && selectedService.dressCode && (
                      <li className="flex items-center gap-1.5">
                        <span style={{ fontSize: 14 }}>👔</span>
                        <span>{lang === "es" ? "Dress code: " : "Dress code: "}{selectedService.dressCode}</span>
                      </li>
                    )}
                    {/* Cancellation policy */}
                    {(selectedService.cancellation || selectedService.cancellation_es) && (
                      <li className="flex items-center gap-1.5">
                        <span style={{ fontSize: 14 }}>📋</span>
                        <span>{lang === "es" ? "Cancelación: " : "Cancellation: "}
                          {lang === "es"
                            ? (selectedService.cancellation_es || selectedService.cancellation)
                            : (selectedService.cancellation || selectedService.cancellation_es)}
                        </span>
                      </li>
                    )}
                    {/* Deposit */}
                    {(selectedService.deposit || selectedService.deposit_es) && (
                      <li className="flex items-center gap-1.5">
                        <span style={{ fontSize: 14 }}>💳</span>
                        <span>{lang === "es" ? "Depósito: " : "Deposit: "}
                          {lang === "es"
                            ? (selectedService.deposit_es || selectedService.deposit)
                            : (selectedService.deposit || selectedService.deposit_es)}
                        </span>
                      </li>
                    )}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t.highlights}</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
  {(lang === "en" && (selectedService.highlights_en || []).length > 0
    ? selectedService.highlights_en
    : selectedService.highlights || []
  ).map((h, i) => (
    <li key={i}>✓ {h}</li>
  ))}
</ul>

                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-6">
                {selectedService.menuUrl && (
                  <a
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                    href={selectedService.menuUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {t.menu}
                  </a>
                )}
                {selectedService.mapsUrl && (
                  <a
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
                    href={selectedService.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MapPin className="w-4 h-4" />
                    {t.map}
                  </a>
                )}
              </div>

              <div className="border-t pt-4 flex items-center justify-between">
  <div>
  {(() => {
    const selectedEffectivePriceCop = getEffectivePriceCop(selectedService, currentClientType);

    return categoryHasVisiblePrice(selectedServiceCategory) &&
      hasPrice(selectedEffectivePriceCop) ? (
      <>
        <span className="text-2xl font-bold text-tt.ink">
          {formatPrice(convertPrice(selectedEffectivePriceCop))}
        </span>
        <span className="text-sm text-gray-500 ml-2">
          · {t.approxPrice} • {unitLabel(selectedService.priceUnit)}
        </span>
      </>
    ) : (
      <span className="text-sm text-gray-500">
        {t.requestQuote}
      </span>
    );
  })()}
</div>

  <button
    onClick={() => {
      addToCart(selectedService);
      setSelectedService(null);
    }}
    className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 font-medium border border-neutral-900 text-neutral-900 bg-white hover:bg-neutral-900 hover:text-white active:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900/40 transition-colors"
  >
    {t.add}
  </button>
</div>

            </div>
          </div>
        </div>
      )}

      {/* Panel favoritos */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50">
          <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">{t.yourSelection}</h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {t.emptyCart}
                </p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.cartId} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{item.name}</h3>
                          <p className="text-sm text-gray-500">
                            {i18n[lang][item.category] || item.category}
                          </p>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.cartId)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex justify-between items-center text-sm">
  {categoryHasVisiblePrice(item.category) && hasPrice(item.price_cop) ? (
    <>
      <span>{formatPrice(convertPrice(item.price_cop))}</span>
      <span className="text-xs text-gray-500">
        {t.approxPrice} • {unitLabel(item.priceUnit)}
      </span>
    </>
  ) : (
    // Para restaurantes / bares / beach clubs / nightlife
    <span className="text-xs text-gray-600">
      {getServicePriceLevel(item, item.clientType || currentClientType) || t.variablePrice}
    </span>
  )}
</div>


                      <label className="block text-xs text-gray-500 mt-2 mb-1">
                        {t.notes}
                      </label>
                      <textarea
                        value={item.notes}
                        onChange={(e) =>
                          updateCartNotes(item.cartId, e.target.value)
                        }
                        placeholder={t.notes}
                        className="w-full p-2 text-sm border rounded resize-none"
                        rows={2}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
  <div className="border-t p-4 space-y-2">
    {cartTotalCOP > 0 ? (
      // ✅ Hay items con precio real → mostrar total
      <div className="flex justify-between text-sm">
        <span>Total aprox.</span>
        <span className="font-semibold">
          {formatPrice(cartTotalConverted)}
        </span>
      </div>
    ) : (
      // ✅ Solo hay restaurantes / bares / nightlife (sin precio numérico)
      <p className="text-xs text-gray-500 italic">
        {lang === "es"
          ? "Los precios exactos de restaurantes, bares y nightlife se confirman con Concierge."
          : "Exact prices for restaurants, bars and nightlife are confirmed with your Concierge."}
      </p>
    )}

    <button
      onClick={() => {
        setShowCart(false);
        setShowKickoff(true);
      }}
      className="w-full rounded-lg px-6 py-3 font-medium bg-neutral-900 text-white hover:bg-neutral-950 active:bg-black focus:outline-none focus:ring-2 focus:ring-neutral-900/40 transition-colors"
    >
      {t.continue}
    </button>
  </div>

            )}
          </div>
        </div>
      )}

            {/* Modal resumen para el cliente (Kick-off) */}
      {showKickoff && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-bold">
                {t.kickoffTitle}
              </h2>
              <button
                onClick={() => setShowKickoff(false)}
                className="p-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <p className="text-sm text-gray-600">{t.kickoffIntro}</p>
              <div className="grid sm:grid-cols-2 gap-3">
  <div>
    <label className="text-xs text-gray-500">
      {lang === "es" ? "Nombre del huésped" : "Guest name"}
    </label>
    <input
  className="w-full border rounded-lg px-3 py-2"
  value={guestName}
  onChange={(e) => setGuestName(e.target.value)}
/>
  </div>

  <div>
    <label className="text-xs text-gray-500">
      {lang === "es" ? "Nombre del viaje / villa" : "Trip / villa name"}
    </label>
    <input
  className="w-full border rounded-lg px-3 py-2"
  value={tripName}
  onChange={(e) => setTripName(e.target.value)}
/>
  </div>

  <div className="sm:col-span-2">
    <label className="text-xs text-gray-500">
      {lang === "es" ? "Contacto (WhatsApp o email)" : "Contact (WhatsApp or email)"}
    </label>
    <input
  id="guestContactInput"
  name="guestContact"
  autoComplete="tel"
  className="w-full border rounded-lg px-3 py-2"
  value={guestContact}
  onChange={(e) => setGuestContact(e.target.value)}
/>
  </div>

  {/* Travel dates */}
  <div>
    <label className="text-xs text-gray-500">
      {lang === "es" ? "Fecha de llegada" : "Arrival date"}
    </label>
    <input
      type="date"
      className="w-full border rounded-lg px-3 py-2"
      value={arrivalDate}
      onChange={(e) => setArrivalDate(e.target.value)}
    />
  </div>
  <div>
    <label className="text-xs text-gray-500">
      {lang === "es" ? "Fecha de salida" : "Departure date"}
    </label>
    <input
      type="date"
      className="w-full border rounded-lg px-3 py-2"
      value={departureDate}
      onChange={(e) => setDepartureDate(e.target.value)}
    />
  </div>

  {/* Nights count */}
  {arrivalDate && departureDate && (() => {
    const n = Math.round((new Date(departureDate) - new Date(arrivalDate)) / 86400000);
    return n > 0 ? (
      <div className="sm:col-span-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
        🌙 {n} {lang === "es" ? (n === 1 ? "noche" : "noches") : (n === 1 ? "night" : "nights")}
      </div>
    ) : null;
  })()}
</div>


              {cart.length === 0 ? (
                <p className="text-gray-500 text-sm">{t.emptyCart}</p>
              ) : (
                <>
                  <h3 className="font-semibold text-sm">
                    {t.kickoffQuestionsTitle}
                  </h3>
                  <ul className="space-y-3 text-sm">
                    {cart.map((item, index) => (
                      <li
                        key={item.cartId}
                        className="border rounded-lg p-3 bg-gray-50"
                      >
                        <p className="font-semibold">
                          {index + 1}. {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
  {i18n[lang][item.category] || item.category} •{" "}
  {categoryHasVisiblePrice(item.category) && hasPrice(item.price_cop)
    ? `${formatPrice(convertPrice(item.price_cop))} · ${unitLabel(item.priceUnit)}`
    : getServicePriceLevel(item, item.clientType || currentClientType) || t.variablePrice}
</p>

                        {item.notes && (
                          <p className="text-xs text-gray-700 mt-1">
                            <span className="font-semibold">{t.notes}: </span>
                            {item.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 border-t pt-4 text-sm text-gray-700 space-y-1">
                    <h4 className="font-semibold">
                      {t.kickoffNextStepsTitle}
                    </h4>
                    <p className="text-xs text-gray-600">
                      {t.kickoffNextStepsBody}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t flex flex-col sm:flex-row gap-2 justify-between">
              <button
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium border border-neutral-900 text-neutral-900 bg-white hover:bg-neutral-900 hover:text-white active:bg-neutral-950 focus:outline-none focus:ring-2 focus:ring-neutral-900/40 transition-colors"
                onClick={() => {
                  setShowKickoff(false);
                  setShowCart(true);
                }}
              >
                {t.backToCart}
              </button>
              <button
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-neutral-900 text-white hover:bg-neutral-950 active:bg-black focus:outline-none focus:ring-2 focus:ring-neutral-900/40 transition-colors"
                onClick={handleSendKickoff}
              >
                {t.sendKickoff}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
    
}
