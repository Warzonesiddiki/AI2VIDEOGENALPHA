# Research-informed audit and remediation — Ternfall Studio

**Date:** 2026-10-30
**Baseline:** commit `355c7023f7cba1417a1896a9713b9db26bc39ec3` on `arena/8b9eceb6-ai2videogenalpha`; this report also covers the cumulative uncommitted fixes in that working tree.
**Scope:** project isolation, identity and revision integrity, local rendering and recovery, HTTP boundaries, truthful product state, agent configuration, third-party skill provenance, tests and operations. This is a focused engineering review, not a penetration test, complete accessibility review or release approval.

## Executive assessment

The supported product is a **single-operator writing/planning workspace with a supplied-asset local renderer**. It is not a fully automated video-generation or publication pipeline. Several serious discrepancies were reproduced in temporary fixtures and fixed, including duplicate episode IDs, misleading readiness, stranded worker claims, a Doctor write-probe clobber, and cross-site browser writes without an Origin header. Other findings are mitigated only within explicit assumptions. Paid generation, new spend approvals, independent rights/editorial certification and publishing remain unavailable.

The [baseline independent audit](independent-audit-2026-10-30.md) preserves the before-fix findings. The [requirements ledger](requirements-traceability.md) and [remediation progress](remediation-progress.md) describe current scope. Do not infer that all defects are found or that a passing test makes the product safe for production or unattended multi-user deployment.

## Method and boundaries

- Reviewed the repository, tests, specifications, UI, routes, CLI, storage, worker, agent files and relevant upstream documentation; conducted independent read-only inspections in parallel and serialized dependent edits.
- Reproduced defects with disposable SQLite roots, synthetic metadata, synthetic media and local-only HTTP/browser fixtures. The tests do not use real project grants, personal content, billable generation or platform uploads. Synthetic ledger tests do not create production authorization.
- Used real Chromium against a local test server and actual FFmpeg/FFprobe against generated test fixtures. Browser automation detects exercised-page errors and requests; it is not a full accessibility or real-device assessment.
- Searched GitHub and documentation for skills, evaluated license/runtime fit and pinned copies. No unreviewed upstream installer, bundled skill executable, model provider or paid API was run.
- Evidence labels below: **R** = reproduced before a fix; **T** = targeted regression; **S** = source-confirmed; **C** = conditional risk. Severity reflects a local single-operator environment, not an assertion of a demonstrated remote exploit.

### Trust and data flow

Browser → authenticated/origin-checked Express routes → scoped validation and SQLite documents → supplied-input local worker → measured technical QC → hash-checked playback. OpenCode skills guide an agent but do not enforce this chain. For remote access, the shared operator credential and HTTPS deployment configuration are necessary but insufficient for multi-user hosting. Operator-controlled production directories and a same-host SQLite deployment remain assumptions.

## Findings and dispositions

### A1 — Identity collisions and legacy series mismatch (high; R/T; fixed for tested cases)

The baseline duplicate path could allocate an already used `S01E002` when legacy numbering fields differed. The Episode Board also guessed a series ID that did not match the stored active series. Ambiguous reads could target the wrong record, and valid legacy edits could fail.

`server/lib/episodeAllocation.ts`, `episodeCreation.ts`, `server/storage.ts` and `episodeCommands.ts` now allocate IDs transactionally above relevant legacy values, including public-ID-shaped database aliases, reject ambiguous identities, derive the active series server-side, and require idempotency for creation/duplication. Independent-process, replay and rollback regressions are in `server/episodeIntegrity.test.ts` and `server/arcExpansion.test.ts`. Existing mismatched series values can be preserved for ordinary edits; preview/apply/undo reconciliation requires explicit tokens and produces metadata backups/history (`server/episodeReconciliation.test.ts`). **No real reconciliation or migration was performed.** Unknown associations, pre-existing duplicate IDs and broader legacy schemas still require manual investigation.

### A2 — Draft and Flow provenance/readiness (high; R/T; mitigated)

