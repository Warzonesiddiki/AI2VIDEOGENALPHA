# Audit remediation progress — 2026-10-29

This is a historical and ongoing remediation ledger, **not completion of the full audit**. Later batches supersede earlier point-in-time limitations.

## Safety coverage correction (Batch 9)

Earlier statements that all arbitrary production/status/package mutations were fail-closed were too broad. Batch 9 found reachable legacy job transition/reconciliation and fabricated YouTube package creation, plus grant-creation path-variant gaps. Those handlers are now removed, grants creation/revocation closed, and case/trailing-slash gate regressions added. See `docs/production-record-revisions.md`.

## Implemented
- Repaired Vite/esbuild peer resolution; committed npm lockfile and Node engine requirement.
- Added CI for clean install, type checks, tests, build and high-severity dependency audit.
- Added shared identifier validation and root containment checks, rejecting sibling-prefix escapes, backslashes and symlink ancestors.
- Guarded storage JSON boundaries and moved API-generated scripts under `data/production_root/scripts`.
- Refused unreadable/corrupted JSON instead of returning empty defaults; refused reseeding a partially existing default project; made initialization single-flight.
- Default server binding is local-only. Remote binding requires a configured token of at least 32 characters; browser HTTP Basic and automation Bearer authentication are supported. Cross-origin calls are rejected; unauthenticated loopback mode rejects remote Host headers.
- Added bounded Flow duration/fps inputs and identifier checks before filesystem operations.
- Spend evaluation now rejects missing grants, nonfinite/negative values, invalid expiry, wrong project/episode scope and currency. The pure evaluator does not claim to persist a reservation.
- Disabled new spend grants and paid Gemini calls pending operator approval-service and worker integration. Tests use synthetic approvals only in isolated temporary roots; no production grants were created or modified.
- Planning now reports `planned`, zero processed/verified frames and unmeasured QC rather than packaged media. Removed the fake timed production progress animation.
- Replaced placeholder-producing generated workers with an explicit unsupported worker failure.
- Disabled simulation, arbitrary status changes, fake stage advancement, no-op cleanup and fabricated telemetry. Batch 4 re-enables ingestion only through real file decoding and revision-checked evidence; unsupported actions remain fail-closed.
- Removed automatic generation of a fake YouTube package with passing QC when a package list is empty.
- Doctor now probes installed FFmpeg/FFprobe/OpenCode and filesystem free space; removed the hard-coded laptop/NVENC dashboard. Key presence is reported as configured but unverified.
- New CLI research is unverified and not automatically human-approved; IPv6 literal research URLs are rejected.
- Lazy-loaded feature tabs and added cancellation/reset for project-switch data loads.

## Batch 2 — transactional metadata and spending

- Added a local SQLite document store using Node's built-in `node:sqlite` (Node **22.13+**; tested on 22.22.3). Node currently emits an experimental SQLite warning. No native npm addon is required.
- Metadata now lives in `data/production_root/studio.sqlite`, using WAL, FULL synchronous commits, bounded busy handling, schema version checks and restrictive file permissions. Database and WAL/SHM sidecars are ignored by Git.
- Initialization imports known legacy project JSON and Flow plans in a transaction. Legacy files are preserved, not deleted or rewritten. Once a document is imported, SQLite is authoritative: manually editing legacy JSON no longer updates that document. Never run an older JSON-only app concurrently against this root.
- Collection saves atomically read-modify-write under SQLite transactions. Independent additions from multiple CLI/server processes are preserved. Series/settings/archive merges and duplicate episode allocation also use current transactional data.
- Added durable spending reservations using integer micro-USD units (six decimal places), persisted caps/approvals, project/episode/provider validation, idempotency keys, and reservation/dispatch/unknown/commit/release events.
- Outstanding and uncertain reservations consume budget. Charge commits update approval accounting and ledger state in one transaction. Conflicting retries and repeat dispatch claims are rejected. Revocation/expiry are checked again before dispatch. Unknown outcomes cannot release budget without reconciliation evidence.
- Existing undated spending in imported grants is conservatively charged against all relevant caps until an operator reconciles the history; this may deny otherwise valid work rather than silently undercount spending.
- Added a real consistent **metadata-only** backup through `studio project backup --json`. It snapshots SQLite with `VACUUM INTO` under `production_root/backups`. It is not a media archive, does not execute a restore, and does not publish anything.
- The ledger is an internal storage service only. New approval minting, paid provider calls and automatic production remain disabled. No real spending was executed.

### Storage and backup notes (historical; see Batch 17)

Keep the entire production root on a local filesystem that supports SQLite locking; network-share safety is not established. Do not copy only the live `studio.sqlite` file while the app is writing, since committed data can be in the WAL. Use the metadata backup command for a consistent snapshot and back up media separately. Test snapshots in a separate root before any operator-controlled recovery; an automated destructive restore command is not implemented.

Document transactions protect collections. Batch 4 adds optimistic same-record revision checks for episodes and Flow plans; other full-replacement models and a visual merge UI remain open. The document model uses whole-collection rows and bounded synchronous transactions; normalization and asynchronous-worker isolation may be needed at scale.

## Batch 3 — real short local exports

- Added a durable local render queue, atomic single-worker claims, cross-process cancellation, dead-owner recovery and explicit retries in separate attempt directories.
- Added full PNG decode/dimension validation, audio validation, snapshots and SHA-256 input/output manifests. No placeholder images, missing-audio fallback or simulated success.
- Real FFmpeg export now produces 1080p/24fps H.264/AAC from supplied assets, with two-pass audio normalization, decode checking and measured final loudness/true peak/frames/duration before success.
- Added project-scoped local-render API, actual range-capable playback, typed `studio media ... --json` commands and a real Local Render panel in Google Flow.
- Initial exports are explicitly limited to 1–60 seconds. This does not re-enable the legacy Flow autoproducer, paid generation, account automation or public publication.
- See `docs/local-media-workflow.md` for required maintained FFmpeg/FFprobe installation, source layout, UI/CLI/API instructions, evidence and limitations. Packaged decoder binaries are dev-only test fixtures, not production defaults.

## Batch 4 — exact batches, real ingestion and stale-edit protection

