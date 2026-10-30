> **2026-10-29 audit correction:** The checked items below are a historical ledger, not verified completion evidence. Several implementations were simulated. See `docs/remediation-progress.md` for current verified status. Production execution/approval endpoints are now intentionally fail-closed until their real services exist.

## Current unresolved priorities (2026-10-30)

- [x] Design an explicitly authorized offline procedure for ambiguous/legacy/foreign worker claims: `studio media adjudicate`
  (CLI-only, dual attestation plus evidence note, full claim recorded as history) resolves incomparable claims; non-Linux
  cross-process recovery and orphan cleanup remain open.
- [ ] Complete successful-response data minimization, nested schema validation and privacy review across APIs (remaining: untested response shapes; write-side policy caps and trusted-caller unknown-key rejection are done — every document write is model-clean and every numeric field has a documented ceiling); address continuous post-verification asset changes and remaining concurrency limits.
- [x] Project settings/project HTTP success payloads through validated allowlists; preserve legacy provider data on settings saves, reject project identity mismatch, and show zero/unknown caps truthfully in the browser.
- [x] Project production-record listings (jobs, YouTube packages, autoproduce runs, spend grants) through fail-closed browser projections: drop paths, raw diagnostics and provider telemetry, replace log text with fixed statements, and fail malformed records closed without leaking contents.
- [x] Project episode/series/research reads and mutation responses through recursive document schemas; reject unknown caller keys, preserve stored legacy keys across edits (including matched nested items), and keep legacy script versions without fabricated values.
- [x] Guard revision advancement at the safe-integer boundary for exercised project, settings, series, episode, Flow, research and production records; test rollback and Flow's two-commit recheck.
- [x] Use typed, fixed public errors for exercised project, episode, arc, settings, series, research, outline, Flow and local-render mutations; regression-test forged codes and injected failures.
- [x] Snapshot settings, series and research inputs before validation and asynchronous persistence; test same-process mutation of nested and protected fields.
- [x] Clear stale Flow evidence and block plan changes when a post-mutation reload fails; exercise the failure with real synthetic frames in Chromium.
- [ ] Complete storage schemas/import review, full-size backup and recovery rehearsal, and reviewed live promotion/rollback.
- [ ] Validate hosted CI, maintained native media binaries, supported platforms, accessibility and deployment security; a passing local suite is not release approval.
- [ ] Build separately authorized provider generation, independent human review/rights approval and publication workflows rather than re-enabling retired simulations.

# TASKS.md — Project Ledger & Live Execution Tracker

**Aspirational reference**: `PROJECT_SPEC.md`; see the current traceability and remediation documents for implemented capabilities.

**Universal Definition of Done — targets, not yet established**:
- [ ] All states handled: loading, empty, error, success, and edge/offline states
- [ ] Every input validated (client AND server where applicable)
- [ ] Every external call has error handling
- [ ] Responsive layout at desktop/laptop
- [ ] Basic accessibility: labels, keyboard nav, visible focus, contrast
- [ ] Nothing sensitive exposed client-side
- [ ] Verified across intended workflows by actually running unit tests and browser checks

---

## P0 — Blocking (Core Pipeline & Automation Engine)

- [x] **Task P0.1**: Build Resumable Batch Checkpoint Engine in `src/core/flow.ts` & Server API
  - *Spec Link*: Feature 2 & Feature 3
  - *DoD*: Saves/loads checkpoint state for 600 batches, resumes from last unverified frame without duplicating work.
- [x] **Task P0.2**: Implement Single-Click "Autoproduce Full Master" Orchestrator in `src/core/flow.ts` and CLI
  - *Spec Link*: Feature 8
  - *DoD*: End-to-end automation runner (`Plan -> Worker Verify -> Audio Synthesize -> Video Render -> Shorts Cut -> YouTube Package`) callable via `POST /api/projects/:id/flow/autoproduce/:epId` and CLI `npm run studio -- flow autoproduce`.
- [x] **Task P0.3**: Write Unit Tests in `src/core/flow.test.ts` for Checkpoint & Autoproduce Orchestrator
  - *Spec Link*: Acceptance Criteria 2 & 8
  - *DoD*: 100% test pass on node:test runner verifying error recovery, checkpoint resumption, and pipeline sequencing.

---

## P1 — Important (UI Player, Pre-Flight QC & Storage Controls)

