import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const slug = req.query.concierge;
  if (!slug) return res.status(400).json({ error: 'Missing concierge slug' });

  // Read raw body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || 'image/jpeg';

  const blob = await put(`concierge-photos/${slug}.jpg`, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });

  res.json({ ok: true, url: blob.url });
}
