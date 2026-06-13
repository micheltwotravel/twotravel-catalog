// ================================================================
// TWO TRAVEL CONCIERGE — Google Apps Script
// Maneja: Kickoffs (Sheet1) · Tasks · Soporte · Slack Billing · Properties
// ================================================================
const SS = SpreadsheetApp.getActiveSpreadsheet();

const KICKOFF_HEADERS = [
  "id","guestName","tripName","status","conciergeSummary","travifyText",
  "internalNotes","cart","createdAt","kickoffDate","guestContact","mainContact",
  "accommodationMapsUrl","clientType","concierge","destination","occasion",
  "arrivalDate","departureDate","email","roomCount","guestCount","notes",
  "assignedConcierge","assignedConciergeName","assignedConciergeEmail",
  "city","lang","tripDates","groupSize","conciergeTitle",
  "accommodationName","accommodationAddr","accommodationUrl","checkIn","checkOut",
  "flightInfo","welcomePdfUrl","preTripContent","dayMeta",
  "quizAnswers","additionalNotes","conciergeRating","conciergeEditingAt",
  "guestEmail","arrivals","pax","drinkOrder","drinkOrderAt",
  "cityRatings","groupSubmissions","clientSubmittedAt","submittedAt",
  "tripDates2","arrivalDate2","departureDate2",
  "accommodationName2","accommodationAddr2","accommodationUrl2",
  "drinkOrderJson","groceryOrder","groceryOrderAt","groceryOrderJson",
  "sentToTravifyAt","doneAt",
];

const TASK_HEADERS = ["id","taskName","assignedTo","assignedEmail","dueDate","status","notes","kickoffId","kickoffName","priority","createdAt","completedAt"];
const SOPORTE_HEADERS = [
  "id","nombre","tipo","prioridad","titulo","descripcion","createdAt","status",
];

// ─── UTILIDADES ──────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function getSheet_(name) {
  let sh = SS.getSheetByName(name);
  if (!sh) sh = SS.insertSheet(name);
  ensureHeaders_(sh, name);
  return sh;
}
function ensureHeaders_(sh, name) {
  const needed = name === "Tasks"   ? TASK_HEADERS
               : name === "Soporte" ? SOPORTE_HEADERS
               : KICKOFF_HEADERS;
  const lastCol = sh.getLastColumn();
  const existing = lastCol > 0
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  needed.forEach(h => {
    if (!existing.includes(h)) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      existing.push(h);
    }
  });
}
function getColMap_(sh) {
  const lastCol = sh.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const map = {};
  headers.forEach((h, i) => { if (h) map[h] = i + 1; });
  return map;
}
function sheetToObjects_(sh) {
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol === 0) return [];
  const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0].map(String);
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      obj[h] = (v instanceof Date) ? v.toISOString() : (v ?? "");
    });
    return obj;
  });
}

