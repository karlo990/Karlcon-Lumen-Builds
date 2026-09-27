/* KARLCON Studio — motion building blocks shared by the presenters (studio-kit/hosts.js).
   · curves: how a movement accelerates and settles (ease-in, ease-out, minimum-jerk, a controlled
     overshoot, a weighted start), so each body part can move on its own timing curve.
   · Tween: a value moving from a start to a target over a duration, after a delay, on a curve.
   · Spring: a damped spring, for settling after a stop (a little overshoot, then still).
   · Inertializer: the transition between any two poses. When the body switches from one motion to
     another (walk → stand, stand → reach, a turn clip → a walk…), the pose it was actually in, and
     how fast each joint was moving, become the start of the next motion: the difference is carried
     as an offset that decays to zero on a fifth-order curve that starts with the joint's own speed
     and ends with no speed and no acceleration (inertialization: D. Bollo, "Inertialization:
     High-Performance Animation Transitions in Gears of War", GDC 2018). Each body part has its own
     transition time: the head settles first, the hands last (follow-through). It also catches
     any snap it did not hear about: a joint jumping further in one frame than its speed allows. */
import * as THREE from 'three';

const QT = THREE.Quaternion, V3 = THREE.Vector3;
const clamp01 = (t) => Math.max(0, Math.min(1, t));

export const curves = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - (1 - t) ** 3,
  easeInOut: (t) => t * t * t * (t * (6 * t - 15) + 10),                        // minimum jerk (Flash & Hogan)
  weighted: (t) => { const k = t < 0.35 ? (t / 0.35) ** 2 * 0.35 : 0.35 + (1 - (1 - (t - 0.35) / 0.65) ** 3) * 0.65; return k; },   // slow to get going, then carries
  overshoot: (t, k = 0.06) => { const e = t * t * t * (t * (6 * t - 15) + 10); return e + k * Math.sin(Math.PI * t) * Math.max(0, t - 0.5) * 2; },   // passes the target a little, comes back
  settle: (t) => 1 - Math.exp(-5 * t) * Math.cos(4.4 * t) * (1 - t) - 0 * t      // a damped approach
};

export class Tween {
  constructor(from, to, T, { delay = 0, curve = curves.easeInOut } = {}) { Object.assign(this, { from, to, T: Math.max(1e-3, T), delay, curve, t: 0 }); }
  get u() { return clamp01((this.t - this.delay) / this.T); }
  get done() { return this.t >= this.delay + this.T; }
  step(dt) { this.t += dt; return this.value; }
  get value() { return this.from + (this.to - this.from) * this.curve(this.u); }
}

/** damped spring (per frame): x'' = -w²(x - target) - 2ζw x' */
export class Spring {
  constructor(freq = 1.5, damping = 0.55) { this.w = 2 * Math.PI * freq; this.z = damping; this.x = 0; this.v = 0; }
  kick(v) { this.v += v; }
  step(dt, target = 0) { const a = -this.w * this.w * (this.x - target) - 2 * this.z * this.w * this.v; this.v += a * dt; this.x += this.v * dt; return this.x; }
}

/* ---------- inertialization ---------- */
const _q = new QT(), _q2 = new QT(), _ax = new V3();
function toAxisAngle(q, axis) { // q normalised, shortest arc
  if (q.w < 0) { q.x = -q.x; q.y = -q.y; q.z = -q.z; q.w = -q.w; }
  const s = Math.sqrt(Math.max(0, 1 - q.w * q.w)), a = 2 * Math.acos(Math.min(1, q.w));
  if (s < 1e-6) { axis.set(1, 0, 0); return 0; }
  axis.set(q.x / s, q.y / s, q.z / s); return a;
}
/** the fifth-order decay: from x0 with speed v0 (toward 0) to exactly 0 at t1, with zero speed and acceleration */
function plan(x0, v0, t1) {
  if (x0 < 1e-5) return null;
  if (v0 > 0) v0 = 0;                                   // moving away from the target: don't carry that on
  if (v0 < 0) t1 = Math.min(t1, -5 * x0 / v0);
  t1 = Math.max(t1, 1e-3);
  let a0 = (-8 * v0 * t1 - 20 * x0) / (t1 * t1); if (a0 < 0) a0 = 0;
  const A = -(a0 * t1 * t1 + 6 * v0 * t1 + 12 * x0) / (2 * t1 ** 5);
  const B = (3 * a0 * t1 * t1 + 16 * v0 * t1 + 30 * x0) / (2 * t1 ** 4);
  const C = -(3 * a0 * t1 * t1 + 12 * v0 * t1 + 20 * x0) / (2 * t1 ** 3);
  return { x0, v0, a0, A, B, C, t1, t: 0 };
}
const at = (p) => { const t = Math.min(p.t, p.t1); return p.A * t ** 5 + p.B * t ** 4 + p.C * t ** 3 + p.a0 / 2 * t * t + p.v0 * t + p.x0; };

