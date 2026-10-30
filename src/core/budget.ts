/**
 * Ternfall Studio - Budget & Atomic Spend Authorization
 * Enforces per-run, per-episode, and monthly caps across concurrent jobs and providers.
 * Adheres strictly to Master Project Rules & Matrix 15 (P-07).
 */

import { SpendApprovalGrant } from '../types/index.ts';

export interface BudgetCaps {
  perRunCapUsd: number;
  perEpisodeCapUsd: number;
  monthlyCapUsd: number;
  currency: string;
}

export interface SpendReservationRequest {
  projectId: string;
  episodeId?: string;
  provider: string;
  estimatedCostUsd: number;
  approvalGrant?: SpendApprovalGrant;
  caps: BudgetCaps;
  currentMonthlySpentUsd: number;
  currentEpisodeSpentUsd: number;
  currentRunSpentUsd: number;
  isCostEstimateUnknown?: boolean;
}

export interface SpendReservationResult {
  authorized: boolean;
  reservationId?: string;
  reservedAmountUsd: number;
  reason?: string;
  requiresManualCeilingConfirmation: boolean;
}

/**
 * Calculates estimated cost for media operations based on verified provider pricing snapshots.
 * Dated Oct 2026:
 * - Nano Banana 2.1: ~$0.0336 per 1K image
 * - Gemini Omni Flash 1.1: ~$0.10 per generated second of 720p video
 * - Cloud TTS Chirp 3: ~$30 per million characters (first 1M free/month)
 */
export function estimateMediaOperationCost(params: {
  modality: 'image' | 'video' | 'tts' | 'text';
  countOrUnits: number; // images count, video seconds, or characters
  retriesAllowed?: number;
}): { costUsd: number; costBreakdown: string } {
  if (!Number.isFinite(params.countOrUnits) || params.countOrUnits < 0 ||
      !Number.isInteger(params.retriesAllowed ?? 0) || (params.retriesAllowed ?? 0) < 0 || (params.retriesAllowed ?? 0) > 10) {
    throw new Error('Invalid cost estimation units or retry count');
  }
  const retries = params.retriesAllowed || 0;
  const multiplier = 1 + retries;

  switch (params.modality) {
    case 'image': {
      const perImage = 0.0336;
      const total = params.countOrUnits * perImage * multiplier;
      return {
        costUsd: Number(total.toFixed(4)),
        costBreakdown: `${params.countOrUnits} images @ $0.0336/img (incl. ${retries} retry headroom)`,
      };
    }
    case 'video': {
      const perSec = 0.1; // Omni Flash 1.1 720p rate
      const total = params.countOrUnits * perSec * multiplier;
      return {
        costUsd: Number(total.toFixed(2)),
        costBreakdown: `${params.countOrUnits} generated seconds @ $0.10/sec (Omni Flash 720p)`,
      };
    }
    case 'tts': {
      const perMillionChars = 30.0;
      const total = (params.countOrUnits / 1_000_000) * perMillionChars;
      return {
        costUsd: Number(total.toFixed(4)),
        costBreakdown: `${params.countOrUnits} characters @ $30/M chars`,
      };
    }
    case 'text':
    default: {
      return {
        costUsd: 0.005,
        costBreakdown: 'Script/prompt structured text tokens',
      };
    }
  }
}

/**
 * Evaluates whether a proposed spend is authorized under active caps and approval grant.
 * Fails closed if cost is unknown without explicit manual maximum.
 */
