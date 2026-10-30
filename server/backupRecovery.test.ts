import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { mediaProcess } from './lib/mediaProcess.ts';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { StorageEngine } from './storage.ts';
import { LocalMediaService } from './localMedia.ts';
import { createFullBackup, verifyFullBackup, stageFullRestore } from './lib/backupRecovery.ts';

const project = 'proj_ternfall_01';
async function fixture(t: any) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-backup-test-'));
  const root = path.join(cwd, 'data', 'production_root');
  const store = new StorageEngine(root); await store.init();
  const asset = path.join(root, 'projects', project, 'assets', 'flow_renders', 'S01E001', 'frame_00001.png');
  const audio = path.join(root, 'projects', project, 'audio', 'S01E001', 'narration.wav');
  const exported = path.join(root, 'projects', project, 'exports', 'master.mp4');
  for (const file of [asset, audio, exported]) await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(asset, 'synthetic frame bytes'); await fs.writeFile(audio, 'synthetic audio bytes'); await fs.writeFile(exported, 'synthetic export bytes');
  await fs.mkdir(path.join(root, 'projects', project, 'empty-folder'));
  await fs.writeFile(path.join(root, 'notes.txt'), 'operator notes');
  const episode = await store.getEpisode(project, 'S01E001');
  t.after(async () => { store.close(); await fs.rm(cwd, { recursive: true, force: true }); });
  return { cwd, root, store, asset, audio, exported, episode };
}
const create = (root: string) => createFullBackup(root, { confirmStopped: true });
const stage = (root: string, id: string) => stageFullRestore(root, id, { confirmIsolated: true });
const payload = (root: string, id: string) => path.join(root, 'backups', id, 'payload');
async function mutateManifest(root: string, id: string, change: (manifest: any) => void) {
  const dir = path.join(root, 'backups', id); const file = path.join(dir, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(file, 'utf8')); change(manifest);
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  await fs.writeFile(file, bytes);
  await fs.writeFile(path.join(dir, 'COMPLETE'), createHash('sha256').update(bytes).digest('hex') + '\n');
}

test('full backup verifies and stages an isolated metadata-plus-media restore without overwriting the source', async t => {
  const { root, store, asset, audio, exported, episode } = await fixture(t);
  // A separate uncheckpointed writer keeps committed data in WAL; the backup must include it.
  await store.atomicWriteJson(path.join(root, 'fixture-after-seed.json'), { latest: 'committed WAL value' });
  assert.ok((await fs.stat(path.join(root, 'studio.sqlite-wal'))).size > 0);
  const backup = await create(root);
  assert.match(backup.bundleId, /^bundle_/); assert.equal(backup.status, 'complete');
  const checked = await verifyFullBackup(root, backup.bundleId);
  assert.equal(checked.status, 'verified'); assert.ok(checked.fileCount >= 5);
  assert.notEqual(checked.notice.indexOf('authenticity'), -1);
  const restored = await stage(root, backup.bundleId);
  assert.equal(restored.status, 'staged'); assert.ok(restored.productionRoot.startsWith(path.join(root, 'restores') + path.sep));
  for (const original of [asset, audio, exported]) {
    const relative = path.relative(root, original);
    assert.deepEqual(await fs.readFile(path.join(restored.productionRoot, relative)), await fs.readFile(original));
  }
  assert.ok((await fs.stat(path.join(restored.productionRoot, 'projects', project, 'empty-folder'))).isDirectory());
  const reopened = new StorageEngine(restored.productionRoot);
  try {
    await reopened.init();
    assert.deepEqual(await reopened.getEpisode(project, 'S01E001'), episode);
    assert.deepEqual(await reopened.readJson(path.join(restored.productionRoot, 'fixture-after-seed.json'), {}), { latest: 'committed WAL value' });
    assert.equal((await reopened.listProjects()).find(item => item.id === project)?.id, project);
  } finally { reopened.close(); }
  assert.deepEqual(await store.getEpisode(project, 'S01E001'), episode);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
});

