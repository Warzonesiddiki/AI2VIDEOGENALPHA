import React, { useState, useEffect } from 'react';
import { SystemDiagnostics } from '../types/index.ts';
import {
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  HardDrive,
  Cpu,
  Terminal,
  ShieldCheck,
  Film,
  Globe,
  ExternalLink,
  Zap,
  Copy,
  Check,
  Layers,
  Activity,
} from 'lucide-react';

export const DoctorView: React.FC = () => {
  const [diag, setDiag] = useState<SystemDiagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedPreset, setCopiedPreset] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPreset(id);
    setTimeout(() => setCopiedPreset(null), 2000);
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/doctor');
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `Diagnostics failed (${res.status})`);
      setDiag(data.data);
    } catch (err: any) {
      setError(err.message || 'Diagnostics failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Diagnostic Scanner & Environment Audit
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              Doctor Diagnostics
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Inspect selected runtime properties, storage permissions and installed executable versions. Provider connectivity and credential redaction are not verified.
            </p>
          </div>

          <button
            disabled={loading}
            onClick={fetchDiagnostics}
            className="px-3 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Re-run Doctor</span>
          </button>
        </div>
      </div>

      {error && diag && !loading && <div role="alert" className="p-3 text-sm text-rose-300">{error}. Displayed diagnostics are from the previous check.</div>}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Scanning environment capabilities...</div>
      ) : !diag ? (
        <div role="alert" className="p-6 text-sm text-rose-300">{error || 'Diagnostics are unavailable.'}</div>
      ) : (
        <div className="space-y-6 text-xs">
          {/* Environment Mode Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              diag.runtimeEnvironment === 'cloud_preview'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Cpu className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold text-sm">
                  {diag.runtimeEnvironment === 'cloud_preview'
                    ? 'Cloud preview container (local deployment not verified)'
                    : 'Local Runtime'}
                </div>
                <div className="text-[11px] opacity-80 mt-0.5">
                  Node {diag.nodeVersion} on {diag.osPlatform}
                </div>
              </div>
            </div>

            <div className="font-mono text-[11px] shrink-0">
              {diag.runtimeEnvironment === 'cloud_preview'
                ? 'Hosted runtime: local hardware is not attached'
                : 'GPU capabilities not verified'}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/30 text-amber-200">
            GPU encoder capability, thermal behavior and provider connectivity are not verified. Installed binaries are probed on the server; this is not a render benchmark.
          </div>

          {/* 3-Column Diagnostic Grids */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Storage Health */}
            <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
              <div className="font-semibold text-slate-200 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-teal-400" />
                <span>Storage & Production Root</span>
              </div>
              <div className="space-y-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-slate-950 border border-slate-800/80 truncate">
                  <span className="text-slate-500 block text-[10px]">Path:</span>
                  <span className="text-slate-300">{diag.storage.productionRoot}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Write Permissions:</span>
                  <span className={diag.storage.isWritable ? 'text-emerald-400' : 'text-rose-400'}>
                    {diag.storage.isWritable ? 'Writable (OK)' : 'Read-Only (Failed)'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Available Disk Space:</span>
                  <span className="text-slate-200">{diag.storage.freeSpaceMb === undefined ? 'Not measured' : `~${diag.storage.freeSpaceMb} MB`}</span>
                </div>
              </div>
            </div>

            {/* Media Rendering Worker */}
            <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
              <div className="font-semibold text-slate-200 flex items-center gap-2">
                <Film className="w-4 h-4 text-teal-400" />
                <span>FFmpeg & Rendering Engine</span>
              </div>
              <div className="space-y-2 text-[11px] font-mono">
                <div className="flex justify-between items-center text-slate-400">
                  <span>FFmpeg Binary:</span>
                  <span className={diag.ffmpeg.installed ? 'text-emerald-400' : 'text-slate-500'}>
                    {diag.ffmpeg.installed ? 'Detected' : 'Not detected'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>FFprobe Validator:</span>
                  <span className={diag.ffmpeg.ffprobeAvailable ? 'text-emerald-400' : 'text-slate-500'}>
                    {diag.ffmpeg.ffprobeAvailable ? 'Detected' : 'Not detected'}
                  </span>
                </div>
                <div className="p-2 rounded bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400">
                  Local rendering also requires compatible binaries and operator-supplied assets; detection does not establish readiness.
                </div>
              </div>
            </div>

            {/* OpenCode CLI & Timezone */}
            <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
              <div className="font-semibold text-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-teal-400" />
                <span>OpenCode & Timezone</span>
              </div>
              <div className="space-y-2 text-[11px] font-mono">
                <div className="flex justify-between items-center text-slate-400">
                  <span>OpenCode CLI:</span>
                  <span className="text-slate-500">{diag.opencode.installed ? `Detected (${diag.opencode.cliVersion})` : 'Not detected'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Timezone Anchor:</span>
                  <span className="text-teal-300">{diag.timezone.configuredIana}</span>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Valid IANA:</span>
                  <span className={diag.timezone.isValidIana ? 'text-emerald-400' : 'text-rose-400'}>
                    {diag.timezone.isValidIana ? 'Yes (Confirmed)' : 'No (Requires fix)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Capability Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Provider & Modality Capability Matrix</span>
            </h3>
            <p className="text-slate-400 text-[11px]">
              Configured model names and estimates are unverified. Paid provider calls remain disabled.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {diag.providers.map((p) => (
                <div
                  key={p.name}
                  className="p-3.5 rounded bg-slate-950 border border-slate-800/80 space-y-1.5 font-mono text-[11px]"
                >
                  <div className="font-semibold text-slate-200 font-sans">{p.name}</div>
                  <div className="text-teal-400 text-[10px] truncate">{p.modelId}</div>
                  <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-900">
                    <span>Status:</span>
                    <span
                      className={`capitalize ${
                        p.status === 'ready'
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{p.estimatedCostBasis}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-2">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Terminal className="w-4 h-4 text-teal-400" /> Typed operator CLI</h3>
            <p className="text-slate-400 text-[11px]">The old browser pseudo-CLI was retired because it did not execute the real commands. Use the documented typed CLI in an authorized local terminal; diagnostics may perform filesystem probes.</p>
            <code className="block text-teal-300 text-xs">npm run studio -- doctor --json</code>
          </div>

          {/* Remediation Guide */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">
              Environment Remediation Notes
            </h3>
            <div className="space-y-2">
              {diag.remediationSteps.map((step, i) => (
                <div
                  key={i}
                  className="p-3 rounded bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-slate-300"
                >
                  <span className="text-teal-400 font-bold font-mono">0{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
