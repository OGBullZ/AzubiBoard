import { useState } from "react";
import { C, uid, fmtDate } from '../../lib/utils.js';
import { StatusBadge, Avatar, ProgressBar, Modal, Field, IconBtn } from '../../components/UI.jsx';
import { TasksTab, MaterialsTab, RequirementsTab, StepsTab } from './ProjectTabs.jsx';
import { NetzplanTab, GanttTab } from './NetzplanGantt.jsx';
import { LinksManager } from './LinksManager.jsx';
import {
  IcoBack, IcoEdit, IcoCheck,
  IcoFolder, IcoMaterial, IcoRequire, IcoDoc,
  IcoNetwork, IcoGantt, IcoLink, IcoSave,
  IcoArchive, IcoPlus, IcoChat, IcoTrash, IcoTrendUp
} from '../../components/Icons.jsx';

const LABEL_PRESETS = ['#0071e3','#3fb950','#f78166','#a371f7','#f0883e','#e3b341','#58a6ff','#ff7b72'];

function LabelsManager({ project, onUpdate }) {
  const [name,  setName]  = useState('');
  const [color, setColor] = useState(LABEL_PRESETS[0]);
  const labels = project.labels || [];

  const addLabel = () => {
    if (!name.trim()) return;
    onUpdate(project.id, { labels: [...labels, { id: uid(), name: name.trim(), color }] });
    setName('');
    setColor(LABEL_PRESETS[0]);
  };

  const removeLabel = (id) => {
    onUpdate(project.id, { labels: labels.filter(l => l.id !== id) });
    // also strip labelId from tasks
    const tasks = (project.tasks || []).map(t => ({
      ...t, labelIds: (t.labelIds || []).filter(x => x !== id)
    }));
    onUpdate(project.id, { tasks });
  };

  return (
    <section className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: C.ac, display: 'inline-block' }} />
        <label style={{ fontSize: 12, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>
          Labels
        </label>
      </div>

      <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLabel()}
          placeholder="Label-Name…" style={{ flex: '1 1 100px', minWidth: 80, fontSize: 12 }} />
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {LABEL_PRESETS.map(c => (
            <button key={c} onClick={() => setColor(c)}
              style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: `2.5px solid ${color === c ? '#fff' : 'transparent'}`, outline: color === c ? `2px solid ${c}` : 'none', cursor: 'pointer', transition: 'outline .1s', padding: 0 }} />
          ))}
        </div>
        <button className="abtn" onClick={addLabel} style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}>
          <IcoPlus size={12} /> Neu
        </button>
      </div>

      {labels.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {labels.map(lb => (
            <div key={lb.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, background: lb.color + '22', border: `1.5px solid ${lb.color}60` }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: lb.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: lb.color }}>{lb.name}</span>
              <button onClick={() => {
                if (window.confirm(`Label "${lb.name}" löschen?`)) removeLabel(lb.id);
              }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: lb.color, fontSize: 13, lineHeight: 1, padding: '0 1px', opacity: .7, fontWeight: 700 }} title="Löschen">×</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: C.mu, fontStyle: 'italic' }}>Noch keine Labels — erstelle das erste oben.</div>
      )}
    </section>
  );
}

