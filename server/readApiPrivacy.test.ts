import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import {
  seriesReadHandler, episodeListHandler, episodeReadHandler, researchListHandler,
  jobListHandler, autoproduceListHandler, spendGrantListHandler, packageListHandler,
} from './readHandlers.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const HASH = 'a'.repeat(64);

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-read-privacy-'));
  const store = new StorageEngine(root); await store.init();
  const app = express(); app.use(express.json());
  app.get('/projects/:id/series', seriesReadHandler(store));
  app.get('/projects/:id/episodes', episodeListHandler(store));
  app.get('/projects/:id/episodes/:epId', episodeReadHandler(store));
  app.get('/projects/:id/research', researchListHandler(store));
  app.get('/projects/:id/jobs', jobListHandler(store));
  app.get('/projects/:id/youtube', packageListHandler(store));
  app.get('/projects/:id/autoproduce', autoproduceListHandler(store));
  app.get('/projects/:id/spend-grants', spendGrantListHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, base: `http://127.0.0.1:${address.port}` };
}

async function seed(root: string, name: string, value: unknown) {
  const dir = path.join(root, 'projects', 'proj1'); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), JSON.stringify(value, null, 2));
}

const legacyJob = {
  revision: 2, id: 'job1', projectId: 'proj1', episodeId: 'S01E001', type: 'video_render', state: 'blocked',
  externalOperation: {
    id: 'ext1', operationIntent: 'gemini_generate_image', idempotencyKey: 'private-fixture-idempotency',
    provider: 'gemini', modelOrRoute: 'private-fixture-model', state: 'private-fixture-legacy-state',
    mayHaveCharged: true, duplicatePossible: true, reconciliationRequired: true,
    reconciliationEvidence: 'private-fixture-evidence /private/host/log.txt', providerRequestId: 'private-fixture-provider-req',
    createdAt: T0, updatedAt: T0,
  },
  progressPercent: 40, currentStage: 'private-fixture-stage /private/host', blockerReason: 'private-fixture-blocker /private/host/err.txt',
  recoveryRemediation: 'private-fixture-remediation', retryCount: 1, maxRetries: 3,
  estimatedCostUsd: 1.25, actualCostUsd: 2.5,
  logs: [
    { timestamp: T0, level: 'error', message: 'private-fixture-log ENOENT /private/host/asset.png', details: { cmd: 'private-fixture-details /private/host/ffmpeg' } },
    { timestamp: T0, level: 'info', message: 'private-fixture-log2', details: { token: 'private-fixture-token' } },
  ],
  inputHash: 'private-fixture-rawhash',
  outputArtifacts: [
    { name: 'master.mp4', relativePath: '/private/host/out/master.mp4', hash: 'private-fixture-arthash' },
    { name: 'safe.png', relativePath: 'renders/safe.png', hash: HASH },
    { name: 'escape.png', relativePath: '../../private/host/escape.png' },
  ],
  unknownExtraField: 'private-fixture-unknown', createdAt: T0, updatedAt: T0,
};

const legacyPackage = {
  revision: 1, projectId: 'proj1', id: 'pkg1', episodeId: 'S01E001', workingTitle: 'Fixture title',
  titleOptions: ['T1', 'T2'], selectedTitle: 'T1', description: 'Fixture description',
  chapterTimestamps: [{ timecode: '00:00', label: 'Intro' }], tags: ['a', 'b'],
  thumbnailPath: '/private/host/thumb.png', master16x9Path: '/private/host/master.mp4',
  master16x9DurationSeconds: 612.5, master16x9Resolution: '1920x1080',
  shortsVariants: [{ shortId: 's1', path: '/private/host/short.mp4', durationSeconds: 45, hookDescription: 'Hook' }],
  captionsSrtPath: '/private/host/cap.srt', captionsVttPath: '/private/host/cap.vtt',
  captionLanguage: 'en', audienceSetting: 'private-fixture-audience', ageRestriction: true,
  alteredSyntheticDisclosureChoice: 'disclose', rightsClearanceVerified: true, targetPrivacyStatus: 'private-fixture-privacy',
  scheduledTimeIso: T0, productionTimezone: 'UTC', humanApprovedForUpload: false, humanApprovedForPublish: false,
  qcReport: {
    passed: false, ffprobeStatus: 'private-fixture-ffprobe /private/host/ffprobe', audioClippingDetected: true,
    aspectRatioConfirmed: true, missingFrames: false, loudnessLufs: -14.2,
    issues: ['private-fixture-issue /private/host/raw stderr'],
  },
  unknownExtra: 'private-fixture-unknown', createdAt: T0, updatedAt: T0,
};

