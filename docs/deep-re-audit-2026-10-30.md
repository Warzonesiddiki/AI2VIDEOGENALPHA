# Ternfall Studio — deep follow-up audit

**Date:** 2026-10-30
**Checkout:** `Warzonesiddiki/AI2VIDEOGENALPHA`, branch `arena/33152e57-ai2videogenalpha`
**Scope:** cumulative uncommitted remediation through Batch 15, not just the original main-branch code. Line locations below refer to the inspected working tree and may move as remediation continues.

## 1. Executive assessment

The application has materially stronger local storage, access checks, conflict detection and measured supplied-asset rendering than the original audited version. It is **not ready to be described as a complete, independently verified, autonomous production/publishing system**. Passing tests establish specific invariants; they do not prove a flaw-free product.

The most consequential remaining issues are trust/permission semantics, inconsistent storage preconditions, legacy generated-script behavior and gaps in recovery/browser validation. Paid generation and public publication must remain disabled until their prerequisite services and adversarial tests exist.

### Evidence categories

- **Reproduced:** executed in an isolated temporary root using public storage APIs or an isolated CLI/API fixture. No production metadata was edited.
- **Source-confirmed:** reachable logic or missing checks inspected directly; the full failure scenario was not exercised.
- **Conditional risk:** relevant only under an explicit environment, future integration, crash or filesystem mutation assumption. Not an exploit claim.

### What changed during this review

| Item | Evidence | Resolution |
|---|---|---|
| Project archive boolean coercion and stale writes | Source inspection plus new isolated API/storage/process tests | Fixed in Batch 10: strict booleans, atomic revisions, structured HTTP 409 |
| Weak project creation identity/input boundaries | Source inspection plus new concurrent creation/rollback tests | Fixed in Batch 10: bounded text, UUID identities, confined server-owned directories |
| Color/silence placeholder render script advertised as a composite | Source-confirmed legacy handler | Removed and closed with HTTP 501; canonical/case/trailing-slash regressions pass |
| Scene planner hardcoded rendering to the default project | Source-confirmed | Replaced with the actual local-render panel using selected project/episode |

Earlier reports overstated safety-gate coverage. Batch 9 corrected job/package/grant mutation gaps; this review found the separate placeholder script route. No claim that every legacy path is now fully audited is justified.

## 2. Method, safety and exclusions

The preceding review issued 50 bounded independent repository checks in parallel. This follow-up used additional parallel source inspections, isolated fixture probes, typed CLI integration, process races, type checking, tests, production builds and dependency auditing. Dependent edits and validation were ordered. Large arbitrary call counts were not treated as an acceptance criterion for correctness.

Reviewed areas: root/path confinement, operator access, routing/gates, SQLite transaction boundaries, project lifecycle, episode/plan/research writes, internal production metadata, spend reservations/dispatch, local media snapshots/encoding/checkpoints/QC/playback, generated shell scripts, browser request state, CI and documentation accuracy.

Not performed: paid provider calls; approval creation or widening in production; public/private platform uploads; production media generation; production metadata migration; an authenticated deployment penetration test; Windows execution; OS-level malicious-user filesystem race testing; automated browser/accessibility testing; a new 900-second render run. The earlier Batch 5 900-second fixture result is historical evidence, not a new result from this review. Native decoder maintenance is not certified by npm audit.

All dynamic approval/spend probes below used explicitly synthetic grants inside temporary test roots. The spend service has no network capability, and none was invoked indirectly. Temporary roots were removed after probes.

## 3. Prioritized findings and current disposition

