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

  // 5. If an explicit approval grant is provided, verify scope & expiry
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
    if (Date.now() > expiryTime) {
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
    reservationId: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    requiresManualCeilingConfirmation: false,
  };
}
