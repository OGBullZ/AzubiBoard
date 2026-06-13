// Befehls-/Hilfe-Dialoge (Ctrl+K-Suche + Shortcuts-Übersicht).
// Aus App.tsx extrahiert (2026-06-13) — self-contained, on-demand gerendert.
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDebounce, useDialog } from '../lib/hooks.js';
import { dataService } from '../lib/dataService.js';
import { IcoSearch } from './Icons.jsx';
import type { AppState, Project, User, Report } from '../types';

const USE_API = import.meta.env.VITE_USE_API === 'true';

// ── Keyboard Shortcuts Help ───────────────────────────────────
export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(onClose);  // Phase 4: Escape + Fokus-Trap + Body-Lock ('?' schließt via globalem Handler)

  const groups = [
    { title: 'Navigation', items: [['G dann D', 'Dashboard'],['G dann P', 'Projekte'],['G dann K', 'Kalender'],['G dann R', 'Berichte'],['G dann T', 'Ausbildungsplan'],['G dann L', 'Lernbereich'],['G dann U', 'Nutzer (Ausbilder)']] },
    { title: 'Aktionen', items: [['N', 'Neues Projekt (Ausbilder)'],['Ctrl+K', 'Suche öffnen'],['?', 'Shortcuts anzeigen']] },
    { title: 'Allgemein', items: [['Esc', 'Dialog schließen'],['←→', 'Kanban: Status verschieben']] },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 910, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Tastaturkürzel" tabIndex={-1} style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 14, width: 480, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)', outline: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--c-bd)' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-br)' }}>⌨️ Tastaturkürzel</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--c-mu)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map(g => (
            <div key={g.title}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-mu)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{g.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {g.items.map(([k, l]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <kbd style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-br)', fontFamily: 'monospace', minWidth: 90, textAlign: 'center', flexShrink: 0 }}>{k}</kbd>
                    <span style={{ fontSize: 13, color: 'var(--c-mu)' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--c-bd)', fontSize: 11, color: 'var(--c-mu)', textAlign: 'center' }}>
          Drücke <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)' }}>?</kbd> um diese Übersicht zu schließen
        </div>
      </div>
    </div>
  );
}

// ── Global Search ─────────────────────────────────────────────
const SEARCH_ICONS: Record<string, string> = { project: '📁', task: '⚡', report: '📝', learn: '📖', default: '🔍' };

// UI-Trefferform für die globale Suche (lokal + API gemerged). Kein Domain-Typ.
interface SearchHit { type: string; label: string; sub?: string | null; to: string; icon: string; }
export function GlobalSearch({ data, onClose }: { data: AppState | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const dQ  = useDebounce(q, 300);
  const ref = useRef<HTMLInputElement>(null);
  // SearchResult vom Server (JS/API-Boundary): icon-Feld ist dort der Key, hier wird gemappt.
  const [apiResults, setApiResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { ref.current?.focus(); }, []);
  const dialogRef = useDialog<HTMLDivElement>(onClose);  // Phase 4: Escape + Fokus-Trap + Body-Lock

  // Server-FULLTEXT wenn API aktiv und mind. 2 Zeichen
  useEffect(() => {
    const trimmed = dQ.trim();
    let cancelled = false;
    const run = async () => {
      if (!USE_API || trimmed.length < 2) { setApiResults([]); setLoading(false); return; }
      setLoading(true);
      const res = await dataService.search(trimmed);
      if (!cancelled) { setApiResults(res); setLoading(false); }
    };
    run();
    return () => { cancelled = true; };
  }, [dQ]);

  const lower = dQ.trim().toLowerCase();

  // Lokale Fallback-Ergebnisse (immer verfügbar, auch offline)
  const localResults: SearchHit[] = lower.length >= 2 ? [
    ...(data?.projects||[]).filter((p: Project) => !p.archived && (p.title.toLowerCase().includes(lower) || (p.description||'').toLowerCase().includes(lower)))
      .slice(0,5).map((p: Project) => ({ type: 'Projekt', label: p.title, sub: p.description, to: `/project/${p.id}`, icon: '📁' })),
    ...(data?.users||[]).filter((u: User) => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower))
      .slice(0,3).map((u: User) => ({ type: 'Nutzer', label: u.name, sub: u.email, to: '/users', icon: '👤' })),
    ...(data?.reports||[]).filter((r: Report) =>
        (r.title||'').toLowerCase().includes(lower) ||
        (r.user_name||'').toLowerCase().includes(lower) ||
        `kw ${r.week_number}/${r.year}`.includes(lower) ||
        String(r.week_number ?? '').includes(lower))
      .slice(0,4).map((r: Report) => ({ type: 'Bericht', label: r.title || `KW ${r.week_number}/${r.year}`, sub: `${r.user_name ? r.user_name + ' · ' : ''}KW ${r.week_number}/${r.year}`, to: '/reports', icon: '📝' })),
    ...(data?.calendarEvents||[]).filter((e: any) => (e.title||'').toLowerCase().includes(lower))
      .slice(0,3).map((e: any) => ({ type: 'Termin', label: e.title, sub: e.date || null, to: '/calendar', icon: '📅' })),
    ...(data?.learningPaths||[]).filter((lp: any) => (lp.title||'').toLowerCase().includes(lower) || (lp.nodes||[]).some((n: any) => (n.title||'').toLowerCase().includes(lower)))
      .slice(0,3).map((lp: any) => ({ type: 'Lernpfad', label: lp.title, sub: (lp.nodes||[]).find((n: any) => (n.title||'').toLowerCase().includes(lower))?.title || null, to: '/learn', icon: '📖' })),
  ] : [];

  // API-Ergebnisse haben Priorität; lokale Nutzer-Suche immer ergänzen
  const userResults: SearchHit[] = lower.length >= 2
    ? (data?.users||[]).filter((u: User) => u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower))
        .slice(0,3).map((u: User) => ({ type: 'Nutzer', label: u.name, sub: u.email, to: '/users', icon: '👤' }))
    : [];

  const apiMapped = apiResults.map((r: any) => ({
    ...r,
    icon: SEARCH_ICONS[r.icon] || SEARCH_ICONS.default,
  }));

  const results = lower.length >= 2
    ? (USE_API ? [...apiMapped, ...userResults] : localResults)
    : [];

  const go = (to: string) => { navigate(to); onClose(); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 900, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Suche" className="cmd-pult" style={{ background: 'var(--c-sf)', border: '1px solid var(--c-bd2)', borderRadius: 14, width: '100%', maxWidth: 560, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.6)' }}>
        <div className="cmd-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--c-bd)' }}>
          <IcoSearch size={16} style={{ color: 'var(--c-mu)', flexShrink: 0 }} />
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Projekte, Nutzer, Berichte, Termine, Lernpfade…"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, color: 'var(--c-br)', outline: 'none', padding: 0 }} />
          <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-mu)', flexShrink: 0 }}>Esc</kbd>
        </div>
        {results.length > 0 ? (
          <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 0' }}>
            {results.map((r, i) => (
              <button key={i} onClick={() => go(r.to)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--c-sf2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: 16 }}>{r.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-br)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                  {r.sub && <div style={{ fontSize: 11, color: 'var(--c-mu)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>}
                </div>
                <span style={{ fontSize: 10, color: 'var(--c-mu)', background: 'var(--c-sf3)', border: '1px solid var(--c-bd)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>{r.type}</span>
              </button>
            ))}
          </div>
        ) : loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-mu)', fontSize: 13 }}>Suche…</div>
        ) : lower.length >= 2 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--c-mu)', fontSize: 13 }}>Keine Ergebnisse für „{q}"</div>
        ) : (
          <div style={{ padding: '16px 20px', fontSize: 11, color: 'var(--c-mu)' }}>
            <div style={{ marginBottom: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8 }}>Tastaturkürzel</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {[['Ctrl+K', 'Suche öffnen'],['N', 'Neues Projekt'],['Esc', 'Schließen']].map(([k,l]) => (
                <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--c-sf3)', border: '1px solid var(--c-bd2)', color: 'var(--c-br)' }}>{k}</kbd>
                  <span style={{ fontSize: 11 }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
