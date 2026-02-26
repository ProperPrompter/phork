'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  X, Video, Volume2, Image, Film,
  Clock, HardDrive, CalendarDays, Cpu,
  Sparkles, DollarSign, Shield, Link2, Download, Tag,
  PanelRightOpen, PanelRightClose, Plus,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════ */

interface AssetPreviewModalProps {
  asset: any;
  onClose: () => void;
  onUseInTimeline?: (assetId: string, type: string) => void;
}

interface DetailRowData {
  icon: React.ElementType;
  label: string;
  value: string | React.ReactNode;
  mono?: boolean;
}

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—';
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatLatency(provenance: any): string {
  if (!provenance?.timestamps?.queued_at || !provenance?.timestamps?.finished_at) return '—';
  const start = new Date(provenance.timestamps.queued_at).getTime();
  const end = new Date(provenance.timestamps.finished_at).getTime();
  const sec = (end - start) / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; colorVar: string; subtleVar: string }> = {
  video: { icon: Video, label: 'Video', colorVar: '--type-video', subtleVar: '--type-video-subtle' },
  audio: { icon: Volume2, label: 'Audio', colorVar: '--type-audio', subtleVar: '--type-audio-subtle' },
  image: { icon: Image, label: 'Image', colorVar: '--type-image', subtleVar: '--type-image-subtle' },
  render: { icon: Film, label: 'Render', colorVar: '--type-render', subtleVar: '--type-render-subtle' },
};

/* ═══════════════════════════════════════════════════
   DetailRow — single key/value row
   ═══════════════════════════════════════════════════ */

function DetailRow({ icon: Icon, label, value, mono }: DetailRowData) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon size={13} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {label}
        </div>
        <div className={`mt-0.5 text-[13px] text-[var(--text-primary)] ${mono ? 'font-mono text-xs break-all' : ''}`}>
          {value || '—'}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DetailSection — titled group of rows (extensible)
   ═══════════════════════════════════════════════════ */

