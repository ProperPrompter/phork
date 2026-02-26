'use client';

import { useRef, useEffect } from 'react';
import { useProjectStore } from '@/stores/project';
import type { ShotSnapshot } from '@phork/shared';
import { Film } from 'lucide-react';

interface PreviewPlayerProps {
  shots: ShotSnapshot[];
  renderAssetId: string | null;
  renderDownloadUrl: string | null;
}

export function PreviewPlayer({ shots, renderAssetId, renderDownloadUrl }: PreviewPlayerProps) {
  const totalDuration = shots.reduce((sum, s) => sum + s.duration_ms, 0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { playheadMs, setPlayheadMs } = useProjectStore();

  /* Push video playback position → store playhead */
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setPlayheadMs(videoRef.current.currentTime * 1000);
    }
  };

  /* Seek video when playhead is changed externally (e.g. ruler click) */
  useEffect(() => {
    if (videoRef.current && renderDownloadUrl) {
      const diff = Math.abs(videoRef.current.currentTime * 1000 - playheadMs);
      if (diff > 300) {
        videoRef.current.currentTime = playheadMs / 1000;
      }
    }
  }, [playheadMs, renderDownloadUrl]);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-black/50 p-8">
      {renderDownloadUrl ? (
        <div className="w-full max-w-2xl">
          <video
            ref={videoRef}
            controls
            autoPlay
            className="w-full rounded-lg"
            src={renderDownloadUrl}
            onTimeUpdate={handleTimeUpdate}
          />
          <p className="mt-2 text-center text-xs text-[var(--text-secondary)]">
            Rendered output - {shots.length} shots, {(totalDuration / 1000).toFixed(1)}s total
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-10 py-8 text-center shadow-lg">
          <Film size={40} className="mx-auto mb-3 text-[var(--text-muted)]" />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {shots.length === 0
              ? 'Add shots to your timeline to get started'
              : `${shots.length} shot${shots.length > 1 ? 's' : ''} - ${(totalDuration / 1000).toFixed(1)}s total`}
          </p>
          <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
            Generate visuals and audio, then render to preview
          </p>
        </div>
      )}
    </div>
  );
}
