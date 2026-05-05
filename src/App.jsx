import React, { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from './lib/store';
import { dataService } from './lib/dataService';
import { today, loadSession, clearSession, persistData } from './lib/utils';
import { setToken, clearToken, getToken, isTokenValid } from './lib/auth';
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

import AuthPage from './features/auth/AuthPage';
import Dashboard from './features/dashboard/Dashboard';
import ProjectPool from './features/projects/ProjectPool';
import ProjectDetail from './features/projects/ProjectDetail';
import LearnPage from './features/learn/LearnPage';
import ReportsPage from './features/reports/ReportsPage';
import NewProjectModal from './features/projects/NewProjectModal';
import CalendarView from './features/calendar/CalendarView';
import GroupsView from './features/groups/GroupsView';
import UsersView from './features/users/UsersView';
import { Toast } from './components/UI.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import {
  IcoDashboard, IcoFolder, IcoCalendar, IcoUsers,
  IcoReport, IcoLearn, IcoPlus, IcoLogout, IcoUserEdit, IcoSearch,
  IcoBell, IcoAlert, IcoClock, IcoX, IcoSun, IcoMoon,
} from './components/Icons.jsx';

// ── App-Mode (einmalig auf Modulebene) ───────────────────────
const USE_API = import.meta.env.VITE_USE_API === 'true';

// ── Theme aus User-Objekt übernehmen (nach Login / Startup) ──
function applyUserTheme(theme) {
  if (!theme) return;
  localStorage.setItem('azubiboard_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Global Toast Hook ─────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const showToast = useCallback((msg) => {
    clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  return { toast, showToast };
}

// ── Mobile Breakpoint ─────────────────────────────────────────
function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const h = e => setM(e.matches);
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
    const t = localStorage.getItem('azubiboard_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    return t;
  });
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('azubiboard_theme', next);
      document.documentElement.setAttribute('data-theme', next);
      // In API-Modus: Theme-Präferenz in der DB persistieren
      if (USE_API) dataService.syncTheme(next);
      return next;
    });
  }, []);
  return { theme, toggleTheme };
}

// ── Notifications ─────────────────────────────────────────────
function useNotifications(data, currentUser) {
  const storageKey = `azubiboard_notif_read_${currentUser?.id || 'anon'}`;
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
    catch { return new Set(); }
  });

  const notifications = useMemo(() => {
    if (!data || !currentUser) return [];
    const items = [];
    const now = new Date();

    (data.projects || []).filter(p => !p.archived).forEach(project => {
      (project.tasks || []).forEach(task => {
        if (task.assignee !== currentUser.id || task.status === 'done' || !task.deadline) return;
        const d = Math.ceil((new Date(task.deadline) - now) / 86400000);
        if (d < 0)
          items.push({ id: `task-${task.id}-overdue`, type: 'deadline', severity: 'critical', title: task.text, message: `Überfällig seit ${Math.abs(d)} Tag${Math.abs(d) !== 1 ? 'en' : ''}`, projectId: project.id, projectTitle: project.title });
        else if (d <= 3)
          items.push({ id: `task-${task.id}-soon`, type: 'deadline', severity: 'warning', title: task.text, message: d === 0 ? 'Heute fällig' : `Fällig in ${d} Tag${d !== 1 ? 'en' : ''}`, projectId: project.id, projectTitle: project.title });
      });

      if (project.assignees?.includes(currentUser.id) && project.deadline) {
        const d = Math.ceil((new Date(project.deadline) - now) / 86400000);
        if (d < 0)
          items.push({ id: `project-${project.id}-overdue`, type: 'project', severity: 'critical', title: project.title, message: 'Projektdeadline überschritten', projectId: project.id });
        else if (d <= 3)
          items.push({ id: `project-${project.id}-soon`, type: 'project', severity: 'warning', title: project.title, message: d === 0 ? 'Projektdeadline heute' : `Projektdeadline in ${d} Tag${d !== 1 ? 'en' : ''}`, projectId: project.id });
      }
    });

    if (currentUser.role === 'ausbilder') {
      (data.reports || []).filter(r => r.status === 'submitted').forEach(r => {
        items.push({ id: `report-${r.id}-submitted`, type: 'report', severity: 'info', title: 'Bericht zur Prüfung', message: `${r.user_name || 'Azubi'} · KW ${r.week_number}/${r.year}` });
      });
    } else {
      (data.reports || []).filter(r => r.user_id === currentUser.id && (r.status === 'reviewed' || r.status === 'signed')).forEach(r => {
        items.push({ id: `report-${r.id}-${r.status}`, type: 'report', severity: 'info', title: r.status === 'signed' ? 'Bericht unterschrieben' : 'Bericht geprüft', message: `KW ${r.week_number}/${r.year} · Feedback verfügbar` });
      });
    }

    const order = { critical: 0, warning: 1, info: 2 };
    return items.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  }, [data, currentUser]);

  const unreadCount = useMemo(() => notifications.filter(n => !readIds.has(n.id)).length, [notifications, readIds]);

  const markRead = useCallback((id) => {
    setReadIds(prev => {
      const next = new Set([...prev, id]);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch {}
      return next;
    });
  }, [storageKey]);

  const markAllRead = useCallback(() => {
    const ids = notifications.map(n => n.id);
    const next = new Set(ids);
    setReadIds(next);
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch {}
  }, [notifications, storageKey]);

  return { notifications, unreadCount, readIds, markRead, markAllRead };
}

