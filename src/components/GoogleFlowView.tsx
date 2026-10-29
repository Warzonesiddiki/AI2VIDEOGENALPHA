import React, { useState, useEffect } from 'react';
import {
  GoogleFlowPlan,
  GoogleFlowBatch,
  FlowAccountSlot,
} from '../types/index.ts';
import {
  Layers,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  RotateCw,
  Film,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  ChevronRight,
  ShieldCheck,
  Terminal,
  FileCheck,
} from 'lucide-react';

interface GoogleFlowViewProps {
  projectId: string;
  episodeId: string;
}

export const GoogleFlowView: React.FC<GoogleFlowViewProps> = ({
  projectId,
  episodeId,
}) => {
  const [plan, setPlan] = useState<GoogleFlowPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(1);
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<'all' | FlowAccountSlot>('all');
  const [copiedBatchIndex, setCopiedBatchIndex] = useState<number | null>(null);
  const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccessMessage, setIngestSuccessMessage] = useState<string | null>(null);
  const [stitchScript, setStitchScript] = useState<string | null>(null);
  const [copiedStitchScript, setCopiedStitchScript] = useState(false);
  const [loadingStitch, setLoadingStitch] = useState(false);

  const fetchPlan = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}/flow/plan/${episodeId}`);
      const data = await res.json();
      if (data.ok && data.data) {
        setPlan(data.data);
      }
    } catch (err) {
      console.error('Failed to load Google Flow plan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlan();
  }, [projectId, episodeId]);

  const handleRecomputePlan = async (minutes: number) => {
    try {
      setLoading(true);
      const durationSeconds = minutes * 60;
      const res = await fetch(`/api/projects/${projectId}/flow/plan/${episodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds,
          fps: 24,
          mode: 'dense_24fps',
        }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setPlan(data.data);
        setSelectedBatchIndex(1);
      }
    } catch (err) {
      console.error('Failed to recompute Google Flow plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateIngest = async (batchId: string) => {
    try {
      setIngesting(true);
      setIngestSuccessMessage(null);
      const res = await fetch(`/api/projects/${projectId}/flow/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episodeId,
          batchId,
          simulate: true,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setIngestSuccessMessage(`Successfully ingested 24 frames for batch ${batchId}!`);
        await fetchPlan();
      }
    } catch (err) {
      console.error('Failed to ingest batch:', err);
    } finally {
      setIngesting(false);
    }
  };

  const handleGenerateStitchScript = async () => {
    try {
      setLoadingStitch(true);
      const res = await fetch(`/api/projects/${projectId}/flow/stitch/${episodeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fps: 24 }),
      });
      const data = await res.json();
      if (data.ok && data.data) {
        setStitchScript(data.data.script);
      }
    } catch (err) {
      console.error('Failed to generate stitch script:', err);
    } finally {
      setLoadingStitch(false);
    }
  };

  const activeBatch = plan?.batches.find((b) => b.batchIndex === selectedBatchIndex);

  const filteredBatches = plan?.batches.filter((b) => {
    if (selectedAccountFilter === 'all') return true;
    return b.assignedAccount === selectedAccountFilter;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-teal-500/10 text-teal-300 border border-teal-500/20">
              flow.google.com Integration
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              $0.00 Credits (Free / Unmetered Pro)
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white mt-1.5 flex items-center gap-2">
            <Layers className="w-6 h-6 text-teal-400" />
            Google Flow 24-Frame Asset Automation
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Batch engine for mass-producing 24-frame animation sequences via <strong className="text-slate-200">flow.google.com</strong>.
            Load-balances batches across your 3 Google Flow Pro accounts and compiles them into a smooth 24fps 1080p video master via local FFmpeg.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://flow.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open flow.google.com</span>
          </a>
          <button
            onClick={() => fetchPlan()}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh Plan"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3-Account Status & Production Mathematics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Math Card */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>24fps Master Math</span>
            <Film className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {plan ? plan.totalFramesExpected.toLocaleString() : '14,400'}
            <span className="text-xs text-slate-400 font-sans font-normal ml-1.5">frames</span>
          </div>
          <div className="text-xs text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span>{plan?.totalBatches || 600} Batches of 24</span>
            <span className="text-teal-400 font-mono font-medium">{durationMinutes} min @ 24fps</span>
          </div>
        </div>

        {/* Account 1 */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-teal-300 font-semibold">
              <Users className="w-3.5 h-3.5" />
              Account 1 (Alpha)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold">PRO</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {plan?.accounts.account_1.batchesCompleted || 0} / {plan?.accounts.account_1.batchesAssigned || 200}
            <span className="text-xs text-slate-400 font-sans font-normal ml-1.5">batches</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all"
              style={{
                width: `${plan ? Math.round(((plan.accounts.account_1.batchesCompleted || 0) / (plan.accounts.account_1.batchesAssigned || 1)) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {((plan?.accounts.account_1.batchesAssigned || 200) * 24).toLocaleString()} frames assigned
          </div>
        </div>

        {/* Account 2 */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-teal-300 font-semibold">
              <Users className="w-3.5 h-3.5" />
              Account 2 (Beta)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold">PRO</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {plan?.accounts.account_2.batchesCompleted || 0} / {plan?.accounts.account_2.batchesAssigned || 200}
            <span className="text-xs text-slate-400 font-sans font-normal ml-1.5">batches</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all"
              style={{
                width: `${plan ? Math.round(((plan.accounts.account_2.batchesCompleted || 0) / (plan.accounts.account_2.batchesAssigned || 1)) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {((plan?.accounts.account_2.batchesAssigned || 200) * 24).toLocaleString()} frames assigned
          </div>
        </div>

        {/* Account 3 */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1 text-teal-300 font-semibold">
              <Users className="w-3.5 h-3.5" />
              Account 3 (Gamma)
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-bold">PRO</span>
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {plan?.accounts.account_3.batchesCompleted || 0} / {plan?.accounts.account_3.batchesAssigned || 200}
            <span className="text-xs text-slate-400 font-sans font-normal ml-1.5">batches</span>
          </div>
          <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-teal-500 h-full rounded-full transition-all"
              style={{
                width: `${plan ? Math.round(((plan.accounts.account_3.batchesCompleted || 0) / (plan.accounts.account_3.batchesAssigned || 1)) * 100) : 0}%`,
              }}
            />
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {((plan?.accounts.account_3.batchesAssigned || 200) * 24).toLocaleString()} frames assigned
          </div>
        </div>
      </div>

      {/* Target Duration Configuration Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-300">Target Episode Duration:</span>
          <div className="flex items-center gap-1.5">
            {[1, 5, 10, 15].map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  setDurationMinutes(mins);
                  handleRecomputePlan(mins);
                }}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  durationMinutes === mins
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800'
                }`}
              >
                {mins} min ({mins * 60 * 24} frames)
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Account Filter:</span>
          <select
            value={selectedAccountFilter}
            onChange={(e) => setSelectedAccountFilter(e.target.value as any)}
            className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none"
          >
            <option value="all">All Accounts (600 Batches)</option>
            <option value="account_1">Account 1 (Alpha - 200 Batches)</option>
            <option value="account_2">Account 2 (Beta - 200 Batches)</option>
            <option value="account_3">Account 3 (Gamma - 200 Batches)</option>
          </select>
        </div>
      </div>

      {/* Main 2-Column Batch Inspector & Prompt Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1: Batch List (Scrollable) */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[640px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <span className="text-xs font-semibold text-slate-200">
              24-Frame Batches ({filteredBatches.length})
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              Batch #{selectedBatchIndex}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredBatches.map((batch) => {
              const isSelected = batch.batchIndex === selectedBatchIndex;
              return (
                <div
                  key={batch.batchId}
                  onClick={() => setSelectedBatchIndex(batch.batchIndex)}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-teal-950/40 border-teal-500/60 ring-1 ring-teal-500/40'
                      : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-200">
                      Batch #{batch.batchIndex}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        batch.assignedAccount === 'account_1'
                          ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                          : batch.assignedAccount === 'account_2'
                          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                      }`}
                    >
                      {batch.assignedAccount.replace('account_', 'Acc ')}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 truncate mt-1">
                    {batch.storyBeatName}
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-2">
                    <span>
                      {batch.timecodeRange.start} → {batch.timecodeRange.end}
                    </span>
                    <span
                      className={`text-[10px] px-1 rounded ${
                        batch.status === 'verified'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : batch.status === 'ingested'
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-slate-500'
                      }`}
                    >
                      {batch.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 2 & 3: Selected Batch Details & 24 Frame Prompts */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-[640px]">
          {activeBatch ? (
            <>
              {/* Batch Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-white font-mono">
                      Batch #{activeBatch.batchIndex}: {activeBatch.batchId}
                    </span>
                    <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {activeBatch.timecodeRange.start} – {activeBatch.timecodeRange.end}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Story Beat: <span className="text-slate-200 font-medium">{activeBatch.storyBeatName}</span>
                    {' • '}
                    Assigned Account: <span className="text-teal-300 font-mono font-medium">{activeBatch.assignedAccount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const text = activeBatch.prompts
                        .map((p) => `[Frame ${p.frameIndex}/24 | Timecode: ${p.timecode}]\n${p.promptText}`)
                        .join('\n\n');
                      navigator.clipboard.writeText(text);
                      setCopiedBatchIndex(activeBatch.batchIndex);
                      setTimeout(() => setCopiedBatchIndex(null), 2000);
                    }}
                    className="px-3 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    {copiedBatchIndex === activeBatch.batchIndex ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedBatchIndex === activeBatch.batchIndex ? 'Copied 24 Prompts' : 'Copy 24 Prompts for Flow'}</span>
                  </button>

                  <button
                    onClick={() => handleSimulateIngest(activeBatch.batchId)}
                    disabled={ingesting}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <FileCheck className="w-3.5 h-3.5 text-teal-400" />
                    <span>{ingesting ? 'Validating...' : 'Verify Ingest'}</span>
                  </button>
                </div>
              </div>

              {ingestSuccessMessage && (
                <div className="my-2 p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{ingestSuccessMessage}</span>
                </div>
              )}

              {/* 24-Frame Prompts Scrollable View */}
              <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
                {activeBatch.prompts.map((p) => (
                  <div
                    key={p.frameIndex}
                    className="p-3.5 rounded-lg bg-slate-950 border border-slate-800/90 space-y-2 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded bg-teal-500/20 text-teal-300 font-mono font-bold flex items-center justify-center text-[11px]">
                          {p.frameIndex}
                        </span>
                        <span className="font-mono text-slate-300 font-medium">
                          Frame {p.globalFrameNumber} / {plan?.totalFramesExpected}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          [{p.timecode}]
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(p.promptText);
                          setCopiedPromptIndex(p.frameIndex);
                          setTimeout(() => setCopiedPromptIndex(null), 1500);
                        }}
                        className="text-slate-400 hover:text-teal-300 text-[11px] flex items-center gap-1 transition-colors"
                      >
                        {copiedPromptIndex === p.frameIndex ? (
                          <Check className="w-3.5 h-3.5 text-teal-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedPromptIndex === p.frameIndex ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed font-mono bg-slate-900/60 p-2.5 rounded border border-slate-800/60 select-all">
                      {p.promptText}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {p.styleIngredients.map((ing, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] bg-slate-900 text-slate-400 border border-slate-800"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500 text-xs">
              Select a batch to inspect prompt ingredients
            </div>
          )}
        </div>
      </div>

      {/* 24fps FFmpeg Master Stitcher Section */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-teal-400" />
              FFmpeg 24fps Master Video Stitcher
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Stitches the 14,400 sequential frames into a 1080p 24fps H.264 master video with pristine audio alignment.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateStitchScript}
              disabled={loadingStitch}
              className="px-3.5 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>{loadingStitch ? 'Generating...' : 'Generate 24fps Stitch Script'}</span>
            </button>
          </div>
        </div>

        {/* CLI Command Quick Box */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
          <div className="text-[11px] text-slate-400 font-medium">Or execute via OpenCode / Terminal CLI:</div>
          <code className="block p-2 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-teal-300 select-all overflow-x-auto whitespace-nowrap">
            npm run studio -- flow stitch --episode {episodeId} --fps 24 --save
          </code>
        </div>

        {stitchScript && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-slate-300">render_flow_{episodeId}_24fps.sh</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(stitchScript);
                  setCopiedStitchScript(true);
                  setTimeout(() => setCopiedStitchScript(false), 2000);
                }}
                className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-[11px]"
              >
                {copiedStitchScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedStitchScript ? 'Copied' : 'Copy Script'}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={10}
              value={stitchScript}
              className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-lg font-mono text-[11px] text-teal-200/90 leading-relaxed resize-none focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};
