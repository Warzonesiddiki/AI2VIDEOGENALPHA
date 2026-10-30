# Atomic arc expansion and related boundary fixes — Batch 13

## Shared API / CLI contract

`StorageEngine.expandArc(projectId, input)` is the shared implementation. Inputs:

- `arcNumber`: numeric integer, 1–100, present in the roadmap.
- `count`: numeric integer, 1–20 (default 10). Strings, booleans, fractions, zero and extra properties are rejected.
- `idempotencyKey`: required identifier, scoped to the project. Reuse only for exactly the same arc/count.

The project and its active series must exist and agree on scope. One SQLite write transaction allocates cards above the largest existing episode-number field or standard episode-ID suffix and writes both the episode collection and request history. IDs use the requested arc's season and globally increasing episode suffix; this appends drafts, not reserved canonical roadmap-slot assignments. Database IDs use UUIDs. Imported malformed numeric fields fail closed for reconciliation.

Repeated identical requests return the original creation snapshot, even if the cards have since been edited. A reused key with changed input returns HTTP 409. New intentional batches require new keys. Request-history storage is currently unbounded; retention/pruning must preserve replay guarantees and is not implemented. Requests are serialized through SQLite; no provider calls occur.

```bash
npm run studio -- arc expand --arc 1 --count 2 --idempotency-key original-draft-batch-001 --json
```

The CLI now actually persists draft cards (the earlier CLI only reported an expansion). Roadmap UI keeps the key across failed attempts while mounted and prevents simultaneous local submissions. Refresh/remount does not preserve that key; operators requiring durable retries should retain an explicit CLI/API key. Draft cards are not distinctness/continuity approval, reviewed scripts or production authorization. Generation templates still require editorial work.

## Related fixes and limits

- Episode/Flow writes snapshot caller input before awaiting and reject a nonzero revision when creating a missing record. Episode writes require the active series identity. Existing CLI callers still receive the saved revision through their input object after persistence; this is intentional compatibility, not permission to mutate the persisted snapshot.
- Plan/checkpoint GET returns 404 for an unprepared plan. Use explicit POST to prepare/reset it; reads do not change its revision. Flow responses are no-store. Storage initialization/import-on-read and doctor probes still prevent claiming every GET is filesystem/metadata read-only.
- Worker cleanup uses nested finally: cancellation timer/controller release and scratch cleanup are attempted even if export cleanup throws. Errors remain visible; orphan inventory, leases/PID reuse and crash-boundary reconciliation are unfinished.
- Frame reads use an opened handle, initial size check and bounded chunks, rejecting growth at one byte above 12 MB and always closing the handle. Hashing and decoding use the same bounded buffer. This is not a hostile-user filesystem sandbox or a disk reservation.

## Evidence

Twelve new regressions cover strict schemas, high-water numbering, replay snapshots, rollback, two-process allocation/replay, API conflicts, actual CLI persistence, input snapshots/new revisions, read-only Flow GET, export/scratch cleanup faults and bounded reads/post-stat growth. Full suite: **147 passed, 1 long test skipped, 0 failed**; lint/build/audit/diff pass, zero known npm vulnerabilities. No automated browser, Windows, paid-provider, production migration, publication or new long-media validation is claimed. See the deep audit for remaining findings.
