import { createPortal } from 'react-dom';
import { C, getISOWeek, today } from '../../lib/utils.js';
import { isMentor } from '../../lib/roles.js';
import { useDialog } from '../../lib/hooks.js';
import { useNotifications, type NotificationEntry } from '../notifications/useNotifications';
import NewsCard from './NewsCard';
import type { User, AppState, Id } from '../../types';

type WelcomeNewsProps = {
  data: AppState | null;
  currentUser: User;
  onClose: () => void;
  navigate: (to: string) => void;   // Router-sicher via Event-Bus (App.tsx)
};

function greetingByHour(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
}

// Eine aggregierte News-Karte als Datenobjekt (Phase 1: aus den bestehenden
// Notification-Item-Typen — Tasks, Projektdeadlines, Reports — verdichtet).
type Card = { key: string; accent: string; accentBg: string; icon: string; label: string; title: string; sub?: string; to?: string };

function routeFor(items: NotificationEntry[], fallback: string): string {
  if (items.length === 1 && items[0].projectId) return `/project/${items[0].projectId}`;
  return fallback;
}

function azubiCards(notifications: NotificationEntry[]): Card[] {
  const overdue = notifications.filter(n => n.severity === 'critical');
  const soon    = notifications.filter(n => n.severity === 'warning');
  const feedback = notifications.filter(n => n.type === 'report' && n.severity === 'info');
  const cards: Card[] = [];

  if (overdue.length) cards.push({
    key: 'overdue', accent: C.cr, accentBg: C.crd, icon: '⚠', label: 'Überfällig',
    title: overdue.length === 1 ? (overdue[0].title || 'Aufgabe überfällig') : `${overdue.length} Aufgaben überfällig`,
    sub: overdue.length === 1 ? overdue[0].message : `Älteste: „${overdue[0].title}" · ${overdue[0].message}`,
    to: routeFor(overdue, '/projects'),
  });
  if (soon.length) cards.push({
    key: 'soon', accent: '#f78166', accentBg: '#f7816614', icon: '📅', label: 'Diese Woche',
    title: soon.length === 1 ? (soon[0].title || 'Aufgabe bald fällig') : `${soon.length} Aufgaben bald fällig`,
    sub: soon.length === 1 ? soon[0].message : `Nächste: „${soon[0].title}" · ${soon[0].message}`,
    to: routeFor(soon, '/calendar'),
  });
  if (feedback.length) cards.push({
    key: 'feedback', accent: C.gr, accentBg: C.gr + '14', icon: '✓', label: 'Erledigt',
    title: feedback.length === 1 ? (feedback[0].title || 'Bericht mit Feedback') : `${feedback.length} Berichte mit Feedback`,
    sub: feedback.length === 1 ? feedback[0].message : 'Neues Feedback von deinem Ausbilder',
    to: '/reports',
  });
  return cards;
}

function staffCards(notifications: NotificationEntry[]): Card[] {
  const toReview = notifications.filter(n => n.type === 'report');
  const cards: Card[] = [];
  if (toReview.length) cards.push({
    key: 'review', accent: C.ac, accentBg: C.acd, icon: '📋', label: 'Prüfung offen',
    title: `${toReview.length} ${toReview.length === 1 ? 'Berichtsheft wartet' : 'Berichtshefte warten'} auf Prüfung`,
    sub: `Neueste: ${toReview[0].message}`,
    to: '/reports',
  });
  return cards;
}

