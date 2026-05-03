import { useState } from "react";
import { C, uid, fmtDate } from '../../lib/utils.js';
import { Avatar, Modal, Field } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';

const MONTHS    = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_FULL = ['Mo','Di','Mi','Do','Fr'];

const getMonday = (dt) => {
  const d = new Date(dt);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (dt, n) => { const d = new Date(dt); d.setDate(d.getDate() + n); return d; };
const fmtShort = dt => `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`;

const EV_TYPES = {
  event:       { label: 'Termin',      color: C.ac,      bg: C.acd         },
  deadline:    { label: 'Deadline',    color: C.cr,      bg: C.crd         },
  reminder:    { label: 'Erinnerung',  color: C.yw,      bg: C.ywd         },
  hospitation: { label: 'Hospitation', color: '#a371f7', bg: '#a371f720'   },
  meeting:     { label: 'Besprechung', color: '#f78166', bg: '#f7816620'   },
  schoolday:   { label: 'Schultag',    color: '#3fb950', bg: '#3fb95018'   },
};

export function CalendarView({ projects, calendarEvents, users, onUpdate, showToast }) {
  const [date,      setDate]     = useState(new Date());
  const [viewMode,  setViewMode] = useState('month');
  const [newEvDay,  setNewEvDay] = useState(null);
  const [editEv,    setEditEv]   = useState(null);
  const [editForm,  setEditForm] = useState(null);
  const [confirmDel,setConfirmDel]=useState(null);
  const [hovDay,    setHovDay]   = useState(null);
  const [form,      setForm]     = useState({ title: '', note: '', projectId: '', type: 'event' });

  const y = date.getFullYear(), m = date.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const allDays     = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const weekday   = d => new Date(y, m, d).getDay();
  const isWeekday = d => weekday(d) >= 1 && weekday(d) <= 5;
  const workdays  = allDays.filter(isWeekday);

  const monday = getMonday(date);
  const weekDates = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

  function buildCalendar() {
    const rows = [];
    let row = [null, null, null, null, null];
    workdays.forEach(d => {
      const wd = weekday(d) - 1;
      row[wd] = d;
      if (wd === 4) { rows.push(row); row = [null, null, null, null, null]; }
    });
    if (row.some(x => x !== null)) rows.push(row);
    return rows;
  }
  const weeks = buildCalendar();

  const openEdit = (ev, e) => {
    e.stopPropagation();
    const isDerived = ev.id?.startsWith('dl-') || ev._project;
    if (isDerived && ev.id?.startsWith('dl-')) return;
    setEditEv(ev);
    setEditForm({ title: ev.title, note: ev.note || '', projectId: ev.projectId || '', type: ev.type || 'event' });
  };

  const saveEdit = () => {
    if (!editForm.title.trim() || !editEv) return;
    const updated = { ...editEv, ...editForm, title: editForm.title.trim() };
    if (editEv.projectId && !editForm.projectId) {
      const p = projects.find(x => x.id === editEv.projectId);
      if (p) onUpdate(p.id, { calendarEvents: (p.calendarEvents || []).filter(e => e.id !== editEv.id) });
      onUpdate('_cal', { ev: { ...updated, projectId: null } });
    } else if (editForm.projectId && editForm.projectId !== editEv.projectId) {
      if (editEv.projectId) {
        const p = projects.find(x => x.id === editEv.projectId);
        if (p) onUpdate(p.id, { calendarEvents: (p.calendarEvents || []).filter(e => e.id !== editEv.id) });
      } else {
        onUpdate('_cal_del', { id: editEv.id });
      }
      const np = projects.find(x => x.id === editForm.projectId);
      if (np) onUpdate(np.id, { calendarEvents: [...(np.calendarEvents || []), { ...updated, projectId: editForm.projectId }] });
    } else if (editEv.projectId) {
      const p = projects.find(x => x.id === editEv.projectId);
      if (p) onUpdate(p.id, { calendarEvents: (p.calendarEvents || []).map(e => e.id === editEv.id ? updated : e) });
    } else {
      onUpdate('_cal_edit', { ev: updated });
    }
    setEditEv(null); setEditForm(null);
    showToast('✓ Termin gespeichert');
  };

  const deleteEvent = (ev) => {
    if (ev.projectId) {
      const p = projects.find(x => x.id === ev.projectId);
      if (p) onUpdate(p.id, { calendarEvents: (p.calendarEvents || []).filter(e => e.id !== ev.id) });
    } else {
      onUpdate('_cal_del', { id: ev.id });
    }
    setEditEv(null); setEditForm(null); setConfirmDel(null);
    showToast('Termin gelöscht');
  };

  const allEv = [
    ...(calendarEvents || []),
    ...projects.flatMap(p => [
      p.deadline ? [{ id: `dl-${p.id}`, date: p.deadline, title: `📌 ${p.title}`, projectId: p.id, type: 'deadline', _project: p.title }] : [],
      ...(p.calendarEvents || []).map(e => ({ ...e, _project: p.title })),
    ].flat()),
  ];

  const dayStr       = d => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const eventsForDay = d => allEv.filter(e => e.date === dayStr(d));

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
    const ds = typeof newEvDay === 'object' ? newEvDay.date : dayStr(newEvDay);
    const ev = { id: uid(), date: ds, title: form.title.trim(), note: form.note, projectId: form.projectId || null, type: form.type };
    if (form.projectId) {
      const p = projects.find(x => x.id === form.projectId);
      if (p) onUpdate(p.id, { calendarEvents: [...(p.calendarEvents || []), ev] });
    } else {
      onUpdate('_cal', { ev });
    }
    setNewEvDay(null);
    setForm({ title: '', note: '', projectId: '', type: 'event' });
    showToast('✓ Termin gespeichert');
  }

  const now     = new Date();
  const isToday = d => d && now.getDate() === d && now.getMonth() === m && now.getFullYear() === y;
  const KW      = d => {
    const dt = new Date(y, m, d);
    const startOfYear = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  };

  const isWeekMode = viewMode === 'week';
  const mondayKW = (() => {
    const dt = monday;
    const startOfYear = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  })();
  const weekLabel = isWeekMode
    ? `KW ${mondayKW} · ${fmtShort(monday)} – ${fmtShort(addDays(monday, 4))}.${addDays(monday, 4).getFullYear()}`
    : null;

  return (
    <main style={{ padding: 22, overflow: 'auto', flex: 1 }} className="anim">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>
          {isWeekMode
            ? <span>{weekLabel}</span>
            : <time dateTime={`${y}-${m+1}`}>{MONTHS[m]} {y}</time>
          }
          <span style={{ fontSize: 12, color: C.mu, fontWeight: 400, marginLeft: 10 }}>Mo – Fr</span>
        </h1>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: C.sf2, border: `1px solid ${C.bd2}`, borderRadius: 7, overflow: 'hidden' }}>
            {['month','week'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', background: viewMode === mode ? C.ac : 'transparent', color: viewMode === mode ? '#fff' : C.mu, transition: 'all .15s' }}>
                {mode === 'month' ? '☰ Monat' : '▦ Woche'}
              </button>
            ))}
          </div>
          {isWeekMode ? (
            <>
              <button className="btn" onClick={() => setDate(d => addDays(d, -7))} aria-label="Vorherige Woche">← Zurück</button>
              <button className="btn" onClick={() => setDate(new Date())} aria-label="Heute">Heute</button>
              <button className="btn" onClick={() => setDate(d => addDays(d, 7))} aria-label="Nächste Woche">Weiter →</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => setDate(new Date(y,m-1,1))} aria-label="Vorheriger Monat">← Zurück</button>
              <button className="btn" onClick={() => setDate(new Date())} aria-label="Heute">Heute</button>
              <button className="btn" onClick={() => setDate(new Date(y,m+1,1))} aria-label="Nächster Monat">Weiter →</button>
            </>
          )}
        </div>
      </div>

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

      <div style={{ background: C.bd, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.bd}` }} role="grid">
        <div role="row" style={{ display: 'grid', gridTemplateColumns: '40px repeat(5,1fr)', borderBottom: `1px solid ${C.bd}` }}>
          <div style={{ background: C.sf, padding: 8 }} />
          {DAYS_FULL.map((d, i) => (
            <div key={d} role="columnheader"
              style={{ background: C.sf, padding: '9px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8 }}>
              {d}{isWeekMode && <span style={{ fontWeight: 400, color: C.mu, marginLeft: 5 }}>{fmtShort(weekDates[i])}</span>}
            </div>
          ))}
        </div>

        {isWeekMode ? (
          <div role="row" style={{ display: 'grid', gridTemplateColumns: '40px repeat(5,1fr)', gap: 1, background: C.bd }}>
            <div style={{ background: C.sf, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 9, color: C.mu, fontFamily: C.mono, fontWeight: 700, textAlign: 'center', whiteSpace: 'pre' }}>
                {`KW\n${mondayKW}`}
              </span>
            </div>
            {weekDates.map((dt, di) => {
              const ds     = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
              const ev     = allEv.filter(e => e.date === ds);
              const today_ = dt.toDateString() === new Date().toDateString();
              const workers = [];
              projects.forEach(p => {
                p.tasks?.forEach(t => {
                  if ((t.status === 'in_progress' || t.deadline === ds) && t.assignee) {
                    const u = users?.find(u => u.id === t.assignee);
                    if (u && !workers.find(a => a.id === u.id)) workers.push({ ...u, taskText: t.text, taskStatus: t.status });
                  }
                });
              });
              const day = dt.getDate();
              return (
                <div key={di} role="gridcell" tabIndex={0}
                  style={{ background: today_ ? '#0b1624' : C.sf2, minHeight: 200, padding: 8, cursor: 'pointer', transition: 'background .12s', position: 'relative', borderLeft: today_ ? `2px solid ${C.ac}` : 'none', outline: 'none' }}
                  onClick={() => { setNewEvDay({ date: ds, label: `${String(day).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}` }); setForm({ title: '', note: '', projectId: '', type: 'event' }); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNewEvDay({ date: ds, label: `${String(day).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}` }); setForm({ title: '', note: '', projectId: '', type: 'event' }); } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: today_ ? C.ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: today_ ? 12 : 11, fontWeight: today_ ? 800 : 500, color: today_ ? '#fff' : C.mu }}>{day}</div>
                    {workers.length > 0 && <div style={{ display: 'flex' }}>{workers.slice(0,3).map((w,i) => <div key={w.id} style={{ marginLeft: i>0?-4:0, width:7, height:7, borderRadius:'50%', background: w.taskStatus==='in_progress'?C.gr:C.yw, border:`1px solid ${C.sf2}` }} />)}</div>}
                  </div>
                  {ev.map(e => {
                    const et = EV_TYPES[e.type] || EV_TYPES.event;
                    const editable = !e.id?.startsWith('dl-');
                    return (
                      <div key={e.id} onClick={editable ? ev2 => openEdit(e, ev2) : undefined}
                        style={{ fontSize: 10, fontWeight: 600, color: et.color, background: et.bg, borderRadius: 4, padding: '3px 6px', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: `1px solid ${et.color}30`, cursor: editable ? 'pointer' : 'default' }}>
                        {e.title}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          weeks.map((week, wi) => (
            <div key={wi} role="row" style={{ display: 'grid', gridTemplateColumns: '40px repeat(5,1fr)', gap: 1, background: C.bd }}>
              <div style={{ background: C.sf, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 9, color: C.mu, fontFamily: C.mono, fontWeight: 700, textAlign: 'center', whiteSpace: 'pre' }}>
                  {week.find(d => d) ? `KW\n${KW(week.find(d=>d))}` : ''}
                </span>
              </div>
              {week.map((day, di) => {
                const ev      = day ? eventsForDay(day) : [];
                const today_  = isToday(day);
                const workers = day ? activeWorkersOnDay(day) : [];
                const isHov   = hovDay === day;
                return (
                  <div key={di} role="gridcell" tabIndex={day ? 0 : -1}
                    style={{ background: !day ? C.sf + '60' : today_ ? '#0b1624' : C.sf2, minHeight: 92, padding: 7, cursor: day ? 'pointer' : 'default', transition: 'background .12s', position: 'relative', borderLeft: today_ ? `2px solid ${C.ac}` : 'none', outline: 'none' }}
                    onClick={() => { if (day) { setNewEvDay(day); setForm({ title: '', note: '', projectId: '', type: 'event' }); } }}
                    onMouseEnter={() => { if (day) setHovDay(day); }}
                    onMouseLeave={() => setHovDay(null)}
                    onKeyDown={e => { if (day && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setNewEvDay(day); } }}>
                    {day && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: today_ ? C.ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: today_ ? 12 : 11, fontWeight: today_ ? 800 : 500, color: today_ ? '#fff' : C.mu }}>
                            {day}
                          </div>
                          {workers.length > 0 && (
                            <div style={{ display: 'flex' }}>
                              {workers.slice(0, 3).map((w, i) => (
                                <div key={w.id} style={{ marginLeft: i > 0 ? -4 : 0 }}>
                                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: w.taskStatus === 'in_progress' ? C.gr : C.yw, border: `1px solid ${C.sf2}` }} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {ev.slice(0, 3).map(e => {
                          const et = EV_TYPES[e.type] || EV_TYPES.event;
                          const editable = !e.id?.startsWith('dl-');
                          return (
                            <div key={e.id} onClick={editable ? ev2 => openEdit(e, ev2) : undefined}
                              style={{ fontSize: 9, fontWeight: 600, color: et.color, background: et.bg, borderRadius: 4, padding: '2px 5px', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: `1px solid ${et.color}30`, cursor: editable ? 'pointer' : 'default' }}>
                              {e.title}
                            </div>
                          );
                        })}
                        {ev.length > 3 && <div style={{ fontSize: 9, color: C.mu }}>+{ev.length - 3} weitere</div>}
                        {isHov && workers.length > 0 && (
                          <div style={{ position: 'absolute', bottom: '100%', left: 0, zIndex: 10, background: C.sf, border: `1px solid ${C.bd2}`, borderRadius: 8, padding: '8px 10px', minWidth: 160, boxShadow: '0 4px 20px rgba(0,0,0,.6)', pointerEvents: 'none' }}>
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
          ))
        )}
      </div>

      {newEvDay && (
        <Modal title={`Neuer Termin — ${typeof newEvDay === 'object' ? newEvDay.label : `${String(newEvDay).padStart(2,'0')}.${String(m+1).padStart(2,'0')}.${y}`}`} onClose={() => setNewEvDay(null)}>
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

      {editEv && editForm && (
        <Modal title="Termin bearbeiten" onClose={() => { setEditEv(null); setEditForm(null); }}>
          <div style={{ fontSize: 11, color: C.mu, marginBottom: 12 }}>
            {editEv.date} {editEv._project && <span style={{ color: C.ac }}>· {editEv._project}</span>}
          </div>
          <Field label="Typ">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {Object.entries(EV_TYPES).map(([k, v]) => (
                <button key={k} onClick={() => setEditForm(f => ({ ...f, type: k }))}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${editForm.type === k ? v.color : C.bd2}`, background: editForm.type === k ? v.bg : C.sf2, color: editForm.type === k ? v.color : C.mu, cursor: 'pointer', transition: 'all .15s' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Titel">
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit()} />
          </Field>
          <Field label="Projekt verknüpfen (optional)">
            <select value={editForm.projectId} onChange={e => setEditForm(f => ({ ...f, projectId: e.target.value }))}>
              <option value="">— Kein Projekt —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Notiz">
            <textarea value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="Weitere Infos…" />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="abtn" onClick={saveEdit} style={{ flex: 1, padding: 11 }} disabled={!editForm.title.trim()}>Speichern</button>
            <button onClick={() => setConfirmDel(editEv)} style={{ padding: '11px 16px', borderRadius: 8, background: C.crd, border: `1px solid ${C.cr}40`, color: C.cr, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Löschen</button>
          </div>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          message={`Termin „${confirmDel.title}" wirklich löschen?`}
          onConfirm={() => deleteEvent(confirmDel)}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </main>
  );
}

export default CalendarView;
