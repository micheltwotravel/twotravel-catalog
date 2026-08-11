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

    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${flightNum}/${dateParam}`;
    const r = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": key,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      },
    });

    if (r.status === 404) return res.json({ ok: true, data: null });
    if (r.status === 429) return res.json({ ok: false, limitReached: true, error: "API rate limit reached" });
    if (!r.ok) {
      const txt = await r.text();
      return res.json({ ok: false, error: `Aerodatabox ${r.status}: ${txt.slice(0, 200)}` });
    }

    const d = await r.json();
    if (!d || (Array.isArray(d) && !d.length)) return res.json({ ok: true, data: null });

    const f = Array.isArray(d) ? d[0] : d;

    // Convert "YYYY-MM-DD HH:mm" → ISO string
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
    return res.status(500).json({ ok: false, error: err.message });
  }
}
