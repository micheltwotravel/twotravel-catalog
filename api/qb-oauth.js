// QuickBooks OAuth — step 1: redirect user to Intuit authorization page
// Visit /api/qb-oauth to start the connection flow
export default function handler(req, res) {
  const clientId     = process.env.QB_CLIENT_ID;
  const redirectUri  = "https://www.twotravelvip.com/api/qb-callback";
  const scope        = "com.intuit.quickbooks.accounting";
  const state        = Math.random().toString(36).slice(2);

  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id",     clientId);
  url.searchParams.set("redirect_uri",  redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope",         scope);
  url.searchParams.set("state",         state);

  res.redirect(url.toString());
}
