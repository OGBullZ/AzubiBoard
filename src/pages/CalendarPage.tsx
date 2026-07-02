import { useCallback, lazy } from 'react';
import { useAppStore } from '../lib/store';
import type { ShowToast } from '../lib/hooks';
import type { User, Project, CalendarEvent, AppState } from '../types';

// J13: Code-Splitting — schwergewichtige Route lazy laden.
const CalendarView = lazy(() => import('../features/calendar/CalendarView'));

export function CalendarPage({ showToast }: { showToast: ShowToast }) {
  const store = useAppStore();
  const data = store.data as AppState | null;
  const currentUser = store.currentUser as User | null;
  const setData = store.setData;
  // updates bleibt any: CalendarView onUpdate = (id:any, patch:any), patch heterogen (ev/id/Projekt-Patch).
  // Mentor = nur lesend (wie ProjectDetail/Dashboard) — alle Kalender-Schreibpfade laufen durch diesen choke point.
  const handleUpdate = useCallback((projectId: string, updates: any) => {
    if (currentUser?.role === 'mentor') { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
    // Funktionale Updates: saveEdit (CalendarView) ruft beim Projekt-Wechsel onUpdate ZWEIMAL
    // synchron auf — Objekt-Form würde beim zweiten Aufruf den stale Closure-Snapshot spreaden
    // und den ersten Update überschreiben (Event-Duplikate, persistiert).
    if (projectId === '_cal') {
      setData((prev: any) => prev ? { ...prev, calendarEvents: [...(prev.calendarEvents || []), updates.ev] } : prev);
    } else if (projectId === '_cal_del') {
      setData((prev: any) => prev ? { ...prev, calendarEvents: (prev.calendarEvents || []).filter((e: CalendarEvent) => e.id !== updates.id) } : prev);
    } else if (projectId === '_cal_edit') {
      setData((prev: any) => prev ? { ...prev, calendarEvents: (prev.calendarEvents || []).map((e: CalendarEvent) => e.id === updates.ev.id ? updates.ev : e) } : prev);
    } else {
      setData((prev: any) => prev ? { ...prev, projects: (prev.projects || []).map((p: Project) => p.id === projectId ? { ...p, ...updates } : p) } : prev);
    }
  }, [setData, currentUser, showToast]);
  return <CalendarView projects={data?.projects||[]} calendarEvents={data?.calendarEvents||[]} users={data?.users||[]} onUpdate={handleUpdate} showToast={showToast} canEdit={currentUser?.role !== 'mentor'} />;
}
