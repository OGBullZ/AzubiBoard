import { useState, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

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

/**
 * Einheitliches Overlay-Verhalten für alle Dialoge (Phase 4):
 * Escape schließt, Fokus-Trap (Tab/Shift+Tab zyklisch), Auto-Fokus auf das
 * erste fokussierbare Element, Fokus-Rückgabe beim Schließen, Body-Scroll-Lock.
 * Den zurückgegebenen ref auf den Dialog-Container hängen (role="dialog" aria-modal).
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(onClose?: () => void): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = (): HTMLElement[] => {
      const el = ref.current;
      if (!el) return [];
      return Array.from(el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(n => !n.hasAttribute('disabled') && n.offsetParent !== null);
    };

    // Auto-Fokus: erstes fokussierbares Element, sonst der Container
    const initial = focusables()[0];
    if (initial) initial.focus();
    else ref.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose?.(); return; }
      if (e.key === 'Tab') {
        const f = focusables();
        if (f.length === 0) { e.preventDefault(); return; }
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [onClose]);
  return ref;
}

// ── Design-Version (1.0 / 1.0 Beta) ──────────────────────────
// Liest data-design (Boot-Apply in main.tsx) und re-rendert live beim Umschalten
// (DesignSwitch dispatcht 'azubiboard:design'). Für JSX-Verzweigungen, die im
// Beta-Design anders rendern (CSS-only-Unterschiede brauchen den Hook NICHT).
export function useDesign(): 'v1' | 'beta' {
  const [d, setD] = useState<'v1' | 'beta'>(() =>
    (document.documentElement.getAttribute('data-design') as 'v1' | 'beta') || 'v1');
  useEffect(() => {
    const fn = () => setD((document.documentElement.getAttribute('data-design') as 'v1' | 'beta') || 'v1');
    window.addEventListener('azubiboard:design', fn);
    return () => window.removeEventListener('azubiboard:design', fn);
  }, []);
  return d;
}
