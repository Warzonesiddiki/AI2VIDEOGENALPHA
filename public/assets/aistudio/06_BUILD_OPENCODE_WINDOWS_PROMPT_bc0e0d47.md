# BUILD PROMPT 4 — Windows/WSL runtime, CLI and OpenCode integration

Run after foundation, Story Room and media pipeline are real. Inspect current files and official OpenCode docs before writing OpenCode-specific config; do not rely on memory for version-sensitive syntax.

---

Implement the **local Windows production runtime and OpenCode automation interface** for Ternfall Studio. Follow `02_MASTER_PROJECT_RULES.md`, `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md`, and the relevant Windows/CLI/security rows in `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`. The primary AI agent is a separately installed OpenCode CLI that the user launches from the repository/project folder. The app must not assume that Google AI Studio’s cloud preview can execute local Windows commands or see the local media disk.

### Keep the three model/agent roles separate

- The operator expects Google AI Studio Build to use its current default/latest Flash coding agent. Do not prompt it to switch to Claude or assume the Build UI can select Claude.
- OpenCode is a separate, optional CLI coding agent. Do not hard-code a leaderboard winner or automatically sign the user into a paid provider; let the operator configure a provider using the current official OpenCode/provider instructions and disclose that project context may leave the PC.
- Models used by the finished app for story, research, image, video, voice or transcription are runtime services with separate provider adapters and settings. They are not automatically set by the AI Studio builder or OpenCode.
- Never route consumer subscription credentials through an unofficial plugin or proxy. If the operator later chooses a model/provider, verify its permitted authentication route, billing, data-use terms and current model ID from official documentation.

## Local runtime modes

Support and document:

1. **Recommended Windows + WSL2 path:** WSL2 Ubuntu, Node.js current LTS, FFmpeg/FFprobe, OpenCode installed inside WSL, repository under the WSL Linux filesystem for performance (Windows-mounted paths such as `/mnt/c/...` may be supported with documented performance caveats). Show how to open the project from Windows File Explorer/Terminal without creating duplicate repositories. Official OpenCode guidance currently recommends WSL for the best Windows experience; confirm current setup instructions before release. Use one canonical path representation and test spaces, Unicode, Windows/WSL path conversion, case differences, permissions, and symlink escape.
2. **Native Windows path:** where dependency support is verified, provide PowerShell commands and clear caveats. Detect Node, package manager, FFmpeg, FFprobe and OpenCode without leaking environment values. Do not silently switch runtimes.

Provide scripts that fail clearly when prerequisites are missing. Pin compatible dependency ranges, lockfiles, migrations and package scripts. Include a one-command health check and non-destructive startup/shutdown scripts. Never require Docker or a paid cloud service just to write scripts or edit a project.

## Stable application CLI

Implement an actual, typed CLI (with `--help`, `--version`, consistent nonzero error exit codes, path validation and `--json` results) that calls the same domain services/repositories as the UI. Add and test commands in these groups:

- `studio doctor` — runtime, storage, FFmpeg/FFprobe, OpenCode, provider and YouTube status, redacted.
- `studio project list|create|open|backup|restore`.
- `studio series list|import|validate|export`.
- `studio episode list|show|plan|outline|script|check|approve|export`.
- `studio arc expand` — hard cap 20 episode cards per call, cost confirmation and user-controlled stop; never generate 1,000 full scripts at once.
- `studio research list|add|check` and `studio continuity report`.
- `studio scenes plan|validate`, `studio assets list|generate|relink`, `studio voice generate|align`, `studio render`, `studio qc`, and `studio package export`.
- `studio episode produce --episode ID --profile stepwise|supervised|approved-batch --approval-id USER_ISSUED_APPROVAL_ID --json`, plus `studio run status|resume|cancel RUN_ID --json`. Store caps/currency in the operator-approved configuration; an agent-supplied `--budget-max` is never authorization and must not raise a cap. The approval handle must be user-issued, scoped, expiring, auditable, and checked server-side; no CLI command may mint it. Runs must be durably resumable, enforce per-run/per-episode/monthly limits, stop at blockers, and never publish publicly.
- `studio youtube metadata|preflight|upload-private|schedule` only where the current authorized API supports it; all public/schedule/delete actions require an explicit confirmation token/interactive approval and should default to disabled.

Use positional args/typed option parsing and spawn child processes with an argument array. Never concatenate user/model text into a shell command. Restrict file writes to the selected project root; reject path traversal, symlink escapes, unexpected extensions, huge files and unknown destructive actions. Include an audit event for agent-triggered work. `studio run status --json` must distinguish blocked/paused/needs-user/recoverable/terminal/cancelled states from external-operation states; return the last verified stage, next safe action, `may_have_charged`, `duplicate_possible`, and `reconciliation_required` without exposing secrets. An agent must not auto-retry an unknown external side effect.

## OpenCode project integration

Add a **small, safe OpenCode workspace** in the repo using only current documented structures. Before generating config, consult:

- OpenCode CLI: <https://opencode.ai/docs/cli/>
- OpenCode project rules/`AGENTS.md`: <https://opencode.ai/docs/rules/>
- OpenCode permissions: <https://opencode.ai/docs/permissions/>
- OpenCode Windows/WSL: <https://opencode.ai/docs/windows-wsl/>

