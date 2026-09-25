/* KARLCON Studio — the buildings that stand on stage, one per episode.
   Every building shares the same build sequence, driven by the `build` cue (0–7):
     0 foundations · 1 structure · 2 floors · 3 walls and roof · 4 glazing · 5 interior · 6 roof light · 7 complete
   and the `open` cue (0–1) drives its own roof mechanism:
     cantilever-pavilion   bi-parting hinged pair            (Episode 1)
     lumen-oval-residence  telescoping curved panels          (Episode 2)
     rotunda-fan-house     radial fan of glass wedges         (Episode 3)
     origami-crown-villa   eight-petal folding crown          (Episode 4)
     stone-arcade-house    bi-parting hinged pair             (Episode 5)
     granite-plinth-tower  bi-parting pair on struts          (Episode 6)
   These are presentation models of AI-assisted concept renders, not engineering models. */
import * as THREE from 'three';

const RED = 0xD0231A;
const M = {
  red: new THREE.MeshPhysicalMaterial({ color: RED, roughness: 0.32, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  white: new THREE.MeshStandardMaterial({ color: 0xF4F2EF, roughness: 0.55 }),
  whiteGloss: new THREE.MeshPhysicalMaterial({ color: 0xF7F6F4, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.12 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x7E7C78, roughness: 0.95 }),
  concreteLight: new THREE.MeshStandardMaterial({ color: 0xB8B6B2, roughness: 0.9 }),
  granite: new THREE.MeshStandardMaterial({ color: 0x2B2C30, roughness: 0.75, metalness: 0.05 }),
  alu: new THREE.MeshStandardMaterial({ color: 0x3A3D42, roughness: 0.35, metalness: 0.85 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0E0F11, roughness: 0.6, metalness: 0.3 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xDCEBF2, roughness: 0.04, transparent: true, opacity: 0.22, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false }),
  leaf: new THREE.MeshPhysicalMaterial({ color: 0xBFD6DF, roughness: 0.05, transparent: true, opacity: 0.55, envMapIntensity: 1.6, side: THREE.DoubleSide }),
  warm: new THREE.MeshStandardMaterial({ color: 0xF1E6D6, roughness: 0.8, emissive: 0xFFD9A8, emissiveIntensity: 0.18 }),
  room: new THREE.MeshStandardMaterial({ color: 0xE9D2B0, roughness: 0.9, emissive: 0xFFC98A, emissiveIntensity: 0.55 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0xE9E4DC, roughness: 0.95 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8A6A4A, roughness: 0.7 }),
  leafGreen: new THREE.MeshStandardMaterial({ color: 0x4E6B3A, roughness: 0.9 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x7D8466, roughness: 0.95 }),
  fire: new THREE.MeshBasicMaterial({ color: 0xFF8A2A })
};
let stoneMat = null;
function stone() {
  if (stoneMat) return stoneMat;
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#8F8A82'; g.fillRect(0, 0, 512, 512);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < 512; y += 38) for (let x = -40; x < 552; x += 0) {
    const w = 40 + rnd() * 60, h = 30 + rnd() * 14, v = 200 + rnd() * 40 | 0;
    g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
    g.beginPath(); g.ellipse(x + w / 2, y + 19 + (rnd() - .5) * 6, w / 2 - 3, h / 2 - 2, (rnd() - .5) * .3, 0, 7); g.fill();
    x += w;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(0.9, 0.9);
  stoneMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  return stoneMat;
}

/* ---------- geometry helpers ---------- */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return o; }
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const cyl = (rt, rb, h, m, x, y, z, seg = 28) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z);
/** a square bar from a to b */
function bar(a, b, t, m) { const o = box(t, t, a.distanceTo(b), m, 0, 0, 0); o.position.copy(a).add(b).multiplyScalar(0.5); o.lookAt(b); return o; }
/** horizontal extruded slab from a 2D shape (shape x → x, shape y → -z), bottom at y */
function slab(shape, h, m, y = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 48 });
  g.rotateX(-Math.PI / 2); return mesh(g, m, 0, y, 0);
}
function ellipse(a, b, hole) {
  const s = new THREE.Shape(); s.absellipse(0, 0, a, b, 0, Math.PI * 2, false);
  if (hole) { const p = new THREE.Path(); p.absellipse(0, 0, hole[0], hole[1], 0, Math.PI * 2, true); s.holes.push(p); }
  return s;
}
function sectorShape(r0, r1, a0, a1) {
  const s = new THREE.Shape(), n = 24;
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; i ? s.lineTo(Math.cos(a) * r1, Math.sin(a) * r1) : s.moveTo(Math.cos(a) * r1, Math.sin(a) * r1); }
  for (let i = n; i >= 0; i--) { const a = a0 + (a1 - a0) * i / n; s.lineTo(Math.cos(a) * r0, Math.sin(a) * r0); }
  return s;
}
/** open elliptical wall (glass drum), centred at y */
function drum(a, b, h, m, y) { const g = new THREE.CylinderGeometry(1, 1, h, 72, 1, true); g.scale(a, 1, b); const o = mesh(g, m, 0, y, 0); o.renderOrder = 2; return o; }
function tree(x, z, h, y = 0, m = M.leafGreen) {
  const t = new THREE.Group(); t.position.set(x, y, z);
  t.add(cyl(0.04, 0.06, h * 0.45, M.wood, 0, h * 0.22, 0, 8));
  const c = mesh(new THREE.IcosahedronGeometry(h * 0.32, 1), m, 0, h * 0.62, 0); c.scale.set(1, 1.15, 1); t.add(c);
  return t;
}
/** stone wall with arched openings; runs along local +x from 0 to len, extruded to +z by t */
function stoneWall(len, h, arches = [], t = 0.4) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, h); s.lineTo(0, h); s.lineTo(0, 0);
  for (const { x, r, spring } of arches) {
    const p = new THREE.Path(); p.moveTo(x - r, 0.06); p.lineTo(x - r, spring);
    for (let i = 1; i <= 16; i++) { const a = Math.PI - Math.PI * i / 16; p.lineTo(x + r * Math.cos(a), spring + r * Math.sin(a)); }
    p.lineTo(x + r, 0.06); p.lineTo(x - r, 0.06); s.holes.push(p);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 16 });
  const o = mesh(g, stone());
  // lit rooms seen through the arches
  for (const { x, r, spring } of arches) {
    const back = mesh(new THREE.PlaneGeometry(r * 2, spring + r), M.room, x, (spring + r) / 2, 0.02); o.add(back);
  }
  return o;
}

