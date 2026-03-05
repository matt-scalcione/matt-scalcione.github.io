// Set your production API URL here after deployment.
// Example:
// window.PULSEBOARD_API_BASE = "https://your-api-name.onrender.com";
window.PULSEBOARD_API_BASE = window.PULSEBOARD_API_BASE || "https://pulseboard-api-drq0.onrender.com";

window.PULSEBOARD_CONFIG = {
  ...(window.PULSEBOARD_CONFIG || {}),
  apiBase: window.PULSEBOARD_API_BASE || ""
};
