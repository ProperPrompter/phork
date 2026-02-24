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
