// A separate process exercises the real SQLite retry/cleanup exclusion.
import { LocalMediaService } from '../localMedia.ts';
const root = process.env.TEST_MEDIA_CRASH_ROOT;
const id = process.env.TEST_MEDIA_JOB;
if (!root || !root.includes('ternfall-media-test-') || !id) throw new Error('Isolated fixture root/job required');
const service = new LocalMediaService(root);
try { service.retry('proj_ternfall_01', id); }
finally { service.close(); }