- Exact partial final batches, correct keyframe/non-24fps timecodes and project-aware output paths; removed asserted Pro/credit/capacity telemetry from plan data.
- Shared full image decoding between local exports and real Flow batch verification; stored per-frame global indices/hashes/dimensions/bytes. Simulation and filename-only assertions are rejected.
- Evidence-backed progress, legacy simulated-status demotion, first-gap resume selection and duplicate-index protection. A failed explicit recheck revokes known-bad old evidence.
- Atomic revision compare-and-swap for episodes and Flow plans. API returns 409 rather than silently replacing newer edits; verification cannot certify an outdated plan that changed during image inspection.
- Updated the typed CLI, plan reset/verification UI and script editor error behavior. Unsaved editor text is retained on conflicts; no automatic merging is claimed.
- See `docs/flow-verification-and-revisions.md` for exact API/CLI use, legacy plan handling and verification/revision limitations.

## Running locally

```bash
npm ci
cp .env.example .env
npm run dev
```

Default address: `http://127.0.0.1:3000`.

For a remote/preview deployment, set `HOST=0.0.0.0` and supply a randomly generated `STUDIO_OPERATOR_TOKEN` of at least 32 characters **through the environment, never source control**. Use HTTPS. Browser username is `operator` and password is the configured token; automation uses `Authorization: Bearer ...`. Remote access without a token refuses startup. Authentication is a single-operator boundary, not multi-user identity or role management. Local no-token mode trusts processes on the local machine.

The production planning API still prepares script files but does not execute them. Files are now under `data/production_root/scripts`. Run scripts only after reviewing them and supplying original assets. Their output is not automatically QC-certified. The generated visual worker intentionally exits unsuccessfully rather than creating fake frames.

## Still open — do not mark complete

1. Real supported visual-provider integration and provider-side resumable generation. Exact partial batches, real file ingestion and gap-safe evidence-backed checkpoints are implemented; these do not generate media.
2. Per-frame/provider generation resume, multi-stage workflows, automatic checkpoint retention, orphan cleanup and semantic/editorial QC. Supplied-asset local exports now support up to 15 minutes with validated segment-level retry, cancellation/recovery and measured technical QC.
3. Connect the transactional spend ledger to an operator-only approval/reconciliation service and a durable execution worker; recheck changed global caps at execution time and extend optimistic conflict detection to remaining record models.
4. Operator-controlled restore workflow, complete media archives, migration/export tooling and restore-path reconciliation. Consistent metadata backup is implemented.
5. Operator review events, rights clearance, provider capability/pricing checks and guarded private-by-default handoff.
6. Complete runtime schemas and rate/queue limits for every endpoint, plus consistent error responses.
7. Real account/credit telemetry, storage accounting, automatic retention and orphan cleanup. Explicit terminal-job video-checkpoint purge is implemented in Batch 6.
8. Audit remaining seeded/historical data and UI cost/credit/quality claims; do not rely on old verified statuses.
9. Narration generation, ducking and pulse envelopes. Supplied-audio normalization, explicit 48 kHz stereo and measured encoded-output loudness are implemented for local renders.
10. Full UI error handling, view decomposition, browser/accessibility tests, stale-state coverage and strict TypeScript rollout.
11. OS-level protection against hostile concurrent filesystem changes; current symlink checks assume the production tree is operator-controlled, not shared with malicious local users.

## Validation

Batch 2 had **58 passing tests** covering prior hardening plus legacy import, concurrent process initialization/saves, transaction rollback, abrupt process death, metadata snapshots, concurrent cap enforcement, idempotency, retained unknown effects, revocation and atomic charge-accounting rollback. The transaction/concurrency suite also passed five repeated independent runs. No paid provider call, production approval creation, public publication or production media run was performed.

Batch 3 adds real media integration tests, including 1-second and 5-second exports, playback ranges, negative input cases, cancellation/timeouts and abrupt worker recovery. The exact current count is recorded in the final validation run. All rendered media in these tests are isolated synthetic fixtures, not production deliverables.

Batch 4 validation: **83 tests passing**, including real partial-batch decoding, gap-safe checkpoints, legacy-proof rejection, stale episode/plan writes, plan replacement during verification, failed-recheck revocation and cross-project isolation. Type checking, production build and diff checks pass. Browser interactions were updated but have not been independently exercised in an automated browser session.


## Batch 5 — full-duration local exports and validated segment resume

- Raised local export bounds to 24–21,600 frames / 1–900 seconds at 24fps. Updated browser bounds, progress/reuse counters and CLI help.
- Encode/stage at most 120 PNG frames per video segment; stream audio snapshots and large-file hashes, with a 512 MiB input-audio cap. Operation deadlines scale with duration.
- Persist ownership-checked segment checkpoints. Retry fully decodes current PNGs, matches input/profile evidence, and checks cached bytes/hash, measured video properties and full decode before reuse. Changes and corruption force re-encoding. Encoder profiles bind FFmpeg version output and settings.
- Stream-copy video concatenation/mux, continuous normalized audio and complete final decode/QC. Added measured A/V start-offset checks.
- Regression tests cover unchanged reuse, corrupt cache, changed input with unaffected-segment reuse, actual worker death after a committed segment and the 21,600/21,601 boundary.
- **Executed full-duration test:** 900 seconds, 21,600 decoded frames, 180 segments; H.264/AAC, 1920×1080/24fps, 48 kHz stereo, −14.05 LUFS, −13.2 dBTP, zero measured A/V start/duration difference. Synthetic still-frame/sine fixtures only; approximately eight minutes, not a production complexity benchmark.
- Final routine validation: **88 passing tests, 1 opt-in stress test skipped**; the skipped test passed separately above. Type checking, production build and diff checks pass. No browser automation, paid execution, approvals, production-media generation or publication performed.
- Retained checkpoint variants and crash-orphan files have **no automatic cleanup/purge policy** yet. No per-frame visual-generation resume, editorial certification, rights approval or production decoder certification is claimed. See `docs/local-media-workflow.md`.


## Batch 6 — explicit, retry-safe checkpoint cleanup

