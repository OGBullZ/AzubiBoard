// ============================================================
//  DashboardBeta — „Vom leeren Tisch zur Instrumententafel"
//  (DESIGN-VISION Anhang D; nur Design 1.0 Beta, nur Azubi —
//  Ausbilder/Mentor nutzen vorerst das bestehende Cockpit.)
//  Z1 leerer Tisch → BETRIEBSBEREIT-Zeremonie → Z3 Arbeitsmodus.
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import type { User, Project, Report, Task, CalendarEvent, Id } from '../../types';
import { C, fmtDate, getISOWeek, today } from '../../lib/utils.js';
import { useCountUp } from '../../lib/hooks.js';
import { Stamp } from '../../components/Stamp.jsx';
import { WeekProgress } from './widgets/WeekProgress.jsx';
import { CalWidget } from './widgets/CalWidget.jsx';
import { ActivityFeed } from './widgets/ActivityFeed.jsx';
import { LearnWidget } from './widgets/LearnWidget.jsx';
import { LiveClock } from './widgets/_helpers.jsx';
import { buildHeroSuggestion, isoMondayOf } from './heroSuggestion.js';

type Props = {
  user: any;
  projects: Project[];
  users: User[];
  reports: Report[];
  calendarEvents?: CalendarEvent[];
  activityLog?: unknown[];
  groups?: { id: Id; members?: Id[]; requests?: Id[] }[];
  onOpenProject: (id: any) => void;
  onUpdateProject?: (id: any, patch: any) => void;
  onNavigate: (route: string) => void;
};

const monoCaps: React.CSSProperties = { fontFamily: C.mono, fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: C.mu };
const sameId = (a: unknown, b: unknown) => String(a) === String(b);

// ── Z1: Blueprint-Werkbank (zeichnet sich beim Mount, Zahnrad dreht idle) ──
function WerkbankDoodle() {
  return (
    <svg className="draw-in" width="260" height="150" viewBox="0 0 260 150" fill="none" aria-hidden="true">
      {/* Tischplatte + Beine */}
      <rect x="20" y="70" width="220" height="14" rx="2" stroke={C.mu} strokeWidth="2" />
      <line x1="40" y1="84" x2="40" y2="140" stroke={C.mu} strokeWidth="2" className="draw-2" />
      <line x1="220" y1="84" x2="220" y2="140" stroke={C.mu} strokeWidth="2" className="draw-2" />
      {/* Schraubstock */}
      <rect x="180" y="52" width="34" height="18" rx="2" stroke={C.mu} strokeWidth="2" className="draw-2" />
      <line x1="214" y1="61" x2="232" y2="61" stroke={C.mu} strokeWidth="2" className="draw-3" />
      <circle cx="236" cy="61" r="4" stroke={C.mu} strokeWidth="2" className="draw-3" />
      {/* Zahnrad (Idle-Animation via .gear-spin) */}
      <g className="gear-spin" style={{ transformOrigin: '70px 48px', animationDuration: '12s' }}>
        <circle cx="70" cy="48" r="14" stroke="var(--c-ac)" strokeWidth="2" />
        <circle cx="70" cy="48" r="5" stroke="var(--c-ac)" strokeWidth="2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
          <line key={a} x1={70 + 14 * Math.cos(a * Math.PI / 180)} y1={48 + 14 * Math.sin(a * Math.PI / 180)}
            x2={70 + 19 * Math.cos(a * Math.PI / 180)} y2={48 + 19 * Math.sin(a * Math.PI / 180)}
            stroke="var(--c-ac)" strokeWidth="2" />
        ))}
      </g>
      {/* Maßlinie mit Pfeilen (Zeichnungs-Annotation) */}
      <line x1="20" y1="120" x2="240" y2="120" stroke={C.mu} strokeWidth="1" strokeDasharray="4 4" className="draw-3" opacity=".5" />
    </svg>
  );
}

