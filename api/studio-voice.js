// /api/studio-voice.js — premium presenter voices with exact word timings (ElevenLabs).
//
//   GET  /api/studio-voice                  -> { ready, provider, model }                      (studio key)
//   POST /api/studio-voice  { who, text }   -> { audio (base64), mime, words: [{ i, s, e }] }  (studio key)
//        i = character index of the word in `text`, s/e = start/end in seconds
//
// Environment (Vercel → Settings → Environment Variables):
//   ELEVENLABS_API_KEY       the ElevenLabs key. Never sent to the browser.
//   ELEVENLABS_VOICE_LUMA    voice id for Luma  (from the ElevenLabs Voice Library)
//   ELEVENLABS_VOICE_KARL    voice id for Karl
//   ELEVENLABS_MODEL         optional, default eleven_multilingual_v2
// Without these the studio simply keeps using the browser's voices.
//
// Scripted lines repeat in the marathon, so each rendered line is kept in the Blob store
// (studio-voice/<hash>.json) and served from there next time — paid for once.

import { createHash, timingSafeEqual } from 'node:crypto';
import { put, head } from '@vercel/blob';
import { hasStore } from './_lib.js';

const API = (process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/$/, '');
const MODEL = (process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2').trim();
const FORMAT = 'mp3_44100_128';
const VOICES = () => ({ luma: (process.env.ELEVENLABS_VOICE_LUMA || '').trim(), karl: (process.env.ELEVENLABS_VOICE_KARL || '').trim() });
const ready = () => Boolean((process.env.ELEVENLABS_API_KEY || '').trim() && VOICES().luma && VOICES().karl);

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
// public base URL of the Blob store, learned from the first head()/put(); after that a cached line is a
// plain CDN fetch instead of a head() call (head() counts as an advanced Blob operation on your plan)
let blobBase = '';
const baseOf = (url, path) => (url && url.endsWith(path) ? url.slice(0, -path.length) : '');
const hits = new Map();
function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();
  const now = Date.now(), win = (hits.get(ip) || []).filter((t) => now - t < 60000);
  win.push(now); hits.set(ip, win);
  return win.length > 40;
}

/** word timings from ElevenLabs' character alignment */
function wordsFrom(text, al) {
  const chars = al?.characters || [], st = al?.character_start_times_seconds || [], en = al?.character_end_times_seconds || [];
  // alignment normally mirrors the input text; map by walking both strings
  const map = new Array(text.length).fill(-1);
  for (let i = 0, j = 0; i < text.length && j < chars.length; i++) {
    if (text[i] === chars[j]) { map[i] = j; j++; }
    else if (/\s/.test(text[i])) continue;
    else { const k = chars.indexOf(text[i], j); if (k >= 0 && k - j < 4) { map[i] = k; j = k + 1; } }
  }
  const out = []; const re = /\S+/g; let m;
  while ((m = re.exec(text))) {
    const idx = [...Array(m[0].length).keys()].map((k) => map[m.index + k]).filter((v) => v >= 0);
    if (!idx.length) continue;
    out.push({ i: m.index, s: +st[idx[0]].toFixed(3), e: +en[idx[idx.length - 1]].toFixed(3) });
  }
  return out;
}

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    if (!authorised(req)) return res.status(401).json({ error: 'Studio key missing or wrong.' });
    if (req.method === 'GET') {
      const missing = [['ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY], ['ELEVENLABS_VOICE_LUMA', VOICES().luma], ['ELEVENLABS_VOICE_KARL', VOICES().karl]].filter(([, v]) => !v).map(([k]) => k);
      const out = { ready: ready(), provider: 'elevenlabs', model: MODEL, missing,
        // changes whenever a voice or the model changes, so browsers drop their cached lines
        vkey: createHash('sha1').update(`${VOICES().luma}|${VOICES().karl}|${MODEL}|${FORMAT}`).digest('hex').slice(0, 12) };
      // ?probe=1 → a real two-word request per voice, so the studio can show ElevenLabs' own error
      if (ready() && String(req.query?.probe || new URL(req.url, 'http://x').searchParams.get('probe')) === '1') {
        out.probe = {};
        for (const who of ['luma', 'karl']) {
          try {
            const r = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(VOICES()[who].trim())}/with-timestamps?output_format=${FORMAT}`, {
              method: 'POST', signal: AbortSignal.timeout(20000),
              headers: { 'content-type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY.trim() },
              body: JSON.stringify({ text: 'Hello there.', model_id: MODEL })
            });
            out.probe[who] = r.ok ? 'ok' : `ElevenLabs ${r.status}: ${(await r.text()).slice(0, 200)}`;
          } catch (e) { out.probe[who] = `request failed: ${e.message}`; }
        }
        out.ready = Object.values(out.probe).every((v) => v === 'ok');
      }
      return res.status(200).json(out);
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
    if (!ready()) return res.status(503).json({ error: 'Premium voices are not set up (ELEVENLABS_API_KEY, ELEVENLABS_VOICE_LUMA, ELEVENLABS_VOICE_KARL).' });
    if (rateLimited(req)) return res.status(429).json({ error: 'Too many voice requests.' });

    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const who = b.who === 'karl' ? 'karl' : 'luma';
    const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 700);
    if (!text) return res.status(400).json({ error: 'No text.' });
    const voice = VOICES()[who];
    const key = createHash('sha1').update(`${voice}|${MODEL}|${FORMAT}|${text}`).digest('hex');
    const path = `studio-voice/${key}.json`;

    if (hasStore()) {
      if (blobBase) {
        try { const r = await fetch(blobBase + path); if (r.ok) { res.setHeader('x-voice-cache', 'hit'); return res.status(200).json(await r.json()); } } catch { /* fall through */ }
      }
      // not found by URL (or base unknown yet): ask the store itself before paying ElevenLabs
      try { const h = await head(path); blobBase ||= baseOf(h.url, path); const r = await fetch(h.url); if (r.ok) { res.setHeader('x-voice-cache', 'hit'); return res.status(200).json(await r.json()); } } catch { /* not cached yet */ }
    }
    let r;
    for (let attempt = 0; attempt < 3; attempt++) {
      r = await fetch(`${API}/v1/text-to-speech/${encodeURIComponent(voice)}/with-timestamps?output_format=${FORMAT}`, {
        method: 'POST', signal: AbortSignal.timeout(45000),
        headers: { 'content-type': 'application/json', 'xi-api-key': process.env.ELEVENLABS_API_KEY.trim() },
        body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true } })
      });
      if (r.ok || ![429, 500, 502, 503].includes(r.status)) break;
      await new Promise((ok) => setTimeout(ok, 700 * 2 ** attempt));
    }
    if (!r.ok) return res.status(502).json({ error: `ElevenLabs ${r.status}: ${(await r.text()).slice(0, 240)}` });
    const j = await r.json();
    const out = { audio: j.audio_base64, mime: 'audio/mpeg', words: wordsFrom(text, j.alignment || j.normalized_alignment) };
    if (hasStore()) { try { const b = await put(path, JSON.stringify(out), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }); blobBase ||= baseOf(b?.url, path); } catch (e) { console.warn('voice cache write failed', e?.message); } }
    return res.status(200).json(out);
  } catch (err) {
    console.error('studio-voice', err);
    return res.status((err && err.status) || 500).json({ error: (err && err.message) || String(err) });
  }
}
