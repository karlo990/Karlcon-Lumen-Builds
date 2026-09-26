// Rig check: plays Episode 1 of /studio on a virtual clock (no drawing, so it runs faster than real
// time) and measures every frame the joints a human body is limited to — head against chest, trunk
// lean, wrist against the forearm, forearm rotation from thumb-up, finger joints. Fails (exit 1) when
// any frame goes past the normal adult range of motion, so a change to studio-kit/hosts.js can be
// checked before it goes on air.
//
//   node rig-check.mjs                              60 s, the current studio-kit/hosts.js
//   node rig-check.mjs --code old-hosts.js --out old.json
//   node rig-check.mjs --secs 120 --shots 12.5,42 stills at those seconds (rig-<t>.png)
//   node rig-check.mjs --compare old.json new.json  side-by-side table of two runs
//   --browser msedge | chrome | <path to chrome>    (default: Playwright's own Chromium)
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

/* ---------- limits: comfortable while talking / normal adult maximum (AAOS; Norkin & White) ---------- */
const M = [
  ['Trunk bent forward', r => Math.max(0, -r.cp), 18, 45],
  ['Head turn vs chest', r => Math.abs(r.hy), 50, 80],
  ['Head tilted up vs chest', r => Math.max(0, r.hp), 20, 60],
  ['Head bent down vs chest', r => Math.max(0, -r.hp), 30, 50],
  ['Head side tilt', r => Math.abs(r.hr), 12, 45],
  ['Wrist bent to palm', r => Math.max(0, r.Lflex, r.Rflex), 50, 80],
  ['Wrist bent back', r => Math.max(0, -r.Lflex, -r.Rflex), 45, 70],
  ['Wrist to thumb side', r => Math.max(0, r.Ldev, r.Rdev), 15, 20],
  ['Wrist to little-finger side', r => Math.max(0, -r.Ldev, -r.Rdev), 25, 35],
  ['Forearm turned palm-down', r => Math.max(0, r.Lpro, r.Rpro), 75, 90],
  ['Forearm turned palm-up', r => Math.max(0, -r.Lpro, -r.Rpro), 75, 90],
];
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0; };
function report(runs) {
  let bad = 0;
  for (const host of Object.keys(runs[0][1])) {
    console.log(`\n${host}`.padEnd(46) + runs.map(([n]) => `${n}: max° / %>comfortable / %>normal max`.padEnd(46)).join(''));
    for (const [label, get, comf, max] of M) {
      let line = `  ${label} (≤${comf}° / ${max}°)`.padEnd(46);
      runs.forEach(([, d], i) => {
        const v = (d[host] || []).map(get).filter(Number.isFinite), over = (l) => 100 * v.filter(x => x > l).length / v.length;
        if (i === runs.length - 1 && over(max) > 0) bad++;
        line += `${Math.max(...v).toFixed(0).padStart(4)} / ${over(comf).toFixed(1).padStart(5)}% / ${over(max).toFixed(1).padStart(5)}%`.padEnd(46);
      });
      console.log(line);
    }
  }
  return bad;
}
if (process.argv.includes('--compare')) {
  const files = process.argv.slice(process.argv.indexOf('--compare') + 1);
  process.exit(report(files.map(f => [path.basename(f, '.json'), JSON.parse(fs.readFileSync(f, 'utf8'))])) ? 1 : 0);
}

/* ---------- a local stand-in for the site: static files + a silent voice API with word timings ---------- */
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.css': 'text/css' };
function voice(text) {
  const SR = 16000, words = text.split(/\s+/).filter(Boolean); let t = 0.05;
  const segs = words.map((w, i) => { const d = 0.12 + w.length * 0.045, s = t; t += d + 0.06; return { i, s, e: s + d }; });
  const pcm = Buffer.alloc(Math.ceil((t + 0.1) * SR) * 2), h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return { audio: Buffer.concat([h, pcm]).toString('base64'), mime: 'audio/wav', words: segs };
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/studio-voice') {
    res.setHeader('content-type', 'application/json');
    if (req.method === 'GET') return res.end(JSON.stringify({ ready: true, provider: 'rig-check', vkey: 'rig', missing: [] }));
    let body = ''; req.on('data', (c) => body += c); req.on('end', () => res.end(JSON.stringify(voice(JSON.parse(body).text || ''))));
    return;
  }
  if (u.pathname.startsWith('/api/')) { res.statusCode = 404; return res.end('{}'); }
  const f = path.join(ROOT, decodeURIComponent(u.pathname === '/studio' ? '/studio.html' : u.pathname));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return res.end('not found'); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const PORT = server.address().port;

