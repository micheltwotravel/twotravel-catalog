// ═══════════════════════════════════════════════════════════════════
// TWO TRAVEL — PROPERTIES DATABASE (Google Apps Script snippet)
// v2 — adds all columns from TwoTravel_Properties_All_In_One_Sheet.xlsx
// ═══════════════════════════════════════════════════════════════════

const PROP_SHEET = "Properties";

// IMPORTANT: DO NOT reorder existing columns after first use.
// New columns must be appended at the end (before createdAt/updatedAt).
const PROP_COLS = [
  "id",
  // ── Core identity ──────────────────────────────────────────────
  "Name",
  "City",
  "Item Type",
  "Neighborhood",
  "Neighborhood Summary",
  "Location",
  "Address",
  "Status",
  // ── Capacity ───────────────────────────────────────────────────
  "Max Pax",
  "Bedrooms",
  "Bathrooms",
  "Beds",
  "Capacity",
  "Feet",
  // ── Pricing ────────────────────────────────────────────────────
  "Client Price",
  "Our Price",
  "Price Range",
  "Quote 2025",
  "Commission Tier",
  // ── Policies ───────────────────────────────────────────────────
  "Cancellation Policy",
  "Check-in Time",
  "Check-out Time",
  "Min Hours",
  "Max Hours",
  // ── Contact ────────────────────────────────────────────────────
  "Contact Name",
  "Contact",
  "Contact Phone",
  "Owner / POC",
  "WhatsApp Group",
  "Staff Contact",
  // ── Links ──────────────────────────────────────────────────────
  "Airbnb Link",
  "Alternative Airbnb Links",
  "Photos Link",
  "Alternative Photos Links",
  "Twp Travel Webpage",
  "Website Link",
  "Two Travel Website Link",
  "Alternative Webpage Links",
  "PDF Link",
  "Updated PDF Link",
  // ── Content ────────────────────────────────────────────────────
  "Description",
  "Notes",
  "Internal Notes",
  "Availability Notes",
  // ── Classification ─────────────────────────────────────────────
  "Venue Type",
  "Subtype / Boat Type",
  "Amenities",
  "Includes",
  "Extras",
  "Tags",
  // ── Attributes ─────────────────────────────────────────────────
  "Rating",
  "Bachelor / Party Friendly",
  "Payment Methods",
  // ── Boat-specific ──────────────────────────────────────────────
  "Boat Brand / Model",
  "Dock Location",
  "AC Below Deck",
  // ── Timestamps ─────────────────────────────────────────────────
  "createdAt",
  "updatedAt",
];