export function evaluateSpendAuthorization(
  req: SpendReservationRequest
): SpendReservationResult {
  const deny = (reason: string): SpendReservationResult => ({ authorized: false, reservedAmountUsd: 0, requiresManualCeilingConfirmation: false, reason });
  const values = [req.estimatedCostUsd, req.currentMonthlySpentUsd, req.currentEpisodeSpentUsd,
    req.currentRunSpentUsd, req.caps.perRunCapUsd, req.caps.perEpisodeCapUsd, req.caps.monthlyCapUsd];
  if (values.some(value => !Number.isFinite(value) || value < 0)) return deny('Spend amounts and caps must be finite nonnegative numbers.');

  // 1. Unknown cost check: fails closed
  if (req.isCostEstimateUnknown) {
    return {
      authorized: false,
      reservedAmountUsd: 0,
      requiresManualCeilingConfirmation: true,
      reason: 'Cost estimate is unknown. An explicit manual spending ceiling must be approved before proceeding.',
    };
  }

  const cost = req.estimatedCostUsd;

  // 2. Check per-run cap
  if (req.currentRunSpentUsd + cost > req.caps.perRunCapUsd) {
    return {
      authorized: false,
      reservedAmountUsd: 0,
      requiresManualCeilingConfirmation: false,
      reason: `Exceeds per-run cap ($${req.caps.perRunCapUsd}). Current run: $${req.currentRunSpentUsd.toFixed(2)}, Proposed: $${cost.toFixed(2)}.`,
    };
  }

  // 3. Check per-episode cap
  if (req.currentEpisodeSpentUsd + cost > req.caps.perEpisodeCapUsd) {
    return {
      authorized: false,
      reservedAmountUsd: 0,
      requiresManualCeilingConfirmation: false,
      reason: `Exceeds per-episode cap ($${req.caps.perEpisodeCapUsd}). Episode total: $${req.currentEpisodeSpentUsd.toFixed(2)}, Proposed: $${cost.toFixed(2)}.`,
    };
  }

  // 4. Check monthly cap
  if (req.currentMonthlySpentUsd + cost > req.caps.monthlyCapUsd) {
    return {
      authorized: false,
      reservedAmountUsd: 0,
      requiresManualCeilingConfirmation: false,
      reason: `Exceeds monthly project cap ($${req.caps.monthlyCapUsd}). Monthly total: $${req.currentMonthlySpentUsd.toFixed(2)}, Proposed: $${cost.toFixed(2)}.`,
    };
  }

  if (!req.approvalGrant) return deny('An explicit operator spend approval grant is required.');

  // 5. Verify the approval grant; this is a decision, NOT a persisted reservation.
  if (req.approvalGrant) {
    if (req.approvalGrant.isRevoked) {
      return {
        authorized: false,
        reservedAmountUsd: 0,
        requiresManualCeilingConfirmation: false,
        reason: 'The specified spend approval grant has been revoked.',
      };
    }

    const expiryTime = new Date(req.approvalGrant.expiresAt).getTime();
    if (!Number.isFinite(expiryTime) || Date.now() >= expiryTime) {
      return {
        authorized: false,
        reservedAmountUsd: 0,
        requiresManualCeilingConfirmation: false,
        reason: 'The specified spend approval grant has expired.',
      };
    }

    if (
      req.approvalGrant.allowedProviders.length > 0 &&
      !req.approvalGrant.allowedProviders.includes(req.provider)
    ) {
      return {
        authorized: false,
        reservedAmountUsd: 0,
        requiresManualCeilingConfirmation: false,
        reason: `Provider "${req.provider}" is not authorized in this spend approval grant.`,
      };
    }

    const grant = req.approvalGrant;
    if (grant.projectId !== req.projectId || (grant.episodeId !== 'all' && grant.episodeId !== req.episodeId)) {
      return deny('Approval grant project/episode scope does not match this operation.');
    }
    if (grant.currency !== req.caps.currency) return deny('Approval grant currency does not match caps.');
    if (![grant.actualSpentUsd, grant.maxBudgetUsd].every(value => Number.isFinite(value) && value >= 0)) {
      return deny('Approval grant amounts must be finite nonnegative numbers.');
    }

    if (req.approvalGrant.actualSpentUsd + cost > req.approvalGrant.maxBudgetUsd) {
      return {
        authorized: false,
        reservedAmountUsd: 0,
        requiresManualCeilingConfirmation: false,
        reason: `Grant budget exhausted. Limit: $${req.approvalGrant.maxBudgetUsd}, already utilized: $${req.approvalGrant.actualSpentUsd}.`,
      };
    }
  }

  // All checks pass
  return {
    authorized: true,
    reservedAmountUsd: cost,
    // No reservation is minted by this pure evaluator. Paid execution remains disabled.
    requiresManualCeilingConfirmation: false,
  };
}
