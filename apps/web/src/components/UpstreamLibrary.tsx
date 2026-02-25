'use client';

import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { api } from '@/lib/api';
import { AssetGrid } from './AssetGrid';

interface UpstreamLibraryProps {
  parentProjectId: string;
  forkedFromCommitId: string;
}

export function UpstreamLibrary({ parentProjectId, forkedFromCommitId }: UpstreamLibraryProps) {
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
      <AssetGrid assets={releaseAssets} emptyMessage="No assets in this release" />
    </div>
  );
}
