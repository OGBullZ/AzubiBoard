// ============================================================
//  auth.js – JWT-Verwaltung
//  Token liegt in sessionStorage (wird beim Tab-Schließen gelöscht).
//  Kein localStorage → bei XSS kein dauerhafter Token-Diebstahl.
// ============================================================

const KEY = 'azubiboard_token';

export function getToken() {
  return sessionStorage.getItem(KEY);
}

export function setToken(token) {
  if (token) sessionStorage.setItem(KEY, token);
  else        sessionStorage.removeItem(KEY);
}

export function clearToken() {
  sessionStorage.removeItem(KEY);
}

/** Gibt Authorization-Header zurück, oder leer wenn kein Token */
export function authHeader() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** JWT-Payload auslesen (kein Verify — nur für UI-Anzeige) */
export function parseToken(token = getToken()) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

/** Ist der Token noch gültig (Ablaufzeit)? */
export function isTokenValid(token = getToken()) {
  const p = parseToken(token);
  if (!p?.exp) return false;
  return p.exp * 1000 > Date.now();
}
