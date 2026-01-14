
import React, { useMemo, useState, useEffect } from "react";
import {
  fetchServicesFromSheet,
  saveKickoffToSheet,
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
   1) CONFIG: tasa de cambio (aprox)
================================== */
const FX_COP_PER_USD = 4200;

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
    services: "Servicios",
    styles: "Estilos",
    price: "Precio",
    priceGroup: "por grupo",
    noResults: "No se encontraron servicios",
    language: "Idioma",
    currency: "Moneda",
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
      "Estas son las experiencias que elegiste. Con esto nuestro concierge preparará tu itinerario y revisará disponibilidad.",
    kickoffQuestionsTitle: "Tu selección",
    backToCart: "Editar selección",
    sendKickoff: "Enviar al concierge",
    conciergePanelTitle: "Resumen para Concierge",      // los puedes dejar aunque ya no se usan en esta pantalla
    conciergePanelHelp:
      "Este es el resumen de los favoritos del cliente. Puedes copiarlo y pegarlo en Travify o en tu flujo interno.",
    travifyNote:
      "Al hacer clic en el botón, se copiará el resumen y se abrirá un borrador de correo para Travify.",
    kickoffNextStepsTitle: "¿Qué pasa después?",
    kickoffNextStepsBody:
      "Nuestro concierge revisará tu selección, verificará disponibilidad y te contactará por email o WhatsApp con propuestas de horarios y reservas.",
    kickoffSentTitle: "¡Resumen enviado!",
    kickoffSentBody:
      "Tu selección fue enviada a nuestro equipo de concierge. En las próximas horas te contactaremos para afinar detalles y avanzar con las reservas.",

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
    services: "Services",
    styles: "Styles",
    price: "Price",
    priceGroup: "per group",
    noResults: "No services found",
    language: "Language",
    currency: "Currency",
    cop: "COP",
    usd: "USD",
    approxPrice: "Approx. price",
    perPerson: "per person",
    dayPass: "day pass",
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
    emptyCart: "You don’t have favorites yet",
    notes: "Notes",
        continue: "Go to summary →",
    kickoffTitle: "Your Selection Summary",
    kickoffIntro:
      "These are the experiences you chose. Our concierge will use this to prepare your itinerary and check availability.",
    kickoffQuestionsTitle: "Your selection",
    backToCart: "Edit selection",
    sendKickoff: "Send to concierge",
    conciergePanelTitle: "Concierge Summary",
    conciergePanelHelp:
      "This is the summary of the guest’s favorites. You can copy and paste it into Travify or your internal flow.",
    travifyNote:
      "Clicking the button will copy the summary and open an email draft for Travify.",
    kickoffNextStepsTitle: "What happens next?",
    kickoffNextStepsBody:
      "Our concierge will review your selection, check availability, and contact you via email or WhatsApp with timing options and bookings.",
    kickoffSentTitle: "Summary sent!",
    kickoffSentBody:
      "Your selection has been sent to our concierge team. We’ll reach out in the next few hours to refine details and proceed with bookings.",

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
    en: "Lounge-style bar in Cartagena’s Old City. Creative cocktails, DJs, and artistic modern design. Ideal for pre-party or a chill night out."
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
  { id: "services" },
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
    labelEs: "$ (más económico)",
    labelEn: "$ (budget)",
    levels: ["$"],
  },
  {
    id: "mid",
    labelEs: "$$ (medio)",
    labelEn: "$$ (mid)",
    levels: ["$$"],
  },
  {
    id: "premium",
    labelEs: "$$$ (alto)",
    labelEn: "$$$ (premium)",
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
export default function TwoTravelCatalog() {
  const [lang, setLang] = useState("es");
  const [currency, setCurrency] = useState("COP");

  const t = i18n[lang];
    // 🔹 Estado que se alimenta del Sheet
  const [services, setServices] = useState([]);

  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [servicesError, setServicesError] = useState(null);
  // Normaliza categoría que viene del Sheet

const normalizeCategory = (raw) => {
  const v = (raw || "").toString().trim().toLowerCase();

  if (v.startsWith("rest")) return "restaurants";
  if (v.startsWith("bar")) return "bars";
  if (v.includes("beach")) return "beach-clubs";
  if (v.startsWith("tour")) return "tours";
  if (v.startsWith("night")) return "nightlife";
  if (v.startsWith("serv")) return "services";

  return "services";
};

const normalizePriceUnit = (raw) => {
  const v = (raw || "").toString().trim().toLowerCase();

  if (v.includes("grupo")) return "per group";
  if (v.includes("pasad")) return "day pass";
  if (v.includes("persona")) return "per person";

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
const getServicePriceLevel = (s) => {
  // 1) si viene del Sheet (columna price_level / PRICE LEVEL / etc.)
  if (s.priceLevel) return s.priceLevel;

  // 2) si no, calculado por precio en COP
  return priceLevelFromCop(s.price_cop);
};


// si no viene del Sheet, calculamos según price_cop
const normalizePriceLevelValue = (raw) => {
  const v = (raw || "").toString().trim();

  if (!v) return null;

  // Si ya viene como $, $$ o $$$
  if (v === "$" || v === "$$" || v === "$$$") return v;

  // Si viene como 1, 2, 3
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







    useEffect(() => {
  setIsLoadingServices(true);

  fetchServicesFromSheet()
    .then((remote) => {
      if (remote && remote.length) {
        const normalized = remote.map((s) => {
  const priceCop = Number(s.price_cop ?? s.price ?? 0);

  // intentamos leer la columna de muchas formas
  const rawPriceLevel =
    s.price_level ??
    s.priceLevel ??
    s.PRICE_LEVEL ??
    s["PRICE LEVEL"] ??
    s.pricelevel;

  const levelFromSheet = normalizePriceLevelValue(rawPriceLevel);

  return {
    ...s,
    category: normalizeCategory(
      s.category || s.Category || s.categoria
    ),
    priceUnit: normalizePriceUnit(
      s.priceUnit || s.price_unit || s.unidad_precio
    ),
    price_cop: priceCop,

    // Primero intentamos lo que venga del Sheet ($, $$, $$$ o 1/2/3)
    // Si no hay nada, lo calculamos con el COP
    priceLevel: levelFromSheet ?? priceLevelFromCop(priceCop),

    description:
      typeof s.description === "string"
        ? { es: s.description, en: s.description }
        : s.description ?? { es: "", en: "" },
  };
});


        // 👉 AHORA TODO sale del Sheet
        setServices(normalized);
      }
    })
    .catch((err) => {
      console.error("Error leyendo Sheet:", err);
      setServicesError("No se pudo leer el catálogo.");

      // Fallback si el Sheet falla
      setServices([]); // fallback vacío
    })
    .finally(() => {
      setIsLoadingServices(false);
    });
}, []);
// ⭐ CHIP + INFO (versión pequeña, elegante y bilingüe)
const PriceLevelChip = ({ service, lang }) => {
  if (!categoriesWithPriceLevel.includes(service.category)) return null;

  const level = getServicePriceLevel(service);
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

  const tInfo = explanations[lang] || explanations.es;

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
    currency === "USD" ? Math.round(cop / FX_COP_PER_USD) : cop;

  const categoryHasVisiblePrice = (category) =>
  category === "tours" || category === "services";


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
  const [selectedStyles, setSelectedStyles] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [priceRange, setPriceRange] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [showKickoff, setShowKickoff] = useState(false);
  const [kickoffSent, setKickoffSent] = useState(false);

  /* ---------- favoritos / “carrito” ---------- */
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [heartBump, setHeartBump] = useState(false); // 💗 animación icono

  // Total en COP
  const cartTotalCOP = useMemo(
  () =>
    cart
      .filter(
        (item) =>
          item.category === "tours" || item.category === "services"
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
        const level = getServicePriceLevel(item);
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
    const filteredServices = useMemo(() => {
  return services.filter((s) => {
    const catOK =
      selectedCategory === "all" || s.category === selectedCategory;

    const stylesOK =
      selectedCategory !== "restaurants" || selectedStyles.size === 0
        ? true
        : selectedStyles.has(s.subcategory);

    const q = searchTerm.trim().toLowerCase();
    const searchOK =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.description?.es || "").toLowerCase().includes(q) ||
      (s.description?.en || "").toLowerCase().includes(q);

    const range = priceRanges.find((r) => r.id === priceRange);
let priceOK = true;

if (range && range.id !== "all") {
  const lvl = getServicePriceLevel(s); // $, $$ o $$$ (o null)

  // si no hay nivel definido, lo excluimos del filtro
  if (!lvl || !range.levels?.includes(lvl)) {
    priceOK = false;
  }
}



    return catOK && stylesOK && searchOK && priceOK;
  });
}, [services, selectedCategory, selectedStyles, searchTerm, priceRange]);






  /* ---------- lógica favoritos ---------- */
  const addToCart = (s) => {
    setCart((c) => [
      ...c,
      {
        cartId: Date.now() + Math.random(),
        id: s.id,
        name: s.name,
        category: s.category,
        price_cop: s.price_cop,
        priceUnit: s.priceUnit,
        priceLevel: s.priceLevel,   // ✅ ADD
        notes: "",
      },
    ]);
    setHeartBump(true);
    setTimeout(() => setHeartBump(false), 200);
  };

  const removeFromCart = (cartId) =>
    setCart((c) => c.filter((x) => x.cartId !== cartId));

  const updateCartNotes = (cartId, notes) =>
    setCart((c) => (c.map((x) => (x.cartId === cartId ? { ...x, notes } : x))));

      const handleSendKickoff = async () => {
    try {
      const payload = {
        // lo que se guarda en el Sheet
        cart,
        conciergeSummary,
        currency,
        lang,
        totalCOP: cartTotalCOP,
        totalConverted: cartTotalConverted,
        createdAt: new Date().toISOString(),
        // campos opcionales que luego puedes rellenar desde otro form:
        guestName: "",   // TODO: más adelante pedimos nombre / villa / fechas
        tripName: "",
        status: "new",
        internalNotes: "",
      };

      await saveKickoffToSheet(payload);

      setShowKickoff(false);
      setKickoffSent(true);
      setCart([]); // vaciamos selección del cliente
    } catch (err) {
      console.error(err);
      alert(
        lang === "es"
          ? "Hubo un problema enviando tu selección. Intenta de nuevo."
          : "There was a problem sending your selection. Please try again."
      );
    }
  };



  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen">
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
                onChange={(e) => setCurrency(e.target.value)}
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

      {/* Search + filtros */}
      <div className="bg-white sticky top-16 z-30 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row gap-3">
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

          <button
            onClick={() => setShowFilters((s) => !s)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-5 h-5" />
            {t.filters}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                showFilters ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Panel filtros */}
        {showFilters && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              {/* Categorías */}
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCategory(c.id);
                    setSelectedStyles(new Set());
                  }}
                  className={`px-3 py-1 rounded-full text-sm border ${
                    selectedCategory === c.id
                      ? "bg-tt.teal text-white border-tt.teal"
                      : "bg-white text-tt.ink hover:bg-gray-50"
                  }`}
                >
                  {i18n[lang][c.id]}
                </button>
              ))}

              {/* Estilos restaurantes */}
              {selectedCategory === "restaurants" && (
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-xs text-gray-600">{t.styles}:</span>
                  {restaurantStyles.map((s) => {
                    const active = selectedStyles.has(s.id);
                    return (
                      <button
                        key={s.id}
                        onClick={() => {
                          const next = new Set(selectedStyles);
                          active ? next.delete(s.id) : next.add(s.id);
                          setSelectedStyles(next);
                        }}
                        className={`px-3 py-1 rounded-full text-xs border ${
                          active
                            ? "bg-tt.gold text-tt.ink border-tt.gold"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        {s.label[lang]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Rango de precio */}
              <div className="ml-auto">
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="px-3 py-1 border rounded-lg text-sm"
                >
                  {priceRanges.map((r) => (
  <option key={r.id} value={r.id}>
    {t.price}: {lang === "es" ? r.labelEs : r.labelEn}
  </option>
))}

                </select>
              </div>
            </div>
          </div>
        )}
      </div>

            {/* Grid servicios */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map((s) => {
            const priceConverted = convertPrice(s.price_cop);
            return (
              <div
                key={s.id}
                className="bg-white rounded-xl shadow hover:shadow-xl transition-shadow overflow-hidden cursor-pointer"
                onClick={() => setSelectedService(s)}
              >
                <div className="relative h-48">
                  <img
                    src={s.image}
                    alt={s.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2 bg-white/90 px-2 py-1 rounded-full text-xs font-semibold">
                    {i18n[lang][s.category] || s.category}
                  </div>
                </div>

                <div className="p-4">
                  <h3 className="font-ui font-semibold text-lg mb-1">
                    {s.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
  {s.description?.[lang] || s.description?.es || s.description?.en || ""}
</p>


                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.duration}
                    </span>
                    <span className="flex items-center gap-1">
  <Users className="w-3 h-3" />
  {(s.capacity?.min ?? "?")}-{(s.capacity?.max ?? "?")} {t.people}
</span>

                  </div>

                  <div className="text-tt.ink">
  {/* Solo TOURS + SERVICES muestran precio numérico */}
  {categoryHasVisiblePrice(s.category) && hasPrice(s.price_cop) && (
    <>
      <span className="text-lg font-bold">
        {formatPrice(priceConverted)}
      </span>
      <span className="text-xs text-gray-500 block">
        {t.approxPrice} • {unitLabel(s.priceUnit)}
      </span>
    </>
  )}

  {categoryHasVisiblePrice(s.category) && !hasPrice(s.price_cop) && (
    <span className="text-xs text-gray-500 block">
      Solicita cotización
    </span>
  )}
{/* RESTAURANTS / BARS / BEACH-CLUBS / NIGHTLIFE → solo $, $$, $$$ */}
{!categoryHasVisiblePrice(s.category) && (
  <PriceLevelChip service={s} lang={lang} />
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
      </div>


      {/* Modal detalle servicio */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full overflow-hidden">
            <div className="relative">
              <img
                src={selectedService.image}
                alt={selectedService.name}
                className="w-full h-64 object-cover"
              />
              <button
                onClick={() => setSelectedService(null)}
                className="absolute top-4 right-4 bg-white rounded-full p-2 hover:bg-gray-100"
                aria-label={t.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <h2 className="text-2xl font-bold mb-2">
                {selectedService.name}
              </h2>
              <p className="text-gray-600 mb-4">
  {selectedService.description?.[lang] ||
    selectedService.description?.es ||
    selectedService.description?.en ||
    ""}
</p>
{!categoryHasVisiblePrice(selectedService.category) && (
  <div className="mb-3 flex items-center gap-2">
    <PriceLevelChip service={selectedService} lang={lang} />

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
                    <li>📍 {selectedService.location}</li>
                    <li>⏰ {selectedService.schedule}</li>
                    <li>⏱️ {selectedService.duration}</li>
                    <li>
  👥 {(selectedService.capacity?.min ?? "?")}-
  {(selectedService.capacity?.max ?? "?")} {t.people}
</li>

                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">{t.highlights}</h3>
                  <ul className="space-y-1 text-sm text-gray-600">
  {(selectedService.highlights || []).map((h, i) => (
    <li key={i}>✓ {h}</li>
  ))}
</ul>

                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-6">
                {selectedService.category === "restaurants" &&
                  selectedService.menuUrl && (
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
    {categoryHasVisiblePrice(selectedService.category) &&
    hasPrice(selectedService.price_cop) ? (
      <>
        <span className="text-2xl font-bold text-tt.ink">
          {formatPrice(convertPrice(selectedService.price_cop))}
        </span>
        <span className="text-sm text-gray-500 ml-2">
          · {t.approxPrice} • {unitLabel(selectedService.priceUnit)}
        </span>
      </>
    ) : (
      <span className="text-sm text-gray-500">
        Solicita cotización
      </span>
    )}
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
      {getServicePriceLevel(item) || "Precio variable"}
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
        Los precios exactos de restaurantes, bares y nightlife
        se confirman con Concierge.
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
    : getServicePriceLevel(item) || "Precio variable"}
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