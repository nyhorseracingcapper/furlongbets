import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = '/tmp/furlong-qa';
await mkdir(outDir, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const rel = decodeURIComponent(url.pathname);
  if (rel.includes('..')) { res.writeHead(400); res.end('bad'); return; }
  const file = join(root, rel === '/' ? 'index.html' : rel.slice(1));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('missing');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/chrome-furlong-qa', 'about:blank'
], { stdio: 'ignore' });

async function waitJson() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) return res.json();
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('chrome debug port did not open');
}
const version = await waitJson();
const browserWs = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { browserWs.addEventListener('open', resolve); browserWs.addEventListener('error', reject); });

let seq = 0;
const pending = new Map();
browserWs.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});
function send(method, params = {}, sessionId) {
  const id = ++seq;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  browserWs.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);

async function go(url) {
  await send('Page.navigate', { url }, sessionId);
  await send('Page.loadEventFired', {}, sessionId).catch(() => {});
  for (let i = 0; i < 40; i++) {
    const ready = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sessionId);
    if (ready.result.value === 'complete') return;
    await new Promise((r) => setTimeout(r, 50));
  }
}
async function evalJson(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function shot(name) {
  const metrics = await send('Page.getLayoutMetrics', {}, sessionId);
  const size = metrics.cssContentSize || metrics.contentSize;
  const width = Math.ceil(size.width);
  const height = Math.min(Math.ceil(size.height), 5000);
  const pic = await send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height, scale: 1 }
  }, sessionId);
  const file = join(outDir, name + '.png');
  await writeFile(file, Buffer.from(pic.data, 'base64'));
  return file;
}
async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 800
  }, sessionId);
  await new Promise((r) => setTimeout(r, 80));
}

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? 'ok' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures.push(name + (detail ? ': ' + detail : ''));
}

await go(base + '/index.html');
const gate = await evalJson(`({
  gate: !!document.querySelector('#gate'),
  unlock: !!document.querySelector('#unlock'),
  pw: document.querySelector('#pw') && document.querySelector('#pw').type,
  fixture: document.body.innerText.includes('International Velvet') || document.body.innerText.includes('Synthetic fixture'),
  status: document.querySelector('#status').textContent,
  asset: !!document.querySelector('script[src*="usability.js"]')
})`);
check('password gate still covers the public card', gate.gate && gate.unlock && gate.pw === 'password');
check('public card does not render the fixture', gate.fixture === false, JSON.stringify(gate));
check('locked status is not a live claim', !/\blive\b/i.test(gate.status), gate.status);
check('usability asset is linked', gate.asset);
await setViewport(390, 844);
await shot('gate-390');

await go(base + '/staging/usability-fixture.html');
await setViewport(1280, 900);
let state = await evalJson(`(() => {
  const svgs = [...document.querySelectorAll('svg[data-stage]')];
  const runners = [...document.querySelectorAll('.fu-runner')];
  const names = runners.map(r => r.innerText);
  const targets = ['#prevRace','#nextRace','#nextOpenBtn','.fu-rpill','.fu-runner'].flatMap(sel => [...document.querySelectorAll(sel)]);
  const short = targets.filter(el => el.getBoundingClientRect().height < 44).map(el => el.id || el.className);
  const tops = svgs.map(s => Math.round(s.getBoundingClientRect().top));
  const longName = document.body.innerText.includes('International Velvet Thunderbolt of the Western Counties (IRE)');
  return {
    stages: svgs.map(s => s.getAttribute('data-stage')),
    runners: runners.length,
    has1A: names.some(n => n.startsWith('1A')),
    has10: names.some(n => n.startsWith('10')),
    has11: names.some(n => n.startsWith('11')),
    longName,
    tokens1A: document.querySelectorAll('[data-pgm="1A"]').length,
    short,
    tops,
    pill: document.querySelector('#status').textContent,
    summary: document.querySelector('.fu-ovals .sr-only')?.textContent || ''
  };
})()`);
check('three stages on the fresh fixture', state.stages.join(',') === '1ST CALL,2ND CALL,FINISH', state.stages.join(','));
check('16 starters including 1A, 10, and 11', state.runners === 16 && state.has1A && state.has10 && state.has11, JSON.stringify({ runners: state.runners, has1A: state.has1A }));
check('long country-suffixed name is present', state.longName);
check('1A is drawn on the ovals and the legend', state.tokens1A >= 4, String(state.tokens1A));
check('primary targets are at least 44px', state.short.length === 0, state.short.slice(0, 6).join(','));
check('desktop ovals sit on one row', Math.max(...state.tops) - Math.min(...state.tops) < 40, state.tops.join(','));
check('fresh fixture pill is a labeled simulation', state.pill.startsWith('FIXTURE SIMULATION') && !/\blive\b/i.test(state.pill), state.pill);
check('screen reader summary names the stages', /First call/.test(state.summary) && /Finish/.test(state.summary));
await shot('desktop-1280-fresh');

await evalJson(`document.getElementById('nextRace').focus(); true`);
const focused = await evalJson(`({ id: document.activeElement && document.activeElement.id, prevDisabled: document.getElementById('prevRace').disabled })`);
check('next race can take keyboard focus', focused.id === 'nextRace', JSON.stringify(focused));
check('previous race is disabled on the first race', focused.prevDisabled === true);

