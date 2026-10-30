import React from 'react';
import type { EpisodeCard, PublicProjectMetadata } from '../types/index.ts';
import { ActiveTab } from './Navigation.tsx';
import { Menu, Play, Plus } from 'lucide-react';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onQuickProduce: () => void;
  onNewEpisode: () => void;
  onOpenNavigation: () => void;
  navigationOpen: boolean;
  navigationOpenerRef: React.RefObject<HTMLButtonElement | null>;
  projects: PublicProjectMetadata[];
  projectId: string;
  onSelectProject: (id: string) => void;
  episodes: EpisodeCard[];
  episodeId: string;
  onSelectEpisode: (id: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onSelectTab, onQuickProduce, onNewEpisode, onOpenNavigation, navigationOpen, navigationOpenerRef, projects, projectId, onSelectProject, episodes, episodeId, onSelectEpisode }) => (
  <header className="min-h-14 bg-slate-950 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
    <button ref={navigationOpenerRef} type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="studio-navigation" aria-expanded={navigationOpen} onClick={onOpenNavigation} className="md:hidden rounded border border-slate-700 p-2 text-slate-200"><Menu className="w-4 h-4" /></button>
    <button type="button" onClick={() => onSelectTab('dashboard')} className="text-base font-bold tracking-tight text-slate-100 hover:text-teal-400 whitespace-nowrap">Ternfall Studio</button>
    <div className="flex flex-wrap items-center gap-3 min-w-0">
      <label className="text-xs text-slate-400">Project{' '}
        <select aria-label="Active project" value={projectId} onChange={event => onSelectProject(event.target.value)} className="max-w-[220px] bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200">
          {!projects.some(project => project.id === projectId) && <option value={projectId}>{projects.length ? projectId : 'Loading projects…'}</option>}
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}{project.isArchived ? ' (archived)' : ''}</option>)}
        </select>
      </label>
      <label className="text-xs text-slate-400">Episode{' '}
        <select aria-label="Active episode" value={episodeId} onChange={event => onSelectEpisode(event.target.value)} disabled={!episodes.length} className="max-w-[220px] bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-200 disabled:opacity-50">
          {!episodeId && <option value="">No episode selected</option>}
          {episodes.map(episode => <option key={episode.dbId} value={episode.id}>{episode.id}: {episode.workingTitle}</option>)}
        </select>
      </label>
    </div>
    <div className="flex items-center gap-2">
      <button type="button" onClick={onNewEpisode} className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" />New card</button>
      <button type="button" disabled={!episodeId} onClick={onQuickProduce} className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-md flex items-center gap-1.5 disabled:opacity-50"><Play className="w-3.5 h-3.5" />Plan / render</button>
    </div>
  </header>
);
