# START HERE — Zombie Survival Video Studio

Prepared 29 October 2026. This folder contains a research brief, a product plan, staged copy-paste prompts for Google AI Studio Build, an end-to-end episode-autoproduction prompt, a Windows YouTube Studio upload runbook, an original long-running series seed, and a final requirements-traceability/red-team audit prompt.

## What this package is—and is not

This is a **production brief and prompt pack**, not a claim that a single prompt can instantly create a finished studio or 1,000 polished scripts. It now specifies an end-to-end, supervised episode autoproducer: original premise/story and script → scene/shot plan → configured visual/audio generation → captions → real video render and QC → metadata/thumbnail package → a tailored, step-by-step YouTube upload handoff. A later orchestration prompt integrates those capabilities after the component prompts are built. Google AI Studio Build generates a full-stack web app (React client + Node.js server), can sync/export code, and can deploy it; Windows-local file access, FFmpeg rendering, OpenCode CLI, provider credentials, and YouTube OAuth still need real implementation and testing on your PC. The prompts require the build agent to verify each capability rather than show fake success states. No app or provider integrations have been built or tested in this workspace.

## Important model distinction

The top-model leaderboard research in `01_RESEARCH_AND_OPERATING_PLAN.md` was used as a quality benchmark for preparing this prompt pack. **It is not a requirement for Google AI Studio to select Claude or another coding model.** Build with the current AI Studio Build agent/model available in the user's project (the user expects its latest Flash model); do not ask the builder to switch models or pretend that a model used by the finished app is the same as the model writing code. These prompts are deliberately explicit so the default builder can follow them, with the evidence-first execution and context-recovery procedure in `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` and cross-cutting failure/recovery contract in `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`. Rankings are dated, task-specific research—not a universal guarantee.

The story file contains an original series bible, a 10-season / 100-arc backbone (10 episodes per arc = a planned 1,000-episode destination), and a pilot beat sheet. It is **not** 1,000 complete 15-minute scripts. A 1,000 × 15-minute series would be 250 hours of finished video and roughly 2.1–2.4 million spoken words at 140–160 words per minute. The right system generates one approved episode at a time, expands the roadmap in small continuity-checked batches, and saves every approved version. The pack tells the app how to do that.

## Important research limitation

Instagram blocked direct page retrieval during this research, and I could not verify the supplied `@chintunomics` account’s individual Reels or analytics from reliable indexed sources. I did find first-party Beanie Survives material and public/indexed examples, plus the HubPages manhwa recommendation list. The research brief labels what is observed versus inferred; it does not claim privileged access to either channel’s analytics or production workflow.

## Decisions the app must ask you to confirm

These choices are intentionally not guessed by the prompt pack. Configure them during onboarding or before first production; keep them editable:

- Story/narration languages, locale and audience (including the separate YouTube **made for kids** decision).
- Local production root, backup/retention plan, and whether any future hosted mode is wanted. The safe initial mode is single-user/local-only.
- Text, research/search, image/video, voice, music and transcription providers; account tier; current data-use/retention terms; what unpublished story material may leave the PC.
- Per-run, per-episode and monthly spend caps, currency, retry/concurrency limits, and the autopilot approval profile.
- Whether Shorts are produced, how many per episode, and the target aspect ratio/runtime; review each Short as its own edit.
- YouTube Studio manual handoff (recommended default) or optional Data API; channel identity, OAuth app setup, and which upload actions remain human-only.
- Production timezone as an explicit IANA value before scheduling. Asia/Kolkata is a plausible suggestion for this user, but it must be confirmed rather than silently assumed.
- Pilot publishing cadence. The ambition to support ten daily slots is not a default publishing instruction and must respect quality review, cost and actual channel limits.

## Recommended order in Google AI Studio

1. Open **Build mode** at <https://aistudio.google.com/apps> and choose a **web app**, not Android.
2. Read `01_RESEARCH_AND_OPERATING_PLAN.md`. Treat it as dated decision context; do not paste the whole file as an implementation request.
3. Add `02_MASTER_PROJECT_RULES.md`, `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` and `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md` to the project files/context before coding. The master rules define the product contract; file `14` defines the inspect → plan → implement → test → evidence and new-chat recovery loop; file `15` defines failure states, safe recovery and regression evidence. Paste/attach these first and treat them as mandatory. **Do not ask AI Studio to change to Claude or infer that the builder can use a ranked model.**
4. Paste the component prompts in order, one at a time:
   - `03_BUILD_FOUNDATION_PROMPT.md`
   - `04_BUILD_STORY_ROOM_PROMPT.md`
   - `05_BUILD_VISUALS_AUDIO_RENDER_PROMPT.md`
   - `06_BUILD_OPENCODE_WINDOWS_PROMPT.md`
   - `07_BUILD_YOUTUBE_OPERATIONS_PROMPT.md`
