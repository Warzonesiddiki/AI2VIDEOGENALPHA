import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { LocalMediaService, type LocalRenderRequest } from './localMedia.ts';
import { createMediaWorkerTick } from './lib/mediaWorkerPolling.ts';

const firstProject = 'project_first', secondProject = 'project_second';
const request = (projectId: string, key: string): LocalRenderRequest => ({ projectId, episodeId: 'S01E001', fps: 24, frameCount: 24, audioFile: 'fixture.wav', idempotencyKey: key });
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-media-test-'));
  const store = new StorageEngine(root); await store.init();
  const service = new LocalMediaService(root);
  t.after(async () => { service.close(); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, service, jobsFile: path.join(root, 'local_render_jobs.json') };
}

test('duplicate render IDs across projects cannot cancel or otherwise target another project', async t => {
  const { service, store, jobsFile } = await fixture(t);
  const first = service.enqueue(request(firstProject, 'first'));
  const second = service.enqueue(request(secondProject, 'second'));
  const rows = await store.readJson<any[]>(jobsFile, []); rows[1].id = first.id;
  await store.atomicWriteJson(jobsFile, rows);
  assert.throws(() => service.cancel(secondProject, first.id), /ambiguous|duplicate/i);
  assert.throws(() => service.retry(secondProject, first.id), /ambiguous|duplicate/i);
  assert.throws(() => service.get(secondProject, first.id), /ambiguous|duplicate/i);
  assert.throws(() => service.list(firstProject), /ambiguous|duplicate/i);
  assert.throws(() => service.enqueue(request(firstProject, 'another')), /ambiguous|duplicate/i);
  assert.throws(() => service.recoverInterrupted(), /ambiguous|duplicate/i);
  await assert.rejects(service.runNext(), /ambiguous|duplicate/i);
  await assert.rejects(service.purgeCheckpoints(secondProject, first.id), /ambiguous|duplicate/i);
  assert.deepEqual(await store.readJson(jobsFile, []), rows);
  assert.notEqual(first.id, second.id); // only the isolated stored fixture was deliberately corrupted
});

test('render mutation rechecks project scope atomically even if ownership changes after lookup', async t => {
  const { root, service, store, jobsFile } = await fixture(t);
  const job = service.enqueue(request(firstProject, 'scope_race'));
  const competingStore = new DocumentStore(root);
  const original = service.get.bind(service); let changed = false;
  const mock = t.mock.method(service, 'get', (projectId: string, id: string) => {
    const found = original(projectId, id);
    if (!changed) {
      changed = true;
      // Simulate a competing writer committing after the scoped read, before mutation.
      competingStore.write(jobsFile, [{ ...job, projectId: secondProject }]);
    }
    return found;
  });
  try { assert.throws(() => service.cancel(firstProject, job.id), /not found|scope/i); }
  finally { mock.mock.restore(); competingStore.close(); }
  const rows = await store.readJson<any[]>(jobsFile, []);
  assert.equal(rows[0].projectId, secondProject); assert.equal(rows[0].state, 'queued'); assert.equal(rows[0].cancelRequested, false);
});

test('a polling server recovers a worker that dies after server startup without certifying success', async t => {
  const { root, service } = await fixture(t); let now = 0;
  const tick = createMediaWorkerTick(service, { now: () => now, recoveryIntervalMs: 1000, onError: error => { throw error; } });
  const job = service.enqueue(request('proj_ternfall_01', 'dead_after_start'));
  await assert.rejects(promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/media-crash-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_MEDIA_CRASH_ROOT: root },
  }), (error: any) => error.code === 19);
  const claimed = service.get('proj_ternfall_01', job.id);
  assert.equal(claimed?.state, 'running');
  if (!claimed?.ownerDomain) {
    assert.equal(service.recoverInterrupted(), 0);
    t.skip('Cross-process recovery requires a comparable Linux boot and PID namespace'); return;
  }
  now = 1000; await tick();
  assert.equal(service.get('proj_ternfall_01', job.id)?.state, 'interrupted');
  assert.throws(() => service.mediaPath('proj_ternfall_01', job.id));
  assert.equal(service.get('proj_ternfall_01', job.id)?.attempt, 1); // no implicit retry
});