| ID | Priority | Evidence | Finding / next requirement |
|---|---|---|---|
| F01 | High before provider integration | Reproduced; remediated Batch 11 | Fresh/legacy consent now requires a versioned server-recorded acknowledgement; no seeded capability dates |
| F02 | High before enabling spend | Reproduced; remediated Batch 11 | Reserve and dispatch share current-cap validation; root-wide UTC monthly exposure |
| F03 | High data-integrity priority | Reproduced; partially remediated Batch 11 | Ghost-project/episode writes rejected; broader linked-series/model invariants remain open under F07 |
| F04 | High before generated-script execution is supported | Source-confirmed; retired Batch 12 | Legacy media-script bodies removed; API/CLI exports blocked; verified local worker retained |
| F05 | Medium | Source-confirmed; writers removed Batch 12 | All identified global Flow script writers removed; old exports are not deleted or validated |
| F06 | Medium | Source-confirmed; remediated Batch 13 | Shared strict inputs, atomic high-water allocation and durable idempotent batches; API/CLI regressions |
| F07 | Medium | Source-confirmed / conditional | Creation/snapshot/update preconditions are inconsistent across metadata models |
| F08 | Medium operational | Source-confirmed / conditional | Worker death, cleanup failure and PID reuse do not have a complete recovery protocol |
| F09 | Medium operational | Source-confirmed / conditional | Scratch preflight is an estimate, not a capacity reservation or worst-case peak bound |
| F10 | Medium under post-export edits | Reproduced/regression-tested; scoped fix Batch 15 | HTTP playback checks current bytes with a bounded version cache and serves the checked descriptor; hostile in-place streaming mutation remains conditional |
| F11 | Medium | Source-confirmed | GET requests still have metadata/filesystem side effects |
| F12 | Medium | Source-confirmed | Browser error/stale-response coverage is incomplete; no browser automation |
| F13 | Medium before network fetching | Source-confirmed / conditional | Research URL validation is not DNS/redirect-safe fetch authorization |
| F14 | Medium operational | Source-confirmed | Metadata backup is not a complete media/restore solution |
| F15 | Medium before wider deployment | Source-confirmed | Single-operator access lacks multi-user identity/rate controls and a consistent API error boundary |
| F16 | Medium truthfulness / Low build assurance | Source-confirmed | Historical/seeded assertions and partial schemas remain; build/audit coverage is not full assurance |

Severity reflects the current local-first, operator-controlled environment. Future paid, multi-user or unattended deployment raises several risks. No network-spend or publication exploit was demonstrated.

## 4. Reproduced findings (historical probes and remediation)

The probes below describe the pre-Batch-11 defects, not current behavior. Preserve them as evidence of the original failures. Current dispositions follow each acceptance criterion.

### F01 — fresh settings assert consent without an action

**Evidence:** `server/storage.ts` initialization contains `dataNoticeAccepted: true`, `noticeAcceptedDate: '2026-10-29'`, and provider model `checkedDate` literals. A brand-new temporary root returned these exact values:

```json
{"dataNoticeAccepted":true,"noticeAcceptedDate":"2026-10-29","imageProvider":{"provider":"gemini_nano","modelId":"gemini-nano-banana-2.1","checkedDate":"2026-10-29"}}
```

This is a statement about local defaults, not evidence of an actual operator accepting disclosure or a provider capability check. The settings update path allows changing the consent boolean but does not create a durable versioned consent event or consistently reconcile that historic date.

**Impact:** future provider integration could confuse seeded/default state with permission to transmit content. Current paid calls remain disabled, so this probe did not transmit data.

**Acceptance:** default consent false/absent; no fabricated acceptance/check date; explicit operator action tied to notice version/timestamp; conservative treatment of legacy defaults; provider capability status remains unverified until actually checked. Tests must distinguish legacy asserted values from new consent evidence.

**Batch 11 disposition:** the reproduced default/legacy consent defect is remediated. Fresh acceptance is false, provider configs are empty, and unsupported legacy consent/check dates are demoted in the read view without rewriting source records. An explicit current-version acknowledgement appends a server-timestamped operator-settings event transactionally with revisioned settings. Withdrawal preserves history; conflicts or failed writes create no event. This is not independent proof of human identity, provider capability, spend approval, rights or publication permission (F15/F16 remain open).

### F02 — dispatch does not recheck lowered global configuration caps

**Evidence:** `server/lib/spendLedger.ts` reads `settings.budgetCaps` during `reserve`. Dispatch rechecks grant expiry/revocation/scope/ceiling but not the current settings caps.

**Executed isolated sequence:** create a synthetic fixture grant; reserve USD 2 under the initial caps; replace fixture settings with all three caps set to USD 0; request the internal transition to `dispatched`.

