import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('validation workflow has limited permissions, immutable action pins and no publish path', t => {
  if (!fs.existsSync('.github/workflows/validation.yml')) {
    t.skip('workflow file absent from this checkout (push pending GitHub workflows permission); see docs/readiness-gaps-2026-10-30.md');
    return;
  }
  const workflow = fs.readFileSync('.github/workflows/validation.yml', 'utf8');
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /package-manager-cache:\s*false/);
  const uses = [...workflow.matchAll(/^\s*- uses:\s*([^\s#]+)/gm)].map(match => match[1]);
  assert.equal(uses.length, 2);
  assert.ok(uses.every(value => /@(\w{40})$/.test(value) && /@[0-9a-f]{40}$/.test(value)));
  assert.doesNotMatch(workflow, /pull_request_target|secrets\.|id-token:\s*write|contents:\s*write|npm publish|gh release|git push/i);
  assert.match(workflow, /npm ci/); assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm test/); assert.match(workflow, /npm run build/);
  assert.match(workflow, /npm run test:browser/); assert.match(workflow, /sha256sum -c/);
  assert.match(workflow, /22\.13\.0/); assert.match(workflow, /22\.22\.3/);
});
