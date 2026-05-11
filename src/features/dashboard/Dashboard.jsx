import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { C, fmtDate, fmtLocalDate } from '../../lib/utils.js';
import { StatusBadge, Avatar, ProgressBar, EmptyState, IconBtn } from '../../components/UI.jsx';
import {
  IcoFolder, IcoCheck, IcoClock, IcoPlay, IcoChevron, IcoChevronD,
  IcoTrendUp, IcoSearch, IcoTrash, IcoPlus, IcoLink,
  IcoArchive, IcoLearn, IcoReport, IcoCalendar,
  IcoAlert, IcoNote, IcoUsers, IcoPause, IcoBlock
} from '../../components/Icons.jsx';

// ─────────────────────────────────────────────────────────────
//  KLEINE HELFER
// ─────────────────────────────────────────────────────────────

function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <span style={{ fontFamily: C.mono, fontSize: 14, color: C.ac, fontWeight: 700, letterSpacing: 1.5, userSelect: 'none' }}>
      {t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

function useCountUp(target) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) return;
    let cur = 0;
    const step = Math.max(1, Math.ceil(target / 30));
    const i = setInterval(() => {
      cur = Math.min(cur + step, target);
      setV(cur);
      if (cur >= target) clearInterval(i);
    }, 20);
    return () => clearInterval(i);
  }, [target]);
  return v;
}

function Ring({ pct = 0, size = 44, stroke = 4, color, bg }) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, pct / 100)) * circ;
  const bgColor = bg || 'var(--c-bd2)';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden="true">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bgColor} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .6s cubic-bezier(.4,0,.2,1)' }} />
    </svg>
  );
}

function Chip({ value, label, color, animated = false }) {
  const counted = useCountUp(typeof value === 'number' && animated ? value : 0);
  const n = animated && typeof value === 'number' ? counted : value;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 13px', background: color + '12', border: `1px solid ${color}25`, borderRadius: 8 }}>
      <span style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'Syne',system-ui,sans-serif", lineHeight: 1, letterSpacing: -0.5 }}>
        {animated ? n : value}
      </span>
      <span style={{ fontSize: 10, color: C.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7, lineHeight: 1.3 }}>
        {label}
      </span>
    </div>
  );
}

function urgencyColor(diff) {
  if (diff < 0)  return C.cr;
  if (diff === 0) return C.cr;
  if (diff <= 3)  return '#f78166';
  if (diff <= 7)  return C.yw;
  return C.mu;
}
function urgencyBg(diff) {
  if (diff < 0)  return C.crd;
  if (diff === 0) return C.crd;
  if (diff <= 3)  return '#f7816618';
  if (diff <= 7)  return C.ywd;
  return 'var(--c-sf3)';
}
function urgencyLabel(diff) {
  if (diff < 0)   return `${Math.abs(diff)}d über`;
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return `${diff}d`;
}

const ST_ICONS  = { in_progress: IcoPlay, not_started: IcoCheck, waiting: IcoPause, blocked: IcoBlock, done: IcoCheck };
const ST_COLORS = { in_progress: C.ac, not_started: C.mu, waiting: C.yw, blocked: C.cr, done: C.gr };

// ─────────────────────────────────────────────────────────────
//  DASHBOARD WIDGETS
// ─────────────────────────────────────────────────────────────

function PanelTitle({ Icon, children, badge, action, onAction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 11, flexShrink: 0 }}>
      {Icon && <Icon size={12} style={{ color: C.textSecondary }} />}
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>{children}</span>
      {badge && (
        <span style={{ fontSize: 9, background: badge.bg || C.acd, color: badge.c || C.ac, borderRadius: 5, padding: '1px 6px', fontFamily: C.mono, fontWeight: 700 }}>
          {badge.text}
        </span>
      )}
      {action && <button className="icn" onClick={onAction} style={{ fontSize: 10, padding: '1px 5px' }}>{action}</button>}
    </div>
  );
}

