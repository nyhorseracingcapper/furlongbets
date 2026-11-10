const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const BP = require('../js/beast-paper.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const card = (bp, legacy) => ({ beast: legacy === undefined ? null : legacy, beast_paper: bp });
const FL8 = { key: 'FL|8|5', trk: 'FL', race: '8', pgm: '5', horse: 'Takeschargesmiling', ml: 4, paper_only: true, stake: 0, min_odds_to_1: 4, min_dec: 5 };

test('BEAST key comes only from beast_paper, never from the legacy beast field', () => {
  assert.equal(BP.key(card(FL8)), 'FL|8|5');
  assert.equal(BP.key(card(null, 'FL|8|5')), null);
  assert.equal(BP.key(card(Object.assign({}, FL8, { paper_only: false }))), null);
  assert.equal(BP.key(card(FL8), (t, r, p) => t + '/' + r + '/' + p), 'FL/8/5');
  assert.equal(BP.key(null), null);
});

test('price rule is 4/1 at post (5.00 decimal), never lower', () => {
  assert.equal(BP.MIN_DEC, 5.0);
  assert.equal(BP.minDec(card(FL8)), 5.0);
  assert.equal(BP.minDec(card(Object.assign({}, FL8, { min_dec: 4.0 }))), 5.0);
  const l = BP.line(card(FL8), null);
  assert.match(l, /PAPER ONLY, no stake/);
  assert.match(l, /4\/1 or more at post \(5\.00 decimal\)/);
  assert.match(l, /Do not bet it/);
  assert.doesNotMatch(l, /3\/1|4\.00/);
  assert.match(BP.line(card(FL8), 6.0), /meets 4\/1/);
  assert.match(BP.line(card(FL8), 4.5), /under 4\/1/);
  assert.equal(BP.line(card(null), 6.0), '');
});

test('race match and chip label', () => {
  assert.equal(BP.inRace(card(FL8), { trk: 'FL', race: 8 }), true);
  assert.equal(BP.inRace(card(FL8), { trk: 'FL', race: 7 }), false);
  assert.match(BP.chip(), /★ BEAST · PAPER ONLY/);
  assert.match(BP.line(card(Object.assign({}, FL8, { horse: '<b>x' })), null), /&lt;b&gt;x/);
});

test('index never stakes THE BEAST and reads only beast_paper', () => {
  const html = read('index.html');
  assert.ok(html.includes('<script src="js/beast-paper.js?v=beast-paper-1"></script>'));
  assert.ok(!html.includes("kind:'BEAST'"), 'no BEAST qualification path');
  assert.ok(!html.includes('DATA.beast==='), 'legacy DATA.beast not read');
  assert.ok(!html.includes("why='beast'") && !html.includes("why==='beast'"));
  assert.ok(!/BEAST[^\n]{0,40}3\/1/.test(html), 'no 3/1 BEAST text');
  assert.ok(html.includes('function beastKey(){ return (globalThis.BP&&DATA)?BP.key(DATA,K):null; }'));
  assert.ok(html.includes('BP.line(DATA,'), 'paper-only line in the race verdict');
  assert.ok(html.includes('BP.chip()'), 'paper-only chip on the horse card');
});
