// src/App.jsx – MINIMAL BLACKSCREEN FIX
import React, { useEffect, useCallback, useState } from 'react';
import { useAppStore } from './lib/store';
import { dataService } from './api/dataService';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';

import AuthPage from './AuthPage';
import { Dashboard, ProjectPool } from './Views';
import ProjectDetail from './ProjectDetail';
import LearnPage from './LearnPage';
import ReportsPage from './ReportsPage';
import { NetzplanTab } from './NetzplanGantt';
import AzubiProfil from './features/profile/AzubiProfil';
import { NewProjectModal } from './ExtraViews';

// Wrapper für Netzplan
function NetzplanPage() {
  const { data } = useAppStore();
  const firstProject = data?.projects?.[0];

  if (!firstProject) {
    return <div className="card">Kein Projekt vorhanden</div>;
  }

  const handleUpdate = (projectId, updates) => {
    // Netzplan-Updates können hier behandelt werden
  };

  return <NetzplanTab project={firstProject} onUpdate={handleUpdate} />;
}

// Wrapper für ProjectDetail um useParams zu verwenden
function ProjectDetailWrapper() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, setData, currentUser } = useAppStore();
  
  const project = data?.projects?.find(p => p.id === id);

  const handleUpdate = useCallback((projectId, updates) => {
    const updatedData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === projectId ? { ...p, ...updates } : p
      )
    };
    setData(updatedData);
  }, [data, setData]);

  const handleArchive = useCallback((projectId) => {
    const updatedData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === projectId ? { ...p, archived: true } : p
      )
    };
    setData(updatedData);
  }, [data, setData]);

  const handleBack = useCallback(() => {
    navigate('/projects');
  }, [navigate]);

  if (!project) {
    return <div className="card">Projekt nicht gefunden</div>;
  }

  return (
    <ProjectDetail
      project={project}
      users={data?.users || []}
      groups={data?.groups || []}
      currentUser={currentUser}
      onUpdate={handleUpdate}
      onArchive={handleArchive}
      onBack={handleBack}
      showToast={(msg) => console.log(msg)}
    />
  );
}

// Layout mit Navigation - nutzt useNavigate
function AppLayout({ children, currentUser, onLogout }) {
  const navigate = useNavigate();
  return (
    <>
      <nav className="main-nav">
        <button className="nav-link" onClick={() => navigate('/dashboard')}>Dashboard</button>
        <button className="nav-link" onClick={() => navigate('/projects')}>Projekte</button>
        <button className="nav-link" onClick={() => navigate('/profile')}>Profil</button>
        <button className="nav-link" onClick={() => navigate('/learn')}>Lernen</button>
        <button className="nav-link" onClick={() => navigate('/reports')}>Berichtsheft</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--c-mu)' }}>
            Hallo, {currentUser?.name?.split(' ')[0]}
          </span>
          <button 
            className="nav-link" 
            onClick={onLogout}
            style={{ color: 'var(--c-cr)', fontSize: 12 }}
            title="Abmelden"
          >
            Abmelden
          </button>
        </div>
      </nav>
      {children}
    </>
  );
}

const App = () => {
  const { data, currentUser, setData, setCurrentUser } = useAppStore();

  useEffect(() => {
    dataService.getData().then((loaded) => {
      setData(loaded);
      if (!currentUser) {
        setCurrentUser(loaded.users?.find(u => u.email === 'anna@azubi.de') || null);
      }
    });
  }, [currentUser, setData, setCurrentUser]);

  const isAuthenticated = !!currentUser;

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
  }, [setCurrentUser]);

  if (!isAuthenticated) {
    return <AuthPage onLogin={setCurrentUser} users={data?.users || []} onRegister={(newUser) => {
      const updatedData = { ...data, users: [...(data?.users || []), newUser] };
      setData(updatedData);
      setCurrentUser(newUser);
    }} />;
  }

  return (
    <Router>
      <AppLayout currentUser={currentUser} onLogout={handleLogout}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/project/:id" element={<ProjectDetailWrapper />} />
          <Route path="/profile" element={<AzubiProfil />} />
          <Route path="/learn" element={<LearnPage currentUser={currentUser} />} />
          <Route path="/reports" element={<ReportsPage currentUser={currentUser} data={data} onUpdateData={(newData) => setData(newData)} showToast={(msg) => console.log(msg)} />} />
          <Route path="/netzplan" element={<NetzplanPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  );
};