// ─── doPost ──────────────────────────────────────────────────────
function doPost(e) {
  try {
    const body    = JSON.parse(e.postData.contents);
    const action  = String(body.action || "").trim();
    const payload = body.payload || {};
    const id      = body.id || payload.id || "";
    const updates = body.updates || payload || {};

    switch (action) {
      case "listKickoffs":       return jsonResponse({ ok: true, data: listKickoffs_() });
      case "saveKickoff":        return jsonResponse(saveKickoff_(payload));
      case "updateKickoff":      return jsonResponse(updateKickoff_(id, updates));
      case "deleteKickoff":      return jsonResponse(deleteKickoff_(id));
      case "getKickoffById":     return jsonResponse({ ok: true, data: getKickoffById_(id) });
      case "listTasks":          return jsonResponse({ ok: true, data: listTasks_() });
      case "saveTask":           return jsonResponse(saveTask_(payload));
      case "updateTask":         return jsonResponse(updateTask_(payload.id || id, payload));
      case "listSoporte":        return jsonResponse({ ok: true, data: listSoporte_() });
      case "soporte":            return jsonResponse(saveSoporte_(payload));
      case "saveSoporte":        return jsonResponse(saveSoporte_(payload));
      case "updateSoporte": {
        const updId      = body.id;
        const updUpdates = body.updates || {};
        if (!updId) return jsonResponse({ ok: false, error: "Falta id" });
        const ws = SS.getSheetByName("Soporte");
        if (!ws) return jsonResponse({ ok: false, error: "Hoja Soporte no encontrada" });
        const wsColMap = getColMap_(ws);
        const wsData   = ws.getDataRange().getValues();
        for (let r = 1; r < wsData.length; r++) {
          if (String(wsData[r][0]) === String(updId)) {
            Object.entries(updUpdates).forEach(([k, v]) => {
              if (wsColMap[k]) ws.getRange(r + 1, wsColMap[k]).setValue(v ?? "");
            });
            SpreadsheetApp.flush();
            return jsonResponse({ ok: true });
          }
        }
        return jsonResponse({ ok: false, error: "ID no encontrado: " + updId });
      }
      case "sendBillingToSlack": return jsonResponse(sendBillingToSlack_(payload));
      case "sendSlackMessage":   return jsonResponse(sendSlackMessage_(payload));
      case "property_bulk":      return jsonResponse(handlePropertyBulk(body.data || []));

      // ── Properties ──
      case "property_list":   return jsonResponse(handlePropertyList());
      case "property_get":    return jsonResponse(handlePropertyGet(body.data || {}));
      case "property_create": return jsonResponse(handlePropertyCreate(body.data || {}));
      case "property_update": return jsonResponse(handlePropertyUpdate(body.data || {}));
      case "property_delete": return jsonResponse(handlePropertyDelete(body.data || {}));

      default:
        return jsonResponse({ ok: false, error: "Unknown action: " + action });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ─── doGet ───────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || "";
    switch (action) {
      case "listKickoffs": return jsonResponse({ ok: true, data: listKickoffs_() });
      case "listTasks":    return jsonResponse({ ok: true, data: listTasks_() });
      case "listSoporte":  return jsonResponse({ ok: true, data: listSoporte_() });
      default:             return jsonResponse({ ok: true, status: "Two Travel GAS v3 ready" });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ═══════════════ KICKOFFS ════════════════════════════════════════
function listKickoffs_() {
  return sheetToObjects_(getSheet_("Sheet1"));
}
function saveKickoff_(payload) {
  const sh = getSheet_("Sheet1");
  const colMap = getColMap_(sh);
  const newId = uid();
  const numCols = sh.getLastColumn();
  const row = new Array(numCols).fill("");
  Object.entries(colMap).forEach(([h, col]) => {
    if (h === "id") { row[col-1] = newId; return; }
    if (payload[h] !== undefined && payload[h] !== null) {
      let v = payload[h];
      if (typeof v === "object") v = JSON.stringify(v);
      row[col-1] = v;
    }
  });
  if (colMap["createdAt"] && !row[colMap["createdAt"]-1])
    row[colMap["createdAt"]-1] = new Date().toISOString();
  sh.appendRow(row);
  SpreadsheetApp.flush();
  return { ok: true, id: newId };
}
function updateKickoff_(id, updates) {
  if (!id) throw new Error("updateKickoff: id vacío");
  const sh = getSheet_("Sheet1");

  // Añadir columnas faltantes dinámicamente
  const lastCol  = sh.getLastColumn();
  const existing = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  Object.keys(updates).forEach(key => {
    if (key && !existing.includes(key)) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(key);
      existing.push(key);
    }
  });

  const data    = sh.getDataRange().getValues();
  const headers = data[0].map(h => String(h || "").trim().toLowerCase());

  // Buscar columna "id" — acepta "id", "Id", "ID"
  const idCol = headers.indexOf("id");
  if (idCol === -1) throw new Error("No existe columna 'id' en Sheet1");

  const idStr = String(id).trim();

  for (let r = 1; r < data.length; r++) {
    const rowId = String(data[r][idCol] ?? "").trim();
    if (rowId !== idStr) continue;

    // ✅ Fila encontrada — actualizar campos
    Object.entries(updates).forEach(([key, val]) => {
      const col = headers.indexOf(key.trim().toLowerCase());
      if (col === -1) return;
      const cell = (val !== null && val !== undefined) ? val : "";
      sh.getRange(r + 1, col + 1).setValue(
        typeof cell === "object" ? JSON.stringify(cell) : cell
      );
    });
    SpreadsheetApp.flush();
    return { ok: true };
  }

  // ── Diagnóstico
  const foundIds = data.slice(1).map(row => String(row[idCol] ?? "").trim()).filter(Boolean);
  throw new Error(
    "Kickoff not found: '" + idStr + "'. " +
    "IDs en sheet (" + foundIds.length + "): " + foundIds.slice(0, 5).join(", ") +
    (foundIds.length > 5 ? "…" : "")
  );
}
function deleteKickoff_(id) {
  if (!id) return { ok: false, error: "Missing id" };
  const sh = getSheet_("Sheet1");
  const colMap = getColMap_(sh);
  const idCol = colMap["id"];
  if (!idCol) return { ok: false, error: "No id column" };
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, error: "No data" };
  const idVals = sh.getRange(2, idCol, lastRow-1, 1).getValues();
  for (let i = 0; i < idVals.length; i++) {
    if (String(idVals[i][0]) === String(id)) {
      sh.deleteRow(i + 2);
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  return { ok: false, error: "Kickoff not found: " + id };
}
function getKickoffById_(id) {
  if (!id) return null;
  return listKickoffs_().find(k => String(k.id) === String(id)) || null;
}

// ═══════════════ TASKS ═══════════════════════════════════════════
function listTasks_() { return sheetToObjects_(getSheet_("Tasks")); }
function saveTask_(payload) {
  const sh = getSheet_("Tasks");
  const colMap = getColMap_(sh);
  const newId = uid();
  const row = new Array(sh.getLastColumn()).fill("");
  row[colMap["id"]-1]           = newId;
  row[colMap["taskName"]-1]     = payload.taskName     || "";
  row[colMap["assignedTo"]-1]   = payload.assignedTo   || "";
  row[colMap["assignedEmail"]-1]= payload.assignedEmail|| "";
  row[colMap["dueDate"]-1]      = payload.dueDate      || "";
  row[colMap["status"]-1]       = payload.status       || "pending";
  row[colMap["notes"]-1]        = payload.notes        || "";
  if (colMap["kickoffId"])   row[colMap["kickoffId"]-1]   = payload.kickoffId   || "";
  if (colMap["kickoffName"]) row[colMap["kickoffName"]-1] = payload.kickoffName || "";
  row[colMap["createdAt"]-1]    = payload.createdAt    || new Date().toISOString();
  sh.appendRow(row);
  SpreadsheetApp.flush();
  return { ok: true, id: newId };
}
function updateTask_(id, updates) {
  if (!id) return { ok: false, error: "Missing task id" };
  const sh = getSheet_("Tasks");
  const colMap = getColMap_(sh);
  const idCol = colMap["id"];
  if (!idCol) return { ok: false, error: "No id column in Tasks" };
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { ok: false, error: "No tasks" };
  const idVals = sh.getRange(2, idCol, lastRow-1, 1).getValues();
  for (let i = 0; i < idVals.length; i++) {
    if (String(idVals[i][0]) === String(id)) {
      Object.entries(updates).forEach(([key, val]) => {
        const col = colMap[key];
        if (col) sh.getRange(i+2, col).setValue(val ?? "");
      });
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  return { ok: false, error: "Task not found: " + id };
}

// ═══════════════ SOPORTE ═════════════════════════════════════════
function listSoporte_() { return sheetToObjects_(getSheet_("Soporte")); }
function saveSoporte_(payload) {
  const sh = getSheet_("Soporte");
  const colMap = getColMap_(sh);
  const newId = uid();
  const row = new Array(sh.getLastColumn()).fill("");
  row[colMap["id"]-1]          = newId;
  row[colMap["nombre"]-1]      = payload.nombre      || "";
  row[colMap["tipo"]-1]        = payload.tipo        || "";
  row[colMap["prioridad"]-1]   = payload.prioridad   || "";
  row[colMap["titulo"]-1]      = payload.titulo      || "";
  row[colMap["descripcion"]-1] = payload.descripcion || "";
  row[colMap["createdAt"]-1]   = payload.createdAt   || new Date().toISOString();
  row[colMap["status"]-1]      = payload.status      || "open";
  sh.appendRow(row);
  SpreadsheetApp.flush();
  return { ok: true, id: newId };
}

// ═══════════════ SLACK — PDF BILLING ═════════════════════════════
function sendBillingToSlack_(payload) {
  try {
    const props      = PropertiesService.getScriptProperties();
    const slackToken = payload.slackToken
                    || props.getProperty("SLACK_BOT_TOKEN") || "";
    const channelId  = payload.channelId
                    || props.getProperty("SLACK_CHANNEL_ID") || "C094NE421NV";

    if (!slackToken) return { ok: false, error: "No Slack token — agrega SLACK_BOT_TOKEN en Script Properties" };

    const { pdfBase64, pdfSize, filename, comment } = payload;
    const pdfBytes = Utilities.base64Decode(pdfBase64);
    const byteLen  = pdfSize || pdfBytes.length;

    const urlRes = UrlFetchApp.fetch("https://slack.com/api/files.getUploadURLExternal", {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      payload: { token: slackToken, filename: filename, length: String(byteLen) },
      muteHttpExceptions: true,
    });
    const urlData = JSON.parse(urlRes.getContentText());
    if (!urlData.ok) return { ok: false, error: "getUploadURL: " + urlData.error };

    UrlFetchApp.fetch(urlData.upload_url, {
      method: "post",
      contentType: "application/octet-stream",
      payload: pdfBytes,
      muteHttpExceptions: true,
    });

    const completePayload = { files: [{ id: urlData.file_id }], channel_id: channelId };
    if (comment) completePayload.initial_comment = comment;

    const completeRes = UrlFetchApp.fetch("https://slack.com/api/files.completeUploadExternal", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + slackToken },
      payload: JSON.stringify(completePayload),
      muteHttpExceptions: true,
    });
    const completeData = JSON.parse(completeRes.getContentText());
    if (!completeData.ok) return { ok: false, error: "complete: " + completeData.error };

    return { ok: true };
  } catch(err) {
    return { ok: false, error: err.message };
  }
}

// ═══════════════ SLACK — MENSAJE DE TEXTO ════════════════════════
function sendSlackMessage_(payload) {
  try {
    const { text, slackToken, channelId } = payload;
    const token   = slackToken   || PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN");
    const channel = channelId    || PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID") || "C094NE421NV";
    if (!token)   return { ok: false, error: "No Slack token" };
    if (!text)    return { ok: false, error: "No text" };

    const res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
      method: "post",
      contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      payload: JSON.stringify({ channel, text }),
      muteHttpExceptions: true,
    });
    const data = JSON.parse(res.getContentText());
    if (!data.ok) return { ok: false, error: data.error };
    return { ok: true };
  } catch(err) {
    return { ok: false, error: err.message };
  }
}

// ═══════════════ DIAGNÓSTICOS ════════════════════════════════════
function testUpdate() {
  const sh = getSheet_("Sheet1");
  const data = sh.getDataRange().getValues();
  Logger.log("Filas en sheet: " + data.length);
  Logger.log("Headers: " + data[0].slice(0, 5).join(" | ") + "...");
  const ids = data.slice(1).map(r => String(r[0] ?? "")).filter(Boolean);
  Logger.log("IDs encontrados (" + ids.length + "): " + ids.slice(0, 8).join(", "));
}
function testSaveTask() {
  const e = { postData: { contents: JSON.stringify({
    action: "saveTask",
    payload: { taskName: "TEST", assignedTo: "Alia Jadad",
               dueDate: "2025-06-15", status: "pending",
               notes: "diagnóstico", createdAt: new Date().toISOString() }
  })}};
  Logger.log(doPost(e).getContent());
}
function fixColumns() {
  const sh = SS.getSheetByName("Sheet1");
  if (!sh) { Logger.log("ERROR: Sheet1 no existe"); return; }
  ensureHeaders_(sh, "Sheet1");
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  Logger.log("Columnas: " + headers.join(" | "));
}
function testSlackMessage() {
  const res = sendSlackMessage_({ text: "✅ Two Travel GAS test OK — " + new Date().toLocaleString() });
  Logger.log(JSON.stringify(res));
}
function testBillingToken() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty("SLACK_BOT_TOKEN");
  Logger.log("Token: " + (token ? token.slice(0,15) + "..." : "⚠️ VACÍO"));
  const res = UrlFetchApp.fetch("https://slack.com/api/auth.test", {
    method: "post",
    contentType: "application/x-www-form-urlencoded",
    payload: { token: token || "" },
    muteHttpExceptions: true,
  });
  Logger.log(res.getContentText());
}

// ═══════════════ PROPERTIES ══════════════════════════════════════
const PROP_SHEET = "Properties";
const PROP_COLS = [
  "id","Name","City","Item Type","Neighborhood","Neighborhood Summary",
  "Location","Address","Status","Max Pax","Bedrooms","Bathrooms","Beds","Capacity",
  "Feet","Client Price","Price Range","Our Price","Quote 2025","Commission Tier",
  "Cancellation Policy","Check-in Time","Check-out Time","Min Hours","Max Hours",
  "Contact Name","Contact","Contact Phone","Owner / POC","WhatsApp Group",
  "Airbnb Link","Photos Link","Twp Travel Webpage","Website Link","PDF Link",
  "Description","Notes","Internal Notes","Availability Notes",
  "Venue Type","Amenities","Bachelor / Party Friendly","Payment Methods","Rating",
  "Cover Photo","createdAt","updatedAt",
];

function getPropSheet_() {
  let sh = SS.getSheetByName(PROP_SHEET);
  if (!sh) {
    sh = SS.insertSheet(PROP_SHEET);
    sh.appendRow(PROP_COLS);
    sh.setFrozenRows(1);
    const hdr = sh.getRange(1, 1, 1, PROP_COLS.length);
    hdr.setFontWeight("bold");
    hdr.setBackground("#1a1814");
    hdr.setFontColor("#ffffff");
  } else {
    // Ensure new columns are added if missing
    const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    PROP_COLS.forEach(col => {
      if (!existing.includes(col)) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
        existing.push(col);
      }
    });
  }
  return sh;
}

