// ============================================================
//  dataService.js – Datenzugriff (localStorage oder API)
//  Pfad: src/lib/dataService.js
// ============================================================
import { loadData, persistData } from './utils';

const USE_API  = false;
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || 'http://localhost/azubiboard/api';

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
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:    JSON.stringify(newData),
      });
      if (res.ok) return await res.json();
    } catch {}
    persistData(newData);
    return newData;
  },
};
