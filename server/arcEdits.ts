import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
export function arcExpansionHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    try { res.json({ ok: true, data: await storage.expandArc(req.params.id, req.body) }); }
    catch (error: any) { res.status(error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : 400).json({ ok: false, error: error.message, code: error.code }); }
  };
}
