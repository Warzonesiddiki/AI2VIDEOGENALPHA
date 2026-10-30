---
name: ternfall-worker-recovery
description: Reason about durable media job ownership, cancellation, crashes and restart recovery.
---

# Ternfall Worker Recovery

1. Map enqueue, claim, ownership token, running work, terminal writes and cleanup. Identify which process can prove that its own worker stopped.
2. Never reclaim a live or unknown foreign claim merely because a local controller is absent; consider PID reuse, host identity, interrupted writes and storage outages.
3. Exercise setup failures, cancellation, terminal-write failures, same-process recovery and multi-process contention with deterministic fault injection.
4. For current Linux cross-process claims, compare boot ID and PID namespace as well as host and token before probing a PID; recheck under the write transaction. Unknown/legacy domains and non-Linux cross-process claims require operator investigation, not an automatic override.
5. Resolve incomparable claims only through `studio media adjudicate` with BOTH attestations plus an evidence note; refuse when the owner is live or when normal recovery already applies. The adjudication must preserve the full claim as history and state plainly that no artifact verification occurred — attestation is a human evidence step, never an inference.
6. Treat duplicate job IDs as ambiguous across the entire root; recheck project and ownership inside each mutation transaction.
7. Preserve original assets and distinguish interrupted, failed, cancelled and succeeded states; document orphan/host recovery gaps.
