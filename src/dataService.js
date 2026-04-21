// ============================================================
//  dataService.js – Datenzugriff (localStorage oder API)
//  Pfad: src/api/dataService.js
// ============================================================

const USE_API  = false;
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || 'http://localhost/azubiboard/api';

const STORAGE_KEY = 'azubiboard_v2';

function getDefaultData() {
  return {
    users: [
      { id: 'u1', name: 'Max Müller',   email: 'ausbilder@firma.de', password: '1234', role: 'ausbilder', apprenticeship_year: null },
      { id: 'u2', name: 'Anna Schmidt', email: 'anna@azubi.de',      password: '1234', role: 'azubi',     apprenticeship_year: 2   },
    ],
    projects:       [],
    groups:         [],
    reports:        [],
    calendarEvents: [],
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...getDefaultData(), ...JSON.parse(saved) };
  } catch {}
  return getDefaultData();
}

function persistData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Speichern fehlgeschlagen:', e);
  }
}

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
