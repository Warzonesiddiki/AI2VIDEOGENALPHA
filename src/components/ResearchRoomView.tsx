import React, { useState, useEffect, useRef } from 'react';
import { ResearchClaim } from '../types/index.ts';
import {
  Search,
  Plus,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  FileQuestion,
  Lock,
} from 'lucide-react';

interface ResearchRoomViewProps {
  projectId: string;
}

export const ResearchRoomView: React.FC<ResearchRoomViewProps> = ({ projectId }) => {
  const [claims, setClaims] = useState<ResearchClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const generation = useRef(0);
  const urlRequest = useRef(0);
  const [isCreating, setIsCreating] = useState(false);
  const [claimText, setClaimText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [evidenceExcerpt, setEvidenceExcerpt] = useState('');
  const [isFictional, setIsFictional] = useState(false);
  const [urlValidation, setUrlValidation] = useState<{
    tested: boolean;
    valid?: boolean;
    blockedSsrf?: boolean;
    warnings?: string[];
  }>({ tested: false });

  useEffect(() => {
    const controller = new AbortController();
    generation.current++; urlRequest.current++;
    setClaims([]); setLoading(true); setError(''); setSaving(false); setIsCreating(false);
    setClaimText(''); setSourceUrl(''); setSourceTitle(''); setEvidenceExcerpt(''); setIsFictional(false); setUrlValidation({ tested: false });
    void (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/research`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Could not load research notes');
        if (!controller.signal.aborted) setClaims(data.data);
      } catch (err: any) { if (!controller.signal.aborted) setError(err.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { generation.current++; urlRequest.current++; controller.abort(); };
  }, [projectId]);

  const handleTestUrl = async (url: string) => {
    const current = ++urlRequest.current;
    if (!url) {
      setUrlValidation({ tested: false });
      return;
    }
    try {
      const res = await fetch('/api/research/validate-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (current !== urlRequest.current) return;
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not validate URL syntax');
      if (data.ok) {
        setUrlValidation({
          tested: true,
          valid: data.data.isValid,
          blockedSsrf: data.data.isBlockedSsrf,
          warnings: data.data.warnings,
        });
      }
    } catch (err: any) {
      if (current === urlRequest.current) setError(err.message);
    }
  };

  const handleCreateClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimText.trim() || saving) return;
    const current = generation.current;
    setSaving(true); setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimText,
          isFictionalLore: isFictional,
          sourceUrl: isFictional ? undefined : sourceUrl,
          sourceTitle: isFictional ? undefined : sourceTitle,
          evidenceExcerpt: isFictional ? undefined : evidenceExcerpt,
          verificationStatus: isFictional ? 'fictional_rule' : 'unverified',
          confidenceScore: 0,
          humanApproved: false,
        }),
      });
      const data = await res.json();
      if (current !== generation.current) return;
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not save research note');
      if (data.ok) {
        setClaims(previous => [...previous.filter(claim => claim.id !== data.data.id), data.data]);
        setIsCreating(false);
        setClaimText('');
        setSourceUrl('');
        setSourceTitle('');
        setEvidenceExcerpt('');
        setUrlValidation({ tested: false });

      }
    } catch (err: any) {
      if (current === generation.current) setError(`${err.message} Your draft is retained.`);
    } finally { if (current === generation.current) setSaving(false); }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Truth in Scriptwriting & Source Verification
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              Research Room & Fact Ledger
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Strictly separate real-world engineering facts from invented story-world rules. No fabricated citations or real-world emergency advice. URL and text checks are advisory. Saving a note does not verify it or approve narration inclusion.
            </p>
          </div>

          <button
            disabled={loading}
            onClick={() => setIsCreating(true)}
            className="px-3.5 py-1.5 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Sourced Claim</span>
          </button>
        </div>
      </div>

      {/* Security Invariant Callout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-teal-400" />
            <span>SSRF & Loopback Shield</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Checks URL syntax and rejects known local/private literal targets. No source is fetched; DNS and redirects are not checked. This is not a network-fetch safety guarantee.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span>Prompt Injection Defense</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Flags known instruction patterns in bounded note fields. Pattern matching is advisory, not complete injection protection; notes never authorize tools or approvals.
          </p>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>Human Fact-Check Gate</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            All real-world notes remain unverified. Historical approval labels are not trusted; a durable independent review workflow is not implemented yet.
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
      {!loading && claims.length === 0 && <p className="text-sm text-slate-400">No research notes recorded.</p>}
      {/* Claims List */}
      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">Loading research notes...</div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded ${
                    claim.isFictionalLore
                      ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                      : claim.verificationStatus === 'verified'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {claim.isFictionalLore ? 'Fictional Lore' : `Source Note (${claim.verificationStatus})`}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Access Date: {claim.accessDate || 'not recorded'}
                </span>
              </div>

              <div className="text-slate-200 font-medium leading-relaxed">
                "{claim.claimText}"
              </div>

              {!claim.isFictionalLore && claim.sourceUrl && (
                <div className="p-3 rounded bg-slate-950 border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-medium text-slate-300">{claim.sourceTitle}</span>
                    <a
                      href={claim.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 flex items-center gap-1 font-mono text-[10px]"
                    >
                      <span>{claim.sourceUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {claim.evidenceExcerpt && (
                    <p className="text-slate-400 text-[11px] italic">
                      "{claim.evidenceExcerpt}"
                    </p>
                  )}
                  {claim.factCheckerNotes && (
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                      <strong>Fact Checker:</strong> {claim.factCheckerNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Add Claim */}
      {isCreating && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form
            onSubmit={handleCreateClaim}
            className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl text-xs"
          >
            <h3 className="text-base font-bold text-slate-100">
              Add Unreviewed Research Note
            </h3>
            {error && <p role="alert" className="text-rose-300">{error}</p>}
            <fieldset disabled={saving} className="space-y-4">

            <div className="space-y-3">
              <div className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800">
                <input
                  type="checkbox"
                  id="fictionalCheck"
                  checked={isFictional}
                  onChange={(e) => setIsFictional(e.target.checked)}
                  className="accent-teal-400 rounded"
                />
                <label htmlFor="fictionalCheck" className="text-slate-300 cursor-pointer">
                  This is an Invented Story-World Rule (not a real-world survival claim)
                </label>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Claim Text *
                </label>
                <textarea
                  required
                  rows={2}
                  maxLength={10000}
                  value={claimText}
                  onChange={(e) => setClaimText(e.target.value)}
                  placeholder="e.g. Backflow preventers stop reverse siphonage during sudden main shutoffs..."
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>

              {!isFictional && (
                <>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      Source Title / Publisher
                    </label>
                    <input
                      type="text"
                      maxLength={1000}
                      value={sourceTitle}
                      onChange={(e) => setSourceTitle(e.target.value)}
                      placeholder="e.g. Water Distribution Systems Handbook"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 font-medium">Source URL</label>
                      <button
                        type="button"
                        onClick={() => handleTestUrl(sourceUrl)}
                        className="text-teal-400 hover:text-teal-300 text-[11px]"
                      >
                        Check URL Syntax
                      </button>
                    </div>
                    <input
                      type="url"
                      maxLength={2048}
                      value={sourceUrl}
                      onChange={(e) => {
                        urlRequest.current++; setSourceUrl(e.target.value);
                        setUrlValidation({ tested: false });
                      }}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                    />

                    {urlValidation.tested && (
                      <div
                        className={`mt-1.5 p-2 rounded text-[11px] ${
                          urlValidation.valid
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                        }`}
                      >
                        {urlValidation.valid
                          ? '✓ URL syntax accepted. Source not fetched or verified.'
                          : `✕ Blocked: ${urlValidation.warnings?.join(', ')}`}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1">
                      Evidence Excerpt
                    </label>
                    <textarea
                      rows={2}
                      maxLength={30000}
                      value={evidenceExcerpt}
                      onChange={(e) => setEvidenceExcerpt(e.target.value)}
                      placeholder="Direct quote supporting this specific fact..."
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { urlRequest.current++; setIsCreating(false); }}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
              >
                Add Claim
              </button>
            </div>
            </fieldset>
          </form>
        </div>
      )}
    </div>
  );
};
