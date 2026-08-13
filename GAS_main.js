// ================================================================
// TWO TRAVEL CONCIERGE — Google Apps Script
// Maneja: Kickoffs (Sheet1) · Tasks · Soporte · Slack Billing · Properties · Handoffs · Bodas
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
  "sentToTravifyAt","doneAt","lastModified",
];

function testApprovalEmail() {
  MailApp.sendEmail({
    to: "alia@two.travel",
    subject: "✅ Ya tienes acceso al portal Two Travel",
    body: "Hola!\n\nYa tienes acceso al portal interno de Two Travel.\n\nEntra aquí:\nhttps://twotravelvip.com/?mode=dashboard\n\nUsa tu email y el PIN que elegiste al registrarte.\n\n— Michel & Caro"
  });
  Logger.log("Email enviado");
}

const TASK_HEADERS = ["id","taskName","assignedTo","assignedEmail","dueDate","status","notes","kickoffId","kickoffName","handoffId","priority","createdAt","completedAt","fase","tipo","source"];
const SOPORTE_HEADERS = [
  "id","nombre","tipo","prioridad","titulo","descripcion","createdAt","status",
];

// ─── UTILIDADES ──────────────────────────────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
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
      case "saveAvailability":       return saveAvailability(body);
      case "bookSlot":               return bookSlot(body);
      case "notifyMeetingBooked":    return jsonResponse(notifyMeetingBooked_(payload));
      case "notifyCatalogSubmit":    return jsonResponse(notifyCatalogSubmit_(payload));
      case "saveMenuConfig":         return jsonResponse(saveMenuConfig_(payload));
      case "getKickoffById":     return jsonResponse({ ok: true, data: getKickoffById_(id) });
      case "listTasks":          return jsonResponse({ ok: true, data: listTasks_() });
      case "saveTask":           return jsonResponse(saveTask_(payload));
      case "updateTask":         return jsonResponse(updateTask_(payload.id || id, payload));
      case "listSoporte":        return jsonResponse({ ok: true, data: listSoporte_() });
      case "listBodas":          return jsonResponse({ ok: true, data: listBodas_() });

      case "uploadImage": {
        const folder = DriveApp.getFolderById("1rCaYgQTpS3CJc-qawtmT2-SbYZCjiCkj");
        const blob = Utilities.newBlob(
          Utilities.base64Decode(payload.base64),
          payload.mimeType,
          payload.filename || "imagen.jpg"
        );
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const fileId = file.getId();
        return jsonResponse({ ok: true, url: `https://lh3.googleusercontent.com/d/${fileId}` });
      }

      case "saveBoda":    return jsonResponse(saveBoda_(payload));
      case "updateBoda":  return jsonResponse(updateBoda_(id, updates));
      case "deleteBoda":  return jsonResponse(deleteBoda_(payload.id || id));

      case "soporte":            return jsonResponse(saveSoporte_(payload));
      case "saveCalendarToken":  return jsonResponse(saveCalendarToken(payload));
      case "getCalendarToken":   return jsonResponse(getCalendarToken(payload));
      case "getCalendarTokens":  return jsonResponse(getCalendarTokens());
      case "addMeetingToKickoff": return jsonResponse(addMeetingToKickoff(payload));
      case "saveSoporte":        return jsonResponse(saveSoporte_(payload));
      case "createMondayItems":  return jsonResponse(createMondayItems_(payload));
      case "saveComisiones":     return jsonResponse(saveComisiones_(payload));
      case "getComisiones":      return jsonResponse({ ok: true, data: getComisiones_() });

      // ── Pagos ──
      case "getPagos":          return jsonResponse({ ok: true, data: getPagos_() });
      case "savePagos":         return jsonResponse(savePagos_(payload));
      case "updatePago":        return jsonResponse(updatePago_(payload.id || id, payload));
      case "deletePago":        return jsonResponse(deletePago_(payload.id || id));
      case "notifyNewPago":     return jsonResponse(notifyNewPago_(payload));
      case "notifyPagoStatus":  return jsonResponse(notifyPagoStatus_(payload));

      case "registerUser": {
        let sh = SS.getSheetByName("Usuarios");
        if (!sh) {
          sh = SS.insertSheet("Usuarios");
          sh.appendRow(["email","name","role","pin","active"]);
        }
        const rows = sh.getDataRange().getValues();
        const hdrs = rows[0];
        const eIdx = hdrs.indexOf("email");
        const exists = rows.slice(1).find(r =>
          String(r[eIdx]).toLowerCase() === String(payload.email).toLowerCase()
        );
        if (exists) return jsonResponse({ ok: false, error: "Este email ya tiene una cuenta" });
        if (!payload.email.endsWith("@two.travel"))
          return jsonResponse({ ok: false, error: "Solo emails @two.travel" });
        sh.appendRow([payload.email, "", "pending", payload.pin, "false"]);
        SpreadsheetApp.flush();
        try {
          MailApp.sendEmail({
            to: "michel@two.travel,caro@two.travel",
            subject: "🔔 Nueva solicitud de acceso — " + payload.email,
            body: payload.email + " solicitó acceso al portal interno.\n\nApruébalo aquí:\nhttps://twotravelvip.com/?mode=users"
          });
        } catch(mailErr) {}
        return jsonResponse({ ok: true });
      }

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

      // ── Handoffs operaciones ──
      case "getHandoffs":    return jsonResponse({ ok: true, data: getHandoffs_() });
      case "saveHandoffs":   return jsonResponse(saveHandoffs_(payload));
      case "updateHandoff":  return jsonResponse(updateHandoff_(payload.id || id, payload));
      case "deleteHandoff":  return jsonResponse(deleteHandoff_(payload.id || id));

      // ── Properties ──
      case "property_list":   return jsonResponse(handlePropertyList());
      case "property_get":    return jsonResponse(handlePropertyGet(body.data || {}));
      case "property_create": return jsonResponse(handlePropertyCreate(body.data || {}));
      case "property_update": return jsonResponse(handlePropertyUpdate(body.data || {}));
      case "property_delete": return jsonResponse(handlePropertyDelete(body.data || {}));

      case "getCheckinResponses": {
        const ciSh = SS.getSheetByName("CheckinResponses");
        if (!ciSh) return jsonResponse({ ok: true, data: [] });
        const rows = ciSh.getDataRange().getValues();
        const hdrs = rows[0];
        const kidIdx = hdrs.indexOf("kickoffId");
        const data = rows.slice(1)
          .filter(r => String(r[kidIdx]) === String(payload.kickoffId))
          .map(r => {
            const obj = {};
            hdrs.forEach((h, i) => { obj[h] = r[i]; });
            return obj;
          });
        return jsonResponse({ ok: true, data });
      }

      case "loginUser": {
        const sh = SS.getSheetByName("Usuarios");
        if (!sh) return jsonResponse({ ok: false, error: "Hoja Usuarios no existe" });
        const rows = sh.getDataRange().getValues();
        const hdrs = rows[0];
        const eIdx = hdrs.indexOf("email"), pIdx = hdrs.indexOf("pin"),
              nIdx = hdrs.indexOf("name"),  rIdx = hdrs.indexOf("role"),
              aIdx = hdrs.indexOf("active");
        const match = rows.slice(1).find(r =>
          String(r[eIdx]).toLowerCase() === String(payload.email).toLowerCase() &&
          String(r[pIdx]) === String(payload.pin) &&
          String(r[aIdx]) !== "false"
        );
        if (!match) return jsonResponse({ ok: false, error: "Email o PIN incorrecto" });
        return jsonResponse({ ok: true, user: { email: match[eIdx], name: match[nIdx], role: match[rIdx] } });
      }

      case "listUsers": {
        const sh = SS.getSheetByName("Usuarios");
        if (!sh) return jsonResponse({ ok: true, data: [] });
        const rows = sh.getDataRange().getValues();
        const hdrs = rows[0];
        const data = rows.slice(1).map(r => {
          const o = {}; hdrs.forEach((h,i) => { o[h] = r[i]; }); return o;
        }).filter(r => r.email);
        return jsonResponse({ ok: true, data });
      }

      case "updateUser": {
        const sh = SS.getSheetByName("Usuarios");
        if (!sh) return jsonResponse({ ok: false, error: "No existe hoja Usuarios" });
        const rows = sh.getDataRange().getValues();
        const hdrs = rows[0];
        const eIdx = hdrs.indexOf("email");
        const rIdx = hdrs.indexOf("role");
        for (let r = 1; r < rows.length; r++) {
          if (String(rows[r][eIdx]).toLowerCase() === String(payload.email).toLowerCase()) {
            const wasApproved = String(rows[r][rIdx]) === "pending" && payload.role && payload.role !== "pending";
            Object.entries(payload).forEach(([k,v]) => {
              if (k === "adminEmail" || k === "email") return;
              const ci = hdrs.indexOf(k);
              if (ci >= 0) sh.getRange(r+1, ci+1).setValue(v);
            });
            SpreadsheetApp.flush();
            if (wasApproved) {
              try {
                MailApp.sendEmail({
                  to: payload.email,
                  subject: "✅ Ya tienes acceso al portal Two Travel",
                  body: "Hola!\n\nYa tienes acceso al portal interno de Two Travel.\n\nEntra aquí:\nhttps://twotravelvip.com/?mode=dashboard\n\nUsa tu email y el PIN que elegiste al registrarte.\n\n— Michel & Caro"
                });
              } catch(e) {}
            }
            return jsonResponse({ ok: true });
          }
        }
        return jsonResponse({ ok: false, error: "Usuario no encontrado" });
      }

      case "upsertUser": {
        let sh = SS.getSheetByName("Usuarios");
        if (!sh) {
          sh = SS.insertSheet("Usuarios");
          sh.appendRow(["email","name","role","pin","active"]);
        }
        const rows = sh.getDataRange().getValues();
        const hdrs = rows[0];
        const eIdx = hdrs.indexOf("email");
        const exists = rows.slice(1).findIndex(r => String(r[eIdx]).toLowerCase() === String(payload.email).toLowerCase());
        if (exists >= 0) {
          ["name","role","pin","active"].forEach(k => {
            if (payload[k] !== undefined) sh.getRange(exists+2, hdrs.indexOf(k)+1).setValue(payload[k]);
          });
        } else {
          sh.appendRow([payload.email, payload.name, payload.role||"concierge", payload.pin, "true"]);
        }
        SpreadsheetApp.flush();
        return jsonResponse({ ok: true });
      }

      case "saveCheckinResponse": {
        const { kickoffId, response } = payload;
        const ss2 = SpreadsheetApp.getActiveSpreadsheet();
        const ciSheet = ss2.getSheetByName("CheckinResponses") || ss2.insertSheet("CheckinResponses");
        const headers = ["kickoffId","submittedAt","firstName","lastName","email","phone",
          "idType","idNumber","dob","nationality","gender",
          "arrivalAirline","arrivalDate","arrivalFlight",
          "departureAirline","departureDate","departureFlight",
          "foodRestrictions","allergies","occasion","photoPermission","isGroupContact"];
        if (ciSheet.getLastRow() === 0) ciSheet.appendRow(headers);
        ciSheet.appendRow(headers.map(h => h === "kickoffId" ? kickoffId : (response[h] || "")));
        SpreadsheetApp.flush();
        return jsonResponse({ ok: true });
      }

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
      case "listKickoffs":   return jsonResponse({ ok: true, data: listKickoffs_() });
      case "getAvailability": return getAvailability(e);
      case "getMenuConfig":  return jsonResponse(getMenuConfig_());
      case "listTasks":      return jsonResponse({ ok: true, data: listTasks_() });
      case "listSoporte":    return jsonResponse({ ok: true, data: listSoporte_() });
      case "listBodas":      return jsonResponse({ ok: true, data: listBodas_() });
      case "listProperties": return jsonResponse(handlePropertyList());
      case "getProperty": {
        const name = (e.parameter && e.parameter.name) || "";
        const id   = (e.parameter && e.parameter.id)   || "";
        if (id) return jsonResponse(handlePropertyGet({ id }));
        const list = handlePropertyList();
        const nl = name.toLowerCase();
        const match = (list.properties || []).find(p =>
          (p.Name || p.name || "").toLowerCase().includes(nl) || nl.includes((p.Name || p.name || "").toLowerCase())
        );
        return jsonResponse({ ok: true, data: match || null });
      }
      case "listItineraryItems": {
        const sh = SS.getSheetByName("Itinerary (no catalog)");
        if (!sh) return jsonResponse({ ok: true, data: [] });
        const vals = sh.getDataRange().getValues();
        if (vals.length < 2) return jsonResponse({ ok: true, data: [] });
        const headers = vals[0].map(h => String(h).trim());
        // Flexible header search — tolerates accents and case variants
        const findIdx = (...names) => {
          for (const n of names) {
            const i = headers.findIndex(h => h.toLowerCase() === n.toLowerCase());
            if (i >= 0) return i;
          }
          return -1;
        };
        const nameEnIdx = findIdx("Item NAME", "Name EN", "Name");
        const nameEsIdx = findIdx("Item NOMBRE", "Nombre ES", "Nombre");
        const descEnIdx = findIdx("Description", "Desc EN", "Description EN");
        const descEsIdx = findIdx("Descripcion ESP", "Descripción ESP", "Descripcion ES", "Descripción ES", "Desc ES", "Description ES");
        const imgIdx    = findIdx("Image", "Imagen");
        const data = vals.slice(1)
          .filter(r => (nameEnIdx >= 0 && r[nameEnIdx]) || (nameEsIdx >= 0 && r[nameEsIdx]))
          .map(r => ({
            name_en:        String(nameEnIdx >= 0 ? r[nameEnIdx] : ""),
            name_es:        String(nameEsIdx >= 0 ? r[nameEsIdx] : ""),
            description:    String(descEnIdx >= 0 ? r[descEnIdx] : ""),
            description_es: String(descEsIdx >= 0 ? r[descEsIdx] : ""),
            image:          String(imgIdx    >= 0 ? r[imgIdx]    : ""),
          }));
        return jsonResponse({ ok: true, data, _headers: headers });
      }
      default: return jsonResponse({ ok: true, status: "Two Travel GAS v3 ready" });
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
  const newRowNum = sh.getLastRow() + 1;
  const newRange = sh.getRange(newRowNum, 1, 1, row.length);
  newRange.setNumberFormat("@");
  newRange.setValues([row]);
  SpreadsheetApp.flush();
  return { ok: true, id: newId };
}
function updateKickoff_(id, updates) {
  if (!id) throw new Error("updateKickoff: id vacío");
  const sh = getSheet_("Sheet1");
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
  const idCol = headers.indexOf("id");
  if (idCol === -1) throw new Error("No existe columna 'id' en Sheet1");
  const idStr = String(id).trim();
  for (let r = 1; r < data.length; r++) {
    const rowId = String(data[r][idCol] ?? "").trim();
    if (rowId !== idStr) continue;
    Object.entries(updates).forEach(([key, val]) => {
      const col = headers.indexOf(key.trim().toLowerCase());
      if (col === -1) return;
      const cell = (val !== null && val !== undefined) ? val : "";
      const cellRange = sh.getRange(r + 1, col + 1);
      cellRange.setNumberFormat("@");
      cellRange.setValue(typeof cell === "object" ? JSON.stringify(cell) : cell);
    });
    SpreadsheetApp.flush();
    return { ok: true };
  }
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
  row[colMap["id"]-1]            = newId;
  row[colMap["taskName"]-1]      = payload.taskName     || "";
  row[colMap["assignedTo"]-1]    = payload.assignedTo   || "";
  row[colMap["assignedEmail"]-1] = payload.assignedEmail|| "";
  row[colMap["dueDate"]-1]       = payload.dueDate      || "";
  row[colMap["status"]-1]        = payload.status       || "pending";
  row[colMap["notes"]-1]         = payload.notes        || "";
  if (colMap["kickoffId"])   row[colMap["kickoffId"]-1]   = payload.kickoffId   || "";
  if (colMap["kickoffName"]) row[colMap["kickoffName"]-1] = payload.kickoffName || "";
  if (colMap["handoffId"])   row[colMap["handoffId"]-1]   = payload.handoffId   || "";
  row[colMap["createdAt"]-1]     = payload.createdAt    || new Date().toISOString();
  if (colMap["fase"])   row[colMap["fase"]-1]   = payload.fase   || "";
  if (colMap["tipo"])   row[colMap["tipo"]-1]   = payload.tipo   || "Task";
  if (colMap["source"]) row[colMap["source"]-1] = payload.source || "";
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
    const slackToken = payload.slackToken || props.getProperty("SLACK_BOT_TOKEN") || "";
    const channelId  = payload.channelId  || props.getProperty("SLACK_CHANNEL_ID") || "C094NE421NV";
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
    const token   = slackToken || PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN");
    const channel = channelId  || PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID") || "C094NE421NV";
    if (!token) return { ok: false, error: "No Slack token" };
    if (!text)  return { ok: false, error: "No text" };
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
function testMondayConnection() {
  const data = mondayApi_(`{ me { name email } }`);
  Logger.log(JSON.stringify(data));
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
  "Cover Photo","priceTiers","createdAt","updatedAt",
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
  obj["name"]                      = obj["Name"]                      || "";
  obj["city"]                      = obj["City"]                      || "";
  obj["address"]                   = obj["Address"]                   || "";
  obj["location"]                  = obj["Location"]                  || "";
  obj["item type"]                 = obj["Item Type"]                 || "";
  obj["neighborhood"]              = obj["Neighborhood"]              || "";
  obj["max pax"]                   = obj["Max Pax"]                   || "";
  obj["bedrooms"]                  = obj["Bedrooms"]                  || "";
  obj["bathrooms"]                 = obj["Bathrooms"]                 || "";
  obj["beds"]                      = obj["Beds"]                      || "";
  obj["capacity"]                  = obj["Capacity"]                  || "";
  obj["feet"]                      = obj["Feet"]                      || "";
  obj["client price"]              = obj["Client Price"]              || "";
  obj["price range"]               = obj["Price Range"]               || "";
  obj["our price"]                 = obj["Our Price"]                 || "";
  obj["cancellation policy"]       = obj["Cancellation Policy"]       || "";
  obj["check-in time"]             = obj["Check-in Time"]             || "";
  obj["check-out time"]            = obj["Check-out Time"]            || "";
  obj["contact name"]              = obj["Contact Name"]              || "";
  obj["contact"]                   = obj["Contact"]                   || "";
  obj["contact phone"]             = obj["Contact Phone"]             || "";
  obj["airbnb link"]               = obj["Airbnb Link"]               || "";
  obj["photos link"]               = obj["Photos Link"]               || "";
  obj["twp travel webpage"]        = obj["Twp Travel Webpage"]        || "";
  obj["description"]               = obj["Description"]               || "";
  obj["notes"]                     = obj["Notes"]                     || "";
  obj["venue type"]                = obj["Venue Type"]                || "";
  obj["amenities"]                 = obj["Amenities"]                 || "";
  obj["status"]                    = obj["Status"]                    || "";
  obj["rating"]                    = obj["Rating"]                    || "";
  obj["bachelor / party friendly"] = obj["Bachelor / Party Friendly"] || "";
  obj["payment methods"]           = obj["Payment Methods"]           || "";
  obj["cover photo"]               = obj["Cover Photo"]               || "";
  obj["priceTiers"]                = obj["priceTiers"]                || "";
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
  if (data.id && data.id !== "all") {
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][idIdx]) === String(data.id)) {
        return { ok: true, data: rowToObj_(vals[i], headers) };
      }
    }
    return { ok: false, error: "Not found: " + data.id };
  }
  const limit = data.limit ? Number(data.limit) : 9999;
  const all = vals.slice(1).map(r => rowToObj_(r, headers)).filter(o => o.Name).slice(0, limit);
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
function repairContactErrors() {
  const sh = SS.getSheetByName("Sheet1");
  if (!sh) { Logger.log("Sheet1 no encontrada"); return; }
  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2) { Logger.log("Sin datos"); return; }
  sh.getRange(2, 1, lastRow - 1, lastCol).setNumberFormat("@");
  const data = sh.getDataRange().getValues();
  let fixed = 0;
  for (let r = 1; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      const v = data[r][c];
      if (v instanceof Error || String(v) === "#ERROR!" || String(v).startsWith("#")) {
        sh.getRange(r + 1, c + 1).setNumberFormat("@").setValue("");
        fixed++;
      }
    }
  }
  SpreadsheetApp.flush();
  Logger.log("Reparadas " + fixed + " celdas con error.");
}

