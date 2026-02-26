'use client';

import { useEffect, useState, useCallback } from 'react';
import { Package, Plus, GripVertical, Video, Music, Image, Film } from 'lucide-react';
import { api } from '@/lib/api';

interface UpstreamLibraryProps {
  parentProjectId: string;
  forkedFromCommitId: string;
  onUseInTimeline?: (assetId: string, type: string) => void;
}

function getIcon(type: string) {
  switch (type) {
    case 'video': return <Video size={14} />;
    case 'audio': return <Music size={14} />;
    case 'image': return <Image size={14} />;
    case 'render': return <Film size={14} />;
    default: return <Film size={14} />;
  }
}

export function UpstreamLibrary({ parentProjectId, forkedFromCommitId, onUseInTimeline }: UpstreamLibraryProps) {
  const [releases, setReleases] = useState<any[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<any>(null);
  const [releaseAssets, setReleaseAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReleases();
  }, [parentProjectId]);

  const loadReleases = async () => {
    try {
      const res = await api.get(`/projects/${parentProjectId}/releases`);
      setReleases(res.data || []);
      if (res.data?.length > 0) {
        await loadReleaseDetail(res.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load upstream releases:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReleaseDetail = async (releaseId: string) => {
    try {
      const res = await api.get(`/projects/${parentProjectId}/releases/${releaseId}`);
      setSelectedRelease(res.release);
      setReleaseAssets(res.assets || []);
    } catch (err) {
      console.error('Failed to load release detail:', err);
    }
  };

  if (loading) {
    return <div className="p-4 text-sm text-[var(--text-secondary)]">Loading upstream...</div>;
  }

  if (!releases.length) {
    return (
      <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
        No source releases available from the upstream project.
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-[var(--border-color)] p-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--accent)]">
          <Package size={12} /> Upstream Library
        </div>
        <select
          value={selectedRelease?.id || ''}
          onChange={(e) => loadReleaseDetail(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs outline-none"
        >
          {releases.map((r: any) => (
            <option key={r.id} value={r.id}>
              {r.name} ({r.assetCount} assets)
            </option>
          ))}
        </select>
      </div>
      {releaseAssets.length === 0 ? (
        <div className="flex items-center justify-center p-8 text-sm text-[var(--text-secondary)]">
          No assets in this release
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-3">
          {releaseAssets.map((asset: any) => (
            <button
              key={asset.id}
              draggable
              onDragStart={(e) => {
                const payload = JSON.stringify({
                  id: asset.id,
                  type: asset.type,
                  durationMs: asset.durationMs ?? null,
                });
                e.dataTransfer.setData('application/asset-json', payload);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => onUseInTimeline?.(asset.id, asset.type)}
              className="group relative rounded-lg border p-3 text-left text-xs transition-all hover:border-[var(--accent)] hover:shadow-md cursor-grab active:cursor-grabbing"
              style={{
                borderColor: 'var(--border-color)',
                backgroundColor: 'var(--bg-tertiary)',
              }}
              title={`Click to add to timeline or drag to a track · ${asset.id.substring(0, 8)}`}
            >
              <div className="mb-1 flex items-center gap-1.5 text-[var(--text-secondary)]">
                {getIcon(asset.type)}
                <span className="capitalize">{asset.type}</span>
                <GripVertical size={10} className="ml-auto opacity-0 group-hover:opacity-60 transition-opacity" />
              </div>
              <div className="text-[var(--text-secondary)]">
                {asset.durationMs && <span>{(asset.durationMs / 1000).toFixed(1)}s</span>}
                {asset.width && asset.height && <span> {asset.width}x{asset.height}</span>}
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-[var(--text-secondary)]" style={{ opacity: 0.5 }}>
                {asset.id.substring(0, 8)}
              </div>
              {/* "Use" overlay on hover */}
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--accent)]/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-medium text-white">
                  <Plus size={10} className="inline -mt-0.5 mr-0.5" />
                  Use
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