```json
{"state":"dispatched","currentCapUsd":0,"heldUsd":2,"networkCalled":false}
```

**Impact:** dispatch-time authorization becomes stale if caps change after reservation. The existing service has no provider connection, and no paid request occurred. Settings PUT currently prohibits budget editing, but internal/configuration/migration changes can still alter persisted caps; future operator cap controls must not expose this gap.

**Acceptance:** reread and validate current caps atomically at dispatch, account for existing exposure and this hold without double counting, define project-versus-global cap scope explicitly, keep uncertain exposure held, and test lower-cap/zero-cap/concurrent-dispatch/month-boundary cases. Over-cap dispatch must leave the hold reserved rather than release it as if no obligation exists.

**Batch 11 disposition:** the reproduced stale-cap defect is remediated. Reserve and dispatch reread persisted USD caps within the SQLite write transaction. Run/episode limits remain project-scoped; monthly limits cover the production root in UTC, including other-project holds, current-month charges and conservatively retained undated grant history. Existing holds count once; failed dispatch retains the hold/events. Prior-month uncertain holds remain exposure. Independent-process lowered-cap and month-boundary regressions pass. No provider integration was added; directory-discovered history and imported metadata still rely on the documented operator-controlled root and model-schema assumptions.

### F03 — phantom project records

**Evidence:** `StorageEngine.saveEpisode` and `saveGoogleFlowPlan` do not consistently require an existing project. In an isolated fixture, writing a copied original episode and a new one-second plan under `missing_project` yielded:

```json
{"projectExists":false,"episodeExists":true,"planExists":true}
```

**Impact:** orphan records can exist in SQLite while project discovery lists only filesystem-discovered project metadata. Some public handlers perform prechecks, others do not; storage is the shared trust boundary used by CLI/internal services. The newer research/production-record saves already require project existence, demonstrating inconsistent policy rather than an unavoidable storage design.

**Acceptance:** require project existence in every write service; require episode existence for episode-dependent records; validate series/episode scope rather than accepting arbitrary linked IDs; test all entry points, missing projects, legacy imports and failures without creating documents/directories.

**Batch 11 disposition:** the reproduced phantom-project write is remediated: episode and Flow-plan writes require matching real projects inside their write transaction; plans also require an existing episode belonging to the project. Rejected ghost writes create neither documents nor directories. **Partial overall acceptance:** broader linked-series validation, all-model preconditions, legacy imports and entry-point coverage remain F03/F07 work; do not interpret these guards as complete nested-schema validation.

## 5. Source-confirmed findings and conditional risks

### F04 — generated scripts bypass the verified local-media contract

**Evidence:** `src/core/flow.ts`, `generateFfmpeg24fpsStitchScript` and `generateCompleteYouTubeRenderScript`, retains `anullsrc` fallback, glob frame enumeration, `-shortest`, procedural-audio fallback and `bash ... || true`. The master generator prints “YouTube Ready Deliverables” after command completion but does not perform the local worker's full exact-frame/loudness/hash QC. `generateLocalAudioMixScript` synthesizes procedural stems, not narration, while describing mastering targets as finished quality.

The functions remain available to API/CLI script preparation routes. These routes prepare files rather than executing FFmpeg on the server; the real worker is separate and does not use these fallbacks. There is no demonstrated shell injection in this review: identifier validation and the audio character allowlist are relevant protections. However, the audio allowlist permits absolute/`..` paths and is not production-root confinement.

**Acceptance:** deprecate unsupported generators or route supported execution exclusively through the verified local worker; require explicit original audio; reject missing inputs; canonical numbering/exact frame count; no silent substitution; readiness only from measured evidence; enforce root-confined inputs if external scripts remain supported. Run generated scripts against adversarial synthetic assets, not just string assertions.

**Batch 12 disposition:** deprecated stitch/audio/master functions now throw and contain no executable fallback bodies. Legacy stitch, autoworker, generate-audio, master-render and Flow autoproduce handlers are removed; their API paths return 501, including tested case/trailing-slash and GET/POST variants. CLI stitch rejects stdout/save. UI script panels and automatic script requests are removed; the supplied-asset local renderer remains available. No generated-script adversarial execution is needed for these removed paths. Other generators, metadata assertions and legacy files are not certified by this change (F16).