function rowToObj_(row, headers) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
  // Lowercase aliases for frontend compatibility
  obj["name"]                    = obj["Name"]                    || "";
  obj["city"]                    = obj["City"]                    || "";
  obj["address"]                 = obj["Address"]                 || "";
  obj["location"]                = obj["Location"]                || "";
  obj["item type"]               = obj["Item Type"]               || "";
  obj["neighborhood"]            = obj["Neighborhood"]            || "";
  obj["max pax"]                 = obj["Max Pax"]                 || "";
  obj["bedrooms"]                = obj["Bedrooms"]                || "";
  obj["bathrooms"]               = obj["Bathrooms"]               || "";
  obj["beds"]                    = obj["Beds"]                    || "";
  obj["capacity"]                = obj["Capacity"]                || "";
  obj["feet"]                    = obj["Feet"]                    || "";
  obj["client price"]            = obj["Client Price"]            || "";
  obj["price range"]             = obj["Price Range"]             || "";
  obj["our price"]               = obj["Our Price"]               || "";
  obj["cancellation policy"]     = obj["Cancellation Policy"]     || "";
  obj["check-in time"]           = obj["Check-in Time"]           || "";
  obj["check-out time"]          = obj["Check-out Time"]          || "";
  obj["contact name"]            = obj["Contact Name"]            || "";
  obj["contact"]                 = obj["Contact"]                 || "";
  obj["contact phone"]           = obj["Contact Phone"]           || "";
  obj["airbnb link"]             = obj["Airbnb Link"]             || "";
  obj["photos link"]             = obj["Photos Link"]             || "";
  obj["twp travel webpage"]      = obj["Twp Travel Webpage"]      || "";
  obj["description"]             = obj["Description"]             || "";
  obj["notes"]                   = obj["Notes"]                   || "";
  obj["venue type"]              = obj["Venue Type"]              || "";
  obj["amenities"]               = obj["Amenities"]               || "";
  obj["status"]                  = obj["Status"]                  || "";
  obj["rating"]                  = obj["Rating"]                  || "";
  obj["bachelor / party friendly"] = obj["Bachelor / Party Friendly"] || "";
  obj["payment methods"]         = obj["Payment Methods"]         || "";
  obj["cover photo"]             = obj["Cover Photo"]             || "";
  return obj;
}

