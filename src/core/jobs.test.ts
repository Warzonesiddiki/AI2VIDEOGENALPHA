import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransitionJobState,
  handleExternalOperationTimeout,
  reconcileExternalOperation,
} from './jobs.ts';
import { ExternalOperationRecord } from '../types/index.ts';

test('canTransitionJobState: validates permissible job state transitions', () => {
  // Allowed
  assert.equal(canTransitionJobState('queued', 'running'), true);
  assert.equal(canTransitionJobState('running', 'paused'), true);
  assert.equal(canTransitionJobState('running', 'succeeded'), true);
  assert.equal(canTransitionJobState('running', 'failed_recoverable'), true);
  assert.equal(canTransitionJobState('failed_recoverable', 'retrying'), true);

  // Prohibited: terminal to running
  assert.equal(canTransitionJobState('succeeded', 'running'), false);
  assert.equal(canTransitionJobState('cancelled', 'running'), false);
});

test('handleExternalOperationTimeout: marks pending operations as unknown_external_effect to prevent duplicate charges', () => {
  const pendingOp: ExternalOperationRecord = {
    id: 'op_1',
    operationIntent: 'omni_render_clip',
    idempotencyKey: 'idemp_abc123',
    provider: 'gemini_omni',
    state: 'pending',
    mayHaveCharged: false,
    duplicatePossible: false,
    reconciliationRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const timedOutOp = handleExternalOperationTimeout(pendingOp);
  assert.equal(timedOutOp.state, 'unknown_external_effect');
  assert.equal(timedOutOp.mayHaveCharged, true);
  assert.equal(timedOutOp.duplicatePossible, true);
  assert.equal(timedOutOp.reconciliationRequired, true);
});

test('reconcileExternalOperation: resolves unknown state upon operator verification', () => {
  const unknownOp: ExternalOperationRecord = {
    id: 'op_1',
    operationIntent: 'omni_render_clip',
    idempotencyKey: 'idemp_abc123',
    provider: 'gemini_omni',
    state: 'unknown_external_effect',
    mayHaveCharged: true,
    duplicatePossible: true,
    reconciliationRequired: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const reconciled = reconcileExternalOperation(
    unknownOp,
    'confirmed_succeeded',
    'Verified asset exists in cloud bucket with asset ID #998'
  );

  assert.equal(reconciled.state, 'confirmed_succeeded');
  assert.equal(reconciled.reconciliationRequired, false);
  assert.equal(reconciled.duplicatePossible, false);
  assert.match(reconciled.reconciliationEvidence!, /Verified asset/);
});
