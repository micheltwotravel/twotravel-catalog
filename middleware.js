// Vercel Edge Middleware — intercepts social bot requests for itinerary pages
// and rewrites them to /api/og which returns proper OG meta tags.
// Regular users pass through to the SPA as normal.
export const config = {
  matcher: "/",
};

export default function middleware(request) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("mode");
  const kickoffId = searchParams.get("kickoffId");

  // Only intercept itinerary links for social media bots
  if (mode !== "itinerary" || !kickoffId) return;

  const ua = request.headers.get("user-agent") || "";
  const isBot = /WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|TelegramBot|Googlebot|bingbot/i.test(ua);
  if (!isBot) return;

  const lang = searchParams.get("lang") || "en";
  const dest = new URL(`/api/og?kickoffId=${encodeURIComponent(kickoffId)}&lang=${lang}`, request.url);
  return Response.redirect(dest.toString(), 302);
}
