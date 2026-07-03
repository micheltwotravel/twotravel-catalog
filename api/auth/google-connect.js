// Redirects concierge to Google OAuth consent screen
export default function handler(req, res) {
  const { concierge } = req.query;
  if (!concierge) return res.status(400).json({ error: "Missing concierge param" });

  const clientId    = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events",
    access_type:   "offline",
    prompt:        "consent",
    state:         concierge,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
