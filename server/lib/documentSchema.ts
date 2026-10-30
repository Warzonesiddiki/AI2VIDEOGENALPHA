import { assertIdentifier } from './paths.ts';

/**
 * Runtime document schemas with one recursive walker used for:
 * - HTTP read projections (unknown keys are never serialized),
 * - write validation for every caller, trusted or not (unknown keys are
 *   rejected, so no caller can invent model-less "legacy" data),
 * - storage-side legacy preservation (stored-only unknown keys survive edits).
 *
 * Policy: known fields must match their documented shape and range; malformed
 * structure fails closed. Unknown keys are model-less legacy data: preserved on
 * disk, never sent to browsers. Policy ranges (pacing, budgets) stay in the
 * write handlers; this layer checks shape and generous numeric ceilings so the
 * API cannot store what it rejects on read.
 */

// Generous numeric ceilings: they reject absurd/unbounded values without
// straying into narrative policy (pacing stays 80–220 in the write handlers).
const MAX_COUNTER = 1_000_000;        // seasons, episode/beat/version counters
const MAX_SECONDS = 1_000_000;        // durations and target seconds (~11.5 days)
const MAX_WORDS = 10_000_000;         // word counters
const MAX_WPM = 1_000;                // schema ceiling; handlers enforce 80–220
const MAX_AGE = 10_000;               // character ages (fictional beings included)
const MAX_RUNTIME_MINUTES = 10_000;   // episode runtime target (~1 week)

export type SchemaNode =
  | { t: 'id' }
  | { t: 'text'; max: number }
  | { t: 'num'; int?: boolean; min?: number; max?: number }
  | { t: 'bool' }
  | { t: 'date' }
  | { t: 'enum'; values: readonly string[] }
  | { t: 'literalTrue' }
  | { t: 'strArray'; max: number; itemMax: number }
  | { t: 'array'; of: ObjectNode; max: number; match: 'id' | 'versionNumber' | 'index' }
  | { t: 'object'; fields: Record<string, FieldNode> };

export interface ObjectNode { t: 'object'; fields: Record<string, FieldNode> }
export interface FieldNode { node: SchemaNode; optional: boolean }

const req = (node: SchemaNode): FieldNode => ({ node, optional: false });
const opt = (node: SchemaNode): FieldNode => ({ node, optional: true });

const id = { t: 'id' } as const;
const date = { t: 'date' } as const;
const bool = { t: 'bool' } as const;
const num = (extra: { int?: boolean; min?: number; max?: number } = {}) => ({ t: 'num', ...extra }) as const;
const text = (max: number) => ({ t: 'text', max }) as const;
const enumOf = (...values: string[]) => ({ t: 'enum', values }) as const;
const strArray = (max = 1000, itemMax = 20_000) => ({ t: 'strArray', max, itemMax }) as const;
const obj = (fields: Record<string, FieldNode>): ObjectNode => ({ t: 'object', fields });
const arrayOf = (of: ObjectNode, match: 'id' | 'versionNumber' | 'index', max = 2000) => ({ t: 'array', of, match, max }) as const;

const revisionField = opt(num({ int: true, min: 0, max: Number.MAX_SAFE_INTEGER }));

// ---------------------------------------------------------------------------
// EpisodeCard
// ---------------------------------------------------------------------------

const beatAnchorNode = obj({
  timestampStart: req(text(64)), timestampEnd: req(text(64)), beatName: req(text(500)),
  dramaticFunction: req(text(5000)), dialogueOrNarrationSnippet: req(text(20_000)),
});

const scriptVersionNode = obj({
  versionNumber: req(num({ int: true, min: 1, max: MAX_COUNTER })), author: opt(text(500)),
  fullNarrationText: req(text(100_000)), wordCount: opt(num({ min: 0, max: MAX_WORDS })), spokenWordCount: opt(num({ min: 0, max: MAX_WORDS })),
  estimatedDurationSeconds: req(num({ min: 0, max: MAX_SECONDS })), targetWpm: req(num({ min: 0, max: MAX_WPM })),
  actualVoiceDurationSeconds: opt(num({ min: 0, max: MAX_SECONDS })),
  beats: req(arrayOf(beatAnchorNode, 'index')), pronunciationNotes: req(arrayOf(obj({
    term: req(text(500)), guide: req(text(2000)),
  }), 'index')),
  isApproved: req(bool), approvalNotes: opt(text(20_000)), approvedBy: opt(text(500)), createdAt: req(date),
});

