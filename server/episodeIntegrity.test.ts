import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { episodeCreationHandler, episodeDuplicationHandler, episodeCheckHandler } from './episodeCommands.ts';
import { episodeEditHandler } from './episodeEdits.ts';
import { RevisionConflict } from './lib/conflicts.ts';
import type { EpisodeCard } from '../src/types/index.ts';

const project = 'proj_ternfall_01';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-episode-test-'));
  const store = new StorageEngine(root); await store.init();
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store };
}
async function writeFixtureEpisodes(root: string, store: StorageEngine, episodes: EpisodeCard[]) {
  await store.atomicWriteJson(path.join(root, 'projects', project, 'episodes.json'), episodes);
}
const create = (key: string, title = 'A new draft') => ({ idempotencyKey: key, workingTitle: title, logline: '', physicalObjective: '' });

test('creation and duplication allocate above all legacy fields and IDs without changing source records', async t => {
  const { root, store } = await fixture(t);
  const pilot = (await store.getEpisode(project, 'S01E001'))!;
  const legacy: EpisodeCard = {
    ...structuredClone(pilot), id: 'S01E002', dbId: 'legacy_second', seriesId: `series_${project}`,
    episodeNumber: undefined, episodeNumberInSeries: 2, workingTitle: 'Legacy draft', revision: 0,
    scriptVersions: pilot.scriptVersions.map(version => ({ ...version, isApproved: true, approvedBy: 'Fixture reviewer' })),
  };
  const high: EpisodeCard = { ...structuredClone(pilot), id: 'S02E120', dbId: 'high_id', season: 2, seasonNumber: 2, episodeNumber: undefined, episodeNumberInSeries: undefined, revision: 0 };
  await writeFixtureEpisodes(root, store, [pilot, legacy, high]);
  const sourceSnapshot = await store.getEpisode(project, 'S01E002');
  const variant = (await store.duplicateEpisode(project, 'S01E002', undefined, 'variant_once'))!;
  assert.equal(variant.id, 'S01E121'); assert.equal(variant.episodeNumber, 121); assert.equal(variant.episodeNumberInSeries, 121);
  assert.equal(variant.seriesId, pilot.seriesId); assert.equal(variant.provenanceSourceEpisodeId, 'S01E002');
  assert.equal(variant.status, 'planned'); assert.equal(variant.staleDownstreamAssets, true);
  assert.ok(variant.scriptVersions.every(version => !version.isApproved && !version.approvedBy));
  assert.deepEqual(await store.getEpisode(project, 'S01E002'), sourceSnapshot);
  assert.deepEqual(await store.duplicateEpisode(project, 'S01E002', undefined, 'variant_once'), variant);
  await assert.rejects(store.duplicateEpisode(project, 'S01E002', 'Different title', 'variant_once'), /conflicts/);
  const card = await store.createEpisode(project, create('create_once'));
  assert.equal(card.id, 'S01E122'); assert.equal(card.seriesId, pilot.seriesId); assert.equal(card.episodeNumberInSeries, 122);
  assert.equal(card.status, 'planned'); assert.deepEqual(card.scriptVersions, []); assert.equal(card.logline, '');
  const nextSeason = (await store.duplicateEpisode(project, 'S02E120', undefined, 'season_two'))!;
  assert.equal(nextSeason.id, 'S02E123'); assert.equal(nextSeason.seasonNumber, 2);
  assert.equal(new Set((await store.listEpisodes(project)).map(item => item.id)).size, 6);
});

test('creation validates fields, persists idempotency across restart, and refuses altered retries', async t => {
  const { store } = await fixture(t); const before = await store.listEpisodes(project);
  for (const input of [null, [], {}, { ...create('key'), id: 'S01E999' }, create('../bad'), create('key', ' '), { ...create('key'), logline: 9 }, { ...create('key'), logline: null }, { ...create('key'), physicalObjective: '\0' }]) {
    await assert.rejects(store.createEpisode(project, input));
  }
  await assert.rejects(store.createEpisode('missing_project', create('key')));
  assert.deepEqual(await store.listEpisodes(project), before);
  const saved = await store.createEpisode(project, { ...create('stable'), workingTitle: '  A new draft  ' });
  const edit = structuredClone(saved); edit.workingTitle = 'Edited later'; await store.saveEpisode(project, edit);
  store.close();
  assert.deepEqual(await store.createEpisode(project, create('stable')), saved);
  await assert.rejects(store.createEpisode(project, create('stable', 'Conflicting draft')), /conflicts/);
  assert.equal((await store.getEpisode(project, saved.id))?.workingTitle, 'Edited later');
});

