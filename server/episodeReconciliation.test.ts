import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { RevisionConflict } from './lib/conflicts.ts';

const project = 'proj_ternfall_01', legacyId = 'S01E002';
async function seed(root: string) {
  const store = new StorageEngine(root); await store.init();
  const pilot = (await store.getEpisode(project, 'S01E001'))!;
  const legacy = { ...structuredClone(pilot), id: legacyId, dbId: 'legacy_second', seriesId: `series_${project}`, revision: 0, workingTitle: 'Unmodified historical draft' };
  await store.atomicWriteJson(path.join(root, 'projects', project, 'episodes.json'), [pilot, legacy]);
  return { store, legacy: (await store.getEpisode(project, legacyId))! };
}
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-series-reconcile-'));
  const result = await seed(root);
  t.after(async () => { result.store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, ...result };
}

test('preview is non-mutating; explicit apply and guarded undo take metadata backups and record events', async t => {
  const { root, store, legacy } = await fixture(t);
  const preview = await store.previewEpisodeSeriesReconciliation(project, legacyId);
  assert.equal(preview.status, 'eligible'); assert.equal(preview.revision, 0);
  assert.equal(preview.fromSeriesId, `series_${project}`); assert.equal(preview.toSeriesId, 'series_ternfall_01');
  assert.deepEqual(preview.history, []); assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  assert.deepEqual(await store.getEpisode(project, legacyId), legacy);
  await assert.rejects(store.reconcileEpisodeSeries(project, legacyId, { expectedRevision: 0, fromSeriesId: 'wrong', toSeriesId: preview.toSeriesId }), /scope changed/);
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  const result = await store.reconcileEpisodeSeries(project, legacyId, { expectedRevision: 0, fromSeriesId: preview.fromSeriesId, toSeriesId: preview.toSeriesId });
  assert.equal(result.episode.seriesId, preview.toSeriesId); assert.equal(result.episode.revision, 1);
  assert.equal(result.backup.includesMedia, false); assert.ok((await fs.stat(result.backup.path)).isFile());
  const { seriesId: _beforeSeries, revision: _beforeRevision, updatedAt: _beforeTime, ...beforeRest } = legacy;
  const { seriesId: _afterSeries, revision: _afterRevision, updatedAt: _afterTime, ...afterRest } = result.episode;
  assert.deepEqual(afterRest, beforeRest);
  const backup = new DatabaseSync(result.backup.path, { readOnly: true });
  try {
    const row = backup.prepare('SELECT value FROM documents WHERE key=?').get(path.join('projects', project, 'episodes.json')) as { value: string };
    assert.equal(JSON.parse(row.value).find((episode: any) => episode.id === legacyId).seriesId, preview.fromSeriesId);
  } finally { backup.close(); }
  const after = await store.previewEpisodeSeriesReconciliation(project, legacyId);
  assert.equal(after.status, 'already_canonical'); assert.deepEqual(after.history, [result.event]);
  await assert.rejects(store.reconcileEpisodeSeries(project, legacyId, { expectedRevision: 0, fromSeriesId: preview.fromSeriesId, toSeriesId: preview.toSeriesId }), /not eligible/);
  const undone = await store.undoEpisodeSeriesReconciliation(project, legacyId, { expectedRevision: 1, eventId: result.event.id });
  assert.equal(undone.episode.seriesId, preview.fromSeriesId); assert.equal(undone.episode.revision, 2);
  assert.equal(undone.event.reversesEventId, result.event.id); assert.equal(undone.backup.includesMedia, false);
  assert.equal((await fs.readdir(path.join(root, 'backups'))).length, 2);
  assert.deepEqual((await store.previewEpisodeSeriesReconciliation(project, legacyId)).history, [result.event, undone.event]);
  await assert.rejects(store.undoEpisodeSeriesReconciliation(project, legacyId, { expectedRevision: 2, eventId: result.event.id }), /already undone/);
});

