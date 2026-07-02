import React, { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react';
import { useAppStore } from './lib/store';
import { dataService } from './lib/dataService';
import { today, loadSession, clearSession, persistData, addActivity, uid, sameId } from './lib/utils';
import { useToast } from './lib/hooks';
import { applyUserTheme } from './lib/useTheme';
import { clearToken, isTokenValid } from './lib/auth';
import { hashPassword, isHashed } from './lib/crypto';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import type { User, AppState, Id } from './types';
import AuthPage from './features/auth/AuthPage';
// Route-Wrapper (verdrahten Store/Handler mit den lazy geladenen Feature-Views)
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailWrapper } from './pages/ProjectDetailWrapper';
import { ProfilePage } from './pages/ProfilePage';
import { CalendarPage } from './pages/CalendarPage';
import { GroupsPage } from './pages/GroupsPage';
import { UsersPage } from './pages/UsersPage';
import { AzubiProfileWrapper } from './pages/AzubiProfileWrapper';

// J13: Code-Splitting — schwergewichtige Routes / Modals lazy laden.
// Spart ~300 KB im Initial-Bundle, lädt on-demand bei Routen-Wechsel.
const LearnPage         = lazy(() => import('./features/learn/LearnPage'));
const ReportsPage       = lazy(() => import('./features/reports/ReportsPage'));
const NewProjectModal   = lazy(() => import('./features/projects/NewProjectModal'));
const TrainingPlanPage  = lazy(() => import('./features/training/TrainingPlanPage'));
import { Toast } from './components/UI.jsx';
import SyncIndicator from './components/SyncIndicator.jsx';
import ConflictDialog from './components/ConflictDialog.jsx';
import BackupsModal from './components/BackupsModal.jsx';
import { recordBackup } from './lib/backup.js';
import { useDataSync } from './lib/useDataSync.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
const TrashPage = lazy(() => import('./features/trash/TrashPage.jsx'));
const ShareView = lazy(() => import('./features/share/ShareView.jsx'));
import { ensureTrash, autoCleanTrash, trashCount as countTrash } from './lib/trash.js';
import { migrateData } from './lib/migrations.js';
const OnboardingWizard = lazy(() => import('./features/onboarding/OnboardingWizard.jsx'));
const WelcomeNews = lazy(() => import('./features/onboarding/WelcomeNews'));
import { NotificationBell } from './features/notifications/NotificationBell.jsx';
import { GlobalSearch, ShortcutsHelp } from './components/CommandDialogs.jsx';
import { AppLayout } from './components/AppLayout';

// ── App-Mode (einmalig auf Modulebene) ───────────────────────
const USE_API = import.meta.env.VITE_USE_API === 'true';

