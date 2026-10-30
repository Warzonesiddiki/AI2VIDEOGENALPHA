---
name: ternfall-architecture-audit
description: Map Ternfall Studio components, trust boundaries, risk and evidence before auditing or changing architecture.
---

# Ternfall Architecture Audit

1. Identify entrypoints, data flow, authoritative records, external services and disabled paths from code, not feature labels. Distinguish API, UI, CLI, worker, runtime files and tests.
2. Enumerate assets, actors, intended single-operator assumptions, attacker capabilities and exclusions; document uncertainty and dependencies.
3. Trace inputs and side effects across boundaries and transactions. Give findings a concrete precondition, impact, evidence, reproduction and severity rationale.
4. Separate observed behavior, historical claims, tests, recommendations and residual risk. Never claim exhaustive coverage or certification.
