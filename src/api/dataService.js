// src/api/dataService.js
import { USE_API, API_BASE } from '../lib/constants';
import { loadData, persistData } from '../utils';

export const dataService = {
  async getData() {
    if (!USE_API) return loadData();
    try {
      const res = await fetch(`${API_BASE}/data`, { credentials: 'include' });
      if (!res.ok) throw new Error('API-Fehler');
      return await res.json();
    } catch {
      return loadData();
    }
  },
  async saveData(newData) {
    if (!USE_API) {
      persistData(newData);
      return newData;
    }
    try {
      const res = await fetch(`${API_BASE}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newData),
      });
      return res.ok ? await res.json() : (persistData(newData), newData);
    } catch {
      persistData(newData);
      return newData;
    }
  },
};