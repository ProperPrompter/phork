'use client';

import { useRef, useState, useCallback } from 'react';
import { Plus, Video, Music, Sparkles, Library, X } from 'lucide-react';
import type { ShotSnapshot } from '@phork/shared';
import type { Track } from '@/stores/project';
import { ShotBlock } from './ShotBlock';

interface TimelineTrackProps {
  shots: ShotSnapshot[];
  tracks: Track[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onAddTrack: (type: 'video' | 'audio') => void;
  onRemoveTrack: (id: string) => void;
  onDropAsset: (assetId: string, assetType: string, durationMs: number | null, trackType: 'video' | 'audio') => void;
  zoomLevel: number;
  playheadMs: number;
  onPlayheadChange: (ms: number) => void;
  onSwitchToGenerate: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function shotOffsetPx(shots: ShotSnapshot[], index: number, zoom: number): number {
  let ms = 0;
  for (let i = 0; i < index; i++) ms += shots[i].duration_ms;
  return (ms / 1000) * zoom;
}

function shotWidthPx(shot: ShotSnapshot, zoom: number): number {
  return (shot.duration_ms / 1000) * zoom;
}

function getTickIntervals(zoom: number): { major: number; minor: number } {
  if (zoom < 40) return { major: 10000, minor: 5000 };
  if (zoom < 80) return { major: 5000, minor: 1000 };
  if (zoom < 200) return { major: 2000, minor: 500 };
  return { major: 1000, minor: 250 };
}

export function TimelineTrack({
  shots, tracks, selectedIndex, onSelect, onAdd, onRemove, onReorder,
  onAddTrack, onRemoveTrack, onDropAsset,
  zoomLevel, playheadMs, onPlayheadChange, onSwitchToGenerate,
}: TimelineTrackProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelScrollRef = useRef<HTMLDivElement>(null);
  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<string | null>(null);

  const totalDurationMs = shots.reduce((sum, s) => sum + s.duration_ms, 0);
  const endOfClipsPx = (totalDurationMs / 1000) * zoomLevel;
  const playheadPx = (playheadMs / 1000) * zoomLevel;
  const { major: majorMs, minor: minorMs } = getTickIntervals(zoomLevel);
  const computedWidth = Math.max(endOfClipsPx + 200, 2000);

  const videoTracks = tracks.filter((t) => t.type === 'video');
  const audioTracks = tracks.filter((t) => t.type === 'audio');

  /* ── Ruler click → seek ── */
  const handleRulerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const clickX = e.clientX - rect.left + scrollLeft;
    const ms = (clickX / zoomLevel) * 1000;
    onPlayheadChange(Math.max(0, Math.min(totalDurationMs, ms)));
  }, [zoomLevel, totalDurationMs, onPlayheadChange]);

