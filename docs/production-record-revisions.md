# Production metadata revisions and closed legacy routes

## Safety correction (Batch 9)

Earlier progress reports overstated the coverage of the safety middleware. Inspection found that legacy job transition/reconciliation and YouTube package creation were still reachable, and grant creation had a trailing-slash gate gap. These handlers could assert success, passing QC or review metadata without running the corresponding work. Batch 9 removes these handlers rather than leaving simulated-success code behind a gate.

The following mutations now return 501 without performing an action:

- Job transition and external-effect reconciliation.
- Autoproducer start/advance.
- YouTube package creation.
- Spend-grant creation and revocation.

The gate normalizes case and trailing slashes to match Express routing behavior. Regression requests include canonical paths, mixed/upper case and trailing-slash variants. Grant revocation is intentionally disabled until an operator-only transactional approval service can prevent stale accounting overwrites. This does not revoke or alter any existing grant; paid execution remains disabled.

## Internal storage revision contract

`saveJob`, `saveAutoproduceRun` and `savePackage` now compare record revisions atomically in SQLite. Reads expose legacy missing revisions as 0 without rewriting the document. A successful save returns a new record with the next revision and server update timestamp. A stale token throws `RevisionConflict`; a missing token means 0, not an unconditional overwrite. This internal contract does **not** reopen the HTTP mutation routes.

Callers must use the returned saved record for subsequent writes. These saves do not mutate the caller's object. Inputs are cloned before asynchronous work, preventing later caller edits from changing an in-flight save. Project scope, existing episode identity and creation time are protected; identifiers, revision tokens and creation time are validated. The project and referenced episode must exist. New saves persist project scope, including packages; legacy package reads expose scope from their project collection.

This is metadata concurrency protection, **not** an execution state machine, complete nested schema validator, provider reconciliation service, media-QC verifier or approval service. Package QC/rights flags and historical succeeded stage/job labels remain untrusted assertions. Do not use them to authorize spending, upload or publication. The local-render worker retains its separate ownership-checked state/evidence system.

## Browser behavior

The YouTube view no longer auto-creates a fabricated package when its list is empty. It shows load errors and an explicit empty state, guards stale project loads and labels package data historical. Its local preflight checklist starts unchecked; completing it does not issue an authorization or persist review evidence. The default-package creation button is removed.

Legacy job transition/reconciliation, autoproducer execution and quick-grant controls are disabled. Historical records can still be inspected, but those views are not proof that media exists or meets QC. Some legacy UI fields/labels and stale-state handling still need further cleanup; no automated browser validation is claimed.

## Tests and remaining work

Eight new storage regressions cover all three models: stale independent-instance writes, invalid revisions/scope/identity, caller-snapshot isolation, legacy revision-zero reads, and simultaneous independent-process saves (exactly one winner and one conflict per model). Endpoint regressions exercise closed routes and path variants without accessing production records.

Still open: project archive concurrency, append-only event schemas, operator-only approval/reconciliation integration, full model schemas, historical evidence audits, browser tests and real provider execution. No publication or paid/provider operation is enabled by this change.