An empty draft previously returned production readiness, and distinct episodes could receive identical pilot-specific prompts. The API/CLI now treat checks as advisory and never claim production approval; empty scripts are unevaluated. New Flow plans use bounded excerpts from the selected episode and record its revision. Unknown/stale source revisions block verification and checkpoints; saves compare source and plan revisions, including races during image inspection. Rechecking previously verified frames now durably revokes the prior proof before reading; a killed or failed recheck cannot leave that old proof marked verified after inspection starts. A Chromium reproduction also showed the old verification badge remained visible if the follow-up plan reload failed. The UI now clears stale evidence and blocks plan changes while the current state is unknown, with an explicit reload path. Existing plans remain readable and are not silently replaced. Relevant tests: `server/episodeIntegrity.test.ts`, `server/flowRecovery.test.ts`, `server/flowApiSafety.test.ts`, `src/core/flow.test.ts` and the browser smoke.

The resulting prompts are still **unreviewed scaffolds**, not individual creative storyboards. Image checks describe files at check time, not continuous rights, semantic or image-quality validation. Episode changes conservatively stale plans even when the changed field is not creatively relevant. Long plans still require server-side full-document parsing.

### A3 — Legacy pseudo-production and misleading tooling (high; R/S/T; retired)

Legacy Video Essay scripts could substitute synthetic placeholder media, print unsupported success and send narration to an external speech service if run. The essay endpoint returned unscoped pilot samples. A browser pseudo-CLI returned canned answers instead of executing the documented CLI. Three tracked render/audio shell scripts also bypassed the current measured-render contract.

Unsupported exports, fake UI execution and dead Flow handlers were removed or made fail-closed; the essay and pseudo-CLI endpoints return 410, while blocked production routes return 501. Tracked legacy scripts are refusal stubs; tests cover case/method variants, CLI rejection and no generated script artifacts. Previously exported copies are outside repository control and remain unsafe to trust. Real supplied-frame/audio rendering is still available; it neither authorizes paid providers nor publication.

### A4 — Worker claims and recovery (high operational; R/T; partial)

A post-claim work-path rejection could strand a job as `running` and block the shared queue. Setup now occurs inside failure/cleanup handling. A terminal-state persistence failure is recoverable only when that service instance knows its own claim has stopped; a live same-process worker is not inferred dead. Fault injection exercises path rejection, terminal-write failure, active-worker non-theft and cleanup failures in `server/localMedia.test.ts`.

A later isolated reproduction found that duplicate render IDs across projects let a scoped cancel mutate the first matching other-project record. A scoped read/mutation race was also reproduced. Job identities are now globally checked for duplicates, and every mutation rechecks project scope inside the transaction. When a fixture replaced the owner of a still-running same-attempt record, the stale worker also changed its timestamp and removed fixture files; stale failure transitions now avoid the metadata write, and cleanup checks owner/attempt before deleting. The filesystem check and deletion are not one atomic operation, so hostile/concurrent local mutation remains out of scope. Another reproduction showed a worker that died after an already-running server started could block the queue indefinitely. The server now periodically checks for interrupted claims without automatically retrying them. On Linux, claims record boot and PID-namespace identity; a foreign process is recovered only when host/domain match and the PID is absent on a transactional recheck. Idle preflights avoid writes and writer transactions. `server/localMediaReliability.test.ts` covers contention, permission errors, reused/live PIDs, unknown domains and failed writes.

**Still open:** Unknown/legacy claims and non-Linux cross-process crashes intentionally remain blocked because their process domain cannot be proved; there is no approved offline ambiguous-claim repair or cross-host lease. PID reuse can delay recovery. Orphan child processes, every crash/rename/commit boundary, cleanup under persistent disk failure, and conservative queue limits remain unresolved. Source directories must remain operator-controlled; the changes do not establish safety against an adversarial local filesystem actor.

### A5 — Doctor diagnostic write clobber and concurrency (medium/high under local filesystem mutation; R/T; narrowed)

