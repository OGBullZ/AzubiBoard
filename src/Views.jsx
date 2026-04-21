import { useState, useEffect, useCallback, useRef } from "react";
import { C, fmtDate } from './utils.js';
import { StatusBadge, Avatar, ProgressBar, EmptyState, IconBtn } from './Components.jsx';
import {
  IcoFolder, IcoCheck, IcoClock, IcoPlay, IcoChevron, IcoChevronD,
  IcoTrendUp, IcoSearch, IcoTrash, IcoPlus, IcoLink, IcoDoc,
  IcoArchive, IcoLearn, IcoReport, IcoCalendar,
  IcoAlert, IcoNote, IcoUsers, IcoPause, IcoBlock
} from './Icons.jsx';

// ─────────────────────────────────────────────────────────────
//  KLEINE HELFER
// ─────────────────────────────────────────────────────────────

// Lebende Uhr (aktualisiert sich jede Sekunde)
function LiveClock() {
  const [t, setT] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <span style={{ fontFamily: C.mono, fontSize: 14, color: C.ac, fontWeight: 700, letterSpacing: 1.5, userSelect: 'none' }}>
      {t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
    </span>
  );
}

// Zählt von 0 auf target hoch (600ms)
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

// SVG Progress-Ring — das visuelle Herzstück der Projektkarten
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