- [x] **Task P1.1**: Build Integrated HTML5 Video Player with 9-Beat Chapter Scrubbing in `GoogleFlowView.tsx`
  - *Spec Link*: Feature 6
  - *DoD*: Embedded video player in Studio UI with clickable chapter buttons that scrub to exact beat timestamps (00:00, 01:30, 03:00, etc.).
- [x] **Task P1.2**: Implement YouTube Pre-Flight Technical Quality Control (QC) Card
  - *Spec Link*: Acceptance Criteria 5 & 7
  - *DoD*: Real-time audit checklist verifying: 1080p resolution, 24fps frame rate, -14.0 LUFS loudness, 0 dropped frames, rights clearance, and synthetic media disclosure.
- [x] **Task P1.3**: Implement Local Storage & Disk Cleanup Manager in `GoogleFlowView.tsx`
  - *Spec Link*: Feature 3 & Missing Pieces #6
  - *DoD*: Shows live disk usage (frame count, size in MB/GB), with 1-click "Clean Temporary Renders" and "Export Archive".

---

## P2 — Polish (Workflow Enhancements & Account Health Diagnostics)

- [x] **Task P2.1**: Account Health & Session Status Checker for 3 Pro Accounts in UI
  - *Spec Link*: Missing Pieces #1
  - *DoD*: Live status indicator (Active, Expired, Testing) with token config modal.
- [x] **Task P2.2**: Full End-to-End Visual Browser Verification & Adversarial Hardening
  - *Spec Link*: Phase 6 & Ultra-Mode Checklist
  - *DoD*: Browser validation via `playwright-cli`, testing happy path, rapid clicking, tab switching, and empty states.


## Audit remediation — Batch 2 (verified 2026-10-29)

- [x] SQLite document transactions, legacy import without rewriting legacy files, WAL and cross-process independent-update tests.
- [x] Durable spend reservations, idempotency conflicts, cap accounting, uncertain-effect retention and atomic charge commits (internal service; no paid execution).
- [x] Consistent metadata-only SQLite backups and recovery-snapshot test.
- [x] Abrupt termination/rollback and concurrent initialization regression tests.
- [ ] Real media worker and decoded artifact verification.
- [ ] Operator-only approval/reconciliation integration; re-enable paid execution only after integration tests.
- [ ] Same-record optimistic concurrency, operator restore workflow and media archives.


## Audit remediation — Batch 3 (local media vertical slice)

- [x] Real short local H.264/AAC exports from existing 1080p PNGs and WAV/FLAC audio.
- [x] Full decode validation, immutable per-attempt input snapshots, SHA-256 evidence and measured final technical QC.
- [x] Durable bounded queue, cross-process cancellation, dead-owner interruption and explicit new-attempt retry.
- [x] Local-render API, byte-range playback, typed CLI and real render UI panel.
- [x] Real one-second and five-second integration exports and negative/recovery cases.
- [ ] Full-episode/per-frame checkpoint resume, visual generation, orphan cleanup and operator rights/editorial approval integration.


## Audit remediation — Batch 4 (evidence and optimistic concurrency)

- [x] Exact partial batches, correct keyframe/fps timestamps and project-specific plan output paths.
- [x] Real full-decode Flow ingestion, hash manifests and failed-recheck evidence revocation; no simulated frame generation.
- [x] Evidence-backed gap-first resume, legacy simulated-proof rejection and duplicate-index hardening.
- [x] Episode/plan revision compare-and-swap, HTTP 409 conflicts and unsaved-editor error notices.
- [x] Partial-batch, concurrent replacement and cross-project regression tests.
- [ ] Remaining model conflict checks, visual merge UX, browser tests, full-episode execution and provider integration.


## Audit remediation — Batch 5 (full-duration local export)

- [x] Up to 15-minute supplied-asset exports, 120-frame segmented video encoding and streamed audio/file hashing.
- [x] Durable same-job checkpoint reuse after current-input/profile/hash/probe/full-decode validation; corruption/changed inputs re-encode.
- [x] Reuse progress UI, updated CLI bounds and measured final A/V start-offset QC.
- [x] Actual 900-second/21,600-frame/180-segment synthetic integration export passed final QC.
- [x] Resume, source-change/unaffected-cache, cache-corruption, abrupt post-checkpoint death and frame-boundary regressions. Routine suite: 88 passing, 1 long test skipped (separately passed).
- [ ] Safe checkpoint retention/purge and orphan cleanup; provider/per-frame generation resume; editorial/rights approval and browser automation.

