// Hero-Auswahl-Logik „Was jetzt?" (DESIGN-VISION Anhang D.3) — pure, unit-getestet.
// Priorität: überfällige Aufgabe → heute fällig → Berichtsheft offen → Deadline ≤3 Tage → alles im Plan.
import { dayDiffLocal, isoWeekMonday } from '../../lib/utils.js';
import type { Project, Report, Task, Id } from '../../types';

export type HeroSuggestion = {
  kind: 'overdue' | 'due-today' | 'report' | 'upcoming' | 'clear';
  title: string;
  sub: string;
  cta: string;
  to: string;                 // Route oder `project:<id>`
  projectId?: Id;
  taskId?: Id;
  daysLeft: number | null;    // für die Gauge (negativ = überfällig)
};

const dayDiff = (iso: string, now: Date) => dayDiffLocal(iso, now);

export function buildHeroSuggestion(projects: Project[], reports: Report[], userId: Id, now = new Date()): HeroSuggestion {
  const active = (projects || []).filter((p: Project) => !p.archived);
  const myTasks = active.flatMap((p: Project) =>
    (p.tasks || [])
      .filter((t: Task) => t.assignee === userId && t.status !== 'done' && t.deadline)
      .map((t: Task) => ({ t, p, d: dayDiff(t.deadline as string, now) })));

  const overdue = myTasks.filter(x => x.d < 0).sort((a, b) => a.d - b.d);
  if (overdue.length) {
    const { t, p, d } = overdue[0];
    return { kind: 'overdue', title: t.text || 'Aufgabe', sub: `${p.title} · ${-d} ${-d === 1 ? 'Tag' : 'Tage'} überfällig`,
      cta: 'Jetzt erledigen', to: `project:${p.id}`, projectId: p.id, taskId: t.id, daysLeft: d };
  }

  const dueToday = myTasks.filter(x => x.d === 0);
  if (dueToday.length) {
    const { t, p } = dueToday[0];
    return { kind: 'due-today', title: t.text || 'Aufgabe', sub: `${p.title} · heute fällig`,
      cta: 'Anpacken', to: `project:${p.id}`, projectId: p.id, taskId: t.id, daysLeft: 0 };
  }

  const weekMon = isoWeekMonday(now);
  const hasThisWeek = (reports || []).some((r: Report) => r.user_id === userId && (r.week_start || '') >= weekMon);
  if (!hasThisWeek) {
    return { kind: 'report', title: 'Wochenbericht schreiben', sub: 'Das Berichtsheft dieser Woche ist noch offen',
      cta: 'Bericht anlegen', to: '/reports', daysLeft: 5 - ((now.getDay() + 6) % 7 + 1) };
  }

  const soon = myTasks.filter(x => x.d > 0 && x.d <= 3).sort((a, b) => a.d - b.d);
  if (soon.length) {
    const { t, p, d } = soon[0];
    return { kind: 'upcoming', title: t.text || 'Aufgabe', sub: `${p.title} · fällig in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`,
      cta: 'Vorarbeiten', to: `project:${p.id}`, projectId: p.id, taskId: t.id, daysLeft: d };
  }

  return { kind: 'clear', title: 'Alles im Plan', sub: 'Keine fälligen Aufgaben, Bericht ist drin', cta: 'Lernbereich öffnen', to: '/learn', daysLeft: null };
}
