# Project lifecycle: validation, archive revisions and real rendering

## Creation

`POST /api/projects` accepts only `name` and optional `description`, returning 201 and the project. Storage enforces the same constraints for CLI/internal callers:

- Nonempty trimmed name; at most 200 characters before trimming; no control characters.
- Description is text, at most 5,000 characters, without null bytes.
- Server-generated UUID project ID, production-root-confined directory and server-owned series identity. Names/descriptions never select a path.
- New project metadata starts at revision 1. The copied series is original Ternfall planning material, not generated production assets or independent rights approval.
- Project, series and empty collections are written in one SQLite transaction. The directory creation is outside SQLite; a failed metadata transaction may leave an empty directory. No automatic orphan-directory deletion is performed.

Unknown fields, supplied production paths and malformed types are rejected rather than coerced. Unicode names are supported; names without ASCII slug characters receive the display slug `project`. Slugs are not filesystem keys or unique identities.

## Archive and unarchive

`GET /api/projects` and the typed `project show` command expose the current revision. Legacy missing revisions read as 0 without rewriting metadata. Submit that token with the desired boolean:

```json
{"isArchived":true,"revision":1}
```

`POST /api/projects/:id/archive` returns the next revision. Strings such as `"false"`, numbers and null are invalid booleans. Stale edits return 409 with `code: "REVISION_CONFLICT"` and `currentRevision`; missing projects return 404. Missing write tokens mean legacy revision 0, not unconditional writes.

Archiving changes metadata only. It does **not** delete sources, exports or records, freeze project edits, cancel queued/running jobs, purge checkpoints or implement an archive export. It preserves project identity, root, series and creation time. Unarchiving removes the archive timestamp and increments the revision. Reload and deliberately reconcile a conflict; do not blindly replace tokens on an old request.

## Typed CLI

```bash
npm run studio -- project list --json
npm run studio -- project create "Original project name" --description "Original planning description" --json
npm run studio -- project show <project-id> --json
npm run studio -- project archive <project-id> --expected-revision 1 --json
npm run studio -- project unarchive <project-id> --expected-revision 2 --json
npm run studio -- project backup --json
```

Use the actual returned revisions, not these illustrative numbers. `archive` and `unarchive` require an explicit numeric token. A stale/missing token exits unsuccessfully; JSON CLI errors currently contain the error message rather than the HTTP structured revision fields. `backup` is a metadata-only SQLite snapshot, not a media archive or tested operator restore workflow. Help no longer advertises unimplemented project open/restore commands.

## Placeholder rendering removal

The legacy episode `render-script` GET endpoint formerly returned a color-and-silence composite and called it a render. It has been removed and returns 501, including case/trailing-slash variants. The scene planner's rendering tab now uses the actual `LocalRenderPanel`, passing the selected project and episode instead of hardcoding the pilot project. Supplied PNG/audio files and measured QC are required. Storyboard/audio/caption examples remain explicitly illustrative planning data, not verified production assets.

## Validation and limits

Eight project regressions cover creation/Unicode/unique identities, full metadata initialization, legacy reads, strict booleans, independent-instance/API conflicts, malformed input without writes, nondestructive archiving, simultaneous independent-process archive races, isolated real CLI workflows, and transaction rollback after an injected later-document failure. Separate endpoint coverage rejects the placeholder render script.

There is no new archive management UI, browser automation, operator restore service or project-creation idempotency key in this batch. Repeating a create request may create another project. See the follow-up audit for remaining lifecycle/storage gaps.
