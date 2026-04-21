// ============================================================
//  store.js – App State (Zustand)
//  Pfad: src/lib/store.js
// ============================================================

import { create } from 'zustand';
import { dataService } from '../api/dataService';
import { persistData } from '../utils';

export const useAppStore = create((set, get) => ({
  data: null,
  currentUser: null,

  setData: (data) => {
    set({ data });
    persistData(data);
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  // Projekt aktualisieren
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
    persistData(newData);
  },
}));