// Maps every alias/variant → canonical column name
const PROP_ALIASES = {
  // Identity
  "name":                         "Name",
  "city":                         "City",
  "item type":                    "Item Type",
  "type":                         "Item Type",
  "itemtype":                     "Item Type",
  "itemType":                     "Item Type",
  "neighborhood":                 "Neighborhood",
  "neighborhood summary":         "Neighborhood Summary",
  "neighborhoodsummary":          "Neighborhood Summary",
  "location":                     "Location",
  "address":                      "Address",
  "status":                       "Status",
  // Capacity
  "max pax":                      "Max Pax",
  "maxpax":                       "Max Pax",
  "maxPax":                       "Max Pax",
  "bedrooms":                     "Bedrooms",
  "bathrooms":                    "Bathrooms",
  "beds":                         "Beds",
  "capacity":                     "Capacity",
  "feet":                         "Feet",
  // Pricing
  "client price":                 "Client Price",
  "clientprice":                  "Client Price",
  "clientPrice":                  "Client Price",
  "our price":                    "Our Price",
  "ourprice":                     "Our Price",
  "ourPrice":                     "Our Price",
  "price range":                  "Price Range",
  "pricerange":                   "Price Range",
  "priceRange":                   "Price Range",
  "quote 2025":                   "Quote 2025",
  "quote2025":                    "Quote 2025",
  "commission tier":              "Commission Tier",
  "commissiontier":               "Commission Tier",
  "commissionTier":               "Commission Tier",
  // Policies
  "cancellation policy":          "Cancellation Policy",
  "cancellationpolicy":           "Cancellation Policy",
  "cancellationPolicy":           "Cancellation Policy",
  "check-in time":                "Check-in Time",
  "checkin":                      "Check-in Time",
  "checkIn":                      "Check-in Time",
  "check-out time":               "Check-out Time",
  "checkout":                     "Check-out Time",
  "checkOut":                     "Check-out Time",
  "min hours":                    "Min Hours",
  "minhours":                     "Min Hours",
  "minHours":                     "Min Hours",
  "max hours":                    "Max Hours",
  "maxhours":                     "Max Hours",
  "maxHours":                     "Max Hours",
  // Contact
  "contact name":                 "Contact Name",
  "contactname":                  "Contact Name",
  "contactName":                  "Contact Name",
  "contact":                      "Contact",
  "contact phone":                "Contact Phone",
  "contactphone":                 "Contact Phone",
  "contactPhone":                 "Contact Phone",
  "owner / poc":                  "Owner / POC",
  "owner":                        "Owner / POC",
  "poc":                          "Owner / POC",
  "whatsapp group":               "WhatsApp Group",
  "whatsappgroup":                "WhatsApp Group",
  "whatsappGroup":                "WhatsApp Group",
  "staff contact":                "Staff Contact",
  "staffcontact":                 "Staff Contact",
  "staffContact":                 "Staff Contact",
  // Links
  "airbnb link":                  "Airbnb Link",
  "airbnblink":                   "Airbnb Link",
  "airbnbLink":                   "Airbnb Link",
  "alternative airbnb links":     "Alternative Airbnb Links",
  "photos link":                  "Photos Link",
  "photoslink":                   "Photos Link",
  "photosLink":                   "Photos Link",
  "alternative photos links":     "Alternative Photos Links",
  "twp travel webpage":           "Twp Travel Webpage",
  "webpage":                      "Twp Travel Webpage",
  "website link":                 "Website Link",
  "websitelink":                  "Website Link",
  "websiteLink":                  "Website Link",
  "two travel website link":      "Two Travel Website Link",
  "alternative webpage links":    "Alternative Webpage Links",
  "pdf link":                     "PDF Link",
  "pdflink":                      "PDF Link",
  "pdfLink":                      "PDF Link",
  "updated pdf link":             "Updated PDF Link",
  "updatedpdflink":               "Updated PDF Link",
  "updatedPdfLink":               "Updated PDF Link",
  // Content
  "description":                  "Description",
  "notes":                        "Notes",
  "internal notes":               "Internal Notes",
  "internalnotes":                "Internal Notes",
  "internalNotes":                "Internal Notes",
  "availability notes":           "Availability Notes",
  "availabilitynotes":            "Availability Notes",
  "availabilityNotes":            "Availability Notes",
  // Classification
  "venue type":                   "Venue Type",
  "venuetype":                    "Venue Type",
  "venueType":                    "Venue Type",
  "subtype / boat type":          "Subtype / Boat Type",
  "subtype":                      "Subtype / Boat Type",
  "boat type":                    "Subtype / Boat Type",
  "boattype":                     "Subtype / Boat Type",
  "boatType":                     "Subtype / Boat Type",
  "amenities":                    "Amenities",
  "includes":                     "Includes",
  "extras":                       "Extras",
  "tags":                         "Tags",
  // Attributes
  "rating":                       "Rating",
  "bachelor / party friendly":    "Bachelor / Party Friendly",
  "bachelor friendly":            "Bachelor / Party Friendly",
  "bachelorfriendly":             "Bachelor / Party Friendly",
  "bachelorFriendly":             "Bachelor / Party Friendly",
  "party friendly":               "Bachelor / Party Friendly",
  "payment methods":              "Payment Methods",
  "paymentmethods":               "Payment Methods",
  "paymentMethods":               "Payment Methods",
  // Boat-specific
  "boat brand / model":           "Boat Brand / Model",
  "boat brand":                   "Boat Brand / Model",
  "boat model":                   "Boat Brand / Model",
  "boatbrand":                    "Boat Brand / Model",
  "boatBrand":                    "Boat Brand / Model",
  "dock location":                "Dock Location",
  "docklocation":                 "Dock Location",
  "dockLocation":                 "Dock Location",
  "ac below deck":                "AC Below Deck",
  "acbelowdeck":                  "AC Below Deck",
  "acBelowDeck":                  "AC Below Deck",
  // Timestamps
  "createdat":                    "createdAt",
  "createdAt":                    "createdAt",
  "updatedat":                    "updatedAt",
  "updatedAt":                    "updatedAt",
};

