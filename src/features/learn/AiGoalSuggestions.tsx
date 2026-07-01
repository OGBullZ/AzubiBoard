import { useState } from 'react';
import { C } from '../../lib/utils.js';
import { Modal, Field } from '../../components/UI.jsx';
import { dataService } from '../../lib/dataService.js';

type GoalSuggestion = {
  type?: string;
  title: string;
  description?: string;
};

type AiGoalSuggestionsProps = {
  lehrjahr: number;
  existingTitles?: string[];
  onAdd: (goals: GoalSuggestion[]) => void;
  onClose: () => void;
};

const TYPE_ICON: Record<string, string> = { article: '📖', link: '🔗', quiz: '🧩', task: '✅' };

const BERUFE = [
  'Fachinformatiker/in Anwendungsentwicklung',
  'Fachinformatiker/in Systemintegration',
  'Fachinformatiker/in Daten- und Prozessanalyse',
  'Kaufmann/frau für IT-System-Management',
  'IT-System-Elektroniker/in',
  'Kaufmann/frau im E-Commerce',
  'Kaufmann/frau für Büromanagement',
];

export default function AiGoalSuggestions({ lehrjahr, existingTitles = [], onAdd, onClose }: AiGoalSuggestionsProps) {
  const [profession, setProfession] = useState('Fachinformatiker/in Anwendungsentwicklung');
  const [context,    setContext]    = useState('');
  const [count,      setCount]      = useState(6);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<GoalSuggestion[] | null>(null);
  const [selected,    setSelected]    = useState<Set<number>>(new Set());

  const generate = async () => {
    setLoading(true);
    setErr(null);
    setSuggestions(null);
    setSelected(new Set());
    try {
      const result: GoalSuggestion[] = await dataService.suggestGoals({
        profession, lehrjahr, context, count,
        existingTitles,
      });
      setSuggestions(result);
      setSelected(new Set(result.map((_, i) => i)));
    } catch (e) {
      setErr((e as Error).message || 'Fehler beim Abrufen der Vorschläge');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (i: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const handleAdd = () => {
    onAdd(suggestions!.filter((_, i) => selected.has(i)));
    onClose();
  };

  const reset = () => { setSuggestions(null); setErr(null); };

  return (
    <Modal title="🤖 KI-Lernziele vorschlagen" onClose={onClose} width={560}>
      {!suggestions ? (
        /* ── Eingabe-Formular ── */
        <>
          <Field label="Ausbildungsberuf">
            <input
              value={profession}
              onChange={e => setProfession(e.target.value)}
              placeholder="z.B. Fachinformatiker/in Systemintegration"
              list="ai-berufe-list"
              autoFocus
            />
            <datalist id="ai-berufe-list">
              {BERUFE.map(b => <option key={b} value={b} />)}
            </datalist>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Lehrjahr">
              <input value={`${lehrjahr}. Lehrjahr`} readOnly
                style={{ background: C.sf3, color: C.mu, cursor: 'default' }} />
            </Field>
            <Field label="Anzahl Vorschläge">
              <select value={count} onChange={e => setCount(Number(e.target.value))}>
                {[3, 4, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n} Vorschläge</option>)}
              </select>
            </Field>
          </div>

          <Field label="Schwerpunkt / Kontext (optional)">
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="z.B. Schwerpunkt Datenbanken und SQL, Java-Grundlagen"
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </Field>

          {err && (
            <div style={{ background: 'var(--c-crd)', border: `1px solid color-mix(in srgb, ${C.cr} 25%, transparent)`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.crT, marginBottom: 12 }}>
              ⚠ {err}
            </div>
          )}

          <div style={{ fontSize: 11, color: C.mu, marginBottom: 12, padding: '8px 10px', background: C.sf3, borderRadius: 7 }}>
            💡 Claude {loading ? 'generiert' : 'generiert'} passende Lernziele basierend auf dem Ausbildungsberuf und Lehrjahr.
            Bestehende Lernziele ({existingTitles.length}) werden automatisch ausgeschlossen.
          </div>

          <button
            className="abtn"
            onClick={generate}
            disabled={loading || !profession.trim()}
            style={{ width: '100%', padding: 11 }}
          >
            {loading ? '⏳ Claude denkt nach …' : '✨ Vorschläge generieren'}
          </button>
        </>
      ) : (
        /* ── Ergebnis-Ansicht ── */
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: C.mu }}>
              <span style={{ fontWeight: 700, color: C.br }}>{suggestions.length}</span> Vorschläge ·{' '}
              <span style={{ color: C.acT }}>{lehrjahr}. Lehrjahr</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn" onClick={() => setSelected(new Set(suggestions.map((_, i) => i)))}
                style={{ fontSize: 11, padding: '3px 9px' }}>Alle</button>
              <button className="btn" onClick={() => setSelected(new Set())}
                style={{ fontSize: 11, padding: '3px 9px' }}>Keine</button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16, maxHeight: 360, overflowY: 'auto' }}>
            {suggestions.map((s, i) => {
              const sel = selected.has(i);
              return (
                <div key={i} onClick={() => toggle(i)} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  background: sel ? C.acd : C.sf2,
                  border: `1px solid ${sel ? C.ac : C.bd}`,
                  transition: 'all .12s',
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                    background: sel ? C.ac : 'transparent',
                    border: `2px solid ${sel ? C.ac : C.bd2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .12s',
                  }}>
                    {sel && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: s.description ? 3 : 0 }}>
                      <span style={{ fontSize: 14, lineHeight: 1 }}>{(s.type && TYPE_ICON[s.type]) || '📋'}</span>
                      <div style={{ fontSize: 13, fontWeight: 700, color: sel ? C.br : C.mu, transition: 'color .12s' }}>{s.title}</div>
                    </div>
                    {s.description && (
                      <div style={{ fontSize: 12, color: C.mu, lineHeight: 1.5 }}>{s.description}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="abtn"
              onClick={handleAdd}
              disabled={selected.size === 0}
              style={{ flex: 1, padding: 11 }}
            >
              {selected.size} Lernziel{selected.size !== 1 ? 'e' : ''} zum Pfad hinzufügen →
            </button>
            <button className="btn" onClick={reset}
              style={{ padding: '11px 14px', fontSize: 13 }} title="Neu generieren">
              ↺
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
