import { memo, useState } from "react";
import { C, fmtDate } from '../../../lib/utils.js';
import { IcoCheck, IcoNote } from '../../../components/Icons.jsx';

function HeroTaskImpl({ task, onToggle, onOpen, onUpdateNote }) {
  const [showNote, setShowNote] = useState(false);
  const [note,     setNote]     = useState(task?.note || '');

  if (!task) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '20px 16px', borderRadius: 10, border: `1px solid ${C.gr}25`, background: C.gr + '08' }}>
      <div style={{ fontSize: 28, opacity: .6 }}>✓</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.gr }}>Alles erledigt!</div>
      <div style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 1.6 }}>Keine offenen oder überfälligen Aufgaben</div>
    </div>
  );

  const isOverdue = task.isOverdue;
  const isActive  = task.status === 'in_progress';
  const accent    = isOverdue ? C.cr : isActive ? C.ac : '#f78166';
  const accentBg  = isOverdue ? C.crd : isActive ? C.acd : '#f7816614';

  const saveNote = () => {
    onUpdateNote?.(task.projectId, task.id, note);
    setShowNote(false);
  };

  return (
    <div style={{ borderRadius: 10, border: `1.5px solid ${accent}40`, background: accentBg, padding: '16px 20px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: accent + '10', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>
          {isOverdue ? '⚠ Überfällig' : isActive ? '▶ In Bearbeitung' : '📅 Heute fällig'}
        </span>
        {task.deadline && (
          <span style={{ fontSize: 9, fontFamily: C.mono, color: accent, background: accent + '15', borderRadius: 4, padding: '1px 6px' }}>
            {fmtDate(task.deadline)}
          </span>
        )}
        <button onClick={() => setShowNote(s => !s)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, background: showNote ? accent + '20' : 'transparent', border: `1px solid ${accent}30`, borderRadius: 5, padding: '2px 7px', cursor: 'pointer', color: accent, fontSize: 10, fontWeight: 600 }}>
          <IcoNote size={10} /> {task.note ? 'Notiz' : '+ Notiz'}
        </button>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.br, lineHeight: 1.4, marginBottom: showNote ? 8 : 10, wordBreak: 'break-word' }}>
        {task.text}
      </div>
      {showNote && (
        <div style={{ marginBottom: 10 }}>
          <textarea value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNote(); }}
            placeholder="Notiz hinzufügen… (Strg+Enter zum Speichern)"
            style={{ minHeight: 52, fontSize: 11, background: 'var(--c-sf)', border: `1px solid ${accent}40`, borderRadius: 6, lineHeight: 1.55, padding: '6px 9px', resize: 'none', marginBottom: 5 }}
            autoFocus />
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={saveNote} className="abtn" style={{ fontSize: 10, padding: '4px 10px' }}>Speichern</button>
            <button onClick={() => { setNote(task.note || ''); setShowNote(false); }} className="btn" style={{ fontSize: 10, padding: '4px 8px' }}>Abbrechen</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button onClick={() => onOpen(task.projectId)} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 600 }}>{task.projectTitle}</span>
        </button>
        <button onClick={onToggle}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = accent; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accent; }}>
          <IcoCheck size={12} /> Erledigen
        </button>
      </div>
    </div>
  );
}

export const HeroTask = memo(HeroTaskImpl);
