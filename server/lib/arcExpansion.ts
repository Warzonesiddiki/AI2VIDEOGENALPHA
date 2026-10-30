import { randomUUID } from 'node:crypto';
import type { ArcRoadmapItem, EpisodeCard, ProjectMetadata } from '../../src/types/index.ts';
import { assertIdentifier } from './paths.ts';

export function validateArcExpansion(input: unknown): { arcNumber: number; count: number; idempotencyKey: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid arc expansion request');
  const { arcNumber, count = 10, idempotencyKey } = input as any;
  if (Object.keys(input).some(key => !['arcNumber', 'count', 'idempotencyKey'].includes(key))) throw new Error('Unsupported arc expansion field');
  if (!Number.isSafeInteger(arcNumber) || arcNumber < 1 || arcNumber > 100) throw new Error('Arc number must be an integer in 1..100');
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) throw new Error('Arc count must be an integer in 1..20');
  assertIdentifier(idempotencyKey);
  return { arcNumber, count, idempotencyKey };
}

export function arcCard(project: ProjectMetadata, arc: ArcRoadmapItem, epNum: number, i: number): EpisodeCard {
  const epId = `S${String(arc.seasonNumber).padStart(2, '0')}E${String(epNum).padStart(3, '0')}`;
      return {
        revision: 1,
        id: epId,
        dbId: `ep_${randomUUID()}`,
        projectId: project.id,
        seriesId: project.activeSeriesId,
        season: arc.seasonNumber,
        seasonNumber: arc.seasonNumber,
        episodeNumber: epNum,
        episodeNumberInSeries: epNum,
        arcNumber: arc.arcNumber,
        workingTitle: `${arc.arcTitle}: Part ${i}`,
        logline: `Focusing on ${arc.centralConflict.toLowerCase()} at ${arc.coreSetting}.`,
        centralDramaticQuestion: `How will the group resolve the ${arc.centralConflict.toLowerCase()}?`,
        timeline: {
          storyDate: `Day ${Math.ceil(epNum / 2)}, 06:00 AM`,
          elapsedTime: '12 hours',
          confidence: 'approximate',
        },
        settingIds: ['loc_south_gate'],
        povCharacterIds: ['rhea-mistry'],
        aPlot: `Rhea investigates consequences of ${arc.majorConsequence.toLowerCase()}`,
        bPlot: 'Mara handles logistical tensions and fuel supply',
        physicalObjective: `Navigate the ${arc.coreSetting}`,
        humanConflict: 'Balancing collective safety against individual autonomy',
        characterTurn: 'Admitting uncertainty before making the final route choice',
        majorDecision: 'Choosing community consultation over unilateral action',
        consequence: arc.majorConsequence,
        clueOrPayoff: 'New sound pattern recorded on community relay',
        endingBeat: 'Quiet hold on the water tide line as night falls',
        status: 'planned',
        scriptVersions: [],
        activeScriptVersionIndex: 0,
        visualMotifs: ['estuary teal tide marks', 'paper map contour lines'],
        factualClaimIds: [],
        fictionalRuleIds: ['rule_infection_vector'],
        staleDownstreamAssets: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
}