// ═══════════════ HANDOFFS OPERACIONES ════════════════════════════
const HANDOFFS_SHEET = "Handoffs";
const HANDOFFS_COLS  = ["id","client","date","activity","pax","operator","bookingWhere","travefy","confirmation","confirmPhoto","person","personLive","notes","status","createdAt","updatedAt"];

function getHandoffsSheet_() {
  let sh = SS.getSheetByName(HANDOFFS_SHEET);
  if (!sh) {
    sh = SS.insertSheet(HANDOFFS_SHEET);
    sh.getRange(1, 1, 1, HANDOFFS_COLS.length).setValues([HANDOFFS_COLS]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    HANDOFFS_COLS.forEach(col => {
      if (!existing.includes(col)) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
        existing.push(col);
      }
    });
  }
  return sh;
}
function getHandoffs_() {
  const sh = getHandoffsSheet_();
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const headers = vals[0].map(String);
  return vals.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  }).filter(r => r.id);
}
function saveHandoffs_(payload) {
  const items = Array.isArray(payload) ? payload : (payload.handoffs || []);
  const sh = getHandoffsSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.deleteRows(2, lastRow - 1);
  if (!items.length) return { ok: true };
  const now = new Date().toISOString();
  const rows = items.map(h => HANDOFFS_COLS.map(col => {
    if (col === "createdAt") return h.createdAt || now;
    if (col === "updatedAt") return now;
    if (col === "id")        return h.id || ("hf_" + Date.now() + Math.random());
    return h[col] !== undefined ? h[col] : "";
  }));
  sh.getRange(2, 1, rows.length, HANDOFFS_COLS.length).setValues(rows);
  SpreadsheetApp.flush();
  return { ok: true, count: rows.length };
}
function updateHandoff_(id, updates) {
  if (!id) return { ok: false, error: "Falta id" };
  const sh = getHandoffsSheet_();
  const vals = sh.getDataRange().getValues();
  const headers = vals[0].map(String);
  const idIdx = headers.indexOf("id");
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idIdx]) === String(id)) {
      Object.entries(updates).forEach(([k, v]) => {
        const ci = headers.indexOf(k);
        if (ci >= 0) sh.getRange(r + 1, ci + 1).setValue(v ?? "");
      });
      const updIdx = headers.indexOf("updatedAt");
      if (updIdx >= 0) sh.getRange(r + 1, updIdx + 1).setValue(new Date().toISOString());
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  return { ok: false, error: "Handoff no encontrado: " + id };
}
function deleteHandoff_(id) {
  if (!id) return { ok: false, error: "Falta id" };
  const sh = getHandoffsSheet_();
  const vals = sh.getDataRange().getValues();
  const idIdx = vals[0].map(String).indexOf("id");
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idIdx]) === String(id)) {
      sh.deleteRow(r + 1);
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  return { ok: false, error: "No encontrado: " + id };
}