// ── Halbkreis-Gauge mit Skalenstrichen (Resttage) ──
function Gauge({ daysLeft }: { daysLeft: number | null }) {
  // Skala: 0 (überfällig/heute) … 7+ Tage = voll. null = ruhiger Vollausschlag.
  const frac = daysLeft == null ? 1 : Math.max(0, Math.min(1, daysLeft / 7));
  const angle = 180 - frac * 180;                       // 180° = leer/links, 0° = voll/rechts
  const col = daysLeft != null && daysLeft < 0 ? C.cr : daysLeft != null && daysLeft <= 1 ? C.yw : C.gr;
  const rad = (a: number) => [60 + 46 * Math.cos(a * Math.PI / 180), 56 - 46 * Math.sin(a * Math.PI / 180)];
  const [nx, ny] = rad(angle);
  return (
    <svg width="120" height="68" viewBox="0 0 120 68" aria-hidden="true">
      <path d="M 14 56 A 46 46 0 0 1 106 56" stroke={C.bd2} strokeWidth="3" fill="none" />
      {[0, 45, 90, 135, 180].map(a => {
        const [x1, y1] = [60 + 40 * Math.cos(a * Math.PI / 180), 56 - 40 * Math.sin(a * Math.PI / 180)];
        const [x2, y2] = [60 + 46 * Math.cos(a * Math.PI / 180), 56 - 46 * Math.sin(a * Math.PI / 180)];
        return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.mu} strokeWidth="1.5" />;
      })}
      <line x1="60" y1="56" x2={nx} y2={ny} stroke={col} strokeWidth="2.5" style={{ transition: 'all .32s var(--ease-out, ease)' }} />
      <circle cx="60" cy="56" r="4" fill={col} />
    </svg>
  );
}

