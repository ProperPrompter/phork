'use client';

import { useState, useEffect } from 'react';
import { Clock, Video, Music, Type, X, ArrowRight } from 'lucide-react';
import type { ShotSnapshot } from '@phork/shared';

interface ShotPropertiesPanelProps {
  shot: ShotSnapshot;
  index: number;
  onUpdate: (index: number, shot: ShotSnapshot) => void;
  onAssignAsset: (type: 'video' | 'audio') => void;
}

function truncateId(id: string, len = 8): string {
  return id.length > len ? id.slice(0, len) + '\u2026' : id;
}

export function ShotPropertiesPanel({
  shot,
  index,
  onUpdate,
  onAssignAsset,
}: ShotPropertiesPanelProps) {
  const [durationSec, setDurationSec] = useState<string>(
    (shot.duration_ms / 1000).toFixed(1),
  );

  useEffect(() => {
    setDurationSec((shot.duration_ms / 1000).toFixed(1));
  }, [shot.duration_ms]);

  const commitDuration = () => {
    const parsed = parseFloat(durationSec);
    if (Number.isNaN(parsed) || parsed < 0.1) {
      setDurationSec((shot.duration_ms / 1000).toFixed(1));
      return;
    }
    const ms = Math.round(parsed * 1000);
    if (ms !== shot.duration_ms) {
      onUpdate(index, { ...shot, duration_ms: ms, trim_out_ms: ms });
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationSec(e.target.value);
  };

  const handleDurationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitDuration();
      (e.target as HTMLInputElement).blur();
    }
  };

  const removeVisual = () => {
    onUpdate(index, { ...shot, visual_asset_id: null });
  };

  const removeAudio = () => {
    onUpdate(index, { ...shot, audio_asset_id: null });
  };

  const handleSubtitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate(index, { ...shot, subtitle: e.target.value || null });
  };

  return (
    <div
      className="flex items-stretch gap-3 border-t px-3 py-2"
      style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        maxHeight: '120px',
      }}
    >
      {/* Header label */}
      <div className="flex flex-shrink-0 flex-col justify-center">
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Shot {index + 1}
        </span>
      </div>

      {/* Duration */}
      <div className="flex flex-col justify-center gap-0.5">
        <label
          className="flex items-center gap-1 text-[10px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Clock size={10} />
          Duration
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={durationSec}
            onChange={handleDurationChange}
            onBlur={commitDuration}
            onKeyDown={handleDurationKeyDown}
            className="w-16 rounded border px-1.5 py-0.5 text-xs outline-none"
            style={{
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            sec
          </span>
        </div>
      </div>

      {/* Visual Asset */}
      <div className="flex flex-col justify-center gap-0.5">
        <label
          className="flex items-center gap-1 text-[10px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Video size={10} />
          Visual
        </label>
        {shot.visual_asset_id ? (
          <div
            className="flex items-center gap-1 rounded border px-1.5 py-0.5"
            style={{
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <span
              className="max-w-[72px] truncate text-xs"
              style={{ color: 'var(--text-primary)' }}
              title={shot.visual_asset_id}
            >
              {truncateId(shot.visual_asset_id)}
            </span>
            <button
              onClick={removeVisual}
              className="flex-shrink-0 rounded p-0.5 transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              title="Remove visual asset"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAssignAsset('video')}
            className="flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            Assign
            <ArrowRight size={10} />
          </button>
        )}
      </div>

      {/* Audio Asset */}
      <div className="flex flex-col justify-center gap-0.5">
        <label
          className="flex items-center gap-1 text-[10px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Music size={10} />
          Audio
        </label>
        {shot.audio_asset_id ? (
          <div
            className="flex items-center gap-1 rounded border px-1.5 py-0.5"
            style={{
              background: 'var(--bg-tertiary)',
              borderColor: 'var(--border-color)',
            }}
          >
            <span
              className="max-w-[72px] truncate text-xs"
              style={{ color: 'var(--text-primary)' }}
              title={shot.audio_asset_id}
            >
              {truncateId(shot.audio_asset_id)}
            </span>
            <button
              onClick={removeAudio}
              className="flex-shrink-0 rounded p-0.5 transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              title="Remove audio asset"
            >
              <X size={10} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => onAssignAsset('audio')}
            className="flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-xs transition-colors hover:opacity-80"
            style={{
              borderColor: 'var(--border-color)',
              color: 'var(--accent)',
            }}
          >
            Assign
            <ArrowRight size={10} />
          </button>
        )}
      </div>

      {/* Subtitle */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <label
          className="flex items-center gap-1 text-[10px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Type size={10} />
          Subtitle
        </label>
        <input
          type="text"
          value={shot.subtitle ?? ''}
          onChange={handleSubtitleChange}
          placeholder="Caption text..."
          className="w-full rounded border px-1.5 py-0.5 text-xs outline-none"
          style={{
            background: 'var(--bg-tertiary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
      </div>
    </div>
  );
}
