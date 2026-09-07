// Callback OAuth de Google Calendar
// Google redirige aquí con ?code=...&state=<concierge>
// Intercambia el code por tokens y guarda el refresh_token en GAS

const GAS_URL = "https://script.google.com/macros/s/AKfycbwVj2nl99gFJB0ZeFIm_WrS2TepT2mu3m-tAoEy0Wc5-oO9Rj33i16nAp0jFBqLSI665A/exec";

export default async function handler(req, res) {
  const { code, state: concierge, error } = req.query;

  if (error) {
    return res.status(400).send(`Google rechazó el acceso: ${error}`);
  }
  if (!code || !concierge) {
    return res.status(400).send("Falta code o state");
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri  = `${process.env.NEXT_PUBLIC_BASE_URL || "https://twotravelvip.com"}/api/calendar/callback`;

  if (!clientId || !clientSecret) {
    return res.status(500).send("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no configurados");
  }

  // 1. Intercambiar code → tokens
  let refreshToken;
  try {
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
    const tokenData = await tokenRes.json();
    refreshToken = tokenData.refresh_token;
    if (!refreshToken) {
      return res.status(400).send(
        `Google no devolvió refresh_token. Respuesta: ${JSON.stringify(tokenData)}`
      );
    }
  } catch (e) {
    return res.status(500).send(`Error al obtener tokens: ${e.message}`);
  }

  // 2. Guardar refresh_token en GAS
  try {
    await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action:  "saveCalendarToken",
        payload: { concierge, refreshToken },
      }),
    });
  } catch (e) {
    return res.status(500).send(`Token guardado en Google pero falló el guardado en GAS: ${e.message}`);
  }

  // 3. Página de éxito
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Calendario conectado</title>
      <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center;
               justify-content: center; min-height: 100vh; margin: 0; background: #f9f9f7; }
        .card { background: white; border-radius: 16px; padding: 48px 40px;
                text-align: center; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
        .icon { font-size: 48px; margin-bottom: 16px; }
        h1 { margin: 0 0 12px; font-size: 22px; color: #1a1a1a; }
        p  { margin: 0; color: #666; font-size: 15px; line-height: 1.5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">✅</div>
        <h1>Calendario conectado</h1>
        <p>Tu Google Calendar ya está vinculado. Desde ahora tus eventos bloquearán automáticamente las fechas en la página de booking.</p>
      </div>
    </body>
    </html>
  `);
}
