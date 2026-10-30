import fs from 'node:fs/promises';
import { constants, type BigIntStats } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { safePath } from './paths.ts';

/*
 * Offline, operator-attested backup with isolated restore only. SQLite and the
 * filesystem cannot be snapshotted atomically together here; callers must stop
 * every server/worker/writer. Change detection catches common mistakes, not a
 * hostile writer or every race. No operation promotes over live production.
 */
const FORMAT = 'ternfall-full-backup';
const VERSION = 1;
const MAX_ENTRIES = 250_000;
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024;
const MAX_DEPTH = 64;
const EXCLUDED_ROOT = new Set(['backups', 'restores', 'studio.sqlite', 'studio.sqlite-wal', 'studio.sqlite-shm', 'studio.sqlite-journal']);
const RESERVED_DATA = new Set(['backups', 'restores', 'studio.sqlite-wal', 'studio.sqlite-shm', 'studio.sqlite-journal']);
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const BUNDLE_ID = new RegExp(`^bundle_${UUID}$`);
const HEX_SHA256 = /^[0-9a-f]{64}$/;
const NOFOLLOW = typeof constants.O_NOFOLLOW === 'number' ? constants.O_NOFOLLOW : 0;

type InventoryEntry = { path: string; stamp: string; bytes?: number };
type Inventory = { directories: InventoryEntry[]; files: InventoryEntry[] };
export type BackupFile = { path: string; bytes: number; sha256: string };
export interface BackupManifest {
  format: typeof FORMAT;
  version: typeof VERSION;
  createdAt: string;
  consistency: 'operator-stopped; change-detected, not an atomic filesystem snapshot';
  directories: string[];
  files: BackupFile[];
}
const NOTICE = 'Hashes detect corruption but do not prove backup authenticity; metadata and files are consistent only if all writers were stopped. Absolute historical paths require review before use.';

