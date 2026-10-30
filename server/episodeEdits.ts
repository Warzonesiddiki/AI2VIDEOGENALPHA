import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { assertIdentifier } from './lib/paths.ts';
import { assertRevision, RevisionConflict } from './lib/conflicts.ts';
import { calculateWordCount, validateCanonHardRules } from '../src/core/rules.ts';

export function episodeEditHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    try {
      const episode = req.body;
      assertIdentifier(req.params.id); assertIdentifier(episode?.id); assertIdentifier(episode?.dbId); assertRevision(episode?.revision);
      if (episode.projectId !== req.params.id || typeof episode.workingTitle !== 'string' || !episode.workingTitle.trim() || episode.workingTitle.length > 200 || typeof episode.logline !== 'string' || episode.logline.length > 2000 || !['planned', 'outline_ready', 'script_draft', 'script_approved'].includes(episode.status)) throw new Error('Invalid episode or unsupported production status');
      if (!Array.isArray(episode.scriptVersions) || episode.scriptVersions.length > 1000 || !Number.isInteger(episode.activeScriptVersionIndex) || episode.activeScriptVersionIndex < 0 || episode.activeScriptVersionIndex >= Math.max(1, episode.scriptVersions.length)) throw new Error('Invalid script versions');
      for (const version of episode.scriptVersions) {
        if (!version || typeof version.fullNarrationText !== 'string' || version.fullNarrationText.length > 100_000 || !Number.isInteger(version.versionNumber) || version.versionNumber < 1) throw new Error('Invalid script version');
        if (version.targetWpm !== undefined && (!Number.isFinite(version.targetWpm) || version.targetWpm < 80 || version.targetWpm > 220)) throw new Error('Invalid narration pacing');
        version.wordCount = calculateWordCount(version.fullNarrationText);
      }
      if (episode.status === 'script_approved') {
        const text = episode.scriptVersions[episode.activeScriptVersionIndex]?.fullNarrationText;
        if (!text?.trim() || validateCanonHardRules(text).violatesHardRules) throw new Error('A nonempty canon-valid script is required for script approval');
      }
      const saved = await storage.saveEpisode(req.params.id, episode);
      res.json({ ok: true, data: saved });
    } catch (error: any) {
      res.status(error instanceof RevisionConflict ? 409 : 400).json({ ok: false, code: error.code, currentRevision: error.currentRevision, error: error.message });
    }
  };
}
