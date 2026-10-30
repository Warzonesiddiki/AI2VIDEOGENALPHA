// Runs only against a disposable media test root; used for recovery contention tests.
import { LocalMediaService } from '../localMedia.ts';
const root = process.env.TEST_MEDIA_RECOVERY_ROOT;
if (!root || !root.includes('ternfall-media-test-')) throw new Error('Isolated media test root required');
const worker = new LocalMediaService(root);
try { console.log(JSON.stringify({ recovered: worker.recoverInterrupted() })); }
finally { worker.close(); }
