import { useState } from "react";
import { C, uid, today, fmtDate } from './utils.js';
import { Avatar, Modal, Field, EmptyState } from './Components.jsx';

const MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_FULL = ['Mo','Di','Mi','Do','Fr']; // Nur Werktage

// Eventtypen mit Farben
const EV_TYPES = {
  event:       { label: 'Termin',          color: C.ac,    bg: C.acd },
  deadline:    { label: 'Deadline',        color: C.cr,    bg: C.crd },
  reminder:    { label: 'Erinnerung',      color: C.yw,    bg: C.ywd },
  hospitation: { label: 'Hospitation',     color: '#a371f7', bg: '#a371f720' },
  meeting:     { label: 'Besprechung',     color: '#f78166', bg: '#f7816620' },
  schoolday:   { label: 'Schultag',        color: '#3fb950', bg: '#3fb95018' },
};

// ── Calendar ──────────────────────────────────────────────────
export function CalendarView({ projects, calendarEvents, users, onUpdate, showToast }) {
  const [date, setDate]       = useState(new Date());
  const [newEvDay, setNewEvDay] = useState(null);
  const [hovDay, setHovDay]   = useState(null);
  const [form, setForm]       = useState({ title: '', note: '', projectId: '', type: 'event' });

  const y = date.getFullYear(), m = date.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  // Alle Tage des Monats als Array
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Wochentag eines Tages berechnen (0=So,1=Mo,...,6=Sa)
  const weekday = d => new Date(y, m, d).getDay();
  // Nur Werktage (Mo=1 bis Fr=5)
  const isWeekday = d => weekday(d) >= 1 && weekday(d) <= 5;
  const workdays = allDays.filter(isWeekday);

  // Erste Woche: welcher Wochentag ist der 1.?
  // Wir bauen ein Raster Mo-Fr pro Woche auf
  function buildCalendar() {
    const rows = [];
    let row = [null, null, null, null, null]; // Mo–Fr
    workdays.forEach(d => {
      const wd = weekday(d) - 1; // Mo=0..Fr=4
      row[wd] = d;
      if (wd === 4) { rows.push(row); row = [null, null, null, null, null]; }
    });
    if (row.some(x => x !== null)) rows.push(row);
    return rows;
  }
  const weeks = buildCalendar();

  // Alle Events zusammenführen
  const allEv = [
    ...(calendarEvents || []),
    ...projects.flatMap(p => [
      p.deadline ? [{ id: `dl-${p.id}`, date: p.deadline, title: `📌 ${p.title}`, projectId: p.id, type: 'deadline', _project: p.title }] : [],
      ...(p.calendarEvents || []).map(e => ({ ...e, _project: p.title })),
    ].flat()),
  ];

  const dayStr = d => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const eventsForDay = d => allEv.filter(e => e.date === dayStr(d));

  // Wer arbeitet an diesem Tag? (Aufgaben mit diesem Datum als Deadline oder aktiv)
  const activeWorkersOnDay = d => {
    const ds = dayStr(d);
    const active = [];
    projects.forEach(p => {
      p.tasks?.forEach(t => {
        if ((t.status === 'in_progress' || t.deadline === ds) && t.assignee) {
          const u = users?.find(u => u.id === t.assignee);
          if (u && !active.find(a => a.id === u.id)) active.push({ ...u, taskText: t.text, taskStatus: t.status });
        }
      });
    });
    return active;
  };

  function addEvent() {
    if (!form.title.trim()) return;
    const ds = dayStr(newEvDay);
    const ev = { id: uid(), date: ds, title: form.title.trim(), note: form.note, projectId: form.projectId || null, type: form.type };
    if (form.projectId) {
      const p = projects.find(x => x.id === form.projectId);
      if (p) onUpdate(p.id, { calendarEvents: [...(p.calendarEvents || []), ev] });
    } else {
      onUpdate('_cal', { ev });
    }
    setNewEvDay(null); setForm({ title: '', note: '', projectId: '', type: 'event' });
    showToast('✓ Termin gespeichert');
  }

  const now = new Date();
  const isToday = d => d && now.getDate() === d && now.getMonth() === m && now.getFullYear() === y;
  const KW = d => {
    const dt = new Date(y, m, d);
    const startOfYear = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  };

  return (
    <main style={{ padding: 22, overflow: 'auto', flex: 1 }} className="anim">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>
          <time dateTime={`${y}-${m+1}`}>{MONTHS[m]} {y}</time>
          <span style={{ fontSize: 12, color: C.mu, fontWeight: 400, marginLeft: 10 }}>Mo – Fr</span>
        </h1>
        <div style={{ display: 'flex', gap: 7 }}>
          <button className="btn" onClick={() => setDate(new Date(y,m-1,1))} aria-label="Vorheriger Monat">← Zurück</button>
          <button className="btn" onClick={() => setDate(new Date())} aria-label="Heute">Heute</button>
          <button className="btn" onClick={() => setDate(new Date(y,m+1,1))} aria-label="Nächster Monat">Weiter →</button>
        </div>
      </div>

      {/* Legende */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        {Object.entries(EV_TYPES).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.mu }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: v.bg, border: `1px solid ${v.color}40` }} />
            {v.label}
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: C.mu, marginLeft: 'auto' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.gr }} />
          Azubi aktiv (Hover)
        </div>
      </div>

      {/* Kalender-Raster */}
      <div style={{ background: C.bd, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.bd}` }} role="grid">
        {/* Spaltenköpfe Mo–Fr */}
        <div role="row" style={{ display: 'grid', gridTemplateColumns: '40px repeat(5,1fr)', borderBottom: `1px solid ${C.bd}` }}>
          <div style={{ background: C.sf, padding: 8 }} /> {/* KW-Spalte */}
          {DAYS_FULL.map(d => (
            <div key={d} role="columnheader"
              style={{ background: C.sf, padding: '9px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Wochen-Zeilen */}
        {weeks.map((week, wi) => (
          <div key={wi} role="row" style={{ display: 'grid', gridTemplateColumns: '40px repeat(5,1fr)', gap: 1, background: C.bd }}>
            {/* KW-Nummer */}
            <div style={{ background: C.sf, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: C.mu, fontFamily: C.mono, fontWeight: 700 }}>
                {week.find(d => d) ? `KW\n${KW(week.find(d=>d))}` : ''}
              </span>
            </div>

            {/* 5 Tageszellen */}
            {week.map((day, di) => {
              const ev = day ? eventsForDay(day) : [];
              const today_ = isToday(day);
              const workers = day ? activeWorkersOnDay(day) : [];
              const isHov = hovDay === day;

              return (
                <div key={di} role="gridcell"
                  tabIndex={day ? 0 : -1}
                  style={{
                    background: !day ? C.sf + '60' : today_ ? '#0b1624' : C.sf2,
                    minHeight: 92,
                    padding: 7,
                    cursor: day ? 'pointer' : 'default',
                    transition: 'background .12s',
                    position: 'relative',
                    borderLeft: today_ ? `2px solid ${C.ac}` : 'none',
                    outline: 'none',
                  }}
                  onClick={() => { if (day) { setNewEvDay(day); setForm({ title: '', note: '', projectId: '', type: 'event' }); } }}
                  onMouseEnter={() => { if (day) setHovDay(day); }}
                  onMouseLeave={() => setHovDay(null)}
                  onKeyDown={e => { if (day && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setNewEvDay(day); } }}>

                  {day && (
                    <>
                      {/* Tag-Nummer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: today_ ? C.ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: today_ ? 12 : 11, fontWeight: today_ ? 800 : 500, color: today_ ? '#fff' : C.mu }}>
                          {day}
                        </div>
                        {/* Aktive Azubi-Avatare (kleine Punkte) */}
                        {workers.length > 0 && (
                          <div style={{ display: 'flex', gap: -2 }}>
                            {workers.slice(0, 3).map((w, i) => (
                              <div key={w.id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: w.taskStatus === 'in_progress' ? C.gr : C.yw, border: `1px solid ${C.sf2}`, title: w.name }} />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Events */}
                      {ev.slice(0, 3).map(e => {
                        const et = EV_TYPES[e.type] || EV_TYPES.event;
                        return (
                          <div key={e.id} style={{ fontSize: 9, fontWeight: 600, color: et.color, background: et.bg, borderRadius: 4, padding: '2px 5px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: `1px solid ${et.color}30` }}>
                            {e.title}
                          </div>
                        );
                      })}
                      {ev.length > 3 && <div style={{ fontSize: 9, color: C.mu }}>+{ev.length - 3} weitere</div>}

                      {/* Hover-Overlay: aktive Arbeiter */}
                      {isHov && workers.length > 0 && (
                        <div style={{
                          position: 'absolute', bottom: '100%', left: 0, zIndex: 10,
                          background: C.sf, border: `1px solid ${C.bd2}`,
                          borderRadius: 8, padding: '8px 10px', minWidth: 160,
                          boxShadow: '0 4px 20px rgba(0,0,0,.6)',
                          pointerEvents: 'none',
                        }}>
                          <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 6 }}>Aktiv an diesem Tag</div>
                          {workers.map(w => (
                            <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <Avatar name={w.name} size={18} />
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.br }}>{w.name.split(' ')[0]}</div>
                                <div style={{ fontSize: 9, color: C.mu, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.taskText}</div>
                              </div>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: w.taskStatus === 'in_progress' ? C.gr : C.yw, flexShrink: 0 }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Neuer Termin Modal */}
      {newEvDay && (
        <Modal title={`Termin — ${String(newEvDay).padStart(2,'0')}.${String(m+1).padStart(2,'0')}.${y}`} onClose={() => setNewEvDay(null)}>
          <Field label="Typ">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(EV_TYPES).map(([k, v]) => (
                <button key={k} onClick={() => setForm(f => ({ ...f, type: k }))}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${form.type === k ? v.color : C.bd2}`, background: form.type === k ? v.bg : C.sf2, color: form.type === k ? v.color : C.mu, cursor: 'pointer', transition: 'all .15s' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Titel">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Hospitation bei Kiyan, Besprechung…" autoFocus onKeyDown={e => e.key === 'Enter' && addEvent()} />
          </Field>
          <Field label="Projekt verknüpfen (optional)">
            <select value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
              <option value="">— Kein Projekt —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Notiz" hint="Optionale Details, Ort, Ansprechpartner…">
            <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Weitere Infos…" />
          </Field>
          <button className="abtn" onClick={addEvent} style={{ width: '100%', marginTop: 4, padding: 11 }}>+ Termin speichern</button>
        </Modal>
      )}
    </main>
  );
}

