import { sendInternalApiError } from './lib/apiErrors.ts';
import { arcExpansionHandler } from './arcEdits.ts';
import { projectEditHandler, projectListHandler } from './projectEdits.ts';
import { researchEditHandler } from './researchEdits.ts';
import { configEditHandler, settingsReadHandler } from './configEdits.ts';
import { flowPlanRouter } from './flowRoutes.ts';
import { episodeEditHandler } from './episodeEdits.ts';
import { episodeCreationHandler, episodeDuplicationHandler, episodeCheckHandler } from './episodeCommands.ts';
import {
  seriesReadHandler, episodeListHandler, episodeReadHandler, researchListHandler,
  jobListHandler, autoproduceListHandler, spendGrantListHandler, packageListHandler,
} from './readHandlers.ts';
import { localMedia } from './localMedia.ts';
import { localMediaRouter } from './localMediaRoutes.ts';
import { assertIdentifier } from './lib/paths.ts';
/**
 * Ternfall Studio - Express API Routes
 * Complete REST API powering the local-first production studio.
 */

import { Router, Request, Response } from 'express';
import { storage } from './storage.ts';
import {
  checkEpisodeDistinctness,
  validateCanonHardRules,
} from '../src/core/rules.ts';
import { pacingCalculationHandler } from './pacingHandler.ts';
import {
  evaluateSpendAuthorization,
  estimateMediaOperationCost,
} from '../src/core/budget.ts';
import {
  validateResearchSourceUrl,
  sanitizeUntrustedResearchContent,
} from '../src/core/sources.ts';
import {
  handleExternalOperationTimeout,
} from '../src/core/jobs.ts';
import {
  EpisodeCard,
  GoogleFlowPlan,
  GoogleFlowBatch,
} from '../src/types/index.ts';
import {
  createGoogleFlowPlan,
  validateBatchIngestion,
  computeFlowCheckpoint,
  createFlowAutoproduceOrchestrator,
} from '../src/core/flow.ts';

export const apiRouter = Router();

for (const name of ['id', 'epId', 'batchId', 'jobId', 'runId']) {
  apiRouter.param(name, (_req, res, next, value) => {
    try { assertIdentifier(value); next(); }
    catch { res.set('Cache-Control', 'no-store').status(400).json({ ok: false, code: 'INVALID_IDENTIFIER', error: 'Invalid identifier.' }); }
  });
}
apiRouter.use((req, res, next) => {
  for (const key of ['episodeId', 'projectId', 'batchId']) {
    try { if (req.body?.[key] !== undefined) assertIdentifier(req.body[key]); }
    catch { res.set('Cache-Control', 'no-store').status(400).json({ ok: false, code: 'INVALID_IDENTIFIER', error: 'Invalid identifier.' }); return; }
  }
  if (req.path.includes('/flow/')) {
    for (const [key, maximum, code, message] of [
      ['durationSeconds', 900, 'FLOW_INVALID_DURATION', 'Duration must be an integer between 1 and 900 seconds.'],
      ['fps', 60, 'FLOW_INVALID_FPS', 'FPS must be an integer between 1 and 60.'],
    ] as const) {
      const value = req.body?.[key];
      if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > maximum)) {
        res.set('Cache-Control', 'no-store').status(400).json({ ok: false, code, error: message }); return;
      }
    }
  }
  next();
});

// Fail closed instead of returning fabricated production evidence. These routes
// are re-enabled only when their execution/verification services are implemented.
apiRouter.use((req, res, next) => {
  const routePath = req.path.toLowerCase().replace(/\/+$/, '');
  const unsafe = /\/episodes\/[^/]+\/render-script$/.test(routePath) ||
    /\/autoproduce(?:\/start|\/[^/]+\/advance)$/.test(routePath) ||
    /\/jobs\/[^/]+\/(?:transition|reconcile)$/.test(routePath) ||
    /\/youtube\/package$/.test(routePath) ||
    (req.method === 'POST' && /\/spend-grants(?:\/[^/]+\/revoke)?$/.test(routePath)) ||
    /\/flow\/(?:(?:stitch|autoworker|generate-audio|master-render|autoproduce|youtube-package)\/[^/]+|batch\/[^/]+\/status|cleanup-cache\/[^/]+|account-health|storage-stats\/[^/]+)$/.test(routePath);
  if (unsafe) {
    res.status(501).json({ ok: false, error: 'Not implemented safely: production execution, verification, telemetry and spend approvals are unavailable. No action was performed.' });
    return;
  }
  next();
});


apiRouter.use('/projects/:id/flow', flowPlanRouter(storage));