export class Inertializer {
  /** bones: { name: Bone }; times: { name: seconds } (default 0.4) */
  constructor(bones, times = {}, { snapDeg = 5 } = {}) {
    this.items = Object.entries(bones).filter(([, b]) => b).map(([name, bone]) => ({ name, bone, t1: times[name] ?? 0.4, prev: null, prev2: null, off: null, axis: new V3() }));
    this.snap = snapDeg * Math.PI / 180; this.all = false;
    this.pos = { obj: null, prev: null, prev2: null, off: null, dir: new V3(), t1: 0.4 };
  }
  /** carry the next frame's change of pose on every joint (a switch of motion) */
  transition() { this.all = true; }
  /** forget the history (the host was placed somewhere new) */
  reset() { for (const it of this.items) { it.prev = it.prev2 = null; it.off = null; } this.pos.prev = this.pos.prev2 = null; this.pos.off = null; }
  /** also carry the position of an object (the body's offset from its root: hips height, weight shift) */
  trackPosition(obj, t1 = 0.4) { this.pos.obj = obj; this.pos.t1 = t1; }
  /** the tracked object's parent moved by -local (e.g. the root stepped onto a foot): keep what is shown where it was */
  shiftPosition(local) { const P = this.pos; if (P.prev) { P.prev.add(local); P.prev2?.add(local); P.force = true; } }
  /** these joints were set after apply() (e.g. legs re-solved onto planted feet): take them as shown */
  resync(names) { for (const it of this.items) if (names.includes(it.name)) { it.prev?.copy(it.bone.quaternion); it.off = null; } }
  /** call once a frame after the new pose is set: blends it from the pose actually shown */
  apply(dt) {
    for (const it of this.items) {
      const q = it.bone.quaternion;
      if (it.prev) {
        // a snap nobody announced: the joint would move much further than its own speed predicts
        // (checked on what would be shown, so a new snap during a transition is caught too)
        let start = this.all;
        if (!start) {
          _q.copy(it.prev); if (it.prev2) { _q2.copy(it.prev2).invert().premultiply(it.prev); _q.premultiply(_q2); }   // prev · (prev2⁻¹·prev)
          const shown = it.off ? q.clone().premultiply(new QT().setFromAxisAngle(it.axis, at({ ...it.off, t: it.off.t + dt }))) : q;
          start = _q.angleTo(shown) > this.snap;
        }
        if (start) {
          // offset = shown · target⁻¹, and its speed from the last two shown poses
          const off = it.prev.clone().multiply(q.clone().invert()), x0 = toAxisAngle(off, it.axis);
          let v0 = 0;
          if (it.prev2 && dt > 0) { const o2 = it.prev2.clone().multiply(q.clone().invert()), ax2 = new V3(), x1 = toAxisAngle(o2, ax2); v0 = (x0 - x1 * Math.max(0, ax2.dot(it.axis))) / dt; }
          it.off = plan(x0, v0, it.t1);
        }
        if (it.off) {
          it.off.t += dt; const x = at(it.off);
          if (it.off.t >= it.off.t1 || x <= 1e-5) it.off = null;
          else q.premultiply(_q.setFromAxisAngle(it.axis, x));
        }
      }
      it.prev2 = it.prev ? it.prev.clone() : null; it.prev = (it.prev || new QT()).copy(q);
    }
    const P = this.pos;
    if (P.obj) {
      const p = P.obj.position;
      if (P.prev) {
        if (this.all || P.force || (!P.off && P.prev2 && p.distanceTo(P.prev.clone().multiplyScalar(2).sub(P.prev2)) > 0.012)) {
          P.force = false;
          const d = P.prev.clone().sub(p), x0 = d.length(); P.dir.copy(d).normalize();
          const v0 = P.prev2 && dt > 0 ? (x0 - P.prev2.clone().sub(p).dot(P.dir)) / dt : 0;
          P.off = plan(x0, v0, P.t1);
        }
        if (P.off) { P.off.t += dt; const x = at(P.off); if (P.off.t >= P.off.t1) P.off = null; else p.addScaledVector(P.dir, x); }
      }
      P.prev2 = P.prev ? P.prev.clone() : null; P.prev = (P.prev || new V3()).copy(p);
    }
    this.all = false;
  }
}
