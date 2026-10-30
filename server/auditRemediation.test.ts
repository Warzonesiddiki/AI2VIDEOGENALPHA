import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';
import { DATA_NOTICE_VERSION } from '../src/core/dataNotice.ts';
import { createGoogleFlowPlan } from '../src/core/flow.ts';

const project = 'proj_ternfall_01';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-audit-fix-test-'));
  const store = new StorageEngine(root); await store.init();
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store };
}

test('fresh defaults assert neither notice acceptance nor checked provider capabilities', async t => {
  const { store } = await fixture(t); const settings = await store.getSettings();
  assert.equal(settings.dataNoticeAccepted, false); assert.equal(settings.noticeAcceptedDate, undefined);
  assert.equal(settings.dataNoticeVersion, DATA_NOTICE_VERSION); assert.deepEqual(settings.providerConfigs, {});
});

test('legacy acceptance and provider checked dates are demoted without rewriting metadata', async t => {
  const { root, store } = await fixture(t);
  const file = path.join(root, 'settings.json');
  const original = { ...(await store.getSettings()), dataNoticeAccepted: true, noticeAcceptedDate: '2026-10-29', providerConfigs: { sample: { provider: 'unverified_fixture', checkedDate: '2026-10-29' } } };
  await store.atomicWriteJson(file, original);
  const settings = await store.getSettings();
  assert.equal(settings.dataNoticeAccepted, false); assert.equal(settings.noticeAcceptedDate, undefined);
  assert.equal((settings.providerConfigs as any).sample.checkedDate, undefined); assert.equal((settings.providerConfigs as any).sample.verificationStatus, 'unverified');
  assert.deepEqual(await store.readJson(file, {}), original);
});

test('notice acknowledgement requires current version, persists history and can be withdrawn', async t => {
  const { root, store } = await fixture(t);
  await assert.rejects(store.updateSettings({ revision: 0, dataNoticeAccepted: true }), /current dataNoticeVersion/);
  await assert.rejects(store.updateSettings({ revision: 0, dataNoticeAccepted: true, dataNoticeVersion: 'old' }), /current data notice/);
  const accepted = await store.updateSettings({ revision: 0, dataNoticeAccepted: true, dataNoticeVersion: DATA_NOTICE_VERSION });
  assert.equal(accepted.dataNoticeAccepted, true); assert.ok(Number.isFinite(Date.parse(String(accepted.noticeAcceptedDate))));
  const file = path.join(root, 'data_notice_events.json');
  const events = await store.readJson<any[]>(file, []); assert.equal(events.length, 1); assert.equal(events[0].settingsRevision, 1);
  await assert.rejects(store.updateSettings({ revision: 0, dataNoticeAccepted: false }));
  assert.equal((await store.readJson<any[]>(file, [])).length, 1);
  store.close(); assert.equal((await store.getSettings()).dataNoticeAccepted, true);
  const withdrawn = await store.updateSettings({ revision: 1, dataNoticeAccepted: false });
  assert.equal(withdrawn.dataNoticeAccepted, false); assert.equal(withdrawn.noticeAcceptedDate, undefined);
  const history = await store.readJson<any[]>(file, []); assert.equal(history.length, 2); assert.equal(history[0].accepted, true); assert.equal(history[1].accepted, false);
});

test('notice history and settings roll back together when settings persistence fails', async t => {
  const { root, store } = await fixture(t); const original = DocumentStore.prototype.write;
  const mocked = t.mock.method(DocumentStore.prototype, 'write', function (this: InstanceType<typeof DocumentStore>, file: string, data: unknown) {
    if (file === path.join(root, 'settings.json')) throw new Error('fixture settings failure');
    return original.call(this, file, data);
  });
  try { await assert.rejects(store.updateSettings({ revision: 0, dataNoticeAccepted: true, dataNoticeVersion: DATA_NOTICE_VERSION }), /fixture settings failure/); }
  finally { mocked.mock.restore(); }
  assert.equal((await store.getSettings()).dataNoticeAccepted, false); assert.equal((await store.getSettings()).revision, 0);
  assert.deepEqual(await store.readJson(path.join(root, 'data_notice_events.json'), []), []);
});

