# Batch evidence, gap-safe checkpoints and revision conflicts

## Exact plans and project paths

New Flow plans contain exactly the expected number of frames, including a partial last batch. A 25-second **keyframe storyboard** has batches of 24 and 1; a one-second 30fps dense plan has batches of 24 and 6. Keyframe timestamps advance at one frame per second; dense timestamps use the selected fps. The output directory always uses the selected project, not the default project's ID.

Account slots are illustrative allocations, **not authenticated Pro accounts**. New/read plans do not assert verified subscriptions, credit balances, quotas or perpetual capacity. No account sessions or provider operations are performed by planning.

## Real frame verification

Place existing original/licensed PNGs under:

```text
data/production_root/projects/<project>/assets/flow_renders/<episode>/frame_00001.png
```

Use exact global names across batches. Batch 2 starts at `frame_00025.png`, not `frame_00001.png`. The final batch requires only its expected frames. Every frame must fully decode as a single 1920×1080 PNG, within the size/pixel limits shared with the local media renderer.

The Google Flow batch panel now offers **Verify existing PNGs**, not simulated ingestion. Verification reads actual files and stores versioned evidence: global index, canonical basename, SHA-256, dimensions, byte size and check timestamp. It never creates images or accepts caller-supplied filenames as proof. Explicit `simulate` fields (even false) and filename claims are rejected, so old simulation clients fail rather than silently changing behavior.

The typed CLI can also verify a batch:

```bash
npm run studio -- flow status --episode S01E001 --json
npm run studio -- flow ingest --episode S01E001 --batch 2 --json
```

Optional `--expected-revision <n>` pins the revision. Without it, CLI ingestion loads the current plan once and the final save still uses compare-and-swap. Supply `--project <id>` for a non-default project.

API verification:

```http
POST /api/projects/:id/flow/ingest
Content-Type: application/json

{"episodeId":"S01E001","batchId":"GF_S01E001_B0002","expectedRevision":3}
```

The caller must use the revision returned by the latest plan GET. Missing/corrupt frames cannot partially certify a new batch. For an already verified batch, an explicit recheck first commits its transition to **pending** and revokes the old evidence before opening any frames. A successful recheck commits fresh evidence in a second revision. A failed read or crash **before** the final commit leaves that revoked revision pending unless a concurrent writer has since committed a newer plan. Compare-and-swap protects the newer plan at both commits. While a recheck is running, other readers can see the pending state.

If the initial revocation reports an error, the recheck does **not** inspect any frame; the old evidence may remain or the revocation may already have committed. A final write can likewise report an error after its commit, leaving fresh evidence stored. An error or lost response therefore does not prove either outcome: resolve any storage issue and reload the plan before deciding whether to recheck or rely on a checkpoint. The browser clears the old summary/badges after a mutation and disables plan preparation if the latest state cannot be reloaded. A previously unverified batch still needs only the final successful commit. Evidence remains point-in-time: later file changes do not automatically revoke it.

Flow routes return fixed, no-store validation/conflict responses and a generic internal error for unexpected failures rather than exposing exception messages or missing-frame filesystem paths. A generic error does not prove whether a mutation or evidence revocation committed; inspect current state and recheck. This protection does not yet cover every API route or all historical document fields.

## Episode provenance and bounded responses

New plans snapshot the selected episode's revision and build draft prompts from its own fields. Plans with an absent source revision are **unknown**; after an episode edit they are **stale**. Unknown or stale plans cannot be verified or used as checkpoints; explicitly replace the plan using its latest plan revision. Replacement clears recorded verification evidence but never deletes supplied files. Saving verification checks both episode and plan revisions in the same transaction, so a concurrent source edit cannot be certified as current.

The browser requests summary and paged batches rather than transferring the full plan. The current server still reads/parses the entire plan internally, so pagination is not a guarantee of low server memory usage. Existing historical plans and prompts remain readable until deliberately replaced.

## Checkpoints find gaps

Only batches with structurally complete, versioned decode evidence count as verified. Legacy `verified` labels without evidence are displayed as pending; bare `ingested` labels do not count toward completion. Progress comes from these manifests, not a directory's filename count.

If batch 2 is verified while batch 1 is missing, the checkpoint's next batch is **1**, not 3. Duplicated completion indices or a caller-provided completion flag cannot make the pure resume helper skip gaps.

Evidence describes files **at the time of checking**. Reading a checkpoint does not continually rehash every source image. Recheck after editing assets. Local media export independently decodes and snapshots the current inputs, so a saved batch label is never enough to bypass render validation. This is gap-safe batch progress, not resumable paid-provider generation or per-frame FFmpeg execution.

## Optimistic revision checks

Episodes and Flow plans now carry `revision`. Legacy records without the field are revision 0. Each successful save increments it atomically in SQLite; stale or omitted tokens cannot overwrite a record once its revision advances.

- Episode POSTs return HTTP **409** with `code: REVISION_CONFLICT` and `currentRevision` for stale edits. GET the latest episode, merge your editor changes and resubmit with that revision.
- Plan POSTs accept `expectedRevision`. A reset needs the latest loaded revision; it intentionally clears that plan's prior evidence but keeps source files.
- A plan replaced while images are being inspected rejects the old verification result at commit time.
- The script editor retains unsaved text and shows errors/conflicts instead of pretending a save succeeded. Copy that text before navigating/reloading to merge.
- Record identities/project scopes cannot be changed by matching another record's database ID.

CLI plan reset example:

```bash
# Inspect current revision first.
npm run studio -- flow status --episode S01E001 --json
# Intentionally replace the plan, using the revision you inspected.
npm run studio -- flow plan --episode S01E001 --duration 60 --mode dense_24fps --expected-revision <n> --json
```

Revision protection covers episodes, Flow plans and several other records, including settings and series; see [configuration revisions](configuration-revisions.md). Saves refuse to advance beyond the JavaScript safe-integer limit and do not reset exhausted tokens automatically. A recheck of already verified evidence at the next-to-last revision can commit revocation using the last safe revision, then fail to commit new evidence; the stored batch remains pending. Inspect current state and seek operator review. Revision checks are not a complete schema or concurrency guarantee for every record type. There is no automatic merge UI yet.

Some legacy plans overallocated their last batch or stored incorrect timecodes. Regenerate those plans deliberately using the latest revision before verifying them; source media is preserved. Prior simulated verification is not carried forward as real evidence.

## Still disabled or limited

Paid generation, arbitrary batch-status changes, the legacy autoproducer, fake account telemetry and public publication remain disabled. The separate supplied-asset local export worker accepts 24–21,600 frames at 24 fps (1–900 seconds); the opt-in 900-second fixture is not part of routine tests. No rights/editorial approvals are implied by image verification or technical QC.
