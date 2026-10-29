# BUILD PROMPT 7 — Hardening, release readiness and acceptance test

Run this final hardening phase after component Prompts 03–07 and integration Prompt 11 have been implemented. Follow `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` and test every applicable row in `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`: inspect the whole repository, state the bounded test/fix plan, and report evidence for every claim. This is not a request to add a mock UI. Produce evidence that the integrated app works end to end on the supported local Windows/WSL path. Do not ask the Build agent to change models.

---

Harden Ternfall Studio for real use, following `02_MASTER_PROJECT_RULES.md`. Do not declare “production-ready” merely because the AI Studio preview renders. Fix real defects, add missing tests/documentation, and explicitly list anything not verified.

## Security and privacy review

- Threat-model the loopback web server/browser boundary, filesystem root, project imports/archives, file uploads, research URLs and retrieved prompt-injection content, API/provider keys, OAuth tokens, child processes, generated prompts, OpenCode access, cost abuse, provider data egress, and public publishing.
- Audit for path traversal, symlink escapes, arbitrary file reads/writes, unsafe archive extraction, command injection, shell interpolation, SSRF, unrestricted CORS, CSRF, unauthenticated network access, unsafe HTML/Markdown rendering, SQL injection, prototype pollution, dependency vulnerabilities, secret leakage and personally identifying data in logs.
- Validate all client input server-side; cap request size, imported file size, line length, asset dimensions, generation batch size, provider concurrency, retries, subprocess output, memory and duration.
- Use explicit project-root allowlists and safe filenames. Do not trust AI-generated paths or commands. Keep local server bound to loopback unless a user deliberately configures remote access and authentication.
- Verify the actual listening address/ports; validate Host and Origin, use CSRF/session protections, and test hostile websites, DNS-rebinding-style Host headers, cross-origin requests, and unauthorized API calls against local endpoints. A loopback bind alone is not a complete browser security boundary.
- Make destructive changes reversible where possible; provide backup before migration/replacement. No deletion, publish, credential reveal, or paid batch without explicit user intent.
- Add dependency/security scanning with clear findings. Do not introduce silent telemetry, tracking pixels, external fonts/scripts, or upload user media to a provider without an explicit provider/cost/data-transfer notice.

## Data and recoverability

- Verify schema migrations from an empty database and a prior supported version.
- Test periodic backups, a user-triggered backup, restore to a new path, checksum verification, and recovery after a partially completed job.
- Provide a full project export containing the bible, scripts, scene manifests, review ledger, source/right records, prompts, metadata and generated outputs, excluding secrets. Test user-initiated export and deletion, retention cleanup, backup contents, and clear notices that deletion from an external provider may not be possible.
- Before a provider call, test that data-use/retention notice and consent are recorded, the user can cancel/disable the provider, and no request proceeds after consent is denied or the policy notice is stale/changed.
- Keep durable job recovery after app restart. A job interrupted mid-render/provider request must be marked interrupted or `unknown_external_effect`, not automatically repeated at full cost. Reconcile whether a provider charged/generated or a YouTube upload completed before retry; preserve the last known-good output.
- For every applicable row in `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`, record the failure state, detection, recovery, actual test or explicit NOT TESTED status, and user-facing remediation. Update the secret-free `docs/ai-build-ledger.md` after this phase and leave a precise next step.
- Provide a “show files in project” or export path only for configured local mode; do not expose raw server paths publicly.

## End-to-end acceptance scenarios

Run or document exact manual steps for the following real workflow:

1. Start with a clean Windows/WSL install; run setup, `studio doctor`, create a project and import the supplied story bible.
2. Validate the series bible; import seasons/arcs; expand only one 10-episode arc with a cost limit and approve a selected episode card.
3. Generate an outline and script with a configured provider or import an OpenCode-produced version; check word count, continuity, fact claims, version history and approval. Test factual research with a configured search source or user-supplied source; if none exists, research must report unavailable and never invent verified citations. Test a malicious prompt-injection string in a source and a blocked private-network/loopback URL.
4. Generate a scene plan; use approved references; generate one small media batch with an explicit paid-cost confirmation (or import licensed assets).
5. Create narration/captions, assemble timeline, render a test clip and long-form episode; verify actual output with FFprobe; make one 9:16 Short.
6. Run the technical and editorial checklists; export content package, captions, script, rights/source ledger and reproducibility manifest.
7. Prepare a local draft, then a private YouTube upload package; exercise OAuth with a test channel/account only if configured. Assert the API request explicitly sets `status.privacyStatus=private` (it must never be omitted), compare response and Studio status, and report official-document conflicts without assuming an audit lock. Verify channel upload caps, manual Studio fallback, OAuth app verification state, and separate human confirmation before public publishing.
8. Run the integrated `episode produce` workflow for one episode with an approved series bible and a bounded budget. Verify durable stage outputs, real provider/render status, cancellation/resume, stale-output invalidation, final package, and a human-readable Studio checklist. Run concurrent jobs at the cap and prove atomic budget reservation prevents overspend; also test unknown-cost handling. If a paid provider or local render capability is not configured, test the honest blocked/import fallback rather than claiming the episode was produced.
9. Import analytics from authorized API/export or show a clean not-connected state. Verify no fake metrics are seeded as production data.
10. Close/restart app; verify database, jobs, episode versions, assets and logs persist and recover.
11. Use OpenCode from the repo to read the project instructions, run a read-only continuity review, and draft one new version through the documented CLI. Verify permissions and path restrictions.

## Quality, accessibility and performance

- Test keyboard navigation, focus states, screen-reader labels, contrast, zoom/layout at laptop width, and meaningful errors.
- Avoid blocking the UI on renders or provider calls; use durable background jobs and progress events. Add cancellation and recovery.
- Benchmark realistic project sizes (at least 1,000 episode cards, thousands of scenes/assets metadata, and large local media files) using synthetic test data. Do not load all media files into browser memory. Add pagination/search/indexes and archive controls.
- Make media previews lazy and release browser object URLs/resources. Warn before low-disk-space jobs and estimate storage when possible.
- Verify rate limits and concurrent jobs do not exhaust tokens, API quotas, RAM, disk or file handles.

## Release package

Create/maintain:

- `README.md` quickstart and system architecture.
- `docs/windows-setup.md`, `docs/opencode-workflow.md`, `docs/providers-and-costs.md`, `docs/youtube-publishing.md`, `docs/backup-restore.md`, `docs/rights-and-policy-review.md`, `docs/troubleshooting.md`, plus `docs/requirements-traceability.md`, `docs/assumptions-and-decisions.md`, `docs/architecture-and-data-flow.md`, `docs/security-privacy-threat-model.md`, and `docs/release-evidence.md`.
- `.env.example` with names only; secure `.gitignore`; lockfile; sample project with original assets clearly marked sample; license/third-party notices.
- `CHANGELOG.md`, migrations, a release checklist, a known-limitations list, and scripts to start/stop/check local mode.
- A CI pipeline for lint, typecheck, unit, integration, build, secret scan, dependency audit, and available media smoke tests.

## Go/no-go rules

Do not call the app ready for monetized production unless all applicable criteria are met:

- Local persistence, backup/restore and migrations verified.
- No critical/high unresolved security issue; no secrets in repository/build artifacts/logs.
- Local CLI, OpenCode workflow, FFmpeg pipeline and failure recovery tested on at least one supported Windows/WSL installation.
- Provider billing/caps/rights and outbound data/retention notices are visible and enforced; project export/delete and backup boundaries are documented.
- Script, source, rights and continuity approval gates are real and auditable.
- Actual video and captions pass technical checks and human review.
- YouTube OAuth scope, upload visibility, disclosure, audience and public-publish approval work as documented.
- The first pilot is original, materially distinct, rights-cleared, and reviewed by a human.

If any criterion is not met, label the product **“pilot / not ready for public monetized production”**, identify the exact blocker and next steps, and never hide it behind green dashboard indicators. Report all commands run and their actual outcomes.
