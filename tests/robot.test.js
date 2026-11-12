const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function loadRobot() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(read('js/robot.js'), sandbox, { filename: 'robot.js' });
  return sandbox.window.RB;
}
const sample = () => ({
  title: 'THE ROBOT', note: 'Research angles from ROBOT (paper-tested patterns, not bets).', empty_race: 'No passing angle today', none_yet: 'No passing angles yet',
  n_pass: 2, flagged_horses: 1, flagged_races: 1,
  angles: [
    { id: 'RS275', status: 'evaluated', missing: null, definition: 'VC rank: 4+ plus AccuPressure SC rank: =1, at a Kentucky track, final odds under 12-1', record: 'tested 2025-11-01..2026-10-05: 279 plays, 20.1% win, +24.1% win ROI ($2 flat)', n_flagged: 1 },
    { id: 'RS274', status: 'cannot', missing: "the trainer's 365-day win % at today's sprint/route", definition: 'Black Magic L/O: 2SL plus outside post', record: 'tested 2025-11-01..2026-07-14: 209 plays, 22.0% win, +38.3% win ROI ($2 flat)', n_flagged: 0 },
  ],
  races: [
    { trk: 'CD', race: '4', label: 'Churchill R4', entries: [{ pgm: '5', horse: 'G <b>Rocks</b>', ml_txt: '5/1', vc_line: '8/1', vc_rank: 6, bm_rank: 6, sc_rank: 1, angles: [{ id: 'RS275', condition: 'plays only if under 12-1 at post' }] }] },
    { trk: 'BEL', race: '1', label: 'Belmont R1', entries: [] },
  ],
});

test('robot section: title, angles, flagged horse with condition, cannot-evaluate, per-race empty state', () => {
  const RB = loadRobot();
  const h = RB.html(sample());
  assert.ok(h.includes('THE ROBOT'));
  assert.ok(h.includes('1 horse flagged today') && h.includes('2 passing angles') && h.includes('1 cannot be evaluated today'));
  assert.ok(h.includes('RS275') && h.includes('plays only if under 12-1 at post') && h.includes('279 plays, 20.1% win, +24.1% win ROI'));
  assert.ok(h.includes('RS274: cannot evaluate today (missing the trainer&#39;s 365-day win % at today&#39;s sprint/route)'));
  assert.ok(h.includes('1 race: No passing angle today') && h.includes('Belmont R1 &mdash; No passing angle today'));
  assert.ok(h.includes('G &lt;b&gt;Rocks&lt;/b&gt;') && !h.includes('<b>Rocks</b>'));
  assert.ok(h.includes('ML 5/1 &middot; VC line 8/1'));
});

test('robot per-race block: hit, empty, absent, and quiet without data', () => {
  const RB = loadRobot();
  const d = sample();
  assert.ok(RB.race(d, { trk: 'CD', race: 4 }).includes('G &lt;b&gt;Rocks'));
  assert.ok(RB.race(d, { trk: 'BEL', race: 1 }).includes('No passing angle today'));
  assert.equal(RB.race(d, { trk: 'XX', race: 1 }), '');
  assert.equal(RB.race(null, { trk: 'CD', race: 4 }), '');
  assert.equal(RB.html(null), '');
  assert.equal(RB.html({ title: 'THE ROBOT', error: 'boom' }), '');
});

test('robot empty state when no angle passes', () => {
  const RB = loadRobot();
  const d = sample(); d.n_pass = 0; d.angles = []; d.flagged_horses = 0;
  assert.ok(RB.html(d).includes('No passing angles yet'));
  assert.ok(RB.race(d, { trk: 'BEL', race: 1 }).includes('No passing angles yet'));
});

test('index.html wires THE ROBOT after the play list and keeps BEAST paper-only code', () => {
  const index = read('index.html');
  assert.ok(index.includes('<div id="playlist" hidden></div>\n  <div id="robot" hidden></div>'));
  assert.ok(index.includes('js/robot.js?v=robot-1') && index.includes('css/robot.css?v=robot-1'));
  assert.ok(index.includes('RB.race(DATA.robot||null,r)') && index.includes('RB.html(DATA.robot||null)'));
  assert.ok(index.includes('js/beast-paper.js?v=beast-paper-1'));
  assert.equal(index.includes("kind:'BEAST'"), false);
  const js = read('js/robot.js');
  assert.equal(/fetch\(|XMLHttpRequest|localStorage/.test(js), false);
});
