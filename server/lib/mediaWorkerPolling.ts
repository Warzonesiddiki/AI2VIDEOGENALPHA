type Worker = { recoverInterrupted(): number; runNext(): Promise<unknown> };
type Options = {
  now?: () => number;
  recoveryIntervalMs?: number;
  onError: (error: unknown) => void;
  onRecoveryError?: (error: unknown) => void;
};

/** Single in-process tick at a time; SQLite still coordinates independent processes. */
export function createMediaWorkerTick(worker: Worker, options: Options) {
  const now = options.now ?? (() => performance.now());
  const interval = options.recoveryIntervalMs ?? 5000;
  if (!Number.isFinite(interval) || interval <= 0) throw new Error('Invalid worker recovery interval');
  let busy = false, nextRecovery = now() + interval;
  return async () => {
    if (busy) return;
    busy = true;
    let recoveryAttempted = false;
    try {
      const current = now();
      if (current >= nextRecovery) {
        nextRecovery = current + interval;
        recoveryAttempted = true;
        worker.recoverInterrupted();
      }
      await worker.runNext();
    } catch (error) {
      options.onError(error);
      if (!recoveryAttempted) {
        try { worker.recoverInterrupted(); }
        catch (recoveryError) { options.onRecoveryError?.(recoveryError); }
      }
    } finally { busy = false; }
  };
}
