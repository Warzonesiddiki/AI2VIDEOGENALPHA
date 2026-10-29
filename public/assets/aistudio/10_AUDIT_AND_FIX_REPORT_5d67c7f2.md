# Prompt-Pack Audit & Fix Report — Failure-Resilience Revision

**Audit date:** 29 October 2026  
**Scope:** 16 Markdown files, numbered `00`–`15`. This audits the prompt pack's coverage, cross-file consistency and archive—not a working application. No app source repository, Windows/WSL installation, provider credentials, OAuth/channel test environment, media generation, rendering or upload environment was available in this workspace. No app implementation or app test is claimed.

## Coverage matrix

| Requirement area | Covered in | Prompt-pack status |
| --- | --- | --- |
| Original zombie-survival series, canon, 1,000-episode roadmap, ~15-minute episodes | `01`, `02`, `04`, `09`, `11`, `13` | Specified; 1,000 episodes are roadmap cards, not completed scripts. The series bible is a seed, not a produced season. |
| Brainstorming, research, sources, factual claims and source-injection handling | `01`, `02`, `04`, `11`, `13`, `15` | Specified with provenance, untrusted-source handling, manual fallback and human review; no research adapter built or tested here. |
| AI Studio Build-agent execution and weak-model resilience | `00`, `02`, `03`–`08`, `11`, `13`, `14`, `15` | Current default AI Studio Build agent is the target. Explicit inspect → plan → implement → test → evidence behavior; no prompt asks it to switch to Claude. |
| Current model leaderboard research | `01`, `10`, `13` | Dated and task/category-specific; not treated as a universal ranking or an app model setting. Rankings must be rechecked. |
| Image/video/voice providers, clip limits, cost and rights | `01`, `02`, `05`, `11`, `13`, `14`, `15` | Dated candidate/API research recorded; exact access, model/route, terms, price, region and account eligibility must be verified before implementation/use. |
| Full production workflow, resumability, approvals and spend caps | `02`, `05`, `11`, `13`, `14`, `15` | Specified, including safe partial recovery and external-operation reconciliation; no orchestrator built or tested here. |
| Failure states, detection, recovery, reconciliation, regression evidence | `02`, `03`, `06`–`08`, `11`, `13`–`15` | Added a cross-cutting matrix and consistent persisted job/external-operation state vocabulary. It is a systematic minimum, not a claim to anticipate every future failure. |
| AI Studio context loss/new-chat continuity | `00`, `02`, `08`, `11`, `13`–`15` | Added required secret-free `docs/ai-build-ledger.md`, evidence-based resume procedure and explicit prohibition on trusting the ledger over repository/tests. |
| Captions, real render, QC, Shorts and packaging | `02`, `05`, `07`, `11`, `13`, `15` | Specified; no provider call, FFmpeg render, caption alignment or QC was run here. |
| Windows local runtime, OpenCode, safe CLI and recovery | `02`, `03`, `06`, `08`, `13`–`15` | Specified; no Windows/WSL runtime or OpenCode configuration installed/tested here. |
| YouTube packaging, Studio runbook and optional OAuth/API path | `07`, `11`, `12`, `13`, `15` | Specified; no OAuth, test upload or publishing was performed here. |
| Privacy/data use, rights, security, release evidence | `02`–`08`, `11`, `13`–`15` | Specified; implementation controls and current provider/platform terms remain to be verified in the operator's environment. |

## Fixes made in this revision

