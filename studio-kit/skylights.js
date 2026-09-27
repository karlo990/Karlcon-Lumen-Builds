/* KARLCON Studio — Season 3: the Concept Room skylights.
   The seven glazed roof-light types from the reference sheet, each as a full-size mock-up on its kerb:
     ridge-skylight          long ridge with hipped ends, rafters parallel up both slopes
     lean-to-skylight        single slope rising to a high back, glazed triangular cheeks, two top vents
     shed-skylight           glass box: four vertical glazed walls and a monopitch roof with a vent
     pyramid-skylight        square pyramid, parallel rafters meeting the four hips
     gable-ridge-skylight    ridge with vertical glazed gable ends, vents along the ridge
     barrel-vault-skylight   faceted arch on low glazed side walls, glazed ends
     polygon-skylight        twelve-sided low dome: radial rafters, ring bars, a hub at the crown
   How they go together (the build cue, 0–7), after the glazing-bar system on the reference sheets
   (sill base 1000, rafter base 1001, glazing tape, pressure bar 4009, snap cap 4008, perimeter cap 3919):
     0 kerb · 1 sill base · 2 rafters, ridge and hub · 3 glazing tape · 4 glass or multiwall panels
     5 pressure bars, screwed down · 6 snap caps, perimeter and ridge caps · 7 finished (vents work)
   Every part moves into place on its own, one after another, the way a crew would fit it, and a drill
   runs along the pressure bars. The `open` cue opens the vents. `setTint()` changes the glass to one of
   the sheet's tints (Euro Bronze … F-Green) or to twin-wall polycarbonate ('Polycarbonate').
   Presentation models to explain the system, not engineering drawings. */
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

/* ---------- materials ---------- */
const MAT = {
  kerb: new THREE.MeshStandardMaterial({ color: 0xB9B6B0, roughness: 0.92 }),
  alu: new THREE.MeshStandardMaterial({ color: 0xC4C8CD, roughness: 0.28, metalness: 0.9 }),        // silver anodised
  aluDark: new THREE.MeshStandardMaterial({ color: 0x8E949B, roughness: 0.35, metalness: 0.85 }),
  tape: new THREE.MeshStandardMaterial({ color: 0x16171A, roughness: 0.9 }),
  screw: new THREE.MeshStandardMaterial({ color: 0xDADDE0, roughness: 0.3, metalness: 1 }),
  drill: new THREE.MeshStandardMaterial({ color: 0xD0231A, roughness: 0.45 }),
  drillBlack: new THREE.MeshStandardMaterial({ color: 0x1B1C1F, roughness: 0.6 })
};
/* the tints on the glass sheet, as they read on a 6–10 mm pane */
export const TINTS = {
  'Clear': 0xDDEFEA, 'Ultra Clear': 0xF3F7F7, 'Euro Bronze': 0x8C7A69, 'Golden Bronze': 0xB58C5C, 'Black': 0x3B3D40,
  'Euro Grey': 0x8B8E92, 'Dark Grey': 0x595E64, 'Blue Grey': 0x8E9CB0, 'Ford Blue': 0x7FB6E3, 'Dark Blue': 0x2D5FB9,
  'Dark Green': 0x3F8F6A, 'F-Green': 0xA0DCC6
};
let fluteTex = null;
function flutes() {   // twin-wall polycarbonate: the internal ribs show as fine lines along the sheet
  if (fluteTex) return fluteTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 8; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 8); g.fillStyle = '#9fb6c4'; g.fillRect(0, 0, 3, 8); g.fillRect(32, 0, 2, 8);
  fluteTex = new THREE.CanvasTexture(c); fluteTex.wrapS = fluteTex.wrapT = THREE.RepeatWrapping; fluteTex.colorSpace = THREE.SRGBColorSpace;
  return fluteTex;
}
function glassMat() {
  return new THREE.MeshPhysicalMaterial({ color: TINTS.Clear, roughness: 0.06, metalness: 0.05, transparent: true, opacity: 0.38, envMapIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false, clearcoat: 0.35, clearcoatRoughness: 0.08 });
}

