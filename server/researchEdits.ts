import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { StorageEngine } from './storage.ts';
import { RequestError, requestIdentifier } from './lib/requestErrors.ts';
import { sendRequestError } from './lib/publicRequestErrors.ts';
import { publicResearchClaim } from './lib/publicDocuments.ts';

export function researchEditHandler(storage: StorageEngine) {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      requestIdentifier(req.params.id);
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('RESEARCH_INVALID_REQUEST');
      if (!(await storage.getProject(req.params.id))) { res.status(404).json({ ok: false, error: 'Project not found' }); return; }
      if (body.id !== undefined) {
        try { requestIdentifier(body.id); } catch { throw new RequestError('RESEARCH_INVALID_REQUEST'); }
      }
      const existing = body.id ? (await storage.listResearchClaims(req.params.id)).find(claim => claim.id === body.id) : undefined;
      const now = new Date().toISOString();
      const supplied = (key: string, fallback: any) => body[key] === undefined ? fallback : body[key];
      const saved = await storage.saveResearchClaim(req.params.id, {
        ...body, id: body.id ?? `claim_${randomUUID()}`, projectId: supplied('projectId', req.params.id),
        isFictionalLore: supplied('isFictionalLore', false),
        verificationStatus: supplied('verificationStatus', body.isFictionalLore ? 'fictional_rule' : 'unverified'),
        confidenceScore: supplied('confidenceScore', 0), humanApproved: supplied('humanApproved', false),
        factCheckerNotes: supplied('factCheckerNotes', ''), relatedEpisodeIds: supplied('relatedEpisodeIds', []),
        createdAt: supplied('createdAt', existing?.createdAt ?? now), updatedAt: now,
      });
      res.json({ ok: true, data: publicResearchClaim(saved) });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}