1. **Added `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`.** It sets cross-cutting invariants for truthful success, preservation of last-known-good data, resumability, at-least-once remote side effects, safe bounded retries, cancellation and handling of unlisted failures. The matrix covers prompt/context loss and conflicts; build/runtime/database/filesystem/backup failures; provider consent, model/API changes, outages, ambiguous billing, partial output, cost/batch/fallback issues; research/source/canon risks; media/rights/render/QC issues; YouTube OAuth/upload/privacy/quota/scheduling issues; and secrets, unsafe input, and unauthorized actions.
2. **Made job status and external side-effect status distinct and consistent.** `02` now specifies the exact states used by `15`: job states include `queued`, `running`, `paused`, `blocked`, `needs_user`, `retrying`, `succeeded`, `failed_recoverable`, `failed_terminal`, and `cancelled`; external operations include `not_started`, `pending`, `confirmed_succeeded`, `confirmed_failed`, `unknown_external_effect`, and `reconciling`. Ambiguous billable calls/uploads must be reconciled before retry. Foundation, CLI, orchestrator and final-audit prompts now require the relevant state, cost/duplicate uncertainty and next-safe-action evidence.
3. **Added persistent AI Studio progress and context-loss recovery.** `14` defines the secret-free `docs/ai-build-ledger.md` template and requires it to be updated after each phase/interruption. A new chat must inspect actual repository state, diff, tests and command output; the ledger is a handoff hint, not proof. The file is explicitly developer-only, not a runtime/user-facing asset, and must contain no credentials or private media/scripts. Matrix `15` includes new-chat/context truncation and missing-prompt cases.
4. **Integrated the failure matrix across the build sequence.** `00`, master rules `02`, phase prompts `03`–`08`, integration prompt `11`, and final audit `13` now reference `15` where applicable. Tests include timeout-after-dispatch, unknown billing/upload outcome, interrupted file/render/migration work, partial batches, missing official documentation, and a new-chat handoff. The final audit must trace applicable failures through detection, persisted state, safe recovery, regression tests and user-facing remediation; newly discovered cases must be added.
5. **Strengthened official-documentation uncertainty behavior.** The execution protocol says that when current official API/policy documentation cannot be checked, the agent must not code from memory or invent an endpoint/model; mark the feature unverified/blocked, keep it disabled and request the evidence/access path while continuing independent work. YouTube phase instructions align with this.
6. **Retained the model-selection scope correction.** Leaderboard research is a quality benchmark for the authoring assistant, not a setting/request for AI Studio. The expected current Flash-based Build agent remains the target; app-runtime providers and OpenCode stay separate. `claude-opus-5-5`, the `max` effort/variant, and the consumer Claude Max subscription remain distinct terms.
7. **Retained and cross-checked the existing model/media/cost research.** The dated task-specific rankings, Gemini Omni Flash route/output constraints, retired Veo preview IDs, pricing snapshots, and illustration-first versus generated-video trade-off remain research inputs only. Runtime model IDs, routes, prices, policy, account/region access and rights must be rechecked against current official sources before use.
8. **Retained core product and safety constraints.** The pack still requires original story/canon, local-first Windows production, provider data notices, scoped human spend approvals, manual Studio fallback, private API upload where used, distinct final/public approval, no invented citations/rights, no fake provider success, no silent quality downgrade, and honest tested/untested reporting.

## Cross-document consistency checks

- Build sequence remains component prompts `03`–`07` → integration `11` → hardening `08` → final traceability/red-team audit `13`; `00` tells the operator to load `02`, `14` and `15` before coding.
- Implementation/audit prompts target the current AI Studio Build agent and do not ask for a model switch. Runtime provider adapters and optional OpenCode remain separate systems.
- `02`, `15`, `03`, `06`, `11`, `13` and `14` use the same persisted status codes and require reconciliation before a retry where a remote side effect may have occurred.
- Every relevant phase uses `15` to guide recovery tests; the matrix explicitly states that unlisted failures must be classified and added, and is not a completeness guarantee.
- Current official documentation, successful provider setup, current terms, actual costs, rights, Windows/WSL execution, rendering, OAuth, YouTube status and publishing behavior remain unverified until tested in the user's environment.

## Validation performed for this revision

- Counted **16 Markdown files**, numbered `00` through `15`.
- Checked balanced fenced code blocks, internal numbered Markdown-file references, required phase-to-protocol/failure-matrix links, and consistent state vocabulary.
- Parsed the series roadmap: **100 consecutive ten-episode arcs**, covering E001–E1000 with no gaps or overlaps.
- Rebuilt `/home/user/zombie-studio-prompts.zip` from the current prompt folder and verified ZIP CRC/integrity and exact inclusion of the 16 Markdown files.
- Confirmed no application source repository is present. No AI Studio build, Windows/WSL, OpenCode, provider/API, paid media-generation, FFmpeg render, OAuth, YouTube upload or publishing test was run or claimed.

## Remaining decisions and limitations

The app itself has not been built or tested. The operator must still choose language/locale, audience, providers/account tiers, data-use consent, spend caps/currency, backup/retention, Shorts count, channel, upload method and production timezone. Google API access, current model IDs/prices/terms, stable regional availability, provider rights, actual per-shot costs, Windows/WSL runtime, FFmpeg rendering, OpenCode workflow, YouTube OAuth and publishing status all require live verification in the user's environment. The model/provider research and failure matrix reduce guesswork and improve recoverability; they cannot guarantee flawless software, perfect generated media, or anticipation of every future failure.
