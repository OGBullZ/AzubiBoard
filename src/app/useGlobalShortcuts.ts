import { useEffect } from 'react';
import type { User } from '../types';

// ── Globale Tastatur-Shortcuts: Ctrl+K Suche, ? Hilfe, n Neues Projekt, g+Taste Navigation ──
export function useGlobalShortcuts(
  currentUser: User | null,
  setShowSearch: React.Dispatch<React.SetStateAction<boolean>>,
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>,
  setShowModal: React.Dispatch<React.SetStateAction<boolean>>,
) {
  useEffect(() => {
    let gPrefix = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;
    const fn = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = ['INPUT','TEXTAREA','SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); if (currentUser) setShowSearch(s => !s); return; }
      if (inInput) return;
      if (e.key === '?') { if (currentUser) setShowShortcuts(s => !s); return; }
      // Neues Projekt nur für Ausbilder (konsistent mit 0.6: Azubi/Mentor bekommen Projekte zugewiesen)
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !e.altKey && currentUser?.role === 'ausbilder') { setShowModal(true); return; }
      // G + letter navigation prefix
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey) { gPrefix = true; clearTimeout(gTimer); gTimer = setTimeout(() => { gPrefix = false; }, 1200); return; }
      if (gPrefix) {
        gPrefix = false; clearTimeout(gTimer);
        // Navigation dispatched via custom event (AppLayout handles it inside Router) — rollenabhängig: /users nur Ausbilder
        const map: Record<string, string> = { d: '/dashboard', p: '/projects', k: '/calendar', r: '/reports', t: '/training', l: '/learn', ...(currentUser?.role === 'ausbilder' ? { u: '/users' } : {}) };
        if (map[e.key]) window.dispatchEvent(new CustomEvent('azubiboard:navigate', { detail: map[e.key] }));
      }
    };
    document.addEventListener('keydown', fn);
    return () => { document.removeEventListener('keydown', fn); clearTimeout(gTimer); };
  }, [currentUser, setShowSearch, setShowShortcuts, setShowModal]);
}
