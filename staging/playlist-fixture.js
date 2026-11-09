/* Synthetic 11/09-shaped play list. No network and no production card. */
(function () {
  var now = Date.parse('2026-11-09T17:00:00Z');
  var nowSec = 12 * 3600;
  var feedDown = false;

  function horse(pgm, name, p, ml, extra) {
    var h = { pgm: String(pgm), horse: name, p_raw: p, ml_dec: ml };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  var card = {
    fixture: true,
    label: 'SYNTHETIC FIXTURE — 11/09 payload shape, not a race card',
    mmdd: '1109',
    card_year: 2026,
    source_captured_at: '2026-11-09T06:00:00-05:00',
    races: [
      {
        trk: 'FL', race: 1, surf: 'Dirt', dist: '5.5f', post: '12:10PM', verdict: 'PLAY',
        v25_info: { pattern_gap: 'pace shape' },
        horses: [
          horse(3, 'Close Sample', 0.25, 3, { tier: 'LEAN' }),
          horse(5, 'Not A Pick', 0.08, 12)
        ],
        stage_orders: { first: ['3', '5'], second: ['5', '3'], finish: ['3', '5'] }
      },
      {
        trk: 'FL', race: 2, surf: 'Dirt', dist: '6f', post: '12:22PM', verdict: 'BET', pick: '1',
        horses: [
          horse(1, 'Bet Sample', 0.2, 4, { v25_pattern_gap: 'lone speed', v25_pattern_gap_min: 4 }),
          horse(4, 'Also Ran', 0.07, 15)
        ]
      },
      {
        trk: 'IND', race: 1, surf: 'Dirt', dist: '1m', post: '12:40PM', verdict: 'PLAY',
        picks: ['2', '6'],
        horses: [
          horse(2, 'Under Sample', 0.15, 6, { v25_pattern_gap: 'pressured' }),
          horse(6, 'Second Pick', 0.12, 8, { is_value_alt: true }),
          horse(8, 'Outside', 0.04, 20)
        ]
      },
      {
        trk: 'MNR', race: 3, surf: 'Dirt', dist: '6f', post: '1:05PM', verdict: 'WATCH',
        horses: [horse(4, 'Stale Sample', 0.22, 5)]
      },
      {
        trk: 'IND', race: 4, surf: 'Dirt', dist: '6f', post: '11:30AM', verdict: 'PLAY',
        horses: [horse(7, 'Finished Sample', 0.18, 5)]
      },
      {
        trk: 'FL', race: 8, surf: 'Turf', dist: '1m', post: '12:55PM', verdict: 'PASS',
        horses: [horse(1, 'Passed Example', 0.3, 3)]
      }
    ]
  };

  function liveFor(race) {
    if (race.verdict === 'PASS') return { grp: 'pass', code: 'PASS_LOW', badge: 'PASS' };
    if (race.verdict === 'BET') return { grp: 'bet', code: 'BET_NOW', badge: 'BET' };
    return { grp: 'watch', code: 'WATCH', badge: race.verdict || 'PLAY' };
  }

  function quote(race, pgm) {
    if (feedDown) return null;
    var key = race.trk + '|' + race.race + '|' + pgm;
    var table = {
      'FL|1|3': { dec: 4.6, ts: now },
      'FL|2|1': { dec: 8, ts: now },
      'IND|1|2': { dec: 5, ts: now },
      'IND|1|6': { dec: 6, ts: now },
      'MNR|3|4': { dec: 5, ts: now - 1701000 }
    };
    return table[key] || null;
  }

  var ui = { filter: 'all', track: 'all', showFinished: false, beat: 1 };

  function rowsFor(race) {
    var passed = PL.isPassMark(race, liveFor(race)).pass;
    return PL.playPicks(race).map(function (pk) {
      var q = quote(race, pk.pgm);
      return {
        pgm: pk.pgm, name: pk.name, role: pk.role, minText: pk.minText, gapText: pk.gapText, tier: pk.tier,
        meter: PL.meter({
          winDec: q ? q.dec : null,
          age: q ? (now - q.ts) / 1000 : null,
          ts: q ? q.ts : null,
          now: now,
          minDecimal: pk.minDecimal,
          history: [],
          racePassed: passed,
          freshS: 30,
          formatTime: function (ts) { return FU.formatEt(ts); }
        })
      };
    });
  }

  function render() {
    var shown = [];
    var hidden = 0;
    card.races.forEach(function (race) {
      if (PL.isPassMark(race, liveFor(race)).pass) hidden += 1;
      else shown.push(race);
    });
    var records = shown.map(function (race) {
      var finished = race.trk === 'IND' && String(race.race) === '4';
      return PL.raceRow({
        trk: race.trk, race: race.race, post: race.post, nowSec: nowSec, finished: finished,
        badge: liveFor(race).badge, feedDown: feedDown, picks: rowsFor(race)
      });
    });
    var tracks = [];
    records.forEach(function (r) { if (tracks.indexOf(r.trk) < 0) tracks.push(r.trk); });
    var view = PL.applyView(records, ui);
    document.getElementById('playlist').innerHTML = PL.boardHtml({
      hiddenCount: hidden,
      feedDown: feedDown,
      lastUpdate: feedDown ? '' : PL.clockAp(now),
      beat: ui.beat,
      showFinished: ui.showFinished,
      finishedCount: records.filter(function (r) { return r.finished; }).length,
      filter: ui.filter,
      track: ui.track,
      tracks: tracks,
      rows: view
    });
    check(view, hidden);
  }

  function check(view, hidden) {
    var text = document.getElementById('playlist').innerText;
    var problems = [];
    if (text.indexOf('Passed Example') >= 0) problems.push('passed race visible');
    if (hidden !== 1) problems.push('hidden ' + hidden);
    if (document.querySelector('#playlist [data-stage]')) problems.push('ovals in the play list');
    if (text.indexOf('MIN_PRICE_MULTIPLIER') >= 0) problems.push('constant name visible');
    var blob = text.toLowerCase();
    var full = !feedDown && ui.filter === 'all' && ui.track === 'all' && !ui.showFinished;
    if (full) {
      ['bet', 'close', 'pass', 'waiting', 'next', 'in 10m', 'lone speed', 'second pick', 'auto-refreshing', 'all upcoming', 'bets only'].forEach(function (needle) {
        if (blob.indexOf(needle) < 0) problems.push('missing ' + needle);
      });
    }
    if (!feedDown && ui.filter === 'bet') {
      if (text.indexOf('Bet Sample') < 0) problems.push('bet filter missed a bet');
      if (text.indexOf('Close Sample') >= 0 || text.indexOf('Stale Sample') >= 0) problems.push('bet filter showed a non-bet');
    }
    if (text.indexOf('Not A Pick') >= 0 || text.indexOf('Also Ran') >= 0 || text.indexOf('Outside') >= 0) problems.push('non-pick shown');
    if (!ui.showFinished && text.indexOf('Finished Sample') >= 0) problems.push('finished race shown');
    if (feedDown) {
      if (text.indexOf(PL.FEED_DOWN_BANNER) < 0) problems.push('missing feed banner');
      if (text.indexOf('Bet Sample') < 0) problems.push('picks hidden when feed is down');
    } else if (text.indexOf(PL.FEED_DOWN_BANNER) >= 0) problems.push('banner while quotes exist');
    var qa = document.getElementById('qa');
    qa.textContent = problems.length ? ('Fixture checks failed: ' + problems.join('; ')) : 'Sample odds only. Play list checks passed.';
    qa.dataset.ok = problems.length ? '0' : '1';
  }

  document.getElementById('playlist').addEventListener('click', function (ev) {
    var filter = ev.target.closest && ev.target.closest('[data-plfilter]');
    if (filter) { ui.filter = filter.getAttribute('data-plfilter'); render(); return; }
    var track = ev.target.closest && ev.target.closest('[data-pltrack]');
    if (track) { ui.track = track.getAttribute('data-pltrack'); render(); return; }
    if (ev.target.closest && ev.target.closest('[data-pldone]')) { ui.showFinished = !ui.showFinished; render(); return; }
    if (ev.target.closest && ev.target.closest('summary')) return;
    var row = ev.target.closest && ev.target.closest('[data-open]');
    if (!row) return;
    document.getElementById('qa').textContent = 'Opened ' + row.getAttribute('data-trk') + ' R' + row.getAttribute('data-race') + ' on the full card.';
  });
  document.getElementById('feed').addEventListener('click', function () {
    feedDown = !feedDown;
    this.textContent = feedDown ? 'Restore mocked quotes' : 'Show feed down';
    ui.beat += 1;
    render();
  });
  render();
  setInterval(function () { ui.beat += 1; render(); }, 30000);
})();
