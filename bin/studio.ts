#!/usr/bin/env tsx
import { reviewStoryCraft } from '../src/core/storyCraft.ts';
import { verifyFlowBatch } from '../server/flowVerification.ts';
import { localMedia } from '../server/localMedia.ts';
import 'dotenv/config';
import { safePath, assertIdentifier } from '../server/lib/paths.ts';
/**
 * Ternfall Studio - Safe Application CLI (`studio`)
 * Exposes a stable, typed, versioned automation interface for operators and OpenCode.
 * Adheres strictly to Master Project Rules, Prompt 06, and Matrix 15.
 */

import { storage } from '../server/storage.ts';
import {
  calculateNarrationPacing,
  calculateWordCount,
  checkEpisodeDistinctness,
  validateCanonHardRules,
} from '../src/core/rules.ts';
import {
  validateResearchSourceUrl,
  sanitizeUntrustedResearchContent,
} from '../src/core/sources.ts';
import {
  evaluateSpendAuthorization,
  BudgetCaps,
} from '../src/core/budget.ts';
import { EpisodeCard, SpendApprovalGrant, CanonEvent, GoogleFlowPlan, GoogleFlowBatch } from '../src/types/index.ts';
import {
  createGoogleFlowPlan,
  validateBatchIngestion,
  computeFlowCheckpoint,
  createFlowAutoproduceOrchestrator,
} from '../src/core/flow.ts';
import path from 'node:path';
import fs from 'node:fs';

const VERSION = '1.0.0';

interface CliArgs {
  command: string;
  subcommand?: string;
  args: string[];
  flags: Record<string, string | boolean>;
  isJson: boolean;
}

function parseCliArgs(rawArgs: string[]): CliArgs {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let isJson = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--json') {
      isJson = true;
      flags.json = true;
    } else if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      if (parts.length > 1) {
        flags[key] = parts[1];
      } else if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('-')) {
        flags[key] = rawArgs[i + 1];
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg.startsWith('-')) {
      flags[arg.slice(1)] = true;
    } else {
      args.push(arg);
    }
  }

  const [command = '', subcommand, ...restArgs] = args;
  return {
    command: command.toLowerCase(),
    subcommand: subcommand ? subcommand.toLowerCase() : undefined,
    args: subcommand ? restArgs : [],
    flags,
    isJson,
  };
}

