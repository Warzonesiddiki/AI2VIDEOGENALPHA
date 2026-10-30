# Real local media workflow

This is a **local preview/master-render workflow**, not visual generation or a public publishing pipeline. It executes FFmpeg against supplied images/audio and marks success only after measured technical QC. Paid providers and public publication remain disabled.

## Requirements

- Node 22.13+ and `npm ci`.
- A maintained, operator-installed FFmpeg build with `libx264`, AAC and `loudnorm`, plus FFprobe. Put them on PATH or configure absolute `FFMPEG_PATH` and `FFPROBE_PATH` environment variables.
- Original/licensed source assets under the configured production root.

The npm FFmpeg/FFprobe installer packages are **development-only test fixtures**, not automatically selected by the production worker. Their packaged binaries are old and should not be treated as maintained production dependencies. Tests deliberately select their paths to run without an OS package manager; the runtime selects only your environment overrides or PATH. A successful npm vulnerability scan does not certify bundled/native decoder binaries.

## Input layout

For project `proj_ternfall_01`, episode `S01E001`:

```text
data/production_root/projects/proj_ternfall_01/
  assets/flow_renders/S01E001/
    frame_00001.png
    frame_00002.png
    ...
    frame_00120.png
  audio/S01E001/
    narration.wav
```

Each image must fully decode as a **single 1920×1080 PNG**, not a 1×1 placeholder. Names are exact, globally numbered from 1. The explicit frame count controls this export: 120 frames at 24fps is 5 seconds, not a complete episode. The worker permits **24–21,600 frames (1–900 seconds / 15 minutes)**. Extra source frames are not included. Frame files are limited to 12 MB each.

Audio must be a WAV or FLAC basename (no directory components), at most 512 MiB, decode successfully and cover the entire export duration. Silence/unmeasurable loudness fails; the system never substitutes silent audio or a drone. Your audio may contain narration or a mix, but the worker does not synthesize speech, assert licenses, or perform editorial review.

## Browser workflow

Start the studio and open **Local render** or **Flow plan & local render → Real Local Render**. Enter the frame count and audio basename, then select **Queue Local Render**. The server polls the durable queue; only one render is active per production root, across all server/CLI processes. At most eight jobs can be active/queued.

The panel displays actual queued/running/failed/cancelled/interrupted/succeeded state and completed/encoded/revalidated-reused video segment counts for the current attempt. Successful jobs show measured QC and a real video player with no synthetic fallback. Retry uses the **current** source files and a separate attempt directory. Source assets are never deleted.

## Typed CLI workflow

```bash
# Queue an export; idempotency key must identify exactly this logical request.
npm run studio -- media enqueue --episode S01E001 --frames 120 --audio narration.wav --idempotency-key preview_001 --json

# If no server worker is running, process one queued job locally.
npm run studio -- media work --json

# List jobs or inspect one returned render ID.
npm run studio -- media status --json
npm run studio -- media status <render-id> --json

npm run studio -- media cancel <render-id> --json
npm run studio -- media recover --json
npm run studio -- media retry <render-id> --json

# Explicitly discard reusable video cache for a terminal render; NOT source/export media.
npm run studio -- media purge-checkpoints <render-id> --json
```

Use `--project <project-id>` for another project. Reusing a key with different parameters fails. Reusing an identical key returns the existing job, not a second export. `media work` works on the shared root queue (oldest queued job), not only the selected project's jobs. Do not interpret a queued or running state as successful media.

## API

All routes inherit the studio's operator access and origin protections:

- `POST /api/projects/:id/local-renders` with `episodeId`, `frameCount`, `audioFile`, `idempotencyKey` queues an existing episode, returning HTTP 202.
- `GET /api/projects/:id/local-renders` lists jobs.
- `GET /api/projects/:id/local-renders/:jobId` returns job state and evidence.
- `POST .../:jobId/cancel` requests cancellation.
- `POST .../:jobId/retry` requeues an unsuccessful terminal job.
- `POST .../:jobId/purge-checkpoints` explicitly removes a terminal job’s cached segments, preserving sources and exports.
- `GET .../:jobId/media` serves only a succeeded, QC-passed job's server-owned output path, with byte-range support.

The caller cannot supply executable paths, arbitrary input paths, output paths, shell commands or a requested success state. WAV/FLAC/MP4 parsers and file/pipe protocols are selected explicitly rather than accepting network playlists. Render API responses use `Cache-Control: no-store` and omit worker ownership, absolute checkpoint paths, retirement tokens and raw subprocess/filesystem errors. They expose `retiredCheckpointCount` instead of retirement tokens. The local operator CLI `media status <render-id>` retains detailed errors; treat that output and logs as sensitive. A mutation returning an internal error does not establish whether its side effects committed; inspect current state before retrying.

## Execution and evidence

