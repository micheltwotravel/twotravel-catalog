export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { to, message, type } = req.body; // type: 'cobro' | 'reminder'
  if (!to || !message) return res.status(400).json({ ok: false, error: 'Missing to or message' });

  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = 'whatsapp:+14155238886'; // Twilio sandbox

  if (!sid || !token) return res.status(500).json({ ok: false, error: 'Twilio credentials not configured' });

  const phone = to.replace(/\D/g, '');
  const toWa  = `whatsapp:+${phone}`;

  const params = new URLSearchParams({ From: from, To: toWa, Body: message });

  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    }
  );

  const data = await twilioRes.json();
  if (data.sid) {
    return res.status(200).json({ ok: true, messageSid: data.sid });
  } else {
    return res.status(400).json({ ok: false, error: data.message || 'Twilio error' });
  }
}
