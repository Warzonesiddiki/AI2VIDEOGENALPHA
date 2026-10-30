# Batch 11 — acknowledgement, budget policy and write scope

## Acknowledgement is not authorization

`src/core/dataNotice.ts` defines the current notice version (`2026-10-30.1`). Fresh settings report acceptance false and no provider configurations. Accepting via the settings boundary requires `dataNoticeAccepted: true`, the current `dataNoticeVersion` and a current settings revision. The server generates the event date, version, revision and `operator-settings` channel, appending it in the same SQLite transaction as the settings change. Caller-supplied acceptance dates/history are rejected. Withdrawal preserves history. Conflicts or persistence failure roll back both writes.

The latest event must match the current version and be accepted to establish the read-view acknowledgement. Unsupported legacy booleans/dates are not evidence; provider descriptors remain unverified and their historical check dates are hidden. Read-view demotion does not rewrite original records.

This records an action through the operator settings channel, not independent human identity or permission to transmit content. It never creates spend grants, provider capability checks, rights clearance or publication approval. Paid execution and publication remain disabled. Future notice changes require changing the version and obtaining a new acknowledgement; future verified provider checks need their own evidence model.

## Internal spend ledger policy

Reservation and dispatch validate current persisted numeric USD caps within a write transaction. Run/episode limits are project-scoped; monthly limits cover the entire production root using UTC calendar months. Reserved, dispatched and unknown holds count even if old. Only current-month committed charges enter the monthly charged total. Unallocated historical grant spending is undated and conservatively retained; other project directories' grant history also counts. An existing reservation counts once at dispatch.

A lowered, invalid or exceeded cap rejects dispatch without releasing the hold or adding a transition event. Independent processes reread current policy under the SQLite transaction. The ledger has no provider network implementation. These checks are not reconciliation, request idempotency or complete future provider execution authorization. Directory discovery and imported records retain the operator-controlled-root/schema assumptions; do not treat these tests as arbitrary corrupted-data assurance.

## Storage scope

`saveEpisode` requires a real matching project inside the document update transaction. `saveGoogleFlowPlan` also requires an existing episode with matching project identity. Ghost writes produce neither records nor project directories. These guards do not establish every nested schema, series relationship, creation idempotency or arc-batch invariant; those remain F03/F06/F07 follow-up work.

## Verification

Thirteen tests in `server/auditRemediation.test.ts` cover fresh/legacy settings, version/history/withdrawal, rollback/protected inputs, caps and exact-count behavior, cross-project/undated exposure, scope guards, UTC old charges/uncertain holds and independent-process lowered-cap rejection. The subprocess fixture is restricted to isolated test roots. Full validation: 133 passed, 1 opt-in long test skipped, 0 failed; lint, build, npm audit (0 vulnerabilities), diff checks passed. No browser/platform/provider/production tests or new long-media run are claimed.
