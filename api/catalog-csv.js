export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRNGpwNTGIWfyOOxSIFZgTdstPVL53Qhu_jUA1THG3J69YRdWI8SUsj4wHQsVOer2ykFzLMk2SozHuQ/pub?gid=190949837&single=true&output=csv";

  const r = await fetch(URL, { redirect: "follow" });
  if (!r.ok) return res.status(502).send("Error fetching sheet");
  const text = await r.text();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(text);
}