// ── Z3: Projekt-Reihe (Werkbank-Zeile statt Karte) ──
function ProjectRow({ p, onOpen }: { p: Project; onOpen: (id: Id) => void }) {
  const tasks = p.tasks || [];
  const done = tasks.filter((t: Task) => t.status === 'done' || (t as any).done).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const next = tasks.find((t: Task) => t.status !== 'done');
  const stCol = p.status === 'red' ? C.cr : p.status === 'green' ? C.gr : C.yw;
  return (
    <button onClick={() => onOpen(p.id)} className="card"
      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '11px 14px', marginBottom: 8, cursor: 'pointer', textAlign: 'left', border: '1px solid var(--c-bd)' }}>
      {/* Signalleuchte */}
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: stCol, boxShadow: `0 0 8px ${stCol}`, flexShrink: 0 }} aria-label={`Status ${p.status}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
        {next && <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.mu, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {next.text}</div>}
      </div>
      {/* Füllstand mit Skalenstrichen */}
      <div style={{ width: 110, flexShrink: 0 }}>
        <div style={{ position: 'relative', height: 10, background: 'var(--c-sf3)', border: `1px solid var(--c-bd)`, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `repeating-linear-gradient(45deg, ${pct === 100 ? C.gr : C.ac}, ${pct === 100 ? C.gr : C.ac} 4px, color-mix(in srgb, ${pct === 100 ? C.gr : C.ac} 70%, black) 4px, color-mix(in srgb, ${pct === 100 ? C.gr : C.ac} 70%, black) 8px)`, transition: 'width .32s' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(90deg, var(--c-bd2) 1px, transparent 1px)', backgroundSize: '20% 100%' }} />
        </div>
        <div style={{ fontFamily: C.mono, fontSize: 9.5, color: C.mu, marginTop: 3, textAlign: 'right' }}>{done}/{tasks.length} · {pct}%</div>
      </div>
      {p.deadline && <div style={{ fontFamily: C.mono, fontSize: 10.5, color: C.mu, flexShrink: 0 }}>{fmtDate(p.deadline)}</div>}
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  const v = useCountUp(value);
  return (
    <div className="card" style={{ padding: '10px 16px', minWidth: 110 }}>
      <div style={monoCaps}>{label}</div>
      <div style={{ fontFamily: C.mono, fontSize: 26, fontWeight: 700, color: color || C.br, fontFeatureSettings: "'tnum' 1", lineHeight: 1.15 }}>{v}</div>
    </div>
  );
}

export function DashboardBeta({ user, projects, reports, calendarEvents, activityLog, groups, onOpenProject, onNavigate }: Props) {
  const now = new Date();
  const mine = useMemo(() => (projects || []).filter((p: Project) => !p.archived && (p.assignees || []).some(a => sameId(a, user.id))), [projects, user.id]);
  const ownReports = useMemo(() => (reports || []).filter((r: Report) => sameId(r.user_id, user.id)), [reports, user.id]);
  const openTasks = useMemo(() => mine.flatMap((p: Project) => (p.tasks || []).filter((t: Task) => sameId(t.assignee, user.id) && t.status !== 'done')), [mine, user.id]);
  const hero = useMemo(() => buildHeroSuggestion(projects, reports, user.id, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, reports, user.id]);

  // Berichts-Streak: zusammenhängende Wochen mit Bericht, rückwärts ab dieser KW
  const streak = useMemo(() => {
    const weeks = new Set(ownReports.map((r: Report) => r.week_start || ''));
    let n = 0;
    const d = new Date(now);
    for (let i = 0; i < 99; i++) {
      if (!weeks.has(isoMondayOf(d))) break;
      n++; d.setDate(d.getDate() - 7);
    }
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownReports]);

  // ── Z-Weiche + BETRIEBSBEREIT-Zeremonie (einmalig pro User) ──
  const isZ1 = mine.length === 0 && ownReports.length === 0;
  const readyKey = `azubiboard_betriebsbereit_${user.id}`;
  const [ceremony, setCeremony] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!isZ1 && !localStorage.getItem(readyKey)) {
        localStorage.setItem(readyKey, '1');
         
        setCeremony(true);
        t = setTimeout(() => setCeremony(false), 1800);
      }
    } catch { /* noop */ }
    return () => clearTimeout(t);
  }, [isZ1, readyKey]);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Hallo' : 'Guten Abend';
  const kw = getISOWeek(today()).week;

  // ── Einrichtungs-Laufkarte (Z1) ──
  const inGroup = (groups || []).some(g => [...(g.members || []), ...(g.requests || [])].some(m => sameId(m, user.id)));
  const quizDone = (() => { try { return (JSON.parse(localStorage.getItem(`azubi_quiz_${user.id}`) || '[]') as unknown[]).length > 0; } catch { return false; } })();
  const steps = [
    { label: 'Profil vervollständigen', done: !!user.profession, to: '/profile' },
    { label: 'Gruppe beitreten', done: inGroup, to: '/groups' },
    { label: 'Ersten Wochenbericht anlegen', done: ownReports.length > 0, to: '/reports' },
    { label: 'Erstes Quiz im Lernbereich', done: quizDone, to: '/learn' },
  ];
  const doneSteps = steps.filter(s => s.done).length;

  const header = (
    <div style={{ flexShrink: 0, padding: '16px 24px 13px', borderBottom: '1px solid var(--c-bd)', background: 'var(--c-sf)', display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>{greeting}, {String(user.name || '').split(' ')[0]}</h1>
      <LiveClock />
      <div style={{ marginLeft: 'auto' }}>
        <Stamp label={`KW ${kw ?? ''} · ${now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`} color="blue" seed={`kw-${kw}`} />
      </div>
    </div>
  );

  // ── Z1: Der leere Tisch ──
  if (isZ1) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {header}
        <div className="draft-in" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 }}>
          <div style={{ ['--i' as string]: 0 }}><WerkbankDoodle /></div>
          <div style={{ textAlign: 'center', ['--i' as string]: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: C.br }}>Deine Werkbank steht bereit.</div>
            <div style={{ fontSize: 13, color: C.mu, marginTop: 6 }}>Richte sie in vier Handgriffen ein — dein Ausbilder weist dir dann Projekte zu.</div>
          </div>
          <div className="card card--punched" style={{ width: 'min(440px, 92%)', padding: '16px 18px 16px 30px', ['--i' as string]: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={monoCaps}>Einrichtung</span>
              <span style={{ ...monoCaps, color: C.ac }}>{doneSteps}/{steps.length}</span>
            </div>
            {steps.map((s, i) => (
              <button key={s.label} onClick={() => onNavigate(s.to)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '9px 4px', background: 'transparent', border: 'none', borderTop: i > 0 ? '1px solid var(--c-bd)' : 'none', cursor: 'pointer', textAlign: 'left' }}>
                {s.done
                  ? <Stamp label="✓" color="green" seed={s.label} />
                  : <span style={{ width: 26, height: 18, border: `1.5px dashed ${C.bd2}`, borderRadius: 3, flexShrink: 0 }} aria-hidden="true" />}
                <span style={{ flex: 1, fontSize: 13, color: s.done ? C.mu : C.br, textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
                {!s.done && <span style={{ color: C.ac, fontSize: 12 }}>→</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Z3: Arbeitsmodus ──
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {ceremony && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--c-bg) 55%, transparent)', pointerEvents: 'none' }}>
          <Stamp label="Betriebsbereit" color="red" stamped seed={user.id} size="md" />
        </div>
      )}
      {header}
      <div className="draft-in" style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 1180, width: '100%', margin: '0 auto' }}>

        {/* Ebene 1: WAS JETZT */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', ['--i' as string]: 0 }}>
          <div className="card" style={{ flex: '2 1 380px', display: 'flex', alignItems: 'center', gap: 18, padding: '16px 20px', borderLeft: `3px solid ${hero.kind === 'overdue' ? C.cr : hero.kind === 'clear' ? C.gr : C.ac}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={monoCaps}>Was jetzt</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, color: C.br, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hero.title}</div>
              <div style={{ fontSize: 12, color: C.mu, marginTop: 3 }}>{hero.sub}</div>
              <button className="abtn" style={{ marginTop: 12 }}
                onClick={() => hero.to.startsWith('project:') ? onOpenProject(hero.projectId) : onNavigate(hero.to)}>
                {hero.cta} →
              </button>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <Gauge daysLeft={hero.daysLeft} />
              <div style={monoCaps}>
                {hero.daysLeft == null ? 'Im Plan' : hero.daysLeft < 0 ? `${-hero.daysLeft}T über` : hero.daysLeft === 0 ? 'Heute' : `${hero.daysLeft}T Rest`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, flex: '1 1 320px' }}>
            <Stat label="Offen" value={openTasks.length} color={openTasks.length ? C.ac : C.mu} />
            <Stat label="Projekte" value={mine.length} />
            <Stat label="Streak" value={streak} color={streak > 1 ? C.gr : C.mu} />
          </div>
        </div>

        {/* Ebene 2: Arbeitsfläche */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 2fr) minmax(260px, 1fr)', gap: 18, alignItems: 'start', ['--i' as string]: 1 }}>
          <div>
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span className="section-header-title" style={{ ...monoCaps, color: C.tx }}>Aktive Projekte [{mine.length}]</span>
            </div>
            {mine.length === 0
              ? <div style={{ fontSize: 12, color: C.mu, fontStyle: 'italic', padding: '8px 2px' }}>Dein Ausbilder weist dir Projekte zu — bis dahin: Berichtsheft & Lernbereich.</div>
              : mine.slice(0, 5).map((p: Project) => <ProjectRow key={p.id} p={p} onOpen={onOpenProject} />)}
            {mine.length > 5 && (
              <button className="btn" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onNavigate('/projects')}>Alle {mine.length} Projekte →</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card">
              <div style={{ ...monoCaps, marginBottom: 8 }}>Wochenübersicht</div>
              <WeekProgress tasks={(projects || []).flatMap((p: Project) => p.tasks || []) as any} userId={user.id} />
            </div>
            <div className="card">
              <div style={{ ...monoCaps, marginBottom: 8 }}>Berichtsheft KW {kw ?? ''}</div>
              {(() => {
                const weekMon = isoMondayOf(now);
                const rep = ownReports.find((r: Report) => (r.week_start || '') >= weekMon);
                if (!rep) return (
                  <button className="btn" style={{ width: '100%', justifyContent: 'center', borderColor: `color-mix(in srgb, ${C.yw} 50%, transparent)`, color: C.yw }} onClick={() => onNavigate('/reports')}>
                    Noch offen — anlegen →
                  </button>
                );
                const map: Record<string, { l: string; c: 'red' | 'blue' | 'green' }> = {
                  draft: { l: 'Entwurf', c: 'blue' }, submitted: { l: 'Eingereicht', c: 'blue' },
                  reviewed: { l: 'Geprüft', c: 'blue' }, signed: { l: 'Unterschrieben', c: 'red' },
                };
                const m = map[rep.status as string] || map.draft;
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {rep.status === 'draft'
                      ? <span className="tag" style={{ background: 'var(--c-sf2)', color: C.mu }}>● Entwurf</span>
                      : <Stamp label={m.l} color={m.c} seed={rep.id} />}
                    <button className="btn" onClick={() => onNavigate('/reports')} style={{ flexShrink: 0 }}>Öffnen</button>
                  </div>
                );
              })()}
            </div>
            <div className="card">
              <div style={{ ...monoCaps, marginBottom: 8 }}>Nächste Termine</div>
              <CalWidget calendarEvents={calendarEvents || []} projects={projects} onNavigate={() => onNavigate('/calendar')} />
            </div>
            <div className="card">
              <div style={{ ...monoCaps, marginBottom: 8 }}>Lernfortschritt</div>
              <LearnWidget userId={user.id} onNavigate={() => onNavigate('/learn')} />
            </div>
          </div>
        </div>

        {/* Ebene 3: Logbuch (Nachschlag, ans Ende) */}
        <div className="card" style={{ ['--i' as string]: 2 }}>
          <div style={{ ...monoCaps, marginBottom: 8 }}>Logbuch</div>
          <ActivityFeed activityLog={activityLog as any} />
        </div>
      </div>
    </div>
  );
}

export default DashboardBeta;
