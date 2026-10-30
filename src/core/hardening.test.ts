import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSpendAuthorization, type SpendReservationRequest } from './budget.ts';
import { calculateFlowBatchRequirements, createFlowAutoproduceOrchestrator, createGoogleFlowPlan, computeFlowCheckpoint, generateFfmpeg24fpsStitchScript } from './flow.ts';
import { validateResearchSourceUrl } from './sources.ts';

function request(): SpendReservationRequest {
  return {
    projectId: 'p', episodeId: 'e', provider: 'provider', estimatedCostUsd: 1,
    caps: { perRunCapUsd: 10, perEpisodeCapUsd: 20, monthlyCapUsd: 30, currency: 'USD' },
    currentMonthlySpentUsd: 0, currentEpisodeSpentUsd: 0, currentRunSpentUsd: 0,
    approvalGrant: { approvalId: 'g', issuedBy: 'operator', projectId: 'p', episodeId: 'e',
      maxBudgetUsd: 5, actualSpentUsd: 0, currency: 'USD', allowedProviders: ['provider'],
      isRevoked: false, expiresAt: new Date(Date.now() + 60000).toISOString(), createdAt: new Date().toISOString() },
  };
}

test('spend evaluation accepts a valid scoped grant but never mints a fake reservation', () => {
  const result = evaluateSpendAuthorization(request());
  assert.equal(result.authorized, true);
  assert.equal(result.reservationId, undefined);
});

test('spend rejects missing approval, nonfinite/negative inputs and invalid grant scope', () => {
  assert.equal(evaluateSpendAuthorization({ ...request(), approvalGrant: undefined }).authorized, false);
  for (const value of [NaN, Infinity, -1]) {
    for (const field of ['estimatedCostUsd', 'currentRunSpentUsd', 'currentEpisodeSpentUsd', 'currentMonthlySpentUsd']) {
      assert.equal(evaluateSpendAuthorization({ ...request(), [field]: value }).authorized, false);
    }
  }
  for (const patch of [{ projectId: 'other' }, { episodeId: 'other' }, { currency: 'INR' }, { expiresAt: 'invalid' }, { maxBudgetUsd: NaN }, { actualSpentUsd: -1 }]) {
    const req = request(); Object.assign(req.approvalGrant!, patch);
    assert.equal(evaluateSpendAuthorization(req).authorized, false, JSON.stringify(patch));
  }
});

test('planning bounds prohibit unbounded allocation and invalid script identifiers', () => {
  for (const value of [NaN, Infinity, 0, -1, 901]) assert.throws(() => calculateFlowBatchRequirements(value));
  for (const value of [NaN, Infinity, 0, 61, 2.5]) assert.throws(() => calculateFlowBatchRequirements(10, value));
  assert.throws(() => calculateFlowBatchRequirements(10, 24, 'bad' as any));
  assert.throws(() => generateFfmpeg24fpsStitchScript('$(touch bad)', 'e'));
  assert.throws(() => generateFfmpeg24fpsStitchScript('p', 'e', 24, '$(id)'));
});

test('draft planning cannot certify frames or produce an automatic run', () => {
  assert.throws(() => createFlowAutoproduceOrchestrator('p', 'e', 'Original title', 'Original logline', { durationSeconds: 1 }), /unavailable/);
  const plan = createGoogleFlowPlan('e', 'Original title', 1, 24, 'dense_24fps', 'p');
  assert.equal(plan.summary.totalFramesIngested, 0);
  assert.equal(plan.summary.verifiedBatches, 0);
  assert.ok(plan.batches.every(batch => batch.status === 'pending' && !batch.verification));
  assert.equal(computeFlowCheckpoint(plan).isComplete, false);
});

test('URL guard rejects IPv6 literal loopback and mapped private addresses', () => {
  for (const url of ['http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'http://[fc00::1]/']) {
    assert.equal(validateResearchSourceUrl(url).isValid, false);
  }
});
