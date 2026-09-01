// Returns available slots for a concierge on a given date
// Reads schedule + manual blocks from GAS, then overlays Google Calendar freebusy

const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

const SLUG_TO_EMAIL = {
  caro:    "caro@two.travel",
  alia:    "alia@two.travel",
  daniela: "daniela@two.travel",
  nataly:  "nataly@two.travel",
  giulia:  "giulia@two.travel",
  natalia: "natalia@two.travel",
  michel:  "michel@two.travel",
};

const DEFAULT_SCHEDULE = {
  mon: { active: true,  start: "09:00", end: "18:00" },
  tue: { active: true,  start: "09:00", end: "18:00" },
  wed: { active: true,  start: "09:00", end: "18:00" },
  thu: { active: true,  start: "09:00", end: "18:00" },
  fri: { active: true,  start: "09:00", end: "18:00" },
  sat: { active: false, start: "09:00", end: "14:00" },
  sun: { active: false, start: "09:00", end: "13:00" },
};

function toMin(t) {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}
function fromMin(m) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

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
  return data.access_token || null;
}

async function getCalendarBusy(accessToken, email, date) {
  // Colombia is UTC-5; query full day in UTC to cover all Colombia hours
  const timeMin = `${date}T00:00:00-05:00`;
  const timeMax = `${date}T23:59:59-05:00`;

  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: "America/Bogota",
      items: [{ id: "primary" }],
    }),
  });
  const data = await res.json();
  const periods = data?.calendars?.primary?.busy || [];
  // Convert UTC ISO times → Colombia local minutes
  return periods.map(p => {
    const toColMin = iso => {
      const d = new Date(iso);
      // Colombia UTC-5
      const h = (d.getUTCHours() - 5 + 24) % 24;
      const m = d.getUTCMinutes();
      return h * 60 + m;
    };
    return { s: toColMin(p.start), e: toColMin(p.end) };
  });
}

export default async function handler(req, res) {
  const { concierge, date, duration: durParam } = req.query;
  const slotMinutes = parseInt(durParam) === 45 ? 45 : 30;
  if (!concierge || !date) return res.status(400).json({ error: "Missing params" });

  const email = SLUG_TO_EMAIL[concierge] || (concierge.includes("@") ? concierge : `${concierge}@two.travel`);

  // 1. Fetch schedule + manual blocked slots + bookings from GAS (8s timeout)
  let schedule = DEFAULT_SCHEDULE;
  let blocked  = [];
  let bookings = [];
  let refreshToken = null;
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);
    const [availRes, tokenRes] = await Promise.all([
      fetch(`${GAS_URL}?action=getAvailability&email=${encodeURIComponent(email)}`, { signal: ctrl.signal }),
      fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "getCalendarToken", payload: { concierge } }),
        signal: ctrl.signal,
      }),
    ]);
    clearTimeout(timeout);
    const [availData, tokenData] = await Promise.all([availRes.json(), tokenRes.json()]);
    if (availData.ok) {
      schedule = { ...DEFAULT_SCHEDULE, ...(availData.schedule || {}) };
      blocked  = availData.blocked  || [];
      bookings = availData.bookings || [];
    }
    refreshToken = tokenData?.refreshToken || tokenData?.token || null;
  } catch (e) {
    console.error("GAS fetch error:", e.name === "AbortError" ? "timeout (>8s)" : e.message);
  }

  // 2. Check if this day of week is active
  const dow = new Date(date + "T12:00:00").getDay();
  const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
  const dayKey = DAY_KEYS[dow];
  const daySch = schedule[dayKey] || { active: false };
  if (!daySch.active) {
    return res.json({ date, concierge, slots: [] });
  }

  // 3. Build busy intervals: manual blocks + bookings
  const busy = [];
  blocked.filter(b => b.date === date).forEach(b => {
    busy.push({ s: toMin(b.start), e: toMin(b.end) });
  });
  bookings.filter(b => b.date === date).forEach(b => {
    const s = toMin(b.time);
    busy.push({ s: s - 30, e: s + (b.duration || slotMinutes) + 30 });
  });

  // 4. Overlay Google Calendar freebusy (reads out-of-office, events, tags, everything)
  if (refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const accessToken = await getAccessToken(refreshToken);
      if (accessToken) {
        const calBusy = await getCalendarBusy(accessToken, email, date);
        calBusy.forEach(b => busy.push(b));
      }
    } catch (e) {
      console.error("Calendar freebusy error:", e.message);
    }
  }

  // 5. Generate slots within schedule window, skipping all busy intervals
  // Base window (start/end) is always Ventana 1; secondary windows[] are additional
  const windows = daySch.windows?.length
    ? [{ start: daySch.start || "09:00", end: daySch.end || "18:00" }, ...daySch.windows]
    : [{ start: daySch.start || "09:00", end: daySch.end || "18:00" }];

  const slots = [];
  windows.forEach(win => {
    const wStart = toMin(win.start);
    const wEnd   = toMin(win.end);
    for (let t = wStart; t + slotMinutes <= wEnd; t += slotMinutes) {
      const slotEnd = t + slotMinutes;
      const isBlocked = busy.some(b => t < b.e && slotEnd > b.s);
      if (!isBlocked) slots.push({ start: fromMin(t), end: fromMin(slotEnd) });
    }
  });

  res.json({ date, concierge, slots: [...new Map(slots.map(s => [s.start, s])).values()] });
}
