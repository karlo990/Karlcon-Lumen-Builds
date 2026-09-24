// /api/model-import.js — staging for full-size Meshy models.
//
//   POST   /api/model-import         {id, url}  -> {url, bytes}   (admin)
//   DELETE /api/model-import?id=<id>            -> {removed}     (admin)
//
// Meshy's CDN does not allow browser downloads (no CORS), and "High detail" GLBs are
// often 60–200 MB — too big to buffer in a function. POST streams the file from Meshy
// straight into Blob as concepts/media/<id>/raw-model-*.glb. The admin page then
// downloads that copy, optimises it in the browser, uploads the small result as the
// concept's model.glb, and calls DELETE to remove the raw copy.
import { put, list, del, head } from '@vercel/blob';
import { MEDIA, hasStore, isAdmin, slug, str, fetchMeshy, capStream } from './_lib.js';

const MAX_RAW_BYTES = 500 * 1024 * 1024;

async function removeRaw(id) {
  const { blobs } = await list({ prefix: `${MEDIA}${id}/raw-model`, limit: 100 });
  if (blobs.length) await del(blobs.map((b) => b.url));
  return blobs.length;
}

export default async function handler(req, res) {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: 'Admin key missing or wrong.' });
    if (!hasStore()) return res.status(503).json({ error: 'No Blob store connected to this project yet.' });

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!body.id) return res.status(400).json({ error: 'Missing id.' });
      const id = slug(body.id);
      const r = await fetchMeshy(str(body.url, 2000));
      const len = Number(r.headers.get('content-length')) || 0;
      if (len > MAX_RAW_BYTES) return res.status(413).json({ error: `Meshy's file is ${Math.round(len / 1048576)} MB — over the 500 MB import limit.` });
      await removeRaw(id);                                            // earlier attempts for this concept
      const saved = await put(`${MEDIA}${id}/raw-model.glb`,
        capStream(r.body, MAX_RAW_BYTES, 'Meshy\'s file is over the 500 MB import limit.'), {
          access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary',
          cacheControlMaxAge: 60, multipart: true,
        });
      const bytes = len || (await head(saved.url)).size;
      return res.status(200).json({ url: saved.url, bytes });
    }

    if (req.method === 'DELETE') {
      if (!req.query.id) return res.status(400).json({ error: 'Missing id.' });
      return res.status(200).json({ removed: await removeRaw(slug(req.query.id)) });
    }

    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    return res.status((err && err.status) || 500).json({ error: (err && err.message) || String(err) });
  }
}
