import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFile } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { LocalMediaService } from './localMedia.ts';

test('the actual server periodically interrupts a worker that dies after startup', { timeout: 60_000 }, async t => {
  const outer = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-media-test-server-'));
  const root = path.join(outer, 'data', 'production_root');
  const reservation = net.createServer();
  await new Promise<void>((resolve, reject) => reservation.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = reservation.address(); assert.ok(address && typeof address !== 'string'); const port = address.port;
  await new Promise<void>((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  const child = spawn(process.execPath, ['--import', path.resolve('node_modules/tsx/dist/loader.mjs'), path.resolve('server.ts')], {
    cwd: outer, env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), STUDIO_OPERATOR_TOKEN: '', GEMINI_API_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = ''; child.stdout.on('data', data => { output += String(data); }); child.stderr.on('data', data => { output += String(data); });
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await Promise.race([exited, delay(5000, undefined, { ref: false })]);
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await exited; }
    await fs.rm(outer, { recursive: true, force: true });
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Fixture server did not start: ${output}`)), 30_000);
    const ready = (data: Buffer) => { if (String(data).includes('Server listening')) { clearTimeout(timeout); resolve(); } };
    child.stdout.on('data', ready);
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Fixture server exited ${code}: ${output}`)); });
  });
  let id = '';
  try {
    await promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/media-crash-worker.ts'], {
      cwd: process.cwd(), env: { ...process.env, TEST_MEDIA_CRASH_ROOT: root, TEST_ATOMIC_ENQUEUE_CLAIM: 'true' },
    });
    assert.fail('Fixture worker should exit after claiming');
  } catch (error: any) { assert.equal(error.code, 19); id = String(error.stdout).trim(); }
  assert.match(id, /^render_[0-9a-f-]+$/);
  const service = new LocalMediaService(root);
  const claimed = service.get('proj_ternfall_01', id); service.close();
  assert.ok(claimed && ['running', 'interrupted'].includes(claimed.state));
  if (!claimed.ownerDomain) { t.skip('Cross-process recovery requires a comparable Linux boot and PID namespace'); return; }
  const url = `http://127.0.0.1:${port}/api/projects/proj_ternfall_01/local-renders/${id}`;
  const deadline = Date.now() + 20_000; let result: any;
  do {
    const response = await fetch(url); assert.equal(response.status, 200);
    result = (await response.json()).data;
    if (result.state === 'interrupted') break;
    await delay(250);
  } while (Date.now() < deadline);
  assert.equal(result.state, 'interrupted', output); assert.equal(result.attempt, 1);
  assert.equal(result.qc, undefined); assert.equal(result.ownerToken, undefined);
  assert.equal((await fetch(`${url}/media`)).status, 422);
});
