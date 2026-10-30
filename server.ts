import { apiErrorBoundary } from './server/lib/apiErrors.ts';
import { localMedia } from './server/localMedia.ts';
import { createMediaWorkerTick } from './server/lib/mediaWorkerPolling.ts';
import 'dotenv/config';
import { operatorAccess } from './server/lib/access.ts';
/**
 * Ternfall Studio - Server Entry Point
 * Full-stack Express server mounting Vite middlewares in dev mode.
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { storage } from './server/storage.ts';
import { apiRouter } from './server/routes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const token = process.env.STUDIO_OPERATOR_TOKEN;
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && (!token || token.length < 32)) {
    throw new Error('Remote binding requires STUDIO_OPERATOR_TOKEN with at least 32 characters');
  }
  app.disable('x-powered-by');
  app.use(operatorAccess(token));

  // Middleware for JSON bodies
  app.use(express.json({ limit: '1mb' }));

  // Initialize persistent storage engine
  await storage.init();
  localMedia.recoverInterrupted();
  // Each process may poll, but SQLite permits only one active local render per root.
  // Periodic recovery also handles a different worker dying after this server started.
  const tick = createMediaWorkerTick(localMedia, {
    onError: error => console.error('[LocalMedia] Worker error:', error),
    onRecoveryError: error => console.error('[LocalMedia] Recovery error; will retry:', error),
  });
  setInterval(() => { void tick(); }, 1000).unref();

  // Mount API endpoints
  app.use('/api', apiRouter);

  app.use('/api', (_req, res) => { res.status(404).json({ ok: false, error: 'API endpoint not found' }); });

  // Must follow parser/routes so malformed and oversized API bodies stay JSON.
  app.use('/api', apiErrorBoundary);

  // Mount Vite in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }



  app.listen(PORT, host, () => {
    console.log(`[Ternfall Studio] Server listening at http://${host}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Ternfall Studio] Failed to start server:', err);
  process.exit(1);
});
