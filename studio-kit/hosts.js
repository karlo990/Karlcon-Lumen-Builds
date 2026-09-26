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
     emphasis, blinks with real lid timing, more of them at pauses and gaze shifts. */
import * as THREE from 'three';
import { LipsyncEn } from './lipsync-en.mjs';

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
   */
  constructor(o) {
    Object.assign(this, { mouthGain: o.mouthGain ?? 0.85, id: o.id, name: o.name, seatY: o.seatY ?? 0.47, deskY: o.deskY ?? 0.75, deskZ: o.deskZ ?? 0.42, seed: o.seed ?? Math.random() * 10, expressive: o.expressive ?? 1 });
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
      drinkTilt: 0
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
    // sit: drop the whole model so the pelvis lands on the seat
    this.model.position.y = (this.seatY + 0.085) - this.hipRestY;
  }

  /* resting wrist target on the desk, root space */
  handRest(side) {
    const sg = side === 'Left' ? 1 : -1;
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

  /* ---------- per-frame ---------- */
  update(dt, now) {
    const S = this.state, b = this.bones; S.t += dt; const t = S.t;
    // reset to bind pose
    for (const [k, q] of Object.entries(this.rest)) b[k].quaternion.copy(q);
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
    rotateWorld(b.Hips, _qc.setFromAxisAngle(up, S.turn * 0.55));
    rotateWorld(b.Hips, _qc.setFromAxisAngle(fwd, S.shift));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(up, S.turn * 0.45));
    rotateWorld(b.Spine1, _qc.setFromAxisAngle(fwd, -S.shift * 0.8));
    rotateWorld(b.Hips, _qc.setFromAxisAngle(right, -0.04));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(right, S.lean));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(up, wave(t * 0.4, this.seed + 2) * 0.03 * (1 + S.energy)));
    rotateWorld(b.Spine1, _qc.setFromAxisAngle(right, breath * 0.012 + 0.02));
    rotateWorld(b.Spine2, _qc.setFromAxisAngle(right, -breath * 0.018 - 0.04));
    rotateWorld(b.Spine2, _qc.setFromAxisAngle(fwd, wave(t * 0.5, this.seed + 7) * 0.02));
    // posture: whatever the motion capture brings, the trunk keeps a desk presenter's lean (at most ~15° forward)
    { const cf = this._fwdOf('Spine2').applyQuaternion(rq.clone().invert()), cp = yawPitch(cf).p, fix = soft(cp, -16 * DEG, 4 * DEG) - cp;
      if (Math.abs(fix) > 1e-4) { const cr = Y.clone().cross(cf.applyQuaternion(rq)).normalize(); rotateWorld(b.Spine, _qc.setFromAxisAngle(cr, -fix * 0.5)); rotateWorld(b.Spine1, _qc.setFromAxisAngle(cr, -fix * 0.5)); } }

    /* legs: feet planted in front of the chair */
    for (const s of ['Left', 'Right']) {
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
      if (H.key !== 'drink' && !H.key.startsWith('rest')) pos.y += wave(t * 1.3, this.seed + (sg > 0 ? 1 : 2)) * 0.006 * S.energy;
      // the shoulder girdle rises a little as the hand rises (scapulohumeral rhythm)
      const elev = clamp((pos.y - (this.deskY + 0.1)) * 0.45, 0, 0.09);
      if (b[s + 'Shoulder']) rotateWorld(b[s + 'Shoulder'], _qc.setFromAxisAngle(fwd, -sg * (0.12 + breath * 0.008 - elev)));
      this._ik(s + 'Arm', s + 'ForeArm', s + 'Hand', s + 'Arm', s + 'ForeArm', P(pos), R(new V3(sg * 0.32, -0.72, -0.6).normalize()));
      this._alignHand(s, R(H.f.p.clone().normalize()), R(H.n.p.clone().normalize()), rq);
      this._fingers(s, this._fingerPose(s, dt));
    }
    if (S.gesture?.kind === 'drink') this._carryBottle();

    /* head, neck and eyes */
    S.nodV += (-S.nod * 60 - S.nodV * 9) * dt; S.nod += S.nodV * dt;
    this._gaze(dt, t, gaze, rq);

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
    const d = this.root.worldToLocal(S.lookAt.clone()).sub(this.root.worldToLocal(eyeW.clone()));
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
    const relY = wrap(goal.y - chest.y), relP = goal.p - chest.p;
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
    rotateWorld(b.Head, _qc.setFromAxisAngle(hr, S.nod * 0.5 - S.drinkTilt * 0.24));
    if (S.drinkTilt) rotateWorld(b.Neck, _qc.setFromAxisAngle(hr, -S.drinkTilt * 0.12));
    // side tilt: half of whatever the motion capture brought, plus a little with speech, kept small
    { const f2 = fwdOf('Head'), roll = signedAngle(upOf('Spine2'), upOf('Head'), f2);
      const want = soft(roll * 0.5 + wave(t * 0.45, this.seed + 11) * 0.035 * (0.5 + S.energy), -LIM.neckRoll, LIM.neckRoll);
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
      default: return { pos: rest.pos.add(this.state.restShift[s]), nrm: rest.nrm, fwd: rest.fwd, shape: 'desk' };
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
      } else if (cue && (cue.both || cue.side === s)) {
        if (cue.phase === 'home') { pose = this._pose('home', '', s); key = 'home'; T = 0.45; }
        else { pose = this._pose(cue.kind, cue.phase, s, cue); key = cue.id + cue.phase; T = cue.T; }
      }
      if (!pose) { pose = this._pose('rest', '', s); key = 'rest' + S.restKey; T = 0.35 + H.p.p.distanceTo(pose.pos) * 1.4; }
      if (key !== H.key) { H.p.to(pose.pos, T); H.n.to(pose.nrm, T); H.f.to(pose.fwd, T); H.key = key; H.shape = pose.shape; }
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