// ── Groups ────────────────────────────────────────────────────
export function GroupsView({ groups, users, projects, onUpdateGroups, showToast }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'team', members: [] });
  const add = () => { if (!form.name.trim()) return; onUpdateGroups([...groups, { id: uid(), name: form.name.trim(), type: form.type, members: form.members }]); setShowNew(false); setForm({ name: '', type: 'team', members: [] }); showToast('✓ Gruppe erstellt'); };
  const remove = id => { if (!confirm('Gruppe wirklich löschen?')) return; onUpdateGroups(groups.filter(g => g.id !== id)); showToast('Gruppe gelöscht'); };
  const toggleMember = uid2 => {
    const m = form.members.includes(uid2) ? form.members.filter(x => x !== uid2) : [...form.members, uid2];
    setForm(f => ({ ...f, members: m }));
  };

  return (
    <main style={{ padding: 22, overflow: 'auto', flex: 1 }} className="anim">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Gruppen</h1>
        <button className="abtn" onClick={() => setShowNew(true)}>+ Neue Gruppe</button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="👥" title="Noch keine Gruppen" subtitle="Erstelle Teams oder Abteilungen" action="+ Gruppe erstellen" onAction={() => setShowNew(true)} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(290px,1fr))', gap: 14 }}>
          {groups.map(g => {
            const members = users.filter(u => g.members.includes(u.id));
            const gProjects = projects.filter(p => p.groupId === g.id);
            return (
              <article key={g.id} className="card" aria-label={`Gruppe: ${g.name}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 14, fontWeight: 800, color: C.br, margin: 0, marginBottom: 5 }}>{g.name}</h2>
                    <span className="tag" style={{ background: C.acd, color: C.ac, border: `1px solid ${C.ac}30` }}>
                      {g.type === 'team' ? '👥 Team' : '🏢 Abteilung'}
                    </span>
                  </div>
                  <button className="del" onClick={() => remove(g.id)} aria-label={`Gruppe ${g.name} löschen`}>×</button>
                </div>

                {/* Mitglieder mit Avataren */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8, fontWeight: 700 }}>
                    Mitglieder ({members.length})
                  </div>
                  {members.length === 0 ? (
                    <div style={{ fontSize: 11, color: C.mu, fontStyle: 'italic' }}>Keine Mitglieder</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {members.map(u => {
                        // Wie viele aktive Projekte hat dieser Azubi?
                        const activeCount = projects.filter(p => p.assignees?.includes(u.id) && p.status !== 'green').length;
                        return (
                          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 9px', background: C.sf3, borderRadius: 7, border: `1px solid ${C.bd}` }}>
                            <Avatar name={u.name} size={28} />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.br }}>{u.name}</div>
                              <div style={{ fontSize: 10, color: C.mu }}>{u.email}</div>
                            </div>
                            {activeCount > 0 && (
                              <span style={{ fontSize: 9, fontWeight: 700, background: C.acd, color: C.ac, border: `1px solid ${C.ac}30`, padding: '2px 6px', borderRadius: 5, fontFamily: C.mono }}>
                                {activeCount} Proj.
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ paddingTop: 9, borderTop: `1px solid ${C.bd}`, fontSize: 11, color: C.mu }}>
                  {gProjects.length} Projekt(e) dieser Gruppe
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Neue Gruppe Modal */}
      {showNew && (
        <Modal title="Neue Gruppe erstellen" onClose={() => setShowNew(false)}>
          <Field label="Gruppenname">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="z.B. IT-Azubis 2024" autoFocus />
          </Field>
          <Field label="Typ">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="team">👥 Team (Projektgruppe)</option>
              <option value="department">🏢 Abteilung / Jahrgang</option>
            </select>
          </Field>
          <Field label="Mitglieder auswählen">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
              {users.filter(u => u.role === 'azubi').map(u => (
                <button key={u.id} onClick={() => toggleMember(u.id)} aria-pressed={form.members.includes(u.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px', borderRadius: 8, background: form.members.includes(u.id) ? C.acd : C.sf2, border: `1px solid ${form.members.includes(u.id) ? C.ac : C.bd2}`, cursor: 'pointer', transition: 'all .15s', textAlign: 'left' }}>
                  <Avatar name={u.name} size={26} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: form.members.includes(u.id) ? C.ac : C.br }}>{u.name}</div>
                    <div style={{ fontSize: 10, color: C.mu }}>{u.email}</div>
                  </div>
                  {form.members.includes(u.id) && <span style={{ color: C.ac, fontSize: 14 }}>✓</span>}
                </button>
              ))}
            </div>
          </Field>
          <button className="abtn" onClick={add} style={{ width: '100%', marginTop: 10, padding: 11 }} disabled={!form.name.trim()}>
            Gruppe erstellen ({form.members.length} Mitglieder)
          </button>
        </Modal>
      )}
    </main>
  );
}

// ── New Project Modal ─────────────────────────────────────────
export function NewProjectModal({ users, groups, currentUser, onClose, onCreate }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '', description: '', status: 'yellow',
    assignees: [currentUser.id],
    groupId: '', startDate: today(), deadline: '',
    netzplan: { nodes: [], edges: [], unit: 'W', nodePositions: {} },
    materials: [], requirements: [], links: [],
  });
  const [err, setErr] = useState('');
  // Schritt 3: Schnelleingabe
  const [matForm, setMatForm] = useState({ name: '', qty: 1, cost: 0 });
  const [reqText, setReqText] = useState('');
  const [linkForm, setLinkForm] = useState({ url: '', title: '' });

  const u = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const toggleAssignee = id => u('assignees', form.assignees.includes(id) ? form.assignees.filter(x => x !== id) : [...form.assignees, id]);

  const addMat = () => {
    if (!matForm.name.trim()) return;
    u('materials', [...form.materials, { id: uid(), name: matForm.name.trim(), qty: Number(matForm.qty) || 1, cost: Number(matForm.cost) || 0 }]);
    setMatForm({ name: '', qty: 1, cost: 0 });
  };
  const addReq = () => {
    if (!reqText.trim()) return;
    u('requirements', [...form.requirements, { id: uid(), text: reqText.trim(), done: false }]);
    setReqText('');
  };
  const addLink = () => {
    if (!linkForm.url.trim()) return;
    const url = linkForm.url.startsWith('http') ? linkForm.url : 'https://' + linkForm.url;
    u('links', [...form.links, { id: uid(), url, title: linkForm.title.trim(), type: 'other', note: '' }]);
    setLinkForm({ url: '', title: '' });
  };

  const next = () => {
    if (step === 1 && !form.title.trim()) { setErr('Bitte einen Projekttitel eingeben.'); return; }
    setErr('');
    setStep(s => s + 1);
  };

  const submit = () => {
    onCreate({ ...form, id: uid(), tasks: [], steps: [], calendarEvents: [] });
  };

  const STEPS = ['Grunddaten', 'Zeitraum & Team', 'Details'];

  return (
    <Modal title="Neues Projekt" onClose={onClose} width={500}>

      {/* Schritt-Indikator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
        {STEPS.map((s, i) => {
          const n = i + 1;
          const done = n < step;
          const active = n === step;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: done ? C.gr : active ? C.ac : 'var(--c-sf3)', border: `2px solid ${done ? C.gr : active ? C.ac : 'var(--c-bd2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: (done || active) ? '#fff' : C.mu, transition: 'all .2s', flexShrink: 0 }}>
                  {done ? '✓' : n}
                </div>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? C.ac : done ? C.gr : C.mu, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? C.gr : 'var(--c-bd2)', margin: '0 6px', marginTop: -14, transition: 'background .3s' }} />
              )}
            </div>
          );
        })}
      </div>

      {err && <div role="alert" style={{ fontSize: 12, color: C.cr, background: C.crd, border: `1px solid ${C.cr}30`, borderRadius: 7, padding: '8px 12px', marginBottom: 14 }}>⚠ {err}</div>}

      {/* ── Schritt 1: Titel + Beschreibung ── */}
      {step === 1 && (
        <div style={{ animation: 'fadeUp .15s ease', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Projekttitel *</label>
            <input value={form.title} onChange={e => u('title', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && next()}
              placeholder="z.B. Weboberfläche Azubi-Verwaltung"
              autoFocus style={{ fontSize: 15, padding: '10px 13px', fontWeight: 600 }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Beschreibung</label>
            <textarea value={form.description} onChange={e => u('description', e.target.value)}
              placeholder="Was soll in diesem Projekt erreicht werden?"
              style={{ minHeight: 100, fontSize: 13, lineHeight: 1.65 }} />
          </div>
        </div>
      )}

      {/* ── Schritt 2: Datum + Gruppe + Azubis ── */}
      {step === 2 && (
        <div style={{ animation: 'fadeUp .15s ease', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Datum */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Startdatum</label>
              <input type="date" value={form.startDate} onChange={e => u('startDate', e.target.value)} style={{ fontSize: 13 }} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Deadline</label>
              <input type="date" value={form.deadline} onChange={e => u('deadline', e.target.value)} style={{ fontSize: 13 }} />
            </div>
          </div>

          {/* Gruppe */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 7, display: 'block' }}>Gruppe (optional)</label>
            <select value={form.groupId} onChange={e => u('groupId', e.target.value)} style={{ fontSize: 13 }}>
              <option value="">— Keine Gruppe —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {/* Azubis */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 9, display: 'block' }}>Azubis zuweisen</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {users.filter(u2 => u2.role === 'azubi').map(u2 => {
                const sel = form.assignees.includes(u2.id);
                return (
                  <button key={u2.id} onClick={() => toggleAssignee(u2.id)} aria-pressed={sel}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 13px', borderRadius: 10, background: sel ? C.acd : 'var(--c-sf2)', border: `2px solid ${sel ? C.ac : 'var(--c-bd2)'}`, cursor: 'pointer', transition: 'all .12s', textAlign: 'left' }}>
                    <Avatar name={u2.name} size={34} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: sel ? C.ac : C.br }}>{u2.name}</div>
                      <div style={{ fontSize: 10, color: C.mu }}>{u2.email} · LJ {u2.apprenticeship_year || 1}</div>
                    </div>
                    <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? C.ac : 'var(--c-bd2)'}`, background: sel ? C.ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: '#fff', transition: 'all .12s' }}>
                      {sel ? '✓' : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Schritt 3: Material + Anforderungen + Links (kompakt) ── */}
      {step === 3 && (
        <div style={{ animation: 'fadeUp .15s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: 12, color: C.mu, margin: 0 }}>Optional — alles kann auch später im Projekt hinzugefügt werden.</p>

          {/* Material */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'block' }}>
              Material <span style={{ color: C.mu, fontWeight: 400, fontSize: 10 }}>({form.materials.length})</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 55px 75px auto', gap: 6, marginBottom: 6 }}>
              <input value={matForm.name} onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addMat()} placeholder="Bezeichnung…" style={{ fontSize: 12 }} />
              <input type="number" min="1" value={matForm.qty} onChange={e => setMatForm(f => ({ ...f, qty: e.target.value }))} style={{ fontSize: 12 }} />
              <input type="number" min="0" step="0.01" value={matForm.cost} onChange={e => setMatForm(f => ({ ...f, cost: e.target.value }))} placeholder="€" style={{ fontSize: 12 }} />
              <button className="abtn" onClick={addMat} style={{ padding: '6px 10px', fontSize: 11 }}>+</button>
            </div>
            {form.materials.length > 0 && form.materials.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.mu, padding: '3px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                <span style={{ flex: 1, color: C.tx }}>{m.name}</span>
                <span style={{ fontFamily: C.mono }}>{m.qty}× · {(m.qty * m.cost).toFixed(2)} €</span>
                <button className="del" onClick={() => u('materials', form.materials.filter(x => x.id !== m.id))} style={{ fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>

          {/* Anforderungen */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'block' }}>
              Anforderungen <span style={{ color: C.mu, fontWeight: 400, fontSize: 10 }}>({form.requirements.length})</span>
            </label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input value={reqText} onChange={e => setReqText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addReq()} placeholder="Anforderung hinzufügen…" style={{ flex: 1, fontSize: 12 }} />
              <button className="abtn" onClick={addReq} style={{ padding: '6px 10px', fontSize: 11 }}>+</button>
            </div>
            {form.requirements.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.gr, flexShrink: 0 }} />
                <span style={{ flex: 1, color: C.tx }}>{r.text}</span>
                <button className="del" onClick={() => u('requirements', form.requirements.filter(x => x.id !== r.id))} style={{ fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>

          {/* Links */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 7, display: 'block' }}>
              Links <span style={{ color: C.mu, fontWeight: 400, fontSize: 10 }}>({form.links.length})</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 6, marginBottom: 6 }}>
              <input value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="URL…" style={{ fontSize: 12 }} />
              <input value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))} placeholder="Titel (optional)" style={{ fontSize: 12 }} />
              <button className="abtn" onClick={addLink} style={{ padding: '6px 10px', fontSize: 11 }}>+</button>
            </div>
            {form.links.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '3px 0', borderBottom: `1px solid var(--c-bd)22` }}>
                <span style={{ fontSize: 10, color: C.ac }}>🔗</span>
                <span style={{ flex: 1, color: C.ac, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title || l.url}</span>
                <button className="del" onClick={() => u('links', form.links.filter(x => x.id !== l.id))} style={{ fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 9, marginTop: 22 }}>
        {step > 1 && (
          <button className="btn" onClick={() => setStep(s => s - 1)} style={{ padding: '11px 16px', fontSize: 13 }}>← Zurück</button>
        )}
        {step < 3 ? (
          <button className="abtn" onClick={next} style={{ flex: 1, padding: 12, fontSize: 14, justifyContent: 'center', fontWeight: 800 }}>
            Weiter →
          </button>
        ) : (
          <button className="abtn" onClick={submit} style={{ flex: 1, padding: 12, fontSize: 14, justifyContent: 'center', fontWeight: 800, background: C.gr }}>
            ✓ Projekt erstellen
          </button>
        )}
        {step === 1 && (
          <button className="btn" onClick={onClose} style={{ padding: '11px 16px' }}>Abbrechen</button>
        )}
      </div>
    </Modal>
  );
}
