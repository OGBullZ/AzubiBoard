// ============================================================
//  store.js – App State + Multi-Tab-Sync
//  Pfad: src/lib/store.js
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { persistData } from './utils';

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

  const setData = useCallback((data) => {
    setState({ data });
    try { persistData(data); } catch {}
    // Andere Tabs informieren (eigener Tab empfängt seine eigene
    // Nachricht NICHT — BroadcastChannel-Spec § 6.1)
    _ch?.postMessage({ type: 'data', payload: data });
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
