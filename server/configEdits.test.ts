import { DATA_NOTICE_VERSION } from '../src/core/dataNotice.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { StorageEngine } from './storage.ts';
import { RevisionConflict } from './lib/conflicts.ts';
import { configEditHandler } from './configEdits.ts';
const project = 'proj_ternfall_01';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-config-test-'));
  const first = new StorageEngine(root), second = new StorageEngine(root); await first.init();
  t.after(async () => { first.close(); second.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, first, second };
}
async function api(t: any, storage: StorageEngine) {
  const app = express(); app.use(express.json());
  app.put('/settings', configEditHandler(storage, 'settings'));
  app.put('/projects/:id/series', configEditHandler(storage, 'series'));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
const put = (url: string, body: unknown) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('settings stale writes conflict across storage instances and successful saves advance tokens', async t => {
  const { first, second } = await fixture(t);
  const a = await first.getSettings(), b = await second.getSettings(); assert.equal(a.revision, 0);
  const saved = await first.updateSettings({ revision: a.revision, productionTimezone: 'Asia/Kolkata' });
  assert.equal(saved.revision, 1);
  await assert.rejects(second.updateSettings({ revision: b.revision, dataNoticeAccepted: true, dataNoticeVersion: DATA_NOTICE_VERSION }), RevisionConflict);
  await assert.rejects(second.updateSettings({ dataNoticeAccepted: true, dataNoticeVersion: DATA_NOTICE_VERSION }), RevisionConflict);
  const latest = await second.updateSettings({ revision: 1, dataNoticeAccepted: true, dataNoticeVersion: DATA_NOTICE_VERSION });
  assert.equal(latest.revision, 2); assert.equal(latest.productionTimezone, 'Asia/Kolkata');
  assert.deepEqual(latest.budgetCaps, a.budgetCaps); assert.equal(b.revision, 0);
});

test('series stale writes conflict; immutable identity and project boundaries are retained', async t => {
  const { first, second } = await fixture(t);
  const a = (await first.getSeriesBible(project))!, b = (await second.getSeriesBible(project))!;
  assert.equal(a.revision, 0);
  const saved = await first.updateSeriesBible(project, { revision: a.revision, seriesTitle: 'Original fixture series' });
  assert.equal(saved?.revision, 1);
  await assert.rejects(second.updateSeriesBible(project, { ...b, logline: 'Stale text' }), RevisionConflict);
  for (const update of [{ id: 'replaced' }, { projectId: 'other_project' }, { createdAt: 'replaced' }]) {
    await assert.rejects(first.updateSeriesBible(project, { ...update, revision: 1 }), /immutable/);
  }
  assert.equal(await first.updateSeriesBible('missing_project', { revision: 0, seriesTitle: 'Unknown' }), null);
  const current = (await second.getSeriesBible(project))!;
  assert.equal(current.seriesTitle, 'Original fixture series'); assert.equal(current.id, a.id); assert.equal(current.revision, 1);
});

test('configuration handlers return structured 409 conflicts and fresh revisions', async t => {
  const { first } = await fixture(t); const base = await api(t, first);
  for (const [url, payload] of [[`${base}/settings`, { productionTimezone: 'UTC' }], [`${base}/projects/${project}/series`, { seriesTitle: 'API fixture title' }]] as const) {
    const one = await put(url, { ...payload, revision: 0 }); assert.equal(one.status, 200);
    assert.equal((await one.json()).data.revision, 1);
    const stale = await put(url, { ...payload, revision: 0 }); assert.equal(stale.status, 409);
    const body = await stale.json(); assert.equal(body.code, 'REVISION_CONFLICT'); assert.equal(body.currentRevision, 1);
    const two = await put(url, { ...payload, revision: 1 }); assert.equal(two.status, 200);
    assert.equal((await two.json()).data.revision, 2);
  }
  assert.equal((await put(`${base}/projects/missing_project/series`, { seriesTitle: 'No record' })).status, 404);
});

test('configuration rejects malformed revisions, protected settings and unsupported series fields without writes', async t => {
  const { first } = await fixture(t); const base = await api(t, first);
  for (const revision of [-1, 1.5, '0', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await put(`${base}/settings`, { revision, productionTimezone: 'UTC' })).status, 400);
    assert.equal((await put(`${base}/projects/${project}/series`, { revision, seriesTitle: 'Invalid' })).status, 400);
  }
  for (const payload of [{ budgetCaps: { perRunCapUsd: 999 } }, { productionTimezone: 'Not/AZone' }, { dataNoticeAccepted: 'yes' }, [], null]) {
    assert.equal((await put(`${base}/settings`, payload)).status, 400);
  }
  for (const payload of [{ surprise: true }, { targetWpm: 0 }, { rules: 'not an array' }, { visualBible: [] }, { seriesTitle: '' }, [], null]) {
    assert.equal((await put(`${base}/projects/${project}/series`, payload)).status, 400);
  }
  assert.equal((await first.getSettings()).revision, 0);
  assert.equal((await first.getSeriesBible(project))?.revision, 0);
});


test('simultaneous processes produce one winner and one conflict for each shared configuration record', async t => {
  const { root, first } = await fixture(t);
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  for (const kind of ['settings', 'series']) {
    const results = await Promise.all([0, 1].map(async () => {
      const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/config-race-worker.ts'], {
        cwd: process.cwd(), env: { ...process.env, TEST_CONFIG_ROOT: root, TEST_CONFIG_KIND: kind },
      });
      return JSON.parse(stdout.trim());
    }));
    assert.equal(results.filter(result => result.ok).length, 1);
    const loser = results.find(result => !result.ok);
    assert.equal(loser.code, 'REVISION_CONFLICT'); assert.equal(loser.currentRevision, 1);
  }
  assert.equal((await first.getSettings()).revision, 1);
  assert.equal((await first.getSeriesBible(project))?.revision, 1);
});
