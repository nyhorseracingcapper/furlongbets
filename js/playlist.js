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

  function plainGap(value) {
    if (value == null || value === false || value === '') return '';
    if (typeof value === 'number' && isFinite(value)) return 'Gap ' + String(Math.round(value * 100) / 100);
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
      return plainGap(value.label || value.text || value.name || value.tag || value.gap || value.pattern_gap);
    }
    return '';
  }

  function patternChip(horse, race) {
    var gap = horse && horse.v25_pattern_gap;
    var gapMin = horse && horse.v25_pattern_gap_min;
    var raceGap = race && race.v25_info && race.v25_info.pattern_gap;
    var text = '';
    if (gap === true) text = 'Pattern gap';
    else if (gap != null && gap !== false && gap !== '') text = plainGap(gap);
    else if (raceGap != null && raceGap !== false && raceGap !== '') text = plainGap(raceGap);
    if (!text && (gapMin == null || gapMin === '')) return '';
    if (!text) text = 'Pattern gap';
    if (gapMin != null && gapMin !== '') {
      var extra = (typeof gapMin === 'number' && isFinite(gapMin)) ? String(Math.round(gapMin * 100) / 100) : plainGap(gapMin);
      if (extra) text += ' · ' + extra;
    }
    return text;
  }

  function describePick(h, race, includeRaceGap) {
    var p = modelProb(h);
    var minD = minDecimal(p);
    var ml = h.ml_dec != null && isFinite(Number(h.ml_dec)) ? Number(h.ml_dec) : null;
    return {
      pgm: String(h.pgm),
      name: h.horse || h.name || '',
      p: p,
      fairDecimal: fairDecimal(p),
      minDecimal: minD,
      minText: minD == null ? '' : oddsTo1(minD),
      mlText: ml == null ? '' : oddsTo1(ml),
      gapText: patternChip(h, includeRaceGap ? race : null),
      explicit: false,
      role: 'primary'
    };
  }

  function isDesignatedPick(h) {
    if (!h) return false;
    if (h.is_value_alt || h.pick === true || h.v25_pick === true) return true;
    var role = h.role != null ? String(h.role).toLowerCase() : '';
    return role === 'primary' || role === 'secondary' || role === 'pick';
  }

  /* Top pick, plus a second horse only when the card marks that horse as a pick. */
  function playPicks(race) {
    var chosen = [];
    function add(h, explicit) {
      if (!h || h.scr) return;
      var pgm = String(h.pgm);
      if (chosen.some(function (c) { return c.pgm === pgm; })) return;
      if (chosen.length >= 2) return;
      var row = describePick(h, race, chosen.length === 0);
      row.explicit = !!explicit;
      chosen.push(row);
    }
    var list = race && (race.picks || race.play_picks);
    if (Array.isArray(list)) list.slice(0, 2).forEach(function (item) { add(findHorse(race, item), true); });
    if (race && race.pick != null && race.pick !== '') add(findHorse(race, race.pick), true);
    ((race && race.horses) || []).forEach(function (h) { if (isDesignatedPick(h)) add(h, true); });
    if (!chosen.length) {
      var top = ranked(race)[0];
      if (top) add(top, false);
    }
    if (chosen[1] && !chosen[1].explicit) chosen.pop();
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

  var FEED_DOWN_BANNER = 'Live odds feed not running. Open TwinSpires in the feed browser to start it.';

  function parsePostSeconds(post) {
    if (!post) return null;
    var m = String(post).toUpperCase().match(/(\d{1,2}):(\d{2})\s*([AP]M)?/);
    if (!m) return null;
    var hh = (+m[1]) % 12;
    if (m[3] === 'PM') hh += 12;
    return hh * 3600 + (+m[2]) * 60;
  }

  function countdownText(sec, finished) {
    if (finished) return 'off';
    if (sec == null || !isFinite(Number(sec))) return '';
    if (Number(sec) <= 0) return 'now';
    return 'in ' + Math.ceil(Number(sec) / 60) + 'm';
  }

  function clockHms(ms) {
    if (ms == null || !isFinite(Number(ms))) return '';
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(new Date(Number(ms)));
    var g = {};
    parts.forEach(function (p) { if (p.type !== 'literal') g[p.type] = p.value; });
    var hour = String(g.hour || '00');
    if (hour === '24') hour = '00';
    return hour + ':' + (g.minute || '00') + ':' + (g.second || '00');
  }

  function statusFace(meter, feedDown) {
    if (feedDown) return { tone: 'quiet', word: '' };
    if (!meter || meter.tone === 'none' || meter.tone === 'quiet') return { tone: 'none', word: 'No odds' };
    if (meter.tone === 'green') return { tone: 'green', word: 'Bet' };
    if (meter.tone === 'yellow') return { tone: 'yellow', word: 'Close' };
    return { tone: 'red', word: 'Pass' };
  }

  function bestFace(faces) {
    var rank = { green: 3, yellow: 2, red: 1, none: 0, quiet: 0 };
    var best = { tone: 'quiet', word: '' };
    (faces || []).forEach(function (face) {
      if (!face) return;
      if ((rank[face.tone] || 0) >= (rank[best.tone] || 0)) best = face;
    });
    return best;
  }

  function rowHasLive(picks) {
    return (picks || []).some(function (pk) {
      return pk && pk.meter && pk.meter.tone !== 'none' && pk.meter.price;
    });
  }

  function shortBadge(text) {
    var t = String(text == null ? '' : text).trim();
    if (!t) return 'PLAY';
    if (/^BET\b/i.test(t)) return 'BET';
    if (/^WATCH/i.test(t)) return 'WATCH';
    if (/^PLAY/i.test(t)) return 'PLAY';
    if (/^CLOSED|^OFF\b/i.test(t)) return 'OFF';
    return t.length > 14 ? t.slice(0, 14) : t;
  }

  function applyView(rows, opts) {
    opts = opts || {};
    var list = (rows || []).slice();
    list.sort(function (a, b) {
      var af = a.finished ? 1 : 0;
      var bf = b.finished ? 1 : 0;
      if (af !== bf) return af - bf;
      var as = a.postSec == null ? 1e9 : a.postSec;
      var bs = b.postSec == null ? 1e9 : b.postSec;
      if (as !== bs) return as - bs;
      return String(a.race).localeCompare(String(b.race), undefined, { numeric: true });
    });
    if (!opts.showFinished) list = list.filter(function (r) { return !r.finished; });
    if (opts.track && opts.track !== 'all') list = list.filter(function (r) { return r.trk === opts.track; });
    if (opts.filter === 'bet') list = list.filter(function (r) { return r.tone === 'green'; });
    if (opts.filter === 'live') list = list.filter(function (r) { return r.hasLive; });
    var marked = false;
    return list.map(function (r) {
      var copy = {};
      Object.keys(r).forEach(function (k) { copy[k] = r[k]; });
      copy.next = false;
      if (!marked && !copy.finished) { copy.next = true; marked = true; }
      return copy;
    });
  }

  function helpHtml() {
    return '<details class="pl-help"><summary class="pl-info">i</summary>'
      + '<p>Bet means the live price is at or above the minimum. Close means it is just under the minimum. '
      + 'Pass means the price is further under, the race was passed, or the price collapsed. '
      + 'No odds means the quote is missing or stale. A missing price is not a scratch. '
      + 'The minimum is the model fair price with a margin, shown as odds-to-1. Tap a race for the full card.</p>'
      + '</details>';
  }

  function legendLineHtml() {
    return '<div class="pl-key" aria-label="Status key">'
      + '<span><i class="pl-dot green"></i>Bet</span>'
      + '<span><i class="pl-dot yellow"></i>Close</span>'
      + '<span><i class="pl-dot red"></i>Pass</span>'
      + '<span><i class="pl-dot none"></i>No odds</span>'
      + helpHtml()
      + '</div>';
  }

  function chip(label, attrs, on) {
    return '<button type="button" class="pl-chip' + (on ? ' on' : '') + '" ' + attrs + '>' + esc(label) + '</button>';
  }

  function pickLine(pk) {
    var gap = pk.gapText ? '<span class="pl-gap">' + esc(pk.gapText) + '</span>' : '';
    return '<span class="pl-pick"><b>#' + esc(pk.pgm) + ' ' + esc(pk.name || '') + '</b>'
      + '<small>min ' + esc(pk.minText || '—') + '</small>' + gap
      + '<b class="pl-live" data-live="' + esc(pk.pgm) + '">' + (pk.liveText ? ('live ' + esc(pk.liveText)) : '') + '</b></span>';
  }

  function rowHtmlCompact(row) {
    var picks = row.picks || [];
    var when = [row.post || '', row.when || ''].filter(Boolean).join(' · ');
    return '<button type="button" class="pl-row pl-' + esc(row.tone || 'quiet') + (row.next ? ' pl-next' : '') + (row.finished ? ' pl-done' : '') + '"'
      + ' data-open="1" data-trk="' + esc(row.trk) + '" data-race="' + esc(row.race) + '" data-plrk="' + esc(row.key || '') + '">'
      + '<span class="pl-bar" data-bar aria-hidden="true"></span>'
      + '<span class="pl-id"><b>' + esc(row.trk) + ' R' + esc(row.race) + '</b>'
      + (row.next ? '<span class="pl-nexttag">Next</span>' : '')
      + '<small data-cd>' + esc(when) + '</small></span>'
      + '<span class="pl-pill">' + esc(row.badge || 'PLAY') + '</span>'
      + '<span class="pl-picks">' + picks.map(pickLine).join('') + '</span>'
      + '<span class="pl-stat" data-stat><i class="pl-big" aria-hidden="true"></i><b data-word>' + esc(row.word || '') + '</b></span>'
      + '</button>';
  }

  function raceRow(input) {
    input = input || {};
    var feedDown = !!input.feedDown;
    var picks = input.picks || [];
    var faces = picks.map(function (pk) { return statusFace(pk.meter, feedDown); });
    var best = bestFace(faces.length ? faces : [statusFace(null, feedDown)]);
    var postSec = input.postSec != null ? input.postSec : parsePostSeconds(input.post);
    var sec = (postSec != null && input.nowSec != null) ? (postSec - input.nowSec) : input.sec;
    return {
      key: input.key || (String(input.trk) + '|' + String(input.race)),
      trk: input.trk,
      race: String(input.race),
      post: input.post || '',
      postSec: postSec,
      finished: !!input.finished,
      when: countdownText(sec, !!input.finished),
      badge: shortBadge(input.badge),
      tone: best.tone,
      word: best.word,
      hasLive: !feedDown && rowHasLive(picks),
      picks: picks.map(function (pk) {
        return {
          pgm: pk.pgm,
          name: pk.name,
          minText: pk.minText,
          gapText: pk.gapText || '',
          liveText: feedDown ? '' : ((pk.meter && pk.meter.price) || ''),
          role: pk.role
        };
      })
    };
  }

  function boardHtml(model) {
    model = model || {};
    var rows = model.rows || [];
    var parts = ['<div class="pl-board">', legendLineHtml()];
    parts.push('<div class="pl-livebar"><span class="pl-pulse' + (model.feedDown ? ' pl-pulse-off' : '') + '" data-beat="' + esc(model.beat || 0) + '"></span>'
      + '<span data-last>Last odds update ' + esc(model.lastUpdate || '—') + '</span>'
      + '<span class="pl-auto">Auto-refresh</span></div>');
    if (model.feedDown) parts.push('<p class="pl-banner">' + esc(FEED_DOWN_BANNER) + '</p>');
    parts.push('<div class="pl-chips">');
    parts.push(chip('All', 'data-plfilter="all"', model.filter !== 'bet' && model.filter !== 'live'));
    parts.push(chip('Bet only', 'data-plfilter="bet"', model.filter === 'bet'));
    parts.push(chip('Has live odds', 'data-plfilter="live"', model.filter === 'live'));
    parts.push(chip('All tracks', 'data-pltrack="all"', !model.track || model.track === 'all'));
    (model.tracks || []).forEach(function (trk) {
      parts.push(chip(trk, 'data-pltrack="' + esc(trk) + '"', model.track === trk));
    });
    var doneLabel = (model.showFinished ? 'Hide finished' : 'Show finished') + ' (' + (model.finishedCount || 0) + ')';
    parts.push(chip(doneLabel, 'data-pldone="1"', !!model.showFinished));
    parts.push('</div>');
    if (model.hiddenCount) parts.push('<p class="pl-count">' + model.hiddenCount + ' passed, on the full card.</p>');
    if (!rows.length) parts.push('<p class="pl-empty">No races in this view.</p>');
    parts.push('<div class="pl-rows">');
    rows.forEach(function (row) { parts.push(rowHtmlCompact(row)); });
    parts.push('</div></div>');
    return parts.join('');
  }

  function patchBoard(host, model) {
    if (!host || !model) return;
    var last = host.querySelector('[data-last]');
    var text = 'Last odds update ' + (model.lastUpdate || '—');
    if (last && last.textContent !== text) last.textContent = text;
    var pulse = host.querySelector('.pl-pulse');
    if (pulse) {
      pulse.classList.toggle('pl-pulse-off', !!model.feedDown);
      if (String(pulse.getAttribute('data-beat')) !== String(model.beat || 0)) {
        pulse.setAttribute('data-beat', String(model.beat || 0));
        pulse.classList.remove('pl-ping');
        void pulse.offsetWidth;
        pulse.classList.add('pl-ping');
      }
    }
    (model.rows || []).forEach(function (row) {
      var el = host.querySelector('.pl-row[data-plrk="' + row.key + '"]');
      if (!el) return;
      var when = [row.post || '', row.when || ''].filter(Boolean).join(' · ');
      var cd = el.querySelector('[data-cd]');
      if (cd && cd.textContent !== when) cd.textContent = when;
      var word = el.querySelector('[data-word]');
      if (word && word.textContent !== (row.word || '')) word.textContent = row.word || '';
      (row.picks || []).forEach(function (pk) {
        var live = el.querySelector('[data-live="' + pk.pgm + '"]');
        var next = pk.liveText ? ('live ' + pk.liveText) : '';
        if (live && live.textContent !== next) live.textContent = next;
      });
      el.classList.toggle('pl-next', !!row.next);
      el.classList.toggle('pl-done', !!row.finished);
      ['green', 'yellow', 'red', 'none', 'quiet'].forEach(function (tone) {
        el.classList.toggle('pl-' + tone, row.tone === tone);
      });
    });
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
    FEED_DOWN_BANNER: FEED_DOWN_BANNER,
    parsePostSeconds: parsePostSeconds,
    countdownText: countdownText,
    clockHms: clockHms,
    statusFace: statusFace,
    patternChip: patternChip,
    raceRow: raceRow,
    applyView: applyView,
    boardHtml: boardHtml,
    patchBoard: patchBoard,
    esc: esc
  };
});
