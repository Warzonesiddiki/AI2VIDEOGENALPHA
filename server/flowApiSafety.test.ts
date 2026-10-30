import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { createGoogleFlowPlan } from '../src/core/flow.ts';
import { StorageEngine } from './storage.ts';
import { flowPlanRouter } from './flowRoutes.ts';
import { RevisionConflict } from './lib/conflicts.ts';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-flow-api-test-'));
  const store = new StorageEngine(root); await store.init();
  const app = express(); app.use(express.json()); app.use('/api/projects/:id/flow', flowPlanRouter(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return { root, store, base: `http://127.0.0.1:${address.port}/api/projects/proj_ternfall_01/flow` };
}
const planRequest = { durationSeconds: 1, fps: 24, mode: 'keyframe_storyboard', expectedRevision: 0 };
const ingestRequest = { episodeId: 'S01E001', batchId: 'GF_S01E001_B0001', expectedRevision: 1 };
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('Flow routes hide unexpected read/write errors and reject forged conflict codes', async t => {
  const { store, base } = await fixture(t);
  const cases = [
    ['getGoogleFlowPlan', '/plan/S01E001', 'GET'], ['getGoogleFlowPlan', '/plan/S01E001/batches', 'GET'],
    ['getGoogleFlowPlan', '/checkpoint/S01E001', 'GET'], ['getEpisode', '/plan/S01E001', 'POST'],
    ['saveGoogleFlowPlan', '/plan/S01E001', 'POST'], ['getGoogleFlowPlan', '/ingest', 'POST'],
  ] as const;
  for (const [method, suffix, verb] of cases) {
    const mock = t.mock.method(store as any, method, async () => { throw Object.assign(new Error('private-flow-token /private/flow/path'), { code: 'REVISION_CONFLICT', currentRevision: 'private-flow-revision' }); });
    try {
      const response = verb === 'POST' ? await post(base + suffix, suffix === '/ingest' ? ingestRequest : planRequest) : await fetch(base + suffix);
      const payload = await response.json();
      assert.equal(response.status, 500, `${verb} ${suffix}`); assert.equal(payload.code, 'INTERNAL_ERROR');
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(!JSON.stringify(payload).includes('private-flow'));
    } finally { mock.mock.restore(); }
  }
});

test('Flow validation, conflict and unavailable frames return fixed actionable responses without paths', async t => {
  const { root, store, base } = await fixture(t);
  for (const patch of [{ durationSeconds: 0 }, { durationSeconds: 1.5 }, { fps: 61 }, { mode: 'invalid' }, { expectedRevision: -1 }]) {
    const response = await post(`${base}/plan/S01E001`, { ...planRequest, ...patch }); assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  const created = await post(`${base}/plan/S01E001`, planRequest); assert.equal(created.status, 200);
  const plan = (await created.json()).data;
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const missing = await post(`${base}/ingest`, body); assert.equal(missing.status, 400);
  const missingPayload = await missing.json(); assert.equal(missingPayload.code, 'FLOW_FRAME_MISSING');
  assert.ok(!JSON.stringify(missingPayload).includes(root));
  const frames = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(frames, { recursive: true });
  await fs.writeFile(path.join(frames, 'frame_00001.png'), 'not an image');
  const corrupt = await post(`${base}/ingest`, body); assert.equal(corrupt.status, 400);
  assert.equal((await corrupt.json()).code, 'FLOW_FRAME_INVALID');
  const conflict = new RevisionConflict(7); conflict.message = 'private-conflict-message';
  const mock = t.mock.method(store, 'saveGoogleFlowPlan', async () => { throw conflict; });
  try {
    const response = await post(`${base}/plan/S01E001`, { ...planRequest, expectedRevision: plan.revision });
    assert.equal(response.status, 409); const result = await response.json();
    assert.equal(result.code, 'REVISION_CONFLICT'); assert.equal(result.currentRevision, 7);
    assert.ok(!JSON.stringify(result).includes('private-conflict-message'));
  } finally { mock.mock.restore(); }
});

test('a failed pre-recheck revocation returns a sanitized error without reading frames', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const frames = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(frames, { recursive: true });
  const frame = path.join(frames, 'frame_00001.png');
  await fs.writeFile(frame, await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const verified = await post(`${base}/ingest`, body); assert.equal(verified.status, 200); const revision = (await verified.json()).data.revision;
  await fs.unlink(frame);
  const mock = t.mock.method(store, 'saveGoogleFlowPlan', async () => { throw new Error('private-revocation-write-failure'); });
  const realOpen = fs.open; let frameReads = 0;
  const open = t.mock.method(fs, 'open', async (...args: any[]) => { if (String(args[0]) === frame) frameReads++; return (realOpen as any)(...args); });
  try {
    const failed = await post(`${base}/ingest`, { ...body, expectedRevision: revision });
    assert.equal(failed.status, 500); const result = await failed.json();
    assert.equal(result.code, 'INTERNAL_ERROR'); assert.ok(!JSON.stringify(result).includes('private-revocation-write-failure'));
    assert.equal(frameReads, 0, 'do not inspect a previously verified frame until revocation is durable');
  } finally { mock.mock.restore(); open.mock.restore(); }
  const unchanged = await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001');
  assert.equal(unchanged?.revision, revision); assert.equal(unchanged?.batches[0].status, 'verified'); // The failed write cannot prove revocation committed.
});

test('frame permission failures are internal errors, not fabricated missing-frame validation', async t => {
  const { store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const original = fs.open;
  const mock = t.mock.method(fs, 'open', async (...args: any[]) => {
    if (String(args[0]).endsWith('frame_00001.png')) throw Object.assign(new Error('private-frame-permission-path'), { code: 'EACCES' });
    return (original as any)(...args);
  });
  try {
    const response = await post(`${base}/ingest`, { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision });
    assert.equal(response.status, 500); const body = await response.json();
    assert.equal(body.code, 'INTERNAL_ERROR'); assert.ok(!JSON.stringify(body).includes('private-frame-permission-path'));
    assert.equal((await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001'))?.revision, plan.revision);
  } finally { mock.mock.restore(); }
});

test('a recheck that cannot commit new evidence leaves the prior batch durably unverified', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const frames = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(frames, { recursive: true });
  await fs.writeFile(path.join(frames, 'frame_00001.png'), await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const verified = await post(`${base}/ingest`, body); assert.equal(verified.status, 200); const revision = (await verified.json()).data.revision;
  const save = store.saveGoogleFlowPlan.bind(store); let writes = 0;
  const mock = t.mock.method(store, 'saveGoogleFlowPlan', async (projectId: string, next: Parameters<StorageEngine['saveGoogleFlowPlan']>[1]) => {
    if (++writes === 2) throw new Error('private-final-evidence-write-failure');
    await save(projectId, next);
  });
  try {
    const failed = await post(`${base}/ingest`, { ...body, expectedRevision: revision });
    assert.equal(failed.status, 500); const result = await failed.json();
    assert.equal(result.code, 'INTERNAL_ERROR'); assert.ok(!JSON.stringify(result).includes('private-final-evidence-write-failure'));
    assert.equal(writes, 2);
  } finally { mock.mock.restore(); }
  const stored = await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001');
  assert.equal(stored?.revision, revision + 1); assert.equal(stored?.batches[0].status, 'pending');
  assert.equal(stored?.batches[0].verification, undefined); assert.equal(stored?.summary.verifiedBatches, 0);
  const checkpoint = await fetch(`${base}/checkpoint/S01E001`); assert.equal(checkpoint.status, 200);
  assert.deepEqual((await checkpoint.json()).data.completedBatchIndices, []);
});

test('a process dying during recheck leaves the old evidence durably revoked', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const directory = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'frame_00001.png'), await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const verified = await post(`${base}/ingest`, body); assert.equal(verified.status, 200); const revision = (await verified.json()).data.revision;
  await assert.rejects(promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/flow-recheck-crash-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_FLOW_RECHECK_ROOT: root, TEST_FLOW_RECHECK_REVISION: String(revision) },
  }), (error: any) => error.code === 19);
  const stored = await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001');
  assert.equal(stored?.revision, revision + 1); assert.equal(stored?.batches[0].status, 'pending');
  assert.equal(stored?.batches[0].verification, undefined); assert.equal(stored?.summary.verifiedBatches, 0);
});

