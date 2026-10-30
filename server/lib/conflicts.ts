export class RevisionConflict extends Error {
  readonly code = 'REVISION_CONFLICT';
  constructor(public currentRevision: number) { super('This record changed since it was loaded. Reload and merge your edits before saving.'); }
}
export function assertRevision(value: unknown): asserts value is number | undefined {
  if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < 0)) throw new Error('Revision must be a nonnegative safe integer');
}