apiRouter.use('/projects/:id/local-renders', localMediaRouter(localMedia, storage));

// ---------------------------------------------------------------------------
// Health & Diagnostics ("Doctor")
// ---------------------------------------------------------------------------

apiRouter.get('/doctor', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    const diagnostics = await storage.runDoctorDiagnostics();
    res.json({ ok: true, data: diagnostics });
  } catch {
    sendInternalApiError(res);
  }
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

apiRouter.get('/projects', projectListHandler(storage));

apiRouter.post('/projects', projectEditHandler(storage, 'create'));

apiRouter.post('/projects/:id/archive', projectEditHandler(storage, 'archive'));

// ---------------------------------------------------------------------------
// Series Bible & Roadmap
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/series', seriesReadHandler(storage));

apiRouter.put('/projects/:id/series', configEditHandler(storage, 'series'));

apiRouter.get('/roadmap/arcs', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const arcs = storage.getRoadmapArcs();
  res.json({ ok: true, data: arcs });
});

apiRouter.post('/projects/:id/arcs/expand', arcExpansionHandler(storage));

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/episodes', episodeListHandler(storage));

apiRouter.get('/projects/:id/episodes/:epId', episodeReadHandler(storage));

apiRouter.post('/projects/:id/episodes/create', episodeCreationHandler(storage));
apiRouter.post('/projects/:id/episodes', episodeEditHandler(storage));
apiRouter.post('/projects/:id/episodes/:epId/duplicate', episodeDuplicationHandler(storage));
apiRouter.post('/projects/:id/episodes/:epId/check', episodeCheckHandler(storage));

// ---------------------------------------------------------------------------
// Script Drafting & Pacing
// ---------------------------------------------------------------------------

apiRouter.post('/pacing/calculate', pacingCalculationHandler);

// ---------------------------------------------------------------------------
// Research Room & Fact Ledger
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/research', researchListHandler(storage));

apiRouter.post('/projects/:id/research', researchEditHandler(storage));

apiRouter.post('/research/validate-url', (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const { url } = req.body;
  const result = validateResearchSourceUrl(url);
  res.json({ ok: true, data: result });
});

// ---------------------------------------------------------------------------
// Production Queue & Jobs
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/jobs', jobListHandler(storage));





// ---------------------------------------------------------------------------
// End-to-End Autoproducer
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/autoproduce', autoproduceListHandler(storage));





// ---------------------------------------------------------------------------
// Spend Approval Grants (Safety Gate & Operator Authorizations)
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/spend-grants', spendGrantListHandler(storage));





// ---------------------------------------------------------------------------
// Local Rendering Scripts (FFmpeg composite generator for Windows/WSL2/Linux)
// ---------------------------------------------------------------------------



apiRouter.get('/projects/:id/episodes/:epId/video-essay', (_req: Request, res: Response) => {
  res.status(410).json({ ok: false, code: 'RETIRED', error: 'The legacy Video Essay endpoint returned unscoped sample scripts and is retired. Use Local Render for supplied assets.' });
});

// ---------------------------------------------------------------------------
// YouTube Operations & Packaging
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/youtube', packageListHandler(storage));



// ---------------------------------------------------------------------------
// AI Generation & In-App CLI Runner
// ---------------------------------------------------------------------------

import { geminiAdapter } from './geminiAdapter.ts';
import { buildStoryOutline } from '../src/core/storyCraft.ts';

apiRouter.post('/generate/outline', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  const { workingTitle, logline, characters, location, canonNotes } = req.body ?? {};
  const brief = { workingTitle, logline, characters, location, canonNotes };
  // Validate before the adapter even when paid execution is disabled.
  try { buildStoryOutline(brief); }
  catch {
    res.status(400).json({ ok: false, code: 'OUTLINE_INVALID_BRIEF', error: 'Provide a bounded title, logline, location and 1–12 characters for the local outline.' });
    return;
  }
  try { res.json({ ok: true, data: await geminiAdapter.generateOutline(brief) }); }
  catch { sendInternalApiError(res); }
});

apiRouter.post('/cli/execute', (_req: Request, res: Response) => {
  res.status(410).json({ ok: false, code: 'RETIRED', error: 'The in-browser pseudo-CLI did not execute the typed CLI and has been retired. Run documented studio commands in an authorized local terminal.' });
});

// Legacy Flow status, cleanup and telemetry handlers were removed. The guard
// above fails closed; frame evidence is written only by the verification route.

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

apiRouter.get('/settings', settingsReadHandler(storage));

apiRouter.put('/settings', configEditHandler(storage, 'settings'));
