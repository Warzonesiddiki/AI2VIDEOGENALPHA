import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { requestIdentifier } from './lib/requestErrors.ts';
import { sendRequestError } from './lib/publicRequestErrors.ts';
import { sendInternalApiError } from './lib/apiErrors.ts';
import { publicSettings } from './lib/publicSettings.ts';
import { publicSeriesBible } from './lib/publicDocuments.ts';

export function settingsReadHandler(storage: StorageEngine) {
  return async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try { res.json({ ok: true, data: publicSettings(await storage.getSettings()) }); }
    catch { sendInternalApiError(res); }
  };
}

/** Injectable handlers shared by live routing and isolated integration tests. */
export function configEditHandler(storage: StorageEngine, kind: 'settings' | 'series') {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (kind === 'series') requestIdentifier(req.params.id);
      const data = kind === 'settings' ? await storage.updateSettings(req.body) : await storage.updateSeriesBible(req.params.id, req.body);
      if (!data) { res.status(404).json({ ok: false, error: 'Series not found' }); return; }
      res.json({ ok: true, data: kind === 'settings' ? publicSettings(data) : publicSeriesBible(data) });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}
