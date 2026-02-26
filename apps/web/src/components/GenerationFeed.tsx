'use client';

import { useMemo, useCallback, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { useStudioStore, buildFeedSections, type GenerationJob, type FeedSection } from '@/stores/studio';
import { MODEL_REGISTRY } from '@/lib/modelRegistry';
import { JobCard } from './JobCard';
import { AssetPreviewModal } from './AssetPreviewModal';

interface GenerationFeedProps {
  projectId: string;
  workspaceId: string;
  onUseInTimeline: (assetId: string, type: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/* ── Single feed section ──────────────────────── */

function FeedSectionBlock({
  section,
  onRetry,
  onUseInTimeline,
}: {
  section: FeedSection;
  onRetry: (section: FeedSection) => void;
  onUseInTimeline: (assetId: string, type: string) => void;
}) {
  const [previewAsset, setPreviewAsset] = useState<any>(null);

  const handleJobClick = async (job: GenerationJob) => {
    if (job.assetId) {
      try {
        const asset = await api.get(`/assets/${job.assetId}`);
        setPreviewAsset(asset);
      } catch {
        // ignore fetch errors
      }
    }
  };

  const modelName = MODEL_REGISTRY[section.modelId]?.name || section.modelId;
  const activeCount = section.jobs.filter(
    (j) => j.status === 'queued' || j.status === 'running',
  ).length;

  return (
    <div className="mb-6">
      {/* Section header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--text-primary)]">
          {section.prompt}
        </span>
        <span className="flex-shrink-0 rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]">
          {modelName}
        </span>
        {activeCount > 0 && (
          <span className="flex-shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
            {activeCount} running
          </span>
        )}
        <span className="flex-shrink-0 text-[10px] text-[var(--text-muted)]">
          {formatTime(section.latestCreatedAt)}
        </span>
        <button
          onClick={() => onRetry(section)}
          title="Retry with these settings"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 4-column grid of job cards */}
      <div className="grid grid-cols-4 gap-3">
        {section.jobs.map((job) => (
          <JobCard key={job.id} job={job} onClick={handleJobClick} />
        ))}
      </div>

      {/* Asset preview modal */}
      {previewAsset && (
        <AssetPreviewModal
          asset={previewAsset}
          onClose={() => setPreviewAsset(null)}
          onUseInTimeline={onUseInTimeline}
        />
      )}
    </div>
  );
}

/* ── Main feed component ──────────────────────── */

export function GenerationFeed({ projectId, workspaceId, onUseInTimeline }: GenerationFeedProps) {
  const { activeJobs, setRestoreFormValues } = useStudioStore();

  const feedSections = useMemo(() => buildFeedSections(activeJobs), [activeJobs]);

  const handleRetry = useCallback(
    (section: FeedSection) => {
      setRestoreFormValues({
        modelId: section.modelId,
        values: { ...section.paramSnapshot },
      });
    },
    [setRestoreFormValues],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Scrollable feed */}
      <div className="flex-1 overflow-y-auto p-4">
        {feedSections.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            Generate something to see results here
          </div>
        ) : (
          feedSections.map((section) => (
            <FeedSectionBlock
              key={section.feedKey}
              section={section}
              onRetry={handleRetry}
              onUseInTimeline={onUseInTimeline}
            />
          ))
        )}
      </div>
    </div>
  );
}
