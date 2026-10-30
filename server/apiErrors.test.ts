import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiErrorBoundary } from './lib/apiErrors.ts';

test('API boundary returns bounded JSON for malformed/oversized bodies and hides internal details', async t => {
  const app = express(); app.use(express.json({ limit: '64b' }));
  app.post('/api/echo', (req, res) => res.json(req.body));
  app.get('/api/failure', () => { throw new Error('sensitive-private-fixture-path'); });
  app.use('/api', apiErrorBoundary);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  for (const [body, status, code] of [['{', 400, 'INVALID_JSON'], [JSON.stringify({ text: 'x'.repeat(100) }), 413, 'PAYLOAD_TOO_LARGE']] as const) {
    const response = await fetch(`${base}/api/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json(); assert.equal(result.ok, false); assert.equal(result.code, code);
  }
  const failure = await fetch(`${base}/api/failure`); assert.equal(failure.status, 500);
  const result = await failure.json(); assert.equal(result.code, 'INTERNAL_ERROR'); assert.ok(!JSON.stringify(result).includes('sensitive-private-fixture-path'));
  const valid = await fetch(`${base}/api/echo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"ok":true}' }); assert.equal(valid.status, 200);
});
