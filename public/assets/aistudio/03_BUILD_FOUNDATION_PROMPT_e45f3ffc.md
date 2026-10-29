# BUILD PROMPT 1 — Production Studio foundation

Paste this as the first implementation request after adding `02_MASTER_PROJECT_RULES.md`, `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` and `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md` to the AI Studio project context. Choose a **web app** in Google AI Studio Build. Follow file `14` and the relevant rows of `15`: inspect the existing project, give a concise plan and acceptance-test map, then implement only this phase and report actual verification evidence. Do not ask the Build agent to change models.

---

Build the first production-ready vertical slice of **Ternfall Studio**, a local-first 2D survival-story video production app. Follow the project's `02_MASTER_PROJECT_RULES.md` exactly. The final application will be exported/synced from Google AI Studio and run locally on Windows/WSL; AI Studio's cloud preview is not the production desktop environment.

## Phase scope

Implement the real foundation now:

1. A professional responsive production dashboard and navigation.
2. Durable local project/series/episode persistence with migrations and explicit local-vs-cloud capability status.
3. Create/open/rename/archive a project; create/edit a series; create/edit/duplicate/archive an episode; persist all changes across refresh/restart.
4. A local production-root setting and path validation for the local build. In the AI Studio preview, if a Windows path cannot be accessed, show “local filesystem unavailable in hosted preview” and let the UI remain usable for product preview. Do not silently substitute in-memory storage as production storage.
5. A real job list/log view and audit event model, even if text generation/render integrations are implemented in later phases. Use the job and external-operation states in `02_MASTER_PROJECT_RULES.md` and failure matrix `15`: include blocked, paused, needs-user, recoverable/terminal failure and unknown external effect/reconciliation—not just green/red. Persist timestamps, redacted logs, cancellation, last verified checkpoint, request/idempotency IDs and detail pages.
6. Settings pages with honest unconfigured status for providers, FFmpeg, OpenCode, YouTube OAuth, storage, and budgets. Do not add fake keys or pretend those integrations are connected.
7. Diagnostics (“Doctor”) showing actual app/database/filesystem/provider/FFmpeg/CLI capabilities, with safe redaction of secrets and full paths where appropriate.
8. Sample project import from a user-selected Markdown/JSON file, plus a clearly labeled optional **fictional sample workspace** that can be deleted. It must not be inserted into a real user's workspace without consent.

## Required implementation choices

- Use the existing AI Studio generated stack if it is already sound. For a new project, use TypeScript, React, Node.js, strict type checking, and a clean client/server boundary. Keep provider calls server-side.
- Use a real persistent database adapter with migrations. Select an implementation that works in Windows local mode, document its native dependencies, and include persistence/integration tests. Hosted preview may use its supported database adapter, but provide a repository interface so local production uses persistent storage; explain and test both configurations. Do not claim a cloud database makes project files local.
- The initial release is single-user and local-only by default: do not add public cloud deployment, public registration, multi-tenant storage, telemetry, or cloud sync as an implicit shortcut. Distinguish the AI Studio preview from Windows local mode and ensure settings describe where files and secrets reside. If hosted/multi-user mode is later requested, it requires its own authentication, isolation, quota, and privacy design.
- Provide user-visible export and deletion/archive paths for projects and their artifacts, and document what backups/logs retain. Do not claim deletion removes copies already sent to external providers.
- Use filesystem services that resolve and validate paths under an authorized production root. All persisted artifact paths should be relative to the project; reject `..` traversal and symlink escape. Implement atomic writes and a backup/restore strategy.
- Use schema validation for API requests/responses and stored JSON. Provide typed error responses, request IDs, useful logs, and server-side validation.
- Keep secrets outside the database and client bundle. Never commit keys or tokens. Add `.env.example` and `.gitignore` entries only; never create a file with a working secret.
- Prefer accessible, keyboard-usable UI, loading/empty/error states, readable contrast, undo for edits where safe, and a dark editorial design system suited to a media production console. The UI must work at desktop and laptop widths.

## Starter screens

- **Dashboard:** projects, episodes due for review, blocked jobs, spend/cost warning placeholder clearly labeled as unconnected until metered, and a recent activity timeline.
- **Projects:** create/open, production root, storage status, and archive/restore.
- **Series Room:** title, premise, genre/tone, originality checklist, canon version, status.
- **Episode Board:** season/episode numbering, title, logline, status, target runtime, word-count target, story version and review status.
- **Production Queue:** durable job states with logs and retry/cancel controls that are disabled when not implemented.
- **Settings:** Providers, storage, FFmpeg, OpenCode, YouTube, budget caps, research/search capability, project language/locale, explicit production timezone, retention/backup, and safety/policy source dates. Show provider data-use/retention notices and “not configured” accurately; no provider call in this phase.
- **Doctor:** detected runtime/version, database health, writable paths, free space, FFmpeg/FFprobe status/version, OpenCode executable/version, provider connectivity only when configured, YouTube OAuth status, and exact remediation steps. No secret values in the output.

## Data integrity and safety

- Use stable IDs and include `createdAt`, `updatedAt`, `version`, and `archivedAt` where appropriate.
- A duplicate action must create a new ID and preserve a provenance link to the source version.
- Project deletion must first move it to an archive/trash state; permanent deletion must require an explicit confirmation and backup option.
- Log file/database failures to a local, rotated, redacted log.
- Set restrictive CORS/CSRF/security headers suitable to the actual local mode. Hosted preview and local build have separate origin configuration. Do not expose an unprotected local API on the LAN.
- Use server-side generation secrets in AI Studio's hosted runtime, but document that ZIP/local deployment needs its own secret configuration. Do not put secrets in React environment variables.

## Acceptance tests for this phase

Before reporting done:

1. Run and report the actual lint, typecheck, unit, integration, and production build commands. Fix failures.
2. Test create project → create series → create episode → edit → refresh/restart → verify the exact persisted values remain.
3. Test duplicate episode creates a new independent record without overwriting the original.
4. Test bad/missing path, invalid IDs, duplicate episode number, database error, file permission error, and invalid input show usable error states and do not corrupt data.
5. Verify hosted preview reports local-only capabilities as unavailable rather than fake success.
6. Inspect the browser console, server logs, migrations, and `.gitignore` for secret leakage or noisy errors.
7. Verify local project viewing/editing/import/export still works with network access disabled and no provider configured; no external call is silently attempted.
8. Give a concise file-by-file summary, the exact test/build outcomes, current limitations, and the next prompt phase to run.

Do not implement placeholders for story/image/video generation in this phase. Build the real foundation so later phases have somewhere reliable to persist their work.