const legacyRun = {
  revision: 3, runId: 'run1', projectId: 'proj1', episodeId: 'S01E001', profile: 'supervised',
  spendApprovalId: 'grant1', budgetCapUsd: 100, spentSoFarUsd: 12.5,
  stages: [
    { stageName: 'asset_generation', label: 'private-fixture-label', status: 'private-fixture-status', startTime: T0, endTime: T0, costUsd: 1, details: 'private-fixture-details /private/host/x', requiresHumanAction: true },
    { stageName: 'private-fixture-stage', label: 'x', status: 'running' },
  ],
  currentStageIndex: 1, isCompleted: false, isPaused: true, isCancelled: false,
  blockerMessage: 'private-fixture-blocker /private/host/block.txt',
  outputPackagePath: '/private/host/pkg', unknownExtra: 'private-fixture-unknown', createdAt: T0, updatedAt: T0,
};

const legacyGrant = {
  approvalId: 'grant1', issuedBy: 'operator', projectId: 'proj1', episodeId: 'S01E001',
  maxBudgetUsd: 100, currency: 'USD', allowedProviders: ['gemini'], expiresAt: '2027-01-01T00:00:00.000Z',
  isRevoked: false, actualSpentUsd: 12.5, createdAt: T0, unknownExtra: 'private-fixture-unknown',
};

function assertNoMarkers(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const marker of ['private-fixture', '/private/host', 'D:/private', 'private-fixture-unknown']) {
    assert.ok(!text.includes(marker), `response must not contain ${marker}`);
  }
}

test('job listings omit raw diagnostics, telemetry and unsafe artifact paths', async t => {
  const { root, base } = await fixture(t); await seed(root, 'jobs.json', [legacyJob]);
  const response = await fetch(`${base}/projects/proj1/jobs`);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); assert.equal(body.ok, true);
  const [job] = body.data;
  assertNoMarkers(body);
  assert.deepEqual(Object.keys(job).sort(), [
    'actualCostUsd', 'createdAt', 'episodeId', 'estimatedCostUsd', 'externalOperation', 'id',
    'logs', 'maxRetries', 'outputArtifacts', 'progressPercent', 'projectId',
    'retryCount', 'revision', 'state', 'type', 'updatedAt',
  ]);
  assert.equal(job.id, 'job1'); assert.equal(job.state, 'blocked'); assert.equal(job.type, 'video_render');
  assert.equal(job.progressPercent, 40); assert.equal(job.actualCostUsd, 2.5); assert.equal(job.estimatedCostUsd, 1.25);
  assert.deepEqual(Object.keys(job.externalOperation).sort(), [
    'duplicatePossible', 'id', 'mayHaveCharged', 'operationIntent', 'provider', 'reconciliationRequired', 'state',
  ]);
  assert.equal(job.externalOperation.state, 'unknown_external_effect');
  assert.equal(job.externalOperation.duplicatePossible, true); assert.equal(job.externalOperation.mayHaveCharged, true);
  assert.equal(job.externalOperation.reconciliationRequired, true);
  assert.equal(job.logs.length, 2);
  for (const entry of job.logs) {
    assert.deepEqual(Object.keys(entry).sort(), ['level', 'message', 'timestamp']);
    assert.match(entry.message, /^Stored log text is withheld/);
  }
  assert.equal(job.inputHash, undefined);
  const [unsafe, safe, escape] = job.outputArtifacts;
  assert.deepEqual(unsafe, { name: 'master.mp4' });
  assert.deepEqual(safe, { name: 'safe.png', relativePath: 'renders/safe.png', hash: HASH });
  assert.deepEqual(escape, { name: 'escape.png' });
});

test('package listings expose release metadata without filesystem paths or raw QC text', async t => {
  const { root, base } = await fixture(t); await seed(root, 'packages.json', [legacyPackage]);
  const response = await fetch(`${base}/projects/proj1/youtube`);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json(); const [pkg] = body.data;
  assertNoMarkers(body);
  assert.deepEqual(Object.keys(pkg).sort(), [
    'ageRestriction', 'alteredSyntheticDisclosureChoice', 'audienceSetting', 'captionLanguage',
    'captionsSrtRecorded', 'captionsVttRecorded', 'chapterTimestamps', 'createdAt', 'description',
    'episodeId', 'humanApprovedForPublish', 'humanApprovedForUpload', 'id', 'master16x9DurationSeconds',
    'master16x9Recorded', 'master16x9Resolution', 'productionTimezone', 'projectId', 'qcReport',
    'revision', 'rightsClearanceVerified', 'scheduledTimeIso', 'selectedTitle', 'shortsVariants',
    'tags', 'targetPrivacyStatus', 'thumbnailRecorded', 'titleOptions', 'updatedAt', 'workingTitle',
  ]);
  assert.equal(pkg.thumbnailRecorded, true); assert.equal(pkg.master16x9Recorded, true);
  assert.equal(pkg.captionsSrtRecorded, true); assert.equal(pkg.captionsVttRecorded, true);
  assert.equal(pkg.audienceSetting, 'unreviewed'); assert.equal(pkg.targetPrivacyStatus, 'private');
  assert.equal(pkg.alteredSyntheticDisclosureChoice, 'disclose');
  assert.deepEqual(pkg.shortsVariants, [{ shortId: 's1', durationSeconds: 45, hookDescription: 'Hook', fileRecorded: true }]);
  assert.deepEqual(pkg.qcReport, {
    passed: false, audioClippingDetected: true, aspectRatioConfirmed: true,
    missingFrames: false, loudnessLufs: -14.2, issueCount: 1, ffprobeRun: true,
  });
});

