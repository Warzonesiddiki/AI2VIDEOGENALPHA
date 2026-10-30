import { assertIdentifier } from './validation.ts';
/**
 * Ternfall Studio - Google Flow Bridge Logic (`flow.google.com`)
 * Pure logic for 24-frame batch calculation, 3-account load balancing,
 * prompt ingredient injection and asset validation. Legacy script exports are retired.
 */

import {
  GoogleFlowPlan,
  GoogleFlowBatch,
  GoogleFlowBatchPrompt,
  GoogleFlowAccount,
  GoogleFlowCheckpoint,
  FlowAutoproduceResult,
  FlowAccountSlot,
} from '../types/index.ts';

export interface BatchRequirements {
  totalDurationSeconds: number;
  fps: number;
  mode: 'dense_24fps' | 'keyframe_storyboard';
  totalFramesExpected: number;
  totalBatches: number;
  batchSize: number;
  batchesPerAccount: Record<FlowAccountSlot, number>;
}

export const TERNFALL_STYLE_INGREDIENTS = [
  'cinematic graphic novel style',
  'survival thriller atmosphere',
  '35mm film grain',
  'muted slate cyan and concrete grey color grading',
  'high-contrast sodium-vapor amber emergency lighting',
  'cold rain reflections on industrial wet iron',
  'grounded realism, 24fps shutter cadence',
];

export const TERNFALL_CHARACTER_INGREDIENT =
  'Rhea Mistry, 34-year-old municipal water engineer, wearing worn waterproof olive-teal rain jacket with hood down, dark hair pulled into a tight braided knot, brass handheld acoustic vibration sensor device strapped to utility belt, focused watchful expression, exhaustion lines around eyes';

export const TERNFALL_ENVIRONMENT_INGREDIENTS = [
  'South Gate low-pressure drainage canal, abandoned rusted sluice gates, dark murky water in concrete culverts',
  'Subterranean municipal siphon vault 4, heavy iron turn-valves, condensation on galvanized water pipes',
  'Overcast grey sky above rain-slicked industrial rooftops, emergency civil defense sirens silent on rusted towers',
  'Emergency service catwalk overlooking flooded roadway, yellow warning hazard stripes peeled away by grime',
];

export const TERNFALL_NEGATIVE_PROMPT =
  'anime, manhwa, bright neon lighting, magical powers, glowing eyes, 3D CGI plastic cartoon, low resolution, watermark, text logo, distorted hands, generic zombie tropes';

/**
 * Calculates exact frame and 24-image batch counts for an episode duration.
 * 10 minutes at 24fps = 600s * 24 = 14,400 frames = 600 batches of 24.
 */
export function calculateFlowBatchRequirements(
  totalDurationSeconds: number,
  fps = 24,
  mode: 'dense_24fps' | 'keyframe_storyboard' = 'dense_24fps'
): BatchRequirements {
  if (!Number.isFinite(totalDurationSeconds) || totalDurationSeconds < 1 || totalDurationSeconds > 900) throw new Error('Duration must be between 1 and 900 seconds');
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('FPS must be an integer between 1 and 60');
  if (!['dense_24fps', 'keyframe_storyboard'].includes(mode)) throw new Error('Invalid Flow mode');
  const safeDuration = Math.max(1, Math.round(totalDurationSeconds));
  const safeFps = Math.max(1, Math.round(fps));

  let totalFrames = 0;
  if (mode === 'dense_24fps') {
    totalFrames = safeDuration * safeFps;
  } else {
    // Keyframe storyboard mode: 1 keyframe per second
    totalFrames = safeDuration;
  }

  const batchSize = 24;
  const totalBatches = Math.ceil(totalFrames / batchSize);

  const accounts: FlowAccountSlot[] = ['account_1', 'account_2', 'account_3'];
  const batchesPerAccount: Record<FlowAccountSlot, number> = {
    account_1: 0,
    account_2: 0,
    account_3: 0,
  };

  for (let i = 0; i < totalBatches; i++) {
    const slot = accounts[i % accounts.length];
    batchesPerAccount[slot]++;
  }

  return {
    totalDurationSeconds: safeDuration,
    fps: safeFps,
    mode,
    totalFramesExpected: totalFrames,
    totalBatches,
    batchSize,
    batchesPerAccount,
  };
}

