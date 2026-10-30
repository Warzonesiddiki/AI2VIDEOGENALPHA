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

/**
 * Generates an individualized prompt for a frame within a 24-image batch.
 */
export function generateBatchFramePrompt(
  batchIndex: number,
  frameIndex: number,
  totalBatches: number,
  storyBeatTitle: string,
  fps = 24,
  mode: 'dense_24fps' | 'keyframe_storyboard' = 'dense_24fps'
): GoogleFlowBatchPrompt {
  const globalFrameNumber = (batchIndex - 1) * 24 + frameIndex;
  const frameSeconds = (globalFrameNumber - 1) / (mode === 'keyframe_storyboard' ? 1 : fps);
  const timecode = formatSecondsToTimecode(frameSeconds);

  // Progressive micro-action sequence across 24 frames
  const microActions = [
    'Rhea stands motionless at the heavy cast-iron intake valve wheel, checking the mechanical vibration needle.',
    'Rhea reaches both hands to the iron wheel rim, gloves wet from the condensation dripping from overhead conduits.',
    'Rhea braces her boots against the slippery steel tread floor, preparing to rotate the counterweighted valve.',
    'Close-up on the brass acoustic meter: the mechanical indicator arm hovers dangerously close to the red silence threshold.',
    'Rhea turns the valve one quarter turn; a low hiss of releasing air escapes through the bypass gasket.',
    'The water level in the glass sight tube rises two inches, dark brackish liquid bubbling beneath the pressure seal.',
    'Over-the-shoulder view of Rhea gazing through the wire-reinforced inspection window into the flooded South Gate culvert.',
    'Distant silhouette in the rain across the canal: a solitary figure stands frozen mid-stride in complete silence.',
    'Rhea slowly pulls her hands back from the wheel, her knuckles pale against the damp olive-drab fabric.',
    'Extreme close-up on the vibration needle: it shudders slightly as mechanical tremors resonate through the foundation.',
    'Rhea turns her head toward the ceiling air shaft, listening for the absent hum of the municipal grid.',
    'Wide angle: the cavernous concrete siphon chamber, illuminated only by a single amber maintenance lantern.',
    'Water drips from an overhead galvanized flange, hitting the steel grate floor in slow rhythmic pulses.',
    'Rhea adjusts the dial on her acoustic sensor, muting the internal buzzer to avoid airborne resonance.',
    'Medium shot: Rhea reaches for the emergency bypass lever beside the secondary intake manifold.',
    'The valve counterweight shifts with a muffled mechanical clunk; iron gears mesh in the grease casing.',
    'Rhea presses her hand against the cold cast iron, feeling the subterranean fluid velocity stabilize.',
    'The siphon chamber echoes with the sound of low-pressure water clearing the primary air pocket.',
    'Rhea exhales a visible breath into the chilly subterranean vault air, wiping mist from her inspection goggles.',
    'Focus shifts to the South Gate bulkhead door behind her: heavy steel locking bolts remain securely thrown.',
    'Rhea retrieves a grease pencil from her pocket and marks the pressure drop graduation directly onto the pipe.',
    'The amber warning indicator lamp flickers twice as auxiliary battery voltage dips slightly.',
    'Rhea takes one step toward the exit ladder, her eyes scanning the dark perimeter catwalk.',
    'Rhea pauses at the base of the rung ladder, looking back one final time at the stabilized siphon manifold.',
  ];

  const actionText = microActions[(frameIndex - 1) % microActions.length];
  const envIndex = (batchIndex + frameIndex) % TERNFALL_ENVIRONMENT_INGREDIENTS.length;
  const envDescription = TERNFALL_ENVIRONMENT_INGREDIENTS[envIndex];

  const promptText = `[The Quiet Hours: Ternfall - South Gate District - Scene Shot ${batchIndex}.${frameIndex}] ${actionText} ${envDescription}. ${TERNFALL_CHARACTER_INGREDIENT}. Style: ${TERNFALL_STYLE_INGREDIENTS.join(', ')}.`;

  return {
    frameIndex,
    globalFrameNumber,
    timecode,
    shotAnchor: `Beat ${storyBeatTitle} - Frame ${frameIndex}/24`,
    promptText,
    negativePrompt: TERNFALL_NEGATIVE_PROMPT,
    styleIngredients: [...TERNFALL_STYLE_INGREDIENTS],
  };
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
  projectId = 'proj_ternfall_01'
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

  const storyBeats = [
    'The Pressure Drop at Siphon 4',
    'The Acoustic Sensor Redline',
    'Inspection of South Gate Conduit',
    'The Frozen Silhouette in the Canal',
    'Counterweight Manual Bypass',
    'The Rhythmic Water Drips',
    'Locking the Bulkhead Gasket',
    'The Silent Evacuation Catwalk',
  ];

  for (let b = 1; b <= reqs.totalBatches; b++) {
    const slot = accountSlots[(b - 1) % accountSlots.length];
    const beatName = storyBeats[(b - 1) % storyBeats.length];

    const framesExpected = Math.min(24, reqs.totalFramesExpected - (b - 1) * 24);
    const frameRate = mode === 'keyframe_storyboard' ? 1 : reqs.fps;
    const startSeconds = (b - 1) * 24 / frameRate;
    const endSeconds = ((b - 1) * 24 + framesExpected) / frameRate;

    const prompts: GoogleFlowBatchPrompt[] = [];
    for (let f = 1; f <= framesExpected; f++) {
      prompts.push(generateBatchFramePrompt(b, f, reqs.totalBatches, beatName, reqs.fps, mode));
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
      dramaticPacing: 'Steady 24fps tension pacing',
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

/**
 * Generates ready-to-publish YouTube metadata with optimized CTR titles,
 * timecoded chapter markers, SEO tags, and required synthetic media disclosures.
 */
export function generateYouTubeMetadataPackage(
  episodeId: string,
  title: string,
  logline: string
): {
  titles: string[];
  selectedTitle: string;
  description: string;
  tags: string[];
  pinnedComment: string;
  syntheticMediaDisclosure: string;
} {
  const titles = [
    `${title} | The Quiet Hours: Ternfall (Ep. 1)`,
    `When the City Sirens Went Silent: ${title} (Survival Fiction)`,
    `The Eight-Beat Mystery in the Flood: ${title} | Ternfall`,
  ];

  const description = `${logline}

"The Quiet Hours: Ternfall" is an original episodic animated survival thriller.
Episode: ${episodeId} - "${title}"
Aspect Ratio: 16:9 1080p @ 24fps
Audio: Studio Mastered (-14.0 LUFS)

⏱️ CHAPTER TIMESTAMPS:
00:00 - The Eight-Twitch Pressure Needle
01:30 - Digital Sensor Network Failure
03:00 - Trapped Workers at South Gate Sluice
05:00 - First Evidence: The Eight-Beat Rhythm
07:00 - Sacrificing the Lower Archive
09:30 - Manual Bypass Shift & Survival
12:30 - Map by Sodium-Amber Light
14:20 - The Second Distant Pulse

📢 FICTIONAL WORK DISCLOSURE:
This animated series is an original work of survival fiction set in the fictional coastal city of Ternfall. All locations, characters, emergency signals, and infections are entirely fictional and do not represent real-world medical or survival instructions.

Produced with Ternfall Studio & Google Flow (flow.google.com).`;

  const tags = [
    'Ternfall',
    'The Quiet Hours',
    'survival fiction',
    'animated survival thriller',
    '24fps animation',
    'zombie apocalypse',
    'Rhea Mistry',
    'South Gate',
    'indie animation',
    'survival story',
  ];

  const pinnedComment = `🚨 What would you have done in Rhea's position: silenced the pump and lost the entire lower blueprint archive, or kept it running to save the mechanics? Let us know in the comments below! 👇`;

  const syntheticMediaDisclosure = 'This content contains AI-generated and procedurally assisted media (2D editorial illustrations and synthetic voice). Fictional creative storytelling only.';

  return {
    titles,
    selectedTitle: titles[0],
    description,
    tags,
    pinnedComment,
    syntheticMediaDisclosure,
  };
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

/**
 * Pure orchestration logic that determines the stages, scripts, deliverables,
 * and QC status for a complete 100% automated YouTube production run.
 */
export function createFlowAutoproduceOrchestrator(
  projectId: string,
  episodeId: string,
  title: string,
  logline: string,
  options: {
    durationSeconds?: number;
    fps?: number;
    mode?: 'dense_24fps' | 'keyframe_storyboard';
  } = {}
): FlowAutoproduceResult {
  assertIdentifier(episodeId);
  assertIdentifier(projectId);
  const duration = options.durationSeconds ?? 600;
  const fps = options.fps ?? 24;
  const mode = options.mode || 'dense_24fps';

  const plan = createGoogleFlowPlan(episodeId, title, duration, fps, mode, projectId);
  const checkpoint = computeFlowCheckpoint(plan);
  const youtubePackage = generateYouTubeMetadataPackage(episodeId, title, logline);

  return {
    success: true,
    episodeId,
    stageReached: 'planned',
    plan,
    checkpoint,
    audioMixPath: `./data/production_root/projects/${projectId}/audio/${episodeId}/${episodeId}_master_audio_mix_14lufs.wav`,
    master16x9Path: `./data/production_root/projects/${projectId}/exports/${episodeId}_The_Quiet_Hours_Ternfall_1080p_24fps_Master.mp4`,
    short9x16Path: `./data/production_root/projects/${projectId}/exports/${episodeId}_YouTube_Short_Vertical_1080x1920.mp4`,
    youtubePackage,
    qcStatus: {
      resolution: '1920x1080 (16:9) & 1080x1920 (9:16)',
      fps,
      loudnessLufs: null,
      passed: false,
    },
    totalFramesVerified: 0,
    totalBatchesProcessed: 0,
    billableCostUsd: 0,
    message: `Production plan prepared for ${episodeId}. No media has been generated, rendered, or QC verified.`,
  };
}



