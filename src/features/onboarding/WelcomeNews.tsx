import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { C, getISOWeek, today, fmtLocalDate } from '../../lib/utils.js';
import { isMentor } from '../../lib/roles.js';
import { useDialog } from '../../lib/hooks.js';
import NewsCard from './NewsCard';
import type { User, AppState, Id, Project, Task, Report, Goal } from '../../types';

type WelcomeNewsProps = {
  data: AppState | null;
  currentUser: User;
  onClose: () => void;
  navigate: (to: string) => void;   // Router-sicher via Event-Bus (App.tsx)
};

function greetingByHour(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
}

// ISO-Wochenmontag lokal (DST-sicher, identisch zu Dashboard.tsx Z.108)
function isoMonday(now: Date): string {
  const d = new Date(now); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return fmtLocalDate(d);
}

const firstNameOf = (name?: string | null) => (name || '').split(' ')[0] || name || '';

// Aggregierte News-Karte. sev steuert die Sortierung (0 critical → 2 info).
type Card = { key: string; sev: number; accent: string; accentBg: string; icon: string; label: string; title: string; sub?: string; to?: string };

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
        .flatMap((p: Project) => (p.tasks || []).filter((tk: Task) => tk.assignee === a.id && tk.status !== 'done' && tk.deadline && new Date(tk.deadline) < now));
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

export default function WelcomeNews({ data, currentUser, onClose, navigate }: WelcomeNewsProps) {
  const ref = useDialog<HTMLDivElement>(onClose);

  const isStaff = currentUser.role === 'ausbilder' || currentUser.role === 'mentor';
  const mentor = isMentor(currentUser);
  const firstName = firstNameOf(currentUser.name);

  // Delta-Persistenz für „X Lernziele bestätigt 🎉" (zuletzt gesehene Anzahl pro User).
  const confKey = `azubiboard_news_confirmed_${currentUser.id}`;
  const goals = useMemo(() => (data?.trainingPlan?.goals || []) as Goal[], [data]);
  const confirmedCount = useMemo(
    () => isStaff ? 0 : goals.filter((g: Goal) => g.progress?.[currentUser.id]?.status === 'confirmed').length,
    [goals, isStaff, currentUser.id]);
  const [lastConfirmedSeen] = useState<number | null>(() => {
    try { const v = localStorage.getItem(confKey); return v == null ? null : Number(v); } catch { return null; }
  });
  // Aktuelle Anzahl als „gesehen" persistieren (nächster Login zeigt nur den neuen Zuwachs).
  useEffect(() => {
    if (isStaff) return;
    try { localStorage.setItem(confKey, String(confirmedCount)); } catch { /* noop */ }
  }, [confirmedCount, confKey, isStaff]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const week = getISOWeek(today()).week;

  const cards = buildNewsCards(data, currentUser, lastConfirmedSeen, confirmedCount);

  const myProjects = (data?.projects || []).filter(p => p.assignees?.includes(currentUser.id as Id));
  const azubiEmptyAccount = !isStaff && myProjects.length === 0 && cards.length === 0;

  const nav = (to: string) => { onClose(); navigate(to); };

  const primaryCta = isStaff
    ? (mentor ? { label: 'Zum Dashboard →', to: '/' } : { label: 'Berichte prüfen →', to: '/reports' })
    : (azubiEmptyAccount ? { label: 'Bericht anlegen →', to: '/reports' }
       : cards.length ? { label: cards[0].to === '/reports' ? 'Berichtsheft öffnen →' : 'Zum Dashboard →', to: cards[0].to || '/' }
       : { label: 'Zum Dashboard →', to: '/' });

  const overlay = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn .25s ease',
    }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Willkommen" tabIndex={-1} style={{
        background: C.sf, border: `1px solid ${C.bd}`,
        borderRadius: 16, width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.5)',
        animation: 'fadeUp .25s ease',
      }}>
        {/* Header / Begrüßung */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px 14px', borderBottom: `1px solid ${C.bd}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.br, lineHeight: 1.2 }}>
              <span aria-hidden="true">👋</span> {greetingByHour()}, {firstName}!
            </div>
            <div style={{ fontSize: 12, color: C.mu, marginTop: 4 }}>
              {dateStr}{week != null && <> · <span style={{ fontFamily: C.mono }}>KW {week}</span></>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Schließen"
            style={{ background: 'transparent', border: 'none', color: C.mu, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px', borderRadius: 5 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {cards.length > 0 ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.mu, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                {isStaff ? 'Zu tun' : 'Deine Lage'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cards.map(c => (
                  <NewsCard key={c.key} accent={c.accent} accentBg={c.accentBg} icon={c.icon} label={c.label}
                    title={c.title} sub={c.sub} onClick={c.to ? () => nav(c.to as string) : undefined} />
                ))}
              </div>
            </>
          ) : azubiEmptyAccount ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '24px 16px', borderRadius: 10, border: `1px solid ${C.ac}25`, background: C.acd }}>
              <div style={{ fontSize: 28 }} aria-hidden="true">👋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.br }}>Willkommen zurück, {firstName}!</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Dein Ausbilder weist dir Projekte zu. Bis dahin kannst du deinen ersten Berichtsheft-Eintrag anlegen.
              </div>
            </div>
          ) : isStaff ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', borderRadius: 10, border: `1px solid ${C.gr}25`, background: C.gr + '08' }}>
              <div style={{ fontSize: 28, color: C.gr }} aria-hidden="true">✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gr }}>Alles unter Kontrolle</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Keine Berichte zu prüfen — alle Azubis im Plan.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', borderRadius: 10, border: `1px solid ${C.gr}25`, background: C.gr + '08' }}>
              <div style={{ fontSize: 28, color: C.gr }} aria-hidden="true">✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gr }}>Alles im grünen Bereich!</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Keine offenen Aufgaben, dein Bericht ist abgegeben.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px 18px', borderTop: `1px solid ${C.bd}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button className="btn" onClick={onClose} style={{ padding: '10px 18px' }}>Schließen</button>
          <div style={{ flex: 1 }} />
          <button className="abtn" onClick={() => nav(primaryCta.to)} style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700 }}>
            {primaryCta.label}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
