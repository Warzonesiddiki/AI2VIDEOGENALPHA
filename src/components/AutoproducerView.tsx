import React, { useState, useEffect } from 'react';
import { AutoproduceRun, AutoproduceStage } from '../types/index.ts';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  DollarSign,
  Key,
  Copy,
  Check,
} from 'lucide-react';
import { SpendApprovalGrant } from '../types/index.ts';

interface AutoproducerViewProps {
  projectId: string;
  defaultEpisodeId?: string;
  onOpenYouTubeHandoff: () => void;
}

export const AutoproducerView: React.FC<AutoproducerViewProps> = ({
  projectId,
  defaultEpisodeId = 'S01E001',
  onOpenYouTubeHandoff,
}) => {
  const [runs, setRuns] = useState<AutoproduceRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AutoproduceRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [profile, setProfile] = useState<'stepwise' | 'supervised' | 'approved_batch'>('supervised');
  const [spendCap, setSpendCap] = useState(25.0);
  const [approvalId, setApprovalId] = useState('');
  const [availableGrants, setAvailableGrants] = useState<SpendApprovalGrant[]>([]);
  const [isMintingQuickGrant, setIsMintingQuickGrant] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGrants = async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/spend-grants`, { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (!res.ok || !data.ok || !Array.isArray(data.data)) throw new Error(data.error || 'Could not load historical grants');
      if (data.ok && Array.isArray(data.data)) {
        const active = data.data.filter((g: SpendApprovalGrant) => !g.isRevoked && new Date(g.expiresAt).getTime() > Date.now());
        setAvailableGrants(active);
        if (active.length > 0) {
          setApprovalId((prev) => prev || active[0].approvalId);
          setSpendCap((prev) => prev || active[0].maxBudgetUsd);
        }
      }
    } catch (err) {
      if (!signal?.aborted) setLoadError(err instanceof Error ? err.message : 'Could not load grants');
    }
  };

  const handleQuickMintGrant = async () => {
    setIsMintingQuickGrant(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/spend-grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: spendCap || 25,
          episodeId: defaultEpisodeId,
          validHours: 24,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setApprovalId(data.data.approvalId);
        setSpendCap(data.data.maxBudgetUsd);
        await loadGrants();
      }
    } catch (err) {
      console.error('Failed to quick-mint grant:', err);
    } finally {
      setIsMintingQuickGrant(false);
    }
  };

  const loadRuns = async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/autoproduce`, { signal });
      const data = await res.json();
      if (signal?.aborted) return;
      if (!res.ok || !data.ok || !Array.isArray(data.data)) throw new Error(data.error || 'Could not load historical runs');
      setRuns(data.data);
      setSelectedRun(previous => data.data.find((run: AutoproduceRun) => run.runId === previous?.runId) ?? data.data[0] ?? null);
    } catch (err) {
      if (!signal?.aborted) setLoadError(err instanceof Error ? err.message : 'Could not load runs');
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setRuns([]); setSelectedRun(null); setAvailableGrants([]); setApprovalId(''); setLoadError(null);
    void loadRuns(controller.signal); void loadGrants(controller.signal);
    return () => controller.abort();
  }, [projectId]);

  const handleStartRun = async () => {
    setIsStarting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/autoproduce/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId: defaultEpisodeId,
          profile,
          spendApprovalId: approvalId,
          budgetCapUsd: spendCap,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedRun(data.data);
        loadRuns();
      }
    } catch (err) {
      console.error('Failed to start autoproduce run:', err);
    } finally {
      setIsStarting(false);
    }
  };

  const handleAdvanceStage = async () => {
    if (!selectedRun) return;
    setIsAdvancing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/autoproduce/${selectedRun.runId}/advance`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        setSelectedRun(data.data);
        loadRuns();
      }
    } catch (err) {
      console.error('Failed to advance stage:', err);
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div role="status" className="p-4 rounded-xl border border-amber-500/30 text-amber-200">
        Production execution and new spend approvals are disabled pending a durable worker, measured asset validation and transactional spending. Historical run statuses are not fresh QC evidence.
      </div>
      <p role="status" className="text-sm text-amber-300">Legacy autoproducer metadata is historical only. Start, advance and approval creation are disabled; stage labels are not execution evidence. Use Real Local Render for supplied-asset exports.</p>
      {loadError && <p role="alert" className="text-sm text-rose-300">Historical inspector failed: {loadError}</p>}
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Resumable Workflow Orchestration
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              Supervised Autoproducer
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Read-only historical pipeline inspector. End-to-end generation and publishing are not implemented; stage statuses do not certify actual execution.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!selectedRun ? (
              <button
                disabled
                onClick={handleStartRun}
                className="px-4 py-2 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Initialize Pipeline ({defaultEpisodeId})</span>
              </button>
            ) : (
              <button
                disabled
                onClick={handleAdvanceStage}
                className="px-4 py-2 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors disabled:opacity-40"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{isAdvancing ? 'Executing Stage...' : 'Execute Next Stage'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pre-Authorization & Operating Profile Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 border border-slate-800 p-4 rounded-lg text-xs">
        <div>
          <label className="text-slate-400 font-medium block mb-1">Operating Profile:</label>
          <select
            value={profile}
            onChange={(e: any) => setProfile(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-teal-500"
          >
            <option value="supervised">Supervised Autopilot (Recommended)</option>
            <option value="stepwise">Step-by-Step (Stop at every decision)</option>
            <option value="approved_batch">Approved Batch Queue</option>
          </select>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Stops on budget caps, canon conflicts, or editorial gates.
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-400 font-medium">Authorized Spend Cap (USD):</label>
            <span className="text-[10px] text-teal-400 font-mono">
              ${spendCap.toFixed(2)}
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
            <input
              type="number"
              min={5}
              max={150}
              step={5}
              value={spendCap}
              onChange={(e) => setSpendCap(parseFloat(e.target.value) || 25)}
              className="w-full pl-6 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
            />
          </div>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Planning value only: paid execution is disabled; this field creates no permission.
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-400 font-medium">Operator Spend Grant:</label>
            <button
              type="button"
              disabled
              onClick={handleQuickMintGrant}
              className="text-[10px] text-teal-400 hover:text-teal-300 font-medium"
            >
              {isMintingQuickGrant ? 'Minting...' : '+ Mint New Grant'}
            </button>
          </div>
          {availableGrants.length > 0 ? (
            <select
              value={approvalId}
              onChange={(e) => {
                setApprovalId(e.target.value);
                const g = availableGrants.find((gr) => gr.approvalId === e.target.value);
                if (g) setSpendCap(g.maxBudgetUsd);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-teal-400 font-mono text-[11px] focus:outline-none focus:border-teal-500"
            >
              {availableGrants.map((g) => (
                <option key={g.approvalId} value={g.approvalId}>
                  {g.approvalId} (${g.maxBudgetUsd.toFixed(2)} - {g.episodeId})
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="No active grant"
                value={approvalId}
                readOnly
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-500 font-mono text-[11px]"
              />
              <button
                type="button"
                disabled onClick={handleQuickMintGrant}
                className="px-2.5 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-[11px] shrink-0"
              >
                Authorize
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-1 text-[10px]">
            <span className="text-slate-500">
              Required by Rule 2 for agent runs.
            </span>
            {approvalId && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `npm run studio -- episode produce --episode ${defaultEpisodeId} --approval-id ${approvalId} --json`
                  );
                  setCopiedCmd(true);
                  setTimeout(() => setCopiedCmd(false), 2000);
                }}
                className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-mono"
              >
                {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCmd ? 'Copied' : 'Copy Agent CLI'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Pipeline Timeline */}
      {selectedRun ? (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                    Run #{selectedRun.runId}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Target: {selectedRun.episodeId}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Profile: <strong className="text-slate-200 capitalize">{selectedRun.profile}</strong> · Cap: <strong className="text-slate-200 font-mono">${selectedRun.budgetCapUsd.toFixed(2)}</strong>
                </div>
              </div>

              {selectedRun.isCompleted ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 rounded border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Pipeline Completed & Packaged</span>
                  </span>
                  <button
                    onClick={onOpenYouTubeHandoff}
                    className="px-3.5 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1 transition-colors"
                  >
                    <span>Inspect YouTube Package</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-xs font-mono text-teal-400">
                  Current Stage: {selectedRun.currentStageIndex + 1} of {selectedRun.stages.length}
                </div>
              )}
            </div>

            {/* Stages Stack */}
            <div className="space-y-2.5">
              {selectedRun.stages.map((stage, idx) => {
                const isPassed = stage.status === 'succeeded';
                const isCurrent = idx === selectedRun.currentStageIndex && !selectedRun.isCompleted;

                return (
                  <div
                    key={stage.stageName}
                    className={`p-3.5 rounded-md border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-all ${
                      isCurrent
                        ? 'bg-teal-500/10 border-teal-500/40 text-slate-100 shadow-sm'
                        : isPassed
                        ? 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                        : 'bg-slate-950/20 border-slate-900 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] shrink-0 ${
                          isPassed
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : isCurrent
                            ? 'bg-teal-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isPassed ? '✓' : idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{stage.label}</div>
                        {stage.details && (
                          <div className="text-[11px] text-slate-400 mt-0.5">{stage.details}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:justify-end shrink-0 text-[11px] font-mono">
                      {stage.requiresHumanAction && !isPassed && (
                        <span className="text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Human Gate Required</span>
                        </span>
                      )}
                      <span
                        className={`capitalize ${
                          isPassed
                            ? 'text-emerald-400'
                            : isCurrent
                            ? 'text-teal-400'
                            : 'text-slate-600'
                        }`}
                      >
                        {isCurrent ? 'Ready to execute' : stage.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-lg space-y-3">
          <Bot className="w-8 h-8 text-teal-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-100">
            No Active Autoproduce Run Initialized
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            No historical runs for {defaultEpisodeId}. End-to-end execution is unavailable; use the separate real local-render workflow with supplied assets.
          </p>
          <button
            disabled onClick={handleStartRun}
            className="px-4 py-2 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Production on {defaultEpisodeId}</span>
          </button>
        </div>
      )}
    </div>
  );
};
