# Usability t438 — release block and rollback

Release id: `t438-usability-1`

This change is a staging implementation of the approved usability scope (orient, readiness, scratches and surface wording, three projected-order ovals, whole-field reading). It is not a release.

## Blocked until all of these are true

- Visual signoff of the oval geometry and the phone stack.
- The approved production model is actually present. It is not in this repo, and the Nov 7 attachments are presentation references only.
- Nov 8 inputs are verified. They are not verified here.
- Someone with the card password completes visual QA on the real gate. This branch does not bypass that gate.
- Fixture passes are not live-card health. A green fixture run does not mean today's odds, status, or model are current.

Do not merge or deploy from this branch as part of the implementation. There is no automerge.

## What ships together

`index.html`, `js/usability.js`, and `css/usability.css` are one revision. The encrypted card bytes in `index.html` are not part of the usability edit. Auth (`functions/api/*`), `members_card.enc`, and the Supabase writer are untouched. Quote freshness stays 30 seconds, status freshness stays 150 seconds, and both polls stay at 3 seconds.

## How to roll back

Before merge: close the pull request. Nothing is deployed.

After a merge that should not have shipped: revert that commit and redeploy the previous static files. There is no database migration and no feature flag. Reverting removes the usability script and restores the previous renderer, including its old scratch inference and the old verdict refresh timing.

The last-good quote and status rows are not deleted by this page. A failed fetch keeps them on screen and marks them disconnected or stale. Rolling the static files back does not require a data restore.
