import React, { useRef, useState } from 'react';
import { EpisodeCard } from '../types/index.ts';
import {
  Plus,
  Copy,
  FileText,
  Play,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface EpisodeBoardViewProps {
  projectId: string;
  episodes: EpisodeCard[];
  onOpenEpisode: (epId: string) => void;
  onPlanEpisode: (epId: string) => void;
  onRefreshEpisodes: () => void;
}

export const EpisodeBoardView: React.FC<EpisodeBoardViewProps> = ({
  projectId,
  episodes,
  onOpenEpisode,
  onPlanEpisode,
  onRefreshEpisodes,
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [isCreating, setIsCreating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const actionInFlight = useRef(false);
  const createKey = useRef<string | null>(null);
  const duplicateKeys = useRef<Record<string, string>>({});
  const [newTitle, setNewTitle] = useState('');
  const [newLogline, setNewLogline] = useState('');
  const [newObjective, setNewObjective] = useState('');
  const [checkResult, setCheckResult] = useState<{
    epId: string;
    isReady: boolean;
    distinctness: any;
    canonValidation: any;
    readinessNotice: string;
  } | null>(null);

  const filteredEpisodes = episodes.filter((ep) => {
    if (selectedFilter === 'all') return true;
    return ep.status === selectedFilter;
  });

  const handleCreateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || actionInFlight.current) return;
    actionInFlight.current = true; setActionPending(true); setActionError(null);
    try {
      createKey.current ||= crypto.randomUUID();
      const response = await fetch(`/api/projects/${projectId}/episodes/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: createKey.current, workingTitle: newTitle, logline: newLogline, physicalObjective: newObjective }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Episode creation failed');
      createKey.current = null;
      setIsCreating(false); setNewTitle(''); setNewLogline(''); setNewObjective('');
      onRefreshEpisodes();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Episode creation failed');
    } finally { actionInFlight.current = false; setActionPending(false); }
  };

  const handleDuplicate = async (epId: string) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true; setActionPending(true); setActionError(null);
    try {
      const key = duplicateKeys.current[epId] ||= crypto.randomUUID();
      const response = await fetch(`/api/projects/${projectId}/episodes/${epId}/duplicate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Episode duplication failed');
      delete duplicateKeys.current[epId];
      onRefreshEpisodes();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Episode duplication failed');
    } finally { actionInFlight.current = false; setActionPending(false); }
  };

  const handleRunChecks = async (epId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes/${epId}/check`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Episode checks failed');
      setActionError(null);
      if (data.ok) {
        setCheckResult({
          epId,
          isReady: data.data.isReadyForProduction,
          distinctness: data.data.distinctness,
          canonValidation: data.data.canonValidation,
          readinessNotice: data.data.readinessNotice,
        });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to run checks');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {actionError && <p role="alert" className="text-sm text-rose-300">{actionError}</p>}
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Production Roster
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              Episode Board
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Cards are drafts. Distinctness, timing, dramatic choices and consequences require review. Duplicating creates a linked variant without changing the source.
            </p>
          </div>

          <button
            onClick={() => { setActionError(null); setIsCreating(true); }}
            disabled={actionPending}
            className="px-3.5 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Episode Card</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs text-slate-400">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1 rounded-md transition-colors ${
            selectedFilter === 'all'
              ? 'bg-slate-800 text-teal-300 font-medium'
              : 'hover:text-slate-200'
          }`}
        >
          All Cards ({episodes.length})
        </button>
        <button
          onClick={() => setSelectedFilter('script_approved')}
          className={`px-3 py-1 rounded-md transition-colors ${
            selectedFilter === 'script_approved'
              ? 'bg-slate-800 text-teal-300 font-medium'
              : 'hover:text-slate-200'
          }`}
        >
          Local Script Review
        </button>
        <button
          onClick={() => setSelectedFilter('planned')}
          className={`px-3 py-1 rounded-md transition-colors ${
            selectedFilter === 'planned'
              ? 'bg-slate-800 text-teal-300 font-medium'
              : 'hover:text-slate-200'
          }`}
        >
          Planned Outlines
        </button>
      </div>

      {/* Episode Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredEpisodes.map((ep) => {
          const activeScript = ep.scriptVersions[ep.activeScriptVersionIndex];
          const words = activeScript?.wordCount || 0;
          const mins = Math.round((words / (ep.scriptVersions[0]?.targetWpm || 145)));

          return (
            <div
              key={ep.id}
              className="p-5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {ep.id}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      Arc #{ep.arcNumber}
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-mono capitalize px-2 py-0.5 rounded ${
                      ep.status === 'script_approved'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : ep.status === 'planned'
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {ep.status === 'script_approved' ? 'local script review' : ep.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-100">{ep.workingTitle}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-3 leading-relaxed">
                    {ep.logline}
                  </p>
                </div>

                <div className="text-[11px] text-slate-500 space-y-1 font-mono pt-2 border-t border-slate-800/80">
                  <div className="truncate">Objective: {ep.physicalObjective}</div>
                  <div>Consequence: {ep.consequence}</div>
                  {words > 0 && (
                    <div className="text-slate-400">
                      Script: <span className="text-teal-300 font-bold">{words}</span> words (~{mins}m)
                    </div>
                  )}
                  {ep.provenanceSourceEpisodeId && (
                    <div className="text-amber-400">
                      Variant linked to: {ep.provenanceSourceEpisodeId}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenEpisode(ep.id)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Open Script & Pacing Editor"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(ep.id)}
                    disabled={actionPending}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Duplicate Episode Variant"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRunChecks(ep.id)}
                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-teal-300 transition-colors"
                    title="Run Distinctness & Canon Check"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => onPlanEpisode(ep.id)}
                  className="px-3 py-1 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Plan / render</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Check Results */}
      {checkResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-400" />
                <span>Advisory Checks ({checkResult.epId})</span>
              </h3>
              <button
                onClick={() => setCheckResult(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <div className="font-semibold text-slate-200 mb-1">
                  1. Narrative Distinctness (Jaccard Similarity Check):
                </div>
                <div className="text-slate-300 font-mono">
                  Max similarity against library:{' '}
                  <span className={checkResult.distinctness.isDistinct ? 'text-emerald-400' : 'text-amber-400'}>
                    {Math.round(checkResult.distinctness.maxSimilarityScore * 100)}%
                  </span>
                </div>
                {checkResult.distinctness.warnings.map((w: string, i: number) => (
                  <div key={i} className="text-amber-300 mt-1 text-[11px]">
                    ⚠ {w}
                  </div>
                ))}
                {checkResult.distinctness.isDistinct && (
                  <div className="text-emerald-400 mt-1 text-[11px]">
                    No similarity warning from this heuristic. It does not prove uniqueness or quality.
                  </div>
                )}
              </div>

              <div className="p-3 rounded bg-slate-950 border border-slate-800">
                <div className="font-semibold text-slate-200 mb-1">
                  2. Canon keyword heuristic:
                </div>
                {!checkResult.canonValidation.evaluated ? (
                  <div className="text-amber-300 text-[11px]">{checkResult.canonValidation.reason || 'No configured check was evaluated.'}</div>
                ) : checkResult.canonValidation.violatesHardRules ? (
                  <div className="space-y-1">
                    {checkResult.canonValidation.infractions.map((inf: string, i: number) => (
                      <div key={i} className="text-rose-400 text-[11px]">
                        ✕ {inf}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-emerald-400 text-[11px]">
                    No configured keyword rule was triggered. This is not a canon or factual certification.
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-amber-300">Not certified ready. {checkResult.readinessNotice}</p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCheckResult(null)}
                className="px-4 py-1.5 rounded bg-teal-500 text-slate-950 font-semibold text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Episode Card */}
      {isCreating && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateEpisode}
            className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl"
          >
            <h3 className="text-base font-bold text-slate-100">
              Create New Episode Card
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Working Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Sluice Gate Nine"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Unique Logline & Conflict
                </label>
                <textarea
                  rows={3}
                  value={newLogline}
                  onChange={(e) => setNewLogline(e.target.value)}
                  placeholder="Premise explaining the specific obstacle and consequence..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Physical Objective
                </label>
                <input
                  type="text"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  placeholder="e.g. Restore manual water pump pressure"
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {actionError && <p role="alert" className="text-xs text-rose-300">{actionError}</p>}
            <p className="text-xs text-slate-400">A retry uses the same request key. If the response was lost, check the board before cancelling and starting a different request.</p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { createKey.current = null; setIsCreating(false); }}
                disabled={actionPending}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionPending}
                className="px-4 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold"
              >
                {actionPending ? 'Creating…' : 'Create Card'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
