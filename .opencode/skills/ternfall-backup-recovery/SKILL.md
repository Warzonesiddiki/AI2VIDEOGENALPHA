---
name: ternfall-backup-recovery
description: Plan metadata and media preservation, SQLite WAL-aware backup and careful restoration.
---

# Ternfall Backup Recovery

1. Inventory authoritative SQLite state, original assets, exports, manifests and configuration. A metadata-only backup is not a media archive.
2. Avoid copying a live database without a consistent SQLite backup method; verify integrity and test restore in an isolated destination, including version and scope checks.
3. Preview migrations and reconciliation; preserve originals and evidence and require an explicit operator decision before production changes.
4. Document untested disaster, disk-full, interrupted backup and orphaned-media scenarios. Never delete a database or assets to force reseeding.
