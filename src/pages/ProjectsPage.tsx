import { lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../lib/store';
import { softDelete, restoreFromTrash } from '../lib/trash.js';
import type { ShowToast } from '../lib/hooks';
import type { User, Project, Task, AppState, Id } from '../types';

// ProjectPool lazy: nicht First-Paint, siehe DashboardPage (Budget-Headroom).
const ProjectPool = lazy(() => import('../features/projects/ProjectPool'));

export function ProjectsPage({ onNewProject, showToast }: { onNewProject: () => void; showToast: ShowToast }) {
  const navigate = useNavigate();
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User;
  const setData = store.setData;
  const duplicate = (id: Id) => {
    if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
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
    setData((prev: any) => prev ? { ...prev, projects: [...(prev.projects||[]), copy] } : prev);
    showToast('✓ Projekt dupliziert');
  };
  return (
    // projects/groups: ProjectPool erwartet eigene PoolProject/Group-Typen (groupId ohne null) → cast.
    <ProjectPool projects={(data?.projects||[]) as any} users={data?.users||[]} groups={(data?.groups||[]) as any} currentUser={currentUser}
      onOpen={(id: Id) => navigate(`/project/${id}`)} onNew={onNewProject}
      onDelete={(id: Id) => {
        if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
        const project = (data?.projects||[]).find((p: Project) => p.id === id);
        if (project) {
          // softDelete: trash.js (JS-Boundary) → data/currentUser als any.
          setData(softDelete(data as any, 'projects', project, currentUser));
        } else {
          setData((prev: any) => prev ? { ...prev, projects: (prev.projects||[]).filter((p: Project) => p.id !== id) } : prev);
        }
        // Bug-Hunt 08-06 #21: GEZIELT zurücknehmen statt den kompletten Blob-Snapshot
        // wiederherzustellen. Trifft im 6-Sekunden-Fenster eine fremde Änderung ein (Poll
        // oder anderer Tab), löschte das alte `setData(snapshot)` sie wieder heraus — und
        // der nächste POST schrieb den Verlust fest (kein 409, weil der Poll die Version
        // aktualisiert hat). restoreFromTrash fasst nur dieses eine Projekt an.
        showToast('🗑 Projekt → Papierkorb (30 Tage)', {
          undo: () => setData((prev: any) => (prev ? restoreFromTrash(prev, 'projects', id) : prev)),
        });
      }}
      onArchive={(id: Id) => {
        if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
        const vorher = (data?.projects||[]).find((p: Project) => p.id === id)?.archived;
        setData((prev: any) => prev ? { ...prev, projects: (prev.projects||[]).map((p: Project) => p.id === id ? { ...p, archived: true } : p) } : prev);
        // #21: nur das archived-Flag dieses Projekts zurücksetzen, nicht den ganzen Blob
        showToast('📦 Projekt archiviert', {
          undo: () => setData((prev: any) => (prev ? { ...prev, projects: (prev.projects||[]).map((p: Project) => p.id === id ? { ...p, archived: vorher } : p) } : prev)),
        });
      }}
      onUnarchive={(id: Id) => { if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; } setData((prev: any) => prev ? { ...prev, projects: (prev.projects||[]).map((p: Project) => p.id === id ? { ...p, archived: false } : p) } : prev); showToast('Projekt wiederhergestellt'); }}
      onDuplicate={duplicate}
    />
  );
}
