// /api/_studio-facts.js — everything the live hosts are allowed to say comes from here.
// Files starting with "_" are not deployed as routes.
//
// Sources, in order of authority:
//   1. The concept library: built-in catalogue (concepts-data.js) merged with the
//      concepts saved through /?admin (Vercel Blob). Titles, taglines, specs, status.
//   2. SITE facts below — copied from the public site (footer, "How a concept earns its
//      place", the planner notes).
//   3. ZIMBABWE facts below — plain, well-known context, written without figures.
//   4. INTENT facts below — KARLCON design intentions. KARL: CHECK THESE. The hosts will
//      say them on air as things KARLCON designs for. Delete any line that is not true.
//
// Every generated line must cite fact ids, and any number it speaks must appear in a
// cited fact. Anything else is rejected before it reaches the hosts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { list } from '@vercel/blob';
import { hasStore } from './_lib.js';

export const SITE = {
  'co.who': 'KARLCON Lumen Builds is part of KARLCON in Harare, Zimbabwe. It designs automated roof lights and aluminium daylight work for homes.',
  'co.family': 'The KARLCON family: Lumen Builds, Elite Retreats, and Earthmoving and Construction.',
  'co.aluminium': 'KARLCON fabricates and installs aluminium frames itself.',
  'co.follow': 'Viewers can follow the build on the KARLCON Lumen Builds Instagram page.',
  'co.talk': 'Viewers can message Karl on Instagram to talk about a roof light for their own room.',
  'co.disclaimer': 'Concept imagery is AI-assisted and indicative. Final designs follow a site survey and structural design by a registered engineer.',
  'proc.rendered': 'Step one, Rendered: the idea is visualised in the space it belongs to.',
  'proc.specified': 'Step two, Specified: glass, mechanism and drive are chosen for that exact opening.',
  'proc.checked': 'Step three, Checked: wind uplift, glass stress and deflection are calculated, not assumed.',
  'proc.proven': 'Step four, Proven: the design is built on the test rig and water-tested before it is offered to anyone.',
  'proc.label': 'Every concept stays labelled Concept until it has been built and water-tested.',
  'proc.model3d': 'Each concept starts as a render. The building is turned into a 3D model, and the real roof-light mechanism is mounted on it so people can see how the roof opens.',
  'plan.size': 'The skylight planner sizes the opening from the room length, the room width, and a soft, balanced or bright daylight level.',
  'plan.glass': 'The planner compares clear, grey and low-e glass by how much heat each lets into the room at noon.',
  'plan.edge': 'A roof light should sit at least 1 m from the roof edges. A site survey confirms the opening, its position and the structure.',
  'proc.newroofs': 'The fan roof, the folding crown and the telescoping oval roof are concept mechanisms still to be engineered, so no figures are quoted for them yet.',
  'show.atlas': 'The studio Atlas globe marks Harare, Bulawayo, Mutare, Masvingo and Victoria Falls. Each segment can fly to a different city.',
  'show.comments': 'Viewers can drop their city in the comments to choose where the Atlas flies next.'
};

export const ZIMBABWE = {
  'zw.rain': 'Zimbabwe’s main rainy season is in the summer months, often with heavy afternoon thunderstorms.',
  'zw.sun': 'Sunshine is strong for much of the year, so roof glass has to be chosen for heat as well as light.',
  'zw.power': 'Scheduled power cuts, called load-shedding, are part of life in Zimbabwe.',
  'zw.termites': 'Termites attack timber, so steel and concrete are the safer choice at ground level.',
  'zw.clay': 'Parts of Harare have clay soils that swell and shrink with the rains, so footing depth is set by an engineer after a soil test.',
  'city.harare': 'Harare is the capital of Zimbabwe and its largest city.',
  'city.bulawayo': 'Bulawayo is Zimbabwe’s second-largest city, in the south-west, not far from the Matobo Hills.',
  'city.mutare': 'Mutare is in the east of Zimbabwe, close to the Eastern Highlands and the border with Mozambique.',
  'city.masvingo': 'Masvingo is in the south-east of Zimbabwe, near the ruins of Great Zimbabwe.',
  'city.vicfalls': 'Victoria Falls is the town beside the waterfall of the same name, on the Zambezi River.',
  'her.greatzim': 'The stone walls of Great Zimbabwe carry a chevron pattern.',
  'her.drystone': 'The walls of Great Zimbabwe were built of granite blocks laid without mortar, known as dry-stone walling.',
  'zw.kopjes': 'Granite hills and boulders, called kopjes, are common across much of Zimbabwe.',
  'her.rondavel': 'The rondavel, a round house with a conical roof, is a traditional Zimbabwean building form.'
};

