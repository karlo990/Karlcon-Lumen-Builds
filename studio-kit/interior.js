/* KARLCON Studio — the Concept Room's interior: carpet, decor sets, and light that changes with the show.

   Why it looks the way it does (the design case, docs/STUDIO-ARCHITECTURE.md §11):
   · Floor: graphite loop-pile carpet tiles, laid quarter-turned (each 50 cm tile at 90° to its neighbour,
     the usual commercial layout: it hides seams and wear), under a forest-green wool rug where the hosts
     stand. A matte, textured floor instead of a white reflective plane: it grounds the figures, stops the
     floor competing with the faces for brightness, and (in a real room) absorbs sound.
   · Plants in every sightline. Offices enriched with plants rated higher for satisfaction, concentration
     and air quality, and were 15 % more productive (Nieuwenhuis et al. 2014). "Visual connection with
     nature" and "dynamic & diffuse light" are two of the 14 Patterns of Biophilic Design (Browning, Ryan
     & Clancy 2014).
   · Colour: the brand's red, black and oak on white; greens from the plants and the rug; terracotta for
     the vases and pots. Terracotta sits opposite green on the colour wheel (so the plants read greener
     next to it), and it is a quiet, earthy cousin of KARLCON red, so the brand red stays the only loud
     colour in the room. Blue-green and green are among the most pleasant hues; brightness raises
     pleasure and saturation raises arousal (Valdez & Mehrabian 1994). Good colour design lifts mood in
     real workplaces (Küller et al. 2006).
   · Light: peripheral, non-uniform light (washes on the walls, uplights behind plants) reads as more
     pleasant and relaxed than uniform overhead light (Flynn et al. 1973). Warm light at lower levels and
     cooler light at higher levels are the combinations people find pleasing (Kruithof 1941).
   · The fourth dimension: time. One director drives every light source together, so the room changes as
     one system:
       calm   → 3400 K, amber cove light, plants glowing green, softer
       groove → 4200 K, blue-green cove light
       hype   → 5200 K, brighter, the cove in KARLCON red, the red datum line glowing
     A change of mood travels outward from the mock-up as a wave, 5 m/s through the room. Underneath runs
     slow daylight: the sun moves across the room over 15 minutes, passing clouds change its strength,
     and leaf shadows drift on the walls behind the plants. Nothing flickers: every change is slower
     than 0.1 Hz. */
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (u) => u * u * (3 - 2 * u);
const wave = (t, s) => Math.sin(t * 0.63 + s) * 0.55 + Math.sin(t * 1.37 + s * 2.1) * 0.3 + Math.sin(t * 2.9 + s * 3.7) * 0.15;
const rnd = (() => { let s = 20240917; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; })();   // the same room every time

function tex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** colour of a black body at K kelvin (Tanner Helland's fit), for tuning white light */
export function kelvin(K) {
  const t = K / 100, c = (v) => clamp(v, 0, 255) / 255; let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
}

/* ---------------- floor ---------------- */
/** graphite loop-pile carpet tiles, 50 cm, quarter-turned; the texture is 1 m square */
export function makeCarpet(w = 24, d = 18) {
  const draw = (bump) => (g, W, H) => {
    const T = W / 2, pal = bump ? ['#9A9A9A', '#7A7A7A', '#B0B0B0', '#6A6A6A'] : ['#45484D', '#383A3E', '#4E5156', '#303236'];
    g.fillStyle = bump ? '#808080' : '#3C3E42'; g.fillRect(0, 0, W, H);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const across = (tx + ty) % 2 === 0;                                     // quarter-turned: rows alternate direction
      for (let a = 1; a < T; a += 4) for (let b = 0; b < T; b += 3) {
        const k = rnd(); g.fillStyle = k < 0.012 && !bump ? '#6E5E4E' : pal[(k * 4) | 0];   // heather, a rare warm fleck
        const x = tx * T + (across ? b : a), y = ty * T + (across ? a : b);
        g.fillRect(x, y, across ? 3 : 2.4, across ? 2.4 : 3);
      }
      g.fillStyle = bump ? 'rgba(0,0,0,0.5)' : 'rgba(20,20,22,0.55)';          // the seam between tiles
      g.fillRect(tx * T, ty * T, T, 2); g.fillRect(tx * T, ty * T, 2, T);
    }
  };
  const map = tex(1024, 1024, draw(false)), bump = tex(1024, 1024, draw(true), false);
  for (const t of [map, bump]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w, d); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.2, roughness: 0.96, metalness: 0 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; m.name = 'carpet';
  return m;
}
/** the hosts' rug: forest-green wool, an oat border with a terracotta pinstripe, the KARLCON hexagon tone on tone */
export function makeRug(w = 6.4, d = 3.2) {
  const map = tex(1280, 640, (g, W, H) => {
    g.fillStyle = '#2C4637'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 60000; i++) { const k = rnd(); g.fillStyle = k < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; g.fillRect(rnd() * W, rnd() * H, 2, 2); }   // wool
    g.strokeStyle = 'rgba(120,170,130,0.055)'; g.lineWidth = 4;                                                  // hexagons, tone on tone
    const R = 60; for (let y = 0, row = 0; y < H + R; y += R * 1.5, row++) for (let x = row % 2 ? R * 0.87 : 0; x < W + R; x += R * 1.74) {
      g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8); } g.closePath(); g.stroke();
    }
    const b = H * 0.044; g.lineWidth = b; g.strokeStyle = '#E6DDCB'; g.strokeRect(b / 2, b / 2, W - b, H - b);   // oat border
    g.lineWidth = 3; g.strokeStyle = '#B4623D'; g.strokeRect(b * 1.35, b * 1.35, W - b * 2.7, H - b * 2.7);      // terracotta pinstripe
  });
  const top = new THREE.MeshStandardMaterial({ map, roughness: 0.97 }), side = new THREE.MeshStandardMaterial({ color: 0xE6DDCB, roughness: 0.97 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), [side, side, top, side, side, side]);
  m.receiveShadow = true; m.name = 'rug'; return m;
}

