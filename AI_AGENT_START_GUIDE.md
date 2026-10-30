# Ternfall Studio — Operator and Agent Guide

This is a local-first writing, planning and supplied-asset rendering workspace. Read [README.md](README.md), [AGENTS.md](AGENTS.md) and the [local media workflow](docs/local-media-workflow.md) before operating it. Existing project metadata may differ from the checked-in seed and must not be silently rewritten.

## Current boundaries

- Node.js **22.13 or newer** is required. `npm ci` installs the locked dependencies; `npm run dev` starts the local web app. Real rendering additionally needs suitable FFmpeg and FFprobe binaries.
- Episode checks and local review markers are advisory, not independent editorial, rights, technical or publishing approvals. `episode approve` is disabled.
- Paid generation, new spend grants, automated production and publishing are disabled. Do not try to work around these boundaries or treat an API key as authorization.
- Local Render uses operator-supplied PNG frames and WAV/FLAC audio. It does not generate assets or establish rights. Measured technical QC is not editorial approval.
- The legacy Video Essay script exports and old tracked render scripts are retired. Previously downloaded scripts are unchanged and must not be run; the old Edge-TTS export transmitted narration to an external service.
- `project backup` is metadata-only. The offline full-root backup and isolated staged restore require stopped writers and independent protected copies; see [backup and restore](docs/backup-and-restore.md). Do not delete a database or alter JSON/SQLite internals to force reseeding.

## Read-only inspection

```bash
npm run studio -- project list --json
npm run studio -- series list --json
npm run studio -- episode list --json
npm run studio -- episode show S01E001 --json
npm run studio -- episode check S01E001 --json
npm run studio -- continuity report --json
```

Use `--project <project-id>` for another project. `doctor` performs filesystem and executable diagnostics and is not entirely read-only. Do not paste secrets or private source material into an external agent without the operator's informed consent.

## Draft creation and editing

The following commands mutate draft metadata. Run them only when the operator has requested the work. The server allocates the episode ID; keep the idempotency key to retry the same request and use a new key for a different request. Inspect the returned ID before using it in later commands.

```bash
npm run studio -- episode create --title "Draft title" --idempotency-key draft-request-001 --json
npm run studio -- episode update-script S01E002 --file ./draft-script.txt --json
npm run studio -- episode check S01E002 --json
```

`S01E002` in the second and third examples is illustrative; substitute the actual allocated ID. Drafting is not approval. For concurrent edits, reload and reconcile revision conflicts rather than retrying an old write blindly. The known historical `series_<project-id>` mismatch is preserved on edits, not silently migrated; see [the remediation notes](docs/remediation-progress.md).

## Optional AI agents

External coding or language-model agents may transmit code and unpublished creative material to third parties. Review the exact provider and terms and obtain the operator's consent before transmission. Do not disclose credentials, publish, mint or expand spend approvals, or edit the production database directly. Repository agent configuration expresses intended restrictions; it is not proof that an external agent enforces them.

## Verification

```bash
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

A passing suite is not a guarantee of editorial quality, licensing, Windows compatibility, production readiness or public-release authorization. See the audit and remediation documents for evidence and remaining limitations.
