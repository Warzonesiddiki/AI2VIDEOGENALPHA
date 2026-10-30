import test from 'node:test';
import assert from 'node:assert/strict';
import type { EpisodeCard } from '../src/types/index.ts';
import { assertUniqueEpisodeIdentities, episodeHighWater, episodeId } from './lib/episodeAllocation.ts';

test('episode allocation stays above both public and database aliases across sparse legacy numbers', () => {
  // Deterministic generated cases, without adding a property-test dependency.
  for (let alias = 2; alias <= 400; alias++) {
    const existing = [{ id: 'S01E001', dbId: episodeId(2, alias), episodeNumber: 1, episodeNumberInSeries: 1 }] as EpisodeCard[];
    const high = episodeHighWater(existing);
    assert.equal(high, alias);
    for (const season of [1, 2, 9]) {
      const next = episodeId(season, high + 1);
      assert.notEqual(next, existing[0].id);
      assert.notEqual(next, existing[0].dbId);
      assert.doesNotThrow(() => assertUniqueEpisodeIdentities([...existing, { id: next, dbId: `fixture_${season}` } as EpisodeCard]));
    }
  }
});

test('episode allocation rejects unsafe integers encoded in legacy database aliases', () => {
  const episodes = [{ id: 'S01E001', dbId: 'S01E9007199254740992' }] as EpisodeCard[];
  assert.throws(() => episodeHighWater(episodes), /Invalid legacy episode numbering/);
});
