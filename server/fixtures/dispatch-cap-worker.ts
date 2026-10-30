import { StorageEngine } from '../storage.ts';
const root = process.env.TEST_CAP_ROOT, reservation = process.env.TEST_CAP_RESERVATION;
if (!root?.includes('ternfall-audit-fix-test-') || !reservation) throw new Error('Isolated cap fixture required');
const store = new StorageEngine(root);
try {
  const result = await store.transitionSpend('proj_ternfall_01', reservation, 'dispatched');
  console.log(JSON.stringify({ ok: true, state: result.state }));
} catch (error: any) {
  if (!/budget cap exceeded/.test(error.message)) throw error;
  console.log(JSON.stringify({ ok: false, error: error.message }));
} finally { store.close(); }
