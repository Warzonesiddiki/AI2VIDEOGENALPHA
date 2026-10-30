import type {
  GenerationJob, YouTubePackage, AutoproduceRun, SpendApprovalGrant,
  PublicGenerationJob, PublicYouTubePackage, PublicAutoproduceRun, PublicSpendGrant,
  PublicExternalOperation, PublicJobLogEntry, PublicAutoproduceStage,
  JobState, ExternalOperationState,
} from '../../src/types/index.ts';
import { assertIdentifier } from './paths.ts';

/**
 * Explicit HTTP projections for production-record reads.
 *
 * Policy (fail closed):
 * - Structural identifiers, revisions, money values and required dates must be
 *   well formed; a malformed record fails the whole read closed with a generic
 *   error instead of fabricating or leaking stored contents.
 * - Filesystem paths, raw diagnostics, provider telemetry and unknown legacy
 *   fields are never serialized. Free-text log/diagnostic fields are replaced
 *   with fixed operator-safe statements.
 * - Enumerated display labels map unknown values to the most cautious option.
 */

const LOG_TEXT_WITHHELD = 'Stored log text is withheld from this HTTP projection; inspect local project data for the full entry.';
const BLOCKER_RECORDED = 'A stored blocker is recorded. Inspect local project data for its full text.';

const JOB_STATES = new Set<string>([
  'queued', 'running', 'paused', 'blocked', 'needs_user', 'retrying',
  'succeeded', 'failed_recoverable', 'failed_terminal', 'cancelled',
]);
const JOB_TYPES = new Set<string>([
  'premise_generation', 'outline_expansion', 'script_draft', 'scene_planning', 'still_image_batch',
  'video_clip_batch', 'voice_synthesis', 'caption_alignment', 'video_render', 'technical_qc',
  'youtube_package', 'autoproduce_pipeline',
]);
const EXT_STATES = new Set<string>([
  'not_started', 'pending', 'confirmed_succeeded', 'confirmed_failed', 'unknown_external_effect', 'reconciling',
]);
const STAGE_NAMES = new Set<string>([
  'premise_selection', 'fact_and_research_check', 'outline_and_script', 'preproduction_checks',
  'scene_planning', 'asset_generation', 'voice_and_captions', 'assembly_and_render', 'technical_qc',
  'editorial_review', 'package_finalization', 'youtube_handoff',
]);
const PROFILES = new Set<string>(['stepwise', 'supervised', 'approved_batch']);
const AUDIENCES = new Set<string>(['made_for_kids', 'not_made_for_kids', 'unreviewed']);
const PRIVACY_STATES = new Set<string>(['private', 'unlisted', 'public']);
const DISCLOSURES = new Set<string>(['disclose', 'no_disclosure_needed', 'manual_studio_review']);
const LOG_LEVELS = new Set<string>(['info', 'warn', 'error', 'debug']);
const HEX64 = /^[0-9a-f]{64}$/i;

function asObject(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid stored ${field}`);
  return value as Record<string, unknown>;
}

function label(value: unknown, field: string, max = 200): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) throw new Error(`Invalid stored ${field}`);
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Invalid stored ${field}`);
  return value;
}

