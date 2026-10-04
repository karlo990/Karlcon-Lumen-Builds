// frgi Playwright session: a normal browser window that YOU drive, with the
// grabber preloaded on every pinterest.com page. Nothing here scrolls, clicks
// or navigates for you. Captures are written to frgi-work/captures/ every 15 s
// and when a page closes, so full reloads no longer lose the recording.
//
//   npm i playwright && npx playwright install chromium   (once)
//   node pw_session.mjs [--chrome] [--ingest]
//
// --chrome  use your installed Google Chrome instead of Playwright's Chromium
// --ingest  run `python frgi.py ingest` on the captures when you close the window
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = path.resolve(process.env.FRGI_HOME || 'frgi-work');
const OUT = path.join(HOME, 'captures');
const args = new Set(process.argv.slice(2));

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  const root = spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).stdout.trim();
  return require(path.join(root, 'playwright'));
}
const { chromium } = loadPlaywright();

const SRC = fs.readFileSync(path.join(HERE, 'grabber.js'), 'utf8');
// grabber is inlined, not eval'd: Pinterest's Content-Security-Policy blocks eval
const INIT = `(() => {
  if (window.top !== window || !/(^|\\.)pinterest\\.[a-z.]+$/.test(location.hostname)) return;
  window.__frgiDoc = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  window.__frgiSink = s => window.__frgiSave(window.__frgiDoc, s);
  const grab = () => {
${SRC}
  };
  const run = () => { grab(); setInterval(grab, 15000); addEventListener('pagehide', grab); };
  document.readyState === 'loading' ? addEventListener('DOMContentLoaded', run) : run();
})();`;

fs.mkdirSync(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext(path.join(HOME, 'browser-profile'), {
  headless: false, viewport: null, ...(args.has('--chrome') ? { channel: 'chrome' } : {}),
});
await ctx.exposeFunction('__frgiSave', (doc, json) => {
  const n = JSON.parse(json).pins.length;
  fs.writeFileSync(path.join(OUT, `capture-${doc}.json`), json);
  process.stdout.write(`\rfrgi: ${doc} -> ${n} pins saved   `);
});
await ctx.addInitScript(INIT);
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded' }).catch(e => console.log(`frgi: could not open Pinterest (${e.message.split('\n')[0]}); use the address bar`));
console.log('frgi: browse normally (log in once; the profile is kept). Close the window to finish.');
await new Promise(r => ctx.on('close', r));
console.log(`\nfrgi: captures in ${OUT}`);
if (args.has('--ingest')) {
  const files = fs.readdirSync(OUT).filter(f => f.endsWith('.json')).map(f => path.join(OUT, f));
  if (files.length) spawnSync(process.platform === 'win32' ? 'python' : 'python3',
    [path.join(HERE, 'frgi.py'), 'ingest', ...files], { stdio: 'inherit', env: { ...process.env, FRGI_HOME: HOME } });
}