Earlier batch open items are historical; this batch closes full-duration local supplied-asset execution only, not the full generation/publication pipeline.


## Audit remediation — Batch 6 (explicit checkpoint cleanup)

- [x] Terminal-job checkpoint purge through typed CLI, API and confirmation-gated UI; preserve source assets, exports and job/idempotency history.
- [x] SQLite-serialized cache detachment and UUID retirement paths prevent cleanup from deleting a retry's newly created cache.
- [x] Persist deletion-failure recovery tokens; validate derived paths and reject symlinked caches.
- [x] Active/foreign-job rejection, retention/idempotency, separate-process retry race, failed deletion/retry and symlink regressions.
- [x] Type checking, 92 passing tests (1 opt-in long test skipped), build, zero-vulnerability audit and diff check.
- [ ] Automatic retention/storage accounting, orphan discovery/process cleanup, browser automation and remaining non-episode/plan conflict checks.


## Audit remediation — Batch 7 (configuration revisions)

- [x] Atomic settings and series-bible revision compare-and-swap with structured HTTP 409 conflicts and immutable series identity.
- [x] Settings save sends only allowed fields, keeps failed/conflicting drafts, adopts saved tokens and guards project-change responses.
- [x] Read-only budget controls and disabled grant controls accurately reflect server gates; no approvals/caps widened.
- [x] Five regressions including simultaneous-process races for both shared documents; 97 passing tests, 1 long test skipped, type/build/audit/diff checks pass.
- [ ] Other model CAS, complete nested runtime schemas, persistent drafts/merge UX and browser automation.


## Audit remediation — Batch 8 (research trust and revisions)

- [x] Reject caller-minted research verification/approval/confidence assertions through storage/API; preserve explicitly fictional classification.
- [x] Shared bounded note/URL/date/identifier validation, credential-free URL normalization and advisory instruction-pattern checks.
- [x] Atomic research claim revisions, immutable identity/scope, structured 409 conflicts and independent-process regression.
- [x] Demote unsupported historical review labels on read without rewriting stored records; accurate research UI/CLI capture defaults and failure visibility.
- [x] Six new regressions; clean install, 103 passing tests (1 long test skipped), type/build/audit/diff checks passed.
- [ ] Durable independent review events, factual/legacy evidence review, DNS-safe fetching if added, remaining model CAS and automated browser tests.


## Audit remediation — Batch 9 (production records and safety coverage correction)

- [x] Thirty parallel repository checks; found previously incomplete gate coverage and corrected earlier safety claims in the progress guide.
- [x] Removed legacy job transition/reconciliation, autoproducer execution, fake package creation and grant mutation handlers; normalized gate case/trailing slashes with regression requests.
- [x] Internal job/run/package atomic revision CAS, immutable identity/scope, input snapshots and explicit returned tokens.
- [x] Disable corresponding UI mutations; remove auto-generated fake packages and prechecked readiness; local checklists are not approvals.
- [x] Eight storage regressions including independent-process races for all three models. Type checking, 111 passing tests (1 long test skipped), build, zero-vulnerability audit and diff check.
- [ ] Project archive CAS, full model schemas, historical evidence audit, operator-only reconciliation/approval integration, browser tests and provider execution.


## Audit remediation — Batch 10 (project lifecycle and deep follow-up audit)

- [x] Fifty independent parallel inspections, targeted follow-up probes and a detailed 16-finding evidence-ranked re-audit.
- [x] Strict project creation validation, UUID identities, confined paths and transactional metadata initialization/rollback coverage.
- [x] Strict boolean project archive/unarchive with atomic revisions, structured conflicts and nondestructive preservation.
- [x] Typed CLI show/archive/unarchive and actual isolated CLI integration; independent-process archive race.
- [x] Remove placeholder render script; scene planner uses real local rendering with selected project/episode, not a hardcoded project.
- [x] Clean install; 120 passing tests (1 opt-in long test skipped), type/build/audit/diff checks passed.
- [x] Batch 11: F01/F02 reproduced consent/cap defects and F03 phantom-project/episode writes remediated (see remaining linked-model scope below).
- [ ] Remaining F03/F07: linked-series validation, all-model write preconditions and legacy-import coverage.
- [ ] F04–F07: generated-script fallback/path/artifact policy, atomic arc allocation and consistent model schemas/snapshots.
- [ ] F08–F16: crash/cleanup/disk/output integrity, GET semantics, browser tests, safe future retrieval, restore, API boundaries and legacy assertions.

