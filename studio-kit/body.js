/* KARLCON Studio — the body as one system while a presenter talks and listens.
   The hands already gesture on the words (hosts.js). This moves everything else with them, the way a
   person's trunk takes part in speech instead of standing still under a talking head:
     · emphasis (a stressed word): a small lean in and a lift of the chest, then back — the "beat"
     · a gesture: the shoulder on that side comes forward with the arm and the chest turns a little
       toward it; the pelvis answers a fraction the other way (counter-rotation)
     · a question: the head tilts, both shoulders lift a touch and the trunk leans in
     · a contrast ("but…"): a one-sided shrug and a turn of the chest
     · the end of a sentence: an out-breath — the chest drops, the shoulders settle, sometimes the
       weight moves to the other leg
     · all the time: breathing (faster and deeper while talking), and a slow sway that is never the
       same twice (a sum of incommensurate sines) and never symmetrical
   Every channel is a damped spring driven by these events, so movements rise, overshoot a little
   and settle, and different parts respond at different speeds (chest quicker than pelvis).
   Informed by speech-gesture research: gestures and posture shifts are organised around the prosody
   of speech (McNeill 1992; Cassell et al., BEAT 2001; the GENEA co-speech gesture challenges) and by
   the "specify intent, let the body complete it" idea of NVIDIA's MaskedMimic / GR00T whole-body work. */
import { Spring } from './motion.js';

const wave = (t, s) => Math.sin(t * 0.63 + s * 1.7) * 0.5 + Math.sin(t * 1.37 + s * 3.1) * 0.3 + Math.sin(t * 2.71 + s * 5.3) * 0.2;

export class BodySystem {
  /** seed: makes each presenter's rhythm their own; energy: how animated (1 = default) */
  constructor(seed = 1, energy = 1) {
    this.seed = seed; this.energy = energy; this.t = 0; this.talk = 0; this.breathPhase = seed;
    // springs: frequency (Hz) and damping per channel — the chest answers faster than the pelvis
    this.lean = new Spring(1.6, 0.55); this.lift = new Spring(2.0, 0.5); this.twist = new Spring(1.4, 0.6);
    this.roll = new Spring(1.2, 0.6); this.pelvis = new Spring(0.9, 0.7); this.tilt = new Spring(1.5, 0.55);
    this.shrugL = new Spring(2.2, 0.5); this.shrugR = new Spring(2.2, 0.5); this.drop = new Spring(0.8, 0.7);
    this.onShift = null;                                    // called when a sentence end moves the weight
  }
  /* ---- events from speech and gestures ---- */
  beat(k = 1) { k *= this.energy; this.lean.kick(0.8 * k); this.lift.kick(0.5 * k); }
  gesture(side, strength = 1) {
    const sg = side === 'Left' ? 1 : -1, k = strength * this.energy;
    this.twist.kick(-sg * 0.7 * k);                       // chest toward the gesturing arm
    this.pelvis.kick(sg * 0.25 * k);                        // pelvis a little the other way
    (side === 'Left' ? this.shrugL : this.shrugR).kick(0.9 * k);
    this.lean.kick(0.3 * k);
  }
  question() { this.tilt.kick((Math.floor(this.seed) % 2 ? 1 : -1) * 1.0 * this.energy); this.shrugL.kick(0.5); this.shrugR.kick(0.5); this.lean.kick(0.6); }
  contrast() { const s = Math.sin(this.t * 3.3 + this.seed) > 0 ? 1 : -1; (s > 0 ? this.shrugL : this.shrugR).kick(1.2 * this.energy); this.twist.kick(s * 0.75 * this.energy); }
  sentenceEnd() { this.drop.kick(-0.5); this.lift.kick(-0.35); if (Math.random() < 0.35) this.onShift?.(); }
  /* ---- per frame: the offsets to apply (radians and metres) ---- */
  step(dt, talking) {
    this.t += dt; const t = this.t, s = this.seed;
    this.talk += ((talking ? 1 : 0) - this.talk) * Math.min(1, dt * 2);
    // breathing: 14/min listening, 18/min talking; deeper while talking
    this.breathPhase += dt * 2 * Math.PI * (0.23 + 0.07 * this.talk);
    const breath = Math.sin(this.breathPhase), depth = 0.6 + 0.4 * this.talk;
    for (const sp of [this.lean, this.lift, this.twist, this.roll, this.pelvis, this.tilt, this.shrugL, this.shrugR, this.drop]) sp.step(dt);
    const sway = (k, f) => wave(t * f, s + k) * (0.35 + 0.65 * this.talk);
    return {
      pelvis: { yaw: this.pelvis.x + sway(1, 0.21) * 0.012, roll: sway(2, 0.17) * 0.01 },
      spine: { pitch: this.lean.x * 0.5 + sway(3, 0.3) * 0.008, yaw: this.twist.x * 0.4 + sway(4, 0.26) * 0.014, roll: this.roll.x * 0.5 + sway(5, 0.22) * 0.008 },
      chest: { pitch: this.lean.x * 0.5 - this.lift.x * 0.6 - breath * 0.012 * depth + this.drop.x * 0.3, yaw: this.twist.x * 0.6, roll: this.roll.x * 0.5 },
      shoulders: { Left: this.shrugL.x * 0.5 + breath * 0.006 * depth - this.drop.x * 0.2, Right: this.shrugR.x * 0.5 + breath * 0.006 * depth - this.drop.x * 0.2 },
      head: { tilt: this.tilt.x * 0.5, nod: this.lean.x * 0.25 }
    };
  }
}