test('periodic recovery never steals a live claim and overlapping ticks are coalesced', async t => {
  const { service } = await fixture(t); let begin!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  t.mock.method(service as any, 'render', async () => { begin(); await release; throw new Error('fixture complete'); });
  const job = service.enqueue(request(firstProject, 'active_claim'));
  const working = service.runNext(); await started;
  let now = 0; const tick = createMediaWorkerTick(service, { now: () => now, recoveryIntervalMs: 1000, onError: error => { throw error; } });
  now = 1000; await tick();
  assert.equal(service.get(firstProject, job.id)?.state, 'running');
  finish(); assert.equal((await working)?.state, 'failed');

  let calls = 0, resume!: () => void;
  const waiting = new Promise<void>(resolve => { resume = resolve; });
  const fake = { recoverInterrupted: () => 0, runNext: async () => { calls++; await waiting; return null; } };
  const guarded = createMediaWorkerTick(fake, { now: () => now, recoveryIntervalMs: 1000, onError: error => { throw error; } });
  const first = guarded(); await guarded(); assert.equal(calls, 1); resume(); await first;
});

test('an idle recovery probe does not rewrite render metadata', async t => {
  const { service } = await fixture(t); const original = DocumentStore.prototype.write; let writes = 0;
  const mock = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, ...args: Parameters<DocumentStore['write']>) {
    writes++; return original.apply(this, args);
  });
  try { assert.equal(service.recoverInterrupted(), 0); assert.equal(service.recoverInterrupted(), 0); assert.equal(writes, 0); }
  finally { mock.mock.restore(); }
});