test('a newer plan before revocation wins without reading old frames', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const directory = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(directory, { recursive: true });
  const frame = path.join(directory, 'frame_00001.png');
  await fs.writeFile(frame, await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const verified = await post(`${base}/ingest`, body); const revision = (await verified.json()).data.revision;
  const competing = new StorageEngine(root); const originalSave = store.saveGoogleFlowPlan.bind(store);
  let frameReads = 0; const realOpen = fs.open;
  const open = t.mock.method(fs, 'open', async (...args: any[]) => { if (String(args[0]) === frame) frameReads++; return (realOpen as any)(...args); });
  const save = t.mock.method(store, 'saveGoogleFlowPlan', async (projectId: string, next: Parameters<StorageEngine['saveGoogleFlowPlan']>[1]) => {
    const current = (await competing.getGoogleFlowPlan(projectId, 'S01E001'))!;
    const replacement = createGoogleFlowPlan('S01E001', 'Newer plan', 2, 24, 'keyframe_storyboard', projectId);
    replacement.revision = current.revision; replacement.sourceEpisodeRevision = current.sourceEpisodeRevision;
    await competing.saveGoogleFlowPlan(projectId, replacement);
    await originalSave(projectId, next);
  });
  try {
    const response = await post(`${base}/ingest`, { ...body, expectedRevision: revision });
    assert.equal(response.status, 409); assert.equal((await response.json()).code, 'REVISION_CONFLICT'); assert.equal(frameReads, 0);
  } finally { save.mock.restore(); open.mock.restore(); competing.close(); }
  const stored = (await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001'))!;
  assert.equal(stored.totalFramesExpected, 2); assert.equal(stored.revision, revision + 1); assert.equal(stored.summary.verifiedBatches, 0);
});

test('a newer plan after revocation cannot be overwritten by the old recheck', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const directory = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'frame_00001.png'), await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const verified = await post(`${base}/ingest`, body); const revision = (await verified.json()).data.revision;
  const competing = new StorageEngine(root); const originalSave = store.saveGoogleFlowPlan.bind(store); let writes = 0;
  const save = t.mock.method(store, 'saveGoogleFlowPlan', async (projectId: string, next: Parameters<StorageEngine['saveGoogleFlowPlan']>[1]) => {
    if (++writes === 2) {
      const current = (await competing.getGoogleFlowPlan(projectId, 'S01E001'))!;
      assert.equal(current.batches[0].status, 'pending');
      const replacement = createGoogleFlowPlan('S01E001', 'Newer plan', 2, 24, 'keyframe_storyboard', projectId);
      replacement.revision = current.revision; replacement.sourceEpisodeRevision = current.sourceEpisodeRevision;
      await competing.saveGoogleFlowPlan(projectId, replacement);
    }
    await originalSave(projectId, next);
  });
  try {
    const response = await post(`${base}/ingest`, { ...body, expectedRevision: revision });
    assert.equal(response.status, 409); assert.equal((await response.json()).code, 'REVISION_CONFLICT'); assert.equal(writes, 2);
  } finally { save.mock.restore(); competing.close(); }
  const stored = (await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001'))!;
  assert.equal(stored.totalFramesExpected, 2); assert.equal(stored.revision, revision + 2); assert.equal(stored.summary.verifiedBatches, 0);
});

