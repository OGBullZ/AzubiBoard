// ============================================================
//  Rollen-Helper (M2, Sprint 10) — TypeScript-Migration (T1, Sprint 14)
//  Zentrale Definition wer was darf — Frontend.
// ============================================================
//
//  Rollen-Hierarchie:
//    azubi    — Lerner, sieht nur eigene Daten, kann eigene Berichte
//               einreichen/bearbeiten (im Entwurf-Status)
//    mentor   — sieht alle Daten wie Ausbilder, kann kommentieren,
//               aber NICHT approven / signen / editieren / löschen
//    ausbilder — voller Zugriff, kann User-Management und Restore
//
//  Niemals direkt `user.role === 'ausbilder'` im UI checken; immer
//  hierüber gehen, sonst bleibt Mentor-Support unvollständig.

export const ROLES = Object.freeze({
  AZUBI: 'azubi',
  MENTOR: 'mentor',
  AUSBILDER: 'ausbilder',
} as const);

/** Gültige Rollen-Werte (Union aus den ROLES-Konstanten). */
export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Minimal-Shape: die Guards brauchen nur die Rolle. */
export interface RoleHolder {
  role?: Role | string | null;
}

/** Staff = jeder mit Read-Access auf alle Daten (Mentor + Ausbilder) */
export function isStaff(user?: RoleHolder | null): boolean {
  return user?.role === ROLES.AUSBILDER || user?.role === ROLES.MENTOR;
}

/** Ausbilder = darf approven/signen/editieren/löschen */
export function isAusbilder(user?: RoleHolder | null): boolean {
  return user?.role === ROLES.AUSBILDER;
}

/** Mentor = read-only Staff */
export function isMentor(user?: RoleHolder | null): boolean {
  return user?.role === ROLES.MENTOR;
}

export function isAzubi(user?: RoleHolder | null): boolean {
  return user?.role === ROLES.AZUBI;
}

/** Lesbarer Anzeigename */
export function roleLabel(role?: Role | string | null): string {
  switch (role) {
    case ROLES.AUSBILDER: return 'Ausbilder';
    case ROLES.MENTOR:    return 'Mentor';
    case ROLES.AZUBI:     return 'Azubi';
    default:              return role || '?';
  }
}
