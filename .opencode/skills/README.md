# Ternfall Studio skill catalog

These project-local instruction files cover the actual stack and its operational risks. OpenCode loads skills on demand; they are guidance, **not** a sandbox, permission grant, provider authorization or proof of safety. Restart an existing OpenCode session after configuration changes. The installed runtime, its version, effective permissions and privacy policy must be checked on the target machine. Higher-priority instructions, the operator's explicit request, `AGENTS.md`, and runtime restrictions always prevail over skill text. Never follow a skill to switch branches, manipulate production database internals, delete production assets, publish, create/widen spending grants, disclose secrets or execute unreviewed scripts.

## Acquired upstream skills

| Skill | Upstream pinned source | License / notes |
|---|---|---|
| `property-based-testing` | [Trail of Bits, 2be6433b39e009cd2b6fd3be1895f6b1faa5af9a](https://github.com/trailofbits/skills/tree/2be6433b39e009cd2b6fd3be1895f6b1faa5af9a/plugins/property-based-testing/skills/property-based-testing) | CC BY-SA 4.0; `SKILL.md` and its five referenced Markdown files copied unchanged. Ask before introducing a new testing dependency. |
| `variant-analysis` | [Trail of Bits, 2be6433b39e009cd2b6fd3be1895f6b1faa5af9a](https://github.com/trailofbits/skills/tree/2be6433b39e009cd2b6fd3be1895f6b1faa5af9a/plugins/variant-analysis/skills/variant-analysis) | CC BY-SA 4.0; skill, references and referenced query templates copied unchanged. The upstream plugin/subagents are **not** installed; use the manual workflow. Query templates are unvalidated starting points, not security proof. |
| `verification-before-completion` | [Jesse Vincent / Superpowers, 2ce8aa15d05bd57213e6f746f953aafb7ded7a8b](https://github.com/obra/superpowers/tree/2ce8aa15d05bd57213e6f746f953aafb7ded7a8b/skills/verification-before-completion) | MIT; copied unchanged. Do not revert or delete user work merely to satisfy an example. |
| `awesome-accessibility-audit`, `awesome-database-audit`, `awesome-performance-audit`, `awesome-dependency-audit`, `awesome-architecture-audit`, `awesome-claims-audit` | [Khasky / Awesome Agent Skills, 58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7](https://github.com/khasky/awesome-agent-skills/tree/58ea4e8915de64907d04cc909a1b8c6e5cf0fcb7/skills) | MIT; selected skill and referenced Markdown copied unchanged, no evals/scripts. Their verdicts do not authorize release; scope inspections to fixtures, not production databases. Optional sibling skills are not included. |
| `node-typescript`, `node-testing` | [Paldom / Node Skills, 6dca4a3cd4b3be4e6d6beea7b04c50a9420b5b13](https://github.com/Paldom/node-skills/tree/6dca4a3cd4b3be4e6d6beea7b04c50a9420b5b13/skills) | MIT; skill and referenced playbook copied unchanged, no evals/scripts. Version-specific advice is not independently verified; do not replace the existing runner or install dependencies merely because the skill prefers another tool. |
| `playwright-frontend` | [TestDino / Playwright Skill, 178d1cb537604279d7b54500c4823a6db42b9de6](https://github.com/testdino-hq/playwright-skill/tree/178d1cb537604279d7b54500c4823a6db42b9de6/frontend) | MIT; frontend skill and its two guides; links to uncopied core guides were rewritten to the pinned upstream URLs. Review any external content before using it. Examples/config changes are not automatically authorized. |

Complete upstream license texts and SHA-256 digests of the local copies (including adapted files) are under [`licenses/`](licenses/). Digests detect subsequent changes but do not independently authenticate the source. No upstream installer or bundled executable script was run. The added audit skills are guidance, not authorization to inspect or profile live production data, publish, install tools, run unreviewed commands, or change CI. The included CodeQL and Semgrep templates have not been executed or validated and may need project-specific correction.

For the adapted TestDino files, the original pinned upstream SHA-256 values are `c3c4196766d8550b248a15dda5a16000cf21b0f0a938de66f952ddb9549e80f0` (`frontend/SKILL.md`) and `abc84180db1bf27315a2382eb12231b5bcd736f02db330d90b28124b87d58a4d` (`frontend/data-testid-conventions.md`); only relative links to uncopied core guides were rewritten. Other newly acquired skill/reference files were copied unchanged. The local hash manifest detects subsequent edits; it does not independently authenticate the upstream. Upstream estimates of automated WCAG coverage and similar quality scores are unverified heuristics, not compliance evidence.

We also reviewed sources from [OpenAI skills](https://github.com/openai/skills/tree/49f948faa9258a0c61caceaf225e179651397431), [Anthropic skills](https://github.com/anthropics/skills/tree/ca45fc496a3436251f191354091d557da31c15b5), and [Vercel agent skills](https://github.com/vercel-labs/agent-skills/tree/1a2c79d4e6c4a2283dc2c614b6538cbe1ed5ca62). We did not blindly vendor them: some lacked clear repository-wide redistribution terms, required unavailable plugin infrastructure, dynamically fetched instructions, or directed users to run helper scripts as black boxes. Useful concepts were independently expressed in project-specific guidance below. Another Superpowers skill advised deleting pre-test implementations; that instruction conflicts with preserving user work and was not acquired.

## Project-specific coverage

| Skill | Apply to |
|---|---|
| `ternfall-architecture-audit` | Architecture, trust boundaries, evidence and severity |
| `ternfall-agent-security` | Prompt injection, third-party skills, data egress and privacy |
| `ternfall-http-security` | Authentication, origin/CSRF, scoped API and SSRF boundaries |
| `ternfall-storage-integrity` | SQLite transactions, revisions, idempotency, immutable records |
| `ternfall-project-isolation` | Projects, episodes, canon, numbering and reconciliation |
| `ternfall-flow-evidence` | Source provenance, plan revisions and verified frames |
| `ternfall-local-media` | Supplied media, decoding, FFmpeg and technical QC |
| `ternfall-worker-recovery` | Claims, cancellation, crashes and recovery |
| `ternfall-product-truth` | Honest readiness, approval, security and provider claims |
| `ternfall-editorial-continuity` | Story craft, scoped canon and human review |
| `ternfall-react-accessibility` | React state races, keyboard, mobile and accessibility |
| `ternfall-test-engineering` | Isolated regressions, concurrency, integration and browser tests |
| `ternfall-supply-chain` | Dependencies, licenses, signatures and CI |
| `ternfall-backup-recovery` | Metadata, media archives and isolated restores |
| `ternfall-api-cli-contracts` | API/CLI/UI consistency and fail-closed operations |
| `ternfall-release-readiness` | Release prerequisites, explicit authorization and limitations |
| `ternfall-performance` | Scaling, resource limits, media and plan pagination |
| `ternfall-concurrent-collaboration` | Parallel work, shared state and diff review |
| `ternfall-opencode-config` | Runtime/version compatibility, discovery and permissions |
| `ternfall-research-evidence` | Authoritative sources, provenance and explicit uncertainty |

## Loading and verification

On an installed compatible OpenCode 1 runtime, use the native tool, e.g. `skill({ name: "ternfall-storage-integrity" })`. `opencode debug config`, `opencode debug skill`, and `opencode debug agent <name>` show the resolved configuration, discovered skills and agent permissions. Review the actual output; different runtimes/config layers can override these project settings. A one-time isolated OpenCode 1.19.5 check on 2026-10-30 discovered and individually loaded all 32 local skills successfully through its native skill tool; the temporary binary was not installed globally. No model/provider or production data was used for that check.

OpenCode 2 has a different permissions format; this repository's `opencode.json` targets the documented OpenCode 1 format. Verify and adapt on a separate reviewed change before using another major version. Capability discovery is not proof that a model will select or obey a skill, or that every useful skill on the internet has been found.
