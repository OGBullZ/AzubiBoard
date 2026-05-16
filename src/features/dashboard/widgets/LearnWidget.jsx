import { memo, useState, useEffect } from "react";
import { C } from '../../../lib/utils.js';
import { ProgressBar } from '../../../components/UI.jsx';
import { IcoLearn } from '../../../components/Icons.jsx';

function LearnWidgetImpl({ userId, onNavigate }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const key = `azubi_quiz_${userId || 'anon'}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      setHistory(saved);
    } catch {
      // localStorage kann in privaten Fenstern werfen — Stille hier OK
    }
  }, [userId]);

  const avg  = history.length > 0 ? Math.round(history.reduce((s, e) => s + e.pct, 0) / history.length) : null;
  const best = history.length > 0 ? Math.max(...history.map(e => e.pct)) : null;
  const last  = history[0];
  const trend = history.length >= 2 ? history[0].pct - history[1].pct : null;

  if (history.length === 0) {
    return (
      <div>
        <div style={{ fontSize: 14, color: C.textSecondary, fontStyle: 'italic', marginBottom: 9 }}>Noch kein Quiz absolviert.</div>
        <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0' }}>
          <IcoLearn size={10} /> Quiz starten
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 9 }}>
        {[
          { l: 'Ø Ergebnis', v: `${avg}%`,  c: avg >= 75 ? C.gr : avg >= 50 ? C.yw : C.cr },
          { l: 'Bestes',     v: `${best}%`, c: C.gr },
          { l: 'Versuche',   v: history.length, c: C.ac },
          { l: 'Trend',      v: trend === null ? '–' : (trend >= 0 ? `+${trend}%` : `${trend}%`), c: trend > 0 ? C.gr : trend < 0 ? C.cr : C.mu },
        ].map(s => (
          <div key={s.l} style={{ background: 'var(--c-sf3)', borderRadius: 7, padding: '6px 9px', border: `1px solid var(--c-bd)` }}>
            <div style={{ fontSize: 9, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: .7, fontWeight: 700 }}>{s.l}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: C.mono, marginTop: 1 }}>{s.v}</div>
          </div>
        ))}
      </div>
      {last && (
        <div style={{ marginBottom: 9 }}>
          <div style={{ fontSize: 10, color: C.textSecondary, marginBottom: 4 }}>
            Letztes Quiz · {new Date(last.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
          </div>
          <ProgressBar value={last.pct} color={last.pct >= 75 ? C.gr : last.pct >= 50 ? C.yw : C.cr} height={6} />
          <div style={{ fontSize: 10, fontFamily: C.mono, color: C.textSecondary, marginTop: 3, textAlign: 'right' }}>
            {last.score}/{last.total} · {last.pct}%
          </div>
        </div>
      )}
      <button onClick={onNavigate} className="btn" style={{ fontSize: 10, width: '100%', justifyContent: 'center', padding: '4px 0' }}>
        <IcoLearn size={10} /> Lernbereich öffnen
      </button>
    </div>
  );
}

export const LearnWidget = memo(LearnWidgetImpl);