/* ---------- the shared building shell: parts, build sequence, lamp, daylight ---------- */
function kit(name) {
  const G = new THREE.Group(); G.name = name; const parts = [];
  const add = (obj, stage, mode = 'grow') => { obj.userData.stage = stage; obj.userData.mode = mode; obj.userData.baseY = obj.position.y; obj.userData.baseScale = obj.scale.clone(); G.add(obj); parts.push(obj); return obj; };
  return { G, parts, add };
}
function finish({ id, G, parts, top, centre, mech, beamR = [0.75, 1.3], beamScale = [1, 1], beamH = 6, scale = 0.82 }) {
  const lamp = new THREE.PointLight(0xFFD2A0, 0, 9, 1.6); lamp.position.copy(centre).add(V(0, 0.6, 0)); G.add(lamp);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xFFF1D6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beamGeo = new THREE.CylinderGeometry(beamR[0], beamR[1], beamH, 40, 1, true); beamGeo.scale(beamScale[0], 1, beamScale[1]);
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(top.x, top.y - beamH / 2 + 1.6, top.z); G.add(beam);
  // footprint of the finished building, used to fit a real Meshy model in its place
  const fb = new THREE.Box3(); for (const o of parts) fb.expandByObject(o);
  const footprint = { size: fb.getSize(V(0, 0, 0)), centre: fb.getCenter(V(0, 0, 0)) };
  return {
    id, group: G, parts, lamp, beam, scale, build: 7, open: 0, openTarget: 0, buildTarget: 7, top, centre, footprint,
    hero: null, heroA: 0, heroMats: [], useHero: true,
    /** show a real (Meshy) model as the finished building; the procedural model still does the
        build sequence and the roof mechanism, cross-fading in and out around them */
    setHero(obj, yaw = 0) {
      const b = new THREE.Box3().setFromObject(obj), sz = b.getSize(V(0, 0, 0)), c = b.getCenter(V(0, 0, 0));
      const k = Math.max(footprint.size.x, footprint.size.z) / Math.max(sz.x, sz.z, 1e-3);
      const holder = new THREE.Group(); obj.position.set(-c.x, -b.min.y, -c.z); holder.add(obj);
      holder.scale.setScalar(k); holder.rotation.y = yaw; holder.position.set(footprint.centre.x, 0, footprint.centre.z);
      this.heroMats = [];
      obj.traverse((n) => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; n.material = (Array.isArray(n.material) ? n.material : [n.material]).map((m) => { const c2 = m.clone(); c2.transparent = true; c2.opacity = 0; this.heroMats.push(c2); return c2; }); if (n.material.length === 1) n.material = n.material[0]; } });
      if (this.hero) G.remove(this.hero);
      this.hero = holder; holder.visible = false; G.add(holder);
    },
    setBuild(p) { this.buildTarget = p; }, setOpen(o) { this.openTarget = o; },
    reset() { this.build = this.buildTarget = 7; this.open = this.openTarget = 0; this.heroA = this.hero && this.useHero ? 1 : 0; this.update(0); },
    update(dt) {
      const up = this.buildTarget > this.build;
      this.build += Math.sign(this.buildTarget - this.build) * Math.min(Math.abs(this.buildTarget - this.build), dt * (up ? 0.55 : 3.5));
      this.open += (this.openTarget - this.open) * Math.min(1, dt * 0.9);
      for (const o of parts) {
        const k = THREE.MathUtils.clamp(this.build - o.userData.stage, 0, 1), e = k * k * (3 - 2 * k);
        o.visible = k > 0.001;
        if (o.userData.mode === 'grow') { o.scale.y = o.userData.baseScale.y * Math.max(0.001, e); o.position.y = o.userData.baseY - (1 - e) * (o.geometry?.parameters?.height || 0.5) * 0.5; }
        else if (o.userData.mode === 'drop') o.position.y = o.userData.baseY + (1 - e) * 2.2;
        else o.visible = k > 0.02;
      }
      mech(this.build >= 6.5 ? this.open : 0);
      if (this.hero) {
        const want = this.useHero && this.build >= 6.99 && this.buildTarget >= 7 && this.openTarget < 0.05 && this.open < 0.08 ? 1 : 0;
        this.heroA += (want - this.heroA) * Math.min(1, dt * 1.6);
        this.hero.visible = this.heroA > 0.01;
        for (const m of this.heroMats) m.opacity = this.heroA;
        if (this.heroA > 0.985) for (const o of parts) o.visible = false;      // fully swapped: only the real model shows
      }
      lamp.intensity = this.build > 5.5 ? 6 : 0;
      beamMat.opacity = this.build >= 6.5 ? Math.max(0, this.open - 0.35) * 0.16 : 0;
    }
  };
}
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** bi-parting pair hinged on the outer edges of a kx × kz opening at height ky */
function biparting(add, kx, kz, ky, cx = 0, cz = 0, struts = false) {
  add(box(kx + 0.2, 0.16, 0.1, M.alu, cx, ky + 0.08, cz - kz / 2), 6); add(box(kx + 0.2, 0.16, 0.1, M.alu, cx, ky + 0.08, cz + kz / 2), 6);
  add(box(0.1, 0.16, kz, M.alu, cx - kx / 2 - 0.05, ky + 0.08, cz), 6); add(box(0.1, 0.16, kz, M.alu, cx + kx / 2 + 0.05, ky + 0.08, cz), 6);
  const geo = new THREE.BoxGeometry(kx / 2, 0.03, kz); geo.translate(kx / 4, 0, 0);
  const hinges = [];
  for (const side of [-1, 1]) {
    const h = new THREE.Group(); h.position.set(cx + side * kx / 2, ky + 0.17, cz); if (side > 0) h.rotation.y = Math.PI;
    const leaf = new THREE.Mesh(geo, M.leaf); leaf.castShadow = true; h.add(leaf);
    leaf.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: RED })));
    for (const z of [-kz / 2, kz / 2]) leaf.add(box(kx / 2, 0.04, 0.05, M.red, kx / 4, 0.01, z));
    let strut = null;
    if (struts) { strut = box(0.03, 0.03, 0.4, M.alu, kx / 4, 0, kz / 2 - 0.1); h.add(strut); }
    add(h, 6, 'fade'); hinges.push({ h, strut });
  }
  return (open) => {
    const a = open * 1.05;
    for (const { h, strut } of hinges) {
      h.rotation.z = a;
      if (strut) { strut.rotation.x = 0; strut.scale.z = 0.2 + open; strut.position.y = -0.1 * open; }
    }
  };
}

