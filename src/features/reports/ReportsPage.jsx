import { useState, useRef } from "react";
import { C, uid, fmtDate, getKW, getISOWeek, fmtLocalDate, addActivity } from '../../lib/utils.js';
import { softDelete } from '../../lib/trash.js';
import { Avatar, Field, EmptyState } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import {
  IcoReport, IcoCheck, IcoEdit, IcoPlus, IcoBack,
  IcoDoc, IcoNote, IcoAlert, IcoUsers, IcoClock,
  IcoStar, IcoChevron, IcoSearch, IcoX
} from '../../components/Icons.jsx';

const STATUS_REPORT = {
  draft:     { l: 'Entwurf',        c: C.mu,  bg: 'var(--c-sf2)' },
  submitted: { l: 'Eingereicht',    c: C.ac,  bg: C.acd          },
  reviewed:  { l: 'Geprüft',        c: C.yw,  bg: C.ywd          },
  signed:    { l: 'Unterschrieben', c: C.gr,  bg: '#07130a'      },
};

function getMonday(d = new Date()) {
  // ISO-Montag, lokal (DST-sicher)
  const dt = d instanceof Date ? new Date(d) : new Date(d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return fmtLocalDate(dt);
}

const TEMPLATES = [
  { label: 'Standard', activities: `Montag:\n- \n\nDienstag:\n- \n\nMittwoch:\n- \n\nDonnerstag:\n- \n\nFreitag:\n- `, learnings: `Was ich diese Woche gelernt habe:\n- \n\nSchwierigkeiten:\n- ` },
  { label: 'Projekt', activities: `Projekttitel: \n\nAufgaben diese Woche:\n- \n\nErreichter Stand:\n- \n\nNächste Schritte:\n- `, learnings: `Neue Erkenntnisse:\n- \n\nProbleme und Lösungen:\n- ` },
  { label: 'Schul- & Betrieb', activities: `Betrieb (Mo/Di/Do/Fr):\n- \n\nBerufsschule (Mi):\n- Fächer: \n- Themen: `, learnings: `Im Betrieb gelernt:\n- \n\nIn der Schule gelernt:\n- ` },
];

function ReportCard({ report, currentUser, onOpen, onSubmit, onSign, onDelete }) {
  const st       = STATUS_REPORT[report.status] || STATUS_REPORT.draft;
  const iso      = getISOWeek(report.week_start);
  const kw       = iso.week;
  const isoYear  = iso.year ?? new Date(report.week_start).getFullYear();
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 9, gap: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>KW {kw} · {isoYear}</div>
          <div style={{ fontSize: 11, color: C.mu, marginTop: 2 }}>{fmtDate(report.week_start)} – {fmtDate(weekEnd)}</div>
          {currentUser.role === 'ausbilder' && report.user_name && (
            <div style={{ fontSize: 11, color: C.ac, marginTop: 3, fontWeight: 600 }}>{report.user_name}</div>
          )}
        </div>
        <span className="tag" style={{ background: st.bg, color: st.c, border: `1px solid ${st.c}35`, flexShrink: 0 }}>● {st.l}</span>
      </div>

      {report.title && (
        <div style={{ fontSize: 12, color: C.mu, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.title}</div>
      )}

      {report.file && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.ac, marginBottom: 7 }}>
          <IcoDoc size={11} /> {report.file.name}
          <span style={{ color: C.mu }}>({(report.file.size / 1024).toFixed(0)} KB)</span>
        </div>
      )}

      {report.reviewer_comment && (
        <div style={{ display: 'flex', gap: 6, fontSize: 11, color: C.mu, background: 'var(--c-sf3)', borderRadius: 6, padding: '5px 9px', marginBottom: 8 }}>
          <IcoNote size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {report.reviewer_comment.slice(0, 90)}{report.reviewer_comment.length > 90 ? '…' : ''}
          </span>
        </div>
      )}

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
            style={{ marginLeft: 'auto', fontSize: 12 }} title="Berichtsheft löschen">×</button>
        )}
      </div>
    </div>
  );
}