test('unknown series associations and subsequent episode edits require manual review', async t => {
  const { root, store, legacy } = await fixture(t);
  const before = await store.listEpisodes(project);
  await store.atomicWriteJson(path.join(root, 'projects', project, 'episodes.json'), [before[0], { ...legacy, seriesId: 'unknown_series' }]);
  const unknown = await store.previewEpisodeSeriesReconciliation(project, legacyId);
  assert.equal(unknown.status, 'manual_review_required');
  await assert.rejects(store.reconcileEpisodeSeries(project, legacyId, { expectedRevision: 0, fromSeriesId: 'unknown_series', toSeriesId: unknown.toSeriesId }), /not eligible/);
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  await store.atomicWriteJson(path.join(root, 'projects', project, 'episodes.json'), before);
  const preview = await store.previewEpisodeSeriesReconciliation(project, legacyId);
  const applied = await store.reconcileEpisodeSeries(project, legacyId, { expectedRevision: 0, fromSeriesId: preview.fromSeriesId, toSeriesId: preview.toSeriesId });
  const edit = { ...applied.episode, workingTitle: 'Later editorial edit' }; await store.saveEpisode(project, edit, true);
  await assert.rejects(store.undoEpisodeSeriesReconciliation(project, legacyId, { expectedRevision: edit.revision!, eventId: applied.event.id }), /manual review/);
  assert.equal((await store.getEpisode(project, legacyId))?.workingTitle, 'Later editorial edit');
  assert.equal((await fs.readdir(path.join(root, 'backups'))).length, 1);
});

test('concurrent edit after backup rejects reconciliation and preserves the edit', async t => {
  const { root, store } = await fixture(t); const preview = await store.previewEpisodeSeriesReconciliation(project, legacyId);
  const backup = store.backupMetadata.bind(store);
  t.mock.method(store, 'backupMetadata', async () => {
    const saved = await backup();
    const edited = (await store.getEpisode(project, legacyId))!; edited.workingTitle = 'Concurrent draft';
    await store.saveEpisode(project, edited, true);
    return saved;
  });
  await assert.rejects(store.reconcileEpisodeSeries(project, legacyId, { expectedRevision: 0, fromSeriesId: preview.fromSeriesId, toSeriesId: preview.toSeriesId }), RevisionConflict);
  const current = (await store.getEpisode(project, legacyId))!;
  assert.equal(current.workingTitle, 'Concurrent draft'); assert.equal(current.seriesId, preview.fromSeriesId);
  assert.deepEqual((await store.previewEpisodeSeriesReconciliation(project, legacyId)).history, []);
  assert.equal((await fs.readdir(path.join(root, 'backups'))).length, 1);
});

test('history write failure rolls back episode change and leaves the pre-operation backup', async t => {
  const { root, store, legacy } = await fixture(t); const preview = await store.previewEpisodeSeriesReconciliation(project, legacyId);
  const original = DocumentStore.prototype.write;
  const mocked = t.mock.method(DocumentStore.prototype, 'write', function (this: DocumentStore, file: string, value: unknown) {
    if (file.endsWith('episode_series_reconciliations.json')) throw new Error('fixture history failure');
    return original.call(this, file, value);
  });
  await assert.rejects(store.reconcileEpisodeSeries(project, legacyId, { expectedRevision: 0, fromSeriesId: preview.fromSeriesId, toSeriesId: preview.toSeriesId }), /fixture history failure.*backup created/i);
  mocked.mock.restore();
  assert.deepEqual(await store.getEpisode(project, legacyId), legacy);
  assert.deepEqual((await store.previewEpisodeSeriesReconciliation(project, legacyId)).history, []);
  assert.equal((await fs.readdir(path.join(root, 'backups'))).length, 1);
});

test('typed CLI requires explicit preview tokens to apply and undo a reconciliation', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-series-cli-')); const root = path.join(cwd, 'data', 'production_root');
  const seeded = await seed(root); seeded.store.close();
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  const run = async (...args: string[]) => JSON.parse((await promisify(execFile)(process.execPath, ['--import', loader, cli, ...args, '--json'], { cwd, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } })).stdout).data;
  const preview = await run('episode', 'reconcile-series', legacyId);
  assert.equal(preview.status, 'eligible');
  await assert.rejects(run('episode', 'reconcile-series', legacyId, '--apply'));
  const applied = await run('episode', 'reconcile-series', legacyId, '--apply', '--expected-revision', String(preview.revision), '--from-series', preview.fromSeriesId, '--to-series', preview.toSeriesId);
  assert.equal(applied.episode.seriesId, preview.toSeriesId);
  await assert.rejects(run('episode', 'undo-series-reconciliation', legacyId, '--event', applied.event.id, '--expected-revision', '1'));
  const undone = await run('episode', 'undo-series-reconciliation', legacyId, '--apply', '--event', applied.event.id, '--expected-revision', '1');
  assert.equal(undone.episode.seriesId, preview.fromSeriesId);
});
