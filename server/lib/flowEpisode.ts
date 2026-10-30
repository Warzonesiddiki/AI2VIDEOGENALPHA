import type { EpisodeCard } from '../../src/types/index.ts';
import type { FlowPlanningContext } from '../../src/core/flow.ts';

/** Extract only fields belonging to the selected episode; all output remains a draft. */
export function episodeFlowContext(episode: EpisodeCard): FlowPlanningContext {
  const outlineBeats = Array.isArray(episode.beats) ? episode.beats.map(beat => ({ name: beat.name, visualDescription: beat.visualDescription })) : [];
  const active = episode.scriptVersions?.[episode.activeScriptVersionIndex];
  const scriptBeats = Array.isArray(active?.beats) ? active.beats.map(beat => ({ name: beat.beatName, visualDescription: beat.dramaticFunction })) : [];
  return { logline: episode.logline, physicalObjective: episode.physicalObjective, beats: outlineBeats.length ? outlineBeats : scriptBeats };
}
