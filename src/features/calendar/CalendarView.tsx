import { useState } from "react";
import { C, uid } from '../../lib/utils.js';
import { Avatar, Modal, Field } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import type { Project, User, CalendarEvent, Task } from '../../types';

// Kalender-Eintrag wie im allEv-Aggregat: CalendarEvent + abgeleitete Marker-Felder
type CalEvent = CalendarEvent & { _project?: string; _isTaskDeadline?: boolean };
// In der UI verwendete Typ-Codes (breiter als das CalendarEvent-Enum)
type EvForm = { title: string; note: string; projectId: string; type: string };
// Azubi mit Task-Kontext für Hover/Marker
type Worker = User & { taskText?: string; taskStatus?: string };

const MONTHS    = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const DAYS_FULL = ['Mo','Di','Mi','Do','Fr'];

const getMonday = (dt: Date | string | number) => {
  const d = new Date(dt);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
};
const addDays = (dt: Date | string | number, n: number) => { const d = new Date(dt); d.setDate(d.getDate() + n); return d; };
const fmtShort = (dt: Date) => `${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}`;

const EV_TYPES: Record<string, { label: string; color: string; bg: string }> = {
  event:       { label: 'Termin',      color: C.ac,      bg: C.acd         },
  deadline:    { label: 'Deadline',    color: C.cr,      bg: C.crd         },
  reminder:    { label: 'Erinnerung',  color: C.yw,      bg: C.ywd         },
  hospitation: { label: 'Hospitation', color: '#a371f7', bg: '#a371f720'   },
  meeting:     { label: 'Besprechung', color: '#f78166', bg: '#f7816620'   },
  schoolday:   { label: 'Schultag',    color: '#3fb950', bg: '#3fb95018'   },
};

type CalendarViewProps = {
  projects: Project[];
  calendarEvents: CalendarEvent[];
  users: User[];
  onUpdate: (id: any, patch: any) => void;
  showToast: (msg: string) => void;
  canEdit?: boolean;   // Mentor = read-only: keine Termine anlegen/bearbeiten/löschen
};

