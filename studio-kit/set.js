/* KARLCON Studio — the set.
   Layout follows Karl's sketch: curved blueprint LED wall, the KARLCON SYSTEM anchor desk with
   two presenters, the featured building on stage behind them, light stands, a broadcast camera,
   and the Atlas globe in the corner. Units are metres; the audience camera looks down -Z. */
import * as THREE from 'three';
import { BUILDERS, STAGE_IDS } from './buildings.js';

const RED = 0xD0231A, WHITE = 0xF4F2EF, INK = 0x15181D;
const mat = {
  red: new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.32, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  white: new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.55 }),
  whiteGloss: new THREE.MeshPhysicalMaterial({ color: 0xF7F6F4, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x7E7C78, roughness: 0.95 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x23262B, roughness: 0.4, metalness: 0.6 }),
  alu: new THREE.MeshStandardMaterial({ color: 0x3A3D42, roughness: 0.35, metalness: 0.85 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xDCEBF2, roughness: 0.04, metalness: 0, transmission: 0.0, transparent: true, opacity: 0.22, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }),
  warm: new THREE.MeshStandardMaterial({ color: 0xF1E6D6, roughness: 0.8, emissive: 0xFFD9A8, emissiveIntensity: 0.18 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0xE9E4DC, roughness: 0.95 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0E0F11, roughness: 0.6, metalness: 0.3 })
};

function box(w, h, d, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; }
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 24) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; }
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { tex: t, canvas: c, ctx: g }; }

/* KARLCON hexagon mark (same geometry as the site logo) */
function drawMark(g, x, y, s, color = '#D0231A') {
  g.save(); g.translate(x, y); g.scale(s / 64, s / 64); g.strokeStyle = color; g.fillStyle = color; g.lineJoin = 'round';
  g.lineWidth = 4; g.beginPath(); g.moveTo(32, 3); g.lineTo(57, 17.5); g.lineTo(57, 46.5); g.lineTo(32, 61); g.lineTo(7, 46.5); g.lineTo(7, 17.5); g.closePath(); g.stroke();
  g.lineWidth = 3.2; g.beginPath(); g.moveTo(17, 24); g.lineTo(32, 32); g.lineTo(47, 24); g.moveTo(32, 32); g.lineTo(32, 51); g.stroke();
  g.beginPath(); g.moveTo(19, 28); g.lineTo(19, 42); g.lineTo(30, 48.4); g.lineTo(30, 35); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(45, 28); g.lineTo(45, 42); g.lineTo(34, 48.4); g.lineTo(34, 35); g.closePath(); g.fill();
  g.restore();
}

