// Prop Firm Mirror — real-time 3D hero.
// The v4 Φ mark (two half-rings + one stem, equal gaps, ring = 1/φ of the stem) extruded in emerald chrome, standing on
// a glossy black floor with a perspective grid that reflects it. A tilted chrome orbit carries floating glass cards around
// the mark, and a shader paints slow, smooth diagonal light ribbons behind everything.
// The hero is pinned while you scroll: the camera cranes up over the floor and the mark turns, then the page moves on.
// three.js (MIT) is vendored locally in assets/vendor — nothing is fetched from the network.
import * as THREE from "three";
import { RoomEnvironment } from "../vendor/RoomEnvironment.js";

const PHI = (1 + Math.sqrt(5)) / 2;

// The current section's colours, read from the page's CSS tokens so the scene always matches the section.
// The mark keeps the logo's own gradient in the main (Forex & CFD) section and takes the section colour elsewhere.
function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const tri = (name, fb) => { const v = css.getPropertyValue(name).split(",").map((x) => +x.trim()); return v.length === 3 && v.every((x) => isFinite(x)) ? v : fb; };
  const sec = document.documentElement.dataset.sec || "cfd";
  const a1 = tri("--a1", [46, 242, 160]), a1h = tri("--a1h", [200, 255, 232]), a1d = tri("--a1d", [15, 191, 140]), a2 = tri("--a2", [56, 225, 255]), a3 = tri("--a3", [155, 140, 255]);
  const hex = (c) => "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  const rgba = (c, a) => `rgba(${c.map(Math.round).join(",")},${a})`;
  const v3 = (c, k = 1) => new THREE.Vector3((c[0] / 255) * k, (c[1] / 255) * k, (c[2] / 255) * k);
  const mark = sec === "cfd" ? ["#E4FFF2", "#5FE8AC", "#15A884"] : [hex(a1h), hex(a1), hex(a1d)];
  return { sec, a1, a1h, a1d, a2, a3, hex, rgba, v3, mark };
}
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---- the mark's three pieces as flat shapes (y up, stem height 200, centred on the origin)
function markShapes() {
  const H = 200, k = H / 250, s = 36 * k, g = 10 * k, R = H / PHI / 2, r = R - s, cut = s / 2 + g;
  const ringY = H / 2 - ((H - 2 * R) / (1 + PHI) + R);
  const to = Math.acos(cut / R), ti = Math.acos(cut / r);
  const left = new THREE.Shape();
  left.absarc(0, ringY, R, Math.PI - to, Math.PI + to, false);
  left.absarc(0, ringY, r, Math.PI + ti, Math.PI - ti, true);
  left.closePath();
  const right = new THREE.Shape();
  right.absarc(0, ringY, R, -to, to, false);
  right.absarc(0, ringY, r, ti, -ti, true);
  right.closePath();
  const stem = new THREE.Shape();
  stem.moveTo(-s / 2, -H / 2); stem.lineTo(s / 2, -H / 2); stem.lineTo(s / 2, H / 2); stem.lineTo(-s / 2, H / 2); stem.closePath();
  return { left, right, stem, H };
}

// vertical emerald gradient baked into vertex colours: light at the top, deep at the bottom (the logo's own gradient)
function paint(geo, H, cols) {
  const top = new THREE.Color(cols[0]), mid = new THREE.Color(cols[1]), bot = new THREE.Color(cols[2]);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp((pos.getY(i) + H / 2) / H, 0, 1);
    if (t > 0.5) c.copy(mid).lerp(top, (t - 0.5) * 2); else c.copy(bot).lerp(mid, t * 2);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
}

function buildMark(material, P) {
  const { left, right, stem, H } = markShapes();
  const group = new THREE.Group();
  const ex = (shape, depth) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 4, bevelSize: 3, bevelSegments: 6, curveSegments: 64 });
    geo.translate(0, 0, -depth / 2);
    geo.computeVertexNormals();
    paint(geo, H, P.mark);
    return new THREE.Mesh(geo, material);
  };
  group.add(ex(left, 22), ex(right, 22), ex(stem, 30));
  return group;
}

// studio light: the neutral RoomEnvironment plus emerald and mint rim strips and a deep green back wall
function studioEnv(renderer, P) {
  const room = new RoomEnvironment();
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 4, 0); room.add(m);
  };
  panel(1.8, 20, P.hex(P.a1), 26, [-11, 4, 1.5]);
  panel(1.8, 20, P.hex(P.a1h), 18, [11, 4, 1.5]);
  panel(26, 10, P.hex(P.a1d.map((x) => x * 0.32)), 0.9, [0, 6, -13]);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(room, 0.03).texture;
  pm.dispose();
  return tex;
}

