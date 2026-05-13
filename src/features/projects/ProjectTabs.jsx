import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, useDroppable, useDraggable } from '@dnd-kit/core';
import { C, uid, today, fmtDate } from '../../lib/utils.js';
import { Avatar, ProgressBar, EmptyState, IconBtn } from '../../components/UI.jsx';
import { LinksManager } from './LinksManager.jsx';
import {
  IcoCheck, IcoAlert, IcoPlay, IcoPause, IcoBlock,
  IcoNote, IcoDoc, IcoMic, IcoLink, IcoTrash, IcoPlus,
  IcoClock, IcoChevronD, IcoMaterial
} from '../../components/Icons.jsx';

const TASK_STATUS = {
  in_progress: { label: 'In Bearbeitung', color: C.ac,  bg: 'var(--c-acd)',      Icon: IcoPlay   },
  not_started: { label: 'Nicht begonnen', color: C.mu,  bg: 'var(--c-sf2)',      Icon: IcoCheck  },
  waiting:     { label: 'Wartend',        color: C.yw,  bg: 'var(--c-ywd)',      Icon: IcoPause  },
  blocked:     { label: 'Blockiert',      color: C.cr,  bg: 'var(--c-crd)',      Icon: IcoBlock  },
  done:        { label: 'Erledigt',       color: C.gr,  bg: 'var(--st-green-bg)', Icon: IcoCheck },
};
const STATUS_ORDER = ['in_progress','not_started','waiting','blocked','done'];
const PRIORITY = {
  high:   { l: 'Hoch',    c: C.cr },
  medium: { l: 'Mittel',  c: C.yw },
  low:    { l: 'Niedrig', c: C.mu },
};

function mkTask(overrides = {}) {
  return { id: uid(), text: '', status: 'not_started', priority: 'medium', assignee: null, deadline: '', note: '', doc: '', protocol: '', links: [], labelIds: [], estimatedHours: 0, timeLog: [], created: today(), ...overrides };
}

function LabelChip({ label, tiny = false }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: tiny ? 9 : 10, fontWeight: 700, color: '#fff', background: label.color, borderRadius: 4, padding: tiny ? '1px 5px' : '2px 7px', lineHeight: 1.3 }}>
      {label.name}
    </span>
  );
}