/* ---------------- blueprint LED wall ---------------- */
function drawBlueprint(g, W, H) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#4A5462'); bg.addColorStop(1, '#343B46');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.strokeStyle = 'rgba(235,242,250,0.8)'; g.fillStyle = 'rgba(235,242,250,0.85)'; g.lineWidth = 2.2;
  const iso = (ox, oy, s) => (x, y, z) => [ox + (x - z) * s * 0.866, oy + (x + z) * s * 0.5 - y * s];
  const poly = (P, pts, close = true) => { g.beginPath(); pts.forEach((p, i) => { const [a, b] = P(...p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); if (close) g.closePath(); g.stroke(); };
  const cube = (P, x0, y0, z0, w, h, d) => {
    poly(P, [[x0, y0, z0], [x0 + w, y0, z0], [x0 + w, y0, z0 + d], [x0, y0, z0 + d]]);
    poly(P, [[x0, y0 + h, z0], [x0 + w, y0 + h, z0], [x0 + w, y0 + h, z0 + d], [x0, y0 + h, z0 + d]]);
    for (const [a, c] of [[0, 0], [w, 0], [w, d], [0, d]]) poly(P, [[x0 + a, y0, z0 + c], [x0 + a, y0 + h, z0 + c]], false);
  };
  // left: isometric of the lifted box with the bi-parting roof light
  let P = iso(560, 640, 58);
  cube(P, 0, 2.6, 0, 4.2, 2.6, 3); for (const [a, c] of [[0.2, 0.2], [4, 0.2], [4, 2.8], [0.2, 2.8]]) poly(P, [[a, 0, c], [a, 2.6, c]], false);
  poly(P, [[1.4, 5.2, 0.9], [2.1, 5.9, 0.9], [2.1, 5.9, 2.1], [1.4, 5.2, 2.1]]); poly(P, [[2.8, 5.2, 0.9], [2.1, 5.9, 0.9], [2.1, 5.9, 2.1], [2.8, 5.2, 2.1]]);
  for (let i = 1; i < 4; i++) poly(P, [[i * 1.05, 2.6, 3], [i * 1.05, 5.2, 3]], false);
  g.font = '600 22px "IBM Plex Mono", monospace'; g.fillText('LIFTED BOX  ·  4 COLUMNS', 330, 170); g.fillText('ROOF LIGHT: BI-PARTING PAIR', 330, 200);
  // dimension lines
  g.setLineDash([8, 6]); g.beginPath(); g.moveTo(230, 700); g.lineTo(230, 330); g.stroke(); g.setLineDash([]);
  // metrics chart (bottom-left)
  const cx = 150, cy = 1180, cw = 520, ch = 260;
  g.font = '700 26px "Montserrat", sans-serif'; g.fillText('STRUCTURAL INTEGRITY METRICS', cx, cy - ch - 30);
  g.lineWidth = 2; g.strokeRect(cx, cy - ch, cw, ch);
  for (let i = 1; i < 5; i++) { g.globalAlpha = 0.35; g.beginPath(); g.moveTo(cx, cy - ch * i / 5); g.lineTo(cx + cw, cy - ch * i / 5); g.stroke(); g.globalAlpha = 1; }
  g.beginPath(); for (let i = 0; i <= 40; i++) { const x = cx + cw * i / 40, y = cy - ch * (0.1 + 0.8 * i / 40); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  g.beginPath(); for (let i = 0; i <= 40; i++) { const x = cx + cw * i / 40, y = cy - ch * (0.85 - 0.6 * Math.pow(i / 40, 0.7)); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
  // right: section + column base detail
  P = iso(2900, 700, 50);
  cube(P, 0, 0, 0, 3, 0.4, 3); for (let i = 0; i < 3; i++) cube(P, 1.3, 0.4 + i * 1.1, 1.3, 0.4, 1.1, 0.4);
  g.font = '600 22px "IBM Plex Mono", monospace'; g.fillText('COLUMN BASE · PAD FOOTING', 2780, 900); g.fillText('HOLD-DOWN BOLTS · GROUT', 2780, 930);
  g.lineWidth = 2; g.strokeRect(3350, 980, 460, 300); g.beginPath(); g.moveTo(3350, 1130); g.lineTo(3810, 1130); g.moveTo(3580, 980); g.lineTo(3580, 1280); g.stroke();
  g.fillText('ROOF LIGHT SECTION', 3350, 960);
  g.beginPath(); g.moveTo(3400, 1230); g.lineTo(3580, 1060); g.lineTo(3760, 1230); g.stroke();
  // brand panels
  const brand = (x, y, s) => { drawMark(g, x, y, s * 1.3, '#FF5A36'); g.fillStyle = '#FFFFFF'; g.font = `800 ${s * 0.72}px "Montserrat", sans-serif`; g.fillText('KARLCON', x + s * 1.55, y + s * 0.85); g.font = `600 ${s * 0.3}px "Montserrat", sans-serif`; g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillText('STUDIOS', x + s * 1.6, y + s * 1.25); };
  brand(120, 1290, 70); brand(3180, 110, 62); brand(1700, 60, 48);
}

/* ---------------- anchor desk ---------------- */
function buildDesk() {
  const G = new THREE.Group(); G.name = 'desk';
  const W = 3.3, D = 0.78, H = 0.75;
  const top = box(W, 0.05, D, mat.whiteGloss, 0, H - 0.025, 0); G.add(top);
  const { tex } = canvasTex(2048, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1B1E23'); gr.addColorStop(1, '#0F1114'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#D0231A'; g.fillRect(0, 0, w, 16); g.fillRect(0, h - 10, w, 10);
    drawMark(g, 330, 150, 210, '#E8453B');
    g.fillStyle = '#FFFFFF'; g.font = '800 150px "Montserrat", sans-serif'; g.fillText('KARLCON', 600, 290);
    g.fillStyle = '#E8453B'; g.font = '700 96px "Montserrat", sans-serif'; g.fillText('STUDIOS', 1380, 290);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = '600 44px "IBM Plex Mono", monospace'; g.fillText('LUMEN BUILDS · ENGINEERING DESK · HARARE', 600, 390);
  });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H - 0.08), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.4 }));
  front.position.set(0, (H - 0.08) / 2, D / 2 - 0.02); G.add(front);
  const body = box(W - 0.06, H - 0.08, D - 0.1, mat.dark, 0, (H - 0.08) / 2, -0.02); body.material = mat.dark; G.add(body);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(W, 0.012, 0.02), new THREE.MeshBasicMaterial({ color: 0xFF3B2E })); strip.position.set(0, 0.012, D / 2 + 0.005); G.add(strip);
  // laptops / tablets on the desk
  for (const x of [-0.95, 0.95]) { const lap = box(0.34, 0.012, 0.24, mat.alu, x, H + 0.006, 0.05); G.add(lap); }
  // a branded water bottle in front of each presenter
  const bottles = [];
  for (const x of [-0.5, 0.5]) { const b = buildBottle(); b.position.set(x, H, -0.02); G.add(b); bottles.push(b); }
  return { group: G, height: H, depth: D, width: W, bottles };
}

