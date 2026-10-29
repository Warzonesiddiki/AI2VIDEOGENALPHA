/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navigation, ActiveTab } from './components/Navigation.tsx';
import { TopBar } from './components/TopBar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { SeriesRoomView } from './components/SeriesRoomView.tsx';
import { RoadmapView } from './components/RoadmapView.tsx';
import { EpisodeBoardView } from './components/EpisodeBoardView.tsx';
import { ScriptEditorView } from './components/ScriptEditorView.tsx';
import { ResearchRoomView } from './components/ResearchRoomView.tsx';
import { ScenePlannerView } from './components/ScenePlannerView.tsx';
import { VideoEssayStudioView } from './components/VideoEssayStudioView.tsx';
import { GoogleFlowView } from './components/GoogleFlowView.tsx';
import { AutoproducerView } from './components/AutoproducerView.tsx';
import { JobsQueueView } from './components/JobsQueueView.tsx';
import { YouTubeView } from './components/YouTubeView.tsx';
import { DoctorView } from './components/DoctorView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

import { ProjectMetadata, SeriesBible, EpisodeCard, GenerationJob } from './types/index.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [projectId, setProjectId] = useState<string>('proj_ternfall_01');
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [series, setSeries] = useState<SeriesBible | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeCard[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>('S01E001');
  const [isCloudPreview, setIsCloudPreview] = useState<boolean>(true);

  // Check URL params for autostart
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab') as ActiveTab;
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, []);

  const loadProjectData = async (pId: string) => {
    try {
      // Load projects
      const projRes = await fetch('/api/projects');
      const projData = await projRes.json();
      if (projData.ok) {
        setProjects(projData.data);
      }

      // Load series
      const seriesRes = await fetch(`/api/projects/${pId}/series`);
      const seriesData = await seriesRes.json();
      if (seriesData.ok) {
        setSeries(seriesData.data);
      }

      // Load episodes
      const epRes = await fetch(`/api/projects/${pId}/episodes`);
      const epData = await epRes.json();
      if (epData.ok) {
        setEpisodes(epData.data);
      }

      // Load jobs
      const jobsRes = await fetch(`/api/projects/${pId}/jobs`);
      const jobsData = await jobsRes.json();
      if (jobsData.ok) {
        setJobs(jobsData.data);
      }

      // Check doctor diagnostics
      const docRes = await fetch('/api/doctor');
      const docData = await docRes.json();
      if (docData.ok) {
        setIsCloudPreview(docData.data.runtimeEnvironment === 'cloud_preview');
      }
    } catch (err) {
      console.error('Failed to load project data:', err);
    }
  };

  useEffect(() => {
    loadProjectData(projectId);
  }, [projectId]);

  const activeProject = projects.find((p) => p.id === projectId) || {
    id: projectId,
    name: 'The Quiet Hours: Ternfall',
    slug: 'the-quiet-hours-ternfall',
  };

  const blockedJobsCount = jobs.filter((j) => j.state === 'blocked' || j.state === 'needs_user').length;

  const handleOpenEpisode = (epId: string) => {
    setSelectedEpisodeId(epId);
    setActiveTab('script_editor');
  };

  const handleStartAutoproduce = (epId: string) => {
    setSelectedEpisodeId(epId);
    setActiveTab('autoproducer');
  };

  const handleUpdateBible = async (update: Partial<SeriesBible>) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/series`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      const data = await res.json();
      if (data.ok) {
        setSeries(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans antialiased">
      {/* Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        projectName={activeProject.name}
        isCloudPreview={isCloudPreview}
        blockedJobsCount={blockedJobsCount}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation Bar */}
        <TopBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onQuickProduce={() => handleStartAutoproduce('S01E001')}
          onNewEpisode={() => setActiveTab('episodes')}
          activeProjectName={activeProject.name}
        />

        {/* Content View Container */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
          {activeTab === 'dashboard' && (
            <DashboardView
              series={series}
              episodes={episodes}
              jobs={jobs}
              onSelectTab={setActiveTab}
              onOpenEpisode={handleOpenEpisode}
              onStartAutoproduce={handleStartAutoproduce}
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
              onStartAutoproduce={handleStartAutoproduce}
              onRefreshEpisodes={() => loadProjectData(projectId)}
            />
          )}

          {activeTab === 'script_editor' && (
            <ScriptEditorView
              projectId={projectId}
              episodeId={selectedEpisodeId}
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
            <ScenePlannerView episodeId={selectedEpisodeId} />
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
        </main>
      </div>
    </div>
  );
}
