// ═══════════════════════════════════════════════════════════════════
// TWO TRAVEL — PROPERTIES DATABASE (Google Apps Script snippet)
// Paste this entire file into your GAS project, then add the 4 cases
// to your existing doPost() switch. The "Properties" sheet tab will
// be created automatically with all columns on first use.
// ═══════════════════════════════════════════════════════════════════

const PROP_SHEET = "Properties";

// Column order matches the original Notion/CSV export + new fields.
// DO NOT reorder after first use (would misalign existing data).
const PROP_COLS = [
  "id",
  "Name",
  "City",
  "Item Type",
  "Neighborhood",
  "Neighborhood Summary",
  "Location",
  "Status",
  "Max Pax",
  "Bedrooms",
  "Bathrooms",
  "Beds",
  "Capacity",
  "Feet",
  "Client Price",
  "Price Range",
  "Our Price",
  "Cancellation Policy",
  "Check-in Time",
  "Check-out Time",
  "Contact Name",
  "Contact",
  "Contact Phone",
  "Airbnb Link",
  "Photos Link",
  "Twp Travel Webpage",
  "Description",
  "Notes",
  "Venue Type",
  "Amenities",
  "Bachelor Friendly",
  "createdAt",
  "updatedAt",
];

// Maps lowercase/aliased keys from the form → canonical column names
const PROP_ALIASES = {
  "name":                   "Name",
  "city":                   "City",
  "item type":              "Item Type",
  "type":                   "Item Type",
  "neighborhood":           "Neighborhood",
  "neighborhood summary":   "Neighborhood Summary",
  "location":               "Location",
  "status":                 "Status",
  "max pax":                "Max Pax",
  "maxpax":                 "Max Pax",
  "maxPax":                 "Max Pax",
  "bedrooms":               "Bedrooms",
  "bathrooms":              "Bathrooms",
  "beds":                   "Beds",
  "capacity":               "Capacity",
  "feet":                   "Feet",
  "client price":           "Client Price",
  "clientprice":            "Client Price",
  "clientPrice":            "Client Price",
  "price range":            "Price Range",
  "pricerange":             "Price Range",
  "priceRange":             "Price Range",
  "our price":              "Our Price",
  "ourprice":               "Our Price",
  "ourPrice":               "Our Price",
  "cancellation policy":    "Cancellation Policy",
  "cancellationpolicy":     "Cancellation Policy",
  "cancellationPolicy":     "Cancellation Policy",
  "check-in time":          "Check-in Time",
  "checkin":                "Check-in Time",
  "checkIn":                "Check-in Time",
  "check-out time":         "Check-out Time",
  "checkout":               "Check-out Time",
  "checkOut":               "Check-out Time",
  "contact name":           "Contact Name",
  "contactname":            "Contact Name",
  "contactName":            "Contact Name",
  "contact":                "Contact",
  "contact phone":          "Contact Phone",
  "contactphone":           "Contact Phone",
  "contactPhone":           "Contact Phone",
  "airbnb link":            "Airbnb Link",
  "airbnblink":             "Airbnb Link",
  "airbnbLink":             "Airbnb Link",
  "photos link":            "Photos Link",
  "photoslink":             "Photos Link",
  "photosLink":             "Photos Link",
  "twp travel webpage":     "Twp Travel Webpage",
  "webpage":                "Twp Travel Webpage",
  "description":            "Description",
  "notes":                  "Notes",
  "venue type":             "Venue Type",
  "venuetype":              "Venue Type",
  "venueType":              "Venue Type",
  "amenities":              "Amenities",
  "bachelorfriendly":       "Bachelor Friendly",
  "bachelorFriendly":       "Bachelor Friendly",
  "bachelor friendly":      "Bachelor Friendly",
  "createdat":              "createdAt",
  "createdAt":              "createdAt",
  "updatedat":              "updatedAt",
  "updatedAt":              "updatedAt",
};

function normalize(key) {
  return PROP_ALIASES[key] || PROP_ALIASES[key.toLowerCase()] || key;
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
    sh.setColumnWidth(1, 170);  // id
    sh.setColumnWidth(2, 210);  // Name
    sh.setColumnWidth(3, 110);  // City
    sh.setColumnWidth(4, 120);  // Item Type
    sh.setColumnWidth(5, 150);  // Neighborhood
    sh.setColumnWidth(27, 350); // Description
    sh.setColumnWidth(28, 250); // Notes
    sh.setColumnWidth(30, 300); // Amenities
  }
  return sh;
}

function rowToObj_(row, headers) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
  // Expose lower-case aliases for front-end compatibility
  obj["name"]        = obj["Name"];
  obj["city"]        = obj["City"];
  obj["item type"]   = obj["Item Type"];
  obj["neighborhood"]= obj["Neighborhood"];
  obj["max pax"]     = obj["Max Pax"];
  obj["bedrooms"]    = obj["Bedrooms"];
  obj["bathrooms"]   = obj["Bathrooms"];
  obj["beds"]        = obj["Beds"];
  obj["capacity"]    = obj["Capacity"];
  obj["feet"]        = obj["Feet"];
  obj["client price"]= obj["Client Price"];
  obj["price range"] = obj["Price Range"];
  obj["our price"]   = obj["Our Price"];
  obj["cancellation policy"]  = obj["Cancellation Policy"];
  obj["check-in time"]        = obj["Check-in Time"];
  obj["check-out time"]       = obj["Check-out Time"];
  obj["contact name"]         = obj["Contact Name"];
  obj["contact"]              = obj["Contact"];
  obj["contact phone"]        = obj["Contact Phone"];
  obj["airbnb link"]          = obj["Airbnb Link"];
  obj["photos link"]          = obj["Photos Link"];
  obj["twp travel webpage"]   = obj["Twp Travel Webpage"];
  obj["description"]          = obj["Description"];
  obj["notes"]                = obj["Notes"];
  obj["venue type"]           = obj["Venue Type"];
  obj["amenities"]            = obj["Amenities"];
  obj["status"]               = obj["Status"];
  return obj;
}

// ── Handlers ──────────────────────────────────────────────────────────

function handlePropertyList() {
  const sh = getPropSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { properties: [] };
  const headers = data[0];
  return { properties: data.slice(1).map(r => rowToObj_(r, headers)).filter(o => o.Name || o.name) };
}

function handlePropertyCreate(data) {
  const sh = getPropSheet_();
  const id = data.id || ("prop_" + Date.now());
  const now = new Date().toISOString();
  const row = PROP_COLS.map(col => {
    if (col === "id")        return id;
    if (col === "createdAt") return data.createdAt || now;
    if (col === "updatedAt") return now;
    // Try canonical col name, then aliases
    return data[col] !== undefined ? data[col]
         : data[col.toLowerCase()] !== undefined ? data[col.toLowerCase()]
         : "";
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
        const v = data[col] !== undefined ? data[col]
                : data[col.toLowerCase()] !== undefined ? data[col.toLowerCase()]
                : null;
        return v !== null ? v : vals[i][j];
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

// ═══════════════════════════════════════════════════════════════════
// ADD THESE 4 CASES TO YOUR doPost() SWITCH:
//
//   case "property_list":   return jsonResp(handlePropertyList());
//   case "property_create": return jsonResp(handlePropertyCreate(payload.data || {}));
//   case "property_update": return jsonResp(handlePropertyUpdate(payload.data || {}));
//   case "property_delete": return jsonResp(handlePropertyDelete(payload.data || {}));
//
// ═══════════════════════════════════════════════════════════════════