/* ---------------- materials ---------------- */
const speckle = (base, dots) => tex(256, 256, (g, W, H) => { g.fillStyle = base; g.fillRect(0, 0, W, H); for (let i = 0; i < 2500; i++) { g.fillStyle = dots[(rnd() * dots.length) | 0]; g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); } });
const MAT = {
  terracotta: new THREE.MeshStandardMaterial({ map: speckle('#B4623D', ['rgba(90,40,20,0.3)', 'rgba(230,170,130,0.25)']), roughness: 0.86, side: THREE.DoubleSide }),
  sand: new THREE.MeshStandardMaterial({ map: speckle('#D9CBB2', ['rgba(120,100,80,0.25)']), roughness: 0.72, side: THREE.DoubleSide }),
  celadon: new THREE.MeshPhysicalMaterial({ color: 0x2F5D4A, roughness: 0.22, clearcoat: 0.8, side: THREE.DoubleSide }),
  planter: new THREE.MeshStandardMaterial({ color: 0x2B2C2F, roughness: 0.62, metalness: 0.1 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x2A2019, roughness: 1 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5B4632, roughness: 0.9 }),
  oak: new THREE.MeshStandardMaterial({ color: 0xB0875A, roughness: 0.58 }),
  black: new THREE.MeshStandardMaterial({ color: 0x1C1D20, roughness: 0.45, metalness: 0.5 }),
  boucle: new THREE.MeshStandardMaterial({ map: speckle('#D9D0C1', ['rgba(255,255,255,0.35)', 'rgba(120,110,95,0.3)']), roughness: 1 }),
  cognac: new THREE.MeshPhysicalMaterial({ color: 0x8A4B2A, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
  marble: new THREE.MeshStandardMaterial({ color: 0xEDEBE6, roughness: 0.3 })
};
const mesh = (geo, m, x = 0, y = 0, z = 0, shadow = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o; };

/* an upholstered block with soft, rounded edges */
function cushion(w, h, d, r = 0.045) {
  const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r, q = Math.min(r, x, y) * 0.8;
  s.moveTo(-x + q, -y); s.lineTo(x - q, -y); s.quadraticCurveTo(x, -y, x, -y + q); s.lineTo(x, y - q); s.quadraticCurveTo(x, y, x - q, y);
  s.lineTo(-x + q, y); s.quadraticCurveTo(-x, y, -x, y - q); s.lineTo(-x, -y + q); s.quadraticCurveTo(-x, -y, -x + q, -y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 5 });
  g.translate(0, 0, -(d - 2 * r) / 2); g.computeVertexNormals(); return g;
}
/* a turned vase from a profile of [radius, height] points */
function vase(profile, m) { return mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 40), m); }
const VASES = {
  amphora: [[0, 0], [0.09, 0], [0.11, 0.05], [0.145, 0.2], [0.135, 0.34], [0.085, 0.45], [0.06, 0.51], [0.072, 0.56], [0.058, 0.55]],
  bottle: [[0, 0], [0.07, 0], [0.09, 0.08], [0.092, 0.22], [0.05, 0.3], [0.026, 0.39], [0.03, 0.42], [0.022, 0.41]],
  bowl: [[0, 0], [0.08, 0], [0.15, 0.05], [0.18, 0.12], [0.17, 0.17], [0.155, 0.165]],
  floor: [[0, 0], [0.13, 0], [0.17, 0.12], [0.2, 0.42], [0.16, 0.66], [0.1, 0.76], [0.11, 0.82], [0.095, 0.81]]
};

