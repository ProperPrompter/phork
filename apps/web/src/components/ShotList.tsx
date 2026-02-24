'use client';

import type { ShotSnapshot } from '@phork/shared';
import { Plus, Trash2, GripVertical, Image, Music } from 'lucide-react';

interface ShotListProps {
  shots: ShotSnapshot[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
}

export function ShotList({ shots, selectedIndex, onSelect, onAdd, onRemove, onReorder }: ShotListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] p-3">
        <h2 className="text-sm font-semibold">Shots ({shots.length})</h2>
        <button
          onClick={onAdd}
          className="rounded-lg bg-[var(--accent)] p-1.5 text-white hover:bg-[var(--accent-hover)]"
          title="Add shot"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {shots.map((shot, index) => (
          <button
            key={shot.shot_id}
            onClick={() => onSelect(index)}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm transition-colors ${
              selectedIndex === index
                ? 'border border-[var(--accent)] bg-[var(--accent)]/10'
                : 'border border-transparent hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <GripVertical size={14} className="flex-shrink-0 text-[var(--text-secondary)]" />
            <div className="flex-1 min-w-0">
              <div className="font-medium">Shot {index + 1}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`flex items-center gap-1 text-xs ${shot.visual_asset_id ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
                  <Image size={10} /> {shot.visual_asset_id ? 'Ready' : 'Empty'}
                </span>
                <span className={`flex items-center gap-1 text-xs ${shot.audio_asset_id ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
                  <Music size={10} /> {shot.audio_asset_id ? 'Ready' : 'None'}
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">{(shot.duration_ms / 1000).toFixed(1)}s</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(index); }}
              className="flex-shrink-0 rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--error)]/20 hover:text-[var(--error)]"
            >
              <Trash2 size={12} />
            </button>
          </button>
        ))}
        {shots.length === 0 && (
          <div className="p-4 text-center text-xs text-[var(--text-secondary)]">
            No shots yet. Click + to add one.
          </div>
        )}
      </div>
    </div>
  );
}
