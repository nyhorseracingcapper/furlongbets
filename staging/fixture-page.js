/* Fixture harness. Talks only to FU and the synthetic card. No network. */
(function () {
  var card = window.FIXTURE_CARD;
  var now = Date.parse('2026-11-07T20:00:00Z');
  var sel = { trk: 'FIXT', no: 1, openPgm: '11', focusPgm: '11' };
  var feed = { quote: { okAt: now, failAt: null, failing: false, seen: true }, status: { okAt: now, failAt: null, failing: false, seen: true } };
  var scenario = 'fresh';

  function race() {
    return card.races.filter(function (r) { return r.trk === sel.trk && String(r.race) === String(sel.no); })[0];
  }

  function quotesFor(r) {
    var q = {};
    var mixed = scenario !== 'clean';
    (r.horses || []).forEach(function (h) {
      var pgm = String(h.pgm);
      if (scenario === 'partial' && (pgm === '7' || pgm === '5')) return;
      if (mixed && pgm === '7') return;
      var ts = now - 4000;
      var dec = 5 + (parseInt(pgm, 10) || 2);
      if (mixed && pgm === '4') ts = now - 80000;
      if (mixed && pgm === '8') ts = now + 120000;
      if (mixed && pgm === '6') dec = 0;
      q[pgm] = { dec: dec, ts: ts, age: (now - ts) / 1000 };
    });
    if (scenario === 'no-quotes') return {};
    return q;
  }

  function statusFor() {
    if (scenario === 'no-status') return null;
    var ts = now - 5000;
    if (scenario === 'stale-status') ts = now - 180000;
    if (scenario === 'future-status') ts = now + 60000;
    return { ts: ts, age: (now - ts) / 1000, status: 'open', mtp: 4 };
  }

  function meta() {
    return FU.buildMeta({
      race: race(),
      quotes: quotesFor(race()),
      status: statusFor(),
      feed: feed,
      now: now,
      card: card,
      focusPgm: sel.focusPgm,
      mode: 'fixture',
      cardDate: card.mmdd
    });
  }

  function paint(opts) {
    opts = opts || {};
    var m = meta();
    var nb = FU.neighbors(card.races, sel.trk, sel.no);
    document.getElementById('orient').innerHTML = FU.orientHtml({
      date: m.date,
      selected: { trk: sel.trk, no: sel.no },
      prev: nb.prev,
      next: nb.next
    });
    var pill = FU.pillModel(m);
    document.getElementById('status').textContent = pill.text;
    document.getElementById('feeddot').className = 'dot ' + pill.cls;
    var host = document.getElementById('usability');
    if (!host.dataset.ready) {
      host.innerHTML = '<div id="fu-banner-slot"></div><div id="fu-trust-slot"></div><div id="fu-rest-slot"></div>';
      host.dataset.ready = '1';
    }
    document.getElementById('fu-banner-slot').innerHTML = FU.bannerHtml(m);
    document.getElementById('fu-trust-slot').innerHTML = FU.trustHtml(m);
    if (opts.rest !== false) document.getElementById('fu-rest-slot').innerHTML = FU.restHtml(m);
    var rail = '<div class="fu-rail" role="tablist" aria-label="Fixture races">' + card.races.map(function (r) {
      var on = String(r.race) === String(sel.no) ? ' on' : '';
      return '<button type="button" class="fu-rpill' + on + '" aria-current="' + (on ? 'true' : 'false') + '" onclick="selectRace(\'FIXT\',' + r.race + ')">Race ' + r.race + '</button>';
    }).join('') + '</div>';
    document.getElementById('rail').innerHTML = rail;
    var log = document.getElementById('qa-log');
    log.textContent = 'scenario=' + scenario
      + ' selected=' + sel.trk + ' R' + sel.no
      + ' focus=' + sel.focusPgm
      + ' open=' + sel.openPgm
      + ' pill=' + pill.cls
      + ' stages=' + m.stages.stages.map(function (s) { return s.key + ':' + (s.ok ? 'ok' : 'unavailable'); }).join(' ');
  }

  window.stepRace = function (dir) {
    sel = FU.orientMove(card.races, sel, { type: dir < 0 ? 'prev' : 'next' });
    paint();
  };
  window.selectRace = function (trk, no) {
    sel = FU.orientMove(card.races, sel, { type: 'select', trk: trk, no: no });
    paint();
  };
  window.fuFocusPgm = function (pgm) {
    sel = FU.orientMove(card.races, sel, { type: 'focus', pgm: pgm });
    paint();
  };
  window.jumpNextOpen = function () {
    var open = card.races.filter(function (r) { return String(r.race) !== '4'; })[0];
    var upcoming = card.races.filter(function (r) { return String(r.race) === '2'; });
    if (scenario === 'card-done') return;
    sel = FU.orientMove(card.races, sel, { type: 'nextOpen', trk: upcoming[0].trk, no: upcoming[0].race });
    paint();
    return open;
  };

  function connectFeeds() {
    feed = FU.feedReduce(FU.feedReduce(feed, { channel: 'quote', type: 'success' }, now), { channel: 'status', type: 'success' }, now);
  }
  function setScenario(name) {
    scenario = name;
    if (name === 'both-fail') {
      feed = FU.feedReduce(FU.feedReduce(feed, { channel: 'quote', type: 'fail', error: 'network' }, now), { channel: 'status', type: 'fail', error: 'network' }, now);
    } else {
      connectFeeds();
    }
    paint();
  }

  window.__QA = {
    setScenario: setScenario,
    tick: function (times) {
      var n = times || 1;
      for (var i = 0; i < n; i++) {
        now += 1000;
        sel = FU.orientMove(card.races, sel, { type: 'tick' });
      }
      paint({ rest: false });
    },
    resume: function (ms) {
      now += ms;
      sel = FU.orientMove(card.races, sel, { type: 'resume' });
      feed = FU.feedReduce(FU.feedReduce(feed, { channel: 'quote', type: 'fail', error: 'resume' }, now), { channel: 'status', type: 'fail', error: 'resume' }, now);
      paint();
    },
    midnight: function () {
      now = Date.parse('2026-11-08T05:00:01Z');
      sel = FU.orientMove(card.races, sel, { type: 'tick' });
      paint();
    },
    state: function () {
      return { scenario: scenario, sel: { trk: sel.trk, no: sel.no, openPgm: sel.openPgm, focusPgm: sel.focusPgm }, now: now, meta: meta(), feed: feed };
    }
  };

  document.getElementById('sc-fresh').onclick = function () { setScenario('fresh'); };
  document.getElementById('sc-fail').onclick = function () { setScenario('both-fail'); };
  document.getElementById('sc-partial').onclick = function () { setScenario('partial'); };
  document.getElementById('sc-future').onclick = function () { setScenario('future-status'); };
  document.getElementById('sc-resume').onclick = function () { window.__QA.resume(45000); };
  document.getElementById('sc-midnight').onclick = function () { window.__QA.midnight(); };
  document.getElementById('sc-cycles').onclick = function () { window.__QA.tick(20); };
  paint();
})();