- Added terminal-only `media purge-checkpoints <render-id> --json`, POST `local-renders/:jobId/purge-checkpoints`, and a confirmation-gated render-panel action. Sources, exports, job state and idempotency history are retained.
- Detach cache synchronously with a unique UUID rename while holding the SQLite lock used by retry/claim; asynchronous deletion never addresses the live cache path. Retries in other processes can safely create fresh cache during deletion.
- Persist retired tokens so deletion failures can be explicitly retried. Derived paths and UUID validation reject arbitrary paths; symlinked caches are refused.
- New tests cover queued/running refusal, project isolation, source/export/idempotency retention, repeat purge, a separate-process retry during paused deletion, persisted deletion-failure recovery and symlink rejection.
- Validation: **92 passing tests, 1 opt-in long test skipped** (the 15-minute test passed separately in Batch 5); type checks, production build, dependency audit (zero vulnerabilities) and diff checks passed. Independent build/audit and regression work ran in parallel.
- Limits: no automatic retention, broad orphan scan, media archive/restore or FFmpeg-child cleanup. A hard crash between rename and metadata commit may leave an untracked retired directory; missing cache re-encodes and cannot certify success. No browser automation, paid calls, approval creation or publication performed.


## Batch 7 — configuration compare-and-swap and settings save truthfulness

- Added atomic revision checks/increments to settings and series-bible edits. Legacy reads expose revision 0; a missing write token cannot bypass a newer revision. Series identity remains immutable; unknown fields and malformed top-level values are rejected.
- Shared injectable configuration handlers return HTTP 409 with `REVISION_CONFLICT,currentRevision`, 400 for invalid requests and 404 for a missing series.
- Settings form now submits only allowed editable fields, displays load/save failures, retains conflicting drafts and adopts returned revisions on success. Fields are disabled while saving, with project-change/unmount response guards.
- Made budget settings read-only and grant creation/revocation controls visibly disabled to match the server gates. No spending approvals or caps were created/widened.
- Five new regression tests cover independent-instance stale writes, immutable identity/project isolation, structured API responses, malformed/protected field rejection and simultaneous-process winner/conflict behavior for both documents.
- Validation: **97 passing tests, 1 opt-in long test skipped**; type checking, production build, zero-vulnerability dependency audit and diff checks pass. Full-duration media validation remains the separate Batch 5 result; it was not rerun this batch.
- See `docs/configuration-revisions.md`. Remaining work includes other record models, complete nested runtime schemas, persistent drafts/merge UX and automated browser validation. Paid execution/publication remain disabled.


## Batch 8 — research-note trust boundaries and revision checks (2026-10-30)

- Replaced ordinary research approval/verified assertions with enforced unreviewed capture at both storage and HTTP boundaries. Nonzero confidence and human-approval assertions are rejected; real-world notes default to unverified and fictional lore remains explicitly fictional.
- Added bounded shared validation for textual fields, dates, source URLs, boolean/status values, related episode identifiers and revisions. Accepted URLs use sanitized credential-free values. Known instruction signatures are rejected in text fields; this remains advisory detection, not comprehensive injection defense.
- Added atomic claim revision compare-and-swap, immutable scope/creation identity and structured 409 conflicts. New API IDs use random UUIDs; missing project writes are rejected.
- Historical approval/confidence labels are demoted on read without rewriting stored records; unsupported source links are suppressed in the read representation. No review-event service or legacy factual certification is implied.
- Research UI now submits unreviewed notes, describes URL checks as syntax checks without fetching, displays load/save failures, retains failed-submit drafts and guards stale project/URL responses. CLI capture no longer asserts unmeasured high confidence.
- Six regressions cover defaults/zero preservation, review spoofing, credential sanitization, malformed/advisory-instruction inputs, legacy demotion, storage/API conflicts and simultaneous-process winner/conflict behavior.
- Validation: clean install; **103 passing tests, 1 opt-in long test skipped**; type checks, production build, zero-vulnerability dependency audit and diff checks passed. The full-duration test was not rerun this batch. Browser changes have no automated browser validation yet.
- Guide: `docs/research-notes-and-revisions.md`. Still open: independent human review events, factual/legacy evidence audit, DNS/redirect-safe fetching if introduced, other model CAS and browser tests. No production records, spending approvals, paid calls or publication were performed.


## Batch 9 — production metadata CAS and legacy safety-gap closure (2026-10-30)

- Ran 30 independent bounded repository checks in parallel, then ordered dependent edits and regression runs. Further build/audit and test work ran independently in parallel.
- Found and corrected incomplete legacy gate coverage: removed job transition/reconciliation, autoproducer start/advance, fabricated package creation and grant create/revoke handlers. Closed the endpoints with case/trailing-slash normalization; regression coverage includes path variants. No existing grants were modified or revoked.
- Added atomic revisions to internal job, autoproducer-run and package saves. Saves return fresh records, clone input before awaiting, protect scope/creation/episode identity and reject missing referenced projects/episodes. Legacy reads expose revision 0 without rewriting metadata.
- Removed automatic fake-package creation from the YouTube UI, started local preflight checks unchecked, added errors/empty state/stale-project guards and clarified that local checkboxes cannot authorize upload. Legacy job/run mutation controls are disabled.
- Eight new storage tests cover all three models and simultaneous-process winner/conflict races; security route tests now cover the discovered gaps and path variants.
- Validation: **111 passing tests, 1 opt-in long test skipped**; type checking, production build, zero-vulnerability dependency audit and diff checks passed. No automated browser validation or full-duration re-run this batch.
- Guide: `docs/production-record-revisions.md`. Still open: project archive CAS, complete nested schemas, historical evidence audit, operator-only review/approval/reconciliation, browser tests and providers. Internal metadata CAS does not certify success/QC/rights flags or implement execution. No paid calls, production grants, production records or publication were performed.


## Batch 10 — project lifecycle, placeholder removal and deep re-audit (2026-10-30)

