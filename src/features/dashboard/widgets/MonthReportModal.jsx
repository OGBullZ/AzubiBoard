import { useState } from "react";
import { C } from '../../../lib/utils.js';
import { Avatar } from '../../../components/UI.jsx';

export function MonthReportModal({ projects, users, reports, onClose }) {
  const now  = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year,  setYear]  = useState(now.getFullYear());
  const azubis = users.filter(u => u.role === 'azubi');

  const monthStart = `${year}-${String(month + 1).padStart(2,'0')}-01`;
  const monthEnd   = new Date(year, month + 1, 0).toISOString().split('T')[0];

  const monthName  = new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const rows = azubis.map(a => {
    const hours = projects.filter(p => !p.archived).flatMap(p =>
      (p.tasks||[]).filter(t => t.assignee === a.id)
        .flatMap(t => (t.timeLog||[]).filter(e => e.date >= monthStart && e.date <= monthEnd))
        .map(e => Number(e.hours)||0)
    ).reduce((s, h) => s + h, 0);

    const done = projects.flatMap(p =>
      (p.tasks||[]).filter(t => t.assignee === a.id && t.status === 'done' && t.updated_at &&
        t.updated_at >= monthStart && t.updated_at <= monthEnd + 'T99')
    ).length;

    const myReports = reports.filter(r =>
      r.user_id === a.id && r.week_start >= monthStart && r.week_start <= monthEnd
    );

    return { azubi: a, hours, done, reports: myReports };
  });

  const [printing, setPrinting] = useState(false);
  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) { alert('Popup blockiert – bitte Pop-ups erlauben'); return; }
    setPrinting(true);
    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const totalDone  = rows.reduce((s, r) => s + r.done,  0);
    const totalReps  = rows.reduce((s, r) => s + r.reports.length, 0);
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Monatsreport ${monthName}</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;color:#111;font-size:13px}
      h1{font-size:20px}
      h2{font-size:14px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-top:20px}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px 12px;border-bottom:1px solid #eee;text-align:left}
      th{font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#666}
      tfoot td{font-weight:700;border-top:2px solid #333;background:#fafafa}
      @media print{
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
        thead{display:table-header-group}
        tr{page-break-inside:avoid}
      }
    </style>
    </head><body>
    <h1>Monatsreport – ${monthName}</h1>
    <table><thead><tr><th>Azubi</th><th>Stunden</th><th>Aufgaben ✓</th><th>Berichte</th><th>Status</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td>${r.azubi.name}</td>
      <td>${r.hours.toFixed(1)}h</td>
      <td>${r.done}</td>
      <td>${r.reports.length}</td>
      <td>${r.reports.map(rep => rep.status).join(', ') || '–'}</td>
    </tr>`).join('')}</tbody>
    <tfoot><tr><td>Gesamt</td><td>${totalHours.toFixed(1)}h</td><td>${totalDone}</td><td>${totalReps}</td><td>–</td></tr></tfoot>
    </table>
    <p style="font-size:10px;color:#999;margin-top:30px">Erstellt mit AzubiBoard · ${new Date().toLocaleDateString('de-DE')}</p>
    </body></html>`);
    w.document.close();
    const fire = () => { try { w.print(); } finally { setPrinting(false); } };
    if (w.document.readyState === 'complete') fire();
    else w.onload = fire;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 14, width: 620, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--c-bd)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.br, flex: 1 }}>📊 Monatsreport</span>
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.br }}>
            {Array.from({length:12},(_,i) => <option key={i} value={i}>{new Date(2000,i).toLocaleDateString('de-DE',{month:'long'})}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: C.br }}>
            {[now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={printReport} disabled={printing || rows.length === 0} aria-label="Monatsreport drucken"
            style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, border: `1px solid ${C.bd2}`, background: C.sf2, color: printing ? C.mu : C.br, cursor: printing ? 'wait' : 'pointer', opacity: (printing || rows.length === 0) ? .5 : 1 }}>
            {printing ? '⏳ ...' : '🖨 PDF'}
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.mu, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {/* Table */}
        <div style={{ overflowY: 'auto', padding: '12px 18px' }}>
          <div style={{ fontSize: 12, color: C.mu, marginBottom: 12, fontWeight: 600 }}>{monthName}</div>
          {rows.length === 0 ? (
            <div style={{ textAlign: 'center', color: C.mu, padding: '24px', fontSize: 13 }}>Keine Azubis vorhanden.</div>
          ) : (
            <div style={{ background: C.sf2, borderRadius: 9, overflow: 'hidden', border: `1px solid ${C.bd}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '7px 14px', background: C.sf3, borderBottom: `1px solid ${C.bd}`, fontSize: 10, color: C.mu, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 }}>
                <div>Azubi</div><div>Stunden</div><div>Aufg. ✓</div><div>Berichte</div>
              </div>
              {rows.map(r => (
                <div key={r.azubi.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', padding: '9px 14px', borderBottom: `1px solid ${C.bd}22`, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={r.azubi.name} url={r.azubi.avatar_url} size={22} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.br }}>{r.azubi.name}</span>
                  </div>
                  <div style={{ fontFamily: C.mono, fontSize: 13, fontWeight: 700, color: r.hours > 0 ? C.gr : C.mu }}>{r.hours.toFixed(1)}h</div>
                  <div style={{ fontFamily: C.mono, fontSize: 13, color: r.done > 0 ? C.ac : C.mu }}>{r.done}</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {r.reports.length === 0 ? <span style={{ fontSize: 10, color: C.mu }}>–</span> : r.reports.slice(0,3).map(rep => {
                      const clr = { draft: C.mu, submitted: C.ac, reviewed: C.yw, signed: C.gr }[rep.status] || C.mu;
                      return <span key={rep.id} style={{ fontSize: 9, color: clr, background: clr+'18', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>KW{rep.week_number}</span>;
                    })}
                    {r.reports.length > 3 && <span style={{ fontSize: 9, color: C.mu }}>+{r.reports.length-3}</span>}
                  </div>
                </div>
              ))}
              <div style={{ padding: '9px 14px', borderTop: `1px solid ${C.bd}`, display: 'flex', gap: 20 }}>
                <span style={{ fontSize: 11, color: C.mu }}>Gesamt:</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.gr, fontFamily: C.mono }}>{rows.reduce((s,r) => s+r.hours,0).toFixed(1)}h</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.ac, fontFamily: C.mono }}>{rows.reduce((s,r) => s+r.done,0)} Aufgaben</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.mu, fontFamily: C.mono }}>{rows.reduce((s,r) => s+r.reports.length,0)} Berichte</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