test('legacy series values can be preserved on explicit edits but cannot be silently reassigned', async t => {
  const { root, store } = await fixture(t); const pilot = (await store.getEpisode(project, 'S01E001'))!;
  const legacy: EpisodeCard = { ...structuredClone(pilot), id: 'S01E002', dbId: 'legacy_second', seriesId: `series_${project}`, revision: 0 };
  await writeFixtureEpisodes(root, store, [pilot, legacy]);
  const draft = (await store.getEpisode(project, legacy.id))!; draft.workingTitle = 'Edited legacy draft';
  const saved = await store.saveEpisode(project, draft, true);
  assert.equal(saved.seriesId, legacy.seriesId); assert.equal(saved.revision, 1);
  assert.equal((await store.getEpisode(project, legacy.id))?.workingTitle, 'Edited legacy draft');
  await assert.rejects(store.saveEpisode(project, { ...saved, seriesId: pilot.seriesId }, true), /series scope/);
  await assert.rejects(store.saveEpisode(project, { ...legacy, workingTitle: 'Stale' }, true), RevisionConflict);
  await assert.rejects(store.saveEpisode(project, { ...pilot, id: 'S01E003', dbId: 'new_legacy', seriesId: legacy.seriesId, revision: 0 }), /series scope/);
  assert.equal((await store.getEpisode(project, legacy.id))?.seriesId, legacy.seriesId);
});

test('ambiguous legacy identities fail closed on reads, allocation and edits', async t => {
  const { root, store } = await fixture(t); const pilot = (await store.getEpisode(project, 'S01E001'))!;
  const duplicate = { ...structuredClone(pilot), dbId: 'another_dbid' };
  await writeFixtureEpisodes(root, store, [pilot, duplicate]);
  const before = await store.listEpisodes(project);
  await assert.rejects(store.getEpisode(project, pilot.id), /Ambiguous/);
  await assert.rejects(store.createEpisode(project, create('ambiguous_create')), /Ambiguous/);
  await assert.rejects(store.duplicateEpisode(project, pilot.id, undefined, 'ambiguous_copy'), /Ambiguous/);
  await assert.rejects(store.expandArc(project, { arcNumber: 1, count: 1, idempotencyKey: 'ambiguous_arc' }), /Ambiguous/);
  await assert.rejects(store.saveEpisode(project, pilot, true), /Ambiguous/);
  assert.deepEqual(await store.listEpisodes(project), before);
  const alias = { ...structuredClone(pilot), id: 'S01E002', dbId: pilot.id };
  await writeFixtureEpisodes(root, store, [pilot, alias]);
  await assert.rejects(store.createEpisode(project, create('cross_alias')), /Ambiguous/);
  await assert.rejects(store.getEpisode(project, pilot.id), /Ambiguous/);
});

test('failed idempotency persistence rolls back both create and duplicate atomically', async t => {
  const { store } = await fixture(t); const before = await store.listEpisodes(project);
  const original = DocumentStore.prototype.write;
  const mocked = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, file: string, value: unknown) {
    if (file.endsWith('episode_creation_requests.json') || file.endsWith('episode_duplication_requests.json')) throw new Error('fixture request write failure');
    return original.call(this, file, value);
  });
  await assert.rejects(store.createEpisode(project, create('rollback_create')), /fixture request write failure/);
  await assert.rejects(store.duplicateEpisode(project, 'S01E001', undefined, 'rollback_duplicate'), /fixture request write failure/);
  assert.deepEqual(await store.listEpisodes(project), before);
  mocked.mock.restore();
  assert.equal((await store.createEpisode(project, create('rollback_create'))).id, 'S01E002');
  assert.equal((await store.duplicateEpisode(project, 'S01E001', undefined, 'rollback_duplicate'))?.id, 'S01E003');
});