- Completed 50 independent bounded repository inspections in parallel, with further targeted parallel review/probes. Dependent writes/build/install/test steps were ordered; arbitrary tool counts are not assurance criteria.
- Strict project creation text validation, UUID identity/server-owned confined directory, initial revision 1 and transactional metadata initialization. Unicode display-name support and rollback regression; empty mkdir orphan is explicitly documented.
- Added project archive/unarchive atomic revision checks, strict booleans, structured HTTP 409 conflicts and nondestructive metadata behavior. Legacy reads expose revision 0 without rewriting. Archive is not a job freeze, media archive or deletion.
- Added typed CLI project show/archive/unarchive with explicit revision tokens and corrected help; exercised actual CLI in an isolated temporary working directory.
- Removed the legacy color/silence placeholder render-script endpoint, returning 501 across canonical/case/trailing-slash variants. Scene planner now embeds the real supplied-asset local render panel with selected project/episode. Example planning shots are explicitly unapproved/illustrative.
- Eight project regressions plus endpoint coverage: creation, validation, independent-instance/API conflicts, nondestructive archive, simultaneous-process archive race, actual CLI flow and transaction rollback.
- Validation: clean install, **120 passing tests, 1 opt-in long test skipped**, type checking, production build, zero-vulnerability dependency audit and diff checks passed. Browser automation and the 900-second render were not rerun this batch.
- Guides: `docs/project-lifecycle.md` and `docs/deep-re-audit-2026-10-30.md`.
- Deep re-audit records 16 open findings, separating reproduced/source-confirmed/conditional evidence. Isolated probes reproduced default consent assertions, dispatch accepting a hold after global caps were lowered, and ghost-project episode/plan writes. **These findings remain open; no claim of zero flaws or complete remediation.**
- No paid/provider requests, production approval changes, production metadata edits, media generation or publication were performed. Synthetic fixture grants existed only in temporary audit/test roots and were removed.


## Batch 11 — truthful acknowledgement, dispatch policy and scope guards (2026-10-30)

- Fresh settings no longer assert consent or provider capability dates. Versioned operator-settings acknowledgement and withdrawal events are generated server-side and committed atomically with settings revisions. Legacy unsupported assertions are demoted without rewriting imported metadata.
- Reserve/dispatch share persisted-cap checks. Run/episode caps are project-scoped; monthly cap is root-wide UTC, including uncertain holds and conservative undated history. Rejecting dispatch preserves the existing hold.
- Episode/Flow writes require real matching projects; plans require a matching real episode. Checks occur inside document write transactions, without ghost directory creation.
- Validation: clean install, lint, **133 passed / 1 long test skipped / 0 failed**, production build, npm audit **0 vulnerabilities**, and diff checks passed. Added 13 regressions including rollback, UTC history and independent-process policy drift.
- F01/F02 reproduced defects remediated; F03 phantom-write defect remediated but broader series/model acceptance remains open. F04–F16 are not closed. No paid execution, production grant changes, publication, browser validation or new long-media run.
- Contract, limitations and follow-up: `docs/consent-and-dispatch-policy.md`; historical evidence/current dispositions: `docs/deep-re-audit-2026-10-30.md`.


## Batch 12 — retire legacy media scripts (2026-10-30)

- Removed stitch/procedural-audio/master script bodies; deprecated core exports throw without returning scripts. Removed all five legacy Flow artifact/preparation handlers and block their routes with 501 (including autoworker GET and autoproduce).
- CLI stitch rejects stdout/save modes; help points to real supplied-asset media enqueue/work. Removed UI script panels/automatic script fetches; verified local rendering remains available.
- F04 addressed by retirement; F05's identified global writers removed rather than implementing a replacement export feature. Previously exported files are not removed or verified and must not be treated as safe current outputs.
- Two new regressions cover two-project API case/method/trailing-slash variants and actual isolated CLI rejection with no script files. Three legacy generator tests now verify explicit retirement.
- Full suite **135 passed, 1 long test skipped, 0 failed**; type checking, build, audit (0 vulnerabilities), diff checks passed; 33 targeted Flow/hardening/security tests passed.
- Remaining F03/F06–F16 are not closed. No provider/publication integration, production data operations, browser/platform validation or long-media rerun.


## Batch 13 — atomic arc drafts and boundary/recovery fixes (2026-10-30)

- F06: strict shared arc/count schema and required idempotency key; real matching project/series, high-water unique allocation, all-or-nothing card/request persistence and durable replay snapshots. CLI now persists actual cards; UI retains a request key across failed attempts in the mounted view and describes results as drafts, not verified stories.
- Episode/plan writes snapshot inputs before awaiting, reject nonzero new-record revisions; episode active-series guard and corrected CLI series lookup. These do not complete all F03/F07 model schemas or legacy reconciliation.
- Flow GET plan/checkpoint no longer creates a plan; explicit POST required, no-store headers and read-only regression. Initial legacy imports/diagnostic writes remain F11 limitations.
- Nested cleanup finally releases controllers/timers and attempts scratch cleanup despite export-removal errors. Fault-injection tests pass; ownership leases/orphans remain F08 work.
- Bounded frame reads stop post-stat growth at the byte ceiling and close handles. Tests verify decode/hash equivalence, oversize and growth rejection. Full disk/resource assurance remains F09 work.
- Full validation: **147 passed, 1 opt-in long test skipped, 0 failed**, lint/build/audit/diff checks passed, zero known npm vulnerabilities. Added 12 tests including independent processes, rollback and actual CLI execution. No browser/Windows/provider/publication or new long-media run.
- F06 addressed; other partially improved findings stay open. Contract and remaining limits: `docs/atomic-arc-expansion.md` and the updated deep audit.


## Batch 14 — original story upgrade, truthful editorial evidence and README (2026-10-30)

- Rewrote the original pilot around conflicting obligations, informed rescue choices, an irreversible loss and a planted causal cliffhanger. Delivered the full reading copy and craft workflow. Nine beats, 1,581 spoken words / estimated 10:54 at 145 WPM; not a complete 15-minute recording or independently approved script.
- Fresh seeds use unapproved draft status, calculated count/reading estimates and no fabricated measured voice/reviewer. Existing workspaces are not overwritten. Editor saves no longer record estimated reading time as measured voice.
- Added bounded brief-aware local nine-beat outline scaffolds and advisory craft checks in the Script Editor/CLI. No-key output is not called verified; configured paid generation remains disabled. Local review markers do not imply independent rights/spend/publication approval.
- Added root README with setup, actual capabilities, environment/access, CLI, media workflow, story adoption and pending limitations. Bootstrap now checks required Node version, runs the full test command and avoids key/readiness overclaims; only shell syntax was checked, not production bootstrap execution.
- Partial F15: final JSON error boundary for malformed/oversized/uncaught API errors, isolated regression and no internal message leakage. Rate limits/session/identity and remaining route consistency are still pending.
- Full validation: **155 passed, 1 long test skipped, 0 failed**, lint/build/audit/diff and bootstrap syntax pass; zero known npm vulnerabilities. Eight new tests. No browser/Windows/provider/production migration/publication or new long-media run.