await setViewport(768, 1000);
state = await evalJson(`JSON.stringify([...document.querySelectorAll('svg[data-stage]')].map(s => Math.round(s.getBoundingClientRect().top)))`);
const tops768 = JSON.parse(state);
check('768px stacks the three ovals', tops768[1] > tops768[0] + 80 && tops768[2] > tops768[1] + 80, state);
await shot('tablet-768-stacked');

await setViewport(390, 844);
await shot('phone-390-stacked');
await setViewport(360, 780);
const phone = await evalJson(`(() => {
  const name = document.querySelector('.fu-name');
  const clipped = name.scrollWidth > name.clientWidth + 2;
  return { clipped, text: name.textContent };
})()`);
check('a long name is not clipped at 360px', phone.clipped === false, phone.text);
await shot('phone-360');

await setViewport(1280, 900);
await evalJson(`document.body.style.zoom='200%'`);
await new Promise((r) => setTimeout(r, 100));
const zoomed = await evalJson(`(() => {
  const stages = document.querySelectorAll('svg[data-stage]').length;
  const name = [...document.querySelectorAll('.fu-name')].find(n => n.textContent.includes('International'));
  return { stages, name: name ? name.textContent : '', height: document.getElementById('nextRace').getBoundingClientRect().height };
})()`);
check('200% zoom still shows three stages and the long name', zoomed.stages === 3 && zoomed.name.includes('(IRE)'), JSON.stringify(zoomed));
await shot('zoom-200');
await evalJson(`document.body.style.zoom=''`);

await evalJson(`window.__QA.tick(20)`);
const after = await evalJson(`window.__QA.state()`);
check('selection and open runner survive 20 ticks', after.sel.no === 1 && after.sel.openPgm === '11' && after.sel.focusPgm === '11', JSON.stringify(after.sel));

await evalJson(`window.__QA.setScenario('both-fail')`);
let pill = await evalJson(`document.querySelector('#status').textContent`);
check('both feeds failing is disconnected, not current', pill.includes('disconnected') && !pill.includes('current · quote'), pill);

await evalJson(`window.__QA.setScenario('future-status')`);
pill = await evalJson(`document.querySelector('#status').textContent`);
check('a future status time is not current', pill.includes('future') && !/\bcurrent · quote window/.test(pill), pill);
await evalJson(`window.__QA.setScenario('clean')`);
pill = await evalJson(`document.querySelector('#status').textContent`);
check('clean fixture clock can show current without saying live', pill.includes('current · quote window') && !/\blive\b/i.test(pill), pill);
await setViewport(1280, 900);
await shot('desktop-1280-current');

await evalJson(`window.__QA.midnight()`);
pill = await evalJson(`document.querySelector('#status').textContent`);
check('midnight ET marks the card historical', pill.includes('historical'), pill);
await shot('historical-midnight');

await evalJson(`window.__QA.setScenario('fresh'); selectRace('FIXT', 2);`);
const race2 = await evalJson(`(() => {
  const pgms = new Set([...document.querySelectorAll('svg[data-stage="FINISH"] [data-pgm]')].map(n => n.getAttribute('data-pgm')));
  return { count: pgms.size, has10: pgms.has('10'), has11: pgms.has('11'), has20: pgms.has('20') };
})()`);
check('20-runner finish oval keeps every program', race2.count === 20 && race2.has10 && race2.has11 && race2.has20, JSON.stringify(race2));

await evalJson(`selectRace('FIXT', 3)`);
const unavailable = await evalJson(`(() => {
  const text = document.querySelector('.fu-ovals').innerText;
  const ranks = document.querySelectorAll('svg [data-rank]').length;
  const stages = document.querySelectorAll('svg[data-stage]').length;
  return { text: text.includes('unavailable'), ranks, stages };
})()`);
check('missing stage fields fail closed', unavailable.text && unavailable.ranks === 0 && unavailable.stages === 3, JSON.stringify(unavailable));
await shot('stages-unavailable');

await evalJson(`selectRace('FIXT', 1); window.__QA.setScenario('fresh');`);
const lcp = await evalJson(`(() => new Promise((resolve) => {
  const done = (v) => resolve(v);
  try {
    const entries = performance.getEntriesByType('largest-contentful-paint');
    if (entries.length) done(entries[entries.length - 1].startTime);
    else {
      new PerformanceObserver((list) => done(list.getEntries().at(-1).startTime)).observe({ type: 'largest-contentful-paint', buffered: true });
      setTimeout(() => done(null), 500);
    }
  } catch (e) { done(null); }
}))()`);
console.log('single-run desktop LCP ms (not a p75)', lcp);
await setViewport(390, 844);
try {
  await send('Emulation.setCPUThrottlingRate', { rate: 4 }, sessionId);
  await send('Network.enable', {}, sessionId);
  await send('Network.emulateNetworkConditions', {
    offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8
  }, sessionId);
} catch (err) {
  console.log('phone profile throttle unavailable', err.message);
}
await go(base + '/staging/usability-fixture.html');
const phoneLcp = await evalJson(`(() => new Promise((resolve) => {
  const entries = performance.getEntriesByType('largest-contentful-paint');
  if (entries.length) resolve(entries[entries.length - 1].startTime);
  else setTimeout(() => resolve(null), 400);
}))()`);
console.log('single-run phone-viewport LCP ms (not a p75, throttle may not have applied to the already-open document)', phoneLcp);

await setViewport(1280, 900);
await shot('desktop-1280-race1');

browserWs.close();
chrome.kill('SIGKILL');
server.close();
if (failures.length) {
  console.error('BROWSER FAILURES\n' + failures.join('\n'));
  process.exit(1);
}
console.log('browser qa passed');
