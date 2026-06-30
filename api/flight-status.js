export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { flight, date } = req.query;
  if (!flight) return res.status(400).json({ ok: false, error: "Missing flight" });

  const key = process.env.AVIATIONSTACK_KEY || "be3dea887f48438d6a3b0f75fc0c942c";

  try {
    const params = new URLSearchParams({ access_key: key, flight_iata: flight.toUpperCase() });
    if (date) params.set("flight_date", date); // YYYY-MM-DD
    const r = await fetch(`http://api.aviationstack.com/v1/flights?${params}`);
    const d = await r.json();

    if (!d.data || d.data.length === 0) return res.json({ ok: true, data: null });

    const f = d.data[0];
    return res.json({
      ok: true,
      data: {
        flightIata:   f.flight?.iata || flight,
        status:       f.flight_status,          // "scheduled" | "active" | "landed" | "cancelled" | "diverted" | "unknown"
        depScheduled: f.departure?.scheduled,
        depActual:    f.departure?.actual,
        depDelay:     f.departure?.delay,        // minutes
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