// ═══════════════ PAGOS / SOLICITUDES DE PAGO ═════════════════════
const PAGOS_SHEET = "Pagos";
const PAGOS_COLS = ["id","dept","date","category","client","vendor","desc","amount","currency","method","person","receipt","factura","reminderDate","status","notes","phone","cobroAt","reminderAt","createdAt","updatedAt"];

function getPagosSheet_() {
  let sh = SS.getSheetByName(PAGOS_SHEET);
  if (!sh) {
    sh = SS.insertSheet(PAGOS_SHEET);
    sh.getRange(1, 1, 1, PAGOS_COLS.length).setValues([PAGOS_COLS]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    PAGOS_COLS.forEach(col => {
      if (!existing.includes(col)) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
        existing.push(col);
      }
    });
  }
  return sh;
}
function getPagos_() {
  const sh = getPagosSheet_();
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const headers = vals[0].map(String);
  return vals.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  }).filter(r => r.id);
}
function savePagos_(payload) {
  const items = Array.isArray(payload) ? payload : (payload.pagos || []);
  const sh = getPagosSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.deleteRows(2, lastRow - 1);
  if (!items.length) return { ok: true };
  const now = new Date().toISOString();
  const rows = items.map(p => PAGOS_COLS.map(col => {
    if (col === "createdAt") return p.createdAt || now;
    if (col === "updatedAt") return now;
    if (col === "id")        return p.id || ("pg_" + Date.now() + Math.random());
    if (col === "receipt")   return p.receipt && p.receipt.length < 500 ? p.receipt : (p.receipt ? "[foto]" : "");
    return p[col] !== undefined ? p[col] : "";
  }));
  sh.getRange(2, 1, rows.length, PAGOS_COLS.length).setValues(rows);
  SpreadsheetApp.flush();
  return { ok: true, count: rows.length };
}
function updatePago_(id, updates) {
  if (!id) return { ok: false, error: "Falta id" };
  const sh = getPagosSheet_();
  const vals = sh.getDataRange().getValues();
  const headers = vals[0].map(String);
  const idIdx = headers.indexOf("id");
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idIdx]) === String(id)) {
      Object.entries(updates).forEach(([k, v]) => {
        const ci = headers.indexOf(k);
        if (ci >= 0) sh.getRange(r + 1, ci + 1).setValue(v ?? "");
      });
      const updIdx = headers.indexOf("updatedAt");
      if (updIdx >= 0) sh.getRange(r + 1, updIdx + 1).setValue(new Date().toISOString());
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  return { ok: false, error: "Pago no encontrado: " + id };
}
function deletePago_(id) {
  if (!id) return { ok: false, error: "Falta id" };
  const sh = getPagosSheet_();
  const vals = sh.getDataRange().getValues();
  const idIdx = vals[0].map(String).indexOf("id");
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idIdx]) === String(id)) {
      sh.deleteRow(r + 1);
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  return { ok: false, error: "No encontrado: " + id };
}
function notifyNewPago_(p) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token   = props.getProperty("SLACK_BOT_TOKEN");
    const channel = props.getProperty("SLACK_CHANNEL_ID") || "C094NE421NV";
    if (!token) return { ok: false, error: "No Slack token" };
    const monto = p.amount ? `${p.currency || 'COP'} ${parseFloat(p.amount).toLocaleString('es-CO')}` : '—';
    const text = `💸 *Nueva solicitud de pago*\n• *De:* ${p.person || '—'}\n• *Categoría:* ${p.category || '—'}\n• *Cliente:* ${p.client || '—'}\n• *Monto:* ${monto}\n• *Método:* ${p.method || '—'}`;
    const res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
      method: "post", contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      payload: JSON.stringify({ channel, text }),
      muteHttpExceptions: true,
    });
    const data = JSON.parse(res.getContentText());
    return { ok: data.ok, slackError: data.error };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}
