'use client';

import { useCallback, useRef } from 'react';
import { useProjectStore } from '@/stores/project';
import { PreviewPlayer } from './PreviewPlayer';
import { TimelineTrack } from './TimelineTrack';
import { LibraryPanel } from './LibraryPanel';
import { Save, Play, Loader2, ZoomIn, ZoomOut, GripHorizontal } from 'lucide-react';
import type { ShotSnapshot } from '@phork/shared';

interface TimelineViewProps {
  projectId: string;
  workspaceId: string;
  renderAssetId: string | null;
  renderDownloadUrl: string | null;
  onSave: () => void;
  onRender: () => void;
  onUseInTimeline: (assetId: string, type: string) => void;
  saving: boolean;
  rendering: boolean;
}

export function TimelineView({
  projectId, workspaceId, renderAssetId, renderDownloadUrl,
  onSave, onRender, onUseInTimeline, saving, rendering,
}: TimelineViewProps) {
  const {
    shots, selectedShotIndex, zoomLevel, playheadMs, tracks, timelineHeight,
    selectShot, addShot, removeShot, reorderShots,
    setZoomLevel, setPlayheadMs, setActiveSection,
    addTrack, removeTrack, setTimelineHeight,
  } = useProjectStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const handleAddShot = () => {
    const newShot: ShotSnapshot = {
      shot_id: crypto.randomUUID(),
      visual_asset_id: null,
      audio_asset_id: null,
      duration_ms: 4000,
      trim_in_ms: 0,
      trim_out_ms: 4000,
      subtitle: null,
    };
    addShot(newShot);
    selectShot(shots.length);
  };

  const handleDropAsset = useCallback((assetId: string, assetType: string, durationMs: number | null, trackType: 'video' | 'audio') => {
    const duration = durationMs ?? 4000;
    const newShot: ShotSnapshot = {
      shot_id: crypto.randomUUID(),
      visual_asset_id: (trackType === 'video' && (assetType === 'video' || assetType === 'image' || assetType === 'render')) ? assetId : null,
      audio_asset_id: (trackType === 'audio' && assetType === 'audio') ? assetId : null,
      duration_ms: duration,
      trim_in_ms: 0,
      trim_out_ms: duration,
      subtitle: null,
    };
    addShot(newShot);
    selectShot(shots.length);
  }, [addShot, selectShot, shots.length]);

  const handleSwitchToGenerate = useCallback(() => {
    setActiveSection('generate');
  }, [setActiveSection]);

  /* Ctrl+Wheel zoom */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -20 : 20;
      setZoomLevel(zoomLevel + delta);
    }
  }, [zoomLevel, setZoomLevel]);

  /* ── Resizable drag handle ── */
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const startY = e.clientY;
    const startHeight = timelineHeight;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startY - ev.clientY;
      setTimelineHeight(startHeight + delta);
    };

    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [timelineHeight, setTimelineHeight]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* LEFT column */}
      <div ref={containerRef} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Preview player (takes remaining space) */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <PreviewPlayer
            shots={shots}
            renderAssetId={renderAssetId}
            renderDownloadUrl={renderDownloadUrl}
          />
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="flex h-2 flex-shrink-0 cursor-row-resize items-center justify-center border-t border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <GripHorizontal size={14} className="text-[var(--text-muted)]" />
        </div>

        {/* Timeline area (resizable height) */}
        <div className="flex flex-col flex-shrink-0 overflow-hidden" style={{ height: `${timelineHeight}px` }}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-t border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-1.5 flex-shrink-0">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Timeline
              <span className="ml-2 font-normal normal-case">
                {shots.length} shot{shots.length !== 1 ? 's' : ''} · {(shots.reduce((s, sh) => s + sh.duration_ms, 0) / 1000).toFixed(1)}s
              </span>
            </h3>

            {/* Zoom */}
            <div className="ml-3 flex items-center gap-1">
              <button
                onClick={() => setZoomLevel(zoomLevel - 20)}
                disabled={zoomLevel <= 20}
                className="rounded p-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={13} />
              </button>
              <input
                type="range"
                min={20} max={500} step={10}
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-20 accent-[var(--accent)]"
              />
              <button
                onClick={() => setZoomLevel(zoomLevel + 20)}
                disabled={zoomLevel >= 500}
                className="rounded p-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-30 transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={13} />
              </button>
            </div>

            <div className="flex-1" />

            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-tertiary)] disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onRender}
              disabled={rendering || shots.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {rendering ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {rendering ? 'Rendering...' : 'Render'}
            </button>
          </div>

          {/* Multi-track timeline */}
          <div className="flex-1 min-h-0 overflow-hidden" onWheel={handleWheel}>
            <TimelineTrack
              shots={shots}
              tracks={tracks}
              selectedIndex={selectedShotIndex}
              onSelect={selectShot}
              onAdd={handleAddShot}
              onRemove={removeShot}
              onReorder={reorderShots}
              onAddTrack={addTrack}
              onRemoveTrack={removeTrack}
              onDropAsset={handleDropAsset}
              zoomLevel={zoomLevel}
              playheadMs={playheadMs}
              onPlayheadChange={setPlayheadMs}
              onSwitchToGenerate={handleSwitchToGenerate}
            />
          </div>
        </div>
      </div>

      {/* RIGHT column: Library (full height) */}
      <LibraryPanel
        projectId={projectId}
        workspaceId={workspaceId}
        onUseInTimeline={onUseInTimeline}
      />
    </div>
  );
}
