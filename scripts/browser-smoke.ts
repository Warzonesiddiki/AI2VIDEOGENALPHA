import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { chromium, type Browser, type Page } from 'playwright-core';
import sharp from 'sharp';

// Opt-in integration test: all server data is created under a disposable OS temp directory.
// A browser executable is supplied by the operator; this script never downloads one.
const executablePath = process.env.CHROMIUM_PATH;
if (!executablePath || !path.isAbsolute(executablePath)) throw new Error('Set CHROMIUM_PATH to an existing local Chromium/Chrome executable before running this opt-in test.');
await fs.access(executablePath);
const repo = process.cwd();
await fs.access(path.join(repo, 'dist', 'index.html'));
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-browser-test-'));
const reserve = net.createServer();
await new Promise<void>((resolve, reject) => reserve.once('error', reject).listen(0, '127.0.0.1', resolve));
const address = reserve.address(); assert.ok(address && typeof address !== 'string');
const port = address.port;
await new Promise<void>((resolve, reject) => reserve.close(error => error ? reject(error) : resolve()));
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['--import', path.join(repo, 'node_modules/tsx/dist/loader.mjs'), path.join(repo, 'server.ts')], {
  cwd: root,
  env: { ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), STUDIO_OPERATOR_TOKEN: '', GEMINI_API_KEY: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', data => { serverOutput += String(data); });
server.stderr.on('data', data => { serverOutput += String(data); });
const exited = once(server, 'exit');
let browser: Browser | undefined;
let page: Page | undefined;
try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Test server did not start: ${serverOutput}`)), 20_000);
    const ready = (data: Buffer) => { if (String(data).includes('Server listening')) { clearTimeout(timeout); resolve(); } };
    server.stdout.on('data', ready);
    server.once('exit', code => { clearTimeout(timeout); reject(new Error(`Test server exited ${code}: ${serverOutput}`)); });
  });
  browser = await chromium.launch({
    executablePath, headless: true,
    args: ['--disable-dev-shm-usage', ...(process.env.BROWSER_NO_SANDBOX === '1' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])],
  });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const runtimeErrors: string[] = [], externalRequests: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (/^https?:/.test(url) && new URL(url).origin !== base) externalRequests.push(url);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Studio overview' }).waitFor();
  await page.waitForFunction(() => (document.querySelector('select[aria-label="Active episode"]') as HTMLSelectElement | null)?.value === 'S01E001');
  assert.equal(await page.getByText('1 pilot ready for render').count(), 0);

  await page.getByRole('button', { name: 'Episode Board', exact: true }).click();
  await page.getByRole('button', { name: 'Create Episode Card' }).click();
  await page.getByPlaceholder('e.g. Sluice Gate Nine').fill('Browser Fixture Episode');
  await page.getByRole('button', { name: 'Create Card', exact: true }).click();
  await page.getByText('Browser Fixture Episode', { exact: true }).waitFor();
  await page.getByTitle('Duplicate Episode Variant').last().click();
  await page.getByText('Browser Fixture Episode (Variant)', { exact: true }).waitFor();
  await page.getByTitle('Run Distinctness & Canon Check').last().click();
  await page.getByText('No nonempty script was available to evaluate.').waitFor();
  await page.getByText(/Not certified ready/).waitFor();
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await page.getByTitle('Open Script & Pacing Editor').nth(1).click();
  await page.locator('textarea[rows="22"]').fill('A fictional field operator inspects the damaged gate and records a cautious observation.');
  await page.getByRole('button', { name: 'Save Version' }).click();
  await page.getByText('Draft version saved.').waitFor();
  const editedDraft = await (await page.request.get(`${base}/api/projects/proj_ternfall_01/episodes/S01E002`)).json();
  assert.deepEqual(editedDraft.data.scriptVersions[0].pronunciationNotes, []);
  const notes = [{ term: 'Fixture', guide: 'FIX-chur' }];
  const beats = [{ timestampStart: '00:00', timestampEnd: '00:30', beatName: 'Observation', dramaticFunction: 'Discovery', dialogueOrNarrationSnippet: 'An observation.' }];
  const seededVersion = { ...editedDraft.data.scriptVersions[0], versionNumber: 2, beats, pronunciationNotes: notes };
  const seededResponse = await page.request.post(`${base}/api/projects/proj_ternfall_01/episodes`, { data: { ...editedDraft.data, scriptVersions: [...editedDraft.data.scriptVersions, seededVersion], activeScriptVersionIndex: 1 } });
  assert.equal(seededResponse.status(), 200); const seededEpisode = (await seededResponse.json()).data;
  await page.getByRole('button', { name: 'Episode Board', exact: true }).click();
  await page.getByTitle('Open Script & Pacing Editor').nth(1).click();
  await page.getByText('FIX-chur', { exact: true }).waitFor();
  await page.locator('textarea[rows="22"]').fill('The field operator records a second, more cautious observation.');
  await page.getByRole('button', { name: 'Save Version' }).click();
  await page.getByText('Draft version saved.').waitFor();
  const preserved = (await (await page.request.get(`${base}/api/projects/proj_ternfall_01/episodes/S01E002`)).json()).data;
  assert.deepEqual(preserved.scriptVersions.slice(0, 2), seededEpisode.scriptVersions);
  assert.deepEqual(preserved.scriptVersions[2].beats, beats); assert.deepEqual(preserved.scriptVersions[2].pronunciationNotes, notes);
  await page.getByLabel('Active episode').selectOption('S01E002');
  await page.locator('header').first().getByRole('button', { name: 'Plan / render' }).click();
  await page.getByRole('heading', { name: 'Flow planning & local render' }).waitFor();
  await page.getByLabel('Duration in seconds (1–900)').fill('2');
  await page.getByRole('button', { name: 'Prepare plan', exact: true }).click();
  await page.getByText(/Draft plan saved/).waitFor();
  await page.getByText('Review 24 draft frame prompts').click();
  await page.getByText(/Visual note: Discovery/).first().waitFor();
  await page.getByRole('button', { name: 'Verify existing PNGs' }).click();
  const frameError = page.getByRole('alert').first();
  await frameError.waitFor(); // No fixture frames exist; no verification is certified.
  assert.match(await frameError.innerText(), /frame files are missing/i);
  assert.ok(!(await frameError.innerText()).includes(root));

  // Verify a real synthetic batch, then fail its recheck and the follow-up GET.
  // Stale evidence must not stay visible when the current revision is unknown.
  const frameDir = path.join(root, 'data/production_root/projects/proj_ternfall_01/assets/flow_renders/S01E002');
  await fs.mkdir(frameDir, { recursive: true });
  const png = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#14747a' } }).png().toBuffer();
  await Promise.all(Array.from({ length: 24 }, (_, index) => fs.writeFile(path.join(frameDir, `frame_${String(index + 1).padStart(5, '0')}.png`), png)));
  await page.getByRole('button', { name: 'Verify existing PNGs' }).click();
  await page.getByText('verified at last check', { exact: false }).waitFor();
  const summaryUrl = `${base}/api/projects/proj_ternfall_01/flow/plan/S01E002?view=summary`;
  const beforeRecheck = (await (await page.request.get(summaryUrl)).json()).data.revision;
  const ingestUrl = `${base}/api/projects/proj_ternfall_01/flow/ingest`;
  await page.route(ingestUrl, async route => {
    const committed = await route.fetch(); assert.equal(committed.status(), 200);
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'fixture response lost after verification commit' }) });
  });
  await page.getByRole('button', { name: 'Verify existing PNGs' }).click();
  await page.getByRole('alert').filter({ hasText: 'fixture response lost after verification commit' }).waitFor();
  await page.getByText('verified at last check', { exact: false }).waitFor();
  assert.equal((await (await page.request.get(summaryUrl)).json()).data.revision, beforeRecheck + 2);
  await page.unroute(ingestUrl);
  await fs.unlink(path.join(frameDir, 'frame_00001.png'));
  await page.route(summaryUrl, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'fixture plan reload unavailable' }) }));
  await page.getByRole('button', { name: 'Verify existing PNGs' }).click();
  await page.getByText(/verification state is unknown/i).waitFor({ timeout: 5000 });
  assert.equal(await page.getByText('verified at last check', { exact: false }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Prepare plan', exact: true }).isDisabled(), true);
  await page.unroute(summaryUrl);
  await page.getByRole('button', { name: 'Reload plan', exact: true }).click();
  await page.getByText('not verified', { exact: false }).waitFor();

  // A replacement may commit even if the client receives an error. With the
  // subsequent GET also unavailable, do not offer another blind replacement.
  await page.route(summaryUrl, async route => {
    if (route.request().method() === 'POST') {
      const committed = await route.fetch(); assert.equal(committed.status(), 200);
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'fixture response lost after commit' }) });
    } else await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'fixture plan reload unavailable' }) });
  });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Replace plan', exact: true }).click();
  await page.getByText(/verification state is unknown/i).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole('button', { name: 'Prepare plan', exact: true }).isDisabled(), true);
  await page.unroute(summaryUrl);
  await page.getByRole('button', { name: 'Reload plan', exact: true }).click();
  await page.getByText('not verified', { exact: false }).waitFor();

  const currentSource = (await (await page.request.get(`${base}/api/projects/proj_ternfall_01/episodes/S01E002`)).json()).data;
  const sourceEdit = await page.request.post(`${base}/api/projects/proj_ternfall_01/episodes`, { data: { ...currentSource, logline: 'A changed fixture after planning.' } });
  assert.equal(sourceEdit.status(), 200);
  await page.getByRole('button', { name: 'Reload', exact: true }).click();
  await page.getByText('The episode changed after this plan was prepared.', { exact: false }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Verify existing PNGs' }).isDisabled(), true);
  assert.equal((await page.request.get(`${base}/api/projects/proj_ternfall_01/flow/checkpoint/S01E002`)).status(), 400);

  // No fixture audio exists: the real worker must fail, not fabricate a playable export.
  await page.getByRole('button', { name: 'Queue Local Render', exact: true }).click();
  await page.getByText(/Render did not complete. Inspect local operator CLI status/).waitFor({ timeout: 15_000 });
  const renders = (await (await page.request.get(`${base}/api/projects/proj_ternfall_01/local-renders`)).json()).data;
  const failedRender = renders.find((job: any) => job.episodeId === 'S01E002');
  assert.equal(failedRender.state, 'failed'); assert.equal(failedRender.qc, undefined);
  assert.equal(failedRender.ownerToken, undefined); assert.equal(failedRender.outputPath, undefined);
  assert.ok(!JSON.stringify(failedRender).includes(root));

  await page.getByRole('button', { name: 'Doctor Diagnostics', exact: true }).click();
  await page.getByText(/old browser pseudo-CLI was retired/).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Run', exact: true }).count(), 0);
  const settingsUrl = `${base}/api/settings`;
  await page.route(settingsUrl, async route => {
    const upstream = await route.fetch(); const result = await upstream.json();
    result.data.budgetCaps = { currency: 'USD', perRunCapUsd: 0, monthlyCapUsd: 0 };
    delete result.data.productionTimezone;
    await route.fulfill({ response: upstream, json: result });
  });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('heading', { name: 'Studio Settings' }).waitFor();
  assert.equal(await page.getByLabel('Per-Run Hard Cap').inputValue(), '0');
  assert.equal(await page.getByLabel('Per-Episode Hard Cap').inputValue(), '');
  assert.equal(await page.getByLabel('Monthly Project Cap').inputValue(), '0');
  assert.equal(await page.getByLabel('Production timezone').inputValue(), '');
  await page.unroute(settingsUrl);
  await page.getByRole('button', { name: 'Research Room', exact: true }).click();
  await page.getByText('URL syntax and literal checks', { exact: true }).waitFor();
  await page.getByText('Independent fact-checking unavailable', { exact: true }).waitFor();

  const created = await page.request.post(`${base}/api/projects`, { data: { name: 'Second Browser Project', description: 'isolated test fixture' } });
  assert.equal(created.status(), 201);
  const secondProject = (await created.json()).data;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('select[aria-label="Active project"] option').filter({ hasText: 'Second Browser Project' }).waitFor({ state: 'attached' });
  await page.getByLabel('Active project').selectOption(secondProject.id);
  const secondBible = (await (await page.request.get(`${base}/api/projects/${secondProject.id}/series`)).json()).data;
  assert.deepEqual(secondBible.characters, []); assert.deepEqual(secondBible.rules, []); assert.doesNotMatch(JSON.stringify(secondBible), /Rhea|Mara|South Gate|Ternfall/i);
  await page.getByRole('button', { name: 'Ternfall roadmap', exact: true }).click();
  await page.getByText('No roadmap for this project').waitFor();
  await page.getByRole('button', { name: 'Episode Board', exact: true }).click();
  await page.getByRole('button', { name: 'Create Episode Card' }).click();
  await page.getByPlaceholder('e.g. Sluice Gate Nine').fill('Second Project Draft');
  await page.getByRole('button', { name: 'Create Card', exact: true }).click();
  await page.getByText('Second Project Draft', { exact: true }).waitFor();
  const secondEpisodes = await (await page.request.get(`${base}/api/projects/${secondProject.id}/episodes`)).json();
  assert.equal(secondEpisodes.data.length, 1);
  assert.equal(secondEpisodes.data[0].seriesId, secondProject.activeSeriesId);
  const originalEpisodes = await (await page.request.get(`${base}/api/projects/proj_ternfall_01/episodes`)).json();
  assert.equal(originalEpisodes.data.length, 3);
  await page.getByLabel('Active project').selectOption('proj_ternfall_01');
  await page.getByText('Browser Fixture Episode', { exact: true }).waitFor();
  assert.equal(await page.getByText('Second Project Draft', { exact: true }).count(), 0);

  await page.setViewportSize({ width: 390, height: 844 });
  const navigationOpener = page.getByRole('button', { name: 'Open navigation' });
  assert.equal(await navigationOpener.getAttribute('aria-expanded'), 'false');
  await navigationOpener.click();
  assert.equal(await page.locator('button[aria-label="Open navigation"]').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('main').evaluate(element => !!element.closest('[inert]')), true);
  const drawer = page.getByRole('dialog', { name: 'Navigation' });
  const closeMenu = drawer.getByRole('button', { name: 'Close navigation', exact: true });
  assert.equal(await closeMenu.evaluate(element => document.activeElement === element), true);
  await page.locator('button[aria-label="Open navigation"]').evaluate(element => (element as HTMLElement).focus());
  assert.equal(await drawer.evaluate(element => element.contains(document.activeElement)), true);
  await page.keyboard.press('Shift+Tab');
  assert.equal(await drawer.evaluate(element => element.contains(document.activeElement)), true);
  await page.keyboard.press('Tab');
  assert.equal(await closeMenu.evaluate(element => document.activeElement === element), true);
  await page.getByRole('button', { name: 'Video Essay sample', exact: true }).click();
  await page.getByRole('heading', { name: 'Video Essay example' }).waitFor();
  await page.getByText(/Legacy Video Essay render and speech-script exports are retired/).waitFor();
  await navigationOpener.click();
  await page.keyboard.press('Escape');
  assert.equal(await navigationOpener.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('main').evaluate(element => !!element.closest('[inert]')), false);
  assert.equal(await navigationOpener.evaluate(element => document.activeElement === element), true);
  assert.equal(await page.getByRole('dialog', { name: 'Navigation' }).count(), 0);
  await navigationOpener.click();
  await page.getByRole('dialog', { name: 'Navigation' }).getByRole('button', { name: 'Close navigation', exact: true }).click();
  assert.equal(await navigationOpener.getAttribute('aria-expanded'), 'false');
  assert.equal(await navigationOpener.evaluate(element => document.activeElement === element), true);
  await navigationOpener.click();
  await page.locator('button[aria-label="Dismiss navigation overlay"]').click({ position: { x: 350, y: 20 } });
  assert.equal(await navigationOpener.getAttribute('aria-expanded'), 'false');
  assert.equal(await navigationOpener.evaluate(element => document.activeElement === element), true);
  await navigationOpener.click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForFunction(() => document.querySelector('[aria-label="Open navigation"]')?.getAttribute('aria-expanded') === 'false');
  assert.equal(await page.getByRole('dialog', { name: 'Navigation' }).count(), 0);
  assert.equal(await page.locator('#studio-navigation [aria-current="page"]').evaluate(element => document.activeElement === element), true);
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
  assert.ok(dimensions.document <= dimensions.viewport + 1, `Mobile layout overflows viewport: ${JSON.stringify(dimensions)}`);
  assert.deepEqual(runtimeErrors, []);
  assert.deepEqual(externalRequests, []);
  console.log('Browser smoke passed: create/duplicate/check/edit, version preservation, Flow lost-response recovery and stale provenance, failed-render diagnostics, zero/unavailable settings, retired pseudo-CLI, advisory research labels, project isolation, mobile focus and no external page requests.');
} catch (error) {
  if (page) console.error('Current page text:', (await page.locator('body').innerText().catch(() => '')).slice(0, 5000));
  console.error('Isolated server output:', serverOutput.slice(-5000));
  throw error;
} finally {
  await browser?.close();
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
  await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))]);
  if (server.exitCode === null && server.signalCode === null) { server.kill('SIGKILL'); await exited; }
  await fs.rm(root, { recursive: true, force: true });
}
