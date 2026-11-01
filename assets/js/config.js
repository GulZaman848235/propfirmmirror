// Public settings for the live site. The repository is public, so ONLY public values ever go here — never a secret key.
window.PFM_CONFIG = {
  // Umami Cloud: cookie-free visitor counts for the admin. Paste the Website ID from Umami (Settings → Websites) and
  // the script address from its tracking code. Empty = off. Adding it also needs its host in index.html's
  // Content-Security-Policy (script-src and connect-src) and the analytics paragraph on the privacy page turns on.
  umami: { websiteId: "", src: "https://cloud.umami.is/script.js", domains: "propfirmmirror.com" },
  // Google Analytics 4 measurement ID (public). Loaded by assets/js/analytics.js; empty = off.
  ga4: "G-MFZN2JRLT0",
};
