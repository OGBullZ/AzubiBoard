import { C, getISOWeek, today, fmtLocalDate } from '../../lib/utils.js';
import { isMentor } from '../../lib/roles.js';
import type { User, AppState, Project, Task, Report, Goal } from '../../types';

// Reine News-Aggregation (kein React) — getrennt von WelcomeNews.tsx, damit die
// Komponenten-Datei nur die Komponente exportiert (react-refresh) und die Logik
// unit-testbar bleibt (tests/welcome-news.test.js).

// ISO-Wochenmontag lokal (DST-sicher, identisch zu Dashboard.tsx Z.108)
export function isoMonday(now: Date): string {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fmtLocalDate(d);
}

export const firstNameOf = (name?: string | null) => (name || '').split(' ')[0] || name || '';

// Aggregierte News-Karte. sev steuert die Sortierung (0 critical → 2 info).
export type Card = { key: string; sev: number; accent: string; accentBg: string; icon: string; label: string; title: string; sub?: string; to?: string };

const ACC = {
  crit: { accent: C.cr,      accentBg: C.crd },
  warn: { accent: '#f78166', accentBg: '#f7816614' },
  ac:   { accent: C.ac,      accentBg: C.acd },
  ok:   { accent: C.gr,      accentBg: C.gr + '14' },
};

