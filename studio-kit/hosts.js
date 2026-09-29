/* KARLCON Studio — animated presenters.
   Drives any Mixamo / Ready-Player-Me style GLB avatar (Avaturn, AvatarSDK MetaPerson,
   MPFB/MakeHuman exported for TalkingHead) that has:
     bones  Hips, Spine, Spine1, Spine2, Neck, Head, LeftEye/RightEye, Left/Right Arm/ForeArm/Hand, UpLeg/Leg/Foot/ToeBase
     morphs viseme_* (Oculus), eyeBlinkLeft/Right, jawOpen, mouthSmile*, browInnerUp (optional)
   Everything is solved in world space (two-bone IK, look-at, hand alignment), so it does not
   depend on each rig's local bone axes — a new avatar can be dropped in without re-tuning.

   What makes the motion read as human rather than procedural (see docs/STUDIO-ARCHITECTURE.md):
   · Gaze: the eyes jump first (saccades of 30–100 ms), the head follows in 0.3–0.6 s, the chair
     swivel helps with far targets, and the neck stays inside its comfortable range
     (eye–head coordination: Freedman & Sparks 1997; Lee & Terzopoulos, UCLA, SIGGRAPH 2006).
   · Joints stay inside the normal adult range of motion (AAOS): neck, forearm rotation, wrist.
   · Arms move along minimum-jerk paths (Flash & Hogan, MIT, 1985): bell-shaped speed.
   · Gestures are timed to the words (Kendon 1980; McNeill 1992; rules in the spirit of MIT's
     BEAT, Cassell et al. 2001): prepared ahead, the stroke lands on the stressed word, held,
     then retracted — and chosen by what is said (numbers → counting, "but" → contrast…).
   · Fingers bend at three coupled joints in the resting cascade, not with one curl.
   · Face: FACS action units (Ekman & Friesen) — Duchenne smiles (AU6 + AU12), brow flashes on
     emphasis, blinks with real lid timing, more of them at pauses and gaze shifts.
   · Standing hosts (`stand: true`, the season 3 Concept Room) walk, turn and reach with full-body
     motion capture (Mixamo): the clip moves the body and the host is carried by the clip's own root
     motion, so the feet don't slide; gaze, face and lip-sync stay procedural on top. */
import * as THREE from 'three';
import { LipsyncEn } from './lipsync-en.mjs';
import { curves, Spring, Inertializer } from './motion.js';
import { BodySystem } from './body.js';
import { PROPS } from './props.js';

const V3 = THREE.Vector3, QT = THREE.Quaternion;
const X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1);
const DEG = Math.PI / 180;
const lipsync = new LipsyncEn();

/* ---------- small maths helpers ---------- */
const _qa = new QT(), _qb = new QT(), _qc = new QT();
const _vc = new V3(), _vd = new V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/* smooth pseudo-random signal in [-1,1] */
function wave(t, seed) {
  return (Math.sin(t * 0.63 + seed * 1.7) * 0.5 + Math.sin(t * 1.37 + seed * 3.1) * 0.3 + Math.sin(t * 2.71 + seed * 5.3) * 0.2);
}
/* joint end stop: passes the value through, then eases into the limit instead of hitting it */
function soft(x, lo, hi, k = 0.1) {
  k = Math.min(k, (hi - lo) / 3);
  if (x > hi - k) return hi - k * Math.exp(-(x - hi + k) / k);
  if (x < lo + k) return lo + k * Math.exp((x - lo - k) / k);
  return x;
}
/* direction from yaw (to the host's left) and pitch (up), and back */
const dirOf = (yaw, pitch) => new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
const yawPitch = (v) => ({ y: Math.atan2(v.x, v.z), p: Math.atan2(v.y, Math.hypot(v.x, v.z)) });
/* critically damped spring towards a target (per-component) */
function springV(cur, vel, target, dt, freq) {
  const w = 2 * Math.PI * freq, f = 1 + 2 * dt * w, dd = w * w, hd = dt * dd, hdd = dt * hd, det = 1 / (f + hdd);
  for (const k of ['x', 'y', 'z']) {
    const x = cur[k], v = vel[k];
    const nx = (f * x + dt * v + hdd * target[k]) * det;
    vel[k] = (v + hd * (target[k] - x)) * det;
    cur[k] = nx;
  }
}

/* Minimum-jerk movement (Flash & Hogan 1985): the path people's hands and heads follow between two
   points — speed rises and falls in a bell, no floaty ease-out. Re-planned from the current position,
   speed and acceleration whenever the goal changes, so movements chain without a jolt. */
class MinJerk {
  constructor(v) { this.p = v.clone(); this.v = new V3(); this.a = new V3(); this.goal = v.clone(); this.c = null; this.t = 0; this.T = 0; }
  get busy() { return !!this.c; }
  reset(v) { this.p.copy(v); this.goal.copy(v); this.v.set(0, 0, 0); this.a.set(0, 0, 0); this.c = null; }
  to(goal, T) {
    this.goal.copy(goal); this.T = Math.max(0.06, T); this.t = 0;
    const d = goal.clone().sub(this.p), vT = this.v.clone().multiplyScalar(this.T), aT = this.a.clone().multiplyScalar(this.T * this.T);
    this.c = [this.p.clone(), vT.clone(), aT.clone().multiplyScalar(0.5),
      d.clone().multiplyScalar(10).addScaledVector(vT, -6).addScaledVector(aT, -1.5),
      d.clone().multiplyScalar(-15).addScaledVector(vT, 8).addScaledVector(aT, 1.5),
      d.clone().multiplyScalar(6).addScaledVector(vT, -3).addScaledVector(aT, -0.5)];
  }
  update(dt) {
    if (!this.c) return this.p;
    this.t = Math.min(this.T, this.t + dt);
    const u = this.t / this.T, T = this.T, c = this.c;
    this.p.set(0, 0, 0); this.v.set(0, 0, 0); this.a.set(0, 0, 0);
    for (let i = 0; i < 6; i++) this.p.addScaledVector(c[i], u ** i);
    for (let i = 1; i < 6; i++) this.v.addScaledVector(c[i], i * u ** (i - 1) / T);
    for (let i = 2; i < 6; i++) this.a.addScaledVector(c[i], i * (i - 1) * u ** (i - 2) / (T * T));
    if (this.t >= this.T) this.reset(this.goal);
    return this.p;
  }
  /* follow a slowly moving goal (smooth pursuit) when no movement is planned */
  follow(goal, dt, rate) {
    const np = this.p.clone().lerp(goal, 1 - Math.exp(-dt * rate));
    this.v.copy(np).sub(this.p).divideScalar(Math.max(dt, 1e-4)); this.a.set(0, 0, 0);
    this.p.copy(np); this.goal.copy(goal);
  }
  /* track a target that moves along its own smooth path (the drink) */
  chase(goal, dt, freq) { springV(this.p, this.v, goal, dt, freq); this.a.set(0, 0, 0); this.goal.copy(goal); this.c = null; }
}

/* Rotate a bone by a WORLD-space quaternion around its own pivot. */
function rotateWorld(bone, qW) {
  bone.parent.getWorldQuaternion(_qa);
  _qb.copy(_qa).invert().multiply(qW).multiply(_qa);
  bone.quaternion.premultiply(_qb);
}
function worldPos(o, out) { return o.getWorldPosition(out); }
/* Rotate `bone` so the direction bone→child points along dirW. */
function aim(bone, child, dirW, weight = 1) {
  worldPos(bone, _vc); worldPos(child, _vd);
  _vd.sub(_vc).normalize();
  const q = new QT().setFromUnitVectors(_vd, dirW);
  if (weight < 1) q.slerp(new QT(), 1 - weight);
  rotateWorld(bone, q);
}
function signedAngle(a, b, axis) {
  const pa = a.clone().projectOnPlane(axis).normalize(), pb = b.clone().projectOnPlane(axis).normalize();
  return Math.atan2(pa.clone().cross(pb).dot(axis), pa.dot(pb));
}

/* ---------- body limits ----------
   Normal adult range of motion (AAOS; Norkin & White, "Measurement of Joint Motion"), kept inside
   the part people actually use while talking at a desk. */
const LIM = {
  neckYaw: 55 * DEG, neckUp: 15 * DEG, neckDown: 28 * DEG, neckRoll: 8 * DEG,   // normal: rotation 80°, extension 60°, flexion 50°, side bend 45°
  eyeYaw: 28 * DEG, eyeUp: 18 * DEG, eyeDown: 25 * DEG,                       // where the head starts to take over
  pron: 78 * DEG, sup: 72 * DEG,                                              // forearm rotation from thumb-up: 80° / 80°
  wFlex: 45 * DEG, wExt: 40 * DEG, wRad: 12 * DEG, wUln: 22 * DEG,            // wrist: 80° / 70° / 20° / 30°
  swivel: 0.42,                                                               // chair + trunk turn toward a far target (rad)
  reach: 92 * DEG                                                             // beyond this, a glance over the shoulder, not a stare
};

/* ---------- hand shapes ----------
   Per finger (index → little): knuckle (MCP) and middle joint (PIP) flexion in radians; the end joint
   follows the middle one at about 2/3 (tendon coupling; Rijpkema & Girard, SIGGRAPH 1991). The
   knuckle always carries a good share of the bend: bending only the outer joints is the "claw" look.
   `th`: thumb base (toward the palm), thumb middle and tip (across the palm). */
const HANDS = {
  desk:    { mcp: [.20, .26, .32, .38], pip: [.26, .32, .38, .44], spread: .04, th: [.15, .12, .12] },
  relaxed: { mcp: [.32, .40, .48, .56], pip: [.34, .42, .50, .58], spread: .06, th: [.25, .18, .18] },
  loose:   { mcp: [.26, .34, .42, .50], pip: [.28, .36, .44, .52], spread: .07, th: [.2, .14, .16] },
  open:    { mcp: [.06, .08, .12, .16], pip: [.10, .12, .16, .20], spread: .15, th: [.05, .06, .06] },
  point:   { mcp: [.06, 1.20, 1.30, 1.35], pip: [.08, 1.40, 1.45, 1.45], spread: .02, th: [.55, .45, .40] },
  ring:    { mcp: [.70, .30, .40, .50], pip: [.80, .34, .44, .54], spread: .10, th: [.65, .35, .45] },
  grip:    { mcp: [1.0, 1.1, 1.15, 1.2], pip: [.95, 1.05, 1.1, 1.15], spread: .02, th: [.7, .4, .4] }
};
function handShape(name) {
  const m = /^count(\d)$/.exec(name);
  if (!m) return HANDS[name] || HANDS.relaxed;
  const n = +m[1], up = (i) => i < Math.min(n, 4);
  return { mcp: [0, 1, 2, 3].map(i => up(i) ? .06 + i * .03 : 1.2 + i * .05), pip: [0, 1, 2, 3].map(i => up(i) ? .1 + i * .03 : 1.4),
    spread: .12, th: n >= 5 ? [.05, .06, .06] : [.6, .45, .4] };
}
const shapeVec = (s) => [...s.mcp, ...s.pip, s.spread, ...s.th];

