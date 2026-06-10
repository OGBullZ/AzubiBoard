import React, { useEffect, useCallback, useState, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from './lib/store';
import { dataService } from './lib/dataService';
import { today, loadSession, clearSession, persistData, addActivity, uid } from './lib/utils';
import { useDebounce, useDialog } from './lib/hooks';
import { clearToken, isTokenValid } from './lib/auth';
import { hashPassword, isHashed } from './lib/crypto';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import type { User, Project, Task, Report, CalendarEvent, AppState, Id } from './types';
import AuthPage from './features/auth/AuthPage';
import Dashboard from './features/dashboard/Dashboard';   // initial Route — eager
import ProjectPool from './features/projects/ProjectPool';

// J13: Code-Splitting — schwergewichtige Routes / Modals lazy laden.
// Spart ~300 KB im Initial-Bundle, lädt on-demand bei Routen-Wechsel.
const ProjectDetail     = lazy(() => import('./features/projects/ProjectDetail'));
const LearnPage         = lazy(() => import('./features/learn/LearnPage'));
const ReportsPage       = lazy(() => import('./features/reports/ReportsPage'));
const NewProjectModal   = lazy(() => import('./features/projects/NewProjectModal'));
const CalendarView      = lazy(() => import('./features/calendar/CalendarView'));
const GroupsView        = lazy(() => import('./features/groups/GroupsView'));
const UsersView         = lazy(() => import('./features/users/UsersView'));
const TrainingPlanPage  = lazy(() => import('./features/training/TrainingPlanPage'));
const AzubiProfilePage  = lazy(() => import('./features/users/AzubiProfilePage'));
import { Toast } from './components/UI.jsx';
import SyncIndicator from './components/SyncIndicator.jsx';
import BackupReminder from './components/BackupReminder.jsx';
import ConflictDialog from './components/ConflictDialog.jsx';
import BackupsModal from './components/BackupsModal.jsx';
import { recordBackup } from './lib/backup.js';
import { useDataSync } from './lib/useDataSync.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import {
  IcoDashboard, IcoFolder, IcoCalendar, IcoUsers,
  IcoReport, IcoLearn, IcoPlus, IcoLogout, IcoUserEdit, IcoSearch,
  IcoBell, IcoAlert, IcoClock, IcoX, IcoSun, IcoMoon, IcoRequire,
  IcoTrash,
} from './components/Icons.jsx';
const TrashPage = lazy(() => import('./features/trash/TrashPage.jsx'));
const ShareView = lazy(() => import('./features/share/ShareView.jsx'));
const TwoFactorSettings = lazy(() => import('./features/auth/TwoFactorSettings.jsx'));
import { ensureTrash, autoCleanTrash, trashCount as countTrash, softDelete } from './lib/trash.js';
import { migrateData } from './lib/migrations.js';
const OnboardingWizard = lazy(() => import('./features/onboarding/OnboardingWizard.jsx'));
const WelcomeNews = lazy(() => import('./features/onboarding/WelcomeNews'));
import { useNotifications, type NotificationEntry } from './features/notifications/useNotifications';

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

// ── Design-Version 1.0 ↔ 1.0 Beta (Werkbank-Redesign, DESIGN-VISION.md) ──
// Default v1; Beta aktiviert die [data-design="beta"]-Styles. Boot-Apply in main.tsx.
const ACCENTS = [
  { val: 'orange', hex: '#FF6A1A', label: 'Signal-Orange' },
  { val: 'amber',  hex: '#FFB224', label: 'Amber' },
  { val: 'cyan',   hex: '#3FD2C7', label: 'Cyan' },
];
function DesignSwitch() {
  const [design, setDesign] = useState(() => localStorage.getItem('azubiboard_design') || 'v1');
  const [accent, setAccent] = useState(() => localStorage.getItem('azubiboard_accent') || 'orange');
  const apply = (key: string, val: string, set: (v: string) => void) => {
    set(val);
    try { localStorage.setItem(`azubiboard_${key}`, val); } catch { /* noop */ }
    document.documentElement.setAttribute(`data-${key}`, val);
    if (key === 'design') window.dispatchEvent(new Event('azubiboard:design')); // useDesign-Konsumenten re-rendern
  };
  return (
    <div style={{ marginTop: 14 }}>
      <label>Design-Version</label>
      <div style={{ display: 'flex', gap: 8 }}>
        {[['v1', '1.0'], ['beta', '1.0 Beta ✦']].map(([val, lab]) => (
          <button key={val} className="btn" onClick={() => apply('design', val, setDesign)} aria-pressed={design === val}
            style={{ flex: 1, justifyContent: 'center', padding: '9px',
              ...(design === val ? { borderColor: 'var(--c-ac)', color: 'var(--c-ac)', background: 'var(--c-acd)' } : {}) }}>
            {lab}
          </button>
        ))}
      </div>
      {design === 'beta' && (
        <div style={{ marginTop: 10 }}>
          <label>Akzentfarbe</label>
          <div style={{ display: 'flex', gap: 8 }} role="radiogroup" aria-label="Akzentfarbe">
            {ACCENTS.map(a => (
              <button key={a.val} onClick={() => apply('accent', a.val, setAccent)}
                role="radio" aria-checked={accent === a.val} aria-label={a.label} title={a.label}
                style={{ width: 34, height: 34, borderRadius: 8, background: a.hex, cursor: 'pointer',
                  border: accent === a.val ? '2px solid var(--c-br)' : '2px solid transparent',
                  outlineOffset: 2, boxShadow: accent === a.val ? '0 0 0 1.5px var(--c-bg) inset' : 'none' }} />
            ))}
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--c-mu)', marginTop: 6 }}>
        1.0 Beta = neues „Werkbank"-Design (in Arbeit). Jederzeit zurückschaltbar.
      </div>
    </div>
  );
}

// ── Theme aus User-Objekt übernehmen (nach Login / Startup) ──
function applyUserTheme(theme?: string | null) {
  if (!theme) return;
  localStorage.setItem('azubiboard_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Global Toast Hook ─────────────────────────────────────────
type ToastState = null | string | { msg: string; undo: (() => void) | null; duration: number };
type ShowToast = (msg: string, opts?: { undo?: (() => void) | null; duration?: number }) => void;
function useToast() {
  // toast = null | string | { msg, undo, duration }
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = useCallback((msg: string, opts?: { undo?: (() => void) | null; duration?: number }) => {
    clearTimeout(timer.current);
    if (opts && typeof opts === 'object') {
      const duration = opts.duration ?? (opts.undo ? 6000 : 2800);
      setToast({ msg, undo: opts.undo || null, duration });
      timer.current = setTimeout(() => setToast(null), duration);
    } else {
      setToast(msg);
      timer.current = setTimeout(() => setToast(null), 2800);
    }
  }, []);
  const dismissToast = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  return { toast, showToast, dismissToast };
}

// ── Mobile Breakpoint ─────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const h = (e: MediaQueryListEvent) => setM(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return m;
}

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

// ── Theme ─────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('azubiboard_theme');
    // Beim ersten Besuch (kein gespeicherter Wert): OS-Präferenz übernehmen
    const t = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    if (!stored) localStorage.setItem('azubiboard_theme', t);
    document.documentElement.setAttribute('data-theme', t);
    return t;
  });
  // OS-Theme-Änderungen live mitsynchronisieren (nur wenn kein manuelles Override)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      // Nur anpassen wenn das Theme noch dem OS-Standard entspricht (kein manuelles Toggle)
      const stored = localStorage.getItem('azubiboard_theme_manual');
      if (stored) return; // Nutzer hat manuell gewählt → ignorieren
      const next = e.matches ? 'light' : 'dark';
      setTheme(next);
      localStorage.setItem('azubiboard_theme', next);
      document.documentElement.setAttribute('data-theme', next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('azubiboard_theme', next);
      localStorage.setItem('azubiboard_theme_manual', '1'); // OS-Sync deaktivieren
      document.documentElement.setAttribute('data-theme', next);
      if (USE_API) dataService.syncTheme(next);
      return next;
    });
  }, []);
  return { theme, toggleTheme };
}