function content(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid stored ${field}`);
  return value;
}

function money(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`Invalid stored ${field}`);
  return value;
}

function optionalMoney(value: unknown, field: string): number | undefined {
  return value === undefined ? undefined : money(value, field);
}

function isoDate(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid stored ${field}`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid stored ${field}`);
  return new Date(parsed).toISOString();
}

function optionalDate(value: unknown, field: string): string | undefined {
  return value === undefined ? undefined : isoDate(value, field);
}

function revision(value: unknown): number {
  const rev = value === undefined ? 0 : value;
  if (typeof rev !== 'number' || !Number.isSafeInteger(rev) || rev < 0) throw new Error('Invalid stored revision');
  return rev;
}

function whenTrue(value: unknown): boolean {
  return value === true;
}

function counted(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function asArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`Invalid stored ${field}`);
  return value;
}

function nonNegative(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function hexDigest(value: unknown): string | undefined {
  return typeof value === 'string' && HEX64.test(value) ? value.toLowerCase() : undefined;
}

function presence(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function safeRelativePath(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 260) return undefined;
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/.test(value)) return undefined;
  if (value.split(/[\\/]/).some(part => part === '..')) return undefined;
  return value;
}

function pickState(value: unknown, states: Set<string>, fallback: string): string {
  return typeof value === 'string' && states.has(value) ? value : fallback;
}

function publicExternalOperation(input: unknown): PublicExternalOperation {
  const ext = asObject(input, 'external operation');
  assertIdentifier(ext.id as string);
  return {
    id: ext.id as string,
    operationIntent: label(ext.operationIntent, 'operation intent', 120),
    provider: label(ext.provider, 'operation provider', 120),
    state: pickState(ext.state, EXT_STATES, 'unknown_external_effect') as ExternalOperationState,
    mayHaveCharged: whenTrue(ext.mayHaveCharged),
    duplicatePossible: whenTrue(ext.duplicatePossible),
    reconciliationRequired: whenTrue(ext.reconciliationRequired),
  };
}

export function publicJob(input: GenerationJob): PublicGenerationJob {
  const job = asObject(input, 'job');
  assertIdentifier(job.id as string); assertIdentifier(job.projectId as string);
  if (job.episodeId !== undefined) assertIdentifier(job.episodeId as string);
  const logs: PublicJobLogEntry[] = asArray(job.logs, 'job logs').map(entryValue => {
    const entry = asObject(entryValue, 'job log entry');
    return {
      timestamp: isoDate(entry.timestamp, 'job log timestamp'),
      level: pickState(entry.level, LOG_LEVELS, 'warn') as PublicJobLogEntry['level'],
      message: LOG_TEXT_WITHHELD,
    };
  });
  const outputArtifacts = asArray(job.outputArtifacts, 'job output artifacts').map(entryValue => {
    const artifact = asObject(entryValue, 'job output artifact');
    const name = label(artifact.name, 'job artifact name', 200);
    const relativePath = safeRelativePath(artifact.relativePath);
    const hash = hexDigest(artifact.hash);
    return {
      name,
      ...(relativePath !== undefined ? { relativePath } : {}),
      ...(hash !== undefined ? { hash } : {}),
    };
  });
  return {
    revision: revision(job.revision),
    id: job.id as string,
    projectId: job.projectId as string,
    ...(job.episodeId !== undefined ? { episodeId: job.episodeId as string } : {}),
    type: pickState(job.type, JOB_TYPES, 'unknown_type'),
    state: pickState(job.state, JOB_STATES, 'needs_user') as JobState,
    ...(job.externalOperation !== undefined ? { externalOperation: publicExternalOperation(job.externalOperation) } : {}),
    progressPercent: Math.min(100, Math.max(0, nonNegative(job.progressPercent))),
    retryCount: counted(job.retryCount),
    maxRetries: counted(job.maxRetries),
    ...(job.estimatedCostUsd !== undefined ? { estimatedCostUsd: money(job.estimatedCostUsd, 'job estimated cost') } : {}),
    ...(job.actualCostUsd !== undefined ? { actualCostUsd: money(job.actualCostUsd, 'job actual cost') } : {}),
    logs,
    ...(hexDigest(job.inputHash) !== undefined ? { inputHash: hexDigest(job.inputHash) } : {}),
    outputArtifacts,
    createdAt: isoDate(job.createdAt, 'job creation time'),
    updatedAt: isoDate(job.updatedAt, 'job update time'),
    ...(job.completedAt !== undefined ? { completedAt: isoDate(job.completedAt, 'job completion time') } : {}),
  };
}

function publicShortVariant(value: unknown) {
  const variant = asObject(value, 'package short variant');
  assertIdentifier(variant.shortId as string);
  return {
    shortId: variant.shortId as string,
    durationSeconds: nonNegative(variant.durationSeconds),
    hookDescription: content(variant.hookDescription, 'short hook description', 500),
    fileRecorded: presence(variant.path),
  };
}

export function publicYouTubePackage(input: YouTubePackage): PublicYouTubePackage {
  const pkg = asObject(input, 'package');
  assertIdentifier(pkg.id as string);
  if (pkg.projectId === undefined) throw new Error('Invalid stored package project');
  assertIdentifier(pkg.projectId as string); assertIdentifier(pkg.episodeId as string);
  const qc = asObject(pkg.qcReport, 'package QC report');
  const issues = asArray(qc.issues, 'package QC issues');
  let ffprobeRun = false;
  if (typeof qc.ffprobeStatus === 'string') ffprobeRun = qc.ffprobeStatus.length > 0;
  else if (qc.ffprobeStatus !== undefined) throw new Error('Invalid stored package QC status');
  return {
    revision: revision(pkg.revision),
    projectId: pkg.projectId as string,
    id: pkg.id as string,
    episodeId: pkg.episodeId as string,
    workingTitle: content(pkg.workingTitle, 'package working title', 500),
    titleOptions: asArray(pkg.titleOptions, 'package title options').map(v => content(v, 'package title option', 300)),
    selectedTitle: content(pkg.selectedTitle, 'package selected title', 500),
    description: content(pkg.description, 'package description', 20000),
    chapterTimestamps: asArray(pkg.chapterTimestamps, 'package chapter timestamps').map(value => {
      const chapter = asObject(value, 'package chapter timestamp');
      const timecode = label(chapter.timecode, 'package chapter timecode', 16);
      if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(timecode)) throw new Error('Invalid stored package chapter timecode');
      return { timecode, label: content(chapter.label, 'package chapter label', 300) };
    }),
    tags: asArray(pkg.tags, 'package tags').map(v => content(v, 'package tag', 120)),
    thumbnailRecorded: presence(pkg.thumbnailPath),
    master16x9Recorded: presence(pkg.master16x9Path),
    ...(pkg.master16x9DurationSeconds !== undefined ? { master16x9DurationSeconds: nonNegative(pkg.master16x9DurationSeconds) } : {}),
    ...(pkg.master16x9Resolution !== undefined ? { master16x9Resolution: label(pkg.master16x9Resolution, 'package resolution', 40) } : {}),
    shortsVariants: asArray(pkg.shortsVariants, 'package short variants').map(publicShortVariant),
    captionsSrtRecorded: presence(pkg.captionsSrtPath),
    captionsVttRecorded: presence(pkg.captionsVttPath),
    captionLanguage: typeof pkg.captionLanguage === 'string' && /^[A-Za-z0-9-]{1,35}$/.test(pkg.captionLanguage) ? pkg.captionLanguage : 'und',
    audienceSetting: pickState(pkg.audienceSetting, AUDIENCES, 'unreviewed') as PublicYouTubePackage['audienceSetting'],
    ageRestriction: whenTrue(pkg.ageRestriction),
    alteredSyntheticDisclosureChoice: pickState(pkg.alteredSyntheticDisclosureChoice, DISCLOSURES, 'manual_studio_review') as PublicYouTubePackage['alteredSyntheticDisclosureChoice'],
    rightsClearanceVerified: whenTrue(pkg.rightsClearanceVerified),
    targetPrivacyStatus: pickState(pkg.targetPrivacyStatus, PRIVACY_STATES, 'private') as PublicYouTubePackage['targetPrivacyStatus'],
    ...(pkg.scheduledTimeIso !== undefined ? { scheduledTimeIso: optionalDate(pkg.scheduledTimeIso, 'package scheduled time') } : {}),
    productionTimezone: label(pkg.productionTimezone, 'package production timezone', 64),
    humanApprovedForUpload: whenTrue(pkg.humanApprovedForUpload),
    humanApprovedForPublish: whenTrue(pkg.humanApprovedForPublish),
    qcReport: {
      passed: whenTrue(qc.passed),
      audioClippingDetected: whenTrue(qc.audioClippingDetected),
      aspectRatioConfirmed: whenTrue(qc.aspectRatioConfirmed),
      missingFrames: whenTrue(qc.missingFrames),
      loudnessLufs: typeof qc.loudnessLufs === 'number' && Number.isFinite(qc.loudnessLufs) ? qc.loudnessLufs : null,
      issueCount: issues.length,
      ffprobeRun,
    },
    createdAt: isoDate(pkg.createdAt, 'package creation time'),
    updatedAt: isoDate(pkg.updatedAt, 'package update time'),
  };
}

function publicStage(value: unknown): PublicAutoproduceStage {
  const stage = asObject(value, 'autoproduce stage');
  const stageName = pickState(stage.stageName, STAGE_NAMES, 'unrecognized_stage');
  return {
    stageName,
    label: stageName.replace(/_/g, ' '),
    status: pickState(stage.status, JOB_STATES, 'needs_user') as JobState,
    ...(stage.startTime !== undefined ? { startTime: optionalDate(stage.startTime, 'stage start time') } : {}),
    ...(stage.endTime !== undefined ? { endTime: optionalDate(stage.endTime, 'stage end time') } : {}),
    ...(stage.costUsd !== undefined ? { costUsd: optionalMoney(stage.costUsd, 'stage cost') } : {}),
    requiresHumanAction: whenTrue(stage.requiresHumanAction),
  };
}

export function publicAutoproduceRun(input: AutoproduceRun): PublicAutoproduceRun {
  const run = asObject(input, 'autoproduce run');
  assertIdentifier(run.runId as string); assertIdentifier(run.projectId as string); assertIdentifier(run.episodeId as string);
  if (run.spendApprovalId !== undefined) assertIdentifier(run.spendApprovalId as string);
  return {
    revision: revision(run.revision),
    runId: run.runId as string,
    projectId: run.projectId as string,
    episodeId: run.episodeId as string,
    profile: pickState(run.profile, PROFILES, 'stepwise') as PublicAutoproduceRun['profile'],
    ...(run.spendApprovalId !== undefined ? { spendApprovalId: run.spendApprovalId as string } : {}),
    budgetCapUsd: money(run.budgetCapUsd, 'run budget cap'),
    spentSoFarUsd: money(run.spentSoFarUsd, 'run spend total'),
    stages: asArray(run.stages, 'autoproduce stages').map(publicStage),
    currentStageIndex: counted(run.currentStageIndex),
    isCompleted: whenTrue(run.isCompleted),
    isPaused: whenTrue(run.isPaused),
    isCancelled: whenTrue(run.isCancelled),
    ...(presence(run.blockerMessage) ? { blockerSummary: BLOCKER_RECORDED } : {}),
    outputPackageRecorded: presence(run.outputPackagePath),
    createdAt: isoDate(run.createdAt, 'run creation time'),
    updatedAt: isoDate(run.updatedAt, 'run update time'),
  };
}

export function publicSpendGrant(input: SpendApprovalGrant): PublicSpendGrant {
  const grant = asObject(input, 'spend grant');
  assertIdentifier(grant.approvalId as string); assertIdentifier(grant.projectId as string); assertIdentifier(grant.episodeId as string);
  return {
    approvalId: grant.approvalId as string,
    issuedBy: label(grant.issuedBy, 'grant issuer', 120),
    projectId: grant.projectId as string,
    episodeId: grant.episodeId as string,
    maxBudgetUsd: money(grant.maxBudgetUsd, 'grant budget cap'),
    currency: label(grant.currency, 'grant currency', 8),
    allowedProviders: asArray(grant.allowedProviders, 'grant providers').map(v => label(v, 'grant provider', 60)),
    expiresAt: isoDate(grant.expiresAt, 'grant expiry'),
    isRevoked: whenTrue(grant.isRevoked),
    actualSpentUsd: money(grant.actualSpentUsd, 'grant spend total'),
    createdAt: isoDate(grant.createdAt, 'grant creation time'),
  };
}
