// ============================================================
//  App.jsx – Haupt-App mit Router & Top-Navigation
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
} from 'react-router-dom';

import AuthPage      from './AuthPage';
import { Dashboard, ProjectPool } from './Views';
import ProjectDetail from './ProjectDetail';
import LearnPage     from './LearnPage';
import ReportsPage   from './ReportsPage';
import { NewProjectModal } from './ExtraViews';

// ── Profil-Seite (einfach) ───────────────────────────────────
function ProfilePage() {
  const { currentUser, data } = useAppStore();
  const { C } = { C: { br: 'var(--c-br)', mu: 'var(--c-mu)', ac: 'var(--c-ac)' } };
  if (!currentUser) return null;
  const myProjects = (data?.projects || []).filter(
    p => !p.archived && p.assignees?.includes(currentUser.id)
  );
  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <div className="card">
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--c-br)', marginBottom: 4 }}>
          {currentUser.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-mu)', marginBottom: 16 }}>
          {currentUser.email} · {currentUser.role === 'azubi' ? `Azubi LJ ${currentUser.apprenticeship_year || 1}` : 'Ausbilder'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ borderLeft: '3px solid var(--c-ac)', padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Aktive Projekte</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-ac)' }}>{myProjects.length}</div>
          </div>
          <div className="card" style={{ borderLeft: '3px solid var(--c-gr)', padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Aufgaben</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--c-gr)' }}>
              {myProjects.flatMap(p => p.tasks || []).filter(t => t.assignee === currentUser.id && t.status !== 'done').length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ProjectDetail Wrapper ────────────────────────────────────
function ProjectDetailWrapper() {
  const { id }                         = useParams();
  const navigate                       = useNavigate();
  const { data, setData, currentUser } = useAppStore();
  const project                        = data?.projects?.find(p => p.id === id);

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
      showToast={(msg) => console.log(msg)}
    />
  );
}

// ── Top-Navigation Layout ────────────────────────────────────
function AppLayout({ children, currentUser, onLogout }) {
  const navigate = useNavigate();
  const isAusbilder = currentUser?.role === 'ausbilder';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <nav className="main-nav">
        {/* Logo */}
        <div
          onClick={() => navigate('/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, marginRight: 8, cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, var(--c-ac), #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#fff',
          }}>A</div>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--c-br)', letterSpacing: -.3 }}>
            AzubiBoard
          </span>
        </div>

        {/* Nav Links */}
        <button className="nav-link" onClick={() => navigate('/dashboard')}>Dashboard</button>
        <button className="nav-link" onClick={() => navigate('/projects')}>Projekte</button>
        <button className="nav-link" onClick={() => navigate('/reports')}>Berichtshefte</button>
        <button className="nav-link" onClick={() => navigate('/learn')}>Lernbereich</button>
        {isAusbilder && (
          <button className="nav-link" onClick={() => navigate('/profile')}>Profil</button>
        )}

        {/* Rechte Seite */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: `hsl(${(currentUser?.name?.charCodeAt(0) || 100) * 37 % 360},45%,22%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700,
              color: `hsl(${(currentUser?.name?.charCodeAt(0) || 100) * 37 % 360},65%,75%)`,
              border: '1.5px solid rgba(255,255,255,0.12)',
            }}>
              {currentUser?.name?.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
            </div>
            <span style={{ fontSize: 12, color: 'var(--c-mu)', fontWeight: 600 }}>
              {currentUser?.name?.split(' ')[0]}
            </span>
          </div>
          <button
            className="btn"
            onClick={onLogout}
            style={{ fontSize: 11, color: 'var(--c-cr)', borderColor: 'var(--c-cr)30', padding: '4px 10px' }}
          >
            Abmelden
          </button>
        </div>
      </nav>

      {/* Page Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────
function DashboardPage() {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  const handleCreate = useCallback((projectData) => {
    const newProject = { ...projectData, id: `proj_${Date.now()}`, tasks: [], steps: [], calendarEvents: [], archived: false };
    setData({ ...data, projects: [...(data?.projects || []), newProject] });
    setShowModal(false);
    navigate(`/project/${newProject.id}`);
  }, [data, setData, navigate]);

  const handleUpdate = useCallback((projectId, updates) => {
    setData({ ...data, projects: data.projects.map(p => p.id === projectId ? { ...p, ...updates } : p) });
  }, [data, setData]);

  return (
    <>
      <Dashboard
        user={currentUser}
        projects={data?.projects || []}
        users={data?.users || []}
        reports={data?.reports || []}
        calendarEvents={data?.calendarEvents || []}
        onOpenProject={(id) => navigate(`/project/${id}`)}
        onUpdateProject={handleUpdate}
        onNewProject={() => setShowModal(true)}
        onNavigate={(path) => navigate('/' + path.replace(/^\//, ''))}
      />
      {showModal && (
        <NewProjectModal
          users={data?.users || []}
          groups={data?.groups || []}
          currentUser={currentUser}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}

// ── Projects Page ─────────────────────────────────────────────
function ProjectsPage() {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();
  const [showModal, setShowModal] = useState(false);

  const handleCreate = useCallback((projectData) => {
    const newProject = { ...projectData, id: `proj_${Date.now()}`, tasks: [], steps: [], calendarEvents: [], archived: false };
    setData({ ...data, projects: [...(data?.projects || []), newProject] });
    setShowModal(false);
    navigate(`/project/${newProject.id}`);
  }, [data, setData, navigate]);

  return (
    <>
      <ProjectPool
        projects={data?.projects || []}
        users={data?.users || []}
        groups={data?.groups || []}
        currentUser={currentUser}
        onOpen={(id) => navigate(`/project/${id}`)}
        onNew={() => setShowModal(true)}
        onDelete={(id) => setData({ ...data, projects: data.projects.filter(p => p.id !== id) })}
        onArchive={(id) => setData({ ...data, projects: data.projects.map(p => p.id === id ? { ...p, archived: true } : p) })}
        onUnarchive={(id) => setData({ ...data, projects: data.projects.map(p => p.id === id ? { ...p, archived: false } : p) })}
      />
      {showModal && (
        <NewProjectModal
          users={data?.users || []}
          groups={data?.groups || []}
          currentUser={currentUser}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}

// ── Root App ──────────────────────────────────────────────────
const App = () => {
  const { data, currentUser, setData, setCurrentUser } = useAppStore();

  useEffect(() => {
    dataService.getData().then((loaded) => {
      setData(loaded);
      if (!currentUser) {
        setCurrentUser(loaded.users?.find(u => u.email === 'anna@azubi.de') || null);
      }
    });
  }, []); // eslint-disable-line

  const handleLogout = useCallback(() => setCurrentUser(null), [setCurrentUser]);

  if (!currentUser) {
    return (
      <AuthPage
        onLogin={setCurrentUser}
        users={data?.users || []}
        onRegister={(newUser) => {
          const updated = { ...data, users: [...(data?.users || []), newUser] };
          setData(updated);
          setCurrentUser(newUser);
        }}
      />
    );
  }

  return (
    <Router>
      <AppLayout currentUser={currentUser} onLogout={handleLogout}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects"  element={<ProjectsPage />} />
          <Route path="/project/:id" element={<ProjectDetailWrapper />} />
          <Route path="/profile"   element={<ProfilePage />} />
          <Route path="/learn"     element={<LearnPage currentUser={currentUser} />} />
          <Route path="/reports"   element={
            <ReportsPage
              currentUser={currentUser}
              data={data}
              onUpdateData={setData}
              showToast={(msg) => console.log(msg)}
            />
          } />
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
};

export default App;
