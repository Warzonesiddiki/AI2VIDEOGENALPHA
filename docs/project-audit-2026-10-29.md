# Ternfall Studio — Project audit

Date: 2026-10-29 · Reviewed revision: `409c1a64a6f205ea60f863b970bc1d6f52bb80a8`

## Executive assessment

**This is a useful production-planning prototype, not yet a verified end-to-end video production system.** The React/Express/TypeScript foundation, typed domain models, deterministic planning utilities, server-side Gemini adapter, and 32 passing unit tests are good starting points. The main release blocker is that several workflows present planned or simulated output as completed and verified production work.

Do not expose this server to untrusted users or enable real paid automation until path containment, operator authorization, and transactional spend controls are enforced. Existing comments and completed task checkboxes are not reliable evidence of implemented safety or production readiness.

## Scope and verification

Reviewed server startup, REST routes, storage, CLI, core budget/source/job/Flow utilities, UI data loading and major production views, dependency/build configuration, specifications, and task ledger. No application source was changed in this audit.

Executed on Node 22.22.3:

| Check | Result |
|---|---|
| Normal dependency install (`npm install --ignore-scripts --package-lock=false`) | **Failed:** Vite 8.3.5 expects optional peer esbuild ^0.27 or ^0.28; project pins ^0.25 |
| Diagnostic install (`npm install --legacy-peer-deps --package-lock=false`) | Passed; workaround only, not a fix |
| `npm run lint` | Passed; currently TypeScript checking, not an ESLint/static-security pass |
| `npm run build` | Passed; main JS chunk 573.55 kB / 148.19 kB gzip; Vite warns about chunk size and future native-loader incompatibility with `__dirname` |
| `npm test` | **32/32 passed** |
| npm install vulnerability summary | 0 reported for resolved dependencies; not a source-security assessment |
| Targeted non-mutating utility probes | Reproduced sibling-directory path escape, accepted IPv6 loopback URL, missing-grant authorization, NaN-cost authorization, and contradictory successful autoproduction result |

No authenticated provider calls, account sessions, browser accessibility tests, actual FFmpeg rendering, or public deployment penetration test were performed. No spend grants were created and no production project records were changed. Findings below distinguish demonstrated utility defects from source-level risks.

## Prioritized findings

### 1. P0 — Production completion and QC are fabricated rather than measured

**Evidence:** `src/core/flow.ts:812–850` creates a plan and returns `stageReached: 'packaged'`, `qcStatus.passed: true`, expected frame counts as verified counts, and output paths without generating or inspecting media. A one-second probe returned 24 verified frames and passing QC while its own checkpoint had zero completed batches and `isComplete: false`.

`server/routes.ts:470–548` starts runs with five stages already succeeded using fixed research/script claims. Advancing a run marks the current stage succeeded without executing its task or enforcing `requiresHumanAction`. The Flow autoproduce route writes scripts but does not execute the claimed full production chain.

**Impact:** Operators can mistake a plan for an export, skip editorial approval, and trust nonexistent technical checks.

**Improve:** Separate `planned`, `simulated`, `running`, `failed`, `needs_review`, and `verified` states. Add a durable worker that executes each stage and stores artifact hashes, process exit codes, logs, and measured QC. Only report packaged after output files exist and pass validation. Enforce human review server-side, not just through UI labels.

### 2. P0 — File operations are not confined to the production root

**Evidence:** `server/storage.ts:193–245` and `:662–680` construct paths using caller-supplied project/episode identifiers without central containment checks. Routes also resolve user-controlled identifiers into output paths and write scripts outside the production root. `bin/studio.ts:106–113` uses `resolved.startsWith(normalizedRoot)` despite claiming symlink protection.

**Reproduced:** `validateSafeProjectPath('../production_root_evil/file', '/tmp/production_root')` accepts `/tmp/production_root_evil/file`.

**Impact:** Path traversal can reach unintended files within the server process's permissions. Symlinks are not checked. Raw identifiers interpolated into generated shell/JavaScript scripts also create injection risks when an operator later executes those scripts; the reviewed endpoints do not themselves execute those generated scripts.

**Improve:** Strict identifier schemas; one storage-boundary resolver using `path.relative` with separator-aware containment; realpath checks on existing ancestors; symlink rejection/secure file-open policy. Keep generated artifacts under the authorized root. Prefer `spawn(executable, args, { shell: false })` over executable script interpolation.

### 3. P0 — No enforceable operator authorization boundary

**Evidence:** `server.ts:19–47` binds to `0.0.0.0` and mounts writable APIs without authentication. `server/routes.ts:567–598` lets any API caller mint a grant with `issuedBy: 'operator'`; settings can likewise be updated without operator verification.

**Impact:** Anyone who can reach the service can change project data, create supposed operator approvals, or widen configured caps. A policy in AGENTS.md is not a technical access control.

**Improve:** Default desktop use to loopback; explicitly opt into remote binding with authentication. Use authenticated operator-only approval/settings endpoints and immutable approval events. For cookie sessions add CSRF protection and origin validation. Preserve an authenticated, preview-host-compatible remote mode. Do not treat permissive CORS as authentication.

