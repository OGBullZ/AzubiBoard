import { useState } from 'react';
import { C, uid, fmtDate, addActivity } from '../../lib/utils.js';
import { softDelete } from '../../lib/trash.js';
import { Avatar, ProgressBar, EmptyState } from '../../components/UI.jsx';
import {
  IcoCheck, IcoPlus, IcoTrash, IcoEdit, IcoClock,
  IcoAlert, IcoX, IcoChevronD,
} from '../../components/Icons.jsx';

// ── Helpers ───────────────────────────────────────────────────
const YEARS    = [1, 2, 3];
const QUARTERS = [1, 2, 3, 4];
const CATS     = ['Fachkompetenz', 'Methodenkompetenz', 'Sozialkompetenz', 'IT & Digital', 'Betrieb', 'Schule', 'Sonstiges'];

const STATUS_CFG = {
  open:      { l: 'Offen',       c: C.mu, bg: 'var(--c-sf2)',  dot: '○' },
  learned:   { l: 'Gelernt',     c: C.ac, bg: C.acd,           dot: '◑' },
  confirmed: { l: 'Bestätigt',   c: C.gr, bg: '#07130a',        dot: '●' },
};

function mkGoal(overrides = {}) {
  return { id: uid(), title: '', description: '', year: 1, quarter: 1, category: 'Fachkompetenz', progress: {}, ...overrides };
}

