import { create } from 'zustand';
import type { ShotSnapshot } from '@phork/shared';

export interface Track {
  id: string;
  type: 'video' | 'audio';
  label: string;
}

interface ProjectState {
  project: any | null;
  headCommit: any | null;
  shots: ShotSnapshot[];
  selectedShotIndex: number | null;
  activeSection: 'generate' | 'timeline';
  zoomLevel: number;
  playheadMs: number;
  tracks: Track[];
  timelineHeight: number;
  setProject: (project: any) => void;
  setHeadCommit: (commit: any) => void;
  setShots: (shots: ShotSnapshot[]) => void;
  selectShot: (index: number | null) => void;
  setActiveSection: (section: 'generate' | 'timeline') => void;
  setZoomLevel: (level: number) => void;
  setPlayheadMs: (ms: number) => void;
  addTrack: (type: 'video' | 'audio') => void;
  removeTrack: (id: string) => void;
  setTimelineHeight: (h: number) => void;
  addShot: (shot: ShotSnapshot) => void;
  removeShot: (index: number) => void;
  updateShot: (index: number, shot: ShotSnapshot) => void;
  reorderShots: (fromIndex: number, toIndex: number) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  headCommit: null,
  shots: [],
  selectedShotIndex: null,
  activeSection: 'generate',
  zoomLevel: 100,
  playheadMs: 0,
  tracks: [
    { id: 'video-1', type: 'video', label: 'Video 1' },
    { id: 'audio-1', type: 'audio', label: 'Audio 1' },
  ],
  timelineHeight: 260,

  setProject: (project) => set({ project }),
  setHeadCommit: (headCommit) => set({ headCommit }),
  setShots: (shots) => set({ shots }),
  selectShot: (index) => set({ selectedShotIndex: index }),
  setActiveSection: (section) => set({ activeSection: section }),
  setZoomLevel: (level) => set({ zoomLevel: Math.max(20, Math.min(500, level)) }),
  setPlayheadMs: (ms) => set({ playheadMs: Math.max(0, ms) }),
  addTrack: (type) => set((state) => {
    const count = state.tracks.filter((t) => t.type === type).length + 1;
    const label = `${type === 'video' ? 'Video' : 'Audio'} ${count}`;
    return { tracks: [...state.tracks, { id: `${type}-${Date.now()}`, type, label }] };
  }),
  removeTrack: (id) => set((state) => ({
    tracks: state.tracks.filter((t) => t.id !== id),
  })),
  setTimelineHeight: (h) => set({ timelineHeight: Math.max(140, Math.min(600, h)) }),

  addShot: (shot) => set((state) => ({ shots: [...state.shots, shot] })),

  removeShot: (index) => set((state) => {
    const newShots = [...state.shots];
    newShots.splice(index, 1);
    const newSelectedIndex = state.selectedShotIndex !== null
      ? state.selectedShotIndex >= newShots.length
        ? newShots.length > 0 ? newShots.length - 1 : null
        : state.selectedShotIndex > index
          ? state.selectedShotIndex - 1
          : state.selectedShotIndex
      : null;
    return { shots: newShots, selectedShotIndex: newSelectedIndex };
  }),

  updateShot: (index, shot) => set((state) => {
    const newShots = [...state.shots];
    newShots[index] = shot;
    return { shots: newShots };
  }),

  reorderShots: (fromIndex, toIndex) => set((state) => {
    const newShots = [...state.shots];
    const [moved] = newShots.splice(fromIndex, 1);
    newShots.splice(toIndex, 0, moved);
    return { shots: newShots, selectedShotIndex: toIndex };
  }),
}));