test('independent processes allocate unique identities and collapse same-key retries', async t => {
  const { root, store } = await fixture(t); const runFile = promisify(execFile);
  const run = async (mode: string, key: string) => JSON.parse((await runFile(process.execPath, ['--import', 'tsx', 'server/fixtures/episode-allocation-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_EPISODE_ROOT: root, TEST_EPISODE_KEY: key, TEST_EPISODE_MODE: mode },
  })).stdout);
  const unique = await Promise.all([run('create', 'a'), run('create', 'b'), run('duplicate', 'c'), run('duplicate', 'd')]);
  assert.equal(new Set(unique.map(item => item.id)).size, 4);
  const sameCreate = await Promise.all([run('create', 'same_create'), run('create', 'same_create')]);
  const sameCopy = await Promise.all([run('duplicate', 'same_copy'), run('duplicate', 'same_copy')]);
  assert.deepEqual(sameCreate[0], sameCreate[1]); assert.deepEqual(sameCopy[0], sameCopy[1]);
  const all = await store.listEpisodes(project); assert.equal(all.length, 7); assert.equal(new Set(all.map(item => item.id)).size, 7);
});

test('episode API requires server-owned creation and retry keys; checks never certify readiness', async t => {
  const { store } = await fixture(t); const app = express(); app.use(express.json());
  app.post('/projects/:id/episodes/create', episodeCreationHandler(store));
  app.post('/projects/:id/episodes', episodeEditHandler(store));
  app.post('/projects/:id/episodes/:epId/duplicate', episodeDuplicationHandler(store));
  app.post('/projects/:id/episodes/:epId/check', episodeCheckHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/projects/${project}`;
  const post = (url: string, body: unknown = {}) => fetch(`${base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/episodes/create', { ...create('api'), id: 'S01E999' })).status, 400);
  const response = await post('/episodes/create', create('api')); assert.equal(response.status, 201);
  const card = (await response.json()).data;
  assert.deepEqual((await (await post('/episodes/create', create('api'))).json()).data, card);
  assert.equal((await post('/episodes/create', create('api', 'Different'))).status, 409);
  assert.equal((await post('/episodes/S01E001/duplicate', {})).status, 400);
  assert.equal((await post('/episodes/missing/duplicate', { idempotencyKey: 'missing' })).status, 404);
  const duplicated = await post('/episodes/S01E001/duplicate', { idempotencyKey: 'copy_api' }); assert.equal(duplicated.status, 200);
  assert.deepEqual((await duplicated.json()).data, (await (await post('/episodes/S01E001/duplicate', { idempotencyKey: 'copy_api' })).json()).data);
  const attemptedClientCreate = { ...card, id: 'S01E999', dbId: 'client_id', revision: 0 };
  assert.equal((await post('/episodes', attemptedClientCreate)).status, 400);
  const blank = (await (await post(`/episodes/${card.id}/check`)).json()).data;
  assert.equal(blank.isReadyForProduction, false); assert.equal(blank.scriptPresent, false); assert.equal(blank.canonValidation.evaluated, false);
  const pilot = (await (await post('/episodes/S01E001/check')).json()).data;
  assert.equal(pilot.isReadyForProduction, false); assert.equal(pilot.scriptPresent, true); assert.equal(pilot.canonValidation.evaluated, true);
  assert.match(pilot.readinessNotice, /advisory/i);
});

test('CLI create uses allocated identity and retry keys; approve cannot create a review marker', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-episode-cli-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  const run = async (...args: string[]) => JSON.parse((await promisify(execFile)(process.execPath, ['--import', loader, cli, ...args, '--json'], { cwd, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } })).stdout).data;
  const args = ['episode', 'create', '--title', 'CLI draft', '--idempotency-key', 'cli_create'];
  const first = await run(...args); assert.equal(first.id, 'S01E002'); assert.deepEqual(await run(...args), first);
  await assert.rejects(run('episode', 'create', '--title', 'Different', '--idempotency-key', 'cli_create'));
  await assert.rejects(run('episode', 'create', '--id', 'S01E999', '--title', 'Bad', '--idempotency-key', 'bad'));
  const before = await run('episode', 'show', 'S01E001');
  await assert.rejects(run('episode', 'approve', 'S01E001'));
  assert.deepEqual(await run('episode', 'show', 'S01E001'), before);
});

