import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { safePath } from './paths.ts';

/** Full-decode a bounded single PNG, using the same bytes for evidence and snapshots. */
export async function validateFrameFile(root: string, file: string) {
  const resolved = safePath(root, file);
  const limit = 12_000_000;
  const handle = await fs.open(safePath(root, resolved), 'r');
  let buffer: Buffer;
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > limit) throw new Error('Invalid or oversized frame asset');
    const chunks: Buffer[] = []; let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, limit + 1 - total));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit) throw new Error('Frame grew beyond the size limit');
      chunks.push(chunk.subarray(0, bytesRead));
    }
    buffer = Buffer.concat(chunks, total);
  } finally { await handle.close(); }
  const image = sharp(buffer, { failOn: 'warning', limitInputPixels: 1920 * 1080 });
  const metadata = await image.metadata();
  if (metadata.format !== 'png' || metadata.width !== 1920 || metadata.height !== 1080 || (metadata.pages ?? 1) !== 1) throw new Error('Frame must be a single 1920x1080 PNG, not a placeholder');
  await image.raw().toBuffer();
  return { buffer, sha256: createHash('sha256').update(buffer).digest('hex'), width: metadata.width, height: metadata.height, bytes: buffer.length };
}
