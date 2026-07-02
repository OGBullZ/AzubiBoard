import { useCallback, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { addActivity } from '../lib/utils';
import type { ShowToast } from '../lib/hooks';
import type { User, Project, AppState } from '../types';

// J13: Code-Splitting — schwergewichtige Route lazy laden.
const ProjectDetail = lazy(() => import('../features/projects/ProjectDetail'));

export function ProjectDetailWrapper({ showToast }: { showToast: ShowToast }) {
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
    setData((prev: any) => prev ? { ...prev, projects: (prev.projects||[]).map((p: Project) => p.id === projectId ? { ...p, ...updates } : p) } : prev);
  }, [setData, currentUser, showToast]);

  const handleArchive = useCallback((projectId: string) => {
    const snapshot = data;
    setData((prev: any) => prev ? { ...prev, projects: (prev.projects||[]).map((p: Project) => p.id === projectId ? { ...p, archived: true } : p) } : prev);
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
