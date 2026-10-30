import { verifyFlowBatch } from './flowVerification.ts';
import { Router, type Request, type Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { createGoogleFlowPlan, computeFlowCheckpoint } from '../src/core/flow.ts';
import { assertIdentifier } from './lib/paths.ts';
import { RevisionConflict, assertRevision } from './lib/conflicts.ts';

export function flowPlanRouter(storage: StorageEngine) {
  const router = Router({ mergeParams: true });
  const handle = (action: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      assertIdentifier(req.params.id);
      if (req.params.epId !== undefined) assertIdentifier(req.params.epId);
      await action(req, res);
    } catch (error: any) {
      res.status(error instanceof RevisionConflict ? 409 : 400).json({ ok: false, code: error.code, currentRevision: error.currentRevision, error: error.message });
    }
  };
  router.get('/plan/:epId', handle(async (req, res) => {
    const plan = await storage.getGoogleFlowPlan(req.params.id, req.params.epId);
    if (!plan) { res.status(404).json({ ok: false, error: 'Plan not prepared; create it explicitly with POST' }); return; }
    res.json({ ok: true, data: plan });
  }));
  router.post('/plan/:epId', handle(async (req, res) => {
    const { durationSeconds = 600, fps = 24, mode = 'dense_24fps', expectedRevision } = req.body ?? {};
    assertRevision(expectedRevision);
    if (!(await storage.getEpisode(req.params.id, req.params.epId))) { res.status(404).json({ ok: false, error: 'Episode not found' }); return; }
    if (!Number.isInteger(durationSeconds)) throw new Error('Duration must be an integer number of seconds');
    const plan = createGoogleFlowPlan(req.params.epId, '', durationSeconds, fps, mode, req.params.id);
    plan.episodeTitle = (await storage.getEpisode(req.params.id, req.params.epId))!.workingTitle;
    plan.revision = expectedRevision;
    await storage.saveGoogleFlowPlan(req.params.id, plan);
    res.json({ ok: true, data: plan });
  }));
  router.get('/checkpoint/:epId', handle(async (req, res) => {
    const plan = await storage.getGoogleFlowPlan(req.params.id, req.params.epId);
    if (!plan) { res.status(404).json({ ok: false, error: 'Plan not prepared; create it explicitly with POST' }); return; }
    res.json({ ok: true, data: computeFlowCheckpoint(plan) });
  }));
  router.post('/ingest', handle(async (req, res) => {
    const { episodeId, batchId, expectedRevision, simulate, fileNames } = req.body ?? {};
    assertIdentifier(episodeId); assertIdentifier(batchId); assertRevision(expectedRevision);
    if (simulate !== undefined || fileNames !== undefined) throw new Error('Simulation and caller-supplied filename claims are not accepted. Place actual frames in the episode render directory.');
    const result = await verifyFlowBatch(storage, req.params.id, episodeId, batchId, expectedRevision);
    res.json({ ok: true, data: result });
  }));
  return router;
}