test('notice timestamps/history cannot be supplied through the settings write boundary', async t => {
  const { store } = await fixture(t);
  for (const patch of [{ noticeAcceptedDate: '2020-01-01' }, { dataNoticeEvents: [] }, { providerConfigs: { verified: true } }]) await assert.rejects(store.updateSettings({ revision: 0, ...patch }), /cannot be changed/);
});

async function holdFixture(t: any) {
  const data = await fixture(t);
  await data.store.saveSpendGrant(project, { approvalId: 'fixture_grant', issuedBy: 'ISOLATED_TEST_ONLY', projectId: project, episodeId: 'all', maxBudgetUsd: 100, actualSpentUsd: 0, currency: 'USD', allowedProviders: ['fixture_provider'], expiresAt: new Date(Date.now() + 60_000).toISOString(), isRevoked: false, createdAt: new Date().toISOString() });
  const request = { projectId: project, episodeId: 'S01E001', runId: 'fixture_run', provider: 'fixture_provider', approvalId: 'fixture_grant', idempotencyKey: 'fixture_hold', maxCostUsd: 2 };
  const row = await data.store.reserveSpend(request);
  const settings = await data.store.getSettings();
  const caps = async (changes: Record<string, unknown>) => data.store.atomicWriteJson(path.join(data.root, 'settings.json'), { ...settings, budgetCaps: { currency: 'USD', perRunCapUsd: 25, perEpisodeCapUsd: 85, monthlyCapUsd: 350, ...changes } });
  return { ...data, request, row, caps };
}

for (const [field, error] of [['perRunCapUsd', /Per-run/], ['perEpisodeCapUsd', /Per-episode/], ['monthlyCapUsd', /Monthly/]] as const) {
  test(`dispatch rejects lowered ${field}, retains hold and adds no event`, async t => {
    const { store, row, caps } = await holdFixture(t);
    await caps({ [field]: 0 });
    await assert.rejects(store.transitionSpend(project, row.reservationId, 'dispatched'), error);
    assert.equal((await store.listSpendReservations(project))[0].state, 'reserved');
    assert.equal((await store.listSpendEvents(project)).length, 1);
    await store.transitionSpend(project, row.reservationId, 'released', 'Fixture cancelled before network dispatch');
  });
}

test('dispatch counts an existing hold once and rejects invalid persisted cap policy', async t => {
  const { store, row, caps } = await holdFixture(t);
  for (const invalid of [{ currency: 'INR' }, { perRunCapUsd: null }, { perRunCapUsd: -1 }]) {
    await caps(invalid); await assert.rejects(store.transitionSpend(project, row.reservationId, 'dispatched'));
  }
  await caps({ perRunCapUsd: 2, perEpisodeCapUsd: 2, monthlyCapUsd: 2 });
  assert.equal((await store.transitionSpend(project, row.reservationId, 'dispatched')).state, 'dispatched');
});

test('root monthly policy counts other projects, uncertain holds and undated historic spending', async t => {
  const { root, store, row, request, caps } = await holdFixture(t);
  await store.transitionSpend(project, row.reservationId, 'dispatched');
  await store.transitionSpend(project, row.reservationId, 'unknown');
  const other = await store.createProject('Other original fixture', '');
  const baseGrant = (await store.getSpendGrant(project, 'fixture_grant'))!;
  await store.saveSpendGrant(other.id, { ...baseGrant, approvalId: 'other_fixture', projectId: other.id, actualSpentUsd: 1 });
  await caps({ monthlyCapUsd: 4 });
  const another = { ...request, projectId: other.id, approvalId: 'other_fixture', idempotencyKey: 'other_hold', maxCostUsd: 2 };
  await assert.rejects(store.reserveSpend(another), /Monthly/); // 2 unknown + 1 historic + 2 requested
  await store.reserveSpend({ ...another, maxCostUsd: 1 }); // Exact 4, project run/episode scope stays distinct
  const ledger = await store.readJson<any>(path.join(root, 'spend_ledger.json'), {});
  assert.equal(ledger.reservations[0].state, 'unknown');
});

