import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { assertIdentifier } from './lib/paths.ts';
import { RequestError, requestIdentifier } from './lib/requestErrors.ts';
import { sendRequestError } from './lib/publicRequestErrors.ts';
import { validateEpisodeCreation, validateVariantTitle } from './lib/episodeCreation.ts';
import { checkEpisodeDistinctness } from '../src/core/rules.ts';
import { checkProjectCanon } from '../src/core/canonScope.ts';
import { publicEpisode } from './lib/publicDocuments.ts';

export function episodeCreationHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      requestIdentifier(req.params.id);
      try { validateEpisodeCreation(req.body); } catch { throw new RequestError('EPISODE_INVALID_CREATE'); }
      res.status(201).json({ ok: true, data: publicEpisode(await storage.createEpisode(req.params.id, req.body)) });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}

export function episodeDuplicationHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      requestIdentifier(req.params.id); requestIdentifier(req.params.epId);
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => !['title', 'idempotencyKey'].includes(key))) throw new RequestError('EPISODE_INVALID_DUPLICATION');
      try { assertIdentifier(req.body.idempotencyKey); validateVariantTitle(req.body.title); }
      catch { throw new RequestError('EPISODE_INVALID_DUPLICATION'); }
      const result = await storage.duplicateEpisode(req.params.id, req.params.epId, req.body.title, req.body.idempotencyKey);
      if (!result) { res.status(404).json({ ok: false, error: 'Source episode not found' }); return; }
      res.json({ ok: true, data: publicEpisode(result) });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}

/** Checks are advisory only: no independent editorial, rights or artifact evidence exists here. */
export function episodeCheckHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      requestIdentifier(req.params.id); requestIdentifier(req.params.epId);
      const episode = await storage.getEpisode(req.params.id, req.params.epId);
      if (!episode) { res.status(404).json({ ok: false, error: 'Episode not found' }); return; }
      const all = await storage.listEpisodes(req.params.id);
      const distinctness = checkEpisodeDistinctness(episode, all.filter(item => item.id !== episode.id));
      const script = episode.scriptVersions?.[episode.activeScriptVersionIndex]?.fullNarrationText;
      const present = typeof script === 'string' && !!script.trim();
      const canonValidation = checkProjectCanon(req.params.id, present ? script : '');
      res.json({ ok: true, data: {
        distinctness, canonValidation, scriptPresent: present,
        isReadyForProduction: false,
        readinessNotice: 'These checks are advisory only. Human editorial and rights review and technical QC of the exact artifact are not verified; no approval was created.',
      } });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}
