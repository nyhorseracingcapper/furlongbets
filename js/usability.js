/* FURLONG usability t438.
   Presentation geometry only (three projected-order ovals).
   Does not certify a model, a forecast, or live-card health. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.FU = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RELEASE = {
    version: 't438-usability-5',
    quoteFreshS: 30,
    statusFreshS: 150,
    pollMs: 3000,
    dataNote: 'Encrypted card payload is unchanged in this release and ships in the same static revision as this asset.',
    rollback: [
      'Do not merge or deploy until visual signoff and the source/model gates pass.',
      'This release does not change member auth, the encrypted card bytes, poll intervals (3s), the 30s quote window, or the 150s status window.',
      'To undo before release: close the pull request without merging.',
      'To undo after a merge: revert that commit and redeploy the previous static files. js/usability.js, css/usability.css, and index.html move together; there is no database migration and no flag to flip.',
      'Reverting restores the previous renderer, including its scratch inference and verdict-refresh timing.'
    ]
  };

  var COLORS = {
    text: '#e7eef6',
    textMuted: '#c5d4e6',
    panel: '#111a28',
    panel2: '#0d1522',
    ink: '#1a1200',
    white: '#ffffff',
    gold: '#e8c15a',
    green: '#7fe0a0',
    tan: '#c9b48a',
    blue: '#7aa2c0',
    gray: '#5f7280',
    trackNeutral: '#243044',
    turf: '#24402c',
    dirt: '#3a2b22',
    synth: '#2a3340',
    infield: '#0f141b'
  };

  var STAGES = [
    { key: '1ST CALL', spoken: 'First call', aliases: ['first', '1', 'call1', 'first_call', 'c1'] },
    { key: '2ND CALL', spoken: 'Second call', aliases: ['second', '2', 'call2', 'second_call', 'c2'] },
    { key: 'FINISH', spoken: 'Finish', aliases: ['finish', 'final', '3', 'finish_order'] }
  ];

  var ANCHORS = {
    '1ST CALL': { x: 210, y: 69 },
    '2ND CALL': { x: 300, y: 181 },
    'FINISH': { x: 300, y: 181 }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function lin(c) {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function lum(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }
  function contrast(a, b) {
    var L1 = lum(a), L2 = lum(b);
    var hi = Math.max(L1, L2), lo = Math.min(L1, L2);
    return (hi + 0.05) / (lo + 0.05);
  }

  function formatEt(ms) {
    var d = new Date(ms);
    if (!isFinite(d.getTime())) return 'time unknown';
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    }).formatToParts(d);
    var g = {};
    parts.forEach(function (p) { if (p.type !== 'literal') g[p.type] = p.value; });
    return g.month + ' ' + g.day + ', ' + g.year + ', ' + g.hour + ':' + g.minute + ':' + g.second + ' ' + g.dayPeriod + ' ET';
  }

  function etDateKey(ms) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(ms));
    var g = {};
    parts.forEach(function (p) { g[p.type] = p.value; });
    return g.year + '-' + g.month + '-' + g.day;
  }

  var MONTH_DAYS = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function pad2(n) { return String(n).padStart(2, '0'); }

  function isRealYmd(year, month, day) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return false;
    if (month < 1 || month > 12 || day < 1) return false;
    var dt = new Date(Date.UTC(year, month - 1, day));
    return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
  }

  function feedRaceDate(raw) {
    var s = raw == null ? '' : String(raw).trim();
    if (!/^\d{4}$/.test(s)) return { ok: false, feedKey: null, query: null, reason: 'feed date must be MMDD' };
    var month = Number(s.slice(0, 2));
    var day = Number(s.slice(2, 4));
    if (month < 1 || month > 12 || day < 1 || day > MONTH_DAYS[month]) {
      return { ok: false, feedKey: null, query: null, reason: 'feed date is not a real month and day' };
    }
    return { ok: true, feedKey: s, query: 'race_date=eq.' + s, month: month, day: day, reason: '' };
  }

  function etStamp(ms) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(ms));
    var g = {};
    parts.forEach(function (p) { if (p.type !== 'literal') g[p.type] = p.value; });
    return {
      year: Number(g.year),
      month: Number(g.month),
      day: Number(g.day),
      iso: g.year + '-' + g.month + '-' + g.day,
      mmdd: g.month + g.day,
      clock: g.hour + ':' + g.minute + ':' + g.second
    };
  }

  function parseCapture(raw) {
    if (raw == null || raw === '') return { ok: false, reason: 'missing' };
    var s = String(raw).trim();
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(s)) return { ok: false, reason: 'capture time needs an explicit offset' };
    var ms = Date.parse(s);
    if (!isFinite(ms)) return { ok: false, reason: 'capture time is not a timestamp' };
    var et = etStamp(ms);
    return { ok: true, ms: ms, et: et, reason: '' };
  }

  function cardDateState(input, now) {
    var card = (input && typeof input === 'object') ? input : { mmdd: input };
    var today = etStamp(now);
    var raw = card.mmdd == null ? '' : String(card.mmdd);
    var feed = feedRaceDate(card.mmdd);
    var base = { feedKey: feed.feedKey, query: feed.query, today: today.iso, todayMmdd: today.mmdd, raw: raw, calendar: null, capture: null };
    if (!feed.ok) {
      return Object.assign(base, { state: 'invalid', key: null, label: 'card date invalid', reason: feed.reason });
    }
    var year = null;
    var yearSource = null;
    if (card.card_year != null && card.card_year !== '') {
      year = Number(card.card_year);
      if (!Number.isInteger(year)) {
        return Object.assign(base, { state: 'invalid', key: null, label: 'card date invalid', reason: 'card_year is not an integer' });
      }
      yearSource = 'card_year';
    }
    if (card.source_captured_at != null && card.source_captured_at !== '') {
      var cap = parseCapture(card.source_captured_at);
      if (!cap.ok) return Object.assign(base, { state: 'invalid', key: null, label: 'card date invalid', reason: cap.reason });
      if (cap.et.mmdd !== feed.feedKey) {
        return Object.assign(base, { state: 'invalid', key: null, label: 'card date invalid', reason: 'source capture is not the feed date' });
      }
      if (year != null && cap.et.year !== year) {
        return Object.assign(base, { state: 'invalid', key: null, label: 'card date invalid', reason: 'card_year does not match the source capture' });
      }
      year = cap.et.year;
      yearSource = yearSource ? 'card_year+source_captured_at' : 'source_captured_at';
      base.capture = cap.et.iso + ' ' + cap.et.clock + ' ET';
    }
    if (year == null) {
      return Object.assign(base, {
        state: 'feed-only',
        key: null,
        label: 'feed ' + feed.feedKey,
        reason: 'calendar year is not in this card'
      });
    }
    if (!isRealYmd(year, feed.month, feed.day)) {
      return Object.assign(base, { state: 'invalid', key: null, label: 'card date invalid', reason: 'month, day, and year are not a real calendar day' });
    }
    var iso = year + '-' + pad2(feed.month) + '-' + pad2(feed.day);
    base.calendar = iso;
    base.key = iso;
    base.yearSource = yearSource;
    var label = iso + ' · feed ' + feed.feedKey;
    if (base.capture) label += ' · captured ' + base.capture;
    if (iso === today.iso) return Object.assign(base, { state: 'same-day', label: label, reason: '' });
    return Object.assign(base, { state: 'historical', label: label, reason: 'explicit calendar day is not this Eastern day' });
  }

  function quoteActionable(ageSec) {
    return timeState(ageSec, RELEASE.quoteFreshS) === 'current';
  }

  function timeState(age, freshLimit) {
    if (age == null || !isFinite(Number(age))) return 'unknown';
    var a = Number(age);
    if (a < 0) return 'future';
    if (a <= freshLimit) return 'current';
    return 'stale';
  }

  function quoteAge(q, now) {
    if (!q) return null;
    if (q.age != null && isFinite(Number(q.age))) return Number(q.age);
    if (q.ts != null && now != null && isFinite(Number(q.ts))) return (Number(now) - Number(q.ts)) / 1000;
    return null;
  }

  function classifyRunners(horses, quotes, now) {
    var rows = [];
    var confirmed = [];
    (horses || []).forEach(function (h) {
      var pgm = String(h.pgm);
      var q = quotes ? quotes[pgm] : null;
      var age = quoteAge(q, now);
      var qState = q ? timeState(age, RELEASE.quoteFreshS) : 'unknown';
      var kind, label, source;
      if (h.scr) {
        kind = 'confirmed';
        source = 'card roster';
        var stamp = h.scr_ts || h.scratched_at || null;
        label = 'Confirmed scratch · card roster · ' + (stamp ? formatEt(stamp) : 'time unknown');
      } else if (q && (q.scratch === true || q.scratched === true)) {
        source = 'feed scratch flag';
        if (qState === 'current') {
          kind = 'confirmed';
          label = 'Confirmed scratch · fresh feed scratch flag · ' + (q.ts != null ? formatEt(q.ts) : 'time unknown');
        } else {
          kind = 'unconfirmed';
          label = 'Feed scratch flag is ' + qState + ' · not a confirmed scratch';
        }
      } else if (q && q.dec != null && isFinite(Number(q.dec)) && Number(q.dec) <= 0) {
        kind = 'unconfirmed';
        source = 'tote quote without a scratch flag';
        label = 'Tote quote is at or below 0. This feed has no scratch flag, so it is not a confirmed scratch.';
      } else if (!q || q.dec == null || !isFinite(Number(q.dec))) {
        kind = 'unknown-quote';
        source = 'no quote';
        label = 'Quote missing · not a confirmed scratch';
      } else if (qState === 'stale') {
        kind = 'priced-stale';
        source = 'stale quote';
        label = 'Stale quote ' + Math.round(age) + 's · not a confirmed scratch';
      } else if (qState === 'future') {
        kind = 'priced-future';
        source = 'future quote';
        label = 'Quote timestamp is in the future · not current · not a confirmed scratch';
      } else if (qState === 'current') {
        kind = 'priced';
        source = 'fresh quote';
        label = 'Quote current · ' + Math.round(age) + 's old';
      } else {
        kind = 'unknown-quote';
        source = 'unknown quote';
        label = 'Quote state unknown · not a confirmed scratch';
      }
      var row = { pgm: pgm, horse: h, kind: kind, label: label, source: source, quoteState: q ? qState : 'unknown', age: q ? age : null, dec: q && q.dec != null ? Number(q.dec) : null };
      rows.push(row);
      if (kind === 'confirmed') confirmed.push(row);
    });
    var byPgm = {};
    rows.forEach(function (r) { byPgm[r.pgm] = r; });
    return { rows: rows, confirmed: confirmed, byPgm: byPgm };
  }

  function engineRaw(h) {
    if (h.p_raw != null && isFinite(Number(h.p_raw))) return Number(h.p_raw);
    return (Number(h.win) || 0) / 100;
  }

  function displayRaw(h) {
    if (h.p_raw != null && isFinite(Number(h.p_raw))) return Number(h.p_raw);
    if (h.win != null && h.win !== '' && isFinite(Number(h.win))) return Number(h.win) / 100;
    return null;
  }

  function adjustedProbs(horses, confirmedPgms) {
    var scr = {};
    (confirmedPgms || []).forEach(function (p) { scr[String(p)] = true; });
    var active = [];
    var dropped = [];
    (horses || []).forEach(function (h) {
      if (scr[String(h.pgm)]) dropped.push(String(h.pgm));
      else active.push({ pgm: String(h.pgm), raw: engineRaw(h) });
    });
    var sumRaw = active.reduce(function (s, x) { return s + (isFinite(x.raw) ? x.raw : 0); }, 0);
    var out = active.map(function (x) {
      return { pgm: x.pgm, raw: x.raw, p: sumRaw > 0 ? x.raw / sumRaw : 0 };
    });
    var sumP = out.reduce(function (s, x) { return s + x.p; }, 0);
    return { active: out, sumRaw: sumRaw, sumP: sumP, dropped: dropped };
  }

  function coverage(rows) {
    var c = { current: 0, stale: 0, future: 0, unknown: 0, confirmed: 0, total: rows.length };
    rows.forEach(function (r) {
      if (r.kind === 'confirmed') c.confirmed += 1;
      else if (r.quoteState === 'current') c.current += 1;
      else if (r.quoteState === 'stale') c.stale += 1;
      else if (r.quoteState === 'future') c.future += 1;
      else c.unknown += 1;
    });
    return c;
  }

  function cloneFeed(feed) {
    function slot(s) {
      s = s || {};
      return { okAt: s.okAt == null ? null : s.okAt, failAt: s.failAt == null ? null : s.failAt, failing: !!s.failing, seen: !!s.seen, lastError: s.lastError || null };
    }
    feed = feed || {};
    return { quote: slot(feed.quote), status: slot(feed.status) };
  }

  function feedReduce(feed, event, now) {
    var f = cloneFeed(feed);
    var slot = f[event.channel];
    if (!slot) return f;
    if (event.type === 'success') {
      slot.failing = false;
      slot.okAt = now;
      slot.seen = true;
      slot.lastError = null;
    } else if (event.type === 'fail') {
      slot.failing = true;
      slot.failAt = now;
      slot.lastError = event.error || 'fetch failed';
    }
    return f;
  }

  function channelHealth(slot) {
    if (!slot || (!slot.seen && !slot.failing)) return 'unknown';
    if (slot.failing) return 'disconnected';
    if (slot.okAt == null) return 'unknown';
    return 'connected';
  }

  function actionGate(flags) {
    flags = flags || {};
    if (flags.dateState === 'historical') return { allowed: false, reason: 'historical card date in America/New_York' };
    if (flags.dateState === 'invalid' || flags.dateState === 'unknown') return { allowed: false, reason: 'card date invalid' };
    if (flags.dateState !== 'same-day' && flags.dateState !== 'feed-only' && flags.dateState !== 'today') return { allowed: false, reason: 'card date unknown' };
    if (flags.quoteState === 'future') return { allowed: false, reason: 'quote timestamp in the future' };
    if (flags.quoteState === 'stale') return { allowed: false, reason: 'quote older than 30s' };
    if (flags.quoteState !== 'current') return { allowed: false, reason: 'quote missing or unknown' };
    if (flags.statusState === 'future') return { allowed: false, reason: 'status timestamp in the future' };
    if (flags.statusState === 'stale') return { allowed: false, reason: 'status older than 150s' };
    if (flags.statusState !== 'current') return { allowed: false, reason: 'status missing or unknown' };
    if (!flags.wageringLive) return { allowed: false, reason: 'status is not a live wagering state' };
    return { allowed: true, reason: '' };
  }

  function applyActionGate(verdict, gate) {
    if (!verdict || verdict.grp !== 'bet' || !gate || gate.allowed) return verdict;
    var lines = ['Action suspended: ' + gate.reason + '. Last good numbers stay visible and are not a bet.'].concat(verdict.lines || []);
    var copy = {};
    Object.keys(verdict).forEach(function (k) { copy[k] = verdict[k]; });
    copy.grp = 'watch';
    copy.cls = 'watch';
    copy.code = 'SUSPENDED';
    copy.stake = 0;
    copy.badge = 'ACTION SUSPENDED · ' + gate.reason;
    copy.lines = lines;
    copy.suspended = true;
    return copy;
  }

  function surfacePaint(raw) {
    var s = String(raw || '');
    if (/off[\s-]*turf/i.test(s)) return { fill: COLORS.trackNeutral, known: false, name: 'unverified' };
    if (/turf/i.test(s)) return { fill: COLORS.turf, known: true, name: 'Turf' };
    if (/synth|tapeta|all[- ]weather/i.test(s)) return { fill: COLORS.synth, known: true, name: 'Synth' };
    if (/\bdirt\b/i.test(s)) return { fill: COLORS.dirt, known: true, name: 'Dirt' };
    return { fill: COLORS.trackNeutral, known: false, name: 'unverified' };
  }

  function surfaceView(race, dateState) {
    var raw = race && race.surf ? String(race.surf) : '';
    var paint = surfacePaint(raw);
    var verification, label;
    if (!raw) {
      verification = 'unknown';
      label = 'Surface unknown. Nothing on the card header, and this page has no live surface feed.';
    } else if (/off[\s-]*turf/i.test(raw)) {
      verification = 'unknown';
      label = 'Card header says "' + raw + '". That is not a certified live surface. Verification unknown.';
    } else if (dateState === 'historical') {
      verification = 'stale';
      label = 'Card surface ' + raw + '. Historical card, not a live surface update. Verification stale.';
    } else {
      verification = 'unknown';
      label = 'Card surface ' + raw + '. Not a live surface feed. Verification unknown.';
    }
    return { raw: raw, paint: paint, verification: verification, label: label, liveFeed: false };
  }

  function pickList(bag, aliases) {
    if (!bag || typeof bag !== 'object') return null;
    for (var i = 0; i < aliases.length; i++) {
      if (Object.prototype.hasOwnProperty.call(bag, aliases[i]) && bag[aliases[i]] != null) return bag[aliases[i]];
    }
    return null;
  }

  function asOrder(list) {
    if (!Array.isArray(list)) return null;
    return list.map(function (x) { return String(x); });
  }

  function checkOrder(pgms, list) {
    if (!pgms.length) return { ok: false, reason: 'no starters' };
    if (!list) return { ok: false, reason: 'no stage field on this race' };
    if (list.length !== pgms.length) return { ok: false, reason: 'stage list does not include every starter' };
    var seen = {};
    for (var i = 0; i < list.length; i++) {
      if (seen[list[i]]) return { ok: false, reason: 'duplicate program in the stage list' };
      seen[list[i]] = true;
    }
    for (var j = 0; j < pgms.length; j++) {
      if (!seen[pgms[j]]) return { ok: false, reason: 'a starter is missing from the stage list' };
    }
    return { ok: true, order: list, reason: '' };
  }

  function ranksToOrder(pgms, rankByPgm) {
    var pairs = [];
    var i;
    for (i = 0; i < pgms.length; i++) {
      var v = rankByPgm[pgms[i]];
      if (v == null || !isFinite(Number(v))) return { ok: false, reason: 'a starter has no stage rank' };
      pairs.push({ pgm: pgms[i], rank: Number(v) });
    }
    var used = {};
    for (i = 0; i < pairs.length; i++) {
      if (pairs[i].rank < 1 || Math.round(pairs[i].rank) !== pairs[i].rank) return { ok: false, reason: 'stage rank is not a positive integer' };
      if (used[pairs[i].rank]) return { ok: false, reason: 'duplicate stage rank' };
      used[pairs[i].rank] = true;
    }
    for (i = 1; i <= pgms.length; i++) if (!used[i]) return { ok: false, reason: 'stage ranks are not a complete order' };
    pairs.sort(function (a, b) { return a.rank - b.rank; });
    return { ok: true, order: pairs.map(function (p) { return p.pgm; }), reason: '' };
  }

  function stageModel(race) {
    var horses = (race && race.horses) || [];
    var pgms = horses.map(function (h) { return String(h.pgm); });
    var bag = race && (race.stage_orders || race.stages || race.projected_stages || null);
    var anyBag = false;
    var anyHorse = false;
    var horseRanks = { '1ST CALL': {}, '2ND CALL': {}, 'FINISH': {} };
    horses.forEach(function (h) {
      var pgm = String(h.pgm);
      var pos = h.stage_pos || null;
      var calls = h.calls;
      function take(stageKey, value) {
        if (value == null || value === '') return;
        anyHorse = true;
        horseRanks[stageKey][pgm] = value;
      }
      if (pos && typeof pos === 'object') {
        take('1ST CALL', pos.first != null ? pos.first : pos.call1);
        take('2ND CALL', pos.second != null ? pos.second : pos.call2);
        take('FINISH', pos.finish);
      }
      if (Array.isArray(calls) && calls.length) {
        take('1ST CALL', calls[0]);
        take('2ND CALL', calls[1]);
        take('FINISH', calls[2]);
      } else if (calls && typeof calls === 'object') {
        take('1ST CALL', calls.first);
        take('2ND CALL', calls.second);
        take('FINISH', calls.finish);
      }
      take('1ST CALL', h.call1);
      take('2ND CALL', h.call2);
      take('FINISH', h.finish_pos != null ? h.finish_pos : null);
    });
    if (bag && typeof bag === 'object') {
      STAGES.forEach(function (st) { if (pickList(bag, st.aliases) != null) anyBag = true; });
    }
    var stages = STAGES.map(function (st) {
      var result;
      if (anyBag) {
        result = checkOrder(pgms, asOrder(pickList(bag, st.aliases)));
      } else if (anyHorse) {
        result = ranksToOrder(pgms, horseRanks[st.key]);
      } else {
        result = { ok: false, reason: 'source has no stage positions', order: null };
      }
      return {
        key: st.key,
        spoken: st.spoken,
        ok: !!result.ok,
        order: result.ok ? result.order : null,
        reason: result.ok ? '' : result.reason
      };
    });
    return {
      stages: stages,
      supported: anyBag || anyHorse,
      failClosed: stages.every(function (s) { return !s.ok; })
    };
  }

  function pointBehind(stage, index) {
    var a = ANCHORS[stage];
    if (!a) return null;
    return walkBackward(a.x, a.y, index * 26);
  }

  function walkBackward(ax, ay, dist) {
    var X0 = 125, X1 = 305, CY = 125, R = 56;
    var x = ax, y = ay, rem = dist, guard = 0;
    function onTop() { return Math.abs(y - 69) < 0.2 && x >= X0 - 0.1 && x <= X1 + 0.1; }
    function onBot() { return Math.abs(y - 181) < 0.2 && x >= X0 - 0.1 && x <= X1 + 0.1; }
    while (rem > 1e-9 && guard < 20) {
      guard += 1;
      var cap = null;
      if (onTop() && x < X1 - 1e-6) {
        var step = Math.min(X1 - x, rem);
        x += step; rem -= step;
        if (rem <= 1e-9) break;
        cap = 'right';
      } else if (onBot() && x > X0 + 1e-6) {
        var stepB = Math.min(x - X0, rem);
        x -= stepB; rem -= stepB;
        if (rem <= 1e-9) break;
        cap = 'left';
      }
      if (rem <= 1e-9) break;
      var rightish = Math.abs(Math.hypot(x - X1, y - CY) - R) < 0.8 && x >= X1 - 0.2;
      var leftish = Math.abs(Math.hypot(x - X0, y - CY) - R) < 0.8 && x <= X0 + 0.2;
      if (cap === 'right' || rightish) {
        var theta = Math.atan2(y - CY, x - X1);
        if (theta < -Math.PI / 2) theta += Math.PI * 2;
        var end = Math.PI / 2;
        var room = R * (end - theta);
        var stepR = Math.min(room, rem);
        theta += stepR / R;
        x = X1 + R * Math.cos(theta);
        y = CY + R * Math.sin(theta);
        rem -= stepR;
        if (rem <= 1e-9) break;
        x = X1; y = 181;
        continue;
      }
      if (cap === 'left' || leftish) {
        var thetaL = Math.atan2(y - CY, x - X0);
        if (thetaL < 0) thetaL += Math.PI * 2;
        var endL = Math.PI * 1.5;
        var roomL = R * (endL - thetaL);
        var stepL = Math.min(roomL, rem);
        thetaL += stepL / R;
        x = X0 + R * Math.cos(thetaL);
        y = CY + R * Math.sin(thetaL);
        rem -= stepL;
        if (rem <= 1e-9) break;
        x = X0; y = 69;
        continue;
      }
      break;
    }
    return { x: x, y: y };
  }

  function rankVisual(stage, rank) {
    if (rank === 1) return { fill: COLORS.gold, text: COLORS.ink, r: 11 };
    if (rank === 2 && stage === 'FINISH') return { fill: COLORS.gold, text: COLORS.ink, r: 9.5 };
    if (rank === 2) return { fill: COLORS.green, text: COLORS.ink, r: 9.5 };
    if (rank === 3) return { fill: COLORS.tan, text: COLORS.ink, r: 9.5 };
    if (rank === 4) return { fill: COLORS.blue, text: COLORS.ink, r: 9.5 };
    return { fill: COLORS.gray, text: COLORS.white, r: 9.5 };
  }

  function rosterKey(trk, race, pgm) {
    return String(trk) + '|' + String(race) + '|' + String(pgm);
  }

  function raceRoster(races, trk, race) {
    var found = (races || []).filter(function (r) { return r && r.trk === trk && String(r.race) === String(race); });
    if (found.length !== 1) return { ok: false, horses: [] };
    return {
      ok: true,
      key: String(trk) + '|' + String(race),
      horses: found[0].horses.map(function (h) {
        return { pgm: String(h.pgm), horse: h.horse || h.name || '', quoteKey: rosterKey(trk, race, h.pgm) };
      })
    };
  }

  function statusRead(input) {
    input = input || {};
    if (!input.hasRow) return { kind: 'absent', closed: false, reason: 'no status row' };
    var ageState = timeState(input.ageSec, RELEASE.statusFreshS);
    if (ageState !== 'current') {
      return { kind: 'stale', closed: false, ageState: ageState, reason: ageState === 'future' ? 'status timestamp is in the future' : 'status is missing a fresh time' };
    }
    var raw = String(input.status || '').toLowerCase();
    var stripped = raw.replace(/\boff[\s-]*turf\b/g, ' ');
    var unofficial = /\bunofficial\b/.test(stripped);
    var body = stripped.replace(/\bunofficial\b/g, ' ');
    var fin = /\b(official|final|results?|paid|complete)\b/.test(body);
    var cancel = /\b(cancel(?:ed|led)?)\b/.test(body);
    var closed = /\b(off|closed|close|locked|stopped)\b/.test(body);
    var poolsClosed = fin || cancel || closed || unofficial;
    var mtp = input.mtp == null || input.mtp === '' ? null : Number(input.mtp);
    var mtpKnown = mtp != null && isFinite(mtp);
    if (poolsClosed && mtpKnown && mtp > 0) {
      return { kind: 'conflict', closed: false, reason: 'fresh status says closed while MTP is still positive' };
    }
    if (fin || unofficial) return { kind: 'closed', closed: true, k: 'final', label: 'FINAL', reason: 'fresh final status' };
    if (cancel) return { kind: 'closed', closed: true, k: 'canceled', label: 'CANCELED', reason: 'fresh canceled status' };
    if (closed) return { kind: 'closed', closed: true, k: 'off', label: 'OFF (POOLS CLOSED)', reason: 'fresh closed status' };
    return { kind: 'open', closed: false, reason: 'fresh open status' };
  }

  function countryOf(name) {
    var m = String(name || '').match(/\(([A-Z]{2,3})\)\s*$/);
    return m ? m[1] : null;
  }

  function parsePgm(pgm) {
    var m = String(pgm).toUpperCase().match(/^(\d+)([A-Z])?$/);
    if (!m) return { n: 9999, suf: String(pgm), raw: String(pgm) };
    return { n: Number(m[1]), suf: m[2] || '', raw: String(pgm) };
  }

  function programSort(a, b) {
    var pa = parsePgm(a), pb = parsePgm(b);
    if (pa.n !== pb.n) return pa.n - pb.n;
    if (pa.suf < pb.suf) return -1;
    if (pa.suf > pb.suf) return 1;
    return 0;
  }

  function couplingView(horses) {
    var byBase = {};
    var explicit = {};
    (horses || []).forEach(function (h) {
      var parsed = parsePgm(h.pgm);
      if (parsed.n !== 9999) {
        if (!byBase[parsed.n]) byBase[parsed.n] = [];
        byBase[parsed.n].push(String(h.pgm));
      }
      if (h.couple != null && h.couple !== '') {
        var id = String(h.couple);
        if (!explicit[id]) explicit[id] = [];
        explicit[id].push(String(h.pgm));
      }
    });
    var groups = [];
    Object.keys(byBase).forEach(function (b) {
      var ps = byBase[b].slice();
      if (ps.length >= 2) groups.push({ id: 'program-' + b, programs: ps.sort(programSort), how: 'program suffix', contract: false });
    });
    Object.keys(explicit).forEach(function (id) {
      if (explicit[id].length >= 2) groups.push({ id: id, programs: explicit[id].slice().sort(programSort), how: 'card couple field', contract: false });
    });
    var priceByGroup = [];
    groups.forEach(function (g) {
      var price = null;
      (horses || []).forEach(function (h) {
        if (g.programs.indexOf(String(h.pgm)) >= 0 && h.couple_price != null && isFinite(Number(h.couple_price))) price = Number(h.couple_price);
      });
      priceByGroup.push({ id: g.id, programs: g.programs, how: g.how, couplePrice: price, contract: false });
    });
    return {
      groups: priceByGroup,
      allocation: 'none',
      note: priceByGroup.length
        ? 'Coupled programs stay separate horses. A coupled price is not split into individual probabilities. This card has no certified allocation contract.'
        : ''
    };
  }

  function paceTag(h) {
    var s = h && h.ot && h.ot.style ? String(h.ot.style).trim().toUpperCase() : '';
    if (s.indexOf('EP') === 0) return 'EP';
    if (s[0] === 'E') return 'E';
    if (s[0] === 'P') return 'P';
    if (s[0] === 'S' || s[0] === 'C') return 'S';
    if ((h.pace || '') === 'speed') return 'E';
    if ((h.pace || '') === 'mid') return 'P';
    return '';
  }

  function fieldSignals(race) {
    var horses = (race && race.horses) || [];
    var tagged = [];
    var early = [];
    horses.forEach(function (h) {
      var p = paceTag(h);
      if (!p) return;
      tagged.push({ pgm: String(h.pgm), pace: p });
      if (p === 'E' || p === 'EP') early.push(String(h.pgm));
    });
    var pace;
    if (tagged.length < 2) {
      pace = { state: 'unknown', text: 'Pace conflict unknown. Run style is missing for too much of the field to compare.' };
    } else if (early.length >= 2) {
      pace = { state: 'overlap', text: 'Pace overlap on the card: programs ' + early.join(', ') + ' are tagged early (E or EP). That is a run-style tag, not a sectional position.' };
    } else {
      pace = { state: 'none', text: 'No early-speed overlap among the runners that have a run-style tag.' };
    }
    var strengths = [];
    horses.forEach(function (h) {
      var ot = h.ot || {};
      if (ot.rk != null && ot.rkn != null) {
        strengths.push('#' + h.pgm + ' sheet rank ' + ot.rk + ' of ' + ot.rkn + ' (field figure already on the runner).');
      } else if (ot.surf_rk != null) {
        strengths.push('#' + h.pgm + ' surface-figure rank ' + ot.surf_rk + ' (field figure already on the runner).');
      }
    });
    return {
      pace: pace,
      strengths: strengths,
      strengthsText: strengths.length ? strengths.join(' ') : 'Field-relative strengths unavailable. No comparative rank field is on these runners.',
      signalsNote: 'VC and HTR lines are shown on a runner only when that runner already carries them. This view does not add any.'
    };
  }

  function horseByPgm(horses) {
    var m = {};
    (horses || []).forEach(function (h) { m[String(h.pgm)] = h; });
    return m;
  }

  function ovalSvg(stage, paint, focusPgm, names) {
    var label = stage.spoken.toUpperCase();
    var short = stage.key;
    var parts = [];
    parts.push('<svg class="fu-oval" data-stage="' + esc(short) + '" role="img" viewBox="0 0 430 250" width="100%">');
    var summary;
    if (!stage.ok) {
      summary = stage.spoken + ' projected order unavailable. ' + stage.reason + '. No order was invented.';
    } else {
      summary = stage.spoken + ' projected order, schematic spacing, not a physical position. ' + stage.order.map(function (pgm, i) {
        var who = names && names[pgm] ? ' ' + names[pgm] : '';
        return (i + 1) + ': program ' + pgm + who;
      }).join(', ');
    }
    parts.push('<title>' + esc(summary) + '</title>');
    parts.push('<path d="M 125.0 16 L 305.0 16 A 109.0 109.0 0 0 1 305.0 234 L 125.0 234 A 109.0 109.0 0 0 1 125.0 16 Z" fill="' + paint.fill + '" stroke="#586573" stroke-width="1.5"></path>');
    parts.push('<path d="M 125.0 81.4 L 305.0 81.4 A 43.6 43.6 0 0 1 305.0 168.6 L 125.0 168.6 A 43.6 43.6 0 0 1 125.0 81.4 Z" fill="#0f141b" opacity="0.9" stroke="#e9edf1" stroke-width="1.4"></path>');
    parts.push('<path d="M 125.0 16.5 L 305.0 16.5 A 108.5 108.5 0 0 1 305.0 233.5 L 125.0 233.5 A 108.5 108.5 0 0 1 125.0 16.5 Z" fill="none" opacity="0.35" stroke="#6a7a88" stroke-width="0.6"></path>');
    parts.push('<line stroke="#f5f5f5" stroke-width="2.5" x1="305.0" x2="305.0" y1="168.6" y2="234"></line>');
    parts.push('<text fill="#cfd8e2" font-family="monospace" font-size="9" text-anchor="middle" x="305.0" y="245">WIRE</text>');
    parts.push('<text fill="#8b98aa" font-size="10.5" font-weight="700" x="19" y="30">' + esc(short) + '</text>');
    if (!stage.ok) {
      parts.push('<text fill="#e7eef6" font-size="13" font-weight="700" x="48" y="128">Order unavailable</text>');
    } else {
      stage.order.forEach(function (pgm, i) {
        var pt = pointBehind(short, i);
        var vis = rankVisual(short, i + 1);
        var focused = focusPgm != null && String(focusPgm) === String(pgm);
        var fs = String(pgm).length >= 3 ? 7.5 : (String(pgm).length >= 2 ? 8.5 : 11);
        var nm = names && names[pgm] ? names[pgm] : '';
        parts.push('<g class="fu-tok" data-pgm="' + esc(pgm) + '" data-rank="' + (i + 1) + '" tabindex="0" role="button" aria-label="Program ' + esc(pgm) + (nm ? ' ' + esc(nm) : '') + ', ' + stage.spoken + ' projected place ' + (i + 1) + '" onclick="fuFocusPgm(this.getAttribute(\'data-pgm\'))">');
        if (focused) parts.push('<circle cx="' + pt.x.toFixed(3) + '" cy="' + pt.y.toFixed(3) + '" r="' + (vis.r + 4) + '" fill="none" stroke="#f6e7b4" stroke-width="2"></circle>');
        parts.push('<circle cx="' + pt.x.toFixed(3) + '" cy="' + pt.y.toFixed(3) + '" r="' + vis.r + '" fill="' + vis.fill + '" stroke="#0c1116" stroke-width="1.4"></circle>');
        parts.push('<text x="' + pt.x.toFixed(3) + '" y="' + (pt.y + 3.2).toFixed(3) + '" fill="' + vis.text + '" font-family="monospace" font-size="' + fs + '" font-weight="700" text-anchor="middle">' + esc(pgm) + '</text>');
        parts.push('</g>');
      });
    }
    parts.push('</svg>');
    return { svg: parts.join(''), summary: summary, label: label };
  }

  function buildMeta(input) {
    input = input || {};
    var race = input.race || { horses: [] };
    var now = input.now;
    var card = input.card || {};
    var date = cardDateState(card && card.mmdd != null ? card : { mmdd: input.cardDate }, now);
    var classified = classifyRunners(race.horses || [], input.quotes || {}, now);
    var cov = coverage(classified.rows);
    var feed = cloneFeed(input.feed);
    var status = input.status || null;
    var statusAge = status ? quoteAge({ age: status.age, ts: status.ts }, now) : null;
    var statusTime = status ? timeState(statusAge, RELEASE.statusFreshS) : 'unknown';
    var surf = surfaceView(race, date.state);
    var stages = stageModel(race);
    var probs = adjustedProbs(race.horses || [], classified.confirmed.map(function (r) { return r.pgm; }));
    var build = buildStamp(card, now);
    var someFuture = classified.rows.some(function (r) { return r.quoteState === 'future'; }) || statusTime === 'future';
    return {
      race: race,
      now: now,
      mode: input.mode === 'fixture' ? 'fixture' : 'card',
      date: date,
      classified: classified,
      coverage: cov,
      feed: feed,
      quoteFeed: channelHealth(feed.quote),
      statusFeed: channelHealth(feed.status),
      status: status,
      statusAge: statusAge,
      statusTime: statusTime,
      surface: surf,
      stages: stages,
      probs: probs,
      build: build,
      coupling: couplingView(race.horses || []),
      signals: fieldSignals(race),
      focusPgm: input.focusPgm == null ? null : String(input.focusPgm),
      someFuture: someFuture,
      asset: RELEASE.version
    };
  }

  function buildStamp(card, now) {
    card = card || {};
    var version = card.source_version || card.version || card.model_version || null;
    var raw = card.built_at || card.generated_at || card.asof || card.built || null;
    var ms = raw != null ? Date.parse(raw) : NaN;
    if (!version && !isFinite(ms)) {
      return { state: 'unknown', version: null, at: null, text: 'Card build time unknown. Source version unknown.' };
    }
    var bits = [];
    if (isFinite(ms)) {
      var age = (now - ms) / 1000;
      var when = formatEt(ms);
      if (age < 0) bits.push('Card build timestamp is in the future (' + when + '). Not current.');
      else bits.push('Card built ' + when + ' (' + agePhrase(age) + ' ago).');
    } else bits.push('Card build time unknown.');
    bits.push(version ? ('Source version ' + version + '.') : 'Source version unknown.');
    return { state: isFinite(ms) && (now - ms) < 0 ? 'future' : 'known', version: version, at: isFinite(ms) ? ms : null, text: bits.join(' ') };
  }

  function agePhrase(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + 's';
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + 'm ' + s + 's';
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  function pillModel(meta) {
    var prefix = meta.mode === 'fixture' ? 'FIXTURE SIMULATION · ' : '';
    if (meta.date.state === 'invalid' || meta.date.state === 'unknown') return { cls: 'unk', text: prefix + 'unknown · card date invalid' };
    if (meta.date.state === 'historical') return { cls: 'hist', text: prefix + 'historical · card date is not today in America/New_York' };
    if (meta.quoteFeed === 'disconnected' || meta.statusFeed === 'disconnected') return { cls: 'down', text: prefix + 'disconnected · last good data kept · not a live connection' };
    if (meta.someFuture || meta.build.state === 'future') return { cls: 'unk', text: prefix + 'unknown · future timestamp · not current' };
    if (meta.date.state === 'unknown') return { cls: 'unk', text: prefix + 'unknown · card date is not readable' };
    if (meta.statusTime === 'stale' || (meta.coverage.current === 0 && meta.coverage.stale > 0)) return { cls: 'stale', text: prefix + 'stale · outside the freshness window' };
    if (meta.statusTime !== 'current' || meta.coverage.current === 0) return { cls: 'unk', text: prefix + 'unknown · no current quote and status time' };
    return { cls: 'ok', text: prefix + 'current · quote window 30s · status window 150s' };
  }

  function trustHtml(meta) {
    var cov = meta.coverage;
    var quoteText = cov.current + ' current · ' + cov.stale + ' stale · ' + cov.future + ' future · ' + cov.unknown + ' missing · ' + cov.confirmed + ' confirmed scratch · ' + cov.total + ' runners. A missing or stale quote is not a scratch.';
    var statusText;
    if (!meta.status) statusText = 'Race status unknown. No status row. The morning post clock is not a live feed.';
    else if (meta.statusTime === 'future') statusText = 'Race status timestamp is in the future. Not current.';
    else if (meta.statusTime === 'unknown') statusText = 'Race status time unknown.';
    else statusText = 'Race status ' + meta.statusTime + ' · ' + (meta.statusAge == null ? 'age unknown' : Math.round(meta.statusAge) + 's old') + (meta.status.ts != null ? ' · ' + formatEt(meta.status.ts) : '') + '. Window is 150s.';
    var feedText = 'Quote feed ' + meta.quoteFeed + (meta.feed.quote.okAt != null ? ' · last success ' + formatEt(meta.feed.quote.okAt) : '') + (meta.feed.quote.failing && meta.feed.quote.failAt != null ? ' · failed ' + formatEt(meta.feed.quote.failAt) : '') + '. Status feed ' + meta.statusFeed + '.';
    var dateText = 'Card date ' + (meta.date.key || 'unreadable') + ' · today in America/New_York is ' + meta.date.today + ' · ' + meta.date.state + '. Raw value "' + meta.date.raw + '".';
    return '<section class="fu-trust" id="fu-trust" aria-label="Trust and readiness" data-asset="' + esc(RELEASE.version) + '">'
      + '<h2 class="fu-h">Readiness</h2>'
      + '<div class="fu-cells">'
      + cell('Card and build', dateText + ' ' + meta.build.text + ' UI asset ' + RELEASE.version + ', paired with this page. ' + RELEASE.dataNote)
      + cell('Race status', statusText + ' ' + feedText)
      + cell('Scratch and surface', meta.surface.label + ' Confirmed scratches: ' + (meta.classified.confirmed.length ? meta.classified.confirmed.map(function (r) { return '#' + r.pgm; }).join(', ') : 'none') + '.')
      + cell('Quote coverage', quoteText)
      + '</div></section>';
  }

  function cell(title, body) {
    return '<div class="fu-cell"><div class="fu-k">' + esc(title) + '</div><p>' + esc(body) + '</p></div>';
  }

  function orientHtml(opts) {
    opts = opts || {};
    var date = opts.date || { state: 'unknown', key: null, today: '', raw: '' };
    var sel = opts.selected ? (opts.selected.trk + ' race ' + opts.selected.no) : 'none';
    var prevDis = opts.prev ? '' : ' disabled';
    var nextDis = opts.next ? '' : ' disabled';
    var dateLabel = date.key ? formatLongDate(date.key) : 'Card date unknown';
    return '<nav class="fu-orient" aria-label="Card date, track, and race" data-asset="' + esc(RELEASE.version) + '">'
      + '<div class="fu-date"><span class="fu-k">Card date</span> <time' + (date.key ? ' datetime="' + esc(date.key) + '"' : '') + '>' + esc(dateLabel) + '</time> <span class="fu-et">America/New_York · ' + esc(date.state) + '</span></div>'
      + '<div class="fu-sel" aria-current="true">Selected race <b>' + esc(sel) + '</b></div>'
      + '<div class="fu-moves">'
      + '<button type="button" id="prevRace" onclick="stepRace(-1)"' + prevDis + '>Previous race</button>'
      + '<button type="button" id="nextRace" onclick="stepRace(1)"' + nextDis + '>Next race</button>'
      + '</div></nav>';
  }

  function formatLongDate(key) {
    var d = new Date(key + 'T12:00:00Z');
    if (!isFinite(d.getTime())) return key;
    return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(d);
  }

  function nameMap(meta) {
    var names = {};
    ((meta.race && meta.race.horses) || []).forEach(function (h) { names[String(h.pgm)] = h.horse || h.name || ''; });
    return names;
  }

  function captureNotes(race) {
    var notes = [];
    if (race && Object.prototype.hasOwnProperty.call(race, 'nSCRATCHES')) {
      notes.push('Card capture nSCRATCHES is ' + race.nSCRATCHES + '. That is not a live late-scratch clearance and not an MTO or AE clearance.');
    }
    var coded = [];
    ((race && race.horses) || []).forEach(function (h) {
      if (h.nAE != null && h.nAE !== '' && Number(h.nAE) !== 0) coded.push('#' + h.pgm + ' code ' + h.nAE);
    });
    if (coded.length) notes.push('Raw nAE codes (' + coded.join(', ') + ') are not confirmed starters and are not scratches.');
    return notes;
  }

  function ovalsHtml(meta) {
    var paint = meta.surface.paint;
    var names = nameMap(meta);
    var blocks = meta.stages.stages.map(function (stage) {
      var drawn = ovalSvg(stage, paint, meta.focusPgm, names);
      return '<figure class="fu-stage"><figcaption>' + esc(stage.spoken) + '</figcaption>' + drawn.svg + '</figure>';
    });
    var sr = meta.stages.stages.map(function (stage) {
      return ovalSvg(stage, paint, meta.focusPgm, names).summary;
    }).join(' ');
    return '<section class="fu-ovals" aria-label="Three projected-order ovals" data-asset="' + esc(RELEASE.version) + '">'
      + '<div class="fu-ovalbar"><span class="fu-k">Projected order</span>'
      + '<button type="button" class="mini-nav" id="ovalZoom" onclick="fuToggleOvalZoom()">Enlarge ovals</button></div>'
      + '<p class="sr-only">' + esc(sr) + '</p>'
      + '<div class="views" id="ovalViews">' + blocks.join('') + '</div>'
      + '<p class="fu-cap">Schematic spacing, same 26-unit original oval. Not a physical position and not a calibrated call.</p>'
      + '</section>';
  }

  function legendHtml(meta) {
    var horses = horseByPgm(meta.race.horses || []);
    var order = Object.keys(horses).sort(programSort);
    var stageByPgm = {};
    meta.stages.stages.forEach(function (stage) {
      stageByPgm[stage.key] = {};
      if (stage.ok) stage.order.forEach(function (pgm, i) { stageByPgm[stage.key][pgm] = i + 1; });
    });
    var rows = order.map(function (pgm) {
      var h = horses[pgm];
      var name = h.horse || h.name || '';
      var country = countryOf(name);
      var row = meta.classified.byPgm[pgm];
      var on = meta.focusPgm === pgm ? ' on' : '';
      var places = meta.stages.stages.map(function (stage) {
        var n = stage.ok ? stageByPgm[stage.key][pgm] : null;
        return '<span class="fu-place"><span class="fu-k">' + esc(stage.spoken) + '</span> ' + (n ? ('place ' + n) : 'unavailable') + '</span>';
      }).join('');
      return '<button type="button" class="fu-runner' + on + '" data-pgm="' + esc(pgm) + '" onclick="fuFocusPgm(this.getAttribute(\'data-pgm\'))">'
        + '<span class="fu-pgm">' + esc(pgm) + '</span>'
        + '<span class="fu-name">' + esc(name || 'Name unavailable') + '</span>'
        + '<span class="fu-country">' + (country ? ('Country ' + esc(country)) : 'Country not in the name') + '</span>'
        + '<span class="fu-scratch">' + esc(row ? row.label : 'Scratch evidence unknown') + '</span>'
        + places
        + '</button>';
    }).join('');
    return '<section class="fu-legend" aria-label="Runner identity legend"><h2 class="fu-h">Every starter</h2>'
      + '<p class="fu-note">Program, full name, and country stay on the row. Stage places appear only when that stage list contains every starter. Unknown stays unavailable.</p>'
      + '<div class="fu-runners">' + rows + '</div></section>';
  }

  function moneyHtml(meta) {
    var horses = horseByPgm(meta.race.horses || []);
    var byP = {};
    meta.probs.active.forEach(function (x) { byP[x.pgm] = x; });
    var note = meta.mode === 'fixture'
      ? 'Fixture numbers only. They are not a forecast and they do not certify the live card.'
      : 'Adjusted win% is the existing renormalization after confirmed scratches. It is not a new model. Rounded percents are for reading; the unrounded active figures are what the call uses.';
    var sumNote = meta.probs.active.length
      ? ('Unrounded adjusted probabilities over the active runners sum to ' + meta.probs.sumP.toFixed(8) + '.')
      : 'No active runners, so there is no probability sum.';
    var rows = Object.keys(horses).sort(programSort).map(function (pgm) {
      var h = horses[pgm];
      var adj = byP[pgm];
      var shown = displayRaw(h);
      var win = shown == null ? 'Model win% unavailable' : (adj ? ('Adjusted ' + (adj.p * 100).toFixed(1) + '%') : 'Not in the adjusted set');
      var fair = adj && adj.p > 0 ? ('Fair decimal ' + (1 / adj.p).toFixed(2)) : 'Fair price unavailable';
      var ml = h.ml_dec != null ? ('Morning line decimal ' + Number(h.ml_dec).toFixed(2)) : (h.ml != null ? ('Morning line ' + h.ml) : 'Morning line unavailable');
      var row = meta.classified.byPgm[pgm];
      var tote = (row && row.dec != null && row.dec > 0) ? ('Tote decimal ' + row.dec.toFixed(2)) : 'No positive tote quote';
      var age = row ? row.label : 'Quote age unknown';
      var edge = 'Conditional value unavailable';
      if (adj && adj.p > 0 && row && row.dec != null && row.dec > 0) {
        var e = row.dec / (1 / adj.p) - 1;
        edge = 'Conditional value ' + (e >= 0 ? '+' : '') + Math.round(e * 100) + '% versus fair';
        if (row.quoteState !== 'current') edge += ' · not actionable · quote is not current';
      }
      return '<div class="fu-money-row"><span class="fu-pgm">' + esc(pgm) + '</span><span>' + esc(win) + '</span><span>' + esc(fair) + '</span><span>' + esc(ml) + '</span><span>' + esc(tote) + '</span><span>' + esc(age) + '</span><span>' + esc(edge) + '</span></div>';
    }).join('');
    var couple = meta.coupling.groups.length ? ('<p class="fu-note">' + esc(meta.coupling.note) + ' ' + meta.coupling.groups.map(function (g) {
      return 'Programs ' + g.programs.join(' / ') + (g.couplePrice != null ? (' · coupled price decimal ' + g.couplePrice.toFixed(2)) : ' · no separate coupled price on the card');
    }).join('. ') + '.</p>') : '';
    return '<section class="fu-money" aria-label="Prices kept separate"><h2 class="fu-h">Win%, fair price, line, and tote</h2>'
      + '<p class="fu-note">' + esc(note) + ' ' + esc(sumNote) + ' Morning line, tote, quote age, and conditional value are separate from the win%.</p>'
      + couple + rows + '</section>';
  }

  function signalsHtml(meta) {
    var s = meta.signals;
    var strength = '<p>' + esc(s.strengthsText) + '</p><p>' + esc(s.pace.text) + '</p><p>' + esc(s.signalsNote) + '</p>';
    return '<section class="fu-signals" aria-label="Field notes that the card actually supports"><h2 class="fu-h">Field notes</h2>' + strength + '</section>';
  }

  function bannerHtml(meta) {
    if (meta.mode === 'fixture') return '<p class="fu-banner">Synthetic fixture. Not the live card, not a forecast, and not model provenance.</p>';
    return '<p class="fu-banner">Usability view ' + esc(RELEASE.version) + '. Ovals use stage fields only when the card includes every starter. Nothing here certifies model provenance or a new forecast.</p>';
  }

  function restHtml(meta) {
    return ovalsHtml(meta) + legendHtml(meta) + moneyHtml(meta) + signalsHtml(meta);
  }

  function compactRaceHtml(meta) {
    var horses = (meta.race && meta.race.horses) || [];
    var roster = horses.map(function (h) {
      var country = countryOf(h.horse || h.name || '');
      return '#' + h.pgm + ' ' + (h.horse || h.name || 'Name unavailable') + (country ? ' Country ' + country : ' Country not in the name');
    }).join(' · ');
    var cov = meta.coverage;
    var pill = pillModel(meta);
    var notes = []
      .concat(captureNotes(meta.race))
      .concat([
        'Card ' + (meta.date.label || 'date invalid') + (meta.date.reason ? ' · ' + meta.date.reason : '') + '. Feed filter ' + (meta.date.query || 'not issued') + '. A capture scratch count is not a live clearance.',
        meta.surface.label,
        'Quotes ' + cov.current + ' current, ' + cov.stale + ' stale, ' + cov.future + ' future, ' + cov.unknown + ' missing. A missing or stale quote is not a scratch.',
        'Status ' + meta.statusTime + '. Quote window 30s. Status window 150s. Poll 3s.',
        'Quote feed ' + meta.quoteFeed + '. Status feed ' + meta.statusFeed + '.',
        pill.text
      ]);
    if (meta.coupling && meta.coupling.groups.length) notes.push(meta.coupling.note);
    return '<div class="fu-inline" data-asset="' + esc(RELEASE.version) + '">'
      + (meta.mode === 'fixture' ? '<p class="fu-cap">Synthetic fixture. Not the live card and not a forecast.</p>' : '')
      + '<details class="fu-fold"><summary>Readiness</summary><p>' + esc(notes.join(' ')) + '</p></details>'
      + ovalsHtml(meta)
      + '<p class="fu-roster">' + esc(roster) + '</p>'
      + '</div>';
  }

  function raceUsabilityHtml(input) {
    var meta = input && input.classified ? input : buildMeta(input);
    return compactRaceHtml(meta);
  }

  function orientMove(races, sel, action) {
    var next = {
      trk: sel.trk, no: sel.no,
      openPgm: sel.openPgm == null ? null : sel.openPgm,
      focusPgm: sel.focusPgm == null ? null : sel.focusPgm
    };
    if (!action || action.type === 'tick' || action.type === 'resume') return next;
    if (action.type === 'focus') { next.focusPgm = action.pgm == null ? null : String(action.pgm); return next; }
    if (action.type === 'open') { next.openPgm = action.pgm == null ? null : String(action.pgm); return next; }
    if (action.type === 'select' || action.type === 'nextOpen' || action.type === 'track') {
      var trk = action.trk != null ? action.trk : sel.trk;
      var no = action.no;
      if (action.type === 'track') {
        var ups = (action.upcoming || []).filter(function (r) { return r.trk === trk; });
        no = ups.length ? ups[0].no : no;
      }
      if (String(no) !== String(sel.no) || trk !== sel.trk) {
        next.trk = trk; next.no = no; next.openPgm = null; next.focusPgm = null;
      } else {
        next.trk = trk; next.no = no;
      }
      return next;
    }
    if (action.type === 'prev' || action.type === 'next') {
      var list = (races || []).filter(function (r) { return r.trk === sel.trk; }).slice().sort(function (a, b) { return (+a.race) - (+b.race); });
      var i = -1;
      list.forEach(function (r, idx) { if (String(r.race) === String(sel.no)) i = idx; });
      var j = i + (action.type === 'next' ? 1 : -1);
      if (j >= 0 && j < list.length) {
        next.trk = list[j].trk; next.no = list[j].race; next.openPgm = null; next.focusPgm = null;
      }
      return next;
    }
    return next;
  }

  function neighbors(races, trk, no) {
    var list = (races || []).filter(function (r) { return r.trk === trk; }).slice().sort(function (a, b) { return (+a.race) - (+b.race); });
    var i = -1;
    list.forEach(function (r, idx) { if (String(r.race) === String(no)) i = idx; });
    return { prev: i > 0 ? list[i - 1] : null, next: (i >= 0 && i < list.length - 1) ? list[i + 1] : null };
  }

  return {
    RELEASE: RELEASE,
    COLORS: COLORS,
    STAGES: STAGES,
    ANCHORS: ANCHORS,
    esc: esc,
    contrast: contrast,
    formatEt: formatEt,
    etDateKey: etDateKey,
    feedRaceDate: feedRaceDate,
    etStamp: etStamp,
    cardDateState: cardDateState,
    rosterKey: rosterKey,
    raceRoster: raceRoster,
    statusRead: statusRead,
    timeState: timeState,
    quoteActionable: quoteActionable,
    classifyRunners: classifyRunners,
    engineRaw: engineRaw,
    displayRaw: displayRaw,
    adjustedProbs: adjustedProbs,
    coverage: coverage,
    feedReduce: feedReduce,
    channelHealth: channelHealth,
    actionGate: actionGate,
    applyActionGate: applyActionGate,
    surfaceView: surfaceView,
    surfacePaint: surfacePaint,
    stageModel: stageModel,
    pointBehind: pointBehind,
    rankVisual: rankVisual,
    countryOf: countryOf,
    couplingView: couplingView,
    fieldSignals: fieldSignals,
    buildMeta: buildMeta,
    pillModel: pillModel,
    trustHtml: trustHtml,
    orientHtml: orientHtml,
    ovalsHtml: ovalsHtml,
    bannerHtml: bannerHtml,
    restHtml: restHtml,
    compactRaceHtml: compactRaceHtml,
    captureNotes: captureNotes,
    raceUsabilityHtml: raceUsabilityHtml,
    orientMove: orientMove,
    neighbors: neighbors,
    programSort: programSort
  };
});
