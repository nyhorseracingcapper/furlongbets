const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FU = require('../js/usability.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('release constants match the existing windows and name the rollback', () => {
  assert.equal(FU.RELEASE.version, 't438-usability-3');
  assert.equal(FU.RELEASE.quoteFreshS, 30);
  assert.equal(FU.RELEASE.statusFreshS, 150);
  assert.equal(FU.RELEASE.pollMs, 3000);
  assert.ok(FU.RELEASE.rollback.length >= 4);
  assert.match(read('docs/USABILITY_T438_ROLLBACK.md'), /t438-usability-3/);
  assert.match(read('docs/USABILITY_T438_ROLLBACK.md'), /revert/i);
  assert.match(read('docs/USABILITY_T438_ROLLBACK.md'), /Do not merge/);
});

test('America/New_York timestamps use an ET suffix', () => {
  assert.equal(FU.formatEt(Date.parse('2026-11-08T04:08:00Z')), 'Nov 7, 2026, 11:08:00 PM ET');
  assert.equal(FU.etDateKey(Date.parse('2026-11-08T04:59:00Z')), '2026-11-07');
  assert.equal(FU.etDateKey(Date.parse('2026-11-08T05:00:01Z')), '2026-11-08');
});

test('feed dates are MMDD, with year only from the card, and invalid dates fail closed', () => {
  const nov8Evening = Date.parse('2026-11-09T04:30:00Z');
  const nov9Midnight = Date.parse('2026-11-09T05:01:00Z');
  const newYear = Date.parse('2027-01-01T05:01:00Z');
  const nov8 = { mmdd: '1108', card_year: 2026, source_captured_at: '2026-11-08T00:14:40-05:00' };
  assert.equal(FU.feedRaceDate('1107').query, 'race_date=eq.1107');
  assert.equal(FU.feedRaceDate('1108').query, 'race_date=eq.1108');
  assert.equal(FU.feedRaceDate('1108').feedKey, '1108');
  assert.equal(FU.feedRaceDate('2026-11-08').ok, false);
  assert.equal(FU.feedRaceDate('11-08-2026').ok, false);
  assert.equal(FU.feedRaceDate('0000').ok, false);
  assert.equal(FU.feedRaceDate('1132').ok, false);
  assert.equal(FU.feedRaceDate('110').ok, false);
  const same = FU.cardDateState(nov8, nov8Evening);
  assert.equal(same.state, 'same-day');
  assert.equal(same.calendar, '2026-11-08');
  assert.equal(same.feedKey, '1108');
  assert.match(same.capture, /2026-11-08 00:14:40 ET/);
  assert.equal(FU.cardDateState(nov8, nov9Midnight).state, 'historical');
  assert.equal(FU.cardDateState({ mmdd: '1231', card_year: 2026 }, newYear).calendar, '2026-12-31');
  assert.equal(FU.cardDateState({ mmdd: '1231', card_year: 2026 }, newYear).state, 'historical');
  assert.equal(FU.cardDateState({ mmdd: '0101', card_year: 2027 }, newYear).state, 'same-day');
  assert.equal(FU.cardDateState({ mmdd: '0229', card_year: 2026 }, nov8Evening).state, 'invalid');
  assert.equal(FU.cardDateState({ mmdd: '0229', card_year: 2024 }, Date.parse('2024-02-29T17:00:00Z')).state, 'same-day');
  const legacy = FU.cardDateState('1107', nov8Evening);
  assert.equal(legacy.state, 'feed-only');
  assert.equal(legacy.feedKey, '1107');
  assert.equal(legacy.calendar, null);
  assert.notEqual(legacy.state, 'same-day');
  assert.equal(FU.cardDateState({ mmdd: '1108', source_captured_at: '2026-11-08T00:14:40' }, nov8Evening).state, 'invalid');
  assert.equal(FU.cardDateState({ mmdd: '1107', card_year: 2026, source_captured_at: '2026-11-08T00:14:40-05:00' }, nov8Evening).state, 'invalid');
  assert.equal(FU.cardDateState({ mmdd: '1108', card_year: 2026, nSCRATCHES: 0 }, nov8Evening).state, 'same-day');
  assert.equal(FU.actionGate({ dateState: 'invalid', quoteState: 'current', statusState: 'current', wageringLive: true }).allowed, false);
  assert.equal(FU.actionGate({ dateState: 'feed-only', quoteState: 'current', statusState: 'current', wageringLive: true }).allowed, true);
});

