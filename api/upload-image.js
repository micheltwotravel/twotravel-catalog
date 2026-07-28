import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);

  const contentType = req.headers['content-type'] || 'image/jpeg';
  const ext = contentType.split('/')[1]?.replace('jpeg','jpg') || 'jpg';
  const filename = `activity-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const blob = await put(filename, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  });

  res.json({ ok: true, url: blob.url });
}