const outlineBeatNode = obj({
  beatNumber: req(num({ int: true, min: 1, max: MAX_COUNTER })), name: req(text(500)), targetSeconds: opt(num({ min: 0, max: MAX_SECONDS })),
  visualDescription: opt(text(20_000)), spokenDialogueSnippet: opt(text(20_000)),
  soundDesignCues: opt(strArray(1000, 2000)), continuityClues: opt(strArray(1000, 2000)),
});

export const EPISODE_SCHEMA: ObjectNode = obj({
  revision: revisionField, id: req(id), dbId: req(id), projectId: req(id), seriesId: req(id),
  season: opt(num({ int: true, min: 0, max: MAX_COUNTER })), seasonNumber: opt(num({ int: true, min: 0, max: MAX_COUNTER })),
  episodeNumber: opt(num({ int: true, min: 0, max: MAX_COUNTER })), episodeNumberInArc: opt(num({ int: true, min: 0, max: MAX_COUNTER })),
  episodeNumberInSeries: opt(num({ int: true, min: 0, max: MAX_COUNTER })), arcNumber: req(num({ int: true, min: 0, max: MAX_COUNTER })),
  workingTitle: req(text(200)), logline: req(text(2000)), premiseHook: opt(text(20_000)),
  targetAudiencePersona: opt(text(20_000)), centralDramaticQuestion: opt(text(20_000)),
  timeline: opt(obj({
    storyDate: req(text(2000)), elapsedTime: req(text(2000)),
    confidence: req(enumOf('confirmed', 'approximate', 'unknown')),
  })),
  timelineAnchor: opt(text(20_000)), charactersPresent: opt(strArray()), physicalLocations: opt(strArray()),
  settingIds: opt(strArray(1000, 200)), povCharacterIds: opt(strArray(1000, 200)),
  aPlot: opt(text(20_000)), bPlot: opt(text(20_000)), physicalObjective: opt(text(20_000)),
  humanConflict: opt(text(20_000)), characterTurn: opt(text(20_000)), majorDecision: opt(text(20_000)),
  consequence: opt(text(20_000)), clueOrPayoff: opt(text(20_000)), endingBeat: opt(text(20_000)),
  beats: opt(arrayOf(outlineBeatNode, 'index')),
  status: req(enumOf('planned', 'outline_ready', 'script_draft', 'script_approved', 'scene_plan_ready',
    'assets_generating', 'rendered', 'qc_passed', 'packaged', 'upload_ready', 'archived')),
  scriptVersions: req(arrayOf(scriptVersionNode, 'versionNumber', 1000)), activeScriptVersionIndex: req(num({ int: true, min: 0, max: MAX_COUNTER })),
  visualMotifs: opt(strArray()), factualClaimIds: opt(strArray(1000, 200)), fictionalRuleIds: opt(strArray(1000, 200)),
  staleDownstreamAssets: opt(bool), provenanceSourceEpisodeId: opt(id),
  createdAt: req(date), updatedAt: req(date),
});

// Unmodeled legacy keys (for example historical storyboard prompt caches) are
// preserved on disk by mergeStoredExtras but are not part of the HTTP model.

// ---------------------------------------------------------------------------
// SeriesBible
// ---------------------------------------------------------------------------

const visualBibleNode = obj({
  medium: req(text(2000)), palette: req(strArray(200, 500)), silhouetteRules: req(text(10_000)),
  lightingRules: req(text(10_000)), bannedStyles: req(strArray(200, 500)),
});

const worldRuleNode = obj({
  id: req(id), category: req(enumOf('infection', 'infrastructure', 'signal_pulse', 'society', 'geography')),
  title: req(text(2000)), fictionalRule: req(text(10_000)), isFictional: req({ t: 'literalTrue' }),
  narrativeImplications: req(text(10_000)), prohibitedMisconceptions: req(text(10_000)),
});

