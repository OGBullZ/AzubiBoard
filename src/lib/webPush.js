// ============================================================
//  webPush.js – Browser-native Notification-API (J7)
//
//  KEINE serverseitige Push-Subscription. Wir feuern Notifications
//  aus dem (offenen) Tab heraus, wenn neue Events auftauchen UND
//  der Tab im Hintergrund ist. Funktioniert in Chrome, Firefox,
//  Safari (macOS 13+) — alles ohne Backend-Push.
//
//  Für echte Server-Push würde man PushManager + VAPID-Keys +
//  Service-Worker-Subscription brauchen (siehe Roadmap).
// ============================================================

const PREF_KEY     = 'azubiboard_notify_enabled';
const SEEN_PREFIX  = 'azubiboard_notify_seen_';

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function currentPermission() {
  if (!isSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied')  return 'denied';
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'denied';
  }
}

// User-Präferenz (kann auch bei granted Permission unabhängig deaktiviert sein)
export function isEnabled() {
  try {
    const v = localStorage.getItem(PREF_KEY);
    return v === null ? true : v === 'true';   // Default: an, wenn nicht explizit aus
  } catch { return true; }
}

export function setEnabled(b) {
  try { localStorage.setItem(PREF_KEY, b ? 'true' : 'false'); } catch {}
}

// Markiert eine Notification-ID als "schon gepusht", damit wir bei
// erneutem Polling kein Spam-Buzzing produzieren.
function getSeen(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_PREFIX + userId) || '[]')); }
  catch { return new Set(); }
}
function setSeen(userId, ids) {
  try { localStorage.setItem(SEEN_PREFIX + userId, JSON.stringify([...ids].slice(-200))); } catch {}
}

// Hauptfunktion: vergleicht aktuelle notifications mit seen-Set,
// pusht alles Neue. Pusht NUR wenn:
//  - User Permission gegeben (granted)
//  - Settings-Toggle on
//  - Tab gerade nicht im Vordergrund (sonst nervig — UI-Bell reicht)
export function fireForNewNotifications(userId, notifications) {
  if (!userId || !notifications?.length) return;
  if (!isSupported() || Notification.permission !== 'granted' || !isEnabled()) return;

  const isTabHidden = typeof document !== 'undefined' && document.hidden;
  if (!isTabHidden) return;  // Im aktiven Tab: nicht stören

  const seen = getSeen(userId);
  const newOnes = notifications.filter(n => !seen.has(n.id));
  if (!newOnes.length) return;

  // Max 3 gleichzeitig (Spam-Schutz)
  newOnes.slice(0, 3).forEach(n => {
    try {
      const notif = new Notification(n.title || 'AzubiBoard', {
        body:    n.message || '',
        icon:    `${import.meta.env.VITE_BASE_PATH || '/azubiboard/'}pwa-icon.svg`,
        tag:     n.id,                 // Re-Use → kein Duplikat-Stack
        silent:  n.severity !== 'critical',
        // 'critical' = überfällig → "requireInteraction" wäre möglich,
        // aber Mac-Safari unterstützt das nicht; weglassen für Konsistenz.
      });
      notif.onclick = () => { window.focus(); notif.close(); };
    } catch { /* manche Browser werfen bei tag-collision */ }
  });

  // Alle gesehen markieren (auch die >3, damit sie beim nächsten Mal nicht erneut feuern)
  newOnes.forEach(n => seen.add(n.id));
  setSeen(userId, seen);
}