Create/document:

- Root `AGENTS.md` with project layout, safe commands, workflow state machine, source/rights rules, tests, local paths and “never publish without human approval.” Keep it concise and point to project docs.
- `.opencode/agents/story-planner.md`: creates episode cards/outlines from approved canon; no rendering/publishing.
- `.opencode/agents/continuity-reviewer.md`: read-only continuity/originality reviewer; cannot edit or publish.
- `.opencode/agents/production-operator.md`: runs approved story/asset/render CLI commands within the selected project root; cannot manage secrets or publish publicly.
- `.opencode/commands/episode-plan.md`, `/episode-draft.md`, `/episode-review.md`, `/episode-render.md`, `/episode-produce.md`, `/production-status.md` or skills with equivalent documented syntax. Make command templates read the required canon/source artifacts and call the app CLI, not private database internals. `episode-produce` must show the episode/profile/cap and obtain or verify a valid user preauthorization before it starts paid calls; it can never publish/schedule.
- `opencode.json` only if needed. Do not rely on OpenCode defaults: current documentation says most tools are permissive unless configured, and the last matching permission rule wins. Verify the installed version/schema and rule order. Use conservative, explicit permissions: project reads can be allowed; file edits and shell commands require approval unless a narrowly scoped, read-only/test command is proven safe; explicitly deny credential reads, public upload, destructive deletion, budget increases, and writes outside the project root. Check each custom agent/subagent's effective permissions independently. Do not use auto-approve or dangerous bypass flags.

Check all config against the current OpenCode JSON schema/CLI and tests. Do not place real provider keys or OAuth tokens in project config, sample prompts, `AGENTS.md`, command files, logs or generated transcripts.

## Agent-usable workflow

The OpenCode agent should be able to:

1. Read an approved series/episode context bundle through the CLI.
2. Create an outline or script in a new version without overwriting approved canon.
3. Run `studio episode check` / `studio continuity report` and receive structured issues.
4. Ask for human approval before it changes state to approved.
5. Generate a scene plan only from the approved script version.
6. Run an explicitly approved local render job and read its job ID/status/log summary.
7. Export files to the authorized project output directory and report exact paths.

The agent must not be able to mark an episode “publish approved,” disclose a realistic synthetic video on the owner’s behalf without human confirmation, or publish publicly as an unattended side effect.

## Process security and local service

- If the UI talks to a local server, bind to `127.0.0.1` by default for local-only use, use a per-session random token, verify `Origin`/CSRF protection, and reject requests from other origins. Keep dev preview host/origin configuration separate from production local mode.
- Never expose OpenCode’s API/server on `0.0.0.0` as a default. If a user deliberately enables remote access, display a warning and require authentication, explicit host selection, and firewall guidance.
- Redact paths to credentials, `.env` values, access tokens, authorization headers and generated private content from process logs. Do not return raw environment variables from `doctor`.
- Set timeouts, cancellation, bounded output sizes, process-tree termination and safe cleanup for FFmpeg/provider/CLI processes. Avoid shell interpolation and `cmd.exe /c` for untrusted strings.
- Keep `.env`, local config, databases, assets, renders, auth caches and backups out of Git by default. Add a safe `.env.example` only.

## OpenCode handoff docs

Provide `docs/windows-setup.md` and `docs/opencode-workflow.md` containing:

- exact supported Windows/WSL prerequisites and version checks;
- install/start/stop/doctor/backup/restore steps;
- how to open the correct repository folder and launch `opencode` there;
- how to configure an OpenCode provider securely with the current official login flow, and how to review the selected model provider's current data-use/retention and billing terms;
- the fact that local OpenCode can still send selected prompts/project files to a remote model; how to disable remote calls/use an approved local model, exclude secrets/private assets, and consent before sensitive unpublished story material is included;
- how the agent uses `studio ... --json` commands and where outputs are saved;
- which operations ask for approval and which are blocked;
- troubleshooting for WSL paths, permissions, FFmpeg, ports and provider quotas.

Use current commands from official docs rather than copying stale commands into the guide. Never instruct the user to run `opencode --auto` or disable permission controls.

## Acceptance tests

- CLI `--help`, `--version`, JSON output, error codes and all path guards work in tests.
- Test successful and rejected operations: bad project root, path traversal, symlink escape, nonexistent episode, malformed JSON, duplicate job, provider timeout with unknown external side effect, missing FFmpeg, cancelled child process, oversized log, and permission denial. Verify `studio run status --json` reports charge/duplicate uncertainty and reconciliation requirements accurately.
- Run CLI from Windows PowerShell and WSL if available; if not available in the build environment, document exact manual verification steps and do not claim it was tested.
- Validate OpenCode config with current schema and verify the read-only reviewer cannot write, publish or run prohibited commands.
- Test an agent workflow against a fixture series and confirm it produces versioned files inside the project root only.
- Test that public upload, delete, credential access and budget increases remain blocked absent explicit human confirmation. Verify agents cannot mint, widen, reuse, replay, or apply a scoped paid-run approval to a different project/episode/provider/batch.
- Run full project tests/build and report exactly what was executed and which OS-specific checks remain.
