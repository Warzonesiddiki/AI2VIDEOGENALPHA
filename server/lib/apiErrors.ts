import type { ErrorRequestHandler, Response } from 'express';

/** Do not expose unexpected exception messages, paths or tokens to HTTP clients. */
export function sendInternalApiError(res: Response): void {
  res.set('Cache-Control', 'no-store').status(500).json({
    ok: false, code: 'INTERNAL_ERROR',
    error: 'The API request failed. No success is implied; inspect server diagnostics before retrying a mutation.',
  });
}

/** Stable JSON failures for parser errors and otherwise uncaught API errors. */
export const apiErrorBoundary: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  const tooLarge = error?.type === 'entity.too.large';
  const invalidJson = error?.type === 'entity.parse.failed';
  if (!tooLarge && !invalidJson) { sendInternalApiError(res); return; }
  res.set('Cache-Control', 'no-store').status(tooLarge ? 413 : 400).json({
    ok: false,
    code: tooLarge ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
    error: tooLarge ? 'Request body exceeds the configured size limit.' : 'Request body must be valid JSON.',
  });
};
