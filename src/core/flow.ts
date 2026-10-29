/**
 * Ternfall Studio - Google Flow Bridge Logic (`flow.google.com`)
 * Pure logic for 24-frame batch calculation, 3-account load balancing,
 * prompt ingredient injection, asset validation, and local FFmpeg 24fps stitching.
 */

import {
  GoogleFlowPlan,
  GoogleFlowBatch,
  GoogleFlowBatchPrompt,
  GoogleFlowAccount,
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
  storyBeatTitle: string
): GoogleFlowBatchPrompt {
  const globalFrameNumber = (batchIndex - 1) * 24 + frameIndex;
  const frameSeconds = (globalFrameNumber - 1) * (1 / 24);
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
  mode: 'dense_24fps' | 'keyframe_storyboard' = 'dense_24fps'
): GoogleFlowPlan {
  const reqs = calculateFlowBatchRequirements(totalDurationSeconds, fps, mode);

  const accounts: Record<FlowAccountSlot, GoogleFlowAccount> = {
    account_1: {
      slot: 'account_1',
      label: 'Google Flow Pro - Alpha (User Primary)',
      emailOrIdentifier: 'pro_alpha@ternfall.studio',
      isPro: true,
      dailyBatchQuota: 250,
      batchesAssigned: reqs.batchesPerAccount.account_1,
      batchesCompleted: 0,
      status: 'active',
    },
    account_2: {
      slot: 'account_2',
      label: 'Google Flow Pro - Beta (Worker 2)',
      emailOrIdentifier: 'pro_beta@ternfall.studio',
      isPro: true,
      dailyBatchQuota: 250,
      batchesAssigned: reqs.batchesPerAccount.account_2,
      batchesCompleted: 0,
      status: 'active',
    },
    account_3: {
      slot: 'account_3',
      label: 'Google Flow Pro - Gamma (Worker 3)',
      emailOrIdentifier: 'pro_gamma@ternfall.studio',
      isPro: true,
      dailyBatchQuota: 250,
      batchesAssigned: reqs.batchesPerAccount.account_3,
      batchesCompleted: 0,
      status: 'active',
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

    const startSeconds = (b - 1) * 24 * (1 / fps);
    const endSeconds = b * 24 * (1 / fps);

    const prompts: GoogleFlowBatchPrompt[] = [];
    for (let f = 1; f <= 24; f++) {
      prompts.push(generateBatchFramePrompt(b, f, reqs.totalBatches, beatName));
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
      framesExpected: 24,
      ingestedFrameCount: 0,
      ingestedFiles: [],
      missingFrames: Array.from({ length: 24 }, (_, i) => i + 1),
    });
  }

  return {
    episodeId,
    episodeTitle,
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
    outputDirectory: `./data/production_root/projects/proj_ternfall_01/assets/flow_renders/${episodeId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validates ingested image file names for a batch and identifies any missing frames (1..24).
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
  const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  const validFiles = fileNames.filter((f) =>
    validExtensions.some((ext) => f.toLowerCase().endsWith(ext))
  );

  // Match frame numbers in filename if present (e.g. "frame_0001.png", "image (1).png", "shot_01.png")
  const presentIndices = new Set<number>();
  const normalizedFiles: string[] = [];

  validFiles.forEach((file, index) => {
    normalizedFiles.push(file);
    // If filename has a number between 1 and 24, record it; otherwise map sequentially by index
    const match = file.match(/(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 24) {
        presentIndices.add(num);
      } else {
        presentIndices.add((index % 24) + 1);
      }
    } else {
      presentIndices.add((index % 24) + 1);
    }
  });

  const missingFrames: number[] = [];
  for (let i = 1; i <= 24; i++) {
    if (!presentIndices.has(i)) {
      missingFrames.push(i);
    }
  }

  return {
    isValid: missingFrames.length === 0,
    ingestedCount: validFiles.length,
    missingFrames,
    normalizedFiles,
  };
}

/**
 * Generates an executable bash script that stitches sequential 24fps frames into
 * a master 1080p MP4 using local FFmpeg with AAC stereo audio.
 */
export function generateFfmpeg24fpsStitchScript(
  projectId: string,
  episodeId: string,
  fps = 24,
  audioPath = ''
): string {
  return `#!/usr/bin/env bash
# ==============================================================================
# Ternfall Studio - Google Flow 24fps FFmpeg Master Stitcher
# Episode: ${episodeId}
# Stitches 24-frame batches from flow.google.com into master 1080p 24fps MP4.
# ==============================================================================

set -euo pipefail

PROD_ROOT="./data/production_root/projects/${projectId}"
FRAMES_DIR="$PROD_ROOT/assets/flow_renders/${episodeId}"
OUT_DIR="$PROD_ROOT/renders/${episodeId}"
MASTER_MP4="$OUT_DIR/${episodeId}_flow_master_1080p_24fps.mp4"

mkdir -p "$OUT_DIR"

echo "=== Ternfall Studio: Assembling 24fps Master for ${episodeId} ==="
command -v ffmpeg >/dev/null 2>&1 || { echo >&2 "[ERROR] ffmpeg is not installed."; exit 1; }
command -v ffprobe >/dev/null 2>&1 || { echo >&2 "[ERROR] ffprobe is not installed."; exit 1; }

# Verify frames directory exists
if [ ! -d "$FRAMES_DIR" ]; then
  echo >&2 "[ERROR] Frames directory does not exist: $FRAMES_DIR"
  echo >&2 "Please ingest Google Flow batches first via CLI: studio flow ingest or Studio UI."
  exit 1
fi

FRAME_COUNT=$(find "$FRAMES_DIR" -type f \\( -name "*.png" -o -name "*.jpg" \\) | wc -l)
echo "Found $FRAME_COUNT frames in $FRAMES_DIR"

if [ "$FRAME_COUNT" -eq 0 ]; then
  echo >&2 "[ERROR] No frames found in $FRAMES_DIR to stitch."
  exit 1
fi

AUDIO_INPUT=""
if [ -n "${audioPath}" ] && [ -f "${audioPath}" ]; then
  AUDIO_INPUT="-i ${audioPath} -c:a aac -b:a 192k"
  echo "Using audio track: ${audioPath}"
else
  # Fallback to silent stereo audio generator for master alignment
  AUDIO_INPUT="-f lavfi -i anullsrc=r=44100:cl=stereo -c:a aac -b:a 192k"
  echo "Using generated ambient stereo track"
fi

echo "Stitching 24fps frames into 1080p H.264 Master..."
ffmpeg -y \\
  -framerate ${fps} \\
  -pattern_type glob -i "$FRAMES_DIR/*.png" \\
  $AUDIO_INPUT \\
  -c:v libx264 \\
  -preset medium \\
  -crf 17 \\
  -pix_fmt yuv420p \\
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \\
  -movflags +faststart \\
  -shortest \\
  "$MASTER_MP4"

echo "=== Stitch Complete: $MASTER_MP4 ==="
ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate,codec_name -of default=noprint_wrappers=1 "$MASTER_MP4"
`;
}
