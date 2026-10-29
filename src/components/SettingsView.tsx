import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Download,
  ShieldCheck,
  Globe,
  DollarSign,
  HardDrive,
  CheckCircle2,
  Copy,
  Plus,
  Ban,
  Key,
  Check,
} from 'lucide-react';
import { SpendApprovalGrant, EpisodeCard } from '../types/index.ts';

interface SettingsViewProps {
  projectId: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ projectId }) => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savedNotice, setSavedNotice] = useState(false);

  // Spend Grants Management
  const [spendGrants, setSpendGrants] = useState<SpendApprovalGrant[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeCard[]>([]);
  const [newGrantAmount, setNewGrantAmount] = useState('25.00');
  const [newGrantEpisode, setNewGrantEpisode] = useState('all');
  const [newGrantHours, setNewGrantHours] = useState('24');
  const [isMinting, setIsMinting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [mintedGrant, setMintedGrant] = useState<SpendApprovalGrant | null>(null);

  const loadSpendGrants = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/spend-grants`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setSpendGrants(data.data);
      }
    } catch (err) {
      console.error('Failed to load spend grants:', err);
    }
  };

  const loadEpisodes = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) {
        setEpisodes(data.data);
      }
    } catch (err) {
      console.error('Failed to load episodes:', err);
    }
  };

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok) setSettings(res.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    loadSpendGrants();
    loadEpisodes();
  }, [projectId]);

  const handleMintGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsMinting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/spend-grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountUsd: parseFloat(newGrantAmount),
          episodeId: newGrantEpisode,
          validHours: parseInt(newGrantHours, 10),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMintedGrant(data.data);
        await loadSpendGrants();
      }
    } catch (err) {
      console.error('Failed to mint spend grant:', err);
    } finally {
      setIsMinting(false);
    }
  };

  const handleRevokeGrant = async (approvalId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/spend-grants/${approvalId}/revoke`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.ok) {
        await loadSpendGrants();
      }
    } catch (err) {
      console.error('Failed to revoke spend grant:', err);
    }
  };

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.ok) {
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportProject = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/episodes`);
      const data = await res.json();
      const exportBlob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(exportBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ternfall_project_export_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Configuration & Budget Controls
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              Studio Settings
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Manage production storage paths, atomic spend caps, explicit timezone, and third-party provider data disclosure consent.
            </p>
          </div>

          <button
            onClick={handleExportProject}
            className="px-3.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Project JSON</span>
          </button>
        </div>
      </div>

      {savedNotice && (
        <div className="p-3 rounded bg-slate-900 border border-teal-500/40 text-xs text-teal-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>Settings saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
        {/* Budget Caps Section */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-teal-400" />
            <span>Atomic Budget Caps (USD)</span>
          </h2>
          <p className="text-slate-400 text-[11px]">
            Master rule enforcement: jobs will automatically pause before any call that would breach these caps.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-400 font-medium block mb-1">Per-Run Hard Cap</label>
              <input
                type="number"
                value={settings.budgetCaps?.perRunCapUsd || 25}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    budgetCaps: { ...settings.budgetCaps, perRunCapUsd: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1">Per-Episode Hard Cap</label>
              <input
                type="number"
                value={settings.budgetCaps?.perEpisodeCapUsd || 85}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    budgetCaps: { ...settings.budgetCaps, perEpisodeCapUsd: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1">Monthly Project Cap</label>
              <input
                type="number"
                value={settings.budgetCaps?.monthlyCapUsd || 350}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    budgetCaps: { ...settings.budgetCaps, monthlyCapUsd: parseFloat(e.target.value) || 0 },
                  })
                }
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Timezone Section */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Globe className="w-4 h-4 text-teal-400" />
            <span>Production Timezone Anchor</span>
          </h2>
          <div className="max-w-md">
            <select
              value={settings.productionTimezone || 'UTC'}
              onChange={(e) => setSettings({ ...settings, productionTimezone: e.target.value })}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
              <option value="UTC">UTC (Universal Coordinated Time)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
            </select>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Required for scheduling video releases and tracking canon timestamps accurately.
            </span>
          </div>
        </div>

        {/* Data Notices Consent */}
        <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Third-Party Provider Data Consent</span>
          </h2>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Local-first storage keeps files on your disk, but calls to generative models (Gemini API text, Nano Banana stills, Omni Flash clips) send prompts and reference frames to Google Cloud API endpoints subject to their current data-use and retention policies.
          </p>

          <label className="flex items-center gap-2.5 p-3 rounded bg-slate-950 border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(settings.dataNoticeAccepted)}
              onChange={(e) => setSettings({ ...settings, dataNoticeAccepted: e.target.checked })}
              className="accent-teal-400 rounded"
            />
            <span className="text-slate-300">
              I understand that external model calls transmit prompts off-device, and I authorize API communication within configured spend caps.
            </span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-5 py-2 rounded-md bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      {/* Operator Spend Grants & Agent Authorizations */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-5 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Key className="w-4 h-4 text-teal-400" />
              <span>Operator Spend Grants & Agent Authorizations</span>
            </h2>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Strict Invariant (Rule 2): Automated agents and OpenCode cannot self-mint spend caps. Authorize an expiring grant here and pass the <code className="text-teal-300 font-mono">--approval-id</code> to your terminal agent.
            </p>
          </div>
          <span className="text-[11px] font-mono text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded border border-teal-500/20 self-start sm:self-auto">
            {spendGrants.filter((g) => !g.isRevoked && new Date(g.expiresAt).getTime() > Date.now()).length} Active Grants
          </span>
        </div>

        {/* Mint New Grant Form */}
        <form onSubmit={handleMintGrant} className="p-4 rounded-md bg-slate-950 border border-slate-800 space-y-3">
          <div className="font-semibold text-slate-200 text-xs">Issue New Scoped Spend Grant</div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-slate-400 font-medium block mb-1">Budget Cap (USD):</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  step={1}
                  required
                  value={newGrantAmount}
                  onChange={(e) => setNewGrantAmount(e.target.value)}
                  className="w-full pl-6 pr-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-100 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1">Episode Scope:</label>
              <select
                value={newGrantEpisode}
                onChange={(e) => setNewGrantEpisode(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs"
              >
                <option value="all">All Episodes</option>
                {episodes.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.id} - {ep.workingTitle.substring(0, 22)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-medium block mb-1">Validity Duration:</label>
              <select
                value={newGrantHours}
                onChange={(e) => setNewGrantHours(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200 text-xs"
              >
                <option value="6">6 Hours</option>
                <option value="12">12 Hours</option>
                <option value="24">24 Hours (Standard)</option>
                <option value="72">72 Hours</option>
                <option value="168">7 Days</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isMinting}
                className="w-full px-3 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isMinting ? 'Authorizing...' : 'Authorize Grant'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* Newly Minted Grant Callout */}
        {mintedGrant && (
          <div className="p-3.5 rounded-md bg-teal-500/10 border border-teal-500/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-teal-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-400" />
                <span>Grant Authorized: {mintedGrant.approvalId}</span>
              </span>
              <button
                onClick={() => setMintedGrant(null)}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            </div>
            <div className="text-slate-300 text-[11px]">
              Copy the CLI command below to launch production with your local agent in terminal:
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-teal-300 select-all overflow-x-auto whitespace-nowrap">
                npm run studio -- episode produce --episode {mintedGrant.episodeId === 'all' ? 'S01E001' : mintedGrant.episodeId} --approval-id {mintedGrant.approvalId} --json
              </code>
              <button
                onClick={() =>
                  copyToClipboard(
                    `npm run studio -- episode produce --episode ${mintedGrant.episodeId === 'all' ? 'S01E001' : mintedGrant.episodeId} --approval-id ${mintedGrant.approvalId} --json`,
                    'mintedCmd'
                  )
                }
                className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-1 shrink-0"
              >
                {copiedKey === 'mintedCmd' ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'mintedCmd' ? 'Copied' : 'Copy Command'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Grants Ledger Table */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-300">Active & Historical Spend Grants</div>
          {spendGrants.length === 0 ? (
            <div className="p-4 rounded bg-slate-950 border border-slate-800 text-center text-slate-500 text-xs">
              No spend grants recorded yet. Authorize a grant above to permit agent generation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-slate-800 rounded">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono text-[11px]">
                  <tr>
                    <th className="p-2.5">Approval ID</th>
                    <th className="p-2.5">Scope</th>
                    <th className="p-2.5">Cap (USD)</th>
                    <th className="p-2.5">Expires</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                  {spendGrants.map((grant) => {
                    const isExpired = new Date(grant.expiresAt).getTime() < Date.now();
                    const statusText = grant.isRevoked ? 'Revoked' : isExpired ? 'Expired' : 'Active';
                    const statusColor = grant.isRevoked
                      ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                      : isExpired
                      ? 'text-slate-400 bg-slate-800 border-slate-700'
                      : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';

                    return (
                      <tr key={grant.approvalId} className="hover:bg-slate-900/60">
                        <td className="p-2.5 font-mono text-teal-300 font-medium">
                          {grant.approvalId}
                        </td>
                        <td className="p-2.5 font-mono text-slate-300">
                          {grant.episodeId}
                        </td>
                        <td className="p-2.5 font-mono text-slate-200">
                          ${grant.maxBudgetUsd.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-slate-400 font-mono text-[11px]">
                          {new Date(grant.expiresAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-2.5">
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusColor}`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => copyToClipboard(grant.approvalId, `grant_${grant.approvalId}`)}
                              title="Copy Approval ID"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                            >
                              {copiedKey === `grant_${grant.approvalId}` ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                            {!grant.isRevoked && !isExpired && (
                              <button
                                onClick={() => handleRevokeGrant(grant.approvalId)}
                                title="Revoke Grant"
                                className="px-2 py-0.5 rounded bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 text-[10px] flex items-center gap-1"
                              >
                                <Ban className="w-3 h-3" />
                                <span>Revoke</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
