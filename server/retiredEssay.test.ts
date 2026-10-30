import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { apiRouter } from './routes.ts';

test('retired Video Essay endpoint never returns unscoped samples or executable scripts', async t => {
  const app = express(); app.use(express.json()); app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  for (const scope of ['ghost_project/episodes/ghost_episode', 'proj_ternfall_01/episodes/S01E001']) {
    const response: globalThis.Response = await fetch(`http://127.0.0.1:${address.port}/api/projects/${scope}/video-essay`);
    assert.equal(response.status, 410);
    const result = await response.json(); assert.equal(result.ok, false); assert.equal(result.code, 'RETIRED');
    assert.equal(result.data, undefined); assert.doesNotMatch(JSON.stringify(result), /edge-tts|ffmpeg/);
  }
});

test('publishing metadata endpoint fails closed for valid and nonexistent scopes', async t => {
  const app = express(); app.use(express.json()); app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  for (const scope of ['ghost_project/ghost_episode', 'proj_ternfall_01/S01E001']) {
    const [project, episode] = scope.split('/');
    const response: globalThis.Response = await fetch(`http://127.0.0.1:${address.port}/api/projects/${project}/flow/youtube-package/${episode}`);
    assert.equal(response.status, 501); const result = await response.json(); assert.equal(result.ok, false); assert.equal(result.data, undefined);
  }
});