function radialTexture(stops, size = 256) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a glass "record card": a check badge, a label and skeleton rows (decoration only, no figures)
function cardTexture(label, P) {
  const W = 512, H = 320, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const rr = (px, py, w, h, r) => { x.beginPath(); x.roundRect(px, py, w, h, r); };
  const draw = () => {
    x.clearRect(0, 0, W, H);
    rr(4, 4, W - 8, H - 8, 40);
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, P.rgba(P.a1, 0.38)); g.addColorStop(0.45, "rgba(16,40,30,0.6)"); g.addColorStop(1, "rgba(10,14,12,0.74)");
    x.fillStyle = g; x.fill();
    x.lineWidth = 3; x.strokeStyle = P.rgba(P.a1h, 0.6); x.stroke();
    x.beginPath(); x.arc(64, 66, 22, 0, Math.PI * 2); x.fillStyle = P.hex(P.a1); x.fill();
    x.strokeStyle = "#0A0E0C"; x.lineWidth = 5.5; x.lineCap = "round"; x.lineJoin = "round";
    x.beginPath(); x.moveTo(53, 66); x.lineTo(61, 74); x.lineTo(76, 57); x.stroke();
    x.fillStyle = "rgba(238,242,240,0.94)"; x.font = "600 32px 'JetBrains Mono', ui-monospace, monospace"; x.textBaseline = "middle";
    x.fillText(label, 104, 68);
    [[44, 140, 300, 0.24], [44, 188, 392, 0.14], [44, 236, 230, 0.14]].forEach(([bx, by, bw, a]) => { rr(bx, by, bw, 18, 9); x.fillStyle = `rgba(238,242,240,${a})`; x.fill(); });
    rr(W - 160, 228, 116, 34, 17); x.fillStyle = P.hex(P.a1); x.fill();
  };
  draw();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (document.fonts) document.fonts.ready.then(() => { draw(); t.needsUpdate = true; });
  return t;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ---- background: slow, blurred diagonal light ribbons (fbm-warped bands), emerald on noir
const ribbonFrag = `
precision highp float;
uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uIntro; uniform float uScroll;
uniform vec3 uH0; uniform vec3 uH1; uniform vec3 uH2; uniform vec3 uDeep;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }
void main(){
  vec2 p = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0);
  float t = uTime * 0.05;
  float ang = -0.66 + uMouse.x*0.05;
  mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  vec2 q = R * (p + vec2(0.0, uScroll*0.25));
  float light = 0.0; vec3 tint = vec3(0.0);
  vec3 hues[3]; hues[0] = uH0; hues[1] = uH1; hues[2] = uH2;
  for (int i = 0; i < 6; i++){
    float fi = float(i);
    float lane = (fi - 2.5) * 0.24 + sin(t*1.7 + fi*2.1) * 0.04 + uMouse.y*0.03;
    float warp = (fbm(vec2(q.x*0.9 + t*2.0 + fi*3.7, fi)) - 0.5) * 0.42;
    float d = abs(q.y - lane - warp);
    float width = 0.06 + 0.06 * fbm(vec2(q.x*0.8 - t*1.5, fi*1.3));
    float band = exp(-d*d / (width*width));
    float b = band * (0.6 + 0.4*sin(fi*1.9 + t*2.0));
    light += b;
    tint += b * (i == 1 || i == 4 ? hues[1] : i == 3 ? hues[2] : hues[0]);
  }
  float vign = smoothstep(1.35, 0.1, length(p * vec2(0.62, 1.0)));
  light *= vign * uIntro;
  vec3 noir = vec3(0.039, 0.055, 0.047);
  vec3 deep = uDeep, em = uH0, hi = mix(uH0, vec3(1.0), 0.75);
  vec3 hue = light > 0.001 ? tint / light : em;
  vec3 c = mix(deep, hue, clamp(light*0.9, 0.0, 1.0));
  c = mix(c, hi, clamp(light - 1.1, 0.0, 1.0) * 0.6);
  vec3 col = noir + c * clamp(light, 0.0, 1.5) * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;
const ribbonVert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---- the floor: glossy noir that lets the reflection through near the mark, with a perspective grid drawn in light.
// The grid reveals outward from the mark on load and drifts slowly toward the viewer.
const floorVert = `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const floorFrag = `
precision highp float;
uniform float uTime; uniform float uReveal; uniform vec3 uEm;
varying vec3 vW;
float grid(vec2 p, float s, float w){ vec2 q = p / s; vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q); return 1.0 - min(min(g.x, g.y) / w, 1.0); }
void main(){
  float d = length(vW.xz);
  vec2 p = vW.xz + vec2(0.0, uTime * 9.0);
  float minor = grid(p, 44.0, 1.0), major = grid(p, 176.0, 1.4);
  float reveal = smoothstep(uReveal, uReveal - 320.0, d);
  float near = smoothstep(1700.0, 120.0, d);
  float g = (minor * 0.16 + major * 0.8) * near * reveal;
  float a = mix(0.5, 0.9, smoothstep(40.0, 1100.0, d));
  vec3 noir = vec3(0.039, 0.055, 0.047);
  gl_FragColor = vec4(mix(noir, uEm, clamp(g, 0.0, 1.0) * 0.85), max(a, g * 0.7));
}`;