test('creation and staging require explicit confirmation; invalid identifiers never escape the root', async t => {
  const { root } = await fixture(t);
  await assert.rejects(createFullBackup(root, { confirmStopped: false }), /stop|confirm/i);
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  const backup = await create(root);
  await assert.rejects(stageFullRestore(root, backup.bundleId, { confirmIsolated: false }), /confirm|isolat/i);
  for (const id of ['../outside', '/tmp/other', 'bundle_../../other', 'bundle_fake']) {
    await assert.rejects(verifyFullBackup(root, id), /identifier|bundle/i);
    await assert.rejects(stage(root, id), /identifier|bundle/i);
  }
});

test('queued and running local renders block a full backup instead of being replayed on a restore', async t => {
  const { root, store } = await fixture(t);
  const worker = new LocalMediaService(root);
  const job = worker.enqueue({ projectId: project, episodeId: 'S01E001', frameCount: 24, fps: 24, audioFile: 'voice.wav', idempotencyKey: 'fixture_backup' });
  await assert.rejects(create(root), /queued|running|render/i);
  const jobsFile = path.join(root, 'local_render_jobs.json');
  const jobs = await store.readJson<any[]>(jobsFile, []); jobs[0].state = 'running';
  await store.atomicWriteJson(jobsFile, jobs);
  await assert.rejects(create(root), /queued|running|render/i);
  jobs[0].state = 'queued'; await store.atomicWriteJson(jobsFile, jobs);
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  worker.cancel(project, job.id); worker.close();
  assert.equal((await create(root)).status, 'complete');
});

test('source symlinks and special files are refused without reading or altering their targets', async t => {
  const { root, asset } = await fixture(t);
  const link = path.join(root, 'projects', project, 'escape');
  try { await fs.symlink(asset, link); } catch (error: any) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation needs privileges'); return; }
    throw error;
  }
  await assert.rejects(create(root), /symlink/i);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
});

test('corruption, missing or extra files, and invalid completion markers block verification and staging', async t => {
  const { root, asset } = await fixture(t);
  const backup = await create(root), copy = path.join(payload(root, backup.bundleId), path.relative(root, asset));
  await fs.writeFile(copy, 'corrupted bytes');
  await assert.rejects(verifyFullBackup(root, backup.bundleId), /hash|digest|size|integrity/i);
  await assert.rejects(stage(root, backup.bundleId), /hash|digest|size|integrity/i);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
  assert.deepEqual(await fs.readdir(path.join(root, 'restores')).catch(() => []), []);

  const missing = await create(root); await fs.unlink(path.join(payload(root, missing.bundleId), path.relative(root, asset)));
  await assert.rejects(verifyFullBackup(root, missing.bundleId), /missing|mismatch|inventory/i);
  const extra = await create(root); await fs.writeFile(path.join(payload(root, extra.bundleId), 'unlisted.txt'), 'extra');
  await assert.rejects(verifyFullBackup(root, extra.bundleId), /unexpected|mismatch|inventory/i);
  const incomplete = await create(root); await fs.unlink(path.join(root, 'backups', incomplete.bundleId, 'COMPLETE'));
  await assert.rejects(verifyFullBackup(root, incomplete.bundleId), /incomplete|complete/i);
});

test('even a recomputed marker cannot make traversal, duplicate paths or unknown versions safe', async t => {
  const { root } = await fixture(t);
  for (const change of [
    (manifest: any) => { manifest.files[0].path = '../outside'; },
    (manifest: any) => { manifest.files.push({ ...manifest.files[0] }); },
    (manifest: any) => { manifest.version = 999; },
    (manifest: any) => { manifest.directories.push('backups'); },
  ]) {
    const backup = await create(root); await mutateManifest(root, backup.bundleId, change);
    await assert.rejects(verifyFullBackup(root, backup.bundleId), /manifest|path|version|duplicate|scope/i);
    await assert.rejects(stage(root, backup.bundleId));
  }
});

test('a source mutation during copy and a simulated ENOSPC leave no completed bundle and preserve source data', async t => {
  const { root, asset } = await fixture(t); const original = fs.open.bind(fs);
  let changed = false;
  const mutation = t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    if (!changed && String(args[0]).includes('/payload/projects/') && String(args[0]).endsWith('frame_00001.png')) {
      changed = true; await fs.writeFile(asset, 'changed while backing up');
    }
    return original(...args);
  });
  await assert.rejects(create(root), /changed|mutation|source/i); mutation.mock.restore();
  assert.equal(changed, true); assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  await fs.writeFile(asset, 'synthetic frame bytes');
  const full = t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    if (String(args[0]).includes('/payload/projects/') && String(args[0]).endsWith('frame_00001.png')) throw Object.assign(new Error('simulated disk full'), { code: 'ENOSPC' });
    return original(...args);
  });
  await assert.rejects(create(root), /disk full/i); full.mock.restore();
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
});