const characterSheetNode = obj({
  id: req(id), name: req(text(2000)), age: req(num({ min: 0, max: MAX_AGE })), role: req(text(2000)),
  visualAnchor: req(text(10_000)), psychologicalWound: req(text(10_000)), knowledgeScope: req(text(10_000)),
  voiceStyle: req(text(10_000)), appearancePromptGuidance: req(text(10_000)),
  currentStatus: req(enumOf('active', 'missing', 'injured', 'deceased')), lastKnownLocation: req(text(2000)),
});

const locationSheetNode = obj({
  id: req(id), name: req(text(2000)), district: req(text(2000)), environmentalDescription: req(text(10_000)),
  waterStatus: req(enumOf('flooded', 'low_pressure', 'dry', 'submerged')),
  infrastructureNotes: req(text(10_000)), visualPalette: req(text(10_000)),
});

const factionSheetNode = obj({
  id: req(id), name: req(text(2000)), leaderOrKeyRep: req(text(2000)), ideology: req(text(10_000)),
  materialInterests: req(text(10_000)), relationshipToSouthGate: req(text(10_000)),
});

export const SERIES_SCHEMA: ObjectNode = obj({
  revision: revisionField, id: req(id), projectId: req(id), seriesTitle: req(text(10_000)), logline: req(text(10_000)),
  targetRuntimeMinutes: req(num({ min: 0, max: MAX_RUNTIME_MINUTES })), targetWpm: req(num({ min: 0, max: MAX_WPM })), intendedAudience: req(text(10_000)),
  primaryLanguage: req(text(10_000)), locale: req(text(10_000)), visualBible: req(visualBibleNode),
  rules: req(arrayOf(worldRuleNode, 'id')), characters: req(arrayOf(characterSheetNode, 'id')),
  locations: req(arrayOf(locationSheetNode, 'id')), factions: req(arrayOf(factionSheetNode, 'id')),
  originalityDeclarations: req(strArray(1000, 20_000)), createdAt: req(date), updatedAt: req(date),
});

// ---------------------------------------------------------------------------
// ResearchClaim
// ---------------------------------------------------------------------------

export const RESEARCH_SCHEMA: ObjectNode = obj({
  revision: revisionField, id: req(id), projectId: req(id), claimText: req(text(10_000)), isFictionalLore: req(bool),
  sourceUrl: opt(text(2048)), sourceTitle: opt(text(1000)), publisher: opt(text(1000)), accessDate: opt(text(10)),
  evidenceExcerpt: opt(text(30_000)),
  verificationStatus: req(enumOf('verified', 'unverified', 'disputed', 'fictional_rule')),
  // Deliberately range-less here: writes must submit zero confidence
  // (validateResearchClaim), and reads normalize any stored legacy value to the
  // single unreviewed view instead of failing whole listings closed.
  confidenceScore: req(num({ min: 0 })), factCheckerNotes: req(text(10_000)), humanApproved: req(bool),
  relatedEpisodeIds: req(strArray(100, 200)),
  createdAt: req(date), updatedAt: req(date),
});

// ---------------------------------------------------------------------------
// Walker
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function matchItem(match: 'id' | 'versionNumber' | 'index', stored: unknown[], incoming: unknown, index: number): unknown {
  if (match === 'index') return stored[index];
  const key = match;
  if (!isPlainObject(incoming)) return undefined;
  return stored.find(item => isPlainObject(item) && item[key] === incoming[key]);
}

