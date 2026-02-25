// ── Enums ──
export type AssetType = 'image' | 'video' | 'audio' | 'render';
export type JobType = 'gen_image' | 'gen_video' | 'gen_audio' | 'render';
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked';
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type Visibility = 'private';
export type ForkLicense = 'no_forks' | 'forks_nc' | 'forks_revshare' | 'sharealike';
export type SafetyAction = 'blocked' | 'warned';

// ── Timeline Snapshot ──
export interface ShotSnapshot {
  shot_id: string;
  visual_asset_id: string | null;
  audio_asset_id: string | null;
  duration_ms: number;
  trim_in_ms: number;
  trim_out_ms: number;
  subtitle: string | null;
}

export interface TimelineSnapshot {
  timeline: ShotSnapshot[];
}

// ── Provenance ──
export interface ProvenanceManifest {
  job_id: string;
  provider: string;
  model: string;
  model_version: string;
  input: {
    prompt: string;
    negative_prompt?: string;
    seed?: number;
    params?: Record<string, unknown>;
  };
  safety: {
    blocked: boolean;
    events?: string[];
  };
  cost: {
    provider_cost_usd_est: number;
    credits_charged: number;
  };
  timestamps: {
    queued_at: string;
    started_at: string;
    finished_at: string;
  };
  upstream?: Array<{
    asset_id: string;
    relation: string;
  }>;
}

// ── Phase 2A Types ──
export type IncludeMode = 'used_only' | 'used_plus_selected';
export type AnalyticsEvent = 'viewer_open' | 'fork_click' | 'fork_created' | 'fork_rendered' | 'release_used';

export interface PublishedRender {
  id: string;
  projectId: string;
  renderAssetId: string;
  commitId: string;
  title: string | null;
  description: string | null;
  shareToken: string | null;
  publishedAt: string;
  publishedBy: string;
}

export interface SourceRelease {
  id: string;
  projectId: string;
  name: string;
  includeMode: IncludeMode;
  license: ForkLicense;
  createdAt: string;
  createdBy: string;
  assetCount?: number;
  assets?: AssetSummary[];
}

export interface AssetSummary {
  id: string;
  type: AssetType;
  mimeType: string | null;
  bytes: number | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  defaultAspectRatio: string;
  shots: Array<{
    shot_id: string;
    duration_ms: number;
    subtitle: string | null;
    label: string;
  }>;
}

// ── API Types ──
export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