5. After **each** prompt, run its acceptance checks, inspect changed files and preview, update `docs/ai-build-ledger.md`, and resolve failures before moving on. Use file `15` to check the failure/recovery behavior relevant to that phase. Do not ask the builder to implement everything in one giant pass.
6. Import `09_ORIGINAL_SERIES_BIBLE_AND_1000_EPISODE_BACKBONE.md` as a project file (or paste it into the app’s Story Room) after continuity features exist. Treat it as an original, editable seed—not as factual survival guidance.
7. After Prompts 03–07 and their relevant checks pass, paste `11_BUILD_END_TO_END_AUTOPRODUCER_PROMPT.md` to integrate them into one resumable, supervised production workflow. This is an integration phase, not a substitute for component builds.
8. Run `08_HARDENING_RELEASE_ACCEPTANCE_PROMPT.md` after integration. It covers security, recovery, release testing, and evidence; report every unverified item instead of calling it production-ready.
9. Run `13_FINAL_TRACEABILITY_AND_RED_TEAM_AUDIT_PROMPT.md` last. It produces a requirement-by-requirement evidence matrix, decision log, data-flow map, threat model, and GO / CONDITIONAL GO / NO-GO decision. It must not run paid/public/destructive actions without separate approval.
10. Use `12_YOUTUBE_UPLOAD_RUNBOOK.md` for the manual Studio upload path. The app should generate a runbook tailored to each finished export and link to official guidance; this remains the fallback if OAuth/API upload is unavailable.
11. Link the project to GitHub or download the ZIP, then test the exported repository on the Windows PC/WSL setup described in Prompt 06. AI Studio’s cloud preview cannot be assumed to access your PC’s disk or run its FFmpeg/OpenCode installation.

## Build discipline

- Ask the AI Studio agent to inspect the existing repository before every phase. It must preserve working features and tests.
- No placeholder buttons, fake progress, simulated provider results, fabricated API success, or “coming soon” screens presented as functioning production features. If an integration is not configured, show a clear “not connected / configure this” state.
- Every external provider call must show the provider/account tier, what content leaves the PC, current data-use/retention terms and link/date checked, estimated cost/credits or uncertainty, cancellation/retry state, and whether it may incur charges. Never promise free, zero-retention, exclusive-rights, or unlimited generations. Importing this series bible or unpublished scripts into AI Studio/Gemini also sends that content to the service; review the current account/tier terms before doing so.
- Public YouTube publishing/scheduling, deletion, credential changes, and destructive file operations require explicit human approval. Paid media calls may run autonomously only within explicitly preauthorized per-run, per-episode, and monthly budget caps; pause before exceeding any cap or when cost is unknown and not preauthorized. Keep unsubmitted packages as local drafts; if the API is used, explicitly request private status and read back the actual response/Studio status. Official YouTube docs conflict on whether unverified API projects are forced private; the app must not promise either outcome.
- Keep platform policy checks and all monetization thresholds configurable and date-stamped; policies change. The app can enforce a measurable QC checklist and surface issues, but cannot guarantee perfect output, YouTube approval, monetization, reach, or revenue.
- Configure the channel's production timezone explicitly before scheduling; do not silently assume the current Asia/Kolkata placeholder is correct.
- The app can support large **production capacity**, but publishing 10 near-identical videos every day is not the launch strategy. YouTube explicitly warns against mass-produced, repetitive, generic content while also saying a series with recurring characters can be eligible when the substance is materially varied. Use the quality-first cadence in the research brief.

## Files

| File | Purpose |
| --- | --- |
| `00_START_HERE.md` | Pack overview, decisions, build order, mandatory context files and phase sequencing |
| `01_RESEARCH_AND_OPERATING_PLAN.md` | Channel research, limits, content strategy, production cadence, revenue model, official policy references |
| `02_MASTER_PROJECT_RULES.md` | Durable rules for the AI Studio coding agent |
| `03_BUILD_FOUNDATION_PROMPT.md` | First implementation phase: real local-first app shell, persistence, projects, diagnostics |
| `04_BUILD_STORY_ROOM_PROMPT.md` | Story bible, continuity, episode roadmap, script drafting and QA |
| `05_BUILD_VISUALS_AUDIO_RENDER_PROMPT.md` | Visual/audio providers, scene pipeline, FFmpeg rendering and QC |
| `06_BUILD_OPENCODE_WINDOWS_PROMPT.md` | Windows/WSL runtime, CLI, OpenCode-safe workflows and project skills |
| `07_BUILD_YOUTUBE_OPERATIONS_PROMPT.md` | Metadata, Shorts/long-form packaging, OAuth publishing, schedule and analytics |
| `08_HARDENING_RELEASE_ACCEPTANCE_PROMPT.md` | Security, tests, recovery, Windows release docs, go/no-go criteria |
| `09_ORIGINAL_SERIES_BIBLE_AND_1000_EPISODE_BACKBONE.md` | Original story world, cast, rules, 100-arc / 1,000-episode structure and pilot |
| `10_AUDIT_AND_FIX_REPORT.md` | Audit scope, corrections made, validation checks and remaining limitations |
| `11_BUILD_END_TO_END_AUTOPRODUCER_PROMPT.md` | Integration phase for brainstorm-to-finished-episode production, resumable jobs, approval gates and per-episode upload handoff |
| `12_YOUTUBE_UPLOAD_RUNBOOK.md` | Current step-by-step YouTube Studio upload instructions for long-form episodes and Shorts, plus final safety checklist |
| `13_FINAL_TRACEABILITY_AND_RED_TEAM_AUDIT_PROMPT.md` | Final cross-prompt and application audit, requirements evidence matrix, decision log, threat model, and release decision |
| `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` | Required inspect/plan/implement/test/evidence protocol and persistent build-ledger handoff for the current AI Studio Build agent; not a request to change models |
| `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md` | Cross-cutting failure states, detection, safe recovery, reconciliation and minimum regression tests for every production stage |

## First practical milestone

Build only enough to produce **one** original 10–15 minute pilot and two distinctly edited Shorts. Once the user-approved series bible and per-episode budget are set, the autoproducer should run story/script, scene planning, configured media generation, captions, render/QC, and metadata packaging automatically where integrations are real; pause only at configured approval gates, on budget/provider/rights/policy blockers, or before any public/scheduled upload. For the first pilot, review every stage and the final Studio settings; then tune the approval profile from observed results. Measure production cost, quality defects, and audience response. Scale only if the work remains original, coherent, rights-cleared, and economically sustainable.