test('episode and plan writes require real project/episode identity and leave no ghost records', async t => {
  const { root, store } = await fixture(t); const source = (await store.getEpisode(project, 'S01E001'))!;
  const draft = { ...source, projectId: 'missing_project', revision: 0 };
  await assert.rejects(store.saveEpisode('missing_project', draft), /project not found/);
  const plan = createGoogleFlowPlan('S01E001', 'Original fixture', 1, 24, 'dense_24fps', 'missing_project');
  await assert.rejects(store.saveGoogleFlowPlan('missing_project', plan), /project not found/);
  assert.equal(await store.getProject('missing_project'), null); assert.deepEqual(await store.listEpisodes('missing_project'), []); assert.equal(await store.getGoogleFlowPlan('missing_project', 'S01E001'), null);
  await assert.rejects(fs.stat(path.join(root, 'projects', 'missing_project')), { code: 'ENOENT' });
  const other = await store.createProject('Empty original fixture', '');
  const noEpisode = createGoogleFlowPlan('S01E001', 'Original fixture', 1, 24, 'dense_24fps', other.id);
  await assert.rejects(store.saveGoogleFlowPlan(other.id, noEpisode), /episode not found/);
  assert.equal(noEpisode.revision, undefined); assert.equal(draft.revision, 0);
  await store.saveEpisode(other.id, { ...source, projectId: other.id, seriesId: other.activeSeriesId, revision: 0 });
  noEpisode.sourceEpisodeRevision = (await store.getEpisode(other.id, noEpisode.episodeId))!.revision ?? 0;
  await store.saveGoogleFlowPlan(other.id, noEpisode); assert.equal(noEpisode.revision, 1);
});

test('UTC monthly policy excludes old committed charges but retains old uncertain exposure', async t => {
  const { root, store, row, request, caps } = await holdFixture(t);
  await store.transitionSpend(project, row.reservationId, 'dispatched');
  await store.transitionSpend(project, row.reservationId, 'committed', 'Fixture receipt', 2);
  const file = path.join(root, 'spend_ledger.json');
  const ledger = await store.readJson<any>(file, {}); ledger.reservations[0].chargedAt = '2000-01-01T00:00:00.000Z';
  await store.atomicWriteJson(file, ledger); await caps({ monthlyCapUsd: 2 });
  const second = await store.reserveSpend({ ...request, idempotencyKey: 'second_fixture' });
  await store.transitionSpend(project, second.reservationId, 'dispatched');
  await store.transitionSpend(project, second.reservationId, 'unknown');
  const old = await store.readJson<any>(file, {}); old.reservations[1].createdAt = '2000-01-01T00:00:00.000Z'; await store.atomicWriteJson(file, old);
  await assert.rejects(store.reserveSpend({ ...request, idempotencyKey: 'third_fixture', maxCostUsd: 1 }), /Monthly/);
});

test('independent dispatch processes reread lowered caps and never release rejected holds', async t => {
  const { root, store, row, request, caps } = await holdFixture(t);
  const second = await store.reserveSpend({ ...request, idempotencyKey: 'second_fixture' });
  await caps({ monthlyCapUsd: 0 });
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const results = await Promise.all([row, second].map(async hold => {
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/dispatch-cap-worker.ts'], {
      cwd: process.cwd(), env: { ...process.env, TEST_CAP_ROOT: root, TEST_CAP_RESERVATION: hold.reservationId },
    });
    return JSON.parse(stdout.trim());
  }));
  assert.equal(results.every(result => !result.ok), true);
  assert.equal((await store.listSpendReservations(project)).every(hold => hold.state === 'reserved'), true);
  assert.equal((await store.listSpendEvents(project)).length, 2);
});

