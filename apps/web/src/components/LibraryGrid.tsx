'use client';

import { useEffect, useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useStudioStore } from '@/stores/studio';
import { AssetCard } from './AssetCard';
import { AssetPreviewModal } from './AssetPreviewModal';

interface LibraryGridProps {
  projectId: string;
  workspaceId: string;
  onUseInTimeline?: (assetId: string, type: string) => void;
}

const FILTER_OPTIONS: { id: 'all' | 'video' | 'audio' | 'vault'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'vault', label: 'Vault' },
];

export function LibraryGrid({ projectId, workspaceId, onUseInTimeline }: LibraryGridProps) {
  const {
    libraryFilter, setLibraryFilter,
    searchQuery, setSearchQuery,
    libraryAssets, setLibraryAssets,
    assetCounts, setAssetCounts,
    libraryVersion,
  } = useStudioStore();

  const [selectedAsset, setSelectedAsset] = useState<any>(null);

  const loadAssets = useCallback(async () => {
    try {
      if (libraryFilter === 'vault') {
        const res = await api.get(
          `/assets?workspaceId=${workspaceId}&projectId=${projectId}&classification=vault`,
        );
        setLibraryAssets(res.data || []);
        const currentCounts = useStudioStore.getState().assetCounts;
        setAssetCounts({ ...currentCounts, vault: (res.data || []).length });
      } else {
        // Load all assets for workspace/project
        const classification = libraryFilter === 'all' ? 'all' : 'used';
        const res = await api.get(
          `/assets?workspaceId=${workspaceId}&projectId=${projectId}&classification=${classification}`,
        );
        let assets = res.data || [];
        // Client-side type filter
        if (libraryFilter === 'video') {
          assets = assets.filter((a: any) => a.type === 'video' || a.type === 'image');
        } else if (libraryFilter === 'audio') {
          assets = assets.filter((a: any) => a.type === 'audio');
        }
        setLibraryAssets(assets);
        setAssetCounts({
          total: res.usedCount + res.vaultCount || assets.length,
          video: assets.filter((a: any) => a.type === 'video' || a.type === 'image').length,
          audio: assets.filter((a: any) => a.type === 'audio').length,
          vault: res.vaultCount || 0,
        });
      }
    } catch (err) {
      console.error('Failed to load library assets:', err);
    }
  }, [workspaceId, projectId, libraryFilter]);

  useEffect(() => {
    if (workspaceId && projectId) {
      loadAssets();
    }
  }, [loadAssets, workspaceId, projectId, libraryVersion]);

  // Filter by search query
  const filteredAssets = searchQuery
    ? libraryAssets.filter((a: any) =>
        a.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.type?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : libraryAssets;

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Library ({assetCounts.total})
        </h3>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 px-4 pb-2">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => setLibraryFilter(f.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              libraryFilter === f.id
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative px-4 pb-3">
        <Search size={14} className="absolute left-6.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search assets..."
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] py-1.5 pl-8 pr-3 text-xs outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredAssets.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
            {searchQuery ? 'No matching assets' : 'No assets yet. Use the panel on the left to generate.'}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filteredAssets.map((asset: any) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onClick={setSelectedAsset}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {selectedAsset && (
        <AssetPreviewModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onUseInTimeline={onUseInTimeline}
        />
      )}
    </div>
  );
}
