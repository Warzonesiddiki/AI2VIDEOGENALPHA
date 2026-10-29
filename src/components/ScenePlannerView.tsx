import React, { useState } from 'react';
import { ShotItem, AudioStemConfig } from '../types/index.ts';
import { generateSrtContent, generateVttContent } from '../core/captions.ts';
import {
  LayoutGrid,
  Film,
  Volume2,
  Sliders,
  Download,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  Terminal,
  Copy,
  Check,
} from 'lucide-react';

interface ScenePlannerViewProps {
  episodeId: string;
}

export const ScenePlannerView: React.FC<ScenePlannerViewProps> = ({ episodeId }) => {
  const [activeTab, setActiveTab] = useState<'storyboard' | 'audio_stems' | 'captions' | 'render_script'>('storyboard');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [renderScript, setRenderScript] = useState<string | null>(null);
  const [renderCliCommand, setRenderCliCommand] = useState<string | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  const loadRenderScript = async () => {
    setLoadingScript(true);
    try {
      const res = await fetch(`/api/projects/proj_ternfall_01/episodes/${episodeId}/render-script`);
      const data = await res.json();
      if (data.ok && data.data) {
        setRenderScript(data.data.script);
        setRenderCliCommand(data.data.cliCommand);
      }
    } catch (err) {
      console.error('Failed to load render script:', err);
    } finally {
      setLoadingScript(false);
    }
  };

  const [audioConfig, setAudioConfig] = useState<AudioStemConfig>({
    narrationVolume: 0.9,
    musicVolume: 0.25,
    sfxVolume: 0.6,
    duckMusicUnderSpeech: true,
    loudnessTargetLufs: -14.0,
  });

  // Sample verified shots mapped to the Pilot beats
  const sampleShots: ShotItem[] = [
    {
      id: 'shot_001',
      sceneNumber: 1,
      shotNumber: 1,
      durationSeconds: 8,
      aspectRatio: '16:9',
      purpose: 'Establish mechanical mystery on Basin 3 pressure gauge',
      framing: 'close_up',
      pov: 'Third person close on analog instrument panel',
      characterReferenceIds: ['rhea-mistry'],
      locationReferenceId: 'loc_south_gate',
      timeAndLighting: 'Pre-dawn 03:30 AM, sodium-amber reflection through salt mist',
      actionDescription: 'Brass pressure needle twitches exactly eight times, pauses for 3 seconds, and repeats.',
      visualPrompt: 'Editorial 2D illustration of a weathered brass hydraulic pressure gauge on damp concrete wall, needle vibrating in an 8-beat cadence, amber sodium reflection, dark teal palette, paper grain texture, high detail',
      negativePrompt: 'hyper-saturated neon, glossy 3D, anime big eyes, gore, modern touchscreen',
      animationMethod: 'still_with_camera_move',
      transitionToNext: 'cut',
      narrationAnchorText: 'The brass needle on the Basin Three gauge did not tremble. It twitched eight times...',
      captionText: 'The brass needle on the Basin Three gauge did not tremble. It twitched eight times...',
      captionSafeChecked: true,
      assetSource: 'project_illustration',
      isApproved: true,
    },
    {
      id: 'shot_002',
      sceneNumber: 1,
      shotNumber: 2,
      durationSeconds: 12,
      aspectRatio: '16:9',
      purpose: 'Introduce Rhea Mistry at the analog sluice catwalk',
      framing: 'medium',
      pov: 'Profile on Rhea adjusting her collar',
      characterReferenceIds: ['rhea-mistry'],
      locationReferenceId: 'loc_south_gate',
      timeAndLighting: 'Sodium streetlight through iron mesh catwalk',
      actionDescription: 'Rhea shines inspection torch down onto cast-iron sluice door; water level visibly rises.',
      visualPrompt: 'Editorial hand-inked illustration of 31-year-old water engineer Rhea Mistry in cropped slate-teal rain jacket with signal-coral cuff tabs, holding brass pressure gauge at belt, inspecting dark flooded sluice gate below catwalk, paper texture',
      negativePrompt: 'yellow hat, yellow beanie, cartoon mascot, hyper-saturated glow',
      animationMethod: 'limited_2d_parallax',
      transitionToNext: 'dissolve',
      narrationAnchorText: 'Rhea was thirty-one, wore a cropped slate-teal rain jacket stiff with salt mist...',
      captionText: 'Rhea was thirty-one, wore a cropped slate-teal rain jacket stiff with salt mist...',
      captionSafeChecked: true,
      assetSource: 'project_illustration',
      isApproved: true,
    },
    {
      id: 'shot_003',
      sceneNumber: 2,
      shotNumber: 1,
      durationSeconds: 10,
      aspectRatio: '16:9',
      purpose: 'Mara hammers on jammed maintenance hatch',
      framing: 'medium',
      pov: 'Two-shot: Rhea approaching Mara at emergency hatch',
      characterReferenceIds: ['rhea-mistry', 'mara-ilyan'],
      locationReferenceId: 'loc_south_gate',
      timeAndLighting: 'Emergency red beacon reflecting off damp iron',
      actionDescription: 'Mara Ilyan uses pipe wrench to pry manual release; sparks fly as rusted latch resists.',
      visualPrompt: 'Editorial 2D illustration of ferry mechanic Mara Ilyan in heavy grease-stained work coat hammering pipe wrench against iron hatch, water pooling at boots, realistic restrained motion, muted estuary tones',
      negativePrompt: 'gore, cartoon explosion, hyper-neon',
      animationMethod: 'limited_2d_parallax',
      transitionToNext: 'cut',
      narrationAnchorText: 'Mara Ilyan was already hammering on the service hatch with an eighteen-inch pipe wrench...',
      captionText: 'Two night-shift mechanics are inside. If we don’t clear the upper bypass, the water seals them.',
      captionSafeChecked: true,
      assetSource: 'project_illustration',
      isApproved: true,
    },
    {
      id: 'shot_004',
      sceneNumber: 3,
      shotNumber: 1,
      durationSeconds: 14,
      aspectRatio: '16:9',
      purpose: 'The Still react to the 8-beat pump pulse in the drainage canal',
      framing: 'wide',
      pov: 'High vantage from South Gate catwalk down into Basin 3',
      characterReferenceIds: [],
      locationReferenceId: 'loc_south_gate',
      timeAndLighting: 'Heavy salt fog, dark churning canal water, rhythmic sodium strobe',
      actionDescription: 'Four distant infected figures in drainage canal turn toward diesel pump vibrations in unison.',
      visualPrompt: 'Atmospheric editorial illustration of four eerie silhouettes standing in waist-deep canal water under distant streetlight, turning in unison toward vibrating pump intake, non-graphic psychological suspense, dark teal and slate palette',
      negativePrompt: 'gory mutilation, blood spray, zombie sprint, comic book shock face',
      animationMethod: 'limited_2d_parallax',
      transitionToNext: 'dissolve',
      narrationAnchorText: 'Across the flooded service canal, four figures stood knee-deep in murky drainage. They did not sprint...',
      captionText: 'Their heads turned in unison—not toward Mara’s wrench, but toward the rhythmic shudder of the pump.',
      captionSafeChecked: true,
      assetSource: 'project_illustration',
      isApproved: true,
    },
  ];

  // Sample caption blocks for SRT/VTT preview
  const captionBlocks = sampleShots.map((s, idx) => ({
    index: idx + 1,
    startSeconds: idx * 10,
    endSeconds: (idx + 1) * 10 - 0.5,
    lines: [s.captionText],
  }));

  const srtPreview = generateSrtContent(captionBlocks);
  const vttPreview = generateVttContent(captionBlocks);

  const handleDownloadCaptions = (format: 'srt' | 'vtt') => {
    const text = format === 'srt' ? srtPreview : vttPreview;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${episodeId}_captions.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Visual & Audio Assembly Pipeline
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              Storyboard & Audio Stems ({episodeId})
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Scene breakdown with verified camera framing, honest 2D limited-animation labels, audio stem ducking, and dual-format caption safe zones (16:9 Long-form and 9:16 Shorts).
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-md">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                aspectRatio === '16:9'
                  ? 'bg-teal-500/20 text-teal-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              16:9 Long-form
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
                aspectRatio === '9:16'
                  ? 'bg-teal-500/20 text-teal-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              9:16 Shorts
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 text-xs">
        <button
          onClick={() => setActiveTab('storyboard')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'storyboard'
              ? 'bg-slate-800 text-teal-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Storyboard Beats ({sampleShots.length} Key Shots)
        </button>
        <button
          onClick={() => setActiveTab('audio_stems')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'audio_stems'
              ? 'bg-slate-800 text-teal-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Audio Stems & Ducking
        </button>
        <button
          onClick={() => {
            setActiveTab('captions');
          }}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'captions'
              ? 'bg-slate-800 text-teal-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Captions & Safe Margins (SRT/VTT)
        </button>
        <button
          onClick={() => {
            if (!renderScript) loadRenderScript();
            setActiveTab('render_script');
          }}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'render_script'
              ? 'bg-slate-800 text-teal-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Local FFmpeg Script</span>
        </button>
      </div>

      {/* TAB 1: STORYBOARD */}
      {activeTab === 'storyboard' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {sampleShots.map((shot) => (
              <div
                key={shot.id}
                className="p-5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      Scene {shot.sceneNumber} · Shot {shot.shotNumber}
                    </span>
                    <span className="text-slate-500 font-mono">{shot.durationSeconds}s</span>
                  </div>

                  <span className="text-[11px] font-mono text-teal-400 capitalize px-2 py-0.5 rounded bg-slate-800">
                    {shot.animationMethod.replace(/_/g, ' ')}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-slate-200">{shot.purpose}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Framing: {shot.framing.replace(/_/g, ' ')} · Lighting: {shot.timeAndLighting}
                  </div>
                </div>

                {/* Prompt Card */}
                <div className="p-3 rounded bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                  <div className="text-[11px] font-semibold text-slate-400">Prompt Specification:</div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {shot.visualPrompt}
                  </p>
                  <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                    <strong>Negative Constraints:</strong> {shot.negativePrompt}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="truncate">Narration: "{shot.narrationAnchorText.slice(0, 45)}..."</span>
                  <span className="text-emerald-400 font-mono shrink-0 ml-2">✓ Safe Margins Checked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AUDIO STEMS & DUCKING */}
      {activeTab === 'audio_stems' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6 max-w-3xl">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-teal-400" />
              <span>Multi-Stem Audio Mix & Broadcast Standards</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Separate narration, background music, and environmental sound effects. Automated music ducking under spoken voice with -14 LUFS YouTube standard target.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Narration Dialogue Volume</span>
                <span className="font-mono text-teal-300">{Math.round(audioConfig.narrationVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioConfig.narrationVolume}
                onChange={(e) => setAudioConfig({ ...audioConfig, narrationVolume: parseFloat(e.target.value) })}
                className="w-full accent-teal-400"
              />
            </div>

            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Background Atmospheric Score</span>
                <span className="font-mono text-teal-300">{Math.round(audioConfig.musicVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioConfig.musicVolume}
                onChange={(e) => setAudioConfig({ ...audioConfig, musicVolume: parseFloat(e.target.value) })}
                className="w-full accent-teal-400"
              />
            </div>

            <div className="p-4 rounded bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Environmental Foley & Water SFX</span>
                <span className="font-mono text-teal-300">{Math.round(audioConfig.sfxVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={audioConfig.sfxVolume}
                onChange={(e) => setAudioConfig({ ...audioConfig, sfxVolume: parseFloat(e.target.value) })}
                className="w-full accent-teal-400"
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded bg-slate-950 border border-slate-800">
              <input
                type="checkbox"
                id="ducking"
                checked={audioConfig.duckMusicUnderSpeech}
                onChange={(e) => setAudioConfig({ ...audioConfig, duckMusicUnderSpeech: e.target.checked })}
                className="accent-teal-400 rounded"
              />
              <label htmlFor="ducking" className="text-slate-300 cursor-pointer">
                Automatic Music Ducking (reduces score by -12dB whenever voice stem is active)
              </label>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-400">Integrated Target Loudness:</span>
              <span className="text-teal-400 font-bold">{audioConfig.loudnessTargetLufs} LUFS (YouTube Standard)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CAPTIONS & SAFE MARGINS */}
      {activeTab === 'captions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Caption Safe Zone Simulator */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-200">
              Safe Zone Margin Guide ({aspectRatio})
            </h3>
            <p className="text-[11px] text-slate-400">
              Ensures titles and subtitles do not get obscured by YouTube player scrubbers or Shorts UI controls.
            </p>

            <div
              className={`mx-auto bg-slate-950 border-2 border-dashed border-slate-700 rounded-lg p-4 relative flex flex-col justify-end items-center text-center transition-all ${
                aspectRatio === '16:9' ? 'w-full aspect-video' : 'w-56 aspect-[9/16]'
              }`}
            >
              <div className="absolute top-3 left-3 text-[10px] font-mono text-slate-500">
                {aspectRatio === '16:9' ? '1920 × 1080 (16:9 Master)' : '1080 × 1920 (9:16 Shorts)'}
              </div>

              {/* Subtitle simulation box */}
              <div className="bg-black/80 px-3 py-1.5 rounded text-xs text-white max-w-[85%] font-sans mb-3 shadow-lg">
                "The brass needle on the Basin Three gauge did not tremble. It twitched eight times..."
              </div>

              <div className="text-[10px] text-teal-400 font-mono mb-1">
                ✓ Within Title Safe Box (10% Margins)
              </div>
            </div>
          </div>

          {/* SubRip & WebVTT Exporters */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-200">Export Captions</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadCaptions('srt')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download .SRT</span>
                  </button>
                  <button
                    onClick={() => handleDownloadCaptions('vtt')}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download .VTT</span>
                  </button>
                </div>
              </div>

              <textarea
                readOnly
                rows={14}
                value={srtPreview}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded text-slate-300 font-mono text-[11px] leading-relaxed resize-none focus:outline-none"
              />
            </div>

            <div className="text-[11px] text-slate-500">
              Formatted according to platform guidelines: max 42 characters per line, max 2 lines per subtitle block.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LOCAL FFMPEG RENDER SCRIPT */}
      {activeTab === 'render_script' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-teal-400" />
                  <span>Local FFmpeg Composite Script ({episodeId})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  100% local rendering on Windows 10/11 (WSL2 / Git-Bash) or Linux. Composites 1080p 24fps master MP4 with stereo AAC audio with zero cloud compute costs.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (renderScript) {
                      const blob = new Blob([renderScript], { type: 'text/x-sh' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `render_${episodeId}.sh`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  disabled={!renderScript}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sh</span>
                </button>
                <button
                  onClick={() => {
                    if (renderCliCommand) {
                      navigator.clipboard.writeText(renderCliCommand);
                      setCopiedCli(true);
                      setTimeout(() => setCopiedCli(false), 2000);
                    }
                  }}
                  className="px-3 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  {copiedCli ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCli ? 'Copied Command' : 'Copy CLI Command'}</span>
                </button>
              </div>
            </div>

            {/* CLI Quick Runner snippet */}
            <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="text-[11px] text-slate-400 font-medium">Generate script directly in terminal via CLI:</div>
              <code className="block p-2 rounded bg-slate-900 border border-slate-800/80 font-mono text-[11px] text-teal-300 select-all overflow-x-auto whitespace-nowrap">
                npm run studio -- render script {episodeId} --save
              </code>
            </div>

            {/* Script Textarea Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-300">Generated Shell Script:</span>
                {renderScript && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(renderScript);
                      setCopiedScript(true);
                      setTimeout(() => setCopiedScript(false), 2000);
                    }}
                    className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-[11px]"
                  >
                    {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedScript ? 'Copied' : 'Copy Full Script'}</span>
                  </button>
                )}
              </div>
              {loadingScript ? (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">Generating render script...</div>
              ) : (
                <textarea
                  readOnly
                  rows={16}
                  value={renderScript || '# Click "Local FFmpeg Script" tab above to generate'}
                  className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-teal-200/90 leading-relaxed resize-none focus:outline-none"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
