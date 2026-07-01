import { memo } from "react";
import { C, getKW, getISOWeekMonday } from '../../../lib/utils.js';
import { IcoAlert, IcoReport } from '../../../components/Icons.jsx';
import type { Report } from '../../../types';

type ReportWidgetProps = {
  reports: Report[];
  userId: Report['user_id'];
  onNavigate: () => void;
};

function ReportWidgetImpl({ reports, userId, onNavigate }: ReportWidgetProps) {
  const mine   = reports.filter(r => r.user_id === userId);
  const total  = mine.length;
  const signed = mine.filter(r => r.status === 'signed').length;
  const sub    = mine.filter(r => r.status === 'submitted').length;
  const draft  = mine.filter(r => r.status === 'draft').length;

  const monday = getISOWeekMonday(new Date())!;
  const thisWeekReport  = mine.find(r => !!r.week_start && new Date(r.week_start) >= monday);
  const thisWeekMissing = !thisWeekReport;

  return (
    <div>
      {thisWeekMissing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: C.ywd, border: `1px solid color-mix(in srgb, ${C.yw} 19%, transparent)`, borderRadius: 7, marginBottom: 9 }}>
          <IcoAlert size={13} style={{ color: C.ywT, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.ywT }}>Berichtsheft diese Woche fehlt</div>
            <div style={{ fontSize: 10, color: C.textSecondary }}>Noch nicht für KW {getKW(monday)} erstellt</div>
          </div>
        </div>
      )}
      {total > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 9 }}>
          {([['Entwurf', draft, C.mu], ['Eingereicht', sub, C.ac], ['Fertig', signed, C.gr]] as [string, number, string][]).map(([l, v, c]) => (
            <div key={l} style={{ textAlign: 'center', padding: '5px 3px', background: c + '10', borderRadius: 6, border: `1px solid ${c}20` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: c, fontFamily: C.mono, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 9, color: C.textSecondary, marginTop: 2, textTransform: 'uppercase', letterSpacing: .5 }}>{l}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', padding: '4px 0 8px', fontStyle: 'italic' }}>Noch keine Berichtshefte</div>
      )}
      <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0' }}>
        <IcoReport size={10} /> Berichtshefte öffnen
      </button>
    </div>
  );
}

export const ReportWidget = memo(ReportWidgetImpl);
