// /api/concepts.js — the concept library's memory.
//
//   GET    /api/concepts            -> { configured, concepts: [...] }      (public)
//   POST   /api/concepts            -> create or update one concept         (admin)
//   DELETE /api/concepts?id=<id>    -> remove a concept and its media       (admin)
//
// Storage: Vercel Blob. Each concept is one JSON file at
//   concepts/items/<id>/meta-<random>.json
// Every save writes a NEW file and deletes the old one, so the public CDN can
// never serve a stale version. Thumbnails and GLBs live under concepts/media/<id>/;
// when a save replaces one of them, the old file is deleted so the store never
// fills up with orphaned models.

import { put, list, del } from '@vercel/blob';
import { CHANNELS, MECHANISMS, MEDIA, hasStore, isAdmin, isOwnMedia, str, safeMediaUrl, slug, fetchMeshy, capStream } from './_lib.js';

const ITEMS = 'concepts/items/';
const MAX_GLB_BYTES = 60 * 1024 * 1024;
const MEDIA_KEYS = ['thumbUrl', 'meshySource', 'modelUrl'];

async function listAll(prefix) {
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    out.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out;
}

async function readConcepts() {
  const blobs = await listAll(ITEMS);
  const newest = new Map();                       // id -> newest meta blob
  for (const b of blobs) {
    const id = b.pathname.slice(ITEMS.length).split('/')[0];
    const prev = newest.get(id);
    if (!prev || new Date(b.uploadedAt) > new Date(prev.uploadedAt)) newest.set(id, b);
  }
  const items = await Promise.all([...newest.values()].map(async (b) => {
    try {
      const r = await fetch(b.url, { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }));
  return items.filter(Boolean).sort((a, b) =>
    (a.order ?? 999) - (b.order ?? 999) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

const num = (x, lo, hi, d) => (x !== null && x !== '' && Number.isFinite(+x) ? Math.min(hi, Math.max(lo, +x)) : d);

// Where the engineered KARLCON skylight sits on a generated model (see mountSkylight in concepts.html).
// x/z: offset from the model's centre as a fraction of its footprint; dy: metres; rot: degrees;
// scale: size against the 2.0 × 1.5 m benchmark aperture; len: stretches its length only.
function cleanSkylight(v) {
  if (!v || typeof v !== 'object') return null;
  return {
    mode: ['auto', 'manual', 'off'].includes(v.mode) ? v.mode : 'auto',
    x: num(v.x, -0.5, 0.5, 0),
    z: num(v.z, -0.5, 0.5, 0),
    dy: num(v.dy, -3, 3, 0),
    scale: num(v.scale, 0.3, 3, 1),
    len: num(v.len, 0.5, 3, 1),
    rot: num(v.rot, -180, 180, 0),
    cut: v.cut !== false,
  };
}

// What the browser optimiser did to the stored model — shown on /developer.
function cleanModelInfo(v) {
  if (!v || typeof v !== 'object') return null;
  return {
    preset: str(v.preset, 12),
    bytesIn: num(v.bytesIn, 0, 1e10, 0),
    trisIn: num(v.trisIn, 0, 1e9, 0),
    trisOut: num(v.trisOut, 0, 1e9, 0),
    texMax: num(v.texMax, 0, 16384, 0),
  };
}

function clean(body, existing) {
  const specs = Array.isArray(body.specs) ? body.specs.slice(0, 8)
    .map((s) => ({ k: str(s && s.k, 40), v: str(s && s.v, 80) }))
    .filter((s) => s.k && s.v) : [];
  const m = body.massing || {};
  return {
    id: existing?.id,
    title: str(body.title, 80),
    channel: CHANNELS.includes(body.channel) ? body.channel : 'skylights',
    mechanism: MECHANISMS.includes(body.mechanism) ? body.mechanism : 'slide',
    tagline: str(body.tagline, 220),
    specs,
    status: str(body.status, 40) || 'Concept',
    featured: Boolean(body.featured),
    hidden: Boolean(body.hidden),
    order: num(body.order, 0, 999, 100),
    massing: { w: num(m.w, 2, 40, 8), d: num(m.d, 2, 40, 6), h: num(m.h, 2, 30, 3.2) },
    arWidth: num(body.arWidth, 0, 80, 0),
    thumbUrl: safeMediaUrl(body.thumbUrl),
    meshySource: safeMediaUrl(body.meshySource),
    // extra angles of the same building (right, back, roof) for Meshy multi-image to 3D; meshySource is the front
    meshyViews: (Array.isArray(body.meshyViews) ? body.meshyViews : []).map(safeMediaUrl).filter(Boolean).slice(0, 3),
    modelUrl: safeMediaUrl(body.modelUrl),
    modelBytes: Number.isFinite(+body.modelBytes) ? +body.modelBytes : 0,
    modelGeneratedAt: str(body.modelGeneratedAt, 40),
    modelInfo: cleanModelInfo(body.modelInfo),
    meshyTaskId: str(body.meshyTaskId, 80),
    skylight: cleanSkylight(body.skylight),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Meshy's signed asset links expire, so a concept must never point at them.
// Direct import stores Meshy's file as it is, so it is kept for small (Web quality) models
// only; /developer and the Studio stage bigger files through /api/model-import and
// optimise them in the browser instead.
const TOO_BIG = 'Model is larger than 60 MB. Use /developer (or the Studio link field), which optimises it in the browser first.';
async function importMeshyGlb(id, rawUrl) {
  const r = await fetchMeshy(rawUrl);
  const len = Number(r.headers.get('content-length')) || 0;
  if (len > MAX_GLB_BYTES) throw Object.assign(new Error(TOO_BIG), { status: 413 });
  const buf = Buffer.from(await new Response(capStream(r.body, MAX_GLB_BYTES, TOO_BIG)).arrayBuffer());
  const saved = await put(`${MEDIA}${id}/model.glb`, buf, {
    access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary',
    cacheControlMaxAge: 31536000,
  });
  return { url: saved.url, bytes: buf.length };
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      if (!hasStore()) return res.status(200).json({ configured: false, concepts: [] });
      const concepts = await readConcepts();
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=300');
      return res.status(200).json({ configured: true, concepts });
    }

    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin key missing or wrong.' });
    if (!hasStore()) return res.status(503).json({ error: 'No Blob store connected to this project yet.' });

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const id = body.id ? slug(body.id) : `${slug(body.title)}-${Date.now().toString(36).slice(-4)}`;
      const oldBlobs = await listAll(`${ITEMS}${id}/`);
      let existing = null;
      if (oldBlobs.length) {
        const latest = oldBlobs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];
        existing = await fetch(latest.url, { cache: 'no-store' }).then((r) => r.json()).catch(() => null);
      }
      // Partial updates: anything not sent keeps its stored value.
      const merged = { ...(existing || {}), ...body };
      if (!('modelUrl' in body) || body.modelUrl === undefined) merged.modelUrl = existing?.modelUrl || '';
      if (body.clearModel) Object.assign(merged, { modelUrl: '', modelBytes: 0, modelGeneratedAt: '', modelInfo: null });
      const concept = clean(merged, existing);
      concept.id = id;
      if (!concept.title) return res.status(400).json({ error: 'Title is required.' });
      if (body.meshyUrl) {
        const got = await importMeshyGlb(id, str(body.meshyUrl, 2000));
        Object.assign(concept, { modelUrl: got.url, modelBytes: got.bytes, modelGeneratedAt: new Date().toISOString(), modelInfo: null, meshyTaskId: '' });
      }

      await put(`${ITEMS}${id}/meta.json`, JSON.stringify(concept), {
        access: 'public', addRandomSuffix: true, contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      // Media this save replaced (an old model, thumbnail or input image) is now unreferenced.
      const replaced = MEDIA_KEYS.map((k) => existing?.[k]).filter((u, i) => u && u !== concept[MEDIA_KEYS[i]] && isOwnMedia(u, id));
      replaced.push(...(existing?.meshyViews || []).filter((u) => !concept.meshyViews.includes(u) && isOwnMedia(u, id)));
      const stale = [...oldBlobs.map((b) => b.url), ...replaced];
      if (stale.length) await del(stale).catch(() => {});
      return res.status(200).json({ ok: true, concept });
    }

    if (req.method === 'DELETE') {
      const id = slug(req.query.id || '');
      if (!id) return res.status(400).json({ error: 'Missing id.' });
      const blobs = [...await listAll(`${ITEMS}${id}/`), ...await listAll(`${MEDIA}${id}/`)];
      if (blobs.length) await del(blobs.map((b) => b.url));
      return res.status(200).json({ ok: true, removed: blobs.length });
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    return res.status((err && err.status) || 500).json({ error: (err && err.message) || String(err) });
  }
}
