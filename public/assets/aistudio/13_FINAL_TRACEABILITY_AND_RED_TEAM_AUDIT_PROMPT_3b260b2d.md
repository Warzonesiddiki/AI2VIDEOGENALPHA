# FINAL AUDIT PROMPT (PHASE 8) — REQUIREMENTS TRACEABILITY & RED-TEAM REVIEW

**Run this after Prompts 03–07, Integration Prompt 11, and Hardening Prompt 08. Run it before any public launch, production-scale spend, or monetized publishing.** Follow `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md`: inspect the actual repository and evidence, make no unapproved paid/public/destructive calls, and report tested versus untested facts. This is a final evidence audit, not a new mock UI or a promise that every possible risk has been eliminated. Do not ask the Build agent to change models.

## Mission and audit rules

Read `00_START_HERE.md`, `01_RESEARCH_AND_OPERATING_PLAN.md`, `02_MASTER_PROJECT_RULES.md`, all applicable build prompts `03`–`08`, the integration prompt `11`, the series bible `09`, the YouTube upload runbook `12`, `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` and `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`. Inspect the real application repository, tests, local Windows/WSL setup, environment/configuration, migrations, current official provider/platform documentation, and available logs. Verify that build instructions target AI Studio's current default Build agent and do not ask it to switch to Claude; distinguish that agent from OpenCode and runtime media/text providers. If the prompt pack or repository is not available in the current AI Studio project, request/import it before claiming a complete audit.

The goal is to find missing requirements, contradictions, unsafe assumptions, untested behaviors, stale policy/technical claims, and scope creep. Do not infer success from a UI, green indicator, documentation statement, mock, or code that was never executed. Do not run paid generation, connect a real channel, upload, publish, schedule, delete, overwrite, or expose secrets during this audit unless the operator separately authorizes that exact action. Prefer fixtures, dry-run mode, and private test resources.

Never claim “nothing can go wrong,” “perfect,” “fully compliant,” or “guaranteed successful.” If a requirement cannot be proven, mark it **BLOCKED** or **NOT TESTED**, name the evidence needed, and do not hide it in prose. Correct prompt/code conflicts safely, in small changes, and test each change. Do not broaden the project into public multi-user SaaS or a native `.exe` unless the operator explicitly changes scope.

## Required evidence ledger

Create or update these files in the application repository:

1. `docs/requirements-traceability.md` — one row per material user requirement and master-rule requirement, with: stable ID; source prompt/file and section; priority (`P0` release blocker / `P1` needed for safe pilot / `P2` later); expected behavior; implementation location; test name/command; actual evidence; status (`PASS`, `PARTIAL`, `FAIL`, `BLOCKED`, `NOT TESTED`, `NOT APPLICABLE`); remaining work and owner. Do not mark a row PASS from a mock or prose alone.
2. `docs/assumptions-and-decisions.md` — every choice the user has not yet made, with recommended safe default, impact, whether it blocks implementation, and a decision field. At minimum cover: production language(s)/locale; intended audience; local-only vs any hosted mode; provider choices and account tier; per-run/per-episode/monthly budget and currency; provider data-use/retention consent; project/backup retention; long-form/Shorts count; channel identity; YouTube Studio vs optional Data API; and production IANA timezone. Do not silently choose `Asia/Kolkata`, a language, budget, monetization setting, or `made for kids` answer.
3. `docs/architecture-and-data-flow.md` — local UI/service/worker/storage boundaries; hosted-preview differences; every external network/data flow; credentials path; export/backup/delete behavior; and which actions are local, paid, or publish-capable.
4. `docs/security-privacy-threat-model.md` — data classification, trust boundaries, threats, mitigations, tests, residual risk, provider disclosure/retention caveats, and incident/revocation steps.
5. `docs/release-evidence.md` — exact environment, OS/WSL versions, commands, test output summaries, render/API/provider evidence, skipped tests, known limitations, reviewer, and go/no-go decision.

Keep these release-evidence files concise enough to maintain but detailed enough that another engineer can reproduce the evidence. Link each PASS row to a real test/report/output and never include credentials, tokens, private source text, or user secrets. Maintain `docs/ai-build-ledger.md` separately as a short, secret-free AI Studio continuation record per `14`; it is not a substitute for the release evidence ledger or real test results.

## Coverage audit — no requirement may be orphaned

Trace each requirement through **request → prompt/spec → implementation → test → operator documentation**. At minimum audit the following:

### Product and operating scope