/* ---------- geometry ---------- */
function mesh(geo, m) { const o = new THREE.Mesh(geo, m); o.castShadow = true; o.receiveShadow = true; return o; }
/** a profile of width w and depth h running from a to b, its depth along n, lifted `off` along n */
function profile(a, b, n, w, h, m, off = 0) {
  const len = a.distanceTo(b), z = b.clone().sub(a).normalize();
  const y = n.clone().sub(z.clone().multiplyScalar(n.dot(z))).normalize(), x = y.clone().cross(z);
  const o = mesh(new THREE.BoxGeometry(w, h, len), m);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  o.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(y, off);
  o.userData.n = y.clone(); o.userData.axis = z.clone();
  return o;
}
/** flat convex polygon (points in order) as a double-sided panel, UVs in metres along the first edge */
function panelGeo(pts, n) {
  const c = pts.reduce((s, p) => s.add(p), V(0, 0, 0)).multiplyScalar(1 / pts.length);
  const u = pts[1].clone().sub(pts[0]).normalize(), v = n.clone().cross(u);
  const pos = [], uv = [];
  for (let i = 1; i < pts.length - 1; i++) for (const p of [pts[0], pts[i], pts[i + 1]]) {
    pos.push(p.x - c.x, p.y - c.y, p.z - c.z); const d = p.clone().sub(pts[0]); uv.push(d.dot(u) * 6, d.dot(v) * 0.5);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); return { g, c };
}
const key = (a, b) => { const f = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`; const [s, t] = [f(a), f(b)].sort(); return s + '|' + t; };

/* ---------- the model: parts that fly into place ---------- */
function model(id) {
  const G = new THREE.Group(); G.name = id;
  const parts = [], edges = new Set(), screws = [];
  const glass = glassMat();
  const S = { id, G, parts, glass, screws, vents: [], centre: V(0, 0.8, 0), top: V(0, 1.4, 0) };
  /** add a part: `stage` 0–7, `delay` 0–0.65 inside the stage, `from` offset it arrives from */
  S.add = (o, stage, delay = 0, from = V(0, 0.6, 0), spin = 0) => {
    o.userData.stage = stage; o.userData.delay = delay; o.userData.from = from; o.userData.spin = spin;
    o.userData.home = o.position.clone(); o.userData.homeQ = o.quaternion.clone();
    G.add(o); parts.push(o); return o;
  };
  /** a straight member, once per edge (hips and ridges are shared by two faces) */
  S.member = (a, b, n, stage, delay, kind = 'rafter') => {
    if (a.distanceTo(b) < 0.02) return;
    const k = key(a, b) + kind; if (edges.has(k)) return; edges.add(k);
    const lift = n.clone().multiplyScalar(0.7).add(V(0, 0.5, 0));
    if (kind === 'rafter') {                                   // 1001 rafter base under the glass, tape on its flanges
      S.add(profile(a, b, n, 0.04, 0.06, MAT.alu, -0.035), stage, delay, lift, 0.25);
      S.add(profile(a, b, n, 0.036, 0.005, MAT.tape, 0.0), 3, delay, n.clone().multiplyScalar(0.2));
      const pb = S.add(profile(a, b, n, 0.03, 0.01, MAT.aluDark, 0.014), 5, delay, n.clone().multiplyScalar(0.35));
      S.add(profile(a, b, n, 0.042, 0.016, MAT.alu, 0.026), 6, delay, n.clone().multiplyScalar(0.18));
      // screws along the pressure bar, every 300 mm, for the drill to visit
      const len = a.distanceTo(b), m = Math.max(1, Math.floor(len / 0.3));
      for (let i = 0; i < m; i++) { const p = a.clone().lerp(b, (i + 0.5) / m).addScaledVector(pb.userData.n, 0.02); screws.push({ p, n: pb.userData.n.clone(), delay }); }
    } else if (kind === 'sill') {                              // 1000 sill base on the kerb, 3919 perimeter cap over the glass edge
      S.add(profile(a, b, n, 0.06, 0.045, MAT.alu, -0.028), 1, delay, V(0, 0.45, 0).add(n.clone().multiplyScalar(0.3)));
      S.add(profile(a, b, n, 0.065, 0.024, MAT.alu, 0.024), 6, delay, n.clone().multiplyScalar(0.25));
    } else if (kind === 'ridge') {                             // ridge or hub beam, and its cap
      S.add(profile(a, b, n, 0.06, 0.07, MAT.alu, -0.03), 2, delay, V(0, 0.9, 0), 0.15);
      S.add(profile(a, b, n, 0.07, 0.026, MAT.alu, 0.032), 6, delay, V(0, 0.3, 0));
    }
  };
  /** a glazed face: eave e0→e1, rafters every ~`gap` m running `up` the face (a unit vector in its plane)
      until they meet the top line `top` (points, ordered from the e0 end to the e1 end).
      opts.vents: rafter-bay numbers that open (hinged along their top edge) */
  S.face = (e0, e1, up, top, { gap = 0.55, vents = [], eave = 'sill', stage4 = 0 } = {}) => {
    const ex = e1.clone().sub(e0), L = ex.length(); ex.normalize();
    const n = ex.clone().cross(up).normalize(); if (n.dot(e0.clone().add(e1).multiplyScalar(0.5).add(up.clone().multiplyScalar(0.3)).sub(V(0, 0.4, 0))) < 0) n.negate();
    // top line in face coordinates (u along the eave, v up the face)
    const T = top.map((p) => { const d = p.clone().sub(e0); return { u: d.dot(ex), v: d.dot(up), p }; });
    const vAt = (u) => { for (let i = 0; i < T.length - 1; i++) { const a = T[i], b = T[i + 1]; if (u >= Math.min(a.u, b.u) - 1e-6 && u <= Math.max(a.u, b.u) + 1e-6) { const k = Math.abs(b.u - a.u) < 1e-6 ? 0 : (u - a.u) / (b.u - a.u); return a.v + (b.v - a.v) * k; } } return T[T.length - 1].v; };
    const count = Math.max(1, Math.round(L / gap)), P = (u, v) => e0.clone().addScaledVector(ex, u).addScaledVector(up, v);
    const us = []; for (let i = 0; i <= count; i++) us.push(L * i / count);
    if (eave) S.member(e0, e1, n, 1, 0, eave);
    for (let i = 0; i < us.length - 1; i++) S.member(P(us[i], 0), P(us[i], vAt(us[i])), n, 2, i / us.length * 0.6);
    S.member(P(us.at(-1), 0), P(us.at(-1), vAt(us.at(-1))), n, 2, 0.6);
    for (let i = 0; i < T.length - 1; i++) if (T[i].p.distanceTo(T[i + 1].p) > 0.05) S.member(T[i].p, T[i + 1].p, n, 2, 0.3, 'ridge');
    for (let i = 0; i < us.length - 1; i++) {
      const u0 = us[i], u1 = us[i + 1], pts = [P(u0, 0), P(u1, 0), P(u1, vAt(u1))];
      for (const t of [...T].reverse()) if (t.u > u0 + 1e-3 && t.u < u1 - 1e-3) pts.push(t.p.clone());
      pts.push(P(u0, vAt(u0)));
      const clean = pts.filter((p, j) => j === 0 || p.distanceTo(pts[j - 1]) > 1e-3);
      const { g, c } = panelGeo(clean, n), pane = mesh(g, glass); pane.castShadow = false; pane.renderOrder = 2;
      const delay = stage4 + i / us.length * 0.6;
      if (vents.includes(i)) {                                  // an opening sash: its own frame, hinged at the top
        const hi = P(u0, vAt(u0)), hj = P(u1, vAt(u1)), hinge = new THREE.Group(); hinge.position.copy(hi).add(hj).multiplyScalar(0.5);
        pane.position.copy(c).sub(hinge.position); hinge.add(pane);
        for (let j = 0; j < clean.length; j++) { const a = clean[j], b = clean[(j + 1) % clean.length]; const f = profile(a, b, n, 0.035, 0.03, MAT.alu, 0.02); f.position.sub(hinge.position); hinge.add(f); }
        hinge.userData.axis = hj.clone().sub(hi).normalize(); hinge.userData.q0 = hinge.quaternion.clone();
        if (hinge.userData.axis.dot(n.clone().cross(up)) < 0) hinge.userData.axis.negate();
        S.vents.push(hinge); S.add(hinge, 4, delay, n.clone().multiplyScalar(0.9));
      } else { pane.position.copy(c); S.add(pane, 4, delay, n.clone().multiplyScalar(0.9).add(V(0, 0.2, 0))); }
    }
    return n;
  };
  /** the concrete upstand the skylight sits on: a closed outline (points at y=0), `h` high, `t` thick */
  S.kerb = (outline, h, t = 0.14) => {
    const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, -p.z)));
    const m = outline.length, inset = outline.map((p, i) => {          // offset every edge inward by t
      const a = outline[(i + m - 1) % m], b = outline[(i + 1) % m];
      const n1 = V(-(p.z - a.z), 0, p.x - a.x).normalize(), n2 = V(-(b.z - p.z), 0, b.x - p.x).normalize();
      if (n1.dot(V(-p.x, 0, -p.z)) < 0) { n1.negate(); n2.negate(); }
      const bis = n1.clone().add(n2); return p.clone().addScaledVector(bis, t / (1 + n1.dot(n2)));
    });
    const inner = new THREE.Path(inset.map((p) => new THREE.Vector2(p.x, -p.z)).reverse());
    shape.holes.push(inner);
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }); g.rotateX(-Math.PI / 2);
    const o = mesh(g, MAT.kerb); S.add(o, 0, 0, V(0, -h, 0));
    const floor = mesh(new THREE.ShapeGeometry(new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, -p.z)))), new THREE.MeshStandardMaterial({ color: 0xE8E3DA, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.01; S.add(floor, 0, 0.2, V(0, -0.1, 0));
  };
  return S;
}

/* ---------- the drill that screws down the pressure bars (stage 5) ---------- */
function drill() {
  const g = new THREE.Group();
  const body = mesh(new THREE.BoxGeometry(0.06, 0.16, 0.2), MAT.drill); body.position.set(0, 0.12, -0.05); g.add(body);
  const grip = mesh(new THREE.BoxGeometry(0.05, 0.16, 0.06), MAT.drillBlack); grip.position.set(0, 0.2, -0.13); grip.rotation.x = -0.35; g.add(grip);
  const bat = mesh(new THREE.BoxGeometry(0.07, 0.05, 0.11), MAT.drillBlack); bat.position.set(0, 0.29, -0.16); g.add(bat);
  const chuck = mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.05, 12), MAT.drillBlack); chuck.position.set(0, 0.04, 0.03); g.add(chuck);
  const bit = mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), MAT.screw); bit.position.set(0, 0.0, 0.03); g.add(bit);
  g.userData.bit = bit; return g;
}

/* ---------- finish: the interface the studio uses for every building ---------- */
function finish(S, { top, centre, lift = 0 }) {
  const { G, parts, screws, vents, glass } = S;
  G.position.y = lift;
  // screw heads (stage 5), spun in by the drill in order
  const sg = new THREE.CylinderGeometry(0.009, 0.009, 0.006, 10), heads = [];
  screws.forEach((s, i) => { const h = mesh(sg, MAT.screw); h.position.copy(s.p); h.quaternion.setFromUnitVectors(UP, s.n); h.visible = false; G.add(h); heads.push({ h, s, at: s.delay * 0.8 + (i / screws.length) * 0.15 }); });
  heads.sort((a, b) => a.at - b.at);
  const dr = drill(); dr.visible = false; G.add(dr);
  const fb = new THREE.Box3(); for (const o of parts) fb.expandByObject(o);
  const footprint = { size: fb.getSize(V(0, 0, 0)), centre: fb.getCenter(V(0, 0, 0)) };
  const ease = (k) => k * k * k * (k * (6 * k - 15) + 10);
  return {
    id: S.id, group: G, parts, scale: 1, build: 7, open: 0, openTarget: 0, buildTarget: 7, top, centre, footprint,
    hero: null, heroA: 0, useHero: false, tint: 'Clear', setHero() {},
    setBuild(p) { this.buildTarget = p; }, setOpen(o) { this.openTarget = o; },
    /** 'Clear', 'Euro Bronze', … (TINTS) or 'Polycarbonate' */
    setTint(name = 'Clear') {
      this.tint = name;
      if (name === 'Polycarbonate') { glass.color.setHex(0xEAF2F6); glass.map = flutes(); glass.opacity = 0.55; glass.roughness = 0.25; }
      else { glass.color.setHex(TINTS[name] ?? TINTS.Clear); glass.map = null; const dark = new THREE.Color(glass.color).getHSL({}).l < 0.4; glass.opacity = dark ? 0.62 : name === 'Ultra Clear' ? 0.18 : 0.38; glass.roughness = 0.05; }
      glass.needsUpdate = true;
    },
    reset() { this.build = this.buildTarget = 7; this.open = this.openTarget = 0; this.update(0); },
    update(dt) {
      const up = this.buildTarget > this.build;
      this.build += Math.sign(this.buildTarget - this.build) * Math.min(Math.abs(this.buildTarget - this.build), dt * (up ? 0.6 : 3.5));
      this.open += (this.openTarget - this.open) * Math.min(1, dt * 0.9);
      const b = this.build;
      for (const o of parts) {
        const u = o.userData, k = THREE.MathUtils.clamp((b - u.stage - u.delay) / 0.35, 0, 1), e = ease(k);
        o.visible = k > 0.001;
        o.position.copy(u.home).addScaledVector(u.from, 1 - e);
        if (u.spin) o.quaternion.copy(u.homeQ).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), u.spin * (1 - e)));
      }
      // stage 5: the drill visits each screw in turn and the head appears as it is driven
      const s5 = b - 5; let busy = null;
      for (const { h, s, at } of heads) { const k = (s5 - at) / 0.05; h.visible = k > 0; if (k > -1.5 && k < 1 && !busy) busy = { s, k }; }
      dr.visible = !!busy && s5 > 0 && s5 < 1;
      if (busy) {
        dr.position.copy(busy.s.p).addScaledVector(busy.s.n, 0.02 + Math.max(0, -busy.k) * 0.08 + (busy.k > 0 ? 0.03 * busy.k : 0));
        dr.quaternion.setFromUnitVectors(UP, busy.s.n); dr.userData.bit.rotation.y += dt * 40;
      }
      // where the work is: the drill, or the parts on their way in (the detail camera follows it)
      if (busy && dr.visible) this.focus = G.localToWorld(dr.position.clone());
      else {
        const f = V(0, 0, 0); let n = 0;
        for (const o of parts) { const u = o.userData, k = (b - u.stage - u.delay) / 0.35; if (k > 0 && k < 1) { f.add(u.home); n++; } }
        this.focus = n ? G.localToWorld(f.multiplyScalar(1 / n)) : G.localToWorld(top.clone().lerp(centre, 0.4));
      }
      // vents: hinged at the top, opening outward
      const a = (b >= 6.9 ? this.open : 0) * 0.55;
      for (const v of vents) v.quaternion.copy(v.userData.q0).multiply(new THREE.Quaternion().setFromAxisAngle(v.userData.axis, a));
    }
  };
}

/* =================== the seven types =================== */
const H = 0.3;   // kerb height

/* RIDGE: long, hipped ends, rafters parallel up the slopes */
function ridge() {
  const S = model('ridge-skylight'), L = 4.2, W = 1.5, pitch = 26 * Math.PI / 180, rise = W / 2 * Math.tan(pitch);
  const y = H, hx = L / 2 - W / 2;                                   // ridge ends: hips at 45° on plan
  const c = [V(-L / 2, y, W / 2), V(L / 2, y, W / 2), V(L / 2, y, -W / 2), V(-L / 2, y, -W / 2)], r0 = V(-hx, y + rise, 0), r1 = V(hx, y + rise, 0);
  S.kerb(c.map((p) => V(p.x, 0, p.z)), H);
  const slope = (d) => V(0, Math.sin(pitch), -d * Math.cos(pitch)).normalize();
  S.face(c[0], c[1], slope(1), [c[0], r0, r1, c[1]], { gap: 0.28, vents: [5, 9] });
  S.face(c[2], c[3], slope(-1), [c[2], r1, r0, c[3]], { gap: 0.28 });
  const endUp = (d) => V(-d * Math.cos(pitch), Math.sin(pitch), 0).normalize();
  S.face(c[1], c[2], endUp(1), [c[1], r1, c[2]], { gap: 0.28 });
  S.face(c[3], c[0], endUp(-1), [c[3], r0, c[0]], { gap: 0.28 });
  return finish(S, { top: V(0, y + rise, 0), centre: V(0, 0.7, 0) });
}

/* LEAN-TO: one slope up to a high back, glazed triangular cheeks, two vents at the top */
function leanTo() {
  const S = model('lean-to-skylight'), Wd = 2.4, D = 1.7, hb = 0.95, y = H;
  const f0 = V(-Wd / 2, y, D / 2), f1 = V(Wd / 2, y, D / 2), b0 = V(-Wd / 2, y + hb, -D / 2), b1 = V(Wd / 2, y + hb, -D / 2);
  S.kerb([V(-Wd / 2, 0, D / 2), V(Wd / 2, 0, D / 2), V(Wd / 2, 0, -D / 2), V(-Wd / 2, 0, -D / 2)], H);
  const up = b0.clone().sub(f0).normalize();
  S.face(f0, f1, up, [b0, b1], { gap: 0.4, vents: [1, 4] });
  // the back: a solid upstand to the high edge (the wall it leans on)
  const back = mesh(new THREE.BoxGeometry(Wd, hb, 0.12), MAT.kerb); back.position.set(0, y + hb / 2, -D / 2 - 0.06); S.add(back, 0, 0.3, V(0, -hb, 0));
  const side = (x, dir) => S.face(V(x, y, dir > 0 ? D / 2 : -D / 2), V(x, y, dir > 0 ? -D / 2 : D / 2), UP, dir > 0 ? [V(x, y, D / 2), V(x, y + hb, -D / 2)] : [V(x, y + hb, -D / 2), V(x, y, D / 2)], { gap: 0.42, eave: 'sill', stage4: 0.2 });
  side(Wd / 2, 1); side(-Wd / 2, -1);
  return finish(S, { top: V(0, y + hb, -0.4), centre: V(0, 0.7, 0) });
}

/* SHED: glass walls all round, a monopitch roof falling to the front, a vent in the roof */
function shed() {
  const S = model('shed-skylight'), Wd = 1.9, D = 1.5, hf = 1.25, hb = 1.65, y = H;
  const p = (x, z, h) => V(x, y + h, z);
  S.kerb([V(-Wd / 2, 0, D / 2), V(Wd / 2, 0, D / 2), V(Wd / 2, 0, -D / 2), V(-Wd / 2, 0, -D / 2)], H);
  // walls
  S.face(p(-Wd / 2, D / 2, 0), p(Wd / 2, D / 2, 0), UP, [p(-Wd / 2, D / 2, hf), p(Wd / 2, D / 2, hf)], { gap: 0.48 });
  S.face(p(Wd / 2, -D / 2, 0), p(-Wd / 2, -D / 2, 0), UP, [p(Wd / 2, -D / 2, hb), p(-Wd / 2, -D / 2, hb)], { gap: 0.48 });
  S.face(p(Wd / 2, D / 2, 0), p(Wd / 2, -D / 2, 0), UP, [p(Wd / 2, D / 2, hf), p(Wd / 2, -D / 2, hb)], { gap: 0.5, stage4: 0.1 });
  S.face(p(-Wd / 2, -D / 2, 0), p(-Wd / 2, D / 2, 0), UP, [p(-Wd / 2, -D / 2, hb), p(-Wd / 2, D / 2, hf)], { gap: 0.5, stage4: 0.1 });
  // roof
  const e0 = p(-Wd / 2, D / 2, hf), e1 = p(Wd / 2, D / 2, hf), up = p(-Wd / 2, -D / 2, hb).sub(e0).normalize();
  S.face(e0, e1, up, [p(-Wd / 2, -D / 2, hb), p(Wd / 2, -D / 2, hb)], { gap: 0.48, vents: [2], eave: 'ridge', stage4: 0.2 });
  return finish(S, { top: p(0, 0, hb), centre: V(0, 1.1, 0) });
}

/* PYRAMID: square base, parallel rafters on each face meeting the hips */
function pyramid() {
  const S = model('pyramid-skylight'), A = 2.3, rise = 0.95, y = H, apex = V(0, y + rise, 0);
  const c = [V(-A / 2, y, A / 2), V(A / 2, y, A / 2), V(A / 2, y, -A / 2), V(-A / 2, y, -A / 2)];
  S.kerb(c.map((p) => V(p.x, 0, p.z)), H);
  for (let i = 0; i < 4; i++) {
    const a = c[i], b = c[(i + 1) % 4], mid = a.clone().add(b).multiplyScalar(0.5), up = apex.clone().sub(mid).normalize();
    S.face(a, b, up, [a, apex, b], { gap: 0.29, vents: i === 0 ? [3, 4] : [], stage4: i * 0.08 });
  }
  return finish(S, { top: apex.clone(), centre: V(0, 0.8, 0) });
}

/* RIDGE WITH GABLE ENDS: two slopes to a full-length ridge, vertical glazed gables */
function gableRidge() {
  const S = model('gable-ridge-skylight'), L = 3.3, W = 1.9, rise = 0.9, y = H;
  const c = [V(-L / 2, y, W / 2), V(L / 2, y, W / 2), V(L / 2, y, -W / 2), V(-L / 2, y, -W / 2)], r0 = V(-L / 2, y + rise, 0), r1 = V(L / 2, y + rise, 0);
  S.kerb(c.map((p) => V(p.x, 0, p.z)), H);
  S.face(c[0], c[1], r0.clone().sub(c[0]).normalize(), [r0, r1], { gap: 0.36, vents: [2, 6] });
  S.face(c[2], c[3], r1.clone().sub(c[2]).normalize(), [r1, r0], { gap: 0.36 });
  S.face(c[1], c[2], UP, [c[1], r1, c[2]], { gap: 0.32, stage4: 0.15 });
  S.face(c[3], c[0], UP, [c[3], r0, c[0]], { gap: 0.32, stage4: 0.15 });
  return finish(S, { top: V(0, y + rise, 0), centre: V(0, 0.8, 0) });
}

/* BARREL VAULT: low glazed side walls, a faceted arch over them, glazed ends */
function barrel() {
  const S = model('barrel-vault-skylight'), L = 3.2, W = 1.8, wall = 0.45, R = W / 2, n = 6, y = H;
  S.kerb([V(-L / 2, 0, R), V(L / 2, 0, R), V(L / 2, 0, -R), V(-L / 2, 0, -R)], H);
  const arch = []; for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; arch.push(V(0, y + wall + Math.sin(a) * R * 0.95, Math.cos(a) * R)); }
  const at = (x, p) => V(x, p.y, p.z);
  // side walls
  S.face(V(-L / 2, y, R), V(L / 2, y, R), UP, [V(-L / 2, y + wall, R), V(L / 2, y + wall, R)], { gap: 0.4 });
  S.face(V(L / 2, y, -R), V(-L / 2, y, -R), UP, [V(L / 2, y + wall, -R), V(-L / 2, y + wall, -R)], { gap: 0.4 });
  // arch facets along the length
  for (let i = 0; i < n; i++) {
    const a = arch[i], b = arch[i + 1], up = b.clone().sub(a).normalize();
    S.face(at(-L / 2, a), at(L / 2, a), up, [at(-L / 2, b), at(L / 2, b)], { gap: 0.4, eave: i === 0 ? 'ridge' : null, vents: i === 2 ? [2, 5] : [], stage4: 0.05 * i });
  }
  // ends: a vertical wall to the springing, then a fan of triangles under the arch
  for (const x of [-L / 2, L / 2]) {
    const s = x < 0 ? -1 : 1;
    S.face(V(x, y, s * R), V(x, y, -s * R), UP, [V(x, y + wall, s * R), V(x, y + wall, -s * R)], { gap: 0.45, stage4: 0.3 });
    const hub = V(x, y + wall, 0);
    for (let i = 0; i < n; i++) {                                      // each triangle: arch chord a–b, point at the hub
      const a = at(x, arch[s > 0 ? i : n - i]), b = at(x, arch[s > 0 ? i + 1 : n - i - 1]);
      S.face(a, b, hub.clone().sub(a.clone().add(b).multiplyScalar(0.5)).normalize(), [a, hub, b], { gap: 5, eave: null, stage4: 0.35 });
    }
  }
  return finish(S, { top: V(0, y + wall + R, 0), centre: V(0, 0.9, 0) });
}

/* POLYGON: twelve sides, radial rafters to a hub, a ring bar half way up */
function polygon() {
  const S = model('polygon-skylight'), N = 12, R = 1.45, rise = 0.55, y = H, hub = V(0, y + rise, 0), rr = 0.12;
  const rim = []; for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2 + Math.PI / N; rim.push(V(Math.cos(a) * R, y, Math.sin(a) * R)); }
  S.kerb(rim.map((p) => V(p.x, 0, p.z)), H);
  const ring = (k) => rim.map((p) => p.clone().lerp(hub, k));
  const mid = ring(0.5), crown = ring(1 - rr / R);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, a = rim[i], b = rim[j];
    const m = a.clone().add(b).multiplyScalar(0.5), up = mid[i].clone().add(mid[j]).multiplyScalar(0.5).sub(m).normalize();
    S.face(a, b, up, [mid[i], mid[j]], { gap: 5, vents: i % 4 === 0 ? [0] : [], stage4: i * 0.03 });                 // lower ring of panels
    const m2 = mid[i].clone().add(mid[j]).multiplyScalar(0.5), up2 = crown[i].clone().add(crown[j]).multiplyScalar(0.5).sub(m2).normalize();
    S.face(mid[i], mid[j], up2, [crown[i], crown[j]], { gap: 5, eave: 'ridge', stage4: 0.3 + i * 0.02 });           // upper ring
  }
  const cap = mesh(new THREE.CylinderGeometry(rr * 1.2, rr * 1.3, 0.08, N), MAT.alu); cap.position.copy(hub); S.add(cap, 2, 0.6, V(0, 0.8, 0));
  const knob = mesh(new THREE.SphereGeometry(0.05, 12, 8), MAT.alu); knob.position.copy(hub).add(V(0, 0.07, 0)); S.add(knob, 6, 0.5, V(0, 0.3, 0));
  return finish(S, { top: hub.clone(), centre: V(0, 0.6, 0) });
}

export const BUILDERS_S3 = {
  'ridge-skylight': ridge,
  'lean-to-skylight': leanTo,
  'shed-skylight': shed,
  'pyramid-skylight': pyramid,
  'gable-ridge-skylight': gableRidge,
  'barrel-vault-skylight': barrel,
  'polygon-skylight': polygon
};
