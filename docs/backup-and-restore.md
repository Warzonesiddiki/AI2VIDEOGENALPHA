# Offline backup and isolated restore

This workflow creates a versioned, hash-manifested copy of the **whole configured production root**, including project directories, original assets, exports and a consistent SQLite snapshot. Previous `backups/` and staged `restores/`, the live SQLite file and its WAL/SHM/journal sidecars are excluded; the SQLite snapshot replaces the latter. It does not include files stored outside that root, the repository, environment variables, application dependencies or external provider data. Historical reconciliation events can refer to metadata-only snapshots inside the excluded `backups/` directory; keep those earlier backups separately if they are needed as evidence.

> **Important:** Stop every Ternfall server, CLI worker and other writer before creating a backup. The confirmation flag is an operator statement, not proof the system is stopped. A database snapshot and a filesystem copy are not one atomic snapshot. The tool detects many concurrent changes and refuses queued/running or invalid local render jobs, but it cannot prove that no writer, hostile process, or undetected race existed. Do not rely on a backup made while anything is writing.

## Create and verify

1. Stop all servers, render workers and other processes using the root. Resolve queued/running renders before stopping. Do not delete original data to clear the queue.
2. Confirm the filesystem has enough free space for a second copy, including SQLite, assets and exports. The tool does not reserve space. A failure attempts to remove only its own incomplete bundle; cleanup failure is reported.
3. From the checkout whose current working directory owns the production root, run:

```bash
npm run studio -- backup create --confirm-stopped --json
# Replace BUNDLE_ID with the bundleId returned by create.
npm run studio -- backup verify BUNDLE_ID --json
```

Bundles are placed under `data/production_root/backups/bundle_<uuid>`. Each is a private directory containing a SQLite snapshot, copies of regular files, a manifest with sizes/SHA-256 hashes, and a `COMPLETE` marker written only after verification. Symlinks and special files are refused. Files are copied with restrictive permissions; original modes, timestamps, hard-link relationships and extended attributes are not preserved. Interrupted copies without `COMPLETE` are **not valid backups**. A successful hash check detects accidental damage but is **not a digital signature or proof of authenticity**; keep backups in a trusted location.

Backups may contain private scripts, notes, provider settings, historical approvals and other sensitive material. They are not encrypted or redacted. The local bundle shares the source disk and is **not an independent disaster backup**: an operator must securely copy the entire completed bundle to independent protected storage, retain previous copies, and verify a returned copy. No external copy, deletion, upload or network access is performed by this tool.

`studio project backup` remains a separate **metadata-only** snapshot; it does not include media.

## Stage a restore (never overwrites live data)

Keep the live server and writers stopped and ensure enough free space for another full copy; staging on the same disk can otherwise exhaust space needed by the live workspace. The tool does not enforce a shutdown or reserve space.

```bash
npm run studio -- backup stage BUNDLE_ID --confirm-isolated --json
```

The command verifies the source bundle, then copies and verifies it again into a unique `data/production_root/restores/restore_<uuid>/data/production_root` directory. It returns the outer staging `path` and the nested `productionRoot`. It never writes over, merges into, or activates the live project. Verification and staging refuse unexpected/missing files, hash mismatches, invalid manifests, unsupported SQLite schema versions, symlinks and nonterminal local-render jobs. `RESTORE_INFO.json` is written only after staging checks complete; a directory without it is incomplete and must not be treated as a restore.

For a disaster rehearsal on a different machine or empty working directory, an operator first places the entire independently stored bundle under that directory's `data/production_root/backups/<bundle-id>` without replacing any existing files. Run the same CLI from that working directory using the absolute path to a reviewed checkout's CLI and `tsx` loader; backup commands do **not** initialize or seed a missing live database. Run `verify`, then `stage`. The tests rehearse this with isolated synthetic fixtures, not actual production data.

To inspect a stage using the application, use a separate loopback-only server and a free port, with the staged outer `path` as its current working directory and `NODE_ENV=production` (a built UI is required). This writes only to the staged copy. Keep the live server stopped and take care that no reverse proxy points the staged server at users. Review project/episode records, files and media before any recovery decision.

Absolute paths embedded in old metadata are preserved as historical values, not rewritten. Cached local-render checkpoint paths may refer to the old root and may require re-encoding. Technical integrity is not editorial approval, rights clearance, semantic validation or a guarantee that all legacy records are compatible. This workflow intentionally provides **no automated promotion, merge, replacement or rollback of the live root**; any such operation requires a separate, reviewed operator plan with independently retained originals.

## Evidence and limits

`server/backupRecovery.test.ts` exercises SQLite WAL inclusion; synthetic metadata/media round trips; an actual one-second synthetic render restored through hash-verified playback; restoration into an otherwise empty recovery root; nonterminal job refusal; path traversal, symlink and special-file rejection; corruption/missing/extra files; mutation races; simulated `ENOSPC`; cleanup failure; and killing backup and restore processes before completion. These tests are not a power-loss durability guarantee, full-size production rehearsal, hostile-filesystem penetration test or Windows/macOS compatibility proof. Directory-entry durability across sudden power loss is not established. Rehearse and monitor backup retention separately; do not delete existing copies to make a test pass.
