import { memo } from "react";
import { C } from '../../../lib/utils.js';

function WeekProgressImpl({ tasks, userId }) {
  const now   = new Date();
  const mon   = new Date(now);
  mon.setDate(mon.getDate() - ((now.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);

  const days = ['Mo','Di','Mi','Do','Fr'].map((l, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const isToday = ds === now.toISOString().split('T')[0];
    const done = tasks.filter(t =>
      (t.status === 'done' || t.done) && t.assignee === userId && t.deadline === ds
    ).length;
    const open = tasks.filter(t =>
      t.status !== 'done' && !t.done && t.assignee === userId && t.deadline === ds
    ).length;
    return { l, d, ds, isToday, done, open, total: done + open };
  });

  const weekDone  = days.reduce((s, d) => s + d.done, 0);
  const weekTotal = tasks.filter(t => {
    const ds = t.deadline;
    if (!ds) return false;
    const td = new Date(ds + 'T12:00:00');
    return td >= mon && td < new Date(mon.getTime() + 7 * 86400000) && t.assignee === userId;
  }).length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: C.textSecondary }}>
          KW {Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 604800000)}
        </span>
        <span style={{ fontSize: 13, fontFamily: C.mono, color: weekDone === weekTotal && weekTotal > 0 ? C.gr : C.ac, fontWeight: 700 }}>
          {weekDone} / {weekTotal} diese Woche
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 44 }}>
        {days.map(d => {
          const maxH = 36;
          const barH = d.total === 0 ? 4 : Math.max(4, Math.round((d.done / Math.max(d.total, 1)) * maxH));
          const isFuture = d.d > now;
          return (
            <div key={d.l} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: '100%', height: maxH, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: maxH, background: 'var(--c-bd)', borderRadius: 3, opacity: .5 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: barH, background: d.isToday ? C.ac : d.done > 0 ? C.gr : isFuture ? 'var(--c-bd2)' : C.mu + '60', borderRadius: 3, transition: 'height .5s ease' }} />
                {d.open > 0 && !isFuture && (
                  <div style={{ position: 'absolute', bottom: barH, left: 0, right: 0, height: Math.max(2, Math.round((d.open / Math.max(d.total, 1)) * maxH)), background: C.cr + '80', borderRadius: '3px 3px 0 0' }} />
                )}
              </div>
              <span style={{ fontSize: 9, fontWeight: d.isToday ? 800 : 500, color: d.isToday ? C.ac : C.mu, textTransform: 'uppercase', letterSpacing: .5 }}>{d.l}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const WeekProgress = memo(WeekProgressImpl);
