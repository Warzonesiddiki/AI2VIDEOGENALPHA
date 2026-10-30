import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { StorageEngine } from './storage.ts';
import { projectEditHandler } from './projectEdits.ts';
import { RevisionConflict } from './lib/conflicts.ts';
const project = 'proj_ternfall_01';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-project-test-'));
  const first = new StorageEngine(root), second = new StorageEngine(root); await first.init();
  t.after(async () => { first.close(); second.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, first, second };
}
async function api(t: any, storage: StorageEngine) {
  const app = express(); app.use(express.json());
  app.post('/projects', projectEditHandler(storage, 'create'));
  app.post('/projects/:id/archive', projectEditHandler(storage, 'archive'));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}`;
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('new projects validate text, generate unique server-owned identities and create complete metadata atomically', async t => {
  const { root, first } = await fixture(t);
  const projects = await Promise.all(Array.from({ length: 4 }, () => first.createProject('  Original fixture  ', 'Bounded description')));
  assert.equal(new Set(projects.map(item => item.id)).size, 4);
  for (const item of projects) {
    assert.match(item.id, /^proj_[0-9a-f-]{36}$/); assert.equal(item.revision, 1); assert.equal(item.name, 'Original fixture');
    assert.equal(item.productionRoot, path.join(root, 'projects', item.id));
    const bible = await first.getSeriesBible(item.id); assert.equal(bible?.projectId, item.id); assert.equal(bible?.id, item.activeSeriesId);
    assert.equal(bible?.logline, ''); assert.deepEqual(bible?.rules, []); assert.deepEqual(bible?.characters, []); assert.deepEqual(bible?.locations, []); assert.deepEqual(bible?.factions, []);
    assert.doesNotMatch(JSON.stringify(bible), /Rhea|Mara|South Gate|Ternfall/i);
    await assert.rejects(first.expandArc(item.id, { arcNumber: 1, count: 1, idempotencyKey: 'foreign_roadmap' }), /cannot be expanded into another project/);
    assert.deepEqual(await first.listEpisodes(item.id), []);
    assert.equal((await first.getProject(item.id))?.revision, 1);
  }
  const unicode = await first.createProject('असली कथा', 'Original fixture'); assert.equal(unicode.slug, 'project');
});

test('legacy project revisions are exposed without rewriting; archive/unarchive protects independent writers', async t => {
  const { root, first, second } = await fixture(t);
  const file = path.join(root, 'projects', project, 'project.json');
  const before = await first.readJson<any>(file, null);
  assert.equal((await first.getProject(project))?.revision, 0);
  assert.equal((await first.listProjects()).find(item => item.id === project)?.revision, 0);
  assert.deepEqual(await first.readJson(file, null), before);
  const saved = (await first.archiveProject(project, true, 0))!; assert.equal(saved.revision, 1); assert.ok(saved.archivedAt);
  await assert.rejects(second.archiveProject(project, false, 0), RevisionConflict);
  await assert.rejects(second.archiveProject(project, false), RevisionConflict);
  const restored = (await second.archiveProject(project, false, 1))!;
  assert.equal(restored.revision, 2); assert.equal(restored.isArchived, false); assert.equal(restored.archivedAt, undefined);
  for (const field of ['id', 'productionRoot', 'activeSeriesId', 'createdAt'] as const) assert.equal(restored[field], saved[field]);
});

test('project handlers reject coercion/unknown fields and return structured conflicts', async t => {
  const { first } = await fixture(t); const base = await api(t, first);
  const created = await post(`${base}/projects`, { name: 'API fixture' }); assert.equal(created.status, 201);
  const item = (await created.json()).data;
  for (const isArchived of ['false', 'true', 0, 1, null, [], {}]) {
    assert.equal((await post(`${base}/projects/${item.id}/archive`, { isArchived, revision: 1 })).status, 400);
  }
  assert.equal((await post(`${base}/projects/${item.id}/archive`, { isArchived: true, revision: 1, id: 'replacement' })).status, 400);
  assert.equal((await post(`${base}/projects/${item.id}/archive`, { isArchived: true, revision: 1 })).status, 200);
  const stale = await post(`${base}/projects/${item.id}/archive`, { isArchived: false, revision: 1 }); assert.equal(stale.status, 409);
  const error = await stale.json(); assert.equal(error.code, 'REVISION_CONFLICT'); assert.equal(error.currentRevision, 2);
  assert.equal((await post(`${base}/projects/missing_project/archive`, { isArchived: true, revision: 0 })).status, 404);
});

test('invalid creation or archive inputs do not change metadata or create project directories', async t => {
  const { root, first } = await fixture(t); const base = await api(t, first);
  const directories = await fs.readdir(path.join(root, 'projects'));
  for (const payload of [{ name: '' }, { name: '  ' }, { name: 12 }, { name: 'a'.repeat(201) }, { name: 'Bad\nName' }, { name: 'Valid', description: null }, { name: 'Valid', description: 12 }, { name: 'Valid', description: 'a'.repeat(5001) }, { name: 'Valid', productionRoot: '/tmp/escape' }]) {
    assert.equal((await post(`${base}/projects`, payload)).status, 400);
  }
  await assert.rejects(first.createProject('Bad\0Name', ''), /Project name/);
  for (const revision of [-1, null, '0', 1.5]) assert.equal((await post(`${base}/projects/${project}/archive`, { isArchived: true, revision })).status, 400);
  assert.deepEqual(await fs.readdir(path.join(root, 'projects')), directories);
  assert.equal((await first.getProject(project))?.revision, 0);
});

test('archiving is nondestructive and does not alter episodes, research or source files', async t => {
  const { root, first } = await fixture(t);
  const episodes = await first.listEpisodes(project), research = await first.listResearchClaims(project);
  const source = path.join(root, 'projects', project, 'fixture_source.txt'); await fs.writeFile(source, 'Original fixture');
  await first.archiveProject(project, true, 0);
  assert.deepEqual(await first.listEpisodes(project), episodes); assert.deepEqual(await first.listResearchClaims(project), research);
  assert.equal(await fs.readFile(source, 'utf8'), 'Original fixture');
});

test('simultaneous independent archive writers yield exactly one winner', async t => {
  const { root, first } = await fixture(t);
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const results = await Promise.all(['true', 'false'].map(async archived => {
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'server/fixtures/project-race-worker.ts'], {
      cwd: process.cwd(), env: { ...process.env, TEST_PROJECT_ROOT: root, TEST_PROJECT_ARCHIVED: archived },
    });
    return JSON.parse(stdout.trim());
  }));
  assert.equal(results.filter(result => result.ok).length, 1);
  const loser = results.find(result => !result.ok); assert.equal(loser.code, 'REVISION_CONFLICT'); assert.equal(loser.currentRevision, 1);
  assert.equal((await first.getProject(project))?.revision, 1);
});

test('typed CLI create/show/archive/unarchive works with isolated storage and rejects stale or missing tokens', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-project-cli-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  const run = async (...args: string[]) => {
    const { stdout } = await promisify(execFile)(process.execPath, ['--import', loader, cli, ...args, '--json'], { cwd, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } });
    return JSON.parse(stdout).data;
  };
  const created = await run('project', 'create', 'CLI original fixture'); assert.equal(created.revision, 1);
  assert.equal((await run('project', 'show', created.id)).isArchived, false);
  await assert.rejects(run('project', 'archive', created.id), /expected-revision/);
  const archived = await run('project', 'archive', created.id, '--expected-revision', '1'); assert.equal(archived.revision, 2); assert.equal(archived.isArchived, true);
  await assert.rejects(run('project', 'unarchive', created.id, '--expected-revision', '1'), /record changed/);
  const restored = await run('project', 'unarchive', created.id, '--expected-revision', '2'); assert.equal(restored.revision, 3); assert.equal(restored.isArchived, false);
  assert.ok(restored.productionRoot.startsWith(cwd + path.sep));
});

test('project metadata creation rolls back every document if a later document write fails', async t => {
  const { root, first } = await fixture(t);
  const { DocumentStore } = await import('./lib/documents.ts');
  const original = DocumentStore.prototype.write;
  let failedProject = '';
  const mocked = t.mock.method(DocumentStore.prototype, 'write', function (this: InstanceType<typeof DocumentStore>, file: string, data: unknown) {
    if (file.endsWith(`${path.sep}episodes.json`)) {
      failedProject = path.basename(path.dirname(file));
      throw new Error('fixture document failure');
    }
    return original.call(this, file, data);
  });
  try { await assert.rejects(first.createProject('Rollback fixture', ''), /fixture document failure/); }
  finally { mocked.mock.restore(); }
  assert.ok(failedProject);
  assert.equal(await first.getProject(failedProject), null);
  assert.equal(await first.getSeriesBible(failedProject), null);
  assert.equal((await first.listProjects()).some(item => item.id === failedProject), false);
  // Filesystem mkdir is not part of a SQLite transaction; empty orphan is retained.
  assert.deepEqual(await fs.readdir(path.join(root, 'projects', failedProject)), []);
});
