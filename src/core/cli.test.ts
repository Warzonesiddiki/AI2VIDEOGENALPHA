import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSafeProjectPath } from '../../bin/studio.ts';
import path from 'node:path';

test('validateSafeProjectPath: rejects path traversal outside project root', () => {
  const allowedRoot = '/app/applet/data/production_root/projects/proj_ternfall_01';

  // Allowed child path
  const safePath = validateSafeProjectPath('episodes/S01E001.json', allowedRoot);
  assert.equal(safePath, path.resolve(allowedRoot, 'episodes/S01E001.json'));

  // Disallowed path traversal attempt (..)
  assert.throws(() => {
    validateSafeProjectPath('../../../etc/passwd', allowedRoot);
  }, /Security Violation/);

  assert.throws(() => {
    validateSafeProjectPath('..', allowedRoot);
  }, /Security Violation/);
});
