'use client';

import { useState } from 'react';
import { X, GitFork } from 'lucide-react';
import { api } from '@/lib/api';

interface Release {
  id: string;
  name: string;
  includeMode: string;
  assetCount?: number;
}

interface ViewerForkDialogProps {
  projectId: string;
  commitId: string;
  shotIndex: number | null;
  shotCount: number;
  releases: Release[];
  onClose: () => void;
  onForked: (newProjectId: string) => void;
}

export function ViewerForkDialog({ projectId, commitId, shotIndex, shotCount, releases, onClose, onForked }: ViewerForkDialogProps) {
  const [name, setName] = useState('');
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState('');

  const handleFork = async () => {
    if (!name.trim()) return;
    setForking(true);
    setError('');

    try {
      // Record fork_click analytics
      try {
        await api.post('/analytics/event', { event: 'fork_click', projectId });
      } catch { /* non-blocking */ }

      const body: any = {
        fromCommitId: commitId,
        name: name.trim(),
      };

      if (shotIndex !== null) {
        body.truncateAtShotIndex = shotIndex;
      }
      if (selectedReleaseId) {
        body.sourceReleaseId = selectedReleaseId;
      }

      const res = await api.post(`/projects/${projectId}/fork`, body);
      onForked(res.project.id);
    } catch (err: any) {
      setError(err.message || 'Fork failed');
    } finally {
      setForking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitFork size={18} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Fork Project</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--bg-tertiary)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {shotIndex !== null && (
            <div className="rounded-lg bg-[var(--bg-secondary)] p-3 text-sm">
              Forking from <strong>Shot {shotIndex + 1}</strong> of {shotCount}
              {shotIndex < shotCount - 1 && (
                <span className="text-[var(--text-secondary)]"> — timeline will be truncated to {shotIndex + 1} shot{shotIndex > 0 ? 's' : ''}</span>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">Fork name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleFork()}
              placeholder="My remix"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>

          {releases.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-[var(--text-secondary)]">Source Release (optional)</label>
              <select
                value={selectedReleaseId || ''}
                onChange={(e) => setSelectedReleaseId(e.target.value || null)}
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">No release (timeline only)</option>
                {releases.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.includeMode === 'used_only' ? 'used assets' : 'used + extras'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleFork}
              disabled={forking || !name.trim()}
              className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {forking ? 'Forking...' : 'Fork'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--border-color)] px-4 py-2.5 text-sm hover:bg-[var(--bg-tertiary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
