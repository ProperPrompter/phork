'use client';

import type { ShotSnapshot } from '@phork/shared';
import { Video, Music, Trash2 } from 'lucide-react';

interface ShotBlockProps {
  shot: ShotSnapshot;
  index: number;
  selected: boolean;
  trackType: 'video' | 'audio';
  leftPx: number;
  widthPx: number;
  onSelect: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
}

export function ShotBlock({
  shot, index, selected, trackType, leftPx, widthPx,
  onSelect, onRemove, onDragStart,
}: ShotBlockProps) {
  const hasAsset = trackType === 'video' ? !!shot.visual_asset_id : !!shot.audio_asset_id;
  const isVideo = trackType === 'video';
  const clipWidth = Math.max(widthPx, 20);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onClick={onSelect}
      className={`group absolute top-1 bottom-1 flex cursor-pointer items-center rounded-md border transition-all ${
        selected
          ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/40 z-[5]'
          : hasAsset
            ? 'border-transparent hover:border-[var(--card-hover-border)]'
            : 'border-dashed border-[var(--border-color)] opacity-50 hover:opacity-70'
      }`}
      style={{
        left: `${leftPx}px`,
        width: `${clipWidth}px`,
        backgroundColor: hasAsset
          ? isVideo
            ? 'rgba(249, 115, 22, 0.18)'
            : 'rgba(236, 72, 153, 0.18)'
          : 'var(--bg-tertiary)',
      }}
    >
      {/* Colored left edge */}
      {hasAsset && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
          style={{ backgroundColor: isVideo ? 'var(--track-video-clip)' : 'var(--track-audio-clip)' }}
        />
      )}

      {/* Content */}
      <div className="flex h-full w-full items-center gap-1.5 overflow-hidden px-2">
        {isVideo ? (
          <Video size={11} className={hasAsset ? 'text-[var(--track-video-clip)] flex-shrink-0' : 'text-[var(--text-muted)] flex-shrink-0'} />
        ) : (
          <Music size={11} className={hasAsset ? 'text-[var(--track-audio-clip)] flex-shrink-0' : 'text-[var(--text-muted)] flex-shrink-0'} />
        )}
        {clipWidth > 50 && (
          <span className="truncate text-[9px] font-medium text-[var(--text-secondary)]">
            Shot {index + 1}
          </span>
        )}
        {clipWidth > 80 && (
          <span className="ml-auto flex-shrink-0 text-[8px] text-[var(--text-muted)]">
            {(shot.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-[var(--error)] text-white group-hover:flex z-10"
      >
        <Trash2 size={8} />
      </button>
    </div>
  );
}
