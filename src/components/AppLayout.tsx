import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.jsx';
import BackupReminder from './BackupReminder.jsx';
import { IcoSun, IcoMoon } from './Icons.jsx';
import { useIsMobile } from '../lib/hooks';
import { useTheme } from '../lib/useTheme';
import type { User } from '../types';

// ── Page Title ────────────────────────────────────────────────
const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/projects':  'Projekte',
  '/calendar':  'Kalender',
  '/groups':    'Gruppen',
  '/training':  'Ausbildungsplan',
  '/learn':     'Lernportal',
  '/reports':   'Berichte',
  '/users':     'Nutzer',
  '/profile':   'Profil',
  '/project':   'Projekt',
};
function usePageTitle() {
  const location = useLocation();
  useEffect(() => {
    const match = Object.entries(ROUTE_TITLES).find(([k]) => location.pathname.startsWith(k));
    document.title = match ? `${match[1]} · AzubiBoard` : 'AzubiBoard';
  }, [location.pathname]);
}

// ── AppLayout ─────────────────────────────────────────────────
interface AppLayoutProps {
  currentUser: User | null;
  onLogout: () => void;
  onNewProject: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearch: () => void;
  onBackup?: (() => void) | null;
  onShowBackups?: (() => void) | null;
  trashCount?: number;
  children?: React.ReactNode;
}
export function AppLayout({ currentUser, onLogout, onNewProject, onExport, onImport, onSearch, onBackup, onShowBackups, trashCount = 0, children }: AppLayoutProps) {
  const [collapsed,   setCollapsed]   = useState(() => localStorage.getItem('azubiboard_sidebar_collapsed') === 'true');
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  usePageTitle();

  // G+letter navigation from global keyboard handler
  useEffect(() => {
    const fn = (e: Event) => navigate((e as CustomEvent).detail);
    window.addEventListener('azubiboard:navigate', fn);
    return () => window.removeEventListener('azubiboard:navigate', fn);
  }, [navigate]);

  // Drawer schließen wenn auf Desktop gewechselt wird
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!isMobile) setDrawerOpen(false); }, [isMobile]);

  const handleToggleCollapse = useCallback(() => {
    if (isMobile) {
      setDrawerOpen(o => !o);
    } else {
      setCollapsed(c => {
        const next = !c;
        localStorage.setItem('azubiboard_sidebar_collapsed', String(next));
        return next;
      });
    }
  }, [isMobile]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <a href="#main-content" className="skip-link">Zum Hauptinhalt springen</a>
      {/* Overlay bei offenem Drawer */}
      {isMobile && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 899, backdropFilter: 'blur(2px)' }} />
      )}

      <Sidebar currentUser={currentUser} onLogout={onLogout} onNewProject={onNewProject} onExport={onExport} onImport={onImport} onSearch={onSearch}
        onShowBackups={onShowBackups}
        collapsed={isMobile ? false : collapsed} onToggleCollapse={handleToggleCollapse}
        theme={theme} onToggleTheme={toggleTheme}
        isMobile={isMobile} drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)}
        trashCount={trashCount} />

      <div id="main-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile Topbar */}
        {isMobile && (
          <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: '1px solid var(--c-bd)', background: 'var(--c-sf)', gap: 12 }}>
            <button onClick={() => setDrawerOpen(o => !o)} aria-label="Menü öffnen"
              style={{ padding: '6px 8px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--c-br)', fontSize: 20, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ☰
            </button>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, var(--c-ac), #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff' }}>A</div>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--c-br)', flex: 1 }}>AzubiBoard</span>
            <button onClick={toggleTheme} aria-label="Theme wechseln"
              style={{ padding: '5px', borderRadius: 6, border: 'none', background: 'transparent', color: 'var(--c-mu)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center' }}>
              {theme === 'dark' ? <IcoSun size={16} /> : <IcoMoon size={16} />}
            </button>
          </div>
        )}
        {onBackup && <BackupReminder onBackup={onBackup} />}
        {children}
      </div>
    </div>
  );
}
