import { create } from 'zustand';
import type { ShotSnapshot } from '@phork/shared';

interface ProjectState {
  project: any | null;
  headCommit: any | null;
  shots: ShotSnapshot[];
  selectedShotIndex: number | null;
  setProject: (project: any) => void;
  setHeadCommit: (commit: any) => void;
  setShots: (shots: ShotSnapshot[]) => void;
  selectShot: (index: number | null) => void;
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

  setProject: (project) => set({ project }),
  setHeadCommit: (headCommit) => set({ headCommit }),
  setShots: (shots) => set({ shots }),
  selectShot: (index) => set({ selectedShotIndex: index }),

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
