# Batch 15 — parallel review record

Fifty separate read-only `bash` calls were issued together through the parallel tool before dependent code edits. They inspected distinct boundaries; this is not a claim of fifty tests, independent reviewers or exhaustive assurance. Follow-up calls installed dependencies, edited files and ran actual regressions in order. One optional-path search returned a missing-path diagnostic, recorded below rather than treated as proof.

| # | Check | Outcome / follow-up |
|---|---|---|
| 1 | Branch/diff | Correct fixed session branch; clean whitespace checks. |
| 2 | Playback path | Confirmed path-only lookup lacked byte checks; replaced HTTP use. |
| 3 | Playback routing | Confirmed sendFile reopened paths; descriptor streaming implemented. |
| 4 | QC hashes | Existing measured SHA-256 used as expected digest. |
| 5 | Type locations | Shared types and worker interfaces located; worker owns media QC. |
| 6 | File evidence | Streaming hashing pattern retained for large files. |
| 7 | Existing playback tests | Expanded coverage beyond successful ranges to changed outputs. |
| 8 | Player behavior | Added explicit playback error message, no fallback. |
| 9 | Recovery/purge | Owner and orphan limitations remain open. |
| 10 | Child process | Bounded cancellation/timeout exists; platform child-tree assurance open. |
| 11 | Cleanup ownership | Prior finally fix retained; no new lease claim. |
| 12 | Disk estimates | Preflight not reservation; F09 remains open. |
| 13 | Frame bounds | Prior bounded-read handle discipline retained. |
| 14 | JSON errors | Final error boundary retained. |
| 15 | Error tests | Malformed/oversize/internal detail fixtures retained. |
| 16 | Operator access | Single shared operator boundary; no RBAC claim. |
| 17 | Startup security | Remote token and local binding rules retained. |
| 18 | API mounting | Error boundary ordering inspected. |
| 19 | CI | Linux Node 22 matrix only; browser/Windows gap open. |
| 20 | Dependencies | Clean install and audit executed after review. |
| 21 | Compiler options | Strict typing not enabled globally; no assurance claim. |
| 22 | Inspector calls | Identified stale unguarded read requests; abort/reset added. |
| 23 | Inspector selection | Replaced stale closure selection with updater. |
| 24 | Flow requests | Other stale-load coverage remains follow-up. |
| 25 | Arc UI | Key retained only while mounted; documented. |
| 26 | Script editor | Added generation/submission guards to save path. |
| 27 | Voice/readiness labels | Prior fake-duration removal retained; no auto readiness. |
| 28 | Story tests | Existing advisory/canon/provenance checks retained. |
| 29 | Scaffold builder | Bounded local scaffold, not generative provider execution. |
| 30 | Craft review | Advisory field prompts, not a quality certificate. |
| 31 | Provider adapter | Paid refusal retained; no request made. |
| 32 | Fresh pilot | Unapproved draft remains; no production migration. |
| 33 | Pilot timing | Derived reading estimate, not measured voice. |
| 34 | Story workflow | Human factual/editorial review remains required. |
| 35 | README accuracy | Updated playback capability and residual assumptions. |
| 36 | Flow reads | Explicit preparation/no-store contract retained. |
| 37 | Arc storage | Atomic request/card persistence retained. |
| 38 | Arc templates | Draft placeholders still require editorial work. |
| 39 | Arc regressions | Concurrent allocation and rollback suite retained. |
| 40 | Project tests | CAS/CLI/rollback coverage retained. |
| 41 | Backup scope | Metadata-only; guided media restore remains open. |
| 42 | Path confinement | Symlink rejection retained; not an OS sandbox. |
| 43 | Security tests | Fail-closed retired routes retained. |
| 44 | Media regressions | Added one real-render HTTP mutation fixture. |
| 45 | Audit priorities | F10 addressed narrowly; residual F12/F15 not closed. |
| 46 | Task list | Updated latest work without erasing historical entries. |
| 47 | Progress log | Added new evidence/totals and exclusions. |
| 48 | Frame-growth test | Prior growth-after-stat test retained. |
| 49 | Optional type search | Optional src/core/localMedia.ts absent; actual server declarations inspected. |
| 50 | Environment/bootstrap | Required Node/access/test guidance retained. |

## Measured verification

Clean install, lint, 167 passing tests (1 long skipped, 0 failed), production build, dependency audit (0 vulnerabilities), diff checks. Twelve new tests address verified playback. UI guards were source/type/build checked, not browser-tested. Details and exclusions: `verified-playback.md` and `deep-re-audit-2026-10-30.md`.
