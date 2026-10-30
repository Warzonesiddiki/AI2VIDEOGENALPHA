# Readiness Gaps — What Remains Between Here and “Done”

Date: 2026-10-30. Companion to `docs/remediation-progress.md` (Batches 1–25) and `TASKS.md`.

## Honesty statement

“100% ready with zero compromises and flaw” cannot be honestly certified by any test suite. Tests
produce evidence, not proofs; several gates below are human or organizational and cannot be closed by
software at all; and some validation requires machines and accounts this workspace does not have. The
defensible standard is: **every known failure class is either fixed and tested, explicitly documented
as open with a named mitigation, or assigned to the party that can actually close it.** This document
is that inventory. Nothing here is claimed complete until its evidence exists.

## Proven today (the foundation)

- 316 tests / 315 passed / 1 opt-in skip / 0 failed on Node 22.22.3 **and** 22.13.0; lint, build,
  Chromium 138 browser smoke, npm audit 0, 44 pinned skill hashes, workflow YAML, shell syntax,
  57 doc links, `git diff --check`, zero tracked production changes (Batch 25 evidence).
- Fail-closed projections over every exercised HTTP success response (settings, projects, production
  records, documents), typed error contracts, model-clean document writes with numeric ceilings,
  revision-CAS with exhaustion refusal, revocation-first Flow rechecks, scoped worker recovery with
  operator attestation adjudication, offline backup/verify/stage with no live activation.
- All paid generation, independent approvals, autonomous production and publication remain
  **disabled**. Tests do not confer release approval.

## A. Engineering still closable inside this repository

| # | Gap | What is missing | Closes |
|---|-----|-----------------|--------|
| A1 | **Response-shape review of remaining success payloads** | Per-field allowlist/projection review for: `GET /api/doctor` (raw `SystemDiagnostics`), `GET /api/roadmap/arcs`, `POST /api/research/validate-url`, `POST /api/generate/outline` (adapter scaffold), `GET .../episodes/:epId/check` advisory output, `GET .../youtube` package list is projected but the route table needs a per-field sweep, and all five Flow success shapes — `GET /plan/:epId` and `POST /plan/:epId` (full plan objects), `GET /plan/:epId/batches`, `GET /checkpoint/:epId`, `POST /ingest` (verification result). Flow error paths are hardened; these success bodies have not been reviewed field by field. | TASKS line 8 |
| A2 | **Continuous post-verification asset change** | Verified media can change on disk after verification (TOCTOU). Needs hash-pin at verification and re-check at every playback/export, or content-addressed/immutable artifact staging. | TASKS line 8 |
| A3 | **Remaining concurrency limits** | Same-record optimistic concurrency exists for revisioned records; still missing: media archives, operator restore workflow, and documented concurrency ceilings under multi-writer load. | TASKS P1 "Same-record optimistic concurrency, operator restore workflow and media archives" |
| A4 | **Orphan cleanup** | Crash orphans (scratch files, FFmpeg children) are never reaped automatically; ownership check + kill + delete is non-atomic against hostile concurrent writers. | TASKS line 5 tail |
| A5 | **Storage schemas/import review** | Every stored collection needs a written schema and an import-review checklist (legacy JSON → SQLite store). Partially done for documents; production records, Flow plans, settings, idempotency ledgers need the same treatment. | TASKS line 16 |
| A6 | **Rehearsal tooling at scale** | Backup/restore tested on fixtures only. Needs: size-scaled synthetic rehearsal scripts, restore-diff verification tooling, and a written promotion/rollback runbook that an operator can execute against the real root. | TASKS line 16 |
| A7 | **Repo delivery** | The entire remediation body is **uncommitted** on `arena/8b9eceb6-ai2videogenalpha`. It must be committed, pushed, and opened as a PR so the work is durable and hosted CI can see it. Decide what to do about tracked legacy files (incl. the ~24 MB Flow plan). | prerequisite for B1 |
| A8 | **Dependency provenance** | `npm audit signatures` failed twice (ECONNRESET fetching the Sigstore TUF root). Registry SRI is not independent signature verification. Retry, record results, add an SBOM. | part of TASKS line 17 |
| A9 | **Long-render certification** | The opt-in 900-second render test is skipped in every full run. One real run with captured evidence (manifest, QC, hashes) is required before any render-readiness claim. | TASKS line 79 |
| A10 | **Residual hardening** | Doctor probe hostile-ancestor/path races; Flow pagination reduces response size but not server parse memory (`express.json` 1 MB limit mitigates); `safePath` is not a hostile-writer sandbox. Document or harden each. | risk register |

