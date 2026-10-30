import React, { useState } from 'react';
import { getPilotVideoEssayData } from '../core/video_essay.ts';

interface VideoEssayStudioViewProps { projectId: string }

/** An explicitly labelled static sample, not a project-scoped production surface. */
export const VideoEssayStudioView: React.FC<VideoEssayStudioViewProps> = ({ projectId }) => {
  const [index, setIndex] = useState(0);
  const sample = getPilotVideoEssayData();
  const slide = sample.slides[index];
  return (
    <section className="max-w-4xl mx-auto space-y-5">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-mono text-teal-400 uppercase tracking-wider">Static sample • not project data</p>
        <h1 className="text-2xl font-bold text-slate-100 mt-2">Video Essay example</h1>
        <p className="text-sm text-slate-400 mt-2">This illustrative pilot is bundled with the app and is not a version of the selected project ({projectId}). Its narration, timings and visual prompts have not been reviewed for production.</p>
      </header>
      <div role="status" className="p-4 rounded-lg border border-amber-500/30 bg-amber-950/30 text-amber-200 text-sm space-y-2">
        <p>Legacy Video Essay render and speech-script exports are retired. They could create placeholder media or claim unverified success; the old Edge-TTS script sends text to an external service.</p>
        <p>Previously downloaded scripts are not changed by this update. Do not run them. For supplied assets and measured technical QC, use Local Render.</p>
      </div>
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap justify-between gap-3 items-center">
          <div><p className="text-xs text-slate-500">SAMPLE SLIDE {index + 1} OF {sample.slides.length}</p><h2 className="text-lg font-semibold text-slate-100">{slide.chapterTitle}</h2></div>
          <div className="flex gap-2">
            <button type="button" disabled={index === 0} onClick={() => setIndex(i => i - 1)} className="px-3 py-2 text-xs rounded border border-slate-700 text-slate-200 disabled:opacity-40">Previous</button>
            <button type="button" disabled={index === sample.slides.length - 1} onClick={() => setIndex(i => i + 1)} className="px-3 py-2 text-xs rounded border border-slate-700 text-slate-200 disabled:opacity-40">Next</button>
          </div>
        </div>
        <p className="text-xs text-slate-500">Illustrative timing: {slide.timecodeStart}–{slide.timecodeEnd}</p>
        <div><h3 className="text-xs font-semibold uppercase text-slate-400">Draft narration</h3><p className="text-sm text-slate-200 mt-1 leading-relaxed">{slide.narratorScript}</p></div>
        <div><h3 className="text-xs font-semibold uppercase text-slate-400">Draft visual prompt</h3><p className="text-sm text-slate-300 mt-1 leading-relaxed">{slide.flowPrompt}</p></div>
      </article>
    </section>
  );
};
