import type { EpisodeCard } from '../types/index.ts';
import { calculateWordCount, calculateNarrationPacing } from './rules.ts';

export interface StoryBrief {
  workingTitle: string;
  logline: string;
  characters: string[];
  location: string;
  canonNotes?: string;
}

/** Local planning scaffold, not an AI-written or editorially approved screenplay. */
export function buildStoryOutline(input: StoryBrief) {
  const text = (value: unknown, name: string, max: number) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid story ${name}`);
    return value.trim();
  };
  const title = text(input?.workingTitle, 'title', 200);
  const premise = text(input?.logline, 'logline', 2000);
  const place = text(input?.location, 'location', 200);
  if (!Array.isArray(input?.characters) || input.characters.length < 1 || input.characters.length > 12) throw new Error('Story requires 1..12 characters');
  const characters = input.characters.map(value => text(value, 'character', 100));
  if (input.canonNotes !== undefined && (typeof input.canonNotes !== 'string' || input.canonNotes.length > 4000)) throw new Error('Invalid story canon notes');
  const lead = characters[0];
  const countervoice = characters[1] ?? 'a survivor with a competing responsibility';
  return {
    beats: [
      { name: '1. Contradiction / hook', snippet: `${title}: at ${place}, show one physical detail that contradicts an apparently safe reading. Start inside the problem, not with world history. Premise: ${premise}` },
      { name: '2. Want and private cost', snippet: `${lead} needs a concrete, observable outcome before a visible deadline. Tie failure to a named person's need. Establish what the lead is afraid to admit.` },
      { name: '3. First attempt makes it worse', snippet: `${lead} acts on a plausible but incomplete explanation. The attempt costs time or a scarce resource; its failure reveals a new physical constraint at ${place}.` },
      { name: '4. Two defensible positions', snippet: `${countervoice} wants an incompatible outcome for a credible reason. Give each side evidence; neither becomes foolish just to let the lead win. Let an interrupted task carry the argument.` },
      { name: '5. Test, reversal, new question', snippet: 'Plant a tangible clue, test a limited hypothesis and show the observable result. Separate observation from inference. The discovery changes the rescue plan without granting anyone knowledge they could not possess.' },
      { name: '6. Irreversible choice', snippet: `${lead} must choose between two specific losses. Name what each option saves and destroys. A promise or earlier mistake makes this choice personal; do not add a convenient third solution.` },
      { name: '7. Earned action / price paid', snippet: `Resolve the immediate objective with a tool, skill or clue established earlier. ${countervoice} contributes a decision, not just an extra pair of hands. Show the cost becoming irreversible.` },
      { name: '8. Consequence / changed relationship', snippet: 'Give the rescue a quiet human aftermath. Record who was saved, what route/resource is gone and which promise is now harder to keep. Let behavior, not a speech, reveal the changed relationship.' },
      { name: '9. Payoff that opens the next problem', snippet: 'Close the immediate dramatic question. Recontextualize a planted clue so the ending follows from the choice, not a random new threat. Preserve uncertainty about motive; do not imply supernatural coordination.' },
    ],
    reviewRequired: true as const,
    provenance: 'local-editorial-scaffold' as const,
    canonNotes: input.canonNotes ?? '',
    constraints: ['Original Ternfall material only.', 'Transmission only through bite/saliva entering broken skin; water is not an infection vector.', 'The Still have no speech, telepathy or deliberate master strategy.', 'No factual, editorial, rights, spend or publication approval is established by this scaffold.'],
  };
}

/** Evidence of missing craft inputs only. Never a score, readiness gate or proof of quality. */
export function reviewStoryCraft(episode: Partial<EpisodeCard>) {
  const script = episode.scriptVersions?.[episode.activeScriptVersionIndex ?? 0];
  const narration = typeof script?.fullNarrationText === 'string' ? script.fullNarrationText : '';
  const issues: Array<{ field: string; question: string }> = [];
  const required = [
    ['centralDramaticQuestion', 'What concrete question will this episode answer?'],
    ['physicalObjective', 'What observable task must be completed, and before what deadline?'],
    ['humanConflict', 'Why are two reasonable people in conflict?'],
    ['characterTurn', 'What belief changes through action rather than explanation?'],
    ['majorDecision', 'Which two defensible options carry different irreversible costs?'],
    ['consequence', 'Which resource, relationship or route changes permanently?'],
    ['clueOrPayoff', 'What planted evidence is tested or reinterpreted?'],
    ['endingBeat', 'How does the choice cause the next problem while closing this one?'],
  ] as const;
  for (const [field, question] of required) if (typeof episode[field] !== 'string' || !episode[field]?.trim()) issues.push({ field, question });
  if (!narration.trim()) issues.push({ field: 'script', question: 'Write and independently review the spoken draft; an outline is not a finished script.' });
  const wordCount = calculateWordCount(narration);
  const pacing = calculateNarrationPacing(wordCount, script?.targetWpm ?? 145);
  if (narration.trim() && !pacing.isWithinTarget15Min) issues.push({ field: 'pacing', question: `Estimated spoken length is ${pacing.estimatedDurationFormatted}, not the 13–17 minute target. Expand causal scenes or edit repetition; do not pad to a count.` });
  return {
    kind: 'editorial-advisory' as const,
    qualityVerified: false as const,
    humanReviewRequired: true as const,
    wordCount,
    estimatedDurationSeconds: pacing.estimatedDurationSeconds,
    measuredVoiceDurationSeconds: script?.actualVoiceDurationSeconds ?? null,
    issues,
    reviewQuestions: ['Does every scene change knowledge, risk or trust?', 'Can the audience reconstruct the physical geography and deadline?', 'Is the solution planted, costly and achievable without a canon exception?', 'Does dialogue conceal competing needs rather than repeat narration?', 'Are real-world engineering claims separately researched and verified?'],
  };
}
