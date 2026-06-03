import { memo } from "react";
import type { CSSProperties } from "react";
import { C, fmtDate } from '../../../lib/utils.js';
import { IcoCheck, IcoLink, IcoNote } from '../../../components/Icons.jsx';
import { ST_ICONS, ST_COLORS } from './_helpers.jsx';
import type { Task } from '../../../types';

type QueueTask = Task & {
  projectId: string | number;
  projectTitle?: string;
  isOverdue?: boolean;
  deadline?: string | null;
  links?: unknown[];
};

type TaskQueueProps = {
  tasks: QueueTask[];
  onToggle: (projectId: string | number, taskId: string | number) => void;
  onOpen: (projectId: string | number) => void;
};

function TaskQueueImpl({ tasks, onToggle, onOpen }: TaskQueueProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', marginRight: -4, paddingRight: 4 }}>
      {tasks.map(t => {
        const StIcon  = (ST_ICONS as Record<string, unknown>)[t.status as string]  || IcoCheck;
        const stColor = (ST_COLORS as Record<string, string>)[t.status as string] || C.mu;
        return (
          <div key={t.id}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 7px', borderRadius: 7, marginBottom: 2, cursor: 'pointer', transition: 'background .1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <button onClick={e => { e.stopPropagation(); onToggle(t.projectId, t.id); }}
              style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${t.isOverdue ? C.cr : stColor}`, background: 'transparent', flexShrink: 0, marginTop: 2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.gr; e.currentTarget.style.borderColor = C.gr; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = t.isOverdue ? C.cr : stColor; }}>
              {t.status === 'in_progress' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.ac }} />}
            </button>
            <button onClick={() => onOpen(t.projectId)} style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.br, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.status === 'in_progress' && <span style={{ fontSize: 8, color: C.ac, marginRight: 3 }}>▶</span>}
                {t.text}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 1, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>{t.projectTitle}</span>
                {t.deadline && <span style={{ fontSize: 9, fontFamily: C.mono, color: t.isOverdue ? C.cr : C.mu, flexShrink: 0, fontWeight: t.isOverdue ? 700 : 400 }}>{t.isOverdue ? '⚠ ' : ''}{fmtDate(t.deadline)}</span>}
                {(t.links || []).length > 0 && <IcoLink size={9} style={{ color: C.ac, flexShrink: 0 } as CSSProperties} />}
                {t.note && <IcoNote size={9} style={{ color: C.textSecondary, flexShrink: 0 } as CSSProperties} />}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}

export const TaskQueue = memo(TaskQueueImpl);
