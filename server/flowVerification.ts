import path from 'node:path';
import type { StorageEngine } from './storage.ts';
import { assertIdentifier, safePath } from './lib/paths.ts';
import { RevisionConflict, assertRevision } from './lib/conflicts.ts';
import { validateFrameFile } from './lib/frameValidation.ts';
import { recomputeFlowSummary } from '../src/core/flow.ts';

/** Decode real files, then compare-and-swap the plan revision; never generate assets. */
export async function verifyFlowBatch(storage: StorageEngine, projectId: string, episodeId: string, batchId: string, expectedRevision?: number) {
  assertIdentifier(projectId); assertIdentifier(episodeId); assertIdentifier(batchId); assertRevision(expectedRevision);
  const plan = await storage.getGoogleFlowPlan(projectId, episodeId);
  if (!plan || !(await storage.getEpisode(projectId, episodeId))) throw new Error('Episode or plan not found');
  if ((expectedRevision ?? 0) !== (plan.revision ?? 0)) throw new RevisionConflict(plan.revision ?? 0);
  const batch = plan.batches.find(item => item.batchId === batchId);
  if (!batch) throw new Error('Batch not found');
  const first = (batch.batchIndex - 1) * 24 + 1;
  const count = Math.min(24, plan.totalFramesExpected - first + 1);
  if (count < 1 || batch.framesExpected !== count || batch.prompts.length !== count) throw new Error('Legacy plan has incompatible batch sizes; regenerate it using the current revision');
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
    // A failed explicit recheck must revoke old evidence rather than leave a
    // known-bad batch eligible for resume. CAS prevents touching a newer plan.
    if (batch.verification || batch.status === 'verified') {
      delete batch.verification; batch.status = 'pending'; batch.ingestedFiles = [];
      batch.ingestedFrameCount = 0;
      batch.missingFrames = Array.from({ length: count }, (_, index) => first + index);
      recomputeFlowSummary(plan);
      await storage.saveGoogleFlowPlan(projectId, plan);
    }
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
