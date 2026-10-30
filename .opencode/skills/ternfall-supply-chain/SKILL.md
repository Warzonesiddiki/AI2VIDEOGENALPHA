---
name: ternfall-supply-chain
description: Assess npm dependencies, licensing, build-time scripts and pinned agent assets without overstating assurance.
---

# Ternfall Supply Chain

1. Inspect package-lock, direct and transitive dependencies, install lifecycle scripts, engine requirements, binary provenance and update ownership.
2. Use lockfile-based installation and npm audit; separately report signature/provenance checks and network failures. Zero advisories is not a security certification.
3. Review upstream sources, licenses and executable helpers before inclusion. Pin commits and record attribution/checksums; do not use blind remote installers.
4. Keep CI permissions minimal and pin actions to immutable commits after review. A workflow example is not active CI.
