# Audit remediation progress — 2026-10-29

This tracks fifteen remediation batches, **not completion of the full audit**.

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

### Storage and backup notes

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