function notifyPagoStatus_(p) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token   = props.getProperty("SLACK_BOT_TOKEN");
    const channel = props.getProperty("SLACK_CHANNEL_ID") || "C094NE421NV";
    if (!token) return { ok: false, error: "No Slack token" };
    const statusLabel = p.status === 'aprov' ? '✅ *APROBADO*' : '❌ *RECHAZADO*';
    const monto = p.amount ? `${p.currency || 'COP'} ${parseFloat(p.amount).toLocaleString('es-CO')}` : '—';
    const cat   = (p.category || '').replace(/^(Service:|Tour:|Wedding:|Business Expenses:|Cartagena: Chef Services:)\s*/, '');
    const text = `${statusLabel} — Solicitud de pago\n• *Solicitado por:* ${p.person || '—'}\n• *Categoría:* ${cat}\n• *Cliente:* ${p.client || '—'}\n• *Monto:* ${monto}`;
    const res = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
      method: "post", contentType: "application/json",
      headers: { "Authorization": "Bearer " + token },
      payload: JSON.stringify({ channel, text }),
      muteHttpExceptions: true,
    });
    const data = JSON.parse(res.getContentText());
    return { ok: data.ok, slackError: data.error };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ═══════════════ RECORDATORIOS AUTOMÁTICOS ═══════════════════════