/* ---------------- water bottle with the KARLCON Elite Retreats label ---------------- */
let bottleLabel = null;
function labelTexture() {
  if (bottleLabel) return bottleLabel;
  const c = canvasTex(1024, 256, (g, w, h) => { g.fillStyle = '#F7F1E6'; g.fillRect(0, 0, w, h); });
  const img = new Image(); img.src = '/img/brand/elite-retreats-logo.png';
  img.onload = () => {
    const g = c.ctx, w = 1024, h = 256; g.fillStyle = '#F7F1E6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8C6A3C'; g.fillRect(0, 10, w, 4); g.fillRect(0, h - 14, w, 4);
    const lh = 190, lw = lh * img.width / img.height;
    for (const cx of [w * 0.25, w * 0.75]) g.drawImage(img, cx - lw / 2, (h - lh) / 2, lw, lh);   // twice, so it faces the camera from either side
    c.tex.needsUpdate = true;
  };
  bottleLabel = c.tex; return bottleLabel;
}
function buildBottle() {
  const G = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xE8F4F8, roughness: 0.05, transparent: true, opacity: 0.35, envMapIntensity: 1.4, depthWrite: false });
  const water = new THREE.MeshPhysicalMaterial({ color: 0xBFE3F0, roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.19, 28), glass); body.position.y = 0.095; body.renderOrder = 3; G.add(body);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.034, 0.045, 28), glass); shoulder.position.y = 0.212; shoulder.renderOrder = 3; G.add(shoulder);
  const wat = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.15, 24), water); wat.position.y = 0.078; G.add(wat);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.028, 16), new THREE.MeshStandardMaterial({ color: 0x8C6A3C, roughness: 0.4, metalness: 0.6 })); cap.position.y = 0.248; G.add(cap);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0355, 0.0355, 0.075, 40, 1, true), new THREE.MeshStandardMaterial({ map: labelTexture(), roughness: 0.6 }));
  label.position.y = 0.1; label.rotation.y = -Math.PI / 2; G.add(label);
  G.traverse((n) => { if (n.isMesh) n.castShadow = true; });
  return G;
}

function buildChair() {
  const G = new THREE.Group();
  G.add(cyl(0.26, 0.26, 0.09, mat.red, 0, 0.43, 0, 32));
  G.add(box(0.46, 0.5, 0.07, mat.red, 0, 0.73, -0.24));
  G.add(cyl(0.035, 0.035, 0.38, mat.alu, 0, 0.2, 0));
  G.add(cyl(0.24, 0.26, 0.03, mat.alu, 0, 0.015, 0, 32));
  return G;
}

function buildLightStand(x, z, aimAt) {
  const G = new THREE.Group(); G.position.set(x, 0, z);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = cyl(0.015, 0.015, 0.75, mat.black, Math.cos(a) * 0.25, 0.3, Math.sin(a) * 0.25, 8); leg.rotation.z = Math.cos(a) * 0.55; leg.rotation.x = -Math.sin(a) * 0.55; G.add(leg); }
  G.add(cyl(0.02, 0.02, 2.4, mat.black, 0, 1.5, 0, 8));
  const head = new THREE.Group(); head.position.set(0, 2.75, 0);
  const soft = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.15, 0.45, 16, 1, true), mat.black); soft.rotation.x = Math.PI / 2; head.add(soft);
  const diff = new THREE.Mesh(new THREE.CircleGeometry(0.44, 24), new THREE.MeshBasicMaterial({ color: 0xFFFFFF })); diff.position.z = 0.23; head.add(diff);
  G.add(head); head.lookAt(new THREE.Vector3(aimAt.x - x, aimAt.y, aimAt.z - z).add(new THREE.Vector3(0, 0, 0)));
  head.lookAt(aimAt.clone().sub(G.position));
  return G;
}