test('quote and status time states, including future timestamps', () => {
  assert.equal(FU.timeState(0, 30), 'current');
  assert.equal(FU.timeState(30, 30), 'current');
  assert.equal(FU.timeState(30.001, 30), 'stale');
  assert.equal(FU.timeState(150, 150), 'current');
  assert.equal(FU.timeState(150.001, 150), 'stale');
  assert.equal(FU.timeState(-0.01, 30), 'future');
  assert.equal(FU.timeState(null, 30), 'unknown');
  assert.notEqual(FU.timeState(-5, 30), 'current');
  assert.notEqual(FU.timeState(null, 150), 'current');
});

test('failed feeds keep the last success and never look current', () => {
  let feed = { quote: {}, status: {} };
  const t0 = Date.parse('2026-11-07T20:00:00Z');
  feed = FU.feedReduce(feed, { channel: 'quote', type: 'success' }, t0);
  feed = FU.feedReduce(feed, { channel: 'status', type: 'success' }, t0);
  feed = FU.feedReduce(feed, { channel: 'quote', type: 'fail', error: 'down' }, t0 + 5000);
  feed = FU.feedReduce(feed, { channel: 'status', type: 'fail', error: 'down' }, t0 + 5000);
  assert.equal(feed.quote.okAt, t0);
  assert.equal(feed.status.okAt, t0);
  assert.equal(FU.channelHealth(feed.quote), 'disconnected');
  assert.equal(FU.channelHealth(feed.status), 'disconnected');
  assert.notEqual(FU.channelHealth(feed.quote), 'current');
  assert.equal(FU.channelHealth({}), 'unknown');
});

test('action expires on the clock and future or unknown never qualifies', () => {
  const ok = { dateState: 'today', quoteState: 'current', statusState: 'current', wageringLive: true };
  assert.equal(FU.actionGate(ok).allowed, true);
  assert.equal(FU.actionGate(Object.assign({}, ok, { quoteState: 'stale' })).allowed, false);
  assert.equal(FU.actionGate(Object.assign({}, ok, { quoteState: 'future' })).reason, 'quote timestamp in the future');
  assert.equal(FU.actionGate(Object.assign({}, ok, { quoteState: 'unknown' })).allowed, false);
  assert.equal(FU.actionGate(Object.assign({}, ok, { statusState: 'stale' })).reason, 'status older than 150s');
  assert.equal(FU.actionGate(Object.assign({}, ok, { statusState: 'future' })).allowed, false);
  assert.equal(FU.actionGate(Object.assign({}, ok, { statusState: 'unknown' })).allowed, false);
  assert.equal(FU.actionGate(Object.assign({}, ok, { dateState: 'historical' })).reason, 'historical card date in America/New_York');
  assert.equal(FU.actionGate(Object.assign({}, ok, { dateState: 'unknown' })).allowed, false);
  const verdict = { grp: 'bet', cls: 'bet', code: 'BET_NOW', stake: 4, badge: 'BET', lines: ['keep'] };
  const suspended = FU.applyActionGate(verdict, FU.actionGate(Object.assign({}, ok, { quoteState: 'stale' })));
  assert.equal(suspended.grp, 'watch');
  assert.equal(suspended.stake, 0);
  assert.equal(suspended.code, 'SUSPENDED');
  assert.equal(verdict.grp, 'bet');
  assert.equal(FU.applyActionGate(verdict, FU.actionGate(ok)), verdict);
});

test('a fresh quote stays eligible one second inside the window and stops on the next tick', () => {
  const born = 1_000_000;
  function flags(now) {
    const age = (now - born) / 1000;
    return FU.actionGate({
      dateState: 'today',
      quoteState: FU.timeState(age, 30),
      statusState: 'current',
      wageringLive: true
    });
  }
  assert.equal(flags(born + 30000).allowed, true);
  assert.equal(flags(born + 31000).allowed, false);
});

