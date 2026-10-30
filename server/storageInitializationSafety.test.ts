import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { DocumentStore } from './lib/documents.ts';

const project = 'proj_ternfall_01';
async function tempRoot(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-seed-safety-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('missing default project directory never causes existing SQLite documents to be reseeded or overwritten', async t => {
  const root = await tempRoot(t), store = new StorageEngine(root); await store.init();
  const episodesPath = path.join(root, 'projects', project, 'episodes.json');
  const before = await store.readJson<any[]>(episodesPath, []);
  before[0].workingTitle = 'Irreplaceable synthetic draft'; await store.atomicWriteJson(episodesPath, before); store.close();
  // Simulated loss of a directory in the isolated fixture only; database remains.
  await fs.rm(path.join(root, 'projects', project), { recursive: true });
  const reopen = new StorageEngine(root);
  try {
    await assert.rejects(reopen.init(), /incomplete|missing|restore/i);
    assert.equal((await reopen.readJson<any[]>(episodesPath, []))[0].workingTitle, 'Irreplaceable synthetic draft');
  } finally { reopen.close(); }
});

test('a missing default directory with any historical project document refuses initial seeding', async t => {
  const root = await tempRoot(t); const file = path.join(root, 'projects', project, 'custom-history.json');
  const documents = new DocumentStore(root); documents.write(file, { valuable: true }); documents.close();
  const store = new StorageEngine(root);
  try {
    await assert.rejects(store.init(), /incomplete|missing|restore/i);
    assert.deepEqual(await store.readJson(file, {}), { valuable: true });
    assert.deepEqual(await store.readJson(path.join(root, 'projects', project, 'episodes.json'), []), []);
  } finally { store.close(); }
});

test('an empty directory with existing SQLite project records is not reseeded', async t => {
  const root = await tempRoot(t); const store = new StorageEngine(root); await store.init();
  const file = path.join(root, 'projects', project, 'episodes.json');
  const episodes = await store.readJson<any[]>(file, []); episodes[0].workingTitle = 'Preserved synthetic edit';
  await store.atomicWriteJson(file, episodes); store.close();
  const reopen = new StorageEngine(root);
  try { await reopen.init(); assert.equal((await reopen.getEpisode(project, 'S01E001'))?.workingTitle, 'Preserved synthetic edit'); }
  finally { reopen.close(); }
});

test('startup refuses symlinked project and backup roots rather than following them', async t => {
  for (const link of ['projects', 'backups']) {
    const root = await tempRoot(t), outside = await tempRoot(t);
    await fs.writeFile(path.join(outside, 'sentinel.txt'), 'preserve');
    try { await fs.symlink(outside, path.join(root, link), 'dir'); }
    catch (error: any) {
      if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation needs privileges'); return; }
      throw error;
    }
    const store = new StorageEngine(root);
    try { await assert.rejects(store.init(), /symlink/i); }
    finally { store.close(); }
    assert.equal(await fs.readFile(path.join(outside, 'sentinel.txt'), 'utf8'), 'preserve');
  }
});