function CommentsSection({ project, currentUser, onUpdate }) {
  const [text, setText] = useState('');
  const comments = project.comments || [];

  const post = () => {
    if (!text.trim()) return;
    const c = { id: uid(), authorId: currentUser.id, authorName: currentUser.name, text: text.trim(), date: new Date().toISOString() };
    onUpdate(project.id, { comments: [...comments, c] });
    setText('');
  };

  const remove = (id) => onUpdate(project.id, { comments: comments.filter(c => c.id !== id) });

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
        <IcoChat size={14} style={{ color: C.ac }} />
        <label style={{ fontSize: 12, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>
          Kommentare ({comments.length})
        </label>
      </div>
      {comments.length === 0 && (
        <div style={{ fontSize: 12, color: C.mu, fontStyle: 'italic', marginBottom: 14 }}>Noch keine Kommentare</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: comments.length > 0 ? 14 : 0 }}>
        {comments.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Avatar name={c.authorName} size={28} />
            <div style={{ flex: 1, background: C.sf3, borderRadius: 8, padding: '8px 11px', border: `1px solid ${C.bd}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.br }}>{c.authorName}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <time style={{ fontSize: 10, color: C.mu }}>{new Date(c.date).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</time>
                  {(c.authorId === currentUser?.id || currentUser?.role === 'ausbilder') && (
                    <button onClick={() => remove(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: C.mu, lineHeight: 1 }} title="Kommentar löschen"><IcoTrash size={11} /></button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 13, color: C.tx, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{c.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Avatar name={currentUser?.name || '?'} size={28} />
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Kommentar schreiben…" rows={2}
            style={{ flex: 1, resize: 'none', fontSize: 13 }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) post(); }} />
          <button className="abtn" onClick={post} disabled={!text.trim()} style={{ alignSelf: 'flex-end', padding: '7px 14px', fontSize: 12 }}>Senden</button>
        </div>
      </div>
      <div style={{ fontSize: 10, color: C.mu, marginTop: 4, paddingLeft: 36 }}>Strg+Enter zum Senden</div>
    </section>
  );
}

const TABS = [
  { k: 'overview',     l: 'Übersicht',     Icon: IcoDoc      },
  { k: 'tasks',        l: 'Aufgaben',      Icon: IcoCheck    },
  { k: 'burndown',     l: 'Burndown',      Icon: IcoTrendUp  },
  { k: 'materials',    l: 'Material',      Icon: IcoMaterial  },
  { k: 'requirements', l: 'Anforderungen', Icon: IcoRequire  },
  { k: 'steps',        l: 'Dokumentation', Icon: IcoDoc      },
  { k: 'netzplan',     l: 'Netzplan',      Icon: IcoNetwork  },
  { k: 'gantt',        l: 'Gantt',         Icon: IcoGantt    },
];

// ── Burndown Chart (H2) ───────────────────────────────────────
function BurndownTab({ project }) {
  const tasks = project.tasks || [];
  if (tasks.length === 0) return (
    <div className="card anim" style={{ padding: 40, textAlign: 'center', color: C.mu }}>Noch keine Aufgaben für den Burndown-Chart.</div>
  );

  // Build daily snapshots: for each date from startDate to today,
  // count tasks that were NOT done (= remaining work)
  const start = project.startDate ? new Date(project.startDate) : (() => {
    const dates = tasks.filter(t => t.created).map(t => new Date(t.created));
    return dates.length ? new Date(Math.min(...dates)) : new Date();
  })();
  const end   = project.deadline ? new Date(project.deadline) : new Date();
  const today = new Date();

  const dayMs  = 86400000;
  const numDays = Math.max(1, Math.min(120, Math.ceil((end - start) / dayMs) + 1));

  // Ideal burndown line: from total tasks → 0 over the period
  const totalTasks = tasks.length;

  // Actual: estimate "remaining" at each day by checking task completion date (use updated_at as proxy)
  // Since we don't have a strict completedAt field, we'll use the task's status and deadlines as proxy
  const points = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(start.getTime() + i * dayMs);
    const ds = d.toISOString().split('T')[0];
    // remaining = tasks where deadline > d (or no deadline) AND status not done,
    // OR status was done after d (if updated_at is available)
    const remaining = tasks.filter(t => {
      if (t.status !== 'done') return true;           // still open
      // Check if it was done after this day
      const doneDate = t.updated_at ? t.updated_at.split('T')[0] : null;
      if (!doneDate) return false;
      return doneDate > ds;                           // done after this point
    }).length;
    return { date: ds, remaining, ideal: Math.max(0, Math.round(totalTasks - (totalTasks * i / (numDays - 1 || 1)))) };
  });

  // Only show up to today
  const visPoints = points.filter(p => p.date <= today.toISOString().split('T')[0]);

  // SVG dimensions
  const W = 600, H = 220, PAD = { l: 40, r: 20, t: 20, b: 40 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const xFor = i => PAD.l + (i / Math.max(1, numDays - 1)) * iW;
  const yFor = v => PAD.t + iH - (v / Math.max(1, totalTasks)) * iH;

  const idealLine = points.map((p, i) => `${xFor(i)},${yFor(p.ideal)}`).join(' ');
  const actualLine = visPoints.map((p, i) => `${xFor(i)},${yFor(p.remaining)}`).join(' ');

  const donePct  = Math.round((totalTasks - (visPoints.at(-1)?.remaining ?? totalTasks)) / totalTasks * 100);
  const doneCount = tasks.filter(t => t.status === 'done').length;

  // Y-axis labels
  const yLabels = [0, Math.round(totalTasks/4), Math.round(totalTasks/2), Math.round(3*totalTasks/4), totalTasks];

  return (
    <div style={{ padding: 4 }} className="anim">
      <div className="card" style={{ marginBottom: 12, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 2 }}>Aufgaben gesamt</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.br, fontFamily: C.mono }}>{totalTasks}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 2 }}>Abgeschlossen</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: C.gr, fontFamily: C.mono }}>{doneCount}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 2 }}>Fortschritt</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: donePct === 100 ? C.gr : C.ac, fontFamily: C.mono }}>{donePct}%</div>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 14, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.mu }}>
            <div style={{ width: 24, height: 2, background: C.bd2, borderRadius: 1 }} /> Ideal
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.mu }}>
            <div style={{ width: 24, height: 2, background: C.ac, borderRadius: 1 }} /> Tatsächlich
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', minWidth: 320 }}>
          {/* Grid */}
          {yLabels.map(v => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yFor(v)} y2={yFor(v)} stroke={C.bd} strokeWidth={0.5} />
              <text x={PAD.l - 5} y={yFor(v) + 4} fontSize={9} fill={C.mu} textAnchor="end">{v}</text>
            </g>
          ))}
          {/* X-axis labels (start / mid / end) */}
          {[0, Math.floor(numDays/2), numDays-1].map(i => (
            <text key={i} x={xFor(i)} y={H - PAD.b + 14} fontSize={9} fill={C.mu} textAnchor="middle">
              {points[i]?.date?.slice(5) || ''}
            </text>
          ))}
          {/* Ideal line (dashed) */}
          {points.length > 1 && (
            <polyline points={idealLine} fill="none" stroke={C.bd2} strokeWidth={1.5} strokeDasharray="5,4" />
          )}
          {/* Actual line */}
          {visPoints.length > 1 && (
            <polyline points={actualLine} fill="none" stroke={C.ac} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {/* Today marker */}
          {visPoints.length > 0 && (
            <line
              x1={xFor(visPoints.length - 1)} x2={xFor(visPoints.length - 1)}
              y1={PAD.t} y2={H - PAD.b}
              stroke={C.yw} strokeWidth={1} strokeDasharray="3,3" />
          )}
          {/* Axes */}
          <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke={C.bd2} strokeWidth={1} />
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke={C.bd2} strokeWidth={1} />
        </svg>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center', fontSize: 10, color: C.mu }}>
          <span style={{ color: C.yw }}>│</span> Heute ·
          <span style={{ color: C.bd2 }}>- -</span> Ideallinie ·
          <span style={{ color: C.ac }}>──</span> Tatsächlicher Fortschritt
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, Icon, onClick, hint }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="card"
      style={{ borderLeft: `3px solid ${color}`, cursor: onClick ? 'pointer' : 'default', transition: 'border-color .15s, box-shadow .15s', boxShadow: hov && onClick ? 'var(--shadow)' : 'none', position: 'relative', overflow: 'hidden' }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      {Icon && <div aria-hidden style={{ position: 'absolute', right: 10, bottom: 8, opacity: .06, color }}><Icon size={36} /></div>}
      <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: C.mono, marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.mu }}>{sub}</div>}
      {hint && hov && (
        <div style={{ position: 'absolute', bottom: 6, right: 10, fontSize: 9, color: C.ac, fontWeight: 700 }}>
          {hint} →
        </div>
      )}
    </div>
  );
}

function MaterialsPopup({ project, onUpdate, onClose }) {
  const [form, setForm] = useState({ name: '', qty: 1, cost: 0 });
  const add = () => {
    if (!form.name.trim()) return;
    onUpdate(project.id, { materials: [...project.materials, { id: uid(), name: form.name.trim(), qty: Number(form.qty) || 1, cost: Number(form.cost) || 0 }] });
    setForm({ name: '', qty: 1, cost: 0 });
  };
  const remove = id => onUpdate(project.id, { materials: project.materials.filter(m => m.id !== id) });
  const total = project.materials.reduce((s, m) => s + (m.cost || 0) * (m.qty || 1), 0);

  return (
    <Modal title="Materialkosten" onClose={onClose} width={500}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px auto', gap: 8, alignItems: 'flex-end', marginBottom: 14 }}>
        <div><label>Bezeichnung</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && add()} placeholder="z.B. HDMI-Kabel" autoFocus /></div>
        <div><label>Menge</label><input type="number" min="1" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} /></div>
        <div><label>Kosten €</label><input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} /></div>
        <button className="abtn" onClick={add} style={{ alignSelf: 'flex-end', padding: '7px 12px' }}><IcoPlus size={13} /></button>
      </div>
      <div style={{ background: 'var(--c-sf3)', borderRadius: 8, overflow: 'hidden', border: `1px solid var(--c-bd)` }}>
        {project.materials.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: C.mu, fontSize: 12 }}>Noch kein Material</div>
        ) : project.materials.map(m => (
          <div key={m.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 28px', padding: '8px 12px', borderBottom: `1px solid var(--c-bd)22`, alignItems: 'center', fontSize: 12 }}>
            <span style={{ fontWeight: 600, color: C.br }}>{m.name}</span>
            <span style={{ fontFamily: C.mono, color: C.mu }}>{m.qty}×</span>
            <span style={{ fontFamily: C.mono, color: C.mu }}>{Number(m.cost).toFixed(2)} €</span>
            <span style={{ fontFamily: C.mono, color: C.ac, fontWeight: 700 }}>{(m.qty * m.cost).toFixed(2)} €</span>
            <button className="del" onClick={() => remove(m.id)} style={{ fontSize: 13 }}>×</button>
          </div>
        ))}
        {project.materials.length > 0 && (
          <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.mu }}>Gesamt</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: C.yw, fontFamily: C.mono }}>{total.toFixed(2)} €</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ZeitraumPopup({ project, onUpdate, onClose }) {
  const [startDate, setStart]    = useState(project.startDate || '');
  const [deadline,  setDeadline] = useState(project.deadline  || '');
  const save = () => { onUpdate(project.id, { startDate, deadline }); onClose(); };
  return (
    <Modal title="Zeitraum bearbeiten" onClose={onClose} width={360}>
      <Field label="Startdatum">
        <input type="date" value={startDate} onChange={e => setStart(e.target.value)} autoFocus />
      </Field>
      <Field label="Deadline">
        <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button className="abtn" onClick={save} style={{ flex: 1, justifyContent: 'center' }}><IcoCheck size={13} /> Speichern</button>
        <button className="btn" onClick={onClose}>Abbrechen</button>
      </div>
    </Modal>
  );
}

function RequirementsPopup({ project, onUpdate, onClose }) {
  const [text, setText] = useState('');
  const add    = () => { if (!text.trim()) return; onUpdate(project.id, { requirements: [...project.requirements, { id: uid(), text: text.trim(), done: false }] }); setText(''); };
  const toggle = id => onUpdate(project.id, { requirements: project.requirements.map(r => r.id === id ? { ...r, done: !r.done } : r) });
  const remove = id => onUpdate(project.id, { requirements: project.requirements.filter(r => r.id !== id) });
  const done  = project.requirements.filter(r => r.done).length;
  const pct   = project.requirements.length ? Math.round(done / project.requirements.length * 100) : 0;
  return (
    <Modal title="Anforderungen" onClose={onClose} width={480}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Neue Anforderung…" autoFocus style={{ flex: 1 }} />
        <button className="abtn" onClick={add}><IcoPlus size={13} /></button>
      </div>
      {project.requirements.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <ProgressBar value={pct} color={C.gr} height={4} />
          <div style={{ fontSize: 10, color: C.mu, marginTop: 3 }}>{done}/{project.requirements.length} erfüllt</div>
        </div>
      )}
      {project.requirements.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--c-sf3)', border: `1px solid ${r.done ? C.gr + '30' : 'var(--c-bd)'}`, borderRadius: 7, marginBottom: 5 }}>
          <button onClick={() => toggle(r.id)} style={{ width: 17, height: 17, borderRadius: 4, border: `2px solid ${r.done ? C.gr : 'var(--c-bd2)'}`, background: r.done ? C.gr : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .12s' }}>
            {r.done && <IcoCheck size={9} style={{ color: '#fff' }} />}
          </button>
          <span style={{ flex: 1, fontSize: 13, color: r.done ? C.mu : C.br, textDecoration: r.done ? 'line-through' : 'none' }}>{r.text}</span>
          <button className="del" onClick={() => remove(r.id)} style={{ fontSize: 13 }}>×</button>
        </div>
      ))}
    </Modal>
  );
}

function LinksPopup({ project, onUpdate, onClose }) {
  return (
    <Modal title="Links & Ressourcen" onClose={onClose} width={520}>
      <LinksManager links={project.links || []} onUpdate={links => onUpdate(project.id, { links })} />
    </Modal>
  );
}

export default function ProjectDetail({ project, users, groups, currentUser, onUpdate, onBack, onArchive, showToast, onActivity }) {
  const [tab,       setTab]      = useState('overview');
  const [editMode,  setEditMode] = useState(false);
  const [form,      setForm]     = useState({ ...project });
  const [saving,    setSaving]   = useState(false);
  const [popup, setPopup] = useState(null);

  const uf = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const save = () => {
    setSaving(true);
    onUpdate(project.id, form);
    setTimeout(() => { setEditMode(false); setSaving(false); showToast('✓ Gespeichert'); }, 200);
  };
  const cancel = () => { setForm({ ...project }); setEditMode(false); };

  const totalCost    = project.materials.reduce((s, m) => s + (m.cost || 0) * (m.qty || 1), 0);
  const doneReq      = project.requirements.filter(r => r.done).length;
  const doneTasks    = project.tasks.filter(t => t.status === 'done' || t.done).length;
  const taskPct      = project.tasks.length > 0 ? Math.round(doneTasks / project.tasks.length * 100) : 0;
  const group        = groups.find(g => g.id === project.groupId);
  const assignedUsers = users.filter(u => project.assignees.includes(u.id));
  const isOverdue    = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'green';
  const linkCount    = (project.links || []).length;
  const activeCount  = project.tasks.filter(t => t.status === 'in_progress').length;

  const goTab = t => { setTab(t); setPopup(null); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="anim">

      {popup === 'materials'    && <MaterialsPopup    project={project} onUpdate={onUpdate} onClose={() => setPopup(null)} />}
      {popup === 'zeitraum'     && <ZeitraumPopup     project={project} onUpdate={onUpdate} onClose={() => setPopup(null)} />}
      {popup === 'requirements' && <RequirementsPopup project={project} onUpdate={onUpdate} onClose={() => setPopup(null)} />}
      {popup === 'links'        && <LinksPopup        project={project} onUpdate={onUpdate} onClose={() => setPopup(null)} />}

      <div style={{ background: 'var(--c-sf)', borderBottom: `1px solid var(--c-bd)`, padding: '10px 18px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: editMode ? 10 : 6, flexWrap: 'wrap' }}>
          <button className="btn" onClick={onBack} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <IcoBack size={12} /> Projekte
          </button>
          <div style={{ flex: 1, minWidth: 200 }}>
            {editMode
              ? <input value={form.title} onChange={e => uf('title', e.target.value)} style={{ fontSize: 15, fontWeight: 800 }} />
              : <h1 style={{ fontSize: 16, fontWeight: 800, color: C.br, margin: 0 }}>{project.title}</h1>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
            <StatusBadge status={project.status} />
            {isOverdue && <span className="tag" style={{ background: 'var(--c-crd)', color: C.cr, border: `1px solid ${C.cr}35` }}>⚠ Überfällig</span>}
            {activeCount > 0 && <span style={{ fontSize: 9, color: C.ac, background: C.acd, borderRadius: 4, padding: '2px 7px', fontFamily: C.mono, fontWeight: 800 }}>▶ {activeCount} aktiv</span>}
            {!editMode ? (
              <>
                <button className="btn" onClick={() => { setForm({ ...project }); setEditMode(true); }} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IcoEdit size={12} /> Bearbeiten
                </button>
                {onArchive && currentUser.role === 'ausbilder' && !project.archived && (
                  <button className="btn" onClick={() => onArchive(project.id)} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, color: C.mu }}>
                    <IcoArchive size={12} /> Archivieren
                  </button>
                )}
              </>
            ) : (
              <>
                <button className="abtn" onClick={save} disabled={saving} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <IcoSave size={12} /> {saving ? '…' : 'Speichern'}
                </button>
                <button className="btn" onClick={cancel} style={{ fontSize: 11 }}>Abbrechen</button>
              </>
            )}
          </div>
        </div>

        {editMode && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 8 }}>
            <div><label>Status</label>
              <select value={form.status} onChange={e => uf('status', e.target.value)}>
                <option value="green">In Ordnung</option><option value="yellow">In Bearbeitung</option><option value="red">Problem</option>
              </select>
            </div>
            <div><label>Startdatum</label><input type="date" value={form.startDate || ''} onChange={e => uf('startDate', e.target.value)} /></div>
            <div><label>Deadline</label><input type="date" value={form.deadline || ''} onChange={e => uf('deadline', e.target.value)} /></div>
            <div><label>Zeiteinheit</label>
              <select value={form.netzplan?.unit || 'W'} onChange={e => uf('netzplan', { ...form.netzplan, unit: e.target.value })}>
                <option value="W">Wochen</option><option value="T">Tage</option><option value="M">Monate</option>
              </select>
            </div>
          </div>
        )}

        <nav style={{ display: 'flex', gap: 2, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.k} role="tab" aria-selected={tab === t.k} onClick={() => setTab(t.k)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: 'none', background: tab === t.k ? C.acd : 'transparent', color: tab === t.k ? C.ac : C.mu, flexShrink: 0, transition: 'all .12s' }}>
              <t.Icon size={12} />{t.l}
              {t.k === 'tasks' && activeCount > 0 && <span style={{ fontSize: 9, background: C.ac, color: '#fff', borderRadius: 5, padding: '0 4px', fontFamily: C.mono }}>▶</span>}
              {t.k === 'overview' && linkCount > 0 && <span style={{ fontSize: 9, background: C.ac, color: '#fff', borderRadius: 5, padding: '0 4px', fontFamily: C.mono }}>{linkCount}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

        {tab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }} className="anim">

            <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>

              <section className="card">
                <label>Beschreibung</label>
                {editMode
                  ? <textarea value={form.description} onChange={e => uf('description', e.target.value)} placeholder="Projektbeschreibung…" style={{ minHeight: 70 }} />
                  : <p style={{ fontSize: 13, color: project.description ? C.tx : C.mu, lineHeight: 1.75, whiteSpace: 'pre-wrap', margin: '4px 0 0', fontStyle: project.description ? 'normal' : 'italic' }}>
                      {project.description || 'Keine Beschreibung'}
                    </p>}
              </section>

              <section className="card">
                <LinksManager links={project.links || []} onUpdate={links => onUpdate(project.id, { links })} />
              </section>

              <section className="card">
                <label>Zugewiesen</label>
                {editMode ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                    {users.filter(u => u.role === 'azubi').map(u => {
                      const sel = form.assignees.includes(u.id);
                      return (
                        <button key={u.id} aria-pressed={sel}
                          onClick={() => uf('assignees', sel ? form.assignees.filter(x => x !== u.id) : [...form.assignees, u.id])}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 7, background: sel ? C.acd : 'var(--c-sf2)', border: `1px solid ${sel ? C.ac : 'var(--c-bd2)'}`, cursor: 'pointer', transition: 'all .12s' }}>
                          <Avatar name={u.name} size={18} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: sel ? C.ac : C.tx }}>{u.name}</span>
                          {sel && <IcoCheck size={11} style={{ color: C.ac }} />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    {assignedUsers.length === 0
                      ? <span style={{ fontSize: 12, color: C.mu, fontStyle: 'italic' }}>Niemand zugewiesen</span>
                      : assignedUsers.map(u => (
                          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', background: 'var(--c-sf2)', borderRadius: 7, border: `1px solid var(--c-bd)` }}>
                            <Avatar name={u.name} size={24} />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.br }}>{u.name}</div>
                              <div style={{ fontSize: 10, color: C.mu }}>{u.email}</div>
                            </div>
                          </div>
                        ))}
                  </div>
                )}
              </section>

              <section className="card">
                <label>Gruppe</label>
                {editMode
                  ? <select value={form.groupId || ''} onChange={e => uf('groupId', e.target.value || null)}>
                      <option value="">— Keine Gruppe —</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  : <div style={{ fontSize: 13, color: group ? C.tx : C.mu, marginTop: 4 }}>
                      {group
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><IcoFolder size={13} />{group.name}</span>
                        : <span style={{ fontStyle: 'italic' }}>Keine Gruppe</span>}
                    </div>}
              </section>

              <LabelsManager project={project} onUpdate={onUpdate} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              <StatCard
                label="Aufgaben"
                value={<>{doneTasks}<span style={{ fontSize: 13, color: C.mu }}>/{project.tasks.length}</span></>}
                sub={`${taskPct}% erledigt`}
                color={C.ac}
                Icon={IcoCheck}
                onClick={() => goTab('tasks')}
                hint="Zum Tab" />

              <StatCard
                label="Anforderungen"
                value={<>{doneReq}<span style={{ fontSize: 13, color: C.mu }}>/{project.requirements.length}</span></>}
                sub={`${project.requirements.length ? Math.round(doneReq / project.requirements.length * 100) : 0}% erfüllt`}
                color={C.gr}
                Icon={IcoRequire}
                onClick={() => setPopup('requirements')}
                hint="Bearbeiten" />

              <StatCard
                label="Materialkosten"
                value={`${totalCost.toFixed(2)} €`}
                sub={`${project.materials.length} Position(en)`}
                color={C.yw}
                Icon={IcoMaterial}
                onClick={() => setPopup('materials')}
                hint="Bearbeiten" />

              <div className="card" style={{ borderLeft: `3px solid var(--c-bd2)`, cursor: 'pointer', transition: 'box-shadow .15s' }}
                onClick={() => setPopup('zeitraum')}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Zeitraum
                  <span style={{ fontSize: 9, color: C.ac, fontWeight: 700 }}>Bearbeiten →</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: C.mu }}>Start</span>
                  <time style={{ fontSize: 11, fontFamily: C.mono, color: C.tx }}>{fmtDate(project.startDate) || '–'}</time>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.mu }}>Deadline</span>
                  <time style={{ fontSize: 11, fontFamily: C.mono, color: isOverdue ? C.cr : C.tx }}>{fmtDate(project.deadline) || '–'}</time>
                </div>
              </div>

              <div className="card" style={{ borderLeft: `3px solid ${C.ac}`, cursor: 'pointer', transition: 'box-shadow .15s' }}
                onClick={() => setPopup('links')}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: linkCount > 0 ? 8 : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Links
                  <span style={{ fontSize: 9, color: C.ac, fontWeight: 700 }}>{linkCount > 0 ? `${linkCount} · Bearbeiten →` : '+ Hinzufügen →'}</span>
                </div>
                {linkCount > 0 && (project.links || []).slice(0, 3).map(l => (
                  <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 11, color: C.ac, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <IcoLink size={10} style={{ flexShrink: 0 }} />
                    {l.title || l.url}
                  </div>
                ))}
                {linkCount > 3 && <div style={{ fontSize: 10, color: C.mu, marginTop: 3 }}>+{linkCount - 3} weitere</div>}
              </div>
            </div>

          <CommentsSection project={project} currentUser={currentUser} onUpdate={onUpdate} />
          </div>
        )}

        {tab === 'tasks'        && <TasksTab        project={project} users={users} currentUser={currentUser} onUpdate={onUpdate} onActivity={onActivity} />}
        {tab === 'burndown'     && <BurndownTab     project={project} />}
        {tab === 'materials'    && <MaterialsTab    project={project} onUpdate={onUpdate} />}
        {tab === 'requirements' && <RequirementsTab project={project} onUpdate={onUpdate} />}
        {tab === 'steps'        && <StepsTab        project={project} onUpdate={onUpdate} />}
        {tab === 'netzplan'     && <NetzplanTab     project={project} onUpdate={onUpdate} />}
        {tab === 'gantt'        && <GanttTab        project={project} />}
      </div>
    </div>
  );
}
