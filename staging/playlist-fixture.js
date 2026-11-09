/* Synthetic play-list fixture. No network and no production card. */
(function () {
  var now = Date.parse('2026-11-09T17:00:00Z');
  var lifted = false;

  function horse(pgm, name, p, ml) {
    return { pgm: String(pgm), horse: name, p_raw: p, ml_dec: ml, model_rank: Number(pgm) || 99 };
  }

  var card = {
    fixture: true,
    label: 'SYNTHETIC FIXTURE — not a race card and not a forecast',
    mmdd: '1109',
    card_year: 2026,
    source_captured_at: '2026-11-09T06:00:00-05:00',
    races: [
      {
        trk: 'FIXT', race: 1, surf: 'Dirt', dist: '6f', post: '1:10 PM', verdict: 'PLAY',
        horses: [horse(4, 'Longer Price', 0.147, 7), horse(6, 'Model Top', 0.4, 2.4), horse(2, 'Field Example', 0.08, 12)],
        stage_orders: { first: ['4', '6', '2'], second: ['6', '4', '2'], finish: ['4', '2', '6'] }
      },
      {
        trk: 'FIXT', race: 3, surf: 'Turf', dist: '1m', post: '1:40 PM',
        horses: [horse(1, 'Fresh Bet', 0.2, 4), horse(2, 'Empty Price', 0.15, 6), horse(9, 'Also Ran', 0.05, 20)],
        stage_orders: { first: ['1', '2', '9'], second: ['2', '1', '9'], finish: ['1', '9', '2'] }
      },
      {
        trk: 'FIXT', race: 4, surf: 'Dirt', dist: '6f', post: '2:05 PM',
        horses: [horse(3, 'Stale Quote', 0.22, 5), horse(5, 'Collapse Example', 0.1, 8), horse(7, 'Outer Example', 0.04, 20)],
        stage_orders: { first: ['5', '3', '7'], second: ['3', '5', '7'], finish: ['5', '7', '3'] }
      },
      {
        trk: 'FIXT', race: 5, surf: 'Synth', dist: '5f', post: '2:30 PM',
        horses: [horse(8, 'Missing Quote', 0.18, 6), horse(1, 'Second Missing', 0.12, 8)],
        stage_orders: { first: ['8', '1'], second: ['1', '8'], finish: ['8', '1'] }
      },
      {
        trk: 'FIXT', race: 2, surf: 'Dirt', dist: '6f', post: '1:25 PM', verdict: 'PASS',
        horses: [horse(1, 'Passed Example', 0.33, 3)],
        stage_orders: { first: ['1'], second: ['1'], finish: ['1'] }
      },
      {
        trk: 'FIXT', race: 6, surf: 'Dirt', dist: '1m', post: '2:55 PM',
        horses: [horse(4, 'Live Pass Example', 0.28, 4)],
        stage_orders: { first: ['4'], second: ['4'], finish: ['4'] }
      }
    ]
  };

  function liveFor(race) {
    if (String(race.race) === '6') return { grp: 'pass', code: 'PASS_LOW', badge: 'PASS (LOW CONFIDENCE)' };
    if (race.verdict) return { grp: 'watch', code: 'WATCH', badge: race.verdict };
    return { grp: 'watch', code: 'WATCH', badge: 'WATCHING' };
  }

  function quote(race, pgm) {
    var key = race.trk + '|' + race.race + '|' + pgm;
    var table = {
      'FIXT|1|4': { dec: lifted ? 12 : 7, ts: now - 4000 },
      'FIXT|1|6': { dec: 3, ts: now - 4000 },
      'FIXT|3|1': { dec: 8, ts: now - 3000 },
      'FIXT|3|2': { dec: 0, ts: now - 3000 },
      'FIXT|4|3': { dec: 5, ts: now - 1701000 },
      'FIXT|4|5': { dec: 8, ts: now - 2000 }
    };
    return table[key] || null;
  }

  function history(race, pgm) {
    if (String(race.race) === '4' && String(pgm) === '5') return [{ dec: 20, ts: now - 60000 }];
    return [];
  }

  function rowsFor(race, passed) {
    return PL.playPicks(race).map(function (pk) {
      var q = quote(race, pk.pgm);
      var age = q ? (now - q.ts) / 1000 : null;
      return {
        pgm: pk.pgm,
        name: pk.name,
        role: pk.role,
        mlText: pk.mlText,
        minText: pk.minText,
        meter: PL.meter({
          winDec: q ? q.dec : null,
          age: age,
          ts: q ? q.ts : null,
          now: now,
          minDecimal: pk.minDecimal,
          history: history(race, pk.pgm),
          racePassed: passed,
          freshS: 30,
          formatTime: function (ts) { return FU.formatEt(ts); }
        })
      };
    });
  }

  function ovalsFor(race, suffix) {
    var meta = FU.buildMeta({
      race: race,
      quotes: {},
      now: now,
      card: card,
      mode: 'fixture',
      feed: { quote: { okAt: now, seen: true, failing: false }, status: { okAt: now, seen: true, failing: false } }
    });
    return FU.ovalsHtml(meta, { idSuffix: suffix });
  }

  function render() {
    var split = PL.splitRaces(card.races, {
      'FIXT|1': liveFor(card.races[0]),
      'FIXT|2': liveFor(card.races[4]),
      'FIXT|3': liveFor(card.races[1]),
      'FIXT|4': liveFor(card.races[2]),
      'FIXT|5': liveFor(card.races[3]),
      'FIXT|6': liveFor(card.races[5])
    });
    var races = split.shown.map(function (race) {
      var live = liveFor(race);
      return {
        key: race.trk + '|' + race.race,
        trk: race.trk,
        race: String(race.race),
        meta: [race.surf, race.dist, race.post].filter(Boolean).join(' · '),
        badge: race.verdict || 'PLAY',
        stageNote: PL.stageNote(FU.stageModel(race)),
        ovalsHtml: ovalsFor(race, race.trk + '-' + race.race),
        rows: rowsFor(race, PL.isPassMark(race, live).pass)
      };
    });
    document.getElementById('playlist').innerHTML = PL.listHtml({
      hiddenCount: split.hidden.length,
      feedNote: 'Fixture quotes only. win_dec is decimal odds. A quote older than 30s is no live odds.',
      races: races
    });
    var sample = card.races[0];
    document.getElementById('excerpt-ovals').innerHTML = ovalsFor(sample, 'excerpt');
    document.getElementById('excerpt-meter').innerHTML = PL.renderMeterBlock(rowsFor(sample, false), 'Play-list meter');
    check(split);
  }

  function check(split) {
    var root = document.getElementById('playlist');
    var text = root.innerText;
    var problems = [];
    if (text.indexOf('Passed Example') >= 0) problems.push('payload PASS race is visible');
    if (text.indexOf('Live Pass Example') >= 0) problems.push('live PASS race is visible');
    if (split.hidden.length !== 2) problems.push('expected 2 hidden races');
    var meters = Array.prototype.map.call(root.querySelectorAll('.pl-meter'), function (el) {
      var price = el.querySelector('.pl-px');
      return {
        tone: el.getAttribute('data-tone'),
        reason: el.getAttribute('data-reason'),
        price: price ? price.textContent : ''
      };
    });
    function has(reason) { return meters.some(function (m) { return m.reason === reason; }); }
    var need = lifted
      ? ['bet', 'near', 'collapse', 'stale', 'nonpositive', 'missing']
      : ['bet', 'near', 'below', 'collapse', 'stale', 'nonpositive', 'missing'];
    need.forEach(function (reason) {
      if (!has(reason)) problems.push('missing meter ' + reason);
    });
    meters.forEach(function (m) {
      if ((m.reason === 'stale' || m.reason === 'missing' || m.reason === 'nonpositive') && m.price) {
        problems.push(m.reason + ' showed a price');
      }
    });
    var stages = root.querySelectorAll('[data-stage]').length;
    if (stages !== split.shown.length * 3) problems.push('oval count ' + stages);
    if (root.querySelector('#ovalViews')) problems.push('play list reused the card oval id');
    var qa = document.getElementById('qa');
    qa.textContent = problems.length ? ('Fixture checks failed: ' + problems.join('; ')) : ('Fixture checks passed. ' + split.shown.length + ' plays, ' + split.hidden.length + ' passed races hidden.');
    qa.dataset.ok = problems.length ? '0' : '1';
  }

  document.getElementById('lift').addEventListener('click', function () {
    lifted = !lifted;
    this.textContent = lifted ? 'Put the short price back under its minimum' : 'Raise the short price above its minimum';
    render();
  });
  document.getElementById('viewPlay').addEventListener('click', function () {
    document.getElementById('playlist').hidden = false;
    document.getElementById('excerpt').hidden = true;
    this.classList.add('on');
    this.setAttribute('aria-pressed', 'true');
    document.getElementById('viewCard').classList.remove('on');
    document.getElementById('viewCard').setAttribute('aria-pressed', 'false');
  });
  document.getElementById('viewCard').addEventListener('click', function () {
    document.getElementById('playlist').hidden = true;
    document.getElementById('excerpt').hidden = false;
    this.classList.add('on');
    this.setAttribute('aria-pressed', 'true');
    document.getElementById('viewPlay').classList.remove('on');
    document.getElementById('viewPlay').setAttribute('aria-pressed', 'false');
  });
  window.fuToggleOvalZoom = function (id) {
    var el = document.getElementById(id || 'ovalViews');
    if (!el) return;
    el.classList.toggle('zoom');
  };
  window.fuFocusPgm = function () {};
  render();
})();
