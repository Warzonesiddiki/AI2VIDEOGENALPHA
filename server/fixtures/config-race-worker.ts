import { StorageEngine } from '../storage.ts';
const root = process.env.TEST_CONFIG_ROOT;
const kind = process.env.TEST_CONFIG_KIND;
if (!root?.includes('ternfall-config-test-') || !['settings', 'series'].includes(kind ?? '')) throw new Error('Isolated configuration fixture required');
const storage = new StorageEngine(root);
try {
  const result = kind === 'settings'
    ? await storage.updateSettings({ revision: 0, productionTimezone: 'UTC' })
    : await storage.updateSeriesBible('proj_ternfall_01', { revision: 0, seriesTitle: 'Concurrent original fixture' });
  console.log(JSON.stringify({ ok: true, revision: result?.revision }));
} catch (error: any) {
  if (error.code !== 'REVISION_CONFLICT') throw error;
  console.log(JSON.stringify({ ok: false, code: error.code, currentRevision: error.currentRevision }));
} finally { storage.close(); }
