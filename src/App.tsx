/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { Navigation, ActiveTab } from './components/Navigation.tsx';
import { TopBar } from './components/TopBar.tsx';
const DashboardView = lazy(() => import('./components/DashboardView.tsx').then(module => ({ default: module.DashboardView })));
const SeriesRoomView = lazy(() => import('./components/SeriesRoomView.tsx').then(module => ({ default: module.SeriesRoomView })));
const RoadmapView = lazy(() => import('./components/RoadmapView.tsx').then(module => ({ default: module.RoadmapView })));
const EpisodeBoardView = lazy(() => import('./components/EpisodeBoardView.tsx').then(module => ({ default: module.EpisodeBoardView })));
const ScriptEditorView = lazy(() => import('./components/ScriptEditorView.tsx').then(module => ({ default: module.ScriptEditorView })));
const ResearchRoomView = lazy(() => import('./components/ResearchRoomView.tsx').then(module => ({ default: module.ResearchRoomView })));
const ScenePlannerView = lazy(() => import('./components/ScenePlannerView.tsx').then(module => ({ default: module.ScenePlannerView })));
const VideoEssayStudioView = lazy(() => import('./components/VideoEssayStudioView.tsx').then(module => ({ default: module.VideoEssayStudioView })));
const GoogleFlowView = lazy(() => import('./components/GoogleFlowView.tsx').then(module => ({ default: module.GoogleFlowView })));
const AutoproducerView = lazy(() => import('./components/AutoproducerView.tsx').then(module => ({ default: module.AutoproducerView })));
const JobsQueueView = lazy(() => import('./components/JobsQueueView.tsx').then(module => ({ default: module.JobsQueueView })));
const YouTubeView = lazy(() => import('./components/YouTubeView.tsx').then(module => ({ default: module.YouTubeView })));
const DoctorView = lazy(() => import('./components/DoctorView.tsx').then(module => ({ default: module.DoctorView })));
const SettingsView = lazy(() => import('./components/SettingsView.tsx').then(module => ({ default: module.SettingsView })));

