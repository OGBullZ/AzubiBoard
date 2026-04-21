// ============================================================
//  App.jsx – Sidebar Layout (wie im Original)
//  Pfad: src/App.jsx
// ============================================================
import React, { useEffect, useCallback, useState } from 'react';
import { useAppStore } from './lib/store';
import { dataService } from './api/dataService';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';

import AuthPage from './AuthPage';
import { Dashboard, ProjectPool } from './Views';
import ProjectDetail from './ProjectDetail';
import LearnPage from './LearnPage';
import ReportsPage from './ReportsPage';
import { NewProjectModal } from './ExtraViews';
import {
  IcoDashboard, IcoFolder, IcoCalendar, IcoUsers,
  IcoReport, IcoLearn, IcoPlus, IcoLogout,
} from './Icons.jsx';

// ── Sidebar Navigation ────────────────────────────────────────
function Sidebar({ currentUser, onLogout, onNewProject }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const path      = location.pathname;

  const navItems = [
    { to: '/dashboard', label: 'Dashboard',    Icon: IcoDashboard },
    { to: '/projects',  label: 'Projekte',     Icon: IcoFolder    },
    { to: '/calendar',  label: 'Kalender',     Icon: IcoCalendar  },
    { to: '/groups',    label: 'Gruppen',      Icon: IcoUsers     },
    { to: '/reports',   label: 'Berichtshefte',Icon: IcoReport    },
    { to: '/learn',     label: 'Lernbereich',  Icon: IcoLearn     },
  ];

  const hue = (currentUser?.name?.charCodeAt(0) || 100) * 37 % 360;

  return (
    <aside style={{
      width: 168,
      flexShrink: 0,
      background: 'var(--c-sf)',
      borderRight: '1px solid var(--c-bd)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div
        onClick={() => navigate('/dashboard')}
        style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '16px 16px 12px',
          cursor: 'pointer', flexShrink: 0,
          borderBottom: '1px solid var(--c-bd)',
          marginBottom: 6,
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--c-ac), #2563eb)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 800, color: '#fff',
          boxShadow: '0 2px 8px rgba(0,113,227,0.35)',
        }}>A</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-br)', lineHeight: 1.1 }}>AzubiBoard</div>
          <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 1 }}>PM System</div>
        </div>
      </div>

      {/* Nav Links */}
      <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, Icon }) => {
          const active = path === to || (to !== '/dashboard' && path.startsWith(to));
          return (
            <button
              key={to}
              onClick={() => navigate(to)}
              style={{
                display: 'flex', alignItems: 'center', gap: 9,
                width: '100%', padding: '8px 10px',
                borderRadius: 8, border: 'none',
                background: active ? 'var(--c-acd)' : 'transparent',
                color: active ? 'var(--c-ac)' : 'var(--c-mu)',
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer', textAlign: 'left',
                marginBottom: 1,
                transition: 'all .12s',
                borderLeft: active ? '2px solid var(--c-ac)' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--c-sf2)'; e.currentTarget.style.color = 'var(--c-br)'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-mu)'; }}}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div style={{ padding: '8px 8px 12px', borderTop: '1px solid var(--c-bd)', flexShrink: 0 }}>
        {/* Team-Chat Bald */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8,
          background: 'var(--c-sf2)', border: '1px solid var(--c-bd)',
          marginBottom: 8, cursor: 'default',
        }}>
          <span style={{ fontSize: 12, color: 'var(--c-mu)' }}>💬 Team-Chat</span>
          <span style={{
            marginLeft: 'auto', fontSize: 9, fontWeight: 700,
            background: 'var(--c-ac)', color: '#fff',
            padding: '1px 6px', borderRadius: 4,
          }}>Bald</span>
        </div>

        {/* Neues Projekt Button */}
        <button
          className="abtn"
          onClick={onNewProject}
          style={{ width: '100%', justifyContent: 'center', marginBottom: 8, fontSize: 12 }}
        >
          <IcoPlus size={12} /> Neues Projekt
        </button>

        {/* User Info */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '7px 10px', borderRadius: 8,
          background: 'var(--c-sf2)', marginBottom: 6,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: `hsl(${hue},45%,22%)`,
            border: '1.5px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
            color: `hsl(${hue},65%,75%)`,
          }}>
            {currentUser?.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name?.split(' ')[0]}
            </div>
            <div style={{ fontSize: 9, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: .5 }}>
              {currentUser?.role === 'azubi' ? `Azubi · LJ ${currentUser?.apprenticeship_year || 1}` : 'Ausbilder'}
            </div>
          </div>
        </div>

        {/* Abmelden */}
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            width: '100%', padding: '7px 10px',
            borderRadius: 7, border: 'none',
            background: 'transparent',
            color: 'var(--c-cr)', fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--c-crd)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <IcoLogout size={13} /> Abmelden
        </button>
      </div>
    </aside>
  );
}