/* ---------------- plants ---------------- */
const LEAF = {
  fig: new THREE.MeshStandardMaterial({ map: tex(128, 192, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    const path = () => { g.beginPath(); g.moveTo(64, 190); g.bezierCurveTo(18, 172, 4, 122, 22, 82); g.bezierCurveTo(30, 52, 16, 18, 64, 4); g.bezierCurveTo(112, 18, 98, 52, 106, 82); g.bezierCurveTo(124, 122, 110, 172, 64, 190); };
    const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#1C4A2B'); gr.addColorStop(0.5, '#3A7A40'); gr.addColorStop(1, '#1C4A2B');
    path(); g.fillStyle = gr; g.fill();
    g.strokeStyle = '#8DB36F'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(64, 188); g.lineTo(64, 12); g.stroke();
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(141,179,111,0.7)';
    for (let y = 40; y < 180; y += 16) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * 22, y - 10, 64 + s * 40, y - 22); g.stroke(); }
  }), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, emissive: 0x000000 }),
  snake: new THREE.MeshStandardMaterial({ map: tex(64, 512, (g, W, H) => {
    g.clearRect(0, 0, W, H);
    g.beginPath(); g.moveTo(8, H); g.bezierCurveTo(4, H * 0.5, 14, H * 0.2, 32, 2); g.bezierCurveTo(50, H * 0.2, 60, H * 0.5, 56, H); g.closePath();
    g.fillStyle = '#244A2C'; g.fill(); g.save(); g.clip();
    for (let y = 20; y < H; y += 26 + rnd() * 14) { g.strokeStyle = 'rgba(150,180,110,0.45)'; g.lineWidth = 4 + rnd() * 4; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x * 0.2 + y) * 5); g.stroke(); }
    g.strokeStyle = '#D6C35C'; g.lineWidth = 7; g.beginPath(); g.moveTo(8, H); g.bezierCurveTo(4, H * 0.5, 14, H * 0.2, 32, 2); g.bezierCurveTo(50, H * 0.2, 60, H * 0.5, 56, H); g.stroke();
    g.restore();
  }), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, emissive: 0x000000 }),
  euca: new THREE.MeshStandardMaterial({ color: 0x8FA89A, roughness: 0.7, side: THREE.DoubleSide, emissive: 0x000000 })
};
function leafGeo(w, h, cup, curl, segX = 4, segY = 6) {
  const g = new THREE.PlaneGeometry(w, h, segX, segY); g.translate(0, h / 2, 0);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), y = p.getY(i) / h; p.setZ(i, -cup * x * x * w * 0.5 + curl * y * y * h); }
  g.computeVertexNormals(); return g;
}
function instanced(geo, m, list) {
  const im = new THREE.InstancedMesh(geo, m, list.length), o = new THREE.Object3D();
  list.forEach(([pos, euler, s], i) => { o.position.copy(pos); o.rotation.copy(euler); o.scale.set(s, s, s); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.receiveShadow = true; return im;
}
/** a fiddle-leaf fig in a tall ribbed planter; H: height of the plant above the pot */
function fig(H = 1.7) {
  const G = new THREE.Group(), potH = 0.55;
  G.add(mesh(new THREE.CylinderGeometry(0.27, 0.21, potH, 48), MAT.planter, 0, potH / 2, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 32), MAT.soil, 0, potH - 0.03, 0, false));
  const leaves = [];
  [[0, 1], [0.1, 0.82], [-0.12, 0.7]].forEach(([lean, k], si) => {
    const h = H * k, dir = V(Math.sin(si * 2.1) * lean, 1, Math.cos(si * 2.1) * lean).normalize();
    const trunk = mesh(new THREE.CylinderGeometry(0.014, 0.024, h, 8), MAT.bark, 0, 0, 0, false);
    trunk.position.copy(dir.clone().multiplyScalar(h / 2)).add(V(0, potH - 0.03, 0)); trunk.quaternion.setFromUnitVectors(V(0, 1, 0), dir); G.add(trunk);
    const n = Math.round(18 * k);
    for (let i = 0; i < n; i++) {
      const u = 0.35 + 0.65 * Math.pow(i / (n - 1), 0.8), at = dir.clone().multiplyScalar(h * u).add(V(0, potH - 0.03, 0));
      const az = i * 2.39996 + si, pitch = -(0.55 + rnd() * 0.5) + u * 0.25, reach = 0.04 + (1 - u) * 0.14;   // leaves on short stalks, wider lower down
      at.add(V(Math.sin(az) * reach, 0, Math.cos(az) * reach));
      leaves.push([at, new THREE.Euler(pitch, az, (rnd() - 0.5) * 0.5, 'YXZ'), 0.75 + (1 - u) * 0.5 + rnd() * 0.15]);
    }
  });
  G.add(instanced(leafGeo(0.26, 0.38, 0.35, 0.18), LEAF.fig, leaves));
  return G;
}
/** a snake plant (sansevieria): upright sword leaves */
function snake(pot = 'terracotta') {
  const G = new THREE.Group(), potH = 0.34;
  G.add(pot === 'terracotta' ? vase([[0, 0], [0.13, 0], [0.16, potH], [0.15, potH]], MAT.terracotta) : mesh(new THREE.CylinderGeometry(0.17, 0.14, potH, 40), MAT.planter, 0, potH / 2, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 24), MAT.soil, 0, potH - 0.03, 0, false));
  const leaves = [];
  for (let i = 0; i < 11; i++) { const a = i * 2.39996, r = 0.03 + rnd() * 0.07; leaves.push([V(Math.cos(a) * r, potH - 0.03, Math.sin(a) * r), new THREE.Euler(-(0.04 + rnd() * 0.22), a + Math.PI / 2, (rnd() - 0.5) * 0.3, 'YXZ'), 0.55 + rnd() * 0.5]); }
  G.add(instanced(leafGeo(0.085, 1.0, 0.5, 0.06, 2, 8), LEAF.snake, leaves));
  return G;
}
/** eucalyptus stems arranged in a vase */
function eucalyptus(v = 'floor', m = MAT.terracotta) {
  const G = new THREE.Group(), body = vase(VASES[v], m); G.add(body);
  const top = VASES[v][VASES[v].length - 2][1], stems = new THREE.Group(), leaves = [];
  for (let s = 0; s < 7; s++) {
    const a = s * 0.9 + rnd() * 0.4, len = 0.55 + rnd() * 0.4, out = 0.18 + rnd() * 0.25;
    const curve = new THREE.QuadraticBezierCurve3(V(0, top - 0.1, 0), V(Math.cos(a) * out * 0.3, top + len * 0.6, Math.sin(a) * out * 0.3), V(Math.cos(a) * out, top + len, Math.sin(a) * out));
    stems.add(mesh(new THREE.TubeGeometry(curve, 10, 0.004, 4), MAT.bark, 0, 0, 0, false));
    for (let k = 3; k <= 14; k++) { const p = curve.getPoint(k / 14); for (const side of [-1, 1]) leaves.push([p, new THREE.Euler(side * 1.1, a + side * 0.6, 0), 0.7 + (1 - k / 14) * 0.5]); }
  }
  G.add(stems);
  const lg = new THREE.CircleGeometry(0.028, 10); lg.translate(0, 0.024, 0);
  G.add(instanced(lg, LEAF.euca, leaves));
  return G;
}

