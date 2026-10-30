import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { episodeEditHandler } from './episodeEdits.ts';
import { configEditHandler } from './configEdits.ts';
import { episodeListHandler, researchListHandler, seriesReadHandler } from './readHandlers.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const project = 'proj_ternfall_01';
const SERIES = 'series_ternfall_01';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-document-write-policy-'));
  const store = new StorageEngine(root); await store.init();
  const app = express(); app.use(express.json());
  app.get('/projects/:id/series', seriesReadHandler(store));
  app.put('/projects/:id/series', configEditHandler(store, 'series'));
  app.get('/projects/:id/episodes', episodeListHandler(store));
  app.post('/projects/:id/episodes', episodeEditHandler(store));
  app.get('/projects/:id/research', researchListHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, base: `http://127.0.0.1:${address.port}` };
}

async function seedEpisodes(root: string, store: StorageEngine, episodes: unknown[]) {
  const dir = path.join(root, 'projects', project); await fs.mkdir(dir, { recursive: true });
  await store.atomicWriteJson(path.join(dir, 'episodes.json'), episodes);
}

async function seedResearch(root: string, store: StorageEngine, claims: unknown[]) {
  const dir = path.join(root, 'projects', project); await fs.mkdir(dir, { recursive: true });
  await store.atomicWriteJson(path.join(dir, 'research_claims.json'), claims);
}

const send = (method: string, url: string, body: unknown) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function cleanEpisode(overrides: Record<string, unknown> = {}) {
  return {
    revision: 0, id: 'S01E002', dbId: 'ep_writepolicy_1', projectId: project, seriesId: SERIES,
    arcNumber: 1, workingTitle: 'Write policy', logline: 'Logline',
    status: 'planned', scriptVersions: [], activeScriptVersionIndex: 0,
    createdAt: T0, updatedAt: T0, ...overrides,
  };
}

function version(overrides: Record<string, unknown> = {}) {
  return {
    versionNumber: 1, fullNarrationText: 'Narration text for the policy fixture.',
    estimatedDurationSeconds: 2, targetWpm: 145, beats: [], pronunciationNotes: [],
    isApproved: false, createdAt: T0, ...overrides,
  };
}

test('trusted callers cannot introduce unknown keys when creating an episode', async t => {
  const { store } = await fixture(t);
  await assert.rejects(
    () => store.saveEpisode(project, { ...cleanEpisode({ id: 'S01E003', dbId: 'ep_writepolicy_2' }), junkField: 'x' } as any),
    /Unsupported field: junkField/,
  );
  const episodes = await store.listEpisodes(project);
  assert.ok(!episodes.some(item => item.id === 'S01E003'), 'rejected episode must not be persisted');
});

test('trusted callers cannot introduce unknown keys when editing an episode, and stored state stays untouched', async t => {
  const { root, store } = await fixture(t);
  await seedEpisodes(root, store, [cleanEpisode({ revision: 1, legacyNote: 'private-fixture' })]);
  await assert.rejects(
    () => store.saveEpisode(project, { ...cleanEpisode({ revision: 1, logline: 'Edited' }), junkField: 'x' } as any, true),
    /Unsupported field: junkField/,
  );
  const [stored] = await store.listEpisodes(project);
  assert.equal(stored.logline, 'Logline');
  assert.equal((stored as any).legacyNote, 'private-fixture');
});

test('clean trusted edits still preserve stored legacy extras', async t => {
  const { root, store } = await fixture(t);
  await seedEpisodes(root, store, [cleanEpisode({ revision: 1, legacyNote: 'private-fixture' })]);
  const saved = await store.saveEpisode(project, cleanEpisode({ revision: 1, logline: 'Edited' }) as any, true);
  assert.equal(saved.logline, 'Edited');
  assert.equal((saved as any).legacyNote, 'private-fixture');
});

test('trusted callers cannot add a script version outside the pacing policy', async t => {
  const { root, store } = await fixture(t);
  await seedEpisodes(root, store, [cleanEpisode({ revision: 1 })]);
  await assert.rejects(
    () => store.saveEpisode(project, cleanEpisode({ revision: 1, scriptVersions: [version({ targetWpm: 500 })], activeScriptVersionIndex: 0 }) as any, true),
    (error: any) => error?.code === 'EPISODE_INVALID_PACING',
  );
  const [stored] = await store.listEpisodes(project);
  assert.equal(stored.scriptVersions.length, 0);
});

