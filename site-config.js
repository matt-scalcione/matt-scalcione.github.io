// Set your production API URL here after deployment.
// Example:
// window.PULSEBOARD_API_BASE = "https://your-api-host.example.com";
window.PULSEBOARD_API_BASE = window.PULSEBOARD_API_BASE || "https://api.pulseboard.mindpointdesign.opalstacked.com";
window.PULSEBOARD_SITE_ORIGIN = window.PULSEBOARD_SITE_ORIGIN || "https://matt-scalcione.github.io";

window.PULSEBOARD_CONFIG = {
  ...(window.PULSEBOARD_CONFIG || {}),
  apiBase: window.PULSEBOARD_API_BASE || "",
  siteOrigin: window.PULSEBOARD_SITE_ORIGIN || "",
  // Keep false on GitHub Pages for SEO safety; true requires server-side rewrites.
  usePrettyRoutes: false,
  // Keep false until detail pages are pre-rendered for crawler-safe indexing.
  indexDetailPages: false
};
