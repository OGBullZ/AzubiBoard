import React, { useCallback, useState, lazy, Suspense } from 'react';
import { useAppStore } from './lib/store';
import { dataService } from './lib/dataService';
import { addActivity, persistData } from './lib/utils';
import { useToast } from './lib/hooks';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import type { User, AppState } from './types';
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
// Root-Verdrahtung (Session/Konflikt/Onboarding/Audit/Shortcuts/Backup) als Hooks
import { useAuthSession } from './app/useAuthSession';
import { useConflict } from './app/useConflict';
import { useOnboardingFlow } from './app/useOnboardingFlow';
import { useAuditForward } from './app/useAuditForward';
import { useGlobalShortcuts } from './app/useGlobalShortcuts';
import { useBackupExport } from './app/useBackupExport';

// J13: Code-Splitting — schwergewichtige Routes / Modals lazy laden.
// Spart ~300 KB im Initial-Bundle, lädt on-demand bei Routen-Wechsel.
const LearnPage         = lazy(() => import('./features/learn/LearnPage'));
const ReportsPage       = lazy(() => import('./features/reports/ReportsPage'));
const NewProjectModal   = lazy(() => import('./features/projects/NewProjectModal'));
const TrainingPlanPage  = lazy(() => import('./features/training/TrainingPlanPage'));
const TrashPage = lazy(() => import('./features/trash/TrashPage.jsx'));
const ShareView = lazy(() => import('./features/share/ShareView.jsx'));
const OnboardingWizard = lazy(() => import('./features/onboarding/OnboardingWizard.jsx'));
const WelcomeNews = lazy(() => import('./features/onboarding/WelcomeNews'));
import { Toast } from './components/UI.jsx';
import SyncIndicator from './components/SyncIndicator.jsx';
import ConflictDialog from './components/ConflictDialog.jsx';
import BackupsModal from './components/BackupsModal.jsx';
import { useDataSync } from './lib/useDataSync.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { trashCount as countTrash } from './lib/trash.js';
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
  const [showBackups,    setShowBackups]    = useState(false); // L4
  const { toast, showToast, dismissToast } = useToast();

  // Session-Lebenszyklus: Bootstrap (Daten laden/migrieren), Login/Logout/Register, 401-Handler
  const { handleLogin, handleLogout, handleRegister } = useAuthSession(currentUser, setCurrentUser, setData);

  // UX1: Onboarding-Wizard + Willkommens-/News-Fenster inkl. Wizard-Handler
  const { showOnboarding, showNews, doneOnboarding, closeNews, handleUpdateProfile, handleRequestGroup, handleCreateGroup } =
    useOnboardingFlow(currentUser, setCurrentUser, setData, showToast);

  // K5: Neue activityLog-Einträge automatisch an Server-Audit weiterleiten
  useAuditForward(data, currentUser);

  // I12: Smart-Polling — wenn ein anderer Tab/User auf dem Server speichert,
  //      holen wir die neue Version. Pausiert in Background-Tab + bei Save-Queue.
  useDataSync(setData, currentUser);

  // J2: Speicherkonflikt-Dialog + Auflösungs-Handler
  const { conflict, acceptServer, forceMine, reloadServer } = useConflict(setData, showToast);

  // Ctrl+K Suche, ? Hilfe, n Neues Projekt (Ausbilder), g+Taste Navigation
  useGlobalShortcuts(currentUser, setShowSearch, setShowShortcuts, setShowModal);

  // I8/L4: JSON-Export + Import durch die Bootstrap-Pipeline
  const { handleExport, handleImport } = useBackupExport(data, setData, showToast);

  const handleNewProject = useCallback(() => setShowModal(true), []);

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
          onRegister={handleRegister}
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
              // Frisch vom Server holen, damit lokaler State matched. persist:false — die Daten
              // kommen gerade vom Server (getData setzt knownVersion via ETag); ein Re-POST wäre
              // ein redundantes Echo (updated_at-Bump, alle anderen Clients laden doppelt).
              const fresh = await dataService.getData();
              if (fresh) { setData(fresh, { persist: false }); persistData(fresh); }
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
