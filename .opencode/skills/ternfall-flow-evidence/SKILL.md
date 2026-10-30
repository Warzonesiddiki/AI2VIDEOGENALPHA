---
name: ternfall-flow-evidence
description: Review Flow plans, source revisions, frame verification and checkpoint evidence without fabricating progress.
---

# Ternfall Flow Evidence

1. Trace episode context and revision into a plan. Unknown, missing or changed source must not qualify a plan as current, verified or resumable.
2. Inspect actual bounded PNG files through the verification code, recording decode and hash evidence; caller-provided names/statuses are not evidence.
3. Revoke old proof durably before inspecting a recheck, then compare plan/source revisions on the final save. Test crashes, before/after-commit errors and concurrent replacement; a reported error can be ambiguous.
4. Hide stale UI evidence and block replacement when reloading the current revision fails. Preserve historical records; replace plans only deliberately with their current revision. Paginated responses do not imply the backing plan is streamed or memory-bounded.
