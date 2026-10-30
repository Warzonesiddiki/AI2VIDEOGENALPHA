---
name: ternfall-storage-integrity
description: Safeguard SQLite-backed documents, revisions, idempotency and immutable episode history during persistence changes.
---

# Ternfall Storage Integrity

1. Read server/lib/documents.ts and storage transaction boundaries. Preserve `BEGIN IMMEDIATE` atomicity and avoid await or external effects inside synchronous transactions.
2. Check scope, identity, revision compare-and-swap, idempotency keys and rollback under concurrent processes; snapshot caller inputs before asynchronous work.
3. Treat historical script versions and source evidence as append-only. Do not silently repair, overwrite, migrate or reseed existing records.
4. Test stale writes, duplicate requests, interrupted commits, corrupt inputs and reopen/recovery using isolated temporary roots; never exercise destructive tests on actual production data.
