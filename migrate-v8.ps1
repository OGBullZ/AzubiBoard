# ================================================
# AzubiBoard v8 Migration – ULTRA SIMPLE VERSION
# ================================================

$ErrorActionPreference = "Stop"
$PROJECT_ROOT = Get-Location
$SRC_DIR = Join-Path $PROJECT_ROOT "src"
$BACKUP_DIR = Join-Path $PROJECT_ROOT "src_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "=== AzubiBoard v8 Migration – ULTRA SIMPLE ===" -ForegroundColor Green

# Backup
if (Test-Path $SRC_DIR) {
    Write-Host "Backup wird erstellt..." -ForegroundColor Yellow
    Copy-Item -Path $SRC_DIR -Destination $BACKUP_DIR -Recurse -Force
    Write-Host "Backup fertig: $BACKUP_DIR" -ForegroundColor Green
} else {
    New-Item -ItemType Directory -Path $SRC_DIR -Force | Out-Null
}

# Ordner anlegen
Write-Host "Ordnerstruktur wird erstellt..." -ForegroundColor Yellow
$folders = @("api", "features/auth", "features/dashboard/widgets", "features/profile", "features/projects/components", "features/ui", "features/learn", "features/reports", "features/netzplan", "lib", "hooks", "config")
foreach ($f in $folders) {
    New-Item -ItemType Directory -Path (Join-Path $SRC_DIR $f) -Force | Out-Null
}