## Batch 15 — 50-way review and verified HTTP playback (2026-10-30)

- Fifty independent read-only repository checks issued in parallel; follow-up edits and validation ordered. Recorded actual scope/results in `docs/parallel-review-batch15.md`.
- HTTP playback now hashes open export versions against QC SHA-256, caches 32 version fingerprints and coalesces concurrent checks (two distinct pending hashes max). Streams use the checked descriptor; changed/truncated/replaced bytes fail closed without mutating historical QC.
- Range/HEAD/If-Range/416 handling, safe handle closure and visible browser playback error. Quiescent operator-controlled filesystem assumption remains; in-place hostile writes during streams and comprehensive request resource limits are not solved.
- Historical inspector abort/reset/error visibility and script-save generation/submission guards; local review message truthfulness. These are type/build/source checked, not browser-automated.
- Twelve new regressions, including actual render/HTTP mutation and restoration. Clean install, lint, **167 passed / 1 long skipped / 0 failed**, build/audit/diff pass; zero known npm vulnerabilities. No provider/publication/production data changes, browser/Windows/hostile-filesystem or new long-media run.
- README/media guide/audit updated; full contract in `docs/verified-playback.md`. Remaining findings are not all closed.


## PR handoff — CI exclusion authorized

The operator authorized excluding active CI after GitHub rejected workflow-file pushes. The proposed workflow is preserved as `docs/ci-workflow.example.yml`, not under `.github/workflows/`. Earlier CI descriptions record implementation intent; this PR does **not** activate GitHub Actions validation. Previously recorded local test/build/audit results are unchanged. An authorized maintainer must install the reviewed workflow separately. The two unpublished commits were consolidated to remove the restricted workflow path from pushed history while retaining all other changes.

## Independent audit, skill research and follow-up fixes (2026-10-30)

- Created the [baseline independent audit](independent-audit-2026-10-30.md) and [fresh research-informed audit](research-audit-and-remediation-2026-10-30.md); updated the requirements ledger and marked aspirational specifications/historical blueprints as such. These are point-in-time reviews, not claims of complete security or production certification.
- Added 20 repository-specific and 12 pinned upstream OpenCode skills, license texts and digest manifest. An isolated OpenCode 1.19.5 runtime discovered and individually loaded **32/32** through its native skill tool; config and effective agent permissions were inspected. No model/provider, production data or upstream installer was used. Skills/permission globs are not an OS sandbox, and template queries are unvalidated. See [skill catalog](../.opencode/skills/README.md).
- Reproduced and fixed episode duplication collisions, stale/incorrect series assumptions, unsupported readiness claims, non-project-scoped story/Flow scaffolds, mutable historical script versions and related UI/API/CLI mismatches. Server-owned allocation now accounts for public and database-ID-shaped legacy aliases; reconciliation is preview-first with explicit apply/undo, metadata backup and history. No actual reconciliation or production migration was performed.
- Added Flow source-episode revision provenance and compare-and-swap at verification; stale/unknown plans cannot produce current checkpoints. API/UI summary and batch pagination reduce transferred data, not server-side full-plan parsing. Existing plans remain untouched until deliberately replaced.
- Retired misleading Video Essay/Flow script exports, blocked the browser pseudo-CLI and deleted dead guarded handlers. Existing externally exported scripts cannot be recalled. Paid generation, spend-grant creation, independent approvals and publishing remain disabled.
- Fixed stranded worker claims on setup errors, conservative same-instance recovery after terminal-write failure, configured media binary probes and diagnostic honesty. A predictable Doctor write probe was reproduced overwriting an isolated symlink target and colliding under concurrency; unique exclusive probes and visible cleanup failures now have tests. Hostile ancestor/filesystem races, orphan/lease recovery and full backup/restore remain open.
- Added Fetch Metadata defense for unsafe cross-site/same-site browser writes even when Origin is absent; non-browser clients can omit the header, so this is not complete CSRF or multi-user hardening. Research URL and pattern checks are now explicitly advisory; they do not authorize network fetching or certify facts.
- Added isolated Chromium smoke covering creation, duplication, advisory checks, script metadata preservation, planning, failed verification, stale provenance, retired pseudo-CLI, research labels, project isolation and mobile navigation including expanded state, background inertness, focus containment/restoration, Escape, close, backdrop and desktop resizing; no external page requests were observed in that run. This is not a complete accessibility/device review. Added deterministic property-style allocation and batch-conservation checks without a new property-test dependency.
- Final validation: Node 22.22.3; `npm run lint` passed; `npm test` **214 passed / 1 opt-in long test skipped / 0 failed** (215 total); production build and isolated Chromium smoke passed; `npm audit --audit-level=high` reported **0 vulnerabilities**; upstream skill/license digests and `git diff --check` passed. Local links in the changed main docs resolve. The 900-second fixture is opt-in, and no new long render, Windows run, maintained-native-binary certification, production restore, provider execution or publication was performed. `npm audit signatures` previously failed `ECONNRESET` fetching Sigstore metadata; registry integrity is not independent signature verification.


## Batch 17 — offline backup, safe initialization and CI preparation (2026-10-30)

