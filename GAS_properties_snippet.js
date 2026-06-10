// ─────────────────────────────────────────────────────────────
// PROPERTIES DATABASE — paste this into your Google Apps Script
// ─────────────────────────────────────────────────────────────
// This handles: property_list, property_create, property_update, property_delete
// The sheet tab will be created automatically if it doesn't exist.
// ─────────────────────────────────────────────────────────────

const PROP_SHEET_NAME = "Properties";

// Column order (DO NOT REORDER after first use)
const PROP_COLS = [
  "id","name","city","type","neighborhood","status",
  "maxPax","bedrooms","bathrooms","bachelorFriendly",
  "clientPrice","ourPrice",
  "airbnbLink","photosLink","description","amenities",
  "createdAt","updatedAt"
];

function getPropSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(PROP_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(PROP_SHEET_NAME);
    sh.appendRow(PROP_COLS);
    sh.setFrozenRows(1);
    // Style the header row
    const hdr = sh.getRange(1, 1, 1, PROP_COLS.length);
    hdr.setFontWeight("bold");
    hdr.setBackground("#1a1814");
    hdr.setFontColor("#ffffff");
    sh.setColumnWidth(1, 160);  // id
    sh.setColumnWidth(2, 200);  // name
    sh.setColumnWidth(3, 110);  // city
    sh.setColumnWidth(15, 300); // description
    sh.setColumnWidth(16, 300); // amenities
  }
  return sh;
}

function propRowToObj(row) {
  const obj = {};
  PROP_COLS.forEach((col, i) => { obj[col] = row[i] || ""; });
  return obj;
}

function handlePropertyList() {
  const sh = getPropSheet();
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { properties: [] };
  const rows = data.slice(1).map(propRowToObj);
  return { properties: rows };
}

function handlePropertyCreate(data) {
  const sh = getPropSheet();
  const id = data.id || ("prop_" + Date.now());
  const now = new Date().toISOString();
  const row = PROP_COLS.map(col => {
    if (col === "id")        return id;
    if (col === "createdAt") return data.createdAt || now;
    if (col === "updatedAt") return now;
    return data[col] || "";
  });
  sh.appendRow(row);
  return { ok: true, id };
}

function handlePropertyUpdate(data) {
  const sh = getPropSheet();
  const rows = sh.getDataRange().getValues();
  const idColIdx = PROP_COLS.indexOf("id");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idColIdx] === data.id) {
      const now = new Date().toISOString();
      const updated = PROP_COLS.map((col, j) => {
        if (col === "id")        return data.id;
        if (col === "updatedAt") return now;
        if (col === "createdAt") return rows[i][j]; // preserve original
        return data[col] !== undefined ? data[col] : rows[i][j];
      });
      sh.getRange(i + 1, 1, 1, PROP_COLS.length).setValues([updated]);
      return { ok: true };
    }
  }
  return { ok: false, error: "Property not found: " + data.id };
}

function handlePropertyDelete(data) {
  const sh = getPropSheet();
  const rows = sh.getDataRange().getValues();
  const idColIdx = PROP_COLS.indexOf("id");
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idColIdx] === data.id) {
      sh.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: "Property not found: " + data.id };
}

// ─────────────────────────────────────────────────────────────
// Add these cases to your existing doPost(e) switch/if block:
//
//   case "property_list":    return jsonResp(handlePropertyList());
//   case "property_create":  return jsonResp(handlePropertyCreate(payload.data || {}));
//   case "property_update":  return jsonResp(handlePropertyUpdate(payload.data || {}));
//   case "property_delete":  return jsonResp(handlePropertyDelete(payload.data || {}));
//
// Where jsonResp is your existing helper, typically:
//   function jsonResp(obj) {
//     return ContentService.createTextOutput(JSON.stringify(obj))
//       .setMimeType(ContentService.MimeType.JSON);
//   }
// ─────────────────────────────────────────────────────────────
