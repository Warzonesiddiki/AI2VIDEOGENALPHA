import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { episodeEditHandler } from './episodeEdits.ts';
import { researchEditHandler } from './researchEdits.ts';
import { configEditHandler } from './configEdits.ts';
import { seriesReadHandler, episodeListHandler, episodeReadHandler, researchListHandler } from './readHandlers.ts';

const T0 = '2026-01-01T00:00:00.000Z';
const project = 'proj_ternfall_01';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-document-privacy-'));
  const store = new StorageEngine(root); await store.init();
  const app = express(); app.use(express.json());
  app.get('/projects/:id/series', seriesReadHandler(store));
  app.put('/projects/:id/series', configEditHandler(store, 'series'));
  app.get('/projects/:id/episodes', episodeListHandler(store));
  app.get('/projects/:id/episodes/:epId', episodeReadHandler(store));
  app.post('/projects/:id/episodes', episodeEditHandler(store));
  app.get('/projects/:id/research', researchListHandler(store));
  app.post('/projects/:id/research', researchEditHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, base: `http://127.0.0.1:${address.port}` };
}

async function seed(t: any, root: string, store: StorageEngine, name: string, value: unknown) {
  const dir = path.join(root, 'projects', project); await fs.mkdir(dir, { recursive: true });
  await store.atomicWriteJson(path.join(dir, name), value);
}

const send = (method: string, url: string, body: unknown) => fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function assertNoMarkers(payload: unknown) {
  const text = JSON.stringify(payload);
  for (const marker of ['private-fixture']) assert.ok(!text.includes(marker), `response must not contain ${marker}`);
}

const legacyEpisode = {
  revision: 0, id: 'S01E001', dbId: 'ep_legacy_1', projectId: project, seriesId: 'series_ternfall_01',
  season: 1, seasonNumber: 1, episodeNumber: 1, episodeNumberInArc: 1, episodeNumberInSeries: 1, arcNumber: 1,
  workingTitle: 'Fixture title', logline: 'Fixture logline',
  premiseHook: 'Hook', targetAudiencePersona: 'Persona', centralDramaticQuestion: 'Question?',
  timeline: { storyDate: 'Day 1', elapsedTime: '1h', confidence: 'confirmed', secretExtra: 'private-fixture-timeline' },
  timelineAnchor: 'Anchor', charactersPresent: ['rhea'], physicalLocations: ['south-gate'],
  settingIds: ['loc_south_gate'], povCharacterIds: ['rhea-mistry'],
  aPlot: 'A', bPlot: 'B', physicalObjective: 'Objective', humanConflict: 'Conflict', characterTurn: 'Turn',
  majorDecision: 'Decision', consequence: 'Consequence', clueOrPayoff: 'Clue', endingBeat: 'Ending',
  beats: [{ beatNumber: 1, name: 'Beat one', targetSeconds: 30, visualDescription: 'Visual', spokenDialogueSnippet: 'Line', soundDesignCues: ['drip'], continuityClues: ['panel'], secretExtra: 'private-fixture-outline' }],
  status: 'script_draft',
  scriptVersions: [{
    versionNumber: 1, author: 'Fixture author', fullNarrationText: 'Fixture narration text.', wordCount: 3,
    spokenWordCount: 3, estimatedDurationSeconds: 1.2, targetWpm: 145, actualVoiceDurationSeconds: 1.1,
    beats: [{ timestampStart: '00:00', timestampEnd: '00:05', beatName: 'Open', dramaticFunction: 'Hook', dialogueOrNarrationSnippet: 'x', secretExtra: 'private-fixture-anchor' }],
    pronunciationNotes: [{ term: 'Rhea', guide: 'RAY-ah', secretExtra: 'private-fixture-pron' }],
    isApproved: false, approvalNotes: 'Notes', approvedBy: 'Nobody', createdAt: T0, secretExtra: 'private-fixture-version',
  }],
  activeScriptVersionIndex: 0,
  storyboardPromptVersions: [{ prompt: 'private-fixture-storyboard' }], activeStoryboardVersionIndex: 0,
  visualMotifs: ['motif'], factualClaimIds: ['claim_001'], fictionalRuleIds: ['rule_infection_vector'],
  staleDownstreamAssets: true, provenanceSourceEpisodeId: 'S00E000', secretExtra: 'private-fixture-episode',
  createdAt: T0, updatedAt: T0,
};

