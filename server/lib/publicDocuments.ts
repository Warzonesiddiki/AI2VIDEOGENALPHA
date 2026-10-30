import type { EpisodeCard, SeriesBible, ResearchClaim } from '../../src/types/index.ts';
import { EPISODE_SCHEMA, SERIES_SCHEMA, RESEARCH_SCHEMA, projectDocument } from './documentSchema.ts';
import { validateResearchSourceUrl } from '../../src/core/sources.ts';

/**
 * Browser projections for project documents. Unknown legacy keys are never
 * serialized; malformed known structure fails the read closed. Stored raw
 * records keep their legacy keys (see mergeStoredExtras in documentSchema.ts).
 */

export function publicEpisode(input: unknown): EpisodeCard {
  const episode = projectDocument<EpisodeCard>(EPISODE_SCHEMA, input, 'episode');
  if (episode.revision === undefined) episode.revision = 0;
  if (episode.activeScriptVersionIndex >= Math.max(1, episode.scriptVersions.length)) {
    throw new Error('Invalid stored episode active script version');
  }
  return episode;
}

export function publicSeriesBible(input: unknown): SeriesBible | null {
  if (input === null || input === undefined) return null;
  const series = projectDocument<SeriesBible>(SERIES_SCHEMA, input, 'series');
  if (series.revision === undefined) series.revision = 0;
  return series;
}

/** Unreviewed semantics: no stored claim carries durable approval evidence. */
export function publicResearchClaim(input: unknown): ResearchClaim {
  const claim = projectDocument<ResearchClaim>(RESEARCH_SCHEMA, input, 'research claim');
  if (claim.revision === undefined) claim.revision = 0;
  const checkedUrl = claim.sourceUrl ? validateResearchSourceUrl(claim.sourceUrl) : undefined;
  return {
    ...claim,
    sourceUrl: checkedUrl?.isValid ? checkedUrl.sanitizedUrl : undefined,
    humanApproved: false,
    confidenceScore: 0,
    verificationStatus: claim.isFictionalLore ? 'fictional_rule' : claim.verificationStatus === 'disputed' ? 'disputed' : 'unverified',
  };
}
