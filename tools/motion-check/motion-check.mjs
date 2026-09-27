// Motion check: plays the motion test sequence (/studio?season=3&test=motion, studio-kit/episodes-test.js)
// on a virtual clock and measures how human the movement is, frame by frame, from the pose of every
// bone: feet sliding while planted, pops (joint angular speed jumping from one frame to the next),
// how a turn travels down the body (head → chest → hips), how walks start and stop, and whether a
// standing host is frozen or fidgeting. Stills of chosen moments go into a contact sheet.
//
//   node motion-check.mjs                                   the current studio-kit/hosts.js → motion.json
//   node motion-check.mjs --code old-hosts.js --out old.json
//   node motion-check.mjs --sheet 2,4,6,8 --sheetOut s.png  stills at those seconds (drawn, 9:16)
//   node motion-check.mjs --compare old.json new.json       side-by-side table
//   --browser msedge | chrome | <path to chrome>            (default: Playwright's own Chromium)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const D = 180 / Math.PI;

/* ---------- metrics from a trace ---------- */
const qAngle = (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return 2 * Math.acos(Math.min(1, d)) * D; };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
function metrics(trace) {
  const out = {};
  for (const id of ['luma', 'karl']) {
    const F = trace.map((r) => ({ t: r.t, ...r[id] })).filter((f) => f.root);
    if (F.length < 3) continue;
    const dt = F[1].t - F[0].t, m = {};
    // feet: a foot is planted when it has been within 1 cm of its lowest height for 3+ frames (heel strike,
    // the foot still coming down and forward, is not a slide); how far does it move while planted?
    for (const [k, name] of [['lf', 'left'], ['rf', 'right']]) {
      const lo = Math.min(...F.map((f) => f[k][1])); let slide = 0, maxv = 0, run = 0;
      for (let i = 1; i < F.length; i++) {
        const a = F[i - 1][k], b = F[i][k], down = a[1] < lo + 0.01 && b[1] < lo + 0.01;
        run = down ? run + 1 : 0;
        if (run >= 3) { const d = Math.hypot(b[0] - a[0], b[2] - a[2]); slide += d; maxv = Math.max(maxv, d / dt); }
      }
      m[`foot slide ${name} (m)`] = slide; m[`foot slide ${name} max (m/s)`] = maxv;
    }
    // pops: a joint's angular speed changing by more than 600°/s between two frames (a visible snap at 30 fps)
    const bones = Object.keys(F[0].q); let pops = 0, worst = 0, worstBone = '';
    const accAll = [];
    for (const k of bones) {
      let prevW = null;
      for (let i = 1; i < F.length; i++) {
        const w = qAngle(F[i - 1].q[k], F[i].q[k]) / dt;
        if (prevW != null) { const acc = Math.abs(w - prevW) / dt; accAll.push(acc); if (Math.abs(w - prevW) > 600) pops++; if (acc > worst) { worst = acc; worstBone = `${k} @${F[i].t.toFixed(1)}s`; } }
        prevW = w;
      }
    }
    m['joint pops (Δω>600°/s in a frame)'] = pops; m['joint angular accel p99 (°/s²)'] = pct(accAll, 0.99); m['worst joint accel (°/s²)'] = worst; m['worst joint'] = worstBone;
    // turning speed of the body; how the hips (what is seen) speed up and slow down
    let yawAcc = [], lin = [], linAcc = [], yawRate = [];
    for (let i = 1; i < F.length; i++) {
      yawRate.push(Math.abs(wrap(F[i].yaw - F[i - 1].yaw)) / dt * D);
      lin.push(Math.hypot(F[i].hips[0] - F[i - 1].hips[0], F[i].hips[2] - F[i - 1].hips[2]) / dt);
    }
    for (let i = 1; i < yawRate.length; i++) { yawAcc.push(Math.abs(yawRate[i] - yawRate[i - 1]) / dt); linAcc.push(Math.abs(lin[i] - lin[i - 1]) / dt); }
    m['body turn rate max (°/s)'] = Math.max(...yawRate); m['body turn accel p99 (°/s²)'] = pct(yawAcc, 0.99);
    m['hips speed max (m/s)'] = Math.max(...lin); m['hips accel p99 (m/s²)'] = pct(linAcc, 0.99); m['hips accel max (m/s²)'] = Math.max(...linAcc);
    // turns: when the head, chest and hips each get half way through a turn of more than 45°
    const leads = [];
    for (let i = 0; i < F.length; i++) {
      // a turn starts where the head is 45°+ off the hips and the hips then follow within 2 s
      if (i === 0 || Math.abs(wrap(F[i].headYaw - F[i].hipsYaw)) < 0.5 || Math.abs(wrap(F[i - 1].headYaw - F[i - 1].hipsYaw)) >= 0.5) continue;
      const j0 = Math.max(0, i - 30), y0 = F[j0].hipsYaw, target = F[Math.min(F.length - 1, i + 60)].hipsYaw, amp = wrap(target - y0);
      if (Math.abs(amp) < 0.7) continue;
      const half = (key) => { for (let j = j0; j < Math.min(F.length, i + 90); j++) if (Math.abs(wrap(F[j][key] - y0)) >= Math.abs(amp) / 2) return F[j].t; return null; };
      const th = half('headYaw'), tc = half('chestYaw'), tp = half('hipsYaw');
      if (th != null && tc != null && tp != null) leads.push([tc - th, tp - tc]);
      i += 60;
    }
    m['turns measured'] = leads.length;
    m['turn: chest lags head (s, mean)'] = leads.length ? leads.reduce((s, l) => s + l[0], 0) / leads.length : NaN;
    m['turn: hips lag chest (s, mean)'] = leads.length ? leads.reduce((s, l) => s + l[1], 0) / leads.length : NaN;
    // starts and stops: each walk on its own, from 10% to 90% of its top speed and back down (smoothed over 0.2 s)
    const sm = lin.map((_, i) => { const w = lin.slice(Math.max(0, i - 3), i + 4); return w.reduce((a, b) => a + b, 0) / w.length; });
    const starts = [], stops = [];
    for (let i = 0; i < sm.length;) {
      if (sm[i] < 0.05) { i++; continue; }
      let j = i; while (j < sm.length && sm[j] >= 0.05) j++;
      const seg = sm.slice(i, j), peak = Math.max(...seg);
      if (peak > 0.4 && seg.length * dt > 1) {
        const a10 = seg.findIndex((v) => v >= 0.1 * peak), a90 = seg.findIndex((v) => v >= 0.9 * peak);
        const b90 = seg.length - 1 - [...seg].reverse().findIndex((v) => v >= 0.9 * peak), b10 = seg.length - 1 - [...seg].reverse().findIndex((v) => v >= 0.1 * peak);
        starts.push((a90 - a10) * dt); stops.push((b10 - b90) * dt);
      }
      i = j;
    }
    m['walks'] = starts.length;
    m['start ramp 10→90% (s, mean)'] = starts.length ? starts.reduce((a, b) => a + b, 0) / starts.length : NaN;
    m['stop ramp 90→10% (s, mean)'] = stops.length ? stops.reduce((a, b) => a + b, 0) / stops.length : NaN;
    // standing still: how much the head and hips move (frozen < 1 mm, fidgety > 15 mm over 2 s)
    const idle = []; for (let i = 60; i < F.length; i += 30) {
      const seg = F.slice(i - 60, i); if (seg.some((f) => f.act) || seg.some((f, j) => j && Math.hypot(f.root[0] - seg[j - 1].root[0], f.root[2] - seg[j - 1].root[2]) > 1e-4)) continue;
      const r = (k) => { const c = [0, 1, 2].map((a) => seg.reduce((s, f) => s + f[k][a], 0) / seg.length); return Math.sqrt(seg.reduce((s, f) => s + (f[k][0] - c[0]) ** 2 + (f[k][1] - c[1]) ** 2 + (f[k][2] - c[2]) ** 2, 0) / seg.length); };
      idle.push([r('head'), r('hips')]);
    }
    m['idle head sway (mm rms)'] = idle.length ? 1000 * idle.reduce((s, x) => s + x[0], 0) / idle.length : NaN;
    m['idle hips sway (mm rms)'] = idle.length ? 1000 * idle.reduce((s, x) => s + x[1], 0) / idle.length : NaN;
    out[id] = m;
  }
  return out;
}
function table(runs) {
  const hosts = Object.keys(runs[0][1]);
  for (const h of hosts) {
    console.log(`\n${h}`.padEnd(44) + runs.map(([n]) => n.padEnd(26)).join(''));
    for (const k of Object.keys(runs[0][1][h])) console.log(`  ${k}`.padEnd(44) + runs.map(([, d]) => { const v = d[h]?.[k]; return (typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(3)) : String(v)).padEnd(26); }).join(''));
  }
}