- Original, continuity-aware zombie-survival storytelling; the original *The Quiet Hours: Ternfall* bible; 1,000-episode roadmap as a planning structure, not a batch of 1,000 scripts; roughly 15-minute long-form episodes; configurable Shorts. Treat the user's 10-video/day ambition as an optional capacity/planning view subject to account limits, quality, cost, and human review—not as a default publishing quota or KPI.
- A Windows 10/11 local-first, single-operator app built/iterated in Google AI Studio Build, exported/synced, launched through documented PowerShell or WSL steps, with OpenCode available through a narrow CLI. Verify local project operations remain usable offline when providers are disconnected. Clearly distinguish the hosted preview from the local production runtime. Confirm the app is a local browser-hosted service, not a native desktop binary, unless a tested installer exists.
- User can choose language/locale, channel, target duration, format, timezone, currency, provider(s), output root, per-run/per-episode/monthly spend limits, and approval profile; uncertain defaults are visibly confirmed.
- One understandable, resumable `Produce Episode` workflow with real progress and recoverable partial outputs—not disconnected mock buttons.
- Prompt execution quality for the user's current AI Studio Build agent: all phases reference the same mandatory playbook and failure matrix, have bounded scope/prerequisites, explicit deliverables and acceptance tests, ask only for truly blocking decisions, and do not require a switch to a different coding model. No prompt relies on the builder's self-report or requests hidden reasoning as evidence.
- A secret-free `docs/ai-build-ledger.md` is updated after each AI Studio phase and supports a new-chat/context-loss recovery. The agent verifies its contents against actual repository state rather than trusting its own previous summary.

### Brainstorming, research, story and continuity

- Original brainstorming can run without internet. Current factual/market research uses a configured documented source or user-supplied material; if no research tool is configured, say unavailable. Model memory, invented URLs, or unsupported snippets never become verified facts.
- Source provenance, date/evidence, human fact-check, prompt-injection defense, URL validation, SSRF/private-IP protection, source-site/provider terms, and no substantial copying of protected text.
- Continuity, episode distinctness, original character/visual identity, version history, canon approval/retcon impact, script runtime measured from the actual selected voice, and no filler or competitor imitation.
- Fictional survival details are not presented as real medical, engineering, public-safety, or emergency advice. Safety/age review and any real factual claim have an accountable human decision.

### Providers, privacy, cost and rights

- Every optional model/search/media/voice provider is capability-checked and honestly marked unconfigured when absent. Manual/local import remains available where supported.
- The provider registry records exact provider, API surface, model ID, stable/preview/retired status, modality, supported inputs/outputs/limits, region/tier, rate limits, price unit, official source and checked date. Unknown/retired IDs fail closed; no silent provider/model/quality substitution. Leaderboard rank is not treated as API availability or a modality-specific quality guarantee.
- AI Studio Build's coding agent, the separate OpenCode CLI model and app runtime providers have separate configs, credentials, costs and data flows. The prompts must not tell AI Studio to choose Claude or imply that an LLM leaderboard controls the app's image/video/TTS provider.
- Before data leaves the PC, show provider/account tier, input types/files, current data-use/training/retention terms and link/date, whether a charge may occur, and obtain consent. Re-check changed terms. Do not promise zero retention, commercial exclusivity, copyright clearance, or that local-first means all processing is local.
- Enforce atomic budget reservations across concurrent calls, retries, formats, and episodes; reconcile actual billed usage where available; require new approval for over-cap or unknown-cost work. A budget number passed by OpenCode/CLI is not consent: test that human-issued approval grants are scoped, expiring, single-use/audited as designed, and cannot be minted, widened, replayed, or used by an agent outside their approved scope. Test timeout/unknown-charge behavior so retries do not silently double-spend.
- Rights/provenance/consent for every imported/generated image, clip, music/SFX, font, voice, likeness, model, sample, and thumbnail; document license evidence/terms and commercial-use limits. No unauthorized voice cloning, real-person likeness, named-artist imitation, or unlicensed commercial assets.
- User-controlled export, archive/delete, retention, backup/restore, token revocation, secret exclusion, and honest limits on deleting information already sent to third parties. No hidden telemetry or cloud sync by default.

### Media production and technical quality

- Version-linked scene/shot plan and assets; separate 16:9 long-form and 9:16 Shorts; limited animation is accurately labelled; Shorts are coherent edits, not blind crops.
- A 15-minute episode is assembled from approved shots/audio/captions using the real render pipeline; no single-call 15-minute AI-video claim. For any chosen video provider, validate its current maximum clip duration, resolution, aspect ratio, audio behavior, API method and cost; calculate total seconds/retries before spending. Recheck provider retirement status: at the 29 Oct 2026 research snapshot, Gemini Omni Flash is `gemini-omni-1.1-flash` with 3–10s outputs and old Gemini API Veo 3.1 Preview IDs are retired. Treat that as a dated fact to reverify, not a permanent model lock.
- Real narration/audio mix, pronunciation review, caption generation/alignment from final audio, editable SRT/VTT, and text-safe layouts.
- Real FFmpeg/FFprobe rendering and QC evidence: existence/playability, resolution/aspect, duration, frame rate, codecs, audio stream/clipping/silence, captions, missing/black frames where feasible, file size, and nonzero failures. No “pass” without evidence; operator playback review remains required.
- Versioned exports, checksums, deterministic package contents, no secret leakage, safe filenames/paths, atomic finalization, stale-artifact invalidation after upstream edits, and no silent overwrites.

