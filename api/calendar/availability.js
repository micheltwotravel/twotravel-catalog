// Returns available slots for a concierge on a given date
// Reads schedule + calendar blocks from GAS (which reads CalendarApp for shared calendars)

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

export default async function handler(req, res) {
  const { concierge, date, duration: durParam } = req.query;
  const slotMinutes = parseInt(durParam) === 45 ? 45 : 30;
  if (!concierge || !date) return res.status(400).json({ error: "Missing params" });

  const email = SLUG_TO_EMAIL[concierge] || (concierge.includes("@") ? concierge : `${concierge}@two.travel`);

  // Fetch schedule + blocked slots from GAS
  let schedule = DEFAULT_SCHEDULE;
  let blocked  = [];
  let bookings = [];
  try {
    const r = await fetch(`${GAS_URL}?action=getAvailability&email=${encodeURIComponent(email)}`);
    const data = await r.json();
    if (data.ok) {
      schedule = { ...DEFAULT_SCHEDULE, ...(data.schedule || {}) };
      blocked  = data.blocked  || [];
      bookings = data.bookings || [];
    }
  } catch (e) {
    console.error("GAS fetch error:", e.message);
  }

  // Check if this day of week is active
  const dow = new Date(date + "T12:00:00").getDay(); // 0=Sun,1=Mon,...,6=Sat
  const DAY_KEYS = ["sun","mon","tue","wed","thu","fri","sat"];
  const dayKey = DAY_KEYS[dow];
  const daySch = schedule[dayKey] || { active: false };
  if (!daySch.active) {
    return res.json({ date, concierge, slots: [] });
  }

  // Build busy intervals from blocked + bookings
  const busy = [];
  blocked.filter(b => b.date === date && !b.fromCalendar === false || b.date === date).forEach(b => {
    busy.push({ s: toMin(b.start), e: toMin(b.end) });
  });
  // Also include fromCalendar blocks (calendar events)
  blocked.filter(b => b.date === date).forEach(b => {
    const s = toMin(b.start), e = toMin(b.end);
    if (!busy.find(x => x.s === s && x.e === e)) busy.push({ s, e });
  });
  bookings.filter(b => b.date === date).forEach(b => {
    const s = toMin(b.time);
    busy.push({ s: s - 30, e: s + (b.duration || slotMinutes) + 30 });
  });

  // Generate slots within schedule window
  const windows = daySch.windows?.length
    ? daySch.windows
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
