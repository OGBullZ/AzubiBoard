import { useState, useEffect, useMemo, useCallback } from 'react';
import type { User, Project, Task, Report, AppState, Id } from '../../types';

// ── Notifications ─────────────────────────────────────────────
// UI-Konstrukt (kein Domain-Typ) — lokal definiert.
export interface NotificationEntry {
  id: string;
  type: string;
  severity: string;
  // title kann aus task.text stammen (im Schema optional) → string | undefined.
  title: string | undefined;
  message: string;
  projectId?: Id;
  projectTitle?: string | null;
}

export function useNotifications(data: AppState | null, currentUser: User | null) {
  const storageKey = `azubiboard_notif_read_${currentUser?.id || 'anon'}`;
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
    catch { return new Set(); }
  });

  const notifications = useMemo<NotificationEntry[]>(() => {
    if (!data || !currentUser) return [];
    const items: NotificationEntry[] = [];
    const now = new Date();

    (data.projects || []).filter((p: Project) => !p.archived).forEach((project: Project) => {
      (project.tasks || []).forEach((task: Task) => {
        if (task.assignee !== currentUser.id || task.status === 'done' || !task.deadline) return;
        const d = Math.ceil((+new Date(task.deadline) - +now) / 86400000);
        if (d < 0)
          items.push({ id: `task-${task.id}-overdue`, type: 'deadline', severity: 'critical', title: task.text, message: `Überfällig seit ${Math.abs(d)} Tag${Math.abs(d) !== 1 ? 'en' : ''}`, projectId: project.id, projectTitle: project.title });
        else if (d <= 3)
          items.push({ id: `task-${task.id}-soon`, type: 'deadline', severity: 'warning', title: task.text, message: d === 0 ? 'Heute fällig' : `Fällig in ${d} Tag${d !== 1 ? 'en' : ''}`, projectId: project.id, projectTitle: project.title });
      });

      if (project.assignees?.includes(currentUser.id) && project.deadline) {
        const d = Math.ceil((+new Date(project.deadline) - +now) / 86400000);
        if (d < 0)
          items.push({ id: `project-${project.id}-overdue`, type: 'project', severity: 'critical', title: project.title, message: 'Projektdeadline überschritten', projectId: project.id });
        else if (d <= 3)
          items.push({ id: `project-${project.id}-soon`, type: 'project', severity: 'warning', title: project.title, message: d === 0 ? 'Projektdeadline heute' : `Projektdeadline in ${d} Tag${d !== 1 ? 'en' : ''}`, projectId: project.id });
      }
    });

    if (currentUser.role === 'ausbilder' || currentUser.role === 'mentor') {
      (data.reports || []).filter((r: Report) => r.status === 'submitted').forEach((r: Report) => {
        items.push({ id: `report-${r.id}-submitted`, type: 'report', severity: 'info', title: 'Bericht zur Prüfung', message: `${r.user_name || 'Azubi'} · KW ${r.week_number}/${r.year}` });
      });
    } else {
      (data.reports || []).filter((r: Report) => r.user_id === currentUser.id && (r.status === 'reviewed' || r.status === 'signed')).forEach((r: Report) => {
        items.push({ id: `report-${r.id}-${r.status}`, type: 'report', severity: 'info', title: r.status === 'signed' ? 'Bericht unterschrieben' : 'Bericht geprüft', message: `KW ${r.week_number}/${r.year} · Feedback verfügbar` });
      });
    }

    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return items.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
  }, [data, currentUser]);

  const unreadCount = useMemo(() => notifications.filter(n => !readIds.has(n.id)).length, [notifications, readIds]);

  // J7: bei neuen ungelesenen Notifications → Browser-Push feuern (nur wenn Tab im Hintergrund)
  useEffect(() => {
    if (!currentUser?.id) return;
    const unread = notifications.filter(n => !readIds.has(n.id));
    if (!unread.length) return;
    // Lazy-Import damit Browser ohne Notification-API nicht crashen
    // currentUser.id ist Id (string|number); webPush.js (JS-Boundary) typt param als string → type-only cast.
    import('../../lib/webPush.js').then(m => m.fireForNewNotifications(currentUser.id as string, unread));
  }, [notifications, readIds, currentUser?.id]);

  // Garbage-Collect: readIds die nicht mehr in aktuellen Notifications vorkommen entfernen.
  // Verhindert unbegrenztes Wachstum von localStorage über Wochen/Monate.
  useEffect(() => {
    if (!notifications.length || !readIds.size) return;
    const liveIds = new Set(notifications.map(n => n.id));
    const next = new Set([...readIds].filter(id => liveIds.has(id)));
    if (next.size !== readIds.size) {
      setReadIds(next);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
    }
  }, [notifications, readIds, storageKey]);

  const markRead = useCallback((id: string) => {
    setReadIds(prev => {
      const next = new Set([...prev, id]);
      try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }, [storageKey]);

  const markAllRead = useCallback(() => {
    const ids = notifications.map(n => n.id);
    const next = new Set(ids);
    setReadIds(next);
    try { localStorage.setItem(storageKey, JSON.stringify(ids)); } catch { /* noop */ }
  }, [notifications, storageKey]);

  return { notifications, unreadCount, readIds, markRead, markAllRead };
}