test('unknown, foreign or incomparable process domains are never inferred dead from a PID alone', async t => {
  const { service, store, jobsFile } = await fixture(t);
  const job = service.enqueue(request(firstProject, 'unknown_owner'));
  const kill = t.mock.method(process, 'kill', (() => { throw Object.assign(new Error('no such process in this namespace'), { code: 'ESRCH' }); }) as typeof process.kill);
  for (const patch of [
    { ownerHost: os.hostname(), ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000001' },
    { ownerHost: os.hostname(), ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000002', ownerDomain: { bootId: 'different-boot', pidNamespace: 'pid:[123]' } },
    { ownerHost: 'foreign-host', ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000003', ownerDomain: { bootId: 'different-boot', pidNamespace: 'pid:[123]' } },
  ]) {
    const rows = [{ ...job, ...patch, state: 'running', stage: 'validating_inputs', attempt: 1 }];
    await store.atomicWriteJson(jobsFile, rows);
    assert.equal(service.recoverInterrupted(), 0);
    assert.deepEqual(await store.readJson(jobsFile, []), rows);
  }
  assert.equal(kill.mock.callCount(), 0); // A PID from an incomparable domain has no local meaning.
});

test('idle recovery checks do not acquire a write transaction when no claim can be recovered', async t => {
  const { service } = await fixture(t);
  // Initialize the service's database before observing transactional activity.
  service.list(firstProject);
  const original = DocumentStore.prototype.transaction; let transactions = 0;
  const mock = t.mock.method(DocumentStore.prototype, 'transaction', function (this: DocumentStore, operation: () => unknown) {
    transactions++; return original.call(this, operation);
  });
  try {
    assert.equal(service.recoverInterrupted(), 0);
    assert.equal(transactions, 0);
  } finally { mock.mock.restore(); }
  service.enqueue(request(firstProject, 'queued_no_recovery'));
  const queuedMock = t.mock.method(DocumentStore.prototype, 'transaction', function (this: DocumentStore, operation: () => unknown) {
    transactions++; return original.call(this, operation);
  });
  try { assert.equal(service.recoverInterrupted(), 0); assert.equal(transactions, 0); }
  finally { queuedMock.mock.restore(); }
});

test('live/reused PIDs, permission errors and unknown domains do not surrender a running claim', async t => {
  const { service, store, jobsFile } = await fixture(t);
  let begin!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  t.mock.method(service as any, 'render', async () => { begin(); await release; throw new Error('fixture complete'); });
  const job = service.enqueue(request(firstProject, 'reused_pid'));
  const working = service.runNext(); await started;
  const claim = service.get(firstProject, job.id)!;
  finish(); await working;
  if (!claim.ownerDomain) { t.skip('Cross-process recovery requires a comparable Linux boot and PID namespace'); return; }
  let probes = 0;
  const kill = t.mock.method(process, 'kill', ((pid: number, signal: number) => {
    assert.equal(signal, 0); probes++;
    if (pid === 555555) throw Object.assign(new Error('not permitted'), { code: 'EPERM' });
    return true; // A reused or still-live PID is indistinguishable and must not be stolen.
  }) as typeof process.kill);
  const cases = [
    { ownerPid: 444444, ownerDomain: claim.ownerDomain },
    { ownerPid: 555555, ownerDomain: claim.ownerDomain },
    { ownerPid: -1, ownerDomain: claim.ownerDomain },
    { ownerPid: 444444, ownerDomain: claim.ownerDomain, ownerToken: 'invalid-legacy-token' },
    { ownerPid: 444444, ownerDomain: { ...claim.ownerDomain, pidNamespace: 'pid:[0]' } },
    { ownerPid: 444444, ownerDomain: { ...claim.ownerDomain, bootId: '00000000-0000-0000-0000-000000000000' } },
  ];
  try {
    for (const patch of cases) {
      const rows = [{ ...claim, ...patch }]; await store.atomicWriteJson(jobsFile, rows);
      assert.equal(service.recoverInterrupted(), 0);
      assert.deepEqual(await store.readJson(jobsFile, []), rows);
    }
    assert.equal(probes, 2);
  } finally { kill.mock.restore(); }
});

test('recovery rechecks owner liveness while holding the write transaction', async t => {
  const { service, store, jobsFile } = await fixture(t);
  let begin!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  t.mock.method(service as any, 'render', async () => { begin(); await release; throw new Error('fixture complete'); });
  const job = service.enqueue(request(firstProject, 'liveness_race'));
  const working = service.runNext(); await started; const claim = service.get(firstProject, job.id)!;
  finish(); await working;
  if (!claim.ownerDomain) { t.skip('Cross-process recovery requires a comparable Linux boot and PID namespace'); return; }
  const rows = [{ ...claim, ownerPid: 1234567 }]; await store.atomicWriteJson(jobsFile, rows);
  let probes = 0;
  const kill = t.mock.method(process, 'kill', (() => {
    if (++probes === 1) throw Object.assign(new Error('temporarily missing'), { code: 'ESRCH' });
    return true; // Liveness changed before the transactional recheck.
  }) as typeof process.kill);
  try { assert.equal(service.recoverInterrupted(), 0); assert.equal(probes, 2); }
  finally { kill.mock.restore(); }
  assert.deepEqual(await store.readJson(jobsFile, []), rows);
});

test('a failed recovery write rolls back and remains recoverable on a later attempt', async t => {
  const { root, service } = await fixture(t);
  const job = service.enqueue(request('proj_ternfall_01', 'recovery_write_failure'));
  await assert.rejects(promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/media-crash-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_MEDIA_CRASH_ROOT: root },
  }), (error: any) => error.code === 19);
  const claimed = service.get('proj_ternfall_01', job.id)!;
  if (!claimed.ownerDomain) { t.skip('Cross-process recovery requires a comparable Linux boot and PID namespace'); return; }
  const original = DocumentStore.prototype.write;
  const mock = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, file: string, value: unknown) {
    if (file.endsWith('local_render_jobs.json')) throw Object.assign(new Error('fixture recovery ENOSPC'), { code: 'ENOSPC' });
    return original.call(this, file, value);
  });
  try { assert.throws(() => service.recoverInterrupted(), /fixture recovery ENOSPC/); }
  finally { mock.mock.restore(); }
  assert.equal(service.get('proj_ternfall_01', job.id)?.state, 'running');
  assert.equal(service.recoverInterrupted(), 1);
  assert.equal(service.get('proj_ternfall_01', job.id)?.state, 'interrupted');
});

