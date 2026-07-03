// Returns available 30-min slots for a concierge on a given date
// Uses Google Calendar free/busy API with stored refresh token

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
  const { concierge, date } = req.query; // date = "2026-07-10"
  if (!concierge || !date) return res.status(400).json({ error: "Missing params" });

  const GAS = process.env.VITE_TASK_API_URL || process.env.GAS_URL
    || "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

  // Get refresh token from GAS
  const tokenRes = await fetch(GAS, {
    method: "POST",
    body: JSON.stringify({ action: "getCalendarToken", payload: { concierge } }),
  });
  const tokenData = await tokenRes.json();
  const refreshToken = tokenData?.refreshToken;
  if (!refreshToken) return res.status(404).json({ error: "Concierge calendar not connected" });

  const accessToken = await getAccessToken(refreshToken);

  // Build time range for the requested date (8am–7pm local)
  const timeMin = `${date}T08:00:00-05:00`;
  const timeMax = `${date}T19:00:00-05:00`;

  // Get calendar ID (primary)
  const calListRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const calInfo = await calListRes.json();
  const calendarId = calInfo.id || "primary";

  // Free/busy query
  const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: calendarId }],
    }),
  });
  const fbData = await fbRes.json();
  const busy = fbData.calendars?.[calendarId]?.busy || [];

  // Generate 30-min slots 8am–7pm, filter out busy ones
  const slots = [];
  for (let h = 8; h < 19; h++) {
    for (const m of [0, 30]) {
      const startHH = String(h).padStart(2, "0");
      const startMM = String(m).padStart(2, "0");
      const endH = m === 30 ? h + 1 : h;
      const endM = m === 30 ? 0 : 30;
      const endHH = String(endH).padStart(2, "0");
      const endMM = String(endM).padStart(2, "0");

      const slotStart = `${date}T${startHH}:${startMM}:00-05:00`;
      const slotEnd   = `${date}T${endHH}:${endMM}:00-05:00`;

      const isBusy = busy.some(b => {
        const bs = new Date(b.start), be = new Date(b.end);
        const ss = new Date(slotStart), se = new Date(slotEnd);
        return ss < be && se > bs;
      });

      if (!isBusy) {
        slots.push({ start: `${startHH}:${startMM}`, end: `${endHH}:${endMM}` });
      }
    }
  }

  res.json({ date, concierge, slots });
}
