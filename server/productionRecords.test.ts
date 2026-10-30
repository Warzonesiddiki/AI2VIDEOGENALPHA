import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { StorageEngine } from './storage.ts';
import { RevisionConflict } from './lib/conflicts.ts';
import type { GenerationJob, AutoproduceRun, YouTubePackage } from '../src/types/index.ts';
const project = 'proj_ternfall_01';
export function productionFixtures() {
  const now = new Date().toISOString();
  const job: GenerationJob = { id: 'fixture_job', projectId: project, episodeId: 'S01E001', type: 'video_render', state: 'queued', progressPercent: 0, currentStage: 'pending', retryCount: 0, maxRetries: 0, logs: [], outputArtifacts: [], createdAt: now, updatedAt: now };
  const run: AutoproduceRun = { runId: 'fixture_run', projectId: project, episodeId: 'S01E001', profile: 'supervised', budgetCapUsd: 0, spentSoFarUsd: 0, stages: [], currentStageIndex: 0, isCompleted: false, isPaused: true, isCancelled: false, createdAt: now, updatedAt: now };
  const pkg: YouTubePackage = { id: 'fixture_pkg', episodeId: 'S01E001', workingTitle: 'Original fixture', titleOptions: [], selectedTitle: '', description: '', chapterTimestamps: [], tags: [], shortsVariants: [], captionLanguage: 'en', audienceSetting: 'unreviewed', ageRestriction: false, alteredSyntheticDisclosureChoice: 'manual_studio_review', rightsClearanceVerified: false, targetPrivacyStatus: 'private', productionTimezone: 'UTC', humanApprovedForUpload: false, humanApprovedForPublish: false, qcReport: { passed: false, ffprobeStatus: 'not measured', audioClippingDetected: false, aspectRatioConfirmed: false, missingFrames: false, loudnessLufs: null, issues: ['Not measured'] }, createdAt: now, updatedAt: now };
  return { job, run, pkg };
}
const kinds = ['job', 'run', 'pkg'] as const;
const save = (store: StorageEngine, kind: typeof kinds[number], record: any, scope = project) => kind === 'job' ? store.saveJob(scope, record) : kind === 'run' ? store.saveAutoproduceRun(scope, record) : store.savePackage(scope, record);
const list = (store: StorageEngine, kind: typeof kinds[number]) => kind === 'job' ? store.listJobs(project) : kind === 'run' ? store.listAutoproduceRuns(project) : store.listPackages(project);
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-record-test-'));
  const first = new StorageEngine(root), second = new StorageEngine(root); await first.init();
  t.after(async () => { first.close(); second.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, first, second };
}
for (const kind of kinds) {
  test(`${kind} stale saves conflict across instances; successful tokens must be used explicitly`, async t => {
    const { first, second } = await fixture(t); const source = productionFixtures()[kind];
    const initial = await save(first, kind, source); assert.equal(initial.revision, 1); assert.equal(source.revision, undefined);
    const stale = (await list(second, kind))[0];
    const next = await save(first, kind, initial); assert.equal(next.revision, 2);
    await assert.rejects(save(second, kind, stale), RevisionConflict);
    assert.equal(stale.revision, 1); assert.equal((await list(first, kind))[0].revision, 2);
    assert.equal((await save(second, kind, next)).revision, 3);
  });
  test(`${kind} rejects invalid revision/scope/identity and preserves caller snapshots`, async t => {
    const { first } = await fixture(t); const initial = await save(first, kind, productionFixtures()[kind]);
    for (const revision of [-1, null, '1', 1.5]) await assert.rejects(save(first, kind, { ...initial, revision }));
    await assert.rejects(save(first, kind, { ...initial, projectId: 'other_project' }), /scope/);
    await assert.rejects(save(first, kind, { ...initial, createdAt: '2020-01-01' }), /immutable/);
    await assert.rejects(save(first, kind, { ...initial, episodeId: 'missing_episode' }), /episode not found/);
    await assert.rejects(save(first, kind, { ...initial, projectId: 'missing_project' }, 'missing_project'), /project not found/);
    const draft = structuredClone(initial); const pending = save(first, kind, draft); draft.episodeId = 'missing_episode';
    assert.equal((await pending).episodeId, 'S01E001');
  });
}

test('legacy production records expose revision zero without rewriting metadata', async t => {
  const { root, first } = await fixture(t); const records = productionFixtures();
  const names = { job: 'jobs.json', run: 'autoproduce_runs.json', pkg: 'packages.json' };
  for (const kind of kinds) {
    const file = path.join(root, 'projects', project, names[kind]);
    await first.atomicWriteJson(file, [records[kind]]);
    assert.equal((await list(first, kind))[0].revision, 0);
    assert.equal((await first.readJson<any[]>(file, []))[0].revision, undefined);
    assert.equal((await save(first, kind, (await list(first, kind))[0])).revision, 1);
  }
});

test('simultaneous process saves produce one winner for each production metadata model', async t => {
  const { root, first } = await fixture(t);
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  await Promise.all(kinds.map(async kind => {
    const initial = await save(first, kind, productionFixtures()[kind]);
    const results = await Promise.all([0, 1].map(async () => {
      const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/production-record-worker.ts'], {
        cwd: process.cwd(), env: { ...process.env, TEST_RECORD_ROOT: root, TEST_RECORD_KIND: kind, TEST_RECORD_DATA: JSON.stringify(initial) },
      });
      return JSON.parse(stdout.trim());
    }));
    assert.equal(results.filter(result => result.ok).length, 1, kind);
    assert.equal(results.find(result => !result.ok).currentRevision, 2, kind);
  }));
});
