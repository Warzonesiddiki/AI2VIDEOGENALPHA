import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { RevisionConflict } from './lib/conflicts.ts';
import { DATA_NOTICE_VERSION } from '../src/core/dataNotice.ts';
import { projectEditHandler } from './projectEdits.ts';
import { configEditHandler } from './configEdits.ts';
import { researchEditHandler } from './researchEdits.ts';

const project = 'proj_ternfall_01';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-mutation-api-test-'));
  const store = new StorageEngine(root); await store.init();
  const app = express(); app.use(express.json());
  app.post('/projects', projectEditHandler(store, 'create')); app.post('/projects/:id/archive', projectEditHandler(store, 'archive'));
  app.put('/settings', configEditHandler(store, 'settings')); app.put('/projects/:id/series', configEditHandler(store, 'series'));
  app.post('/projects/:id/research', researchEditHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { store, base: `http://127.0.0.1:${address.port}` };
}
const send = (method: string, url: string, body: unknown) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('project, configuration and research mutations suppress unexpected and forged storage errors', async t => {
  const { store, base } = await fixture(t);
  const cases = [
    ['createProject', 'POST', '/projects', { name: 'Fixture' }],
    ['archiveProject', 'POST', `/projects/${project}/archive`, { isArchived: true, revision: 0 }],
    ['updateSettings', 'PUT', '/settings', { productionTimezone: 'UTC', revision: 0 }],
    ['updateSeriesBible', 'PUT', `/projects/${project}/series`, { seriesTitle: 'Fixture', revision: 0 }],
    ['getProject', 'POST', `/projects/${project}/research`, { claimText: 'Research fixture' }],
    ['listResearchClaims', 'POST', `/projects/${project}/research`, { id: 'existing_fixture', claimText: 'Research fixture' }],
    ['saveResearchClaim', 'POST', `/projects/${project}/research`, { claimText: 'Research fixture' }],
  ] as const;
  for (const [method, verb, url, body] of cases) for (const forged of [false, true]) {
    const failure = Object.assign(new Error('private-mutation-path-and-token'), forged ? { code: 'REVISION_CONFLICT', currentRevision: 900 } : {});
    const mock = t.mock.method(store, method, async () => { throw failure; });
    try {
      const response = await send(verb, base + url, body); assert.equal(response.status, 500, `${method} forged=${forged}`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json(); assert.equal(result.code, 'INTERNAL_ERROR');
      assert.ok(!JSON.stringify(result).includes('private-mutation-path-and-token')); assert.ok(!Object.hasOwn(result, 'currentRevision'));
    } finally { mock.mock.restore(); }
  }
});

test('trusted revision conflicts in all mutation handlers disclose only a fixed message and valid revision', async t => {
  const { store, base } = await fixture(t);
  const cases = [
    ['archiveProject', 'POST', `/projects/${project}/archive`, { isArchived: true, revision: 0 }],
    ['updateSettings', 'PUT', '/settings', { productionTimezone: 'UTC', revision: 0 }],
    ['updateSeriesBible', 'PUT', `/projects/${project}/series`, { seriesTitle: 'Fixture', revision: 0 }],
    ['saveResearchClaim', 'POST', `/projects/${project}/research`, { claimText: 'Research fixture' }],
  ] as const;
  for (const [method, verb, url, body] of cases) {
    const conflict = new RevisionConflict(5); conflict.message = 'private-conflict-detail';
    const mock = t.mock.method(store, method, async () => { throw conflict; });
    try {
      const response = await send(verb, base + url, body); assert.equal(response.status, 409);
      const result = await response.json(); assert.equal(result.code, 'REVISION_CONFLICT'); assert.equal(result.currentRevision, 5);
      assert.ok(!JSON.stringify(result).includes('private-conflict-detail'));
      (conflict as any).currentRevision = 'private-revision';
      const invalid = await send(verb, base + url, body); assert.equal(invalid.status, 500); assert.equal((await invalid.json()).code, 'INTERNAL_ERROR');
    } finally { mock.mock.restore(); }
  }
});

test('project, settings, series and research validation remains actionable without exposing submitted field names', async t => {
  const { store, base } = await fixture(t);
  const before = await store.getSettings(); const bible = await store.getSeriesBible(project); const claims = await store.listResearchClaims(project);
  const cases = [
    ['POST', '/projects', { name: '', private_dynamic_field: true }, 'PROJECT_INVALID_REQUEST'],
    ['POST', `/projects/${project}/archive`, { isArchived: 'yes', revision: 0 }, 'PROJECT_INVALID_REQUEST'],
    ['PUT', '/settings', { private_dynamic_field: true }, 'SETTINGS_INVALID_REQUEST'],
    ['PUT', `/projects/${project}/series`, { private_dynamic_field: true }, 'SERIES_INVALID_REQUEST'],
    ['POST', `/projects/${project}/research`, { claimText: 'Note', private_dynamic_field: true }, 'RESEARCH_INVALID_REQUEST'],
  ] as const;
  for (const [verb, url, body, code] of cases) {
    const response = await send(verb, base + url, body); assert.equal(response.status, 400); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json(); assert.equal(result.code, code); assert.ok(!JSON.stringify(result).includes('private_dynamic_field'));
  }
  assert.deepEqual(await store.getSettings(), before); assert.deepEqual(await store.getSeriesBible(project), bible); assert.deepEqual(await store.listResearchClaims(project), claims);
});

test('settings event write failure rolls back and returns a sanitized error', async t => {
  const { store, base } = await fixture(t); const before = await store.getSettings();
  const original = DocumentStore.prototype.write;
  const mock = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, file: string, value: unknown) {
    if (file.endsWith('data_notice_events.json')) throw new Error('private-event-persistence-path');
    return original.call(this, file, value);
  });
  try {
    const response = await send('PUT', `${base}/settings`, { revision: before.revision, dataNoticeAccepted: true, dataNoticeVersion: DATA_NOTICE_VERSION });
    assert.equal(response.status, 500); const result = await response.json(); assert.equal(result.code, 'INTERNAL_ERROR');
    assert.ok(!JSON.stringify(result).includes('private-event-persistence-path'));
  } finally { mock.mock.restore(); }
  assert.deepEqual(await store.getSettings(), before);
});

