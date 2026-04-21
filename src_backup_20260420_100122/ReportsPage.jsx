import { useState, useRef } from "react";
import { C, uid, today, fmtDate } from './utils.js';
import { Avatar, Field, EmptyState } from './Components.jsx';
import {
  IcoReport, IcoCheck, IcoEdit, IcoPlus, IcoBack,
  IcoDoc, IcoNote, IcoAlert, IcoUsers, IcoClock,
  IcoStar, IcoChevron
} from './Icons.jsx';

// ── Hilfsfunktionen ───────────────────────────────────────────
const STATUS_REPORT = {
  draft:     { l: 'Entwurf',        c: C.mu,  bg: 'var(--c-sf2)' },
  submitted: { l: 'Eingereicht',    c: C.ac,  bg: C.acd          },
  reviewed:  { l: 'Geprüft',        c: C.yw,  bg: C.ywd          },
  signed:    { l: 'Unterschrieben', c: C.gr,  bg: '#07130a'      },
};

function getMonday(d = new Date()) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
  return dt.toISOString().split('T')[0];
}

function getKW(dateStr) {
  const d = new Date(dateStr);
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
}

// ── Berichtsheft-Vorlagen ─────────────────────────────────────
const TEMPLATES = [
  {
    label: 'Standard',
    activities: `Montag:\n- \n\nDienstag:\n- \n\nMittwoch:\n- \n\nDonnerstag:\n- \n\nFreitag:\n- `,
    learnings:  `Was ich diese Woche gelernt habe:\n- \n\nSchwierigkeiten:\n- `,
  },
  {
    label: 'Projekt',
    activities: `Projekttitel: \n\nAufgaben diese Woche:\n- \n\nErreichter Stand:\n- \n\nNächste Schritte:\n- `,
    learnings:  `Neue Erkenntnisse:\n- \n\nProbleme und Lösungen:\n- `,
  },
  {
    label: 'Schul- & Betrieb',
    activities: `Betrieb (Mo/Di/Do/Fr):\n- \n\nBerufsschule (Mi):\n- Fächer: \n- Themen: `,
    learnings:  `Im Betrieb gelernt:\n- \n\nIn der Schule gelernt:\n- `,
  },
];

// ── Report-Karte (in der Listenansicht) ───────────────────────
function ReportCard({ report, currentUser, onOpen, onSubmit, onSign, onDelete }) {
  const st       = STATUS_REPORT[report.status] || STATUS_REPORT.draft;
  const kw       = getKW(report.week_start);
  const canSubmit = report.status === 'draft' && report.user_id === currentUser.id;
  const canSign   = ['submitted','reviewed'].includes(report.status) && currentUser.role === 'ausbilder';
  const canDelete = report.user_id === currentUser.id || currentUser.role === 'ausbilder';
  const weekEnd   = new Date(new Date(report.week_start).getTime() + 4 * 86400000).toISOString().split('T')[0];

  return (
    <div className="card"
      style={{ cursor: 'pointer', transition: 'transform .12s, box-shadow .12s', borderLeft: `3px solid ${st.c}` }}
      onClick={() => onOpen(report)}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9, gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>KW {kw} · {new Date(report.week_start).getFullYear()}</div>
          <div style={{ fontSize: 11, color: C.mu, marginTop: 2 }}>
            {fmtDate(report.week_start)} – {fmtDate(weekEnd)}
          </div>
          {currentUser.role === 'ausbilder' && report.user_name && (
            <div style={{ fontSize: 11, color: C.ac, marginTop: 3, fontWeight: 600 }}>{report.user_name}</div>
          )}
        </div>
        <span className="tag" style={{ background: st.bg, color: st.c, border: `1px solid ${st.c}35`, flexShrink: 0 }}>
          ● {st.l}
        </span>
      </div>

      {report.title && (
        <div style={{ fontSize: 12, color: C.mu, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.title}</div>
      )}

      {/* Datei-Indikator */}
      {report.file && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.ac, marginBottom: 7 }}>
          <IcoDoc size={11} /> {report.file.name}
          <span style={{ color: C.mu }}>({(report.file.size / 1024).toFixed(0)} KB)</span>
        </div>
      )}

      {/* Ausbilder-Kommentar */}
      {report.reviewer_comment && (
        <div style={{ display: 'flex', gap: 6, fontSize: 11, color: C.mu, background: 'var(--c-sf3)', borderRadius: 6, padding: '5px 9px', marginBottom: 8 }}>
          <IcoNote size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {report.reviewer_comment.slice(0, 90)}{report.reviewer_comment.length > 90 ? '…' : ''}
          </span>
        </div>
      )}

      {/* Aktionen */}
      <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
        {canSubmit && (
          <button className="abtn" onClick={e => { e.stopPropagation(); onSubmit(report.id); }}
            style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcoChevron size={11} /> Einreichen
          </button>
        )}
        {canSign && (
          <button className="abtn" onClick={e => { e.stopPropagation(); onSign(report.id); }}
            style={{ fontSize: 11, padding: '5px 12px', background: C.gr, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcoCheck size={11} /> Bestätigen
          </button>
        )}
        {canDelete && (
          <button className="del" onClick={e => { e.stopPropagation(); onDelete(report.id); }}
            style={{ marginLeft: 'auto', fontSize: 12 }}
            title="Berichtsheft löschen">×</button>
        )}
      </div>
    </div>
  );
}