test('active script changes always invalidate downstream assets and duplicate version numbers are rejected', async t => {
  const { store } = await fixture(t); const episode = (await store.getEpisode(project, 'S01E001'))!;
  const changed = structuredClone(episode);
  changed.scriptVersions.push({ ...changed.scriptVersions[0], versionNumber: 2, fullNarrationText: 'A new observation follows.', wordCount: 999 });
  changed.activeScriptVersionIndex = 1;
  changed.staleDownstreamAssets = false;
  const saved = await store.saveEpisode(project, changed, true);
  assert.equal(saved.staleDownstreamAssets, true);
  assert.equal(saved.scriptVersions[1].wordCount, 4);
  const attemptedClear = { ...saved, staleDownstreamAssets: false };
  assert.equal((await store.saveEpisode(project, attemptedClear, true)).staleDownstreamAssets, true);
  const app = express(); app.use(express.json()); app.post('/projects/:id/episodes', episodeEditHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const latest = (await store.getEpisode(project, 'S01E001'))!;
  const invalid = { ...latest, scriptVersions: [latest.scriptVersions[0], { ...latest.scriptVersions[0] }] };
  const response = await fetch(`http://127.0.0.1:${address.port}/projects/${project}/episodes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invalid) });
  assert.equal(response.status, 400); assert.match((await response.json()).error, /duplicate script version/i);
  assert.equal((await store.getEpisode(project, 'S01E001'))?.scriptVersions.length, 2);
});

test('API preserves immutable historical script fields and appends only above the high-water mark', async t => {
  const { root, store } = await fixture(t);
  const records = await store.listEpisodes(project), legacy = structuredClone(records[0]);
  legacy.scriptVersions[0].versionNumber = 3;
  delete (legacy.scriptVersions[0] as Partial<typeof legacy.scriptVersions[number]>).wordCount;
  legacy.scriptVersions[0].beats = [{ timestampStart: '00:00', timestampEnd: '00:30', beatName: 'Signal', dramaticFunction: 'Discovery', dialogueOrNarrationSnippet: 'The lights shifted.' }];
  legacy.scriptVersions[0].pronunciationNotes = [{ term: 'Fixture', guide: 'FIX-chur' }];
  await writeFixtureEpisodes(root, store, [legacy]);
  const before = (await store.getEpisode(project, legacy.id))!;
  const app = express(); app.use(express.json()); app.post('/projects/:id/episodes', episodeEditHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const post = (episode: unknown) => fetch(`http://127.0.0.1:${address.port}/projects/${project}/episodes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(episode) });
  const addition = { ...before.scriptVersions[0], versionNumber: 4, fullNarrationText: 'A short new passage.', wordCount: 999 };
  const response = await post({ ...before, scriptVersions: [...before.scriptVersions, addition], activeScriptVersionIndex: 1, staleDownstreamAssets: false });
  assert.equal(response.status, 200); const saved = (await response.json()).data;
  assert.deepEqual(saved.scriptVersions[0], before.scriptVersions[0]);
  assert.equal('wordCount' in saved.scriptVersions[0], false);
  assert.equal(saved.scriptVersions[1].wordCount, 4); assert.equal(saved.staleDownstreamAssets, true);
  const rewritten = structuredClone(saved); rewritten.scriptVersions[0].fullNarrationText = 'Rewritten history';
  const badRewrite = await post(rewritten); assert.equal(badRewrite.status, 400); assert.match((await badRewrite.json()).error, /historical.*immutable/i);
  const removed = await post({ ...saved, scriptVersions: [saved.scriptVersions[0]], activeScriptVersionIndex: 0 });
  assert.equal(removed.status, 400); assert.match((await removed.json()).error, /cannot be removed/i);
  const gapFill = await post({ ...saved, scriptVersions: [...saved.scriptVersions, { ...addition, versionNumber: 2 }] });
  assert.equal(gapFill.status, 400); assert.match((await gapFill.json()).error, /high-water/i);
  assert.deepEqual((await store.getEpisode(project, legacy.id))?.scriptVersions, saved.scriptVersions);
});

test('allocation skips legacy database IDs that occupy the public episode namespace', async t => {
  const { root, store } = await fixture(t);
  const pilot = (await store.getEpisode(project, 'S01E001'))!;
  // getEpisode accepts both id and dbId, so this database alias reserves S01E002.
  await writeFixtureEpisodes(root, store, [{ ...pilot, dbId: 'S01E002' }]);
  const created = await store.createEpisode(project, create('db_alias_create'));
  assert.equal(created.id, 'S01E003');
  const copy = await store.duplicateEpisode(project, pilot.id, undefined, 'db_alias_duplicate');
  assert.equal(copy?.id, 'S01E004');
  const batch = await store.expandArc(project, { arcNumber: 1, count: 1, idempotencyKey: 'db_alias_arc' });
  assert.equal(batch.createdCards[0].id, 'S01E005');
  const all = await store.listEpisodes(project);
  assert.equal(new Set(all.flatMap(item => [...new Set([item.id, item.dbId])])).size, 8);
});
