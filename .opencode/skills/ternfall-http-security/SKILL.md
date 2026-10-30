---
name: ternfall-http-security
description: Review local and remotely exposed HTTP routes, authentication, CSRF, scoping and input boundaries.
---

# Ternfall Http Security

1. Trace the actual server mount, operator authentication and origin checks, including localhost, proxies, malformed hosts, absent origins and browser versus non-browser clients.
2. Check project/episode/job scope on every read and write. Validate identifiers, bodies and bounded work before side effects; return accurate errors.
3. Separate URL syntax checks from real SSRF defenses; future fetchers must independently handle DNS resolution, redirects, private addresses, timeouts and response limits.
4. Use explicitly typed, fixed public errors and browser response objects through a deliberate, recursively validated allowlist; never classify arbitrary exception codes or expose raw filesystem/process diagnostics. Settings and project HTTP responses omit legacy/provider extras and local roots; preserve raw data on disk, treat malformed values as unknown, and never replace zero with defaults. Production-record listings (jobs, packages, runs, grants) are projected the same way: no paths, raw log/diagnostic text or provider telemetry, cautious fallbacks for display enums, and a generic fail-closed error for malformed structure or money values. Document reads and mutation responses use recursive schemas (`server/lib/documentSchema.ts`): unknown keys never serialize, unknown caller keys are rejected, stored-only legacy keys survive edits including matched nested items, and legacy absence (for example a script version without `wordCount`) is preserved rather than fabricated. Check other endpoints independently rather than assuming they are projected. Snapshot mutable inputs before validation and any asynchronous gap. A failed mutation may still require state inspection.
5. Test denied routes and malformed/cross-origin cases in isolated fixtures. Document that single-token remote access is not multi-user RBAC, rate limiting or deployment hardening.
