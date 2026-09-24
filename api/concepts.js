// /api/concepts.js — the concept library's memory.
//
//   GET    /api/concepts            -> { configured, concepts: [...] }      (public)
//   POST   /api/concepts            -> create or update one concept         (admin)
//   DELETE /api/concepts?id=<id>    -> remove a concept and its media       (admin)
//
// Storage: Vercel Blob. Each concept is one JSON file at
//   concepts/items/<id>/meta-<random>.json
// Every save writes a NEW file and deletes the old one, so the public CDN can
// never serve a stale version. Thumbnails and GLBs live under concepts/media/<id>/.

import { put, list, del } from '@vercel/blob';
import { CHANNELS, MECHANISMS, hasStore, isAdmin, str, safeMediaUrl, slug } from './_lib.js';

const ITEMS = 'concepts/items/';
const MEDIA = 'concepts/media/';
const MAX_GLB_BYTES = 60 * 1024 * 1024;

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

function clean(body, existing) {
  const specs = Array.isArray(body.specs) ? body.specs.slice(0, 8)
    .map((s) => ({ k: str(s && s.k, 40), v: str(s && s.v, 80) }))
    .filter((s) => s.k && s.v) : [];
  const m = body.massing || {};
  const num = (x, lo, hi, d) => (Number.isFinite(+x) ? Math.min(hi, Math.max(lo, +x)) : d);
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
    modelUrl: safeMediaUrl(body.modelUrl),
    modelBytes: Number.isFinite(+body.modelBytes) ? +body.modelBytes : 0,
    modelGeneratedAt: str(body.modelGeneratedAt, 40),
    meshyTaskId: str(body.meshyTaskId, 80),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Meshy's signed asset links expire, so a concept must never point at them.
// We fetch the GLB server-side once and keep a permanent copy in Blob.
async function importMeshyGlb(id, rawUrl) {
  const u = new URL(rawUrl);
  if (!(u.hostname === 'meshy.ai' || u.hostname.endsWith('.meshy.ai'))) {
    throw Object.assign(new Error('Only *.meshy.ai asset links can be imported.'), { status: 400 });
  }
  let r;
  for (let attempt = 1; attempt <= 4; attempt++) {
    r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (![502, 503, 504].includes(r.status)) break;
    await new Promise((ok) => setTimeout(ok, 300 * 2 ** (attempt - 1)));
  }
  if (!r.ok) throw Object.assign(new Error(`Meshy returned HTTP ${r.status}. If the link is old it has probably expired — copy a fresh one from Meshy.`), { status: 400 });
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_GLB_BYTES) throw Object.assign(new Error('Model is larger than 60 MB. Reduce polygons or Draco-compress it first.'), { status: 400 });
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
      if (body.clearModel) Object.assign(merged, { modelUrl: '', modelBytes: 0, modelGeneratedAt: '' });
      const concept = clean(merged, existing);
      concept.id = id;
      if (!concept.title) return res.status(400).json({ error: 'Title is required.' });
      if (body.meshyUrl) {
        const got = await importMeshyGlb(id, str(body.meshyUrl, 2000));
        Object.assign(concept, { modelUrl: got.url, modelBytes: got.bytes, modelGeneratedAt: new Date().toISOString(), meshyTaskId: '' });
      }

      await put(`${ITEMS}${id}/meta.json`, JSON.stringify(concept), {
        access: 'public', addRandomSuffix: true, contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      if (oldBlobs.length) await del(oldBlobs.map((b) => b.url));
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
