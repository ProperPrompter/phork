'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, GitFork } from 'lucide-react';

interface ForkDialogProps {
  projectId: string;
  onClose: () => void;
  onForked: (newProjectId: string) => void;
}

export function ForkDialog({ projectId, onClose, onForked }: ForkDialogProps) {
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(null);
  const [forkName, setForkName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get(`/projects/${projectId}/commits`).then((res) => {
      setCommits(res.data);
      if (res.data.length > 0) {
        setSelectedCommitId(res.data[0].id); // Default to most recent commit (head)
      }
    });
  }, [projectId]);

  const handleFork = async () => {
    if (!selectedCommitId || !forkName.trim()) return;
    setLoading(true);
    try {
      const res = await api.post(`/projects/${projectId}/fork`, {
        fromCommitId: selectedCommitId,
        name: forkName.trim(),
      });
      onForked(res.project.id);
    } catch (err: any) {
      alert(err.message || 'Fork failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <GitFork size={18} /> Fork Project
          </h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--bg-tertiary)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">New Project Name</label>
            <input
              type="text"
              value={forkName}
              onChange={(e) => setForkName(e.target.value)}
              placeholder="My Fork"
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">Fork From Commit</label>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border-color)]">
              {commits.map((commit) => (
                <button
                  key={commit.id}
                  onClick={() => setSelectedCommitId(commit.id)}
                  className={`w-full p-3 text-left text-sm border-b border-[var(--border-color)] last:border-b-0 ${
                    selectedCommitId === commit.id ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-tertiary)]'
                  }`}
                >
                  <div className="font-medium">{commit.message}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {new Date(commit.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-[var(--border-color)] px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)]"
            >
              Cancel
            </button>
            <button
              onClick={handleFork}
              disabled={loading || !forkName.trim() || !selectedCommitId}
              className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {loading ? 'Forking...' : 'Fork'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