### YouTube preparation, upload and policy

- Per-file metadata package and actual step-by-step Studio instructions for long-form and Shorts; audience, age restriction, rights, altered/synthetic disclosure, captions, checks, thumbnail, visibility, notifications and schedule are human-reviewed decisions.
- Uploading and publishing are distinct states. API use is optional; default manual Studio handoff is always available. If API upload is enabled, request the minimal needed OAuth scopes, use the correct installed-app/hosted OAuth flow, validate state/PKCE/redirects, protect/revoke tokens, and meet current Google OAuth app verification/consent requirements.
- For Data API upload, explicitly set `status.privacyStatus=private`; never omit it, because current method docs say omission can default to public. Reconcile requested and actual `status.privacyStatus` and YouTube Studio status. Record the unresolved official-documentation conflict about unverified-project private locks; do not claim either as universal or promise public API publishing before a real authorized test.
- Distinguish Google API quotas from channel upload caps. Recheck current `videos.insert`, project quota, channel eligibility/limits, Shorts rules, synthetic-media disclosure, thumbnail rules, monetization policy and current Studio UI at release time. Search results and old policy snapshots are not a substitute for the official current page.
- Public/scheduled publication, paid promotion, deletion, and changes to visibility must require a separate immediate human approval; API timeouts must reconcile before retry to prevent duplicates. The app does not scrape/automate Studio UI or fabricate analytics.

### Windows, OpenCode, security and reliability

- Startup/stop/doctor, local-only bind, supported WSL/native paths, version checks, FFmpeg/OpenCode detection, storage root, Windows/WSL path handling, and backup/restore are actually tested or explicitly untested.
- Every applicable failure class in `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md` is traced to detection, persisted status, safe recovery, regression test and user documentation; add newly discovered cases rather than marking the matrix “complete” by assertion.
- Job states distinguish blocked/paused/needs-user/recoverable vs terminal failure/cancelled; remote operations distinguish confirmed completion from `unknown_external_effect` and require reconciliation before possible duplicate calls/uploads.
- OpenCode uses current documented config/permissions; no dangerous auto-approve flags; agents cannot read secrets, write outside project root, raise budgets, delete data, or publish publicly. CLI uses typed arguments, JSON mode, exit codes, path validation and safe child-process argument arrays.
- Red-team path traversal, symlink escape, malicious archive/zip bomb, oversized files, SQL injection, XSS/unsafe Markdown, SSRF, prompt injection, CORS/CSRF, Host-header/DNS-rebinding-style requests, local-port abuse, command injection, OAuth CSRF, secret leakage, rate/cost abuse, duplicate jobs/uploads, power loss, and partial DB/filesystem failures.
- Verify dependency licenses/security findings, no unreviewed production vulnerability, no uncontrolled telemetry, accessible keyboard/focus/screen-reader/contrast behavior, laptop layout, and search/pagination at 1,000+ episode-card scale.

## Cross-document consistency check

Search the entire prompt pack and repository for contradictions in: phase order and prompt numbers; app/CLI names; AI Studio Build agent versus OpenCode versus runtime models; any instruction to switch the Build model; dated ranking category/snapshot; active versus retired provider/model IDs; media duration/resolution/price claims; local versus hosted capabilities; local path formats; approval states; per-run versus monthly caps; paid-call authorization; data-use/retention disclosures; timezone defaults; script/canon approval; generated-vs-rights-cleared assets; API privacy defaults; OAuth app verification versus YouTube API audit; Shorts/long-form limits; upload versus publish state; quality claims; and what “done” means. Fix the source documents or implementation so one rule is authoritative. Record any unresolved external-document conflict with links, check date, safe implementation behavior, and test. Fix the source documents or implementation so one rule is authoritative. Record any unresolved external-document conflict with links, check date, safe implementation behavior, and test.

## Release decision

Conclude with a one-page GO / CONDITIONAL GO / NO-GO summary. A public-production GO requires all P0 rows to pass with evidence, no unresolved critical/high security issue, an actual Windows/WSL pilot, real provider/render/QC evidence, data-use and budget consent verified, recovery tested, and a human-approved YouTube handoff. If any key integration is not configured, clearly classify the product as a local pilot or incomplete—not production-ready. List all blocked/not-tested rows and exact next steps.

Do not claim this audit proves universal completeness. State what was inspected, what was not, which sources were checked and when, and what could still change.