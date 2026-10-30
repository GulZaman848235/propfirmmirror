// Prop Firm Mirror — motion layer.
// Scroll reveals, split-word headlines, scroll-scrubbed statements, counters, cursor light,
// card tilt and magnetic buttons. Everything is opt-in through data attributes and switches off for reduced motion.
(() => {
  "use strict";
  const RM = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FINE = window.matchMedia("(pointer: fine)");
  const reduced = () => RM.matches;

  /* ---------- scrolling stays native (the browser scrolls on its own thread, so it never waits for a busy frame);
     page changes land at the top instantly instead of gliding there ---------- */
  const jump = (y = 0) => { window.scrollTo({ top: y, left: 0, behavior: "instant" }); };

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

  /* ---------- split words ---------- */
  function split(el) {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = "1";
    let i = 0;
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement("span");
            s.className = "w"; s.style.setProperty("--i", i++);
            s.textContent = part; frag.appendChild(s);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
  }

  /* ---------- counters ---------- */
  function count(el) {
    const end = parseFloat(el.dataset.count), dur = 1600, t0 = performance.now(), dec = (el.dataset.count.split(".")[1] || "").length;
    if (reduced() || !isFinite(end)) { el.textContent = el.dataset.count; return; }
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = (end * e).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  const cio = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { count(en.target); cio.unobserve(en.target); } });
  }, { threshold: 0.4 });

  /* ---------- scroll-scrubbed statements: words light up as the block crosses the viewport ---------- */
  const scrubs = new Set();
  function scrubTick() {
    scrubs.forEach((el) => {
      if (!el.isConnected) { scrubs.delete(el); return; }
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
      const words = el.querySelectorAll(".w");
      const lit = Math.round(p * words.length * 1.15);
      words.forEach((w, i) => w.classList.toggle("lit", i < lit));
    });
  }
  let scrubQueued = false;
  window.addEventListener("scroll", () => { if (!scrubQueued) { scrubQueued = true; requestAnimationFrame(() => { scrubQueued = false; scrubTick(); }); } }, { passive: true });

  /* ---------- cursor light, tilt and magnetic pull ---------- */
  document.addEventListener("pointermove", (e) => {
    if (!FINE.matches) return;
    const spot = e.target.closest && e.target.closest(".spot");
    if (spot) {
      const r = spot.getBoundingClientRect();
      spot.style.setProperty("--mx", `${e.clientX - r.left}px`);
      spot.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    if (reduced()) return;
    const tilt = e.target.closest && e.target.closest("[data-tilt]");
    if (tilt) {
      const r = tilt.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      const k = parseFloat(tilt.dataset.tilt) || 6;
      tilt.style.transform = `perspective(900px) rotateX(${(-y * k).toFixed(2)}deg) rotateY(${(x * k).toFixed(2)}deg) translate3d(0, -4px, 0) scale(1.015)`;
      // inner layers slide against the tilt, so the card reads as stacked glass with depth
      tilt.style.setProperty("--tx", x.toFixed(3));
      tilt.style.setProperty("--ty", y.toFixed(3));
      tilt.classList.add("tilting");
    }
    const mag = e.target.closest && e.target.closest("[data-magnetic]");
    if (mag) {
      const r = mag.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
      mag.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px)`;
    }
  }, { passive: true });
  document.addEventListener("pointerout", (e) => {
    const t = e.target.closest && e.target.closest("[data-tilt], [data-magnetic]");
    if (t && !t.contains(e.relatedTarget)) { t.style.transform = ""; t.style.setProperty("--tx", 0); t.style.setProperty("--ty", 0); t.classList.remove("tilting"); }
  });

  /* ---------- 3D logo ring: tiles ride a tilted cylinder; scrolling spins it faster, hovering slows it ---------- */
  function ring3d(el) {
    el.dataset.ringOn = "1";
    const items = [...el.querySelectorAll(".r3-item")], n = items.length;
    if (!n) return;
    const step = (Math.PI * 2) / n;
    let R = 1000, theta = 0, vel = 0, lastY = window.scrollY, hover = false, visible = false, raf = 0;
    const size = () => { const pitch = parseFloat(getComputedStyle(el).getPropertyValue("--pitch")) || 92; R = (n * pitch) / (Math.PI * 2); };
    const place = () => {
      for (let i = 0; i < n; i++) {
        const a = theta + i * step, s = Math.sin(a), c = Math.cos(a), d = (c + 1) / 2;
        const it = items[i];
        // only transform and opacity change per frame, so the GPU moves the tiles without repainting them
        it.style.transform = `translate3d(${(s * R).toFixed(1)}px, 0, ${(c * R - R).toFixed(1)}px) rotateY(${(s * 38).toFixed(1)}deg)`;
        it.style.opacity = (0.16 + d * d * 0.84).toFixed(3);
      }
    };
    const tick = () => {
      raf = 0;
      if (!el.isConnected) return;
      const dy = window.scrollY - lastY; lastY = window.scrollY;
      vel = (vel + dy * 0.00006) * 0.93;
      theta -= (hover ? 0.0007 : 0.0024) + vel;
      place();
      if (visible && !reduced()) raf = requestAnimationFrame(tick);
    };
    size(); place();
    new ResizeObserver(() => { size(); place(); }).observe(el);
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }).observe(el);
    el.addEventListener("pointerenter", () => { hover = true; });
    el.addEventListener("pointerleave", () => { hover = false; });
  }

  /* ---------- wire up whatever the app just rendered ---------- */
  // the hero's own entrance waits for the intro loader to lift
  const held = (el) => document.documentElement.classList.contains("is-loading") && el.closest(".hero3d");
  function refresh(root = document) {
    root.querySelectorAll("[data-split]").forEach(split);
    root.querySelectorAll("[data-reveal]:not(.in), [data-split]:not(.in), [data-stagger]:not(.in)").forEach((el) => {
      if (reduced()) el.classList.add("in"); else if (!held(el)) io.observe(el);
    });
    root.querySelectorAll("[data-stagger]").forEach((wrap) => {
      [...wrap.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 14)));
    });
    root.querySelectorAll("[data-count]:not([data-counted])").forEach((el) => { el.dataset.counted = "1"; cio.observe(el); });
    root.querySelectorAll("[data-scrub]").forEach((el) => { split(el); scrubs.add(el); });
    root.querySelectorAll("[data-ring3d]:not([data-ring-on])").forEach(ring3d);
    scrubTick();
  }
  let pending = 0;
  const mo = new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; refresh(); }); });
  document.addEventListener("DOMContentLoaded", () => { refresh(); mo.observe(document.getElementById("app") || document.body, { childList: true, subtree: true }); intro(); ambience(); });
  window.addEventListener("pfm-loaded", () => refresh());

  /* ---------- intro: the mark turns in, a counter runs while fonts and the 3D scene load, then the curtain splits ---------- */
  function intro() {
    const root = document.documentElement, el = document.getElementById("loader");
    if (!el) return;
    if (!root.classList.contains("is-loading")) { el.remove(); return; }
    el.querySelector(".ld-mark").innerHTML = window.mark ? window.mark(60, 60, 96, "ldm") : "";
    const num = el.querySelector("#ldNum"), bar = el.querySelector(".ld-bar i");
    const t0 = performance.now(), MIN = 1500, MAX = 3500;
    let hero = !!window.PFMHero || !document.querySelector("#heroCanvas"), fonts = false, shown = 0, finished = false;
    window.addEventListener("pfm-hero-ready", () => { hero = true; }, { once: true });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fonts = true; });
    const done = () => {
      if (finished) return; finished = true;
      num.textContent = "100"; bar.style.transform = "scaleX(1)";
      el.classList.add("out");
      setTimeout(() => { root.classList.remove("is-loading"); window.dispatchEvent(new Event("pfm-loaded")); }, 420);
      setTimeout(() => el.remove(), 1600);
      try { sessionStorage.setItem("pfm-intro", "1"); } catch (e) { /* private mode */ }
    };
    const tick = (now) => {
      const t = now - t0, ready = hero && fonts;
      const goal = ready ? Math.min(1, t / MIN) : Math.min(0.88, (t / MIN) * 0.88);
      shown += (goal - shown) * 0.1;
      if (ready && t >= MIN && shown > 0.985) shown = 1;
      num.textContent = String(Math.round(shown * 100)).padStart(2, "0");
      bar.style.transform = `scaleX(${shown.toFixed(4)})`;
      if (shown >= 1 || t > MAX) { done(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- ambience: a soft light that trails the cursor across the page ---------- */
  function ambience() {
    if (!FINE.matches || reduced()) return;
    const light = document.createElement("div"); light.className = "cursor-light"; light.setAttribute("aria-hidden", "true");
    document.body.insertBefore(light, document.body.children[1] || null);
    let tx = innerWidth / 2, ty = innerHeight / 3, lx = tx, ly = ty, on = false;
    const loop = () => {
      lx += (tx - lx) * 0.08; ly += (ty - ly) * 0.08;
      light.style.transform = `translate3d(${(lx - 400).toFixed(1)}px, ${(ly - 400).toFixed(1)}px, 0)`;
      if (Math.abs(tx - lx) + Math.abs(ty - ly) > 0.5) requestAnimationFrame(loop); else on = false;
    };
    document.addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; light.classList.add("on"); if (!on) { on = true; requestAnimationFrame(loop); } }, { passive: true });
    document.addEventListener("pointerleave", () => light.classList.remove("on"));
  }

  /* ---------- page transitions ---------- */
  function transition(fn, opts = {}) {
    if (reduced() || !document.startViewTransition) { fn(); return; }
    const root = document.documentElement;
    if (opts.reveal) {
      // a section switch: the new colour world grows as a circle from the click point
      const { x, y } = opts.reveal;
      root.style.setProperty("--vx", x + "px"); root.style.setProperty("--vy", y + "px");
      root.style.setProperty("--vr", Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + "px");
      root.classList.add("vt-reveal");
    }
    const vt = document.startViewTransition(fn);
    const done = () => root.classList.remove("vt-reveal"); vt.finished.then(done, done);
    // a second click mid-transition aborts the first one; that is expected, not an error
    vt.ready.catch(() => {}); vt.finished.catch(() => {});
  }

  window.PFMMotion = { refresh, transition, jump, reduced };
})();
