import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  Download,
  Film,
  Sparkles,
  CheckCircle2,
  Sliders,
  Layers,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';

interface StudioVideoPlayerProps {
  episodeId: string;
  workingTitle: string;
  totalDurationSeconds?: number;
}

export const StudioVideoPlayer: React.FC<StudioVideoPlayerProps> = ({
  episodeId,
  workingTitle,
  totalDurationSeconds = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [showCaptions, setShowCaptions] = useState(true);
  const [currentChapter, setCurrentChapter] = useState('Cold Open: The Eight-Twitch Needle');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const pulseOscRef = useRef<OscillatorNode | null>(null);

  const chapters = [
    { start: 0, title: 'Cold Open: The Eight-Twitch Needle', snippet: 'The brass needle on Basin Three twitches eight times in eerie silence.' },
    { start: 60, title: 'Premise: The Silent Siren Network', snippet: 'Rhea Mistry notices official civil defense alarms remain green.' },
    { start: 150, title: 'Inciting Failure: The False Dial', snippet: 'SCADA panel shows gate open, but the heavy cast sluice is jammed.' },
    { start: 270, title: 'Human Encounter: Trapped Shift Crew', snippet: 'Mara Ilyan hammers on locked bulkhead with an eighteen-inch pipe wrench.' },
    { start: 390, title: 'First Evidence: Moving to the Pulse', snippet: 'The Still turn toward rhythmic pump vibration rather than yelling.' },
    { start: 510, title: 'Climax & Cliffhanger: The Second Pulse', snippet: 'Manual gate shifted; blueprint vault floods; second pulse answers from north.' },
  ];

  const currentCaption = chapters.reduce((prev, curr) => {
    return currentTime >= curr.start ? curr.snippet : prev;
  }, chapters[0].snippet);

  // Initialize Web Audio API on first user play
  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // Low ambient rumble
      const lowOsc = ctx.createOscillator();
      lowOsc.type = 'sine';
      lowOsc.frequency.setValueAtTime(55, ctx.currentTime);
      const lowGain = ctx.createGain();
      lowGain.gain.setValueAtTime(0.04, ctx.currentTime);
      lowOsc.connect(lowGain);
      lowGain.connect(masterGain);
      lowOsc.start();
    }
  };

  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(isMuted ? 0 : volume, audioContextRef.current.currentTime);
    }
  }, [volume, isMuted]);

  // Canvas 2D Animated Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let needleAngle = 0;
    let rainDrops: Array<{ x: number; y: number; speed: number; len: number }> = [];
    for (let i = 0; i < 70; i++) {
      rainDrops.push({
        x: Math.random() * 960,
        y: Math.random() * 540,
        speed: 8 + Math.random() * 12,
        len: 12 + Math.random() * 16,
      });
    }

    const render = () => {
      ctx.fillStyle = '#060b14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Atmospheric background gradient
      const grad = ctx.createRadialGradient(
        canvas.width * 0.45,
        canvas.height * 0.4,
        40,
        canvas.width * 0.5,
        canvas.height * 0.5,
        canvas.width * 0.7
      );
      grad.addColorStop(0, '#102d38');
      grad.addColorStop(0.5, '#0a1724');
      grad.addColorStop(1, '#03070d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Background architecture: Siphon Sluice Silhouettes
      ctx.fillStyle = '#07111c';
      ctx.beginPath();
      ctx.rect(60, 120, 160, 320);
      ctx.rect(260, 80, 200, 360);
      ctx.rect(500, 140, 180, 300);
      ctx.rect(720, 100, 180, 340);
      ctx.fill();

      // Sodium amber warm emergency floodlights
      const amberLight = ctx.createRadialGradient(780, 90, 10, 780, 90, 280);
      amberLight.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
      amberLight.addColorStop(0.5, 'rgba(217, 119, 6, 0.12)');
      amberLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = amberLight;
      ctx.beginPath();
      ctx.arc(780, 90, 280, 0, Math.PI * 2);
      ctx.fill();

      // Lower flooded water reflection
      const waterGrad = ctx.createLinearGradient(0, 420, 0, 540);
      waterGrad.addColorStop(0, 'rgba(13, 148, 136, 0.15)');
      waterGrad.addColorStop(1, '#020508');
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, 420, canvas.width, 120);

      // Moving water ripples
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.25)';
      ctx.lineWidth = 1.5;
      for (let r = 0; r < 5; r++) {
        const y = 440 + r * 18;
        const offset = Math.sin((Date.now() / 600) + r) * 25;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(300 + offset, y - 5, 600 - offset, y + 5, 960, y);
        ctx.stroke();
      }

      // Drawing Analog Brass Pressure Instrument
      ctx.save();
      ctx.translate(canvas.width * 0.28, canvas.height * 0.45);

      // Outer brass ring
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 78, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 75, 0, Math.PI * 2);
      ctx.fill();

      // Dial ticks
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      for (let a = 0; a < 12; a++) {
        const rad = (a * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * 62, Math.sin(rad) * 62);
        ctx.lineTo(Math.cos(rad) * 72, Math.sin(rad) * 72);
        ctx.stroke();
      }

      // Red hazard danger zone
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 68, -Math.PI * 0.2, Math.PI * 0.3);
      ctx.stroke();

      // Needle 8-beat mechanical oscillation
      const beatCycle = (Math.floor(currentTime * 2) % 10);
      if (beatCycle < 8) {
        needleAngle = -0.3 + (beatCycle * 0.12) + Math.sin(Date.now() / 80) * 0.04;
      } else {
        needleAngle = -0.3; // Silence pause
      }

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(needleAngle) * 56, Math.sin(needleAngle) * 56);
      ctx.stroke();

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = '10px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('BASIN 3 - KPa', 0, 36);

      ctx.restore();

      // Silhouette of Rhea Mistry at Catwalk Handrail
      ctx.fillStyle = '#03080f';
      ctx.beginPath();
      ctx.arc(680, 270, 24, 0, Math.PI * 2); // Head
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(650, 340);
      ctx.lineTo(670, 290);
      ctx.lineTo(700, 290);
      ctx.lineTo(720, 340);
      ctx.lineTo(715, 420);
      ctx.lineTo(655, 420);
      ctx.closePath();
      ctx.fill();

      // Handrail line
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(560, 360);
      ctx.lineTo(840, 360);
      ctx.stroke();

      // Rain Streaks
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      for (const drop of rainDrops) {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 3, drop.y + drop.len);
        ctx.stroke();

        drop.y += drop.speed;
        drop.x -= 1.5;
        if (drop.y > canvas.height) {
          drop.y = -drop.len;
          drop.x = Math.random() * canvas.width;
        }
      }

      // HUD Broadcast Overlay
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#14b8a6';
      ctx.textAlign = 'left';
      ctx.fillText(`REC [24fps] 1080p | EP: ${episodeId}`, 24, 32);

      const mins = Math.floor(currentTime / 60);
      const secs = Math.floor(currentTime % 60);
      const frames = Math.floor((currentTime % 1) * 24);
      const timecodeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
      ctx.textAlign = 'right';
      ctx.fillText(`TIMECODE: ${timecodeStr}`, canvas.width - 24, 32);

      // 16:9 safe margin guides
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(48, 27, canvas.width - 96, canvas.height - 54);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentTime]);

  // Video play timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying) {
      initAudio();
      timer = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDurationSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, totalDurationSeconds]);

  // Update active chapter based on time
  useEffect(() => {
    const active = chapters.reduce((prev, curr) => (currentTime >= curr.start ? curr : prev), chapters[0]);
    setCurrentChapter(active.title);
  }, [currentTime]);

  const handleDownload = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(`Downloaded ${filename}!`);
    setTimeout(() => setDownloadSuccess(null), 2500);
  };

  const handleDownloadMaster = () => {
    // Generate simulated high-efficiency binary master artifact
    const dummyVideoContent = `Ternfall Studio Master H.264 High@L4.1 Broadcast Container - ${episodeId}\nDuration: ${totalDurationSeconds}s\nFramerate: 24.000 fps\nResolution: 1920x1080 (16:9)\nAudio: 192kbps AAC Stereo 48kHz (-14.0 LUFS)\n`;
    handleDownload(`${episodeId}_master_1080p_24fps.mp4`, dummyVideoContent, 'video/mp4');
  };

  const handleDownloadCaptions = () => {
    const srt = `1\n00:00:00,000 --> 00:00:25,000\nThe brass needle on the Basin Three gauge did not tremble. It twitched eight times.\n\n2\n00:00:25,000 --> 00:01:30,000\nRhea was thirty-one, wore a cropped slate-teal rain jacket stiff with salt mist.\n\n3\n00:01:30,000 --> 00:03:00,000\nThe SCADA monitor flashed "Gate Open", but the heavy cast sluice was jammed shut.\n\n4\n00:03:00,000 --> 00:05:00,000\nMara Ilyan was hammering on the service hatch with an eighteen-inch pipe wrench.\n\n5\n00:05:00,000 --> 00:07:00,000\nThe Still turned in unison toward the rhythmic shudder of the diesel pump.\n`;
    handleDownload(`${episodeId}_captions.srt`, srt, 'text/plain');
  };

  const handleDownloadPackageJson = () => {
    const pkg = {
      episodeId,
      series: 'The Quiet Hours: Ternfall',
      masterFile: `${episodeId}_master_1080p_24fps.mp4`,
      resolution: '1920x1080',
      framerate: 24,
      audioLoudnessLufs: -14.0,
      privacyStatus: 'private',
      captionsLanguage: 'en',
      audience: 'not_made_for_kids',
      generatedAt: new Date().toISOString(),
    };
    handleDownload(`${episodeId}_youtube_package.json`, JSON.stringify(pkg, null, 2), 'application/json');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl space-y-4 p-5">
      {/* Player Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-teal-400">
              Studio Master 1080p Player
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              24.000 FPS
            </span>
          </div>
          <h2 className="text-base font-bold text-white mt-1">
            {episodeId} — {workingTitle}
          </h2>
          <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <span>Chapter:</span>
            <span className="text-slate-200 font-medium font-mono">{currentChapter}</span>
          </div>
        </div>

        {/* Quick Export Downloads */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadMaster}
            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Master MP4</span>
          </button>
          <button
            onClick={handleDownloadCaptions}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-teal-400" />
            <span>SRT Subtitles</span>
          </button>
          <button
            onClick={handleDownloadPackageJson}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Download YouTube Manifest JSON"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {/* Main 16:9 Video Canvas Screen */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-slate-800 shadow-inner group">
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-full h-full object-contain cursor-pointer"
          onClick={() => setIsPlaying(!isPlaying)}
        />

        {/* Synchronized Live Subtitles */}
        {showCaptions && (
          <div className="absolute bottom-14 left-1/2 -translate-x-1/2 max-w-[85%] text-center pointer-events-none transition-all">
            <span className="inline-block px-3.5 py-1.5 rounded bg-black/85 text-white font-sans text-xs md:text-sm tracking-wide leading-relaxed border border-white/10 shadow-lg">
              {currentCaption}
            </span>
          </div>
        )}

        {/* Big Central Play Button when paused */}
        {!isPlaying && (
          <div
            onClick={() => setIsPlaying(true)}
            className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-teal-500/90 text-slate-950 flex items-center justify-center pl-1 shadow-2xl hover:scale-110 transition-transform">
              <Play className="w-8 h-8 fill-current" />
            </div>
          </div>
        )}
      </div>

      {/* Timeline Chapter Scrub Bar */}
      <div className="space-y-1">
        <div className="relative w-full h-2 bg-slate-950 rounded-full overflow-hidden cursor-pointer">
          <div
            className="bg-teal-500 h-full rounded-full transition-all"
            style={{ width: `${(currentTime / totalDurationSeconds) * 100}%` }}
          />
        </div>

        {/* Chapter Tick Markers */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-1">
          {chapters.map((ch, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentTime(ch.start)}
              className={`hover:text-teal-300 transition-colors ${
                currentTime >= ch.start ? 'text-teal-400 font-semibold' : ''
              }`}
            >
              {Math.floor(ch.start / 60)}:00
            </button>
          ))}
          <span>{Math.floor(totalDurationSeconds / 60)}:00</span>
        </div>
      </div>

      {/* Broadcast Audio & Playback Controls Bar */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-20 accent-teal-500 cursor-pointer"
          />

          <span className="text-xs font-mono text-slate-400 ml-2">
            {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(totalDurationSeconds / 60)}:00
          </span>
        </div>

        {/* Right Controls: Subtitles Toggle, QC Stats */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCaptions(!showCaptions)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium flex items-center gap-1 transition-colors ${
              showCaptions
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                : 'bg-slate-800 text-slate-500'
            }`}
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>CC</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 border-l border-slate-800 pl-3">
            <span className="text-emerald-400 font-semibold">QC PASSED</span>
            <span>·</span>
            <span>-14.0 LUFS</span>
            <span>·</span>
            <span>Rec.709</span>
          </div>
        </div>
      </div>
    </div>
  );
};
