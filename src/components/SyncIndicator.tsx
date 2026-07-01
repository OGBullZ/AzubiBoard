// ============================================================
//  SyncIndicator – zeigt Sync-Status (Online/Offline/Syncing/Error)
//  Lauscht auf 'azubiboard:sync' Events von dataService
// ============================================================
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dataService } from '../lib/dataService.js';
import { useDesign } from '../lib/hooks.js';

type SyncStateKind = 'syncing' | 'success' | 'error' | 'fatal' | 'offline';

type SyncState = {
  kind: SyncStateKind;
  error?: string;
};

type SyncEventDetail = {
  type?: 'start' | 'success' | 'error' | 'offline';
  fatal?: boolean;
  error?: { message?: string };
};

export default function SyncIndicator() {
  const { t } = useTranslation();
  const design = useDesign();
  // null = idle (nicht zeigen); sonst aktueller Status
  const [state, setState] = useState<SyncState | null>(null);
  const [hideAt, setHideAt] = useState(0);

  useEffect(() => {
    const handler = (e: CustomEvent<SyncEventDetail>) => {
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
    window.addEventListener('azubiboard:sync', handler as EventListener);
    window.addEventListener('online',  online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('azubiboard:sync', handler as EventListener);
      window.removeEventListener('online',  online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  if (!state) return null;
  // eslint-disable-next-line react-hooks/purity
  if (state.kind === 'success' && hideAt && Date.now() >= hideAt) return null;

  const cfg = {
    syncing: { icon: '⟳', label: t('sync.syncing'),  color: 'var(--c-mu)', spin: true  },
    success: { icon: '✓', label: t('sync.saved'),    color: 'var(--c-gr-text)', spin: false },
    error:   { icon: '⚠', label: t('sync.error'),    color: 'var(--c-yw-text)', spin: false },
    fatal:   { icon: '⚠', label: t('sync.fatal'),    color: 'var(--c-cr-text)', spin: false },
    offline: { icon: '⚡', label: t('sync.offline'),  color: 'var(--c-yw-text)', spin: false },
  }[state.kind];

  // Anhang C: Zahnrad dreht mechanisch (steps-8) bei inflight, steht bei Fehler abrupt
  // still (gleiches Icon, keine Animation); Erfolg = grüner Tick-Fade. Nur Werkbank-Design.
  const beta = design === 'beta';
  const gear = beta && (state.kind === 'syncing' || state.kind === 'error' || state.kind === 'fatal');
  const icon = gear ? '⚙' : cfg.icon;
  const iconClass = beta ? (state.kind === 'syncing' ? 'gear-spin' : state.kind === 'success' ? 'tick-fade' : '') : '';

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
      <span className={iconClass} style={{
        display: 'inline-block', fontSize: 14,
        animation: !beta && cfg.spin ? 'syncSpin 1s linear infinite' : undefined
      }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cfg.label}
      </span>
      {(state.kind === 'error' || state.kind === 'fatal') && (
        <>
          {state.error && (
            <span title={state.error} style={{ color: 'var(--c-mu)', fontWeight: 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              · {state.error}
            </span>
          )}
          <button onClick={() => { dataService.retry(); setState({ kind: 'syncing' }); }}
            style={{ border: '1px solid var(--c-bd2)', background: 'var(--c-sf2)', color: 'var(--c-tx)', borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}>
            {t('sync.retry')}
          </button>
          <button onClick={() => setState(null)} aria-label={t('ui.closeDialog')}
            style={{ border: 'none', background: 'transparent', color: 'var(--c-mu)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
        </>
      )}
      <style>{`
        @keyframes syncSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes syncPop  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
