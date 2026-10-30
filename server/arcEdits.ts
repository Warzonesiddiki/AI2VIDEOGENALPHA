import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { validateArcExpansion } from './lib/arcExpansion.ts';
import { RequestError, requestIdentifier } from './lib/requestErrors.ts';
import { sendRequestError } from './lib/publicRequestErrors.ts';
import { publicEpisode } from './lib/publicDocuments.ts';

export function arcExpansionHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      requestIdentifier(req.params.id);
      try { validateArcExpansion(req.body); } catch { throw new RequestError('ARC_INVALID_REQUEST'); }
      const result = await storage.expandArc(req.params.id, req.body);
      res.json({ ok: true, data: { arcTitle: result.arcTitle, createdCards: result.createdCards.map(publicEpisode) } });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}