// ── Report-Editor / Ansicht ───────────────────────────────────
function ReportEditor({ report, currentUser, onSave, onClose, showToast }) {
  const [form, setForm] = useState({
    title:            report?.title            || '',
    activities:       report?.activities       || '',
    learnings:        report?.learnings        || '',
    week_start:       report?.week_start       || getMonday(),
    status:           report?.status           || 'draft',
    reviewer_comment: report?.reviewer_comment || '',
    file:             report?.file             || null,
  });
  const [tab,    setTab]    = useState('text');   // text | upload
  const [copied, setCopied] = useState('');
  const fileRef = useRef();

  const isOwner  = !report || report.user_id === currentUser.id;
  const isReview = currentUser.role === 'ausbilder';
  const readOnly = report?.status === 'submitted' && !isReview;
  const kw       = getKW(form.week_start);

  const applyTemplate = (tmpl) => {
    setForm(f => ({ ...f, activities: tmpl.activities, learnings: tmpl.learnings }));
    showToast('✓ Vorlage eingefügt');
  };

  const copyToClipboard = async (text, key) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 2000); } catch {}
  };

  const handleFile = (e) => {
    const file = e.target?.files?.[0] || e;
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.type?.includes('pdf')) { showToast('⚠ Nur PDF-Dateien'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('⚠ Max. 10 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, file: { name: file.name, size: file.size, type: file.type, data: ev.target.result } }));
      showToast('✓ PDF geladen');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const save = () => {
    const newReport = {
      id:          report?.id || uid(),
      user_id:     currentUser.id,
      user_name:   currentUser.name,
      ...form,
      week_number: kw,
      year:        new Date(form.week_start).getFullYear(),
      updated_at:  new Date().toISOString(),
      created_at:  report?.created_at || new Date().toISOString(),
    };
    onSave(newReport);
    showToast('✓ Berichtsheft gespeichert');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="anim">

      {/* ── Editor-Header ── */}
      <div style={{ background: 'var(--c-sf)', borderBottom: `1px solid var(--c-bd)`, padding: '10px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={onClose} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
          <IcoBack size={12} /> Zurück
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>
            {report ? `KW ${kw} · Berichtsheft bearbeiten` : 'Neues Berichtsheft'}
          </div>
          {report?.status && (
            <div style={{ fontSize: 10, color: STATUS_REPORT[report.status]?.c, fontWeight: 700 }}>
              ● {STATUS_REPORT[report.status]?.l}
            </div>
          )}
        </div>

        {/* Tab-Wahl: Text oder PDF */}
        <div style={{ display: 'flex', background: 'var(--c-sf2)', borderRadius: 8, padding: 3, gap: 3 }}>
          {[['text','Texteingabe', IcoDoc], ['upload','PDF hochladen', IcoReport]].map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', background: tab === k ? C.ac : 'transparent', color: tab === k ? '#fff' : C.mu, cursor: 'pointer', transition: 'all .12s' }}>
              <Icon size={12} />{l}
            </button>
          ))}
        </div>

        {/* Speichern-Button */}
        {isOwner && !readOnly && (
          <button className="abtn" onClick={save} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcoCheck size={13} /> Speichern
          </button>
        )}
      </div>

      {/* ── Editor-Body (scrollbar hier) ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', gap: 18, alignItems: 'flex-start' }}>

        {/* ── Linke Spalte: Meta + Vorlagen ── */}
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Woche + Titel */}
          <div className="card">
            <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>Metadaten</div>
            <Field label="Woche (Montag)">
              <input type="date" value={form.week_start} disabled={!isOwner || readOnly}
                onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))} />
            </Field>
            <Field label="Titel (optional)">
              <input value={form.title} disabled={!isOwner || readOnly}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="z.B. Projektarbeit Woche 3" />
            </Field>
            <div style={{ fontSize: 11, color: C.mu, marginTop: 4 }}>KW {kw} · {new Date(form.week_start).getFullYear()}</div>
          </div>

          {/* Vorlagen */}
          {isOwner && !readOnly && tab === 'text' && (
            <div className="card">
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>Vorlage einfügen</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => applyTemplate(t)} className="btn"
                    style={{ fontSize: 11, justifyContent: 'flex-start', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcoDoc size={11} /> {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ausbilder: Kommentar + Status */}
          {isReview && report && (
            <div className="card">
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>Ausbilder-Aktion</div>
              <Field label="Kommentar">
                <textarea value={form.reviewer_comment}
                  onChange={e => setForm(f => ({ ...f, reviewer_comment: e.target.value }))}
                  placeholder="Feedback, Hinweise…"
                  style={{ minHeight: 80, fontSize: 12 }} />
              </Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['submitted','reviewed'].includes(report?.status) && (
                  <button className="abtn"
                    onClick={() => { onSave({ ...report, ...form, status: 'reviewed', reviewed_at: new Date().toISOString() }); showToast('✓ Als geprüft markiert'); }}
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, background: C.yw }}>
                    <IcoCheck size={12} /> Als geprüft markieren
                  </button>
                )}
                {['reviewed'].includes(report?.status) && (
                  <button className="abtn"
                    onClick={() => { onSave({ ...report, ...form, status: 'signed', signed_at: new Date().toISOString() }); showToast('✓ Unterschrieben'); }}
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, background: C.gr }}>
                    <IcoStar size={12} /> Unterschreiben
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Rechte Spalte: Inhalt ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {tab === 'text' ? (
            <>
              {/* Tätigkeitsbericht */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcoDoc size={13} style={{ color: C.ac }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .7 }}>Tätigkeitsbericht</span>
                  </div>
                  <button onClick={() => copyToClipboard(form.activities, 'activities')} className="btn"
                    style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {copied === 'activities' ? <><IcoCheck size={10} /> Kopiert</> : 'Kopieren'}
                  </button>
                </div>
                <textarea value={form.activities} disabled={!isOwner || readOnly}
                  onChange={e => setForm(f => ({ ...f, activities: e.target.value }))}
                  placeholder="Beschreibe deine Tätigkeiten der Woche..."
                  style={{ minHeight: 200, fontSize: 12, lineHeight: 1.7 }} />
              </div>

              {/* Lernbericht */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcoNote size={13} style={{ color: C.yw }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .7 }}>Lernbericht</span>
                  </div>
                  <button onClick={() => copyToClipboard(form.learnings, 'learnings')} className="btn"
                    style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {copied === 'learnings' ? <><IcoCheck size={10} /> Kopiert</> : 'Kopieren'}
                  </button>
                </div>
                <textarea value={form.learnings} disabled={!isOwner || readOnly}
                  onChange={e => setForm(f => ({ ...f, learnings: e.target.value }))}
                  placeholder="Was hast du diese Woche gelernt? Neue Erkenntnisse?"
                  style={{ minHeight: 160, fontSize: 12, lineHeight: 1.7 }} />
              </div>
            </>
          ) : (
            /* PDF-Upload */
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcoReport size={13} style={{ color: C.ac }} /> PDF-Upload
              </div>

              {/* Drag-and-Drop Zone */}
              <div
                style={{ border: `2px dashed ${C.bd2}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', background: 'var(--c-sf3)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.ac; e.currentTarget.style.background = C.acd; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = C.bd2; e.currentTarget.style.background = 'var(--c-sf3)'; }}
                onDrop={e => { e.currentTarget.style.borderColor = C.bd2; e.currentTarget.style.background = 'var(--c-sf3)'; handleDrop(e); }}
                onClick={() => fileRef.current?.click()}>
                <IcoReport size={32} style={{ color: C.mu, marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 5 }}>PDF hierher ziehen oder klicken</div>
                <div style={{ fontSize: 11, color: C.mu }}>Nur PDF-Dateien · Max. 10 MB</div>
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                  onChange={e => handleFile(e)} />
              </div>

              {/* Vorschau */}
              {form.file && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 8, marginBottom: 10 }}>
                    <IcoDoc size={16} style={{ color: C.ac, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.file.name}</div>
                      <div style={{ fontSize: 10, color: C.mu }}>{(form.file.size / 1024).toFixed(0)} KB</div>
                    </div>
                    {isOwner && !readOnly && (
                      <button onClick={() => setForm(f => ({ ...f, file: null }))} className="del" style={{ fontSize: 14 }}>×</button>
                    )}
                  </div>
                  {form.file.data && (
                    <iframe src={form.file.data} title="PDF Vorschau"
                      style={{ width: '100%', height: 500, border: `1px solid var(--c-bd)`, borderRadius: 8, background: '#fff' }} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Hauptseite ────────────────────────────────────────────────
export default function ReportsPage({ currentUser, data, onUpdateData, showToast }) {
  const reports              = data.reports || [];
  const [view,    setView]   = useState('list');   // list | edit
  const [editing, setEditing]= useState(null);
  const [filter,  setFilter] = useState('alle');

  const myReports = currentUser.role === 'azubi'
    ? reports.filter(r => r.user_id === currentUser.id)
    : reports;

  const filtered = myReports.filter(r => filter === 'alle' || r.status === filter);

  const saveReport = (rep) => {
    const existing = reports.find(r => r.id === rep.id);
    onUpdateData({ reports: existing ? reports.map(r => r.id === rep.id ? rep : r) : [...reports, rep] });
  };

  const deleteReport = (id) => {
    if (!confirm('Berichtsheft wirklich löschen?')) return;
    onUpdateData({ reports: reports.filter(r => r.id !== id) });
    showToast('Berichtsheft gelöscht');
  };

  const submitReport = (id) => {
    onUpdateData({ reports: reports.map(r => r.id === id ? { ...r, status: 'submitted', submitted_at: new Date().toISOString() } : r) });
    showToast('✓ Berichtsheft eingereicht');
  };

  const signReport = (id) => {
    onUpdateData({ reports: reports.map(r => r.id === id ? { ...r, status: 'signed', signed_at: new Date().toISOString() } : r) });
    showToast('✓ Berichtsheft bestätigt');
  };

  // Editor-Ansicht
  if (view === 'edit') {
    return (
      <ReportEditor report={editing} currentUser={currentUser}
        onSave={(rep) => { saveReport(rep); setView('list'); }}
        onClose={() => setView('list')} showToast={showToast} />
    );
  }

  // ── Listen-Ansicht ─────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px' }} className="anim">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Berichtshefte</h1>
          <p style={{ fontSize: 12, color: C.mu, marginTop: 3 }}>
            {currentUser.role === 'ausbilder' ? 'Alle eingereichten Berichte' : 'Deine wöchentlichen Ausbildungsberichte'}
          </p>
        </div>
        {currentUser.role === 'azubi' && (
          <button className="abtn" onClick={() => { setEditing(null); setView('edit'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <IcoPlus size={13} /> Neuer Bericht
          </button>
        )}
      </div>

      {/* Status-Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_REPORT).map(([k, v]) => {
          const cnt = myReports.filter(r => r.status === k).length;
          return (
            <div key={k} onClick={() => setFilter(filter === k ? 'alle' : k)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', background: filter === k ? v.c + '18' : 'var(--c-sf2)', border: `1px solid ${filter === k ? v.c + '50' : 'var(--c-bd)'}`, borderRadius: 8, cursor: 'pointer', transition: 'all .12s' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: v.c, fontFamily: "'Syne',sans-serif", lineHeight: 1 }}>{cnt}</span>
              <span style={{ fontSize: 10, color: C.mu, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7 }}>{v.l}</span>
            </div>
          );
        })}
        {filter !== 'alle' && (
          <button onClick={() => setFilter('alle')} className="btn" style={{ fontSize: 11 }}>× Alle anzeigen</button>
        )}
      </div>

      {/* Berichts-Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <EmptyState Icon={IcoReport}
            title="Keine Berichtshefte"
            subtitle={currentUser.role === 'azubi' ? 'Erstelle deinen ersten Wochenbericht.' : 'Noch keine Berichte in dieser Kategorie.'}
            action={currentUser.role === 'azubi' ? '+ Neuer Bericht' : undefined}
            onAction={currentUser.role === 'azubi' ? () => { setEditing(null); setView('edit'); } : undefined} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, alignContent: 'start' }}>
            {[...filtered].sort((a, b) => new Date(b.week_start) - new Date(a.week_start)).map(r => (
              <ReportCard key={r.id} report={r} currentUser={currentUser}
                onOpen={(rep) => { setEditing(rep); setView('edit'); }}
                onSubmit={submitReport} onSign={signReport}
                onDelete={deleteReport} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