function relativePath(relative: unknown): string {
  if (typeof relative !== 'string' || !relative || relative.length > 4096 || relative.includes('\\') || relative.includes('\0') || path.posix.isAbsolute(relative)) throw new Error('Invalid manifest path');
  const parts = relative.split('/');
  if (parts.some(part => !part || part === '.' || part === '..') || path.posix.normalize(relative) !== relative) throw new Error('Invalid manifest path');
  // Disallow drive-letter and alternate-data-stream syntax when restoring on Windows.
  if (parts.some(part => part.includes(':'))) throw new Error('Invalid manifest path');
  return relative;
}
function localPath(root: string, relative: string): string {
  return safePath(root, relativePath(relative).split('/').join(path.sep));
}
function stamp(stat: BigIntStats): string {
  return [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(':');
}
function sizeOf(stat: BigIntStats): number {
  if (stat.size < 0n || stat.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('File size is outside supported bounds');
  return Number(stat.size);
}
function assertBundleId(id: string): void {
  if (typeof id !== 'string' || !BUNDLE_ID.test(id)) throw new Error('Invalid backup bundle identifier');
}
function bundlePath(root: string, id: string): string {
  assertBundleId(id);
  return safePath(root, `backups/${id}`);
}

async function regularFile(root: string, relative: string): Promise<BigIntStats> {
  const stat = await fs.lstat(localPath(root, relative), { bigint: true });
  if (!stat.isFile()) throw new Error(`Not a regular file: ${relative}`);
  return stat;
}

/** Inventory includes empty directories, and never follows symlinks or special files. */
async function inventory(root: string, excludedTop = new Set<string>()): Promise<Inventory> {
  const base = safePath(root, '.');
  if (!(await fs.lstat(base)).isDirectory()) throw new Error('Backup source is not a directory');
  const result: Inventory = { directories: [], files: [] };
  async function walk(dir: string, relative: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) throw new Error('Directory depth exceeds backup limit');
    const entries = await fs.readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const item of entries) {
      if (!relative && excludedTop.has(item.name)) continue;
      const name = relativePath(relative ? `${relative}/${item.name}` : item.name);
      const full = localPath(root, name); // safePath rejects symlink ancestors and final symlinks.
      const info = await fs.lstat(full, { bigint: true });
      if (info.isSymbolicLink()) throw new Error(`Symlink is not allowed in backup: ${name}`);
      if (info.isDirectory()) {
        result.directories.push({ path: name, stamp: stamp(info) });
        if (result.directories.length + result.files.length > MAX_ENTRIES) throw new Error('Backup contains too many entries');
        await walk(full, name, depth + 1);
      } else if (info.isFile()) {
        result.files.push({ path: name, stamp: stamp(info), bytes: sizeOf(info) });
        if (result.directories.length + result.files.length > MAX_ENTRIES) throw new Error('Backup contains too many entries');
      } else throw new Error(`Special file is not allowed in backup: ${name}`);
    }
  }
  await walk(base, '', 0);
  return result;
}
function sameInventory(first: Inventory, second: Inventory): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/** Copy one opened regular file, hashing as it is streamed and checking for changes. */
async function copyFile(sourceRoot: string, destinationRoot: string, relative: string, expected?: { stamp?: string; bytes?: number; sha256?: string }): Promise<BackupFile> {
  const source = localPath(sourceRoot, relative), destination = localPath(destinationRoot, relative);
  const input = await fs.open(source, constants.O_RDONLY | NOFOLLOW);
  let output: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const before = await input.stat({ bigint: true });
    if (!before.isFile() || (expected?.stamp && stamp(before) !== expected.stamp)) throw new Error(`Source changed before backup: ${relative}`);
    const expectedBytes = expected?.bytes ?? sizeOf(before);
    if (sizeOf(before) !== expectedBytes) throw new Error(`Source size changed: ${relative}`);
    output = await fs.open(destination, 'wx', 0o600);
    const digest = createHash('sha256'); let bytes = 0;
    for await (const chunk of input.createReadStream({ autoClose: false })) {
      const data = chunk as Buffer; bytes += data.length;
      if (bytes > expectedBytes) throw new Error(`Source grew during backup: ${relative}`);
      digest.update(data);
      let offset = 0;
      while (offset < data.length) {
        const result = await output.write(data, offset, data.length - offset, null);
        if (!result.bytesWritten) throw new Error(`Backup write made no progress: ${relative}`);
        offset += result.bytesWritten;
      }
    }
    const hash = digest.digest('hex');
    if (bytes !== expectedBytes || stamp(await input.stat({ bigint: true })) !== stamp(before) || stamp(await regularFile(sourceRoot, relative)) !== stamp(before)) throw new Error(`Source changed during backup: ${relative}`);
    if (expected?.sha256 && hash !== expected.sha256) throw new Error(`Backup file hash mismatch: ${relative}`);
    await output.sync();
    return { path: relative, bytes, sha256: hash };
  } finally {
    try { await output?.close(); } finally { await input.close(); }
  }
}

async function hashFile(root: string, file: BackupFile): Promise<void> {
  const handle = await fs.open(localPath(root, file.path), constants.O_RDONLY | NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || sizeOf(before) !== file.bytes) throw new Error(`Backup size mismatch: ${file.path}`);
    const digest = createHash('sha256'); let bytes = 0;
    for await (const chunk of handle.createReadStream({ autoClose: false })) {
      const data = chunk as Buffer; bytes += data.length;
      if (bytes > file.bytes) throw new Error(`Backup size changed: ${file.path}`);
      digest.update(data);
    }
    if (bytes !== file.bytes || digest.digest('hex') !== file.sha256) throw new Error(`Backup hash mismatch: ${file.path}`);
    if (stamp(await handle.stat({ bigint: true })) !== stamp(before) || stamp(await regularFile(root, file.path)) !== stamp(before)) throw new Error(`Backup changed while verifying: ${file.path}`);
  } finally { await handle.close(); }
}
async function readBounded(root: string, relative: string, maximum: number): Promise<Buffer> {
  const handle = await fs.open(localPath(root, relative), constants.O_RDONLY | NOFOLLOW);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || sizeOf(before) > maximum) throw new Error(`Invalid or oversized file: ${relative}`);
    const expected = sizeOf(before); const buffer = Buffer.alloc(expected + 1); let used = 0;
    while (used < buffer.length) {
      const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
      if (!bytesRead) break;
      used += bytesRead;
    }
    if (used !== expected || stamp(await handle.stat({ bigint: true })) !== stamp(before) || stamp(await regularFile(root, relative)) !== stamp(before)) throw new Error(`File changed while reading: ${relative}`);
    return buffer.subarray(0, used);
  } finally { await handle.close(); }
}

