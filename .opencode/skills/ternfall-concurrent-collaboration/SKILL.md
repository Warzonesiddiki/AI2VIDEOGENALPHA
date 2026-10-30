---
name: ternfall-concurrent-collaboration
description: Coordinate independent investigations and concurrent changes without clobbering shared files.
---

# Ternfall Concurrent Collaboration

1. Parallelize independent read-only checks and isolated test roots. Assign non-overlapping write ownership; serialize edits to the same file or shared state.
2. Review diffs before integrating work and verify no changes were lost, unrelated production data was modified, or branches were switched.
3. Use atomic compare-and-swap or transactions rather than assuming UI ordering prevents races; test independent processes where relevant.
4. Record exact commands, outcomes and uncertainties. Do not claim a subagent or tool result is verified until its artifacts are inspected.