The baseline used `writeFile(.test_write_<Date.now()>)` for a writable check. In an isolated fixture with the clock fixed and that name symlinked to a sentinel, the diagnostic replaced the sentinel content with `ok`; six concurrent checks also collided and reported inconsistent writability. This is a **local pre-existing-symlink/predictable-name scenario**, not a demonstrated remote exploit.

The probe now uses a random name and an exclusive create with restrictive permissions, and attempts cleanup only when that create succeeded. Cleanup failures are reported rather than silently described as clean. Three regressions exercise the old symlink scenario, concurrent checks and cleanup failure (`server/auditRemediation.test.ts`). Ancestor replacement and hostile local filesystem races are not fully solved. Doctor still has filesystem/process side effects and should not be treated as a pure GET or invoked on production data as an audit shortcut.

### A6 — Browser origin and hosted access (high before wider deployment; R/T; defense in depth)

A browser-shaped unsafe request with `Sec-Fetch-Site: cross-site` and no Origin previously passed the access middleware in a fixture. Unsafe cross-site and same-site Fetch Metadata requests are now rejected even when Origin is absent; existing host/origin and operator credential checks remain. `server/security.test.ts` tests representative requests.

Fetch Metadata is not universal and can be omitted by non-browser clients; this is **not complete CSRF protection**. There is no per-user identity, session/credential rotation service, authentication rate limit, comprehensive deployment hardening or third-party penetration test. Eleven legacy read-route 500 responses now suppress unexpected exception details and set `no-store`. Exercised local-render, Flow, project, episode, arc, settings, series, research and outline mutation/check routes use fixed public validation/conflict messages and generic unexpected errors; local-render jobs additionally use a browser-safe projection. Tests inject forged error codes, raw worker/adapter/storage failures, missing-frame paths and ownership/checkpoint secrets. Detailed worker errors remain available through the local operator CLI. Flow rechecks now commit revocation before reading frames: failures before the final evidence commit leave that revision pending unless another writer has committed a newer plan. If the initial revocation reports an error, no frames are inspected; old evidence may remain or revocation may already have committed. A final write can also report an error after committing, so clients must reload rather than assume either outcome. Successful response fields, untested paths and overall credential handling are not comprehensively reviewed. Keep external binding behind a reviewed HTTPS single-operator deployment, and do not treat it as a multi-user service.

In isolated HTTP fixtures, successful settings responses exposed a synthetic provider token, nested legacy extras and the local production root; project responses exposed local roots and unknown fields. Settings and project GET/mutation responses now use validated allowlists and `no-store`, while local operator storage remains detailed. A normal settings save previously persisted a demoted provider read view; it now preserves unrelated raw legacy fields. Project list/get rejects a stored identity that differs from its directory, and malformed public project metadata fails closed. Zero budget caps now display as zero; unsupported currency or missing values are unavailable rather than fabricated. These targeted improvements do not establish privacy of other successful endpoints, malicious content in intended user-visible text, hostile local writes or hosted multi-user security.

### A7 — Cross-project assumptions and truthful interface (medium; R/S/T; improved)

Project/episode selection is propagated through the browser and APIs; default Ternfall canon and roadmap are scoped to the original project, while new projects receive a blank bible. Script versions are append-only on ordinary saves, with stored beats and pronunciation notes preserved. The player, scene, YouTube, Flow, jobs and Doctor views no longer present simulated outputs, historical logs, provider prices, or unprobed capabilities as verified. Outline inputs require explicit project context. See `server/scopeSafety.test.ts`, `src/core/scriptVersions.test.ts` and the browser smoke.

A partial automated test cannot establish all React race handling, draft preservation, keyboard access, real-device layout or accessibility. Human editorial, rights and scientific checks remain necessary; advisory keyword matching cannot certify canon compliance.

### A8 — Research and prompt-injection claims (medium; S/T; explicit limitation)

