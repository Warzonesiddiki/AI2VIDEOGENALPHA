import type { ScriptVersion } from '../types/index.ts';

/** Fail closed on malformed/duplicate historical version numbers; never guess an identity. */
export function nextScriptVersionNumber(versions: ReadonlyArray<Pick<ScriptVersion, 'versionNumber'>>): number {
  if (!Array.isArray(versions)) throw new Error('Invalid script version list');
  const used = new Set<number>();
  let high = 0;
  for (const version of versions) {
    const number = version?.versionNumber;
    if (!Number.isSafeInteger(number) || number < 1 || used.has(number)) throw new Error('Invalid or duplicate script version numbers; reconcile before saving');
    used.add(number); high = Math.max(high, number);
  }
  if (!Number.isSafeInteger(high + 1)) throw new Error('Script version numbering exhausted');
  return high + 1;
}
