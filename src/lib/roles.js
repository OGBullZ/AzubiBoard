// ============================================================
//  Rollen-Helper (M2, Sprint 10)
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
});

/** Staff = jeder mit Read-Access auf alle Daten (Mentor + Ausbilder) */
export function isStaff(user) {
  return user?.role === ROLES.AUSBILDER || user?.role === ROLES.MENTOR;
}

/** Ausbilder = darf approven/signen/editieren/löschen */
export function isAusbilder(user) {
  return user?.role === ROLES.AUSBILDER;
}

/** Mentor = read-only Staff */
export function isMentor(user) {
  return user?.role === ROLES.MENTOR;
}

export function isAzubi(user) {
  return user?.role === ROLES.AZUBI;
}

/** Lesbarer Anzeigename */
export function roleLabel(role) {
  switch (role) {
    case ROLES.AUSBILDER: return 'Ausbilder';
    case ROLES.MENTOR:    return 'Mentor';
    case ROLES.AZUBI:     return 'Azubi';
    default:              return role || '?';
  }
}