function projectField(node: SchemaNode, value: unknown, label: string, mode: 'drop' | 'reject'): unknown {
  switch (node.t) {
    case 'id':
      try { assertIdentifier(value as string); } catch { throw new Error(`Invalid stored ${label}`); }
      return value;
    case 'text':
      if (typeof value !== 'string' || value.length > node.max) throw new Error(`Invalid stored ${label}`);
      return value;
    case 'num': {
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid stored ${label}`);
      if (node.int && !Number.isInteger(value)) throw new Error(`Invalid stored ${label}`);
      if (node.min !== undefined && value < node.min) throw new Error(`Invalid stored ${label}`);
      if (node.max !== undefined && value > node.max) throw new Error(`Invalid stored ${label}`);
      return value;
    }
    case 'bool':
      if (typeof value !== 'boolean') throw new Error(`Invalid stored ${label}`);
      return value;
    case 'date':
      if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid stored ${label}`);
      return value;
    case 'enum':
      if (typeof value !== 'string' || !node.values.includes(value)) throw new Error(`Invalid stored ${label}`);
      return value;
    case 'literalTrue':
      if (value !== true) throw new Error(`Invalid stored ${label}`);
      return value;
    case 'strArray': {
      if (!Array.isArray(value) || value.length > node.max) throw new Error(`Invalid stored ${label}`);
      return value.map((item, index) => {
        if (typeof item !== 'string' || item.length > node.itemMax) throw new Error(`Invalid stored ${label}[${index}]`);
        return item;
      });
    }
    case 'array': {
      if (!Array.isArray(value) || value.length > node.max) throw new Error(`Invalid stored ${label}`);
      return value.map((item, index) => projectObject(node.of, item, `${label}[${index}]`, mode));
    }
    case 'object':
      return projectObject(node, value, label, mode);
  }
}

function projectObject(node: ObjectNode, value: unknown, label: string, mode: 'drop' | 'reject'): Record<string, unknown> {
  if (!isPlainObject(value)) throw new Error(`Invalid stored ${label}`);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    if (value[key] === undefined) continue;
    const field = node.fields[key];
    if (!field) {
      if (mode === 'reject') throw new Error(`Unsupported field: ${key}`);
      continue;
    }
    result[key] = projectField(field.node, value[key], `${label}.${key}`, mode);
  }
  for (const [key, field] of Object.entries(node.fields)) {
    if (!field.optional && !(key in result)) throw new Error(`Missing stored ${label}.${key}`);
  }
  return result;
}

/** HTTP read projection: unknown keys dropped, known keys shape-checked. */
export function projectDocument<T>(node: ObjectNode, value: unknown, label: string): T {
  return projectObject(node, value, label, 'drop') as T;
}

/** HTTP write validation: unknown keys rejected at any depth. */
export function validateDocument(node: ObjectNode, value: unknown, label: string): void {
  projectObject(node, value, label, 'reject');
}

/** Value-level strict validation (for partial updates of nested fields). */
export function validateValue(node: SchemaNode, value: unknown, label: string): void {
  projectField(node, value, label, 'reject');
}

/** Nested series field nodes for partial-update validation and preservation. */
export function seriesFieldNode(key: 'visualBible' | 'rules' | 'characters' | 'locations' | 'factions'): SchemaNode {
  return SERIES_SCHEMA.fields[key].node;
}

/**
 * Merge legacy extras from stored records into an incoming (already projected)
 * value. Incoming wins for every known key and any key it carries; stored-only
 * unknown keys survive edits, recursively, including matched array items.
 */
export function mergeStoredExtras(node: SchemaNode, stored: unknown, incoming: unknown): unknown {
  switch (node.t) {
    case 'object': {
      if (!isPlainObject(stored) || !isPlainObject(incoming)) return incoming;
      const result: Record<string, unknown> = { ...incoming };
      for (const [key, storedValue] of Object.entries(stored)) {
        const field = (node as ObjectNode).fields[key];
        if (!field) {
          if (!(key in result)) result[key] = storedValue;
          continue;
        }
        if (key in incoming) result[key] = mergeStoredExtras(field.node, storedValue, incoming[key]);
      }
      return result;
    }
    case 'array': {
      if (!Array.isArray(stored) || !Array.isArray(incoming)) return incoming;
      return incoming.map((item, index) => {
        const counterpart = matchItem(node.match, stored, item, index);
        return counterpart === undefined ? item : mergeStoredExtras(node.of, counterpart, item);
      });
    }
    default:
      return incoming;
  }
}