function normalize(key) {
  return PROP_ALIASES[key] || PROP_ALIASES[(key||'').toLowerCase()] || key;
}

// ── Sheet helpers ─────────────────────────────────────────────────────

function getPropSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(PROP_SHEET);
  if (!sh) {
    sh = ss.insertSheet(PROP_SHEET);
    sh.appendRow(PROP_COLS);
    sh.setFrozenRows(1);
    const hdr = sh.getRange(1, 1, 1, PROP_COLS.length);
    hdr.setFontWeight("bold");
    hdr.setBackground("#1a1814");
    hdr.setFontColor("#ffffff");
    sh.setColumnWidth(1, 170);
    sh.setColumnWidth(2, 210);
    sh.setColumnWidth(3, 110);
    sh.setColumnWidth(4, 120);
    sh.setColumnWidth(5, 150);
  }
  return sh;
}

// Add missing columns to an existing sheet (safe to run on live data)
function addMissingColumns_() {
  const sh = getPropSheet_();
  const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const missing = PROP_COLS.filter(c => !existing.includes(c));
  if (!missing.length) { Logger.log("No missing columns."); return; }
  missing.forEach(col => {
    const nextCol = sh.getLastColumn() + 1;
    sh.getRange(1, nextCol).setValue(col);
    sh.getRange(1, nextCol).setFontWeight("bold").setBackground("#1a1814").setFontColor("#ffffff");
    Logger.log("Added column: " + col);
  });
  Logger.log("Done. Added " + missing.length + " columns.");
}

function rowToObj_(row, headers) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
  // Lowercase aliases for front-end compatibility
  const aliases = {
    "name":"Name","city":"City","item type":"Item Type","neighborhood":"Neighborhood",
    "max pax":"Max Pax","bedrooms":"Bedrooms","bathrooms":"Bathrooms","beds":"Beds",
    "capacity":"Capacity","feet":"Feet","client price":"Client Price",
    "our price":"Our Price","price range":"Price Range",
    "cancellation policy":"Cancellation Policy","check-in time":"Check-in Time",
    "check-out time":"Check-out Time","contact name":"Contact Name",
    "contact":"Contact","contact phone":"Contact Phone","airbnb link":"Airbnb Link",
    "photos link":"Photos Link","twp travel webpage":"Twp Travel Webpage",
    "description":"Description","notes":"Notes","internal notes":"Internal Notes",
    "venue type":"Venue Type","amenities":"Amenities","status":"Status",
    "tags":"Tags","rating":"Rating","pdf link":"PDF Link",
    "website link":"Website Link","commission tier":"Commission Tier",
    "bachelor / party friendly":"Bachelor / Party Friendly",
    "subtype / boat type":"Subtype / Boat Type","dock location":"Dock Location",
    "includes":"Includes","extras":"Extras","availability notes":"Availability Notes",
    "whatsapp group":"WhatsApp Group","min hours":"Min Hours","max hours":"Max Hours",
  };
  Object.entries(aliases).forEach(([k,v]) => { obj[k] = obj[v] ?? ""; });
  return obj;
}

// ── Handlers ──────────────────────────────────────────────────────────

function handlePropertyList() {
  const sh = getPropSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { properties: [] };
  const headers = data[0];
  // Return slim version (skip long Description to reduce payload size)
  return {
    properties: data.slice(1)
      .map(r => rowToObj_(r, headers))
      .filter(o => o.Name || o.name)
  };
}

