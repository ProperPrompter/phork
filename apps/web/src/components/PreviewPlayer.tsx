'use client';

import { useState } from 'react';
import type { ShotSnapshot } from '@phork/shared';
import { Play, Film } from 'lucide-react';

interface PreviewPlayerProps {
  shots: ShotSnapshot[];
  renderAssetId: string | null;
  renderDownloadUrl: string | null;
}

export function PreviewPlayer({ shots, renderAssetId, renderDownloadUrl }: PreviewPlayerProps) {
  const totalDuration = shots.reduce((sum, s) => sum + s.duration_ms, 0);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-black/50 p-8">
      {renderDownloadUrl ? (
        <div className="w-full max-w-2xl">
          <video
            controls
            autoPlay
            className="w-full rounded-lg"
            src={renderDownloadUrl}
          />
          <p className="mt-2 text-center text-xs text-[var(--text-secondary)]">
            Rendered output - {shots.length} shots, {(totalDuration / 1000).toFixed(1)}s total
          </p>
        </div>
      ) : (
        <div className="text-center">
          <Film size={48} className="mx-auto mb-4 text-[var(--text-secondary)]" />
          <p className="text-[var(--text-secondary)]">
            {shots.length === 0
              ? 'Add shots to your timeline to get started'
              : `${shots.length} shot${shots.length > 1 ? 's' : ''} - ${(totalDuration / 1000).toFixed(1)}s total`}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Generate visuals and audio, then render to preview
          </p>
        </div>
      )}
    </div>
  );
}
