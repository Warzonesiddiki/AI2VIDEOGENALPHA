import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWordCount,
  calculateNarrationPacing,
  calculateTextSimilarity,
  checkEpisodeDistinctness,
  validateCanonHardRules,
} from './rules.ts';

test('calculateWordCount: strips direction tags and counts spoken words', () => {
  const script = '[Cold Open 00:00] Rhea checks the pressure dial. (whispering) Did you hear that eight-beat rhythm?';
  const count = calculateWordCount(script);
  assert.equal(count, 11);
  assert.equal(calculateWordCount(''), 0);
});

test('calculateNarrationPacing: accurately calculates duration from word count at 145 wpm', () => {
  // Target 15 min is 2,175 words at 145 WPM (15 mins = 900 seconds)
  const result = calculateNarrationPacing(2175, 145);
  assert.equal(result.estimatedDurationSeconds, 900);
  assert.equal(result.estimatedDurationFormatted, '15:00');
  assert.equal(result.isWithinTarget15Min, true);

  // Short script pacing warning
  const shortResult = calculateNarrationPacing(500, 145);
  assert.equal(shortResult.isWithinTarget15Min, false);
  assert.match(shortResult.pacingNote, /Short duration/);
});

test('calculateTextSimilarity: identifies high token overlap between repetitive outlines', () => {
  const outlineA = 'Rhea seals the South Gate as the emergency flood sirens fail in the drainage district';
  const outlineB = 'Rhea closes the South Gate when emergency flood sirens fail inside the drainage basin';
  const score = calculateTextSimilarity(outlineA, outlineB);
  assert.ok(score > 0.4, `Score should be high, was ${score}`);

  const outlineC = 'Mara repairs an abandoned ferry engine on the north harbor island';
  const diffScore = calculateTextSimilarity(outlineA, outlineC);
  assert.ok(diffScore < 0.2, `Score should be low, was ${diffScore}`);
});

test('checkEpisodeDistinctness: flags repetitive storylines against prior episodes', () => {
  const prior = [
    {
      id: 'S01E001',
      workingTitle: 'The Eight-Beat Failure',
      logline: 'Rhea seals South Gate when sirens fall silent and finds infected moving in rhythm',
      aPlot: 'Sealing the gate while avoiding mechanical pulse',
      consequence: 'Lost clean service corridor',
      visualMotifs: ['pressure needle', 'tide mark'],
    },
  ];

  const proposedDuplicate = {
    workingTitle: 'The Eight-Beat Repeat',
    logline: 'Rhea seals South Gate when sirens fall silent and discovers infected moving in rhythm',
    aPlot: 'Sealing the gate while avoiding mechanical pulse',
    consequence: 'Lost clean corridor again',
  };

  const check = checkEpisodeDistinctness(proposedDuplicate, prior);
  assert.equal(check.isDistinct, false);
  assert.ok(check.warnings.length > 0);
});

test('validateCanonHardRules: catches infractions against non-airborne and water infection rules', () => {
  const badScript = 'The airborne virus spread when people started breathing the toxic spores from infected water.';
  const validation = validateCanonHardRules(badScript);
  assert.equal(validation.violatesHardRules, true);
  assert.equal(validation.infractions.length, 2);

  const goodScript = 'Rhea pulled her collar tight. The infection required a direct bite or broken skin contact; the city water was clean.';
  const goodValidation = validateCanonHardRules(goodScript);
  assert.equal(goodValidation.violatesHardRules, false);
});
