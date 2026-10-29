import React from 'react';
import { ActiveTab } from './Navigation.tsx';
import { Play, Plus } from 'lucide-react';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onQuickProduce: () => void;
  onNewEpisode: () => void;
  activeProjectName: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onQuickProduce,
  onNewEpisode,
  activeProjectName,
}) => {
  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between gap-8 shrink-0 select-none">
      {/* Zone 1: Brand Wordmark (Single text element) */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => onSelectTab('dashboard')}
          className="text-base font-bold tracking-tight text-slate-100 hover:text-teal-400 transition-colors whitespace-nowrap"
        >
          Ternfall Studio
        </button>
        <span className="text-slate-600 text-xs" aria-hidden="true">/</span>
        <span className="text-xs text-slate-400 font-mono truncate max-w-[180px]">
          {activeProjectName}
        </span>
      </div>

      {/* Zone 2: 4–5 clean single-line text navigation links */}
      <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-400">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
            activeTab === 'dashboard' ? 'text-teal-400 font-semibold' : ''
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectTab('series_bible')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
            activeTab === 'series_bible' ? 'text-teal-400 font-semibold' : ''
          }`}
        >
          Series Room
        </button>
        <button
          onClick={() => onSelectTab('episodes')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
            activeTab === 'episodes' ? 'text-teal-400 font-semibold' : ''
          }`}
        >
          Episode Board
        </button>
        <button
          onClick={() => onSelectTab('autoproducer')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
            activeTab === 'autoproducer' ? 'text-teal-400 font-semibold' : ''
          }`}
        >
          Autoproducer
        </button>
        <button
          onClick={() => onSelectTab('video_essay')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
            activeTab === 'video_essay' ? 'text-teal-400 font-semibold' : ''
          }`}
        >
          Video Essay (0-Credit)
        </button>
        <button
          onClick={() => onSelectTab('youtube')}
          className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
            activeTab === 'youtube' ? 'text-teal-400 font-semibold' : ''
          }`}
        >
          YouTube Ops
        </button>
      </nav>

      {/* Zone 3: 1 Primary Action + Quick Create */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={onNewEpisode}
          className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white rounded-md border border-slate-700/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Card</span>
        </button>

        <button
          onClick={onQuickProduce}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-md shadow-sm transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Produce S01E001</span>
        </button>
      </div>
    </header>
  );
};