export function CalendarView({ projects, calendarEvents, users, onUpdate, showToast, canEdit = true }: CalendarViewProps) {
  const [date,      setDate]     = useState<Date>(new Date());
  const [viewMode,  setViewMode] = useState<string>('month');
  const [newEvDay,  setNewEvDay] = useState<number | { date: string; label: string } | null>(null);
  const [editEv,    setEditEv]   = useState<CalEvent | null>(null);
  const [editForm,  setEditForm] = useState<EvForm | null>(null);
  const [confirmDel,setConfirmDel]=useState<CalEvent | null>(null);
  const [hovDay,    setHovDay]   = useState<number | null>(null);
  const [form,      setForm]     = useState<EvForm>({ title: '', note: '', projectId: '', type: 'event' });

  const y = date.getFullYear(), m = date.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const allDays     = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const weekday   = (d: number) => new Date(y, m, d).getDay();
  const isWeekday = (d: number) => weekday(d) >= 1 && weekday(d) <= 5;
  const workdays  = allDays.filter(isWeekday);

  const monday = getMonday(date);
  const weekDates = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

  function buildCalendar() {
    const rows: (number | null)[][] = [];
    let row: (number | null)[] = [null, null, null, null, null];
    workdays.forEach(d => {
      const wd = weekday(d) - 1;
      row[wd] = d;
      if (wd === 4) { rows.push(row); row = [null, null, null, null, null]; }
    });
    if (row.some(x => x !== null)) rows.push(row);
    return rows;
  }
  const weeks = buildCalendar();

  // Neuer-Termin-Modal öffnen — read-only (Mentor) gibt nur Feedback, kein Modal.
  const startNew = (dayInfo: number | { date: string; label: string }) => {
    if (!canEdit) { showToast('🔒 Mentoren haben nur Lesezugriff'); return; }
    setNewEvDay(dayInfo);
    setForm({ title: '', note: '', projectId: '', type: 'event' });
  };

  const openEdit = (ev: CalEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;   // Mentor: read-only, kein Bearbeiten-Modal
    const isDerived = (ev.id as any)?.startsWith('dl-') || (ev.id as any)?.startsWith('tdl-') || ev._project;
    if (isDerived && ((ev.id as any)?.startsWith('dl-') || (ev.id as any)?.startsWith('tdl-'))) return;
    setEditEv(ev);
    setEditForm({ title: ev.title, note: ev.note || '', projectId: (ev.projectId as string) || '', type: ev.type || 'event' });
  };

  const saveEdit = () => {
    if (!canEdit) return;
    if (!editForm || !editForm.title.trim() || !editEv) return;
    const updated = { ...editEv, ...editForm, title: editForm.title.trim() };
    if (editEv.projectId && !editForm.projectId) {
      const p = projects.find(x => x.id === editEv.projectId);
      if (p) onUpdate(p.id, { calendarEvents: ((p as any).calendarEvents || []).filter((e: CalEvent) => e.id !== editEv.id) });
      onUpdate('_cal', { ev: { ...updated, projectId: null } });
    } else if (editForm.projectId && editForm.projectId !== editEv.projectId) {
      if (editEv.projectId) {
        const p = projects.find(x => x.id === editEv.projectId);
        if (p) onUpdate(p.id, { calendarEvents: ((p as any).calendarEvents || []).filter((e: CalEvent) => e.id !== editEv.id) });
      } else {
        onUpdate('_cal_del', { id: editEv.id });
      }
      const np = projects.find(x => x.id === editForm!.projectId);
      if (np) onUpdate(np.id, { calendarEvents: [...((np as any).calendarEvents || []), { ...updated, projectId: editForm.projectId }] });
    } else if (editEv.projectId) {
      const p = projects.find(x => x.id === editEv.projectId);
      if (p) onUpdate(p.id, { calendarEvents: ((p as any).calendarEvents || []).map((e: CalEvent) => e.id === editEv.id ? updated : e) });
    } else {
      onUpdate('_cal_edit', { ev: updated });
    }
    setEditEv(null); setEditForm(null);
    showToast('✓ Termin gespeichert');
  };

  const deleteEvent = (ev: CalEvent) => {
    if (!canEdit) return;
    if (ev.projectId) {
      const p = projects.find(x => x.id === ev.projectId);
      if (p) onUpdate(p.id, { calendarEvents: ((p as any).calendarEvents || []).filter((e: CalEvent) => e.id !== ev.id) });
    } else {
      onUpdate('_cal_del', { id: ev.id });
    }
    setEditEv(null); setEditForm(null); setConfirmDel(null);
    showToast('Termin gelöscht');
  };

  const allEv: CalEvent[] = [
    ...(calendarEvents || []),
    ...projects.flatMap(p => [
      p.deadline ? [{ id: `dl-${p.id}`, date: p.deadline, title: `📌 ${p.title}`, projectId: p.id, type: 'deadline', _project: p.title }] : [],
      ...((p as any).calendarEvents || []).map((e: CalEvent) => ({ ...e, _project: p.title })),
      ...(p.tasks || [])
        .filter((t: Task) => t.deadline && t.status !== 'done' && t.text)
        .map((t: Task) => ({ id: `tdl-${t.id}`, date: t.deadline, title: `⚡ ${t.text}`, projectId: p.id, type: 'deadline', _project: p.title, _isTaskDeadline: true })),
    ].flat()),
  ] as CalEvent[];

  const dayStr       = (d: number) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const eventsForDay = (d: number) => allEv.filter(e => e.date === dayStr(d));

  const activeWorkersOnDay = (d: number) => {
    const ds = dayStr(d);
    const active: Worker[] = [];
    projects.forEach(p => {
      p.tasks?.forEach((t: Task) => {
        if ((t.status === 'in_progress' || t.deadline === ds) && t.assignee) {
          const u = users?.find(u => u.id === t.assignee);
          if (u && !active.find(a => a.id === u.id)) active.push({ ...u, taskText: t.text, taskStatus: t.status });
        }
      });
    });
    return active;
  };

  function addEvent() {
    if (!canEdit) return;
    if (!form.title.trim()) return;
    const ds = typeof newEvDay === 'object' ? (newEvDay as { date: string; label: string }).date : dayStr(newEvDay);
    const ev = { id: uid(), date: ds, title: form.title.trim(), note: form.note, projectId: form.projectId || null, type: form.type };
    if (form.projectId) {
      const p = projects.find(x => x.id === form.projectId);
      if (p) onUpdate(p.id, { calendarEvents: [...((p as any).calendarEvents || []), ev] });
    } else {
      onUpdate('_cal', { ev });
    }
    setNewEvDay(null);
    setForm({ title: '', note: '', projectId: '', type: 'event' });
    showToast('✓ Termin gespeichert');
  }

  const now     = new Date();
  const isToday = (d: number | null) => d && now.getDate() === d && now.getMonth() === m && now.getFullYear() === y;
  const KW      = (d: number) => {
    const dt = new Date(y, m, d);
    const startOfYear = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  };

  const exportIcal = () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toIcsDate = (dateStr: string) => dateStr.replace(/-/g, '');
    const nextDay = (dateStr: string) => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    };
    const escapeIcs = (str: string) => (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//AzubiBoard//AzubiBoard//DE',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    allEv.forEach(ev => {
      if (!ev.date) return;
      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${ev.id || uid()}@azubiboard`);
      lines.push(`SUMMARY:${escapeIcs(ev.title)}`);
      lines.push(`DTSTART;VALUE=DATE:${toIcsDate(ev.date)}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(ev.date)}`);
      if (ev.note) lines.push(`DESCRIPTION:${escapeIcs(ev.note)}`);
      if (ev.type) lines.push(`CATEGORIES:${escapeIcs(ev.type)}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n') + '\r\n';
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = `azubiboard_kalender_${y}-${pad(m + 1)}.ics`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isWeekMode = viewMode === 'week';
  const mondayKW = (() => {
    const dt = monday;
    const startOfYear = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
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
          <button className="btn" onClick={exportIcal} aria-label="Kalender als iCal exportieren" title="Alle Termine als .ics herunterladen">📅 iCal</button>
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
              const workers: Worker[] = [];
              projects.forEach(p => {
                p.tasks?.forEach((t: Task) => {
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
                  onClick={() => startNew({ date: ds, label: `${String(day).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}` })}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startNew({ date: ds, label: `${String(day).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.${dt.getFullYear()}` }); } }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: today_ ? C.ac : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: today_ ? 12 : 11, fontWeight: today_ ? 800 : 500, color: today_ ? '#fff' : C.mu }}>{day}</div>
                    {workers.length > 0 && <div style={{ display: 'flex' }}>{workers.slice(0,3).map((w,i) => <div key={w.id} style={{ marginLeft: i>0?-4:0, width:7, height:7, borderRadius:'50%', background: w.taskStatus==='in_progress'?C.gr:C.yw, border:`1px solid ${C.sf2}` }} />)}</div>}
                  </div>
                  {ev.map(e => {
                    const et = EV_TYPES[e.type as string] || EV_TYPES.event;
                    const editable = !(e.id as any)?.startsWith('dl-') && !(e.id as any)?.startsWith('tdl-');
                    return (
                      <div key={e.id} onClick={editable ? (ev2: React.MouseEvent) => openEdit(e, ev2) : undefined}
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
                  {week.find(d => d) ? `KW\n${KW(week.find(d=>d) as number)}` : ''}
                </span>
              </div>
              {week.map((day, di) => {
                const ev      = day ? eventsForDay(day) : [];
                const today_  = isToday(day);
                const workers = day ? activeWorkersOnDay(day) : [];
                const isHov   = hovDay === day;
                return (
                  <div key={di} role="gridcell" tabIndex={day ? 0 : -1}
                    style={{ background: !day ? 'var(--c-sf3)' : today_ ? 'var(--c-acd)' : C.sf2, minHeight: 92, padding: 7, cursor: day ? 'pointer' : 'default', transition: 'background .12s', position: 'relative', borderLeft: today_ ? `2px solid ${C.ac}` : 'none', outline: 'none' }}
                    onClick={() => { if (day) startNew(day); }}
                    onMouseEnter={() => { if (day) setHovDay(day); }}
                    onMouseLeave={() => setHovDay(null)}
                    onKeyDown={e => { if (day && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); startNew(day); } }}>
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
                          const et = EV_TYPES[e.type as string] || EV_TYPES.event;
                          const editable = !(e.id as any)?.startsWith('dl-') && !(e.id as any)?.startsWith('tdl-');
                          return (
                            <div key={e.id} onClick={editable ? (ev2: React.MouseEvent) => openEdit(e, ev2) : undefined}
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
                <button key={k} onClick={() => setEditForm(f => ({ ...f!, type: k }))}
                  style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, border: `1px solid ${editForm.type === k ? v.color : C.bd2}`, background: editForm.type === k ? v.bg : C.sf2, color: editForm.type === k ? v.color : C.mu, cursor: 'pointer', transition: 'all .15s' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Titel">
            <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f!, title: e.target.value }))} autoFocus onKeyDown={e => e.key === 'Enter' && saveEdit()} />
          </Field>
          <Field label="Projekt verknüpfen (optional)">
            <select value={editForm.projectId} onChange={e => setEditForm(f => ({ ...f!, projectId: e.target.value }))}>
              <option value="">— Kein Projekt —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="Notiz">
            <textarea value={editForm.note} onChange={e => setEditForm(f => ({ ...f!, note: e.target.value }))} placeholder="Weitere Infos…" />
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
