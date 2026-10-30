import React from 'react';
import {
  Film,
  BookOpen,
  MapPin,
  ListTodo,
  FileText,
  Search,
  LayoutGrid,
  Bot,
  Activity,
  Youtube,
  Stethoscope,
  Settings,
  AlertTriangle,
  ExternalLink,
  Layers,
  Tv,
  X,
} from 'lucide-react';

export type ActiveTab =
  | 'dashboard'
  | 'series_bible'
  | 'roadmap'
  | 'episodes'
  | 'script_editor'
  | 'research_room'
  | 'video_essay'
  | 'scene_planner'
  | 'google_flow'
  | 'autoproducer'
  | 'jobs_queue'
  | 'youtube'
  | 'doctor'
  | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  projectName: string;
  isCloudPreview: boolean;
  blockedJobsCount: number;
  mobileOpen: boolean;
  navigationRef: React.RefObject<HTMLElement | null>;
  onCloseNavigation: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  projectName,
  isCloudPreview,
  blockedJobsCount,
  mobileOpen,
  navigationRef,
  onCloseNavigation,
}) => {
  const navSections = [
    {
      title: 'STORY & CANON',
      items: [
        { id: 'dashboard' as ActiveTab, label: 'Dashboard', icon: Activity },
        { id: 'series_bible' as ActiveTab, label: 'Series Room', icon: BookOpen },
        { id: 'roadmap' as ActiveTab, label: 'Ternfall roadmap', icon: MapPin },
        { id: 'episodes' as ActiveTab, label: 'Episode Board', icon: ListTodo },
        { id: 'script_editor' as ActiveTab, label: 'Script & Pacing', icon: FileText },
        { id: 'research_room' as ActiveTab, label: 'Research Room', icon: Search },
      ],
    },
    {
      title: 'MEDIA & PRODUCTION',
      items: [
        { id: 'video_essay' as ActiveTab, label: 'Video Essay sample', icon: Tv },
        { id: 'scene_planner' as ActiveTab, label: 'Local render', icon: LayoutGrid },
        { id: 'google_flow' as ActiveTab, label: 'Flow plan & local render', icon: Film },
        { id: 'autoproducer' as ActiveTab, label: 'Autoproducer history', icon: Bot },
        {
          id: 'jobs_queue' as ActiveTab,
          label: 'Historical jobs',
          icon: Film,
          badge: blockedJobsCount > 0 ? blockedJobsCount : undefined,
        },
      ],
    },
    {
      title: 'OPERATIONS & RUNTIME',
      items: [
        { id: 'youtube' as ActiveTab, label: 'YouTube Operations', icon: Youtube },
        { id: 'doctor' as ActiveTab, label: 'Doctor Diagnostics', icon: Stethoscope },
        { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside ref={navigationRef} id="studio-navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined} aria-label={mobileOpen ? "Navigation" : undefined} className={`${mobileOpen ? 'fixed inset-y-0 left-0 z-50 flex shadow-2xl' : 'hidden'} md:relative md:inset-auto md:z-auto md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col shrink-0 select-none`}>
      {/* Brand & Project Identity */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-teal-900/40">
            TF
          </div>
          <div className="truncate">
            <span className="text-sm font-semibold tracking-tight text-slate-100 block truncate">
              {projectName}
            </span>
            <span className="text-xs text-teal-400 font-mono block">
              Project workspace
            </span>
          </div>
        </div>
        {mobileOpen && <button type="button" aria-label="Close navigation" onClick={onCloseNavigation} className="md:hidden rounded border border-slate-700 p-2 text-slate-200"><X className="w-4 h-4" aria-hidden="true" /></button>}
      </div>

      {/* Cloud Preview Notice Pill-Free */}
      {isCloudPreview && (
        <div className="mx-3 mt-3 p-2.5 rounded-md bg-slate-800/80 border border-amber-500/30 text-xs">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium mb-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Cloud Preview Mode</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-tight">
            This browser is not the server. Local renders use files available to the server, not paths on your computer.
          </p>
        </div>
      )}

      {/* Navigation Groups */}
      <nav aria-label="Studio navigation" className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-slate-500">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <span>Ternfall Studio v1.0</span>
        <button
          onClick={() => onSelectTab('doctor')}
          className="hover:text-slate-300 transition-colors flex items-center gap-1 text-[11px]"
        >
          <span>Doctor</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
};
