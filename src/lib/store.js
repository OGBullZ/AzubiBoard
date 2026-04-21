// ============================================================
//  store.js – App State (ohne externe Dependencies)
//  Pfad: src/lib/store.js
// ============================================================
import { create } from 'zustand';
import { persistData } from '../utils';

export const useAppStore = create((set, get) => ({
  data: null,
  currentUser: null,

  setData: (data) => {
    set({ data });
    try { persistData(data); } catch {}
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  updateProject: (projectId, updates) => {
    const { data } = get();
    if (!data) return;
    const newData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === projectId ? { ...p, ...updates } : p
      ),
    };
    set({ data: newData });
    try { persistData(newData); } catch {}
  },
}));
