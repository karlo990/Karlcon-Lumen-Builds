/* KARLCON Studio — animated presenters.
   Drives any Mixamo / Ready-Player-Me style GLB avatar (Avaturn, AvatarSDK MetaPerson,
   MPFB/MakeHuman exported for TalkingHead) that has:
     bones  Hips, Spine, Spine1, Spine2, Neck, Head, LeftEye/RightEye, Left/Right Arm/ForeArm/Hand, UpLeg/Leg/Foot/ToeBase
     morphs viseme_* (Oculus), eyeBlinkLeft/Right, jawOpen, mouthSmile*, browInnerUp (optional)
   Everything is solved in world space (two-bone IK, look-at, hand alignment), so it does not
   depend on each rig's local bone axes — a new avatar can be dropped in without re-tuning. */
import * as THREE from 'three';
import { LipsyncEn } from './lipsync-en.mjs';

const V3 = THREE.Vector3, QT = THREE.Quaternion;
const X = new V3(1, 0, 0), Y = new V3(0, 1, 0), Z = new V3(0, 0, 1);
const lipsync = new LipsyncEn();

/* ---------- small maths helpers ---------- */
const _qa = new QT(), _qb = new QT(), _qc = new QT();
const _va = new V3(), _vb = new V3(), _vc = new V3(), _vd = new V3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => t * t * (3 - 2 * t);
/* smooth pseudo-random signal in [-1,1] */
function wave(t, seed) {
  return (Math.sin(t * 0.63 + seed * 1.7) * 0.5 + Math.sin(t * 1.37 + seed * 3.1) * 0.3 + Math.sin(t * 2.71 + seed * 5.3) * 0.2);
}
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

/* ---------- viseme shaping ---------- */
const VIS_GAIN = { aa: .72, E: .55, I: .5, O: .7, U: .62, PP: .9, FF: .75, TH: .55, DD: .5, kk: .5, CH: .6, SS: .5, nn: .45, RR: .5, sil: 0 };
const VIS_JAW = { aa: .16, E: .1, I: .06, O: .13, U: .07, CH: .04, SS: .02, DD: .05, kk: .06, nn: .04, RR: .05, TH: .05, FF: 0, PP: 0 };