// J7: Permission-Row im Notification-Dropdown
function NotificationPermissionRow() {
  const [perm, setPerm]       = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    let mounted = true;
    import('./lib/webPush.js').then(m => {
      if (!mounted) return;
      setEnabledState(m.isEnabled());
      setPerm(m.currentPermission());
    });
    return () => { mounted = false; };
  }, []);

  if (perm === 'unsupported') return null;

  const ask = async () => {
    const m = await import('./lib/webPush.js');
    const result = await m.requestPermission();
    setPerm(result);
  };
  const toggle = async () => {
    const m = await import('./lib/webPush.js');
    const next = !enabled;
    m.setEnabled(next);
    setEnabledState(next);
  };

  if (perm === 'default') {
    return (
      <div style={{ padding: '9px 14px', borderBottom: '1px solid var(--c-bd)', background: 'rgba(0,113,227,.06)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 9 }}>
        <span aria-hidden="true">🔔</span>
        <span style={{ flex: 1, color: 'var(--c-tx)' }}>Browser-Benachrichtigungen erlauben?</span>
        <button onClick={ask} className="abtn" style={{ padding: '4px 9px', fontSize: 10 }}>Erlauben</button>
      </div>
    );
  }
  if (perm === 'denied') {
    return (
      <div style={{ padding: '7px 14px', borderBottom: '1px solid var(--c-bd)', fontSize: 10, color: 'var(--c-mu)', fontStyle: 'italic' }}>
        🔕 Browser-Notifications blockiert (in den Browser-Einstellungen freigeben)
      </div>
    );
  }
  // granted → Toggle anzeigen
  return (
    <label style={{ padding: '7px 14px', borderBottom: '1px solid var(--c-bd)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--c-mu)' }}>
      <input type="checkbox" checked={enabled} onChange={toggle} />
      <span style={{ flex: 1 }}>Browser-Push aktiv</span>
      <span style={{ fontSize: 9, color: 'var(--c-gr)' }}>● {enabled ? 'AN' : 'AUS'}</span>
    </label>
  );
}

function NotificationItem({ n, read, onMarkRead, navigate, onClose }: {
  n: NotificationEntry; read: boolean; onMarkRead: (id: string) => void; navigate: (to: string) => void; onClose: () => void;
}) {
  const clr = ({ critical: 'var(--c-cr)', warning: 'var(--c-yw)', info: 'var(--c-ac)' } as Record<string, string>)[n.severity] || 'var(--c-ac)';
  const Icon = n.severity === 'critical' ? IcoAlert : n.type === 'report' ? IcoReport : IcoClock;
  const handleClick = () => {
    onMarkRead(n.id);
    onClose();
    if (n.projectId) navigate(`/project/${n.projectId}`);
    else if (n.type === 'report') navigate('/reports');
  };
  return (
    <button onClick={handleClick}
      style={{ width: '100%', display: 'flex', gap: 10, padding: '10px 14px', border: 'none', borderBottom: '1px solid var(--c-bd)', background: read ? 'transparent' : 'rgba(0,113,227,.05)', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf2)'}
      onMouseLeave={e => e.currentTarget.style.background = read ? 'transparent' : 'rgba(0,113,227,.05)'}>
      <div style={{ width: 26, height: 26, borderRadius: 6, background: clr + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
        <Icon size={12} style={{ color: clr }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: read ? 500 : 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
        <div style={{ fontSize: 11, color: 'var(--c-mu)', marginTop: 1 }}>{n.message}</div>
        {n.projectTitle && <div style={{ fontSize: 10, color: 'var(--c-mu)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {n.projectTitle}</div>}
      </div>
      {!read && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-ac)', flexShrink: 0, marginTop: 7 }} />}
    </button>
  );
}

function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { data, currentUser } = useAppStore();
  const navigate = useNavigate();
  const { notifications, unreadCount, readIds, markRead, markAllRead } = useNotifications(data as AppState | null, currentUser as User | null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top, left: r.right + 8 });
    }
    setOpen(o => !o);
  };

  return (
    <div style={{ padding: '0 6px 4px' }}>
      <button ref={btnRef} onClick={handleToggle} title={collapsed ? 'Benachrichtigungen' : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: '1px solid var(--c-bd)', background: open ? 'var(--c-acd)' : 'var(--c-sf2)', color: unreadCount > 0 ? 'var(--c-br)' : 'var(--c-mu)', fontSize: 12, cursor: 'pointer', position: 'relative', transition: 'background .1s' }}>
        <IcoBell size={13} />
        {!collapsed && <span style={{ flex: 1, textAlign: 'left' }}>Benachrichtigungen</span>}
        {unreadCount > 0 && (
          <span style={{ ...(collapsed ? { position: 'absolute', top: 3, right: 3 } : {}), background: 'var(--c-cr)', color: '#fff', borderRadius: 10, fontSize: 9, fontWeight: 800, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: 310, maxHeight: 460, background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,.6)', zIndex: 850, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderBottom: '1px solid var(--c-bd)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-br)' }}>Benachrichtigungen</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unreadCount > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--c-ac)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Alle gelesen</button>}
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-mu)', padding: 0, display: 'flex', alignItems: 'center' }}><IcoX size={14} /></button>
            </div>
          </div>
          <NotificationPermissionRow />
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0
              ? <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--c-mu)', fontSize: 13 }}>Alles erledigt ✓</div>
              : notifications.map(n => <NotificationItem key={n.id} n={n} read={readIds.has(n.id)} onMarkRead={markRead} navigate={navigate} onClose={() => setOpen(false)} />)
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Keyboard Shortcuts Help ───────────────────────────────────
function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(onClose);  // Phase 4: Escape + Fokus-Trap + Body-Lock ('?' schließt via globalem Handler)

  const groups = [
    { title: 'Navigation', items: [['G dann D', 'Dashboard'],['G dann P', 'Projekte'],['G dann K', 'Kalender'],['G dann R', 'Berichte'],['G dann T', 'Ausbildungsplan'],['G dann L', 'Lernbereich'],['G dann U', 'Nutzer (Ausbilder)']] },
    { title: 'Aktionen', items: [['N', 'Neues Projekt (Ausbilder)'],['Ctrl+K', 'Suche öffnen'],['?', 'Shortcuts anzeigen']] },
    { title: 'Allgemein', items: [['Esc', 'Dialog schließen'],['←→', 'Kanban: Status verschieben']] },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 910, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Tastaturkürzel" tabIndex={-1} style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 14, width: 480, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--c-bd)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-br)' }}>⌨️ Tastaturkürzel</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--c-mu)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map(g => (
            <div key={g.title}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.items.map(([k, l]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <kbd style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-br)', fontFamily: 'monospace', minWidth: 90, textAlign: 'center', flexShrink: 0 }}>{k}</kbd>
                    <span style={{ fontSize: 13, color: 'var(--c-mu)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--c-bd)', fontSize: 11, color: 'var(--c-mu)', textAlign: 'center' }}>
          Drücke <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)' }}>?</kbd> um diese Übersicht zu schließen
        </div>
      </div>
    </div>
  );
}

// ── Global Search ─────────────────────────────────────────────
const SEARCH_ICONS: Record<string, string> = { project: '📁', task: '⚡', report: '📝', learn: '📖', default: '🔍' };

// UI-Trefferform für die globale Suche (lokal + API gemerged). Kein Domain-Typ.
interface SearchHit { type: string; label: string; sub?: string | null; to: string; icon: string; }
function GlobalSearch({ data, onClose }: { data: AppState | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dQ  = useDebounce(q, 300);
  const ref = useRef<HTMLInputElement>(null);
  // SearchResult vom Server (JS/API-Boundary): icon-Feld ist dort der Key, hier wird gemappt.
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { ref.current?.focus(); }, []);
  const dialogRef = useDialog<HTMLDivElement>(onClose);  // Phase 4: Escape + Fokus-Trap + Body-Lock

  // Server-FULLTEXT wenn API aktiv und mind. 2 Zeichen
  useEffect(() => {
    const trimmed = dQ.trim();
    let cancelled = false;
    const run = async () => {
      if (!USE_API || trimmed.length < 2) { setApiResults([]); setLoading(false); return; }
      setLoading(true);
      const res = await dataService.search(trimmed);
      if (!cancelled) { setApiResults(res); setLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [dQ]);

  const lower = dQ.trim().toLowerCase();

  // Lokale Fallback-Ergebnisse (immer verfügbar, auch offline)
  const localResults: SearchHit[] = lower.length >= 2 ? [
    ...(data?.projects||[]).filter((p: Project) => !p.archived && (p.title.toLowerCase().includes(lower) || (p.description||'').toLowerCase().includes(lower)))
      .slice(0,5).map((p: Project) => ({ type: 'Projekt', label: p.title, sub: p.description, to: `/project/${p.id}`, icon: '📁' })),
    ...(data?.users||[]).filter((u: User) => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower))
      .slice(0,3).map((u: User) => ({ type: 'Nutzer', label: u.name, sub: u.email, to: '/users', icon: '👤' })),
    ...(data?.reports||[]).filter((r: Report) =>
        (r.title||'').toLowerCase().includes(lower) ||
        (r.user_name||'').toLowerCase().includes(lower) ||
        `kw ${r.week_number}/${r.year}`.includes(lower) ||
        String(r.week_number ?? '').includes(lower))
      .slice(0,4).map((r: Report) => ({ type: 'Bericht', label: r.title || `KW ${r.week_number}/${r.year}`, sub: `${r.user_name ? r.user_name + ' · ' : ''}KW ${r.week_number}/${r.year}`, to: '/reports', icon: '📝' })),
    ...(data?.calendarEvents||[]).filter((e: any) => (e.title||'').toLowerCase().includes(lower))
      .slice(0,3).map((e: any) => ({ type: 'Termin', label: e.title, sub: e.date || null, to: '/calendar', icon: '📅' })),
    ...(data?.learningPaths||[]).filter((lp: any) => (lp.title||'').toLowerCase().includes(lower) || (lp.nodes||[]).some((n: any) => (n.title||'').toLowerCase().includes(lower)))
      .slice(0,3).map((lp: any) => ({ type: 'Lernpfad', label: lp.title, sub: (lp.nodes||[]).find((n: any) => (n.title||'').toLowerCase().includes(lower))?.title || null, to: '/learn', icon: '📖' })),
  ] : [];

  // API-Ergebnisse haben Priorität; lokale Nutzer-Suche immer ergänzen
  const userResults: SearchHit[] = lower.length >= 2
    ? (data?.users||[]).filter((u: User) => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower))
        .slice(0,3).map((u: User) => ({ type: 'Nutzer', label: u.name, sub: u.email, to: '/users', icon: '👤' }))
    : [];

  const apiMapped = apiResults.map((r: any) => ({
    ...r,
    icon: SEARCH_ICONS[r.icon] || SEARCH_ICONS.default,
  }));

  const results = lower.length >= 2
    ? (USE_API ? [...apiMapped, ...userResults] : localResults)
    : [];

  const go = (to: string) => { navigate(to); onClose(); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 900, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Suche" style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 14, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--c-bd)' }}>
          <IcoSearch size={16} style={{ color: 'var(--c-mu)', flexShrink: 0 }} />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Projekte, Nutzer, Berichte, Termine, Lernpfade…"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: 'var(--c-br)', outline: 'none', padding: 0 }} />
          <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-mu)', flexShrink: 0 }}>Esc</kbd>
        </div>
        {results.length > 0 ? (
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 0' }}>
            {results.map((r, i) => (
              <button key={i} onClick={() => go(r.to)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                  {r.sub && <div style={{ fontSize: 11, color: 'var(--c-mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>}
                </div>
                <span style={{ fontSize: 10, color: 'var(--c-mu)', background: 'var(--c-sf3)', border: '1px solid var(--c-bd)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>{r.type}</span>
              </button>
            ))}
          </div>
        ) : loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-mu)', fontSize: 13 }}>Suche…</div>
        ) : lower.length >= 2 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-mu)', fontSize: 13 }}>Keine Ergebnisse für „{q}"</div>
        ) : (
          <div style={{ padding: '16px 20px', fontSize: 11, color: 'var(--c-mu)' }}>
            <div style={{ marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 }}>Tastaturkürzel</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {[['Ctrl+K', 'Suche öffnen'],['N', 'Neues Projekt'],['Esc', 'Schließen']].map(([k,l]) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-br)' }}>{k}</kbd>
                  <span style={{ fontSize: 11 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────
interface SidebarProps {
  currentUser: User | null;
  onLogout: () => void;
  onNewProject: () => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShowBackups?: (() => void) | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSearch: () => void;
  theme: string;
  onToggleTheme: () => void;
  isMobile: boolean;
  drawerOpen: boolean;
  onCloseDrawer?: () => void;
  trashCount?: number;
}
function Sidebar({ currentUser, onLogout, onNewProject, onExport, onImport, onShowBackups, collapsed, onToggleCollapse, onSearch, theme, onToggleTheme, isMobile, drawerOpen, onCloseDrawer, trashCount: _trashCount = 0 }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const path     = location.pathname;
  const isAusbilder = currentUser?.role === 'ausbilder';

  const handleNav = (to: string) => { navigate(to); if (isMobile) onCloseDrawer?.(); };

  // Phase 2: Navigation in „Arbeiten" / „Verwalten" gruppiert
  const navGroups = [
    { label: 'Arbeiten', items: [
      { to: '/dashboard', label: 'Dashboard',       Icon: IcoDashboard },
      { to: '/projects',  label: 'Projekte',        Icon: IcoFolder    },
      { to: '/calendar',  label: 'Kalender',        Icon: IcoCalendar  },
      { to: '/reports',   label: 'Berichtshefte',   Icon: IcoReport    },
      { to: '/training',  label: 'Ausbildungsplan', Icon: IcoRequire   },
      { to: '/learn',     label: 'Lernbereich',     Icon: IcoLearn     },
    ] },
    { label: 'Verwalten', items: [
      { to: '/groups',    label: 'Gruppen',         Icon: IcoUsers     },
      ...(isAusbilder ? [{ to: '/users', label: 'Nutzer', Icon: IcoUserEdit }] : []),
      { to: '/trash',     label: 'Papierkorb',      Icon: IcoTrash     },
    ] },
  ];

  const hue = (currentUser?.name?.charCodeAt(0) || 100) * 37 % 360;
  const w   = isMobile ? 220 : (collapsed ? 52 : 200);

  const drawerStyle: React.CSSProperties = isMobile ? {
    position:  'fixed',
    left:      0,
    top:       0,
    zIndex:    900,
    height:    '100dvh',
    transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform .25s ease',
    boxShadow: drawerOpen ? '4px 0 32px rgba(0,0,0,.45)' : 'none',
  } : {};

  return (
    <aside style={{ width: w, flexShrink: 0, background: 'var(--c-sf)', borderRight: '1px solid var(--c-bd)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', transition: isMobile ? 'transform .25s ease' : 'width .2s ease', ...drawerStyle }}>

      {/* Logo + Collapse Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9, padding: collapsed ? '14px 11px' : '14px 12px 10px', borderBottom: '1px solid var(--c-bd)', flexShrink: 0, justifyContent: collapsed ? 'center' : 'space-between' }}>
        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', minWidth: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: 'linear-gradient(135deg, var(--c-ac), #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', boxShadow: '0 2px 8px rgba(0,113,227,0.35)' }}>A</div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-br)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>AzubiBoard</div>
              <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 1 }}>PM System</div>
            </div>
          )}
        </div>
        {isMobile
          ? <button onClick={onCloseDrawer} aria-label="Menü schließen"
              style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--c-mu)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 16, padding: 0 }}>×</button>
          : <button onClick={onToggleCollapse} title={collapsed ? 'Aufklappen' : 'Einklappen'}
              style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--c-mu)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, padding: 0 }}>
              {collapsed ? '›' : '‹'}
            </button>
        }
      </div>

      {/* Search */}
      <div style={{ padding: '4px 6px 0' }}>
        <button onClick={onSearch} title="Suchen (Strg+K)"
          style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: '1px solid var(--c-bd)', background: 'var(--c-sf2)', color: 'var(--c-mu)', fontSize: 12, cursor: 'pointer', marginBottom: 4 }}>
          <IcoSearch size={13} />
          {!collapsed && <>
            <span style={{ flex: 1 }}>Suchen…</span>
            <kbd style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-mu)' }}>Ctrl+K</kbd>
          </>}
        </button>
      </div>

      {/* Benachrichtigungen */}
      <NotificationBell collapsed={collapsed} />

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 6px', overflowY: 'auto' }}>
        {navGroups.map((group, gi) => (
          <div key={group.label} style={{ marginTop: gi === 0 ? 0 : 8 }}>
            {!collapsed && (
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 1, padding: '6px 10px 4px', opacity: .7 }}>{group.label}</div>
            )}
            {group.items.map(({ to, label, Icon: NavIcon }) => {
              const active = path === to || (to !== '/dashboard' && path.startsWith(to));
              return (
                <button key={to} onClick={() => handleNav(to)} title={collapsed ? label : undefined}
                  style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '9px' : '8px 10px', borderRadius: 8, border: 'none', background: active ? 'var(--c-acd)' : 'transparent', color: active ? 'var(--c-ac)' : 'var(--c-mu)', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 1, transition: 'all .12s', borderLeft: active ? '2px solid var(--c-ac)' : '2px solid transparent' }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--c-sf2)'; e.currentTarget.style.color = 'var(--c-br)'; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-mu)'; }}}>
                  <NavIcon size={14} />
                  {!collapsed && label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div style={{ padding: collapsed ? '8px 6px 12px' : '8px 8px 12px', borderTop: '1px solid var(--c-bd)', flexShrink: 0 }}>
        {!collapsed && (
          <>
            {/* Neues Projekt (0.6: nur Ausbilder — Azubi/Mentor bekommen Projekte zugewiesen) */}
            {isAusbilder && (
              <button className="abtn" onClick={onNewProject} style={{ width: '100%', justifyContent: 'center', marginBottom: 6, fontSize: 12 }}>
                <IcoPlus size={12} /> Neues Projekt
              </button>
            )}

            {/* Export / Import */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <button className="btn" onClick={onExport} title="Daten als JSON exportieren" style={{ flex: 1, fontSize: 10, padding: '5px 0', justifyContent: 'center' }}>↓ Export</button>
              <label className="btn" title="JSON-Backup importieren" style={{ flex: 1, fontSize: 10, padding: '5px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, margin: 0 }}>
                ↑ Import
                <input type="file" accept=".json" onChange={onImport} style={{ display: 'none' }} />
              </label>
            </div>
            {/* L4: Server-Backups (nur Ausbilder) */}
            {isAusbilder && onShowBackups && (
              <button className="btn" onClick={onShowBackups} title="Tägliche Server-Snapshots verwalten"
                style={{ width: '100%', fontSize: 10, padding: '5px 0', justifyContent: 'center', marginBottom: 6 }}>
                💾 Server-Backups
              </button>
            )}

            {/* User → klickbar → Profil-Seite */}
            <button onClick={() => handleNav('/profile')} title="Mein Profil"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: path === '/profile' ? 'var(--c-acd)' : 'var(--c-sf2)', marginBottom: 5, border: 'none', borderLeft: path === '/profile' ? '2px solid var(--c-ac)' : '2px solid transparent', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background .1s' }}
              onMouseEnter={e => { if (path !== '/profile') e.currentTarget.style.background = 'var(--c-sf3)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = path === '/profile' ? 'var(--c-acd)' : 'var(--c-sf2)'; }}>
              {currentUser?.avatar_url
                ? <img src={currentUser.avatar_url} alt={currentUser.name} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: `hsl(${hue},45%,22%)`, border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: `hsl(${hue},65%,75%)` }}>
                    {currentUser?.name?.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()}
                  </div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.name?.split(' ')[0]}</div>
                <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {currentUser?.role === 'azubi' ? `Azubi · LJ ${currentUser?.apprenticeship_year || 1}` : currentUser?.role === 'mentor' ? 'Mentor' : 'Ausbilder'}
                </div>
              </div>
              <span style={{ fontSize: 9, color: 'var(--c-mu)', flexShrink: 0 }}>›</span>
            </button>
          </>
        )}

        {collapsed && (
          <>
            {isAusbilder && (
              <button onClick={onNewProject} title="Neues Projekt" className="abtn" style={{ width: '100%', padding: '8px', justifyContent: 'center', marginBottom: 4, fontSize: 14 }}>
                <IcoPlus size={14} />
              </button>
            )}
            <button onClick={() => handleNav('/profile')} title="Mein Profil"
              style={{ width: '100%', padding: '6px', borderRadius: 7, border: 'none', background: 'var(--c-sf2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              {currentUser?.avatar_url
                ? <img src={currentUser.avatar_url} alt={currentUser.name} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(255,255,255,0.1)' }} />
                : <div style={{ width: 22, height: 22, borderRadius: '50%', background: `hsl(${hue},45%,22%)`, border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: `hsl(${hue},65%,75%)` }}>
                    {currentUser?.name?.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()}
                  </div>}
            </button>
          </>
        )}

        <button onClick={onToggleTheme} title={theme === 'dark' ? 'Light-Mode' : 'Dark-Mode'}
          style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 7, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--c-mu)', fontSize: 12, cursor: 'pointer', marginBottom: 2 }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {theme === 'dark' ? <IcoSun size={13} /> : <IcoMoon size={13} />}
          {!collapsed && (theme === 'dark' ? 'Light-Mode' : 'Dark-Mode')}
        </button>

        <button onClick={onLogout} title="Abmelden"
          style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 7, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '8px' : '7px 10px', borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--c-cr)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-crd)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <IcoLogout size={13} />
          {!collapsed && 'Abmelden'}
        </button>
      </div>
    </aside>
  );
}

// ── ProjectDetail Wrapper ─────────────────────────────────────
function ProjectDetailWrapper({ showToast }: { showToast: ShowToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useAppStore();
  const data = store.data as AppState | null;
  const setData = store.setData;
  const currentUser = store.currentUser as User | null;
  const project = data?.projects?.find((p: Project) => p.id === id);

  // updates bleibt any: ProjectDetail liefert heterogene Patches (UpdateFn = (id:any, patch:any)).
  // Phase 2: Mentor = nur lesend. Alle Projekt-Schreibpfade laufen durch diesen choke point.
  const handleUpdate = useCallback((projectId: string, updates: any) => {
    if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
    setData({ ...data, projects: (data?.projects||[]).map((p: Project) => p.id === projectId ? { ...p, ...updates } : p) });
  }, [data, setData, currentUser, showToast]);

  const handleArchive = useCallback((projectId: string) => {
    const snapshot = data;
    setData({ ...data, projects: (data?.projects||[]).map((p: Project) => p.id === projectId ? { ...p, archived: true } : p) });
    showToast('📦 Projekt archiviert', { undo: () => setData(snapshot as any) });  // Phase 4: Undo konsistent zur Listen-Archivierung
  }, [data, setData, showToast]);

  // entry/prev: addActivity-Boundary (utils.js liefert Blob-Form) → any belassen.
  const handleActivity = useCallback((entry: any) => {
    setData((prev: any) => addActivity(prev, entry));
  }, [setData]);

  if (!project) return <div className="card" style={{ margin: 24 }}>Projekt nicht gefunden</div>;

  // project ist Project (tasks/materials/requirements via zod default vorhanden) — die
  // Literal-Defaults werden bewusst von project überschrieben; Spread als Record getypt,
  // damit TS die (gewollten) Schlüssel-Überschreibungen nicht als Fehler meldet.
  const safeProject = {
    tasks: [], steps: [], materials: [], requirements: [],
    links: [], calendarEvents: [], assignees: [],
    netzplan: { nodes: [], edges: [], unit: 'W', nodePositions: {} },
    ...(project as Record<string, unknown>),
  };

  return (
    <ProjectDetail
      project={safeProject}
      users={data?.users || []}
      groups={data?.groups || []}
      currentUser={currentUser}
      onUpdate={handleUpdate}
      onArchive={handleArchive}
      onBack={() => navigate('/projects')}
      showToast={showToast}
      onActivity={handleActivity}
    />
  );
}

// ── Profil-Seite ──────────────────────────────────────────────
function ProfilePage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const currentUser = store.currentUser as User | null;
  const data = store.data as AppState | null;
  const setCurrentUser = store.setCurrentUser;
  const setData = store.setData;
  const [tab, setTab]               = useState('info');
  const [name, setName]             = useState(() => currentUser?.name || '');
  const [profession, setProfession] = useState(() => currentUser?.profession || '');
  const [year, setYear]             = useState(() => String(currentUser?.apprenticeship_year || 1));
  const [oldPw, setOldPw]           = useState('');
  const [newPw, setNewPw]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [avatarHov, setAvatarHov]   = useState(false);
  const avatarInputRef              = useRef<HTMLInputElement>(null);
  const toast = showToast || (() => {});

  if (!currentUser) return null;

  const isAzubi = currentUser.role === 'azubi';
  const myProjects = (data?.projects || []).filter((p: Project) => !p.archived && p.assignees?.includes(currentUser.id));
  const hue = (currentUser.name?.charCodeAt(0) || 100) * 37 % 360;

  // Eingabe-Style wiederverwenden
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--c-bd2)', background: 'var(--c-sf2)', color: 'var(--c-br)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 };

  const saveProfile = async () => {
    const trimName = name.trim();
    const trimProf = profession.trim();
    const parsedYear = Number(year);
    if (!trimName) return;

    const changes: any = {};
    if (trimName !== currentUser.name)                             changes.name = trimName;
    if (trimProf !== (currentUser.profession || ''))              changes.profession = trimProf;
    if (isAzubi && parsedYear !== (currentUser.apprenticeship_year || 1)) changes.apprenticeship_year = parsedYear;
    if (Object.keys(changes).length === 0) return;

    setSaving(true);
    try {
      if (USE_API) await dataService.updateProfile(changes);
      const updatedUser = { ...currentUser, ...changes };
      setCurrentUser(updatedUser);
      if (data) setData({ ...data, users: (data.users || []).map((u: User) => u.id === currentUser.id ? { ...u, ...changes } : u) });
      toast('✓ Profil gespeichert');
    } catch (e: any) { toast('⚠ ' + e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (!oldPw || newPw.length < 8) return;
    setSaving(true);
    try {
      if (USE_API) {
        await dataService.changePassword(oldPw, newPw);
        toast('✓ Passwort geändert');
        setOldPw(''); setNewPw('');
      } else {
        toast('⚠ Passwortänderung nur im API-Modus verfügbar');
      }
    } catch (e: any) { toast('⚠ ' + e.message); }
    finally { setSaving(false); }
  };

  const handleAvatarClick = () => {
    if (!USE_API) { toast('⚠ Avatar-Upload nur im API-Modus verfügbar'); return; }
    avatarInputRef.current?.click();
  };
  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const { avatar_url } = await dataService.uploadAvatar(file);
      const updatedUser = { ...currentUser, avatar_url };
      setCurrentUser(updatedUser);
      if (data) setData({ ...data, users: (data.users || []).map((u: User) => u.id === currentUser.id ? { ...u, avatar_url } : u) });
      toast('✓ Profilbild gespeichert');
    } catch (err: any) { toast('⚠ ' + err.message); }
    finally { setSaving(false); e.target.value = ''; }
  };

  const tabBtn = (key: string, label: string) => (
    <button key={key} onClick={() => setTab(key)} role="tab" aria-selected={tab === key}
      style={{ flex: 1, padding: '8px', borderRadius: 6, fontSize: 13, fontWeight: 700, border: 'none',
        background: tab === key ? 'var(--c-ac)' : 'transparent',
        color: tab === key ? '#fff' : 'var(--c-mu)', transition: 'all .15s' }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      {/* Avatar + Header */}
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
        {/* Klickbarer Avatar mit Kamera-Overlay */}
        <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
          onClick={handleAvatarClick}
          onMouseEnter={() => setAvatarHov(true)}
          onMouseLeave={() => setAvatarHov(false)}
          title="Profilbild ändern">
          {currentUser.avatar_url
            ? <img src={currentUser.avatar_url} alt={currentUser.name}
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.1)', display: 'block' }} />
            : <div style={{ width: 56, height: 56, borderRadius: '50%', background: `hsl(${hue},45%,22%)`, border: '2px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: `hsl(${hue},65%,75%)` }}>
                {currentUser.name?.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()}
              </div>}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: avatarHov ? 1 : 0, transition: 'opacity .15s' }}>
            <span style={{ fontSize: 16 }}>📷</span>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }} onChange={handleAvatarFile} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-br)' }}>{currentUser.name}</div>
          <div style={{ fontSize: 12, color: 'var(--c-mu)', marginTop: 2 }}>
            {currentUser.email}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-mu)', marginTop: 2 }}>
            {isAzubi
              ? `Azubi · Lehrjahr ${currentUser.apprenticeship_year || 1}${currentUser.profession ? ` · ${currentUser.profession}` : ''}`
              : `${currentUser.role === 'mentor' ? 'Mentor' : 'Ausbilder'}${currentUser.profession ? ` · ${currentUser.profession}` : ''}`}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Aktive Projekte',  value: myProjects.length,                                                                                     color: 'var(--c-ac)' },
          { label: 'Offene Aufgaben',  value: myProjects.flatMap((p: Project) => p.tasks||[]).filter((t: Task) => t.assignee === currentUser.id && t.status !== 'done').length, color: 'var(--c-yw)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ borderLeft: `3px solid ${s.color}`, padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card">
        <div role="tablist" style={{ display: 'flex', background: 'var(--c-sf2)', borderRadius: 8, padding: 3, marginBottom: 18, gap: 3 }}>
          {tabBtn('info', 'Profil')}
          {tabBtn('password', 'Passwort')}
          {USE_API && tabBtn('security', '🔒 Sicherheit')}
        </div>

        {tab === 'info' && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Anzeigename</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Ausbildungsberuf</label>
              <input value={profession} onChange={e => setProfession(e.target.value)}
                placeholder="z. B. Fachinformatiker Anwendungsentwicklung"
                style={inputStyle} />
            </div>
            {isAzubi && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Lehrjahr</label>
                <select value={year} onChange={e => setYear(e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto' }}>
                  <option value="1">1. Lehrjahr</option>
                  <option value="2">2. Lehrjahr</option>
                  <option value="3">3. Lehrjahr</option>
                </select>
              </div>
            )}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>E-Mail</label>
              <input value={currentUser.email} disabled
                style={{ ...inputStyle, border: '1px solid var(--c-bd)', background: 'var(--c-sf3)', color: 'var(--c-mu)', opacity: .7 }} />
            </div>
            <button className="abtn" onClick={saveProfile} disabled={saving || !name.trim()}
              style={{ width: '100%', padding: 11, fontSize: 13 }}>
              {saving ? 'Speichern…' : 'Profil speichern'}
            </button>
            <button className="btn" onClick={() => {
              if (currentUser?.id) localStorage.removeItem(`azubiboard_onboarded_${currentUser.id}`);
              window.dispatchEvent(new Event('azubiboard:show-onboarding'));
            }} style={{ width: '100%', marginTop: 8, padding: '9px', fontSize: 12, color: 'var(--c-ac)', borderColor: 'var(--c-ac)60' }}>
              🎓 Einführungs-Wizard erneut anzeigen
            </button>
            <button className="btn" onClick={() => window.dispatchEvent(new Event('azubiboard:show-news'))}
              style={{ width: '100%', marginTop: 8, padding: '9px', fontSize: 12, color: 'var(--c-ac)', borderColor: 'var(--c-ac)60' }}>
              📰 Tagesübersicht anzeigen
            </button>
            <DesignSwitch />
          </div>
        )}

        {tab === 'password' && (
          <div>
            {!USE_API && (
              <div style={{ fontSize: 12, color: 'var(--c-mu)', background: 'var(--c-sf2)', borderRadius: 7, padding: '10px 12px', marginBottom: 14, borderLeft: '3px solid var(--c-yw)' }}>
                Passwortänderung ist nur im API-Modus verfügbar (VITE_USE_API=true).
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Aktuelles Passwort</label>
              <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} disabled={!USE_API}
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Neues Passwort (min. 8 Zeichen)</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} disabled={!USE_API}
                style={inputStyle} />
            </div>
            <button className="abtn" onClick={savePassword}
              disabled={saving || !USE_API || !oldPw || newPw.length < 8}
              style={{ width: '100%', padding: 11, fontSize: 13 }}>
              {saving ? 'Ändern…' : 'Passwort ändern'}
            </button>
          </div>
        )}

        {tab === 'security' && (
          <Suspense fallback={<div style={{ fontSize: 12, color: 'var(--c-mu)' }}>Lädt …</div>}>
            <TwoFactorSettings showToast={showToast} />
          </Suspense>
        )}
      </div>
    </div>
  );
}

// ── Seiten-Wrapper ────────────────────────────────────────────
function CalendarPage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const setData = store.setData;
  // updates bleibt any: CalendarView onUpdate = (id:any, patch:any), patch heterogen (ev/id/Projekt-Patch).
  // Mentor = nur lesend (wie ProjectDetail/Dashboard) — alle Kalender-Schreibpfade laufen durch diesen choke point.
  const handleUpdate = useCallback((projectId: string, updates: any) => {
    if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
    // Funktionale Updates: saveEdit (CalendarView) ruft beim Projekt-Wechsel onUpdate ZWEIMAL
    // synchron auf — Objekt-Form würde beim zweiten Aufruf den stale Closure-Snapshot spreaden
    // und den ersten Update überschreiben (Event-Duplikate, persistiert).
    if (projectId === '_cal') {
      setData((prev: any) => prev ? { ...prev, calendarEvents: [...(prev.calendarEvents || []), updates.ev] } : prev);
    } else if (projectId === '_cal_del') {
      setData((prev: any) => prev ? { ...prev, calendarEvents: (prev.calendarEvents || []).filter((e: CalendarEvent) => e.id !== updates.id) } : prev);
    } else if (projectId === '_cal_edit') {
      setData((prev: any) => prev ? { ...prev, calendarEvents: (prev.calendarEvents || []).map((e: CalendarEvent) => e.id === updates.ev.id ? updates.ev : e) } : prev);
    } else {
      setData((prev: any) => prev ? { ...prev, projects: (prev.projects || []).map((p: Project) => p.id === projectId ? { ...p, ...updates } : p) } : prev);
    }
  }, [setData, currentUser, showToast]);
  return <CalendarView projects={data?.projects||[]} calendarEvents={data?.calendarEvents||[]} users={data?.users||[]} onUpdate={handleUpdate} showToast={showToast} canEdit={currentUser?.role !== 'mentor'} />;
}

function GroupsPage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const setData = store.setData;
  // groups: GroupsView-eigener Group-Typ (nicht in types.ts) → any belassen.
  const handleUpdateGroups = useCallback((groups: any) => setData({ ...data, groups }), [data, setData]);
  // groups/projects: GroupsView erwartet eigene Group/GroupProject-Typen (enger als AppState-Blob) → cast.
  return <GroupsView groups={(data?.groups||[]) as any} users={data?.users||[]} projects={(data?.projects||[]) as any} onUpdateGroups={handleUpdateGroups} showToast={showToast} canManage={currentUser?.role === 'ausbilder'} />;
}

function AzubiProfileWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const azubi = (data?.users || []).find((u: User) => u.id === id);
  // data-Prop bleibt locker: AzubiProfilePage erwartet eigenen ProfileData-Typ, nicht AppState.
  return <AzubiProfilePage azubi={azubi} data={data as any} currentUser={currentUser} onBack={() => navigate(-1)} />;
}

function UsersPage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const data = store.data as AppState | null;
  const setData = store.setData;
  // users: UsersView-eigener UserWithAuth-Typ (password etc.) → any belassen.
  const handleUpdate = useCallback((users: any) => setData({ ...data, users }), [data, setData]);
  return <UsersView users={(data?.users || []) as any} onUpdateUsers={handleUpdate} showToast={showToast} />;
}

function DashboardPage({ onNewProject, showToast }: { onNewProject: () => void; showToast: ShowToast }) {
  const navigate = useNavigate();
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const setData = store.setData;
  // updates bleibt any: Dashboard onUpdateProject = (id:any, patch:any).
  // Phase 2: Mentor = nur lesend (z.B. Task-Toggle in ProjectCard).
  const handleUpdate = useCallback((projectId: string, updates: any) => {
    if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
    setData({ ...data, projects: (data?.projects||[]).map((p: Project) => p.id === projectId ? { ...p, ...updates } : p) });
  }, [data, setData, currentUser, showToast]);
  return (
    <Dashboard user={currentUser} projects={data?.projects||[]} users={data?.users||[]} reports={data?.reports||[]} calendarEvents={data?.calendarEvents||[]}
      activityLog={data?.activityLog||[]}
      onOpenProject={(id: string) => navigate(`/project/${id}`)} onUpdateProject={handleUpdate} onNewProject={onNewProject} onNavigate={(path: string) => navigate('/' + path.replace(/^\//, ''))} />
  );
}

function ProjectsPage({ onNewProject, showToast }: { onNewProject: () => void; showToast: ShowToast }) {
  const navigate = useNavigate();
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User;
  const setData = store.setData;
  const duplicate = (id: Id) => {
    const src = (data?.projects||[]).find((p: Project) => p.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: `proj_${Date.now()}`,
      title: `Kopie von ${src.title}`,
      archived: false,
      comments: [],
      calendarEvents: [],
      tasks: (src.tasks || []).map((t: Task) => ({ ...t, id: `t_${Math.random().toString(36).slice(2)}`, status: 'open', done: false })),
    };
    setData({ ...data, projects: [...(data?.projects||[]), copy] });
    showToast('✓ Projekt dupliziert');
  };
  return (
    // projects/groups: ProjectPool erwartet eigene PoolProject/Group-Typen (groupId ohne null) → cast.
    <ProjectPool projects={(data?.projects||[]) as any} users={data?.users||[]} groups={(data?.groups||[]) as any} currentUser={currentUser}
      onOpen={(id: Id) => navigate(`/project/${id}`)} onNew={onNewProject}
      onDelete={(id: Id) => {
        const project  = (data?.projects||[]).find((p: Project) => p.id === id);
        const snapshot = data;
        if (project) {
          // softDelete: trash.js (JS-Boundary) → data/currentUser als any.
          setData(softDelete(data as any, 'projects', project, currentUser));
        } else {
          setData({ ...data, projects: (data?.projects||[]).filter((p: Project) => p.id !== id) });
        }
        showToast('🗑 Projekt → Papierkorb (30 Tage)', { undo: () => setData(snapshot as any) });
      }}
      onArchive={(id: Id) => {
        const snapshot = data;
        setData({ ...data, projects: (data?.projects||[]).map((p: Project) => p.id === id ? { ...p, archived: true } : p) });
        showToast('📦 Projekt archiviert', { undo: () => setData(snapshot as any) });
      }}
      onUnarchive={(id: Id) => { setData({ ...data, projects: (data?.projects||[]).map((p: Project) => p.id === id ? { ...p, archived: false } : p) }); showToast('Projekt wiederhergestellt'); }}
      onDuplicate={duplicate}
    />
  );
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
function AppLayout({ currentUser, onLogout, onNewProject, onExport, onImport, onSearch, onBackup, onShowBackups, trashCount = 0, children }: AppLayoutProps) {
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
      e.id && !seen.has(e.id) && String(e.userId) === String(currentUser.id));
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
            setCurrentUser(me);
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
    setData((prev: any) => prev ? { ...prev, users: (prev.users || []).map((u: User) => u.id === currentUser.id ? { ...u, ...changes } : u) } : prev);
  }, [currentUser, setCurrentUser, setData, showToast]);

  // Beitritts-Anfrage an eine Gruppe (Azubi-Schritt 3): schreibt currentUser.id in group.requests.
  // Der Ausbilder bestätigt sie später in der Gruppen-Verwaltung.
  const handleRequestGroup = useCallback((groupId: Id) => {
    if (!currentUser?.id) return;
    setData((prev: any) => prev ? { ...prev, groups: (prev.groups || []).map((g: any) =>
      g.id === groupId && ![...(g.members || []), ...(g.requests || [])].some((x: Id) => String(x) === String(currentUser.id))
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
    const newProject = { ...projectData, id: `proj_${Date.now()}`, tasks: [], steps: [], calendarEvents: [], archived: false };
    const withProject = { ...data, projects: [...(data?.projects || []), newProject] };
    const withActivity = addActivity(withProject, {
      type: 'project_created',
      userId: currentUser?.id,
      userName: currentUser?.name,
      entityTitle: newProject.title,
      projectId: newProject.id,
      projectTitle: newProject.title,
      action: `${currentUser?.name} hat Projekt "${newProject.title}" erstellt`,
    });
    setData(withActivity);
    setShowModal(false);
    showToast('✓ Projekt erstellt');
  }, [data, setData, showToast, currentUser]);

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
        setData(imported);
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
            const withUser = { ...data, users: [...(data?.users || []), newUser] };
            // Gruppen-Beitritt läuft nach dem Login per Anfrage (Onboarding-Wizard) → hier keine Gruppe.
            const withActivity = addActivity(withUser, {
              type: 'user_registered',
              userId: newUser.id,
              userName: newUser.name,
              entityTitle: newUser.name,
              projectId: null,
              projectTitle: null,
              action: `${newUser.name} hat sich registriert`,
            });
            setData(withActivity);
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
