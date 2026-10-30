import path from 'node:path';
import type { StorageEngine } from './storage.ts';
import { assertIdentifier, safePath } from './lib/paths.ts';
import { EpisodeSourceConflict, RevisionConflict, assertRevision } from './lib/conflicts.ts';
import { validateFrameFile, FrameInputError } from './lib/frameValidation.ts';
import { FlowRequestError } from './lib/flowErrors.ts';
import { recomputeFlowSummary } from '../src/core/flow.ts';

/** Decode real files, then compare-and-swap the plan revision; never generate assets. */
export async function verifyFlowBatch(storage: StorageEngine, projectId: string, episodeId: string, batchId: string, expectedRevision?: number) {
  assertIdentifier(projectId); assertIdentifier(episodeId); assertIdentifier(batchId); assertRevision(expectedRevision);
  const plan = await storage.getGoogleFlowPlan(projectId, episodeId);
  const episode = await storage.getEpisode(projectId, episodeId);
  if (!plan || !episode) throw new FlowRequestError('FLOW_EPISODE_OR_PLAN_NOT_FOUND');
  if ((expectedRevision ?? 0) !== (plan.revision ?? 0)) throw new RevisionConflict(plan.revision ?? 0);
  if (plan.sourceState === 'unknown') throw new FlowRequestError('FLOW_LEGACY_SOURCE');
  if (plan.sourceState !== 'current') throw new EpisodeSourceConflict(episode.revision ?? 0);
  let batch = plan.batches.find(item => item.batchId === batchId);
  if (!batch) throw new FlowRequestError('FLOW_BATCH_NOT_FOUND');
  const first = (batch.batchIndex - 1) * 24 + 1;
  const count = Math.min(24, plan.totalFramesExpected - first + 1);
  if (count < 1 || batch.framesExpected !== count || batch.prompts.length !== count) throw new FlowRequestError('FLOW_LEGACY_BATCH');
  // Revoke old proof BEFORE inspecting files. If that write reports failure,
  // no recheck starts. Before the final evidence commit, failures leave the
  // revoked revision pending unless a newer writer has replaced it; a reported
  // post-commit error is ambiguous and requires a reload.
  if (batch.verification || batch.status === 'verified') {
    delete batch.verification; delete batch.ingestedAt; batch.status = 'pending'; batch.ingestedFiles = [];
    batch.ingestedFrameCount = 0;
    batch.missingFrames = Array.from({ length: count }, (_, index) => first + index);
    recomputeFlowSummary(plan);
    await storage.saveGoogleFlowPlan(projectId, plan);
    // saveGoogleFlowPlan replaces the caller's batches with its committed clone.
    batch = plan.batches.find(item => item.batchId === batchId);
    if (!batch) throw new Error('Committed Flow batch disappeared');
  }
  const root = storage.getProductionRoot();
  const directory = safePath(root, `projects/${projectId}/assets/flow_renders/${episodeId}`);
  const frames = [];
  try {
    for (let offset = 0; offset < count; offset++) {
      const globalFrameNumber = first + offset;
      const name = `frame_${String(globalFrameNumber).padStart(5, '0')}.png`;
      const { buffer: _buffer, ...evidence } = await validateFrameFile(root, path.join(directory, name));
      frames.push({ file: name, globalFrameNumber, ...evidence });
    }
  } catch (error) {
    if (error instanceof FrameInputError) throw new FlowRequestError('FLOW_FRAME_INVALID');
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') throw new FlowRequestError('FLOW_FRAME_MISSING');
    throw error;
  }
  // Nothing is certified until every frame decodes and the loaded revision still matches.
  batch.verification = { version: 1, checkedAt: new Date().toISOString(), frames };
  batch.status = 'verified'; batch.ingestedAt = batch.verification.checkedAt;
  batch.ingestedFiles = frames.map(frame => frame.file); batch.ingestedFrameCount = count; batch.missingFrames = [];
  recomputeFlowSummary(plan);
  await storage.saveGoogleFlowPlan(projectId, plan);
  return { batch, summary: plan.summary, revision: plan.revision };
}
