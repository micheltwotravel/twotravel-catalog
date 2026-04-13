// api/travefy-send.js
// Production-ready Travefy itinerary generator — Two Travel Concierge
// Structure: Trip → TripDays → TripEvents → TripIdeas
// Supplemental days: Welcome · Trip Summary · Info & Documents · Accounting Reference
import Papa from "papaparse";

const TRAVEFY_BASE   = "https://api.travefy.com/api/v1";
const SHEET_CSV_URL  =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNGpwNTGIWfyOOxSIFZgTdstPVL53Qhu_jUA1THG3J69YRdWI8SUsj4wHQsVOer2ykFzLMk2SozHuQ/pub?gid=190949837&single=true&output=csv";

/* ══════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════ */

const clean  = (v) => String(v ?? "").trim();
const truthy = (v) => ["true","1","yes","si","sí"].includes(clean(v).toLowerCase());

function first(...vals) {
  for (const v of vals) if (clean(v)) return clean(v);
  return "";
}

function parseNum(v) {
  const n = Number(clean(v).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function formatCOP(v) {
  const n = parseNum(v);
  if (!n) return "";
  return `$${n.toLocaleString("es-CO")} COP`;
}

function normDriveUrl(url) {
  const raw = clean(url);
  if (!raw) return "";

  // Already a usable direct URL — pass through
  if (raw.includes("drive.google.com/uc") || raw.includes("drive.google.com/thumbnail")) return raw;

  // Non-Drive URL — use as-is
  if (!raw.includes("drive.google.com")) return raw;

  // Extract Drive file ID
  const m = raw.match(/\/file\/d\/([^/?]+)/) || raw.match(/[?&]id=([^&]+)/);
  const id = m?.[1];
  if (!id) return "";

  // Use uc?export=view — most reliable public URL for Travefy (direct, no JS redirect)
  return `https://drive.google.com/uc?export=view&id=${id}`;
}

// Splits highlight / includes cells — handles bullets, semicolons, pipes, newlines
function splitList(v) {
  return clean(v)
    .split(/[\n•·]+|[;|]|\s*\/\s*/)
    .map((x) => x.replace(/^[-–—*]\s*/, "").trim())
    .filter(Boolean);
}

/* ══════════════════════════════════════════════════════════════════
   CATALOG  —  Google Sheet CSV  →  normalized service objects
══════════════════════════════════════════════════════════════════ */

function mapRow(row, idx) {
  // Normalize all header keys: lowercase + underscores
  const n = {};
  for (const [k, v] of Object.entries(row || {}))
    n[clean(k).toLowerCase().replace(/[\s-]+/g, "_").replace(/\ufeff/g, "")] = v;

  // Extra image columns: sheet headers "image 5"…"image 9" → after normalization → "image_5"…"image_9"
  // Also try legacy numeric headers "5"…"9"
  const extraImages = [
    first(n.image_5, n["5"]),
    first(n.image_6, n["6"]),
    first(n.image_7, n["7"]),
    first(n.image_8, n["8"]),
    first(n.image_9, n["9"]),
  ].map((k) => normDriveUrl(clean(k))).filter(Boolean);

  return {
    id:             parseNum(n.id || idx + 1),
    sku:            clean(n.sku),
    name:           first(n.name, n.title, n.service),
    category:       clean(n.category),
    subcategory:    clean(n.subcategory),

    // Billing / accounting
    quickbooksCode: first(n.quickbooks_code, n.quickbooks, n.billing_code, n.code),

    // Descriptions (language-aware with fallback)
    descriptionEs:  first(n.description_es, n.descripcion, n.description),
    descriptionEn:  first(n.description_en),

    // Pre-built Travefy notes template — if filled, used instead of auto-generated description
    travefyNotes:   clean(n.travefy_notes_template),

    // Location
    location:       clean(n.location),   // venue name / neighborhood (NOT the street address)
    address:        clean(n.address),    // full street address
    city:           clean(n.city),

    // Scheduling
    schedule:       first(n.schedule, n.time),
    duration:       clean(n.duration),

    // Content
    highlights:     clean(n.highlights),
    includes:       first(n.includes, n.included, n.incluye),
    deposit:        clean(n.deposit),
    cancellation:   first(n.cancellation, n.terms_and_conditions, n.terms),

    // Pricing
    priceCop:       first(n.price_cop, n.price),
    priceTier1:     clean(n.price_tier_1),
    priceTier2:     clean(n.price_tier_2),
    priceUnit:      first(n.priceunit, n.price_unit, "per person"),

    // Capacity
    capacityMin:    parseNum(n.capacity_min),
    capacityMax:    parseNum(n.capacity_max),

    // Media — primary image: "image_source" is the canonical column name in the sheet
    image:          normDriveUrl(first(n.image_source, n.image, n.imageurl, n.image_url)),
    images:         extraImages,
    video1:         clean(n.video1),

    // Links
    mapsUrl:        first(n.mapsurl, n.maps_url),
    menuUrl:        first(n.menuurl, n.menu_url),

    // Control
    enabled:        truthy(first(n.travefy_enabled, "true")),
  };
}

async function fetchCatalog() {
  const res = await fetch(`${SHEET_CSV_URL}&t=${Date.now()}`);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status}`);
  const { data } = Papa.parse(await res.text(), {
    header: true, skipEmptyLines: true,
    transformHeader: (h) => clean(h).toLowerCase().replace(/\ufeff/g, ""),
  });
  return data.map(mapRow).filter((r) => r.name);
}

/* ══════════════════════════════════════════════════════════════════
   CART MATCHING  —  cart item  →  catalog service
══════════════════════════════════════════════════════════════════ */

function matchCart(cart, catalog) {
  const matched = [], unmatched = [];
  for (const item of (Array.isArray(cart) ? cart : [])) {
    const sku = clean(item?.sku);
    const id  = clean(item?.id);
    const nl  = clean(item?.name).toLowerCase();

    const svc =
      catalog.find((s) => sku && s.sku === sku) ||
      catalog.find((s) => id  && String(s.id) === id) ||
      catalog.find((s) => nl  && s.name.toLowerCase() === nl) ||
      catalog.find((s) => nl  && s.name.toLowerCase().startsWith(nl)) ||
      (nl.length >= 4
        ? catalog.find((s) =>
            s.name.toLowerCase().includes(nl) || nl.includes(s.name.toLowerCase()))
        : null);

    if (!svc)          { unmatched.push({ name: item?.name || "?", reason: "not_in_catalog" }); continue; }
    if (!svc.enabled)  { unmatched.push({ name: svc.name,          reason: "disabled"        }); continue; }
    matched.push({ cartItem: item, service: svc });
  }
  return { matched, unmatched };
}

/* ══════════════════════════════════════════════════════════════════
   LABELS & CATEGORY MAPPING
══════════════════════════════════════════════════════════════════ */

const LABELS = {
  en: {
    highlights:   "Trip Highlights",
    includes:     "Includes",
    duration:     "Duration",
    price:        "Price",
    deposit:      "Deposit required",
    cancellation: "Cancellation Policy",
    terms:        "Terms and Conditions",
    capacity:     "Capacity",
  },
  es: {
    highlights:   "Aspectos Destacados",
    includes:     "Incluye",
    duration:     "Duración",
    price:        "Precio",
    deposit:      "Depósito requerido",
    cancellation: "Política de Cancelación",
    terms:        "Términos y Condiciones",
    capacity:     "Capacidad",
  },
};

const CAT_LABEL = {
  en: {
    restaurants:"Restaurant", restaurant:"Restaurant", food:"Restaurant",
    nightlife:"Nightlife / Club", night_life:"Nightlife / Club",
    tours:"Tour / Activity", tour:"Tour / Activity",
    experiences:"Experience", experience:"Experience",
    transport:"Transport", transportation:"Transport",
    beach_clubs:"Beach Club", beach_club:"Beach Club",
    boats:"Boat / Yacht", boat:"Boat / Yacht", yacht:"Boat / Yacht",
    accommodation:"Accommodation", villa:"Accommodation", hotel:"Accommodation",
    shopping:"Shopping",
  },
  es: {
    restaurants:"Restaurante", restaurant:"Restaurante", food:"Restaurante",
    nightlife:"Nightlife / Club", night_life:"Nightlife / Club",
    tours:"Tour / Actividad", tour:"Tour / Actividad",
    experiences:"Experiencia", experience:"Experiencia",
    transport:"Transporte", transportation:"Transporte",
    beach_clubs:"Beach Club", beach_club:"Beach Club",
    boats:"Bote / Yate", boat:"Bote / Yate", yacht:"Bote / Yate",
    accommodation:"Alojamiento", villa:"Alojamiento", hotel:"Alojamiento",
    shopping:"Shopping",
  },
};

function catLabel(cat, lang) {
  const c = clean(cat).toLowerCase().replace(/[\s-]+/g, "_");
  return (CAT_LABEL[lang] || CAT_LABEL.en)[c] || (lang === "es" ? "Servicio" : "Service");
}

// Travefy EventTypeId values
// IMPORTANT: food/restaurant must be checked BEFORE transport to avoid mis-categorization
function eventTypeId(category) {
  const c = clean(category).toLowerCase();
  if (/restaurant|food|dinner|lunch|breakfast|chef|eat|comida|restaurante/.test(c)) return 4; // Food & Drink
  if (/nightlife|party|club|bar|drinks|lounge|discoteca|fiesta/.test(c))            return 5; // Nightlife
  if (/accommodation|hotel|villa|house|penthouse|airbnb|alojamiento/.test(c))       return 2; // Lodging
  if (/transport|transfer|pickup|airport|van|suv|driver|traslado|transporte/.test(c)) return 3; // Transport
  if (/tour|activity|experience|boat|beach|museum|hike|actividad|experiencia/.test(c)) return 1; // Activity
  return 0; // General
}

// Helper: is this a transport/vehicle service?
function isTransport(category) {
  return /transport|transfer|pickup|airport|van|suv|driver|traslado|transporte/.test(
    clean(category).toLowerCase()
  );
}

// Helper: is this a restaurant/food service?
function isFood(category) {
  return /restaurant|food|dinner|lunch|breakfast|chef|eat|comida|restaurante/.test(
    clean(category).toLowerCase()
  );
}

/* ══════════════════════════════════════════════════════════════════
   RICH DESCRIPTION BUILDER
   Order: narrative → highlights → includes → duration/capacity →
          price → deposit → cancellation → billing code (at end)

   RULES:
   - Never start with [ brackets ] — Travefy parser drops the field
   - No emoji in body text — encoding issues on some Travefy versions
   - Hard cap at 2000 chars so Travefy doesn't silently truncate
   - QB billing code goes at the very end as a plain reference line
══════════════════════════════════════════════════════════════════ */

function cap(str, max = 2000) {
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

function buildDescription(svc, cartItem, lang) {
  const lb = LABELS[lang] || LABELS.en;
  const isEs = lang === "es";

  // If the sheet has a pre-built Travefy template, use it directly
  if (svc.travefyNotes) {
    let text = svc.travefyNotes;
    if (svc.cancellation &&
        !text.toLowerCase().includes("cancell") &&
        !text.toLowerCase().includes("cancelac")) {
      text += `\n\n${lb.cancellation}: ${svc.cancellation}`;
    }
    if (svc.quickbooksCode) {
      const p = parseNum(svc.priceCop || svc.priceTier1);
      text += `\n\n[${svc.quickbooksCode}][${p || ""}]`;
    }
    return cap(text.trim());
  }

  const lines = [];

  // 1. Main narrative
  const main = isEs
    ? (svc.descriptionEs || svc.descriptionEn)
    : (svc.descriptionEn || svc.descriptionEs);
  if (main) { lines.push(main); lines.push(""); }

  // 2. Highlights (max 6)
  const hi = splitList(svc.highlights).slice(0, 6);
  if (hi.length) {
    lines.push(lb.highlights + ":");
    hi.forEach(x => lines.push("- " + x));
    lines.push("");
  }

  // 3. Price
  const priceUnit = isTransport(svc.category)
    ? (isEs ? "por vehiculo" : "per vehicle")
    : (svc.priceUnit || (isEs ? "por persona" : "per person"));
  const pMain  = formatCOP(svc.priceCop);
  const pTier1 = formatCOP(svc.priceTier1);
  const pTier2 = formatCOP(svc.priceTier2);

  if (pTier1 && pTier2) {
    lines.push(`${lb.price} (${isEs ? "grupo pequeno" : "small group"}): ${pTier1} ${priceUnit}`);
    lines.push(`${lb.price} (${isEs ? "grupo grande" : "large group"}): ${pTier2} ${priceUnit}`);
    lines.push("");
  } else if (pTier1 || pMain) {
    lines.push(`${lb.price}: ${pTier1 || pMain} ${priceUnit}`);
    lines.push("");
  }

  // 4. Duration (skip for food/nightlife)
  if (svc.duration && !isFood(svc.category)) {
    lines.push(`${lb.duration}: ${svc.duration}`);
  }

  // 5. Location / address
  const locParts = [svc.location, svc.address].filter(Boolean);
  if (locParts.length) {
    lines.push((isEs ? "Lugar" : "Location") + ": " + locParts.join(", "));
  }

  // 6. Cancellation
  if (svc.cancellation) {
    lines.push("");
    lines.push(`${lb.cancellation}: ${svc.cancellation}`);
  }

  // 7. Billing code — always last
  if (svc.quickbooksCode) {
    const p = parseNum(svc.priceCop || svc.priceTier1);
    lines.push(`\n[${svc.quickbooksCode}][${p || ""}]`);
  }

  return cap(lines.join("\n").trim());
}

/* ══════════════════════════════════════════════════════════════════
   TRAVEFY OBJECT BUILDERS
══════════════════════════════════════════════════════════════════ */

function buildTripIdea(svc, cartItem, lang) {
  const desc  = buildDescription(svc, cartItem, lang);
  const price = parseNum(svc.priceCop || svc.priceTier1);
  const name  = clean(cartItem?.title || cartItem?.name || svc.name);

  return {
    // Both Title and Name — Travefy uses one or the other depending on version
    Title:       name,
    Name:        name,
    Description: desc,
    Notes:       desc,
    Price:       price || undefined,
    PriceText:   formatCOP(svc.priceCop || svc.priceTier1) || undefined,
    Duration:    svc.duration || undefined,
    Location:    svc.location || undefined,   // venue name / neighborhood
    Address:     svc.address  || undefined,   // full street address
    Website:     svc.menuUrl  || svc.mapsUrl || undefined,
    ImageUrl:    svc.image    || undefined,
    MenuUrl:     svc.menuUrl  || undefined,
    MapsUrl:     svc.mapsUrl  || undefined,
  };
}

function buildTripEvent(svc, cartItem, lang, sortOrder) {
  const baseName = clean(cartItem?.title || cartItem?.name || svc.name);

  // QB code in Title → always visible in Travefy event list
  const codeTag  = svc.quickbooksCode ? ` [${svc.quickbooksCode}]` : "";
  const title    = `${baseName}${codeTag}`;

  // Description on TripEvent → populates the "Notes" rich-text field in Travefy Classic Editor
  // TripIdeas → always show as "Attachments" (not Notes), so we keep them only for the image
  const desc = buildDescription(svc, cartItem, lang);

  // Image-only TripIdea (so Travefy shows the photo card in the share view)
  const ideaWithImage = {
    Title:    baseName,
    Name:     baseName,
    ImageUrl: svc.image || undefined,
    // Description intentionally empty here — real content is in TripEvent.Description above
  };

  return {
    SortOrder:   sortOrder,
    Title:       title,
    Description: desc,
    Notes:       desc,
    StartTime:   clean(cartItem?.time || cartItem?.startTime || svc.schedule) || undefined,
    Duration:    svc.duration || undefined,
    Address:     svc.address  || undefined,
    EventTypeId: eventTypeId(svc.category),
    TripIdeas:   svc.image ? [ideaWithImage] : [],
  };
}

/* ── Supplemental day: WELCOME / COVER ───────────────────────────── */

function buildWelcomeDay(meta, lang) {
  const lines = [];

  // ── Concierge header (mirrors Travefy PDF top-left block) ──
  if (meta.conciergeName)  lines.push(meta.conciergeName);
  if (meta.conciergeEmail) lines.push(meta.conciergeEmail);
  if (meta.conciergeTitle) lines.push(meta.conciergeTitle);
  lines.push("https://two.travel/");
  lines.push("Two Travel");
  lines.push("");

  // ── Trip title bar ──
  const tripLabel = [meta.guestName, meta.city, meta.tripDates]
    .filter(Boolean).join(" ");
  if (tripLabel) lines.push(tripLabel);
  if (meta.tripName && meta.tripName !== tripLabel) lines.push(meta.tripName);
  lines.push("");

  // ── Dates ──
  if (meta.tripDates) lines.push(meta.tripDates);
  lines.push("");

  // ── Accommodation block ──
  if (meta.accommodationName) {
    lines.push(meta.accommodationName);
    if (meta.accommodationAddr) lines.push(meta.accommodationAddr);
    lines.push("___");
    if (meta.groupSize) lines.push(meta.groupSize);
    lines.push("__");
    if (meta.checkIn)  lines.push(`Check-in: ${meta.checkIn}`);
    if (meta.checkOut) lines.push(`Check out: ${meta.checkOut}`);
    lines.push("__");
    lines.push("");
  }

  // ── Guest / contact ──
  if (meta.guestContact) lines.push(`Contact: ${meta.guestContact}`);
  lines.push("");

  // ── Concierge summary ──
  if (meta.conciergeSummary) { lines.push(meta.conciergeSummary); lines.push(""); }

  // ── Footer ──
  lines.push("___");
  lines.push(
    "All reservations are under Two Travel - " +
    (meta.guestName || "Guest") +
    ". Once a reservation has been confirmed, a cancellation fee may apply to certain experiences."
  );

  const desc = cap(lines.join("\n").trim());
  const eventTitle = [
    meta.guestName,
    meta.city,
    meta.tripDates,
  ].filter(Boolean).join(" ");

  return {
    SortOrder:      0,
    Title:          `Welcome — ${meta.guestName || "Your Trip"}`,
    IsSupplemental: true,
    TripEvents: [{
      SortOrder:   1,
      Title:       eventTitle || `${meta.guestName || "Your Trip"} - Two Travel Concierge`,
      Description: desc,
      Notes:       desc,
      EventTypeId: 0,
      TripIdeas:   [],
    }],
  };
}

/* ── Supplemental day: TRIP SUMMARY ─────────────────────────────── */

function buildSummaryDay(matched, lang) {
  const dayMap = new Map();
  matched.forEach(({ cartItem, service }) => {
    const key = clean(cartItem?.day || cartItem?.dayLabel || "Itinerary");
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push({ cartItem, service });
  });

  const lines = [];
  for (const [dayTitle, items] of dayMap) {
    lines.push(dayTitle);
    for (const { cartItem, service } of items) {
      const t    = clean(cartItem?.time || service.schedule);
      const loc  = service.location ? ` - ${service.location}` : "";
      const code = service.quickbooksCode ? ` [${service.quickbooksCode}]` : "";
      lines.push(`${t ? t + " " : ""}${service.name}${loc}${code}`);
    }
    lines.push("");
  }

  const desc = lines.join("\n").trim();

  return {
    SortOrder:      1,
    Title:          lang === "es" ? "Resumen del Viaje" : "Trip Summary",
    IsSupplemental: true,
    TripEvents: [{
      SortOrder:   1,
      Title:       lang === "es" ? "Resumen Completo del Itinerario" : "Full Itinerary Overview",
      Description: cap(desc),
      Notes:       cap(desc),
      EventTypeId: 0,
      TripIdeas:   [],
    }],
  };
}

/* ── Supplemental day: INFORMATION & DOCUMENTS + PROMO ──────────── */

function buildInfoDay(lang, meta) {
  const city = meta.city || meta.tripName?.split(" ")?.[0] || "your destination";

  const WELCOME_EN =
`Take a look - ${city}
Please take a look at this PDF before your arrival. It contains some information that might be helpful during your trip.

Welcome to ${city} - Two Travel.

This is a DRAFT itinerary - everything can be adjusted. We can change, add, or remove activities based on what excites you most. In our next meeting we will go through it together and refine it accordingly.

Promo!
Show everyone how amazing it is to travel with Two Travel's concierge service and get discounts on our experiences!
Follow us: @twotravelconcierge on Instagram and TikTok.

Note:
- The post must be made during your stay in the city.
- One tag per person is required to redeem the service discount.
- For group services (such as transport or private chef), all members must participate to apply the discount.`;

  const WELCOME_ES =
`Bienvenido a ${city} - Two Travel.

Por favor revisa este documento antes de tu llegada. Contiene informacion util para tu viaje.

Como leer este itinerario
Este es un itinerario en BORRADOR - todo puede ajustarse. Podemos cambiar, agregar o eliminar actividades segun lo que mas te emocione. En nuestra proxima reunion lo revisaremos juntos.

Promo!
Muestrale a todos lo increible que es viajar con el servicio de concierge de Two Travel y obtente descuentos en tus experiencias!
Siguenos: @twotravelconcierge en Instagram y TikTok.

Nota:
- La publicacion debe realizarse durante tu estadia en la ciudad.
- Se requiere un tag por persona para aplicar el descuento al servicio.
- Para servicios grupales (transporte, chef privado, etc.), todos los miembros deben participar para que aplique el descuento.`;

  const CTG_RECS_EN =
`Recommendations in Cartagena
────────────────────────────────

Coffee & Bakeries
  Cafe San Alberto — Award-winning specialty coffee. Calle del Arzobispado #36-57.
  Libertario — Artisan coffee in a relaxed courtyard. Calle de Badillo.
  Epoca Cafe Bar — Coffee by day, bar by night. No reservations, arrive early.
  La Manchuria — Chill corner cafe, good filter coffee. Centro Historico.
  Ely — Famous pan de bono, pastries & light breakfasts. Multiple locations.

Chocolate
  Evok — Artisan Colombian chocolate shop. Beautiful gifts and tastings.

Museums
  Museo del Oro Zenu — Free gold museum. Plaza de Bolivar.
  Museo Historico de Cartagena — Inside the Palacio de la Inquisicion.
  MAMCA — Modern art museum. Plaza de San Pedro.

Rooftops
  Townhouse — Stylish rooftop, great cocktails. Reservations recommended.
  Apogeo — Elegant penthouse bar with 360 views. Centro Historico.
  Buena Vida — Casual rooftop, great vibes.
  Mirador — Laid-back viewpoint. Best at sunset.

────────────────────────────────

Shopping
  La Serrezuela: Malva, Artesanias de Colombia, Loto del Sur.
  Walled City: Soloio, Agua de Leon, St Dom, Casa Chiqui, Territorio.

────────────────────────────────

Brunch
  Al Alma — Stunning colonial mansion courtyard. Famous eggs benny and acai bowls. Reservations strongly recommended. Calle del Santisimo #8-19.
  Ely Centro Historico — Local institution. Pan de bono, juices, empanadas. Casual & beloved. Calle Segunda de Badillo.
  Epoca Cafe Bar — Trendy brunch with great coffee. No reservations, arrive early. Calle de la Mantilla.

────────────────────────────────

Lunch
  Pezetarian — Plant-forward Mediterranean. Beautiful Walled City spot. Reservations recommended.
  Kona — Hawaiian poke bowls and fresh seafood. Light and fresh. Plaza de San Diego.
  Buena Vida Marisqueria — Great ceviche and grilled fish. Popular with locals.
  Tacos del Gordo — Authentic Mexican street tacos. Very affordable. Getsemani.

Getsemani Lunch
  El Beso — Colombian fusion, colorful decor. Neighborhood gem.
  Cocina de Pepina — Traditional home cooking, grandmother recipes. Soulful.
  Casa del Tunel — Relaxed courtyard in a colonial house. Good cocktails.
  Carta Ajena / OSH — Creative cocktails and food. One of Getsemani's coolest spots.

────────────────────────────────

Places to Visit (free / walking)
  Plaza de San Diego, Plaza Fernandez de Madrid, Plaza de la Merced,
  Plaza Santo Domingo (Botero sculpture), Plaza Bolivar, San Pedro Claver Church,
  Plaza de la Aduana, Plaza de los Coches (Portal de los Dulces),
  Clock Tower — main entrance to the Walled City.`;

  const CTG_RECS_ES =
`Recomendaciones en Cartagena
────────────────────────────────

Cafes y Panaderias
  Cafe San Alberto — Cafe de especialidad premiado. Calle del Arzobispado #36-57.
  Libertario — Cafe artesanal en patio tranquilo. Calle de Badillo.
  Epoca Cafe Bar — Cafe de dia, bar de noche. Sin reservas, llegar temprano.
  La Manchuria — Cafe de esquina, buen cafe filtrado. Centro Historico.
  Ely — Famoso por pan de bono, pasteles y desayunos ligeros. Varias sedes.

Chocolateria
  Evok — Chocolateria artesanal colombiana. Regalos y degustaciones.

Museos
  Museo del Oro Zenu — Museo gratuito. Plaza de Bolivar.
  Museo Historico de Cartagena — Dentro del Palacio de la Inquisicion.
  MAMCA — Arte moderno. Plaza de San Pedro.

Rooftops
  Townhouse — Rooftop elegante, tragos excelentes. Reservas recomendadas.
  Apogeo — Bar penthouse con vista 360. Centro Historico.
  Buena Vida — Rooftop casual con buena energia.
  Mirador — Punto de vista tranquilo. Mejor al atardecer.

────────────────────────────────

Shopping
  La Serrezuela: Malva, Artesanias de Colombia, Loto del Sur.
  Ciudad Amurallada: Soloio, Agua de Leon, St Dom, Casa Chiqui, Territorio.

────────────────────────────────

Brunch
  Al Alma — Patio colonial impresionante. Famoso por eggs benny y bowls de acai. Reservas indispensables. Calle del Santisimo #8-19.
  Ely Centro Historico — Institucion cartagenera. Pan de bono, jugos, empanadas. Calle Segunda de Badillo.
  Epoca Cafe Bar — Brunch trendy con excelente cafe. Sin reservas, llegar temprano. Calle de la Mantilla.

────────────────────────────────

Almuerzo
  Pezetarian — Mediterraneo plant-forward. Spot precioso en la Ciudad Amurallada. Reservas recomendadas.
  Kona — Poke bowls hawaianos y mariscos frescos. Plaza de San Diego.
  Buena Vida Marisqueria — Excelente ceviche y pescado a la brasa.
  Tacos del Gordo — Tacos mexicanos autenticos. Muy economico. Getsemani.

Almuerzo en Getsemani
  El Beso — Fusion colombiana, decor colorido. Joya del barrio.
  Cocina de Pepina — Cocina casera tradicional, recetas de abuela.
  Casa del Tunel — Patio colonial relajado. Buenos cocteles.
  Carta Ajena / OSH — Cocteles creativos y cocina. Uno de los spots mas cool de Getsemani.

────────────────────────────────

Lugares para visitar (gratis / caminando)
  Plaza de San Diego, Plaza Fernandez de Madrid, Plaza de la Merced,
  Plaza Santo Domingo (escultura de Botero), Plaza Bolivar, Iglesia San Pedro Claver,
  Plaza de la Aduana, Plaza de los Coches (Portal de los Dulces),
  Torre del Reloj — entrada principal a la Ciudad Amurallada.`;

  const RECS = lang === "es" ? CTG_RECS_ES : CTG_RECS_EN;
  const welcome = lang === "es" ? WELCOME_ES : WELCOME_EN;

  // Event 1 — Welcome message + promo
  const welcomeDesc = cap(welcome, 3000);

  // Event 2 — Links & Resources (pre-trip content from concierge, or default links)
  const defaultLinks = [
    "Pre Check-in Form: https://forms.gle/REPLACE_WITH_FORM_LINK",
    "Drink Calculator: https://two.travel/drinks",
    "Cartagena City Guide: https://two.travel/ctg-guide.pdf",
    "WhatsApp Concierge: https://wa.me/573001234567",
  ].join("\n");
  const linksBody = meta.preTripContent ? clean(meta.preTripContent) : defaultLinks;

  // Event 3 — CTG Recommendations (always present, rich formatted)
  const recsDesc = cap(RECS, 3000);

  const events = [
    {
      SortOrder:   1,
      Title:       lang === "es"
        ? `Bienvenido a ${city} — Two Travel`
        : `Welcome to ${city} — Two Travel`,
      Description: welcomeDesc,
      Notes:       welcomeDesc,
      EventTypeId: 0,
      TripIdeas:   [],
    },
    {
      SortOrder:   2,
      Title:       lang === "es" ? "Links y Recursos" : "Links & Resources",
      Description: cap(linksBody, 3000),
      Notes:       cap(linksBody, 3000),
      EventTypeId: 0,
      TripIdeas:   [],
    },
    {
      SortOrder:   3,
      Title:       lang === "es" ? "Recomendaciones en CTG" : "CTG Recommendations",
      Description: recsDesc,
      Notes:       recsDesc,
      EventTypeId: 0,
      TripIdeas:   [],
    },
  ];

  return {
    SortOrder:      2,
    Title:          lang === "es" ? "Información y Documentos" : "Information & Documents",
    IsSupplemental: true,
    TripEvents:     events,
  };
}

/* ── Supplemental day: ACCOUNTING REFERENCE ────────────────────── */
// Each QB code gets its own TripEvent so the code is visible in Travefy's
// list view (TripEvent.Title always renders, even when Description doesn't).

function buildAccountingDay(matched, meta) {
  const events = [];
  let sort = 1;

  // ── Client info events (visible in list as [1A][Name] etc.) ──
  const clientLines = [];
  if (meta.guestName)    clientLines.push(`[1A][${meta.guestName}]`);
  if (meta.guestContact) clientLines.push(`[2A][${meta.guestContact}]`);
  if (meta.startDate)    clientLines.push(`[3A][${meta.startDate}]`);
  if (meta.endDate)      clientLines.push(`[4A][${meta.endDate}]`);

  if (clientLines.length) {
    const clientDesc = clientLines.join("\n");
    events.push({
      SortOrder:   sort++,
      Title:       clientLines.join("  "),
      Description: clientDesc,
      Notes:       clientDesc,
      EventTypeId: 0,
      TripIdeas:   [],
    });
  }

  // ── One TripEvent per service with QB code in the Title ──
  const withCodes = matched.filter(({ service }) => service.quickbooksCode);
  for (const { service } of withCodes) {
    const price = parseNum(service.priceCop || service.priceTier1);
    const eventTitle = `[${service.quickbooksCode}][${price}] ${service.name}`;
    const ideaDesc   = `[${service.quickbooksCode}][${price}][${service.category}:${service.name}]`;

    events.push({
      SortOrder:   sort++,
      Title:       eventTitle,
      Description: ideaDesc,
      Notes:       ideaDesc,
      EventTypeId: 0,
      TripIdeas:   [],
    });
  }

  // ── Internal notes as final event if present ──
  if (meta.internalNotes) {
    events.push({
      SortOrder:   sort++,
      Title:       "Internal Notes",
      Description: meta.internalNotes,
      Notes:       meta.internalNotes,
      EventTypeId: 0,
      TripIdeas:   [],
    });
  }

  // Fallback: if no services have codes, at least show client info
  if (events.length === 0) return null;

  return {
    SortOrder:      9999,
    Title:          "Accounting Reference",
    IsSupplemental: true,
    TripEvents:     events,
  };
}

/* ══════════════════════════════════════════════════════════════════
   ASSEMBLE ALL TRIPDAYS
   Order: Welcome (supplemental 0) → Summary (1) → Info & Docs (2)
          → Service days (sorted by cart day label)
          → Accounting Reference (supplemental 9999)
══════════════════════════════════════════════════════════════════ */

function buildTripDays(matched, lang, meta) {
  // Respect dayMeta order if provided, otherwise use insertion order
  const dayMetaList = Array.isArray(meta.dayMeta) ? meta.dayMeta : [];

  // Group cart items by dayLabel
  const dayMap = new Map();
  matched.forEach(({ cartItem, service }, idx) => {
    const key = clean(cartItem?.dayLabel || cartItem?.day || "Itinerary");
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push({ cartItem, service, idx });
  });

  // Build ordered list of day labels: dayMeta order first, then any extras
  const metaLabels  = dayMetaList.map(dm => clean(dm.label)).filter(Boolean);
  const extraLabels = [...dayMap.keys()].filter(k => !metaLabels.includes(k));
  const orderedLabels = [...metaLabels.filter(l => dayMap.has(l)), ...extraLabels];

  // One TripDay per unique day label
  const serviceDays = orderedLabels.map((label, di) => {
    const items = dayMap.get(label) || [];
    // dayMeta provides the descriptive title (e.g. "ARRIVALS + CHECK IN + DINNER AT LA VITROLA")
    const dm = dayMetaList.find(d => clean(d.label) === label);
    // Travefy day title = label + " — " + description, or just label
    const dayTitle = dm?.title
      ? `${label} — ${dm.title}`
      : label;

    return {
      SortOrder:      di + 10,
      Title:          dayTitle,
      IsSupplemental: false,
      TripEvents: items
        .sort((a, b) =>
          (Number(a.cartItem?.sortOrder ?? a.idx)) -
          (Number(b.cartItem?.sortOrder ?? b.idx))
        )
        .map(({ cartItem, service }, ei) =>
          buildTripEvent(service, cartItem, lang, ei + 1)
        ),
    };
  });

  return [
    buildWelcomeDay(meta, lang),        // SortOrder 0  — supplemental
    buildSummaryDay(matched, lang),     // SortOrder 1  — supplemental
    buildInfoDay(lang, meta),           // SortOrder 2  — supplemental
    ...serviceDays,                     // SortOrder 10+ — real itinerary
    buildAccountingDay(matched, meta),  // SortOrder 9999 — supplemental
  ];
}

/* ══════════════════════════════════════════════════════════════════
   TRIP-LEVEL NOTES  (plain-text fallback shown in Travefy trip overview)
══════════════════════════════════════════════════════════════════ */

function buildNotes(matched, lang, meta) {
  const lines = [];
  lines.push("TWO TRAVEL — Concierge Itinerary");
  lines.push("https://two.travel/");
  lines.push("");
  if (meta.guestName)      lines.push(`Guest:      ${meta.guestName}`);
  if (meta.guestContact)   lines.push(`Contact:    ${meta.guestContact}`);
  if (meta.conciergeName)  lines.push(`Concierge:  ${meta.conciergeName}`);
  if (meta.conciergeEmail) lines.push(`Email:      ${meta.conciergeEmail}`);
  lines.push("");

  if (meta.conciergeSummary) { lines.push(meta.conciergeSummary); lines.push(""); }

  // Day-by-day summary with billing codes
  const dayMap = new Map();
  matched.forEach(({ cartItem, service }) => {
    const key = clean(cartItem?.day || "Itinerary");
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push({ cartItem, service });
  });

  for (const [day, items] of dayMap) {
    lines.push(`── ${day} ──`);
    for (const { cartItem, service } of items) {
      const t    = clean(cartItem?.time || service.schedule);
      const code = service.quickbooksCode ? ` [${service.quickbooksCode}]` : "";
      lines.push(`${t ? t + "  " : ""}${service.name}${code}`);
    }
    lines.push("");
  }

  // Accounting summary at the bottom
  const withCodes = matched.filter(({ service }) => service.quickbooksCode);
  if (withCodes.length) {
    lines.push("── ACCOUNTING REFERENCE ──");
    if (meta.guestName)    lines.push(`[1A][${meta.guestName}]`);
    if (meta.guestContact) lines.push(`[2A][${meta.guestContact}]`);
    for (const { service } of withCodes) {
      const p = parseNum(service.priceCop || service.priceTier1);
      lines.push(`[${service.quickbooksCode}][${p}][${service.category}:${service.name}]`);
    }
  }

  return lines.join("\n").trim();
}

/* ══════════════════════════════════════════════════════════════════
   HANDLER
══════════════════════════════════════════════════════════════════ */

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const {
      guestName         = "",
      tripName          = "",
      guestContact      = "",
      lang              = "en",
      cart              = [],
      dayMeta           = [],
      conciergeSummary  = "",
      internalNotes     = "",
      conciergeName     = "",
      conciergeEmail    = "",
      conciergeTitle    = "",
      city              = "",
      tripDates         = "",
      groupSize         = "",
      accommodationName = "",
      accommodationAddr = "",
      checkIn           = "",
      checkOut          = "",
      startDate         = "",
      endDate           = "",
      preTripContent    = "",
    } = req.body || {};

    const publicKey   = process.env.TRAVEFY_PUBLIC_KEY;
    const accessToken = process.env.TRAVEFY_ACCESS_TOKEN;
    if (!publicKey || !accessToken)
      return res.status(500).json({ ok: false, error: "Missing Travefy env vars" });

    const headers = {
      "X-API-PUBLIC-KEY": publicKey,
      "X-USER-TOKEN":     accessToken,
      "Content-Type":     "application/json",
      Accept:             "application/json",
    };

    // ── 1. Fetch catalog + match cart ────────────────────────────
    const catalog = await fetchCatalog();
    const { matched, unmatched } = matchCart(cart, catalog);

    // ── 2. Build meta ────────────────────────────────────────────
    const meta = {
      guestName, guestContact, conciergeSummary,
      internalNotes, conciergeName, conciergeEmail,
      conciergeTitle, city, tripName, tripDates,
      groupSize, accommodationName, accommodationAddr,
      checkIn, checkOut, startDate, endDate,
      dayMeta, preTripContent,
    };

    // ── 3. Build full Travefy structure ──────────────────────────
    const tripDays = buildTripDays(matched, lang, meta);
    const notes    = buildNotes(matched, lang, meta);

    const payload = {
      Name:                tripName || guestName || "New Trip",
      PrimaryTravelerName: guestName || "Guest",
      Notes:               notes,
      TripDays:            tripDays,
    };

    // ── 4. POST /trips ────────────────────────────────────────────
    const tripRes = await fetch(`${TRAVEFY_BASE}/trips`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const raw = await tripRes.text();
    let trip = null;
    try { trip = JSON.parse(raw); } catch {}

    if (!tripRes.ok) {
      return res.status(tripRes.status).json({
        ok:              false,
        error:           `Travefy rejected trip creation (${tripRes.status})`,
        travefyResponse: raw.slice(0, 800),
        sentPayload: {
          Name:    payload.Name,
          TripDays: tripDays.map((d) => ({
            sortOrder:      d.SortOrder,
            title:          d.Title,
            isSupplemental: d.IsSupplemental,
            events:         d.TripEvents?.length ?? 0,
          })),
        },
      });
    }

    const tripId   = trip?.Id  ?? trip?.id  ?? null;
    const shareUrl = trip?.ShareUrlPath
      ? `https://www.travefy.com/${trip.ShareUrlPath}`
      : null;

    const returnedDays = trip?.TripDays ?? trip?.Days ?? [];

    // Accounting reference summary (returned to frontend for display)
    const accountingReference = matched
      .filter(({ service }) => service.quickbooksCode)
      .map(({ service }) => {
        const p = parseNum(service.priceCop || service.priceTier1);
        return {
          code:     service.quickbooksCode,
          name:     service.name,
          category: service.category,
          price:    p,
          inline:   `[${service.quickbooksCode}][${p}]`,
          full:     `[${service.quickbooksCode}][${p}][${service.category}:${service.name}]`,
        };
      });

    return res.status(200).json({
      ok:      true,
      message: shareUrl
        ? `✅ Trip creado en Travefy — ${shareUrl}`
        : "✅ Trip creado en Travefy",
      tripId,
      shareUrl,

      matched:           matched.length,
      unmatched:         unmatched.length,
      unmatchedServices: unmatched,

      summaryLines: matched.map(({ cartItem, service }) => {
        const t    = clean(cartItem?.time || service.schedule);
        const loc  = service.location ? ` — ${service.location}` : "";
        const code = service.quickbooksCode ? ` [${service.quickbooksCode}]` : "";
        return `${t ? t + " " : ""}${service.name}${loc}${code}`;
      }),

      accountingReference,

      _structure: {
        daysAccepted:            returnedDays.length > 0,
        daysCount:               returnedDays.length,
        supplementalDays:        tripDays.filter((d) =>  d.IsSupplemental).length,
        serviceDays:             tripDays.filter((d) => !d.IsSupplemental).length,
        eventsInFirstServiceDay: tripDays.find((d) => !d.IsSupplemental)?.TripEvents?.length ?? 0,
        responseKeys:            trip ? Object.keys(trip) : [],
      },
    });

  } catch (err) {
    console.error("travefy-send:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