function validateManifest(value: any): asserts value is BackupManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.format !== FORMAT || value.version !== VERSION || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) || value.consistency !== 'operator-stopped; change-detected, not an atomic filesystem snapshot') throw new Error('Invalid backup manifest format or version');
  if (!Array.isArray(value.directories) || !Array.isArray(value.files) || value.directories.length + value.files.length > MAX_ENTRIES) throw new Error('Invalid backup manifest inventory');
  const paths = new Set<string>(); const dirs = new Set<string>();
  for (const entry of value.directories) {
    const name = relativePath(entry);
    if (RESERVED_DATA.has(name.split('/')[0]) || name === 'studio.sqlite') throw new Error('Manifest directory is outside backup scope');
    if (paths.has(name)) throw new Error('Duplicate manifest path');
    paths.add(name); dirs.add(name);
  }
  for (const file of value.files) {
    if (!file || typeof file !== 'object' || Array.isArray(file)) throw new Error('Invalid manifest file');
    const name = relativePath(file.path);
    if (RESERVED_DATA.has(name.split('/')[0])) throw new Error('Manifest file is outside backup scope');
    if (paths.has(name)) throw new Error('Duplicate manifest path');
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0 || typeof file.sha256 !== 'string' || !HEX_SHA256.test(file.sha256)) throw new Error('Invalid manifest file size or hash');
    paths.add(name);
  }
  if (!value.files.some((file: BackupFile) => file.path === 'studio.sqlite')) throw new Error('Manifest is missing SQLite metadata');
  for (const name of paths) {
    const parent = path.posix.dirname(name);
    if (parent !== '.' && !dirs.has(parent)) throw new Error('Manifest path has a missing parent directory');
  }
}

async function verifyDatabase(root: string): Promise<void> {
  await regularFile(root, 'studio.sqlite');
  const db = new DatabaseSync(localPath(root, 'studio.sqlite'), { readOnly: true });
  try {
    db.exec('PRAGMA trusted_schema=OFF; PRAGMA query_only=ON;');
    const integrity = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
    if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') throw new Error('SQLite integrity check failed');
    const version = db.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version.user_version !== 1) throw new Error('Unsupported SQLite metadata schema version');
    const table = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'").get();
    if (!table) throw new Error('SQLite documents table is missing');
    const key = 'local_render_jobs.json';
    const length = db.prepare('SELECT length(CAST(value AS BLOB)) AS bytes FROM documents WHERE key=?').get(key) as { bytes: number } | undefined;
    if (length && (!Number.isSafeInteger(length.bytes) || length.bytes > MAX_MANIFEST_BYTES)) throw new Error('Local render job metadata exceeds backup inspection limit');
    const row = db.prepare('SELECT value FROM documents WHERE key=?').get(key) as { value: string } | undefined;
    let raw = row?.value;
    if (!row) {
      try { raw = (await readBounded(root, 'local_render_jobs.json', MAX_MANIFEST_BYTES)).toString('utf8'); }
      catch (error: any) { if (error.code !== 'ENOENT') throw error; }
    }
    if (raw !== undefined) {
      const jobs = JSON.parse(raw);
      if (!Array.isArray(jobs) || jobs.some((job: any) => !job || !['succeeded', 'failed', 'cancelled', 'interrupted'].includes(job.state))) throw new Error('Queued, running or invalid local render jobs must be resolved before backup or restore');
    }
  } finally { db.close(); }
}
async function verifyPayload(root: string, manifest: BackupManifest): Promise<void> {
  const actual = await inventory(root);
  const expectedDirs = [...manifest.directories].sort();
  const expectedFiles = manifest.files.map(file => file.path).sort();
  if (JSON.stringify(actual.directories.map(entry => entry.path).sort()) !== JSON.stringify(expectedDirs) || JSON.stringify(actual.files.map(entry => entry.path).sort()) !== JSON.stringify(expectedFiles)) throw new Error('Backup inventory mismatch: missing or unexpected files/directories');
  for (const file of manifest.files) await hashFile(root, file);
  await verifyDatabase(root);
}
async function makeDirectories(root: string, directories: string[]): Promise<void> {
  for (const dir of [...directories].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))) {
    await fs.mkdir(localPath(root, dir), { mode: 0o700 });
  }
}
async function writeExclusive(root: string, relative: string, contents: Buffer | string): Promise<void> {
  const file = await fs.open(localPath(root, relative), 'wx', 0o600);
  try { await file.writeFile(contents); await file.sync(); } finally { await file.close(); }
}
async function cleanupOnFailure(target: string, error: unknown): Promise<never> {
  try { await fs.rm(target, { recursive: true, force: true }); }
  catch (cleanupError) { throw new AggregateError([error, cleanupError], `Operation failed and incomplete directory could not be removed: ${target}`); }
  throw error;
}