function DetailSection({ title, rows }: { title: string; rows: DetailRowData[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-4">
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
        {title}
      </h4>
      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 divide-y divide-[var(--border-color)]">
        {rows.map((row, i) => (
          <DetailRow key={`${row.label}-${i}`} {...row} />
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════
   Section builders — build rows from asset data.
   Add new builders here for new detail types.
   ═══════════════════════════════════════════════════ */

function buildFileDetailsRows(asset: any, config: typeof TYPE_CONFIG[string]): DetailRowData[] {
  const rows: DetailRowData[] = [
    { icon: Tag, label: 'Type', value: config.label },
    { icon: HardDrive, label: 'Size', value: formatBytes(asset.bytes) },
  ];
  if (asset.durationMs) {
    rows.push({ icon: Clock, label: 'Duration', value: formatDuration(asset.durationMs) });
  }
  if (asset.width || asset.height) {
    rows.push({ icon: Image, label: 'Dimensions', value: `${asset.width} × ${asset.height}` });
  }
  rows.push({ icon: CalendarDays, label: 'Created', value: formatDate(asset.createdAt) });
  if (asset.mimeType) {
    rows.push({ icon: HardDrive, label: 'MIME Type', value: asset.mimeType, mono: true });
  }
  rows.push({ icon: Link2, label: 'Asset ID', value: asset.id, mono: true });
  return rows;
}

function buildGenerationRows(prov: any): DetailRowData[] {
  if (!prov) return [];
  const rows: DetailRowData[] = [];

  rows.push({
    icon: Cpu, label: 'Model', value: (
      <span className="flex items-center gap-2">
        <span className="font-medium">{prov.model || '—'}</span>
        {prov.model_version && (
          <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]">
            v{prov.model_version}
          </span>
        )}
      </span>
    ),
  });

  rows.push({ icon: Sparkles, label: 'Provider', value: prov.provider });

  if (prov.input?.prompt) {
    rows.push({
      icon: Sparkles, label: 'Prompt', value: (
        <div className="max-h-24 overflow-y-auto rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 text-xs leading-relaxed">
          {prov.input.prompt}
        </div>
      ),
    });
  }

  if (prov.input?.negative_prompt) {
    rows.push({
      icon: Sparkles, label: 'Negative Prompt', value: (
        <div className="max-h-16 overflow-y-auto rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 text-xs leading-relaxed" style={{ color: 'var(--error)' }}>
          {prov.input.negative_prompt}
        </div>
      ),
    });
  }

  if (prov.input?.seed != null) {
    rows.push({ icon: Cpu, label: 'Seed', value: String(prov.input.seed), mono: true });
  }

  if (prov.input?.params && Object.keys(prov.input.params).length > 0) {
    rows.push({
      icon: Cpu, label: 'Parameters', value: (
        <div className="max-h-20 overflow-y-auto rounded-lg bg-[var(--bg-tertiary)] px-3 py-2 font-mono text-[11px] leading-relaxed">
          {Object.entries(prov.input.params).map(([k, v]) => (
            <div key={k}>
              <span className="text-[var(--text-secondary)]">{k}:</span>{' '}
              <span className="text-[var(--text-primary)]">{String(v)}</span>
            </div>
          ))}
        </div>
      ),
    });
  }

  return rows;
}

function buildCostRows(prov: any): DetailRowData[] {
  if (!prov || (!prov.cost && !prov.timestamps)) return [];
  const rows: DetailRowData[] = [];

  if (prov.cost) {
    rows.push({
      icon: DollarSign, label: 'Credits Used', value: (
        <span className="font-medium text-[var(--accent)]">{prov.cost.credits_charged}</span>
      ),
    });
    if (prov.cost.provider_cost_usd_est != null) {
      rows.push({ icon: DollarSign, label: 'Est. Provider Cost', value: `$${prov.cost.provider_cost_usd_est.toFixed(4)}` });
    }
  }

  rows.push({ icon: Clock, label: 'Generation Time', value: formatLatency(prov) });

  if (prov.timestamps?.queued_at) {
    rows.push({ icon: CalendarDays, label: 'Queued At', value: formatDate(prov.timestamps.queued_at) });
  }

  return rows;
}

function buildSafetyRows(prov: any): DetailRowData[] {
  if (!prov?.safety) return [];
  const rows: DetailRowData[] = [];

  rows.push({
    icon: Shield, label: 'Status', value: (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
        style={{
          backgroundColor: prov.safety.blocked ? 'var(--error-subtle)' : 'var(--success-subtle)',
          color: prov.safety.blocked ? 'var(--error)' : 'var(--success)',
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: prov.safety.blocked ? 'var(--error)' : 'var(--success)' }}
        />
        {prov.safety.blocked ? 'Blocked' : 'Passed'}
      </span>
    ),
  });

  if (prov.safety.events?.length > 0) {
    rows.push({ icon: Shield, label: 'Events', value: prov.safety.events.join(', ') });
  }

  return rows;
}

function buildUpstreamRows(asset: any): DetailRowData[] {
  if (!asset.upstreamAssetIds?.length) return [];
  return asset.upstreamAssetIds.map((uid: string, i: number) => ({
    icon: Link2, label: `Source ${i + 1}`, value: uid, mono: true,
  }));
}

/* ═══════════════════════════════════════════════════
   Modal
   ═══════════════════════════════════════════════════ */

export function AssetPreviewModal({ asset, onClose, onUseInTimeline }: AssetPreviewModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const config = TYPE_CONFIG[asset.type] || TYPE_CONFIG.video;
  const Icon = config.icon;
  const prov = asset.provenance;
  const [detailsOpen, setDetailsOpen] = useState(true);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const canUseInTimeline = onUseInTimeline &&
    (asset.type === 'video' || asset.type === 'audio' || asset.type === 'image' || asset.type === 'render');

  /* Build all detail sections — add new ones here */
  const sections: { title: string; rows: DetailRowData[] }[] = [
    { title: 'File Details', rows: buildFileDetailsRows(asset, config) },
    { title: 'Generation Details', rows: buildGenerationRows(prov) },
    { title: 'Cost & Performance', rows: buildCostRows(prov) },
    { title: 'Safety', rows: buildSafetyRows(prov) },
    { title: 'Upstream Assets', rows: buildUpstreamRows(asset) },
  ];

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-[90vw] flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--bg-secondary)] shadow-2xl">

        {/* ── Header ───────────────────────────────────── */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-color)] px-5 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `var(${config.subtleVar})` }}
            >
              <Icon size={16} style={{ color: `var(${config.colorVar})` }} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {config.label} Asset
              </span>
              <span className="font-mono text-xs text-[var(--text-muted)]">
                {asset.id?.slice(0, 8)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              title={detailsOpen ? 'Hide details' : 'Show details'}
            >
              {detailsOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
            {asset.storageUrl && (
              <a
                href={asset.downloadUrl || asset.storageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
                title="Download"
              >
                <Download size={18} />
              </a>
            )}
            {canUseInTimeline && (
              <button
                onClick={() => {
                  onUseInTimeline!(asset.id, asset.type);
                  onClose();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--highlight-subtle)] text-[var(--highlight)] transition-colors hover:bg-[var(--highlight)] hover:text-white"
                title="Add to Project"
              >
                <Plus size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body: side-by-side ────────────────────────── */}
        <div className="flex min-h-0 flex-1">

          {/* Preview pane — expands to fill when details collapsed */}
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-[var(--bg-primary)] p-5">
            <div className="flex h-full w-full items-center justify-center rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
              <Icon size={64} className="opacity-20" style={{ color: `var(${config.colorVar})` }} />
            </div>
          </div>

          {/* Details panel — slides in/out */}
          <div
            className={`shrink-0 border-l border-[var(--border-color)] transition-all duration-300 ease-in-out overflow-hidden ${
              detailsOpen ? 'w-[360px] opacity-100' : 'w-0 opacity-0 border-l-0'
            }`}
          >
            <div className="flex h-full w-[360px] flex-col">
              <div className="flex-1 overflow-y-auto p-4">
                {sections.map((section) => (
                  <DetailSection key={section.title} title={section.title} rows={section.rows} />
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
