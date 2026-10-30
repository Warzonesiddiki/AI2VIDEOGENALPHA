import { mediaByteRange, MediaIntegrityError, MediaVerificationBusyError } from './lib/verifiedMedia.ts';
import { MediaRequestError, mediaRequestErrors } from './lib/mediaErrors.ts';
import { sendInternalApiError } from './lib/apiErrors.ts';
import { publicRenderJob } from './lib/publicMedia.ts';
import { pipeline } from 'node:stream/promises';
import { Router, type Request, type Response } from 'express';
import { LocalMediaService } from './localMedia.ts';
import type { StorageEngine } from './storage.ts';
import { assertIdentifier } from './lib/paths.ts';

export function localMediaRouter(service: LocalMediaService, storage: StorageEngine) {
  const router = Router({ mergeParams: true });
  const handle = (action: (req: Request, res: Response) => unknown) => async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      try {
        assertIdentifier(req.params.id);
        if (req.params.jobId !== undefined) assertIdentifier(req.params.jobId);
      } catch { throw new MediaRequestError('INVALID_IDENTIFIER'); }
      await action(req, res);
    } catch (error: unknown) {
      if (res.headersSent || res.destroyed) return;
      if (error instanceof MediaRequestError && typeof error.code === 'string' && Object.hasOwn(mediaRequestErrors, error.code)) {
        res.status(422).json({ ok: false, code: error.code, error: mediaRequestErrors[error.code] });
      } else if (error instanceof MediaIntegrityError) {
        res.status(409).json({ ok: false, code: 'MEDIA_INTEGRITY_FAILED', error: 'Export bytes no longer match saved technical QC. Playback is blocked; inspect the output and create a new verified render.' });
      } else if (error instanceof MediaVerificationBusyError) {
        res.status(503).json({ ok: false, code: 'MEDIA_VERIFICATION_BUSY', error: 'Media verification is busy. Retry shortly.' });
      } else sendInternalApiError(res);
    }
  };
  router.get('/', handle(async (req, res) => {
    await storage.init(); res.json({ ok: true, data: service.list(req.params.id).map(publicRenderJob) });
  }));
  router.post('/', handle(async (req, res) => {
    const { episodeId, frameCount, audioFile, idempotencyKey } = req.body ?? {};
    try { assertIdentifier(episodeId); } catch { throw new MediaRequestError('INVALID_IDENTIFIER'); }
    if (!(await storage.getEpisode(req.params.id, episodeId))) {
      res.status(404).json({ ok: false, error: 'Episode not found' }); return;
    }
    const job = service.enqueue({ projectId: req.params.id, episodeId, frameCount, audioFile, idempotencyKey, fps: 24 });
    res.status(202).json({ ok: true, data: publicRenderJob(job) });
  }));
  router.get('/:jobId', handle((req, res) => {
    const job = service.get(req.params.id, req.params.jobId);
    if (!job) { res.status(404).json({ ok: false, error: 'Local render not found' }); return; }
    res.json({ ok: true, data: publicRenderJob(job) });
  }));
  router.post('/:jobId/cancel', handle((req, res) => { res.json({ ok: true, data: publicRenderJob(service.cancel(req.params.id, req.params.jobId)) }); }));
  router.post('/:jobId/retry', handle((req, res) => { res.json({ ok: true, data: publicRenderJob(service.retry(req.params.id, req.params.jobId)) }); }));
  router.post('/:jobId/purge-checkpoints', handle(async (req, res) => { res.json({ ok: true, data: publicRenderJob(await service.purgeCheckpoints(req.params.id, req.params.jobId)) }); }));
  router.get('/:jobId/media', handle(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    const opened = await service.openVerifiedMedia(req.params.id, req.params.jobId);
    try {
      const etag = `"${opened.sha256}"`;
      // If-Range mismatch means the full verified representation, never stale offsets.
      let range;
      try { range = mediaByteRange(req.headers['if-range'] && req.headers['if-range'] !== etag ? undefined : req.headers.range, opened.size); }
      catch {
        res.setHeader('Content-Range', `bytes */${opened.size}`);
        res.status(416).end(); return;
      }
      res.setHeader('Accept-Ranges', 'bytes'); res.setHeader('ETag', etag);
      res.type('video/mp4');
      const start = range?.start ?? 0, end = range?.end ?? opened.size - 1;
      res.status(range ? 206 : 200).setHeader('Content-Length', end - start + 1);
      if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${opened.size}`);
      if (req.method === 'HEAD') { res.end(); return; }
      // Serve the checked descriptor: path replacement cannot swap in new bytes
      // between verification and sendFile reopening the pathname.
      await pipeline(opened.handle.createReadStream({ start, end, autoClose: false }), res);
    } finally { await opened.handle.close(); }
  }));
  return router;
}
