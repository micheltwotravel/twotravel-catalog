export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const URL =
    "https://docs.google.com/spreadsheets/d/1r_QvYqNLBybjL1iZYuW4mp3D3vde5rqSDBqTnEbDePk/export?format=csv&gid=1985577388";

  const r = await fetch(URL, { redirect: "follow" });
  if (!r.ok) return res.status(502).send("Error fetching itinerary sheet");
  const text = await r.text();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(text);
}
