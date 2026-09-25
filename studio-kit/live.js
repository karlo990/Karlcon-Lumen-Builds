/* KARLCON Studio — the endless live show.
   Plans segments in arcs (concept → mechanism → one of climate/process/materials/build → atlas),
   moves to the next concept and city after each arc, asks /api/studio-script for each segment,
   and keeps one segment written ahead of what is on air. Viewer questions jump the queue.
   If the API fails, the show keeps going on the scripted episode until writing recovers.
   Shared by /studio (plays it) and /writers-room (watches and steers it). */

export const KEY_STORE = 'kc_studio_key';
export const CHANNEL = 'kc-studio-live';
export function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } }
export function setKey(k) { try { localStorage.setItem(KEY_STORE, k); } catch { /* private mode */ } }

const EXTRA = ['climate', 'process', 'materials', 'build'];
const CUBE = 'cantilever-pavilion';
const STAGE = new Set([CUBE, 'lumen-oval-residence', 'rotunda-fan-house', 'origami-crown-villa', 'stone-arcade-house', 'granite-plinth-tower']);
const TYPE_LABEL = { episode: 'Scripted episode', open: 'Opening', concept: 'The concept', mechanism: 'How it opens', climate: 'Built for Zimbabwe', process: 'How a concept earns its place', materials: 'What it is made of', build: 'How it goes up', atlas: 'The Atlas', viewer: 'Viewer question' };
export const typeLabel = (t) => TYPE_LABEL[t] || t;

export class LiveDirector {
  constructor({ endpoint = '/api/studio-script', fallbackLines = [], onEvent = () => {} } = {}) {
    Object.assign(this, { endpoint, fallbackLines, emit: onEvent });
    this.info = null; this.lines = []; this.segments = []; this.covered = [];
    this.questions = []; this.pin = {}; this.pending = null; this.failures = 0; this.fbIdx = 0;
    this.segNo = 0; this.arc = 0; this.extra = 0; this.conceptIdx = 0; this.cityIdx = 0;
    this.stats = { calls: 0, input: 0, output: 0, cacheRead: 0, rejected: 0, repaired: 0, cost: 0 };
    this.stopped = false; this.lastError = '';
  }