### F05 — cross-project script overwrites

**Evidence:** `server/routes.ts` constructs files such as `render_flow_${epId}_24fps.sh`, `generate_audio_${epId}.sh`, `flow_autoworker_${epId}.js` and `render_youtube_${epId}_master.sh` through global `scriptOutput`. Project ID is included in script contents but absent from those output basenames. Same episode IDs in different projects select the same output file.

**Impact:** preparing project B can replace a script previously prepared for project A. This is a wrong-project artifact/race risk, not proof of automatic execution.

**Acceptance:** project/episode/attempt-scoped immutable script outputs with atomic writes; returned metadata names the exact scope/hash; concurrent two-project regression; no last-writer overwrite of an already presented script.

**Batch 12 disposition:** all identified global Flow script writers are removed rather than replaced with a new artifact service. The API cannot overwrite those scripts, and CLI stitch writes none. Regressions exercise identical episode IDs under two projects; CLI tests inspect an isolated root for script files. Existing exported files are intentionally not removed, migrated or validated; operators must not execute old scripts. Any future script-export feature still requires immutable scoped outputs/hashes and concurrency tests.

### F06 — arc expansion validation/allocation

**Evidence:** `server/routes.ts` checks `count > 20`, coerces `arcNumber` with `Number`, uses `existingEpisodes.length + i` and awaits independent `saveEpisode` calls. It does not strictly require an integer count in 1..20 or allocate the whole batch transactionally. Fractional/string/zero counts and concurrent expansion need dedicated tests. CAS prevents some overwrites but can leave a partially created batch before a conflict.

**Acceptance:** shared strict input schema; valid project/arc; transactionally allocate unique episode numbers; all-or-nothing batch persistence or explicit durable partial-result semantics; repeated/concurrent calls with deliberate idempotency policy.

**Batch 13 disposition:** F06 is remediated through one shared storage operation. Strict numeric integer arc/count, required bounded identifier key, matching project/series, high-water numbering including legacy IDs, UUID database identities and one SQLite transaction for cards plus request history. Same-key/same-input retries return the original creation snapshot; different input returns conflict. Separate-process tests cover disjoint allocations and same-key duplicate delivery; injected request-history persistence failure rolls back the entire batch. CLI now creates real cards instead of reporting simulated expansion. These are unreviewed drafts, not canonical roadmap-slot assignments or continuity-verified stories.

### F07 — storage boundary consistency

**Evidence:** some saves clone before await; episode/plan writes formerly used caller objects across awaits (snapshotted before awaits in Batch 13; returned revision updates remain for CLI compatibility). Canon append prevents duplicate IDs but lacks a complete nested runtime schema. Series validation checks top-level fields/containers, not every nested character/world-rule field. New-record episode/plan CAS behavior differs from production-record CAS. Project creation is not idempotent across a lost-response retry; mkdir is outside its metadata transaction.

**Acceptance:** an explicit per-model invariant matrix: existence, scope, immutable keys, new-record revision, input snapshots, nested schemas, idempotency and side effects. Preserve compatibility intentionally rather than generalizing a helper that hides different semantics. The project rollback regression confirms metadata rollback and explicitly records the leftover empty directory.

**Batch 13 partial disposition:** episode and plan writes snapshot before their first await and reject nonzero revisions for missing records. Episodes require the active series ID; CLI creation now uses project metadata rather than synthesizing a wrong series ID. A targeted mutation-during-await regression passes. Other models, complete nested schemas, duplication semantics, legacy-series reconciliation and project-creation idempotency remain open.

### F08 — recovery/cleanup protocol gaps

**Evidence:** local media recovery relies on owner hostname/PID plus `kill(pid, 0)`. A reused/live PID is not stolen, which is conservative but can strand a job. There is no process-start-identity/lease/graceful-shutdown protocol or complete orphan FFmpeg management. In `runNext` cleanup, an exception removing the failed export can occur before interval/controller cleanup; an exception removing work can surface after state is already terminal. These failure-order paths were source-reviewed, not fault-injected in this audit.

