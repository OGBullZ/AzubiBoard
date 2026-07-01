import { memo, useState, useRef } from "react";
import type { Project, Task, User } from '../../../types';
import { C, ST, fmtDate, dayDiffLocal } from '../../../lib/utils.js';
import { StatusBadge, Avatar, ProgressBar } from '../../../components/UI.jsx';
import { IcoCheck, IcoChevron, IcoChevronD, IcoPlus } from '../../../components/Icons.jsx';
import { Ring, urgencyColor, urgencyLabel } from './_helpers.jsx';

// Runtime task shape used by the dashboard card: the persisted data carries a
// few fields (deadline, the 'not_started' status, links/doc/protocol) that the
// shared Zod-derived Task type does not enumerate. Model them explicitly here so
// the component stays precisely typed without scattered casts.
type CardTask = Omit<Task, 'status'> & {
  status?: Task['status'] | 'not_started';
  text?: string;
  deadline?: string;
  assignee?: User['id'] | null;
  note?: string;
  doc?: string;
  protocol?: string;
  links?: string[];
};

type CardProject = Omit<Project, 'tasks'> & {
  tasks: CardTask[];
  assignees: Array<User['id']>;
};

type ProjectCardProps = {
  project: CardProject;
  users: User[];
  onClick?: () => void;
  onUpdate?: (id: Project['id'], patch: Partial<CardProject>) => void;
};

