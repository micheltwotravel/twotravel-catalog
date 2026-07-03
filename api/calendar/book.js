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

  const { concierge, date, startTime, endTime, clientName, clientEmail, clientPhone, kickoffId, meetingType } = req.body;
  if (!concierge || !date || !startTime || !clientName || !clientEmail) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const GAS = process.env.VITE_TASK_API_URL || process.env.GAS_URL;

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
  const title = `Two Travel — ${type} con ${clientName}`;

  // Create Google Calendar event with Meet link
  const eventRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1", {
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
      description: `Reunión agendada desde Two Travel Portal\nCliente: ${clientName}\nEmail: ${clientEmail}\nTeléfono: ${clientPhone || "—"}`,
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
