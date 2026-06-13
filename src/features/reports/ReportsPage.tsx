import { useState, useRef, useCallback } from "react";
import type { User, Project, Task, Report, AppState, Id } from '../../types';
import { dataService } from '../../lib/dataService.js';
import { useTranslation } from 'react-i18next';
import { C, uid, fmtDate, getKW, getISOWeek, isoWeekMonday, addActivity } from '../../lib/utils.js';
import { useDebounce, useDesign } from '../../lib/hooks.js';
import { Stamp } from '../../components/Stamp.jsx';
import { playStamp } from '../../lib/sound.js';
import { isStaff, isAusbilder } from '../../lib/roles.js';
import { softDelete } from '../../lib/trash.js';
import ShareLinkModal from '../../components/ShareLinkModal.jsx';
import { Avatar, Field, EmptyState } from '../../components/UI.jsx';
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx';
import { PdfOcrImport } from './PdfOcrImport.jsx';
import {
  IcoReport, IcoCheck, IcoEdit, IcoPlus, IcoBack,
  IcoDoc, IcoNote, IcoAlert, IcoUsers, IcoClock,
  IcoStar, IcoChevron, IcoSearch, IcoX
} from '../../components/Icons.jsx';

// Status labels are resolved at runtime via t() in the components below
// We keep a helper to map key → color/bg; labels come from i18n
const STATUS_REPORT_META = {
  draft:     { c: C.mu,  bg: 'var(--c-sf2)' },
  submitted: { c: C.ac,  bg: C.acd          },
  reviewed:  { c: C.yw,  bg: C.ywd          },
  signed:    { c: C.gr,  bg: 'var(--st-green-bg)'      },
};

function useStatusReport() {
  const { t } = useTranslation();
  return {
    draft:     { l: t('report.statusDraft'),     ...STATUS_REPORT_META.draft     },
    submitted: { l: t('report.statusSubmitted'), ...STATUS_REPORT_META.submitted },
    reviewed:  { l: t('report.statusReviewed'),  ...STATUS_REPORT_META.reviewed  },
    signed:    { l: t('report.statusSigned'),    ...STATUS_REPORT_META.signed    },
  };
}
// Legacy static map for printouts (no hook needed there, strings stay in DE as print output is always DE)
const STATUS_REPORT = {
  draft:     { l: 'Entwurf',        c: C.mu,  bg: 'var(--c-sf2)' },
  submitted: { l: 'Eingereicht',    c: C.ac,  bg: C.acd          },
  reviewed:  { l: 'Geprüft',        c: C.yw,  bg: C.ywd          },
  signed:    { l: 'Unterschrieben', c: C.gr,  bg: 'var(--st-green-bg)'      },
};

// HTML-Escape für Druck-Fenster: document.write interpoliert User-Inhalte roh —
// ohne Escaping wäre das Stored XSS im same-origin Popup (z.B. Jahresmappe mit fremden Berichten).
const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const getMonday = (d: string | Date = new Date()) => isoWeekMonday(d);

const TEMPLATES = [
  { label: 'Standard', activities: `Montag:\n- \n\nDienstag:\n- \n\nMittwoch:\n- \n\nDonnerstag:\n- \n\nFreitag:\n- `, learnings: `Was ich diese Woche gelernt habe:\n- \n\nSchwierigkeiten:\n- ` },
  { label: 'Projekt', activities: `Projekttitel: \n\nAufgaben diese Woche:\n- \n\nErreichter Stand:\n- \n\nNächste Schritte:\n- `, learnings: `Neue Erkenntnisse:\n- \n\nProbleme und Lösungen:\n- ` },
  { label: 'Schul- & Betrieb', activities: `Betrieb (Mo/Di/Do/Fr):\n- \n\nBerufsschule (Mi):\n- Fächer: \n- Themen: `, learnings: `Im Betrieb gelernt:\n- \n\nIn der Schule gelernt:\n- ` },
];

function ReportCard({ report, currentUser, onOpen, onSubmit, onSign, onDelete, stamped = false }: {
  report: Report; currentUser: User;
  onOpen: (r: Report) => void; onSubmit: (id: Id) => void; onSign: (id: Id) => void; onDelete: (id: Id) => void;
  stamped?: boolean;   // true direkt nach Statuswechsel → Stempel-Aufschlag (Beta)
}) {
  const { t } = useTranslation();
  const design = useDesign();
  const STATUS_REPORT_I18N = useStatusReport();
  const st       = STATUS_REPORT_I18N[report.status as keyof ReturnType<typeof useStatusReport>] || STATUS_REPORT_I18N.draft;
  const iso      = getISOWeek(report.week_start);
  const kw       = iso.week;
  const isoYear  = iso.year ?? new Date(report.week_start as string).getFullYear();
  const canSubmit = report.status === 'draft' && String(report.user_id) === String(currentUser.id);
  const canSign   = ['submitted','reviewed'].includes(report.status as string) && isAusbilder(currentUser);
  const canDelete = isAusbilder(currentUser) ||
    (String(report.user_id) === String(currentUser.id) && report.status === 'draft');
  const weekEnd   = new Date(new Date(report.week_start as string).getTime() + 4 * 86400000).toISOString().split('T')[0];

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
          {isStaff(currentUser) && report.user_name && (
            <div style={{ fontSize: 11, color: C.ac, marginTop: 3, fontWeight: 600 }}>{report.user_name}</div>
          )}
        </div>
        {design === 'beta' && report.status !== 'draft'
          ? <Stamp label={st.l} color={report.status === 'signed' ? 'red' : 'blue'} seed={report.id} stamped={stamped} />
          : <span className="tag" style={{ background: st.bg, color: st.c, border: `1px solid ${st.c}35`, flexShrink: 0 }}>● {st.l}</span>}
      </div>

      {report.title && (
        <div style={{ fontSize: 12, color: C.mu, marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.title}</div>
      )}

      {report.file && typeof report.file === 'object' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.ac, marginBottom: 7 }}>
          <IcoDoc size={11} /> {report.file.name}
          <span style={{ color: C.mu }}>({((report.file.size || 0) / 1024).toFixed(0)} KB)</span>
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
            <IcoChevron size={11} /> {t('report.submit')}
          </button>
        )}
        {canSign && (
          <button className="abtn" onClick={e => { e.stopPropagation(); onSign(report.id); }}
            style={{ fontSize: 11, padding: '5px 12px', background: C.gr, display: 'flex', alignItems: 'center', gap: 5 }}>
            <IcoCheck size={11} /> {t('report.confirm')}
          </button>
        )}
        {canDelete && (
          <button className="del" onClick={e => { e.stopPropagation(); onDelete(report.id); }}
            style={{ marginLeft: 'auto', fontSize: 12 }} title={t('report.reports')}>×</button>
        )}
      </div>
    </div>
  );
}