  /* ── Drag & drop ── */
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    // Show 'copy' cursor for library assets, 'move' for reordering
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes('application/asset-json') ? 'copy' : 'move';
  };

  const handleDrop = (e: React.DragEvent, trackType: 'video' | 'audio') => {
    e.preventDefault();

    // Check if this is an asset drop from the library
    const assetData = e.dataTransfer.getData('application/asset-json');
    if (assetData) {
      try {
        const { id, type, durationMs } = JSON.parse(assetData);
        onDropAsset(id, type, durationMs, trackType);
      } catch { /* ignore bad data */ }
      setDragIndex(null);
      return;
    }

    // Otherwise it's a reorder within the timeline
    if (dragIndex === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = scrollRef.current?.scrollLeft || 0;
    const dropX = e.clientX - rect.left + scrollLeft;
    let accMs = 0;
    let dropIdx = shots.length;
    for (let i = 0; i < shots.length; i++) {
      const midPx = ((accMs + shots[i].duration_ms / 2) / 1000) * zoomLevel;
      if (dropX < midPx) { dropIdx = i; break; }
      accMs += shots[i].duration_ms;
    }
    if (dragIndex !== dropIdx) onReorder(dragIndex, dropIdx);
    setDragIndex(null);
  };

  /* ── Sync scroll: labels (vertical) + ruler (horizontal) ── */
  const handleContentScroll = () => {
    if (scrollRef.current) {
      if (labelScrollRef.current) {
        labelScrollRef.current.scrollTop = scrollRef.current.scrollTop;
      }
      if (rulerScrollRef.current) {
        rulerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
      }
    }
  };

  /* ── Ruler ticks ── */
  const renderRuler = () => {
    const ticks: React.ReactNode[] = [];
    const maxMs = totalDurationMs + 10000;
    for (let ms = 0; ms <= maxMs; ms += minorMs) {
      const x = (ms / 1000) * zoomLevel;
      if (x > computedWidth) break;
      const isMajor = ms % majorMs === 0;
      ticks.push(
        <div key={ms} className="absolute top-0 bottom-0" style={{ left: `${x}px` }}>
          <div className={`${isMajor ? 'h-full' : 'h-1/2'} w-px`} style={{ backgroundColor: 'var(--border-color)' }} />
          {isMajor && (
            <span className="absolute top-0.5 left-1 select-none whitespace-nowrap text-[8px] text-[var(--text-muted)]">
              {formatTime(ms)}
            </span>
          )}
        </div>,
      );
    }
    return ticks;
  };

  /* ── Track label renderer ── */
  const renderTrackLabel = (track: Track, idx: number) => (
    <div
      key={track.id}
      className={`group flex items-center gap-1.5 border-b border-[var(--border-color)] px-2 text-[10px] font-medium text-[var(--text-secondary)] flex-shrink-0${track.type === 'video' && idx === 0 ? ' border-t border-t-[var(--border-color)]' : ''}`}
      style={{ height: 'var(--track-height)' }}
    >
      {track.type === 'video' ? (
        <Video size={11} className="flex-shrink-0 text-[var(--track-video-clip)]" />
      ) : (
        <Music size={11} className="flex-shrink-0 text-[var(--track-audio-clip)]" />
      )}
      <span className="truncate">{track.label}</span>

      {/* Track remove button hidden — capped to 1 video + 1 audio for Phase 2A */}
    </div>
  );

  /* ── Track content row renderer (with inline add button) ── */
  const renderTrackRow = (track: Track, idx: number) => {
    // Filter shots to only those with an asset matching this track type
    const trackShots = shots
      .map((shot, i) => ({ shot, originalIndex: i }))
      .filter(({ shot }) =>
        track.type === 'video' ? !!shot.visual_asset_id : !!shot.audio_asset_id,
      );

    // Compute the end position for the "+" button based on this track's clips
    let trackEndPx = 0;
    trackShots.forEach(({ shot }) => {
      trackEndPx += (shot.duration_ms / 1000) * zoomLevel;
    });

    return (
    <div
      key={track.id}
      className={`relative border-b border-[var(--border-color)] flex-shrink-0${track.type === 'video' && idx === 0 ? ' border-t border-t-[var(--border-color)]' : ''}`}
      style={{ height: 'var(--track-height)' }}
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, track.type)}
    >
      {/* Shot clips — only for this track type */}
      {trackShots.map(({ shot, originalIndex }, trackIdx) => {
        // Compute position based only on preceding clips in THIS track
        let leftMs = 0;
        for (let j = 0; j < trackIdx; j++) leftMs += trackShots[j].shot.duration_ms;
        return (
          <ShotBlock
            key={`${track.id}-${shot.shot_id}`}
            shot={shot}
            index={originalIndex}
            selected={selectedIndex === originalIndex}
            trackType={track.type}
            leftPx={(leftMs / 1000) * zoomLevel}
            widthPx={shotWidthPx(shot, zoomLevel)}
            onSelect={() => onSelect(originalIndex)}
            onRemove={() => onRemove(originalIndex)}
            onDragStart={handleDragStart}
          />
        );
      })}

      {/* Inline "+" add-content button — sits after last clip on this track */}
      <div className="absolute top-0 bottom-0 flex items-center z-[6]" style={{ left: `${trackEndPx + 8}px` }}>
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(showAddMenu === track.id ? null : track.id)}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-dashed border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
            title="Add content"
          >
            <Plus size={12} />
          </button>
          {showAddMenu === track.id && (
            <div className="absolute top-full left-0 z-30 mt-1 w-36 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
              <button
                onClick={() => { onSwitchToGenerate(); setShowAddMenu(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Sparkles size={12} className="text-[var(--accent)]" />
                Generate
              </button>
              <button
                onClick={() => { onAdd(); setShowAddMenu(null); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <Library size={12} className="text-[var(--text-secondary)]" />
                From Library
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-[var(--track-bg)] relative select-none overflow-hidden">
      {/* Ruler row (always pinned at top, full width) */}
      <div className="flex flex-shrink-0 border-b border-[var(--border-color)]" style={{ height: 'var(--ruler-height)' }}>
        <div className="flex-shrink-0 border-r border-[var(--border-color)]" style={{ width: 'var(--track-label-width)' }} />
        <div ref={rulerScrollRef} className="flex-1 overflow-hidden">
          <div
            className="relative cursor-pointer h-full"
            style={{ width: `${computedWidth}px`, minWidth: '100%', backgroundColor: 'var(--bg-secondary)' }}
            onClick={handleRulerClick}
          >
            {renderRuler()}
          </div>
        </div>
      </div>

      {/* Tracks area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Label column (synced vertical scroll, flex col for margin-auto centering) ── */}
        <div
          ref={labelScrollRef}
          className="flex flex-col flex-shrink-0 border-r border-[var(--border-color)] overflow-hidden"
          style={{ width: 'var(--track-label-width)' }}
        >
          <div className="my-auto">
            {/* Video track header spacer */}
            <div className="border-b border-dashed border-[var(--border-color)]/30" style={{ height: '4px' }} />

            {/* Video track labels */}
            {videoTracks.map(renderTrackLabel)}

            {/* Audio track labels */}
            {audioTracks.map(renderTrackLabel)}

            {/* Audio track footer spacer */}
            <div className="border-b border-dashed border-[var(--border-color)]/30" style={{ height: '4px' }} />
          </div>
        </div>

        {/* ── Scrollable content (both axes, flex col for margin-auto centering) ── */}
        <div
          ref={scrollRef}
          className="flex flex-col flex-1 overflow-auto relative"
          onScroll={handleContentScroll}
        >
          <div className="my-auto relative" style={{ width: `${computedWidth}px`, minWidth: '100%' }}>
            {/* Video track header spacer */}
            <div className="border-b border-dashed border-[var(--border-color)]/30" style={{ height: '4px' }} />

            {/* Video tracks */}
            {videoTracks.map(renderTrackRow)}

            {/* Audio tracks */}
            {audioTracks.map(renderTrackRow)}

            {/* Audio track footer spacer */}
            <div className="border-b border-dashed border-[var(--border-color)]/30" style={{ height: '4px' }} />

            {/* Playhead (spans full height) */}
            <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${playheadPx}px` }}>
              <div
                className="absolute -left-[5px] -top-[6px]"
                style={{
                  width: 0, height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: '6px solid var(--playhead-color)',
                }}
              />
              <div className="h-full w-0.5" style={{ backgroundColor: 'var(--playhead-color)' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
