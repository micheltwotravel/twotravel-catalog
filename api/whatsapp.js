export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { to, message, mediaUrl, facturaUrl } = req.body;
  if (!to || !message) return res.status(400).json({ ok: false, error: 'Missing to or message' });

  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  const authToken  = (process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromNumber = (process.env.TWILIO_WA_NUMBER || '').trim();

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ ok: false, error: 'Twilio credentials not configured' });
  }

  const phone = to.replace(/\D/g, '');
  const toWa   = `whatsapp:+${phone}`;
  const fromWa = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

  const attachUrl = facturaUrl || mediaUrl;

  const params = new URLSearchParams({
    From: fromWa,
    To:   toWa,
    Body: message,
  });
  if (attachUrl) params.append('MediaUrl', attachUrl);

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  const data = await twilioRes.json();

  if (data.sid) {
    return res.status(200).json({ ok: true, messageId: data.sid });
  } else {
    const errMsg = data.message || data.code || JSON.stringify(data);
    return res.status(400).json({ ok: false, error: errMsg });
  }
}
