// QuickBooks OAuth — step 2: exchange authorization code for tokens
// QB redirects here after user authorizes. Saves refresh_token + realm_id to Supabase.
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  const { code, realmId, error } = req.query;

  if (error) {
    return res.status(400).send(`QB OAuth error: ${error}`);
  }
  if (!code || !realmId) {
    return res.status(400).send("Missing code or realmId");
  }

  const clientId     = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const redirectUri  = "https://www.twotravelvip.com/api/qb-callback";

  // Exchange code for tokens
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basic}`,
      "Content-Type":  "application/x-www-form-urlencoded",
      "Accept":        "application/json",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokenRes.ok) {
    return res.status(500).send(`Token exchange failed: ${JSON.stringify(tokens)}`);
  }

  const { access_token, refresh_token, expires_in } = tokens;

  // Store tokens in Supabase under a known kickoff ID
  const sb = createClient(SB_URL, SB_KEY);
  await sb.from("kickoffs").upsert({
    id: "qb_tokens_v1",
    data: {
      realm_id:      realmId,
      refresh_token,
      access_token,
      expires_at:    Date.now() + expires_in * 1000,
      connected_at:  new Date().toISOString(),
    },
  });

  res.send(`
    <html><body style="font-family:sans-serif;padding:40px;text-align:center">
      <h2 style="color:#1a7f3c">✓ QuickBooks conectado</h2>
      <p>La app ya puede crear estimados en QB Online.</p>
      <p style="color:#666;font-size:13px">Realm ID: <code>${realmId}</code></p>
      <p><a href="https://www.twotravelvip.com/?mode=concierge">← Volver a Compass</a></p>
    </body></html>
  `);
}
