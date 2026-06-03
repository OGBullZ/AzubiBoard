import { memo } from "react";
import { C, fmtDate } from '../../../lib/utils.js';
import { IcoCalendar } from '../../../components/Icons.jsx';
import { urgencyColor, urgencyLabel } from './_helpers.jsx';
import type { CalendarEvent, Project } from '../../../types';

type CalWidgetItem = {
  id: string | number;
  date?: string | null;
  title: string;
  type?: string;
};

type CalWidgetProps = {
  calendarEvents: CalendarEvent[];
  projects: Project[];
  onNavigate: () => void;
};

function CalWidgetImpl({ calendarEvents, projects, onNavigate }: CalWidgetProps) {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  const source: CalWidgetItem[] = [
    ...calendarEvents,
    ...projects.flatMap(p =>
      p.deadline ? [{ id: 'dl-' + p.id, date: p.deadline, title: '📌 ' + p.title, type: 'deadline' }] : []
    ),
  ];
  const all = source
    .filter((e): e is CalWidgetItem & { date: string } => !!e.date && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const TYPE_COLOR: Record<string, string> = { deadline: C.cr, meeting: '#f78166', hospitation: '#a371f7', schoolday: C.gr, event: C.ac, reminder: C.yw };

  return (
    <div>
      {all.length === 0
        ? <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', padding: '8px 0' }}>Keine Termine in Sicht</div>
        : all.map(e => {
            const c    = (e.type && TYPE_COLOR[e.type]) || C.ac;
            const diff = Math.ceil((Number(new Date(e.date + 'T12:00:00')) - Number(now)) / 86400000);
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', borderBottom: `1px solid var(--c-bd)` }}>
                <div style={{ width: 3, height: 28, borderRadius: 2, background: c, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  <div style={{ fontSize: 10, color: C.textSecondary }}>{fmtDate(e.date)}</div>
                </div>
                <span style={{ fontSize: 9, fontFamily: C.mono, fontWeight: 700, color: urgencyColor(diff), flexShrink: 0 }}>
                  {urgencyLabel(diff)}
                </span>
              </div>
            );
          })}
      <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', marginTop: 8, padding: '4px 0' }}>
        <IcoCalendar size={10} /> Kalender öffnen
      </button>
    </div>
  );
}

export const CalWidget = memo(CalWidgetImpl);
