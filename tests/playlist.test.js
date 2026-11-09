const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const PL = require('../js/playlist.js');
const FU = require('../js/usability.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

function race(extra) {
  return Object.assign({
    trk: 'FIXT',
    race: 1,
    horses: [
      { pgm: '4', horse: 'Primary Example', p_raw: 0.2, ml_dec: 6 },
      { pgm: '6', horse: 'Secondary Example', p_raw: 0.1, ml_dec: 9 },
      { pgm: '2', horse: 'Field Example', p_raw: 0.05 }
    ]
  }, extra || {});
}

test('minimum price is fair decimal odds times the one multiplier constant', () => {
  assert.equal(PL.MIN_PRICE_MULTIPLIER, 1.25);
  assert.equal(PL.fairDecimal(0.2), 5);
  assert.equal(PL.minDecimal(0.2), 5 * PL.MIN_PRICE_MULTIPLIER);
  assert.equal(PL.oddsTo1(5), '4-1');
  assert.equal(PL.oddsTo1(PL.minDecimal(0.2)), '5.25-1');
  assert.equal(PL.oddsTo1(1.6), '0.6-1');
  assert.equal(PL.modelProb({ win: 20 }), 0.2);
  assert.equal(PL.minDecimal(0), null);
  assert.equal(PL.minDecimal(1.2), null);
});

test('play list keeps payload picks and hides races marked PASS', () => {
  const play = race({ verdict: 'PLAY', pick: '6' });
  const passed = race({ trk: 'FIXT', race: 2, verdict: 'PASS', horses: [{ pgm: '1', horse: 'Passed Example', p_raw: 0.4 }] });
  const livePass = race({ trk: 'FIXT', race: 3, horses: [{ pgm: '8', horse: 'Live Pass Example', p_raw: 0.3 }] });
  const split = PL.splitRaces([play, passed, livePass], {
    'FIXT|1': { grp: 'pass', code: 'PASS_EDGE' },
    'FIXT|3': { grp: 'pass', code: 'PASS_LOW', badge: 'PASS (LOW CONFIDENCE)' }
  });
  assert.deepEqual(split.shown.map((r) => r.race), [1]);
  assert.deepEqual(split.hidden.map((r) => r.race), [2, 3]);
  assert.equal(PL.isPassMark(play, { grp: 'pass', code: 'PASS_EDGE' }).pass, false);
  assert.equal(PL.meterPassed(play, { grp: 'pass', code: 'PASS_EDGE' }), true);
  assert.equal(PL.isPassMark(race({ verdict: 'PLAY' }), { grp: 'bet', code: 'BET_NOW' }).pass, false);
  assert.equal(PL.isPassMark(race({ copilot_verdict: 'PASS (pace)' }), { grp: 'bet', code: 'BET_NOW' }).pass, true);
  assert.equal(PL.isPassMark(race({ status: 'PLAY' }), null).pass, false);
  assert.equal(PL.isPassMark(race({ status: 'scheduled' }), { grp: 'watch', code: 'WATCH' }).pass, false);
  const picks = PL.playPicks(play);
  assert.deepEqual(picks.map((p) => p.pgm), ['6']);
  assert.equal(picks[0].role, 'primary');
  assert.equal(picks[0].minText, PL.oddsTo1(PL.minDecimal(0.1)));
  const two = race({
    picks: ['4', '6'],
    v25_info: { pattern_gap: 'pace shape' },
    horses: [
      { pgm: '4', horse: 'Top Sample', p_raw: 0.2, ml_dec: 6, v25_pattern_gap: 'lone speed', v25_pattern_gap_min: 4 },
      { pgm: '6', horse: 'Second Sample', p_raw: 0.1, ml_dec: 9, is_value_alt: true },
      { pgm: '2', horse: 'Field Example', p_raw: 0.05 }
    ]
  });
  const both = PL.playPicks(two);
  assert.deepEqual(both.map((p) => p.pgm), ['4', '6']);
  assert.equal(both[1].role, 'secondary');
  assert.equal(both[0].gapText, 'lone speed · 4');
  assert.equal(PL.patternChip({ v25_pattern_gap: true, v25_pattern_gap_min: 'paper' }, null), 'Pattern gap · paper');
  const scratched = race({ horses: [
    { pgm: '1', horse: 'Out', p_raw: 0.8, scr: true },
    { pgm: '2', horse: 'In', p_raw: 0.2 }
  ] });
  assert.deepEqual(PL.playPicks(scratched).map((p) => p.pgm), ['2']);
});

test('meter colors use decimal win_dec and never invent a stale or empty price', () => {
  PL.resetHistory();
  const now = Date.parse('2026-11-09T17:00:00Z');
  const min = PL.minDecimal(0.2);
  function read(over) {
    return PL.meter(Object.assign({
      minDecimal: min,
      freshS: 30,
      now: now,
      formatTime: () => 'Nov 9, 2026, 12:00:00 PM ET'
    }, over));
  }
  const bet = read({ winDec: 6.25, age: 4, ts: now - 4000 });
  assert.equal(bet.tone, 'green');
  assert.equal(bet.word, 'BET');
  assert.equal(bet.price, '5.25-1');
  const near = read({ winDec: 6, age: 4, ts: now - 4000 });
  assert.equal(near.tone, 'yellow');
  assert.equal(near.word, 'NEAR MIN');
  assert.equal(near.price, '5-1');
  const below = read({ winDec: 5, age: 4, ts: now - 4000 });
  assert.equal(below.tone, 'red');
  assert.equal(below.word, 'BELOW MIN');
  assert.equal(below.price, '4-1');
  const edge = read({ winDec: PL.YELLOW_BAND_LO * min, age: 1, ts: now - 1000 });
  assert.equal(edge.tone, 'yellow');
  const stale = read({ winDec: 5, age: 30.001, ts: now - 31000 });
  assert.equal(stale.tone, 'none');
  assert.equal(stale.word, 'no live odds');
  assert.equal(stale.price, '');
  assert.equal(stale.reason, 'stale');
  assert.match(stale.updatedText, /last update/);
  assert.equal(stale.updatedText.includes('4-1'), false);
  const missing = read({});
  assert.equal(missing.reason, 'missing');
  assert.equal(missing.price, '');
  assert.match(missing.updatedText, /no quote stored/);
  const empty = read({ winDec: 0, age: 3, ts: now - 3000 });
  assert.equal(empty.reason, 'nonpositive');
  assert.equal(empty.price, '');
  assert.match(empty.updatedText, /not a scratch/);
  assert.equal(empty.scratchInferred, false);
  const ahead = read({ winDec: 8, age: -5, ts: now + 5000 });
  assert.equal(ahead.reason, 'future');
  assert.equal(ahead.price, '');
  const passed = read({ winDec: 20, age: 2, ts: now - 2000, racePassed: true });
  assert.equal(passed.word, 'PASS');
  assert.equal(passed.tone, 'red');
  assert.equal(passed.price, '');
  const drop = read({
    winDec: 6,
    age: 2,
    ts: now,
    history: [{ dec: 10, ts: now - 60000 }, { dec: 0, ts: now - 50000 }]
  });
  assert.equal(drop.reason, 'collapse');
  assert.equal(drop.word, 'LATE-MONEY COLLAPSE');
  assert.equal(drop.price, '5-1');
  const stillUp = read({ winDec: 9, age: 2, ts: now, history: [{ dec: 10, ts: now - 60000 }] });
  assert.equal(stillUp.reason, 'bet');
  const mild = read({ winDec: 6, age: 2, ts: now, history: [{ dec: 6.4, ts: now - 60000 }] });
  assert.equal(mild.reason, 'near');
  const old = read({ winDec: 5, age: 2, ts: now, history: [{ dec: 10, ts: now - (PL.COLLAPSE_RULE.windowMs + 1000) }] });
  assert.equal(old.reason, 'below');
  assert.equal(PL.COLLAPSE_RULE.drop, 0.3);
  assert.equal(PL.YELLOW_BAND_LO, 0.85);
});

test('quote history keeps distinct timestamps and the compact list stays plain', () => {
  PL.resetHistory();
  const ts = Date.parse('2026-11-09T17:00:00Z');
  PL.noteQuote('FIXT|1|4', 5, ts);
  PL.noteQuote('FIXT|1|4', 5, ts);
  PL.noteQuote('FIXT|1|4', 4, ts + 1000);
  assert.equal(PL.history('FIXT|1|4').length, 2);
  assert.equal(PL.countdownText(12 * 60, false), 'in 12m');
  assert.equal(PL.countdownText(1, false), 'in 1m');
  assert.equal(PL.countdownText(-5, true), 'off');
  assert.equal(PL.parsePostSeconds('12:10PM'), 12 * 3600 + 10 * 60);
  const meter = (tone, price) => ({ tone: tone, word: tone, price: price || '', reason: tone === 'none' ? 'stale' : 'bet' });
  const rows = [
    PL.raceRow({ trk: 'IND', race: 2, post: '1:10 PM', nowSec: 13 * 3600, badge: 'PLAY', picks: [{ pgm: '1', name: 'Later', minText: '4-1', meter: meter('green', '5-1') }] }),
    PL.raceRow({ trk: 'FL', race: 1, post: '12:10PM', nowSec: 12 * 3600, badge: 'BET', picks: [{ pgm: '3', name: 'Name <script> & "quoted"', minText: '1.69-1', gapText: 'lone speed', meter: meter('yellow', '2-1') }] }),
    PL.raceRow({ trk: 'FL', race: 4, post: '11:40AM', nowSec: 12 * 3600, finished: true, badge: 'OFF', picks: [{ pgm: '2', name: 'Done', minText: '3-1', meter: meter('none') }] }),
    PL.raceRow({ trk: 'MNR', race: 3, post: '1:30 PM', nowSec: 13 * 3600, badge: 'LEAN', picks: [{ pgm: '7', name: 'Waiting', minText: '5-1', meter: meter('none') }] }),
    PL.raceRow({ trk: 'PHA', race: 5, post: '2:00 PM', nowSec: 13 * 3600, badge: 'PLAY', picks: [{ pgm: '1', name: 'Under', minText: '8-1', meter: meter('red', '3-1') }] })
  ];
  const view = PL.applyView(rows, { filter: 'all', track: 'all', showFinished: false });
  assert.deepEqual(view.map((r) => r.key), ['FL|1', 'IND|2', 'MNR|3', 'PHA|5']);
  assert.equal(view[0].next, true);
  assert.equal(view[0].when, 'in 10m');
  assert.equal(view[1].next, false);
  const bets = PL.applyView(rows, { filter: 'bet', showFinished: false });
  assert.deepEqual(bets.map((r) => r.trk), ['IND']);
  const html = PL.boardHtml({
    hiddenCount: 2,
    feedDown: false,
    lastUpdate: '4:25 PM',
    filter: 'all',
    track: 'all',
    tracks: ['FL', 'IND'],
    finishedCount: 1,
    rows: view
  });
  assert.equal(html.includes('<script>'), false);
  assert.ok(html.includes('Name &lt;script&gt;'));
  assert.ok(html.includes('>BET<'));
  assert.ok(html.includes('>CLOSE<'));
  assert.ok(html.includes('>PASS<'));
  assert.ok(html.includes('>WAITING<'));
  assert.ok(html.includes('Odds updated 4:25 PM · auto-refreshing'));
  assert.ok(html.includes('All upcoming'));
  assert.ok(html.includes('Bets only'));
  assert.ok(html.includes('lone speed'));
  assert.ok(html.includes('MIN 1.69-1'));
  assert.equal(html.includes('oval'), false);
  assert.equal(html.includes('MIN_PRICE_MULTIPLIER'), false);
  assert.equal(html.includes('YELLOW_BAND'), false);
  assert.equal(html.includes('COLLAPSE_RULE'), false);
  const down = PL.boardHtml({
    feedDown: true,
    hiddenCount: 0,
    tracks: ['FL'],
    rows: [PL.raceRow({ trk: 'FL', race: 1, post: '12:10PM', nowSec: 12 * 3600, badge: 'PLAY', feedDown: true, picks: [{ pgm: '3', name: 'Sample', minText: '2-1', meter: meter('none') }] })]
  });
  assert.equal(PL.FEED_DOWN_BANNER, 'Odds feed not running. Open TwinSpires in the feed browser to start it.');
  assert.equal(PL.FEED_DOWN_BANNER.includes('laptop'), false);
  assert.ok(down.includes(PL.FEED_DOWN_BANNER));
  assert.ok(down.includes('MIN 2-1'));
  assert.ok(down.includes('Sample'));
  assert.ok(down.includes('>WAITING<'));
  assert.equal(PL.stageNote({ stages: [{ ok: true }, { ok: true }, { ok: true }] }).includes('Three stage orders'), true);
});

test('real 1109 quote rows match a card that stores race and program as numbers', () => {
  const now = Date.parse('2026-11-09T21:07:51Z');
  const rows = [
    { trk: 'FL', race: '8', pgm: '_s', open_dec: null, win_dec: null, ts: '2026-11-09T21:07:51.500973+00:00' },
    { trk: 'FL', race: '8', pgm: '1', open_dec: 11, win_dec: 13, ts: '2026-11-09T21:07:51.500973+00:00' },
    { trk: 'FL', race: '8', pgm: '5', open_dec: 0, win_dec: 0, ts: '2026-11-09T21:07:51.500973+00:00' },
    { trk: 'GP', race: '2', pgm: '4', open_dec: 6, win_dec: 5, ts: '2026-11-08T21:07:51.000000+00:00' }
  ];
  const got = PL.ingestQuotes(rows, now);
  assert.equal(got.count, 2);
  const key = PL.feedKey('FL', 8, 1);
  assert.equal(key, PL.feedKey('fl', '08', '1'));
  assert.equal(got.map[key].dec, 13);
  assert.equal(got.map[key].first, 11);
  assert.equal(PL.oddsTo1(got.map[key].dec), '12-1');
  const zero = got.map[PL.feedKey('FL', '8', 5)];
  assert.equal(zero.dec, 0);
  const priced = PL.meter({ winDec: zero.dec, age: 2, ts: now, minDecimal: 4, freshS: 30 });
  assert.equal(priced.reason, 'nonpositive');
  assert.equal(priced.price, '');
  assert.equal(got.map[PL.feedKey('GP', 2, 4)], undefined);
  const status = PL.ingestStatus([
    { trk: 'FL', race: '8', mtp: 0, status: 'off', ts: '2026-11-09T21:07:51.500973+00:00' },
    { trk: 'GP', race: '2', mtp: 12, status: 'up', ts: '2026-11-08T21:07:51.000000+00:00' }
  ], now);
  assert.equal(status[PL.feedKey('FL', 8)].status, 'off');
  assert.equal(status[PL.feedKey('FL', 8)].mtp, 0);
  assert.equal(status[PL.feedKey('GP', 2)], undefined);
  const row = PL.raceRow({
    trk: 'FL', race: 8, post: '11:00 PM', nowSec: 16 * 3600 + 7 * 60, badge: 'PLAY',
    picks: [{ pgm: '1', name: 'Sample', minText: '4-1', meter: PL.meter({ winDec: 13, age: 4, ts: now, minDecimal: 4, freshS: 30 }) }]
  });
  assert.equal(row.hasLive, true);
  assert.equal(row.picks[0].liveText, '12-1');
  const html = PL.boardHtml({ rows: [row], tracks: ['FL'], hiddenCount: 0, feedDown: false, lastUpdate: '16:07:51' });
  assert.ok(html.includes('Sample'));
  assert.ok(html.includes('LIVE 12-1'));
  const none = PL.boardHtml({ rows: [], tracks: [], hiddenCount: 43, feedDown: true });
  assert.ok(none.includes('No plays in this view.'));
  assert.ok(none.includes(PL.FEED_DOWN_BANNER));
  const index = read('index.html');
  assert.ok(index.includes('js/playlist.js?v=play-board-3'));
  assert.ok(index.includes('css/playlist.css?v=play-board-3'));
  assert.ok(index.includes('PL.ingestQuotes'));
  assert.ok(index.includes('No plays in this view.'));
});

test('default ovals keep their ids and the horse card markup is untouched', () => {
  const horses = [{ pgm: '1', horse: 'A', p_raw: 1 }, { pgm: '2', horse: 'B', p_raw: 0.2 }];
  const meta = FU.buildMeta({
    race: { trk: 'FIXT', race: 1, surf: 'Dirt', horses: horses, stage_orders: { first: ['1', '2'], second: ['2', '1'], finish: ['1', '2'] } },
    quotes: {},
    now: Date.parse('2026-11-09T17:00:00Z'),
    card: { mmdd: '1109', card_year: 2026 },
    mode: 'card',
    feed: {}
  });
  const bare = FU.ovalsHtml(meta);
  assert.ok(bare.includes('id="ovalViews"'));
  assert.ok(bare.includes('id="ovalZoom"'));
  assert.ok(bare.includes('onclick="fuToggleOvalZoom()"'));
  assert.equal((bare.match(/data-stage="/g) || []).length, 3);
  const extra = FU.ovalsHtml(meta, { idSuffix: 'FIXT-1' });
  assert.ok(extra.includes('id="ovalViews-FIXT-1"'));
  assert.equal(extra.includes('id="ovalViews"'), false);
  assert.ok(extra.includes('fuToggleOvalZoom(\'ovalViews-FIXT-1\')'));
  const index = read('index.html');
  const horse = index.slice(index.indexOf('function horseCard'), index.indexOf('/* ---------- detail ---------- */'));
  assert.ok(horse.includes('class="hcard'));
  assert.equal(horse.includes('pl-meter'), false);
  assert.ok(index.includes('id="playlist"'));
  assert.ok(index.includes('js/playlist.js?v=play-board-3'));
  assert.ok(index.includes('function decryptWith'));
  assert.equal(index.includes('playlist-fixture'), false);
  const css = read('css/usability.css');
  assert.ok(css.includes('.views{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}'));
  assert.ok(css.includes('.fu-oval { display: block; width: 100%; height: auto;'));
});
