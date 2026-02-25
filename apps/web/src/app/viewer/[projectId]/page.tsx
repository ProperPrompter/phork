'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { ShotMarkers } from '@/components/ShotMarkers';
import { ViewerForkDialog } from '@/components/ViewerForkDialog';
import { GitFork, Play, Clock, User, Package } from 'lucide-react';
import type { ShotSnapshot } from '@phork/shared';

interface ViewerData {
  project: { id: string; name: string; description: string | null; forkLicense: string } | null;
  publishedRender: any;
  downloadUrl: string;
  commitSnapshot: { timeline: ShotSnapshot[] };
  creator: { displayName: string } | null;
  totalDurationMs: number;
  shotCount: number;
  releases: any[];
}

export default function ViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const shareToken = searchParams.get('shareToken');
  const { token } = useAuthStore();

  const [data, setData] = useState<ViewerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedShotIndex, setSelectedShotIndex] = useState<number | null>(null);
  const [showFork, setShowFork] = useState(false);

  useEffect(() => {
    loadViewer();
  }, [projectId]);

  const loadViewer = async () => {
    try {
      let url = `/publish/${projectId}`;
      if (shareToken) url += `?shareToken=${shareToken}`;
      const res = await api.get(url);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load viewer');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[var(--text-secondary)]">Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error || 'Not found'}</p>
        {!token && (
          <button
            onClick={() => router.push('/login')}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white hover:bg-[var(--accent-hover)]"
          >
            Login to view
          </button>
        )}
      </div>
    );
  }

  const forkable = data.project?.forkLicense !== 'no_forks';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--border-color)] px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-xl font-bold">
            <span className="text-[var(--accent)]">Phork</span> Viewer
          </h1>
          {token && (
            <button
              onClick={() => router.push('/studio')}
              className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
            >
              Back to Studio
            </button>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl p-6">
        {/* Title */}
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">{data.publishedRender.title || data.project?.name}</h2>
          {data.publishedRender.description && (
            <p className="mt-1 text-[var(--text-secondary)]">{data.publishedRender.description}</p>
          )}
        </div>

        {/* Video Player */}
        <div className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-black">
          <video
            src={data.downloadUrl}
            controls
            className="w-full"
            style={{ maxHeight: '480px' }}
          >
            Your browser does not support the video tag.
          </video>
        </div>

        {/* Shot Markers */}
        <ShotMarkers
          shots={data.commitSnapshot.timeline}
          totalDurationMs={data.totalDurationMs}
          selectedIndex={selectedShotIndex}
          onSelect={setSelectedShotIndex}
        />

        {/* Metadata + Actions */}
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[var(--text-secondary)]">
          {data.creator && (
            <span className="flex items-center gap-1">
              <User size={14} /> {data.creator.displayName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={14} /> {(data.totalDurationMs / 1000).toFixed(1)}s
          </span>
          <span className="flex items-center gap-1">
            <Play size={14} /> {data.shotCount} shots
          </span>

          {forkable && token && (
            <button
              onClick={() => setShowFork(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
            >
              <GitFork size={14} /> Fork from here
            </button>
          )}
          {!forkable && (
            <span className="ml-auto text-xs text-[var(--text-secondary)]">Forking disabled</span>
          )}
        </div>

        {/* Source Releases */}
        {data.releases.length > 0 && (
          <div className="mt-6 rounded-xl border border-[var(--border-color)] p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
              <Package size={14} className="text-[var(--accent)]" /> Available Source Releases
            </h3>
            <div className="space-y-2">
              {data.releases.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)] p-3 text-sm">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <span className="ml-2 text-xs text-[var(--text-secondary)]">
                      {r.includeMode === 'used_only' ? 'Used assets only' : 'Used + extras'}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{r.license}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Fork Dialog */}
      {showFork && data.project && (
        <ViewerForkDialog
          projectId={data.project.id}
          commitId={data.publishedRender.commitId}
          shotIndex={selectedShotIndex}
          shotCount={data.shotCount}
          releases={data.releases}
          onClose={() => setShowFork(false)}
          onForked={(newProjectId) => {
            setShowFork(false);
            router.push(`/studio/${newProjectId}`);
          }}
        />
      )}
    </div>
  );
}