test('missing and stale quotes are never confirmed scratches, even when most of the field is fresh', () => {
  const now = Date.parse('2026-11-07T20:00:00Z');
  const horses = [];
  for (let i = 1; i <= 10; i++) horses.push({ pgm: String(i), horse: 'H' + i, p_raw: 0.1 });
  horses.push({ pgm: '1A', horse: 'Coupled (FR)', p_raw: 0.1 });
  horses[0].scr = true;
  horses[0].scr_ts = now - 3600000;
  const quotes = {};
  horses.forEach((h) => {
    quotes[h.pgm] = { dec: 4, ts: now - 5000, age: 5 };
  });
  delete quotes['7'];
  quotes['4'] = { dec: 6, ts: now - 90000, age: 90 };
  quotes['8'] = { dec: 0, ts: now - 80000, age: 80 };
  quotes['6'] = { dec: 0, ts: now - 3000, age: 3 };
  quotes['2'] = { dec: 0, ts: now - 3000, age: 3, scratch: true };
  quotes['9'] = { dec: 5, ts: now + 60000, age: -60 };
  const c = FU.classifyRunners(horses, quotes, now);
  const kind = Object.fromEntries(c.rows.map((r) => [r.pgm, r.kind]));
  assert.equal(kind['1'], 'confirmed');
  assert.match(c.byPgm['1'].label, /card roster/);
  assert.match(c.byPgm['1'].label, /ET/);
  assert.equal(kind['2'], 'confirmed');
  assert.match(c.byPgm['2'].label, /scratch flag/);
  assert.notEqual(kind['6'], 'confirmed');
  assert.match(c.byPgm['6'].label, /no scratch flag/);
  assert.notEqual(kind['7'], 'confirmed');
  assert.match(c.byPgm['7'].label, /not a confirmed scratch/);
  assert.notEqual(kind['4'], 'confirmed');
  assert.notEqual(kind['8'], 'confirmed');
  assert.match(c.byPgm['8'].label, /not a confirmed scratch/);
  assert.notEqual(kind['9'], 'confirmed');
  assert.equal(c.byPgm['9'].quoteState, 'future');
  assert.equal(c.confirmed.map((r) => r.pgm).sort().join(','), '1,2');
  const probs = FU.adjustedProbs(horses, c.confirmed.map((r) => r.pgm));
  assert.ok(Math.abs(probs.sumP - 1) < 1e-8);
  assert.ok(probs.dropped.includes('7') === false);
  assert.ok(probs.active.some((x) => x.pgm === '7'));
  assert.ok(probs.active.some((x) => x.pgm === '1A'));
  const notes = FU.captureNotes({ nSCRATCHES: 0, horses: [{ pgm: '3', nAE: 1 }, { pgm: '4', nAE: 0 }] });
  assert.match(notes.join(' '), /not a live late-scratch/);
  assert.match(notes.join(' '), /not confirmed starters/);
});

test('adjusted probabilities sum to 1 without rewriting raw values', () => {
  const horses = [
    { pgm: '1', p_raw: 0.2 },
    { pgm: '1A', p_raw: 0.1 },
    { pgm: '10', p_raw: 0.3 },
    { pgm: '11', win: 10 }
  ];
  const before = horses.map((h) => h.p_raw);
  const probs = FU.adjustedProbs(horses, []);
  assert.ok(Math.abs(probs.sumP - 1) < 1e-8);
  assert.deepEqual(horses.map((h) => h.p_raw), before);
  assert.notEqual(probs.sumRaw, 1);
  const none = FU.adjustedProbs([{ pgm: '2', p_raw: 0.4 }], ['2']);
  assert.equal(none.active.length, 0);
});

test('coupled price is not described as an allocation', () => {
  const view = FU.couplingView([
    { pgm: '1', horse: 'A', couple_price: 4.5 },
    { pgm: '1A', horse: 'B (FR)', couple_price: 4.5 },
    { pgm: '2', horse: 'C' }
  ]);
  assert.equal(view.allocation, 'none');
  assert.match(view.note, /no certified allocation/i);
  assert.deepEqual(view.groups[0].programs, ['1', '1A']);
  assert.equal(view.groups[0].couplePrice, 4.5);
});