/** Copies all production-root files except SQLite sidecars, prior backups and restores. */
export async function createFullBackup(root: string, options: { confirmStopped: boolean }) {
  if (options?.confirmStopped !== true) throw new Error('Confirm all servers, workers and other writers are stopped before backup');
  root = path.resolve(root);
  await regularFile(root, 'studio.sqlite');
  for (const sidecar of ['studio.sqlite-wal', 'studio.sqlite-shm', 'studio.sqlite-journal']) safePath(root, sidecar);
  if (!(await fs.lstat(safePath(root, 'projects'))).isDirectory()) throw new Error('Existing project directory is required');
  const backups = safePath(root, 'backups'); await fs.mkdir(backups, { recursive: true, mode: 0o700 });
  const id = `bundle_${randomUUID()}`, dir = bundlePath(root, id);
  await fs.mkdir(dir, { mode: 0o700 });
  try {
    const payload = safePath(root, path.join(dir, 'payload')); await fs.mkdir(payload, { mode: 0o700 });
    const db = new DatabaseSync(localPath(root, 'studio.sqlite'), { readOnly: true });
    let source: Inventory; let files: BackupFile[];
    try {
      db.exec('PRAGMA busy_timeout=5000; PRAGMA trusted_schema=OFF;');
      const before = (db.prepare('PRAGMA data_version').get() as { data_version: number }).data_version;
      source = await inventory(root, EXCLUDED_ROOT);
      await makeDirectories(payload, source.directories.map(entry => entry.path));
      // VACUUM INTO makes a consistent SQLite snapshot, including committed WAL pages.
      db.prepare('VACUUM INTO ?').run(localPath(payload, 'studio.sqlite'));
      await fs.chmod(localPath(payload, 'studio.sqlite'), 0o600);
      const snapshot = await fs.open(localPath(payload, 'studio.sqlite'), 'r+');
      try { await snapshot.sync(); } finally { await snapshot.close(); }
      await verifyDatabase(payload);
      files = [];
      for (const file of source.files) files.push(await copyFile(root, payload, file.path, file));
      if (!sameInventory(source, await inventory(root, EXCLUDED_ROOT))) throw new Error('Source files or directories changed during backup');
      const after = (db.prepare('PRAGMA data_version').get() as { data_version: number }).data_version;
      if (before !== after) throw new Error('Source database changed during backup');
    } finally { db.close(); }
    // Hash the independent SQLite snapshot, then re-read every copied file before marking complete.
    const sqliteStat = await regularFile(payload, 'studio.sqlite');
    const sqliteFile: BackupFile = { path: 'studio.sqlite', bytes: sizeOf(sqliteStat), sha256: '' };
    const sqliteHandle = await fs.open(localPath(payload, 'studio.sqlite'), constants.O_RDONLY | NOFOLLOW);
    try {
      const digest = createHash('sha256');
      for await (const chunk of sqliteHandle.createReadStream({ autoClose: false })) digest.update(chunk);
      sqliteFile.sha256 = digest.digest('hex');
    } finally { await sqliteHandle.close(); }
    files.push(sqliteFile); files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    const manifest: BackupManifest = { format: FORMAT, version: VERSION, createdAt: new Date().toISOString(), consistency: 'operator-stopped; change-detected, not an atomic filesystem snapshot', directories: source.directories.map(entry => entry.path), files };
    validateManifest(manifest);
    const bytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
    if (bytes.length > MAX_MANIFEST_BYTES) throw new Error('Backup manifest exceeds size limit');
    await verifyPayload(payload, manifest);
    await writeExclusive(dir, 'manifest.json', bytes);
    // COMPLETE is written only after the payload was fully verified.
    await writeExclusive(dir, 'COMPLETE', createHash('sha256').update(bytes).digest('hex') + '\n');
    return { status: 'complete' as const, bundleId: id, path: dir, fileCount: files.length, includesProductionRootFiles: true, notice: NOTICE };
  } catch (error) { return cleanupOnFailure(dir, error); }
}

