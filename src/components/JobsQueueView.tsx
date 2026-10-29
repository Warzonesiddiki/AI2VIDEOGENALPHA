import React, { useState } from 'react';
import { GenerationJob, JobState } from '../types/index.ts';
import {
  Film,
  RotateCcw,
  StopCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Terminal,
  ShieldAlert,
} from 'lucide-react';

interface JobsQueueViewProps {
  projectId: string;
  jobs: GenerationJob[];
  onRefreshJobs: () => void;
}

export const JobsQueueView: React.FC<JobsQueueViewProps> = ({
  projectId,
  jobs,
  onRefreshJobs,
}) => {
  const [selectedJob, setSelectedJob] = useState<GenerationJob | null>(null);
  const [reconcileJob, setReconcileJob] = useState<GenerationJob | null>(null);
  const [reconcileEvidence, setReconcileEvidence] = useState('');

  const handleTransition = async (jobId: string, targetState: JobState) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs/${jobId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetState }),
      });
      const data = await res.json();
      if (data.ok) {
        onRefreshJobs();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleReconcile = async (outcome: 'confirmed_succeeded' | 'confirmed_failed') => {
    if (!reconcileJob) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/jobs/${reconcileJob.id}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          evidenceNote: reconcileEvidence || 'Reconciled by operator inspection.',
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setReconcileJob(null);
        setReconcileEvidence('');
        onRefreshJobs();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Durable Job State & Audit Ledger
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              Production Queue & Job Inspector
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Durable, observable job lifecycle adhering to Master Project Rules & Matrix 15. Ambiguous timeouts require explicit reconciliation before any billable retry to prevent double-spending or duplicate uploads.
            </p>
          </div>

          <div className="text-xs font-mono text-slate-400">
            {jobs.length} Total Registered Jobs
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      {jobs.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-lg space-y-2">
          <Film className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-xs font-semibold text-slate-300">No Jobs in Production Queue</h3>
          <p className="text-[11px] text-slate-500">
            Rendering, audio synthesis, and autoproduce jobs will appear here with durable state tracking.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="p-3">Job ID & Type</th>
                <th className="p-3">State</th>
                <th className="p-3">Remote Side Effect</th>
                <th className="p-3">Cost Basis</th>
                <th className="p-3">Updated</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {jobs.map((job) => {
                const ext = job.externalOperation;
                const isUnknown = ext?.state === 'unknown_external_effect';

                return (
                  <tr key={job.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-mono">
                      <div className="font-semibold text-slate-100">{job.id}</div>
                      <div className="text-[11px] text-slate-500 font-sans">{job.type.replace(/_/g, ' ')}</div>
                    </td>

                    <td className="p-3 font-mono capitalize">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] ${
                          job.state === 'succeeded'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : job.state === 'running'
                            ? 'bg-teal-500/15 text-teal-300'
                            : job.state === 'blocked' || job.state === 'needs_user'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {job.state.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="p-3 font-mono text-[11px]">
                      {ext ? (
                        <div className="space-y-0.5">
                          <span
                            className={
                              ext.state === 'confirmed_succeeded'
                                ? 'text-emerald-400'
                                : ext.state === 'unknown_external_effect'
                                ? 'text-amber-400 font-bold'
                                : 'text-slate-400'
                            }
                          >
                            {ext.state}
                          </span>
                          {ext.duplicatePossible && (
                            <div className="text-[10px] text-amber-400 font-sans">
                              ⚠ Duplicate risk: reconcile first
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500">Local Only</span>
                      )}
                    </td>

                    <td className="p-3 font-mono tabular-nums text-slate-400">
                      ${job.actualCostUsd?.toFixed(4) || job.estimatedCostUsd?.toFixed(4) || '0.0000'}
                    </td>

                    <td className="p-3 font-mono text-[11px] text-slate-500">
                      {new Date(job.updatedAt).toLocaleTimeString()}
                    </td>

                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => setSelectedJob(job)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                      >
                        Logs
                      </button>

                      {isUnknown && (
                        <button
                          onClick={() => setReconcileJob(job)}
                          className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold"
                        >
                          Reconcile
                        </button>
                      )}

                      {job.state === 'running' && (
                        <button
                          onClick={() => handleTransition(job.id, 'cancelled')}
                          className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[11px]"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Logs Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-teal-400" />
                <span>Job Execution & Audit Log ({selectedJob.id})</span>
              </h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-300 space-y-1.5 max-h-72 overflow-y-auto">
              {selectedJob.logs.length === 0 ? (
                <div className="text-slate-600">No logged events recorded.</div>
              ) : (
                selectedJob.logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-600 shrink-0">{log.timestamp.slice(11, 19)}</span>
                    <span
                      className={`uppercase text-[10px] shrink-0 ${
                        log.level === 'error'
                          ? 'text-rose-400 font-bold'
                          : log.level === 'warn'
                          ? 'text-amber-400'
                          : 'text-teal-400'
                      }`}
                    >
                      [{log.level}]
                    </span>
                    <span className="text-slate-200">{log.message}</span>
                  </div>
                ))
              )}
            </div>

            <div className="text-[11px] text-slate-500">
              Secrets, OAuth tokens, and sensitive keys are automatically redacted from logs.
            </div>
          </div>
        </div>
      )}

      {/* Reconcile Modal */}
      {reconcileJob && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Reconcile Unknown External Operation</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Job <strong>{reconcileJob.id}</strong> experienced a connection interruption after dispatch. To prevent duplicate charges or duplicate media generation, record operator inspection evidence:
            </p>

            <div>
              <label className="text-slate-400 font-medium block mb-1">
                Operator Evidence & Verification Note:
              </label>
              <textarea
                rows={3}
                value={reconcileEvidence}
                onChange={(e) => setReconcileEvidence(e.target.value)}
                placeholder="e.g. Verified in provider console that generation succeeded / failed..."
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setReconcileJob(null)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReconcile('confirmed_failed')}
                className="px-3 py-1.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-medium"
              >
                Mark Confirmed Failed
              </button>
              <button
                onClick={() => handleReconcile('confirmed_succeeded')}
                className="px-3 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold"
              >
                Confirm Succeeded
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
