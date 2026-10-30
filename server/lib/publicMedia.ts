import type { LocalRenderJob, PublicLocalRenderJob } from '../localMedia.ts';

/** Explicit HTTP projection: local process ownership, paths and raw stderr stay local. */
export function publicRenderJob(job: LocalRenderJob): PublicLocalRenderJob {
  return {
    id: job.id, projectId: job.projectId, episodeId: job.episodeId, frameCount: job.frameCount,
    fps: job.fps, audioFile: job.audioFile, idempotencyKey: job.idempotencyKey,
    state: job.state, stage: job.stage, createdAt: job.createdAt, updatedAt: job.updatedAt,
    attempt: job.attempt, cancelRequested: job.cancelRequested,
    error: job.error ? 'Render did not complete. Inspect local operator CLI status and server diagnostics before retrying.' : undefined,
    qc: job.qc && {
      passed: job.qc.passed, frameCount: job.qc.frameCount, durationSeconds: job.qc.durationSeconds,
      fps: job.qc.fps, width: job.qc.width, height: job.qc.height, videoCodec: job.qc.videoCodec,
      audioCodec: job.qc.audioCodec, sampleRate: job.qc.sampleRate, channels: job.qc.channels,
      loudnessLufs: job.qc.loudnessLufs, truePeakDb: job.qc.truePeakDb,
      avDurationDifferenceSeconds: job.qc.avDurationDifferenceSeconds, avStartDifferenceSeconds: job.qc.avStartDifferenceSeconds, sha256: job.qc.sha256,
    },
    progress: job.progress && {
      totalSegments: job.progress.totalSegments, completedSegments: job.progress.completedSegments,
      encodedSegments: job.progress.encodedSegments, reusedSegments: job.progress.reusedSegments,
    },
    manifest: job.manifest && {
      audioSha256: job.manifest.audioSha256,
      frames: job.manifest.frames.map(({ file, sha256, width, height, bytes }) => ({ file, sha256, width, height, bytes })),
    },
    checkpoints: job.checkpoints?.map(({ startFrame, frameCount, inputSha256, profileSha256, artifactSha256, bytes }) => ({ startFrame, frameCount, inputSha256, profileSha256, artifactSha256, bytes })),
    retiredCheckpointCount: job.retiredCheckpointTokens?.length ?? 0,
    checkpointsPurgedAt: job.checkpointsPurgedAt,
    claimAdjudications: job.claimAdjudications?.map(({ adjudicatedAt, note }) => ({ adjudicatedAt, note })),
  };
}
