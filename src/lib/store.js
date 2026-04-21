// src/lib/store.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loadData, persistData } from '../utils';

const SK = 'azubi_pm_v7';

export const useAppStore = create(
  persist(
    (set, get) => ({
      data: loadData(),
      currentUser: null,
      setData: (newData) => set({ data: newData }),
      setCurrentUser: (user) => set({ currentUser: user }),
      updateProject: (projectId, updates) => {
        const { data, setData } = get();
        const updatedProjects = data.projects.map(p =>
          p.id === projectId ? { ...p, ...updates } : p
        );
        setData({ ...data, projects: updatedProjects });
      },
    }),
    { name: SK, partialize: (state) => ({ data: state.data, currentUser: state.currentUser }) }
  )
);