import { useState, useEffect, useCallback } from 'react';
import { dataService } from './dataService';

const USE_API = import.meta.env.VITE_USE_API === 'true';

// ── Theme aus User-Objekt übernehmen (nach Login / Startup) ──
export function applyUserTheme(theme?: string | null) {
  if (!theme) return;
  localStorage.setItem('azubiboard_theme', theme);
  // Ein in der DB gespeichertes Theme ist eine explizite Wahl → Manual-Marker
  // setzen, sonst überschreibt der OS-Sync-Handler die Wahl still (Bug-Hunt 3 #2).
  localStorage.setItem('azubiboard_theme_manual', '1');
  document.documentElement.setAttribute('data-theme', theme);
}

// ── Theme ─────────────────────────────────────────────────────
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('azubiboard_theme');
    // Beim ersten Besuch (kein gespeicherter Wert): OS-Präferenz übernehmen
    const t = stored || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    if (!stored) localStorage.setItem('azubiboard_theme', t);
    document.documentElement.setAttribute('data-theme', t);
    return t;
  });
  // Externe Theme-Setzer (Onboarding „Werkbank einrichten" via lib/prefs) syncen den Toggle-State
  useEffect(() => {
    const fn = () => setTheme(localStorage.getItem('azubiboard_theme') || 'dark');
    window.addEventListener('azubiboard:theme', fn);
    return () => window.removeEventListener('azubiboard:theme', fn);
  }, []);
  // OS-Theme-Änderungen live mitsynchronisieren (nur wenn kein manuelles Override)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      // Nur anpassen wenn das Theme noch dem OS-Standard entspricht (kein manuelles Toggle)
      const stored = localStorage.getItem('azubiboard_theme_manual');
      if (stored) return; // Nutzer hat manuell gewählt → ignorieren
      const next = e.matches ? 'light' : 'dark';
      setTheme(next);
      localStorage.setItem('azubiboard_theme', next);
      document.documentElement.setAttribute('data-theme', next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark';
      localStorage.setItem('azubiboard_theme', next);
      localStorage.setItem('azubiboard_theme_manual', '1'); // OS-Sync deaktivieren
      // D6 Signature 6: Theme-Wechsel als weicher Sweep (View Transitions, progressive enhancement)
      const apply = () => document.documentElement.setAttribute('data-theme', next);
      const beta = document.documentElement.getAttribute('data-design') === 'beta';
      const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (beta && motionOk && 'startViewTransition' in document) (document as any).startViewTransition(apply);
      else apply();
      if (USE_API) dataService.syncTheme(next);
      return next;
    });
  }, []);
  return { theme, toggleTheme };
}