/* ---------------- furniture ---------------- */
function sofa() {                             // oat bouclé, faces +z
  const G = new THREE.Group(), L = 2.3, D = 0.95;
  G.add(mesh(cushion(L, 0.26, D), MAT.boucle, 0, 0.25, 0));
  for (const x of [-0.53, 0.53]) G.add(mesh(cushion(1.04, 0.16, 0.78, 0.05), MAT.boucle, x, 0.45, 0.07));
  G.add(mesh(cushion(L, 0.5, 0.22, 0.06), MAT.boucle, 0, 0.62, -D / 2 + 0.11));
  for (const x of [-L / 2 + 0.1, L / 2 - 0.1]) G.add(mesh(cushion(0.2, 0.36, D, 0.05), MAT.boucle, x, 0.5, 0));
  for (const [x, z] of [[-1.05, -0.38], [1.05, -0.38], [-1.05, 0.38], [1.05, 0.38]]) G.add(mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.12, 12), MAT.oak, x, 0.06, z));
  return G;
}
function loungeChair() {                      // cognac leather on an oak frame, faces +z
  const G = new THREE.Group();
  G.add(mesh(cushion(0.72, 0.14, 0.7, 0.05), MAT.cognac, 0, 0.38, 0.02));
  const back = mesh(cushion(0.72, 0.56, 0.13, 0.05), MAT.cognac, 0, 0.68, -0.32); back.rotation.x = -0.22; G.add(back);
  for (const x of [-0.4, 0.4]) { G.add(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.72), MAT.oak, x, 0.56, 0)); for (const z of [-0.3, 0.3]) { const l = mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.56, 10), MAT.oak, x, 0.28, z); l.rotation.x = z > 0 ? 0.08 : -0.08; G.add(l); } }
  return G;
}
function coffeeTable() {
  const G = new THREE.Group();
  G.add(mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.035, 48), MAT.oak, 0, 0.42, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 20), MAT.black, 0, 0.2, 0));
  G.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.02, 32), MAT.black, 0, 0.01, 0));
  [['#E9E3D6', 0.03], ['#1E2024', 0.025], ['#B4623D', 0.02]].reduce((y, [c, h]) => { const b = mesh(new THREE.BoxGeometry(0.3, h, 0.22), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), -0.18, y + h / 2, 0.1); b.rotation.y = rnd() * 0.3; G.add(b); return y + h; }, 0.4375);
  const bowl = vase(VASES.bowl, MAT.celadon); bowl.scale.setScalar(0.8); bowl.position.set(0.2, 0.4375, -0.1); G.add(bowl);
  return G;
}
function arcLamp() {                          // arcs toward +z; the shade glows warm (the 'lamp' channel)
  const G = new THREE.Group();
  G.add(mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.05, 32), MAT.marble, 0, 0.025, 0));
  const curve = new THREE.CubicBezierCurve3(V(0, 0.05, 0), V(0, 2.2, 0), V(0, 2.35, 1.0), V(0, 1.95, 1.65));
  G.add(mesh(new THREE.TubeGeometry(curve, 40, 0.012, 8), MAT.black, 0, 0, 0, false));
  const shade = mesh(new THREE.SphereGeometry(0.21, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1C1D20, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide }), 0, 1.93, 1.65, false);
  G.add(shade);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xFFC98A, emissiveIntensity: 3 });
  const glow = mesh(new THREE.CircleGeometry(0.18, 24), glowMat, 0, 1.94, 1.65, false); glow.rotation.x = Math.PI / 2; G.add(glow);
  G.userData.glow = glowMat; return G;
}
function credenza() {                         // fluted oak, faces +z, 2.4 m
  const G = new THREE.Group(), L = 2.4;
  G.add(mesh(new THREE.BoxGeometry(L, 0.55, 0.45), MAT.oak, 0, 0.42, 0));
  for (let i = 0; i < 48; i++) G.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), MAT.oak, -L / 2 + 0.03 + i * (L - 0.06) / 47, 0.42, 0.226, false));
  for (const x of [-1.1, 1.1]) for (const z of [-0.17, 0.17]) G.add(mesh(new THREE.BoxGeometry(0.04, 0.15, 0.04), MAT.black, x, 0.075, z));
  const top = 0.695;
  const a = vase(VASES.amphora, MAT.terracotta); a.position.set(-0.8, top, 0); G.add(a);
  const b = vase(VASES.bottle, MAT.sand); b.position.set(-0.52, top, 0.06); G.add(b);
  const e = eucalyptus('bottle', MAT.celadon); e.position.set(0.75, top, 0); G.add(e);
  [['#1E2024', 0.03], ['#E9E3D6', 0.04], ['#2E4A3A', 0.025]].reduce((y, [c, h]) => { G.add(mesh(new THREE.BoxGeometry(0.34, h, 0.25), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), 0.3, y + h / 2, 0.02)); return y + h; }, top);
  // a framed concept sketch leaning on the wall: a pyramid roof light in red line
  const art = tex(480, 640, (g, W, H) => {
    g.fillStyle = '#F4F1EA'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#D0231A'; g.lineWidth = 4; g.beginPath(); g.moveTo(80, 420); g.lineTo(240, 220); g.lineTo(400, 420); g.closePath(); g.stroke();
    g.lineWidth = 2; for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(80 + i * 53, 420); g.lineTo(240, 220); g.stroke(); }
    g.strokeStyle = '#1B1D21'; g.lineWidth = 3; g.strokeRect(70, 420, 340, 34);
    g.fillStyle = '#1B1D21'; g.font = '700 26px Montserrat, sans-serif'; g.fillText('KARLCON', 80, 540); g.fillStyle = '#6B6F76'; g.font = '500 18px Inter, sans-serif'; g.fillText('Concept No. 3 · Pyramid roof light', 80, 572);
  });
  const frame = new THREE.Group(); frame.add(mesh(new THREE.BoxGeometry(0.64, 0.84, 0.03), MAT.oak, 0, 0, 0));
  const pic = mesh(new THREE.PlaneGeometry(0.56, 0.76), new THREE.MeshStandardMaterial({ map: art, roughness: 0.85 }), 0, 0, 0.016, false); frame.add(pic);
  frame.position.set(-0.05, top + 0.42, -0.12); frame.rotation.x = -0.1; G.add(frame);
  return G;
}