export default function WelcomeNews({ data, currentUser, onClose, navigate }: WelcomeNewsProps) {
  const ref = useDialog<HTMLDivElement>(onClose);
  const { notifications } = useNotifications(data, currentUser);

  const isStaff = currentUser.role === 'ausbilder' || currentUser.role === 'mentor';
  const mentor  = isMentor(currentUser);
  const firstName = currentUser.name?.split(' ')[0] || currentUser.name || '';

  const now = new Date();
  const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const week = getISOWeek(today()).week;

  const cards = isStaff ? staffCards(notifications) : azubiCards(notifications);

  // Leerzustand (User-Entscheid: Fenster auch bei 0 Items zeigen, "Alles gut")
  const myProjects = (data?.projects || []).filter(p => p.assignees?.includes(currentUser.id as Id));
  const azubiEmptyAccount = !isStaff && myProjects.length === 0;

  const nav = (to: string) => { onClose(); navigate(to); };

  // Primär-CTA je Rolle/Zustand
  const primaryCta = isStaff
    ? (mentor ? { label: 'Zum Dashboard →', to: '/' } : { label: 'Berichte prüfen →', to: '/reports' })
    : (azubiEmptyAccount ? { label: 'Bericht anlegen →', to: '/reports' }
       : cards.length ? { label: cards[0].to === '/reports' ? 'Berichtsheft öffnen →' : 'Zum Dashboard →', to: cards[0].to || '/' }
       : { label: 'Zum Dashboard →', to: '/' });

  const overlay = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'fadeIn .25s ease',
    }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Willkommen" tabIndex={-1} style={{
        background: C.sf, border: `1px solid ${C.bd}`,
        borderRadius: 16, width: '100%', maxWidth: 540,
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.5)',
        animation: 'fadeUp .25s ease',
      }}>
        {/* Header / Begrüßung */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px 14px', borderBottom: `1px solid ${C.bd}`, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.br, lineHeight: 1.2 }}>
              <span aria-hidden="true">👋</span> {greetingByHour()}, {firstName}!
            </div>
            <div style={{ fontSize: 12, color: C.mu, marginTop: 4 }}>
              {dateStr}{week != null && <> · <span style={{ fontFamily: C.mono }}>KW {week}</span></>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Schließen"
            style={{ background: 'transparent', border: 'none', color: C.mu, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px', borderRadius: 5 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {cards.length > 0 ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.mu, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                {isStaff ? 'Zu tun' : 'Deine Lage'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cards.map(c => (
                  <NewsCard key={c.key} accent={c.accent} accentBg={c.accentBg} icon={c.icon} label={c.label}
                    title={c.title} sub={c.sub} onClick={c.to ? () => nav(c.to as string) : undefined} />
                ))}
              </div>
            </>
          ) : azubiEmptyAccount ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, padding: '24px 16px', borderRadius: 10, border: `1px solid ${C.ac}25`, background: C.acd }}>
              <div style={{ fontSize: 28 }} aria-hidden="true">👋</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.br }}>Willkommen zurück, {firstName}!</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Dein Ausbilder weist dir Projekte zu. Bis dahin kannst du deinen ersten Berichtsheft-Eintrag anlegen.
              </div>
            </div>
          ) : isStaff ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', borderRadius: 10, border: `1px solid ${C.gr}25`, background: C.gr + '08' }}>
              <div style={{ fontSize: 28, color: C.gr }} aria-hidden="true">✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gr }}>Alles unter Kontrolle</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Keine Berichte zu prüfen — alle Azubis im Plan.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 16px', borderRadius: 10, border: `1px solid ${C.gr}25`, background: C.gr + '08' }}>
              <div style={{ fontSize: 28, color: C.gr }} aria-hidden="true">✓</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.gr }}>Alles im grünen Bereich!</div>
              <div style={{ fontSize: 13, color: C.mu, textAlign: 'center', lineHeight: 1.6 }}>
                Keine offenen Aufgaben, dein Bericht ist abgegeben.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 22px 18px', borderTop: `1px solid ${C.bd}`, display: 'flex', gap: 10, flexShrink: 0 }}>
          <button className="btn" onClick={onClose} style={{ padding: '10px 18px' }}>Schließen</button>
          <div style={{ flex: 1 }} />
          <button className="abtn" onClick={() => nav(primaryCta.to)} style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700 }}>
            {primaryCta.label}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
