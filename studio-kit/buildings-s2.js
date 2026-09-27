/* KARLCON Studio — Season 2: the Zimbabwean Heritage Studio Series.
   One building per episode, each modelled on its concept render (img/meshy/<id>.png) — the shape
   in the render, not a guess — and named after its concept, so the real Meshy model from the
   library takes over once the building is finished and closed. Same build sequence as Season 1
   (0 foundations · 1 structure · 2 floors · 3 walls and roof · 4 glazing · 5 interior · 6 roof light).
     rondavel-concept         drum and faceted cone, butterfly roof light at the apex
     lumen-curved-pavilion    free-form stone shell, red fins, drive-in court, butterfly light
     conical-tower-loft       tapered stone tower in a red exoskeleton, bi-parting crown
     cantilever-pavilion      (Season 1 builder: glass cube on four red columns)
     chevron-pavilion         red-framed cube, chevron panels, bi-parting roof light
     triple-rondavel-cluster  three drums on a folded glass spine, butterfly over the cone
     matobo-boulder-house     red glass rooms between granite-form boulders, X-opening light
     terraced-hillside        dry-stone terraces, cantilevered red glass pavilion, lattice crown
     studio-ring-stage        ring roof over a glazed drum, twin panels on the rim
     zambezi-curve-pavilion   double-curved shell on red arch ribs, solar butterfly over the crest
   These are presentation models of AI-assisted concept renders, not engineering models. */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { KIT } from './buildings.js';

const { RED, M, stone, V, mesh, box, cyl, bar, slab, kit, finish, ease, clamp01, biparting } = KIT;

/* ---------- materials this season adds ---------- */
const white = new THREE.MeshStandardMaterial({ color: 0xF2F0EC, roughness: 0.6 });
const render = new THREE.MeshStandardMaterial({ color: 0xF4F2EE, roughness: 0.7, flatShading: true });
const boulderMat = new THREE.MeshStandardMaterial({ color: 0xE9E6E1, roughness: 0.92 });
let chevronMat = null, solarMat = null, stoneWhite = null;
void stone;
function canvasMat(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, ...opts });
}
/* white panels cut with a chevron (herringbone) relief, after the Great Zimbabwe walls */
function chevron() {
  return chevronMat ||= canvasMat(256, 256, (g, w, h) => {
    g.fillStyle = '#EEEBE6'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,85,78,0.55)'; g.lineWidth = 3;
    for (let y = -32; y < h + 32; y += 16) { g.beginPath(); for (let x = 0; x <= w; x += 32) { g.lineTo(x, y); g.lineTo(x + 16, y + 12); } g.stroke(); }
  });
}
/* photovoltaic glass for the Zambezi leaves */
function solar() {
  return solarMat ||= canvasMat(256, 256, (g, w, h) => {
    g.fillStyle = '#1B2A45'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(180,200,230,0.55)'; g.lineWidth = 2;
    for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }, { roughness: 0.25, metalness: 0.4, side: THREE.DoubleSide });
}
/* the white coursed brick of the renders: long thin blocks, pale mortar */
function whiteStone() {
  return stoneWhite ||= canvasMat(512, 512, (g, w, h) => {
    g.fillStyle = '#8F8A83'; g.fillRect(0, 0, w, h);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0, row = 0; y < h; y += 26, row++) for (let x = -(row % 2) * 45; x < w;) {
      const bw = 70 + rnd() * 70, v = 206 + rnd() * 40 | 0;
      g.fillStyle = `rgb(${v},${v - 3},${v - 8})`; g.fillRect(x + 3, y + 3, bw - 6, 20);
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x + 3, y + 17, bw - 6, 6);
      x += bw;
    }
  }, { roughness: 0.92 });
}

/* ---------- geometry helpers ---------- */
/** texture coordinates in metres (k metres per tile), so brick stays one size on every face;
    round = measure around the vertical axis (cylinders, cones) */
function metricUV(g, k = 1.4, round = false) {
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = Math.abs(n.getY(i));
    if (ny > 0.8) uv.setXY(i, x / k, z / k);
    else if (round) uv.setXY(i, Math.atan2(x, z) * Math.hypot(x, z) / k, y / k);
    else uv.setXY(i, (Math.abs(n.getX(i)) > Math.abs(n.getZ(i)) ? z : x) / k, y / k);
  }
  uv.needsUpdate = true; return g;
}
const brickBox = (w, h, d, x, y, z) => mesh(metricUV(new THREE.BoxGeometry(w, h, d).translate(x, y, z)), whiteStone());
const brickCone = (rt, rb, h, y) => mesh(metricUV(new THREE.CylinderGeometry(rt, rb, h, 72).translate(0, y, 0), 1.4, true), whiteStone());
/** a wall that follows an open plan polyline [[x, z], …]: outer face, inner face and top, one mesh.
    bottom(i) / top(i) give its height at each point (openings, sloping ramps). */
