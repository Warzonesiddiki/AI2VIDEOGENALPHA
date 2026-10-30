import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryOutline, reviewStoryCraft } from './storyCraft.ts';
import { calculateWordCount, validateCanonHardRules } from './rules.ts';
import { PILOT_EPISODE_CARD } from '../../server/seedData.ts';
import { PILOT_NARRATION, PILOT_BEATS } from '../../server/pilotStory.ts';
import { GeminiAdapter } from '../../server/geminiAdapter.ts';

const brief = { workingTitle: 'The Dry Stair', logline: 'A repair crew must choose which route to seal before the tide.', characters: ['Rhea Mistry', 'Mara Ilyan'], location: 'North relay stair', canonNotes: 'No new transmission route.' };
test('local outline responds to the actual brief and labels its limits', () => {
  const result = buildStoryOutline(brief);
  assert.equal(result.beats.length, 9); assert.equal(result.provenance, 'local-editorial-scaffold');
  assert.equal(result.reviewRequired, true); assert.equal(result.canonNotes, brief.canonNotes);
  assert.ok(result.beats[0].snippet.includes(brief.logline));
  assert.ok(result.beats[0].snippet.includes(brief.location));
  assert.ok(result.beats[3].snippet.includes('Mara Ilyan'));
  const other = buildStoryOutline({ ...brief, workingTitle: 'Different premise', characters: ['Kabir'], location: 'Canal station' });
  assert.notDeepEqual(result.beats, other.beats);
});
test('story scaffolds reject invalid or excessive input instead of inventing missing brief details', () => {
  for (const patch of [{ workingTitle: '' }, { logline: 4 }, { characters: [] }, { characters: [''] }, { characters: Array(13).fill('Rhea') }, { location: 'x'.repeat(201) }, { canonNotes: {} }]) {
    assert.throws(() => buildStoryOutline({ ...brief, ...patch } as any));
  }
});
test('story checks identify missing craft inputs but never certify quality or approval', () => {
  const empty = reviewStoryCraft({}); assert.ok(empty.issues.length >= 9);
  assert.equal(empty.qualityVerified, false); assert.equal(empty.humanReviewRequired, true);
  const pilot = reviewStoryCraft(PILOT_EPISODE_CARD);
  assert.equal(pilot.wordCount, calculateWordCount(PILOT_NARRATION));
  assert.equal(pilot.measuredVoiceDurationSeconds, null);
  assert.ok(pilot.issues.some(issue => issue.field === 'pacing')); // Honest condensed draft, not a 15-min recording.
  assert.equal(pilot.qualityVerified, false);
});
test('fresh pilot is an unapproved original draft with derived evidence and nine causal beats', () => {
  const script = PILOT_EPISODE_CARD.scriptVersions[0];
  assert.equal(PILOT_EPISODE_CARD.status, 'script_draft'); assert.equal(script.isApproved, false);
  assert.equal(script.approvedBy, undefined); assert.equal(script.actualVoiceDurationSeconds, undefined);
  assert.equal(script.wordCount, calculateWordCount(script.fullNarrationText));
  assert.equal(script.estimatedDurationSeconds, Math.round(script.wordCount / script.targetWpm * 60));
  assert.equal(PILOT_BEATS.length, 9); assert.ok(PILOT_BEATS.every(beat => beat.dramaticFunction && beat.dialogueOrNarrationSnippet));
  assert.equal(validateCanonHardRules(script.fullNarrationText).violatesHardRules, false);
});
test('no-key adapter returns an unreviewed local scaffold, never a verified canonical episode', async () => {
  const result = await new GeminiAdapter('').generateOutline(brief);
  assert.equal(result.isAiGenerated, false); assert.equal(result.success, true);
  assert.match(result.providerNotice!, /not verified or approved/);
  assert.ok(result.data.beats[0].snippet.includes(brief.workingTitle));
});
test('configured adapter still refuses billable execution', async () => {
  const result = await new GeminiAdapter('isolated-not-a-real-api-key').generateOutline(brief);
  assert.equal(result.success, false); assert.deepEqual(result.data.beats, []);
  assert.match(result.providerNotice!, /No provider request was sent/);
});

test('pilot reading copy stays synchronized with the authored source', async () => {
  const fs = await import('node:fs/promises');
  const copy = await fs.readFile(new URL('../../docs/story/pilot-the-eight-beat-failure.md', import.meta.url), 'utf8');
  assert.ok(copy.includes(PILOT_NARRATION));
});

test('unscoped story scaffolds do not silently import Ternfall canon into other projects', () => {
  const result = buildStoryOutline({ workingTitle: 'Night Observatory', logline: 'A researcher must secure a telescope.', characters: ['Amara'], location: 'North observatory' });
  assert.doesNotMatch(JSON.stringify(result), /Ternfall|\bStill\b|infection|transmission/i);
});
