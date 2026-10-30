// Deliberately exits after durably claiming a local-only fixture job.
import { LocalMediaService } from '../localMedia.ts';
const root = process.env.TEST_MEDIA_CRASH_ROOT;
if (!root || !root.includes('ternfall-media-test-')) throw new Error('Isolated media test root required');
const worker = new LocalMediaService(root);
if (process.env.TEST_ATOMIC_ENQUEUE_CLAIM === 'true') {
  // One transaction prevents the already-running server from claiming between
  // fixture enqueue and claim. The job remains a real service-generated claim.
  const claimed = (worker as any).db.transaction(() => {
    worker.enqueue({ projectId: 'proj_ternfall_01', episodeId: 'S01E001', frameCount: 24, fps: 24, audioFile: 'fixture.wav', idempotencyKey: 'post_start_crash' });
    return (worker as any).claim();
  });
  if (!claimed) throw new Error('Expected an isolated claimed job');
  console.log(claimed.id);
  process.exit(19);
} else if (process.env.TEST_CRASH_AFTER_SEGMENT === 'true') {
  void worker.runNext();
  setInterval(() => {
    const job = worker.list('proj_ternfall_01').find(job => job.state === 'running');
    if ((job?.progress?.encodedSegments ?? 0) >= 1) process.exit(19);
  }, 5);
} else {
  void worker.runNext(); // claim is synchronous; first filesystem await has not completed
  process.exit(19);
}
