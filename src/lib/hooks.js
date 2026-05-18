import { useState, useEffect } from 'react';

/**
 * Verzögert einen Wert um `delay` ms nach der letzten Änderung.
 * Verhindert per-Keystroke Filterläufe in Search-Inputs.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