/* =================== Episode 1 — Elevated Glass Cube Residence =================== */
function cube() {
  const { G, parts, add } = kit('cantilever-pavilion');
  const W = 4.4, D = 3.2, H = 2.7, LIFT = 2.7, T = 0.18;
  for (const [x, z] of [[-1.75, -1.1], [1.75, -1.1], [-1.75, 1.1], [1.75, 1.1]]) {
    add(box(0.62, 0.1, 0.62, M.concrete, x, 0.05, z), 0);
    add(box(0.24, LIFT, 0.24, M.red, x, LIFT / 2 + 0.12, z), 1);
  }
  add(box(W, T, D, M.white, 0, LIFT + T / 2 + 0.12, 0), 2, 'drop');
  const y0 = LIFT + T + 0.12, kx = 2.0, kz = 1.5, ry = y0 + H + T / 2;
  add(box(W, T, (D - kz) / 2, M.white, 0, ry, -(kz / 2 + (D - kz) / 4)), 3, 'drop');
  add(box(W, T, (D - kz) / 2, M.white, 0, ry, (kz / 2 + (D - kz) / 4)), 3, 'drop');
  add(box((W - kx) / 2, T, kz, M.white, -(kx / 2 + (W - kx) / 4), ry, 0), 3, 'drop');
  add(box((W - kx) / 2, T, kz, M.white, (kx / 2 + (W - kx) / 4), ry, 0), 3, 'drop');
  add(box(T, H, D, M.white, -W / 2 + T / 2, y0 + H / 2, 0), 3);
  add(box(T, H, D, M.white, W / 2 - T / 2, y0 + H / 2, 0), 3);
  add(box(W, H, T, M.white, 0, y0 + H / 2, -D / 2 + T / 2), 3);
  const glass = mesh(new THREE.PlaneGeometry(W - 2 * T, H), M.glass, 0, y0 + H / 2, D / 2 - 0.04); glass.renderOrder = 2; add(glass, 4, 'fade');
  for (let i = 0; i <= 4; i++) add(box(0.05, H, 0.07, M.alu, -W / 2 + T + i * (W - 2 * T) / 4, y0 + H / 2, D / 2 - 0.04), 4);
  add(box(W - 2 * T, 0.06, 0.08, M.alu, 0, y0 + 0.03, D / 2 - 0.04), 4); add(box(W - 2 * T, 0.06, 0.08, M.alu, 0, y0 + H - 0.03, D / 2 - 0.04), 4);
  add(box(W - 2 * T, 0.02, D - T, M.warm, 0, y0 + 0.01, 0), 5, 'fade');
  add(box(1.8, 0.42, 0.8, M.fabric, -0.9, y0 + 0.21, -0.9), 5); add(box(1.8, 0.5, 0.18, M.fabric, -0.9, y0 + 0.55, -1.25), 5);
  add(box(1.2, 0.68, 0.04, M.black, 0.9, y0 + 1.35, -1.47), 5);
  for (const x of [-0.2, 0.35]) { const s = new THREE.Group(); s.add(cyl(0.2, 0.12, 0.48, M.red, 0, 0.24, 0)); s.add(cyl(0.21, 0.21, 0.04, M.red, 0, 0.5, 0)); s.position.set(x, y0, 0.55); add(s, 5); }
  add(box(0.5, H - 0.1, 0.04, M.fabric, -1.85, y0 + H / 2, 1.35), 5);
  const ky = y0 + H + T;
  const mech = biparting(add, kx, kz, ky);
  return finish({ id: 'cantilever-pavilion', G, parts, top: V(0, ky, 0), centre: V(0, y0 + H / 2, 0), mech, beamH: H + 3 });
}