/**
 * Formats fractional seconds into a standard MM:SS.mmm timecode string.
 */
export function formatSecondsToTimecode(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000);

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(milliseconds).padStart(3, '0');

  return `${mm}:${ss}.${mmm}`;
}

/** Small, bounded excerpts of the selected episode; all prompts remain drafts. */
export interface FlowPlanningContext {
  logline?: string;
  physicalObjective?: string;
  beats?: Array<{ name: string; visualDescription?: string }>;
}
function promptExcerpt(value: unknown, maximum = 180): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maximum) : '';
}

/** Produces a reviewable planning placeholder, never a claim of a generated asset. */
export function generateBatchFramePrompt(
  batchIndex: number,
  frameIndex: number,
  _totalBatches: number,
  storyBeatTitle: string,
  fps = 24,
  mode: 'dense_24fps' | 'keyframe_storyboard' = 'dense_24fps',
  context: FlowPlanningContext & { episodeId?: string; episodeTitle?: string; visualDescription?: string } = {}
): GoogleFlowBatchPrompt {
  const globalFrameNumber = (batchIndex - 1) * 24 + frameIndex;
  const timecode = formatSecondsToTimecode((globalFrameNumber - 1) / (mode === 'keyframe_storyboard' ? 1 : fps));
  const title = promptExcerpt(context.episodeTitle) || 'Untitled episode';
  const beat = promptExcerpt(storyBeatTitle) || 'Unspecified beat';
  const description = promptExcerpt(context.visualDescription);
  const logline = promptExcerpt(context.logline);
  const objective = promptExcerpt(context.physicalObjective);
  const promptText = [
    `DRAFT: ${title}${context.episodeId ? ` (${context.episodeId})` : ''}, frame ${globalFrameNumber} at ${timecode}.`,
    `Beat: ${beat}.`,
    description ? `Visual note: ${description}.` : 'No visual note supplied; an editor must specify the shot.',
    logline && `Logline: ${logline}.`,
    objective && `Objective: ${objective}.`,
  ].filter(Boolean).join(' ');
  return { frameIndex, globalFrameNumber, timecode, shotAnchor: `${beat} — frame ${globalFrameNumber}`, promptText, negativePrompt: '', styleIngredients: [] };
}

/**
 * Generates a complete Google Flow production plan for an episode.
 */