1. Claim the job atomically in SQLite. No other worker can claim another job while one is running in this root.
2. Stream-snapshot and hash the audio. Stage and fully decode PNGs one 120-frame (five-second) segment at a time, recording SHA-256, dimensions and byte size. Each segment uses its staged immutable inputs; the entire episode is not snapshotted at once.
3. Analyze audio loudness for the exact export duration, then perform the measured second-pass normalization into a 48 kHz stereo WAV. Encode H.264/yuv420p video at 24fps in durable five-second segments (the final segment may be shorter). Concatenate and mux video without re-encoding, with continuous stereo AAC from the normalized audio.
4. Fully decode the candidate export and inspect actual streams, frame count and duration using FFprobe. Measure final encoded audio, not just normalization targets.
5. Require 1920×1080, H.264/AAC, 24fps, exact expected decoded frame count, 48 kHz stereo, duration and stream-duration difference within 0.1 seconds, A/V start difference below 0.05 seconds, integrated loudness **−14 LUFS ±0.5**, and true peak **≤−1 dBTP**.
6. Move the verified candidate to `projects/<project>/exports/local/<render-id>/attempt_<n>/master.mp4`, persist measured QC/hash and input manifest, and only then expose playback.

This is technical QC only: it cannot prove motion quality, absence of semantic duplication, creative originality, rights clearance, lip sync or editorial suitability. The audio/video check measures stream-start/duration agreement, not semantic lip synchronization. Hashes describe the files at export time; production directories must remain operator-controlled (continuous tamper detection is not implemented).

## Failure and recovery

Processes run without a shell or stdin, with bounded output, hard timeouts and cancellation. Cancellation works across workers through the durable job flag; partial/failed outputs are not exposed. Scratch cleanup is attempted only while metadata still identifies this owner and attempt; uncertain/replaced claims may leave orphan files rather than deleting another owner's files. Supplied media is never the cleanup target. The ownership check and filesystem deletion are not an atomic operation against hostile concurrent writers.

If a terminal write fails after this instance has stopped its own claim, its recovery pass can mark that claim interrupted. A live same-process worker is not treated as abandoned. The server also checks for recoverable dead workers at startup and periodically (normally every five seconds), as does explicit `media recover`. A recoverable dead owner becomes **interrupted**, never succeeded; retry is always explicit. Idle checks avoid rewriting metadata and, when no claim is recoverable, do not acquire a SQLite write transaction.

