import type { ResearchClaim } from '../../src/types/index.ts';
import { assertIdentifier } from './paths.ts';
import { assertRevision } from './conflicts.ts';
import { sanitizeUntrustedResearchContent, validateResearchSourceUrl } from '../../src/core/sources.ts';
import { publicResearchClaim } from './publicDocuments.ts';

/** Research notes are untrusted data, never an approval or instruction channel. */
export function validateResearchClaim(projectId: string, input: ResearchClaim): ResearchClaim {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid research claim');
  assertIdentifier(projectId); assertIdentifier(input.id); assertRevision(input.revision);
  if (input.projectId !== projectId) throw new Error('Research project scope mismatch');
  const allowed = new Set(['id', 'revision', 'projectId', 'claimText', 'isFictionalLore', 'sourceUrl', 'sourceTitle', 'publisher', 'accessDate', 'evidenceExcerpt', 'verificationStatus', 'confidenceScore', 'factCheckerNotes', 'humanApproved', 'relatedEpisodeIds', 'createdAt', 'updatedAt']);
  for (const key of Object.keys(input)) if (!allowed.has(key)) throw new Error(`Unsupported research field: ${key}`);
  const limits = { claimText: 10_000, sourceUrl: 2048, sourceTitle: 1000, publisher: 1000, accessDate: 10, evidenceExcerpt: 30_000, factCheckerNotes: 10_000 };
  for (const [field, limit] of Object.entries(limits)) {
    const value = input[field as keyof ResearchClaim];
    if (value !== undefined && (typeof value !== 'string' || value.length > limit)) throw new Error(`Invalid research ${field}`);
    if (typeof value === 'string' && !sanitizeUntrustedResearchContent(value).isSafe) throw new Error(`Untrusted instruction pattern in research ${field}`);
  }
  if (!input.claimText?.trim() || typeof input.isFictionalLore !== 'boolean') throw new Error('Claim text and fictional-lore boolean required');
  if (input.humanApproved !== false || input.confidenceScore !== 0 || !['unverified', 'fictional_rule', 'disputed'].includes(input.verificationStatus)) throw new Error('Research review/approval assertions are disabled; submit unreviewed notes with zero confidence');
  if (!input.isFictionalLore && input.verificationStatus === 'fictional_rule') throw new Error('Real-world notes cannot be fictional rules');
  if (!Array.isArray(input.relatedEpisodeIds) || input.relatedEpisodeIds.length > 100) throw new Error('Invalid related episodes');
  for (const id of input.relatedEpisodeIds) assertIdentifier(id);
  for (const field of ['createdAt', 'updatedAt'] as const) if (typeof input[field] !== 'string' || !Number.isFinite(Date.parse(input[field]))) throw new Error(`Invalid ${field}`);
  if (input.accessDate && (!/^\d{4}-\d{2}-\d{2}$/.test(input.accessDate) || new Date(`${input.accessDate}T00:00:00Z`).toISOString().slice(0, 10) !== input.accessDate)) throw new Error('Invalid research access date');
  let sourceUrl = input.sourceUrl;
  if (sourceUrl) {
    const checked = validateResearchSourceUrl(sourceUrl);
    if (!checked.isValid) throw new Error(checked.warnings.join(' '));
    sourceUrl = checked.sanitizedUrl;
  }
  return { ...input, sourceUrl, humanApproved: false, confidenceScore: 0, verificationStatus: input.isFictionalLore ? 'fictional_rule' : input.verificationStatus };
}

/** No durable review-event service exists yet, including for historical labels. */
export function unreviewedResearchClaim(claim: ResearchClaim): ResearchClaim {
  return publicResearchClaim(claim);
}
