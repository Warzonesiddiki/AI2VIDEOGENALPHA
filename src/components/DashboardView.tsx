import React from 'react';
import { ActiveTab } from './Navigation.tsx';
import { EpisodeCard, GenerationJob, SeriesBible } from '../types/index.ts';
import {
  Play,
  Film,
  BookOpen,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Tv,
} from 'lucide-react';

interface DashboardViewProps {
  series: SeriesBible | null;
  episodes: EpisodeCard[];
  jobs: GenerationJob[];
  onSelectTab: (tab: ActiveTab) => void;
  onOpenEpisode: (epId: string) => void;
  onStartAutoproduce: (epId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  series,
  episodes,
  jobs,
  onSelectTab,
  onOpenEpisode,
  onStartAutoproduce,
}) => {
  const pilotEpisode = episodes.find((e) => e.id === 'S01E001') || episodes[0];
  const runningJobs = jobs.filter((j) => j.state === 'running');
  const blockedJobs = jobs.filter((j) => j.state === 'blocked' || j.state === 'needs_user');

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Editorial Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100">
              Studio Command Center
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Local-first production suite for serialized 2D survival animated thrillers on YouTube.
              Currently operating <span className="text-teal-300 font-medium">{series?.seriesTitle || 'Ternfall'}</span> with a 1,000-episode story roadmap.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onSelectTab('doctor')}
              className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Runtime Health</span>
            </button>
            <button
              onClick={() => onSelectTab('autoproducer')}
              className="px-3.5 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Autoproducer</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip (Zero-Pill Discipline, Subtle Hairline Borders) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 font-medium">Planned Episodes</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono tabular-nums">
            1,000
          </div>
          <div className="text-[11px] text-teal-400/90 mt-1 flex items-center gap-1">
            <span>100 Arcs · 10 Seasons</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 font-medium">Active Cards in Board</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono tabular-nums">
            {episodes.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>1 pilot ready for render</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 font-medium">Production Queue</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono tabular-nums">
            {runningJobs.length} <span className="text-xs font-normal text-slate-500 font-sans">running</span>
          </div>
          <div className="text-[11px] text-amber-400 mt-1">
            {blockedJobs.length > 0 ? `${blockedJobs.length} require human review` : 'All jobs nominal'}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-lg">
          <div className="text-xs text-slate-500 font-medium">Episode Duration Target</div>
          <div className="text-2xl font-bold text-slate-100 mt-1 font-mono tabular-nums">
            ~15:00
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            <span>2,175 words @ 145 wpm</span>
          </div>
        </div>
      </div>

      {/* Hero Focus: Pilot Production Card */}
      {pilotEpisode && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs text-teal-400 font-medium">
                <span>PILOT EPISODE ANCHOR</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{pilotEpisode.id}</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400">Season 1 Arc 1</span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 tracking-tight">
                {pilotEpisode.workingTitle}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {pilotEpisode.logline}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1 font-mono">
                <span>Objective: {pilotEpisode.physicalObjective}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">Status: Script Approved (2,180 words)</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => onOpenEpisode(pilotEpisode.id)}
                className="px-3.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
              >
                Inspect Script
              </button>
              <button
                onClick={() => onSelectTab('video_essay')}
                className="px-4 py-2 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Illustrated Video Essay (0-Credit)</span>
              </button>
              <button
                onClick={() => onSelectTab('google_flow')}
                className="px-3.5 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Master Video & Shorts</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-Column Split: Workflow Navigation & Recent Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Quick Workflow Hub */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-between">
            <span>Production Stages</span>
            <span className="text-xs font-normal text-slate-500">Pipeline Flow</span>
          </h3>

          <div className="space-y-2.5">
            <button
              onClick={() => onSelectTab('series_bible')}
              className="w-full text-left p-3 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Series Bible & Character Rules
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Rhea Mistry, Kabir, Mara, 4 canon rules (contact-only transmission)
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={() => onSelectTab('roadmap')}
              className="w-full text-left p-3 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    100-Arc Roadmap Explorer
                  </div>
                  <div className="text-[11px] text-slate-400">
                    10 Seasons · 1,000 episode planned destination · 10-episode batches
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={() => onSelectTab('research_room')}
              className="w-full text-left p-3 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Research Room & Fact Ledger
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Sourced hydraulic claims vs fictional lore, SSRF guardrail & prompt shield
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={() => onSelectTab('scene_planner')}
              className="w-full text-left p-3 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Film className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    Storyboard & 2D Motion Assembly
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Limited 2D parallax, audio stems, captions (16:9 Long & 9:16 Shorts)
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>

            <button
              onClick={() => onSelectTab('google_flow')}
              className="w-full text-left p-3 rounded-md bg-teal-950/30 hover:bg-teal-950/50 border border-teal-500/40 hover:border-teal-500 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Film className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-teal-200">
                    Master Video & Shorts Cockpit (24fps)
                  </div>
                  <div className="text-[11px] text-teal-400/80">
                    Dual 16:9 Cinema & 9:16 Shorts player, thumbnail A/B testing, retention curve
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-teal-400" />
            </button>

            <button
              onClick={() => onSelectTab('youtube')}
              className="w-full text-left p-3 rounded-md bg-slate-800/40 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="w-4 h-4 text-teal-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-slate-200">
                    YouTube Operations & Studio Runbook
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Preflight checklist, privacy=private default, altered media disclosure
                  </div>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Right Column: Active Jobs & Recent Activity */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">
              Active Production Activity
            </h3>
            <button
              onClick={() => onSelectTab('jobs_queue')}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium"
            >
              View Queue
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-md">
              <Clock className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <div className="text-xs font-medium text-slate-400">No active rendering jobs</div>
              <p className="text-[11px] text-slate-500 mt-1">
                Launch the Autoproducer on an approved episode card to start generation.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="p-3 rounded-md bg-slate-800/40 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-200">{job.type.replace(/_/g, ' ')}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {job.currentStage} · {new Date(job.updatedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-mono capitalize ${
                        job.state === 'succeeded'
                          ? 'text-emerald-400'
                          : job.state === 'running'
                          ? 'text-teal-400'
                          : job.state === 'blocked'
                          ? 'text-amber-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {job.state.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Master Rule Safety Invariant Callout */}
          <div className="p-3 rounded-md bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="text-slate-300 font-medium">Safety Contract Invariants:</div>
            <div>· No public publishing without explicit final human approval.</div>
            <div>· Paid media generation bounded by strict per-run & monthly caps.</div>
            <div>· Non-graphic, psychological survival drama—zero copied competitor IP.</div>
          </div>
        </div>
      </div>
    </div>
  );
};
