import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { RevisionConflict } from './lib/conflicts.ts';

/** Injectable handlers shared by live routing and isolated integration tests. */
export function configEditHandler(storage: StorageEngine, kind: 'settings' | 'series') {
  return async (req: Request, res: Response) => {
    try {
      const data = kind === 'settings' ? await storage.updateSettings(req.body) : await storage.updateSeriesBible(req.params.id, req.body);
      if (!data) { res.status(404).json({ ok: false, error: 'Series not found' }); return; }
      res.json({ ok: true, data });
    } catch (error: any) {
      res.status(error instanceof RevisionConflict ? 409 : 400).json({ ok: false, code: error.code, currentRevision: error.currentRevision, error: error.message });
    }
  };
}
