// ============================================================
//  SyncIndicator – zeigt Sync-Status (Online/Offline/Syncing/Error)
//  Lauscht auf 'azubiboard:sync' Events von dataService
// ============================================================
import { useEffect, useState } from 'react';

export default function SyncIndicator() {
  // null = idle (nicht zeigen); sonst aktueller Status
  const [state, setState] = useState(null);
  const [hideAt, setHideAt] = useState(0);

  useEffect(() => {
    const handler = (e) => {
      const t = e.detail?.type;
      if (t === 'start')   setState({ kind: 'syncing' });
      else if (t === 'success') {
        setState({ kind: 'success' });
        // success kurz zeigen, dann ausblenden
        const ts = Date.now() + 1500;
        setHideAt(ts);
        setTimeout(() => setHideAt(h => (h === ts ? 0 : h)), 1600);
      }
      else if (t === 'error')   setState({ kind: e.detail?.fatal ? 'fatal' : 'error', error: e.detail?.error?.message });
      else if (t === 'offline') setState({ kind: 'offline' });
    };
    const online  = () => setState(s => (s?.kind === 'offline' ? null : s));
    const offline = () => setState({ kind: 'offline' });
    window.addEventListener('azubiboard:sync', handler);
    window.addEventListener('online',  online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('azubiboard:sync', handler);
      window.removeEventListener('online',  online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  if (!state) return null;
  if (state.kind === 'success' && hideAt && Date.now() >= hideAt) return null;

  const cfg = {
    syncing: { icon: '⟳', label: 'Synchronisiere …', color: 'var(--c-mu)',  spin: true  },
    success: { icon: '✓', label: 'Gespeichert',       color: 'var(--c-gr)', spin: false },
    error:   { icon: '⚠', label: 'Verbindungsfehler – wird wiederholt', color: 'var(--c-yw)', spin: false },
    fatal:   { icon: '⚠', label: 'Nicht eingeloggt – Änderungen nur lokal', color: 'var(--c-cr)', spin: false },
    offline: { icon: '⚡', label: 'Offline – Änderungen werden gequeued',  color: 'var(--c-yw)', spin: false },
  }[state.kind];

  return (
    <div role="status" aria-live="polite"
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 8500,
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', borderRadius: 8,
        background: 'var(--c-sf)', border: '1px solid var(--c-bd2)',
        boxShadow: 'var(--shadow)', fontSize: 12, fontWeight: 600,
        color: cfg.color, maxWidth: '70vw',
        animation: 'syncPop .15s ease',
      }}>
      <span style={{
        display: 'inline-block', fontSize: 14,
        animation: cfg.spin ? 'syncSpin 1s linear infinite' : 'none'
      }}>{cfg.icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cfg.label}
      </span>
      <style>{`
        @keyframes syncSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes syncPop  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
