import type { Response } from 'express';
import { IdempotencyConflict, RevisionConflict } from './conflicts.ts';
import { RequestError, requestErrors } from './requestErrors.ts';
import { sendInternalApiError } from './apiErrors.ts';

/** Trust only application error types and fixed messages, never arbitrary exception codes/messages. */
export function sendRequestError(res: Response, error: unknown): void {
  if (res.headersSent || res.destroyed) return;
  res.set('Cache-Control', 'no-store');
  if (error instanceof RequestError && typeof error.code === 'string' && Object.hasOwn(requestErrors, error.code)) {
    res.status(400).json({ ok: false, code: error.code, error: requestErrors[error.code] });
  } else if (error instanceof IdempotencyConflict) {
    res.status(409).json({ ok: false, code: 'IDEMPOTENCY_CONFLICT', error: 'Idempotency key conflicts with a different request.' });
  } else if (error instanceof RevisionConflict && Number.isSafeInteger(error.currentRevision) && error.currentRevision >= 0) {
    res.status(409).json({ ok: false, code: 'REVISION_CONFLICT', currentRevision: error.currentRevision, error: 'This record changed since it was loaded. Reload and merge your edits before saving.' });
  } else sendInternalApiError(res);
}
