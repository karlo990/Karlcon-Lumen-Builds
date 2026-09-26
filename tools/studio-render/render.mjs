#!/usr/bin/env node
/* KARLCON Studio — record the show to an MP4, frame by frame, at full quality.
   The studio runs in a real browser (Edge or Chrome) on a virtual clock (/studio?render): each frame is
   drawn, captured and only then does the clock move on, so the video never lags however slow the PC is.
   The sound (ElevenLabs voices, music, ducking) is mixed offline by the page and muxed in at the end.

     node render.mjs --ep 1                          one scripted episode, 9:16, High quality
     node render.mjs --ep all --out episodes.mp4     all six episodes back to back
     node render.mjs --mode marathon --dur 3h        three hours of the marathon, with Claude's live segments
   Options: --key <studio passcode>  (or set STUDIO_KEY)   --format vertical|landscape   --size 720|1080
            --quality high|standard  --fps 30  --dur 90m|3h|5400 (maximum length)   --music 0  --musicvol 1.6
            --browser msedge|chrome|<path to chrome.exe>  --headed (watch it render)  --url <studio address>
   Ctrl+C stops early and still writes a playable file of everything rendered so far. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { createRequire } from 'node:module';

// Newer npm versions skip install scripts unless approved, which leaves ffmpeg-static without its
// ffmpeg download. Fetch it here instead of failing at the end of a long render.
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  console.log('Downloading ffmpeg (first run only)…');
  const dir = path.dirname(createRequire(import.meta.url).resolve('ffmpeg-static/package.json'));
  const r = spawn(process.execPath, ['install.js'], { cwd: dir, stdio: 'inherit' });
  const code = await new Promise((ok) => r.on('close', ok));
  if (code !== 0 || !fs.existsSync(ffmpegPath)) { console.error('Could not download ffmpeg. Check the internet connection and run this again.'); process.exit(1); }
}

/* ---------- options ---------- */
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]; if (!a.startsWith('--')) continue;
  const k = a.slice(2), v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  opt[k] = v;
}
const seconds = (v) => { if (!v || v === true) return 0; const m = /^([\d.]+)\s*(h|m|s)?$/i.exec(String(v)); if (!m) return 0; return +m[1] * ({ h: 3600, m: 60, s: 1 }[(m[2] || 's').toLowerCase()]); };
const base = String(opt.url || 'https://karlcon-lumen-builds.vercel.app/studio');
const format = opt.format === 'landscape' ? 'landscape' : 'vertical';
const short = +opt.size === 1080 ? 1080 : 720;
const [W, H] = format === 'vertical' ? [short, Math.round(short * 16 / 9)] : [Math.round(short * 16 / 9), short];
const fps = Math.max(10, Math.min(60, +opt.fps || 30));
const quality = opt.quality === 'standard' ? 'standard' : 'high';
const mode = ['marathon', 'live'].includes(opt.mode) ? opt.mode : 'episode';
const eps = mode !== 'episode' ? [null] : opt.ep === 'all' ? [1, 2, 3, 4, 5, 6] : [Math.max(1, Math.min(6, +opt.ep || 1))];
const maxDur = seconds(opt.dur) || (mode === 'episode' ? 4 * 3600 : 3600);
const key = String(opt.key && opt.key !== true ? opt.key : process.env.STUDIO_KEY || '');
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
const out = path.resolve(String(opt.out || `karlcon-${mode === 'episode' ? 'ep' + (opt.ep === 'all' ? 'all' : eps[0]) : mode}-${format}-${stamp}.mp4`));
const bitrate = short === 1080 ? 5000 : 3000;              // Instagram / Facebook Live friendly (stream copies it as is)
const log = (...a) => console.log(new Date().toLocaleTimeString(), ...a);

function studioUrl(ep) {
  const u = new URL(base);
  u.searchParams.set('render', ''); u.searchParams.set('obs', '');
  u.searchParams.set('format', format); u.searchParams.set('q', quality);
  if (mode === 'episode') u.searchParams.set('ep', ep); else u.searchParams.set('mode', mode);
  if (mode === 'marathon') u.searchParams.set('hours', String(Math.max(1, Math.ceil(maxDur / 3600))));
  if (opt.music === '0') u.searchParams.set('music', '0');
  if (opt.musicvol) u.searchParams.set('musicvol', String(opt.musicvol));
  let s = u.toString().replace(/=(?=&|$)/g, '');
  if (key) s += '#key=' + encodeURIComponent(key);             // the fragment never reaches the server
  return s;
}

/* ---------- browser ---------- */
function launchOptions() {
  const args = ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', `--window-size=${W},${H + 120}`];
  const o = { headless: !opt.headed, args };
  const b = opt.browser && opt.browser !== true ? String(opt.browser) : (process.platform === 'win32' ? 'msedge' : 'chrome');
  if (/[\\/]/.test(b)) o.executablePath = b; else o.channel = b;
  if (process.env.RENDER_GL) args.push(`--use-angle=${process.env.RENDER_GL}`);   // e.g. swiftshader on a server without a GPU
  return o;
}

/* ---------- ffmpeg ---------- */
function ffmpeg(args, input = false) {
  const p = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
  p.done = new Promise((ok, no) => p.on('close', (c) => (c === 0 ? ok() : no(new Error('ffmpeg exited with ' + c)))));
  return p;
}
function wavHeader(bytes, sr) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + bytes, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(bytes, 40);
  return h;
}

/* ---------- one show → video.mp4 + audio.wav ---------- */
let stopping = false;
process.on('SIGINT', () => { if (stopping) process.exit(130); stopping = true; log('Stopping after this frame — finishing the file…'); });