function wallRibbon(pts, t, bottom, top, m) {
  const pos = [], uv = [], n = pts.length, off = [];
  let run = 0; const s = [0];
  for (let i = 1; i < n; i++) { run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); s.push(run); }
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    off.push([dz / l * t / 2, -dx / l * t / 2]);        // normal to the left of the direction of travel
  }
  const P = (i, side, y) => [pts[i][0] + side * off[i][0], y, pts[i][1] + side * off[i][1]];
  const quad = (p0, p1, p2, p3, u0, u1, v0, v1, v2, v3) => { pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3); uv.push(u0, v0, u1, v1, u1, v2, u0, v0, u1, v2, u0, v3); };
  for (let i = 0; i < n - 1; i++) {
    const u0 = s[i] / 1.4, u1 = s[i + 1] / 1.4;
    for (const side of [1, -1]) {
      const a0 = P(i, side, bottom(i)), a1 = P(i + 1, side, bottom(i + 1)), b1 = P(i + 1, side, top(i + 1)), b0 = P(i, side, top(i));
      if (side > 0) quad(a0, a1, b1, b0, u0, u1, bottom(i) / 1.4, bottom(i + 1) / 1.4, top(i + 1) / 1.4, top(i) / 1.4);
      else quad(a1, a0, b0, b1, u1, u0, bottom(i + 1) / 1.4, bottom(i) / 1.4, top(i) / 1.4, top(i + 1) / 1.4);
    }
    quad(P(i, 1, top(i)), P(i + 1, 1, top(i + 1)), P(i + 1, -1, top(i + 1)), P(i, -1, top(i)), u0, u1, 0, 0, 0.2, 0.2);
    quad(P(i + 1, 1, bottom(i + 1)), P(i, 1, bottom(i)), P(i, -1, bottom(i)), P(i + 1, -1, bottom(i + 1)), u1, u0, 0, 0, 0.2, 0.2);
  }
  for (const [i, sg] of [[0, 1], [n - 1, -1]]) quad(P(i, -sg, bottom(i)), P(i, sg, bottom(i)), P(i, sg, top(i)), P(i, -sg, top(i)), 0, t / 1.4, bottom(i) / 1.4, bottom(i) / 1.4, top(i) / 1.4, top(i) / 1.4);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; o.material.side = THREE.DoubleSide; return o;
}
/** closed smooth plan outline through control points [[x, z], …] → points and a Shape (shape y = -z) */
function planCurve(ctrl, n = 120) {
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => V(x, 0, z)), true, 'centripetal');
  const pts = c.getSpacedPoints(n).slice(0, n).map((p) => [p.x, p.z]);
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  return { pts, shape };
}
/** +1 if (dz, -dx) points out of this closed outline, -1 if it points in */
function outSign(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a > 0 ? 1 : -1; }
/** the same outline grown outward by d (for eaves and roof slabs) */
function grow(pts, d) {
  const n = pts.length, k = outSign(pts) * d;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    return [p[0] + dz / l * k, p[1] - dx / l * k];
  });
}
const shapeOf = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
/** extruded slab with rounded edges */
function roundSlab(shape, h, m, y, r = 0.1) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 48 });
  g.rotateX(-Math.PI / 2); g.translate(0, r, 0); return mesh(g, m, 0, y, 0);
}
/** a boulder: a noisy sphere with a flattened base */
function boulder(r, sx, sy, sz, seed) {
  let g = new THREE.IcosahedronGeometry(r, 4); g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + 0.07 * Math.sin(x * 2.1 + seed) * Math.cos(z * 1.7 - seed) + 0.05 * Math.sin(y * 3.3 + seed * 2) + 0.03 * Math.sin((x + z) * 5.1);
    p.setXYZ(i, x * k * sx, Math.max(y * k * sy, -r * 0.35 * sy), z * k * sz);
  }
  g.computeVertexNormals(); return g;
}
/** open red box frame: 12 edge bars of a w × h × d box whose floor centre is (x, y, z) */
function frameBox(add, w, h, d, x, y, z, t, stage, glassStage = 4, lit = true) {
  const X = [x - w / 2, x + w / 2], Y = [y, y + h], Z = [z - d / 2, z + d / 2];
  for (const yy of Y) for (const zz of Z) add(bar(V(X[0], yy, zz), V(X[1], yy, zz), t, M.red), stage);
  for (const yy of Y) for (const xx of X) add(bar(V(xx, yy, Z[0]), V(xx, yy, Z[1]), t, M.red), stage);
  for (const xx of X) for (const zz of Z) add(box(t, h, t, M.red, xx, y + h / 2, zz), stage);
  add(box(w, 0.14, d, M.red, x, y + 0.07, z), stage === 1 ? 2 : stage, 'drop');
  const glass = [[w, h, x, y + h / 2, Z[1], 0], [w, h, x, y + h / 2, Z[0], 0], [d, h, X[0], y + h / 2, z, Math.PI / 2], [d, h, X[1], y + h / 2, z, Math.PI / 2]];
  for (const [gw, gh, gx, gy, gz, ry] of glass) { const pl = mesh(new THREE.PlaneGeometry(gw - t, gh - t), M.glass, gx, gy, gz); pl.rotation.y = ry; pl.renderOrder = 2; add(pl, glassStage, 'fade'); }
  add(box(w - 0.1, h * 0.04, 0.03, M.red, x, y + h * 0.55, Z[1]), stage);
  if (lit) add(box(w - 0.2, 0.02, d - 0.2, M.room, x, y + 0.15, z), 5, 'fade');
}

/* ---------- roof lights this season ---------- */
/** butterfly: two leaves hinged on the centre line of a kx × kz opening; open, their outer edges rise
    into a V (the renders' "bifold" lights). rotY turns the hinge line; lift raises the pair first.
    outer: hinged on the outer edges instead, so past vertical the leaves cross into an X (Matobo). */
function butterfly(add, kx, kz, ky, { cx = 0, cz = 0, rotY = 0, maxA = 0.95, lift = 0, leaf = M.leaf, frame = M.alu, outer = false } = {}) {
  const kerb = new THREE.Group(); kerb.position.set(cx, ky, cz); kerb.rotation.y = rotY;
  kerb.add(box(kx + 0.16, 0.16, 0.08, frame, 0, 0.08, -kz / 2 - 0.04)); kerb.add(box(kx + 0.16, 0.16, 0.08, frame, 0, 0.08, kz / 2 + 0.04));
  kerb.add(box(0.08, 0.16, kz, frame, -kx / 2 - 0.04, 0.08, 0)); kerb.add(box(0.08, 0.16, kz, frame, kx / 2 + 0.04, 0.08, 0));
  const glow = mesh(new THREE.PlaneGeometry(kx, kz), M.room, 0, 0.02, 0); glow.rotation.x = -Math.PI / 2; kerb.add(glow);
  add(kerb, 6);
  const pivot = new THREE.Group(); pivot.position.set(cx, ky + 0.17, cz); pivot.rotation.y = rotY;
  const geo = new THREE.BoxGeometry(kx / 2, 0.03, kz); geo.translate(kx / 4, 0, 0);
  const hinges = [];
  for (const side of [-1, 1]) {
    const h = new THREE.Group();
    if (outer) { h.position.x = side * kx / 2; if (side > 0) h.rotation.y = Math.PI; } else if (side < 0) h.rotation.y = Math.PI;
    const l = new THREE.Mesh(geo, leaf); l.castShadow = true; h.add(l);
    l.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: RED })));
    for (const z of [-kz / 2, kz / 2]) l.add(box(kx / 2, 0.05, 0.05, M.red, kx / 4, 0.01, z));
    l.add(box(0.05, 0.05, kz, M.red, kx / 2, 0.01, 0));
    pivot.add(h); hinges.push(h);
  }
  add(pivot, 6, 'fade');
  return (open) => {
    const a = ease(clamp01(open * 1.15)) * maxA, up = ease(clamp01(open * 2)) * lift;
    pivot.position.y = ky + 0.17 + up;
    for (const h of hinges) h.rotation.z = a;
  };
}