function handlePropertyList() {
  const sh = getPropSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length <= 1) return { properties: [] };
  const headers = data[0];
  return { properties: data.slice(1).map(r => rowToObj_(r, headers)).filter(o => o.Name) };
}

function handlePropertyGet(data) {
  const sh = getPropSheet_();
  const vals = sh.getDataRange().getValues();
  const headers = vals[0];
  const idIdx = headers.indexOf("id");

  // Single property by id
  if (data.id && data.id !== "all") {
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][idIdx]) === String(data.id)) {
        return { ok: true, data: rowToObj_(vals[i], headers) };
      }
    }
    return { ok: false, error: "Not found: " + data.id };
  }

  // All properties (with optional limit)
  const limit = data.limit ? Number(data.limit) : 9999;
  const all = vals.slice(1)
    .map(r => rowToObj_(r, headers))
    .filter(o => o.Name)
    .slice(0, limit);
  return { ok: true, data: all };
}

function handlePropertyCreate(data) {
  const sh = getPropSheet_();
  const id = data.id || ("prop_" + Date.now());
  const now = new Date().toISOString();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(col => {
    if (col === "id")        return id;
    if (col === "createdAt") return data.createdAt || now;
    if (col === "updatedAt") return now;
    return data[col] !== undefined ? data[col]
         : data[col.toLowerCase()] !== undefined ? data[col.toLowerCase()]
         : "";
  });
  sh.appendRow(row);
  SpreadsheetApp.flush();
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
      SpreadsheetApp.flush();
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
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  return { ok: false, error: "Not found: " + data.id };
}

