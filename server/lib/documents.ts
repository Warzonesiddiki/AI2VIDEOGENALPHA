import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { safePath } from './paths.ts';

/** Local SQLite document store. Transactions are synchronous: never await inside one. */
export class DocumentStore {
  private db: DatabaseSync;
  private inTransaction = false;
  constructor(private root: string) {
    fs.mkdirSync(safePath(root, '.'), { recursive: true });
    const file = safePath(root, 'studio.sqlite');
    for (const suffix of ['-wal', '-shm']) safePath(root, `studio.sqlite${suffix}`);
    try { fs.closeSync(fs.openSync(file, 'wx', 0o600)); }
    catch (error: any) { if (error.code !== 'EEXIST') throw error; }
    fs.chmodSync(file, 0o600);
    this.db = new DatabaseSync(file);
    try {
      this.db.exec('PRAGMA busy_timeout=5000;');
      // SQLite journal-mode/schema setup can return BUSY without invoking its
      // busy handler when several new processes open a fresh database together.
      this.retryBusy(() => {
        const version = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
        if (version.user_version > 1) throw new Error('Database schema is newer than this application');
        this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
        this.transaction(() => this.db.exec('CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)), revision INTEGER NOT NULL DEFAULT 1); PRAGMA user_version=1;'));
      });
    } catch (error) { this.db.close(); throw error; }
  }
  private retryBusy<T>(operation: () => T): T {
    const deadline = Date.now() + 5000;
    while (true) {
      try { return operation(); }
      catch (error: any) {
        if (![5, 6].includes(error.errcode) || Date.now() >= deadline) throw error;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      }
    }
  }
  close() { this.db.close(); }
  backup(destination: string): void {
    const file = safePath(this.root, destination);
    if (this.inTransaction) throw new Error('Cannot back up during a transaction');
    if (fs.existsSync(file)) throw new Error('Backup destination already exists');
    this.db.prepare('VACUUM INTO ?').run(file);
    fs.chmodSync(file, 0o600);
  }
  transaction<T>(operation: () => T): T {
    if (this.inTransaction) return operation();
    this.db.exec('BEGIN IMMEDIATE');
    this.inTransaction = true;
    try {
      const result = operation();
      if (result instanceof Promise) throw new Error('Async callbacks are not permitted in storage transactions');
      this.db.exec('COMMIT');
      return result;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    finally { this.inTransaction = false; }
  }
  private key(file: string) { return path.relative(this.root, safePath(this.root, file)); }
  read<T>(file: string, fallback: T): T {
    const key = this.key(file);
    const row = this.db.prepare('SELECT value FROM documents WHERE key=?').get(key) as { value: string } | undefined;
    if (row) return JSON.parse(row.value);
    // Import on first access. A transaction prevents an old legacy snapshot from
    // overwriting a document another process imported or changed in the meantime.
    return this.transaction(() => {
      const existing = this.db.prepare('SELECT value FROM documents WHERE key=?').get(key) as { value: string } | undefined;
      if (existing) return JSON.parse(existing.value);
      if (!fs.existsSync(file)) return structuredClone(fallback);
      let value: T;
      try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch (cause) { throw new Error(`Storage read failed; refusing to replace unreadable data at ${file}`, { cause }); }
      this.write(file, value);
      return value;
    });
  }
  write<T>(file: string, value: T): void {
    const key = this.key(file);
    const json = JSON.stringify(value);
    if (json === undefined) throw new Error('Cannot persist undefined');
    this.db.prepare('INSERT INTO documents(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, revision=documents.revision+1').run(key, json);
  }
  has(file: string): boolean {
    return !!this.db.prepare('SELECT 1 FROM documents WHERE key=?').get(this.key(file));
  }
  /** Detect any stored descendants without interpreting wildcard characters in paths. */
  hasUnder(directory: string): boolean {
    const prefix = `${this.key(directory)}${path.sep}`;
    return !!this.db.prepare('SELECT 1 FROM documents WHERE substr(key, 1, length(?)) = ? LIMIT 1').get(prefix, prefix);
  }
  update<T>(file: string, fallback: T, change: (current: T) => T): T {
    return this.transaction(() => {
      const next = change(this.read(file, fallback));
      this.write(file, next);
      return next;
    });
  }
}