### 4. P0 — Spend authorization is neither mandatory nor atomic

**Evidence:** `src/core/budget.ts:95–205` only checks a grant if supplied. It does not validate finite nonnegative numeric values or bind grant project/episode scope to the request. It returns a reservation ID without persisting a reservation. REST run start/advance does not invoke the budget evaluator. CLI imports it but does not call it.

**Reproduced:** A request with no grant is authorized; the same request with `estimatedCostUsd: NaN` is also authorized.

**Impact:** These controls do not safely enforce approvals once real billable operations are connected. This audit did not observe an actual provider charge.

**Improve:** Require valid operator grants for every paid operation; validate scope, currency, expiry and all numeric values. Use integer minor currency units and a transactional reservation ledger that includes concurrent outstanding reservations. Persist reserve/commit/release/reconcile events and use provider idempotency keys. Reject unknown outcomes until reconciled.

### 5. P1 — Generated worker and ingestion can certify placeholder/nonexistent assets

**Evidence:** `src/core/flow.ts:435–513` produces a worker that writes a base64 1×1 PNG instead of calling a visual provider. Tokens are declared but not used for generation. `server/routes.ts:942–986` creates placeholders when `simulate` is true **or the filenames list is empty** and marks a batch verified from filename validation. `src/core/flow.ts:308–354` checks names, not file existence, decode success, resolution, content or expected global index. Out-of-range numbers fall back to array position. The separate batch status route (`server/routes.ts:902–935`) accepts arbitrary statuses and increments counters on repeat calls.

**Improve:** Isolate fixture generation in explicit demo/test mode; never permit demo assets to pass production QC. Validate actual decoded files against exact per-batch global indices and a content manifest. Reject duplicates, missing files, corrupt images and wrong dimensions. Make status transitions validated and idempotent. Support partial final batches instead of always requiring 24 frames.

### 6. P1 — JSON rename is atomic, but updates are not transactional

**Evidence:** `server/storage.ts:80–102` atomically replaces a file, but `saveEpisode` (`:233–246`) reads an entire collection then replaces it. Other collections follow this pattern. Two requests or CLI/server processes can read the same version and overwrite each other's changes. Read/parse errors silently return defaults, allowing later writes to replace corrupted collections with incomplete data. Seeding when either metadata or episode file is missing can also overwrite remaining project records.

**Improve:** Prefer SQLite with migrations, transactions, constraints and WAL for local-first operation. If retaining JSON, add cross-process locking, version checks, fsync policy, corruption quarantine and tested recovery. Make initialization single-flight and seed only genuinely new projects. Implement real backup/restore: the CLI `project backup` currently reads metadata and prints `backup_complete` without creating a backup.

### 7. P1 — Diagnostics and operational status are hard-coded

**Evidence:** `server/storage.ts:runDoctorDiagnostics` reports fixed hardware, free space and encoder capability, sets FFmpeg unavailable without probing, and classifies every non-Windows machine as cloud. `server/routes.ts` account-health returns three fixed healthy accounts and credit balances. Storage stats estimate sizes from counts; cleanup-cache returns success without deleting anything.

**Improve:** Probe OS/CPU/memory/disk with Node APIs, FFmpeg/FFprobe availability with subprocesses, and encoder capability with a short encode test. Separate `configured`, `reachable`, and `verified` provider states. Label account/credit information unknown until sourced from a supported provider mechanism. Use filesystem measurements for storage and return actual cleanup results with preservation safeguards.

### 8. P1 — Audio and QC implementation does not satisfy the specification

**Evidence:** `src/core/flow.ts:527–583` synthesizes two continuous sine tones and filtered noise. The first stem is not an eight-pulse/three-second-rest envelope; there is no narration input or dialogue ducking. Single-pass loudnorm is used without measured loudness acceptance checks or explicit 48 kHz stereo output enforcement. Printing FFprobe metadata is not equivalent to checking all technical acceptance criteria.

**Improve:** Implement pulse envelopes, licensed/original narration, sidechain ducking, explicit sample rate/channel configuration, two-pass loudness normalization and post-render integrated-loudness/true-peak measurements. Assert duration, frame count, dimensions, rational frame rate, audio/video sync and decode integrity before approval. Handle missing required audio as failure, not a silent fallback.

### 9. P1 — Input validation and resource limits are insufficient

**Evidence:** Episode saves accept `req.body` as a typed object without runtime schemas (`server/routes.ts:242–250`); Flow plan creation coerces duration/fps with `Number` (`:884–894`). `calculateFlowBatchRequirements` (`src/core/flow.ts:54–83`) has no finite upper bounds. Extreme duration/fps requests can allocate enormous prompt plans and block the Node process. Settings are unrestricted partial merges.

**Improve:** Shared runtime schemas (e.g. Zod), immutable server-owned identifiers, enums and finite bounded integers. Enforce the specified duration ceiling, supported fps, maximum frame count and request-size limits. Add rate limiting and bounded worker queues; do not build large workloads synchronously in API handlers. Return consistent 400/404/409/422 errors rather than generic 500s.

### 10. P1 — Clean installation is broken and builds are not reproducible