- Added an operator-attested offline metadata-plus-files backup with a versioned manifest, SQLite `VACUUM INTO`, per-file SHA-256, independent verification and a new isolated staged restore. It never overwrites or promotes live data. The operator must stop all writers and retain independent copies; the same-disk bundle is not disaster redundancy. See [backup and restore](backup-and-restore.md).
- Added isolated recovery tests for WAL data, synthetic asset/export preservation, a real one-second synthetic render through staged hash-verified playback, recovery into an empty root, nonterminal jobs, path/symlink/special-file validation, damaged or incomplete bundles, mutation, simulated ENOSPC, cleanup errors and killed backup/restore processes. No production records or assets were read or changed.
- Reproduced default-project seed overwriting existing SQLite documents when the corresponding directory was missing. Startup now fails closed if any stored default-project document exists; symlinked `projects` and `backups` roots are rejected. `server/storageInitializationSafety.test.ts` verifies the defect and preservation in isolated fixtures.
- Reproduced unexpected storage-error detail leakage from a legacy read endpoint; eleven read handlers now return a bounded, non-cached generic 500 response. Mutation/validation error classification remains incomplete.
- Added a GitHub Actions validation workflow with read-only token permissions, disabled credential persistence/caching, pinned action commits, Linux Node 22.13/22.22, tests/build/digests and a Chromium smoke step. YAML and shell blocks were locally checked; it is uncommitted and has **not** run on GitHub. Authorized workflow push/review and actual CI results remain necessary. Hosted Actions minutes and browser/system downloads may apply.
- Final local validation: **240 passed / 1 opt-in long render skipped / 0 failed (241 total)** on Node 22.22.3 and, using the same installed dependencies, on Node 22.13.0. Lint, production build, isolated Chromium smoke, `npm audit --audit-level=high` (0 reported vulnerabilities), skill digests, changed-document links and `git diff --check` passed. The Node 22.13 binary was temporarily downloaded with npm SRI checked; an independent signature verification was not established.
- The backup confirmation is not an exclusive lock or proof of an atomic snapshot. No independent storage copy, full-size production recovery, power-loss test, live promotion/rollback, native FFmpeg certification, new long render, publishing or paid provider execution was performed.

## Batch 18 — worker identity/recovery and API boundaries (2026-10-30)

- Reproduced a cross-project render-ID ambiguity and a scoped-read/mutation race in disposable records. All local-render identity reads now reject duplicate/invalid IDs globally, and changes recheck both project and ID within the SQLite transaction. An isolated same-attempt owner replacement also exposed a stale timestamp rewrite and file cleanup; stale transitions now avoid writes, and cleanup checks owner/attempt before removal. The filesystem check/use remains non-atomic against hostile concurrent changes. No stored data was automatically repaired.
- Reproduced a dead worker after server startup leaving the shared queue blocked. The server now periodically checks for dead claims, interrupts eligible claims without retrying them, and avoids no-op metadata writes and unnecessary idle writer transactions. On Linux, new claims record boot/PID-namespace identity; cross-process recovery requires matching host/domain, a valid token and an absent PID, rechecked inside the transaction. Live/reused PIDs, permission failures, foreign/unknown domains and legacy records are not taken over. Same-instance stopped-claim recovery remains supported. `server/serverWorkerRecovery.test.ts` exercises the actual running server; `server/localMediaReliability.test.ts` covers races, three competing recovery processes and failed writes.
- Local-render HTTP responses now project jobs without ownership details, checkpoint paths, retirement tokens or raw worker errors, and use fixed typed public failures. The UI uses a retirement count and directs operators to local CLI diagnostics. Flow routes distinguish typed validation/conflicts and missing/corrupt frames from unexpected internal failures without reflecting filesystem paths. Regressions inject forged codes, sensitive fixture messages and permission/storage failures.
- Closed the reproduced Flow recheck ordering gap by committing old-evidence revocation before frame inspection, then committing fresh proof separately. An initial write error reads no frames and may leave old evidence or an already committed revocation. Failures before the final commit leave that revision pending unless another writer commits a newer plan; an error after the final commit can leave fresh evidence stored. Tests exercise before/after-commit errors, a killed recheck process, competing rechecks and plan replacement at both boundaries; callers must reload after ambiguous errors. This adds a revision and write on successful rechecks and does not continuously monitor later asset changes. At that stage, other mutation/validation routes still exposed some raw errors; Batch 19 addresses the exercised handlers. Legacy/non-Linux/foreign worker claims may require operator investigation, and no automatic ambiguous-claim repair, distributed lease or orphan cleanup was added.
- Final local validation on Node **22.22.3** and **22.13.0** (same installed dependencies): **266 passed / 1 opt-in long render skipped / 0 failed** (267 total) on each. Lint, production build, isolated Chromium smoke including a missing-frame warning and failed render, npm advisory audit (0 reported vulnerabilities), upstream skill hashes, documentation links and `git diff --check` passed. The browser used temporary libraries and disabled Chromium sandboxing in this container. Hosted CI, Windows/macOS, maintained native binaries, a new 900-second render and production readiness remain unverified. No production data, paid generation, approval or publication was changed.

## Batch 19 — mutation error boundaries and validated input snapshots (2026-10-30)

- Reproduced raw storage, adapter and conflict diagnostic exposure, forged conflict-code classification and missing no-store headers in disposable API fixtures. Project creation/archive, episode creation/duplication/edit/check, arc expansion, settings, series, research and outline handlers now use fixed public request/conflict messages and generic unexpected errors; tested body/identifier validation also returns fixed no-store failures. Transactional rollback regressions cover injected episode and settings-event write failures. A generic 500 is not a promise that every mutation had no effect: inspect state before retrying.
- Reproduced a same-process settings input changing after validation and before an asynchronous write, including the possibility of adding a protected field. Settings, series and research now snapshot mutable inputs before validation/persistence. Tests mutate nested and protected caller fields and check persisted data. This does not demonstrate a remote HTTP exploit or defend against independently privileged local writers, and it is not complete nested schema validation.
- Preserved actionable known validation/immutable-state and typed revision/idempotency conflict responses, local diagnostic messages, advisory episode checks and the disabled paid/provider paths. A Chromium reproduction also exposed stale verified badges when a recheck was followed by a failed plan reload; the UI now hides old evidence and blocks plan changes until state is known, and a synthetic-frame regression exercises recovery. Successful response data and untested paths still require a broader privacy review; rate limits, user identity and full deployment hardening remain open. Historical checked-off project tasks are not evidence of current completion, and the universal definition-of-done list is now explicitly unchecked.
- Final local validation on Node **22.22.3** and **22.13.0**, using the same installed dependencies: **277 passed / 1 opt-in long render skipped / 0 failed** (278 total) on each. TypeScript lint, production build, isolated Chromium smoke, npm advisory audit (0 reported vulnerabilities), skill hashes, workflow YAML parsing, documentation links and `git diff --check` passed. Chromium ran without its sandbox in this container. Hosted CI, a new long-render test, platform/native-binary validation, production restore and deployment security remain unverified; no production data, paid generation, approval or publication was changed.

## Batch 20 — response privacy, legacy preservation and truthful settings (2026-10-30)

