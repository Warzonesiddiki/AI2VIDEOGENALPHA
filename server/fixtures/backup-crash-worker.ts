import fs from 'node:fs/promises';
import { createFullBackup, stageFullRestore } from '../lib/backupRecovery.ts';

const original = fs.open.bind(fs);
(fs as any).open = async (...args: Parameters<typeof fs.open>) => {
  const marker = process.env.TEST_BACKUP_MODE === 'stage' ? '/restores/' : '/payload/projects/';
  if (String(args[0]).includes(marker) && String(args[0]).endsWith('frame_00001.png')) {
    process.send?.('copy-started');
    // Parent deliberately terminates this isolated worker before completion.
    await new Promise<void>(() => { setInterval(() => {}, 60_000); });
  }
  return original(...args);
};
if (process.env.TEST_BACKUP_MODE === 'stage') await stageFullRestore(process.env.TEST_BACKUP_ROOT!, process.env.TEST_BUNDLE_ID!, { confirmIsolated: true });
else await createFullBackup(process.env.TEST_BACKUP_ROOT!, { confirmStopped: true });
