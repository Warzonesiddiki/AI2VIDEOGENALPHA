import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { RevisionConflict } from './lib/conflicts.ts';
import { episodeCreationHandler, episodeDuplicationHandler, episodeCheckHandler } from './episodeCommands.ts';
import { episodeEditHandler } from './episodeEdits.ts';
import { arcExpansionHandler } from './arcEdits.ts';

const project = 'proj_ternfall_01';
const create = { workingTitle: 'Private safety fixture', idempotencyKey: 'create_fixture' };
const duplicate = { title: 'Safe variant', idempotencyKey: 'duplicate_fixture' };
const arc = { arcNumber: 1, count: 1, idempotencyKey: 'arc_fixture' };
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-episode-api-test-'));
  const store = new StorageEngine(root); await store.init();
  const app = express(); app.use(express.json());
  app.post('/projects/:id/episodes/create', episodeCreationHandler(store));
  app.post('/projects/:id/episodes', episodeEditHandler(store));
  app.post('/projects/:id/episodes/:epId/duplicate', episodeDuplicationHandler(store));
  app.post('/projects/:id/episodes/:epId/check', episodeCheckHandler(store));
  app.post('/projects/:id/arcs/expand', arcExpansionHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { store, base: `http://127.0.0.1:${address.port}/projects/${project}` };
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('episode and arc routes hide unexpected storage errors and reject forged conflict codes', async t => {
  const { store, base } = await fixture(t); const episode = (await store.getEpisode(project, 'S01E001'))!;
  const cases = [
    ['createEpisode', '/episodes/create', create], ['duplicateEpisode', '/episodes/S01E001/duplicate', duplicate],
    ['saveEpisode', '/episodes', episode], ['getEpisode', '/episodes/S01E001/check', {}],
    ['listEpisodes', '/episodes/S01E001/check', {}], ['expandArc', '/arcs/expand', arc],
  ] as const;
  for (const [method, url, body] of cases) for (const forged of [false, true]) {
    const failure = Object.assign(new Error('private-episode-storage-path-and-token'), forged ? { code: 'IDEMPOTENCY_CONFLICT', currentRevision: 99 } : {});
    const mock = t.mock.method(store, method, async () => { throw failure; });
    try {
      const response = await post(base + url, body); assert.equal(response.status, 500, `${method}: forged=${forged}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json(); assert.equal(result.code, 'INTERNAL_ERROR');
      assert.ok(!JSON.stringify(result).includes('private-episode-storage-path-and-token'));
      assert.ok(!Object.hasOwn(result, 'currentRevision'));
    } finally { mock.mock.restore(); }
  }
});

test('episode revisions expose only trusted fixed conflict messages and valid revisions', async t => {
  const { store, base } = await fixture(t); const episode = (await store.getEpisode(project, 'S01E001'))!;
  const conflict = new RevisionConflict(7); conflict.message = 'private-revision-error';
  const mock = t.mock.method(store, 'saveEpisode', async () => { throw conflict; });
  try {
    const response = await post(`${base}/episodes`, episode); assert.equal(response.status, 409);
    const result = await response.json(); assert.equal(result.code, 'REVISION_CONFLICT'); assert.equal(result.currentRevision, 7);
    assert.ok(!JSON.stringify(result).includes('private-revision-error'));
    (conflict as any).currentRevision = -1;
    const invalid = await post(`${base}/episodes`, episode); assert.equal(invalid.status, 500);
    assert.equal((await invalid.json()).code, 'INTERNAL_ERROR');
  } finally { mock.mock.restore(); }
});

test('episode and arc validation and idempotency remain actionable with fixed no-store responses', async t => {
  const { store, base } = await fixture(t);
  for (const [url, body] of [['/episodes/create', { ...create, workingTitle: '' }], ['/episodes/S01E001/duplicate', {}], ['/arcs/expand', { ...arc, count: 21 }]] as const) {
    const response = await post(base + url, body); assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.ok((await response.json()).code);
  }
  assert.equal((await post(`${base}/episodes/create`, create)).status, 201);
  assert.equal((await post(`${base}/episodes/S01E001/duplicate`, duplicate)).status, 200);
  assert.equal((await post(`${base}/arcs/expand`, arc)).status, 200);
  for (const [url, body] of [['/episodes/create', { ...create, workingTitle: 'Changed' }], ['/episodes/S01E001/duplicate', { ...duplicate, title: 'Changed' }], ['/arcs/expand', { ...arc, count: 2 }]] as const) {
    const response = await post(base + url, body); assert.equal(response.status, 409); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json(); assert.equal(result.code, 'IDEMPOTENCY_CONFLICT'); assert.match(result.error, /idempotency/i);
  }
  const current = (await store.getEpisode(project, 'S01E001'))!;
  const stale = { ...current, revision: (current.revision ?? 0) + 1 };
  const response = await post(`${base}/episodes`, stale); assert.equal(response.status, 409); assert.equal((await response.json()).currentRevision, current.revision ?? 0);
  const attemptedNew = { ...current, id: 'S01E999', dbId: 'new_identifier', revision: 0 };
  assert.equal((await post(`${base}/episodes`, attemptedNew)).status, 400);
});

test('an episode write failure rolls back and returns no internal persistence details', async t => {
  const { store, base } = await fixture(t); const before = await store.listEpisodes(project);
  const original = DocumentStore.prototype.write;
  const mock = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, file: string, value: unknown) {
    if (file.endsWith('episode_creation_requests.json')) throw new Error('private-database-write-details');
    return original.call(this, file, value);
  });
  try {
    const response = await post(`${base}/episodes/create`, create); assert.equal(response.status, 500);
    const result = await response.json(); assert.equal(result.code, 'INTERNAL_ERROR'); assert.ok(!JSON.stringify(result).includes('private-database-write-details'));
  } finally { mock.mock.restore(); }
  assert.deepEqual(await store.listEpisodes(project), before);
  assert.equal((await post(`${base}/episodes/create`, create)).status, 201);
});

test('trusted editorial error types still use fixed allowlisted messages', async t => {
  const { IdempotencyConflict } = await import('./lib/conflicts.ts');
  const { RequestError } = await import('./lib/requestErrors.ts');
  const { store, base } = await fixture(t);
  const expected = new RequestError('EPISODE_PROJECT_UNAVAILABLE'); expected.message = 'private-request-diagnostic';
  const mock = t.mock.method(store, 'createEpisode', async () => { throw expected; });
  try {
    let response = await post(`${base}/episodes/create`, create); let result = await response.json();
    assert.equal(response.status, 400); assert.equal(result.code, 'EPISODE_PROJECT_UNAVAILABLE'); assert.ok(!JSON.stringify(result).includes('private-request-diagnostic'));
    (expected as any).code = '__proto__';
    response = await post(`${base}/episodes/create`, create); assert.equal(response.status, 500); assert.equal((await response.json()).code, 'INTERNAL_ERROR');
  } finally { mock.mock.restore(); }
  const conflict = new IdempotencyConflict(); conflict.message = 'private-idempotency-diagnostic';
  const conflictMock = t.mock.method(store, 'duplicateEpisode', async () => { throw conflict; });
  try {
    const response = await post(`${base}/episodes/S01E001/duplicate`, duplicate); const result = await response.json();
    assert.equal(response.status, 409); assert.equal(result.code, 'IDEMPOTENCY_CONFLICT'); assert.ok(!JSON.stringify(result).includes('private-idempotency-diagnostic'));
  } finally { conflictMock.mock.restore(); }
});
