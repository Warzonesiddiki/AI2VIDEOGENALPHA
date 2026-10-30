# Configuration revisions and safe saves

Settings and series-bible edits now use the same optimistic-concurrency pattern as episodes and Flow plans. This does not complete concurrency/schema remediation for all record models.

## Revision contract

- `GET /api/settings` and `GET /api/projects/:id/series` return `revision` (legacy documents without one read as `0`). Reads do not rewrite legacy files.
- Include that revision in the matching `PUT`. SQLite compares and updates the record in one write transaction; a successful write increments the revision and returns the saved view. The settings HTTP view is deliberately narrower than its stored document.
- A missing revision is treated as `0` for legacy compatibility. It is **not** an unconditional-write bypass after the first edit. For settings, an explicit malformed value such as `null` is not a missing revision and its HTTP view fails closed.
- These storage updates do not advance past `Number.MAX_SAFE_INTEGER`; an exhausted revision requires operator investigation and is not reset automatically. Settings failure is generic over HTTP and must not be assumed to mean every possible failure had no effect.
- Stale writes return HTTP **409** with `code: "REVISION_CONFLICT"` and `currentRevision`. No requested fields are changed. Invalid inputs return 400; a nonexistent series returns 404.
- Reload separately, compare the current document with your retained draft, merge deliberately, and submit with the latest revision. Do not blindly replace the token and resubmit an old document; that discards the protection's benefit.

Example request bodies (the values `0` below apply only to a document actually loaded at revision 0):

```json
{"revision":0,"productionTimezone":"Asia/Kolkata","dataNoticeAccepted":true,"dataNoticeVersion":"2026-10-30.1"}
```

```json
{"revision":0,"seriesTitle":"The Quiet Hours: Ternfall"}
```

## Settings restrictions and browser behavior

Only `productionTimezone` and `dataNoticeAccepted` can be edited through this endpoint. `revision` is a concurrency token, not a setting. To accept the notice, send the current `dataNoticeVersion` from GET; the example version may become outdated. Budget caps, storage paths and provider controls cannot be changed through settings PUT. Do not send the entire GET document back; it includes read-only configuration.

Settings GET and successful PUT responses are `no-store` and allowlist only the revision, valid timezone, current notice state/version/date and valid USD cap amounts. Provider configurations, production root, unknown fields and nested extras are not returned. Unsupported currencies and invalid/missing cap amounts are omitted, not reinterpreted as USD; numeric zero remains zero. An invalid timezone is unavailable rather than silently displayed as UTC. Invalid revisions fail closed. The UI displays absent values as unavailable and accepts a newly selected timezone. Local storage and operator tooling retain their detailed data, which may include sensitive historical fields; handle those outputs accordingly. A normal settings save preserves unrelated raw legacy/provider fields rather than persisting their demoted read view. This projection covers these endpoints, not every API response.

The settings form sends only the editable fields and token, disables its fields while saving, displays API/load failures, retains the draft on conflict and refreshes its token only on successful save. Project-change/unmount guards prevent an old settings request from replacing the newly loaded settings. Reloading the page discards an unsaved draft; there is no persistent draft storage or automatic merge UI.

Budget controls are read-only. Grant creation/revocation controls are disabled to match the server gates; historical grants are not provider execution readiness. Paid generation and approval issuance remain disabled.

## Series identity and validation

`id`, `projectId` and `createdAt` are immutable. `updatedAt` and the next revision are server-owned. Supported partial updates preserve fields not supplied; nested objects/arrays replace the corresponding field, not a deep merge. Unknown fields, malformed revisions, empty/oversized top-level text, invalid pacing/runtime, non-array collection fields and invalid top-level visual-bible containers are rejected.

These are **not complete nested runtime schemas** for characters, world rules or visual-bible contents. Full structured validation, remaining model concurrency checks and an interactive series merge editor remain open. The existing app save helper forwards the loaded series revision and propagates failures rather than silently treating them as success; it is not a new series editor.

## Verification

The regressions use isolated temporary roots: two storage instances, structured HTTP conflicts, legacy revision-0 behavior, immutable identities, missing-project isolation, protected settings, rejected malformed inputs, and simultaneous independent processes. For both settings and series, a same-revision race produces exactly one winner and one conflict. HTTP fixtures cover nested legacy secrets, malformed caps and preservation during settings saves. An isolated Chromium smoke intercepts a settings response to check zero and unavailable values; this is not complete accessibility or device testing. No production records or approvals are modified by these tests.
