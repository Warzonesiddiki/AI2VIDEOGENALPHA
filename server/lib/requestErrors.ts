import { assertIdentifier } from './paths.ts';

/** Fixed public messages for known request and state errors; diagnostic details stay local. */
export const requestErrors = {
  EDITORIAL_INVALID_IDENTIFIER: 'Invalid identifier.',
  EDITORIAL_INVALID_REVISION: 'Revision must be a nonnegative safe integer.',
  EPISODE_INVALID_CREATE: 'Invalid episode creation request. Supply a title, a valid idempotency key and bounded text fields.',
  EPISODE_INVALID_DUPLICATION: 'Invalid episode duplication request. Supply a valid idempotency key and optional title.',
  EPISODE_INVALID_EDIT: 'Invalid episode or unsupported production status.',
  EPISODE_INVALID_VERSIONS: 'Invalid script versions or duplicate script version numbers; reconcile before saving.',
  EPISODE_INVALID_VERSION: 'Invalid script version.',
  EPISODE_INVALID_PACING: 'Invalid narration pacing.',
  EPISODE_REVIEW_REQUIRES_SCRIPT: 'A nonempty script without applicable keyword flags is required for a local review marker.',
  EPISODE_PROJECT_UNAVAILABLE: 'Episode project not found or mismatched.',
  EPISODE_SERIES_SCOPE: 'Episode series scope mismatch.',
  EPISODE_AMBIGUOUS_IDENTITY: 'Ambiguous episode identity; reconcile metadata before editing.',
  EPISODE_NOT_FOUND_FOR_EDIT: 'Episode not found; use the creation endpoint.',
  EPISODE_IDENTITY_IMMUTABLE: 'Episode identity cannot be changed.',
  EPISODE_SERIES_IMMUTABLE: 'Episode series scope cannot be changed by editing; reconcile explicitly.',
  EPISODE_HISTORY_REVIEW: 'Historical script versions require manual review.',
  EPISODE_HISTORY_REMOVED: 'Historical script versions cannot be removed.',
  EPISODE_HISTORY_IMMUTABLE: 'Historical script versions are immutable; append a new draft instead.',
  EPISODE_VERSION_SEQUENCE: 'New script versions must follow the existing high-water mark.',
  EPISODE_SOURCE_SCOPE: 'Source episode series scope mismatch.',
  EPISODE_INVALID_SOURCE: 'Invalid source episode; reconcile metadata before duplication.',
  ARC_INVALID_REQUEST: 'Invalid arc expansion request. Supply an arc number from 1 to 100, a count from 1 to 20 and a valid idempotency key.',
  ARC_PROJECT_UNAVAILABLE: 'Arc project not found or mismatched.',
  ARC_SERIES_SCOPE: 'Arc series scope mismatch.',
  ARC_ROADMAP_SCOPE: 'The built-in Ternfall roadmap cannot be expanded into another project.',
  ARC_NOT_FOUND: 'Arc not found.',
  PROJECT_INVALID_REQUEST: 'Invalid project request. Check the project text, archive flag and revision.',
  PROJECT_IDENTITY_MISMATCH: 'Project identity mismatch; inspect metadata before editing.',
  SETTINGS_INVALID_REQUEST: 'Invalid settings request. Check the timezone, revision and current data-notice acknowledgement.',
  SERIES_INVALID_REQUEST: 'Invalid series request. Check supported fields, bounds and revision.',
  SERIES_IDENTITY_IMMUTABLE: 'Series identity is immutable.',
  RESEARCH_INVALID_REQUEST: 'Invalid research note. Check its bounded fields, source, revision and unreviewed status.',
  RESEARCH_PROJECT_UNAVAILABLE: 'Research project not found.',
  RESEARCH_IDENTITY_IMMUTABLE: 'Research identity is immutable.',
} as const;
export type RequestErrorCode = keyof typeof requestErrors;
export class RequestError extends Error {
  constructor(public readonly code: RequestErrorCode, internalMessage?: string) { super(internalMessage ?? requestErrors[code]); }
}
/** Use only around deterministic input validation, never storage or I/O. */
export function requestValidationError(code: RequestErrorCode, error: unknown): RequestError {
  return new RequestError(code, error instanceof Error ? error.message : undefined);
}

export function requestIdentifier(value: unknown): asserts value is string {
  try { assertIdentifier(value); } catch { throw new RequestError('EDITORIAL_INVALID_IDENTIFIER'); }
}
