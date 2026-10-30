import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { validateFrameFile } from './lib/frameValidation.ts';

test('bounded frame reads decode/hash identical bytes and reject oversized assets', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-frame-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'frame.png');
  const png = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: 'teal' } }).png().toBuffer();
  await fs.writeFile(file, png);
  const result = await validateFrameFile(root, file);
  assert.deepEqual(result.buffer, png); assert.equal(result.sha256, createHash('sha256').update(png).digest('hex'));
  await fs.truncate(file, 12_000_001); await assert.rejects(validateFrameFile(root, file), /oversized/);
});

test('frame growth after fstat stops at the byte ceiling and closes the handle', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-frame-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'growing.png'); await fs.writeFile(file, 'small');
  const originalOpen = fs.open; let readBytes = 0, closed = false;
  const mocked = t.mock.method(fs, 'open', async (...args: any[]) => {
    const handle = await (originalOpen as any)(...args);
    const stat = handle.stat.bind(handle), read = handle.read.bind(handle), close = handle.close.bind(handle);
    handle.stat = async (...values: any[]) => { const result = await stat(...values); await fs.truncate(file, 13_000_000); return result; };
    handle.read = async (...values: any[]) => { const result = await read(...values); readBytes += result.bytesRead; return result; };
    handle.close = async () => { closed = true; await close(); };
    return handle;
  });
  await assert.rejects(validateFrameFile(root, file), /grew beyond/);
  assert.equal(readBytes, 12_000_001); assert.equal(closed, true); mocked.mock.restore();
});
