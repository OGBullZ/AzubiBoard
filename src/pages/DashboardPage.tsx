import { useCallback, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import type { ShowToast } from '../lib/hooks';
import type { User, Project, AppState } from '../types';

// Dashboard lazy: nicht First-Paint (das ist AuthPage), zog aber alle
// Dashboard-Widgets in den Haupt-Chunk → Budget-Headroom (Ebene 9, 170 KB gz).
const Dashboard = lazy(() => import('../features/dashboard/Dashboard'));

export function DashboardPage({ onNewProject, showToast }: { onNewProject: () => void; showToast: ShowToast }) {
  const navigate = useNavigate();
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const setData = store.setData;
  // updates bleibt any: Dashboard onUpdateProject = (id:any, patch:any).
  // Phase 2: Mentor = nur lesend (z.B. Task-Toggle in ProjectCard).
  const handleUpdate = useCallback((projectId: string, updates: any) => {
    if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
    setData((prev: any) => prev ? { ...prev, projects: (prev.projects||[]).map((p: Project) => p.id === projectId ? { ...p, ...updates } : p) } : prev);
  }, [setData, currentUser, showToast]);
  return (
    <Dashboard user={currentUser} projects={data?.projects||[]} users={data?.users||[]} reports={data?.reports||[]} calendarEvents={data?.calendarEvents||[]}
      activityLog={data?.activityLog||[]} groups={(data as any)?.groups||[]} trainingPlan={(data as any)?.trainingPlan}
      onOpenProject={(id: string) => navigate(`/project/${id}`)} onUpdateProject={handleUpdate} onNewProject={onNewProject} onNavigate={(path: string) => navigate('/' + path.replace(/^\//, ''))} />
  );
}