Research capture validates bounded data and rejects selected local/private literals and selected instruction patterns. The checks do **not** resolve DNS, check redirects or every reserved address, fetch or fact-check sources, or reliably detect all prompt injections. UI labels, CLI help, comments and traceability now describe these as advisory rather than a shield. Saved real-world notes remain unverified, and untrusted notes must never acquire tool or approval authority.

If network retrieval is later introduced, design an explicit fetch authorization layer with validated addresses for every connection/redirect, network egress policy, size/time limits, and independent review; the current URL checker is not that layer.

### A9 — Backup, storage and resources (high before reliance on production; S/C; open)

**Subsequent remediation:** an offline, operator-attested metadata-plus-production-root-file bundle and isolated staged restore now use SQLite `VACUUM INTO`, a versioned inventory and SHA-256 checks. Synthetic tests cover WAL, an otherwise empty recovery root, mutation, corruption, symlinks, simulated ENOSPC, cleanup failures and interrupted processes. See the [backup runbook](backup-and-restore.md). `studio project backup` and reconciliation backups remain metadata-only.

The combined SQLite/filesystem snapshot is not atomic; stopping all writers is mandatory and cannot be proven by the confirmation flag. Bundles are initially on the source disk and must be independently copied by an operator. No full production-sized restore, power-loss, hostile-filesystem or production promotion/rollback rehearsal was performed. A missing default-project directory could also cause startup to overwrite existing SQLite documents with seed data; this was reproduced in an isolated fixture and startup now refuses to reseed when any default-project document exists (`server/storageInitializationSafety.test.ts`).

The Flow browser requests summaries/pages but the server parses the full saved plan; no bounded-memory streaming or representative large-plan load test was established. The local renderer remains limited by real CPU, disk, native decoder and input characteristics, despite request-size ceilings.

### A10 — Agent skills, permissions and supply chain (high for agent deployment; S/T; partial)

The existing OpenCode config used an unsupported permission shape for the tested OpenCode 1 runtime and agent overrides could weaken the intended rules. The checked-in config now uses OpenCode 1 native permission syntax, conservative default prompts and restricted reviewer permissions. Twenty tailored skills and 12 pinned upstream skills are catalogued at [`.opencode/skills/README.md`](../.opencode/skills/README.md), with license files and SHA-256 records. Isolated OpenCode 1.19.5 discovered and individually loaded all 32 with its native skill tool; effective configuration/agent permissions were inspected. `server/agentConfig.test.ts` checks structural policy and digest consistency.

Instructions, permission globs and shell rules are **not an OS sandbox**; a permitted shell command can bypass path-level read rules. Verify effective permissions, isolation, data egress, model/privacy policy and consent on the actual runtime. OpenCode 2 has a different configuration format. The 32-skill set is broad, not proof that all useful skills on the internet were found or that a model will invoke/obey them. Upstream CodeQL/Semgrep templates have not been executed or validated. Other candidate repositories were reviewed but not blindly installed because of licensing, dynamic instructions, helper execution or missing runtime dependencies.

### A11 — Product claims, testing and release evidence (medium; S/T; open)

The original specification and traceability sheet described unimplemented autoproduction as active/PASS. They now separate aspirations from current capabilities and blocked requirements. The historical blueprint is explicitly marked unverified. The browser test exercises representative workflows at desktop and mobile widths, but not every view, screen reader, keyboard sequence, browser or OS.

A pinned, read-only GitHub Actions validation workflow has since been added to this working tree; it has not yet run on GitHub and needs authorized review/push. Native FFmpeg test fixtures are old and are not validated by npm's advisory scan. `npm audit` reported no known vulnerabilities at the time checked; `npm audit signatures` failed with a network `ECONNRESET` when obtaining Sigstore metadata, so independent signature verification was **not established**. Windows, maintained production FFmpeg builds, long-running reliability, independent accessibility testing and authenticated deployment penetration testing remain outstanding.