// J13: Suspense-Fallback während Lazy-Routes nachladen
function RouteFallback() {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--c-mu)', fontSize: 12 }}>
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--c-bd2)', borderTopColor: 'var(--c-ac)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Lädt …
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
const App = () => {
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const setData = store.setData;
  const setCurrentUser = store.setCurrentUser;
  const [showModal,    setShowModal]    = useState(false);
  const [showSearch,   setShowSearch]   = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { toast, showToast, dismissToast } = useToast();
  const _importRef = useRef(null);
  const [conflict, setConflict] = useState<any>(null);  // J2: Konflikt-Payload (Sync-Event-Detail, JS-Boundary) → any
  const [showBackups,    setShowBackups]    = useState(false); // L4
  const [showOnboarding, setShowOnboarding] = useState(false); // UX1
  const [showNews, setShowNews] = useState(false); // Willkommens-/News-Fenster (1×/Tag bei echtem Login)
  const justLoggedInRef = useRef(false); // Verhindert Logout durch Unauthorized-Event direkt nach Login

  // L3: Sentry-User-Kontext bei Login/Logout aktuell halten (no-op ohne DSN)
  useEffect(() => {
    import('./lib/sentry.js').then(m => m.setSentryUser(currentUser));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role]);

  // UX1: Onboarding beim ersten Login anzeigen (localStorage-Flag pro User)
  useEffect(() => {
    if (!currentUser?.id) return;
    const key = `azubiboard_onboarded_${currentUser.id}`;
    if (!localStorage.getItem(key)) setShowOnboarding(true);
  }, [currentUser?.id]);

  // Willkommens-/News-Fenster: max. 1×/Tag, NUR bei echtem Login (nicht bei Reload).
  // Entscheidungsbaum (WELCOME-FENSTER-DESIGN.md §2.2):
  // fresh-Login-Marker (sessionStorage, nur von handleLogin gesetzt) trennt Login von Reload.
  useEffect(() => {
    if (!currentUser?.id) return;
    const id = String(currentUser.id);
    let fresh: string | null = null;
    try { fresh = sessionStorage.getItem('azubiboard_fresh_login'); } catch { /* noop */ }
    if (fresh !== id) return;                                      // Reload/Restore → nichts zeigen
    try { sessionStorage.removeItem('azubiboard_fresh_login'); } catch { /* noop */ }  // Marker konsumieren
    if (!localStorage.getItem(`azubiboard_onboarded_${id}`)) return; // erster Login → Onboarding hat Vorrang
    try {
      if (localStorage.getItem(`azubiboard_news_seen_${id}`) === today()) return;       // heute schon gesehen
    } catch { /* noop */ }
    setShowNews(true);
  }, [currentUser?.id]);
  // UX1: Custom-Event aus ProfilePage erlaubt "Onboarding erneut anzeigen"
  useEffect(() => {
    const fn = () => setShowOnboarding(true);
    window.addEventListener('azubiboard:show-onboarding', fn);
    return () => window.removeEventListener('azubiboard:show-onboarding', fn);
  }, []);
  // Q5: News-Fenster manuell wiederöffnen (ProfilePage) — unabhängig vom 1×/Tag-Gate
  useEffect(() => {
    const fn = () => setShowNews(true);
    window.addEventListener('azubiboard:show-news', fn);
    return () => window.removeEventListener('azubiboard:show-news', fn);
  }, []);

  // K5: Neue activityLog-Einträge automatisch an Server-Audit weiterleiten.
  //     Set merkt sich gesendete IDs pro Session — bei Reload starten wir
  //     mit nur den neuesten 30 Einträgen als "schon gesehen", damit
  //     der Audit-Server nicht mit kompletter Historie geflutet wird.
  // activityLog ist im Schema z.array(z.unknown) (Blob-Form, kein Domain-Typ) → e/Set any belassen.
  const auditSentRef = useRef<Set<any> | null>(null);
  useEffect(() => {
    if (!data?.activityLog || !currentUser) return;
    if (!auditSentRef.current) {
      // Initial-Pool: alles was schon da war ist "alt". Auch bei leerem Log initialisieren,
      // sonst würde der erste neue Eintrag als Initial-Pool behandelt und nie gesendet.
      auditSentRef.current = new Set((data.activityLog || []).map((e: any) => e.id));
      return;
    }
    const seen   = auditSentRef.current;
    // Nur EIGENE Einträge forwarden: fremde kommen per Sync-Poll/BroadcastChannel herein
    // und würden sonst mit dem eigenen JWT dupliziert (falscher Akteur im Server-Audit).
    const fresh  = (data.activityLog || []).filter((e: any) =>
      e.id && !seen.has(e.id) && sameId(e.userId, currentUser.id));
    if (!fresh.length) return;
    // Senden in der zeitlich aufsteigenden Reihenfolge
    fresh.slice().reverse().forEach((e: any) => {
      seen.add(e.id);
      dataService.writeAudit({
        type:          e.type,
        entity_title:  e.entityTitle,
        project_id:    e.projectId   || null,
        project_title: e.projectTitle || null,
        action:        e.action || null,
        meta:          { client_id: e.id, client_ts: e.ts },
      });
    });
  }, [data?.activityLog, currentUser]);

  // I12: Smart-Polling — wenn ein anderer Tab/User auf dem Server speichert,
  //      holen wir die neue Version. Pausiert in Background-Tab + bei Save-Queue.
  useDataSync(setData, currentUser);

  // J2: Conflict-Event vom dataService abfangen → Dialog anzeigen
  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'conflict') {
        setConflict(detail);
        showToast('⚠ Speicherkonflikt — bitte entscheiden');
      }
    };
    window.addEventListener('azubiboard:sync', onSync);
    return () => window.removeEventListener('azubiboard:sync', onSync);
  }, [showToast]);

  // J2: Konflikt-Handler — Server-Version übernehmen
  const acceptServer = useCallback(() => {
    if (!conflict?.serverData) { setConflict(null); return; }
    // persist:false — die Daten kommen gerade vom Server, kein redundanter Re-POST.
    // localStorage trotzdem aktualisieren, sonst reanimiert ein Offline-Reload den verworfenen Stand.
    setData(conflict.serverData, { persist: false });
    persistData(conflict.serverData);
    dataService.discardPending();   // User hat sich gegen die lokalen Edits entschieden → Queue leeren
    dataService.setKnownVersion(conflict.serverVersion || 0);
    setConflict(null);
    showToast('✓ Server-Version übernommen');
  }, [conflict, setData, showToast]);

  // J2: Konflikt-Handler — eigene Version forcieren
  const forceMine = useCallback(async () => {
    if (!conflict?.clientSnapshot) { setConflict(null); return; }
    await dataService.forceSave(conflict.clientSnapshot);
    setConflict(null);
    showToast('⚡ Deine Version wurde gespeichert');
  }, [conflict, showToast]);

  // J2: Konflikt-Handler — frischen Server-Stand laden (eigene Änderungen verwerfen)
  const reloadServer = useCallback(() => { window.location.reload(); }, []);

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

  const doneOnboarding = useCallback(() => {
    if (currentUser?.id) localStorage.setItem(`azubiboard_onboarded_${currentUser.id}`, '1');
    setShowOnboarding(false);
  }, [currentUser?.id]);

  const closeNews = useCallback(() => {
    if (currentUser?.id) {
      try { localStorage.setItem(`azubiboard_news_seen_${currentUser.id}`, today()); } catch { /* noop */ }
    }
    setShowNews(false);
  }, [currentUser?.id]);

  // ── Onboarding-Wizard-Handler (Phase 3: rollenspezifische Setup-Schritte) ──
  // Profil aktualisieren (Azubi-Schritt 2): wie AzubiProfilePage — API + Blob + currentUser.
  const handleUpdateProfile = useCallback((changes: Partial<User>) => {
    if (!currentUser?.id) return;
    if (USE_API) dataService.updateProfile(changes).catch(() => showToast('⚠ Profil konnte nicht zum Server synchronisiert werden'));
    setCurrentUser({ ...currentUser, ...changes });
    // prev: Store-Blob (Boundary) → any.
    setData((prev: any) => prev ? { ...prev, users: (prev.users || []).map((u: User) => sameId(u.id, currentUser.id) ? { ...u, ...changes } : u) } : prev);
  }, [currentUser, setCurrentUser, setData, showToast]);

  // Beitritts-Anfrage an eine Gruppe (Azubi-Schritt 3): schreibt currentUser.id in group.requests.
  // Der Ausbilder bestätigt sie später in der Gruppen-Verwaltung.
  const handleRequestGroup = useCallback((groupId: Id) => {
    if (!currentUser?.id) return;
    setData((prev: any) => prev ? { ...prev, groups: (prev.groups || []).map((g: any) =>
      g.id === groupId && ![...(g.members || []), ...(g.requests || [])].some((x: Id) => sameId(x, currentUser.id))
        ? { ...g, requests: [...(g.requests || []), currentUser.id] } : g) } : prev);
  }, [currentUser, setData]);

  // Erste Gruppe anlegen (Ausbilder-Schritt 2): Gruppe ohne Code, Azubis treten per Anfrage bei.
  const handleCreateGroup = useCallback((name: string, type: string) => {
    const newGroup = { id: uid(), name: name.trim(), type, members: [], requests: [] };
    setData((prev: any) => prev ? { ...prev, groups: [...(prev.groups || []), newGroup] } : prev);
  }, [setData]);

  const handleNewProject = useCallback(() => setShowModal(true), []);

  useEffect(() => {
    let gPrefix = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;
    const fn = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = ['INPUT','TEXTAREA','SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); if (currentUser) setShowSearch(s => !s); return; }
      if (inInput) return;
      if (e.key === '?') { if (currentUser) setShowShortcuts(s => !s); return; }
      // Neues Projekt nur für Ausbilder (konsistent mit 0.6: Azubi/Mentor bekommen Projekte zugewiesen)
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && currentUser?.role === 'ausbilder') { setShowModal(true); return; }
      // G + letter navigation prefix
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) { gPrefix = true; clearTimeout(gTimer); gTimer = setTimeout(() => { gPrefix = false; }, 1200); return; }
      if (gPrefix) {
        gPrefix = false; clearTimeout(gTimer);
        // Navigation dispatched via custom event (AppLayout handles it inside Router) — rollenabhängig: /users nur Ausbilder
        const map: Record<string, string> = { d: '/dashboard', p: '/projects', k: '/calendar', r: '/reports', t: '/training', l: '/learn', ...(currentUser?.role === 'ausbilder' ? { u: '/users' } : {}) };
        if (map[e.key]) window.dispatchEvent(new CustomEvent('azubiboard:navigate', { detail: map[e.key] }));
      }
    };
    document.addEventListener('keydown', fn);
    return () => { document.removeEventListener('keydown', fn); clearTimeout(gTimer); };
  }, [currentUser]);

  // projectData: NewProjectModal-FormState (kein Domain-Typ) → any belassen.
  const handleCreate = useCallback((projectData: any) => {
    if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
    const newProject = { ...projectData, id: `proj_${Date.now()}`, tasks: [], steps: [], calendarEvents: [], archived: false };
    setData((prev: any) => addActivity({ ...prev, projects: [...(prev?.projects || []), newProject] }, {
      type: 'project_created',
      userId: currentUser?.id,
      userName: currentUser?.name,
      entityTitle: newProject.title,
      projectId: newProject.id,
      projectTitle: newProject.title,
      action: `${currentUser?.name} hat Projekt "${newProject.title}" erstellt`,
    }));
    setShowModal(false);
    showToast('✓ Projekt erstellt');
  }, [setData, showToast, currentUser]);

  // Daten-Export
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `azubiboard_backup_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordBackup();                 // I8: Reminder-Tracker auffrischen
    showToast('✓ Daten exportiert');
  }, [data, showToast]);

  // Daten-Import
  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        if (!imported.users || !Array.isArray(imported.projects)) throw new Error('Ungültiges Format');
        // Import durch dieselbe Pipeline wie der Bootstrap schicken, sonst landet
        // ein älteres/fremdes Backup unmigriert im State (Bug-Hunt 3 #6).
        setData(autoCleanTrash(ensureTrash(migrateData(imported) as any)));
        showToast('✓ Daten importiert');
      } catch { showToast('⚠ Datei konnte nicht importiert werden'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setData, showToast]);

  // Bootstrap-Ladezustand (Phase 4): voller Splash statt leerem Screen (wirkte wie Absturz)
  if (!data) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--c-bg)' }}>
      <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg, var(--c-ac), #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff', boxShadow: '0 4px 16px rgba(0,113,227,0.35)' }}>A</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'var(--c-mu)', fontSize: 13 }}>
        <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--c-bd2)', borderTopColor: 'var(--c-ac)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        AzubiBoard lädt …
      </div>
    </div>
  );

  // J10: Public Share-Route — bypassed Auth & AppLayout (kein Login nötig)
  // BrowserRouter + Path: /azubiboard/share/:token funktioniert auch ohne
  // currentUser. Wir matchen direkt auf pathname (Router läuft sonst nur
  // hinter dem Auth-Gate).
  const sharePath = typeof window !== 'undefined' && window.location.pathname.match(/\/share\/([a-f0-9]{32,64})\b/);
  if (sharePath) {
    // BASE_PATH ohne trailing-Slash als Router-basename
    const basename = (import.meta.env.VITE_BASE_PATH || '/azubiboard/').replace(/\/$/, '');
    return (
      <ErrorBoundary>
        <Router basename={basename}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/share/:token" element={<ShareView />} />
              <Route path="*" element={<ShareView />} />
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
    );
  }

  if (!currentUser) {
    return (
      <ErrorBoundary>
        <AuthPage
          onLogin={handleLogin}
          users={data?.users || []}
          onRegister={async (newUser: User) => {
            // Gruppen-Beitritt läuft nach dem Login per Anfrage (Onboarding-Wizard) → hier keine Gruppe.
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
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <AppLayout currentUser={currentUser} onLogout={handleLogout} onNewProject={handleNewProject} onExport={handleExport} onImport={handleImport} onSearch={() => setShowSearch(true)} onBackup={handleExport} onShowBackups={USE_API && currentUser?.role === 'ausbilder' ? () => setShowBackups(true) : null} trashCount={countTrash(data as any)}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/dashboard"   element={<ErrorBoundary inline><DashboardPage onNewProject={handleNewProject} showToast={showToast} /></ErrorBoundary>} />
              <Route path="/projects"    element={<ErrorBoundary inline><ProjectsPage  onNewProject={handleNewProject} showToast={showToast} /></ErrorBoundary>} />
              <Route path="/project/:id" element={<ErrorBoundary inline><ProjectDetailWrapper showToast={showToast} /></ErrorBoundary>} />
              <Route path="/profile"     element={<ErrorBoundary inline><ProfilePage showToast={showToast} /></ErrorBoundary>} />
              <Route path="/calendar"    element={<ErrorBoundary inline><CalendarPage showToast={showToast} /></ErrorBoundary>} />
              <Route path="/groups"      element={<ErrorBoundary inline><GroupsPage showToast={showToast} /></ErrorBoundary>} />
              <Route path="/training"    element={<ErrorBoundary inline><TrainingPlanPage currentUser={currentUser} data={data} onUpdateData={setData} showToast={showToast} /></ErrorBoundary>} />
              <Route path="/learn"       element={<ErrorBoundary inline><LearnPage currentUser={currentUser} /></ErrorBoundary>} />
              <Route path="/reports"     element={<ErrorBoundary inline><ReportsPage currentUser={currentUser} data={data} onUpdateData={setData} showToast={showToast} /></ErrorBoundary>} />
              <Route path="/users"       element={<ErrorBoundary inline><UsersPage showToast={showToast} /></ErrorBoundary>} />
              <Route path="/azubi/:id"   element={<ErrorBoundary inline><AzubiProfileWrapper /></ErrorBoundary>} />
              <Route path="/trash"       element={<ErrorBoundary inline><TrashPage data={data} currentUser={currentUser} onUpdateData={setData} showToast={showToast} /></ErrorBoundary>} />
              <Route path="/"  element={<Navigate to="/dashboard" replace />} />
              <Route path="*"  element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>

          {showModal && (
            <Suspense fallback={null}>
              {/* groups: NewProjectModal erwartet eigenen Group-Typ (enger als AppState-Blob) → cast. */}
              <NewProjectModal
                users={data?.users || []}
                groups={(data?.groups || []) as any}
                currentUser={currentUser}
                onClose={() => setShowModal(false)}
                onCreate={handleCreate}
              />
            </Suspense>
          )}
        </AppLayout>

        {toast && <Toast payload={toast as any} onDismiss={dismissToast} />}
        {conflict && (
          <ConflictDialog
            payload={conflict}
            onAcceptServer={acceptServer}
            onForceMine={forceMine}
            onReload={reloadServer}
            onClose={acceptServer}
          />
        )}
        {showSearch    && <GlobalSearch   data={data} onClose={() => setShowSearch(false)} />}
        {showShortcuts && <ShortcutsHelp  onClose={() => setShowShortcuts(false)} />}
        {showBackups   && (
          <BackupsModal
            onClose={() => setShowBackups(false)}
            onRestore={async () => {
              // Frisch vom Server holen, damit lokaler State matched
              const fresh = await dataService.getData();
              if (fresh) setData(fresh);
            }}
            showToast={showToast}
          />
        )}
        <SyncIndicator />

        {/* UX1: Onboarding-Wizard beim ersten Login */}
        {showOnboarding && currentUser && (
          <Suspense fallback={null}>
            <OnboardingWizard
              currentUser={currentUser}
              data={data as AppState | null}
              onDone={doneOnboarding}
              onNewProject={() => { doneOnboarding(); handleNewProject(); }}
              onFirstReport={() => { doneOnboarding(); window.dispatchEvent(new CustomEvent('azubiboard:navigate', { detail: '/reports' })); }}
              onUpdateProfile={handleUpdateProfile}
              onRequestGroup={handleRequestGroup}
              onCreateGroup={handleCreateGroup}
              navigate={(to) => window.dispatchEvent(new CustomEvent('azubiboard:navigate', { detail: to }))}
            />
          </Suspense>
        )}

        {/* Willkommens-/News-Fenster beim Login (Onboarding hat Vorrang) */}
        {showNews && !showOnboarding && currentUser && (
          <Suspense fallback={null}>
            <WelcomeNews
              data={data as AppState | null}
              currentUser={currentUser}
              onClose={closeNews}
              navigate={(to) => window.dispatchEvent(new CustomEvent('azubiboard:navigate', { detail: to }))}
            />
          </Suspense>
        )}
      </Router>
    </ErrorBoundary>
  );
};

export default App;
