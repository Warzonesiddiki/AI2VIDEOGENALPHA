import { VerifiedMediaReader } from './lib/verifiedMedia.ts';
import { hashMediaFile, snapshotMediaFile } from './lib/fileEvidence.ts';
import fs from 'node:fs/promises';
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import { validateFrameFile } from './lib/frameValidation.ts';
import { DocumentStore } from './lib/documents.ts';
import { assertIdentifier, safePath, productionRoot } from './lib/paths.ts';
import { mediaBinary, mediaProcess } from './lib/mediaProcess.ts';

export interface LocalRenderRequest {
  projectId: string; episodeId: string; frameCount: number; fps: 24;
  audioFile: string; idempotencyKey: string;
}
export interface FrameEvidence { file: string; sha256: string; width: number; height: number; bytes: number }
export interface MediaQC {
  passed: boolean; frameCount: number; durationSeconds: number; fps: number;
  width: number; height: number; videoCodec: string; audioCodec: string;
  sampleRate: number; channels: number; loudnessLufs: number; truePeakDb: number;
  avDurationDifferenceSeconds: number; avStartDifferenceSeconds: number; sha256: string;
}
export interface SegmentCheckpoint {
  startFrame: number; frameCount: number; inputSha256: string; profileSha256: string;
  artifactSha256: string; path: string; bytes: number;
}
export interface RenderProgress { totalSegments: number; completedSegments: number; encodedSegments: number; reusedSegments: number }
export const LOCAL_RENDER_MAX_FRAMES = 21_600;
export const LOCAL_RENDER_SEGMENT_FRAMES = 120; // Five seconds; only one segment is staged at a time.
export interface LocalRenderJob extends LocalRenderRequest {
  id: string; state: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted';
  stage: string; createdAt: string; updatedAt: string; attempt: number; cancelRequested: boolean;
  ownerPid?: number; ownerHost?: string; ownerToken?: string;
  error?: string; outputPath?: string; qc?: MediaQC;
  checkpoints?: SegmentCheckpoint[]; progress?: RenderProgress;
  retiredCheckpointTokens?: string[]; checkpointsPurgedAt?: string;
  manifest?: { frames: FrameEvidence[]; audioSha256: string };
}
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
function checkRequest(value: LocalRenderRequest) {
  for (const field of ['projectId', 'episodeId', 'idempotencyKey'] as const) assertIdentifier(value[field]);
  if (value.fps !== 24 || !Number.isInteger(value.frameCount) || value.frameCount < 24 || value.frameCount > LOCAL_RENDER_MAX_FRAMES) throw new Error('Local renders require 24–21600 frames at 24fps (1–900 seconds)');
  if (typeof value.audioFile !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}\.(wav|flac)$/.test(value.audioFile)) throw new Error('Audio must be a WAV/FLAC basename inside the episode audio directory');
}
function loudness(stderr: string) {
  const block = stderr.match(/\{\s*"input_i"[\s\S]*?\}/g)?.at(-1);
  if (!block) throw new Error('No measured loudness report');
  const data = JSON.parse(block);
  for (const field of ['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset']) {
    if (!Number.isFinite(Number(data[field]))) throw new Error(`Audio has no finite measurable loudness: ${block}`);
  }
  return data;
}

