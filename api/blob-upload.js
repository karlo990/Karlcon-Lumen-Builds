// /api/blob-upload.js — issues short-lived tokens so the admin page can upload
// thumbnails and GLB models straight from the browser to Vercel Blob.
// This bypasses the 4.5 MB request limit on serverless functions.
import { handleUpload } from '@vercel/blob/client';
import { isAdmin } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

  if (body.type === 'blob.generate-client-token' && !isAdmin(req)) {
    return res.status(401).json({ error: 'Admin key missing or wrong.' });
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!/^concepts\/media\/[a-z0-9-]+\/((thumb|source|view-[1-3])\.(webp|jpg|png)|model\.glb)$/.test(pathname)) {
          throw new Error('Uploads must go to concepts/media/<id>/thumb.*, source.*, view-1..3.* or model.glb');
        }
        const isModel = pathname.endsWith('.glb');
        return {
          allowedContentTypes: isModel
            ? ['model/gltf-binary', 'application/octet-stream']
            : ['image/webp', 'image/jpeg', 'image/png'],
          maximumSizeInBytes: (isModel ? 60 : 6) * 1024 * 1024,
          addRandomSuffix: true,
          cacheControlMaxAge: 31536000,
        };
      },
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: (err && err.message) || String(err) });
  }
}