**Evidence:** Normal installation failed with the Vite/esbuild peer conflict. No lockfile, Node engines declaration or CI workflow is present. Dependencies use broad caret ranges.

**Improve:** Align/remove the direct esbuild dependency after checking its usage, generate and commit a lockfile, specify a supported Node engine and use `npm ci` in CI. Run type checks, tests, build and dependency scanning on each PR. Avoid adopting `--legacy-peer-deps` as the permanent solution.

### 11. P2 — Research safeguards overstate their protection

**Evidence:** The URL guard in `src/core/sources.ts` accepts `http://[::1]/` because bracketed IPv6 hostnames are not handled. DNS resolution and redirect revalidation are absent. Current reviewed research routes validate/store URLs rather than performing a server-side fetch, so this is not a demonstrated active SSRF exploit. CLI `research add` marks ordinary claims verified with `humanApproved: true` without independent verification. Seed data also contains asserted approvals.

**Improve:** If fetching is added, use IP-aware parsing, DNS/public-address checks, redirect validation and network egress policy. Store new research as unverified; attach actual excerpts, source provenance and explicit human review events. Regex injection detection is advisory, not a reliable trust boundary; untrusted content must never gain tool or approval authority.

### 12. P2 — Frontend complexity, state races, and weak test assertions

**Evidence:** `GoogleFlowView.tsx` has 2,577 lines and `VideoEssayStudioView.tsx` 1,947. `src/App.tsx:45–88` loads requests sequentially, logs errors only, and does not cancel stale requests during project changes. Major views are eagerly imported, contributing to the measured 573.55 kB entry chunk. Project and episode defaults are hard-coded in multiple locations, including the plan output directory (`src/core/flow.ts:299`). Many tests assert generated strings or predeclared success values rather than real production outcomes.

**Improve:** Split views by feature; lazy-load heavy tabs with Suspense/error boundaries; centralize API access and query caching; parallelize independent reads and cancel obsolete requests. Reset episode selection on project changes. Make the active project/root explicit throughout every plan and render path. Enable strict TypeScript incrementally and add ESLint, accessibility and browser interaction tests. Ensure loading/error/empty/offline states are actually verified rather than checked off in documentation.

## Recommended delivery sequence

### Phase 1 — Truthfulness and containment
- Disable production claims for simulated runs; label demo-only features and unknown telemetry.
- Fix dependency resolution and commit a reproducible lockfile.
- Add runtime request schemas and centralized safe filesystem access.
- Add operator authentication/approval boundaries and fail-closed budget checks.
- Exit gate: no fake asset/QC can become production-verified; no out-of-root path accepted; no paid task without scoped approval.

### Phase 2 — One real vertical slice
- Choose one short original test episode (5–10 seconds) and one supported visual-provider path.
- Implement persistent worker execution, actual asset ingestion, narration/audio, FFmpeg export and measured QC.
- Serve exports through a contained, authenticated range-capable media endpoint.
- Exit gate: an integration test creates a playable MP4, then proves missing/corrupt frames and failed FFmpeg runs cannot succeed.

### Phase 3 — Durability and recovery
- Introduce transactional storage, spend reservations, artifact manifests and migration/backup/restore tests.
- Add restart/resume, cancel, idempotent dispatch and provider-unknown-effect reconciliation.
- Exit gate: crash/retry/concurrent-request tests show no duplicate spend and no lost updates.

### Phase 4 — Maintainability and release quality
- Split large views and routes, introduce shared services for CLI/API business rules, add lazy loading and query cancellation.
- Replace fixed telemetry and enforce explicit review and private-by-default handoff.
- Reconcile TASKS.md and requirements traceability with executable acceptance evidence.

## High-value regression tests to add first

1. Root sibling-prefix escape, encoded traversal, absolute paths, Windows separators and symlink escape.
2. Missing/mismatched/expired/revoked grant, invalid dates, NaN/Infinity/negative amounts, and concurrent reservations exceeding a cap.
3. Arbitrary filenames, duplicated frame numbers, nonexistent/corrupt/1×1 images, incorrect batch indices and partial final batch.
4. Orchestration cannot report completion or QC pass without measured artifacts; editorial review cannot be advanced anonymously.
5. Two simultaneous saves preserve both edits; corrupted JSON is quarantined, never silently replaced.
6. Real FFmpeg smoke render, loudness measurement, nonzero exit, cancellation and restart resume.
7. CLI/API parity, real backup/restore and settings/schema migration.
8. Rapid project switching, network failures, keyboard-only navigation and video chapter seeking in browser tests.

## Product-level recommendations

- Retain the local-first model; it fits media storage, FFmpeg and operator review. A hosted static frontend alone cannot run the current Express/filesystem pipeline.
- Prioritize a real measured short export over more dashboards or multi-account orchestration.
- Treat zero per-call API spend, subscription costs, generation rights, available credits and provider access as separate concerns. Do not assert perpetual capacity or verified pricing without evidence.
- Check provider-supported integration and terms before building browser/session-token automation; this audit did not verify external provider support, models, pricing or account allowances.
- Keep public publication explicitly human-authorized. Planning automation must not silently become release authorization.
