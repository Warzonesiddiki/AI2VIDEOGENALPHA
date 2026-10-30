import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import express from 'express';
import { StorageEngine } from './storage.ts';
import { flowPlanRouter } from './flowRoutes.ts';
import { episodeEditHandler } from './episodeEdits.ts';
import { verifyFlowBatch } from './flowVerification.ts';
import { createGoogleFlowPlan, computeFlowCheckpoint } from '../src/core/flow.ts';
import { EpisodeSourceConflict, RevisionConflict } from './lib/conflicts.ts';

const project = 'proj_ternfall_01', episodeId = 'S01E001';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-flow-test-'));
  const first = new StorageEngine(root), second = new StorageEngine(root); await first.init();
  t.after(async () => { first.close(); second.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, first, second };
}
async function api(t: any, storage: StorageEngine) {
  const app = express(); app.use(express.json());
  app.use('/api/projects/:id/flow', flowPlanRouter(storage));
  app.post('/api/projects/:id/episodes', episodeEditHandler(storage));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}/api/projects/${project}`;
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function partialFixture(t: any) {
  const fixtureData = await fixture(t);
  const plan = createGoogleFlowPlan(episodeId, 'Original fixture', 25, 24, 'keyframe_storyboard', project);
  plan.sourceEpisodeRevision = 0;
  await fixtureData.first.saveGoogleFlowPlan(project, plan);
  const dir = path.join(fixtureData.root, 'projects', project, 'assets', 'flow_renders', episodeId); await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, 'frame_00025.png');
  return { ...fixtureData, plan, file };
}

test('episode revision compare-and-swap prevents stale edits across storage instances', async t => {
  const { first, second } = await fixture(t);
  const a = (await first.getEpisode(project, episodeId))!;
  const b = (await second.getEpisode(project, episodeId))!;
  a.workingTitle = 'First operator edit'; await first.saveEpisode(project, a);
  assert.equal(a.revision, 1);
  b.workingTitle = 'Stale second edit';
  await assert.rejects(second.saveEpisode(project, b), RevisionConflict);
  assert.equal((await first.getEpisode(project, episodeId))?.workingTitle, 'First operator edit');
  assert.equal(b.revision, undefined); // failed writes do not mutate the caller's token
});

test('plan replacement is revision-checked and scoped to its actual project', async t => {
  const { first, second } = await fixture(t);
  const one = createGoogleFlowPlan(episodeId, 'First', 1, 24, 'dense_24fps', project); one.sourceEpisodeRevision = 0;
  await first.saveGoogleFlowPlan(project, one);
  const stale = (await second.getGoogleFlowPlan(project, episodeId))!;
  const replacement = createGoogleFlowPlan(episodeId, 'New', 2, 24, 'dense_24fps', project); replacement.revision = one.revision; replacement.sourceEpisodeRevision = 0;
  await first.saveGoogleFlowPlan(project, replacement);
  await assert.rejects(second.saveGoogleFlowPlan(project, stale), RevisionConflict);
  assert.equal((await first.getGoogleFlowPlan(project, episodeId))?.totalFramesExpected, 48);
  await assert.rejects(first.saveGoogleFlowPlan('another_project', replacement), /scope/);
});

test('batch verification requires real frames and leaves state unchanged on missing/corrupt assets', async t => {
  const { first, plan, file } = await partialFixture(t);
  await assert.rejects(verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, plan.revision));
  await fs.writeFile(file, 'not a PNG');
  await assert.rejects(verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, plan.revision));
  const unchanged = (await first.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(unchanged.revision, 1); assert.equal(unchanged.batches[1].status, 'pending'); assert.equal(unchanged.summary.totalFramesIngested, 0);
});

test('a final one-frame batch gets decoded evidence and resume still finds earlier gaps', async t => {
  const { first, plan, file } = await partialFixture(t);
  await fs.writeFile(file, await sharp({ create: { width: 1920, height: 1080, channels: 3, background: 'teal' } }).png().toBuffer());
  const result = await verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, plan.revision);
  assert.equal(result.batch.ingestedFrameCount, 1); assert.equal(result.summary.totalFramesIngested, 1);
  assert.equal(result.batch.verification?.frames[0].globalFrameNumber, 25);
  assert.match(result.batch.verification!.frames[0].sha256, /^[a-f0-9]{64}$/);
  const stored = (await first.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(computeFlowCheckpoint(stored).nextBatchIndex, 1);
  assert.deepEqual(computeFlowCheckpoint(stored).completedBatchIndices, [2]);
  await assert.rejects(verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, plan.revision), RevisionConflict);
  await verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, stored.revision);
  assert.equal((await first.getGoogleFlowPlan(project, episodeId))?.summary.verifiedBatches, 1);
});

test('legacy ingested/verified labels without decode evidence cannot claim progress', async t => {
  const { first } = await fixture(t);
  const plan = createGoogleFlowPlan(episodeId, 'Legacy fixture', 1, 24, 'dense_24fps', project);
  plan.sourceEpisodeRevision = 0; plan.batches[0].status = 'verified'; plan.summary.verifiedBatches = 1; plan.summary.completionPercentage = 100;
  await first.saveGoogleFlowPlan(project, plan);
  const loaded = (await first.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(loaded.summary.verifiedBatches, 0); assert.equal(loaded.summary.completionPercentage, 0);
  assert.equal(computeFlowCheckpoint(loaded).isComplete, false);
});

test('episode API returns 409 with current revision instead of overwriting a newer draft', async t => {
  const { first } = await fixture(t); const base = await api(t, first);
  const original = (await first.getEpisode(project, episodeId))!;
  const firstEdit = { ...original, status: 'script_draft', workingTitle: 'Saved via API' };
  assert.equal((await post(`${base}/episodes`, firstEdit)).status, 200);
  const stale = await post(`${base}/episodes`, { ...original, status: 'script_draft', workingTitle: 'Lost edit' });
  assert.equal(stale.status, 409);
  const error = await stale.json(); assert.equal(error.code, 'REVISION_CONFLICT'); assert.equal(error.currentRevision, 1);
  assert.equal((await first.getEpisode(project, episodeId))?.workingTitle, 'Saved via API');
  assert.equal((await post(`${base}/episodes`, { ...firstEdit, revision: -1 })).status, 400);
  assert.equal((await post(`${base}/episodes`, { ...firstEdit, revision: 1, status: 'qc_passed' })).status, 400);
});

test('plan reset API requires the loaded revision and rejects nonexistent episodes', async t => {
  const { first } = await fixture(t); const base = await api(t, first);
  assert.equal((await fetch(`${base}/flow/plan/${episodeId}`)).status, 404);
  const response = await post(`${base}/flow/plan/${episodeId}`, { durationSeconds: 1, expectedRevision: 0 }); const plan = (await response.json()).data;
  const reset = await post(`${base}/flow/plan/${episodeId}`, { durationSeconds: 2, expectedRevision: plan.revision });
  assert.equal(reset.status, 200); assert.equal((await reset.json()).data.totalFramesExpected, 48);
  assert.equal((await post(`${base}/flow/plan/${episodeId}`, { durationSeconds: 1, expectedRevision: plan.revision })).status, 409);
  assert.equal((await fetch(`${base}/flow/plan/missing`)).status, 404);
});

test('ingest API rejects simulated/caller-asserted verification without touching sources', async t => {
  const { first, plan, file } = await partialFixture(t); const base = await api(t, first);
  for (const patch of [{ simulate: true }, { simulate: false }, { fileNames: ['frame_00025.png'] }]) {
    assert.equal((await post(`${base}/flow/ingest`, { episodeId, batchId: plan.batches[1].batchId, expectedRevision: plan.revision, ...patch })).status, 400);
  }
  await assert.rejects(fs.stat(file));
  assert.equal((await first.getGoogleFlowPlan(project, episodeId))?.revision, 1);
});

test('a replacement plan committed during frame inspection rejects the old verification result', async t => {
  const { first, second, plan, file } = await partialFixture(t);
  await fs.writeFile(file, await sharp({ create: { width: 1920, height: 1080, channels: 3, background: 'teal' } }).png().toBuffer());
  const originalSave = first.saveGoogleFlowPlan.bind(first);
  first.saveGoogleFlowPlan = async (projectId, inspected) => {
    const replacement = createGoogleFlowPlan(episodeId, 'Changed during inspection', 26, 24, 'keyframe_storyboard', projectId);
    replacement.revision = plan.revision; replacement.sourceEpisodeRevision = plan.sourceEpisodeRevision;
    await second.saveGoogleFlowPlan(projectId, replacement);
    await originalSave(projectId, inspected);
  };
  await assert.rejects(verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, plan.revision), RevisionConflict);
  const latest = (await second.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(latest.totalFramesExpected, 26); assert.equal(latest.summary.verifiedBatches, 0);
  assert.equal(latest.batches[1].verification, undefined);
});

test('secondary-project verification reads only its own frames and keeps other projects unchanged', async t => {
  const { first, root } = await fixture(t);
  const other = await first.createProject('Second original project', 'Isolated workflow fixture');
  const source = (await first.getEpisode(project, episodeId))!;
  await first.saveEpisode(other.id, { ...source, projectId: other.id, seriesId: other.activeSeriesId });
  const plan = createGoogleFlowPlan(episodeId, 'Secondary project fixture', 1, 24, 'keyframe_storyboard', other.id);
  plan.sourceEpisodeRevision = (await first.getEpisode(other.id, episodeId))!.revision ?? 0;
  await first.saveGoogleFlowPlan(other.id, plan);
  const directory = path.join(root, 'projects', other.id, 'assets', 'flow_renders', episodeId); await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'frame_00001.png'), await sharp({ create: { width: 1920, height: 1080, channels: 3, background: 'navy' } }).png().toBuffer());
  await verifyFlowBatch(first, other.id, episodeId, plan.batches[0].batchId, plan.revision);
  const saved = (await first.getGoogleFlowPlan(other.id, episodeId))!;
  assert.ok(saved.outputDirectory.includes(`/${other.id}/`)); assert.equal(saved.summary.totalFramesIngested, 1);
  assert.equal(await first.getGoogleFlowPlan(project, episodeId), null);
});

test('failed revalidation revokes old evidence so a known-bad frame is not skipped on resume', async t => {
  const { first, plan, file } = await partialFixture(t);
  await fs.writeFile(file, await sharp({ create: { width: 1920, height: 1080, channels: 3, background: 'teal' } }).png().toBuffer());
  const checked = await verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, plan.revision);
  await fs.unlink(file);
  await assert.rejects(verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, checked.revision));
  const latest = (await first.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(latest.revision, 3); assert.equal(latest.summary.totalFramesIngested, 0);
  assert.equal(latest.batches[1].verification, undefined);
  assert.deepEqual(computeFlowCheckpoint(latest).completedBatchIndices, []);
});


test('Flow GET plan/checkpoint do not create preparation records and disable caching', async t => {
  const { first } = await fixture(t); const base = await api(t, first);
  const before = await first.getGoogleFlowPlan(project, episodeId); assert.equal(before, null);
  for (const route of ['plan', 'checkpoint']) {
    const response = await fetch(`${base}/flow/${route}/${episodeId}`);
    assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await first.getGoogleFlowPlan(project, episodeId), null);
  }
  assert.equal((await post(`${base}/flow/plan/${episodeId}`, { durationSeconds: 1, expectedRevision: 0 })).status, 200);
  const prepared = await first.getGoogleFlowPlan(project, episodeId);
  for (const route of ['plan', 'checkpoint']) assert.equal((await fetch(`${base}/flow/${route}/${episodeId}`)).status, 200);
  assert.deepEqual(await first.getGoogleFlowPlan(project, episodeId), prepared);
});

test('planning API returns bounded summary and paginated, episode-specific draft prompts', async t => {
  const { first } = await fixture(t); const base = await api(t, first);
  const initial = await first.getEpisode(project, episodeId); assert.ok(initial);
  const planResponse = await post(`${base}/flow/plan/${episodeId}?view=summary`, { durationSeconds: 50, fps: 24, mode: 'keyframe_storyboard', expectedRevision: 0 });
  assert.equal(planResponse.status, 200);
  const summary = (await planResponse.json()).data;
  assert.equal(summary.episodeId, episodeId); assert.equal(summary.totalBatches, 3); assert.equal(summary.revision, 1);
  assert.equal(summary.batches, undefined);
  const getSummary = (await (await fetch(`${base}/flow/plan/${episodeId}?view=summary`)).json()).data;
  assert.equal(getSummary.batches, undefined); assert.ok(JSON.stringify(getSummary).length < 10_000);
  const pageResponse = await fetch(`${base}/flow/plan/${episodeId}/batches?start=2&limit=1`);
  assert.equal(pageResponse.status, 200); assert.equal(pageResponse.headers.get('cache-control'), 'no-store');
  const page = (await pageResponse.json()).data;
  assert.equal(page.revision, 1); assert.equal(page.start, 2); assert.equal(page.batches.length, 1); assert.equal(page.batches[0].batchIndex, 2);
  assert.match(page.batches[0].prompts[0].promptText, /DRAFT/);
  assert.ok(page.batches[0].prompts[0].promptText.includes(initial.workingTitle));
  assert.ok(!page.batches[0].prompts[0].promptText.includes('The Quiet Hours: Ternfall - South Gate District'));
  for (const query of ['start=0', 'start=1&limit=101', 'start=2tail', 'start=4', 'start=9007199254740992']) {
    assert.equal((await fetch(`${base}/flow/plan/${episodeId}/batches?${query}`)).status, 400, query);
  }
  const full = (await (await fetch(`${base}/flow/plan/${episodeId}`)).json()).data;
  assert.equal(full.batches.length, 3); // Existing API clients retain the full response by default.
});

test('source episode changes invalidate a draft plan before verification or checkpoint use', async t => {
  const { first, second } = await fixture(t); const base = await api(t, first);
  const response = await post(`${base}/flow/plan/${episodeId}?view=summary`, { durationSeconds: 1, expectedRevision: 0 });
  assert.equal(response.status, 200); const initial = (await response.json()).data;
  assert.equal(initial.sourceEpisodeRevision, 0); assert.equal(initial.sourceState, 'current');
  const changed = (await second.getEpisode(project, episodeId))!; changed.workingTitle = 'Changed after planning'; await second.saveEpisode(project, changed);
  const loaded = (await (await fetch(`${base}/flow/plan/${episodeId}?view=summary`)).json()).data;
  assert.equal(loaded.sourceState, 'stale');
  assert.equal((await fetch(`${base}/flow/checkpoint/${episodeId}`)).status, 400);
  const verification = await post(`${base}/flow/ingest`, { episodeId, batchId: `GF_${episodeId}_B0001`, expectedRevision: initial.revision });
  assert.equal(verification.status, 409); assert.equal((await verification.json()).code, 'EPISODE_REVISION_CONFLICT');
  const old = (await first.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(old.revision, initial.revision); assert.equal(old.summary.verifiedBatches, 0);
  const refreshed = await post(`${base}/flow/plan/${episodeId}?view=summary`, { durationSeconds: 1, expectedRevision: initial.revision });
  assert.equal(refreshed.status, 200); const latest = (await refreshed.json()).data;
  assert.equal(latest.sourceEpisodeRevision, 1); assert.equal(latest.sourceState, 'current');
});

test('legacy plans without source revision remain readable but cannot be verified or treated as current', async t => {
  const { root, first } = await fixture(t);
  const legacy = createGoogleFlowPlan(episodeId, 'Historical', 1, 24, 'keyframe_storyboard', project);
  const file = path.join(root, 'projects', project, 'flow_plans', `${episodeId}.json`);
  await first.atomicWriteJson(file, legacy);
  const loaded = (await first.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(loaded.sourceState, 'unknown');
  await assert.rejects(verifyFlowBatch(first, project, episodeId, loaded.batches[0].batchId, loaded.revision), /no source episode revision/);
  await assert.rejects(first.saveGoogleFlowPlan(project, loaded), /no valid source episode revision/);
  assert.deepEqual(await first.readJson(file, null), legacy);
});

test('an episode edit during frame inspection prevents recording evidence against stale source', async t => {
  const { first, second, plan, file } = await partialFixture(t);
  await fs.writeFile(file, await sharp({ create: { width: 1920, height: 1080, channels: 3, background: 'teal' } }).png().toBuffer());
  const originalSave = first.saveGoogleFlowPlan.bind(first);
  first.saveGoogleFlowPlan = async (projectId, inspected) => {
    const edit = (await second.getEpisode(projectId, episodeId))!; edit.logline = 'New logline during inspection';
    await second.saveEpisode(projectId, edit, true); await originalSave(projectId, inspected);
  };
  await assert.rejects(verifyFlowBatch(first, project, episodeId, plan.batches[1].batchId, plan.revision), EpisodeSourceConflict);
  const stored = (await second.getGoogleFlowPlan(project, episodeId))!;
  assert.equal(stored.sourceState, 'stale'); assert.equal(stored.revision, plan.revision); assert.equal(stored.batches[1].verification, undefined);
});
