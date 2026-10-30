import type { ErrorRequestHandler } from 'express';

/** Stable JSON failures for parser errors and otherwise uncaught API errors. */
export const apiErrorBoundary: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  const tooLarge = error?.type === 'entity.too.large';
  const invalidJson = error?.type === 'entity.parse.failed';
  const status = tooLarge ? 413 : invalidJson ? 400 : 500;
  res.set('Cache-Control', 'no-store').status(status).json({
    ok: false,
    code: tooLarge ? 'PAYLOAD_TOO_LARGE' : invalidJson ? 'INVALID_JSON' : 'INTERNAL_ERROR',
    error: tooLarge ? 'Request body exceeds the configured size limit.' : invalidJson ? 'Request body must be valid JSON.' : 'The API request failed. No success is implied; inspect server diagnostics before retrying a mutation.',
  });
};
