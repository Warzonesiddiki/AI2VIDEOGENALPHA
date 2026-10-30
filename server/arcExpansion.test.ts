import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import express from 'express';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { arcExpansionHandler } from './arcEdits.ts';
import { createGoogleFlowPlan } from '../src/core/flow.ts';
const project = 'proj_ternfall_01';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-arc-test-'));
  const store = new StorageEngine(root); await store.init();
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store };
}
const request = (key = 'batch_1', count: unknown = 2, arcNumber: unknown = 1) => ({ arcNumber, count, idempotencyKey: key });

test('arc schema rejects coercion, invalid counts, unknown fields and missing keys without writes', async t => {
  const { root, store } = await fixture(t); const original = await store.listEpisodes(project);
  for (const value of [0, -1, 21, 1.5, '2', null, true, NaN, Infinity]) await assert.rejects(store.expandArc(project, request('key', value)));
  for (const value of [0, 101, '1', 1.5, null]) await assert.rejects(store.expandArc(project, request('key', 2, value)));
  for (const value of [{ arcNumber: 1 }, { ...request(), extra: true }, [], null]) await assert.rejects(store.expandArc(project, value));
  await assert.rejects(store.expandArc('missing', request()));
  assert.deepEqual(await store.listEpisodes(project), original);
  assert.equal(await store.readJson(path.join(root, 'projects', project, 'arc_expansions.json'), null), null);
  await assert.rejects(fs.stat(path.join(root, 'projects', 'missing')));
});

test('arc allocation uses max numbering, correct season/series and durable idempotency snapshots', async t => {
  const { root, store } = await fixture(t); const source = (await store.getEpisode(project, 'S01E001'))!;
  await store.saveEpisode(project, { ...source, id: 'S01E099', dbId: 'ep_high', revision: 0, episodeNumber: 99 });
  const result = await store.expandArc(project, request('key', 2, 11));
  assert.deepEqual(result.createdCards.map(card => card.id), ['S02E100', 'S02E101']);
  assert.ok(result.createdCards.every(card => card.seriesId === source.seriesId && card.revision === 1 && card.status === 'planned'));
  const edit = structuredClone(result.createdCards[0]); edit.workingTitle = 'Edited later'; await store.saveEpisode(project, edit);
  store.close();
  assert.deepEqual(await store.expandArc(project, request('key', 2, 11)), result);
  assert.equal((await store.listEpisodes(project)).length, 4);
  await assert.rejects(store.expandArc(project, request('key', 1, 11)), /conflicts/);
  assert.ok(await store.readJson(path.join(root, 'projects', project, 'arc_expansions.json'), null));
});

test('failed idempotency persistence rolls back whole episode batch and retry succeeds', async t => {
  const { store } = await fixture(t); const before = await store.listEpisodes(project);
  const original = DocumentStore.prototype.write;
  const mocked = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, file: string, value: unknown) {
    if (file.endsWith('arc_expansions.json')) throw new Error('fixture persistence failure');
    return original.call(this, file, value);
  });
  await assert.rejects(store.expandArc(project, request()), /fixture persistence failure/);
  assert.deepEqual(await store.listEpisodes(project), before); mocked.mock.restore();
  assert.equal((await store.expandArc(project, request())).createdCards.length, 2);
});

test('independent processes allocate disjoint batches and same-key retries only create once', async t => {
  const { root, store } = await fixture(t);
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const run = async (key: string) => JSON.parse((await promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/arc-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_ARC_ROOT: root, TEST_ARC_KEY: key },
  })).stdout);
  const results = await Promise.all([run('a'), run('b')]);
  assert.equal(new Set(results.flatMap(value => value.createdCards.map((card: any) => card.id))).size, 4);
  const replays = await Promise.all([run('same'), run('same')]); assert.deepEqual(replays[0], replays[1]);
  assert.equal((await store.listEpisodes(project)).length, 7);
});

test('arc API returns validation errors and idempotency conflicts instead of partial success', async t => {
  const { store } = await fixture(t); const app = express(); app.use(express.json()); app.post('/projects/:id/arcs/expand', arcExpansionHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const post = (body: unknown) => fetch(`http://127.0.0.1:${address.port}/projects/${project}/arcs/expand`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post(request('api', '2'))).status, 400);
  const first = await (await post(request('api'))).json();
  assert.deepEqual(await (await post(request('api'))).json(), first);
  assert.equal((await post(request('api', 3))).status, 409);
  assert.equal((await store.listEpisodes(project)).length, 3);
});

test('episode/plan writes snapshot caller input and reject new-record revisions or wrong series', async t => {
  const { store } = await fixture(t); const source = (await store.getEpisode(project, 'S01E001'))!;
  await assert.rejects(store.saveEpisode(project, { ...source, seriesId: 'wrong_series' }), /series scope/);
  await assert.rejects(store.saveEpisode(project, { ...source, id: 'S01E002', dbId: 'new_episode', revision: 5 }));
  const episode = { ...source, workingTitle: 'Snapshot title' }; const save = store.saveEpisode(project, episode);
  episode.workingTitle = 'Mutated after call'; await save;
  assert.equal((await store.getEpisode(project, source.id))?.workingTitle, 'Snapshot title');
  const plan = createGoogleFlowPlan(source.id, 'Original plan', 1, 24, 'dense_24fps', project);
  plan.revision = 9; await assert.rejects(store.saveGoogleFlowPlan(project, plan));
  plan.revision = 0; const pending = store.saveGoogleFlowPlan(project, plan); plan.episodeTitle = 'Mutated'; await pending;
  assert.equal((await store.getGoogleFlowPlan(project, source.id))?.episodeTitle, 'Original plan');
});

test('typed CLI arc expansion persists real cards and retries idempotently; rejects malformed flags', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-arc-cli-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  const run = async (...args: string[]) => JSON.parse((await promisify(execFile)(process.execPath, ['--import', loader, cli, ...args, '--json'], { cwd, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } })).stdout).data;
  const args = ['arc', 'expand', '--arc', '1', '--count', '2', '--idempotency-key', 'cli_batch'];
  const result = await run(...args); assert.equal(result.createdCards.length, 2);
  assert.deepEqual(await run(...args), result);
  for (const count of ['2tail', '1.5', '0', '21']) await assert.rejects(run('arc', 'expand', '--arc', '1', '--count', count, '--idempotency-key', 'bad'));
  await assert.rejects(run('arc', 'expand', '--arc', '1'));
  const episodes = await run('episode', 'list');
  assert.ok(JSON.stringify(episodes).includes(result.createdCards[0].id));
});
