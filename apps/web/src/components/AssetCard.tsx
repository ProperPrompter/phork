'use client';

import { Video, Volume2, Image, Film } from 'lucide-react';

interface AssetCardProps {
  asset: any;
  onClick?: (asset: any) => void;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; colorVar: string }> = {
  video: { icon: Video, colorVar: '--type-video' },
  audio: { icon: Volume2, colorVar: '--type-audio' },
  image: { icon: Image, colorVar: '--type-image' },
  render: { icon: Film, colorVar: '--type-render' },
};

export function AssetCard({ asset, onClick }: AssetCardProps) {
  const config = TYPE_CONFIG[asset.type] || TYPE_CONFIG.video;
  const Icon = config.icon;

  const handleDragStart = (e: React.DragEvent) => {
    const payload = JSON.stringify({
      id: asset.id,
      type: asset.type,
      durationMs: asset.durationMs ?? null,
    });
    e.dataTransfer.setData('application/asset-json', payload);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick?.(asset)}
      className="group relative w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] text-left transition-all hover:border-[var(--card-hover-border)] hover:shadow-lg hover:shadow-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {/* Thumbnail area */}
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-[var(--bg-tertiary)] transition-colors group-hover:bg-[var(--bg-tertiary)]/80">
        <Icon
          size={28}
          className="opacity-50 transition-opacity group-hover:opacity-80"
          style={{ color: `var(${config.colorVar})` }}
        />
      </div>

      {/* Subtle type indicator on hover */}
      <div className="absolute bottom-1.5 left-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm">
          {asset.type?.charAt(0).toUpperCase() + asset.type?.slice(1)}
        </span>
      </div>
    </button>
  );
}