// Alle News-Karten direkt aus `data` aggregieren (rollenabhängig). Bewusst eigenständig,
// NICHT über den Glocken-Hook (useNotifications) — das Fenster ist eine andere Verdichtung
// und die Glocke (live) bleibt unverändert.
export function buildNewsCards(data: AppState | null, currentUser: User, lastConfirmedSeen: number | null, confirmedCount: number): Card[] {
  if (!data) return [];
  const now = new Date();
  const me = currentUser.id;
  const isStaff = currentUser.role === 'ausbilder' || currentUser.role === 'mentor';
  const mentor = isMentor(currentUser);
  const active = (data.projects || []).filter((p: Project) => !p.archived);
  const reports = data.reports || [];
  const weekMon = isoMonday(now);
  const week = getISOWeek(today()).week;
  const cards: Card[] = [];
  const dayDiff = (iso: string) => Math.ceil((+new Date(iso) - +now) / 86400000);

  if (!isStaff) {
    // ── Azubi ──────────────────────────────────────────────
    const overdue: string[] = [];   // Titel
    const soon: string[] = [];
    active.forEach((p: Project) => {
      (p.tasks || []).forEach((tk: Task) => {
        if (tk.assignee !== me || tk.status === 'done' || !tk.deadline) return;
        const d = dayDiff(tk.deadline);
        if (d < 0) overdue.push(tk.text || 'Aufgabe'); else if (d <= 3) soon.push(tk.text || 'Aufgabe');
      });
      if (p.assignees?.includes(me) && p.deadline) {
        const d = dayDiff(p.deadline);
        if (d < 0) overdue.push(p.title); else if (d <= 3) soon.push(p.title);
      }
    });
    if (overdue.length) cards.push({ key: 'overdue', sev: 0, ...ACC.crit, icon: '⚠', label: 'Überfällig',
      title: overdue.length === 1 ? overdue[0] : `${overdue.length} Aufgaben überfällig`,
      sub: overdue.length === 1 ? 'Deadline überschritten' : `Älteste: „${overdue[0]}"`, to: '/projects' });
    if (soon.length) cards.push({ key: 'soon', sev: 1, ...ACC.warn, icon: '📅', label: 'Diese Woche',
      title: soon.length === 1 ? soon[0] : `${soon.length} Aufgaben bald fällig`,
      sub: soon.length === 1 ? 'Fällig in ≤3 Tagen' : `Nächste: „${soon[0]}"`, to: '/calendar' });

    const hasThisWeek = reports.some((r: Report) => r.user_id === me && (r.week_start || '') >= weekMon);
    if (!hasThisWeek) cards.push({ key: 'report-open', sev: 1, ...ACC.warn, icon: '📝', label: 'Diese Woche',
      title: `Berichtsheft KW ${week ?? ''} noch offen`, sub: 'Wochenbericht fehlt', to: '/reports' });

    const feedback = reports.filter((r: Report) => r.user_id === me && (r.status === 'reviewed' || r.status === 'signed'));
    if (feedback.length) cards.push({ key: 'feedback', sev: 2, ...ACC.ok, icon: '✓', label: 'Erledigt',
      title: feedback.length === 1 ? 'Bericht mit Feedback' : `${feedback.length} Berichte mit Feedback`,
      sub: 'Neues Feedback von deinem Ausbilder', to: '/reports' });

    if (lastConfirmedSeen != null && confirmedCount > lastConfirmedSeen) {
      const delta = confirmedCount - lastConfirmedSeen;
      cards.push({ key: 'goals-confirmed', sev: 2, ...ACC.ok, icon: '🎉', label: 'Lernziele',
        title: `${delta} ${delta === 1 ? 'Lernziel' : 'Lernziele'} bestätigt 🎉`, sub: 'Von deinem Ausbilder abgezeichnet', to: '/training' });
    }

    const examDate = data.trainingPlan?.examDate;
    if (examDate) {
      const d = dayDiff(examDate);
      if (d >= 0 && d <= 60) cards.push({ key: 'exam', sev: 2, ...ACC.ac, icon: '🎓', label: 'Prüfung',
        title: d === 0 ? 'Heute ist deine Prüfung!' : `Noch ${d} ${d === 1 ? 'Tag' : 'Tage'} bis zur Prüfung`, to: '/training' });
    }
  } else {
    // ── Ausbilder / Mentor ─────────────────────────────────
    const azubis = (data.users || []).filter((u: User) => u.role === 'azubi');

    const critical = azubis.map((a: User) => {
      const ov = active.filter((p: Project) => p.assignees?.includes(a.id))
        .flatMap((p: Project) => (p.tasks || []).filter((tk: Task) => tk.assignee === a.id && tk.status !== 'done' && tk.deadline && dayDiff(tk.deadline) < 0));
      return { a, count: ov.length };
    }).filter((x: { count: number }) => x.count > 2);
    if (critical.length) cards.push({ key: 'critical-azubis', sev: 0, ...ACC.crit, icon: '⚠', label: 'Aufmerksamkeit',
      title: critical.length === 1 ? `${firstNameOf(critical[0].a.name)} braucht Aufmerksamkeit` : `${critical.length} Azubis brauchen Aufmerksamkeit`,
      sub: `${firstNameOf(critical[0].a.name)} · ${critical[0].count} Aufgaben überfällig`, to: '/' });

    const submitted = reports.filter((r: Report) => r.status === 'submitted')
      .sort((x: Report, y: Report) => (y.week_start || '').localeCompare(x.week_start || ''));
    if (submitted.length) cards.push({ key: 'review', sev: 1, ...ACC.ac, icon: '📋', label: 'Prüfung offen',
      title: `${submitted.length} ${submitted.length === 1 ? 'Berichtsheft wartet' : 'Berichtshefte warten'} auf Prüfung`,
      sub: `Neueste: ${submitted[0].user_name || 'Azubi'} · KW ${submitted[0].week_number}`, to: '/reports' });

    const missing = azubis.filter((a: User) => !reports.some((r: Report) => r.user_id === a.id && (r.week_start || '') >= weekMon));
    if (missing.length) cards.push({ key: 'missing-report', sev: 1, ...ACC.warn, icon: '📝', label: 'Wochenbericht',
      title: `${missing.length} ${missing.length === 1 ? 'Azubi' : 'Azubis'}: KW ${week ?? ''} fehlt`,
      sub: missing.length === 1 ? firstNameOf(missing[0].name) : missing.slice(0, 3).map((a: User) => firstNameOf(a.name)).join(', '), to: '/' });

    if (!mentor) {
      const goals = (data.trainingPlan?.goals || []) as Goal[];
      let learned = 0;
      goals.forEach((g: Goal) => azubis.forEach((a: User) => { if (g.progress?.[a.id]?.status === 'learned') learned++; }));
      if (learned) cards.push({ key: 'goals-learned', sev: 2, ...ACC.warn, icon: '🎯', label: 'Lernziele',
        title: `${learned} ${learned === 1 ? 'Lernziel' : 'Lernziele'} als „gelernt" markiert`, sub: '→ bestätigen', to: '/training' });
    }

    const red = active.filter((p: Project) => p.status === 'red');
    if (red.length) cards.push({ key: 'projects-red', sev: 1, ...ACC.crit, icon: '🔴', label: 'Projekte',
      title: `${red.length} ${red.length === 1 ? 'Projekt' : 'Projekte'} kritisch`,
      sub: red.length === 1 ? red[0].title : undefined, to: red.length === 1 ? `/project/${red[0].id}` : '/projects' });
  }

  return cards.sort((a, b) => a.sev - b.sev);
}
