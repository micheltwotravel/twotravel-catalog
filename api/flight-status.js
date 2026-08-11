// Common airline prefixes to try when flight number has no letters (e.g. "2173" → tries AV2173, AA2173…)
const AIRLINE_PREFIXES = ["AV","AA","CM","NK","LA","IB","B6","UA","DL","AM","VB","Y4","4O","WN","AC"];

async function fetchFlight(flightNum, dateParam, key) {
  const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightNum}/${dateParam}`;
  const r = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
    },
  });
  if (r.status === 429) throw { limitReached: true };
  if (!r.ok) return null;
  const text = await r.text();
  if (!text || !text.trim()) return null;
  try {
    const d = JSON.parse(text);
    return Array.isArray(d) ? (d[0] || null) : (d || null);
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { flight, date } = req.query;
  if (!flight) return res.status(400).json({ ok: false, error: "Missing flight" });

  const key = process.env.AERODATABOX_KEY;
  if (!key) {
    return res.json({ ok: false, limitReached: true, error: "No API key — set AERODATABOX_KEY in Vercel" });
  }

  try {
    const flightNum = flight.toUpperCase().replace(/\s/g, "");
    const dateParam = date || new Date().toISOString().split("T")[0];

    let f = null;

    // If number has letters already (e.g. AV2173), try directly
    if (/[A-Z]/.test(flightNum)) {
      f = await fetchFlight(flightNum, dateParam, key);
    }

    // If all digits or direct lookup failed, try common prefixes
    if (!f) {
      for (const prefix of AIRLINE_PREFIXES) {
        f = await fetchFlight(prefix + flightNum, dateParam, key);
        if (f) break;
      }
    }

    if (!f) return res.json({ ok: true, data: null });

    const toISO = (local, utc) => {
      if (utc)   return utc.replace(" ", "T") + ":00Z";
      if (local) return local.replace(" ", "T") + ":00";
      return null;
    };

    return res.json({
      ok: true,
      data: {
        flightIata:   f.number || flight,
        status:       (f.status || "scheduled").toLowerCase(),
        depScheduled: toISO(f.departure?.scheduledTime?.local, f.departure?.scheduledTime?.utc),
        depActual:    toISO(f.departure?.actualTime?.local,    f.departure?.actualTime?.utc),
        depDelay:     f.departure?.delay ?? null,
        depAirport:   f.departure?.airport?.name || "",
        depIata:      f.departure?.airport?.iata || "",
        arrScheduled: toISO(f.arrival?.scheduledTime?.local,   f.arrival?.scheduledTime?.utc),
        arrEstimated: toISO(f.arrival?.estimatedTime?.local,   f.arrival?.estimatedTime?.utc),
        arrActual:    toISO(f.arrival?.actualTime?.local,      f.arrival?.actualTime?.utc),
        arrDelay:     f.arrival?.delay ?? null,
        arrAirport:   f.arrival?.airport?.name || "",
        arrIata:      f.arrival?.airport?.iata || "",
        gate:         f.departure?.gate || null,
        terminal:     f.departure?.terminal || null,
        airline:      f.airline?.name || "",
      },
    });
  } catch (err) {
    if (err.limitReached) return res.json({ ok: false, limitReached: true, error: "API rate limit reached" });
    return res.status(500).json({ ok: false, error: err.message });
  }
}
