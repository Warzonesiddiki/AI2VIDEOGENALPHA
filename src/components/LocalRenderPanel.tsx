import React, { useEffect, useRef, useState } from 'react';
import type { PublicLocalRenderJob } from '../../server/localMedia.ts';

/** Real local-only execution. No synthetic player fallback and no provider spend. */
export function LocalRenderPanel({ projectId, episodeId }: { projectId: string; episodeId: string }) {
  const [frames, setFrames] = useState(24);
  const [audio, setAudio] = useState('narration.wav');
  const [jobs, setJobs] = useState<PublicLocalRenderJob[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const idempotency = useRef(crypto.randomUUID());
  const generation = useRef(0);
  const base = `/api/projects/${encodeURIComponent(projectId)}/local-renders`;

  useEffect(() => {
    const controller = new AbortController();
    generation.current++; setJobs([]); setError(''); setBusy(false);
    idempotency.current = crypto.randomUUID();
    const load = async () => {
      try {
        const response = await fetch(base, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not load local renders');
        if (!controller.signal.aborted) setJobs(result.data.filter((job: PublicLocalRenderJob) => job.episodeId === episodeId));
      } catch (error: any) { if (!controller.signal.aborted) setError(error.message); }
    };
    void load(); const timer = setInterval(() => { void load(); }, 2000);
    return () => { generation.current++; controller.abort(); clearInterval(timer); };
  }, [base, episodeId]);

  const action = async (suffix = '', body?: unknown) => {
    const current = generation.current;
    setBusy(true); setError('');
    try {
      const response = await fetch(`${base}${suffix}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || 'Local render request failed');
      if (current !== generation.current) return;
      setJobs(previous => [result.data, ...previous.filter(job => job.id !== result.data.id)]);
      if (!suffix) idempotency.current = crypto.randomUUID();
    } catch (error: any) { if (current === generation.current) setError(error.message); }
    finally { if (current === generation.current) setBusy(false); }
  };
  const completed = jobs.find(job => job.state === 'succeeded' && job.qc?.passed);
  return (
    <section className="rounded-xl border border-teal-700/50 bg-slate-900 p-5 space-y-4" aria-labelledby="local-render-heading">
      <div>
        <h2 id="local-render-heading" className="font-semibold text-teal-200">Real Local Render · 1080p / 24fps</h2>
        <p className="text-xs text-slate-400 mt-1">Uses your existing numbered PNG frames and WAV/FLAC audio. No paid generation or automatic publication. Technical QC does not certify editorial quality or rights. Playback checks export bytes against the saved QC hash.</p>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault(); void action('', { episodeId, frameCount: frames, audioFile: audio, idempotencyKey: idempotency.current });
      }}>
        <label className="text-xs text-slate-300 space-y-1">Frame count (24–21,600 · up to 15 minutes)
          <input type="number" required min={24} max={21600} step={1} value={frames} onChange={event => { setFrames(Number(event.target.value)); idempotency.current = crypto.randomUUID(); }} className="block bg-slate-950 border border-slate-600 rounded p-2" />
        </label>
        <label className="text-xs text-slate-300 space-y-1">Audio basename in episode audio folder
          <input required value={audio} pattern="[A-Za-z0-9][A-Za-z0-9_-]*\.(wav|flac)" onChange={event => { setAudio(event.target.value); idempotency.current = crypto.randomUUID(); }} className="block bg-slate-950 border border-slate-600 rounded p-2" />
        </label>
        <button disabled={busy || !episodeId} className="rounded bg-teal-700 px-4 py-2 text-sm disabled:opacity-50">{busy ? 'Submitting…' : 'Queue Local Render'}</button>
      </form>
      <p className="text-xs text-slate-500 break-all">Frames: projects/{projectId}/assets/flow_renders/{episodeId}/frame_00001.png … · Audio: projects/{projectId}/audio/{episodeId}/{audio}</p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      <div className="space-y-2" aria-live="polite">
        {jobs.length === 0 && <p className="text-sm text-slate-500">No local renders for this episode.</p>}
        {jobs.slice(0, 8).map(job => <div key={job.id} className="rounded border border-slate-700 p-3 text-xs space-y-1">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-mono">{job.id}</span><strong>{job.state} · {job.stage}</strong></div>
          {job.progress && <p className="text-slate-300">Video segments: {job.progress.completedSegments}/{job.progress.totalSegments} · encoded this attempt: {job.progress.encodedSegments} · revalidated/reused: {job.progress.reusedSegments}</p>}
          {job.error && <p className="text-rose-300 whitespace-pre-wrap break-words">{job.error}</p>}
          {job.qc?.passed && <p className="text-teal-300">Measured: {job.qc.frameCount} frames · {job.qc.width}×{job.qc.height} · {job.qc.loudnessLufs} LUFS · {job.qc.truePeakDb} dBTP</p>}
          {!['queued', 'running'].includes(job.state) && ((job.checkpoints?.length ?? 0) > 0 || job.retiredCheckpointCount > 0) && <button disabled={busy} onClick={() => { if (window.confirm('Delete this render’s cached video segments? Source assets and exported masters are retained. A retry will re-encode removed segments.')) void action(`/${job.id}/purge-checkpoints`); }} className="underline text-amber-300 mr-3">Delete cached segments</button>}
          {['queued', 'running'].includes(job.state) && <button disabled={busy} onClick={() => { void action(`/${job.id}/cancel`); }} className="underline text-amber-300">Cancel</button>}
          {['failed', 'interrupted', 'cancelled'].includes(job.state) && <button disabled={busy} onClick={() => { void action(`/${job.id}/retry`); }} className="underline text-teal-300">Retry with current input files</button>}
        </div>)}
      </div>
      {completed && <video key={completed.id} controls preload="metadata" src={`${base}/${completed.id}/media`} onError={() => setError('Playback failed. The server blocks exports that no longer match saved QC; inspect integrity, file availability and the server response. No fallback media is used.')} className="w-full rounded-lg bg-black" aria-label="QC-verified local render playback" />}
    </section>
  );
}
