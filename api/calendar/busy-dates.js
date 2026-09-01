// Returns a list of dates in a given month that have NO available slots.
// Called once per month render so the calendar can grey out those dates upfront.
//
// Query params:
//   concierge  — slug or email
//   month      — YYYY-MM
//   duration   — 30 or 45 (optional, defaults to 30)

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

// Query Google Calendar freebusy for an entire month range — one API call
async function getMonthBusy(accessToken, timeMin, timeMax) {
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
  return (data?.calendars?.primary?.busy || []).map(p => ({
    s: new Date(p.start),
    e: new Date(p.end),
  }));
}

function hasAvailableSlot(date, schedule, blocked, bookings, calBusyPeriods, slotMinutes) {
  const dow = new Date(date + "T12:00:00").getDay();
  const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
  const dayKey = DAY_KEYS[dow];
  const daySch = schedule[dayKey] || { active: false };
  if (!daySch.active) return false;

  // Build busy intervals for this specific date
  const busy = [];

  // Manual blocks
  blocked.filter(b => b.date === date).forEach(b => {
    busy.push({ s: toMin(b.start), e: toMin(b.end) });
  });

  // GAS bookings
  bookings.filter(b => b.date === date).forEach(b => {
    const s = toMin(b.time);
    busy.push({ s: s - 30, e: s + (b.duration || slotMinutes) + 30 });
  });

  // Google Calendar busy periods — filter to this date (Colombia UTC-5)
  calBusyPeriods.forEach(p => {
    // Check if this busy period overlaps with the date in Colombia time
    const dayStart = new Date(`${date}T00:00:00-05:00`).getTime();
    const dayEnd   = new Date(`${date}T23:59:59-05:00`).getTime();
    if (p.s.getTime() < dayEnd && p.e.getTime() > dayStart) {
      const toColMin = d => {
        const h = (d.getUTCHours() - 5 + 24) % 24;
        return h * 60 + d.getUTCMinutes();
      };
      busy.push({ s: toColMin(p.s), e: toColMin(p.e) });
    }
  });

  const windows = daySch.windows?.length
    ? [{ start: daySch.start || "09:00", end: daySch.end || "18:00" }, ...daySch.windows]
    : [{ start: daySch.start || "09:00", end: daySch.end || "18:00" }];

  for (const win of windows) {
    const wStart = toMin(win.start);
    const wEnd   = toMin(win.end);
    for (let t = wStart; t + slotMinutes <= wEnd; t += slotMinutes) {
      const slotEnd = t + slotMinutes;
      const blocked = busy.some(b => t < b.e && slotEnd > b.s);
      if (!blocked) return true; // at least one slot is free
    }
  }
  return false;
}

export default async function handler(req, res) {
  const { concierge, month, duration: durParam } = req.query;
  const slotMinutes = parseInt(durParam) === 45 ? 45 : 30;

  if (!concierge || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: "Missing or invalid params" });
  }

  const email = SLUG_TO_EMAIL[concierge] || (concierge.includes("@") ? concierge : `${concierge}@two.travel`);

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  // 1. Fetch schedule, blocks, bookings + OAuth token from GAS (two calls in parallel)
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

  // 2. Fetch Google Calendar freebusy for the full month — one API call
  let calBusyPeriods = [];
  if (refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const accessToken = await getAccessToken(refreshToken);
      if (accessToken) {
        const timeMin = `${month}-01T00:00:00-05:00`;
        const timeMax = `${month}-${String(daysInMonth).padStart(2,"0")}T23:59:59-05:00`;
        calBusyPeriods = await getMonthBusy(accessToken, timeMin, timeMax);
      }
    } catch (e) {
      console.error("Calendar freebusy error:", e.message);
    }
  }

  // 3. Check each day in the month
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const busyDates = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2,"0")}`;
    const dateObj = new Date(date + "T12:00:00");

    // Skip past dates and weekends — these are already greyed out by the calendar
    if (dateObj < today) continue;
    const dow = dateObj.getDay();
    if (dow === 0 || dow === 6) continue;

    const available = hasAvailableSlot(date, schedule, blocked, bookings, calBusyPeriods, slotMinutes);
    if (!available) busyDates.push(date);
  }

  res.json({ month, concierge, busyDates });
}