  async request(method, body) {
    const r = await fetch(this.endpoint, {
      method, headers: { 'content-type': 'application/json', 'x-studio-key': getKey() },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(75000)
    });
    let j = {}; try { j = await r.json(); } catch { /* not JSON */ }
    if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { status: r.status, data: j });
    return j;
  }

  /** Load persona, concepts, cities and facts. Throws with a readable message. */
  async init() {
    this.info = await this.request('GET');
    if (!this.info.ready) throw new Error('ANTHROPIC_API_KEY is not set in Vercel yet.');
    if (!this.info.concepts?.length) throw new Error('No concepts found.');
    const start = this.info.concepts.findIndex((c) => c.id === CUBE);
    this.conceptIdx = start >= 0 ? start : 0;
    return this.info;
  }

  get concept() { return this.info.concepts[this.conceptIdx % this.info.concepts.length]; }
  get city() { return this.info.cities[this.cityIdx % this.info.cities.length]; }

  /* the plan for the next segment, without committing to it */
  peek() {
    if (this.questions.length) return { type: 'viewer', concept: this.concept, city: this.city, question: this.questions[0] };
    const P = this.pin;
    const concept = P.conceptId ? this.info.concepts.find((c) => c.id === P.conceptId) || this.concept : this.concept;
    const city = P.city ? this.info.cities.find((c) => c.id === P.city) || this.city : this.city;
    let type;
    if (P.type) type = P.type;
    else if (this.segNo === 0) type = 'open';
    else {
      const arc = ['concept', 'mechanism', 'extra', 'atlas'][this.arc % 4];
      if (arc === 'extra') { type = EXTRA[this.extra % EXTRA.length]; if (type === 'build' && !STAGE.has(concept.id)) type = EXTRA[(this.extra + 1) % EXTRA.length]; }
      else type = arc;
      if (type === 'mechanism' && !['hinged', 'slide', 'louvre'].includes(concept.mechanism) && !STAGE.has(concept.id)) type = 'climate';
    }
    return { type, concept, city };
  }
  describe(p) { return `${typeLabel(p.type)} — ${p.concept.title}${p.type === 'atlas' ? ', ' + p.city.name : ''}`; }
  advance(p) {
    if (p.type === 'viewer') { this.questions.shift(); return; }
    if (this.pin.once) this.pin = {};
    if (p.type === 'open') return;
    if (['climate', 'process', 'materials', 'build'].includes(p.type)) this.extra++;
    this.arc++;
    if (this.arc % 4 === 0) { this.conceptIdx++; this.cityIdx++; }
  }

  /** Write the next segment and append its lines. */
  async writeNext() {
    if (this.pending) return this.pending;
    const plan = this.peek();
    this.pending = (async () => {
      this.emit('writing', { plan: this.describe(plan) });
      const after = { ...plan };
      this.advance(plan);
      const nextUp = this.describe(this.peek());
      const body = {
        conceptId: plan.concept.id, city: plan.city.id, type: plan.type, question: plan.question,
        segmentNo: this.segNo + 1, nextUp,
        recent: this.lines.filter((l) => !l.fallback).slice(-8).map((l) => ({ who: l.who, say: l.say })),
        covered: this.covered.slice(-12)
      };
      try {
        const j = await this.request('POST', body);
        this.segNo++; this.failures = 0; this.lastError = '';
        const seg = { ...j.segment, no: this.segNo, at: Date.now(), rejected: j.rejected || [], repaired: j.repaired, usage: j.usage };
        seg.lines.forEach((l, i) => { l.seg = seg.id; l.segNo = seg.no; l.segTitle = seg.title; l.segStart = i === 0; l.conceptId = seg.conceptId; l.conceptTitle = seg.conceptTitle; l.cityName = seg.cityName; l.city = seg.city; });
        this.lines.push(...seg.lines); this.segments.push(seg);
        this.covered.push(`${seg.title}: ${seg.summary}`);
        const u = j.usage || {}, pr = this.info.prices || [2, 10];
        Object.assign(this.stats, {
          calls: this.stats.calls + 1, input: this.stats.input + (u.input_tokens || 0), output: this.stats.output + (u.output_tokens || 0),
          cacheRead: this.stats.cacheRead + (u.cache_read_input_tokens || 0), rejected: this.stats.rejected + seg.rejected.length, repaired: this.stats.repaired + (j.repaired ? 1 : 0)
        });
        this.stats.cost = (this.stats.input * pr[0] + this.stats.output * pr[1] + this.stats.cacheRead * pr[0] * 0.1) / 1e6;
        this.emit('segment', { segment: seg, stats: this.stats });
        return seg;
      } catch (e) {
        // put the plan back so it is retried
        if (after.type === 'viewer') this.questions.unshift(after.question);
        this.failures++; this.lastError = e.message;
        this.emit('error', { message: e.message, failures: this.failures });
        throw e;
      } finally { this.pending = null; }
    })();
    return this.pending;
  }

  /** Make sure line i exists. Falls back to the scripted episode after repeated failures. */
  async ensure(i) {
    while (!this.stopped && i >= this.lines.length) {
      try { await this.writeNext(); }
      catch (e) {
        if (e.status === 401 || e.status === 503) throw e;               // configuration problem: stop
        if (this.failures >= 2 && this.fallbackLines.length) {
          const l = { ...this.fallbackLines[this.fbIdx++ % this.fallbackLines.length], fallback: true, segTitle: 'From the archive' };
          this.lines.push(l); this.emit('fallback', { line: l });
        } else await new Promise((ok) => setTimeout(ok, 1500 * this.failures));
      }
    }
    return this.lines[i];
  }
  /** Called as each line goes on air: keep one segment written ahead. */
  onAir(i) { if (!this.stopped && this.lines.length - i <= 5 && !this.pending) this.writeNext().catch(() => {}); }
  ask(q) { const t = String(q || '').trim().slice(0, 280); if (t) { this.questions.push(t); this.emit('question', { text: t, queued: this.questions.length }); } }
  setPin(p) { this.pin = { ...p, once: true }; this.emit('pin', { pin: this.pin }); }
}
