import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import type { ReserveSpend } from './lib/spendLedger.ts';
const exec = promisify(execFile);

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-transaction-test-'));
  const stores: StorageEngine[] = [];
  const open = () => { const store = new StorageEngine(root); stores.push(store); return store; };
  t.after(async () => { stores.forEach(store => store.close()); await fs.rm(root, { force: true, recursive: true }); });
  return { root, open };
}
function child(root: string, work: string, request?: ReserveSpend) {
  return exec(process.execPath, ['--import', 'tsx', 'server/fixtures/storage-worker.ts'], {
    cwd: process.cwd(), env: { ...process.env, TEST_STORAGE_ROOT: root, TEST_WORK: work, TEST_REQUEST: JSON.stringify(request) },
  });
}
const project = 'proj_ternfall_01';
const request = (key: string, amount = 6): ReserveSpend => ({ projectId: project, episodeId: 'S01E001', runId: 'run_test', provider: 'fixture_provider', approvalId: 'fixture_grant', idempotencyKey: key, maxCostUsd: amount });
async function ledgerFixture(t: any) {
  const fixtureData = await fixture(t); const store = fixtureData.open(); await store.init();
  // Synthetic approval in an isolated test root, never an operator production grant.
  await store.saveSpendGrant(project, { approvalId: 'fixture_grant', issuedBy: 'UNIT_TEST_ONLY', projectId: project, episodeId: 'S01E001', maxBudgetUsd: 10, actualSpentUsd: 0, currency: 'USD', allowedProviders: ['fixture_provider'], expiresAt: new Date(Date.now() + 60000).toISOString(), isRevoked: false, createdAt: new Date().toISOString() });
  return { ...fixtureData, store };
}

test('concurrent processes preserve all independent episode saves and fresh initialization', async t => {
  const { root, open } = await fixture(t);
  await Promise.all(['a', 'b', 'c'].map(work => child(root, work)));
  const episodes = await open().listEpisodes(project);
  assert.equal(episodes.length, 31);
  assert.equal(new Set(episodes.map(item => item.id)).size, 31);
});

test('legacy import preserves files, SQLite is authoritative, and restart preserves changes', async t => {
  const { root, open } = await fixture(t);
  const legacy = path.join(root, 'legacy.json');
  await fs.writeFile(legacy, '{"value":1}');
  const store = open(); assert.deepEqual(await store.readJson(legacy, {}), { value: 1 });
  await store.atomicWriteJson(legacy, { value: 2 });
  assert.equal(await fs.readFile(legacy, 'utf8'), '{"value":1}');
  await fs.writeFile(legacy, '{broken');
  store.close();
  assert.deepEqual(await open().readJson(legacy, {}), { value: 2 });
});

test('transaction rollback and process death never commit partial writes', async t => {
  const { root } = await fixture(t);
  const docs = new DocumentStore(root); t.after(() => docs.close());
  const file = path.join(root, 'crash.json'); docs.write(file, { changed: false });
  assert.throws(() => docs.transaction(() => { docs.write(file, { changed: true }); throw new Error('abort'); }));
  assert.deepEqual(docs.read(file, {}), { changed: false });
  await assert.rejects(child(root, 'crash'), (error: any) => error.code === 17);
  assert.deepEqual(docs.read(file, {}), { changed: false });
});

test('metadata backup is a consistent database snapshot, not a media archive', async t => {
  const { root, open } = await fixture(t); const store = open(); await store.init();
  const snapshot = await store.backupMetadata(); assert.equal(snapshot.includesMedia, false);
  assert.ok(snapshot.path.startsWith(path.join(root, 'backups')));
  const backupRoot = path.join(root, 'restore-test'); await fs.mkdir(backupRoot);
  await fs.copyFile(snapshot.path, path.join(backupRoot, 'studio.sqlite'));
  const restored = new StorageEngine(backupRoot);
  try {
    // Read snapshot through the storage API; no direct database inspection.
    assert.equal((await restored.readJson<any[]>(path.join(backupRoot, 'projects', project, 'episodes.json'), [])).length, 1);
  } finally { restored.close(); }
});

test('reservations across two processes cannot oversubscribe one grant', async t => {
  const { root, store } = await ledgerFixture(t);
  const results = await Promise.allSettled([child(root, 'reserve', request('key_a')), child(root, 'reserve', request('key_b'))]);
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal((await store.listSpendReservations(project)).length, 1);
});

test('reservation replay is idempotent and conflicts are rejected', async t => {
  const { store } = await ledgerFixture(t);
  const first = await store.reserveSpend(request('key_a', 2));
  assert.equal((await store.reserveSpend(request('key_a', 2))).reservationId, first.reservationId);
  await assert.rejects(store.reserveSpend(request('key_a', 3)), /Idempotency/);
  assert.equal((await store.listSpendEvents(project)).length, 1);
});

