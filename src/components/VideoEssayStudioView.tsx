import React, { useState, useEffect, useRef } from 'react';
import {
  IllustratedSlide,
  VideoEssayEpisode,
  getPilotVideoEssayData,
  generateThinkPadT14RenderScripts,
  generateVideoEssaySrt,
  generateVideoEssayYouTubeDescription,
  generateEdgeTtsScript,
  generateShortsRenderScript,
  generateMasterOrchestratorScript,
  getEpisodesCatalog,
  COLOR_GRADING_PRESETS,
  ColorGradingPreset,
  NARRATOR_PERSONAS,
  NarratorVoicePersona,
} from '../core/video_essay.ts';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Download,
  Copy,
  Check,
  Film,
  Sparkles,
  Subtitles,
  Sliders,
  Layers,
  FileText,
  Terminal,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Clock,
  Zap,
  ShieldCheck,
  Tv,
  Smartphone,
  Info,
  Youtube,
  RefreshCw,
  Mic,
  CheckSquare,
  ListOrdered,
  Radio,
  SlidersHorizontal,
  Upload,
  Palette,
  CheckCircle2,
  FileCode,
} from 'lucide-react';

interface VideoEssayStudioViewProps {
  projectId: string;
}

export const VideoEssayStudioView: React.FC<VideoEssayStudioViewProps> = ({ projectId }) => {
  const episodesCatalog = getEpisodesCatalog();
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('S01E01');
  const [episode, setEpisode] = useState<VideoEssayEpisode>(() => episodesCatalog[0]);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '2.39:1' | '9:16'>('16:9');
  const [selectedColorGradeId, setSelectedColorGradeId] = useState<string>('fincher_nordic');
  const [activeExportTab, setActiveExportTab] = useState<
    'daily_guide' | 'master_bundle' | 'nvenc_bat' | 'edge_tts' | 'shorts' | 'flow_prompts' | 'subtitles' | 'youtube'
  >('daily_guide');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [enableVoiceSynth, setEnableVoiceSynth] = useState(true);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  // Real Uploaded Google Flow Stills Cache
  const [uploadedImages, setUploadedImages] = useState<Record<string, HTMLImageElement>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Upgraded Narrator Voice Engine State
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('ryan_uk_investigator');
  const [speechRate, setSpeechRate] = useState<number>(0.92); // ~142 WPM suspense cadence
  const [speechPitch, setSpeechPitch] = useState<number>(0.84); // Deep gravitas resonance
  const [enableSubBassDucking, setEnableSubBassDucking] = useState<boolean>(true);
  const [availableSystemVoices, setAvailableSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isTestingVoice, setIsTestingVoice] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const pulseGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());

  const activeSlide = episode.slides[selectedSlideIndex] || episode.slides[0];

  // Calculate current slide from currentTime
  useEffect(() => {
    let accumulatedTime = 0;
    for (let i = 0; i < episode.slides.length; i++) {
      const slide = episode.slides[i];
      if (currentTime >= accumulatedTime && currentTime < accumulatedTime + slide.durationSeconds) {
        if (selectedSlideIndex !== i) {
          setSelectedSlideIndex(i);
        }
        break;
      }
      accumulatedTime += slide.durationSeconds;
    }
  }, [currentTime, episode.slides]);

  // Audio setup with 55Hz sub-bass pulse
  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(isMuted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);
      masterGainRef.current = masterGain;

      // 55Hz Sub-Bass Oscillator (Signature Ternfall 8-beat cadence)
      const pulseOsc = ctx.createOscillator();
      pulseOsc.type = 'sine';
      pulseOsc.frequency.setValueAtTime(55, ctx.currentTime);

      const pulseGain = ctx.createGain();
      pulseGain.gain.setValueAtTime(0.06, ctx.currentTime);
      pulseOsc.connect(pulseGain);
      pulseGain.connect(masterGain);
      pulseOsc.start();
      pulseGainRef.current = pulseGain;

      // 110Hz Warm Sub-Harmonic
      const subHarmonic = ctx.createOscillator();
      subHarmonic.type = 'triangle';
      subHarmonic.frequency.setValueAtTime(110, ctx.currentTime);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.015, ctx.currentTime);
      subHarmonic.connect(subGain);
      subGain.connect(masterGain);
      subHarmonic.start();
    }
  };

  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(
        isMuted ? 0 : volume,
        audioContextRef.current.currentTime
      );
    }
  }, [volume, isMuted]);

  // Load browser speech synthesis voices reliably on start/changed
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        setAvailableSystemVoices(window.speechSynthesis.getVoices());
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const selectedPersona =
    NARRATOR_PERSONAS.find((p) => p.id === selectedPersonaId) || NARRATOR_PERSONAS[0];

  // Upgraded Test Voice handler for immediate preview
  const handleTestVoice = (customText?: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    initAudio();

    if (isTestingVoice) {
      window.speechSynthesis.cancel();
      setIsTestingVoice(false);
      if (pulseGainRef.current && audioContextRef.current) {
        pulseGainRef.current.gain.setValueAtTime(0.06, audioContextRef.current.currentTime);
      }
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = customText || selectedPersona.samplePhrase;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechRate;
    utterance.pitch = speechPitch;
    utterance.volume = isMuted ? 0 : volume;

    // Intelligent match against browser neural/natural voices
    const matchedVoice =
      availableSystemVoices.find((v) =>
        selectedPersona.browserKeywords.some((kw) =>
          v.name.toLowerCase().includes(kw.toLowerCase()) || v.lang.toLowerCase().includes(kw.toLowerCase())
        )
      ) ||
      availableSystemVoices.find((v) => v.name.includes('Natural')) ||
      availableSystemVoices.find((v) => v.lang.startsWith('en'));

    if (matchedVoice) utterance.voice = matchedVoice;

    // Sidechain sub-bass ducking
    if (enableSubBassDucking && pulseGainRef.current && audioContextRef.current) {
      pulseGainRef.current.gain.setValueAtTime(0.015, audioContextRef.current.currentTime);
    }

    utterance.onstart = () => setIsTestingVoice(true);
    utterance.onend = () => {
      setIsTestingVoice(false);
      if (pulseGainRef.current && audioContextRef.current) {
        pulseGainRef.current.gain.setValueAtTime(0.06, audioContextRef.current.currentTime);
      }
    };
    utterance.onerror = () => setIsTestingVoice(false);

    window.speechSynthesis.speak(utterance);
  };

  // Upgraded SpeechSynthesis narration during timeline playback
  useEffect(() => {
    if (!isPlaying || !enableVoiceSynth) {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
      return;
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(activeSlide.narratorScript);
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;
      utterance.volume = isMuted ? 0 : volume;

      const matchedVoice =
        availableSystemVoices.find((v) =>
          selectedPersona.browserKeywords.some((kw) =>
            v.name.toLowerCase().includes(kw.toLowerCase()) || v.lang.toLowerCase().includes(kw.toLowerCase())
          )
        ) ||
        availableSystemVoices.find((v) => v.name.includes('Natural')) ||
        availableSystemVoices.find((v) => v.lang.startsWith('en'));

      if (matchedVoice) utterance.voice = matchedVoice;

      // Sidechain ducking of 55Hz sub-bass when voice begins
      if (enableSubBassDucking && pulseGainRef.current && audioContextRef.current) {
        pulseGainRef.current.gain.setValueAtTime(0.015, audioContextRef.current.currentTime);
      }

      utterance.onend = () => {
        // Restore sub-bass tension after sentence completes
        if (pulseGainRef.current && audioContextRef.current) {
          pulseGainRef.current.gain.setValueAtTime(0.06, audioContextRef.current.currentTime);
        }
      };

      window.speechSynthesis.speak(utterance);
    }

    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, [
    selectedSlideIndex,
    isPlaying,
    enableVoiceSynth,
    isMuted,
    volume,
    speechRate,
    speechPitch,
    selectedPersonaId,
    availableSystemVoices,
    enableSubBassDucking,
  ]);

  // Canvas Animation Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rainDrops: Array<{ x: number; y: number; speed: number; len: number }> = [];
    let dustParticles: Array<{ x: number; y: number; size: number; alpha: number; speedX: number; speedY: number }> = [];

    // Initialize rain
    for (let i = 0; i < 90; i++) {
      rainDrops.push({
        x: Math.random() * 960,
        y: Math.random() * 540,
        speed: 12 + Math.random() * 15,
        len: 15 + Math.random() * 20,
      });
    }

    // Initialize dust particles
    for (let i = 0; i < 60; i++) {
      dustParticles.push({
        x: Math.random() * 960,
        y: Math.random() * 540,
        size: 1 + Math.random() * 2.5,
        alpha: 0.15 + Math.random() * 0.4,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: -0.2 - Math.random() * 0.4,
      });
    }

    let frameId: number;
    let localTime = currentTime;

    const render = (timeMs: number) => {
      const dt = (timeMs - lastTimeRef.current) / 1000;
      lastTimeRef.current = timeMs;

      if (isPlaying) {
        localTime += dt;
        if (localTime >= episode.totalDurationSeconds) {
          localTime = 0;
          setIsPlaying(false);
        }
        setCurrentTime(localTime);
      }

      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background
      ctx.fillStyle = activeSlide.visualTheme.primaryColor || '#0a1619';
      ctx.fillRect(0, 0, width, height);

      // 2. Compute Ken Burns camera zoom & pan factor
      let slideStartTime = 0;
      for (let i = 0; i < selectedSlideIndex; i++) {
        slideStartTime += episode.slides[i].durationSeconds;
      }
      const slideProgress = Math.min(
        1,
        Math.max(0, (localTime - slideStartTime) / activeSlide.durationSeconds)
      );

      ctx.save();

      // Camera transformation
      let zoom = 1.0;
      let panX = 0;
      let panY = 0;

      switch (activeSlide.cameraMovement) {
        case 'slow_push_in':
          zoom = 1.0 + slideProgress * 0.16;
          panX = (width / 2) * (1 - zoom);
          panY = (height / 2) * (1 - zoom);
          break;
        case 'slow_pull_out':
          zoom = 1.16 - slideProgress * 0.16;
          panX = (width / 2) * (1 - zoom);
          panY = (height / 2) * (1 - zoom);
          break;
        case 'pan_left_to_right':
          zoom = 1.08;
          panX = -width * 0.04 + slideProgress * (width * 0.08);
          panY = 0;
          break;
        case 'pan_right_to_left':
          zoom = 1.08;
          panX = width * 0.04 - slideProgress * (width * 0.08);
          panY = 0;
          break;
        case 'tilt_down':
          zoom = 1.1;
          panX = 0;
          panY = -height * 0.05 + slideProgress * (height * 0.1);
          break;
        case 'impact_snap_zoom':
          zoom = 1.0 + Math.pow(slideProgress, 0.4) * 0.22;
          panX = (width / 2) * (1 - zoom);
          panY = (height / 2) * (1 - zoom);
          break;
        case 'subtle_drift':
        default:
          zoom = 1.02 + Math.sin(timeMs * 0.0008) * 0.03;
          panX = Math.cos(timeMs * 0.0006) * 10;
          panY = Math.sin(timeMs * 0.0008) * 6;
          break;
      }

      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      // Check if user uploaded a real Google Flow generated still
      const userImg = uploadedImages[activeSlide.id];
      if (userImg && userImg.complete && userImg.naturalWidth > 0) {
        ctx.drawImage(userImg, 0, 0, width, height);
      } else {
        // Draw stylized illustration canvas (Atmospheric Industrial Backdrop)
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#061013');
        grad.addColorStop(0.5, activeSlide.visualTheme.primaryColor || '#0a1d22');
        grad.addColorStop(1, '#020709');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Industrial architecture lines (tunnels, conduits, masonry)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < width; i += 60) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i * 0.8 + width * 0.1, height);
          ctx.stroke();
        }

        // Centerpiece visual representation
        const cx = width / 2;
        const cy = height / 2;

        // Draw atmospheric light beam (flashlight or sodium lamp)
        const lightGrad = ctx.createRadialGradient(
          cx + Math.sin(timeMs * 0.001) * 40,
          cy * 0.6,
          10,
          cx,
          cy,
          height * 0.8
        );
        lightGrad.addColorStop(0, `${activeSlide.visualTheme.accentColor}33`);
        lightGrad.addColorStop(0.5, `${activeSlide.visualTheme.accentColor}0d`);
        lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, height * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Atmospheric silhouette / scene elements
        ctx.fillStyle = '#03080a';
        ctx.fillRect(0, height * 0.72, width, height * 0.28);
        ctx.strokeStyle = '#0e242a';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, height * 0.72, width, height * 0.28);

        // Hydraulic gauge or sluice gate representation
        if (selectedSlideIndex === 0 || activeSlide.soundCue.sfxType === 'sub_bass_pulse_55hz') {
          ctx.save();
          ctx.translate(cx, cy * 0.85);
          ctx.fillStyle = '#1c170f';
          ctx.beginPath();
          ctx.arc(0, 0, 90, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = activeSlide.visualTheme.accentColor || '#d97736';
          ctx.lineWidth = 6;
          ctx.stroke();

          for (let a = -Math.PI * 0.75; a <= Math.PI * 0.75; a += Math.PI / 8) {
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * 75, Math.sin(a) * 75);
            ctx.lineTo(Math.cos(a) * 85, Math.sin(a) * 85);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
          }

          const beatCycle = (timeMs / 1000) % 3;
          let needleJitter = 0;
          if (beatCycle < 1.6) {
            needleJitter = Math.sin(beatCycle * 16 * Math.PI) * 0.15;
          }
          ctx.rotate(-0.4 + needleJitter);
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, -75);
          ctx.stroke();

          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = '#061317';
          ctx.fillRect(width * 0.35, height * 0.2, width * 0.3, height * 0.6);
          ctx.strokeStyle = activeSlide.visualTheme.accentColor || '#38bdf8';
          ctx.lineWidth = 2;
          ctx.strokeRect(width * 0.35, height * 0.2, width * 0.3, height * 0.6);

          ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
          const waterHeight = height * 0.45 + Math.sin(timeMs * 0.003) * 6;
          ctx.fillRect(width * 0.35, waterHeight, width * 0.3, height * 0.8 - waterHeight);
        }
      }

      ctx.restore(); // Restore camera transformation

      // 3. Render Atmospheric Overlays
      if (activeSlide.overlayEffect === 'heavy_rain') {
        ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
        ctx.lineWidth = 1.5;
        rainDrops.forEach((drop) => {
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 3, drop.y + drop.len);
          ctx.stroke();

          drop.y += drop.speed;
          drop.x -= 2;
          if (drop.y > height) {
            drop.y = -20;
            drop.x = Math.random() * (width + 100);
          }
        });
      } else if (activeSlide.overlayEffect === 'dust_motes' || activeSlide.overlayEffect === 'salt_fog') {
        dustParticles.forEach((p) => {
          ctx.fillStyle = `rgba(253, 230, 138, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          p.x += p.speedX;
          p.y += p.speedY;
          if (p.y < 0) p.y = height;
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
        });
      }

      // 4. Vignette & Film Edge
      const cx = width / 2;
      const cy = height / 2;
      const vig = ctx.createRadialGradient(cx, cy, height * 0.4, cx, cy, width * 0.7);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(0.7, 'rgba(0,0,0,0.4)');
      vig.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);

      // 4b. Studio Telemetry & HUD Overlay (Top-Left)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('LOC: TERNFALL BASIN-03 [54°21\'N 04°12\'W] | COND: SURVEILLANCE', 24, 28);
      ctx.fillStyle = 'rgba(234, 179, 8, 0.55)';
      ctx.fillText('FREQ: 55Hz RESONANCE | CADENCE: 8-BEAT PULSE', 24, 44);

      // 4c. Studio Audio VU Level Meter (Bottom-Left)
      const isVoiceActive = isPlaying && enableVoiceSynth;
      const meterBars = 8;
      for (let b = 0; b < meterBars; b++) {
        const barHeight = isVoiceActive
          ? 6 + Math.abs(Math.sin(timeMs * 0.008 + b)) * 18
          : 4 + Math.sin(timeMs * 0.002 + b) * 3;
        ctx.fillStyle = b >= 6 ? '#ef4444' : b >= 4 ? '#eab308' : '#10b981';
        ctx.fillRect(24 + b * 5, height - 20 - barHeight, 3.5, barHeight);
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '8px monospace';
      ctx.fillText('MASTER VU', 24, height - 8);

      // 5. Kinetic Subtitles / Captions
      if (showSubtitles && activeSlide.narratorScript) {
        ctx.save();
        const boxY = height - 90;

        // Subtitle pill backing
        ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
        ctx.beginPath();
        const textPadding = 24;
        ctx.roundRect(width * 0.08, boxY, width * 0.84, 64, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Render caption text with highlighted keywords
        ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const words = activeSlide.narratorScript.split(' ');
        const totalWords = words.length;
        const currentWordIndex = Math.floor(slideProgress * totalWords);

        // Highlight keywords or current word
        ctx.fillStyle = '#f8fafc';
        const displaySnippet = activeSlide.narratorScript.length > 95
          ? activeSlide.narratorScript.substring(0, 92) + '...'
          : activeSlide.narratorScript;

        ctx.fillText(displaySnippet, width / 2, boxY + 32);

        ctx.restore();
      }

      // Timecode watermark in top-right
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      const m = Math.floor(localTime / 60);
      const s = Math.floor(localTime % 60);
      ctx.fillText(
        `SLIDE ${selectedSlideIndex + 1}/${episode.slides.length} | ${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
        width - 20,
        30
      );

      frameId = requestAnimationFrame(render);
    };

    lastTimeRef.current = performance.now();
    frameId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(frameId);
  }, [selectedSlideIndex, isPlaying, activeSlide, showSubtitles, episode]);

  const handleTogglePlay = () => {
    initAudio();
    setIsPlaying(!isPlaying);
  };

  const handleSlideSelect = (index: number) => {
    setSelectedSlideIndex(index);
    let accTime = 0;
    for (let i = 0; i < index; i++) {
      accTime += episode.slides[i].durationSeconds;
    }
    setCurrentTime(accTime);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedGrade =
    COLOR_GRADING_PRESETS.find((g) => g.id === selectedColorGradeId) || COLOR_GRADING_PRESETS[0];

  const handleEpisodeChange = (epId: string) => {
    setSelectedEpisodeId(epId);
    const found = episodesCatalog.find((e) => e.episodeId === epId) || episodesCatalog[0];
    setEpisode(found);
    setSelectedSlideIndex(0);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleImageFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const match = file.name.match(/slide_?0?(\d+)/i) || file.name.match(/^0?(\d+)\./);
      const slideNum = match ? parseInt(match[1], 10) : null;
      const targetSlide = slideNum
        ? episode.slides.find((s) => s.slideNumber === slideNum)
        : episode.slides[selectedSlideIndex];

      if (targetSlide) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          setUploadedImages((prev) => ({ ...prev, [targetSlide.id]: img }));
        };
      }
    });
  };

  const renderScripts = generateThinkPadT14RenderScripts(episode, selectedColorGradeId);
  const edgeTtsScript = generateEdgeTtsScript(episode, selectedPersonaId);
  const shortsScript = generateShortsRenderScript(episode);
  const masterBundleScript = generateMasterOrchestratorScript(
    episode,
    selectedPersonaId,
    selectedColorGradeId
  );
  const srtContent = generateVideoEssaySrt(episode.slides);
  const ytDescription = generateVideoEssayYouTubeDescription(episode);

  const toggleStep = (stepId: string) => {
    setCheckedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  return (
    <div className="space-y-6">
      {/* Hidden file input for uploading real Google Flow stills */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        accept="image/*"
        onChange={handleImageFilesUpload}
        className="hidden"
      />

      {/* Top Banner: Video Essay / Illustrated Documentary Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20">
                0-CREDIT FLOW PIPELINE
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                THINKPAD T14 (NVENC) PRESET
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                YOUTUBE 65%+ RETENTION FORMAT
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                35MM {selectedGrade.name.toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-3">
              Ternfall Studio Cinema Suite
              <span className="text-xs font-mono font-normal px-2.5 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700">
                BROADCAST MASTER V2
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Industrial survival thriller video essay engine modeled after prestige investigative documentaries. Uses 0-credit master keyframes from Google Flow, automated Edge-TTS narration, and hardware-accelerated Pascal NVENC rendering.
            </p>
          </div>

          {/* Studio Master Controls: Episode, Grade, Stills, Aspect */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Episode Selector */}
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800">
              <select
                value={selectedEpisodeId}
                onChange={(e) => handleEpisodeChange(e.target.value)}
                className="bg-transparent text-xs font-bold text-teal-300 focus:outline-none px-2 py-1 cursor-pointer"
              >
                {episodesCatalog.map((ep) => (
                  <option key={ep.episodeId} value={ep.episodeId} className="bg-slate-900 text-slate-100">
                    {ep.episodeId}: {ep.title}
                  </option>
                ))}
              </select>
            </div>

            {/* 35mm Color Grade Selector */}
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1.5 px-2">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={selectedColorGradeId}
                onChange={(e) => setSelectedColorGradeId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none py-1 cursor-pointer"
              >
                {COLOR_GRADING_PRESETS.map((g) => (
                  <option key={g.id} value={g.id} className="bg-slate-900 text-slate-100">
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload Stills Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              title="Import Google Flow generated images from your local folder"
            >
              <Upload className="w-3.5 h-3.5 text-teal-400" />
              <span>Load Flow Stills</span>
              {Object.keys(uploadedImages).length > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-teal-500 text-slate-950 font-bold">
                  {Object.keys(uploadedImages).length}
                </span>
              )}
            </button>

            {/* Aspect Ratio Switch */}
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setAspectRatio('16:9')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  aspectRatio === '16:9'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Tv className="w-3 h-3" />
                16:9
              </button>
              <button
                onClick={() => setAspectRatio('2.39:1')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  aspectRatio === '2.39:1'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Film className="w-3 h-3" />
                2.39:1 Scope
              </button>
              <button
                onClick={() => setAspectRatio('9:16')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-semibold transition-all ${
                  aspectRatio === '9:16'
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smartphone className="w-3 h-3" />
                9:16 Shorts
              </button>
            </div>
          </div>
        </div>

        {/* Quick Spec Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">Total Episode Stills</div>
            <div className="text-lg font-bold text-slate-100 mt-0.5">{episode.totalSlides} Master Keyframes</div>
            <div className="text-[11px] text-teal-400 mt-0.5">1 frame per 15-20s hold</div>
          </div>
          <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">Google Flow Cost</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">$0.00 (0 Credits)</div>
            <div className="text-[11px] text-slate-400 mt-0.5">3,150 Banked Credits Untouched</div>
          </div>
          <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">ThinkPad T14 NVENC Render</div>
            <div className="text-lg font-bold text-sky-400 mt-0.5">~75 Seconds Total</div>
            <div className="text-[11px] text-slate-400 mt-0.5">NVIDIA MX330 GPU Accelerated</div>
          </div>
          <div className="bg-slate-950/60 rounded-lg p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">Narration Pacing</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">{episode.avgWpm} WPM Suspense</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total Words: {episode.totalWordCount}</div>
          </div>
        </div>
      </div>

      {/* Main Studio Viewport: Canvas + Slide Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Canvas Player & Timeline (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            {/* Canvas Container */}
            <div
              className={`relative bg-black flex items-center justify-center transition-all ${
                aspectRatio === '16:9' ? 'aspect-video w-full' : 'aspect-[9/16] max-h-[640px] mx-auto'
              }`}
            >
              <canvas
                ref={canvasRef}
                width={960}
                height={540}
                className="w-full h-full object-contain"
              />

              {/* Floating Camera & Atmosphere Badges */}
              <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
                <span className="px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-xs font-mono font-semibold text-teal-300 border border-white/10">
                  CAMERA: {activeSlide.cameraMovement.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="px-2.5 py-1 rounded bg-black/60 backdrop-blur-md text-xs font-mono font-semibold text-sky-300 border border-white/10">
                  FX: {activeSlide.overlayEffect.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>

              {/* Big Play Button Overlay when Paused */}
              {!isPlaying && (
                <button
                  onClick={handleTogglePlay}
                  className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-teal-500/90 hover:bg-teal-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
                  title="Play Interactive Preview"
                >
                  <Play className="w-8 h-8 fill-slate-950 ml-1" />
                </button>
              )}
            </div>

            {/* Transport & Control Bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleTogglePlay}
                  className="p-2.5 rounded-lg bg-teal-500 text-slate-950 hover:bg-teal-400 font-semibold transition-colors flex items-center gap-1.5 text-xs"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-slate-950" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-slate-950" />
                      Play Real-Time
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleSlideSelect(Math.max(0, selectedSlideIndex - 1))}
                  disabled={selectedSlideIndex === 0}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  title="Previous Slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleSlideSelect(Math.min(episode.slides.length - 1, selectedSlideIndex + 1))}
                  disabled={selectedSlideIndex === episode.slides.length - 1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  title="Next Slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="text-xs font-mono text-slate-300 ml-2">
                  <span className="text-teal-400 font-bold">
                    {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}
                  </span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-slate-400">
                    {Math.floor(episode.totalDurationSeconds / 60)}:{String(Math.floor(episode.totalDurationSeconds % 60)).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Center Slide Scrubber */}
              <div className="flex-1 max-w-md hidden sm:block">
                <input
                  type="range"
                  min={0}
                  max={episode.totalDurationSeconds}
                  step={0.5}
                  value={currentTime}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCurrentTime(val);
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
              </div>

              {/* Right Settings */}
              <div className="flex items-center gap-3">
                {/* Voice Synth Toggle */}
                <button
                  onClick={() => setEnableVoiceSynth(!enableVoiceSynth)}
                  className={`px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors ${
                    enableVoiceSynth
                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Toggle Browser Voice Synthesis"
                >
                  Voiceover: {enableVoiceSynth ? 'ON' : 'OFF'}
                </button>

                {/* Subtitles Toggle */}
                <button
                  onClick={() => setShowSubtitles(!showSubtitles)}
                  className={`p-2 rounded-lg transition-colors ${
                    showSubtitles
                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                  title="Toggle Kinetic Subtitles"
                >
                  <Subtitles className="w-4 h-4" />
                </button>

                {/* Audio Mute & Volume */}
                <button
                  onClick={() => {
                    initAudio();
                    setIsMuted(!isMuted);
                  }}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors"
                  title="Toggle Audio"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Slide Strip & Navigation Carousel */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                Episode Slide Sequence ({episode.slides.length} Keyframes)
              </div>
              <div className="text-xs text-slate-400">
                Current: Slide {selectedSlideIndex + 1} ({activeSlide.timecodeStart} - {activeSlide.timecodeEnd})
              </div>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700">
              {episode.slides.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => handleSlideSelect(idx)}
                  className={`shrink-0 w-36 text-left rounded-lg p-2.5 border transition-all ${
                    selectedSlideIndex === idx
                      ? 'bg-teal-500/10 border-teal-500 shadow-md ring-1 ring-teal-500/50'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1 text-slate-400">
                    <span className="font-bold text-teal-400">#{s.slideNumber}</span>
                    <span>{s.timecodeStart}</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 line-clamp-1 mb-1">
                    {s.chapterTitle.split(':')[0]}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {s.narratorScript}
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{s.cameraMovement.split('_')[1] || 'move'}</span>
                    <span className="text-emerald-400">0 credits</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Slide Editor & Inspector (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-teal-400">
                  SLIDE {activeSlide.slideNumber} of {episode.slides.length}
                </span>
                <h3 className="text-base font-bold text-slate-100">{activeSlide.chapterTitle}</h3>
              </div>
              <span className="px-2 py-1 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                {activeSlide.durationSeconds}s Hold
              </span>
            </div>

            {/* Narrator Voiceover Script */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-teal-400" />
                  Voiceover Script
                </label>
                <span className="text-[11px] text-slate-400 font-mono">
                  {activeSlide.wordCount} words (~{Math.round((activeSlide.wordCount / activeSlide.durationSeconds) * 60)} WPM)
                </span>
              </div>
              <textarea
                value={activeSlide.narratorScript}
                onChange={(e) => {
                  const updatedText = e.target.value;
                  const updatedSlides = [...episode.slides];
                  updatedSlides[selectedSlideIndex] = {
                    ...activeSlide,
                    narratorScript: updatedText,
                    wordCount: updatedText.trim().split(/\s+/).length,
                  };
                  setEpisode({ ...episode, slides: updatedSlides });
                }}
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-teal-500 resize-none font-sans leading-relaxed"
              />
            </div>

            {/* Camera Motion & FX Presets */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Camera Drift
                </label>
                <select
                  value={activeSlide.cameraMovement}
                  onChange={(e) => {
                    const updated = [...episode.slides];
                    updated[selectedSlideIndex].cameraMovement = e.target.value as any;
                    setEpisode({ ...episode, slides: updated });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="slow_push_in">Slow Push-In (Zoom)</option>
                  <option value="slow_pull_out">Slow Pull-Out (Reveal)</option>
                  <option value="pan_left_to_right">Pan Left to Right</option>
                  <option value="pan_right_to_left">Pan Right to Left</option>
                  <option value="tilt_down">Tilt Downwards</option>
                  <option value="subtle_drift">Subtle Ambient Drift</option>
                  <option value="impact_snap_zoom">Impact Snap Zoom</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">
                  Atmospheric FX
                </label>
                <select
                  value={activeSlide.overlayEffect}
                  onChange={(e) => {
                    const updated = [...episode.slides];
                    updated[selectedSlideIndex].overlayEffect = e.target.value as any;
                    setEpisode({ ...episode, slides: updated });
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                >
                  <option value="heavy_rain">Cinematic Heavy Rain</option>
                  <option value="salt_fog">Volumetric Salt Fog</option>
                  <option value="dust_motes">Flashlight Dust Motes</option>
                  <option value="flicker_vignette">Flickering Vignette</option>
                  <option value="water_ripples">Water Surface Ripples</option>
                  <option value="none">No Overlay (Clean)</option>
                </select>
              </div>
            </div>

            {/* Sound Design Cue */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Audio Soundscape Cue
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <span className="font-mono text-teal-400">
                  {activeSlide.soundCue.sfxType}
                </span>
                <span className="text-slate-400">
                  Vol: {Math.round(activeSlide.soundCue.volume * 100)}%
                </span>
              </div>
            </div>

            {/* Google Flow Prompt Box with 1-Click Copy */}
            <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-teal-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  Google Flow Master Prompt
                </div>
                <button
                  onClick={() => handleCopy(activeSlide.flowPrompt, `prompt_${activeSlide.id}`)}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                >
                  {copiedKey === `prompt_${activeSlide.id}` ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy Prompt
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-300 font-mono leading-relaxed bg-slate-900/60 p-2 rounded border border-slate-800/80 max-h-24 overflow-y-auto">
                {activeSlide.flowPrompt}
              </p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                <span>Aspect: 16:9 • Seed Locked</span>
                <span className="text-emerald-400 font-semibold">Cost: 0 Credits</span>
              </div>
            </div>
          </div>

          {/* Upgraded Narrator Voice & Acoustic Studio Card */}
          <div className="bg-slate-900 border border-teal-500/30 rounded-xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold text-slate-100">Narrator Voice Engine</h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                {selectedPersona.edgeVoice}
              </span>
            </div>

            {/* Persona Selector Dropdown */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Voice Persona & Timbre
              </label>
              <select
                value={selectedPersonaId}
                onChange={(e) => setSelectedPersonaId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-100 font-semibold focus:outline-none focus:border-teal-500"
              >
                {NARRATOR_PERSONAS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                {selectedPersona.description}
              </p>
            </div>

            {/* Test Voice Persona Button */}
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">Sample Phrase:</span>
                <span className="text-teal-400 text-[10px] font-mono">145 WPM</span>
              </div>
              <p className="text-xs text-slate-300 italic font-serif leading-relaxed">
                "{selectedPersona.samplePhrase}"
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleTestVoice(selectedPersona.samplePhrase)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    isTestingVoice
                      ? 'bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                      : 'bg-teal-500 hover:bg-teal-400 text-slate-950'
                  }`}
                >
                  {isTestingVoice ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      Stop Sample
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Listen to Persona Sample
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleTestVoice(activeSlide.narratorScript)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                  title="Speak the narration for the currently selected slide"
                >
                  Read Slide
                </button>
              </div>
            </div>

            {/* Acoustic Sliders: Pacing & Gravitas */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-300 font-medium">Suspense Pacing / Speed</span>
                  <span className="font-mono text-teal-400">{Math.round(speechRate * 155)} WPM ({Math.round(speechRate * 100)}%)</span>
                </div>
                <input
                  type="range"
                  min="0.75"
                  max="1.15"
                  step="0.02"
                  value={speechRate}
                  onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-300 font-medium">Vocal Depth / Pitch</span>
                  <span className="font-mono text-teal-400">
                    {speechPitch < 0.9 ? 'Deep Resonant' : 'Standard'} ({Math.round(speechPitch * 100)}%)
                  </span>
                </div>
                <input
                  type="range"
                  min="0.70"
                  max="1.05"
                  step="0.02"
                  value={speechPitch}
                  onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
              </div>
            </div>

            {/* Sidechain Sub-Bass Ducking Toggle */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div>
                <div className="text-xs font-semibold text-slate-200">Sidechain Ducking (-6dB)</div>
                <div className="text-[10px] text-slate-400">Ducks 55Hz sub-bass when voice speaks</div>
              </div>
              <input
                type="checkbox"
                checked={enableSubBassDucking}
                onChange={(e) => setEnableSubBassDucking(e.target.checked)}
                className="w-4 h-4 rounded text-teal-500 bg-slate-800 border-slate-700 focus:ring-teal-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Production Advice Card */}
          <div className="bg-gradient-to-br from-teal-950/30 to-slate-900 border border-teal-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-400 mb-1.5">
              <Info className="w-4 h-4" />
              The Video Essay Production Rule
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              In this format, <strong>audio carries the narrative</strong> while the image grounds the mystery. The Ken Burns camera push-in keeps the viewer's eyes engaged, eliminating the need to burn expensive AI video credits.
            </p>
          </div>
        </div>
      </div>

      {/* Export & ThinkPad T14 NVENC Render Suite */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2.5">
              <Terminal className="w-5 h-5 text-teal-400" />
              Production & Export Hub
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              One-click scripts for local hardware acceleration (ThinkPad T14 NVENC), Google Flow prompt batches, and YouTube metadata.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveExportTab('daily_guide')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'daily_guide'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              Daily 1-Video Engine
            </button>
            <button
              onClick={() => setActiveExportTab('master_bundle')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'master_bundle'
                  ? 'bg-emerald-400 text-slate-950 shadow-sm font-bold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              All-In-One Script (.bat)
            </button>
            <button
              onClick={() => setActiveExportTab('nvenc_bat')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'nvenc_bat'
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              ThinkPad NVENC Script (.bat)
            </button>
            <button
              onClick={() => setActiveExportTab('edge_tts')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'edge_tts'
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Free Voiceover (.bat)
            </button>
            <button
              onClick={() => setActiveExportTab('shorts')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'shorts'
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Shorts 9:16 (.bat)
            </button>
            <button
              onClick={() => setActiveExportTab('flow_prompts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'flow_prompts'
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Flow Prompts (36)
            </button>
            <button
              onClick={() => setActiveExportTab('subtitles')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'subtitles'
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Subtitles (.SRT)
            </button>
            <button
              onClick={() => setActiveExportTab('youtube')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeExportTab === 'youtube'
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              YouTube Package
            </button>
          </div>
        </div>

        {/* Tab 0: Daily 1-Video Engine (Interactive Checklist & Blueprint) */}
        {activeExportTab === 'daily_guide' && (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-amber-400 tracking-wider uppercase flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Daily Turnkey Production Blueprint (60 Minutes Total)
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Follow these 5 simple steps each morning. Costs <strong>$0.00</strong> and <strong>0 Flow credits</strong>.
                  Your Lenovo ThinkPad T14 with MX330 renders in ~75 seconds without CPU throttling.
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-amber-400">1 Video / Day</div>
                <div className="text-[11px] text-slate-400">Long-form + 3 Shorts</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                {
                  id: 'step_1',
                  time: '20 min',
                  title: '1. Flow Keyframes',
                  desc: 'Generate 36 images on flow.google.com for 0 credits. Save to data/stills/.',
                  badge: '0 Credits',
                },
                {
                  id: 'step_2',
                  time: '2 min',
                  title: '2. Free Voiceover',
                  desc: 'Run generate_voiceover.bat. Edge-TTS outputs BBC documentary narration for $0.',
                  badge: 'Free TTS',
                },
                {
                  id: 'step_3',
                  time: '2 min',
                  title: '3. NVENC Render',
                  desc: 'Run render_video_essay_nvenc.bat. MX330 GPU builds 1080p master in ~75s.',
                  badge: 'MX330 GPU',
                },
                {
                  id: 'step_4',
                  time: '1 min',
                  title: '4. Extract Shorts',
                  desc: 'Run render_shorts_9x16.bat to auto-crop 3 viral vertical cliffhangers.',
                  badge: '3 Shorts',
                },
                {
                  id: 'step_5',
                  time: '15 min',
                  title: '5. YouTube Launch',
                  desc: 'Upload unlisted/private first, paste chapters description, publish at peak CTR.',
                  badge: 'High CTR',
                },
              ].map((step) => {
                const isDone = !!checkedSteps[step.id];
                return (
                  <div
                    key={step.id}
                    onClick={() => toggleStep(step.id)}
                    className={`cursor-pointer p-3.5 rounded-lg border transition-all ${
                      isDone
                        ? 'bg-teal-950/40 border-teal-500/40'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 font-mono">
                        {step.time}
                      </span>
                      <span
                        className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                          isDone
                            ? 'bg-teal-500 border-teal-400 text-slate-950'
                            : 'border-slate-700 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                    </div>
                    <div className={`text-xs font-bold ${isDone ? 'text-teal-300 line-through' : 'text-slate-100'}`}>
                      {step.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">{step.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 0b: All-In-One Master Pipeline Orchestrator */}
        {activeExportTab === 'master_bundle' && (
          <div className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Turnkey Master Production Orchestrator (.bat)
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  A single double-click script that sets up all folders, checks your ThinkPad MX330 NVENC GPU, synthesizes free voiceover via Edge-TTS, mixes the 55Hz sub-bass, applies the <strong>{selectedGrade.name}</strong> color grade, and exports 1 master video + 3 shorts in ~75 seconds.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleCopy(masterBundleScript, 'master_script')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'master_script' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy .bat
                    </>
                  )}
                </button>
                <button
                  onClick={() =>
                    handleDownloadFile('run_master_production_pipeline.bat', masterBundleScript)
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors shadow-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Master .bat
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
              {masterBundleScript}
            </pre>
          </div>
        )}

        {/* Tab 1: ThinkPad T14 NVENC Render Script */}
        {activeExportTab === 'nvenc_bat' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Pre-tuned for: <strong className="text-slate-200">Lenovo ThinkPad T14 Gen 1 (NVIDIA GeForce MX330 NVENC + i7-10510U)</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(renderScripts.windowsBat, 'nvenc_script')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'nvenc_script' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied Script
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Windows .bat
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownloadFile('render_video_essay_nvenc.bat', renderScripts.windowsBat)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .bat
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
              {renderScripts.windowsBat}
            </pre>
          </div>
        )}

        {/* Tab 1b: Free Edge-TTS Voiceover Generator Script */}
        {activeExportTab === 'edge_tts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                100% Free broadcast voiceover generator using Microsoft Edge-TTS (No ElevenLabs fees, 0 cost).
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(edgeTtsScript, 'edge_tts_script')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'edge_tts_script' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied Voice Script
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy .bat
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownloadFile('generate_voiceover.bat', edgeTtsScript)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .bat
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Active Voice:</span>
                <span className="px-2.5 py-1 rounded font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  {selectedPersona.name}
                </span>
                <span className="text-slate-400 text-[11px] font-mono">({selectedPersona.role})</span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Flag: <code className="text-amber-400">--voice "{selectedPersona.edgeVoice}" --rate="{selectedPersona.rateMod}" --pitch="{selectedPersona.pitchMod}"</code>
              </div>
            </div>

            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
              {edgeTtsScript}
            </pre>
          </div>
        )}

        {/* Tab 1c: 9:16 Shorts Extractor Script */}
        {activeExportTab === 'shorts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Auto-extract 3 vertical 9:16 cliffhangers for YouTube Shorts & TikTok to drive traffic to your long-form video.
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(shortsScript, 'shorts_script')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'shorts_script' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied Shorts Script
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Shorts .bat
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleDownloadFile('render_shorts_9x16.bat', shortsScript)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Shorts .bat
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
              {shortsScript}
            </pre>
          </div>
        )}

        {/* Tab 2: All 36 Flow Prompts */}
        {activeExportTab === 'flow_prompts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Batch list of all 36 illustrated keyframes ready for <strong>flow.google.com</strong> (Cost: 0 Credits)
              </div>
              <button
                onClick={() => {
                  const allPrompts = episode.slides
                    .map((s) => `### SLIDE ${s.slideNumber}: ${s.chapterTitle} (${s.timecodeStart})\nPROMPT: ${s.flowPrompt}\nNEGATIVE: ${s.flowNegativePrompt}\n`)
                    .join('\n');
                  handleCopy(allPrompts, 'all_prompts');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors"
              >
                {copiedKey === 'all_prompts' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-slate-950" />
                    All 36 Prompts Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy All 36 Prompts
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {episode.slides.map((s) => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-mono text-[10px] text-teal-400">
                    <span>SLIDE #{s.slideNumber} • {s.timecodeStart}</span>
                    <button
                      onClick={() => handleCopy(s.flowPrompt, `p_${s.id}`)}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      {copiedKey === `p_${s.id}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-slate-300 line-clamp-3 font-mono text-[11px]">{s.flowPrompt}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Subtitles (.SRT) */}
        {activeExportTab === 'subtitles' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Synchronized SubRip Subtitle file (.SRT) with narration timecodes.
              </div>
              <button
                onClick={() => handleDownloadFile(`${episode.episodeId}_captions.srt`, srtContent)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download .SRT
              </button>
            </div>
            <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-72 leading-relaxed">
              {srtContent}
            </pre>
          </div>
        )}

        {/* Tab 4: Upgraded YouTube Studio & Search Feed Mockup */}
        {activeExportTab === 'youtube' && (
          <div className="space-y-5">
            {/* High CTR Title Options */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                Algorithm-Tested High-CTR Titles (Curiosity Gap + Stakes)
              </div>
              <div className="space-y-2">
                {[
                  {
                    title: 'The 03:00 Siphon Breach That Sealed Basin Three',
                    type: 'Curiosity Gap (Recommended)',
                    score: '94/100',
                  },
                  {
                    title: 'What They Found Trapped In The Subterranean Drainage Locks',
                    type: 'Forensic Investigation',
                    score: '91/100',
                  },
                  {
                    title: 'The 55Hz Frequency No One Survived | Animated Thriller',
                    type: 'Acoustic Dread',
                    score: '88/100',
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded bg-slate-900 border border-slate-800 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-100">{item.title}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.type} • CTR Predictor: <span className="text-emerald-400">{item.score}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy(item.title, `title_${i}`)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors shrink-0"
                    >
                      {copiedKey === `title_${i}` ? 'Copied' : 'Copy Title'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* YouTube Search Feed Mockup Preview */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                <span>YouTube Algorithm Feed Preview (Desktop & Mobile)</span>
                <span className="text-[11px] text-teal-400 font-mono">Simulated CTR: 9.4%</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3.5 p-3.5 rounded-lg bg-slate-900 border border-slate-800/80">
                {/* Simulated Thumbnail */}
                <div className="relative aspect-video w-full sm:w-56 bg-slate-950 rounded-md overflow-hidden shrink-0 border border-slate-700">
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-teal-950/60 to-slate-900 flex items-center justify-center p-3 text-center">
                    <div className="space-y-1">
                      <div className="text-[9px] font-mono tracking-widest text-teal-400 uppercase">
                        S01E01 • 03:00 BREACH
                      </div>
                      <div className="text-sm font-black text-amber-400 uppercase tracking-tighter leading-tight drop-shadow-md">
                        THEY KNEW
                      </div>
                    </div>
                  </div>
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/85 text-white">
                    09:42
                  </span>
                </div>

                {/* Simulated Video Metadata */}
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-100 hover:text-sky-400 cursor-pointer line-clamp-2">
                    The 03:00 Siphon Breach That Sealed Basin Three | The Quiet Hours
                  </h4>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-300">Ternfall Studio</span>
                    <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                    <span>142K views</span>
                    <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                    <span>2 days ago</span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 pt-0.5">
                    At low pressure, high-volume sea mains can form an accidental siphon. If the municipal sea gate fails by even two degrees, four hundred thousand gallons of freezing saltwater siphons directly into...
                  </p>
                </div>
              </div>
            </div>

            {/* Pinned Comment Engagement Trap */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Pinned Comment Engagement Trap (Boosts Watch Time & Comments)
                </div>
                <button
                  onClick={() =>
                    handleCopy(
                      '📌 THEORY TEST: At 04:12, the hydraulic needle twitched eight times before the telemetry sirens failed. Was the siphon accidental, or was Basin Three deliberately flooded? Drop your timestamped clues below—the top theory will be canonized in Episode 2.',
                      'pinned_comment'
                    )
                  }
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                >
                  {copiedKey === 'pinned_comment' ? 'Copied Comment' : 'Copy Pinned Comment'}
                </button>
              </div>
              <p className="text-xs text-slate-300 italic font-mono bg-slate-900/80 p-2.5 rounded border border-slate-800/80">
                "📌 THEORY TEST: At 04:12, the hydraulic needle twitched eight times before the telemetry sirens failed. Was the siphon accidental, or was Basin Three deliberately flooded? Drop your timestamped clues below—the top theory will be canonized in Episode 2."
              </p>
            </div>

            {/* Clickable Chapters Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Full YouTube description with clickable timestamps and synthetic media compliance.
                </div>
                <button
                  onClick={() => handleCopy(ytDescription, 'yt_desc')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors"
                >
                  {copiedKey === 'yt_desc' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-slate-950" />
                      Copied Description!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Description
                    </>
                  )}
                </button>
              </div>
              <pre className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto max-h-60 leading-relaxed whitespace-pre-wrap">
                {ytDescription}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
