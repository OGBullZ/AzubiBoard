import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAppStore } from './lib/store';
import { dataService } from './lib/dataService';
import { today, loadSession, clearSession, persistData } from './lib/utils';
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
} from './components/Icons.jsx';

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
function Sidebar({ currentUser, onLogout, onNewProject, onExport, onImport, collapsed, onToggleCollapse, onSearch }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path     = location.pathname;
  const isAusbilder = currentUser?.role === 'ausbilder';

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
  const w   = collapsed ? 52 : 200;

  return (
    <aside style={{ width: w, flexShrink: 0, background: 'var(--c-sf)', borderRight: '1px solid var(--c-bd)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', transition: 'width .2s ease' }}>

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
        <button onClick={onToggleCollapse} title={collapsed ? 'Aufklappen' : 'Einklappen'}
          style={{ width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent', color: 'var(--c-mu)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, padding: 0 }}>
          {collapsed ? '›' : '‹'}
        </button>
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

      {/* Nav */}
      <nav style={{ flex: 1, padding: '4px 6px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, Icon }) => {
          const active = path === to || (to !== '/dashboard' && path.startsWith(to));
          return (
            <button key={to} onClick={() => navigate(to)} title={collapsed ? label : undefined}
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

            {/* User */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--c-sf2)', marginBottom: 5 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, background: `hsl(${hue},45%,22%)`, border: '1.5px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: `hsl(${hue},65%,75%)` }}>
                {currentUser?.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser?.name?.split(' ')[0]}</div>
                <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {currentUser?.role === 'azubi' ? `Azubi · LJ ${currentUser?.apprenticeship_year || 1}` : 'Ausbilder'}
                </div>
              </div>
            </div>
          </>
        )}

        {collapsed && (
          <button onClick={onNewProject} title="Neues Projekt" className="abtn" style={{ width: '100%', padding: '8px', justifyContent: 'center', marginBottom: 6, fontSize: 14 }}>
            <IcoPlus size={14} />
          </button>
        )}

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
function ProfilePage() {
  const { currentUser, data } = useAppStore();
  if (!currentUser) return null;
  const myProjects = (data?.projects || []).filter(p => !p.archived && p.assignees?.includes(currentUser.id));
  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <div className="card">
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-br)', marginBottom: 4 }}>{currentUser.name}</div>
        <div style={{ fontSize: 12, color: 'var(--c-mu)', marginBottom: 16 }}>
          {currentUser.email} · {currentUser.role === 'azubi' ? `Lehrjahr ${currentUser.apprenticeship_year || 1}` : 'Ausbilder'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'Aktive Projekte', value: myProjects.length, color: 'var(--c-ac)' },
            { label: 'Offene Aufgaben', value: myProjects.flatMap(p => p.tasks || []).filter(t => t.assignee === currentUser.id && t.status !== 'done').length, color: 'var(--c-yw)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ borderLeft: `3px solid ${s.color}`, padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
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
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <Sidebar currentUser={currentUser} onLogout={onLogout} onNewProject={onNewProject} onExport={onExport} onImport={onImport} onSearch={onSearch} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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

  // Daten laden, Passwörter migrieren, Session prüfen
  useEffect(() => {
    dataService.getData().then(async (loaded) => {
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
      const finalData = migrated ? { ...loaded, users: migratedUsers } : loaded;
      if (migrated) persistData(finalData);
      setData(finalData);

      const sessionUserId = loadSession();
      if (sessionUserId && !currentUser) {
        const sessionUser = migratedUsers.find(u => u.id === sessionUserId);
        if (sessionUser) setCurrentUser(sessionUser);
      }
    });
  }, []); // eslint-disable-line

  const handleLogout = useCallback(() => {
    clearSession();
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
          onLogin={setCurrentUser}
          users={data?.users || []}
          onRegister={newUser => {
            const updated = { ...data, users: [...(data?.users || []), newUser] };
            setData(updated);
            setCurrentUser(newUser);
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
            <Route path="/profile"     element={<ProfilePage />} />
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
