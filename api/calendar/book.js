// Creates a Google Calendar event + saves meeting to Sheets kickoff

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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { concierge, date, startTime, endTime, clientName, clientEmail, clientPhone, kickoffId, meetingType, lang } = req.body;
  if (!concierge || !date || !startTime || !clientName || !clientEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const GAS = process.env.VITE_TASK_API_URL || process.env.GAS_URL
    || "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

  // Get refresh token
  const tokenRes = await fetch(GAS, {
    method: "POST",
    body: JSON.stringify({ action: "getCalendarToken", payload: { concierge } }),
  });
  const tokenData = await tokenRes.json();
  const refreshToken = tokenData?.refreshToken;
  if (!refreshToken) return res.status(404).json({ error: "Calendar not connected" });

  const accessToken = await getAccessToken(refreshToken);

  const startISO = `${date}T${startTime}:00-05:00`;
  const endISO   = `${date}T${endTime}:00-05:00`;

  const type = meetingType || "Kickoff Call";
  const title = `Two Travel — ${type} with ${clientName}`;

  // Create Google Calendar event with Meet link
  const eventRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: title,
      start:   { dateTime: startISO, timeZone: "America/Bogota" },
      end:     { dateTime: endISO,   timeZone: "America/Bogota" },
      attendees: [{ email: clientEmail }],
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
  if (!event.id) return res.status(500).json({ error: "Failed to create calendar event", detail: event });

  const meetLink = event.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri || "";

  // Save meeting to kickoff in Sheets if kickoffId provided
  if (kickoffId) {
    await fetch(GAS, {
      method: "POST",
      body: JSON.stringify({
        action: "addMeetingToKickoff",
        payload: {
          kickoffId,
          meeting: {
            id:     `mtg_${Date.now()}`,
            date,
            time:   startTime,
            type,
            status: "scheduled",
            notes:  `Meet: ${meetLink}\nCliente: ${clientName} · ${clientEmail}${clientPhone ? ` · ${clientPhone}` : ""}`,
            tasks:  [],
          },
        },
      }),
    });
  }

  res.json({ ok: true, eventId: event.id, meetLink, htmlLink: event.htmlLink });
}