export function mount(el) {
  if (!el || el.__pfmHero) return el && el.__pfmHero;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (e) { el.classList.add("no-webgl"); return null; }
  const small = window.matchMedia("(max-width: 720px)").matches;
  // pixel budget: sharp enough for chrome edges, light enough to hold the frame rate; tuned live below
  const PR_MAX = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.35);
  let pr = PR_MAX;
  renderer.setPixelRatio(pr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.autoClear = false;
  el.appendChild(renderer.domElement);
  const hero = el.closest(".hero3d") || el;
  const pin = el.closest(".hero-pin");
  const P = readPalette();

  // background pass
  const bgScene = new THREE.Scene();
  const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2() }, uIntro: { value: 0 }, uScroll: { value: 0 },
    uH0: { value: P.v3(P.a1) }, uH1: { value: P.v3(P.a2) }, uH2: { value: P.v3(P.a3) }, uDeep: { value: P.v3(P.a1d, 0.3) } };
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: ribbonVert, fragmentShader: ribbonFrag, depthWrite: false, depthTest: false })));
  // the ribbons are soft light, so they are drawn at half resolution (and every other frame) and stretched to fit
  const bgRT = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  const blitScene = new THREE.Scene();
  blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tMap: { value: bgRT.texture } }, vertexShader: ribbonVert, depthWrite: false, depthTest: false,
    fragmentShader: "uniform sampler2D tMap; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tMap, vUv); }" })));

  // main pass
  const scene = new THREE.Scene();
  const env = studioEnv(renderer, P);
  scene.environment = env;
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, metalness: 1, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.7 });
  // direct lights add the sharp specular glints chrome needs; the environment does the soft fill
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(-300, 420, 520); scene.add(key);
  const rimA = new THREE.PointLight(new THREE.Color(P.hex(P.a1)), 3.4, 0, 0); rimA.position.set(320, 60, -120); scene.add(rimA);
  const rimB = new THREE.PointLight(new THREE.Color(P.hex(P.a1h)), 1.6, 0, 0); rimB.position.set(-340, -40, 160); scene.add(rimB);
  // the mirrored copy has flipped winding, so it is drawn double-sided
  const reflMat = chrome.clone(); reflMat.transparent = true; reflMat.opacity = 0.34; reflMat.depthWrite = false; reflMat.side = THREE.DoubleSide;

  const FLOOR = -100 - 14;
  const rig = new THREE.Group();            // cursor + scroll rotation
  const mark = buildMark(chrome, P);
  const refl = buildMark(reflMat, P);
  refl.scale.y = -1; refl.position.y = 2 * FLOOR;
  refl.traverse((o) => { o.renderOrder = 1; });
  rig.add(mark, refl);
  scene.add(rig);

  // halo behind the mark
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, P.rgba(P.a1, 0.75)], [0.35, P.rgba(P.a1d, 0.26)], [1, "rgba(0,0,0,0)"]]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.set(0, 10, -160); scene.add(halo);

  // glossy floor + grid, then a glow pool on top of it
  const floorU = { uTime: { value: 0 }, uReveal: { value: 0 }, uEm: { value: P.v3(P.a1) } };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000), new THREE.ShaderMaterial({
    uniforms: floorU, vertexShader: floorVert, fragmentShader: floorFrag, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.renderOrder = 2; scene.add(floor);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(900, 420), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, P.rgba(P.a1, 0.6)], [0.4, P.rgba(P.a1d, 0.18)], [1, "rgba(0,0,0,0)"]]),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = FLOOR + 0.6; pool.renderOrder = 3; scene.add(pool);

  // a tilted chrome orbit around the mark that carries five glass record cards
  const ORBIT_R = 196, CW = 78, CH = 48.75;
  const orbit = new THREE.Group();
  orbit.rotation.set(0.36, 0, -0.16);
  const ringMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(P.hex(P.a1h)), metalness: 1, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(ORBIT_R, 1.4, 16, 280), ringMat);
  ring.rotation.x = Math.PI / 2;           // lie flat in the orbit plane
  orbit.add(ring);
  const cardGeo = new THREE.ExtrudeGeometry(roundedRect(CW, CH, 6.2), { depth: 2, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 3, curveSegments: 10 });
  cardGeo.translate(0, 0, -1);
  const cards = ["SOURCED", "DATED", "VERIFIED", "COMPARED", "MAPPED"].map((label, i) => {
    const map = cardTexture(label, P);
    map.repeat.set(1 / CW, 1 / CH); map.offset.set(0.5, 0.5);
    const m = new THREE.Mesh(cardGeo, new THREE.MeshPhysicalMaterial({ map, transparent: true, metalness: 0.15, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.3, side: THREE.DoubleSide, depthWrite: false }));
    m.renderOrder = 4;
    m.userData = { a0: (i / 5) * Math.PI * 2, y0: [14, -10, 22, -4, 8][i], ph: i * 1.7 };
    orbit.add(m);
    return m;
  });
  // a second, finer orbit of light
  const R2 = 244;
  const ring2 = new THREE.Group(); ring2.rotation.set(-0.3, 0.4, 0.3);
  const pts = []; for (let i = 0; i <= 256; i++) { const a = (i / 256) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R2, 0, Math.sin(a) * R2)); }
  const line2 = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(P.hex(P.a2)), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  line2.renderOrder = 4; ring2.add(line2);
  rig.add(orbit, ring2);

  const cam = new THREE.PerspectiveCamera(28, 1, 10, 9000);

  // ---- state
  let w = 1, h = 1, running = true, visible = true, raf = 0, last = 0, frameN = 0;
  const perf = { sum: 0, n: 0, good: 0 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollP = 0, sp = 0;
  const base = { dist: 1260, fx: 0.5, fy: 0.36, tall: false, wide: false };
  let t0 = performance.now();
  // when the intro loader is up, the entrance plays as it lifts instead of behind it
  if (document.documentElement.classList.contains("is-loading")) window.addEventListener("pfm-loaded", () => { t0 = performance.now(); kick(); }, { once: true });
  const easeOutExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));

  function layout() {
    const r = el.getBoundingClientRect();
    w = Math.max(1, r.width); h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    bgRT.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    uniforms.uRes.value.set(w, h);
    cam.aspect = w / h;
    // wide screens: the mark stands in the right half beside the headline; narrow screens: top centre, text below
    // phones (tall portrait): a smaller mark near the top so the headline below never sits on it
    base.wide = w / h > 1.15 && w > 980; base.tall = w / h < 0.8;
    cam.fov = base.wide ? 26 : 30;
    base.dist = base.wide ? 1150 : base.tall ? 1950 : 1460;
    base.fx = base.wide ? 0.72 : 0.5; base.fy = base.wide ? 0.5 : base.tall ? 0.27 : 0.36;
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    const still = reduced();
    const intro = still ? 1 : easeOutExpo(Math.min(1, t / 2.2));
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    sp = still ? scrollP : sp + (scrollP - sp) * 0.14;
    const e = smooth(sp);
    uniforms.uTime.value = still ? 8 : t;
    uniforms.uMouse.value.set(mouse.x, mouse.y);
    uniforms.uIntro.value = intro;
    uniforms.uScroll.value = e;
    floorU.uTime.value = still ? 0 : t;
    floorU.uReveal.value = still ? 4000 : 120 + easeOutExpo(Math.min(1, Math.max(0, t - 0.3) / 2.6)) * 3600;

    // camera: a slight orbit with the cursor (real parallax between floor, orbit and mark), and a crane up over the
    // floor as the pinned hero is scrolled, drifting the mark to the centre once the headline has left
    const d = base.dist * (1 - 0.2 * e);
    cam.position.set(mouse.x * base.dist * 0.05, 40 + e * base.dist * 0.5 - mouse.y * base.dist * 0.025, d);
    cam.lookAt(0, -40 - e * 70, 0);
    const fx = lerp(base.fx, 0.5, e), fy = lerp(base.fy, base.tall ? 0.46 : 0.47, e);
    cam.setViewOffset(w, h, (0.5 - fx) * w, (0.5 - fy) * h, w, h);
    cam.updateProjectionMatrix();

    const idle = still ? 0 : Math.sin(t * 0.45) * 0.22;
    rig.rotation.y = (1 - intro) * -1.4 + idle + mouse.x * 0.22 + e * Math.PI * 0.85;
    rig.rotation.x = mouse.y * 0.05;
    mark.position.y = (1 - intro) * -70 + (still ? 0 : Math.sin(t * 0.9) * 3);
    refl.position.y = 2 * FLOOR - mark.position.y;
    reflMat.opacity = 0.34 * (1 - e * 0.9);   // a flipped copy only reads as a reflection from near floor level
    halo.material.opacity = 0.65 + 0.35 * Math.sin(t * 0.8);
    scene.environmentRotation.y = t * 0.12;

    // orbit: cards ride the ring, bob, and turn outward so their glass catches the light as they pass
    const spin = still ? 0.6 : t * 0.16;
    orbit.scale.setScalar(lerp(0.6, 1, intro));
    cards.forEach((m) => {
      const a = m.userData.a0 + spin;
      m.position.set(Math.cos(a) * ORBIT_R, m.userData.y0 + (still ? 0 : Math.sin(t * 0.8 + m.userData.ph) * 6), Math.sin(a) * ORBIT_R);
      m.rotation.set(-orbit.rotation.x * 0.8, Math.PI / 2 - a, 0);
      m.material.opacity = intro;
    });
    line2.material.opacity = 0.5 * intro;


    if (frameN++ % 2 === 0 || still) { renderer.setRenderTarget(bgRT); renderer.render(bgScene, bgCam); renderer.setRenderTarget(null); }
    renderer.clear();
    renderer.render(blitScene, bgCam);
    renderer.clearDepth();
    renderer.render(scene, cam);
    adapt(dt);
    if (visible && !still) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && running) raf = requestAnimationFrame(frame); };
  // keep the frame rate up on any machine: drop the pixel ratio when frames run long, raise it again when there is room
  function adapt(dt) {
    if (!dt || document.hidden) return;
    perf.sum += dt; perf.n++;
    if (perf.n < 45) return;
    const avg = perf.sum / perf.n; perf.sum = 0; perf.n = 0;
    if (avg > 0.022 && pr > 0.7) { pr = Math.max(0.7, pr - 0.2); perf.good = 0; renderer.setPixelRatio(pr); layout(); }
    else if (avg < 0.0125 && pr < PR_MAX && ++perf.good >= 4) { pr = Math.min(PR_MAX, pr + 0.1); perf.good = 0; renderer.setPixelRatio(pr); layout(); }
  }

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    mouse.tx = THREE.MathUtils.clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
    mouse.ty = THREE.MathUtils.clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
    kick();
  };
  // progress through the pinned stretch (0 at the top, 1 when the hero is about to scroll away)
  const onScroll = () => {
    if (pin) {
      const r = pin.getBoundingClientRect();
      scrollP = clamp01(-r.top / Math.max(1, r.height - innerHeight));
    } else {
      const r = el.getBoundingClientRect();
      scrollP = clamp01(-r.top / Math.max(1, r.height));
    }
    hero.style.setProperty("--hp", scrollP.toFixed(4));
    hero.classList.toggle("hero-out", scrollP > 0.42);
    kick();
  };
  const ro = new ResizeObserver(() => { layout(); kick(); });
  ro.observe(el);
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { threshold: 0 });
  io.observe(el);
  const onVis = () => { visible = !document.hidden; if (visible) kick(); };
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVis);

  layout(); onScroll(); sp = scrollP;
  el.classList.add("ready");
  raf = requestAnimationFrame(frame);

  const api = {
    destroy() {
      running = false; cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
      env.dispose(); bgRT.dispose(); blitScene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose(); renderer.domElement.remove();
      el.__pfmHero = null;
    },
  };
  el.__pfmHero = api;
  return api;
}

window.PFMHero = { mount };
window.dispatchEvent(new Event("pfm-hero-ready"));