// Dashboard Route Component
function DashboardPage() {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const handleOpenProject = useCallback((id) => {
    navigate(`/project/${id}`);
  }, [navigate]);

  const handleNewProject = useCallback(() => {
    setShowNewProjectModal(true);
  }, []);

  const handleCreateProject = useCallback((projectData) => {
    const newProject = {
      ...projectData,
      id: `proj_${Date.now()}`,
      tasks: [],
      steps: [],
      calendarEvents: [],
      archived: false
    };
    const updatedData = {
      ...data,
      projects: [...(data?.projects || []), newProject]
    };
    setData(updatedData);
    setShowNewProjectModal(false);
    navigate(`/project/${newProject.id}`);
  }, [data, setData, navigate]);

  const handleUpdateProject = useCallback((projectId, updates) => {
    const updatedData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === projectId ? { ...p, ...updates } : p
      )
    };
    setData(updatedData);
  }, [data, setData]);

  const handleNavigate = useCallback((path) => {
    const fullPath = '/' + path.replace(/^\//, '');
    navigate(fullPath);
  }, [navigate]);

  return (
    <>
      <Dashboard 
        user={currentUser} 
        projects={data?.projects || []} 
        users={data?.users || []} 
        reports={data?.reports || []} 
        calendarEvents={data?.calendarEvents || []}
        onOpenProject={handleOpenProject}
        onUpdateProject={handleUpdateProject}
        onNewProject={handleNewProject}
        onNavigate={handleNavigate}
      />
      {showNewProjectModal && (
        <NewProjectModal
          users={data?.users || []}
          groups={data?.groups || []}
          currentUser={currentUser}
          onClose={() => setShowNewProjectModal(false)}
          onCreate={handleCreateProject}
        />
      )}
    </>
  );
}

// Projects Route Component
function ProjectsPage() {
  const navigate = useNavigate();
  const { data, currentUser, setData } = useAppStore();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  const handleOpenProject = useCallback((id) => {
    navigate(`/project/${id}`);
  }, [navigate]);

  const handleNewProject = useCallback(() => {
    setShowNewProjectModal(true);
  }, []);

  const handleCreateProject = useCallback((projectData) => {
    const newProject = {
      ...projectData,
      id: `proj_${Date.now()}`,
      tasks: [],
      steps: [],
      calendarEvents: [],
      archived: false
    };
    const updatedData = {
      ...data,
      projects: [...(data?.projects || []), newProject]
    };
    setData(updatedData);
    setShowNewProjectModal(false);
    navigate(`/project/${newProject.id}`);
  }, [data, setData, navigate]);

  const handleDeleteProject = useCallback((id) => {
    const updatedData = {
      ...data,
      projects: data.projects.filter(p => p.id !== id)
    };
    setData(updatedData);
  }, [data, setData]);

  const handleArchiveProject = useCallback((id) => {
    const updatedData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === id ? { ...p, archived: true } : p
      )
    };
    setData(updatedData);
  }, [data, setData]);

  const handleUnarchiveProject = useCallback((id) => {
    const updatedData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === id ? { ...p, archived: false } : p
      )
    };
    setData(updatedData);
  }, [data, setData]);

  return (
    <>
      <ProjectPool 
        projects={data?.projects || []} 
        users={data?.users || []} 
        groups={data?.groups || []} 
        currentUser={currentUser} 
        onOpen={handleOpenProject} 
        onNew={handleNewProject} 
        onDelete={handleDeleteProject} 
        onArchive={handleArchiveProject} 
        onUnarchive={handleUnarchiveProject} 
      />
      {showNewProjectModal && (
        <NewProjectModal
          users={data?.users || []}
          groups={data?.groups || []}
          currentUser={currentUser}
          onClose={() => setShowNewProjectModal(false)}
          onCreate={handleCreateProject}
        />
      )}
    </>
  );
}

export default App;