test('autoproduce runs and spend grants expose only their public fields', async t => {
  const { root, base } = await fixture(t);
  await seed(root, 'autoproduce_runs.json', [legacyRun]); await seed(root, 'spend_grants.json', [legacyGrant]);
  const runs = await (await fetch(`${base}/projects/proj1/autoproduce`)).json();
  assert.deepEqual(Object.keys(runs.data[0]).sort(), [
    'blockerSummary', 'budgetCapUsd', 'createdAt', 'currentStageIndex', 'episodeId', 'isCancelled',
    'isCompleted', 'isPaused', 'outputPackageRecorded', 'profile', 'projectId', 'revision', 'runId',
    'spendApprovalId', 'spentSoFarUsd', 'stages', 'updatedAt',
  ]);
  assertNoMarkers(runs);
  assert.equal(runs.data[0].outputPackageRecorded, true);
  assert.match(runs.data[0].blockerSummary, /^A stored blocker is recorded/);
  const [first, second] = runs.data[0].stages;
  assert.deepEqual(Object.keys(first).sort(), ['costUsd', 'endTime', 'label', 'requiresHumanAction', 'stageName', 'startTime', 'status']);
  assert.equal(first.stageName, 'asset_generation'); assert.equal(first.label, 'asset generation');
  assert.equal(first.status, 'needs_user'); assert.equal(first.requiresHumanAction, true);
  assert.equal(second.stageName, 'unrecognized_stage'); assert.equal(second.status, 'running');
  const grantsResponse = await fetch(`${base}/projects/proj1/spend-grants`);
  assert.equal(grantsResponse.status, 200); assert.equal(grantsResponse.headers.get('cache-control'), 'no-store');
  const grants = await grantsResponse.json();
  assertNoMarkers(grants);
  assert.deepEqual(Object.keys(grants.data[0]).sort(), [
    'actualSpentUsd', 'allowedProviders', 'approvalId', 'createdAt', 'currency', 'episodeId',
    'expiresAt', 'isRevoked', 'issuedBy', 'maxBudgetUsd', 'projectId',
  ]);
  assert.equal(grants.data[0].maxBudgetUsd, 100);
});

test('malformed money values fail production listings closed without leaking contents', async t => {
  const { root, base } = await fixture(t);
  await seed(root, 'spend_grants.json', [{ ...legacyGrant, maxBudgetUsd: 'private-fixture-money' }]);
  const grants = await fetch(`${base}/projects/proj1/spend-grants`);
  assert.equal(grants.status, 500); assert.equal(grants.headers.get('cache-control'), 'no-store');
  assertNoMarkers(await grants.json());
  await seed(root, 'jobs.json', [{ ...legacyJob, actualCostUsd: { token: 'private-fixture-money' } }]);
  const jobs = await fetch(`${base}/projects/proj1/jobs`);
  assert.equal(jobs.status, 500); assert.equal(jobs.headers.get('cache-control'), 'no-store');
  assertNoMarkers(await jobs.json());
});

test('document read responses are never cacheable', async t => {
  const { root, base } = await fixture(t);
  await seed(root, 'episodes.json', [{
    id: 'S01E001', dbId: 'ep_fixture', projectId: 'proj1', seriesId: 'series1', arcNumber: 1,
    workingTitle: 'Fixture', logline: 'Fixture logline', status: 'planned', scriptVersions: [],
    activeScriptVersionIndex: 0, revision: 0, createdAt: T0, updatedAt: T0,
  }]);
  await seed(root, 'research_claims.json', [{
    id: 'claim1', projectId: 'proj1', claimText: 'Fixture claim', isFictionalLore: false,
    verificationStatus: 'unverified', confidenceScore: 0, factCheckerNotes: '', humanApproved: false,
    relatedEpisodeIds: [], revision: 0, createdAt: T0, updatedAt: T0,
  }]);
  for (const route of ['/projects/proj1/episodes', '/projects/proj1/episodes/S01E001', '/projects/proj1/research', '/projects/proj1/series', '/projects/proj1/jobs']) {
    const response = await fetch(base + route);
    assert.ok([200, 404].includes(response.status), route);
    assert.equal(response.headers.get('cache-control'), 'no-store', route);
    assertNoMarkers(await response.json());
  }
});