### A12 — Mobile navigation semantics and keyboard focus (medium accessibility; R/S/T; scoped improvement)

The mobile drawer originally lacked an expanded-state/controlled-element relationship. Source inspection also found no focus transfer, keyboard containment or focus restoration when the visually blocking overlay opened and closed. A Chromium regression first failed on the missing `aria-expanded` state.

The trigger now exposes `aria-expanded`, `aria-controls` and dialog intent. The mobile drawer has a labelled dialog and explicit close button; opening makes the main viewport inert and moves focus inside, Tab/Shift-Tab cycle through its visible controls, Escape/close/backdrop restore focus to the trigger when visible, and widening to desktop closes the modal state and focuses the active navigation item. The smoke test exercises these behaviors at one mobile viewport and the desktop breakpoint. This is a targeted improvement, **not** a full WCAG or assistive-technology review; screen readers, touch devices, other browsers and other dialogs still need testing.

### A13 — Mutable validation inputs across async persistence (high for in-process callers; R/T; narrowed)

An isolated same-process caller changed a settings object after its validation but before the awaited storage operation resumed; the reproduced write stored an invalid timezone and could include a protected settings field. The series path also lacked an invocation-time snapshot, and research validation retained nested-array references. These are not demonstrated cross-process or remote HTTP exploits: the reproduction held a JavaScript reference in the server process. Settings, series and research writes now deep-clone their inputs before validation and asynchronous persistence. `server/mutationApiSafety.test.ts` mutates the caller's objects immediately and verifies the persisted snapshots. This does not protect SQLite or files from an independently privileged local process, nor does it complete nested schema validation.

## Skill research and selection

The reviewed pinned sources and license texts, included files, safe-use restrictions and twenty domain-specific skill mappings are documented in the [skill catalog](../.opencode/skills/README.md). In brief, the acquired external skills cover property-based testing, variant analysis, verification, accessibility, database, performance, dependencies, architecture, claims, TypeScript, Node testing and Playwright frontend design; the custom skills cover architecture, security, SQLite, isolation, Flow, media, recovery, UI, editorial quality, release, supply chain and collaboration. Templates and instructions are not a substitute for executing a relevant test or using independent judgment.

## Validation and reproducibility

Original audit results on Node 22.22.3 and npm 10.9.8 (later work is summarized immediately below):

- `npm run lint`: passed. `npm test`: **214 passed, 0 failed, 1 skipped** (215 total); the skip is the opt-in long media fixture.
- Production Vite build and isolated Chromium smoke: passed. The smoke used an existing temporary Chromium with sandbox disabled for this container and additional temporary system libraries; it exercised the workflows listed in the [progress ledger](remediation-progress.md), including mobile focus containment, background inertness and resize, with no external page requests observed. It is not a security, accessibility or cross-browser certification.
- `npm audit --audit-level=high`: 0 reported vulnerabilities. Upstream skill/license SHA-256 manifest, main-document local links, and `git diff --check`: passed. `git diff --name-only -- data/production_root` was empty for tracked production files.
- Native OpenCode 1.19.5 skill-tool checks loaded **32/32** individually in isolated temporary homes, without a model/provider. Effective permission configuration was inspected; this does not establish an OS sandbox.
- Initial integration validation exposed an obsolete test expecting the retired autoproducer and a browser assertion expecting an empty visual note where the fixture supplied one. Both were corrected to assert actual fail-closed/episode-specific behavior, and the complete suite and browser smoke were rerun successfully.

**Subsequent Batch 17 validation:** 240 passed, 0 failed and one opt-in long-render test skipped (241 total) on Node 22.22.3 and Node 22.13.0 using the existing installed dependencies. Lint, production build, isolated Chromium smoke, npm advisory audit (0 reported vulnerabilities), skill hashes, changed-document links and diff checks passed. A real one-second synthetic render was backed up, staged and reopened through hash-verified playback. The added GitHub workflow was parsed and its shell blocks syntax-checked locally, but has not been run by GitHub. No production data, actual off-device backup, long render or publication was involved.

