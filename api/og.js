// Serverless function — renders OG meta tags for itinerary links.
// Called by Edge Middleware when a social bot requests an itinerary URL.
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const { kickoffId, lang = "en" } = req.query;
  if (!kickoffId) return res.status(400).send("Missing kickoffId");

  let title = "Two Travel — Your Itinerary";
  let description = "View your personalized travel itinerary from Two Travel.";

  try {
    const { data } = await supabase
      .from("kickoffs")
      .select("data")
      .eq("id", kickoffId)
      .single();

    if (data?.data) {
      const k = data.data;
      const guestFirst = (k.guestName || k.tripName || "").split(" ")[0];
      const city = (k.city || "").split(",")[0].trim();
      const isEs = (k.lang || lang) === "es";

      if (isEs) {
        title = guestFirst
          ? `${guestFirst} — Tu Itinerario Two Travel${city ? " en " + city : ""}`
          : `Tu Itinerario Two Travel${city ? " en " + city : ""}`;
        description = "Mira tu itinerario personalizado de Two Travel.";
      } else {
        title = guestFirst
          ? `${guestFirst}'s Two Travel Itinerary${city ? " in " + city : ""}`
          : `Two Travel Itinerary${city ? " in " + city : ""}`;
        description = "View your personalized Two Travel itinerary.";
      }
    }
  } catch {}

  const spaUrl = `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""}/?mode=itinerary&kickoffId=${encodeURIComponent(kickoffId)}&lang=${lang}`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
  res.status(200).send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}"/>
  <meta property="og:description" content="${escapeHtml(description)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:image" content="https://two.travel/og-itinerary.jpg"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(title)}"/>
  <meta name="twitter:description" content="${escapeHtml(description)}"/>
  <meta http-equiv="refresh" content="0;url=${escapeHtml(spaUrl)}"/>
</head>
<body>
  <script>window.location.replace(${JSON.stringify(spaUrl)});</script>
  <a href="${escapeHtml(spaUrl)}">View itinerary</a>
</body>
</html>`);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
