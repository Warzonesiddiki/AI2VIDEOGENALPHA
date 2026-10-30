import fs from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import type { BigIntStats } from 'node:fs';
import { createHash } from 'node:crypto';
import { safePath } from './paths.ts';

const MAX_MEDIA_BYTES = 2_000_000_000;
const fingerprint = (stat: BigIntStats) => [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
export class MediaIntegrityError extends Error {
  readonly code = 'MEDIA_INTEGRITY_FAILED';
  constructor() { super('Export bytes no longer match saved technical QC. Playback is blocked; inspect the output and create a new verified render.'); }
}
async function hashOpenedFile(handle: FileHandle, size: number): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of handle.createReadStream({ start: 0, end: size - 1, autoClose: false })) digest.update(chunk);
  return digest.digest('hex');
}

/** Operator-controlled filesystem integrity check, not an OS sandbox against hostile writers. */
export class VerifiedMediaReader {
  private verified = new Map<string, true>();
  private pending = new Map<string, Promise<string>>();
  constructor(private root: string, private hasher = hashOpenedFile) {}
  async open(file: string, expectedHash: string): Promise<{ handle: FileHandle; size: number; sha256: string }> {
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw new MediaIntegrityError();
    const resolved = safePath(this.root, file);
    const handle = await fs.open(safePath(this.root, resolved), 'r');
    try {
      const before = await handle.stat({ bigint: true });
      if (!before.isFile() || before.size < 1n || before.size > BigInt(MAX_MEDIA_BYTES)) throw new MediaIntegrityError();
      const stamp = fingerprint(before);
      const key = `${resolved}:${stamp}:${expectedHash}`;
      if (!this.verified.has(key)) {
        let pending = this.pending.get(key);
        if (!pending) {
          if (this.pending.size >= 2) throw Object.assign(new Error('Media verification is busy. Retry shortly.'), { code: 'MEDIA_VERIFICATION_BUSY' });
          pending = this.hasher(handle, Number(before.size));
          this.pending.set(key, pending);
          void pending.finally(() => { if (this.pending.get(key) === pending) this.pending.delete(key); }).catch(() => {});
        }
        const actual = await pending;
        if (actual !== expectedHash) throw new MediaIntegrityError();
      }
      if (fingerprint(await handle.stat({ bigint: true })) !== stamp) throw new MediaIntegrityError();
      // Bound cached versions. Include ctime, not only caller-restorable mtime/size.
      this.verified.delete(key); this.verified.set(key, true);
      while (this.verified.size > 32) this.verified.delete(this.verified.keys().next().value!);
      return { handle, size: Number(before.size), sha256: expectedHash };
    } catch (error) { await handle.close(); throw error; }
  }
}

/** One byte range only. Invalid/multipart requests fail rather than ambiguously selecting bytes. */
export function mediaByteRange(header: string | undefined, size: number): { start: number; end: number } | null {
  if (header === undefined) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error('Unsatisfiable byte range');
  const left = match[1] ? Number(match[1]) : undefined;
  const right = match[2] ? Number(match[2]) : undefined;
  if ((left !== undefined && !Number.isSafeInteger(left)) || (right !== undefined && !Number.isSafeInteger(right))) throw new Error('Unsatisfiable byte range');
  if (left === undefined) {
    if (!right || right < 1) throw new Error('Unsatisfiable byte range');
    return { start: Math.max(0, size - right), end: size - 1 };
  }
  if (left >= size || (right !== undefined && right < left)) throw new Error('Unsatisfiable byte range');
  return { start: left, end: Math.min(right ?? size - 1, size - 1) };
}