function NotificationItem({ n, read, onMarkRead, navigate, onClose }) {
  const clr = { critical: 'var(--c-cr)', warning: 'var(--c-yw)', info: 'var(--c-ac)' }[n.severity] || 'var(--c-ac)';
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

function NotificationBell({ collapsed }) {
  const { data, currentUser } = useAppStore();
  const navigate = useNavigate();
  const { notifications, unreadCount, readIds, markRead, markAllRead } = useNotifications(data, currentUser);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fn = e => { if (!panelRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false); };
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

// ── Global Search ─────────────────────────────────────────────
function GlobalSearch({ data, onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  const lower = q.trim().toLowerCase();
  const results = lower ? [
    ...(data?.projects||[]).filter(p => !p.archived && (p.title.toLowerCase().includes(lower) || (p.description||'').toLowerCase().includes(lower)))
      .slice(0,5).map(p => ({ type: 'Projekt', label: p.title, sub: p.description, to: `/project/${p.id}`, icon: '📁' })),
    ...(data?.users||[]).filter(u => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower))
      .slice(0,3).map(u => ({ type: 'Nutzer', label: u.name, sub: u.email, to: '/users', icon: '👤' })),
    ...(data?.reports||[]).filter(r => (r.title||'').toLowerCase().includes(lower) || (r.content||'').toLowerCase().includes(lower))
      .slice(0,3).map(r => ({ type: 'Bericht', label: r.title || 'Unbenannter Bericht', sub: r.date, to: '/reports', icon: '📝' })),
  ] : [];

  const go = (to) => { navigate(to); onClose(); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 900, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 14, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--c-bd)' }}>
          <IcoSearch size={16} style={{ color: 'var(--c-mu)', flexShrink: 0 }} />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Projekte, Nutzer, Berichte durchsuchen…"
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
        ) : lower ? (
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
function Sidebar({ currentUser, onLogout, onNewProject, onExport, onImport, collapsed, onToggleCollapse, onSearch, theme, onToggleTheme, isMobile, drawerOpen, onCloseDrawer }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path     = location.pathname;
  const isAusbilder = currentUser?.role === 'ausbilder';

  const handleNav = (to) => { navigate(to); if (isMobile) onCloseDrawer?.(); };

  const navItems = [
    { to: '/dashboard', label: 'Dashboard',      Icon: IcoDashboard },
    { to: '/projects',  label: 'Projekte',       Icon: IcoFolder    },
    { to: '/calendar',  label: 'Kalender',       Icon: IcoCalendar  },
    { to: '/groups',    label: 'Gruppen',        Icon: IcoUsers     },
    { to: '/reports',   label: 'Berichtshefte',  Icon: IcoReport    },
    { to: '/learn',     label: 'Lernbereich',    Icon: IcoLearn     },
    ...(isAusbilder ? [{ to: '/users', label: 'Nutzer', Icon: IcoUserEdit }] : []),
  ];

  const hue = (currentUser?.name?.charCodeAt(0) || 100) * 37 % 360;
  const w   = isMobile ? 220 : (collapsed ? 52 : 200);

  const drawerStyle = isMobile ? {
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
        {navItems.map(({ to, label, Icon }) => {
          const active = path === to || (to !== '/dashboard' && path.startsWith(to));
          return (
            <button key={to} onClick={() => handleNav(to)} title={collapsed ? label : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9, justifyContent: collapsed ? 'center' : 'flex-start', width: '100%', padding: collapsed ? '9px' : '8px 10px', borderRadius: 8, border: 'none', background: active ? 'var(--c-acd)' : 'transparent', color: active ? 'var(--c-ac)' : 'var(--c-mu)', fontSize: 13, fontWeight: active ? 700 : 500, cursor: 'pointer', textAlign: 'left', marginBottom: 1, transition: 'all .12s', borderLeft: active ? '2px solid var(--c-ac)' : '2px solid transparent' }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--c-sf2)'; e.currentTarget.style.color = 'var(--c-br)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-mu)'; }}}>
              <Icon size={14} />
              {!collapsed && label}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div style={{ padding: collapsed ? '8px 6px 12px' : '8px 8px 12px', borderTop: '1px solid var(--c-bd)', flexShrink: 0 }}>
        {!collapsed && (
          <>
            {/* Neues Projekt */}
            <button className="abtn" onClick={onNewProject} style={{ width: '100%', justifyContent: 'center', marginBottom: 6, fontSize: 12 }}>
              <IcoPlus size={12} /> Neues Projekt
            </button>

            {/* Export / Import */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              <button className="btn" onClick={onExport} title="Daten als JSON exportieren" style={{ flex: 1, fontSize: 10, padding: '5px 0', justifyContent: 'center' }}>↓ Export</button>
              <label className="btn" title="JSON-Backup importieren" style={{ flex: 1, fontSize: 10, padding: '5px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, margin: 0 }}>
                ↑ Import
                <input type="file" accept=".json" onChange={onImport} style={{ display: 'none' }} />
              </label>
            </div>

            {/* User → klickbar → Profil-Seite */}
            <button onClick={() => handleNav('/profile')} title="Mein Profil"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--c-sf2)', marginBottom: 5, border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background .1s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf3)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--c-sf2)'}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: `hsl(${hue},45%,22%)`, border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: `hsl(${hue},65%,75%)` }}>
                {currentUser?.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.name?.split(' ')[0]}</div>
                <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {currentUser?.role === 'azubi' ? `Azubi · LJ ${currentUser?.apprenticeship_year || 1}` : 'Ausbilder'}
                </div>
              </div>
              <span style={{ fontSize: 9, color: 'var(--c-mu)', flexShrink: 0 }}>›</span>
            </button>
          </>
        )}

        {collapsed && (
          <>
            <button onClick={onNewProject} title="Neues Projekt" className="abtn" style={{ width: '100%', padding: '8px', justifyContent: 'center', marginBottom: 4, fontSize: 14 }}>
              <IcoPlus size={14} />
            </button>
            <button onClick={() => handleNav('/profile')} title="Mein Profil"
              style={{ width: '100%', padding: '6px', borderRadius: 7, border: 'none', background: 'var(--c-sf2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: `hsl(${hue},45%,22%)`, border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: `hsl(${hue},65%,75%)` }}>
                {currentUser?.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
              </div>
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
function ProjectDetailWrapper({ showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, setData, currentUser } = useAppStore();
  const project = data?.projects?.find(p => p.id === id);

  const handleUpdate = useCallback((projectId, updates) => {
    setData({ ...data, projects: (data?.projects||[]).map(p => p.id === projectId ? { ...p, ...updates } : p) });
  }, [data, setData]);

  const handleArchive = useCallback((projectId) => {
    setData({ ...data, projects: (data?.projects||[]).map(p => p.id === projectId ? { ...p, archived: true } : p) });
    showToast('Projekt archiviert');
  }, [data, setData, showToast]);

  if (!project) return <div className="card" style={{ margin: 24 }}>Projekt nicht gefunden</div>;

  const safeProject = {
    tasks: [], steps: [], materials: [], requirements: [],
    links: [], calendarEvents: [], assignees: [],
    netzplan: { nodes: [], edges: [], unit: 'W', nodePositions: {} },
    ...project,
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
    />
  );
}

// ── Profil-Seite ──────────────────────────────────────────────
function ProfilePage({ showToast }) {
  const { currentUser, data, setCurrentUser, setData } = useAppStore();
  const [tab, setTab]               = useState('info');
  const [name, setName]             = useState(() => currentUser?.name || '');
  const [profession, setProfession] = useState(() => currentUser?.profession || '');
  const [year, setYear]             = useState(() => String(currentUser?.apprenticeship_year || 1));
  const [oldPw, setOldPw]           = useState('');
  const [newPw, setNewPw]           = useState('');
  const [saving, setSaving]         = useState(false);
  const toast = showToast || (() => {});

  if (!currentUser) return null;

  const isAzubi = currentUser.role === 'azubi';
  const myProjects = (data?.projects || []).filter(p => !p.archived && p.assignees?.includes(currentUser.id));
  const hue = (currentUser.name?.charCodeAt(0) || 100) * 37 % 360;

  // Eingabe-Style wiederverwenden
  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid var(--c-bd2)', background: 'var(--c-sf2)', color: 'var(--c-br)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
  const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 };

  const saveProfile = async () => {
    const trimName = name.trim();
    const trimProf = profession.trim();
    const parsedYear = Number(year);
    if (!trimName) return;

    const changes = {};
    if (trimName !== currentUser.name)                             changes.name = trimName;
    if (trimProf !== (currentUser.profession || ''))              changes.profession = trimProf;
    if (isAzubi && parsedYear !== (currentUser.apprenticeship_year || 1)) changes.apprenticeship_year = parsedYear;
    if (Object.keys(changes).length === 0) return;

    setSaving(true);
    try {
      if (USE_API) await dataService.updateProfile(changes);
      const updatedUser = { ...currentUser, ...changes };
      setCurrentUser(updatedUser);
      if (data) setData({ ...data, users: (data.users || []).map(u => u.id === currentUser.id ? { ...u, ...changes } : u) });
      toast('✓ Profil gespeichert');
    } catch (e) { toast('⚠ ' + e.message); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (!oldPw || newPw.length < 4) return;
    setSaving(true);
    try {
      if (USE_API) {
        await dataService.changePassword(oldPw, newPw);
        toast('✓ Passwort geändert');
        setOldPw(''); setNewPw('');
      } else {
        toast('⚠ Passwortänderung nur im API-Modus verfügbar');
      }
    } catch (e) { toast('⚠ ' + e.message); }
    finally { setSaving(false); }
  };

  const tabBtn = (key, label) => (
    <button key={key} onClick={() => setTab(key)}
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
        <div style={{ width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: `hsl(${hue},45%,22%)`, border: '2px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: `hsl(${hue},65%,75%)` }}>
          {currentUser.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-br)' }}>{currentUser.name}</div>
          <div style={{ fontSize: 12, color: 'var(--c-mu)', marginTop: 2 }}>
            {currentUser.email}
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-mu)', marginTop: 2 }}>
            {isAzubi
              ? `Azubi · Lehrjahr ${currentUser.apprenticeship_year || 1}${currentUser.profession ? ` · ${currentUser.profession}` : ''}`
              : `Ausbilder${currentUser.profession ? ` · ${currentUser.profession}` : ''}`}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Aktive Projekte',  value: myProjects.length,                                                                                     color: 'var(--c-ac)' },
          { label: 'Offene Aufgaben',  value: myProjects.flatMap(p => p.tasks||[]).filter(t => t.assignee === currentUser.id && t.status !== 'done').length, color: 'var(--c-yw)' },
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
              <label style={labelStyle}>Neues Passwort (min. 4 Zeichen)</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} disabled={!USE_API}
                style={inputStyle} />
            </div>
            <button className="abtn" onClick={savePassword}
              disabled={saving || !USE_API || !oldPw || newPw.length < 4}
              style={{ width: '100%', padding: 11, fontSize: 13 }}>
              {saving ? 'Ändern…' : 'Passwort ändern'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Seiten-Wrapper ────────────────────────────────────────────
function CalendarPage({ showToast }) {
  const { data, setData } = useAppStore();
  const handleUpdate = useCallback((projectId, updates) => {
    if (projectId === '_cal') {
      setData({ ...data, calendarEvents: [...(data.calendarEvents || []), updates.ev] });
    } else if (projectId === '_cal_del') {
      setData({ ...data, calendarEvents: (data.calendarEvents || []).filter(e => e.id !== updates.id) });
    } else if (projectId === '_cal_edit') {
      setData({ ...data, calendarEvents: (data.calendarEvents || []).map(e => e.id === updates.ev.id ? updates.ev : e) });
    } else {
      setData({ ...data, projects: (data?.projects||[]).map(p => p.id === projectId ? { ...p, ...updates } : p) });
    }
  }, [data, setData]);
  return <CalendarView projects={data?.projects||[]} calendarEvents={data?.calendarEvents||[]} users={data?.users||[]} onUpdate={handleUpdate} showToast={showToast} />;
}

function GroupsPage({ showToast }) {
  const { data, setData } = useAppStore();
  const handleUpdateGroups = useCallback((groups) => setData({ ...data, groups }), [data, setData]);
  return <GroupsView groups={data?.groups||[]} users={data?.users||[]} projects={data?.projects||[]} onUpdateGroups={handleUpdateGroups} showToast={showToast} />;
}

function UsersPage({ showToast }) {
  const { data, setData } = useAppStore();
  const handleUpdate = useCallback((users) => setData({ ...data, users }), [data, setData]);
  return <UsersView users={data?.users || []} onUpdateUsers={handleUpdate} showToast={showToast} />;
}

function DashboardPage({ onNewProject, showToast }) {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();
  const handleUpdate = useCallback((projectId, updates) => {
    setData({ ...data, projects: (data?.projects||[]).map(p => p.id === projectId ? { ...p, ...updates } : p) });
  }, [data, setData]);
  return (
    <Dashboard user={currentUser} projects={data?.projects||[]} users={data?.users||[]} reports={data?.reports||[]} calendarEvents={data?.calendarEvents||[]}
      onOpenProject={id => navigate(`/project/${id}`)} onUpdateProject={handleUpdate} onNewProject={onNewProject} onNavigate={path => navigate('/' + path.replace(/^\//, ''))} />
  );
}

function ProjectsPage({ onNewProject, showToast }) {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();
  const duplicate = id => {
    const src = (data?.projects||[]).find(p => p.id === id);
    if (!src) return;
    const copy = {
      ...src,
      id: `proj_${Date.now()}`,
      title: `Kopie von ${src.title}`,
      archived: false,
      comments: [],
      calendarEvents: [],
      tasks: (src.tasks || []).map(t => ({ ...t, id: `t_${Math.random().toString(36).slice(2)}`, status: 'open', done: false })),
    };
    setData({ ...data, projects: [...(data?.projects||[]), copy] });
    showToast('✓ Projekt dupliziert');
  };
  return (
    <ProjectPool projects={data?.projects||[]} users={data?.users||[]} groups={data?.groups||[]} currentUser={currentUser}
      onOpen={id => navigate(`/project/${id}`)} onNew={onNewProject}
      onDelete={id => { setData({ ...data, projects: (data?.projects||[]).filter(p => p.id !== id) }); showToast('Projekt gelöscht'); }}
      onArchive={id => { setData({ ...data, projects: (data?.projects||[]).map(p => p.id === id ? { ...p, archived: true } : p) }); showToast('Projekt archiviert'); }}
      onUnarchive={id => { setData({ ...data, projects: (data?.projects||[]).map(p => p.id === id ? { ...p, archived: false } : p) }); showToast('Projekt wiederhergestellt'); }}
      onDuplicate={duplicate}
    />
  );
}

// ── AppLayout ─────────────────────────────────────────────────
function AppLayout({ currentUser, onLogout, onNewProject, onExport, onImport, onSearch, children }) {
  const [collapsed,   setCollapsed]   = useState(() => localStorage.getItem('azubiboard_sidebar_collapsed') === 'true');
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  usePageTitle();

  // Drawer schließen wenn auf Desktop gewechselt wird
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
      {/* Overlay bei offenem Drawer */}
      {isMobile && drawerOpen && (
        <div onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 899, backdropFilter: 'blur(2px)' }} />
      )}

      <Sidebar currentUser={currentUser} onLogout={onLogout} onNewProject={onNewProject} onExport={onExport} onImport={onImport} onSearch={onSearch}
        collapsed={isMobile ? false : collapsed} onToggleCollapse={handleToggleCollapse}
        theme={theme} onToggleTheme={toggleTheme}
        isMobile={isMobile} drawerOpen={drawerOpen} onCloseDrawer={() => setDrawerOpen(false)} />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
        {children}
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
const App = () => {
  const { data, currentUser, setData, setCurrentUser } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const { toast, showToast } = useToast();
  const importRef = useRef(null);

  // ── 401-Handler: Token abgelaufen → sauber ausloggen ─────
  useEffect(() => {
    const fn = () => { clearToken(); setCurrentUser(null); };
    window.addEventListener('azubiboard:unauthorized', fn);
    return () => window.removeEventListener('azubiboard:unauthorized', fn);
  }, [setCurrentUser]);

  // ── Daten laden, Passwörter migrieren, Session prüfen ────
  useEffect(() => {
    (async () => {
      const loaded = await dataService.getData();

      // Passwort-Migration: Klartext → SHA-256 (nur local-mode)
      let migrated = false;
      const migratedUsers = await Promise.all(
        (loaded.users || []).map(async (u) => {
          if (!isHashed(u.password)) {
            migrated = true;
            return { ...u, password: await hashPassword(u.password) };
          }
          return u;
        })
      );
      let finalData = migrated ? { ...loaded, users: migratedUsers } : loaded;
      if (migrated) persistData(finalData);

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
  const handleLogin = useCallback(async (user) => {
    setCurrentUser(user);
    applyUserTheme(user.theme);  // Theme aus DB nach Login anwenden
    if (USE_API) {
      const apiUsers = await dataService.getUsers();
      if (apiUsers) setData(prev => prev ? { ...prev, users: apiUsers } : prev);
    }
  }, [setCurrentUser, setData]);

  const handleLogout = useCallback(() => {
    clearSession();
    clearToken();
    setCurrentUser(null);
  }, [setCurrentUser]);

  const handleNewProject = useCallback(() => setShowModal(true), []);

  useEffect(() => {
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); if (currentUser) setShowSearch(s => !s); }
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && e.target.tagName === 'BODY' && currentUser) setShowModal(true);
    };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [currentUser]);

  const handleCreate = useCallback((projectData) => {
    const newProject = { ...projectData, id: `proj_${Date.now()}`, tasks: [], steps: [], calendarEvents: [], archived: false };
    setData({ ...data, projects: [...(data?.projects || []), newProject] });
    setShowModal(false);
    showToast('✓ Projekt erstellt');
  }, [data, setData, showToast]);

  // Daten-Export
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `azubiboard_backup_${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✓ Daten exportiert');
  }, [data, showToast]);

  // Daten-Import
  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.users || !Array.isArray(imported.projects)) throw new Error('Ungültiges Format');
        setData(imported);
        showToast('✓ Daten importiert');
      } catch { showToast('⚠ Datei konnte nicht importiert werden'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [setData, showToast]);

  if (!data) return null;

  if (!currentUser) {
    return (
      <ErrorBoundary>
        <AuthPage
          onLogin={handleLogin}
          users={data?.users || []}
          onRegister={async newUser => {
            const updated = { ...data, users: [...(data?.users || []), newUser] };
            setData(updated);
            setCurrentUser(newUser);
            // In API-Modus: frische Nutzerliste nach Registrierung laden
            if (USE_API) {
              const apiUsers = await dataService.getUsers();
              if (apiUsers) setData(prev => prev ? { ...prev, users: apiUsers } : prev);
            }
          }}
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <AppLayout currentUser={currentUser} onLogout={handleLogout} onNewProject={handleNewProject} onExport={handleExport} onImport={handleImport} onSearch={() => setShowSearch(true)}>
          <Routes>
            <Route path="/dashboard"   element={<DashboardPage onNewProject={handleNewProject} showToast={showToast} />} />
            <Route path="/projects"    element={<ProjectsPage  onNewProject={handleNewProject} showToast={showToast} />} />
            <Route path="/project/:id" element={<ProjectDetailWrapper showToast={showToast} />} />
            <Route path="/profile"     element={<ProfilePage showToast={showToast} />} />
            <Route path="/calendar"    element={<CalendarPage showToast={showToast} />} />
            <Route path="/groups"      element={<GroupsPage showToast={showToast} />} />
            <Route path="/learn"       element={<LearnPage currentUser={currentUser} />} />
            <Route path="/reports"     element={<ReportsPage currentUser={currentUser} data={data} onUpdateData={setData} showToast={showToast} />} />
            <Route path="/users"       element={<UsersPage showToast={showToast} />} />
            <Route path="/"  element={<Navigate to="/dashboard" replace />} />
            <Route path="*"  element={<Navigate to="/dashboard" replace />} />
          </Routes>

          {showModal && (
            <NewProjectModal
              users={data?.users || []}
              groups={data?.groups || []}
              currentUser={currentUser}
              onClose={() => setShowModal(false)}
              onCreate={handleCreate}
            />
          )}
        </AppLayout>

        {toast && <Toast msg={toast} />}
        {showSearch && <GlobalSearch data={data} onClose={() => setShowSearch(false)} />}
      </Router>
    </ErrorBoundary>
  );
};

export default App;