test('surface without a live feed is unknown or stale, never certified', () => {
  const dirt = FU.surfaceView({ surf: 'Dirt' }, 'today');
  assert.equal(dirt.liveFeed, false);
  assert.equal(dirt.verification, 'unknown');
  assert.equal(dirt.paint.name, 'Dirt');
  const old = FU.surfaceView({ surf: 'Turf' }, 'historical');
  assert.equal(old.verification, 'stale');
  const off = FU.surfaceView({ surf: 'Off turf' }, 'today');
  assert.equal(off.paint.known, false);
  assert.match(off.label, /not a certified live surface/i);
  const missing = FU.surfaceView({}, 'today');
  assert.match(missing.label, /Surface unknown/);
});

test('oval geometry matches the reference anchors and a 13-horse first call', () => {
  const first = [
    [210, 69], [236, 69], [262, 69], [288, 69],
    [313.961, 69.722], [337.765, 79.586], [354.633, 99.065], [360.992, 124.035],
    [355.496, 149.210], [339.310, 169.258], [315.860, 179.937], [289.929, 181], [263.929, 181]
  ];
  first.forEach((pt, i) => {
    const got = FU.pointBehind('1ST CALL', i);
    assert.ok(Math.hypot(got.x - pt[0], got.y - pt[1]) < 0.02, '1st ' + (i + 1));
  });
  const second = [
    [300, 181], [274, 181], [248, 181], [222, 181], [196, 181], [170, 181], [144, 181], [118.018, 180.563]
  ];
  second.forEach((pt, i) => {
    const a = FU.pointBehind('2ND CALL', i);
    const b = FU.pointBehind('FINISH', i);
    assert.ok(Math.hypot(a.x - pt[0], a.y - pt[1]) < 0.02);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) < 1e-9);
  });
  assert.equal(FU.rankVisual('FINISH', 1).r, 11);
  assert.equal(FU.rankVisual('FINISH', 2).fill, '#e8c15a');
  assert.equal(FU.rankVisual('2ND CALL', 2).fill, '#7fe0a0');
  assert.equal(FU.rankVisual('FINISH', 5).text, '#ffffff');
  assert.ok(FU.contrast('#1a1200', '#e8c15a') >= 4.5);
  assert.ok(FU.contrast('#1a1200', '#7fe0a0') >= 4.5);
  assert.ok(FU.contrast('#1a1200', '#c9b48a') >= 4.5);
  assert.ok(FU.contrast('#1a1200', '#7aa2c0') >= 4.5);
  assert.ok(FU.contrast('#ffffff', '#5f7280') >= 4.5);
  assert.ok(FU.contrast(FU.COLORS.text, FU.COLORS.panel) >= 4.5);
  assert.ok(FU.contrast(FU.COLORS.textMuted, FU.COLORS.panel) >= 4.5);
});

