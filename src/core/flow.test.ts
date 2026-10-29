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

test('generateBatchFramePrompt: enforces Ternfall canon character ingredients and negative prompts', () => {
  const prompt = generateBatchFramePrompt(1, 1, 600, 'The Pressure Drop');

  assert.equal(prompt.frameIndex, 1);
  assert.equal(prompt.globalFrameNumber, 1);
  assert.equal(prompt.timecode, '00:00.000');
  assert.ok(prompt.promptText.includes('Rhea Mistry'));
  assert.ok(prompt.promptText.includes('water engineer'));
  assert.ok(prompt.promptText.includes('South Gate'));
  assert.ok(prompt.negativePrompt.includes('anime'));
  assert.ok(prompt.negativePrompt.includes('manhwa'));
  assert.equal(prompt.negativePrompt, TERNFALL_NEGATIVE_PROMPT);
});

test('createGoogleFlowPlan: maintains $0.00 billable API spend invariant and allocates 24 prompts per batch', () => {
  // Test with a 1-minute slice (60 seconds, 60 batches of 24 = 1440 frames or 3 batches in keyframe)
  const plan = createGoogleFlowPlan('S01E001', 'The Eight-Beat Failure', 60, 24, 'keyframe_storyboard');

  assert.equal(plan.episodeId, 'S01E001');
  assert.equal(plan.fps, 24);
  assert.equal(plan.totalBatches, 3); // 60 / 24 = 2.5 -> 3 batches
  assert.equal(plan.summary.billableApiSpendUsd, 0); // Strictly $0.00

  // Verify accounts are all marked isPro
  assert.equal(plan.accounts.account_1.isPro, true);
  assert.equal(plan.accounts.account_2.isPro, true);
  assert.equal(plan.accounts.account_3.isPro, true);

  // Each batch must have exactly 24 prompts
  assert.equal(plan.batches.length, 3);
  plan.batches.forEach((b) => {
    assert.equal(b.prompts.length, 24);
    assert.equal(b.framesExpected, 24);
  });
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

test('generateFfmpeg24fpsStitchScript: builds a valid 24fps 1080p FFmpeg command', () => {
  const script = generateFfmpeg24fpsStitchScript('proj_ternfall_01', 'S01E001', 24);

  assert.ok(script.includes('-framerate 24'));
  assert.ok(script.includes('-pattern_type glob'));
  assert.ok(script.includes('libx264'));
  assert.ok(script.includes('scale=1920:1080'));
  assert.ok(script.includes('yuv420p'));
  assert.ok(script.includes('flow_master_1080p_24fps.mp4'));
});
