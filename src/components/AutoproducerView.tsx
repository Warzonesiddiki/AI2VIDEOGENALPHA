import React, { useEffect, useState } from 'react';
import type { PublicAutoproduceRun } from '../types/index.ts';

interface AutoproducerViewProps {
  projectId: string;
  defaultEpisodeId?: string;
  onOpenYouTubeHandoff: () => void;
}

/** Historical records only; execution and creation of spending grants stay disabled. */
export const AutoproducerView: React.FC<AutoproducerViewProps> = ({ projectId }) => {
  const [runs, setRuns] = useState<PublicAutoproduceRun[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setRuns([]); setError(''); setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/autoproduce`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.data)) throw new Error(result.error || 'Could not load historical runs');
        if (!controller.signal.aborted) setRuns(result.data);
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load historical runs'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId]);
  return <section className="max-w-5xl mx-auto space-y-5">
    <header className="border-b border-slate-800 pb-5"><p className="text-xs font-mono text-teal-400 uppercase tracking-wider">Read-only history</p><h1 className="text-2xl font-bold text-slate-100 mt-2">Historical autoproducer records</h1></header>
    <div role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-200">Starting or advancing automated production and creating spend approvals are disabled. Historical labels are not evidence of completed media, technical QC, rights review or publishing authorization. Use Flow planning / Local Render for supplied assets.</div>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {loading && <p role="status" className="text-sm text-slate-400">Loading history…</p>}
    {!loading && !error && !runs.length && <p className="text-sm text-slate-400">No historical runs for this project.</p>}
    {runs.map(run => <article key={run.runId} className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
      <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold text-slate-100">{run.runId}</h2><span className="text-xs text-slate-400">Episode {run.episodeId}</span></div>
      <p className="text-xs text-slate-400">Stored profile: {run.profile} · stored completion flag: {run.isCompleted ? 'true' : 'false'} (unverified)</p>
      {run.blockerSummary && <p className="text-xs text-amber-300">{run.blockerSummary}</p>}
      {Array.isArray(run.stages) && <ul className="space-y-1 text-xs text-slate-300">{run.stages.map((stage, index) => <li key={`${stage.stageName}-${index}`} className="rounded bg-slate-950 px-3 py-2">{stage.label} — stored status: {stage.status}</li>)}</ul>}
    </article>)}
  </section>;
};
