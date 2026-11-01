// Runs before the page draws: the intro loader plays once per visit and never with reduced motion.
(function () {
  var d = document.documentElement;
  try {
    if (sessionStorage.getItem("pfm-intro") || matchMedia("(prefers-reduced-motion: reduce)").matches) d.classList.add("no-loader");
    else d.classList.add("is-loading");
  } catch (e) { d.classList.add("no-loader"); }
})();
