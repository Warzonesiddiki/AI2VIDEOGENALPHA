import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { sendInternalApiError } from './lib/apiErrors.ts';
import {
  publicJob, publicYouTubePackage, publicAutoproduceRun, publicSpendGrant,
} from './lib/publicReads.ts';
import { publicEpisode, publicSeriesBible, publicResearchClaim } from './lib/publicDocuments.ts';

/**
 * Read-only project document and production-record handlers.
 *
 * Every response is `no-store`. Production records pass through explicit
 * browser-safe projections (server/lib/publicReads.ts) that omit filesystem
 * paths, raw diagnostics, provider telemetry and unknown legacy fields;
 * malformed stored records fail closed with a generic error. Project documents
 * (series, episodes, research) are the editing surface and are returned as
 * stored content; their projection remains future work.
 */

function noStore(res: Response): void {
  res.set('Cache-Control', 'no-store');
}

export function seriesReadHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const series = await storage.getSeriesBible(req.params.id);
      if (!series) {
        res.status(404).json({ ok: false, error: 'Series not found' });
        return;
      }
      res.json({ ok: true, data: publicSeriesBible(series) });
    } catch {
      sendInternalApiError(res);
    }
  };
}

export function episodeListHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const episodes = await storage.listEpisodes(req.params.id);
      res.json({ ok: true, data: episodes.map(publicEpisode) });
    } catch {
      sendInternalApiError(res);
    }
  };
}

export function episodeReadHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const episode = await storage.getEpisode(req.params.id, req.params.epId);
      if (!episode) {
        res.status(404).json({ ok: false, error: 'Episode not found' });
        return;
      }
      res.json({ ok: true, data: publicEpisode(episode) });
    } catch {
      sendInternalApiError(res);
    }
  };
}

export function researchListHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const claims = await storage.listResearchClaims(req.params.id);
      res.json({ ok: true, data: claims.map(publicResearchClaim) });
    } catch {
      sendInternalApiError(res);
    }
  };
}

export function jobListHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const jobs = await storage.listJobs(req.params.id);
      res.json({ ok: true, data: jobs.map(publicJob) });
    } catch {
      sendInternalApiError(res);
    }
  };
}

export function autoproduceListHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const runs = await storage.listAutoproduceRuns(req.params.id);
      res.json({ ok: true, data: runs.map(publicAutoproduceRun) });
    } catch {
      sendInternalApiError(res);
    }
  };
}

export function spendGrantListHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const grants = await storage.listSpendGrants(req.params.id);
      res.json({ ok: true, data: grants.map(publicSpendGrant) });
    } catch {
      sendInternalApiError(res);
    }
  };
}

export function packageListHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    noStore(res);
    try {
      const packages = await storage.listPackages(req.params.id);
      res.json({ ok: true, data: packages.map(publicYouTubePackage) });
    } catch {
      sendInternalApiError(res);
    }
  };
}
