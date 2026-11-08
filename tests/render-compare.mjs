/* Same synthetic card, same viewport, real index.html renderer.
   Baseline is main. After is this branch. Temp files only. Not an unlock fallback. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join } from 'node:path';

const root = '/tmp/furlong-compare';
const outDir = '/tmp/furlong-qa';
await mkdir(join(root, 'before'), { recursive: true });
await mkdir(join(root, 'after', 'js'), { recursive: true });
await mkdir(join(root, 'after', 'css'), { recursive: true });
await mkdir(outDir, { recursive: true });

const inject = `
<script src="fixture-card.js"></script>
<script>
document.getElementById('gate').style.display='none';
window.fetch=function(){return Promise.reject(new Error('offline'));};
DATA=window.FIXTURE_CARD;
DATA.mmdd=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
init();
</script>
`;
function withInject(html) {
  return html.replace('</body>', inject + '\n</body>');
}
const mainHtml = execFileSync('git', ['show', 'main:index.html'], { cwd: '/workspace', encoding: 'utf8', maxBuffer: 20_000_000 });
const branchHtml = await readFile('/workspace/index.html', 'utf8');
await writeFile(join(root, 'before', 'index.html'), withInject(mainHtml));
await writeFile(join(root, 'after', 'index.html'), withInject(branchHtml));
await cp('/workspace/staging/fixture-card.js', join(root, 'before', 'fixture-card.js'));
await cp('/workspace/staging/fixture-card.js', join(root, 'after', 'fixture-card.js'));
await cp('/workspace/js/usability.js', join(root, 'after', 'js', 'usability.js'));
await cp('/workspace/css/usability.css', join(root, 'after', 'css', 'usability.css'));

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] || 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('missing');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const chrome = spawn('google-chrome', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--remote-debugging-port=9333', '--user-data-dir=/tmp/chrome-furlong-compare', 'about:blank'
], { stdio: 'ignore' });
async function waitJson() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9333/json/version');
      if (res.ok) return res.json();
    } catch { /* boot */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('chrome did not open');
}
const version = await waitJson();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const job = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) job.reject(new Error(JSON.stringify(msg.error)));
    else job.resolve(msg.result);
  }
});
function send(method, params = {}, sessionId) {
  const id = ++seq;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
async function shot(which, width, height, name) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 800 }, sessionId);
  await send('Page.navigate', { url: `http://127.0.0.1:${port}/${which}/index.html` }, sessionId);
  for (let i = 0; i < 40; i++) {
    const ready = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }, sessionId);
    if (ready.result.value === 'complete') break;
    await new Promise((r) => setTimeout(r, 50));
  }
  await new Promise((r) => setTimeout(r, 400));
  const probe = await send('Runtime.evaluate', {
    expression: `({ horses: document.querySelectorAll('.hcard').length, ovals: document.querySelectorAll('svg[data-stage]').length, extra: !!document.getElementById('race-extra'), prev: !!document.getElementById('prevRace'), board: document.body.innerText.includes('Supplemental runner board') })`,
    returnByValue: true
  }, sessionId);
  console.log(name, JSON.stringify(probe.result.value));
  const metrics = await send('Page.getLayoutMetrics', {}, sessionId);
  const size = metrics.cssContentSize || metrics.contentSize;
  const pic = await send('Page.captureScreenshot', {
    format: 'png', captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: Math.ceil(size.width), height: Math.min(4200, Math.ceil(size.height)), scale: 1 }
  }, sessionId);
  await writeFile(join(outDir, name + '.png'), Buffer.from(pic.data, 'base64'));
}
await shot('before', 1280, 900, 'before-desktop-1280');
await shot('after', 1280, 900, 'after-desktop-1280');
await shot('before', 390, 844, 'before-phone-390');
await shot('after', 390, 844, 'after-phone-390');
ws.close();
chrome.kill('SIGKILL');
server.close();
console.log('compare shots written');
