// ============================================================
//  store.js – App State + Multi-Tab-Sync
//  Pfad: src/lib/store.js
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { persistData } from './utils';
import { dataService } from './dataService';

// ── Globaler State ───────────────────────────────────────────
let _state = {
  data: null,
  currentUser: null,
};
const _listeners = new Set();

function setState(patch) {
  _state = { ..._state, ...patch };
  _listeners.forEach(fn => fn(_state));
}

// ── BroadcastChannel (Multi-Tab-Sync) ───────────────────────
// Nur data wird synchronisiert; currentUser bleibt pro Tab.
const _ch = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('azubiboard_sync')
  : null;

if (_ch) {
  _ch.onmessage = (e) => {
    if (e.data?.type === 'data' && e.data.payload) {
      // Anderen Tabs update geben, ohne erneut zu broadcasten
      setState({ data: e.data.payload });
    }
  };
}

// ── Hook ─────────────────────────────────────────────────────
export function useAppStore() {
  const [state, setLocalState] = useState(_state);

  useEffect(() => {
    const listener = (s) => setLocalState({ ...s });
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  }, []);

  const setData = useCallback((dataOrFn) => {
    // Funktionale Updates erlaubt: setData(prev => ({ ...prev, users: newList }))
    const next = typeof dataOrFn === 'function' ? dataOrFn(_state.data) : dataOrFn;
    setState({ data: next });
    try { persistData(next); } catch {}
    // API-Persistenz (fire & forget) — kein Reload auf 401, nur localStorage-Fallback
    dataService.saveData(next).catch(() => {});
    // Andere Tabs informieren (eigener Tab empfängt seine eigene
    // Nachricht NICHT — BroadcastChannel-Spec § 6.1)
    _ch?.postMessage({ type: 'data', payload: next });
  }, []);

  const setCurrentUser = useCallback((currentUser) => {
    setState({ currentUser });
  }, []);

  return {
    data:        state.data,
    currentUser: state.currentUser,
    setData,
    setCurrentUser,
  };
}
