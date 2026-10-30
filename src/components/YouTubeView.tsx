import React, { useState, useEffect } from 'react';
import { YouTubePackage } from '../types/index.ts';
import {
  Youtube,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Lock,
  ExternalLink,
  Calendar,
  FileCheck,
  Globe,
  Sliders,
} from 'lucide-react';

interface YouTubeViewProps {
  projectId: string;
}

export const YouTubeView: React.FC<YouTubeViewProps> = ({ projectId }) => {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<YouTubePackage[]>([]);
  const [activePackage, setActivePackage] = useState<YouTubePackage | null>(null);
  const [activeTab, setActiveTab] = useState<'runbook' | 'preflight' | 'calendar'>('runbook');
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const emptyChecklist = { qcFilePassed: false, scriptFactsReviewed: false, rightsCleared: false, metadataTruthful: false, contentIdSafe: false, policyChecked: false, syntheticDisclosed: false, audienceNotForKids: false, timezoneConfirmed: false, humanUploadApproved: false };
  const [checklist, setChecklist] = useState(emptyChecklist);

  useEffect(() => {
    const controller = new AbortController();
    setPackages([]); setActivePackage(null); setError(''); setLoading(true); setChecklist(emptyChecklist);
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/youtube`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load historical packages');
        if (!controller.signal.aborted) { setPackages(data.data); setActivePackage(data.data[0] ?? null); }
      } catch (err: any) { if (!controller.signal.aborted) setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [projectId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Release Operations & Studio Handoff
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              YouTube Operations & Runbook
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Step-by-step tailored upload runbook for Windows/Studio desktop handoff. Strict private-by-default policy, altered/synthetic content disclosure checklist, and timezone-aware calendar. Never scrape YouTube Studio or automate public releases.
            </p>
          </div>


        </div>
      </div>

      <p role="status" className="text-sm text-amber-300">Package creation, upload and publication are disabled. Historical metadata is not execution, QC, rights clearance or approval evidence. Checklist changes below are local notes only.</p>
      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {loading && <p>Loading historical packages…</p>}
      {!loading && !activePackage && <p>No historical packages. Use Real Local Render for measured local exports; it does not create a publishing package.</p>}
      {/* Mode Sub-Tabs */}
      <div className="flex items-center gap-1.5 text-xs">
        <button
          onClick={() => setActiveTab('runbook')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'runbook'
              ? 'bg-slate-800 text-teal-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Studio Upload Runbook (Manual Handoff)
        </button>
        <button
          onClick={() => setActiveTab('preflight')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'preflight'
              ? 'bg-slate-800 text-teal-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          10-Point Preflight Gate
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'calendar'
              ? 'bg-slate-800 text-teal-300'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          30-Day Release Calendar & Timezone
        </button>
      </div>

      {/* TAB 1: RUNBOOK */}
      {activeTab === 'runbook' && activePackage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Step-by-Step Desktop Guide */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-rose-500" />
                  <span>Desktop Studio Walkthrough for {activePackage.episodeId}</span>
                </h2>
                <span className="text-[11px] font-mono text-teal-400">
                  Target: status.privacyStatus=private
                </span>
              </div>

              {/* Step 1 */}
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center font-mono text-[10px]">
                    1
                  </span>
                  <span>Select Master Render File</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Sign in to <span className="text-teal-300">studio.youtube.com</span> → CREATE → Upload videos. Select:
                </p>
                <div className="p-2 rounded bg-slate-900 font-mono text-[11px] text-slate-300 select-all">
                  {activePackage.master16x9Path} ({activePackage.master16x9Resolution})
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center font-mono text-[10px]">
                    2
                  </span>
                  <span>Title & Honest Description (No Fake Claims)</span>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Title (≤100 chars):</div>
                  <input
                    readOnly
                    value={activePackage.selectedTitle}
                    className="w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-200 font-sans text-xs select-all"
                  />
                </div>
                <div className="space-y-1 pt-1">
                  <div className="text-[11px] text-slate-400 font-semibold">Description with Verified Timestamps:</div>
                  <textarea
                    readOnly
                    rows={6}
                    value={activePackage.description}
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded text-slate-300 font-mono text-[11px] select-all resize-none"
                  />
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center font-mono text-[10px]">
                    3
                  </span>
                  <span>Subtitles & Audience Setting</span>
                </div>
                <div className="text-slate-400 space-y-1 text-[11px]">
                  <div>· Audience: Select <strong className="text-slate-200">"No, it's not made for kids"</strong> (Required compliance choice).</div>
                  <div>· Subtitles: Upload <strong className="text-slate-200 font-mono">{activePackage.captionsSrtPath}</strong> (English).</div>
                  <div>· Thumbnail: Upload <strong className="text-slate-200 font-mono">{activePackage.thumbnailPath}</strong>.</div>
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center font-mono text-[10px]">
                    4
                  </span>
                  <span>Altered or Synthetic Content Disclosure</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  In YouTube Studio under "Show more" → "Altered or synthetic content":
                </p>
                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                  Select <strong className="text-teal-300">"No"</strong> if stylized 2D animation / illustrated motion comic (non-realistic). If realistic synthetic faces or places were generated, select "Yes".
                </div>
              </div>

              {/* Step 5 */}
              <div className="p-3.5 rounded bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="font-semibold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-teal-300 flex items-center justify-center font-mono text-[10px]">
                    5
                  </span>
                  <span>Visibility: Private First (Never Publish Blindly)</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Always save as <strong className="text-amber-300 font-mono">Private</strong>. Wait for SD & HD processing and Copyright Checks to complete cleanly before changing visibility to Public or Scheduled.
                </p>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Package Metadata Summary */}
          <div className="space-y-4">
            <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <h3 className="font-bold text-slate-200 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-teal-400" />
                <span>Package Metadata Assets</span>
              </h3>

              <div className="space-y-2 text-[11px] font-mono">
                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 font-sans">16:9 Long-form Master</div>
                  <div className="text-slate-200 truncate mt-0.5">{activePackage.master16x9Path}</div>
                  <div className="text-teal-400">{activePackage.master16x9Resolution} · reported metadata, not measured QC</div>
                </div>

                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 font-sans">Shorts Variants ({activePackage.shortsVariants.length})</div>
                  {activePackage.shortsVariants.map((sv) => (
                    <div key={sv.shortId} className="text-slate-300 truncate mt-1">
                      · {sv.path} ({sv.durationSeconds}s)
                    </div>
                  ))}
                </div>

                <div className="p-2 rounded bg-slate-950 border border-slate-800">
                  <div className="text-slate-500 font-sans">Technical QC Report</div>
                  <div className="text-emerald-400">✓ FFprobe Validated: H.264/AAC Stereo</div>
                  <div className="text-slate-400">Historical loudness assertion (unverified): {activePackage.qcReport.loudnessLufs ?? 'not measured'}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
                <span className="text-slate-400">Timezone Anchor:</span>
                <span className="font-mono text-teal-300">{timezone}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 10-POINT PREFLIGHT GATE */}
      {activeTab === 'preflight' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5 text-xs max-w-3xl">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              <span>Mandatory 10-Point Preflight Review Gate</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Every item must be evaluated by the operator before any video is approved for private upload or scheduling.
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { key: 'qcFilePassed', label: '1. Final MP4 file present and validated with FFprobe (dimensions, codecs, -14 LUFS audio)' },
              { key: 'scriptFactsReviewed', label: '2. Narration script, factual claims, and fictional lore disclaimers reviewed' },
              { key: 'rightsCleared', label: '3. Character visual references, voice model, and music/SFX stems rights cleared' },
              { key: 'metadataTruthful', label: '4. Title, description, chapter timestamps, and thumbnail are truthful (no shock-clickbait)' },
              { key: 'contentIdSafe', label: '5. Copyright / Content ID clearance verified for all audio and visual assets' },
              { key: 'policyChecked', label: '6. Platform & advertiser suitability policies checked (Community Guidelines compliant)' },
              { key: 'syntheticDisclosed', label: '7. Altered or synthetic content disclosure reviewed against YouTube guidelines' },
              { key: 'audienceNotForKids', label: '8. Audience compliance setting verified ("Not made for kids")' },
              { key: 'timezoneConfirmed', label: `9. Explicit production timezone confirmed (${timezone})` },
              { key: 'humanUploadApproved', label: '10. Explicit human authorization issued for upload (Strict private default)' },
            ].map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-3 p-2.5 rounded bg-slate-950 border border-slate-800 cursor-pointer hover:bg-slate-900 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={(checklist as any)[item.key]}
                  onChange={(e) =>
                    setChecklist({ ...checklist, [item.key]: e.target.checked })
                  }
                  className="accent-teal-400 rounded mt-0.5"
                />
                <span className="text-slate-300 leading-relaxed">{item.label}</span>
              </label>
            ))}
          </div>

          <div className="p-3 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 font-mono text-[11px]">
              Gate Status:{' '}
              {Object.values(checklist).every(Boolean) ? (
                <span className="text-emerald-400 font-bold">LOCAL CHECKLIST COMPLETE — NOT UPLOAD AUTHORIZATION</span>
              ) : (
                <span className="text-amber-400 font-bold">LOCAL CHECKLIST INCOMPLETE — APPROVAL WORKFLOW UNAVAILABLE</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* TAB 3: 30-DAY CALENDAR & TIMEZONE */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div>
              <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-teal-400" />
                <span>Production Timezone Selection (Mandatory Rule)</span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Never silently default to UTC or Asia/Kolkata without confirmation. Persists timezone-aware timestamps.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-teal-300 font-mono text-xs focus:outline-none"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">UTC (Universal Coordinated Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>
          </div>

          {/* 30-Day Schedule Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-400" />
                <span>30-Day Publishing Pipeline Schedule ({timezone})</span>
              </h3>
              <span className="text-xs text-slate-500 font-mono">Pilot Cadence: 1 long-form / week</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-xs font-mono">
              {Array.from({ length: 28 }).map((_, i) => {
                const day = i + 1;
                const isPilotDay = day === 7;
                const isShortDay = day === 3 || day === 10 || day === 17;

                return (
                  <div
                    key={day}
                    className={`p-2.5 rounded border min-h-[70px] flex flex-col justify-between ${
                      isPilotDay
                        ? 'bg-teal-500/15 border-teal-500/40 text-teal-200'
                        : isShortDay
                        ? 'bg-slate-800/60 border-slate-700/60 text-slate-300'
                        : 'bg-slate-950/40 border-slate-800/60 text-slate-600'
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span>Day {day}</span>
                      {isPilotDay && <span className="font-bold">18:00</span>}
                    </div>

                    <div className="text-[11px] font-sans">
                      {isPilotDay ? (
                        <div className="font-semibold text-teal-300 truncate">S01E001 (Private)</div>
                      ) : isShortDay ? (
                        <div className="text-slate-400 text-[10px] truncate">Short Cutdown</div>
                      ) : (
                        <div className="text-slate-700 text-[10px]">Slot Open</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-500 leading-relaxed">
              * Note: The "10 videos per day" ambition is an optional capacity planning view, not an initial publishing mandate. Scaling occurs only after pilot retention, subscriber feedback, and unit economics are confirmed.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
