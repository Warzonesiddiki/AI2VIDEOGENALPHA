# Independent project audit — Ternfall Studio

- **Date:** 2026-10-30 UTC
- **Reviewed commit:** `355c7023f7cba1417a1896a9713b9db26bc39ec3`
- **Scope:** application, storage, local media worker, security boundaries, tests, dependency and operational readiness. This is a point-in-time engineering audit, not a penetration test or editorial certification.

## Executive assessment

Ternfall Studio is currently a useful **single-operator writing/planning application with a real supplied-asset renderer**, not the autonomous video-generation and publishing system described in the project specification. The renderer validates source frames and audio, performs actual H.264/AAC rendering and technical QC, and verifies playback bytes. Paid provider execution, approval creation, and unattended publishing are intentionally blocked in the main server paths.

The highest-priority findings are a **reproducible duplicate episode ID**, broken episode creation/editing against checked-in legacy data, false production-readiness results, and executable Video Essay scripts that bypass the documented rendering and consent boundaries. Several issues were reproduced in isolated temporary roots; no production metadata, approval grants or media were changed, and no provider generation or publishing was performed.

**Immediate operator precautions until fixed:** back up metadata and original media separately; avoid the Episode Board's duplicate action on the checked-in legacy project; do not treat automated story checks as production approval; do not run the old or Video Essay-generated render scripts as verified production workflows. Local rendering requires maintained FFmpeg and FFprobe installations and supplied original assets.

## Prioritized findings

### P1 — Episode duplication can create duplicate IDs in the checked-in project

