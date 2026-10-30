import type { Request, Response } from 'express';
import type { StorageEngine } from './storage.ts';
import { RevisionConflict } from './lib/conflicts.ts';

export function projectEditHandler(storage: StorageEngine, kind: 'create' | 'archive') {
  return async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid project request');
      const allowed = kind === 'create' ? ['name', 'description'] : ['isArchived', 'revision'];
      for (const key of Object.keys(body)) if (!allowed.includes(key)) throw new Error(`Unsupported project field: ${key}`);
      const data = kind === 'create'
        ? await storage.createProject(body.name, body.description === undefined ? '' : body.description)
        : await storage.archiveProject(req.params.id, body.isArchived, body.revision);
      if (!data) { res.status(404).json({ ok: false, error: 'Project not found' }); return; }
      res.status(kind === 'create' ? 201 : 200).json({ ok: true, data });
    } catch (error: any) {
      res.status(error instanceof RevisionConflict ? 409 : 400).json({ ok: false, code: error.code, currentRevision: error.currentRevision, error: error.message });
    }
  };
}