import { PublicProjectMetadata, SeriesBible, EpisodeCard, PublicGenerationJob } from './types/index.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const mobileNavOpenerRef = useRef<HTMLButtonElement>(null);
  const [projectId, setProjectId] = useState<string>('proj_ternfall_01');
  const [projects, setProjects] = useState<PublicProjectMetadata[]>([]);
  const [series, setSeries] = useState<SeriesBible | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeCard[]>([]);
  const [jobs, setJobs] = useState<PublicGenerationJob[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('');
  const [loadError, setLoadError] = useState('');
  const activeProjectRef = useRef(projectId);
  const loadEpoch = useRef(0);
  const [isCloudPreview, setIsCloudPreview] = useState<boolean>(true);

  // Check URL params for autostart
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as ActiveTab;
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const opener = mobileNavOpenerRef.current;
    const panel = mobileNavRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
      .filter(element => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileNavOpen(false); return; }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); return; }
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && (index <= 0)) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && (index < 0 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); }
    };
    const wideScreen = window.matchMedia('(min-width: 768px)');
    const closeWhenWide = () => { if (wideScreen.matches) setMobileNavOpen(false); };
    document.addEventListener('keydown', handleKey);
    wideScreen.addEventListener('change', closeWhenWide);
    return () => {
      document.removeEventListener('keydown', handleKey);
      wideScreen.removeEventListener('change', closeWhenWide);
      if (opener?.isConnected && opener.getClientRects().length > 0) opener.focus();
      else {
        const activeNavigation = panel?.querySelector<HTMLElement>('[aria-current="page"]');
        if (activeNavigation?.isConnected && activeNavigation.getClientRects().length > 0) activeNavigation.focus();
      }
    };
  }, [mobileNavOpen]);

  const loadProjectData = async (pId: string, signal?: AbortSignal) => {
    if (activeProjectRef.current !== pId) return;
    const epoch = ++loadEpoch.current;
    const current = () => !signal?.aborted && activeProjectRef.current === pId && loadEpoch.current === epoch;
    const read = async (url: string) => {
      const response = await fetch(url, { signal });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || `Request failed (${response.status})`);
      return result.data;
    };
    const names = ['projects', 'series', 'episodes', 'jobs', 'diagnostics'];
    const results = await Promise.allSettled([
      read('/api/projects'), read(`/api/projects/${pId}/series`), read(`/api/projects/${pId}/episodes`),
      read(`/api/projects/${pId}/jobs`), read('/api/doctor'),
    ]);
    if (!current()) return;
    const [projectResult, seriesResult, episodeResult, jobResult, doctorResult] = results;
    if (projectResult.status === 'fulfilled' && Array.isArray(projectResult.value)) setProjects(projectResult.value);
    if (seriesResult.status === 'fulfilled') setSeries(seriesResult.value);
    if (episodeResult.status === 'fulfilled' && Array.isArray(episodeResult.value)) {
      const loaded: EpisodeCard[] = episodeResult.value;
      setEpisodes(loaded);
      setSelectedEpisodeId(id => loaded.some(episode => episode.id === id) ? id : (loaded[0]?.id || ''));
    }
    if (jobResult.status === 'fulfilled' && Array.isArray(jobResult.value)) setJobs(jobResult.value);
    if (doctorResult.status === 'fulfilled') setIsCloudPreview(doctorResult.value.runtimeEnvironment === 'cloud_preview');
    const failed = names.filter((_, index) => results[index].status === 'rejected');
    setLoadError(failed.length ? `Could not load ${failed.join(', ')}. Displayed information may be stale; retry before acting.` : '');
  };

  useEffect(() => {
    const controller = new AbortController();
    setSeries(null); setEpisodes([]); setJobs([]); setSelectedEpisodeId(''); setLoadError('');
    void loadProjectData(projectId, controller.signal);
    return () => { loadEpoch.current++; controller.abort(); };
  }, [projectId]);

  const selectProject = (id: string) => {
    if (id === activeProjectRef.current) return;
    activeProjectRef.current = id; loadEpoch.current++;
    setSeries(null); setEpisodes([]); setJobs([]); setSelectedEpisodeId('');
    setProjectId(id);
  };

  const activeProject = projects.find(p => p.id === projectId) || { id: projectId, name: 'Loading project…', slug: '' };

  const blockedJobsCount = jobs.filter((j) => j.state === 'blocked' || j.state === 'needs_user').length;

  const handleOpenEpisode = (epId: string) => {
    setSelectedEpisodeId(epId);
    setActiveTab('script_editor');
  };

  const handlePlanEpisode = (epId: string) => {
    setSelectedEpisodeId(epId);
    setActiveTab('google_flow');
  };

  const handleUpdateBible = async (update: Partial<SeriesBible>) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/series`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...update, revision: series?.revision }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Could not save series bible');
      if (activeProjectRef.current === projectId) setSeries(data.data);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans antialiased">
      {/* Sidebar Navigation */}
      {mobileNavOpen && <button type="button" aria-label="Dismiss navigation overlay" aria-hidden="true" tabIndex={-1} onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-black/60 md:hidden" />}
      <Navigation
        activeTab={activeTab}
        onSelectTab={tab => { setActiveTab(tab); setMobileNavOpen(false); }}
        mobileOpen={mobileNavOpen}
        navigationRef={mobileNavRef}
        onCloseNavigation={() => setMobileNavOpen(false)}
        projectName={activeProject.name}
        isCloudPreview={isCloudPreview}
        blockedJobsCount={blockedJobsCount}
      />

      {/* Main Viewport */}
      <div inert={mobileNavOpen} className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation Bar */}
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onQuickProduce={() => setActiveTab('google_flow')}
          onNewEpisode={() => setActiveTab('episodes')}
          onOpenNavigation={() => setMobileNavOpen(true)}
          navigationOpen={mobileNavOpen}
          navigationOpenerRef={mobileNavOpenerRef}
          projects={projects}
          projectId={projectId}
          onSelectProject={selectProject}
          episodes={episodes}
          episodeId={selectedEpisodeId}
          onSelectEpisode={setSelectedEpisodeId}
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-950">
          {loadError && <div role="alert" className="mb-4 rounded border border-rose-700 p-3 text-sm text-rose-200">{loadError} <button type="button" className="underline ml-2" onClick={() => void loadProjectData(projectId)}>Retry</button></div>}
          <Suspense key={projectId} fallback={<p role="status" className="p-6">Loading studio view…</p>}>
          {activeTab === 'dashboard' && (
            <DashboardView
              series={series}
              episodes={episodes}
              jobs={jobs}
              onSelectTab={setActiveTab}
              onOpenEpisode={handleOpenEpisode}
              selectedEpisodeId={selectedEpisodeId}
              onPlanEpisode={handlePlanEpisode}
            />
          )}

          {activeTab === 'series_bible' && (
            <SeriesRoomView bible={series} onUpdateBible={handleUpdateBible} />
          )}

          {activeTab === 'roadmap' && (
            <RoadmapView
              projectId={projectId}
              onExpandArcSuccess={() => loadProjectData(projectId)}
            />
          )}

          {activeTab === 'episodes' && (
            <EpisodeBoardView
              projectId={projectId}
              episodes={episodes}
              onOpenEpisode={handleOpenEpisode}
              onPlanEpisode={handlePlanEpisode}
              onRefreshEpisodes={() => loadProjectData(projectId)}
            />
          )}

          {activeTab === 'script_editor' && (
            <ScriptEditorView
              projectId={projectId}
              episodeId={selectedEpisodeId}
              activeSeriesId={projects.find(project => project.id === projectId)?.activeSeriesId}
              onBack={() => setActiveTab('episodes')}
              onRefreshEpisode={() => loadProjectData(projectId)}
            />
          )}

          {activeTab === 'research_room' && (
            <ResearchRoomView projectId={projectId} />
          )}

          {activeTab === 'video_essay' && (
            <VideoEssayStudioView projectId={projectId} />
          )}

          {activeTab === 'scene_planner' && (
            <ScenePlannerView projectId={projectId} episodeId={selectedEpisodeId} />
          )}

          {activeTab === 'google_flow' && (
            <GoogleFlowView
              projectId={projectId}
              episodeId={selectedEpisodeId}
            />
          )}

          {activeTab === 'autoproducer' && (
            <AutoproducerView
              projectId={projectId}
              defaultEpisodeId={selectedEpisodeId}
              onOpenYouTubeHandoff={() => setActiveTab('youtube')}
            />
          )}

          {activeTab === 'jobs_queue' && (
            <JobsQueueView
              projectId={projectId}
              jobs={jobs}
              onRefreshJobs={() => loadProjectData(projectId)}
            />
          )}

          {activeTab === 'youtube' && (
            <YouTubeView projectId={projectId} />
          )}

          {activeTab === 'doctor' && (
            <DoctorView />
          )}

          {activeTab === 'settings' && (
            <SettingsView projectId={projectId} />
          )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
