import { spawn } from 'node:child_process';

export function mediaBinary(kind: 'ffmpeg' | 'ffprobe'): string {
  const configured = process.env[kind === 'ffmpeg' ? 'FFMPEG_PATH' : 'FFPROBE_PATH'];
  if (configured) return configured;
  return kind;
}

/** Bounded child process, no shell, stdin closed, cancellation and hard timeout. */
export function mediaProcess(executable: string, args: string[], signal?: AbortSignal, timeoutMs = 300_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Media operation cancelled')); return; }
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '', stderr = '', failure: Error | undefined;
    const stop = (message: string) => { failure ??= new Error(message); child.kill('SIGKILL'); };
    const abort = () => stop('Media operation cancelled');
    const timer = setTimeout(() => stop('Media operation timed out'), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > 1_000_000) stop('Media process output exceeded limit');
    });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-64_000); });
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('close', code => {
      cleanup();
      if (failure || code !== 0) reject(failure || new Error(`Media process exited ${code}: ${stderr.slice(-4000)}`));
      else resolve({ stdout, stderr });
    });
  });
}
