// Offline test: serves tests/fixtures/pin.html at a pinterest.com pin URL with
// Playwright's request routing (no request leaves the machine), runs grabber.js,
// then feeds the export through frgi.py. Run: node tests/grabber.test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRGI = path.resolve(HERE, '..');
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch {
  pw = require(path.join(spawnSync('npm', ['root', '-g'], { encoding: 'utf8', shell: true }).stdout.trim(), 'playwright'));
}
const PIN = 'https://www.pinterest.com/pin/999999999999999999/';
const html = fs.readFileSync(path.join(HERE, 'fixtures/pin.html'), 'utf8');
const src = fs.readFileSync(path.join(FRGI, 'grabber.js'), 'utf8');

const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.route('**/*', r => r.request().url() === PIN
  ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort());
await page.goto(PIN);
await page.evaluate(() => { window.__frgiSink = s => { window.__out = s; }; });
await page.evaluate(src);            // first run: start recording
await page.evaluate(src);            // second run: export
const cap = JSON.parse(await page.evaluate(() => window.__out));
await browser.close();

assert.equal(cap.tool, 'frgi-grabber');
assert.deepEqual(cap.pins.map(p => p.id).sort(), ['111111111111111111', '222222222222222222', '333333333333333333']);
assert.equal(cap.pages[0].kind, 'pin');
assert.equal(cap.pages[0].landed_pin, '999999999999999999');
const d = cap.details['999999999999999999'];
assert.ok(d.mp4[0].endsWith('_720w.mp4'), 'mp4 link captured');
assert.equal(d.description, 'Sunrise game drive, Hwange');
assert.equal(cap.pins.find(p => p.id === '111111111111111111').duration, '0:12');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'frgi-test-'));
const capFile = path.join(work, 'capture.json');
fs.writeFileSync(capFile, JSON.stringify(cap));
const py = (...a) => {
  const r = spawnSync(process.platform === 'win32' ? 'python' : 'python3', [path.join(FRGI, 'frgi.py'), ...a],
    { encoding: 'utf8', env: { ...process.env, FRGI_HOME: work } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
py('ingest', capFile);
const rank = py('rank', '-n', '10');
assert.match(rank, /111111111111111111.*Mana Pools/, 'Zimbabwe lead ranked');
assert.doesNotMatch(rank, /222222222222222222/, 'Serengeti pin hidden as off-target');
assert.match(py('next'), /111111111111111111/, 'lead suggested');
py('rights', '999999999999999999', 'own', '--note', 'test');
py('attach', '999999999999999999', capFile);
const rec = JSON.parse(fs.readFileSync(path.join(work, 'captions/KCERMEDIA_101.json'), 'utf8'));
assert.match(rec.caption_draft.hook, /^Elephant .+ in Hwange National Park$/);
assert.ok(fs.existsSync(path.join(work, 'descriptions/KCERMEDIA_101.txt')));
fs.rmSync(work, { recursive: true, force: true });
console.log('frgi grabber + pipeline: all checks passed');
