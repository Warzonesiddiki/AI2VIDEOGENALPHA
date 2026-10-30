import { assertIdentifier } from './paths.ts';

export interface EpisodeCreation {
  idempotencyKey: string;
  workingTitle: string;
  logline: string;
  physicalObjective: string;
}

export function validateEpisodeCreation(input: unknown): EpisodeCreation {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid episode creation request');
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !['idempotencyKey', 'workingTitle', 'logline', 'physicalObjective'].includes(key))) throw new Error('Unsupported episode creation field');
  assertIdentifier(value.idempotencyKey);
  const text = (name: string, maximum: number, required = false): string => {
    const field = value[name] === undefined ? '' : value[name];
    if (typeof field !== 'string' || field.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(field) || (required && !field.trim())) throw new Error(`Invalid ${name}`);
    return field.trim();
  };
  return { idempotencyKey: value.idempotencyKey, workingTitle: text('workingTitle', 200, true), logline: text('logline', 2000), physicalObjective: text('physicalObjective', 2000) };
}

export function validateVariantTitle(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\u0000-\u001f\u007f]/.test(value)) throw new Error('Invalid variant title');
  return value.trim();
}
