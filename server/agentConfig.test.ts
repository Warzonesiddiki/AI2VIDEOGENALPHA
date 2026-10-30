import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const skillsDir = path.join(root, '.opencode', 'skills');

test('OpenCode 1 config uses conservative native permission rules, not unsupported pseudo-policy keys', async () => {
  const config = JSON.parse(await fs.readFile(path.join(root, 'opencode.json'), 'utf8'));
  assert.equal(config.permissions, undefined); assert.equal(config.project, undefined);
  assert.equal(config.permission['*'], 'ask'); assert.equal(config.permission.edit, 'ask');
  assert.equal(config.permission.bash['*'], 'ask'); assert.equal(config.permission.bash['sudo *'], 'deny');
  assert.equal(config.permission.read['*.env'], 'deny'); assert.equal(config.permission.skill, 'allow');
});

test('project-local skills have unique discoverable names and required descriptions', async () => {
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const names = new Set<string>();
  for (const entry of entries.filter(item => item.isDirectory() && item.name !== 'licenses')) {
    const skill = await fs.readFile(path.join(skillsDir, entry.name, 'SKILL.md'), 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(skill);
    assert.ok(match, `missing frontmatter: ${entry.name}`);
    const name = /^name:\s*["']?([a-z0-9-]+)["']?\s*$/m.exec(match[1])?.[1];
    const description = /^description:\s*(.+)$/m.exec(match[1])?.[1];
    assert.equal(name, entry.name); assert.match(entry.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(description && description.length <= 1024, entry.name);
    assert.ok(!names.has(entry.name), `duplicate skill ${entry.name}`); names.add(entry.name);
  }
  assert.ok(names.size >= 32); assert.ok(names.has('ternfall-storage-integrity'));
  for (const name of ['awesome-accessibility-audit', 'awesome-database-audit', 'awesome-performance-audit', 'awesome-dependency-audit', 'awesome-architecture-audit', 'awesome-claims-audit', 'node-typescript', 'node-testing', 'playwright-frontend']) assert.ok(names.has(name), name);
  assert.ok(names.has('variant-analysis')); assert.ok(names.has('verification-before-completion'));
});

test('pinned upstream skill files match the recorded snapshot digests', async () => {
  const manifest = await fs.readFile(path.join(skillsDir, 'licenses', 'upstream-SHA256SUMS.txt'), 'utf8');
  const rows = manifest.trim().split('\n'); assert.ok(rows.length >= 20);
  for (const row of rows) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(row); assert.ok(match, row);
    const relative = match[2]; assert.ok(!relative.startsWith('/') && !relative.split('/').includes('..'));
    const bytes = await fs.readFile(path.join(skillsDir, relative));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), match[1], relative);
  }
});

test('custom agents declare descriptions and retired produce command does not offer execution', async () => {
  const dir = path.join(root, '.opencode', 'agents');
  for (const name of ['continuity-reviewer', 'production-operator', 'story-planner']) {
    const text = await fs.readFile(path.join(dir, `${name}.md`), 'utf8');
    assert.match(text, /^---\r?\ndescription: .+\r?\nmode: subagent\r?\n/);
  }
  const reviewer = await fs.readFile(path.join(dir, 'continuity-reviewer.md'), 'utf8');
  assert.match(reviewer, /edit: deny/); assert.match(reviewer, /bash: deny/);
  const command = await fs.readFile(path.join(root, '.opencode', 'commands', 'episode-produce.md'), 'utf8');
  assert.match(command, /disabled/i); assert.doesNotMatch(command, /npm run studio -- episode produce/);
});
