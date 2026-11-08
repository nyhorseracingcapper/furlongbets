/* Synthetic card for usability tests. Not a race card, not a forecast, not live odds. */
(function (root) {
  function horse(pgm, name, extra) {
    var h = { pgm: String(pgm), horse: name, p_raw: extra && extra.p_raw != null ? extra.p_raw : 0.04, ml_dec: 6 };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  var orderA = ['2', '1', '11', '1A', '10', '3', '5', '8', '9', '12', '4', '15', '13', '7', '6', '14'];
  var orderB = ['11', '10', '1A', '1', '3', '2', '9', '12', '5', '8', '15', '13', '4', '7', '14', '6'];
  var orderC = ['1A', '11', '2', '10', '1', '5', '3', '9', '12', '8', '13', '15', '4', '7', '6', '14'];

  var field16 = [
    horse('1', 'Coupled Anchor', { p_raw: 0.11, ml_dec: 3.5, couple_price: 4.5, ot: { style: 'P', rk: 1, rkn: 16 } }),
    horse('1A', 'Coupled Alpha (FR)', { p_raw: 0.07, ml_dec: 3.5, couple_price: 4.5, ot: { style: 'S' } }),
    horse('2', 'Early Example', { p_raw: 0.09, ot: { style: 'E' } }),
    horse('3', 'Presser Example', { p_raw: 0.08, ot: { style: 'EP' } }),
    horse('4', 'Stale Quote Horse', { p_raw: 0.05 }),
    horse('5', 'No Style Horse', { p_raw: 0.04 }),
    horse('6', 'Tote Scratch Example', { p_raw: 0.06 }),
    horse('7', 'Missing Quote Horse', { p_raw: 0.05 }),
    horse('8', 'Future Quote Horse', { p_raw: 0.04 }),
    horse('9', 'Plain Nine', { p_raw: 0.04 }),
    horse('10', 'Plain Ten (GB)', { p_raw: 0.06 }),
    horse('11', 'International Velvet Thunderbolt of the Western Counties (IRE)', { p_raw: 0.08 }),
    horse('12', 'Twelve Runner', { p_raw: 0.04 }),
    horse('13', 'Thirteen Runner', { p_raw: 0.04 }),
    horse('14', 'Card Scratch Example', { p_raw: 0.05, scr: true, scr_ts: Date.parse('2026-11-07T14:05:00Z') }),
    horse('15', 'Fifteen Runner', { p_raw: 0.05, nAE: 1 })
  ];

  var field20 = [];
  for (var n = 1; n <= 20; n++) {
    var name = n === 11 ? 'Very Long Country Suffixed Name For Zoom Checks (IRE)' : ('Fixture Runner ' + n + (n === 10 ? ' (GB)' : ''));
    field20.push(horse(String(n), name, { p_raw: 0.05 }));
  }
  var pgm20 = field20.map(function (h) { return h.pgm; });
  var rot = function (list, k) {
    return list.slice(k).concat(list.slice(0, k));
  };

  var fieldPlain = [];
  for (var i = 1; i <= 8; i++) fieldPlain.push(horse(String(i), 'Unstaged Runner ' + i, { p_raw: 0.125 }));
  var partialHorses = fieldPlain.map(function (h) { return horse(h.pgm, 'Partial ' + h.horse, { p_raw: h.p_raw }); });
  var partialOrder = ['1', '2', '3', '4', '5', '6', '7'];

  root.FIXTURE_CARD = {
    fixture: true,
    label: 'SYNTHETIC FIXTURE — not a race card and not a forecast',
    mmdd: '1107',
    card_year: 2026,
    source_captured_at: '2026-11-07T15:00:00-05:00',
    source_version: null,
    races: [
      { trk: 'FIXT', race: 1, surf: 'Dirt', dist: '6f', post: '3:15 PM', nSCRATCHES: 0, horses: field16, stage_orders: { first: orderA, second: orderB, finish: orderC } },
      { trk: 'FIXT', race: 2, surf: 'Turf', dist: '8f', post: '3:45 PM', horses: field20, stage_orders: { first: pgm20, second: rot(pgm20, 3), finish: rot(pgm20, 7) } },
      { trk: 'FIXT', race: 3, surf: 'Off turf', dist: '5f', post: '4:10 PM', horses: fieldPlain },
      { trk: 'FIXT', race: 4, surf: '', dist: '1m', post: '4:40 PM', horses: partialHorses, stage_orders: { first: partialOrder, second: partialOrder, finish: partialOrder } }
    ]
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
