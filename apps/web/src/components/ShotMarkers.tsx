'use client';

import type { ShotSnapshot } from '@phork/shared';

interface ShotMarkersProps {
  shots: ShotSnapshot[];
  totalDurationMs: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function ShotMarkers({ shots, totalDurationMs, selectedIndex, onSelect }: ShotMarkersProps) {
  if (!shots.length || totalDurationMs <= 0) return null;

  return (
    <div className="mt-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>Shot markers</span>
        <span>{shots.length} shots</span>
      </div>
      <div className="flex h-8 overflow-hidden rounded-lg border border-[var(--border-color)]">
        {shots.map((shot, i) => {
          const widthPct = (shot.duration_ms / totalDurationMs) * 100;
          const isSelected = selectedIndex === i;
          return (
            <button
              key={shot.shot_id}
              onClick={() => onSelect(i)}
              className="relative flex items-center justify-center transition-colors"
              style={{
                width: `${widthPct}%`,
                minWidth: '24px',
                backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-tertiary)',
                borderRight: i < shots.length - 1 ? '1px solid var(--border-color)' : 'none',
              }}
              title={`Shot ${i + 1} (${(shot.duration_ms / 1000).toFixed(1)}s)`}
            >
              <span
                className="text-[10px] font-medium"
                style={{ color: isSelected ? 'white' : 'var(--text-secondary)' }}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
      {selectedIndex !== null && shots[selectedIndex] && (
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Shot {selectedIndex + 1} — {(shots[selectedIndex].duration_ms / 1000).toFixed(1)}s
          {shots[selectedIndex].subtitle && ` — "${shots[selectedIndex].subtitle}"`}
        </p>
      )}
    </div>
  );
}
