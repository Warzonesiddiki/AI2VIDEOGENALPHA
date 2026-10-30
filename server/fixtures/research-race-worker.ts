import { StorageEngine } from '../storage.ts';
const root = process.env.TEST_RESEARCH_ROOT;
const raw = process.env.TEST_RESEARCH_CLAIM;
if (!root?.includes('ternfall-research-test-') || !raw) throw new Error('Isolated research fixture required');
const storage = new StorageEngine(root);
try {
  const saved = await storage.saveResearchClaim('proj_ternfall_01', JSON.parse(raw));
  console.log(JSON.stringify({ ok: true, revision: saved.revision }));
} catch (error: any) {
  if (error.code !== 'REVISION_CONFLICT') throw error;
  console.log(JSON.stringify({ ok: false, code: error.code, currentRevision: error.currentRevision }));
} finally { storage.close(); }