test('concurrent rechecks admit one winner and return evidence from the committed batch', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const directory = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'frame_00001.png'), await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const initial = await post(`${base}/ingest`, body); const revision = (await initial.json()).data.revision;
  const responses = await Promise.all([post(`${base}/ingest`, { ...body, expectedRevision: revision }), post(`${base}/ingest`, { ...body, expectedRevision: revision })]);
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
  const success = await responses.find(response => response.status === 200)!.json();
  const conflict = await responses.find(response => response.status === 409)!.json();
  assert.equal(success.data.revision, revision + 2); assert.equal(success.data.batch.status, 'verified');
  assert.equal(conflict.code, 'REVISION_CONFLICT');
  const saved = (await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001'))!;
  assert.equal(saved.revision, revision + 2); assert.deepEqual(saved.batches[0].verification, success.data.batch.verification);
  assert.equal(saved.summary.verifiedBatches, 1);
});

test('an error reported after revocation committed still prevents frame inspection', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const directory = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(directory, { recursive: true });
  const frame = path.join(directory, 'frame_00001.png');
  await fs.writeFile(frame, await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const initial = await post(`${base}/ingest`, body); const revision = (await initial.json()).data.revision;
  const originalSave = store.saveGoogleFlowPlan.bind(store); const realOpen = fs.open; let frameReads = 0;
  const open = t.mock.method(fs, 'open', async (...args: any[]) => { if (String(args[0]) === frame) frameReads++; return (realOpen as any)(...args); });
  const save = t.mock.method(store, 'saveGoogleFlowPlan', async (projectId: string, next: Parameters<StorageEngine['saveGoogleFlowPlan']>[1]) => {
    await originalSave(projectId, next); throw new Error('private-post-revocation-error');
  });
  try {
    const response = await post(`${base}/ingest`, { ...body, expectedRevision: revision }); assert.equal(response.status, 500);
    assert.equal((await response.json()).code, 'INTERNAL_ERROR'); assert.equal(frameReads, 0);
  } finally { save.mock.restore(); open.mock.restore(); }
  const stored = (await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001'))!;
  assert.equal(stored.revision, revision + 1); assert.equal(stored.batches[0].status, 'pending'); assert.equal(stored.batches[0].verification, undefined);
});

test('an error reported after the final commit requires reloading rather than assuming pending or success', async t => {
  const { root, store, base } = await fixture(t);
  const created = await post(`${base}/plan/S01E001`, planRequest); const plan = (await created.json()).data;
  const directory = path.join(root, 'projects/proj_ternfall_01/assets/flow_renders/S01E001'); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'frame_00001.png'), await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer());
  const body = { ...ingestRequest, batchId: plan.batches[0].batchId, expectedRevision: plan.revision };
  const initial = await post(`${base}/ingest`, body); const revision = (await initial.json()).data.revision;
  const originalSave = store.saveGoogleFlowPlan.bind(store); let writes = 0;
  const save = t.mock.method(store, 'saveGoogleFlowPlan', async (projectId: string, next: Parameters<StorageEngine['saveGoogleFlowPlan']>[1]) => {
    await originalSave(projectId, next); if (++writes === 2) throw new Error('private-post-final-commit-error');
  });
  try {
    const response = await post(`${base}/ingest`, { ...body, expectedRevision: revision }); assert.equal(response.status, 500);
    const result = await response.json(); assert.equal(result.code, 'INTERNAL_ERROR'); assert.ok(!JSON.stringify(result).includes('private-post-final-commit-error'));
  } finally { save.mock.restore(); }
  const stored = (await store.getGoogleFlowPlan('proj_ternfall_01', 'S01E001'))!;
  assert.equal(stored.revision, revision + 2); assert.equal(stored.batches[0].status, 'verified'); assert.equal(stored.summary.verifiedBatches, 1);
});
