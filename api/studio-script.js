// /api/studio-script.js — live scripting for /studio, written by Claude, grounded in our own facts.
//
//   GET  /api/studio-script           -> persona, segment types, concepts, cities, facts   (studio key)
//   POST /api/studio-script  {conceptId, city, type, segmentNo, recent, covered, question, nextUp}
//                                      -> { segment: {title, summary, lines[...]}, rejected, usage }
//
// Environment (Vercel → Settings → Environment Variables):
//   ANTHROPIC_API_KEY   the Claude API key (workspace key). Never sent to the browser.
//   STUDIO_KEY          passcode the studio and Writers' Room send as x-studio-key (ADMIN_KEY also works).
//   STUDIO_MODEL        optional, default claude-sonnet-5.
//
// Grounding: the prompt carries only facts from api/_studio-facts.js and the concept library.
// Each returned line is then checked here; a line that cites no fact for a number, names a
// place or topic from outside the facts, or talks prices, politics or invented clients is
// dropped, and Claude gets one chance to rewrite. What was dropped is returned as `rejected`
// so the Writers' Room can show it.

import { timingSafeEqual, randomUUID } from 'node:crypto';
import { loadConcepts, factsFor, allFacts, CITIES } from './_studio-facts.js';
import { systemPrompt, SEGMENT_TYPES, SEGMENT_TOOL, HOSTS, RULES } from './_studio-persona.js';

const MODEL = process.env.STUDIO_MODEL || 'claude-sonnet-5';
const API = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
const PRICES = { 'claude-sonnet-5': [2, 10], 'claude-opus-5-5': [4, 20], 'claude-haiku-4-5-20251001': [1, 5], 'claude-fable-5-1': [10, 50] };
const CUBE_ID = 'cantilever-pavilion';   // the concept whose model stands in the studio

/* ---------- access ---------- */
function authorised(req) {
  const given = Buffer.from(String(req.headers['x-studio-key'] || ''));
  if (!given.length) return false;
  for (const k of [process.env.STUDIO_KEY, process.env.ADMIN_KEY]) {
    if (!k) continue;
    const want = Buffer.from(k);
    if (want.length === given.length && timingSafeEqual(want, given)) return true;
  }
  return false;
}
const hits = new Map();
function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
  const now = Date.now(), win = (hits.get(ip) || []).filter((t) => now - t < 60000);
  win.push(now); hits.set(ip, win);
  return win.length > 12;
}
const s = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');

/* ---------- grounding checks ---------- */
const FOREIGN = ['south africa', 'botswana', 'zambia', 'mozambique', 'namibia', 'malawi', 'tanzania', 'kenya', 'nigeria', 'ghana', 'ethiopia', 'egypt', 'morocco', 'angola', 'congo', 'uganda', 'rwanda', 'lesotho', 'eswatini', 'swaziland', 'madagascar',
  'america', 'american', 'united states', 'usa', 'canada', 'mexico', 'brazil', 'argentina', 'britain', 'british', 'england', 'united kingdom', 'scotland', 'ireland', 'france', 'french', 'germany', 'german', 'italy', 'italian', 'spain', 'portugal', 'netherlands', 'dutch', 'switzerland', 'swiss', 'sweden', 'norway', 'denmark', 'finland', 'russia', 'ukraine', 'poland',
  'china', 'chinese', 'japan', 'japanese', 'korea', 'india', 'indian', 'pakistan', 'bangladesh', 'indonesia', 'australia', 'new zealand', 'dubai', 'emirates', 'saudi', 'qatar', 'israel', 'iran', 'turkey', 'singapore', 'malaysia', 'europe', 'european', 'asia', 'scandinavia',
  'johannesburg', 'joburg', 'cape town', 'durban', 'pretoria', 'gaborone', 'lusaka', 'maputo', 'nairobi', 'lagos', 'accra', 'cairo', 'london', 'paris', 'berlin', 'new york', 'los angeles', 'tokyo', 'beijing', 'shanghai', 'sydney'];