test('a database write during copying invalidates the combined snapshot', async t => {
  const { root, store } = await fixture(t); const original = fs.open.bind(fs); let changed = false;
  const mock = t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    if (!changed && String(args[0]).includes('/payload/projects/') && String(args[0]).endsWith('frame_00001.png')) {
      changed = true; await store.atomicWriteJson(path.join(root, 'concurrent-fixture.json'), { changed: true });
    }
    return original(...args);
  });
  await assert.rejects(create(root), /database|metadata|changed/i); mock.mock.restore();
  assert.equal(changed, true); assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  assert.deepEqual(await store.readJson(path.join(root, 'concurrent-fixture.json'), {}), { changed: true });
});

test('CLI backup commands operate on the isolated root and do not initialize a missing source', async t => {
  const { cwd, root, store } = await fixture(t); store.close();
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  const run = async (...args: string[]) => JSON.parse((await promisify(execFile)(process.execPath, ['--import', loader, cli, ...args, '--json'], { cwd, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } })).stdout).data;
  await assert.rejects(run('backup', 'create'));
  const backup = await run('backup', 'create', '--confirm-stopped');
  assert.equal((await run('backup', 'verify', backup.bundleId)).status, 'verified');
  await assert.rejects(run('backup', 'stage', backup.bundleId));
  assert.equal((await run('backup', 'stage', backup.bundleId, '--confirm-isolated')).status, 'staged');
  const empty = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-backup-no-source-'));
  t.after(() => fs.rm(empty, { recursive: true, force: true }));
  await assert.rejects(promisify(execFile)(process.execPath, ['--import', loader, cli, 'backup', 'create', '--confirm-stopped', '--json'], { cwd: empty, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } }));
  assert.equal(await fs.stat(path.join(empty, 'data', 'production_root', 'studio.sqlite')).then(() => true, () => false), false);
  assert.equal(await fs.readFile(path.join(root, 'notes.txt'), 'utf8'), 'operator notes');
});


test('legacy queued-render metadata is checked even when it was not imported into SQLite', async t => {
  const { root } = await fixture(t); const legacy = path.join(root, 'local_render_jobs.json');
  await fs.writeFile(legacy, JSON.stringify([{ state: 'queued' }]));
  await assert.rejects(create(root), /queued|running|render/i);
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
  await fs.writeFile(legacy, JSON.stringify([{ state: 'cancelled' }]));
  assert.equal((await create(root)).status, 'complete');
});

test('SQLite structural corruption is rejected even if file and manifest hashes were recomputed', async t => {
  const { root } = await fixture(t); const backup = await create(root);
  const db = path.join(payload(root, backup.bundleId), 'studio.sqlite');
  const corrupt = Buffer.from('not a SQLite database'); await fs.writeFile(db, corrupt);
  await mutateManifest(root, backup.bundleId, manifest => {
    const entry = manifest.files.find((file: any) => file.path === 'studio.sqlite');
    entry.bytes = corrupt.length; entry.sha256 = createHash('sha256').update(corrupt).digest('hex');
  });
  await assert.rejects(verifyFullBackup(root, backup.bundleId), /database|SQLite|malformed/i);
  await assert.rejects(stage(root, backup.bundleId));
});

test('a symlink introduced into a bundle is rejected before reading its target', async t => {
  const { root, asset } = await fixture(t); const backup = await create(root);
  const copied = path.join(payload(root, backup.bundleId), path.relative(root, asset));
  await fs.unlink(copied);
  try { await fs.symlink(asset, copied); } catch (error: any) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) { t.skip('Symlink creation needs privileges'); return; }
    throw error;
  }
  await assert.rejects(verifyFullBackup(root, backup.bundleId), /symlink/i);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
});

