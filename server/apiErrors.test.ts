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

test('legacy read routes do not expose unexpected storage error details', async t => {
  const { storage } = await import('./storage.ts'); const { apiRouter } = await import('./routes.ts');
  const app = express(); app.use(express.json()); app.use('/api', apiRouter); app.use('/api', apiErrorBoundary);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const cases = [
    ['runDoctorDiagnostics', '/doctor'], ['listProjects', '/projects'],
    ['getSeriesBible', '/projects/project_1/series'], ['listEpisodes', '/projects/project_1/episodes'],
    ['getEpisode', '/projects/project_1/episodes/episode_1'], ['listResearchClaims', '/projects/project_1/research'],
    ['listJobs', '/projects/project_1/jobs'], ['listAutoproduceRuns', '/projects/project_1/autoproduce'],
    ['listSpendGrants', '/projects/project_1/spend-grants'], ['listPackages', '/projects/project_1/youtube'],
    ['getSettings', '/settings'],
  ] as const;
  for (const [method, url] of cases) {
    const mock = t.mock.method(storage, method, async () => { throw new Error('private-path-and-token-fixture'); });
    try {
      const response = await fetch(base + url); assert.equal(response.status, 500, url);
      const result = await response.json();
      assert.ok(!JSON.stringify(result).includes('private-path-and-token-fixture'), url);
      assert.equal(result.code, 'INTERNAL_ERROR', url);
      assert.equal(response.headers.get('cache-control'), 'no-store', url);
    } finally { mock.mock.restore(); }
  }
});

test('outline validation and unexpected adapter failures never expose diagnostics', async t => {
  const { geminiAdapter } = await import('./geminiAdapter.ts'); const { apiRouter } = await import('./routes.ts');
  const app = express(); app.use(express.json()); app.use('/api', apiRouter); app.use('/api', apiErrorBoundary);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const post = (body: unknown) => fetch(`http://127.0.0.1:${address.port}/api/generate/outline`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let calls = 0; const mock = t.mock.method(geminiAdapter, 'generateOutline', async () => { calls++; throw new Error('private-adapter-path-and-token'); });
  try {
    const invalid = await post({ workingTitle: '' }); assert.equal(invalid.status, 400); assert.equal(invalid.headers.get('cache-control'), 'no-store');
    assert.equal((await invalid.json()).code, 'OUTLINE_INVALID_BRIEF'); assert.equal(calls, 0);
    const failed = await post({ workingTitle: 'A title', logline: 'A premise', characters: ['Lead'], location: 'Pier' });
    assert.equal(failed.status, 500); assert.equal(failed.headers.get('cache-control'), 'no-store');
    const result = await failed.json(); assert.equal(result.code, 'INTERNAL_ERROR'); assert.ok(!JSON.stringify(result).includes('private-adapter-path-and-token')); assert.equal(calls, 1);
  } finally { mock.mock.restore(); }
});