- Isolated HTTP fixtures reproduced private provider/nested settings fields and local paths in successful settings responses, and local paths/unknown fields in project responses. Settings GET/PUT and project list/create/archive now use validated allowlists and `no-store`; raw local/CLI data is retained. Intended display text and other API responses remain outside this guarantee. Malformed project values and settings revisions fail closed; unsupported currency, invalid caps and invalid timezone are unavailable rather than invented.
- A settings save was persisting the demoted provider read view, changing unrelated legacy provider fields. It now writes the raw merged settings and returns the matching read view from the same transaction; tests preserve synthetic provider tokens, status and historical dates without printing them to HTTP. Project list/get also reject a stored project identity that differs from its directory. Archive preflights the public shape and retains transactional revision checks; lost responses and independently privileged writes can still cause ambiguity.
- Chromium reproduced zero caps rendered as default values; inputs now show zero accurately, missing values as unavailable, and a missing timezone does not become UTC. The isolated browser smoke also exercises failed/lost Flow recheck and replacement responses, recovery and stale provenance. These scenarios do not establish complete accessibility or all possible races.
- Before the revision-exhaustion follow-up below, local validation on Node **22.22.3** and **22.13.0**, using the same installed dependencies, yielded **284 passed / 1 opt-in long render skipped / 0 failed** (285 total) on each. TypeScript lint, production build, isolated Chromium smoke, npm advisory audit (0 vulnerabilities), upstream skill hashes, workflow YAML parsing, 43 local documentation links, shell syntax and `git diff --check` passed. Chromium ran without its sandbox. Hosted CI, Windows/macOS and maintained media binaries, a fresh long render, live restore, overall response privacy and deployment security remain unverified. No production data, spend approvals, provider execution or publication was changed.

## Batch 21 — revision exhaustion and fail-closed reads (2026-10-30)

- Reproduced a settings or project write at `Number.MAX_SAFE_INTEGER` committing an unsafe revision and reporting an HTTP 500 after the commit; settings could also append a notice event. The exercised project, settings, series, episode, Flow-plan, research and production-record writes now reject an unsafe next revision within their transaction. They do not automatically reset or repair exhausted data. Settings/project HTTP reads also distinguish an absent legacy revision from malformed `null`; malformed records remain unchanged and fail closed.
- Isolated boundary tests exercise the last valid increment, rejected HTTP writes and notice-event preservation, stored/caller snapshots, and an already-verified Flow recheck that uses the last safe revision to revoke old evidence but cannot commit new proof. The latter correctly leaves the batch pending. This does not prove all other record counters, all legacy schemas or externally privileged writes safe.
- Final local validation on Node **22.22.3** and **22.13.0**, using the same installed dependencies: **290 passed / 1 opt-in long render skipped / 0 failed** (291 total) on each. TypeScript lint, production build, isolated Chromium smoke, npm advisory audit (0 vulnerabilities), skill hashes, workflow YAML parsing, 43 local documentation links, shell syntax and `git diff --check` passed. Chromium ran without its sandbox; hosted CI, Windows/macOS, maintained media binaries, a fresh long render, live restore, overall response privacy and deployment security remain unverified. No production data, spend approvals, provider execution or publication was changed.

## Batch 22 — production-record read privacy (2026-10-30)

- Reproduced raw production-record listings reaching the browser: job logs with raw stderr and nested `details`, external-operation telemetry (`idempotencyKey`, `modelOrRoute`, `providerRequestId`, `reconciliationEvidence`), blocker/remediation free text, unsafe or escaping artifact paths, YouTube package filesystem paths with raw ffprobe status/QC issue text (JSON-dumped wholesale by the package view), autoproduce output/blocker paths and stage details, and unknown legacy fields on grants. None of these reads sent `Cache-Control: no-store`.
- Jobs, YouTube packages, autoproduce runs and spend grants now pass through explicit browser-safe projections (`server/lib/publicReads.ts`): filesystem paths become presence flags, artifact paths survive only when verifiably relative, digests only when well-formed SHA-256, log/diagnostic free text is replaced with fixed operator-safe statements, external-operation telemetry is reduced to status flags the UI needs, and unknown fields never serialize. Display enums map unknown stored values to the most cautious option (for example an unrecognized external-operation state renders as `unknown_external_effect`, an unrecognized audience as `unreviewed`, unknown target privacy as `private`). Malformed identifiers, revisions, money values or required dates fail the whole read closed with a generic no-store error instead of fabricating values or leaking contents. Stored raw records are not modified.
- Every project read endpoint now sends `Cache-Control: no-store`, including document reads and diagnostics. Document-content reads (series, episodes, research) still return stored records as the editing surface; projecting them requires proving write-path round-trip preservation of legacy fields first and remains open.
- Browser copy now states what the projection withholds (job log text, package paths and raw QC text) instead of disclaiming that redaction is unguaranteed; the affected views type against the public projection types.
- Final local validation on Node **22.22.3** and **22.13.0**, using the same installed dependencies: **295 passed / 1 opt-in long render skipped / 0 failed** (296 total) on each. TypeScript lint, production build, isolated Chromium smoke (Chromium 138.0.7204.0 with bundled AL2023 libraries, without its sandbox), npm advisory audit (0 vulnerabilities), 44 upstream skill hashes, workflow YAML parsing, 46 local documentation links, shell syntax and `git diff --check` passed; no tracked production data changed. Hosted CI, Windows/macOS, maintained media binaries, a fresh long render, live restore, document-read projection and deployment security remain unverified. No production data, spend approvals, provider execution or publication was changed.

## Batch 23 — document read/write privacy and legacy preservation (2026-10-30)

