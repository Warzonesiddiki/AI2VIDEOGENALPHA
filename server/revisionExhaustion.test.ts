import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { configEditHandler, settingsReadHandler } from './configEdits.ts';
import { projectEditHandler } from './projectEdits.ts';
import { DATA_NOTICE_VERSION } from '../src/core/dataNotice.ts';
import { createGoogleFlowPlan } from '../src/core/flow.ts';
import { nextRevision } from './lib/conflicts.ts';
import { verifyFlowBatch } from './flowVerification.ts';
import sharp from 'sharp';

const project = 'proj_ternfall_01', episodeId = 'S01E001', max = Number.MAX_SAFE_INTEGER;
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-revision-limit-'));
  const store = new StorageEngine(root); await store.init();
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, projectDir: path.join(root, 'projects', project) };
}
async function server(t: any, store: StorageEngine) {
  const app = express(); app.use(express.json()); app.get('/settings', settingsReadHandler(store)); app.put('/settings', configEditHandler(store, 'settings'));
  app.post('/projects/:id/archive', projectEditHandler(store, 'archive'));
  const listener = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => listener.once('listening', resolve));
  const address = listener.address(); assert.ok(address && typeof address !== 'string');
  t.after(() => new Promise<void>(resolve => listener.close(() => resolve())));
  return `http://127.0.0.1:${address.port}`;
}
const send = (method: string, url: string, body: unknown) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('revision advancement accepts legacy zero and stops at the final safe integer', () => {
  assert.equal(nextRevision(undefined), 1); assert.equal(nextRevision(0), 1); assert.equal(nextRevision(max - 1), max);
  for (const invalid of [max, max + 1, -1, 1.5, null, '0']) assert.throws(() => nextRevision(invalid));
});

test('settings at the final safe revision cannot overflow or append notice events after an HTTP failure', async t => {
  const { root, store } = await fixture(t); const base = await server(t, store);
  const file = path.join(root, 'settings.json'); const eventsFile = path.join(root, 'data_notice_events.json');
  const initial = await store.getSettings(); await store.atomicWriteJson(file, { ...initial, revision: max - 1 });
  const last = await send('PUT', `${base}/settings`, { revision: max - 1, productionTimezone: 'UTC' });
  assert.equal(last.status, 200); assert.equal((await last.json()).data.revision, max);
  const before = await store.readJson<any>(file, null), events = await store.readJson<any[]>(eventsFile, []);
  const failed = await send('PUT', `${base}/settings`, { revision: max, dataNoticeAccepted: true, dataNoticeVersion: DATA_NOTICE_VERSION });
  assert.equal(failed.status, 500); assert.equal(failed.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await store.readJson(file, null), before); assert.deepEqual(await store.readJson(eventsFile, []), events);
});

test('project and series revisions fail before committing an unsafe increment', async t => {
  const { root, store, projectDir } = await fixture(t); const base = await server(t, store);
  const projectFile = path.join(projectDir, 'project.json'), seriesFile = path.join(projectDir, 'series.json');
  const currentProject = (await store.getProject(project))!, currentSeries = (await store.getSeriesBible(project))!;
  const exhaustedProject = { ...currentProject, revision: max }, exhaustedSeries = { ...currentSeries, revision: max };
  await store.atomicWriteJson(projectFile, exhaustedProject); await store.atomicWriteJson(seriesFile, exhaustedSeries);
  const failed = await send('POST', `${base}/projects/${project}/archive`, { revision: max, isArchived: true });
  assert.equal(failed.status, 500); assert.deepEqual(await store.readJson(projectFile, null), exhaustedProject);
  await assert.rejects(store.updateSeriesBible(project, { revision: max, seriesTitle: 'Must not save' }));
  assert.deepEqual(await store.readJson(seriesFile, null), exhaustedSeries);
});

