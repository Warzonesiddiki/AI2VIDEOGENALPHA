import React, { useState, useEffect, useRef } from 'react';
import { ArcRoadmapItem } from '../types/index.ts';
import { MapPin, Search, Layers, Plus, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface RoadmapViewProps {
  projectId: string;
  onExpandArcSuccess: () => void;
}

export const RoadmapView: React.FC<RoadmapViewProps> = ({ projectId, onExpandArcSuccess }) => {
  const expansionRequest = useRef<{ scope: string; key: string } | null>(null);
  const expandingRef = useRef(false);
  const [arcs, setArcs] = useState<ArcRoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanding, setIsExpanding] = useState(false);
  const [expandArcNumber, setExpandArcNumber] = useState<number | null>(null);
  const [expandCount, setExpandCount] = useState<number>(10);
  const [expandNotice, setExpandNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/roadmap/arcs')
      .then((res) => res.json())
      .then((res) => {
        if (res.ok) setArcs(res.data);
      })
      .catch((err) => console.error('Failed to load roadmap arcs:', err))
      .finally(() => setLoading(false));
  }, []);

  const filteredArcs = arcs.filter((arc) => {
    if (selectedSeason !== 'all' && arc.seasonNumber !== selectedSeason) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        arc.arcTitle.toLowerCase().includes(q) ||
        arc.centralConflict.toLowerCase().includes(q) ||
        arc.coreSetting.toLowerCase().includes(q) ||
        arc.episodeRange.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleExpandArc = async () => {
    if (!expandArcNumber || expandingRef.current) return;
    expandingRef.current = true;
    const scope = `${projectId}:${expandArcNumber}:${expandCount}`;
    if (expansionRequest.current?.scope !== scope) expansionRequest.current = { scope, key: crypto.randomUUID() };
    setIsExpanding(true);
    setExpandNotice(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/arcs/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arcNumber: expandArcNumber,
          count: expandCount,
          idempotencyKey: expansionRequest.current.key,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setExpandNotice(
          `Successfully expanded Arc ${expandArcNumber} into ${data.data.createdCards.length} draft episode cards (not continuity-approved)!`
        );
        expansionRequest.current = null;
        onExpandArcSuccess();
      } else {
        setExpandNotice(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setExpandNotice(`Failed to expand arc: ${err.message}`);
    } finally {
      expandingRef.current = false;
      setIsExpanding(false);
    }
  };

  if (projectId !== 'proj_ternfall_01') return <div className="max-w-3xl space-y-3"><h1 className="text-2xl font-bold">No roadmap for this project</h1><p className="text-sm text-slate-300">The built-in roadmap belongs only to the original Ternfall project. It cannot be expanded into another project. Create episode cards in the Episode Board instead.</p></div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              1,000-Episode Narrative Architecture
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              100-Arc Backbone & Season Map
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              10 Seasons · 100 Ten-Episode Arcs = 1,000 planned episode slots. Expand arcs into unreviewed draft cards (max 20 cards per batch). Never mass-generate unreviewed scripts.
            </p>
          </div>

          <div className="text-xs font-mono text-slate-400 shrink-0">
            Showing <span className="text-slate-100 font-bold">{filteredArcs.length}</span> of {arcs.length} Arcs
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-lg">
        {/* Season Filter Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedSeason('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              selectedSeason === 'all'
                ? 'bg-teal-500/20 text-teal-300 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All 10 Seasons
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeason(s)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                selectedSeason === s
                  ? 'bg-teal-500/20 text-teal-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              S{s}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search arcs or conflicts..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-teal-500"
          />
        </div>
      </div>

      {/* Expand Success / Notice Banner */}
      {expandNotice && (
        <div className="p-3 rounded bg-slate-900 border border-teal-500/40 text-xs text-teal-300 flex items-center justify-between">
          <span>{expandNotice}</span>
          <button
            onClick={() => setExpandNotice(null)}
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Arcs Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading 1,000-episode roadmap...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredArcs.map((arc) => (
            <div
              key={arc.arcNumber}
              className="p-4 rounded-lg bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300 border border-slate-700/60">
                    {arc.episodeRange}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Season {arc.seasonNumber} · Arc #{arc.arcNumber}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setExpandArcNumber(arc.arcNumber);
                    setExpandCount(10);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3 text-teal-400" />
                  <span>Expand Arc</span>
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-100">{arc.arcTitle}</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {arc.centralConflict}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span className="truncate">Setting: {arc.coreSetting}</span>
                <span className="text-teal-400/90 font-mono truncate ml-2">
                  Consequence: {arc.majorConsequence}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Bounded Arc Expansion */}
      {expandArcNumber !== null && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-100">
              Expand Arc #{expandArcNumber} into Episode Cards
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Per Master Project Rules, roadmap expansion is bounded to a maximum of 20 cards per batch to bound each write; it does not establish distinctness, continuity integrity or budget approval.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">
                Number of Cards to Generate (1 to 20):
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={expandCount}
                onChange={(e) => setExpandCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-100 font-mono"
              />
              <span className="text-[11px] text-slate-500 block">
                Recommended: 10 cards (standard ten-episode arc block).
              </span>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
              <div className="text-slate-300 font-medium">Preproduction Safeguards:</div>
              <div>· Each card receives a unique physical objective and consequence.</div>
              <div>· Text similarity checked against existing cards to prevent tropes.</div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={isExpanding}
                onClick={() => setExpandArcNumber(null)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                disabled={isExpanding}
                onClick={handleExpandArc}
                className="px-4 py-1.5 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold disabled:opacity-50"
              >
                {isExpanding ? 'Expanding Cards...' : `Expand ${expandCount} Cards`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
