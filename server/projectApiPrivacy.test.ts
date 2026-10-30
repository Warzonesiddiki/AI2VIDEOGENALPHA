import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { projectEditHandler, projectListHandler } from './projectEdits.ts';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-project-privacy-'));
  const store = new StorageEngine(root); await store.init(); const app = express(); app.use(express.json());
  app.get('/projects', projectListHandler(store)); app.post('/projects', projectEditHandler(store, 'create')); app.post('/projects/:id/archive', projectEditHandler(store, 'archive'));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, base: `http://127.0.0.1:${address.port}/projects` };
}
const post = (url: string, body: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('project list, creation and archive omit server paths and unknown stored fields', async t => {
  const { root, store, base } = await fixture(t);
  const createdResponse = await post(base, { name: 'Public fixture', description: 'Fixture description' });
  assert.equal(createdResponse.status, 201); assert.equal(createdResponse.headers.get('cache-control'), 'no-store');
  const created = (await createdResponse.json()).data; assert.equal(created.productionRoot, undefined); assert.ok(!JSON.stringify(created).includes(root));
  const file = path.join(root, 'projects', created.id, 'project.json'); const original = await store.readJson<any>(file, null);
  await store.atomicWriteJson(file, { ...original, privateField: { apiKey: 'private-project-token' } });
  const list = await fetch(base); assert.equal(list.status, 200); assert.equal(list.headers.get('cache-control'), 'no-store');
  const projects = (await list.json()).data; const item = projects.find((value: any) => value.id === created.id);
  assert.ok(item); assert.equal(item.privateField, undefined); assert.equal(item.productionRoot, undefined); assert.ok(!JSON.stringify(projects).includes('private-project-token')); assert.ok(!JSON.stringify(projects).includes(root));
  const archive = await post(`${base}/${created.id}/archive`, { revision: item.revision, isArchived: true });
  assert.equal(archive.status, 200); assert.equal(archive.headers.get('cache-control'), 'no-store');
  const archived = (await archive.json()).data; assert.equal(archived.isArchived, true); assert.equal(archived.privateField, undefined); assert.equal(archived.productionRoot, undefined);
  const stored = await store.readJson<any>(file, null); assert.deepEqual(stored.privateField, { apiKey: 'private-project-token' }); assert.equal(stored.productionRoot, original.productionRoot);
});

test('project list refuses metadata whose identity belongs to a different directory', async t => {
  const { root, store, base } = await fixture(t);
  const first = await store.createProject('First fixture', ''); const second = await store.createProject('Second fixture', '');
  const file = path.join(root, 'projects', first.id, 'project.json');
  await store.atomicWriteJson(file, { ...first, id: second.id });
  const response = await fetch(base); assert.equal(response.status, 500); assert.equal(response.headers.get('cache-control'), 'no-store');
  await assert.rejects(store.getProject(first.id));
  const stored = await store.readJson<any>(file, null); assert.equal(stored.id, second.id); assert.equal(stored.isArchived, false);
});

test('malformed nested values in public project fields do not reach the browser', async t => {
  const { root, store, base } = await fixture(t); const created = await store.createProject('Malformed fixture', '');
  const file = path.join(root, 'projects', created.id, 'project.json');
  await store.atomicWriteJson(file, { ...created, description: { secret: 'private-malformed-project-token' } });
  const response = await fetch(base); assert.equal(response.status, 500); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.ok(!(await response.text()).includes('private-malformed-project-token'));
  const archive = await post(`${base}/${created.id}/archive`, { revision: created.revision, isArchived: true });
  assert.equal(archive.status, 500); assert.ok(!(await archive.text()).includes('private-malformed-project-token'));
  const stored = await store.readJson<any>(file, null); assert.equal(stored.isArchived, false); assert.equal(stored.revision, created.revision);
  const invalidRevision = { ...created, revision: null }; await store.atomicWriteJson(file, invalidRevision);
  const invalid = await fetch(base); assert.equal(invalid.status, 500); assert.deepEqual(await store.readJson(file, null), invalidRevision);
});
