---
name: ternfall-project-isolation
description: Prevent cross-project and cross-episode contamination in canon, bibles, allocation and editing.
---

# Ternfall Project Isolation

1. Resolve the selected project and episode explicitly at every UI, API, CLI and persistence boundary; distinguish absent and ambiguous records.
2. Apply original Ternfall canon and roadmap only to its own project. New projects have their own unverified context and must not inherit characters, locations or approval claims.
3. Preserve existing identity mismatches for explicit human reconciliation; preview, compare revisions and back up before any authorized apply/undo.
4. Test at least two projects, duplicate episode identifiers, stale clients and no-write failures. Do not touch real project metadata for test setup.
