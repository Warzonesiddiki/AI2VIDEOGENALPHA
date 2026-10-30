import { arcCard, validateArcExpansion } from './lib/arcExpansion.ts';
import { assertUniqueEpisodeIdentities, episodeHighWater, episodeId, episodeSeason } from './lib/episodeAllocation.ts';
import { validateEpisodeCreation, validateVariantTitle } from './lib/episodeCreation.ts';
import { DATA_NOTICE_VERSION } from '../src/core/dataNotice.ts';
import { settingsView, type DataNoticeEvent } from './lib/dataNotice.ts';
import { validateProjectText } from '../src/core/projects.ts';
import { validateResearchClaim, unreviewedResearchClaim } from './lib/researchClaims.ts';
import { recomputeFlowSummary, isFlowBatchVerified } from '../src/core/flow.ts';
import { EpisodeSourceConflict, IdempotencyConflict, RevisionConflict, assertRevision, nextRevision } from './lib/conflicts.ts';
import { RequestError, requestValidationError } from './lib/requestErrors.ts';
import { randomUUID } from 'node:crypto';
import { SpendLedger, type ReserveSpend, type ReservationState } from './lib/spendLedger.ts';
import { DocumentStore } from './lib/documents.ts';
import { isDeepStrictEqual, promisify } from 'node:util';
import { calculateWordCount } from '../src/core/rules.ts';
import { nextScriptVersionNumber } from '../src/core/scriptVersions.ts';
import { execFile } from 'node:child_process';
import { mediaBinary } from './lib/mediaProcess.ts';
import { safePath, assertIdentifier } from './lib/paths.ts';
import { EPISODE_SCHEMA, RESEARCH_SCHEMA, mergeStoredExtras, seriesFieldNode, validateDocument, validateValue } from './lib/documentSchema.ts';
import { publicResearchClaim } from './lib/publicDocuments.ts';
/**
 * Ternfall Studio - Server Storage Engine
 * Local-first SQLite metadata with atomic document updates, legacy JSON import and diagnostics.
 * Adheres strictly to Master Project Rules, Matrix 15, and Build Protocol 14.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  ProjectMetadata,
  SeriesBible,
  EpisodeCard,
  CanonEvent,
  ResearchClaim,
  GenerationJob,
  YouTubePackage,
  AutoproduceRun,
  SystemDiagnostics,
  SpendApprovalGrant,
  ArcRoadmapItem,
  GoogleFlowPlan,
} from '../src/types/index.ts';
import { ALL_100_ARCS_ROADMAP, DEFAULT_SERIES_BIBLE, PILOT_EPISODE_CARD } from './seedData.ts';

export interface EpisodeSeriesReconciliationEvent {
  id: string;
  kind: 'apply' | 'undo';
  episodeId: string;
  fromSeriesId: string;
  toSeriesId: string;
  beforeRevision: number;
  afterRevision: number;
  backupFile: string;
  createdAt: string;
  reversesEventId?: string;
}

export class StorageEngine {
  private baseDir: string;
  private isInitialized = false;
  private initialization?: Promise<void>;
  private documents?: DocumentStore;
  private get store(): DocumentStore { return this.documents ??= new DocumentStore(this.baseDir); }
  public close(): void { this.documents?.close(); this.documents = undefined; this.isInitialized = false; this.initialization = undefined; }
  private hasDocument(file: string): boolean { return this.store.has(file) || fs.existsSync(safePath(this.baseDir, file)); }
  private async updateJson<T>(file: string, fallback: T, change: (current: T) => T): Promise<T> {
    safePath(this.baseDir, file);
    return this.store.update(file, fallback, change);
  }

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(baseDir || path.join(process.cwd(), 'data', 'production_root'));
  }

  public getProductionRoot(): string { return this.baseDir; }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (!this.initialization) this.initialization = this.initialize().catch(error => { this.initialization = undefined; throw error; });
    return this.initialization;
  }

  private async initialize(): Promise<void> {
    safePath(this.baseDir, '.');
    try {
      await fs.promises.mkdir(this.baseDir, { recursive: true });
      await fs.promises.mkdir(safePath(this.baseDir, 'projects'), { recursive: true });
      await fs.promises.mkdir(safePath(this.baseDir, 'backups'), { recursive: true });

      this.store.transaction(() => {
        // Import known legacy metadata only, inside one transaction. Never scan assets.
        for (const entry of fs.readdirSync(path.join(this.baseDir, 'projects'), { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          assertIdentifier(entry.name);
          const dir = safePath(this.baseDir, path.join(this.baseDir, 'projects', entry.name));
          for (const name of ['project.json', 'series.json', 'episodes.json', 'canon_ledger.json', 'research_claims.json', 'jobs.json', 'packages.json', 'autoproduce_runs.json', 'spend_grants.json']) {
            const file = safePath(this.baseDir, path.join(dir, name));
            if (fs.existsSync(file)) this.store.read(file, null);
          }
          const plans = safePath(this.baseDir, path.join(dir, 'flow_plans'));
          if (fs.existsSync(plans)) for (const name of fs.readdirSync(plans)) {
            if (!name.endsWith('.json')) continue;
            assertIdentifier(name.slice(0, -5));
            this.store.read(safePath(this.baseDir, path.join(plans, name)), null);
          }
        }
        // Initialize default settings if not exists
        const settingsPath = path.join(this.baseDir, 'settings.json');
        if (!this.hasDocument(settingsPath)) {
          this.store.write(settingsPath, {
            productionTimezone: 'UTC', // Explicit default; user prompted to configure
            productionRoot: this.baseDir,
            budgetCaps: {
              perRunCapUsd: 25.0,
              perEpisodeCapUsd: 85.0,
              monthlyCapUsd: 350.0,
              currency: 'USD',
            },
            providerConfigs: {}, // Capabilities remain unknown until independently checked.
            dataNoticeAccepted: false,
            dataNoticeVersion: DATA_NOTICE_VERSION,
          });
        }

        this.store.read(settingsPath, {});

        // Check if default project exists and is fully seeded; if not, seed it
        const defaultProjectId = 'proj_ternfall_01';
        const projectDir = safePath(this.baseDir, path.join(this.baseDir, 'projects', defaultProjectId));
        const episodesFile = path.join(projectDir, 'episodes.json');
        const hasStoredProjectData = this.store.hasUnder(projectDir);
        const directoryExists = fs.existsSync(projectDir);
        if (!directoryExists && hasStoredProjectData) {
          throw new Error('Incomplete default project detected; restore missing files from backup. Existing data was not overwritten.');
        }
        if (!directoryExists || (fs.readdirSync(projectDir).length === 0 && !hasStoredProjectData)) {
          this.seedDefaultProject(defaultProjectId);
        } else if (!this.hasDocument(episodesFile) || !this.hasDocument(path.join(projectDir, 'project.json'))) {
          throw new Error('Incomplete default project detected; restore missing files from backup. Existing data was not overwritten.');
        }

      });
      this.isInitialized = true;
    } catch (err) {
      console.error('[StorageEngine] Failed to initialize storage:', err);
      throw err;
    }
  }

  /**
   * Compatibility entry point: writes metadata atomically to SQLite, not legacy JSON.
   */
  public async atomicWriteJson<T>(filePath: string, data: T): Promise<void> {
    safePath(this.baseDir, filePath);
    // Retain directories for media paths/discovery; metadata lives in SQLite.
    fs.mkdirSync(safePath(this.baseDir, path.dirname(filePath)), { recursive: true });
    this.store.write(filePath, data);
  }

  public async readJson<T>(filePath: string, defaultValue: T): Promise<T> {
    safePath(this.baseDir, filePath);
    return this.store.read(filePath, defaultValue);
  }

  // -------------------------------------------------------------------------
  // Project Management
  // -------------------------------------------------------------------------

  public async listProjects(): Promise<ProjectMetadata[]> {
    await this.init();
    const projectsDir = path.join(this.baseDir, 'projects');
    const entries = await fs.promises.readdir(projectsDir, { withFileTypes: true });

    const projects: ProjectMetadata[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaFile = path.join(projectsDir, entry.name, 'project.json');
        if (this.hasDocument(metaFile)) {
          const meta = await this.readJson<ProjectMetadata | null>(metaFile, null);
          if (meta) {
            if (meta.id !== entry.name) throw new Error('Stored project identity does not match its directory');
            projects.push({ ...meta, revision: meta.revision === undefined ? 0 : meta.revision });
          }
        }
      }
    }

    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getProject(projectId: string): Promise<ProjectMetadata | null> {
    assertIdentifier(projectId);
    await this.init();
    const metaFile = path.join(this.baseDir, 'projects', projectId, 'project.json');
    const meta = await this.readJson<ProjectMetadata | null>(metaFile, null);
    if (meta && meta.id !== projectId) throw new Error('Stored project identity does not match its directory');
    return meta ? { ...meta, revision: meta.revision === undefined ? 0 : meta.revision } : null;
  }

  /** Consistent metadata snapshot. Media files are intentionally not copied. */
  public async backupMetadata(): Promise<{ path: string; includesMedia: false }> {
    await this.init();
    const destination = safePath(this.baseDir, `backups/metadata_${randomUUID()}.sqlite`);
    this.store.backup(destination);
    return { path: destination, includesMedia: false };
  }

  public async createProject(name: string, description: string): Promise<ProjectMetadata> {
    try { validateProjectText(name, description); }
    catch (error) { throw requestValidationError('PROJECT_INVALID_REQUEST', error); }
    await this.init();
    name = name.trim();
    const id = `proj_${randomUUID()}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'project';
    const projectDir = safePath(this.baseDir, path.join(this.baseDir, 'projects', id));

    await fs.promises.mkdir(safePath(this.baseDir, projectDir), { mode: 0o700 });

    const meta: ProjectMetadata = {
      revision: 1,
      id,
      name,
      slug,
      description,
      productionRoot: projectDir,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isArchived: false,
      activeSeriesId: `series_${id}`,
    };

    this.store.transaction(() => {
      this.store.write(path.join(projectDir, 'project.json'), meta);

      // A new project starts empty. Copying the Ternfall bible would silently
      // assign another project's characters, rules and locations to this one.
      const bible: SeriesBible = {
        revision: 1, id: `series_${id}`, projectId: id, seriesTitle: name, logline: '',
        targetRuntimeMinutes: 15, targetWpm: 145, intendedAudience: '', primaryLanguage: 'English', locale: 'en-US',
        visualBible: { medium: '', palette: [], silhouetteRules: '', lightingRules: '', bannedStyles: [] },
        rules: [], characters: [], locations: [], factions: [], originalityDeclarations: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      this.store.write(path.join(projectDir, 'series.json'), bible);
      this.store.write(path.join(projectDir, 'episodes.json'), []);
      this.store.write(path.join(projectDir, 'canon_ledger.json'), []);
      this.store.write(path.join(projectDir, 'research_claims.json'), []);
      this.store.write(path.join(projectDir, 'jobs.json'), []);
      this.store.write(path.join(projectDir, 'packages.json'), []);
      this.store.write(path.join(projectDir, 'autoproduce_runs.json'), []);

    });
    return meta;
  }

  public async archiveProject(projectId: string, isArchived: boolean, expectedRevision?: number): Promise<ProjectMetadata | null> {
    assertIdentifier(projectId);
    try {
      assertRevision(expectedRevision);
      if (typeof isArchived !== 'boolean') throw new Error('isArchived must be a boolean');
    } catch (error) { throw requestValidationError('PROJECT_INVALID_REQUEST', error); }
    await this.init();
    const file = path.join(this.baseDir, 'projects', projectId, 'project.json');
    return this.updateJson<ProjectMetadata | null>(file, null, project => {
      if (!project) return null;
      if (project.id !== projectId) throw new RequestError('PROJECT_IDENTITY_MISMATCH');
      if ((expectedRevision ?? 0) !== (project.revision ?? 0)) throw new RevisionConflict(project.revision ?? 0);
      return { ...project, revision: nextRevision(project.revision), isArchived,
        archivedAt: isArchived ? (project.archivedAt ?? new Date().toISOString()) : undefined,
        updatedAt: new Date().toISOString() };
    });
  }

  // -------------------------------------------------------------------------
  // Series Bible & Roadmap
  // -------------------------------------------------------------------------

  public async getSeriesBible(projectId: string): Promise<SeriesBible | null> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'series.json');
    const bible = await this.readJson<SeriesBible | null>(filePath, null);
    return bible ? { ...bible, revision: bible.revision ?? 0 } : null;
  }

  public async updateSeriesBible(projectId: string, callerUpdate: Partial<SeriesBible>): Promise<SeriesBible | null> {
    assertIdentifier(projectId);
    let update: Partial<SeriesBible>;
    try {
      update = structuredClone(callerUpdate);
      if (!update || typeof update !== 'object' || Array.isArray(update)) throw new Error('Invalid series update');
      assertRevision(update.revision);
      const allowed = new Set(['revision', 'id', 'projectId', 'createdAt', 'updatedAt', 'seriesTitle', 'logline', 'targetRuntimeMinutes', 'targetWpm', 'intendedAudience', 'primaryLanguage', 'locale', 'visualBible', 'rules', 'characters', 'locations', 'factions', 'originalityDeclarations']);
      for (const key of Object.keys(update)) if (!allowed.has(key)) throw new Error(`Unsupported series field: ${key}`);
      for (const key of ['seriesTitle', 'logline', 'intendedAudience', 'primaryLanguage', 'locale'] as const) {
        if (update[key] !== undefined && (typeof update[key] !== 'string' || !update[key].trim() || update[key].length > 10_000)) throw new Error(`Invalid series ${key}`);
      }
      for (const key of ['rules', 'characters', 'locations', 'factions', 'originalityDeclarations'] as const) {
        if (update[key] !== undefined && (!Array.isArray(update[key]) || update[key].length > 1000)) throw new Error(`Invalid series ${key}`);
      }
      if (update.targetWpm !== undefined && (!Number.isFinite(update.targetWpm) || update.targetWpm < 80 || update.targetWpm > 220)) throw new Error('Invalid series pacing');
      if (update.targetRuntimeMinutes !== undefined && (!Number.isFinite(update.targetRuntimeMinutes) || update.targetRuntimeMinutes < 1 || update.targetRuntimeMinutes > 120)) throw new Error('Invalid series runtime');
      if (update.visualBible !== undefined && (!update.visualBible || typeof update.visualBible !== 'object' || Array.isArray(update.visualBible))) throw new Error('Invalid visual bible');
      if (update.visualBible !== undefined) validateValue(seriesFieldNode('visualBible'), update.visualBible, 'series visual bible');
      for (const nestedKey of ['rules', 'characters', 'locations', 'factions'] as const) {
        if (update[nestedKey] !== undefined) validateValue(seriesFieldNode(nestedKey), update[nestedKey], `series ${nestedKey}`);
      }
    } catch (error) { throw requestValidationError('SERIES_INVALID_REQUEST', error); }
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'series.json');
    return this.updateJson<SeriesBible | null>(filePath, null, bible => {
      if (!bible) return null;
      if ((update.id !== undefined && update.id !== bible.id) || (update.projectId !== undefined && update.projectId !== projectId) || (update.createdAt !== undefined && update.createdAt !== bible.createdAt)) throw new RequestError('SERIES_IDENTITY_IMMUTABLE');
      if ((update.revision ?? 0) !== (bible.revision ?? 0)) throw new RevisionConflict(bible.revision ?? 0);
      const merged: SeriesBible = { ...bible, ...update, id: bible.id, projectId: bible.projectId, createdAt: bible.createdAt, revision: nextRevision(bible.revision), updatedAt: new Date().toISOString() };
      for (const nestedKey of ['visualBible', 'rules', 'characters', 'locations', 'factions'] as const) {
        if (update[nestedKey] !== undefined) {
          (merged as unknown as Record<string, unknown>)[nestedKey] = mergeStoredExtras(seriesFieldNode(nestedKey), (bible as unknown as Record<string, unknown>)[nestedKey], (update as unknown as Record<string, unknown>)[nestedKey]);
        }
      }
      return merged;
    });
  }

  public getRoadmapArcs(): ArcRoadmapItem[] {
    return ALL_100_ARCS_ROADMAP;
  }

  // -------------------------------------------------------------------------
  // Episodes
  // -------------------------------------------------------------------------

  public async listEpisodes(projectId: string): Promise<EpisodeCard[]> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'episodes.json');
    return this.readJson<EpisodeCard[]>(filePath, []);
  }

  public async getEpisode(projectId: string, episodeId: string): Promise<EpisodeCard | null> {
    assertIdentifier(projectId); assertIdentifier(episodeId);
    const episodes = await this.listEpisodes(projectId);
    const matches = episodes.filter(e => e.id === episodeId || e.dbId === episodeId);
    if (matches.length > 1) throw new Error('Ambiguous episode identity; reconcile metadata before reading');
    return matches[0] || null;
  }

  public async expandArc(projectId: string, input: unknown): Promise<{ arcTitle: string; createdCards: EpisodeCard[] }> {
    assertIdentifier(projectId);
    const request = validateArcExpansion(structuredClone(input));
    await this.init();
    return this.store.transaction(() => {
      const dir = path.join(this.baseDir, 'projects', projectId);
      const project = this.store.read<ProjectMetadata | null>(path.join(dir, 'project.json'), null);
      if (!project || project.id !== projectId) throw new RequestError('ARC_PROJECT_UNAVAILABLE');
      const series = this.store.read<SeriesBible | null>(path.join(dir, 'series.json'), null);
      if (!series || series.id !== project.activeSeriesId || series.projectId !== projectId) throw new RequestError('ARC_SERIES_SCOPE');
      if (projectId !== 'proj_ternfall_01' || series.id !== 'series_ternfall_01') throw new RequestError('ARC_ROADMAP_SCOPE');
      const arc = this.getRoadmapArcs().find(item => item.arcNumber === request.arcNumber);
      if (!arc) throw new RequestError('ARC_NOT_FOUND');
      const requestFile = path.join(dir, 'arc_expansions.json');
      const requests = this.store.read<Array<{ key: string; arcNumber: number; count: number; result: { arcTitle: string; createdCards: EpisodeCard[] } }>>(requestFile, []);
      const previous = requests.find(item => item.key === request.idempotencyKey);
      if (previous) {
        if (previous.arcNumber !== request.arcNumber || previous.count !== request.count) throw new IdempotencyConflict();
        return previous.result; // Original creation snapshot, not current edited cards.
      }
      const episodeFile = path.join(dir, 'episodes.json');
      const episodes = this.store.read<EpisodeCard[]>(episodeFile, []);
      const next = episodeHighWater(episodes, request.count);
      const createdCards = Array.from({ length: request.count }, (_, index) => arcCard(project, arc, next + index + 1, index + 1));
      assertUniqueEpisodeIdentities([...episodes, ...createdCards]);
      const result = { arcTitle: arc.arcTitle, createdCards };
      this.store.write(episodeFile, [...episodes, ...createdCards]);
      this.store.write(requestFile, [...requests, { key: request.idempotencyKey, arcNumber: request.arcNumber, count: request.count, result }]);
      return result;
    });
  }

  private seriesReconciliationScope(projectId: string, episodeIdOrDbId: string) {
    const dir = path.join(this.baseDir, 'projects', projectId);
    const project = this.store.read<ProjectMetadata | null>(path.join(dir, 'project.json'), null);
    if (!project || project.id !== projectId) throw new RequestError('EPISODE_PROJECT_UNAVAILABLE');
    const series = this.store.read<SeriesBible | null>(path.join(dir, 'series.json'), null);
    if (!series || series.projectId !== projectId || series.id !== project.activeSeriesId) throw new Error('Active series scope mismatch');
    assertIdentifier(project.activeSeriesId);
    const file = path.join(dir, 'episodes.json');
    const episodes = this.store.read<EpisodeCard[]>(file, []);
    assertUniqueEpisodeIdentities(episodes);
    const index = episodes.findIndex(episode => episode.id === episodeIdOrDbId || episode.dbId === episodeIdOrDbId);
    if (index < 0) throw new Error('Episode not found');
    const episode = episodes[index];
    if (episode.projectId !== projectId) throw new Error('Episode project scope mismatch');
    assertIdentifier(episode.seriesId); assertRevision(episode.revision);
    const historyFile = path.join(dir, 'episode_series_reconciliations.json');
    const hasHistory = this.store.has(historyFile);
    if (!hasHistory && fs.existsSync(safePath(this.baseDir, historyFile))) throw new Error('Unmanaged reconciliation history file; manual review is required');
    const history = hasHistory ? this.store.read<EpisodeSeriesReconciliationEvent[]>(historyFile, []) : [];
    if (!Array.isArray(history)) throw new Error('Invalid series reconciliation history');
    return { project, file, episodes, index, episode, historyFile, history };
  }

  /** Dry-run only. Does not alter the episode or create a backup. */
  public async previewEpisodeSeriesReconciliation(projectId: string, episodeIdOrDbId: string) {
    assertIdentifier(projectId); assertIdentifier(episodeIdOrDbId); await this.init();
    return this.store.transaction(() => {
      const scope = this.seriesReconciliationScope(projectId, episodeIdOrDbId);
      const fromSeriesId = scope.episode.seriesId, toSeriesId = scope.project.activeSeriesId;
      const status = fromSeriesId === toSeriesId ? 'already_canonical' : fromSeriesId === `series_${projectId}` ? 'eligible' : 'manual_review_required';
      return {
        projectId, episodeId: scope.episode.id, dbId: scope.episode.dbId,
        fromSeriesId, toSeriesId, revision: scope.episode.revision ?? 0, status,
        history: scope.history.filter(event => event.episodeId === scope.episode.id),
      };
    });
  }

  /** Explicit, revision-checked correction of only the known legacy series pattern. */
  public async reconcileEpisodeSeries(projectId: string, episodeIdOrDbId: string, input: { expectedRevision: number; fromSeriesId: string; toSeriesId: string }) {
    assertIdentifier(projectId); assertIdentifier(episodeIdOrDbId);
    const request = structuredClone(input);
    if (!request || typeof request !== 'object' || Object.keys(request).some(key => !['expectedRevision', 'fromSeriesId', 'toSeriesId'].includes(key)) || request.expectedRevision === undefined) throw new Error('Explicit reconciliation tokens are required');
    assertRevision(request.expectedRevision); assertIdentifier(request.fromSeriesId); assertIdentifier(request.toSeriesId);
    const preview = await this.previewEpisodeSeriesReconciliation(projectId, episodeIdOrDbId);
    if (preview.status !== 'eligible') throw new Error('Series reconciliation is not eligible; inspect the preview');
    if (preview.revision !== request.expectedRevision) throw new RevisionConflict(preview.revision);
    if (!Number.isSafeInteger(preview.revision + 1)) throw new Error('Episode revision exhausted');
    if (preview.fromSeriesId !== request.fromSeriesId || preview.toSeriesId !== request.toSeriesId) throw new Error('Series reconciliation scope changed; inspect the preview again');
    const backup = await this.backupMetadata();
    try {
      return this.store.transaction(() => {
        const scope = this.seriesReconciliationScope(projectId, episodeIdOrDbId);
        const revision = scope.episode.revision ?? 0;
        if (revision !== request.expectedRevision) throw new RevisionConflict(revision);
        if (scope.episode.seriesId !== request.fromSeriesId || scope.project.activeSeriesId !== request.toSeriesId || request.fromSeriesId !== `series_${projectId}` || request.fromSeriesId === request.toSeriesId) throw new Error('Series reconciliation scope changed; inspect the preview again');
        const now = new Date().toISOString();
        const episode = { ...scope.episode, seriesId: request.toSeriesId, revision: revision + 1, updatedAt: now };
        const event: EpisodeSeriesReconciliationEvent = {
          id: `reconcile_${randomUUID()}`, kind: 'apply', episodeId: episode.id,
          fromSeriesId: request.fromSeriesId, toSeriesId: request.toSeriesId, beforeRevision: revision, afterRevision: revision + 1,
          backupFile: path.relative(this.baseDir, backup.path), createdAt: now,
        };
        scope.episodes[scope.index] = episode;
        this.store.write(scope.file, scope.episodes);
        this.store.write(scope.historyFile, [...scope.history, event]);
        return { episode, event, backup };
      });
    } catch (error) {
      if (error instanceof Error) { error.message += ` Metadata-only backup created at ${backup.path}; reconciliation did not commit.`; Object.assign(error, { backupPath: backup.path }); }
      throw error;
    }
  }

  /** Undo only an untouched applied revision. Later episode edits require manual review. */
  public async undoEpisodeSeriesReconciliation(projectId: string, episodeIdOrDbId: string, input: { expectedRevision: number; eventId: string }) {
    assertIdentifier(projectId); assertIdentifier(episodeIdOrDbId);
    const request = structuredClone(input);
    if (!request || typeof request !== 'object' || Object.keys(request).some(key => !['expectedRevision', 'eventId'].includes(key)) || request.expectedRevision === undefined) throw new Error('Explicit undo tokens are required');
    assertRevision(request.expectedRevision); assertIdentifier(request.eventId); await this.init();
    const check = () => {
      const scope = this.seriesReconciliationScope(projectId, episodeIdOrDbId);
      const event = scope.history.find(item => item.id === request.eventId && item.kind === 'apply' && item.episodeId === scope.episode.id);
      if (!event || scope.history.some(item => item.kind === 'undo' && item.reversesEventId === request.eventId)) throw new Error('Reconciliation event not found or already undone');
      const revision = scope.episode.revision ?? 0;
      if (revision !== request.expectedRevision) throw new RevisionConflict(revision);
      if (!Number.isSafeInteger(revision + 1)) throw new Error('Episode revision exhausted');
      if (revision !== event.afterRevision || scope.episode.seriesId !== event.toSeriesId || scope.project.activeSeriesId !== event.toSeriesId || event.fromSeriesId !== `series_${projectId}`) throw new Error('Episode changed since reconciliation; manual review is required before undo');
      return { scope, event, revision };
    };
    this.store.transaction(check); // Reject obvious conflicts before creating a backup.
    const backup = await this.backupMetadata();
    try {
      return this.store.transaction(() => {
        const { scope, event: applied, revision } = check();
        const now = new Date().toISOString();
        const episode = { ...scope.episode, seriesId: applied.fromSeriesId, revision: revision + 1, updatedAt: now };
        const event: EpisodeSeriesReconciliationEvent = {
          id: `reconcile_${randomUUID()}`, kind: 'undo', episodeId: episode.id, fromSeriesId: applied.toSeriesId, toSeriesId: applied.fromSeriesId,
          beforeRevision: revision, afterRevision: revision + 1, backupFile: path.relative(this.baseDir, backup.path), createdAt: now, reversesEventId: applied.id,
        };
        scope.episodes[scope.index] = episode;
        this.store.write(scope.file, scope.episodes);
        this.store.write(scope.historyFile, [...scope.history, event]);
        return { episode, event, backup };
      });
    } catch (error) {
      if (error instanceof Error) { error.message += ` Metadata-only backup created at ${backup.path}; undo did not commit.`; Object.assign(error, { backupPath: backup.path }); }
      throw error;
    }
  }

  /** Create a draft with server-owned identity. Retries return the original snapshot. */
  public async createEpisode(projectId: string, input: unknown): Promise<EpisodeCard> {
    assertIdentifier(projectId);
    const request = validateEpisodeCreation(structuredClone(input));
    await this.init();
    return this.store.transaction(() => {
      const dir = path.join(this.baseDir, 'projects', projectId);
      const project = this.store.read<ProjectMetadata | null>(path.join(dir, 'project.json'), null);
      if (!project || project.id !== projectId) throw new RequestError('EPISODE_PROJECT_UNAVAILABLE');
      const series = this.store.read<SeriesBible | null>(path.join(dir, 'series.json'), null);
      if (!series || series.id !== project.activeSeriesId || series.projectId !== projectId) throw new RequestError('EPISODE_SERIES_SCOPE');
      const requestFile = path.join(dir, 'episode_creation_requests.json');
      type Record = { request: typeof request; result: EpisodeCard };
      const requests = this.store.read<Record[]>(requestFile, []);
      const previous = requests.find(item => item.request.idempotencyKey === request.idempotencyKey);
      if (previous) {
        if (previous.request.workingTitle !== request.workingTitle || previous.request.logline !== request.logline || previous.request.physicalObjective !== request.physicalObjective) throw new IdempotencyConflict();
        return previous.result;
      }
      const file = path.join(dir, 'episodes.json');
      const episodes = this.store.read<EpisodeCard[]>(file, []);
      const number = episodeHighWater(episodes) + 1;
      const now = new Date().toISOString();
      const result: EpisodeCard = {
        revision: 1, id: episodeId(1, number), dbId: `ep_${randomUUID()}`,
        projectId, seriesId: project.activeSeriesId, season: 1, seasonNumber: 1,
        episodeNumber: number, episodeNumberInSeries: number, arcNumber: 1,
        workingTitle: request.workingTitle, logline: request.logline, physicalObjective: request.physicalObjective,
        status: 'planned', scriptVersions: [], activeScriptVersionIndex: 0,
        staleDownstreamAssets: false, createdAt: now, updatedAt: now,
      };
      assertUniqueEpisodeIdentities([...episodes, result]);
      this.store.write(file, [...episodes, result]);
      this.store.write(requestFile, [...requests, { request, result }]);
      return result;
    });
  }

  public async saveEpisode(projectId: string, callerEpisode: EpisodeCard, existingOnly = false): Promise<EpisodeCard> {
    let episode: EpisodeCard = structuredClone(callerEpisode);
    assertIdentifier(projectId);
    await this.init();
    assertIdentifier(episode.id); assertIdentifier(episode.dbId); assertRevision(episode.revision);
    if (episode.projectId !== projectId) throw new Error('Episode project scope mismatch');
    // Every caller, trusted or not, passes a model-clean document: unknown
    // caller keys are rejected so no caller can invent model-less "legacy"
    // data. Stored-only legacy keys survive edits through mergeStoredExtras
    // below, restored exclusively from the stored record.
    try { validateDocument(EPISODE_SCHEMA, episode, 'episode'); }
    catch (error) { throw requestValidationError('EPISODE_INVALID_EDIT', error); }
    const file = path.join(this.baseDir, 'projects', projectId, 'episodes.json');
    let saved!: EpisodeCard;
    await this.updateJson<EpisodeCard[]>(file, [], items => {
      const project = this.store.read<ProjectMetadata | null>(path.join(this.baseDir, 'projects', projectId, 'project.json'), null);
      if (!project || project.id !== projectId) throw new RequestError('EPISODE_PROJECT_UNAVAILABLE');
      const indices = items.flatMap((item, index) => [item.id, item.dbId].some(key => key === episode.id || key === episode.dbId) ? [index] : []);
      if (indices.length > 1) throw new RequestError('EPISODE_AMBIGUOUS_IDENTITY');
      const index = indices[0] ?? -1;
      const current = index >= 0 ? items[index] : undefined;
      if (!current && existingOnly) throw new RequestError('EPISODE_NOT_FOUND_FOR_EDIT');
      // Legacy extras (keys outside the HTTP model) survive edits: stored-only
      // fields are preserved recursively. Caller-invented unknown keys never
      // reach this point; they are rejected by the strict validation above.
      if (current) episode = mergeStoredExtras(EPISODE_SCHEMA, current, episode) as EpisodeCard;
      if (!current && (episode.revision ?? 0) !== 0) throw new RevisionConflict(0);
      if (current && (current.id !== episode.id || current.dbId !== episode.dbId)) throw new RequestError('EPISODE_IDENTITY_IMMUTABLE');
      if (current && current.seriesId !== episode.seriesId) throw new RequestError('EPISODE_SERIES_IMMUTABLE');
      // Preserve the known historical series_${projectId} value on existing records only.
      // This is not a migration and does not make that historical association correct.
      const unchangedLegacy = current && current.projectId === projectId && current.seriesId === `series_${projectId}` && episode.seriesId === current.seriesId;
      if (episode.seriesId !== project.activeSeriesId && !unchangedLegacy) throw new RequestError('EPISODE_SERIES_SCOPE');
      if (current && (episode.revision ?? 0) !== (current.revision ?? 0)) throw new RevisionConflict(current.revision ?? 0);
      if (!Array.isArray(episode.scriptVersions) || episode.scriptVersions.length > 1000) throw new Error('Invalid script versions');
      if (!Number.isInteger(episode.activeScriptVersionIndex) || episode.activeScriptVersionIndex < 0 || episode.activeScriptVersionIndex >= Math.max(1, episode.scriptVersions.length)) throw new RequestError('EPISODE_INVALID_VERSIONS');
      nextScriptVersionNumber(episode.scriptVersions);
      if (current && !Array.isArray(current.scriptVersions)) throw new RequestError('EPISODE_HISTORY_REVIEW');
      const previousVersions = current ? current.scriptVersions : [];
      if (episode.scriptVersions.length < previousVersions.length) throw new RequestError('EPISODE_HISTORY_REMOVED');
      for (let i = 0; i < previousVersions.length; i++) {
        if (!isDeepStrictEqual(previousVersions[i], episode.scriptVersions[i])) throw new RequestError('EPISODE_HISTORY_IMMUTABLE');
      }
      let nextVersion = nextScriptVersionNumber(previousVersions);
      const versions = episode.scriptVersions.map((version, index) => {
        if (index < previousVersions.length) return version;
        if (version.versionNumber !== nextVersion++) throw new RequestError('EPISODE_VERSION_SEQUENCE');
        // Pacing policy for new history entries matches the HTTP handler;
        // stored historical versions are immutable and are not re-judged.
        if (version.targetWpm !== undefined && (!Number.isFinite(version.targetWpm) || version.targetWpm < 80 || version.targetWpm > 220)) throw new RequestError('EPISODE_INVALID_PACING');
        return { ...version, wordCount: calculateWordCount(version.fullNarrationText) };
      });
      const activeScriptChanged = !!current && (current.activeScriptVersionIndex !== episode.activeScriptVersionIndex || !isDeepStrictEqual(previousVersions[current.activeScriptVersionIndex], versions[episode.activeScriptVersionIndex]));
      saved = { ...episode, scriptVersions: versions, revision: nextRevision(current?.revision), createdAt: current?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (current?.staleDownstreamAssets || activeScriptChanged) saved.staleDownstreamAssets = true;
      if (index < 0) items.push(saved); else items[index] = saved;
      return items;
    });
    Object.assign(callerEpisode, structuredClone(saved));
    return saved;
  }

  /** Duplicate from the current transactional snapshot; no inherited approvals are valid for a new identity. */
  public async duplicateEpisode(projectId: string, sourceEpisodeId: string, newTitle: unknown, idempotencyKey: unknown): Promise<EpisodeCard | null> {
    assertIdentifier(projectId); assertIdentifier(sourceEpisodeId); assertIdentifier(idempotencyKey);
    const title = validateVariantTitle(newTitle);
    await this.init();
    return this.store.transaction(() => {
      const dir = path.join(this.baseDir, 'projects', projectId);
      const project = this.store.read<ProjectMetadata | null>(path.join(dir, 'project.json'), null);
      if (!project || project.id !== projectId) throw new RequestError('EPISODE_PROJECT_UNAVAILABLE');
      const series = this.store.read<SeriesBible | null>(path.join(dir, 'series.json'), null);
      if (!series || series.id !== project.activeSeriesId || series.projectId !== projectId) throw new RequestError('EPISODE_SERIES_SCOPE');
      const requestFile = path.join(dir, 'episode_duplication_requests.json');
      type Record = { key: string; sourceEpisodeId: string; title?: string; result: EpisodeCard };
      const requests = this.store.read<Record[]>(requestFile, []);
      const previous = requests.find(item => item.key === idempotencyKey);
      if (previous) {
        if (previous.sourceEpisodeId !== sourceEpisodeId || previous.title !== title) throw new IdempotencyConflict();
        return previous.result;
      }
      const file = path.join(dir, 'episodes.json');
      const episodes = this.store.read<EpisodeCard[]>(file, []);
      const high = episodeHighWater(episodes);
      const source = episodes.find(item => item.id === sourceEpisodeId || item.dbId === sourceEpisodeId);
      if (!source) return null;
      if (source.projectId !== projectId || (source.seriesId !== project.activeSeriesId && source.seriesId !== `series_${projectId}`)) throw new RequestError('EPISODE_SOURCE_SCOPE');
      if (typeof source.workingTitle !== 'string' || !source.workingTitle.trim() || !Array.isArray(source.scriptVersions)) throw new RequestError('EPISODE_INVALID_SOURCE');
      const season = episodeSeason(source), number = high + 1, now = new Date().toISOString();
      const result: EpisodeCard = {
        ...structuredClone(source), revision: 1, id: episodeId(season, number), dbId: `ep_${randomUUID()}`,
        projectId, seriesId: project.activeSeriesId, season, seasonNumber: season,
        episodeNumber: number, episodeNumberInSeries: number,
        workingTitle: title ?? `${source.workingTitle.slice(0, 190)} (Variant)`, status: 'planned',
        scriptVersions: source.scriptVersions.map(version => {
          const { approvedBy: _previousReviewer, ...draft } = version;
          return { ...draft, isApproved: false, approvalNotes: 'Copied draft; not reviewed for this episode.' };
        }),
        provenanceSourceEpisodeId: source.id, staleDownstreamAssets: true, createdAt: now, updatedAt: now,
      };
      assertUniqueEpisodeIdentities([...episodes, result]);
      this.store.write(file, [...episodes, result]);
      this.store.write(requestFile, [...requests, { key: idempotencyKey, sourceEpisodeId, title, result }]);
      return result;
    });
  }

  // -------------------------------------------------------------------------
  // Canon Events & Research Claims
  // -------------------------------------------------------------------------

  public async listCanonEvents(projectId: string): Promise<CanonEvent[]> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'canon_ledger.json');
    return this.readJson<CanonEvent[]>(filePath, []);
  }

  public async addCanonEvent(projectId: string, callerEvent: CanonEvent): Promise<CanonEvent> {
    const event = structuredClone(callerEvent);
    assertIdentifier(projectId); assertIdentifier(event?.id); assertIdentifier(event?.episodeId);
    const text = (value: unknown, maximum: number) => typeof value === 'string' && !!value.trim() && value.length <= maximum;
    if (!text(event.storyDate, 200) || !text(event.physicalLocation, 200) || !text(event.consequencesSummary, 4000) || !Number.isFinite(Date.parse(event.createdAt))) throw new Error('Invalid canon event');
    for (const values of [event.charactersPresent, event.resourceDeltas, event.injuriesOrStatusChanges, event.unresolvedClues, event.promisesMade]) {
      if (!Array.isArray(values) || values.length > 100 || values.some(value => !text(value, 1000))) throw new Error('Invalid canon event list');
    }
    if (!event.whatCharactersLearned || typeof event.whatCharactersLearned !== 'object' || Array.isArray(event.whatCharactersLearned) || Object.entries(event.whatCharactersLearned).length > 100 || Object.entries(event.whatCharactersLearned).some(([key, value]) => !text(key, 200) || !text(value, 4000))) throw new Error('Invalid character knowledge');
    if (typeof event.isRetcon !== 'boolean') throw new Error('Invalid retcon marker');
    await this.init();
    const dir = path.join(this.baseDir, 'projects', projectId);
    const file = path.join(dir, 'canon_ledger.json');
    await this.updateJson<CanonEvent[]>(file, [], events => {
      const project = this.store.read<ProjectMetadata | null>(path.join(dir, 'project.json'), null);
      if (!project || project.id !== projectId) throw new Error('Canon project not found');
      const episodes = this.store.read<EpisodeCard[]>(path.join(dir, 'episodes.json'), []);
      assertUniqueEpisodeIdentities(episodes);
      if (!episodes.some(episode => episode.id === event.episodeId && episode.projectId === projectId)) throw new Error('Canon episode not found in project');
      if (events.some(existing => existing.id === event.id)) throw new Error('Canon event ID already exists');
      return [...events, event];
    });
    return event;
  }

  public async saveCanonEvent(projectId: string, event: CanonEvent): Promise<CanonEvent> {
    assertIdentifier(projectId);
    return this.addCanonEvent(projectId, event);
  }

  public async listResearchClaims(projectId: string): Promise<ResearchClaim[]> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'research_claims.json');
    return (await this.readJson<ResearchClaim[]>(filePath, [])).map(unreviewedResearchClaim);
  }

  public async saveResearchClaim(projectId: string, claim: ResearchClaim): Promise<ResearchClaim> {
    assertIdentifier(projectId);
    let checked: ResearchClaim;
    try { checked = validateResearchClaim(projectId, structuredClone(claim)); }
    catch (error) { throw requestValidationError('RESEARCH_INVALID_REQUEST', error); }
    await this.init();
    if (!(await this.getProject(projectId))) throw new RequestError('RESEARCH_PROJECT_UNAVAILABLE');
    const file = path.join(this.baseDir, 'projects', projectId, 'research_claims.json');
    let saved!: ResearchClaim;
    await this.updateJson<ResearchClaim[]>(file, [], items => {
      const index = items.findIndex(item => item.id === checked.id);
      const current = items[index];
      if ((checked.revision ?? 0) !== (current?.revision ?? 0)) throw new RevisionConflict(current?.revision ?? 0);
      if (current && (current.projectId !== projectId || current.createdAt !== checked.createdAt)) throw new RequestError('RESEARCH_IDENTITY_IMMUTABLE');
      const merged = current ? mergeStoredExtras(RESEARCH_SCHEMA, current, checked) as ResearchClaim : checked;
      saved = { ...merged, revision: nextRevision(current?.revision), updatedAt: new Date().toISOString() };
      if (index < 0) items.push(saved); else items[index] = saved;
      return items;
    });
    return publicResearchClaim(saved);
  }

  /** Internal metadata CAS only. This is not execution, QC or approval authority. */
  private async saveProductionRecord<T extends { revision?: number; createdAt: string; updatedAt: string; projectId?: string; episodeId?: string }>(projectId: string, name: string, key: 'id' | 'runId', input: T): Promise<T> {
    assertIdentifier(projectId);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid production record');
    const record = structuredClone(input);
    assertIdentifier((record as any)[key]); assertRevision(record.revision);
    if (record.projectId !== undefined && record.projectId !== projectId) throw new Error('Production record project scope mismatch');
    if (record.episodeId !== undefined) assertIdentifier(record.episodeId);
    if (typeof record.createdAt !== 'string' || !Number.isFinite(Date.parse(record.createdAt))) throw new Error('Invalid production record creation time');
    await this.init();
    if (!(await this.getProject(projectId))) throw new Error('Production record project not found');
    if (record.episodeId && !(await this.getEpisode(projectId, record.episodeId))) throw new Error('Production record episode not found');
    let saved!: T;
    const file = path.join(this.baseDir, 'projects', projectId, name);
    await this.updateJson<T[]>(file, [], items => {
      const index = items.findIndex(item => (item as any)[key] === (record as any)[key]);
      const current = items[index];
      if ((record.revision ?? 0) !== (current?.revision ?? 0)) throw new RevisionConflict(current?.revision ?? 0);
      if (current && (current.createdAt !== record.createdAt || current.episodeId !== record.episodeId || (current.projectId !== undefined && current.projectId !== projectId))) throw new Error('Production record identity is immutable');
      saved = { ...record, projectId, revision: nextRevision(current?.revision), updatedAt: new Date().toISOString() };
      if (index < 0) items.push(saved); else items[index] = saved;
      return items;
    });
    return saved;
  }

  // -------------------------------------------------------------------------
  // Jobs & Production Queue
  // -------------------------------------------------------------------------

  public async listJobs(projectId?: string): Promise<GenerationJob[]> {
    if (projectId !== undefined) assertIdentifier(projectId);
    await this.init();
    if (projectId) {
      const filePath = path.join(this.baseDir, 'projects', projectId, 'jobs.json');
      return (await this.readJson<GenerationJob[]>(filePath, [])).map(job => ({ ...job, revision: job.revision === undefined ? 0 : job.revision }));
    }

    // List across all projects
    const projects = await this.listProjects();
    const allJobs: GenerationJob[] = [];
    for (const p of projects) {
      const filePath = path.join(this.baseDir, 'projects', p.id, 'jobs.json');
      const jobs = await this.readJson<GenerationJob[]>(filePath, []);
      allJobs.push(...jobs.map(job => ({ ...job, revision: job.revision === undefined ? 0 : job.revision })));
    }
    return allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async saveJob(projectId: string, job: GenerationJob): Promise<GenerationJob> {
    return this.saveProductionRecord<GenerationJob>(projectId, 'jobs.json', 'id', job);
  }

  // -------------------------------------------------------------------------
  // Autoproducer Runs
  // -------------------------------------------------------------------------

  public async listAutoproduceRuns(projectId: string): Promise<AutoproduceRun[]> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'autoproduce_runs.json');
    return (await this.readJson<AutoproduceRun[]>(filePath, [])).map(run => ({ ...run, revision: run.revision === undefined ? 0 : run.revision }));
  }

  public async saveAutoproduceRun(projectId: string, run: AutoproduceRun): Promise<AutoproduceRun> {
    return this.saveProductionRecord<AutoproduceRun>(projectId, 'autoproduce_runs.json', 'runId', run);
  }

  // -------------------------------------------------------------------------
  // YouTube Packages
  // -------------------------------------------------------------------------

  public async listPackages(projectId: string): Promise<YouTubePackage[]> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'packages.json');
    const existing = await this.readJson<YouTubePackage[]>(filePath, []);
    return existing.map(pkg => ({ ...pkg, projectId: pkg.projectId ?? projectId, revision: pkg.revision === undefined ? 0 : pkg.revision }));
  }

  public async savePackage(projectId: string, pkg: YouTubePackage): Promise<YouTubePackage> {
    return this.saveProductionRecord<YouTubePackage>(projectId, 'packages.json', 'id', pkg);
  }

  // -------------------------------------------------------------------------
  // Spend Approval Grants (Cap enforcement & Operator Authorizations)
  // -------------------------------------------------------------------------

  public async listSpendGrants(projectId: string): Promise<SpendApprovalGrant[]> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'spend_grants.json');
    return this.readJson<SpendApprovalGrant[]>(filePath, []);
  }

  public async saveSpendGrant(projectId: string, grant: SpendApprovalGrant): Promise<SpendApprovalGrant> {
    assertIdentifier(projectId);
    await this.init();
    const file = path.join(this.baseDir, 'projects', projectId, 'spend_grants.json');
    await this.updateJson<SpendApprovalGrant[]>(file, [], items => {
      const index = items.findIndex(item => item.approvalId === grant.approvalId);
      if (index < 0) items.push(grant); else items[index] = grant;
      return items;
    });
    return grant;
  }

  public async getSpendGrant(projectId: string, approvalId: string): Promise<SpendApprovalGrant | null> {
    assertIdentifier(projectId);
    const grants = await this.listSpendGrants(projectId);
    return grants.find((g) => g.approvalId === approvalId) || null;
  }

  // -------------------------------------------------------------------------
  // Settings & Doctor
  // -------------------------------------------------------------------------

  /** Internal worker API only. No HTTP/CLI grant creation or paid execution is enabled. */
  public async reserveSpend(request: ReserveSpend) {
    await this.init();
    return new SpendLedger(this.baseDir, this.store).reserve(request);
  }
  public async transitionSpend(projectId: string, reservationId: string, state: Exclude<ReservationState, 'reserved'>, evidence?: string, actualCostUsd?: number) {
    await this.init();
    return new SpendLedger(this.baseDir, this.store).transition(projectId, reservationId, state, evidence, actualCostUsd);
  }
  public async listSpendReservations(projectId: string) {
    await this.init();
    return new SpendLedger(this.baseDir, this.store).list(projectId);
  }
  public async listSpendEvents(projectId: string) {
    await this.init();
    return new SpendLedger(this.baseDir, this.store).events(projectId);
  }

  public async getSettings(): Promise<Record<string, unknown>> {
    await this.init();
    const settingsPath = path.join(this.baseDir, 'settings.json');
    return this.store.transaction(() => settingsView(
      this.store.read<Record<string, unknown>>(settingsPath, {}),
      this.store.read<DataNoticeEvent[]>(path.join(this.baseDir, 'data_notice_events.json'), []),
    ));
  }

  public async updateSettings(callerUpdate: Record<string, unknown>): Promise<Record<string, unknown>> {
    let update: Record<string, unknown>;
    try {
      update = structuredClone(callerUpdate);
      if (!update || typeof update !== 'object' || Array.isArray(update)) throw new Error('Invalid settings');
      assertRevision(update.revision);
      const allowed = new Set(['revision', 'productionTimezone', 'dataNoticeAccepted', 'dataNoticeVersion']);
      for (const key of Object.keys(update)) if (!allowed.has(key)) throw new Error(`Setting ${key} cannot be changed through this endpoint`);
      if (update.productionTimezone !== undefined) {
        if (typeof update.productionTimezone !== 'string') throw new Error('Invalid timezone');
        new Intl.DateTimeFormat('en', { timeZone: update.productionTimezone });
      }
      if (update.dataNoticeAccepted !== undefined && typeof update.dataNoticeAccepted !== 'boolean') throw new Error('Invalid consent');
      if (update.dataNoticeVersion !== undefined && update.dataNoticeVersion !== DATA_NOTICE_VERSION) throw new Error('Reload the current data notice before acknowledging it');
      if (update.dataNoticeAccepted === true && update.dataNoticeVersion !== DATA_NOTICE_VERSION) throw new Error('Acknowledgement requires the current dataNoticeVersion');
    } catch (error) { throw requestValidationError('SETTINGS_INVALID_REQUEST', error); }
    await this.init();
    const settingsPath = path.join(this.baseDir, 'settings.json');
    let view!: Record<string, unknown>;
    await this.updateJson<Record<string, unknown>>(settingsPath, {}, current => {
      if ((update.revision ?? 0) !== (current.revision ?? 0)) throw new RevisionConflict((current.revision ?? 0) as number);
      const revision = nextRevision(current.revision);
      const eventPath = path.join(this.baseDir, 'data_notice_events.json');
      const events = this.store.read<DataNoticeEvent[]>(eventPath, []);
      if (update.dataNoticeAccepted !== undefined) {
        events.push({ version: DATA_NOTICE_VERSION, accepted: update.dataNoticeAccepted as boolean, recordedAt: new Date().toISOString(), settingsRevision: revision, channel: 'operator-settings' });
        this.store.write(eventPath, events); // Same transaction as settings; caller cannot provide events/timestamps.
      }
      const saved = { ...current, ...update, revision, updatedAt: new Date().toISOString() };
      // Demoted legacy/provider information is a read view, not a migration.
      // Persist the untouched historical fields and return the matching view.
      view = settingsView(saved, events);
      return saved;
    });
    return view;
  }

  public async runDoctorDiagnostics(): Promise<SystemDiagnostics> {
    await this.init();
    const isCloud = !!process.env.APP_URL || !!process.env.K_SERVICE || process.env.STUDIO_CLOUD_PREVIEW === 'true';
    const probe = async (executable: string, args: string[]) => {
      try {
        const { stdout } = await promisify(execFile)(executable, args, { timeout: 3000, maxBuffer: 65536 });
        return stdout.trim().split('\n')[0];
      } catch { return undefined; }
    };
    const [ffmpegVersion, ffprobeVersion, opencodeVersion] = await Promise.all([
      probe(mediaBinary('ffmpeg'), ['-version']), probe(mediaBinary('ffprobe'), ['-version']), probe('opencode', ['--version']),
    ]);
    const disk = await fs.promises.statfs(this.baseDir).catch(() => undefined);

    let isWritable = false;
    let probeCreated = false;
    let probeCleanupFailed = false;
    const testFile = path.join(this.baseDir, `.doctor-probe-${randomUUID()}`);
    try {
      // Exclusive creation avoids collisions and refuses a pre-existing final
      // symlink instead of following it and overwriting an unrelated file.
      const handle = await fs.promises.open(safePath(this.baseDir, testFile), 'wx', 0o600);
      probeCreated = true;
      try { await handle.writeFile('ok'); }
      finally { await handle.close(); }
      isWritable = true;
    } catch {
      isWritable = false;
    } finally {
      if (probeCreated) {
        try { await fs.promises.unlink(testFile); }
        catch { probeCleanupFailed = true; }
      }
    }

    // Check Gemini API key configuration safely
    const hasGeminiKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';

    const settings = await this.getSettings();
    const configuredTimezone = (settings.productionTimezone as string) || 'UTC';

    let isValidIana = false;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: configuredTimezone });
      isValidIana = true;
    } catch {
      isValidIana = false;
    }

    const remediationSteps: string[] = [];
    if (!isWritable) {
      remediationSteps.push('Production root path is not writable or its write probe failed. Check folder permissions.');
    }
    if (probeCleanupFailed) {
      remediationSteps.push('Doctor could not remove its temporary write probe; inspect the production root before cleaning it up.');
    }
    if (!hasGeminiKey) {
      remediationSteps.push('No Gemini key is configured; none is needed for local planning. Paid generation remains disabled.');
    }
    if (isCloud) {
      remediationSteps.push('Hosted preview uses server-side files and executables. Your browser does not automatically have access to local paths or GPU devices.');
    }
    if (!isValidIana || configuredTimezone === 'UTC') {
      remediationSteps.push('Explicit production IANA timezone is recommended before scheduling video releases (e.g., Asia/Kolkata or America/New_York).');
    }

    return {
      runtimeEnvironment: isCloud ? 'cloud_preview' : (process.platform === 'win32' ? 'local_windows' : process.platform === 'linux' ? 'local_linux' : 'local_other'),
      nodeVersion: process.version,
      osPlatform: `${process.platform} (${process.arch})`,
      // Hardware/encoder capability is unknown until measured, not a fixed laptop profile.
      storage: {
        productionRoot: this.baseDir,
        isWritable,
        isLocalDiskMounted: null, // Local vs network filesystem is not probed.
        freeSpaceMb: disk ? Math.floor(disk.bavail * disk.bsize / 1024 / 1024) : undefined,
      },
      ffmpeg: {
        installed: !!ffmpegVersion,
        version: ffmpegVersion,
        ffprobeAvailable: !!ffprobeVersion,
      },
      opencode: {
        installed: !!opencodeVersion,
        cliVersion: opencodeVersion,
        wslRecommended: process.platform === 'win32',
      },
      providers: [
        {
          name: 'Gemini Text & Story',
          modality: 'text',
          modelId: 'gemini-2.5-flash',
          isConfigured: hasGeminiKey,
          status: hasGeminiKey ? 'configured_unverified' : 'unconfigured',
          estimatedCostBasis: 'Unverified; paid generation is disabled',
        },
        {
          name: 'Gemini Nano Banana 2.1',
          modality: 'image',
          modelId: 'gemini-nano-banana-2.1',
          isConfigured: hasGeminiKey,
          status: hasGeminiKey ? 'configured_unverified' : 'unconfigured',
          estimatedCostBasis: 'Unverified; image generation is not implemented',
        },
        {
          name: 'Gemini Omni Flash 1.1',
          modality: 'video',
          modelId: 'gemini-omni-1.1-flash',
          isConfigured: hasGeminiKey,
          status: hasGeminiKey ? 'configured_unverified' : 'unconfigured',
          estimatedCostBasis: 'Unverified; video generation is not implemented',
        },
        {
          name: 'Google Cloud Chirp 3 HD',
          modality: 'tts',
          modelId: 'chirp-3-hd',
          isConfigured: false, // separate Cloud TTS setup required
          status: 'unconfigured',
          estimatedCostBasis: 'Unverified; speech generation is not implemented',
        },
      ],
      youtubeOAuth: {
        isConfigured: false,
        scopesGranted: [],
        tokenProtected: false,
      },
      timezone: {
        configuredIana: configuredTimezone,
        isValidIana,
      },
      remediationSteps,
    };
  }

  // -------------------------------------------------------------------------
  // Google Flow Plans (flow.google.com 24-Frame Asset Automation)
  // -------------------------------------------------------------------------

  public async getGoogleFlowPlan(projectId: string, episodeId: string): Promise<GoogleFlowPlan | null> {
    assertIdentifier(projectId);
    await this.init();
    assertIdentifier(episodeId);
    const filePath = safePath(this.baseDir, path.join(this.baseDir, 'projects', projectId, 'flow_plans', `${episodeId}.json`));
    if (!this.hasDocument(filePath)) {
      return null;
    }
    const plan = await this.readJson<GoogleFlowPlan | null>(filePath, null);
    if (!plan) return null;
    plan.projectId = projectId;
    plan.outputDirectory = `./data/production_root/projects/${projectId}/assets/flow_renders/${episodeId}`;
    const sourceEpisode = await this.getEpisode(projectId, episodeId);
    plan.sourceState = !sourceEpisode ? 'missing_episode' : !Number.isSafeInteger(plan.sourceEpisodeRevision) ? 'unknown' : plan.sourceEpisodeRevision === (sourceEpisode.revision ?? 0) ? 'current' : 'stale';
    delete plan.creditEconomics;
    for (const batch of plan.batches) if (batch.status === 'verified' && !isFlowBatchVerified(batch)) {
      batch.status = 'pending'; delete batch.verification;
      batch.ingestedFrameCount = 0; batch.ingestedFiles = [];
      batch.missingFrames = Array.from({ length: batch.framesExpected }, (_, index) => (batch.batchIndex - 1) * 24 + index + 1);
    }
    recomputeFlowSummary(plan);
    for (const account of Object.values(plan.accounts)) Object.assign(account, { isPro: false, telemetryVerified: false, emailOrIdentifier: '', creditsBalance: 0, dailyCreditsRefill: 0, dailyBatchQuota: 0, status: 'idle' });
    return plan;
  }

  public async saveGoogleFlowPlan(projectId: string, callerPlan: GoogleFlowPlan): Promise<void> {
    const plan = structuredClone(callerPlan);
    assertIdentifier(projectId); assertIdentifier(plan.episodeId); assertRevision(plan.revision);
    if (plan.projectId !== undefined && plan.projectId !== projectId) throw new Error('Plan project scope mismatch');
    await this.init();
    const file = safePath(this.baseDir, path.join(this.baseDir, 'projects', projectId, 'flow_plans', `${plan.episodeId}.json`));
    let saved!: GoogleFlowPlan;
    await this.updateJson<GoogleFlowPlan | null>(file, null, current => {
      const project = this.store.read<ProjectMetadata | null>(path.join(this.baseDir, 'projects', projectId, 'project.json'), null);
      if (!project || project.id !== projectId) throw new Error('Plan project not found or mismatched');
      const episodes = this.store.read<EpisodeCard[]>(path.join(this.baseDir, 'projects', projectId, 'episodes.json'), []);
      assertUniqueEpisodeIdentities(episodes);
      const episode = episodes.find(item => item.id === plan.episodeId && item.projectId === projectId);
      if (!episode) throw new Error('Plan episode not found in project');
      if (!current && (plan.revision ?? 0) !== 0) throw new RevisionConflict(0);
      if (current && (plan.revision ?? 0) !== (current.revision ?? 0)) throw new RevisionConflict(current.revision ?? 0);
      if (!Number.isSafeInteger(plan.sourceEpisodeRevision) || plan.sourceEpisodeRevision! < 0) throw new Error('Plan has no valid source episode revision; replace it using current episode data');
      if (plan.sourceEpisodeRevision !== (episode.revision ?? 0)) throw new EpisodeSourceConflict(episode.revision ?? 0);
      delete plan.sourceState; // Read-time derived status is never stored as evidence.
      saved = { ...plan, projectId, revision: nextRevision(current?.revision), outputDirectory: `./data/production_root/projects/${projectId}/assets/flow_renders/${plan.episodeId}`, updatedAt: new Date().toISOString() };
      return saved;
    });
    Object.assign(callerPlan, structuredClone(saved), { sourceState: 'current' });
  }

  // -------------------------------------------------------------------------
  // Default Seed Initializer
  // -------------------------------------------------------------------------

  private seedDefaultProject(projectId: string): void {
    const projectDir = path.join(this.baseDir, 'projects', projectId);
    fs.mkdirSync(safePath(this.baseDir, projectDir), { recursive: true });

    const meta: ProjectMetadata = {
      id: projectId,
      name: 'The Quiet Hours: Ternfall',
      slug: 'the-quiet-hours-ternfall',
      description: 'Original illustrated survival thriller. Fictional coastal delta city, municipal water engineer Rhea Mistry, and an 8-beat mechanical signal mystery.',
      productionRoot: projectDir,
      createdAt: '2026-10-29T00:00:00.000Z',
      updatedAt: '2026-10-29T00:00:00.000Z',
      isArchived: false,
      activeSeriesId: 'series_ternfall_01',
    };

    this.store.write(path.join(projectDir, 'project.json'), meta);
    this.store.write(path.join(projectDir, 'series.json'), DEFAULT_SERIES_BIBLE);
    this.store.write(path.join(projectDir, 'episodes.json'), [PILOT_EPISODE_CARD]);

    const initialCanon: CanonEvent = {
      id: 'canon_001',
      episodeId: 'S01E001',
      storyDate: 'Day 01, 03:45 AM',
      physicalLocation: 'South Gate Water Control Works, Drainage Basin 3',
      charactersPresent: ['Rhea Mistry', 'Mara Ilyan'],
      whatCharactersLearned: {
        'rhea-mistry': 'Discovered that the 8-beat pressure oscillation is mechanical and reproducible; digital flood panel gave false "open" status.',
        'mara-ilyan': 'Witnessed the infected moving towards the vibration rhythm rather than human voices.',
      },
      resourceDeltas: [
        'Sealed South Gate manual sluice',
        'Sacrificed clean lower service corridor access to extract trapped shift workers',
      ],
      injuriesOrStatusChanges: ['Shift workers safely evacuated to upper dry mezzanine'],
      unresolvedClues: ['A second 8-beat pulse began sounding from the far north canal terminal.'],
      promisesMade: ['Rhea promised to check Kabir’s community radio frequency at dawn.'],
      consequencesSummary: 'South Gate remains an isolated safe pocket, but direct maintenance records in lower corridor are submerged.',
      isRetcon: false,
      createdAt: '2026-10-29T00:00:00.000Z',
    };
    this.store.write(path.join(projectDir, 'canon_ledger.json'), [initialCanon]);

    const initialClaim: ResearchClaim = {
      id: 'claim_001',
      projectId,
      claimText: 'Low-pressure municipal water mains can develop back-siphonage if negative pressure occurs during sudden main gate closure.',
      isFictionalLore: false,
      sourceUrl: 'https://en.wikipedia.org/wiki/Backflow_prevention_device',
      sourceTitle: 'Backflow prevention (reference to review)',
      verificationStatus: 'unverified',
      confidenceScore: 0,
      factCheckerNotes: 'Seeded example; source and claim require independent review.',
      humanApproved: false,
      relatedEpisodeIds: ['S01E001'],
      createdAt: '2026-10-29T00:00:00.000Z',
      updatedAt: '2026-10-29T00:00:00.000Z',
    };
    this.store.write(path.join(projectDir, 'research_claims.json'), [initialClaim]);
    this.store.write(path.join(projectDir, 'jobs.json'), []);
    this.store.write(path.join(projectDir, 'packages.json'), []);
    this.store.write(path.join(projectDir, 'autoproduce_runs.json'), []);
  }
}

export const storage = new StorageEngine();
