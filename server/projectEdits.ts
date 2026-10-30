import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { RequestError, requestIdentifier } from './lib/requestErrors.ts';
import { sendRequestError } from './lib/publicRequestErrors.ts';
import { sendInternalApiError } from './lib/apiErrors.ts';
import { publicProject } from './lib/publicProject.ts';

export function projectListHandler(storage: StorageEngine) {
  return async (_req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try { res.json({ ok: true, data: (await storage.listProjects()).map(publicProject) }); }
    catch { sendInternalApiError(res); }
  };
}

export function projectEditHandler(storage: StorageEngine, kind: 'create' | 'archive') {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('PROJECT_INVALID_REQUEST');
      const allowed = kind === 'create' ? ['name', 'description'] : ['isArchived', 'revision'];
      for (const key of Object.keys(body)) if (!allowed.includes(key)) throw new RequestError('PROJECT_INVALID_REQUEST');
      if (kind === 'archive') {
        requestIdentifier(req.params.id);
        // Avoid committing a normal archive if existing metadata cannot be safely returned.
        // The storage revision check still protects against concurrent project edits.
        const existing = await storage.getProject(req.params.id);
        if (existing) publicProject(existing);
      }
      const data = kind === 'create'
        ? await storage.createProject(body.name, body.description === undefined ? '' : body.description)
        : await storage.archiveProject(req.params.id, body.isArchived, body.revision);
      if (!data) { res.status(404).json({ ok: false, error: 'Project not found' }); return; }
      res.status(kind === 'create' ? 201 : 200).json({ ok: true, data: publicProject(data) });
    } catch (error: unknown) { sendRequestError(res, error); }
  };
}