## B. Validation requiring resources outside this workspace

| # | Gap | Why it cannot close here |
|---|-----|--------------------------|
| B1 | **Hosted CI** | SHA-pinned Node 22.13/22.22 workflow exists locally but has never run. Needs push/activation, runner permissions review, FFmpeg provisioning and cost approval. A local pass is not a hosted pass. |
| B2 | **Windows / macOS** | Worker claims, path handling, CLI and recovery are Linux-only-tested. Needs real machines or hosted runners on those OSes. |
| B3 | **Maintained native FFmpeg validation** | Fixture probes exist; actual QC of rendered artifacts with maintained FFmpeg/ffprobe builds across a version matrix does not. |
| B4 | **Representative hardware long render** | A1's evidence run should execute on production-class hardware, not only this sandbox. |
| B5 | **Accessibility & real devices** | The Chromium smoke (sandbox-disabled, headless) covers focus basics only. WCAG review, screen readers and real devices are required. |
| B6 | **Deployment security** | If ever hosted: TLS, headers, authn/z, rate limits, secret management, multi-user isolation ("data minimization, not multi-tenant isolation" is the current state). |
| B7 | **Independent security review** | Everything exercised here is first-party testing. A pen-test/independent audit is a separate claim. |

## C. Deliberately disabled workflows — must be built, then explicitly authorized

| # | Workflow | Current state | Requirement |
|---|----------|---------------|-------------|
| C1 | **Provider generation (paid image/audio/video)** | Retired; adapter refuses billable execution. | Separately authorized execution with spend grants, spend accounting, and failure-safe commit semantics. Never re-enable retired simulations. |
| C2 | **Independent human review & rights approval** | Tests-only approvals exist and explicitly confer no release approval. | A real two-person workflow with rights evidence attached to exact artifacts (hash-bound). |
| C3 | **Publication (YouTube upload)** | Disabled; unauthorized publication is prohibited. | Explicit authorization, disclosure compliance (synthetic media), and an auditable publish record. |
| C4 | **Autoproduce orchestration** | Retired rather than fabricating deliverables. | Only rebuild on top of real C1–C3 primitives. |
| C5 | **Narration audio** | Old scripts would have sent narration externally (edge-tts); no such call is made. | Authorized TTS provider or a local engine, with voice rights recorded. |

## D. Human / organizational gates (never provable by code)

- Editorial and canon quality of the actual story content (heuristics are advisory only).
- Rights and licensing for generated media, voices, music, and likeness.
- Legal compliance: synthetic-media disclosure, platform policies, jurisdiction.
- Sign-off on production-data migration/restore rehearsal (operator runs it; this workspace must
  never touch production data).
- Cost governance: real spend grants and approvals are decisions, not code.
- Operational policy for multi-user access, audit logs and incident response.

## Recommended order

1. **A7** (commit/push/PR — makes everything else durable and lets B1 start).
2. **A1** (response-shape sweep — last clause of the data-minimization TASKS item; next batch).
3. **A2 + A3** (post-verification immutability + concurrency/restore workflow).
4. **A5 + A6** (schemas, rehearsal tooling and runbook → enables the operator's real rehearsal).
5. **A4, A8, A9, A10** alongside; then **B1–B4** as soon as infra exists.
6. C and D proceed in parallel through explicit authorization — nothing in this repository may
   enable them unilaterally.

## Definition of done (defensible version)

- Every row of A closed with test evidence recorded in `docs/remediation-progress.md`.
- Every row of B executed at least once on real infrastructure with recorded results.
- Every row of C either built behind explicit authorization with audit trails, or explicitly declared
  out of scope by the operator.
- Every row of D signed off by a human, on the record.
- Until then, the truthful claim remains: **local-first studio with extensive tested safeguards;
  not release-approved, not production-certified.**
