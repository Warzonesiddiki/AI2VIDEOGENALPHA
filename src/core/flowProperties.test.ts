import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFlowBatchRequirements } from './flow.ts';

test('bounded Flow inventory conserves frame counts and distributes illustrative slots evenly', () => {
  // Deterministic boundary sampling, no additional property-test dependency.
  const durations = [...Array.from({ length: 53 }, (_, i) => 1 + i * 17), 900];
  const rates = [1, 2, 3, 23, 24, 25, 29, 30, 48, 59, 60];
  for (const duration of durations) for (const fps of rates) for (const mode of ['dense_24fps', 'keyframe_storyboard'] as const) {
    const req = calculateFlowBatchRequirements(duration, fps, mode);
    const expected = mode === 'dense_24fps' ? duration * fps : duration;
    const slots = Object.values(req.batchesPerAccount);
    assert.equal(req.totalFramesExpected, expected);
    assert.ok((req.totalBatches - 1) * req.batchSize < expected);
    assert.ok(req.totalBatches * req.batchSize >= expected);
    assert.equal(slots.reduce((sum, value) => sum + value, 0), req.totalBatches);
    assert.ok(Math.max(...slots) - Math.min(...slots) <= 1);
  }
});