/* =================== Episode 2 — Lumen Oval Residence =================== */
function oval() {
  const { G, parts, add } = kit('lumen-oval-residence');
  const a = 3.1, b = 1.85, ha = 2.35, hb = 1.25;
  add(slab(ellipse(a + 0.15, b + 0.15), 0.22, M.white, 0), 0);
  add(slab(ellipse(a + 0.19, b + 0.19), 0.06, M.red, 0.05), 0);
  add(cyl(0.35, 0.35, 3.1, M.white, 0.2, 1.72, -0.4), 1);
  for (const [x, z] of [[-1.9, -0.9], [-1.9, 0.9], [1.9, -0.9], [1.9, 0.9], [0, 1.25], [0, -1.25]]) add(box(0.08, 3.1, 0.08, M.alu, x, 1.72, z), 1);
  add(slab(ellipse(a + 0.05, b + 0.05), 0.28, M.whiteGloss, 1.55), 2, 'drop');
  add(slab(ellipse(a + 0.09, b + 0.09), 0.05, M.red, 1.56), 2, 'drop');
  add(slab(ellipse(a + 0.28, b + 0.28, [ha, hb]), 0.42, M.whiteGloss, 3.1), 3, 'drop');
  add(slab(ellipse(ha + 0.05, hb + 0.05, [ha, hb]), 0.44, M.red, 3.09), 3, 'drop');
  add(drum(a * 0.9, b * 0.88, 1.33, M.glass, 0.885), 4, 'fade');
  add(drum(a * 0.86, b * 0.84, 1.27, M.glass, 2.465), 4, 'fade');
  add(drum(a + 0.14, b + 0.14, 0.45, M.glass, 0.445), 4, 'fade');          // terrace balustrade
  for (let i = 0; i < 28; i++) {
    const t = i / 28 * Math.PI * 2;
    add(box(0.035, 1.33, 0.035, M.alu, a * 0.9 * Math.cos(t), 0.885, b * 0.88 * Math.sin(t)), 4);
    add(box(0.035, 1.27, 0.035, M.alu, a * 0.86 * Math.cos(t), 2.465, b * 0.84 * Math.sin(t)), 4);
  }
  add(slab(ellipse(a * 0.88, b * 0.86), 0.02, M.warm, 0.22), 5, 'fade');
  add(slab(ellipse(a * 0.84, b * 0.82), 0.02, M.warm, 1.84), 5, 'fade');
  const sofa = slab(sectorShape(0.5, 0.85, 0.35 * Math.PI, 1.75 * Math.PI), 0.4, M.fabric, 1.86); sofa.position.x = -1.2; add(sofa, 5);
  add(cyl(0.32, 0.32, 0.12, M.wood, -1.2, 2.0, 0), 5);
  add(box(1.2, 0.06, 0.55, M.wood, 1.0, 2.6, -0.2), 5);
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) add(box(0.14, 0.45, 0.14, M.red, 0.55 + i * 0.22, 2.08, -0.2 + s * 0.4), 5);
  for (const x of [-1.4, 0.2]) add(box(0.3, 0.12, 0.7, M.fabric, x, 0.3, b * 0.95), 5);
  // telescoping roof: seven curved panels slide toward +x and stack
  const N = 7, w = 2 * ha / N, yTop = 3.52, panels = [];
  for (let i = 0; i < N; i++) {
    const x0 = -ha + w * (i + 0.5), d = 2 * hb * Math.sqrt(Math.max(0.05, 1 - (Math.abs(x0) / ha) ** 2)) + 0.12;
    const g = new THREE.Group();
    const glassP = box(w - 0.03, 0.03, d, M.leaf, 0, 0, 0); g.add(glassP);
    g.add(box(0.05, 0.08, d + 0.04, M.red, -w / 2 + 0.03, 0.02, 0));
    const y0 = yTop + 0.1 + 0.14 * Math.cos(x0 / ha * Math.PI / 2);
    g.position.set(x0, y0, 0); add(g, 6, 'fade');
    panels.push({ g, x0, y0, x1: ha - w / 2 - 0.05 - (N - 1 - i) * 0.05, y1: yTop + 0.16 + (N - 1 - i) * 0.07 });
  }
  const mech = (open) => {
    for (const [i, p] of panels.entries()) {
      const k = ease(clamp01(open * 1.35 - (N - 1 - i) * 0.05));
      p.g.position.x = p.x0 + (p.x1 - p.x0) * k; p.g.position.y = p.y0 + (p.y1 - p.y0) * k;
    }
  };
  return finish({ id: 'lumen-oval-residence', G, parts, top: V(0, yTop, 0), centre: V(0, 1.8, 0), mech, beamR: [1, 1.2], beamScale: [2.1, 1.1], beamH: 6, scale: 0.8 });
}

