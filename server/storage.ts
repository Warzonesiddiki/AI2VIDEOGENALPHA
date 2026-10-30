import { arcCard, validateArcExpansion } from './lib/arcExpansion.ts';
import { DATA_NOTICE_VERSION } from '../src/core/dataNotice.ts';
import { settingsView, type DataNoticeEvent } from './lib/dataNotice.ts';
import { validateProjectText } from '../src/core/projects.ts';
import { validateResearchClaim, unreviewedResearchClaim } from './lib/researchClaims.ts';
import { recomputeFlowSummary, isFlowBatchVerified } from '../src/core/flow.ts';
import { RevisionConflict, assertRevision } from './lib/conflicts.ts';
import { randomUUID } from 'node:crypto';
import { SpendLedger, type ReserveSpend, type ReservationState } from './lib/spendLedger.ts';
import { DocumentStore } from './lib/documents.ts';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { safePath, assertIdentifier } from './lib/paths.ts';
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
      await fs.promises.mkdir(path.join(this.baseDir, 'projects'), { recursive: true });
      await fs.promises.mkdir(path.join(this.baseDir, 'backups'), { recursive: true });

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
        const projectDir = path.join(this.baseDir, 'projects', defaultProjectId);
        const episodesFile = path.join(projectDir, 'episodes.json');
        if (!fs.existsSync(projectDir) || (fs.readdirSync(projectDir).length === 0 && !this.store.has(path.join(projectDir, 'project.json')))) {
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
          if (meta) projects.push({ ...meta, revision: meta.revision ?? 0 });
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
    return meta ? { ...meta, revision: meta.revision ?? 0 } : null;
  }

  /** Consistent metadata snapshot. Media files are intentionally not copied. */
  public async backupMetadata(): Promise<{ path: string; includesMedia: false }> {
    await this.init();
    const destination = safePath(this.baseDir, `backups/metadata_${randomUUID()}.sqlite`);
    this.store.backup(destination);
    return { path: destination, includesMedia: false };
  }

  public async createProject(name: string, description: string): Promise<ProjectMetadata> {
    validateProjectText(name, description);
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

      // Create series bible copy
      const bible: SeriesBible = {
        ...DEFAULT_SERIES_BIBLE,
        id: `series_${id}`,
        projectId: id,
        seriesTitle: name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
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
    assertIdentifier(projectId); assertRevision(expectedRevision);
    if (typeof isArchived !== 'boolean') throw new Error('isArchived must be a boolean');
    await this.init();
    const file = path.join(this.baseDir, 'projects', projectId, 'project.json');
    return this.updateJson<ProjectMetadata | null>(file, null, project => {
      if (!project) return null;
      if (project.id !== projectId) throw new Error('Project identity mismatch');
      if ((expectedRevision ?? 0) !== (project.revision ?? 0)) throw new RevisionConflict(project.revision ?? 0);
      return { ...project, revision: (project.revision ?? 0) + 1, isArchived,
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

  public async updateSeriesBible(projectId: string, update: Partial<SeriesBible>): Promise<SeriesBible | null> {
    assertIdentifier(projectId);
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'series.json');
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
    return this.updateJson<SeriesBible | null>(filePath, null, bible => {
      if (!bible) return null;
      if ((update.id !== undefined && update.id !== bible.id) || (update.projectId !== undefined && update.projectId !== projectId) || (update.createdAt !== undefined && update.createdAt !== bible.createdAt)) throw new Error('Series identity is immutable');
      if ((update.revision ?? 0) !== (bible.revision ?? 0)) throw new RevisionConflict(bible.revision ?? 0);
      return { ...bible, ...update, id: bible.id, projectId: bible.projectId, createdAt: bible.createdAt, revision: (bible.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
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
    assertIdentifier(projectId);
    const episodes = await this.listEpisodes(projectId);
    return episodes.find((e) => e.id === episodeId || e.dbId === episodeId) || null;
  }

  public async expandArc(projectId: string, input: unknown): Promise<{ arcTitle: string; createdCards: EpisodeCard[] }> {
    assertIdentifier(projectId);
    const request = validateArcExpansion(structuredClone(input));
    await this.init();
    return this.store.transaction(() => {
      const dir = path.join(this.baseDir, 'projects', projectId);
      const project = this.store.read<ProjectMetadata | null>(path.join(dir, 'project.json'), null);
      if (!project || project.id !== projectId) throw new Error('Arc project not found or mismatched');
      const series = this.store.read<SeriesBible | null>(path.join(dir, 'series.json'), null);
      if (!series || series.id !== project.activeSeriesId || series.projectId !== projectId) throw new Error('Arc series scope mismatch');
      const arc = this.getRoadmapArcs().find(item => item.arcNumber === request.arcNumber);
      if (!arc) throw new Error('Arc not found');
      const requestFile = path.join(dir, 'arc_expansions.json');
      const requests = this.store.read<Array<{ key: string; arcNumber: number; count: number; result: { arcTitle: string; createdCards: EpisodeCard[] } }>>(requestFile, []);
      const previous = requests.find(item => item.key === request.idempotencyKey);
      if (previous) {
        if (previous.arcNumber !== request.arcNumber || previous.count !== request.count) throw Object.assign(new Error('Idempotency key conflicts with a different arc expansion'), { code: 'IDEMPOTENCY_CONFLICT' });
        return previous.result; // Original creation snapshot, not current edited cards.
      }
      const episodeFile = path.join(dir, 'episodes.json');
      const episodes = this.store.read<EpisodeCard[]>(episodeFile, []);
      let next = 0;
      for (const episode of episodes) {
        for (const value of [episode.episodeNumber, episode.episodeNumberInSeries, Number(/^S\d+E(\d+)$/.exec(episode.id)?.[1] ?? 0)]) {
          if (value === undefined) continue;
          if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid legacy episode numbering; reconcile before expansion');
          next = Math.max(next, value);
        }
      }
      if (!Number.isSafeInteger(next + request.count)) throw new Error('Episode numbering exhausted');
      const createdCards = Array.from({ length: request.count }, (_, index) => arcCard(project, arc, next + index + 1, index + 1));
      if (createdCards.some(card => episodes.some(item => item.id === card.id || item.dbId === card.dbId))) throw new Error('Episode allocation collision');
      const result = { arcTitle: arc.arcTitle, createdCards };
      this.store.write(episodeFile, [...episodes, ...createdCards]);
      this.store.write(requestFile, [...requests, { key: request.idempotencyKey, arcNumber: request.arcNumber, count: request.count, result }]);
      return result;
    });
  }

  public async saveEpisode(projectId: string, callerEpisode: EpisodeCard): Promise<EpisodeCard> {
    const episode = structuredClone(callerEpisode);
    assertIdentifier(projectId);
    await this.init();
    assertIdentifier(episode.id); assertIdentifier(episode.dbId); assertRevision(episode.revision);
    if (episode.projectId !== projectId) throw new Error('Episode project scope mismatch');
    const file = path.join(this.baseDir, 'projects', projectId, 'episodes.json');
    let saved!: EpisodeCard;
    await this.updateJson<EpisodeCard[]>(file, [], items => {
      const project = this.store.read<ProjectMetadata | null>(path.join(this.baseDir, 'projects', projectId, 'project.json'), null);
      if (!project || project.id !== projectId) throw new Error('Episode project not found or mismatched');
      if (episode.seriesId !== project.activeSeriesId) throw new Error('Episode series scope mismatch');
      const index = items.findIndex(item => item.id === episode.id || item.dbId === episode.dbId);
      const current = index >= 0 ? items[index] : undefined;
      if (!current && (episode.revision ?? 0) !== 0) throw new RevisionConflict(0);
      if (current && (current.id !== episode.id || current.dbId !== episode.dbId)) throw new Error('Episode identity cannot be changed');
      if (current && (episode.revision ?? 0) !== (current.revision ?? 0)) throw new RevisionConflict(current.revision ?? 0);
      saved = { ...episode, revision: (current?.revision ?? 0) + 1, createdAt: current?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (index < 0) items.push(saved); else items[index] = saved;
      return items;
    });
    Object.assign(callerEpisode, structuredClone(saved)); // Existing typed CLI callers retain the new revision.
    return saved;
  }

  public async duplicateEpisode(projectId: string, sourceEpisodeId: string, newTitle?: string): Promise<EpisodeCard | null> {
    assertIdentifier(projectId);
    const source = await this.getEpisode(projectId, sourceEpisodeId);
    if (!source) return null;

    const episodes = await this.listEpisodes(projectId);
    const nextEpNum = episodes.length + 1;
    const newId = `S01E${String(nextEpNum).padStart(3, '0')}`;
    const newDbId = `ep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const duplicate: EpisodeCard = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      dbId: newDbId,
      episodeNumber: nextEpNum,
      workingTitle: newTitle || `${source.workingTitle} (Variant)`,
      status: 'planned',
      provenanceSourceEpisodeId: source.id,
      staleDownstreamAssets: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.baseDir, 'projects', projectId, 'episodes.json');
    await this.updateJson<EpisodeCard[]>(filePath, [], latest => {
      const next = Math.max(0, ...latest.map(item => item.episodeNumber ?? 0)) + 1;
      duplicate.id = `S01E${String(next).padStart(3, '0')}`;
      duplicate.episodeNumber = next;
      duplicate.revision = 1;
      return [...latest, duplicate];
    });
    return duplicate;
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

  public async addCanonEvent(projectId: string, event: CanonEvent): Promise<CanonEvent> {
    assertIdentifier(projectId);
    await this.init();
    const file = path.join(this.baseDir, 'projects', projectId, 'canon_ledger.json');
    await this.updateJson<CanonEvent[]>(file, [], events => {
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
    const checked = validateResearchClaim(projectId, claim);
    await this.init();
    if (!(await this.getProject(projectId))) throw new Error('Research project not found');
    const file = path.join(this.baseDir, 'projects', projectId, 'research_claims.json');
    let saved!: ResearchClaim;
    await this.updateJson<ResearchClaim[]>(file, [], items => {
      const index = items.findIndex(item => item.id === checked.id);
      const current = items[index];
      if ((checked.revision ?? 0) !== (current?.revision ?? 0)) throw new RevisionConflict(current?.revision ?? 0);
      if (current && (current.projectId !== projectId || current.createdAt !== checked.createdAt)) throw new Error('Research identity is immutable');
      saved = { ...checked, revision: (current?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
      if (index < 0) items.push(saved); else items[index] = saved;
      return items;
    });
    return saved;
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
      saved = { ...record, projectId, revision: (current?.revision ?? 0) + 1, updatedAt: new Date().toISOString() };
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
      return (await this.readJson<GenerationJob[]>(filePath, [])).map(job => ({ ...job, revision: job.revision ?? 0 }));
    }

    // List across all projects
    const projects = await this.listProjects();
    const allJobs: GenerationJob[] = [];
    for (const p of projects) {
      const filePath = path.join(this.baseDir, 'projects', p.id, 'jobs.json');
      const jobs = await this.readJson<GenerationJob[]>(filePath, []);
      allJobs.push(...jobs.map(job => ({ ...job, revision: job.revision ?? 0 })));
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
    return (await this.readJson<AutoproduceRun[]>(filePath, [])).map(run => ({ ...run, revision: run.revision ?? 0 }));
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
    return existing.map(pkg => ({ ...pkg, projectId: pkg.projectId ?? projectId, revision: pkg.revision ?? 0 }));
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

  public async updateSettings(update: Record<string, unknown>): Promise<Record<string, unknown>> {
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
    await this.init();
    const settingsPath = path.join(this.baseDir, 'settings.json');
    return this.updateJson<Record<string, unknown>>(settingsPath, {}, current => {
      if ((update.revision ?? 0) !== (current.revision ?? 0)) throw new RevisionConflict((current.revision ?? 0) as number);
      const revision = ((current.revision ?? 0) as number) + 1;
      const eventPath = path.join(this.baseDir, 'data_notice_events.json');
      const events = this.store.read<DataNoticeEvent[]>(eventPath, []);
      if (update.dataNoticeAccepted !== undefined) {
        events.push({ version: DATA_NOTICE_VERSION, accepted: update.dataNoticeAccepted as boolean, recordedAt: new Date().toISOString(), settingsRevision: revision, channel: 'operator-settings' });
        this.store.write(eventPath, events); // Same transaction as settings; caller cannot provide events/timestamps.
      }
      return settingsView({ ...current, ...update, revision, updatedAt: new Date().toISOString() }, events);
    });
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
      probe('ffmpeg', ['-version']), probe('ffprobe', ['-version']), probe('opencode', ['--version']),
    ]);
    const disk = await fs.promises.statfs(this.baseDir).catch(() => undefined);

    let isWritable = false;
    try {
      const testFile = path.join(this.baseDir, `.test_write_${Date.now()}`);
      await fs.promises.writeFile(testFile, 'ok');
      await fs.promises.unlink(testFile);
      isWritable = true;
    } catch {
      isWritable = false;
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
      remediationSteps.push('Production root path is not writable. Check folder permissions.');
    }
    if (!hasGeminiKey) {
      remediationSteps.push('GEMINI_API_KEY is not configured. Add your key in the AI Studio Secrets panel or local .env.');
    }
    if (isCloud) {
      remediationSteps.push('Hosted Cloud Preview Mode active: local Windows C:\\ paths, GPU, and native FFmpeg/OpenCode are not attached to this browser session. Export to run locally on Windows/WSL.');
    }
    if (!isValidIana || configuredTimezone === 'UTC') {
      remediationSteps.push('Explicit production IANA timezone is recommended before scheduling video releases (e.g., Asia/Kolkata or America/New_York).');
    }

    return {
      runtimeEnvironment: isCloud ? 'cloud_preview' : (process.platform === 'win32' ? 'local_windows' : 'local_linux'),
      nodeVersion: process.version,
      osPlatform: `${process.platform} (${process.arch})`,
      // Hardware/encoder capability is unknown until measured, not a fixed laptop profile.
      storage: {
        productionRoot: this.baseDir,
        isWritable,
        isLocalDiskMounted: !isCloud,
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
          estimatedCostBasis: 'Free/Standard Pay-as-you-go',
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
          estimatedCostBasis: '1M chars free/mo, then $30/M chars',
        },
      ],
      youtubeOAuth: {
        isConfigured: false,
        scopesGranted: [],
        tokenProtected: true,
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
      if (!episodes.some(episode => episode.id === plan.episodeId && episode.projectId === projectId)) throw new Error('Plan episode not found in project');
      if (!current && (plan.revision ?? 0) !== 0) throw new RevisionConflict(0);
      if (current && (plan.revision ?? 0) !== (current.revision ?? 0)) throw new RevisionConflict(current.revision ?? 0);
      saved = { ...plan, projectId, revision: (current?.revision ?? 0) + 1, outputDirectory: `./data/production_root/projects/${projectId}/assets/flow_renders/${plan.episodeId}`, updatedAt: new Date().toISOString() };
      return saved;
    });
    Object.assign(callerPlan, structuredClone(saved));
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
      sourceTitle: 'Backflow Prevention & Water Distribution Hydraulics',
      publisher: 'Municipal Water Engineering Standard Manual',
      accessDate: '2026-10-29',
      evidenceExcerpt: 'Negative pressure (backsiphonage) occurs when reduced pressure in downstream piping pulls water back into distribution lines.',
      verificationStatus: 'verified',
      confidenceScore: 0.95,
      factCheckerNotes: 'Accurate real-world hydraulic principle used in Rhea’s dialogue at South Gate.',
      humanApproved: true,
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
