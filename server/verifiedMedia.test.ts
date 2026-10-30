import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { VerifiedMediaReader, mediaByteRange } from './lib/verifiedMedia.ts';
const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-integrity-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'master.mp4'); await fs.writeFile(file, 'verified-original-bytes');
  return { root, file, expected: digest('verified-original-bytes') };
}
async function hashHandle(handle: any, size: number) {
  const hash = createHash('sha256');
  for await (const chunk of handle.createReadStream({ start: 0, end: size - 1, autoClose: false })) hash.update(chunk);
  return hash.digest('hex');
}
test('verified playback caches unchanged versions, but same-size edits restoring mtime invalidate cache', async t => {
  const { root, file, expected } = await fixture(t); let hashes = 0;
  const reader = new VerifiedMediaReader(root, async (handle, size) => { hashes++; return hashHandle(handle, size); });
  const stat = await fs.stat(file);
  for (let i = 0; i < 3; i++) { const opened = await reader.open(file, expected); await opened.handle.close(); }
  assert.equal(hashes, 1);
  await fs.writeFile(file, 'tampered-original-byteS'); await fs.utimes(file, stat.atime, stat.mtime);
  await assert.rejects(reader.open(file, expected), /no longer match/); assert.equal(hashes, 2);
});
test('truncated output is blocked rather than associated with historical QC', async t => {
  const { root, file, expected } = await fixture(t); const reader = new VerifiedMediaReader(root);
  await fs.truncate(file, 2); await assert.rejects(reader.open(file, expected), /no longer match/);
});
test('replacing an output with a different inode invalidates previously checked bytes', async t => {
  const { root, file, expected } = await fixture(t); const reader = new VerifiedMediaReader(root);
  await (await reader.open(file, expected)).handle.close();
  await fs.rename(file, `${file}.old`); await fs.writeFile(file, 'tampered-original-byteS');
  await assert.rejects(reader.open(file, expected), /no longer match/);
});
test('streaming the verified descriptor retains original bytes after pathname replacement', async t => {
  const { root, file, expected } = await fixture(t); const reader = new VerifiedMediaReader(root);
  const opened = await reader.open(file, expected);
  try {
    await fs.rename(file, `${file}.old`); await fs.writeFile(file, 'unverified replacement');
    const chunks: Buffer[] = [];
    for await (const chunk of opened.handle.createReadStream({ start: 0, end: opened.size - 1, autoClose: false })) chunks.push(chunk);
    assert.equal(digest(Buffer.concat(chunks)), expected);
  } finally { await opened.handle.close(); }
});
test('mutation during hashing is rejected by the second descriptor stat', async t => {
  const { root, file, expected } = await fixture(t);
  const reader = new VerifiedMediaReader(root, async (handle, size) => { const value = await hashHandle(handle, size); await fs.appendFile(file, 'grew'); return value; });
  await assert.rejects(reader.open(file, expected), /no longer match/);
});
test('concurrent requests share version verification rather than hashing once per range', async t => {
  const { root, file, expected } = await fixture(t); let hashes = 0;
  const reader = new VerifiedMediaReader(root, async (handle, size) => { hashes++; await new Promise(resolve => setTimeout(resolve, 20)); return hashHandle(handle, size); });
  const opened = await Promise.all(Array.from({ length: 8 }, () => reader.open(file, expected)));
  await Promise.all(opened.map(item => item.handle.close())); assert.equal(hashes, 1);
});
test('verification admission permits two distinct hashes and rejects a third until capacity is released', async t => {
  const { root, file, expected } = await fixture(t);
  const files = [file, path.join(root, 'second.mp4'), path.join(root, 'third.mp4')];
  await Promise.all(files.slice(1).map(target => fs.copyFile(file, target)));
  let count = 0, release!: () => void, bothStarted!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { bothStarted = resolve; });
  const reader = new VerifiedMediaReader(root, async (handle, size) => { if (++count === 2) bothStarted(); await gate; return hashHandle(handle, size); });
  const first = reader.open(files[0], expected), second = reader.open(files[1], expected);
  await started;
  await assert.rejects(reader.open(files[2], expected), (error: any) => error.code === 'MEDIA_VERIFICATION_BUSY');
  release(); for (const opened of await Promise.all([first, second])) await opened.handle.close();
  await (await reader.open(files[2], expected)).handle.close();
});
test('invalid hashes, empty/oversized files and symlinks never establish integrity', async t => {
  const { root, file, expected } = await fixture(t); const reader = new VerifiedMediaReader(root);
  await assert.rejects(reader.open(file, 'not-a-hash'), /no longer match/);
  await fs.truncate(file, 0); await assert.rejects(reader.open(file, expected), /no longer match/);
  await fs.truncate(file, 2_000_000_001); await assert.rejects(reader.open(file, expected), /no longer match/);
  const link = path.join(root, 'link.mp4'); await fs.symlink(file, link); await assert.rejects(reader.open(link, expected), /symlink/);
});
test('range parser handles full, suffix and open ranges and rejects ambiguous/unsafe requests', () => {
  assert.equal(mediaByteRange(undefined, 100), null);
  for (const [header, expected] of [['bytes=0-31', { start: 0, end: 31 }], ['bytes=99-', { start: 99, end: 99 }], ['bytes=-8', { start: 92, end: 99 }], ['bytes=0-1000', { start: 0, end: 99 }], ['bytes=-1000', { start: 0, end: 99 }]] as const) assert.deepEqual(mediaByteRange(header, 100), expected);
  for (const value of ['bytes=100-', 'bytes=9-1', 'bytes=-0', 'bytes=-', 'bytes=0-1,4-5', 'items=0-1', 'bytes=9007199254740992-', 'bytes=0-1junk']) assert.throws(() => mediaByteRange(value, 100));
});
test('version cache evicts older entries at its fixed capacity', async t => {
  const { root, file, expected } = await fixture(t); let count = 0;
  const reader = new VerifiedMediaReader(root, async (handle, size) => { count++; return hashHandle(handle, size); });
  for (let index = 0; index < 34; index++) { const target = path.join(root, `${index}.mp4`); await fs.copyFile(file, target); await (await reader.open(target, expected)).handle.close(); }
  await (await reader.open(path.join(root, '0.mp4'), expected)).handle.close(); assert.equal(count, 35);
});
test('failed verification is not cached and a later attempt can verify repaired bytes', async t => {
  const { root, file, expected } = await fixture(t); let fail = true;
  const reader = new VerifiedMediaReader(root, async (handle, size) => { if (fail) { fail = false; throw new Error('fixture read failed'); } return hashHandle(handle, size); });
  await assert.rejects(reader.open(file, expected), /fixture read failed/);
  await (await reader.open(file, expected)).handle.close();
});