function ProjectCardImpl({ project, users, onClick, onUpdate }: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [newTask,  setNewTask]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const done   = project.tasks.filter(t => t.status === 'done' || t.done).length;
  const total  = project.tasks.length;
  const pct    = total > 0 ? Math.round(done / total * 100) : 0;
  const active = project.tasks.filter(t => t.status === 'in_progress').length;
  const au     = users.filter(u => project.assignees.includes(u.id));
  const sc     = (ST[project.status as keyof typeof ST] || ST.yellow).c;

  const openTasks = project.tasks
    .filter(t => t.status !== 'done' && !t.done)
    .sort((a, b) => {
      if (a.status === 'in_progress') return -1;
      if (b.status === 'in_progress') return 1;
      return 0;
    })
    .slice(0, 4);

  const toggleStatus = (e: React.MouseEvent<HTMLButtonElement>, newStatus: Project['status']) => {
    e.stopPropagation();
    onUpdate?.(project.id, { status: newStatus });
  };

  const toggleTask = (e: React.MouseEvent<HTMLButtonElement>, taskId: CardTask['id']) => {
    e.stopPropagation();
    onUpdate?.(project.id, {
      tasks: project.tasks.map(t => t.id === taskId
        ? { ...t, status: t.status === 'done' ? 'not_started' : 'done' } : t),
    });
  };

  const addTask = (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (!newTask.trim()) return;
    onUpdate?.(project.id, {
      tasks: [...project.tasks, {
        id: Date.now().toString(36), text: newTask.trim(),
        status: 'not_started', priority: 'medium',
        assignee: null, deadline: '', note: '', doc: '', protocol: '', links: [],
      } satisfies CardTask],
    });
    setNewTask('');
    inputRef.current?.focus();
  };

  const handleToggleExpand = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setExpanded(s => !s);
    if (!expanded) setTimeout(() => inputRef.current?.focus(), 150);
  };

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${expanded ? sc + '60' : C.bd}`, background: C.sf2, transition: 'border-color .15s', marginBottom: 9, borderLeft: `3px solid ${sc}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 11px', cursor: 'pointer' }}
        onClick={handleToggleExpand}>
        <div style={{ position: 'relative', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onClick?.(); }}
          title="Zum Projekt öffnen">
          <Ring pct={pct} size={42} stroke={4} color={pct === 100 ? C.gr : C.ac} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: pct === 100 ? C.grT : C.acT, fontFamily: C.mono, lineHeight: 1 }}>{pct}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.br, lineHeight: 1.35, wordBreak: 'break-word', marginBottom: 5 }}>
            {project.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <StatusBadge status={project.status} />
            {active > 0 && <span style={{ fontSize: 9, color: C.acT, background: C.acd, borderRadius: 4, padding: '1px 5px', fontFamily: C.mono, fontWeight: 700 }}>▶ {active}</span>}
            {project.deadline && (() => {
              const diff = dayDiffLocal(project.deadline);
              return diff <= 14 ? <span style={{ fontSize: 9, color: urgencyColor(diff), fontFamily: C.mono, fontWeight: 700 }}>{urgencyLabel(diff)}</span> : null;
            })()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex' }}>
            {au.slice(0, 3).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -7 : 0, zIndex: i }}><Avatar name={u.name} size={20} /></div>)}
          </div>
          <IcoChevronD size={11} style={{ color: C.textSecondary, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>
      {total > 0 && (
        <div style={{ padding: '0 11px 9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={3} label={`${pct}%`} />
            <span style={{ fontSize: 9, color: C.textSecondary, fontFamily: C.mono, flexShrink: 0 }}>{done}/{total}</span>
          </div>
        </div>
      )}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.bd}`, background: 'var(--c-sf3)', padding: '10px 11px' }}
          onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .7 }}>Status:</span>
            {([['green','Abgeschlossen', C.gr], ['yellow','In Bearbeitung', C.yw], ['red','Problem', C.cr]] as const).map(([s, l, c]) => (
              <button key={s} onClick={e => toggleStatus(e, s)}
                title={l}
                style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${project.status === s ? c : C.bd2}`, background: project.status === s ? c : 'transparent', cursor: 'pointer', transition: 'all .15s', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {project.status === s && <IcoCheck size={10} style={{ color: '#fff' }} />}
              </button>
            ))}
            <span style={{ fontSize: 11, color: sc, fontWeight: 600, marginLeft: 2 }}>
              {project.status === 'green' ? 'Abgeschlossen' : project.status === 'red' ? 'Problem' : 'In Bearbeitung'}
            </span>
          </div>
          {openTasks.length > 0 && (
            <div style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .7, fontWeight: 700, marginBottom: 5 }}>Offene Aufgaben</div>
              {openTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderBottom: `1px solid var(--c-bd-soft)` }}>
                  <button onClick={e => toggleTask(e, t.id)}
                    style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${t.status === 'in_progress' ? C.ac : C.bd2}`, background: 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.gr; e.currentTarget.style.borderColor = C.gr; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.status === 'in_progress' ? C.ac : C.bd2; }}>
                    {t.status === 'in_progress' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.ac }} />}
                  </button>
                  <span style={{ fontSize: 14, color: C.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.status === 'in_progress' && <span style={{ fontSize: 8, color: C.acT, marginRight: 3 }}>▶</span>}
                    {t.text}
                  </span>
                  {t.deadline && <span style={{ fontSize: 9, fontFamily: C.mono, color: C.textSecondary, flexShrink: 0 }}>{fmtDate(t.deadline)}</span>}
                </div>
              ))}
              {project.tasks.filter(t => t.status !== 'done' && !t.done).length > 4 && (
                <div style={{ fontSize: 10, color: C.textSecondary, marginTop: 4 }}>
                  +{project.tasks.filter(t => t.status !== 'done' && !t.done).length - 4} weitere…
                </div>
              )}
            </div>
          )}
          {onUpdate && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <input ref={inputRef}
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTask(e); e.stopPropagation(); }}
                onClick={e => e.stopPropagation()}
                placeholder="+ Aufgabe schnell hinzufügen…"
                style={{ flex: 1, fontSize: 12, padding: '8px 12px', background: 'var(--c-sf)', border: `1px solid ${C.bd2}` }} />
              <button onClick={addTask} className="abtn"
                style={{ padding: '5px 10px', fontSize: 11, flexShrink: 0 }}
                disabled={!newTask.trim()}>
                <IcoPlus size={11} />
              </button>
            </div>
          )}
          <button onClick={e => { e.stopPropagation(); onClick?.(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: C.acT, fontSize: 11, fontWeight: 700, padding: '2px 0' }}>
            <IcoChevron size={11} /> Vollständig öffnen
          </button>
        </div>
      )}
    </div>
  );
}

export const ProjectCard = memo(ProjectCardImpl);
