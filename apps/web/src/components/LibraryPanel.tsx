'use client';

import { useEffect, useCallback, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useStudioStore } from '@/stores/studio';
import { useProjectStore } from '@/stores/project';
import { AssetCard } from './AssetCard';
import { AssetPreviewModal } from './AssetPreviewModal';

interface LibraryPanelProps {
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

export function LibraryPanel({ projectId, workspaceId, onUseInTimeline }: LibraryPanelProps) {
  const {
    libraryFilter, setLibraryFilter,
    searchQuery, setSearchQuery,
    libraryAssets, setLibraryAssets,
    assetCounts, setAssetCounts,
    libraryVersion,
  } = useStudioStore();

  const { project } = useProjectStore();
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
        const classification = libraryFilter === 'all' ? 'all' : 'used';
        const res = await api.get(
          `/assets?workspaceId=${workspaceId}&projectId=${projectId}&classification=${classification}`,
        );
        let assets = res.data || [];
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

  const filteredAssets = searchQuery
    ? libraryAssets.filter((a: any) =>
        a.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.type?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : libraryAssets;

  return (
    <div className="flex h-full w-[320px] flex-shrink-0 flex-col border-l border-[var(--border-color)] bg-[var(--bg-secondary)]">
      {/* Project name */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[var(--border-color)] px-3 py-2.5">
        <h2 className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-primary)]">
          {project?.name || 'Project'}
        </h2>
        {project?.parentProjectId && (
          <span className="flex-shrink-0 rounded-full bg-[var(--accent)]/20 px-2 py-0.5 text-[9px] text-[var(--accent)]">Forked</span>
        )}
      </div>

      {/* Library header */}
      <div className="flex flex-shrink-0 items-center justify-between px-3 pt-2.5 pb-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Library ({assetCounts.total})
        </h3>
      </div>

      {/* Filter pills */}
      <div className="flex flex-shrink-0 items-center gap-1 px-3 py-2">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f.id}
            onClick={() => setLibraryFilter(f.id)}
            className={`rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
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
      <div className="relative flex-shrink-0 px-3 pb-2">
        <Search size={13} className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search assets..."
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] py-1.5 pl-7 pr-3 text-xs outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Single-column scrollable grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {filteredAssets.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-secondary)]">
            {searchQuery ? 'No matching assets' : 'No assets yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
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
