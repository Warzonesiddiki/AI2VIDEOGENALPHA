import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { safePath, assertIdentifier } from './lib/paths.ts';
import { operatorAccess } from './lib/access.ts';
import { StorageEngine } from './storage.ts';
import { apiRouter } from './routes.ts';

async function temporaryRoot(t: any) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return dir;
}

test('path guard rejects sibling prefix, absolute escape and Windows separators', () => {
  for (const value of ['../root_evil/file', '/etc/passwd', '..\\escape', 'a\0b']) {
    assert.throws(() => safePath('/tmp/root', value), /Security Violation/);
  }
  assert.equal(safePath('/tmp/root', 'nested/file'), '/tmp/root/nested/file');
});

test('path guard rejects existing and dangling symlink ancestors', async t => {
  const dir = await temporaryRoot(t);
  await fs.symlink(path.join(dir, 'missing'), path.join(dir, 'link'));
  assert.throws(() => safePath(dir, 'link/new-file'), /symlink/);
});

test('identifiers cannot contain traversal or executable characters', () => {
  for (const value of ['..', '../p', 'a/b', 'a\\b', '$(id)', 'a"b', '', null, 'a'.repeat(129)]) {
    assert.throws(() => assertIdentifier(value));
  }
  assertIdentifier('proj_ternfall-01');
});

test('storage refuses corrupted JSON instead of using a default', async t => {
  const dir = await temporaryRoot(t);
  const store = new StorageEngine(dir);
  t.after(() => store.close());
  await fs.writeFile(path.join(dir, 'example.json'), '{broken');
  await assert.rejects(store.readJson(path.join(dir, 'example.json'), {}), /refusing to replace/);
  assert.equal(await fs.readFile(path.join(dir, 'example.json'), 'utf8'), '{broken');
});

test('storage enforces containment on reads and writes', async t => {
  const dir = await temporaryRoot(t);
  const store = new StorageEngine(dir);
  t.after(() => store.close());
  await assert.rejects(store.readJson(path.join(dir, '..', 'outside.json'), {}), /Security Violation/);
  await assert.rejects(store.atomicWriteJson(path.join(dir, '..', 'outside.json'), {}), /Security Violation/);
  await assert.rejects(store.listEpisodes('../escape'), /invalid identifier/);
});

test('partial existing projects are never reseeded', async t => {
  const dir = await temporaryRoot(t);
  const projectDir = path.join(dir, 'projects', 'proj_ternfall_01');
  await fs.mkdir(projectDir, { recursive: true });
  await fs.writeFile(path.join(projectDir, 'project.json'), '{"preserve":true}');
  const store = new StorageEngine(dir);
  t.after(() => store.close());
  await assert.rejects(store.init(), /Incomplete default project/);
  assert.equal(await fs.readFile(path.join(projectDir, 'project.json'), 'utf8'), '{"preserve":true}');
});

async function api(t: any, token?: string) {
  const app = express();
  app.use(operatorAccess(token));
  app.use(express.json());
  app.use('/api', apiRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}

test('remote operator guard requires credentials and rejects cross-origin calls', async t => {
  const url = await api(t, 'test-operator-token');
  const endpoint = `${url}/api/roadmap/arcs`;
  assert.equal((await fetch(endpoint)).status, 401);
  assert.equal((await fetch(endpoint, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
  assert.equal((await fetch(endpoint, { headers: { Authorization: 'Bearer test-operator-token' } })).status, 200);
  assert.equal((await fetch(endpoint, { headers: { Authorization: `Basic ${Buffer.from('operator:test-operator-token').toString('base64')}` } })).status, 200);
  assert.equal((await fetch(endpoint, { headers: { Authorization: 'Bearer test-operator-token', Origin: 'https://attacker.example' } })).status, 403);
});

test('unsafe production/approval routes fail closed without touching project data', async t => {
  const url = await api(t);
  for (const endpoint of ['autoproduce/start', 'autoproduce/run_1/advance', 'spend-grants', 'flow/batch/batch_1/status', 'flow/cleanup-cache/S01E001', 'jobs/job_1/transition', 'jobs/job_1/reconcile', 'youtube/package', 'youtube/package/', 'jobs/job_1/transition/', 'spend-grants/', 'spend-grants/grant_1/revoke', 'spend-grants/grant_1/revoke/', 'YOUTUBE/PACKAGE', 'JOBS/job_1/RECONCILE', 'SPEND-GRANTS/', 'AUTOPRODUCE/START/']) {
    const response = await fetch(`${url}/api/projects/proj_1/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(response.status, 501, endpoint);
    assert.equal((await response.json()).ok, false);
  }
});

test('legacy placeholder render-script endpoints return no executable substitute', async t => {
  const url = await api(t);
  for (const endpoint of ['episodes/S01E001/render-script', 'EPISODES/S01E001/RENDER-SCRIPT/']) {
    const response = await fetch(`${url}/api/projects/proj_1/${endpoint}`);
    assert.equal(response.status, 501);
    const result = await response.json(); assert.equal(result.ok, false); assert.equal(result.data, undefined);
  }
});

test('API rejects unsafe identifiers and excessive workload before storage access', async t => {
  const url = await api(t);
  for (const [endpoint, body] of [
    ['projects/bad%24id/episodes', {}],
    ['projects/p/flow/plan/e', { durationSeconds: 10000000 }],
    ['projects/p/flow/plan/e', { fps: '24' }],
    ['projects/p/flow/plan/e', { episodeId: '../escape' }],
  ] as const) {
    const response = await fetch(`${url}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
});

test('retired Flow script routes reject scope/case/method variants without creating artifacts', async t => {
  const url = await api(t);
  for (const projectId of ['project_a', 'project_b']) {
    for (const route of ['stitch', 'autoworker', 'generate-audio', 'master-render', 'autoproduce']) {
      for (const method of ['GET', 'POST']) {
        for (const suffix of [`flow/${route}/S01E001`, `FLOW/${route.toUpperCase()}/S01E001/`]) {
          const response = await fetch(`${url}/api/projects/${projectId}/${suffix}`, { method });
          assert.equal(response.status, 501, `${method} ${suffix}`);
          const body = await response.json();
          assert.equal(body.ok, false); assert.equal(body.data, undefined);
          assert.equal(body.scriptPath, undefined); assert.equal(body.script, undefined);
        }
      }
    }
  }
});

test('retired CLI stitch rejects save and stdout modes without script files', async t => {
  const cwd = await temporaryRoot(t);
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  for (const flags of [[], ['--save']]) {
    await assert.rejects(promisify(execFile)(process.execPath, ['--import', loader, cli, 'flow', 'stitch', '--episode', 'S01E001', ...flags, '--json'], {
      cwd, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' },
    }), (error: any) => {
      assert.notEqual(error.code, 0); assert.match(error.stdout + error.stderr, /Legacy stitch scripts are retired/); return true;
    });
  }
  const files: string[] = [];
  async function visit(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) await visit(path.join(dir, entry.name)); else files.push(entry.name);
    }
  }
  await visit(cwd);
  assert.ok(!files.some(file => /\.(?:sh|bat|js)$/.test(file)), files.join(', '));
});