function handlePropertyBulk(rows) {
  const sh = getPropSheet_();
  const now = new Date().toISOString();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const data = rows.map(d => headers.map(col => {
    if (col === "id")        return d.id || ("prop_" + Date.now() + Math.random());
    if (col === "createdAt") return d.createdAt || now;
    if (col === "updatedAt") return now;
    return d[col] !== undefined ? d[col] : d[col.toLowerCase()] !== undefined ? d[col.toLowerCase()] : "";
  }));
  if (data.length) sh.getRange(sh.getLastRow()+1, 1, data.length, headers.length).setValues(data);
  SpreadsheetApp.flush();
  return { ok: true, count: data.length };
}

// ═══════════════ UTILIDADES SHEET ════════════════════════════════
function clearAndKeepNew() {
  const sh = SS.getSheetByName("Properties");
  if (!sh) return;
  const lastRow = sh.getLastRow();
  sh.deleteRows(2, 456);
  SpreadsheetApp.flush();
  Logger.log("Listo. Filas ahora: " + sh.getLastRow());
}
function clearDuplicateProperties() {
  const sh = SS.getSheetByName("Properties");
  if (!sh) return;
  const lastRow = sh.getLastRow();
  if (lastRow > 458) {
    sh.deleteRows(459, lastRow - 458);
    SpreadsheetApp.flush();
  }
  Logger.log("Done. Rows now: " + sh.getLastRow());
}
