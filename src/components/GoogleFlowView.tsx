import React, { useEffect, useRef, useState } from 'react';
import type { GoogleFlowBatch, GoogleFlowPlan } from '../types/index.ts';
import { isFlowBatchVerified } from '../core/flow.ts';
import { LocalRenderPanel } from './LocalRenderPanel.tsx';

interface GoogleFlowViewProps { projectId: string; episodeId: string }
const pageSize = 24;
type PlanSummary = Omit<GoogleFlowPlan, 'batches'>;

/** Planning and actual file verification, without simulated production or account claims. */
export const GoogleFlowView: React.FC<GoogleFlowViewProps> = ({ projectId, episodeId }) => {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [planKnown, setPlanKnown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<GoogleFlowBatch[]>([]);
  const [batchRefresh, setBatchRefresh] = useState(0);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState<number | ''>(600);
  const [fps, setFps] = useState<number | ''>(24);
  const [mode, setMode] = useState<'dense_24fps' | 'keyframe_storyboard'>('dense_24fps');
  const [batchPage, setBatchPage] = useState(0);
  const [selectedBatchIndex, setSelectedBatchIndex] = useState(1);
  const generation = useRef(0);
  const loadSequence = useRef(0);
  const inFlight = useRef(false);
  const base = `/api/projects/${encodeURIComponent(projectId)}/flow`;

  const load = async (scope: number, signal?: AbortSignal): Promise<'loaded' | 'missing' | 'failed' | 'obsolete'> => {
    if (!episodeId) return 'obsolete';
    const sequence = ++loadSequence.current;
    const current = () => scope === generation.current && sequence === loadSequence.current && !signal?.aborted;
    setLoading(true); setBatches([]); setBatchesLoading(false);
    try {
      const response = await fetch(`${base}/plan/${encodeURIComponent(episodeId)}?view=summary`, { signal });
      const result = await response.json();
      if (!current()) return 'obsolete';
      if (response.status === 404) { setPlan(null); setBatches([]); setPlanKnown(true); return 'missing'; }
      if (!response.ok || !result.ok) throw new Error('Plan reload failed');
      const next: PlanSummary = result.data;
      setPlan(next); setPlanKnown(true); setBatchRefresh(value => value + 1);
      setDuration(next.totalDurationSeconds); setFps(next.fps); setMode(next.mode);
      setBatchPage(value => Math.min(value, Math.max(0, Math.ceil(next.totalBatches / pageSize) - 1)));
      setSelectedBatchIndex(value => Math.min(Math.max(1, value), next.totalBatches));
      return 'loaded';
    } catch {
      if (current()) {
        setPlan(null); setBatches([]); setPlanKnown(false); setMessage('');
        setError('Could not reload the plan; its verification state is unknown. Reload before continuing.');
        return 'failed';
      }
      return 'obsolete';
    } finally { if (current()) setLoading(false); }
  };

  useEffect(() => {
    const controller = new AbortController();
    const scope = ++generation.current;
    setPlan(null); setPlanKnown(false); setBatches([]); setError(''); setMessage(''); setBatchPage(0); setSelectedBatchIndex(1); setBusy(false); inFlight.current = false;
    if (episodeId) void load(scope, controller.signal);
    return () => { generation.current++; loadSequence.current++; controller.abort(); };
  }, [projectId, episodeId]);

  useEffect(() => {
    if (!plan || !episodeId) { setBatches([]); return; }
    const controller = new AbortController();
    const scope = generation.current, sequence = loadSequence.current;
    const current = () => !controller.signal.aborted && scope === generation.current && sequence === loadSequence.current;
    const start = batchPage * pageSize + 1;
    setSelectedBatchIndex(start); setBatches([]); setBatchesLoading(true);
    fetch(`${base}/plan/${encodeURIComponent(episodeId)}/batches?start=${start}&limit=${pageSize}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not load batch page');
        if (result.data.revision !== (plan.revision ?? 0)) throw new Error('Plan changed while loading its batches. Reload the plan before continuing.');
        if (current()) setBatches(result.data.batches);
      })
      .catch(err => { if (current()) setError(err instanceof Error ? err.message : 'Could not load batch page'); })
      .finally(() => { if (current()) setBatchesLoading(false); });
    return () => controller.abort();
  }, [base, episodeId, batchPage, plan?.revision, batchRefresh]);

  const prepare = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current || loading || !planKnown || !episodeId || duration === '' || fps === '') return;
    if (plan && !window.confirm('Replace this plan and clear its saved batch verification evidence? Source files and rendered exports are not deleted.')) return;
    const scope = generation.current, expectedRevision = plan?.revision ?? 0;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    loadSequence.current++; setPlanKnown(false); setPlan(null); setBatches([]);
    let failure = '';
    try {
      const response = await fetch(`${base}/plan/${encodeURIComponent(episodeId)}?view=summary`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: duration, fps, mode, expectedRevision }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not prepare plan');
      if (scope === generation.current) { setBatchPage(0); setSelectedBatchIndex(1); }
    } catch (err) { failure = err instanceof Error ? err.message : 'Could not prepare plan'; }
    if (scope !== generation.current) return;
    const refreshed = await load(scope);
    if (scope !== generation.current) return;
    if (refreshed === 'loaded') {
      if (failure) setError(failure);
      else setMessage('Draft plan saved. No images, audio, render or approval were created.');
    } else if (refreshed === 'missing') {
      setError(failure || 'The saved plan could not be found after preparation. Reload before continuing.');
    }
    inFlight.current = false; setBusy(false);
  };

  const verify = async (batchId: string) => {
    if (inFlight.current || loading || !planKnown || !plan) return;
    const scope = generation.current, expectedRevision = plan.revision ?? 0;
    inFlight.current = true; setBusy(true); setError(''); setMessage('');
    // Old badges are not current once a recheck can revoke or replace evidence.
    loadSequence.current++; setPlanKnown(false); setPlan(null); setBatches([]);
    let failure = '';
    try {
      const response = await fetch(`${base}/ingest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeId, batchId, expectedRevision }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Frame verification failed');
    } catch (err) { failure = err instanceof Error ? err.message : 'Frame verification failed'; }
    if (scope !== generation.current) return;
    const refreshed = await load(scope);
    if (scope !== generation.current) return;
    if (refreshed === 'loaded') {
      if (failure) setError(failure);
      else setMessage('Batch files were decoded and recorded at verification time. Subsequent file changes require another check.');
    } else if (refreshed === 'missing') {
      setError('The plan is no longer available; no saved verification can be relied on.');
    }
    inFlight.current = false; setBusy(false);
  };

  if (!episodeId) return <p role="status" className="text-sm text-slate-300">Select or create an episode before opening planning and local render.</p>;
  const selected = batches.find(batch => batch.batchIndex === selectedBatchIndex);
  const pages = Math.max(1, Math.ceil((plan?.totalBatches ?? 0) / pageSize));
  const displayed = batches;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-mono text-teal-400 uppercase tracking-wider">{projectId} / {episodeId}</p>
        <h1 className="text-2xl font-bold text-slate-100 mt-2">Flow planning & local render</h1>
        <p className="text-sm text-slate-400 mt-2">Prepare a frame inventory, inspect draft prompts, and verify supplied files. Planning does not generate media or authorize spend or publication.</p>
      </header>
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-200">
        Prompts are unreviewed scaffolds based on episode fields, not bespoke finished storyboards. Existing plans may contain old pilot-specific template text; review them or deliberately replace them. No account, credit, cost, quality or audience-performance claim is verified here.
      </div>
      {error && <div role="alert" className="rounded border border-rose-700 p-3 text-sm text-rose-200">{error} <button type="button" disabled={busy || loading} className="underline ml-2 disabled:opacity-50" onClick={() => { setError(''); void load(generation.current); }}>Reload plan</button></div>}
      {message && <p role="status" className="text-sm text-teal-300">{message}</p>}
      <form onSubmit={prepare} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div><h2 className="font-semibold text-slate-100">{plan ? 'Replace saved draft plan' : 'Prepare a draft plan'}</h2><p className="text-xs text-slate-400 mt-1">Replacing a plan clears its saved verification evidence; supplied files are retained. Concurrent edits are revision-checked.</p></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-300">Duration in seconds (1–900)<input type="number" required min={1} max={900} step={1} value={duration} onChange={event => setDuration(event.target.value === '' ? '' : Number(event.target.value))} className="block mt-1 bg-slate-950 border border-slate-700 rounded p-2" /></label>
          <label className="text-xs text-slate-300">Output FPS (1–60)<input type="number" required min={1} max={60} step={1} value={fps} onChange={event => setFps(event.target.value === '' ? '' : Number(event.target.value))} className="block mt-1 bg-slate-950 border border-slate-700 rounded p-2" /></label>
          <label className="text-xs text-slate-300">Inventory mode<select value={mode} onChange={event => setMode(event.target.value as typeof mode)} className="block mt-1 bg-slate-950 border border-slate-700 rounded p-2"><option value="dense_24fps">One image per output frame</option><option value="keyframe_storyboard">One keyframe per second</option></select></label>
          <button disabled={busy || loading || !planKnown} className="rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold">{busy ? 'Working…' : plan ? 'Replace plan' : 'Prepare plan'}</button>
        </div>
      </form>
      {plan && plan.sourceState !== 'current' && <p role="alert" className="rounded border border-amber-500/40 bg-amber-950/30 p-3 text-sm text-amber-200">{plan.sourceState === 'stale' ? 'The episode changed after this plan was prepared.' : 'This plan has no reliable source episode revision.'} Replace the draft plan before verifying its frames; existing files are not deleted.</p>}
      {loading && <p role="status" className="text-sm text-slate-400">Loading plan…</p>}
      {plan && <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold text-slate-100">Saved plan: {plan.episodeTitle}</h2><p className="text-xs text-slate-400 mt-1">{plan.totalFramesExpected.toLocaleString()} expected images in {plan.totalBatches.toLocaleString()} batches · {plan.summary.verifiedBatches} batches last verified · revision {plan.revision ?? 0}</p></div><button type="button" disabled={busy || loading} onClick={() => { setError(''); void load(generation.current); }} className="text-xs underline text-teal-300 disabled:opacity-50">Reload</button></div>
        <p className="text-xs text-slate-400 break-all">Put numbered PNG files in projects/{projectId}/assets/flow_renders/{episodeId}/ as frame_00001.png, frame_00002.png, and so on.</p>
        {batchesLoading && <p role="status" className="text-xs text-slate-400">Loading batch page…</p>}
        <div className="flex flex-wrap gap-2">{displayed.map(batch => <button key={batch.batchId} type="button" onClick={() => setSelectedBatchIndex(batch.batchIndex)} className={`rounded border px-2.5 py-1.5 text-xs ${selectedBatchIndex === batch.batchIndex ? 'border-teal-400 text-teal-200' : 'border-slate-700 text-slate-300'}`}>{batch.batchIndex}{isFlowBatchVerified(batch) ? ' ✓' : ''}</button>)}</div>
        <div className="flex items-center gap-3 text-xs text-slate-400"><button type="button" disabled={batchPage === 0} onClick={() => setBatchPage(page => page - 1)} className="underline disabled:opacity-40">Previous batches</button><span>Page {batchPage + 1} of {pages}</span><button type="button" disabled={batchPage + 1 >= pages} onClick={() => setBatchPage(page => page + 1)} className="underline disabled:opacity-40">Next batches</button></div>
        {selected && <div className="rounded border border-slate-700 p-4 space-y-3">
          <div className="flex flex-wrap justify-between gap-2"><div><h3 className="text-sm font-semibold text-slate-100">Batch {selected.batchIndex} · {selected.storyBeatName}</h3><p className="text-xs text-slate-400 mt-1">{selected.timecodeRange.start}–{selected.timecodeRange.end} · {selected.framesExpected} images · {isFlowBatchVerified(selected) ? 'verified at last check' : 'not verified'}</p></div><button type="button" disabled={busy || loading || plan.sourceState !== 'current'} onClick={() => void verify(selected.batchId)} className="rounded border border-teal-600 px-3 py-2 text-xs text-teal-200 disabled:opacity-50">Verify existing PNGs</button></div>
          <details><summary className="cursor-pointer text-xs text-slate-300">Review {selected.prompts.length} draft frame prompts</summary><ol className="mt-3 space-y-2 text-xs text-slate-300">{selected.prompts.map(prompt => <li key={prompt.globalFrameNumber} className="rounded bg-slate-950 p-2"><span className="font-mono text-teal-400">#{prompt.globalFrameNumber} {prompt.timecode}</span><p className="mt-1">{prompt.promptText}</p></li>)}</ol></details>
        </div>}
      </section>}
      <LocalRenderPanel projectId={projectId} episodeId={episodeId} />
    </div>
  );
};
