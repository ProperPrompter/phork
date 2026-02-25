'use client';

import { Video, Music, Image, Film, Check } from 'lucide-react';

interface AssetItem {
  id: string;
  type: string;
  mimeType: string | null;
  bytes: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

interface AssetGridProps {
  assets: AssetItem[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  emptyMessage?: string;
}

function getIcon(type: string) {
  switch (type) {
    case 'video': return <Video size={16} />;
    case 'audio': return <Music size={16} />;
    case 'image': return <Image size={16} />;
    case 'render': return <Film size={16} />;
    default: return <Film size={16} />;
  }
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function AssetGrid({ assets, selectable, selectedIds, onToggleSelect, emptyMessage }: AssetGridProps) {
  if (!assets.length) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-[var(--text-secondary)]">
        {emptyMessage || 'No assets'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {assets.map((asset) => {
        const isSelected = selectedIds?.has(asset.id);
        return (
          <button
            key={asset.id}
            onClick={() => selectable && onToggleSelect?.(asset.id)}
            className="relative rounded-lg border p-3 text-left text-xs transition-colors"
            style={{
              borderColor: isSelected ? 'var(--accent)' : 'var(--border-color)',
              backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.1)' : 'var(--bg-tertiary)',
              cursor: selectable ? 'pointer' : 'default',
            }}
          >
            {selectable && isSelected && (
              <div className="absolute right-1.5 top-1.5 rounded-full bg-[var(--accent)] p-0.5 text-white">
                <Check size={10} />
              </div>
            )}
            <div className="mb-1 flex items-center gap-1.5 text-[var(--text-secondary)]">
              {getIcon(asset.type)}
              <span className="capitalize">{asset.type}</span>
            </div>
            <div className="text-[var(--text-secondary)]">
              {asset.durationMs && <span>{(asset.durationMs / 1000).toFixed(1)}s</span>}
              {asset.width && asset.height && <span> {asset.width}x{asset.height}</span>}
              {asset.bytes && <span> {formatBytes(asset.bytes)}</span>}
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-[var(--text-secondary)]" style={{ opacity: 0.5 }}>
              {asset.id.substring(0, 8)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
