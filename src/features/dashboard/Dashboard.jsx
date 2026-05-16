import { useState, useCallback, useMemo } from "react";
import { C, fmtDate, fmtLocalDate } from '../../lib/utils.js';
import { Avatar, ProgressBar, EmptyState } from '../../components/UI.jsx';
import {
  IcoFolder, IcoPlay, IcoChevron,
  IcoTrendUp,
  IcoLearn, IcoReport, IcoCalendar,
  IcoAlert, IcoNote, IcoUsers, IcoClock, IcoPlus
} from '../../components/Icons.jsx';

// Sprint-9-quality H3: Dashboard wurde aufgeteilt in widgets/*.jsx.
// Diese Datei haelt nur noch die beiden Dashboard-Layouts (Ausbilder/Azubi)
// und den Export, der per Rolle umschaltet.
import { LiveClock, Chip, PanelTitle } from './widgets/_helpers.jsx';
import { HeroTask }            from './widgets/HeroTask.jsx';
import { TaskQueue }           from './widgets/TaskQueue.jsx';
import { ProjectCard }         from './widgets/ProjectCard.jsx';
import { WeekProgress }        from './widgets/WeekProgress.jsx';
import { DeadlineWidget }      from './widgets/DeadlineWidget.jsx';
import { CalWidget }           from './widgets/CalWidget.jsx';
import { ReportWidget }        from './widgets/ReportWidget.jsx';
import { LearnWidget }         from './widgets/LearnWidget.jsx';
import { ActivityFeed }        from './widgets/ActivityFeed.jsx';
import { ZeiterfassungWidget } from './widgets/ZeiterfassungWidget.jsx';
import { MonthReportModal }    from './widgets/MonthReportModal.jsx';