const BANNED = [
  [/[$€£¥]|\bUS ?dollars?\b|\bUSD\b|\bZWL\b|\bZiG\b|\brands?\b|\bprices?\b|\bpriced\b|\bcosts?\b|\bcheap(er|est)?\b|\bafford|\bdiscount|\bpromo/i, 'talks about money or prices'],
  [/\bguarantee|\bwarrant(y|ies)\b|\bcertified\b|\baward/i, 'promises a guarantee, warranty, certification or award'],
  [/\b(ZANU|MDC|CCC|elections?|minister|president|government|parliament|sanctions?|politic)/i, 'goes into politics'],
  [/\b(our|a|the) (clients?|customers?)\b|\bwe (have )?(built|installed|delivered|completed)\b|\balready (built|installed)\b|\bhundreds of\b|\bthousands of\b/i, 'claims past projects or clients'],
  [/\b(first|only|best|leading|number one|biggest|largest)\b[^.]{0,25}\b(in|across) (zimbabwe|africa|the world|the country)\b/i, 'makes a superlative claim'],
  [/\b(Mr|Mrs|Ms|Dr|Prof)\.?\s+[A-Z]/, 'names a person'],
  [/https?:|www\.|@\w|#\w/i, 'contains a link, handle or hashtag'],
  [/[*_`#>]|^\s*(luma|karl)\s*:/i, 'contains markdown or a speaker label'],
  [/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'contains an emoji']
];
const NUMWORDS = /\b(hundred|thousand|million|billion|percent|per cent)\b/i;
const nums = (t) => (String(t).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((x) => +x.replace(/,/g, '')).filter(Number.isFinite);

function checkText(text, citedTexts, allText) {
  const why = [];
  const cited = citedTexts.join(' ');
  const allowed = new Set(nums(cited));
  for (const n of nums(text)) if (!(Number.isInteger(n) && n >= 0 && n <= 12) && !allowed.has(n)) why.push(`says ${n}, which is not in a cited fact`);
  if (NUMWORDS.test(text) && !/\d{3}|%/.test(cited)) why.push('uses a spelled-out large number or percentage with no cited figure');
  const low = text.toLowerCase();
  for (const place of FOREIGN) if (new RegExp(`\\b${place}\\b`).test(low) && !allText.includes(place)) why.push(`brings in "${place}", which is not in the facts`);
  for (const [re, msg] of BANNED) if (re.test(text)) why.push(msg);
  return why;
}

function validate(raw, facts, ctx) {
  const ids = new Set(Object.keys(facts));
  const allText = Object.values(facts).join(' ').toLowerCase();
  const lines = [], rejected = [];
  for (const l of Array.isArray(raw?.lines) ? raw.lines : []) {
    const who = l?.who === 'karl' ? 'karl' : l?.who === 'luma' ? 'luma' : null;
    const say = s(l?.say, 420);
    const src = (Array.isArray(l?.src) ? l.src : []).map((x) => s(x, 80)).filter(Boolean);
    const why = [];
    if (!who) why.push('unknown speaker');
    if (say.length < 8) why.push('too short');
    if (say.split(/\s+/).length > 60) why.push('too long to speak');
    const unknown = src.filter((x) => !ids.has(x));
    if (unknown.length) why.push(`cites facts that do not exist: ${unknown.join(', ')}`);
    const cited = src.filter((x) => ids.has(x)).map((x) => facts[x]);
    why.push(...checkText(say, cited, allText));
    if (!cited.length && say.length > 180) why.push('long factual-sounding line with no cited fact');
    if (why.length) { rejected.push({ who: l?.who, say, src, reasons: [...new Set(why)] }); continue; }
    const out = { who, say, src: src.filter((x) => ids.has(x)) };
    // cues, cleaned
    const CAMS = ['wide', 'two', 'cu', 'screen', 'globe', 'roof', 'house'], LOOKS = ['screen', 'globe', 'roof', 'house', 'camera'];
    if (CAMS.includes(l.cam)) out.cam = l.cam;
    if (LOOKS.includes(l.look)) out.look = l.look;
    if (['smile', 'serious', 'neutral'].includes(l.mood)) out.mood = l.mood;
    if ((l.open === 0 || l.open === 1) && ctx.hinged) out.open = l.open;
    if (Number.isInteger(l.build) && l.build >= 0 && l.build <= 7 && ctx.cube) out.build = l.build;
    if (!ctx.cube) { if (out.cam === 'house') out.cam = 'screen'; if (out.look === 'house') out.look = 'screen'; }
    if (l.slide && typeof l.slide === 'object') {
      const slide = { kicker: s(l.slide.kicker, 48), title: s(l.slide.title, 70), lines: (Array.isArray(l.slide.lines) ? l.slide.lines : []).slice(0, 4).map((x) => s(x, 80)).filter(Boolean) };
      // a title card may show any figure that is in this segment's facts
      const sw = checkText([slide.kicker, slide.title, ...slide.lines].join(' · '), Object.values(facts), allText);
      if (slide.title && !sw.length) out.slide = { ...slide, image: ctx.thumb || undefined };
      else if (slide.title) rejected.push({ who: 'screen', say: [slide.title, ...slide.lines].join(' · '), src: out.src, reasons: sw, slideOnly: true });
    }
    lines.push(out);
  }
  return { lines, rejected };
}

/* ---------- Claude ---------- */
async function callClaude(userText) {
  const body = {
    model: MODEL, max_tokens: 2200,
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    tools: [SEGMENT_TOOL], tool_choice: { type: 'tool', name: 'write_segment' },
    messages: [{ role: 'user', content: userText }]
  };
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`${API}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(50000)
    });
    if (r.ok) {
      const j = await r.json();
      const tool = (j.content || []).find((c) => c.type === 'tool_use' && c.name === 'write_segment');
      if (!tool) throw Object.assign(new Error('Claude did not return a segment.'), { status: 502 });
      return { out: tool.input, usage: j.usage || {} };
    }
    const text = await r.text().catch(() => '');
    lastErr = Object.assign(new Error(`Claude API ${r.status}: ${text.slice(0, 300)}`), { status: r.status === 401 ? 500 : 502 });
    if (![429, 500, 502, 503, 529].includes(r.status)) break;
    await new Promise((ok) => setTimeout(ok, 800 * 2 ** attempt));
  }
  throw lastErr;
}