function buildCameraRig() {
  const G = new THREE.Group();
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = cyl(0.02, 0.02, 1.3, mat.black, Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3, 8); leg.rotation.z = Math.cos(a) * 0.45; leg.rotation.x = -Math.sin(a) * 0.45; G.add(leg); }
  const body = box(0.24, 0.26, 0.55, mat.dark, 0, 1.38, 0); G.add(body);
  const lens = cyl(0.08, 0.1, 0.3, mat.black, 0, 1.38, 0.4, 20); lens.rotation.x = Math.PI / 2; G.add(lens);
  G.add(box(0.16, 0.12, 0.02, new THREE.MeshBasicMaterial({ color: 0xD0231A }), 0, 1.58, -0.1));
  return G;
}

/* ---------------- the Atlas globe (Phase 2 hook: city pins) ---------------- */
const AFRICA = [[-5.9, 35.8], [-9.8, 31], [-13, 27.5], [-17, 21], [-17.5, 14.7], [-15, 11], [-13, 8.5], [-8, 4.5], [-4, 5.2], [1, 6], [4.5, 6.3], [8.5, 4.5], [9.5, 3.8], [9.8, 1], [9, -1], [11.8, -4.5], [13, -9], [12, -13.5], [11.8, -17], [14.5, -22.5], [15.5, -27], [18, -33], [20, -34.8], [25, -34], [28, -32.8], [32.5, -28.5], [32.8, -26], [35.5, -24], [35.3, -21], [37, -17.5], [40.5, -15], [40.5, -10.5], [39.5, -6], [40, -3], [42, -1], [44, 1.5], [48, 4.8], [51, 10.5], [51.3, 11.8], [48, 11.2], [43.5, 11.5], [43, 13], [39, 15.5], [37.3, 18.5], [36.8, 22], [35, 24.5], [33, 28], [32.3, 31.3], [29, 31], [25, 31.7], [20, 32], [19.5, 30.3], [15, 32.3], [11, 33.5], [10.2, 37], [8, 36.9], [3, 36.8], [-1, 35.5]];
const MADAGASCAR = [[49.3, -12], [50.4, -15.5], [49.5, -17.5], [47.6, -24.5], [45, -25.5], [43.7, -22], [44.4, -16.5], [47, -15.3]];
const ZIMBABWE = [[25.2, -17.8], [27, -17.9], [29, -15.6], [30.4, -15.6], [32.9, -16.7], [33, -19], [32.5, -21], [31.3, -22.4], [29.4, -22.2], [28, -21.5], [26.2, -19.5]];
export const CITIES = [
  { id: 'harare', name: 'Harare', lon: 31.05, lat: -17.83 }, { id: 'bulawayo', name: 'Bulawayo', lon: 28.58, lat: -20.15 },
  { id: 'mutare', name: 'Mutare', lon: 32.67, lat: -18.97 }, { id: 'masvingo', name: 'Masvingo', lon: 30.83, lat: -20.07 },
  { id: 'vicfalls', name: 'Victoria Falls', lon: 25.83, lat: -17.93 }
];
function buildGlobe() {
  const G = new THREE.Group(); G.name = 'atlas';
  const ped = cyl(0.32, 0.42, 0.9, mat.dark, 0, 0.45, 0, 32); G.add(ped);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: 0xFF3B2E })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.905; G.add(ring);
  // photographic Earth (NASA Blue Marble, public domain) with city lights on the dark side
  const tl = new THREE.TextureLoader();
  const day = tl.load('/img/atlas/earth-day.jpg'); day.colorSpace = THREE.SRGBColorSpace; day.anisotropy = 8;
  const night = tl.load('/img/atlas/earth-night.jpg'); night.colorSpace = THREE.SRGBColorSpace;
  const bump = tl.load('/img/atlas/earth-bump.jpg');
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.34, 96, 48), new THREE.MeshStandardMaterial({ map: day, bumpMap: bump, bumpScale: 3, emissiveMap: night, emissive: 0xFFD8A0, emissiveIntensity: 0.35, roughness: 0.75, metalness: 0 }));
  earth.position.y = 1.32; G.add(earth);
  // Zimbabwe outlined in red, on a transparent layer just above the surface
  const { tex } = canvasTex(4096, 2048, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const P = ([lo, la]) => [(lo + 180) / 360 * w, (90 - la) / 180 * h];
    g.beginPath(); ZIMBABWE.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
    g.fillStyle = 'rgba(232,69,59,0.45)'; g.fill(); g.strokeStyle = '#FF5A4A'; g.lineWidth = 5; g.stroke();
  });
  const zim = new THREE.Mesh(new THREE.SphereGeometry(0.3415, 96, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })); earth.add(zim);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.37, 48, 24), new THREE.MeshBasicMaterial({ color: 0x5ABEFF, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.y = 1.32; G.add(halo);
  const sun = new THREE.DirectionalLight(0xFFFFFF, 1.6); sun.position.set(1.2, 1.9, 1.4); sun.target = earth; G.add(sun);
  // a pin for every Atlas city; the focused one pulses
  const at = (lon, la, r) => { const u = (lon + 180) / 360 * Math.PI * 2, lat = la * Math.PI / 180; return new THREE.Vector3(-Math.cos(u) * Math.cos(lat) * r, Math.sin(lat) * r, Math.sin(u) * Math.cos(lat) * r); };
  const pins = {};
  for (const c of CITIES) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), new THREE.MeshBasicMaterial({ color: 0xFFFFFF })); pin.position.copy(at(c.lon, c.lat, 0.343)); earth.add(pin);
    pins[c.id] = { pin, c };
  }
  const pulse = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.02, 24), new THREE.MeshBasicMaterial({ color: 0xFF3B2E, transparent: true, side: THREE.DoubleSide, depthWrite: false })); earth.add(pulse);
  let focus = 'harare', rotY = 0, rotX = 0;
  const aimAt = (id) => { const c = pins[id]?.c || pins.harare.c, p = at(c.lon, c.lat, 1); return { y: -Math.atan2(p.x, p.z), x: c.lat * Math.PI / 180 * 0.9 + 0.12 }; };
  ({ y: rotY, x: rotX } = aimAt(focus)); earth.rotation.set(rotX, rotY, 0);
  return {
    group: G, earth,
    focus(id) { if (pins[id]) focus = id; },
    get focusName() { return pins[focus]?.c.name; },
    update(t, dt = 1 / 60) {
      const a = aimAt(focus), k = Math.min(1, dt * 1.2);
      rotY += Math.atan2(Math.sin(a.y + Math.sin(t * 0.12) * 0.12 - rotY), Math.cos(a.y + Math.sin(t * 0.12) * 0.12 - rotY)) * k; rotX += (a.x - rotX) * k;
      earth.rotation.set(rotX, rotY, 0);
      for (const [id, { pin }] of Object.entries(pins)) pin.material.color.setHex(id === focus ? 0xFF3B2E : 0xFFFFFF);
      const fp = pins[focus].pin.position; pulse.position.copy(fp).multiplyScalar(1.004); pulse.lookAt(fp.clone().multiplyScalar(3));
      const ph = t * 1.2 % 1, sc = 1 + ph * 2.5; pulse.scale.set(sc, sc, sc); pulse.material.opacity = 1 - ph;
    }
  };
}

