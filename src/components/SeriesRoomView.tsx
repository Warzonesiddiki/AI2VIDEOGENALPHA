import React, { useState } from 'react';
import { SeriesBible, CharacterSheet, WorldRule } from '../types/index.ts';
import { BookOpen, User, MapPin, ShieldAlert, Palette, CheckCircle2 } from 'lucide-react';

interface SeriesRoomViewProps {
  bible: SeriesBible | null;
  onUpdateBible: (update: Partial<SeriesBible>) => Promise<void>;
}

export const SeriesRoomView: React.FC<SeriesRoomViewProps> = ({ bible, onUpdateBible }) => {
  const [activeSection, setActiveSection] = useState<'rules' | 'characters' | 'visual_bible' | 'factions' | 'originality'>('rules');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterSheet | null>(
    bible?.characters[0] || null
  );

  if (!bible) {
    return (
      <div className="p-8 text-center text-slate-400">Loading series bible...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-slate-800 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-teal-400 uppercase tracking-wider">
              Story World & Canon Bible
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-100 mt-0.5">
              {bible.seriesTitle}
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              {bible.logline}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Target: ~{bible.targetRuntimeMinutes}m</span>
            <span aria-hidden="true">·</span>
            <span>{bible.targetWpm} WPM (~2,175 words)</span>
          </div>
        </div>
      </div>

      {/* Section Navigation Tabs (Segmented Control style) */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg w-fit">
        <button
          onClick={() => setActiveSection('rules')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeSection === 'rules'
              ? 'bg-slate-800 text-teal-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          World Rules & The Still
        </button>
        <button
          onClick={() => setActiveSection('characters')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeSection === 'characters'
              ? 'bg-slate-800 text-teal-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Character Cast ({bible.characters.length})
        </button>
        <button
          onClick={() => setActiveSection('visual_bible')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeSection === 'visual_bible'
              ? 'bg-slate-800 text-teal-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Visual & Audio Identity
        </button>
        <button
          onClick={() => setActiveSection('factions')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeSection === 'factions'
              ? 'bg-slate-800 text-teal-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Factions & Map
        </button>
        <button
          onClick={() => setActiveSection('originality')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeSection === 'originality'
              ? 'bg-slate-800 text-teal-300 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Originality & Rights
        </button>
      </div>

      {/* SECTION: WORLD RULES */}
      {activeSection === 'rules' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-teal-400" />
              <span>Invariable Fictional Rules of the Outbreak</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              These rules govern the fictional world of Ternfall. Script drafts and outlines are checked against them to avoid magical tropes, airborne panic clichés, or continuity drift.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {bible.rules.map((rule) => (
                <div key={rule.id} className="p-4 rounded-md bg-slate-950 border border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">{rule.title}</span>
                    <span className="text-[11px] font-mono text-teal-400 capitalize">
                      {rule.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {rule.fictionalRule}
                  </p>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                    <strong className="text-slate-400">Prohibited Trope:</strong> {rule.prohibitedMisconceptions}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION: CHARACTERS */}
      {activeSection === 'characters' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Character List */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-slate-500 px-1">Ensemble Cast</div>
            {bible.characters.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedCharacter(char)}
                className={`w-full text-left p-3 rounded-md border transition-all ${
                  selectedCharacter?.id === char.id
                    ? 'bg-slate-800 border-teal-500/50 text-slate-100 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-slate-200">{char.name}</span>
                  <span className="text-[11px] font-mono text-slate-500">{char.age} yrs</span>
                </div>
                <div className="text-[11px] text-teal-400/80 mt-0.5 truncate">{char.role}</div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  Visual Anchor: {char.visualAnchor}
                </div>
              </button>
            ))}
          </div>

          {/* Selected Character Deep Sheet */}
          {selectedCharacter && (
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-5">
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-100">{selectedCharacter.name}</h3>
                  <span className="text-xs font-mono text-teal-400">{selectedCharacter.role}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Age {selectedCharacter.age} · Last Known Location: {selectedCharacter.lastKnownLocation}
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <div className="text-slate-400 font-medium mb-1">Visual Anchor & Silhouette:</div>
                  <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-teal-300 font-mono text-[11px] leading-relaxed">
                    {selectedCharacter.visualAnchor}
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 font-medium mb-1">Prompt Generation Guidance (Negative Constraints Attached):</div>
                  <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-slate-300 leading-relaxed">
                    {selectedCharacter.appearancePromptGuidance}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-slate-400 font-medium mb-1">Psychological Wound & Flaw:</div>
                    <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-slate-300 leading-relaxed">
                      {selectedCharacter.psychologicalWound}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-400 font-medium mb-1">Knowledge Scope & Technical Limits:</div>
                    <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-slate-300 leading-relaxed">
                      {selectedCharacter.knowledgeScope}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-slate-400 font-medium mb-1">Narration Voice & Dialogue Cadence:</div>
                  <div className="p-3 rounded bg-slate-950 border border-slate-800/80 text-slate-300 leading-relaxed">
                    {selectedCharacter.voiceStyle}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION: VISUAL BIBLE */}
      {activeSection === 'visual_bible' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Palette className="w-4 h-4 text-teal-400" />
              <span>Original Aesthetic Guidelines</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Strict rules to guarantee distinct art identity and prevent AI-slop or competitor lookalikes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="space-y-4">
              <div>
                <div className="text-slate-400 font-medium mb-1">Approved Medium & Treatment:</div>
                <div className="p-3.5 rounded bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed">
                  {bible.visualBible.medium}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium mb-1">Silhouette & Character Language:</div>
                <div className="p-3.5 rounded bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed">
                  {bible.visualBible.silhouetteRules}
                </div>
              </div>

              <div>
                <div className="text-slate-400 font-medium mb-1">Lighting & Environmental Mood:</div>
                <div className="p-3.5 rounded bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed">
                  {bible.visualBible.lightingRules}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-slate-400 font-medium mb-1">Curated Color Palette:</div>
                <div className="space-y-1.5 p-3.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px]">
                  {bible.visualBible.palette.map((c, i) => (
                    <div key={i} className="text-slate-300">
                      {c}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-rose-400 font-medium mb-1">Banned Visual Clichés & Clones:</div>
                <div className="p-3.5 rounded bg-slate-950 border border-rose-950/60 space-y-1 text-slate-300">
                  {bible.visualBible.bannedStyles.map((banned, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-400 shrink-0">✕</span>
                      <span>{banned}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: FACTIONS & MAP */}
      {activeSection === 'factions' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bible.factions.map((f) => (
              <div key={f.id} className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="text-sm font-bold text-slate-200">{f.name}</div>
                <div className="text-teal-400 font-medium">Rep: {f.leaderOrKeyRep}</div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  <strong>Ideology:</strong> {f.ideology}
                </p>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  <strong>Interests:</strong> {f.materialInterests}
                </p>
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                  Relation to South Gate: {f.relationshipToSouthGate}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-teal-400" />
              <span>Key Canonical Locations in Ternfall</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bible.locations.map((loc) => (
                <div key={loc.id} className="p-3.5 rounded-md bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                  <div className="font-semibold text-slate-200">{loc.name}</div>
                  <div className="text-[11px] text-teal-400/80 font-mono">{loc.district}</div>
                  <p className="text-slate-400 text-[11px] pt-1">{loc.environmentalDescription}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION: ORIGINALITY */}
      {activeSection === 'originality' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
            <span>Originality & IP Clearance Declarations</span>
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every episode generated or produced in Ternfall Studio must respect strict commercial rights:
          </p>
          <div className="space-y-2">
            {bible.originalityDeclarations.map((decl, i) => (
              <div key={i} className="p-3 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                <span className="text-teal-400 font-bold shrink-0">✓</span>
                <span>{decl}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