// ─────────────────────────────────────────────────────────────
//  AUSBILDER-DASHBOARD
// ─────────────────────────────────────────────────────────────
function AusbilderDashboard({ user, projects, users, reports, calendarEvents, activityLog, onOpenProject, onUpdateProject, onNavigate }) {
  const now      = new Date();
  const azubis   = useMemo(() => users.filter(u => u.role === 'azubi'),              [users]);
  const active   = useMemo(() => projects.filter(p => !p.archived),                  [projects]);
  const pending  = useMemo(() => reports.filter(r => r.status === 'submitted'),      [reports]);
  const problems = useMemo(() => active.filter(p => p.status === 'red'),             [active]);
  const [showMonthReport, setShowMonthReport] = useState(false);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="anim">
      {showMonthReport && (
        <MonthReportModal projects={projects} users={users} reports={reports} onClose={() => setShowMonthReport(false)} />
      )}
      <div style={{ flexShrink: 0, padding: '14px 20px 12px', borderBottom: `1px solid var(--c-bd)`, background: 'var(--c-sf)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: C.br, margin: 0 }}>{greeting}, {user.name.split(' ')[0]} 👋</h1>
            <LiveClock />
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip value={azubis.length}  label="Azubis"    color={C.ac} />
          <Chip value={active.length}  label="Projekte"  color={C.gr} animated />
          <Chip value={pending.length} label="Berichte"  color={pending.length > 0 ? C.yw : C.mu} />
          {problems.length > 0 && <Chip value={problems.length} label="Probleme" color={C.cr} />}
          <button onClick={() => setShowMonthReport(true)}
            style={{ padding: '5px 11px', fontSize: 11, fontWeight: 700, borderRadius: 7, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.mu, cursor: 'pointer' }}>
            📊 Monatsreport
          </button>
        </div>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(300px, 1.4fr) minmax(300px, 360px)', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ padding: '16px 20px', borderRight: `1px solid var(--c-bd)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelTitle Icon={IcoUsers}>Azubi-Übersicht</PanelTitle>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {azubis.length === 0
              ? <div style={{ fontSize: 12, color: C.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>Keine Azubis vorhanden</div>
              : azubis.map(a => {
              const myProjects = active.filter(p => (p.assignees||[]).includes(a.id));
              const myTasks    = myProjects.flatMap(p => (p.tasks||[]).filter(t => t.assignee === a.id && t.status !== 'done'));
              const inProgress = myProjects.flatMap(p => (p.tasks||[]).filter(t => t.assignee === a.id && t.status === 'in_progress'));
              const overdue    = myTasks.filter(t => t.deadline && new Date(t.deadline) < now);
              const doneTotal  = myProjects.flatMap(p => (p.tasks||[]).filter(t => t.status === 'done' || t.done)).length;
              const totalTasks = myProjects.flatMap(p => (p.tasks||[])).length;
              const pct        = totalTasks > 0 ? Math.round(doneTotal / totalTasks * 100) : 0;

              // Bericht dieser Woche (ISO-Wochenmontag, lokal — DST-sicher)
              const weekMon    = (() => { const d = new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return fmtLocalDate(d); })();
              const myReports  = reports.filter(r => r.user_id === a.id).sort((x,y) => y.week_start.localeCompare(x.week_start));
              const lastReport = myReports[0] || null;
              const hasThisWeek = myReports.some(r => r.week_start >= weekMon);
              const REPORT_ST  = { draft: { l: 'Entwurf', c: C.mu }, submitted: { l: 'Eingereicht', c: C.ac }, reviewed: { l: 'Geprüft', c: C.yw }, signed: { l: 'Fertig', c: C.gr } };

              // Stunden diese Woche
              const weekEnd    = (() => { const d = new Date(weekMon + 'T12:00:00'); d.setDate(d.getDate()+6); return fmtLocalDate(d); })();
              const weekHours  = active.flatMap(p => (p.tasks||[]).filter(t => t.assignee === a.id))
                .flatMap(t => (t.timeLog||[]).filter(e => e.date >= weekMon && e.date <= weekEnd))
                .reduce((s, e) => s + (Number(e.hours)||0), 0);

              // Ampel
              const ampel = overdue.length > 2 ? C.cr
                : (overdue.length > 0 || !hasThisWeek) ? C.yw
                : C.gr;
              const ampelLabel = overdue.length > 2 ? 'Kritisch'
                : overdue.length > 0 ? 'Überfällig'
                : !hasThisWeek ? 'Bericht fehlt'
                : 'Alles OK';

              return (
                <div key={a.id} style={{ padding: '11px 12px', background: 'var(--c-sf2)', border: `1px solid ${ampel}30`, borderLeft: `3px solid ${ampel}`, borderRadius: 9, marginBottom: 8, transition: 'border-color .2s' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                    <Avatar name={a.name} url={a.avatar_url} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ fontSize: 9, color: C.textSecondary }}>Lehrjahr {a.apprenticeship_year || 1} · {a.profession || a.email}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: ampel, background: ampel + '18', border: `1px solid ${ampel}30`, borderRadius: 4, padding: '1px 7px' }}>
                        ● {ampelLabel}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: C.ac, fontFamily: C.mono }}>{pct}%</div>
                    </div>
                  </div>
                  <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={3} />

                  {/* Stats-Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginTop: 8 }}>
                    <div style={{ background: 'var(--c-sf3)', borderRadius: 6, padding: '5px 7px' }}>
                      <div style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .5, fontWeight: 700 }}>Offen</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: myTasks.length > 0 ? C.ac : C.mu, fontFamily: C.mono, lineHeight: 1.2 }}>{myTasks.length}</div>
                      {inProgress.length > 0 && <div style={{ fontSize: 8, color: C.ac }}>▶ {inProgress.length} aktiv</div>}
                    </div>
                    <div style={{ background: overdue.length > 0 ? C.crd : 'var(--c-sf3)', borderRadius: 6, padding: '5px 7px', border: overdue.length > 0 ? `1px solid ${C.cr}25` : 'none' }}>
                      <div style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .5, fontWeight: 700 }}>Überfällig</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: overdue.length > 0 ? C.cr : C.mu, fontFamily: C.mono, lineHeight: 1.2 }}>{overdue.length}</div>
                      {overdue.length > 0 && <div style={{ fontSize: 8, color: C.cr }}>⚠ zu spät</div>}
                    </div>
                    <div style={{ background: 'var(--c-sf3)', borderRadius: 6, padding: '5px 7px' }}>
                      <div style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .5, fontWeight: 700 }}>Std KW</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: weekHours > 0 ? C.gr : C.mu, fontFamily: C.mono, lineHeight: 1.2 }}>{weekHours.toFixed(1)}</div>
                      <div style={{ fontSize: 8, color: C.textSecondary }}>geloggt</div>
                    </div>
                  </div>

                  {/* Bericht-Status */}
                  <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => onNavigate(`azubi/${a.id}`)}
                      style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 7px', borderRadius: 4, border: `1px solid ${C.bd2}`, background: 'transparent', color: C.ac, cursor: 'pointer', fontWeight: 700, flexShrink: 0 }}>
                      Profil →
                    </button>
                    <IcoReport size={10} style={{ color: C.textSecondary, flexShrink: 0 }} />
                    {lastReport ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontSize: 10, color: C.textSecondary }}>
                          KW {lastReport.week_number}/{lastReport.year}
                        </span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: (REPORT_ST[lastReport.status]||REPORT_ST.draft).c, background: (REPORT_ST[lastReport.status]||REPORT_ST.draft).c + '18', borderRadius: 4, padding: '1px 6px' }}>
                          {(REPORT_ST[lastReport.status]||REPORT_ST.draft).l}
                        </span>
                        {!hasThisWeek && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: C.yw, background: C.ywd, borderRadius: 4, padding: '1px 6px', marginLeft: 'auto' }}>
                            ⚠ KW fehlt
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 10, color: C.cr, fontWeight: 700 }}>Noch kein Berichtsheft</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: '16px 20px', borderRight: `1px solid var(--c-bd)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {problems.length > 0 && (
            <div style={{ marginBottom: 14, flexShrink: 0 }}>
              <PanelTitle Icon={IcoAlert} badge={{ text: problems.length, bg: C.crd, c: C.cr }}>Projekte mit Problemen</PanelTitle>
              {problems.map(p => (
                <button key={p.id} onClick={() => onOpenProject(p.id)} className="row-btn"
                  style={{ justifyContent: 'space-between', marginBottom: 4, padding: '7px 9px', border: `1px solid ${C.cr}25`, borderRadius: 8, background: C.crd }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: C.textSecondary }}>{users.filter(u => (p.assignees||[]).includes(u.id)).map(u => u.name.split(' ')[0]).join(', ')}</div>
                  </div>
                  <IcoChevron size={12} style={{ color: C.cr, flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
          <PanelTitle Icon={IcoFolder} count={active.length}>Alle Projekte</PanelTitle>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {active.map(p => <ProjectCard key={p.id} project={p} users={users} onClick={() => onOpenProject(p.id)} onUpdate={onUpdateProject} />)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', overflowY: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoReport} badge={pending.length > 0 ? { text: `${pending.length} ausstehend`, bg: C.ywd, c: C.yw } : undefined}>
              Berichtshefte
            </PanelTitle>
            {pending.length === 0 ? (
              <div style={{ fontSize: 11, color: C.gr, textAlign: 'center', padding: '6px 0' }}>Alle Berichte geprüft ✓</div>
            ) : (
              <>
                {pending.slice(0, 4).map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                    <Avatar name={r.user_name || '?'} size={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.user_name}</div>
                      <div style={{ fontSize: 9, color: C.textSecondary }}>KW {r.week_number} · {fmtDate(r.week_start)}</div>
                    </div>
                    <span className="tag" style={{ background: C.ywd, color: C.yw, border: `1px solid ${C.yw}30`, fontSize: 9 }}>Prüfen</span>
                  </div>
                ))}
                {pending.length > 4 && <div style={{ fontSize: 10, color: C.textSecondary, marginTop: 6, textAlign: 'center' }}>+{pending.length - 4} weitere</div>}
              </>
            )}
            <button onClick={() => onNavigate?.('reports')} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0', marginTop: 8 }}>
              Alle Berichtshefte →
            </button>
          </div>
          <div style={{ padding: '16px 20px', borderTop: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoClock}>Zeiterfassung</PanelTitle>
            <ZeiterfassungWidget users={users} projects={active} />
          </div>
          <div style={{ padding: '16px 20px', borderTop: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoCalendar}>Nächste Termine</PanelTitle>
            <CalWidget calendarEvents={calendarEvents} projects={active} onNavigate={() => onNavigate?.('calendar')} />
          </div>
          <div style={{ padding: '16px 20px', flexShrink: 0, borderTop: `1px solid var(--c-bd)` }}>
            <PanelTitle Icon={IcoNote}>Letzte Aktivitäten</PanelTitle>
            <ActivityFeed activityLog={activityLog} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  AZUBI-DASHBOARD
// ─────────────────────────────────────────────────────────────
function AzubiDashboard({ user, projects, users, reports, calendarEvents, activityLog, onNewProject, onOpenProject, onUpdateProject, onNavigate }) {
  const now  = new Date();

  const mine = useMemo(
    () => projects.filter(p => !p.archived && (p.assignees||[]).includes(user.id)),
    [projects, user.id]
  );

  const allTasks = useMemo(() =>
    projects.flatMap(p =>
      (p.tasks||[])
        .filter(t => t.assignee === user.id && t.status !== 'done')
        .map(t => ({
          ...t,
          projectTitle: p.title,
          projectId:    p.id,
          isOverdue:    !!(t.deadline && new Date(t.deadline) < now),
        }))
    ).sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
      if (a.deadline && !b.deadline) return -1;
      if (!a.deadline && b.deadline) return 1;
      if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
      const prio = { high: 0, medium: 1, low: 2 };
      return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1);
    }),
    [projects, user.id] // now absichtlich ausgelassen — ändert sich nicht sinnvoll innerhalb einer Session
  );

  const heroTask        = useMemo(() => allTasks[0] || null,    [allTasks]);
  const queueTasks      = useMemo(() => allTasks.slice(1),       [allTasks]);
  const allProjectTasks = useMemo(() => projects.flatMap(p => (p.tasks||[])), [projects]);

  const toggleTask = useCallback((projectId, taskId) => {
    if (!onUpdateProject) return;
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    onUpdateProject(projectId, {
      tasks: proj.tasks.map(t => t.id === taskId ? { ...t, status: t.status === 'done' ? 'not_started' : 'done' } : t),
    });
  }, [projects, onUpdateProject]);

  const updateTaskNote = useCallback((projectId, taskId, note) => {
    if (!onUpdateProject) return;
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    onUpdateProject(projectId, {
      tasks: proj.tasks.map(t => t.id === taskId ? { ...t, note } : t),
    });
  }, [projects, onUpdateProject]);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend';

  const inProgress = useMemo(() => allTasks.filter(t => t.status === 'in_progress').length, [allTasks]);
  const overdue    = useMemo(() => allTasks.filter(t => t.isOverdue).length,                [allTasks]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="anim">
      <div style={{ flexShrink: 0, padding: '13px 20px 11px', borderBottom: `1px solid var(--c-bd)`, background: 'var(--c-sf)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: C.br, margin: 0, whiteSpace: 'nowrap' }}>
              {greeting}, {user.name.split(' ')[0]} 👋
            </h1>
            <LiveClock />
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
            {now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip value={mine.length}     label="Projekte" color={C.ac}  animated />
          <Chip value={allTasks.length} label="Offen"    color={C.mu}  animated />
          {inProgress > 0 && <Chip value={inProgress} label="Aktiv"    color={C.yw} animated />}
          {overdue > 0    && <Chip value={overdue}     label="Überfäll." color={C.cr} />}
        </div>
        <button className="abtn" onClick={onNewProject} style={{ fontSize: 12, flexShrink: 0 }}>
          <IcoPlus size={13} /> Neues Projekt
        </button>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(320px, 1.4fr) minmax(300px, 360px)', overflow: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid var(--c-bd)` }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 16px 10px' }}>
            <PanelTitle Icon={IcoPlay} count={allTasks.length}>Meine Aufgaben</PanelTitle>
            <HeroTask task={heroTask}
              onToggle={() => heroTask && toggleTask(heroTask.projectId, heroTask.id)}
              onOpen={onOpenProject}
              onUpdateNote={updateTaskNote} />
            {queueTasks.length > 0 && (
              <>
                <div style={{ height: 1, background: 'var(--c-bd)', margin: '10px 0 8px', flexShrink: 0 }} />
                <TaskQueue tasks={queueTasks} onToggle={toggleTask} onOpen={onOpenProject} />
              </>
            )}
          </div>
          <div style={{ flexShrink: 0, padding: '12px 16px 12px', borderTop: `1px solid var(--c-bd)`, background: 'var(--c-sf)' }}>
            <PanelTitle Icon={IcoTrendUp}>Wochenübersicht</PanelTitle>
            <WeekProgress tasks={allProjectTasks} userId={user.id} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid var(--c-bd)` }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '16px 18px 10px' }}>
            <PanelTitle Icon={IcoFolder} count={mine.length}>Aktive Projekte</PanelTitle>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {mine.length === 0 ? (
                <EmptyState Icon={IcoFolder} title="Keine Projekte" subtitle="Erstelle dein erstes Projekt" action="+ Erstellen" onAction={onNewProject} />
              ) : mine.map(p => (
                <div key={p.id} style={{ marginBottom: 12 }}>
                  <ProjectCard project={p} users={users} onClick={() => onOpenProject(p.id)} onUpdate={onUpdateProject} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ flexShrink: 0, padding: '12px 18px 12px', borderTop: `1px solid var(--c-bd)`, background: 'var(--c-sf)' }}>
            <PanelTitle Icon={IcoNote}>Letzte Aktivitäten</PanelTitle>
            <ActivityFeed activityLog={activityLog} />
          </div>
        </div>
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoClock}>Deadlines</PanelTitle>
            <DeadlineWidget projects={projects} userId={user.id} isAusbilder={false} onOpen={onOpenProject} />
          </div>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoCalendar}>Nächste Termine</PanelTitle>
            <CalWidget calendarEvents={calendarEvents} projects={projects} onNavigate={() => onNavigate?.('calendar')} />
          </div>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoReport}>Berichtshefte</PanelTitle>
            <ReportWidget reports={reports} userId={user.id} onNavigate={() => onNavigate?.('reports')} />
          </div>
          <div style={{ padding: '16px 20px', flexShrink: 0 }}>
            <PanelTitle Icon={IcoLearn}>Lernfortschritt</PanelTitle>
            <LearnWidget userId={user.id} onNavigate={() => onNavigate?.('learn')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  EXPORT
// ─────────────────────────────────────────────────────────────
export function Dashboard(props) {
  if (props.user?.role === 'ausbilder') {
    return <AusbilderDashboard {...props} activityLog={props.activityLog || []} />;
  }
  return <AzubiDashboard {...props} activityLog={props.activityLog || []} />;
}

export default Dashboard;