function sendDailyReminders_() {
  const cobros = getPagos_();
  const ayer = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  cobros.forEach(p => {
    if (!p.phone || p.status === 'pago') return;
    if (!p.cobroAt) return;
    if (p.cobroAt.slice(0,10) !== ayer) return;
    if (p.reminderAt) return;
    UrlFetchApp.fetch('https://www.twotravelvip.com/api/whatsapp', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ to: p.phone, message: buildReminderMsg_(p), type: 'reminder' }),
      muteHttpExceptions: true,
    });
    updatePago_(p.id, { reminderAt: new Date().toISOString() });
  });
}
function buildReminderMsg_(p) {
  const name = (p.client||'').split(/[\s,&]/)[0];
  const monto = p.amount ? `${p.currency} $${parseFloat(p.amount).toLocaleString('es',{minimumFractionDigits:2})}` : '';
  const pdf = p.dept === 'wedding' ? 'https://www.twotravelvip.com/payment-options-weddings.pdf' : 'https://www.twotravelvip.com/payment-options.pdf';
  return p.dept === 'wedding'
    ? `Hola ${name}! 💍 Te recordamos que tienes un pago pendiente con Two Lovers.\n\n${p.desc||''}${monto?'\n\n💰 Total: *'+monto+'*':''}\n\nMétodos de pago:\n${pdf}\n\n— Two Lovers ✨`
    : `Hola ${name}! 🌟 Te recordamos que tienes un pago pendiente con Two Travel.\n\n${p.desc||''}${monto?'\n\n💰 Total: *'+monto+'*':''}\n\nMétodos de pago:\n${pdf}\n\n— Two Travel ✨`;
}
function addPriceTiersCol() {
  getPropSheet_();
  Logger.log("Listo");
}

// ═══════════════ CALENDAR TOKENS ═════════════════════════════════
function saveCalendarToken(payload) {
  const { concierge, refreshToken } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Properties")
    || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Properties");
  const data = sheet.getDataRange().getValues();
  const key = `calendar_token_${concierge}`;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(refreshToken);
      return { ok: true };
    }
  }
  sheet.appendRow([key, refreshToken]);
  return { ok: true };
}
function getCalendarToken(payload) {
  const { concierge } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Properties");
  if (!sheet) return { refreshToken: null };
  const data = sheet.getDataRange().getValues();
  const key = `calendar_token_${concierge}`;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return { refreshToken: data[i][1] };
  }
  return { refreshToken: null };
}
function getCalendarTokens() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Properties");
  if (!sheet) return { tokens: [] };
  const data = sheet.getDataRange().getValues();
  const tokens = data
    .filter(row => String(row[0]).startsWith("calendar_token_") && row[1])
    .map(row => ({ concierge: row[0].replace("calendar_token_", ""), hasToken: true }));
  return { tokens };
}
function addMeetingToKickoff(payload) {
  const { kickoffId, meeting } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf("id");
  const meetCol = headers.indexOf("meetingNotes");
  if (idCol < 0 || meetCol < 0) return { ok: false };
  for (let i = 1; i < data.length; i++) {
    if (data[i][idCol] === kickoffId) {
      let meetings = [];
      try { meetings = JSON.parse(data[i][meetCol] || "[]"); } catch {}
      meetings.push(meeting);
      sheet.getRange(i + 1, meetCol + 1).setValue(JSON.stringify(meetings));
      return { ok: true };
    }
  }
  return { ok: false, error: "Kickoff not found" };
}

