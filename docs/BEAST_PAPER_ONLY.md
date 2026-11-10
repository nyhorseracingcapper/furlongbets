# THE BEAST is paper only (from the 11/11 card)
James approved this on 2026-11-09 ("You make it better").

## What changed on the site
- The site reads only `DATA.beast_paper` (`{key,trk,race,pgm,horse,ml,paper_only:true,stake:0,min_odds_to_1:4,min_dec:5,rule}`).
  - The CoPilot sheet renders the same horse, from `beast_MMDD.json.published`.
  - The legacy `DATA.beast` field is ignored, and the publisher now always writes it as `null`.
- THE BEAST is never staked or qualified. The following were removed:
  - the `kind:'BEAST'` $4 paths;
  - the `why='beast'` pass;
  - the "≥3/1 (4.00)" text.
- A race with the BEAST horse gets one extra verdict line. It says: paper only, no stake, counts on paper only at 4/1 or more at post (5.00 decimal). The horse card chip reads "★ BEAST · PAPER ONLY".
- The code lives in `js/beast-paper.js?v=beast-paper-1`, which is cache-busted by its query string.
- Tests: `tests/beast-paper.test.js`.

## Rollback
Revert this commit. Old cards (no `beast_paper`) show no BEAST at all, and nothing is ever staked.
