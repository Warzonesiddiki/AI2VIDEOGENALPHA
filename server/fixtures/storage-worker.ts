// Child-process concurrency/crash harness. Used only with isolated test roots.
import { StorageEngine } from '../storage.ts';
import { DocumentStore } from '../lib/documents.ts';
import path from 'node:path';
const root = process.env.TEST_STORAGE_ROOT;
if (!root || !root.includes('ternfall-transaction-test-')) throw new Error('Isolated test root required');
const store = new StorageEngine(root);
try {
  if (process.env.TEST_WORK === 'crash') {
    const documents = new DocumentStore(root);
    documents.transaction(() => {
      documents.write(path.join(root, 'crash.json'), { changed: true });
      process.exit(17); // deliberately terminate with an uncommitted transaction
    });
  } else if (process.env.TEST_WORK === 'reserve') {
    const result = await store.reserveSpend(JSON.parse(process.env.TEST_REQUEST!));
    console.log(JSON.stringify(result));
  } else {
    await store.init();
    const source = await store.getEpisode('proj_ternfall_01', 'S01E001');
    if (!source) throw new Error('Fixture episode missing');
    for (let i = 0; i < 10; i++) {
      const id = `ep_${process.env.TEST_WORK}_${i}`;
      await store.saveEpisode('proj_ternfall_01', { ...source, id, dbId: id });
    }
  }
} catch (error: any) {
  console.error(error.message); process.exitCode = 1;
} finally { store.close(); }