// ── ProjectDetail Wrapper ────────────────────────────────────
function ProjectDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, setData, currentUser } = useAppStore();
  const project = data?.projects?.find(p => p.id === id);

  const handleUpdate = useCallback((projectId, updates) => {
    setData({ ...data, projects: data.projects.map(p => p.id === projectId ? { ...p, ...updates } : p) });
  }, [data, setData]);

  const handleArchive = useCallback((projectId) => {
    setData({ ...data, projects: data.projects.map(p => p.id === projectId ? { ...p, archived: true } : p) });
  }, [data, setData]);

  if (!project) return <div className="card" style={{ margin: 24 }}>Projekt nicht gefunden</div>;

  return (
    <ProjectDetail
      project={project}
      users={data?.users || []}
      groups={data?.groups || []}
      currentUser={currentUser}
      onUpdate={handleUpdate}
      onArchive={handleArchive}
      onBack={() => navigate('/projects')}
      showToast={msg => console.log(msg)}
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

// ── Kalender Platzhalter ──────────────────────────────────────
function CalendarPage() {
  return (
    <div style={{ padding: 24 }}>
      <div className="card">
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-br)', marginBottom: 8 }}>Kalender</div>
        <div style={{ fontSize: 13, color: 'var(--c-mu)' }}>Kalender-Ansicht – demnächst verfügbar.</div>
      </div>
    </div>
  );
}

// ── Gruppen Platzhalter ───────────────────────────────────────
function GroupsPage() {
  return (
    <div style={{ padding: 24 }}>
      <div className="card">
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--c-br)', marginBottom: 8 }}>Gruppen</div>
        <div style={{ fontSize: 13, color: 'var(--c-mu)' }}>Gruppen-Verwaltung – demnächst verfügbar.</div>
      </div>
    </div>
  );
}

// ── App Layout (Sidebar + Content) ────────────────────────────
function AppLayout({ currentUser, onLogout, onNewProject, children }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', width: '100%' }}>
      <Sidebar currentUser={currentUser} onLogout={onLogout} onNewProject={onNewProject} />
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
        {children}
      </div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────
function DashboardPage({ onNewProject }) {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();

  const handleUpdate = useCallback((projectId, updates) => {
    setData({ ...data, projects: data.projects.map(p => p.id === projectId ? { ...p, ...updates } : p) });
  }, [data, setData]);

  return (
    <Dashboard
      user={currentUser}
      projects={data?.projects || []}
      users={data?.users || []}
      reports={data?.reports || []}
      calendarEvents={data?.calendarEvents || []}
      onOpenProject={id => navigate(`/project/${id}`)}
      onUpdateProject={handleUpdate}
      onNewProject={onNewProject}
      onNavigate={path => navigate('/' + path.replace(/^\//, ''))}
    />
  );
}

// ── Projects Page ─────────────────────────────────────────────
function ProjectsPage({ onNewProject }) {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();

  return (
    <ProjectPool
      projects={data?.projects || []}
      users={data?.users || []}
      groups={data?.groups || []}
      currentUser={currentUser}
      onOpen={id => navigate(`/project/${id}`)}
      onNew={onNewProject}
      onDelete={id => setData({ ...data, projects: data.projects.filter(p => p.id !== id) })}
      onArchive={id => setData({ ...data, projects: data.projects.map(p => p.id === id ? { ...p, archived: true } : p) })}
      onUnarchive={id => setData({ ...data, projects: data.projects.map(p => p.id === id ? { ...p, archived: false } : p) })}
    />
  );
}

// ── Root App ──────────────────────────────────────────────────
const App = () => {
  const { data, currentUser, setData, setCurrentUser } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    dataService.getData().then(loaded => {
      setData(loaded);
      if (!currentUser) {
        setCurrentUser(loaded.users?.find(u => u.email === 'anna@azubi.de') || null);
      }
    });
  }, []); // eslint-disable-line

  const handleLogout   = useCallback(() => setCurrentUser(null), [setCurrentUser]);
  const handleNewProject = useCallback(() => setShowModal(true), []);

  const handleCreate = useCallback((projectData) => {
    const newProject = {
      ...projectData,
      id: `proj_${Date.now()}`,
      tasks: [], steps: [], calendarEvents: [], archived: false,
    };
    const updated = { ...data, projects: [...(data?.projects || []), newProject] };
    setData(updated);
    setShowModal(false);
  }, [data, setData]);

  if (!currentUser) {
    return (
      <AuthPage
        onLogin={setCurrentUser}
        users={data?.users || []}
        onRegister={newUser => {
          const updated = { ...data, users: [...(data?.users || []), newUser] };
          setData(updated);
          setCurrentUser(newUser);
        }}
      />
    );
  }

  return (
    <Router>
      <AppLayout currentUser={currentUser} onLogout={handleLogout} onNewProject={handleNewProject}>
        <Routes>
          <Route path="/dashboard"   element={<DashboardPage onNewProject={handleNewProject} />} />
          <Route path="/projects"    element={<ProjectsPage  onNewProject={handleNewProject} />} />
          <Route path="/project/:id" element={<ProjectDetailWrapper />} />
          <Route path="/profile"     element={<ProfilePage />} />
          <Route path="/calendar"    element={<CalendarPage />} />
          <Route path="/groups"      element={<GroupsPage />} />
          <Route path="/learn"       element={<LearnPage currentUser={currentUser} />} />
          <Route path="/reports"     element={
            <ReportsPage
              currentUser={currentUser}
              data={data}
              onUpdateData={setData}
              showToast={msg => console.log(msg)}
            />
          } />
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
    </Router>
  );
};

export default App;
