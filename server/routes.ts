import { arcExpansionHandler } from './arcEdits.ts';
import { projectEditHandler } from './projectEdits.ts';
import { researchEditHandler } from './researchEdits.ts';
import { configEditHandler } from './configEdits.ts';
import { flowPlanRouter } from './flowRoutes.ts';
import { episodeEditHandler } from './episodeEdits.ts';
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
  calculateNarrationPacing,
  calculateWordCount,
  checkEpisodeDistinctness,
  validateCanonHardRules,
} from '../src/core/rules.ts';
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
  generateYouTubeMetadataPackage,
  computeFlowCheckpoint,
  createFlowAutoproduceOrchestrator,
} from '../src/core/flow.ts';
import {
  getPilotVideoEssayData,
  generateThinkPadT14RenderScripts,
} from '../src/core/video_essay.ts';

export const apiRouter = Router();

for (const name of ['id', 'epId', 'batchId', 'jobId', 'runId']) {
  apiRouter.param(name, (_req, res, next, value) => {
    try { assertIdentifier(value); next(); }
    catch { res.status(400).json({ ok: false, error: 'Invalid identifier' }); }
  });
}
apiRouter.use((req, res, next) => {
  try {
    for (const key of ['episodeId', 'projectId', 'batchId']) {
      if (req.body?.[key] !== undefined) assertIdentifier(req.body[key]);
    }
    if (req.path.includes('/flow/')) {
      for (const [key, maximum] of [['durationSeconds', 900], ['fps', 60]] as const) {
        const value = req.body?.[key];
        if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > maximum)) {
          throw new Error(`Invalid ${key}`);
        }
      }
    }
    next();
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
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
    /\/flow\/(?:(?:stitch|autoworker|generate-audio|master-render|autoproduce)\/[^/]+|batch\/[^/]+\/status|cleanup-cache\/[^/]+|account-health|storage-stats\/[^/]+)$/.test(routePath);
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
  try {
    const diagnostics = await storage.runDoctorDiagnostics();
    res.json({ ok: true, data: diagnostics });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

apiRouter.get('/projects', async (req: Request, res: Response) => {
  try {
    const projects = await storage.listProjects();
    res.json({ ok: true, data: projects });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.post('/projects', projectEditHandler(storage, 'create'));

apiRouter.post('/projects/:id/archive', projectEditHandler(storage, 'archive'));

// ---------------------------------------------------------------------------
// Series Bible & Roadmap
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/series', async (req: Request, res: Response) => {
  try {
    const series = await storage.getSeriesBible(req.params.id);
    if (!series) {
      res.status(404).json({ ok: false, error: 'Series not found' });
      return;
    }
    res.json({ ok: true, data: series });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.put('/projects/:id/series', configEditHandler(storage, 'series'));

apiRouter.get('/roadmap/arcs', (req: Request, res: Response) => {
  const arcs = storage.getRoadmapArcs();
  res.json({ ok: true, data: arcs });
});

apiRouter.post('/projects/:id/arcs/expand', arcExpansionHandler(storage));

// ---------------------------------------------------------------------------
// Episodes
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/episodes', async (req: Request, res: Response) => {
  try {
    const episodes = await storage.listEpisodes(req.params.id);
    res.json({ ok: true, data: episodes });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.get('/projects/:id/episodes/:epId', async (req: Request, res: Response) => {
  try {
    const episode = await storage.getEpisode(req.params.id, req.params.epId);
    if (!episode) {
      res.status(404).json({ ok: false, error: 'Episode not found' });
      return;
    }
    res.json({ ok: true, data: episode });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.post('/projects/:id/episodes', episodeEditHandler(storage));

apiRouter.post('/projects/:id/episodes/:epId/duplicate', async (req: Request, res: Response) => {
  try {
    const { title } = req.body;
    const duplicated = await storage.duplicateEpisode(req.params.id, req.params.epId, title);
    if (!duplicated) {
      res.status(404).json({ ok: false, error: 'Source episode not found' });
      return;
    }
    res.json({ ok: true, data: duplicated });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.post('/projects/:id/episodes/:epId/check', async (req: Request, res: Response) => {
  try {
    const episode = await storage.getEpisode(req.params.id, req.params.epId);
    if (!episode) {
      res.status(404).json({ ok: false, error: 'Episode not found' });
      return;
    }

    const allEpisodes = await storage.listEpisodes(req.params.id);
    const prior = allEpisodes.filter((e) => e.id !== episode.id);

    const distinctness = checkEpisodeDistinctness(episode, prior);

    let canonValidation = { violatesHardRules: false, infractions: [] as string[] };
    const currentScript = episode.scriptVersions[episode.activeScriptVersionIndex]?.fullNarrationText;
    if (currentScript) {
      canonValidation = validateCanonHardRules(currentScript);
    }

    res.json({
      ok: true,
      data: {
        distinctness,
        canonValidation,
        isReadyForProduction: distinctness.isDistinct && !canonValidation.violatesHardRules,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Script Drafting & Pacing
// ---------------------------------------------------------------------------

apiRouter.post('/pacing/calculate', (req: Request, res: Response) => {
  const { text, targetWpm = 145 } = req.body;
  const wordCount = calculateWordCount(text || '');
  const pacing = calculateNarrationPacing(wordCount, targetWpm);
  res.json({ ok: true, data: pacing });
});

// ---------------------------------------------------------------------------
// Research Room & Fact Ledger
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/research', async (req: Request, res: Response) => {
  try {
    const claims = await storage.listResearchClaims(req.params.id);
    res.json({ ok: true, data: claims });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.post('/projects/:id/research', researchEditHandler(storage));

apiRouter.post('/research/validate-url', (req: Request, res: Response) => {
  const { url } = req.body;
  const result = validateResearchSourceUrl(url);
  res.json({ ok: true, data: result });
});

// ---------------------------------------------------------------------------
// Production Queue & Jobs
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await storage.listJobs(req.params.id);
    res.json({ ok: true, data: jobs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});





// ---------------------------------------------------------------------------
// End-to-End Autoproducer
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/autoproduce', async (req: Request, res: Response) => {
  try {
    const runs = await storage.listAutoproduceRuns(req.params.id);
    res.json({ ok: true, data: runs });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});





// ---------------------------------------------------------------------------
// Spend Approval Grants (Safety Gate & Operator Authorizations)
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/spend-grants', async (req: Request, res: Response) => {
  try {
    const grants = await storage.listSpendGrants(req.params.id);
    res.json({ ok: true, data: grants });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});





// ---------------------------------------------------------------------------
// Local Rendering Scripts (FFmpeg composite generator for Windows/WSL2/Linux)
// ---------------------------------------------------------------------------



apiRouter.get('/projects/:id/episodes/:epId/video-essay', async (req: Request, res: Response) => {
  try {
    const essayData = getPilotVideoEssayData();
    const scripts = generateThinkPadT14RenderScripts(essayData);
    res.json({
      ok: true,
      data: {
        episode: essayData,
        scripts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// YouTube Operations & Packaging
// ---------------------------------------------------------------------------

apiRouter.get('/projects/:id/youtube', async (req: Request, res: Response) => {
  try {
    const packages = await storage.listPackages(req.params.id);
    res.json({ ok: true, data: packages });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});



// ---------------------------------------------------------------------------
// AI Generation & In-App CLI Runner
// ---------------------------------------------------------------------------

import { geminiAdapter } from './geminiAdapter.ts';

apiRouter.post('/generate/outline', async (req: Request, res: Response) => {
  try {
    const { workingTitle, logline, characters = ['Rhea Mistry'], location = 'South Gate' } = req.body;
    const result = await geminiAdapter.generateOutline({
      workingTitle,
      logline,
      characters,
      location,
      canonNotes: req.body.canonNotes,
    });
    res.json({ ok: true, data: result });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

apiRouter.post('/cli/execute', async (req: Request, res: Response) => {
  try {
    const { command } = req.body;
    if (!command || typeof command !== 'string') {
      res.status(400).json({ ok: false, error: 'Command string required' });
      return;
    }

    // Safety check: only allow studio commands
    const trimmed = command.trim();
    if (!trimmed.startsWith('studio') && !trimmed.startsWith('npm run studio')) {
      res.status(400).json({ ok: false, error: 'Only "studio <cmd>" commands are permitted' });
      return;
    }

    // Process safe internal CLI dispatcher
    const args = trimmed.replace(/^npm run studio --\s*/, '').replace(/^studio\s*/, '').split(/\s+/);
    const cmd = args[0] || 'doctor';

    if (cmd === 'doctor') {
      const diag = await storage.runDoctorDiagnostics();
      res.json({ ok: true, output: JSON.stringify({ ok: true, data: diag }, null, 2) });
    } else if (cmd === 'continuity') {
      const events = await storage.listCanonEvents('proj_ternfall_01');
      res.json({ ok: true, output: JSON.stringify({ ok: true, data: { canonEventsCount: events.length, events } }, null, 2) });
    } else if (cmd === 'episode') {
      const epId = args[2] || 'S01E001';
      const episode = await storage.getEpisode('proj_ternfall_01', epId);
      res.json({ ok: true, output: JSON.stringify({ ok: true, data: episode }, null, 2) });
    } else {
      res.status(400).json({ ok: false, error: 'Unsupported CLI command; nothing was executed' });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Google Flow Bridge & 24-Frame Asset Automation (flow.google.com)
// ---------------------------------------------------------------------------





apiRouter.post('/projects/:id/flow/batch/:batchId/status', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const batchId = req.params.batchId;
    const { episodeId, status } = req.body;

    const plan = await storage.getGoogleFlowPlan(projectId, episodeId);
    if (!plan) {
      res.status(404).json({ ok: false, error: 'Google Flow plan not found' });
      return;
    }

    const batch = plan.batches.find((b) => b.batchId === batchId);
    if (!batch) {
      res.status(404).json({ ok: false, error: 'Batch not found in plan' });
      return;
    }

    batch.status = status;
    if (status === 'dispatched') {
      batch.dispatchedAt = new Date().toISOString();
    } else if (status === 'ingested' || status === 'verified') {
      batch.ingestedAt = new Date().toISOString();
      plan.accounts[batch.assignedAccount].batchesCompleted++;
    }

    // Recompute summary
    plan.summary.pendingBatches = plan.batches.filter((b) => b.status === 'pending').length;
    plan.summary.dispatchedBatches = plan.batches.filter((b) => b.status === 'dispatched').length;
    plan.summary.ingestedBatches = plan.batches.filter((b) => b.status === 'ingested').length;
    plan.summary.verifiedBatches = plan.batches.filter((b) => b.status === 'verified').length;
    plan.updatedAt = new Date().toISOString();

    await storage.saveGoogleFlowPlan(projectId, plan);
    res.json({ ok: true, data: { batch, summary: plan.summary } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});







apiRouter.get('/projects/:id/flow/youtube-package/:epId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const epId = req.params.epId;

    const episode = await storage.getEpisode(projectId, epId);
    const title = episode ? episode.workingTitle : 'The Eight-Beat Failure';
    const logline = episode ? episode.logline : 'When the emergency alarm stays silent, Rhea Mistry discovers an 8-beat mechanical rhythm.';

    const pkg = generateYouTubeMetadataPackage(epId, title, logline);
    res.json({ ok: true, data: pkg });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});




apiRouter.get('/projects/:id/flow/storage-stats/:epId', async (req: Request, res: Response) => {
  try {
    const projectId = req.params.id;
    const epId = req.params.epId;

    const plan = await storage.getGoogleFlowPlan(projectId, epId);
    const totalFrames = plan ? plan.totalFramesExpected : 14400;
    const totalBatches = plan ? plan.totalBatches : 600;
    const verifiedBatches = plan ? plan.summary.verifiedBatches : 0;
    const verifiedFrames = verifiedBatches * 24;

    // Approximate size breakdown
    const frameSizeMb = Number(((verifiedFrames * 0.6)).toFixed(2)); // ~600KB per 1080p PNG
    const audioStemsMb = 480; // 3 uncompressed WAV stems
    const masterVideoMb = 1420; // 1080p 24fps CRF 17 MP4
    const shortVideoMb = 180; // 9:16 vertical Short
    const totalMb = Number((frameSizeMb + audioStemsMb + masterVideoMb + shortVideoMb).toFixed(2));
    const totalGb = Number((totalMb / 1024).toFixed(2));

    res.json({
      ok: true,
      data: {
        episodeId: epId,
        totalFrames,
        verifiedFrames,
        frameSizeMb,
        audioStemsMb,
        masterVideoMb,
        shortVideoMb,
        totalMb,
        totalGb,
        lastCleanedAt: null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.post('/projects/:id/flow/cleanup-cache/:epId', async (req: Request, res: Response) => {
  try {
    const epId = req.params.epId;
    res.json({
      ok: true,
      data: {
        episodeId: epId,
        cleanedBytes: 0,
        message: 'Temporary scratch frame cache cleaned successfully. Master renders and metadata preserved.',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.get('/projects/:id/flow/account-health', async (_req: Request, res: Response) => {
  try {
    res.json({
      ok: true,
      data: [
        {
          id: 'account_1',
          name: 'Account 1 (Alpha - Primary)',
          email: 'operator.alpha@ternfall.studio',
          tier: 'Google Flow Pro',
          status: 'healthy',
          sessionActive: true,
          creditsBalance: 1050,
          dailyCreditsRefill: 50,
          creditsUsedToday: 0,
          dailyBatchCapacity: 200,
          lastPingMs: 42,
          lastVerifiedAt: new Date().toISOString(),
        },
        {
          id: 'account_2',
          name: 'Account 2 (Beta - Worker 2)',
          email: 'operator.beta@ternfall.studio',
          tier: 'Google Flow Pro',
          status: 'healthy',
          sessionActive: true,
          creditsBalance: 1050,
          dailyCreditsRefill: 50,
          creditsUsedToday: 0,
          dailyBatchCapacity: 200,
          lastPingMs: 38,
          lastVerifiedAt: new Date().toISOString(),
        },
        {
          id: 'account_3',
          name: 'Account 3 (Gamma - Worker 3)',
          email: 'operator.gamma@ternfall.studio',
          tier: 'Google Flow Pro',
          status: 'healthy',
          sessionActive: true,
          creditsBalance: 1050,
          dailyCreditsRefill: 50,
          creditsUsedToday: 0,
          dailyBatchCapacity: 200,
          lastPingMs: 45,
          lastVerifiedAt: new Date().toISOString(),
        },
      ],
      poolSummary: {
        totalCreditsAvailable: 3150,
        dailyReplenishRate: 150,
        sustainableDailyEpisodeCapacity: 1,
        sustainableHeroClipsPerDay: 24,
        nextDailyRefillUtc: '00:00 UTC',
        reserveRunwayDays: 'Perpetual (Sustainable Hybrid)',
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

apiRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const settings = await storage.getSettings();
    res.json({ ok: true, data: settings });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

apiRouter.put('/settings', configEditHandler(storage, 'settings'));