/* =================== Episode 3 — Rotunda Fan-Roof House =================== */
function rotunda() {
  const { G, parts, add } = kit('rotunda-fan-house');
  const R = 2.5, top = 3.66;
  add(cyl(3.05, 3.1, 0.3, M.white, 0, 0.15, 0, 72), 0);
  add(cyl(3.25, 3.3, 0.1, M.concreteLight, 0, 0.05, 0, 72), 0);
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6 * Math.PI * 2, bt = box(0.38, 3.4, 0.6, M.white, 2.78 * Math.cos(t), 1.95, 2.78 * Math.sin(t));
    bt.rotation.y = -t; add(bt, 1);
  }
  add(cyl(0.2, 0.2, 3.0, M.room, 0.9, 1.8, -1.2, 16), 1);
  add(cyl(R, R, 0.05, M.white, 0, 0.32, 0, 72), 2, 'drop');
  add(slab(sectorShape(2.15, 2.92, 0, Math.PI * 2), 0.36, M.white, 3.3), 3, 'drop');
  const rim = mesh(new THREE.TorusGeometry(2.92, 0.07, 10, 96), M.red, 0, 3.6, 0); rim.rotation.x = Math.PI / 2; add(rim, 3, 'drop');
  const inner = mesh(new THREE.TorusGeometry(2.15, 0.045, 8, 96), M.red, 0, 3.66, 0); inner.rotation.x = Math.PI / 2; add(inner, 3, 'drop');
  add(drum(R, R, 2.98, M.glass, 1.81), 4, 'fade');
  for (let i = 0; i < 30; i++) { const t = i / 30 * Math.PI * 2; add(box(0.03, 2.98, 0.03, M.alu, R * Math.cos(t), 1.81, R * Math.sin(t)), 4); }
  add(cyl(2.45, 2.45, 0.02, M.warm, 0, 0.35, 0, 72), 5, 'fade');
  add(slab(sectorShape(1.05, 1.4, 0.15 * Math.PI, 1.3 * Math.PI), 0.42, M.fabric, 0.36), 5);
  add(cyl(0.4, 0.4, 0.14, M.wood, 0, 0.5, 0), 5);
  add(box(1.3, 0.06, 0.5, M.black, -0.6, 0.9, 1.6), 5);
  add(box(1.6, 0.9, 0.5, M.black, 0.4, 0.8, -1.9), 5);
  for (const [x, z] of [[1.7, 1.1], [-1.9, 0.6], [-1.2, -1.7]]) add(tree(x, z, 1.8, 0.36), 5);
  // fan: eight wedges on a central pivot; wedges swing round and stack over the last one
  const N = 8, wedges = [];
  for (let i = 0; i < N; i++) {
    const piv = new THREE.Group(); piv.position.set(0, top, 0); piv.rotation.y = i * Math.PI * 2 / N;
    const w = slab(sectorShape(0.16, 2.17, 0, Math.PI * 2 / N - 0.012), 0.035, M.leaf, 0); w.castShadow = true; piv.add(w);
    const a1 = Math.PI * 2 / N - 0.012;
    piv.add(bar(V(0.16, 0.04, 0), V(2.17, 0.04, 0), 0.05, M.red));
    piv.add(bar(V(0.16 * Math.cos(a1), 0.04, -0.16 * Math.sin(a1)), V(2.17 * Math.cos(a1), 0.04, -2.17 * Math.sin(a1)), 0.05, M.red));
    const arc = mesh(new THREE.TorusGeometry(2.17, 0.025, 6, 16, a1), M.red, 0, 0.04, 0); arc.rotation.x = Math.PI / 2; arc.rotation.z = 0; arc.scale.y = -1; piv.add(arc);
    add(piv, 6, 'fade');
    wedges.push({ piv, a0: i * Math.PI * 2 / N, a1: (N - 1) * Math.PI * 2 / N - (N - 1 - i) * 0.05, lift: (N - 1 - i) * 0.05 });
  }
  add(cyl(0.2, 0.2, 0.16, M.red, 0, top + 0.1, 0, 20), 6);
  const mech = (open) => {
    for (const w of wedges) {
      const up = ease(clamp01(open * 4)), turn = ease(clamp01((open - 0.12) / 0.88));
      w.piv.rotation.y = w.a0 + (w.a1 - w.a0) * turn; w.piv.position.y = top + w.lift * up;
    }
  };
  return finish({ id: 'rotunda-fan-house', G, parts, top: V(0, top, 0), centre: V(0, 1.8, 0), mech, beamR: [1.6, 2.0], beamH: 6, scale: 0.8 });
}

