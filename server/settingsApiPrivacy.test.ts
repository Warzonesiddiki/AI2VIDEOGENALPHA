import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StorageEngine } from './storage.ts';
import { configEditHandler, settingsReadHandler } from './configEdits.ts';

async function fixture(t: any) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ternfall-settings-privacy-'));
  const store = new StorageEngine(root); await store.init();
  const app = express(); app.use(express.json()); app.get('/settings', settingsReadHandler(store)); app.put('/settings', configEditHandler(store, 'settings'));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); store.close(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, store, base: `http://127.0.0.1:${address.port}/settings` };
}
const put = (url: string, body: unknown) => fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('settings GET and PUT return only explicitly public fields without modifying private legacy data', async t => {
  const { root, store, base } = await fixture(t); const file = path.join(root, 'settings.json');
  const initial = await store.getSettings();
  const legacy = { ...initial, productionRoot: '/private-fixture/host/path', privateApiKey: 'private-fixture-top-token',
    providerConfigs: { sample: { apiKey: 'private-fixture-provider-token', verificationStatus: 'verified', checkedDate: '2020-01-01T00:00:00.000Z', nested: { password: 'private-fixture-password' } } },
    budgetCaps: { perRunCapUsd: 0, perEpisodeCapUsd: 85, monthlyCapUsd: 350, currency: 'USD', internal: 'private-fixture-budget-secret' },
  };
  await store.atomicWriteJson(file, legacy);
  const get = await fetch(base); assert.equal(get.status, 200); assert.equal(get.headers.get('cache-control'), 'no-store');
  const read = await get.json(); assert.equal(read.ok, true); assert.equal(read.data.budgetCaps.perRunCapUsd, 0);
  assert.deepEqual(Object.keys(read.data).sort(), ['budgetCaps', 'dataNoticeAccepted', 'dataNoticeVersion', 'productionTimezone', 'revision']);
  assert.deepEqual(Object.keys(read.data.budgetCaps).sort(), ['currency', 'monthlyCapUsd', 'perEpisodeCapUsd', 'perRunCapUsd']);
  assert.ok(!JSON.stringify(read).includes('private-fixture')); assert.equal(read.data.providerConfigs, undefined); assert.equal(read.data.productionRoot, undefined);
  const changed = await put(base, { revision: read.data.revision, productionTimezone: 'Asia/Kolkata' });
  assert.equal(changed.status, 200); assert.equal(changed.headers.get('cache-control'), 'no-store');
  const result = await changed.json(); assert.equal(result.data.productionTimezone, 'Asia/Kolkata');
  assert.equal(result.data.budgetCaps.perRunCapUsd, 0); assert.ok(!JSON.stringify(result).includes('private-fixture'));
  const accepted = await put(base, { revision: result.data.revision, dataNoticeAccepted: true, dataNoticeVersion: result.data.dataNoticeVersion });
  assert.equal(accepted.status, 200); const consent = (await accepted.json()).data;
  assert.equal(consent.dataNoticeAccepted, true); assert.ok(Number.isFinite(Date.parse(consent.noticeAcceptedDate)));
  assert.ok(!JSON.stringify(consent).includes('private-fixture'));
  const stored = await store.readJson<any>(file, null);
  assert.equal(stored.privateApiKey, legacy.privateApiKey); assert.deepEqual(stored.providerConfigs, legacy.providerConfigs); assert.deepEqual(stored.budgetCaps, legacy.budgetCaps);
});

test('settings projection does not turn invalid or missing cap data into fabricated USD values', async t => {
  const { root, store, base } = await fixture(t); const file = path.join(root, 'settings.json'); const initial = await store.getSettings();
  await store.atomicWriteJson(file, { ...initial, productionTimezone: 'private-invalid-timezone', budgetCaps: { currency: 'EUR', perRunCapUsd: 40, privateNested: 'private-cap' } });
  let result = (await (await fetch(base)).json()).data;
  assert.equal(result.budgetCaps, undefined); assert.equal(result.productionTimezone, undefined); assert.ok(!JSON.stringify(result).includes('private-'));
  await store.atomicWriteJson(file, { ...initial, budgetCaps: { currency: 'USD', perRunCapUsd: { token: 'private-token' }, perEpisodeCapUsd: -1, monthlyCapUsd: 0 } });
  result = (await (await fetch(base)).json()).data;
  assert.deepEqual(result.budgetCaps, { currency: 'USD', monthlyCapUsd: 0 }); assert.ok(!JSON.stringify(result).includes('private-token'));
  const malformed = { ...initial, revision: null }; await store.atomicWriteJson(file, malformed);
  const before = await store.readJson(file, null);
  const invalid = await fetch(base); assert.equal(invalid.status, 500); assert.equal(invalid.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await store.readJson(file, null), before);
});
