'use client';

import { useState } from 'react';
import { X, Globe, Link } from 'lucide-react';
import { api } from '@/lib/api';

interface PublishDialogProps {
  projectId: string;
  renderAssetId: string;
  commitId: string;
  projectName: string;
  onClose: () => void;
  onPublished: (pub: any) => void;
}

export function PublishDialog({ projectId, renderAssetId, commitId, projectName, onClose, onPublished }: PublishDialogProps) {
  const [title, setTitle] = useState(projectName);
  const [description, setDescription] = useState('');
  const [enableShareLink, setEnableShareLink] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    try {
      const res = await api.post('/publish', {
        projectId,
        renderAssetId,
        commitId,
        title: title.trim() || projectName,
        description: description.trim() || undefined,
        enableShareLink,
      });
      onPublished(res.publishedRender);
    } catch (err: any) {
      setError(err.message || 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={18} className="text-[var(--accent)]" />
            <h2 className="text-lg font-semibold">Publish Render</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--bg-tertiary)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--text-secondary)]">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Describe this published cut..."
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enableShareLink}
              onChange={(e) => setEnableShareLink(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <Link size={14} />
            Enable unlisted share link
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex-1 rounded-lg bg-[var(--accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {publishing ? 'Publishing...' : 'Publish'}
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