test('uncertain external effects retain budget through restart until evidence-backed reconciliation', async t => {
  const { store, open } = await ledgerFixture(t);
  const row = await store.reserveSpend(request('key_a', 6));
  await store.transitionSpend(project, row.reservationId, 'dispatched');
  await assert.rejects(store.transitionSpend(project, row.reservationId, 'dispatched'), /already dispatched/);
  await store.transitionSpend(project, row.reservationId, 'unknown');
  store.close(); const reopened = open();
  await assert.rejects(reopened.reserveSpend(request('key_b', 6)), /exhausted/);
  await assert.rejects(reopened.transitionSpend(project, row.reservationId, 'released'), /evidence/);
  await reopened.transitionSpend(project, row.reservationId, 'released', 'Fixture provider confirmed no charge');
  await reopened.reserveSpend(request('key_b', 6));
});

test('charge commit and grant accounting are atomic and replay-safe', async t => {
  const { store } = await ledgerFixture(t);
  const row = await store.reserveSpend(request('key_a', 6));
  await store.transitionSpend(project, row.reservationId, 'dispatched');
  await store.transitionSpend(project, row.reservationId, 'committed', 'Fixture receipt', 4.123456);
  await store.transitionSpend(project, row.reservationId, 'committed', 'Fixture receipt', 4.123456);
  assert.equal((await store.getSpendGrant(project, 'fixture_grant'))?.actualSpentUsd, 4.123456);
  await assert.rejects(store.transitionSpend(project, row.reservationId, 'committed', 'Different receipt', 3), /Conflicting/);
  await assert.rejects(store.transitionSpend(project, row.reservationId, 'released', 'no'), /terminal/);
  assert.equal((await store.listSpendEvents(project)).length, 3);
});

test('ledger rejects invalid amounts, scope, providers and charges above the ceiling', async t => {
  const { store } = await ledgerFixture(t);
  for (const value of [NaN, Infinity, -1, 0, 0.0000001]) await assert.rejects(store.reserveSpend(request('bad', value)));
  await assert.rejects(store.reserveSpend({ ...request('scope'), episodeId: 'other' }), /scope/);
  await assert.rejects(store.reserveSpend({ ...request('provider'), provider: 'other' }), /Provider/);
  const row = await store.reserveSpend(request('key_a', 1));
  await store.transitionSpend(project, row.reservationId, 'dispatched');
  await assert.rejects(store.transitionSpend(project, row.reservationId, 'committed', 'Fixture overage', 2), /exceeds reserved/);
  assert.equal((await store.getSpendGrant(project, 'fixture_grant'))?.actualSpentUsd, 0);
  assert.equal((await store.listSpendReservations(project))[0].state, 'dispatched');
});

test('persisted per-run, episode and monthly caps include outstanding reservations', async t => {
  const { root, store } = await ledgerFixture(t);
  const grant = (await store.getSpendGrant(project, 'fixture_grant'))!;
  await store.saveSpendGrant(project, { ...grant, maxBudgetUsd: 100 });
  await store.atomicWriteJson(path.join(root, 'settings.json'), { budgetCaps: { currency: 'USD', perRunCapUsd: 10, perEpisodeCapUsd: 20, monthlyCapUsd: 30 } });
  await store.reserveSpend(request('first', 6));
  await assert.rejects(store.reserveSpend(request('run_limit', 5)), /Per-run/);
  await store.reserveSpend({ ...request('second', 10), runId: 'run_second' });
  await assert.rejects(store.reserveSpend({ ...request('episode_limit', 5), runId: 'run_third' }), /Per-episode/);
  // Existing grant can be used for any episode only in this isolated test fixture.
  await store.saveSpendGrant(project, { ...grant, episodeId: 'all', maxBudgetUsd: 100 });
  await store.reserveSpend({ ...request('third', 10), runId: 'run_third', episodeId: 'second_episode' });
  await assert.rejects(store.reserveSpend({ ...request('month_limit', 5), runId: 'run_fourth', episodeId: 'third_episode' }), /Monthly/);
});

test('revocation between reservation and dispatch prevents provider dispatch', async t => {
  const { store } = await ledgerFixture(t);
  const row = await store.reserveSpend(request('pending', 1));
  const grant = (await store.getSpendGrant(project, 'fixture_grant'))!;
  await store.saveSpendGrant(project, { ...grant, isRevoked: true });
  await assert.rejects(store.transitionSpend(project, row.reservationId, 'dispatched'), /revoked/);
  assert.equal((await store.listSpendReservations(project))[0].state, 'reserved');
  await store.transitionSpend(project, row.reservationId, 'released', 'Cancelled before dispatch');
});

test('failed accounting commit rolls back both grant spending and reservation state', async t => {
  const { root, store } = await ledgerFixture(t);
  const row = await store.reserveSpend(request('commit_failure', 2));
  await store.transitionSpend(project, row.reservationId, 'dispatched');
  class FailureStore extends DocumentStore {
    override write<T>(file: string, value: T) {
      if (file.endsWith('spend_ledger.json')) throw new Error('Simulated write failure');
      return super.write(file, value);
    }
  }
  const docs = new FailureStore(root); t.after(() => docs.close());
  const { SpendLedger } = await import('./lib/spendLedger.ts');
  assert.throws(() => new SpendLedger(root, docs).transition(project, row.reservationId, 'committed', 'Fixture receipt', 1), /write failure/);
  assert.equal((await store.getSpendGrant(project, 'fixture_grant'))?.actualSpentUsd, 0);
  assert.equal((await store.listSpendReservations(project))[0].state, 'dispatched');
});
