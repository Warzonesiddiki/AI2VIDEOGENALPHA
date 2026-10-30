---
name: ternfall-local-media
description: Audit supplied-asset local rendering, image/audio validation, FFmpeg isolation and measured output QC.
---

# Ternfall Local Media

1. Verify explicit project/episode scope, allowed filenames, containment, bounded file sizes, image decoding and audio duration before rendering.
2. Follow snapshots, hashes, no-shell child process arguments, protocol restrictions, segment reuse and the final measured media checks. Never substitute synthetic placeholders.
3. Test changed/missing/corrupt inputs, cancellation, partial output, QC failure and playback integrity using isolated fixtures and maintained binary versions where possible.
4. Report codec, frame count, timing, loudness, peak and hash as measured technical evidence only; they do not certify content, rights or publication.