function HeroTask({ task, onToggle, onOpen, onUpdateNote }) {
  const [showNote, setShowNote] = useState(false);
  const [note,     setNote]     = useState(task?.note || '');

  if (!task) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 16px', borderRadius: 10, border: `1px solid ${C.gr}25`, background: C.gr + '08' }}>
      <div style={{ fontSize: 28, opacity: .6 }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.gr }}>Alles erledigt!</div>
      <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 1.6 }}>Keine offenen oder überfälligen Aufgaben</div>
    </div>
  );

  const isOverdue = task.isOverdue;
  const isActive  = task.status === 'in_progress';
  const accent    = isOverdue ? C.cr : isActive ? C.ac : '#f78166';
  const accentBg  = isOverdue ? C.crd : isActive ? C.acd : '#f7816614';

  const saveNote = () => {
    onUpdateNote?.(task.projectId, task.id, note);
    setShowNote(false);
  };

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${accent}40`, background: accentBg, padding: '16px 20px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: accent + '10', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>
          {isOverdue ? '⚠ Überfällig' : isActive ? '▶ In Bearbeitung' : '📅 Heute fällig'}
        </span>
        {task.deadline && (
          <span style={{ fontSize: 9, fontFamily: C.mono, color: accent, background: accent + '15', borderRadius: 4, padding: '1px 6px' }}>
            {fmtDate(task.deadline)}
          </span>
        )}
        <button onClick={() => setShowNote(s => !s)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: showNote ? accent + '20' : 'transparent', border: `1px solid ${accent}30`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: accent, fontSize: 10, fontWeight: 600 }}>
          <IcoNote size={10} /> {task.note ? 'Notiz' : '+ Notiz'}
        </button>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.br, lineHeight: 1.4, marginBottom: showNote ? 8 : 10, wordBreak: 'break-word' }}>
        {task.text}
      </div>
      {showNote && (
        <div style={{ marginBottom: 10 }}>
          <textarea value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNote(); }}
            placeholder="Notiz hinzufügen… (Strg+Enter zum Speichern)"
            style={{ minHeight: 52, fontSize: 11, background: 'var(--c-sf)', border: `1px solid ${accent}40`, borderRadius: 6, lineHeight: 1.55, padding: '6px 9px', resize: 'none', marginBottom: 5 }}
            autoFocus />
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={saveNote} className="abtn" style={{ fontSize: 10, padding: '4px 10px' }}>Speichern</button>
            <button onClick={() => { setNote(task.note || ''); setShowNote(false); }} className="btn" style={{ fontSize: 10, padding: '4px 8px' }}>Abbrechen</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button onClick={() => onOpen(task.projectId)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600 }}>{task.projectTitle}</span>
        </button>
        <button onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accent; }}>
          <IcoCheck size={12} /> Erledigen
        </button>
      </div>
    </div>
  );
}

function TaskQueue({ tasks, onToggle, onOpen }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', marginRight: -4, paddingRight: 4 }}>
      {tasks.map(t => {
        const StIcon  = ST_ICONS[t.status]  || IcoCheck;
        const stColor = ST_COLORS[t.status] || C.mu;
        return (
          <div key={t.id}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 7px', borderRadius: 7, marginBottom: 2, cursor: 'pointer', transition: 'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <button onClick={e => { e.stopPropagation(); onToggle(t.projectId, t.id); }}
              style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${t.isOverdue ? C.cr : stColor}`, background: 'transparent', flexShrink: 0, marginTop: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.gr; e.currentTarget.style.borderColor = C.gr; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.isOverdue ? C.cr : stColor; }}>
              {t.status === 'in_progress' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.ac }} />}
            </button>
            <button onClick={() => onOpen(t.projectId)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.status === 'in_progress' && <span style={{ fontSize: 8, color: C.ac, marginRight: 3 }}>▶</span>}
                {t.text}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 1, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{t.projectTitle}</span>
                {t.deadline && <span style={{ fontSize: 9, fontFamily: C.mono, color: t.isOverdue ? C.cr : C.mu, flexShrink: 0, fontWeight: t.isOverdue ? 700 : 400 }}>{t.isOverdue ? '⚠ ' : ''}{fmtDate(t.deadline)}</span>}
                {(t.links || []).length > 0 && <IcoLink size={9} style={{ color: C.ac, flexShrink: 0 }} />}
                {t.note && <IcoNote size={9} style={{ color: C.textSecondary, flexShrink: 0 }} />}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ProjectCard({ project, users, onClick, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [newTask,  setNewTask]  = useState('');
  const inputRef = useRef(null);

  const done   = project.tasks.filter(t => t.status === 'done' || t.done).length;
  const total  = project.tasks.length;
  const pct    = total > 0 ? Math.round(done / total * 100) : 0;
  const active = project.tasks.filter(t => t.status === 'in_progress').length;
  const au     = users.filter(u => project.assignees.includes(u.id));
  const sc     = project.status === 'green' ? C.gr : project.status === 'red' ? C.cr : C.yw;

  const openTasks = project.tasks
    .filter(t => t.status !== 'done' && !t.done)
    .sort((a, b) => {
      if (a.status === 'in_progress') return -1;
      if (b.status === 'in_progress') return 1;
      return 0;
    })
    .slice(0, 4);

  const toggleStatus = (e, newStatus) => {
    e.stopPropagation();
    onUpdate?.(project.id, { status: newStatus });
  };

  const toggleTask = (e, taskId) => {
    e.stopPropagation();
    onUpdate?.(project.id, {
      tasks: project.tasks.map(t => t.id === taskId
        ? { ...t, status: t.status === 'done' ? 'not_started' : 'done' } : t),
    });
  };

  const addTask = (e) => {
    e.stopPropagation();
    if (!newTask.trim()) return;
    onUpdate?.(project.id, {
      tasks: [...project.tasks, {
        id: Date.now().toString(36), text: newTask.trim(),
        status: 'not_started', priority: 'medium',
        assignee: null, deadline: '', note: '', doc: '', protocol: '', links: [],
      }],
    });
    setNewTask('');
    inputRef.current?.focus();
  };

  const handleToggleExpand = (e) => {
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
            <span style={{ fontSize: 10, fontWeight: 800, color: pct === 100 ? C.gr : C.ac, fontFamily: C.mono, lineHeight: 1 }}>{pct}</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.br, lineHeight: 1.35, wordBreak: 'break-word', marginBottom: 5 }}>
            {project.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <StatusBadge status={project.status} />
            {active > 0 && <span style={{ fontSize: 9, color: C.ac, background: C.acd, borderRadius: 4, padding: '1px 5px', fontFamily: C.mono, fontWeight: 700 }}>▶ {active}</span>}
            {project.deadline && (() => {
              const diff = Math.ceil((new Date(project.deadline) - new Date()) / 86400000);
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
            {[['green','In Ordnung', C.gr], ['yellow','In Bearbeitung', C.yw], ['red','Problem', C.cr]].map(([s, l, c]) => (
              <button key={s} onClick={e => toggleStatus(e, s)}
                title={l}
                style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${project.status === s ? c : C.bd2}`, background: project.status === s ? c : 'transparent', cursor: 'pointer', transition: 'all .15s', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {project.status === s && <IcoCheck size={10} style={{ color: '#fff' }} />}
              </button>
            ))}
            <span style={{ fontSize: 11, color: sc, fontWeight: 600, marginLeft: 2 }}>
              {project.status === 'green' ? 'In Ordnung' : project.status === 'red' ? 'Problem' : 'In Bearbeitung'}
            </span>
          </div>
          {openTasks.length > 0 && (
            <div style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .7, fontWeight: 700, marginBottom: 5 }}>Offene Aufgaben</div>
              {openTasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderBottom: `1px solid ${C.bd}22` }}>
                  <button onClick={e => toggleTask(e, t.id)}
                    style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${t.status === 'in_progress' ? C.ac : C.bd2}`, background: 'transparent', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.gr; e.currentTarget.style.borderColor = C.gr; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.status === 'in_progress' ? C.ac : C.bd2; }}>
                    {t.status === 'in_progress' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.ac }} />}
                  </button>
                  <span style={{ fontSize: 14, color: C.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.status === 'in_progress' && <span style={{ fontSize: 8, color: C.ac, marginRight: 3 }}>▶</span>}
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
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: C.ac, fontSize: 11, fontWeight: 700, padding: '2px 0' }}>
            <IcoChevron size={11} /> Vollständig öffnen
          </button>
        </div>
      )}
    </div>
  );
}

