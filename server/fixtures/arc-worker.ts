import { StorageEngine } from '../storage.ts';
const root = process.env.TEST_ARC_ROOT;
if (!root?.includes('ternfall-arc-test-')) throw new Error('Isolated arc fixture required');
const store = new StorageEngine(root);
try {
  console.log(JSON.stringify(await store.expandArc('proj_ternfall_01', { arcNumber: 1, count: 2, idempotencyKey: process.env.TEST_ARC_KEY })));
} finally { store.close(); }