test('stage ENOSPC cleans only its incomplete copy and leaves source and backup intact', async t => {
  const { root, asset } = await fixture(t); const backup = await create(root); const original = fs.open.bind(fs);
  const mocked = t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    if (String(args[0]).includes('/restores/') && String(args[0]).endsWith('frame_00001.png')) throw Object.assign(new Error('restore disk full'), { code: 'ENOSPC' });
    return original(...args);
  });
  await assert.rejects(stage(root, backup.bundleId), /disk full/i); mocked.mock.restore();
  assert.deepEqual(await fs.readdir(path.join(root, 'restores')), []);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
  assert.equal((await verifyFullBackup(root, backup.bundleId)).status, 'verified');
});

test('archive mutation after initial verification is caught during stage and never touches source', async t => {
  const { root, asset } = await fixture(t); const backup = await create(root); const original = fs.open.bind(fs); let changed = false;
  const archivedAsset = path.join(payload(root, backup.bundleId), path.relative(root, asset));
  const mocked = t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    if (!changed && String(args[0]).includes('/restores/') && String(args[0]).endsWith('frame_00001.png')) {
      changed = true; await fs.writeFile(archivedAsset, 'changed after verification');
    }
    return original(...args);
  });
  await assert.rejects(stage(root, backup.bundleId), /changed|hash|size|source/i); mocked.mock.restore();
  assert.equal(changed, true); assert.deepEqual(await fs.readdir(path.join(root, 'restores')), []);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
});

test('cleanup failure is reported and leaves only an unverified incomplete bundle', async t => {
  const { root } = await fixture(t); const originalOpen = fs.open.bind(fs); const originalRm = fs.rm.bind(fs);
  const open = t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    if (String(args[0]).includes('/payload/projects/') && String(args[0]).endsWith('frame_00001.png')) throw new Error('fixture copy failure');
    return originalOpen(...args);
  });
  const rm = t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (String(args[0]).includes('/backups/bundle_')) throw new Error('fixture cleanup failure');
    return originalRm(...args);
  });
  await assert.rejects(create(root), /incomplete directory could not be removed/i); open.mock.restore(); rm.mock.restore();
  const names = await fs.readdir(path.join(root, 'backups')); assert.equal(names.length, 1);
  await assert.rejects(verifyFullBackup(root, names[0]), /incomplete|complete/i);
});