/* ---------------- tower crane + dust for the build sequence ---------------- */
function buildCrane() {
  const G = new THREE.Group(); G.name = 'crane';
  const Y = new THREE.MeshStandardMaterial({ color: 0xF2B21B, roughness: 0.6, metalness: 0.3 });
  const lattice = (h, w) => { const g = new THREE.Group(); for (const [x, z] of [[-w, -w], [w, -w], [w, w], [-w, w]]) g.add(box(0.035, h, 0.035, Y, x, h / 2, z)); for (let y = 0.3; y < h; y += 0.45) { g.add(box(w * 2, 0.025, 0.025, Y, 0, y, w)); g.add(box(w * 2, 0.025, 0.025, Y, 0, y, -w)); g.add(box(0.025, 0.025, w * 2, Y, w, y, 0)); g.add(box(0.025, 0.025, w * 2, Y, -w, y, 0)); } return g; };
  G.add(box(0.9, 0.15, 0.9, mat.concrete, 0, 0.075, 0));
  const mast = lattice(5.8, 0.16); G.add(mast);
  const slew = new THREE.Group(); slew.position.y = 5.8; G.add(slew);
  slew.add(box(0.5, 0.35, 0.5, Y, 0, 0.18, 0)); slew.add(box(0.3, 0.3, 0.35, mat.dark, 0.1, 0.5, 0));
  const jib = box(6.2, 0.14, 0.14, Y, 2.5, 0.45, 0); slew.add(jib);
  slew.add(box(2.0, 0.14, 0.14, Y, -1.2, 0.45, 0)); slew.add(box(0.6, 0.45, 0.5, mat.concrete, -2.0, 0.3, 0));
  slew.add(box(0.06, 1.1, 0.06, Y, 0, 1.0, 0));
  const trolley = new THREE.Group(); trolley.position.set(3.5, 0.36, 0); slew.add(trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6), mat.black); trolley.add(cable);
  const hook = new THREE.Group(); hook.add(box(0.12, 0.08, 0.06, Y, 0, 0, 0)); hook.add(box(0.5, 0.18, 0.5, mat.concrete, 0, -0.25, 0)); trolley.add(hook);
  let vis = 0;
  return {
    group: G,
    update(t, dt, active) {
      vis += ((active ? 1 : 0) - vis) * Math.min(1, dt * 1.5); G.visible = vis > 0.02; G.position.y = (1 - vis) * -8;
      slew.rotation.y = Math.sin(t * 0.18) * 0.45 + 3.5;   // jib swings over the building
      trolley.position.x = 2.6 + Math.sin(t * 0.23) * 1.2;
      const drop = 1.8 + Math.sin(t * 0.31) * 1.2; hook.position.y = -drop; cable.scale.y = drop; cable.position.y = -drop / 2;
    }
  };
}
function buildDust() {
  const N = 260, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sprite = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(230,220,205,0.9)'); r.addColorStop(1, 'rgba(230,220,205,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }).tex;
  const m = new THREE.PointsMaterial({ size: 0.45, map: sprite, transparent: true, depthWrite: false, opacity: 0.55 });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; let next = 0;
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -99;
  return {
    points: pts,
    puff(center, radius, y, n = 50) {
      for (let k = 0; k < n; k++) {
        const i = next++ % N, a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
        pos.set([center.x + Math.cos(a) * r, y + Math.random() * 0.3, center.z + Math.sin(a) * r], i * 3);
        vel.set([Math.cos(a) * (0.3 + Math.random() * 0.5), 0.25 + Math.random() * 0.4, Math.sin(a) * (0.3 + Math.random() * 0.5)], i * 3);
        life[i] = 1.4 + Math.random();
      }
    },
    update(dt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) { pos[i * 3 + 1] = -99; continue; }
        life[i] -= dt; for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * dt; vel[i * 3 + 1] *= 0.97;
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

/* ---------------- the big story screen (animated journalism) ---------------- */
function buildScreen() {
  const W = 3.2, H = 1.8;
  const c = canvasTex(1600, 900, () => {});
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: c.tex, toneMapped: false }));
  const frame = box(W + 0.08, H + 0.08, 0.06, mat.black, 0, 0, -0.04);
  const G = new THREE.Group(); G.add(frame); G.add(m);
  const screen = {
    group: G, slide: null,
    show(slide) {
      this.slide = slide; const g = c.ctx, w = 1600, h = 900;
      const img = slide?.image ? loadImg(slide.image, () => { if (this.slide === slide) this.show(slide); }) : null;
      const pic = img && img.complete && img.naturalWidth ? img : null;
      const tw = pic ? 820 : 1300;
      const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#12161C'); bg.addColorStop(1, '#1D232B'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.05)'; for (let x = 0; x < w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      g.fillStyle = '#D0231A'; g.fillRect(0, 0, 14, h);
      drawMark(g, 1450, 40, 100, '#E8453B');
      if (!slide) { g.fillStyle = '#fff'; g.font = '800 90px Montserrat, sans-serif'; g.fillText('KARLCON', 80, 420); g.font = '600 40px "IBM Plex Mono", monospace'; g.fillStyle = '#E8453B'; g.fillText('STUDIOS · LIVE', 84, 490); c.tex.needsUpdate = true; return; }
      g.fillStyle = '#E8453B'; g.font = '600 34px "IBM Plex Mono", monospace'; g.fillText((slide.kicker || '').toUpperCase(), 80, 110);
      g.fillStyle = '#FFFFFF'; g.font = '800 72px Montserrat, sans-serif';
      g.font = `800 ${pic ? 60 : 72}px Montserrat, sans-serif`;
      const ty = wrap(g, slide.title || '', 80, 200, tw, pic ? 70 : 82, 2);
      let y = Math.max(ty + 40, 320);
      g.font = '500 40px Inter, sans-serif';
      for (const [i, line] of (slide.lines || []).entries()) {
        g.fillStyle = '#E8453B'; g.font = '600 34px "IBM Plex Mono", monospace'; g.fillText(String(i + 1).padStart(2, '0'), 80, y);
        g.fillStyle = 'rgba(255,255,255,0.92)'; g.font = '500 40px Inter, sans-serif'; y = wrap(g, line, 160, y, tw - 60, 50, 2) + 26;
        if (y > 860) break;
      }
      if (pic) {   // the concept render, cropped to a 4:5 panel on the right
        const pw = 560, ph = 700, px = 960, py = 150, r = pic.naturalWidth / pic.naturalHeight, want = pw / ph;
        let sw = pic.naturalWidth, sh = pic.naturalHeight, sx = 0, sy = 0;
        if (r > want) { sw = sh * want; sx = (pic.naturalWidth - sw) / 2; } else { sh = sw / want; sy = (pic.naturalHeight - sh) / 2; }
        g.fillStyle = '#000'; g.fillRect(px - 6, py - 6, pw + 12, ph + 12);
        g.drawImage(pic, sx, sy, sw, sh, px, py, pw, ph);
        g.fillStyle = '#D0231A'; g.fillRect(px - 6, py + ph + 6, pw + 12, 8);
      }
      c.tex.needsUpdate = true;
    }
  };
  screen.show(null);
  return screen;
}
const _imgs = new Map();
function loadImg(url, onload) {
  let im = _imgs.get(url);
  if (!im) { im = new Image(); im.decoding = 'async'; im.src = url; _imgs.set(url, im); }
  if (!im.complete) im.addEventListener('load', onload, { once: true });
  return im;
}
function wrap(g, text, x, y, maxW, lh, maxLines = 3) {
  const words = text.split(' '); let line = '', n = 0;
  for (const w of words) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) { } } else line = t; }
  g.fillText(line, x, y); return y + lh;
}