// ═══════════════ AVAILABILITY ════════════════════════════════════
function getAvailability(e) {
  const email = (e.parameter.email || "").trim().toLowerCase();
  if (!email) return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Missing email" }))
    .setMimeType(ContentService.MimeType.JSON);

  // Load saved schedule/settings/manualSlots from the Availability sheet
  let savedSchedule = null, savedSettings = null, savedManualSlots = null, savedBookings = [];
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("Availability");
    if (sheet) {
      const data    = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).toLowerCase().trim());
      const col     = (name) => headers.indexOf(name);
      for (let i = 1; i < data.length; i++) {
        if ((data[i][col("email")] || "").toLowerCase().trim() === email) {
          const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch { return null; } };
          savedSchedule   = parse(data[i][col("schedule")]);
          savedSettings   = parse(data[i][col("settings")]);
          savedManualSlots = parse(data[i][col("manualslots")]);
          savedBookings   = parse(data[i][col("bookings")]) || [];
          break;
        }
      }
    }
  } catch(err) {
    Logger.log("Sheet read error in getAvailability: " + err);
  }

  // Merge calendar-blocked times (all-day and existing events)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 3, 1);
  let calBlocked = [];
  try {
    const cal = CalendarApp.getCalendarById(email) || CalendarApp.getDefaultCalendar();
    if (cal) {
      const events = cal.getEvents(start, end);
      events.forEach(ev => {
        const title = (ev.getTitle() || "").toLowerCase();
        const isOOO = ev.isAllDayEvent() ||
                      title.includes("out of office") ||
                      title.includes("ooo") ||
                      title.includes("fuera") ||
                      title.includes("vacacion") ||
                      title.includes("libre") ||
                      title.includes("no disponible");
        if (isOOO || !ev.isAllDayEvent()) {
          const evStart = ev.getStartTime();
          const evEnd = ev.getEndTime();
          const dateStr = Utilities.formatDate(evStart, "America/Bogota", "yyyy-MM-dd");
          if (ev.isAllDayEvent()) {
            calBlocked.push({ date: dateStr, start: "00:00", end: "23:59", fromCalendar: true, title: ev.getTitle() });
          } else {
            calBlocked.push({
              date: dateStr,
              start: Utilities.formatDate(evStart, "America/Bogota", "HH:mm"),
              end:   Utilities.formatDate(evEnd,   "America/Bogota", "HH:mm"),
              fromCalendar: true,
              title: ev.getTitle(),
            });
          }
        }
      });
    }
  } catch(err) {
    Logger.log("Calendar error for " + email + ": " + err);
  }

  const result = {
    ok:          true,
    schedule:    savedSchedule,
    settings:    savedSettings,
    manualSlots: savedManualSlots,
    bookings:    savedBookings,
    blocked:     calBlocked,
  };
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
function saveAvailability(body) {
  const email = (body.email || "").trim().toLowerCase();
  if (!email) return jsonOut({ ok: false, error: "no email" });
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Availability") || ss.insertSheet("Availability");
  const data  = sheet.getDataRange().getValues();
  const COLS = ["email","schedule","settings","blocked","bookings","manualSlots"];
  if (!data[0].length || (data[0].length === 1 && !data[0][0])) {
    sheet.getRange(1, 1, 1, COLS.length).setValues([COLS]);
    data[0] = COLS.slice();
  }
  const colIdx = (name) => {
    let idx = data[0].indexOf(name);
    if (idx === -1) {
      sheet.getRange(1, data[0].length + 1).setValue(name);
      data[0].push(name);
      idx = data[0].length - 1;
    }
    return idx;
  };
  const str = (v) => JSON.stringify(v ?? null);
  for (let i = 1; i < data.length; i++) {
    if ((data[i][colIdx("email")] || "").toLowerCase() === email) {
      const row = i + 1;
      sheet.getRange(row, colIdx("schedule")    + 1).setValue(str(body.schedule));
      sheet.getRange(row, colIdx("settings")    + 1).setValue(str(body.settings));
      sheet.getRange(row, colIdx("blocked")     + 1).setValue(str(body.blocked));
      sheet.getRange(row, colIdx("manualSlots") + 1).setValue(str(body.manualSlots || []));
      SpreadsheetApp.flush();
      return jsonOut({ ok: true });
    }
  }
  const newRow = new Array(data[0].length).fill("");
  newRow[colIdx("email")]       = email;
  newRow[colIdx("schedule")]    = str(body.schedule);
  newRow[colIdx("settings")]    = str(body.settings);
  newRow[colIdx("blocked")]     = str(body.blocked);
  newRow[colIdx("manualSlots")] = str(body.manualSlots || []);
  newRow[colIdx("bookings")]    = "[]";
  sheet.appendRow(newRow);
  SpreadsheetApp.flush();
  return jsonOut({ ok: true });
}
function bookSlot(body) {
  const email = (body.conciergeEmail || "").trim().toLowerCase();
  if (!email) return jsonOut({ ok: false, error: "no email" });
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Availability") || ss.insertSheet("Availability");
  const data  = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx  = (name) => headers.indexOf(name);
  for (let i = 1; i < data.length; i++) {
    if ((data[i][colIdx("email")] || "").toLowerCase() === email) {
      let bookings = [];
      try { bookings = JSON.parse(data[i][colIdx("bookings")] || "[]"); } catch {}
      bookings.push({
        date:       body.date,
        time:       body.time,
        duration:   body.duration || 30,
        clientName: body.guestName || "",
        kickoffId:  body.kickoffId || "",
        topic:      body.topic || "",
        lang:       body.lang || "en",
        bookedAt:   new Date().toISOString(),
      });
      sheet.getRange(i + 1, colIdx("bookings") + 1).setValue(JSON.stringify(bookings));
      try {
        MailApp.sendEmail({
          to: email,
          subject: `Nueva reunión: ${body.guestName} — ${body.date} ${body.time}`,
          body: `Cliente: ${body.guestName}\nFecha: ${body.date} a las ${body.time}\nTema: ${body.topic || "—"}\nKickoff: ${body.kickoffId || "—"}`,
        });
      } catch(e) {}
      return jsonOut({ ok: true });
    }
  }
  return jsonOut({ ok: false, error: "concierge not found" });
}

