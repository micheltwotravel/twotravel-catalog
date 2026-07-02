export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { to, message, mediaUrl, facturaUrl } = req.body;
  if (!to || !message) return res.status(400).json({ ok: false, error: 'Missing to or message' });

  const token   = process.env.META_WA_TOKEN;
  const phoneId = process.env.META_WA_PHONE_ID || '828425163689171';

  if (!token) return res.status(500).json({ ok: false, error: 'META_WA_TOKEN not configured' });

  const phone = to.replace(/\D/g, '');

  const attachUrl = facturaUrl || mediaUrl;

  let body;
  if (attachUrl) {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'document',
      document: {
        link: attachUrl,
        caption: message,
        filename: 'factura.pdf',
      },
    };
  } else {
    body = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'text',
      text: { body: message, preview_url: false },
    };
  }

  const metaRes = await fetch(
    `https://graph.facebook.com/v25.0/${phoneId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  const data = await metaRes.json();

  if (data.messages?.[0]?.id) {
    return res.status(200).json({ ok: true, messageId: data.messages[0].id });
  } else {
    const errMsg = data.error?.message || JSON.stringify(data);
    return res.status(400).json({ ok: false, error: errMsg });
  }
}
