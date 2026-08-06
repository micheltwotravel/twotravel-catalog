export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { flight, date } = req.query;
  if (!flight) return res.status(400).json({ ok: false, error: "Missing flight" });

  const key = process.env.AVIATIONSTACK_KEY;
  if (!key) {
    return res.json({ ok: false, limitReached: true, error: "No API key configured — set AVIATIONSTACK_KEY env var" });
  }

  try {
    const params = new URLSearchParams({ access_key: key, flight_iata: flight.toUpperCase(), limit: "1" });
    const r = await fetch(`http://api.aviationstack.com/v1/flights?${params}`);
    const d = await r.json();

    // Detect quota / access errors
    if (d.error) {
      const code = d.error?.code || "";
      if (code === "usage_limit_reached" || code === "function_access_restricted") {
        return res.json({ ok: false, limitReached: true, error: d.error.message });
      }
      return res.json({ ok: false, error: d.error.message || "API error" });
    }

    if (!d.data || d.data.length === 0) return res.json({ ok: true, data: null });

    const f = d.data[0];
    return res.json({
      ok: true,
      data: {
        flightIata:   f.flight?.iata || flight,
        status:       f.flight_status,
        depScheduled: f.departure?.scheduled,
        depActual:    f.departure?.actual,
        depDelay:     f.departure?.delay,
        depAirport:   f.departure?.airport,
        depIata:      f.departure?.iata,
        arrScheduled: f.arrival?.scheduled,
        arrEstimated: f.arrival?.estimated,
        arrActual:    f.arrival?.actual,
        arrDelay:     f.arrival?.delay,
        arrAirport:   f.arrival?.airport,
        arrIata:      f.arrival?.iata,
        gate:         f.departure?.gate,
        terminal:     f.departure?.terminal,
        airline:      f.airline?.name,
      }
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
