// /api/_lib.js — shared helpers. Files starting with "_" are not deployed as routes.
import { timingSafeEqual } from 'node:crypto';

export const CHANNELS = ['skylights', 'pavilions', 'residences', 'heritage', 'studios'];
export const MECHANISMS = ['slide', 'hinged', 'louvre', 'none'];
export const MEDIA = 'concepts/media/';

export function hasStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

// Admin writes are allowed only with the ADMIN_KEY environment variable.
// If ADMIN_KEY is not set, every write is refused.
export function isAdmin(req) {
  const expected = process.env.ADMIN_KEY || '';
  const given = String(req.headers['x-admin-key'] || '');
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function str(v, max = 200) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

// Media must live in this project's Blob store, or be a file shipped with the site under /img/.
export function safeMediaUrl(v) {
  const s = str(v, 1000);
  if (!s) return '';
  if (/^\/img\/[\w\-./]+$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com')) return u.toString();
  } catch { /* fall through */ }
  return '';
}

// True for a Blob file stored under concepts/media/<id>/ — the only media we ever delete.
export function isOwnMedia(url, id) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('.blob.vercel-storage.com') && u.pathname.startsWith(`/${MEDIA}${id}/`);
  } catch { return false; }
}

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'concept';
}

// Opens a download from Meshy's asset CDN (only *.meshy.ai), retrying its transient
// 502/503/504s. Returns the Response so the body can be streamed, not buffered.
export async function fetchMeshy(rawUrl, timeoutMs = 50000) {
  let u;
  try { u = new URL(rawUrl); } catch { throw Object.assign(new Error('Malformed Meshy link.'), { status: 400 }); }
  if (u.protocol !== 'https:' || !(u.hostname === 'meshy.ai' || u.hostname.endsWith('.meshy.ai'))) {
    throw Object.assign(new Error('Only *.meshy.ai asset links can be imported.'), { status: 400 });
  }
  let r;
  for (let attempt = 1; attempt <= 4; attempt++) {
    r = await fetch(u, { signal: AbortSignal.timeout(timeoutMs) });
    if (![502, 503, 504].includes(r.status)) break;
    await new Promise((ok) => setTimeout(ok, 300 * 2 ** (attempt - 1)));
  }
  if (!r.ok) throw Object.assign(new Error(`Meshy returned HTTP ${r.status}. If the link is old it has probably expired — copy a fresh one from Meshy.`), { status: 400 });
  return r;
}

// Passes a stream through unchanged, failing it once more than maxBytes have gone by.
export function capStream(body, maxBytes, message) {
  let seen = 0;
  return body.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      seen += chunk.byteLength;
      if (seen > maxBytes) ctl.error(Object.assign(new Error(message), { status: 413 }));
      else ctl.enqueue(chunk);
    },
  }));
}
