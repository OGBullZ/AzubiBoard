// ============================================================
//  backup.js – Datensicherungs-Reminder
//  Trackt letztes Export-Datum in localStorage und liefert
//  needsBackup() für UI-Reminder. Kein Auto-Download – der
//  User muss aktiv klicken (kein "Surprise"-Verhalten).
// ============================================================

const KEY_LAST_BACKUP = 'azubiboard_last_backup_ts';
const KEY_DISMISSED   = 'azubiboard_backup_dismissed_until';
const DEFAULT_DAYS    = 7;

export function recordBackup() {
  try { localStorage.setItem(KEY_LAST_BACKUP, String(Date.now())); } catch {}
  try { localStorage.removeItem(KEY_DISMISSED); } catch {}
}

export function lastBackupAt() {
  try {
    const v = localStorage.getItem(KEY_LAST_BACKUP);
    return v ? Number(v) : null;
  } catch { return null; }
}

export function daysSinceBackup() {
  const ts = lastBackupAt();
  if (!ts) return Infinity;
  return (Date.now() - ts) / 86_400_000;
}

export function needsBackup(thresholdDays = DEFAULT_DAYS) {
  // Dismissed-Window respektieren ("nicht heute erinnern")
  try {
    const until = Number(localStorage.getItem(KEY_DISMISSED) || 0);
    if (until && Date.now() < until) return false;
  } catch {}
  return daysSinceBackup() >= thresholdDays;
}

// Reminder bis zum Ende des Tages aussetzen
export function snoozeReminder(hours = 24) {
  try {
    const until = Date.now() + hours * 3600_000;
    localStorage.setItem(KEY_DISMISSED, String(until));
  } catch {}
}
