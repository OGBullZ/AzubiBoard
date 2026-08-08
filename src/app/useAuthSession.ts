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

      // persist:false — der Stand kam gerade von Server/localStorage; ein POST wäre
      // redundant und liefe beim frischen Client ohne Version in den 409-Guard.
      setData(finalData, { persist: false });
    })();
  }, []); // eslint-disable-line

  // Tier-1-Fund 02.07.: Nach dem Login MUSS der Server-Blob geladen werden — der
  // anonyme Boot lief ohne Token auf dem localStorage-Seed, und ein Save auf dessen
  // Basis überschreibt die geteilten Server-Daten. getData() setzt zudem die bekannte
  // Version (If-Match für alle Folge-Saves). Durch dieselbe Pipeline wie der Bootstrap.
  const loadServerBlob = useCallback(async () => {
    const fresh = await dataService.getData() as any;
    if (!fresh || typeof fresh !== 'object') return null;
    // Blob-Boundary wie im Bootstrap-Effect: migrateData liefert Blob-Form → any.
    return autoCleanTrash(ensureTrash(migrateData(fresh) as any));
  }, []);

  // Nach Login: Server-Blob + MySQL-User laden (API-Modus)
  const handleLogin = useCallback(async (user: User) => {
    justLoggedInRef.current = true;
    // Marker für echten Login (vs. Reload) — vom News-Effect konsumiert (§2.1).
    try { sessionStorage.setItem('azubiboard_fresh_login', String(user.id)); } catch { /* noop */ }
    setCurrentUser(user);
    applyUserTheme(user.theme);  // Theme aus DB nach Login anwenden
    if (USE_API) {
      const [fresh, apiUsers] = await Promise.all([loadServerBlob(), dataService.getUsers()]);
      // prev/base: Store-Blob (Record<string,unknown>) — Boundary, any belassen.
      setData((prev: any) => {
        const base: any = fresh ?? prev;
        if (!base) return prev;
        return apiUsers ? { ...base, users: apiUsers } : base;
      }, { persist: false });   // kam gerade vom Server — kein Re-POST
    }
    justLoggedInRef.current = false;
  }, [setCurrentUser, setData, loadServerBlob]);

  const handleLogout = useCallback(() => {
    // Bug-Hunt 08-06 #4: Beim Abmelden mit ungespeicherten Änderungen in der Save-Queue
    // (z.B. nach längerem Offline-Betrieb) hat der nächste Retry-Tick die Queue still
    // verworfen — ohne Fehlermeldung, ohne Indikator. Nach dem erneuten Login lud die App
    // den alten Server-Stand und die Arbeit war weg. Darum vorher fragen.
    const status = dataService.getSaveStatus();
    if (status.pending || status.inflight) {
      const weiter = window.confirm(
        'Es sind noch nicht gespeicherte Änderungen offen (keine Verbindung zum Server).\n\n' +
        'Beim Abmelden gehen sie verloren. Trotzdem abmelden?',
      );
      if (!weiter) return;
    }
    clearSession();
    clearToken();
    setCurrentUser(null);
  }, [setCurrentUser]);

  // Registrierung (AuthPage): Gruppen-Beitritt läuft nach dem Login per Anfrage
  // (Onboarding-Wizard) → hier keine Gruppe.
  const handleRegister = useCallback(async (newUser: User) => {
    setCurrentUser(newUser);
    const activity = {
      type: 'user_registered',
      userId: newUser.id,
      userName: newUser.name,
      entityTitle: newUser.name,
      projectId: null,
      projectTitle: null,
      action: `${newUser.name} hat sich registriert`,
    };
    if (USE_API) {
      // Tier-1-Fund 02.07.: erst den geteilten Server-Blob laden (setzt If-Match-Version),
      // DANN die Activity darauf aufsetzen — sonst überschreibt der Registrier-Save
      // den Server-Stand mit dem lokalen Seed.
      const [fresh, apiUsers] = await Promise.all([loadServerBlob(), dataService.getUsers()]);
      // prev/base: Store-Blob (Record<string,unknown>) — Boundary, any belassen.
      setData((prev: any) => {
        const base: any = fresh ?? prev;
        if (!base) return prev;
        return addActivity(apiUsers ? { ...base, users: apiUsers } : base, activity);
      });
    } else {
      setData((prev: any) => addActivity({ ...prev, users: [...(prev?.users || []), newUser] }, activity));
    }
  }, [setCurrentUser, setData, loadServerBlob]);

  return { handleLogin, handleLogout, handleRegister };
}