// ── Zeit-Tab (Stunden-Log) ────────────────────────────────────
function ZeitTab({ task, onUpdate, currentUser }) {
  const [hours, setHours] = useState('');
  const [desc,  setDesc]  = useState('');

  const timeLog     = task.timeLog || [];
  const totalLogged = timeLog.reduce((s, e) => s + (Number(e.hours) || 0), 0);
  const estimated   = Number(task.estimatedHours) || 0;
  const pct         = estimated > 0 ? Math.min(100, Math.round(totalLogged / estimated * 100)) : 0;

  const addEntry = () => {
    const h = parseFloat(hours);
    if (!h || h <= 0) return;
    const entry = {
      id: uid(),
      hours: h,
      description: desc.trim(),
      date: today(),
      userId:   currentUser?.id,
      userName: currentUser?.name,
    };
    onUpdate(task.id, { timeLog: [...timeLog, entry] });
    setHours('');
    setDesc('');
  };

  const removeEntry = (entryId) =>
    onUpdate(task.id, { timeLog: timeLog.filter(e => e.id !== entryId) });

  return (
    <div>
      {/* Schätzung */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        <label style={{ marginBottom: 0, flexShrink: 0, fontSize: 11 }}>Schätzung:</label>
        <input type="number" min="0" step="0.5"
          value={task.estimatedHours || ''}
          onChange={e => onUpdate(task.id, { estimatedHours: parseFloat(e.target.value) || 0 })}
          placeholder="0" style={{ width: 72 }} />
        <span style={{ fontSize: 11, color: C.mu }}>Stunden geplant</span>
      </div>

      {/* Neuer Eintrag */}
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 6, marginBottom: 9 }}>
        <div>
          <label>Std.</label>
          <input type="number" min="0.25" step="0.25" value={hours}
            onChange={e => setHours(e.target.value)} placeholder="0.5" />
        </div>
        <div>
          <label>Beschreibung</label>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            placeholder="Was wurde gemacht?" onKeyDown={e => e.key === 'Enter' && addEntry()} />
        </div>
        <button className="abtn" onClick={addEntry}
          style={{ alignSelf: 'flex-end', padding: '7px 12px' }}>
          <IcoPlus size={11} />
        </button>
      </div>

      {/* Fortschritt */}
      {(estimated > 0 || totalLogged > 0) && (
        <div style={{ marginBottom: 9 }}>
          <ProgressBar value={pct} color={pct > 100 ? C.cr : C.ac} height={5} />
          <div style={{ fontSize: 10, color: C.mu, marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
            <span>Geloggt: <strong style={{ color: pct > 100 ? C.cr : C.ac, fontFamily: C.mono }}>{totalLogged.toFixed(1)}h</strong></span>
            {estimated > 0 && <span>{pct}% von {estimated}h</span>}
          </div>
        </div>
      )}

      {/* Log-Einträge */}
      {timeLog.length === 0
        ? <div style={{ textAlign: 'center', fontSize: 11, color: C.mu, padding: '6px 0', opacity: .6 }}>Noch keine Zeiteinträge · Trage oben Stunden ein</div>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[...timeLog].reverse().map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 6, background: C.sf2, border: `1px solid ${C.bd}` }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.ac, fontFamily: C.mono, minWidth: 38, flexShrink: 0 }}>{entry.hours}h</span>
                <span style={{ flex: 1, fontSize: 12, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description || <span style={{ color: C.mu, fontStyle: 'italic' }}>—</span>}</span>
                <span style={{ fontSize: 10, color: C.mu, fontFamily: C.mono, flexShrink: 0 }}>{fmtDate(entry.date)}</span>
                {entry.userName && <span style={{ fontSize: 10, color: C.mu, flexShrink: 0, opacity: .7 }}>{entry.userName.split(' ')[0]}</span>}
                <IconBtn Icon={IcoTrash} onClick={() => removeEntry(entry.id)} label="Eintrag löschen" danger size={11} />
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function TaskCard({ task, users, currentUser, onUpdate, onRemove, isOpen, onToggle, projectMaterials, projectLabels, selected, onToggleSelect }) {
  const assignee   = users.find(u => u.id === task.assignee);
  const st         = TASK_STATUS[task.status] || TASK_STATUS.not_started;
  const pr         = PRIORITY[task.priority]  || PRIORITY.medium;
  const over       = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date();
  const lc         = (task.links || []).length;
  const taskLabels = (projectLabels || []).filter(lb => (task.labelIds || []).includes(lb.id));

  return (
    <div style={{ marginBottom: 5, borderRadius: 8, border: `1px solid ${selected ? C.ac + '70' : isOpen ? st.color + '50' : C.bd}`, background: selected ? C.acd + '44' : C.sf2, overflow: 'hidden', transition: 'border-color .15s, background .12s', opacity: task.status === 'done' ? .6 : 1 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
        onClick={onToggle} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}>

        {/* Bulk-Checkbox */}
        {onToggleSelect && (
          <input type="checkbox" checked={!!selected} onChange={e => { e.stopPropagation(); onToggleSelect(task.id); }} onClick={e => e.stopPropagation()}
            style={{ width: 14, height: 14, flexShrink: 0, cursor: 'pointer', accentColor: C.ac }} />
        )}

        <button onClick={e => { e.stopPropagation(); onUpdate(task.id, { status: task.status === 'done' ? 'not_started' : 'done' }); }}
          style={{ width: 19, height: 19, borderRadius: 5, border: `2px solid ${st.color}`, background: task.status === 'done' ? C.gr : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .12s' }}>
          {task.status === 'done' && <IcoCheck size={10} style={{ color: '#fff' }} />}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: task.status === 'done' ? C.mu : C.br, textDecoration: task.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.text || <span style={{ color: C.mu, fontStyle: 'italic' }}>Kein Titel</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${st.color}25`, padding: '1px 6px', borderRadius: 4 }}>
              <st.Icon size={9} />{st.label}
            </span>
            <span style={{ fontSize: 9, color: pr.c, fontWeight: 700 }}>{pr.l}</span>
            {task.deadline && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontFamily: C.mono, color: over ? C.cr : C.mu, fontWeight: over ? 700 : 400 }}>
                <IcoClock size={9} />{over ? '⚠ ' : ''}{fmtDate(task.deadline)}
              </span>
            )}
            {task.note     && <IcoNote size={10} style={{ color: C.ac }} />}
            {task.doc      && <IcoDoc  size={10} style={{ color: C.gr }} />}
            {task.protocol && <IcoMic  size={10} style={{ color: C.yw }} />}
            {lc > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, color: C.ac, fontFamily: C.mono, background: C.acd, borderRadius: 4, padding: '1px 5px' }}>
                <IcoLink size={9} />{lc}
              </span>
            )}
            {(task.timeLog || []).length > 0 && (() => {
              const logged = (task.timeLog || []).reduce((s, e) => s + (Number(e.hours) || 0), 0);
              const est    = Number(task.estimatedHours) || 0;
              const over   = est > 0 && logged > est;
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, fontFamily: C.mono, color: over ? C.cr : C.mu, background: over ? C.crd : C.sf3, border: `1px solid ${over ? C.cr + '30' : C.bd}`, borderRadius: 4, padding: '1px 5px' }}>
                  <IcoClock size={9} />{logged.toFixed(1)}{est > 0 ? `/${est}h` : 'h'}
                </span>
              );
            })()}
            {taskLabels.map(lb => <LabelChip key={lb.id} label={lb} tiny />)}
          </div>
        </div>

        {assignee
          ? <div style={{ position: 'relative', flexShrink: 0 }} title={assignee.name}>
              <Avatar name={assignee.name} url={assignee.avatar_url} size={24} />
              {task.status === 'in_progress' && <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: C.gr, border: `1.5px solid ${C.sf2}` }} />}
            </div>
          : <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px dashed ${C.bd2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: C.mu }}>?</div>}

        <IcoChevronD size={11} style={{ color: C.mu, flexShrink: 0, transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        <IconBtn Icon={IcoTrash} onClick={e => { e.stopPropagation(); onRemove(task.id); }} label="Löschen" danger size={13} />
      </div>

      {isOpen && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.bd}`, background: C.sf3, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 155px 105px 145px', gap: 8 }}>
            <div><label>Aufgabe</label><input value={task.text} onChange={e => onUpdate(task.id, { text: e.target.value })} /></div>
            <div>
              <label>Status</label>
              <select value={task.status} onChange={e => onUpdate(task.id, { status: e.target.value })}>
                {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label>Priorität</label>
              <select value={task.priority} onChange={e => onUpdate(task.id, { priority: e.target.value })}>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
            </div>
            <div><label>Deadline</label><input type="date" value={task.deadline || ''} onChange={e => onUpdate(task.id, { deadline: e.target.value })} /></div>
          </div>

          <div>
            <label>Zuweisen</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
              <button onClick={() => onUpdate(task.id, { assignee: null })}
                style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, background: !task.assignee ? C.acd : C.sf2, border: `1px solid ${!task.assignee ? C.ac : C.bd2}`, color: !task.assignee ? C.ac : C.mu, cursor: 'pointer' }}>
                Niemand
              </button>
              {users.map(u => (
                <button key={u.id} onClick={() => onUpdate(task.id, { assignee: u.id })} aria-pressed={task.assignee === u.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 9px', borderRadius: 6, background: task.assignee === u.id ? C.acd : C.sf2, border: `1px solid ${task.assignee === u.id ? C.ac : C.bd2}`, cursor: 'pointer', transition: 'all .12s' }}>
                  <Avatar name={u.name} size={16} />
                  <span style={{ color: task.assignee === u.id ? C.ac : C.tx }}>{u.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {(projectLabels || []).length > 0 && (
            <div>
              <label>Labels</label>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                {(projectLabels || []).map(lb => {
                  const active = (task.labelIds || []).includes(lb.id);
                  return (
                    <button key={lb.id} onClick={() => {
                      const ids = task.labelIds || [];
                      onUpdate(task.id, { labelIds: active ? ids.filter(x => x !== lb.id) : [...ids, lb.id] });
                    }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, border: `2px solid ${active ? lb.color : C.bd2}`, background: active ? lb.color + '22' : C.sf2, color: active ? lb.color : C.mu, cursor: 'pointer', transition: 'all .12s' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: lb.color, display: 'inline-block', flexShrink: 0 }} />
                      {lb.name}
                      {active && <IcoCheck size={10} style={{ color: lb.color }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <ContentTabs task={task} onUpdate={onUpdate} projectMaterials={projectMaterials || []} currentUser={currentUser} />
        </div>
      )}
    </div>
  );
}

function ContentTabs({ task, onUpdate, projectMaterials = [], currentUser }) {
  const [active, setActive] = useState('note');
  const lc         = (task.links || []).length;
  const zeitLogged = (task.timeLog || []).reduce((s, e) => s + (Number(e.hours) || 0), 0);

  const TABS = [
    { k: 'note',     l: 'Notiz',     Icon: IcoNote, val: task.note,     ph: 'Kurze Notiz, Hinweis für andere…' },
    { k: 'doc',      l: 'Doku',      Icon: IcoDoc,  val: task.doc,      ph: 'Was wurde gemacht? Warum? Wie?' },
    { k: 'protocol', l: 'Protokoll', Icon: IcoMic,  val: task.protocol, ph: 'Datum, Teilnehmer, Entscheidungen…' },
  ];
  const cur = TABS.find(t => t.k === active);

  const tabBtn = (key, icon, label, accentColor = C.ac, accentBg = C.acd) => {
    const isActive = active === key;
    return (
      <button onClick={() => setActive(key)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 700, border: 'none', borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent', background: isActive ? accentBg : 'transparent', color: isActive ? accentColor : C.mu, transition: 'all .12s' }}>
        {icon}{label}
      </button>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 0, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setActive(t.k)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 700, border: 'none', borderBottom: active === t.k ? `2px solid ${C.ac}` : '2px solid transparent', background: active === t.k ? C.acd : 'transparent', color: active === t.k ? C.ac : C.mu, transition: 'all .12s' }}>
            <t.Icon size={10} />{t.l}{t.val ? ' •' : ''}
          </button>
        ))}
        <button onClick={() => setActive('links')}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 700, border: 'none', borderBottom: active === 'links' ? `2px solid ${C.ac}` : '2px solid transparent', background: active === 'links' ? C.acd : 'transparent', color: active === 'links' ? C.ac : C.mu, transition: 'all .12s' }}>
          <IcoLink size={10} />Links{lc > 0 ? ` (${lc})` : ''}
        </button>
        {tabBtn('zeit',
          <IcoClock size={10} />,
          <>Zeit{zeitLogged > 0 ? <span style={{ fontFamily: C.mono, fontSize: 9, marginLeft: 3, opacity: .8 }}>{zeitLogged.toFixed(1)}h</span> : ''}</>,
          C.gr, 'var(--st-green-bg)'
        )}
        {projectMaterials.length > 0 && (
          <button onClick={() => setActive('materials')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: '6px 6px 0 0', fontSize: 11, fontWeight: 700, border: 'none', borderBottom: active === 'materials' ? `2px solid ${C.yw}` : '2px solid transparent', background: active === 'materials' ? C.ywd : 'transparent', color: active === 'materials' ? C.yw : C.mu, transition: 'all .12s' }}>
            <IcoMaterial size={10} />Material
          </button>
        )}
      </div>
      <div style={{ background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: '0 6px 6px 6px', padding: 10 }}>
        {active === 'links' ? (
          <LinksManager links={task.links || []} onUpdate={links => onUpdate(task.id, { links })} compact />
        ) : active === 'materials' ? (
          <MaterialRef materials={projectMaterials} taskRef={task.materialRef || []}
            onUpdate={refs => onUpdate(task.id, { materialRef: refs })} />
        ) : active === 'zeit' ? (
          <ZeitTab task={task} onUpdate={onUpdate} currentUser={currentUser} />
        ) : (
          <textarea value={cur?.val || ''} onChange={e => onUpdate(task.id, { [active]: e.target.value })} placeholder={cur?.ph}
            style={{ minHeight: 68, fontSize: 12, background: 'transparent', border: 'none', padding: 0, resize: 'vertical', width: '100%' }} />
        )}
      </div>
    </div>
  );
}

function MaterialRef({ materials, taskRef, onUpdate }) {
  const toggleRef = (id) => {
    const updated = taskRef.includes(id) ? taskRef.filter(r => r !== id) : [...taskRef, id];
    onUpdate(updated);
  };
  return (
    <div>
      <div style={{ fontSize: 10, color: C.mu, marginBottom: 7 }}>Materialien die für diese Aufgabe benötigt werden:</div>
      {materials.map(m => {
        const sel = taskRef.includes(m.id);
        return (
          <div key={m.id} onClick={() => toggleRef(m.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6, marginBottom: 3, cursor: 'pointer', background: sel ? C.ywd : 'transparent', border: `1px solid ${sel ? C.yw + '40' : 'transparent'}`, transition: 'all .12s' }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${sel ? C.yw : C.bd2}`, background: sel ? C.yw : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .12s' }}>
              {sel && <IcoCheck size={8} style={{ color: '#fff' }} />}
            </div>
            <span style={{ fontSize: 12, color: sel ? C.br : C.tx, flex: 1 }}>{m.name}</span>
            <span style={{ fontSize: 10, fontFamily: C.mono, color: C.mu }}>{m.qty}× · {(m.cost * m.qty).toFixed(0)} €</span>
          </div>
        );
      })}
    </div>
  );
}

function TaskGroup({ status, tasks, users, currentUser, openTask, onToggleTask, onUpdate, onRemove, defaultCollapsed, projectMaterials, projectLabels, selection, onToggleSelect }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);
  const st = TASK_STATUS[status];
  if (!tasks.length) return null;

  return (
    <section style={{ marginBottom: 8 }}>
      <button onClick={() => setCollapsed(c => !c)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '6px 10px', background: st.bg, border: `1px solid ${st.color}25`, borderRadius: collapsed ? 7 : '7px 7px 0 0', cursor: 'pointer', transition: 'border-radius .12s' }}>
        <st.Icon size={12} style={{ color: st.color }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: st.color, flex: 1, textAlign: 'left' }}>{st.label}</span>
        <span style={{ fontSize: 10, color: st.color, fontFamily: C.mono, background: `${st.color}18`, padding: '1px 7px', borderRadius: 9 }}>{tasks.length}</span>
        <IcoChevronD size={11} style={{ color: st.color, transition: 'transform .15s', transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
      </button>
      {!collapsed && (
        <div style={{ background: C.sf3, border: `1px solid ${st.color}18`, borderTop: 'none', borderRadius: '0 0 7px 7px', padding: '5px 5px 3px' }}>
          {[...tasks].sort((a, b) => {
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline) - new Date(b.deadline);
          }).map(t => (
            <TaskCard key={t.id} task={t} users={users} currentUser={currentUser}
              isOpen={openTask === t.id} onToggle={() => onToggleTask(t.id)}
              onUpdate={onUpdate} onRemove={onRemove}
              projectMaterials={projectMaterials} projectLabels={projectLabels}
              selected={selection?.has(t.id)} onToggleSelect={onToggleSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Kanban Card ───────────────────────────────────────────────
function KanbanCard({ task, users, statusIdx, totalCols, onUpdate, onRemove }) {
  const assignee = users.find(u => u.id === task.assignee);
  const pr  = PRIORITY[task.priority] || PRIORITY.medium;
  const st  = TASK_STATUS[task.status] || TASK_STATUS.not_started;
  const over = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date();

  return (
    <div style={{ background: C.sf2, border: `1px solid ${C.bd}`, borderRadius: 8, padding: '9px 10px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: C.br, lineHeight: 1.45, wordBreak: 'break-word' }}>
        {task.text || <span style={{ color: C.mu, fontStyle: 'italic' }}>Kein Titel</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: pr.c }}>{pr.l}</span>
        {task.deadline && (
          <span style={{ fontSize: 9, fontFamily: C.mono, color: over ? C.cr : C.mu, fontWeight: over ? 700 : 400 }}>
            {over ? '⚠ ' : ''}{fmtDate(task.deadline)}
          </span>
        )}
        {assignee && <Avatar name={assignee.name} url={assignee.avatar_url} size={16} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {statusIdx > 0 && (
            <button onClick={() => onUpdate(task.id, { status: STATUS_ORDER[statusIdx - 1] })}
              title={`← ${TASK_STATUS[STATUS_ORDER[statusIdx - 1]]?.label}`}
              style={{ padding: '2px 7px', fontSize: 10, borderRadius: 4, border: `1px solid ${C.bd2}`, background: 'transparent', color: C.mu, cursor: 'pointer' }}>←</button>
          )}
          {statusIdx < totalCols - 1 && (
            <button onClick={() => onUpdate(task.id, { status: STATUS_ORDER[statusIdx + 1] })}
              title={`→ ${TASK_STATUS[STATUS_ORDER[statusIdx + 1]]?.label}`}
              style={{ padding: '2px 7px', fontSize: 10, borderRadius: 4, border: `1px solid ${st.color}50`, background: st.bg, color: st.color, cursor: 'pointer', fontWeight: 700 }}>→</button>
          )}
        </div>
        <button onClick={() => onRemove(task.id)}
          style={{ padding: '2px 7px', fontSize: 10, borderRadius: 4, border: `1px solid ${C.cr}30`, background: 'transparent', color: C.cr, cursor: 'pointer', fontWeight: 700 }}>×</button>
      </div>
    </div>
  );
}

// ── Kanban DnD ────────────────────────────────────────────────
function DraggableCard({ task, users, statusIdx, totalCols, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
      style={{ opacity: isDragging ? 0.3 : 1, cursor: 'grab', touchAction: 'none' }}>
      <KanbanCard task={task} users={users} statusIdx={statusIdx} totalCols={totalCols} onUpdate={onUpdate} onRemove={onRemove} />
    </div>
  );
}

function DroppableColumn({ status, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const st = TASK_STATUS[status];
  return (
    <div ref={setNodeRef}
      style={{ background: isOver ? `${st.color}12` : C.sf3, border: `1px solid ${isOver ? st.color + '55' : st.color + '18'}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 6, display: 'flex', flexDirection: 'column', gap: 5, minHeight: 160, transition: 'background .12s, border-color .12s' }}>
      {children}
    </div>
  );
}

// ── Kanban Board ──────────────────────────────────────────────
function KanbanBoard({ tasks, users, onUpdate, onRemove }) {
  const [activeId, setActiveId] = useState(null);
  // PointerSensor: Maus/Stift (8 px Toleranz für Klick-vs-Drag).
  // TouchSensor: 200 ms Press + 5 px Toleranz für mobile Geräte (verhindert Scroll-Konflikt).
  // KeyboardSensor: Tab + Space + Pfeiltasten für a11y.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;
  const activeIdx  = activeTask ? STATUS_ORDER.indexOf(activeTask.status || 'not_started') : 0;

  const handleDragEnd = ({ active, over }) => {
    if (!over) { setActiveId(null); return; }
    const fromStatus = tasks.find(t => t.id === active.id)?.status || 'not_started';
    if (over.id !== fromStatus) {
      onUpdate(active.id, { status: over.id });
    }
    setActiveId(null);
  };

  return (
    <DndContext sensors={sensors}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
        {STATUS_ORDER.map((status, idx) => {
          const st   = TASK_STATUS[status];
          const cols = tasks.filter(t => (t.status || 'not_started') === status);
          return (
            <div key={status} style={{ minWidth: 200, flex: '0 0 200px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: st.bg, border: `1px solid ${st.color}28`, borderRadius: '8px 8px 0 0' }}>
                <st.Icon size={11} style={{ color: st.color }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: st.color, flex: 1 }}>{st.label}</span>
                <span style={{ fontSize: 10, color: st.color, fontFamily: C.mono, background: `${st.color}18`, padding: '1px 6px', borderRadius: 9 }}>{cols.length}</span>
              </div>
              <DroppableColumn status={status}>
                {cols.map(task => (
                  <DraggableCard key={task.id} task={task} users={users} statusIdx={idx} totalCols={STATUS_ORDER.length} onUpdate={onUpdate} onRemove={onRemove} />
                ))}
                {cols.length === 0 && !activeId && (
                  <div style={{ textAlign: 'center', fontSize: 10, color: C.mu, padding: '20px 0', opacity: .5 }}>Leer</div>
                )}
              </DroppableColumn>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask && (
          <div style={{ cursor: 'grabbing', opacity: .95, boxShadow: '0 8px 24px rgba(0,0,0,.4)', borderRadius: 8 }}>
            <KanbanCard task={activeTask} users={users} statusIdx={activeIdx} totalCols={STATUS_ORDER.length} onUpdate={() => {}} onRemove={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export function TasksTab({ project, users, currentUser, onUpdate, onActivity }) {
  const [openTask,     setOpenTask]     = useState(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [newTask,      setNewTask]      = useState(mkTask({ assignee: currentUser.id }));
  const [viewMode,     setViewMode]     = useState('list');
  const [filterLabel,  setFilterLabel]  = useState(null);
  const [selection,    setSelection]    = useState(new Set());

  const toggleSelect   = (id) => setSelection(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const clearSelection = () => setSelection(new Set());
  const selectAll      = () => setSelection(new Set(visibleTasks.map(t => t.id)));

  const bulkSetStatus = (status) => {
    onUpdate(project.id, { tasks: (project.tasks||[]).map(t => selection.has(t.id) ? { ...t, status } : t) });
    clearSelection();
  };
  const bulkDelete = () => {
    onUpdate(project.id, { tasks: (project.tasks||[]).filter(t => !selection.has(t.id)) });
    clearSelection();
  };

  const projectLabels = project.labels || [];
  const assignable = users.filter(u => (project.assignees||[])?.includes(u.id) || u.id === currentUser.id);

  const updateTask = (taskId, patch) => {
    if (patch.status === 'done') {
      const task = (project.tasks||[]).find(t => t.id === taskId);
      if (task && task.status !== 'done') {
        onActivity?.({
          type: 'task_done',
          userId: currentUser.id,
          userName: currentUser.name,
          entityTitle: task.text,
          projectId: project.id,
          projectTitle: project.title,
          action: `${currentUser.name} hat Aufgabe "${task.text}" abgeschlossen`,
        });
      }
    }
    onUpdate(project.id, { tasks: (project.tasks||[]).map(t => t.id === taskId ? { ...t, ...patch } : t) });
  };
  const removeTask = (taskId) => {
    onUpdate(project.id, { tasks: (project.tasks||[]).filter(t => t.id !== taskId) });
    if (openTask === taskId) setOpenTask(null);
  };
  const addTask = () => {
    if (!newTask.text.trim()) return;
    onUpdate(project.id, { tasks: [...(project.tasks||[]), { ...newTask, links: newTask.links || [], labelIds: newTask.labelIds || [] }] });
    onActivity?.({
      type: 'task_created',
      userId: currentUser.id,
      userName: currentUser.name,
      entityTitle: newTask.text,
      projectId: project.id,
      projectTitle: project.title,
      action: `${currentUser.name} hat Aufgabe "${newTask.text}" hinzugefügt`,
    });
    setNewTask(mkTask({ assignee: currentUser.id }));
    setShowAdd(false);
  };

  const allTasks  = project.tasks || [];
  const visibleTasks = filterLabel
    ? allTasks.filter(t => (t.labelIds || []).includes(filterLabel))
    : allTasks;

  const total = allTasks.length;
  const done  = allTasks.filter(t => t.status === 'done' || t.done).length;
  const pct   = total > 0 ? Math.round(done / total * 100) : 0;

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = visibleTasks.filter(t => (t.status || 'not_started') === s);
    return acc;
  }, {});

  const activeWorkers = (project.tasks||[])
    .filter(t => t.status === 'in_progress' && t.assignee)
    .map(t => ({ task: t, user: users.find(u => u.id === t.assignee) }))
    .filter(x => x.user);

  return (
    <div className="anim">
      {activeWorkers.length > 0 && (
        <div style={{ background: C.acd, border: `1px solid ${C.ac}28`, borderRadius: 8, padding: '7px 12px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.ac, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><IcoPlay size={11} /> Aktiv:</span>
          {activeWorkers.map(({ task, user }) => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.sf2, borderRadius: 6, padding: '3px 8px', border: `1px solid ${C.ac}20` }}>
              <div style={{ position: 'relative' }}><Avatar name={user.name} size={18} />
                <div style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: '50%', background: C.gr, border: `1px solid ${C.sf2}` }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: C.br }}>{user.name.split(' ')[0]}</span>
              <span style={{ fontSize: 10, color: C.mu, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>· {task.text}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: total > 0 ? 7 : 0, gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8 }}>Arbeitspakete <span style={{ color: C.mu, fontWeight: 400 }}>({total})</span></span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: C.sf3, borderRadius: 6, padding: 2, border: `1px solid ${C.bd}`, gap: 2 }}>
              {[['list','☰ Liste'],['kanban','⊞ Kanban']].map(([m, l]) => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ padding: '3px 9px', borderRadius: 4, border: 'none', background: viewMode === m ? C.ac : 'transparent', color: viewMode === m ? '#fff' : C.mu, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all .12s' }}>
                  {l}
                </button>
              ))}
            </div>
            <button className="abtn" onClick={() => setShowAdd(s => !s)} style={{ fontSize: 11, padding: '4px 10px' }}>
              <IcoPlus size={12} />{showAdd ? 'Abbrechen' : 'Neu'}
            </button>
          </div>
        </div>
        {total > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.mu, marginBottom: 3 }}>
              <span>Gesamt</span>
              <span style={{ fontFamily: C.mono, color: pct === 100 ? C.gr : C.ac, fontWeight: 700 }}>{done}/{total} ({pct}%)</span>
            </div>
            <ProgressBar value={pct} color={pct === 100 ? C.gr : C.ac} height={5} />
          </div>
        )}
        {showAdd && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.bd}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 145px 105px', gap: 8, marginBottom: 7 }}>
              <div><label>Aufgabe</label><input autoFocus value={newTask.text} onChange={e => setNewTask(t => ({ ...t, text: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Aufgabenbeschreibung…" /></div>
              <div><label>Status</label>
                <select value={newTask.status} onChange={e => setNewTask(t => ({ ...t, status: e.target.value }))}>
                  {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label>Deadline</label><input type="date" value={newTask.deadline} onChange={e => setNewTask(t => ({ ...t, deadline: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 7, flexWrap: 'wrap' }}>
              {assignable.map(u => (
                <button key={u.id} onClick={() => setNewTask(t => ({ ...t, assignee: t.assignee === u.id ? null : u.id }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '3px 8px', borderRadius: 6, background: newTask.assignee === u.id ? C.acd : C.sf2, border: `1px solid ${newTask.assignee === u.id ? C.ac : C.bd2}`, cursor: 'pointer' }}>
                  <Avatar name={u.name} size={15} />
                  <span style={{ color: newTask.assignee === u.id ? C.ac : C.tx }}>{u.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            <button className="abtn" onClick={addTask} style={{ width: '100%', justifyContent: 'center' }}>
              <IcoPlus size={12} /> Arbeitspaket hinzufügen
            </button>
          </div>
        )}
      </div>

      {projectLabels.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .7, marginRight: 2 }}>Filter:</span>
          <button onClick={() => setFilterLabel(null)}
            style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, border: `1px solid ${!filterLabel ? C.ac : C.bd2}`, background: !filterLabel ? C.acd : C.sf2, color: !filterLabel ? C.ac : C.mu, cursor: 'pointer', transition: 'all .12s' }}>
            Alle
          </button>
          {projectLabels.map(lb => (
            <button key={lb.id} onClick={() => setFilterLabel(filterLabel === lb.id ? null : lb.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 5, border: `2px solid ${filterLabel === lb.id ? lb.color : lb.color + '50'}`, background: filterLabel === lb.id ? lb.color + '22' : C.sf2, color: filterLabel === lb.id ? lb.color : C.mu, cursor: 'pointer', transition: 'all .12s' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: lb.color, display: 'inline-block', flexShrink: 0 }} />
              {lb.name}
            </button>
          ))}
        </div>
      )}

      {total === 0
        ? <EmptyState Icon={IcoCheck} title="Noch keine Arbeitspakete" subtitle="Klicke auf '+ Neu' um zu starten" />
        : viewMode === 'kanban'
          ? <KanbanBoard tasks={visibleTasks} users={assignable} onUpdate={updateTask} onRemove={removeTask} />
          : <>
              {selection.size > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', marginBottom: 8, background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.ac, marginRight: 4 }}>{selection.size} ausgewählt</span>
                  {STATUS_ORDER.map(s => {
                    const st = TASK_STATUS[s];
                    return (
                      <button key={s} onClick={() => bulkSetStatus(s)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: `1px solid ${st.color}50`, background: st.bg, color: st.color, cursor: 'pointer' }}>
                        <st.Icon size={10} /> → {st.label}
                      </button>
                    );
                  })}
                  <div style={{ flex: 1 }} />
                  <button onClick={selectAll}
                    style={{ padding: '3px 9px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.mu, cursor: 'pointer' }}>
                    Alle wählen
                  </button>
                  <button onClick={bulkDelete}
                    style={{ padding: '3px 9px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: `1px solid ${C.cr}40`, background: `${C.cr}12`, color: C.cr, cursor: 'pointer' }}>
                    🗑 Löschen
                  </button>
                  <button onClick={clearSelection}
                    style={{ padding: '3px 9px', fontSize: 10, fontWeight: 700, borderRadius: 5, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.mu, cursor: 'pointer' }}>
                    ✕ Auswahl
                  </button>
                </div>
              )}
              {STATUS_ORDER.filter(s => s !== 'done').map(s => (
                <TaskGroup key={s} status={s} tasks={grouped[s]} users={assignable} currentUser={currentUser}
                  openTask={openTask} onToggleTask={id => setOpenTask(openTask === id ? null : id)}
                  onUpdate={updateTask} onRemove={removeTask} defaultCollapsed={false}
                  projectMaterials={project.materials || []} projectLabels={projectLabels}
                  selection={selection} onToggleSelect={toggleSelect} />
              ))}
              <TaskGroup status="done" tasks={grouped.done} users={assignable} currentUser={currentUser}
                openTask={openTask} onToggleTask={id => setOpenTask(openTask === id ? null : id)}
                onUpdate={updateTask} onRemove={removeTask} defaultCollapsed={true}
                projectMaterials={project.materials || []} projectLabels={projectLabels}
                selection={selection} onToggleSelect={toggleSelect} />
            </>}
    </div>
  );
}

export function MaterialsTab({ project, onUpdate }) {
  const tasks   = project.tasks || [];
  const [form, setForm] = useState({ name: '', qty: 1, cost: 0, taskId: '' });

  const add = () => {
    if (!form.name.trim()) return;
    onUpdate(project.id, {
      materials: [...(project.materials||[]), {
        id: uid(),
        name: form.name.trim(),
        qty: Number(form.qty)||1,
        cost: Number(form.cost)||0,
        taskId: form.taskId || null,
      }],
    });
    setForm({ name: '', qty: 1, cost: 0, taskId: '' });
  };

  const remove = id => onUpdate(project.id, { materials: (project.materials||[]).filter(m => m.id !== id) });
  const total  = (project.materials||[]).reduce((s,m) => s + (m.cost||0)*(m.qty||1), 0);

  // Sortierung: zuerst nach Aufgabe (alphabetisch nach Aufgaben-Text), dann ohne Aufgabe
  const taskOrder = tasks.reduce((acc, t, i) => { acc[t.id] = i; return acc; }, {});
  const sorted = [...(project.materials||[])].sort((a, b) => {
    const ia = a.taskId != null ? (taskOrder[a.taskId] ?? 9999) : 9999;
    const ib = b.taskId != null ? (taskOrder[b.taskId] ?? 9999) : 9999;
    return ia - ib;
  });

  const taskName = id => tasks.find(t => t.id === id)?.text || '—';

  const COLS = '2fr 1fr 70px 90px 90px 36px';

  return (
    <div className="anim">
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 8 }}>
          <div><label>Bezeichnung</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="z.B. HDMI-Kabel" /></div>
          <div>
            <label>Aufgabe</label>
            <select value={form.taskId} onChange={e => setForm(f=>({...f,taskId:e.target.value}))} style={{ appearance:'auto' }}>
              <option value="">— keine Aufgabe —</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.text || 'Unbenannte Aufgabe'}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '70px 90px auto', gap: 8, alignItems: 'flex-end' }}>
          <div><label>Menge</label><input type="number" min="1" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} /></div>
          <div><label>Kosten €</label><input type="number" min="0" step="0.01" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} /></div>
          <button className="abtn" onClick={add} style={{ alignSelf:'flex-end',padding:'7px 12px' }}>+ Hinzufügen</button>
        </div>
      </div>
      <div style={{ background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:9, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:COLS, padding:'7px 14px', borderBottom:`1px solid ${C.bd}`, fontSize:10, color:C.mu, textTransform:'uppercase', letterSpacing:.8, fontWeight:700 }}>
          <div>Bezeichnung</div><div>Aufgabe</div><div>Menge</div><div>Einzelpreis</div><div>Gesamt</div><div />
        </div>
        {sorted.length === 0
          ? <div style={{padding:'20px',textAlign:'center',color:C.mu,fontSize:12}}>Noch kein Material</div>
          : sorted.map(m => (
            <div key={m.id} style={{ display:'grid', gridTemplateColumns:COLS, padding:'9px 14px', borderBottom:`1px solid ${C.bd}22`, alignItems:'center' }}>
              <div style={{fontSize:13,color:C.br,fontWeight:600}}>{m.name}</div>
              <div style={{fontSize:11,color:m.taskId?C.ac:C.mu,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={m.taskId?taskName(m.taskId):''}>
                {m.taskId ? taskName(m.taskId) : <span style={{color:C.bd2}}>—</span>}
              </div>
              <div style={{fontSize:12,fontFamily:C.mono}}>{m.qty}×</div>
              <div style={{fontSize:12,fontFamily:C.mono}}>{Number(m.cost).toFixed(2)} €</div>
              <div style={{fontSize:12,fontFamily:C.mono,color:C.ac,fontWeight:700}}>{(m.qty*m.cost).toFixed(2)} €</div>
              <IconBtn Icon={IcoTrash} onClick={()=>remove(m.id)} label={`${m.name} löschen`} danger size={12} />
            </div>
          ))
        }
        {sorted.length > 0 && (
          <div style={{padding:'8px 14px',borderTop:`1px solid ${C.bd}`,display:'flex',justifyContent:'flex-end',gap:8,alignItems:'center'}}>
            <span style={{fontSize:12,color:C.mu}}>Gesamt:</span>
            <span style={{fontSize:16,fontWeight:800,color:C.ac,fontFamily:C.mono}}>{total.toFixed(2)} €</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function RequirementsTab({ project, onUpdate }) {
  const [text,setText]=useState('');
  const add    = () => { if(!text.trim())return; onUpdate(project.id,{requirements:[...(project.requirements||[]),{id:uid(),text:text.trim(),done:false}]}); setText(''); };
  const toggle = id => onUpdate(project.id,{requirements:(project.requirements||[]).map(r=>r.id===id?{...r,done:!r.done}:r)});
  const remove = id => onUpdate(project.id,{requirements:(project.requirements||[]).filter(r=>r.id!==id)});
  const done   = (project.requirements||[]).filter(r=>r.done).length;
  const pct    = (project.requirements||[]).length ? Math.round(done/(project.requirements||[]).length*100) : 0;

  return (
    <div className="anim">
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'flex',gap:8}}>
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="Neue Anforderung…" style={{flex:1}} />
          <button className="abtn" onClick={add}>+ Hinzufügen</button>
        </div>
      </div>
      {(project.requirements||[]).length > 0 && (
        <div style={{marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
          <div style={{flex:1,height:4,background:C.bd2,borderRadius:2,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${pct}%`,background:C.gr,borderRadius:2,transition:'width .3s'}} />
          </div>
          <span style={{fontSize:10,color:C.gr,fontFamily:C.mono,fontWeight:700}}>{pct}%</span>
        </div>
      )}
      {(project.requirements||[]).map(r => (
        <div key={r.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 11px',background:C.sf2,border:`1px solid ${r.done?C.gr+'28':C.bd}`,borderRadius:7,marginBottom:4,transition:'border-color .15s'}}>
          <button onClick={()=>toggle(r.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${r.done?C.gr:C.bd2}`,background:r.done?C.gr:'transparent',cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'all .12s'}}>
            {r.done && <IcoCheck size={10} style={{color:'#fff'}} />}
          </button>
          <div style={{flex:1,fontSize:13,color:r.done?C.mu:C.br,textDecoration:r.done?'line-through':'none'}}>{r.text}</div>
          <IconBtn Icon={IcoTrash} onClick={()=>remove(r.id)} label="Löschen" danger size={12} />
        </div>
      ))}
      {(project.requirements||[]).length===0 && <EmptyState Icon={IcoCheck} title="Noch keine Anforderungen" />}
      {(project.requirements||[]).length > 0 && <div style={{marginTop:8,fontSize:11,color:C.mu,textAlign:'right'}}>{done} von {(project.requirements||[]).length} erfüllt</div>}
    </div>
  );
}

export function StepsTab({ project, onUpdate }) {
  const [form, setForm] = useState({ title: '', date: today(), note: '' });
  const [open, setOpen] = useState(null);
  const add    = () => { if(!form.title.trim())return; onUpdate(project.id,{steps:[...(project.steps||[]),{id:uid(),...form}]}); setForm({title:'',date:today(),note:''}); };
  const remove = id => onUpdate(project.id,{steps:(project.steps||[]).filter(s=>s.id!==id)});
  const sorted = [...(project.steps||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));

  return (
    <div className="anim">
      <div className="card" style={{marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 145px',gap:8,marginBottom:8}}>
          <div><label>Titel</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Was wurde getan?" /></div>
          <div><label>Datum</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></div>
        </div>
        <label>Notiz / Erkenntnisse</label>
        <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Begründungen, Methoden, Erkenntnisse…" />
        <button className="abtn" onClick={add} style={{marginTop:8}}><IcoPlus size={12}/>Schritt dokumentieren</button>
      </div>
      <div style={{position:'relative',paddingLeft:16}}>
        <div style={{position:'absolute',left:5,top:0,bottom:0,width:2,background:`linear-gradient(to bottom,${C.ac},${C.bd})`}} />
        {sorted.map(s => (
          <div key={s.id} style={{marginBottom:9,position:'relative'}}>
            <div style={{position:'absolute',left:-14,top:12,width:8,height:8,borderRadius:'50%',background:C.ac,border:`2px solid ${C.sf}`}} />
            <div style={{background:C.sf2,border:`1px solid ${C.bd}`,borderRadius:8,overflow:'hidden'}}>
              <div style={{padding:'8px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>setOpen(open===s.id?null:s.id)}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:C.br}}>{s.title}</div>
                  <div style={{fontSize:10,color:C.mu,marginTop:1,fontFamily:C.mono}}>{fmtDate(s.date)}</div>
                </div>
                <div style={{display:'flex',gap:5,alignItems:'center'}}>
                  {s.note && <IcoDoc size={11} style={{color:C.ac}} />}
                  <IcoChevronD size={11} style={{color:C.mu,transition:'transform .15s',transform:open===s.id?'rotate(180deg)':'none'}} />
                  <IconBtn Icon={IcoTrash} onClick={e=>{e.stopPropagation();remove(s.id);}} label="Löschen" danger size={12} />
                </div>
              </div>
              {open===s.id && s.note && <div style={{padding:'9px 12px',borderTop:`1px solid ${C.bd}`,background:C.sf3,fontSize:12,color:C.tx,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{s.note}</div>}
            </div>
          </div>
        ))}
        {(project.steps||[]).length===0 && <EmptyState Icon={IcoDoc} title="Noch keine Schritte" subtitle="Dokumentiere den Fortschritt" />}
      </div>
    </div>
  );
}