Checkpoint purge safely detaches a UUID directory before asynchronous deletion, but filesystem rename and SQLite commit cannot be one atomic transaction. A death between them may leave an untracked retired directory. Known deletion tokens support explicit retry; untracked orphan discovery is still absent.

**Acceptance:** nested cleanup `finally` guarantees controller/timer release despite disk errors; owner process identity or conservative leases; platform-specific child lifecycle tests; fault injection at each rename/commit/delete boundary; inspect-first orphan inventory before operator-approved deletion.

**Batch 13 partial disposition:** nested `finally` releases cancellation timer/controller and attempts scratch cleanup even when failed-export cleanup throws. Export/scratch disk-error injection tests verify visible errors, terminal failure/no QC and that the worker can close. PID identity/leases, child lifecycle, rename/commit crash recovery and orphan inventory remain open; cleanup failure is not silently reported as success.

### F09 — disk/resource bounds are incomplete

**Evidence:** `server/localMedia.ts` estimates scratch with one segment, a per-frame allowance and fixed headroom. Simultaneous retained cache, joined video, candidate MP4 and audio files are not backed by a reserved capacity guarantee. Other writers can consume disk after `statfs`. Final bitrate variability and filesystem metadata matter. File decoding is bounded in dimensions/nominal bytes, but `validateFrameFile` performs `readFile` before checking whether the file grew beyond the earlier stat limit.

**Acceptance:** conservative peak working-set model, incremental free-space checks, bounded reads where practical, ENOSPC failure/recovery tests, retention accounting and documented limits. No claim that preflight makes disk exhaustion impossible.

**Batch 13 partial disposition:** frame reads are now bounded during I/O rather than only after an unbounded read. An open handle is size-checked, read in capped chunks and closed in `finally`; growth after stat is stopped at 12,000,001 bytes. Tests verify identical decoded/hashed bytes, oversized rejection and the post-stat growth limit/handle closure. Peak disk modeling, capacity reservation, incremental disk checks and full ENOSPC recovery remain open.

### F10 — QC is point-in-time, playback is not continuous integrity checking

**Evidence:** `LocalMediaService.mediaPath` checks saved succeeded/QC state and a confined output path. The ranged playback route serves that file without recomputing the recorded SHA-256.

**Impact:** an operator or external process can replace a previously verified output and it remains associated with old QC. Under the intended operator-controlled tree this is a post-export integrity concern, not an unauthenticated write exploit.

**Acceptance:** immutable content-addressed outputs or an explicit reverify/invalidate workflow; tested changed/truncated output handling; clear UI evidence timestamp. Avoid hashing an entire long MP4 on every range request without a caching/invalidation design.

**Batch 15 disposition (HTTP boundary):** playback hashes each new open file version against saved QC, caches by path/device/inode/size/mtime/ctime/expected digest, limits cache to 32 versions and concurrent distinct hashes to two, then serves ranges from the verified descriptor. Changed/truncated/replaced bytes are blocked; historical QC is preserved. Eleven reader/range regressions and a real-render HTTP test pass, including restoration, HEAD/If-Range, concurrent checks and mutation during hashing. This addresses ordinary post-export edits without hashing every range. Concurrent in-place modification during streaming and metadata-preserving privileged writers remain outside the operator-controlled filesystem assumption. Internal `mediaPath` is a path lookup, not a byte-integrity check. Full contract: `docs/verified-playback.md`.

### F11 — GET side effects

**Evidence:** `flowPlanRouter.ensurePlan` can create a plan on GET plan/checkpoint requests. The autoworker GET route writes a script to disk. Doctor performs a temporary write probe. Some are intentional diagnostics, but not all are read-only inspection.

**Acceptance:** separate preparation actions from reads, return 404/unprepared state without implicit mutation, cache-control for private diagnostic responses, and explicit tests documenting unavoidable probe side effects. Authentication alone does not make HTTP read semantics correct.

