import { useState, useEffect } from 'react';

/**
 * Verzögert einen Wert um `delay` ms nach der letzten Änderung.
 * Verhindert per-Keystroke Filterläufe in Search-Inputs.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