export class Host {
  /**
   * @param {object} o
   * @param {string} o.id        'luma' | 'karl'
   * @param {string} o.name      Display name
   * @param {THREE.Object3D} o.model  loaded gltf.scene
   * @param {number} o.seatY     top of the chair seat (m)
   * @param {number} o.deskY     top of the desk (m)
   * @param {number} o.deskZ     distance from hips to where the wrists rest (m, forward)
   */
  constructor(o) {
    Object.assign(this, { mouthGain: o.mouthGain ?? 0.85, id: o.id, name: o.name, seatY: o.seatY ?? 0.47, deskY: o.deskY ?? 0.75, deskZ: o.deskZ ?? 0.42, seed: o.seed ?? Math.random() * 10 });
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
      t: 0, speaking: false, lookAt: new V3(0, 1.2, 3), lookCur: null, lookVel: new V3(),
      eyeOff: new V3(), nextSaccade: 0, blink: 0, nextBlink: 1 + Math.random() * 3, blinkT: -1,
      nod: 0, nodV: 0, lean: 0, leanV: 0, smile: 0.12, brow: 0, energy: 0,
      hands: {}, gesture: null, gestureEnd: 0, nextGesture: 0
    };
    for (const s of ['Left', 'Right']) {
      const rest = this.handRest(s);
      this.state.hands[s] = { pos: rest.pos.clone(), vel: new V3(), nrm: rest.nrm.clone(), nvel: new V3(), fwd: rest.fwd.clone(), fvel: new V3() };
    }
    this.visemes = []; this.words = []; this.onWord = null;
  }

  /* measure the rig in its bind pose (root at origin, unrotated) */
  _measure() {
    const b = this.bones;
    this.root.updateMatrixWorld(true);
    this.rest = {};
    for (const [k, bone] of Object.entries(b)) this.rest[k] = bone.quaternion.clone();
    this.restWorldQ = {};
    for (const k of ['Head', 'Neck', 'LeftEye', 'RightEye']) if (b[k]) this.restWorldQ[k] = b[k].getWorldQuaternion(new QT());
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
      nrm: new V3(sg * 0.6, -0.8, 0).normalize(),              // palm down and turned inward, relaxed
      fwd: new V3(-sg * 0.28, -0.12, 1).normalize()             // fingers forward, turned in
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
    this.plan = plan; this.planStart = now; this.state.speaking = true;
    this.words = plan.words; this.wordIdx = -1;
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
  stopSpeech() { this.plan = null; this.state.speaking = false; }
  get speaking() { return this.state.speaking; }

  /* ---------- performance cues ---------- */
  look(target) { this.state.lookAt.copy(target); }
  nod(amount = 1) { this.state.nodV += 2.2 * amount; }
  setSmile(v) { this.state.smile = v; }
  gesture(kind, dur = 1.6, data = {}) { this.state.gesture = { kind, data }; this.state.gestureEnd = this.state.t + dur; }

  /* ---------- per-frame ---------- */
  update(dt, now) {
    const S = this.state, b = this.bones; S.t += dt; const t = S.t;
    // reset to bind pose
    for (const [k, q] of Object.entries(this.rest)) b[k].quaternion.copy(q);
    this.root.updateMatrixWorld(true);

    const rq = this.root.getWorldQuaternion(new QT());
    const R = (v) => v.clone().applyQuaternion(rq);         // root → world direction
    const P = (v) => this.root.localToWorld(v.clone());      // root → world point
    const right = R(X), up = Y.clone(), fwd = R(Z);

    // speech timeline
    let active = [], wordNow = null;
    if (this.plan) {
      const lt = now - this.planStart;
      if (lt > this.plan.total + 0.25) { /* estimated end — speech engine will stop us */ }
      for (let i = 0; i < this.words.length; i++) {
        const w = this.words[i];
        if (lt >= w.s - 0.05 && lt <= w.s + w.d + 0.08) {
          wordNow = w;
          for (const e of w.vis) { const s = w.s + e.s; if (lt >= s - 0.06 && lt <= s + e.d + 0.07) active.push([e, lt - s]); }
          if (i !== this.wordIdx) { this.wordIdx = i; if (w.stress && Math.random() < 0.55) this.nod(0.35 + Math.random() * 0.4); this.onWord?.(i, w); }
        }
      }
    }
    const talking = S.speaking && !!this.plan;
    S.energy += ((talking ? 1 : 0) - S.energy) * Math.min(1, dt * 3);

    /* torso: seated lean, breathing, sway */
    const breath = Math.sin(t * 2 * Math.PI * 0.24 + this.seed);
    S.leanV += (((talking ? 0.07 : 0.035) + wave(t * 0.35, this.seed) * 0.02) - S.lean) * dt * 4; S.lean += S.leanV * dt; S.leanV *= 0.9;
    rotateWorld(b.Hips, _qc.setFromAxisAngle(right, -0.04));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(right, S.lean));
    rotateWorld(b.Spine, _qc.setFromAxisAngle(up, wave(t * 0.4, this.seed + 2) * 0.03 * (1 + S.energy)));
    rotateWorld(b.Spine1, _qc.setFromAxisAngle(right, breath * 0.012 + 0.02));
    rotateWorld(b.Spine2, _qc.setFromAxisAngle(right, -breath * 0.018 - 0.04));
    rotateWorld(b.Spine2, _qc.setFromAxisAngle(fwd, wave(t * 0.5, this.seed + 7) * 0.02));

    /* legs: feet planted in front of the chair */
    for (const s of ['Left', 'Right']) {
      const sg = s === 'Left' ? 1 : -1;
      const foot = P(new V3(sg * (this.hipWidth * 0.62 + 0.03), this.ankleY, 0.43 + (sg > 0 ? 0.02 : -0.01)));
      this._ik(s + 'UpLeg', s + 'Leg', s + 'Foot', s + 'UpLeg', s + 'Leg', foot, R(new V3(sg * 0.18, 0.45, 1).normalize()));
      if (b[s + 'ToeBase']) aim(b[s + 'Foot'], b[s + 'ToeBase'], R(new V3(sg * 0.12, -0.42, 1).normalize()));
    }

    /* arms: IK to the hand targets (desk rest or gesture) */
    this._planHands(dt, talking);
    for (const s of ['Left', 'Right']) {
      const sg = s === 'Left' ? 1 : -1, H = S.hands[s];
      if (b[s + 'Shoulder']) rotateWorld(b[s + 'Shoulder'], _qc.setFromAxisAngle(fwd, -sg * (0.12 + breath * 0.008)));
      this._ik(s + 'Arm', s + 'ForeArm', s + 'Hand', s + 'Arm', s + 'ForeArm', P(H.pos), R(new V3(sg * 0.32, -0.72, -0.6).normalize()));
      this._alignHand(s, R(H.fwd).normalize(), R(H.nrm).normalize());
      this._fingers(s, 0.36 + (1 - S.energy) * 0.1);
    }

    /* head + neck look-at, nods */
    if (!S.lookCur) S.lookCur = S.lookAt.clone();
    springV(S.lookCur, S.lookVel, S.lookAt, dt, 1.1);
    S.nodV += (-S.nod * 60 - S.nodV * 9) * dt; S.nod += S.nodV * dt;
    this._lookHead(S.lookCur, right, up, fwd, t);

    /* eyes: follow the look target with micro-saccades */
    if (t > S.nextSaccade) { S.eyeOff.set((Math.random() - .5) * 0.07, (Math.random() - .5) * 0.04, 0); S.nextSaccade = t + 0.4 + Math.random() * 1.8; }
    const eyeT = S.lookCur.clone().add(S.eyeOff.clone().applyQuaternion(rq));
    for (const e of ['LeftEye', 'RightEye']) if (b[e]) this._lookBone(b[e], this.restWorldQ[e], eyeT, 0.5, 0.35, 1);

    /* face: blink, visemes, jaw, smile, brows */
    if (S.blinkT < 0 && t > S.nextBlink) { S.blinkT = 0; S.nextBlink = t + 1.6 + Math.random() * 3.8; if (Math.random() < 0.15) S.nextBlink = t + 0.35; }
    if (S.blinkT >= 0) { S.blinkT += dt; const u = S.blinkT / 0.16; S.blink = u < 0.45 ? smooth(u / 0.45) : u < 1 ? 1 - smooth((u - 0.45) / 0.55) : 0; if (u >= 1) S.blinkT = -1; }
    const W = {};
    const add = (k, v) => { W[k] = Math.min(1, (W[k] || 0) + v); };
    for (const [e, lt] of active) {
      const env = clamp(Math.min((lt + 0.06) / 0.07, (e.d + 0.07 - lt) / 0.08), 0, 1);
      const g = (VIS_GAIN[e.v] ?? .5) * env * this.mouthGain;
      add('viseme_' + e.v, g); add('jawOpen', (VIS_JAW[e.v] ?? .1) * env);
    }
    const look = S.lookCur.clone(); const hy = b.Head.getWorldPosition(_va).y;
    const down = clamp((hy - look.y) * 0.6, 0, 0.35);
    add('eyeBlinkLeft', S.blink + down * 0.5); add('eyeBlinkRight', S.blink + down * 0.5);
    add('eyeSquintLeft', S.smile * 0.35); add('eyeSquintRight', S.smile * 0.35);
    const sm = S.smile * (talking ? 0.55 : 1) + (wave(t * 0.2, this.seed) * 0.04);
    if (this.morphs.mouthSmile) add('mouthSmile', sm); else { add('mouthSmileLeft', sm); add('mouthSmileRight', sm); }
    S.brow += ((talking && wordNow?.stress ? 0.45 : 0.05) - S.brow) * Math.min(1, dt * 6);
    add('browInnerUp', S.brow * 0.4); add('browOuterUpLeft', S.brow * 0.3); add('browOuterUpRight', S.brow * 0.3);
    this._applyMorphs(W);
  }

  _ik(uName, lName, eName, uLen, lLen, targetW, poleW) {
    const b = this.bones, u = b[uName], l = b[lName], e = b[eName];
    const A = u.getWorldPosition(new V3());
    const a = this.len[uLen], c = this.len[lLen];
    const d = targetW.clone().sub(A); const dist = clamp(d.length(), 0.05, (a + c) * 0.995); const dir = d.normalize();
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
    return { f, n: n.normalize() };
  }
  _alignHand(s, fT, nT) {
    const b = this.bones;
    if (!b[s + 'HandMiddle1'] || !b[s + 'HandIndex1'] || !b[s + 'HandPinky1']) return;
    let { f, n } = this._handFrame(s);
    // share the wrist twist with the forearm to avoid a "candy-wrapper" wrist
    const q1 = new QT().setFromUnitVectors(f, fT);
    const tw = signedAngle(n.clone().applyQuaternion(q1), nT, fT);
    const axis = b[s + 'Hand'].getWorldPosition(new V3()).sub(b[s + 'ForeArm'].getWorldPosition(new V3())).normalize();
    rotateWorld(b[s + 'ForeArm'], new QT().setFromAxisAngle(axis, tw * 0.55));
    ({ f, n } = this._handFrame(s));
    const qa = new QT().setFromUnitVectors(f, fT);
    const n1 = n.clone().applyQuaternion(qa);
    const qb = new QT().setFromAxisAngle(fT, signedAngle(n1, nT, fT));
    rotateWorld(b[s + 'Hand'], qb.multiply(qa));
  }
  _fingers(s, curl) {
    const b = this.bones; if (!b[s + 'HandMiddle1']) return;
    const { f, n } = this._handFrame(s);
    const axis = f.clone().cross(n).normalize();
    const S = this.state; const t = S.t;
    const per = { Index: 0.75, Middle: 0.95, Ring: 1.1, Pinky: 1.25 };
    for (const [fn, k] of Object.entries(per)) for (let i = 1; i <= 3; i++) {
      const bone = b[`${s}Hand${fn}${i}`]; if (!bone) continue;
      const amt = curl * k * (i === 1 ? 0.8 : 1.05) + wave(t * 0.3, this.seed + i + k) * 0.03;
      rotateWorld(bone, _qc.setFromAxisAngle(axis, amt));
    }
    for (let i = 2; i <= 3; i++) { const bone = b[`${s}HandThumb${i}`]; if (bone) rotateWorld(bone, _qc.setFromAxisAngle(axis, curl * 0.45)); }
  }

  /* rotate a bone so its rest-forward (+Z of the model) points at target, clamped */
  _lookBone(bone, restQ, target, maxYaw, maxPitch, weight) {
    const pos = bone.getWorldPosition(new V3());
    const q = bone.getWorldQuaternion(new QT());
    const cur = Z.clone().applyQuaternion(restQ.clone().invert()).applyQuaternion(q).normalize();
    // clamp target direction relative to the body facing
    const rq = this.root.getWorldQuaternion(new QT()), irq = rq.clone().invert();
    const dl = target.clone().sub(pos).normalize().applyQuaternion(irq);
    let yaw = Math.atan2(dl.x, dl.z), pitch = Math.asin(clamp(dl.y, -1, 1));
    yaw = clamp(yaw, -maxYaw, maxYaw); pitch = clamp(pitch, -maxPitch, maxPitch);
    const want = new V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(rq);
    const d = new QT().setFromUnitVectors(cur, want);
    if (weight < 1) d.slerp(new QT(), 1 - weight);
    rotateWorld(bone, d);
  }
  _lookHead(target, right, up, fwd, t) {
    const b = this.bones, S = this.state;
    const tgt = target.clone().addScaledVector(up, wave(t * 0.7, this.seed + 4) * 0.02).addScaledVector(right, wave(t * 0.6, this.seed + 9) * 0.03);
    this._lookBone(b.Neck, this.restWorldQ.Neck, tgt, 1.2, 0.5, 0.4);
    this._lookBone(b.Head, this.restWorldQ.Head, tgt, 1.2, 0.5, 1);
    // nod + subtle tilt while talking
    rotateWorld(b.Head, _qc.setFromAxisAngle(right, S.nod * 0.5));
    rotateWorld(b.Head, _qc.setFromAxisAngle(fwd, wave(t * 0.45, this.seed + 11) * 0.035 * (0.5 + S.energy)));
  }

  /* hand targets: rest on the desk, gesture while talking */
  _planHands(dt, talking) {
    const S = this.state, t = S.t;
    if (talking && t > S.nextGesture && (!S.gesture || t > S.gestureEnd)) {
      const r = Math.random();
      const kinds = ['open', 'explain', 'beatL', 'beatR', 'open', 'count'];
      this.gesture(kinds[Math.floor(r * kinds.length)], 1.1 + Math.random() * 1.4);
      S.nextGesture = t + 1.4 + Math.random() * 1.8;
    }
    if (S.gesture && t > S.gestureEnd) S.gesture = null;
    const g = S.gesture?.kind;
    for (const s of ['Left', 'Right']) {
      const sg = s === 'Left' ? 1 : -1, rest = this.handRest(s), H = S.hands[s];
      let pos = rest.pos.clone(), nrm = rest.nrm.clone(), fw = rest.fwd.clone(), freq = 1.3;
      const lift = (dx, dy, dz) => pos.add(new V3(sg * dx, dy, dz));
      if (g === 'open') { lift(0.08, 0.2, 0.06); nrm.set(sg * 0.55, 0.65, 0.3).normalize(); fw.set(sg * 0.25, 0.25, 1).normalize(); freq = 1.6; }
      else if (g === 'explain') { lift(-0.1, 0.17, 0.04); nrm.set(-sg * 0.95, 0.1, 0.1).normalize(); fw.set(-sg * 0.15, 0.3, 1).normalize(); freq = 1.5; }
      else if (g === 'count' && s === 'Right') { lift(0.02, 0.26, 0.02); nrm.set(0, 0.15, -1).normalize(); fw.set(0, 1, 0.25).normalize(); freq = 1.7; }
      else if ((g === 'beatL' && s === 'Left') || (g === 'beatR' && s === 'Right')) { lift(0.03, 0.12 + Math.max(0, Math.sin(t * 7)) * 0.05, 0.03); nrm.set(sg * 0.7, 0.2, 0.1).normalize(); fw.set(-sg * 0.1, 0.1, 1).normalize(); freq = 2; }
      else if (g === 'point' && s === (S.gesture.data.side || 'Right')) {
        const d = (S.gesture.data.dir || new V3(0, 0.4, 1)).clone().normalize();
        pos.set(sg * 0.2, this.deskY + 0.3, 0.22).addScaledVector(d, 0.28); nrm.set(sg * 0.2, -0.5, 0).normalize(); fw.copy(d); freq = 1.4;
      }
      if (talking) pos.y += wave(t * 1.3, this.seed + (sg > 0 ? 1 : 2)) * 0.012 * S.energy;
      springV(H.pos, H.vel, pos, dt, freq); springV(H.nrm, H.nvel, nrm, dt, freq); springV(H.fwd, H.fvel, fw, dt, freq);
    }
  }

  _applyMorphs(W) {
    if (!this._managed) this._managed = Object.keys(this.morphs).filter(k => /^viseme_|^eyeBlink|^jawOpen|^mouthSmile|^browInnerUp|^browOuterUp|^eyeSquint/.test(k));
    for (const k of this._managed) { const v = W[k] || 0; for (const [m, i] of this.morphs[k]) m.morphTargetInfluences[i] = v; }
  }
}
