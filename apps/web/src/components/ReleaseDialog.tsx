'use client';

import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import { api } from '@/lib/api';
import { AssetGrid } from './AssetGrid';

interface ReleaseDialogProps {
  projectId: string;
  workspaceId: string;
  onClose: () => void;
  onCreated: (release: any) => void;
}

export function ReleaseDialog({ projectId, workspaceId, onClose, onCreated }: ReleaseDialogProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [includeMode, setIncludeMode] = useState<'used_only' | 'used_plus_selected'>('used_only');
  const [license, setLicense] = useState('forks_nc');
  const [vaultAssets, setVaultAssets] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (step === 2 && includeMode === 'used_plus_selected') {
      loadVaultAssets();
    }
  }, [step]);

  const loadVaultAssets = async () => {
    try {
      const res = await api.get(`/assets?workspaceId=${workspaceId}&projectId=${projectId}&classification=vault`);
      setVaultAssets(res.data);
    } catch (err) {
      console.error('Failed to load vault assets:', err);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.post(`/projects/${projectId}/releases`, {
        name: name.trim(),
        includeMode,
        license,
        selectedAssetIds: includeMode === 'used_plus_selected' ? Array.from(selectedIds) : [],
      });
      onCreated(res.release);
    } catch (err: any) {
      setError(err.message || 'Failed to create release');
    } finally {
      setCreating(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Create Source Release</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--bg-tertiary)]">
            <X size={18} />
          </button>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-[var(--text-secondary)]">Release name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Release v1"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--text-secondary)]">Include mode</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] p-3 text-sm">
                  <input type="radio" name="mode" value="used_only" checked={includeMode === 'used_only'} onChange={() => setIncludeMode('used_only')} className="accent-[var(--accent)]" />
                  Used assets only
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] p-3 text-sm">
                  <input type="radio" name="mode" value="used_plus_selected" checked={includeMode === 'used_plus_selected'} onChange={() => setIncludeMode('used_plus_selected')} className="accent-[var(--accent)]" />
                  Used + selected unused (vault picks)
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-[var(--text-secondary)]">Fork license</label>
              <select
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="forks_nc">Non-commercial</option>
                <option value="forks_revshare">Revenue share</option>
                <option value="sharealike">Share-alike</option>
              </select>
            </div>

            <div className="flex gap-3">
              {includeMode === 'used_plus_selected' ? (
                <button
                  onClick={() => setStep(2)}
                  disabled={!name.trim()}
                  className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  Next: Pick vault assets
                </button>
              ) : (
                <button
                  onClick={handleCreate}
                  disabled={creating || !name.trim()}
                  className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Release'}
                </button>
              )}
              <button onClick={onClose} className="rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)]">Cancel</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Select vault assets to include in this release ({selectedIds.size} selected)
            </p>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--border-color)]">
              <AssetGrid
                assets={vaultAssets}
                selectable
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                emptyMessage="No unused assets in vault"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)]">Back</button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
              >
                {creating ? 'Creating...' : `Create Release (${selectedIds.size} extras)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