test('stage orders keep every starter and fail closed when the source is incomplete', () => {
  const horses = [];
  for (let i = 1; i <= 20; i++) horses.push({ pgm: String(i), horse: 'R' + i, p_raw: (21 - i) / 210 });
  horses.push({ pgm: '1A', horse: 'Coupled Alpha (IRE)', p_raw: 0.01 });
  const pgms = horses.map((h) => h.pgm);
  const race = {
    horses,
    surf: 'Synth',
    stage_orders: {
      first: pgms.slice(),
      second: pgms.slice().reverse(),
      finish: pgms.slice(3).concat(pgms.slice(0, 3))
    }
  };
  const model = FU.stageModel(race);
  assert.equal(model.stages.length, 3);
  model.stages.forEach((s) => {
    assert.equal(s.ok, true);
    assert.equal(s.order.length, 21);
    assert.ok(s.order.includes('1A'));
    assert.ok(s.order.includes('10'));
    assert.ok(s.order.includes('11'));
  });
  const html = FU.raceUsabilityHtml(FU.buildMeta({
    race, quotes: {}, now: Date.parse('2026-11-07T20:00:00Z'), card: { mmdd: '1107', card_year: 2026 }, mode: 'fixture', feed: {}
  }));
  assert.equal((html.match(/data-stage="/g) || []).length, 3);
  assert.ok(html.includes('>1A<'));
  assert.ok(html.includes('>10<'));
  assert.ok(html.includes('>11<'));
  assert.ok(html.includes('Coupled Alpha (IRE)'));
  assert.equal((html.match(/data-pgm="1A"/g) || []).length >= 3, true);
  const bare = FU.stageModel({ horses, surf: 'Dirt' });
  assert.ok(bare.stages.every((s) => !s.ok));
  const bareHtml = FU.ovalsHtml(FU.buildMeta({
    race: { horses, surf: 'Dirt' }, quotes: {}, now: Date.parse('2026-11-07T20:00:00Z'), card: { mmdd: '1107', card_year: 2026 }, mode: 'card'
  }));
  assert.equal((bareHtml.match(/data-rank=/g) || []).length, 0);
  assert.match(bareHtml, /Order unavailable/);
  assert.doesNotMatch(bareHtml, /forecast accuracy/i);
  const partial = FU.stageModel({ horses: horses.slice(0, 4), stage_orders: { first: ['1', '2'], second: ['1'], finish: ['1'] } });
  assert.ok(partial.stages.every((s) => !s.ok));
});

test('field notes use only supplied comparisons and do not invent signals', () => {
  const signals = FU.fieldSignals({
    horses: [
      { pgm: '2', ot: { style: 'E' } },
      { pgm: '3', ot: { style: 'EP', rk: 2, rkn: 8 } },
      { pgm: '5', horse: 'No tags' }
    ]
  });
  assert.match(signals.pace.text, /not a sectional position/);
  assert.match(signals.strengthsText, /sheet rank 2 of 8/);
  assert.match(signals.signalsNote, /does not add any/);
  const unknown = FU.fieldSignals({ horses: [{ pgm: '1', horse: 'A' }] });
  assert.equal(unknown.pace.state, 'unknown');
  assert.match(unknown.strengthsText, /unavailable/);
});

test('selection and the open runner survive twenty refresh ticks', () => {
  const races = [
    { trk: 'FIXT', race: 1 },
    { trk: 'FIXT', race: 2 },
    { trk: 'FIXT', race: 3 }
  ];
  let sel = { trk: 'FIXT', no: 2, openPgm: '1A', focusPgm: '11' };
  for (let i = 0; i < 20; i++) sel = FU.orientMove(races, sel, { type: 'tick' });
  assert.equal(sel.no, 2);
  assert.equal(sel.openPgm, '1A');
  assert.equal(sel.focusPgm, '11');
  sel = FU.orientMove(races, sel, { type: 'resume' });
  assert.equal(sel.openPgm, '1A');
  const jumped = FU.orientMove(races, sel, { type: 'nextOpen', trk: 'FIXT', no: 1 });
  assert.equal(jumped.no, 1);
  assert.equal(jumped.openPgm, null);
  const back = FU.orientMove(races, jumped, { type: 'next' });
  assert.equal(String(back.no), '2');
  const stay = FU.orientMove(races, { trk: 'FIXT', no: 1, openPgm: '4', focusPgm: '4' }, { type: 'prev' });
  assert.equal(stay.no, 1);
  assert.equal(stay.openPgm, '4');
});

test('names and markup stay escaped, and the pill does not call a fixture current', () => {
  const race = {
    trk: 'FIXT', race: 1, surf: 'Dirt',
    horses: [{ pgm: '11', horse: 'Name <script> & "quoted" (IRE)', p_raw: 1 }]
  };
  const now = Date.parse('2026-11-07T20:00:00Z');
  const meta = FU.buildMeta({
    race, now, card: { mmdd: '1107', card_year: 2026 }, mode: 'fixture',
    quotes: { '11': { dec: 3, age: 4, ts: now - 4000 } },
    status: { age: 4, ts: now - 4000, status: 'open' },
    feed: { quote: { okAt: now, seen: true, failing: false }, status: { okAt: now, seen: true, failing: false } }
  });
  const html = FU.raceUsabilityHtml(meta);
  assert.ok(html.includes('Name &lt;script&gt;'));
  assert.equal(html.includes('<script>'), false);
  assert.match(html, /Country IRE/);
  const pill = FU.pillModel(meta);
  assert.equal(pill.cls, 'ok');
  assert.match(pill.text, /FIXTURE SIMULATION/);
  assert.doesNotMatch(pill.text, /\blive\b/i);
  const disconnected = FU.pillModel(Object.assign({}, meta, {
    quoteFeed: 'disconnected',
    feed: { quote: { failing: true, seen: true, okAt: now }, status: { failing: true, seen: true, okAt: now } }
  }));
  assert.equal(disconnected.cls, 'down');
  assert.match(disconnected.text, /disconnected/);
});

test('public index keeps auth and the freshness windows, and drops inferred scratches', () => {
  const index = read('index.html');
  function has(needle) { assert.equal(index.includes(needle), true, 'missing ' + needle); }
  has('id="gate"');
  has('function decryptWith');
  has('setInterval(fetchLive,3000)');
  has('setInterval(fetchStatus,3000)');
  has('FRESH_QUOTE_S=30');
  has('STALE_STATUS_S=150');
  has('js/usability.js?v=t438-usability-3');
  has('css/usability.css?v=t438-usability-3');
  has('race_date=eq."+DATE');
  has('FU.classifyRunners');
  has('function onClockTick');
  has('visibilitychange');
  has('function tryUnlock');
  has('id="carddate">11-09-2026<');
  assert.equal(index.includes('id="carddate">11-08-2026<'), false);
  assert.equal(index.includes('off the tote (late scratch)'), false);
  assert.equal(index.includes('Supplemental runner board'), false);
  assert.equal(index.includes('International Velvet'), false);
  assert.equal(index.includes('usability-fixture'), false);
  assert.equal(index.includes('const ENC = {'), true);
  assert.equal(index.includes('FURLONG Live Card'), true);
  const crypto = require('node:crypto');
  const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');
  assert.equal(sha('functions/api/login.js'), '1741004804072d7b9d4849916adbac25785b7ce5c6542c3b933797faf6eff570');
  assert.equal(sha('functions/api/card.js'), '62956b53434c2602cd876b46b5b75e0eccdc0347ed49b63deefcbf661334efad');
  assert.equal(sha('functions/api/logout.js'), '13f397ce2e3e3662ad7a422f09f5256c292ebd3a26a0424756fbe640bfd40141');
  assert.equal(sha('functions/api/callback.js'), '4ac250a99864ed8d9cb852995fd867e0f8e49212f92477adfa96b69cfee7716f');
  assert.equal(sha('members_card.enc'), '4a1c4c3e9af3dc7cb75a72b4993dce364a861739ee66411d8e436a0159f0a93f');
  const encLine = index.split('\n').find((line) => line.startsWith('const ENC'));
  assert.equal(crypto.createHash('sha256').update(encLine).digest('hex'), 'b3188b35d17c4032e16f640e261a886fdec098cd2fc4169181c74d646e71532d');
  const encObj = JSON.parse(encLine.slice(encLine.indexOf('{'), encLine.lastIndexOf('}') + 1));
  assert.equal(encObj.n, 200000);
  assert.deepEqual(Object.keys(encObj).sort(), ['c', 'i', 'n', 's']);
});

test('live_quote race_date=eq.1107 matches real MMDD rows and ISO does not', async () => {
  const index = read('index.html');
  const supa = index.match(/const SUPA="([^"]+)"/)[1];
  const key = index.match(/const KEY="([^"]+)"/)[1];
  assert.equal(FU.feedRaceDate('1107').query, 'race_date=eq.1107');
  assert.equal(FU.feedRaceDate('1108').query, 'race_date=eq.1108');
  const headers = { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' };
  const got = await fetch(supa + '/rest/v1/live_quote?' + FU.feedRaceDate('1107').query + '&select=race_date&limit=5', { headers });
  assert.equal(got.status, 200);
  const rows = await got.json();
  assert.ok(Array.isArray(rows) && rows.length > 0);
  rows.forEach((row) => assert.equal(row.race_date, '1107'));
  const iso = await fetch(supa + '/rest/v1/live_quote?race_date=eq.2026-11-07&select=race_date&limit=3', { headers });
  assert.equal(iso.status, 200);
  const isoRows = await iso.json();
  assert.ok(Array.isArray(isoRows));
  assert.equal(isoRows.length, 0);
});

test('fixture file is synthetic and is not wired as a live fallback', () => {
  const card = read('staging/fixture-card.js');
  assert.match(card, /SYNTHETIC FIXTURE/);
  assert.match(card, /not a forecast/);
  assert.equal(read('index.html').includes('fixture-card.js'), false);
  assert.match(read('staging/usability-fixture.html'), /noindex/);
});
