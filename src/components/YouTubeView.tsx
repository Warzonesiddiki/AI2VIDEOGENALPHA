import React, { useEffect, useState } from 'react';
import type { PublicYouTubePackage } from '../types/index.ts';

/** Historical metadata only. No upload, publication, approval or QC action is available. */
export const YouTubeView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [packages, setPackages] = useState<PublicYouTubePackage[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setPackages([]); setSelectedId(''); setLoading(true); setError('');
    fetch(`/api/projects/${encodeURIComponent(projectId)}/youtube`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.data)) throw new Error(result.error || 'Could not load historical packages');
        if (!controller.signal.aborted) { setPackages(result.data); setSelectedId(result.data[0]?.id ?? ''); }
      })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not load packages'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId]);
  const selected = packages.find(item => item.id === selectedId);
  return <div className="max-w-5xl mx-auto space-y-5">
    <header className="border-b border-slate-800 pb-5"><p className="text-xs font-mono uppercase tracking-wider text-teal-400">Release records</p><h1 className="text-2xl font-bold mt-2">Historical YouTube metadata</h1><p className="text-sm text-slate-400 mt-2">Inspect stored package records for the selected project.</p></header>
    <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-200">Package creation, upload and publication are disabled. Historical paths, timestamps, QC and approval labels are unverified metadata—not proof that a file exists, has passed QC, has rights clearance, or is authorized for release. Independent human review is required for any release.</p>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {loading ? <p role="status" className="text-sm text-slate-400">Loading historical records…</p> : packages.length === 0 ? <p className="text-sm text-slate-400">No historical package records for this project.</p> : <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
      <label className="text-sm text-slate-300">Historical record<select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="block mt-2 w-full max-w-lg rounded border border-slate-700 bg-slate-950 p-2 text-sm">{packages.map(item => <option key={item.id} value={item.id}>{item.episodeId} — {item.workingTitle || item.selectedTitle || item.id}</option>)}</select></label>
      {selected && <><p className="text-xs text-slate-400">Public projection of the stored record. Filesystem paths and raw QC diagnostics stay in local project data; fields may be outdated or inaccurate.</p><pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-4 text-xs text-slate-300">{JSON.stringify(selected, null, 2)}</pre></>}
    </section>}
  </div>;
};
