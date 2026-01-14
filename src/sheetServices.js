// src/sheetServices.js
import Papa from "papaparse";


/* ============================================================
   1) CATÁLOGO – SIGUE IGUAL
   ============================================================ */

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNGpwNTGIWfyOOxSIFZgTdstPVL53Qhu_jUA1THG3J69YRdWI8SUsj4wHQsVOer2ykFzLMk2SozHuQ/pub?gid=190949837&single=true&output=csv";

// transforma una fila del CSV en el objeto que usa tu app
function mapRowToService(row, index) {
  const parseNum = (v) => {
    const n = Number((v || "").toString().replace(/[^0-9.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  return {
    id: parseNum(row.id || index + 1),
    sku: row.sku || "",
    name: row.name || "",
    category: row.category || "services",
    subcategory: row.subcategory || "",
    price_cop: parseNum(row.price_cop),
    priceUnit: row.priceUnit || "per person",
    image: row.image || "",

    description: {
      es: row.description_es || "",
      en: row.description_en || "",
    },

    capacity: {
      min: parseNum(row.capacity_min || 1),
      max: parseNum(row.capacity_max || 10),
    },

    schedule: row.schedule || "",
    duration: row.duration || "",
    location: row.location || "",

    highlights: row.highlights
      ? row.highlights.split(" / ").map((s) => s.trim())
      : [],

    deposit: row.deposit || "",
    cancellation: row.cancellation || "",
    menuUrl: row.menuUrl || "",
    mapsUrl: row.mapsUrl || "",
  };
}

export async function fetchServicesFromSheet() {
  const res = await fetch(SHEET_CSV_URL);
  if (!res.ok) throw new Error("Error cargando Sheet");

  const csvText = await res.text();

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data.map(mapRowToService);
}

/* ============================================================
   2) CONCIERGE PANEL – KICKOFFS (MODO DEMO LOCAL)
   ============================================================ */
/*
  IMPORTANTE:
  Esto es solo para que veas el ConciergePanel funcionando.
  Cuando me pases tu endpoint real de Apps Script,
  reemplazamos estas funciones por fetch() a tu API.
*/

const MOCK_KICKOFFS = [
  {
    id: "KICK-001",
    guestName: "John Doe",
    tripName: "Cartagena Getaway",
    createdAt: new Date().toISOString(),
    status: "new",
    conciergeSummary:
      "Propuesta inicial de restaurantes y nightlife para el fin de semana en Cartagena.",
    travifyText:
      "Hola John,\n\nAquí va la propuesta inicial de experiencias para tu viaje a Cartagena...",
    internalNotes: "Cliente VIP, viene por recomendación de Erin.",
    cart: [
      {
        id: "srv-1",
        name: "Carmen Cartagena",
        category: "Restaurantes",
        price_cop: 280000,
        priceUnit: "$$",
        notes: "Mesa en la terraza, horario 8:00 pm.",
      },
      {
        id: "srv-2",
        name: "Alquímico Rooftop",
        category: "Bares",
        price_cop: 0,
        priceUnit: "Consumisión abierta",
        notes: "Reservar rooftop, 4 pax.",
      },
    ],
  },
  {
    id: "KICK-002",
    guestName: "Sofía Pérez",
    tripName: "Girls Trip – Cartagena",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    status: "in-progress",
    conciergeSummary:
      "Plan de beach club + cena especial para grupo de amigas.",
    travifyText:
      "Hola Sofía,\n\nTe compartimos una propuesta de beach clubs y restaurantes para tu viaje...",
    internalNotes: "Confirmar si quieren transporte ida/vuelta al beach club.",
    cart: [
      {
        id: "srv-3",
        name: "Agua de León",
        category: "Restaurantes",
        price_cop: 250000,
        priceUnit: "$$",
      },
    ],
  },
];

// lo usamos como "base de datos" local solo para probar la UI
let mockKickoffs = [...MOCK_KICKOFFS];

export async function fetchKickoffsFromSheet() {
  // aquí luego irá tu llamada real a Apps Script / Google Sheets
  // por ahora devolvemos el mock para que veas el panel
  return mockKickoffs;
}

export async function updateKickoffInSheet(id, updates) {
  // aquí luego harás fetch() a tu API con el ID + updates
  mockKickoffs = mockKickoffs.map((k) =>
    k.id === id ? { ...k, ...updates } : k
  );
  return true;
}

export async function deleteKickoff(id) {
  // aquí luego harás fetch() a tu API para borrar en el sheet
  mockKickoffs = mockKickoffs.filter((k) => k.id !== id);
  return true;
}

// ============================================================
// 3) KICKOFFS – REAL (Apps Script Web App)
// ============================================================

const KICKOFF_API_URL =
  "https://script.google.com/macros/s/TU_WEBAPP_ID/exec"; // <-- cambia esto

export async function saveKickoffToSheet(payload) {
  const res = await fetch(KICKOFF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "saveKickoff",
      payload,
    }),
  });

  if (!res.ok) throw new Error("Error guardando kick-off");
  return res.json();
}