/* =================== Episode 4 — Origami Crown Villa =================== */
function crown() {
  const { G, parts, add } = kit('origami-crown-villa');
  add(box(5.8, 0.2, 5.8, M.concreteLight, 0, 0.1, 0), 0);
  for (let i = 0; i < 3; i++) add(box(1.5, 0.2 - i * 0.06, 0.35, M.concreteLight, -1.3, 0.1 - i * 0.03, 3.05 + i * 0.35), 0);
  for (const [x, z] of [[-2.55, 2.2], [-0.95, 2.2], [0.95, 2.2], [2.55, 2.2], [2.55, -2.4], [-2.55, -2.4]]) add(box(0.16, 2.4, 0.16, M.red, x, 1.4, z), 1);
  add(cyl(0.16, 0.16, 2.6, M.alu, 0, 1.5, 0, 12), 1);
  add(box(5.6, 0.3, 5.0, M.white, 0, 2.75, -0.1), 2, 'drop');
  add(box(1.9, 0.28, 0.9, M.white, 0, 3.05, 2.8), 2, 'drop');
  const H = 2.3, yb = 2.9;
  for (const s of [-1, 1]) {
    add(box(2.0, H, 4.8, M.white, s * 1.75, yb + H / 2, -0.1), 3);
    // window frames on the front and outer side: lit rooms behind glass
    const f = mesh(new THREE.PlaneGeometry(1.5, 1.55), M.room, s * 1.75, yb + 1.1, 2.31); add(f, 4, 'fade');
    const fg = mesh(new THREE.PlaneGeometry(1.5, 1.55), M.glass, s * 1.75, yb + 1.1, 2.32); add(fg, 4, 'fade');
    const sd = mesh(new THREE.PlaneGeometry(3.8, 1.55), M.room, s * 2.76, yb + 1.1, -0.1); sd.rotation.y = s * Math.PI / 2; add(sd, 4, 'fade');
    for (let i = 0; i < 4; i++) add(box(0.04, 1.55, 0.05, M.black, s * (1.0 + i * 0.5), yb + 1.1, 2.33), 4);
  }
  add(box(1.5, H, 1.6, M.white, 0, yb + H / 2, -1.7), 3);
  const ap = 0.75, s8 = 2 * ap * Math.tan(Math.PI / 8), ky = yb + H;
  for (let k = 0; k < 8; k++) {
    const t = k * Math.PI / 4 + Math.PI / 8, kb = box(s8 + 0.06, 0.14, 0.12, M.alu, (ap + 0.06) * Math.cos(t), ky + 0.07, (ap + 0.06) * Math.sin(t));
    kb.rotation.y = -t + Math.PI / 2; add(kb, 3);
  }
  add(mesh(new THREE.PlaneGeometry(1.5, H), M.glass, 0, yb + H / 2, 0.9), 4, 'fade');
  add(box(1.9, 0.9, 0.03, M.glass, 0, 3.65, 3.24), 4, 'fade');
  // ground floor glass box
  for (const [w, x, z, ry] of [[4.2, 0.1, 1.5, 0], [4.2, 0.1, -2.1, 0], [3.6, -2.0, -0.3, Math.PI / 2], [3.6, 2.2, -0.3, Math.PI / 2]]) {
    const p = mesh(new THREE.PlaneGeometry(w, 2.4), M.glass, x, 1.4, z); p.rotation.y = ry; add(p, 4, 'fade');
  }
  add(box(4.1, 0.02, 3.5, M.warm, 0.1, 0.21, -0.3), 5, 'fade');
  add(box(1.9, 0.4, 0.7, M.fabric, -0.8, 0.4, 2.5), 5); add(box(0.7, 0.4, 1.3, M.fabric, -1.95, 0.4, 2.2), 5);
  add(box(0.9, 0.25, 0.45, M.black, -0.6, 0.32, 3.2), 5); add(box(0.7, 0.04, 0.2, M.fire, -0.6, 0.46, 3.2), 5);
  for (const [x, z] of [[-2.5, 2.9], [0.6, 2.9], [2.3, 2.6]]) { add(box(0.8, 0.35, 0.8, M.concreteLight, x, 0.37, z), 5); add(tree(x, z, 1.1, 0.5), 5); }
  add(box(1.6, 0.9, 0.6, M.wood, 1.3, 0.65, -1.2), 5);
  // eight petals hinged on the octagon edges: closed they meet as a low pyramid, open they fold out like a crown
  const L = 0.8, closedA = -Math.acos(ap / L), openA = -2.35, petals = [];
  const pg = new THREE.BufferGeometry().setFromPoints([V(0, 0, -s8 / 2), V(0, 0, s8 / 2), V(-L, 0, 0)]); pg.computeVertexNormals();
  for (let k = 0; k < 8; k++) {
    const t = k * Math.PI / 4 + Math.PI / 8, piv = new THREE.Group();
    piv.position.set(ap * Math.cos(t), ky + 0.16, ap * Math.sin(t)); piv.rotation.y = -t;
    const hinge = new THREE.Group(); piv.add(hinge);
    const p = new THREE.Mesh(pg, M.leaf); p.castShadow = true; hinge.add(p);
    hinge.add(bar(V(0, 0.01, -s8 / 2), V(-L, 0.01, 0), 0.04, M.red)); hinge.add(bar(V(0, 0.01, s8 / 2), V(-L, 0.01, 0), 0.04, M.red));
    hinge.add(bar(V(0, 0.01, -s8 / 2), V(0, 0.01, s8 / 2), 0.05, M.red));
    add(piv, 6, 'fade'); petals.push(hinge);
  }
  const mech = (open) => { for (const [k, h] of petals.entries()) h.rotation.z = closedA + (openA - closedA) * ease(clamp01(open * 1.2 - (k % 2) * 0.12)); };
  return finish({ id: 'origami-crown-villa', G, parts, top: V(0, ky, 0), centre: V(0, 2.6, 0), mech, beamR: [0.7, 1.0], beamH: 7, scale: 0.7 });
}