# Original-Dateien kopieren
if (Test-Path $BACKUP_DIR) {
    Write-Host "Original-Dateien werden kopiert..." -ForegroundColor Yellow
    Copy-Item -Path "$BACKUP_DIR\*" -Destination $SRC_DIR -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Neue Dateien werden geschrieben..." -ForegroundColor Yellow

# ── constants.js ──────────────────────────────────────────────────────────────
$constantsContent = @"
export const SK = 'azubi_pm_v7';
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
export const USE_API = import.meta.env.VITE_USE_API === 'true';
export const APP_VERSION = 'v8-ultimate';
"@
Set-Content -Path (Join-Path $SRC_DIR "lib/constants.js") -Value $constantsContent -Encoding UTF8

# ── store.js ──────────────────────────────────────────────────────────────────
$storeContent = @"
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { loadData, persistData } from './utils';

export const useAppStore = create(
  persist(
    (set, get) => ({
      data: loadData(),
      currentUser: null,
      setData: (newData) => set({ data: newData }),
      setCurrentUser: (user) => set({ currentUser: user }),
      updateProject: (projectId, updates) => {
        const { data, setData } = get();
        const updatedProjects = data.projects.map(p =>
          p.id === projectId ? { ...p, ...updates } : p
        );
        setData({ ...data, projects: updatedProjects });
      },
    }),
    { name: SK, partialize: (state) => ({ data: state.data, currentUser: state.currentUser }) }
  )
);
"@
Set-Content -Path (Join-Path $SRC_DIR "lib/store.js") -Value $storeContent -Encoding UTF8

# ── dataService.js ────────────────────────────────────────────────────────────
$dataServiceContent = @"
import { USE_API, API_BASE } from '../lib/constants';
import { loadData, persistData } from '../lib/utils';

export const dataService = {
  async getData() {
    if (!USE_API) return loadData();
    try {
      const res = await fetch(`${API_BASE}/data`, { credentials: 'include' });
      if (!res.ok) throw new Error('API-Fehler');
      return await res.json();
    } catch {
      return loadData();
    }
  },
  async saveData(newData) {
    if (!USE_API) {
      persistData(newData);
      return newData;
    }
    try {
      const res = await fetch(`${API_BASE}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newData),
      });
      return res.ok ? await res.json() : (persistData(newData), newData);
    } catch {
      persistData(newData);
      return newData;
    }
  },
};
"@
Set-Content -Path (Join-Path $SRC_DIR "api/dataService.js") -Value $dataServiceContent -Encoding UTF8

# ── App.jsx ───────────────────────────────────────────────────────────────────
$appContent = @"
import React, { useEffect } from 'react';
import { useAppStore } from './lib/store';
import { dataService } from './api/dataService';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './features/auth/AuthPage';
import DashboardAzubi from './features/dashboard/DashboardAzubi';
import DashboardAusbilder from './features/dashboard/DashboardAusbilder';
import ProjectPool from './features/projects/ProjectPool';
import ProjectDetail from './features/projects/ProjectDetail';
import AzubiProfil from './features/profile/AzubiProfil';
import LearnPage from './features/learn/LearnPage';
import ReportsPage from './features/reports/ReportsPage';
import NetzplanGantt from './features/netzplan/NetzplanGantt';
import ErrorBoundary from './features/ui/ErrorBoundary';

const App = () => {
  const { data, currentUser, setData, setCurrentUser } = useAppStore();

  useEffect(() => {
    dataService.getData().then((loaded) => {
      setData(loaded);
      if (!currentUser) setCurrentUser(loaded.users.find(u => u.email === 'anna@azubi.de') || null);
    });
  }, []);

  const role = currentUser?.role || 'azubi';
  const isAuthenticated = !!currentUser;

  if (!isAuthenticated) return <AuthPage onLogin={setCurrentUser} />;

  return (
    <ErrorBoundary>
      <Router>
        <nav className='main-nav'>
          <a href='/dashboard' className='nav-link'>Dashboard</a>
          <a href='/projects' className='nav-link'>Projekte</a>
          <a href='/profile' className='nav-link'>Profil</a>
          <a href='/learn' className='nav-link'>Lernen</a>
          <a href='/reports' className='nav-link'>Berichtsheft</a>
        </nav>

        <Routes>
          <Route path='/dashboard' element={role === 'azubi' ? <DashboardAzubi /> : <DashboardAusbilder />} />
          <Route path='/projects' element={<ProjectPool />} />
          <Route path='/project/:id' element={<ProjectDetail />} />
          <Route path='/profile' element={<AzubiProfil />} />
          <Route path='/learn' element={<LearnPage />} />
          <Route path='/reports' element={<ReportsPage />} />
          <Route path='/netzplan' element={<NetzplanGantt />} />
          <Route path='*' element={<Navigate to='/dashboard' />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
"@
Set-Content -Path (Join-Path $SRC_DIR "App.jsx") -Value $appContent -Encoding UTF8

# ── AzubiProfil.jsx ───────────────────────────────────────────────────────────
$profilContent = @"
import React from 'react';
import { useAppStore } from '../../lib/store';
import { getDeadlineDaysLeft } from '../../lib/utils';

const AzubiProfil = () => {
  const { currentUser, data } = useAppStore();
  if (!currentUser || currentUser.role !== 'azubi') return <div>Zugriff verweigert</div>;

  const myProjects = data.projects.filter(p => p.azubis?.some(a => a.id === currentUser.id));
  const urgentCount = myProjects.filter(p => {
    const days = getDeadlineDaysLeft(p.deadline);
    return days >= 0 && days <= 3;
  }).length;

  return (
    <div className='card'>
      <h1>Mein Profil - {currentUser.name}</h1>
      <p>Lehrjahr: {currentUser.lehrjahr || '1'} | Ausbilder: {currentUser.ausbilder}</p>
      <div className='stats'>
        <div>Aktive Projekte: <strong>{myProjects.length}</strong></div>
        <div>Dringende Deadlines: <strong style={{color: 'var(--cr)'}}>{urgentCount}</strong></div>
      </div>
    </div>
  );
};

export default AzubiProfil;
"@
Set-Content -Path (Join-Path $SRC_DIR "features/profile/AzubiProfil.jsx") -Value $profilContent -Encoding UTF8

# ── NavBadge.jsx ──────────────────────────────────────────────────────────────
$navBadgeContent = @"
import React from 'react';

export const NavBadge = ({ count, tooltip }) => {
  if (!count || count < 1) return null;
  return <div className='nav-badge' title={tooltip || `${count} dringend`}>{count > 9 ? '9+' : count}</div>;
};
"@
Set-Content -Path (Join-Path $SRC_DIR "features/ui/NavBadge.jsx") -Value $navBadgeContent -Encoding UTF8

# ── vite.config.js ────────────────────────────────────────────────────────────
$viteContent = @"
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  server: { port: 5173, strictPort: true },
});
"@
Set-Content -Path (Join-Path $PROJECT_ROOT "vite.config.js") -Value $viteContent -Encoding UTF8

# ── .env.example ──────────────────────────────────────────────────────────────
$envContent = @"
VITE_API_BASE_URL=http://localhost:8080/api
VITE_USE_API=false
"@
Set-Content -Path (Join-Path $PROJECT_ROOT ".env.example") -Value $envContent -Encoding UTF8

# zustand installieren
Write-Host "zustand wird installiert..." -ForegroundColor Yellow
npm install zustand

Write-Host "=== Migration ERFOLGREICH ABGESCHLOSSEN ===" -ForegroundColor Green
Write-Host "Starte jetzt: npm run dev" -ForegroundColor Cyan
Write-Host "Melde danach einfach: Migration OK"