function userPrompt({ type, concept, cityName, facts, recent, covered, question, nextUp, segmentNo, cube }) {
  const esc = (t) => String(t).replace(/</g, '‹').replace(/>/g, '›');
  return [
    `<segment>\nnumber: ${segmentNo}\ntype: ${type} — ${SEGMENT_TYPES[type]}\nconcept: ${concept ? `${concept.title} (id ${concept.id})` : 'none'}\ncity: ${cityName}\n</segment>`,
    `<studio_model>${cube ? 'The Elevated Glass Cube model is on stage: house and build cues work.' : 'The cube on stage is NOT this concept: show this concept on the screen; do not use house or build cues.'}</studio_model>`,
    `<facts>\n${Object.entries(facts).map(([k, v]) => `${k}: ${esc(v)}`).join('\n')}\n</facts>`,
    `<recent_lines>\n${recent.map((l) => `${l.who.toUpperCase()}: ${esc(l.say)}`).join('\n') || '(the show is just starting)'}\n</recent_lines>`,
    `<covered>\n${covered.map((c) => `- ${esc(c)}`).join('\n') || '(nothing yet)'}\n</covered>`,
    question ? `<viewer_question>\n${esc(question)}\n</viewer_question>` : '',
    `<next_up>${esc(nextUp || 'more from the studio')}</next_up>`,
    'Write the next segment now with the write_segment tool.'
  ].filter(Boolean).join('\n\n');
}