function printResult(data: any, isJson: boolean, success = true): void {
  if (isJson) {
    console.log(JSON.stringify({ ok: success, data }, null, 2));
  } else {
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

function printError(message: string, isJson: boolean, exitCode = 1): never {
  if (isJson) {
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  } else {
    console.error(`[studio error] ${message}`);
  }
  process.exit(exitCode);
}

/**
 * Validates path security: rejects directory traversal (..) and symlink escape.
 */
export function validateSafeProjectPath(targetPath: string, allowedRoot: string): string {
  return safePath(allowedRoot, targetPath);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const cli = parseCliArgs(rawArgs);

  if (cli.flags.version || cli.command === '--version') {
    printResult({ version: VERSION }, cli.isJson);
    return;
  }

  if (cli.flags.help || cli.command === '--help' || !cli.command) {
    const helpText = `
Ternfall Studio CLI (studio) v${VERSION}
Safe automation interface for single-operator production and OpenCode agents.

COMMANDS:
  studio doctor [--json]
      Inspect runtime, storage, FFmpeg/FFprobe, OpenCode and provider health.

  studio project list|show <id>|create <name>|archive <id>|unarchive <id>|backup
      Archive/unarchive requires --expected-revision <revision from show/list>. Metadata backup excludes media.

  studio series list|validate|export
      Inspect world bible, cast sheets, and world rules.

  studio episode list|show <epId>|check <epId>|approve <epId>
      Inspect episode cards, run distinctness check, approve script.

  studio episode create --id <epId> --title <title> [--arc <n>] [--season <n>]
      Create a new episode card initialized with the standard 9-beat anchor structure.

  studio episode update-script <epId> (--text <text> | --file <path>) [--author <name>]
      Submit a new script revision; automatically runs word count, pacing, and canon validation.

  studio episode add-beat <epId> --name <beatName> --snippet <dialogueOrSnippet>
      Add or update a narrative beat on an episode's beat sheet.

  studio arc expand --arc <number> [--count <n>] --idempotency-key <key>
      Expand a 10-episode arc into distinct cards (Hard cap: max 20 cards).

  studio research list|add <claim> [--url <url>]
      Audit fact vs fictional lore claims with SSRF defense.

  studio continuity report|add --episode <id> --location <loc> --summary <text>
      Inspect canon events or record newly discovered clues/status changes.

  studio spend authorize --amount <usd> [--episode <id>] [--hours <n>]
      Operator only: Mint an expiring spend authorization grant with hard dollar ceiling.

  studio spend list
      List all operator-issued spend approval grants and status.

  studio episode produce --episode <id> --approval-id <id> [--profile <profile>]
      Trigger supervised autoproduction run within user-authorized spend cap.

  studio media purge-checkpoints <render-id>  (terminal jobs only; retains sources/exports)
  studio media enqueue --episode <id> --frames <24..21600> --audio narration.wav --idempotency-key <key>
      Queue a real local 1080p render using existing PNGs and original audio (no provider spend).
  studio media work|status [jobId]|cancel <jobId>|retry <jobId>|recover
      Process one queued render, inspect measured results, cancel/retry, or recover dead workers.

  studio render script <epId> [--save]
      Retired: no scripts are generated. Use studio media enqueue/work with supplied assets.

  studio run status <runId>|resume <runId>|cancel <runId>
      Inspect or control resumable autoproducer jobs.

  studio youtube preflight|package <epId>
      Run 10-point upload safety gate and generate Studio Runbook.

  studio ai-prompt
      Output turnkey system prompt and workflow contract for any local AI agent.

FLAGS:
  --json          Output machine-readable JSON
  --help          Display this help message
  --version       Display version
`;
    printResult(helpText.trim(), cli.isJson);
    return;
  }

  await storage.init();
  const defaultProjectId = (cli.flags.project as string) || 'proj_ternfall_01';
  assertIdentifier(defaultProjectId);
  for (const value of [cli.flags.episode, cli.flags.id]) if (value !== undefined) assertIdentifier(value);

  try {
    switch (cli.command) {
      case 'doctor': {
        const diagnostics = await storage.runDoctorDiagnostics();
        printResult(diagnostics, cli.isJson);
        break;
      }

      case 'project': {
        if (cli.subcommand === 'list') {
          const list = await storage.listProjects();
          printResult(list, cli.isJson);
        } else if (cli.subcommand === 'create') {
          const name = cli.args[0] || (cli.flags.name as string);
          if (!name) printError('Project name required for "studio project create <name>"', cli.isJson);
          const project = await storage.createProject(name, (cli.flags.description as string) ?? '');
          printResult(project, cli.isJson);
        } else if (cli.subcommand === 'show') {
          const id = cli.args[0] || defaultProjectId; assertIdentifier(id);
          const project = await storage.getProject(id);
          if (!project) throw new Error('Project not found');
          printResult(project, cli.isJson);
        } else if (cli.subcommand === 'archive' || cli.subcommand === 'unarchive') {
          const id = cli.args[0] || defaultProjectId; assertIdentifier(id);
          const token = cli.flags['expected-revision'];
          if (typeof token !== 'string' || !/^\d+$/.test(token)) throw new Error('Archive/unarchive requires --expected-revision from project show/list');
          const project = await storage.archiveProject(id, cli.subcommand === 'archive', Number(token));
          if (!project) throw new Error('Project not found');
          printResult(project, cli.isJson);
        } else if (cli.subcommand === 'backup') {
          const backup = await storage.backupMetadata();
          printResult({ status: 'metadata_backup_complete', ...backup, timestamp: new Date().toISOString() }, cli.isJson);
        } else {
          printError(`Unknown project subcommand: ${cli.subcommand}`, cli.isJson);
        }
        break;
      }

      case 'series': {
        const bible = await storage.getSeriesBible(defaultProjectId);
        if (cli.subcommand === 'list' || !cli.subcommand) {
          printResult(bible, cli.isJson);
        } else if (cli.subcommand === 'validate') {
          const valid = !!bible && bible.rules.length > 0 && bible.characters.length > 0;
          printResult({ isValid: valid, rulesCount: bible?.rules.length, castCount: bible?.characters.length }, cli.isJson);
        } else {
          printError(`Unknown series subcommand: ${cli.subcommand}`, cli.isJson);
        }
        break;
      }

      case 'episode': {
        if (cli.subcommand === 'list' || !cli.subcommand) {
          const episodes = await storage.listEpisodes(defaultProjectId);
          printResult(episodes, cli.isJson);
        } else if (cli.subcommand === 'show') {
          const epId = cli.args[0] || (cli.flags.id as string);
          if (!epId) printError('Episode ID required: "studio episode show <epId>"', cli.isJson);
          const episode = await storage.getEpisode(defaultProjectId, epId);
          if (!episode) printError(`Episode not found: ${epId}`, cli.isJson, 404);
          printResult(episode, cli.isJson);
        } else if (cli.subcommand === 'check') {
          const epId = cli.args[0] || (cli.flags.id as string);
          if (!epId) printError('Episode ID required: "studio episode check <epId>"', cli.isJson);
          const episode = await storage.getEpisode(defaultProjectId, epId);
          if (!episode) printError(`Episode not found: ${epId}`, cli.isJson, 404);

          const all = await storage.listEpisodes(defaultProjectId);
          const prior = all.filter((e) => e.id !== episode.id);
          const distinctness = checkEpisodeDistinctness(episode, prior);

          const activeScript = episode.scriptVersions[episode.activeScriptVersionIndex]?.fullNarrationText || '';
          const canonValidation = validateCanonHardRules(activeScript);

          printResult({
            episodeId: epId,
            distinctness,
            canonValidation,
            storyCraft: reviewStoryCraft(episode),
            isReadyForProduction: false,
            readinessNotice: 'Automated checks are advisory. Human editorial/rights review and exact-artifact technical QC are required; no approval was created.',
          }, cli.isJson);
        } else if (cli.subcommand === 'approve') {
          const epId = cli.args[0] || (cli.flags.id as string);
          if (!epId) printError('Episode ID required', cli.isJson);
          const episode = await storage.getEpisode(defaultProjectId, epId);
          if (!episode) printError('Episode not found', cli.isJson, 404);

          episode.status = 'script_approved';
          if (episode.scriptVersions[episode.activeScriptVersionIndex]) {
            episode.scriptVersions[episode.activeScriptVersionIndex].isApproved = true;
            episode.scriptVersions[episode.activeScriptVersionIndex].approvedBy = 'OpenCode CLI Operator';
          }
          await storage.saveEpisode(defaultProjectId, episode);
          printResult({ episodeId: epId, status: 'script_approved' }, cli.isJson);
        } else if (cli.subcommand === 'create' || cli.subcommand === 'new') {
          const epId = (cli.flags.id as string) || cli.args[0];
          const title = (cli.flags.title as string) || cli.args[1];
          const arcNum = parseInt((cli.flags.arc as string) || '1', 10);
          const seasonNum = parseInt((cli.flags.season as string) || '1', 10);
          const logline = (cli.flags.logline as string) || '';

          if (!epId || !title) {
            printError('Usage: studio episode create --id <id> --title <title> [--arc <n>] [--season <n>] [--logline <desc>]', cli.isJson);
          }

          const existing = await storage.getEpisode(defaultProjectId, epId);
          if (existing) {
            printError(`Episode ${epId} already exists`, cli.isJson, 409);
          }

          const newEpisode: EpisodeCard = {
            id: epId,
            dbId: `ep_${Date.now()}`,
            projectId: defaultProjectId,
            seriesId: (await storage.getProject(defaultProjectId))!.activeSeriesId,
            seasonNumber: seasonNum,
            arcNumber: arcNum,
            episodeNumberInArc: 1,
            episodeNumberInSeries: 2,
            workingTitle: title,
            logline: logline || `Episode ${epId}: ${title}`,
            premiseHook: `Grounded survival investigation in South Gate during the Quiet Hours.`,
            targetAudiencePersona: 'Survival thriller fans, serialized audio-fiction listeners, grounded disaster enthusiasts',
            beats: [
              { beatNumber: 1, name: 'Cold Open (00:00)', targetSeconds: 25, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 2, name: 'Premise (00:25)', targetSeconds: 65, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 3, name: 'Inciting Failure (01:30)', targetSeconds: 90, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 4, name: 'Human Encounter (03:00)', targetSeconds: 120, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 5, name: 'First Evidence (05:00)', targetSeconds: 120, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 6, name: 'Moral Choice (07:00)', targetSeconds: 150, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 7, name: 'Action & Consequence (09:30)', targetSeconds: 180, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 8, name: 'Aftermath (12:30)', targetSeconds: 90, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
              { beatNumber: 9, name: 'Cliffhanger Anchor (14:00)', targetSeconds: 60, visualDescription: '', spokenDialogueSnippet: '', soundDesignCues: [], continuityClues: [] },
            ],
            charactersPresent: ['Rhea Mistry'],
            physicalLocations: ['South Gate Water Control Works'],
            timelineAnchor: 'Day 01',
            status: 'outline_ready',
            activeScriptVersionIndex: 0,
            scriptVersions: [
              {
                versionNumber: 1,
                author: (cli.flags.author as string) || 'OpenCode Agent',
                fullNarrationText: '',
                wordCount: 0,
                spokenWordCount: 0,
                estimatedDurationSeconds: 0,
                targetWpm: 145,
                beats: [],
                pronunciationNotes: [],
                isApproved: false,
                createdAt: new Date().toISOString(),
              },
            ],
            storyboardPromptVersions: [],
            activeStoryboardVersionIndex: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          await storage.saveEpisode(defaultProjectId, newEpisode);
          printResult(newEpisode, cli.isJson);
        } else if (cli.subcommand === 'update-script' || cli.subcommand === 'set-script') {
          const epId = cli.args[0] || (cli.flags.id as string) || (cli.flags.episode as string);
          if (!epId) printError('Usage: studio episode update-script <epId> (--text <text> | --file <path>)', cli.isJson);
          const episode = await storage.getEpisode(defaultProjectId, epId);
          if (!episode) printError(`Episode not found: ${epId}`, cli.isJson, 404);

          let narrationText = (cli.flags.text as string) || '';
          const filePath = cli.flags.file as string;
          if (filePath) {
            const safePath = validateSafeProjectPath(filePath, process.cwd());
            if (!fs.existsSync(safePath)) printError(`File not found: ${filePath}`, cli.isJson, 404);
            narrationText = await fs.promises.readFile(safePath, 'utf-8');
          }

          if (!narrationText) printError('Script narration text or --file <path> is required', cli.isJson);

          const wordCount = calculateWordCount(narrationText);
          const pacing = calculateNarrationPacing(wordCount, 145);
          const canonValidation = validateCanonHardRules(narrationText);

          const newVersionNumber = episode.scriptVersions.length + 1;
          const author = (cli.flags.author as string) || 'OpenCode Agent';

          episode.scriptVersions.push({
            versionNumber: newVersionNumber,
            author,
            fullNarrationText: narrationText,
            wordCount,
            spokenWordCount: wordCount,
            estimatedDurationSeconds: pacing.estimatedDurationSeconds,
            targetWpm: 145,
            beats: [],
            pronunciationNotes: [],
            isApproved: false,
            createdAt: new Date().toISOString(),
          });
          episode.activeScriptVersionIndex = episode.scriptVersions.length - 1;
          episode.status = 'script_draft';
          await storage.saveEpisode(defaultProjectId, episode);

          printResult({
            episodeId: epId,
            versionNumber: newVersionNumber,
            wordCount,
            durationFormatted: pacing.estimatedDurationFormatted,
            pacingStatus: pacing.pacingNote,
            canonViolations: canonValidation.infractions,
            isCanonCompliant: !canonValidation.violatesHardRules,
          }, cli.isJson);
        } else if (cli.subcommand === 'add-beat') {
          const epId = cli.args[0] || (cli.flags.id as string) || (cli.flags.episode as string);
          const beatName = (cli.flags.name as string) || cli.args[1];
          const snippet = (cli.flags.snippet as string) || cli.args.slice(2).join(' ');

          if (!epId || !beatName) {
            printError('Usage: studio episode add-beat <epId> --name <name> --snippet <snippet>', cli.isJson);
          }
          const episode = await storage.getEpisode(defaultProjectId, epId);
          if (!episode) printError(`Episode not found: ${epId}`, cli.isJson, 404);

          if (!episode.beats) {
            episode.beats = [];
          }
          const beatNumber = episode.beats.length + 1;
          episode.beats.push({
            beatNumber,
            name: beatName,
            targetSeconds: 90,
            visualDescription: '',
            spokenDialogueSnippet: snippet || '',
            soundDesignCues: [],
            continuityClues: [],
          });
          await storage.saveEpisode(defaultProjectId, episode);
          printResult({ episodeId: epId, beatCount: episode.beats.length, newBeat: { beatNumber, name: beatName, snippet } }, cli.isJson);
        } else if (cli.subcommand === 'produce') {
          throw new Error('Production execution is not implemented safely; no run was started.');
        } else {
          printError(`Unknown episode subcommand: ${cli.subcommand}`, cli.isJson);
        }
        break;
      }

      case 'arc': {
        if (cli.subcommand === 'expand') {
          const integerFlag = (value: unknown, name: string) => {
            if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new Error(`${name} must be a positive integer`);
            return Number(value);
          };
          const result = await storage.expandArc(defaultProjectId, {
            arcNumber: integerFlag(cli.flags.arc ?? cli.args[0] ?? '1', 'arc'),
            count: integerFlag(cli.flags.count ?? '10', 'count'),
            idempotencyKey: cli.flags['idempotency-key'],
          });
          printResult(result, cli.isJson);
        } else {
          printError(`Unknown arc subcommand: ${cli.subcommand}`, cli.isJson);
        }
        break;
      }

      case 'continuity': {
        if (cli.subcommand === 'report' || !cli.subcommand) {
          const events = await storage.listCanonEvents(defaultProjectId);
          printResult({
            canonEventsCount: events.length,
            events,
            unresolvedClues: events.flatMap((e) => e.unresolvedClues),
            activeInjuries: events.flatMap((e) => e.injuriesOrStatusChanges),
          }, cli.isJson);
        } else if (cli.subcommand === 'add') {
          const epId = (cli.flags.episode as string) || cli.args[0];
          const location = (cli.flags.location as string) || 'South Gate';
          const characters = ((cli.flags.characters as string) || 'Rhea Mistry').split(',').map((c) => c.trim());
          const summary = (cli.flags.summary as string) || cli.args.slice(1).join(' ');

          if (!epId || !summary) {
            printError('Usage: studio continuity add --episode <epId> --location <loc> --characters <chars> --summary <text>', cli.isJson);
          }

          const newEvent: CanonEvent = {
            id: `canon_${Date.now()}`,
            episodeId: epId,
            storyDate: (cli.flags.date as string) || 'Day 01',
            physicalLocation: location,
            charactersPresent: characters,
            whatCharactersLearned: {
              'Rhea Mistry': summary,
            },
            resourceDeltas: cli.flags.delta ? [(cli.flags.delta as string)] : [],
            injuriesOrStatusChanges: cli.flags.injury ? [(cli.flags.injury as string)] : [],
            unresolvedClues: cli.flags.clue ? [(cli.flags.clue as string)] : [],
            promisesMade: [],
            consequencesSummary: summary,
            isRetcon: false,
            createdAt: new Date().toISOString(),
          };

          await storage.saveCanonEvent(defaultProjectId, newEvent);
          printResult(newEvent, cli.isJson);
        } else {
          printError(`Unknown continuity subcommand: ${cli.subcommand}`, cli.isJson);
        }
        break;
      }

      case 'spend': {
        if (cli.subcommand === 'authorize' || cli.subcommand === 'grant') {
          throw new Error('Spend grant creation is disabled until an operator-only approval service and transactional ledger are implemented.');
        } else if (cli.subcommand === 'list' || !cli.subcommand) {
          const grants = await storage.listSpendGrants(defaultProjectId);
          printResult(grants, cli.isJson);
        } else {
          printError(`Unknown spend subcommand: ${cli.subcommand}. Use: studio spend authorize --amount <usd> [--hours <n>]`, cli.isJson);
        }
        break;
      }

      case 'media': {
        if (cli.subcommand === 'enqueue') {
          const episodeId = cli.flags.episode as string;
          assertIdentifier(episodeId);
          if (!(await storage.getEpisode(defaultProjectId, episodeId))) printError('Episode not found', cli.isJson);
          printResult(localMedia.enqueue({
            projectId: defaultProjectId, episodeId, frameCount: Number(cli.flags.frames), fps: 24,
            audioFile: cli.flags.audio as string, idempotencyKey: cli.flags['idempotency-key'] as string,
          }), cli.isJson);
        } else if (cli.subcommand === 'work') {
          printResult(await localMedia.runNext(), cli.isJson);
        } else if (cli.subcommand === 'recover') {
          printResult({ interruptedJobs: localMedia.recoverInterrupted() }, cli.isJson);
        } else if (cli.subcommand === 'status') {
          printResult(cli.args[0] ? localMedia.get(defaultProjectId, cli.args[0]) : localMedia.list(defaultProjectId), cli.isJson);
        } else if (cli.subcommand === 'purge-checkpoints') {
          const id = cli.args[0]; assertIdentifier(id);
          printResult(await localMedia.purgeCheckpoints(defaultProjectId, id), cli.isJson);
        } else if (cli.subcommand === 'cancel' || cli.subcommand === 'retry') {
          const id = cli.args[0]; assertIdentifier(id);
          printResult(cli.subcommand === 'cancel' ? localMedia.cancel(defaultProjectId, id) : localMedia.retry(defaultProjectId, id), cli.isJson);
        } else printError('Use media enqueue|work|status|cancel|retry|recover|purge-checkpoints', cli.isJson);
        break;
      }

      case 'render': {
        if (cli.subcommand === 'script') {
          throw new Error('Legacy placeholder render and stitch scripts are retired. Use media enqueue/work with supplied frames and original audio.');
        } else {
          printError(`Unknown render subcommand: ${cli.subcommand}. Use: studio render script <epId> [--save]`, cli.isJson);
        }
        break;
      }

      case 'flow': {
        const epId = (cli.flags.episode as string) || cli.args[0] || 'S01E001';
        assertIdentifier(epId);

        if (cli.subcommand === 'plan') {
          const rawMode = (cli.flags.mode as string) || 'dense_24fps';
          const mode: 'dense_24fps' | 'keyframe_storyboard' = rawMode.startsWith('keyframe') ? 'keyframe_storyboard' : 'dense_24fps';
          const duration = parseInt((cli.flags.duration as string) || '600', 10);
          const fps = parseInt((cli.flags.fps as string) || '24', 10);

          const episode = await storage.getEpisode(defaultProjectId, epId);
          const title = episode ? episode.workingTitle : 'Survival Story Episode';

          const plan = createGoogleFlowPlan(epId, title, duration, fps, mode, defaultProjectId);
          if (cli.flags['expected-revision'] !== undefined) plan.revision = Number(cli.flags['expected-revision']);
          await storage.saveGoogleFlowPlan(defaultProjectId, plan);

          printResult({
            episodeId: epId,
            revision: plan.revision,
            mode: plan.mode,
            durationSeconds: plan.totalDurationSeconds,
            fps: plan.fps,
            totalFramesExpected: plan.totalFramesExpected,
            totalBatches: plan.totalBatches,
            batchSize: 24,
            accountsAssigned: {
              account_1: plan.accounts.account_1.batchesAssigned,
              account_2: plan.accounts.account_2.batchesAssigned,
              account_3: plan.accounts.account_3.batchesAssigned,
            },
            billableApiCostUsd: 0,
            message: `Plan created with ${plan.totalBatches} batches (up to 24 frames each). Account slots are illustrative and unverified; no provider operation was performed.`,
          }, cli.isJson);
        } else if (cli.subcommand === 'export' || cli.subcommand === 'batch') {
          const batchIndex = parseInt((cli.flags.batch as string) || cli.args[1] || '1', 10);
          let plan = await storage.getGoogleFlowPlan(defaultProjectId, epId);
          if (!plan) {
            const episode = await storage.getEpisode(defaultProjectId, epId);
            plan = createGoogleFlowPlan(epId, episode ? episode.workingTitle : 'Episode', 600, 24, 'dense_24fps', defaultProjectId);
            await storage.saveGoogleFlowPlan(defaultProjectId, plan);
          }

          const batch = plan.batches.find((b) => b.batchIndex === batchIndex);
          if (!batch) printError(`Batch index ${batchIndex} not found in plan for ${epId}`, cli.isJson, 404);

          printResult({
            batchId: batch.batchId,
            batchIndex: batch.batchIndex,
            assignedAccount: batch.assignedAccount,
            timecodeRange: batch.timecodeRange,
            storyBeat: batch.storyBeatName,
            status: batch.status,
            promptCount: batch.prompts.length,
            prompts: batch.prompts.map((p) => ({
              frame: p.frameIndex,
              globalFrame: p.globalFrameNumber,
              timecode: p.timecode,
              prompt: p.promptText,
            })),
            googleFlowUrl: 'https://flow.google.com/',
            batchCopyBlock: batch.prompts.map((p) => `[Frame ${p.frameIndex}/24 | ${p.timecode}]\n${p.promptText}`).join('\n\n'),
          }, cli.isJson);
        } else if (cli.subcommand === 'status') {
          const plan = await storage.getGoogleFlowPlan(defaultProjectId, epId);
          if (!plan) {
            printResult({
              episodeId: epId,
              status: 'no_plan_initialized',
              action: `Run: npm run studio -- flow plan --episode ${epId} --json`,
            }, cli.isJson);
            break;
          }

          const outDir = path.resolve(process.cwd(), 'data', 'production_root', 'projects', defaultProjectId, 'assets', 'flow_renders', epId);
          let renderedCount = 0;
          if (fs.existsSync(outDir)) {
            const files = await fs.promises.readdir(outDir);
            renderedCount = files.filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).length;
          }

          printResult({
            episodeId: epId,
            mode: plan.mode,
            revision: plan.revision,
            totalFramesExpected: plan.totalFramesExpected,
            unverifiedImageFilesPresent: renderedCount,
            verifiedFrames: plan.summary.totalFramesIngested,
            totalBatches: plan.totalBatches,
            pendingBatches: plan.batches.filter((b) => b.status === 'pending').length,
            dispatchedBatches: plan.batches.filter((b) => b.status === 'dispatched').length,
            ingestedBatches: plan.batches.filter((b) => b.status === 'ingested' || b.status === 'verified').length,
            completionPercentage: plan.summary.completionPercentage,
            billableCostUsd: 0,
            accountBreakdown: {
              account_1: { label: plan.accounts.account_1.label, assigned: plan.accounts.account_1.batchesAssigned, completed: plan.accounts.account_1.batchesCompleted },
              account_2: { label: plan.accounts.account_2.label, assigned: plan.accounts.account_2.batchesAssigned, completed: plan.accounts.account_2.batchesCompleted },
              account_3: { label: plan.accounts.account_3.label, assigned: plan.accounts.account_3.batchesAssigned, completed: plan.accounts.account_3.batchesCompleted },
            },
          }, cli.isJson);
        } else if (cli.subcommand === 'ingest') {
          const plan = await storage.getGoogleFlowPlan(defaultProjectId, epId);
          if (!plan) printError('Create a plan before verifying a batch', cli.isJson);
          const index = Number(cli.flags.batch ?? cli.args[1] ?? 1);
          const batch = plan!.batches.find(item => item.batchIndex === index);
          if (!batch) printError('Batch not found', cli.isJson);
          const revision = cli.flags['expected-revision'] === undefined ? plan!.revision : Number(cli.flags['expected-revision']);
          printResult(await verifyFlowBatch(storage, defaultProjectId, epId, batch!.batchId, revision), cli.isJson);
        } else if (cli.subcommand === 'stitch') {
          printError('Legacy stitch scripts are retired. Use the verified local renderer with supplied frames and original audio. No script was written.', cli.isJson);
        } else if (cli.subcommand === 'checkpoint') {
          let plan = await storage.getGoogleFlowPlan(defaultProjectId, epId);
          if (!plan) {
            const episode = await storage.getEpisode(defaultProjectId, epId);
            plan = createGoogleFlowPlan(epId, episode ? episode.workingTitle : 'Episode', 600, 24, 'dense_24fps', defaultProjectId);
          }
          const checkpoint = computeFlowCheckpoint(plan);
          printResult(checkpoint, cli.isJson);
        } else if (cli.subcommand === 'autoproduce' || cli.subcommand === 'produce') {
          const episode = await storage.getEpisode(defaultProjectId, epId);
          const title = episode ? episode.workingTitle : 'The Eight-Beat Failure';
          const logline = episode ? episode.logline : 'When the emergency alarm falls silent...';
          const fps = parseInt((cli.flags.fps as string) || '24', 10);
          const duration = parseInt((cli.flags.duration as string) || '600', 10);

          const result = createFlowAutoproduceOrchestrator(defaultProjectId, epId, title, logline, {
            fps,
            durationSeconds: duration,
          });
          printResult(result, cli.isJson);
        } else {
          printError(`Unknown flow subcommand: ${cli.subcommand}. Use: plan, export, ingest, status, stitch, checkpoint, autoproduce`, cli.isJson);
        }
        break;
      }

      case 'ai-prompt': {
        const prompt = `You are the local production agent for Ternfall Studio (The Quiet Hours: Ternfall).
Your task is to write, audit, and produce original animated survival thriller episodes.

STRICT INVARIANTS:
1. Grounded survivor lore: Protagonist Rhea Mistry (water engineer). South Gate mechanical siren network failure.
2. Contact transmission only. Non-airborne. Non-waterborne. The infected ('The Still') are motionless until mechanical vibration triggers them.
3. Spoken pacing: 140-160 WPM (~2,175 words for standard 15:00 episode).
4. Strictly original: No manhwa tropes, no competitor copying, no named artist styles.

SAFE WORKFLOW COMMANDS (all use typed CLI):
- Inspect World & Canon:
    npm run studio -- series list --json
    npm run studio -- continuity report --json
- Inspect / Create Episode:
    npm run studio -- episode show S01E001 --json
    npm run studio -- episode create --id S01E002 --title "The Siphon" --arc 1 --json
- Update Narration & Validate Pacing:
    npm run studio -- episode update-script S01E002 --file ./scripts/S01E002.txt --json
    npm run studio -- episode check S01E002 --json
- Add Lore/Research Claim:
    npm run studio -- research add "Municipal bypass valves operate on counterweights" --json
- YouTube Preflight:
    npm run studio -- youtube preflight --json
`;
        printResult({ prompt }, cli.isJson);
        break;
      }

      case 'research': {
        if (cli.subcommand === 'list' || !cli.subcommand) {
          const claims = await storage.listResearchClaims(defaultProjectId);
          printResult(claims, cli.isJson);
        } else if (cli.subcommand === 'add') {
          const claimText = cli.args.join(' ') || (cli.flags.claim as string);
          if (!claimText) printError('Claim text required: "studio research add <claim>"', cli.isJson);

          const url = cli.flags.url as string;
          if (url) {
            const check = validateResearchSourceUrl(url);
            if (!check.isValid) printError(`SSRF or URL validation failed: ${check.warnings.join(' ')}`, cli.isJson);
          }

          const claim = await storage.saveResearchClaim(defaultProjectId, {
            id: `claim_${Date.now()}`,
            projectId: defaultProjectId,
            claimText,
            isFictionalLore: Boolean(cli.flags.fictional),
            sourceUrl: url,
            verificationStatus: cli.flags.fictional ? 'fictional_rule' : 'unverified',
            confidenceScore: 0,
            factCheckerNotes: 'Recorded via CLI; pending independent review',
            humanApproved: false,
            relatedEpisodeIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          printResult(claim, cli.isJson);
        } else {
          printError(`Unknown research subcommand: ${cli.subcommand}`, cli.isJson);
        }
        break;
      }

      case 'run': {
        if (cli.subcommand === 'status') {
          const runId = cli.args[0] || (cli.flags.id as string);
          if (!runId) printError('Run ID required: "studio run status <runId>"', cli.isJson);
          const runs = await storage.listAutoproduceRuns(defaultProjectId);
          const run = runs.find((r) => r.runId === runId);
          if (!run) printError(`Run not found: ${runId}`, cli.isJson, 404);

          printResult({
            runId: run.runId,
            episodeId: run.episodeId,
            currentStage: run.stages[run.currentStageIndex]?.stageName,
            isCompleted: run.isCompleted,
            isPaused: run.isPaused,
            budgetCapUsd: run.budgetCapUsd,
            spentSoFarUsd: run.spentSoFarUsd,
            mayHaveCharged: false,
            duplicatePossible: false,
            reconciliationRequired: false,
          }, cli.isJson);
        } else {
          printError(`Unknown run subcommand: ${cli.subcommand}`, cli.isJson);
        }
        break;
      }

      case 'youtube': {
        const pkgs = await storage.listPackages(defaultProjectId);
        if (cli.subcommand === 'preflight') {
          printResult({
            packageCount: pkgs.length,
            status: 'checklist_only_unverified',
            mandatoryChecks: [
              '1. Technical QC valid',
              '2. Claims and lore checked',
              '3. Rights cleared',
              '4. Privacy set to private by default',
              '5. Human release authorization required',
            ],
          }, cli.isJson);
        } else {
          printResult(pkgs, cli.isJson);
        }
        break;
      }

      default:
        printError(`Unknown command: ${cli.command}. Run "studio --help" for available commands.`, cli.isJson);
    }
  } catch (err: any) {
    printError(err.message, cli.isJson);
  }
}

// Only execute main if run as script
if (process.argv[1]?.endsWith('studio.ts') || process.argv[1]?.endsWith('studio')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