/* ---------- in-page probe, appended to hosts.js ---------- */
const PROBE = `{
const QT = THREE.Quaternion, V3 = THREE.Vector3, D = 180 / Math.PI;
const _m = Host.prototype._measure;
Host.prototype._measure = function () {
  _m.call(this); this.root.updateMatrixWorld(true); this.__bind = {};
  for (const [k, b] of Object.entries(this.bones)) this.__bind[k] = b.getWorldQuaternion(new QT());
};
const dq = (h, k) => h.bones[k].getWorldQuaternion(new QT()).multiply(h.__bind[k].clone().invert());   // rotation since the bind pose
const rel = (h, p, c) => dq(h, p).invert().multiply(dq(h, c));
const sAng = (a, b, ax) => { const pa = a.clone().projectOnPlane(ax).normalize(), pb = b.clone().projectOnPlane(ax).normalize(); return Math.atan2(pa.clone().cross(pb).dot(ax), pa.dot(pb)); };
const ypr = (q) => { const v = new V3(0, 0, 1).applyQuaternion(q), u = new V3(0, 1, 0).applyQuaternion(q), s = new QT().setFromUnitVectors(new V3(0, 0, 1), v);
  return [Math.atan2(v.x, v.z) * D, Math.asin(Math.max(-1, Math.min(1, v.y))) * D, sAng(new V3(0, 1, 0).applyQuaternion(s), u, v) * D]; };
const _u = Host.prototype.update;
Host.prototype.update = function (dt, now) {
  _u.call(this, dt, now);
  if (!this.__bind) return;
  const h = this, b = h.bones, irq = h.root.getWorldQuaternion(new QT()).invert(), inv = h.root.matrixWorld.clone().invert();
  const lp = (k) => b[k].getWorldPosition(new V3()).applyMatrix4(inv);
  const r = { t: +(window.__rigT || 0).toFixed(3), talk: h.state.speaking ? 1 : 0 };
  [r.hy, r.hp, r.hr] = ypr(rel(h, 'Spine2', 'Head'));
  [r.cy, r.cp] = ypr(irq.clone().multiply(dq(h, 'Spine2')));
  for (const s of ['Left', 'Right']) {
    const sg = s === 'Left' ? 1 : -1, k = s[0], S = lp(s + 'Arm'), E = lp(s + 'ForeArm'), W = lp(s + 'Hand');
    const a = W.clone().sub(E).normalize(), ua = E.clone().sub(S).normalize();
    const f = lp(s + 'HandMiddle1').sub(W).normalize(), l = lp(s + 'HandIndex1').sub(lp(s + 'HandPinky1')).normalize();
    const n = (s === 'Left' ? f.clone().cross(l) : l.clone().cross(f)).normalize();
    // forearm rotation from thumb-up, about the elbow hinge: + palm down (pronation), - palm up (supination)
    const med = ua.clone().cross(a).multiplyScalar(sg).projectOnPlane(a).normalize(), dn = a.clone().cross(med).multiplyScalar(sg).normalize();
    r[k + 'pro'] = Math.atan2(n.dot(dn), n.dot(med)) * D;
    // wrist against the forearm line: + toward the palm, + toward the thumb
    const np = n.clone().projectOnPlane(a).normalize(), rad = np.clone().cross(a).multiplyScalar(sg).normalize();
    r[k + 'flex'] = Math.atan2(f.dot(np), f.dot(a)) * D; r[k + 'dev'] = Math.atan2(f.dot(rad), f.dot(a)) * D;
  }
  for (const key in r) if (typeof r[key] === 'number') r[key] = +r[key].toFixed(2);
  (window.__rig[h.id] ||= []).push(r);
};
}`;

/* ---------- run ---------- */
const require = createRequire(import.meta.url);
let pw; try { pw = require('../studio-render/node_modules/playwright-core'); } catch { pw = require('playwright-core'); }
const browser = arg('browser'), code = path.resolve(arg('code', path.join(ROOT, 'studio-kit/hosts.js'))), out = path.resolve(arg('out', 'rig.json'));
const secs = +arg('secs', 60), shots = (arg('shots', '') || '').split(',').filter(Boolean).map(Number);
const b = await pw.chromium.launch({
  ...(browser ? (/^(msedge|chrome)/.test(browser) ? { channel: browser } : { executablePath: browser }) : {}),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required']
});
try {
  const ctx = await b.newContext({ viewport: { width: 720, height: 1280 } });
  await ctx.addInitScript(() => {
    // the same "random" choices every run: one stream for the show, another for the presenters
    let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    let h = 777; window.__hostRand = () => { h = (h * 1103515245 + 12345) >>> 0; return h / 4294967296; };
    window.__rig = {}; window.__draw = false;
    for (const C of [self.WebGL2RenderingContext, self.WebGLRenderingContext]) if (C) for (const m of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements', 'clear']) {
      const o = C.prototype[m]; if (o) C.prototype[m] = function (...a) { if (window.__draw) return o.apply(this, a); };
    }
  });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await ctx.route('**/studio-kit/hosts.js', (route) => route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(code, 'utf8').replace(/Math\.random\(\)/g, 'window.__hostRand()') + '\n' + PROBE }));
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('page error:', e.message.slice(0, 300)));
  await p.goto(`http://127.0.0.1:${PORT}/studio?render&obs&format=vertical&q=standard&ep=1&music=0#key=rig-check`);
  await p.waitForFunction(() => window.__render && window.__vt, null, { timeout: 60000 });
  for (let i = 0; i < 900 && !(await p.evaluate(() => __render.ready)); i++) await p.evaluate(() => __render.idle(0.1));
  await p.evaluate(() => __render.start());
  for (let i = 0; i < 600; i++) if ((await p.evaluate(() => __render.idle(1 / 30))).onAir) break;
  console.log(`Measuring ${path.relative(process.cwd(), code) || code}: ${secs} s of Episode 1…`);
  for (let i = 0, k = 0; i < secs * 30; i++) {
    const t = i / 30, still = k < shots.length && t + 1e-6 >= shots[k];
    await p.evaluate(([t, d]) => { window.__rigT = t; window.__draw = d; }, [t, still]);
    await p.evaluate(() => __render.frame(1 / 30));
    if (still) { await p.screenshot({ path: out.replace(/\.json$/, '') + `-${shots[k]}.png` }); k++; }
  }
  const data = await p.evaluate(() => window.__rig);
  fs.writeFileSync(out, JSON.stringify(data));
  console.log(`Saved ${out}`);
  const bad = report([[path.basename(out, '.json'), data]]);
  console.log(bad ? `\nFAIL: ${bad} measure(s) go past the normal human range.` : '\nPASS: every frame is inside the normal human range.');
  process.exitCode = bad ? 1 : 0;
} finally { await b.close(); server.close(); }