// ═══════════════ EMAIL NOTIFICATIONS ════════════════════════════
function notifyMeetingBooked_(p) {
  // p: { conciergeEmail, conciergeName, clientName, clientEmail, date, time, kickoffId, type }
  const to = (p.conciergeEmail || "").trim();
  if (!to) return { ok: false, error: "no conciergeEmail" };
  const date = p.date || "—";
  const time = p.time || "—";
  const client = p.clientName || "—";
  const type = p.type || "Reunión";
  const kick = p.kickoffId ? `\nKickoff: ${p.kickoffId}` : "";
  try {
    MailApp.sendEmail({
      to,
      subject: `📅 Nueva reunión agendada: ${client} — ${date} ${time}`,
      body: `Hola ${p.conciergeName || ""},\n\nUn cliente acaba de agendar una reunión contigo.\n\nCliente: ${client}\nEmail: ${p.clientEmail || "—"}\nFecha: ${date} a las ${time}\nTipo: ${type}${kick}\n\n— Two Travel`,
    });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

function notifyCatalogSubmit_(p) {
  // p: { conciergeEmail, conciergeName, guestName, kickoffId, tripName }
  const to = (p.conciergeEmail || "").trim();
  if (!to) return { ok: false, error: "no conciergeEmail" };
  const guest = p.guestName || "—";
  const trip  = p.tripName  || p.kickoffId || "—";
  try {
    MailApp.sendEmail({
      to,
      cc: "caro@two.travel",
      subject: `🛍️ Cliente llenó el catálogo: ${guest}`,
      body: `Hola ${p.conciergeName || ""},\n\n${guest} acaba de completar su selección en el catálogo.\n\nTrip / Deal: ${trip}\nKickoff ID: ${p.kickoffId || "—"}\n\nEntra al panel para ver sus picks:\nhttps://twotravelvip.com/?mode=concierge\n\n— Two Travel`,
    });
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ═══════════════ ORDENAR TAREAS POR FECHA ════════════════════════
function reorderTasksByDueDate_() {
  const sh = SS.getSheetByName("Tasks");
  if (!sh || sh.getLastRow() < 3) return;
  sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn())
    .sort({ column: 5, ascending: true });
}

// ═══════════════ MONDAY.COM INTEGRATION ══════════════════════════
const MONDAY_CONCIERGE_BOARD = 18411433982;
const MONDAY_LOGISTICA_BOARD = 18410882462;

function mondayApi_(query) {
  const token = PropertiesService.getScriptProperties().getProperty("MONDAY_API_TOKEN");
  if (!token) throw new Error("MONDAY_API_TOKEN no configurado en Script Properties");
  const res = UrlFetchApp.fetch("https://api.monday.com/v2", {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": token, "API-Version": "2024-01" },
    payload: JSON.stringify({ query }),
    muteHttpExceptions: true,
  });
  return JSON.parse(res.getContentText());
}
function getMondayGroups_(boardId) {
  const data = mondayApi_(`{ boards(ids:[${boardId}]) { groups { id title } } }`);
  return data?.data?.boards?.[0]?.groups || [];
}
function findMonthGroup_(groups, dateStr) {
  if (!dateStr || !groups.length) return groups[0]?.id;
  const d = new Date(dateStr);
  const monthsEn = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthsEs = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mEn = monthsEn[d.getMonth()];
  const mEs = monthsEs[d.getMonth()];
  const match = groups.find(g =>
    g.title.includes(mEn) || g.title.toLowerCase().includes(mEs.toLowerCase())
  );
  return match?.id || groups[0]?.id;
}
function createMondayItems_(payload) {
  try {
    const { items, clientName, date, pax } = payload;
    const groupsLogistica = getMondayGroups_(MONDAY_LOGISTICA_BOARD);
    const groupLogistica = findMonthGroup_(groupsLogistica, date);
    const results = [];
    for (const item of (items || [])) {
      const activity = item.name || "Servicio";
      const itemName = clientName + " — " + activity;
      const colLogistica = {};
      if (date) colLogistica["date"] = { date: date };
      colLogistica["text_mm2wdpjy"] = activity;
      if (pax) colLogistica["numeric_mm2wr3ak"] = String(pax);
      const qL = "mutation { create_item(board_id: " + MONDAY_LOGISTICA_BOARD +
        ", group_id: \"" + groupLogistica + "\"" +
        ", item_name: " + JSON.stringify(itemName) +
        ", column_values: " + JSON.stringify(JSON.stringify(colLogistica)) +
        ") { id } }";
      const rL = mondayApi_(qL);
      results.push({ item: activity, logisticaId: rL?.data?.create_item?.id || null });
    }
    return { ok: true, count: results.length, results };
  } catch(err) {
    return { ok: false, error: err.message };
  }
}

// ═══════════════ COMISIONES A PROVEEDORES ════════════════════════
const COMISIONES_SHEET = "Comisiones";
const COMISIONES_COLS  = ["id","proveedor","concepto","monto","moneda","estado","fechaVencimiento","phone","cobroAt","reminderAt","notes","createdAt","updatedAt"];

function getComisionesSheet_() {
  let sh = SS.getSheetByName(COMISIONES_SHEET);
  if (!sh) {
    sh = SS.insertSheet(COMISIONES_SHEET);
    sh.getRange(1, 1, 1, COMISIONES_COLS.length).setValues([COMISIONES_COLS]);
    sh.setFrozenRows(1);
  } else {
    const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    COMISIONES_COLS.forEach(col => {
      if (!existing.includes(col)) {
        sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
        existing.push(col);
      }
    });
  }
  return sh;
}
function saveComisiones_(payload) {
  const items = Array.isArray(payload) ? payload : (payload.comisiones || []);
  const sh = getComisionesSheet_();
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.deleteRows(2, lastRow - 1);
  if (!items.length) return { ok: true };
  const now = new Date().toISOString();
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const rows = items.map(c => headers.map(col => {
    if (col === "createdAt") return c.createdAt || now;
    if (col === "updatedAt") return now;
    if (col === "id")        return c.id || ("cm_" + Date.now() + Math.random());
    return c[col] !== undefined ? c[col] : "";
  }));
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  SpreadsheetApp.flush();
  return { ok: true, count: rows.length };
}
function getComisiones_() {
  const sh = getComisionesSheet_();
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return [];
  const headers = vals[0].map(String);
  return vals.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  }).filter(r => r.id);
}

// ═══════════════════════════════════════════════════════════════════
// BODAS (TWO LOVERS)
// ═══════════════════════════════════════════════════════════════════
const BODAS_SHEET = "Bodas";
const BODAS_COLS  = [
  "id","clienteName","weddingDate","venue","responsable","phase","status",
  "guestCount","budget","notes","contact","coverPhoto",
  "tasks","suppliers","songs","photos","calls","guests","palette","schedule",
  "createdAt","updatedAt",
];

function getBodaSheet_() {
  let sh = SS.getSheetByName(BODAS_SHEET);
  if (!sh) {
    sh = SS.insertSheet(BODAS_SHEET);
    sh.getRange(1, 1, 1, BODAS_COLS.length).setValues([BODAS_COLS]);
    sh.setFrozenRows(1);
    return sh;
  }
  // Agrega columnas nuevas si faltan (para migraciones)
  const existing = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  BODAS_COLS.forEach(col => {
    if (!existing.includes(col)) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
      existing.push(col);
    }
  });
  return sh;
}
function listBodas_() {
  const sh = getBodaSheet_();
  if (sh.getLastRow() < 2) return [];
  const all = sh.getDataRange().getValues();
  const headers = all[0].map(String);
  return all.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const v = row[i];
      obj[h] = (v instanceof Date) ? v.toISOString() : (v ?? "");
    });
    return obj;
  }).filter(r => r.id);
}
function saveBoda_(payload) {
  const sh = getBodaSheet_();
  const now = new Date().toISOString();
  const id  = payload.id || ("boda_" + Date.now());
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const row = headers.map(col => {
    if (col === "id")        return id;
    if (col === "createdAt") return now;
    if (col === "updatedAt") return now;
    return payload[col] !== undefined ? payload[col] : "";
  });
  sh.appendRow(row);
  SpreadsheetApp.flush();
  return { ok: true, id };
}
function updateBoda_(id, updates) {
  if (!id) return { ok: false, error: "Falta id" };
  const sh = getBodaSheet_();
  const data = sh.getDataRange().getValues();
  const headers = data[0].map(String);
  const idIdx = headers.indexOf("id");
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx]) !== String(id)) continue;
    Object.entries(updates).forEach(([k, v]) => {
      const ci = headers.indexOf(k);
      if (ci >= 0) sh.getRange(r + 1, ci + 1).setValue(v ?? "");
    });
    const updIdx = headers.indexOf("updatedAt");
    if (updIdx >= 0) sh.getRange(r + 1, updIdx + 1).setValue(new Date().toISOString());
    SpreadsheetApp.flush();
    return { ok: true };
  }
  return { ok: false, error: "Boda no encontrada: " + id };
}
function deleteBoda_(id) {
  if (!id) return { ok: false, error: "Falta id" };
  const sh = getBodaSheet_();
  const data = sh.getDataRange().getValues();
  const idIdx = data[0].map(String).indexOf("id");
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx]) !== String(id)) continue;
    sh.deleteRow(r + 1);
    SpreadsheetApp.flush();
    return { ok: true };
  }
  return { ok: false, error: "Boda no encontrada: " + id };
}

