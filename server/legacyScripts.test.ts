import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('tracked legacy media scripts fail closed without creating media', { skip: process.platform === 'win32' }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-retired-scripts-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const name of ['render_S01E001.sh', 'scripts/generate_audio_S01E001.sh', 'scripts/render_youtube_S01E001_master.sh']) {
    const result = spawnSync('bash', [path.resolve(name)], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 1, name);
    assert.match(result.stderr, /retired/i, name);
    assert.deepEqual(await fs.readdir(root), [], name);
  }
});

test('the retired simulated player cannot offer a fake MP4 or episode captions', async () => {
  const React = await import('react'); const { renderToStaticMarkup } = await import('react-dom/server');
  const { StudioVideoPlayer } = await import('../src/components/StudioVideoPlayer.tsx');
  const html = renderToStaticMarkup(React.createElement(StudioVideoPlayer, { episodeId: 'S01E001', workingTitle: 'Fixture' }));
  assert.match(html, /retired/i); assert.doesNotMatch(html, /<button|Download Master|\.mp4/i);
});
