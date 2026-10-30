import { StorageEngine } from '../storage.ts';
const root = process.env.TEST_PROJECT_ROOT;
if (!root?.includes('ternfall-project-test-')) throw new Error('Isolated project fixture required');
const storage = new StorageEngine(root);
try {
  const saved = await storage.archiveProject('proj_ternfall_01', process.env.TEST_PROJECT_ARCHIVED === 'true', 0);
  console.log(JSON.stringify({ ok: true, revision: saved?.revision }));
} catch (error: any) {
  if (error.code !== 'REVISION_CONFLICT') throw error;
  console.log(JSON.stringify({ ok: false, code: error.code, currentRevision: error.currentRevision }));
} finally { storage.close(); }
