import { create } from 'zustand';
import { DEFAULT_MODEL_ID } from '@/lib/modelRegistry';

export interface GenerationJob {
  id: string;
  type: 'video' | 'audio' | 'image';
  modelId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'blocked';
  prompt: string;
  assetId: string | null;
  feedKey: string;                    // content-based key (prompt + params hash)
  paramSnapshot: Record<string, any>; // full form values for retry
  variationIndex: number;
  createdAt: number;
  completedAt: number | null;
}

interface StudioState {
  /* ── Model selection ───────────────────── */
  selectedModel: string;
  setSelectedModel: (id: string) => void;

  /* ── Legacy activeTool (kept for backward-compat) */
  activeTool: 'video' | 'audio' | null;
  setActiveTool: (tool: 'video' | 'audio' | null) => void;

  /* ── Job tracking ──────────────────────── */
  activeJobs: GenerationJob[];
  addJob: (job: GenerationJob) => void;
  updateJob: (id: string, updates: Partial<GenerationJob>) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;

  /* ── Form restore (retry) ──────────────── */
  restoreFormValues: { modelId: string; values: Record<string, any> } | null;
  setRestoreFormValues: (v: { modelId: string; values: Record<string, any> } | null) => void;

  /* ── Library ───────────────────────────── */
  libraryFilter: 'all' | 'video' | 'audio' | 'vault';
  searchQuery: string;
  libraryAssets: any[];
  assetCounts: { total: number; video: number; audio: number; vault: number };
  libraryVersion: number;

  setLibraryFilter: (filter: 'all' | 'video' | 'audio' | 'vault') => void;
  setSearchQuery: (query: string) => void;
  setLibraryAssets: (assets: any[]) => void;
  setAssetCounts: (counts: { total: number; video: number; audio: number; vault: number }) => void;
  bumpLibraryVersion: () => void;
}

export const useStudioStore = create<StudioState>((set) => ({
  /* ── Model ─────────────────────────────── */
  selectedModel: DEFAULT_MODEL_ID,
  setSelectedModel: (id) => set({ selectedModel: id }),

  /* ── Legacy ────────────────────────────── */
  activeTool: null,
  setActiveTool: (tool) => set({ activeTool: tool }),

  /* ── Jobs ──────────────────────────────── */
  activeJobs: [],

  addJob: (job) => set((state) => ({
    activeJobs: [job, ...state.activeJobs],
  })),

  updateJob: (id, updates) => set((state) => ({
    activeJobs: state.activeJobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
  })),

  removeJob: (id) => set((state) => ({
    activeJobs: state.activeJobs.filter((j) => j.id !== id),
  })),

  clearCompletedJobs: () => set((state) => ({
    activeJobs: state.activeJobs.filter((j) => j.status === 'queued' || j.status === 'running'),
  })),

  /* ── Form restore ──────────────────────── */
  restoreFormValues: null,
  setRestoreFormValues: (v) => set({ restoreFormValues: v }),

  /* ── Library ───────────────────────────── */
  libraryFilter: 'all',
  searchQuery: '',
  libraryAssets: [],
  assetCounts: { total: 0, video: 0, audio: 0, vault: 0 },
  libraryVersion: 0,

  setLibraryFilter: (filter) => set({ libraryFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setLibraryAssets: (assets) => set({ libraryAssets: assets }),
  setAssetCounts: (counts) => set({ assetCounts: counts }),
  bumpLibraryVersion: () => set((state) => ({ libraryVersion: state.libraryVersion + 1 })),
}));

/* ── Feed key helper ─────────────────────── */
/** Compute a deterministic key from model + prompt + params for feed grouping */
export function computeFeedKey(modelId: string, prompt: string, params: Record<string, any>): string {
  const { variations, ...rest } = params; // exclude variations count from the key
  const sorted = Object.keys(rest).sort().map((k) => `${k}=${rest[k]}`).join('&');
  return `${modelId}:${prompt.trim()}:${sorted}`;
}

/* ── Feed section helper ────────────────── */
export interface FeedSection {
  feedKey: string;
  prompt: string;
  modelId: string;
  paramSnapshot: Record<string, any>;
  latestCreatedAt: number;
  jobs: GenerationJob[];
}

/** Group jobs by feedKey into sections, sorted newest-first */
export function buildFeedSections(jobs: GenerationJob[]): FeedSection[] {
  const map = new Map<string, FeedSection>();
  for (const job of jobs) {
    if (!map.has(job.feedKey)) {
      map.set(job.feedKey, {
        feedKey: job.feedKey,
        prompt: job.prompt,
        modelId: job.modelId,
        paramSnapshot: job.paramSnapshot,
        latestCreatedAt: job.createdAt,
        jobs: [],
      });
    }
    const section = map.get(job.feedKey)!;
    section.jobs.push(job);
    if (job.createdAt > section.latestCreatedAt) {
      section.latestCreatedAt = job.createdAt;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.latestCreatedAt - a.latestCreatedAt);
}