export async function verifyFullBackup(root: string, id: string) {
  root = path.resolve(root); const dir = bundlePath(root, id);
  let complete: Buffer;
  try { complete = await readBounded(dir, 'COMPLETE', 256); }
  catch (error: any) { if (error.code === 'ENOENT') throw new Error('Backup is incomplete: COMPLETE marker is missing'); throw error; }
  const bytes = await readBounded(dir, 'manifest.json', MAX_MANIFEST_BYTES);
  if (complete.toString('utf8') !== createHash('sha256').update(bytes).digest('hex') + '\n') throw new Error('Backup manifest digest mismatch');
  const entries = (await fs.readdir(safePath(dir, '.'))).sort();
  if (JSON.stringify(entries) !== JSON.stringify(['COMPLETE', 'manifest.json', 'payload'].sort())) throw new Error('Unexpected backup bundle inventory');
  let manifest: unknown;
  try { manifest = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Invalid backup manifest JSON'); }
  validateManifest(manifest);
  await verifyPayload(safePath(dir, 'payload'), manifest);
  return { status: 'verified' as const, bundleId: id, path: dir, fileCount: manifest.files.length, notice: NOTICE, manifest };
}

/** Restore to a newly created, isolated directory only. No overwrite or live activation. */
export async function stageFullRestore(root: string, id: string, options: { confirmIsolated: boolean }) {
  if (options?.confirmIsolated !== true) throw new Error('Confirm an isolated staged restore; live production is never overwritten');
  root = path.resolve(root);
  const verified = await verifyFullBackup(root, id);
  const restores = safePath(root, 'restores'); await fs.mkdir(restores, { recursive: true, mode: 0o700 });
  const restoreId = `restore_${randomUUID()}`, dir = safePath(root, `restores/${restoreId}`);
  await fs.mkdir(dir, { mode: 0o700 });
  try {
    const data = safePath(root, path.join(dir, 'data')); await fs.mkdir(data, { mode: 0o700 });
    const destination = safePath(root, path.join(data, 'production_root')); await fs.mkdir(destination, { mode: 0o700 });
    const source = safePath(verified.path, 'payload');
    await makeDirectories(destination, verified.manifest.directories);
    for (const file of verified.manifest.files) await copyFile(source, destination, file.path, file);
    await verifyPayload(destination, verified.manifest);
    await writeExclusive(dir, 'RESTORE_INFO.json', JSON.stringify({ version: 1, bundleId: id, stagedAt: new Date().toISOString(), notice: NOTICE }, null, 2) + '\n');
    return { status: 'staged' as const, restoreId, path: dir, productionRoot: destination, sourceBundleId: id, notice: `${NOTICE} No live data was overwritten or activated.` };
  } catch (error) { return cleanupOnFailure(dir, error); }
}
