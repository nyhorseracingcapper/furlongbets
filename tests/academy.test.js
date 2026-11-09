const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function loadAcademy() {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox.window;
  vm.runInNewContext(read('js/academy.js'), sandbox, { filename: 'academy.js' });
  return sandbox.window;
}

test('academy renders a race from the card map and stays quiet when the key is absent', () => {
  const win = loadAcademy();
  assert.equal(win.ACAD.html({ trk: 'MNR', race: 1 }), '');
  win.ACADEMY = null;
  assert.equal(win.ACAD.html({ trk: 'MNR', race: 1 }), '');
  const sampleBox = { window: {} };
  vm.runInNewContext(read('staging/academy-fixture-data.js'), sampleBox, { filename: 'academy-fixture-data.js' });
  const sample = sampleBox.window.ACADEMY_SAMPLE;
  win.ACADEMY = sample;
  const mnr = win.ACAD.html({ trk: 'MNR', race: '1' });
  assert.ok(mnr.includes('VALUECAPPER ACADEMY'));
  assert.ok(mnr.includes('Royal Salute'));
  assert.ok(mnr.includes('LONE VT'));
  assert.ok(mnr.includes('#8'));
  assert.ok(mnr.includes('Krug'));
  assert.ok(mnr.includes('DOUBT'));
  assert.ok(mnr.includes('Principles point to #8 Krug'));
  assert.equal(mnr.includes('MIN_PRICE'), false);
  const fl = win.ACAD.html({ trk: 'fl', race: 9 });
  assert.ok(fl.includes('Burn Indy Burn'));
  assert.ok(fl.includes('No pressure on the lead'));
  assert.ok(fl.includes('Uncle George'));
  assert.equal(win.ACAD.html({ trk: 'ZZZ', race: 1 }), '');
  const listShape = { meta: sample.meta, races: [sample.races['FL|9']] };
  win.ACADEMY = listShape;
  assert.ok(win.ACAD.html({ trk: 'FL', race: 9 }).includes('Burn Indy Burn'));
  assert.equal(win.ACAD.isCopilotLoneVT('Lone ValueTech'), true);
  assert.equal(win.ACAD.isCopilotLoneVT('Early speed'), false);
});

test('the live card wires academy from the decrypted payload and does not fetch it', () => {
  const index = read('index.html');
  assert.ok(index.includes('css/academy.css?v=academy-1'));
  assert.ok(index.includes('js/academy.js?v=academy-1'));
  assert.ok(index.includes('window.ACADEMY=(DATA&&DATA.academy)||null'));
  assert.ok(index.includes('if(globalThis.ACAD) html+=ACAD.html(r);'));
  assert.equal(index.includes('academy-fixture'), false);
  assert.equal(index.includes('fetch(') && index.includes('academy.json'), false);
  assert.equal(/fetch\([^)]*academy/i.test(index), false);
  const gbox = index.indexOf('html+=gboxHTML(r,V);');
  const acad = index.indexOf('if(globalThis.ACAD) html+=ACAD.html(r);');
  const horses = index.indexOf("html+='<div class=\"list\">'");
  assert.ok(gbox > 0 && acad > gbox && acad < horses);
  assert.ok(index.includes('isCopilotLoneVT'));
  assert.ok(index.includes('function keepInfoTag'));
});
