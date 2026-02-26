'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, ShieldAlert, Clock, Film, Volume2, Image } from 'lucide-react';
import type { GenerationJob } from '@/stores/studio';

interface JobCardProps {
  job: GenerationJob;
  onClick?: (job: GenerationJob) => void;
}

const TYPE_ICONS: Record<string, typeof Film> = {
  video: Film,
  audio: Volume2,
  image: Image,
};

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function JobCard({ job, onClick }: JobCardProps) {
  const [elapsed, setElapsed] = useState(0);

  // Tick elapsed time for running/queued jobs
  useEffect(() => {
    if (job.status === 'queued' || job.status === 'running') {
      const tick = () => setElapsed(Date.now() - job.createdAt);
      tick();
      const iv = setInterval(tick, 1000);
      return () => clearInterval(iv);
    }
    // For completed jobs, show total time
    if (job.completedAt) {
      setElapsed(job.completedAt - job.createdAt);
    }
  }, [job.status, job.createdAt, job.completedAt]);

  const isClickable = job.status === 'succeeded' && job.assetId;
  const Icon = TYPE_ICONS[job.type] || Film;

  return (
    <button
      onClick={() => isClickable && onClick?.(job)}
      disabled={!isClickable}
      className={`group relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-xl border transition-all ${
        job.status === 'succeeded'
          ? 'border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:border-[var(--card-hover-border)] cursor-pointer'
          : job.status === 'failed' || job.status === 'blocked'
            ? 'border-[var(--error)]/30 bg-[var(--error-subtle)]'
            : 'border-[var(--border-color)] bg-[var(--bg-secondary)]'
      }`}
    >
      {/* Status content */}
      {job.status === 'queued' && (
        <>
          <Loader2
            size={28}
            className="animate-spin"
            style={{ color: 'var(--highlight)' }}
          />
          <span className="mt-2 text-xs text-[var(--text-secondary)]">Queued...</span>
        </>
      )}

      {job.status === 'running' && (
        <>
          <Loader2
            size={28}
            className="animate-spin"
            style={{ color: 'var(--accent)' }}
          />
          <span className="mt-2 text-xs text-[var(--text-secondary)]">Generating...</span>
        </>
      )}

      {job.status === 'succeeded' && (
        <>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--success-subtle)', color: 'var(--success)' }}
          >
            <CheckCircle2 size={22} />
          </div>
          <span className="mt-2 text-xs font-medium text-[var(--success)]">Complete</span>
        </>
      )}

      {job.status === 'failed' && (
        <>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--error-subtle)', color: 'var(--error)' }}
          >
            <XCircle size={22} />
          </div>
          <span className="mt-2 text-xs font-medium text-[var(--error)]">Failed</span>
        </>
      )}

      {job.status === 'blocked' && (
        <>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--error-subtle)', color: 'var(--error)' }}
          >
            <ShieldAlert size={22} />
          </div>
          <span className="mt-2 text-xs font-medium text-[var(--error)]">Blocked</span>
          <span className="mt-0.5 text-[9px] text-[var(--text-muted)]">Safety policy</span>
        </>
      )}

      {/* Time badge — bottom-right */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white/80">
        <Clock size={10} />
        {formatElapsed(elapsed)}
      </div>

      {/* Type badge — top-left */}
      <div className="absolute top-2 left-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5">
        <Icon size={10} className="text-white/70" />
        <span className="text-[10px] text-white/70">
          #{job.variationIndex + 1}
        </span>
      </div>
    </button>
  );
}
