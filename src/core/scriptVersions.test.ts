import test from 'node:test';
import assert from 'node:assert/strict';
import { nextScriptVersionNumber } from './scriptVersions.ts';

test('script version identity advances above the actual high-water mark', () => {
  assert.equal(nextScriptVersionNumber([]), 1);
  assert.equal(nextScriptVersionNumber([{ versionNumber: 1 }, { versionNumber: 7 }, { versionNumber: 3 }]), 8);
  for (const versions of [[{ versionNumber: 1 }, { versionNumber: 1 }], [{ versionNumber: -1 }], [{ versionNumber: 1.5 }], [{ versionNumber: Number.MAX_SAFE_INTEGER }]]) {
    assert.throws(() => nextScriptVersionNumber(versions));
  }
});