const cityNames = { harare: 'Harare', bulawayo: 'Bulawayo', mutare: 'Mutare', masvingo: 'Masvingo', vicfalls: 'Victoria Falls' };

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    if (!process.env.STUDIO_KEY && !process.env.ADMIN_KEY) return res.status(503).json({ error: 'Set STUDIO_KEY in Vercel → Settings → Environment Variables, then redeploy.' });
    if (!authorised(req)) return res.status(401).json({ error: 'Studio key missing or wrong.' });

    if (req.method === 'GET') {
      const concepts = await loadConcepts();
      return res.status(200).json({
        model: MODEL, ready: Boolean(process.env.ANTHROPIC_API_KEY), prices: PRICES[MODEL] || null,
        persona: { rules: RULES, hosts: HOSTS, types: SEGMENT_TYPES, system: systemPrompt() },
        concepts: concepts.map((c) => ({ id: c.id, title: c.title, channel: c.channelName, mechanism: c.mechanism, status: c.status || 'Concept', thumbUrl: c.thumbUrl || '' })),
        cities: CITIES.map((id) => ({ id, name: cityNames[id] })), facts: await allFacts()
      });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
    if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'Set ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.' });
    if (rateLimited(req)) return res.status(429).json({ error: 'Too many requests — slow down.' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const concepts = await loadConcepts();
    const concept = concepts.find((c) => c.id === s(b.conceptId, 64)) || concepts[0];
    const city = CITIES.includes(b.city) ? b.city : 'harare';
    const question = s(b.question, 280);
    let type = Object.hasOwn(SEGMENT_TYPES, b.type) ? b.type : 'concept';
    if (question) type = 'viewer';
    const ci = concepts.indexOf(concept);
    const others = [...concepts.slice(ci + 1), ...concepts.slice(0, ci)];
    const facts = factsFor({ concept, city, others });
    const cube = concept?.id === CUBE_ID;
    const ctx = { cube, hinged: concept?.mechanism === 'hinged', thumb: concept?.thumbUrl };
    const recent = (Array.isArray(b.recent) ? b.recent : []).slice(-8).map((l) => ({ who: l?.who === 'karl' ? 'karl' : 'luma', say: s(l?.say, 400) })).filter((l) => l.say);
    const covered = (Array.isArray(b.covered) ? b.covered : []).slice(-12).map((x) => s(x, 200)).filter(Boolean);
    const base = { type, concept, cityName: cityNames[city], facts, recent, covered, question, nextUp: s(b.nextUp, 120), segmentNo: Math.max(1, Math.min(100000, +b.segmentNo || 1)), cube };

    const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    const add = (u) => { for (const k of Object.keys(usage)) usage[k] += u[k] || 0; };
    let { out, usage: u1 } = await callClaude(userPrompt(base)); add(u1);
    let { lines, rejected } = validate(out, facts, ctx);
    let repaired = false;
    if (lines.length < 4 && rejected.length) {
      const fix = `\n\n<fix>\nYour previous draft broke the grounding rules. These lines were rejected:\n${rejected.map((r) => `- "${r.say}" — ${r.reasons.join('; ')}`).join('\n')}\nWrite the whole segment again, using only the facts and citing them.\n</fix>`;
      const second = await callClaude(userPrompt(base) + fix); add(second.usage);
      const v2 = validate(second.out, facts, ctx);
      if (v2.lines.length > lines.length) { rejected = [...rejected, ...v2.rejected]; lines = v2.lines; out = second.out; repaired = true; }
    }
    if (lines.length < 3) return res.status(422).json({ error: 'Could not write a grounded segment this time.', rejected, usage, model: MODEL });

    return res.status(200).json({
      model: MODEL, usage, repaired, rejected,
      segment: { id: randomUUID().slice(0, 8), type, conceptId: concept?.id, conceptTitle: concept?.title, city, cityName: cityNames[city], thumbUrl: concept?.thumbUrl || '', question: question || undefined,
        title: s(out.title, 80) || concept?.title || 'Live', summary: s(out.summary, 240), lines }
    });
  } catch (err) {
    console.error('studio-script', err);
    return res.status((err && err.status) || 500).json({ error: (err && err.message) || String(err) });
  }
}
