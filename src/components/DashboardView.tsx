import React from 'react';
import type { ActiveTab } from './Navigation.tsx';
import type { EpisodeCard, PublicGenerationJob, SeriesBible } from '../types/index.ts';

interface DashboardViewProps {
  series: SeriesBible | null;
  episodes: EpisodeCard[];
  jobs: PublicGenerationJob[];
  selectedEpisodeId: string;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenEpisode: (epId: string) => void;
  onPlanEpisode: (epId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ series, episodes, jobs, selectedEpisodeId, onSelectTab, onOpenEpisode, onPlanEpisode }) => {
  const episode = episodes.find(item => item.id === selectedEpisodeId) ?? episodes[0];
  const blocked = jobs.filter(job => job.state === 'blocked' || job.state === 'needs_user').length;
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-mono text-teal-400 uppercase tracking-wider">Local-first workspace</p>
        <h1 className="text-2xl font-bold text-slate-100 mt-2">Studio overview</h1>
        <p className="text-sm text-slate-400 mt-1">{series?.seriesTitle || 'Series not loaded'} · Select a project and episode in the header.</p>
      </header>
      <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-200">Planning and supplied-asset local rendering are available. Automated media generation, new spend approvals, independent editorial/rights certification and public publishing are not implemented. Technical QC alone is not production or publishing approval.</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Loaded episode cards</p><p className="text-2xl font-semibold text-slate-100 mt-1">{episodes.length}</p></div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Historical production jobs</p><p className="text-2xl font-semibold text-slate-100 mt-1">{jobs.length}</p><p className="text-xs text-slate-500 mt-1">Local render jobs are shown in the render panel.</p></div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4"><p className="text-xs text-slate-400">Historical jobs marked blocked / needs user</p><p className="text-2xl font-semibold text-slate-100 mt-1">{blocked}</p></div>
      </div>
      {episode ? <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3">
        <p className="text-xs font-mono text-teal-400">SELECTED EPISODE · {episode.id}</p>
        <h2 className="text-lg font-semibold text-slate-100">{episode.workingTitle}</h2>
        <p className="text-sm text-slate-300">{episode.logline || 'No logline supplied.'}</p>
        <p className="text-xs text-slate-400">Stored status: {episode.status === 'script_approved' ? 'local script review marker (identity unverified)' : episode.status.replace(/_/g, ' ')}. This is not a readiness certification.</p>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onOpenEpisode(episode.id)} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-200">Open script</button><button type="button" onClick={() => onPlanEpisode(episode.id)} className="rounded bg-teal-600 px-3 py-2 text-xs font-semibold text-white">Plan / local render</button></div>
      </section> : <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-400">No episode is loaded. Open the episode board to create a draft.</section>}
      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-3"><h2 className="font-semibold text-slate-100">Workspace</h2><div className="flex flex-wrap gap-2">{([['episodes', 'Episode board'], ['series_bible', 'Series room'], ['research_room', 'Research'], ['doctor', 'Runtime diagnostics'], ['settings', 'Settings']] as const).map(([tab, label]) => <button key={tab} type="button" onClick={() => onSelectTab(tab)} className="rounded border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:text-white">{label}</button>)}</div></section>
    </div>
  );
};