Cross-process PID recovery is deliberately limited. Linux [PID namespaces](https://lwn.net/Articles/531419/) can make PIDs invisible or give them different meanings, and Node's [signal-zero probe](https://nodejs.org/api/process.html#processkillpid-signal) checks existence only in its applicable process view. Newly claimed jobs record the Linux boot ID and PID namespace in addition to host, PID and a UUID owner token. A different process recovers a claim only when those domains match and a signal-zero probe reports the PID absent; it rechecks under the SQLite write transaction. A live or reused PID, permission error, foreign host, mismatched namespace/boot, missing or invalid identity, or unavailable `/proc` data does not qualify. Non-Linux platforms and older running claims lacking the new domain metadata therefore cannot use this cross-process automatic recovery; they may block the queue even after an actual crash. `media recover` has the same conservative rules, not an override. Stop all writers, preserve the originals and any previously verified independent backups, and investigate such claims with an operator; the operator-attestation procedure below is the only supported resolution for claims process evidence cannot settle. A different PID namespace can make another worker invisible, so never assume an `ESRCH` probe alone proves that a foreign worker is dead. This assumes trusted local kernel/proc metadata and a correctly configured local SQLite filesystem, not a hostile host or distributed lease service.

### Operator attestation for incomparable claims (`studio media adjudicate`)

Some claims can never be judged by process evidence: legacy claims with no identity fields, claims from another boot or PID namespace, foreign hosts, and probes whose liveness error is ambiguous. These jobs stay `running` and are invisible to `studio media recover` **by design**. The only supported resolution is an explicit, operator-driven adjudication on the CLI:

```bash
studio media adjudicate <job-id> --confirm-stopped --attest-isolated --note "Observed host h014: process 302111 is gone; host otherwise idle since 14:02; workstation quarantined on isolated VLAN."
```

The command refuses unless **both** attestations are present: `--confirm-stopped` (you have positively observed that no render process for this claim is running), `--attest-isolated` (the machine named in the claim is isolated from further uncontrolled renders), and `--note` (1–2000 characters describing what you checked, where, and when).

Behavior and strict limits:

- It refuses any job that is not `running` (`RENDER_ADJUDICATION_NOT_APPLICABLE`), and it refuses when process evidence exists: a live owner (`RENDER_ADJUDICATION_WORKER_LIVE`) or a provably dead comparable owner (`RENDER_ADJUDICATION_USE_RECOVERY` — use `studio media recover` in that case).
- On success it records the **complete prior claim** (pid, host, token, boot/namespace) as immutable history with the timestamp, attestation flags and note, then moves the job to `interrupted` with the error `Worker claim adjudicated by operator attestation; no artifact verification was performed by this resolution.` This unblocks `studio media retry`, which enqueues a fresh attempt.
- It never starts work, never deletes artifacts or checkpoints, never certifies a manifest, and never authenticates the underlying claim (a PID can be reused; hashes do not authenticate). Attestation is a human evidence step — write down what you verified.
- The history surfaces to the browser API as `claimAdjudications: [{ adjudicatedAt, note }]`; raw claim identifiers are projected out of HTTP responses. There is deliberately **no HTTP route** for adjudication: it is a privileged CLI-only action requiring direct operator access to the machine.

The regression suite proves that foreign and legacy claims remain blocked without attestation and that a real adjudication round-trip can unblock a job. It does **not** substitute for operator judgment in a live incident.

Explicit retry uses a new attempt directory but retains same-job video checkpoints. Before reuse, every current source PNG is fully decoded again; frame-range/input hashes and the encoder-profile hash must match. Cached segments must also pass size/hash checks, measured codec/dimensions/rate/frame-count/duration checks and full decoding. Changed, missing or damaged segments are re-encoded. The profile includes FFmpeg version output and encoding settings. Continuous audio normalization, final muxing and final QC rerun on every attempt. This is **validated segment-level resume**, not per-frame generation resume. A crash can leave orphan scratch files or an orphan FFmpeg child; automatic orphan cleanup is not yet implemented. Checkpoints under `projects/<project>/local_checkpoints/<job>/` (including superseded variants) remain on disk until explicitly purged. There is no automatic retention policy.

Render IDs must be unique across the entire root. Duplicate or invalid stored identities fail closed for reads, queue operations and recovery instead of selecting the first record. There is no automatic repair or deletion of ambiguous records; preserve the data and investigate with an operator.

### Explicit checkpoint cleanup

For a terminal job, choose **Delete cached segments** in the render panel (with confirmation), use `media purge-checkpoints`, or call the endpoint above. Queued/running jobs and other projects' jobs are rejected. This is a narrow video-cache purge: it never deletes supplied images/audio, exported masters, job records or idempotency history. A later retry re-encodes purged segments. Progress counters remain a historical report of the last attempt, not a current disk-usage estimate.

The service atomically renames the job cache to a unique retired directory under the same SQLite write lock as retry/claim. Asynchronous deletion touches only that retired UUID path. A retry may proceed while old data is deleted, without exposing its newly created cache to that cleanup. Retired tokens are persisted; a failed deletion can be retried by explicitly purging again once the job is terminal. Missing retired directories are safe to reconcile. All paths are server-derived and symlink-checked.

There is no cross-filesystem/SQLite transaction: a hard crash between the rename and metadata commit can leave an untracked retired directory. This loses reusable cache, not source/export data or QC correctness; missing segments re-encode. Automatic orphan discovery and deletion, child-process cleanup, full storage accounting and retention limits remain open. Do not manually delete files while workers or retries may be using them.


## Verification

The tests include real 1-second and 5-second H.264/AAC renders, measured final loudness, exact decoded frame counts, ranged playback, missing/corrupt/1×1 images, missing/silent audio, timeout, subprocess failure/cancellation, queue bounds, idempotency and dead-worker recovery. Synthetic fixtures exist only in isolated temporary test roots. No production visuals/audio are fabricated by the worker.


### Full-duration and resume validation (2026-10-29)

The opt-in full-duration integration test was executed successfully: **900 seconds, 21,600 decoded frames, 180 segments**, H.264/AAC, 1920×1080/24fps, 48 kHz stereo, −14.05 LUFS, −13.2 dBTP and zero measured A/V start/duration difference. It took approximately eight minutes with synthetic still-frame/sine-audio fixtures; this is not a performance benchmark for complex production media or editorial certification. The test cleans its temporary root.

```bash
STUDIO_LONG_MEDIA_TEST=1 npx tsx --test --test-name-pattern='fifteen-minute' server/localMedia.test.ts
```

Normal regressions also cover cache reuse, corrupt-cache re-encoding, changed-source invalidation with unaffected-segment reuse, and actual abrupt worker death after a segment commit. The full-duration test is skipped in the default suite to keep routine runs bounded.


## Export playback integrity (Batch 15)

HTTP playback now verifies an opened export against the saved QC SHA-256 and serves ranges from that descriptor. Changed bytes are blocked, with a bounded per-version stat/hash cache so every range need not rehash the whole movie. Historical QC is not silently rewritten on GET. This remains an operator-controlled, quiescent-filesystem boundary, not protection against privileged in-place mutation during streaming. See [verified playback](verified-playback.md) for range behavior, cache/concurrency/size limits, tests and residual risks.