/* =================== Episode 5 — Stone Arcade House =================== */
function arcade() {
  const { G, parts, add } = kit('stone-arcade-house');
  add(box(6.6, 0.2, 5.4, M.concreteLight, 0, 0.1, 0.6), 0);
  const low = stoneWall(3.6, 0.6, [], 0.3); low.position.set(-3.2, 0.2, 3.0); add(low, 0);
  for (let i = 0; i < 3; i++) add(box(0.9, 0.2, 0.3, M.concreteLight, -2.6, 0.3 + i * 0.1, 2.5 - i * 0.3), 0);
  const hG = 2.2, sp = 1.2, r = 0.36;
  const w1 = stoneWall(3.8, hG, [0.7, 1.9, 3.1].map((x) => ({ x, r, spring: sp }))); w1.position.set(-2.8, 0.2, -0.4); add(w1, 1);
  const w2 = stoneWall(1.6, hG, [{ x: 0.8, r, spring: sp }]); w2.position.set(1.4, 0.2, 0); w2.rotation.y = -Math.PI / 2; add(w2, 1);
  const w3 = stoneWall(1.8, hG, [{ x: 0.9, r, spring: sp }]); w3.position.set(1.0, 0.2, 1.2); add(w3, 1);
  const w4 = stoneWall(3.3, hG, [{ x: 1.6, r, spring: sp }]); w4.position.set(2.4, 0.2, 1.6); w4.rotation.y = Math.PI / 2; add(w4, 1);
  const w5 = stoneWall(5.6, hG, []); w5.position.set(2.8, 0.2, -1.3); w5.rotation.y = Math.PI; add(w5, 1);
  const w6 = stoneWall(1.7, hG, []); w6.position.set(-2.4, 0.2, -1.7); w6.rotation.y = -Math.PI / 2; add(w6, 1);
  const y1 = 0.2 + hG;
  add(box(5.8, 0.25, 1.9, M.white, 0, y1 + 0.12, -0.85), 2, 'drop'); add(box(1.9, 0.25, 1.75, M.white, 1.9, y1 + 0.12, 0.9), 2, 'drop');
  add(box(3.9, 0.06, 0.06, M.red, -0.9, y1 - 0.02, 0.1), 2, 'drop'); add(box(0.06, 0.06, 1.7, M.red, 0.93, y1 - 0.02, 0.9), 2, 'drop'); add(box(1.9, 0.06, 0.06, M.red, 1.9, y1 - 0.02, 1.8), 2, 'drop');
  const H = 2.2, yr = y1 + 0.25 + H, T = 0.32, kx = 1.6, kz = 0.9, hx = 1.4, hz = -0.85;
  // roof, built around the roof-light opening
  add(box(5.8, T, 1.9 / 2 - kz / 2 + 0.05, M.white, 0, yr + T / 2, -1.8 + (1.9 / 2 - kz / 2) / 2 - 0.02), 3, 'drop');
  add(box(5.8, T, 1.9 / 2 - kz / 2 + 0.05, M.white, 0, yr + T / 2, 0.1 - (1.9 / 2 - kz / 2) / 2 + 0.02), 3, 'drop');
  add(box(hx - kx / 2 + 2.9, T, kz, M.white, (-2.9 + hx - kx / 2) / 2, yr + T / 2, hz), 3, 'drop');
  add(box(2.9 - hx - kx / 2, T, kz, M.white, (2.9 + hx + kx / 2) / 2, yr + T / 2, hz), 3, 'drop');
  add(box(1.9, T, 1.75, M.white, 1.9, yr + T / 2, 0.9), 3, 'drop');
  add(box(5.8, H, 0.16, M.white, 0, y1 + 0.25 + H / 2, -1.72), 3); add(box(0.16, H, 3.6, M.white, 2.82, y1 + 0.25 + H / 2, 0), 3);
  for (const [x, z] of [[-2.85, 0.05], [0.95, 0.05], [0.95, 1.72], [2.8, 1.72]]) add(box(0.06, H, 0.06, M.black, x, y1 + 0.25 + H / 2, z), 3);
  const yg = y1 + 0.25 + H / 2;
  for (const [w, x, z, ry] of [[3.8, -0.9, 0.05, 0], [1.65, 0.95, 0.9, Math.PI / 2], [1.85, 1.88, 1.73, 0]]) {
    const g = mesh(new THREE.PlaneGeometry(w, H), M.glass, x, yg, z); g.rotation.y = ry; add(g, 4, 'fade');
    const n = Math.round(w / 0.7);
    for (let i = 0; i <= n; i++) { const o = -w / 2 + i * w / n; add(box(0.04, H, 0.04, M.black, x + (ry ? 0 : o), yg, z + (ry ? o : 0)), 4); }
  }
  for (let i = 0; i <= 12; i++) add(box(0.02, 0.9, 0.02, M.black, -2.85 + i * 0.12, y1 + 0.7, 0.35), 4);
  add(box(1.5, 0.02, 0.02, M.black, -2.13, y1 + 1.15, 0.35), 4);
  add(box(5.6, 0.02, 1.7, M.room, 0, y1 + 0.26, -0.85), 5, 'fade'); add(box(1.8, 0.02, 1.7, M.room, 1.9, y1 + 0.26, 0.9), 5, 'fade');
  add(box(1.4, 0.35, 1.2, M.fabric, -2.0, y1 + 0.45, -0.9), 5); add(box(1.3, 0.4, 0.55, M.fabric, 0.2, y1 + 0.45, -1.2), 5);
  add(box(0.9, 0.05, 0.6, M.wood, 1.9, y1 + 0.95, 0.9), 5);
  add(tree(-1.6, 1.6, 2.2, 0.2, M.olive), 5);
  for (const x of [-0.6, 0.2]) { const l = box(0.45, 0.14, 1.1, M.fabric, x, 0.3, 1.9); l.rotation.y = 0.1; add(l, 5); }
  const mech = biparting(add, kx, kz, yr + T, hx, hz);
  return finish({ id: 'stone-arcade-house', G, parts, top: V(hx, yr + T, hz), centre: V(0, 2.3, 0), mech, beamR: [0.6, 1.0], beamH: 5, scale: 0.72 });
}

