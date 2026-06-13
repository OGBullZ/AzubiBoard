import { memo, useState } from "react";
import { C, getKW, getISOWeekMonday, fmtLocalDate } from '../../../lib/utils.js';
import { Avatar } from '../../../components/UI.jsx';
import type { User } from '../../../types';

type TimeLogEntry = { date?: string; hours?: number | string };

type WidgetTask = {
  assignee?: User['id'];
  timeLog?: TimeLogEntry[];
};

type WidgetProject = {
  title: string;
  archived?: boolean;
  tasks?: WidgetTask[];
};

type ZeiterfassungWidgetProps = {
  users: User[];
  projects: WidgetProject[];
};

type Breakdown = { title: string; hours: number };
type Row = { azubi: User; total: number; breakdown: Breakdown[] };

function ZeiterfassungWidgetImpl({ users, projects }: ZeiterfassungWidgetProps) {
  // Lokale Achsen (DST-sicher): timeLog-Datümer werden mit today() = lokal geschrieben,
  // daher müssen Wochengrenzen ebenfalls lokal sein — toISOString() (UTC) wäre off-by-one nachts.
  const getMonStr = (offset = 0) => {
    const mon = getISOWeekMonday(new Date())!;
    mon.setDate(mon.getDate() + offset * 7);
    return fmtLocalDate(mon);
  };
  const [monStr, setMonStr] = useState<string>(() => getMonStr(0));
  const today = fmtLocalDate(new Date());

  const sunStr = (() => { const d = new Date(monStr + 'T12:00:00'); d.setDate(d.getDate()+6); return fmtLocalDate(d); })();
  const kwNum  = getKW(monStr);  // ISO-KW statt Naiv-Formel (falsch an Jahresgrenzen)

  const azubis = users.filter(u => u.role === 'azubi');

  const rows: Row[] = azubis.map(a => {
    const breakdown = projects.filter(p => !p.archived).reduce<Breakdown[]>((acc, p) => {
      const h = (p.tasks||[]).filter(t => t.assignee === a.id)
        .flatMap(t => (t.timeLog||[]).filter(e => e.date != null && e.date >= monStr && e.date <= sunStr))
        .reduce((s, e) => s + (Number(e.hours)||0), 0);
      if (h > 0) acc.push({ title: p.title, hours: h });
      return acc;
    }, []);
    return { azubi: a, total: breakdown.reduce((s, b) => s + b.hours, 0), breakdown };
  });

  const maxH = Math.max(...rows.map(r => r.total), 0.1);

  const exportCSV = () => {
    const lines = ['"KW";"Azubi";"Projekt";"Stunden"'];
    rows.forEach(r => {
      if (r.breakdown.length) r.breakdown.forEach(b => lines.push(`"${kwNum}";"${r.azubi.name}";"${b.title}";"${b.hours.toFixed(2).replace('.',',')}"`));
      else lines.push(`"${kwNum}";"${r.azubi.name}";"–";"0"`);
    });
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(blob); a2.download = `zeiterfassung_kw${kwNum}.csv`;
    document.body.appendChild(a2); a2.click(); document.body.removeChild(a2);
  };

  const hasAny = rows.some(r => r.total > 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9 }}>
        <button className="btn" style={{ padding: '2px 7px', fontSize: 11 }}
          onClick={() => { const d = new Date(monStr); d.setDate(d.getDate()-7); setMonStr(d.toISOString().split('T')[0]); }}>←</button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.br }}>KW {kwNum}</span>
        <button className="btn" style={{ padding: '2px 7px', fontSize: 11 }}
          disabled={monStr >= getMonStr(0)}
          onClick={() => { const d = new Date(monStr); d.setDate(d.getDate()+7); if (d.toISOString().split('T')[0] <= today) setMonStr(d.toISOString().split('T')[0]); }}>→</button>
        {hasAny && <button className="btn" style={{ padding: '2px 6px', fontSize: 9 }} onClick={exportCSV} title="CSV exportieren">↓CSV</button>}
      </div>
      {!hasAny ? (
        <div style={{ fontSize: 11, color: C.textSecondary, textAlign: 'center', padding: '8px 0' }}>
          Keine Zeiteinträge für KW {kwNum}
        </div>
      ) : rows.map(({ azubi, total, breakdown }) => (
        <div key={azubi.id} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <Avatar name={azubi.name} url={azubi.avatar_url} size={18} />
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {azubi.name.split(' ')[0]}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: C.mono, color: total > 0 ? C.gr : C.mu }}>
              {total.toFixed(1)}h
            </span>
          </div>
          <div style={{ height: 4, background: C.bd2, borderRadius: 2, overflow: 'hidden', marginLeft: 25, marginBottom: 3 }}>
            <div style={{ height: '100%', width: `${Math.min(100, total / maxH * 100)}%`, background: total > 0 ? C.gr : C.bd2, borderRadius: 2, transition: 'width .4s' }} />
          </div>
          {breakdown.map(b => (
            <div key={b.title} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.textSecondary, marginLeft: 25 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>· {b.title}</span>
              <span style={{ fontFamily: C.mono, flexShrink: 0 }}>{b.hours.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export const ZeiterfassungWidget = memo(ZeiterfassungWidgetImpl);
