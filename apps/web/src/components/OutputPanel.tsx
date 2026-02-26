'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { useStudioStore, type GenerationJob } from '@/stores/studio';
import { JobCard } from './JobCard';
import { LibraryGrid } from './LibraryGrid';
import { AssetPreviewModal } from './AssetPreviewModal';

interface OutputPanelProps {
  projectId: string;
  workspaceId: string;
  onUseInTimeline: (assetId: string, type: string) => void;
}

interface JobGroup {
  feedKey: string;
  prompt: string;
  createdAt: number;
  jobs: GenerationJob[];
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function JobGroupSection({ group }: { group: JobGroup }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-3">
      {/* Group header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
      >
        {open ? (
          <ChevronDown size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0 text-[var(--text-muted)]" />
        )}
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-primary)]">
          {group.prompt}
        </span>
        <span className="flex-shrink-0 text-[10px] text-[var(--text-muted)]">
          {formatTime(group.createdAt)}
        </span>
      </button>

      {/* Job cards grid */}
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-3 px-1">
          {group.jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OutputPanel({ projectId, workspaceId, onUseInTimeline }: OutputPanelProps) {
  const { activeJobs, clearCompletedJobs } = useStudioStore();

  // Group jobs by feedKey, ordered by most recent first
  const jobGroups = useMemo<JobGroup[]>(() => {
    const map = new Map<string, JobGroup>();
    for (const job of activeJobs) {
      if (!map.has(job.feedKey)) {
        map.set(job.feedKey, {
          feedKey: job.feedKey,
          prompt: job.prompt,
          createdAt: job.createdAt,
          jobs: [],
        });
      }
      map.get(job.feedKey)!.jobs.push(job);
    }
    // Sort groups by creation time (newest first)
    return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
  }, [activeJobs]);

  const hasJobs = activeJobs.length > 0;
  const hasCompletedJobs = activeJobs.some(
    (j) => j.status === 'succeeded' || j.status === 'failed' || j.status === 'blocked',
  );

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      {/* Active jobs section */}
      {hasJobs && (
        <div className="flex-shrink-0 border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Active Generations
            </h3>
            {hasCompletedJobs && (
              <button
                onClick={clearCompletedJobs}
                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <RefreshCw size={10} />
                Clear done
              </button>
            )}
          </div>
          <div className="max-h-[45vh] overflow-y-auto px-3 pb-3">
            {jobGroups.map((group) => (
              <JobGroupSection key={group.feedKey} group={group} />
            ))}
          </div>
        </div>
      )}

      {/* Library section (scrollable, fills remaining space) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LibraryGrid
          projectId={projectId}
          workspaceId={workspaceId}
          onUseInTimeline={onUseInTimeline}
        />
      </div>
    </div>
  );
}