**Batch 13 partial disposition:** plan/checkpoint GET no longer calls preparation; unprepared plans return 404 and Flow responses use `Cache-Control: no-store`. Explicit POST prepares/replaces plans, and UI explains the required action. Isolated tests verify reads do not create a plan or change an existing revision. Batch 12 removed autoworker GET file writes. Legacy JSON import-on-read, initialization and doctor write probes remain documented side effects; comprehensive diagnostic/read-only separation remains open.

### F12 — browser correctness remains unproven

**Evidence:** no Playwright/Puppeteer/jsdom/browser suite is configured in package/CI. Some views now use abort/generation guards; `AutoproducerView` still loads runs/grants without equivalent stale-project protection, while the app-level sequential loader mainly logs failures. Disabled mutation buttons reduce risk but do not validate historical display, keyboard behavior, draft preservation, modal focus, range playback or mobile layouts.

**Acceptance:** isolated browser fixtures with controlled delayed/error responses; rapid project/episode switching; conflicting saves; double submissions; keyboard-only modal flows; real ranged video playback; no fabricated empty-state creation. Do not label source-reviewed JSX as browser-tested.

**Batch 15 partial disposition:** historical inspector reads now abort on project changes, reset project-scoped state and expose load failures. Script saves use a generation guard to ignore stale responses after navigation and a synchronous submission latch; local review messages no longer claim independent approval. Playback surfaces a failure instead of a silent player/fallback. These changes are source-reviewed and type/build checked only; delayed-response browser automation, accessibility, keyboard/modal and platform/playback matrix remain open. The other views/app-level loader still need broader coverage.

### F13 — source URL checks are not a fetch firewall

**Evidence:** `src/core/sources.ts` checks syntax and known private literal/hostname patterns, strips embedded credentials and rejects IPv6 literals. It performs no DNS/public-address pinning or redirect revalidation. Regex instruction signatures are advisory and do not certify arbitrary text as safe instructions.

No server-side research fetch was observed in these routes, so this is not a demonstrated active SSRF request. The current research guide correctly limits the claim.

**Acceptance:** keep capture separate from retrieval; if fetching is added, validate all resolved addresses and redirect hops, restrict protocols/ports/time/bytes, enforce egress and never elevate retrieved text into tool/approval authority.

### F14 — backup/restore completeness

**Evidence:** consistent SQLite `VACUUM INTO` snapshots and a metadata restore-read fixture exist. Media, checksums for complete archives, guided restore, path reconciliation and operator rollback/verification do not. Filesystem-coupled artifacts cannot be made consistent by copying a live WAL database alone.

**Acceptance:** documented metadata/media scope; versioned manifest; staged restore into an isolated root; integrity and relational checks; path rebasing; explicit operator activation/rollback; interrupted restore tests. Until then do not advertise a complete archive/export/restore solution.

### F15 — deployment/error boundary limits

**Evidence:** operator access supplies a single shared Basic/Bearer credential and origin/host checks. Remote binding requires a long token. This is not individual identity, RBAC, session expiry, audit attribution or a rate limiter. JSON body size and local render queue bounds exist, but not uniform per-route rate/concurrency budgets. `server.ts` lacks one final API error handler guaranteeing JSON for malformed/oversized bodies; route statuses are also inconsistent across older handlers.

**Acceptance:** retain local single-operator scope and HTTPS; explicit rate/concurrency policy; bounded parsers and consistent JSON errors; credential rotation/session design before multi-user deployment; tests for malformed bodies, 413, timeouts and unauthorized requests. No remote authentication bypass was demonstrated in this review.

**Batch 14 partial disposition:** a final Express API error boundary now returns no-store JSON for malformed bodies (400), oversized bodies (413) and otherwise uncaught errors (500), without exposing the underlying internal error message. An isolated middleware fixture verifies those responses and normal valid bodies. Per-route legacy error handling, asynchronous failure coverage, rate/concurrency policy, rotation/session design and wider deployment acceptance remain open.

### F16 — assertions and assurance gaps

**Evidence:** seeded script `isApproved` values, dated provider model descriptors and legacy package/job/run flags are not independently measured review evidence. Some views now warn about this, and research reads demote unsupported approval labels, but there is no full legacy-data audit or durable review-event service. TypeScript has not enabled strict mode; some tests assert generated strings. CI runs lint/tests/build/npm audit, but has no browser/Windows/native-decoder validation or long-render matrix.

