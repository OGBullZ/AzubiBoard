import { memo } from "react";
import { C } from '../../../lib/utils.js';
import { urgencyColor, urgencyBg, urgencyLabel } from './_helpers.jsx';

function DeadlineWidgetImpl({ projects, userId, isAusbilder, onOpen }) {
  const now = new Date();
  const items = projects
    .filter(p => p.deadline && !p.archived)
    .filter(p => isAusbilder || (p.assignees||[]).includes(userId))
    .map(p => ({ ...p, diff: Math.ceil((new Date(p.deadline) - now) / 86400000) }))
    .filter(p => p.diff <= 21)
    .sort((a, b) => a.diff - b.diff);

  if (!items.length) return (
    <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', padding: '10px 0' }}>
      Keine Deadlines in den nächsten 21 Tagen 🎉
    </div>
  );

  const groups = [
    { label: 'Heute & Überfällig', items: items.filter(i => i.diff <= 0), color: C.cr },
    { label: 'Diese Woche',        items: items.filter(i => i.diff > 0 && i.diff <= 7),  color: C.yw },
    { label: 'Nächste Woche',      items: items.filter(i => i.diff > 7 && i.diff <= 14), color: C.textSecondary },
    { label: 'Später',             items: items.filter(i => i.diff > 14),                color: C.textSecondary },
  ].filter(g => g.items.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map(g => (
        <div key={g.label}>
          <div style={{ fontSize: 9, fontWeight: 700, color: g.color, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 5 }}>{g.label}</div>
          {g.items.map(p => (
            <button key={p.id} onClick={() => onOpen(p.id)} className="row-btn"
              style={{ justifyContent: 'space-between', marginBottom: 2, padding: '5px 7px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
              </div>
              <span style={{ fontSize: 9, fontFamily: C.mono, fontWeight: 800, color: urgencyColor(p.diff), background: urgencyBg(p.diff), padding: '2px 7px', borderRadius: 5, flexShrink: 0 }}>
                {urgencyLabel(p.diff)}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

export const DeadlineWidget = memo(DeadlineWidgetImpl);
