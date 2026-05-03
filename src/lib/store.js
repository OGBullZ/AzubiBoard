// ============================================================
//  store.js – App State (kein Zustand, pure React)
//  Pfad: src/lib/store.js
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { persistData } from './utils';

// Globaler State als einfaches Objekt (kein Zustand nötig)
let _state = {
  data: null,
  currentUser: null,
};
const _listeners = new Set();

function setState(patch) {
  _state = { ..._state, ...patch };
  _listeners.forEach(fn => fn(_state));
}

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
  }, []);

  const setCurrentUser = useCallback((currentUser) => {
    setState({ currentUser });
  }, []);

  return {
    data:           state.data,
    currentUser:    state.currentUser,
    setData,
    setCurrentUser,
  };
}