Detailed findings and acceptance criteria: `docs/deep-re-audit-2026-10-30.md`. No zero-flaw or full-production-readiness claim is made.


## Audit remediation — Batch 11

- [x] Versioned server-recorded settings acknowledgement/withdrawal, transactional history and truthful fresh/legacy provider defaults.
- [x] Shared reserve/dispatch cap checks, root-wide UTC monthly exposure, retained uncertain holds and lowered-policy process regressions.
- [x] Transactional project/episode existence guards with no ghost documents/directories.
- [x] Thirteen new regressions; full validation: 133 passed, 1 opt-in long test skipped, lint/build/audit/diff checks passed; zero known npm vulnerabilities.
- [ ] Complete remaining F03/F07 acceptance and F04–F16; no production-readiness claim.


## Audit remediation — Batch 12

- [x] Retire fallback-producing Flow stitch/audio/master generators and remove legacy API script writers.
- [x] Block retired API route variants; CLI rejects stdout/save; remove misleading UI script panels and automatic preparation requests.
- [x] Preserve real supplied-asset local rendering; do not execute or delete legacy exported scripts.
- [x] Two new regressions, 33 targeted passes; full suite 135 passed / 1 long skipped / 0 failed; lint/build/audit/diff checks passed.
- [ ] Remaining F03/F06–F16; future exports need immutable project/episode/attempt scope and hashes. Old scripts remain unverified.


## Audit remediation — Batch 13

- [x] F06 shared strict arc schema, atomic high-water card allocation and durable idempotent replay; process races, rollback, API and actual CLI regressions.
- [x] Episode/plan input snapshots and new-record revision checks; active-series guard and corrected CLI creation lookup.
- [x] Explicit Flow plan preparation; read-only plan/checkpoint GET and no-store headers.
- [x] Cleanup failure-safe timer/controller release and scratch cleanup attempt; bounded frame reads with post-stat growth test.
- [x] Twelve new tests; full suite 147 passed / 1 long skipped / 0 failed, lint/build/audit/diff passed (zero known npm vulnerabilities).
- [ ] Remaining F03/F07 nested/all-model invariants, imports and idempotency; F08 owner/orphan recovery; F09 disk/resource assurance; F10 playback integrity; F11 diagnostic/read semantics; F12 browser; F13 future fetch controls; F14 staged restore; F15 deployment/error policy; F16 provenance/assurance.


## Audit remediation — Batch 14 (story upgrade and project introduction)

- [x] Original pilot rewrite + synchronized reading copy, nine causal beats and editorial craft workflow.
- [x] Truthful fresh draft seed, derived words/reading time, no seeded human reviewer or invented voice measurement; no existing-data migration.
- [x] Brief-aware unreviewed outline scaffold; live editor/CLI craft questions, no automated quality/readiness certification.
- [x] Root README; corrected bootstrap Node/test/key/readiness guidance.
- [x] Final API JSON parser/error boundary with regression; does not complete F15 rate/session/deployment requirements.
- [x] Eight tests added; 155 passed / 1 long skipped / 0 failed; lint/build/audit/diff/bootstrap syntax pass.
- [ ] Human editorial/continuity/engineering review and performed timing; further scene development if a 15-minute pilot is required.
- [ ] Remaining F03/F07–F16 as detailed in the audit, including historical provenance migration and durable independent reviews.


## Audit remediation — Batch 15

- [x] Fifty independent parallel review calls, with outcome/scope record.
- [x] Verify HTTP export bytes against saved QC; bounded stat/hash version cache, coalesced/admitted hashing, descriptor-based range/HEAD/If-Range playback and fail-closed mutation handling.
- [x] Twelve new reader/HTTP regressions including actual rendered bytes; 167 passed / 1 long skipped / 0 failed, clean install/lint/build/audit/diff pass.
- [x] Source/type/build-checked inspector abort/reset/error state, script-save generation/submission guard and visible playback failures.
- [ ] Automated delayed-response/browser/platform coverage; quiescent-filesystem assumptions and global request/resource budgets; remaining F03/F07–F09/F11–F16 work in audit.