if (arg('compare')) {
  const i = process.argv.indexOf('--compare'), files = process.argv.slice(i + 1).filter((f) => !f.startsWith('--'));
  table(files.map((f) => [path.basename(f, '.json'), metrics(JSON.parse(fs.readFileSync(f, 'utf8')))]));
  process.exit(0);
}

/* ---------- a local copy of the site with a test voice (tones timed like speech) ---------- */
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.mp3': 'audio/mpeg', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.fbx': 'application/octet-stream', '.css': 'text/css' };
function voice(text) {
  const SR = 22050, words = text.split(/\s+/).filter(Boolean); let t = 0.05;
  const segs = words.map((w, i) => { const d = 0.12 + w.length * 0.045, s = t; t += d + 0.06; return { i, s, e: s + d }; });
  const pcm = Buffer.alloc(Math.ceil((t + 0.1) * SR) * 2);
  for (const g of segs) for (let k = Math.floor(g.s * SR); k < g.e * SR; k++) pcm.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 190 * k / SR) * Math.sin(Math.PI * (k / SR - g.s) / (g.e - g.s)) * 8000), k * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return { audio: Buffer.concat([h, pcm]).toString('base64'), mime: 'audio/wav', words: segs };
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/studio-voice') {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET') return res.end(JSON.stringify({ ready: true, provider: 'motion-check', vkey: 'mc', missing: [] }));
    let body = ''; req.on('data', (c) => body += c); req.on('end', () => res.end(JSON.stringify(voice(JSON.parse(body).text || ''))));
    return;
  }
  if (u.pathname.startsWith('/api/')) { res.statusCode = 404; return res.end('{}'); }
  const f = path.join(ROOT, decodeURIComponent(u.pathname === '/studio' ? '/studio.html' : u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

/* ---------- run ---------- */
const require = createRequire(import.meta.url);
let pw; try { pw = require('../studio-render/node_modules/playwright-core'); } catch { pw = require('playwright-core'); }
const browser = arg('browser'), code = path.resolve(arg('code', path.join(ROOT, 'studio-kit/hosts.js'))), out = path.resolve(arg('out', 'motion.json'));
const secs = +arg('secs', 150), sheet = (arg('sheet', '') || '').split(',').filter(Boolean).map(Number), sheetOut = arg('sheetOut', out.replace(/\.json$/, '') + '-sheet');
const b = await pw.chromium.launch({
  ...(browser ? (/^(msedge|chrome)/.test(browser) ? { channel: browser } : { executablePath: browser }) : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
try {
  const ctx = await b.newContext({ viewport: { width: 405, height: 720 } });
  await ctx.addInitScript(() => {
    let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    let h = 777; window.__hostRand = () => { h = (h * 1103515245 + 12345) >>> 0; return h / 4294967296; };
    window.__draw = false;
    for (const C of [self.WebGL2RenderingContext, self.WebGLRenderingContext]) if (C) for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear']) {
      const o = C.prototype[m]; if (o) C.prototype[m] = function (...a) { if (window.__draw) return o.apply(this, a); };
    }
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await ctx.route('**/studio-kit/hosts.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(code, 'utf8').replace(/Math\.random\(\)/g, 'window.__hostRand()') }));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('page error:', e.message.slice(0, 300)));
  await p.goto(`http://127.0.0.1:${PORT}/studio?render&obs&format=vertical&q=standard&season=3&test=motion&trace&music=0#key=motion-check`);
  await p.waitForFunction(() => window.__render && window.__vt, null, { timeout: 60000 });
  for (let i = 0; i < 900 && !(await p.evaluate(() => __render.ready)); i++) await p.evaluate(() => __render.idle(0.1));
  await p.evaluate(() => __render.start());
  for (let i = 0; i < 600; i++) if ((await p.evaluate(() => __render.idle(1 / 30))).onAir) break;
  await p.evaluate(() => { window.kcTrace.length = 0; });
  console.log(`Measuring ${path.relative(process.cwd(), code) || code}: the motion test sequence…`);
  const stills = [];
  for (let i = 0, k = 0; i < secs * 30; i++) {
    const t = i / 30, still = k < sheet.length && t + 1e-6 >= sheet[k];
    await p.evaluate((d) => { window.__draw = d; }, still);
    const info = await p.evaluate(() => __render.frame(1 / 30));
    if (still) { const f = `${sheetOut}-${String(k).padStart(3, '0')}.png`; await p.screenshot({ path: f }); stills.push(f); k++; }
    if (info.done) break;
  }
  const trace = await p.evaluate(() => window.kcTrace);
  fs.writeFileSync(out, JSON.stringify(trace));
  console.log(`Saved ${out} (${trace.length} frames${stills.length ? `, ${stills.length} stills` : ''})`);
  table([[path.basename(out, '.json'), metrics(trace)]]);
} finally { await b.close(); server.close(); }