- Reproduced document-content leaks: episode listings exposed unknown legacy keys at every nesting level (including historical storyboard caches), series reads and series-PUT responses exposed stored extras, research listings exposed unreviewed claim extras, and an episode save round-trip of a projected record was rejected as a historical rewrite because legacy version extras no longer matched. Episode edits also accepted and persisted arbitrary unknown caller fields, and replacing a series array silently discarded stored item-level legacy keys.
- Episodes, series bibles and research claims now share one runtime schema walker (`server/lib/documentSchema.ts`) used three ways: HTTP reads project only modeled keys after shape validation (malformed known structure fails the read closed with a generic error), HTTP writes reject unknown keys at any depth, and trusted storage writes preserve stored-only legacy keys recursively — including per-item extras matched by id/version number — so a browser round-trip of a projected record can never delete historical data. Legacy script versions without `wordCount` stay without it; the API never fabricates one.
- Episode create/edit/duplicate/arc-expansion, series-PUT and research-POST success responses use the same projections as reads. Research claim reads and saves return the same unreviewed view (no approval evidence, zero confidence, disallowed verification labels normalized); malformed claims fail reads closed instead of leaking. Nested series items (rules/characters/locations/factions, visual bible) are validated on update and their stored extras survive array replacement.
- This is data minimization, not multi-tenant isolation: stored raw records keep legacy keys on disk, provider/CLI callers may still carry them, and document string content is user data by design. Remaining open: episode/series write-side policy caps for fields the HTTP model does not range-check, unknown-key rejection for trusted internal callers, and per-field review of every remaining successful response shape.
- Final local validation on Node **22.22.3** and **22.13.0**, using the same installed dependencies: **299 passed / 1 opt-in long render skipped / 0 failed** (300 total) on each. TypeScript lint, production build, isolated Chromium smoke (Chromium 138.0.7204.0 with bundled AL2023 libraries, without its sandbox), npm advisory audit (0 vulnerabilities), 44 upstream skill hashes, workflow YAML parsing, 46 local documentation links, shell syntax and `git diff --check` passed; no tracked production data changed. Hosted CI, Windows/macOS, maintained media binaries, a fresh long render, live restore and deployment security remain unverified. No production data, spend approvals, provider execution or publication was changed.

### Batch 24 — 2026-10-30 — Operator-attested adjudication of incomparable worker claims

Red `server/workerAdjudication.test.ts` (6 tests) drove `LocalMediaService.adjudicateClaim` and the CLI-only `studio media
adjudicate <id> --confirm-stopped --attest-isolated --note <text>` path. An internal `claimAssessment` classifies every
running claim as `recoverable` / `live` / `incomparable`; adjudication refuses unless the claim is `running` AND
`incomparable` (`RENDER_ADJUDICATION_USE_RECOVERY` directs provably-dead comparable claims to `media recover`,
`RENDER_ADJUDICATION_WORKER_LIVE` refuses live owners, `RENDER_ADJUDICATION_NOT_APPLICABLE` refuses non-running jobs).
Both attestations must be literally `true` and the note 1–2000 characters
(`RENDER_ADJUDICATION_ATTESTATION_REQUIRED` / `RENDER_ADJUDICATION_NOTE_REQUIRED`). Success appends an immutable
adjudication record preserving the FULL prior claim (pid/host/token/boot/namespace) with timestamp, attestation flags and
note, then sets `interrupted` with the fixed error "Worker claim adjudicated by operator attestation; no artifact
verification was performed by this resolution." — unblocking the existing `retry()`. Limits: no HTTP route, no work start,
no artifact/checkpoint deletion, no manifest certification, no claim authentication; `publicMedia` projects only
`{adjudicatedAt, note}` per history entry. CLI fixtures run the real binary against an imported legacy jobs file; the
attestation decision is a human evidence step the tool cannot make.

Evidence: worker-adjudication 6/6 plus the localMedia/recovery/apiSafety/verifiedMedia suites 60 passed / 1 skipped /
0 failed; lint clean. Hosted CI, real incident use, Windows/macOS, maintained native FFmpeg validation, a fresh long
render, production restore, provider execution, independent approvals and publication remain incomplete.

### Batch 25 — 2026-10-30 — Document write-side policy caps and trusted-caller unknown-key rejection

Red `server/documentWritePolicy.test.ts` (10 tests: 8 red, 2 preservation guards) closed the Batch 23 open items
"episode/series write-side policy caps" and "unknown-key rejection for trusted internal callers".
(1) `documentSchema.ts` numeric nodes now carry documented `max` ceilings enforced symmetrically on reads and writes:
counters (season/episode/beat/version numbers, activeScriptVersionIndex) ≤ 1,000,000; durations/targetSeconds ≤ 1,000,000
seconds; word counts ≤ 10,000,000; targetWpm ≤ 1,000 at the schema layer (handlers keep the 80–220 pacing policy);
character age ≤ 10,000; targetRuntimeMinutes ≤ 10,000; revision tokens remain safe-integer domain. Absurd stored legacy
values (e.g. arcNumber 1e300) now fail reads closed with a generic error instead of being serialized to browsers.
Research `confidenceScore` stays deliberately range-less in the schema: writes must submit zero (existing
`validateResearchClaim`) and reads normalize any stored legacy value to the single unreviewed view — a guard test keeps
that behavior from regressing.
(2) `saveEpisode` now strict-validates every caller's document (`validateDocument`, unknown keys rejected with
`EPISODE_INVALID_EDIT` via `requestValidationError` keeping the offending field name), bounds
`activeScriptVersionIndex` (`EPISODE_INVALID_VERSIONS`) and applies the 80–220 pacing policy to NEW script versions
(`EPISODE_INVALID_PACING`); stored history is never re-judged. Stored-only legacy keys still survive edits via
`mergeStoredExtras`, restored exclusively from the stored record — no caller can invent model-less "legacy" data. The
dead `validateDocumentLenient` escape hatch was removed and the CLI edit commands (`episode update-script`,
`episode add-beat`) now project stored episodes to model-clean documents before saving.
(3) The inline `/pacing/calculate` route moved to `server/pacingHandler.ts` and range-checks `targetWpm` (80–220) and
text size (≤200,000 chars) instead of feeding arbitrary values into duration math that JSON would serialize as `null`.
Remaining open from the review: per-field review of every remaining successful response shape (Flow plan/batches/
checkpoint/ingest, doctor diagnostics, outline and advisory check responses), continuous post-verification asset changes
and concurrency limits.

Evidence: documentWritePolicy 10/10 plus episode/mutation/arc/reconciliation/allocation 53/53 and document/research/
config/revision/transactions/scope/audit 35/35 focused; lint clean. Full dual-Node suites and the standing battery are
recorded below. Hosted CI, Windows/macOS, maintained native FFmpeg validation, a fresh long render, production restore,
provider execution, independent approvals and publication remain incomplete.
