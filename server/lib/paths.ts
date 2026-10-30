import fs from 'node:fs';
import path from 'node:path';

export { assertIdentifier } from '../../src/core/validation.ts';

/** Reject lexical escapes and symlinks, including symlink ancestors of new files. */
export function safePath(root: string, target: string): string {
  if (target.includes('\\') || target.includes('\0')) throw new Error('Security Violation: invalid path');
  const base = path.resolve(root);
  const resolved = path.resolve(base, target);
  const relative = path.relative(base, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Security Violation: path outside authorized project root');
  }
  let current = resolved;
  while (true) {
    try {
      if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Security Violation: symlink paths are prohibited');
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return resolved;
}

export const productionRoot = path.resolve(process.cwd(), 'data', 'production_root');
export function scriptOutput(name: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('Security Violation: invalid script name');
  const dir = safePath(productionRoot, 'scripts');
  fs.mkdirSync(dir, { recursive: true });
  return safePath(productionRoot, `scripts/${name}`);
}
