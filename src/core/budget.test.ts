import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateMediaOperationCost,
  evaluateSpendAuthorization,
  BudgetCaps,
} from './budget.ts';

test('estimateMediaOperationCost: calculates still image and video seconds correctly', () => {
  // 10 images @ $0.0336
  const imgCost = estimateMediaOperationCost({ modality: 'image', countOrUnits: 10 });
  assert.equal(imgCost.costUsd, 0.336);

  // 30 seconds of Omni Flash 1.1 video @ $0.10/sec = $3.00
  const vidCost = estimateMediaOperationCost({ modality: 'video', countOrUnits: 30 });
  assert.equal(vidCost.costUsd, 3.0);
});

test('evaluateSpendAuthorization: blocks unknown cost unless manual ceiling is set', () => {
  const caps: BudgetCaps = {
    perRunCapUsd: 10,
    perEpisodeCapUsd: 50,
    monthlyCapUsd: 200,
    currency: 'USD',
  };

  const unknownRes = evaluateSpendAuthorization({
    projectId: 'proj_1',
    episodeId: 'S01E001',
    provider: 'gemini_omni',
    estimatedCostUsd: 0,
    isCostEstimateUnknown: true,
    caps,
    currentMonthlySpentUsd: 10,
    currentEpisodeSpentUsd: 5,
    currentRunSpentUsd: 0,
  });

  assert.equal(unknownRes.authorized, false);
  assert.equal(unknownRes.requiresManualCeilingConfirmation, true);
});

test('evaluateSpendAuthorization: enforces per-run, per-episode, and monthly caps', () => {
  const caps: BudgetCaps = {
    perRunCapUsd: 15,
    perEpisodeCapUsd: 40,
    monthlyCapUsd: 100,
    currency: 'USD',
  };

  // Exceeds per-run cap
  const perRunRes = evaluateSpendAuthorization({
    projectId: 'proj_1',
    episodeId: 'S01E001',
    provider: 'gemini_omni',
    estimatedCostUsd: 16,
    caps,
    currentMonthlySpentUsd: 20,
    currentEpisodeSpentUsd: 5,
    currentRunSpentUsd: 0,
  });
  assert.equal(perRunRes.authorized, false);
  assert.match(perRunRes.reason!, /Exceeds per-run cap/);

  // Valid within cap, with a scoped operator grant
  const validRes = evaluateSpendAuthorization({
    projectId: 'proj_1',
    episodeId: 'S01E001',
    provider: 'gemini_nano',
    estimatedCostUsd: 5,
    caps,
    currentMonthlySpentUsd: 20,
    currentEpisodeSpentUsd: 10,
    currentRunSpentUsd: 2,
  });
  assert.equal(validRes.authorized, false);
  assert.match(validRes.reason!, /approval grant is required/);
  assert.equal(validRes.reservationId, undefined);
});

test('evaluateSpendAuthorization: verifies approval grant revocation, expiration, and provider limits', () => {
  const caps: BudgetCaps = {
    perRunCapUsd: 50,
    perEpisodeCapUsd: 100,
    monthlyCapUsd: 300,
    currency: 'USD',
  };

  // 1. Revoked grant
  const revokedRes = evaluateSpendAuthorization({
    projectId: 'proj_1',
    episodeId: 'S01E001',
    provider: 'gemini_nano',
    estimatedCostUsd: 5,
    caps,
    currentMonthlySpentUsd: 0,
    currentEpisodeSpentUsd: 0,
    currentRunSpentUsd: 0,
    approvalGrant: {
      approvalId: 'grant_revoked',
      issuedBy: 'operator',
      projectId: 'proj_1',
      episodeId: 'S01E001',
      maxBudgetUsd: 50,
      currency: 'USD',
      allowedProviders: ['gemini_nano'],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: true,
      actualSpentUsd: 0,
      createdAt: new Date().toISOString(),
    },
  });
  assert.equal(revokedRes.authorized, false);
  assert.match(revokedRes.reason!, /revoked/);

  // 2. Expired grant
  const expiredRes = evaluateSpendAuthorization({
    projectId: 'proj_1',
    episodeId: 'S01E001',
    provider: 'gemini_nano',
    estimatedCostUsd: 5,
    caps,
    currentMonthlySpentUsd: 0,
    currentEpisodeSpentUsd: 0,
    currentRunSpentUsd: 0,
    approvalGrant: {
      approvalId: 'grant_expired',
      issuedBy: 'operator',
      projectId: 'proj_1',
      episodeId: 'S01E001',
      maxBudgetUsd: 50,
      currency: 'USD',
      allowedProviders: ['gemini_nano'],
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      isRevoked: false,
      actualSpentUsd: 0,
      createdAt: new Date().toISOString(),
    },
  });
  assert.equal(expiredRes.authorized, false);
  assert.match(expiredRes.reason!, /expired/);

  // 3. Provider not authorized in grant
  const providerMismatchRes = evaluateSpendAuthorization({
    projectId: 'proj_1',
    episodeId: 'S01E001',
    provider: 'unauthorized_provider',
    estimatedCostUsd: 5,
    caps,
    currentMonthlySpentUsd: 0,
    currentEpisodeSpentUsd: 0,
    currentRunSpentUsd: 0,
    approvalGrant: {
      approvalId: 'grant_prov',
      issuedBy: 'operator',
      projectId: 'proj_1',
      episodeId: 'S01E001',
      maxBudgetUsd: 50,
      currency: 'USD',
      allowedProviders: ['gemini_nano'],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: false,
      actualSpentUsd: 0,
      createdAt: new Date().toISOString(),
    },
  });
  assert.equal(providerMismatchRes.authorized, false);
  assert.match(providerMismatchRes.reason!, /not authorized in this spend approval grant/);

  // 4. Grant budget exhausted
  const exhaustedRes = evaluateSpendAuthorization({
    projectId: 'proj_1',
    episodeId: 'S01E001',
    provider: 'gemini_nano',
    estimatedCostUsd: 15,
    caps,
    currentMonthlySpentUsd: 0,
    currentEpisodeSpentUsd: 0,
    currentRunSpentUsd: 0,
    approvalGrant: {
      approvalId: 'grant_exhausted',
      issuedBy: 'operator',
      projectId: 'proj_1',
      episodeId: 'S01E001',
      maxBudgetUsd: 20,
      currency: 'USD',
      allowedProviders: ['gemini_nano'],
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isRevoked: false,
      actualSpentUsd: 10, // 10 + 15 = 25 > 20
      createdAt: new Date().toISOString(),
    },
  });
  assert.equal(exhaustedRes.authorized, false);
  assert.match(exhaustedRes.reason!, /exhausted/);
});