function WeekProgress({ tasks, userId }) {
  const now   = new Date();
  const mon   = new Date(now);
  mon.setDate(mon.getDate() - ((now.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);

  const days = ['Mo','Di','Mi','Do','Fr'].map((l, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const isToday = ds === now.toISOString().split('T')[0];
    const done = tasks.filter(t =>
      (t.status === 'done' || t.done) && t.assignee === userId && t.deadline === ds
    ).length;
    const open = tasks.filter(t =>
      t.status !== 'done' && !t.done && t.assignee === userId && t.deadline === ds
    ).length;
    return { l, d, ds, isToday, done, open, total: done + open };
  });

  const weekDone  = days.reduce((s, d) => s + d.done, 0);
  const weekTotal = tasks.filter(t => {
    const ds = t.deadline;
    if (!ds) return false;
    const td = new Date(ds + 'T12:00:00');
    return td >= mon && td < new Date(mon.getTime() + 7 * 86400000) && t.assignee === userId;
  }).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: C.textSecondary }}>
          KW {Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 604800000)}
        </span>
        <span style={{ fontSize: 13, fontFamily: C.mono, color: weekDone === weekTotal && weekTotal > 0 ? C.gr : C.ac, fontWeight: 700 }}>
          {weekDone} / {weekTotal} diese Woche
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 44 }}>
        {days.map(d => {
          const maxH = 36;
          const barH = d.total === 0 ? 4 : Math.max(4, Math.round((d.done / Math.max(d.total, 1)) * maxH));
          const isFuture = d.d > now;
          return (
            <div key={d.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', height: maxH, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: maxH, background: 'var(--c-bd)', borderRadius: 3, opacity: .5 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barH, background: d.isToday ? C.ac : d.done > 0 ? C.gr : isFuture ? 'var(--c-bd2)' : C.mu + '60', borderRadius: 3, transition: 'height .5s ease' }} />
                {d.open > 0 && !isFuture && (
                  <div style={{ position: 'absolute', bottom: barH, left: 0, right: 0, height: Math.max(2, Math.round((d.open / Math.max(d.total, 1)) * maxH)), background: C.cr + '80', borderRadius: '3px 3px 0 0' }} />
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: d.isToday ? 800 : 500, color: d.isToday ? C.ac : C.mu, textTransform: 'uppercase', letterSpacing: .5 }}>{d.l}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DeadlineWidget({ projects, userId, isAusbilder, onOpen }) {
  const now = new Date();
  const items = projects
    .filter(p => p.deadline && !p.archived)
    .filter(p => isAusbilder || (p.assignees||[]).includes(userId))
    .map(p => ({ ...p, diff: Math.ceil((new Date(p.deadline) - now) / 86400000) }))
    .filter(p => p.diff <= 21)
    .sort((a, b) => a.diff - b.diff);

  if (!items.length) return (
    <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', padding: '10px 0' }}>
      Keine Deadlines in den nächsten 21 Tagen 🎉
    </div>
  );

  const groups = [
    { label: 'Heute & Überfällig', items: items.filter(i => i.diff <= 0), color: C.cr },
    { label: 'Diese Woche',        items: items.filter(i => i.diff > 0 && i.diff <= 7),  color: C.yw },
    { label: 'Nächste Woche',      items: items.filter(i => i.diff > 7 && i.diff <= 14), color: C.textSecondary },
    { label: 'Später',             items: items.filter(i => i.diff > 14),                color: C.textSecondary },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map(g => (
        <div key={g.label}>
          <div style={{ fontSize: 9, fontWeight: 700, color: g.color, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 5 }}>{g.label}</div>
          {g.items.map(p => (
            <button key={p.id} onClick={() => onOpen(p.id)} className="row-btn"
              style={{ justifyContent: 'space-between', marginBottom: 2, padding: '5px 7px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
              </div>
              <span style={{ fontSize: 9, fontFamily: C.mono, fontWeight: 800, color: urgencyColor(p.diff), background: urgencyBg(p.diff), padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>
                {urgencyLabel(p.diff)}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function CalWidget({ calendarEvents, projects, onNavigate }) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const all   = [
    ...calendarEvents,
    ...projects.flatMap(p =>
      p.deadline ? [{ id: 'dl-' + p.id, date: p.deadline, title: '📌 ' + p.title, type: 'deadline' }] : []
    ),
  ].filter(e => e.date >= today)
   .sort((a, b) => a.date.localeCompare(b.date))
   .slice(0, 5);

  const TYPE_COLOR = { deadline: C.cr, meeting: '#f78166', hospitation: '#a371f7', schoolday: C.gr, event: C.ac, reminder: C.yw };

  return (
    <div>
      {all.length === 0
        ? <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', padding: '8px 0' }}>Keine Termine in Sicht</div>
        : all.map(e => {
            const c    = TYPE_COLOR[e.type] || C.ac;
            const diff = Math.ceil((new Date(e.date + 'T12:00:00') - now) / 86400000);
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', borderBottom: `1px solid var(--c-bd)` }}>
                <div style={{ width: 3, height: 28, borderRadius: 2, background: c, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  <div style={{ fontSize: 10, color: C.textSecondary }}>{fmtDate(e.date)}</div>
                </div>
                <span style={{ fontSize: 9, fontFamily: C.mono, fontWeight: 700, color: urgencyColor(diff), flexShrink: 0 }}>
                  {urgencyLabel(diff)}
                </span>
              </div>
            );
          })}
      <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', marginTop: 8, padding: '4px 0' }}>
        <IcoCalendar size={10} /> Kalender öffnen
      </button>
    </div>
  );
}

function ReportWidget({ reports, userId, onNavigate }) {
  const mine   = reports.filter(r => r.user_id === userId);
  const total  = mine.length;
  const signed = mine.filter(r => r.status === 'signed').length;
  const sub    = mine.filter(r => r.status === 'submitted').length;
  const draft  = mine.filter(r => r.status === 'draft').length;

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const thisWeekReport  = mine.find(r => new Date(r.week_start) >= monday);
  const thisWeekMissing = !thisWeekReport;

  return (
    <div>
      {thisWeekMissing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: C.ywd, border: `1px solid ${C.yw}30`, borderRadius: 7, marginBottom: 9 }}>
          <IcoAlert size={13} style={{ color: C.yw, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.yw }}>Berichtsheft diese Woche fehlt</div>
            <div style={{ fontSize: 10, color: C.textSecondary }}>Noch nicht für KW {Math.ceil((now - new Date(now.getFullYear(),0,1))/604800000)} erstellt</div>
          </div>
        </div>
      )}
      {total > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 9 }}>
          {[['Entwurf', draft, C.mu], ['Eingereicht', sub, C.ac], ['Fertig', signed, C.gr]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '5px 3px', background: c + '10', borderRadius: 6, border: `1px solid ${c}20` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: C.mono, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 9, color: C.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', padding: '4px 0 8px', fontStyle: 'italic' }}>Noch keine Berichtshefte</div>
      )}
      <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0' }}>
        <IcoReport size={10} /> Berichtshefte öffnen
      </button>
    </div>
  );
}

function LearnWidget({ userId, onNavigate }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const key = `azubi_quiz_${userId || 'anon'}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setHistory(saved);
    } catch {}
  }, [userId]);

  const avg  = history.length > 0 ? Math.round(history.reduce((s, e) => s + e.pct, 0) / history.length) : null;
  const best = history.length > 0 ? Math.max(...history.map(e => e.pct)) : null;
  const last  = history[0];
  const trend = history.length >= 2 ? history[0].pct - history[1].pct : null;

  if (history.length === 0) {
    return (
      <div>
        <div style={{ fontSize: 14, color: C.textSecondary, fontStyle: 'italic', marginBottom: 9 }}>Noch kein Quiz absolviert.</div>
        <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0' }}>
          <IcoLearn size={10} /> Quiz starten
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 9 }}>
        {[
          { l: 'Ø Ergebnis', v: `${avg}%`,  c: avg >= 75 ? C.gr : avg >= 50 ? C.yw : C.cr },
          { l: 'Bestes',     v: `${best}%`, c: C.gr },
          { l: 'Versuche',   v: history.length, c: C.ac },
          { l: 'Trend',      v: trend === null ? '–' : (trend >= 0 ? `+${trend}%` : `${trend}%`), c: trend > 0 ? C.gr : trend < 0 ? C.cr : C.mu },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--c-sf3)', borderRadius: 7, padding: '6px 9px', border: `1px solid var(--c-bd)` }}>
            <div style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .7, fontWeight: 700 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: C.mono, marginTop: 1 }}>{s.v}</div>
          </div>
        ))}
      </div>
      {last && (
        <div style={{ marginBottom: 9 }}>
          <div style={{ fontSize: 10, color: C.textSecondary, marginBottom: 4 }}>
            Letztes Quiz · {new Date(last.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
          </div>
          <ProgressBar value={last.pct} color={last.pct >= 75 ? C.gr : last.pct >= 50 ? C.yw : C.cr} height={6} />
          <div style={{ fontSize: 10, fontFamily: C.mono, color: C.textSecondary, marginTop: 3, textAlign: 'right' }}>
            {last.score}/{last.total} · {last.pct}%
          </div>
        </div>
      )}
      <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0' }}>
        <IcoLearn size={10} /> Lernbereich öffnen
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ACTIVITY FEED WIDGET
// ─────────────────────────────────────────────────────────────

function relTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)       return 'gerade eben';
  if (diff < 3600)     return `vor ${Math.floor(diff / 60)} Min`;
  if (diff < 86400)    return `vor ${Math.floor(diff / 3600)}h`;
  if (diff < 172800)   return 'Gestern';
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

const ACTIVITY_CONFIG = {
  project_created:  { icon: '📁', color: C.ac  },
  task_done:        { icon: '✅', color: C.gr  },
  task_created:     { icon: '➕', color: C.yw  },
  user_registered:  { icon: '👤', color: '#a371f7' },
  // Reports
  report_saved:     { icon: '📝', color: C.ac  },
  report_submitted: { icon: '📤', color: C.yw  },
  report_signed:    { icon: '✍️', color: C.gr  },
  // Training-Plan
  goal_added:       { icon: '🎯', color: C.ac  },
  goal_learned:     { icon: '💡', color: C.yw  },
  goal_confirmed:   { icon: '🏆', color: C.gr  },
  goal_updated:     { icon: '✏️', color: C.mu  },
  goal_deleted:     { icon: '🗑️', color: C.cr  },
  goals_imported:   { icon: '📥', color: C.ac  },
};

function activityText(entry) {
  switch (entry.type) {
    case 'project_created':
      return <>{entry.userName} hat Projekt <strong style={{ color: C.br }}>{entry.entityTitle}</strong> erstellt</>;
    case 'task_done':
      return <>{entry.userName} hat Aufgabe <strong style={{ color: C.br }}>{entry.entityTitle}</strong> abgeschlossen{entry.projectTitle ? <span style={{ color: C.mu }}> · {entry.projectTitle}</span> : null}</>;
    case 'task_created':
      return <>{entry.userName} hat Aufgabe <strong style={{ color: C.br }}>{entry.entityTitle}</strong> hinzugefügt{entry.projectTitle ? <span style={{ color: C.mu }}> · {entry.projectTitle}</span> : null}</>;
    case 'user_registered':
      return <><strong style={{ color: C.br }}>{entry.userName}</strong> hat sich registriert</>;
    case 'report_saved':
      return <>{entry.userName} hat Berichtsheft <strong style={{ color: C.br }}>{entry.entityTitle}</strong> gespeichert</>;
    case 'report_submitted':
      return <>{entry.userName} hat Berichtsheft <strong style={{ color: C.br }}>{entry.entityTitle}</strong> eingereicht</>;
    case 'report_signed':
      return <>{entry.userName} hat Berichtsheft <strong style={{ color: C.br }}>{entry.entityTitle}</strong> signiert</>;
    case 'goal_added':
      return <>{entry.userName} hat Lernziel <strong style={{ color: C.br }}>{entry.entityTitle}</strong> angelegt</>;
    case 'goal_learned':
      return <>{entry.userName} hat <strong style={{ color: C.br }}>{entry.entityTitle}</strong> als gelernt markiert</>;
    case 'goal_confirmed':
      return <>{entry.userName} hat Kompetenz <strong style={{ color: C.br }}>{entry.entityTitle}</strong> bestätigt</>;
    case 'goal_updated':
      return <>{entry.userName} hat Lernziel <strong style={{ color: C.br }}>{entry.entityTitle}</strong> bearbeitet</>;
    case 'goal_deleted':
      return <>{entry.userName} hat Lernziel <strong style={{ color: C.br }}>{entry.entityTitle}</strong> gelöscht</>;
    case 'goals_imported':
      return <>{entry.userName} hat <strong style={{ color: C.br }}>{entry.entityTitle}</strong> importiert</>;
    default:
      return entry.action || '–';
  }
}

function ActivityFeed({ activityLog = [] }) {
  const entries = activityLog.slice(0, 15);

  return (
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
          Noch keine Aktivitäten
        </div>
      ) : entries.map(entry => {
        const cfg = ACTIVITY_CONFIG[entry.type] || { icon: '📋', color: C.mu };
        return (
          <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 2px', borderBottom: `1px solid ${C.bd}22` }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: cfg.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>
              {cfg.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.tx, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activityText(entry)}
              </div>
              <div style={{ fontSize: 9, color: C.mu, marginTop: 1, fontFamily: C.mono }}>
                {relTime(entry.ts)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ZEITERFASSUNG KW-WIDGET (Ausbilder)
// ─────────────────────────────────────────────────────────────
function ZeiterfassungWidget({ users, projects }) {
  const getMonStr = (offset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay()+6)%7) + offset * 7);
    d.setHours(0,0,0,0);
    return d.toISOString().split('T')[0];
  };
  const [monStr, setMonStr] = useState(() => getMonStr(0));
  const today = new Date().toISOString().split('T')[0];

  const sunStr = (() => { const d = new Date(monStr); d.setDate(d.getDate()+6); return d.toISOString().split('T')[0]; })();
  const kwNum  = Math.ceil((new Date(monStr) - new Date(new Date(monStr).getFullYear(), 0, 1)) / 604800000);

  const azubis = users.filter(u => u.role === 'azubi');

  const rows = azubis.map(a => {
    const breakdown = projects.filter(p => !p.archived).reduce((acc, p) => {
      const h = (p.tasks||[]).filter(t => t.assignee === a.id)
        .flatMap(t => (t.timeLog||[]).filter(e => e.date >= monStr && e.date <= sunStr))
        .reduce((s, e) => s + (Number(e.hours)||0), 0);
      if (h > 0) acc.push({ title: p.title, hours: h });
      return acc;
    }, []);
    return { azubi: a, total: breakdown.reduce((s, b) => s + b.hours, 0), breakdown };
  });

  const maxH = Math.max(...rows.map(r => r.total), 0.1);

  const exportCSV = () => {
    const lines = ['"KW";"Azubi";"Projekt";"Stunden"'];
    rows.forEach(r => {
      if (r.breakdown.length) r.breakdown.forEach(b => lines.push(`"${kwNum}";"${r.azubi.name}";"${b.title}";"${b.hours.toFixed(2).replace('.',',')}"`));
      else lines.push(`"${kwNum}";"${r.azubi.name}";"–";"0"`);
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(blob); a2.download = `zeiterfassung_kw${kwNum}.csv`;
    document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
  };

  const hasAny = rows.some(r => r.total > 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9 }}>
        <button className="btn" style={{ padding: '2px 7px', fontSize: 11 }}
          onClick={() => { const d = new Date(monStr); d.setDate(d.getDate()-7); setMonStr(d.toISOString().split('T')[0]); }}>←</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.br }}>KW {kwNum}</span>
        <button className="btn" style={{ padding: '2px 7px', fontSize: 11 }}
          disabled={monStr >= getMonStr(0)}
          onClick={() => { const d = new Date(monStr); d.setDate(d.getDate()+7); if (d.toISOString().split('T')[0] <= today) setMonStr(d.toISOString().split('T')[0]); }}>→</button>
        {hasAny && <button className="btn" style={{ padding: '2px 6px', fontSize: 9 }} onClick={exportCSV} title="CSV exportieren">↓CSV</button>}
      </div>
      {!hasAny ? (
        <div style={{ fontSize: 11, color: C.textSecondary, textAlign: 'center', padding: '8px 0' }}>
          Keine Zeiteinträge für KW {kwNum}
        </div>
      ) : rows.map(({ azubi, total, breakdown }) => (
        <div key={azubi.id} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <Avatar name={azubi.name} url={azubi.avatar_url} size={18} />
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {azubi.name.split(' ')[0]}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: C.mono, color: total > 0 ? C.gr : C.mu }}>
              {total.toFixed(1)}h
            </span>
          </div>
          <div style={{ height: 4, background: C.bd2, borderRadius: 2, overflow: 'hidden', marginLeft: 25, marginBottom: 3 }}>
            <div style={{ height: '100%', width: `${Math.min(100, total / maxH * 100)}%`, background: total > 0 ? C.gr : C.bd2, borderRadius: 2, transition: 'width .4s' }} />
          </div>
          {breakdown.map(b => (
            <div key={b.title} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textSecondary, marginLeft: 25 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>· {b.title}</span>
              <span style={{ fontFamily: C.mono, flexShrink: 0 }}>{b.hours.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MONATSREPORT MODAL (H3)
// ─────────────────────────────────────────────────────────────
function MonthReportModal({ projects, users, reports, onClose }) {
  const now  = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const azubis = users.filter(u => u.role === 'azubi');

  const monthStart = `${year}-${String(month + 1).padStart(2,'0')}-01`;
  const monthEnd   = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const monthName  = new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const rows = azubis.map(a => {
    const hours = projects.filter(p => !p.archived).flatMap(p =>
      (p.tasks||[]).filter(t => t.assignee === a.id)
        .flatMap(t => (t.timeLog||[]).filter(e => e.date >= monthStart && e.date <= monthEnd))
        .map(e => Number(e.hours)||0)
    ).reduce((s, h) => s + h, 0);

    const done = projects.flatMap(p =>
      (p.tasks||[]).filter(t => t.assignee === a.id && t.status === 'done' && t.updated_at &&
        t.updated_at >= monthStart && t.updated_at <= monthEnd + 'T99')
    ).length;

    const myReports = reports.filter(r =>
      r.user_id === a.id && r.week_start >= monthStart && r.week_start <= monthEnd
    );

    return { azubi: a, hours, done, reports: myReports };
  });

  const [printing, setPrinting] = useState(false);
  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('Popup blockiert – bitte Pop-ups erlauben'); return; }
    setPrinting(true);
    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const totalDone  = rows.reduce((s, r) => s + r.done,  0);
    const totalReps  = rows.reduce((s, r) => s + r.reports.length, 0);
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monatsreport ${monthName}</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;color:#111;font-size:13px}
      h1{font-size:20px}
      h2{font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:20px}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px 12px;border-bottom:1px solid #eee;text-align:left}
      th{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666}
      tfoot td{font-weight:700;border-top:2px solid #333;background:#fafafa}
      @media print{
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
        thead{display:table-header-group}
        tr{page-break-inside:avoid}
      }
    </style>
    </head><body>
    <h1>Monatsreport – ${monthName}</h1>
    <table><thead><tr><th>Azubi</th><th>Stunden</th><th>Aufgaben ✓</th><th>Berichte</th><th>Status</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td>${r.azubi.name}</td>
      <td>${r.hours.toFixed(1)}h</td>
      <td>${r.done}</td>
      <td>${r.reports.length}</td>
      <td>${r.reports.map(rep => rep.status).join(', ') || '–'}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr><td>Gesamt</td><td>${totalHours.toFixed(1)}h</td><td>${totalDone}</td><td>${totalReps}</td><td>–</td></tr></tfoot>
    </table>
    <p style="font-size:10px;color:#999;margin-top:30px">Erstellt mit AzubiBoard · ${new Date().toLocaleDateString('de-DE')}</p>
    </body></html>`);
    w.document.close();
    const fire = () => { try { w.print(); } finally { setPrinting(false); } };
    if (w.document.readyState === 'complete') fire();
    else w.onload = fire;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 14, width: 620, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-bd)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.br, flex: 1 }}>📊 Monatsreport</span>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.br }}>
            {Array.from({length:12},(_,i) => <option key={i} value={i}>{new Date(2000,i).toLocaleDateString('de-DE',{month:'long'})}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.br }}>
            {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={printReport} disabled={printing || rows.length === 0} aria-label="Monatsreport drucken"
            style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: printing ? C.mu : C.br, cursor: printing ? 'wait' : 'pointer', opacity: (printing || rows.length === 0) ? .5 : 1 }}>
            {printing ? '⏳ ...' : '🖨 PDF'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.mu, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {/* Table */}
        <div style={{ overflowY: 'auto', padding: '12px 18px' }}>
          <div style={{ fontSize: 12, color: C.mu, marginBottom: 12, fontWeight: 600 }}>{monthName}</div>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.mu, padding: '24px', fontSize: 13 }}>Keine Azubis vorhanden.</div>
          ) : (
            <div style={{ background: C.sf2, borderRadius: 9, overflow: 'hidden', border: `1px solid ${C.bd}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '7px 14px', background: C.sf3, borderBottom: `1px solid ${C.bd}`, fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 }}>
                <div>Azubi</div><div>Stunden</div><div>Aufg. ✓</div><div>Berichte</div>
              </div>
              {rows.map(r => (
                <div key={r.azubi.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '9px 14px', borderBottom: `1px solid ${C.bd}22`, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={r.azubi.name} url={r.azubi.avatar_url} size={22} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.br }}>{r.azubi.name}</span>
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: r.hours > 0 ? C.gr : C.mu }}>{r.hours.toFixed(1)}h</div>
                  <div style={{ fontFamily: C.mono, fontSize: 13, color: r.done > 0 ? C.ac : C.mu }}>{r.done}</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {r.reports.length === 0 ? <span style={{ fontSize: 10, color: C.mu }}>–</span> : r.reports.slice(0,3).map(rep => {
                      const clr = { draft: C.mu, submitted: C.ac, reviewed: C.yw, signed: C.gr }[rep.status] || C.mu;
                      return <span key={rep.id} style={{ fontSize: 9, color: clr, background: clr+'18', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>KW{rep.week_number}</span>;
                    })}
                    {r.reports.length > 3 && <span style={{ fontSize: 9, color: C.mu }}>+{r.reports.length-3}</span>}
                  </div>
                </div>
              ))}
              <div style={{ padding: '9px 14px', borderTop: `1px solid ${C.bd}`, display: 'flex', gap: 20 }}>
                <span style={{ fontSize: 11, color: C.mu }}>Gesamt:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.gr, fontFamily: C.mono }}>{rows.reduce((s,r) => s+r.hours,0).toFixed(1)}h</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ac, fontFamily: C.mono }}>{rows.reduce((s,r) => s+r.done,0)} Aufgaben</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.mu, fontFamily: C.mono }}>{rows.reduce((s,r) => s+r.reports.length,0)} Berichte</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