test('validated settings, series and research inputs cannot change while storage awaits initialization', async t => {
  const { store } = await fixture(t);
  const before = await store.getSettings();
  const settings: any = { revision: before.revision, productionTimezone: 'UTC' };
  const savingSettings = store.updateSettings(settings);
  settings.productionTimezone = 'Not/AZone'; settings.budgetCaps = { perRunCapUsd: 999999 };
  const savedSettings = await savingSettings;
  assert.equal(savedSettings.productionTimezone, 'UTC'); assert.deepEqual(savedSettings.budgetCaps, before.budgetCaps);
  assert.deepEqual(await store.getSettings(), savedSettings);

  const series: any = { revision: 0, seriesTitle: 'Validated title', characters: [{ id: 'race_character', name: 'Validated character', age: 30, role: 'Fixture role', visualAnchor: 'Anchor', psychologicalWound: 'Wound', knowledgeScope: 'Scope', voiceStyle: 'Voice', appearancePromptGuidance: 'Guidance', currentStatus: 'active', lastKnownLocation: 'South Gate' }] };
  const savingSeries = store.updateSeriesBible(project, series);
  series.seriesTitle = 'Modified after validation'; series.characters[0].name = 'Changed after validation'; series.unexpected = true;
  const savedSeries = (await savingSeries)!;
  assert.equal(savedSeries.seriesTitle, 'Validated title'); assert.equal((savedSeries.characters[0] as any).name, 'Validated character');
  assert.equal((savedSeries as any).unexpected, undefined); assert.deepEqual(await store.getSeriesBible(project), savedSeries);

  const now = new Date().toISOString();
  const claim: any = { id: 'race_fixture', projectId: project, claimText: 'Validated note', isFictionalLore: false, verificationStatus: 'unverified', confidenceScore: 0, humanApproved: false, factCheckerNotes: '', relatedEpisodeIds: ['S01E001'], createdAt: now, updatedAt: now };
  const savingClaim = store.saveResearchClaim(project, claim);
  claim.relatedEpisodeIds[0] = '../escape'; claim.claimText = 'Changed after validation';
  const savedClaim = await savingClaim;
  assert.deepEqual(savedClaim.relatedEpisodeIds, ['S01E001']); assert.equal(savedClaim.claimText, 'Validated note');
  assert.deepEqual((await store.listResearchClaims(project)).find(item => item.id === savedClaim.id), savedClaim);
});
