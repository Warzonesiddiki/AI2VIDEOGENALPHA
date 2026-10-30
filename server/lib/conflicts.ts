export class IdempotencyConflict extends Error {
  readonly code = 'IDEMPOTENCY_CONFLICT';
  constructor() { super('Idempotency key conflicts with a different request.'); }
}
export class RevisionConflict extends Error {
  readonly code = 'REVISION_CONFLICT';
  constructor(public currentRevision: number) { super('This record changed since it was loaded. Reload and merge your edits before saving.'); }
}
export class EpisodeSourceConflict extends Error {
  readonly code = 'EPISODE_REVISION_CONFLICT';
  constructor(public currentRevision: number) { super('The source episode changed after this plan was prepared. Reload and replace the plan before verifying frames.'); }
}
export function assertRevision(value: unknown): asserts value is number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) throw new Error('Revision must be a nonnegative safe integer');
}

/** Never persist a token JavaScript cannot compare exactly. */
export function nextRevision(value: unknown): number {
  assertRevision(value);
  const current = value ?? 0;
  if (current === Number.MAX_SAFE_INTEGER) throw new Error('Revision exhausted; operator review is required');
  return current + 1;
}