The Gemini adapter currently blocks configured-client billable execution, while its no-key template branch still calls the canonical template “verified.” That label is not factual verification. Dependency audit returning zero vulnerabilities does not certify external/native binary maintenance, future provider behavior or semantic/editorial correctness.

**Acceptance:** explicit provenance/review events with actor and scope; unmeasured/unknown defaults; removal of unsupported seeded readiness claims; incremental strict typing; generated-script execution tests; platform/browser/native-tool test matrix; evidence-based release criteria.

**Batch 14 partial disposition:** fresh pilot seed approval/reviewer and measured-voice assertions are removed; the rewritten nine-beat pilot is an unapproved draft with derived count/reading-time estimates. Editor saves no longer copy reading-time estimates into measured voice duration. UI local review labels explicitly disclaim independent identity/approval. No-key outline output is now a bounded brief-aware local scaffold, not a “verified” canonical episode. CLI checks and editor craft prompts remain advisory and do not certify production readiness. Existing production records, seeded research/canon claims and legacy approvals have not been migrated or independently reviewed. Browser/Windows, native tools, durable review provenance and broader typing/assurance remain pending.

## 6. Verified strengths and preserved boundaries

- SQLite WAL/FULL-sync synchronous transactions replace naive read-modify-write JSON authority; independent-process regressions exist.
- Settings, series, research, project archive and production metadata have targeted atomic revision protection. Episodes/plans also have their earlier CAS tests, subject to the consistency gaps above.
- Path handling rejects lexical escapes/symlink ancestors, subject to an operator-controlled-tree assumption; it is not an OS sandbox against hostile concurrent filesystem mutation.
- HTTP unsafe job/run/package/grant mutations are closed, with canonical/case/trailing-slash coverage; the legacy placeholder render-script route is removed in Batch 10.
- Local media uses actual supplied 1080p PNG/audio, bounded queue, cancellation, segment evidence, measured final QC and no production synthetic fallback.
- Checkpoint reuse rechecks current source evidence, encoder profile and cached video bytes/probe/decode; purge detaches retired data to avoid deleting a concurrent retry's new cache.
- New project archive tests verify strict booleans, non-destructive metadata changes, structured conflicts and independent-process winner behavior. Typed CLI create/show/archive/unarchive is exercised in a temporary working directory.

These strengths should be retained while remediation proceeds; do not replace measured local-media execution with older scripts to make the UI appear complete.

## 7. Remediation order and exit criteria

1. **Trust defaults:** resolve F01 and remove unsupported provider/legacy verification language. No new transmissions based on defaults.
2. **Financial dispatch:** resolve F02 before any billable execution service is connected; test cap scope, drift and unknown effects.
3. **Storage preconditions:** resolve F03/F07 and transactionally allocate arc batches (F06).
4. **Generated-script boundary:** deprecate unsafe fallbacks or move callers to the verified worker; immutable project-scoped artifacts (F04/F05/F11).
5. **Recovery/resource integrity:** fault-inject cleanup/crash/ENOSPC/output mutation (F08–F10).
6. **Release assurance:** browser/platform matrix, consistent API errors and restore workflow (F12/F14–F16). F13 is a mandatory prerequisite for any network retrieval feature.

Before enabling providers: independent operator approval, durable reservations with dispatch-time policy checks, idempotent request/reconciliation semantics, evidence-backed status transitions and no silent media fallback. Before publication: durable human rights/editorial/platform approval tied to exact artifact hashes, private-by-default handoff, and explicit human authorization. Current implementation does not satisfy those full exit criteria.

## 8. Validation record

Final Batch 10 validation is recorded in `docs/remediation-progress.md`: 120 passing tests and 1 opt-in long-duration test skipped; type checking, production build, dependency audit and diff checks pass. The full-duration fixture passed in Batch 5 but was not rerun here. npm reported zero known vulnerabilities; that is not proof of native decoder or application security.