const legacySeries = {
  revision: 0, id: 'series_ternfall_01', projectId: project, seriesTitle: 'Fixture series', logline: 'Series logline',
  targetRuntimeMinutes: 15, targetWpm: 145, intendedAudience: 'Audience', primaryLanguage: 'en', locale: 'en-IN',
  visualBible: { medium: '2D', palette: ['teal'], silhouetteRules: 'Silhouette', lightingRules: 'Lighting', bannedStyles: ['neon'], secretExtra: 'private-fixture-visual' },
  rules: [{ id: 'rule_infection_vector', category: 'infection', title: 'Rule', fictionalRule: 'Text', isFictional: true, narrativeImplications: 'Implications', prohibitedMisconceptions: 'None', secretExtra: 'private-fixture-rule' }],
  characters: [{ id: 'rhea-mistry', name: 'Rhea', age: 34, role: 'Engineer', visualAnchor: 'Jacket', psychologicalWound: 'Wound', knowledgeScope: 'Scope', voiceStyle: 'Voice', appearancePromptGuidance: 'Guidance', currentStatus: 'active', lastKnownLocation: 'South Gate', secretExtra: 'private-fixture-character' }],
  locations: [{ id: 'loc_south_gate', name: 'South Gate', district: 'District', environmentalDescription: 'Wet', waterStatus: 'flooded', infrastructureNotes: 'Notes', visualPalette: 'Teal', secretExtra: 'private-fixture-location' }],
  factions: [{ id: 'faction_engineers', name: 'Engineers', leaderOrKeyRep: 'Rhea', ideology: 'Repair', materialInterests: 'Parts', relationshipToSouthGate: 'Local', secretExtra: 'private-fixture-faction' }],
  originalityDeclarations: ['Declaration'], secretExtra: 'private-fixture-series', createdAt: T0, updatedAt: T0,
};

const legacyClaim = {
  revision: 0, id: 'claim_001', projectId: project, claimText: 'Fixture claim text.', isFictionalLore: false,
  sourceUrl: 'https://example.com/source', sourceTitle: 'Source', publisher: 'Publisher', accessDate: '2026-01-01',
  evidenceExcerpt: 'Excerpt', verificationStatus: 'verified', confidenceScore: 0.5, factCheckerNotes: 'Notes',
  humanApproved: true, relatedEpisodeIds: ['S01E001'], secretExtra: 'private-fixture-claim', createdAt: T0, updatedAt: T0,
};

const EPISODE_KEYS = [
  'activeScriptVersionIndex', 'arcNumber', 'aPlot', 'beats', 'bPlot', 'centralDramaticQuestion', 'characterTurn',
  'charactersPresent', 'clueOrPayoff', 'consequence', 'createdAt', 'dbId', 'endingBeat', 'episodeNumber',
  'episodeNumberInArc', 'episodeNumberInSeries', 'factualClaimIds', 'fictionalRuleIds', 'humanConflict', 'id',
  'logline', 'majorDecision', 'physicalLocations', 'physicalObjective', 'premiseHook', 'projectId',
  'provenanceSourceEpisodeId', 'revision', 'scriptVersions', 'season', 'seasonNumber', 'seriesId', 'settingIds', 'povCharacterIds',
  'status', 'staleDownstreamAssets', 'targetAudiencePersona', 'timeline', 'timelineAnchor', 'updatedAt',
  'visualMotifs', 'workingTitle',
].sort();

