// Kit items 2/3/4 (James 2026-11-23 8:18 PM ET). Offline; no network.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const PL = require('../js/playlist.js');
const RB = require('../js/robot.js');
const index = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('item 2: LEAN display-only races leave the play list and its counts', () => {
  const races = [{ trk: 'FL', race: 1, verdict: 'BET' }, { trk: 'FL', race: 2, verdict: 'LEAN', display_only: true }, { trk: 'FL', race: 3, verdict: 'PASS' }];
  const s = PL.splitRaces(races, {});
  assert.deepEqual(s.shown.map(r => r.race), [1]);
  assert.deepEqual(s.lean.map(r => r.race), [2]);
  assert.deepEqual(s.hidden.map(r => r.race), [3]);
  assert.equal(PL.isDisplayOnly({ lean_display_only: true }), true);
  assert.equal(PL.isDisplayOnly({ verdict: 'LEAN' }), false);
  assert.ok(index.includes("leanCount:lean.length") && index.includes("DISPLAY ONLY (LEAN)"));
});

test('item 3: no x1.08 / x1.12 price-gate premium, ALT is display only, meter has no edge term', () => {
  assert.equal(/fair\*1\.08|fair\*1\.12/.test(index), false);
  assert.equal(index.includes("qual={x:alt"), false);
  assert.ok(index.includes('V.meter=Math.round(belief*100); /* KIT item 3'));
  assert.ok(index.includes('at least 1.6× our fair price'));
});

test('item 3: play-list meter adds a display-only caution at >= 1.6x fair, keeps BET tone/min unchanged', () => {
  const minD = PL.minDecimal(0.25);            // fair 4.0 x 1.25 = 5.0
  const base = { minDecimal: minD, ts: 1, now: 1000, age: 1, freshS: 120 };
  const a = PL.meter(Object.assign({ winDec: 5.5 }, base));
  const b = PL.meter(Object.assign({ winDec: 6.5 }, base));
  assert.equal(a.tone, 'green'); assert.equal(a.word, 'BET'); assert.equal(a.caution16, false);
  assert.equal(b.tone, 'green'); assert.equal(b.caution16, true); assert.ok(b.word.indexOf('1.6') > 0);
  assert.equal(PL.MIN_PRICE_MULTIPLIER, 1.25);
});

test('item 4: conditional ROBOT plays grey out when the live tote fails the condition', () => {
  const card = { trk: 'FL', race: '7', pgm: '4', line: 'FL R7 #4 X — RS487 — only if fav under 2-1 at post', conditional: true,
    cond_specs: [{ k: 'fav_under', v: 2, text: 'plays only if this horse is the favourite at under 2-1 at post' }] };
  assert.equal(RB.check(card, { odds: { '4': 1.5, '1': 3 } }).state, 'pass');
  assert.equal(RB.check(card, { odds: { '4': 4, '1': 3 } }).state, 'fail');
  assert.equal(RB.check(card, null).state, 'unknown');
  const vc = { pgm: '5', conditional: true, vc_line: '4/1', cond_specs: [{ k: 'odds_ge_vc' }] };
  assert.equal(RB.check(vc, { odds: { '5': 4.2 } }).state, 'pass');
  assert.equal(RB.check(vc, { odds: { '5': 3.0 } }).state, 'fail');
  const ls = { pgm: '8', conditional: true, cond_specs: [{ k: 'late_scr_ge', v: 2 }, { k: 'unknown' }] };
  assert.equal(RB.check(ls, { odds: { '8': 9 }, nscr: 0 }).state, 'fail');
  assert.equal(RB.check(ls, { odds: { '8': 9 }, nscr: 2 }).state, 'unknown');
  const data = { title: 'THE ROBOT', angles: [], races: [], play_cards: [card] };
  const h = RB.race(data, { trk: 'FL', race: 7 }, { odds: { '4': 4, '1': 3 } });
  assert.ok(h.includes('rbt-off') && h.includes('Condition not met at the tote'));
  assert.equal(RB.race(data, { trk: 'FL', race: 7 }).includes('rbt-off'), false);
});

test('index.html inline scripts still parse after the kit edits', () => {
  const vm = require('vm');
  const scripts = [...index.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 1);
  scripts.forEach(s => { assert.doesNotThrow(() => new vm.Script(s)); });
});