test('competing processes recover the same dead claim exactly once', async t => {
  const { root, service } = await fixture(t);
  const job = service.enqueue(request('proj_ternfall_01', 'concurrent_recovery'));
  await assert.rejects(promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/media-crash-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_MEDIA_CRASH_ROOT: root },
  }), (error: any) => error.code === 19);
  const claimed = service.get('proj_ternfall_01', job.id)!;
  if (!claimed.ownerDomain) { t.skip('Cross-process recovery requires a comparable Linux boot and PID namespace'); return; }
  const outputs = await Promise.all(Array.from({ length: 3 }, () => promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/media-recover-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_MEDIA_RECOVERY_ROOT: root },
  })));
  const counts = outputs.map(({ stdout }) => JSON.parse(stdout.trim()).recovered);
  assert.deepEqual(counts.sort(), [0, 0, 1]);
  assert.equal(service.get('proj_ternfall_01', job.id)?.state, 'interrupted');
  assert.equal(service.get('proj_ternfall_01', job.id)?.attempt, 1);
});

test('polling reports errors, retries recovery and releases its in-process guard', async () => {
  let now = 0, runs = 0, recoveries = 0;
  const errors: string[] = [];
  const fake = {
    runNext: async () => { if (++runs === 1) throw new Error('run failed'); return null; },
    recoverInterrupted: () => { if (++recoveries === 1) throw new Error('recovery failed'); return 0; },
  };
  const tick = createMediaWorkerTick(fake, {
    now: () => now, recoveryIntervalMs: 1000,
    onError: error => errors.push((error as Error).message),
    onRecoveryError: error => errors.push((error as Error).message),
  });
  await tick(); assert.deepEqual(errors, ['run failed', 'recovery failed']);
  await tick(); assert.equal(runs, 2); assert.equal(recoveries, 1);
  now = 1000; await tick(); assert.equal(recoveries, 2); assert.equal(runs, 3);
});

test('a stale worker failure does not rewrite the replacement owner or its timestamp', async t => {
  const { root, service, store, jobsFile } = await fixture(t);
  let begin!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  t.mock.method(service as any, 'render', async () => { begin(); await release; throw new Error('stale worker stopped'); });
  const job = service.enqueue(request(firstProject, 'owner_replaced'));
  const work = service.runNext(); await started;
  const current = service.get(firstProject, job.id)!;
  const replacement = { ...current, ownerToken: '00000000-0000-4000-8000-000000000001', updatedAt: '2001-01-01T00:00:00.000Z' };
  await store.atomicWriteJson(jobsFile, [replacement]);
  const workFile = path.join(root, 'projects', firstProject, 'local_work', job.id, 'attempt_1', 'sentinel');
  const exportFile = path.join(root, 'projects', firstProject, 'exports/local', job.id, 'attempt_1', 'sentinel');
  await fs.mkdir(path.dirname(exportFile), { recursive: true });
  await fs.writeFile(workFile, 'replacement work'); await fs.writeFile(exportFile, 'replacement export');
  const original = DocumentStore.prototype.write; let writes = 0;
  const mock = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, ...args: Parameters<DocumentStore['write']>) { writes++; return original.apply(this, args); });
  try { finish(); await work; assert.equal(writes, 0); }
  finally { mock.mock.restore(); }
  assert.deepEqual(await store.readJson(jobsFile, []), [replacement]);
  assert.equal(await fs.readFile(workFile, 'utf8'), 'replacement work');
  assert.equal(await fs.readFile(exportFile, 'utf8'), 'replacement export');
});
