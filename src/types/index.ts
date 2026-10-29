/**
 * Ternfall Studio - Domain Types & Schemas
 * Standardized across local-first engine, server API, and React frontend.
 */

// ---------------------------------------------------------------------------
// Job & External Operation States (Master Project Rules & Matrix 15)
// ---------------------------------------------------------------------------

export type JobState =
  | 'queued'
  | 'running'
  | 'paused'
  | 'blocked'
  | 'needs_user'
  | 'retrying'
  | 'succeeded'
  | 'failed_recoverable'
  | 'failed_terminal'
  | 'cancelled';

export type ExternalOperationState =
  | 'not_started'
  | 'pending'
  | 'confirmed_succeeded'
  | 'confirmed_failed'
  | 'unknown_external_effect'
  | 'reconciling';

export interface ExternalOperationRecord {
  id: string;
  operationIntent: string; // e.g. "gemini_generate_image", "youtube_upload_private"
  idempotencyKey: string;
  provider: string;
  modelOrRoute?: string;
  state: ExternalOperationState;
  mayHaveCharged: boolean;
  duplicatePossible: boolean;
  reconciliationRequired: boolean;
  reconciliationEvidence?: string;
  providerRequestId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  details?: Record<string, unknown>;
}

export interface GenerationJob {
  id: string;
  projectId: string;
  episodeId?: string;
  type:
    | 'premise_generation'
    | 'outline_expansion'
    | 'script_draft'
    | 'scene_planning'
    | 'still_image_batch'
    | 'video_clip_batch'
    | 'voice_synthesis'
    | 'caption_alignment'
    | 'video_render'
    | 'technical_qc'
    | 'youtube_package'
    | 'autoproduce_pipeline';
  state: JobState;
  externalOperation?: ExternalOperationRecord;
  progressPercent: number;
  currentStage: string;
  blockerReason?: string;
  recoveryRemediation?: string;
  retryCount: number;
  maxRetries: number;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  logs: JobLogEntry[];
  inputHash?: string;
  outputArtifacts: Array<{
    name: string;
    relativePath: string;
    hash?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// Project & Series Bible
// ---------------------------------------------------------------------------

export interface ProjectMetadata {
  id: string;
  name: string;
  slug: string;
  description: string;
  productionRoot: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  isArchived: boolean;
  activeSeriesId: string;
}

export interface WorldRule {
  id: string;
  category: 'infection' | 'infrastructure' | 'signal_pulse' | 'society' | 'geography';
  title: string;
  fictionalRule: string;
  isFictional: true;
  narrativeImplications: string;
  prohibitedMisconceptions: string; // e.g. "Do not portray water as infectious"
}

export interface CharacterSheet {
  id: string;
  name: string;
  age: number;
  role: string;
  visualAnchor: string; // e.g. "cropped slate-teal rain jacket, brass pressure gauge"
  psychologicalWound: string;
  knowledgeScope: string;
  voiceStyle: string;
  appearancePromptGuidance: string;
  currentStatus: 'active' | 'missing' | 'injured' | 'deceased';
  lastKnownLocation: string;
}

export interface LocationSheet {
  id: string;
  name: string;
  district: string;
  environmentalDescription: string;
  waterStatus: 'flooded' | 'low_pressure' | 'dry' | 'submerged';
  infrastructureNotes: string;
  visualPalette: string;
}

export interface FactionSheet {
  id: string;
  name: string;
  leaderOrKeyRep: string;
  ideology: string;
  materialInterests: string;
  relationshipToSouthGate: string;
}

export interface SeriesBible {
  id: string;
  projectId: string;
  seriesTitle: string;
  logline: string;
  targetRuntimeMinutes: number; // default ~15 mins
  targetWpm: number; // default 145 wpm (2,175 words)
  intendedAudience: string;
  primaryLanguage: string;
  locale: string;
  visualBible: {
    medium: string;
    palette: string[];
    silhouetteRules: string;
    lightingRules: string;
    bannedStyles: string[];
  };
  rules: WorldRule[];
  characters: CharacterSheet[];
  locations: LocationSheet[];
  factions: FactionSheet[];
  originalityDeclarations: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Canon & Continuity Ledger
// ---------------------------------------------------------------------------

export interface CanonEvent {
  id: string;
  episodeId: string;
  storyDate: string;
  physicalLocation: string;
  charactersPresent: string[];
  whatCharactersLearned: Record<string, string>; // characterId -> knowledge gained
  resourceDeltas: string[]; // e.g. "Lost clean service corridor panel"
  injuriesOrStatusChanges: string[];
  unresolvedClues: string[];
  promisesMade: string[];
  consequencesSummary: string;
  isRetcon: boolean;
  retconRationale?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// 1000-Episode Roadmap & Arcs
// ---------------------------------------------------------------------------

export interface ArcRoadmapItem {
  seasonNumber: number;
  seasonTitle: string;
  arcNumber: number; // 1 to 100
  episodeRange: string; // e.g. "E001–E010"
  arcTitle: string;
  centralConflict: string;
  coreSetting: string;
  majorConsequence: string;
  expandedCardCount: number;
}

export type EpisodeStatus =
  | 'planned'
  | 'outline_ready'
  | 'script_draft'
  | 'script_approved'
  | 'scene_plan_ready'
  | 'assets_generating'
  | 'rendered'
  | 'qc_passed'
  | 'packaged'
  | 'upload_ready'
  | 'archived';

export interface BeatAnchor {
  timestampStart: string; // e.g. "00:00"
  timestampEnd: string; // e.g. "01:30"
  beatName: string;
  dramaticFunction: string;
  dialogueOrNarrationSnippet: string;
}

export interface ScriptVersion {
  versionNumber: number;
  author?: string;
  fullNarrationText: string;
  wordCount: number;
  spokenWordCount?: number;
  estimatedDurationSeconds: number;
  targetWpm: number;
  actualVoiceDurationSeconds?: number;
  beats: BeatAnchor[];
  pronunciationNotes: Array<{ term: string; guide: string }>;
  isApproved: boolean;
  approvalNotes?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface EpisodeOutlineBeat {
  beatNumber: number;
  name: string;
  targetSeconds?: number;
  visualDescription?: string;
  spokenDialogueSnippet?: string;
  soundDesignCues?: string[];
  continuityClues?: string[];
}

export interface EpisodeCard {
  id: string; // e.g. "S01E001"
  dbId: string;
  projectId: string;
  seriesId: string;
  season?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeNumberInArc?: number;
  episodeNumberInSeries?: number;
  arcNumber: number;
  workingTitle: string;
  logline: string;
  premiseHook?: string;
  targetAudiencePersona?: string;
  centralDramaticQuestion?: string;
  timeline?: {
    storyDate: string;
    elapsedTime: string;
    confidence: 'confirmed' | 'approximate' | 'unknown';
  };
  timelineAnchor?: string;
  charactersPresent?: string[];
  physicalLocations?: string[];
  settingIds?: string[];
  povCharacterIds?: string[];
  aPlot?: string;
  bPlot?: string;
  physicalObjective?: string;
  humanConflict?: string;
  characterTurn?: string;
  majorDecision?: string;
  consequence?: string;
  clueOrPayoff?: string;
  endingBeat?: string;
  beats?: EpisodeOutlineBeat[];
  status: EpisodeStatus;
  scriptVersions: ScriptVersion[];
  activeScriptVersionIndex: number;
  storyboardPromptVersions?: any[];
  activeStoryboardVersionIndex?: number;
  visualMotifs?: string[];
  factualClaimIds?: string[];
  fictionalRuleIds?: string[];
  staleDownstreamAssets?: boolean; // Flagged when script changes after storyboard
  provenanceSourceEpisodeId?: string; // If duplicated
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Research Room & Fact Ledger
// ---------------------------------------------------------------------------

export type FactVerificationState =
  | 'verified'
  | 'unverified'
  | 'disputed'
  | 'fictional_rule';

export interface ResearchClaim {
  id: string;
  projectId: string;
  claimText: string;
  isFictionalLore: boolean;
  sourceUrl?: string;
  sourceTitle?: string;
  publisher?: string;
  accessDate?: string;
  evidenceExcerpt?: string;
  verificationStatus: FactVerificationState;
  confidenceScore: number; // 0.0 - 1.0
  factCheckerNotes: string;
  humanApproved: boolean;
  relatedEpisodeIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Storyboard & Visual/Audio Scene Planning
// ---------------------------------------------------------------------------

export type AnimationMethod =
  | 'still_with_camera_move'
  | 'limited_2d_parallax'
  | 'environmental_loop'
  | 'ai_video_clip_omni';

export interface ShotItem {
  id: string;
  sceneNumber: number;
  shotNumber: number;
  durationSeconds: number;
  aspectRatio: '16:9' | '9:16';
  purpose: string;
  framing: 'wide' | 'medium' | 'close_up' | 'extreme_close_up' | 'insert_map';
  pov: string;
  characterReferenceIds: string[];
  locationReferenceId: string;
  timeAndLighting: string;
  actionDescription: string;
  visualPrompt: string;
  negativePrompt: string;
  animationMethod: AnimationMethod;
  transitionToNext: 'cut' | 'dissolve' | 'fade_black' | 'wipe';
  narrationAnchorText: string;
  captionText: string;
  captionSafeChecked: boolean;
  assetRelativePath?: string;
  assetSource: 'project_illustration' | 'generated_still' | 'omni_clip' | 'manual_import';
  generationCostUsd?: number;
  isApproved: boolean;
}

export interface AudioStemConfig {
  narrationVolume: number; // 0 - 1
  musicVolume: number;
  sfxVolume: number;
  duckMusicUnderSpeech: boolean;
  loudnessTargetLufs: number; // standard -14 LUFS
}

// ---------------------------------------------------------------------------
// End-to-End Autoproducer & Spend Approval
// ---------------------------------------------------------------------------

export type AutoproduceProfile =
  | 'stepwise'
  | 'supervised'
  | 'approved_batch';

export interface SpendApprovalGrant {
  approvalId: string;
  issuedBy: string; // e.g. "operator"
  projectId: string;
  episodeId: string;
  maxBudgetUsd: number;
  currency: string;
  allowedProviders: string[];
  expiresAt: string;
  isRevoked: boolean;
  actualSpentUsd: number;
  createdAt: string;
}

export interface AutoproduceStage {
  stageName:
    | 'premise_selection'
    | 'fact_and_research_check'
    | 'outline_and_script'
    | 'preproduction_checks'
    | 'scene_planning'
    | 'asset_generation'
    | 'voice_and_captions'
    | 'assembly_and_render'
    | 'technical_qc'
    | 'editorial_review'
    | 'package_finalization'
    | 'youtube_handoff';
  label: string;
  status: JobState;
  startTime?: string;
  endTime?: string;
  costUsd?: number;
  details?: string;
  requiresHumanAction?: boolean;
}

export interface AutoproduceRun {
  runId: string;
  projectId: string;
  episodeId: string;
  profile: AutoproduceProfile;
  spendApprovalId?: string;
  budgetCapUsd: number;
  spentSoFarUsd: number;
  stages: AutoproduceStage[];
  currentStageIndex: number;
  isCompleted: boolean;
  isPaused: boolean;
  isCancelled: boolean;
  blockerMessage?: string;
  outputPackagePath?: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// YouTube Operations & Packaging
// ---------------------------------------------------------------------------

export interface YouTubePackage {
  id: string;
  episodeId: string;
  workingTitle: string;
  titleOptions: string[];
  selectedTitle: string;
  description: string;
  chapterTimestamps: Array<{ timecode: string; label: string }>;
  tags: string[];
  thumbnailPath?: string;
  master16x9Path?: string;
  master16x9DurationSeconds?: number;
  master16x9Resolution?: string;
  shortsVariants: Array<{
    shortId: string;
    path: string;
    durationSeconds: number;
    hookDescription: string;
  }>;
  captionsSrtPath?: string;
  captionsVttPath?: string;
  captionLanguage: string;
  audienceSetting: 'made_for_kids' | 'not_made_for_kids' | 'unreviewed';
  ageRestriction: boolean;
  alteredSyntheticDisclosureChoice: 'disclose' | 'no_disclosure_needed' | 'manual_studio_review';
  rightsClearanceVerified: boolean;
  targetPrivacyStatus: 'private' | 'unlisted' | 'public';
  scheduledTimeIso?: string;
  productionTimezone: string; // e.g. "Asia/Kolkata", "UTC", "America/New_York"
  humanApprovedForUpload: boolean;
  humanApprovedForPublish: boolean;
  qcReport: {
    passed: boolean;
    ffprobeStatus: string;
    audioClippingDetected: boolean;
    aspectRatioConfirmed: boolean;
    missingFrames: boolean;
    loudnessLufs: number;
    issues: string[];
  };
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Doctor Diagnostics & Capabilities
// ---------------------------------------------------------------------------

export interface SystemDiagnostics {
  runtimeEnvironment: 'cloud_preview' | 'local_windows' | 'local_wsl2' | 'local_linux';
  nodeVersion: string;
  osPlatform: string;
  storage: {
    productionRoot: string;
    isWritable: boolean;
    isLocalDiskMounted: boolean;
    freeSpaceMb?: number;
  };
  ffmpeg: {
    installed: boolean;
    version?: string;
    path?: string;
    ffprobeAvailable: boolean;
  };
  opencode: {
    installed: boolean;
    cliVersion?: string;
    wslRecommended: boolean;
  };
  providers: Array<{
    name: string;
    modality: 'text' | 'image' | 'video' | 'tts' | 'search';
    modelId: string;
    isConfigured: boolean;
    status: 'ready' | 'unconfigured' | 'retired' | 'missing_key';
    estimatedCostBasis: string;
  }>;
  youtubeOAuth: {
    isConfigured: boolean;
    scopesGranted: string[];
    tokenProtected: boolean;
    uploadQuotaRemaining?: number;
  };
  timezone: {
    configuredIana: string;
    isValidIana: boolean;
  };
  remediationSteps: string[];
}

// ---------------------------------------------------------------------------
// Google Flow Bridge & 24-Frame Asset Automation (flow.google.com)
// ---------------------------------------------------------------------------

export type FlowAccountSlot = 'account_1' | 'account_2' | 'account_3';

export interface GoogleFlowAccount {
  slot: FlowAccountSlot;
  label: string;
  emailOrIdentifier: string;
  isPro: true;
  dailyBatchQuota: number; // e.g. 200 batches
  batchesAssigned: number;
  batchesCompleted: number;
  status: 'active' | 'quota_exhausted' | 'idle';
  lastActivityAt?: string;
}

export type GoogleFlowBatchStatus =
  | 'pending'
  | 'dispatched'
  | 'downloaded'
  | 'ingested'
  | 'verified';

export interface GoogleFlowBatchPrompt {
  frameIndex: number; // 1 to 24 within batch
  globalFrameNumber: number; // 1 to 14,400 across episode
  timecode: string; // e.g. "00:04.125"
  shotAnchor: string;
  promptText: string;
  negativePrompt: string;
  styleIngredients: string[];
}

export interface GoogleFlowBatch {
  batchId: string; // e.g. "GF_S01E001_B001"
  batchIndex: number; // 1 to 600
  episodeId: string;
  assignedAccount: FlowAccountSlot;
  timecodeRange: {
    start: string;
    end: string;
  };
  storyBeatName: string;
  dramaticPacing: string;
  prompts: GoogleFlowBatchPrompt[];
  status: GoogleFlowBatchStatus;
  framesExpected: 24;
  ingestedFrameCount: number;
  ingestedFiles: string[];
  missingFrames: number[];
  dispatchedAt?: string;
  ingestedAt?: string;
}

export interface GoogleFlowPlan {
  episodeId: string;
  episodeTitle: string;
  mode: 'dense_24fps' | 'keyframe_storyboard';
  totalDurationSeconds: number; // 600 seconds (10 minutes)
  fps: number; // 24 fps
  totalFramesExpected: number; // 14,400 or 600
  totalBatches: number; // 600 or 25
  batchSize: 24;
  accounts: Record<FlowAccountSlot, GoogleFlowAccount>;
  batches: GoogleFlowBatch[];
  summary: {
    totalFramesIngested: number;
    completionPercentage: number;
    pendingBatches: number;
    dispatchedBatches: number;
    ingestedBatches: number;
    verifiedBatches: number;
    billableApiSpendUsd: 0; // Explicitly $0.00 via Google Flow Pro
  };
  outputDirectory: string;
  stitchScriptPath?: string;
  createdAt: string;
  updatedAt: string;
}