test('doctor probes configured media binaries and labels provider prices as unverified', async t => {
  const { root, store } = await fixture(t);
  const executable = path.join(root, 'fixture-media');
  await fs.writeFile(executable, '#!/bin/sh\nprintf "fixture-media version 1\\n"\n', { mode: 0o700 });
  const oldFfmpeg = process.env.FFMPEG_PATH, oldFfprobe = process.env.FFPROBE_PATH;
  process.env.FFMPEG_PATH = executable; process.env.FFPROBE_PATH = executable;
  t.after(() => {
    if (oldFfmpeg === undefined) delete process.env.FFMPEG_PATH; else process.env.FFMPEG_PATH = oldFfmpeg;
    if (oldFfprobe === undefined) delete process.env.FFPROBE_PATH; else process.env.FFPROBE_PATH = oldFfprobe;
  });
  const result = await store.runDoctorDiagnostics();
  assert.equal(result.ffmpeg.installed, true); assert.equal(result.ffmpeg.ffprobeAvailable, true);
  assert.match(result.ffmpeg.version!, /^fixture-media version 1/);
  assert.ok(result.providers.every(provider => /unverified|disabled|not implemented/i.test(provider.estimatedCostBasis)));
  assert.equal(result.youtubeOAuth.tokenProtected, false);
});

test('doctor write probe never overwrites a predictable preexisting symlink target', async t => {
  const { root, store } = await fixture(t);
  const sentinel = path.join(root, 'protected-fixture.txt');
  await fs.writeFile(sentinel, 'preserve this fixture');
  const oldProbe = path.join(root, '.test_write_123456');
  try { await fs.symlink(sentinel, oldProbe); }
  catch (error: any) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation requires Windows privileges'); return; }
    throw error;
  }
  const clock = t.mock.method(Date, 'now', () => 123456);
  try { await store.runDoctorDiagnostics(); } finally { clock.mock.restore(); }
  assert.equal(await fs.readFile(sentinel, 'utf8'), 'preserve this fixture');
  assert.equal(await fs.readlink(oldProbe), sentinel);
});

test('concurrent doctor probes use independent temporary files and clean them up', async t => {
  const { root, store } = await fixture(t);
  const clock = t.mock.method(Date, 'now', () => 123456);
  let results;
  try { results = await Promise.all(Array.from({ length: 6 }, () => store.runDoctorDiagnostics())); }
  finally { clock.mock.restore(); }
  assert.ok(results.every(result => result.storage.isWritable));
  assert.equal((await fs.readdir(root)).filter(name => name.startsWith('.doctor-probe-') || name.startsWith('.test_write_')).length, 0);
});

test('doctor reports temporary-probe cleanup failure without deleting unrelated files', async t => {
  const { root, store } = await fixture(t);
  const unlink = fs.unlink;
  const mocked = t.mock.method(fs, 'unlink', async (file: Parameters<typeof fs.unlink>[0]) => {
    if (String(file).includes('.doctor-probe-')) throw Object.assign(new Error('fixture cleanup failure'), { code: 'EACCES' });
    return unlink(file);
  });
  let result;
  try { result = await store.runDoctorDiagnostics(); } finally { mocked.mock.restore(); }
  assert.equal(result.storage.isWritable, true);
  assert.ok(result.remediationSteps.some(message => /could not remove.*temporary write probe/i.test(message)));
  const remaining = (await fs.readdir(root)).filter(name => name.startsWith('.doctor-probe-'));
  assert.equal(remaining.length, 1);
  await fs.unlink(path.join(root, remaining[0]));
});
