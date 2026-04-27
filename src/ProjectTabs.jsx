import { useState } from "react";
import { C, uid, today, fmtDate } from './utils.js';
import { Avatar, ProgressBar, EmptyState, IconBtn } from './Components.jsx';
import { LinksManager } from './LinksManager.jsx';
import {
  IcoCheck, IcoAlert, IcoPlay, IcoPause, IcoBlock,
  IcoNote, IcoDoc, IcoMic, IcoLink, IcoTrash, IcoPlus,
  IcoClock, IcoChevronD, IcoMaterial
} from './Icons.jsx';

// ── Konstanten ────────────────────────────────────────────────
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
  return { id: uid(), text: '', status: 'not_started', priority: 'medium', assignee: null, deadline: '', note: '', doc: '', protocol: '', links: [], created: today(), ...overrides };
}

// ── Task-Karte ────────────────────────────────────────────────
function TaskCard({ task, users, onUpdate, onRemove, isOpen, onToggle, projectMaterials }) {
  const assignee = users.find(u => u.id === task.assignee);
  const st   = TASK_STATUS[task.status] || TASK_STATUS.not_started;
  const pr   = PRIORITY[task.priority]  || PRIORITY.medium;
  const over = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date();
  const lc   = (task.links || []).length;

  return (
    <div style={{ marginBottom: 5, borderRadius: 8, border: `1px solid ${isOpen ? st.color + '50' : C.bd}`, background: C.sf2, overflow: 'hidden', transition: 'border-color .15s', opacity: task.status === 'done' ? .6 : 1 }}>

      {/* Kopfzeile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
        onClick={onToggle} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}>

        {/* Checkbox */}
        <button onClick={e => { e.stopPropagation(); onUpdate(task.id, { status: task.status === 'done' ? 'not_started' : 'done' }); }}
          style={{ width: 19, height: 19, borderRadius: 5, border: `2px solid ${st.color}`, background: task.status === 'done' ? C.gr : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all .12s' }}>
          {task.status === 'done' && <IcoCheck size={10} style={{ color: '#fff' }} />}
        </button>

        {/* Titel + Badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: task.status === 'done' ? C.mu : C.br, textDecoration: task.status === 'done' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.text || <span style={{ color: C.mu, fontStyle: 'italic' }}>Kein Titel</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Status-Badge mit Icon */}
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
          </div>
        </div>

        {/* Avatar */}
        {assignee
          ? <div style={{ position: 'relative', flexShrink: 0 }} title={assignee.name}>
              <Avatar name={assignee.name} size={24} />
              {task.status === 'in_progress' && <div style={{ position: 'absolute', bottom: -1, right: -1, width: 8, height: 8, borderRadius: '50%', background: C.gr, border: `1.5px solid ${C.sf2}` }} />}
            </div>
          : <div style={{ width: 24, height: 24, borderRadius: '50%', border: `2px dashed ${C.bd2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 10, color: C.mu }}>?</div>}

        <IcoChevronD size={11} style={{ color: C.mu, flexShrink: 0, transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
        <IconBtn Icon={IcoTrash} onClick={e => { e.stopPropagation(); onRemove(task.id); }} label="Löschen" danger size={13} />
      </div>

      {/* Expand */}
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

          {/* Zuweisung */}
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

          {/* Tabs: Notiz | Doku | Protokoll | Links */}
          <ContentTabs task={task} onUpdate={onUpdate} projectMaterials={projectMaterials || []} />
        </div>
      )}
    </div>
  );
}

// ── Content-Tabs ──────────────────────────────────────────────
function ContentTabs({ task, onUpdate, projectMaterials = [] }) {
  const [active, setActive] = useState('note');
  const lc = (task.links || []).length;

  const TABS = [
    { k: 'note',     l: 'Notiz',              Icon: IcoNote, val: task.note,     ph: 'Kurze Notiz, Hinweis für andere…' },
    { k: 'doc',      l: 'Doku',               Icon: IcoDoc,  val: task.doc,      ph: 'Was wurde gemacht? Warum? Wie?' },
    { k: 'protocol', l: 'Protokoll',          Icon: IcoMic,  val: task.protocol, ph: 'Datum, Teilnehmer, Entscheidungen…' },
  ];
  const cur = TABS.find(t => t.k === active);

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
        ) : (
          <textarea value={cur?.val || ''} onChange={e => onUpdate(task.id, { [active]: e.target.value })} placeholder={cur?.ph}
            style={{ minHeight: 68, fontSize: 12, background: 'transparent', border: 'none', padding: 0, resize: 'vertical', width: '100%' }} />
        )}
      </div>
    </div>
  );
}

// ── Material-Referenz innerhalb einer Aufgabe ─────────────────
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

// ── Status-Gruppe (einklappbar) ───────────────────────────────
function TaskGroup({ status, tasks, users, openTask, onToggleTask, onUpdate, onRemove, defaultCollapsed, projectMaterials }) {
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
            <TaskCard key={t.id} task={t} users={users}
              isOpen={openTask === t.id} onToggle={() => onToggleTask(t.id)}
              onUpdate={onUpdate} onRemove={onRemove}
              projectMaterials={projectMaterials} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────
export function TasksTab({ project, users, currentUser, onUpdate }) {
  const [openTask, setOpenTask] = useState(null);
  const [showAdd,  setShowAdd]  = useState(false);
  const [newTask,  setNewTask]  = useState(mkTask({ assignee: currentUser.id }));

  const assignable = users.filter(u => (project.assignees||[])?.includes(u.id) || u.id === currentUser.id);

  const updateTask = (taskId, patch) =>
    onUpdate(project.id, { tasks: (project.tasks||[]).map(t => t.id === taskId ? { ...t, ...patch } : t) });
  const removeTask = (taskId) => {
    onUpdate(project.id, { tasks: (project.tasks||[]).filter(t => t.id !== taskId) });
    if (openTask === taskId) setOpenTask(null);
  };
  const addTask = () => {
    if (!newTask.text.trim()) return;
    onUpdate(project.id, { tasks: [...(project.tasks||[]), { ...newTask, links: newTask.links || [] }] });
    setNewTask(mkTask({ assignee: currentUser.id }));
    setShowAdd(false);
  };

  const total = project.tasks.length;
  const done  = (project.tasks||[]).filter(t => t.status === 'done' || t.done).length;
  const pct   = total > 0 ? Math.round(done / total * 100) : 0;

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = (project.tasks||[]).filter(t => (t.status || 'not_started') === s);
    return acc;
  }, {});

  const activeWorkers = (project.tasks||[])
    .filter(t => t.status === 'in_progress' && t.assignee)
    .map(t => ({ task: t, user: users.find(u => u.id === t.assignee) }))
    .filter(x => x.user);

  return (
    <div className="anim">
      {/* Aktive Arbeiter */}
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

      {/* Progress + Hinzufügen */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: total > 0 ? 7 : 0 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8 }}>Arbeitspakete <span style={{ color: C.mu, fontWeight: 400 }}>({total})</span></span>
          <button className="abtn" onClick={() => setShowAdd(s => !s)} style={{ fontSize: 11, padding: '4px 10px' }}>
            <IcoPlus size={12} />{showAdd ? 'Abbrechen' : 'Neu'}
          </button>
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

      {/* Gruppen */}
      {total === 0
        ? <EmptyState Icon={IcoCheck} title="Noch keine Arbeitspakete" subtitle="Klicke auf '+ Neu' um zu starten" />
        : <>
            {STATUS_ORDER.filter(s => s !== 'done').map(s => (
              <TaskGroup key={s} status={s} tasks={grouped[s]} users={assignable}
                openTask={openTask} onToggleTask={id => setOpenTask(openTask === id ? null : id)}
                onUpdate={updateTask} onRemove={removeTask} defaultCollapsed={false}
                projectMaterials={project.materials || []} />
            ))}
            <TaskGroup status="done" tasks={grouped.done} users={assignable}
              openTask={openTask} onToggleTask={id => setOpenTask(openTask === id ? null : id)}
              onUpdate={updateTask} onRemove={removeTask} defaultCollapsed={true}
              projectMaterials={project.materials || []} />
          </>}
    </div>
  );
}

// ── Materials Tab ─────────────────────────────────────────────
export function MaterialsTab({ project, onUpdate }) {
  const [form, setForm] = useState({ name: '', qty: 1, cost: 0 });
  const add    = () => { if (!form.name.trim()) return; onUpdate(project.id, { materials: [...(project.materials||[]), { id: uid(), name: form.name.trim(), qty: Number(form.qty)||1, cost: Number(form.cost)||0 }] }); setForm({ name:'',qty:1,cost:0 }); };
  const remove = id => onUpdate(project.id, { materials: (project.materials||[]).filter(m => m.id !== id) });
  const total  = (project.materials||[]).reduce((s,m) => s + (m.cost||0)*(m.qty||1), 0);

  return (
    <div className="anim">
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px auto', gap: 8, alignItems: 'flex-end' }}>
          <div><label>Bezeichnung</label><input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="z.B. HDMI-Kabel" /></div>
          <div><label>Menge</label><input type="number" min="1" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))} /></div>
          <div><label>Kosten €</label><input type="number" min="0" step="0.01" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} /></div>
          <button className="abtn" onClick={add} style={{ alignSelf:'flex-end',padding:'7px 12px' }}>+</button>
        </div>
      </div>
      <div style={{ background:C.sf2, border:`1px solid ${C.bd}`, borderRadius:9, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 90px 36px', padding:'7px 14px', borderBottom:`1px solid ${C.bd}`, fontSize:10, color:C.mu, textTransform:'uppercase', letterSpacing:.8, fontWeight:700 }}>
          <div>Bezeichnung</div><div>Menge</div><div>Einzelpreis</div><div>Gesamt</div><div />
        </div>
        {(project.materials||[]).length===0 ? <div style={{padding:'20px',textAlign:'center',color:C.mu,fontSize:12}}>Noch kein Material</div>
         : (project.materials||[]).map(m => (
          <div key={m.id} style={{ display:'grid', gridTemplateColumns:'1fr 70px 90px 90px 36px', padding:'9px 14px', borderBottom:`1px solid ${C.bd}22`, alignItems:'center' }}>
            <div style={{fontSize:13,color:C.br,fontWeight:600}}>{m.name}</div>
            <div style={{fontSize:12,fontFamily:C.mono}}>{m.qty}×</div>
            <div style={{fontSize:12,fontFamily:C.mono}}>{Number(m.cost).toFixed(2)} €</div>
            <div style={{fontSize:12,fontFamily:C.mono,color:C.ac,fontWeight:700}}>{(m.qty*m.cost).toFixed(2)} €</div>
            <IconBtn Icon={IcoTrash} onClick={()=>remove(m.id)} label={`${m.name} löschen`} danger size={12} />
          </div>
        ))}
        {(project.materials||[]).length > 0 && (
          <div style={{padding:'8px 14px',borderTop:`1px solid ${C.bd}`,display:'flex',justifyContent:'flex-end',gap:8,alignItems:'center'}}>
            <span style={{fontSize:12,color:C.mu}}>Gesamt:</span>
            <span style={{fontSize:16,fontWeight:800,color:C.ac,fontFamily:C.mono}}>{total.toFixed(2)} €</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Requirements Tab ──────────────────────────────────────────
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
      {(project.requirements||[]).length===0 && <EmptyState Icon={IcoRequire||IcoCheck} title="Noch keine Anforderungen" />}
      {(project.requirements||[]).length > 0 && <div style={{marginTop:8,fontSize:11,color:C.mu,textAlign:'right'}}>{done} von {(project.requirements||[]).length} erfüllt</div>}
    </div>
  );
}

// ── Steps Tab ─────────────────────────────────────────────────
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
