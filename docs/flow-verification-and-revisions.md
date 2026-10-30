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

The Google Flow batch panel now offers **Verify N Existing Frames**, not simulated ingestion. Verification reads actual files and stores versioned evidence: global index, canonical basename, SHA-256, dimensions, byte size and check timestamp. It never creates images or accepts caller-supplied filenames as proof. Explicit `simulate` fields (even false) and filename claims are rejected, so old simulation clients fail rather than silently changing behavior.

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

The caller must use the revision returned by the latest plan GET. Verification is all-or-nothing for that batch. Missing/corrupt frames cannot partially certify a new batch. If an explicit recheck discovers a previously verified batch is bad, its old evidence is revoked and the plan revision increments, unless a newer concurrent plan has already replaced it. Verification never overwrites that newer plan.

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

Revision protection currently covers **episodes and Flow plans**. Other full-replacement record types still need equivalent conflict handling; collections already use transactional updates. There is no automatic merge UI yet.

Some legacy plans overallocated their last batch or stored incorrect timecodes. Regenerate those plans deliberately using the latest revision before verifying them; source media is preserved. Prior simulated verification is not carried forward as real evidence.

## Still disabled or limited

Paid generation, arbitrary batch-status changes, the legacy autoproducer, fake account telemetry and public publication remain disabled. The separate verified local export worker remains limited to 1–60 seconds. No rights/editorial approvals are implied by image verification or technical QC.