/* =================== S2 · Episode 1 — KARLCON Rondavel =================== */
function rondavel() {
  const { G, parts, add } = kit('rondavel-concept');
  const R = 2.6, H = 2.45, eaveR = 3.5, topR = 0.72, ey = H + 0.14, apex = 5.0;
  add(cyl(R + 0.25, R + 0.3, 0.14, white, 0, 0.07, 0, 72), 0);
  add(cyl(R + 0.45, R + 0.45, 0.04, M.concreteLight, 0, 0.02, 0, 72), 0);
  for (let i = 0; i < 12; i++) { const t = i / 12 * Math.PI * 2; add(box(0.18, H, 0.18, white, (R - 0.12) * Math.cos(t), 0.14 + H / 2, (R - 0.12) * Math.sin(t)), 1); }
  add(cyl(R - 0.1, R - 0.1, 0.08, M.warm, 0, 0.18, 0, 72), 2, 'drop');
  const wall = cyl(R, R, H, white, 0, 0.14 + H / 2, 0, 96); wall.material = white; add(wall, 3);
  add(cyl(R + 0.02, R + 0.02, 0.06, M.concreteLight, 0, 0.17, 0, 96), 3);
  // eave: a thin white fascia ring, then the faceted cone (flat shaded, like the render's panels)
  add(cyl(eaveR, eaveR, 0.14, white, 0, ey - 0.07, 0, 72), 3, 'drop');
  add(cyl(eaveR - 0.05, eaveR - 0.05, 0.03, M.red, 0, ey - 0.155, 0, 72), 3, 'drop');
  const cone = cyl(topR, eaveR, apex - ey, render, 0, ey + (apex - ey) / 2, 0, 16); add(cone, 3, 'drop');
  for (let i = 0; i < 16; i++) {
    const t = (i + 0.5) / 16 * Math.PI * 2;
    add(bar(V(eaveR * Math.cos(t), ey + 0.02, eaveR * Math.sin(t)), V(topR * Math.cos(t), apex, topR * Math.sin(t)), 0.035, white), 3, 'drop');
  }
  add(cyl(topR + 0.02, topR + 0.02, 0.1, white, 0, apex + 0.05, 0, 16), 3, 'drop');
  // a glazed door on the far side, and the interior under the apex light
  const door = mesh(new THREE.PlaneGeometry(1.1, 2.1), M.glass, 0, 1.2, -R - 0.02); add(door, 4, 'fade');
  add(box(1.2, 0.06, 0.06, M.alu, 0, 2.27, -R - 0.03), 4);
  add(cyl(0.9, 0.9, 0.4, M.fabric, 0, 0.42, 0, 32), 5); add(cyl(0.3, 0.3, 0.3, M.wood, 0, 0.6, 0, 20), 5);
  const mech = butterfly(add, 1.15, 1.15, apex + 0.1, { maxA: 0.75 });
  return finish({ id: 'rondavel-concept', G, parts, top: V(0, apex + 0.1, 0), centre: V(0, 1.3, 0), mech, beamR: [0.55, 1.4], beamH: 6, scale: 0.7 });
}

