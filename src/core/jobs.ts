/**
 * Ternfall Studio - Job State Machine & External Operation Lifecycle
 * Handles state transitions, timeout handling, idempotency, and reconciliation.
 * Adheres strictly to Master Project Rules & Matrix 15 (B-01 through S-03).
 */

import { JobState, ExternalOperationState, ExternalOperationRecord } from '../types/index.ts';

/**
 * Valid state transitions for GenerationJobs:
 * queued -> running -> (paused | blocked | needs_user | succeeded | failed_recoverable | failed_terminal | cancelled)
 */
export const VALID_JOB_TRANSITIONS: Record<JobState, JobState[]> = {
  queued: ['running', 'cancelled'],
  running: ['paused', 'blocked', 'needs_user', 'succeeded', 'failed_recoverable', 'failed_terminal', 'cancelled', 'retrying'],
  paused: ['running', 'cancelled'],
  blocked: ['queued', 'running', 'cancelled'],
  needs_user: ['running', 'cancelled'],
  retrying: ['running', 'failed_recoverable', 'failed_terminal', 'cancelled'],
  succeeded: [], // terminal
  failed_recoverable: ['queued', 'retrying', 'cancelled'],
  failed_terminal: [], // terminal
  cancelled: [], // terminal
};

export function canTransitionJobState(current: JobState, target: JobState): boolean {
  if (current === target) return true;
  const allowed = VALID_JOB_TRANSITIONS[current] || [];
  return allowed.includes(target);
}

/**
 * Evaluates remote operation status when a network timeout, socket drop, or interruption occurs.
 * Matrix 15 invariant: Never assume "no response" means "no charge or upload".
 */
export function handleExternalOperationTimeout(
  op: ExternalOperationRecord
): ExternalOperationRecord {
  // If the operation was in pending state when disconnected, mark as unknown_external_effect
  if (op.state === 'pending') {
    return {
      ...op,
      state: 'unknown_external_effect',
      mayHaveCharged: true,
      duplicatePossible: true,
      reconciliationRequired: true,
      updatedAt: new Date().toISOString(),
    };
  }
  return op;
}

/**
 * Resolves an external operation during explicit operator reconciliation.
 */
export function reconcileExternalOperation(
  op: ExternalOperationRecord,
  outcome: 'confirmed_succeeded' | 'confirmed_failed',
  evidenceNote: string
): ExternalOperationRecord {
  return {
    ...op,
    state: outcome,
    duplicatePossible: false,
    reconciliationRequired: false,
    reconciliationEvidence: evidenceNote,
    updatedAt: new Date().toISOString(),
  };
}
