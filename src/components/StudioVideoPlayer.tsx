import React from 'react';

interface StudioVideoPlayerProps { episodeId: string; workingTitle: string; totalDurationSeconds?: number }

/** Retired: this component previously downloaded plain text with a misleading .mp4 extension. */
export const StudioVideoPlayer: React.FC<StudioVideoPlayerProps> = ({ episodeId, workingTitle }) => (
  <div role="status" className="rounded border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-200">
    Simulated player and downloads for {episodeId} — {workingTitle} are retired. Use a completed supplied-asset local render and inspect its measured QC; no media was generated here.
  </div>
);
