/* KARLCON Studio — virtual clock for render mode (/studio?render). Does nothing without ?render.
   Loaded before everything else, it replaces the page's sense of time so the show can be recorded
   frame by frame at full quality however slowly the computer draws:
     performance.now, Date, setTimeout/setInterval, requestAnimationFrame  → a clock that only moves
     when the recorder calls __vt.step(1/fps); CSS transitions and animations (captions, lower thirds,
     title cards, the logo wipe, the ticker) are held and set to that same clock every frame.
   __vt.hold(): while anything holds (a voice line downloading, Claude writing the next segment) the
   clock waits, so the recording never shows a pause that a live viewer would not have seen.
   __vt.real.setTimeout: real time, for waits that must pass during a hold (network retries). */
(function () {
  if (!/[?&]render(?:[=&]|$)/.test(location.search)) return;
  const real = {
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window), clearInterval: window.clearInterval.bind(window),
    raf: window.requestAnimationFrame.bind(window), now: performance.now.bind(performance), Date: window.Date
  };
  const epoch = real.Date.now();               // wall-clock time the recording starts at (the on-air clock)
  let now = 0;                                 // virtual milliseconds
  let seq = 0, holds = 0;
  const timers = new Map();                    // id -> { due, fn, args, every }
  let rafs = [];

  window.setTimeout = (fn, ms = 0, ...args) => { const id = ++seq; timers.set(id, { due: now + Math.max(0, +ms || 0), fn, args, order: id }); return id; };
  window.setInterval = (fn, ms = 0, ...args) => { const id = ++seq, every = Math.max(1, +ms || 0); timers.set(id, { due: now + every, fn, args, every, order: id }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
  window.requestAnimationFrame = (fn) => { const id = ++seq; rafs.push({ id, fn }); return id; };
  window.cancelAnimationFrame = (id) => { rafs = rafs.filter((r) => r.id !== id); };
  Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
  class VDate extends real.Date {
    constructor(...a) { if (a.length) super(...a); else super(epoch + now); }
    static now() { return epoch + now; }
  }
  window.Date = VDate;

  // a macrotask that is not a (virtual) timer: lets promise chains settle between timer callbacks
  const mc = new MessageChannel(), waiting = [];
  mc.port1.onmessage = () => waiting.shift()?.();
  const yieldTask = () => new Promise((r) => { waiting.push(r); mc.port2.postMessage(0); });
  const sleepReal = (ms) => new Promise((r) => real.setTimeout(r, ms));

  // CSS transitions/animations: pause each one and drive its currentTime from the virtual clock
  const started = new WeakMap();
  function syncAnimations() {
    for (const a of document.getAnimations()) {
      if (!started.has(a)) { started.set(a, now - (+a.currentTime || 0)); try { a.pause(); } catch (e) { /* ignore */ } }
      const t = now - started.get(a), end = a.effect?.getComputedTiming?.().endTime;
      try {
        if (Number.isFinite(end) && t >= end) a.finish(); else a.currentTime = t;
      } catch (e) { /* an animation that was just cancelled */ }
    }
  }

  async function runTimersUntil(target) {
    for (let guard = 0; guard < 100000; guard++) {
      while (holds > 0) await sleepReal(15);       // a line that started mid-step waits for its voice here
      let next = null;
      for (const [id, t] of timers) if (t.due <= target && (!next || t.due < next[1].due || (t.due === next[1].due && t.order < next[1].order))) next = [id, t];
      if (!next) break;
      const [id, t] = next;
      now = Math.max(now, t.due);
      if (t.every) { t.due += t.every; t.order = ++seq; } else timers.delete(id);
      try { typeof t.fn === 'function' ? t.fn(...t.args) : (0, eval)(String(t.fn)); } catch (e) { console.error(e); }
      await yieldTask();
    }
    while (holds > 0) await sleepReal(15);
    now = target;
  }

  window.__vt = {
    real, sleepReal,
    get now() { return now; },
    get holding() { return holds > 0; },
    /** hold the clock until the returned release() is called (idempotent) */
    hold() { holds++; let done = false; return () => { if (!done) { done = true; holds--; } }; },
    /** advance by dt seconds: waits out holds, runs due timers in order, then one animation frame */
    async step(dt) {
      while (holds > 0) await sleepReal(15);
      await runTimersUntil(now + dt * 1000);
      const list = rafs; rafs = [];
      for (const r of list) { try { r.fn(now); } catch (e) { console.error(e); } }
      await yieldTask();
      syncAnimations();
    },
    /** wait (real time) for pending holds and settled promises, without moving the clock */
    async settle() { while (holds > 0) await sleepReal(15); await yieldTask(); }
  };
})();
