import type { EpisodeCard } from '../../src/types/index.ts';
import { assertIdentifier } from './paths.ts';

/** Both public IDs and database IDs are accepted by getEpisode, so they share one namespace. */
export function assertUniqueEpisodeIdentities(episodes: EpisodeCard[]): void {
  if (!Array.isArray(episodes)) throw new Error('Invalid episode collection; reconcile metadata before allocating');
  const owners = new Map<string, number>();
  episodes.forEach((episode, index) => {
    if (!episode || typeof episode !== 'object') throw new Error('Invalid episode record; reconcile metadata before allocating');
    assertIdentifier(episode.id);
    assertIdentifier(episode.dbId);
    for (const key of new Set([episode.id, episode.dbId])) {
      if (owners.has(key)) throw new Error(`Ambiguous episode identity ${key}; reconcile metadata before allocating`);
      owners.set(key, index);
    }
  });
}

/** Allocate above all supported legacy numbering fields and encoded episode IDs. */
export function episodeHighWater(episodes: EpisodeCard[], count = 1): number {
  assertUniqueEpisodeIdentities(episodes);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Invalid episode allocation count');
  let high = 0;
  for (const episode of episodes) {
    // getEpisode accepts both IDs in one namespace. A legacy dbId such as
    // S01E002 therefore reserves that public identifier as well.
    const encoded = [episode.id, episode.dbId].map(id => {
      const match = /^S\d+E(\d+)$/.exec(id);
      return match ? Number(match[1]) : undefined;
    });
    for (const value of [episode.episodeNumber, episode.episodeNumberInSeries, ...encoded]) {
      if (value === undefined) continue;
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid legacy episode numbering; reconcile before allocation');
      high = Math.max(high, value);
    }
  }
  if (!Number.isSafeInteger(high + count)) throw new Error('Episode numbering exhausted');
  return high;
}

export function episodeSeason(episode: EpisodeCard): number {
  const encoded = /^S(\d+)E\d+$/.exec(episode.id);
  const values = [episode.season, episode.seasonNumber, encoded ? Number(encoded[1]) : undefined].filter(value => value !== undefined) as number[];
  if (!values.length) return 1;
  if (values.some(value => !Number.isSafeInteger(value) || value < 1 || value > 9999 || value !== values[0])) {
    throw new Error('Inconsistent episode season; reconcile metadata before duplication');
  }
  return values[0];
}

export function episodeId(season: number, number: number): string {
  if (!Number.isSafeInteger(season) || season < 1 || season > 9999 || !Number.isSafeInteger(number) || number < 1) throw new Error('Invalid episode allocation');
  const id = `S${String(season).padStart(2, '0')}E${String(number).padStart(3, '0')}`;
  assertIdentifier(id);
  return id;
}
