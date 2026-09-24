// /api/_lib.js — shared helpers. Files starting with "_" are not deployed as routes.
import { timingSafeEqual } from 'node:crypto';

export const CHANNELS = ['skylights', 'pavilions', 'residences', 'heritage', 'studios'];
export const MECHANISMS = ['slide', 'hinged', 'louvre', 'none'];

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

export function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'concept';
}
