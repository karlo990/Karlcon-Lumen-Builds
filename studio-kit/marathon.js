/* KARLCON Studio — the marathon run-sheet (default 20 hours).
   Plays the six scripted episodes in turn. After each one, if live writing is available,
   Claude writes a block of fresh segments about that episode's building (climate, process,
   materials, the Atlas, viewer questions), then the next episode starts. The run-sheet loops
   until the clock runs out.
   If live writing is not available (no key, no credit, offline), it keeps looping the
   scripted episodes with a short intermission card, so the stream never goes dead.
   It exposes the same surface as LiveDirector, so /studio and /writers-room drive it
   exactly like the live show. */
import { LiveDirector } from './live.js';

const FOLLOW_UP = ['climate', 'process', 'atlas', 'materials', 'mechanism', 'concept'];

export class Marathon {
  constructor({ episodes, hours = 20, liveSegments = 10, useLive = true, onEvent = () => {} }) {
    Object.assign(this, { episodes, hours, liveSegments, useLive, emit: onEvent });
    this.start = 0; this.end = 0; this.lines = []; this.segments = [];
    this.epIdx = 0; this.loop = 1; this.phase = 'episode'; this.liveLeft = 0; this.followIdx = 0;
    this.director = null; this.liveReason = useLive ? '' : 'live writing switched off';
    this.stats = { calls: 0, input: 0, output: 0, cacheRead: 0, rejected: 0, repaired: 0, cost: 0 };
    this.questions = []; this.pin = {}; this.pending = null; this.lastError = ''; this.stopped = false;
    this.info = null; this.blocks = 0;
  }

  /** Prepare live writing if possible. Never throws: without it the marathon runs scripted. */
  async init() {
    if (this.useLive) {
      const d = new LiveDirector({ onEvent: (t, data) => this.onDirector(t, data) });
      try {
        await d.init(); this.director = d; this.info = d.info;
        d.lines = this.lines;                       // one shared line list: Claude sees what the episodes said
        this.questions = d.questions; this.stats = d.stats;
      } catch (e) { this.liveReason = e.message; this.emit('livedown', { message: e.message }); }
    }
    this.info = this.info || { model: '', concepts: [], cities: [] };
    this.start = Date.now(); this.end = this.start + this.hours * 3600e3;
    return this;
  }
  get live() { return !!this.director && !this.liveReason; }
  get episode() { return this.episodes[this.epIdx % this.episodes.length]; }
  get hourNo() { return Math.min(this.hours, Math.floor((Date.now() - this.start) / 3600e3) + 1); }
  get remaining() { return Math.max(0, this.end - Date.now()); }
  onDirector(t, data) { if (t === 'segment') this.segments.push(data.segment); this.emit(t, data); }

  peek() {
    if (this.phase === 'live' && this.live) return { label: `Live · ${this.episode.title} · ${FOLLOW_UP[this.followIdx % FOLLOW_UP.length]}` };
    const next = this.phase === 'live' ? this.episodes[(this.epIdx + 1) % this.episodes.length] : this.episode;
    return { label: `Episode ${next.no} · ${next.title}` };
  }
  describe(p) { return p?.label || ''; }

  /** append the next block of lines to the run-sheet */
  async fill() {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      if (Date.now() >= this.end) { this.stopped = true; return false; }
      if (this.phase === 'episode') {
        const ep = this.episode, id = `ep${ep.no}-l${this.loop}`;
        const lines = ep.lines.map((l, i) => ({ ...l, scripted: true, segStart: i === 0, seg: id, segNo: `EP${ep.no}`, segTitle: ep.title,
          conceptId: ep.concept, episode: ep.no, intermission: i === 0 ? { ep, loop: this.loop } : undefined }));
        this.lines.push(...lines); this.blocks++;
        this.emit('episode', { segment: { id, no: `EP${ep.no}`, type: 'episode', title: `Episode ${ep.no}: ${ep.title}`, summary: ep.subtitle, conceptTitle: ep.title, cityName: '', lines } });
        this.director?.covered.push(`Episode ${ep.no}, ${ep.title}: ${ep.subtitle}`);
        this.phase = this.live ? 'live' : 'episode'; this.liveLeft = this.liveSegments;
        if (!this.live) this.advanceEpisode();
        return true;
      }
      // live block, one segment at a time
      const ep = this.episode;
      try {
        const type = FOLLOW_UP[this.followIdx++ % FOLLOW_UP.length];
        const cityId = ep.city || this.info.cities[this.blocks % this.info.cities.length]?.id;
        this.director.pin = { conceptId: ep.concept, city: type === 'atlas' ? undefined : cityId, type, once: true };
        const seg = await this.director.writeNext();
        seg.lines.forEach((l) => { l.conceptId = l.conceptId || ep.concept; });
        this.lastError = '';
      } catch (e) {
        this.lastError = e.message;
        if ([400, 401, 402, 403, 503].includes(e.status) || /credit|balance|workspace|key/i.test(e.message)) {
          this.liveReason = e.message; this.emit('livedown', { message: e.message });
        }
        this.liveLeft = 0;
      }
      if (--this.liveLeft <= 0 || !this.live) { this.phase = 'episode'; this.advanceEpisode(); }
      return true;
    })();
    try { return await this.pending; } finally { this.pending = null; }
  }
  advanceEpisode() { this.epIdx++; if (this.epIdx % this.episodes.length === 0) this.loop++; }

  /** make sure line i exists; returns null once the marathon is over */
  async ensure(i) {
    let guard = 0;
    while (!this.stopped && i >= this.lines.length && guard++ < 40) await this.fill();
    return this.lines[i] || null;
  }
  onAir(i) { if (!this.stopped && this.lines.length - i <= 6 && !this.pending) this.fill().catch(() => {}); }
  ask(q) { if (this.director) this.director.ask(q); else this.emit('error', { message: 'Viewer questions need live writing.' }); }
  setPin(p) { if (this.director) this.director.setPin(p); }
}
