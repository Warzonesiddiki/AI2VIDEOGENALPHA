# Verified HTTP playback — Batch 15

## Integrity boundary

Successful render QC describes bytes measured at render time. HTTP playback now additionally compares the export's SHA-256 against the saved QC digest before serving a new file version. An altered export returns **409 `MEDIA_INTEGRITY_FAILED`** rather than media bytes. Missing/unreadable files fail closed. No fallback media is substituted.

`LocalMediaService.openVerifiedMedia` checks succeeded/passed state and authorized output path, asks `VerifiedMediaReader` to verify an open descriptor, then rereads job evidence before returning it. The HTTP route serves that descriptor rather than reopening its pathname through `sendFile`. Replacing a pathname after verification cannot switch playback to a different inode.

An in-place mutation while an already-verified stream is being transmitted remains a filesystem race. This is an **operator-controlled-tree integrity boundary**, not an OS sandbox or immutable content-addressed storage. Keep exports quiescent while streaming. A hostile process with filesystem privileges, unusual/coarse filesystem metadata or modifications that preserve all fingerprint fields are outside the guarantee.

## Cache and resource policy

Verification is cached against resolved pathname, device/inode, size, nanosecond modification/change timestamps and expected SHA-256. A changed fingerprint requires hashing again; restoring mtime/size alone does not preserve ctime. Cache capacity is 32 verified versions per reader/process. Concurrent requests for one pending version share its hash; at most two distinct hashes run concurrently. A third new hash returns **503 `MEDIA_VERIFICATION_BUSY`**; retry later. Successful cache lookups still open and stat the descriptor.

Files must be regular, nonempty and at most 2,000,000,000 bytes. This limit covers the supported 900-second constrained-bitrate renderer; external larger exports are not supported through this reader. Hashing is streamed over the initially stated length, with a second descriptor stat to reject mutation during verification. Failed verification is not cached. Open handles close after errors, HEAD, range rejection, successful streams or stream termination.

This is not a complete request-rate/connection/file-descriptor policy; many concurrent requests for already-cached media are still F15/resource follow-up work. Caches are process-local and ephemeral, not durable review evidence.

## HTTP behavior

- Standard full response, HEAD and a single explicit/open/suffix byte range.
- Valid ranges return 206; unsatisfiable, malformed or multipart ranges return 416 with `Content-Range: bytes */<size>`.
- ETag is the saved verified SHA-256. Matching If-Range permits the range; nonmatching or unsupported If-Range returns the full verified representation.
- Responses are private/no-store. The browser player surfaces playback errors; it does not replace failed video with synthetic content.

GET checks do not rewrite historical QC, delete files, authorize publication or start a new render. A rejected file can be inspected and an exact original restored or a new render created with a new idempotency key. Restoring the exact verified bytes can pass a new check; an unverified replacement cannot inherit the old digest. Historical job success should be read as point-in-time execution evidence, not a continuous assertion about mutable storage.

## Verification and limits

Eleven new reader/range regressions test cache reuse and invalidation, restored mtime, truncation, inode replacement, descriptor/path replacement, mutation during hashing, concurrent coalescing/admission, byte/hash/symlink limits, ranges, eviction and retry after read failure. A twelfth new test renders actual media and exercises HTTP ranges/HEAD/If-Range/416, mutation rejection, retained historical QC and exact-byte restoration.

Full validation: **167 passed, 1 opt-in long test skipped, 0 failed**; lint/build/dependency audit/diff checks pass, zero known npm vulnerabilities. The new UI error/abort/save guards were source-reviewed and type/build checked, not browser-automated. No Windows, hostile-filesystem, paid-provider, publication or new long-media run is claimed.