/* =================== Episode 6 — Granite Plinth Tower =================== */
function tower() {
  const { G, parts, add } = kit('granite-plinth-tower');
  add(box(4.2, 1.6, 2.8, M.granite, 0.4, 0.8, -0.3), 0);
  add(box(4.8, 0.9, 0.35, M.granite, -0.3, 0.45, 1.45), 0);
  for (let i = 0; i < 8; i++) add(box(0.7, 0.12, 0.25, M.granite, 1.75, 0.1 + i * 0.2, 1.3 - i * 0.25), 0);
  for (const [x, z] of [[-2.35, 1.45], [0.55, 1.6], [2.4, 1.4], [2.4, -1.5]]) add(box(0.14, 6.1, 0.14, M.red, x, 3.05, z), 1);
  add(box(5.6, 0.3, 3.7, M.concreteLight, -0.2, 2.2, 0.15), 2, 'drop');
  add(box(5.0, 0.3, 3.3, M.concreteLight, 0.1, 3.95, 0), 2, 'drop');
  const kx = 1.3, kz = 0.8, cx = 0.3, cz = -0.5, ry = 6.05, T = 0.28;
  add(box(4.4, T, cz - kz / 2 + 1.6, M.concreteLight, 0.3, ry, (-1.6 + cz - kz / 2) / 2), 3, 'drop');
  add(box(4.4, T, 1.4 - cz - kz / 2, M.concreteLight, 0.3, ry, (1.4 + cz + kz / 2) / 2), 3, 'drop');
  add(box(cx - kx / 2 + 1.9, T, kz, M.concreteLight, (-1.9 + cx - kx / 2) / 2, ry, cz), 3, 'drop');
  add(box(2.5 - cx - kx / 2, T, kz, M.concreteLight, (2.5 + cx + kx / 2) / 2, ry, cz), 3, 'drop');
  add(box(4.4, 1.85, 0.25, M.concreteLight, 0.3, 5.02, -1.47), 3); add(box(0.25, 1.85, 3.0, M.concreteLight, 2.37, 5.02, -0.1), 3);
  add(box(1.6, 1.4, 0.3, M.granite, -0.4, 3.05, -1.2), 3);
  for (const z of [-0.6, 0.1]) add(mesh(new THREE.PlaneGeometry(0.3, 1.2), M.black, 2.5, 5.0, z), 3).rotation.y = Math.PI / 2;
  for (const [w, h, x, y, z, ryy] of [[4.0, 1.5, -0.2, 3.05, 1.2, 0], [2.6, 1.5, -2.2, 3.05, -0.1, Math.PI / 2], [3.8, 1.75, 0.3, 5.0, 1.0, 0]]) {
    const g = mesh(new THREE.PlaneGeometry(w, h), M.glass, x, y, z); g.rotation.y = ryy; add(g, 4, 'fade');
  }
  add(box(5.4, 0.8, 0.03, M.glass, -0.2, 2.75, 1.98), 4, 'fade'); add(box(3.6, 0.8, 0.03, M.glass, -0.2, 4.5, 1.63), 4, 'fade');
  add(box(3.8, 0.02, 2.6, M.room, -0.2, 2.36, -0.1), 5, 'fade'); add(box(3.8, 0.02, 2.6, M.room, 0.3, 4.11, -0.2), 5, 'fade');
  add(box(3.0, 0.02, 2.0, M.warm, 0.3, 5.9, -0.2), 5, 'fade');
  add(box(0.8, 0.9, 0.5, M.black, 0.5, 2.8, -0.6), 5);
  const mech = biparting(add, kx, kz, ry + T / 2, cx, cz, true);
  return finish({ id: 'granite-plinth-tower', G, parts, top: V(cx, ry + T / 2, cz), centre: V(0, 3.1, 0), mech, beamR: [0.5, 0.9], beamH: 6, scale: 0.68 });
}

export const BUILDERS = {
  'cantilever-pavilion': cube,
  'lumen-oval-residence': oval,
  'rotunda-fan-house': rotunda,
  'origami-crown-villa': crown,
  'stone-arcade-house': arcade,
  'granite-plinth-tower': tower
};
export const STAGE_IDS = Object.keys(BUILDERS);
