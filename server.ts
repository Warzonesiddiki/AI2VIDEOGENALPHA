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
  const PORT = 3000;

  // Middleware for JSON bodies
  app.use(express.json({ limit: '20mb' }));

  // Initialize persistent storage engine
  await storage.init();

  // Mount API endpoints
  app.use('/api', apiRouter);

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Ternfall Studio] Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Ternfall Studio] Failed to start server:', err);
  process.exit(1);
});