**Subsequent Batch 18 validation:** 266 passed, 0 failed and one opt-in long-render test skipped (267 total) on Node 22.22.3 and Node 22.13.0 using the same installed dependencies. Lint, production build, isolated Chromium smoke (including missing-frame and failed-render paths), npm advisory audit (0 reported vulnerabilities), skill hashes, documentation links and diff checks passed. An actual server and separate synthetic worker exercised post-start death recovery; injected errors and three competing processes covered identity, scope, liveness and rollback. A killed Flow recheck, write failures and concurrent replacements exercised revocation-first evidence handling. Chromium ran without its sandbox in this container. Hosted CI has not run; no production data, new long render, paid generation or publication was involved.

**Batch 19 validation:** 277 passed, 0 failed and one opt-in long-render test skipped (278 total) on Node 22.22.3 and Node 22.13.0 with the same installed dependencies. Lint, production build, isolated Chromium smoke, npm advisory audit (0 reported vulnerabilities), skill hashes, workflow YAML parsing, local documentation links and diff checks passed. Tests covered typed mutation error boundaries, rollback on injected writes and same-process input snapshots. Chromium ran without its sandbox; hosted CI and the long render were not run.

Core commands:

```sh
npm run lint
npm test
npm run build
npm audit --audit-level=high
git diff --check
(cd .opencode/skills && sha256sum -c licenses/upstream-SHA256SUMS.txt)
# Optional: supply an existing compatible local browser; the test uses an OS temp root.
CHROMIUM_PATH=/absolute/path/to/chromium npm run test:browser
```

The long 900-second/21,600-frame render is opt-in (`STUDIO_LONG_MEDIA_TEST=1`) and was not rerun in this review; a historical result is not fresh evidence. Automated tests use synthetic fixtures and development FFmpeg binaries, not actual production media. No production project records or assets were changed as part of this audit.

## Recommended next work

1. **Backups first:** independently retain and verify copies, rehearse full-size recovery and power/disk failures, and design explicit operator-reviewed promotion/rollback; never delete source assets during testing.
2. **Worker operations:** robust owner identity/leases for supported environments, orphan inventory and safe cleanup; more crash-point/fault-injection and capacity tests.
3. **Access and schemas:** deployment threat model, session/rate controls, uniform safe API errors, complete nested schemas/import rules and cross-process conflict tests.
4. **Release evidence:** review, push and observe the new CI workflow; validate maintained native binaries, the opt-in long test, Windows/macOS/Linux coverage, real-device and independent accessibility/security review.
5. **Product expansion:** only after explicit authorization and risk assessment, design provider integration, consent/spend limits, factual/rights/editorial provenance and operator-controlled private/public handoff. Do not re-enable simulated paths as a shortcut.

## Research references

- OpenCode skill discovery, agent configuration and permissions: [skills](https://opencode.ai/docs/skills/), [permissions](https://opencode.ai/docs/permissions/), [agents](https://opencode.ai/docs/agents/). Effective versions/config layers must be checked locally.
- OWASP CSRF guidance: [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html); [LLM prompt-injection guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html). Pattern filtering alone is not a trust boundary.
- OWASP testing methodology is context-dependent, not a universal compliance checklist [1](https://wstg.owasp.org/latest/2-Introduction/).
- SQLite WAL same-host requirements and limitations [1](https://www.sqlite.org/wal.html).
- npm provenance/signature checking [1](https://docs.npmjs.com/viewing-package-provenance/); a failed verification must not be reported as a pass.
- W3C WCAG 2.2 focus guidance [1](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/); see also [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) for the limits of automation.
- [Node.js filesystem guidance](https://nodejs.org/learn/manipulating-files/working-with-different-filesystems), [FFprobe documentation](https://roundup.ffmpeg.org/ffprobe-all.html), and [NIST SSDF](https://csrc.nist.gov/projects/ssdf) informed operational assumptions, not a certification.