export function createGoogleFlowPlan(
  episodeId: string,
  episodeTitle: string,
  totalDurationSeconds = 600, // 10 minutes default
  fps = 24,
  mode: 'dense_24fps' | 'keyframe_storyboard' = 'dense_24fps',
  projectId = 'proj_ternfall_01',
  context: FlowPlanningContext = {}
): GoogleFlowPlan {
  assertIdentifier(episodeId);
  assertIdentifier(projectId);
  const reqs = calculateFlowBatchRequirements(totalDurationSeconds, fps, mode);

  const accounts: Record<FlowAccountSlot, GoogleFlowAccount> = {
    account_1: {
      slot: 'account_1',
      label: 'Google Flow Pro - Alpha (Primary)',
      emailOrIdentifier: '',
      isPro: false,
      telemetryVerified: false,
      dailyBatchQuota: 0,
      batchesAssigned: reqs.batchesPerAccount.account_1,
      batchesCompleted: 0,
      status: 'idle',
      creditsBalance: 0,
      dailyCreditsRefill: 0,
      creditsUsedToday: 0,
    },
    account_2: {
      slot: 'account_2',
      label: 'Google Flow Pro - Beta (Worker 2)',
      emailOrIdentifier: '',
      isPro: false,
      telemetryVerified: false,
      dailyBatchQuota: 0,
      batchesAssigned: reqs.batchesPerAccount.account_2,
      batchesCompleted: 0,
      status: 'idle',
      creditsBalance: 0,
      dailyCreditsRefill: 0,
      creditsUsedToday: 0,
    },
    account_3: {
      slot: 'account_3',
      label: 'Google Flow Pro - Gamma (Worker 3)',
      emailOrIdentifier: '',
      isPro: false,
      telemetryVerified: false,
      dailyBatchQuota: 0,
      batchesAssigned: reqs.batchesPerAccount.account_3,
      batchesCompleted: 0,
      status: 'idle',
      creditsBalance: 0,
      dailyCreditsRefill: 0,
      creditsUsedToday: 0,
    },
  };

  const accountSlots: FlowAccountSlot[] = ['account_1', 'account_2', 'account_3'];
  const batches: GoogleFlowBatch[] = [];

  const suppliedBeats = Array.isArray(context.beats)
    ? context.beats.filter(beat => beat && promptExcerpt(beat.name)).slice(0, 100)
    : [];
  const storyBeats = suppliedBeats.length ? suppliedBeats : [{ name: 'Unspecified draft beat', visualDescription: '' }];

  for (let b = 1; b <= reqs.totalBatches; b++) {
    const slot = accountSlots[(b - 1) % accountSlots.length];
    const beat = storyBeats[Math.min(storyBeats.length - 1, Math.floor((b - 1) * storyBeats.length / reqs.totalBatches))];
    const beatName = promptExcerpt(beat.name);

    const framesExpected = Math.min(24, reqs.totalFramesExpected - (b - 1) * 24);
    const frameRate = mode === 'keyframe_storyboard' ? 1 : reqs.fps;
    const startSeconds = (b - 1) * 24 / frameRate;
    const endSeconds = ((b - 1) * 24 + framesExpected) / frameRate;

    const prompts: GoogleFlowBatchPrompt[] = [];
    for (let f = 1; f <= framesExpected; f++) {
      prompts.push(generateBatchFramePrompt(b, f, reqs.totalBatches, beatName, reqs.fps, mode, { episodeId, episodeTitle, logline: context.logline, physicalObjective: context.physicalObjective, visualDescription: beat.visualDescription }));
    }

    batches.push({
      batchId: `GF_${episodeId}_B${String(b).padStart(4, '0')}`,
      batchIndex: b,
      episodeId,
      assignedAccount: slot,
      timecodeRange: {
        start: formatSecondsToTimecode(startSeconds),
        end: formatSecondsToTimecode(endSeconds),
      },
      storyBeatName: beatName,
      dramaticPacing: 'Unreviewed planning placeholder',
      prompts,
      status: 'pending',
      framesExpected,
      ingestedFrameCount: 0,
      ingestedFiles: [],
      missingFrames: Array.from({ length: framesExpected }, (_, i) => (b - 1) * 24 + i + 1),
    });
  }

  return {
    episodeId,
    episodeTitle,
    projectId,
    mode,
    totalDurationSeconds: reqs.totalDurationSeconds,
    fps: reqs.fps,
    totalFramesExpected: reqs.totalFramesExpected,
    totalBatches: reqs.totalBatches,
    batchSize: 24,
    accounts,
    batches,
    summary: {
      totalFramesIngested: 0,
      completionPercentage: 0,
      pendingBatches: reqs.totalBatches,
      dispatchedBatches: 0,
      ingestedBatches: 0,
      verifiedBatches: 0,
      billableApiSpendUsd: 0, // Explicitly $0.00
    },
    outputDirectory: `./data/production_root/projects/${projectId}/assets/flow_renders/${episodeId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates global frame filenames only. Actual image decoding is a server responsibility.
 */
export function validateBatchIngestion(
  batch: GoogleFlowBatch,
  fileNames: string[]
): {
  isValid: boolean;
  ingestedCount: number;
  missingFrames: number[];
  normalizedFiles: string[];
} {
  if (!Number.isInteger(batch.batchIndex) || batch.batchIndex < 1 || !Number.isInteger(batch.framesExpected) || batch.framesExpected < 1 || batch.framesExpected > 24 || !Array.isArray(fileNames)) throw new Error('Invalid batch manifest');
  const first = (batch.batchIndex - 1) * 24 + 1;
  const expected = Array.from({ length: batch.framesExpected }, (_, i) => first + i);
  const present = new Map<number, string>();
  let invalid = false;
  for (const file of fileNames) {
    const match = typeof file === 'string' ? /^frame_(\d{1,8})\.png$/.exec(file) : null;
    const number = match ? Number(match[1]) : NaN;
    if (!match || !expected.includes(number) || present.has(number)) { invalid = true; continue; }
    present.set(number, file);
  }
  return {
    isValid: !invalid && present.size === expected.length,
    ingestedCount: present.size,
    missingFrames: expected.filter(number => !present.has(number)),
    normalizedFiles: [...present.entries()].sort(([a], [b]) => a - b).map(([, file]) => file),
  };
}

/** @deprecated Legacy script execution is unsupported. Use the verified local renderer with supplied assets. */
export function generateFfmpeg24fpsStitchScript(projectId: string, episodeId: string, fps = 24, audioPath = ''): string {
  assertIdentifier(projectId);
  assertIdentifier(episodeId);
  throw new Error('Legacy media scripts are retired. Use the verified local renderer with supplied frames and original audio; no script or media was generated.');
}

/**
 * Generates an automated headless Node.js worker script for mass-producing
 * 24-frame batches from flow.google.com across 3 Pro accounts without human intervention.
 */
export function generateFlowAutoWorkerScript(
  projectId: string,
  episodeId: string,
  totalBatches = 600
): string {
  assertIdentifier(episodeId);
  assertIdentifier(projectId);
  return `// Ternfall Studio: no supported visual provider worker is configured.
// Planning is available, but this script must not fabricate production assets.
console.error('Visual generation is not implemented. Import original rendered assets before production verification.');
process.exitCode = 1;
`;

}

/** @deprecated Legacy script execution is unsupported. Use the verified local renderer with supplied assets. */
export function generateLocalAudioMixScript(projectId: string, episodeId: string, durationSeconds = 600): string {
  assertIdentifier(projectId);
  assertIdentifier(episodeId);
  throw new Error('Legacy media scripts are retired. Use the verified local renderer with supplied frames and original audio; no script or media was generated.');
}

/** @deprecated Legacy script execution is unsupported. Use the verified local renderer with supplied assets. */
export function generateCompleteYouTubeRenderScript(projectId: string, episodeId: string, fps = 24): string {
  assertIdentifier(projectId);
  assertIdentifier(episodeId);
  throw new Error('Legacy media scripts are retired. Use the verified local renderer with supplied frames and original audio; no script or media was generated.');
}

/** @deprecated Automated publishing metadata was based on invented pilot facts and is retired. */
export function generateYouTubeMetadataPackage(episodeId: string, _title: string, _logline: string): {
  titles: string[]; selectedTitle: string; description: string; tags: string[]; pinnedComment: string; syntheticMediaDisclosure: string;
} {
  assertIdentifier(episodeId);
  throw new Error('Publishing metadata generation is retired: review actual assets, chapters, rights and disclosures manually. No package was created.');
}

/**
 * Computes a serializable checkpoint state from an active Google Flow production plan.
 */
export function isFlowBatchVerified(batch: GoogleFlowBatch): boolean {
  const evidence = batch.verification;
  if (batch.status !== 'verified' || evidence?.version !== 1 || !Array.isArray(evidence.frames) || evidence.frames.length !== batch.framesExpected) return false;
  const first = (batch.batchIndex - 1) * 24 + 1;
  return evidence.frames.every((frame, index) => frame.globalFrameNumber === first + index &&
    frame.file === `frame_${String(first + index).padStart(5, '0')}.png` &&
    /^[a-f0-9]{64}$/.test(frame.sha256) && frame.width === 1920 && frame.height === 1080 && frame.bytes > 0);
}

export function recomputeFlowSummary(plan: GoogleFlowPlan): void {
  const verified = plan.batches.filter(isFlowBatchVerified);
  plan.summary.totalFramesIngested = verified.reduce((sum, batch) => sum + batch.framesExpected, 0);
  plan.summary.verifiedBatches = verified.length;
  plan.summary.pendingBatches = plan.batches.filter(batch => batch.status === 'pending' || (batch.status === 'verified' && !isFlowBatchVerified(batch))).length;
  plan.summary.dispatchedBatches = plan.batches.filter(batch => batch.status === 'dispatched').length;
  plan.summary.ingestedBatches = plan.batches.filter(batch => batch.status === 'ingested').length;
  plan.summary.completionPercentage = Math.round(plan.summary.totalFramesIngested / plan.totalFramesExpected * 100);
  for (const account of Object.values(plan.accounts)) account.batchesCompleted = verified.filter(batch => batch.assignedAccount === account.slot).length;
}

export function computeFlowCheckpoint(plan: GoogleFlowPlan): GoogleFlowCheckpoint {
  const completedBatches = plan.batches.filter(
    (b) => isFlowBatchVerified(b)
  );
  const completedIndices = completedBatches.map((b) => b.batchIndex).sort((a, b) => a - b);
  const lastCompleted = completedIndices.length > 0 ? completedIndices[completedIndices.length - 1] : 0;
  const nextBatch = plan.batches.find(batch => !isFlowBatchVerified(batch))?.batchIndex ?? plan.totalBatches;

  const accountStats: Record<FlowAccountSlot, { assigned: number; completed: number }> = {
    account_1: {
      assigned: plan.accounts.account_1.batchesAssigned,
      completed: plan.batches.filter((b) => b.assignedAccount === 'account_1' && isFlowBatchVerified(b)).length,
    },
    account_2: {
      assigned: plan.accounts.account_2.batchesAssigned,
      completed: plan.batches.filter((b) => b.assignedAccount === 'account_2' && isFlowBatchVerified(b)).length,
    },
    account_3: {
      assigned: plan.accounts.account_3.batchesAssigned,
      completed: plan.batches.filter((b) => b.assignedAccount === 'account_3' && isFlowBatchVerified(b)).length,
    },
  };

  return {
    episodeId: plan.episodeId,
    totalBatches: plan.totalBatches,
    totalFramesExpected: plan.totalFramesExpected,
    completedBatchIndices: completedIndices,
    lastCompletedBatchIndex: lastCompleted,
    nextBatchIndex: nextBatch,
    accountStats,
    isComplete: completedIndices.length === plan.totalBatches,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Determines whether and from which batch index to resume an interrupted production plan.
 */
export function computeFlowResumePoint(checkpoint: GoogleFlowCheckpoint): {
  shouldResume: boolean;
  nextBatchIndex: number;
  remainingBatches: number;
} {
  const completed = new Set(checkpoint.completedBatchIndices.filter(index => Number.isInteger(index) && index >= 1 && index <= checkpoint.totalBatches));
  const isComplete = completed.size === checkpoint.totalBatches;
  if (isComplete) {
    return {
      shouldResume: false,
      nextBatchIndex: checkpoint.totalBatches,
      remainingBatches: 0,
    };
  }

  const remaining = Math.max(0, checkpoint.totalBatches - completed.size);
  return {
    shouldResume: true,
    nextBatchIndex: Array.from({ length: checkpoint.totalBatches }, (_, i) => i + 1).find(index => !completed.has(index)) ?? checkpoint.totalBatches,
    remainingBatches: remaining,
  };
}

/** @deprecated Automatic production is not implemented safely. */
export function createFlowAutoproduceOrchestrator(
  projectId: string,
  episodeId: string,
  _title: string,
  _logline: string,
  _options: { durationSeconds?: number; fps?: number; mode?: 'dense_24fps' | 'keyframe_storyboard' } = {}
): FlowAutoproduceResult {
  assertIdentifier(projectId); assertIdentifier(episodeId);
  throw new Error('Automatic production is unavailable. Use explicit draft planning and supplied-asset local rendering; no run or package was created.');
}
