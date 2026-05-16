import { memo } from "react";
import { C } from '../../../lib/utils.js';
import { IcoAlert, IcoReport } from '../../../components/Icons.jsx';

function ReportWidgetImpl({ reports, userId, onNavigate }) {
  const mine   = reports.filter(r => r.user_id === userId);
  const total  = mine.length;
  const signed = mine.filter(r => r.status === 'signed').length;
  const sub    = mine.filter(r => r.status === 'submitted').length;
  const draft  = mine.filter(r => r.status === 'draft').length;

  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const thisWeekReport  = mine.find(r => new Date(r.week_start) >= monday);
  const thisWeekMissing = !thisWeekReport;

  return (
    <div>
      {thisWeekMissing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: C.ywd, border: `1px solid ${C.yw}30`, borderRadius: 7, marginBottom: 9 }}>
          <IcoAlert size={13} style={{ color: C.yw, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.yw }}>Berichtsheft diese Woche fehlt</div>
            <div style={{ fontSize: 10, color: C.textSecondary }}>Noch nicht für KW {Math.ceil((now - new Date(now.getFullYear(),0,1))/604800000)} erstellt</div>
          </div>
        </div>
      )}
      {total > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 9 }}>
          {[['Entwurf', draft, C.mu], ['Eingereicht', sub, C.ac], ['Fertig', signed, C.gr]].map(([l, v, c]) => (
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