function ReportEditor({ report, currentUser, projects, onSave, onClose, showToast }: {
  report: Report | null; currentUser: User; projects: Project[];
  onSave: (rep: Report) => void; onClose: () => void; showToast: (msg: string, opts?: any) => void;
}) {
  const { t } = useTranslation();
  const design = useDesign();
  const STATUS_REPORT_I18N = useStatusReport();
  // Editor-Formular: gemischte Blob-Form (Report-Felder + sectionComments-Default + file-Objekt)
  // weicht vom Report-Schema ab → bewusst `any`
  const [form, setForm] = useState<any>({
    title:            report?.title            || '',
    activities:       report?.activities       || '',
    learnings:        report?.learnings        || '',
    week_start:       report?.week_start       || getMonday(),
    status:           report?.status           || 'draft',
    reviewer_comment: report?.reviewer_comment || '',
    file:             report?.file             || null,
    sectionComments:  report?.sectionComments  || { activities: [], learnings: [] },
  });
  const [newComment,  setNewComment]  = useState<Record<string, string>>({ activities: '', learnings: '' });
  const [wsError,     setWsError]     = useState('');  // 0.8: leeres week_start = Inline-Fehler statt stillem Default
  const [pendingTpl,  setPendingTpl]  = useState<{ label: string; activities: string; learnings: string } | null>(null);  // Phase 4: Vorlage bei nicht-leerem Text bestätigen
  const [tab,         setTab]         = useState<string>('text');
  const [copied,      setCopied]      = useState('');
  const [showOcr,     setShowOcr]     = useState(false);
  const [aiLoading,   setAiLoading]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOwner  = !report || String(report.user_id) === String(currentUser.id);
  const isReview = isAusbilder(currentUser);
  // Mentor sieht alles wie Review-Modus, aber kann nichts speichern → readOnly forciert.
  // `report &&`-Guard: ein NEUER Bericht (report=null) ist ein Entwurf des Azubi → editierbar
  // (ohne Guard wäre `undefined !== 'draft'` true → ganzes Formular gesperrt, kein Speichern-Button).
  const readOnly = (!!report && report.status !== 'draft' && !isReview) || (!isOwner && isStaff(currentUser) && !isReview);
  const kw       = getKW(form.week_start);

  const insertTemplate = (tmpl: { label: string; activities: string; learnings: string }) => { setForm((f: any) => ({ ...f, activities: tmpl.activities, learnings: tmpl.learnings })); showToast('✓ Vorlage eingefügt'); };
  // Phase 4: bei vorhandenem Text erst bestätigen (Datenverlust vermeiden)
  const applyTemplate = (tmpl: { label: string; activities: string; learnings: string }) => {
    if (form.activities?.trim() || form.learnings?.trim()) { setPendingTpl(tmpl); return; }
    insertTemplate(tmpl);
  };

  const autoFillFromTasks = () => {
    const ws  = form.week_start;
    const we  = (() => { const d = new Date(ws); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0]; })();
    const groups: { title: string; tasks: Task[] }[] = [];
    (projects || []).forEach((p: Project) => {
      const wt = (p.tasks || []).filter((t: Task) => t.text && t.deadline && t.deadline >= ws && t.deadline <= we);
      if (wt.length) groups.push({ title: p.title, tasks: wt });
    });
    if (!groups.length) { showToast('⚠ Keine Aufgaben mit Deadline in dieser KW'); return; }
    const text = groups.map(g =>
      `${g.title}:\n${g.tasks.map((t: Task) => `- ${t.text}${t.status === 'done' ? ' ✓' : ''}`).join('\n')}`
    ).join('\n\n');
    setForm((f: any) => ({ ...f, activities: f.activities ? `${f.activities}\n\n${text}` : text }));
    showToast(`✓ ${groups.reduce((s, g) => s + g.tasks.length, 0)} Aufgaben eingefügt`);
  };

  const aiWriteReport = useCallback(async () => {
    const ws  = form.week_start;
    const we  = (() => { const d = new Date(ws); d.setDate(d.getDate() + 6); return d.toISOString().split('T')[0]; })();
    const taskGroups: { project: string; tasks: string[] }[] = [];
    (projects || []).forEach((p: Project) => {
      const wt = (p.tasks || []).filter((task: Task) => task.text && task.deadline && task.deadline >= ws && task.deadline <= we);
      if (wt.length) taskGroups.push({ project: p.title, tasks: wt.map((task: Task) => task.text + (task.status === 'done' ? ' (erledigt)' : '')) });
    });
    if (!taskGroups.length) { showToast(t('report.aiAutofillNoTasks', { kw })); return; }
    setAiLoading(true);
    try {
      const result = await dataService.fillReport({
        taskGroups,
        weekNumber: kw as number,
        year: new Date(ws).getFullYear(),
        profession: currentUser?.profession || '',
        lehrjahr:   currentUser?.apprenticeship_year || 1,
      });
      setForm((f: any) => ({ ...f, activities: result.activities || f.activities, learnings: result.learnings || f.learnings }));
      showToast(t('report.aiAutofillDone'));
    } catch (e: any) {
      showToast(t('report.aiAutofillError', { msg: e.message }));
    } finally {
      setAiLoading(false);
    }
  }, [form.week_start, projects, kw, currentUser, showToast, t]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      // Clipboard-API verweigert haeufig in non-secure Contexts (HTTP) oder
      // wenn das Dokument nicht fokussiert ist. User braucht Feedback.
      showToast('⚠ Kopieren fehlgeschlagen — bitte manuell markieren');
    }
  };

  const handleFile = (e: any) => {
    const file = e.target?.files?.[0] || e;
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.type?.includes('pdf')) { showToast('⚠ Nur PDF-Dateien'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('⚠ Max. 10 MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => { setForm((f: any) => ({ ...f, file: { name: file.name, size: file.size, type: file.type, data: ev.target!.result } })); showToast('✓ PDF geladen'); };
    reader.onerror = () => { showToast('⚠ PDF konnte nicht gelesen werden'); };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: any) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleFile(file); };

  const save = () => {
    // 0.8: leeres/ungültiges week_start nicht still defaulten, sondern als Inline-Fehler melden
    const ws = new Date(form.week_start);
    if (!form.week_start || Number.isNaN(ws.getTime())) {
      setWsError('Bitte eine gültige Berichtswoche wählen.');
      setTab('text');
      return;
    }
    setWsError('');
    // ISO-Wochenjahr (passend zur ISO-kw), NICHT Kalenderjahr des Montags — sonst Fehlzuordnung am Jahreswechsel
    // (z.B. Mo 29.12.2025 = ISO KW1/2026, getFullYear() liefert aber 2025).
    const year = getISOWeek(form.week_start).year ?? ws.getFullYear();
    const newReport = { id: report?.id || uid(), user_id: currentUser.id, user_name: currentUser.name, ...form, week_number: kw, year, updated_at: new Date().toISOString(), created_at: report?.created_at || new Date().toISOString() };
    // Signed ist terminal (Bug-Hunt KAL-F3): normales Speichern darf die Unterschrift nie zurückdrehen
    if (report?.status === 'signed') newReport.status = 'signed';
    onSave(newReport as Report);
    showToast('✓ Berichtsheft gespeichert');
  };

  // Einfache Druck-Variante (Standard) — knappes 1-Seiten-Layout
  const printReport = () => printVariant('standard');

  // J17: IHK-konforme Druck-Variante mit:
  //  - Kopfzeile mit Beruf/Betrieb (DIN 5008)
  //  - Stammdaten-Block (Azubi, Ausbildungsjahr, Ausbildungszeitraum)
  //  - 25 mm linker Rand für Hefter
  //  - Unterschriftenfelder (Azubi, Ausbilder, ggf. Erziehungsberechtigter)
  //  - Seitennummer-Variable im Footer (CSS-Counter)
  const printReportIHK = () => printVariant('ihk');

  const printVariant = (variant: string) => {
    const w = window.open('', '_blank');
    if (!w) { showToast('⚠ Popup blockiert – bitte Pop-ups erlauben'); return; }
    const isoYear = getISOWeek(form.week_start).year ?? new Date(form.week_start).getFullYear();
    const weekEndDate = new Date(new Date(form.week_start).getTime() + 4 * 86400000);
    const weekRange = `${new Date(form.week_start).toLocaleDateString('de-DE')} – ${weekEndDate.toLocaleDateString('de-DE')}`;
    const today = new Date().toLocaleDateString('de-DE');

    // Profil-Felder vom Azubi (falls vorhanden)
    const profession = currentUser.profession || '';
    const azYear     = currentUser.apprenticeship_year ?? '';

    if (variant === 'standard') {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Berichtsheft KW ${kw} – ${esc(currentUser.name)}</title>
      <style>
        body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;color:#111;font-size:14px;line-height:1.7}
        h1{font-size:22px;margin-bottom:4px}
        h2{font-size:15px;font-weight:700;margin:22px 0 8px;border-bottom:2px solid #eee;padding-bottom:4px}
        p,pre{margin:0 0 14px;white-space:pre-wrap;word-break:break-word}
        .meta{color:#666;font-size:12px;margin-bottom:24px}
        .status{display:inline-block;padding:2px 10px;border-radius:4px;font-size:12px;font-weight:700;background:#e8f5e9;color:#2e7d32}
        hr{border:none;border-top:1px solid #ddd;margin:24px 0}
        @media print{ body{margin:20px} -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      </style>
      </head><body>
      <h1>Ausbildungsnachweis – KW ${kw} / ${isoYear}</h1>
      <div class="meta">
        <strong>${esc(currentUser.name)}</strong> · Woche vom ${new Date(form.week_start).toLocaleDateString('de-DE')} ·
        <span class="status">${esc(STATUS_REPORT[form.status as keyof typeof STATUS_REPORT]?.l || form.status)}</span>
      </div>
      ${form.title ? `<h2>Thema</h2><p>${esc(form.title)}</p>` : ''}
      <h2>Durchgeführte Tätigkeiten</h2><pre>${esc(form.activities) || '–'}</pre>
      <h2>Unterweisungen / Lerninhalt</h2><pre>${esc(form.learnings) || '–'}</pre>
      ${form.reviewer_comment ? `<hr><h2>Kommentar des Ausbilders</h2><pre>${esc(form.reviewer_comment)}</pre>` : ''}
      <hr><p style="font-size:11px;color:#999">Erstellt mit AzubiBoard · ${today}</p>
      </body></html>`);
    } else {
      // IHK-Variante: A4, 25mm linker Rand, formaler Aufbau
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ausbildungsnachweis KW ${kw}/${isoYear} – ${esc(currentUser.name)}</title>
      <style>
        @page { size: A4; margin: 20mm 15mm 20mm 25mm; }
        body{font-family:'Times New Roman',Georgia,serif;color:#000;font-size:11pt;line-height:1.5;margin:0}
        .header{border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end}
        .header .title{font-size:14pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px}
        .header .sub{font-size:9pt;color:#444;margin-top:2px}
        .stammdaten{border:1px solid #000;padding:10px 14px;margin-bottom:18px;font-size:10pt}
        .stammdaten table{width:100%;border-collapse:collapse}
        .stammdaten td{padding:3px 6px;vertical-align:top}
        .stammdaten td.lbl{color:#555;width:40%;font-weight:600}
        h2{font-size:11pt;font-weight:bold;margin:18px 0 6px;border-bottom:1px solid #555;padding-bottom:2px;text-transform:uppercase;letter-spacing:0.3px}
        pre{font-family:'Times New Roman',Georgia,serif;font-size:11pt;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin:0 0 12px}
        .empty{color:#888;font-style:italic}
        .signatures{margin-top:32px;display:flex;gap:28px;justify-content:space-between}
        .sigblock{flex:1;border-top:1px solid #000;padding-top:5px;font-size:9pt;text-align:center}
        .sigblock .role{font-weight:bold}
        .sigblock .meta{color:#555;margin-top:2px}
        .footer{position:fixed;bottom:8mm;left:0;right:0;text-align:center;font-size:8pt;color:#888;font-style:italic}
        @media print{
          -webkit-print-color-adjust:exact; print-color-adjust:exact;
          h2{page-break-after:avoid}
          pre{page-break-inside:avoid}
          .signatures{page-break-inside:avoid}
        }
      </style>
      </head><body>
        <div class="header">
          <div>
            <div class="title">Ausbildungsnachweis · Berichtsheft</div>
            <div class="sub">Kalenderwoche ${kw} / ${isoYear} · ${weekRange}</div>
          </div>
          <div style="text-align:right;font-size:9pt;color:#444">Seite 1</div>
        </div>

        <div class="stammdaten">
          <table>
            <tr><td class="lbl">Auszubildende/r:</td><td>${esc(currentUser.name) || '–'}</td></tr>
            ${profession ? `<tr><td class="lbl">Ausbildungsberuf:</td><td>${esc(profession)}</td></tr>` : ''}
            ${azYear ? `<tr><td class="lbl">Ausbildungsjahr:</td><td>${esc(azYear)}. Lehrjahr</td></tr>` : ''}
            <tr><td class="lbl">Berichtswoche:</td><td>${weekRange}</td></tr>
            ${form.title ? `<tr><td class="lbl">Thema der Woche:</td><td>${esc(form.title)}</td></tr>` : ''}
          </table>
        </div>

        <h2>Durchgeführte betriebliche Tätigkeiten</h2>
        ${form.activities ? `<pre>${esc(form.activities)}</pre>` : '<p class="empty">(keine Angaben)</p>'}

        <h2>Unterweisungen / Lerninhalte / Berufsschule</h2>
        ${form.learnings ? `<pre>${esc(form.learnings)}</pre>` : '<p class="empty">(keine Angaben)</p>'}

        ${form.reviewer_comment ? `<h2>Kommentar des Ausbilders</h2><pre>${esc(form.reviewer_comment)}</pre>` : ''}

        <div class="signatures">
          <div class="sigblock">
            <div class="role">Unterschrift Auszubildende/r</div>
            <div class="meta">Datum: __________________</div>
          </div>
          <div class="sigblock">
            <div class="role">Unterschrift Ausbilder/in</div>
            <div class="meta">Datum: __________________</div>
          </div>
          <div class="sigblock">
            <div class="role">ggf. ges. Vertretung</div>
            <div class="meta">Datum: __________________</div>
          </div>
        </div>

        <div class="footer">Erstellt mit AzubiBoard · ${today}</div>
      </body></html>`);
    }

    w.document.close();
    w.focus();
    if (w.document.readyState === 'complete') w.print();
    else w.onload = () => w.print();
  };

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} className="anim">
      <div style={{ background: 'var(--c-sf)', borderBottom: `1px solid var(--c-bd)`, padding: '10px 20px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn" onClick={onClose} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><IcoBack size={12} /> {t('common.back')}</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>{report ? t('report.editTitle', { kw }) : t('report.newTitle')}</div>
          {report?.status && <div style={{ fontSize: 10, color: STATUS_REPORT_I18N[report.status as keyof typeof STATUS_REPORT_I18N]?.c, fontWeight: 700 }}>● {STATUS_REPORT_I18N[report.status as keyof typeof STATUS_REPORT_I18N]?.l}</div>}
        </div>
        <div role="tablist" style={{ display: 'flex', background: 'var(--c-sf2)', borderRadius: 8, padding: 3, gap: 3 }}>
          {([['text', t('report.tabText'), IcoDoc], ['upload', t('report.tabPdf'), IcoReport]] as [string, string, any][]).map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 6, fontSize: 11, fontWeight: 700, border: 'none', background: tab === k ? C.ac : 'transparent', color: tab === k ? '#fff' : C.mu, cursor: 'pointer', transition: 'all .12s' }}>
              <Icon size={12} />{l}
            </button>
          ))}
        </div>
        <button className="btn" onClick={printReport} title="Einfaches PDF (1 Seite)" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>{t('report.printSimple')}</button>
        <button className="btn" onClick={printReportIHK} title="IHK-konform mit Stammdaten + Unterschriftenfeldern" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, borderColor: 'var(--c-ac)', color: 'var(--c-ac)' }}>{t('report.printIHK')}</button>
        {isOwner && !readOnly && (
          <button className="btn" onClick={() => setShowOcr(true)} title="Handschriftliches Berichtsheft per OCR einscannen"
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, borderColor: `color-mix(in srgb, ${C.yw} 50%, transparent)`, color: C.yw }}>
            {t('report.ocrImport')}
          </button>
        )}
        {readOnly && !isReview && (
          <div style={{ padding: '5px 12px', background: C.ywd, border: `1px solid color-mix(in srgb, ${C.yw} 31%, transparent)`, borderRadius: 7, fontSize: 11, color: C.yw, display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            {t('report.locked')}
          </div>
        )}
        {isOwner && !readOnly && (
          <button className="abtn" onClick={save} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}><IcoCheck size={13} /> {t('report.saveBtn')}</button>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 20, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>{t('report.metadataLabel')}</div>
            <Field label={t('report.weekStart')}>
              <input type="date" value={form.week_start} max={new Date().toISOString().split('T')[0]} disabled={!isOwner || readOnly} onChange={e => { setWsError(''); setForm((f: any) => ({ ...f, week_start: e.target.value })); }} />
              {wsError && <div role="alert" style={{ fontSize: 11, color: C.cr, marginTop: 4 }}>{wsError}</div>}
            </Field>
            <Field label={t('report.weekTitle')}>
              <input value={form.title} disabled={!isOwner || readOnly} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="z.B. Projektarbeit Woche 3" />
            </Field>
            <div style={{ fontSize: 11, color: C.mu, marginTop: 4 }}>KW {kw} · {new Date(form.week_start).getFullYear()}</div>
          </div>

          {isOwner && !readOnly && tab === 'text' && (
            <div className="card">
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>{t('report.autofillLabel')}</div>
              <button onClick={autoFillFromTasks} className="abtn"
                style={{ fontSize: 11, width: '100%', justifyContent: 'flex-start', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, background: C.gr }}>
                {t('report.autofillBtn')}
              </button>
              <button onClick={aiWriteReport} disabled={aiLoading} className="abtn"
                style={{ fontSize: 11, width: '100%', justifyContent: 'flex-start', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, background: C.ac, opacity: aiLoading ? .7 : 1 }}>
                {aiLoading ? t('report.aiAutofillLoading') : t('report.aiAutofillBtn')}
              </button>
              <div style={{ fontSize: 9, color: C.mu, marginBottom: 10, lineHeight: 1.5 }}>
                {t('report.autofillHint', { kw })}
              </div>
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 8 }}>{t('report.templateLabel')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {TEMPLATES.map(t => (
                  <button key={t.label} onClick={() => applyTemplate(t)} className="btn"
                    style={{ fontSize: 11, justifyContent: 'flex-start', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IcoDoc size={11} /> {t.label}
                  </button>
                ))}
              </div>
              {pendingTpl && (
                <ConfirmDialog
                  message={`Vorlage „${pendingTpl.label}" einfügen? Der vorhandene Text in Tätigkeiten/Lerninhalt wird überschrieben.`}
                  confirmLabel="Überschreiben" danger
                  onConfirm={() => { insertTemplate(pendingTpl); setPendingTpl(null); }}
                  onCancel={() => setPendingTpl(null)}
                />
              )}
            </div>
          )}

          {isReview && report && (
            <div className="card">
              <div style={{ fontSize: 10, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, fontWeight: 700, marginBottom: 10 }}>{t('report.reviewerLabel')}</div>
              <Field label={t('report.reviewerComment')}>
                <textarea value={form.reviewer_comment} onChange={e => setForm((f: any) => ({ ...f, reviewer_comment: e.target.value }))} placeholder="Feedback, Hinweise…" style={{ minHeight: 80, fontSize: 12 }} />
              </Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['submitted','reviewed'].includes(report?.status as string) && (
                  <button className="abtn"
                    onClick={() => { onSave({ ...report, ...form, status: 'reviewed', reviewed_at: new Date().toISOString() }); showToast('✓ Als geprüft markiert'); }}
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, background: C.yw }}>
                    <IcoCheck size={12} /> {t('report.markReviewed')}
                  </button>
                )}
                {/* Phase 2: Direkt-Unterschreiben auch bei 'submitted' (wie auf der Karte) — Geprüft-Zwischenschritt optional */}
                {['submitted','reviewed'].includes(report?.status as string) && (
                  <button className="abtn"
                    onClick={() => { onSave({ ...report, ...form, status: 'signed', signed_at: new Date().toISOString() }); showToast('✓ Unterschrieben'); }}
                    style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, background: C.gr }}>
                    <IcoStar size={12} /> {t('report.signReport')}
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
                { key: 'activities', num: '01', label: t('report.activitySection'), Icon: IcoDoc, color: C.ac, ph: 'Beschreibe deine Tätigkeiten der Woche...', minH: 200 },
                { key: 'learnings',  num: '02', label: t('report.learningSection'),  Icon: IcoNote, color: C.yw, ph: 'Was hast du diese Woche gelernt? Neue Erkenntnisse?', minH: 160 },
              ].map(({ key, num, label, Icon, color, ph, minH }) => {
                const comments = (form.sectionComments?.[key] || []);
                const addComment = () => {
                  const txt = newComment[key]?.trim();
                  if (!txt) return;
                  const entry = { id: Date.now().toString(36), text: txt, reviewerName: currentUser.name, ts: new Date().toISOString() };
                  setForm((f: any) => ({ ...f, sectionComments: { ...f.sectionComments, [key]: [...(f.sectionComments?.[key]||[]), entry] } }));
                  setNewComment((n: any) => ({ ...n, [key]: '' }));
                };
                const delComment = (id: any) => {
                  setForm((f: any) => ({ ...f, sectionComments: { ...f.sectionComments, [key]: (f.sectionComments?.[key]||[]).filter((c: any) => c.id !== id) } }));
                };
                return (
                  <div key={key} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {design === 'beta'
                          ? <span style={{ fontFamily: C.mono, fontSize: 11, fontWeight: 700, color: C.mu }}>{num}</span>
                          : <Icon size={13} style={{ color }} />}
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.tx, textTransform: 'uppercase', letterSpacing: .7, ...(design === 'beta' ? { fontFamily: C.mono, letterSpacing: '.14em' } : {}) }}>{label}</span>
                        {comments.length > 0 && <span style={{ fontSize: 9, background: C.ywd, color: C.yw, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{comments.length} Kommentar{comments.length !== 1 ? 'e' : ''}</span>}
                      </div>
                      <button onClick={() => copyToClipboard(form[key], key)} className="btn" style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {copied === key ? <><IcoCheck size={10} /> {t('common.copied')}</> : t('common.copy')}
                      </button>
                    </div>
                    <textarea value={form[key]} disabled={!isOwner || readOnly} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))} placeholder={ph}
                      style={{ minHeight: minH, fontSize: 12, lineHeight: 1.7 }} />

                    {/* Ausbilder-Kommentare */}
                    {(comments.length > 0 || isReview) && (
                      <div style={{ marginTop: 10, borderTop: `1px solid ${C.bd}`, paddingTop: 10 }}>
                        <div style={{ fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 7 }}>{t('report.reviewerComments')}</div>
                        {comments.map((c: any) => (
                          <div key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 9px', background: C.ywd, border: `1px solid color-mix(in srgb, ${C.yw} 15%, transparent)`, borderRadius: 7, marginBottom: 5 }}>
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
                            <input value={newComment[key] || ''} onChange={e => setNewComment((n: any) => ({ ...n, [key]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addComment())}
                              placeholder={t('report.addComment')} style={{ flex: 1, fontSize: 11, padding: '5px 9px' }} />
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
                <IcoReport size={13} style={{ color: C.ac }} /> {t('report.pdfUploadTitle')}
              </div>
              <div
                style={{ border: `2px dashed ${C.bd2}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center', background: 'var(--c-sf3)', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = C.ac; e.currentTarget.style.background = C.acd; }}
                onDragLeave={e => { e.currentTarget.style.borderColor = C.bd2; e.currentTarget.style.background = 'var(--c-sf3)'; }}
                onDrop={e => { e.currentTarget.style.borderColor = C.bd2; e.currentTarget.style.background = 'var(--c-sf3)'; handleDrop(e); }}
                onClick={() => fileRef.current?.click()}>
                <IcoReport size={32} style={{ color: C.mu, marginBottom: 10, display: 'block', margin: '0 auto 10px' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: C.tx, marginBottom: 5 }}>{t('report.pdfDropHint')}</div>
                <div style={{ fontSize: 11, color: C.mu }}>{t('report.pdfTypeHint')}</div>
                <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFile(e)} />
              </div>
              {form.file && typeof form.file === 'object' && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: C.acd, border: `1px solid color-mix(in srgb, ${C.ac} 19%, transparent)`, borderRadius: 8, marginBottom: 10 }}>
                    <IcoDoc size={16} style={{ color: C.ac, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.file.name}</div>
                      <div style={{ fontSize: 10, color: C.mu }}>{((form.file.size || 0) / 1024).toFixed(0)} KB</div>
                    </div>
                    {isOwner && !readOnly && (
                      <button onClick={() => setForm((f: any) => ({ ...f, file: null }))} className="del" style={{ fontSize: 14 }}>×</button>
                    )}
                  </div>
                  {form.file.data && (
                    <iframe src={form.file.data} title="PDF Vorschau" style={{ width: '100%', height: 500, border: `1px solid var(--c-bd)`, borderRadius: 8, background: '#fff' }} />
                  )}
                </div>
              )}
              {form.file && typeof form.file === 'string' && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: C.acd, border: `1px solid color-mix(in srgb, ${C.ac} 19%, transparent)`, borderRadius: 8 }}>
                    <IcoDoc size={16} style={{ color: C.ac, flexShrink: 0 }} />
                    <a href={form.file} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: C.ac, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Hochgeladene Datei öffnen</a>
                    {isOwner && !readOnly && (
                      <button onClick={() => setForm((f: any) => ({ ...f, file: null }))} className="del" style={{ fontSize: 14 }}>×</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {showOcr && (
      <PdfOcrImport
        existingFile={form.file}
        onImport={({ activities, learnings }: { activities: any; learnings: any }) => {
          setForm((f: any) => ({
            ...f,
            activities: activities || f.activities,
            learnings:  learnings  || f.learnings,
          }));
          showToast('✓ OCR-Vorschlag übernommen – bitte prüfen');
        }}
        onClose={() => setShowOcr(false)}
      />
    )}
    </>
  );
}

function printJahresmappe(reports: Report[], year: number, showToast?: (msg: string, opts?: any) => void) {
  const yearReports = reports
    .filter((r: Report) => {
      const iso = getISOWeek(r.week_start);
      const ry  = r.year ?? iso.year ?? new Date(r.week_start as string).getFullYear();
      return ry === year;
    })
    .sort((a: Report, b: Report) => +new Date(a.week_start as string) - +new Date(b.week_start as string));

  if (!yearReports.length) {
    showToast?.(`⚠ Keine Berichte für ${year} vorhanden`);
    return;
  }

  const byUser = yearReports.reduce((acc: Record<string, { name: string; reports: Report[] }>, r: Report) => {
    const key = String(r.user_id);
    if (!acc[key]) acc[key] = { name: r.user_name || 'Unbekannt', reports: [] };
    acc[key].reports.push(r);
    return acc;
  }, {} as Record<string, { name: string; reports: Report[] }>);

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
    <h2>${esc(u.name)}</h2>
    ${u.reports.map((r: Report, i: number) => {
      const iso = getISOWeek(r.week_start);
      const kw  = r.week_number ?? iso.week ?? '';
      const yr  = r.year ?? iso.year ?? year;
      return `
      ${i > 0 ? '<hr class="divider">' : ''}
      <div class="kw">KW ${kw}/${yr}</div>
      <div class="meta">${new Date(r.week_start as string).toLocaleDateString('de-DE')} · <span class="status">${esc(r.status)}</span></div>
      ${r.title ? `<h3>${esc(r.title)}</h3>` : ''}
      <h3>Tätigkeiten</h3><pre>${esc(r.activities) || '–'}</pre>
      <h3>Lerninhalt</h3><pre>${esc(r.learnings) || '–'}</pre>
      ${r.reviewer_comment ? `<h3>Ausbilder-Kommentar</h3><pre>${esc(r.reviewer_comment)}</pre>` : ''}
    `;}).join('')}
  `).join('<div class="pagebreak"></div>')}
  <p style="margin-top:50px;font-size:10px;color:#999;text-align:center">Erstellt mit AzubiBoard · ${new Date().toLocaleDateString('de-DE')}</p>
  </body></html>`);
  w.document.close();
  if (w.document.readyState === 'complete') w.print();
  else w.onload = () => w.print();
}

export default function ReportsPage({ currentUser, data, onUpdateData, showToast }: {
  currentUser: User; data: AppState; onUpdateData: (next: AppState) => void; showToast: (msg: string, opts?: any) => void;
}) {
  const { t } = useTranslation();
  const STATUS_REPORT_I18N = useStatusReport();
  const reports: Report[] = data.reports || [];
  const [view,    setView]   = useState('list');
  const [editing, setEditing]= useState<Report | null>(null);
  // 0.5: Ausbilder steigen direkt bei den zu prüfenden (eingereichten) Berichten ein
  const [filter,  setFilter] = useState(() => isAusbilder(currentUser) ? 'submitted' : 'alle');
  const [search,  setSearch] = useState('');
  const dSearch = useDebounce(search);
  const [confirmDel, setConfirmDel] = useState<Id | null>(null);
  const [shareOpen,  setShareOpen]  = useState(false);  // J10
  const [justStamped, setJustStamped] = useState<Id | null>(null);  // Beta: Stempel-Aufschlag nach Statuswechsel

  const myReports = currentUser.role === 'azubi' ? reports.filter((r: Report) => String(r.user_id) === String(currentUser.id)) : reports;
  const q = dSearch.trim().toLowerCase();
  const filtered = myReports
    .filter((r: Report) => filter === 'alle' || r.status === filter)
    .filter((r: Report) => !q || (
      (r.title || '').toLowerCase().includes(q) ||
      (r.activities || '').toLowerCase().includes(q) ||
      (r.learnings || '').toLowerCase().includes(q) ||
      (r.user_name || '').toLowerCase().includes(q) ||
      String(r.week_number).includes(q)
    ));

  const saveReport = (rep: Report) => {
    const existing = reports.find((r: Report) => r.id === rep.id);
    const next = { ...data, reports: existing ? reports.map((r: Report) => r.id === rep.id ? rep : r) : [...reports, rep] };
    const iso  = getISOWeek(rep.week_start);
    // addActivity ist JS-Boundary (activityLog: ActivityEntry[] vs Blob unknown[]) → Cast
    onUpdateData(addActivity(next, {
      type:        'report_saved',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: `KW ${iso.week ?? '?'}/${iso.year ?? '?'}`,
      projectId:   null,
      projectTitle:null,
      action:      existing ? 'Berichtsheft aktualisiert' : 'Berichtsheft angelegt',
    }) as unknown as AppState);
  };

  const deleteReport = (id: Id) => {
    setConfirmDel(id);
    // Toast fires in ConfirmDialog.onConfirm, not here
  };

  // Beta: frisch gestempelte Karte bekommt den Aufschlag (Anhang C — Zeremonie nur bei echter Aktion)
  const markStamped = (id: Id) => {
    playStamp(); // Werkstatt-Sound (opt-in, gated in sound.ts)
    setJustStamped(id);
    setTimeout(() => setJustStamped(null), 1500);
  };

  const submitReport = (id: Id) => {
    markStamped(id);
    const rep = reports.find((r: Report) => r.id === id);
    const iso = rep ? getISOWeek(rep.week_start) : { week: '?', year: '?' };
    const next = { ...data, reports: reports.map((r: Report) => r.id === id ? { ...r, status: 'submitted', submitted_at: new Date().toISOString() } : r) };
    // addActivity ist JS-Boundary (activityLog: ActivityEntry[] vs Blob unknown[]) → Cast
    onUpdateData(addActivity(next, {
      type:        'report_submitted',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: `KW ${iso.week}/${iso.year}`,
      projectId:   null,
      projectTitle:null,
      action:      'Berichtsheft eingereicht',
    }) as unknown as AppState);
    showToast('✓ Berichtsheft eingereicht');
  };

  const signReport = (id: Id) => {
    markStamped(id);
    const rep = reports.find((r: Report) => r.id === id);
    const iso = rep ? getISOWeek(rep.week_start) : { week: '?', year: '?' };
    const next = { ...data, reports: reports.map((r: Report) => r.id === id ? { ...r, status: 'signed', signed_at: new Date().toISOString() } : r) };
    // addActivity ist JS-Boundary (activityLog: ActivityEntry[] vs Blob unknown[]) → Cast
    onUpdateData(addActivity(next, {
      type:        'report_signed',
      userId:      currentUser.id,
      userName:    currentUser.name,
      entityTitle: `KW ${iso.week}/${iso.year}` + (rep?.user_name ? ` · ${rep.user_name}` : ''),
      projectId:   null,
      projectTitle:null,
      action:      'Berichtsheft signiert',
    }) as unknown as AppState);
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
          <h1 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>{t('report.reports')}</h1>
          <p style={{ fontSize: 12, color: C.mu, marginTop: 3 }}>
            {isStaff(currentUser) ? t('report.allReports') : t('report.myReports')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {isAusbilder(currentUser) && (
            <>
              <button className="btn" onClick={() => printJahresmappe(reports, new Date().getFullYear(), showToast)}
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                📚 {t('report.annualFolder', { year: new Date().getFullYear() })}
              </button>
              <button className="btn" onClick={() => setShareOpen(true)} title="Read-Only-Link erzeugen (für IHK/Eltern/Schule)"
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 }}>
                🔗 {t('report.share')}
              </button>
            </>
          )}
          {currentUser.role === 'azubi' && (
            <button className="abtn" onClick={() => { setEditing(null); setView('edit'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <IcoPlus size={13} /> {t('report.newReport')}
            </button>
          )}
        </div>
      </div>

      {/* Suche */}
      <div style={{ position: 'relative', marginBottom: 10, flexShrink: 0 }}>
        <IcoSearch size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.mu, pointerEvents: 'none' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('report.searchPlaceholder')}
          style={{ width: '100%', paddingLeft: 32, paddingRight: search ? 32 : 10, fontSize: 13 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.mu, display: 'flex' }}>
            <IcoX size={13} />
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        {Object.entries(STATUS_REPORT_I18N).map(([k, v]) => {
          const cnt = myReports.filter((r: Report) => r.status === k).length;
          return (
            <button key={k} type="button" className="chip-press" onClick={() => setFilter(filter === k ? 'alle' : k)} aria-pressed={filter === k} title={`Filter: ${v.l}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px', background: filter === k ? v.c + '18' : 'var(--c-sf2)', border: `1px solid ${filter === k ? v.c + '50' : 'var(--c-bd)'}`, borderRadius: 8, cursor: 'pointer', transition: 'all .12s', font: 'inherit' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: v.c, lineHeight: 1 }}>{cnt}</span>
              <span style={{ fontSize: 10, color: C.mu, fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7 }}>{v.l}</span>
            </button>
          );
        })}
        {filter !== 'alle' && (
          <button onClick={() => setFilter('alle')} className="btn" style={{ fontSize: 11 }}>{t('report.showAll')}</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <EmptyState Icon={IcoReport} doodle="laufkarte"
            title={q ? t('report.noResults', { q }) : t('report.noReports')}
            subtitle={q ? 'Versuche einen anderen Suchbegriff.' : (currentUser.role === 'azubi' ? t('report.noReportsSub') : t('report.noReportsStaff'))}
            action={!q && currentUser.role === 'azubi' ? '+ ' + t('report.newReport') : undefined}
            onAction={!q && currentUser.role === 'azubi' ? () => { setEditing(null); setView('edit'); } : undefined} />
        ) : (
          <div className="draft-in-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, alignContent: 'start' }}>
            {[...filtered].sort((a: Report, b: Report) => +new Date(b.week_start as string) - +new Date(a.week_start as string)).map((r: Report) => (
              <ReportCard key={r.id} report={r} currentUser={currentUser}
                onOpen={(rep: Report) => { setEditing(rep); setView('edit'); }}
                onSubmit={submitReport} onSign={signReport}
                onDelete={deleteReport} stamped={justStamped === r.id} />
            ))}
          </div>
        )}
      </div>

      {confirmDel && (
        <ConfirmDialog
          message={t('report.deleteConfirm')}
          onConfirm={() => {
            const snapshot = data;
            const report   = reports.find((r: Report) => r.id === confirmDel);
            if (report) {
              // softDelete ist JS-Boundary (AppData/TrashBin vs AppState) → Cast
              onUpdateData(softDelete(data as any, 'reports', report, currentUser) as unknown as AppState);
            } else {
              onUpdateData({ ...data, reports: reports.filter((r: Report) => r.id !== confirmDel) });
            }
            showToast(t('report.deletedToast'), { undo: () => onUpdateData(snapshot) });
            setConfirmDel(null);
          }}
          onCancel={() => setConfirmDel(null)}
        />
      )}

      {shareOpen && (
        <ShareLinkModal
          kind="jahresmappe"
          title={`Jahresmappe ${new Date().getFullYear()}`}
          data={{ reports: reports.filter((r: Report) => {
            const iso = getISOWeek(r.week_start);
            const yr  = r.year ?? iso.year ?? new Date(r.week_start as string).getFullYear();
            return yr === new Date().getFullYear();
          }) }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}