// ── Prüfungs-Countdown Widget (E3) ───────────────────────────
function ExamCountdown({ examDate, isAusbilder, onChange }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(examDate || '');

  const days   = examDate ? Math.ceil((new Date(examDate) - new Date()) / 86400000) : null;
  const urgent = days !== null && days <= 90;
  const over   = days !== null && days < 0;

  const save = () => { onChange(val || null); setEditing(false); };

  if (!examDate && !isAusbilder) return null;

  return (
    <div className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${over ? C.cr : urgent ? C.yw : C.gr}`, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>🎓</div>
      <div style={{ flex: 1 }}>
        {examDate ? (
          <>
            <div style={{ fontSize: 11, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 2 }}>IHK-Prüfung</div>
            <div style={{ fontSize: 13, color: C.br, fontWeight: 600 }}>{new Date(examDate).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: C.mu }}>Kein Prüfungstermin hinterlegt</div>
        )}
      </div>
      {days !== null && (
        <div style={{ textAlign: 'center', minWidth: 80 }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: over ? C.cr : urgent ? C.yw : C.gr, fontFamily: C.mono, lineHeight: 1 }}>
            {over ? 'Past' : days}
          </div>
          {!over && <div style={{ fontSize: 10, color: C.mu }}>Tage</div>}
        </div>
      )}
      {isAusbilder && !editing && (
        <button onClick={() => setEditing(true)} title="Prüfungsdatum ändern"
          style={{ padding: '5px 9px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.mu, cursor: 'pointer' }}>✏</button>
      )}
      {isAusbilder && editing && (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <input type="date" value={val} onChange={e => setVal(e.target.value)}
            style={{ padding: '5px 8px', borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.br, fontSize: 12 }} />
          <button onClick={save} className="abtn" style={{ fontSize: 11, padding: '5px 9px' }}>✓</button>
          <button onClick={() => setEditing(false)} style={{ padding: '5px 9px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.mu, cursor: 'pointer' }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── Goal Form ─────────────────────────────────────────────────
function GoalForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || mkGoal());
  const f = v => setForm(p => ({ ...p, ...v }));
  const valid = form.title.trim().length > 0;
  return (
    <div className="card" style={{ marginBottom: 10, background: C.acd, border: `1px solid ${C.ac}30` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.ac, marginBottom: 10, textTransform: 'uppercase', letterSpacing: .8 }}>
        {initial ? 'Lernziel bearbeiten' : 'Neues Lernziel'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 160px', gap: 8, marginBottom: 8 }}>
        <div><label>Titel *</label><input autoFocus value={form.title} onChange={e => f({ title: e.target.value })} placeholder="Lernziel beschreiben…" /></div>
        <div><label>Lehrjahr</label>
          <select value={form.year} onChange={e => f({ year: Number(e.target.value) })}>
            {YEARS.map(y => <option key={y} value={y}>{y}. LJ</option>)}
          </select>
        </div>
        <div><label>Quartal</label>
          <select value={form.quarter} onChange={e => f({ quarter: Number(e.target.value) })}>
            {QUARTERS.map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
        <div><label>Kategorie</label>
          <select value={form.category} onChange={e => f({ category: e.target.value })}>
            {CATS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>Beschreibung (optional)</label>
        <textarea value={form.description} onChange={e => f({ description: e.target.value })} rows={2} placeholder="Details, Ressourcen, Hinweise…" style={{ resize: 'vertical', minHeight: 48 }} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="abtn" onClick={() => valid && onSave(form)} disabled={!valid} style={{ fontSize: 12 }}>
          <IcoCheck size={12} /> Speichern
        </button>
        <button onClick={onCancel} className="btn" style={{ fontSize: 12 }}>Abbrechen</button>
      </div>
    </div>
  );
}

// ── Goal Row ──────────────────────────────────────────────────
function GoalRow({ goal, currentUser, azubis, isAusbilder, onUpdate, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  const myStatus = goal.progress?.[currentUser.id]?.status || 'open';
  const myCfg    = STATUS_CFG[myStatus];

  const totalProgress = isAusbilder
    ? azubis.map(a => ({ user: a, st: goal.progress?.[a.id]?.status || 'open' }))
    : null;
  const confirmedCount = totalProgress?.filter(p => p.st === 'confirmed').length || 0;
  const learnedCount   = totalProgress?.filter(p => p.st !== 'open').length || 0;

  const markLearned = () => {
    const next = myStatus === 'open' ? 'learned' : 'open';
    const prog = { ...(goal.progress || {}), [currentUser.id]: { status: next, ts: new Date().toISOString() } };
    onUpdate({ ...goal, progress: prog }, next === 'learned' ? { learnedFor: currentUser.id } : null);
  };

  const confirmUser = (userId) => {
    const cur = goal.progress?.[userId]?.status;
    const next = cur === 'confirmed' ? 'learned' : 'confirmed';
    const prog = { ...(goal.progress || {}), [userId]: { ...(goal.progress?.[userId] || {}), status: next, confirmedBy: currentUser.id, confirmedTs: new Date().toISOString() } };
    onUpdate({ ...goal, progress: prog }, next === 'confirmed' ? { confirmedFor: userId } : null);
  };

  return (
    <div style={{ background: C.sf2, border: `1px solid ${C.bd}`, borderRadius: 8, marginBottom: 6, overflow: 'hidden' }}>
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        {/* Status dot / toggle for azubi */}
        {!isAusbilder ? (
          <button onClick={e => { e.stopPropagation(); markLearned(); }}
            title={myStatus === 'open' ? 'Als gelernt markieren' : 'Rückgängig'}
            style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${myCfg.c}`, background: myCfg.bg, color: myCfg.c, fontSize: 14, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {myStatus === 'confirmed' ? '✓' : myStatus === 'learned' ? '◑' : '○'}
          </button>
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${C.bd2}`, background: C.sf3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.mu, fontWeight: 700 }}>
            {confirmedCount}/{azubis.length}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: !isAusbilder && myStatus === 'confirmed' ? C.gr : C.br, textDecoration: !isAusbilder && myStatus === 'confirmed' ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {goal.title}
          </div>
          <div style={{ fontSize: 10, color: C.mu, marginTop: 1 }}>
            <span style={{ padding: '1px 6px', borderRadius: 3, background: C.sf3, border: `1px solid ${C.bd}`, marginRight: 5 }}>{goal.category}</span>
            {isAusbilder && learnedCount > 0 && <span style={{ color: C.ac }}>● {learnedCount} gelernt</span>}
            {!isAusbilder && myStatus !== 'open' && <span style={{ color: myCfg.c, fontWeight: 700 }}>{myCfg.l}</span>}
          </div>
        </div>

        {/* Ausbilder progress bar */}
        {isAusbilder && azubis.length > 0 && (
          <div style={{ width: 80, flexShrink: 0 }}>
            <ProgressBar value={Math.round(confirmedCount / azubis.length * 100)} height={4} color={C.gr} />
          </div>
        )}

        <IcoChevronD size={12} style={{ color: C.mu, transition: 'transform .15s', transform: expanded ? 'none' : 'rotate(-90deg)', flexShrink: 0 }} />

        {isAusbilder && (
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(goal)} title="Bearbeiten"
              style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.bd2}`, background: C.sf3, color: C.mu, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✏</button>
            <button onClick={() => onDelete(goal.id)} title="Löschen"
              style={{ width: 24, height: 24, borderRadius: 5, border: `1px solid ${C.cr}30`, background: 'transparent', color: C.cr, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
        )}
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.bd}`, background: C.sf3 }}>
          {goal.description && (
            <div style={{ fontSize: 12, color: C.mu, marginBottom: 10, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{goal.description}</div>
          )}

          {/* Azubi: own status info */}
          {!isAusbilder && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: C.mu }}>Dein Status:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: myCfg.c }}>{myCfg.dot} {myCfg.l}</span>
              {myStatus === 'open' && (
                <button onClick={markLearned} className="abtn" style={{ fontSize: 11, padding: '3px 10px' }}>Als gelernt markieren</button>
              )}
              {myStatus === 'learned' && (
                <span style={{ fontSize: 11, color: C.mu }}>· Warte auf Bestätigung des Ausbilders</span>
              )}
              {myStatus === 'confirmed' && goal.progress?.[currentUser.id]?.confirmedTs && (
                <span style={{ fontSize: 11, color: C.mu }}>· Bestätigt am {fmtDate(goal.progress[currentUser.id].confirmedTs)}</span>
              )}
            </div>
          )}

          {/* Ausbilder: per-azubi progress */}
          {isAusbilder && azubis.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {azubis.map(a => {
                const st  = goal.progress?.[a.id]?.status || 'open';
                const cfg = STATUS_CFG[st];
                return (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={a.name} url={a.avatar_url} size={20} />
                    <span style={{ fontSize: 12, color: C.br, flex: 1 }}>{a.name}</span>
                    <span style={{ fontSize: 11, color: cfg.c, fontWeight: 600 }}>{cfg.l}</span>
                    {st === 'learned' && (
                      <button onClick={() => confirmUser(a.id)} className="abtn"
                        style={{ fontSize: 10, padding: '2px 8px', background: C.gr, borderColor: C.gr }}>✓ Bestätigen</button>
                    )}
                    {st === 'confirmed' && (
                      <button onClick={() => confirmUser(a.id)} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.gr}`, background: 'transparent', color: C.gr, cursor: 'pointer' }}>Rücksetzen</button>
                    )}
                    {st === 'open' && (
                      <span style={{ fontSize: 10, color: C.mu }}>–</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TrainingPlanPage({ currentUser, data, onUpdateData, showToast }) {
  const plan       = data?.trainingPlan || { goals: [], examDate: null };
  const goals      = plan.goals || [];
  const azubis     = (data?.users || []).filter(u => u.role === 'azubi');
  const isAusbilder = currentUser.role === 'ausbilder';
  const toast       = showToast || (() => {});

  const [showAdd,   setShowAdd]   = useState(false);
  const [editGoal,  setEditGoal]  = useState(null);
  const [filterY,   setFilterY]   = useState(isAusbilder ? 'all' : String(currentUser.apprenticeship_year || 1));
  const [filterCat, setFilterCat] = useState('all');

  const savePlan = (patch, audit) => {
    let next = { ...data, trainingPlan: { ...plan, ...patch } };
    if (audit) next = addActivity(next, audit);
    onUpdateData(next);
  };

  const addGoal = (goal) => {
    savePlan({ goals: [...goals, goal] }, {
      type:        'goal_added',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: goal.title,
      projectId:   null,
      projectTitle:null,
      action:      `Lernziel angelegt (${goal.year}. LJ Q${goal.quarter})`,
    });
    setShowAdd(false);
    toast('✓ Lernziel hinzugefügt');
  };

  const updateGoal = (updated, opts) => {
    const before = goals.find(g => g.id === updated.id);
    let audit = null;
    // Spezialfall: Ausbilder bestätigt Status (confirm) → eigener Audit-Eintrag
    if (opts?.confirmedFor) {
      const azubi = (data?.users || []).find(u => u.id === opts.confirmedFor);
      audit = {
        type:        'goal_confirmed',
        userId:      currentUser.id,
        userName:    currentUser.name,
        entityTitle: updated.title + (azubi ? ` · ${azubi.name}` : ''),
        projectId:   null,
        projectTitle:null,
        action:      'Kompetenz bestätigt',
      };
    } else if (opts?.learnedFor) {
      audit = {
        type:        'goal_learned',
        userId:      currentUser.id,
        userName:    currentUser.name,
        entityTitle: updated.title,
        projectId:   null,
        projectTitle:null,
        action:      'als gelernt markiert',
      };
    } else if (before && before.title !== updated.title) {
      audit = {
        type:        'goal_updated',
        userId:      currentUser.id,
        userName:    currentUser.name,
        entityTitle: updated.title,
        projectId:   null,
        projectTitle:null,
        action:      'Lernziel aktualisiert',
      };
    }
    savePlan({ goals: goals.map(g => g.id === updated.id ? updated : g) }, audit);
    setEditGoal(null);
  };

  const deleteGoal = (id) => {
    const snapshot = data;
    const goal     = goals.find(g => g.id === id);
    if (!goal) return;
    // J3: in Papierkorb verschieben (statt hart löschen) + Audit-Log
    let next = softDelete(data, 'goals', goal, currentUser);
    next = addActivity(next, {
      type:        'goal_deleted',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: goal.title,
      projectId:   null,
      projectTitle:null,
      action:      'Lernziel gelöscht',
    });
    onUpdateData(next);
    toast(`🗑 Lernziel „${goal.title}" → Papierkorb`, { undo: () => onUpdateData(snapshot) });
  };

  // Filter & group
  const filtered = goals.filter(g =>
    (filterY   === 'all' || g.year     === Number(filterY))   &&
    (filterCat === 'all' || g.category === filterCat)
  );

  const grouped = YEARS.reduce((acc, y) => {
    acc[y] = QUARTERS.reduce((qa, q) => {
      qa[q] = filtered.filter(g => g.year === y && g.quarter === q);
      return qa;
    }, {});
    return acc;
  }, {});

  // My overall progress (azubi)
  const myTotal     = goals.length;
  const myLearned   = goals.filter(g => ['learned','confirmed'].includes(g.progress?.[currentUser.id]?.status)).length;
  const myConfirmed = goals.filter(g => g.progress?.[currentUser.id]?.status === 'confirmed').length;
  const myPct       = myTotal > 0 ? Math.round(myConfirmed / myTotal * 100) : 0;

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }} className="anim">
      {/* Prüfungs-Countdown (E3) */}
      <ExamCountdown
        examDate={plan.examDate}
        isAusbilder={isAusbilder}
        onChange={date => savePlan({ examDate: date })}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.br }}>📋 Ausbildungsplan</h2>
          <div style={{ fontSize: 12, color: C.mu, marginTop: 3 }}>
            {isAusbilder
              ? `${goals.length} Lernziele · ${azubis.length} Azubis`
              : `${myConfirmed}/${myTotal} Lernziele bestätigt (${myPct}%)`}
          </div>
        </div>

        {!isAusbilder && myTotal > 0 && (
          <div style={{ width: 200 }}>
            <ProgressBar value={myPct} color={myPct === 100 ? C.gr : C.ac} height={7} />
            <div style={{ display: 'flex', gap: 12, marginTop: 5, fontSize: 10, color: C.mu }}>
              <span style={{ color: C.ac }}>◑ {myLearned} gelernt</span>
              <span style={{ color: C.gr }}>● {myConfirmed} bestätigt</span>
            </div>
          </div>
        )}

        {isAusbilder && (
          <button className="abtn" onClick={() => setShowAdd(true)} style={{ fontSize: 12 }}>
            <IcoPlus size={12} /> Lernziel hinzufügen
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && <GoalForm onSave={addGoal} onCancel={() => setShowAdd(false)} />}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 }}>Jahr:</span>
        {['all', '1', '2', '3'].map(v => (
          <button key={v} onClick={() => setFilterY(v)}
            style={{ padding: '3px 10px', fontSize: 11, borderRadius: 5, border: `1px solid ${filterY === v ? C.ac : C.bd2}`, background: filterY === v ? C.acd : C.sf2, color: filterY === v ? C.ac : C.mu, cursor: 'pointer' }}>
            {v === 'all' ? 'Alle' : `${v}. LJ`}
          </button>
        ))}
        <span style={{ fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, marginLeft: 8 }}>Kategorie:</span>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          style={{ padding: '3px 8px', fontSize: 11, borderRadius: 5, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.mu }}>
          <option value="all">Alle</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Goals grouped by year/quarter */}
      {filtered.length === 0 ? (
        <EmptyState Icon={IcoCheck} title="Keine Lernziele" subtitle={isAusbilder ? "Klicke auf '+ Lernziel hinzufügen' um zu starten" : "Der Ausbilder hat noch keine Lernziele hinterlegt"} />
      ) : (
        YEARS.filter(y => filterY === 'all' || y === Number(filterY)).map(y => {
          const yearGoals = Object.values(grouped[y]).flat();
          if (!yearGoals.length) return null;
          return (
            <div key={y} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.br, marginBottom: 10, padding: '6px 12px', background: C.sf2, borderRadius: 7, border: `1px solid ${C.bd}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📚 {y}. Lehrjahr</span>
                <span style={{ fontSize: 11, color: C.mu, fontWeight: 400 }}>({yearGoals.length} Ziele)</span>
              </div>

              {QUARTERS.map(q => {
                const qGoals = grouped[y][q];
                if (!qGoals.length) return null;
                return (
                  <div key={q} style={{ marginBottom: 12, paddingLeft: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.ac, display: 'inline-block' }} />
                      Q{q} ({qGoals.length})
                    </div>
                    {qGoals.map(goal =>
                      editGoal?.id === goal.id ? (
                        <GoalForm key={goal.id} initial={editGoal} onSave={updateGoal} onCancel={() => setEditGoal(null)} />
                      ) : (
                        <GoalRow
                          key={goal.id} goal={goal} currentUser={currentUser}
                          azubis={azubis} isAusbilder={isAusbilder}
                          onUpdate={updateGoal} onDelete={deleteGoal} onEdit={setEditGoal}
                        />
                      )
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