test('episode listings project unknown legacy fields and the save round-trip preserves them', async t => {
  const { root, store, base } = await fixture(t); await seed(t, root, store, 'episodes.json', [legacyEpisode]);
  await seed(t, root, store, 'project.json', { id: project, activeSeriesId: 'series_ternfall_01', createdAt: T0 });
  const list = await fetch(`${base}/projects/${project}/episodes`); assert.equal(list.status, 200);
  assert.equal(list.headers.get('cache-control'), 'no-store');
  const body = await list.json(); assertNoMarkers(body);
  const [episode] = body.data;
  assert.deepEqual(Object.keys(episode).sort(), EPISODE_KEYS);
  assert.deepEqual(Object.keys(episode.timeline).sort(), ['confidence', 'elapsedTime', 'storyDate']);
  assert.deepEqual(Object.keys(episode.beats[0]).sort(), ['beatNumber', 'continuityClues', 'name', 'soundDesignCues', 'spokenDialogueSnippet', 'targetSeconds', 'visualDescription']);
  assert.deepEqual(Object.keys(episode.scriptVersions[0]).sort(), [
    'actualVoiceDurationSeconds', 'approvalNotes', 'approvedBy', 'author', 'beats', 'createdAt',
    'estimatedDurationSeconds', 'fullNarrationText', 'isApproved', 'pronunciationNotes', 'spokenWordCount',
    'targetWpm', 'versionNumber', 'wordCount',
  ]);
  assert.deepEqual(Object.keys(episode.scriptVersions[0].beats[0]).sort(), ['beatName', 'dialogueOrNarrationSnippet', 'dramaticFunction', 'timestampEnd', 'timestampStart']);
  assert.deepEqual(Object.keys(episode.scriptVersions[0].pronunciationNotes[0]).sort(), ['guide', 'term']);
  const detail = await fetch(`${base}/projects/${project}/episodes/S01E001`); assert.equal(detail.status, 200);
  assertNoMarkers(await detail.json());
  const edited = JSON.parse(JSON.stringify(episode)); edited.logline = 'Edited logline';
  const save = await send('POST', `${base}/projects/${project}/episodes`, edited);
  const savedBody = await save.json();
  assert.equal(save.status, 200, JSON.stringify(savedBody).slice(0, 300));
  assert.equal(save.headers.get('cache-control'), 'no-store');
  assertNoMarkers(savedBody);
  const stored = JSON.stringify(await store.readJson(path.join(root, 'projects', project, 'episodes.json'), []));
  for (const marker of ['private-fixture-episode', 'private-fixture-version', 'private-fixture-anchor', 'private-fixture-pron', 'private-fixture-timeline', 'private-fixture-outline', 'private-fixture-storyboard']) {
    assert.ok(stored.includes(marker), `stored data must retain ${marker}`);
  }
  assert.ok(stored.includes('Edited logline'));
});