function ReportEditor({ report, currentUser, projects, onSave, onClose, showToast }) {
  const [form, setForm] = useState({
    title:            report?.title            || '',
    activities:       report?.activities       || '',
    learnings:        report?.learnings        || '',
    week_start:       report?.week_start       || getMonday(),
    status:           report?.status           || 'draft',
    reviewer_comment: report?.reviewer_comment || '',
    file:             report?.file             || null,
    sectionComments:  report?.sectionComments  || { activities: [], learnings: [] },
  });
  const [newComment, setNewComment] = useState({ activities: '', learnings: '' });
  const [tab,    setTab]    = useState('text');
  const [copied, setCopied] = useState('');
  const fileRef = useRef();

  const isOwner  = !report || report.user_id === currentUser.id;
  const isReview = currentUser.role === 'ausbilder';
  const readOnly = report?.status === 'submitted' && !isReview;
  const kw       = getKW(form.week_start);

  const applyTemplate = (tmpl) => { setForm(f => ({ ...f, activities: tmpl.activities, learnings: tmpl.learnings })); showToast('✓ Vorlage eingefügt'); };

  const autoFillFromTasks = () => {
    const ws  = form.week_start;
    const we  = (() => { const d = new Date(ws); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0]; })();
    const groups = [];
    (projects || []).forEach(p => {
      const wt = (p.tasks || []).filter(t => t.text && t.deadline && t.deadline >= ws && t.deadline <= we);
      if (wt.length) groups.push({ title: p.title, tasks: wt });
    });
    if (!groups.length) { showToast('⚠ Keine Aufgaben mit Deadline in dieser KW'); return; }
    const text = groups.map(g =>
      `${g.title}:\n${g.tasks.map(t => `- ${t.text}${t.status === 'done' ? ' ✓' : ''}`).join('\n')}`
    ).join('\n\n');
    setForm(f => ({ ...f, activities: f.activities ? `${f.activities}\n\n${text}` : text }));
    showToast(`✓ ${groups.reduce((s, g) => s + g.tasks.length, 0)} Aufgaben eingefügt`);
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
    reader.onload = (ev) => { setForm(f => ({ ...f, file: { name: file.name, size: file.size, type: file.type, data: ev.target.result } })); showToast('✓ PDF geladen'); };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); };

  const save = () => {
    const newReport = { id: report?.id || uid(), user_id: currentUser.id, user_name: currentUser.name, ...form, week_number: kw, year: new Date(form.week_start).getFullYear(), updated_at: new Date().toISOString(), created_at: report?.created_at || new Date().toISOString() };
    onSave(newReport);
    showToast('✓ Berichtsheft gespeichert');
  };

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) { showToast('⚠ Popup blockiert – bitte Pop-ups erlauben'); return; }
    const isoYear = getISOWeek(form.week_start).year ?? new Date(form.week_start).getFullYear();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Berichtsheft KW ${kw} – ${currentUser.name}</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;color:#111;font-size:14px;line-height:1.7}
      h1{font-size:22px;margin-bottom:4px}
      h2{font-size:15px;font-weight:700;margin:22px 0 8px;border-bottom:2px solid #eee;padding-bottom:4px}
      p,pre{margin:0 0 14px;white-space:pre-wrap;word-break:break-word}
      .meta{color:#666;font-size:12px;margin-bottom:24px}
      .status{display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:700;background:#e8f5e9;color:#2e7d32}
      hr{border:none;border-top:1px solid #ddd;margin:24px 0}
      @media print{
        body{margin:20px}
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
      }
    </style>
    </head><body>
    <h1>Ausbildungsnachweis – KW ${kw} / ${isoYear}</h1>
    <div class="meta">
      <strong>${currentUser.name}</strong> · Woche vom ${new Date(form.week_start).toLocaleDateString('de-DE')} ·
      <span class="status">${STATUS_REPORT[form.status]?.l || form.status}</span>
    </div>
    ${form.title ? `<h2>Thema</h2><p>${form.title}</p>` : ''}
    <h2>Durchgeführte Tätigkeiten</h2><pre>${form.activities || '–'}</pre>
    <h2>Unterweisungen / Lerninhalt</h2><pre>${form.learnings || '–'}</pre>
    ${form.reviewer_comment ? `<hr><h2>Kommentar des Ausbilders</h2><pre>${form.reviewer_comment}</pre>` : ''}
    <hr><p style="font-size:11px;color:#999">Erstellt mit AzubiBoard · ${new Date().toLocaleDateString('de-DE')}</p>
    </body></html>`);
    w.document.close();
    w.focus();
    // onload statt fixem Timeout (verhindert Race-Condition mit großen Dokumenten)
    if (w.document.readyState === 'complete') w.print();
    else w.onload = () => w.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="anim">
      <div style={{ background: 'var(--c-sf)', borderBottom: `1px solid var(--c-bd)`, padding: '10px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={onClose} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><IcoBack size={12} /> Zurück</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>{report ? `KW ${kw} · Berichtsheft bearbeiten` : 'Neues Berichtsheft'}</div>
          {report?.status && <div style={{ fontSize: 10, color: STATUS_REPORT[report.status]?.c, fontWeight: 700 }}>● {STATUS_REPORT[report.status]?.l}</div>}
        </div>
        <div style={{ display: 'flex', background: 'var(--c-sf2)', borderRadius: 8, padding: 3, gap: 3 }}>
          {[['text','Texteingabe', IcoDoc], ['upload','PDF hochladen', IcoReport]].map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', background: tab === k ? C.ac : 'transparent', color: tab === k ? '#fff' : C.mu, cursor: 'pointer', transition: 'all .12s' }}>
              <Icon size={12} />{l}
            </button>
          ))}
        </div>
        <button className="btn" onClick={printReport} title="Als PDF drucken" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>🖨 PDF</button>
        {isOwner && !readOnly && (
          <button className="abtn" onClick={save} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><IcoCheck size={13} /> Speichern</button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>Metadaten</div>
            <Field label="Woche (Montag)">
              <input type="date" value={form.week_start} disabled={!isOwner || readOnly} onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))} />
            </Field>
            <Field label="Titel (optional)">
              <input value={form.title} disabled={!isOwner || readOnly} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="z.B. Projektarbeit Woche 3" />
            </Field>
            <div style={{ fontSize: 11, color: C.mu, marginTop: 4 }}>KW {kw} · {new Date(form.week_start).getFullYear()}</div>
          </div>

          {isOwner && !readOnly && tab === 'text' && (
            <div className="card">
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>Autofill</div>
              <button onClick={autoFillFromTasks} className="abtn"
                style={{ fontSize: 11, width: '100%', justifyContent: 'flex-start', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, background: C.gr }}>
                ⚡ Aus Aufgaben befüllen
              </button>
              <div style={{ fontSize: 9, color: C.mu, marginBottom: 10, lineHeight: 1.5 }}>
                Fügt alle Aufgaben mit Deadline in KW {kw} automatisch ins Tätigkeitsfeld ein.
              </div>
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 8 }}>Vorlage</div>
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

          {isReview && report && (
            <div className="card">
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>Ausbilder-Aktion</div>
              <Field label="Kommentar">
                <textarea value={form.reviewer_comment} onChange={e => setForm(f => ({ ...f, reviewer_comment: e.target.value }))} placeholder="Feedback, Hinweise…" style={{ minHeight: 80, fontSize: 12 }} />
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

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'text' ? (
            <>
              {[
                { key: 'activities', label: 'Tätigkeitsbericht', Icon: IcoDoc, color: C.ac, ph: 'Beschreibe deine Tätigkeiten der Woche...', minH: 200 },
                { key: 'learnings',  label: 'Lernbericht',       Icon: IcoNote, color: C.yw, ph: 'Was hast du diese Woche gelernt? Neue Erkenntnisse?', minH: 160 },
              ].map(({ key, label, Icon, color, ph, minH }) => {
                const comments = (form.sectionComments?.[key] || []);
                const addComment = () => {
                  const txt = newComment[key]?.trim();
                  if (!txt) return;
                  const entry = { id: Date.now().toString(36), text: txt, reviewerName: currentUser.name, ts: new Date().toISOString() };
                  setForm(f => ({ ...f, sectionComments: { ...f.sectionComments, [key]: [...(f.sectionComments?.[key]||[]), entry] } }));
                  setNewComment(n => ({ ...n, [key]: '' }));
                };
                const delComment = (id) => {
                  setForm(f => ({ ...f, sectionComments: { ...f.sectionComments, [key]: (f.sectionComments?.[key]||[]).filter(c => c.id !== id) } }));
                };
                return (
                  <div key={key} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon size={13} style={{ color }} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .7 }}>{label}</span>
                        {comments.length > 0 && <span style={{ fontSize: 9, background: C.ywd, color: C.yw, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{comments.length} Kommentar{comments.length !== 1 ? 'e' : ''}</span>}
                      </div>
                      <button onClick={() => copyToClipboard(form[key], key)} className="btn" style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {copied === key ? <><IcoCheck size={10} /> Kopiert</> : 'Kopieren'}
                      </button>
                    </div>
                    <textarea value={form[key]} disabled={!isOwner || readOnly} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph}
                      style={{ minHeight: minH, fontSize: 12, lineHeight: 1.7 }} />

                    {/* Ausbilder-Kommentare */}
                    {(comments.length > 0 || isReview) && (
                      <div style={{ marginTop: 10, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>
                        <div style={{ fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 7 }}>Ausbilder-Kommentare</div>
                        {comments.map(c => (
                          <div key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 9px', background: C.ywd, border: `1px solid ${C.yw}25`, borderRadius: 7, marginBottom: 5 }}>
                            <IcoNote size={11} style={{ color: C.yw, flexShrink: 0, marginTop: 2 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11, color: C.br, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{c.text}</div>
                              <div style={{ fontSize: 9, color: C.mu, marginTop: 3 }}>{c.reviewerName} · {new Date(c.ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                            {isReview && <button onClick={() => delComment(c.id)} className="del" style={{ fontSize: 13, alignSelf: 'flex-start' }}>×</button>}
                          </div>
                        ))}
                        {isReview && (
                          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                            <input value={newComment[key] || ''} onChange={e => setNewComment(n => ({ ...n, [key]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
                              placeholder="Kommentar hinzufügen… (Enter)" style={{ flex: 1, fontSize: 11, padding: '5px 9px' }} />
                            <button className="abtn" onClick={addComment} style={{ fontSize: 11, padding: '5px 11px', background: C.yw }}>+</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <IcoReport size={13} style={{ color: C.ac }} /> PDF-Upload
              </div>
              <div
                style={{ border: `2px dashed ${C.bd2}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', background: 'var(--c-sf3)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.ac; e.currentTarget.style.background = C.acd; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = C.bd2; e.currentTarget.style.background = 'var(--c-sf3)'; }}
                onDrop={e => { e.currentTarget.style.borderColor = C.bd2; e.currentTarget.style.background = 'var(--c-sf3)'; handleDrop(e); }}
                onClick={() => fileRef.current?.click()}>
                <IcoReport size={32} style={{ color: C.mu, marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 5 }}>PDF hierher ziehen oder klicken</div>
                <div style={{ fontSize: 11, color: C.mu }}>Nur PDF-Dateien · Max. 10 MB</div>
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFile(e)} />
              </div>
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
                    <iframe src={form.file.data} title="PDF Vorschau" style={{ width: '100%', height: 500, border: `1px solid var(--c-bd)`, borderRadius: 8, background: '#fff' }} />
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

function printJahresmappe(reports, year, showToast) {
  const yearReports = reports
    .filter(r => {
      const iso = getISOWeek(r.week_start);
      const ry  = r.year ?? iso.year ?? new Date(r.week_start).getFullYear();
      return ry === year;
    })
    .sort((a, b) => new Date(a.week_start) - new Date(b.week_start));

  if (!yearReports.length) {
    showToast?.(`⚠ Keine Berichte für ${year} vorhanden`);
    return;
  }

  const byUser = yearReports.reduce((acc, r) => {
    if (!acc[r.user_id]) acc[r.user_id] = { name: r.user_name || 'Unbekannt', reports: [] };
    acc[r.user_id].reports.push(r);
    return acc;
  }, {});

  const w = window.open('', '_blank');
  if (!w) { showToast?.('⚠ Popup blockiert – bitte Pop-ups erlauben'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Jahresmappe ${year}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:820px;margin:40px auto;color:#111;font-size:13px}
    h1{font-size:24px;text-align:center;border-bottom:3px solid #333;padding-bottom:10px}
    h2{font-size:17px;margin-top:40px;border-bottom:2px solid #555;padding-bottom:6px}
    h3{font-size:14px;margin:24px 0 6px;color:#555}
    pre{white-space:pre-wrap;margin:6px 0 10px;word-break:break-word}
    .kw{font-weight:800;font-size:15px}
    .meta{font-size:11px;color:#666}
    .status{font-size:10px;padding:1px 8px;border-radius:4px;background:#e8f5e9;color:#2e7d32;font-weight:700}
    .divider{border:none;border-top:1px dashed #ccc;margin:20px 0}
    @media print{
      .pagebreak{page-break-before:always}
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
      h2{page-break-after:avoid}
      h3{page-break-after:avoid}
      pre{page-break-inside:avoid}
    }
  </style>
  </head><body>
  <h1>Ausbildungsnachweis-Mappe ${year}</h1>
  ${Object.values(byUser).map(u => `
    <h2>${u.name}</h2>
    ${u.reports.map((r, i) => {
      const iso = getISOWeek(r.week_start);
      const kw  = r.week_number ?? iso.week ?? '';
      const yr  = r.year ?? iso.year ?? year;
      return `
      ${i > 0 ? '<hr class="divider">' : ''}
      <div class="kw">KW ${kw}/${yr}</div>
      <div class="meta">${new Date(r.week_start).toLocaleDateString('de-DE')} · <span class="status">${r.status}</span></div>
      ${r.title ? `<h3>${r.title}</h3>` : ''}
      <h3>Tätigkeiten</h3><pre>${r.activities || '–'}</pre>
      <h3>Lerninhalt</h3><pre>${r.learnings || '–'}</pre>
      ${r.reviewer_comment ? `<h3>Ausbilder-Kommentar</h3><pre>${r.reviewer_comment}</pre>` : ''}
    `;}).join('')}
  `).join('<div class="pagebreak"></div>')}
  <p style="margin-top:50px;font-size:10px;color:#999;text-align:center">Erstellt mit AzubiBoard · ${new Date().toLocaleDateString('de-DE')}</p>
  </body></html>`);
  w.document.close();
  if (w.document.readyState === 'complete') w.print();
  else w.onload = () => w.print();
}

export default function ReportsPage({ currentUser, data, onUpdateData, showToast }) {
  const reports              = data.reports || [];
  const [view,    setView]   = useState('list');
  const [editing, setEditing]= useState(null);
  const [filter,  setFilter] = useState('alle');
  const [search,  setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState(null);

  const myReports = currentUser.role === 'azubi' ? reports.filter(r => r.user_id === currentUser.id) : reports;
  const q = search.trim().toLowerCase();
  const filtered = myReports
    .filter(r => filter === 'alle' || r.status === filter)
    .filter(r => !q || (
      (r.title || '').toLowerCase().includes(q) ||
      (r.activities || '').toLowerCase().includes(q) ||
      (r.learnings || '').toLowerCase().includes(q) ||
      (r.user_name || '').toLowerCase().includes(q) ||
      String(r.week_number).includes(q)
    ));

  const saveReport = (rep) => {
    const existing = reports.find(r => r.id === rep.id);
    const next = { ...data, reports: existing ? reports.map(r => r.id === rep.id ? rep : r) : [...reports, rep] };
    const iso  = getISOWeek(rep.week_start);
    onUpdateData(addActivity(next, {
      type:        'report_saved',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: `KW ${iso.week ?? '?'}/${iso.year ?? '?'}`,
      projectId:   null,
      projectTitle:null,
      action:      existing ? 'Berichtsheft aktualisiert' : 'Berichtsheft angelegt',
    }));
  };

  const deleteReport = (id) => {
    setConfirmDel(id);
    // Toast fires in ConfirmDialog.onConfirm, not here
  };

  const submitReport = (id) => {
    const rep = reports.find(r => r.id === id);
    const iso = rep ? getISOWeek(rep.week_start) : { week: '?', year: '?' };
    const next = { ...data, reports: reports.map(r => r.id === id ? { ...r, status: 'submitted', submitted_at: new Date().toISOString() } : r) };
    onUpdateData(addActivity(next, {
      type:        'report_submitted',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: `KW ${iso.week}/${iso.year}`,
      projectId:   null,
      projectTitle:null,
      action:      'Berichtsheft eingereicht',
    }));
    showToast('✓ Berichtsheft eingereicht');
  };

  const signReport = (id) => {
    const rep = reports.find(r => r.id === id);
    const iso = rep ? getISOWeek(rep.week_start) : { week: '?', year: '?' };
    const next = { ...data, reports: reports.map(r => r.id === id ? { ...r, status: 'signed', signed_at: new Date().toISOString() } : r) };
    onUpdateData(addActivity(next, {
      type:        'report_signed',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: `KW ${iso.week}/${iso.year}` + (rep?.user_name ? ` · ${rep.user_name}` : ''),
      projectId:   null,
      projectTitle:null,
      action:      'Berichtsheft signiert',
    }));
    showToast('✓ Berichtsheft bestätigt');
  };

  if (view === 'edit') {
    return (
      <ReportEditor report={editing} currentUser={currentUser}
        projects={data.projects || []}
        onSave={(rep) => { saveReport(rep); setView('list'); }}
        onClose={() => setView('list')} showToast={showToast} />
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '14px 20px' }} className="anim">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>Berichtshefte</h1>
          <p style={{ fontSize: 12, color: C.mu, marginTop: 3 }}>
            {currentUser.role === 'ausbilder' ? 'Alle eingereichten Berichte' : 'Deine wöchentlichen Ausbildungsberichte'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {currentUser.role === 'ausbilder' && (
            <button className="btn" onClick={() => printJahresmappe(reports, new Date().getFullYear(), showToast)}
              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
              📚 Jahresmappe {new Date().getFullYear()}
            </button>
          )}
          {currentUser.role === 'azubi' && (
            <button className="abtn" onClick={() => { setEditing(null); setView('edit'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <IcoPlus size={13} /> Neuer Bericht
            </button>
          )}
        </div>
      </div>

      {/* Suche */}
      <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
        <IcoSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.mu, pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Berichte durchsuchen… (Titel, Tätigkeiten, Lernbericht, Name)"
          style={{ width: '100%', paddingLeft: 32, paddingRight: search ? 32 : 10, fontSize: 13 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.mu, display: 'flex' }}>
            <IcoX size={13} />
          </button>
        )}
      </div>

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

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <EmptyState Icon={IcoReport}
            title={q ? `Keine Ergebnisse für „${q}"` : 'Keine Berichtshefte'}
            subtitle={q ? 'Versuche einen anderen Suchbegriff.' : (currentUser.role === 'azubi' ? 'Erstelle deinen ersten Wochenbericht.' : 'Noch keine Berichte in dieser Kategorie.')}
            action={!q && currentUser.role === 'azubi' ? '+ Neuer Bericht' : undefined}
            onAction={!q && currentUser.role === 'azubi' ? () => { setEditing(null); setView('edit'); } : undefined} />
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

      {confirmDel && (
        <ConfirmDialog
          message="Berichtsheft in den Papierkorb verschieben? Wiederherstellung möglich für 30 Tage."
          onConfirm={() => {
            const snapshot = data;
            const report   = reports.find(r => r.id === confirmDel);
            if (report) {
              onUpdateData(softDelete(data, 'reports', report, currentUser));
            } else {
              onUpdateData({ ...data, reports: reports.filter(r => r.id !== confirmDel) });
            }
            showToast('🗑 Berichtsheft → Papierkorb (30 Tage)', { undo: () => onUpdateData(snapshot) });
            setConfirmDel(null);
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </div>
  );
}
