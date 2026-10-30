import { verifyFlowBatch } from './flowVerification.ts';
import { Router, type Request, type Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { createGoogleFlowPlan, computeFlowCheckpoint } from '../src/core/flow.ts';
import { assertIdentifier } from './lib/paths.ts';
import { EpisodeSourceConflict, RevisionConflict, assertRevision } from './lib/conflicts.ts';
import type { GoogleFlowPlan } from '../src/types/index.ts';
import { episodeFlowContext } from './lib/flowEpisode.ts';
import { FlowRequestError, flowRequestErrors } from './lib/flowErrors.ts';
import { sendInternalApiError } from './lib/apiErrors.ts';

function flowIdentifier(value: unknown): asserts value is string {
  try { assertIdentifier(value); } catch { throw new FlowRequestError('FLOW_INVALID_IDENTIFIER'); }
}
function flowRevision(value: unknown): asserts value is number | undefined {
  try { assertRevision(value); } catch { throw new FlowRequestError('FLOW_INVALID_REVISION'); }
}

function planSummary(plan: GoogleFlowPlan) {
  const { batches: _batches, ...summary } = plan;
  return summary;
}

export function flowPlanRouter(storage: StorageEngine) {
  const router = Router({ mergeParams: true });
  const handle = (action: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      flowIdentifier(req.params.id);
      if (req.params.epId !== undefined) flowIdentifier(req.params.epId);
      await action(req, res);
    } catch (error: unknown) {
      if (res.headersSent || res.destroyed) return;
      if (error instanceof FlowRequestError && typeof error.code === 'string' && Object.hasOwn(flowRequestErrors, error.code)) {
        res.status(400).json({ ok: false, code: error.code, error: flowRequestErrors[error.code] });
      } else if ((error instanceof RevisionConflict || error instanceof EpisodeSourceConflict) && Number.isSafeInteger(error.currentRevision) && error.currentRevision >= 0) {
        const episode = error instanceof EpisodeSourceConflict;
        res.status(409).json({ ok: false, code: episode ? 'EPISODE_REVISION_CONFLICT' : 'REVISION_CONFLICT', currentRevision: error.currentRevision,
          error: episode ? 'The source episode changed after this plan was prepared. Reload and replace the plan before verifying frames.' : 'This record changed since it was loaded. Reload and merge your edits before saving.' });
      } else sendInternalApiError(res);
    }
  };
  router.get('/plan/:epId', handle(async (req, res) => {
    const plan = await storage.getGoogleFlowPlan(req.params.id, req.params.epId);
    if (!plan) { res.status(404).json({ ok: false, error: 'Plan not prepared; create it explicitly with POST' }); return; }
    res.json({ ok: true, data: req.query.view === 'summary' ? planSummary(plan) : plan });
  }));
  router.get('/plan/:epId/batches', handle(async (req, res) => {
    const startText = req.query.start ?? '1', limitText = req.query.limit ?? '24';
    if (typeof startText !== 'string' || !/^[1-9]\d*$/.test(startText) || typeof limitText !== 'string' || !/^[1-9]\d*$/.test(limitText)) throw new FlowRequestError('FLOW_INVALID_PAGE');
    const start = Number(startText), limit = Number(limitText);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(limit) || limit > 100) throw new FlowRequestError('FLOW_INVALID_PAGE');
    const plan = await storage.getGoogleFlowPlan(req.params.id, req.params.epId);
    if (!plan) { res.status(404).json({ ok: false, error: 'Plan not prepared' }); return; }
    if (start > plan.totalBatches) throw new FlowRequestError('FLOW_PAGE_BEYOND_PLAN');
    res.json({ ok: true, data: { revision: plan.revision ?? 0, start, batches: plan.batches.slice(start - 1, start - 1 + limit) } });
  }));
  router.post('/plan/:epId', handle(async (req, res) => {
    const { durationSeconds = 600, fps = 24, mode = 'dense_24fps', expectedRevision } = req.body ?? {};
    flowRevision(expectedRevision);
    const episode = await storage.getEpisode(req.params.id, req.params.epId);
    if (!episode) { res.status(404).json({ ok: false, error: 'Episode not found' }); return; }
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 900) throw new FlowRequestError('FLOW_INVALID_DURATION');
    if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new FlowRequestError('FLOW_INVALID_FPS');
    if (!['dense_24fps', 'keyframe_storyboard'].includes(mode)) throw new FlowRequestError('FLOW_INVALID_MODE');
    const plan = createGoogleFlowPlan(req.params.epId, episode.workingTitle, durationSeconds, fps, mode, req.params.id, episodeFlowContext(episode));
    plan.revision = expectedRevision;
    plan.sourceEpisodeRevision = episode.revision ?? 0;
    await storage.saveGoogleFlowPlan(req.params.id, plan);
    res.json({ ok: true, data: req.query.view === 'summary' ? planSummary(plan) : plan });
  }));
  router.get('/checkpoint/:epId', handle(async (req, res) => {
    const plan = await storage.getGoogleFlowPlan(req.params.id, req.params.epId);
    if (!plan) { res.status(404).json({ ok: false, error: 'Plan not prepared; create it explicitly with POST' }); return; }
    if (plan.sourceState !== 'current') throw new FlowRequestError('FLOW_STALE_PLAN');
    res.json({ ok: true, data: computeFlowCheckpoint(plan) });
  }));
  router.post('/ingest', handle(async (req, res) => {
    const { episodeId, batchId, expectedRevision, simulate, fileNames } = req.body ?? {};
    flowIdentifier(episodeId); flowIdentifier(batchId); flowRevision(expectedRevision);
    if (simulate !== undefined || fileNames !== undefined) throw new FlowRequestError('FLOW_UNSUPPORTED_CLAIMS');
    const result = await verifyFlowBatch(storage, req.params.id, episodeId, batchId, expectedRevision);
    res.json({ ok: true, data: result });
  }));
  return router;
}