The isolated audit probes demonstrated the exact F01–F03 outputs above and removed their temporary roots. Source-confirmed/conditional findings have not all been reproduced dynamically. Browser, real providers, Windows and public deployment remain untested in this follow-up. This is an actionable review of inspected boundaries, not exhaustive assurance of every line or possible failure mode.

### Batch 11 validation update

Clean install and type checking passed. Full suite: **133 passed, 1 opt-in long test skipped, 0 failed** (134 total); production build passed; npm audit reported **0 vulnerabilities**; final whitespace/diff checks passed. Thirteen new targeted regressions cover consent history/rollback, scope guards, current caps, cross-project history, UTC exposure and separate-process dispatch. Existing config/transaction/Flow targeted coverage also passed (28 tests). Logs: `/tmp/ternfall-batch11-{install,existing,target,tests,build}.log` (sandbox-local, not durable release artifacts). No new browser, Windows, provider, publication or 900-second run was performed. F04–F16 remain open, with limited provider-default cleanup contributing to F16, not closing it.

### Batch 12 validation update

Full suite: **135 passed, 1 opt-in long test skipped, 0 failed** (136 total). Type checking, production build, npm dependency audit (0 vulnerabilities) and diff checks passed. Targeted Flow/hardening/security suite: 33 passed. Two new regressions test retired API variants and actual isolated CLI save/stdout rejection; three old tests were replaced with explicit retirement expectations. Logs: `/tmp/ternfall-batch12-{target,tests,build}.log`. No paid calls, production metadata changes, publication, automated browser/Windows testing or new long-media run. F04 is addressed by retirement; F05's identified writers are removed. Remaining F03/F06–F16 work and old external artifacts are not covered by that disposition.

### Batch 13 validation update

Full suite: **147 passed, 1 opt-in long test skipped, 0 failed** (148 total); lint, production build, dependency audit (0 vulnerabilities), and diff checks pass. Added 12 regressions: 7 arc/scope/snapshot/CLI tests, 1 Flow read-only test, 2 cleanup-failure tests and 2 bounded-read tests. The combined arc/Flow targeted suite passed 19 tests; existing remediation/Flow/transaction coverage passed 36 before the Flow GET change and was rerun in the full suite. Logs: `/tmp/ternfall-batch13-{existing,target,frames,tests,build}.log`. No paid provider calls, production grant changes, publication, production metadata migration, browser/Windows run or long-media rerun. F06 remediated; F03/F07/F08/F09/F11 partially improved, not fully closed. F10/F12–F16 remain open.

### Batch 14 validation update

Full suite: **155 passed, 1 opt-in long test skipped, 0 failed** (156 total). Type checking, production build, npm audit (0 vulnerabilities), diff checks and bootstrap shell syntax checks pass. Eight new tests cover local scaffold inputs/provenance, non-certifying craft findings, draft seed/count/timing, configured-provider refusal, synchronized story reading copy, and API parser/error responses. Logs: `/tmp/ternfall-batch14-{target,tests,build}.log`. New `README.md`, story-craft workflow and complete pilot reading copy are delivered. The pilot is 1,581 spoken words / estimated 654 seconds at 145 WPM, not a measured or full 15-minute recording. No paid calls, production data migration, production grant changes, publication, browser/Windows validation or new long-media run. F15/F16 partially improved; remaining open findings are not closed by creative work or passing tests.

### Batch 15 validation update

Fifty independent read-only tool checks ran in parallel before dependent edits. One optional-path search included nonexistent `src/core/localMedia.ts`; the same check returned the actual declarations in server/types and no implementation was inferred from that missing path. Review record: `docs/parallel-review-batch15.md`.

Clean dependency installation and full validation passed: **167 passed, 1 opt-in long test skipped, 0 failed** (168 total), lint/build/audit/diff checks; zero known npm vulnerabilities. Twelve tests added for verified playback; eleven reader/range targeted tests pass. Logs: `/tmp/ternfall-batch15-{install,integrity,tests,build}.log`. No paid requests, production grant/data changes, publication, browser/Windows/hostile-filesystem run or new long-media validation. F10's ordinary HTTP-edit boundary is addressed under documented assumptions; F12 is partially improved, not browser-certified. Remaining audit findings stay open.