test('series reads and updates project unknown fields while preserving them on disk', async t => {
  const { root, store, base } = await fixture(t); await seed(t, root, store, 'series.json', legacySeries);
  await seed(t, root, store, 'project.json', { id: project, activeSeriesId: 'series_ternfall_01', createdAt: T0 });
  const read = await fetch(`${base}/projects/${project}/series`); assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'no-store');
  const body = await read.json(); assertNoMarkers(body);
  const series = body.data;
  assert.deepEqual(Object.keys(series).sort(), [
    'characters', 'createdAt', 'factions', 'id', 'intendedAudience', 'locale', 'locations', 'logline',
    'originalityDeclarations', 'primaryLanguage', 'projectId', 'revision', 'rules', 'seriesTitle', 'targetRuntimeMinutes',
    'targetWpm', 'updatedAt', 'visualBible',
  ]);
  assert.deepEqual(Object.keys(series.rules[0]).sort(), ['category', 'fictionalRule', 'id', 'isFictional', 'narrativeImplications', 'prohibitedMisconceptions', 'title']);
  assert.deepEqual(Object.keys(series.characters[0]).sort(), ['age', 'appearancePromptGuidance', 'currentStatus', 'id', 'knowledgeScope', 'lastKnownLocation', 'name', 'psychologicalWound', 'role', 'visualAnchor', 'voiceStyle']);
  assert.deepEqual(Object.keys(series.locations[0]).sort(), ['district', 'environmentalDescription', 'id', 'infrastructureNotes', 'name', 'visualPalette', 'waterStatus']);
  assert.deepEqual(Object.keys(series.factions[0]).sort(), ['id', 'ideology', 'leaderOrKeyRep', 'materialInterests', 'name', 'relationshipToSouthGate']);
  assert.deepEqual(Object.keys(series.visualBible).sort(), ['bannedStyles', 'lightingRules', 'medium', 'palette', 'silhouetteRules']);
  const updated = await send('PUT', `${base}/projects/${project}/series`, { revision: series.revision, seriesTitle: 'Changed series', rules: series.rules });
  const updatedBody = await updated.json();
  assert.equal(updated.status, 200, JSON.stringify(updatedBody).slice(0, 300));
  assertNoMarkers(updatedBody);
  const stored = JSON.stringify(await store.readJson(path.join(root, 'projects', project, 'series.json'), null));
  for (const marker of ['private-fixture-series', 'private-fixture-rule', 'private-fixture-character', 'private-fixture-location', 'private-fixture-faction', 'private-fixture-visual']) {
    assert.ok(stored.includes(marker), `stored data must retain ${marker}`);
  }
  assert.ok(stored.includes('Changed series'));
});

test('research claims are projected on read and preserved on write', async t => {
  const { root, store, base } = await fixture(t); await seed(t, root, store, 'research_claims.json', [legacyClaim]);
  await seed(t, root, store, 'project.json', { id: project, activeSeriesId: 'series_ternfall_01', createdAt: T0 });
  const read = await fetch(`${base}/projects/${project}/research`); assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'no-store');
  const body = await read.json(); assertNoMarkers(body);
  const [claim] = body.data;
  assert.deepEqual(Object.keys(claim).sort(), [
    'accessDate', 'claimText', 'confidenceScore', 'createdAt', 'evidenceExcerpt', 'factCheckerNotes',
    'humanApproved', 'id', 'isFictionalLore', 'projectId', 'publisher', 'relatedEpisodeIds', 'revision',
    'sourceTitle', 'sourceUrl', 'updatedAt', 'verificationStatus',
  ]);
  assert.equal(claim.humanApproved, false); assert.equal(claim.confidenceScore, 0);
  assert.equal(claim.verificationStatus, 'unverified');
  const edited = JSON.parse(JSON.stringify(claim)); edited.claimText = 'Edited claim text.';
  const save = await send('POST', `${base}/projects/${project}/research`, edited);
  const savedBody = await save.json();
  assert.equal(save.status, 200, JSON.stringify(savedBody).slice(0, 300));
  assertNoMarkers(savedBody);
  const stored = JSON.stringify(await store.readJson(path.join(root, 'projects', project, 'research_claims.json'), []));
  assert.ok(stored.includes('private-fixture-claim'));
  assert.ok(stored.includes('Edited claim text.'));
});

test('episode edits reject unknown caller fields without touching stored data', async t => {
  const { root, store, base } = await fixture(t); await seed(t, root, store, 'episodes.json', [legacyEpisode]);
  await seed(t, root, store, 'project.json', { id: project, activeSeriesId: 'series_ternfall_01', createdAt: T0 });
  const before = JSON.stringify(await store.readJson(path.join(root, 'projects', project, 'episodes.json'), []));
  const episode = (await (await fetch(`${base}/projects/${project}/episodes`)).json()).data[0];
  const polluted = { ...episode, secretExtra: 'private-fixture-injected' };
  const response = await send('POST', `${base}/projects/${project}/episodes`, polluted);
  assert.equal(response.status, 400);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assertNoMarkers(await response.json());
  const after = JSON.stringify(await store.readJson(path.join(root, 'projects', project, 'episodes.json'), []));
  assert.equal(after, before);
});
