// Prop Firm Mirror mark (v4): Φ built from three flat pieces, a P and its mirror sharing one stem.
// The stem is the mirror line; the ring is 1/φ of the stem's height; the stem left above and below the ring splits
// 1 : φ; stem and ring share one weight; every piece is separated by the same narrow gap.
// One gradient across all pieces, light at the top to deep at the bottom, all in the emerald family.
window.PFM = { noir: "#0A0E0C", silver: "#EEF2F0", emerald: "#3DDC97",
  grad: [["0", "#B6FADD"], [".5", "#3DDC97"], ["1", "#0E9C7E"]] };
const PHI = (1 + Math.sqrt(5)) / 2;

// markup for the mark, centred on (cx, cy) with stem height H
window.mark = (cx, cy, H, id = "pm") => {
  const k = H / 250, s = 36 * k, g = 10 * k;
  const top = cy - H / 2, R = H / PHI / 2, rcy = top + (H - 2 * R) / (1 + PHI) + R, r = R - s, cut = s / 2 + g;
  const yo = Math.sqrt(R * R - cut * cut), yi = Math.sqrt(r * r - cut * cut);
  const half = (sx) => { const x0 = cx + sx * cut, so = sx < 0 ? 0 : 1;
    return `M${x0},${rcy - yo} A${R},${R} 0 0 ${so} ${x0},${rcy + yo} L${x0},${rcy + yi} A${r},${r} 0 0 ${1 - so} ${x0},${rcy - yi} Z`; };
  return `<defs><linearGradient id="${id}" x1="0" y1="${top}" x2="0" y2="${top + H}" gradientUnits="userSpaceOnUse">
    ${PFM.grad.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient></defs>
    <g fill="url(#${id})"><path d="${half(-1)} ${half(1)}"/><rect x="${cx - s / 2}" y="${top}" width="${s}" height="${H}"/></g>`;
};