async function renderShow(browser, ep, tmp) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => log('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') log('page:', m.text().slice(0, 200)); });
  const url = studioUrl(ep);
  log(`Opening ${url.replace(/#key=.*/, '#key=…')}`);
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  for (let i = 0; !(await page.evaluate(() => !!window.__render?.ready)); i++) {   // loading: the clock must move for its timeouts
    if (i > 3000) throw new Error('The studio did not finish loading within 5 minutes.');
    await page.evaluate(() => window.__vt?.step(0.1));
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.evaluate(() => window.__render.start());
  for (let i = 0; ; i++) {                                      // loading, premium-voice check, live writing's first segment
    const s = await page.evaluate(() => window.__render.idle(0.1));
    if (s.onAir) break;
    if (s.error) throw new Error('The studio could not start: ' + s.error);
    if (i > 3000) throw new Error('The studio did not start within 5 minutes.');
    await new Promise((r) => setTimeout(r, 100));
  }
  const st = await page.evaluate(() => window.__render.status());
  log(`On air: ${st.title} · ${st.quality} · ${W}×${H} @ ${fps} fps`);
  if (!st.premium) log('WARNING — premium voices are off (' + (st.voiceNote || 'no passcode') + '). The hosts will move their lips but the video will have music only. Pass --key <studio passcode>.');

  const cdp = await page.context().newCDPSession(page);
  const videoFile = path.join(tmp, `video-${ep ?? mode}.mp4`);
  const enc = ffmpeg(['-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps),
    '-b:v', `${bitrate}k`, '-maxrate', `${Math.round(bitrate * 1.15)}k`, '-bufsize', `${bitrate * 2}k`,
    '-g', String(fps * 2), '-keyint_min', String(fps * 2), '-sc_threshold', '0', videoFile], true);
  const t0 = Date.now(); let frames = 0, info = { t: 0 };
  for (;;) {
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, optimizeForSpeed: true });
    if (!enc.stdin.write(Buffer.from(data, 'base64'))) await new Promise((r) => enc.stdin.once('drain', r));
    frames++;
    if (stopping || info.done || frames / fps >= maxDur) break;
    info = await page.evaluate((dt) => window.__render.frame(dt), 1 / fps);
    for (const w of info.warnings || []) log('warning:', w);
    if (frames % (fps * 10) === 0) {
      const done = frames / fps, speed = done / ((Date.now() - t0) / 1000);
      const eta = mode === 'episode' ? '' : ` · about ${Math.round((maxDur - done) / speed / 60)} min left`;
      log(`${fmt(done)} recorded · line ${info.line}/${info.lines} · ${info.voices} voice lines · ${speed.toFixed(2)}× real time${eta}`);
    }
  }
  enc.stdin.end(); await enc.done;
  const total = frames / fps;
  log(`Video done: ${fmt(total)} in ${fmt((Date.now() - t0) / 1000)}. Mixing the sound…`);

  const plan = await page.evaluate((t) => window.__render.mix(t), total);
  const wavFile = path.join(tmp, `audio-${ep ?? mode}.wav`), fd = fs.openSync(wavFile, 'w');
  fs.writeSync(fd, wavHeader(0, 44100));
  let bytes = 0;
  for (let a = 0; a < total; a += 60) {
    const b64 = await page.evaluate(([a, b]) => window.__render.mixWindow(a, b), [a, Math.min(total, a + 60)]);
    const buf = Buffer.from(b64, 'base64'); fs.writeSync(fd, buf); bytes += buf.length;
  }
  fs.writeSync(fd, wavHeader(bytes, 44100), 0, 44, 0); fs.closeSync(fd);
  log(`Sound done: ${plan.voices} voice lines, ${plan.songs} song${plan.songs === 1 ? '' : 's'}.`);
  await page.close();
  return { videoFile, wavFile, total };
}
const fmt = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };

/* ---------- main ---------- */
fs.mkdirSync(path.dirname(out), { recursive: true });
const tmp = fs.mkdtempSync(path.join(path.dirname(out), '.karlcon-render-'));
const browser = await chromium.launch(launchOptions()).catch((e) => {
  console.error('Could not start the browser (' + e.message.split('\n')[0] + ').\nInstall Microsoft Edge or Google Chrome, or pass --browser "C:\\path\\to\\chrome.exe".'); process.exit(1);
});
try {
  const parts = [];
  for (const ep of eps) { if (stopping) break; parts.push(await renderShow(browser, ep, tmp)); }
  await browser.close();
  log('Putting it together…');
  if (parts.length === 1) {
    await ffmpeg(['-i', parts[0].videoFile, '-i', parts[0].wavFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', '-movflags', '+faststart', out]).done;
  } else {
    const list = path.join(tmp, 'parts.txt');
    const each = await Promise.all(parts.map(async (p, i) => { const f = path.join(tmp, `part-${i}.mp4`); await ffmpeg(['-i', p.videoFile, '-i', p.wavFile, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-shortest', f]).done; return f; }));
    fs.writeFileSync(list, each.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out]).done;
  }
  const mb = (fs.statSync(out).size / 1048576).toFixed(0), len = parts.reduce((s, p) => s + p.total, 0);
  log(`Saved ${out} — ${fmt(len)}, ${mb} MB. Copy it to the VPS (tools/stream-vps) to stream it on a loop.`);
  fs.rmSync(tmp, { recursive: true, force: true });
} catch (e) {
  console.error('\nRender failed:', e.message, '\nPartial files are in', tmp);
  await browser.close().catch(() => {}); process.exit(1);
}
