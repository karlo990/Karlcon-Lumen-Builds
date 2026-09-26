/* KARLCON Studio — the sound of a recorded show (render mode).
   While the show renders, the recorder notes every voice line (the ElevenLabs audio and the moment it
   starts on the virtual clock) and when someone is talking. Afterwards it rebuilds the live mix
   offline, in windows of about a minute, with the same chain as the live studio (studio.html `sound`):
     voices → high-pass 80 Hz → presence +2 dB → compressor → trim ─┐
     shuffled playlist, equal-power crossfades → mud cut → 2.5 kHz carve → ducker → fader ─┴→ limiter
   Ducking follows the talking exactly as the live 60 ms tick does, so the recording sounds like the stream. */

const SR = 44100;                       // Instagram / Facebook Live expect 44.1 kHz

export function createRecorder({ MIX, dB, loadTracks, musicOn, level }) {
  const voices = [];                    // { t, data: ArrayBuffer, rate, dur }
  const talk = [];                      // { t, on } transitions
  let talking = false, end = 0;
  const decoder = new OfflineAudioContext(2, 1, SR);

  const rec = {
    async decode(data) { return decoder.decodeAudioData(data.slice(0)); },
    voice(t, data, rate, dur) { voices.push({ t, data, rate, dur }); },
    sample(t, on) { if (on !== talking) { talking = on; talk.push({ t, on }); } end = Math.max(end, t); },
    get length() { return end; },
    get voiceCount() { return voices.length; },
    /** decode the music and plan songs, fades and ducking up to `total` seconds */
    async prepare(total) {
      end = total;
      const plan = { songs: [], duck: [], carve: [], total };
      if (musicOn && level > 0) {
        const tracks = await loadTracks();
        const decoded = new Map();
        for (const t of tracks) {
          try { const r = await fetch(t.src); decoded.set(t, await decoder.decodeAudioData(await r.arrayBuffer())); }
          catch (e) { console.warn('render: music could not load', t.src, e.message); }
        }
        const usable = tracks.filter((t) => decoded.has(t));
        let queue = [], lastQueued = null;
        const next = () => {                                   // the live shuffle: each song once per round, no repeats in a row
          if (!queue.length) {
            queue = [...usable];
            for (let i = queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [queue[i], queue[j]] = [queue[j], queue[i]]; }
            if (queue.length > 1 && queue[0] === lastQueued) queue.push(queue.shift());
          }
          return (lastQueued = queue.shift());
        };
        for (let s = 0; usable.length && s < total;) {
          const track = next(), buf = decoded.get(track), dur = buf.duration;
          const lead = plan.songs.length ? MIX.xfade : 0;       // the first song starts at full level
          const fadeOut = s + dur - (MIX.xfade + 1.2);          // the live tick starts the crossfade 5.2 s before the end
          plan.songs.push({ track, buf, start: s, fadeIn: lead, fadeOutAt: Math.max(s + 1, fadeOut), len: MIX.xfade });
          s = Math.max(s + 1, fadeOut);
        }
      }
      // ducking: replay the live 60 ms tick against the recorded talking
      let k = 0, on = false, lastTalk = -99, state = '', song = -1;
      const songAt = (t) => { let i = -1; for (let j = 0; j < plan.songs.length; j++) if (plan.songs[j].start <= t) i = j; return i; };
      for (let t = 0; t <= total; t += 0.06) {
        while (k < talk.length && talk[k].t <= t) on = talk[k++].on;
        if (on) lastTalk = t;
        const si = songAt(t); if (si !== song) { song = si; state = ''; }
        const want = on || t - lastTalk < MIX.hold ? 'duck' : 'bed';
        if (want !== state) {
          state = want; const tc = (want === 'duck' ? MIX.attack : MIX.release) / 3;
          const depth = plan.songs[song]?.track?.duck ?? MIX.duck;
          plan.duck.push({ t, v: dB(want === 'duck' ? depth : MIX.bed), tc });
          plan.carve.push({ t, v: want === 'duck' ? MIX.carveDuck : MIX.carveBed, tc });
        }
      }
      rec.plan = plan;
      return { windows: Math.ceil(total / 60), total, songs: plan.songs.length, voices: voices.length };
    },
    /** render seconds [a, b) of the mix; returns interleaved 16-bit stereo PCM */
    async window(a, b) {
      const plan = rec.plan, pre = Math.min(a, 2), start = a - pre, len = b - start;
      const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(len * SR)), SR);
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -3; master.knee.value = 0; master.ratio.value = 20; master.attack.value = 0.002; master.release.value = 0.15;
      master.connect(ctx.destination);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80;
      const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3000; pres.Q.value = 1; pres.gain.value = 2;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 2.5; comp.attack.value = 0.004; comp.release.value = 0.25;
      const trim = ctx.createGain(); trim.gain.value = dB(-4);
      hp.connect(pres).connect(comp).connect(trim).connect(master);
      const musicIn = ctx.createGain();
      const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 300; mud.Q.value = 0.8; mud.gain.value = -2;
      const carve = ctx.createBiquadFilter(); carve.type = 'peaking'; carve.frequency.value = 2500; carve.Q.value = 0.9;
      const ducker = ctx.createGain(), fader = ctx.createGain();
      musicIn.connect(mud).connect(carve).connect(ducker).connect(fader).connect(master);

      // automation as sampled curves (100 per second), so a window can start anywhere
      const curve = (fn) => { const n = Math.max(2, Math.ceil(len * 100) + 1), c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = fn(start + (i / (n - 1)) * len); return c; };
      // setTargetAtTime, replayed: each event eases from wherever the value was towards its target
      const follow = (events, v0) => {
        const from = []; let v = v0, t0 = 0, target = v0, tc = 1;
        for (const e of events) { v = target + (v - target) * Math.exp(-(e.t - t0) / tc); from.push(v); t0 = e.t; target = e.v; tc = e.tc; }
        return (t) => {
          let lo = 0, hi = events.length - 1, i = -1;
          while (lo <= hi) { const m = (lo + hi) >> 1; if (events[m].t <= t) { i = m; lo = m + 1; } else hi = m - 1; }
          if (i < 0) return v0;
          const e = events[i]; return e.v + (from[i] - e.v) * Math.exp(-(t - e.t) / e.tc);
        };
      };
      ducker.gain.setValueCurveAtTime(curve(follow(plan.duck, dB(MIX.bed))), 0, len);
      carve.gain.setValueCurveAtTime(curve(follow(plan.carve, MIX.carveBed)), 0, len);
      fader.gain.setValueCurveAtTime(curve((t) => level * (1 - Math.exp(-t / 0.5))), 0, len);

      for (const s of plan.songs) {
        const songEnd = Math.min(s.start + s.buf.duration, s.fadeOutAt + s.len);
        if (songEnd <= start || s.start >= b) continue;
        const src = ctx.createBufferSource(); src.buffer = s.buf;
        const g = ctx.createGain();
        g.gain.setValueCurveAtTime(curve((t) => {
          if (t < s.start) return 0;
          if (s.fadeIn && t < s.start + s.fadeIn) return Math.sin(((t - s.start) / s.fadeIn) * Math.PI / 2);
          if (t >= s.fadeOutAt) return t >= s.fadeOutAt + s.len ? 0 : Math.cos(((t - s.fadeOutAt) / s.len) * Math.PI / 2);
          return 1;
        }), 0, len);
        src.connect(g).connect(musicIn);
        src.start(Math.max(0, s.start - start), Math.max(0, start - s.start));
      }
      for (const v of voices) {
        if (v.t + v.dur / v.rate <= start || v.t >= b) continue;
        const src = ctx.createBufferSource(); src.buffer = await ctx.decodeAudioData(v.data.slice(0)); src.playbackRate.value = v.rate;
        src.connect(hp); src.start(Math.max(0, v.t - start), Math.max(0, (start - v.t) * v.rate));
      }
      const out = await ctx.startRendering();
      const skip = Math.round(pre * SR), n = out.length - skip, L = out.getChannelData(0), R = out.getChannelData(1);
      const pcm = new Int16Array(n * 2);
      for (let i = 0; i < n; i++) {
        pcm[i * 2] = Math.max(-1, Math.min(1, L[i + skip])) * 32767;
        pcm[i * 2 + 1] = Math.max(-1, Math.min(1, R[i + skip])) * 32767;
      }
      return new Uint8Array(pcm.buffer);
    },
    SR
  };
  return rec;
}

/** Uint8Array → base64, in chunks (btoa of one huge string runs out of stack) */
export function toBase64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
