// ============================================================
//  auth.ts – JWT-Verwaltung  (T1 Sprint 14: js → ts migriert)
//  Token liegt in sessionStorage (wird beim Tab-Schließen gelöscht).
//  Kein localStorage → bei XSS kein dauerhafter Token-Diebstahl.
// ============================================================

const KEY = 'azubiboard_token';

interface JwtPayload { exp?: number; [k: string]: unknown; }

export function getToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function setToken(token?: string | null): void {
  if (token) sessionStorage.setItem(KEY, token);
  else        sessionStorage.removeItem(KEY);
}

export function clearToken(): void {
  sessionStorage.removeItem(KEY);
}

/** Gibt Authorization-Header zurück, oder leer wenn kein Token */
export function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** JWT-Payload auslesen (kein Verify — nur für UI-Anzeige) */
export function parseToken(token: string | null = getToken()): JwtPayload | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as JwtPayload;
  } catch {
    return null;
  }
}

/** Ist der Token noch gültig (Ablaufzeit)? */
export function isTokenValid(token: string | null = getToken()): boolean {
  const p = parseToken(token);
  if (!p?.exp) return false;
  return p.exp * 1000 > Date.now();
}