// Kompakte Info-Chip im Header
function Chip({ value, label, color, animated = false }) {
  // Hook muss IMMER aufgerufen werden – nie bedingt
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

// Dringlichkeits-Farbe für Deadlines
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

// Status-Icons für Aufgaben
const ST_ICONS = { in_progress: IcoPlay, not_started: IcoCheck, waiting: IcoPause, blocked: IcoBlock, done: IcoCheck };
const ST_COLORS = { in_progress: C.ac, not_started: C.mu, waiting: C.yw, blocked: C.cr, done: C.gr };

// ─────────────────────────────────────────────────────────────
//  DASHBOARD WIDGETS
// ─────────────────────────────────────────────────────────────

// Panel-Überschrift mit Icon
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

// ── Aufgaben-Hero-Karte: die dringendste Aufgabe groß ─────────
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
    <div style={{ borderRadius: 10, border: `1.5px solid ${accent}40`, background: accentBg, padding: '20px 20px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: accent + '10', pointerEvents: 'none' }} />

      {/* Status + Datum */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>
          {isOverdue ? '⚠ Überfällig' : isActive ? '▶ In Bearbeitung' : '📅 Heute fällig'}
        </span>
        {task.deadline && (
          <span style={{ fontSize: 9, fontFamily: C.mono, color: accent, background: accent + '15', borderRadius: 4, padding: '1px 6px' }}>
            {fmtDate(task.deadline)}
          </span>
        )}
        {/* Notiz-Toggle */}
        <button onClick={() => setShowNote(s => !s)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: showNote ? accent + '20' : 'transparent', border: `1px solid ${accent}30`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: accent, fontSize: 10, fontWeight: 600 }}>
          <IcoNote size={10} /> {task.note ? 'Notiz' : '+ Notiz'}
        </button>
      </div>

      {/* Titel */}
      <div style={{ fontSize: 15, fontWeight: 800, color: C.br, lineHeight: 1.4, marginBottom: showNote ? 8 : 10, wordBreak: 'break-word' }}>
        {task.text}
      </div>

      {/* Notiz-Eingabe (inline) */}
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

      {/* Projekt + Erledigen */}
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

// ── Aufgaben-Queue (restliche Aufgaben, kompakt) ──────────────
function TaskQueue({ tasks, onToggle, onOpen }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', marginRight: -4, paddingRight: 4 }}>
      {tasks.map(t => {
        const StIcon = ST_ICONS[t.status] || IcoCheck;
        const stColor = ST_COLORS[t.status] || C.mu;
        return (
          <div key={t.id}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 7px', borderRadius: 7, marginBottom: 2, cursor: 'pointer', transition: 'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {/* Kleine Checkbox */}
            <button onClick={e => { e.stopPropagation(); onToggle(t.projectId, t.id); }}
              style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${t.isOverdue ? C.cr : stColor}`, background: 'transparent', flexShrink: 0, marginTop: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.gr; e.currentTarget.style.borderColor = C.gr; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.isOverdue ? C.cr : stColor; }}>
              {t.status === 'in_progress' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.ac }} />}
            </button>
            {/* Text */}
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

// ── Erweiterbare Projekt-Karte mit Inline-Aktionen ────────────
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

  // Offene Tasks für die Inline-Liste (max 4)
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

      {/* ── Kopfzeile: immer sichtbar ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 11px', cursor: 'pointer' }}
        onClick={handleToggleExpand}>

        {/* Ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); onClick?.(); }}
          title="Zum Projekt öffnen">
          <Ring pct={pct} size={42} stroke={4} color={pct === 100 ? C.gr : C.ac} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: pct === 100 ? C.gr : C.ac, fontFamily: C.mono, lineHeight: 1 }}>{pct}</span>
          </div>
        </div>

        {/* Name + Meta */}
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

        {/* Avatare + Expand-Pfeil */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex' }}>
            {au.slice(0, 3).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -7 : 0, zIndex: i }}><Avatar name={u.name} size={20} /></div>)}
          </div>
          <IcoChevronD size={11} style={{ color: C.textSecondary, transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>

      {/* Fortschrittsbalken */}
      {total > 0 && (
        <div style={{ padding: '0 11px 9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={3} label={`${pct}%`} />
            <span style={{ fontSize: 9, color: C.textSecondary, fontFamily: C.mono, flexShrink: 0 }}>{done}/{total}</span>
          </div>
        </div>
      )}

      {/* ── Inline-Panel (aufgeklappt) ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.bd}`, background: 'var(--c-sf3)', padding: '10px 11px' }}
          onClick={e => e.stopPropagation()}>

          {/* Status-Picker */}
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

          {/* Offene Tasks inline */}
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

          {/* Schnelle Aufgabe hinzufügen */}
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

          {/* Zum Projekt-Button */}
          <button onClick={e => { e.stopPropagation(); onClick?.(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: C.ac, fontSize: 11, fontWeight: 700, padding: '2px 0' }}>
            <IcoChevron size={11} /> Vollständig öffnen
          </button>
        </div>
      )}
    </div>
  );
}

// ── Wochenfortschritt: Mini-Balken Mo–Fr ──────────────────────
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
                {/* Hintergrund-Balken */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: maxH, background: 'var(--c-bd)', borderRadius: 3, opacity: .5 }} />
                {/* Fortschritts-Balken */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barH, background: d.isToday ? C.ac : d.done > 0 ? C.gr : isFuture ? 'var(--c-bd2)' : C.mu + '60', borderRadius: 3, transition: 'height .5s ease' }} />
                {/* Offene Tasks als rotes Stück */}
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

// ── Deadline-Widget, zeitlich gruppiert ───────────────────────
function DeadlineWidget({ projects, userId, isAusbilder, onOpen }) {
  const now = new Date();
  const items = projects
    .filter(p => p.deadline && !p.archived)
    .filter(p => isAusbilder || p.assignees.includes(userId))
    .map(p => ({ ...p, diff: Math.ceil((new Date(p.deadline) - now) / 86400000) }))
    .filter(p => p.diff <= 21)
    .sort((a, b) => a.diff - b.diff);

  if (!items.length) return (
    <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', padding: '10px 0' }}>
      Keine Deadlines in den nächsten 21 Tagen 🎉
    </div>
  );

  // Gruppen
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

// ── Kalender-Widget ───────────────────────────────────────────
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

// ── Berichtsheft-Widget ───────────────────────────────────────
function ReportWidget({ reports, userId, onNavigate }) {
  const mine   = reports.filter(r => r.user_id === userId);
  const total  = mine.length;
  const signed = mine.filter(r => r.status === 'signed').length;
  const sub    = mine.filter(r => r.status === 'submitted').length;
  const draft  = mine.filter(r => r.status === 'draft').length;

  // Wurde diese Woche bereits ein Bericht erstellt?
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const thisWeekReport = mine.find(r => new Date(r.week_start) >= monday);
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


// ── Lernbereich-Widget (echt) ─────────────────────────────────
function LearnWidget({ userId, onNavigate }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const key = `azubi_quiz_${userId || 'anon'}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setHistory(saved);
    } catch {}
  }, [userId]);

  const avg = history.length > 0
    ? Math.round(history.reduce((s, e) => s + e.pct, 0) / history.length)
    : null;
  const best = history.length > 0 ? Math.max(...history.map(e => e.pct)) : null;
  const last  = history[0];
  const trend = history.length >= 2 ? history[0].pct - history[1].pct : null;

  if (history.length === 0) {
    return (
      <div>
        <div style={{ fontSize: 14, color: C.textSecondary, fontStyle: 'italic', marginBottom: 9 }}>
          Noch kein Quiz absolviert.
        </div>
        <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0' }}>
          <IcoLearn size={10} /> Quiz starten
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Schnell-Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 9 }}>
        {[
          { l: 'Ø Ergebnis', v: `${avg}%`, c: avg >= 75 ? C.gr : avg >= 50 ? C.yw : C.cr },
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

      {/* Letztes Ergebnis */}
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
//  AUSBILDER-DASHBOARD
// ─────────────────────────────────────────────────────────────
function AusbilderDashboard({ user, projects, users, reports, calendarEvents, onOpenProject, onUpdateProject, onNavigate }) {
  const now      = new Date();
  const azubis   = users.filter(u => u.role === 'azubi');
  const active   = projects.filter(p => !p.archived);
  const pending  = reports.filter(r => r.status === 'submitted');
  const problems = active.filter(p => p.status === 'red');

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Guten Tag' : 'Guten Abend';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="anim">

      {/* Header */}
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Chip value={azubis.length}  label="Azubis"    color={C.ac} />
          <Chip value={active.length}  label="Projekte"  color={C.gr} animated />
          <Chip value={pending.length} label="Berichte"  color={pending.length > 0 ? C.yw : C.mu} />
          {problems.length > 0 && <Chip value={problems.length} label="Probleme" color={C.cr} />}
        </div>
      </div>

      {/* 3-Spalten */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr minmax(260px, 300px)', overflow: 'hidden', minHeight: 0 }}>

        {/* Spalte 1: Azubis Übersicht */}
        <div style={{ padding: '20px 20px', borderRight: `1px solid var(--c-bd)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PanelTitle Icon={IcoUsers}>Azubi-Übersicht</PanelTitle>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {azubis.map(a => {
              const myProjects = active.filter(p => p.assignees.includes(a.id));
              const myTasks    = myProjects.flatMap(p => p.tasks.filter(t => t.assignee === a.id && t.status !== 'done'));
              const inProgress = myProjects.flatMap(p => p.tasks.filter(t => t.assignee === a.id && t.status === 'in_progress'));
              const overdue    = myTasks.filter(t => t.deadline && new Date(t.deadline) < now);
              const doneTotal  = myProjects.flatMap(p => p.tasks.filter(t => t.status === 'done' || t.done)).length;
              const totalTasks = myProjects.flatMap(p => p.tasks).length;
              const pct        = totalTasks > 0 ? Math.round(doneTotal / totalTasks * 100) : 0;

              return (
                <div key={a.id} style={{ padding: '11px 12px', background: 'var(--c-sf2)', border: `1px solid var(--c-bd)`, borderRadius: 9, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Avatar name={a.name} size={34} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: C.br }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: C.textSecondary }}>Lehrjahr {a.apprenticeship_year || 1} · {a.email}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.ac, fontFamily: C.mono }}>{pct}%</div>
                      <div style={{ fontSize: 9, color: C.textSecondary }}>Gesamt</div>
                    </div>
                  </div>
                  <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={4} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, color: C.textSecondary }}>📁 {myProjects.length} Projekte</span>
                    {inProgress.length > 0 && <span style={{ fontSize: 10, color: C.ac }}>▶ {inProgress.length} aktiv</span>}
                    {overdue.length > 0   && <span style={{ fontSize: 10, color: C.cr, fontWeight: 700 }}>⚠ {overdue.length} überfällig</span>}
                    <span style={{ fontSize: 10, color: C.textSecondary }}>{myTasks.length} offen</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spalte 2: Projekte + Probleme */}
        <div style={{ padding: '20px 20px', borderRight: `1px solid var(--c-bd)`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {problems.length > 0 && (
            <div style={{ marginBottom: 14, flexShrink: 0 }}>
              <PanelTitle Icon={IcoAlert} badge={{ text: problems.length, bg: C.crd, c: C.cr }}>Projekte mit Problemen</PanelTitle>
              {problems.map(p => (
                <button key={p.id} onClick={() => onOpenProject(p.id)} className="row-btn"
                  style={{ justifyContent: 'space-between', marginBottom: 4, padding: '7px 9px', border: `1px solid ${C.cr}25`, borderRadius: 8, background: C.crd }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    <div style={{ fontSize: 10, color: C.textSecondary }}>{users.filter(u => p.assignees.includes(u.id)).map(u => u.name.split(' ')[0]).join(', ')}</div>
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

        {/* Spalte 3: Berichte + Kalender */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', overflowY: 'auto' }}>
          {/* Ausstehende Berichte */}
          <div style={{ padding: '20px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
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

          {/* Kalender */}
          <div style={{ padding: '20px 20px', flexShrink: 0 }}>
            <PanelTitle Icon={IcoCalendar}>Nächste Termine</PanelTitle>
            <CalWidget calendarEvents={calendarEvents} projects={active} onNavigate={() => onNavigate?.('calendar')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  AZUBI-DASHBOARD
// ─────────────────────────────────────────────────────────────
function AzubiDashboard({ user, projects, users, reports, calendarEvents, onNewProject, onOpenProject, onUpdateProject, onNavigate }) {
  const now  = new Date();
  const mine = projects.filter(p => !p.archived && p.assignees.includes(user.id));

  // Alle meine offenen Aufgaben, sortiert nach Dringlichkeit
  const allTasks = projects.flatMap(p =>
    p.tasks
      .filter(t => t.assignee === user.id && t.status !== 'done')
      .map(t => ({
        ...t,
        projectTitle: p.title,
        projectId:    p.id,
        isOverdue:    !!(t.deadline && new Date(t.deadline) < now),
      }))
  ).sort((a, b) => {
    // Überfällig → Aktiv → Deadline heute → Priorität → Rest
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    if (a.deadline && b.deadline) return a.deadline < b.deadline ? -1 : 1;
    const prio = { high: 0, medium: 1, low: 2 };
    return (prio[a.priority] ?? 1) - (prio[b.priority] ?? 1);
  });

  const heroTask  = allTasks[0] || null;
  const queueTasks = allTasks.slice(1);

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

  const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
  const overdue    = allTasks.filter(t => t.isOverdue).length;
  const allProjectTasks = projects.flatMap(p => p.tasks);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className="anim">

      {/* ── HERO HEADER ── */}
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
        {/* Schnell-Chips */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip value={mine.length}        label="Projekte" color={C.ac}  animated />
          <Chip value={allTasks.length}    label="Offen"    color={C.mu}  animated />
          {inProgress > 0 && <Chip value={inProgress} label="Aktiv"    color={C.yw} animated />}
          {overdue > 0    && <Chip value={overdue}     label="Überfäll." color={C.cr} />}
        </div>
        <button className="abtn" onClick={onNewProject} style={{ fontSize: 12, flexShrink: 0 }}>
          <IcoPlus size={13} /> Neues Projekt
        </button>
      </div>

      {/* ── 3-SPALTEN GRID ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '30% 1fr minmax(260px, 300px)', overflow: 'hidden', minHeight: 0 }}>

        {/* ══ SPALTE 1: Aufgaben-Fokus ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid var(--c-bd)` }}>

          {/* Top: Fokus-Aufgabe + Queue */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 14px 10px' }}>
            <PanelTitle Icon={IcoPlay} count={allTasks.length}>Meine Aufgaben</PanelTitle>

            {/* Hero-Karte */}
            <HeroTask task={heroTask}
              onToggle={() => heroTask && toggleTask(heroTask.projectId, heroTask.id)}
              onOpen={onOpenProject}
              onUpdateNote={updateTaskNote} />

            {/* Queue */}
            {queueTasks.length > 0 && (
              <>
                <div style={{ height: 1, background: 'var(--c-bd)', margin: '10px 0 8px', flexShrink: 0 }} />
                <TaskQueue tasks={queueTasks} onToggle={toggleTask} onOpen={onOpenProject} />
              </>
            )}
          </div>

          {/* Bottom: Wochenübersicht */}
          <div style={{ flexShrink: 0, padding: '10px 14px 12px', borderTop: `1px solid var(--c-bd)`, background: 'var(--c-sf)' }}>
            <PanelTitle Icon={IcoTrendUp}>Wochenübersicht</PanelTitle>
            <WeekProgress tasks={allProjectTasks} userId={user.id} />
          </div>
        </div>

        {/* ══ SPALTE 2: Projekte ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid var(--c-bd)` }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '14px 16px 10px' }}>
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

          {/* Aktivitäts-Feed (echt) */}
          <div style={{ flexShrink: 0, padding: '10px 16px 12px', borderTop: `1px solid var(--c-bd)`, background: 'var(--c-sf)', maxHeight: '35%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PanelTitle Icon={IcoNote}>Letzte Aktivität</PanelTitle>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {(() => {
                const events = [];
                const now = new Date();
                const fmt = d => {
                  if (!d) return '';
                  const dt = new Date(d);
                  const diff = Math.floor((now - dt) / 86400000);
                  if (diff === 0) return 'Heute';
                  if (diff === 1) return 'Gestern';
                  if (diff < 7) return dt.toLocaleDateString('de-DE', { weekday: 'short' });
                  return dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                };
                projects.filter(p => !p.archived && p.assignees.includes(user.id)).forEach(p => {
                  (p.tasks || []).filter(t => t.status === 'done' && t.deadline).forEach(t => {
                    events.push({ c: C.gr, Icon: IcoCheck, text: `${t.text}`, sub: `${p.title}`, date: t.deadline });
                  });
                  (p.steps || []).forEach(s => {
                    events.push({ c: C.ac, Icon: IcoDoc, text: s.title, sub: `${p.title}`, date: s.date });
                  });
                  (p.links || []).filter(l => l.created).forEach(l => {
                    events.push({ c: C.yw, Icon: IcoLink, text: l.title || l.url, sub: `${p.title}`, date: l.created.split('T')[0] });
                  });
                });
                const sorted = events.sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1).slice(0, 8);
                if (sorted.length === 0) return <div style={{ fontSize: 14, color: C.textSecondary, fontStyle: 'italic', padding: '4px 0' }}>Noch keine Aktivität</div>;
                return sorted.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: a.c + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <a.Icon size={11} style={{ color: a.c }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</div>
                      <div style={{ fontSize: 9, color: C.textSecondary }}>{a.sub} · {fmt(a.date)}</div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* ══ SPALTE 3: Infos, scrollbar ══ */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Deadlines */}
          <div style={{ padding: '20px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoClock}>Deadlines</PanelTitle>
            <DeadlineWidget projects={projects} userId={user.id} isAusbilder={false} onOpen={onOpenProject} />
          </div>

          {/* Kalender */}
          <div style={{ padding: '20px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoCalendar}>Nächste Termine</PanelTitle>
            <CalWidget calendarEvents={calendarEvents} projects={projects} onNavigate={() => onNavigate?.('calendar')} />
          </div>

          {/* Berichtsheft */}
          <div style={{ padding: '20px 20px', borderBottom: `1px solid var(--c-bd)`, flexShrink: 0 }}>
            <PanelTitle Icon={IcoReport}>Berichtshefte</PanelTitle>
            <ReportWidget reports={reports} userId={user.id} onNavigate={() => onNavigate?.('reports')} />
          </div>

          {/* Lernbereich */}
          <div style={{ padding: '20px 20px', flexShrink: 0 }}>
            <PanelTitle Icon={IcoLearn}>Lernfortschritt</PanelTitle>
            <LearnWidget userId={user.id} onNavigate={() => onNavigate?.('learn')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  EXPORT: Dashboard (Route zu Azubi oder Ausbilder)
// ─────────────────────────────────────────────────────────────
export function Dashboard(props) {
  if (props.user?.role === 'ausbilder') {
    return <AusbilderDashboard {...props} />;
  }
  return <AzubiDashboard {...props} />;
}

// ─────────────────────────────────────────────────────────────
//  PROJECT POOL
// ─────────────────────────────────────────────────────────────
export function ProjectPool({ projects, users, groups, currentUser, onOpen, onNew, onDelete, onArchive, onUnarchive }) {
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [viewMode,    setViewMode]    = useState('grid'); // 'grid' | 'table'

  const active   = projects.filter(p => !p.archived);
  const archived = projects.filter(p => p.archived);

  const visible = active.filter(p => {
    if (filter === 'mine' && !p.assignees.includes(currentUser.id) && currentUser.role !== 'ausbilder') return false;
    if (['green','yellow','red'].includes(filter) && p.status !== filter) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const FILTERS = [
    ['all',    'Alle',       null,  C.ac, active.length],
    ['mine',   'Meine',      null,  C.mu, active.filter(p => p.assignees.includes(currentUser.id)).length],
    ['green',  'In Ordnung', C.gr,  C.gr, active.filter(p => p.status === 'green').length],
    ['yellow', 'Laufend',    C.yw,  C.yw, active.filter(p => p.status === 'yellow').length],
    ['red',    'Problem',    C.cr,  C.cr, active.filter(p => p.status === 'red').length],
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 20px' }} className="anim">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Projekte</h1>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: C.textSecondary, pointerEvents: 'none' }}><IcoSearch size={12} /></div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen…" style={{ paddingLeft: 28, width: 200 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FILTERS.map(([v, l, dot, c, cnt]) => (
              <button key={v} className="btn" onClick={() => setFilter(v)} aria-pressed={filter === v}
                style={{ fontSize: 11, padding: '5px 10px', background: filter === v ? c + '18' : '', borderColor: filter === v ? c : '', color: filter === v ? c : C.tx }}>
                {dot && <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
                {l} <span style={{ fontSize: 9, fontFamily: C.mono, opacity: .6 }}>({cnt})</span>
              </button>
            ))}
          </div>
          <button className="abtn" onClick={onNew} style={{ fontSize: 12 }}>
            <IcoPlus size={13} /> Neu
          </button>
          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--c-sf2)', borderRadius: 7, padding: 2, gap: 2, border: `1px solid var(--c-bd)` }}>
            <button onClick={() => setViewMode('grid')}
              style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: viewMode === 'grid' ? C.ac : 'transparent', color: viewMode === 'grid' ? '#fff' : C.mu, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><rect x="0" y="0" width="5" height="5" rx="1"/><rect x="7" y="0" width="5" height="5" rx="1"/><rect x="0" y="7" width="5" height="5" rx="1"/><rect x="7" y="7" width="5" height="5" rx="1"/></svg>
              Grid
            </button>
            <button onClick={() => setViewMode('table')}
              style={{ padding: '4px 8px', borderRadius: 5, border: 'none', background: viewMode === 'table' ? C.ac : 'transparent', color: viewMode === 'table' ? '#fff' : C.mu, cursor: 'pointer', fontSize: 11, fontWeight: 700, transition: 'all .12s', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 14 14" width="12" height="12" fill="currentColor"><rect x="0" y="0" width="14" height="3" rx="1"/><rect x="0" y="5" width="14" height="3" rx="1"/><rect x="0" y="10" width="14" height="3" rx="1"/></svg>
              Liste
            </button>
          </div>
        </div>
      </div>

      {/* Grid / Tabelle */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {visible.length === 0 ? (
          <EmptyState Icon={IcoSearch} title="Keine Projekte"
            subtitle={search ? `Nichts für "${search}"` : 'Noch keine Projekte in dieser Kategorie'}
            action={!search ? '+ Neues Projekt' : undefined} onAction={!search ? onNew : undefined} />
        ) : viewMode === 'table' ? (
          /* ── Tabellen-Ansicht ── */
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid var(--c-bd)`, textAlign: 'left' }}>
                {['Projekt','Status','Fortschritt','Azubis','Deadline','Aufgaben'].map(h => (
                  <th key={h} style={{ padding: '7px 12px', fontSize: 13, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .8, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
                {currentUser.role === 'ausbilder' && <th style={{ width: 60 }} />}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const au    = users.filter(u => p.assignees.includes(u.id));
                const done  = p.tasks.filter(t => t.status === 'done' || t.done).length;
                const pct   = p.tasks.length > 0 ? Math.round(done / p.tasks.length * 100) : 0;
                const sc    = p.status === 'green' ? C.gr : p.status === 'red' ? C.cr : C.yw;
                const over  = p.deadline && new Date(p.deadline) < new Date();
                return (
                  <tr key={p.id}
                    style={{ borderBottom: `1px solid var(--c-bd)`, cursor: 'pointer', transition: 'background .1s' }}
                    onClick={() => onOpen(p.id)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf3)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 3, height: 28, borderRadius: 2, background: sc, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 700, color: C.br }}>{p.title}</div>
                          {p.description && <div style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>{p.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td style={{ padding: '12px 14px', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={4} />
                        <span style={{ fontSize: 10, fontFamily: C.mono, color: C.textSecondary, flexShrink: 0 }}>{pct}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex' }}>
                        {au.slice(0, 4).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: i }}><Avatar name={u.name} size={22} /></div>)}
                        {au.length > 4 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--c-bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.textSecondary, marginLeft: -6 }}>+{au.length-4}</div>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontFamily: C.mono, fontSize: 11, color: over ? C.cr : C.mu, fontWeight: over ? 700 : 400 }}>
                      {p.deadline ? (over ? '⚠ ' : '') + fmtDate(p.deadline) : '–'}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', fontFamily: C.mono, fontSize: 11, color: C.textSecondary }}>
                      {done}/{p.tasks.length}
                      {p.tasks.filter(t => t.status === 'in_progress').length > 0 &&
                        <span style={{ color: C.ac, marginLeft: 6 }}>▶{p.tasks.filter(t => t.status === 'in_progress').length}</span>}
                    </td>
                    {currentUser.role === 'ausbilder' && (
                      <td style={{ padding: '12px 14px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <IconBtn Icon={IcoArchive} onClick={() => onArchive?.(p.id)} label="Archivieren" style={{ background: 'var(--c-sf)', border: `1px solid var(--c-bd2)` }} />
                          <IconBtn Icon={IcoTrash} onClick={() => onDelete(p.id, p.title)} label="Löschen" danger />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, alignContent: 'start' }}>
            {visible.map(p => {
              const au     = users.filter(u => p.assignees.includes(u.id));
              const grp    = groups.find(g => g.id === p.groupId);
              const done   = p.tasks.filter(t => t.status === 'done' || t.done).length;
              const pct    = p.tasks.length > 0 ? Math.round(done / p.tasks.length * 100) : null;
              const sc     = p.status === 'green' ? C.gr : p.status === 'red' ? C.cr : C.yw;
              const activ  = p.tasks.filter(t => t.status === 'in_progress').length;
              const lc     = (p.links || []).length;
              return (
                <article key={p.id} role="listitem" className="card proj-card"
                  style={{ cursor: 'pointer', borderLeft: `3px solid ${sc}`, transition: 'transform .12s, box-shadow .12s' }}
                  onClick={() => onOpen(p.id)} tabIndex={0} onKeyDown={e => e.key === 'Enter' && onOpen(p.id)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderLeftColor = sc; }}>
                  {currentUser.role === 'ausbilder' && (
                    <div className="hover-action" style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4 }}>
                      <IconBtn Icon={IcoArchive} onClick={e => { e.stopPropagation(); onArchive?.(p.id); }} label="Archivieren" style={{ background: 'var(--c-sf)', border: `1px solid var(--c-bd2)` }} />
                      <IconBtn Icon={IcoTrash}   onClick={e => { e.stopPropagation(); onDelete(p.id, p.title); }}  label="Löschen" danger />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7, gap: 8 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: C.br, margin: 0, lineHeight: 1.35, flex: 1, wordBreak: 'break-word' }}>{p.title}</h2>
                    <div style={{ flexShrink: 0 }}><StatusBadge status={p.status} /></div>
                  </div>
                  {p.description && (
                    <p style={{ fontSize: 14, color: C.textSecondary, margin: '0 0 9px', lineHeight: 1.55, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{p.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: 7, marginBottom: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                    {grp   && <span style={{ fontSize: 10, color: C.ac, display: 'flex', alignItems: 'center', gap: 3 }}><IcoFolder size={10} />{grp.name}</span>}
                    {lc > 0 && <span style={{ fontSize: 10, color: C.textSecondary, display: 'flex', alignItems: 'center', gap: 3 }}><IcoLink size={10} />{lc}</span>}
                    {activ > 0 && <span style={{ fontSize: 9, color: C.ac, fontFamily: C.mono, background: C.acd, borderRadius: 4, padding: '1px 5px' }}>▶ {activ}</span>}
                    {p.deadline && <time dateTime={p.deadline} style={{ fontSize: 10, color: new Date(p.deadline) < new Date() ? C.cr : C.mu, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}><IcoClock size={10} />{fmtDate(p.deadline)}</time>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pct !== null ? 8 : 0 }}>
                    <div style={{ display: 'flex' }}>
                      {au.slice(0, 5).map((u, i) => <div key={u.id} style={{ marginLeft: i > 0 ? -6 : 0, zIndex: i }}><Avatar name={u.name} size={22} /></div>)}
                      {au.length > 5 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--c-bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: C.textSecondary, marginLeft: -6 }}>+{au.length - 5}</div>}
                    </div>
                    <span style={{ fontSize: 10, color: C.textSecondary, fontFamily: C.mono }}>{done}/{p.tasks.length}</span>
                  </div>
                  {pct !== null && <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={3} />}
                </article>
              );
            })}
          </div>
        )}

        {/* Archiv */}
        {archived.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <button onClick={() => setShowArchive(s => !s)}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: `1px solid var(--c-bd)`, borderRadius: 7, padding: '6px 14px', cursor: 'pointer', color: C.textSecondary, fontSize: 12, fontWeight: 600, marginBottom: 12, transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = C.bd2} onMouseLeave={e => e.currentTarget.style.borderColor = C.bd}>
              <IcoArchive size={13} /> Archiv ({archived.length}) <span style={{ fontSize: 10, marginLeft: 2 }}>{showArchive ? '▲' : '▼'}</span>
            </button>
            {showArchive && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {archived.map(p => (
                  <div key={p.id} style={{ background: 'var(--c-sf2)', border: `1px solid var(--c-bd)`, borderRadius: 9, padding: '11px 14px', opacity: .6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.br, wordBreak: 'break-word', flex: 1 }}>{p.title}</span>
                      <span className="tag" style={{ background: 'var(--c-sf3)', color: C.textSecondary, border: `1px solid var(--c-bd2)`, fontSize: 9, flexShrink: 0 }}>Archiv</span>
                    </div>
                    <div style={{ display: 'flex', gap: 7 }}>
                      <button onClick={() => onUnarchive?.(p.id)} className="btn" style={{ fontSize: 11, padding: '3px 9px' }}>Wiederherstellen</button>
                      <button onClick={() => onDelete(p.id, p.title)} className="del" style={{ fontSize: 11 }}>Löschen</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
