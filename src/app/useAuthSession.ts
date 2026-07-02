import { useEffect, useRef, useCallback } from 'react';
import { dataService } from '../lib/dataService';
import { loadSession, clearSession, persistData, addActivity } from '../lib/utils';
import { clearToken, isTokenValid } from '../lib/auth';
import { hashPassword, isHashed } from '../lib/crypto';
import { applyUserTheme } from '../lib/useTheme';
import { ensureTrash, autoCleanTrash } from '../lib/trash.js';
import { migrateData } from '../lib/migrations.js';
import type { User } from '../types';

const USE_API = import.meta.env.VITE_USE_API === 'true';

// ── Session-Lebenszyklus: Bootstrap, Login/Logout/Register, 401-Handler ──
export function useAuthSession(
  currentUser: User | null,
  setCurrentUser: (u: User | null) => void,
  setData: (d: any, opts?: any) => void,
) {
  const justLoggedInRef = useRef(false); // Verhindert Logout durch Unauthorized-Event direkt nach Login

  // L3: Sentry-User-Kontext bei Login/Logout aktuell halten (no-op ohne DSN)
  useEffect(() => {
    import('../lib/sentry.js').then(m => m.setSentryUser(currentUser));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  // ── 401-Handler: Token abgelaufen → sauber ausloggen ─────
  // justLoggedInRef schützt vor sofortigem Logout wenn kurz nach Login
  // ein API-Call (z.B. getUsers) 401 liefert (Apache-Header-Konfiguration).
  useEffect(() => {
    const fn = () => {
      if (justLoggedInRef.current) return;
      clearToken();
      setCurrentUser(null);
    };
    window.addEventListener('azubiboard:unauthorized', fn);
    return () => window.removeEventListener('azubiboard:unauthorized', fn);
  }, [setCurrentUser]);

  // ── Daten laden, Passwörter migrieren, Session prüfen ────
  useEffect(() => {
    (async () => {
      // JS/Blob-Boundary: dataService.getData() + migrateData/ensureTrash liefern Blob-Form
      // (nicht zwingend Schema-konform) → loaded/u/finalData bewusst any.
      const loaded = await dataService.getData() as any;

      // Passwort-Migration: Klartext → SHA-256 (nur local-mode)
      let migrated = false;
      const migratedUsers = await Promise.all(
        (loaded.users || []).map(async (u: any) => {
          if (!isHashed(u.password)) {
            migrated = true;
            return { ...u, password: await hashPassword(u.password) };
          }
          return u;
        })
      );
      let finalData: any = migrated ? { ...loaded, users: migratedUsers } : loaded;
      // L2: Schema-Migrations VOR allen anderen Transforms anwenden.
      //     Setzt data.schema_version + initialisiert fehlende Felder.
      const beforeVersion = finalData.schema_version;
      finalData = migrateData(finalData);
      const schemaMigrated = finalData.schema_version !== beforeVersion;
      // J3: trash-Feld + auto-clean (idempotent, läuft auch nach Migrations)
      finalData = autoCleanTrash(ensureTrash(finalData));
      if (migrated || schemaMigrated) persistData(finalData);

      if (USE_API) {
        // ── API-Modus: JWT prüfen und Nutzer vom Server laden ─
        if (isTokenValid()) {
          const me = await dataService.getMe();
          if (me) {
            // ID-Normalisierung (Bug-Hunt APP-F1): Blob-User sind Strings (getUsers normalisiert),
            // getMe lieferte number → strikte Vergleiche (saveProfile/Stats) liefen ins Leere.
            setCurrentUser({ ...me, id: String(me.id) });
            applyUserTheme(me.theme);  // Theme aus DB beim Start übernehmen
            // Nutzerliste aus MySQL laden (bleibt synchron mit Auth-DB)
            const apiUsers = await dataService.getUsers();
            if (apiUsers) finalData = { ...finalData, users: apiUsers };
          } else {
            clearToken();  // Token war ungültig
          }
        }
      } else {
        // ── Lokaler Modus: userId aus sessionStorage ──────────
        const sessionUserId = loadSession();
        if (sessionUserId && !currentUser) {
          const sessionUser = migratedUsers.find(u => u.id === sessionUserId);
          if (sessionUser) setCurrentUser(sessionUser);
        }
      }

      setData(finalData);
    })();
  }, []); // eslint-disable-line

  // Nach Login: MySQL-User laden und in Blob mergen (API-Modus)
  const handleLogin = useCallback(async (user: User) => {
    justLoggedInRef.current = true;
    // Marker für echten Login (vs. Reload) — vom News-Effect konsumiert (§2.1).
    try { sessionStorage.setItem('azubiboard_fresh_login', String(user.id)); } catch { /* noop */ }
    setCurrentUser(user);
    applyUserTheme(user.theme);  // Theme aus DB nach Login anwenden
    if (USE_API) {
      const apiUsers = await dataService.getUsers();
      // prev: Store-Blob (Record<string,unknown>) — Boundary, any belassen.
      if (apiUsers) setData((prev: any) => prev ? { ...prev, users: apiUsers } : prev);
    }
    justLoggedInRef.current = false;
  }, [setCurrentUser, setData]);

  const handleLogout = useCallback(() => {
    clearSession();
    clearToken();
    setCurrentUser(null);
  }, [setCurrentUser]);

  // Registrierung (AuthPage): Gruppen-Beitritt läuft nach dem Login per Anfrage
  // (Onboarding-Wizard) → hier keine Gruppe.
  const handleRegister = useCallback(async (newUser: User) => {
    setData((prev: any) => addActivity({ ...prev, users: [...(prev?.users || []), newUser] }, {
      type: 'user_registered',
      userId: newUser.id,
      userName: newUser.name,
      entityTitle: newUser.name,
      projectId: null,
      projectTitle: null,
      action: `${newUser.name} hat sich registriert`,
    }));
    setCurrentUser(newUser);
    // In API-Modus: frische Nutzerliste nach Registrierung laden
    if (USE_API) {
      const apiUsers = await dataService.getUsers();
      // prev: Store-Blob (Record<string,unknown>) — Boundary, any belassen.
      if (apiUsers) setData((prev: any) => prev ? { ...prev, users: apiUsers } : prev);
    }
  }, [setCurrentUser, setData]);

  return { handleLogin, handleLogout, handleRegister };
}
