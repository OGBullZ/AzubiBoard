// ============================================================
//  store.ts – App State + Multi-Tab-Sync  (T1 Sprint 14: js → ts)
//  Pfad: src/lib/store.ts
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { persistData } from './utils';
import { dataService } from './dataService';

type AppData = Record<string, unknown>;
type CurrentUser = Record<string, unknown> | null;

interface StoreState {
  data: AppData | null;
  currentUser: CurrentUser;
}

// ── Globaler State ───────────────────────────────────────────
let _state: StoreState = {
  data: null,
  currentUser: null,
};
const _listeners = new Set<(s: StoreState) => void>();

function setState(patch: Partial<StoreState>): void {
  _state = { ..._state, ...patch };
  _listeners.forEach(fn => fn(_state));
}

// ── BroadcastChannel (Multi-Tab-Sync) ───────────────────────
// Nur data wird synchronisiert; currentUser bleibt pro Tab.
const _ch = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('azubiboard_sync')
  : null;

if (_ch) {
  _ch.onmessage = (e: MessageEvent) => {
    if (e.data?.type === 'data' && e.data.payload) {
      // Anderen Tabs update geben, ohne erneut zu broadcasten
      setState({ data: e.data.payload });
    }
  };
}

// ── Hook ─────────────────────────────────────────────────────
type DataUpdater = AppData | ((prev: AppData | null) => AppData);

export function useAppStore() {
  const [state, setLocalState] = useState<StoreState>(_state);

  useEffect(() => {
    const listener = (s: StoreState) => setLocalState({ ...s });
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const setData = useCallback((dataOrFn: DataUpdater) => {
    // Funktionale Updates erlaubt: setData(prev => ({ ...prev, users: newList }))
    const next = typeof dataOrFn === 'function' ? dataOrFn(_state.data) : dataOrFn;
    setState({ data: next });
    try { persistData(next); } catch { /* noop */ }
    // API-Persistenz (fire & forget) — kein Reload auf 401, nur localStorage-Fallback
    dataService.saveData(next).catch(() => {});
    // Andere Tabs informieren (eigener Tab empfängt seine eigene
    // Nachricht NICHT — BroadcastChannel-Spec § 6.1)
    _ch?.postMessage({ type: 'data', payload: next });
  }, []);

  const setCurrentUser = useCallback((currentUser: CurrentUser) => {
    setState({ currentUser });
  }, []);

  return {
    data:        state.data,
    currentUser: state.currentUser,
    setData,
    setCurrentUser,
  };
}