// ── Migración única: bodas de Sheet1 → hoja Bodas ─────────────────
// Ejecutar UNA SOLA VEZ desde el editor de GAS:
// seleccionar "migrateBodas" en el dropdown y presionar ▶
function migrateBodas() {
  const sh1 = SS.getSheetByName("Sheet1");
  if (!sh1) { Logger.log("Sheet1 no encontrada"); return; }

  const data = sh1.getDataRange().getValues();
  const h    = data[0].map(String);
  const col  = name => h.indexOf(name);

  const toMigrate   = [];
  const rowsToDelete = [];

  for (let i = 1; i < data.length; i++) {
    const guestName = String(data[i][col("guestName")] || "");
    let meta = {};
    try { meta = JSON.parse(data[i][col("conciergeSummary")] || "{}"); } catch {}
    if (meta.type !== "boda" && !guestName.match(/^Boda:/i)) continue;

    let notes = {};
    try { notes = JSON.parse(data[i][col("internalNotes")] || "{}"); } catch {}
    let schedule = [];
    try { schedule = JSON.parse(data[i][col("travifyText")] || "[]"); } catch {}

    toMigrate.push({
      id:          String(data[i][col("id")] || ("boda_" + Date.now() + "_" + i)),
      clienteName: guestName.replace(/^Boda:\s*/i, ""),
      weddingDate: meta.weddingDate  || "",
      venue:       meta.venue        || "",
      responsable: meta.responsable  || "",
      phase:       meta.phase        || "Onboarding",
      status:      meta.status       || "Activa",
      guestCount:  meta.guestCount   || "",
      budget:      meta.budget       || "",
      notes:       meta.notes        || "",
      contact:     meta.contact      || "",
      coverPhoto:  meta.coverPhoto   || "",
      tasks:       JSON.stringify(notes.tasks     || []),
      suppliers:   JSON.stringify(notes.suppliers || []),
      songs:       JSON.stringify(notes.songs     || []),
      photos:      JSON.stringify(notes.photos    || []),
      calls:       JSON.stringify(notes.calls     || []),
      guests:      JSON.stringify(notes.guests    || []),
      palette:     JSON.stringify(notes.palette   || []),
      schedule:    JSON.stringify(schedule),
    });
    rowsToDelete.push(i + 1);
  }

  Logger.log("Bodas encontradas en Sheet1: " + toMigrate.length);
  if (!toMigrate.length) { Logger.log("Nada para migrar."); return; }

  toMigrate.forEach(b => saveBoda_(b));

  // Eliminar de Sheet1 en orden inverso para no desplazar índices
  rowsToDelete.slice().reverse().forEach(r => sh1.deleteRow(r));
  SpreadsheetApp.flush();

  Logger.log("✅ Migración completa: " + toMigrate.length + " bodas → hoja Bodas.");
}

// ─── Menu Config ────────────────────────────────────────────────
function getMenuConfig_() {
  const sheet = SS.getSheetByName("Config") || SS.insertSheet("Config");
  const data  = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === "menuConfig") {
      try { return { ok: true, data: JSON.parse(data[i][1] || "{}") }; }
      catch(e) { return { ok: true, data: {} }; }
    }
  }
  return { ok: true, data: {} };
}

function saveMenuConfig_(payload) {
  const sheet = SS.getSheetByName("Config") || SS.insertSheet("Config");
  const data  = sheet.getDataRange().getValues();
  const json  = JSON.stringify(payload.overrides || {});
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] === "menuConfig") {
      sheet.getRange(i + 1, 2).setValue(json);
      SpreadsheetApp.flush();
      return { ok: true };
    }
  }
  sheet.appendRow(["menuConfig", json]);
  SpreadsheetApp.flush();
  return { ok: true };
}