/* ---------------- assemble ---------------- */
export function buildStudio(scene, renderer, { quality = 'high', Reflector = null } = {}) {
  const S = { quality };
  // floor: polished studio floor; on High it really reflects the set
  const high = quality === 'high' && Reflector;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 96), new THREE.MeshPhysicalMaterial({ color: 0x5C6068, roughness: 0.22, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.2, transparent: !!high, opacity: high ? 0.86 : 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  if (high) {
    const mirror = new Reflector(new THREE.CircleGeometry(16, 64), { textureWidth: 1024, textureHeight: 1024, color: 0x777a80, clipBias: 0.003 });
    mirror.rotation.x = -Math.PI / 2; mirror.position.y = -0.004; scene.add(mirror); S.mirror = mirror;
  }
  const ringMark = new THREE.Mesh(new THREE.RingGeometry(3.35, 3.4, 128), new THREE.MeshBasicMaterial({ color: 0xD0231A })); ringMark.rotation.x = -Math.PI / 2; ringMark.position.set(0, 0.003, 0.4); scene.add(ringMark);

  // curved LED wall
  const bp = canvasTex(4096, 1400, drawBlueprint);
  bp.tex.wrapS = THREE.RepeatWrapping; bp.tex.repeat.x = -1; bp.tex.offset.x = 1;   // seen from inside the curve
  const wallGeo = new THREE.CylinderGeometry(10, 10, 7, 96, 1, true, Math.PI * 0.62, Math.PI * 0.76);
  const wall = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ map: bp.tex, side: THREE.BackSide, toneMapped: false, color: 0xC8CDD4 }));
  wall.position.set(0, 3.5, 2.6); scene.add(wall);
  // lighting truss

  // featured building
  // one building per episode stands on the same spot; only the current one is shown
  S.buildings = {};
  for (const id of STAGE_IDS) {
    const b = BUILDERS[id](); b.group.position.set(0.9, 0, -4.1); b.group.rotation.y = -0.16; b.group.scale.setScalar(b.scale);
    b.group.visible = false; scene.add(b.group); S.buildings[id] = b;
  }
  S.stageIds = STAGE_IDS;
  S.house = S.buildings['cantilever-pavilion']; S.house.group.visible = true;
  S.showBuilding = (id) => {
    const b = S.buildings[id]; if (!b) return false;
    if (b !== S.house) { S.house.group.visible = false; b.reset(); b.group.visible = true; S.house = b; }
    for (const st of S.stools || []) st.visible = id === 'cantilever-pavilion';
    return true;
  };
  // desk + chairs
  S.desk = buildDesk(); S.desk.group.position.set(0, 0, 1.38); scene.add(S.desk.group);
  S.seats = [
    { pos: new THREE.Vector3(-0.78, 0, 0.9), rotY: 0.28 },
    { pos: new THREE.Vector3(0.78, 0, 0.9), rotY: -0.28 }
  ];
  for (const s of S.seats) { const ch = buildChair(); ch.position.copy(s.pos).add(new THREE.Vector3(Math.sin(s.rotY) * -0.05, 0, -0.05)); ch.rotation.y = s.rotY; scene.add(ch); }
  // decor: red stools under the building, like the render
  const stools = [];   // from the Glass Cube render: shown only with that building
  for (const [x, z] of [[-0.3, -1.4], [0.25, -1.1]]) { const st = new THREE.Group(); st.add(cyl(0.2, 0.13, 0.46, mat.red, 0, 0.23, 0)); st.add(cyl(0.21, 0.21, 0.04, mat.red, 0, 0.48, 0)); st.position.set(x, 0, z); scene.add(st); stools.push(st); }
  S.stools = stools;
  // story screen on the left of the stage
  S.screen = buildScreen(); S.screen.group.position.set(-3.7, 2.75, -2.6); S.screen.group.rotation.y = 0.5; scene.add(S.screen.group);
  const post = cyl(0.05, 0.05, 1.85, mat.black, -3.7, 0.93, -2.62, 12); scene.add(post);
  // atlas globe, bottom-left of the sketch
  S.globe = buildGlobe(); S.globe.group.position.set(-3.3, 0, 1.6); scene.add(S.globe.group);
  // light stands + broadcast camera
  const aim = new THREE.Vector3(0, 1.2, 0.9);
  for (const [x, z] of [[-3.4, 3.4], [3.6, 3.6], [5.8, -5.6]]) scene.add(buildLightStand(x, z, aim));
  const rig = buildCameraRig(); rig.position.set(-2.1, 0, 4.6); rig.rotation.y = Math.PI + 0.45; scene.add(rig);

  // lights
  scene.add(new THREE.HemisphereLight(0xDDE6F2, 0x2A2D33, 0.55));
  const key = new THREE.SpotLight(0xFFF4E8, 90, 30, 0.5, 0.6, 1.6); key.position.set(-3.2, 5.2, 5.5); key.target.position.set(0, 1.1, 0.8);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.camera.near = 2; key.shadow.camera.far = 20;
  scene.add(key, key.target);
  const fill = new THREE.SpotLight(0xE6EEFF, 45, 30, 0.6, 0.8, 1.6); fill.position.set(3.6, 4, 5); fill.target.position.set(0, 1.2, 0.8); scene.add(fill, fill.target);
  const rim = new THREE.SpotLight(0xFFD8C8, 70, 30, 0.45, 0.6, 1.4); rim.position.set(0, 5.5, -2.2); rim.target.position.set(0, 1.2, 1); scene.add(rim, rim.target);
  const houseKey = new THREE.SpotLight(0xFFFFFF, 140, 30, 0.55, 0.7, 1.4); houseKey.position.set(5, 8, 2); houseKey.target.position.set(0.9, 3, -4.1);
  houseKey.castShadow = true; houseKey.shadow.mapSize.set(2048, 2048); houseKey.shadow.bias = -0.0005; houseKey.shadow.normalBias = 0.03;
  scene.add(houseKey, houseKey.target);

  // softbox panels on the light stands: real area lights (High)
  if (quality === 'high') {
    for (const [x, z, w] of [[-3.4, 3.4, 30], [3.6, 3.6, 22]]) {
      const ra = new THREE.RectAreaLight(0xFFF1E0, w, 0.9, 0.9); ra.position.set(x, 2.75, z); ra.lookAt(0, 1.1, 0.9); scene.add(ra);
    }
  }
  // the build sequence: a tower crane beside the building, dust as each stage lands
  S.crane = buildCrane(); S.crane.group.position.set(4.6, 0, -5.9); scene.add(S.crane.group);
  S.dust = buildDust(); scene.add(S.dust.points);
  let lastStage = 7;
  S.update = (t, dt) => {
    const H = S.house; H.update(dt); S.globe.update(t, dt);
    const building = H.build < 6.95 || H.buildTarget < 7;
    S.crane.update(t, dt, building);
    const st = Math.floor(H.build + 0.02);
    if (st !== lastStage) {
      if (st > lastStage && st <= 6) { const c = H.group.localToWorld(H.centre.clone()); const ext = H.group.scale.x * 3; S.dust.puff(new THREE.Vector3(c.x, 0, c.z), ext, st <= 2 ? 0.05 : c.y * (st / 5), 40); }
      lastStage = st;
    }
    S.dust.update(dt);
  };
  S.aim = aim;
  return S;
}
