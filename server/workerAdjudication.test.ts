import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StorageEngine } from './storage.ts';
import { LocalMediaService, type LocalRenderRequest } from './localMedia.ts';
import { publicRenderJob } from './lib/publicMedia.ts';

const project = 'proj_ternfall_01';
const request = (key: string): LocalRenderRequest => ({ projectId: project, episodeId: 'S01E001', fps: 24, frameCount: 24, audioFile: 'fixture.wav', idempotencyKey: key });

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-worker-adjudication-'));
  const store = new StorageEngine(root); await store.init();
  const service = new LocalMediaService(root);
  t.after(async () => { service.close(); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, service, jobsFile: path.join(root, 'local_render_jobs.json') };
}

/** Capture a genuine claim written by this process, then overwrite the stored row. */
async function claimedFixture(t: any, patch: Record<string, unknown>) {
  const { root, store, service, jobsFile } = await fixture(t);
  let begin!: () => void, finish!: () => void;
  const started = new Promise<void>(resolve => { begin = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  t.mock.method(service as any, 'render', async () => { begin(); await release; throw new Error('fixture complete'); });
  const job = service.enqueue(request('adjudication_claim'));
  const working = service.runNext(); await started;
  const claim = service.get(project, job.id)!;
  finish(); await working;
  const rows = [{ ...claim, ...patch }];
  await store.atomicWriteJson(jobsFile, rows);
  return { root, store, service, jobsFile, job, claim, rows };
}

const attest = (note = 'Operator inspected this host and job directory; the recorded worker no longer runs.') =>
  ({ confirmStopped: true, attestIsolated: true, note });

test('incomparable claims stay blocked until an operator issues both attestations', async t => {
  const { service, store, jobsFile, job, rows } = await claimedFixture(t, {
    ownerHost: os.hostname(), ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000001', ownerDomain: undefined,
    state: 'running', stage: 'validating_inputs', attempt: 1,
  });
  assert.equal(service.recoverInterrupted(), 0);
  assert.throws(() => service.retry(project, job.id), /retried|retryable/i);
  const before = await store.readJson(jobsFile, []);
  for (const partial of [
    { confirmStopped: true, note: 'x' },
    { attestIsolated: true, note: 'x' },
    { confirmStopped: true, attestIsolated: true, note: '' },
    { confirmStopped: true, attestIsolated: true, note: 'x'.repeat(2001) },
    { confirmStopped: true, attestIsolated: true },
  ]) {
    assert.throws(() => (service as any).adjudicateClaim(project, job.id, partial), /attestation|note/i);
    assert.deepEqual(await store.readJson(jobsFile, []), before);
  }
  const resolved = (service as any).adjudicateClaim(project, job.id, attest());
  assert.equal(resolved.state, 'interrupted');
  assert.match(resolved.error, /adjudicated by operator attestation/i);
  assert.equal(resolved.claimAdjudications.length, 1);
  assert.deepEqual(resolved.claimAdjudications[0].claim, {
    ownerHost: os.hostname(), ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000001', ownerDomain: undefined,
  });
  assert.equal(resolved.claimAdjudications[0].confirmStopped, true);
  assert.equal(resolved.claimAdjudications[0].attestIsolated, true);
  assert.deepEqual(rows[0].checkpoints ?? [], resolved.checkpoints ?? []);
  assert.equal(service.retry(project, job.id).state, 'queued');
  assert.throws(() => (service as any).adjudicateClaim(project, job.id, attest()), /running|applicable/i);
});

test('foreign or malformed claims are adjudicated without ever interpreting their PIDs', async t => {
  const { service, job } = await claimedFixture(t, {
    ownerHost: 'foreign-host', ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000003',
    ownerDomain: { bootId: 'different-boot', pidNamespace: 'pid:[123]' }, state: 'running', attempt: 1,
  });
  const kill = t.mock.method(process, 'kill', (() => { throw Object.assign(new Error('must not be probed'), { code: 'ESRCH' }); }) as typeof process.kill);
  try {
    const resolved = (service as any).adjudicateClaim(project, job.id, attest('Foreign claim inspected offline.'));
    assert.equal(resolved.state, 'interrupted');
    assert.equal(kill.mock.callCount(), 0);
  } finally { kill.mock.restore(); }
});

test('a claim that is provably alive in this process domain cannot be adjudicated', async t => {
  const { service, store, jobsFile, job, claim } = await claimedFixture(t, {});
  if (!claim.ownerDomain) { t.skip('Comparable liveness requires a Linux boot and PID namespace'); return; }
  await store.atomicWriteJson(jobsFile, [{ ...claim, ownerPid: 444444, state: 'running', attempt: 1 }]);
  const kill = t.mock.method(process, 'kill', (() => true) as typeof process.kill);
  try {
    assert.throws(() => (service as any).adjudicateClaim(project, job.id, attest()), /appears to still run|stop it/i);
    assert.deepEqual((await store.readJson<any[]>(jobsFile, []))[0].state, 'running');
    assert.equal(kill.mock.callCount(), 1);
  } finally { kill.mock.restore(); }
});

test('a comparable dead claim must use evidence-based recovery instead of attestation', async t => {
  const { service, store, jobsFile, job, claim } = await claimedFixture(t, {});
  if (!claim.ownerDomain) { t.skip('Comparable liveness requires a Linux boot and PID namespace'); return; }
  await store.atomicWriteJson(jobsFile, [{ ...claim, ownerPid: 444444, state: 'running', attempt: 1 }]);
  const kill = t.mock.method(process, 'kill', (() => { throw Object.assign(new Error('gone'), { code: 'ESRCH' }); }) as typeof process.kill);
  try {
    assert.throws(() => (service as any).adjudicateClaim(project, job.id, attest()), /recovery instead|recover/i);
  } finally { kill.mock.restore(); }
  assert.equal(service.recoverInterrupted(), 1);
  assert.equal(service.get(project, job.id)?.state, 'interrupted');
});

test('adjudication history is preserved and projected without process identity', async t => {
  const { service, job } = await claimedFixture(t, {
    ownerHost: os.hostname(), ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000002', ownerDomain: undefined,
    state: 'running', attempt: 1,
  });
  (service as any).adjudicateClaim(project, job.id, attest('First offline inspection.'));
  const resolved = service.get(project, job.id)!;
  const view: any = publicRenderJob(resolved);
  assert.deepEqual(Object.keys(view.claimAdjudications[0]).sort(), ['adjudicatedAt', 'note']);
  assert.equal(view.claimAdjudications[0].note, 'First offline inspection.');
  const text = JSON.stringify(view);
  assert.ok(!text.includes('ownerToken')); assert.ok(!text.includes('00000000-0000-4000-8000'));
  assert.ok(!text.includes('ownerPid')); assert.ok(!text.includes('foreign-host'));
  assert.equal((resolved as any).ownerToken, '00000000-0000-4000-8000-000000000002'); // raw record keeps evidence
});

test('the media CLI adjudicates only with explicit attestations', async t => {
  const { root, rows, job } = await claimedFixture(t, {
    ownerHost: os.hostname(), ownerPid: 2147483647, ownerToken: '00000000-0000-4000-8000-000000000004', ownerDomain: undefined,
    state: 'running', attempt: 1,
  });
  // The CLI resolves data/production_root relative to its working directory and
  // imports the legacy JSON file on first read (no store entry exists there).
  const cliRoot = path.join(root, 'data', 'production_root'); await fs.mkdir(cliRoot, { recursive: true });
  await fs.writeFile(path.join(cliRoot, 'local_render_jobs.json'), JSON.stringify(rows, null, 2));
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  const run = (...args: string[]) => promisify(execFile)(process.execPath, ['--import', loader, cli, ...args, '--json'], { cwd: root, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } });
  await assert.rejects(run('media', 'adjudicate', job.id, '--confirm-stopped', '--note', 'checked'), /attestation/i);
  const done = JSON.parse((await run('media', 'adjudicate', job.id, '--confirm-stopped', '--attest-isolated', '--note', 'CLI offline inspection')).stdout).data;
  assert.equal(done.state, 'interrupted');
  assert.equal(done.claimAdjudications[0].note, 'CLI offline inspection');
});
