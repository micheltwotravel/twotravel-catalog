// Handles Google OAuth callback — exchanges code for tokens and saves refresh token to GAS
export default async function handler(req, res) {
  const { code, state: concierge, error } = req.query;

  if (error) return res.redirect(`/book-admin?error=${error}`);
  if (!code || !concierge) return res.status(400).send("Missing code or concierge");

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = process.env.GOOGLE_REDIRECT_URI;
  const GAS          = process.env.VITE_TASK_API_URL || process.env.GAS_URL;

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     clientId,
      client_secret: clientSecret,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    return res.status(500).send("No refresh token received. Make sure prompt=consent was set.");
  }

  // Save refresh token to GAS (stored in Properties sheet keyed by concierge slug)
  await fetch(GAS, {
    method: "POST",
    body: JSON.stringify({
      action: "saveCalendarToken",
      payload: { concierge, refreshToken: tokens.refresh_token },
    }),
  });

  res.redirect(`/book-admin?connected=${concierge}`);
}
