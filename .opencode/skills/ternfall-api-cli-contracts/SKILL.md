---
name: ternfall-api-cli-contracts
description: Compare UI, HTTP API and typed CLI semantics, errors and project scoping.
---

# Ternfall Api Cli Contracts

1. Trace actual handlers and CLI dispatch; do not present a simulator, unsupported operation or hardcoded project as a successful command.
2. Validate parameters and revisions at the server/storage boundary. Check project identity, response status, error body, idempotency and no side effects on rejection. Preserve missing legacy revision 0, reject malformed values and never advance beyond the safe-integer limit; test rollback and multi-write Flow rechecks at the boundary. Every document write — HTTP, CLI or internal — passes a model-clean document: unknown caller keys are rejected at the storage boundary and stored-only legacy keys are restored exclusively from the stored record.
3. Cover disabled production, publishing, spending and legacy endpoints; fail closed rather than fabricate outputs.
4. Keep help and UI actions synchronized with working commands, and test scoped examples without initializing real production data.
