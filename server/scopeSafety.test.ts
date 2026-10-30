import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { StorageEngine } from './storage.ts';
import { episodeCheckHandler } from './episodeCommands.ts';
import { checkProjectCanon } from '../src/core/canonScope.ts';

const original = 'proj_ternfall_01';
async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-scope-safety-'));
  const store = new StorageEngine(root); await store.init();
  t.after(async () => { store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store };
}

test('Ternfall keyword heuristics are never presented as another project’s canon check', async t => {
  const { store } = await fixture(t); const project = await store.createProject('Original new project', 'Independent fixture');
  assert.equal(checkProjectCanon(original, 'The infection is airborne.').violatesHardRules, true);
  const other = checkProjectCanon(project.id, 'The infection is airborne.');
  assert.equal(other.evaluated, false); assert.equal(other.violatesHardRules, false); assert.match(other.reason, /manually/);
  assert.equal(checkProjectCanon(original, '').evaluated, false);
  const episode = await store.createEpisode(project.id, { workingTitle: 'A new story', idempotencyKey: 'new_scope' });
  const source = (await store.getEpisode(original, 'S01E001'))!.scriptVersions[0];
  episode.scriptVersions = [{ ...source, versionNumber: 1, fullNarrationText: 'The infection is airborne.', wordCount: 999 }];
  await store.saveEpisode(project.id, episode, true);
  const app = express(); app.use(express.json()); app.post('/projects/:id/episodes/:epId/check', episodeCheckHandler(store));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const response = await fetch(`http://127.0.0.1:${address.port}/projects/${project.id}/episodes/${episode.id}/check`, { method: 'POST' });
  const result = (await response.json()).data;
  assert.equal(result.scriptPresent, true); assert.equal(result.canonValidation.evaluated, false); assert.equal(result.isReadyForProduction, false);
});

test('continuity records require an existing scoped episode and do not invent character knowledge', async t => {
  const { store } = await fixture(t); const project = await store.createProject('Second scope', 'fixture');
  const episode = await store.createEpisode(project.id, { workingTitle: 'Independent card', idempotencyKey: 'continuity_scope' });
  const event = { id: 'canon_fixture', episodeId: episode.id, storyDate: 'unknown', physicalLocation: 'Observatory', charactersPresent: [], whatCharactersLearned: {}, resourceDeltas: [], injuriesOrStatusChanges: [], unresolvedClues: [], promisesMade: [], consequencesSummary: 'A signal was observed.', isRetcon: false, createdAt: new Date().toISOString() };
  await assert.rejects(store.addCanonEvent('missing_project', event), /project not found/);
  await assert.rejects(store.addCanonEvent(project.id, { ...event, episodeId: 'missing_episode' }), /episode not found/);
  assert.deepEqual(await store.listCanonEvents(project.id), []);
  await store.addCanonEvent(project.id, event); assert.deepEqual(await store.listCanonEvents(project.id), [event]);
  await assert.rejects(store.addCanonEvent(project.id, event), /already exists/);
});

test('typed CLI plans explicitly with episode context and cannot fabricate package, continuity or execution results', async t => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-cli-scope-'));
  t.after(() => fs.rm(cwd, { recursive: true, force: true }));
  const loader = path.resolve('node_modules/tsx/dist/loader.mjs'), cli = path.resolve('bin/studio.ts');
  const run = async (...args: string[]) => JSON.parse((await promisify(execFile)(process.execPath, ['--import', loader, cli, ...args, '--json'], { cwd, env: { ...process.env, DOTENV_CONFIG_QUIET: 'true' } })).stdout).data;
  await assert.rejects(run('flow', 'export', '--episode', 'S01E001'), /Plan not prepared/);
  await assert.rejects(run('flow', 'checkpoint', '--episode', 'S01E001'), /Plan not prepared/);
  await assert.rejects(run('flow', 'plan', '--episode', 'missing', '--duration', '1'), /Episode not found/);
  await assert.rejects(run('flow', 'plan', '--episode', 'S01E001', '--duration', '1tail'), /positive integer/);
  const planned = await run('flow', 'plan', '--episode', 'S01E001', '--duration', '1', '--fps', '24');
  assert.equal(planned.totalFramesExpected, 24);
  const batch = await run('flow', 'export', '--episode', 'S01E001', '--batch', '1');
  assert.match(batch.prompts[0].prompt, /Logline:/);
  await assert.rejects(run('flow', 'autoproduce', '--episode', 'S01E001'), /unavailable/);
  await assert.rejects(run('youtube', 'package', 'S01E001'), /disabled/);
  await assert.rejects(run('continuity', 'add', '--episode', 'S01E001', '--summary', 'Observation'), /--location/);
  await assert.rejects(run('continuity', 'add', '--episode', 'missing', '--location', 'Observatory', '--summary', 'Observation'), /episode not found/i);
  const event = await run('continuity', 'add', '--episode', 'S01E001', '--location', 'Observatory', '--summary', 'Observation');
  assert.equal(event.storyDate, 'unknown'); assert.deepEqual(event.charactersPresent, []); assert.deepEqual(event.whatCharactersLearned, {});
  const updated = await run('episode', 'update-script', 'S01E001', '--text', 'A modest new fictional draft.');
  assert.equal(updated.isCanonCompliant, null); assert.equal(updated.canonCheck.evaluated, true);
});