/* ---------- what a word asks the hands to do (BEAT-style rules) ---------- */
const NUMW = { one: 1, first: 1, two: 2, second: 2, both: 2, twice: 2, three: 3, third: 3, four: 4, fourth: 4, five: 5, fifth: 5 };
function gestureFor(raw) {
  const w = raw.toLowerCase().replace(/[^a-z0-9']/g, '');
  if (NUMW[w]) return { kind: 'count', n: NUMW[w] };
  if (/^[1-5]$/.test(w)) return { kind: 'count', n: +w };
  if (/^(but|however|although|though|instead|whereas|except|unless|otherwise)$/.test(w)) return { kind: 'contrast' };
  if (/^(this|these|here|look|see|imagine|picture)$/.test(w)) return { kind: 'present' };
  if (/^(all|every|whole|entire|big|bigger|huge|large|wide|everything|everyone|everybody|around|across|full)$/.test(w)) return { kind: 'wide' };
  if (/^(small|little|tiny|exact|exactly|precise|precisely|detail|details|careful|carefully|millimetre|millimetres|mm|thin)$/.test(w)) return { kind: 'ring' };
  if (/^(you|your|yours)$/.test(w) || /\?$/.test(raw)) return { kind: 'offer' };
  return null;
}

/* ---------- viseme shaping ---------- */
const VIS_GAIN = { aa: .72, E: .55, I: .5, O: .7, U: .62, PP: .9, FF: .75, TH: .55, DD: .5, kk: .5, CH: .6, SS: .5, nn: .45, RR: .5, sil: 0 };
const VIS_JAW = { aa: .16, E: .1, I: .06, O: .13, U: .07, CH: .04, SS: .02, DD: .05, kk: .06, nn: .04, RR: .05, TH: .05, FF: 0, PP: 0 };
const VIS_LEAD = 0.03;   // the mouth shape leads the sound slightly (and makes up for the morph smoothing)

export class Host {
  /**
   * @param {object} o
   * @param {string} o.id        'luma' | 'karl'
   * @param {string} o.name      Display name
   * @param {THREE.Object3D} o.model  loaded gltf.scene
   * @param {number} o.seatY     top of the chair seat (m)
   * @param {number} o.deskY     top of the desk (m)
   * @param {number} o.deskZ     distance from hips to where the wrists rest (m, forward)
   * @param {number} o.expressive  gesture amplitude and rate (1 = default)
   * @param {boolean} o.stand    standing presenter (no chair or desk): feet on the floor, hands at the waist
   * @param {number} o.foldHabit  standing, listening: how likely the arms fold across the chest (0 never … 1)
   */
  constructor(o) {
    Object.assign(this, { mouthGain: o.mouthGain ?? 0.85, id: o.id, name: o.name, seatY: o.seatY ?? 0.47, deskY: o.deskY ?? 0.75, deskZ: o.deskZ ?? 0.42, seed: o.seed ?? Math.random() * 10, expressive: o.expressive ?? 1, standing: !!o.stand });
    this.root = new THREE.Group(); this.root.name = 'host-' + o.id;
    this.model = o.model; this.root.add(this.model);
    this.bones = {}; this.morphs = {};
    this.model.traverse((n) => {
      if (n.isBone) this.bones[n.name] = n;
      if (n.isMesh) {
        n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false;
        if (n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach(m => { if (m.map) m.map.anisotropy = 4; m.envMapIntensity = 0.9; }); }
        if (n.morphTargetDictionary) for (const [k, i] of Object.entries(n.morphTargetDictionary)) (this.morphs[k] ||= []).push([n, i]);
      }
    });
    const need = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot'];
    const missing = need.filter(n => !this.bones[n]);
    if (missing.length) throw new Error(`Avatar "${o.id}" is missing bones: ${missing.join(', ')}`);
    this._measure();
    if (this.standing) { this.deskY = this.hipRestY + 0.03; this.deskZ = 0.2; }   // standing: the hands' home is in front of the navel
    this.body = {}; this.acts = []; this.act = null; this.bodyW = 0; this._look = null; this.present = null;
    this.walkRate = o.walkRate ?? 0.8; this.settle = new Spring(1.3, 0.5);
    // the trunk takes part in speech as one system (body.js); seated, the chair takes some of it
    this.bodySys = new BodySystem(this.seed, this.expressive * (this.standing ? 1 : 0.6));
    this.bodySys.onShift = () => { if (this.standing && !this.act) this.state.nextStance = this.state.t; };
    this.props = {}; this.foldHabit = o.foldHabit ?? 0;
    // every change of motion starts from the pose shown; each part has its own settling time
    // (head first, hands last: the follow-through)
    // (the hands are left out: they move on their own minimum-jerk paths inside the wrist's limits)
    const IB = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
    const IT = { Head: 0.3, Neck: 0.32, Spine2: 0.38, Spine1: 0.42, Spine: 0.44, Hips: 0.46, LeftShoulder: 0.42, RightShoulder: 0.42, LeftArm: 0.46, RightArm: 0.46, LeftForeArm: 0.52, RightForeArm: 0.52, LeftHand: 0.6, RightHand: 0.6, LeftUpLeg: 0.34, RightUpLeg: 0.34, LeftLeg: 0.32, RightLeg: 0.32, LeftFoot: 0.3, RightFoot: 0.3, LeftToeBase: 0.3, RightToeBase: 0.3 };
    this.inert = new Inertializer(Object.fromEntries(IB.map((k) => [k, this.bones[k]])), IT, { snapDeg: this.standing ? 5 : 8 });
    this.inert.trackPosition(this.model, 0.45);
    this.state = {
      t: 0, speaking: false, lookAt: new V3(0, 1.2, 3),
      gaze: { eye: new MinJerk(new V3()), head: new MinJerk(new V3()), init: false, headAt: -1, headT: 0.4, dist: 2, off: new V3(), offCur: new V3(), nextOff: 0, avert: null, goalY: 0, farSince: -1, farDwell: 2.2, backUntil: 0 },
      eyePitch: 0, blink: 0, blinkT: -1, blinkAt: -1, blinkAmp: 1, nextBlink: 1 + Math.random() * 3,
      nod: 0, nodV: 0, lean: 0, leanV: 0, smile: 0.12, brow: 0, flash: 0, flashV: 0, energy: 0,
      hands: {}, fing: {}, gesture: null, gestureEnd: 0, restShift: { Left: new V3(), Right: new V3() }, restKey: 0, nextRestShift: 8 + Math.random() * 6,
      // body language
      turn: 0, turnV: 0, leanBoost: 0, shift: 0, shiftTarget: 0, nextShift: 3 + Math.random() * 6,
      // face: mood + short reactions that decay
      mood: 'neutral', react: { smile: 0, brows: 0, surprise: 0, press: 0 }, micro: { k: null, v: 0, until: 0 }, nextMicro: 2,
      drinkTilt: 0,
      // standing: which leg carries the weight (-1 right … 1 left), changing now and then
      stance: 0, stanceV: 0, stanceTo: 0, nextStance: 3 + Math.random() * 5,
      // arms folded across the chest (standing, listening), and glances down at a tablet held
      fold: false, foldCue: null, foldW: 0, nextFold: 5 + Math.random() * 5, lastTalk: -10, nextTabletLook: 4 + Math.random() * 4, tabletLookUntil: 0
    };
    for (const s of ['Left', 'Right']) {
      const rest = this._pose('rest', '', s);
      this.state.hands[s] = { p: new MinJerk(rest.pos), n: new MinJerk(rest.nrm), f: new MinJerk(rest.fwd), key: 'rest0', shape: 'desk' };
      const v = shapeVec(HANDS.desk); this.state.fing[s] = { x: v, v: v.map(() => 0) };
    }
    this.visemes = []; this.words = []; this.onWord = null; this.cues = null;
  }

  /* measure the rig in its bind pose (root at origin, unrotated) */
  _measure() {
    const b = this.bones;
    this.root.updateMatrixWorld(true);
    this.rest = {};
    for (const [k, bone] of Object.entries(b)) this.rest[k] = bone.quaternion.clone();
    this.restWorldQ = {};
    for (const k of ['Spine2', 'Head', 'Neck', 'LeftEye', 'RightEye']) if (b[k]) this.restWorldQ[k] = b[k].getWorldQuaternion(new QT());
    const p = (n) => b[n].getWorldPosition(new V3());
    this.len = {};
    for (const s of ['Left', 'Right']) {
      this.len[s + 'Arm'] = p(s + 'Arm').distanceTo(p(s + 'ForeArm'));
      this.len[s + 'ForeArm'] = p(s + 'ForeArm').distanceTo(p(s + 'Hand'));
      this.len[s + 'UpLeg'] = p(s + 'UpLeg').distanceTo(p(s + 'Leg'));
      this.len[s + 'Leg'] = p(s + 'Leg').distanceTo(p(s + 'Foot'));
    }
    this.hipRestY = p('Hips').y;
    this.ankleY = Math.max(0.06, Math.min(p('LeftFoot').y, 0.14));
    this.hipWidth = p('LeftUpLeg').distanceTo(p('RightUpLeg'));
    this.shoulderWidth = p('LeftArm').distanceTo(p('RightArm'));
    this.eyeY = b.LeftEye ? p('LeftEye').y : p('Head').y + 0.08;
    // sit: drop the whole model so the pelvis lands on the seat; stand: feet on the floor, knees soft
    this.baseY = this.standing ? -0.012 : (this.seatY + 0.085) - this.hipRestY;
    this.model.position.y = this.baseY;
  }

  /* resting wrist target on the desk, root space */
  handRest(side) {
    const sg = side === 'Left' ? 1 : -1;
    if (this.standing) return {                                    // hands loosely together in front, palms in
      pos: new V3(sg * (this.shoulderWidth * 0.2), this.deskY - 0.04, this.deskZ),
      nrm: new V3(-sg * 0.85, -0.45, 0.12).normalize(),
      fwd: new V3(-sg * 0.45, -0.45, 1).normalize()
    };
    return {
      pos: new V3(sg * (this.shoulderWidth * 0.62), this.deskY + 0.045, this.deskZ),
      nrm: new V3(-sg * 0.31, -0.95, 0).normalize(),           // palm down, thumb side a little higher (forearm ~70° pronated)
      fwd: new V3(-sg * 0.25, -0.08, 1).normalize()             // fingers forward, turned in
    };
  }

  /* ---------- speech ---------- */
  /** Build a viseme timeline for `text` and start it at `startTime` (seconds, performance clock). */
  prepareSpeech(text, rate = 1) {
    const unit = 0.078 / rate;           // seconds per viseme unit
    const tokens = []; const re = /\S+/g; let m;
    while ((m = re.exec(text))) tokens.push({ raw: m[0], idx: m.index });
    let t = 0; const words = [];
    for (const tk of tokens) {
      const clean = lipsync.preProcessText(tk.raw.replace(/[^\w'\-.,!?%×]/g, ' ')).replace(/[.,!?]/g, ' ');
      const vis = [];
      let wt = 0;
      for (const part of clean.split(/\s+/).filter(Boolean)) {
        const o = lipsync.wordsToVisemes(part);
        o.visemes.forEach((v, i) => vis.push({ v, s: wt + o.times[i] * unit, d: o.durations[i] * unit }));
        const last = o.times.length ? o.times[o.times.length - 1] + o.durations[o.durations.length - 1] : 1;
        wt += last * unit + 0.035;
      }
      const dur = Math.max(wt, 0.12);
      const punct = /[.!?]$/.test(tk.raw) ? 0.34 : /[,;:—–]$/.test(tk.raw) ? 0.2 : 0.05;
      words.push({ ...tk, s: t, d: dur, vis, stress: /[A-Z]{2,}|!|\d/.test(tk.raw) || tk.raw.length > 7 });
      t += dur + punct;
    }
    return { words, total: t };
  }
  startSpeech(plan, now) {
    if (this.drinking) this._endDrink();
    this.plan = plan; this.planStart = now; this.state.speaking = true;
    this.words = plan.words; this.wordIdx = -1;
    this.cues = this._planCues(plan.words);
    // speakers often look away to plan a long turn, then back to the listener (Kendon 1967; Argyle & Cook 1976)
    const G = this.state.gaze;
    G.avert = plan.words.length > 10 && Math.random() < 0.5
      ? { until: this.state.t + 0.6 + Math.random() * 0.7, y: (Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 6) * DEG, p: -(3 + Math.random() * 5) * DEG } : null;
  }
  /* align the timeline to a browser boundary event (charIndex in the utterance text) */
  syncToChar(charIndex, now) {
    if (!this.plan) return;
    const i = this.words.findIndex(w => w.idx >= charIndex);
    if (i < 0) return;
    const planned = this.planStart + this.words[i].s;
    const drift = now - planned;
    if (Math.abs(drift) > 0.04) this.planStart += drift * 0.85;
  }
  stopSpeech() { this.plan = null; this.state.speaking = false; this.cues = null; }
  get speaking() { return this.state.speaking; }

  /* ---------- performance cues ---------- */
  look(target) { this.state.lookAt.copy(target); }
  nod(amount = 1) { this.state.nodV += 2.2 * amount; }
  setSmile(v) { this.state.smile = v; }
  setMood(m) { this.state.mood = m || 'neutral'; }
  /** short facial/body reactions: 'nod' | 'smile' | 'brows' | 'surprise' | 'think' */
  react(kind, amt = 1) {
    const R = this.state.react;
    if (kind === 'nod') this.nod(0.5 * amt);
    else if (kind === 'smile') R.smile = Math.min(1, R.smile + 0.45 * amt);
    else if (kind === 'brows') R.brows = Math.min(1, R.brows + 0.6 * amt);
    else if (kind === 'surprise') { R.surprise = Math.min(1, R.surprise + 0.7 * amt); R.brows = Math.min(1, R.brows + 0.4 * amt); }
    else if (kind === 'think') R.press = Math.min(1, R.press + 0.6 * amt);
  }
  leanIn(amt = 0.06) { this.state.leanBoost = Math.max(this.state.leanBoost, amt); }
  gesture(kind, dur = 1.6, data = {}) { this.state.gesture = { kind, data }; this.state.gestureEnd = this.state.t + dur; this.state.gestureStart = this.state.t; }
  /** pick up the water bottle, drink, put it back. side: the hand nearer the bottle. */
  drink(bottle, side, dur = 5.4) {
    if (!bottle || this.drinking || this.state.speaking) return false;
    bottle.updateMatrixWorld(true);
    this.gesture('drink', dur, { bottle, side, home: { p: bottle.position.clone(), q: bottle.quaternion.clone() }, homeW: bottle.getWorldPosition(new V3()) });
    return true;
  }
  get drinking() { return this.state.gesture?.kind === 'drink' && this.state.t < this.state.gestureEnd; }
  _endDrink() {
    const g = this.state.gesture; if (g?.kind !== 'drink') return;
    g.data.bottle.position.copy(g.data.home.p); g.data.bottle.quaternion.copy(g.data.home.q);
    this.state.gesture = null; this.state.drinkTilt = 0;
  }

  /* ---------- motion-capture layer (Mixamo / Ready Player Me compatible clips) ---------- */
  /** clips: { idle?: AnimationClip, talk?: AnimationClip } — applied to the torso, neck and head only,
      under the procedural rig (which keeps the seated legs, desk hands, gaze and lip-sync). */
  useClips(clips, weight = 0.75) {
    this.mixer = new THREE.AnimationMixer(this.model); this.clipActions = {}; this.clipWeight = weight;
    for (const [k, clip] of Object.entries(clips)) {
      if (!clip) continue;
      const rc = Host.retarget(clip, this.bones); if (!rc.tracks.length) continue;
      const a = this.mixer.clipAction(rc); a.play(); a.setEffectiveWeight(k === 'idle' ? weight : 0); this.clipActions[k] = a;
    }
    if (!Object.keys(this.clipActions).length) this.mixer = null;
    return !!this.mixer;
  }
  static retarget(clip, bones) {
    const KEEP = new Set(['Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder']);
    const tracks = [];
    for (const tr of clip.tracks) {
      const m = /^(?:mixamorig:?)?([A-Za-z0-9]+)\.quaternion$/.exec(tr.name.split('|').pop());
      if (!m || !KEEP.has(m[1]) || !bones[m[1]]) continue;
      const t = tr.clone(); t.name = `${bones[m[1]].name}.quaternion`; tracks.push(t);
    }
    return new THREE.AnimationClip(clip.name + '-upper', clip.duration, tracks);
  }

  /* ---------- full-body motion (standing hosts): walk, turn, reach ----------
     The Mixamo clips (same skeleton as the avatars) drive the whole body while a host walks, turns on
     the move or reaches; their hip travel is the host's root motion, so the feet don't slide. Between
     clips the body is procedural: feet planted and stepping, weight shifting between the legs.
     Every change of motion starts from the pose actually shown (Inertializer, motion.js), so nothing
     snaps. Each move is staged the way people move:
       go:    the eyes and head find the destination → the chest turns ahead of the hips → the feet step
              round → a walk that speeds up from rest → slows before the mark → ends on a double-support
              step → a last shuffle onto the mark → the trunk and head settle
       reach: look at the target while approaching → stop → weight shift and a slight lean → the reach
              (motion capture: shoulder, elbow, forearm, wrist together) → back to rest, settling */
  static bodyClip(clip, bones, turns = false) {
    const tracks = []; let hp = null;
    for (const tr of clip.tracks) {
      const m = /^(?:mixamorig:?)?([A-Za-z0-9]+)\.(quaternion|position)$/.exec(tr.name.split('|').pop());
      if (!m || !bones[m[1]]) continue;
      if (m[2] === 'quaternion') tracks.push({ bone: bones[m[1]], it: tr.createInterpolant(), hips: m[1] === 'Hips' });
      else if (m[1] === 'Hips') hp = tr.createInterpolant();
    }
    const c = { dur: clip.duration, tracks, hp, turns };
    c.pos = (t) => hp ? new V3().fromArray(hp.evaluate(clamp(t, 0, c.dur))) : new V3();
    const hq = tracks.find((x) => x.hips);
    c.yaw = (t) => { if (!hq) return 0; const f = Z.clone().applyQuaternion(new QT().fromArray(hq.it.evaluate(clamp(t, 0, c.dur)))); return Math.atan2(f.x, f.z); };
    c.p0 = c.pos(0); c.yaw0 = c.yaw(0);
    // double support: the hips are lowest when both feet are on the ground — where a walk starts and stops
    const ys = []; for (let t = 0; t <= c.dur + 1e-6; t += 1 / 60) ys.push([t, c.pos(t).y]);
    c.contacts = ys.filter((v, i) => i > 0 && i < ys.length - 1 && v[1] <= ys[i - 1][1] && v[1] <= ys[i + 1][1]).map((v) => v[0]);
    if (!c.contacts.length) c.contacts = [0];
    // mid-stance: one foot under the hips, the other swinging past (hips highest) — where a walk sets off from standing
    c.mids = ys.filter((v, i) => i > 0 && i < ys.length - 1 && v[1] >= ys[i - 1][1] && v[1] >= ys[i + 1][1]).map((v) => v[0]);
    if (!c.mids.length) c.mids = [c.contacts[0]];
    return c;
  }
  /** clips: { walk, walkF (a woman's walk), turnL (walking left turn), reach } — AnimationClips */
  setBodyClips(map) { for (const [k, c] of Object.entries(map)) if (c) this.body[k] = Host.bodyClip(c, this.bones, k === 'turnL'); this._kClip = null; }
  get moving() { return !!this.act || this.acts.length > 0; }
  /** stand here now, facing yaw (radians, world) */
  place(pos, yaw) { this.acts = []; this.act = null; this.bodyW = 0; this.root.position.copy(pos); this.root.rotation.y = yaw; this.feet = null; this.inert?.reset(); }
  /** walk to pos, then turn to face `face` (yaw); `lookAt` (a point) is noticed on the way in; `then: 'reach'` */
  walkTo(pos, { face = null, clip = 'walk', then = null, lookAt = null, via = [] } = {}) { this.acts.push({ type: 'go', to: new V3(pos.x, 0, pos.z), face, clip, then, lookAt, via: via.map((v) => new V3(v.x, 0, v.z)) }); }
  /** present something: the eyes go between it and whoever they are talking to (null: stop) */
  presentAt(point) { this.present = point ? { at: point.clone(), onObj: true, next: this.state.t + 1.5 } : null; }
  /** things held: { Left: 'tablet' } / { Right: 'helmet' } (props.js); {} puts them away */
  setProps(map = {}) {
    for (const p of Object.values(this.props)) p.obj.removeFromParent();
    this.props = {};
    for (const [side, kind] of Object.entries(map || {})) if (PROPS[kind]) { const obj = PROPS[kind](); this.root.add(obj); this.props[side] = { kind, obj }; }
  }
  /** fold the arms across the chest (true), unfold (false), or leave it to habit (null) */
  foldArms(on = true) { this.state.foldCue = on; }
  _holding(s) { return this.props[s]?.kind; }
  /* a 'go' becomes its steps when it starts, from wherever the host is by then */
  _plan(g) {
    const steps = [], from = this.root.position.clone(); from.y = 0;
    const via = (g.via || []).filter((v) => v.distanceTo(from) > 0.6), first = via[0] || g.to;   // waypoints are walked through, not stopped at
    if (g.to.distanceTo(from) > 0.3 && this.body[g.clip]) {
      const dir = Math.atan2(first.x - from.x, first.z - from.z), turn = wrap(dir - this.root.rotation.y);
      steps.push({ type: 'glance', yaw: dir, T: 0.28 + Math.random() * 0.14 });                 // the eyes and head find it first
      if (turn > 0.6 && turn < 2.2 && this.body.turnL) steps.push({ type: 'play', clip: 'turnL', chain: true });   // a walking turn to the left
      else if (Math.abs(turn) > 0.3) steps.push({ type: 'turn', yaw: dir });
      steps.push({ type: 'walk', clip: g.clip, to: g.to, path: [...via, g.to], lookAt: g.lookAt });
    }
    if (g.face != null) steps.push({ type: 'turn', yaw: g.face });
    if (g.then && this.body[g.then]) { steps.push({ type: 'prep', T: 0.45, lookAt: g.lookAt }); steps.push({ type: 'play', clip: g.then, lookAt: g.lookAt }); }
    this.acts.unshift(...steps);
  }
  /** play a clip in place (e.g. reaching to close a roof light's sash) */
  perform(name, from, to) { if (this.body[name]) this.acts.push({ type: 'play', clip: name, from, to }); }
  _k(c) { return this._kClip ??= this.hipRestY / Math.max(1e-3, c.p0.y); }      // clip units → metres
  _isClip(a) { return a && (a.type === 'walk' || a.type === 'play'); }
  _lookYaw(yaw, drop = 0) { const R = this.root.position; return new V3(R.x + Math.sin(yaw) * 3, R.y + this.eyeY - drop, R.z + Math.cos(yaw) * 3); }
  _startAct(a) {
    const R = this.root, prev = this.act ?? this._lastAct; this.act = a; a.age = 0; a.chainIn = this._isClip(prev) && prev.chain;
    if (a.type === 'turn') {
      a.from = R.rotation.y; a.span = wrap(a.yaw - a.from); const ang = Math.abs(a.span);
      // timing from the size of the turn: a quarter turn takes about a second, the chest leads the hips
      a.T = 0.45 + ang * 0.42; a.delay = 0.1 + ang * 0.05; a.lead = 0.1 + ang * 0.07;
      if (ang < 0.04) { this.act = null; return; }
    }
    const c = this.body[a.clip];
    if (this._isClip(a) && c) {
      if (a.type === 'play') { a.from ??= c.dur > 8 ? 1.4 : 0; a.to ??= c.dur > 8 ? 5.8 : c.dur; a.t = a.from; }
      else a.t = c.mids.find((m) => m > 0.05) ?? c.mids[0];      // a walk sets off from mid-stance: one foot under the body
      a.prev = c.pos(a.t); a.prevYaw = c.yaw(a.t); a.yaw0 = a.prevYaw; a.base = this.walkRate;
    }
    if (this._isClip(a) || this._isClip(prev)) this.inert?.transition();
  }
  _endAct() {
    const a = this.act; this.act = null; this._lastAct = a; if (!a) return;
    if (this._isClip(a)) {
      this._replant = true; this._legBlend = 0; this.inert?.transition();       // stand from the pose the clip left
      this.settle.kick(a.type === 'walk' ? -0.32 : -0.18); this.state.nodV += 0.9;   // the trunk and head settle
      if (a.type === 'walk') {                                                 // the last few centimetres: a shuffle onto the mark
        const left = a.to.clone().sub(this.root.position).setY(0);
        const v = (a.vel || new V3()).clone().setY(0);
        if (left.length() > 0.04 || v.length() > 0.05) this.acts.unshift({ type: 'shuffle', to: a.to.clone(), v });
      }
    }
    if (a.type === 'turn') this.state.nodV += 0.5;                            // a small correction of the head at the end
  }
  _bodyAdvance(dt) {
    const R = this.root, S = this.state;
    while (this.acts[0]?.type === 'go' && !this.act) this._plan(this.acts.shift());
    if (!this.act && this.acts.length) this._startAct(this.acts.shift());
    const a = this.act; this._look = null; this._twist = 0; this._prep = Math.max(0, (this._prep || 0) - dt * 1.5);
    if (a) {
      a.age += dt;
      if (a.type === 'glance') { this._look = this._lookYaw(a.yaw); if (a.age >= a.T) this._endAct(); }
      else if (a.type === 'turn') {
        const e = curves.easeInOut(clamp((a.age - a.delay) / a.T, 0, 1)), ec = curves.easeInOut(clamp((a.age - a.delay + a.lead) / a.T, 0, 1));
        R.rotation.y = a.from + a.span * e;
        this._twist = a.span * (ec - e);                                     // the chest ahead of the hips
        this._look = this._lookYaw(a.yaw);
        if (a.age >= a.delay + a.T) this._endAct();
      } else if (a.type === 'prep') {                                         // weight onto the front foot, a slight lean
        this._prep = Math.min(1, a.age / a.T); if (a.lookAt) this._look = a.lookAt;
        if (a.age >= a.T) this._endAct();
      } else if (a.type === 'shuffle') {                                      // onto the mark, carrying on the walk's speed and easing off
        const w = 7, off = a.to.clone().sub(R.position).setY(0);
        a.v.addScaledVector(off, w * w * dt).addScaledVector(a.v, -2 * w * dt);
        R.position.addScaledVector(a.v, dt);
        if ((off.length() < 0.01 && a.v.length() < 0.03) || a.age > 1.4) this._endAct();
      } else if (this._isClip(a)) this._clipStep(a, dt);
    }
    const clip = this._isClip(this.act) && !!this.body[this.act.clip];
    this.bodyW = clip ? 1 : 0;                                                // no crossfade: the inertializer carries the change
    this.model.position.y = this.baseY + (clip ? this._hipDy || 0 : 0);
    if (this.groundAt) R.position.y += (this.groundAt(R.position.x, R.position.z) - R.position.y) * Math.min(1, dt * 10);   // step up onto a platform
  }
  _clipStep(a, dt) {
    const R = this.root, c = this.body[a.clip]; if (!c) { this._endAct(); return; }
    const k = this._k(c), loop = a.type === 'walk';
    let rate = a.rate || 1, left = 0, to = null;
    if (loop) {
      // through the waypoints: head for the next one, and move on to the one after before reaching it
      while (a.path?.length > 1 && a.path[0].clone().sub(R.position).setY(0).length() < 0.7) a.path.shift();
      const aim = a.path?.[0] || a.to;
      to = a.to.clone().sub(R.position); to.y = 0;
      left = to.length() + (a.path?.length > 1 ? 1e3 : 0);                   // not slowing down before a waypoint
      const toAim = aim.clone().sub(R.position).setY(0);
      // speed: from rest up to walking pace, and down again before the mark
      rate = a.base * (0.5 + 0.5 * curves.easeInOut(clamp(a.age / 0.9, 0, 1))) * (0.62 + 0.38 * curves.easeInOut(clamp((left - 0.35) / 1.1, 0, 1)));
      const aimYaw = Math.atan2(toAim.x, toAim.z), err = wrap(aimYaw - R.rotation.y);
      a.steer = (a.steer || 0) + (clamp(err * 2.2, -1.4, 1.4) - (a.steer || 0)) * Math.min(1, dt * 4);   // steering eases in and out
      // turning while walking pivots on the foot that is on the ground, so it doesn't slide
      // (the pivot moves between the feet with the weight: the lower foot carries it)
      const dth = a.steer * dt, cf = this._clipFeet, pivot = cf ? cf.Left.clone().lerp(cf.Right, clamp((cf.Left.y - cf.Right.y) / 0.05 + 0.5, 0, 1)) : null;
      if (pivot) { const off = R.position.clone().sub(pivot); off.y = 0; off.applyAxisAngle(Y, dth); R.position.set(pivot.x + off.x, R.position.y, pivot.z + off.z); }
      R.rotation.y += dth;
      this._look = a.lookAt && left < 2.2 ? a.lookAt : this._lookYaw(R.rotation.y, 0.12);          // notice the target before stopping
      if (left < 0.42 || (!(a.path?.length > 1) && to.dot(new V3(Math.sin(R.rotation.y), 0, Math.cos(R.rotation.y))) < 0)) a.stopping = true;   // (overshoot: only on the last leg)
    } else if (a.lookAt) this._look = a.lookAt;
    const t0 = a.t; let t = a.t + dt * rate, d = new V3(), dy = 0, done = false, wrapped = false;
    const end = loop ? c.dur : a.to;
    if (loop && t > end) { d.add(c.pos(end).sub(a.prev)); t -= c.dur; a.prev = c.pos(0); a.prevYaw = c.yaw(0); wrapped = true; this.inert?.transition(); }   // (a clip that isn't a perfect cycle: its seam is blended)
    if (!loop && t >= end) { t = end; done = true; }
    const p = c.pos(t); d.add(p.clone().sub(a.prev)); a.prev = p; a.t = t;
    if (c.turns) { const y = c.yaw(t); dy = wrap(y - a.prevYaw); a.prevYaw = y; }
    const step = new V3(d.x, 0, d.z).multiplyScalar(k).applyAxisAngle(Y, R.rotation.y);
    R.position.add(step); R.rotation.y += dy; a.dy = (a.dy || 0) + dy;
    if (dt > 0) a.vel = step.clone().divideScalar(dt);
    this._hipDy = (p.y - c.p0.y) * k;
    // stop on the next double-support moment once close enough: both feet down, weight between them
    if (loop && a.stopping) { const hit = c.contacts.some((ct) => wrapped ? (ct > t0 || ct <= t) : (ct > t0 && ct <= t)); if (hit || left < 0.12) done = true; }
    if (done) this._endAct();
  }
  _bodyBlend() {
    const a = this.act; if (!this.bodyW || !this._isClip(a)) return;
    const c = this.body[a.clip]; if (!c) return;
    const anchor = !a.anchored && this.feet && !a.chainIn; a.anchored = true;
    const q = new QT();
    for (const x of c.tracks) {
      q.fromArray(x.it.evaluate(clamp(a.t, 0, c.dur)));
      if (x.hips && c.turns) {                     // the turn the clip makes is carried by the root: take it out of the hips
        const par = x.bone.parent, up = Y.clone().applyQuaternion(par.getWorldQuaternion(new QT()).invert());
        q.premultiply(new QT().setFromAxisAngle(up, -wrap(c.yaw(a.t) - (a.yaw0 ?? c.yaw0))));
      }
      x.bone.quaternion.copy(q);
    }
    this.root.updateMatrixWorld(true);
    if (anchor) {
      // start the clip on the foot that is on the ground: move the root so the clip's supporting foot lands
      // where that foot already stands (both feet down: their midpoint); the body is carried across smoothly
      const b = this.bones, L = b.LeftFoot.getWorldPosition(new V3()), Rt = b.RightFoot.getWorldPosition(new V3());
      const both = Math.abs(L.y - Rt.y) < 0.03, side = L.y < Rt.y ? 'Left' : 'Right';
      const clipAt = both ? L.clone().add(Rt).multiplyScalar(0.5) : (side === 'Left' ? L : Rt);
      const planted = both ? this.feet.Left.pos.clone().add(this.feet.Right.pos).multiplyScalar(0.5) : this.feet[side].pos.clone();
      const d = planted.sub(clipAt); d.y = 0;
      if (d.length() < 0.5) {
        this.root.position.add(d); this.root.updateMatrixWorld(true);
        this.inert.shiftPosition(d.clone().negate().applyAxisAngle(Y, -this.root.rotation.y));
      }
    }
  }
  /* foot locking while a clip plays: a foot the clip has on the ground and still is pinned where it
     touched down and the leg is solved to it (knees bending forward); when the clip lifts
     it, it is let go over a tenth of a second. No foot slides, whatever the steering or the speed. */
  _footLock(dt) {
    const b = this.bones, L = this._locks ||= { Left: {}, Right: {} };
    if (!this.bodyW || !this._clipFootRaw) { L.Left = {}; L.Right = {}; return; }
    const solved = [], early = this.act && this.act.age < 0.35 && !this.act.chainIn;
    for (const s of ['Left', 'Right']) {
      const k = L[s], clipF = this._clipFootRaw[s], shown = b[s + 'Foot'].getWorldPosition(new V3());
      const v = k.last && dt > 0 ? Math.hypot(clipF.x - k.last.x, clipF.z - k.last.z) / dt : 0; k.last = clipF.clone();
      const contact = clipF.y - this.root.position.y < this.ankleY + 0.03 && v < 0.45;   // on the ground in the clip (relative to the body)
      if (contact && !k.pos) {                                 // pinned where the clip puts it (at a walk's start: where it already stood),
        k.pos = clipF.clone();                                 // set down on whatever is under it (the platform or the floor)
        k.pos.y = (this.groundAt ? this.groundAt(k.pos.x, k.pos.z) : 0) + this.ankleY + (clipF.y - this.root.position.y - this.ankleY);
      }
      if (!contact && k.pos) { k.rel = k.pos; k.pos = null; k.rw = 1; }
      let target = null;
      if (k.pos) target = k.pos;
      else if (k.rw > 0) { target = shown.clone().lerp(k.rel, curves.easeInOut(k.rw)); k.rw -= dt / 0.2; }
      else if (early) {                                        // setting off: the foot that leaves the ground is lifted clear
        const lift = Math.sin(Math.PI * clamp(this.act.age / 0.35, 0, 1)) * 0.06;   // while the body blends into the clip (no drag)
        const floor = (this.groundAt ? this.groundAt(shown.x, shown.z) : 0) + this.ankleY + lift;
        if (shown.y < floor) target = shown.clone().setY(floor);
      }
      if (!target) continue;
      // the knee keeps pointing where the clip points it (no swing of the knee when a foot is pinned or let go);
      // a leg nearly straight has no clear knee direction: then forward
      const sg = s === 'Left' ? 1 : -1, fwdPole = new V3(sg * 0.18, 0.2, 1).normalize().applyQuaternion(this.root.quaternion);
      const hip = b[s + 'UpLeg'].getWorldPosition(new V3()), knee = b[s + 'Leg'].getWorldPosition(new V3()), axis = shown.clone().sub(hip).normalize();
      const bend = knee.sub(hip).projectOnPlane(axis), bl = bend.length();
      const pole = bl > 0.02 ? bend.normalize().lerp(fwdPole, clamp(1 - (bl - 0.02) / 0.04, 0, 1)).normalize() : fwdPole;
      const toe = b[s + 'ToeBase'] ? b[s + 'ToeBase'].getWorldPosition(new V3()).sub(b[s + 'Foot'].getWorldPosition(new V3())).normalize() : null;
      this._ik(s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'UpLeg', s + 'Leg', target, pole);
      if (toe && b[s + 'ToeBase']) aim(b[s + 'Foot'], b[s + 'ToeBase'], toe);
      solved.push(s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'ToeBase');
    }
    this.inert.resync(solved);                                 // (a swinging leg keeps its blend, e.g. across a clip's loop seam)
  }
  /* standing legs: each foot stays where it was put and steps when the body has moved or turned away
     from it — one foot at a time, the leading foot first, a small arc, the weight going to the other leg */
  _standLegs(dt, P, R) {
    const b = this.bones, yaw = this.root.rotation.y, F = this.feet ||= {}, S = this.state;
    const ground = (v) => (this.groundAt ? this.groundAt(v.x, v.z) : 0) + this.ankleY;
    const want = {};
    for (const s of ['Left', 'Right']) {
      const sg = s === 'Left' ? 1 : -1;
      want[s] = P(new V3(sg * (this.hipWidth * 0.55 + 0.02), 0, sg > 0 ? 0.03 : -0.01)); want[s].y = ground(want[s]);
      if (!F[s]) F[s] = { pos: want[s].clone(), yaw, step: null };
      if (this._replant && this._clipFeet?.[s]) { F[s].pos.copy(this._clipFeet[s]); F[s].pos.y = ground(F[s].pos); F[s].yaw = yaw; F[s].step = null; }
    }
    this._replant = false;
    const stepping = F.Left.step || F.Right.step;
    if (!stepping && S.t > (this._nextStep || 0)) {
      const need = (s) => Math.max(F[s].pos.distanceTo(want[s]) / 0.06, Math.abs(wrap(yaw - F[s].yaw)) / 0.33);
      const s = need('Left') >= need('Right') ? 'Left' : 'Right';
      if (need(s) > 1) {
        const dist = F[s].pos.distanceTo(want[s]);
        F[s].step = { from: F[s].pos.clone(), to: want[s].clone(), y0: F[s].yaw, y1: yaw, u: 0, T: clamp(0.3 + dist * 0.9, 0.3, 0.55) * (0.92 + Math.random() * 0.16) };
      }
    }
    let shift = 0;
    for (const s of ['Left', 'Right']) {
      const sg = s === 'Left' ? 1 : -1, f = F[s], st = f.step;
      if (st) {
        st.u = Math.min(1, st.u + dt / st.T); const e = curves.easeInOut(st.u);
        st.to.copy(want[s]);                                                  // the swing foot tracks where it needs to land
        // heel off and lift first, swing, then set down: the foot never drags along the floor
        const eh = curves.easeInOut(clamp((st.u - 0.12) / 0.76, 0, 1));
        f.pos.lerpVectors(st.from, st.to, eh); f.pos.y += Math.pow(Math.sin(Math.PI * st.u), 0.55) * 0.06;
        f.yaw = st.y0 + wrap(st.y1 - st.y0) * e;
        shift -= sg * Math.sin(Math.PI * st.u) * 0.022;                      // weight over the other leg while this one swings
        if (st.u >= 1) { f.step = null; this._nextStep = S.t + 0.06 + Math.random() * 0.08; }
      }
      const fy = f.yaw + sg * 0.12, toe = new V3(Math.sin(fy), -0.42, Math.cos(fy)).normalize();
      const pole = R(new V3(sg * 0.18, 0.45, 1).normalize());
      this._ik(s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'UpLeg', s + 'Leg', f.pos, pole);
      if (b[s + 'ToeBase']) aim(b[s + 'Foot'], b[s + 'ToeBase'], toe);
      (this._legT ||= {})[s] = { pos: f.pos.clone(), pole, toe };
    }
    return shift;
  }

  /* ---------- per-frame ---------- */
  update(dt, now) {
    const S = this.state, b = this.bones; S.t += dt; const t = S.t;
    // reset to bind pose
    for (const [k, q] of Object.entries(this.rest)) b[k].quaternion.copy(q);
    this._bodyAdvance(dt);
    if (this.mixer) {
      const talkingNow = S.speaking && !!this.plan, A = this.clipActions;
      if (A.talk) { A.talk.setEffectiveWeight(THREE.MathUtils.lerp(A.talk.getEffectiveWeight(), talkingNow ? this.clipWeight : 0, Math.min(1, dt * 2))); }
      if (A.idle) { A.idle.setEffectiveWeight(THREE.MathUtils.lerp(A.idle.getEffectiveWeight(), talkingNow && A.talk ? 0 : this.clipWeight, Math.min(1, dt * 2))); }
      this.mixer.update(dt);
    }
    this.root.updateMatrixWorld(true);

    const rq = this.root.getWorldQuaternion(new QT());
    const R = (v) => v.clone().applyQuaternion(rq);         // root → world direction
    const P = (v) => this.root.localToWorld(v.clone());      // root → world point
    const right = R(X), up = Y.clone(), fwd = R(Z);

    // speech timeline
    let active = [], wordNow = null, lt = 0;
    if (this.plan) {
      lt = now - this.planStart; const lv = lt + VIS_LEAD;
      for (let i = 0; i < this.words.length; i++) {
        const w = this.words[i];
        if (lv >= w.s - 0.05 && lv <= w.s + w.d + 0.08) {
          for (const e of w.vis) { const s = w.s + e.s; if (lv >= s - 0.06 && lv <= s + e.d + 0.07) active.push([e, lv - s]); }
        }
        if (lt >= w.s - 0.05 && lt <= w.s + w.d + 0.08) {
          wordNow = w;
          if (i !== this.wordIdx) { this.wordIdx = i; this._onWordStart(w); this.onWord?.(i, w); }
        }
      }
    }
    const talking = S.speaking && !!this.plan;
    S.energy += ((talking ? 1 : 0) - S.energy) * Math.min(1, dt * 3);
    const gaze = this._gazeGoal(t);

    /* torso: seated lean, breathing, sway */
    const breath = Math.sin(t * 2 * Math.PI * 0.24 + this.seed);
    S.leanBoost *= Math.exp(-dt * 0.5);
    S.leanV += (((talking ? 0.07 : 0.035) + S.leanBoost + wave(t * 0.35, this.seed) * 0.02) - S.lean) * dt * 4; S.lean += S.leanV * dt; S.leanV *= 0.9;
    // swivel toward whatever they are looking at (the other host, the screen) — more for things far to the side
    { const want = soft(gaze.y * 0.32, -LIM.swivel, LIM.swivel);
      S.turnV += ((want - S.turn) * 6 - S.turnV * 4.5) * dt; S.turn += S.turnV * dt; }
    if (t > S.nextShift) { S.shiftTarget = (Math.random() - 0.5) * 0.06; S.nextShift = t + 6 + Math.random() * 9; }
    S.shift += (S.shiftTarget - S.shift) * Math.min(1, dt * 0.8);
    const hipShare = this.standing ? 0.25 : 0.55;           // standing, the feet are planted: the trunk does more of the turning
    rotateWorld(b.Hips, _qc.setFromAxisAngle(up, S.turn * hipShare));
    rotateWorld(b.Hips, _qc.setFromAxisAngle(fwd, S.shift));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(up, S.turn * (1 - hipShare)));
    if (this.standing) {
      // weight from one leg to the other now and then (contrapposto): hips over the loaded leg, pelvis dropping
      // on the free side, the chest leaning back the other way; none of it while moving
      if (!this.act && t > S.nextStance) { S.stanceTo = (S.stanceTo > 0 ? -1 : 1) * (0.5 + Math.random() * 0.5); S.nextStance = t + 7 + Math.random() * 8; }
      if (this.act) S.stanceTo = 0;
      S.stanceV += ((S.stanceTo - S.stance) * 3.2 - S.stanceV * 3.6) * dt; S.stance += S.stanceV * dt;
      this.model.position.x = S.stance * 0.022 + (this._stepShift || 0);
      this.model.position.z = (this._prep || 0) * 0.02;
      rotateWorld(b.Hips, _qc.setFromAxisAngle(fwd, -S.stance * 0.045));
      rotateWorld(b.Spine1, _qc.setFromAxisAngle(fwd, S.stance * 0.035));
      // a turn travels up the body: the chest turns ahead of the hips (and the head ahead of the chest, by the gaze)
      const tw = clamp(this._twist || 0, -0.65, 0.65);
      rotateWorld(b.Spine, _qc.setFromAxisAngle(up, tw * 0.3)); rotateWorld(b.Spine1, _qc.setFromAxisAngle(up, tw * 0.3)); rotateWorld(b.Spine2, _qc.setFromAxisAngle(up, tw * 0.4));
      // getting ready to reach: a slight lean in; after stopping, the trunk settles with a little overshoot
      rotateWorld(b.Spine, _qc.setFromAxisAngle(right, (this._prep || 0) * 0.07));
      rotateWorld(b.Spine1, _qc.setFromAxisAngle(right, this.settle.step(dt)));
    }
    rotateWorld(b.Spine1, _qc.setFromAxisAngle(fwd, -S.shift * 0.8));
    rotateWorld(b.Hips, _qc.setFromAxisAngle(right, -0.04));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(right, S.lean));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(up, wave(t * 0.4, this.seed + 2) * 0.03 * (1 + S.energy)));
    rotateWorld(b.Spine1, _qc.setFromAxisAngle(right, breath * 0.012 + 0.02));
    rotateWorld(b.Spine2, _qc.setFromAxisAngle(right, -breath * 0.018 - 0.04));
    rotateWorld(b.Spine2, _qc.setFromAxisAngle(fwd, wave(t * 0.5, this.seed + 7) * 0.02));
    // speech moves the whole trunk: beats lean in, gestures turn the chest and lift that shoulder,
    // the pelvis answers the other way, sentence ends breathe out (body.js)
    const BS = this._bs = this.bodySys.step(dt, talking), bk = this.standing ? 1 : 0.6;
    rotateWorld(b.Hips, _qc.setFromAxisAngle(up, BS.pelvis.yaw * bk)); rotateWorld(b.Hips, _qc.setFromAxisAngle(fwd, BS.pelvis.roll * bk));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(right, BS.spine.pitch * bk)); rotateWorld(b.Spine, _qc.setFromAxisAngle(up, BS.spine.yaw * bk)); rotateWorld(b.Spine, _qc.setFromAxisAngle(fwd, BS.spine.roll * bk));
    rotateWorld(b.Spine2, _qc.setFromAxisAngle(right, BS.chest.pitch * bk)); rotateWorld(b.Spine2, _qc.setFromAxisAngle(up, BS.chest.yaw * bk)); rotateWorld(b.Spine2, _qc.setFromAxisAngle(fwd, BS.chest.roll * bk));
    // posture: whatever the motion capture brings, the trunk keeps a desk presenter's lean (at most ~15° forward)
    { const cf = this._fwdOf('Spine2').applyQuaternion(rq.clone().invert()), cp = yawPitch(cf).p, fix = soft(cp, -16 * DEG, 4 * DEG) - cp;
      if (Math.abs(fix) > 1e-4) { const cr = Y.clone().cross(cf.applyQuaternion(rq)).normalize(); rotateWorld(b.Spine, _qc.setFromAxisAngle(cr, -fix * 0.5)); rotateWorld(b.Spine1, _qc.setFromAxisAngle(cr, -fix * 0.5)); } }

    /* legs: feet planted in front of the chair, or under the hips when standing */
    if (this.standing) this._stepShift = this._standLegs(dt, P, R);
    else for (const s of ['Left', 'Right']) {
      const sg = s === 'Left' ? 1 : -1;
      const foot = P(new V3(sg * (this.hipWidth * 0.62 + 0.03), this.ankleY, 0.43 + (sg > 0 ? 0.02 : -0.01)));
      this._ik(s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'UpLeg', s + 'Leg', foot, R(new V3(sg * 0.18, 0.45, 1).normalize()));
      if (b[s + 'ToeBase']) aim(b[s + 'Foot'], b[s + 'ToeBase'], R(new V3(sg * 0.12, -0.42, 1).normalize()));
    }

    /* arms: IK to the hand targets (desk rest or gesture), wrist and forearm inside their limits */
    this._planHands(dt, talking, lt);
    for (const s of ['Left', 'Right']) {
      const sg = s === 'Left' ? 1 : -1, H = S.hands[s];
      const pos = H.p.p.clone();
      if (this.standing) pos.x += this.model.position.x;       // the hands go with the body when the weight shifts
      if (H.key !== 'drink' && !H.key.startsWith('rest')) pos.y += wave(t * 1.3, this.seed + (sg > 0 ? 1 : 2)) * 0.006 * S.energy;
      // the shoulder girdle rises a little as the hand rises (scapulohumeral rhythm)
      const elev = clamp((pos.y - (this.deskY + 0.1)) * 0.45, 0, 0.09);
      const micro = this.standing ? wave(t * 0.17, this.seed + (sg > 0 ? 11 : 13)) * 0.012 : 0;   // tiny, uneven shoulder adjustments
      const shrug = (this._bs?.shoulders[s] || 0) * (this.standing ? 1 : 0.6);
      if (b[s + 'Shoulder']) rotateWorld(b[s + 'Shoulder'], _qc.setFromAxisAngle(fwd, -sg * (0.12 + breath * 0.008 - elev + micro - shrug)));
      this._ik(s + 'Arm', s + 'ForeArm', s + 'Hand', s + 'Arm', s + 'ForeArm', P(pos), R(this._armPole(s)));
      this._alignHand(s, R(H.f.p.clone().normalize()), R(H.n.p.clone().normalize()), rq);
      this._fingers(s, this._fingerPose(s, dt));
    }
    if (S.gesture?.kind === 'drink') this._carryBottle();
    this._bodyBlend();
    if (this.bodyW) for (const s of ['Left', 'Right']) if (this._holding(s) === 'tablet') {
      const H = S.hands[s]; this.root.updateMatrixWorld(true);
      this._ik(s + 'Arm', s + 'ForeArm', s + 'Hand', s + 'Arm', s + 'ForeArm', P(H.p.p), R(this._armPole(s)));
      this._alignHand(s, R(H.f.p.clone().normalize()), R(H.n.p.clone().normalize()), rq);
      this._fingers(s, this.state.fing[s].x);
    }
    if (this.bodyW) this._clipFootRaw = { Left: b.LeftFoot.getWorldPosition(new V3()), Right: b.RightFoot.getWorldPosition(new V3()) };

    /* head, neck and eyes */
    S.nodV += (-S.nod * 60 - S.nodV * 9) * dt; S.nod += S.nodV * dt;
    this._gaze(dt, t, gaze, rq);
    // every change of motion continues from the pose shown (and a snap anywhere is smoothed)
    this.inert.detect = !this.bodyW;
    this.inert.apply(dt);
    if (this.standing && !this.bodyW && this._legT) {         // planted feet stay exactly where they are
      // (just after a clip, the legs ease from the pose the clip left into the planted solution over 0.35 s)
      this._legBlend = Math.min(1, (this._legBlend ?? 1) + dt / 0.35);
      const LB = ['UpLeg', 'Leg', 'Foot', 'ToeBase'], keep = this._legBlend < 1 ? Object.fromEntries(['Left', 'Right'].flatMap((s) => LB.map((k) => [s + k, b[s + k]?.quaternion.clone()]))) : null;
      for (const s of ['Left', 'Right']) { const L = this._legT[s]; this._ik(s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'UpLeg', s + 'Leg', L.pos, L.pole); if (b[s + 'ToeBase']) aim(b[s + 'Foot'], b[s + 'ToeBase'], L.toe); }
      if (keep) { const w = curves.easeInOut(this._legBlend); for (const [k, q] of Object.entries(keep)) if (q && b[k]) b[k].quaternion.copy(q.slerp(b[k].quaternion, w)); }
      this.inert.resync(['LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']);
    }
    if (this.standing) this._footLock(dt);
    if (this.bodyW) { this.root.updateMatrixWorld(true); this._clipFeet = { Left: b.LeftFoot.getWorldPosition(new V3()), Right: b.RightFoot.getWorldPosition(new V3()) }; }
    this._placeProps();

    /* face: blink, visemes, jaw, smile, brows */
    // ~26 blinks a minute while talking, ~17 listening (Bentivoglio et al. 1997), plus at pauses and gaze shifts
    if (S.blinkT < 0 && (t > S.nextBlink || (S.blinkAt >= 0 && t >= S.blinkAt))) {
      S.blinkT = 0; S.blinkAt = -1; S.blinkAmp = Math.random() < 0.12 ? 0.7 : 1;
      S.nextBlink = t + (talking ? 2.3 : 3.5) * (0.35 + Math.random() * 1.3);
    }
    if (S.blinkT >= 0) {   // the lid drops fast and lifts slowly (Evinger et al. 1991)
      S.blinkT += dt; const u = S.blinkT, c = 0.075, h = 0.03, o = 0.17;
      S.blink = S.blinkAmp * (u < c ? smooth(u / c) : u < c + h ? 1 : u < c + h + o ? 1 - smooth((u - c - h) / o) : 0);
      if (u >= c + h + o) { S.blinkT = -1; S.blink = 0; }
    }
    const W = {};
    const add = (k, v) => { W[k] = Math.min(1, (W[k] || 0) + v); };
    for (const [e, lv] of active) {
      const env = clamp(Math.min((lv + 0.06) / 0.07, (e.d + 0.07 - lv) / 0.08), 0, 1);
      const g = (VIS_GAIN[e.v] ?? .5) * env * this.mouthGain;
      add('viseme_' + e.v, g); add('jawOpen', (VIS_JAW[e.v] ?? .1) * env);
    }
    // the upper lid follows the eye down (and a little up)
    const lidDown = clamp(-S.eyePitch / LIM.eyeDown, 0, 1) * 0.35, lidUp = clamp(S.eyePitch / LIM.eyeUp, 0, 1);
    add('eyeBlinkLeft', S.blink + lidDown); add('eyeBlinkRight', S.blink + lidDown);
    add('eyeWideLeft', lidUp * 0.15); add('eyeWideRight', lidUp * 0.15);
    // smile: lip corners (AU12) with the cheek raise that makes it read as felt (AU6, Duchenne);
    // spontaneous expressions are a little stronger on the left of the face (Sackeim et al. 1978)
    const sm = clamp(S.smile * (talking ? 0.55 : 1) + wave(t * 0.2, this.seed) * 0.04, 0, 1);
    if (this.morphs.mouthSmile) { add('mouthSmile', sm * 0.94); add('mouthSmileLeft', sm * 0.08); }
    else { add('mouthSmileLeft', sm * 1.05); add('mouthSmileRight', sm * 0.95); }
    add('cheekSquintLeft', sm * 0.42); add('cheekSquintRight', sm * 0.38); add('eyeSquintLeft', sm * 0.16); add('eyeSquintRight', sm * 0.14);
    if (talking) { add('mouthSmileLeft', Math.max(0, wave(t * 0.9, this.seed + 3)) * 0.05); add('mouthSmileRight', Math.max(0, wave(t * 0.8, this.seed + 5)) * 0.04); }
    // brows: a low baseline, and quick flashes on stressed words and questions (visual prosody)
    S.flashV += (-60 * S.flash - 12 * S.flashV) * dt; S.flash += S.flashV * dt;
    S.brow += ((talking ? 0.08 : 0.04) - S.brow) * Math.min(1, dt * 4);
    const fl = Math.max(0, S.flash);
    add('browInnerUp', (S.brow + fl) * 0.5); add('browOuterUpLeft', (S.brow + fl) * 0.38); add('browOuterUpRight', (S.brow + fl * 0.85) * 0.34);
    // mood
    const md = S.mood;
    if (md === 'serious') { add('browDownLeft', 0.22); add('browDownRight', 0.2); add('mouthPressLeft', talking ? 0.05 : 0.18); add('mouthPressRight', talking ? 0.05 : 0.16); }
    if (md === 'smile') { add('cheekSquintLeft', 0.2); add('cheekSquintRight', 0.18); add('mouthDimpleLeft', 0.12); add('mouthDimpleRight', 0.1); }
    // reactions (decay over about a second)
    const Rx = S.react; for (const k in Rx) Rx[k] *= Math.exp(-dt * 1.4);
    add('mouthSmileLeft', Rx.smile * 0.5); add('mouthSmileRight', Rx.smile * 0.45); add('cheekSquintLeft', Rx.smile * 0.35); add('cheekSquintRight', Rx.smile * 0.35);
    add('browInnerUp', Rx.brows * 0.55); add('browOuterUpLeft', Rx.brows * 0.4); add('browOuterUpRight', Rx.brows * 0.35);
    add('eyeWideLeft', Rx.surprise * 0.45); add('eyeWideRight', Rx.surprise * 0.45); if (!talking) add('jawOpen', Rx.surprise * 0.06);
    add('mouthPressLeft', Rx.press * 0.35); add('mouthPressRight', Rx.press * 0.3); add('browDownLeft', Rx.press * 0.15); add('browDownRight', Rx.press * 0.12);
    // while listening: small, asymmetric, human flickers
    if (!talking && t > S.nextMicro) {
      const opts = [['mouthSmileLeft', 0.18], ['mouthPressRight', 0.25], ['browInnerUp', 0.2], ['mouthDimpleLeft', 0.2], ['cheekSquintRight', 0.15], ['mouthRollLower', 0.15]];
      const [k, v] = opts[Math.floor(Math.random() * opts.length)]; S.micro = { k, v, until: t + 1.2 + Math.random() * 1.6 }; S.nextMicro = t + 3 + Math.random() * 5;
    }
    if (S.micro.k) { const f = clamp((S.micro.until - t) / 0.6, 0, 1); add(S.micro.k, S.micro.v * Math.min(1, f)); if (t > S.micro.until) S.micro.k = null; }
    if (S.drinkTilt > 0.3) { add('mouthPucker', 0.35); add('eyeBlinkLeft', 0.35); add('eyeBlinkRight', 0.35); }
    this._applyMorphs(W, dt);
  }

  /* a new word: brow flash or a small nod on stressed words, a blink in the pause after a sentence */
  _onWordStart(w) {
    const S = this.state, r = Math.random();
    if (w.stress) { if (r < 0.5) S.flashV += 5 * this.expressive; if (r > 0.3 && r < 0.7) this.nod(0.25 + Math.random() * 0.3); }
    if (/\?$/.test(w.raw)) S.flashV += 4;
    if (/[.!?]$/.test(w.raw) && Math.random() < 0.45) S.blinkAt = S.t + w.d + 0.06;
    if (/^(not|no|never|don't|can't|won't|isn't|without)$/i.test(w.raw.replace(/[^\w']/g, ''))) S.react.press = Math.min(1, S.react.press + 0.3);
    const B = this.bodySys, bare = w.raw.replace(/[^\w']/g, '');
    if (w.stress) B.beat(0.6 + Math.random() * 0.5);
    if (/\?$/.test(w.raw)) B.question();
    else if (/[.!]$/.test(w.raw)) B.sentenceEnd();
    if (/^(but|however|although|though|yet|instead|whereas)$/i.test(bare)) B.contrast();
  }

  _ik(uName, lName, eName, uLen, lLen, targetW, poleW) {
    const b = this.bones, u = b[uName], l = b[lName], e = b[eName];
    const A = u.getWorldPosition(new V3());
    const a = this.len[uLen], c = this.len[lLen];
    // elbows and knees stop at about 145° of flexion
    const dMin = Math.sqrt(a * a + c * c - 2 * a * c * Math.cos(35 * DEG));
    const d = targetW.clone().sub(A); const dist = clamp(d.length(), dMin, (a + c) * 0.995); const dir = d.normalize();
    const x = (a * a - c * c + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, a * a - x * x));
    const pole = poleW.clone().projectOnPlane(dir).normalize();
    const E = A.clone().addScaledVector(dir, x).addScaledVector(pole, h);
    const T = A.clone().addScaledVector(dir, dist);
    aim(u, l, E.clone().sub(A).normalize());
    aim(l, e, T.sub(E).normalize());
  }

  _handFrame(s) {
    const b = this.bones, p = (n) => b[n].getWorldPosition(new V3());
    const f = p(s + 'HandMiddle1').sub(p(s + 'Hand')).normalize();
    const l = p(s + 'HandIndex1').sub(p(s + 'HandPinky1')).normalize();
    const n = s === 'Left' ? f.clone().cross(l) : l.clone().cross(f);
    return { f, n: n.normalize(), l };
  }
  /* Turn the hand toward fingers fT / palm nT (world), but only as far as a forearm and wrist can:
     forearm rotation from thumb-up, then wrist bend and side bend. */
  _alignHand(s, fT, nT, rq) {
    const b = this.bones;
    if (!b[s + 'HandMiddle1'] || !b[s + 'HandIndex1'] || !b[s + 'HandPinky1']) return;
    const sg = s === 'Left' ? 1 : -1;
    const Sh = b[s + 'Arm'].getWorldPosition(new V3()), E = b[s + 'ForeArm'].getWorldPosition(new V3()), Wr = b[s + 'Hand'].getWorldPosition(new V3());
    const fa = Wr.clone().sub(E).normalize(), ua = E.clone().sub(Sh).normalize();
    // "thumb up" for this arm: the palm faces along the elbow's hinge axis, toward the body
    let med = ua.clone().cross(fa).multiplyScalar(sg);
    if (med.lengthSq() < 0.04) med = new V3(-sg, 0, 0).applyQuaternion(rq);
    med.projectOnPlane(fa).normalize();
    const pro = fa.clone().cross(med).multiplyScalar(sg).normalize();       // where the palm faces at 90° pronation
    const a = soft(Math.atan2(nT.dot(pro), nT.dot(med)), -LIM.sup, LIM.pron);
    const nP = med.clone().multiplyScalar(Math.cos(a)).addScaledVector(pro, Math.sin(a));
    const rad = nP.clone().cross(fa).multiplyScalar(sg).normalize();        // thumb side
    const x = fT.dot(fa);
    const fl = soft(Math.atan2(fT.dot(nP), x), -LIM.wExt, LIM.wFlex), dv = soft(Math.atan2(fT.dot(rad), x), -LIM.wUln, LIM.wRad);
    fT = fa.clone().addScaledVector(nP, Math.tan(fl)).addScaledVector(rad, Math.tan(dv)).normalize();
    nT = nP.clone().projectOnPlane(fT).normalize();
    let { f, n } = this._handFrame(s);
    // share the wrist twist with the forearm to avoid a "candy-wrapper" wrist
    const q1 = new QT().setFromUnitVectors(f, fT);
    const tw = signedAngle(n.clone().applyQuaternion(q1), nT, fT);
    rotateWorld(b[s + 'ForeArm'], new QT().setFromAxisAngle(fa, tw * 0.55));
    ({ f, n } = this._handFrame(s));
    const qa = new QT().setFromUnitVectors(f, fT);
    const n1 = n.clone().applyQuaternion(qa);
    const qb = new QT().setFromAxisAngle(fT, signedAngle(n1, nT, fT));
    rotateWorld(b[s + 'Hand'], qb.multiply(qa));
  }
  /* finger joint angles, eased toward the hand shape of the moment */
  _fingerPose(s, dt) {
    const F = this.state.fing[s], tgt = shapeVec(handShape(this.state.hands[s].shape)), w = 2 * Math.PI * 2.4;
    for (let i = 0; i < tgt.length; i++) { F.v[i] += (w * w * (tgt[i] - F.x[i]) - 2 * w * F.v[i]) * dt; F.x[i] += F.v[i] * dt; }
    return F.x;
  }
  /* v: MCP ×4, PIP ×4, spread, thumb ×3 (see HANDS) */
  _fingers(s, v) {
    const b = this.bones; if (!b[s + 'HandMiddle1']) return;
    const sg = s === 'Left' ? 1 : -1, { n, l } = this._handFrame(s), t = this.state.t;
    const fan = [1, 0.15, -0.45, -1];
    ['Index', 'Middle', 'Ring', 'Pinky'].forEach((fn, i) => {
      const b1 = b[`${s}Hand${fn}1`], b2 = b[`${s}Hand${fn}2`], b3 = b[`${s}Hand${fn}3`]; if (!b1 || !b2) return;
      const j = wave(t * 0.3, this.seed + i * 1.7) * 0.025;
      rotateWorld(b1, _qc.setFromAxisAngle(n, sg * v[8] * fan[i]));                     // spread
      const ax = b2.getWorldPosition(new V3()).sub(b1.getWorldPosition(new V3())).normalize().cross(n).normalize();
      rotateWorld(b1, _qc.setFromAxisAngle(ax, v[i] + j));                               // knuckle
      rotateWorld(b2, _qc.setFromAxisAngle(ax, v[4 + i] + j));                           // middle joint
      if (b3) rotateWorld(b3, _qc.setFromAxisAngle(ax, (v[4 + i] + j) * 0.67));          // end joint, coupled
    });
    const t1 = b[s + 'HandThumb1'], t2 = b[s + 'HandThumb2'], t3 = b[s + 'HandThumb3'];
    if (!t1 || !t2) return;
    const dir = (a, c) => c.getWorldPosition(new V3()).sub(a.getWorldPosition(new V3())).normalize();
    rotateWorld(t1, _qc.setFromAxisAngle(dir(t1, t2).cross(n).normalize(), v[9]));        // base: toward the palm
    const across = n.clone().multiplyScalar(0.6).addScaledVector(l, -0.8).normalize();   // flexion: into the palm, toward the little finger
    if (t3) {
      rotateWorld(t2, _qc.setFromAxisAngle(dir(t2, t3).cross(across).normalize(), v[10]));
      const t4 = t3.children.find(c => c.isBone);
      rotateWorld(t3, _qc.setFromAxisAngle((t4 ? dir(t3, t4) : dir(t2, t3)).cross(across).normalize(), v[11]));
    }
  }

  /* ---------- gaze: eyes lead, head follows, trunk helps ---------- */
  _gazeGoal(t) {
    const S = this.state, G = S.gaze, b = this.bones;
    const eyeW = this._eyeW || (b.LeftEye && b.RightEye ? b.LeftEye.getWorldPosition(new V3()).add(b.RightEye.getWorldPosition(new V3())).multiplyScalar(0.5) : b.Head.getWorldPosition(new V3()).add(new V3(0, 0.08, 0)));
    let target = this._look || S.lookAt;
    const tab = this.props.Left?.kind === 'tablet' ? this.props.Left.obj : this.props.Right?.kind === 'tablet' ? this.props.Right.obj : null;
    if (tab && !this._look && !this.act) {                  // holding a tablet: now and then a look down at it
      if (S.t > S.nextTabletLook) { S.tabletLookUntil = S.t + 0.8 + Math.random() * 0.8; S.nextTabletLook = S.t + 6 + Math.random() * 7; }
      if (S.t < S.tabletLookUntil) target = tab.getWorldPosition(new V3());
    }
    const Pr = this.present;
    if (!this._look && Pr && !this.act) {                   // presenting: between the thing shown and the person talked to
      if (S.t > Pr.next) { Pr.onObj = !Pr.onObj; Pr.next = S.t + (Pr.onObj ? 2.2 + Math.random() * 2 : 1.2 + Math.random() * 1.3); }
      if (Pr.onObj) target = Pr.at;
    }
    const d = this.root.worldToLocal(target.clone()).sub(this.root.worldToLocal(eyeW.clone()));
    let { y, p } = yawPitch(d);
    if (G.avert && t < G.avert.until) { y += G.avert.y; p += G.avert.p; }
    // a target behind the shoulder: glance at it, then back to the front for a few seconds —
    // nobody holds a full neck turn through a whole sentence
    if (Math.abs(y) > LIM.reach) {
      if (t >= G.backUntil) {
        if (G.farSince < 0) G.farSince = t;
        if (t - G.farSince > G.farDwell) { G.backUntil = t + 2.5 + Math.random() * 2; G.farSince = -1; G.farDwell = 1.8 + Math.random() * 1.5; }
      }
      if (t < G.backUntil) { y = Math.sign(y) * 18 * DEG; p = -2 * DEG; }
    } else { G.farSince = -1; G.backUntil = 0; }
    G.dist = d.length(); G.goalY = y;
    return { y, p };
  }
  _gaze(dt, t, goal, rq) {
    const S = this.state, G = S.gaze, b = this.bones, irq = rq.clone().invert();
    const fwdOf = (k) => this._fwdOf(k), upOf = (k) => this._upOf(k);
    const chest = yawPitch(fwdOf('Spine2').applyQuaternion(irq));
    // share the shift: the eyes take the first part, the head the rest — inside the neck's range
    let relY = wrap(goal.y - chest.y); const relP = goal.p - chest.p;
    // a target right behind: stay on the side already turning, instead of flipping from +180° to -180°
    if (Math.abs(relY) > 2.4 && G.relY != null && Math.abs(G.relY) > 1.9 && Math.sign(relY) !== Math.sign(G.relY)) relY += relY < 0 ? 2 * Math.PI : -2 * Math.PI;
    G.relY = relY;
    const hY = soft(relY - clamp(relY * 0.35, -0.2, 0.2), -LIM.neckYaw, LIM.neckYaw);
    const hP = soft(relP - clamp(relP * 0.4, -0.15, 0.15), -LIM.neckDown, LIM.neckUp);
    const eyeGoal = new V3(goal.y, goal.p, 0), headGoal = new V3(chest.y + hY, chest.p + hP, 0);
    if (!G.init) { G.eye.reset(eyeGoal); G.head.reset(headGoal); G.init = true; }
    eyeGoal.x = G.eye.p.x + wrap(eyeGoal.x - G.eye.p.x); headGoal.x = G.head.p.x + wrap(headGoal.x - G.head.p.x);
    const jump = eyeGoal.distanceTo(G.eye.goal);
    if (jump > 4 * DEG) {
      // a new fixation: a saccade (main sequence ≈ 21 ms + 2.2 ms per degree), the head joins ~50 ms later
      const A = jump / DEG;
      G.eye.to(eyeGoal, 0.04 + 0.0022 * A);
      G.headAt = t + 0.05; G.headT = 0.22 + 0.0075 * A;
      if (A > 18 && Math.random() < 0.65) S.blinkAt = t;       // gaze-evoked blink (Evinger et al. 1994)
    } else if (!G.eye.busy) G.eye.follow(eyeGoal, dt, 14);
    G.eye.update(dt);
    if (G.headAt >= 0 && t >= G.headAt) { G.head.to(headGoal, G.headT); G.headAt = -1; }
    else if (G.head.busy && headGoal.distanceTo(G.head.goal) > 3 * DEG) G.head.to(headGoal, Math.max(0.15, G.head.T - G.head.t));
    else if (G.headAt < 0 && !G.head.busy) G.head.follow(headGoal, dt, 3);
    G.head.update(dt);
    // the neck carries about 40 % of the turn, the head the rest
    const hy = G.head.p.x, hp = G.head.p.y;
    this._aimBone(b.Neck, this.restWorldQ.Neck, dirOf(chest.y + wrap(hy - chest.y) * 0.4, chest.p + (hp - chest.p) * 0.4).applyQuaternion(rq));
    this._aimBone(b.Head, this.restWorldQ.Head, dirOf(hy, hp).applyQuaternion(rq));
    // nods about the head's own side axis
    const hf = fwdOf('Head'), hr = Y.clone().cross(hf).normalize();
    rotateWorld(b.Head, _qc.setFromAxisAngle(hr, S.nod * 0.5 - S.drinkTilt * 0.24 + (this._bs?.head.nod || 0)));
    if (S.drinkTilt) rotateWorld(b.Neck, _qc.setFromAxisAngle(hr, -S.drinkTilt * 0.12));
    // side tilt: half of whatever the motion capture brought, plus a little with speech, kept small
    { const f2 = fwdOf('Head'), roll = signedAngle(upOf('Spine2'), upOf('Head'), f2);
      const want = soft(roll * 0.5 + wave(t * 0.45, this.seed + 11) * 0.035 * (0.5 + S.energy) + (this._bs?.head.tilt || 0), -LIM.neckRoll, LIM.neckRoll);
      rotateWorld(b.Head, _qc.setFromAxisAngle(f2, want - roll)); }
    // eyes: on the target, as far as they can turn in the head; fixational micro-saccades
    const hA = yawPitch(fwdOf('Head').applyQuaternion(irq));
    if (t > G.nextOff) { G.off.set((Math.random() - .5) * 2.4 * DEG, (Math.random() - .5) * 1.6 * DEG, 0); G.nextOff = t + 0.35 + Math.random() * 1.6; }
    G.offCur.lerp(G.off, 1 - Math.exp(-dt * 30));
    const ey = soft(wrap(G.eye.p.x + G.offCur.x - hA.y), -LIM.eyeYaw, LIM.eyeYaw), ep = soft(G.eye.p.y + G.offCur.y - hA.p, -LIM.eyeDown, LIM.eyeUp);
    S.eyePitch = ep;
    const eL = b.LeftEye, eR = b.RightEye;
    if (eL && eR) {
      const mid = eL.getWorldPosition(new V3()).add(eR.getWorldPosition(new V3())).multiplyScalar(0.5); this._eyeW = mid;
      const focus = mid.clone().addScaledVector(dirOf(hA.y + ey, hA.p + ep).applyQuaternion(rq), clamp(G.dist, 0.6, 8));
      for (const [k, e] of [['LeftEye', eL], ['RightEye', eR]]) this._aimBone(e, this.restWorldQ[k], focus.clone().sub(e.getWorldPosition(new V3())).normalize());
    } else this._eyeW = b.Head.getWorldPosition(new V3()).add(new V3(0, 0.08, 0));
  }
  _fwdOf(k) { return Z.clone().applyQuaternion(this.restWorldQ[k].clone().invert()).applyQuaternion(this.bones[k].getWorldQuaternion(new QT())); }
  _upOf(k) { return Y.clone().applyQuaternion(this.restWorldQ[k].clone().invert()).applyQuaternion(this.bones[k].getWorldQuaternion(new QT())); }
  /* turn a bone so its rest-forward (+Z of the model) points along dirW */
  _aimBone(bone, restQ, dirW) {
    const cur = Z.clone().applyQuaternion(restQ.clone().invert()).applyQuaternion(bone.getWorldQuaternion(new QT())).normalize();
    rotateWorld(bone, new QT().setFromUnitVectors(cur, dirW.clone().normalize()));
  }

  /* ---------- hands: co-speech gestures ---------- */
  /* Pick the gesture moments from the speech plan: stressed words, and words that carry a gesture of
     their own. The stroke lands just before the word's stressed syllable (McNeill's phonological
     synchrony rule); the hand is prepared ~0.3–0.4 s ahead and held briefly after. */
  _planCues(words) {
    const cues = []; let last = -9, k = 0;
    for (const w of words) {
      const sem = gestureFor(w.raw);
      if (!sem && !w.stress) continue;
      const apex = w.s + Math.min(0.12, w.d * 0.4) - 0.04;
      if (apex < 0.55 || apex - last < (sem ? 1.0 : 1.3)) continue;
      if (Math.random() > (sem ? 0.8 : 0.42) * this.expressive) continue;
      const kind = sem?.kind || (Math.random() < 0.7 ? 'beat' : 'explain');
      const both = kind === 'explain' || kind === 'wide' || (kind === 'offer' && Math.random() < 0.5);
      const side = kind === 'beat' && Math.random() < 0.35 ? 'Left' : 'Right';
      const stroke = kind === 'beat' ? 0.14 : 0.22, hold = kind === 'beat' ? 0.08 : kind === 'count' ? 0.55 : 0.35;
      cues.push({ id: 'c' + (k++), kind, n: sem?.n, both, side, apex, stroke, prepAt: apex - stroke - (kind === 'beat' ? 0.3 : 0.4), end: apex + hold });
      last = apex;
    }
    return cues;
  }
  /* the gesture phase at speech time lt: prep → stroke (and hold) → home between close gestures → rest */
  _cueAt(lt) {
    const C = this.cues; if (!C?.length) return null;
    const i = C.findIndex(c => lt < c.end); if (i < 0) return null;
    const c = C[i];
    if (lt < c.prepAt) { const p = C[i - 1]; return p && c.prepAt - p.end < 0.9 ? { ...p, phase: 'home' } : null; }
    const strokeAt = c.apex - c.stroke;
    return lt < strokeAt ? { ...c, phase: 'prep', T: Math.max(0.2, strokeAt - lt) } : { ...c, phase: 'stroke', T: c.stroke };
  }
  /* Where the hand goes, root space (x toward the host's left, y up, z forward). Palms are given as
     forearm rotation: 0° thumb up, +90° palm down, −90° palm up — the limits keep them honest. */
  _pose(kind, phase, s, c = {}) {
    const sg = s === 'Left' ? 1 : -1, rest = this.handRest(s), A = this.expressive, k = phase === 'stroke' ? 1 : 0;
    const palm = (deg, tilt = 0) => new V3(-sg * Math.cos(deg * DEG), -Math.sin(deg * DEG), tilt).normalize();
    const at = (dx, dy, dz) => rest.pos.clone().add(new V3(sg * dx * A, dy * A, dz * A));
    const v = (x, y, z) => new V3(sg * x, y, z).normalize();
    switch (kind) {
      case 'home': return { pos: at(-0.05, 0.09, 0.03), nrm: palm(55), fwd: v(-0.3, 0.05, 1), shape: 'relaxed' };
      case 'beat': return { pos: at(-0.04, k ? 0.095 : 0.15, 0.05), nrm: palm(k ? 55 : 40), fwd: v(-0.25, k ? -0.05 : 0.2, 1), shape: 'loose' };
      case 'explain': return { pos: at(-0.07 - 0.02 * k, 0.15 - 0.02 * k, 0.07), nrm: palm(12), fwd: v(-0.2, 0.2, 1), shape: 'relaxed' };
      case 'offer': return { pos: at(0, 0.12, 0.06 + 0.04 * k), nrm: palm(-50), fwd: v(0.12, 0.08, 1), shape: 'open' };
      case 'open': return { pos: at(0.04, 0.14, 0.06), nrm: palm(-45), fwd: v(0.15, 0.1, 1), shape: 'open' };
      case 'wide': return { pos: at(0.05 + 0.06 * k, 0.15, 0.05), nrm: palm(25), fwd: v(0.25, 0.25, 1), shape: 'open' };
      case 'contrast': return { pos: at(0.06 + 0.05 * k, 0.13, 0.06), nrm: palm(-35), fwd: v(0.3, 0.1, 1), shape: 'open' };
      case 'present': return { pos: at(-0.03, 0.14, 0.08 + 0.04 * k), nrm: palm(-40), fwd: v(-0.1, 0.1, 1), shape: 'open' };
      case 'ring': return { pos: at(-0.07, 0.18 - 0.02 * k, 0.05), nrm: palm(15), fwd: v(-0.25, 0.55, 1), shape: 'ring' };
      case 'count': return { pos: at(-0.08, 0.19, 0.05 + 0.02 * k), nrm: palm(10), fwd: v(-0.25, 0.8, 0.55), shape: 'count' + clamp(c.n || 1, 1, 5) };
      case 'point': {
        const d = (c.dir || new V3(0, 0.4, 1)).clone().normalize();
        // in front: the index finger toward it; behind the host: an open hand back over the shoulder
        if (d.z > 0.15) return { pos: new V3(sg * 0.2, this.deskY + 0.28, 0.24).addScaledVector(d, 0.22), nrm: palm(80), fwd: d, shape: 'point' };
        return { pos: new V3(sg * 0.3, this.deskY + 0.24, 0.2), nrm: palm(-20), fwd: v(0.85, 0.35, -0.3), shape: 'open' };
      }
      // a tablet in this hand: cradled on the palm and forearm at the side of the waist, the screen tilted up toward the face
      case 'tablet': return { pos: new V3(sg * 0.15, this.deskY + 0.1, 0.24), nrm: palm(-60), fwd: v(-0.55, 0.1, 0.8), shape: 'relaxed' };
      // the other hand, not gesturing: hanging easily at the side (never clasped over the tablet)
      case 'side': return { pos: new V3(sg * (this.shoulderWidth * 0.5 + 0.05), this.hipRestY - 0.04, 0.05), nrm: palm(8), fwd: v(0.05, -1, 0.12), shape: 'relaxed' };
      // a hard hat by the brim, the arm hanging easily at the side
      case 'helmet': return { pos: new V3(sg * (this.shoulderWidth * 0.5 + 0.08), this.hipRestY - 0.08, 0.04), nrm: palm(0), fwd: v(0, -1, 0.15), shape: 'grip' };
      // arms folded: each hand to the other arm, the left forearm over the right
      case 'fold': {
        const chestY = this.eyeY - 0.43, top = s === 'Left';
        return { pos: new V3(-sg * 0.12, chestY - (top ? 0 : 0.035), top ? 0.2 : 0.155), nrm: palm(0, -1.4), fwd: v(-1, 0.05, -0.35), shape: 'relaxed' };
      }
      default: return { pos: rest.pos.add(this.state.restShift[s]), nrm: rest.nrm, fwd: rest.fwd, shape: 'desk' };
    }
  }
  /* where the elbow points: down and back, or out and forward with the arms folded */
  _armPole(s) {
    const sg = s === 'Left' ? 1 : -1;
    return new V3(sg * 0.32, -0.72, -0.6).lerp(new V3(sg * 0.9, -0.45, 0.15), this.state.foldW).normalize();
  }
  /* each prop follows the hand holding it; with the arms folded a hard hat is tucked under the arm */
  _placeProps() {
    const P = this.props; if (!P.Left && !P.Right) return;
    const b = this.bones; this.root.updateMatrixWorld(true);
    const rq = this.root.getWorldQuaternion(new QT()), irq = rq.clone().invert(), fw = Z.clone().applyQuaternion(rq);
    for (const [s, p] of Object.entries(P)) {
      if (!b[s + 'HandMiddle1']) continue;
      const { f, n } = this._handFrame(s), sg = s === 'Left' ? 1 : -1;
      const W = b[s + 'Hand'].getWorldPosition(new V3()).lerp(b[s + 'HandMiddle1'].getWorldPosition(new V3()), 0.5);
      let pos, yAx, zAx;
      if (p.kind === 'tablet') { pos = W.addScaledVector(f, 0.05).addScaledVector(n, 0.018); yAx = n.clone(); zAx = f.clone(); }
      else { pos = W.addScaledVector(n, -0.1).addScaledVector(f, 0.02); yAx = n.clone().negate(); zAx = fw.clone(); }
      yAx.normalize(); zAx.projectOnPlane(yAx).normalize();
      const q = new QT().setFromRotationMatrix(new THREE.Matrix4().makeBasis(yAx.clone().cross(zAx), yAx, zAx)).premultiply(irq);
      const lp = this.root.worldToLocal(pos);
      const k = p.kind === 'helmet' ? curves.easeInOut(this.state.foldW) : 0;
      if (k > 0) {                                               // pinned against the hip by the elbow, crown outward
        const tuck = new V3(sg * (this.hipWidth * 0.5 + 0.15), this.eyeY - 0.6, -0.02), tq = new QT().setFromUnitVectors(Y, new V3(sg, 0, 0));
        lp.lerp(tuck, k); q.slerp(tq, k);
      }
      p.obj.position.copy(lp); p.obj.quaternion.copy(q);
    }
  }
  _planHands(dt, talking, lt) {
    const S = this.state, t = S.t;
    if (S.gesture && t > S.gestureEnd) { if (S.gesture.kind === 'drink') this._endDrink(); S.gesture = null; }
    const g = S.gesture;
    this._drinkHold = false;
    if (g?.kind === 'drink') this._planDrink();
    const cue = talking && !g ? this._cueAt(lt) : null;
    // between lines, the hands now and then settle somewhere slightly different on the desk
    if (!talking && t > S.nextRestShift) {
      for (const s of ['Left', 'Right']) S.restShift[s].set((Math.random() - .5) * 0.05, 0, (Math.random() - .5) * 0.04);
      S.restKey++; S.nextRestShift = t + 7 + Math.random() * 9;
    }
    const legacy = { beatL: 'beat', beatR: 'beat', explain: 'explain', open: 'open', count: 'count', point: 'point' };
    // arms folded: a listening habit (never while talking, walking, or with a tablet in hand), or when cued
    if (talking) S.lastTalk = t;
    const canFold = this.standing && !this.act && !this._holding('Left') && this._holding('Right') !== 'tablet';
    if (t > S.nextFold) { S.fold = !talking && t - S.lastTalk > 1.2 && Math.random() < this.foldHabit; S.nextFold = t + (S.fold ? 7 : 5) + Math.random() * 7; }
    if (talking && S.fold && t - S.lastTalk < 0.05 && cue) S.fold = false;           // unfold to make the first gesture
    const folded = canFold && (S.foldCue ?? S.fold) && !g;
    S.foldW += ((folded ? 1 : 0) - S.foldW) * Math.min(1, dt * 2.5);
    const held = this._holding('Left') ? 'Left' : this._holding('Right') ? 'Right' : null, free = held === 'Left' ? 'Right' : 'Left';
    for (const s of ['Left', 'Right']) {
      const H = S.hands[s];
      if (g?.kind === 'drink' && s === g.data.side && this._drinkTarget) {
        const d = this._drinkTarget; H.p.chase(d.pos, dt, d.freq); H.n.chase(d.nrm, dt, d.freq); H.f.chase(d.fwd, dt, d.freq);
        H.key = 'drink'; H.shape = this._drinkHold ? 'grip' : 'relaxed'; continue;
      }
      let pose = null, key = '', T = 0.5;
      if (g && legacy[g.kind]) {
        const one = g.kind === 'point' ? (g.data.side || 'Right') : g.kind === 'beatL' ? 'Left' : g.kind === 'beatR' || g.kind === 'count' ? 'Right' : null;
        if (!one || one === s) { pose = this._pose(legacy[g.kind], 'stroke', s, { ...g.data, n: g.data.n || 3 }); key = 'g:' + g.kind; T = 0.55; }
      } else if (folded) { pose = this._pose('fold', '', s); key = 'fold'; T = 0.9; }
      else if (held === s) { const k = this._holding(s); pose = this._pose(k, '', s); key = 'hold:' + k; T = 0.7; }  // the hand with the prop keeps it
      else if (cue && (cue.both || cue.side === s || (held && cue.side === held && s === free))) {       // a one-handed gesture goes to the free hand
        if (cue.phase === 'home') { pose = this._pose('home', '', s); key = 'home'; T = 0.45; }
        else { pose = this._pose(cue.kind, cue.phase, s, cue); key = cue.id + cue.phase; T = cue.T; }
      }
      if (!pose && held && this._holding(held) === 'tablet') { pose = this._pose('side', '', s); key = 'side'; T = 0.7; }
      if (!pose) { pose = this._pose('rest', '', s); key = 'rest' + S.restKey; T = 0.35 + H.p.p.distanceTo(pose.pos) * 1.4; }
      if (key !== H.key) {
        H.p.to(pose.pos, T); H.n.to(pose.nrm, T); H.f.to(pose.fwd, T); H.key = key; H.shape = pose.shape;
        if (cue?.phase === 'stroke' && key === cue.id + 'stroke') this.bodySys.gesture(s, cue.kind === 'beat' ? 0.6 : 1);   // the body goes with the gesture
      }
      H.p.update(dt); H.n.update(dt); H.f.update(dt);
    }
  }

  /* drink: reach → lift → sip → put back → release, all in root space. The hand takes the bottle
     from the outside with the thumb up (forearm neutral), the way people hold a bottle. */
  _planDrink() {
    const S = this.state, G = S.gesture, d = G.data, u = (S.t - S.gestureStart) / (S.gestureEnd - S.gestureStart);
    const sg = d.side === 'Left' ? 1 : -1;
    const home = this.root.worldToLocal(d.homeW.clone());
    const grip = home.clone().add(new V3(sg * 0.045, 0.1, -0.01));
    const head = this.root.worldToLocal(this.bones.Head.getWorldPosition(new V3()));
    const mouth = new V3(sg * 0.05, head.y - 0.02, head.z + 0.17);
    const palmIn = new V3(-sg, 0, 0), fwdFlat = new V3(-sg * 0.1, 0.05, 1).normalize(), fwdUp = new V3(-sg * 0.25, 0.9, 0.35).normalize();
    let pos, fwd = fwdFlat, freq = 2.2, tilt = 0;
    if (u < 0.2) { pos = grip; }
    else if (u < 0.34) { const k = smooth((u - 0.2) / 0.14); pos = grip.clone().lerp(mouth, k); }
    else if (u < 0.6) { const k = smooth(clamp((u - 0.34) / 0.1, 0, 1)) * (1 - smooth(clamp((u - 0.52) / 0.08, 0, 1))); pos = mouth.clone(); fwd = fwdFlat.clone().lerp(fwdUp, k).normalize(); tilt = k; }
    else if (u < 0.76) { const k = smooth((u - 0.6) / 0.16); pos = mouth.clone().lerp(grip, k); }
    else { pos = grip.clone().add(new V3(sg * 0.03, 0.06, -0.04)); freq = 1.4; }
    this._drinkHold = u > 0.17 && u < 0.78;
    S.drinkTilt += (tilt - S.drinkTilt) * 0.2;
    this._drinkTarget = { pos, nrm: palmIn, fwd, freq };
  }
  _carryBottle() {
    const d = this.state.gesture.data, bottle = d.bottle, s = d.side;
    if (!this._drinkHold) { bottle.position.copy(d.home.p); bottle.quaternion.copy(d.home.q); return; }
    const b = this.bones, hand = b[s + 'Hand'].getWorldPosition(new V3());
    const mid = b[s + 'HandMiddle1'] ? b[s + 'HandMiddle1'].getWorldPosition(new V3()) : hand;
    const { n, l } = this._handFrame(s);
    const upAxis = l.clone().normalize();                         // across the knuckles toward the thumb: the bottle's axis
    const gripW = hand.clone().lerp(mid, 0.6).addScaledVector(n, 0.045);
    const baseW = gripW.clone().addScaledVector(upAxis, -0.1);
    const parent = bottle.parent; parent.updateMatrixWorld(true);
    bottle.position.copy(parent.worldToLocal(baseW));
    const pq = parent.getWorldQuaternion(new QT()).invert();
    bottle.quaternion.setFromUnitVectors(Y, upAxis.applyQuaternion(pq).normalize());
  }

  /* morph weights, smoothed: the mouth over ~30 ms (coarticulation), expressions over ~100 ms;
     blinks keep their own timing */
  _applyMorphs(W, dt = 1 / 30) {
    if (!this._managed) this._managed = Object.keys(this.morphs).filter(k => /^viseme_|^eyeBlink|^jawOpen|^mouthSmile|^brow|^eyeSquint|^eyeWide|^cheekSquint|^mouthPress|^mouthDimple|^mouthPucker|^mouthRollLower/.test(k));
    const cur = this._mw ||= {};
    for (const k of this._managed) {
      const want = W[k] || 0, tau = /^eyeBlink/.test(k) ? 0 : /^viseme_|^jawOpen|^mouthPucker/.test(k) ? 0.03 : 0.1;
      const v = tau ? (cur[k] ?? want) + (want - (cur[k] ?? want)) * (1 - Math.exp(-dt / tau)) : want;
      cur[k] = v; for (const [m, i] of this.morphs[k]) m.morphTargetInfluences[i] = v;
    }
  }
}