test('episode and Flow plan revisions fail without changing stored or caller state', async t => {
  const { store, projectDir } = await fixture(t);
  const plan = createGoogleFlowPlan(episodeId, 'Revision fixture', 1, 24, 'dense_24fps', project); plan.sourceEpisodeRevision = 0;
  await store.saveGoogleFlowPlan(project, plan);
  const planFile = path.join(projectDir, 'flow_plans', `${episodeId}.json`);
  const exhaustedPlan = { ...(await store.readJson<any>(planFile, null)), revision: max }; await store.atomicWriteJson(planFile, exhaustedPlan);
  const requestPlan = { ...plan, revision: max }; const planSnapshot = structuredClone(requestPlan);
  await assert.rejects(store.saveGoogleFlowPlan(project, requestPlan));
  assert.deepEqual(await store.readJson(planFile, null), exhaustedPlan); assert.deepEqual(requestPlan, planSnapshot);
  const episodesFile = path.join(projectDir, 'episodes.json'); const episodes = await store.readJson<any[]>(episodesFile, []);
  const index = episodes.findIndex(item => item.id === episodeId); episodes[index].revision = max; await store.atomicWriteJson(episodesFile, episodes);
  const draft = { ...episodes[index], workingTitle: 'Must not save' }; const draftSnapshot = structuredClone(draft);
  await assert.rejects(store.saveEpisode(project, draft, true));
  assert.deepEqual(await store.readJson(episodesFile, []), episodes); assert.deepEqual(draft, draftSnapshot);
});

test('a Flow recheck that exhausts its last revision leaves old evidence revoked', async t => {
  const { store, projectDir } = await fixture(t);
  const plan = createGoogleFlowPlan(episodeId, 'Recheck limit', 1, 24, 'keyframe_storyboard', project); plan.sourceEpisodeRevision = 0;
  await store.saveGoogleFlowPlan(project, plan);
  const dir = path.join(projectDir, 'assets', 'flow_renders', episodeId); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'frame_00001.png'), await sharp({ create: { width: 1920, height: 1080, channels: 3, background: 'teal' } }).png().toBuffer());
  const verified = await verifyFlowBatch(store, project, episodeId, plan.batches[0].batchId, plan.revision);
  assert.equal(verified.batch.status, 'verified');
  const file = path.join(projectDir, 'flow_plans', `${episodeId}.json`); const current = await store.readJson<any>(file, null);
  await store.atomicWriteJson(file, { ...current, revision: max - 1 });
  await assert.rejects(verifyFlowBatch(store, project, episodeId, plan.batches[0].batchId, max - 1), /Revision exhausted/);
  const stored = await store.readJson<any>(file, null);
  assert.equal(stored.revision, max); assert.equal(stored.batches[0].status, 'pending'); assert.equal(stored.batches[0].verification, undefined);
});

test('research and production records do not overflow or alter their stored snapshots', async t => {
  const { store, projectDir } = await fixture(t); const now = new Date().toISOString();
  const claim: any = { id: 'revision_claim', projectId: project, claimText: 'Fixture note', isFictionalLore: false, verificationStatus: 'unverified', confidenceScore: 0, humanApproved: false, factCheckerNotes: '', relatedEpisodeIds: [], createdAt: now, updatedAt: now };
  const saved = await store.saveResearchClaim(project, claim); const claimFile = path.join(projectDir, 'research_claims.json');
  const claims = (await store.readJson<any[]>(claimFile, [])).map(item => item.id === saved.id ? { ...item, revision: max } : item);
  await store.atomicWriteJson(claimFile, claims); await assert.rejects(store.saveResearchClaim(project, { ...saved, revision: max, claimText: 'Must not save' }));
  assert.deepEqual(await store.readJson(claimFile, []), claims);
  const job: any = { id: 'revision_job', projectId: project, episodeId, type: 'video_render', state: 'queued', progressPercent: 0, currentStage: 'pending', retryCount: 0, maxRetries: 0, logs: [], outputArtifacts: [], createdAt: now, updatedAt: now };
  const savedJob = await store.saveJob(project, job); const jobsFile = path.join(projectDir, 'jobs.json');
  const jobs = (await store.readJson<any[]>(jobsFile, [])).map(item => item.id === savedJob.id ? { ...item, revision: max } : item);
  await store.atomicWriteJson(jobsFile, jobs); await assert.rejects(store.saveJob(project, { ...savedJob, revision: max, currentStage: 'Must not save' }));
  assert.deepEqual(await store.readJson(jobsFile, []), jobs);
});
