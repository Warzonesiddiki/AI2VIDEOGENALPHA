import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { createHash } from 'node:crypto';
import { safePath } from './paths.ts';

/** Stream large media instead of loading full-episode WAV/MP4 files into memory. */
export async function hashMediaFile(root: string, file: string, signal?: AbortSignal): Promise<string> {
  const digest = createHash('sha256');
  for await (const chunk of fs.createReadStream(safePath(root, file), { signal })) digest.update(chunk);
  return digest.digest('hex');
}
export async function snapshotMediaFile(root: string, source: string, destination: string, maxBytes: number, signal: AbortSignal) {
  const stat = await fs.promises.stat(safePath(root, source));
  if (!stat.isFile() || stat.size < 1 || stat.size > maxBytes) throw new Error('Invalid or oversized source audio');
  const digest = createHash('sha256'); let bytes = 0;
  const meter = new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length;
    if (bytes > maxBytes) { callback(new Error('Source audio grew beyond the size limit')); return; }
    digest.update(chunk); callback(null, chunk);
  } });
  await pipeline(fs.createReadStream(safePath(root, source)), meter, fs.createWriteStream(safePath(root, destination), { flags: 'wx', mode: 0o600 }), { signal });
  return { sha256: digest.digest('hex'), bytes };
}
