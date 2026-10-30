// Kills a recheck immediately before its first frame open, only in an isolated fixture root.
import fs from 'node:fs/promises';
import { StorageEngine } from '../storage.ts';
import { verifyFlowBatch } from '../flowVerification.ts';
const root = process.env.TEST_FLOW_RECHECK_ROOT;
const revision = Number(process.env.TEST_FLOW_RECHECK_REVISION);
if (!root || !root.includes('ternfall-flow-api-test-') || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Isolated Flow recheck fixture required');
const original = fs.open;
(fs as any).open = async (...args: any[]) => {
  if (String(args[0]).endsWith('frame_00001.png')) process.exit(19);
  return (original as any)(...args);
};
const store = new StorageEngine(root);
try { await verifyFlowBatch(store, 'proj_ternfall_01', 'S01E001', 'GF_S01E001_B0001', revision); }
finally { store.close(); }
throw new Error('Expected the fixture worker to exit before opening a frame');
