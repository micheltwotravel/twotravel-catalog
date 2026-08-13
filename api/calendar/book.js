// Creates a Google Calendar event + saves meeting to Sheets kickoff

const DEFAULT_SCHEDULE = {
  mon: { active: true,  start: "09:00", end: "18:00" },
  tue: { active: true,  start: "09:00", end: "18:00" },
  wed: { active: true,  start: "09:00", end: "18:00" },
  thu: { active: true,  start: "09:00", end: "18:00" },
  fri: { active: true,  start: "09:00", end: "18:00" },
  sat: { active: false, start: "09:00", end: "14:00" },
  sun: { active: false, start: "09:00", end: "13:00" },
};
const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
function toMin(t) { const [h,m] = (t||"00:00").split(":").map(Number); return h*60+(m||0); }

async function getAccessToken(refreshToken) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  return data.access_token;
}

async function getCalendarBusy(accessToken, date) {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: `${date}T00:00:00-05:00`, timeMax: `${date}T23:59:59-05:00`,
      timeZone: "America/Bogota", items: [{ id: "primary" }],
    }),
  });
  const data = await res.json();
  return (data?.calendars?.primary?.busy || []).map(p => {
    const toColMin = iso => { const d = new Date(iso); const h = (d.getUTCHours()-5+24)%24; return h*60+d.getUTCMinutes(); };
    return { s: toColMin(p.start), e: toColMin(p.end) };
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { concierge, date, startTime, endTime, clientName, clientEmail, clientPhone, guestEmails, kickoffId, meetingType, lang, duration: durParam } = req.body;
  if (!concierge || !date || !startTime || !clientName || !clientEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const GAS = process.env.VITE_TASK_API_URL || process.env.GAS_URL
    || "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

  const SLUG_TO_EMAIL = {
    caro:"caro@two.travel", alia:"alia@two.travel", daniela:"daniela@two.travel",
    nataly:"nataly@two.travel", giulia:"giulia@two.travel", natalia:"natalia@two.travel", michel:"michel@two.travel",
  };
  const email = SLUG_TO_EMAIL[concierge] || (concierge.includes("@") ? concierge : `${concierge}@two.travel`);
  const slotMinutes = parseInt(durParam) === 45 ? 45 : 30;

  // ── Server-side availability re-validation ────────────────────────────────
  // Fetch schedule + blocks + bookings from GAS and calendar token in parallel
  let schedule = DEFAULT_SCHEDULE, blocked = [], bookings = [], calRefreshToken = null;
  try {
    const [availRes, tokenRes] = await Promise.all([
      fetch(`${GAS}?action=getAvailability&email=${encodeURIComponent(email)}`),
      fetch(GAS, { method:"POST", body: JSON.stringify({ action:"getCalendarToken", payload:{ concierge } }) }),
    ]);
    const [availData, tokenData] = await Promise.all([availRes.json(), tokenRes.json()]);
    if (availData.ok) {
      schedule = { ...DEFAULT_SCHEDULE, ...(availData.schedule || {}) };
      blocked  = availData.blocked  || [];
      bookings = availData.bookings || [];
    }
    calRefreshToken = tokenData?.refreshToken || null;
  } catch(e) { console.error("GAS fetch:", e.message); }

  // Check day-of-week is active
  const dayKey = DAY_KEYS[new Date(date + "T12:00:00").getDay()];
  const daySch = schedule[dayKey] || { active: false };
  if (!daySch.active) {
    return res.status(409).json({ error: "Este día no está disponible. Por favor elige otra fecha." });
  }

  // Build busy intervals
  const slotStart = toMin(startTime);
  const slotEnd   = slotStart + slotMinutes;
  const busy = [];
  blocked.filter(b => b.date === date).forEach(b => busy.push({ s: toMin(b.start), e: toMin(b.end) }));
  bookings.filter(b => b.date === date).forEach(b => {
    const s = toMin(b.time);
    busy.push({ s: s - 30, e: s + (b.duration || slotMinutes) + 30 });
  });

  // Overlay Google Calendar freebusy
  if (calRefreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const at = await getAccessToken(calRefreshToken);
      if (at) (await getCalendarBusy(at, date)).forEach(b => busy.push(b));
    } catch(e) { console.error("Calendar busy:", e.message); }
  }

  // Reject if slot overlaps any busy interval
  const isBlocked = busy.some(b => slotStart < b.e && slotEnd > b.s);
  if (isBlocked) {
    return res.status(409).json({ error: "Esta hora ya no está disponible. Por favor elige otro horario." });
  }

  // Reject if slot is outside schedule window
  const windows = daySch.windows?.length ? daySch.windows : [{ start: daySch.start||"09:00", end: daySch.end||"18:00" }];
  const withinWindow = windows.some(w => slotStart >= toMin(w.start) && slotEnd <= toMin(w.end));
  if (!withinWindow) {
    return res.status(409).json({ error: "Esta hora está fuera del horario disponible." });
  }
  // ── End re-validation ─────────────────────────────────────────────────────

  const type = meetingType || "Kickoff Call";
  const title = `Two Travel — ${type} with ${clientName}`;
  const startISO = `${date}T${startTime}:00-05:00`;
  const endISO   = `${date}T${endTime}:00-05:00`;

  let eventId = null, meetLink = "", htmlLink = "";

  // Create Google Calendar event only if token exists and OAuth vars are set
  if (calRefreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const accessToken = await getAccessToken(calRefreshToken);
      if (accessToken) {
        const eventRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: title,
            start:   { dateTime: startISO, timeZone: "America/Bogota" },
            end:     { dateTime: endISO,   timeZone: "America/Bogota" },
            attendees: [
              { email: clientEmail },
              { email: email },   // concierge gets calendar invite
              ...((Array.isArray(guestEmails) ? guestEmails : []).filter(e => e && e !== clientEmail && e !== email).map(e => ({ email: e }))),
            ],
            conferenceData: {
              createRequest: {
                requestId: `tt-${Date.now()}`,
                conferenceSolutionKey: { type: "hangoutsMeet" },
              },
            },
            description: lang === "es"
              ? `Hola ${clientName},\n\nTu reunión con Two Travel está confirmada. Estamos muy emocionados de conectar contigo y comenzar a planear tu experiencia.\n\nNos vemos pronto — cualquier pregunta antes de la llamada, escríbenos directamente.\n\nEl equipo de Two Travel\n\n—\n📧 ${clientEmail}${clientPhone ? `\n📱 ${clientPhone}` : ""}`
              : `Hi ${clientName},\n\nYour call with Two Travel is confirmed — we're looking forward to connecting with you and starting to plan your experience.\n\nSee you soon! Feel free to reach out before the call if you have any questions.\n\nThe Two Travel Team\n\n—\n📧 ${clientEmail}${clientPhone ? `\n📱 ${clientPhone}` : ""}`,
          }),
        });
        const event = await eventRes.json();
        eventId  = event.id  || null;
        meetLink = event.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri || "";
        htmlLink = event.htmlLink || "";
      }
    } catch(e) { console.error("Calendar event creation failed:", e.message); }
  }

  // Save meeting to GAS (always, with or without calendar event)
  const mtgId = `mtg_${Date.now()}`;
  await fetch(GAS, {
    method: "POST",
    body: JSON.stringify({
      action: "addMeetingToKickoff",
      payload: {
        kickoffId: kickoffId || "",
        meeting: {
          id:     mtgId,
          date,
          time:   startTime,
          type,
          status: "scheduled",
          notes:  `${meetLink ? `Meet: ${meetLink}\n` : ""}Cliente: ${clientName} · ${clientEmail}${clientPhone ? ` · ${clientPhone}` : ""}`,
          tasks:  [],
          clientName,
          clientEmail,
          concierge,
        },
      },
    }),
  }).catch(e => console.error("GAS addMeeting error:", e.message));

  // Notify concierge by email via GAS (in addition to the calendar invite)
  fetch(GAS, {
    method: "POST",
    body: JSON.stringify({
      action: "notifyMeetingBooked",
      payload: {
        conciergeEmail: email,
        conciergeName:  SLUG_TO_NAME[concierge] || concierge,
        clientName,
        clientEmail,
        date,
        time:      startTime,
        kickoffId: kickoffId || "",
        type,
      },
    }),
  }).catch(e => console.error("GAS notify error:", e.message));

  res.json({ ok: true, eventId, meetLink, htmlLink });
}

const SLUG_TO_NAME = {
  caro: "Carolina", alia: "Alia", daniela: "Daniela",
  nataly: "Nataly", giulia: "Giulia", natalia: "Natalia", michel: "Michel",
};