test('trusted callers cannot point the active script version outside the version list', async t => {
  const { root, store } = await fixture(t);
  await seedEpisodes(root, store, [cleanEpisode({ revision: 1 })]);
  await assert.rejects(
    () => store.saveEpisode(project, cleanEpisode({ revision: 1, scriptVersions: [version()], activeScriptVersionIndex: 5 }) as any, true),
    (error: any) => error?.code === 'EPISODE_INVALID_VERSIONS',
  );
});

test('HTTP episode edits reject absurd numeric values and commit nothing', async t => {
  const { root, store, base } = await fixture(t);
  await seedEpisodes(root, store, [cleanEpisode({ revision: 1 })]);
  const bad = await send('POST', `${base}/projects/${project}/episodes`, cleanEpisode({ revision: 1, arcNumber: 1e300 }));
  assert.equal(bad.status, 400);
  const badBody: any = await bad.json();
  assert.equal(badBody.code, 'EPISODE_INVALID_EDIT');

  const badBeat = await send('POST', `${base}/projects/${project}/episodes`, cleanEpisode({
    revision: 1,
    beats: [{ beatNumber: 1, name: 'B', targetSeconds: 1e300, soundDesignCues: [], continuityClues: [] }],
  }));
  assert.equal(badBeat.status, 400);
  assert.equal((await badBeat.json() as any).code, 'EPISODE_INVALID_EDIT');

  const [stored] = await store.listEpisodes(project);
  assert.equal(stored.arcNumber, 1);
  assert.equal(JSON.stringify(stored).includes('1e+300'), false);
});

test('HTTP series updates reject absurd nested numeric values and commit nothing', async t => {
  const { root, store, base } = await fixture(t);
  const before = await store.getSeriesBible(project);
  assert.ok(before);
  const response = await send('PUT', `${base}/projects/${project}/series`, {
    revision: before!.revision ?? 0,
    characters: [{
      id: 'char_policy', name: 'N', age: 1e300, role: 'R', visualAnchor: 'V', psychologicalWound: 'W',
      knowledgeScope: 'K', voiceStyle: 'S', appearancePromptGuidance: 'A', currentStatus: 'active', lastKnownLocation: 'L',
    }],
  });
  assert.equal(response.status, 400);
  const body: any = await response.json();
  assert.equal(body.code, 'SERIES_INVALID_REQUEST');
  const after = await store.getSeriesBible(project);
  assert.equal(JSON.stringify(after!.characters), JSON.stringify(before!.characters));
});

test('reads fail closed on stored numeric values outside the model instead of serializing them', async t => {
  const { root, store, base } = await fixture(t);
  await seedEpisodes(root, store, [cleanEpisode({ revision: 1, arcNumber: 1e300 })]);
  const response = await fetch(`${base}/projects/${project}/episodes`);
  assert.ok(response.status >= 500, `expected fail-closed read, got ${response.status}`);
  const text = await response.text();
  assert.equal(text.includes('1e+300'), false);
  assert.equal(text.includes('arcNumber'), false);
  const body = JSON.parse(text);
  assert.equal(body.ok, false);
});

test('legacy research confidence outside 0-1 keeps its normalized unreviewed read view', async t => {
  const { root, store, base } = await fixture(t);
  await seedResearch(root, store, [{
    revision: 1, id: 'res_guard_1', projectId: project, claimText: 'Claim', isFictionalLore: false,
    verificationStatus: 'verified', confidenceScore: 5, humanApproved: true, factCheckerNotes: 'notes',
    relatedEpisodeIds: [], createdAt: T0, updatedAt: T0,
  }]);
  const response = await fetch(`${base}/projects/${project}/research`);
  assert.equal(response.status, 200);
  const body: any = await response.json();
  assert.equal(body.data[0].confidenceScore, 0);
  assert.equal(body.data[0].humanApproved, false);
  assert.equal(body.data[0].verificationStatus, 'unverified');
});

test('the pacing endpoint range-checks targetWpm instead of emitting non-finite results', async t => {
  const { pacingCalculationHandler } = await import('./pacingHandler.ts');
  const app = express(); app.use(express.json());
  app.post('/pacing/calculate', pacingCalculationHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  const base = `http://127.0.0.1:${address.port}`;

  const good = await send('POST', `${base}/pacing/calculate`, { text: 'one two three', targetWpm: 145 });
  assert.equal(good.status, 200);
  const goodText = await good.text();
  assert.equal(goodText.includes('null'), false);
  assert.equal(goodText.includes('1e+'), false);

  for (const targetWpm of [0, 5000, 1e300, -1, 'fast']) {
    const response = await send('POST', `${base}/pacing/calculate`, { text: 'one two three', targetWpm });
    assert.equal(response.status, 400, `targetWpm ${String(targetWpm)} must be rejected`);
    assert.equal((await response.text()).includes('one two three'), false);
  }
});
