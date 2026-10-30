import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { LocalMediaService } from './localMedia.ts';
import { localMediaRouter } from './localMediaRoutes.ts';
import { MediaIntegrityError, MediaVerificationBusyError } from './lib/verifiedMedia.ts';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-media-api-test-'));
  const store = new StorageEngine(root); await store.init();
  const service = new LocalMediaService(root);
  const app = express(); app.use(express.json());
  app.use('/api/projects/:id/local-renders', localMediaRouter(service, store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
    service.close(); store.close(); await fs.rm(root, { recursive: true, force: true });
  });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { root, store, service, base: `http://127.0.0.1:${address.port}/api/projects/proj_ternfall_01/local-renders` };
}
const request = { episodeId: 'S01E001', frameCount: 24, audioFile: 'fixture.wav', idempotencyKey: 'api_test' };

test('render endpoints hide unexpected backend exception messages and forged error codes', async t => {
  const { service, store, base } = await fixture(t);
  const cases = [
    ['list', '/', 'GET'], ['get', '/render_test', 'GET'], ['enqueue', '/', 'POST'],
    ['cancel', '/render_test/cancel', 'POST'], ['retry', '/render_test/retry', 'POST'],
    ['purgeCheckpoints', '/render_test/purge-checkpoints', 'POST'], ['openVerifiedMedia', '/render_test/media', 'GET'],
  ] as const;
  for (const [method, suffix, verb] of cases) {
    const mock = t.mock.method(service as any, method, () => { throw Object.assign(new Error('private-fixture-token /private/fixture/path'), { code: 'MEDIA_INTEGRITY_FAILED' }); });
    try {
      const response = await fetch(base + suffix, { method: verb, ...(verb === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) } : {}) });
      const payload = await response.json();
      assert.equal(response.status, 500, `${verb} ${suffix}`);
      assert.equal(payload.code, 'INTERNAL_ERROR'); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(!JSON.stringify(payload).includes('private-fixture-token')); assert.ok(!JSON.stringify(payload).includes('/private/fixture/path'));
    } finally { mock.mock.restore(); }
  }
  const failingStorage = t.mock.method(store, 'getEpisode', async () => { throw new Error('private-storage-fixture'); });
  try {
    const response = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    assert.equal(response.status, 500); assert.equal((await response.json()).code, 'INTERNAL_ERROR');
  } finally { failingStorage.mock.restore(); }
});

test('render API omits internal ownership, absolute checkpoint paths and persisted raw worker errors', async t => {
  const { root, store, service, base } = await fixture(t);
  const job = service.enqueue({ ...request, projectId: 'proj_ternfall_01', fps: 24 });
  const file = path.join(root, 'local_render_jobs.json');
  await store.atomicWriteJson(file, [{ ...job, state: 'failed', stage: 'failed', error: 'private-worker-error /private/fixture/path',
    ownerToken: 'private-owner-token', ownerPid: 123, ownerHost: 'private-host', ownerDomain: { bootId: 'private-boot', pidNamespace: 'private-namespace' },
    retiredCheckpointTokens: ['private-retirement-token'], privateExtra: 'private-unexpected-field',
    checkpoints: [{ startFrame: 1, frameCount: 24, inputSha256: 'a'.repeat(64), profileSha256: 'b'.repeat(64), artifactSha256: 'c'.repeat(64), path: '/private/fixture/path/segment.mp4', bytes: 42, extra: 'private-checkpoint-extra' }],
    manifest: { audioSha256: 'd'.repeat(64), extra: 'private-manifest-extra', frames: [{ file: 'frame_00001.png', sha256: 'e'.repeat(64), width: 1920, height: 1080, bytes: 10, extra: 'private-frame-extra' }] },
    progress: { totalSegments: 1, completedSegments: 1, encodedSegments: 1, reusedSegments: 0, extra: 'private-progress-extra' },
    qc: { passed: false, frameCount: 24, extra: 'private-qc-extra' },
  }]);
  for (const suffix of ['/', `/${job.id}`]) {
    const response = await fetch(base + suffix); assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const payload = await response.json(), text = JSON.stringify(payload);
    for (const secret of ['private-worker-error', '/private/fixture/path', 'private-owner-token', 'private-host', 'private-boot', 'private-namespace', 'private-retirement-token', 'private-unexpected-field', 'private-checkpoint-extra', 'private-manifest-extra', 'private-frame-extra', 'private-progress-extra', 'private-qc-extra']) assert.ok(!text.includes(secret), secret);
    const visible = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    assert.equal(visible.id, job.id); assert.equal(visible.state, 'failed');
    assert.equal(visible.checkpoints.length, 1); assert.equal(visible.retiredCheckpointCount, 1);
    assert.match(visible.error, /operator|diagnostic/i);
    assert.equal(visible.ownerPid, undefined); assert.equal(visible.checkpoints[0].path, undefined);
  }
  // Mutating endpoints must use the same projection, not leak the service return value.
  const privateJob = service.get('proj_ternfall_01', job.id)!;
  for (const [method, suffix] of [['enqueue', '/'], ['cancel', `/${job.id}/cancel`], ['retry', `/${job.id}/retry`], ['purgeCheckpoints', `/${job.id}/purge-checkpoints`]] as const) {
    const mock = t.mock.method(service as any, method, () => privateJob);
    try {
      const response = await fetch(base + suffix, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
      assert.ok(response.ok, suffix); const text = JSON.stringify(await response.json());
      assert.ok(!text.includes('private-'), suffix); assert.ok(!text.includes('/private/fixture/path'), suffix);
    } finally { mock.mock.restore(); }
  }
  // The explicit local CLI/service still has the detailed operator diagnostics.
  assert.match(privateJob.error!, /private-worker-error/);
});

test('known render validation and integrity failures retain safe, useful status and codes', async t => {
  const { service, base } = await fixture(t);
  const invalid = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...request, audioFile: '../bad.wav' }) });
  assert.equal(invalid.status, 422); assert.match((await invalid.json()).error, /audio|wav|flac/i);
  const missing = await fetch(`${base}/missing`); assert.equal(missing.status, 404); assert.equal(missing.headers.get('cache-control'), 'no-store');
  const mock = t.mock.method(service, 'openVerifiedMedia', async () => { const error = new MediaIntegrityError(); error.message = 'private integrity fixture'; throw error; });
  try {
    const response = await fetch(`${base}/render_test/media`); assert.equal(response.status, 409);
    const payload = await response.json(); assert.equal(payload.code, 'MEDIA_INTEGRITY_FAILED');
    assert.match(payload.error, /playback|verified/i); assert.ok(!JSON.stringify(payload).includes('private integrity fixture'));
  } finally { mock.mock.restore(); }
  const busy = t.mock.method(service, 'openVerifiedMedia', async () => { throw new MediaVerificationBusyError(); });
  try {
    const response = await fetch(`${base}/render_test/media`); assert.equal(response.status, 503);
    const payload = await response.json(); assert.equal(payload.code, 'MEDIA_VERIFICATION_BUSY');
    assert.match(payload.error, /busy/i);
  } finally { busy.mock.restore(); }
});
