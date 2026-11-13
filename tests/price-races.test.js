const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
function load() { const sb = { window: {}, console }; sb.globalThis = sb.window; vm.runInNewContext(read('js/price-races.js'), sb, { filename: 'price-races.js' }); return sb.window.PRC; }
const sample = () => ({
  title: 'PRICE RACES', paper_only: true, note: 'PAPER ONLY - NOT A BET SIGNAL.', empty_race: 'Not a price race', flagged_races: 1,
  lenses: [{ id: 'TLN', name: 'TimeLines', shape: 'Unpressured race', horse: 'TimeLines owner', ml_floor: 4, record: 'tested: 2,204 plays' }, { id: 'RPO', name: 'RPO \u2013 Reverser + Pace + OPO', shape: 'extra flag', horse: 'R25 horse', ml_floor: 5, record: 'study R25', extra: true }],
  lens_counts: { TLN: 1, NONE: 1 }, picks_by_lens: { TLN: 1 },
  races: [
    { trk: 'BEL', race: '1', label: 'Belmont R1', lens: 'TLN', lens_name: 'TimeLines', reason: 'Unpressured race, no lone speed', entry: { pgm: '2', horse: 'Sorrentino <b>x</b>', ml_txt: '8/1', vc_line: '9/1', contention: '13/1', vc_rank: 5, tl_own10: 4 } },
    { trk: 'BEL', race: '2', label: 'Belmont R2', lens: 'NONE', lens_name: 'No lens fits', reason: 'No lens fits this race', entry: null },
    { trk: 'BEL', race: '3', label: 'Belmont R3', lens: 'NONE', lens_name: 'No lens fits', reason: 'No lens fits this race', entry: null, extras: [{ pgm: '4', horse: 'Pace <i>Tone</i>', ml_txt: '8/1', vc_line: '5/1', contention: '6/1', vc_rank: 3, mp_rank: 2, lens: 'RPO', tag: 'RPO', lens_name: 'RPO \u2013 Reverser + Pace + OPO', reason: 'Pure reverser (RP12) with Master Pace rank 2' }, { pgm: '5', horse: 'Wide One', ml_txt: '6/1', vc_line: '4/1', contention: '5/1', vc_rank: 2, pp_rank: 1, n_traits: 3, lens: 'WRP', tag: 'WRP', lens_name: 'WRP \u2013 Wide-ARC reverser + PP', reason: 'Pure reverser with PP rank 1 in a wide race' }] },
  ],
  extra_picks: 2, extra_lens_counts: { RPO: 1, WRP: 1, SEL: 1 }, sel_picks: 1, sel_races_read: 3,
  sel: [{ trk: 'BEL', race: '1', label: 'Belmont R1', pgm: '2', horse: 'Sel <u>Horse</u>', ml_txt: '8/1', vc_line: '9/1', contention: '13/1', vc_rank: 5, race_type: 'ARC of 5 or fewer, field of 8 to 10', method: 'R25', method_words: 'the pure reverser with Master Pace rank 1-3' }],
});
test('price races section: PAPER ONLY badge, lens legend, flagged pick with lens + reason, no-pick list, escaping', () => {
  const PRC = load(); const h = PRC.html(sample());
  assert.ok(h.includes('PRICE RACES') && h.includes('PAPER ONLY') && h.includes('NOT A BET SIGNAL'));
  assert.ok(h.includes('extra flag, 1 horse today') && h.includes('+ 2 extra-flag horses') && h.includes('+ 1 race-selected play') && h.includes('prc-sel') && h.indexOf('prc-sel')<h.indexOf('Lenses used') && h.includes('Race type:</b> ARC of 5 or fewer, field of 8 to 10') && h.includes('Method chosen:') && h.includes('Sel &lt;u&gt;Horse') && !h.includes('<u>Horse') && h.includes('WRP</span>') && h.includes('prc-rpo') && h.includes('Extra paper flag only') && h.includes('Pace &lt;i&gt;Tone&lt;/i&gt;') && !h.includes('<i>Tone</i>'));
  assert.ok(h.includes('Lenses used (1 + 1 extra flags)') && h.includes('TimeLines') && h.includes('Unpressured race, no lone speed'));
  assert.ok(h.includes('#2 Sorrentino &lt;b&gt;x&lt;/b&gt;') && !h.includes('<b>x</b>'));
  assert.ok(h.includes('1 race with no pick') && h.includes('No lens fits'));
});
test('price races is quiet without data or on error', () => {
  const PRC = load();
  assert.equal(PRC.html(null), ''); assert.equal(PRC.html({ title: 'PRICE RACES', error: 'boom' }), ''); assert.equal(PRC.html({}), '');
});
test('index.html wires PRICE RACES directly after THE ROBOT and keeps the other sections', () => {
  const index = read('index.html');
  assert.ok(index.includes('<div id="robot" hidden></div>\n  <div id="priceraces" hidden></div>'));
  assert.ok(index.includes('js/price-races.js?v=price-races-1') && index.includes('css/price-races.css?v=price-races-1'));
  assert.ok(index.includes('PRC.html(DATA.price_races||null)') && index.includes('RB.html(DATA.robot||null)'));
  const js = read('js/price-races.js');
  assert.equal(/fetch\(|XMLHttpRequest|localStorage/.test(js), false);
});
