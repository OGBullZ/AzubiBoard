import { memo } from "react";
import { C } from '../../../lib/utils.js';

function relTime(ts) {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60)       return 'gerade eben';
  if (diff < 3600)     return `vor ${Math.floor(diff / 60)} Min`;
  if (diff < 86400)    return `vor ${Math.floor(diff / 3600)}h`;
  if (diff < 172800)   return 'Gestern';
  return new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

const ACTIVITY_CONFIG = {
  project_created:  { icon: '📁', color: C.ac  },
  task_done:        { icon: '✅', color: C.gr  },
  task_created:     { icon: '➕', color: C.yw  },
  user_registered:  { icon: '👤', color: '#a371f7' },
  // Reports
  report_saved:     { icon: '📝', color: C.ac  },
  report_submitted: { icon: '📤', color: C.yw  },
  report_signed:    { icon: '✍️', color: C.gr  },
  // Training-Plan
  goal_added:       { icon: '🎯', color: C.ac  },
  goal_learned:     { icon: '💡', color: C.yw  },
  goal_confirmed:   { icon: '🏆', color: C.gr  },
  goal_updated:     { icon: '✏️', color: C.mu  },
  goal_deleted:     { icon: '🗑️', color: C.cr  },
  goals_imported:   { icon: '📥', color: C.ac  },
};

function activityText(entry) {
  switch (entry.type) {
    case 'project_created':
      return <>{entry.userName} hat Projekt <strong style={{ color: C.br }}>{entry.entityTitle}</strong> erstellt</>;
    case 'task_done':
      return <>{entry.userName} hat Aufgabe <strong style={{ color: C.br }}>{entry.entityTitle}</strong> abgeschlossen{entry.projectTitle ? <span style={{ color: C.mu }}> · {entry.projectTitle}</span> : null}</>;
    case 'task_created':
      return <>{entry.userName} hat Aufgabe <strong style={{ color: C.br }}>{entry.entityTitle}</strong> hinzugefügt{entry.projectTitle ? <span style={{ color: C.mu }}> · {entry.projectTitle}</span> : null}</>;
    case 'user_registered':
      return <><strong style={{ color: C.br }}>{entry.userName}</strong> hat sich registriert</>;
    case 'report_saved':
      return <>{entry.userName} hat Berichtsheft <strong style={{ color: C.br }}>{entry.entityTitle}</strong> gespeichert</>;
    case 'report_submitted':
      return <>{entry.userName} hat Berichtsheft <strong style={{ color: C.br }}>{entry.entityTitle}</strong> eingereicht</>;
    case 'report_signed':
      return <>{entry.userName} hat Berichtsheft <strong style={{ color: C.br }}>{entry.entityTitle}</strong> signiert</>;
    case 'goal_added':
      return <>{entry.userName} hat Lernziel <strong style={{ color: C.br }}>{entry.entityTitle}</strong> angelegt</>;
    case 'goal_learned':
      return <>{entry.userName} hat <strong style={{ color: C.br }}>{entry.entityTitle}</strong> als gelernt markiert</>;
    case 'goal_confirmed':
      return <>{entry.userName} hat Kompetenz <strong style={{ color: C.br }}>{entry.entityTitle}</strong> bestätigt</>;
    case 'goal_updated':
      return <>{entry.userName} hat Lernziel <strong style={{ color: C.br }}>{entry.entityTitle}</strong> bearbeitet</>;
    case 'goal_deleted':
      return <>{entry.userName} hat Lernziel <strong style={{ color: C.br }}>{entry.entityTitle}</strong> gelöscht</>;
    case 'goals_imported':
      return <>{entry.userName} hat <strong style={{ color: C.br }}>{entry.entityTitle}</strong> importiert</>;
    default:
      return entry.action || '–';
  }
}

function ActivityFeedImpl({ activityLog = [] }) {
  const entries = activityLog.slice(0, 15);

  return (
    <div style={{ maxHeight: 300, overflowY: 'auto' }}>
      {entries.length === 0 ? (
        <div style={{ fontSize: 12, color: C.textSecondary, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
          Noch keine Aktivitäten
        </div>
      ) : entries.map(entry => {
        const cfg = ACTIVITY_CONFIG[entry.type] || { icon: '📋', color: C.mu };
        return (
          <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 2px', borderBottom: `1px solid ${C.bd}22` }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: cfg.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>
              {cfg.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: C.tx, lineHeight: 1.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activityText(entry)}
              </div>
              <div style={{ fontSize: 9, color: C.mu, marginTop: 1, fontFamily: C.mono }}>
                {relTime(entry.ts)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const ActivityFeed = memo(ActivityFeedImpl);