function handlePropertyGet(data) {
  const sh = getPropSheet_();
  const vals = sh.getDataRange().getValues();
  const headers = vals[0];
  const idIdx = headers.indexOf("id");
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][idIdx]) === String(data.id)) {
      return { property: rowToObj_(vals[i], headers) };
    }
  }
  return { error: "Not found" };
}

function handlePropertyCreate(data) {
  const sh = getPropSheet_();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const id = data.id || ("prop_" + Date.now());
  const now = new Date().toISOString();
  const row = headers.map(col => {
    if (col === "id")        return id;
    if (col === "createdAt") return data.createdAt || now;
    if (col === "updatedAt") return now;
    // Try exact match, then lowercase, then alias
    if (data[col] !== undefined) return data[col];
    const lc = col.toLowerCase();
    if (data[lc] !== undefined) return data[lc];
    const canonical = normalize(col);
    if (data[canonical] !== undefined) return data[canonical];
    return "";
  });
  sh.appendRow(row);
  return { ok: true, id };
}

function handlePropertyUpdate(data) {
  const sh = getPropSheet_();
  const vals = sh.getDataRange().getValues();
  const headers = vals[0];
  const idIdx = headers.indexOf("id");
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][idIdx]) === String(data.id)) {
      const now = new Date().toISOString();
      const updated = headers.map((col, j) => {
        if (col === "id")        return data.id;
        if (col === "updatedAt") return now;
        if (col === "createdAt") return vals[i][j];
        if (data[col] !== undefined) return data[col];
        const lc = col.toLowerCase();
        if (data[lc] !== undefined) return data[lc];
        return vals[i][j];
      });
      sh.getRange(i + 1, 1, 1, headers.length).setValues([updated]);
      return { ok: true };
    }
  }
  return { ok: false, error: "Not found: " + data.id };
}

function handlePropertyDelete(data) {
  const sh = getPropSheet_();
  const vals = sh.getDataRange().getValues();
  const idIdx = vals[0].indexOf("id");
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][idIdx]) === String(data.id)) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: "Not found: " + data.id };
}

// Bulk import — called with { properties: [...] }
// Each property object uses column names from the Excel sheet directly.
function handlePropertyBulk(data) {
  const sh = getPropSheet_();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const props = data.properties || [];
  if (!props.length) return { ok: false, error: "No properties provided" };

  const now = new Date().toISOString();
  const rows = props.map(p => {
    const id = p.id || p["Record ID"] || ("prop_" + Date.now() + "_" + Math.random().toString(36).slice(2,6));
    return headers.map(col => {
      if (col === "id")        return id;
      if (col === "createdAt") return p.createdAt || now;
      if (col === "updatedAt") return now;
      // Try exact, lowercase, alias
      if (p[col] !== undefined && p[col] !== null) return p[col];
      const lc = col.toLowerCase();
      if (p[lc] !== undefined && p[lc] !== null) return p[lc];
      const norm = normalize(col);
      if (p[norm] !== undefined && p[norm] !== null) return p[norm];
      return "";
    });
  });

  // Write in batches of 100
  let written = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    sh.getRange(sh.getLastRow() + 1, 1, batch.length, headers.length).setValues(batch);
    written += batch.length;
    SpreadsheetApp.flush();
  }
  return { ok: true, written };
}

// Run this once in GAS console to add new columns to existing sheet
// without breaking existing data.
function migrateAddColumns() {
  addMissingColumns_();
}

// ═══════════════════════════════════════════════════════════════════
// ADD/UPDATE THESE CASES IN YOUR doPost() SWITCH:
//
//   case "property_list":   return jsonResp(handlePropertyList());
//   case "property_get":    return jsonResp(handlePropertyGet(payload.data || {}));
//   case "property_create": return jsonResp(handlePropertyCreate(payload.data || {}));
//   case "property_update": return jsonResp(handlePropertyUpdate(payload.data || {}));
//   case "property_delete": return jsonResp(handlePropertyDelete(payload.data || {}));
//   case "property_bulk":   return jsonResp(handlePropertyBulk(payload.data || {}));
//
// THEN run migrateAddColumns() once from the GAS editor to add
// the new columns to your existing Properties sheet.
// ═══════════════════════════════════════════════════════════════════
