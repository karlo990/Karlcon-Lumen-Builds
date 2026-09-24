/* KARLCON — in-browser GLB optimiser.
   Built into /vendor/glb-optimizer.js by build.mjs (npm run build in this folder).

   Meshy models are ~90% texture data (2048 px PNG + JPEG maps), and the "High detail"
   setting returns the raw, un-remeshed triangle soup on top of that — easily 60–200 MB.
   This shrinks any GLB to something a phone can open, without a server:
     1. dedup / prune / weld            lossless clean-up
     2. simplify (meshoptimizer)        only when the mesh is over the preset's triangle budget
     3. textures → JPEG, resized        base colour keeps its resolution longest; PNG kept only where alpha is used
     4. EXT_meshopt_compression         quantised + compressed geometry (three r128 and model-viewer both decode it) */
import { WebIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, meshopt, listTextureSlots } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

export const PRESETS = {
  web:  { label: 'Web',         maxTris: 60000,  baseTex: 2048, otherTex: 1024, quality: 0.84 },
  high: { label: 'High detail', maxTris: 600000, baseTex: 2048, otherTex: 2048, quality: 0.9 },
};

function countTris(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    if (p.getMode() !== 4) continue;                                 // TRIANGLES only
    const idx = p.getIndices(), pos = p.getAttribute('POSITION');
    n += (idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3;
  }
  return Math.round(n);
}

function needsAlpha(doc, texture) {
  for (const m of doc.getRoot().listMaterials()) {
    if (m.getBaseColorTexture() === texture && m.getAlphaMode() !== 'OPAQUE') return true;
  }
  return false;
}

async function encodeImage(bitmap, type, quality) {
  if (typeof OffscreenCanvas !== 'undefined') {
    const cv = new OffscreenCanvas(bitmap.width, bitmap.height);
    cv.getContext('2d').drawImage(bitmap, 0, 0);
    return new Uint8Array(await (await cv.convertToBlob({ type, quality })).arrayBuffer());
  }
  const cv = document.createElement('canvas');
  cv.width = bitmap.width; cv.height = bitmap.height;
  cv.getContext('2d').drawImage(bitmap, 0, 0);
  const blob = await new Promise((ok) => cv.toBlob(ok, type, quality));
  return new Uint8Array(await blob.arrayBuffer());
}

async function recodeTexture(doc, texture, preset) {
  const src = texture.getImage(), mime = texture.getMimeType();
  if (!src || !/^image\/(png|jpeg|webp)$/.test(mime)) return null;  // leave KTX2/AVIF alone
  const slots = listTextureSlots(texture);
  const colour = slots.some((s) => /baseColor|emissive|diffuse/i.test(s));
  const normal = slots.some((s) => /normal/i.test(s));
  const alpha = needsAlpha(doc, texture);
  const limit = colour ? preset.baseTex : preset.otherTex;
  // colorSpaceConversion/premultiplyAlpha 'none' keep normal and metal/rough data exact.
  const probe = await createImageBitmap(new Blob([src], { type: mime }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const s = Math.min(1, limit / Math.max(probe.width, probe.height));
  const w = Math.max(1, Math.round(probe.width * s)), h = Math.max(1, Math.round(probe.height * s));
  let bmp = probe;
  if (s < 1) {
    probe.close();
    bmp = await createImageBitmap(new Blob([src], { type: mime }), { resizeWidth: w, resizeHeight: h, resizeQuality: 'high', colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  }
  const type = alpha ? 'image/png' : 'image/jpeg';
  const out = await encodeImage(bmp, type, normal ? Math.max(preset.quality, 0.92) : preset.quality);
  bmp.close();
  if (s === 1 && out.byteLength >= src.byteLength) return { w, h, kept: true };
  texture.setImage(out).setMimeType(type);
  const uri = texture.getURI();
  if (uri) texture.setURI(uri.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'));
  return { w, h, kept: false };
}

/**
 * @param {ArrayBuffer|Uint8Array} input  GLB bytes
 * @param {'web'|'high'} presetName
 * @param {(step:string)=>void} [onStep]
 * @returns {Promise<{glb:Uint8Array, stats:object}>}
 */
export async function optimizeGLB(input, presetName = 'web', onStep = () => {}) {
  const preset = PRESETS[presetName] || PRESETS.web;
  const bytesIn = input.byteLength;
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
  const io = new WebIO().setLogger(new Logger(Logger.Verbosity.WARN)).registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

  onStep('Reading model');
  const doc = await io.readBinary(input instanceof Uint8Array ? input : new Uint8Array(input));
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  if (doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'KHR_draco_mesh_compression')) {
    throw new Error('This GLB is Draco-compressed already; upload it as it is.');
  }
  const trisIn = countTris(doc);

  onStep('Cleaning geometry');
  await doc.transform(dedup(), prune(), weld());

  if (trisIn > preset.maxTris) {
    onStep(`Reducing ${trisIn.toLocaleString()} triangles to about ${preset.maxTris.toLocaleString()}`);
    const ratio = preset.maxTris / trisIn;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }));
    // A tight error bound can stop early on noisy scans; relax once if still well over budget.
    if (countTris(doc) > preset.maxTris * 1.2) {
      await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: preset.maxTris / countTris(doc), error: 0.02 }));
    }
  }

  const textures = doc.getRoot().listTextures();
  let texMax = 0;
  for (let i = 0; i < textures.length; i++) {
    onStep(`Compressing texture ${i + 1} of ${textures.length}`);
    const r = await recodeTexture(doc, textures[i], preset);
    if (r) texMax = Math.max(texMax, r.w, r.h);
  }

  onStep('Compressing geometry');
  await doc.transform(prune(), meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizeTexcoord: 14 }));
  const glb = await io.writeBinary(doc);
  return {
    glb,
    stats: { preset: presetName, bytesIn, bytesOut: glb.byteLength, trisIn, trisOut: countTris(doc), texMax },
  };
}
