// Redirects plain HTTP to HTTPS at the edge, then hands everything else to static assets.
// Uses the cf-visitor header so `wrangler dev` (which rewrites URLs) is left alone.
export default {
  async fetch(request, env) {
    const visitor = request.headers.get("cf-visitor");
    if (visitor && visitor.includes('"http"')) {
      const url = new URL(request.url);
      return Response.redirect(`https://${url.host}${url.pathname}${url.search}`, 301);
    }
    return env.ASSETS.fetch(request);
  },
};