/** No provider calls, no synthetic fallback assets, no public publication. */
export class LocalMediaService {
  private documents?: DocumentStore;
  private get db() { return this.documents ??= new DocumentStore(this.root); }
  private controllers = new Map<string, AbortController>();
  private mediaReader?: VerifiedMediaReader;
  private file: string;
  constructor(private root = productionRoot, private binaries = { ffmpeg: mediaBinary('ffmpeg'), ffprobe: mediaBinary('ffprobe') }) {
    this.root = path.resolve(root); this.file = safePath(this.root, 'local_render_jobs.json');
  }
  close() { if (this.controllers.size) throw new Error('Cannot close an active media worker'); this.documents?.close(); this.documents = undefined; }
  private jobs() { return this.db.read<LocalRenderJob[]>(this.file, []); }
  list(projectId: string) { assertIdentifier(projectId); return this.jobs().filter(job => job.projectId === projectId); }
  get(projectId: string, jobId: string) { assertIdentifier(jobId); return this.list(projectId).find(job => job.id === jobId) ?? null; }
  enqueue(request: LocalRenderRequest): LocalRenderJob {
    checkRequest(request);
    return this.db.transaction(() => {
      const jobs = this.jobs();
      const previous = jobs.find(job => job.projectId === request.projectId && job.idempotencyKey === request.idempotencyKey);
      if (previous) {
        for (const field of ['episodeId', 'frameCount', 'fps', 'audioFile'] as const) if (previous[field] !== request[field]) throw new Error('Idempotency key conflicts with another render');
        return previous;
      }
      if (jobs.filter(job => ['queued', 'running'].includes(job.state)).length >= 8) throw new Error('Local render queue is full');
      const now = new Date().toISOString();
      const job: LocalRenderJob = { ...request, id: `render_${randomUUID()}`, state: 'queued', stage: 'queued', createdAt: now, updatedAt: now, attempt: 0, cancelRequested: false };
      jobs.push(job); this.db.write(this.file, jobs); return job;
    });
  }
  private change(id: string, update: (job: LocalRenderJob) => void): LocalRenderJob {
    let changed!: LocalRenderJob;
    this.db.update<LocalRenderJob[]>(this.file, [], jobs => {
      const job = jobs.find(item => item.id === id); if (!job) throw new Error('Local render not found');
      update(job); job.updatedAt = new Date().toISOString(); changed = job; return jobs;
    });
    return changed;
  }
  cancel(projectId: string, id: string) {
    if (!this.get(projectId, id)) throw new Error('Local render not found');
    const job = this.change(id, job => {
      if (!['queued', 'running'].includes(job.state)) throw new Error('Render is already terminal');
      job.cancelRequested = true;
      if (job.state === 'queued') { job.state = 'cancelled'; job.stage = 'cancelled'; }
    });
    this.controllers.get(id)?.abort(); return job;
  }
  /** A dead owner can never certify success. Recovery requires an explicit new attempt. */
  recoverInterrupted(): number {
    let count = 0;
    this.db.update<LocalRenderJob[]>(this.file, [], jobs => {
      for (const job of jobs) {
        if (job.state !== 'running' || job.ownerHost !== os.hostname() || !job.ownerPid) continue;
        try { process.kill(job.ownerPid, 0); continue; } catch (error: any) { if (error.code !== 'ESRCH') continue; }
        job.state = 'interrupted'; job.stage = 'interrupted'; job.error = 'Worker exited before artifact verification'; job.updatedAt = new Date().toISOString(); count++;
      }
      return jobs;
    }); return count;
  }
  retry(projectId: string, id: string) {
    if (!this.get(projectId, id)) throw new Error('Local render not found');
    return this.change(id, job => {
      if (this.jobs().filter(item => ['queued', 'running'].includes(item.state)).length >= 8) throw new Error('Local render queue is full');
      if (!['failed', 'interrupted', 'cancelled'].includes(job.state)) throw new Error('Only unsuccessful terminal jobs can be retried');
      job.state = 'queued'; job.stage = 'queued'; job.cancelRequested = false;
      delete job.error; delete job.qc; delete job.outputPath; delete job.manifest;
    });
  }
  /** Detach synchronously under the same SQLite lock used by retry/claim.
   * Async deletion only touches unique retired paths, never a retry's live cache.
   * A crash between rename and metadata commit merely invalidates old cache;
   * no missing cache can certify a successful render.
   */
  async purgeCheckpoints(projectId: string, id: string): Promise<LocalRenderJob> {
    if (!this.get(projectId, id)) throw new Error('Local render not found');
    const detached = this.change(id, job => {
      if (['queued', 'running'].includes(job.state)) throw new Error('Checkpoint cleanup requires a terminal render');
      const live = safePath(this.root, `projects/${projectId}/local_checkpoints/${id}`);
      if (existsSync(live)) {
        const token = randomUUID();
        const retired = safePath(this.root, `projects/${projectId}/local_checkpoint_trash/${id}/${token}`);
        mkdirSync(safePath(this.root, path.dirname(retired)), { recursive: true });
        renameSync(safePath(this.root, live), safePath(this.root, retired));
        job.retiredCheckpointTokens = [...(job.retiredCheckpointTokens ?? []), token];
      }
      delete job.checkpoints;
      job.checkpointsPurgedAt = new Date().toISOString();
    });
    for (const token of detached.retiredCheckpointTokens ?? []) {
      // Only server-generated UUID leaves can ever be deleted. Never accept paths
      // from requests, checkpoint metadata or stale output manifests.
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(token)) throw new Error('Invalid checkpoint retirement token');
      await fs.rm(safePath(this.root, `projects/${projectId}/local_checkpoint_trash/${id}/${token}`), { recursive: true, force: true });
      this.change(id, current => { current.retiredCheckpointTokens = (current.retiredCheckpointTokens ?? []).filter(item => item !== token); });
    }
    return this.get(projectId, id)!;
  }
  private claim(): LocalRenderJob | null {
    return this.db.transaction(() => {
      const jobs = this.jobs(); if (jobs.some(job => job.state === 'running')) return null;
      const job = jobs.find(job => job.state === 'queued'); if (!job) return null;
      job.state = 'running'; job.stage = 'validating_inputs'; job.attempt++;
      job.progress = { totalSegments: Math.ceil(job.frameCount / LOCAL_RENDER_SEGMENT_FRAMES), completedSegments: 0, encodedSegments: 0, reusedSegments: 0 };
      job.ownerPid = process.pid; job.ownerHost = os.hostname(); job.ownerToken = randomUUID(); job.updatedAt = new Date().toISOString();
      this.db.write(this.file, jobs); return job;
    });
  }
  async runNext(): Promise<LocalRenderJob | null> {
    const job = this.claim(); if (!job) return null;
    const controller = new AbortController(); this.controllers.set(job.id, controller);
    const work = safePath(this.root, `projects/${job.projectId}/local_work/${job.id}/attempt_${job.attempt}`);
    const poll = setInterval(() => { try { if (this.get(job.projectId, job.id)?.cancelRequested) controller.abort(); } catch { controller.abort(); } }, 500);
    try {
      await fs.mkdir(work, { recursive: true });
      const result = await this.render(job, work, controller.signal);
      this.change(job.id, current => {
        if (current.ownerToken !== job.ownerToken || current.state !== 'running' || current.cancelRequested) throw new Error('Render ownership changed or cancellation requested');
        current.manifest = result.manifest; current.qc = result.qc; current.outputPath = result.outputPath;
        current.state = 'succeeded'; current.stage = 'technical_qc_passed';
      });
    } catch (error: any) {
      this.change(job.id, current => {
        if (current.ownerToken !== job.ownerToken || current.state !== 'running') return;
        current.state = current.cancelRequested || controller.signal.aborted ? 'cancelled' : 'failed';
        current.stage = current.state; current.error = String(error.message).slice(-4000);
        delete current.outputPath; delete current.qc;
      });
    } finally {
      try {
        if (this.get(job.projectId, job.id)?.state !== 'succeeded') {
          await fs.rm(safePath(this.root, `projects/${job.projectId}/exports/local/${job.id}/attempt_${job.attempt}`), { recursive: true, force: true });
        }
      } finally {
        // Disk/metadata cleanup errors must never strand cancellation resources.
        clearInterval(poll); this.controllers.delete(job.id);
        // Attempt scratch cleanup even if export cleanup failed. Errors remain visible
        // to the operator; terminal render/QC state is not rewritten as cleanup proof.
        await fs.rm(safePath(this.root, work), { recursive: true, force: true });
      }
    }
    return this.get(job.projectId, job.id);
  }
  private async probe(file: string, signal: AbortSignal, format: string, timeoutMs = 30_000) {
    return JSON.parse((await mediaProcess(this.binaries.ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-f', format, '-count_frames', '-show_streams', '-show_format', '-of', 'json', file], signal, timeoutMs)).stdout);
  }
  private owned(job: LocalRenderJob, update: (current: LocalRenderJob) => void) {
    return this.change(job.id, current => {
      if (current.state !== 'running' || current.ownerToken !== job.ownerToken || current.cancelRequested) throw new Error('Render ownership changed or cancellation requested');
      update(current);
    });
  }
  private async validateSegment(file: string, count: number, signal: AbortSignal) {
    const result = await this.probe(file, signal, 'mov');
    const streams = result.streams ?? [];
    const video = streams.find((stream: any) => stream.codec_type === 'video');
    const [numerator, denominator] = String(video?.avg_frame_rate).split('/').map(Number);
    if (!video || !Number.isFinite(Number(video.duration)) || streams.length !== 1 || video.codec_name !== 'h264' || video.width !== 1920 || video.height !== 1080 || video.pix_fmt !== 'yuv420p' || Number(video.nb_read_frames) !== count || numerator / denominator !== 24 || Math.abs(Number(video.duration) - count / 24) > 0.05) throw new Error('Cached segment failed measured video validation');
    await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-i', file, '-f', 'null', '-'], signal);
  }
  private async renderSegments(job: LocalRenderJob, work: string, evidence: FrameEvidence[], signal: AbortSignal): Promise<SegmentCheckpoint[]> {
    const inputDir = safePath(this.root, `projects/${job.projectId}/assets/flow_renders/${job.episodeId}`);
    const cache = safePath(this.root, `projects/${job.projectId}/local_checkpoints/${job.id}`);
    await fs.mkdir(cache, { recursive: true });
    const version = (await mediaProcess(this.binaries.ffmpeg, ['-version'], signal, 10_000)).stdout;
    const profileSha256 = hash(Buffer.from(`segment-v1:h264:1920x1080:24:yuv420p:veryfast:crf18:max12M:buf24M:threads2:${version}`));
    const completed: SegmentCheckpoint[] = [];
    for (let first = 1; first <= job.frameCount; first += LOCAL_RENDER_SEGMENT_FRAMES) {
      if (signal.aborted) throw new Error('Media operation cancelled');
      const count = Math.min(LOCAL_RENDER_SEGMENT_FRAMES, job.frameCount - first + 1);
      const segmentDir = safePath(this.root, path.join(work, `frames_${first}`));
      await fs.mkdir(segmentDir, { recursive: true });
      const frames: FrameEvidence[] = [];
      for (let offset = 0; offset < count; offset++) {
        if (signal.aborted) throw new Error('Media operation cancelled');
        const name = `frame_${String(first + offset).padStart(5, '0')}.png`;
        const { buffer, ...checked } = await validateFrameFile(this.root, path.join(inputDir, name));
        await fs.writeFile(safePath(this.root, path.join(segmentDir, name)), buffer, { flag: 'wx' });
        frames.push({ file: name, ...checked });
      }
      evidence.push(...frames);
      const inputSha256 = hash(Buffer.from(JSON.stringify(frames)));
      const artifact = safePath(this.root, path.join(cache, `segment_${first}_${inputSha256}_${profileSha256}.mp4`));
      const stored = this.get(job.projectId, job.id)?.checkpoints?.find(segment => segment.startFrame === first && segment.frameCount === count && segment.inputSha256 === inputSha256 && segment.profileSha256 === profileSha256);
      let checkpoint: SegmentCheckpoint | undefined;
      if (stored) {
        try {
          if (stored.path !== artifact || (await fs.stat(safePath(this.root, artifact))).size !== stored.bytes || await hashMediaFile(this.root, artifact, signal) !== stored.artifactSha256) throw new Error('Segment hash mismatch');
          await this.validateSegment(artifact, count, signal); checkpoint = stored;
        } catch (error) { if (signal.aborted) throw error; } // corrupt/missing cache is re-encoded, never trusted
      }
      const reused = !!checkpoint;
      if (!checkpoint) {
        this.owned(job, current => { current.stage = `encoding_segment_${completed.length + 1}`; });
        const candidate = safePath(this.root, path.join(work, `segment_${first}.mp4`));
        await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', '-xerror', '-threads', '2', '-framerate', '24', '-start_number', String(first), '-i', path.join(segmentDir, 'frame_%05d.png'),
          '-an', '-t', String(count / 24), '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '18', '-maxrate', '12M', '-bufsize', '24M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', candidate], signal);
        await this.validateSegment(candidate, count, signal);
        const artifactSha256 = await hashMediaFile(this.root, candidate, signal);
        const bytes = (await fs.stat(candidate)).size;
        if (signal.aborted) throw new Error('Media operation cancelled');
        await fs.rename(candidate, artifact);
        checkpoint = { startFrame: first, frameCount: count, inputSha256, profileSha256, artifactSha256, path: artifact, bytes };
      }
      completed.push(checkpoint);
      this.owned(job, current => {
        current.checkpoints = [...(current.checkpoints ?? []).filter(segment => segment.startFrame !== first), checkpoint!].sort((a, b) => a.startFrame - b.startFrame);
        current.progress!.completedSegments = completed.length;
        if (reused) current.progress!.reusedSegments++; else current.progress!.encodedSegments++;
        current.stage = `segment_${completed.length}_verified`;
      });
      await fs.rm(safePath(this.root, segmentDir), { recursive: true, force: true });
    }
    return completed;
  }
  private async render(job: LocalRenderJob, work: string, signal: AbortSignal) {
    checkRequest(job);
    const duration = job.frameCount / job.fps;
    const evidence: FrameEvidence[] = [];
    const disk = await fs.statfs(this.root);
    // Scratch space is bounded by one segment plus audio, cached segments and final output.
    const requiredBytes = Math.min(job.frameCount, LOCAL_RENDER_SEGMENT_FRAMES) * 12_000_000 + job.frameCount * 100_000 + 1_200_000_000;
    if (disk.bavail * disk.bsize < requiredBytes) throw new Error('Insufficient scratch disk space');
    const sourceAudio = safePath(this.root, `projects/${job.projectId}/audio/${job.episodeId}/${job.audioFile}`);
    const audioPath = safePath(this.root, path.join(work, `source_${job.audioFile}`));
    const audio = await snapshotMediaFile(this.root, sourceAudio, audioPath, 512 * 1024 * 1024, signal);
    const operationTimeout = Math.max(300_000, Math.ceil(duration * 2000));
    const audioInfo = await this.probe(audioPath, signal, job.audioFile.endsWith('.flac') ? 'flac' : 'wav', operationTimeout);
    const audioStream = audioInfo.streams?.find((stream: any) => stream.codec_type === 'audio');
    if (!audioStream || Number(audioInfo.format?.duration) < duration || !Number.isFinite(Number(audioInfo.format?.duration))) throw new Error('Audio must decode and cover the entire planned duration');
    const measured = loudness((await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-hide_banner', '-v', 'info', '-xerror', '-protocol_whitelist', 'file,pipe', '-f', job.audioFile.endsWith('.flac') ? 'flac' : 'wav', '-i', audioPath, '-t', String(duration), '-af', `atrim=duration=${duration},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-'], signal, operationTimeout)).stderr);
    this.change(job.id, current => { current.stage = 'rendering'; });
    const candidate = safePath(this.root, path.join(work, 'candidate.mp4'));
    // Some FFmpeg builds treat measured_LRA=0 as an unset measurement. A tiny
    // positive floor selects linear mode; ignore that first-pass offset in this case.
    const measuredLra = Math.max(0.1, Number(measured.input_lra));
    const offset = Number(measured.input_lra) === 0 ? 0 : Number(measured.target_offset);
    const normalize = `atrim=duration=${duration},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measuredLra}:measured_thresh=${measured.input_thresh}:offset=${offset}:linear=true`;
    const normalizedAudio = safePath(this.root, path.join(work, 'normalized.wav'));
    await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-f', job.audioFile.endsWith('.flac') ? 'flac' : 'wav', '-i', audioPath,
      '-af', normalize, '-t', String(duration), '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', normalizedAudio], signal, operationTimeout);
    const segments = await this.renderSegments(job, work, evidence, signal);
    const concatFile = safePath(this.root, path.join(work, 'segments.txt'));
    // Paths here are generated internally from identifiers and SHA-256, never user text.
    await fs.writeFile(concatFile, segments.map(segment => `file '${segment.path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n') + '\n', { flag: 'wx' });
    const joined = safePath(this.root, path.join(work, 'joined.mp4'));
    await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', '-xerror', '-f', 'concat', '-safe', '0', '-protocol_whitelist', 'file,pipe', '-i', concatFile,
      '-an', '-c:v', 'copy', '-movflags', '+faststart', joined], signal, operationTimeout);
    // All video segments are already encoded; mux only, with one continuous audio track.
    await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-i', joined, '-f', 'wav', '-i', normalizedAudio,
      '-map', '0:v:0', '-map', '1:a:0', '-t', String(duration), '-c:v', 'copy', '-ar', '48000', '-ac', '2', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', candidate], signal, operationTimeout);
    this.change(job.id, current => { current.stage = 'measuring_qc'; });
    const output = await this.probe(candidate, signal, 'mov', operationTimeout);
    await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-i', candidate, '-f', 'null', '-'], signal, operationTimeout);
    const measuredOutput = loudness((await mediaProcess(this.binaries.ffmpeg, ['-nostdin', '-hide_banner', '-protocol_whitelist', 'file,pipe', '-f', 'mov', '-i', candidate, '-vn', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], signal, operationTimeout)).stderr);
    const video = output.streams?.find((stream: any) => stream.codec_type === 'video');
    const sound = output.streams?.find((stream: any) => stream.codec_type === 'audio');
    if (!video || !sound) throw new Error('Output must contain video and audio');
    const [numerator, denominator] = String(video.avg_frame_rate).split('/').map(Number);
    const qc: MediaQC = {
      passed: false, frameCount: Number(video.nb_read_frames), durationSeconds: Number(output.format.duration), fps: numerator / denominator,
      width: video.width, height: video.height, videoCodec: video.codec_name, audioCodec: sound.codec_name,
      sampleRate: Number(sound.sample_rate), channels: sound.channels, loudnessLufs: Number(measuredOutput.input_i), truePeakDb: Number(measuredOutput.input_tp),
      avDurationDifferenceSeconds: Math.abs(Number(video.duration) - Number(sound.duration)), avStartDifferenceSeconds: Math.abs(Number(video.start_time) - Number(sound.start_time)), sha256: await hashMediaFile(this.root, candidate, signal),
    };
    const finite = [qc.frameCount, qc.durationSeconds, qc.fps, qc.loudnessLufs, qc.truePeakDb, qc.avDurationDifferenceSeconds, qc.avStartDifferenceSeconds].every(Number.isFinite);
    qc.passed = finite && qc.frameCount === job.frameCount && qc.fps === 24 && qc.width === 1920 && qc.height === 1080 && qc.videoCodec === 'h264' && qc.audioCodec === 'aac' && qc.sampleRate === 48000 && qc.channels === 2 && Math.abs(qc.durationSeconds - duration) < 0.1 && qc.avDurationDifferenceSeconds < 0.1 && qc.avStartDifferenceSeconds < 0.05 && Math.abs(qc.loudnessLufs + 14) <= 0.5 && qc.truePeakDb <= -1;
    if (!qc.passed) throw new Error(`Measured technical QC failed: ${JSON.stringify(qc)}`);
    if (signal.aborted || this.get(job.projectId, job.id)?.cancelRequested) throw new Error('Media operation cancelled');
    const relative = `projects/${job.projectId}/exports/local/${job.id}/attempt_${job.attempt}/master.mp4`;
    const destination = safePath(this.root, relative); await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rename(candidate, safePath(this.root, destination));
    return { outputPath: relative, qc, manifest: { frames: evidence, audioSha256: audio.sha256 } };
  }
  async openVerifiedMedia(projectId: string, jobId: string) {
    const file = this.mediaPath(projectId, jobId);
    const job = this.get(projectId, jobId)!;
    const opened = await (this.mediaReader ??= new VerifiedMediaReader(this.root)).open(file, job.qc!.sha256);
    try {
      const current = this.get(projectId, jobId);
      if (current?.state !== 'succeeded' || !current.qc?.passed || current.outputPath !== job.outputPath || current.qc.sha256 !== job.qc!.sha256) throw new Error('Render evidence changed during playback verification');
      return opened;
    } catch (error) { await opened.handle.close(); throw error; }
  }
  /** Authorized path lookup for internal tooling. HTTP playback additionally verifies bytes. */
  mediaPath(projectId: string, jobId: string): string {
    const job = this.get(projectId, jobId);
    if (!job || job.state !== 'succeeded' || !job.qc?.passed || !job.outputPath) throw new Error('No QC-verified output is available');
    return safePath(this.root, job.outputPath);
  }
}

export const localMedia = new LocalMediaService();
