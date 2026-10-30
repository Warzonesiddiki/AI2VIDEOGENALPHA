/**
 * Ternfall Studio - Google Flow Bridge Unit Tests
 * Tests 24-frame batch calculations, 3-account load balancing, prompt continuity,
 * asset ingestion validation, and zero-cost invariant.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFlowBatchRequirements,
  formatSecondsToTimecode,
  generateBatchFramePrompt,
  createGoogleFlowPlan,
  validateBatchIngestion,
  generateFfmpeg24fpsStitchScript,
  generateFlowAutoWorkerScript,
  generateLocalAudioMixScript,
  generateCompleteYouTubeRenderScript,
  generateYouTubeMetadataPackage,
  computeFlowCheckpoint,
  computeFlowResumePoint,
  createFlowAutoproduceOrchestrator,
  TERNFALL_CHARACTER_INGREDIENT,
  TERNFALL_NEGATIVE_PROMPT,
} from './flow.ts';

test('calculateFlowBatchRequirements: 10 minutes at 24fps produces exactly 14,400 frames and 600 batches', () => {
  const reqs = calculateFlowBatchRequirements(600, 24, 'dense_24fps');

  assert.equal(reqs.totalDurationSeconds, 600);
  assert.equal(reqs.fps, 24);
  assert.equal(reqs.totalFramesExpected, 14400); // 600 * 24
  assert.equal(reqs.totalBatches, 600); // 14400 / 24
  assert.equal(reqs.batchSize, 24);

  // Round-robin distribution across 3 Pro accounts
  assert.equal(reqs.batchesPerAccount.account_1, 200);
  assert.equal(reqs.batchesPerAccount.account_2, 200);
  assert.equal(reqs.batchesPerAccount.account_3, 200);
  assert.equal(
    reqs.batchesPerAccount.account_1 +
      reqs.batchesPerAccount.account_2 +
      reqs.batchesPerAccount.account_3,
    600
  );
});

test('calculateFlowBatchRequirements: keyframe storyboard mode produces 600 frames and 25 batches', () => {
  const reqs = calculateFlowBatchRequirements(600, 24, 'keyframe_storyboard');

  assert.equal(reqs.totalFramesExpected, 600);
  assert.equal(reqs.totalBatches, 25); // Math.ceil(600 / 24) = 25

  assert.equal(reqs.batchesPerAccount.account_1, 9);
  assert.equal(reqs.batchesPerAccount.account_2, 8);
  assert.equal(reqs.batchesPerAccount.account_3, 8);
  assert.equal(
    reqs.batchesPerAccount.account_1 +
      reqs.batchesPerAccount.account_2 +
      reqs.batchesPerAccount.account_3,
    25
  );
});

test('formatSecondsToTimecode: correctly formats standard and fractional second timecodes', () => {
  assert.equal(formatSecondsToTimecode(0), '00:00.000');
  assert.equal(formatSecondsToTimecode(65.5), '01:05.500');
  assert.equal(formatSecondsToTimecode(600), '10:00.000');
});

test('frame prompts use supplied episode context and explicitly identify missing visual notes', () => {
  const prompt = generateBatchFramePrompt(1, 1, 2, 'Cross the ridge', 24, 'dense_24fps', {
    episodeId: 'S02E004', episodeTitle: 'Alpine Rescue', logline: 'A medic crosses a snowy ridge.', visualDescription: 'A medic in a blue coat.'
  });
  assert.equal(prompt.frameIndex, 1);
  assert.equal(prompt.globalFrameNumber, 1);
  assert.equal(prompt.timecode, '00:00.000');
  assert.match(prompt.promptText, /DRAFT.*Alpine Rescue.*S02E004/);
  assert.match(prompt.promptText, /medic in a blue coat/);
  assert.doesNotMatch(prompt.promptText, /Rhea|South Gate/);
  assert.equal(prompt.negativePrompt, '');
  assert.match(generateBatchFramePrompt(1, 1, 1, 'Unspecified').promptText, /No visual note supplied/);
});

test('different episodes generate different draft context rather than fixed pilot prompts', () => {
  const a = createGoogleFlowPlan('S01E001', 'Forest', 1, 24, 'dense_24fps', 'proj_a', { logline: 'A forest fire.', beats: [{ name: 'Smoke', visualDescription: 'Ash falls.' }] });
  const b = createGoogleFlowPlan('S01E002', 'Mountain', 1, 24, 'dense_24fps', 'proj_a', { logline: 'An alpine rescue.', beats: [{ name: 'Snow', visualDescription: 'Wind rises.' }] });
  assert.notEqual(a.batches[0].prompts[0].promptText, b.batches[0].prompts[0].promptText);
  assert.match(a.batches[0].prompts[0].promptText, /Ash falls/);
  assert.match(b.batches[0].prompts[0].promptText, /Wind rises/);
  assert.doesNotMatch(b.batches[0].prompts[0].promptText, /Rhea|South Gate/);
});

test('createGoogleFlowPlan: maintains $0.00 billable API spend invariant and allocates exact partial batches without inventing account telemetry', () => {
  // Test with a 1-minute slice (60 seconds, 60 batches of 24 = 1440 frames or 3 batches in keyframe)
  const plan = createGoogleFlowPlan('S01E001', 'The Eight-Beat Failure', 60, 24, 'keyframe_storyboard');

  assert.equal(plan.episodeId, 'S01E001');
  assert.equal(plan.fps, 24);
  assert.equal(plan.totalBatches, 3); // 60 / 24 = 2.5 -> 3 batches
  assert.equal(plan.summary.billableApiSpendUsd, 0); // Strictly $0.00

  // Verify accounts are all marked isPro
  assert.equal(plan.accounts.account_1.isPro, false);
  assert.equal(plan.accounts.account_2.isPro, false);
  assert.equal(plan.accounts.account_3.isPro, false);

  // Each batch must have exactly 24 prompts
  assert.equal(plan.batches.length, 3);
  assert.deepEqual(plan.batches.map(batch => batch.framesExpected), [24, 24, 12]);
  assert.deepEqual(plan.batches.map(batch => batch.prompts.length), [24, 24, 12]);
});

test('validateBatchIngestion: detects missing frames and validates complete 24-frame batches', () => {
  const testBatch = {
    batchId: 'GF_S01E001_B0001',
    batchIndex: 1,
    episodeId: 'S01E001',
    assignedAccount: 'account_1' as const,
    timecodeRange: { start: '00:00.000', end: '00:01.000' },
    storyBeatName: 'Beat 1',
    dramaticPacing: 'Steady',
    prompts: [],
    status: 'pending' as const,
    framesExpected: 24 as const,
    ingestedFrameCount: 0,
    ingestedFiles: [],
    missingFrames: [],
  };

  // Incomplete batch: only 3 frames provided
  const partialFiles = ['frame_01.png', 'frame_02.png', 'frame_03.png'];
  const partialCheck = validateBatchIngestion(testBatch, partialFiles);
  assert.equal(partialCheck.isValid, false);
  assert.equal(partialCheck.ingestedCount, 3);
  assert.equal(partialCheck.missingFrames.length, 21); // frames 4..24 are missing

  // Complete batch: 24 frames
  const completeFiles = Array.from({ length: 24 }, (_, i) => `frame_${String(i + 1).padStart(2, '0')}.png`);
  const completeCheck = validateBatchIngestion(testBatch, completeFiles);
  assert.equal(completeCheck.isValid, true);
  assert.equal(completeCheck.ingestedCount, 24);
  assert.equal(completeCheck.missingFrames.length, 0);
});

test('generateFfmpeg24fpsStitchScript: retired generator returns no executable or synthetic fallback', () => {
  assert.throws(() => generateFfmpeg24fpsStitchScript('proj_ternfall_01', 'S01E001'), /Legacy media scripts are retired/);
});

test('generateFlowAutoWorkerScript: fails explicitly instead of fabricating frames', () => {
  const worker = generateFlowAutoWorkerScript('proj_ternfall_01', 'S01E001', 600);
  assert.ok(worker.includes('not implemented'));
  assert.ok(worker.includes('process.exitCode = 1'));
  assert.ok(!worker.includes('writeFile'));
});

test('generateLocalAudioMixScript: retired generator returns no executable or synthetic fallback', () => {
  assert.throws(() => generateLocalAudioMixScript('proj_ternfall_01', 'S01E001'), /Legacy media scripts are retired/);
});

test('generateCompleteYouTubeRenderScript: retired generator returns no executable or synthetic fallback', () => {
  assert.throws(() => generateCompleteYouTubeRenderScript('proj_ternfall_01', 'S01E001'), /Legacy media scripts are retired/);
});

test('generateYouTubeMetadataPackage: retired instead of inventing publishing metadata', () => {
  assert.throws(() => generateYouTubeMetadataPackage('S01E001', 'Title', 'Logline'), /metadata generation is retired/);
});

test('computeFlowCheckpoint: calculates accurate progress and resume batch index', () => {
  const plan = createGoogleFlowPlan('S01E001', 'The Eight-Beat Failure', 60, 24, 'keyframe_storyboard');
  // 3 batches total
  plan.batches[0].status = 'verified';
  plan.batches[0].verification = { version: 1, checkedAt: new Date().toISOString(), frames: plan.batches[0].prompts.map(prompt => ({ file: `frame_${String(prompt.globalFrameNumber).padStart(5, '0')}.png`, globalFrameNumber: prompt.globalFrameNumber, sha256: 'a'.repeat(64), width: 1920, height: 1080, bytes: 1000 })) };

  const checkpoint = computeFlowCheckpoint(plan);
  assert.equal(checkpoint.episodeId, 'S01E001');
  assert.equal(checkpoint.totalBatches, 3);
  assert.deepEqual(checkpoint.completedBatchIndices, [1]);
  assert.equal(checkpoint.lastCompletedBatchIndex, 1);
  assert.equal(checkpoint.nextBatchIndex, 2);
  assert.equal(checkpoint.isComplete, false);

  const resumePoint = computeFlowResumePoint(checkpoint);
  assert.equal(resumePoint.shouldResume, true);
  assert.equal(resumePoint.nextBatchIndex, 2);
  assert.equal(resumePoint.remainingBatches, 2);
});

test('createFlowAutoproduceOrchestrator: retired rather than inventing deliverables', () => {
  assert.throws(() => createFlowAutoproduceOrchestrator('proj_ternfall_01', 'S01E001', 'Title', 'Logline'), /Automatic production is unavailable/);
});

test('partial batches, keyframe timing and non-24fps prompts match the actual plan', () => {
  const keyframes = createGoogleFlowPlan('ep', 'Title', 25, 24, 'keyframe_storyboard', 'project_b');
  assert.deepEqual(keyframes.batches.map(batch => batch.framesExpected), [24, 1]);
  assert.equal(keyframes.batches[1].prompts[0].timecode, '00:24.000');
  assert.equal(keyframes.batches[1].timecodeRange.end, '00:25.000');
  assert.ok(keyframes.outputDirectory.includes('/project_b/'));
  const dense = createGoogleFlowPlan('ep', 'Title', 1, 30);
  assert.deepEqual(dense.batches.map(batch => batch.framesExpected), [24, 6]);
  assert.equal(dense.batches[1].prompts[0].timecode, '00:00.800');
  assert.equal(dense.batches[1].timecodeRange.end, '00:01.000');
});

test('filename checks reject wrong global indices, duplicates, arbitrary names and traversal', () => {
  const plan = createGoogleFlowPlan('ep', 'Title', 25, 24, 'keyframe_storyboard');
  const batch = plan.batches[1];
  assert.equal(validateBatchIngestion(batch, ['frame_00025.png']).isValid, true);
  for (const files of [['frame_00001.png'], ['frame_00025.png', 'frame_00025.png'], ['anything.png'], ['../frame_00025.png'], ['frame_00025.jpg']]) {
    assert.equal(validateBatchIngestion(batch, files).isValid, false);
  }
});

test('resume ignores forged completion flags and duplicated completion indices', () => {
  const checkpoint = computeFlowCheckpoint(createGoogleFlowPlan('ep', 'Title', 60, 24, 'keyframe_storyboard'));
  checkpoint.isComplete = true; checkpoint.completedBatchIndices = [1, 1, 3]; checkpoint.nextBatchIndex = 3;
  const resume = computeFlowResumePoint(checkpoint);
  assert.equal(resume.shouldResume, true); assert.equal(resume.nextBatchIndex, 2); assert.equal(resume.remainingBatches, 1);
});
