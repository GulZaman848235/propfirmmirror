/* Prop Firm Mirror — comparison app.
   Plain JS, no build step. Data comes from data/bundle.js (generated from data/firms/*.json by tools/build-data.mjs).
   The site has four market sections, each with its own colour and only its own firms: Forex & CFD (the root),
   #/futures, #/crypto and #/perps. Inside a section: #/<section>/firm/<id> · /compare · /changes.
   #/method and #/legal are shared. */
(() => {
  "use strict";

  const DATA = window.PFM_DATA || { firms: [], generated: null };
  const C = window.Countries;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("pfm." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("pfm." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  /* ------------------------------------------------------------------ vocab */
  const MARKET_LABEL = { cfd: "CFD", futures: "Futures", crypto: "Crypto", stocks: "Stocks", options: "Options", prediction: "Prediction" };
  const MODEL_LABEL = { "1-step": "1-Step", "2-step": "2-Step", "3-step": "3-Step", instant: "Instant", other: "Other" };
  const DD_LABEL = { static: "Static", trailing: "Trailing (intraday)", "eod-trailing": "EOD trailing", "trailing-lock": "Trailing, then locks" };
  // The four sections. A program belongs to exactly one; stocks, options and prediction markets sit inside Forex & CFD.
  const SECTIONS = [
    { id: "cfd", path: "", label: "Forex & CFD", short: "Forex", noun: "forex & CFD", hint: "Forex · Gold · Indices · Stocks", test: (p) => !p.perps && ["cfd", "stocks", "options", "prediction"].includes(p.market) },
    { id: "futures", path: "futures", label: "Futures", short: "Futures", noun: "futures", hint: "CME · CBOT · NYMEX", test: (p) => !p.perps && p.market === "futures" },
    { id: "crypto", path: "crypto", label: "Crypto", short: "Crypto", noun: "crypto", hint: "Crypto exchange accounts", test: (p) => !p.perps && p.market === "crypto" },
    { id: "perps", path: "perps", label: "Perps", short: "Perps", noun: "perps", hint: "Crypto perpetual futures", test: (p) => !!p.perps },
  ];
  const SEC_ICON = {
    cfd: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M5 3.5v13M10 2.5v15M15 4.5v11"/><rect x="3.4" y="6.5" width="3.2" height="6" rx="1" fill="currentColor" stroke="none"/><rect x="8.4" y="5" width="3.2" height="7.5" rx="1"/><rect x="13.4" y="8" width="3.2" height="5" rx="1" fill="currentColor" stroke="none"/></svg>`,
    futures: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 15.5l4.2-5 3.1 2.8L16.5 6"/><path d="M12.8 6h3.7v3.7"/><path d="M3 18h14" opacity=".45"/></svg>`,
    crypto: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.2l6.6 3.8v7.8L10 17.8l-6.6-3.9V6z"/><path d="M10 6.4l3.2 1.9v3.6L10 13.7l-3.2-1.8V8.3z" fill="currentColor" fill-opacity=".35"/></svg>`,
    perps: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6.3 13.3C4.4 13.3 3 11.8 3 10s1.4-3.3 3.3-3.3c3.6 0 3.8 6.6 7.4 6.6 1.9 0 3.3-1.5 3.3-3.3s-1.4-3.3-3.3-3.3c-3.6 0-3.8 6.6-7.4 6.6z"/></svg>`,
  };
  const MARKET_SECTION = { cfd: "cfd", stocks: "cfd", options: "cfd", prediction: "cfd", futures: "futures", crypto: "crypto" };
  // sub-tabs inside a section (only the ones its firms actually sell are shown)
  const TABS = [
    { id: "all", label: "All firms", test: () => true },
    { id: "1-step", label: "1-Step", test: (p) => p.model === "1-step" },
    { id: "2-step", label: "2-Step", test: (p) => p.model === "2-step" },
    { id: "3-step", label: "3-Step", test: (p) => p.model === "3-step" },
    { id: "instant", label: "Instant funding", hint: "No evaluation", test: (p) => p.model === "instant" },
    { id: "stocks", label: "Stocks", hint: "Equities", test: (p) => p.market === "stocks" },
    { id: "options", label: "Options", test: (p) => p.market === "options", isNew: true },
    { id: "prediction", label: "Prediction markets", test: (p) => p.market === "prediction", isNew: true },
  ];
  const SORTS = [
    ["score", "Top rated", "Top rated"],
    ["name", "Name A–Z", "A–Z"],
    ["price", "Lowest price", "Price"],
    ["split", "Highest profit split", "Split"],
    ["changes", "Latest rule change", "Changed"],
    ["verified", "Recently verified", "Verified"],
  ];
  // in the Challenges view the Sort menu drives the table's own sort; options with no table equivalent are disabled there
  const TSORT = { price: { key: "price", dir: 1 }, split: { key: "split", dir: -1 }, name: { key: "firm", dir: 1 } };
  const CUR = { USD: "$", USDT: "$", USDC: "$", EUR: "€", GBP: "£", AUD: "A$", CAD: "C$", JPY: "¥", CHF: "CHF " };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  /* ------------------------------------------------------------------ format helpers */
  const fmtDate = (d) => {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(d || "");
    if (!m) return d ? esc(d) : "—";
    return m[3] ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : `${MONTHS[+m[2] - 1]} ${m[1]}`;
  };
  const money = (n, cur = "USD") => {
    if (n == null || n === "" || isNaN(+n)) return null;
    n = +n;
    const s = n % 1 ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toLocaleString("en-US");
    const sym = CUR[cur];
    return sym != null ? sym + s : `${s} ${esc(cur)}`;
  };
  const sizeLabel = (n, cur = "USD") => {
    if (n == null) return "—";
    const k = n >= 1e6 ? +(n / 1e6).toFixed(2) + "M" : n >= 1000 ? +(n / 1000).toFixed(1) + "K" : String(n);
    const sym = CUR[cur];
    return (sym != null ? sym : "") + k;
  };
  // Account sizes are quoted in dollars even when a firm charges its fee in EUR or GBP; a program can override with sizeCurrency.
  const acctCur = (p) => p.sizeCurrency || "USD";
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
  const pathOf = (u) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, "") + x.pathname).replace(/\/$/, ""); } catch (e) { return u; } };
  const pct = (s) => { const m = /(-?\d+(?:\.\d+)?)\s*%/.exec(String(s ?? "")); return m ? +m[1] : null; };
  const isNone = (s) => /^\s*(none|no\b|no daily|not applicable|n\/a)/i.test(String(s ?? ""));
  const NP = `<span class="np-chip">Not published</span>`;
  const npText = `<span class="np">Not published</span>`;

  // Rule text → allowed / with conditions / not allowed / unknown. Used for the dots and the rule filters.
  function cls(v) {
    if (v == null || String(v).trim() === "") return "unknown";
    const s = String(v).toLowerCase().trim();
    if (/^(not published|unverified|unknown)/.test(s)) return "unknown";
    if (/^no restriction|^unrestricted|^no limit/.test(s)) return "yes";
    const cond = /(except|but |window|restrict|only|cap|limit|must|unless|cannot|can't|outside|before|after|within|subject|approval|depends|not allowed on|prohibited on|minute|add-on|addon|up to|max)/;
    if (/^(allowed|yes|permitted|fully allowed)/.test(s)) return cond.test(s.slice(7)) ? "partial" : "yes";
    if (/^(no\b|not allowed|not permitted|prohibited|forbidden|none\b|disallowed)/.test(s)) return /\ballowed\b/.test(s.replace(/not allowed/g, "")) ? "partial" : "no";
    if (/(not allowed|prohibited|forbidden|not permitted)/.test(s) && !/\ballowed\b/.test(s.replace(/not allowed/g, ""))) return "no";
    return "partial";
  }
  const clsLabel = { yes: "Allowed", partial: "With conditions", no: "Not allowed", unknown: "Not published" };
  const consistencyNone = (v) => v != null && /^\s*(none|no\b|no consistency|not applicable)/i.test(String(v));

  /* ------------------------------------------------------------------ data prep */
  const initialsOf = (name) => {
    const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || "?").slice(0, 2)).toUpperCase();
  };
  const ALL = DATA.firms.map((f) => {
    const programs = (f.programs || []).map((p, i) => ({ ...p, _i: i, _f: f.id, sizes: (p.sizes || []).filter((s) => s && s.size != null) }));
    const changes = (f.changes || []).filter((c) => c && c.date).sort((a, b) => (a.date < b.date ? 1 : -1));
    const splitMax = Math.max(...programs.map((p) => +p.splitMax || 0), 0) || null;
    const initials = initialsOf(f.name);
    const restricted = f.restricted || { status: "not_published", countries: [] };
    const clean = (list) => [...new Set((list || []).map((c) => String(c).toUpperCase()).filter(C.valid))];
    restricted.countries = clean(restricted.countries);
    for (const m of Object.values(restricted.byMarket || {})) m.countries = clean(m.countries);
    return { ...f, programs, changes, splitMax, initials, restricted, hq: f.hq || {}, status: f.status || "active", platforms: f.platforms || [] };
  });
  const ALL_BY_ID = Object.fromEntries(ALL.map((f) => [f.id, f]));

  // The current section's view of the data: only its programs, its rule changes, its restricted list, and the brand
  // (name, site, logo) the firm itself uses for that market, e.g. "Tradeify FX" in Forex & CFD, "Tradeify" in Futures.
  let SEC = SECTIONS[0], firms = [], byId = {}, allChanges = [], allPrograms = [], lastVerified = null;
  const sectionOfChange = (f, c) => {
    const s = MARKET_SECTION[c.market];
    if (s === "crypto" && f.programs.some((p) => p.perps) && !f.programs.some((p) => p.market === "crypto" && !p.perps)) return "perps";
    return s || null;
  };
  // deal lookups per firm, section and market; cleared whenever a section's data is rebuilt
  const dealCache = new Map();
  function buildSection(sec) {
    SEC = sec;
    firms = ALL.map((f) => {
      const programs = f.programs.filter(sec.test);
      const listed = programs.length || (!f.programs.length && (f.markets || []).some((m) => MARKET_SECTION[m] === sec.id));
      if (!listed) return null;
      const b = (f.brands || {})[sec.id] || {};
      const ownBrand = b.domain && b.domain !== f.domain;
      const name = b.name || f.name;
      const changes = f.changes.filter((c) => { const s = sectionOfChange(f, c); return s ? s === sec.id : true; });
      // a market with its own published list (e.g. a futures brand) uses that list here
      const mk = [...new Set(programs.map((p) => p.market))];
      const own = mk.length === 1 && (f.restricted.byMarket || {})[mk[0]];
      const restricted = own ? { status: "published", countries: own.countries, note: own.label || null, source: own.source, checked: own.checked } : f.restricted;
      const platforms = [...new Set(programs.flatMap((p) => p.platforms || []))];
      return { ...f, name, initials: initialsOf(name), parentName: name.startsWith(f.name) ? null : f.name,
        domain: b.domain || f.domain, website: b.website || f.website,
        logo: b.logo || (ownBrand ? null : f.logo), logoFit: b.logo ? b.logoFit || null : ownBrand ? null : f.logoFit,
        programs, changes, restricted, platforms: platforms.length ? platforms : f.platforms, markets: mk.length ? mk : f.markets,
        ...trackersFor(f, sec),
        offers: (f.offers || []).filter((o) => {
          if (o.markets && o.markets.length) return o.markets.some((m) => sec.test(m === "perps" ? { market: "crypto", perps: true } : { market: m }));
          const named = [...Object.keys(o.sizes || {}), ...(o.fixedPrices || []).map((x) => x.program)];
          return !named.length || programs.some((p) => named.includes(p.name));
        }),
        splitMax: Math.max(...programs.map((p) => +p.splitMax || 0), 0) || null };
    }).filter(Boolean);
    byId = Object.fromEntries(firms.map((f) => [f.id, f]));
    dealCache.clear();
    allChanges = firms.flatMap((f) => f.changes.map((c) => ({ ...c, firm: f }))).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.firm.name.localeCompare(b.firm.name)));
    allPrograms = firms.flatMap((f) => f.programs);
    lastVerified = firms.map((f) => f.lastVerified).filter(Boolean).sort().pop();
    document.documentElement.dataset.sec = sec.id;
    // the browser chrome on phones takes the section's wall colour too
    const tc = document.querySelector('meta[name="theme-color"]'), wl = getComputedStyle(document.documentElement).getPropertyValue("--wall").trim();
    if (tc && wl) tc.setAttribute("content", `rgb(${wl})`);
  }
  // the section's on-chain payout records: Payout Junction leads (counts and amounts), ThePropFirmGuide fills in
  // where it has a count, FundedTrading adds how regularly the firm pays
  function trackersFor(f, sec) {
    const list = (f.payoutTrackers || []).filter((t) => (t.sections || []).includes(sec.id));
    const counted = list.find((t) => t.source === "Payout Junction") || list.find((t) => t.last30 && t.last30.count);
    return { trackers: list, tracker: counted || null, cadence: list.find((t) => t.source === "FundedTrading") || null };
  }
  // links inside the current section
  const href = (p = "") => "#/" + [SEC.path, p].filter(Boolean).join("/");
  const secHref = (sec) => "#/" + sec.path;
  // a firm's page in the first section it sells in (used where the whole dataset is listed)
  const homeHref = (f) => { const x = SECTIONS.find((y) => f.programs.some(y.test)) || SECTIONS[0]; return "#/" + [x.path, "firm", f.id].filter(Boolean).join("/"); };
  buildSection(SECTIONS[0]);

  /* ------------------------------------------------------------------ visitor counts (Umami, off until configured) */
  const UMAMI = (() => { const u = (window.PFM_CONFIG || {}).umami || {}; return u.websiteId && location.hostname.endsWith(u.domains || "propfirmmirror.com") ? u : null; })();
  if (UMAMI) {
    const sc = document.createElement("script");
    sc.defer = true; sc.src = UMAMI.src; sc.dataset.websiteId = UMAMI.websiteId; sc.dataset.autoTrack = "false"; sc.dataset.domains = UMAMI.domains;
    sc.onload = () => countView();
    document.head.appendChild(sc);
  }
  // one view per route; hash routes are sent as paths ("#/futures/firm/x" → "/futures/firm/x")
  const countView = () => { if (UMAMI && window.umami) window.umami.track((p) => ({ ...p, url: "/" + location.hash.replace(/^#\/?/, "").split("?")[0] })); };

  /* ------------------------------------------------------------------ state */
  const S = {
    tab: store.get("tab", "all"),
    q: "",
    size: store.get("size", null),
    sort: store.get("sort2", "score"),
    view: store.get("view", "firms"),
    models: new Set(), dd: new Set(), platforms: new Set(),
    news: false, eas: false, weekend: false, noConsistency: false, noDaily: false, showClosed: false,
    country: store.get("country", undefined),
    avail: store.get("avail", "all"), // all | hide | confirmed
    compare: store.get("compare.cfd", store.get("compare", [])).filter((id) => byId[id]).slice(0, 4),
    cmpProg: {},
    cmpSize: null,
    cmpDiff: false,
    tsort: { key: "price", dir: 1 },
    page: 1,
  };
  if (S.country === undefined) S.country = C.guess();
  if (!TABS.some((t) => t.id === S.tab)) S.tab = "all";
  const save = () => { store.set("tab", S.tab); store.set("size", S.size); store.set("sort2", S.sort); store.set("view", S.view); store.set("country", S.country); store.set("avail", S.avail); store.set("compare." + SEC.id, S.compare); };

  /* ------------------------------------------------------------------ logic */
  const tabDef = (id) => TABS.find((t) => t.id === id) || TABS[0];
  const priceAt = (p, size) => { const s = p.sizes.find((x) => x.size === size); return s && s.price != null ? +s.price : null; };
  const progPlatforms = (p) => (p.platforms && p.platforms.length ? p.platforms : byId[p._f].platforms);

  // Some firms publish a separate list for one market (e.g. a futures brand). That list wins for programs in that market.
  const marketList = (f, market) => (f.restricted.byMarket || {})[market] || null;
  function mainAvail(f, cc) {
    const r = f.restricted;
    const listed = r.countries.includes(cc);
    if (r.status === "published") return listed ? { k: "restricted" } : { k: "ok" };
    if (r.status === "unverified") return listed ? { k: "restricted", unv: true } : { k: "unknown", unv: true };
    return { k: "unknown" };
  }
  function progAvail(f, p, cc = S.country) {
    const m = marketList(f, p.market);
    if (m) return m.countries.includes(cc) ? { k: "restricted" } : { k: "ok" };
    return mainAvail(f, cc);
  }
  // Firm-level answer for a set of programs: restricted for all, for some markets only ("partial"), or for none.
  function availability(f, cc = S.country, progs = null) {
    if (!cc) return { k: "none" };
    const ps = progs && progs.length ? progs : f.programs;
    if (!f.restricted.byMarket || !ps.length) return mainAvail(f, cc);
    const res = ps.map((p) => progAvail(f, p, cc));
    const hit = ps.filter((p, i) => res[i].k === "restricted");
    if (hit.length === ps.length) return { k: "restricted", unv: res.some((r) => r.unv) };
    if (hit.length) return { k: "partial", markets: [...new Set(hit.map((p) => MARKET_LABEL[p.market] || p.market))], free: [...new Set(ps.filter((p) => !hit.includes(p)).map((p) => MARKET_LABEL[p.market] || p.market))] };
    return res.every((r) => r.k === "ok") ? { k: "ok" } : { k: "unknown", unv: res.some((r) => r.unv) };
  }
  function availBadge(f, cc = S.country, long = false, progs = null) {
    if (!cc) return "";
    const a = availability(f, cc, progs);
    const nm = C.name(cc);
    if (a.k === "partial") return `<span class="avail partial" title="${esc(f.name)} restricts ${esc(nm)} for ${esc(a.markets.join(", "))} but not for ${esc(a.free.join(", "))}">${C.flag(cc)} ${esc(a.markets.join(" & "))} restricted${long ? " in " + esc(nm) : ""}</span>`;
    if (a.k === "ok") return `<span class="avail ok" title="${esc(nm)} is not on ${esc(f.name)}'s published restricted-country list">${C.flag(cc)} ${long ? "Not restricted in " + esc(nm) : "Not restricted"}</span>`;
    if (a.k === "restricted") return `<span class="avail restricted" title="${esc(f.name)} lists ${esc(nm)} as restricted${a.unv ? " (unverified)" : ""}">${C.flag(cc)} Restricted${long ? " in " + esc(nm) : ""}${a.unv ? " · unverified" : ""}</span>`;
    return `<span class="avail unknown" title="${esc(f.name)} does not publish a restricted-country list we could find">${C.flag(cc)} No list published</span>`;
  }

  function progPass(p, opts = {}) {
    if (!tabDef(opts.tab || S.tab).test(p)) return false;
    if (opts.ignoreFilters) return true;
    if (S.models.size && !S.models.has(p.model)) return false;
    if (S.dd.size && !S.dd.has(p.drawdownType)) return false;
    if (S.platforms.size && !progPlatforms(p).some((x) => S.platforms.has(x))) return false;
    if (S.news && !["yes", "partial"].includes(cls(p.news))) return false;
    if (S.eas && !["yes", "partial"].includes(cls(p.eas))) return false;
    if (S.weekend && !["yes", "partial"].includes(cls(p.weekend))) return false;
    if (S.noConsistency && !consistencyNone(p.consistency)) return false;
    if (S.noDaily && !isNone(p.dailyLoss)) return false;
    // a program that sells sizes but not this one drops out; one that publishes no sizes stays (shown as "Not published")
    if (S.size && !opts.ignoreSize && p.sizes.length && !p.sizes.some((x) => x.size === S.size)) return false;
    return true;
  }
  function firmPass(f, opts = {}) {
    if (!S.showClosed && f.status !== "active") return false;
    if (S.q) {
      const q = S.q.toLowerCase();
      const hay = [f.name, f.domain, f.hq.country && C.name(f.hq.country), f.hq.city, f.hq.entity, ...f.platforms, ...f.programs.map((p) => p.name)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    let progs = f.programs.filter((p) => progPass(p, opts));
    // "Available in my country": drop the programs whose list names the country (per market where the firm splits lists)
    if (S.country && S.avail !== "all") {
      const before = progs.length;
      progs = progs.filter((p) => { const a = progAvail(f, p); return a.k !== "restricted" && (S.avail !== "confirmed" || a.k === "ok"); });
      if (before && !progs.length) return false;
      if (!f.programs.length && mainAvail(f, S.country).k === "restricted") return false;
    }
    if (!progs.length) {
      // a closed firm with no programs still shows on "All markets" when closed firms are shown
      if (!(f.status !== "active" && S.showClosed && (opts.tab || S.tab) === "all" && !f.programs.length)) return false;
    }
    return progs;
  }
  const matching = (opts) => firms.map((f) => ({ f, progs: firmPass(f, opts) })).filter((x) => x.progs);

  // regular list prices only: a pay-after-you-pass entry ($3–$9 upfront, the real fee later) is not the price
  const listPriced = (p) => ["USD", "USDT", "USDC"].includes(p.currency || "USD") && !/pay(ing)?\s*(after|later|with profits)|buy now|pass now|pay after|start fee|upfront|to start/i.test(`${p.name} ${p.priceNote || ""}`);
  function cheapestDeal(f, progs, size = S.size) {
    let best = null;
    for (const p of progs) {
      const sizes = size ? [{ size, price: priceAt(p, size) }] : p.sizes.map((s) => ({ size: s.size, price: s.price != null ? +s.price : null }));
      for (const s of sizes) {
        if (s.price == null) continue;
        const d = dealFor(f, p, s.size), eff = dealPrice(s.price, d);
        if (!best || (size ? eff < best.eff : s.size < best.size || (s.size === best.size && eff < best.eff))) best = { p, price: s.price, size: s.size, eff, deal: d };
      }
    }
    return best;
  }
  function cheapest(progs, size = S.size) {
    let best = null;
    for (const p of progs) {
      if (size) {
        const pr = priceAt(p, size);
        if (pr != null && (!best || pr < best.price)) best = { p, price: pr, size };
      } else {
        for (const s of p.sizes) if (s.price != null && (!best || s.size < best.size || (s.size === best.size && s.price < best.price))) best = { p, price: +s.price, size: s.size };
      }
    }
    return best;
  }

  function sortFirms(rows) {
    const byName = (a, b) => a.f.name.localeCompare(b.f.name);
    const k = S.sort;
    return rows.sort((a, b) => {
      if (k === "score") { const x = a.f.rating ? a.f.rating.score : -1, y = b.f.rating ? b.f.rating.score : -1; return y - x || byName(a, b); }
      if (k === "price") { const x = cheapestDeal(a.f, a.progs), y = cheapestDeal(b.f, b.progs); return (x ? x.eff : 1e12) - (y ? y.eff : 1e12) || byName(a, b); }
      if (k === "split") { const x = Math.max(0, ...a.progs.map((p) => +p.splitMax || 0)), y = Math.max(0, ...b.progs.map((p) => +p.splitMax || 0)); return y - x || byName(a, b); }
      if (k === "changes") { const x = a.f.changes[0]?.date || "", y = b.f.changes[0]?.date || ""; return x < y ? 1 : x > y ? -1 : byName(a, b); }
      if (k === "verified") { const x = a.f.lastVerified || "", y = b.f.lastVerified || ""; return x < y ? 1 : x > y ? -1 : byName(a, b); }
      return byName(a, b);
    });
  }

  function commonSizes(tab = S.tab) {
    const count = new Map();
    let n = 0;
    for (const p of allPrograms) {
      if (!tabDef(tab).test(p) || byId[p._f].status !== "active") continue;
      n++;
      for (const s of new Set(p.sizes.map((x) => x.size))) count.set(s, (count.get(s) || 0) + 1);
    }
    // only sizes that enough programs sell, so the chips stay a short, useful row
    const min = Math.max(3, Math.round(n * 0.05));
    return [...count.entries()].filter(([, c]) => c >= min).map(([s]) => s).sort((a, b) => a - b);
  }

  /* ------------------------------------------------------------------ small components */
  const ICON = {
    search: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7.1" cy="7.1" r="4.6"/><path d="m10.6 10.6 3.4 3.4"/></svg>`,
    plus: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>`,
    check: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>`,
    shield: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 1.8 2.8 3.8v4c0 3.2 2.2 5.4 5.2 6.4 3-1 5.2-3.2 5.2-6.4v-4z"/><path d="m5.8 8 1.6 1.6 3-3.2" stroke-linecap="round"/></svg>`,
    ext: `<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3v10h10v-3M9 3h4v4M13 3 7 9"/></svg>`,
    filter: `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3"/></svg>`,
    grid: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="1.2"/><rect x="9" y="2" width="5" height="5" rx="1.2"/><rect x="2" y="9" width="5" height="5" rx="1.2"/><rect x="9" y="9" width="5" height="5" rx="1.2"/></svg>`,
    rows: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 4h12M2 8h12M2 12h12"/></svg>`,
    arrow: `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`,
    x: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>`,
    sort: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5v9M4.5 9 8 12.5 11.5 9"/></svg>`,
    globe: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c1.8 1.7 2.7 3.7 2.7 6S9.8 12.3 8 14M8 2C6.2 3.7 5.3 5.7 5.3 8S6.2 12.3 8 14"/></svg>`,
    copy: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="2"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/></svg>`,
    tag: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 8.6V3.5a1 1 0 0 1 1-1h5.1l5 5a1 1 0 0 1 0 1.4l-5.1 5.1a1 1 0 0 1-1.4 0z"/><circle cx="5.6" cy="5.6" r="1.1"/></svg>`,
    chev: `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg>`,
  };

  // the firm's own logo file when we recorded one, else the largest icon its domain publishes (closed firms' domains
  // may now belong to someone else, so they keep the monogram)
  function logo(f, size = "") {
    const src = f.logo || (f.domain && f.status === "active" ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(f.domain)}&sz=256` : "");
    const img = src ? `<img alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(src)}"${f.logo ? ' data-own="1"' : ""}${f.logoFit ? ` class="fit-${esc(f.logoFit)}"` : ""}>` : "";
    return `<span class="logo ${size}" style="--brand:${esc(f.brandColor || "#2EF2A0")}" aria-hidden="true"><span class="mono-t">${esc(f.initials)}</span>${img}</span>`;
  }
  // Show the firm's own logo file always; a favicon only when it is big enough not to look blurred, else the monogram.
  // Load and error don't bubble, so they are caught on the way down (no inline handlers, which the security policy blocks).
  const logoReady = (img) => { if (img.dataset.own || img.naturalWidth >= 28) img.parentNode.classList.add("has-img"); else img.remove(); };
  document.addEventListener("load", (e) => { const t = e.target; if (t.tagName === "IMG" && t.parentNode && t.parentNode.classList.contains("logo")) logoReady(t); }, true);
  document.addEventListener("error", (e) => { const t = e.target; if (t.tagName === "IMG" && t.parentNode && t.parentNode.classList.contains("logo")) t.remove(); }, true);

  const dotsFor = (p) => [["news", "News"], ["eas", "EAs"], ["weekend", "Weekend"]]
    .map(([k, l]) => { const c = cls(p[k]); return `<span class="dot d-${c}" title="${l}: ${esc(p[k] ?? "Not published")}"><i></i>${l}</span>`; }).join("");
  const unv = (p, key) => (p.unverified || []).includes(key) ? `<span class="unv" title="Not fully confirmed on an official page — see the data gaps below">Unverified</span>` : "";
  const val = (v, p, key) => (v == null || v === "" || (Array.isArray(v) && !v.length) ? NP : esc(Array.isArray(v) ? v.join(", ") : v) + (p ? unv(p, key) : ""));
  const targets = (p) => (p.phases && p.phases.length ? p.phases.map((ph) => ph.target ?? "—").join(" / ") : p.model === "instant" ? "No target" : null);
  const marketTags = (f) => (f.markets || []).map((m) => `<span class="tag">${MARKET_LABEL[m] || esc(m)}</span>`).join("");
  const ddShort = (t) => (t === "static" ? "Static" : t === "trailing" ? "Trailing" : t === "eod-trailing" ? "EOD trail" : t === "trailing-lock" ? "Trail→lock" : null);
  const hqLine = (f) => (f.hq.country ? `${C.flag(f.hq.country)} <span>${esc(C.name(f.hq.country))}</span>` : `<span class="np">HQ not published</span>`);
  const cmpOn = (id) => S.compare.includes(id);
  const cmpBtn = (f) => `<button class="cmp-btn" type="button" data-cmp="${f.id}" aria-pressed="${cmpOn(f.id)}" title="${cmpOn(f.id) ? "Remove from compare" : "Add to compare"}" aria-label="${cmpOn(f.id) ? "Remove" : "Add"} ${esc(f.name)} ${cmpOn(f.id) ? "from" : "to"} compare">${cmpOn(f.id) ? ICON.check : ICON.plus}</button>`;

  /* ------------------------------------------------------------------ header */
  function header() {
    $("#brandMark").innerHTML = window.mark(15, 15, 28, "bm");
    $("#footMark").innerHTML = window.mark(15, 15, 28, "fm");
    renderCountryChip();
    $("#menuBtn").addEventListener("click", () => { const o = $("#mnav").classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", o); });
    $("#mnav").addEventListener("click", (e) => { if (e.target.closest("a")) $("#mnav").classList.remove("open"); });
    $("#countryChip").addEventListener("click", openPicker);
  }
  function renderCountryChip() {
    const c = S.country;
    $("#countryChip").innerHTML = c ? `${C.flag(c)}<span class="lab">Trading from</span> ${esc(C.name(c))}<span class="chev">▾</span>` : `<span>🌐</span> Set your country <span class="chev">▾</span>`;
    $("#countryChip").setAttribute("aria-label", c ? `Your country: ${C.name(c)}. Change` : "Set your country");
  }
  function navActive(name) {
    $$("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === name));
    $$('[data-nav="home"]').forEach((a) => { a.href = href(); });
    $$('[data-nav="compare"]').forEach((a) => { a.href = href("compare"); });
    $$('[data-nav="changes"]').forEach((a) => { a.href = href("changes"); });
    $$('[data-nav="offers"]').forEach((a) => { a.href = href("offers"); });
    const no = sectionOffers().length, oc = $("#navOffCount");
    if (oc) { oc.hidden = !no; oc.textContent = no; }
    const n = S.compare.length;
    $("#navCmpCount").hidden = !n; $("#navCmpCount").textContent = n;
    $("#mnavCmp").textContent = n ? n + " selected" : "";
  }

  /* ------------------------------------------------------------------ home */
  function viewHome() {
    const active = firms.filter((f) => f.status === "active");
    const nProg = active.reduce((n, f) => n + f.programs.length, 0);
    const recent = allChanges.slice(0, 8);
    const nSources = active.reduce((n, f) => n + (f.sources || []).length, 0);
    const countries = new Set(active.flatMap((f) => [...f.restricted.countries, ...Object.values(f.restricted.byMarket || {}).flatMap((m) => m.countries)]));
    // the bento cards show real records, never placeholders; each section picks well-known firms of its own market
    const PICK = { cfd: { src: "ftmo", pair: ["fundednext", "the5ers"], model: "2-step", size: 100000 },
      futures: { src: "topstep", pair: ["topstep", "tradeify"], model: "1-step", size: 50000 },
      crypto: { src: "fxify", pair: ["fxify", "for-traders"], model: "1-step", size: 50000 },
      perps: { src: "breakout", pair: ["hyrotrader", "breakout"], model: "1-step", size: 100000 } }[SEC.id];
    const cc = S.country || "PK";
    const pairIds = PICK.pair.filter((id) => byId[id]);
    const pair = pairIds.length === 2 ? pairIds.map((id) => byId[id]) : active.filter((f) => cheapest(f.programs, PICK.size)).slice(0, 2);
    // compare like with like: the section's usual challenge type at its usual size, else the firm's cheapest program
    const flagship = (f) => {
      const same = f.programs.find((p) => p.model === PICK.model && priceAt(p, PICK.size) != null);
      if (same) return { p: same, price: priceAt(same, PICK.size), size: PICK.size };
      return cheapest(f.programs, PICK.size) || cheapest(f.programs, null);
    };
    const pairProg = pair.map(flagship);
    // the ring needs enough tiles to read as a ring, so a small section repeats its logos
    const ringList = []; while (active.length && ringList.length < 28) ringList.push(...active.map((f, i) => ({ f, dup: ringList.length > 0 })));
    const ring = ringList.map(({ f, dup }) => `<a class="r3-item" href="${href("firm/" + f.id)}" aria-label="${esc(f.name)}"${dup ? ' aria-hidden="true" tabindex="-1"' : ""}>${logo(f)}<span class="r3-name">${esc(f.name)}</span></a>`).join("");
    const heading = SEC.id === "cfd" ? "Every forex prop firm," : `Every ${SEC.noun} prop firm,`;
    const cards = snapshotCards(active, cc, pair, pairProg, PICK);
    app.innerHTML = `
      <div class="hero-pin" id="heroPin"><section class="hero3d" id="hero3d">
        <div class="hero-canvas" id="heroCanvas" aria-hidden="true">
          <div class="hero-fallback"><svg viewBox="0 0 200 200">${window.mark(100, 96, 150, "hf")}</svg></div>
        </div>
        <div class="hero-inner">
          <a class="live-chip" href="${href("changes")}" data-reveal><span class="pulse"></span><span>Live · ${active.length} ${esc(SEC.noun)} firms tracked · verified ${fmtDate(lastVerified)}</span><span class="arr">${ICON.arrow}</span></a>
          <h1 data-split>${heading} <em>side by side.</em></h1>
          <p class="lede" data-reveal>Rules, prices and restricted countries for ${active.length} ${esc(SEC.noun)} prop firms. Every fact comes from the firm's own pages, with the link and the date we checked.</p>
          <div class="cta-row" data-reveal>
            <a class="btn primary xl shine" data-magnetic href="#directory" id="ctaDir">Compare ${active.length} firms ${ICON.arrow}</a>
            <a class="btn glass-btn xl" data-magnetic href="#/method">How we verify</a>
          </div>
        </div>
      </section></div>

      <section class="mq-sec" data-reveal>
        <div class="mq-label">Tracking every notable ${esc(SEC.noun)} prop firm · ${esc(SEC.hint)}</div>
        <div class="ring3d" data-ring3d><div class="r3-stage">${ring}</div></div>
      </section>

      <section class="dir-intro" id="directory">
        <div class="dir-head" data-reveal>
          <div class="eyebrow">The directory</div>
          <h2 class="h2" data-split>Find your firm.</h2>
          <p>Filter by market, account size, rules and the country you trade from.</p>
          <div class="dir-stats">
            <div><b data-count="${active.length}">0</b><span>Firms</span></div>
            <div><b data-count="${nProg}">0</b><span>Programs</span></div>
            <div><b data-count="${nSources}">0</b><span>Source pages</span></div>
            <div><b data-count="${countries.size}">0</b><span>Countries mapped</span></div>
          </div>
        </div>
        <div class="bento dir-geo" data-stagger>${cards.geo}</div>
      </section>
      <div class="dir-body">
      <div class="tabs-row" id="tabsRow"><div class="tabs spot" role="tablist" aria-label="Market" id="tabs"></div></div>

      <div class="toolbar deck console spot" id="deck">
        <i class="glint" aria-hidden="true"></i><i class="halo" aria-hidden="true"></i>
        <div class="search"><label class="sr" for="q">Search firms</label>${ICON.search}<input id="q" type="search" enterkeyhint="search" aria-keyshortcuts="/" placeholder="${phDefault()}" autocomplete="off" value="${esc(S.q)}"><kbd aria-hidden="true"><span class="k1">/</span><span class="k2">esc</span></kbd><button type="button" class="q-clear" aria-label="Clear search" ${S.q ? "" : "hidden"}>${ICON.x}</button></div>
        <span class="dv" aria-hidden="true"></span>
        <button class="btn av" type="button" id="availBtn"></button>
        <span class="dv" aria-hidden="true"></span>
        <button class="btn" type="button" id="filterBtn">${ICON.filter}<span class="lbl">Filters</span><span class="badge" id="fCount" hidden></span></button>
        <span class="dv" aria-hidden="true"></span>
        <div class="sortdd" id="sortDD">
          <button type="button" class="sort-btn" id="sortBtn" aria-haspopup="listbox" aria-expanded="false" aria-controls="sortList"><span class="pre" aria-hidden="true">Sort</span><span class="sr">Sort by</span><span class="val" id="sortVal">${esc(sortLabel())}</span>${ICON.chev}</button>
          <div class="sort-menu" id="sortList" role="listbox" aria-label="Sort firms by" tabindex="-1" hidden><span class="so-hl" aria-hidden="true"></span>${SORTS.map(([k, l]) => `<div class="so" role="option" id="so-${k}" data-sort="${k}" aria-selected="${S.sort === k}">${ICON.check}<span>${l}</span></div>`).join("")}</div>
        </div>
        <div class="seg" role="group" aria-label="View">
          <button type="button" data-view="firms" class="${S.view === "firms" ? "on" : ""}" aria-pressed="${S.view === "firms"}">${ICON.grid}<span class="lbl">Firms</span></button>
          <button type="button" data-view="challenges" class="${S.view === "challenges" ? "on" : ""}" aria-pressed="${S.view === "challenges"}">${ICON.rows}<span class="lbl">Challenges</span></button>
        </div>
        <div class="sizes" id="sizes" role="radiogroup" aria-label="Account size"></div>
      </div>
      <div class="active-filters" id="activeFilters"></div>
      <div class="result-line" id="resultLine"><div class="n" id="resultN"></div><button type="button" class="fine-i" aria-expanded="false" aria-controls="fineNote" aria-label="How prices are shown"></button><div class="fine" id="fineNote">Prices are in each firm's own currency, and sorting does not convert them. A struck-through price means the firm's own public code is applied: the code is on the offer badge in the same row, and one click copies it.</div></div>
      <div class="sr" id="resultLive" role="status" aria-live="polite"></div>
      <div id="results" role="tabpanel"></div>
      </div>

      ${(() => { const off = sectionOffers(); return off.length ? `<div class="strip-head" data-reveal><h2><span class="pulse"></span>Live offers <small class="sh-note">official codes only</small></h2><a class="link" href="${href("offers")}">Offers from ${off.length} firms ${ICON.arrow}</a></div>
      <div class="of-strip" data-reveal>${off.slice(0, 8).map(([f, o, more]) => offerTicket(f, o, more)).join("")}</div>` : ""; })()}
      ${recent.length ? `<div class="strip-head" data-reveal><h2><span class="pulse"></span>Latest rule changes</h2><a class="link" href="${href("changes")}">All changes ${ICON.arrow}</a></div>
      <div class="strip" data-reveal>${recent.map(changeCard).join("")}</div>` : ""}

      <section class="statement">
        <p data-scrub>Every rule here links to the firm's own website, with the date we checked it. Every score shows the reviews and payout reports behind it. <em>No paid placement.</em> <em>No affiliate links.</em></p>
      </section>

      ${cards.rules || cards.cmp ? `<section class="bento" data-stagger>${cards.rules}${cards.cmp}</section>` : ""}`;

    const q = $("#q"), clr = $(".q-clear");
    let qT;
    q.addEventListener("input", (e) => {
      clr.hidden = !q.value;
      if (e.isComposing) return;
      clearTimeout(qT);
      qT = setTimeout(() => { S.q = q.value.trim(); renderResults({ quiet: true }); }, 110);
    });
    clr.addEventListener("click", () => { q.value = ""; S.q = ""; clr.hidden = true; renderResults({ quiet: true }); q.focus(); });
    q.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); if (q.value) clr.click(); else q.blur(); }
      else if (e.key === "Enter") { e.preventDefault(); if (window.matchMedia("(pointer: coarse)").matches) q.blur(); }
    });
    q.addEventListener("focus", () => {
      const ic = $(".search > svg", $("#deck"));
      if (ic && ic.animate && !reducedMotion()) ic.animate([{ transform: "translateY(-50%)" }, { transform: "translateY(-50%) scale(1.18) rotate(-10deg)", offset: 0.4 }, { transform: "translateY(-50%)" }], { duration: 420, easing: SPRING });
    });
    cyclePlaceholder(q);
    bindSortMenu();
    bindRails();
    $$("[data-view]").forEach((b) => b.addEventListener("click", () => {
      if (S.view === b.dataset.view) return;
      S.view = b.dataset.view; save();
      $$("[data-view]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); });
      const seg = b.parentNode; seg.classList.remove("flip"); void seg.offsetWidth; seg.classList.add("flip");
      renderResults();
    }));
    $("#filterBtn").addEventListener("click", openSheet);
    $("#availBtn").addEventListener("click", () => {
      if (!S.country) { openPicker(); return; }
      S.avail = S.avail === "all" ? "hide" : "all"; save(); renderResults();
    });
    $(".fine-i").addEventListener("click", (e) => { const on = $("#resultLine").classList.toggle("note"); e.currentTarget.setAttribute("aria-expanded", on); });
    lightDeck($("#deck"));
    armDock();
    $("#bxPick")?.addEventListener("click", openPicker);
    $$('a[href="#directory"]').forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); const y = $("#directory").getBoundingClientRect().top + scrollY - 70; window.scrollTo({ top: y, behavior: "smooth" }); }));
    renderResults();
    const mountHero = () => { const el = $("#heroCanvas"); if (el && window.PFMHero) window.PFMHero.mount(el); };
    if (window.PFMHero) mountHero(); else window.addEventListener("pfm-hero-ready", mountHero, { once: true });
  }

  /* ------------------------------------------------------------------ market snapshot (home) */
  // Glass cards built only from the section's records: whether the reader's country is on each firm's list (beside
  // the directory), how common the main rules are, and one like-for-like comparison (below the list).
  function snapshotCards(active, cc, pair, pairProg, PICK) {
    // B · the reader's country against every firm's published list
    const groups = { ok: [], restricted: [], unknown: [] };
    active.forEach((f) => { const k = availability(f, cc).k; (k === "ok" ? groups.ok : k === "restricted" || k === "partial" ? groups.restricted : groups.unknown).push(f); });
    const tot = active.length || 1, R = 46, CIRC = 2 * Math.PI * R;
    let off = 0;
    const seg = (list, cls) => { const len = (list.length / tot) * CIRC; const el = list.length ? `<circle class="dn-seg ${cls}" r="${R}" cx="60" cy="60" style="--len:${len.toFixed(2)};--off:${(-off).toFixed(2)};--c:${CIRC.toFixed(2)}"/>` : ""; off += len; return el; };
    const donut = seg(groups.ok, "ok") + seg(groups.restricted, "rs") + seg(groups.unknown, "un");
    const flagArt = C.emojiOK && cc !== "XK"
      ? `<div class="flagwave" aria-hidden="true">${[0, 1].map((m) => `<div class="fw-row ${m ? "fw-mirror" : ""}">${Array.from({ length: 18 }, (_, i) => `<span style="--i:${i}"><b>${C.emoji(cc)}</b></span>`).join("")}</div>`).join("")}</div>`
      : `<div class="flag-medal" aria-hidden="true">${esc(cc)}</div>`;
    const countryCard = `<article class="bx bx-geo spot">
        <div class="bx-k">Your country</div>
        <div class="geo-top">${flagArt}
          <div class="donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="dn-track" r="${R}" cx="60" cy="60"/>${donut}</svg>
            <div class="dn-c"><b data-count="${groups.ok.length}">0</b><span>of ${active.length}</span></div></div>
        </div>
        <h3>Can you trade from ${esc(C.name(cc))}?</h3>
        <ul class="geo-legend">
          <li class="ok"><i></i><span>Not on the firm's restricted list</span><b>${groups.ok.length}</b></li>
          <li class="rs"><i></i><span>Restricted</span><b>${groups.restricted.length}</b></li>
          <li class="un"><i></i><span>No list published</span><b>${groups.unknown.length}</b></li>
        </ul>
        <div class="geo-foot">${groups.ok.length ? `<div class="stack">${groups.ok.slice(0, 6).map((f) => logo(f, "sm")).join("")}${groups.ok.length > 6 ? `<span class="more">+${groups.ok.length - 6}</span>` : ""}</div>` : "<span></span>"}
          <button class="btn sm glass-btn" type="button" id="bxPick">Change country</button></div>
      </article>`;

    // C · how common the main rules are, among the programs that publish each one
    const progs = active.flatMap((f) => f.programs);
    const share = (fn) => { const known = progs.map(fn).filter((v) => v !== null); return known.length ? { pct: Math.round((known.filter(Boolean).length / known.length) * 100), n: known.length } : null; };
    const allowed = (v) => { const c = cls(v); return c === "unknown" ? null : c !== "no"; };
    const gauges = [
      ["News trading allowed", share((p) => allowed(p.news))],
      ["EAs allowed", share((p) => allowed(p.eas))],
      ["Static drawdown", share((p) => (p.drawdownType ? p.drawdownType === "static" : null))],
      ["No consistency rule", share((p) => (p.consistency == null || /^not published/i.test(p.consistency) ? null : consistencyNone(p.consistency)))],
    ].filter(([, v]) => v);
    const GR = 30, GC = 2 * Math.PI * GR;
    const rulesCard = `<article class="bx bx-rules spot">
        <div class="bx-k">Rules at a glance</div>
        <h3>How common each rule is.</h3>
        <div class="gauges">${gauges.map(([label, v]) => `<div class="gauge"><div class="g-ring"><svg viewBox="0 0 76 76" aria-hidden="true"><circle class="g-track" r="${GR}" cx="38" cy="38"/><circle class="g-val" r="${GR}" cx="38" cy="38" style="--len:${((v.pct / 100) * GC).toFixed(2)};--c:${GC.toFixed(2)}"/></svg><b><span data-count="${v.pct}">0</span>%</b></div><span class="g-l">${label}</span><span class="g-n">of ${v.n} programs</span></div>`).join("")}</div>
        <p class="bx-sub">Share of ${esc(SEC.noun)} programs that publish the rule. Unpublished rules are left out.</p>
      </article>`;

    // D · one like-for-like comparison, head to head
    const [A, B] = pair, [a, b] = pairProg;
    const num = (v) => (v == null ? null : +v);
    const same = a && b && a.p.currency === b.p.currency;
    const lines = a && b ? [
      ["Price · " + sizeLabel(a.size, acctCur(a.p)), money(a.price, a.p.currency), money(b.price, b.p.currency), same ? num(a.price) : null, same ? num(b.price) : null, "low"],
      ["Target", esc(targets(a.p) || "—"), esc(targets(b.p) || "—"), null, null, null],
      ["Max drawdown", pct(a.p.maxDrawdown) != null ? pct(a.p.maxDrawdown) + "%" : "See rules", pct(b.p.maxDrawdown) != null ? pct(b.p.maxDrawdown) + "%" : "See rules", pct(a.p.maxDrawdown), pct(b.p.maxDrawdown), null],
      ["Profit split", a.p.splitMax ? a.p.splitMax + "%" : "—", b.p.splitMax ? b.p.splitMax + "%" : "—", num(a.p.splitMax), num(b.p.splitMax), "high"],
    ] : [];
    const vsRow = ([label, va, vb, na, nb, best]) => {
      const both = na != null && nb != null && na + nb > 0;
      const wa = best && both && na !== nb && (best === "low" ? na < nb : na > nb), wb = best && both && na !== nb && !wa;
      return `<div class="vs-row"><b class="${wa ? "win" : ""}">${va}</b><span>${label}</span><b class="${wb ? "win" : ""}">${vb}</b>
        ${both ? `<div class="vs-bar" style="--pa:${((na / (na + nb)) * 100).toFixed(1)}%"><i></i></div>` : ""}</div>`;
    };
    const cmpCard = A && B && a && b ? `<article class="bx bx-cmp spot">
        <div class="bx-k">Compare</div>
        <h3>Side by side, down to the rule.</h3>
        <div class="vs">
          <a class="vs-side" href="${href("firm/" + A.id)}">${logo(A, "lg")}<b>${esc(A.name)}</b><span>${esc(a.p.name)}</span></a>
          <div class="vs-badge">VS</div>
          <a class="vs-side" href="${href("firm/" + B.id)}">${logo(B, "lg")}<b>${esc(B.name)}</b><span>${esc(b.p.name)}</span></a>
        </div>
        <div class="vs-rows">${lines.map(vsRow).join("")}</div>
        <a class="link" href="${href("compare")}?ids=${A.id},${B.id}">Open the full comparison ${ICON.arrow}</a>
      </article>` : "";
    return { geo: countryCard, rules: rulesCard, cmp: cmpCard };
  }

  // ---------- directory console: motion helpers ----------
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // a damped spring (about 4% overshoot) for the few motions run from script
  const SPRING = CSS.supports("transition-timing-function", "linear(0, 1)")
    ? "linear(0, .005 1%, .025 2.3%, .056 3.5%, .106 5%, .21 7.5%, .466 13%, .577 15.5%, .686 18.3%, .772 20.8%, .844 23.3%, .907 26%, .955 28.7%, .992 31.8%, 1.013 34.3%, 1.027 36.8%, 1.035 39.5%, 1.038 42.8%, 1.035 47.5%, 1.012 61.5%, 1.003 70.5%, .999 82.3%, 1)"
    : "cubic-bezier(.3, 1.3, .4, 1)";

  // The selection lens: a liquid-glass capsule built from two round caps and a middle that stretches. It morphs
  // between choices with transforms alone (so the compositor runs it), never smears its round ends, starts from
  // wherever it is on screen if a new choice arrives mid-glide, and lives on in its rail across renders.
  const LENS = (() => {
    const store = new WeakMap();
    const EASE = "cubic-bezier(.45, 0, .25, 1)";
    function get(rail) {
      let L = store.get(rail);
      if (!L) {
        const el = document.createElement("span");
        el.className = "lq " + (rail.id === "sizes" ? "size-ind" : "tab-ind");
        el.setAttribute("aria-hidden", "true");
        el.innerHTML = '<i class="lq-g"></i><i class="lq-c"></i><i class="lq-c"></i><i class="lq-m"></i>';
        L = { el, parts: [...el.children], at: null, anims: [], sel: null };
        store.set(rail, L);
      }
      if (L.el.parentNode !== rail) rail.prepend(L.el);
      return L;
    }
    // glow, left cap, right cap, middle; edges l and r, squash sy, capsule height H
    const pose = (l, r, sy, H) => [
      `translateX(${l}px) scale(${(r - l) / 100}, ${sy})`,
      `translateX(${l}px) scaleY(${sy})`,
      `translateX(${r - H}px) scaleY(${sy})`,
      `translateX(${l + H / 2}px) scale(${Math.max(0, r - l - H) / 100}, ${sy})`,
    ];
    // instant: a geometry change (rotation, resize, a late font) snaps the lens to its item and re-centres the rail
    function place(rail, item, instant) {
      if (!rail || !item) return;
      const L = get(rail);
      const to = [item.offsetLeft, item.offsetLeft + item.offsetWidth];
      const H = L.el.offsetHeight || item.offsetHeight;
      const key = item.dataset.tab ?? item.dataset.size ?? "";
      if (rail.scrollWidth > rail.clientWidth + 2 && (L.sel !== key || instant)) {
        rail.scrollTo({ left: Math.max(0, item.offsetLeft - (rail.clientWidth - item.offsetWidth) / 2), behavior: L.sel == null || instant || reducedMotion() ? "auto" : "smooth" });
      }
      L.sel = key;
      if (L.at && L.at[0] === to[0] && L.at[1] === to[1] && L.H === H) return;
      let from = instant ? null : L.at, sy0 = 1;
      if (!instant && L.anims.some((a) => a.playState === "running")) {
        // read the pose in the rail's own (unscaled) space, so a docked, scaled rail does not skew it
        const a = new DOMMatrixReadOnly(getComputedStyle(L.parts[1]).transform), c = new DOMMatrixReadOnly(getComputedStyle(L.parts[2]).transform);
        from = [a.m41, c.m41 + (L.H || H)]; sy0 = a.m22 || 1;
      }
      L.anims.forEach((a) => a.cancel()); L.anims = [];
      const rest = pose(to[0], to[1], 1, H), oldH = L.H;
      L.parts.forEach((p, i) => { p.style.transform = rest[i]; });
      L.at = to; L.H = H;
      if (!from || oldH !== H || reducedMotion() || !L.el.animate) return;
      const d = to[0] - from[0];
      if (Math.abs(d) < 1 && Math.abs(to[1] - from[1]) < 1) return;
      const right = d > 0;
      const edge = (lead, trail) => right
        ? [from[0] + trail * (to[0] - from[0]), from[1] + lead * (to[1] - from[1])]
        : [from[0] + lead * (to[0] - from[0]), from[1] + trail * (to[1] - from[1])];
      const k1 = edge(0.8, 0.22), k2 = edge(1 + Math.min(0.04, 6 / Math.max(1, Math.abs(d))), 0.86);
      const frames = [pose(from[0], from[1], sy0, H), pose(k1[0], k1[1], 0.88, H), pose(k2[0], k2[1], 0.98, H), rest];
      const offs = [0, 0.36, 0.72, 1];
      const dur = Math.min(640, 380 + 7 * Math.sqrt(Math.abs(d)));
      L.anims = L.parts.map((p, i) => p.animate(frames.map((f, j) => ({ transform: f[i], offset: offs[j], easing: EASE })), { duration: dur }));
      const base = getComputedStyle(L.el).filter, f0 = base === "none" ? "" : base;
      L.anims.push(L.el.animate([{ filter: f0 || "none" }, { filter: `${f0} brightness(1.14) saturate(1.12)`.trim(), offset: 0.36 }, { filter: f0 || "none" }], { duration: dur }));
    }
    // re-seat every lens in place, without a glide
    function reseat() { $$(".lq").forEach((el) => { const rail = el.parentNode; const on = rail && $(".on", rail); if (on) place(rail, on, true); }); }
    // with a mouse the lens leaves on press, so the choice feels instant; a press dragged away glides back
    function press(rail, sel) {
      rail.addEventListener("pointerdown", (e) => {
        if (e.pointerType !== "mouse" || e.button !== 0) return;
        const it = e.target.closest(sel); if (!it || !rail.contains(it)) return;
        place(rail, it);
        document.addEventListener("pointerup", () => setTimeout(() => { const on = $(".on", rail); if (on) place(rail, on); }, 0), { once: true });
      });
    }
    return { place, press, reseat };
  })();
  // rotation, a resize across a breakpoint, or a font that arrives late moves the items: re-seat the lenses
  if ("ResizeObserver" in window) { let rq = 0; const ro = new ResizeObserver(() => { cancelAnimationFrame(rq); rq = requestAnimationFrame(LENS.reseat); }); LENS.observe = (el) => ro.observe(el); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => LENS.reseat());

  // a faint glass highlight that glides from item to item under the pointer, instead of each pill blinking on its own
  function hoverGlide(rail, sel) {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let hv = null;
    rail.addEventListener("pointerover", (e) => {
      const it = e.target.closest(sel); if (!it || !rail.contains(it)) return;
      if (!hv || hv.parentNode !== rail) { hv = document.createElement("span"); hv.className = "hov"; hv.setAttribute("aria-hidden", "true"); rail.prepend(hv); }
      const first = !hv.classList.contains("show");
      if (first) hv.style.transition = "none";
      hv.style.transform = `translateX(${it.offsetLeft}px)`; hv.style.width = `${it.offsetWidth}px`;
      if (first) { void hv.offsetWidth; hv.style.transition = ""; }
      hv.classList.add("show");
    });
    rail.addEventListener("pointerleave", () => { if (hv) hv.classList.remove("show"); });
  }

  // rails that overflow (phones) fade the edge that hides more
  function railEdges(rail) {
    const edges = () => { const max = rail.scrollWidth - rail.clientWidth; rail.classList.toggle("fade-l", rail.scrollLeft > 4); rail.classList.toggle("fade-r", rail.scrollLeft < max - 4); };
    rail.addEventListener("scroll", edges, { passive: true }); edges();
    return edges;
  }

  // arrow keys move along a rail (roving tab stop); the selection follows the focus, so the lens does too
  function railKeys(rail, sel, pick, vertical) {
    rail.addEventListener("keydown", (e) => {
      const items = $$(sel, rail), i = items.indexOf(document.activeElement), n = items.length;
      if (i < 0) return;
      let j = null;
      if (e.key === "ArrowRight" || (vertical && e.key === "ArrowDown")) j = (i + 1) % n;
      else if (e.key === "ArrowLeft" || (vertical && e.key === "ArrowUp")) j = (i - 1 + n) % n;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = n - 1;
      if (j == null) return;
      e.preventDefault();
      if (j === i) return;
      items[j].focus({ preventScroll: true }); pick(items[j]);
    });
  }

  const sizeHTML = (s) => { const t = sizeLabel(s, ""), m = /^([\d.]+)([KM])$/.exec(t); return m ? `${m[1]}<span class="u">${m[2]}</span>` : t; };
  // counts in the rail change with a short lift instead of a jump
  function setCount(el, n) {
    if (!el || el.textContent === String(n)) return;
    const had = el.textContent !== "";
    el.textContent = n;
    if (had && el.animate && !reducedMotion()) el.animate([{ transform: "translateY(45%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 280, easing: "cubic-bezier(.2, .8, .2, 1)" });
  }

  // tabs and sizes are drawn once per set of choices, then patched in place, so focus, the lens and the hover glide survive every render
  function syncRails() {
    const tabs = $("#tabs"), sz = $("#sizes");
    const list = TABS.filter((t) => t.id === "all" || allPrograms.some((p) => t.test(p) && byId[p._f].status === "active"));
    const sig = SEC.id + ":" + list.map((t) => t.id).join(",");
    if (tabs.dataset.sig !== sig) {
      tabs.dataset.sig = sig;
      tabs.innerHTML = list.map((t) => `<button class="tab" role="tab" type="button" id="tab-${t.id}" aria-controls="results" data-tab="${t.id}" title="${esc(t.hint || "")}"><span class="t">${t.label}</span><span class="n"><span class="v"></span><span class="sr"> firms</span></span>${t.isNew ? `<span class="new">NEW</span>` : ""}</button>`).join("");
    }
    $$(".tab", tabs).forEach((b) => {
      const on = b.dataset.tab === S.tab;
      b.classList.toggle("on", on); b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1;
      setCount($(".n .v", b), matching({ tab: b.dataset.tab, ignoreSize: true }).length);
    });
    const panel = $("#results"); if (panel) panel.setAttribute("aria-labelledby", "tab-" + S.tab);
    const sizes = commonSizes();
    if (S.size && !sizes.includes(S.size)) S.size = null;
    const ssig = SEC.id + ":" + sizes.join(",");
    if (sz.dataset.sig !== ssig) {
      sz.dataset.sig = ssig;
      sz.innerHTML = `<span class="lab" aria-hidden="true"><span class="lg">Account </span>size</span>` +
        [null, ...sizes].map((s) => `<button type="button" class="chip" role="radio" data-size="${s ?? ""}">${s ? sizeHTML(s) : "Any"}</button>`).join("");
    }
    $$(".chip", sz).forEach((b) => { const on = (b.dataset.size ? +b.dataset.size : null) === (S.size || null); b.classList.toggle("on", on); b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1; });
    LENS.place(tabs, $(".tab.on", tabs));
    LENS.place(sz, $(".chip.on", sz));
    (tabs._edges || (tabs._edges = railEdges(tabs)))();
    (sz._edges || (sz._edges = railEdges(sz)))();
  }

  function chooseTab(id) {
    if (id === S.tab) return;
    const row = $("#tabsRow"), docked = row && row.classList.contains("docked");
    S.tab = id;
    const sizes = commonSizes();
    if (S.size && !sizes.includes(S.size)) S.size = sizes.includes(100000) ? 100000 : sizes.includes(50000) ? 50000 : null;
    save(); renderResults();
    // a market picked from the docked rail brings the new list's top back into view
    if (docked) { const deck = $("#deck"); if (deck) window.scrollTo({ top: scrollY + deck.getBoundingClientRect().top - row.getBoundingClientRect().bottom - 12, behavior: reducedMotion() ? "auto" : "smooth" }); }
  }
  function chooseSize(s) { if ((s || null) === (S.size || null)) return; S.size = s; save(); renderResults(); }

  function bindRails() {
    const tabs = $("#tabs"), sz = $("#sizes");
    tabs.addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) chooseTab(b.dataset.tab); });
    sz.addEventListener("click", (e) => { const b = e.target.closest("[data-size]"); if (b) chooseSize(b.dataset.size ? +b.dataset.size : null); });
    railKeys(tabs, ".tab", (b) => chooseTab(b.dataset.tab));
    railKeys(sz, ".chip", (b) => chooseSize(b.dataset.size ? +b.dataset.size : null), true);
    LENS.press(tabs, ".tab"); LENS.press(sz, "[data-size]");
    if (LENS.observe) { LENS.observe(tabs); LENS.observe(sz); }
    hoverGlide(tabs, ".tab"); hoverGlide(sz, ".chip");
  }

  // the console's top edge catches the light once when it arrives on screen (and again when the search takes focus)
  function lightDeck(deck) {
    if (!deck || reducedMotion() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { deck.classList.add("lit"); io.disconnect(); } }, { threshold: 0.6 });
    io.observe(deck);
  }

  // the market rail docks under the header: a soft fade appears behind it and it settles a little smaller
  let dockIO = null;
  function armDock() {
    const row = $("#tabsRow");
    if (dockIO) { dockIO.disconnect(); dockIO = null; }
    if (!row || !("IntersectionObserver" in window)) return;
    let s = row.previousElementSibling;
    if (!s || !s.classList.contains("dock-s")) { s = document.createElement("i"); s.className = "dock-s"; s.setAttribute("aria-hidden", "true"); row.before(s); }
    const top = parseFloat(getComputedStyle(row).top) || 0;
    // the root runs far below the screen, so a jump from below to above the line still flips the state
    dockIO = new IntersectionObserver(([e]) => row.classList.toggle("docked", !e.isIntersecting && e.boundingClientRect.top < top), { rootMargin: `-${top + 1}px 0px 100000px 0px` });
    dockIO.observe(s);
  }
  window.matchMedia("(max-width: 640px)").addEventListener("change", () => { armDock(); syncSort(); requestAnimationFrame(LENS.reseat); });

  // the '/' shortcut brings the console to just under the docked rail, presses the keycap, then focuses the search
  function focusSearch(q) {
    closeSortMenu(false);
    const deck = q.closest(".toolbar"), row = $("#tabsRow");
    const r = deck.getBoundingClientRect(), stick = (row ? (parseFloat(getComputedStyle(row).top) || 0) + row.offsetHeight : 120) + 12;
    if (r.top < stick || r.bottom > innerHeight) window.scrollTo({ top: scrollY + r.top - stick, behavior: reducedMotion() ? "auto" : "smooth" });
    const k = $("kbd", deck);
    if (k && k.animate && !reducedMotion()) k.animate([{ transform: "translateY(-50%)" }, { transform: "translateY(-50%) translateY(2px) scale(.9)", offset: 0.35 }, { transform: "translateY(-50%)" }], { duration: 220, easing: "cubic-bezier(.2, .8, .2, 1)" });
    q.focus({ preventScroll: true });
  }

  // sort: a glass menu (an ARIA listbox) in place of the browser's own select, with a highlight that glides between rows
  const tsortKey = () => Object.keys(TSORT).find((k) => TSORT[k].key === S.tsort.key && TSORT[k].dir === S.tsort.dir) || null;
  const sortKey = () => (S.view === "challenges" ? tsortKey() : S.sort);
  function sortLabel() {
    const k = sortKey(), e = SORTS.find(([x]) => x === k);
    if (!e) return "Table order";
    return window.matchMedia("(max-width: 640px)").matches ? e[2] : e[1];
  }
  function syncSort() {
    const v = $("#sortVal"), t = sortLabel();
    if (v && v.textContent !== t) {
      v.textContent = t;
      if (v.animate && !reducedMotion()) v.animate([{ transform: "translateY(55%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: "cubic-bezier(.2, .8, .2, 1)" });
    }
    const k = sortKey(), ch = S.view === "challenges";
    $$("#sortList .so").forEach((o) => { o.setAttribute("aria-selected", o.dataset.sort === k); o.setAttribute("aria-disabled", ch && !TSORT[o.dataset.sort]); });
  }
  let sortHideT;
  function closeSortMenu(refocus) {
    const dd = $("#sortDD"), menu = $("#sortList");
    if (!menu || menu.hidden || !dd.classList.contains("open")) return;
    dd.classList.remove("open");
    $("#sortBtn").setAttribute("aria-expanded", "false");
    clearTimeout(sortHideT);
    sortHideT = setTimeout(() => { if (!dd.classList.contains("open")) menu.hidden = true; }, reducedMotion() ? 0 : 170);
    if (refocus) $("#sortBtn").focus({ preventScroll: true });
  }
  function bindSortMenu() {
    const dd = $("#sortDD"), btn = $("#sortBtn"), menu = $("#sortList"), hl = $(".so-hl", menu);
    const opts = () => $$(".so", menu);
    let act = 0;
    const setAct = (i, jump) => {
      const o = opts(); act = (i + o.length) % o.length;
      o.forEach((x, j) => x.classList.toggle("act", j === act));
      menu.setAttribute("aria-activedescendant", o[act].id);
      if (jump) hl.style.transition = "none";
      hl.style.transform = `translateY(${o[act].offsetTop}px)`;
      if (jump) { void hl.offsetWidth; hl.style.transition = ""; }
    };
    const open = () => {
      if (dd.classList.contains("open")) return;
      clearTimeout(sortHideT);
      menu.hidden = false; void menu.offsetWidth; dd.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      syncSort();
      setAct(Math.max(0, SORTS.findIndex(([k]) => k === sortKey())), true);
      menu.focus({ preventScroll: true });
    };
    const pick = (k) => {
      if (S.view === "challenges") {
        if (!TSORT[k]) return;
        closeSortMenu(true); if (k === tsortKey()) return;
        S.tsort = { ...TSORT[k] }; syncSort(); renderResults(); return;
      }
      closeSortMenu(true); if (k === S.sort) return;
      S.sort = k; save(); syncSort(); renderResults();
    };
    btn.addEventListener("click", () => (dd.classList.contains("open") ? closeSortMenu(false) : open()));
    btn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); } });
    menu.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); setAct(act + (k === "ArrowDown" ? 1 : -1)); }
      else if (k === "Home" || k === "End") { e.preventDefault(); setAct(k === "Home" ? 0 : -1); }
      else if (k === "Enter" || k === " ") { e.preventDefault(); pick(opts()[act].dataset.sort); }
      else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); closeSortMenu(true); }
      else if (k === "Tab") closeSortMenu(false);
    });
    menu.addEventListener("click", (e) => { const o = e.target.closest(".so"); if (o) pick(o.dataset.sort); });
    menu.addEventListener("pointermove", (e) => { const o = e.target.closest(".so"); if (o && !o.classList.contains("act")) setAct(opts().indexOf(o)); });
  }

  // the empty search box cycles through real examples from this section: its top firms, common platforms, the reader's country
  const phDefault = () => (window.matchMedia("(max-width: 640px)").matches ? "Search firms…" : "Search firm, platform, country…");
  function cyclePlaceholder(q) {
    if (reducedMotion()) return;
    const rows = sortFirms(matching({ ignoreSize: true }));
    const plat = {};
    rows.forEach((r) => r.progs.forEach((p) => (progPlatforms(p) || []).forEach((x) => { plat[x] = (plat[x] || 0) + 1; })));
    let ex = [...rows.slice(0, 2).map((r) => r.f.name), ...Object.entries(plat).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([x]) => x), S.country ? C.name(S.country) : null]
      .filter(Boolean).map((x) => `Try “${x}”`);
    const fits = (t) => { const cs = getComputedStyle(q), ctx = (fits.c || (fits.c = document.createElement("canvas").getContext("2d"))); ctx.font = cs.font; return ctx.measureText(t).width <= q.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 4; };
    if (!ex.length) return;
    let i = 0;
    const tick = () => {
      if (!q.isConnected) { clearInterval(timer); return; }
      if (q.value || document.activeElement === q || document.hidden) return;
      const list = [phDefault(), ...ex.filter(fits)];
      q.classList.add("ph-out");
      setTimeout(() => { i = (i + 1) % list.length; q.placeholder = list[i]; q.classList.remove("ph-out"); }, 260);
    };
    const timer = setInterval(tick, 3200);
  }

  // result counts roll from the number on screen to the new one, and the dot pings when they change
  function rollTo(el, from, to) {
    if (!el || from == null || isNaN(from) || from === to || reducedMotion()) { if (el) el.textContent = to; return; }
    const t0 = performance.now(), dur = 520;
    const step = (t) => {
      if (!el.isConnected) return;
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  let liveT;

  /* ------------------------------------------------------------------ offers (official codes only) */
  // An offer shows only while it is live: not past its stated end, and re-checked within the last week
  // (offers change weekly, so an older check is not trusted).
  const OFFER_FRESH_DAYS = 7;
  const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
  function liveOffers(f) {
    const today = isoDay(Date.now()), cut = isoDay(Date.now() - OFFER_FRESH_DAYS * 864e5);
    return (f.offers || []).filter((o) => (!o.ends || o.ends >= today) && (!o.checked || o.checked >= cut)).sort((a, b) => offPct(b) - offPct(a));
  }
  const offPct = (o) => { const m = /(\d+(?:\.\d+)?)\s*%/.exec(o.discount || ""); return m ? +m[1] : 0; };
  // one entry per firm: its best live offer, plus how many more it has
  const sectionOffers = () => firms.filter((f) => f.status === "active").map((f) => { const os = liveOffers(f); return os.length ? [f, os[0], os.length - 1] : null; }).filter(Boolean)
    .sort((a, b) => offPct(b[1]) - offPct(a[1]) || (b[0].rating ? b[0].rating.score : 0) - (a[0].rating ? a[0].rating.score : 0));
  function endsIn(o) {
    if (!o.ends) return "No end date given";
    const ms = new Date(o.ends + "T23:59:59").getTime() - Date.now();
    if (ms < 864e5) return "Ends today";
    const d = Math.floor(ms / 864e5);
    return d <= 7 ? `Ends in ${d} day${d === 1 ? "" : "s"}` : `Ends ${fmtDate(o.ends)}`;
  }
  // A deal applies the firm's own code to a list price, the way comparison sites show "price with code". Only a scope
  // checked on the firm's own page changes a price: the programs and sizes it lists (`sizes`), every account it sells
  // in the offer's markets (`scope: "all"`), or a price it publishes for one account (`fixedPrices`). The code must
  // state one plain percentage ("25% off"). Any other offer still shows its badge but never touches a price.
  const NEW_ONLY = /\b(first (?:purchase|order|account|challenge|evaluation|buy)|new (?:customers?|clients?|traders?|users?|accounts?))\b/i;
  const isNewOnly = (o) => o.newOnly ?? NEW_ONLY.test(`${o.appliesTo || ""} ${o.headline || ""}`);
  function dealFor(f, p, size) {
    if (!f || !p) return null;
    const key = f.id + "|" + SEC.id + "|" + p._i + "|" + (size || "");
    if (dealCache.has(key)) return dealCache.get(key);
    let deal = null;
    for (const o of liveOffers(f)) {
      if (o.noPrice) continue;
      const newOnly = isNewOnly(o);
      // a price the firm publishes for one account with this code
      const fx = (o.fixedPrices || []).find((x) => x.program === p.name && x.size === size);
      if (fx) { deal = { fixed: fx.price, code: o.code || null, offer: o, newOnly }; break; }
      const m = /^(\d+(?:\.\d+)?)\s*%\s*off$/i.exec((o.discount || "").trim());
      if (!m || +m[1] <= 0 || +m[1] >= 100) continue;
      if (o.markets && o.markets.length && !o.markets.includes(p.market) && !(p.perps && o.markets.includes("perps"))) continue;
      if (o.sizes ? !(o.sizes[p.name] || []).includes(size) : o.scope !== "all") continue;
      deal = { pct: +m[1], code: o.code || null, offer: o, newOnly };
      break;
    }
    dealCache.set(key, deal);
    return deal;
  }
  const dealOffer = (d, price) => (d.fixed != null && price ? { ...d.offer, discount: `${Math.round((1 - d.fixed / price) * 100)}% off` } : d.offer);
  const dealPrice = (price, d) => (price == null || !d ? price : d.fixed != null ? d.fixed : Math.round(price * (1 - d.pct / 100) * 100) / 100);
  // the price as shown: the price after the firm's own code with the list price struck through beside it, or the
  // list price alone (suffix: a billing note such as "/mo", kept next to the price)
  function priceHTML(price, p, d, suffix = "") {
    if (price == null) return npText;
    if (!d) return `<span class="pv">${money(price, p.currency)}</span>${suffix}`;
    return `<span class="pv">${money(dealPrice(price, d), p.currency)}</span>${suffix}<s class="deal-was"><span class="sr">list price </span>${money(price, p.currency)}</s>`;
  }
  // an offer's figure for its badge, as [before, figure, after]: "20% off", "up to 70%", "1+1 free", "fee refund"
  function offerFig(o) {
    const d = `${o.discount || ""}`.trim(), num = (x) => +String(x).replace(/,/g, "");
    let m;
    if ((m = /^up to\s+(\d+(?:\.\d+)?)\s*%/i.exec(d))) return ["Up to", m[1] + "%", ""];
    if ((m = /(\d+(?:\.\d+)?)\s*%\s*off/i.exec(d))) return [/^(about|around)\b/i.test(d) ? "≈" : /^extra\b/i.test(d) ? "+" : "", m[1] + "%", "off"];
    if ((m = /([$€£])\s?([\d,]+(?:\.\d+)?)\s+instead of\s+[$€£]\s?([\d,]+(?:\.\d+)?)/i.exec(d))) return ["", m[1] + Math.round(num(m[3]) - num(m[2])), "off"];
    if ((m = /^([$€£])\s?([\d,]+(?:\.\d+)?)\s+off\b/i.exec(d))) return ["", m[1] + Math.floor(num(m[2])), "off"];
    if ((m = /buy\s*1,?\s*get\s*(\d+)/i.exec(d))) return ["", "1+" + m[1], "free"];
    if (/refund/i.test(d)) return ["", "Fee", "refund"];
    if ((m = /([$€£][\d.]+K)\b.*?\bfor\s+([$€£]\d+(?:\.\d+)?)/i.exec(d))) return [m[1] + " for", m[2], ""];
    if ((m = /(\d+(?:st|nd|rd|th))\s+account\s+free/i.exec(d))) return ["", m[1], "free"];
    if (/\bfree\b/i.test(d)) return ["", "Free", "account"];
    return ["", "Deal", ""];
  }
  // The offer badge, one component everywhere: the figure on the deal colour, the firm's own code in a small dark
  // slot that copies on click. "" on firm rows, "h" (wide) on offer cards, "xs" beside prices in tables.
  function dealBadge(f, o, size = "") {
    if (!o) return "";
    const [pre, n, post] = offerFig(o);
    const fig = `${pre ? `<small>${esc(pre)}</small>` : ""}<b>${esc(n)}</b>${post ? `<small>${esc(post)}</small>` : ""}`;
    const fresh = isNewOnly(o);
    const tip = esc([o.headline || o.discount, o.appliesTo, fresh ? "New customers" : "", o.code ? "Click to copy the code" : "No code needed"].filter(Boolean).join(" · "));
    if (o.code) {
      const len = o.code.length;
      return `<button type="button" class="db ${size}" data-copy="${esc(o.code)}" title="${tip}" aria-label="${esc(o.discount || n)}. Copy ${esc(f.name)}'s code ${esc(o.code)}"><span class="db-f">${fig}</span><span class="db-s"><span class="c ${len > 11 ? "xl" : len > 8 ? "l" : ""}">${esc(o.code)}</span><i class="db-i" aria-hidden="true">${ICON.copy}</i></span></button>`;
    }
    const inner = `<span class="db-f">${fig}</span><span class="db-s"><span class="c">${size === "h" ? "No code needed" : "No code"}</span><i class="db-i" aria-hidden="true">${ICON.check}</i></span>`;
    return size === "h" ? `<div class="db h auto" title="${tip}">${inner}</div>`
      : `<a class="db ${size} auto" href="${href("firm/" + f.id)}#offers" title="${tip}" aria-label="${esc(o.discount || n)} at ${esc(f.name)}, no code needed">${inner}</a>`;
  }
  const fmtDay = (d) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d || ""); return m ? `${+m[2]} ${MONTHS[+m[1] - 1]}` : fmtDate(d); };

  function offerTicket(f, o, more = null) {
    const soon = o.ends && new Date(o.ends + "T23:59:59").getTime() - Date.now() < 3 * 864e5;
    return `<article class="oc" style="--brand:${esc(f.brandColor || "#2EF2A0")}">
      <div class="oc-top"><a class="oc-firm" href="${href("firm/" + f.id)}">${logo(f)}<span><b>${esc(f.name)}</b><small>${f.rating ? `Mirror Score <em>${f.rating.score.toFixed(1)}</em>` : hqLine(f)}</small></span></a>
        ${o.ends ? `<span class="oc-end ${soon ? "soon" : ""}">${esc(endsIn(o))}</span>` : ""}</div>
      <p class="oc-head" title="${esc(o.headline)}">${esc(o.headline)}</p>
      ${o.appliesTo ? `<p class="oc-scope" title="${esc(o.appliesTo)}">${esc(o.appliesTo)}</p>` : ""}
      ${dealBadge(f, o, "h")}
      <div class="oc-foot"><a class="oc-src" href="${esc(o.source)}" target="_blank" rel="noopener nofollow" title="The firm's own page, checked ${fmtDate(o.checked)}">${ICON.shield}<span class="h">${esc(host(o.source))}</span><span class="o">Official page</span>${ICON.ext}</a><span class="oc-chk">Checked ${fmtDay(o.checked)}</span></div>
      ${more == null ? "" : `<div class="oc-more">${more ? `<a class="of-more" href="${href("firm/" + f.id)}#offers">${more} more offer${more === 1 ? "" : "s"} from ${esc(f.name)} ${ICON.arrow}</a>` : ""}</div>`}
    </article>`;
  }
  function offerPanel(f) {
    const offs = liveOffers(f);
    if (!offs.length) return "";
    return `<section class="of-panel" id="offers" data-reveal><div class="of-ph"><h2>Live offers</h2><p>Codes published by ${esc(f.name)} on its own site. No affiliate or creator codes.</p></div>
      <div class="of-grid">${offs.map((o) => offerTicket(f, o)).join("")}</div></section>`;
  }
  function viewOffers() {
    const list = sectionOffers();
    const newest = list.reduce((d, [, o]) => (o.checked && o.checked > d ? o.checked : d), "");
    document.title = `Live ${SEC.noun} prop firm offers — Prop Firm Mirror`;
    app.innerHTML = `<div class="page-head" data-reveal><div class="eyebrow">${esc(SEC.label)} offers</div><h1 data-split>Live offers, official codes.</h1>
      <p>Every code here is published by the firm itself, on its own website. No affiliate, creator or partner codes, and we earn nothing from any of them.${newest ? ` Last checked ${fmtDate(newest)}.` : ""} Offers can end early, so confirm the price at checkout.</p></div>
      ${list.length ? `<div class="of-grid big" data-stagger>${list.map(([f, o, more]) => offerTicket(f, o, more)).join("")}</div>`
        : `<div class="empty">No official offers are live for ${esc(SEC.noun)} firms right now.</div>`}`;
  }

  function changeCard(c) {
    return `<a class="chg-card glass spot" data-tilt="6" href="${href("firm/" + c.firm.id)}" title="${esc(c.title)}">
      <div class="meta">${logo(c.firm, "sm")}<span class="nm">${esc(c.firm.name)}</span><span class="dt">${fmtDate(c.date)}</span></div>
      <div class="t">${esc(c.title)}</div>
      <div class="src">Source · ${esc(host(c.source))}</div></a>`;
  }

  function renderAvail() {
    const ab = $("#availBtn"); if (!ab) return;
    if (S.country) {
      const on = S.avail !== "all";
      if (ab.dataset.k !== S.country) {
        ab.dataset.k = S.country;
        ab.innerHTML = `<span class="coin">${C.flag(S.country)}</span><span class="lbl"><small></small><b>${esc(C.name(S.country))}</b></span><span class="sw" aria-hidden="true"></span>`;
        ab.setAttribute("role", "switch"); ab.removeAttribute("aria-haspopup");
      }
      $("small", ab).textContent = S.avail === "confirmed" ? "Confirmed in" : "Available in";
      ab.setAttribute("aria-checked", on);
      ab.classList.toggle("on", on);
      ab.title = on ? `Showing only firms that don't restrict ${C.name(S.country)}` : `Hide firms that restrict ${C.name(S.country)}`;
    } else if (ab.dataset.k !== "") {
      ab.dataset.k = "";
      ab.innerHTML = `<span class="coin">${ICON.globe}</span><span class="lbl"><small>Choose</small><b>your country</b></span>`;
      ab.removeAttribute("role"); ab.removeAttribute("aria-checked"); ab.setAttribute("aria-haspopup", "dialog");
      ab.classList.remove("on"); ab.title = "Choose the country you trade from";
    }
  }

  function renderResults(opts = {}) {
    if (!$("#results")) return;
    syncRails();
    renderAvail();

    // active filter pills
    const pills = [];
    if (S.q) pills.push(["q", `“${esc(S.q)}”`]);
    S.models.forEach((m) => pills.push(["model:" + m, MODEL_LABEL[m] || m]));
    S.dd.forEach((d) => pills.push(["dd:" + d, DD_LABEL[d] || d]));
    S.platforms.forEach((p) => pills.push(["plat:" + p, esc(p)]));
    if (S.news) pills.push(["news", "News allowed"]);
    if (S.eas) pills.push(["eas", "EAs allowed"]);
    if (S.weekend) pills.push(["weekend", "Weekend holding"]);
    if (S.noConsistency) pills.push(["noConsistency", "No consistency rule"]);
    if (S.noDaily) pills.push(["noDaily", "No daily loss limit"]);
    if (S.country && S.avail !== "all") pills.push(["avail", `${C.flag(S.country)} ${S.avail === "confirmed" ? "Confirmed available" : "Not restricted"} in ${esc(C.name(S.country))}`]);
    if (S.showClosed) pills.push(["showClosed", "Showing closed firms"]);
    $("#activeFilters").innerHTML = pills.map(([k, l]) => `<button class="chip on" data-pill="${esc(k)}"><span class="sr">Remove filter: </span><span class="t">${l}</span><span class="x" aria-hidden="true">${ICON.x}</span></button>`).join("") +
      (pills.length > 1 ? `<button class="chip" data-pill="*">Clear all</button>` : "");
    $$("#activeFilters [data-pill]").forEach((b) => b.addEventListener("click", () => {
      const i = $$("#activeFilters [data-pill]").indexOf(b);
      clearPill(b.dataset.pill); renderResults();
      const left = $$("#activeFilters [data-pill]"); (left[i] || left[left.length - 1] || $("#filterBtn")).focus({ preventScroll: true });
    }));
    syncSort();
    const fc = S.models.size + S.dd.size + S.platforms.size + [S.news, S.eas, S.weekend, S.noConsistency, S.noDaily, S.showClosed].filter(Boolean).length;
    const fb = $("#fCount");
    $("#filterBtn").setAttribute("aria-label", fc ? `Filters, ${fc} active` : "Filters");
    if (fb.textContent !== String(fc)) {
      fb.hidden = !fc; fb.textContent = fc;
      if (fc && fb.animate && !reducedMotion()) fb.animate([{ transform: "scale(.4)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: 0.6 }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.2, .8, .2, 1)" });
    }

    const rows = sortFirms(matching());
    const nProg = rows.reduce((n, r) => n + r.progs.length, 0);
    // counts roll from the numbers on screen; the dot pings when they change
    const shown = $$("#resultN b").slice(0, 2).map((b) => parseInt(b.textContent, 10));
    const was = shown.length === 2 && !shown.some(isNaN) ? shown : [rows.length, nProg];
    $("#resultN").innerHTML = `<b>${was[0]}</b> firm${rows.length === 1 ? "" : "s"} · <b>${was[1]}</b> program${nProg === 1 ? "" : "s"}${S.size ? ` at <b class="sz">${sizeHTML(S.size)}</b>` : ""}`;
    const nb = $$("#resultN b");
    rollTo(nb[0], was[0], rows.length); rollTo(nb[1], was[1], nProg);
    if ((was[0] !== rows.length || was[1] !== nProg) && !reducedMotion()) { const n = $("#resultN"); n.classList.remove("ping"); void n.offsetWidth; n.classList.add("ping"); }
    clearTimeout(liveT);
    liveT = setTimeout(() => { const lv = $("#resultLive"); if (lv) lv.textContent = `${rows.length} firm${rows.length === 1 ? "" : "s"}, ${nProg} program${nProg === 1 ? "" : "s"}${S.size ? " at " + sizeLabel(S.size, "") : ""}`; }, 600);

    const res = $("#results");
    res.classList.toggle("quiet", !!opts.quiet);
    if (!rows.length) {
      res.innerHTML = `<div class="empty">No firm matches these filters.${S.size ? " Try “Any” account size, or" : " Try"} clearing a filter.</div>`;
      return;
    }
    // a new filter, sort, tab or section starts again at page 1
    const sig = JSON.stringify([SEC.id, S.tab, S.size, S.sort, S.q, [...S.models], [...S.dd], [...S.platforms], S.news, S.eas, S.weekend, S.noConsistency, S.noDaily, S.showClosed, S.avail, S.country, S.view, S.tsort]);
    if (sig !== pageSig) { pageSig = sig; S.page = 1; }
    if (S.view === "challenges") {
      const all = challengeRows(rows), pg = pageOf(all.length), list = all.slice(pg.from, pg.to);
      res.innerHTML = (window.matchMedia("(max-width: 640px)").matches ? challengeCards(list) : challengeTable(list)) + pager(pg, all.length, "challenges");
    } else {
      const pg = pageOf(rows.length);
      res.innerHTML = firmList(rows.slice(pg.from, pg.to), pg.from) + pager(pg, rows.length, "firms");
    }
    $$("[data-page]", res).forEach((b) => b.addEventListener("click", () => {
      S.page = +b.dataset.page; renderResults();
      const d = $("#directory"); if (d) window.scrollTo({ top: d.getBoundingClientRect().top + scrollY - 40, behavior: "smooth" });
    }));
    bindCompareButtons(res);
    $$("[data-tsort]", res).forEach((b) => b.addEventListener("click", () => {
      const k = b.dataset.tsort; S.tsort = { key: k, dir: S.tsort.key === k ? -S.tsort.dir : k === "split" ? -1 : 1 }; renderResults();
    }));
    $$("tr[data-href], .frow[data-href]", res).forEach((tr) => tr.addEventListener("click", (e) => { if (!e.target.closest("button,a")) location.hash = tr.dataset.href; }));
    $$("[data-fsort]", res).forEach((b) => b.addEventListener("click", () => { S.sort = b.dataset.fsort; save(); syncSort(); renderResults(); }));
  }

  function clearPill(k) {
    if (k === "*") { S.q = ""; S.models.clear(); S.dd.clear(); S.platforms.clear(); S.news = S.eas = S.weekend = S.noConsistency = S.noDaily = S.showClosed = false; S.avail = "all"; const q = $("#q"); if (q) q.value = ""; save(); return; }
    if (k === "q") { S.q = ""; const q = $("#q"); if (q) q.value = ""; }
    else if (k.startsWith("model:")) S.models.delete(k.slice(6));
    else if (k.startsWith("dd:")) S.dd.delete(k.slice(3));
    else if (k.startsWith("plat:")) S.platforms.delete(k.slice(5));
    else if (k === "avail") { S.avail = "all"; save(); }
    else S[k] = false;
  }

  const pctOr = (s) => (s == null ? npText : pct(s) != null ? pct(s) + "%" : isNone(s) ? "None" : `<span class="np" title="${esc(s)}">See rules</span>`);

  // pagination: 10 firms (or 20 challenges) to a page, numbered pages underneath
  let pageSig = "";
  const PER = { firms: 10, challenges: 20 };
  function pageOf(total) {
    const per = PER[S.view] || 10, pages = Math.max(1, Math.ceil(total / per));
    S.page = Math.min(Math.max(1, S.page || 1), pages);
    return { per, pages, from: (S.page - 1) * per, to: Math.min(total, S.page * per) };
  }
  function pager(pg, total, noun) {
    if (pg.pages <= 1) return "";
    const nums = [];
    for (let i = 1; i <= pg.pages; i++) {
      if (i === 1 || i === pg.pages || Math.abs(i - S.page) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== "…") nums.push("…");
    }
    return `<nav class="pager" aria-label="Pages">
      <button type="button" class="pg-btn prev" data-page="${S.page - 1}" ${S.page === 1 ? "disabled" : ""}>${ICON.arrow}<span>Previous</span></button>
      <div class="pg-nums">${nums.map((n) => (n === "…" ? `<span class="pg-gap">…</span>` : `<button type="button" class="pg-n ${n === S.page ? "on" : ""}" data-page="${n}" ${n === S.page ? 'aria-current="page"' : ""}>${n}</button>`)).join("")}</div>
      <button type="button" class="pg-btn next" data-page="${S.page + 1}" ${S.page === pg.pages ? "disabled" : ""}><span>Next</span>${ICON.arrow}</button>
      <div class="pg-info">${pg.from + 1}–${pg.to} of ${total} ${noun}</div>
    </nav>`;
  }

  // The directory: one wide glass row per firm, the numbers of its cheapest program at the chosen size in columns.
  function firmList(rows, offset = 0) {
    const sortBtn = (k, l) => `<button type="button" tabindex="-1" data-fsort="${k}" class="${S.sort === k ? "on" : ""}">${l}<span class="ar" data-dir="${k === "name" || k === "price" ? "up" : "down"}">${ICON.sort}</span></button>`;
    return `<div class="frows-head" aria-hidden="true"><span>${sortBtn("name", "Firm")}</span><span>${sortBtn("score", "Score")}</span><span>${sortBtn("price", S.size ? sizeLabel(S.size, "") + " price" : "From")}</span><span>Target</span><span>Max DD</span><span>${sortBtn("split", "Split")}</span><span>Offer</span><span>${S.country ? `${C.flag(S.country)} ${esc(C.name(S.country))}` : "Restricted list"}</span><span></span></div>
      <div class="frows cards-anim" data-stagger>${rows.map((r, i) => firmRow(r, offset + i + 1)).join("")}</div>`;
  }
  function firmRow({ f, progs }, rank) {
    const best = cheapestDeal(f, progs);
    const deal = best ? best.deal : null;
    const rep = best ? best.p : progs[0];
    const models = [...new Set(progs.map((p) => MODEL_LABEL[p.model] || p.model))];
    const tgt = rep ? targets(rep) : null;
    const nPh = rep && rep.phases ? rep.phases.length : 0;
    const link = href("firm/" + f.id);
    const ranked = S.sort === "score" && f.rating;
    const offer = deal ? dealOffer(deal, best.price) : liveOffers(f)[0] || null;
    return `<article class="frow spot ${cmpOn(f.id) ? "sel" : ""} ${ranked && rank <= 3 ? "top" + rank : ""} ${offer ? "has-off" : ""}" style="--brand:${esc(f.brandColor || "#2EF2A0")}" data-href="${link}">
      <div class="fr-id">${ranked ? `<span class="fr-rank">${rank}</span>` : ""}${logo(f)}
        <div class="fr-nm"><h3><a href="${link}">${esc(f.name)}</a>${f.status !== "active" ? `<span class="tag ember">${esc(f.status)}</span>` : ""}</h3>
          <div class="fr-sub">${hqLine(f)}${f.parentName ? `<span class="fr-par">by ${esc(f.parentName)}</span>` : ""}</div>
          <div class="fr-tags">${models.slice(0, 4).map((m) => `<span class="tag em">${esc(m)}</span>`).join("")}${progs.length > 1 ? `<span class="fr-more">${progs.length} programs</span>` : ""}</div>
        </div>
      </div>
      <div class="fr-score">${f.rating ? scoreRing(f.rating) + `<span class="sr-l">${esc(f.rating.label)}${f.tracker && f.tracker.last30.count ? `<i class="sr-pay" title="${f.tracker.last30.count.toLocaleString("en-US")} payouts sent on-chain in the last 30 days, as counted by ${esc(f.tracker.source)}">${compact(f.tracker.last30.count)} payouts</i>` : ""}</span>` : `<span class="sr-none">Not rated yet</span>`}</div>
      <div class="fr-c fr-price"><i class="fr-k">From</i><b title="${deal ? esc(`${money(dealPrice(best.price, deal), best.p.currency)} with ${deal.code ? "code " + deal.code : "the firm's own offer"} (list price ${money(best.price, best.p.currency)})`) : ""}">${best ? priceHTML(best.price, best.p, deal, best.p.billing === "monthly" ? "<small>/mo</small>" : "") : npText}</b><span title="${esc(rep ? rep.name : "")}">${best ? sizeLabel(best.size, acctCur(best.p)) + " · " + esc(MODEL_LABEL[rep.model] || rep.model || "") : rep ? esc(rep.name) : "No programs on sale"}</span></div>
      <div class="fr-c fr-tgt"><i class="fr-k">Target</i><b title="${esc(tgt || "")}">${tgt ? esc(tgt) : npText}</b><span>${rep ? (rep.model === "instant" ? "Instant funding" : nPh ? nPh + (nPh === 1 ? " phase" : " phases") : "") : ""}</span></div>
      <div class="fr-c fr-dd"><i class="fr-k">Max DD</i><b>${rep ? pctOr(rep.maxDrawdown) : npText}</b><span>${rep ? esc(ddShort(rep.drawdownType) || "") : ""}</span></div>
      <div class="fr-c fr-split"><i class="fr-k">Split</i><b>${rep && rep.splitMax ? rep.splitMax + "%" : npText}</b><span>${rep ? "Daily " + pctOr(rep.dailyLoss) : ""}</span></div>
      <div class="fr-off">${offer ? dealBadge(f, offer) : ""}</div>
      <div class="fr-av">${S.country ? availBadge(f, S.country, false, progs) : `<span class="verified">${ICON.shield}${f.restricted.countries.length ? f.restricted.countries.length + " countries" : f.restricted.status === "published" ? "List published" : "No list published"}</span>`}
        <span class="fr-ver">${f.changes[0] ? "Changed " + fmtDate(f.changes[0].date) : "Verified " + fmtDate(f.lastVerified)}</span></div>
      <div class="fr-act">${cmpBtn(f)}<a class="fr-go" href="${link}" aria-label="Open ${esc(f.name)}">${ICON.arrow}</a></div>
    </article>`;
  }

  function challengeRows(rows) {
    const out = [];
    for (const { f, progs } of rows) for (const p of progs) {
      let price = null, size = S.size;
      if (S.size) price = priceAt(p, S.size);
      else { const c = cheapest([p], null); if (c) { price = c.price; size = c.size; } }
      const deal = dealFor(f, p, size);
      out.push({ f, p, price, size, deal });
    }
    const { key, dir } = S.tsort;
    const num = (r) => key === "price" ? dealPrice(r.price, r.deal) : key === "split" ? +r.p.splitMax || null : key === "target" ? pct(r.p.phases?.[0]?.target) : key === "daily" ? (isNone(r.p.dailyLoss) ? 999 : pct(r.p.dailyLoss)) : key === "max" ? pct(r.p.maxDrawdown) : null;
    if (key === "firm") out.sort((a, b) => dir * (a.f.name.localeCompare(b.f.name) || a.p.name.localeCompare(b.p.name)));
    else out.sort((a, b) => { const x = num(a), y = num(b); if (x == null && y == null) return a.f.name.localeCompare(b.f.name); if (x == null) return 1; if (y == null) return -1; return dir * (x - y) || a.f.name.localeCompare(b.f.name); });
    return out;
  }
  function challengeTable(list) {
    const th = (k, l) => `<th class="${S.tsort.key === k ? "sorted" : ""}"><button data-tsort="${k}">${l}<span class="ar">${S.tsort.key === k ? (S.tsort.dir > 0 ? "▲" : "▼") : ""}</span></button></th>`;
    return `<div class="tbl-wrap glass"><div class="tbl-scroll"><table class="tbl">
      <thead><tr><th class="sticky"><button data-tsort="firm">Firm / program${S.tsort.key === "firm" ? (S.tsort.dir > 0 ? " ▲" : " ▼") : ""}</button></th><th>Model</th>${th("price", S.size ? sizeLabel(S.size, "") + " price" : "Entry price")}${th("target", "Target")}${th("daily", "Daily loss")}${th("max", "Max DD")}${th("split", "Split")}<th>Payout</th><th>Min days</th><th>Consistency</th><th>Rules</th>${S.country ? `<th>${C.flag(S.country)} Access</th>` : ""}<th></th></tr></thead>
      <tbody>${list.map(({ f, p, price, size, deal }) => `<tr data-href="${href("firm/" + f.id)}?p=${p._i}">
        <td class="sticky"><div class="firm-cell">${logo(f, "sm")}<div><b>${esc(f.name)}</b><span>${esc(p.name)}</span></div></div></td>
        <td><span class="tag ${p.model === "instant" ? "em" : ""}">${esc(MODEL_LABEL[p.model] || p.model || "—")}</span> <span class="tag">${MARKET_LABEL[p.market] || ""}</span></td>
        <td><div class="price">${price != null ? priceHTML(price, p, deal) + (p.billing === "monthly" ? `<small>per month</small>` : S.size ? "" : `<small>${sizeLabel(size, acctCur(p))}</small>`) + (deal ? dealBadge(f, dealOffer(deal, price), "xs") : "") : npText}</div></td>
        <td class="num"><div class="clamp w140" style="color:inherit;font-size:13px" title="${esc(targets(p) || "")}">${targets(p) ? esc(targets(p)) : npText}</div></td>
        <td class="num">${pctOr(p.dailyLoss)}</td>
        <td class="num">${pctOr(p.maxDrawdown)} <span class="muted">${esc(ddShort(p.drawdownType) || "")}</span></td>
        <td class="num">${p.splitMax ? p.splitMax + "%" : npText}</td>
        <td>${p.payoutFrequency ? `<div class="clamp" title="${esc(p.payoutFrequency)}">${esc(p.payoutFrequency)}</div>` : npText}</td>
        <td>${p.minDays ? `<div class="clamp w140" title="${esc(p.minDays)}">${esc(p.minDays)}</div>` : npText}</td>
        <td>${p.consistency ? `<div class="clamp" title="${esc(p.consistency)}">${esc(p.consistency)}</div>` : npText}</td>
        <td><div class="dots">${dotsFor(p).replace(/>(News|EAs|Weekend)</g, (m, l) => `><span class="sr">${l}</span><`)}</div></td>
        ${S.country ? `<td>${availBadge(f, S.country, false, [p])}</td>` : ""}
        <td>${cmpBtn(f)}</td></tr>`).join("")}</tbody></table></div></div>
      <div class="legend" style="margin-top:12px"><span class="dot d-yes"><i></i>Allowed</span><span class="dot d-partial"><i></i>With conditions</span><span class="dot d-no"><i></i>Not allowed</span><span class="dot d-unknown"><i></i>Not published</span><span>Rules = news trading · EAs · weekend holding</span></div>`;
  }
  function challengeCards(list) {
    return `<div class="cards">${list.map(({ f, p, price, size, deal }) => `<article class="card glass ${cmpOn(f.id) ? "sel" : ""}">
      <div class="hd">${logo(f)}<div class="nm"><h3><a href="${href("firm/" + f.id)}?p=${p._i}">${esc(f.name)}</a></h3><div class="sub">${esc(p.name)}</div></div>${cmpBtn(f)}</div>
      <div class="mkts"><span class="tag ${p.model === "instant" ? "em" : ""}">${esc(MODEL_LABEL[p.model] || p.model)}</span><span class="tag">${MARKET_LABEL[p.market] || ""}</span>${S.size ? "" : `<span class="tag">From ${sizeLabel(size, acctCur(p))}</span>`}</div>
      <div class="kpis">
        <div class="kpi"><div class="k">Price</div><div class="v">${price != null ? priceHTML(price, p, deal, p.billing === "monthly" ? "<small>/mo</small>" : "") : npText}</div></div>
        <div class="kpi"><div class="k">Daily</div><div class="v">${pctOr(p.dailyLoss)}</div></div>
        <div class="kpi"><div class="k">Max DD</div><div class="v">${pctOr(p.maxDrawdown)}</div><div class="s">${esc(ddShort(p.drawdownType) || "")}</div></div>
        <div class="kpi"><div class="k">Split</div><div class="v">${p.splitMax ? p.splitMax + "%" : npText}</div></div>
      </div>
      ${deal ? `<div class="card-deal">${dealBadge(f, dealOffer(deal, price), "xs")}<span>${deal.code ? "Price above is with this code" : "Price above includes this offer"}</span></div>` : ""}
      <div class="rules-mini"><span style="color:var(--s55)">Target ${targets(p) ? esc(targets(p)) : "not published"}</span>${dotsFor(p)}</div>
      ${S.country ? `<div>${availBadge(f, S.country, false, [p])}</div>` : ""}
    </article>`).join("")}</div>`;
  }

  /* ------------------------------------------------------------------ filter sheet */
  let sheetOpener = null, pickerOpener = null;
  // while a dialog is open, the page behind it is inert, so focus and screen readers stay in the dialog
  const BG = "header.top, nav.secbar, #mnav, #app, footer, #tray";
  const bgInert = (on) => $$(BG).forEach((el) => { el.inert = on; });
  function openSheet() {
    if (!$("#sheet").contains(document.activeElement)) sheetOpener = document.activeElement;
    $("#sheet").inert = false; bgInert(true);
    const present = (fn) => [...new Set(allPrograms.filter((p) => tabDef(S.tab).test(p)).flatMap(fn).filter(Boolean))];
    const models = Object.keys(MODEL_LABEL).filter((m) => present((p) => [p.model]).includes(m));
    const dds = Object.keys(DD_LABEL).filter((d) => present((p) => [p.drawdownType]).includes(d));
    const platCount = new Map();
    allPrograms.filter((p) => tabDef(S.tab).test(p)).forEach((p) => progPlatforms(p).forEach((x) => platCount.set(x, (platCount.get(x) || 0) + 1)));
    const plats = [...platCount.entries()].sort((a, b) => b[1] - a[1]).map(([x]) => x);
    const tg = (key, label, hint) => `<label class="toggle"><span>${label}${hint ? `<small>${hint}</small>` : ""}</span><span class="switch"><input type="checkbox" data-t="${key}" ${S[key] ? "checked" : ""}><i></i></span></label>`;
    const sheet = $("#sheet");
    sheet.innerHTML = `
      <div class="sheet-head"><h3 id="sheetTitle">Filters</h3><button class="btn sm ghost" data-close>Close</button></div>
      <div class="grp"><h4>Your country</h4>
        <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:10px"><span>${S.country ? C.flag(S.country) + " " + esc(C.name(S.country)) : "Not set"}</span><button class="btn sm" data-pick>${S.country ? "Change" : "Choose country"}</button></div>
        ${S.country ? `<div class="opts">${[["all", "Show all firms"], ["hide", "Hide firms that restrict it"], ["confirmed", "Only confirmed: firm publishes a list and it's not on it"]].map(([k, l]) => `<button class="chip ${S.avail === k ? "on" : ""}" data-avail="${k}" style="font-family:var(--sans)">${l}</button>`).join("")}</div>` : ""}
      </div>
      ${models.length ? `<div class="grp"><h4>Challenge type</h4><div class="opts">${models.map((m) => `<button class="chip ${S.models.has(m) ? "on" : ""}" data-set="models" data-v="${m}" aria-pressed="${S.models.has(m)}">${MODEL_LABEL[m]}</button>`).join("")}</div></div>` : ""}
      ${dds.length ? `<div class="grp"><h4>Max drawdown type</h4><div class="opts">${dds.map((d) => `<button class="chip ${S.dd.has(d) ? "on" : ""}" data-set="dd" data-v="${d}" aria-pressed="${S.dd.has(d)}">${DD_LABEL[d]}</button>`).join("")}</div></div>` : ""}
      ${plats.length ? `<div class="grp"><h4>Platform</h4><div class="opts">${plats.map((x) => `<button class="chip ${S.platforms.has(x) ? "on" : ""}" data-set="platforms" data-v="${esc(x)}" aria-pressed="${S.platforms.has(x)}">${esc(x)}</button>`).join("")}</div></div>` : ""}
      <div class="grp"><h4>Trading rules</h4>
        ${tg("news", "News trading allowed", "Includes “allowed with conditions”")}
        ${tg("eas", "EAs / bots allowed", "Includes “allowed with conditions”")}
        ${tg("weekend", "Weekend holding allowed")}
        ${tg("noConsistency", "No consistency rule")}
        ${tg("noDaily", "No daily loss limit")}
        ${tg("showClosed", "Show closed or paused firms")}
      </div>
      <div class="sheet-foot"><button class="btn" data-reset>Reset</button><button class="btn primary" data-close id="sheetGo"></button></div>`;
    const count = () => { const r = matching(); $("#sheetGo").textContent = `Show ${r.length} firm${r.length === 1 ? "" : "s"}`; };
    count();
    sheet.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-close")) return closeSheet();
      if (b.hasAttribute("data-pick")) { closeSheet(); return openPicker(); }
      if (b.hasAttribute("data-reset")) { clearPill("*"); renderResults(); openSheet(); setTimeout(() => $("[data-reset]", sheet)?.focus(), 60); return; }
      if (b.dataset.avail) { S.avail = b.dataset.avail; save(); $$("[data-avail]", sheet).forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b); }); }
      if (b.dataset.set) { const set = S[b.dataset.set]; set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v); b.classList.toggle("on"); b.setAttribute("aria-pressed", b.classList.contains("on")); }
      renderResults(); count();
    };
    sheet.onchange = (e) => { const t = e.target.dataset.t; if (t) { S[t] = e.target.checked; renderResults(); count(); } };
    $("#scrim").classList.add("open"); sheet.classList.add("open"); document.documentElement.classList.add("lock");
    $("#scrim").onclick = closeSheet;
    setTimeout(() => $("button", sheet)?.focus(), 50);
  }
  function closeSheet() {
    const sh = $("#sheet"), was = sh.classList.contains("open");
    sh.classList.remove("open"); sh.inert = true;
    if (!$("#picker").classList.contains("open")) { $("#scrim").classList.remove("open"); document.documentElement.classList.remove("lock"); bgInert(false); }
    if (was && sheetOpener && sheetOpener.isConnected) sheetOpener.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ country picker */
  function openPicker() {
    const pk = $("#picker");
    if (!pk.contains(document.activeElement)) pickerOpener = document.activeElement;
    pk.inert = false; bgInert(true);
    pk.innerHTML = `<div class="ph"><h3 id="pickerTitle">Where do you trade from?</h3><p>We check each firm's own restricted-country list. Saved on this device only.</p>
      <input id="pq" type="search" placeholder="Search country…" autocomplete="off" aria-label="Search country" role="combobox" aria-controls="plist" aria-expanded="true" aria-autocomplete="list">
      <div class="opts" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${["PK", "IN", "NG", "AE", "GB", "US", "PH", "BD"].map((c) => `<button class="chip ${S.country === c ? "on" : ""}" data-cc="${c}" aria-pressed="${S.country === c}" style="font-family:var(--sans)">${C.flag(c)} ${esc(C.name(c))}</button>`).join("")}</div></div>
      <ul id="plist" role="listbox" aria-label="Countries"></ul>
      <div class="pf"><span>${C.emojiOK ? "" : "Flags shown as country codes on this system."}</span><span style="display:flex;gap:8px">${S.country ? `<button class="btn sm ghost" data-clear>Clear</button>` : ""}<button class="btn sm" data-close>Done</button></span></div>`;
    const restrictedBy = new Map();
    firms.forEach((f) => new Set([...f.restricted.countries, ...Object.values(f.restricted.byMarket || {}).flatMap((m) => m.countries)]).forEach((c) => restrictedBy.set(c, (restrictedBy.get(c) || 0) + 1)));
    let kb = -1;
    const draw = () => {
      const q = $("#pq").value.trim().toLowerCase();
      const items = C.list.filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q);
      $("#plist").innerHTML = items.map((c, i) => `<li role="none"><button role="option" tabindex="-1" id="pc-${c.code}" data-cc="${c.code}" class="${S.country === c.code ? "on" : ""} ${i === kb ? "kb" : ""}" aria-selected="${S.country === c.code}">${C.flag(c.code)}<span>${esc(c.name)}</span><span class="r">${restrictedBy.get(c.code) ? (restrictedBy.get(c.code) === 1 ? "1 firm restricts" : restrictedBy.get(c.code) + " firms restrict") : ""}</span></button></li>`).join("") || `<li class="empty" style="margin:10px">No country found</li>`;
    };
    draw();
    $("#pq").addEventListener("input", () => { kb = -1; draw(); });
    $("#pq").addEventListener("keydown", (e) => {
      const btns = $$("#plist button");
      if (e.key === "ArrowDown") { kb = Math.min(btns.length - 1, kb + 1); e.preventDefault(); draw(); $$("#plist button")[kb]?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "ArrowUp") { kb = Math.max(0, kb - 1); e.preventDefault(); draw(); $$("#plist button")[kb]?.scrollIntoView({ block: "nearest" }); }
      else if (e.key === "Enter") { e.preventDefault(); const b = btns[kb >= 0 ? kb : 0]; if (b) choose(b.dataset.cc); }
    });
    const refocus = () => { const id = pickerOpener && pickerOpener.id, el = id && document.getElementById(id); if (el) el.focus({ preventScroll: true }); };
    const choose = (cc) => { S.country = cc; save(); renderCountryChip(); closePicker(); route(); refocus(); };
    pk.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.cc) choose(b.dataset.cc);
      else if (b.hasAttribute("data-clear")) { S.country = null; S.avail = "all"; save(); renderCountryChip(); closePicker(); route(); refocus(); }
      else if (b.hasAttribute("data-close")) closePicker();
    };
    $("#scrim").classList.add("open"); pk.classList.add("open"); document.documentElement.classList.add("lock");
    $("#scrim").onclick = closePicker;
    $("#pq").focus({ preventScroll: true });
  }
  function closePicker() {
    const pk = $("#picker"), was = pk.classList.contains("open");
    pk.classList.remove("open"); pk.inert = true;
    if (!$("#sheet").classList.contains("open")) { $("#scrim").classList.remove("open"); document.documentElement.classList.remove("lock"); bgInert(false); }
    if (was && pickerOpener && pickerOpener.isConnected) pickerOpener.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------ compare selection */
  function toggleCompare(id) {
    if (cmpOn(id)) S.compare = S.compare.filter((x) => x !== id);
    else {
      if (S.compare.length >= 4) { flashTray("You can compare up to 4 firms. Remove one first."); return; }
      S.compare.push(id);
    }
    save(); renderTray(); navActive(currentNav);
  }
  function bindCompareButtons(root) {
    $$("[data-cmp]", root).forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      toggleCompare(b.dataset.cmp);
      const on = cmpOn(b.dataset.cmp);
      $$(`[data-cmp="${b.dataset.cmp}"]`).forEach((x) => { x.setAttribute("aria-pressed", on); x.innerHTML = on ? ICON.check : ICON.plus; x.closest(".card, .frow")?.classList.toggle("sel", on); });
    }));
  }
  let trayMsg = null;
  function flashTray(msg) { trayMsg = msg; renderTray(); setTimeout(() => { trayMsg = null; renderTray(); }, 2600); }
  function renderTray() {
    const t = $("#tray");
    const n = S.compare.length;
    const show = n > 0 && currentNav !== "compare";
    t.classList.toggle("show", show);
    if (!n) { t.innerHTML = ""; return; }
    t.innerHTML = `<div class="stack">${S.compare.map((id) => logo(byId[id], "sm")).join("")}</div>
      <div class="txt">${trayMsg ? esc(trayMsg) : `<b>${n}</b> of 4 selected${n < 2 ? " · add one more" : ""}`}</div>
      <button class="btn sm ghost" data-clear-cmp>Clear</button>
      <a class="btn sm primary" href="${href("compare")}" ${n < 2 ? 'aria-disabled="true"' : ""}>Compare ${n} ${ICON.arrow}</a>`;
    $("[data-clear-cmp]", t).onclick = () => { S.compare = []; save(); renderTray(); navActive(currentNav); $$("[data-cmp]").forEach((x) => { x.setAttribute("aria-pressed", false); x.innerHTML = ICON.plus; x.closest(".card, .frow")?.classList.remove("sel"); }); };
  }

  /* ------------------------------------------------------------------ compare page */
  function viewCompare() {
    const list = S.compare.map((id) => byId[id]).filter(Boolean);
    if (list.length < 2) {
      history.replaceState(null, "", href("compare") + (list.length ? "?ids=" + list[0].id : ""));
      lastHash = location.hash;
      const pool = firms.filter((f) => f.status === "active" && !cmpOn(f.id));
      app.innerHTML = `<div class="cmp-head"><div><div class="eyebrow">${esc(SEC.label)} · side by side</div><h1>Compare ${esc(SEC.noun)} firms</h1></div></div>
        <div class="glass panel cmp-empty">
          <p style="margin:0 0 6px;font-size:16px">${list.length ? `<b>${esc(list[0].name)}</b> is selected. Pick at least one more firm.` : "Pick 2 to 4 firms to compare their rules side by side."}</p>
          <p class="note" style="margin:0">Tip: use the <b>+</b> button on any firm card.</p>
          <div class="cmp-pick">${pool.map((f) => `<button data-cmp-add="${f.id}">${logo(f, "sm")}${esc(f.name)}</button>`).join("")}</div>
        </div>`;
      $$("[data-cmp-add]").forEach((b) => b.addEventListener("click", () => { toggleCompare(b.dataset.cmpAdd); viewCompare(); }));
      return;
    }
    // default program per firm: first one in the current market tab
    list.forEach((f) => {
      if (S.cmpProg[f.id] == null || !f.programs.some((x) => x._i === S.cmpProg[f.id])) {
        const p = f.programs.find((x) => tabDef(S.tab).test(x)) || f.programs[0];
        S.cmpProg[f.id] = p ? p._i : -1;
      }
    });
    const progs = list.map((f) => f.programs.find((x) => x._i === S.cmpProg[f.id]) || null);
    const sizeSet = [...new Set(progs.flatMap((p) => (p ? p.sizes.map((s) => s.size) : [])))].sort((a, b) => a - b);
    if (!S.cmpSize || !sizeSet.includes(S.cmpSize)) S.cmpSize = sizeSet.includes(S.size) ? S.size : sizeSet.includes(100000) ? 100000 : sizeSet[0] || null;
    const sz = S.cmpSize;

    const prices = progs.map((p) => (p && sz ? priceAt(p, sz) : null));
    const deals = progs.map((p, i) => (p ? dealFor(list[i], p, sz) : null));
    const eff = prices.map((x, i) => dealPrice(x, deals[i]));
    const splits = progs.map((p) => (p ? +p.splitMax || null : null));
    const minPrice = Math.min(...eff.filter((x) => x != null));
    const maxSplit = Math.max(...splits.filter((x) => x != null));
    const sameCur = new Set(progs.filter(Boolean).map((p) => p.currency)).size <= 1;

    const cell = (p, key, fmt) => (!p ? NP : fmt ? fmt(p) : val(p[key], p, key));
    const R = [];
    const sec = (t) => R.push({ sec: t });
    const row = (label, fn, raw) => R.push({ label, cells: list.map((f, i) => fn(f, progs[i], i)), raw: raw ? list.map((f, i) => raw(f, progs[i], i)) : null });

    sec("Overview");
    row("Market · type", (f, p) => (p ? `${MARKET_LABEL[p.market] || ""} · ${MODEL_LABEL[p.model] || esc(p.model)}${p.perps ? " · Perps" : ""}` : NP), (f, p) => p && p.market + p.model);
    row("Instruments", (f, p) => cell(p, "instruments"), (f, p) => p && p.instruments);
    row("Platforms", (f, p) => (p ? val(progPlatforms(p)) : NP), (f, p) => p && progPlatforms(p).join());
    row("HQ", (f) => `${hqLine(f)}${f.hq.status === "unverified" ? `<span class="unv">Unverified</span>` : ""}`, (f) => f.hq.country);
    sec(`Price & targets${sz ? " · " + sizeLabel(sz, "") + " account" : ""}`);
    row("Price", (f, p, i) => (prices[i] != null ? `<span class="big ${sameCur && eff[i] === minPrice && list.length > 1 ? "best" : ""}">${priceHTML(prices[i], p, deals[i])}</span>${p.billing === "monthly" ? " / month" : ""}${deals[i] ? `<div>${dealBadge(f, dealOffer(deals[i], prices[i]), "xs")}</div>` : ""}` : p && sz ? `<span class="np-chip">No ${sizeLabel(sz, "")} account</span>` : NP), (f, p, i) => prices[i]);
    row("Fees & notes", (f, p) => (p && p.priceNote ? esc(p.priceNote) : p ? `<span class="np">—</span>` : NP), (f, p) => p && p.priceNote);
    row("Profit target", (f, p) => (p ? (targets(p) ? `<span class="big">${esc(targets(p))}</span>` + (p.phases?.length > 1 ? `<div class="note" style="margin:4px 0 0">${p.phases.map((ph) => esc(ph.name) + ": " + esc(ph.target ?? "—")).join(" · ")}</div>` : "") : NP) : NP), (f, p) => p && targets(p));
    row("Min trading days", (f, p) => cell(p, "minDays"), (f, p) => p && p.minDays);
    row("Time limit", (f, p) => cell(p, "timeLimit"), (f, p) => p && p.timeLimit);
    sec("Risk");
    row("Daily loss", (f, p) => cell(p, "dailyLoss"), (f, p) => p && p.dailyLoss);
    row("Max drawdown", (f, p) => cell(p, "maxDrawdown"), (f, p) => p && p.maxDrawdown);
    row("Drawdown type", (f, p) => (p ? (p.drawdownType ? esc(DD_LABEL[p.drawdownType] || p.drawdownType) : NP) : NP), (f, p) => p && p.drawdownType);
    sec("Payouts");
    row("Profit split", (f, p, i) => (p ? `${p.splitMax ? `<span class="big ${splits[i] === maxSplit && list.length > 1 ? "best" : ""}">up to ${p.splitMax}%</span><br>` : ""}${val(p.profitSplit, p, "profitSplit")}` : NP), (f, p) => p && p.profitSplit);
    row("Payout frequency", (f, p) => cell(p, "payoutFrequency"), (f, p) => p && p.payoutFrequency);
    row("Payout minimum", (f, p) => cell(p, "payoutMinimum"), (f, p) => p && p.payoutMinimum);
    row("Consistency rule", (f, p) => cell(p, "consistency"), (f, p) => p && p.consistency);
    sec("Trading rules");
    for (const [k, l] of [["news", "News trading"], ["eas", "EAs / bots"], ["copyTrading", "Copy trading"], ["weekend", "Weekend holding"]])
      row(l, (f, p) => (p ? `<span class="dot d-${cls(p[k])}" style="margin-bottom:4px"><i></i>${clsLabel[cls(p[k])]}</span><br>${p[k] != null ? esc(p[k]) + unv(p, k) : ""}` : NP), (f, p) => p && p[k]);
    row("Leverage / contracts", (f, p) => cell(p, "leverage"), (f, p) => p && p.leverage);
    sec("Access & trust");
    if (S.country) row(`Available in ${esc(C.name(S.country))}`, (f, p) => availBadge(f, S.country, false, p ? [p] : null), (f, p) => availability(f, S.country, p ? [p] : null).k);
    row("Restricted countries", (f) => (f.restricted.status === "published" ? `${f.restricted.countries.length} listed<div style="margin-top:6px;line-height:1.9">${f.restricted.countries.slice(0, 18).map((c) => `<span title="${esc(C.name(c))}">${C.flag(c)}</span>`).join(" ")}${f.restricted.countries.length > 18 ? ` <span class="np">+${f.restricted.countries.length - 18}</span>` : ""}</div>` : f.restricted.status === "unverified" ? `${f.restricted.countries.length} listed <span class="unv">Unverified</span>` : `<span class="np-chip">No list published</span>`), (f) => f.restricted.countries.join());
    row("Latest rule change", (f) => (f.changes[0] ? `<span class="mono" style="color:var(--emerald);font-size:12px">${fmtDate(f.changes[0].date)}</span><br>${esc(f.changes[0].title)}` : `<span class="np">None recorded</span>`), (f) => f.changes[0]?.date);
    row("Last verified", (f) => `<span class="mono">${fmtDate(f.lastVerified)}</span>`, (f) => f.lastVerified);
    row("Sources", (f, p) => `<ul class="src-list" style="margin:0">${[...new Set([...(p?.sources || []), f.restricted.source].filter(Boolean))].slice(0, 5).map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(pathOf(u))}</a></li>`).join("")}</ul>`, () => "x");

    const tbody = R.map((r) => {
      if (r.sec) return `<tr class="sec"><td class="k">${esc(r.sec)}</td>${list.map(() => "<td></td>").join("")}</tr>`;
      const differs = r.raw && new Set(r.raw.map((x) => JSON.stringify(x ?? null))).size > 1;
      if (S.cmpDiff && r.raw && !differs) return "";
      return `<tr class="${differs ? "diff" : ""}"><td class="k">${r.label}</td>${r.cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    }).join("");

    app.innerHTML = `<div class="cmp-head">
        <div><div class="eyebrow">${esc(SEC.label)} · side by side</div><h1 data-split>${list.map((f) => esc(f.name)).join(" <span style='color:var(--s40)'>vs</span> ")}</h1></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          ${sizeSet.length ? `<div class="select"><label class="sr" for="cmpSize">Account size</label><select id="cmpSize">${sizeSet.map((s) => `<option value="${s}" ${s === sz ? "selected" : ""}>${sizeLabel(s, "")} account</option>`).join("")}</select></div>` : ""}
          <label class="toggle btn" style="height:44px;gap:10px"><span>Only differences</span><span class="switch"><input type="checkbox" id="cmpDiff" ${S.cmpDiff ? "checked" : ""}><i></i></span></label>
          ${list.length < 4 ? `<a class="btn" href="${href()}">${ICON.plus} Add firm</a>` : ""}
          <button class="btn" type="button" id="cmpCopy">Copy link</button>
        </div>
      </div>
      <div class="cmp glass" data-reveal><div class="cmp-scroll"><table>
        <colgroup><col class="lab">${list.map(() => `<col class="firm">`).join("")}</colgroup>
        <thead><tr><th class="k"></th>${list.map((f, i) => `<th><div class="ch">
          <div class="row1">${logo(f)}<div><a href="${href("firm/" + f.id)}"><b>${esc(f.name)}</b></a><div class="np" style="font-style:normal">${esc(f.domain || "")}</div></div><button class="rm" data-rm="${f.id}" aria-label="Remove ${esc(f.name)}">×</button></div>
          <div class="select"><label class="sr" for="cp-${f.id}">Program</label><select id="cp-${f.id}" data-prog="${f.id}">${f.programs.map((p) => `<option value="${p._i}" ${p._i === S.cmpProg[f.id] ? "selected" : ""}>${esc(p.name)} · ${MARKET_LABEL[p.market] || ""}</option>`).join("") || `<option>No programs</option>`}</select></div>
        </div></th>`).join("")}</tr></thead>
        <tbody>${tbody}</tbody></table></div></div>
      <p class="note">Green marks the lowest price and highest split among the columns (only when all prices are in the same currency). ≠ marks rows where the firms differ. Every value links back to the firm's own page in the Sources row and on each firm's page.</p>`;

    // keep the URL shareable: #/compare?ids=a,b,c
    history.replaceState(null, "", href("compare") + "?ids=" + S.compare.join(","));
    lastHash = location.hash;
    $("#cmpCopy").addEventListener("click", async (e) => {
      try { await navigator.clipboard.writeText(location.href); e.target.textContent = "Link copied"; } catch (err) { e.target.textContent = "Copy the address bar"; }
      setTimeout(() => { e.target.textContent = "Copy link"; }, 2200);
    });
    $("#cmpSize")?.addEventListener("change", (e) => { S.cmpSize = +e.target.value; viewCompare(); });
    $("#cmpDiff").addEventListener("change", (e) => { S.cmpDiff = e.target.checked; viewCompare(); });
    $$("[data-prog]").forEach((s) => s.addEventListener("change", () => { S.cmpProg[s.dataset.prog] = +s.value; viewCompare(); }));
    $$("[data-rm]").forEach((b) => b.addEventListener("click", () => { toggleCompare(b.dataset.rm); viewCompare(); }));
  }

  /* ------------------------------------------------------------------ firm detail */
  const RULES = [
    ["phases", "Profit target"], ["dailyLoss", "Daily loss"], ["maxDrawdown", "Max drawdown"], ["drawdownType", "Drawdown type"],
    ["profitSplit", "Profit split"], ["payoutFrequency", "Payout frequency"], ["payoutMinimum", "Payout minimum"], ["minDays", "Min trading days"],
    ["timeLimit", "Time limit"], ["consistency", "Consistency rule"], ["news", "News trading"], ["eas", "EAs / bots"],
    ["copyTrading", "Copy trading"], ["weekend", "Weekend holding"], ["leverage", "Leverage / contracts"], ["platforms", "Platforms"],
    ["instruments", "Instruments"], ["billing", "Billing"],
  ];
  function ruleValue(p, key) {
    if (key === "phases") {
      if (!p.phases || !p.phases.length) return p.model === "instant" ? "No evaluation — funded from day one" : NP;
      return p.phases.map((ph) => `<span class="big">${esc(ph.target ?? "—")}</span> <span class="np" style="font-style:normal">${esc(ph.name)}</span>`).join("<br>") + unv(p, "phases");
    }
    if (key === "drawdownType") return p.drawdownType ? esc(DD_LABEL[p.drawdownType] || p.drawdownType) + unv(p, key) : NP;
    if (key === "platforms") return val(progPlatforms(p), p, key);
    if (key === "billing") return p.billing ? (p.billing === "monthly" ? "Monthly subscription" : "One-time fee") + (p.priceNote ? `<div class="note" style="margin:4px 0 0">${esc(p.priceNote)}</div>` : "") : NP;
    if (["news", "eas", "copyTrading", "weekend"].includes(key) && p[key] != null) return `<span class="dot d-${cls(p[key])}"><i></i></span> ${esc(p[key])}${unv(p, key)}`;
    return val(p[key], p, key);
  }
  function viewFirm(id, params) {
    const f = byId[id];
    if (!f) {
      // the firm exists but sells nothing in this section: point to the sections where it does
      const m = ALL_BY_ID[id];
      const where = m ? SECTIONS.filter((x) => m.programs.some(x.test)) : [];
      app.innerHTML = `<div class="page-head"><div class="eyebrow">${esc(SEC.label)}</div><h1>${m ? `${esc(m.name)} has no ${esc(SEC.noun)} programs` : "Firm not found"}</h1>
        <p>${where.length ? `See it in ${where.map((x) => `<a class="link" href="${"#/" + [x.path, "firm", id].filter(Boolean).join("/")}">${esc(x.label)}</a>`).join(" · ")}, or ` : ""}<a class="link" href="${href()}">browse ${esc(SEC.noun)} firms</a>.</p></div>`;
      return;
    }
    document.title = `${f.name} rules, prices & restricted countries — Prop Firm Mirror`;
    const progOf = (i) => f.programs.find((x) => x._i === i);
    let pi = params.get("p") != null ? +params.get("p") : (f.programs.find((p) => tabDef(S.tab).test(p)) || f.programs[0] || {})._i;
    if (!progOf(pi)) pi = (f.programs[0] || {})._i;
    const r = f.restricted;
    const restrictedSorted = r.countries.map((c) => ({ c, n: C.name(c) })).sort((a, b) => a.n.localeCompare(b.n));
    const allSources = [...(f.sources || [])];
    const a = availability(f);

    app.innerHTML = `
      <div class="crumbs"><a href="${href()}">${esc(SEC.label)} firms</a><span>/</span><span>${esc(f.name)}</span></div>
      <section class="d-head glass spot" data-reveal data-tilt="2" style="--brand:${esc(f.brandColor || "#2EF2A0")}">
        <div class="d-aura" aria-hidden="true"></div>
        <div class="d-logo3d">${logo(f, "lg")}</div>
        <div>
          <h1 data-split>${esc(f.name)}${f.status !== "active" ? `<span class="tag ember" style="font-size:12px">${esc(f.status)}</span>` : ""}</h1>
          <div class="facts">
            <span><span class="k">HQ</span>${hqLine(f)}${f.hq.city ? `<span style="color:var(--s55)">· ${esc(f.hq.city)}</span>` : ""}${f.hq.status === "unverified" ? `<span class="unv">Unverified</span>` : ""}</span>
            ${f.founded ? `<span><span class="k">Founded</span>${esc(f.founded)}</span>` : ""}
            <span><span class="k">Markets</span>${(f.markets || []).map((m) => MARKET_LABEL[m] || m).join(" · ") || "—"}</span>
            <span><span class="k">Verified</span><span class="mono">${fmtDate(f.lastVerified)}</span></span>
          </div>
          ${f.hq.entity ? `<div class="note" style="margin-top:8px">Legal entity: <b>${esc(f.hq.entity)}</b>${f.hq.source ? ` · <a class="link" style="font-size:12.5px" href="${esc(f.hq.source)}" target="_blank" rel="noopener nofollow">source ${ICON.ext}</a>` : ""}</div>` : ""}
        </div>
        <div class="d-actions">
          <button class="btn ${cmpOn(f.id) ? "" : "primary"}" id="dCmp">${cmpOn(f.id) ? ICON.check + " In compare" : ICON.plus + " Add to compare"}</button>
          ${f.website && f.status === "active" ? `<a class="btn" href="${esc(f.website)}" target="_blank" rel="noopener nofollow">Official site ${ICON.ext}</a>` : ""}
        </div>
      </section>

      ${f.disclosure ? `<div class="disclosure" data-reveal><b>Disclosure.</b> ${esc(f.disclosure)}</div>` : ""}
      ${offerPanel(f)}
      ${trackerPanel(f)}
      ${scorePanel(f)}
      <div class="d-grid">
        <div>
          <section class="panel glass spot" data-reveal id="programs">
            <h2>Programs <span class="r">${f.programs.length} current</span></h2>
            ${f.programs.length ? `<div class="ptabs" role="tablist">${f.programs.map((p) => `<button class="ptab ${p._i === pi ? "on" : ""}" role="tab" aria-selected="${p._i === pi}" data-pi="${p._i}">${esc(p.name)}<span class="tag">${MARKET_LABEL[p.market] || ""}</span></button>`).join("")}</div><div id="progBody"></div>` : `<div class="empty">No programs on sale${f.status !== "active" ? " — this firm is " + esc(f.status) : ""}.</div>`}
          </section>

          <section class="panel glass spot" data-reveal>
            <h2>Latest rule changes <span class="r">${f.changes.length ? "From the firm's own announcements" : ""}</span></h2>
            ${f.changes.length ? `<ul class="timeline">${f.changes.map((c) => `<li><div class="dt">${fmtDate(c.date)}${c.market ? " · " + (MARKET_LABEL[c.market] || esc(c.market)) : ""}</div><div class="t">${esc(c.title)}</div>${c.detail ? `<div class="d">${esc(c.detail)}</div>` : ""}<div class="s"><a href="${esc(c.source)}" target="_blank" rel="noopener nofollow">Source: ${esc(pathOf(c.source))}</a></div></li>`).join("")}</ul>` : `<div class="empty">No dated rule changes found on ${esc(f.name)}'s own pages. We don't list changes we can't date and source.</div>`}
          </section>

          ${(f.notes || []).length ? `<section class="panel glass spot" data-reveal><h2>Good to know</h2><ul class="bullets">${f.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}
        </div>

        <aside>
          <section class="panel glass spot" data-reveal>
            <h2>${r.byMarket ? "Restricted · " + esc((f.markets || []).filter((m) => !r.byMarket[m]).map((m) => MARKET_LABEL[m] || m).join(", ") || "main list") : "Restricted countries"} <span class="r">${r.status === "published" ? r.countries.length + " listed" : r.status === "unverified" ? "Unverified" : "Not published"}</span></h2>
            ${S.country ? `<div style="margin-bottom:14px">${availBadge(f, S.country, true)}</div>` : `<button class="btn sm" id="dPick" style="margin-bottom:14px">🌐 Check my country</button>`}
            ${restrictedSorted.length ? `<div class="flags">${restrictedSorted.map(({ c, n }, i) => `<div class="${c === S.country ? "me" : ""}" style="--i:${i}">${C.flag(c)}<span>${esc(n)}</span></div>`).join("")}</div>` : `<div class="empty" style="padding:18px">${r.status === "not_published" ? `${esc(f.name)} does not publish a restricted-country list we could find. Ask the firm before you buy.` : "No countries listed."}</div>`}
            ${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}
            ${r.source ? `<ul class="src-list"><li><span class="dt">${fmtDate(r.checked)}</span><a href="${esc(r.source)}" target="_blank" rel="noopener nofollow">${esc(pathOf(r.source))}</a></li></ul>` : ""}
            ${Object.entries(r.byMarket || {}).map(([m, l]) => `<h2 style="margin:22px 0 12px">${esc(l.label || (MARKET_LABEL[m] || m) + " list")} <span class="r">${l.countries.length} listed</span></h2>
              <div class="flags">${l.countries.map((c) => ({ c, n: C.name(c) })).sort((a, b) => a.n.localeCompare(b.n)).map(({ c, n }, i) => `<div class="${c === S.country ? "me" : ""}" style="--i:${i}">${C.flag(c)}<span>${esc(n)}</span></div>`).join("")}</div>
              <p class="note">Applies to ${esc(MARKET_LABEL[m] || m)} programs instead of the list above.</p>
              ${l.source ? `<ul class="src-list"><li><span class="dt">${fmtDate(l.checked)}</span><a href="${esc(l.source)}" target="_blank" rel="noopener nofollow">${esc(pathOf(l.source))}</a></li></ul>` : ""}`).join("")}
          </section>

          ${(f.dataGaps || []).length ? `<section class="panel glass spot" data-reveal><h2>What we couldn't verify</h2><ul class="bullets">${f.dataGaps.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}

          <section class="panel glass spot" data-reveal>
            <h2>Sources <span class="r">${allSources.length} pages</span></h2>
            <ul class="src-list">${allSources.map((s) => `<li><span class="dt">${fmtDate(s.checked)}</span><a href="${esc(s.url)}" target="_blank" rel="noopener nofollow" title="${esc(s.label || "")}">${esc(s.label || pathOf(s.url))}</a></li>`).join("") || "<li>No sources recorded</li>"}</ul>
          </section>
        </aside>
      </div>`;

    const drawProg = () => {
      const p = progOf(pi);
      if (!p) return;
      $("#progBody").innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${[MARKET_LABEL[p.market], MODEL_LABEL[p.model], p.perps ? "Perpetuals" : null, p.billing === "monthly" ? "Monthly" : null].filter(Boolean).map((t) => `<span class="tag em">${esc(t)}</span>`).join("")}</div>
        ${(() => {
          const used = new Map();
          p.sizes.forEach((x) => { const d = dealFor(f, p, x.size); if (d) (used.get(d.offer) || used.set(d.offer, { d, sizes: [] }).get(d.offer)).sizes.push(x.size); });
          return [...used.values()].map(({ d, sizes }) => `<div class="deal-bar">${dealBadge(f, d.offer)}<p>${d.code ? `With ${esc(f.name)}'s own code <b>${esc(d.code)}</b>` : `${esc(f.name)}'s own offer`}: ${esc(d.offer.headline || d.offer.discount)}${d.newOnly ? " (new customers)" : ""}. Applied here to ${sizes.map((z) => sizeLabel(z, acctCur(p))).join(", ")}, with the list price struck through.</p></div>`).join("");
        })()}
        ${p.sizes.length ? `<div class="size-grid">${p.sizes.map((s, i) => `<div class="size-cell ${s.size === S.size ? "hit" : ""}" style="--i:${i}"><div class="s">${sizeLabel(s.size, acctCur(p))}</div><div class="p">${s.price != null ? priceHTML(+s.price, p, dealFor(f, p, s.size)) : npText}${p.billing === "monthly" && s.price != null ? `<small style="font-size:11px;color:var(--s55)"> /mo</small>` : ""}</div>${s.note ? `<div class="note" style="margin:2px 0 0;font-size:11.5px">${esc(s.note)}</div>` : ""}</div>`).join("")}</div>` : `<div class="empty" style="margin-bottom:16px">Account sizes and prices not published.</div>`}
        ${p.priceNote ? `<p class="note" style="margin:-6px 0 16px">${esc(p.priceNote)}</p>` : ""}
        <div class="rules">${RULES.map(([k, l]) => `<div class="rule"><div class="k">${l}</div><div class="v">${ruleValue(p, k)}</div></div>`).join("")}</div>
        <ul class="src-list">${(p.sources || []).map((u) => `<li><span class="dt">${fmtDate(p.checked)}</span><a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(pathOf(u))}</a></li>`).join("")}</ul>`;
    };
    if (f.programs.length) drawProg();
    $$("[data-pi]").forEach((b) => b.addEventListener("click", () => {
      pi = +b.dataset.pi; $$("[data-pi]").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-selected", x === b); }); drawProg();
      history.replaceState(null, "", `${href("firm/" + f.id)}?p=${pi}`);
    }));
    $("#dCmp").addEventListener("click", () => { toggleCompare(f.id); const on = cmpOn(f.id); $("#dCmp").innerHTML = on ? ICON.check + " In compare" : ICON.plus + " Add to compare"; $("#dCmp").classList.toggle("primary", !on); });
    $("#dPick")?.addEventListener("click", openPicker);
  }

  /* ------------------------------------------------------------------ changes feed */
  let feedMarket = "all", feedQ = "";
  function viewChanges() {
    const markets = [...new Set(allChanges.map((c) => c.market).filter(Boolean))];
    app.innerHTML = `<div class="page-head" data-reveal><div class="eyebrow">${esc(SEC.label)} rule changes</div><h1 data-split>What changed, and when.</h1>
      <p>Every change here was announced by the firm itself. Each one links to the firm's own page so you can read the exact wording.</p></div>
      <div class="toolbar deck">
        <label class="search"><span class="sr">Search changes</span>${ICON.search}<input id="fq" type="search" placeholder="Search firm or rule…" value="${esc(feedQ)}"></label>
      </div>
      <div class="sizes" id="feedTabs"><span class="lab">Market</span>${["all", ...markets].map((m) => `<button class="chip ${feedMarket === m ? "on" : ""}" data-fm="${m}">${m === "all" ? "All" : MARKET_LABEL[m] || esc(m)}</button>`).join("")}</div>
      <div id="feed"></div>`;
    const draw = () => {
      const q = feedQ.toLowerCase();
      const items = allChanges.filter((c) => (feedMarket === "all" || c.market === feedMarket) && (!q || (c.firm.name + " " + c.title + " " + (c.detail || "")).toLowerCase().includes(q)));
      if (!items.length) { $("#feed").innerHTML = `<div class="empty" style="margin-top:20px">No changes match.</div>`; return; }
      const groups = new Map();
      items.forEach((c) => { const k = c.date.slice(0, 7); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
      $("#feed").innerHTML = [...groups.entries()].map(([k, list]) => `<section class="feed-month"><h3>${MONTHS_LONG[+k.slice(5, 7) - 1]} ${k.slice(0, 4)} · ${list.length}</h3>
        ${list.map((c) => `<article class="feed-item glass spot" data-reveal><div class="dt">${fmtDate(c.date)}</div>${logo(c.firm)}
          <div><div class="firm"><a href="${href("firm/" + c.firm.id)}">${esc(c.firm.name)}</a>${c.market ? `<span class="tag">${MARKET_LABEL[c.market] || esc(c.market)}</span>` : ""}</div>
          <div class="t">${esc(c.title)}</div>${c.detail ? `<div class="d">${esc(c.detail)}</div>` : ""}</div>
          <a class="go" href="${esc(c.source)}" target="_blank" rel="noopener nofollow">${esc(host(c.source))} ${ICON.ext}</a></article>`).join("")}</section>`).join("");
    };
    draw();
    $("#fq").addEventListener("input", (e) => { feedQ = e.target.value.trim(); draw(); });
    $$("[data-fm]").forEach((b) => b.addEventListener("click", () => { feedMarket = b.dataset.fm; $$("[data-fm]").forEach((x) => x.classList.toggle("on", x === b)); draw(); }));
  }

  /* ------------------------------------------------------------------ method */
  function viewMethod() {
    const rows = [...ALL].sort((a, b) => a.name.localeCompare(b.name));
    const nSources = ALL.reduce((n, f) => n + (f.sources || []).length, 0);
    const nUnv = ALL.flatMap((f) => f.programs).reduce((n, p) => n + (p.unverified || []).length, 0);
    app.innerHTML = `<div class="page-head" data-reveal><div class="eyebrow">How we verify</div><h1 data-split>Trust is the product.</h1>
      <p>Prop Firm Mirror shows what each firm says about itself — nothing more. Here is exactly how the data is collected and what the labels mean.</p></div>
      <div class="prose">
        <h2>Where the facts come from</h2>
        <p>Only the firm's own website, help centre, FAQ, terms or official announcements. Help centres the firm runs on Intercom, Zendesk or GitBook count as its own pages. Review sites, comparison sites, YouTube, Reddit and Discord screenshots are never used as a source.</p>
        <h2>Every fact has a link and a date</h2>
        <p>Each program lists the pages its rules came from and the day we checked them. Restricted-country lists, HQ details and rule changes each carry their own source. The full list is in the data log <a class="link" href="SOURCES.md" target="_blank" rel="noopener">SOURCES.md</a>.</p>
        <h2>What the labels mean</h2>
        <div class="legend"><span>${NP} the firm doesn't publish it, or we couldn't find it on its own pages</span></div>
        <div class="legend"><span><span class="unv" style="margin-left:0">Unverified</span> seen only in a search snippet of an official page, or two official pages disagree — see “What we couldn't verify” on the firm's page</span></div>
        <div class="legend"><span class="dot d-yes"><i></i>Allowed</span><span class="dot d-partial"><i></i>Allowed with conditions</span><span class="dot d-no"><i></i>Not allowed</span><span class="dot d-unknown"><i></i>Not published</span></div>
        <h2>Restricted countries</h2>
        <p>“Not restricted” means your country is not on the list the firm publishes. It does not mean the firm promises to accept you — payment methods and KYC can still differ. “No list published” means we could not find a list on the firm's own pages.</p>
        <h2 id="score-method">How the Mirror Score works</h2>
        <p>Each firm gets a score out of 10 in every section it sells in, so a firm's futures brand is scored on its own. Payouts and public reviews weigh the most.</p>
        <div class="w-grid">
          <div><b>35%</b><span>Payout record</span><p>Half from reviews: recent Trustpilot reviews that report a payout received or a payout problem, and dated payout incidents reported by several traders or in the news. Half from independent on-chain trackers: how many payouts the firm made in the last 30 days (Payout Junction) and on how many of those days it paid at all (FundedTrading), cross-checked with ThePropFirmGuide. A firm paying thousands of traders a month will always have a few complaints; the same complaints weigh more at fifty payouts. Firms whose payouts aren't on-chain are scored on reviews alone.</p></div>
          <div><b>35%</b><span>Public reviews</span><p>Every platform where traders rate the firm (Trustpilot, PropFirmMatch, Google and other review sites), put on one scale and weighted by how many reviews stand behind each (square root, capped at 5,000 a platform, so no single platform drowns out the rest). Small samples are pulled toward the average, platforms with fewer than 5 reviews are left out, and platforms that flag fake reviews count for a third (70%). Plus our own reading of recent reviews, YouTube and Reddit (30%).</p></div>
          <div><b>18%</b><span>Rules &amp; cost</span><p>Worked out from the firm's own published rules on this site: profit split, drawdown type, consistency rule, news and EA trading, and price against the section's median.</p></div>
          <div><b>12%</b><span>Track record</span><p>Years in business, and whether the firm publishes its HQ, legal entity, restricted-country list and dated rule changes.</p></div>
        </div>
        <p>Labels: 8.5 and up Excellent · 7.5 Very good · 6.5 Good · 5.5 Mixed · 4 Caution · below 4 High risk. Every score links to the reviews and reports behind it on the firm's page, with the date we checked. X (Twitter) needs a login we don't use, so X is only counted where posts are publicly indexed. Scores are our opinion, not a guarantee of how a firm will treat you.</p>
        <h2>What we don't do</h2>
        <p>No paid placement: firms cannot pay to be listed, scored or ranked, and the order you see is the score or the sort you pick. No affiliate links on this site.</p>
        <h2>Offers and codes</h2>
        <p>The Offers page lists only codes a firm publishes itself, on its own website: never affiliate, creator or partner codes, and we earn nothing from any of them. Each offer shows where we saw it and the date. Offers past their stated end, or not re-checked within a week, are hidden automatically. Firms change offers often, so confirm the price at checkout.</p>
        <h2>Disclosures</h2>
        <p>Prop Firm Mirror's founder is an affiliate partner of Lenvra. Lenvra is scored with exactly the same method and evidence as every other firm, and its page says so.</p>
        <h2>Updating the data</h2>
        <p>Each firm is one JSON file in <code>data/firms/</code>. After an edit, run <code>node tools/build-data.mjs</code> to validate every file and rebuild the site data and the data log.</p>
      </div>
      <section class="panel glass spot" data-reveal style="margin-top:30px">
        <h2>Data log <span class="r">${ALL.length} firms · ${nSources} source pages · ${nUnv} unverified fields</span></h2>
        <div style="overflow-x:auto"><table class="log"><thead><tr><th>Firm</th><th>Last verified</th><th>Sources</th><th>Restricted list</th><th>Rule changes</th><th>Gaps</th></tr></thead>
        <tbody>${rows.map((f) => `<tr><td><a href="${homeHref(f)}" style="display:flex;gap:10px;align-items:center">${logo(f, "sm")}<b style="font-weight:600">${esc(f.name)}</b></a></td><td class="num">${fmtDate(f.lastVerified)}</td><td class="num">${(f.sources || []).length}</td><td>${f.restricted.status === "published" ? `<span class="tag em">${f.restricted.countries.length} countries</span>` : f.restricted.status === "unverified" ? `<span class="tag sand">Unverified</span>` : `<span class="tag">Not published</span>`}</td><td class="num">${f.changes.length}</td><td class="num">${(f.dataGaps || []).length}</td></tr>`).join("")}</tbody></table></div>
        <p class="note">Data built ${DATA.generated ? fmtDate(DATA.generated.slice(0, 10)) : "—"}.</p>
      </section>`;
  }

  /* ------------------------------------------------------------------ privacy & disclaimer */
  function viewLegal() {
    app.innerHTML = `<div class="page-head" data-reveal><div class="eyebrow">Privacy &amp; disclaimer</div><h1 data-split>Plain and simple.</h1>
      <p>What this site stores, what it loads from other sites, and what its information is — and is not.</p></div>
      <div class="prose">
        <h2>Privacy</h2>
        ${(window.PFM_CONFIG || {}).ga4 ? `<p>There are no accounts, sign-ups, forms or ads on this site. To see how many people visit, which pages they read and which firm links they open, we use Google Analytics. It stores a first-party cookie and sends Google the page, the referring site, your browser type and your approximate location. We don't use it for advertising and we don't sell data. In the EU, the UK and Switzerland it stays off until you accept. <span data-consent-state></span></p><p><button type="button" class="btn" data-consent="no">Turn analytics off</button> <button type="button" class="btn" data-consent="yes">Allow analytics</button></p>` : UMAMI ? `<p>There are no accounts, sign-ups, forms, cookies or ads on this site. To see how many people visit and which pages they read, we count visits with Umami, a privacy-friendly analytics service that sets no cookies, keeps no IP address and builds no profile of you. It records the page, the referring site, your browser type and your country, stored in the EU. Nothing else you do here is sent to us.</p>` : `<p>There are no accounts, sign-ups, forms, cookies, ads or analytics on this site. Nothing you do here is sent to us.</p>`}
        <p>Your choices — market tab, account size, sort, view, your country, the availability filter and your compare list — are saved only in your own browser (local storage), so they are still there next time. Clearing your browser's site data removes them.</p>
        <p>Firm logos load from each firm's own website or from Google's public favicon service. Those services receive the normal details any browser sends when it loads an image, such as your IP address. We ask the browser not to send them the page you were on.</p>
        <p>Links to firms open the firm's own website, which has its own privacy policy.</p>
        <h2>Disclaimer</h2>
        <p>Prop Firm Mirror is an independent comparison. It is not owned or paid by any firm listed, and it has no affiliate links. The founder's one partnership (Lenvra) is disclosed on that firm's page, and Lenvra is scored with the same method as every other firm.</p>
        <p>Everything here is general information, not financial advice. Prop firm rules and prices change often; each fact shows the date we checked it. Always confirm on the firm's own page before you buy.</p>
        <p>The Mirror Score is Prop Firm Mirror's opinion, based on public reviews, trader reports and each firm's published rules on the dates shown. It is not a guarantee of how a firm will treat you.</p>
        <p>Firm names, logos and trademarks belong to their owners and are shown only to identify each firm.</p>
        <h2>Corrections and contact</h2>
        <p>Spotted something out of date? Tell us on X at <a class="link" href="https://x.com/PropFirmMirror" target="_blank" rel="noopener">@PropFirmMirror</a> with a link to the firm's own page, and we will check it.</p>
      </div>`;
  }

  /* ------------------------------------------------------------------ Mirror Score */
  // Payout record 35%, public reviews 35%, rules & cost 18%, track record & transparency 12%. Payout record and our own
  // reading of recent reviews come from the dated research stored with each firm (ratings.<section>); public reviews
  // combine every platform's rating (publicRatings); the last two are worked out here from the firm's own published rules.
  const SCORE_W = { payout: 0.35, reviews: 0.35, rules: 0.18, track: 0.12 };
  const SCORE_PARTS = [["payout", "Payout record"], ["reviews", "Public reviews"], ["rules", "Rules & cost"], ["track", "Track record"]];
  // Public reviews: each platform's stars put on one 1-to-5 scale and weighted by the square root of its review count
  // (capped at 5,000, so one giant platform cannot drown out the rest), then pulled toward a neutral 3.8 by about 64
  // reviews' worth when there is little evidence. Platforms with fewer than 5 reviews are left out, and one that flags
  // fake or removed reviews counts for a third. 1 star maps to 0 and 5 stars to 10.
  const PUB_PRIOR = 3.8, PUB_K = 8, PUB_MIN = 5;
  function publicRating(f) {
    const all = (ALL_BY_ID[f.id] || {}).publicRatings || [];
    const own = all.filter((e) => e.section === SEC.id);
    const use = [...own, ...all.filter((e) => !e.section && !own.some((m) => m.platform === e.platform))];
    // the Trustpilot profile read with the section's review research counts too, if the platform list lacks it
    const tp = ((((ALL_BY_ID[f.id] || {}).ratings || {})[SEC.id]) || {}).trustpilot;
    if (tp && tp.found !== false && tp.trustScore > 0 && tp.reviews > 0 && !use.some((e) => /trustpilot/i.test(e.platform)))
      use.push({ platform: "Trustpilot", section: SEC.id, url: tp.url, rating: +tp.trustScore, outOf: 5, reviews: +tp.reviews, warning: tp.warning || null, checked: tp.checked });
    let num = 0, den = 0, n = 0;
    const rows = [];
    for (const e of use) {
      if (!(e.rating > 0) || !(e.outOf > 0) || !(e.reviews >= PUB_MIN)) continue;
      const r5 = Math.max(1, Math.min(5, (e.rating / e.outOf) * 5));
      const flagged = !!(e.warning && /fake|breach|removed|alert|suspicious|unavailable|manipulat/i.test(e.warning));
      const w = Math.sqrt(Math.min(e.reviews, 5000)) * (flagged ? 1 / 3 : 1);
      num += r5 * w; den += w; n += e.reviews;
      rows.push({ ...e, r5, flagged });
    }
    if (!den) return null;
    const r5 = (num + PUB_PRIOR * PUB_K) / (den + PUB_K);
    return { r5, score: clamp10(((r5 - 1) / 4) * 10), reviews: n, rows: rows.sort((a, b) => b.reviews - a.reviews) };
  }
  const SIZE_OF = { cfd: 100000, futures: 50000, crypto: 50000, perps: 100000 };
  const clamp10 = (x) => Math.max(0, Math.min(10, x));
  const scoreLabel = (v) => (v >= 8.5 ? "Excellent" : v >= 7.5 ? "Very good" : v >= 6.5 ? "Good" : v >= 5.5 ? "Mixed" : v >= 4 ? "Caution" : "High risk");
  const scoreBand = (v) => (v >= 7.5 ? "hi" : v >= 5.5 ? "mid" : "lo");
  const mean = (xs) => { const v = xs.filter((x) => x != null && isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  function rulesPart(f, median) {
    const ps = f.programs;
    if (!ps.length) return null;
    const split = Math.max(0, ...ps.map((p) => +p.splitMax || 0));
    const dd = mean(ps.map((p) => ({ static: 10, "eod-trailing": 7, "trailing-lock": 6, trailing: 4 })[p.drawdownType] ?? null));
    const share = (fn) => { const k = ps.map(fn).filter((v) => v !== null); return k.length ? (k.filter(Boolean).length / k.length) * 10 : null; };
    const allowed = (v) => { const c = cls(v); return c === "unknown" ? null : c !== "no"; };
    const c = cheapest(ps.filter(listPriced), SIZE_OF[SEC.id]);
    return mean([split ? clamp10(((split - 60) / 40) * 10) : null, dd,
      share((p) => (p.consistency == null || /^not published/i.test(p.consistency) ? null : consistencyNone(p.consistency))),
      share((p) => allowed(p.news)), share((p) => allowed(p.eas)),
      c && median ? clamp10(10 - (c.price / median - 0.6) * 10) : null]);
  }
  function trackPart(f) {
    const yrs = f.founded ? 2026 - parseInt(f.founded, 10) : NaN;
    const age = isNaN(yrs) ? 4 : yrs >= 6 ? 10 : yrs >= 4 ? 8 : yrs >= 2 ? 6 : yrs >= 1 ? 4.5 : 3;
    const open = [f.hq && f.hq.status === "verified", !!(f.hq && f.hq.entity), f.restricted.status === "published", f.changes.length > 0].filter(Boolean).length * 2.5;
    return mean([age, open]);
  }
  // payouts sent on-chain in the last 30 days (Payout Junction's count) → 0–10
  const volumeScore = (n) => (n >= 10000 ? 10 : n >= 3000 ? 9.5 : n >= 1000 ? 9 : n >= 500 ? 8.5 : n >= 200 ? 8 : n >= 100 ? 7.5 : n >= 30 ? 7 : n >= 1 ? 6 : null);
  const compact = (n) => (n >= 1e6 ? +(n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + "M" : n >= 1e3 ? +(n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + "K" : String(n));
  function rateSection() {
    const prices = firms.map((f) => cheapest(f.programs.filter(listPriced), SIZE_OF[SEC.id])).filter(Boolean).map((x) => x.price).sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : null;
    firms.forEach((f) => {
      const r = ((ALL_BY_ID[f.id] || {}).ratings || {})[SEC.id];
      if (!r || !r.scores || r.scores.payout == null) { f.rating = null; return; }
      // Payout record: what reviews report, balanced by how many payouts the firm verifiably makes. A firm paying
      // thousands of traders a month will always have a few complaints; the same complaints weigh more at 50 payouts.
      const count = f.tracker && f.tracker.last30 ? f.tracker.last30.count : null;
      const cad = f.cadence ? (f.cadence.daysPaid / 30) * 10 : null;
      const vol = mean([count ? volumeScore(count) : null, cad]);
      const fromReviews = clamp10(+r.scores.payout);
      // public reviews: every platform's rating (70%) with our own reading of recent reviews (30%)
      const pub = publicRating(f), read = r.scores.sentiment != null ? clamp10(+r.scores.sentiment) : null;
      const reviews = pub && read != null ? pub.score * 0.7 + read * 0.3 : pub ? pub.score : read;
      const parts = { payout: vol == null ? fromReviews : (fromReviews + vol) / 2, reviews, rules: rulesPart(f, median), track: trackPart(f) };
      let sum = 0, w = 0;
      for (const k in SCORE_W) if (parts[k] != null) { sum += parts[k] * SCORE_W[k]; w += SCORE_W[k]; }
      const score = Math.round((sum / w) * 10) / 10;
      f.rating = { ...r, parts, fromReviews, vol, pub, read, score, label: scoreLabel(score), band: scoreBand(score) };
    });
  }
  const RC = 2 * Math.PI * 19;
  const scoreRing = (r, big = false) => `<div class="sring ${big ? "big" : ""} b-${r.band}" title="Mirror Score ${r.score.toFixed(1)} of 10 · ${esc(r.label)}">
      <svg viewBox="0 0 44 44" aria-hidden="true"><circle class="sr-t" r="19" cx="22" cy="22"/><circle class="sr-v" r="19" cx="22" cy="22" style="--len:${((r.score / 10) * RC).toFixed(2)};--c:${RC.toFixed(2)}"/></svg>
      <b>${r.score.toFixed(1)}</b></div>`;

  // Payout tracker: payouts independent trackers have matched to public blockchain transactions, cross-checked.
  // The firm page's payout section. What public evidence can honestly show: each independent tracker's own count of
  // payouts sent on-chain (side by side, never added up or merged), the dated history of our checks, the firm's own
  // terms (marked as not verified), and what these numbers cannot show. Approval times need traders' own reports.
  const usdShort = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : money(n));
  function sparkline(hist) {
    const pts = (hist || []).filter((h) => h.count != null).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (pts.length < 2) return "";
    const max = Math.max(...pts.map((h) => h.count)), min = Math.min(...pts.map((h) => h.count)), span = max - min || 1;
    const xy = pts.map((h, i) => `${((i / (pts.length - 1)) * 100).toFixed(1)},${(26 - ((h.count - min) / span) * 22).toFixed(1)}`).join(" ");
    return `<svg class="pt-spark" viewBox="0 0 100 30" preserveAspectRatio="none" role="img" aria-label="30-day payout count at each of our ${pts.length} checks, from ${fmtDate(pts[0].date)} to ${fmtDate(pts[pts.length - 1].date)}"><polyline points="${xy}"/></svg>`;
  }
  function trackerPanel(f) {
    const r = f.rating || {}, own = r.payoutProof && r.payoutProof.published && r.payoutProof.url;
    const ownLink = own ? `<a class="link" href="${esc(r.payoutProof.url)}" target="_blank" rel="noopener nofollow">${esc(f.name)}'s own payout records ${ICON.ext}</a>` : "";
    const list = f.trackers || [];
    const terms = [...new Map(f.programs.filter((p) => p.payoutFrequency).map((p) => [p.payoutFrequency, p])).values()].slice(0, 3);
    const termsBox = terms.length ? `<div class="pt-box pt-terms"><span class="pt-k">The firm's own terms <em>not verified</em></span>
        <ul>${terms.map((p) => `<li><b>${esc(p.name)}</b><span>${esc(p.payoutFrequency)}</span></li>`).join("")}</ul>
        <p>From ${esc(f.name)}'s rules pages, linked under each program above. A firm's stated timing is a promise, not a measurement.</p></div>` : "";
    const approval = `<div class="pt-box pt-approval"><span class="pt-k">Approval time</span><b>From traders' own reports</b>
        <p>How long ${esc(f.name)} takes from a payout request to money received needs each trader's request and receipt times, which no public record shows. It will come from member reports with proof, once Prop Firm Mirror accounts open.</p></div>`;
    const cant = `<details class="pt-cant"><summary>What these numbers can't show</summary><ul>
        <li>Approvals and denials happen inside each firm. Trackers only see money that left on a public blockchain.</li>
        <li>Bank, card and other off-chain payouts are not counted, so a firm paying that way can look smaller than it is.</li>
        <li>Each tracker follows its own set of wallets, so their counts differ. We show each one as published and never add them up.</li>
        <li>A payout wallet can also carry other payments, such as refunds or affiliate commissions.</li></ul></details>`;
    if (!list.length) return `<section class="panel glass spot tracker-panel none" data-reveal id="payouts"><h2>Payouts <span class="r">On-chain trackers</span></h2>
      <p class="note" style="margin:0 0 14px">${esc(f.name)}'s payouts don't appear on the independent on-chain trackers we use (Payout Junction, FundedTrading, ThePropFirmGuide). They count only payouts they can match to a public blockchain transaction, so firms that pay by bank transfer, card or other rails don't appear. This is not a sign that a firm doesn't pay.</p>
      <div class="pt-row">${approval}${termsBox}</div>${ownLink ? `<div class="pt-foot">${ownLink}</div>` : ""}</section>`;
    const card = (x) => {
      const d = x.last30, a = x.allTime, perDay = d && d.count ? d.count / 30 : null;
      const body = x.source === "FundedTrading"
        ? `<b class="pt-big">${x.daysPaid}<small>/30</small></b><span class="pt-sub">days with payouts, last 30 days</span>
           <ul class="pt-stats"><li>Payout score <b>${x.payoutScore}</b>/100</li>${x.paid30 ? `<li><b>${esc(x.paid30)}</b> sent in 30 days</li>` : ""}</ul>`
        : d ? `<b class="pt-big" title="${esc(money(d.amount))}">${usdShort(d.amount)}</b><span class="pt-sub">sent in the last 30 days</span>
           <ul class="pt-stats">${d.count ? `<li><b>${d.count.toLocaleString("en-US")}</b> payouts</li><li>about <b>${perDay >= 10 ? Math.round(perDay).toLocaleString("en-US") : perDay.toFixed(1)}</b> a day</li>` : ""}${d.average ? `<li>average <b>${money(d.average)}</b></li>` : ""}${d.largest ? `<li>largest <b>${money(d.largest)}</b></li>` : ""}</ul>
           ${a ? `<p class="pt-all">All time <b>${usdShort(a.amount)}</b>${a.count ? ` · ${a.count.toLocaleString("en-US")} payouts` : ""}</p>` : ""}` : `<span class="pt-sub">No 30-day figures published.</span>`;
      return `<article class="pt-card${x === f.tracker ? " lead" : ""}">
        <div class="pt-h"><span class="pt-src">${esc(x.source)}</span><a href="${esc(x.url)}" target="_blank" rel="noopener nofollow" aria-label="Open ${esc(x.source)}'s payout list for ${esc(x.trackedAs || f.name)}">Payout list ${ICON.ext}</a></div>
        ${body}${sparkline(x.history)}
        <div class="pt-f">${x.trackedAs ? `Tracked as ${esc(x.trackedAs)}${x.method ? ` · ${esc(x.method)}` : ""} · ` : ""}checked ${fmtDate(x.checked)}</div></article>`;
    };
    const newest = list.reduce((m, x) => (x.checked > m ? x.checked : m), "");
    return `<section class="panel glass spot tracker-panel v2" data-reveal id="payouts">
      <h2>Payouts <span class="r">Sent on-chain, as counted by ${list.length} independent tracker${list.length === 1 ? "" : "s"} · ${fmtDate(newest)}</span></h2>
      <div class="pt-grid">${list.map(card).join("")}</div>
      ${list.length > 1 ? `<p class="pt-diff">Trackers follow different wallets, so their counts differ. Each is shown as published.</p>` : ""}
      <div class="pt-row">${approval}${termsBox}</div>
      ${cant}
      ${ownLink || (list[0] && list[0].note) ? `<div class="pt-foot">${list.find((x) => x.note) ? `<span class="tk-note">${esc(list.find((x) => x.note).note)}</span>` : ""}${ownLink}</div>` : ""}
    </section>`;
  }

  // The firm page's score panel: the number, its four parts, and every piece of evidence behind it, each linked.
  function scorePanel(f) {
    const r = f.rating;
    if (!r) return `<section class="panel glass score-panel none" data-reveal><h2>Mirror Score</h2><p class="note" style="margin:0">Not rated yet. We publish a score only after reading the firm's reviews and payout reports.</p></section>`;
    const tp = r.trustpilot || {}, sm = r.sample || {};
    const dist = tp.dist ? [5, 4, 3, 2, 1].map((k) => `<div class="tp-row"><span>${k}★</span><i><b style="width:${Math.max(0, Math.min(100, +tp.dist[k] || 0))}%"></b></i><em>${+tp.dist[k] || 0}%</em></div>`).join("") : "";
    const linkList = (xs) => (xs || []).slice(0, 3).map((u) => `<a class="link" href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(host(u))} ${ICON.ext}</a>`).join("");
    const INC = { "payout-denial": "Payout denied", "payout-delay": "Payout delayed", "payout-pause": "Payouts paused", "mass-breach": "Mass breaches", "rule-change-backlash": "Rule change backlash", "platform-outage": "Platform outage", regulatory: "Regulatory", closure: "Closure" };
    const incidents = (r.incidents || []).filter((x) => x && x.url);
    const tot = (sm.payoutPositive || 0) + (sm.payoutNegative || 0);
    return `<section class="panel glass spot score-panel" data-reveal id="score">
      <h2>Mirror Score <span class="r">Reviews and reports checked ${fmtDate((tp.checked || r.checked || f.lastVerified))}</span></h2>
      <div class="sp-top">
        <div class="sp-main">${scoreRing(r, true)}<div><div class="sp-label b-${r.band}">${esc(r.label)}</div><div class="sp-of">out of 10 · ${esc(SEC.label)}</div></div></div>
        <div class="sp-parts">${SCORE_PARTS.map(([k, l]) => r.parts[k] == null ? "" : `<div class="sp-part"><span>${l}<em>${Math.round(SCORE_W[k] * 100)}%</em></span><i><b class="b-${scoreBand(r.parts[k])}" style="--w:${(r.parts[k] * 10).toFixed(0)}%"></b></i><strong>${r.parts[k].toFixed(1)}</strong></div>`).join("")}
          ${r.vol != null ? `<p class="sp-note">Payout record = reviews ${r.fromReviews.toFixed(1)} and on-chain payouts ${r.vol.toFixed(1)}${f.tracker && f.tracker.last30.count ? ` (${f.tracker.last30.count.toLocaleString("en-US")} payouts sent on-chain in 30 days, counted by ${esc(f.tracker.source)}` : " ("}${f.cadence ? `${f.tracker && f.tracker.last30.count ? ", " : ""}paid on ${f.cadence.daysPaid} of the last 30 days` : ""}), half each.</p>` : `<p class="sp-note">Payout record comes from reviews only: this firm's payouts are not tracked on-chain.</p>`}</div>
      </div>
      ${r.pub ? `<p class="sp-note">Public reviews = ${r.pub.rows.length} platform${r.pub.rows.length === 1 ? "" : "s"} ${r.pub.score.toFixed(1)}${r.read != null ? ` (70%) and our reading of recent reviews ${r.read.toFixed(1)} (30%)` : ""}.</p>` : ""}
      <div class="sp-grid">
        ${r.pub ? `<div class="sp-card pub-card"><div class="sp-k">Public ratings, all platforms</div>
          <div class="tp-head"><b>${r.pub.r5.toFixed(1)}</b><span>out of 5 · ${r.pub.reviews.toLocaleString("en-US")} reviews on ${r.pub.rows.length} platform${r.pub.rows.length === 1 ? "" : "s"}</span></div>
          <ul class="pub-rows">${r.pub.rows.map((e) => `<li class="${e.flagged ? "flag" : ""}"><span class="pl">${esc(e.platform)}</span><span class="st"><i style="--w:${((e.r5 - 1) / 4 * 100).toFixed(0)}%"></i></span><b>${(+e.rating).toFixed(1)}<small>/${+e.outOf}</small></b><em>${Number(e.reviews).toLocaleString("en-US")}</em><a href="${esc(e.url)}" target="_blank" rel="noopener nofollow" aria-label="Open ${esc(e.platform)}">${ICON.ext}</a>${e.flagged ? `<span class="pub-warn">${esc(e.warning)}. Counted at a third.</span>` : ""}</li>`).join("")}</ul>
          <p class="note" style="margin:8px 0 0">Combined by number of reviews (square root, capped at 5,000 a platform), with small samples pulled toward the average; platforms under 5 reviews are left out. Checked ${fmtDate(r.pub.rows.reduce((d, e) => (e.checked > d ? e.checked : d), ""))}.</p></div>` : ""}
        ${tp.found !== false && tp.trustScore != null ? `<div class="sp-card"><div class="sp-k">Trustpilot</div>
          <div class="tp-head"><b>${(+tp.trustScore).toFixed(1)}</b><span>${tp.reviews != null ? Number(tp.reviews).toLocaleString("en-US") + " reviews" : ""}${tp.claimed ? " · claimed profile" : ""}</span></div>
          ${dist ? `<div class="tp-dist">${dist}</div>` : ""}
          ${tp.warning ? `<div class="sp-warn">Trustpilot notice: ${esc(tp.warning)}. We read the reviews underneath anyway.</div>` : ""}
          ${tp.url ? `<a class="link" href="${esc(tp.url)}" target="_blank" rel="noopener nofollow">Open on Trustpilot ${ICON.ext}</a>` : ""}</div>` : `<div class="sp-card"><div class="sp-k">Trustpilot</div><p class="note">No Trustpilot profile found for this brand.</p></div>`}
        <div class="sp-card"><div class="sp-k">Recent reviews we read</div>
          ${sm.read ? `<div class="sp-count"><b>${sm.read}</b><span>reviews read${sm.window ? " · " + esc(String(sm.window).replace("..", " to ")) : ""}</span></div>
          ${tot ? `<div class="sp-split"><i style="--pa:${((sm.payoutPositive / tot) * 100).toFixed(0)}%"></i></div>` : ""}
          <ul class="sp-stats"><li class="ok"><b>${sm.payoutPositive || 0}</b> report a payout received</li><li class="rs"><b>${sm.payoutNegative || 0}</b> report a payout problem</li><li><b>${sm.otherNegative || 0}</b> other complaints</li></ul>` : `<p class="note">Reviews could not be read.</p>`}
          ${(sm.examples || []).length ? `<ul class="sp-ex">${sm.examples.slice(0, 4).map((x) => `<li><span class="st">${"★".repeat(Math.max(0, Math.min(5, +x.stars || 0)))}</span><span>${esc(x.gist)}</span>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener nofollow" aria-label="Open review">${ICON.ext}</a>` : ""}<em>${fmtDate(x.date)}</em></li>`).join("")}</ul>` : ""}</div>
        <div class="sp-card"><div class="sp-k">YouTube and Reddit</div>
          ${r.youtube && r.youtube.summary ? `<p><b>YouTube.</b> ${esc(r.youtube.summary)}</p><div class="sp-links">${linkList(r.youtube.links)}</div>` : ""}
          ${r.reddit && r.reddit.summary ? `<p><b>Reddit.</b> ${esc(r.reddit.summary)}</p><div class="sp-links">${linkList(r.reddit.links)}</div>` : ""}</div>
        <div class="sp-card"><div class="sp-k">Payout incidents</div>
          ${incidents.length ? `<ul class="sp-inc">${incidents.slice(0, 5).map((x) => `<li><span class="tag ${/denial|pause|closure/.test(x.type) ? "ember" : "sand"}">${esc(INC[x.type] || x.type)}</span><span>${esc(x.gist)}${x.proven === false ? " <em>(single unproven report)</em>" : ""}</span><a href="${esc(x.url)}" target="_blank" rel="noopener nofollow">${esc(x.date || "")} ${ICON.ext}</a></li>`).join("")}</ul>` : `<p class="note">No credible, dated payout incidents found in our checks.</p>`}
          ${r.payoutProof && r.payoutProof.published && r.payoutProof.url ? `<a class="link" href="${esc(r.payoutProof.url)}" target="_blank" rel="noopener nofollow">Firm's own payout records ${ICON.ext}</a>` : ""}</div>
      </div>
      ${r.why ? `<p class="sp-why">${r.why.payout ? `<b>Payouts:</b> ${esc(r.why.payout)} ` : ""}${r.why.sentiment ? `<b>Traders:</b> ${esc(r.why.sentiment)}` : ""}</p>` : ""}
      <p class="note">The Mirror Score is our opinion from the public evidence above and the firm's own rules. <a class="link" href="#/method">How the score works</a></p>
    </section>`;
  }

  /* ------------------------------------------------------------------ sections */
  function enterSection(sec) {
    buildSection(sec);
    rateSection();
    S.compare = store.get("compare." + sec.id, []).filter((id) => byId[id]).slice(0, 4);
    if (!TABS.some((t) => t.id === S.tab && (t.id === "all" || allPrograms.some(t.test)))) S.tab = "all";
    S.size = null; S.models.clear(); S.dd.clear(); S.platforms.clear();
    S.cmpProg = {}; S.cmpSize = null;
    renderSecbar();
    $("#brandSec").textContent = sec.id === "cfd" ? "" : sec.label.toUpperCase();
    $("#brandSec").hidden = sec.id === "cfd";
  }
  function renderSecbar() {
    const bar = $("#secbar");
    if (!bar) return;
    const prev = $(".sec-l.on", bar);
    const from = prev ? { x: prev.offsetLeft, w: prev.offsetWidth } : null;
    bar.innerHTML = `<span class="sec-lens" aria-hidden="true"></span>` + SECTIONS.map((x) => {
      const n = ALL.filter((f) => f.status === "active" && f.programs.some(x.test)).length;
      return `<a class="sec-l ${x === SEC ? "on" : ""}" data-s="${x.id}" href="${secHref(x)}" ${x === SEC ? 'aria-current="page"' : ""} title="${esc(x.hint)} · ${n} firms">${SEC_ICON[x.id]}<span class="l">${esc(x.label)}</span><span class="ls">${esc(x.short)}</span></a>`;
    }).join("");
    // the glass lens glides from the old section to the new one
    const on = $(".sec-l.on", bar), lens = $(".sec-lens", bar);
    if (on && lens) {
      const to = { x: on.offsetLeft, w: on.offsetWidth }, a = from || to;
      lens.style.transform = `translateX(${a.x}px)`; lens.style.width = `${a.w}px`;
      requestAnimationFrame(() => requestAnimationFrame(() => { lens.style.transform = `translateX(${to.x}px)`; lens.style.width = `${to.w}px`; }));
    }
  }
  window.addEventListener("resize", () => renderSecbar());

  /* ------------------------------------------------------------------ router */
  const app = $("#app");
  let currentNav = "home";
  // the main section keeps index.html's own <title>, the one written for search engines
  const HOME_TITLE = document.title || "Prop Firm Mirror — Every prop firm, side by side";
  function route() {
    const hc = document.getElementById("heroCanvas");
    if (hc && hc.__pfmHero) hc.__pfmHero.destroy();
    const h = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = h.split("?");
    const params = new URLSearchParams(qs || "");
    let parts = path.split("/").filter(Boolean);
    const sec = SECTIONS.find((x) => x.path && x.path === parts[0]) || SECTIONS[0];
    if (sec.path) parts = parts.slice(1);
    if (sec !== SEC || !route.entered) { route.entered = true; enterSection(sec); }
    closeSheet();
    $("#mnav").classList.remove("open");
    document.title = SEC.id === "cfd" ? HOME_TITLE : `Prop Firm Mirror ${SEC.label} — Every ${SEC.noun} prop firm, side by side`;
    if (parts[0] === "firm" && parts[1]) { currentNav = "home"; viewFirm(decodeURIComponent(parts[1]), params); }
    else if (parts[0] === "compare") {
      currentNav = "compare";
      const ids = (params.get("ids") || "").split(",").filter((id) => byId[id]);
      if (ids.length) { S.compare = [...new Set(ids)].slice(0, 4); save(); }
      viewCompare();
    }
    else if (parts[0] === "changes") { currentNav = "changes"; viewChanges(); }
    else if (parts[0] === "offers") { currentNav = "offers"; viewOffers(); }
    else if (parts[0] === "method") { currentNav = "method"; viewMethod(); }
    else if (parts[0] === "legal") { currentNav = "legal"; document.title = "Privacy & disclaimer — Prop Firm Mirror"; viewLegal(); }
    else { currentNav = "home"; viewHome(); }
    navActive(currentNav);
    renderTray();
  }
  let lastHash = null;
  const secOf = (h) => { const p = (h || "").replace(/^#\/?/, "").split(/[/?]/)[0]; return SECTIONS.find((x) => x.path && x.path === p) || SECTIONS[0]; };
  window.addEventListener("hashchange", () => {
    const base = (h) => (h || "").split("?")[0];
    const sameFirm = base(location.hash) === base(lastHash) && /\/firm\//.test(location.hash);
    const switching = secOf(location.hash) !== secOf(lastHash);
    lastHash = location.hash;
    if (sameFirm) return; // program tab switch inside a firm page
    countView();
    const go = () => { route(); (window.PFMMotion ? window.PFMMotion.jump(0) : window.scrollTo(0, 0)); };
    if (!window.PFMMotion) { go(); return; }
    // switching section: the new colour world opens as a circle from where you clicked
    if (switching) PFMMotion.transition(go, { reveal: lastPointer });
    else PFMMotion.transition(go);
  });
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest("[data-copy]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const code = b.dataset.copy;
    const done = () => {
      b.classList.add("copied"); const t = $(".cp span", b); if (t) t.textContent = "Copied";
      const live = $("#resultLive"); if (live) live.textContent = `Code ${code} copied`;
      clearTimeout(b._t); b._t = setTimeout(() => { b.classList.remove("copied"); if (t) t.textContent = "Copy"; }, 1800);
    };
    const fallback = () => { const c = $(".c", b) || b, r = document.createRange(); r.selectNodeContents(c); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { if (document.execCommand("copy")) done(); } catch (_) {} };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, fallback); else fallback();
  }, true);
  let lastPointer = null;
  document.addEventListener("pointerdown", (e) => {
    lastPointer = { x: e.clientX, y: e.clientY };
    const dd = $("#sortDD"); if (dd && !dd.contains(e.target)) closeSortMenu(false);
  }, { passive: true });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeSheet(); closePicker(); closeSortMenu(true); }
    if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && !$("#sheet.open, #picker.open")) {
      const q = $("#q"); if (q) { e.preventDefault(); focusSearch(q); }
    }
  });
  let wasMobile = window.matchMedia("(max-width: 640px)").matches;
  window.addEventListener("resize", () => { const m = window.matchMedia("(max-width: 640px)").matches; if (m !== wasMobile) { wasMobile = m; if (S.view === "challenges") renderResults(); } });

  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  $("#sheet").inert = true; $("#picker").inert = true;
  header();
  lastHash = location.hash;
  route();
})();
