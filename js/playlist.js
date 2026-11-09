/* Play list and live-odds meter.
   Reads the decrypted card only. Does not decrypt, write, or change stage geometry.
   win_dec on live_quote is decimal odds: odds-to-1 = win_dec - 1.
   Confirmed from the page formatter (frac uses dec - 1) and from race_date 1108 rows
   (win_dec 5 is 4-1, win_dec 4 is 3-1, win_dec 0 is an empty price). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.PL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* Fair decimal odds are multiplied by this to get the minimum acceptable price. */
  var MIN_PRICE_MULTIPLIER = 1.25;

  /* Placeholder until the band is fitted on timed tote snapshots. Yellow when
     live decimal odds are in [YELLOW_BAND_LO, 1) times the minimum. */
  var YELLOW_BAND_LO = 0.85;

  /* Placeholder until fitted. A fresh quote is a late-money collapse when some
     earlier quote in the window was at or above the minimum and the current
     decimal odds are through the minimum and at least `drop` lower. */
  var COLLAPSE_RULE = { drop: 0.30, windowMs: 3 * 60 * 1000 };

  var VERDICT_KEYS = ['verdict', 'copilot_verdict', 'decision', 'call'];
  var HISTORY = {};

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function modelProb(h) {
    if (!h) return null;
    if (h.p_raw != null && h.p_raw !== '' && isFinite(Number(h.p_raw))) return Number(h.p_raw);
    if (h.win != null && h.win !== '' && isFinite(Number(h.win))) return Number(h.win) / 100;
    return null;
  }

  function fairDecimal(p) {
    var n = Number(p);
    if (!isFinite(n) || n <= 0 || n > 1) return null;
    return 1 / n;
  }

  function minDecimal(p) {
    var fair = fairDecimal(p);
    if (fair == null) return null;
    return fair * MIN_PRICE_MULTIPLIER;
  }

  function oddsTo1(dec) {
    var n = Number(dec);
    if (!isFinite(n)) return '';
    var o = n - 1;
    if (o <= 0.03) return 'EVN';
    var rounded = Math.round(o * 100) / 100;
    var text = rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return text + '-1';
  }

  function passToken(value) {
    var t = String(value == null ? '' : value).trim().toUpperCase();
    if (!t) return false;
    if (t.indexOf('NOT PASS') >= 0 || t.indexOf('NON-PASS') >= 0 || t.indexOf('NO PASS') >= 0) return false;
    if (t === 'PASS' || t === 'PASSED') return true;
    return /\bPASS\b/.test(t);
  }

  function payloadVerdict(race) {
    if (!race || typeof race !== 'object') return null;
    var i, v, status;
    for (i = 0; i < VERDICT_KEYS.length; i++) {
      v = race[VERDICT_KEYS[i]];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    if (typeof race.status === 'string') {
      status = race.status.trim().toUpperCase();
      if (status === 'PASS' || status === 'PLAY' || status === 'BET' || status === 'WATCH') return race.status.trim();
    }
    return null;
  }

  function livePass(live) {
    var grp = live && live.grp;
    var code = live && live.code ? String(live.code) : '';
    return grp === 'pass' || code.indexOf('PASS') === 0;
  }

  function isPassMark(race, live) {
    var payload = payloadVerdict(race);
    if (payload != null) {
      return { pass: passToken(payload), source: 'payload', text: payload };
    }
    if (livePass(live)) {
      return { pass: true, source: 'live-call', text: (live && (live.badge || live.code)) || 'PASS' };
    }
    return { pass: false, source: 'live-call', text: (live && live.badge) || '' };
  }

  /* The list uses the card verdict when the payload has one. The meter still
     refuses a bet when either source has marked the race PASS. */
  function meterPassed(race, live) {
    return isPassMark(race, live).pass || livePass(live);
  }

  function splitRaces(races, liveByKey) {
    var shown = [];
    var hidden = [];
    (races || []).forEach(function (race) {
      var key = String(race && race.trk) + '|' + String(race && race.race);
      var live = liveByKey ? liveByKey[key] : null;
      if (isPassMark(race, live).pass) hidden.push(race);
      else shown.push(race);
    });
    return { shown: shown, hidden: hidden };
  }

  function byPgm(horses) {
    var map = {};
    (horses || []).forEach(function (h) { if (h && h.pgm != null) map[String(h.pgm)] = h; });
    return map;
  }

  function findHorse(race, token) {
    if (token == null || token === '') return null;
    var horses = (race && race.horses) || [];
    var map = byPgm(horses);
    if (map[String(token)]) return map[String(token)];
    if (token && typeof token === 'object' && token.pgm != null && map[String(token.pgm)]) return map[String(token.pgm)];
    var name = String(token && token.horse ? token.horse : token).trim().toLowerCase();
    var i;
    for (i = 0; i < horses.length; i++) {
      if (String(horses[i].horse || '').trim().toLowerCase() === name) return horses[i];
    }
    return null;
  }

  function ranked(race) {
    return ((race && race.horses) || []).filter(function (h) {
      return h && !h.scr && modelProb(h) != null && modelProb(h) > 0;
    }).slice().sort(function (a, b) {
      var dp = modelProb(b) - modelProb(a);
      if (dp) return dp;
      var ra = a.model_rank == null ? 999 : Number(a.model_rank);
      var rb = b.model_rank == null ? 999 : Number(b.model_rank);
      return ra - rb;
    });
  }

  function playPicks(race) {
    var chosen = [];
    function add(h) {
      if (!h || h.scr) return;
      var pgm = String(h.pgm);
      if (chosen.some(function (c) { return c.pgm === pgm; })) return;
      if (chosen.length >= 2) return;
      var p = modelProb(h);
      var minD = minDecimal(p);
      var ml = h.ml_dec != null && isFinite(Number(h.ml_dec)) ? Number(h.ml_dec) : null;
      chosen.push({
        pgm: pgm,
        name: h.horse || h.name || '',
        p: p,
        fairDecimal: fairDecimal(p),
        minDecimal: minD,
        minText: minD == null ? '' : oddsTo1(minD),
        mlText: ml == null ? '' : oddsTo1(ml),
        role: chosen.length ? 'secondary' : 'primary'
      });
    }
    var explicit = race && (race.picks || race.play_picks);
    if (Array.isArray(explicit)) explicit.slice(0, 2).forEach(function (item) { add(findHorse(race, item)); });
    if (race && race.pick != null && race.pick !== '') add(findHorse(race, race.pick));
    ranked(race).forEach(add);
    if (chosen[0]) chosen[0].role = 'primary';
    if (chosen[1]) chosen[1].role = 'secondary';
    return chosen;
  }

  function noteQuote(key, dec, ts) {
    if (key == null || dec == null || ts == null) return;
    var d = Number(dec);
    var t = Number(ts);
    if (!isFinite(d) || !isFinite(t)) return;
    var arr = HISTORY[key] || (HISTORY[key] = []);
    var last = arr[arr.length - 1];
    if (last && last.ts === t && last.dec === d) return;
    arr.push({ dec: d, ts: t });
    if (arr.length > 80) arr.splice(0, arr.length - 80);
  }

  function history(key) {
    return HISTORY[key] ? HISTORY[key].slice() : [];
  }

  function resetHistory() { HISTORY = {}; }

  function freshAge(age, freshS) {
    return age != null && isFinite(Number(age)) && Number(age) >= 0 && Number(age) <= Number(freshS);
  }

  function formatUpdate(ts, formatTime, extra) {
    if (ts == null || !isFinite(Number(ts))) return extra ? ('no quote stored · ' + extra) : 'no quote stored';
    var label = null;
    if (typeof formatTime === 'function') {
      try { label = formatTime(Number(ts)); } catch (e) { label = null; }
    }
    if (!label) label = new Date(Number(ts)).toISOString();
    return 'last update ' + label + (extra ? ' · ' + extra : '');
  }

  function collapsed(input, anchor, current, minD) {
    var rule = COLLAPSE_RULE;
    var prior = null;
    (input.history || []).forEach(function (pt) {
      if (!pt || !isFinite(Number(pt.dec)) || !isFinite(Number(pt.ts))) return;
      var dec = Number(pt.dec);
      var ts = Number(pt.ts);
      if (dec <= 0) return;
      if (ts >= anchor || ts < anchor - rule.windowMs) return;
      if (dec < minD) return;
      if (prior == null || dec > prior) prior = dec;
    });
    if (prior == null) return false;
    if (!(current < minD)) return false;
    return (prior - current) / prior >= rule.drop;
  }

  function meter(input) {
    input = input || {};
    var minD = input.minDecimal == null ? null : Number(input.minDecimal);
    var ts = input.ts == null || input.ts === '' ? null : Number(input.ts);
    if (ts != null && !isFinite(ts)) ts = null;
    var base = {
      tone: 'none',
      word: 'no live odds',
      price: '',
      reason: 'missing',
      scratchInferred: false,
      updatedText: formatUpdate(ts, input.formatTime)
    };
    if (input.racePassed) {
      base.tone = 'red';
      base.word = 'PASS';
      base.reason = 'pass';
      base.price = '';
      return base;
    }
    if (minD == null || !isFinite(minD) || minD <= 0) {
      base.reason = 'no-minimum';
      base.word = 'no live odds';
      base.updatedText = formatUpdate(ts, input.formatTime, 'minimum unavailable');
      return base;
    }
    var hasQuote = input.winDec != null && input.winDec !== '' && isFinite(Number(input.winDec));
    if (!hasQuote) {
      base.reason = 'missing';
      return base;
    }
    var win = Number(input.winDec);
    var age = input.age == null ? null : Number(input.age);
    if (age != null && isFinite(age) && age < 0) {
      base.reason = 'future';
      base.updatedText = formatUpdate(ts, input.formatTime, 'quote time is ahead of the clock');
      return base;
    }
    if (!freshAge(age, input.freshS)) {
      base.reason = 'stale';
      return base;
    }
    if (win <= 0) {
      base.reason = 'nonpositive';
      base.updatedText = formatUpdate(ts, input.formatTime, 'not a scratch');
      return base;
    }
    var anchor = ts != null ? ts : Number(input.now);
    if (isFinite(anchor) && collapsed(input, anchor, win, minD)) {
      return {
        tone: 'red',
        word: 'LATE-MONEY COLLAPSE',
        price: oddsTo1(win),
        reason: 'collapse',
        scratchInferred: false,
        updatedText: formatUpdate(ts, input.formatTime)
      };
    }
    if (win >= minD) {
      return {
        tone: 'green',
        word: 'BET',
        price: oddsTo1(win),
        reason: 'bet',
        scratchInferred: false,
        updatedText: formatUpdate(ts, input.formatTime)
      };
    }
    if (win >= YELLOW_BAND_LO * minD) {
      return {
        tone: 'yellow',
        word: 'NEAR MIN',
        price: oddsTo1(win),
        reason: 'near',
        scratchInferred: false,
        updatedText: formatUpdate(ts, input.formatTime)
      };
    }
    return {
      tone: 'red',
      word: 'BELOW MIN',
      price: oddsTo1(win),
      reason: 'below',
      scratchInferred: false,
      updatedText: formatUpdate(ts, input.formatTime)
    };
  }

  function stageNote(model) {
    if (!model || !model.stages) return 'Stage fields were not checked.';
    var ok = model.stages.filter(function (s) { return s && s.ok; }).length;
    if (ok === 3) return 'Three stage orders are on the card. The ovals use those fields.';
    if (!ok) return 'This race has no complete stage order. The ovals stay empty instead of inventing one.';
    return ok + ' of 3 stage orders are complete. An incomplete oval stays unavailable.';
  }

  function rowHtml(row) {
    var m = row.meter || { tone: 'none', word: 'no live odds', price: '', updatedText: 'no quote stored', reason: 'missing' };
    var bits = [row.role || 'primary'];
    if (row.mlText) bits.push('ML ' + row.mlText);
    bits.push('min ' + (row.minText || 'unavailable'));
    var price = m.price ? '<b class="pl-px">' + esc(m.price) + '</b>' : '';
    return '<div class="pl-horse">'
      + '<div class="pl-who"><b>#' + esc(row.pgm) + ' ' + esc(row.name || '') + '</b>'
      + '<small>' + esc(bits.join(' · ')) + '</small></div>'
      + '<div class="pl-meter ' + esc(m.tone) + '" data-tone="' + esc(m.tone) + '" data-reason="' + esc(m.reason || '') + '">'
      + '<span class="pl-dot" aria-hidden="true"></span>'
      + price
      + '<span class="pl-word">' + esc(m.word) + '</span>'
      + '<span class="pl-upd">' + esc(m.updatedText || '') + '</span>'
      + '</div></div>';
  }

  function rowsHtml(rows) {
    return (rows || []).map(rowHtml).join('');
  }

  function legendHtml() {
    return '<div class="pl-legend">'
      + '<div><span class="pl-dot green"></span><b>GREEN = BET</b> live decimal odds at or above the minimum</div>'
      + '<div><span class="pl-dot yellow"></span><b>YELLOW = medium</b> live odds from '
      + Math.round(YELLOW_BAND_LO * 100) + '% of the minimum up to the minimum. That band is a placeholder.</div>'
      + '<div><span class="pl-dot red"></span><b>RED</b> below the band, the race is PASS, or a late-money drop of more than '
      + Math.round(COLLAPSE_RULE.drop * 100) + '% through the minimum inside '
      + Math.round(COLLAPSE_RULE.windowMs / 60000) + ' minutes. That drop rule is a placeholder.</div>'
      + '<div><span class="pl-dot none"></span><b>no live odds</b> missing, stale, or nonpositive quote. The last update is shown. The number is not. It is not a scratch.</div>'
      + '<p class="pl-note">Minimum price = fair decimal odds (1 / model win probability) × '
      + MIN_PRICE_MULTIPLIER + '. The multiplier is the constant MIN_PRICE_MULTIPLIER. Prices are odds-to-1 (decimal − 1). Live win_dec is decimal odds.</p>'
      + '</div>';
  }

  function listHtml(model) {
    model = model || {};
    var races = model.races || [];
    var hidden = model.hiddenCount || 0;
    var parts = [legendHtml()];
    parts.push('<p class="pl-count"><b>' + races.length + '</b> play-list races. <b>' + hidden
      + '</b> passed races are hidden here and stay on the full card.</p>');
    if (model.feedNote) parts.push('<p class="pl-feed">' + esc(model.feedNote) + '</p>');
    if (!races.length) parts.push('<p class="pl-empty">No play-list races. Passed races stay on the full card.</p>');
    races.forEach(function (race) {
      parts.push('<article class="pl-race" data-plrk="' + esc(race.key || '') + '">');
      parts.push('<header class="pl-hd"><button type="button" class="pl-jump" data-open="1" data-trk="'
        + esc(race.trk) + '" data-race="' + esc(race.race) + '"><b>' + esc(race.trk) + ' R' + esc(race.race)
        + '</b> <span class="pl-meta">' + esc(race.meta || '') + '</span></button>');
      parts.push('<span class="pl-pill">' + esc(race.badge || 'PLAY') + '</span></header>');
      parts.push(race.ovalsHtml || '');
      if (race.stageNote) parts.push('<p class="pl-stage">' + esc(race.stageNote) + '</p>');
      parts.push('<div class="pl-rows" data-plrows="' + esc(race.key || '') + '">' + rowsHtml(race.rows) + '</div>');
      parts.push('</article>');
    });
    return parts.join('');
  }

  function renderMeterBlock(rows, caption) {
    if (!rows || !rows.length) return '';
    return '<aside class="pl-cardmeter" aria-label="Play list meter">'
      + '<div class="pl-cap">' + esc(caption || 'Play-list meter') + '</div>'
      + rowsHtml(rows)
      + '</aside>';
  }

  return {
    MIN_PRICE_MULTIPLIER: MIN_PRICE_MULTIPLIER,
    YELLOW_BAND_LO: YELLOW_BAND_LO,
    COLLAPSE_RULE: COLLAPSE_RULE,
    modelProb: modelProb,
    fairDecimal: fairDecimal,
    minDecimal: minDecimal,
    oddsTo1: oddsTo1,
    payloadVerdict: payloadVerdict,
    isPassMark: isPassMark,
    meterPassed: meterPassed,
    splitRaces: splitRaces,
    playPicks: playPicks,
    noteQuote: noteQuote,
    history: history,
    resetHistory: resetHistory,
    meter: meter,
    stageNote: stageNote,
    rowHtml: rowHtml,
    rowsHtml: rowsHtml,
    listHtml: listHtml,
    renderMeterBlock: renderMeterBlock,
    esc: esc
  };
});
