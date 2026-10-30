import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

/** HTTP Basic is browser-compatible; Bearer supports automation. Never log credentials. */
export function operatorAccess(token?: string): RequestHandler {
  return (req, res, next) => {
    if (req.headers.origin) {
      try {
        const origin = new URL(req.headers.origin);
        if (origin.host !== req.headers.host) {
          res.status(403).json({ ok: false, error: 'Cross-origin requests are not permitted' });
          return;
        }
      } catch {
        res.status(403).json({ ok: false, error: 'Invalid origin' });
        return;
      }
    }
    if (!token) {
      let host: string;
      try { host = new URL(`http://${req.headers.host}`).hostname; }
      catch { res.status(403).json({ ok: false, error: 'Invalid host' }); return; }
      if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
        res.status(403).json({ ok: false, error: 'Remote hosts require operator authentication' });
        return;
      }
    }
    // Loopback-only mode is also enforced by startup when no token is configured.
    if (!token) { next(); return; }
    const auth = req.headers.authorization || '';
    let supplied = '';
    if (auth.startsWith('Bearer ')) supplied = auth.slice(7);
    if (auth.startsWith('Basic ')) {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      if (decoded.startsWith('operator:')) supplied = decoded.slice(9);
    }
    const expected = Buffer.from(token);
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Ternfall Studio", charset="UTF-8"');
      res.status(401).json({ ok: false, error: 'Operator authentication required' });
      return;
    }
    next();
  };
}
