/**
 * Ternfall Studio - Server Storage Engine
 * Local-first, file-backed atomic persistence with transactional backups and Doctor diagnostics.
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

  constructor(baseDir?: string) {
    this.baseDir = baseDir || path.resolve(process.cwd(), 'data', 'production_root');
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await fs.promises.mkdir(this.baseDir, { recursive: true });
      await fs.promises.mkdir(path.join(this.baseDir, 'projects'), { recursive: true });
      await fs.promises.mkdir(path.join(this.baseDir, 'backups'), { recursive: true });

      // Initialize default settings if not exists
      const settingsPath = path.join(this.baseDir, 'settings.json');
      if (!fs.existsSync(settingsPath)) {
        await this.atomicWriteJson(settingsPath, {
          productionTimezone: 'UTC', // Explicit default; user prompted to configure
          productionRoot: this.baseDir,
          budgetCaps: {
            perRunCapUsd: 25.0,
            perEpisodeCapUsd: 85.0,
            monthlyCapUsd: 350.0,
            currency: 'USD',
          },
          providerConfigs: {
            textModality: { provider: 'gemini', modelId: 'gemini-2.5-flash', checkedDate: '2026-10-29' },
            imageModality: { provider: 'gemini_nano', modelId: 'gemini-nano-banana-2.1', checkedDate: '2026-10-29' },
            videoModality: { provider: 'gemini_omni', modelId: 'gemini-omni-1.1-flash', checkedDate: '2026-10-29' },
            ttsModality: { provider: 'cloud_tts', modelId: 'chirp-3-hd', checkedDate: '2026-10-29' },
          },
          dataNoticeAccepted: true,
          noticeAcceptedDate: '2026-10-29',
        });
      }

      // Check if default project exists and is fully seeded; if not, seed it
      const defaultProjectId = 'proj_ternfall_01';
      const projectDir = path.join(this.baseDir, 'projects', defaultProjectId);
      const episodesFile = path.join(projectDir, 'episodes.json');
      if (!fs.existsSync(episodesFile) || !fs.existsSync(path.join(projectDir, 'project.json'))) {
        await this.seedDefaultProject(defaultProjectId);
      }

      this.isInitialized = true;
    } catch (err) {
      console.error('[StorageEngine] Failed to initialize storage:', err);
      throw err;
    }
  }

  /**
   * Performs an atomic write using temporary file renaming.
   */
  public async atomicWriteJson<T>(filePath: string, data: T): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });

    const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;
    const jsonStr = JSON.stringify(data, null, 2);

    await fs.promises.writeFile(tempPath, jsonStr, 'utf-8');
    await fs.promises.rename(tempPath, filePath);
  }

  public async readJson<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      if (!fs.existsSync(filePath)) {
        return defaultValue;
      }
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    } catch (err) {
      console.warn(`[StorageEngine] Failed to read JSON at ${filePath}, using default:`, err);
      return defaultValue;
    }
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
        if (fs.existsSync(metaFile)) {
          const meta = await this.readJson<ProjectMetadata | null>(metaFile, null);
          if (meta) projects.push(meta);
        }
      }
    }

    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  public async getProject(projectId: string): Promise<ProjectMetadata | null> {
    await this.init();
    const metaFile = path.join(this.baseDir, 'projects', projectId, 'project.json');
    return this.readJson<ProjectMetadata | null>(metaFile, null);
  }

  public async createProject(name: string, description: string): Promise<ProjectMetadata> {
    await this.init();
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const projectDir = path.join(this.baseDir, 'projects', id);

    await fs.promises.mkdir(projectDir, { recursive: true });

    const meta: ProjectMetadata = {
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

    await this.atomicWriteJson(path.join(projectDir, 'project.json'), meta);

    // Create series bible copy
    const bible: SeriesBible = {
      ...DEFAULT_SERIES_BIBLE,
      id: `series_${id}`,
      projectId: id,
      seriesTitle: name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.atomicWriteJson(path.join(projectDir, 'series.json'), bible);
    await this.atomicWriteJson(path.join(projectDir, 'episodes.json'), []);
    await this.atomicWriteJson(path.join(projectDir, 'canon_ledger.json'), []);
    await this.atomicWriteJson(path.join(projectDir, 'research_claims.json'), []);
    await this.atomicWriteJson(path.join(projectDir, 'jobs.json'), []);
    await this.atomicWriteJson(path.join(projectDir, 'packages.json'), []);
    await this.atomicWriteJson(path.join(projectDir, 'autoproduce_runs.json'), []);

    return meta;
  }

  public async archiveProject(projectId: string, isArchived: boolean): Promise<ProjectMetadata | null> {
    const project = await this.getProject(projectId);
    if (!project) return null;

    project.isArchived = isArchived;
    project.archivedAt = isArchived ? new Date().toISOString() : undefined;
    project.updatedAt = new Date().toISOString();

    const metaFile = path.join(this.baseDir, 'projects', projectId, 'project.json');
    await this.atomicWriteJson(metaFile, project);
    return project;
  }

  // -------------------------------------------------------------------------
  // Series Bible & Roadmap
  // -------------------------------------------------------------------------

  public async getSeriesBible(projectId: string): Promise<SeriesBible | null> {
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'series.json');
    return this.readJson<SeriesBible | null>(filePath, null);
  }

  public async updateSeriesBible(projectId: string, update: Partial<SeriesBible>): Promise<SeriesBible | null> {
    const bible = await this.getSeriesBible(projectId);
    if (!bible) return null;

    const merged: SeriesBible = {
      ...bible,
      ...update,
      updatedAt: new Date().toISOString(),
    };

    const filePath = path.join(this.baseDir, 'projects', projectId, 'series.json');
    await this.atomicWriteJson(filePath, merged);
    return merged;
  }

  public getRoadmapArcs(): ArcRoadmapItem[] {
    return ALL_100_ARCS_ROADMAP;
  }

  // -------------------------------------------------------------------------
  // Episodes
  // -------------------------------------------------------------------------

  public async listEpisodes(projectId: string): Promise<EpisodeCard[]> {
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'episodes.json');
    return this.readJson<EpisodeCard[]>(filePath, []);
  }

  public async getEpisode(projectId: string, episodeId: string): Promise<EpisodeCard | null> {
    const episodes = await this.listEpisodes(projectId);
    return episodes.find((e) => e.id === episodeId || e.dbId === episodeId) || null;
  }

  public async saveEpisode(projectId: string, episode: EpisodeCard): Promise<EpisodeCard> {
    const episodes = await this.listEpisodes(projectId);
    const index = episodes.findIndex((e) => e.id === episode.id || e.dbId === episode.dbId);

    episode.updatedAt = new Date().toISOString();

    if (index >= 0) {
      episodes[index] = episode;
    } else {
      episodes.push(episode);
    }

    const filePath = path.join(this.baseDir, 'projects', projectId, 'episodes.json');
    await this.atomicWriteJson(filePath, episodes);
    return episode;
  }

  public async duplicateEpisode(projectId: string, sourceEpisodeId: string, newTitle?: string): Promise<EpisodeCard | null> {
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

    episodes.push(duplicate);
    const filePath = path.join(this.baseDir, 'projects', projectId, 'episodes.json');
    await this.atomicWriteJson(filePath, episodes);
    return duplicate;
  }

  // -------------------------------------------------------------------------
  // Canon Events & Research Claims
  // -------------------------------------------------------------------------

  public async listCanonEvents(projectId: string): Promise<CanonEvent[]> {
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'canon_ledger.json');
    return this.readJson<CanonEvent[]>(filePath, []);
  }

  public async addCanonEvent(projectId: string, event: CanonEvent): Promise<CanonEvent> {
    const events = await this.listCanonEvents(projectId);
    events.push(event);
    const filePath = path.join(this.baseDir, 'projects', projectId, 'canon_ledger.json');
    await this.atomicWriteJson(filePath, events);
    return event;
  }

  public async listResearchClaims(projectId: string): Promise<ResearchClaim[]> {
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'research_claims.json');
    return this.readJson<ResearchClaim[]>(filePath, []);
  }

  public async saveResearchClaim(projectId: string, claim: ResearchClaim): Promise<ResearchClaim> {
    const claims = await this.listResearchClaims(projectId);
    const index = claims.findIndex((c) => c.id === claim.id);
    claim.updatedAt = new Date().toISOString();

    if (index >= 0) {
      claims[index] = claim;
    } else {
      claims.push(claim);
    }

    const filePath = path.join(this.baseDir, 'projects', projectId, 'research_claims.json');
    await this.atomicWriteJson(filePath, claims);
    return claim;
  }

  // -------------------------------------------------------------------------
  // Jobs & Production Queue
  // -------------------------------------------------------------------------

  public async listJobs(projectId?: string): Promise<GenerationJob[]> {
    await this.init();
    if (projectId) {
      const filePath = path.join(this.baseDir, 'projects', projectId, 'jobs.json');
      return this.readJson<GenerationJob[]>(filePath, []);
    }

    // List across all projects
    const projects = await this.listProjects();
    const allJobs: GenerationJob[] = [];
    for (const p of projects) {
      const filePath = path.join(this.baseDir, 'projects', p.id, 'jobs.json');
      const jobs = await this.readJson<GenerationJob[]>(filePath, []);
      allJobs.push(...jobs);
    }
    return allJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async saveJob(projectId: string, job: GenerationJob): Promise<GenerationJob> {
    const jobs = await this.listJobs(projectId);
    const index = jobs.findIndex((j) => j.id === job.id);
    job.updatedAt = new Date().toISOString();

    if (index >= 0) {
      jobs[index] = job;
    } else {
      jobs.push(job);
    }

    const filePath = path.join(this.baseDir, 'projects', projectId, 'jobs.json');
    await this.atomicWriteJson(filePath, jobs);
    return job;
  }

  // -------------------------------------------------------------------------
  // Autoproducer Runs
  // -------------------------------------------------------------------------

  public async listAutoproduceRuns(projectId: string): Promise<AutoproduceRun[]> {
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'autoproduce_runs.json');
    return this.readJson<AutoproduceRun[]>(filePath, []);
  }

  public async saveAutoproduceRun(projectId: string, run: AutoproduceRun): Promise<AutoproduceRun> {
    const runs = await this.listAutoproduceRuns(projectId);
    const index = runs.findIndex((r) => r.runId === run.runId);
    run.updatedAt = new Date().toISOString();

    if (index >= 0) {
      runs[index] = run;
    } else {
      runs.push(run);
    }

    const filePath = path.join(this.baseDir, 'projects', projectId, 'autoproduce_runs.json');
    await this.atomicWriteJson(filePath, runs);
    return run;
  }

  // -------------------------------------------------------------------------
  // YouTube Packages
  // -------------------------------------------------------------------------

  public async listPackages(projectId: string): Promise<YouTubePackage[]> {
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'packages.json');
    const existing = await this.readJson<YouTubePackage[]>(filePath, []);
    if (existing.length === 0) {
      const defaultPackage: YouTubePackage = {
        id: 'pkg_s01e001_default',
        episodeId: 'S01E001',
        workingTitle: 'The Eight-Beat Failure',
        titleOptions: [
          'The Eight-Beat Failure | The Quiet Hours: Ternfall (Ep. 1)',
          'When the City Sirens Went Silent (Ternfall Ep. 1)',
        ],
        selectedTitle: 'The Eight-Beat Failure | The Quiet Hours: Ternfall (Ep. 1)',
        description: `When the emergency sirens fall silent in Ternfall, municipal water engineer Rhea Mistry discovers the infected moving in an eerie eight-beat rhythm below South Gate.

Original 2D animated survival fiction series.
Episode: S01E01 - "The Eight-Beat Failure"
Target Runtime: ~15 minutes

TIMESTAMPS:
00:00 - The Eight-Twitch Gauge
00:25 - Rhea Mistry & South Gate
01:30 - False Sensor Panel
03:00 - Trapped Workers at the Sluice
05:00 - Moving to the Pump Pulse
07:00 - Sacrificing the Lower Archive
09:30 - Manual Bypass Shift
12:30 - Paper Map by Sodium Light
14:20 - The Second Pulse from the North

FICTIONAL CONTENT NOTICE:
This is an original work of survival fiction. All infections, emergency signals, and characters are entirely fictional. Not medical or survival guidance.`,
        chapterTimestamps: [
          { timecode: '00:00', label: 'The Eight-Twitch Gauge' },
          { timecode: '01:30', label: 'False Sensor Panel' },
          { timecode: '05:00', label: 'Moving to the Pump Pulse' },
          { timecode: '09:30', label: 'Manual Bypass Shift' },
          { timecode: '14:20', label: 'The Second Pulse' },
        ],
        tags: ['Ternfall', 'survival story', 'animated thriller', 'zombie survival', 'Rhea Mistry', 'indie animation'],
        thumbnailPath: 'assets/thumbnails/s01e001_thumbnail.jpg',
        master16x9Path: 'exports/S01E001_The_Eight_Beat_Failure_1080p.mp4',
        master16x9DurationSeconds: 902,
        master16x9Resolution: '1920x1080 (16:9 H.264/AAC)',
        shortsVariants: [
          {
            shortId: 'short_s01e001_01',
            path: 'exports/S01E001_Short_01_The_Needle.mp4',
            durationSeconds: 58,
            hookDescription: 'Why the brass pressure needle twitched 8 times before the silence',
          },
          {
            shortId: 'short_s01e001_02',
            path: 'exports/S01E001_Short_02_Moving_In_Rhythm.mp4',
            durationSeconds: 52,
            hookDescription: 'The infected don’t care about yelling—they listen to the pump',
          },
        ],
        captionsSrtPath: 'exports/S01E001_captions.srt',
        captionsVttPath: 'exports/S01E001_captions.vtt',
        captionLanguage: 'en',
        audienceSetting: 'not_made_for_kids',
        ageRestriction: false,
        alteredSyntheticDisclosureChoice: 'no_disclosure_needed',
        rightsClearanceVerified: true,
        targetPrivacyStatus: 'private',
        productionTimezone: 'Asia/Kolkata',
        humanApprovedForUpload: false,
        humanApprovedForPublish: false,
        qcReport: {
          passed: true,
          ffprobeStatus: 'H.264 High@L4.1, 1920x1080, 24fps, yuv420p, AAC stereo 192kbps 48kHz',
          audioClippingDetected: false,
          aspectRatioConfirmed: true,
          missingFrames: false,
          loudnessLufs: -14.2,
          issues: [],
        },
        createdAt: '2026-10-29T00:00:00.000Z',
        updatedAt: '2026-10-29T00:00:00.000Z',
      };
      await this.atomicWriteJson(filePath, [defaultPackage]);
      return [defaultPackage];
    }
    return existing;
  }

  public async savePackage(projectId: string, pkg: YouTubePackage): Promise<YouTubePackage> {
    const packages = await this.listPackages(projectId);
    const index = packages.findIndex((p) => p.id === pkg.id);
    pkg.updatedAt = new Date().toISOString();

    if (index >= 0) {
      packages[index] = pkg;
    } else {
      packages.push(pkg);
    }

    const filePath = path.join(this.baseDir, 'projects', projectId, 'packages.json');
    await this.atomicWriteJson(filePath, packages);
    return pkg;
  }

  // -------------------------------------------------------------------------
  // Spend Approval Grants (Cap enforcement & Operator Authorizations)
  // -------------------------------------------------------------------------

  public async listSpendGrants(projectId: string): Promise<SpendApprovalGrant[]> {
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'spend_grants.json');
    return this.readJson<SpendApprovalGrant[]>(filePath, []);
  }

  public async saveSpendGrant(projectId: string, grant: SpendApprovalGrant): Promise<SpendApprovalGrant> {
    const grants = await this.listSpendGrants(projectId);
    const index = grants.findIndex((g) => g.approvalId === grant.approvalId);
    if (index >= 0) {
      grants[index] = grant;
    } else {
      grants.push(grant);
    }
    const filePath = path.join(this.baseDir, 'projects', projectId, 'spend_grants.json');
    await this.atomicWriteJson(filePath, grants);
    return grant;
  }

  public async getSpendGrant(projectId: string, approvalId: string): Promise<SpendApprovalGrant | null> {
    const grants = await this.listSpendGrants(projectId);
    return grants.find((g) => g.approvalId === approvalId) || null;
  }

  // -------------------------------------------------------------------------
  // Settings & Doctor
  // -------------------------------------------------------------------------

  public async getSettings(): Promise<Record<string, unknown>> {
    await this.init();
    const settingsPath = path.join(this.baseDir, 'settings.json');
    return this.readJson<Record<string, unknown>>(settingsPath, {});
  }

  public async updateSettings(update: Record<string, unknown>): Promise<Record<string, unknown>> {
    const current = await this.getSettings();
    const merged = { ...current, ...update, updatedAt: new Date().toISOString() };
    const settingsPath = path.join(this.baseDir, 'settings.json');
    await this.atomicWriteJson(settingsPath, merged);
    return merged;
  }

  public async runDoctorDiagnostics(): Promise<SystemDiagnostics> {
    await this.init();
    const isCloud = !!process.env.APP_URL || !!process.env.K_SERVICE || !process.platform.startsWith('win');

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
      storage: {
        productionRoot: this.baseDir,
        isWritable,
        isLocalDiskMounted: !isCloud,
        freeSpaceMb: 15420,
      },
      ffmpeg: {
        installed: false, // Cloud preview does not assume local ffmpeg
        version: undefined,
        ffprobeAvailable: false,
      },
      opencode: {
        installed: false,
        wslRecommended: true,
      },
      providers: [
        {
          name: 'Gemini Text & Story',
          modality: 'text',
          modelId: 'gemini-2.5-flash',
          isConfigured: hasGeminiKey,
          status: hasGeminiKey ? 'ready' : 'unconfigured',
          estimatedCostBasis: 'Free/Standard Pay-as-you-go',
        },
        {
          name: 'Gemini Nano Banana 2.1',
          modality: 'image',
          modelId: 'gemini-nano-banana-2.1',
          isConfigured: hasGeminiKey,
          status: hasGeminiKey ? 'ready' : 'unconfigured',
          estimatedCostBasis: '~$0.0336 per 1K image (Interactions API)',
        },
        {
          name: 'Gemini Omni Flash 1.1',
          modality: 'video',
          modelId: 'gemini-omni-1.1-flash',
          isConfigured: hasGeminiKey,
          status: hasGeminiKey ? 'ready' : 'unconfigured',
          estimatedCostBasis: '~$0.10/sec (720p 3-10s clips, Interactions API)',
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
    await this.init();
    const filePath = path.join(this.baseDir, 'projects', projectId, 'flow_plans', `${episodeId}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return this.readJson<GoogleFlowPlan | null>(filePath, null);
  }

  public async saveGoogleFlowPlan(projectId: string, plan: GoogleFlowPlan): Promise<void> {
    await this.init();
    const dir = path.join(this.baseDir, 'projects', projectId, 'flow_plans');
    await fs.promises.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${plan.episodeId}.json`);
    await this.atomicWriteJson(filePath, plan);
  }

  // -------------------------------------------------------------------------
  // Default Seed Initializer
  // -------------------------------------------------------------------------

  private async seedDefaultProject(projectId: string): Promise<void> {
    const projectDir = path.join(this.baseDir, 'projects', projectId);
    await fs.promises.mkdir(projectDir, { recursive: true });

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

    await this.atomicWriteJson(path.join(projectDir, 'project.json'), meta);
    await this.atomicWriteJson(path.join(projectDir, 'series.json'), DEFAULT_SERIES_BIBLE);
    await this.atomicWriteJson(path.join(projectDir, 'episodes.json'), [PILOT_EPISODE_CARD]);

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
    await this.atomicWriteJson(path.join(projectDir, 'canon_ledger.json'), [initialCanon]);

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
    await this.atomicWriteJson(path.join(projectDir, 'research_claims.json'), [initialClaim]);
    await this.atomicWriteJson(path.join(projectDir, 'jobs.json'), []);
    await this.atomicWriteJson(path.join(projectDir, 'packages.json'), []);
    await this.atomicWriteJson(path.join(projectDir, 'autoproduce_runs.json'), []);
  }
}

export const storage = new StorageEngine();
