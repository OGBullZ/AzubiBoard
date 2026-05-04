// ============================================================
//  dataService.js – Datenzugriff (localStorage ODER PHP-API)
//  Umschalten: VITE_USE_API=true in .env
// ============================================================
import { loadData, persistData } from './utils';
import { authHeader, clearToken } from './auth';

const USE_API  = import.meta.env.VITE_USE_API === 'true';
// VITE_API_BASE_URL explizit setzen, oder aus Basispfad ableiten
const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/azubiboard/';
const API_BASE  = import.meta.env.VITE_API_BASE_URL || `${BASE_PATH}api`;

/** Fetch-Wrapper: hängt Auth-Header an, behandelt 401 global */
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();   // → zurück zum Login
  }
  return res;
}

export const dataService = {
  // ── App-Daten laden ───────────────────────────────────────
  async getData() {
    if (!USE_API) return loadData();
    try {
      const res = await apiFetch('/data');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return loadData();    // Fallback auf localStorage
    }
  },

  // ── App-Daten speichern ───────────────────────────────────
  async saveData(newData) {
    if (!USE_API) { persistData(newData); return newData; }
    try {
      const res = await apiFetch('/data', {
        method: 'POST',
        body:   JSON.stringify(newData),
      });
      if (res.ok) { persistData(newData); return newData; }
    } catch {}
    persistData(newData);   // Fallback
    return newData;
  },

  // ── Login ─────────────────────────────────────────────────
  async login(email, password) {
    if (!USE_API) return null;   // lokaler Modus: null → App macht's selbst
    const res = await fetch(`${API_BASE}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Login fehlgeschlagen (${res.status})`);
    }
    return await res.json();  // { token, user }
  },

  // ── Registrierung ─────────────────────────────────────────
  async register(name, email, password) {
    if (!USE_API) return null;
    const res = await fetch(`${API_BASE}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Registrierung fehlgeschlagen (${res.status})`);
    }
    return await res.json();  // { token, user }
  },
};
