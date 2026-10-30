// Country names and flags without any downloaded assets.
// Names come from the browser's Intl.DisplayNames; flags are Unicode regional-indicator emoji.
// Where a system can't draw flag emoji (e.g. Windows), a small ISO-code chip is shown instead.
(function () {
  const CODES = ("AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ " +
    "CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE " +
    "GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP " +
    "KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF " +
    "NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN " +
    "SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT " +
    "ZA ZM ZW").split(" ");

  // Shorter, commonly used names where the CLDR name is long or political-neutral but unfamiliar.
  const OVERRIDE = {
    CD: "DR Congo", CG: "Congo", MM: "Myanmar", PS: "Palestine", HK: "Hong Kong", MO: "Macao", KP: "North Korea",
    KR: "South Korea", US: "United States", GB: "United Kingdom", VA: "Vatican City", XK: "Kosovo", RU: "Russia",
    SY: "Syria", IR: "Iran", LA: "Laos", MK: "North Macedonia", BQ: "Caribbean Netherlands", UM: "U.S. Outlying Islands",
    VI: "U.S. Virgin Islands", VG: "British Virgin Islands", FM: "Micronesia", BO: "Bolivia", VE: "Venezuela",
    TZ: "Tanzania", MD: "Moldova", CI: "Côte d’Ivoire", TW: "Taiwan", BA: "Bosnia & Herzegovina"
  };

  let dn = null;
  try { dn = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { /* very old browser */ }

  const valid = (c) => typeof c === "string" && /^[A-Z]{2}$/.test(c);
  const name = (c) => (!valid(c) ? String(c || "") : OVERRIDE[c] || (dn && dn.of(c)) || c);
  const emoji = (c) => (valid(c) ? String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : "");

  // Draw a Pakistan flag to a canvas: a colour emoji has green pixels, a fallback letter pair does not.
  let emojiOK = true;
  try {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 28;
    const x = cv.getContext("2d", { willReadFrequently: true });
    x.textBaseline = "top";
    x.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.fillText(emoji("PK"), 0, 0);
    const d = x.getImageData(0, 0, 28, 28).data;
    emojiOK = false;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40 && d[i + 1] > d[i] + 25 && d[i + 1] > d[i + 2]) { emojiOK = true; break; }
    }
  } catch (e) { emojiOK = true; }

  const flag = (c, cls = "") => {
    if (!valid(c)) return `<span class="flag flag-code ${cls}" aria-hidden="true">··</span>`;
    return emojiOK && c !== "XK"
      ? `<span class="flag ${cls}" aria-hidden="true">${emoji(c)}</span>`
      : `<span class="flag flag-code ${cls}" aria-hidden="true">${c}</span>`;
  };

  const list = CODES.map((code) => ({ code, name: name(code) })).sort((a, b) => a.name.localeCompare(b.name));

  // Guess the visitor's country from the browser locale (e.g. "en-PK"), used only as a first default.
  const guess = () => {
    const langs = [].concat(navigator.languages || [], navigator.language || []);
    for (const l of langs) {
      const m = /[-_]([A-Z]{2})\b/.exec(l || "");
      if (m && CODES.includes(m[1])) return m[1];
    }
    return null;
  };

  window.Countries = { CODES, valid, name, emoji, flag, list, guess, emojiOK };
})();
