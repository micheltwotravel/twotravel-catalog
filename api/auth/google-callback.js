// Handles Google OAuth callback — exchanges code for tokens and saves refresh token to GAS
export default async function handler(req, res) {
  try {
    const { code, state: concierge, error } = req.query;

    if (error) return res.redirect(`/book-admin.html?error=${encodeURIComponent(error)}`);
    if (!code || !concierge) return res.status(400).send("Missing code or concierge");

    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri  = process.env.GOOGLE_REDIRECT_URI;
    const GAS          = process.env.VITE_TASK_API_URL || process.env.GAS_URL;

    if (!clientId || !clientSecret || !redirectUri) {
      return res.status(500).send("Missing Google OAuth env vars (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)");
    }

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
    if (tokens.error) {
      return res.status(400).send(`Google token error: ${tokens.error} — ${tokens.error_description}`);
    }
    if (!tokens.refresh_token) {
      return res.status(500).send("No refresh token received. Make sure prompt=consent was set.");
    }

    // Save refresh token to GAS (stored in Properties sheet keyed by concierge slug)
    const gasRes = await fetch(GAS, {
      method: "POST",
      body: JSON.stringify({
        action: "saveCalendarToken",
        payload: { concierge, refreshToken: tokens.refresh_token },
      }),
    });
    const gasData = await gasRes.json().catch(() => ({}));
    if (gasData.error) {
      return res.status(500).send(`GAS error: ${gasData.error}`);
    }

    res.redirect(`/book-admin.html?connected=${concierge}`);
  } catch (err) {
    res.status(500).send(`Callback error: ${err.message}`);
  }
}
