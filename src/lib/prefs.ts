// ============================================================
//  prefs – Personalisierung (Akzent / Theme / Sound)
//  Eine Quelle für ProfilePage-DesignSwitch UND Onboarding-
//  „Werkbank einrichten": wendet sofort an (localStorage +
//  <html>-Attribute) und benachrichtigt React-Konsumenten per Event.
// ============================================================
import { dataService } from './dataService.js';

const USE_API = import.meta.env.VITE_USE_API === 'true';

export const ACCENTS = [
  { val: 'orange', hex: '#FF6A1A', label: 'Signal-Orange' },
  { val: 'amber',  hex: '#FFB224', label: 'Amber' },
  { val: 'cyan',   hex: '#3FD2C7', label: 'Cyan' },
];

export function applyAccent(val: string): void {
  try { localStorage.setItem('azubiboard_accent', val); } catch { /* noop */ }
  document.documentElement.setAttribute('data-accent', val);
}

export type ThemeChoice = 'dark' | 'light' | 'system';

/** Theme setzen wie der Sidebar-Toggle (inkl. Manual-Marker + API-Sync).
 *  'system' löscht den Manual-Marker → OS-Sync übernimmt wieder. */
export function applyThemeChoice(choice: ThemeChoice): void {
  const sysLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const next = choice === 'system' ? (sysLight ? 'light' : 'dark') : choice;
  try {
    if (choice === 'system') localStorage.removeItem('azubiboard_theme_manual');
    else localStorage.setItem('azubiboard_theme_manual', '1');
    localStorage.setItem('azubiboard_theme', next);
  } catch { /* noop */ }
  document.documentElement.setAttribute('data-theme', next);
  window.dispatchEvent(new Event('azubiboard:theme')); // useTheme-State syncen
  if (USE_API) dataService.syncTheme(next);
}

export function setSoundPref(on: boolean): void {
  try { localStorage.setItem('azubiboard_sound', on ? 'on' : 'off'); } catch { /* noop */ }
}
