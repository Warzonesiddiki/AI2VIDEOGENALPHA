import { reviewStoryCraft } from '../core/storyCraft.ts';
import React, { useState, useEffect, useRef } from 'react';
import { EpisodeCard, ScriptVersion, CanonEvent } from '../types/index.ts';
import { calculateNarrationPacing, calculateWordCount, validateCanonHardRules } from '../core/rules.ts';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Save,
  BookOpen,
  Volume2,
  ShieldCheck,
} from 'lucide-react';

interface ScriptEditorViewProps {
  projectId: string;
  episodeId: string;
  onBack: () => void;
  onRefreshEpisode: () => void;
}

export const ScriptEditorView: React.FC<ScriptEditorViewProps> = ({
  projectId,
  episodeId,
  onBack,
  onRefreshEpisode,
}) => {
  const generation = useRef(0);
  const savingRef = useRef(false);
  const [episode, setEpisode] = useState<EpisodeCard | null>(null);
  const [canonEvents, setCanonEvents] = useState<CanonEvent[]>([]);
  const [scriptText, setScriptText] = useState('');
  const [targetWpm, setTargetWpm] = useState(145);
  const [isSaving, setIsSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    generation.current++; savingRef.current = false; setIsSaving(false);
    setEpisode(null); setScriptText(''); setSaveNotice(null);
    fetch(`/api/projects/${projectId}/episodes/${episodeId}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Could not load episode');
        return result.data;
      })
      .then(loaded => {
        if (controller.signal.aborted) return;
        setEpisode(loaded);
        const script = loaded.scriptVersions[loaded.activeScriptVersionIndex];
        setScriptText(script?.fullNarrationText || ''); setTargetWpm(script?.targetWpm || 145);
      })
      .catch(error => { if (!controller.signal.aborted) setSaveNotice(error.message); });
    return () => { generation.current++; controller.abort(); };
  }, [projectId, episodeId]);

  const wordCount = calculateWordCount(scriptText);
  const pacing = calculateNarrationPacing(wordCount, targetWpm);
  const canonCheck = validateCanonHardRules(scriptText);
  const storyCraft = reviewStoryCraft(episode ? {
    ...episode,
    activeScriptVersionIndex: 0,
    scriptVersions: [{ ...episode.scriptVersions[episode.activeScriptVersionIndex], fullNarrationText: scriptText, targetWpm, actualVoiceDurationSeconds: undefined }],
  } : {});

  const handleSaveDraft = async (approve: boolean = false) => {
    if (!episode || savingRef.current) return;
    const current = generation.current;
    savingRef.current = true;
    setIsSaving(true);
    setSaveNotice(null);

    const updatedVersions: ScriptVersion[] = [...(episode.scriptVersions || [])];
    const newVersion: ScriptVersion = {
      versionNumber: (updatedVersions.length || 0) + 1,
      fullNarrationText: scriptText,
      wordCount: pacing.wordCount,
      estimatedDurationSeconds: pacing.estimatedDurationSeconds,
      targetWpm,
      isApproved: approve,
      approvedBy: approve ? 'Local operator review marker (identity unverified)' : undefined,
      approvalNotes: approve ? 'Local script review marker only; not independent rights, spend, technical QC or publication approval.' : undefined,
      beats: episode.scriptVersions[0]?.beats || [],
      pronunciationNotes: [
        { term: 'Mistry', guide: 'MIS-tree' },
        { term: 'Ilyan', guide: 'EEL-yahn' },
        { term: 'Ternfall', guide: 'TURN-fawl' },
      ],
      createdAt: new Date().toISOString(),
    };

    updatedVersions.push(newVersion);

    const updatedEpisode: EpisodeCard = {
      ...episode,
      scriptVersions: updatedVersions,
      activeScriptVersionIndex: updatedVersions.length - 1,
      status: approve ? 'script_approved' : 'script_draft',
      staleDownstreamAssets: true, // Master rule: upstream script edit invalidates downstream assets
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch(`/api/projects/${projectId}/episodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEpisode),
      });
      const data = await res.json();
      if (current !== generation.current) return;
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not save draft');
      if (data.ok) {
        setEpisode(data.data);
        setSaveNotice(
          approve
            ? 'Local review marker saved (not independent approval). Dependent scene assets marked stale.'
            : 'Draft version saved.'
        );
        onRefreshEpisode();
      }
    } catch (err: any) {
      if (current === generation.current) setSaveNotice(`Not saved: ${err.message} Your editor text has been kept; copy it before reloading.`);
    } finally {
      if (current === generation.current) { savingRef.current = false; setIsSaving(false); }
    }
  };

  if (!episode) {
    return <div role="status" className="p-8 text-center text-xs text-slate-400">{saveNotice || 'Loading script editor…'}</div>;
  }

  const activeVersion = episode.scriptVersions[episode.activeScriptVersionIndex];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-slate-300 font-mono mb-1 block"
          >
            ← Back to Episode Board
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
              {episode.id}
            </span>
            <h1 className="text-xl font-bold text-slate-100">{episode.workingTitle}</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl truncate">
            {episode.logline}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            disabled={isSaving}
            onClick={() => handleSaveDraft(false)}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Version</span>
          </button>
          <button
            disabled={isSaving || canonCheck.violatesHardRules}
            onClick={() => handleSaveDraft(true)}
            className="px-3.5 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark Local Script Review</span>
          </button>
        </div>
      </div>

      <section aria-label="Story craft review" className="p-4 rounded-xl border border-amber-500/25 bg-slate-900 text-sm space-y-2">
        <h2 className="font-semibold text-amber-200">Story craft — advisory, not a quality score or approval</h2>
        <p className="text-xs text-slate-400">Check causal escalation, competing needs, a planted solution and an irreversible cost. Reading time is an estimate, not measured voice. A local review marker does not authorize spend or publication.</p>
        {storyCraft.issues.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-100 space-y-1">
          {storyCraft.issues.map(issue => <li key={issue.field}>{issue.question}</li>)}
        </ul>}
        <details className="text-xs text-slate-300"><summary className="cursor-pointer">Editorial questions for every revision</summary>
          <ul className="list-disc pl-5 pt-2 space-y-1">{storyCraft.reviewQuestions.map(question => <li key={question}>{question}</li>)}</ul>
        </details>
      </section>

      {saveNotice && (
        <div className="p-3 rounded bg-slate-900 border border-teal-500/40 text-xs text-teal-300 flex items-center justify-between">
          <span>{saveNotice}</span>
          <button onClick={() => setSaveNotice(null)} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
      )}

      {/* Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Narration Editor */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold text-slate-300">Narration & Spoken Beats:</span>
            <span className="font-mono text-[11px]">
              Version #{activeVersion?.versionNumber || 1}{' '}
              {activeVersion?.isApproved ? '(Approved)' : '(Draft)'}
            </span>
          </div>

          <textarea
            rows={22}
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="[Cold Open 00:00]&#10;Write the full spoken narration text here..."
            className="w-full p-4 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 text-xs leading-relaxed font-sans focus:outline-none focus:border-teal-500 resize-y"
          />

          {/* Canon Warnings */}
          {canonCheck.violatesHardRules && (
            <div className="p-3 rounded bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Hard Canon Violations Detected:</span>
              </div>
              {canonCheck.infractions.map((inf, i) => (
                <div key={i} className="text-[11px] pl-5">
                  · {inf}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Pacing Meter & Canon Sidebar */}
        <div className="space-y-4">
          {/* Real-time Pacing Calculator */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Runtime Pacing Meter</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-500 font-sans">Spoken Words</div>
                <div className="text-lg font-bold text-slate-100">{pacing.wordCount}</div>
                <div className="text-[10px] text-slate-500">Target: ~2,175</div>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-[11px] text-slate-500 font-sans">Est. Runtime</div>
                <div className="text-lg font-bold text-teal-300">{pacing.estimatedDurationFormatted}</div>
                <div className="text-[10px] text-slate-500">Target: ~15:00</div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Speaking Rate (WPM):</span>
                <span className="font-mono text-slate-200">{targetWpm} wpm</span>
              </div>
              <input
                type="range"
                min={130}
                max={170}
                value={targetWpm}
                onChange={(e) => setTargetWpm(parseInt(e.target.value))}
                className="w-full accent-teal-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>130 (slow)</span>
                <span>145 (standard)</span>
                <span>170 (rapid)</span>
              </div>
            </div>

            <div
              className={`p-2.5 rounded text-[11px] ${
                pacing.isWithinTarget15Min
                  ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300'
                  : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
              }`}
            >
              {pacing.pacingNote}
            </div>
          </div>

          {/* Pronunciation Guide */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-teal-400" />
              <span>Pronunciation Guide</span>
            </h3>
            <div className="space-y-1.5 text-xs font-mono">
              <div className="flex justify-between p-1.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Rhea Mistry</span>
                <span className="text-teal-400">RAY-uh MIS-tree</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Mara Ilyan</span>
                <span className="text-teal-400">EEL-yahn</span>
              </div>
              <div className="flex justify-between p-1.5 rounded bg-slate-950 border border-slate-800/80">
                <span className="text-slate-300">Ternfall</span>
                <span className="text-teal-400">TURN-fawl</span>
              </div>
            </div>
          </div>

          {/* Canon Check Anchors */}
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-teal-400" />
              <span>Canon State for this Beat</span>
            </h3>
            <div className="text-[11px] text-slate-400 space-y-1 leading-relaxed">
              <div>· Physical Location: South Gate Control Works</div>
              <div>· Time: Day 01, 03:30 AM (Cold Salt Mist)</div>
              <div>· Characters Present: Rhea Mistry, Mara Ilyan</div>
              <div>· Knowledge: Infection spreads by contact; water supply is clean.</div>
              <div>· Mechanical Pulse: 8 beats, 3 second pause.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
