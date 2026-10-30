import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { assertRevision } from './lib/conflicts.ts';
import { RequestError, requestIdentifier } from './lib/requestErrors.ts';
import { sendRequestError } from './lib/publicRequestErrors.ts';
import { checkProjectCanon } from '../src/core/canonScope.ts';
import { nextScriptVersionNumber } from '../src/core/scriptVersions.ts';
import { EPISODE_SCHEMA, validateDocument } from './lib/documentSchema.ts';
import { publicEpisode } from './lib/publicDocuments.ts';

export function episodeEditHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      const episode = req.body;
      requestIdentifier(req.params.id); requestIdentifier(episode?.id); requestIdentifier(episode?.dbId);
      try { assertRevision(episode?.revision); } catch { throw new RequestError('EDITORIAL_INVALID_REVISION'); }
      if (episode.projectId !== req.params.id || typeof episode.workingTitle !== 'string' || !episode.workingTitle.trim() || episode.workingTitle.length > 200 || typeof episode.logline !== 'string' || episode.logline.length > 2000 || !['planned', 'outline_ready', 'script_draft', 'script_approved'].includes(episode.status)) throw new RequestError('EPISODE_INVALID_EDIT');
      if (!Array.isArray(episode.scriptVersions) || episode.scriptVersions.length > 1000 || !Number.isInteger(episode.activeScriptVersionIndex) || episode.activeScriptVersionIndex < 0 || episode.activeScriptVersionIndex >= Math.max(1, episode.scriptVersions.length)) throw new RequestError('EPISODE_INVALID_VERSIONS');
      try { nextScriptVersionNumber(episode.scriptVersions); } catch { throw new RequestError('EPISODE_INVALID_VERSIONS'); }
      for (const version of episode.scriptVersions) {
        if (!version || typeof version.fullNarrationText !== 'string' || version.fullNarrationText.length > 100_000 || !Number.isInteger(version.versionNumber) || version.versionNumber < 1) throw new RequestError('EPISODE_INVALID_VERSION');
        if (version.targetWpm !== undefined && (!Number.isFinite(version.targetWpm) || version.targetWpm < 80 || version.targetWpm > 220)) throw new RequestError('EPISODE_INVALID_PACING');
      }
      if (episode.status === 'script_approved') {
        const text = episode.scriptVersions[episode.activeScriptVersionIndex]?.fullNarrationText;
        if (!text?.trim() || checkProjectCanon(req.params.id, text).violatesHardRules) throw new RequestError('EPISODE_REVIEW_REQUIRES_SCRIPT');
      }
      try { validateDocument(EPISODE_SCHEMA, episode, 'episode'); } catch { throw new RequestError('EPISODE_INVALID_EDIT'); }
      const saved = await storage.saveEpisode(req.params.id, episode, true);
      res.json({ ok: true, data: publicEpisode(saved) });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}
