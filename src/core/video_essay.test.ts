import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPilotVideoEssayData,
  generateThinkPadT14RenderScripts,
  generateEdgeTtsScript,
  generateShortsRenderScript,
  generateMasterOrchestratorScript,
  generateVideoEssaySrt,
  generateVideoEssayYouTubeDescription,
} from './video_essay.ts';

test('getPilotVideoEssayData: generates zero-credit structured video essay with pacing and canon', () => {
  const data = getPilotVideoEssayData();
  assert.equal(data.episodeId, 'S01E001');
  assert.equal(data.googleFlowCreditsCost, 0);
  assert.ok(data.slides.length >= 16);
  assert.ok(data.totalWordCount > 500);
  assert.ok(data.avgWpm >= 110 && data.avgWpm <= 160);

  // Validate every slide has a 0-credit flow prompt, script, and camera move
  for (const slide of data.slides) {
    assert.ok(slide.flowPrompt.length > 50);
    assert.ok(slide.narratorScript.length > 20);
    assert.ok(slide.durationSeconds >= 10);
    assert.ok(slide.cameraMovement);
    assert.ok(slide.overlayEffect);
  }
});

test('legacy executable Video Essay exports fail closed, including network speech', () => {
  const data = getPilotVideoEssayData();
  for (const generate of [generateThinkPadT14RenderScripts, generateEdgeTtsScript, generateShortsRenderScript, generateMasterOrchestratorScript]) {
    assert.throws(() => generate(data), /retired/i);
  }
});

test('generateVideoEssaySrt: formats synchronized SubRip captions correctly', () => {
  const data = getPilotVideoEssayData();
  const srt = generateVideoEssaySrt(data.slides);

  assert.ok(srt.includes('00:00:00,000 --> 00:00:15,000'));
  assert.ok(srt.includes('The brass needle on the Basin Three gauge'));
});

test('generateVideoEssayYouTubeDescription: contains clickable timestamps and required synthetic media disclosure', () => {
  const data = getPilotVideoEssayData();
  const desc = generateVideoEssayYouTubeDescription(data);

  assert.ok(desc.includes('00:00 - Cold Open: The Eight-Twitch Needle'));
  assert.ok(desc.includes('SYNTHETIC MEDIA DISCLOSURE'));
  assert.ok(desc.includes('#Ternfall'));
});
