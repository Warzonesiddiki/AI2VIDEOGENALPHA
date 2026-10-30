---
name: ternfall-test-engineering
description: Design trustworthy isolated regression, concurrency and browser tests for Ternfall changes.
---

# Ternfall Test Engineering

1. Reproduce the original failure, identify the violated invariant, and write a focused regression before fixing when practical; observe the expected failure.
2. Assert meaningful state and evidence, not just absence of crashes. Include negative, malformed, stale, duplicate, cancellation and partial-failure paths.
3. Use temporary production roots and fake local data; never touch real records or perform paid calls. Avoid parallel edits to shared files and use independent tests in parallel.
4. Run the relevant tests plus full suite, lint, build and browser smoke as feasible. Report exact results, skips, environment and untested cases.
