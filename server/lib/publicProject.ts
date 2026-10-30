import type { ProjectMetadata, PublicProjectMetadata } from '../../src/types/index.ts';
import { validateProjectText } from '../../src/core/projects.ts';
import { assertIdentifier } from './paths.ts';

/** Expose only operator-facing project metadata; never serialize storage paths or extras. */
export function publicProject(input: ProjectMetadata): PublicProjectMetadata {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid stored project');
  assertIdentifier(input.id); assertIdentifier(input.activeSeriesId); validateProjectText(input.name, input.description);
  if (typeof input.slug !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(input.slug)) throw new Error('Invalid stored project slug');
  if (typeof input.isArchived !== 'boolean') throw new Error('Invalid stored project state');
  const revision = input.revision === undefined ? 0 : input.revision;
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid stored project revision');
  const date = (value: unknown) => {
    if (typeof value !== 'string') throw new Error('Invalid stored project date');
    const parsed = Date.parse(value); if (!Number.isFinite(parsed)) throw new Error('Invalid stored project date');
    return new Date(parsed).toISOString();
  };
  return {
    id: input.id, revision, name: input.name, slug: input.slug, description: input.description,
    createdAt: date(input.createdAt), updatedAt: date(input.updatedAt),
    archivedAt: input.archivedAt === undefined ? undefined : date(input.archivedAt),
    isArchived: input.isArchived, activeSeriesId: input.activeSeriesId,
  };
}
