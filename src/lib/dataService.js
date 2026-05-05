// ============================================================
//  dataService.js – Datenzugriff (localStorage ODER PHP-API)
//  Umschalten: VITE_USE_API=true in .env
// ============================================================
import { loadData, persistData } from './utils';
import { authHeader, clearToken, isTokenValid } from './auth';

const USE_API  = import.meta.env.VITE_USE_API === 'true';
// VITE_API_BASE_URL explizit setzen, oder aus Basispfad ableiten
const BASE_PATH = import.meta.env.VITE_BASE_PATH || '/azubiboard/';
const API_BASE  = import.meta.env.VITE_API_BASE_URL || `${BASE_PATH}api`;

/**
 * Fetch-Wrapper: hängt Auth-Header an und behandelt 401 über Event
 * (kein window.reload mehr — das übernimmt App.jsx via Event-Listener).
 */
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
    // App.jsx lauscht auf dieses Event und setzt currentUser → null
    window.dispatchEvent(new Event('azubiboard:unauthorized'));
  }
  return res;
}

export const dataService = {
  // ── App-Daten laden ───────────────────────────────────────
  async getData() {
    if (!USE_API) return loadData();
    // Kein gültiger Token → direkt auf localStorage zurückfallen
    // (verhindert 401-Schleife beim Start ohne Login)
    if (!isTokenValid()) return loadData();
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
    // Nur speichern wenn eingeloggt
    if (!isTokenValid()) { persistData(newData); return newData; }
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

  // ── Aktuellen Nutzer von Server laden (JWT-Session-Restore) ─
  async getMe() {
    if (!USE_API || !isTokenValid()) return null;
    try {
      const res = await apiFetch('/auth/me');
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // ── Nutzerliste von Server laden ──────────────────────────
  async getUsers() {
    if (!USE_API || !isTokenValid()) return null;
    try {
      const res = await apiFetch('/users');
      if (!res.ok) return null;
      // Integer-IDs als String normalisieren (für Kompatibilität mit Blob)
      const users = await res.json();
      return users.map(u => ({ ...u, id: String(u.id) }));
    } catch {
      return null;
    }
  },

  // ── Nutzer anlegen (Ausbilder only) ───────────────────────
  async createUser(userData) {
    if (!USE_API) return null;
    const res = await apiFetch('/users', {
      method: 'POST',
      body:   JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Nutzer konnte nicht erstellt werden');
    }
    const created = await res.json();
    return { ...created, id: String(created.id) };
  },

  // ── Nutzer aktualisieren (Ausbilder only) ─────────────────
  async updateUser(id, updates) {
    if (!USE_API) return null;
    const res = await apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body:   JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Nutzer konnte nicht aktualisiert werden');
    }
    return await res.json();
  },

  // ── Nutzer deaktivieren ───────────────────────────────────
  async deactivateUser(id) {
    if (!USE_API) return null;
    const res = await apiFetch(`/users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Nutzer konnte nicht deaktiviert werden');
    }
    return await res.json();
  },

  // ── Nutzer reaktivieren ───────────────────────────────────
  async activateUser(id) {
    if (!USE_API) return null;
    const res = await apiFetch(`/users/${id}/activate`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Nutzer konnte nicht aktiviert werden');
    }
    return await res.json();
  },

  // ── Profil-Felder aktualisieren (name, profession, etc.) ──
  async updateProfile(fields) {
    if (!USE_API) return null;
    const res = await apiFetch('/auth/profile', {
      method: 'PATCH',
      body:   JSON.stringify(fields),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Profil konnte nicht gespeichert werden');
    }
    return await res.json();
  },

  // ── Passwort des eingeloggten Nutzers ändern ──────────────
  async changePassword(old_password, new_password) {
    if (!USE_API) throw new Error('Passwortänderung nur im API-Modus verfügbar');
    const res = await apiFetch('/auth/password', {
      method: 'PATCH',
      body:   JSON.stringify({ old_password, new_password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Passwort konnte nicht geändert werden');
    }
    return await res.json();
  },

  // ── Theme in DB persistieren (fire & forget) ─────────────
  async syncTheme(theme) {
    if (!USE_API || !isTokenValid()) return;
    try {
      await apiFetch('/auth/theme', {
        method: 'PATCH',
        body:   JSON.stringify({ theme }),
      });
    } catch {} // UI-unabhängig, kein Toast nötig
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