**Reproduced.** [`duplicateEpisode`](../server/storage.ts#L363-L394) allocates the next number from `episodeNumber` only and appends without checking that the resulting ID is unique. The checked-in [`S01E002` record](../data/production_root/projects/proj_ternfall_01/episodes.json#L147-L154) has `episodeNumberInSeries: 2` but no `episodeNumber`. In an isolated copy of that project, duplicating `S01E001` returned HTTP 200 and appended a second `S01E002` with a different database ID. [`getEpisode`](../server/storage.ts#L293-L296) returns the first match, making identity-dependent reads ambiguous.

**Improve:** allocate episode identity atomically from all supported legacy numbering fields and existing IDs; enforce uniqueness for both IDs inside the transaction; use the same server-owned allocator for create, duplicate and arc expansion. Add regression tests using the actual legacy schema, sparse numbering, multiple seasons and concurrent processes. Provide an inspect-first, backup-backed reconciliation tool for existing collisions; do not silently rewrite user records.

### P1 — New cards and an existing legacy card fail the current series guard

**Reproduced.** [`EpisodeBoardView`](../src/components/EpisodeBoardView.tsx#L48-L58) constructs `series_${projectId}`. The checked-in default project's [`activeSeriesId`](../data/production_root/projects/proj_ternfall_01/project.json#L10) is instead `series_ternfall_01`, so a UI-shaped new-card request receives HTTP 400 `Episode series scope mismatch` from [`saveEpisode`](../server/storage.ts#L338-L350). The checked-in `S01E002` has the inverse mismatch and an unchanged save also receives 400.

**Improve:** derive the active series and allocate the episode ID on the server rather than guessing in the browser. Add a staged, reversible migration for legacy series references, including a dry-run report and tests that existing drafts, IDs and links survive. Surface errors inside the creation dialog, not behind its overlay.

### P1 — Video Essay exports bypass the verified renderer and can send text externally

**Reproduced/source-confirmed.** The [Video Essay UI](../src/components/VideoEssayStudioView.tsx#L720-L726) still generates downloadable Windows render, voiceover and orchestrator scripts. Its [render script](../src/core/video_essay.ts#L514-L520) fabricates placeholder stills for missing assets; the [orchestrator](../src/core/video_essay.ts#L919-L936) prints production success without establishing the local worker's measured QC. The [voice script](../src/core/video_essay.ts#L771-L776) calls `edge-tts` with narration text: [edge-tts describes itself as an online Microsoft speech service](https://github.com/rany2/edge-tts), so running it sends text outside the local workflow rather than through the Studio's notice/approval boundary. The scripts are operator-run; this audit did not execute them or demonstrate an automatic provider call.

The [Video Essay API](../server/routes.ts#L317-L326) also ignores the requested project and episode. A request for a nonexistent project/episode returned HTTP 200 with the pilot and a Windows script. Separately, tracked [legacy render scripts](../scripts/render_youtube_S01E001_master.sh#L31-L48) remain in the repository and include a silent-audio fallback.

**Improve:** remove or explicitly quarantine unsupported executable exports and the misleading endpoint; route supported outputs through the supplied-asset worker. If external TTS is introduced intentionally, disclose the provider and data flow, require the appropriate explicit operator action, and record provenance. Fail on missing media and require measured QC; never silently substitute placeholders. Audit previously exported files separately rather than deleting them automatically.

### P1 — An empty draft can be declared production-ready

**Reproduced.** [`POST .../episodes/:epId/check`](../server/routes.ts#L196-L221) derives `isReadyForProduction` only from distinctness and keyword checks; if there is no script, canon validation stays at its default non-violation value. A newly created `planned` episode with `scriptVersions: []` returned HTTP 200 and `isReadyForProduction: true`. The [CLI](../bin/studio.ts#L275-L280) correctly treats these checks as advisory and returns readiness false.

**Improve:** make API and CLI semantics consistent. Return explicit `not_checked`/`unknown` for absent content and never claim readiness without a separate evidence-backed editorial/rights decision and artifact-specific technical QC. Add API regressions for empty scripts, unreviewed drafts and missing assets. This does not imply that a keyword check can certify story or rights quality.

### P1 — Flow prompts do not reflect the selected episode

**Reproduced.** [`createGoogleFlowPlan`](../src/core/flow.ts#L179-L189) receives an episode ID/title but no episode story or script. The [prompt generator](../src/core/flow.ts#L131-L163) repeats fixed South Gate/Rhea actions; the [batch planner](../src/core/flow.ts#L239-L261) rotates a fixed beat list. Two plans with different episode IDs and unrelated titles produced identical prompt text for all 48 frames in a two-second fixture. Thus the planning math works, but the prompts are not individualized to the selected story.

**Improve:** build a versioned shot/beat plan from the selected episode's reviewed script and production settings, record its source revision, and invalidate dependent plans when the script changes. Validate timing, shot continuity and originality with human review before any provider integration; do not enable paid execution as a shortcut.

### P2 — Worker setup errors can strand the queue

**Reproduced under a filesystem-error condition.** [`runNext`](../server/localMedia.ts#L152-L167) claims the job and registers a controller before resolving the work path, but `safePath` runs before the `try/finally`. In an isolated root with a prohibited symlink at `local_work`, `runNext()` threw, the job remained `running`, `recoverInterrupted()` returned 0 because the owner process was still alive, and `close()` reported an active worker. The shared queue cannot claim another job while one remains running.

**Improve:** bring all post-claim setup under failure handling and cleanup; transition the owned job to a safe terminal/interrupted state, release controllers, and leave a visible diagnostic. Regression-test symlink rejection, setup failure, process death, orphan children, PID reuse, cancellation and cleanup errors. Preserve the existing fail-closed path guard.

### P2 — UI actions and project selection do not match available behavior

**Source-confirmed.** The main [“Prepare Production Plan” action](../src/components/GoogleFlowView.tsx#L249-L267) calls a [blocked 501 endpoint](../server/routes.ts#L78-L87) and ignores a JSON response with `ok: false`; the separate explicit plan endpoint exists. The application initializes a fixed project ID and never calls [`setProjectId`](../src/App.tsx#L26-L34), despite project lifecycle support in the API/CLI. Video Essay also uses a local hard-coded catalog, not the selected project's episodes.

**Improve:** connect the main action to the real revision-aware plan API or disable it with an explanation; expose every failure in the UI. Add a real project selector and use selected project/episode state consistently. Guard asynchronous requests against stale project/episode changes and preserve unsaved drafts.

### P2 — Runtime assets are not protected from accidental commits

**Source-confirmed.** [`.gitignore`](../.gitignore) excludes SQLite files but does not ignore production audio, image frames, exports, settings JSON or new `.aistudio` artifacts. The repository already tracks a [~24.7 MB legacy plan](../data/production_root/projects/proj_ternfall_01/flow_plans/S01E001.json) and temporary AI Studio images. Private source media, large binaries or generated metadata could therefore be added accidentally.

**Improve:** separate minimal intentional fixtures from local runtime data, ignore generated assets/exports/settings and scratch directories, and add secret/large-file checks. `.gitignore` alone does not untrack existing files: review every existing tracked asset and preserve user data before changing tracking or history.

### P2 — Recovery, backup and hosted access are incomplete

**Source-confirmed/conditional.** SQLite [`VACUUM INTO` backup](../server/lib/documents.ts#L41-L46) is consistent for metadata but excludes media and has no staged, integrity-checked full restore. The [media guide](local-media-workflow.md#failure-and-recovery) documents remaining orphan/PID and disk-capacity limitations. Operator access uses one shared Basic/Bearer credential and origin checking ([access middleware](../server/lib/access.ts)); it lacks rate limiting, distinct user identities and session/rotation controls. Several older handlers return raw `err.message`, bypassing the sanitized final error boundary.

**Improve:** add a versioned asset/hash manifest, isolated restore validation and explicit operator activation/rollback; test ENOSPC and interrupted restore. Keep deployment local/single-operator over HTTPS until rate/concurrency limits, credential lifecycle, safe error mapping and an appropriate identity model exist. Research URL checks are not a DNS/redirect-safe fetch firewall; keep research capture separate from fetching unless those protections are built.

### P3 — Cost, performance and requirements claims need reconciliation

**Source-confirmed.** [`PROJECT_SPEC.md`](../PROJECT_SPEC.md#L1-L26) calls 100% automated generation active, while the [README](../README.md#what-works--what-does-not) describes blocked functionality. The [traceability ledger](requirements-traceability.md#requirements-traceability-ledger) marks the end-to-end autoproducer as PASS although execution is disabled. The Flow and Video Essay views also contain unsupported cost, credit, retention and render-time claims.

A checked-in ten-minute Flow plan is approximately 24.7 MB on disk, and [`GET /flow/plan/:epId`](../server/flowRoutes.ts#L20-L24) returns the entire plan. This creates avoidable parsing, memory and transfer costs as episode duration and count grow.

**Improve:** designate one current requirements/status source and label aspirational or historical items accordingly. Replace unsupported telemetry and marketing predictions with `unknown`, estimates with provenance, or measured data. Profile representative plans; generate prompts on demand, paginate batch details, and store shared templates separately from per-frame state. Split the very large UI components into testable domain/view modules after correctness is secured.

## Strengths and verification performed

- Path containment, identifier validation, explicit operator access, bounded JSON and disabled unsafe server routes are present. A production-mode smoke test in a temporary root returned 401 unauthenticated, 200 for authenticated HTML/API, 501 for disabled autoproduction, and 403 for a cross-origin request.
- The local worker uses a single-root queue, idempotency, segmented checkpoints, input hashing, measured output QC and verified byte-range playback. These are substantive controls, not proof of editorial quality or rights clearance.
- SQLite transactions and optimistic revisions cover several important writes; the regression suite includes independent-process races and fault injection.
- Fresh `npm ci`, `npm run lint`, `npm run build`, `npm audit --audit-level=high`, and `git diff --check` passed. `npm test`: **167 passed, 0 failed, 1 skipped**; the skipped test is the opt-in 900-second media render.
- The test suite used bundled FFmpeg/FFprobe fixtures; the environment did not have system FFmpeg/FFprobe on PATH. The bundled FFmpeg reports 2018 version metadata, and npm audit does not certify native binary maintenance. Production should use maintained binaries.
- No browser or accessibility automation, Windows execution, paid provider integration, public upload, new 900-second render, hostile-filesystem penetration test or full production restore was performed. These remain release-validation gaps. No active GitHub Actions workflow exists; only a [CI example](ci-workflow.example.yml) is present.

## Recommended delivery order

1. **Protect data and trust:** back up metadata and originals; block ambiguous duplication and unverified script exports; make readiness fail closed and remove misleading UI claims.
2. **Restore core workflows:** implement server-owned episode/series allocation and staged legacy reconciliation; make plan creation and project selection work; add regression tests for each reproduced failure.
3. **Harden operations:** fix pre-claim/post-claim worker cleanup, full backup/restore, ENOSPC handling and hosted-access controls; test with maintained native tools.
4. **Establish release evidence:** install reviewed CI, add browser/accessibility and Windows coverage, and run the long media test in an appropriate environment. Record exactly what was and was not tested.
5. **Build toward the product goal:** create script-derived, versioned shot plans and only then evaluate compliant provider integrations, explicit consent/spend controls, rights review and human-approved publishing. Do not represent speculative costs, credits or output quality as measured facts.