test('a killed backup process cannot publish a complete marker', async t => {
  const { root, asset } = await fixture(t);
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), fixturePath = path.resolve('server/fixtures/backup-crash-worker.ts');
  const child = spawn(process.execPath, ['--import', loader, fixturePath], { env: { ...process.env, TEST_BACKUP_ROOT: root }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000); timeout.unref();
  try {
    const [message] = await Promise.race([once(child, 'message'), once(child, 'exit').then(() => { throw new Error('Fixture worker exited before reaching copy'); })]); assert.equal(message, 'copy-started');
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  } finally { clearTimeout(timeout); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  const names = await fs.readdir(path.join(root, 'backups')); assert.equal(names.length, 1);
  await assert.rejects(verifyFullBackup(root, names[0]), /incomplete|complete/i);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
});

test('an independently copied bundle stages and opens on an otherwise empty recovery root', async t => {
  const { root, store, episode, asset } = await fixture(t);
  await fs.writeFile(path.join(root, 'backups', 'old-operator-backup.txt'), 'excluded previous backup');
  await fs.mkdir(path.join(root, 'restores', 'old-restore'), { recursive: true });
  await fs.writeFile(path.join(root, 'restores', 'old-restore', 'sentinel.txt'), 'excluded previous restore');
  const backup = await create(root), verified = await verifyFullBackup(root, backup.bundleId);
  assert.equal(verified.manifest.files.some(file => file.path.startsWith('backups/') || file.path.startsWith('restores/')), false);
  const recoveryCwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-disaster-rehearsal-'));
  t.after(() => fs.rm(recoveryCwd, { recursive: true, force: true }));
  const recoveryRoot = path.join(recoveryCwd, 'data', 'production_root');
  await fs.mkdir(path.join(recoveryRoot, 'backups'), { recursive: true });
  await fs.cp(backup.path, path.join(recoveryRoot, 'backups', backup.bundleId), { recursive: true, errorOnExist: true, force: false });
  assert.equal((await verifyFullBackup(recoveryRoot, backup.bundleId)).status, 'verified');
  const recovered = await stage(recoveryRoot, backup.bundleId);
  assert.equal(await fs.stat(path.join(recoveryRoot, 'studio.sqlite')).then(() => true, () => false), false);
  const restored = new StorageEngine(recovered.productionRoot);
  try { await restored.init(); assert.deepEqual(await restored.getEpisode(project, 'S01E001'), episode); }
  finally { restored.close(); }
  assert.equal(await fs.readFile(path.join(recovered.productionRoot, path.relative(root, asset)), 'utf8'), 'synthetic frame bytes');
  assert.deepEqual(await store.getEpisode(project, 'S01E001'), episode);
});

test('a FIFO or other special source file is refused without consuming it', async t => {
  if (process.platform === 'win32') { t.skip('POSIX FIFO fixture'); return; }
  const { root, asset } = await fixture(t); const fifo = path.join(root, 'projects', project, 'pipe');
  await promisify(execFile)('mkfifo', [fifo]);
  await assert.rejects(create(root), /special file/i);
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
  assert.deepEqual(await fs.readdir(path.join(root, 'backups')), []);
});

test('a killed staged restore is incomplete, leaves the backup valid and never overwrites source', async t => {
  const { root, asset } = await fixture(t); const backup = await create(root);
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), fixturePath = path.resolve('server/fixtures/backup-crash-worker.ts');
  const child = spawn(process.execPath, ['--import', loader, fixturePath], { env: { ...process.env, TEST_BACKUP_ROOT: root, TEST_BACKUP_MODE: 'stage', TEST_BUNDLE_ID: backup.bundleId }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000); timeout.unref();
  try {
    const [message] = await Promise.race([once(child, 'message'), once(child, 'exit').then(() => { throw new Error('Fixture worker exited before reaching copy'); })]); assert.equal(message, 'copy-started');
    const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited;
  } finally { clearTimeout(timeout); if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
  const names = await fs.readdir(path.join(root, 'restores')); assert.equal(names.length, 1);
  assert.equal(await fs.stat(path.join(root, 'restores', names[0], 'RESTORE_INFO.json')).then(() => true, () => false), false);
  assert.equal((await verifyFullBackup(root, backup.bundleId)).status, 'verified');
  assert.equal(await fs.readFile(asset, 'utf8'), 'synthetic frame bytes');
});


test('a real short render remains hash-verifiable and playable from a staged restore', async t => {
  const { root, store } = await fixture(t);
  const require = createRequire(import.meta.url);
  const binaries = { ffmpeg: require('@ffmpeg-installer/ffmpeg').path, ffprobe: require('@ffprobe-installer/ffprobe').path };
  const frames = path.join(root, 'projects', project, 'assets', 'flow_renders', 'S01E001');
  const audio = path.join(root, 'projects', project, 'audio', 'S01E001', 'fixture_audio.wav');
  const png = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#13727a' } }).png().toBuffer();
  await Promise.all(Array.from({ length: 24 }, (_, i) => fs.writeFile(path.join(frames, `frame_${String(i + 1).padStart(5, '0')}.png`), png)));
  await mediaProcess(binaries.ffmpeg, ['-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ar', '48000', '-ac', '2', audio]);
  const worker = new LocalMediaService(root, binaries);
  const queued = worker.enqueue({ projectId: project, episodeId: 'S01E001', frameCount: 24, fps: 24, audioFile: 'fixture_audio.wav', idempotencyKey: 'backup_actual_media' });
  try {
    const rendered = await worker.runNext(); assert.equal(rendered?.state, 'succeeded', rendered?.error); assert.equal(rendered?.qc?.passed, true);
  } finally { worker.close(); store.close(); }
  const backup = await create(root); const staged = await stage(root, backup.bundleId);
  const restored = new LocalMediaService(staged.productionRoot, binaries);
  try {
    const result = restored.get(project, queued.id); assert.equal(result?.state, 'succeeded');
    const opened = await restored.openVerifiedMedia(project, queued.id);
    try { assert.equal(opened.sha256, result?.qc?.sha256); assert.ok(opened.size > 32); const first = Buffer.alloc(32); assert.equal((await opened.handle.read(first, 0, first.length, 0)).bytesRead, 32); }
    finally { await opened.handle.close(); }
  } finally { restored.close(); }
});