/* =================== S2 · Episode 2 — Lumen Builds Curved Pavilion =================== */
function curvedPavilion() {
  const { G, parts, add } = kit('lumen-curved-pavilion');
  // plan read off the render: two lobes, a pinched waist at the front (the drive-in) and the back
  const { pts } = planCurve([[-4.3, -0.9], [-4.4, 1.1], [-3.3, 2.5], [-1.7, 2.3], [0, 1.5], [1.7, 2.4], [3.5, 2.7], [4.6, 1.5], [4.5, -0.7], [3.6, -2.4], [1.3, -2.6], [0, -1.9], [-1.5, -2.6], [-3.6, -2.4]], 140);
  const H = 2.55, n = pts.length;
  add(slab(shapeOf(grow(pts, 0.35)), 0.12, M.concreteLight, 0), 0);
  // the drive-in: the front span of the outline where the wall stops at an arched soffit
  let front = 0; for (let i = 0; i < n; i++) if (pts[i][1] > pts[front][1] - 0.001 && Math.abs(pts[i][0]) < 0.5) front = i;
  let f0 = front, f1 = front; while (Math.hypot(pts[f0][0] - pts[front][0], 0) < 2.1 && f0 > 0) f0--; while (Math.hypot(pts[f1][0] - pts[front][0], 0) < 2.1 && f1 < n - 1) f1++;
  const ring = [...pts.slice(f1), ...pts.slice(0, f0 + 1)];                    // wall runs from one side of the opening round the back to the other
  const lintel = pts.slice(f0, f1 + 1);
  const wall = wallRibbon(ring, 0.34, () => 0.12, () => H, whiteStone()); add(wall, 1);
  const arch = (i) => { const u = i / (lintel.length - 1); return 1.75 + 0.35 * Math.sin(Math.PI * u); };
  add(wallRibbon(lintel, 0.34, arch, () => H, whiteStone()), 3);
  // red fins proud of the wall, gently bowed
  const finIdx = [0.04, 0.12, 0.22, 0.33, 0.45, 0.56, 0.67, 0.78, 0.9, 0.97].map((k) => Math.floor(k * (ring.length - 1))), os = outSign(pts);
  for (const i of finIdx) {
    const a = ring[Math.max(0, i - 1)], b = ring[Math.min(ring.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = os * dz / l, nz = -os * dx / l;
    const p = ring[i], out = 0.22;
    const c = new THREE.QuadraticBezierCurve3(V(p[0] + nx * out, 0.12, p[1] + nz * out), V(p[0] + nx * (out + 0.14), H / 2, p[1] + nz * (out + 0.14)), V(p[0] + nx * out, H, p[1] + nz * out));
    add(mesh(new THREE.TubeGeometry(c, 12, 0.07, 8), M.red), 1);
  }
  // drive-in court: red columns, the soffit glow, and the red car from the render
  for (const x of [-1.1, 1.1]) add(cyl(0.09, 0.09, H - 0.3, M.red, x, (H - 0.3) / 2 + 0.12, 0.3, 12), 1);
  add(slab(shapeOf(grow(pts, -0.2)), 0.05, M.warm, 0.12), 2, 'drop');
  add(box(3.6, 0.03, 1.8, M.room, 0, H - 0.02, 0.6), 5, 'fade');
  const car = new THREE.Group(); car.position.set(-0.4, 0.14, 0.5); car.rotation.y = 0.35;
  car.add(box(1.9, 0.42, 0.86, M.red, 0, 0.36, 0)); car.add(box(0.95, 0.3, 0.78, M.black, -0.1, 0.72, 0));
  for (const [x, z] of [[-0.62, -0.42], [0.62, -0.42], [-0.62, 0.42], [0.62, 0.42]]) { const w = cyl(0.17, 0.17, 0.1, M.black, x, 0.17, z, 16); w.rotation.x = Math.PI / 2; car.add(w); }
  add(car, 5);
  // the stone ramp wall sweeping down from the right lobe to the ground
  const ramp = []; for (let i = 0; i <= 24; i++) { const u = i / 24; ramp.push([1.9 + u * 2.1, 2.1 + u * 1.5 + Math.sin(u * Math.PI) * 0.35]); }
  add(wallRibbon(ramp, 0.3, () => 0.12, (i) => 0.12 + (H - 0.3) * (1 - i / 24) ** 1.3, whiteStone()), 1);
  // the roof: a thick white slab with a rounded edge, overhanging the stone
  add(roundSlab(shapeOf(grow(pts, 0.32)), 0.46, M.whiteGloss, H, 0.14), 3, 'drop');
  add(roundSlab(shapeOf(grow(pts, 0.36)), 0.08, M.red, H + 0.04, 0.03), 3, 'drop');
  // glazing inside the drive-in
  const gl = mesh(new THREE.PlaneGeometry(3.4, 1.6), M.glass, 0, 0.95, -0.6); gl.renderOrder = 2; add(gl, 4, 'fade');
  add(box(3.4, 1.6, 0.02, M.room, 0, 0.95, -0.7), 5, 'fade');
  const ky = H + 0.46;
  const mech = butterfly(add, 2.2, 1.4, ky, { cx: -0.2, cz: -0.2, maxA: 0.7 });
  return finish({ id: 'lumen-curved-pavilion', G, parts, top: V(-0.2, ky, -0.2), centre: V(0, 1.4, 0), mech, beamR: [0.8, 1.6], beamH: 5, scale: 0.55 });
}

/* =================== S2 · Episode 3 — Conical Tower Loft =================== */
function conicalTower() {
  const { G, parts, add } = kit('conical-tower-loft');
  const r0 = 2.05, r1 = 1.2, y0 = 0.22, y1 = 6.3, rAt = (y) => r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  add(cyl(2.9, 2.9, 0.22, white, 0, 0.11, 0, 72), 0);
  const g1 = 1.15, g2 = 3.35;         // the glazed band
  add(brickCone(rAt(g1), r0, g1 - y0, (y0 + g1) / 2), 3);
  add(brickCone(r1, rAt(g2), y1 - g2, (g2 + y1) / 2), 3);
  add(cyl(r1 + 0.05, r1 + 0.05, 0.18, white, 0, y1 + 0.09, 0, 72), 3, 'drop');
  // the interior floor and the glazed band with its mullions
  add(cyl(rAt(g1) - 0.1, rAt(g1) - 0.1, 0.12, white, 0, g1, 0, 72), 2, 'drop');
  const band = new THREE.CylinderGeometry(rAt(g2) - 0.06, rAt(g1) - 0.06, g2 - g1, 72, 1, true);
  const bandM = mesh(band, M.glass, 0, (g1 + g2) / 2, 0); bandM.renderOrder = 2; add(bandM, 4, 'fade');
  for (let i = 0; i < 18; i++) { const t = i / 18 * Math.PI * 2; add(bar(V(rAt(g1) * Math.cos(t), g1, rAt(g1) * Math.sin(t)), V(rAt(g2) * Math.cos(t), g2, rAt(g2) * Math.sin(t)), 0.035, M.black), 4); }
  add(cyl(rAt(g1) - 0.4, rAt(g1) - 0.4, g2 - g1 - 0.1, M.room, 0, (g1 + g2) / 2, 0, 48), 5, 'fade');
  // the red exoskeleton: six legs from the plinth edge, leaning in with the cone, three rings
  const rings = [g1 - 0.05, g2 + 0.05, 4.6], legs = 6, gap = 0.5;
  for (let i = 0; i < legs; i++) {
    const t = (i + 0.5) / legs * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    add(bar(V((r0 + 0.75) * c, 0.22, (r0 + 0.75) * s), V((rAt(4.6) + gap) * c, 4.6, (rAt(4.6) + gap) * s), 0.12, M.red), 1);
  }
  for (const y of rings) {
    const k = (y - 0.22) / (4.6 - 0.22), rad = (r0 + 0.75) + ((rAt(4.6) + gap) - (r0 + 0.75)) * k;   // on the line of the legs
    const t = mesh(new THREE.TorusGeometry(rad, 0.06, 8, 72), M.red, 0, y, 0); t.rotation.x = Math.PI / 2; add(t, 1);
    for (let i = 0; i < legs; i++) { const a = (i + 0.5) / legs * Math.PI * 2; add(bar(V(rAt(y) * Math.cos(a), y, rAt(y) * Math.sin(a)), V(rad * Math.cos(a), y, rad * Math.sin(a)), 0.05, M.red), 1); }
  }
  const ky = y1 + 0.18;
  const mech = biparting(add, 1.3, 1.0, ky);
  return finish({ id: 'conical-tower-loft', G, parts, top: V(0, ky, 0), centre: V(0, 3, 0), mech, beamR: [0.5, 1.2], beamH: 7.5, scale: 0.6 });
}

/* =================== S2 · Episode 5 — Chevron Motif Pavilion =================== */
function chevronPavilion() {
  const { G, parts, add } = kit('chevron-pavilion');
  const W = 5.0, H = 2.9, y0 = 0.2, t = 0.16, bays = 4, bw = W / bays;
  add(box(W + 0.5, y0, W + 0.5, M.concreteLight, 0, y0 / 2, 0), 0);
  add(box(W - 0.1, 0.06, W - 0.1, M.warm, 0, y0 + 0.03, 0), 2, 'drop');
  // four faces: red posts at every bay line, a mid rail and top and bottom beams
  const faces = [[0, 1], [Math.PI / 2, 1], [Math.PI, 1], [-Math.PI / 2, 1]];
  const open = [[1], [1], [2], [2]];                                      // bays left open (glazed) per face
  faces.forEach(([ry], f) => {
    const q = new THREE.Group(); q.rotation.y = ry;
    for (let i = 0; i <= bays; i++) q.add(box(t, H, t, M.red, -W / 2 + i * bw, y0 + H / 2, W / 2));
    for (const y of [y0 + t / 2, y0 + H * 0.5, y0 + H - t / 2]) q.add(box(W + t, t, t, M.red, 0, y, W / 2));
    add(q, 1);
    const p = new THREE.Group(); p.rotation.y = ry;
    for (let i = 0; i < bays; i++) {
      const x = -W / 2 + (i + 0.5) * bw;
      for (const [yy, hh] of [[y0 + H * 0.25, H * 0.5 - t], [y0 + H * 0.75, H * 0.5 - t]]) {
        if (open[f].includes(i)) { const g = mesh(new THREE.PlaneGeometry(bw - t, hh), M.glass, x, yy, W / 2 - 0.02); g.renderOrder = 2; p.add(g); }
        else { const pn = mesh(new THREE.BoxGeometry(bw - t, hh, 0.06), chevron(), x, yy, W / 2 - 0.05); pn.material.map.repeat.set(1.4, 1.2); p.add(pn); }
      }
    }
    add(p, 3);
  });
  add(box(W - 0.3, H - 0.2, W - 0.3, M.room, 0, y0 + H / 2, 0), 5, 'fade');
  // roof slab around a large opening, then the kerb and the pair of leaves
  const kx = 2.7, kz = 1.9, T = 0.3, ry = y0 + H;
  add(box(W + 0.3, T, (W + 0.3 - kz) / 2, white, 0, ry + T / 2, -(kz / 2 + (W + 0.3 - kz) / 4)), 3, 'drop');
  add(box(W + 0.3, T, (W + 0.3 - kz) / 2, white, 0, ry + T / 2, (kz / 2 + (W + 0.3 - kz) / 4)), 3, 'drop');
  add(box((W + 0.3 - kx) / 2, T, kz, white, -(kx / 2 + (W + 0.3 - kx) / 4), ry + T / 2, 0), 3, 'drop');
  add(box((W + 0.3 - kx) / 2, T, kz, white, (kx / 2 + (W + 0.3 - kx) / 4), ry + T / 2, 0), 3, 'drop');
  add(box(kx + 0.5, 0.18, kz + 0.5, white, 0, ry + T + 0.09, 0), 3, 'drop');
  const mech = biparting(add, kx, kz, ry + T + 0.18);
  return finish({ id: 'chevron-pavilion', G, parts, top: V(0, ry + T + 0.18, 0), centre: V(0, 1.6, 0), mech, beamR: [1.1, 1.6], beamH: 6, scale: 0.7 });
}

/* =================== S2 · Episode 6 — Triple Rondavel Cluster =================== */
function tripleRondavel() {
  const { G, parts, add } = kit('triple-rondavel-cluster');
  const C = [0, -1.0], Rc = 2.0, Hc = 2.0, sides = [[-4.1, 0.5], [4.1, 0.5]], Rs = 1.55, Hs = 2.25;
  // foundations
  add(cyl(Rc + 0.2, Rc + 0.2, 0.12, white, C[0], 0.06, C[1], 64), 0);
  for (const [x, z] of sides) add(cyl(Rs + 0.2, Rs + 0.2, 0.12, white, x, 0.06, z, 64), 0);
  // central drum under a low cone with a flat top
  add(cyl(Rc, Rc, Hc, white, C[0], 0.12 + Hc / 2, C[1], 72), 1);
  add(cyl(Rc + 0.35, Rc + 0.35, 0.12, white, C[0], Hc + 0.18, C[1], 72), 3, 'drop');
  add(cyl(0.75, Rc + 0.35, 1.25, white, C[0], Hc + 0.24 + 0.625, C[1], 72), 3, 'drop');
  // the two side drums: flat roofs with a thick rim, a glazed arc toward the spine
  for (const [x, z] of sides) {
    const sgn = Math.sign(x);
    const drumG = new THREE.CylinderGeometry(Rs, Rs, Hs, 72, 1, false, sgn < 0 ? Math.PI * 0.95 : -Math.PI * 0.05, Math.PI * 1.1);
    add(mesh(drumG, white, x, 0.12 + Hs / 2, z), 1);
    const gl = new THREE.CylinderGeometry(Rs - 0.03, Rs - 0.03, Hs - 0.1, 48, 1, true, sgn < 0 ? Math.PI * 0.05 : Math.PI * 1.05, Math.PI * 0.9);
    const glm = mesh(gl, M.glass, x, 0.12 + Hs / 2, z); glm.renderOrder = 2; add(glm, 4, 'fade');
    for (let i = 0; i <= 9; i++) { const a = (sgn < 0 ? Math.PI * 0.05 : Math.PI * 1.05) + Math.PI * 0.9 * i / 9; add(box(0.06, Hs - 0.1, 0.06, M.red, x + (Rs - 0.02) * Math.sin(a), 0.12 + Hs / 2, z + (Rs - 0.02) * Math.cos(a)), 4); }
    add(cyl(Rs + 0.18, Rs + 0.18, 0.26, white, x, Hs + 0.25, z, 72), 3, 'drop');
    const lip = mesh(new THREE.TorusGeometry(Rs + 0.12, 0.06, 8, 72), white, x, Hs + 0.39, z); lip.rotation.x = Math.PI / 2; add(lip, 3, 'drop');
    add(cyl(Rs - 0.1, Rs - 0.1, 0.04, M.warm, x, 0.14, z, 48), 2, 'drop');
    add(cyl(Rs - 0.35, Rs - 0.35, Hs - 0.4, M.room, x, 0.12 + Hs / 2, z, 32), 5, 'fade');
  }
  // the glazed spine: a folded wall of red-framed glass from drum to drum, and its roof
  const fold = [[-2.62, 1.05], [-1.35, 1.95], [0, 1.2], [1.35, 1.95], [2.62, 1.05]], sh = 2.0;
  for (let i = 0; i < fold.length - 1; i++) {
    const [ax, az] = fold[i], [bx, bz] = fold[i + 1], len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    const pl = mesh(new THREE.PlaneGeometry(len, sh), M.glass, (ax + bx) / 2, 0.12 + sh / 2, (az + bz) / 2); pl.rotation.y = -ang; pl.renderOrder = 2; add(pl, 4, 'fade');
    for (const y of [0.16, 0.12 + sh]) add(bar(V(ax, y, az), V(bx, y, bz), 0.07, M.red), 1);
    const nm = Math.round(len / 0.42);
    for (let k = 0; k <= nm; k++) { const u = k / nm; add(box(0.05, sh, 0.05, M.red, ax + (bx - ax) * u, 0.12 + sh / 2, az + (bz - az) * u), 4); }
  }
  add(slab(shapeOf([...fold.map(([x, z]) => [x, z + 0.12]), [2.4, -0.4], [-2.4, -0.4]]), 0.12, white, 0.12 + sh), 3, 'drop');
  add(slab(shapeOf([...fold, [2.4, -0.4], [-2.4, -0.4]]), 0.04, M.warm, 0.12), 2, 'drop');
  const ky = Hc + 0.24 + 1.25;
  add(cyl(Rc - 0.2, Rc - 0.2, Hc - 0.3, M.room, C[0], 0.12 + Hc / 2, C[1], 48), 5, 'fade');
  const mech = butterfly(add, 1.1, 0.95, ky, { cx: C[0], cz: C[1], maxA: 0.8 });
  return finish({ id: 'triple-rondavel-cluster', G, parts, top: V(C[0], ky, C[1]), centre: V(0, 1.3, 0), mech, beamR: [0.5, 1.2], beamH: 6, scale: 0.5 });
}

/* =================== S2 · Episode 7 — Matobo Boulder House =================== */
function matobo() {
  const { G, parts, add } = kit('matobo-boulder-house');
  add(box(10, 0.1, 6.4, M.concreteLight, 0, 0.05, 0), 0);
  // the kopje: granite-form boulders, largest at the back, as in the render
  const rocks = [[-0.2, -0.9, 2.35, 1.2, 1.18, 1.05, 1], [-2.5, -0.4, 1.95, 1.2, 1.05, 1.05, 2], [2.4, -1.0, 1.9, 1.15, 1.12, 1.0, 3], [-1.3, 1.0, 1.45, 1.25, 0.95, 1.0, 4], [-4.3, 0.2, 1.3, 1.2, 0.9, 1.05, 5], [4.2, 0.0, 1.35, 1.15, 0.95, 1.0, 6], [0.3, 1.3, 0.95, 1.25, 0.85, 1.0, 7]];
  for (const [x, z, r, sx, sy, sz, sd] of rocks) {
    const g = boulder(r, sx, sy, sz, sd), b = mesh(g, boulderMat, x, r * sy * 0.35 + 0.1, z); add(b, 1);
  }
  // red-framed glass rooms set into the boulders
  frameBox(add, 2.1, 1.1, 1.5, -2.9, 1.75, 1.05, 0.1, 3);          // upper left, set into its boulder
  frameBox(add, 1.9, 1.55, 1.6, 1.6, 1.85, 0.75, 0.1, 3);          // upper right
  frameBox(add, 2.7, 1.6, 1.8, 1.8, 0.1, 1.55, 0.1, 3);            // lower right, at the ground
  const ky = 3.95, cx = -0.3, cz = -0.9;
  add(cyl(1.25, 1.5, 0.5, boulderMat, cx, ky - 0.25, cz, 24), 3);
  const mech = butterfly(add, 2.2, 1.3, ky, { cx, cz, rotY: 0.1, maxA: 2.05, outer: true });
  return finish({ id: 'matobo-boulder-house', G, parts, top: V(cx, ky, cz), centre: V(0, 1.6, 0), mech, beamR: [0.6, 1.4], beamH: 6, scale: 0.52 });
}

/* =================== S2 · Episode 8 — Terraced Hillside Complex =================== */
function terraced() {
  const { G, parts, add } = kit('terraced-hillside');
  const rise = 0.6, D = 5.0;
  // dry-stone terraces climbing to the right, each set back
  for (let i = 0; i < 5; i++) {
    const x0 = -4.6 + i * 1.35, w = 4.6 - x0, d = D - i * 0.25;
    add(brickBox(w, rise, d, (x0 + 4.6) / 2, rise / 2 + i * rise, -i * 0.12), 0);
  }
  // a narrow stair cut up the front of the terraces
  for (let i = 0; i < 10; i++) add(brickBox(0.9, 0.3, 0.3, -2.3 + i * 0.22, 0.15 + i * 0.3, 2.35 - i * 0.05), 0);
  const top = 5 * rise;                                                  // 3.0
  // stone pier at the back right carrying the pavilion
  add(brickBox(1.0, 1.9, 1.0, 3.6, top + 0.95, -1.3), 1);
  // the red pavilion, cantilevered left past the top terrace
  const px = 1.2, pz = -0.2, pw = 4.6, pd = 3.0, ph = 1.7, py = top + 0.12;
  add(box(pw + 0.3, 0.32, pd + 0.3, M.red, px, py - 0.04, pz), 2, 'drop');
  frameBox(add, pw, ph, pd, px, py + 0.12, pz, 0.12, 1, 4);
  for (const s of [-1, 1]) add(bar(V(px + pw / 2, py + 0.14, pz - pd / 2 + (s < 0 ? 0 : pd)), V(px + pw / 2, py + ph + 0.1, pz + (s < 0 ? pd / 2 : -pd / 2)), 0.08, M.red), 1);   // X bracing on the right end
  add(box(pw, 0.14, pd, white, px, py + ph + 0.2, pz), 3, 'drop');
  // the smaller glass room on top, set back
  const uy = py + ph + 0.27, uw = 2.6, ud = 2.0, uh = 1.05;
  frameBox(add, uw, uh, ud, px + 0.3, uy, pz - 0.2, 0.09, 3, 4, false);
  const ky = uy + uh + 0.05;
  // the red lattice crown over the light: a hip frame of bars
  const cxk = px + 0.3, czk = pz - 0.2;
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) add(bar(V(cxk + dx * uw / 2, ky, czk + dz * ud / 2), V(cxk + dx * 0.55, ky + 0.95, czk), 0.06, M.red), 6);
  add(bar(V(cxk - 0.55, ky + 0.95, czk), V(cxk + 0.55, ky + 0.95, czk), 0.06, M.red), 6);
  const mech = butterfly(add, 1.7, 1.2, ky, { cx: cxk, cz: czk, maxA: 0.75 });
  return finish({ id: 'terraced-hillside', G, parts, top: V(cxk, ky, czk), centre: V(0.8, 2.2, 0), mech, beamR: [0.6, 1.3], beamH: 7, scale: 0.52 });
}

/* =================== S2 · Episode 9 — Circular Ring Pavilion =================== */
function ringPavilion() {
  const { G, parts, add } = kit('studio-ring-stage');
  const Ro = 4.6, Ri = 1.65, Rg = 4.05, H = 2.2, T = 0.45;
  add(cyl(Ro + 0.3, Ro + 0.35, 0.16, white, 0, 0.08, 0, 96), 0);
  add(mesh(metricUV(new THREE.CylinderGeometry(Ri - 0.1, Ri - 0.1, 0.02, 48).translate(0, 0.17, 0)), whiteStone()), 0);
  // the glazed drum: glass, red mullions, red top and bottom rings
  const drumG = new THREE.CylinderGeometry(Rg, Rg, H, 96, 1, true); const dm = mesh(drumG, M.glass, 0, 0.16 + H / 2, 0); dm.renderOrder = 2; add(dm, 4, 'fade');
  for (let i = 0; i < 44; i++) { const t = i / 44 * Math.PI * 2; add(box(0.06, H, 0.06, M.red, Rg * Math.cos(t), 0.16 + H / 2, Rg * Math.sin(t)), 1); }
  for (const y of [0.2, 0.16 + H]) { const r = mesh(new THREE.TorusGeometry(Rg, 0.05, 8, 96), M.red, 0, y, 0); r.rotation.x = Math.PI / 2; add(r, 1); }
  // the courtyard glass round the oculus
  const inner = new THREE.CylinderGeometry(Ri, Ri, H, 64, 1, true); const im = mesh(inner, M.glass, 0, 0.16 + H / 2, 0); im.renderOrder = 2; add(im, 4, 'fade');
  for (let i = 0; i < 20; i++) { const t = i / 20 * Math.PI * 2; add(box(0.05, H, 0.05, M.red, Ri * Math.cos(t), 0.16 + H / 2, Ri * Math.sin(t)), 1); }
  add(slab(KIT.sectorShape(Ri + 0.05, Rg - 0.05, 0, Math.PI * 2), 0.04, M.warm, 0.16), 2, 'drop');
  // the ring roof: thick, white, rounded at both edges
  const ringShape = new THREE.Shape(); ringShape.absarc(0, 0, Ro, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, Ri, 0, Math.PI * 2, true); ringShape.holes.push(hole);
  // opening for the twin panels on the back of the rim
  const kx = 2.6, kz = 0.95, kcz = -(Ri + Ro) / 2 - 0.1;
  const slot = new THREE.Path(); slot.moveTo(-kx / 2, -kcz - kz / 2); slot.lineTo(-kx / 2, -kcz + kz / 2); slot.lineTo(kx / 2, -kcz + kz / 2); slot.lineTo(kx / 2, -kcz - kz / 2); slot.closePath(); ringShape.holes.push(slot);
  add(roundSlab(ringShape, T, M.whiteGloss, 0.16 + H, 0.14), 3, 'drop');
  add(slab(KIT.sectorShape(Ri + 0.3, Rg - 0.3, 0, Math.PI * 2), 0.02, M.room, 0.14 + H), 5, 'fade');
  add(cyl(0.9, 0.9, 0.35, M.fabric, 2.6, 0.35, 1.2, 24), 5); add(cyl(0.8, 0.8, 0.35, M.fabric, -2.4, 0.35, -1.6, 24), 5);
  const ky = 0.16 + H + T;
  const mech = butterfly(add, kx, kz, ky, { cz: kcz, maxA: 0.55 });
  return finish({ id: 'studio-ring-stage', G, parts, top: V(0, ky, kcz), centre: V(0, 1.2, 0), mech, beamR: [0.7, 1.4], beamScale: [1.6, 0.8], beamH: 5, scale: 0.5 });
}

/* =================== S2 · Episode 10 — Zambezi Curve Pavilion =================== */
function zambezi() {
  const { G, parts, add } = kit('zambezi-curve-pavilion');
  // the shell: one double-curved surface, a high open arch on the left falling to a low tip on the right
  const X0 = -4.4, X1 = 4.6, Z0 = -2.7, Z1 = 2.7, nu = 60, nv = 30;
  const crestX = -0.6;
  const shellY = (x, z) => {
    const u = (x - X0) / (X1 - X0), v = (z - Z0) / (Z1 - Z0);
    const along = 0.4 + 2.75 * Math.exp(-(((u - 0.4) / 0.42) ** 2)) + 0.6 * (1 - u) ** 3 + 0.9 * Math.max(0, (u - 0.78) / 0.22) ** 2;
    const across = 1 - 0.34 * (2 * v - 1) ** 2 + 0.12 * Math.sin(u * Math.PI * 2) * (2 * v - 1);
    return along * across;
  };
  const hole = (x, z) => Math.abs(x - crestX) < 1.25 && Math.abs(z) < 0.8;
  const pos = [], idx = [], uv = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const x = X0 + (X1 - X0) * i / nu, z = Z0 + (Z1 - Z0) * j / nv;
    pos.push(x, shellY(x, z), z); uv.push(i / nu, j / nv);
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    const cx = X0 + (X1 - X0) * (i + 0.5) / nu, cz = Z0 + (Z1 - Z0) * (j + 0.5) / nv;
    if (hole(cx, cz)) continue;
    idx.push(a, c, b, b, c, d);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx); sg.computeVertexNormals();
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xF3F1ED, roughness: 0.35, clearcoat: 0.5, side: THREE.DoubleSide });
  const shell = mesh(sg, shellMat); add(shell, 3, 'drop');
  // the shell's thickness, seen along its free edges
  for (const edge of [(k) => [X0 + (X1 - X0) * k, Z0], (k) => [X0 + (X1 - X0) * k, Z1], (k) => [X0, Z0 + (Z1 - Z0) * k], (k) => [X1, Z0 + (Z1 - Z0) * k]]) {
    const c = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => { const [x, z] = edge(i / 40); return V(x, shellY(x, z) - 0.05, z); }));
    add(mesh(new THREE.TubeGeometry(c, 80, 0.08, 6), shellMat), 3, 'drop');
  }
  // a red edge along the crest opening
  const hy = (x, z) => shellY(x, z) + 0.03;
  for (const [a, b] of [[[crestX - 1.25, -0.8], [crestX + 1.25, -0.8]], [[crestX + 1.25, -0.8], [crestX + 1.25, 0.8]], [[crestX + 1.25, 0.8], [crestX - 1.25, 0.8]], [[crestX - 1.25, 0.8], [crestX - 1.25, -0.8]]])
    add(bar(V(a[0], hy(...a), a[1]), V(b[0], hy(...b), b[1]), 0.07, M.red), 3, 'drop');
  // red arch ribs under the shell, each a trussed pair of chords
  for (const x of [-3.4, -1.9, crestX, 0.9, 2.5]) {
    const top = [], low = [];
    for (let k = 0; k <= 16; k++) { const z = Z0 + 0.25 + (Z1 - Z0 - 0.5) * k / 16, y = shellY(x, z) - 0.12; top.push(V(x, Math.max(0.05, y), z)); low.push(V(x, Math.max(0.05, y * 0.72), z * 0.9)); }
    for (let k = 0; k < 16; k++) {
      add(bar(top[k], top[k + 1], 0.07, M.red), 1); add(bar(low[k], low[k + 1], 0.06, M.red), 1);
      add(bar(k % 2 ? top[k] : low[k], k % 2 ? low[k + 1] : top[k + 1], 0.045, M.red), 1);
    }
    add(bar(V(x, 0.05, Z0 + 0.25), top[0], 0.08, M.red), 1); add(bar(V(x, 0.05, Z1 - 0.25), top[16], 0.08, M.red), 1);
  }
  // the right-hand legs where the shell comes down
  for (const z of [-1.6, 1.6]) add(bar(V(4.3, 0.05, z), V(3.6, shellY(3.6, z) - 0.1, z * 0.9), 0.1, M.red), 1);
  add(box(8.8, 0.1, 5.2, M.concreteLight, 0, 0.05, 0), 0);
  add(box(6.0, 0.04, 3.6, M.warm, -0.4, 0.12, 0), 2, 'drop');
  add(box(2.2, 0.4, 0.8, M.fabric, -1.2, 0.34, 0.6), 5); add(box(1.4, 0.04, 0.8, M.wood, 0.9, 0.74, -0.5), 5);
  // the solar butterfly: two photovoltaic leaves over the crest opening, lifting and opening into a V
  const ky = shellY(crestX, 0) + 0.05;
  const mech = butterfly(add, 2.5, 1.6, ky, { cx: crestX, maxA: 0.75, lift: 1.3, leaf: solar(), frame: M.red });
  return finish({ id: 'zambezi-curve-pavilion', G, parts, top: V(crestX, ky, 0), centre: V(0, 1.4, 0), mech, beamR: [0.9, 1.6], beamH: 7, scale: 0.55 });
}

export const BUILDERS_S2 = {
  'rondavel-concept': rondavel,
  'lumen-curved-pavilion': curvedPavilion,
  'conical-tower-loft': conicalTower,
  'chevron-pavilion': chevronPavilion,
  'triple-rondavel-cluster': tripleRondavel,
  'matobo-boulder-house': matobo,
  'terraced-hillside': terraced,
  'studio-ring-stage': ringPavilion,
  'zambezi-curve-pavilion': zambezi
};
