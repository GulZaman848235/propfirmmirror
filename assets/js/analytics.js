// Google Analytics 4 for propfirmmirror.com (the measurement ID in config.js is public, not a secret).
// Visitors in the EEA, UK and Switzerland start with analytics storage off (Google applies this by region) and, if their
// time zone is in Europe, see a small consent bar. Everywhere else it is on; anyone can switch it off on the privacy page.
(function () {
  var ID = (window.PFM_CONFIG || {}).ga4;
  if (!ID || !/(^|\.)propfirmmirror\.com$/.test(location.hostname)) return;
  var KEY = "pfm-consent";
  var EEA = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IT", "LV", "LI", "LT",
    "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB", "CH"];
  var get = function () { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  var put = function (v) { try { localStorage.setItem(KEY, v); } catch (e) {} };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  var ads = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  gtag("consent", "default", Object.assign({ analytics_storage: "granted" }, ads));
  gtag("consent", "default", Object.assign({ analytics_storage: "denied", region: EEA, wait_for_update: 500 }, ads));
  var choice = get();
  if (choice) gtag("consent", "update", { analytics_storage: choice === "yes" ? "granted" : "denied" });
  gtag("js", new Date());
  gtag("config", ID, { send_page_view: false });
  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  document.head.appendChild(s);

  // The comparison app routes with #hashes, so each view is reported as its own page path (#/firm/ftmo -> /firm/ftmo).
  var last = "";
  function pageView() {
    var h = location.hash.replace(/^#\/?/, "").split("?")[0];
    var path = h ? location.pathname.replace(/\/$/, "") + "/" + h : location.pathname;
    if (path === last) return;
    last = path;
    gtag("event", "page_view", { page_location: location.href, page_path: path, page_title: document.title });
  }
  window.addEventListener("hashchange", function () { setTimeout(pageView, 80); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(pageView, 80); });
  else setTimeout(pageView, 80);

  // Promo-code copies; visits to a firm's own site are counted by GA's enhanced measurement (outbound clicks).
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : null;
    if (!t) return;
    var b = t.closest("[data-copy]");
    if (b) gtag("event", "copy_promo_code", { code: b.getAttribute("data-copy"), label: (b.getAttribute("aria-label") || "").slice(0, 100) });
    var c = t.closest("[data-consent]");
    if (c) setChoice(c.getAttribute("data-consent"));
  }, true);

  function setChoice(v) {
    put(v);
    gtag("consent", "update", { analytics_storage: v === "yes" ? "granted" : "denied" });
    var bar = document.getElementById("pfmConsent");
    if (bar) bar.remove();
    document.querySelectorAll("[data-consent-state]").forEach(function (el) { el.textContent = v === "yes" ? "Analytics is on." : "Analytics is off."; });
  }
  window.PFMConsent = { set: setChoice, get: get };

  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  if (choice || !/^Europe\//.test(tz)) return;
  function bar() {
    var st = document.createElement("style");
    st.textContent = "#pfmConsent{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:14px 16px;border-radius:14px;background:rgba(10,14,12,.94);border:1px solid rgba(238,242,240,.14);box-shadow:0 18px 50px rgba(0,0,0,.45);color:#EEF2F0;font:13px/1.45 'Mona Sans',system-ui,sans-serif;backdrop-filter:blur(10px)}#pfmConsent p{flex:1 1 260px;margin:0;color:rgba(238,242,240,.82)}#pfmConsent a{color:#3DDC97}#pfmConsent button{font:600 13px/1 'Mona Sans',system-ui,sans-serif;padding:10px 14px;border-radius:999px;cursor:pointer;border:1px solid rgba(238,242,240,.22);background:transparent;color:#EEF2F0}#pfmConsent button[data-consent=yes]{background:#3DDC97;border-color:#3DDC97;color:#0A0E0C}";
    document.head.appendChild(st);
    var d = document.createElement("div");
    d.id = "pfmConsent";
    d.setAttribute("role", "region");
    d.setAttribute("aria-label", "Analytics choice");
    d.innerHTML = '<p>We count visits with Google Analytics to see which pages help traders. No ads, no selling of data. <a href="/#/legal">Details</a></p>' +
      '<button type="button" data-consent="no">Decline</button><button type="button" data-consent="yes">Accept</button>';
    document.body.appendChild(d);
  }
  if (document.body) bar(); else document.addEventListener("DOMContentLoaded", bar);
})();
