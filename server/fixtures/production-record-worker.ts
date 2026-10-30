import { StorageEngine } from '../storage.ts';
const root = process.env.TEST_RECORD_ROOT, kind = process.env.TEST_RECORD_KIND;
if (!root?.includes('ternfall-record-test-') || !['job', 'run', 'pkg'].includes(kind ?? '')) throw new Error('Isolated record fixture required');
const record = JSON.parse(process.env.TEST_RECORD_DATA!);
const storage = new StorageEngine(root);
try {
  const saved = kind === 'job' ? await storage.saveJob('proj_ternfall_01', record) : kind === 'run' ? await storage.saveAutoproduceRun('proj_ternfall_01', record) : await storage.savePackage('proj_ternfall_01', record);
  console.log(JSON.stringify({ ok: true, revision: saved.revision }));
} catch (error: any) {
  if (error.code !== 'REVISION_CONFLICT') throw error;
  console.log(JSON.stringify({ ok: false, currentRevision: error.currentRevision }));
} finally { storage.close(); }
