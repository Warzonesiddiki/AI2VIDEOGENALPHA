import React from 'react';
import { LocalRenderPanel } from './LocalRenderPanel.tsx';

interface ScenePlannerViewProps { projectId: string; episodeId: string }

/** The old pilot examples were not episode assets and cannot be exported as such. */
export const ScenePlannerView: React.FC<ScenePlannerViewProps> = ({ projectId, episodeId }) => (
  <div className="max-w-6xl mx-auto space-y-5">
    <header className="border-b border-slate-800 pb-5">
      <p className="text-xs font-mono uppercase tracking-wider text-teal-400">Supplied-asset workflow</p>
      <h1 className="text-2xl font-bold text-slate-100 mt-2">Local render</h1>
      <p className="text-sm text-slate-400 mt-2">Render existing frames and original audio available to the server. For draft frame prompts, use Flow plan & local render.</p>
    </header>
    <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-200">The old pilot storyboard, mix controls and caption exports were examples, not assets for the selected episode; they have been retired. This tool does not create captions, mix stems, check rights or approve publication.</p>
    {episodeId ? <LocalRenderPanel projectId={projectId} episodeId={episodeId} /> : <p role="status" className="text-sm text-slate-300">Select or create an episode first.</p>}
  </div>
);