/* ---------------- light: washes on the walls, LED coves ---------------- */
const washTex = {
  cove: tex(64, 256, (g, W, H) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }),
  // an uplight behind a plant: a cone of light fading up the wall, dappled by leaf shadows
  plant: tex(256, 512, (g, W, H) => {
    const gr = g.createRadialGradient(W / 2, H, 10, W / 2, H * 0.75, H * 0.8); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-in';                          // soft at the sides and the top: no edge on the wall
    const sx = g.createLinearGradient(0, 0, W, 0); sx.addColorStop(0, 'rgba(0,0,0,0)'); sx.addColorStop(0.3, 'rgba(0,0,0,1)'); sx.addColorStop(0.7, 'rgba(0,0,0,1)'); sx.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sx; g.fillRect(0, 0, W, H);
    const sy = g.createLinearGradient(0, 0, 0, H); sy.addColorStop(0, 'rgba(0,0,0,0)'); sy.addColorStop(0.35, 'rgba(0,0,0,1)'); sy.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = sy; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) { const x = W * (0.15 + rnd() * 0.7), y = H * (0.1 + rnd() * 0.75), r = 8 + rnd() * 26; g.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.35})`; g.beginPath(); g.ellipse(x, y, r, r * 1.6, rnd() * 3, 0, Math.PI * 2); g.fill(); }
  })
};
// the halo behind the oak slat wall (behind the hosts in most shots): an ellipse of light, soft all round
washTex.halo = tex(256, 256, (g, W, H) => { const gr = g.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
washTex.plant.wrapS = washTex.plant.wrapT = THREE.ClampToEdgeWrapping;
function wash(kind, w, h) {
  const m = new THREE.MeshBasicMaterial({ map: washTex[kind], color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });   // coloured light on a pale wall: the wall takes on the colour
  const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.renderOrder = -1; return o;   // (drawn before signs and glass in front of them)
}
/* place a plane flat on a wall: which wall, a position along it, its bottom (or top) height */
const WALLS = {
  back: { at: (s) => V(s, 0, -6.485), rotY: 0 },
  front: { at: (s) => V(s, 0, 9.492), rotY: Math.PI },
  left: { at: (s) => V(-9.388, 0, s), rotY: Math.PI / 2 },
  right: { at: (s) => V(9.388, 0, s), rotY: -Math.PI / 2 }
};

/* ---------------- the moods (every channel, together) ---------------- */
const MOODS = {
  calm: { cct: 3400, k: 0.92, cove: 0xFFA257, coveA: 0.6, plant: 0x7FE39A, plantA: 0.42, accent: 0.15, lamp: 1.2, sun: 0.9 },
  groove: { cct: 4200, k: 1.0, cove: 0x2FD9C2, coveA: 0.55, plant: 0x5CDB8C, plantA: 0.36, accent: 0.3, lamp: 0.8, sun: 1.0 },
  hype: { cct: 5200, k: 1.1, cove: 0xFF2A48, coveA: 0.6, plant: 0x49E37F, plantA: 0.36, accent: 1.1, lamp: 0.55, sun: 1.12 }
};
const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

/**
 * Dress the Concept Room and light it as one system.
 * lights: { hemi, key, fill, rim, day, dayTarget } from the room; accent: the red datum line's material;
 * origin: where a change of mood starts (the mock-up)
 */
export function buildInterior(scene, { quality = 'high', lights, accent = null, origin = V(0.2, 1, -2.4) } = {}) {
  const G = new THREE.Group(); G.name = 'interior'; scene.add(G);
  const place = (o, x, z, rotY = 0) => { o.position.set(x, 0, z); o.rotation.y = rotY; G.add(o); return o; };
  const items = [];                                          // every light source the director drives
  const add = (kind, pos, apply) => items.push({ kind, pos, apply, cur: { c: new THREE.Color(0), a: 0 }, from: null, to: null, t0: 0 });

  /* decor sets, each with its uplight wash on the wall behind */
  const plantWash = (wall, s, w = 1.8, h = 3.4) => { const W = WALLS[wall], o = wash('plant', w, h); o.position.copy(W.at(s)).setY(h / 2 + 0.15); o.rotation.y = W.rotY; G.add(o); add('plant', o.position.clone(), (c, a) => { o.material.color.copy(c); o.material.opacity = a; }); };
  // back corners: a tall fig, a snake plant, vases
  place(fig(1.9), -8.7, -5.85, 0.4); place(snake('planter'), -7.95, -6.05, 1); { const v = vase(VASES.floor, MAT.terracotta); place(v, -7.35, -6.1); }
  plantWash('back', -8.3); plantWash('left', -5.6, 1.4);
  place(fig(1.8), 8.7, -5.85, 2.2); place(eucalyptus('floor', MAT.terracotta), 7.9, -6.1, 0.5);
  plantWash('back', 8.3); plantWash('right', -5.6, 1.4);
  // left wall: the credenza with vases and a sketch, a fig and a snake plant either side
  place(credenza(), -9.05, 3.8, Math.PI / 2); place(fig(1.6), -8.75, 5.75, 1.3); place(snake(), -8.85, 1.9, 0.2);
  plantWash('left', 5.75); plantWash('left', 1.9, 1.3, 2.6);
  // right: a lounge corner — oat sofa against the wall, two cognac chairs, a round oak table, an arc lamp
  { const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 0.01, 72), new THREE.MeshStandardMaterial({ map: tex(512, 512, (g, W, H) => { g.fillStyle = '#E2D9C8'; g.fillRect(0, 0, W, H); for (let i = 0; i < 20000; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(90,80,60,0.08)'; g.fillRect(rnd() * W, rnd() * H, 2, 2); } g.strokeStyle = '#2E4A3A'; g.lineWidth = 10; g.beginPath(); g.arc(W / 2, H / 2, W * 0.44, 0, Math.PI * 2); g.stroke(); }), roughness: 0.97 }));
    rug.position.set(7.45, 0.005, 2.6); rug.receiveShadow = true; G.add(rug); }
  place(sofa(), 8.78, 2.6, -Math.PI / 2);
  place(loungeChair(), 6.3, 1.7, 0.91); place(loungeChair(), 6.3, 3.5, 2.23);
  place(coffeeTable(), 7.45, 2.6);
  const lamp = place(arcLamp(), 8.85, 4.25, -2.45); add('lamp', V(8.85, 2, 4.25), (c, a) => { lamp.userData.glow.emissiveIntensity = a; });
  place(snake(), 8.85, 0.85, 0.7); plantWash('right', 0.85, 1.3, 2.6);
  // front wall, either side of the oak slats (seen behind a host who faces the back of the room)
  place(fig(1.75), -3.6, 9.1, 0.9); place(fig(1.65), 3.6, 9.1, 2.6);
  plantWash('front', 3.6); plantWash('front', -3.6);
  G.traverse((o) => { if (o.isMesh && o.material?.map?.isCanvasTexture) o.material.map.needsUpdate = true; });

  /* LED coves where the walls meet the ceiling, each 3 m run with its own wash down the wall */
  for (const [wall, a, b] of [['back', -9, 9], ['left', -6.3, 9.3], ['right', -6.3, 9.3], ['front', -9, 9]]) {
    const W = WALLS[wall], n = Math.round((b - a) / 3);
    for (let i = 0; i < n; i++) {
      const s = a + (i + 0.5) * (b - a) / n, len = (b - a) / n, p = W.at(s);
      const stripMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0 });
      const strip = new THREE.Mesh(new THREE.BoxGeometry(len - 0.02, 0.03, 0.03), stripMat); strip.position.copy(p).setY(7.02); strip.rotation.y = W.rotY;
      strip.position.add(new THREE.Vector3(0, 0, 0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), W.rotY)); G.add(strip);
      const w = wash('cove', len, 3.8); w.position.copy(p).setY(7.1 - 1.9); w.rotation.y = W.rotY; G.add(w);
      add('cove', p.clone().setY(6), (c, al) => { w.material.color.copy(c); w.material.opacity = al; stripMat.emissive.copy(c); stripMat.emissiveIntensity = al > 0 ? 3.4 / Math.max(0.12, lum(c)) : 0; });
    }
  }
  { const o = wash('halo', 7.4, 5.6); o.position.set(0, 2.2, -6.488); G.add(o);                 // behind the slats, in the cove's colour
    add('cove', V(0, 2.2, -6.5), (c, a) => { o.material.color.copy(c); o.material.opacity = a * 1.25; }); }
  if (accent) add('accent', V(0, 0.9, -6.5), (c, a) => { accent.emissive.setHex(0xD0231A); accent.emissiveIntensity = a; });

  /* the director */
  const L = lights || {}, base = { key: L.key?.intensity ?? 0, fill: L.fill?.intensity ?? 0, rim: L.rim?.intensity ?? 0, hemi: L.hemi?.intensity ?? 0, day: L.day?.intensity ?? 0 };
  const dayR = L.day ? Math.hypot(L.day.position.x - L.dayTarget.x, L.day.position.z - L.dayTarget.z) : 0, dayA0 = L.day ? Math.atan2(L.day.position.z - L.dayTarget.z, L.day.position.x - L.dayTarget.x) : 0;
  const glob = { cct: 4200, k: 1, sun: 1 }; let target = MOODS.groove, mood = '', clock = 0;
  const targetFor = (it, M) => {
    switch (it.kind) {
      case 'cove': return { c: new THREE.Color(M.cove), a: M.coveA };
      case 'plant': return { c: new THREE.Color(M.plant), a: M.plantA };
      case 'lamp': return { c: new THREE.Color(0xFFC98A), a: M.lamp * 3 };
      case 'accent': return { c: new THREE.Color(0xD0231A), a: M.accent };
    }
  };
  function setMood(m, now = clock, instant = false) {
    const M = MOODS[m] || MOODS.groove; if (m === mood && !instant) return; mood = m; target = M;
    for (const it of items) {
      it.from = { c: it.cur.c.clone(), a: it.cur.a }; it.to = targetFor(it, M);
      it.t0 = instant ? -1e9 : now + it.pos.distanceTo(origin) / 5;            // the change travels out from the mock-up at 5 m/s
    }
  }
  function update(t, dt) {
    clock = t;
    const breath = 1 + 0.05 * Math.sin(2 * Math.PI * t / 14);                // the whole room breathes together, very slowly
    for (const it of items) {
      if (!it.to) continue;
      const u = smooth(clamp((t - it.t0) / 2.5, 0, 1));
      it.cur.c.copy(it.from.c).lerp(it.to.c, u); it.cur.a = it.from.a + (it.to.a - it.from.a) * u;
      it.apply(it.cur.c, it.cur.a * (it.kind === 'cove' || it.kind === 'plant' ? breath : 1));
    }
    // the white light follows the mood (colour temperature and level), eased over ~2 s
    const e = 1 - Math.exp(-dt / 0.9);
    glob.cct += (target.cct - glob.cct) * e; glob.k += (target.k - glob.k) * e; glob.sun += (target.sun - glob.sun) * e;
    if (L.key) { L.key.color.copy(kelvin(glob.cct)); L.key.intensity = base.key * glob.k; }
    if (L.fill) { L.fill.color.copy(kelvin(glob.cct + 1600)); L.fill.intensity = base.fill * glob.k; }
    if (L.rim) L.rim.intensity = base.rim * glob.k;
    if (L.hemi) { L.hemi.color.copy(kelvin(glob.cct + 900)); L.hemi.intensity = base.hemi * (0.9 + 0.1 * glob.k); }
    // daylight through the roof: the sun moves across the room over 15 minutes, clouds pass
    if (L.day) {
      const a = dayA0 + 0.4 * Math.sin(2 * Math.PI * t / 900), cloud = 1 + 0.07 * wave(t / 23, 1.3);
      L.day.position.set(L.dayTarget.x + Math.cos(a) * dayR, L.day.position.y, L.dayTarget.z + Math.sin(a) * dayR);
      L.day.intensity = base.day * glob.sun * cloud; L.day.color.copy(kelvin(5600 - 500 * (0.5 + 0.5 * Math.sin(2 * Math.PI * t / 900))));
    }
    // leaves: a faint glow from the uplights, and their shadows drifting on the walls
    const pg = items.find((i) => i.kind === 'plant'); if (pg) for (const m of [LEAF.fig, LEAF.snake, LEAF.euca]) { m.emissive.copy(pg.cur.c); m.emissiveIntensity = pg.cur.a * 0.05; }
    washTex.plant.offset.set(0.015 * Math.sin(t * 0.13), 0.01 * Math.sin(t * 0.09 + 1));
  }
  setMood('groove', 0, true);
  return { group: G, setMood, update, get mood() { return mood; } };
}
