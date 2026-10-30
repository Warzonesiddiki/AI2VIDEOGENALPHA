import { StorageEngine } from '../storage.ts';
const root = process.env.TEST_EPISODE_ROOT;
if (!root?.includes('ternfall-episode-test-')) throw new Error('Isolated episode fixture required');
const key = process.env.TEST_EPISODE_KEY;
const store = new StorageEngine(root);
try {
  const result = process.env.TEST_EPISODE_MODE === 'duplicate'
    ? await store.duplicateEpisode('proj_ternfall_01', 'S01E001', undefined, key)
    : await store.createEpisode('proj_ternfall_01', { idempotencyKey: key, workingTitle: 'Concurrent draft' });
  console.log(JSON.stringify(result));
} finally { store.close(); }
