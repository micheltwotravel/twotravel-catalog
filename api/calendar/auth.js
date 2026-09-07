// Inicia el flujo OAuth de Google Calendar para una concierge
// GET /api/calendar/auth?concierge=alia
//
// Redirige a Google para que la concierge autorice acceso a su calendario.
// Después de autorizar, Google redirige a /api/calendar/callback

export default function handler(req, res) {
  const { concierge } = req.query;
  if (!concierge) return res.status(400).send("Falta ?concierge=...");

  const clientId    = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || "https://twotravelvip.com"}/api/calendar/callback`;

  if (!clientId) return res.status(500).send("GOOGLE_CLIENT_ID no configurado");

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar.readonly",
    access_type:   "offline",
    prompt:        "consent",
    state:         concierge,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