// KARL: CHECK THESE — they are spoken as KARLCON design intentions.
export const INTENT = {
  'int.rainsensor': 'KARLCON designs its automated roofs to close on a rain sensor.',
  'int.backup': 'KARLCON designs its automated roofs with battery backup and a manual override, so a power cut never leaves a roof open.',
  'int.watertest': 'Every roof light is water-tested on the rig before handover.'
};

export const CITIES = ['harare', 'bulawayo', 'mutare', 'masvingo', 'vicfalls'];
const MECH = {
  hinged: 'glass leaves hinged at the edges and lifted by electric actuators',
  slide: 'a glass panel that lifts off its seal and slides across the roof',
  louvre: 'rotating aluminium blades driven by one actuator'
};

/* ---------- the concept library ---------- */
let cache = { at: 0, concepts: null };

function readSeed() {
  const src = readFileSync(join(process.cwd(), 'concepts-data.js'), 'utf8');
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox, { timeout: 500 });
  return { seed: sandbox.window.KC_SEED || [], channels: sandbox.window.KC_CHANNELS || [] };
}
async function readLibrary() {
  if (!hasStore()) return [];
  const PREFIX = 'concepts/items/';
  const blobs = []; let cursor;
  do { const r = await list({ prefix: PREFIX, cursor, limit: 1000 }); blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  const newest = new Map();
  for (const b of blobs) {
    const id = b.pathname.slice(PREFIX.length).split('/')[0];
    const prev = newest.get(id);
    if (!prev || new Date(b.uploadedAt) > new Date(prev.uploadedAt)) newest.set(id, b);
  }
  const items = await Promise.all([...newest.values()].map(async (b) => {
    try { const r = await fetch(b.url, { cache: 'no-store', signal: AbortSignal.timeout(8000) }); return r.ok ? await r.json() : null; } catch { return null; }
  }));
  return items.filter(Boolean);
}

/** Built-in catalogue with library edits applied; hidden concepts removed. Cached for 2 minutes. */
export async function loadConcepts() {
  if (cache.concepts && Date.now() - cache.at < 120000) return cache.concepts;
  const { seed, channels } = readSeed();
  let lib = [];
  try { lib = await readLibrary(); } catch (e) { console.warn('studio: library unavailable, using built-in catalogue', e?.message); }
  const byId = new Map(seed.map((c) => [c.id, { ...c }]));
  for (const c of lib) if (c && c.id) byId.set(c.id, { ...(byId.get(c.id) || {}), ...c });
  const chName = Object.fromEntries(channels.map((c) => [c.id, c.name]));
  const concepts = [...byId.values()].filter((c) => !c.hidden && c.title)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((c) => ({ ...c, roof: c.roof || seed.find((x) => x.id === c.id)?.roof, channelName: chName[c.channel] || c.channel }));
  cache = { at: Date.now(), concepts };
  return concepts;
}

export function conceptFacts(c) {
  const p = `c.${c.id}`;
  const f = {};
  f[`${p}.title`] = `${c.title} is a KARLCON Lumen Builds concept on the ${c.channelName || c.channel} channel.`;
  if (c.tagline) f[`${p}.tagline`] = `${c.title}: ${c.tagline}`;
  f[`${p}.status`] = `${c.title} is currently labelled ${c.status || 'Concept'}.`;
  if (c.roof) f[`${p}.mech`] = `${c.title} has a roof light made of ${c.roof}.`;
  else if (MECH[c.mechanism]) f[`${p}.mech`] = `${c.title} uses ${MECH[c.mechanism]}.`;
  (c.specs || []).forEach((s, i) => { if (s && s.k && s.v && s.k !== 'Status') f[`${p}.spec${i + 1}`] = `${c.title}, ${s.k}: ${s.v}.`; });
  return f;
}

/** The facts one segment may use: site + Zimbabwe + intent + the concept + the city. */
export function factsFor({ concept, city, others = [] }) {
  const f = { ...SITE, ...INTENT };
  for (const [k, v] of Object.entries(ZIMBABWE)) if (!k.startsWith('city.') || k === `city.${city}`) f[k] = v;
  if (concept) Object.assign(f, conceptFacts(concept));
  for (const o of others.slice(0, 3)) f[`c.${o.id}.title`] = `${o.title} is a KARLCON Lumen Builds concept on the ${o.channelName || o.channel} channel.`;
  return f;
}

/** Every fact the studio knows — shown in the Writers' Room. */
export async function allFacts() {
  const concepts = await loadConcepts();
  const f = { ...SITE, ...ZIMBABWE, ...INTENT };
  for (const c of concepts) Object.assign(f, conceptFacts(c));
  return f;
}
